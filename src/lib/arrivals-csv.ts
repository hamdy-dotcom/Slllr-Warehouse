/**
 * CSV for recording arrivals in bulk: `po_ref,qty,arrived_on,reference`.
 *
 * A `po_id` works in place of a `po_ref` — a warehouse operator pasting from
 * another system may have either, and the two never collide: a ref is
 * `PO-` plus hex, an id is a uuid.
 *
 * Nothing here decides what may be written. `record_arrivals` caps each row at
 * what is still awaiting transfer on that PO. This runs so the preview can
 * name a PO before anything is sent.
 */

import { foldArabic } from "@/lib/arabic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type ArrivalCsvRow = {
  /** As typed: resolved to a po_id against the queue by the caller. */
  ref: string;
  qty: number;
  arrived_on: string;
  reference?: string;
};

export type ArrivalCsvProblem = {
  line: number;
  key: string;
  params?: Record<string, string | number>;
};

export type ArrivalCsvParse = {
  rows: ArrivalCsvRow[];
  problems: ArrivalCsvProblem[];
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
        } else quoted = false;
      } else cell += char;
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

const HEADERS: Record<string, keyof ArrivalCsvRow> = {
  po_ref: "ref",
  po: "ref",
  po_id: "ref",
  ref: "ref",
  qty: "qty",
  quantity: "qty",
  units: "qty",
  arrived_on: "arrived_on",
  date: "arrived_on",
  reference: "reference",
  // Arabic headers, as the template downloads them.
  رقم_امر_الشراء: "ref",
  امر_الشراء: "ref",
  الكميه: "qty",
  تاريخ_الوصول: "arrived_on",
  التاريخ: "arrived_on",
  المرجع: "reference",
};

export function parseArrivalCsv(
  text: string,
  defaultDate: string,
): ArrivalCsvParse {
  const lines = text
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const rows: ArrivalCsvRow[] = [];
  const problems: ArrivalCsvProblem[] = [];
  if (lines.length === 0) return { rows, problems };

  const first = splitLine(lines[0]).map(foldArabic);
  const hasHeader = first.some((cell) => cell in HEADERS);

  const find = (field: keyof ArrivalCsvRow) =>
    first.findIndex((cell) => HEADERS[cell] === field);

  const index = hasHeader
    ? {
        ref: find("ref"),
        qty: find("qty"),
        arrived_on: find("arrived_on"),
        reference: find("reference"),
      }
    : { ref: 0, qty: 1, arrived_on: 2, reference: 3 };

  if (hasHeader && (index.ref === -1 || index.qty === -1)) {
    problems.push({ line: 1, key: "headerArrivals" });
    return { rows, problems };
  }

  const body = hasHeader ? lines.slice(1) : lines;
  const offset = hasHeader ? 2 : 1;
  const seen = new Set<string>();

  body.forEach((line, i) => {
    const lineNumber = i + offset;
    const cells = splitLine(line);
    const at = (nth: number) => (nth === -1 ? "" : (cells[nth] ?? "").trim());

    const ref = at(index.ref);
    if (!ref) {
      problems.push({ line: lineNumber, key: "noPoRef" });
      return;
    }

    // One row per PO: two arrivals on the same PO in one paste should be one
    // line, or the preview cannot show a single before and after.
    if (seen.has(ref)) {
      problems.push({ line: lineNumber, key: "duplicate", params: { sku: ref } });
      return;
    }

    const qty = Number(at(index.qty));
    if (!Number.isInteger(qty) || qty < 1) {
      problems.push({
        line: lineNumber,
        key: "qtyAtLeastOne",
        params: { sku: ref, value: at(index.qty) },
      });
      return;
    }

    const rawDate = at(index.arrived_on);
    if (rawDate !== "" && !ISO_DATE.test(rawDate)) {
      problems.push({
        line: lineNumber,
        key: "badDate",
        params: { sku: ref, value: rawDate },
      });
      return;
    }

    const reference = at(index.reference);
    seen.add(ref);

    rows.push({
      ref,
      qty,
      arrived_on: rawDate || defaultDate,
      ...(reference ? { reference } : {}),
    });
  });

  return { rows, problems };
}

export type ArrivalCsvHeaders = {
  po_ref: string;
  qty: string;
  arrived_on: string;
  reference: string;
};

export function arrivalCsvTemplate(
  headers: ArrivalCsvHeaders,
  date: string,
  exampleRef: string,
): string {
  return [
    [headers.po_ref, headers.qty, headers.arrived_on, headers.reference].join(","),
    `${exampleRef},30,${date},TRF-1`,
  ].join("\n");
}
