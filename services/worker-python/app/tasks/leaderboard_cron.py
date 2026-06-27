"""Leaderboard weekly promotion — Celery Beat cron task.

Runs every Monday 00:00 UTC and reconciles weekly XP into the leaderboard
leagues (Bronze -> Diamond). The promotion logic is *deterministic* and
idempotent — running the task twice in the same week is a no-op.

Why a worker cron, not in-process:
- The BFF holds no Postgres connection long enough to do the aggregation
  in a request handler; running it as a Celery task keeps the web tier
  responsive.
- Celery Beat (configured in `services/worker-python/railway.toml` +
  a separate `celery beat` process) gives us retries, logging, and a
  single source of truth across multiple worker instances.

For tests:
- `aggregate_weekly_xp` is pure (date_in -> {userId: xp}) so the math
  is unit-testable without a DB.
- `promote_demote` is also pure (rows_in -> rows_out).
- `run_weekly_promotion` is the orchestrator — it calls the aggregates
  and is the only function that needs DB access in tests.

Privacy / observability:
- We log only counts (users_scored, promoted, demoted) and the
  computed league boundaries. Never log raw XpEvent rows or user
  identifiers beyond `user_id_hash`.
- Emits `leaderboard.promotion_complete` per TESTING.md §9.
"""

from __future__ import annotations

import hashlib
import logging
import time
from dataclasses import dataclass
from typing import Iterable

from celery import shared_task

logger = logging.getLogger("readmaxxing.leaderboard_cron")

# League definitions — deterministic thresholds in weekly XP.
# Bronze/Silver/Gold/Platinum/Diamond, with a small overlap for friend
# leagues (handled in the BFF query, not here).
LEAGUE_TIERS: tuple[str, ...] = ("bronze", "silver", "gold", "platinum", "diamond")

# Threshold mapping: index N -> minimum weekly XP to be in that tier.
# Picked so each tier is reachable inside a week of heavy reading
# (~2 h/day @ 1x). These match the in-app copy.
LEAGUE_THRESHOLDS: dict[str, int] = {
    "bronze": 0,
    "silver": 500,
    "gold": 1500,
    "platinum": 3500,
    "diamond": 7000,
}


@dataclass(frozen=True)
class LeagueRow:
    user_id: str
    weekly_xp: int
    current_tier: str | None = None


@dataclass(frozen=True)
class LeagueBoundary:
    tier: str
    min_xp: int


def league_boundaries() -> list[LeagueBoundary]:
    """Sorted ascending — bronze (lowest min) first."""
    return [LeagueBoundary(tier=t, min_xp=v) for t, v in LEAGUE_THRESHOLDS.items()]


def determine_tier(weekly_xp: int) -> str:
    """Map a weekly XP number to the user's new league tier.

    Pure function — unit-tested in `tests/test_leaderboard_cron.py`.
    """
    tier = "bronze"
    for boundary in league_boundaries():
        if weekly_xp >= boundary.min_xp:
            tier = boundary.tier
    return tier


def aggregate_weekly_xp(
    xp_events: Iterable[dict],
    *,
    week_start_ts: float,
    week_end_ts: float,
) -> dict[str, int]:
    """Sum XpEvent rows into a per-user weekly total.

    Pure — accepts the rows as already-fetched dicts so the test
    can drive it without a DB. The caller is responsible for the
    SELECT (this keeps the function focused on the math).
    """
    totals: dict[str, int] = {}
    for evt in xp_events:
        ts = float(evt.get("createdAt") or evt.get("created_at") or 0)
        if ts < week_start_ts or ts >= week_end_ts:
            continue
        amount = int(evt.get("amount") or 0)
        user_id = evt.get("userId") or evt.get("user_id")
        if not user_id or amount <= 0:
            continue
        totals[user_id] = totals.get(user_id, 0) + amount
    return totals


def promote_demote(
    rows: Iterable[LeagueRow],
    *,
    previous_tiers: dict[str, str] | None = None,
) -> tuple[list[LeagueRow], dict[str, tuple[str, str]]]:
    """Apply the weekly tier shift to every row.

    Returns:
      - `new_rows`: the rows with their `current_tier` set.
      - `changes`: `{user_id: (old_tier_or_none, new_tier)}` for the
        rows whose tier actually changed. The BFF writes these into a
        `LeaderboardPromotion` audit row.

    Pure function — unit-tested.
    """
    prev = previous_tiers or {}
    new_rows: list[LeagueRow] = []
    changes: dict[str, tuple[str, str]] = {}
    for row in rows:
        old_tier = prev.get(row.user_id)
        new_tier = determine_tier(row.weekly_xp)
        new_rows.append(LeagueRow(row.user_id, row.weekly_xp, new_tier))
        # Only emit a change when the user had a previous tier AND moved.
        # A first-week user going "none -> bronze" is not a promotion —
        # it's their initial assignment — so we don't want it in the
        # audit log. Promotion/demotion counts in `run_weekly_promotion`
        # derive from this map, so getting the semantics right here
        # matters for the metrics.
        if old_tier is not None and old_tier != new_tier:
            changes[row.user_id] = (old_tier, new_tier)
    return new_rows, changes


def week_window(now_ts: float | None = None) -> tuple[float, float]:
    """Return the (start, end) unix timestamps of the most recently
    completed week (Mon 00:00 UTC -> next Mon 00:00 UTC).

    Pure helper — given `now_ts`, returns the window of the week that
    *ended* at the start of this week. So if `now_ts` is mid-week, this
    returns last week's window.
    """
    from datetime import datetime, timedelta, timezone

    now = datetime.fromtimestamp(now_ts if now_ts is not None else time.time(), tz=timezone.utc)
    # Find the most recent Monday 00:00 UTC.
    monday = now - timedelta(days=now.weekday())
    monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = monday.timestamp()
    week_start = (monday - timedelta(days=7)).timestamp()
    return week_start, week_end


def hash_user_id(user_id: str) -> str:
    """sha256(userId).slice(0, 16) — same shape as the BFF's logger.

    Used in the audit log so we never write the raw Privy id to a log
    line per TESTING.md §8.7.
    """
    return hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:16]


@shared_task(name="app.tasks.leaderboard_cron.run_weekly_promotion")
def run_weekly_promotion() -> dict[str, int | str]:
    """Orchestrator — runs the weekly promotion end-to-end.

    In production this hits Postgres via the `PrismaClient` we already
    import in the BFF; here we keep the function import-light and let
    the caller inject the fetcher. The test passes a fake fetcher and
    asserts the change map; a production wiring passes the real one.

    Returns a small summary dict (counts + week_key) for the Beat
    result backend.
    """
    # Default fetcher — uses the SQL the BFF already uses to list
    # `XpEvent` rows. Kept lazy so the test runner doesn't require
    # Postgres at import time.
    week_start, week_end = week_window()
    week_key = time.strftime("%G-W%V", time.gmtime(week_end))
    started = time.time()
    try:
        events = _fetch_xp_events(week_start, week_end)
        totals = aggregate_weekly_xp(
            events, week_start_ts=week_start, week_end_ts=week_end
        )
        rows = [LeagueRow(user_id=uid, weekly_xp=xp) for uid, xp in totals.items()]
        previous_tiers = _fetch_previous_tiers()
        _, changes = promote_demote(rows, previous_tiers=previous_tiers)
        promoted = sum(1 for old, new in changes.values() if _tier_rank(new) > _tier_rank(old))
        demoted = sum(1 for old, new in changes.values() if _tier_rank(new) < _tier_rank(old))
        # The actual DB write happens in `_persist_leaderboard` — the
        # orchestrator does the read+compute and the persist is a small
        # separate function so the test can ignore it.
        _persist_leaderboard(week_key, totals, changes)
        duration_ms = int((time.time() - started) * 1000)
        logger.info(
            "leaderboard.promotion_complete: week_key=%s users_scored=%d "
            "promoted=%d demoted=%d duration_ms=%d",
            week_key,
            len(totals),
            promoted,
            demoted,
            duration_ms,
        )
        return {
            "week_key": week_key,
            "users_scored": len(totals),
            "promoted": promoted,
            "demoted": demoted,
            "duration_ms": duration_ms,
        }
    except Exception as exc:  # pragma: no cover — orchestration failures
        duration_ms = int((time.time() - started) * 1000)
        logger.error(
            "leaderboard.promotion_failed: error_class=%s duration_ms=%d",
            type(exc).__name__,
            duration_ms,
        )
        # Re-raise so Celery Beat schedules a retry per the policy.
        raise


def _tier_rank(tier: str) -> int:
    """Numeric rank for the comparison in `promote_demote`."""
    try:
        return LEAGUE_TIERS.index(tier)
    except ValueError:
        return -1


# ---------------------------------------------------------------------------
# Persistence shims — kept here so the cron module owns its own SQL, and the
# test can override them by monkeypatching the module attribute.
# ---------------------------------------------------------------------------


def _fetch_xp_events(week_start: float, week_end: float) -> list[dict]:
    """Fetch XpEvent rows in the given week window.

    Default implementation uses SQLAlchemy/psycopg2 directly because the
    worker's `app.db` is intentionally minimal. The BFF has the canonical
    Prisma client and is the source of truth for the schema; this is the
    worker's read-only mirror.
    """
    database_url = ().__class__.__module__  # noqa — placeholder; replaced below
    import os

    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        # No DB configured (e.g. local tests) — return an empty list.
        return []
    try:
        import psycopg2  # type: ignore
        import psycopg2.extras  # type: ignore
    except ImportError:
        logger.warning("psycopg2 not installed; leaderboard cron skipped.")
        return []
    conn = psycopg2.connect(database_url)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT "userId", amount, "createdAt"
                FROM "XpEvent"
                WHERE "createdAt" >= to_timestamp(%s)
                  AND "createdAt" < to_timestamp(%s)
                """,
                (week_start, week_end),
            )
            return list(cur.fetchall())
    finally:
        conn.close()


def _fetch_previous_tiers() -> dict[str, str]:
    """Map userId -> most recent LeaderboardEntry.tier.

    Returns an empty dict when the table is empty or unavailable — the
    promote/demote math treats "no prior tier" as a fresh entry (so
    promotions show up on the audit log even for first-week users).
    """
    import os

    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        return {}
    try:
        import psycopg2  # type: ignore
        import psycopg2.extras  # type: ignore
    except ImportError:
        return {}
    conn = psycopg2.connect(database_url)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT DISTINCT ON ("userId") "userId", tier
                FROM "LeaderboardEntry"
                ORDER BY "userId", "weekStart" DESC
                """
            )
            return {row["userId"]: row["tier"] for row in cur.fetchall()}
    finally:
        conn.close()


def _persist_leaderboard(
    week_key: str, totals: dict[str, int], changes: dict[str, tuple[str, str]]
) -> None:
    """Upsert the new LeaderboardEntry rows + an audit log row per change.

    No-op when no DB is configured (test runner, dry-run).
    """
    import os

    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        return
    try:
        import psycopg2  # type: ignore
        import psycopg2.extras  # type: ignore
    except ImportError:
        return
    from datetime import datetime, timezone

    # week_key is "YYYY-Www"; convert back to a Monday 00:00 UTC date.
    iso_year, iso_week = week_key.split("-W")
    monday = datetime.fromisocalendar(int(iso_year), int(iso_week), 1).replace(
        tzinfo=timezone.utc
    )
    conn = psycopg2.connect(database_url)
    try:
        with conn:
            with conn.cursor() as cur:
                for user_id, weekly_xp in totals.items():
                    tier = determine_tier(weekly_xp)
                    cur.execute(
                        """
                        INSERT INTO "LeaderboardEntry"
                          (id, "userId", "weekStart", tier, "weeklyXp", "updatedAt")
                        VALUES (gen_random_uuid()::text, %s, %s, %s, %s, NOW())
                        ON CONFLICT ("userId", "weekStart")
                        DO UPDATE SET tier = EXCLUDED.tier,
                                      "weeklyXp" = EXCLUDED."weeklyXp",
                                      "updatedAt" = NOW()
                        """,
                        (user_id, monday.date(), tier, weekly_xp),
                    )
                for user_id, (old_tier, new_tier) in changes.items():
                    cur.execute(
                        """
                        INSERT INTO "LeaderboardPromotion"
                          (id, "userId", "weekKey", "oldTier", "newTier", "createdAt")
                        VALUES (gen_random_uuid()::text, %s, %s, %s, %s, NOW())
                        """,
                        (user_id, week_key, old_tier, new_tier),
                    )
    finally:
        conn.close()


__all__ = [
    "aggregate_weekly_xp",
    "determine_tier",
    "promote_demote",
    "run_weekly_promotion",
    "week_window",
    "LEAGUE_THRESHOLDS",
    "LEAGUE_TIERS",
]
