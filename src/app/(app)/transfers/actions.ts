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

export type ArrivalResult = { po_ref: string | null; ok: boolean; message: string };

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
