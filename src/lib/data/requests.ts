import "server-only";

import { rollValue, type ValueRoll } from "@/lib/money";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import type { ProductStock, RequestDispatch } from "@/lib/types";
import { normaliseStock } from "@/lib/data/products";

/** A request with the live stock position of the product it sits against. */
export type RequestWithStock = RequestDispatch & { product: ProductStock };

/** The view's columns are all nullable; this is the one place that settles them. */
type DispatchRow =
  Database["public"]["Views"]["reserve_request_dispatch"]["Row"];

function normaliseRequest(row: DispatchRow): RequestDispatch {
  return {
    id: row.id as string,
    product_id: row.product_id as string,
    requested_by: row.requested_by as string,
    qty_requested: row.qty_requested ?? 0,
    qty_approved: row.qty_approved,
    qty_outstanding: row.qty_outstanding,
    outstanding_value: row.outstanding_value,
    qty_awaiting_transfer: null,
    qty_in_warehouse: null,
    qty_out_for_delivery: null,
    qty_delivered: null,
    qty_cancelled: null,
    status: row.status as RequestDispatch["status"],
    hold_until: row.hold_until,
    note: row.note,
    unit_cost: row.unit_cost,
    decided_at: row.decided_at,
    decision_note: row.decision_note,
    created_at: row.created_at as string,
  };
}

/**
 * Requests carry two foreign keys to the same product id — one to `products`
 * and one to `product_stock` — so PostgREST cannot embed the view without a
 * hint. Fetching the stock separately and stitching is clearer than the hint
 * syntax, and it is one extra round trip either way.
 */
async function withStock(rows: RequestDispatch[]): Promise<RequestWithStock[]> {
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
    .from("reserve_request_dispatch")
    .select("*")
    .eq("requested_by", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load your requests: ${error.message}`);

  return withStock(await withLivePool((data ?? []).map(normaliseRequest)));
}

/**
 * Stitches each request's live position onto it from `po_settlement`.
 *
 * A request that the supplier approved is a PO, keyed by the same id, so the
 * pool figures come straight across. One that is still pending or was
 * rejected has no PO and keeps nulls — there is nothing with customers to
 * report for it.
 *
 * Outstanding comes across too. `reserve_request_dispatch` subtracts
 * `qty_cancelled` itself now and the two agree on every row, so this is no
 * longer a correction — it is so that all five parts of a row come from one
 * view and cannot disagree with each other mid-write.
 */
async function withLivePool(rows: RequestDispatch[]): Promise<RequestDispatch[]> {
  if (rows.length === 0) return rows;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("po_settlement")
    .select(
      "po_id, qty_awaiting_transfer, qty_in_warehouse, qty_out_for_delivery, qty_delivered, qty_cancelled, awaiting_transfer_value",
    )
    .in(
      "po_id",
      rows.map((row) => row.id),
    );

  if (error) {
    throw new Error(`Could not load your requests: ${error.message}`);
  }

  const byId = new Map((data ?? []).map((row) => [row.po_id, row]));

  return rows.map((row) => {
    const live = byId.get(row.id);
    if (!live) return row;

    return {
      ...row,
      qty_awaiting_transfer: live.qty_awaiting_transfer ?? 0,
      qty_in_warehouse: live.qty_in_warehouse ?? 0,
      qty_out_for_delivery: live.qty_out_for_delivery ?? 0,
      qty_delivered: live.qty_delivered ?? 0,
      qty_cancelled: live.qty_cancelled ?? 0,
      qty_outstanding: live.qty_awaiting_transfer ?? 0,
      outstanding_value: live.awaiting_transfer_value,
    };
  });
}

/**
 * Pending requests waiting on the signed-in supplier. RLS already limits this
 * to requests against that supplier's own products.
 */
export async function listPendingApprovals(): Promise<RequestWithStock[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reserve_request_dispatch")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Could not load approvals: ${error.message}`);

  return withStock((data ?? []).map(normaliseRequest));
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

/**
 * An approved quantity now sits in one of several places, and the dashboard
 * asks about three of them separately. They are rolled from one read so the
 * three always describe the same instant.
 */
export type RequestValues = {
  /** Approved, still standing on the supplier's shelf. */
  held: ValueRoll;
  /** Arrived in the Riyadh warehouse, ready to dispatch. */
  riyadh: ValueRoll;
  /** In Riyadh or out with a customer — what Sllr holds. */
  custody: ValueRoll;
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

  // Held reads from po_settlement, the canonical view of a PO. Asked is
  // pending requests, which have no PO yet.
  const [held, asked] = await Promise.all([
    supabase
      .from("po_settlement")
      // Two different questions off one read. Held is what the supplier
      // still owes the transfer — approved, not yet moved. Custody is what
      // Sllr actually has: arrived in Riyadh and not yet delivered.
      .select(
        "qty_awaiting_transfer, qty_in_warehouse, qty_out_for_delivery, unit_cost",
      )
      .eq("request_status", "approved"),
    supabase
      .from("reserve_request_dispatch")
      .select("qty_requested, unit_cost")
      .eq("status", "pending"),
  ]);

  if (held.error) {
    throw new Error(`Could not value requests: ${held.error.message}`);
  }
  if (asked.error) {
    throw new Error(`Could not value requests: ${asked.error.message}`);
  }

  return {
    // Awaiting transfer: approved but still standing on the supplier's shelf.
    held: rollValue(
      held.data ?? [],
      (row) => row.qty_awaiting_transfer ?? 0,
      (row) => row.unit_cost,
    ),
    // Sitting in the Riyadh warehouse, ready to dispatch.
    riyadh: rollValue(
      held.data ?? [],
      (row) => row.qty_in_warehouse ?? 0,
      (row) => row.unit_cost,
    ),
    // In Sllr's hands: in the Riyadh warehouse or already out with a
    // customer. Delivered units have been settled and are no longer custody.
    custody: rollValue(
      held.data ?? [],
      (row) => (row.qty_in_warehouse ?? 0) + (row.qty_out_for_delivery ?? 0),
      (row) => row.unit_cost,
    ),
    asked: rollValue(
      asked.data ?? [],
      (row) => row.qty_requested ?? 0,
      (row) => row.unit_cost,
    ),
  };
}
