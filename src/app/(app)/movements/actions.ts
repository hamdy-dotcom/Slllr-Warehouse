"use server";

import { revalidatePath } from "next/cache";

import { requireSupplier } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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
function validate(row: MovementRow): string | null {
  if (!row.sku) return "Every row needs a SKU.";
  if (!Number.isInteger(row.qty) || row.qty < 1) {
    return `${row.sku}: enter a quantity of at least 1.`;
  }
  if (!isDirection(row.direction)) {
    return `${row.sku}: pick inbound or outbound.`;
  }
  if (!isMovementKind(row.kind) || !kindFits(row.direction, row.kind)) {
    return `${row.sku}: that kind does not belong to an ${row.direction === "in" ? "inbound" : "outbound"} movement.`;
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

  let rows: MovementRow[];
  try {
    rows = JSON.parse(raw);
  } catch {
    return { error: "Could not read those rows. Try again." };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "There is nothing to record yet." };
  }

  for (const row of rows) {
    const problem = validate(row);
    if (problem) return { error: problem };
  }

  await requireSupplier();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("record_stock_movements", {
    p_rows: rows,
  });

  if (error) return { error: error.message };

  revalidateAll();
  return { savedAt: Date.now(), results: data ?? [] };
}
