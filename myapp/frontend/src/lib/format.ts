/** Money and date formatting shared across pages. */

/**
 * Format a number as a dollar string.
 *
 * `fallback` differs by page for historical reasons the UI depends on: the
 * inventory table shows an em dash for a missing cost, while the returns stats
 * cards show `$0.00`. Passing it explicitly keeps that difference visible
 * instead of hidden in two divergent copies of the function.
 */
export function fmtMoney(n: number | null | undefined, fallback = "—"): string {
  if (n == null || isNaN(Number(n))) return fallback;
  return `$${Number(n).toFixed(2)}`;
}

/**
 * Parse the app's `MM/DD/YY` (or `MM/DD/YYYY`) inventory dates to a timestamp.
 * Returns 0 for anything unparseable so sorts push it to the end.
 */
export function parseDate(s: string): number {
  if (!s) return 0;

  const parts = s.split("/");
  if (parts.length === 3) {
    const [m, d, y] = parts.map(Number);
    const year = y < 100 ? 2000 + y : y;
    const ts = new Date(year, m - 1, d).getTime();
    if (!isNaN(ts)) return ts;
  }

  const fallback = new Date(s).getTime();
  return isNaN(fallback) ? 0 : fallback;
}

/**
 * Format a SQLite timestamp (`2026-05-18 10:23:45`, always UTC) as a readable
 * local label like `May 18, 2026 10:23 AM`.
 */
export function fmtTimestamp(ts: string): string {
  if (!ts) return "";

  const d = new Date(ts.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return "";

  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Today as `YYYY-MM-DD`, for prefilling `<input type="date">`. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Whole days elapsed since a date string, or null if empty or invalid. */
export function daysSince(dateStr: string): number | null {
  if (!dateStr) return null;

  const ts = new Date(dateStr).getTime();
  if (isNaN(ts)) return null;

  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}

/** Add days to a `YYYY-MM-DD` string, returning the same format. */
export function addDays(dateStr: string, days: number): string {
  if (!dateStr) return "";

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";

  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
