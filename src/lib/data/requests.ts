import "server-only";

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
