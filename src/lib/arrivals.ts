/**
 * Arrival vocabulary — no database access, so the server page and the client
 * dialog can both import it.
 */

/** A row of `arrival_log`, plus the shelf figure the view cannot carry. */
export type ArrivalRow = {
  arrival_id: string;
  po_id: string;
  po_ref: string;
  arrived_on: string;
  recorded_at: string;
  product_id: string;
  sku: string;
  product_name: string;
  image_url: string | null;
  warehouse_code: string;
  supplier_name: string;
  qty: number;
  unit_cost: number | null;
  value: number | null;
  reference: string | null;
  note: string | null;
  edited_count: number;
  voided: boolean;
  qty_approved: number;
  qty_arrived: number;
  qty_still_awaiting: number;
  qty_locked_by_dispatch: number;
  received_by_name: string | null;
  /**
   * What the supplier's shelf still holds for this product. Raising an
   * arrival takes the difference off that shelf, so it caps the raise — and
   * it is the one figure `arrival_log` does not carry.
   */
  shelf_qty: number;
};

/** One row of `arrival_edit_log`. */
export type ArrivalEdit = {
  id: string;
  arrival_id: string;
  old_qty: number;
  new_qty: number;
  delta: number;
  old_arrived_on: string | null;
  new_arrived_on: string | null;
  old_reference: string | null;
  new_reference: string | null;
  old_note: string | null;
  new_note: string | null;
  reason: string | null;
  created_at: string;
  edited_by_name: string | null;
};

/**
 * How far an arrival may be edited, and which rule sets each end.
 *
 * All three limits are the RPC's, mirrored here so the dialog can say what is
 * allowed before anything is submitted rather than after it is refused:
 *
 *   floor    units already dispatched from this arrival cannot be un-arrived
 *   ceiling  the PO cannot receive more than it still has awaiting transfer
 *   shelf    raising takes the difference off the supplier's shelf, so the
 *            shelf caps the raise even when the PO would allow it
 *
 * `cappedByShelf` says the shelf is the binding limit rather than the PO, so
 * the dialog can explain the real reason.
 */
export type EditRange = {
  min: number;
  max: number;
  cappedByShelf: boolean;
};

export function editRange(row: ArrivalRow): EditRange {
  const headroom = Math.min(row.qty_still_awaiting, Math.max(row.shelf_qty, 0));

  return {
    min: row.qty_locked_by_dispatch,
    // A floor above the ceiling should be impossible, but clamping keeps the
    // dialog from rendering a backwards range if the data ever disagrees.
    max: Math.max(row.qty + headroom, row.qty_locked_by_dispatch),
    cappedByShelf: row.shelf_qty < row.qty_still_awaiting,
  };
}

/** Whether a typed quantity is one the RPC will accept. */
export function qtyProblem(
  qty: number,
  range: EditRange,
): "notANumber" | "belowFloor" | "aboveCeiling" | null {
  if (!Number.isInteger(qty) || qty < 0) return "notANumber";
  if (qty < range.min) return "belowFloor";
  if (qty > range.max) return "aboveCeiling";
  return null;
}

/** The RPC requires a reason, and blanks do not count as one. */
export function reasonMissing(reason: string): boolean {
  return reason.trim() === "";
}

/** Setting the quantity to zero voids the arrival rather than deleting it. */
export function isVoiding(qty: number): boolean {
  return qty === 0;
}

export type ArrivalFilter = {
  from?: string;
  to?: string;
  q?: string;
  editedOnly?: boolean;
};

/**
 * Search, date range and "edited only", applied after the read so one query
 * serves the table and its totals.
 */
export function matchesArrivalFilter(
  row: ArrivalRow,
  { from, to, q, editedOnly }: ArrivalFilter,
): boolean {
  if (from && row.arrived_on < from) return false;
  if (to && row.arrived_on > to) return false;
  if (editedOnly && row.edited_count === 0) return false;

  const needle = q?.trim().toLowerCase();
  if (!needle) return true;

  return `${row.product_name} ${row.sku} ${row.po_ref} ${row.reference ?? ""}`
    .toLowerCase()
    .includes(needle);
}

export type ArrivalTotals = {
  rows: number;
  qty: number;
  value: number;
  edited: number;
  voided: number;
};

/** Voided rows count as rows but carry no quantity or value. */
export function arrivalTotals(rows: ArrivalRow[]): ArrivalTotals {
  return rows.reduce<ArrivalTotals>(
    (acc, row) => ({
      rows: acc.rows + 1,
      qty: acc.qty + (row.voided ? 0 : row.qty),
      value: acc.value + (row.voided ? 0 : (row.value ?? 0)),
      edited: acc.edited + (row.edited_count > 0 ? 1 : 0),
      voided: acc.voided + (row.voided ? 1 : 0),
    }),
    { rows: 0, qty: 0, value: 0, edited: 0, voided: 0 },
  );
}

/** Which fields an edit actually changed, for the history line. */
export function changedFields(edit: ArrivalEdit): string[] {
  const changed: string[] = [];
  if (edit.old_qty !== edit.new_qty) changed.push("qty");
  if (edit.old_arrived_on !== edit.new_arrived_on) changed.push("date");
  if (edit.old_reference !== edit.new_reference) changed.push("reference");
  if (edit.old_note !== edit.new_note) changed.push("note");
  return changed;
}
