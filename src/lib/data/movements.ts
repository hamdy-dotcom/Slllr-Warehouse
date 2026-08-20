import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Direction, MovementKind } from "@/lib/movements";
import type { Product } from "@/lib/types";

export type Movement = {
  id: string;
  product_id: string;
  delta: number;
  qty_after: number;
  direction: Direction;
  kind: MovementKind;
  reference: string | null;
  request_id: string | null;
  note: string | null;
  created_at: string;
  product: Pick<
    Product,
    "id" | "name" | "sku" | "warehouse_code" | "image_url"
  >;
};

export type MovementFilters = {
  direction?: Direction;
  kind?: MovementKind;
  /** Inclusive `YYYY-MM-DD` bounds. */
  from?: string;
  to?: string;
  /** Free text over product name, SKU, warehouse code, and reference. */
  q?: string;
};

/** How many rows the ledger will render before asking for a narrower filter. */
export const LEDGER_LIMIT = 300;

type Row = Omit<Movement, "product"> & {
  products: Movement["product"] | null;
};

/**
 * The ledger. RLS scopes `stock_movements` to the caller's own products, so a
 * supplier only ever sees its own shelf move.
 */
export async function listMovements(
  filters: MovementFilters = {},
): Promise<Movement[]> {
  const supabase = await createClient();

  let query = supabase
    .from("stock_movements")
    .select(
      "id, product_id, delta, qty_after, direction, kind, reference, request_id, note, created_at, products(id, name, sku, warehouse_code, image_url)",
    )
    .order("created_at", { ascending: false })
    .limit(LEDGER_LIMIT);

  if (filters.direction) query = query.eq("direction", filters.direction);
  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.from)
    query = query.gte("created_at", `${filters.from}T00:00:00Z`);
  // `to` is an inclusive date, so it has to cover the whole day.
  if (filters.to)
    query = query.lte("created_at", `${filters.to}T23:59:59.999Z`);

  const { data, error } = await query.overrideTypes<Row[]>();

  if (error) throw new Error(`Could not load movements: ${error.message}`);

  const rows = (data ?? []).flatMap((row) =>
    row.products ? [{ ...row, product: row.products }] : [],
  );

  const needle = filters.q?.trim().toLowerCase();
  if (!needle) return rows;

  return rows.filter((row) =>
    `${row.product.name} ${row.product.sku} ${row.product.warehouse_code} ${row.reference ?? ""}`
      .toLowerCase()
      .includes(needle),
  );
}

export type MovementTotals = {
  inbound: number;
  outbound: number;
  inboundCount: number;
  outboundCount: number;
  days: number;
};

/** Units in and out over a trailing window, for the supplier dashboard. */
export async function movementTotals(
  days: number,
  now: number = Date.now(),
): Promise<MovementTotals> {
  const supabase = await createClient();
  const since = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("stock_movements")
    .select("direction, delta")
    .gte("created_at", since);

  if (error) throw new Error(`Could not total movements: ${error.message}`);

  const totals: MovementTotals = {
    inbound: 0,
    outbound: 0,
    inboundCount: 0,
    outboundCount: 0,
    days,
  };

  for (const row of data ?? []) {
    // delta is signed in the table; the ledger talks in absolute units.
    const size = Math.abs(row.delta);
    if (row.direction === "in") {
      totals.inbound += size;
      totals.inboundCount += 1;
    } else {
      totals.outbound += size;
      totals.outboundCount += 1;
    }
  }

  return totals;
}

export type ApprovedRequestOption = {
  id: string;
  qty_requested: number;
  qty_approved: number;
  qty_released: number;
  /** `qty_approved - qty_released` — the only figure a release moves. */
  outstanding: number;
  unit_cost: number | null;
  created_at: string;
  note: string | null;
};

/**
 * The approved requests a release can be booked against, per product.
 *
 * A release must name one — the RPC refuses without it — and only requests
 * with something still outstanding are offered, since releasing against a
 * fully released request has nothing left to take.
 */
export async function approvedRequestsBySku(): Promise<
  Record<string, ApprovedRequestOption[]>
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reserve_requests")
    .select(
      "id, qty_requested, qty_approved, qty_released, unit_cost, created_at, note, products!inner(sku)",
    )
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .overrideTypes<
      (Omit<ApprovedRequestOption, "outstanding"> & {
        products: { sku: string };
      })[]
    >();

  if (error) {
    throw new Error(`Could not load approved requests: ${error.message}`);
  }

  const bySku: Record<string, ApprovedRequestOption[]> = {};

  for (const row of data ?? []) {
    const outstanding = (row.qty_approved ?? 0) - (row.qty_released ?? 0);
    if (outstanding <= 0) continue;

    (bySku[row.products.sku] ??= []).push({
      id: row.id,
      qty_requested: row.qty_requested,
      qty_approved: row.qty_approved ?? 0,
      qty_released: row.qty_released ?? 0,
      outstanding,
      unit_cost: row.unit_cost,
      created_at: row.created_at,
      note: row.note,
    });
  }

  return bySku;
}
