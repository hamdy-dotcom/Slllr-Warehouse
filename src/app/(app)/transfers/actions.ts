"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rpcTranslator } from "@/lib/rpc-message";

export type ArrivalRow = {
  po_id: string;
  qty: number;
  arrived_on: string;
  reference?: string;
  note?: string;
};

export type ArrivalResult = {
  po_ref: string | null;
  ok: boolean;
  message: string;
};

export type ArrivalState = {
  error?: string;
  savedAt?: number;
  results?: ArrivalResult[];
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function revalidateAll() {
  revalidatePath("/transfers");
  revalidatePath("/warehouse-stock");
  revalidatePath("/inventory");
  revalidatePath("/catalog");
  revalidatePath("/dashboard");
  revalidatePath("/requests");
  revalidatePath("/wallet");
  revalidatePath("/daily");
  revalidatePath("/movements");
}

/**
 * Records units arriving at the Riyadh warehouse.
 *
 * This is the moment stock leaves the supplier: `record_arrivals` takes the
 * quantity off `products.total_qty` and writes a `transfer_riyadh` movement,
 * so nothing here should try to move stock itself. It reports per row and
 * caps each at what is still awaiting transfer on that PO, which is why a
 * partial arrival is just a smaller quantity rather than a different call.
 */
export async function recordArrivals(
  _previous: ArrivalState,
  formData: FormData,
): Promise<ArrivalState> {
  const raw = String(formData.get("rows") ?? "");
  const [t, say] = await Promise.all([
    getTranslations("errors"),
    rpcTranslator(),
  ]);

  let rows: ArrivalRow[];
  try {
    rows = JSON.parse(raw);
  } catch {
    return { error: t("cannotRead") };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: t("nothingToRecord") };
  }

  for (const row of rows) {
    if (!row.po_id) return { error: t("pickPo") };
    if (!Number.isInteger(row.qty) || row.qty < 1) {
      return { error: t("qtyAtLeastOnePo", { ref: row.po_id.slice(0, 8) }) };
    }
    if (!ISO_DATE.test(row.arrived_on)) {
      return { error: t("rowDatePo", { ref: row.po_id.slice(0, 8) }) };
    }
  }

  const profile = await requireProfile();
  if (profile.role !== "warehouse" && profile.role !== "admin") {
    return { error: t("onlyWarehouseArrivals") };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_arrivals", {
    p_rows: rows,
  });

  if (error) return { error: error.message };

  revalidateAll();

  return {
    savedAt: Date.now(),
    results: (data ?? []).map((row) => ({ ...row, message: say(row.message) })),
  };
}

export type AmendState = {
  error?: string;
  savedAt?: number;
  voided?: boolean;
};

/**
 * Corrects one recorded arrival, or voids it by setting the quantity to zero.
 *
 * `amend_arrival` owns the whole correction: it moves `qty_arrived`, puts the
 * difference back on or takes it off the supplier's shelf, and writes a
 * balancing `transfer_riyadh` movement rather than editing the original one —
 * the ledger gains a row, it never loses one. Voiding is a state change, so
 * the arrival and its history survive it.
 *
 * The three limits the RPC enforces are mirrored into the dialog so they are
 * explained before submitting; they are still checked here, because a dialog
 * is a convenience and the RPC is the rule.
 */
export async function amendArrival(
  _previous: AmendState,
  formData: FormData,
): Promise<AmendState> {
  const [t, say] = await Promise.all([
    getTranslations("errors"),
    rpcTranslator(),
  ]);

  const arrivalId = String(formData.get("arrival_id") ?? "");
  const rawQty = String(formData.get("qty") ?? "").trim();
  const arrivedOn = String(formData.get("arrived_on") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!arrivalId) return { error: t("cannotRead") };

  const qty = Number(rawQty);
  if (rawQty === "" || !Number.isInteger(qty) || qty < 0) {
    return { error: t("qtyWholeNumber") };
  }
  if (!ISO_DATE.test(arrivedOn)) return { error: t("dateNeeded") };
  if (reason === "") return { error: t("reasonNeeded") };

  const profile = await requireProfile();
  if (profile.role !== "warehouse" && profile.role !== "admin") {
    return { error: t("onlyWarehouseArrivals") };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("amend_arrival", {
    p_arrival_id: arrivalId,
    p_qty: qty,
    p_arrived_on: arrivedOn,
    // The RPC coalesces a null argument to the value already stored, so a
    // field the operator cleared has to travel as an empty string or the old
    // text silently survives the edit.
    p_reference: reference,
    p_note: note,
    p_reason: reason,
  });

  if (error) return { error: say(error.message) };

  revalidateAll();

  return { savedAt: Date.now(), voided: qty === 0 };
}
