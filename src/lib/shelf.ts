/**
 * Pure shelf vocabulary — no database access, so both the server pages and the
 * client toolbar can import it.
 */
import type { ProductStock } from "@/lib/types";

export type ShelfFilter = "all" | "low" | "reserved";

export const FILTER_LABELS: Record<ShelfFilter, string> = {
  all: "All",
  low: "Low free stock",
  reserved: "Has reservation",
};

export function isShelfFilter(value: string | undefined): value is ShelfFilter {
  return value === "all" || value === "low" || value === "reserved";
}

/** Free stock at or below a quarter of the shelf counts as running low. */
export function isLow(row: ProductStock): boolean {
  if (row.total_qty <= 0) return true;
  return row.free_qty / row.total_qty <= 0.25;
}

/** Search and filter, applied after the query so one read serves both. */
export function applyShelfFilter(
  rows: ProductStock[],
  { q = "", filter = "all" }: { q?: string; filter?: ShelfFilter },
): ProductStock[] {
  const needle = q.trim().toLowerCase();

  return rows.filter((row) => {
    if (
      needle &&
      !`${row.name} ${row.sku} ${row.warehouse_code}`
        .toLowerCase()
        .includes(needle)
    ) {
      return false;
    }

    if (filter === "low") return isLow(row);
    if (filter === "reserved") return row.reserved_qty > 0;
    return true;
  });
}

export type ShelfTotals = {
  total: number;
  reserved: number;
  pending: number;
  free: number;
  skus: number;
};

/** Shelf-wide roll-up. Free is allowed to go negative — that is oversold. */
export function shelfTotals(rows: ProductStock[]): ShelfTotals {
  return rows.reduce<ShelfTotals>(
    (acc, row) => ({
      total: acc.total + row.total_qty,
      reserved: acc.reserved + row.reserved_qty,
      pending: acc.pending + row.pending_qty,
      free: acc.free + row.free_qty,
      skus: acc.skus + 1,
    }),
    { total: 0, reserved: 0, pending: 0, free: 0, skus: 0 },
  );
}
