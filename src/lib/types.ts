/**
 * App-level shapes, derived from the generated `database.types.ts` so a schema
 * change shows up as a type error rather than a runtime surprise.
 */
import type { Database } from "@/lib/database.types";

type Tables = Database["public"]["Tables"];
type Views = Database["public"]["Views"];

export type AppRole = Database["public"]["Enums"]["app_role"];
export type RequestStatus = Database["public"]["Enums"]["request_status"];

export type Profile = Tables["profiles"]["Row"];
export type Supplier = Tables["suppliers"]["Row"];
export type Product = Tables["products"]["Row"];
export type ReserveRequest = Tables["reserve_requests"]["Row"];

/**
 * `reserve_request_dispatch`, normalised.
 *
 * The view is where the database and the screens agree on words: the column is
 * still `qty_released`, but everything reads it as `qty_dispatched` with
 * `qty_outstanding` and the two values worked out alongside. Every column
 * comes back nullable because Postgres cannot prove otherwise for a view.
 */
export type RequestDispatch = {
  id: string;
  product_id: string;
  requested_by: string;
  qty_requested: number;
  qty_approved: number | null;
  qty_dispatched: number;
  qty_outstanding: number | null;
  outstanding_value: number | null;
  dispatched_value: number | null;
  status: RequestStatus;
  hold_until: string | null;
  note: string | null;
  unit_cost: number | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
};

/** Postgres cannot prove a view column is NOT NULL, so every one comes back
 *  nullable. The data layer is the single place that normalises them. */
export type ProductStockRow = Views["product_stock"]["Row"];

/**
 * A row of `product_stock`, normalised.
 *
 * `reserved_qty` is always `sum(qty_approved) where status = 'approved'` —
 * never stored, never edited. `free_qty` is `total - reserved - pending` and
 * is allowed to go negative.
 */
export type ProductStock = Product & {
  reserved_qty: number;
  pending_qty: number;
  free_qty: number;
  /**
   * `total_qty * unit_cost`, straight from the view. Null when the product
   * has no cost — "not priced yet" is a real state, not a zero.
   */
  stock_value: number | null;
  /** Dispatched to Sllr but not yet settled as delivered or returned. */
  in_progress_qty: number;
  in_progress_value: number | null;
};

/** A request joined to the product it sits against. */
export type ReserveRequestWithProduct = ReserveRequest & {
  product: Pick<
    Product,
    "id" | "name" | "sku" | "warehouse_code" | "image_url" | "supplier_id"
  >;
};
