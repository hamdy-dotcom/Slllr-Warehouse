import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { ProductMini } from "@/components/product-thumb";
import { Card, Empty, Muted, SectionTitle } from "@/components/ui/card";
import { Pill, Tag } from "@/components/ui/tag";
import { listMyRequests } from "@/lib/data/requests";
import { formatDate, n, relativeTime } from "@/lib/format";
import {
  lineValue,
  money,
  rollValue,
  unitCost,
  unpricedCount,
} from "@/lib/money";
import { CancelButton } from "./cancel-button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("requests.title")} · ${t("app.titleSuffix")}` };
}

const TH =
  "px-[10px] pb-[10px] text-start text-th font-normal uppercase tracking-[0.4px] text-ink-2";
const TD = "border-t border-line px-[10px] py-[13px] align-middle";

/**
 * One part of the approved quantity. Null means the request never became a
 * PO — pending or rejected — so there is nothing to split.
 */
function Split({ qty }: { qty: number | null }) {
  return (
    <td className={`${TD} tabular-nums`}>
      {qty === null || qty === 0 ? (
        <span className="text-ink-3">—</span>
      ) : (
        <b className="font-medium">{n(qty)}</b>
      )}
    </td>
  );
}

export default async function RequestsPage() {
  const [t, tc, locale, requests] = await Promise.all([
    getTranslations("requests"),
    getTranslations("common"),
    getLocale(),
    listMyRequests(),
  ]);

  // Approved is what Sllr actually holds; pending is what it has asked for.
  // Each line uses its own snapshot, so a later cost edit cannot rewrite these.
  const held = rollValue(
    requests.filter((request) => request.status === "approved"),
    (request) => request.qty_approved ?? 0,
    (request) => request.unit_cost,
  );
  const asked = rollValue(
    requests.filter((request) => request.status === "pending"),
    (request) => request.qty_requested,
    (request) => request.unit_cost,
  );
  const unpriced = unpricedCount({
    total: 0,
    priced: held.priced + asked.priced,
    unpriced: held.unpriced + asked.unpriced,
  });
  const pendingCount = requests.filter(
    (request) => request.status === "pending",
  ).length;

  return (
    <>
      <div className="mb-[18px]">
        <h1 className="text-title font-medium">{t("title")}</h1>
        <Muted className="mt-[6px] max-w-[460px]">{t("lede")}</Muted>
      </div>

      <Card className="mb-[14px]">
        <div className="flex flex-wrap items-end justify-between gap-[18px]">
          <div className="flex flex-wrap items-end gap-x-[42px] gap-y-[14px]">
            <div>
              <div className="text-label text-ink-2">{t("inCustody")}</div>
              <div className="text-kpi font-medium text-orange">
                {money(held.total)}
              </div>
            </div>
            <div>
              <div className="text-label text-ink-2">
                {t("requestedAwaiting")}
              </div>
              <div className="text-kpi font-medium text-amber-ink">
                {money(asked.total)}
              </div>
            </div>
          </div>
          {unpriced ? (
            <Pill tone="warn">{tc("notPriced", { count: unpriced })}</Pill>
          ) : null}
        </div>
      </Card>

      <Card>
        <SectionTitle>{t("sectionTitle")}</SectionTitle>
        <Muted className="mb-4">
          {requests.length === 0
            ? t("noneSent")
            : t("sentWaiting", {
                sent: n(requests.length),
                waiting: n(pendingCount),
              })}
        </Muted>

        {requests.length === 0 ? (
          <Empty>{t("empty")}</Empty>
        ) : (
          <div className="scroll-x">
            <table className="w-full border-collapse text-body">
              <thead>
                <tr>
                  <th className={TH}>{tc("product")}</th>
                  <th className={TH}>{tc("unitCost")}</th>
                  <th className={TH}>{t("requested")}</th>
                  <th className={TH}>{t("approved")}</th>
                  <th className={TH} title={t("dispatchedHint")}>
                    {t("dispatched")}
                  </th>
                  <th className={TH}>{t("delivered")}</th>
                  <th className={TH}>{t("returned")}</th>
                  <th className={TH}>{t("outstanding")}</th>
                  <th className={TH}>{t("cancelled")}</th>
                  <th className={TH}>{tc("value")}</th>
                  <th className={TH}>{t("holdUntil")}</th>
                  <th className={TH}>{t("sent")}</th>
                  <th className={TH}>{tc("note")}</th>
                  <th className={TH}>{tc("status")}</th>
                  <th className={TH}>
                    <span className="sr-only">{tc("actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  // Partial approve leaves qty_requested alone, so both
                  // numbers stay on screen as the audit trail.
                  const partial =
                    request.status === "approved" &&
                    request.qty_approved !== null &&
                    request.qty_approved < request.qty_requested;

                  // Approved never shrinks, and the row splits it into where
                  // those units are now:
                  //   approved = dispatched + delivered + returned
                  //            + outstanding + cancelled
                  // "Dispatched" is the live pool — with customers, awaiting a
                  // delivery or a return — not the cumulative counter the view
                  // also carries.
                  const outstanding = request.qty_outstanding ?? 0;

                  return (
                    <tr key={request.id}>
                      <td className={`${TD} rounded-s-[14px]`}>
                        <div className="flex items-center gap-[11px]">
                          <ProductMini
                            src={request.product.image_url}
                            alt={request.product.name}
                          />
                          <div>
                            <div className="font-medium">
                              {request.product.name}
                            </div>
                            <div className="font-mono text-meta text-ink-3">
                              <span className="latin">
                                {request.product.sku} ·{" "}
                                {request.product.warehouse_code}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td
                        className={`${TD} tabular-nums ${
                          request.unit_cost === null ? "text-ink-3" : ""
                        }`}
                      >
                        {unitCost(request.unit_cost)}
                      </td>

                      <td className={TD}>
                        <b className="font-medium tabular-nums">
                          {n(request.qty_requested)}
                        </b>
                      </td>
                      <td className={TD}>
                        {request.qty_approved === null ? (
                          <span className="text-ink-3">—</span>
                        ) : (
                          <span className={partial ? "text-amber-ink" : ""}>
                            <b className="font-medium">
                              {n(request.qty_approved)}
                            </b>
                            {partial ? (
                              <span className="ms-1 text-meta">
                                {t("partial")}
                              </span>
                            ) : null}
                          </span>
                        )}
                      </td>
                      <Split qty={request.qty_in_progress} />
                      <Split qty={request.qty_delivered} />
                      <Split qty={request.qty_returned} />

                      <td className={`${TD} tabular-nums`}>
                        {request.qty_approved === null ? (
                          <span className="text-ink-3">—</span>
                        ) : (
                          <b
                            className={
                              outstanding > 0
                                ? "font-medium text-orange"
                                : "font-normal text-ink-3"
                            }
                          >
                            {n(outstanding)}
                          </b>
                        )}
                      </td>

                      <Split qty={request.qty_cancelled} />

                      <td
                        className={`${TD} tabular-nums ${
                          request.unit_cost === null
                            ? "text-ink-3"
                            : "font-medium"
                        }`}
                      >
                        {money(
                          lineValue(
                            request.qty_approved === null
                              ? request.qty_requested
                              : outstanding,
                            request.unit_cost,
                          ),
                        )}
                      </td>

                      <td className={TD}>
                        {formatDate(request.hold_until, locale)}
                      </td>
                      <td className={`${TD} text-label text-ink-2`}>
                        {relativeTime(request.created_at, locale)}
                      </td>
                      <td
                        className={`${TD} max-w-[220px] text-label text-ink-2`}
                      >
                        {request.note || tc("dash")}
                      </td>
                      <td className={TD}>
                        <Tag status={request.status} />
                      </td>
                      <td className={`${TD} rounded-e-[14px] text-end`}>
                        {request.status === "pending" ? (
                          <CancelButton id={request.id} />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
