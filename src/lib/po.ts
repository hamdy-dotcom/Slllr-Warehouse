/**
 * PO vocabulary. Pure, so the client table and the server reads share it.
 *
 * A PO is one approved reserve request for one product. Nothing about a PO is
 * stored: `po_settlement` derives every figure from the request, the movements
 * booked against it, and the settlements booked against those.
 *
 * Each product has its own queue, ordered by `po_date` — `queue_position` in
 * the view. Which end of that queue an operation eats from is a rule per
 * operation, not one FIFO rule:
 *
 *   dispatch   oldest → newest
 *   delivered  oldest → newest
 *   returned   newest → oldest
 *   release    newest → oldest
 *
 * `qty_approved` never shrinks. Releasing raises `qty_cancelled` instead, so
 * a PO always reads as one identity:
 *
 *   approved = dispatched + delivered + returned + outstanding + cancelled
 *
 * **Dispatched means the live pool** — units with customers now, waiting to be
 * delivered or returned — which is `qty_in_progress` in the view. The view
 * also carries `qty_dispatched`, a cumulative counter of everything that ever
 * left, including units since settled; it is deliberately not on this type,
 * because a total that only grows would contradict the identity above
 * anywhere it was shown.
 */

/** Exactly the strings `po_settlement.po_status` stores, spaces and all. */
export const PO_STATUSES = [
  "awaiting dispatch",
  "part dispatched",
  "dispatched",
  "settled",
  "cancelled",
] as const;

export type PoStatus = (typeof PO_STATUSES)[number];

export function isPoStatus(value: string | undefined): value is PoStatus {
  return PO_STATUSES.includes(value as PoStatus);
}

/**
 * Message keys under `po`, since the stored values are not display copy.
 *
 * A literal the view starts emitting that is not in here has no key, so
 * callers fall back to the raw value rather than rendering a broken lookup.
 */
const STATUS_KEYS: Record<PoStatus, string> = {
  "awaiting dispatch": "statusAwaiting",
  "part dispatched": "statusPartDispatched",
  dispatched: "statusDispatched",
  settled: "statusSettled",
  cancelled: "statusCancelled",
};

export function poStatusKey(status: string): string | null {
  return STATUS_KEYS[status as PoStatus] ?? null;
}

export type Po = {
  po_id: string;
  po_ref: string;
  /** Full timestamp: it orders this PO within its own product's queue. */
  po_date: string;
  /** 1-based place in this product's queue, straight from the view. */
  queue_position: number;
  supplier_id: string;
  supplier_name: string;
  product_id: string;
  sku: string;
  product_name: string;
  image_url: string | null;
  unit_cost: number | null;
  qty_requested: number;
  qty_approved: number;
  qty_cancelled: number;
  qty_outstanding: number;
  qty_delivered: number;
  qty_returned: number;
  qty_in_progress: number;
  po_value: number;
  outstanding_value: number;
  delivered_value: number;
  returned_value: number;
  in_progress_value: number;
  cancelled_value: number;
  pct_in_progress: number;
  pct_delivered: number;
  pct_returned: number;
  po_status: PoStatus;
};

export type PoSettlementEntry = {
  id: string;
  po_id: string;
  kind: "delivered" | "returned";
  qty: number;
  value: number;
  occurred_on: string;
  reference: string | null;
  note: string | null;
};

export type PoFilter = {
  status?: PoStatus;
  supplierId?: string;
  /** Matched against product name and SKU. */
  q?: string;
};

export function matchesPoFilter(po: Po, filter: PoFilter): boolean {
  if (filter.status && po.po_status !== filter.status) return false;
  if (filter.supplierId && po.supplier_id !== filter.supplierId) return false;

  if (filter.q) {
    const needle = filter.q.trim().toLowerCase();
    if (needle) {
      const hay = `${po.product_name} ${po.sku} ${po.po_ref}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
  }

  return true;
}

export const PO_SORTS = [
  "queue",
  "date",
  "product",
  "ref",
  "approved",
  "value",
  "in_progress",
  "delivered",
  "returned",
  "outstanding",
  "status",
] as const;

export type PoSort = (typeof PO_SORTS)[number];
export type SortDir = "asc" | "desc";

export function isPoSort(value: string | undefined): value is PoSort {
  return PO_SORTS.includes(value as PoSort);
}

/**
 * The default: product, then the product's own queue order.
 *
 * That makes each product's rows read top to bottom in the order a dispatch
 * or a delivery will consume them, which is the whole reason to look at this
 * table. Any other sort breaks that reading, so `queue_position` stays on
 * every row to say where a PO really sits.
 */
export const DEFAULT_SORT: PoSort = "queue";

const compare = (a: number | string, b: number | string) =>
  a < b ? -1 : a > b ? 1 : 0;

export function sortPos(pos: Po[], sort: PoSort, dir: SortDir): Po[] {
  const rows = [...pos];

  const by: Record<PoSort, (po: Po) => number | string> = {
    queue: (po) => po.product_name.toLowerCase(),
    date: (po) => po.po_date,
    product: (po) => po.product_name.toLowerCase(),
    ref: (po) => po.po_ref,
    approved: (po) => po.qty_approved,
    value: (po) => po.po_value,
    in_progress: (po) => po.qty_in_progress,
    delivered: (po) => po.qty_delivered,
    returned: (po) => po.qty_returned,
    outstanding: (po) => po.qty_outstanding,
    status: (po) => po.po_status,
  };

  rows.sort((a, b) => {
    const first = compare(by[sort](a), by[sort](b));
    const signed = dir === "desc" ? -first : first;
    if (signed !== 0) return signed;

    // Ties always fall back to the queue, so rows of one product never
    // scramble the order they will actually settle in.
    if (a.product_id === b.product_id) {
      return compare(a.queue_position, b.queue_position);
    }
    return compare(a.product_name.toLowerCase(), b.product_name.toLowerCase());
  });

  return rows;
}

/**
 * How much of a PO has left the shelf, and in what state it sits now.
 *
 * Dispatched, delivered and returned are all units that went out: a delivery
 * or a return moves a unit on from dispatched, it does not put it back. So
 * "gone" is the three added together, and a PO with nothing outstanding is
 * fully gone however much of it has since been settled.
 *
 * Worked out from the quantities rather than by adding the view's three
 * percentages, which each round on their own and drift a point off the total.
 */
export function poLeftShelf(po: Po): {
  qty: number;
  pct: number;
  dispatchedPct: number;
  deliveredPct: number;
  returnedPct: number;
} {
  const qty = po.qty_in_progress + po.qty_delivered + po.qty_returned;
  const share = (part: number) =>
    po.qty_approved <= 0 ? 0 : (part / po.qty_approved) * 100;

  return {
    qty,
    pct: share(qty),
    dispatchedPct: share(po.qty_in_progress),
    deliveredPct: share(po.qty_delivered),
    returnedPct: share(po.qty_returned),
  };
}

export type PoTotals = {
  open: number;
  inProgress: number;
  delivered: number;
  count: number;
};

/**
 * What the listed POs are worth.
 *
 * `open` is approved, not dispatched and not cancelled — the part of a PO
 * that has not started moving. Returns went back and were never owed for, so
 * they are in none of the three.
 */
export function poTotals(pos: Po[]): PoTotals {
  let open = 0;
  let inProgress = 0;
  let delivered = 0;

  for (const po of pos) {
    open += po.outstanding_value;
    inProgress += po.in_progress_value;
    delivered += po.delivered_value;
  }

  return { open, inProgress, delivered, count: pos.length };
}

/** Every supplier appearing in these POs, for the filter. */
export function poSuppliers(pos: Po[]): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const po of pos) seen.set(po.supplier_id, po.supplier_name);
  return [...seen]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Every product with something still reserved, for the release picker. */
export function releasableProducts(
  pos: Po[],
): { sku: string; name: string; outstanding: number }[] {
  const bySku = new Map<string, { sku: string; name: string; outstanding: number }>();

  for (const po of pos) {
    if (po.qty_outstanding <= 0) continue;
    const entry = bySku.get(po.sku) ?? {
      sku: po.sku,
      name: po.product_name,
      outstanding: 0,
    };
    entry.outstanding += po.qty_outstanding;
    bySku.set(po.sku, entry);
  }

  return [...bySku.values()].sort((a, b) => a.sku.localeCompare(b.sku));
}

export type ReleaseHit = { po_ref: string; queue_position: number; qty: number };

export type ReleasePreview = {
  sku: string;
  qty: number;
  hits: ReleaseHit[];
  available: number;
  value: number | null;
  /** Set when the product has less reserved than the row asks for. */
  problem: "skuNotFound" | "onlyReserved" | null;
};

/**
 * What `release_reserved_qty` will do, newest PO first.
 *
 * A forecast for the confirm step, never an instruction: the RPC walks the
 * queue itself and this only has to agree with it.
 */
export function simulateRelease(
  sku: string,
  qty: number,
  pos: Po[],
): ReleasePreview {
  const queue = pos
    .filter((po) => po.sku === sku)
    .sort((a, b) => compare(b.queue_position, a.queue_position));

  if (queue.length === 0) {
    return { sku, qty, hits: [], available: 0, value: null, problem: "skuNotFound" };
  }

  const available = queue.reduce((total, po) => total + po.qty_outstanding, 0);
  if (qty > available) {
    return { sku, qty, hits: [], available, value: null, problem: "onlyReserved" };
  }

  const hits: ReleaseHit[] = [];
  let left = qty;
  let value: number | null = 0;

  for (const po of queue) {
    if (left <= 0) break;
    const take = Math.min(left, po.qty_outstanding);
    if (take <= 0) continue;

    hits.push({ po_ref: po.po_ref, queue_position: po.queue_position, qty: take });
    left -= take;

    if (po.unit_cost === null) value = null;
    else if (value !== null) value += po.unit_cost * take;
  }

  return { sku, qty, hits, available, value, problem: null };
}
