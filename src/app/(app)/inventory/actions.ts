"use server";

import { revalidatePath } from "next/cache";

import { requireSupplier } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** `L03-R02-B07` — line 01-08, rack 01-99, bin 01-14. */
const WAREHOUSE_CODE = /^L(0[1-8])-R(\d{2})-B(0[1-9]|1[0-4])$/;

const CODE_HELP =
  "Use the line-rack-bin format, for example L03-R02-B07. Lines run 01 to 08 and bins 01 to 14.";

export type ProductFormState = {
  error?: string;
  /** Bumped on every success so the dialog knows to close. */
  savedAt?: number;
  /**
   * What was submitted. React resets an uncontrolled form once the action
   * settles, so a failed save has to hand the values back or the typing is
   * lost.
   */
  values?: {
    name: string;
    sku: string;
    warehouse_code: string;
    total_qty: string;
  };
};

function submitted(formData: FormData): ProductFormState["values"] {
  return {
    name: String(formData.get("name") ?? ""),
    sku: String(formData.get("sku") ?? ""),
    warehouse_code: String(formData.get("warehouse_code") ?? ""),
    total_qty: String(formData.get("total_qty") ?? ""),
  };
}

type Parsed = {
  name: string;
  sku: string;
  warehouse_code: string;
  total_qty: number;
};

function parse(formData: FormData): Parsed | string {
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const warehouse_code = String(formData.get("warehouse_code") ?? "")
    .trim()
    .toUpperCase();
  const rawQty = String(formData.get("total_qty") ?? "").trim();

  if (!name || !sku || !warehouse_code || !rawQty) {
    return "Name, SKU, warehouse code, and total units are all required.";
  }

  if (!WAREHOUSE_CODE.test(warehouse_code)) return CODE_HELP;

  const total_qty = Number(rawQty);
  if (!Number.isInteger(total_qty) || total_qty < 0) {
    return "Enter the total units as a whole number of at least 0.";
  }

  return { name, sku, warehouse_code, total_qty };
}

/** Turns a Postgres error into something that says what to do next. */
function explain(message: string): string {
  const belowReserved = message.match(/below the (\d+) units already reserved/);
  if (belowReserved) {
    return `Enter a number of at least ${belowReserved[1]} — that much is already reserved.`;
  }

  if (message.includes("products_supplier_id_sku_key")) {
    return "That SKU is already on your shelf. Use a different one.";
  }

  return message;
}

export async function addProduct(
  _previous: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const parsed = parse(formData);
  if (typeof parsed === "string") {
    return { error: parsed, values: submitted(formData) };
  }

  const profile = await requireSupplier();
  const supabase = await createClient();

  const { error } = await supabase
    .from("products")
    .insert({ ...parsed, supplier_id: profile.supplier_id });

  if (error) {
    return { error: explain(error.message), values: submitted(formData) };
  }

  revalidatePath("/inventory");
  revalidatePath("/catalog");
  revalidatePath("/warehouse");
  revalidatePath("/dashboard");

  return { savedAt: Date.now() };
}

export async function updateProduct(
  _previous: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "That product is no longer on the shelf." };

  const parsed = parse(formData);
  if (typeof parsed === "string") {
    return { error: parsed, values: submitted(formData) };
  }

  // RLS keeps this to the caller's own shelf; requireSupplier keeps a Sllr
  // user from reaching the action at all.
  await requireSupplier();
  const supabase = await createClient();

  const { error } = await supabase.from("products").update(parsed).eq("id", id);

  if (error) {
    return { error: explain(error.message), values: submitted(formData) };
  }

  revalidatePath("/inventory");
  revalidatePath("/catalog");
  revalidatePath("/warehouse");
  revalidatePath("/dashboard");

  return { savedAt: Date.now() };
}
