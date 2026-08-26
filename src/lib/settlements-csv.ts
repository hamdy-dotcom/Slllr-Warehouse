/**
 * CSV for a day of stock movement: `sku,kind,qty,occurred_on,reference`.
 *
 * `kind` is dispatched, delivered, or returned. A dispatch sends units off the
 * shelf against an approved request; delivered and returned settle units that
 * were dispatched earlier. `occurred_on` defaults to the date the caller
 * passes, which is normally yesterday.
 */

import { foldArabic } from "@/lib/arabic";

/** What lands in `settlements.kind`. A dispatch is a movement, not a settlement. */
export type SettlementKind = "delivered" | "returned";

/** Every kind a daily row can carry. */
export type DailyKind = "dispatched" | SettlementKind;

export const DAILY_KINDS: DailyKind[] = ["dispatched", "delivered", "returned"];

export type SettlementCsvRow = {
  sku: string;
  kind: DailyKind;
  qty: number;
  occurred_on: string;
  reference?: string;
};

export type SettlementCsvProblem = {
  line: number;
  key: string;
  params?: Record<string, string | number>;
};

export type SettlementCsvParse = {
  rows: SettlementCsvRow[];
  problems: SettlementCsvProblem[];
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function splitLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") { cells.push(cell); cell = ""; }
    else cell += char;
  }

  cells.push(cell);
  return cells.map((value) => value.trim());
}

const HEADERS: Record<string, keyof SettlementCsvRow> = {
  sku: "sku",
  kind: "kind",
  type: "kind",
  qty: "qty",
  quantity: "qty",
  units: "qty",
  occurred_on: "occurred_on",
  "occurred on": "occurred_on",
  date: "occurred_on",
  day: "occurred_on",
  reference: "reference",
  ref: "reference",
  // Arabic headers, as the template downloads them.
  رمز_المنتج: "sku",
  رمز: "sku",
  النوع: "kind",
  الكميه: "qty",
  التاريخ: "occurred_on",
  المرجع: "reference",
};

const KIND_ALIASES: Record<string, DailyKind> = {
  dispatched: "dispatched",
  dispatch: "dispatched",
  // The old word, so a file written before the rename still reads.
  released: "dispatched",
  release: "dispatched",
  delivered: "delivered",
  delivery: "delivered",
  deliver: "delivered",
  sold: "delivered",
  returned: "returned",
  return: "returned",
  // Arabic, so a hand-typed file reads back in. The stock lifecycle moved
  // from the ص-ر-ف root to إرسال — مصروف now means money paid to a supplier —
  // but the old spellings stay accepted so a file written before the change
  // still uploads.
  مرسل: "dispatched",
  ارسال: "dispatched",
  مصروف: "dispatched",
  صرف: "dispatched",
  مسلم: "delivered",
  تسليم: "delivered",
  مرتجع: "returned",
  ارجاع: "returned",
};

export function parseSettlementCsv(
  text: string,
  defaultDate: string,
): SettlementCsvParse {
  const lines = text
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const rows: SettlementCsvRow[] = [];
  const problems: SettlementCsvProblem[] = [];
  if (lines.length === 0) return { rows, problems };

  const first = splitLine(lines[0]).map(foldArabic);
  const hasHeader = first.some((cell) => cell in HEADERS);

  const index = hasHeader
    ? {
        sku: first.findIndex((c) => HEADERS[c] === "sku"),
        kind: first.findIndex((c) => HEADERS[c] === "kind"),
        qty: first.findIndex((c) => HEADERS[c] === "qty"),
        occurred_on: first.findIndex((c) => HEADERS[c] === "occurred_on"),
        reference: first.findIndex((c) => HEADERS[c] === "reference"),
      }
    : { sku: 0, kind: 1, qty: 2, occurred_on: 3, reference: 4 };

  if (hasHeader && (index.sku === -1 || index.qty === -1)) {
    problems.push({
      line: 1,
      key: "headerQty",
    });
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

    const rawKind = foldArabic(at(index.kind));
    const kind = rawKind === "" ? "delivered" : KIND_ALIASES[rawKind];
    if (!kind) {
      problems.push({
        line: lineNumber,
        key: "badSettlementKind",
        params: { sku, value: at(index.kind) },
      });
      return;
    }

    // One row per SKU and kind — two deliveries of the same SKU on one day
    // should be one line, or the preview cannot show a single before/after.
    const key = `${sku}::${kind}`;
    if (seen.has(key)) {
      problems.push({
        line: lineNumber,
        key: "duplicateKind",
        params: { sku, kind },
      });
      return;
    }

    const qty = Number(at(index.qty));
    if (!Number.isInteger(qty) || qty < 1) {
      problems.push({
        line: lineNumber,
        key: "qtyAtLeastOne",
        params: { sku, value: at(index.qty) },
      });
      return;
    }

    const rawDate = at(index.occurred_on);
    if (rawDate !== "" && !ISO_DATE.test(rawDate)) {
      problems.push({
        line: lineNumber,
        key: "badDate",
        params: { sku, value: rawDate },
      });
      return;
    }

    const reference = at(index.reference);
    seen.add(key);

    rows.push({
      sku,
      kind,
      qty,
      occurred_on: rawDate || defaultDate,
      ...(reference ? { reference } : {}),
    });
  });

  return { rows, problems };
}

export type SettlementCsvHeaders = {
  sku: string;
  kind: string;
  qty: string;
  occurred_on: string;
  reference: string;
};

/**
 * The template downloads in the reader's own language, headers and kinds
 * alike. Both spellings parse back, so a file written in one locale still
 * uploads in the other.
 */
export function settlementCsvTemplate(
  date: string,
  headers: SettlementCsvHeaders,
  kindWords: Record<DailyKind, string>,
): string {
  const header = [
    headers.sku,
    headers.kind,
    headers.qty,
    headers.occurred_on,
    headers.reference,
  ].join(",");

  return [
    header,
    `SKU-1001,${kindWords.dispatched},40,${date},DO-5510`,
    `SKU-1001,${kindWords.delivered},12,${date},INV-2201`,
    `SKU-1002,${kindWords.returned},3,${date},RET-118`,
  ].join("\n");
}
