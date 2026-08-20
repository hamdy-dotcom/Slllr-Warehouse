/**
 * CSV for bulk movements: `sku,qty,kind,reference,note`.
 *
 * Direction is not a column — it comes from which form the supplier is in, so
 * a file of inbound rows cannot quietly contain an outbound one. Dispatches to
 * Sllr are not here at all: they are allocated against approved requests on
 * the daily update screen.
 */
import { foldArabic } from "@/lib/arabic";
import {
  KINDS_BY_DIRECTION,
  isMovementKind,
  type Direction,
  type MovementKind,
} from "@/lib/movements";

export type MovementCsvRow = {
  sku: string;
  qty: number;
  kind: MovementKind;
  reference?: string;
  note?: string;
};

export type MovementCsvProblem = {
  line: number;
  key: string;
  params?: Record<string, string | number>;
};

export type MovementCsvParse = {
  rows: MovementCsvRow[];
  problems: MovementCsvProblem[];
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

const HEADERS: Record<string, keyof MovementCsvRow> = {
  sku: "sku",
  qty: "qty",
  quantity: "qty",
  units: "qty",
  kind: "kind",
  reason: "kind",
  reference: "reference",
  ref: "reference",
  note: "note",
  notes: "note",
  // Arabic headers, as the template downloads them.
  رمز_المنتج: "sku",
  رمز: "sku",
  الكميه: "qty",
  النوع: "kind",
  المرجع: "reference",
  ملاحظه: "note",
};

/** Arabic words for each kind, so a translated template reads back in. */
const KIND_ALIASES: Record<string, MovementKind> = {
  شراء: "purchase",
  ارجاع_للمورد: "return",
  ارجاع: "return",
  مرتجع: "return",
  تصحيح: "correction",
  بيع_لجهه_اخري: "sale_other",
  بيع_اخر: "sale_other",
  تلف: "damage",
  تالف: "damage",
};

export function parseMovementCsv(
  text: string,
  direction: Direction,
): MovementCsvParse {
  const lines = text
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const rows: MovementCsvRow[] = [];
  const problems: MovementCsvProblem[] = [];
  if (lines.length === 0) return { rows, problems };

  const first = splitLine(lines[0]).map(foldArabic);
  const hasHeader = first.some((cell) => cell in HEADERS);

  const index = hasHeader
    ? {
        sku: first.findIndex((c) => HEADERS[c] === "sku"),
        qty: first.findIndex((c) => HEADERS[c] === "qty"),
        kind: first.findIndex((c) => HEADERS[c] === "kind"),
        reference: first.findIndex((c) => HEADERS[c] === "reference"),
        note: first.findIndex((c) => HEADERS[c] === "note"),
      }
    : { sku: 0, qty: 1, kind: 2, reference: 3, note: 4 };

  if (hasHeader && (index.sku === -1 || index.qty === -1)) {
    problems.push({
      line: 1,
      key: "headerQty",
    });
    return { rows, problems };
  }

  const allowed = KINDS_BY_DIRECTION[direction];

  const body = hasHeader ? lines.slice(1) : lines;
  const offset = hasHeader ? 2 : 1;

  body.forEach((line, i) => {
    const lineNumber = i + offset;
    const cells = splitLine(line);
    const at = (n: number) => (n === -1 ? "" : (cells[n] ?? "").trim());

    const sku = at(index.sku);
    if (!sku) {
      problems.push({ line: lineNumber, key: "noSku" });
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

    const folded = foldArabic(at(index.kind));
    const kind = folded === "" ? allowed[0] : (KIND_ALIASES[folded] ?? folded);

    if (!isMovementKind(kind) || !allowed.includes(kind)) {
      problems.push({
        line: lineNumber,
        key: "badKind",
        params: { sku, value: at(index.kind), kinds: allowed.join(", ") },
      });
      return;
    }

    const reference = at(index.reference);
    const note = at(index.note);

    rows.push({
      sku,
      qty,
      kind,
      ...(reference ? { reference } : {}),
      ...(note ? { note } : {}),
    });
  });

  return { rows, problems };
}

export type MovementCsvHeaders = {
  sku: string;
  qty: string;
  kind: string;
  reference: string;
  note: string;
};

/**
 * The template downloads in the reader's own language, headers and kind alike.
 * Both spellings parse back, so a file written in one locale still uploads in
 * the other.
 */
export function movementCsvTemplate(
  direction: Direction,
  headers: MovementCsvHeaders,
  kindWord: string,
): string {
  const header = [
    headers.sku,
    headers.qty,
    headers.kind,
    headers.reference,
    headers.note,
  ].join(",");
  return [header, `SKU-1001,120,${kindWord},PO-4821,`].join("\n");
}
