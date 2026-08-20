"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { requireSupplier } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rpcTranslator } from "@/lib/rpc-message";
import {
  isDirection,
  isMovementKind,
  kindFits,
  type Direction,
  type MovementKind,
} from "@/lib/movements";

export type MovementRow = {
  sku: string;
  qty: number;
  direction: Direction;
  kind: MovementKind;
  reference?: string;
  note?: string;
  request_id?: string;
};

export type MovementResult = { sku: string; ok: boolean; message: string };

export type MovementState = {
  error?: string;
  savedAt?: number;
  results?: MovementResult[];
};

function revalidateAll() {
  revalidatePath("/movements");
  revalidatePath("/inventory");
  revalidatePath("/catalog");
  revalidatePath("/dashboard");
  revalidatePath("/requests");
  revalidatePath("/approvals");
}

/**
 * Checks the things the RPC would otherwise answer with a raw Postgres error.
 * A missing direction hits a NOT NULL constraint rather than a per-row
 * message, so it never reaches the database from here.
 *
 * `kindFits` also keeps a dispatch out: it is allocated against approved
 * requests on the daily screen, never recorded loose from here.
 */
function validate(
  row: MovementRow,
  t: Awaited<ReturnType<typeof getTranslations>>,
  direction: (value: Direction) => string,
): string | null {
  if (!row.sku) return t("everyRowNeedsSku");
  if (!Number.isInteger(row.qty) || row.qty < 1) {
    return t("rowQty", { sku: row.sku });
  }
  if (!isDirection(row.direction)) {
    return t("rowDirection", { sku: row.sku });
  }
  if (!isMovementKind(row.kind) || !kindFits(row.direction, row.kind)) {
    return t("rowKindDirection", {
      sku: row.sku,
      direction: direction(row.direction),
    });
  }
  return null;
}

/**
 * Records one or many movements through `record_stock_movements`, which
 * answers per row rather than failing the batch and enforces the rule that
 * outbound stock cannot take a product below what is reserved for Sllr.
 */
export async function recordMovements(
  _previous: MovementState,
  formData: FormData,
): Promise<MovementState> {
  const raw = String(formData.get("rows") ?? "");
  const [t, tm, say] = await Promise.all([
    getTranslations("errors"),
    getTranslations("movements"),
    rpcTranslator(),
  ]);
  const directionWord = (value: Direction) => tm(`direction_${value}`);

  let rows: MovementRow[];
  try {
    rows = JSON.parse(raw);
  } catch {
    return { error: t("cannotRead") };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: t("nothingToRecord") };
  }

  for (const row of rows) {
    const problem = validate(row, t, directionWord);
    if (problem) return { error: problem };
  }

  await requireSupplier();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("record_stock_movements", {
    p_rows: rows,
  });

  if (error) return { error: error.message };

  revalidateAll();
  return {
    savedAt: Date.now(),
    results: (data ?? []).map((row) => ({ ...row, message: say(row.message) })),
  };
}
