import "server-only";

import type { ArrivalEdit, ArrivalRow } from "@/lib/arrivals";
import { createClient } from "@/lib/supabase/server";

/**
 * Every arrival the signed-in profile may see, newest first.
 *
 * `arrival_log` carries everything the table and the edit dialog need. The
 * supplier's shelf is deliberately not read alongside it: the shelf can never
 * hold less than what is awaiting transfer, so it never narrows the editable
 * range — see `editRange`.
 */
export async function listArrivalLog(): Promise<ArrivalRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("arrival_log")
    .select("*")
    .order("recorded_at", { ascending: false });

  if (error) throw new Error(`Could not load arrivals: ${error.message}`);

  return (data ?? []).map((row) => ({
    arrival_id: row.arrival_id as string,
    po_id: row.po_id as string,
    po_ref: row.po_ref as string,
    arrived_on: row.arrived_on as string,
    recorded_at: row.recorded_at as string,
    product_id: row.product_id as string,
    sku: row.sku as string,
    product_name: row.product_name as string,
    image_url: row.image_url,
    warehouse_code: row.warehouse_code as string,
    supplier_name: row.supplier_name as string,
    qty: row.qty ?? 0,
    unit_cost: row.unit_cost,
    value: row.value,
    reference: row.reference,
    note: row.note,
    edited_count: row.edited_count ?? 0,
    voided: row.voided ?? false,
    qty_approved: row.qty_approved ?? 0,
    qty_arrived: row.qty_arrived ?? 0,
    qty_still_awaiting: row.qty_still_awaiting ?? 0,
    qty_locked_by_dispatch: row.qty_locked_by_dispatch ?? 0,
    received_by_name: row.received_by_name,
  }));
}

/**
 * The whole edit history, oldest first within each arrival, grouped by the
 * arrival it belongs to.
 *
 * One read rather than one per expanded row: the log is small — it only grows
 * when someone corrects something — and fetching per row would put a request
 * behind every disclosure triangle.
 */
export async function arrivalEdits(): Promise<Map<string, ArrivalEdit[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("arrival_edit_log")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Could not load the edit history: ${error.message}`);
  }

  const byArrival = new Map<string, ArrivalEdit[]>();

  for (const row of data ?? []) {
    const id = row.arrival_id as string;
    const list = byArrival.get(id) ?? [];
    list.push({
      id: row.id as string,
      arrival_id: id,
      old_qty: row.old_qty ?? 0,
      new_qty: row.new_qty ?? 0,
      delta: row.delta ?? 0,
      old_arrived_on: row.old_arrived_on,
      new_arrived_on: row.new_arrived_on,
      old_reference: row.old_reference,
      new_reference: row.new_reference,
      old_note: row.old_note,
      new_note: row.new_note,
      reason: row.reason,
      created_at: row.created_at as string,
      edited_by_name: row.edited_by_name,
    });
    byArrival.set(id, list);
  }

  return byArrival;
}
