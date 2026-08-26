"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { simulateDaily } from "@/lib/daily";
import { DISPATCH_KIND } from "@/lib/movements";
import type { SettlementCsvRow } from "@/lib/settlements-csv";
import { poQueueBySupplier } from "@/lib/data/po";
import { rpcTranslator } from "@/lib/rpc-message";

export type DailyResult = { sku: string; ok: boolean; message: string };

export type DailyState = {
  error?: string;
  savedAt?: number;
  results?: DailyResult[];
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function revalidateAll() {
  revalidatePath("/daily");
  revalidatePath("/wallet");
  revalidatePath("/movements");
  revalidatePath("/inventory");
  revalidatePath("/catalog");
  revalidatePath("/dashboard");
  revalidatePath("/requests");
}

/**
 * Records a day of stock movement: dispatches off the shelf, and deliveries
 * and returns settling what was dispatched earlier.
 *
 * Which PO each row draws from is not decided here. `record_stock_movements`
 * walks the product's approved POs oldest first and writes one movement per
 * PO it touches; `record_settlements` walks the same queue. A dispatch row is
 * therefore sent whole, with no `request_id` — passing one would target a
 * single PO and put the allocation back in two places.
 *
 * Nothing is written until the whole paste has been simulated against the live
 * queue. That is a hard requirement rather than a nicety: a paste is a day's
 * work, and half of it landing is worse than none of it.
 *
 * Rows execute in the order they were pasted, because the simulation walks
 * them in that order and the two have to agree.
 */
export async function recordDaily(
  _previous: DailyState,
  formData: FormData,
): Promise<DailyState> {
  const supplierId = String(formData.get("supplier_id") ?? "");
  const raw = String(formData.get("rows") ?? "");
  const [t, tsim, say] = await Promise.all([
    getTranslations("errors"),
    getTranslations("sim"),
    rpcTranslator(),
  ]);

  if (!supplierId) return { error: t("pickSupplier") };

  let rows: SettlementCsvRow[];
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
    if (!ISO_DATE.test(row.occurred_on)) {
      return { error: t("rowDate", { sku: row.sku }) };
    }
  }

  const profile = await requireProfile();
  if (profile.role === "supplier") {
    return { error: t("onlySllrDaily") };
  }

  const queue = await poQueueBySupplier(supplierId);
  const simulation = simulateDaily(rows, queue);

  if (simulation.blocked > 0) {
    return {
      savedAt: Date.now(),
      results: simulation.rows.map((entry) => ({
        sku: entry.row.sku,
        ok: false,
        message: entry.problem
          ? tsim(entry.problem.key, entry.problem.params)
          : t("notRecordedFix"),
      })),
    };
  }

  const supabase = await createClient();

  const results: DailyResult[] = [];

  for (const row of rows) {
    if (row.kind === "dispatched") {
      // No request_id: the RPC walks this product's queue oldest PO first and
      // writes one movement per PO it touches.
      const { data, error } = await supabase.rpc("record_stock_movements", {
        p_rows: [
          {
            sku: row.sku,
            qty: row.qty,
            direction: "out",
            kind: DISPATCH_KIND,
            ...(row.reference ? { reference: row.reference } : {}),
          },
        ],
      });

      if (error) {
        results.push({ sku: row.sku, ok: false, message: error.message });
        continue;
      }

      const answer = data?.[0];
      results.push(
        answer
          ? { sku: row.sku, ok: answer.ok, message: say(answer.message) }
          : { sku: row.sku, ok: false, message: t("noAnswer") },
      );
      continue;
    }

    const { data, error } = await supabase.rpc("record_settlements", {
      p_rows: [row],
    });

    if (error) {
      results.push({ sku: row.sku, ok: false, message: error.message });
      continue;
    }

    const answer = data?.[0];
    results.push(
      answer
        ? { sku: row.sku, ok: answer.ok, message: say(answer.message) }
        : { sku: row.sku, ok: false, message: t("noAnswer") },
    );
  }

  revalidateAll();
  return { savedAt: Date.now(), results };
}
