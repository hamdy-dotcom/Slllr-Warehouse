/** Thousands-separated integer, the only number format the UI uses. */
export function n(value: number): string {
  return value.toLocaleString("en-US");
}

/** Percentage of a total, guarded against an empty shelf. */
export function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

/** Share of a total as a CSS width, clamped to the 0–100 band. */
export function widthPct(value: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.min(100, Math.max(0, (value / total) * 100))}%`;
}
