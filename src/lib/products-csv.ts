/**
 * CSV for creating products in bulk:
 * `sku,name,warehouse_code,total_qty,unit_cost,image_url`.
 *
 * Only the first three are required. `total_qty` defaults to 0 — a supplier
 * often lists a product before the stock arrives — and cost and image are
 * optional, the same as adding one product by hand.
 *
 * Nothing here decides whether a row may be written. `bulk_create_products`
 * re-checks all of it and owns the rule that a SKU which already exists is
 * refused rather than overwritten. This runs so the preview can show a
 * problem before anyone sends a paste, not instead of that.
 */

import { foldArabic } from "@/lib/arabic";
import { parseCost } from "@/lib/money";

/** `L03-R02-B07` — the same shape `bulk_create_products` enforces. */
const WAREHOUSE_CODE = /^L\d{2}-R\d{2}-B\d{2}$/;

export type ProductCsvRow = {
  sku: string;
  name: string;
  warehouse_code: string;
  total_qty: number;
  unit_cost?: number | null;
  image_url?: string;
};

export type ProductCsvProblem = {
  line: number;
  key: string;
  params?: Record<string, string | number>;
};

export type ProductCsvParse = {
  rows: ProductCsvRow[];
  problems: ProductCsvProblem[];
};

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

const HEADERS: Record<string, keyof ProductCsvRow> = {
  sku: "sku",
  name: "name",
  product: "name",
  product_name: "name",
  warehouse_code: "warehouse_code",
  code: "warehouse_code",
  location: "warehouse_code",
  total_qty: "total_qty",
  total: "total_qty",
  qty: "total_qty",
  quantity: "total_qty",
  units: "total_qty",
  unit_cost: "unit_cost",
  cost: "unit_cost",
  price: "unit_cost",
  image_url: "image_url",
  image: "image_url",
  // Arabic headers, as the template downloads them.
  رمز_المنتج: "sku",
  رمز: "sku",
  الاسم: "name",
  اسم_المنتج: "name",
  موقع_المستودع: "warehouse_code",
  الموقع: "warehouse_code",
  الكميه_الاجماليه: "total_qty",
  الكميه: "total_qty",
  الاجمالي: "total_qty",
  تكلفه_الوحده: "unit_cost",
  التكلفه: "unit_cost",
  السعر: "unit_cost",
  رابط_الصوره: "image_url",
  الصوره: "image_url",
};

export function parseProductCsv(text: string): ProductCsvParse {
  const lines = text
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const rows: ProductCsvRow[] = [];
  const problems: ProductCsvProblem[] = [];
  if (lines.length === 0) return { rows, problems };

  const first = splitLine(lines[0]).map(foldArabic);
  const hasHeader = first.some((cell) => cell in HEADERS);

  const find = (field: keyof ProductCsvRow) =>
    first.findIndex((cell) => HEADERS[cell] === field);

  const index = hasHeader
    ? {
        sku: find("sku"),
        name: find("name"),
        warehouse_code: find("warehouse_code"),
        total_qty: find("total_qty"),
        unit_cost: find("unit_cost"),
        image_url: find("image_url"),
      }
    : {
        sku: 0,
        name: 1,
        warehouse_code: 2,
        total_qty: 3,
        unit_cost: 4,
        image_url: 5,
      };

  if (
    hasHeader &&
    (index.sku === -1 || index.name === -1 || index.warehouse_code === -1)
  ) {
    problems.push({ line: 1, key: "headerCreate" });
    return { rows, problems };
  }

  const body = hasHeader ? lines.slice(1) : lines;
  const offset = hasHeader ? 2 : 1;
  const seen = new Set<string>();

  body.forEach((line, i) => {
    const lineNumber = i + offset;
    const cells = splitLine(line);
    const at = (nth: number) => (nth === -1 ? "" : (cells[nth] ?? "").trim());

    const sku = at(index.sku);
    if (!sku) {
      problems.push({ line: lineNumber, key: "noSku" });
      return;
    }

    if (seen.has(sku)) {
      problems.push({ line: lineNumber, key: "duplicate", params: { sku } });
      return;
    }

    const name = at(index.name);
    if (!name) {
      problems.push({ line: lineNumber, key: "noName", params: { sku } });
      return;
    }

    // Uppercased before it is checked, so l03-r02-b07 is a typo and not a
    // rejection — the same courtesy the single add form gives.
    const warehouse_code = at(index.warehouse_code).toUpperCase();
    if (!WAREHOUSE_CODE.test(warehouse_code)) {
      problems.push({
        line: lineNumber,
        key: "badCode",
        params: { sku, value: at(index.warehouse_code) || "—" },
      });
      return;
    }

    const rawQty = at(index.total_qty);
    const total_qty = rawQty === "" ? 0 : Number(rawQty);
    if (!Number.isInteger(total_qty) || total_qty < 0) {
      problems.push({
        line: lineNumber,
        key: "qtyWhole",
        params: { sku, value: rawQty },
      });
      return;
    }

    const rawCost = at(index.unit_cost);
    const parsed = parseCost(rawCost);
    if (parsed === "invalid") {
      problems.push({
        line: lineNumber,
        key: "costValue",
        params: { sku, value: rawCost },
      });
      return;
    }

    const image_url = at(index.image_url);
    seen.add(sku);

    rows.push({
      sku,
      name,
      warehouse_code,
      total_qty,
      ...(parsed === null ? {} : { unit_cost: parsed }),
      ...(image_url ? { image_url } : {}),
    });
  });

  return { rows, problems };
}

export type ProductCsvHeaders = {
  sku: string;
  name: string;
  warehouse_code: string;
  total_qty: string;
  unit_cost: string;
  image_url: string;
};

/**
 * The template downloads in the reader's own language. Both spellings parse
 * back, so a file written in one locale still uploads in the other.
 */
export function productCsvTemplate(headers: ProductCsvHeaders): string {
  return [
    [
      headers.sku,
      headers.name,
      headers.warehouse_code,
      headers.total_qty,
      headers.unit_cost,
      headers.image_url,
    ].join(","),
    "SKU-9001,Cordless kettle 1.7L,L03-R02-B07,500,69.25,",
  ].join("\n");
}
