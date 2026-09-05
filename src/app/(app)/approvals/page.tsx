import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { ProductMini } from "@/components/product-thumb";
import { Card, Empty, Muted, SectionTitle } from "@/components/ui/card";
import { requireSupplierView } from "@/lib/auth";
import { availableToGrant, listPendingApprovals } from "@/lib/data/requests";
import { formatDate, n } from "@/lib/format";
import {
  lineValue,
  money,
  rollValue,
  unitCost,
  unpricedCount,
} from "@/lib/money";
import { ApprovalActions } from "./approval-actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("approvals.title")} · ${t("app.titleSuffix")}` };
}

export default async function ApprovalsPage() {
  await requireSupplierView();

  const [t, tc, locale, pending] = await Promise.all([
    getTranslations("approvals"),
    getTranslations("common"),
    getLocale(),
    listPendingApprovals(),
  ]);

  const asked = rollValue(
    pending,
    (request) => request.qty_requested,
    (request) => request.unit_cost,
  );
  const unpriced = unpricedCount(asked);

  return (
    <>
      <div className="mb-[18px]">
        <h1 className="text-title font-medium">{t("title")}</h1>
        <Muted className="mt-[6px] max-w-[460px]">{t("lede")}</Muted>
      </div>

      <Card>
        <SectionTitle>{t("waitingOnYou")}</SectionTitle>
        <Muted className="mb-4">
          {t("waitingCount", { count: pending.length })}{" "}
          {pending.length > 0 ? (
            <>
              {t.rich("worthAt", {
                value: money(asked.total),
                b: (chunks) => <b className="text-amber-ink">{chunks}</b>,
              })}
              {unpriced ? ` ${tc("notPriced", { count: unpriced })}.` : ""}
            </>
          ) : null}
        </Muted>

        {pending.length === 0 ? (
          <Empty>{t("empty")}</Empty>
        ) : (
          <div className="flex flex-col gap-[11px]">
            {pending.map((request) => {
              const available = availableToGrant(request.product);
              const short = request.qty_requested - available;

              return (
                <Card key={request.id} soft>
                  <div className="flex flex-wrap items-center gap-[11px]">
                    <ProductMini
                      src={request.product.image_url}
                      alt={request.product.name}
                      className="size-[54px]"
                    />

                    <div className="min-w-[220px] flex-1">
                      <div className="text-product font-medium">
                        {t("unitsRequested", {
                          product: request.product.name,
                          count: n(request.qty_requested),
                        })}
                      </div>
                      <div className="font-mono text-meta text-ink-3">
                        <span className="latin">
                          {request.product.sku} ·{" "}
                          {request.product.warehouse_code}
                        </span>
                      </div>
                      <div className="mt-1 text-[12px] text-ink-2">
                        {request.unit_cost === null ? (
                          <span className="text-ink-3">{t("notPriced")}</span>
                        ) : (
                          t.rich("perUnitWorth", {
                            cost: unitCost(request.unit_cost),
                            value: money(
                              lineValue(
                                request.qty_requested,
                                request.unit_cost,
                              ),
                            ),
                            b: (chunks) => (
                              <b className="text-amber-ink">{chunks}</b>
                            ),
                          })
                        )}
                      </div>
                      <div
                        className={`mt-1 text-[12px] ${
                          short > 0 ? "text-orange" : "text-ink-2"
                        }`}
                      >
                        {short > 0
                          ? t("exceeds", {
                              short: n(short),
                              available: n(Math.max(available, 0)),
                            })
                          : t("leaves", {
                              left: n(available - request.qty_requested),
                              date: formatDate(request.hold_until, locale),
                            })}
                      </div>
                      {request.note ? (
                        <div className="mt-1 text-[12px] text-ink-3">
                          &ldquo;{request.note}&rdquo;
                        </div>
                      ) : null}
                    </div>

                    <ApprovalActions
                      id={request.id}
                      productName={request.product.name}
                      qtyRequested={request.qty_requested}
                      available={available}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
