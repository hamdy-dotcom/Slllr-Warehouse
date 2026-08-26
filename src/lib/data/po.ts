import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SessionProfile } from "@/lib/auth";
import type { PoQueueLine } from "@/lib/daily";
import {
  groupPoQueues,
  type Po,
  type PoFilter,
  type PoQueue,
  type PoSettlementEntry,
  type PoStatus,
} from "@/lib/po";

/**
 * Reads over `po_settlement`.
 *
 * The view runs `security_invoker`, so a supplier querying it straight at the
 * API gets only its own rows. Verified rather than assumed: signed in as a
 * supplier it returns 32 of the 52 rows, all its own, and anonymous returns
 * none. The role filter below is a second lock, and it is what lets a Sllr
 * user see every supplier at once.
 */
function toPo(row: Record<string, unknown>): Po | null {
  if (!row.po_id || !row.po_ref || !row.po_date) return null;

  const num = (value: unknown) => Number(value ?? 0);

  return {
    po_id: String(row.po_id),
    po_ref: String(row.po_ref),
    po_date: String(row.po_date),
    supplier_id: String(row.supplier_id ?? ""),
    supplier_name: String(row.supplier_name ?? ""),
    product_id: String(row.product_id ?? ""),
    sku: String(row.sku ?? ""),
    product_name: String(row.product_name ?? ""),
    image_url: (row.image_url as string | null) ?? null,
    unit_cost: row.unit_cost === null ? null : Number(row.unit_cost),
    qty_requested: num(row.qty_requested),
    qty_approved: num(row.qty_approved),
    qty_dispatched: num(row.qty_dispatched),
    qty_outstanding: num(row.qty_outstanding),
    qty_delivered: num(row.qty_delivered),
    qty_returned: num(row.qty_returned),
    qty_settled: num(row.qty_settled),
    qty_in_progress: num(row.qty_in_progress),
    po_value: num(row.po_value),
    delivered_value: num(row.delivered_value),
    returned_value: num(row.returned_value),
    in_progress_value: num(row.in_progress_value),
    pct_dispatched: num(row.pct_dispatched),
    pct_settled: num(row.pct_settled),
    po_status: (row.po_status as PoStatus) ?? "awaiting dispatch",
  };
}

async function readPos(profile: SessionProfile): Promise<Po[]> {
  const supabase = await createClient();

  let query = supabase.from("po_settlement").select("*");
  if (profile.role === "supplier") {
    if (!profile.supplier_id) return [];
    query = query.eq("supplier_id", profile.supplier_id);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not load the POs: ${error.message}`);

  return (data ?? []).flatMap((row) => {
    const po = toPo(row as Record<string, unknown>);
    return po ? [po] : [];
  });
}

/**
 * POs grouped into one queue per product, filtered for display.
 *
 * The filter is handed to `groupPoQueues` rather than applied first, so each
 * queue is shaped while every one of its POs is still present and a hidden
 * sibling cannot change the position the survivors report.
 */
export async function listPoQueues(
  profile: SessionProfile,
  filter: PoFilter = {},
): Promise<PoQueue[]> {
  return groupPoQueues(await readPos(profile), filter);
}

/**
 * Every delivery and return, keyed to the PO it settled.
 *
 * A settlement points at the release movement it consumed, and that movement
 * carries the `request_id` of the PO it was dispatched against — so the PO a
 * settlement belongs to is `settlements → stock_movements → request_id`.
 * There is no direct column, and there does not need to be.
 */
export async function poSettlementHistory(
  profile: SessionProfile,
): Promise<Map<string, PoSettlementEntry[]>> {
  const supabase = await createClient();

  let query = supabase
    .from("settlements")
    .select(
      "id, kind, qty, value, occurred_on, reference, note, stock_movements!inner(request_id)",
    )
    .order("occurred_on", { ascending: false });

  if (profile.role === "supplier") {
    if (!profile.supplier_id) return new Map();
    query = query.eq("supplier_id", profile.supplier_id);
  }

  const { data, error } = await query.overrideTypes<
    {
      id: string;
      kind: "delivered" | "returned";
      qty: number;
      value: number | null;
      occurred_on: string;
      reference: string | null;
      note: string | null;
      stock_movements: { request_id: string | null } | null;
    }[]
  >();

  if (error) {
    throw new Error(`Could not load settlement history: ${error.message}`);
  }

  const byPo = new Map<string, PoSettlementEntry[]>();

  for (const row of data ?? []) {
    const poId = row.stock_movements?.request_id;
    if (!poId) continue;

    const list = byPo.get(poId) ?? [];
    list.push({
      id: row.id,
      po_id: poId,
      kind: row.kind,
      qty: row.qty,
      value: row.value ?? 0,
      occurred_on: row.occurred_on,
      reference: row.reference,
      note: row.note,
    });
    byPo.set(poId, list);
  }

  return byPo;
}

/**
 * The queue one supplier's day is recorded against, as the RPCs see it.
 *
 * Only POs with something left to move: one with nothing outstanding and
 * nothing in progress cannot take part in a paste.
 */
export async function poQueueBySupplier(
  supplierId: string,
): Promise<PoQueueLine[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("po_settlement")
    .select(
      "po_id, po_ref, po_date, sku, qty_outstanding, qty_in_progress, unit_cost",
    )
    .eq("supplier_id", supplierId)
    .order("po_date", { ascending: true });

  if (error) throw new Error(`Could not load the PO queue: ${error.message}`);

  return (data ?? []).flatMap((row) => {
    const outstanding = row.qty_outstanding ?? 0;
    const inProgress = row.qty_in_progress ?? 0;
    if (!row.po_id || !row.po_ref || !row.po_date || !row.sku) return [];
    if (outstanding <= 0 && inProgress <= 0) return [];

    return [
      {
        po_id: row.po_id,
        po_ref: row.po_ref,
        po_date: row.po_date,
        sku: row.sku,
        outstanding,
        in_progress: inProgress,
        unit_cost: row.unit_cost,
      },
    ];
  });
}
