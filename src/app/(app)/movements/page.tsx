import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { ProductMini } from "@/components/product-thumb";
import { Card, Empty, Muted, SectionTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { listProductStock } from "@/lib/data/products";
import {
  LEDGER_LIMIT,
  listMovements,
  movementTotals,
} from "@/lib/data/movements";
import { n, relativeTime } from "@/lib/format";
import { isDirection, isMovementKind, signedQty } from "@/lib/movements";
import { MovementFilters } from "./movement-filters";
import { RecordMovementButton } from "./record-dialog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("movements.title")} · ${t("app.titleSuffix")}` };
}

const TH =
  "px-[10px] pb-[10px] text-start text-th font-normal uppercase tracking-[0.4px] text-ink-2";
const TD = "border-t border-line px-[10px] py-[13px] align-middle";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<{
    direction?: string;
    kind?: string;
    from?: string;
    to?: string;
    q?: string;
  }>;
}) {
  // The warehouse reads this ledger too — every transfer into Riyadh lands
  // here — but only a supplier records a movement by hand, so the recording
  // buttons are gated below rather than the whole page.
  const profile = await requireProfile();
  const canRecord = profile.role === "supplier" || profile.role === "admin";

  const params = await searchParams;
  const direction = isDirection(params.direction)
    ? params.direction
    : undefined;
  const kind = isMovementKind(params.kind) ? params.kind : undefined;
  const from = ISO_DATE.test(params.from ?? "") ? params.from! : "";
  const to = ISO_DATE.test(params.to ?? "") ? params.to! : "";
  const q = params.q ?? "";

  const [t, tc, locale, movements, shelf, totals] = await Promise.all([
    getTranslations("movements"),
    getTranslations("common"),
    getLocale(),
    listMovements({ direction, kind, from, to, q }),
    listProductStock(),
    movementTotals(30),
  ]);

  return (
    <>
      <div className="mb-[18px]">
        <h1 className="text-title font-medium">{t("title")}</h1>
        <Muted className="mt-[6px] max-w-[520px]">{t("lede")}</Muted>
      </div>

      <Card soft className="mb-[22px]">
        <div className="flex flex-wrap items-start gap-x-[42px] gap-y-[16px]">
          <div>
            <div className="flex items-center gap-[6px] text-label text-ink-2">
              <i className="inline-block h-[5px] w-[14px] shrink-0 rounded-[3px] bg-green" />
              {t("inboundDays", { days: totals.days })}
            </div>
            <div className="mt-[2px] text-kpi font-medium tabular-nums">
              {signedQty("in", totals.inbound)}
            </div>
            <div className="mt-[2px] text-body text-ink-3">
              {t("movementsCount", { count: totals.inboundCount })}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-[6px] text-label text-ink-2">
              <i className="inline-block h-[5px] w-[14px] shrink-0 rounded-[3px] bg-orange" />
              {t("outboundDays", { days: totals.days })}
            </div>
            <div className="mt-[2px] text-kpi font-medium tabular-nums">
              {signedQty("out", totals.outbound)}
            </div>
            <div className="mt-[2px] text-body text-ink-3">
              {t("movementsCount", { count: totals.outboundCount })}
            </div>
          </div>

          <div>
            <div className="text-label text-ink-2">{t("net")}</div>
            <div className="mt-[2px] text-kpi font-medium tabular-nums">
              {signedQty(
                totals.inbound - totals.outbound >= 0 ? "in" : "out",
                totals.inbound - totals.outbound,
              )}
            </div>
            <div className="mt-[2px] text-body text-ink-3">{tc("units")}</div>
          </div>
        </div>
      </Card>

      <MovementFilters
        direction={direction}
        kind={kind}
        from={from}
        to={to}
        q={q}
      >
        {canRecord ? (
          <>
            <RecordMovementButton direction="out" shelf={shelf} />
            <RecordMovementButton direction="in" shelf={shelf} />
          </>
        ) : null}
      </MovementFilters>

      <Card>
        <SectionTitle>{t("ledger")}</SectionTitle>
        <Muted className="mb-4">
          {movements.length === 0
            ? t("noMatch")
            : `${t("movementsCount", { count: movements.length })}${
                movements.length === LEDGER_LIMIT
                  ? t("showingMost", { limit: n(LEDGER_LIMIT) })
                  : ""
              }`}
        </Muted>

        {movements.length === 0 ? (
          <Empty>{t("empty")}</Empty>
        ) : (
          <div className="scroll-x">
            <table className="w-full border-collapse text-body">
              <thead>
                <tr>
                  <th className={TH}>{t("when")}</th>
                  <th className={TH}>{tc("product")}</th>
                  <th className={TH}>{t("direction")}</th>
                  <th className={TH}>{tc("kind")}</th>
                  <th className={TH}>{tc("qty")}</th>
                  <th className={TH}>{t("resultingQty")}</th>
                  <th className={TH}>{tc("reference")}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td
                      className={`${TD} rounded-s-[14px] text-label text-ink-2`}
                    >
                      {relativeTime(movement.created_at, locale)}
                    </td>

                    <td className={TD}>
                      <div className="flex items-center gap-[11px]">
                        <ProductMini
                          src={movement.product.image_url}
                          alt={movement.product.name}
                        />
                        <div>
                          <div className="font-medium">
                            {movement.product.name}
                          </div>
                          <div className="font-mono text-meta text-ink-3">
                            <span className="latin">
                              {movement.product.sku} ·{" "}
                              {movement.product.warehouse_code}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className={TD}>
                      <span
                        className={`inline-block rounded-pill px-[10px] py-[4px] text-meta ${
                          movement.direction === "in"
                            ? "bg-green-soft text-green"
                            : "bg-orange-soft text-orange-ink"
                        }`}
                      >
                        {t(`direction_${movement.direction}`)}
                      </span>
                    </td>

                    <td className={`${TD} text-label text-ink-2`}>
                      {t(`kind_${movement.kind}`)}
                    </td>

                    <td className={TD}>
                      <b
                        className={`font-medium tabular-nums ${
                          movement.direction === "in"
                            ? "text-green"
                            : "text-orange"
                        }`}
                      >
                        {signedQty(movement.direction, movement.delta)}
                      </b>
                    </td>

                    <td className={`${TD} tabular-nums`}>
                      {n(movement.qty_after)}
                    </td>

                    <td className={`${TD} text-label text-ink-2`}>
                      {movement.reference ? (
                        <span className="latin font-mono text-meta">
                          {movement.reference}
                        </span>
                      ) : (
                        <span className="text-ink-3">{tc("dash")}</span>
                      )}
                      {movement.note ? (
                        <div className="text-meta text-ink-3">
                          {movement.note}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
