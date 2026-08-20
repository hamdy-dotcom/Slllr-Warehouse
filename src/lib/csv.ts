/**
 * Just enough CSV for the bulk stock update:
 * `sku,total_qty,warehouse_code,unit_cost` with the last two optional.
 * Handles quoted fields and CRLF, which is what a spreadsheet export produces.
 *
 * A blank `unit_cost` cell leaves the price alone; typing `-` clears it back
 * to not priced, because an empty cell cannot mean both things.
 */

import { foldArabic } from "@/lib/arabic";
import { parseCost } from "@/lib/money";

export type CsvRow = {
  sku: string;
  total_qty: number;
  warehouse_code?: string;
  /** number sets a price, null clears it, undefined leaves it as it was. */
  unit_cost?: number | null;
};

/**
 * A problem names a message rather than carrying one. The parsers are pure and
 * shared by both locales, so the copy is resolved where it is rendered.
 */
export type CsvProblem = {
  line: number;
  key: string;
  params?: Record<string, string | number>;
};

export type CsvParse = { rows: CsvRow[]; problems: CsvProblem[] };

/** Splits one line, respecting `"quoted, fields"` and `""` escapes. */
function splitLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ",") {
      cells.push(cell);
      cell = "";
    } else cell += char;
  }

  cells.push(cell);
  return cells.map((value) => value.trim());
}

const HEADER_ALIASES: Record<string, keyof CsvRow> = {
  sku: "sku",
  total_qty: "total_qty",
  "total qty": "total_qty",
  total: "total_qty",
  qty: "total_qty",
  warehouse_code: "warehouse_code",
  "warehouse code": "warehouse_code",
  code: "warehouse_code",
  unit_cost: "unit_cost",
  "unit cost": "unit_cost",
  cost: "unit_cost",
  price: "unit_cost",
  // Arabic headers, as the template downloads them.
  رمز_المنتج: "sku",
  رمز: "sku",
  الكميه_الاجماليه: "total_qty",
  الكميه: "total_qty",
  الاجمالي: "total_qty",
  موقع_المستودع: "warehouse_code",
  الموقع: "warehouse_code",
  تكلفه_الوحده: "unit_cost",
  التكلفه: "unit_cost",
  السعر: "unit_cost",
};

export function parseStockCsv(text: string): CsvParse {
  const lines = text
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const rows: CsvRow[] = [];
  const problems: CsvProblem[] = [];

  if (lines.length === 0) return { rows, problems };

  // A header is optional; without one the order is sku, total_qty, code.
  const first = splitLine(lines[0]).map(foldArabic);
  const looksLikeHeader = first.some((cell) => cell in HEADER_ALIASES);

  let index: {
    sku: number;
    total_qty: number;
    warehouse_code: number;
    unit_cost: number;
  };

  if (looksLikeHeader) {
    const find = (field: keyof CsvRow) =>
      first.findIndex((cell) => HEADER_ALIASES[cell] === field);
    index = {
      sku: find("sku"),
      total_qty: find("total_qty"),
      warehouse_code: find("warehouse_code"),
      unit_cost: find("unit_cost"),
    };

    if (index.sku === -1 || index.total_qty === -1) {
      problems.push({
        line: 1,
        key: "headerStock",
      });
      return { rows, problems };
    }
  } else {
    index = { sku: 0, total_qty: 1, warehouse_code: 2, unit_cost: 3 };
  }

  const body = looksLikeHeader ? lines.slice(1) : lines;
  const offset = looksLikeHeader ? 2 : 1;
  const seen = new Set<string>();

  body.forEach((line, i) => {
    const lineNumber = i + offset;
    const cells = splitLine(line);

    const sku = (cells[index.sku] ?? "").trim();
    const rawQty = (cells[index.total_qty] ?? "").trim();
    const code =
      index.warehouse_code === -1
        ? ""
        : (cells[index.warehouse_code] ?? "").trim().toUpperCase();
    const rawCost =
      index.unit_cost === -1 ? "" : (cells[index.unit_cost] ?? "").trim();

    if (!sku) {
      problems.push({ line: lineNumber, key: "noSku" });
      return;
    }

    if (seen.has(sku)) {
      problems.push({
        line: lineNumber,
        key: "duplicate",
        params: { sku },
      });
      return;
    }

    const total_qty = Number(rawQty);
    if (rawQty === "" || !Number.isInteger(total_qty) || total_qty < 0) {
      problems.push({
        line: lineNumber,
        key: "qtyWhole",
        params: { sku, value: rawQty },
      });
      return;
    }

    let unit_cost: number | null | undefined;

    if (rawCost === "-") {
      unit_cost = null;
    } else if (rawCost !== "") {
      const parsed = parseCost(rawCost);
      if (parsed === "invalid") {
        problems.push({
          line: lineNumber,
          key: "costValue",
          params: { sku, value: rawCost },
        });
        return;
      }
      unit_cost = parsed;
    }

    seen.add(sku);

    const row: CsvRow = { sku, total_qty };
    if (code) row.warehouse_code = code;
    if (unit_cost !== undefined) row.unit_cost = unit_cost;
    rows.push(row);
  });

  return { rows, problems };
}

/** Quotes a cell only when it would otherwise break the row. */
function cell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export type StockCsvHeaders = {
  sku: string;
  total_qty: string;
  warehouse_code: string;
  unit_cost: string;
};

export function toStockCsv(
  headers: StockCsvHeaders,
  products: {
    sku: string;
    total_qty: number;
    warehouse_code: string;
    /** Omitted until the cost migration has been run. */
    unit_cost?: number | null;
  }[],
): string {
  const header = [
    headers.sku,
    headers.total_qty,
    headers.warehouse_code,
    headers.unit_cost,
  ].join(",");
  const body = products.map((product) =>
    [
      cell(product.sku),
      product.total_qty,
      cell(product.warehouse_code),
      product.unit_cost ?? "",
    ].join(","),
  );
  return [header, ...body].join("\n");
}
