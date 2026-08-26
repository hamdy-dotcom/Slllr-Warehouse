import { getLocale, getTranslations } from "next-intl/server";

import { Card, Empty, Muted, SectionTitle } from "@/components/ui/card";
import { money } from "@/lib/money";
import { listAllPos, listPos, poSettlementHistory } from "@/lib/data/po";
import {
  poSuppliers,
  poTotals,
  type PoFilter,
  type PoSort,
  type SortDir,
} from "@/lib/po";
import type { SessionProfile } from "@/lib/auth";
import { PoFilters } from "./po-filters";
import { PoTable } from "./po-table";
import { ReleaseReservedButton } from "./release-dialog";

/**
 * Purchase orders, one row per PO.
 *
 * Sorted by product then queue order by default, so each product's rows read
 * top to bottom in the order they will be dispatched and settled. Every row
 * also carries its `queue_position`, which is what stays true when the reader
 * sorts by something else.
 */
export async function PoSection({
  profile,
  filter,
  sort,
  dir,
}: {
  profile: SessionProfile;
  filter: PoFilter;
  sort: PoSort;
  dir: SortDir;
}) {
  const [t, locale, all, history] = await Promise.all([
    getTranslations("po"),
    getLocale(),
    listAllPos(profile),
    poSettlementHistory(profile),
  ]);

  const rows = listPos(all, filter, sort, dir);
  const totals = poTotals(rows);
  // Suppliers come from every PO the caller may see, not the filtered set, or
  // picking one supplier would empty its own picker.
  const suppliers = poSuppliers(all);
  const canRelease = profile.role !== "supplier";

  return (
    <Card id="po-settlements" className="mt-[14px] scroll-mt-[18px]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-[14px]">
        <div className="max-w-[560px]">
          <SectionTitle>{t("title")}</SectionTitle>
          <Muted className="mt-[2px]">{t("lede")}</Muted>
          <Muted className="mt-[6px]">{t("queueNote")}</Muted>
        </div>

        <div className="flex flex-wrap gap-x-[28px] gap-y-[8px]">
          <Total label={t("openValue")} value={money(totals.open)} />
          <Total
            label={t("inProgressValue")}
            value={money(totals.inProgress)}
            tone="text-orange"
          />
          <Total
            label={t("deliveredValue")}
            value={money(totals.delivered)}
            tone="text-green"
          />
        </div>
      </div>

      <PoFilters
        status={filter.status}
        supplierId={filter.supplierId}
        q={filter.q}
        suppliers={suppliers}
      >
        {canRelease ? <ReleaseReservedButton pos={all} /> : null}
      </PoFilters>

      {rows.length === 0 ? (
        <Empty>{all.length === 0 ? t("empty") : t("noMatch")}</Empty>
      ) : (
        <>
          <Muted className="mb-[10px]">
            {t("countLabel", { count: totals.count })}
          </Muted>
          <PoTable
            pos={rows}
            history={Object.fromEntries(history)}
            sort={sort}
            dir={dir}
            locale={locale}
          />
        </>
      )}
    </Card>
  );
}

function Total({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <div className="text-label text-ink-2">{label}</div>
      <div
        className={`mt-[2px] text-kpi font-medium tabular-nums ${tone ?? ""}`}
      >
        {value}
      </div>
    </div>
  );
}
