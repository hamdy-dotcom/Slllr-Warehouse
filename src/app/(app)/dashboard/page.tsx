import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ButtonLink } from "@/components/ui/button";
import { Card, Muted, Row, SectionTitle } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { StockBar } from "@/components/ui/stock-bar";
import { requireProfile } from "@/lib/auth";
import { listProductStock } from "@/lib/data/products";
import { movementTotals } from "@/lib/data/movements";
import { requestCounts, requestValues } from "@/lib/data/requests";
import { n, pct } from "@/lib/format";
import { signedQty } from "@/lib/movements";
import { money, unpricedCount } from "@/lib/money";
import { shelfTotals, shelfValues } from "@/lib/shelf";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("nav.dashboard")} · ${t("app.titleSuffix")}` };
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supplierView = profile.role === "supplier";

  const [t, tc, shelf, counts, values, moves] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("common"),
    listProductStock(),
    requestCounts(),
    requestValues(),
    // Only the supplier moves stock, so only the supplier is shown the totals.
    supplierView ? movementTotals(30) : Promise.resolve(null),
  ]);

  const totals = shelfTotals(shelf);
  // Stock and free are what the shelf is worth today, so they use the current
  // cost. Reserved and requested are what was agreed, so they come from the
  // snapshots on the requests — re-pricing a product must not rewrite those.
  const shelfWorth = shelfValues(shelf);
  const unpriced = unpricedCount(shelfWorth.stock);
  const supplier = supplierView;

  const stockHref = supplier ? "/inventory" : "/catalog";
  const requestsHref = supplier ? "/approvals" : "/requests";
  const units = (count: number) => tc("unitsCount", { count });

  return (
    <div className="grid items-start gap-[14px] xl:grid-cols-[300px_1fr]">
      <div className="grid gap-[14px]">
        <div className="flex min-h-[180px] flex-col justify-between rounded-card bg-tint p-5">
          <div>
            <h1 className="text-title font-medium whitespace-pre-line">
              {t("title")}
            </h1>
            <Muted className="mt-[6px] max-w-[330px] text-[13.5px] leading-[1.55]">
              {t("lede")}
            </Muted>
          </div>
          <div className="mt-4 flex gap-2">
            <ButtonLink href={supplier ? "/approvals" : "/catalog"}>
              {supplier ? t("reviewApprovals") : t("reserveProduct")}
            </ButtonLink>
          </div>
        </div>

        <Kpi
          icon="📦"
          label={t("stockValue")}
          value={money(shelfWorth.stock.total)}
          unit={units(totals.total)}
          pill={
            unpriced
              ? tc("notPriced", { count: unpriced })
              : t("skusLive", { count: n(totals.skus) })
          }
          pillTone={unpriced ? "warn" : "good"}
          seed={1}
          href={stockHref}
        />
      </div>

      <div className="grid min-w-0 gap-[14px]">
        <div className="grid gap-[14px] sm:grid-cols-2 lg:grid-cols-3">
          <Kpi
            icon="🔒"
            label={t("reservedForSllr")}
            value={money(values.held.total)}
            unit={units(totals.reserved)}
            pill={t("percentOfShelf", {
              percent: pct(totals.reserved, totals.total),
            })}
            seed={2}
            href={requestsHref}
          />
          <Kpi
            icon="✅"
            label={t("freeStock")}
            value={money(shelfWorth.free.total)}
            unit={units(totals.free)}
            pill={totals.free < 0 ? t("oversold") : t("availableNow")}
            pillTone={totals.free < 0 ? "hot" : "good"}
            seed={4}
            href={stockHref}
          />
          <Kpi
            icon="⏳"
            label={t("requestedAwaiting")}
            value={money(values.asked.total)}
            unit={units(totals.pending)}
            pill={t("requestsWaiting", { count: counts.pending })}
            pillTone={counts.pending > 0 ? "warn" : "good"}
            seed={3}
            href={requestsHref}
          />
        </div>

        {/* Shelf split and Summary share the width the bin grid used to take. */}
        <div className="grid gap-[14px] lg:grid-cols-2">
          <Card>
            <SectionTitle>{t("shelfSplit")}</SectionTitle>
            <Muted className="mb-[14px]">
              {t("acrossSkus", { count: n(totals.skus) })}
            </Muted>
            <StockBar
              reserved={totals.reserved}
              pending={totals.pending}
              total={totals.total}
              deepTrack
              className="mb-3 h-[10px]"
            />
            <Row label={t("reservedForSllr")}>
              {pct(totals.reserved, totals.total)}%
            </Row>
            <Row label={t("pendingApproval")}>
              {pct(totals.pending, totals.total)}%
            </Row>
            <Row label={tc("free")}>
              {pct(Math.max(totals.free, 0), totals.total)}%
            </Row>
          </Card>

          <Card soft>
            <SectionTitle>{t("summary")}</SectionTitle>
            <Row label={t("skusListed")}>{n(totals.skus)}</Row>
            <Row label={t("approvedRequests")}>{n(counts.approved)}</Row>
            <Row label={supplier ? t("waitingOnYou") : t("waitingOnSupplier")}>
              {n(counts.pending)}
            </Row>
            <Row label={t("valueInCustody")}>{money(values.held.total)}</Row>
            {moves ? (
              <>
                <Row label={t("inboundDays", { days: moves.days })}>
                  {signedQty("in", moves.inbound)}
                </Row>
                <Row label={t("outboundDays", { days: moves.days })}>
                  {signedQty("out", moves.outbound)}
                </Row>
              </>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
