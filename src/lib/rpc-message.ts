import "server-only";

import { getTranslations } from "next-intl/server";

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
 *                            `A release to Sllr needs a request_id`
 *   record_settlements       `SKU not found`
 *                            `Only 3 units are in progress for this SKU`
 */
export type RpcTranslator = (message: string) => string;

const PATTERNS: {
  test: RegExp;
  key: string;
  params?: (match: RegExpMatchArray) => Record<string, string>;
}[] = [
  {
    test: /^SKU not found, or it belongs to another supplier$/,
    key: "skuNotFoundOrOther",
  },
  { test: /^SKU not found$/, key: "skuNotFound" },
  {
    test: /^([\d,]+) → ([\d,]+)$/,
    key: "qtyMoved",
    params: (m) => ({ before: m[1], after: m[2] }),
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
      if (match) return t(pattern.key, pattern.params?.(match) ?? {});
    }
    return message;
  };
}
