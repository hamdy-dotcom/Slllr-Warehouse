import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ProductStock, ProductStockRow } from "@/lib/types";

/**
 * What each PO pool is worth per product, priced at the cost agreed when the
 * PO was approved.
 *
 * `product_stock` can only value a pool at `qty * products.unit_cost`, which
 * re-prices a standing commitment every time the product's price moves.
 * `po_settlement` carries the snapshot, so the pool values come from there
 * and are merged in per product.
 */
export type PoolValues = {
  awaiting_transfer_value: number | null;
  riyadh_value: number | null;
  in_progress_value: number | null;
};

const EMPTY_POOLS: PoolValues = {
  awaiting_transfer_value: null,
  riyadh_value: null,
  in_progress_value: null,
};

/** Adds one PO's value into a running pool total, keeping null infectious:
 *  an unpriced PO makes the whole product's pool unpriced rather than
 *  quietly contributing zero. */
function add(running: number | null, value: number | null): number | null {
  if (running === null) return value;
  if (value === null) return null;
  return running + value;
}

async function poolValuesByProduct(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productIds?: string[],
): Promise<Map<string, PoolValues>> {
  let query = supabase
    .from("po_settlement")
    .select(
      "product_id, qty_awaiting_transfer, qty_in_warehouse, qty_out_for_delivery, awaiting_transfer_value, in_warehouse_value, out_for_delivery_value",
    )
    .eq("request_status", "approved");

  if (productIds) query = query.in("product_id", productIds);

  const { data, error } = await query;
  if (error) throw new Error(`Could not value the shelf: ${error.message}`);

  const pools = new Map<string, PoolValues>();

  for (const row of data ?? []) {
    const id = row.product_id;
    if (!id) continue;

    const found = pools.get(id) ?? { ...EMPTY_POOLS };

    // A pool with no units contributes nothing and must not turn an empty
    // pool into a priced zero, so only non-empty pools are folded in.
    if ((row.qty_awaiting_transfer ?? 0) !== 0) {
      found.awaiting_transfer_value = add(
        found.awaiting_transfer_value,
        row.awaiting_transfer_value,
      );
    }
    if ((row.qty_in_warehouse ?? 0) !== 0) {
      found.riyadh_value = add(found.riyadh_value, row.in_warehouse_value);
    }
    if ((row.qty_out_for_delivery ?? 0) !== 0) {
      found.in_progress_value = add(
        found.in_progress_value,
        row.out_for_delivery_value,
      );
    }

    pools.set(id, found);
  }

  return pools;
}

/**
 * The view's columns all arrive nullable because Postgres cannot prove a view
 * column is NOT NULL. Every one of them is backed by a NOT NULL base column or
 * a `coalesce`, so this is the one place that asserts them back.
 *
 * Pool values are the exception: they do not come from the view at all, but
 * from `po_settlement`, so a re-priced product does not re-price a standing
 * reservation.
 */
export function normaliseStock(
  row: ProductStockRow,
  pools: PoolValues = EMPTY_POOLS,
): ProductStock {
  return {
    id: row.id as string,
    supplier_id: row.supplier_id as string,
    name: row.name as string,
    sku: row.sku as string,
    warehouse_code: row.warehouse_code as string,
    image_url: row.image_url,
    total_qty: row.total_qty ?? 0,
    is_active: row.is_active ?? true,
    // Genuinely nullable, unlike the columns above — leave it alone.
    unit_cost: row.unit_cost,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    reserved_qty: row.reserved_qty ?? 0,
    pending_qty: row.pending_qty ?? 0,
    free_qty: row.free_qty ?? 0,
    stock_value: row.stock_value,
    awaiting_transfer_value: pools.awaiting_transfer_value,
    riyadh_qty: row.riyadh_qty ?? 0,
    riyadh_value: pools.riyadh_value,
    in_progress_qty: row.in_progress_qty ?? 0,
    in_progress_value: pools.in_progress_value,
  };
}

/**
 * Every product the signed-in profile may see. RLS does the scoping: Sllr
 * reads the whole shelf, a supplier reads only its own.
 */
export async function listProductStock({
  activeOnly = false,
}: { activeOnly?: boolean } = {}): Promise<ProductStock[]> {
  const supabase = await createClient();

  let query = supabase.from("product_stock").select("*").order("name");
  if (activeOnly) query = query.eq("is_active", true);

  // Both reads are scoped by RLS the same way, so a supplier prices only its
  // own shelf from its own POs.
  const [{ data, error }, pools] = await Promise.all([
    query,
    poolValuesByProduct(supabase),
  ]);
  if (error) throw new Error(`Could not load the shelf: ${error.message}`);

  return (data ?? []).map((row) =>
    normaliseStock(row, pools.get(row.id as string) ?? EMPTY_POOLS),
  );
}

export async function getProductStock(
  id: string,
): Promise<ProductStock | null> {
  const supabase = await createClient();

  const [{ data, error }, pools] = await Promise.all([
    supabase.from("product_stock").select("*").eq("id", id).maybeSingle(),
    poolValuesByProduct(supabase, [id]),
  ]);

  if (error) throw new Error(`Could not load the product: ${error.message}`);

  return data ? normaliseStock(data, pools.get(id) ?? EMPTY_POOLS) : null;
}
