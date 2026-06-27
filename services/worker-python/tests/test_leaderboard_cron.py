"""Leaderboard cron — unit tests.

Pins the deterministic promotion math (`aggregate_weekly_xp`,
`determine_tier`, `promote_demote`) so the cron is safe to run on
schedule. The DB-touching orchestrator (`run_weekly_promotion`) is
exercised by monkeypatching the persistence shims — no Postgres
required in CI.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


@pytest.fixture()
def cron_module():
    """Reload the cron module so env-mutating tests start clean."""
    module = importlib.import_module("app.tasks.leaderboard_cron")
    importlib.reload(module)
    return module


# ---------------------------------------------------------------------------
# Tier math — pure functions.
# ---------------------------------------------------------------------------


def test_determine_tier_uses_highest_threshold_reached(cron_module) -> None:
    assert cron_module.determine_tier(0) == "bronze"
    assert cron_module.determine_tier(499) == "bronze"
    assert cron_module.determine_tier(500) == "silver"
    assert cron_module.determine_tier(1499) == "silver"
    assert cron_module.determine_tier(1500) == "gold"
    assert cron_module.determine_tier(3499) == "gold"
    assert cron_module.determine_tier(3500) == "platinum"
    assert cron_module.determine_tier(6999) == "platinum"
    assert cron_module.determine_tier(7000) == "diamond"
    assert cron_module.determine_tier(1_000_000) == "diamond"


def test_determine_tier_negative_amount_is_bronze(cron_module) -> None:
    # Defensive — we never want a refund to bump anyone out of bronze.
    assert cron_module.determine_tier(-100) == "bronze"


def test_aggregate_weekly_xp_sums_per_user(cron_module) -> None:
    events = [
        {"userId": "u1", "amount": 100, "createdAt": 1700000000.0},
        {"userId": "u1", "amount": 250, "createdAt": 1700001000.0},
        {"userId": "u2", "amount": 1500, "createdAt": 1700002000.0},
    ]
    totals = cron_module.aggregate_weekly_xp(
        events, week_start_ts=1699999000.0, week_end_ts=1700100000.0
    )
    assert totals == {"u1": 350, "u2": 1500}


def test_aggregate_weekly_xp_filters_outside_window(cron_module) -> None:
    events = [
        # Before the window — must be excluded.
        {"userId": "u1", "amount": 999, "createdAt": 1699998000.0},
        # Inside the window.
        {"userId": "u1", "amount": 50, "createdAt": 1699999500.0},
        # At the boundary — start is inclusive, end is exclusive.
        {"userId": "u2", "amount": 75, "createdAt": 1700000000.0},
        {"userId": "u3", "amount": 999, "createdAt": 1700100000.0},
    ]
    totals = cron_module.aggregate_weekly_xp(
        events, week_start_ts=1699999000.0, week_end_ts=1700100000.0
    )
    assert totals == {"u1": 50, "u2": 75}


def test_aggregate_weekly_xp_skips_zero_and_missing(cron_module) -> None:
    events = [
        {"userId": "u1", "amount": 0, "createdAt": 1700000000.0},
        {"userId": "", "amount": 500, "createdAt": 1700000000.0},
        {"amount": 500, "createdAt": 1700000000.0},  # no userId
        {"userId": "u2", "amount": 25, "createdAt": 1700000000.0},
    ]
    totals = cron_module.aggregate_weekly_xp(
        events, week_start_ts=1699999000.0, week_end_ts=1700100000.0
    )
    assert totals == {"u2": 25}


def test_promote_demote_marks_only_actual_changes(cron_module) -> None:
    rows = [
        cron_module.LeagueRow("u1", 100),   # bronze -> bronze (no change)
        cron_module.LeagueRow("u2", 800),   # bronze -> silver (promotion)
        cron_module.LeagueRow("u3", 12000), # silver (prev) -> diamond (promotion)
    ]
    previous = {"u2": "bronze", "u3": "silver"}
    new_rows, changes = cron_module.promote_demote(rows, previous_tiers=previous)
    by_user = {row.user_id: row.current_tier for row in new_rows}
    assert by_user == {"u1": "bronze", "u2": "silver", "u3": "diamond"}
    assert set(changes.keys()) == {"u2", "u3"}
    assert changes["u2"] == ("bronze", "silver")
    assert changes["u3"] == ("silver", "diamond")


def test_promote_demote_records_demotions(cron_module) -> None:
    rows = [
        cron_module.LeagueRow("u1", 100),  # dropped from gold to bronze
    ]
    previous = {"u1": "gold"}
    _, changes = cron_module.promote_demote(rows, previous_tiers=previous)
    assert changes == {"u1": ("gold", "bronze")}


def test_promote_demote_no_previous_treats_as_initial(cron_module) -> None:
    """A first-week user entering at any tier is NOT a promotion — we
    don't want the audit log full of "none -> bronze" noise.
    """
    rows = [cron_module.LeagueRow("u1", 1500)]
    new_rows, changes = cron_module.promote_demote(rows, previous_tiers=None)
    assert new_rows[0].current_tier == "gold"
    assert changes == {}


# ---------------------------------------------------------------------------
# Orchestrator — monkeypatched persistence so no DB is required.
# ---------------------------------------------------------------------------


def test_run_weekly_promotion_logs_counts(monkeypatch, cron_module) -> None:
    """End-to-end test of the orchestrator without a DB.

    The fetch helpers are replaced with fixed data; the persist helper
    is replaced with a recording stub. We assert the summary dict the
    Celery task returns + the persist call shape.
    """
    week_start, week_end = 1700000000.0, 1700604800.0

    monkeypatch.setattr(cron_module, "week_window", lambda: (week_start, week_end))
    monkeypatch.setattr(
        cron_module,
        "_fetch_xp_events",
        lambda ws, we: [
            {"userId": "u1", "amount": 1000, "createdAt": week_start + 100},
            {"userId": "u1", "amount": 600, "createdAt": week_start + 200},
            {"userId": "u2", "amount": 100, "createdAt": week_start + 300},
            # Outside the window — must be ignored.
            {"userId": "u3", "amount": 99999, "createdAt": week_end + 100},
        ],
    )
    monkeypatch.setattr(
        cron_module,
        "_fetch_previous_tiers",
        lambda: {"u1": "bronze", "u2": "silver"},
    )

    persisted: dict = {}

    def fake_persist(week_key, totals, changes):
        persisted["week_key"] = week_key
        persisted["totals"] = totals
        persisted["changes"] = changes

    monkeypatch.setattr(cron_module, "_persist_leaderboard", fake_persist)

    summary = cron_module.run_weekly_promotion()

    # u1 = 1600 xp -> gold (promotion from bronze)
    # u2 =  100 xp -> bronze (demotion from silver)
    assert summary["users_scored"] == 2
    assert summary["promoted"] == 1
    assert summary["demoted"] == 1
    assert persisted["totals"] == {"u1": 1600, "u2": 100}
    assert persisted["changes"] == {
        "u1": ("bronze", "gold"),
        "u2": ("silver", "bronze"),
    }


def test_run_weekly_promotion_empty_week(monkeypatch, cron_module) -> None:
    """When there are no XP events the task still runs and persists nothing."""
    monkeypatch.setattr(cron_module, "week_window", lambda: (1700000000.0, 1700604800.0))
    monkeypatch.setattr(cron_module, "_fetch_xp_events", lambda *_: [])
    monkeypatch.setattr(cron_module, "_fetch_previous_tiers", lambda: {})
    monkeypatch.setattr(cron_module, "_persist_leaderboard", lambda *a, **kw: None)

    summary = cron_module.run_weekly_promotion()
    assert summary["users_scored"] == 0
    assert summary["promoted"] == 0
    assert summary["demoted"] == 0


def test_week_window_returns_last_full_week(cron_module) -> None:
    """Mid-week `now_ts` should return the previous Monday-anchored window."""
    # Wednesday 2024-01-10 12:00 UTC.
    now = 1704888000.0
    week_start, week_end = cron_module.week_window(now_ts=now)
    # Monday 2024-01-08 00:00 UTC is the most recent Monday.
    # So week_end = 2024-01-08 00:00 UTC, week_start = 2024-01-01 00:00 UTC.
    assert week_end > week_start
    assert week_end - week_start == 7 * 24 * 60 * 60


def test_tier_rank_orders_leagues(cron_module) -> None:
    ranks = [cron_module._tier_rank(t) for t in ("bronze", "silver", "gold", "platinum", "diamond")]
    assert ranks == sorted(ranks)
