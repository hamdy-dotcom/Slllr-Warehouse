/**
 * Money is SAR throughout. Costs are stored as `numeric(12,2)`, which
 * PostgREST hands back as a JS number, so everything here works in whole
 * riyals and halalas rather than a minor-unit integer.
 */

export const CURRENCY = "SAR";

const unitFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const totalFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** A per-unit price, to the halala: `SAR 8.50`. */
export function unitCost(cost: number | null | undefined): string {
  if (cost === null || cost === undefined) return "—";
  return unitFormat.format(cost);
}

/** A rolled-up amount, to the riyal: `SAR 12,400`. */
export function money(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return totalFormat.format(amount);
}

/**
 * `qty x cost`, or null when there is nothing to report — either the product
 * has no cost, or no units are involved.
 *
 * Zero units is not "SAR 0", it is "nothing reserved", and rendering a real
 * amount there reads as a priced line worth nothing. A negative quantity is
 * kept, because oversold stock has a real negative value.
 */
export function lineValue(
  qty: number,
  cost: number | null | undefined,
): number | null {
  if (cost === null || cost === undefined) return null;
  if (qty === 0) return null;
  return qty * cost;
}

/**
 * A rolled-up value and how much of the shelf it could not account for.
 *
 * `priced` and `unpriced` are counts of rows, so a screen can say "SAR 12,400
 * across 96 SKUs, 4 not priced" rather than quietly understating the total.
 */
export type ValueRoll = {
  total: number;
  priced: number;
  unpriced: number;
};

export function rollValue<T>(
  rows: T[],
  qtyOf: (row: T) => number,
  costOf: (row: T) => number | null | undefined,
): ValueRoll {
  return rows.reduce<ValueRoll>(
    (acc, row) => {
      const cost = costOf(row);

      if (cost === null || cost === undefined) {
        return { ...acc, unpriced: acc.unpriced + 1 };
      }

      return {
        total: acc.total + qtyOf(row) * cost,
        priced: acc.priced + 1,
        unpriced: acc.unpriced,
      };
    },
    { total: 0, priced: 0, unpriced: 0 },
  );
}

/**
 * How many rows a value could not account for, or null when it accounted for
 * all of them. The caveat a screen prints from it is a translated string, so
 * the count is what crosses out of here.
 */
export function unpricedCount(roll: ValueRoll): number | null {
  return roll.unpriced === 0 ? null : roll.unpriced;
}

/**
 * Parses a cost typed into a form. Blank means "not priced", which is a valid
 * state, so it comes back as null rather than an error.
 */
export function parseCost(raw: string): number | null | "invalid" {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return "invalid";

  // numeric(12,2) — anything finer is rounded on the way in anyway.
  return Math.round(value * 100) / 100;
}
