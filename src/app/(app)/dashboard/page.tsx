import type { Metadata } from "next";
import { BinGrid, BinLegend } from "@/components/bin-grid";
import { ButtonLink } from "@/components/ui/button";
import { Card, Muted, Row, SectionTitle } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { StockBar } from "@/components/ui/stock-bar";
import { requireProfile } from "@/lib/auth";
import { listProductStock } from "@/lib/data/products";
import { requestCounts } from "@/lib/data/requests";
import { n, pct } from "@/lib/format";
import { shelfTotals } from "@/lib/shelf";
import { TOTAL_BINS, buildGrid, occupiedCount } from "@/lib/warehouse";

export const metadata: Metadata = { title: "Dashboard · Sllr warehouse" };

export default async function DashboardPage() {
  const profile = await requireProfile();
  const [shelf, counts] = await Promise.all([
    listProductStock(),
    requestCounts(),
  ]);

  const totals = shelfTotals(shelf);
  const grid = buildGrid(shelf);
  const supplier = profile.role === "supplier";

  const stockHref = supplier ? "/inventory" : "/catalog";
  const requestsHref = supplier ? "/approvals" : "/requests";

  return (
    <div className="grid items-start gap-[14px] xl:grid-cols-[300px_1fr_300px]">
      <div className="grid gap-[14px]">
        <div className="flex min-h-[180px] flex-col justify-between rounded-card bg-tint p-5">
          <div>
            <h1 className="text-title font-medium">
              Warehouse
              <br />
              management
            </h1>
            <Muted className="mt-[6px] max-w-[330px] text-[13.5px] leading-[1.55]">
              Shared shelf between Sllr and the supplier. Reserve, approve, and
              watch the free stock move in one place.
            </Muted>
          </div>
          <div className="mt-4 flex gap-2">
            <ButtonLink href={supplier ? "/approvals" : "/catalog"}>
              {supplier ? "Review approvals" : "Reserve a product"}
            </ButtonLink>
          </div>
        </div>

        <Kpi
          icon="📦"
          label="Total stock"
          value={n(totals.total)}
          unit="units"
          pill={`${n(totals.skus)} SKUs live`}
          seed={1}
          href={stockHref}
        />
      </div>

      <div className="grid min-w-0 gap-[14px]">
        <div className="grid gap-[14px] sm:grid-cols-2">
          <Kpi
            icon="🔒"
            label="Reserved for Sllr"
            value={n(totals.reserved)}
            unit="units"
            pill={`${pct(totals.reserved, totals.total)}% of shelf`}
            seed={2}
            href={requestsHref}
          />
          <Kpi
            icon="✅"
            label="Free stock"
            value={n(totals.free)}
            unit="units"
            pill={totals.free < 0 ? "oversold" : "available now"}
            pillTone={totals.free < 0 ? "hot" : "good"}
            seed={4}
            href={stockHref}
          />
        </div>

        <Card>
          <div className="mb-[6px] flex flex-wrap items-center justify-between gap-[10px]">
            <SectionTitle>Warehouse layout</SectionTitle>
            <BinLegend />
          </div>
          <Muted>
            Bins carrying a product are clickable. Tap one to see what sits
            there.
          </Muted>
          <BinGrid grid={grid} />
        </Card>
      </div>

      <div className="grid gap-[14px]">
        <Kpi
          icon="⏳"
          label="Pending approval"
          value={n(totals.pending)}
          unit="units"
          pill={`${n(counts.pending)} ${
            counts.pending === 1 ? "request" : "requests"
          } waiting`}
          pillTone={counts.pending > 0 ? "warn" : "good"}
          seed={3}
          href={requestsHref}
        />

        <Card>
          <SectionTitle>Shelf split</SectionTitle>
          <Muted className="mb-[14px]">Across all {n(totals.skus)} SKUs</Muted>
          <StockBar
            reserved={totals.reserved}
            pending={totals.pending}
            total={totals.total}
            deepTrack
            className="mb-3 h-[10px]"
          />
          <Row label="Reserved for Sllr">
            {pct(totals.reserved, totals.total)}%
          </Row>
          <Row label="Pending approval">
            {pct(totals.pending, totals.total)}%
          </Row>
          <Row label="Free">{pct(Math.max(totals.free, 0), totals.total)}%</Row>
        </Card>

        <Card soft>
          <SectionTitle>Summary</SectionTitle>
          <Row label="SKUs listed">{n(totals.skus)}</Row>
          <Row label="Approved requests">{n(counts.approved)}</Row>
          <Row label={supplier ? "Waiting on you" : "Waiting on supplier"}>
            {n(counts.pending)}
          </Row>
          <Row label="Bins in use">
            {n(occupiedCount(grid))} / {n(TOTAL_BINS)}
          </Row>
        </Card>
      </div>
    </div>
  );
}
