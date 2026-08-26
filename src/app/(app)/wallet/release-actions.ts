"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rpcTranslator } from "@/lib/rpc-message";

export type ReleaseRow = { sku: string; qty: number; note?: string };

export type ReleaseResult = { sku: string; ok: boolean; message: string };

export type ReleaseState = {
  error?: string;
  savedAt?: number;
  results?: ReleaseResult[];
};

/**
 * Hands approved-but-undispatched quantity back to the supplier.
 *
 * Which POs give it up is the RPC's decision: it walks the product's queue
 * **newest PO first**, the opposite end from a dispatch, so the commitment
 * that has been waiting longest is the last one given up. `qty_approved`
 * never shrinks — the units land on `qty_cancelled` instead, and the audit
 * trail keeps saying what was originally granted.
 */
export async function releaseReserved(
  _previous: ReleaseState,
  formData: FormData,
): Promise<ReleaseState> {
  const raw = String(formData.get("rows") ?? "");
  const [t, say] = await Promise.all([
    getTranslations("errors"),
    rpcTranslator(),
  ]);

  let rows: ReleaseRow[];
  try {
    rows = JSON.parse(raw);
  } catch {
    return { error: t("cannotRead") };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: t("nothingToRecord") };
  }

  for (const row of rows) {
    if (!row.sku) return { error: t("everyRowNeedsSku") };
    if (!Number.isInteger(row.qty) || row.qty < 1) {
      return { error: t("rowQty", { sku: row.sku }) };
    }
  }

  const profile = await requireProfile();
  if (profile.role === "supplier") {
    return { error: t("onlySllrRelease") };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("release_reserved_qty", {
    p_rows: rows,
  });

  if (error) return { error: error.message };

  revalidatePath("/wallet");
  revalidatePath("/daily");
  revalidatePath("/requests");
  revalidatePath("/approvals");
  revalidatePath("/inventory");
  revalidatePath("/catalog");
  revalidatePath("/dashboard");

  return {
    savedAt: Date.now(),
    results: (data ?? []).map((row) => ({ ...row, message: say(row.message) })),
  };
}
