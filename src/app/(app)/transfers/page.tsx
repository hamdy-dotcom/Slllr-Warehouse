import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { ProductMini } from "@/components/product-thumb";
import { Card, Empty, Muted, SectionTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { arrivalEdits, listArrivalLog } from "@/lib/data/arrivals";
import { listTransferQueue } from "@/lib/data/transfers";
import { arrivalTotals, matchesArrivalFilter } from "@/lib/arrivals";
import { formatDate, n } from "@/lib/format";
import { money } from "@/lib/money";
import { cn } from "@/lib/cn";
import {
  isTransferStatus,
  transferStatusKey,
  transferTotals,
} from "@/lib/transfers";
import { ArrivalActions } from "./arrival-actions";
import { ArrivalFilters } from "./arrival-filters";
import { BulkArrivalsButton } from "./bulk-dialog";
import { RecordedArrivals } from "./recorded-arrivals";
import { TransferFilters } from "./transfer-filters";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("transfers.title")} · ${t("app.titleSuffix")}` };
}

const TH =
  "px-[10px] pb-[10px] text-start text-th font-normal uppercase tracking-[0.4px] text-ink-2";
const TD = "border-t border-line px-[10px] py-[12px] align-middle";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const STATUS_STYLE: Record<string, string> = {
  "not started": "bg-neutral-soft text-ink-2",
  "part arrived": "bg-amber-soft text-amber-ink",
  complete: "bg-green-soft text-green",
};

/**
 * What the Riyadh warehouse is waiting for, oldest approval first.
 *
 * The order is the work order rather than a sort: the commitment a supplier
 * made longest ago is the one to chase. Recording an arrival here is what
 * moves stock off the supplier's shelf — nothing else in the app does.
 */
export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    from?: string;
    to?: string;
    aq?: string;
    edited?: string;
  }>;
}) {
  const profile = await requireProfile();
  const params = await searchParams;

  const filter = {
    status: isTransferStatus(params.status) ? params.status : undefined,
    q: params.q || undefined,
  };

  // Its own keys, so the queue's search and the arrivals search can both be
  // set at once without one clearing the other.
  const arrivalFilter = {
    from: ISO_DATE.test(params.from ?? "") ? params.from : undefined,
    to: ISO_DATE.test(params.to ?? "") ? params.to : undefined,
    q: params.aq || undefined,
    editedOnly: params.edited === "1",
  };

  const [t, ta, tc, locale, all, arrivals, edits] = await Promise.all([
    getTranslations("transfers"),
    getTranslations("arrivals"),
    getTranslations("common"),
    getLocale(),
    listTransferQueue(),
    listArrivalLog(),
    arrivalEdits(),
  ]);

  const visibleArrivals = arrivals.filter((row) =>
    matchesArrivalFilter(row, arrivalFilter),
  );
  const arrivalSums = arrivalTotals(visibleArrivals);
  const canAmend = profile.role === "warehouse" || profile.role === "admin";

  const lines = await listTransferQueue(filter);
  const totals = transferTotals(lines);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="mb-[18px] flex flex-wrap items-start justify-between gap-[14px]">
        <div>
          <h1 className="text-title font-medium">{t("title")}</h1>
          <Muted className="mt-[6px] max-w-[560px]">{t("lede")}</Muted>
        </div>

        <div className="text-end">
          <div className="text-label text-ink-2">{t("totalAwaiting")}</div>
          <div className="mt-[2px] text-kpi font-medium tabular-nums text-orange">
            {money(totals.value)}
          </div>
          <div className="text-meta text-ink-3">
            {tc("unitsCount", { count: totals.awaiting })} ·{" "}
            {t("posWaiting", { count: totals.pos })}
          </div>
        </div>
      </div>

      <TransferFilters status={filter.status} q={filter.q}>
        <BulkArrivalsButton lines={all} today={today} />
      </TransferFilters>

      <Card>
        <SectionTitle>{t("title")}</SectionTitle>
        <Muted className="mb-4">
          {t("posWaiting", { count: lines.length })}
        </Muted>

        {lines.length === 0 ? (
          <Empty>{all.length === 0 ? t("empty") : t("noMatch")}</Empty>
        ) : (
          <div className="scroll-x">
            <table className="w-full border-collapse text-body">
              <thead>
                <tr>
                  <th className={TH}>{tc("date")}</th>
                  <th className={TH}>{tc("product")}</th>
                  <th className={TH}>{t("colRef")}</th>
                  <th className={TH}>{tc("supplier")}</th>
                  <th className={`${TH} text-end`}>{t("colApproved")}</th>
                  <th className={`${TH} text-end`}>{t("colArrived")}</th>
                  <th className={`${TH} text-end`}>{t("colAwaiting")}</th>
                  <th className={TH}>{tc("status")}</th>
                  <th className={TH}>
                    <span className="sr-only">{tc("actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.po_id}>
                    <td
                      className={`${TD} rounded-s-[14px] text-label text-ink-2`}
                    >
                      {formatDate(line.approved_at.slice(0, 10), locale)}
                    </td>

                    <td className={TD}>
                      <div className="flex items-center gap-[10px]">
                        <ProductMini
                          src={line.image_url}
                          alt={line.product_name}
                        />
                        <div className="min-w-0">
                          <div className="font-medium">{line.product_name}</div>
                          <div className="latin font-mono text-meta text-ink-3">
                            {line.sku} · {line.warehouse_code}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className={TD}>
                      <span className="latin font-mono text-meta">
                        {line.po_ref}
                      </span>
                    </td>

                    <td className={`${TD} text-label text-ink-2`}>
                      {line.supplier_name}
                    </td>

                    <td className={`${TD} text-end tabular-nums`}>
                      {n(line.qty_approved)}
                    </td>

                    <td className={`${TD} text-end tabular-nums`}>
                      {line.qty_arrived === 0 ? (
                        <span className="text-ink-3">{tc("dash")}</span>
                      ) : (
                        <b className="font-medium text-green">
                          {n(line.qty_arrived)}
                        </b>
                      )}
                    </td>

                    <td className={`${TD} text-end tabular-nums`}>
                      <b className="font-medium text-orange">
                        {n(line.qty_awaiting_transfer)}
                      </b>
                      <div className="text-meta text-ink-3">
                        {money(line.awaiting_transfer_value)}
                      </div>
                    </td>

                    <td className={TD}>
                      <span
                        className={cn(
                          "inline-block rounded-pill px-[10px] py-[4px] text-meta",
                          STATUS_STYLE[line.transfer_status] ??
                            "bg-neutral-soft text-ink-2",
                        )}
                      >
                        {transferStatusKey(line.transfer_status)
                          ? t(transferStatusKey(line.transfer_status) as string)
                          : line.transfer_status}
                      </span>
                    </td>

                    <td className={`${TD} rounded-e-[14px]`}>
                      <ArrivalActions line={line} today={today} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-[22px] mb-[18px] flex flex-wrap items-start justify-between gap-[14px]">
        <div>
          <h2 className="text-title font-medium">{ta("title")}</h2>
          <Muted className="mt-[6px] max-w-[560px]">{ta("lede")}</Muted>
        </div>

        <div className="text-end">
          <div className="text-label text-ink-2">{ta("totalRecorded")}</div>
          <div className="mt-[2px] text-kpi font-medium tabular-nums">
            {money(arrivalSums.value)}
          </div>
          <div className="text-meta text-ink-3">
            {tc("unitsCount", { count: arrivalSums.qty })}
          </div>
        </div>
      </div>

      <ArrivalFilters
        from={arrivalFilter.from}
        to={arrivalFilter.to}
        q={arrivalFilter.q}
        editedOnly={arrivalFilter.editedOnly}
      />

      <Card>
        <SectionTitle>{ta("title")}</SectionTitle>
        <Muted className="mb-4">
          {ta("summary", {
            rows: arrivalSums.rows,
            edited: n(arrivalSums.edited),
            voided: n(arrivalSums.voided),
          })}
        </Muted>

        <RecordedArrivals
          rows={visibleArrivals}
          edits={Object.fromEntries(edits)}
          canEdit={canAmend}
          emptyMessage={arrivals.length === 0 ? ta("empty") : ta("noMatch")}
        />
      </Card>
    </>
  );
}
