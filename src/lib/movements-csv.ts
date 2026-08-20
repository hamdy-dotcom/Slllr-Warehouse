/**
 * CSV for bulk movements: `sku,qty,kind,reference,note`.
 *
 * Direction is not a column — it comes from which form the supplier is in, so
 * a file of inbound rows cannot quietly contain an outbound one. Releases to
 * Sllr are not accepted here either: each one has to name an approved request,
 * which is a per-row choice a spreadsheet cannot make.
 */
import {
  KINDS_BY_DIRECTION,
  KIND_LABELS,
  RELEASE_KIND,
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

export type MovementCsvProblem = { line: number; message: string };

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

  const first = splitLine(lines[0]).map((cell) => cell.toLowerCase());
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
      message: "The header needs a sku column and a qty column.",
    });
    return { rows, problems };
  }

  const allowed = KINDS_BY_DIRECTION[direction].filter(
    (kind) => kind !== RELEASE_KIND,
  );

  const body = hasHeader ? lines.slice(1) : lines;
  const offset = hasHeader ? 2 : 1;

  body.forEach((line, i) => {
    const lineNumber = i + offset;
    const cells = splitLine(line);
    const at = (n: number) => (n === -1 ? "" : (cells[n] ?? "").trim());

    const sku = at(index.sku);
    if (!sku) {
      problems.push({ line: lineNumber, message: "No SKU on this line." });
      return;
    }

    const qty = Number(at(index.qty));
    if (!Number.isInteger(qty) || qty < 1) {
      problems.push({
        line: lineNumber,
        message: `${sku} needs a whole quantity of at least 1, not "${at(index.qty)}".`,
      });
      return;
    }

    const rawKind = at(index.kind)
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    const kind = rawKind === "" ? allowed[0] : rawKind;

    if (!isMovementKind(kind) || !allowed.includes(kind)) {
      problems.push({
        line: lineNumber,
        message: `${sku}: "${at(index.kind)}" is not one of ${allowed
          .map((k) => KIND_LABELS[k].toLowerCase())
          .join(", ")}.`,
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

export function movementCsvTemplate(direction: Direction): string {
  const kind = KINDS_BY_DIRECTION[direction].filter(
    (k) => k !== RELEASE_KIND,
  )[0];
  return ["sku,qty,kind,reference,note", `SKU-1001,120,${kind},PO-4821,`].join(
    "\n",
  );
}
