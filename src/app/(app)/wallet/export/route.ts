import ExcelJS from "exceljs";
import { getLocale, getTranslations } from "next-intl/server";
import type { NextRequest } from "next/server";

import { requireProfile } from "@/lib/auth";
import { listAllPos, listPos, poSettlementHistory } from "@/lib/data/po";
import { dirOf } from "@/i18n/config";
import { CURRENCY } from "@/lib/money";
import {
  DEFAULT_SORT,
  isPoSort,
  isPoStatus,
  poStatusKey,
  type Po,
  type PoFilter,
} from "@/lib/po";

/**
 * The PO table as a real workbook.
 *
 * A CSV would be simpler and wrong: Arabic in a CSV depends on the reader
 * guessing UTF-8 and gives up any column direction, and the numbers arrive as
 * text. This writes .xlsx so the sheet carries its own direction, the amounts
 * are numbers Karim can sum, and the totals row is a formula that survives him
 * editing a cell.
 *
 * It lives under /wallet so the middleware's own role gate covers it: the
 * section is `/wallet`, which both roles may open. Scoping past that is the
 * view's — `po_settlement` is security_invoker, so a supplier's export can
 * only contain a supplier's own POs.
 */

const MONEY = `"${CURRENCY}" #,##0`;
const MONEY_FINE = `"${CURRENCY}" #,##0.00`;
const QTY = "#,##0";
const DATE = "dd mmm yyyy";

/** Excel wants a date, not an instant: a timestamp would shift by zone. */
function excelDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

type Column = {
  header: string;
  width: number;
  /** Numeric columns get a SUM in the totals row. */
  sum?: boolean;
  format?: string;
};

export async function GET(request: NextRequest) {
  const profile = await requireProfile();
  const params = request.nextUrl.searchParams;

  const [locale, t, tc] = await Promise.all([
    getLocale(),
    getTranslations("po"),
    getTranslations("common"),
  ]);

  const statusParam = params.get("po_status") ?? undefined;
  const filter: PoFilter = {
    status: isPoStatus(statusParam) ? statusParam : undefined,
    supplierId: params.get("po_supplier") || undefined,
    q: params.get("po_q") || undefined,
  };

  const sortParam = params.get("po_sort") ?? undefined;
  const sort = isPoSort(sortParam) ? sortParam : DEFAULT_SORT;
  const dir = params.get("po_dir") === "desc" ? "desc" : "asc";

  const [all, history] = await Promise.all([
    listAllPos(profile),
    poSettlementHistory(profile),
  ]);

  const rows = listPos(all, filter, sort, dir);
  const rtl = dirOf(locale) === "rtl";

  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  // ---- Sheet 1: one row per PO, in the table's own order ----------------
  const posSheet = workbook.addWorksheet(t("export.sheetPos"), {
    views: [{ rightToLeft: rtl, state: "frozen", ySplit: 2 }],
  });

  const columns: Column[] = [
    { header: t("export.date"), width: 14, format: DATE },
    { header: t("export.ref"), width: 14 },
    { header: t("export.queue"), width: 10, format: QTY },
    { header: t("export.product"), width: 26 },
    { header: t("export.sku"), width: 12 },
    { header: t("export.unitCost"), width: 14, format: MONEY_FINE },
    { header: t("export.approvedQty"), width: 14, sum: true, format: QTY },
    { header: t("export.poValue"), width: 16, sum: true, format: MONEY },
    { header: t("export.dispatchedQty"), width: 16, sum: true, format: QTY },
    { header: t("export.dispatchedValue"), width: 18, sum: true, format: MONEY },
    { header: t("export.deliveredQty"), width: 15, sum: true, format: QTY },
    { header: t("export.deliveredValue"), width: 17, sum: true, format: MONEY },
    { header: t("export.returnedQty"), width: 15, sum: true, format: QTY },
    { header: t("export.outstandingQty"), width: 16, sum: true, format: QTY },
    { header: t("export.outstandingValue"), width: 18, sum: true, format: MONEY },
    { header: t("export.cancelledQty"), width: 15, sum: true, format: QTY },
    { header: t("export.status"), width: 18 },
  ];

  const statusLabel = (po: Po) => {
    const key = poStatusKey(po.po_status);
    return key ? t(key) : po.po_status;
  };

  writeMeta(posSheet, columns.length, metaLine());
  writeHeader(posSheet, columns);

  for (const po of rows) {
    posSheet.addRow([
      excelDate(po.po_date),
      po.po_ref,
      po.queue_position,
      po.product_name,
      po.sku,
      po.unit_cost,
      po.qty_approved,
      po.po_value,
      po.qty_in_progress,
      po.in_progress_value,
      po.qty_delivered,
      po.delivered_value,
      po.qty_returned,
      po.qty_outstanding,
      po.outstanding_value,
      po.qty_cancelled,
      statusLabel(po),
    ]);
  }

  finishSheet(posSheet, columns, rows.length, t("export.totals"));

  // ---- Sheet 2: the settlements behind those POs ------------------------
  const settleSheet = workbook.addWorksheet(t("export.sheetSettlements"), {
    views: [{ rightToLeft: rtl, state: "frozen", ySplit: 2 }],
  });

  const settleColumns: Column[] = [
    { header: t("export.date"), width: 14, format: DATE },
    { header: t("export.ref"), width: 14 },
    { header: t("export.product"), width: 26 },
    { header: t("export.sku"), width: 12 },
    { header: t("export.kind"), width: 14 },
    { header: t("export.qty"), width: 10, sum: true, format: QTY },
    { header: t("export.unitCost"), width: 14, format: MONEY_FINE },
    { header: t("export.value"), width: 16, sum: true, format: MONEY },
    { header: t("export.reference"), width: 16 },
  ];

  writeMeta(settleSheet, settleColumns.length, metaLine());
  writeHeader(settleSheet, settleColumns);

  // Only the POs on sheet one, so the two sheets always agree.
  const entries = rows.flatMap((po) =>
    (history.get(po.po_id) ?? []).map((entry) => ({ po, entry })),
  );

  for (const { po, entry } of entries) {
    settleSheet.addRow([
      excelDate(entry.occurred_on),
      po.po_ref,
      po.product_name,
      po.sku,
      entry.kind === "delivered" ? t("kindDelivered") : t("kindReturned"),
      entry.qty,
      entry.unit_cost,
      entry.value,
      entry.reference ?? "",
    ]);
  }

  finishSheet(settleSheet, settleColumns, entries.length, t("export.totals"));

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": disposition(filename(), asciiName()),
      "Cache-Control": "no-store",
    },
  });

  /** Supplier, filters and when — repeated on both sheets. */
  function metaLine(): string {
    const supplier = filter.supplierId
      ? (all.find((po) => po.supplier_id === filter.supplierId)
          ?.supplier_name ?? t("export.allSuppliers"))
      : profile.supplier_name ?? t("export.allSuppliers");

    const applied = [
      filter.status
        ? t("export.filterStatus", { status: statusText(filter.status) })
        : null,
      filter.q ? t("export.filterSearch", { q: filter.q }) : null,
    ].filter(Boolean);

    return t("export.meta", {
      supplier,
      filters: applied.length > 0 ? applied.join(tc("listSep")) : t("export.noFilters"),
      when: new Date().toISOString().slice(0, 16).replace("T", " "),
    });
  }

  function statusText(status: string): string {
    const key = poStatusKey(status);
    return key ? t(key) : status;
  }

  /** The same name with a Latin base, for the ASCII fallback. */
  function asciiName(): string {
    return ["POs", filter.status, filter.q, new Date().toISOString().slice(0, 10)]
      .filter(Boolean)
      .join("-")
      .replace(/\s+/g, "-");
  }

  function filename(): string {
    const parts = [
      t("export.filename"),
      filter.supplierId
        ? all.find((po) => po.supplier_id === filter.supplierId)?.supplier_name
        : profile.supplier_name,
      filter.status,
      filter.q,
      new Date().toISOString().slice(0, 10),
    ].filter(Boolean) as string[];

    return `${parts.join("-").replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "-")}.xlsx`;
  }
}

/**
 * Names the file twice: UTF-8 for the Arabic name, and an ASCII fallback for
 * anything that only reads the old parameter. The fallback drops non-ASCII
 * runs rather than replacing each character with an underscore, which turned
 * an Arabic name into a row of them.
 */
function disposition(name: string, fallback: string): string {
  const ascii =
    fallback
      .replace(/[^\x20-\x7E]+/g, "")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "") || "POs";

  return [
    "attachment",
    `filename="${ascii}.xlsx"`,
    `filename*=UTF-8''${encodeURIComponent(name)}`,
  ].join("; ");
}

/** A row of provenance above the headers, merged across the sheet. */
function writeMeta(
  sheet: ExcelJS.Worksheet,
  width: number,
  text: string,
): void {
  const row = sheet.addRow([text]);
  sheet.mergeCells(1, 1, 1, width);
  row.font = { size: 10, color: { argb: "FF6B6560" } };
  row.height = 18;
}

function writeHeader(sheet: ExcelJS.Worksheet, columns: Column[]): void {
  const row = sheet.addRow(columns.map((column) => column.header));
  row.font = { bold: true };
  row.alignment = { vertical: "middle", wrapText: true };
  row.height = 26;

  columns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = column.width;
    if (column.format) sheet.getColumn(index + 1).numFmt = column.format;
  });

  // A column format applies to every cell in it, the two text rows above the
  // data included. Put those back, or a header sits under a currency mask.
  for (const n of [1, 2]) {
    const above = sheet.getRow(n);
    for (let c = 1; c <= columns.length; c++) above.getCell(c).numFmt = "General";
  }
}

/**
 * Autofilter, and a totals row of SUM formulas rather than numbers, so the
 * sheet still adds up after someone edits a cell.
 */
function finishSheet(
  sheet: ExcelJS.Worksheet,
  columns: Column[],
  count: number,
  totalsLabel: string,
): void {
  const first = 3;
  const last = first + count - 1;

  sheet.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: Math.max(last, 2), column: columns.length },
  };

  if (count === 0) return;

  const totals = columns.map((column, index) => {
    if (index === 0) return totalsLabel;
    if (!column.sum) return null;
    const letter = sheet.getColumn(index + 1).letter;
    return { formula: `SUM(${letter}${first}:${letter}${last})` };
  });

  const row = sheet.addRow(totals);
  row.font = { bold: true };
  row.getCell(1).numFmt = "General";
  row.border = { top: { style: "thin" } };
}
