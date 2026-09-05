import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  matchesTransferFilter,
  type TransferFilter,
  type TransferLine,
  type TransferStatus,
} from "@/lib/transfers";

/**
 * The transfer queue, oldest approval first.
 *
 * That order is the work order: the PO a supplier committed to longest ago is
 * the one the warehouse should be chasing. `transfer_queue` only carries POs
 * with units still to move, so an emptied one drops out on its own.
 */
export async function listTransferQueue(
  filter: TransferFilter = {},
): Promise<TransferLine[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transfer_queue")
    .select("*")
    .order("approved_at", { ascending: true });

  if (error) {
    throw new Error(`Could not load the transfer queue: ${error.message}`);
  }

  const lines = (data ?? []).flatMap((row) => {
    if (!row.po_id || !row.po_ref || !row.approved_at) return [];

    const num = (value: unknown) => Number(value ?? 0);

    return [
      {
        po_id: row.po_id,
        po_ref: row.po_ref,
        po_date: String(row.po_date ?? row.approved_at),
        approved_at: row.approved_at,
        product_id: String(row.product_id ?? ""),
        sku: String(row.sku ?? ""),
        product_name: String(row.product_name ?? ""),
        image_url: row.image_url,
        warehouse_code: String(row.warehouse_code ?? ""),
        supplier_id: String(row.supplier_id ?? ""),
        supplier_name: String(row.supplier_name ?? ""),
        unit_cost: row.unit_cost,
        qty_approved: num(row.qty_approved),
        qty_arrived: num(row.qty_arrived),
        qty_cancelled: num(row.qty_cancelled),
        qty_awaiting_transfer: num(row.qty_awaiting_transfer),
        awaiting_transfer_value: num(row.awaiting_transfer_value),
        transfer_status: (row.transfer_status ??
          "not started") as TransferStatus,
      },
    ];
  });

  return lines.filter((line) => matchesTransferFilter(line, filter));
}

export type WarehouseLine = {
  product_id: string;
  sku: string;
  name: string;
  image_url: string | null;
  qty: number;
  value: number;
};

export type WarehouseStock = {
  inStock: WarehouseLine[];
  outForDelivery: WarehouseLine[];
  upcoming: WarehouseLine[];
};

/**
 * The three places a unit can be from the warehouse's point of view.
 *
 * In stock and out for delivery come off `product_stock` for their counts and
 * off `po_settlement` for their value — a unit in the warehouse is worth what
 * was agreed when its PO was approved, not what the product is priced at
 * today. Upcoming is the transfer queue rolled up the same way: approved by a
 * supplier, not yet moved, so it is not warehouse stock yet but it is what the
 * warehouse should expect.
 */
export async function warehouseStock(): Promise<WarehouseStock> {
  const supabase = await createClient();

  const [{ data, error }, held] = await Promise.all([
    supabase
      .from("product_stock")
      .select("id, sku, name, image_url, riyadh_qty, in_progress_qty")
      .order("sku"),
    supabase
      .from("po_settlement")
      .select("product_id, in_warehouse_value, out_for_delivery_value")
      .eq("request_status", "approved"),
  ]);

  if (error) {
    throw new Error(`Could not load warehouse stock: ${error.message}`);
  }
  if (held.error) {
    throw new Error(`Could not value warehouse stock: ${held.error.message}`);
  }

  const rows = data ?? [];

  const inWarehouse = new Map<string, number>();
  const outForDelivery = new Map<string, number>();
  for (const po of held.data ?? []) {
    const id = po.product_id;
    if (!id) continue;
    inWarehouse.set(
      id,
      (inWarehouse.get(id) ?? 0) + (po.in_warehouse_value ?? 0),
    );
    outForDelivery.set(
      id,
      (outForDelivery.get(id) ?? 0) + (po.out_for_delivery_value ?? 0),
    );
  }
  const line = (
    row: (typeof rows)[number],
    qty: number | null,
    value: number | null,
  ): WarehouseLine => ({
    product_id: String(row.id ?? ""),
    sku: String(row.sku ?? ""),
    name: String(row.name ?? ""),
    image_url: row.image_url,
    qty: qty ?? 0,
    value: value ?? 0,
  });

  const queue = await listTransferQueue();
  const bySku = new Map<string, WarehouseLine>();

  for (const entry of queue) {
    if (entry.qty_awaiting_transfer <= 0) continue;
    const found = bySku.get(entry.sku) ?? {
      product_id: entry.product_id,
      sku: entry.sku,
      name: entry.product_name,
      image_url: entry.image_url,
      qty: 0,
      value: 0,
    };
    found.qty += entry.qty_awaiting_transfer;
    found.value += entry.awaiting_transfer_value;
    bySku.set(entry.sku, found);
  }

  return {
    inStock: rows
      .filter((row) => (row.riyadh_qty ?? 0) > 0)
      .map((row) =>
        line(row, row.riyadh_qty, inWarehouse.get(row.id as string) ?? 0),
      ),
    outForDelivery: rows
      .filter((row) => (row.in_progress_qty ?? 0) > 0)
      .map((row) =>
        line(
          row,
          row.in_progress_qty,
          outForDelivery.get(row.id as string) ?? 0,
        ),
      ),
    upcoming: [...bySku.values()].sort((a, b) => a.sku.localeCompare(b.sku)),
  };
}
