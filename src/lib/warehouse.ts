/**
 * The physical shelf: 8 lines of 14 bins. Everything here is derived from
 * `products.warehouse_code` — nothing about the layout is stored.
 */
import type { ProductStock } from "@/lib/types";

export const LINES = 8;
export const BINS_PER_LINE = 14;
export const TOTAL_BINS = LINES * BINS_PER_LINE;

/** `L03-R02-B07` → line 3, rack 2, bin 7. */
export function parseWarehouseCode(
  code: string,
): { line: number; rack: number; bin: number } | null {
  const match = /^L(\d{2})-R(\d{2})-B(\d{2})$/.exec(code.trim().toUpperCase());
  if (!match) return null;

  const [, line, rack, bin] = match;
  return { line: Number(line), rack: Number(rack), bin: Number(bin) };
}

/**
 * `bin-empty` for an unoccupied or healthy bin, amber at or below a quarter
 * free, orange once free stock is gone.
 */
export type BinTone = "empty" | "neutral" | "low" | "heavy";

export type Bin = {
  line: number;
  bin: number;
  /** Stable key, e.g. `L03-B07`. A bin spans racks. */
  key: string;
  products: ProductStock[];
  totalQty: number;
  freeQty: number;
  tone: BinTone;
};

function toneFor(totalQty: number, freeQty: number, occupied: boolean): BinTone {
  if (!occupied) return "empty";
  if (freeQty <= 0) return "heavy";
  if (totalQty > 0 && freeQty / totalQty <= 0.25) return "low";
  return "neutral";
}

export function binKey(line: number, bin: number): string {
  return `L${String(line).padStart(2, "0")}-B${String(bin).padStart(2, "0")}`;
}

/**
 * The full grid, line by line. A bin can hold more than one product — the code
 * carries a rack the grid does not model — so products are kept as a list.
 */
export function buildGrid(products: ProductStock[]): Bin[][] {
  const byBin = new Map<string, ProductStock[]>();

  for (const product of products) {
    const parsed = parseWarehouseCode(product.warehouse_code);
    if (!parsed) continue;
    if (parsed.line < 1 || parsed.line > LINES) continue;
    if (parsed.bin < 1 || parsed.bin > BINS_PER_LINE) continue;

    const key = binKey(parsed.line, parsed.bin);
    const existing = byBin.get(key);
    if (existing) existing.push(product);
    else byBin.set(key, [product]);
  }

  return Array.from({ length: LINES }, (_, lineIndex) => {
    const line = lineIndex + 1;

    return Array.from({ length: BINS_PER_LINE }, (_, binIndex) => {
      const bin = binIndex + 1;
      const key = binKey(line, bin);
      const inBin = byBin.get(key) ?? [];

      const totalQty = inBin.reduce((sum, p) => sum + p.total_qty, 0);
      const freeQty = inBin.reduce((sum, p) => sum + p.free_qty, 0);

      return {
        line,
        bin,
        key,
        products: inBin,
        totalQty,
        freeQty,
        tone: toneFor(totalQty, freeQty, inBin.length > 0),
      };
    });
  });
}

/** How many bins carry at least one product. */
export function occupiedCount(grid: Bin[][]): number {
  return grid.flat().filter((bin) => bin.products.length > 0).length;
}

/**
 * Products whose code falls outside the 8 × 14 grid. They exist in the data
 * but have nowhere to sit, so the page says so rather than dropping them.
 */
export function offGrid(products: ProductStock[]): ProductStock[] {
  return products.filter((product) => {
    const parsed = parseWarehouseCode(product.warehouse_code);
    if (!parsed) return true;
    return (
      parsed.line < 1 ||
      parsed.line > LINES ||
      parsed.bin < 1 ||
      parsed.bin > BINS_PER_LINE
    );
  });
}
