"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useState, useTransition } from "react";

import { ProductMini } from "@/components/product-thumb";
import { Progress, StackedProgress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import { formatDate, n } from "@/lib/format";
import { money } from "@/lib/money";
import {
  poStatusKey,
  poShares,
  type Po,
  type PoSettlementEntry,
  type PoSort,
  type SortDir,
} from "@/lib/po";

const STATUS_STYLE: Record<string, string> = {
  "awaiting transfer": "bg-neutral-soft text-ink-2",
  "part arrived": "bg-amber-soft text-amber-ink",
  "in warehouse": "bg-green-soft text-green",
  dispatched: "bg-orange-soft text-orange-ink",
  settled: "bg-green-soft text-green",
  cancelled: "bg-red-soft text-orange-ink",
};

const TH =
  "px-[10px] pb-[10px] text-start text-th font-normal uppercase tracking-[0.4px] text-ink-2";
const TD = "border-t border-line px-[10px] py-[11px] align-middle";
const HTH =
  "px-[10px] pb-[8px] text-start text-th font-normal uppercase tracking-[0.4px] text-ink-2";
const HTD = "border-t border-line px-[10px] py-[8px] align-middle";

const COLUMNS: {
  sort: PoSort;
  key: string;
  numeric?: boolean;
  /** Extra explanation on the header, where the word carries a definition. */
  titleKey?: string;
}[] = [
  { sort: "date", key: "colDate" },
  { sort: "product", key: "colProduct" },
  { sort: "ref", key: "colRef" },
  { sort: "approved", key: "colApproved", numeric: true },
  { sort: "value", key: "colValue", numeric: true },
  {
    sort: "awaiting_transfer",
    key: "colAwaitingTransfer",
    numeric: true,
    titleKey: "colArrivedTitle",
  },
  { sort: "in_warehouse", key: "colInWarehouse", numeric: true },
  { sort: "out_for_delivery", key: "colOutForDelivery", numeric: true },
  { sort: "delivered", key: "colDelivered", numeric: true },
  { sort: "cancelled", key: "colCancelled", numeric: true },
  { sort: "status", key: "colStatus" },
];

/**
 * One row per PO.
 *
 * Every quantity carries its money underneath rather than in a column of its
 * own — ten separate value columns would not fit, and a quantity and what it
 * is worth are one fact read together.
 *
 * `q1`, `q2` … is the PO's real place in its product's queue, straight from
 * the view. It stays on the row under every sort, because re-sorting the
 * table changes what is on screen and nothing about the order the RPCs will
 * consume these POs in.
 */
export function PoTable({
  pos,
  history,
  sort,
  dir,
  locale,
}: {
  pos: Po[];
  history: Record<string, PoSettlementEntry[]>;
  sort: PoSort;
  dir: SortDir;
  /** Dates are formatted here, so the table needs the page's locale. */
  locale: string;
}) {
  const t = useTranslations("po");
  const tc = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState<string | null>(null);

  function sortBy(next: PoSort) {
    const params = new URLSearchParams(searchParams);
    const flip = sort === next && dir === "asc" ? "desc" : "asc";
    params.set("po_sort", next);
    if (flip === "desc") params.set("po_dir", "desc");
    else params.delete("po_dir");

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="scroll-x">
      <table className="w-full border-collapse text-body">
        <thead>
          <tr>
            {COLUMNS.map((column) => {
              const active = sort === column.sort;
              return (
                <th
                  key={column.sort}
                  scope="col"
                  aria-sort={
                    active
                      ? dir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className={cn(TH, column.numeric && "text-end")}
                >
                  <button
                    type="button"
                    onClick={() => sortBy(column.sort)}
                    title={
                      column.titleKey
                        ? t(column.titleKey)
                        : t("sortBy", { column: t(column.key) })
                    }
                    className={cn(
                      "inline-flex items-center gap-[4px] uppercase tracking-[0.4px] transition-colors hover:text-ink",
                      active && "font-medium text-ink",
                    )}
                  >
                    {t(column.key)}
                    {active ? (
                      <span aria-hidden>{dir === "asc" ? "↑" : "↓"}</span>
                    ) : null}
                  </button>
                </th>
              );
            })}
            <th className={TH}>
              <span className="sr-only">{tc("actions")}</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {pos.map((po) => {
            const entries = history[po.po_id] ?? [];
            const expanded = open === po.po_id;

            return (
              <Fragment key={po.po_id}>
                <tr>
                  <td className={`${TD} rounded-s-[14px] text-label text-ink-2`}>
                    {formatDate(po.po_date.slice(0, 10), locale)}
                  </td>

                  <td className={TD}>
                    <div className="flex items-center gap-[10px]">
                      <ProductMini src={po.image_url} alt={po.product_name} />
                      <div className="min-w-0">
                        <div className="font-medium">{po.product_name}</div>
                        <div className="latin font-mono text-meta text-ink-3">
                          {po.sku}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className={TD}>
                    <div className="flex items-center gap-[6px]">
                      <span className="latin font-mono text-meta">
                        {po.po_ref}
                      </span>
                      <span
                        title={t("queueTitle", {
                          position: po.queue_position,
                        })}
                        className="rounded-pill bg-tint px-[7px] py-[2px] text-meta text-ink-2"
                      >
                        {t("queueBadge", { position: po.queue_position })}
                      </span>
                    </div>
                  </td>

                  <td className={`${TD} text-end tabular-nums`}>
                    <b className="font-medium">{n(po.qty_approved)}</b>
                  </td>

                  <td className={`${TD} text-end tabular-nums`}>
                    <b className="font-medium">{money(po.po_value)}</b>
                    {po.qty_cancelled > 0 ? (
                      <div className="text-meta text-orange-ink">
                        {t("cancelledNote", { qty: n(po.qty_cancelled) })}
                      </div>
                    ) : null}
                  </td>

                  <Journey po={po} />
                  <Qty
                    qty={po.qty_in_warehouse}
                    value={po.in_warehouse_value}
                  />
                  <Qty
                    qty={po.qty_out_for_delivery}
                    value={po.out_for_delivery_value}
                  />
                  <Qty
                    qty={po.qty_delivered}
                    value={po.delivered_value}
                    pct={po.pct_delivered}
                    tone="green"
                  />
                  <Qty qty={po.qty_cancelled} value={po.cancelled_value} />

                  <td className={TD}>
                    <span
                      className={cn(
                        "inline-block rounded-pill px-[10px] py-[4px] text-meta",
                        STATUS_STYLE[po.po_status] ??
                          "bg-neutral-soft text-ink-2",
                      )}
                    >
                      {/* An unknown literal shows itself rather than a
                          broken lookup. */}
                      {poStatusKey(po.po_status)
                        ? t(poStatusKey(po.po_status) as string)
                        : po.po_status}
                    </span>
                  </td>

                  <td className={`${TD} rounded-e-[14px] text-end`}>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setOpen(expanded ? null : po.po_id)}
                      title={
                        expanded
                          ? t("hideHistory", { ref: po.po_ref })
                          : t("showHistory", { ref: po.po_ref })
                      }
                      className="grid size-7 place-items-center rounded-full bg-tint text-[12px] text-ink-2 transition-colors hover:text-ink"
                    >
                      <span aria-hidden>{expanded ? "−" : "+"}</span>
                      <span className="sr-only">
                        {expanded
                          ? t("hideHistory", { ref: po.po_ref })
                          : t("showHistory", { ref: po.po_ref })}
                      </span>
                    </button>
                  </td>
                </tr>

                {expanded ? (
                  <tr>
                    <td colSpan={COLUMNS.length + 1} className="px-[10px] pb-3">
                      <div className="rounded-card bg-card-soft p-[13px]">
                        <div className="mb-2 text-label font-medium">
                          {t("history")}
                        </div>
                        {entries.length === 0 ? (
                          <p className="text-label text-ink-3">
                            {t("historyEmpty")}
                          </p>
                        ) : (
                          <table className="w-full border-collapse text-body">
                            <thead>
                              <tr>
                                <th className={HTH}>{tc("date")}</th>
                                <th className={HTH}>{tc("kind")}</th>
                                <th className={`${HTH} text-end`}>
                                  {tc("qty")}
                                </th>
                                <th className={`${HTH} text-end`}>
                                  {tc("value")}
                                </th>
                                <th className={HTH}>{tc("reference")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entries.map((entry) => (
                                <tr key={entry.id}>
                                  <td className={`${HTD} text-label`}>
                                    {formatDate(entry.occurred_on, locale)}
                                  </td>
                                  <td className={HTD}>
                                    <span
                                      className={cn(
                                        "inline-block rounded-pill px-[10px] py-[4px] text-meta",
                                        entry.kind === "delivered"
                                          ? "bg-green-soft text-green"
                                          : "bg-amber-soft text-amber-ink",
                                      )}
                                    >
                                      {entry.kind === "delivered"
                                        ? t("kindDelivered")
                                        : t("kindReturned")}
                                    </span>
                                  </td>
                                  <td className={`${HTD} text-end tabular-nums`}>
                                    {n(entry.qty)}
                                  </td>
                                  <td className={`${HTD} text-end tabular-nums`}>
                                    {money(entry.value)}
                                  </td>
                                  <td className={`${HTD} text-label text-ink-2`}>
                                    {entry.reference ? (
                                      <span className="latin font-mono text-meta">
                                        {entry.reference}
                                      </span>
                                    ) : (
                                      <span className="text-ink-3">
                                        {tc("dash")}
                                      </span>
                                    )}
                                    {entry.note ? (
                                      <div className="text-meta text-ink-3">
                                        {entry.note}
                                      </div>
                                    ) : null}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The awaiting-transfer cell, and the PO's whole journey underneath it.
 *
 * The number is what the supplier still has to move. The bar is every stage
 * the approved quantity is spread across — awaiting transfer, in the Riyadh
 * warehouse, out for delivery, delivered, and a muted share for anything
 * released back — so it always fills exactly and the reader can see where a
 * PO has got to without reading five columns.
 *
 * A return is not a segment: those units are back in Riyadh and are already
 * counted under in warehouse.
 */
function Journey({ po }: { po: Po }) {
  const share = poShares(po);

  return (
    <td className={`${TD} text-end tabular-nums`}>
      {po.qty_awaiting_transfer === 0 ? (
        <span className="text-ink-3">—</span>
      ) : (
        <>
          <b className="font-medium">{n(po.qty_awaiting_transfer)}</b>
          <div className="text-meta text-ink-3">
            {money(po.awaiting_transfer_value)}
          </div>
        </>
      )}
      <StackedProgress
        className="mt-[4px] h-[4px]"
        segments={[
          { pct: share.inWarehousePct, tone: "green" },
          { pct: share.outForDeliveryPct, tone: "orange" },
          { pct: share.deliveredPct, tone: "amber" },
          { pct: share.cancelledPct, tone: "muted" },
        ]}
      />
    </td>
  );
}

/**
 * A quantity, with its share of the PO and what it is worth underneath.
 *
 * The percentage sits on the second line rather than beside the number: at
 * this density `15` and `38%` a few pixels apart read as one figure.
 */
function Qty({
  qty,
  value,
  pct,
  tone,
}: {
  qty: number;
  value: number;
  pct?: number;
  tone?: "orange" | "green";
}) {
  return (
    <td className={`${TD} text-end tabular-nums`}>
      {qty === 0 ? (
        <span className="text-ink-3">—</span>
      ) : (
        <>
          <b className="font-medium">{n(qty)}</b>
          <div className="text-meta text-ink-3">
            {pct === undefined ? null : <>{Math.round(pct)}% · </>}
            {money(value)}
          </div>
          {pct === undefined ? null : (
            <Progress pct={pct} tone={tone} className="mt-[4px] h-[4px]" />
          )}
        </>
      )}
    </td>
  );
}
