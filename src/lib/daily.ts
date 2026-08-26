/**
 * Simulating a day's paste.
 *
 * The same function runs in the browser to draw the preview and on the server
 * to decide what may be written, so what the screen promises and what the
 * action allows cannot drift apart.
 *
 * It does not allocate anything. `record_stock_movements` and
 * `record_settlements` own that, and each walks **one product's queue of
 * POs** — but not always from the same end:
 *
 *   dispatch   oldest → newest
 *   delivered  oldest → newest
 *   returned   newest → oldest
 *
 * A return going the other way is the point, not an accident: the units most
 * recently committed are the ones handed back first. This mirrors those rules
 * so the preview can say which POs a row will hit — but the numbers it draws
 * are a forecast of the RPC's work, never an instruction to it.
 *
 * Two pools move. A dispatch takes from a PO's **outstanding** — approved but
 * not yet sent — and puts those units into that same PO's **in progress**. A
 * delivery or a return takes from in progress. Rows are walked in the order
 * they were pasted, so a SKU dispatched on one line and delivered on the next
 * sees its own dispatch.
 */
import type { SettlementCsvRow } from "@/lib/settlements-csv";

/**
 * One PO in a product's queue.
 *
 * A PO is one approved request for one product. Each product has its own
 * queue, so `po_date` orders POs against their siblings on the same SKU and
 * means nothing across SKUs.
 */
export type PoQueueLine = {
  po_id: string;
  po_ref: string;
  /** ISO timestamp. Orders this PO within its own product's queue. */
  po_date: string;
  sku: string;
  outstanding: number;
  in_progress: number;
  unit_cost: number | null;
};

/** A slice of one row, taken from one PO. */
export type PoHit = { po_ref: string; qty: number };

export type SimRow = {
  row: SettlementCsvRow;
  /** The pool this row draws from, before and after, summed over the queue. */
  pool: "outstanding" | "inProgress";
  before: number;
  after: number;
  /** In progress before and after, for every kind — a dispatch adds to it. */
  progressBefore: number;
  progressAfter: number;
  /** What the row is worth at each PO's own cost, or null when one is unpriced. */
  value: number | null;
  /** Which POs the row draws from, oldest first — the order the RPC will use. */
  hits: PoHit[];
  /**
   * Why the row does not fit, named rather than written out. The simulation
   * runs on the server and in the browser and has to read in either language,
   * so the copy is resolved where it is rendered.
   */
  problem: SimProblem | null;
};

export type SimProblem = {
  key: string;
  params?: Record<string, string | number>;
};

export type Simulation = {
  rows: SimRow[];
  blocked: number;
  dispatchedValue: number;
  deliveredValue: number;
  returnedValue: number;
};

type Entry = {
  po_ref: string;
  outstanding: number;
  in_progress: number;
  unit_cost: number | null;
};

/** Oldest first, per product. A return walks the same list backwards. */
function queueBySku(queue: PoQueueLine[]): Map<string, Entry[]> {
  const bySku = new Map<string, Entry[]>();

  for (const line of [...queue].sort((a, b) =>
    a.po_date < b.po_date ? -1 : a.po_date > b.po_date ? 1 : 0,
  )) {
    const list = bySku.get(line.sku) ?? [];
    list.push({
      po_ref: line.po_ref,
      outstanding: line.outstanding,
      in_progress: line.in_progress,
      unit_cost: line.unit_cost,
    });
    bySku.set(line.sku, list);
  }

  return bySku;
}

const sum = (entries: Entry[], of: (entry: Entry) => number) =>
  entries.reduce((total, entry) => total + of(entry), 0);

/**
 * Walks a product's queue, taking what it can from each PO in turn.
 *
 * `entries` arrives already in the order the RPC will use, so this does not
 * decide the direction. Only called once the total has been checked, so it
 * always places the whole quantity. Returns null for the value if any PO it
 * touched carries no cost — a partial total would read as a real amount and
 * understate the row.
 */
function draw(
  entries: Entry[],
  qty: number,
  from: "outstanding" | "in_progress",
  onTake: (entry: Entry, take: number) => void,
): { hits: PoHit[]; value: number | null } {
  const hits: PoHit[] = [];
  let left = qty;
  let value: number | null = 0;

  for (const entry of entries) {
    if (left <= 0) break;
    const take = Math.min(left, entry[from]);
    if (take <= 0) continue;

    onTake(entry, take);
    hits.push({ po_ref: entry.po_ref, qty: take });
    left -= take;

    if (entry.unit_cost === null) value = null;
    else if (value !== null) value += entry.unit_cost * take;
  }

  return { hits, value };
}

export function simulateDaily(
  rows: SettlementCsvRow[],
  queue: PoQueueLine[],
): Simulation {
  const bySku = queueBySku(queue);

  let dispatchedValue = 0;
  let deliveredValue = 0;
  let returnedValue = 0;

  const simulated = rows.map<SimRow>((row) => {
    const entries = bySku.get(row.sku) ?? [];
    const progressBefore = sum(entries, (entry) => entry.in_progress);
    const dispatch = row.kind === "dispatched";
    const pool = dispatch ? ("outstanding" as const) : ("inProgress" as const);
    const before = dispatch
      ? sum(entries, (entry) => entry.outstanding)
      : progressBefore;
    const after = before - row.qty;

    let problem: SimProblem | null = null;
    if (!bySku.has(row.sku)) problem = { key: "skuNotFound" };
    else if (before === 0) {
      problem = { key: dispatch ? "nothingOutstanding" : "nothingInProgress" };
    } else if (after < 0) {
      problem = {
        key: dispatch ? "onlyOutstanding" : "onlyInProgress",
        params: {
          available: before.toLocaleString("en-US"),
          wanted: row.qty.toLocaleString("en-US"),
        },
      };
    }

    if (problem) {
      return {
        row,
        pool,
        before,
        after,
        progressBefore,
        progressAfter: progressBefore,
        value: null,
        hits: [],
        problem,
      };
    }

    // A return hands back the newest commitment first, so it walks the queue
    // from the other end. Dispatch and delivery both start at the oldest.
    const walk = row.kind === "returned" ? [...entries].reverse() : entries;

    const { hits, value } = dispatch
      ? draw(walk, row.qty, "outstanding", (entry, take) => {
          entry.outstanding -= take;
          // Dispatched units stay on their own PO, now in progress.
          entry.in_progress += take;
        })
      : draw(walk, row.qty, "in_progress", (entry, take) => {
          entry.in_progress -= take;
        });

    if (dispatch) dispatchedValue += value ?? 0;
    else if (row.kind === "delivered") deliveredValue += value ?? 0;
    else returnedValue += value ?? 0;

    return {
      row,
      pool,
      before,
      after,
      progressBefore,
      progressAfter: dispatch ? progressBefore + row.qty : progressBefore - row.qty,
      value,
      hits,
      problem: null,
    };
  });

  return {
    rows: simulated,
    blocked: simulated.filter((entry) => entry.problem !== null).length,
    dispatchedValue,
    deliveredValue,
    returnedValue,
  };
}
