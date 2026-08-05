/** HTML escaping for values interpolated into template strings. */

/**
 * Escape HTML special characters so untrusted values can be placed inside
 * `innerHTML` without becoming markup.
 *
 * Every interpolation of user or database data into a template literal must go
 * through this. Previously three near-identical copies of it lived in main.ts,
 * returns.ts and shipping.ts.
 */
export function esc(val: unknown): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
