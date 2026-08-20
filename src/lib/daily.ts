/**
 * Simulating a day's paste.
 *
 * The same function runs in the browser to draw the preview and on the server
 * to decide what may be written, so what the screen promises and what the
 * action allows cannot drift apart.
 *
 * Two pools move. A dispatch takes from **outstanding** — approved but not yet
 * sent — and puts the units into **in progress**. A delivery or a return takes
 * from in progress. Rows are walked in the order they were pasted, so a SKU
 * dispatched on one line and delivered on the next sees its own dispatch.
 */
import type { SettlementCsvRow } from "@/lib/settlements-csv";

export type PoolLine = {
  sku: string;
  qty: number;
  /** Total value of the pool, used to price a slice of it. */
  value: number;
};

export type SimRow = {
  row: SettlementCsvRow;
  /** The pool this row draws from, before and after. */
  pool: "outstanding" | "in progress";
  before: number;
  after: number;
  /** In progress before and after, for every kind — a dispatch adds to it. */
  progressBefore: number;
  progressAfter: number;
  /** What the row is worth at the pool's average cost, or null when unpriced. */
  value: number | null;
  problem: string | null;
};

export type Simulation = {
  rows: SimRow[];
  blocked: number;
  dispatchedValue: number;
  deliveredValue: number;
  returnedValue: number;
};

function unitCostOf(qty: number, value: number): number | null {
  if (qty <= 0) return null;
  return value / qty;
}

export function simulateDaily(
  rows: SettlementCsvRow[],
  outstanding: PoolLine[],
  inProgress: PoolLine[],
): Simulation {
  const out = new Map(outstanding.map((line) => [line.sku, line.qty]));
  const outValue = new Map(outstanding.map((line) => [line.sku, line.value]));
  const prog = new Map(inProgress.map((line) => [line.sku, line.qty]));
  const progValue = new Map(inProgress.map((line) => [line.sku, line.value]));

  const known = new Set([...out.keys(), ...prog.keys()]);

  let dispatchedValue = 0;
  let deliveredValue = 0;
  let returnedValue = 0;

  const simulated = rows.map<SimRow>((row) => {
    const progressBefore = prog.get(row.sku) ?? 0;

    if (row.kind === "dispatched") {
      const before = out.get(row.sku) ?? 0;
      const after = before - row.qty;
      const each = unitCostOf(before, outValue.get(row.sku) ?? 0);
      const value = each === null ? null : each * row.qty;

      let problem: string | null = null;
      if (!known.has(row.sku)) problem = "SKU not found";
      else if (before === 0) problem = "Nothing outstanding to dispatch";
      else if (after < 0) {
        problem = `Only ${before.toLocaleString("en-US")} outstanding, not ${row.qty.toLocaleString("en-US")}`;
      }

      if (!problem) {
        out.set(row.sku, after);
        outValue.set(
          row.sku,
          (outValue.get(row.sku) ?? 0) - (value ?? 0),
        );
        // Dispatched units land in progress at the cost they carried.
        prog.set(row.sku, progressBefore + row.qty);
        progValue.set(
          row.sku,
          (progValue.get(row.sku) ?? 0) + (value ?? 0),
        );
        dispatchedValue += value ?? 0;
      }

      return {
        row,
        pool: "outstanding",
        before,
        after,
        progressBefore,
        progressAfter: problem ? progressBefore : progressBefore + row.qty,
        value,
        problem,
      };
    }

    const before = progressBefore;
    const after = before - row.qty;
    const each = unitCostOf(before, progValue.get(row.sku) ?? 0);
    const value = each === null ? null : each * row.qty;

    let problem: string | null = null;
    if (!known.has(row.sku)) problem = "SKU not found";
    else if (before === 0) problem = "Nothing in progress for this SKU";
    else if (after < 0) {
      problem = `Only ${before.toLocaleString("en-US")} in progress, not ${row.qty.toLocaleString("en-US")}`;
    }

    if (!problem) {
      prog.set(row.sku, after);
      progValue.set(row.sku, (progValue.get(row.sku) ?? 0) - (value ?? 0));
      if (row.kind === "delivered") deliveredValue += value ?? 0;
      else returnedValue += value ?? 0;
    }

    return {
      row,
      pool: "in progress",
      before,
      after,
      progressBefore,
      progressAfter: problem ? progressBefore : after,
      value,
      problem,
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

/**
 * Splits a dispatch across approved requests, oldest first.
 *
 * `record_stock_movements` books a dispatch against exactly one request, so a
 * row bigger than the oldest one becomes several movement rows.
 */
export function allocateDispatch(
  qty: number,
  requests: { id: string; outstanding: number }[],
): { id: string; qty: number }[] {
  const slices: { id: string; qty: number }[] = [];
  let left = qty;

  for (const request of requests) {
    if (left <= 0) break;
    const take = Math.min(left, request.outstanding);
    if (take <= 0) continue;
    slices.push({ id: request.id, qty: take });
    left -= take;
  }

  return left > 0 ? [] : slices;
}
