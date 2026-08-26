/**
 * PO vocabulary. Pure, so the client cards and the server reads can share it.
 *
 * A PO is one approved reserve request for one product. Nothing about a PO is
 * stored: `po_settlement` derives every figure from the request, the movements
 * booked against it, and the settlements booked against those.
 *
 * Each product has its own queue, ordered by `po_date`. Both
 * `record_stock_movements` and `record_settlements` walk that queue oldest
 * first, so a PO's place in it is the order it will be dispatched and settled
 * in — and says nothing about POs on other products.
 */

/** Exactly the strings `po_settlement.po_status` stores, spaces and all. */
export const PO_STATUSES = [
  "awaiting dispatch",
  "part dispatched",
  "in progress",
  "settled",
] as const;

export type PoStatus = (typeof PO_STATUSES)[number];

export function isPoStatus(value: string | undefined): value is PoStatus {
  return PO_STATUSES.includes(value as PoStatus);
}

/** Message keys under `po`, since the stored values are not display copy. */
export const PO_STATUS_KEYS: Record<PoStatus, string> = {
  "awaiting dispatch": "statusAwaiting",
  "part dispatched": "statusPartDispatched",
  "in progress": "statusInProgress",
  settled: "statusSettled",
};

export type Po = {
  po_id: string;
  po_ref: string;
  /** Full timestamp: it orders this PO within its own product's queue. */
  po_date: string;
  supplier_id: string;
  supplier_name: string;
  product_id: string;
  sku: string;
  product_name: string;
  image_url: string | null;
  unit_cost: number | null;
  qty_requested: number;
  qty_approved: number;
  qty_dispatched: number;
  qty_outstanding: number;
  qty_delivered: number;
  qty_returned: number;
  qty_settled: number;
  qty_in_progress: number;
  po_value: number;
  delivered_value: number;
  returned_value: number;
  in_progress_value: number;
  pct_dispatched: number;
  pct_settled: number;
  po_status: PoStatus;
};

/**
 * One PO in its product's queue.
 *
 * `position`, `nextToDispatch` and `nextToSettle` are worked out from the
 * whole queue, never from the filtered view. Filtering hides rows; it must not
 * be able to make the second PO in a queue look like the first, on a screen
 * whose entire subject is the order things settle in.
 */
export type PoQueueItem = {
  po: Po;
  /** 1-based place among all of this product's POs. */
  position: number;
  /** The PO a dispatch on this product would touch next. */
  nextToDispatch: boolean;
  /** The PO a delivery or return on this product would touch next. */
  nextToSettle: boolean;
};

/** One product's queue, oldest first. */
export type PoQueue = {
  product_id: string;
  sku: string;
  product_name: string;
  image_url: string | null;
  supplier_name: string;
  /** How many POs the product really has, before any filter. */
  size: number;
  items: PoQueueItem[];
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

export type PoFilter = { status?: PoStatus; supplierId?: string };

export type PoTotals = {
  open: number;
  inProgress: number;
  settled: number;
  count: number;
};

/**
 * What a set of PO queues is worth.
 *
 * `open` is approved but not yet dispatched — the part of a PO that has not
 * started moving. Returns went back to the supplier and were never owed for,
 * so they are in none of the three.
 */
export function poTotals(queues: PoQueue[]): PoTotals {
  let open = 0;
  let inProgress = 0;
  let settled = 0;
  let count = 0;

  for (const queue of queues) {
    for (const { po } of queue.items) {
      count += 1;
      open += (po.unit_cost ?? 0) * po.qty_outstanding;
      inProgress += po.in_progress_value;
      settled += po.delivered_value;
    }
  }

  return { open, inProgress, settled, count };
}

/** Every supplier appearing in these queues, for the filter. */
export function poSuppliers(queues: PoQueue[]): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const queue of queues) {
    for (const { po } of queue.items) seen.set(po.supplier_id, po.supplier_name);
  }
  return [...seen]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Groups POs into one queue per product, each oldest first, then keeps only
 * the POs a filter admits.
 *
 * Queue shape is settled before filtering: each PO learns its real position
 * and whether it is the head of the dispatch or the settle queue while all of
 * its siblings are still present. Hiding a sibling afterwards changes what is
 * on screen and nothing about what the RPCs will do.
 *
 * Products are ordered by the date of their oldest PO, with anything still
 * moving ahead of anything finished, so the page reads oldest first from the
 * top without implying the queues are one.
 */
export function groupPoQueues(pos: Po[], filter: PoFilter = {}): PoQueue[] {
  const byProduct = new Map<string, Po[]>();
  for (const po of pos) {
    byProduct.set(po.product_id, [...(byProduct.get(po.product_id) ?? []), po]);
  }

  const queues: PoQueue[] = [];

  for (const [product_id, all] of byProduct) {
    const ordered = [...all].sort((a, b) => (a.po_date < b.po_date ? -1 : 1));

    const nextDispatch = ordered.find((po) => po.qty_outstanding > 0);
    const nextSettle = ordered.find((po) => po.qty_in_progress > 0);

    const items = ordered
      .map((po, index) => ({
        po,
        position: index + 1,
        nextToDispatch: nextDispatch?.po_id === po.po_id,
        nextToSettle: nextSettle?.po_id === po.po_id,
      }))
      .filter(
        ({ po }) =>
          (!filter.status || po.po_status === filter.status) &&
          (!filter.supplierId || po.supplier_id === filter.supplierId),
      );

    if (items.length === 0) continue;

    const head = ordered[0];
    queues.push({
      product_id,
      sku: head.sku,
      product_name: head.product_name,
      image_url: head.image_url,
      supplier_name: head.supplier_name,
      size: ordered.length,
      items,
    });
  }

  const open = (queue: PoQueue) =>
    queue.items.some(
      ({ po }) => po.qty_outstanding > 0 || po.qty_in_progress > 0,
    );

  return queues.sort((a, b) => {
    if (open(a) !== open(b)) return open(a) ? -1 : 1;
    return a.items[0].po.po_date < b.items[0].po.po_date ? -1 : 1;
  });
}
