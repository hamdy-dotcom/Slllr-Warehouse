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
 * The view's `qty_dispatched_total` is everything that has left the warehouse
 * against this request, including units since delivered or returned. It is
 * deliberately absent here: "dispatched" on a screen means the live pool of
 * units with customers, and a total that only ever grows would quietly
 * contradict that everywhere it appeared as a quantity. Its share of the PO
 * is a different matter and does belong on screen — see `poLeftShelf`.
 *
 * The live figures come from `po_settlement` and are stitched on in
 * `listMyRequests`. They are null for a request that never became a PO.
 *
 * Every column comes back nullable because Postgres cannot prove otherwise
 * for a view.
 */
export type RequestDispatch = {
  id: string;
  product_id: string;
  requested_by: string;
  qty_requested: number;
  qty_approved: number | null;
  qty_outstanding: number | null;
  outstanding_value: number | null;
  /** Live pool: with customers now, awaiting delivery or return. */
  qty_awaiting_transfer: number | null;
  qty_in_warehouse: number | null;
  qty_out_for_delivery: number | null;
  qty_delivered: number | null;
  qty_cancelled: number | null;
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
