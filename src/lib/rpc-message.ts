import "server-only";

import { getTranslations } from "next-intl/server";

import { money } from "@/lib/money";

/**
 * The per-row `message` a stock RPC hands back.
 *
 * Those strings are written in the database in English, and they are shown to
 * the reader rather than logged, so each known shape is matched here and
 * re-rendered from the catalogue. Anything unrecognised falls through
 * untouched: a message the reader can quote back is more useful than a wrong
 * translation, and a new one shows up as English rather than as nothing.
 *
 * The shapes come from the live functions, probed directly:
 *   bulk_update_stock        `SKU not found, or it belongs to another supplier`
 *                            `478 → 500`
 *                            `Cannot go below the 76 units still reserved…`
 *   record_stock_movements   `SKU not found`
 *                            `Would leave 0 units, below the 76 reserved…`
 *                            `1637 → 1137, across 2 POs`
 *   record_arrivals          `arrived partially, 30 of 100 units`
 *                            `arrived in full, 70 units`
 *                            `Only 70 units are awaiting transfer on this PO`
 *                            `PO not found`
 *   bulk_create_products     `added, 12 units`
 *                            `This SKU already exists — use the bulk stock…`
 *                            `Warehouse code must look like L03-R02-B07`
 *                            `Name, SKU, and warehouse code are all required`
 *   release_reserved_qty     `released 30 units back across 2 POs`
 *                            `Only 15 units are still reserved on this product`
 *   record_settlements       `SKU not found`
 *                            `Only 3 units are in progress for this SKU`
 *                            `delivered 100 units, SAR 25925.00`
 *
 * Amounts are re-rendered through `money()` rather than passed through, so a
 * figure the RPC wrote as `SAR 25925.00` reads the way every other amount on
 * the screen does.
 */
export type RpcTranslator = (message: string) => string;

type Params = Record<string, string | number>;

const PATTERNS: {
  test: RegExp;
  key: string;
  params?: (match: RegExpMatchArray, t: (key: string) => string) => Params;
}[] = [
  {
    test: /^SKU not found, or it belongs to another supplier$/,
    key: "skuNotFoundOrOther",
  },
  { test: /^SKU not found$/, key: "skuNotFound" },
  {
    test: /^([\d,]+) → ([\d,]+), across (\d+) POs?$/,
    key: "qtyMovedAcross",
    params: (m) => ({ before: m[1], after: m[2], count: Number(m[3]) }),
  },
  {
    test: /^([\d,]+) → ([\d,]+)$/,
    key: "qtyMoved",
    params: (m) => ({ before: m[1], after: m[2] }),
  },
  {
    test: /^(delivered|returned) ([\d,]+) units?, SAR ([\d,.]+)$/,
    key: "settledUnits",
    params: (m, t) => ({
      kind: t(m[1] === "delivered" ? "wordDelivered" : "wordReturned"),
      count: m[2],
      value: money(Number(m[3].replace(/,/g, ""))),
    }),
  },
  {
    test: /^Cannot go below the ([\d,]+) units still reserved for Sllr$/,
    key: "cannotGoBelow",
    params: (m) => ({ reserved: m[1] }),
  },
  {
    test: /^Would leave ([\d,]+) units, below the ([\d,]+) reserved for Sllr$/,
    key: "wouldLeave",
    params: (m) => ({ left: m[1], reserved: m[2] }),
  },
  { test: /request_id/, key: "needsRequest" },
  {
    test: /^arrived partially, ([\d,]+) of ([\d,]+) units?$/,
    key: "arrivedPartially",
    params: (m) => ({ count: m[1], total: m[2] }),
  },
  {
    test: /^arrived in full, ([\d,]+) units?$/,
    key: "arrivedInFull",
    params: (m) => ({ count: m[1] }),
  },
  {
    test: /^Only ([\d,]+) units are awaiting transfer on this PO$/,
    key: "onlyAwaitingTransfer",
    params: (m) => ({ available: m[1] }),
  },
  {
    test: /^PO not found$/,
    key: "poNotFound",
  },
  {
    test: /^Only ([\d,]+) units are in the Riyadh warehouse for this product$/,
    key: "onlyInWarehouse",
    params: (m) => ({ available: m[1] }),
  },
  {
    test: /^dispatched ([\d,]+) units? across (\d+) POs?$/,
    key: "dispatchedAcrossPos",
    params: (m) => ({ count: m[1], pos: Number(m[2]) }),
  },
  {
    test: /^Not allowed$/,
    key: "notAllowed",
  },
  {
    test: /^added, ([\d,]+) units?$/,
    key: "productAdded",
    params: (m) => ({ count: m[1] }),
  },
  {
    test: /^This SKU already exists/,
    key: "skuExists",
  },
  {
    test: /^Warehouse code must look like/,
    key: "badWarehouseCode",
  },
  {
    test: /^Name, SKU, and warehouse code are all required$/,
    key: "productFieldsRequired",
  },
  {
    test: /^released ([\d,]+) units back across (\d+) POs?$/,
    key: "releasedAcross",
    params: (m) => ({ count: m[1], pos: Number(m[2]) }),
  },
  {
    test: /^Only ([\d,]+) units are still reserved on this product$/,
    key: "onlyReserved",
    params: (m) => ({ available: m[1] }),
  },
  {
    test: /^Only ([\d,]+) units are in progress for this SKU$/,
    key: "onlyInProgress",
    params: (m) => ({ available: m[1] }),
  },
];

/** Builds the mapper once per action, since fetching messages is async. */
export async function rpcTranslator(): Promise<RpcTranslator> {
  const t = await getTranslations("rpc");

  return (message: string) => {
    for (const pattern of PATTERNS) {
      const match = message.match(pattern.test);
      if (match) return t(pattern.key, pattern.params?.(match, t) ?? {});
    }
    return message;
  };
}
