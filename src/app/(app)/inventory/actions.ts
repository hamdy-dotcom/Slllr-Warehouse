"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { requireProfile, requireSupplier } from "@/lib/auth";
import { parseCost } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { rpcTranslator } from "@/lib/rpc-message";
import type { ProductCsvRow } from "@/lib/products-csv";

/** `L03-R02-B07` — line, rack, bin. Any two-digit line or bin is accepted. */
const WAREHOUSE_CODE = /^L\d{2}-R\d{2}-B\d{2}$/;

type Translator = Awaited<ReturnType<typeof getTranslations>>;

export type ProductFormState = {
  error?: string;
  /** Bumped on every success so the dialog knows to close. */
  savedAt?: number;
  /** The row that was written, so a new product can take an image next. */
  productId?: string;
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
    unit_cost: string;
    is_active: boolean;
  };
};

function submitted(formData: FormData): ProductFormState["values"] {
  return {
    name: String(formData.get("name") ?? ""),
    sku: String(formData.get("sku") ?? ""),
    warehouse_code: String(formData.get("warehouse_code") ?? ""),
    total_qty: String(formData.get("total_qty") ?? ""),
    unit_cost: String(formData.get("unit_cost") ?? ""),
    is_active: formData.get("is_active") === "on",
  };
}

type Parsed = {
  name: string;
  sku: string;
  warehouse_code: string;
  total_qty: number;
  /** Null is a real value here — the product is simply not priced yet. */
  unit_cost: number | null;
  is_active: boolean;
};

function parse(formData: FormData, t: Translator): Parsed | string {
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const warehouse_code = String(formData.get("warehouse_code") ?? "")
    .trim()
    .toUpperCase();
  const rawQty = String(formData.get("total_qty") ?? "").trim();

  if (!name || !sku || !warehouse_code || !rawQty) {
    return t("requiredFields");
  }

  if (!WAREHOUSE_CODE.test(warehouse_code)) return t("codeFormat");

  const total_qty = Number(rawQty);
  if (!Number.isInteger(total_qty) || total_qty < 0) {
    return t("wholeNumber");
  }

  const unit_cost = parseCost(String(formData.get("unit_cost") ?? ""));
  if (unit_cost === "invalid") {
    return t("costFormat");
  }

  return {
    name,
    sku,
    warehouse_code,
    total_qty,
    unit_cost,
    is_active: formData.get("is_active") === "on",
  };
}

/** Turns a Postgres error into something that says what to do next. */
function explain(message: string, t: Translator): string {
  const belowReserved = message.match(/below the (\d+) units already reserved/);
  if (belowReserved) {
    return t("belowReserved", { count: belowReserved[1] });
  }

  if (message.includes('policy for table "stock_movements"')) {
    return t("stockMovementsPolicy");
  }

  if (
    message.includes("products_supplier_id_sku_key") ||
    (message.includes("duplicate key") && message.includes("sku"))
  ) {
    return t("duplicateSku");
  }

  return message;
}

export async function addProduct(
  _previous: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const t = await getTranslations("errors");
  const parsed = parse(formData, t);
  if (typeof parsed === "string") {
    return { error: parsed, values: submitted(formData) };
  }

  const profile = await requireSupplier();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .insert({ ...parsed, supplier_id: profile.supplier_id })
    .select("id")
    .single();

  if (error) {
    return { error: explain(error.message, t), values: submitted(formData) };
  }

  revalidatePath("/inventory");
  revalidatePath("/catalog");
  revalidatePath("/dashboard");

  return { savedAt: Date.now(), productId: data.id };
}

export async function updateProduct(
  _previous: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const id = String(formData.get("id") ?? "");
  const t = await getTranslations("errors");
  if (!id) return { error: t("productGone") };

  const parsed = parse(formData, t);
  if (typeof parsed === "string") {
    return { error: parsed, values: submitted(formData) };
  }

  // RLS keeps this to the caller's own shelf; requireSupplier keeps a Sllr
  // user from reaching the action at all.
  await requireSupplier();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("products")
    .select("total_qty")
    .eq("id", id)
    .maybeSingle();

  if (!before) return { error: t("productGone") };

  const { total_qty, ...columns } = parsed;

  // Everything except the quantity is a plain update — the guard trigger only
  // writes a movement row when total_qty actually moves, and that write needs
  // the security-definer RPC below.
  const { error } = await supabase
    .from("products")
    .update(columns)
    .eq("id", id);

  if (error) {
    return { error: explain(error.message, t), values: submitted(formData) };
  }

  if (total_qty !== before.total_qty) {
    const failure = await setTotalQty(columns.sku, total_qty, t);
    if (failure) return { error: failure, values: submitted(formData) };
  }

  revalidatePath("/inventory");
  revalidatePath("/catalog");
  revalidatePath("/dashboard");

  return { savedAt: Date.now(), productId: id };
}

export type ImageState = { error?: string; savedAt?: number };

const BUCKET = "product-images";
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Stores an already-compressed image at `{supplier_id}/{product_id}.jpg` and
 * writes the public URL onto the product.
 *
 * The upload runs with the service role: the bucket policy in
 * `docs/schema.sql` grants INSERT only, so overwriting an existing image would
 * fail under RLS. Ownership is checked first with the caller's own client, so
 * the elevated key never widens what they can reach.
 */
export async function uploadProductImage(
  _previous: ImageState,
  formData: FormData,
): Promise<ImageState> {
  const productId = String(formData.get("product_id") ?? "");
  const file = formData.get("image");

  const t = await getTranslations("errors");
  const ti = await getTranslations("inventory");

  if (!productId) return { error: t("productGone") };
  if (!(file instanceof File) || file.size === 0) {
    return { error: t("chooseImage") };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: ti("imageTooLarge") };
  }

  const profile = await requireSupplier();
  const supabase = await createClient();

  // RLS scopes this read to the caller's own shelf, so a hit proves ownership.
  const { data: owned } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("supplier_id", profile.supplier_id)
    .maybeSingle();

  if (!owned) return { error: t("notYourShelf") };

  const admin = createAdminClient();
  const path = `${profile.supplier_id}/${productId}.jpg`;

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "3600",
    });

  if (uploadError) {
    return { error: t("uploadFailed", { message: uploadError.message }) };
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(BUCKET).getPublicUrl(path);

  // The path never changes, so the URL carries a version to beat the CDN.
  const versioned = `${publicUrl}?v=${Date.now()}`;

  const { error } = await supabase
    .from("products")
    .update({ image_url: versioned })
    .eq("id", productId);

  if (error) return { error: explain(error.message, t) };

  revalidatePath("/inventory");
  revalidatePath("/catalog");
  revalidatePath("/dashboard");
  revalidatePath("/requests");
  revalidatePath("/approvals");

  return { savedAt: Date.now() };
}

/**
 * Every `total_qty` change goes through `bulk_update_stock`.
 *
 * A direct UPDATE cannot work: the `products_guard` trigger writes the audit
 * row into `stock_movements`, that table has RLS on with a select policy only,
 * and the trigger is not security definer — so the write is refused as
 * "new row violates row-level security policy". The RPC is security definer,
 * so it is the one path that can move a quantity and record the movement.
 */
async function setTotalQty(
  sku: string,
  total_qty: number,
  t: Translator,
  warehouse_code?: string,
): Promise<string | null> {
  const supabase = await createClient();
  const say = await rpcTranslator();

  const { data, error } = await supabase.rpc("bulk_update_stock", {
    p_rows: [
      warehouse_code ? { sku, total_qty, warehouse_code } : { sku, total_qty },
    ],
  });

  if (error) return explain(error.message, t);

  const row = data?.[0];
  if (!row) return (await getTranslations("rpc"))("noAnswer");
  if (!row.ok) return say(row.message);

  return null;
}

/** The inline quantity box on an inventory row. */
export async function updateStockQty(
  _previous: StockQtyState,
  formData: FormData,
): Promise<StockQtyState> {
  const sku = String(formData.get("sku") ?? "");
  const raw = String(formData.get("total_qty") ?? "").trim();

  const t = await getTranslations("errors");
  if (!sku) return { error: t("productGone") };

  const total_qty = Number(raw);
  if (raw === "" || !Number.isInteger(total_qty) || total_qty < 0) {
    return { error: t("wholeNumber") };
  }

  await requireSupplier();

  const failure = await setTotalQty(sku, total_qty, t);
  if (failure) return { error: failure };

  revalidatePath("/inventory");
  revalidatePath("/catalog");
  revalidatePath("/dashboard");

  return { savedAt: Date.now(), total_qty };
}

export type StockQtyState = {
  error?: string;
  savedAt?: number;
  /** What the row actually holds now, so the input can settle on the truth. */
  total_qty?: number;
};

export type BulkRow = {
  sku: string;
  total_qty: number;
  warehouse_code?: string;
  /** number sets a price, null clears it, absent leaves it as it was. */
  unit_cost?: number | null;
};

export type BulkResult = { sku: string; ok: boolean; message: string };

export type BulkState = {
  error?: string;
  savedAt?: number;
  results?: BulkResult[];
};

/**
 * Commits a parsed CSV through `bulk_update_stock`, which reports per row
 * rather than failing the whole batch — one bad SKU does not cost the others.
 */
export async function bulkUpdateStock(
  _previous: BulkState,
  formData: FormData,
): Promise<BulkState> {
  const raw = String(formData.get("rows") ?? "");
  const t = await getTranslations("errors");
  const tr = await getTranslations("rpc");
  const say = await rpcTranslator();

  let rows: BulkRow[];
  try {
    rows = JSON.parse(raw);
  } catch {
    return { error: t("cannotRead") };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: t("nothingToUpdate") };
  }

  await requireSupplier();
  const supabase = await createClient();

  // The RPC only moves quantities and codes. Cost is a plain column with no
  // guard trigger behind it, so it goes through a direct update — but only for
  // the rows whose price actually changes.
  const { data, error } = await supabase.rpc("bulk_update_stock", {
    p_rows: rows.map(({ sku, total_qty, warehouse_code }) =>
      warehouse_code ? { sku, total_qty, warehouse_code } : { sku, total_qty },
    ),
  });

  if (error) return { error: explain(error.message, t) };

  const results = (data ?? []).map((row) => ({
    ...row,
    message: say(row.message),
  }));
  const costs = await applyCosts(rows, t, tr);

  // Quantity and cost are independent facts on a row, so one can land while
  // the other is refused. Say so rather than reporting only half of it.
  for (const [sku, outcome] of costs) {
    const row = results.find((result) => result.sku === sku);

    if (!row) {
      results.push({ sku, ok: outcome.ok, message: outcome.message });
      continue;
    }

    if (!outcome.ok) {
      row.message = row.ok
        ? outcome.message
        : `${row.message} · ${tr("costNotChanged")}`;
      row.ok = false;
    } else {
      row.message = `${row.message} · ${outcome.message}`;
    }
  }

  revalidatePath("/inventory");
  revalidatePath("/catalog");
  revalidatePath("/dashboard");
  revalidatePath("/requests");
  revalidatePath("/approvals");

  return { savedAt: Date.now(), results };
}

type CostOutcome = { ok: boolean; message: string };

/**
 * Writes the cost column for the rows that carry one, skipping any whose price
 * already matches. Only rows that actually moved come back, so an unchanged
 * price adds no noise to the result table.
 */
async function applyCosts(
  rows: BulkRow[],
  t: Translator,
  tr: Translator,
): Promise<Map<string, CostOutcome>> {
  const outcomes = new Map<string, CostOutcome>();
  const wanted = rows.filter((row) => row.unit_cost !== undefined);
  if (wanted.length === 0) return outcomes;

  const profile = await requireSupplier();
  const supabase = await createClient();

  const { data: current, error } = await supabase
    .from("products")
    .select("sku, unit_cost")
    .eq("supplier_id", profile.supplier_id)
    .in(
      "sku",
      wanted.map((row) => row.sku),
    );

  if (error) {
    for (const row of wanted) {
      outcomes.set(row.sku, { ok: false, message: explain(error.message, t) });
    }
    return outcomes;
  }

  const now = new Map((current ?? []).map((row) => [row.sku, row.unit_cost]));

  for (const row of wanted) {
    if (!now.has(row.sku)) continue; // the RPC already reported this one
    if (now.get(row.sku) === row.unit_cost) continue;

    const { error: updateError } = await supabase
      .from("products")
      .update({ unit_cost: row.unit_cost })
      .eq("supplier_id", profile.supplier_id)
      .eq("sku", row.sku);

    outcomes.set(
      row.sku,
      updateError
        ? { ok: false, message: explain(updateError.message, t) }
        : {
            ok: true,
            message:
              row.unit_cost === null ? tr("costCleared") : tr("costUpdated"),
          },
    );
  }

  return outcomes;
}

export type CreateResult = { sku: string | null; ok: boolean; message: string };

export type CreateState = {
  error?: string;
  savedAt?: number;
  results?: CreateResult[];
};

/**
 * Creates products in bulk through `bulk_create_products`, which reports per
 * row rather than failing the batch — one bad line does not cost the others.
 *
 * The RPC owns every rule: the warehouse code shape, the refusal to overwrite
 * a SKU that already exists, and the scoping to the caller's own supplier.
 * The parser checks the same things first so the preview can flag a row
 * before it is sent, not instead of the RPC checking it.
 */
export async function bulkCreateProducts(
  _previous: CreateState,
  formData: FormData,
): Promise<CreateState> {
  const raw = String(formData.get("rows") ?? "");
  const [t, say] = await Promise.all([
    getTranslations("errors"),
    rpcTranslator(),
  ]);

  let rows: ProductCsvRow[];
  try {
    rows = JSON.parse(raw);
  } catch {
    return { error: t("cannotRead") };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: t("nothingToUpdate") };
  }

  const profile = await requireProfile();
  if (profile.role !== "supplier") {
    return { error: t("onlySupplierCreate") };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bulk_create_products", {
    p_rows: rows,
  });

  if (error) return { error: error.message };

  revalidatePath("/inventory");
  revalidatePath("/catalog");
  revalidatePath("/dashboard");

  return {
    savedAt: Date.now(),
    results: (data ?? []).map((row) => ({ ...row, message: say(row.message) })),
  };
}
