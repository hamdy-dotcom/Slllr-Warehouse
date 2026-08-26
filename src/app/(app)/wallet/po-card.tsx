"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import { n } from "@/lib/format";
import { money, unitCost } from "@/lib/money";
import {
  PO_STATUS_KEYS,
  type Po,
  type PoSettlementEntry,
} from "@/lib/po";

const STATUS_STYLE: Record<string, string> = {
  "awaiting dispatch": "bg-neutral-soft text-ink-2",
  "part dispatched": "bg-amber-soft text-amber-ink",
  "in progress": "bg-orange-soft text-orange-ink",
  settled: "bg-green-soft text-green",
};

const TH =
  "px-[10px] pb-[8px] text-start text-th font-normal uppercase tracking-[0.4px] text-ink-2";
const TD = "border-t border-line px-[10px] py-[9px] align-middle";

/**
 * One PO in its product's queue.
 *
 * Two bars, because they answer different questions and routinely disagree: a
 * PO can be fully dispatched and only half settled, and the gap between them
 * is exactly what is in progress — units Sllr holds but has not confirmed.
 */
export function PoCard({
  po,
  position,
  head,
  history,
  formattedDate,
}: {
  po: Po;
  /** 1-based place in this product's queue. */
  position: number;
  /** Whether this PO is the next one a dispatch or a delivery will touch. */
  head: { dispatch: boolean; settle: boolean };
  history: (PoSettlementEntry & { formatted_on: string })[];
  /** Rendered on the server so the date reads in the page's locale. */
  formattedDate: string;
}) {
  const t = useTranslations("po");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="rounded-card bg-card-soft p-[14px]">
      <div className="flex flex-wrap items-start justify-between gap-[10px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-[8px]">
            <span className="latin font-mono text-product font-medium">
              {po.po_ref}
            </span>
            <span
              className={cn(
                "inline-block rounded-pill px-[10px] py-[4px] text-meta",
                STATUS_STYLE[po.po_status] ?? "bg-neutral-soft text-ink-2",
              )}
            >
              {t(PO_STATUS_KEYS[po.po_status])}
            </span>
            {head.settle ? (
              <span className="rounded-pill bg-orange px-[10px] py-[4px] text-meta text-white">
                {t("nextToSettle")}
              </span>
            ) : head.dispatch ? (
              <span className="rounded-pill bg-tint px-[10px] py-[4px] text-meta text-ink-2">
                {t("nextToDispatch")}
              </span>
            ) : null}
          </div>
          <div className="mt-[3px] text-label text-ink-2">
            {formattedDate} · {t("queuePosition", { position })}
          </div>
        </div>

        <div className="text-end">
          <div className="text-product font-medium tabular-nums">
            {money(po.po_value)}
          </div>
          <div className="text-meta text-ink-3">
            {po.unit_cost === null
              ? t("notPriced")
              : t("perUnit", { cost: unitCost(po.unit_cost) })}
          </div>
        </div>
      </div>

      <div className="mt-[12px] grid gap-[10px] sm:grid-cols-2">
        <div>
          <div className="mb-[5px] flex items-baseline justify-between text-th text-ink-2">
            <span>{t("dispatched")}</span>
            <b className="font-medium tabular-nums text-ink">
              {Math.round(po.pct_dispatched)}%
            </b>
          </div>
          <Progress pct={po.pct_dispatched} tone="orange" />
          <div className="mt-[5px] text-meta text-ink-3">
            {t("ofApproved", {
              done: n(po.qty_dispatched),
              total: n(po.qty_approved),
            })}
          </div>
        </div>

        <div>
          <div className="mb-[5px] flex items-baseline justify-between text-th text-ink-2">
            <span>{t("settled")}</span>
            <b className="font-medium tabular-nums text-ink">
              {Math.round(po.pct_settled)}%
            </b>
          </div>
          <Progress pct={po.pct_settled} tone="green" />
          <div className="mt-[5px] text-meta text-ink-3">
            {t("settledBreakdown", {
              delivered: n(po.qty_delivered),
              returned: n(po.qty_returned),
              inProgress: n(po.qty_in_progress),
            })}
          </div>
        </div>
      </div>

      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((was) => !was)}
        className="mt-[10px] text-label text-ink-2 underline-offset-2 transition-colors hover:text-ink hover:underline"
      >
        {open
          ? t("hideHistory", { ref: po.po_ref })
          : t("showHistory", { ref: po.po_ref })}
      </button>

      {open ? (
        <div id={panelId} className="mt-[10px]">
          {history.length === 0 ? (
            <p className="text-label text-ink-3">{t("historyEmpty")}</p>
          ) : (
            <div className="scroll-x">
              <table className="w-full border-collapse text-body">
                <thead>
                  <tr>
                    <th className={TH}>{tc("date")}</th>
                    <th className={TH}>{tc("kind")}</th>
                    <th className={TH}>{tc("qty")}</th>
                    <th className={TH}>{tc("value")}</th>
                    <th className={TH}>{tc("reference")}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr key={entry.id}>
                      <td className={`${TD} text-label`}>
                        {entry.formatted_on}
                      </td>
                      <td className={TD}>
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
                      <td className={`${TD} tabular-nums`}>{n(entry.qty)}</td>
                      <td className={`${TD} tabular-nums`}>
                        {money(entry.value)}
                      </td>
                      <td className={`${TD} text-label text-ink-2`}>
                        {entry.reference ? (
                          <span className="latin font-mono text-meta">
                            {entry.reference}
                          </span>
                        ) : (
                          <span className="text-ink-3">{tc("dash")}</span>
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
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
