"use client";

import { useLocale, useTranslations } from "next-intl";
import { Fragment, useState } from "react";

import { ProductMini } from "@/components/product-thumb";
import { Empty } from "@/components/ui/card";
import { Pill } from "@/components/ui/tag";
import type { ArrivalEdit, ArrivalRow } from "@/lib/arrivals";
import { cn } from "@/lib/cn";
import { formatDate, n, relativeTime } from "@/lib/format";
import { money } from "@/lib/money";
import { AmendButton } from "./amend-dialog";

const TH =
  "px-[10px] pb-[10px] text-start text-th font-normal uppercase tracking-[0.4px] text-ink-2";
const TD = "border-t border-line px-[10px] py-[12px] align-middle";

/**
 * What has actually arrived, newest first, with each row's corrections folded
 * underneath it.
 *
 * The history is on the row rather than behind a link because the reason a
 * number changed is part of reading the number. Voided rows stay in place,
 * struck through: an arrival that never happened is still something the
 * warehouse recorded, and hiding it would make the ledger unexplainable.
 */
export function RecordedArrivals({
  rows,
  edits,
  canEdit,
  emptyMessage,
}: {
  rows: ArrivalRow[];
  edits: Record<string, ArrivalEdit[]>;
  canEdit: boolean;
  emptyMessage: string;
}) {
  const t = useTranslations("arrivals");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [open, setOpen] = useState<string | null>(null);

  if (rows.length === 0) return <Empty>{emptyMessage}</Empty>;

  return (
    <div className="scroll-x">
      <table className="w-full border-collapse text-body">
        <thead>
          <tr>
            <th className={TH}>{tc("date")}</th>
            <th className={TH}>{tc("product")}</th>
            <th className={TH}>{t("colReference")}</th>
            <th className={`${TH} text-end`}>{t("colQty")}</th>
            <th className={`${TH} text-end`}>{t("colValue")}</th>
            <th className={TH}>{t("colReceivedBy")}</th>
            <th className={TH}>
              <span className="sr-only">{tc("actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const history = edits[row.arrival_id] ?? [];
            const expanded = open === row.arrival_id;

            return (
              <Fragment key={row.arrival_id}>
                <tr>
                  <td
                    className={`${TD} rounded-s-[14px] text-label text-ink-2`}
                  >
                    {formatDate(row.arrived_on, locale)}
                  </td>

                  <td className={TD}>
                    <div className="flex items-center gap-[10px]">
                      <ProductMini src={row.image_url} alt={row.product_name} />
                      <div className="min-w-0">
                        <div
                          className={cn(
                            "font-medium",
                            row.voided && "text-ink-3 line-through",
                          )}
                        >
                          {row.product_name}
                        </div>
                        <div className="latin font-mono text-meta text-ink-3">
                          {row.sku} · {row.po_ref}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className={`${TD} text-label text-ink-2`}>
                    {row.reference ? (
                      <span className="latin font-mono text-meta">
                        {row.reference}
                      </span>
                    ) : (
                      <span className="text-ink-3">{tc("dash")}</span>
                    )}
                  </td>

                  <td
                    className={cn(
                      TD,
                      "text-end tabular-nums",
                      row.voided ? "text-ink-3 line-through" : "font-medium",
                    )}
                  >
                    {n(row.qty)}
                  </td>

                  <td
                    className={cn(
                      TD,
                      "text-end tabular-nums",
                      row.voided && "text-ink-3 line-through",
                    )}
                  >
                    {money(row.value)}
                  </td>

                  <td className={`${TD} text-label text-ink-2`}>
                    {row.received_by_name ?? (
                      <span className="text-ink-3">{t("unknownEditor")}</span>
                    )}
                  </td>

                  <td className={`${TD} rounded-e-[14px]`}>
                    <div className="flex flex-wrap items-center justify-end gap-[9px]">
                      {row.voided ? (
                        <Pill tone="warn">{t("voided")}</Pill>
                      ) : null}

                      {row.edited_count > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setOpen(expanded ? null : row.arrival_id)
                          }
                          aria-expanded={expanded}
                          className="rounded-pill bg-amber-soft px-[10px] py-[4px] text-meta text-amber-ink"
                        >
                          {t("editedBadge", { count: row.edited_count })}
                        </button>
                      ) : null}

                      {canEdit && !row.voided ? (
                        <AmendButton row={row} />
                      ) : null}
                    </div>
                  </td>
                </tr>

                {expanded ? (
                  <tr>
                    <td colSpan={7} className="px-[10px] pb-[14px]">
                      <div className="rounded-[14px] bg-tint p-[14px]">
                        <div className="mb-[10px] text-label text-ink-2">
                          {t("history")}
                        </div>

                        {row.voided ? (
                          <p className="mb-[10px] text-meta text-ink-2">
                            {t("voidedNote")}
                          </p>
                        ) : null}

                        {history.length === 0 ? (
                          <p className="text-meta text-ink-3">
                            {t("historyEmpty")}
                          </p>
                        ) : (
                          <ol className="space-y-[10px]">
                            {history.map((edit) => (
                              <li key={edit.id} className="text-label">
                                <div className="flex flex-wrap items-baseline gap-[8px]">
                                  <b className="font-medium tabular-nums">
                                    {n(edit.old_qty)}
                                    <span
                                      aria-hidden
                                      className="mx-[6px] text-ink-3"
                                    >
                                      {tc("arrow")}
                                    </span>
                                    {n(edit.new_qty)}
                                  </b>
                                  <span
                                    className={cn(
                                      "tabular-nums text-meta",
                                      edit.delta < 0
                                        ? "text-orange"
                                        : "text-green",
                                    )}
                                  >
                                    {edit.delta > 0 ? "+" : ""}
                                    {n(edit.delta)}
                                  </span>
                                </div>

                                {edit.reason ? (
                                  <div className="mt-[2px] text-ink-2">
                                    {edit.reason}
                                  </div>
                                ) : null}

                                <div className="mt-[2px] text-meta text-ink-3">
                                  {t("historyBy", {
                                    name:
                                      edit.edited_by_name ?? t("unknownEditor"),
                                    when: relativeTime(edit.created_at, locale),
                                  })}
                                </div>
                              </li>
                            ))}
                          </ol>
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
