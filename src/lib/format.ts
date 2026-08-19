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

/** Coarse "how long ago" for the inventory table. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));

  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;

  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

/** `2026-09-15` → `15 Sep 2026`. Dates are stored as plain dates. */
export function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
