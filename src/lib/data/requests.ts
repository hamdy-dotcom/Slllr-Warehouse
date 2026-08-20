import "server-only";

import { rollValue, type ValueRoll } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { ProductStock, ReserveRequest } from "@/lib/types";
import { normaliseStock } from "@/lib/data/products";

/** A request with the live stock position of the product it sits against. */
export type RequestWithStock = ReserveRequest & { product: ProductStock };

/**
 * Requests carry two foreign keys to the same product id — one to `products`
 * and one to `product_stock` — so PostgREST cannot embed the view without a
 * hint. Fetching the stock separately and stitching is clearer than the hint
 * syntax, and it is one extra round trip either way.
 */
async function withStock(rows: ReserveRequest[]): Promise<RequestWithStock[]> {
  if (rows.length === 0) return [];

  const supabase = await createClient();
  const ids = [...new Set(rows.map((row) => row.product_id))];

  const { data, error } = await supabase
    .from("product_stock")
    .select("*")
    .in("id", ids);

  if (error) throw new Error(`Could not load the shelf: ${error.message}`);

  const byId = new Map(
    (data ?? []).map((row) => {
      const stock = normaliseStock(row);
      return [stock.id, stock] as const;
    }),
  );

  // A request whose product vanished has nothing to show; drop it.
  return rows.flatMap((row) => {
    const product = byId.get(row.product_id);
    return product ? [{ ...row, product }] : [];
  });
}

/** The signed-in Sllr user's own requests, newest first. */
export async function listMyRequests(): Promise<RequestWithStock[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("reserve_requests")
    .select("*")
    .eq("requested_by", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load your requests: ${error.message}`);

  return withStock(data ?? []);
}

/**
 * Pending requests waiting on the signed-in supplier. RLS already limits this
 * to requests against that supplier's own products.
 */
export async function listPendingApprovals(): Promise<RequestWithStock[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reserve_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Could not load approvals: ${error.message}`);

  return withStock(data ?? []);
}

/** How many units the supplier could still grant against a product. */
export function availableToGrant(product: ProductStock): number {
  return product.total_qty - product.reserved_qty;
}

/**
 * The units a request would be short by. Mirrors `approve_reserve_request`,
 * which caps a grant at `total_qty - sum(approved)` — pending requests do not
 * hold stock back from each other.
 */
export function shortfall(request: RequestWithStock): number {
  return request.qty_requested - availableToGrant(request.product);
}

export type RequestCounts = {
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  consumed: number;
  total: number;
};

/**
 * Request tallies for the dashboard. RLS scopes this the way each role needs
 * it: a Sllr user counts their own, a supplier counts what sits against its
 * own products.
 */
export async function requestCounts(): Promise<RequestCounts> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reserve_requests")
    .select("status");

  if (error) throw new Error(`Could not count requests: ${error.message}`);

  const counts: RequestCounts = {
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
    consumed: 0,
    total: 0,
  };

  for (const row of data ?? []) {
    counts[row.status] += 1;
    counts.total += 1;
  }

  return counts;
}

export type RequestValues = {
  /** Approved requests: what Sllr actually holds, at the cost agreed. */
  held: ValueRoll;
  /** Pending requests: what Sllr has asked for, at the cost quoted. */
  asked: ValueRoll;
};

/**
 * Value rolled from the snapshots on the requests themselves, not from
 * today's product cost.
 *
 * This is the difference the snapshot was chosen for: re-pricing a product
 * changes what the shelf is worth, but it must not change what an already
 * agreed reservation was worth. RLS scopes the rows per role, the same way
 * `requestCounts` does.
 */
export async function requestValues(): Promise<RequestValues> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reserve_requests")
    .select("status, qty_requested, qty_approved, qty_released, unit_cost")
    .in("status", ["approved", "pending"]);

  if (error) throw new Error(`Could not value requests: ${error.message}`);

  const rows = data ?? [];

  return {
    // Outstanding, not approved: units already released have left the shelf
    // and are being settled through the wallet, so they are no longer held.
    held: rollValue(
      rows.filter((row) => row.status === "approved"),
      (row) => (row.qty_approved ?? 0) - (row.qty_released ?? 0),
      (row) => row.unit_cost,
    ),
    asked: rollValue(
      rows.filter((row) => row.status === "pending"),
      (row) => row.qty_requested,
      (row) => row.unit_cost,
    ),
  };
}
