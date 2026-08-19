import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ProductStock, ProductStockRow } from "@/lib/types";

/**
 * The view's columns all arrive nullable because Postgres cannot prove a view
 * column is NOT NULL. Every one of them is backed by a NOT NULL base column or
 * a `coalesce`, so this is the one place that asserts them back.
 */
function normalise(row: ProductStockRow): ProductStock {
  return {
    id: row.id as string,
    supplier_id: row.supplier_id as string,
    name: row.name as string,
    sku: row.sku as string,
    warehouse_code: row.warehouse_code as string,
    image_url: row.image_url,
    total_qty: row.total_qty ?? 0,
    is_active: row.is_active ?? true,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    reserved_qty: row.reserved_qty ?? 0,
    pending_qty: row.pending_qty ?? 0,
    free_qty: row.free_qty ?? 0,
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

  const { data, error } = await query;
  if (error) throw new Error(`Could not load the shelf: ${error.message}`);

  return (data ?? []).map(normalise);
}

export async function getProductStock(
  id: string,
): Promise<ProductStock | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("product_stock")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Could not load the product: ${error.message}`);

  return data ? normalise(data) : null;
}
