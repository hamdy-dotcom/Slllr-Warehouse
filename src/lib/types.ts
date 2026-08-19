/**
 * App-level shapes that mirror `docs/schema.sql`.
 *
 * Once the env vars exist, `npm run types` regenerates
 * `src/lib/database.types.ts` from the live project; these aliases stay the
 * single import point so components never reach into the generated file.
 */

export type AppRole = "sllr" | "supplier" | "admin";

export type RequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "consumed";

export type Profile = {
  id: string;
  full_name: string | null;
  role: AppRole;
  supplier_id: string | null;
  created_at: string;
};

export type Supplier = {
  id: string;
  name: string;
  contact: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  supplier_id: string;
  name: string;
  sku: string;
  warehouse_code: string;
  image_url: string | null;
  total_qty: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * The `product_stock` view. `reserved_qty` is always
 * `sum(qty_approved) where status = 'approved'` — never stored, never edited.
 */
export type ProductStock = Product & {
  reserved_qty: number;
  pending_qty: number;
  free_qty: number;
};

export type ReserveRequest = {
  id: string;
  product_id: string;
  requested_by: string;
  qty_requested: number;
  qty_approved: number | null;
  status: RequestStatus;
  hold_until: string | null;
  note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
};

/** A request joined to the product it sits against. */
export type ReserveRequestWithProduct = ReserveRequest & {
  product: Pick<
    Product,
    "id" | "name" | "sku" | "warehouse_code" | "image_url" | "supplier_id"
  >;
};
