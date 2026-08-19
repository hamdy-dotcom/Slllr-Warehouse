"use server";

import { revalidatePath } from "next/cache";

import { requireSupplier } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * `L03-R02-B07` — line, rack, bin. Any two-digit line or bin is accepted; the
 * warehouse page lists anything outside the 8 x 14 grid under "Off the grid"
 * rather than dropping it.
 */
const WAREHOUSE_CODE = /^L\d{2}-R\d{2}-B\d{2}$/;

const CODE_HELP = "Use the line-rack-bin format, for example L03-R02-B07.";

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
    is_active: boolean;
  };
};

function submitted(formData: FormData): ProductFormState["values"] {
  return {
    name: String(formData.get("name") ?? ""),
    sku: String(formData.get("sku") ?? ""),
    warehouse_code: String(formData.get("warehouse_code") ?? ""),
    total_qty: String(formData.get("total_qty") ?? ""),
    is_active: formData.get("is_active") === "on",
  };
}

type Parsed = {
  name: string;
  sku: string;
  warehouse_code: string;
  total_qty: number;
  is_active: boolean;
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

  return {
    name,
    sku,
    warehouse_code,
    total_qty,
    is_active: formData.get("is_active") === "on",
  };
}

/** Turns a Postgres error into something that says what to do next. */
function explain(message: string): string {
  const belowReserved = message.match(/below the (\d+) units already reserved/);
  if (belowReserved) {
    return `Enter a number of at least ${belowReserved[1]} — that much is already reserved.`;
  }

  if (message.includes('policy for table "stock_movements"')) {
    return "Stock changes are not being recorded. stock_movements has row level security on with no insert policy, and guard_total_qty is not security definer.";
  }

  if (
    message.includes("products_supplier_id_sku_key") ||
    (message.includes("duplicate key") && message.includes("sku"))
  ) {
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

  const { data, error } = await supabase
    .from("products")
    .insert({ ...parsed, supplier_id: profile.supplier_id })
    .select("id")
    .single();

  if (error) {
    return { error: explain(error.message), values: submitted(formData) };
  }

  revalidatePath("/inventory");
  revalidatePath("/catalog");
  revalidatePath("/warehouse");
  revalidatePath("/dashboard");

  return { savedAt: Date.now(), productId: data.id };
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

  const { data: before } = await supabase
    .from("products")
    .select("total_qty")
    .eq("id", id)
    .maybeSingle();

  if (!before) return { error: "That product is no longer on the shelf." };

  const { total_qty, ...columns } = parsed;

  // Everything except the quantity is a plain update — the guard trigger only
  // writes a movement row when total_qty actually moves, and that write needs
  // the security-definer RPC below.
  const { error } = await supabase
    .from("products")
    .update(columns)
    .eq("id", id);

  if (error) {
    return { error: explain(error.message), values: submitted(formData) };
  }

  if (total_qty !== before.total_qty) {
    const failure = await setTotalQty(columns.sku, total_qty);
    if (failure) return { error: failure, values: submitted(formData) };
  }

  revalidatePath("/inventory");
  revalidatePath("/catalog");
  revalidatePath("/warehouse");
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

  if (!productId) return { error: "That product is no longer on the shelf." };
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image file to upload." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "That image is too large. Choose one under 4 MB." };
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

  if (!owned) return { error: "That product is not on your shelf." };

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
    return { error: `Could not upload that image: ${uploadError.message}` };
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

  if (error) return { error: explain(error.message) };

  revalidatePath("/inventory");
  revalidatePath("/catalog");
  revalidatePath("/warehouse");
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
  warehouse_code?: string,
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("bulk_update_stock", {
    p_rows: [
      warehouse_code ? { sku, total_qty, warehouse_code } : { sku, total_qty },
    ],
  });

  if (error) return explain(error.message);

  const row = data?.[0];
  if (!row) return "The shelf did not answer. Try again.";
  if (!row.ok) return row.message;

  return null;
}

/** The inline quantity box on an inventory row. */
export async function updateStockQty(
  _previous: StockQtyState,
  formData: FormData,
): Promise<StockQtyState> {
  const sku = String(formData.get("sku") ?? "");
  const raw = String(formData.get("total_qty") ?? "").trim();

  if (!sku) return { error: "That product is no longer on the shelf." };

  const total_qty = Number(raw);
  if (raw === "" || !Number.isInteger(total_qty) || total_qty < 0) {
    return { error: "Enter the total units as a whole number of at least 0." };
  }

  await requireSupplier();

  const failure = await setTotalQty(sku, total_qty);
  if (failure) return { error: failure };

  revalidatePath("/inventory");
  revalidatePath("/catalog");
  revalidatePath("/warehouse");
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

  let rows: BulkRow[];
  try {
    rows = JSON.parse(raw);
  } catch {
    return { error: "Could not read those rows. Paste the CSV again." };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      error: "There is nothing to update. Paste or upload a CSV first.",
    };
  }

  await requireSupplier();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("bulk_update_stock", {
    p_rows: rows,
  });

  if (error) return { error: explain(error.message) };

  revalidatePath("/inventory");
  revalidatePath("/catalog");
  revalidatePath("/warehouse");
  revalidatePath("/dashboard");

  return { savedAt: Date.now(), results: data ?? [] };
}
