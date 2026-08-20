"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { allocateDispatch, simulateDaily } from "@/lib/daily";
import { DISPATCH_KIND } from "@/lib/movements";
import type { SettlementCsvRow } from "@/lib/settlements-csv";
import { inProgressBySupplier, outstandingBySupplier } from "@/lib/data/wallet";
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
 * Nothing is written until the whole paste has been simulated against the live
 * pools. That is a hard requirement rather than a nicety, for two reasons.
 * `record_settlements` allocates FIFO and commits before deciding a row asked
 * for too much, so an over-delivery that reaches it settles everything in
 * progress and still reports failure. And a paste is a day's work — half of it
 * landing is worse than none of it.
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
  const [t, tsim, tr, say] = await Promise.all([
    getTranslations("errors"),
    getTranslations("sim"),
    getTranslations("rpc"),
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

  const [outstanding, inProgress] = await Promise.all([
    outstandingBySupplier(supplierId),
    inProgressBySupplier(supplierId),
  ]);

  const simulation = simulateDaily(
    rows,
    outstanding.map((line) => ({
      sku: line.sku,
      qty: line.outstanding_qty,
      value: line.outstanding_value,
    })),
    inProgress.map((line) => ({
      sku: line.sku,
      qty: line.in_progress_qty,
      value: line.in_progress_value,
    })),
  );

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

  // Approved requests a dispatch can be booked against, drawn down as the
  // paste allocates so two dispatch rows for one SKU cannot both take the
  // same units.
  const requestsBySku = new Map(
    outstanding.map((line) => [
      line.sku,
      line.requests.map((request) => ({ ...request })),
    ]),
  );

  const results: DailyResult[] = [];

  for (const row of rows) {
    if (row.kind === "dispatched") {
      const available = requestsBySku.get(row.sku) ?? [];
      const slices = allocateDispatch(row.qty, available);

      if (slices.length === 0) {
        results.push({
          sku: row.sku,
          ok: false,
          message: t("noApprovedLeft"),
        });
        continue;
      }

      const { data, error } = await supabase.rpc("record_stock_movements", {
        p_rows: slices.map((slice) => ({
          sku: row.sku,
          qty: slice.qty,
          direction: "out",
          kind: DISPATCH_KIND,
          request_id: slice.id,
          ...(row.reference ? { reference: row.reference } : {}),
        })),
      });

      if (error) {
        results.push({ sku: row.sku, ok: false, message: error.message });
        continue;
      }

      const answers = data ?? [];
      const failed = answers.filter((answer) => !answer.ok);

      if (failed.length > 0) {
        results.push({
          sku: row.sku,
          ok: false,
          message: say(failed[0].message),
        });
        continue;
      }

      // Only spend the allocation once the RPC has accepted it.
      for (const slice of slices) {
        const request = available.find((entry) => entry.id === slice.id);
        if (request) request.outstanding -= slice.qty;
      }

      results.push({
        sku: row.sku,
        ok: true,
        message:
          slices.length > 1
            ? tr("dispatchedAcross", {
                count: row.qty.toLocaleString("en-US"),
                requests: slices.length,
              })
            : tr("dispatchedUnits", {
                count: row.qty.toLocaleString("en-US"),
              }),
      });
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
