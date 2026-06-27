/**
 * Date-key helpers for the habit layer.
 *
 * "Today" for the habit layer is the user's *local* calendar date, not
 * UTC. The BFF computes the local date from `User.timezone` (or the
 * default tz of the server for the dev fallback) and passes the
 * `YYYY-MM-DD` string down to the pure habit functions in
 * `@readmaxxing/core/habits`.
 */

export type DateKey = string; // `YYYY-MM-DD`

/**
 * Return the local date key for `Date.now()`. We use a lightweight
 * Intl.DateTimeFormat-based formatter so we don't pull in a full tz
 * library — it's enough for the "what day is it for this user?"
 * question. Default timezone is the server's locale timezone, which is
 * a stable fallback for the dev user.
 */
export function localDateKey(date: Date = new Date(), timeZone?: string): DateKey {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  return fmt.format(date); // en-CA yields "YYYY-MM-DD"
}

/** Monday of the ISO week containing `key`. */
export function mondayOf(key: DateKey): DateKey {
  const ms = Date.UTC(
    Number(key.slice(0, 4)),
    Number(key.slice(5, 7)) - 1,
    Number(key.slice(8, 10)),
  );
  const d = new Date(ms);
  const dow = d.getUTCDay();
  const back = (dow + 6) % 7;
  const monday = new Date(ms - back * 86_400_000);
  return monday.toISOString().slice(0, 10);
}
