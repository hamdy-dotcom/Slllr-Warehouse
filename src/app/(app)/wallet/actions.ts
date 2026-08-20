"use server";

import { revalidatePath } from "next/cache";

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { SettlementKind } from "@/lib/settlements-csv";

export type SettlementRow = {
  sku: string;
  kind: SettlementKind;
  qty: number;
  occurred_on: string;
  reference?: string;
  note?: string;
};

export type RowResult = { sku: string; ok: boolean; message: string };

export type SettleState = {
  error?: string;
  savedAt?: number;
  results?: RowResult[];
};

function revalidateAll() {
  revalidatePath("/wallet");
  revalidatePath("/movements");
  revalidatePath("/inventory");
  revalidatePath("/catalog");
  revalidatePath("/dashboard");
  revalidatePath("/requests");
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Records deliveries and returns against dispatched stock.
 *
 * Every row is checked against `in_progress_qty` before the RPC is called.
 * That is not belt and braces: `record_settlements` allocates FIFO and
 * commits it before deciding a row asked for too much, so a row it reports as
 * refused has already settled everything that was in progress. Until that is
 * fixed in the function, the only safe over-delivery is one that never
 * reaches it.
 */
export async function recordSettlements(
  _previous: SettleState,
  formData: FormData,
): Promise<SettleState> {
  const raw = String(formData.get("rows") ?? "");

  let rows: SettlementRow[];
  try {
    rows = JSON.parse(raw);
  } catch {
    return { error: "Could not read those rows. Try again." };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "There is nothing to record yet." };
  }

  const profile = await requireProfile();
  if (profile.role === "supplier") {
    return { error: "Only a Sllr account can record deliveries and returns." };
  }

  for (const row of rows) {
    if (!row.sku) return { error: "Every row needs a SKU." };
    if (!Number.isInteger(row.qty) || row.qty < 1) {
      return { error: `${row.sku}: enter a quantity of at least 1.` };
    }
    if (row.kind !== "delivered" && row.kind !== "returned") {
      return { error: `${row.sku}: pick delivered or returned.` };
    }
    if (!ISO_DATE.test(row.occurred_on)) {
      return { error: `${row.sku}: give the date as YYYY-MM-DD.` };
    }
  }

  const supabase = await createClient();

  const { data: stock, error: stockError } = await supabase
    .from("product_stock")
    .select("sku, in_progress_qty")
    .in(
      "sku",
      rows.map((row) => row.sku),
    );

  if (stockError) {
    return { error: `Could not check what is in progress: ${stockError.message}` };
  }

  const inProgress = new Map(
    (stock ?? []).map((row) => [row.sku ?? "", row.in_progress_qty ?? 0]),
  );

  // Both kinds draw from the same pool of dispatched-but-unsettled units.
  const wanted = new Map<string, number>();
  for (const row of rows) {
    wanted.set(row.sku, (wanted.get(row.sku) ?? 0) + row.qty);
  }

  const tooMuch: RowResult[] = [];
  for (const [sku, qty] of wanted) {
    if (!inProgress.has(sku)) {
      tooMuch.push({ sku, ok: false, message: "SKU not found" });
      continue;
    }
    const available = inProgress.get(sku) ?? 0;
    if (qty > available) {
      tooMuch.push({
        sku,
        ok: false,
        message:
          available === 0
            ? "Nothing is in progress for this SKU"
            : `Only ${available.toLocaleString("en-US")} units are in progress, not ${qty.toLocaleString("en-US")}`,
      });
    }
  }

  if (tooMuch.length > 0) {
    return {
      savedAt: Date.now(),
      results: [
        ...tooMuch,
        ...rows
          .filter((row) => !tooMuch.some((bad) => bad.sku === row.sku))
          .map((row) => ({
            sku: row.sku,
            ok: false,
            message: "Not recorded — fix the rows above and send again",
          })),
      ],
    };
  }

  const { data, error } = await supabase.rpc("record_settlements", {
    p_rows: rows,
  });

  if (error) return { error: error.message };

  revalidateAll();
  return { savedAt: Date.now(), results: data ?? [] };
}

export type PaymentState = { error?: string; savedAt?: number };

export async function recordPayment(
  _previous: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  const supplierId = String(formData.get("supplier_id") ?? "");
  const rawAmount = String(formData.get("amount") ?? "").trim();
  const paidOn = String(formData.get("paid_on") ?? "").trim();
  const method = String(formData.get("method") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!supplierId) return { error: "Pick a supplier first." };

  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter an amount greater than 0." };
  }

  if (!ISO_DATE.test(paidOn)) {
    return { error: "Give the payment date as YYYY-MM-DD." };
  }

  const profile = await requireProfile();
  if (profile.role === "supplier") {
    return { error: "Only a Sllr account can record a payment." };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("record_supplier_payment", {
    p_supplier_id: supplierId,
    p_amount: Math.round(amount * 100) / 100,
    p_paid_on: paidOn,
    p_method: method || undefined,
    p_reference: reference || undefined,
    p_note: note || undefined,
  });

  if (error) return { error: error.message };

  revalidateAll();
  return { savedAt: Date.now() };
}
