import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ProductMini } from "@/components/product-thumb";
import { Card, Empty, Muted, SectionTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { warehouseStock, type WarehouseLine } from "@/lib/data/transfers";
import { n } from "@/lib/format";
import { money } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("warehouseStock.title")} · ${t("app.titleSuffix")}` };
}

const TH =
  "px-[10px] pb-[10px] text-start text-th font-normal uppercase tracking-[0.4px] text-ink-2";
const TD = "border-t border-line px-[10px] py-[11px] align-middle";

/**
 * The Riyadh warehouse in three parts: what is here, what has gone out to
 * customers, and what is still on a supplier's shelf waiting to be moved.
 *
 * Upcoming is deliberately alongside the other two rather than on the
 * transfer queue alone — the question "how much of this do we have" is really
 * three questions, and the third one is what is coming.
 */
export default async function WarehouseStockPage() {
  await requireProfile();

  const [t, tc, stock] = await Promise.all([
    getTranslations("warehouseStock"),
    getTranslations("common"),
    warehouseStock(),
  ]);

  const sections = [
    {
      key: "inStock",
      title: t("inStock"),
      lede: t("inStockLede"),
      lines: stock.inStock,
      tone: "text-green",
    },
    {
      key: "outForDelivery",
      title: t("outForDelivery"),
      lede: t("outForDeliveryLede"),
      lines: stock.outForDelivery,
      tone: "text-orange",
    },
    {
      key: "upcoming",
      title: t("upcoming"),
      lede: t("upcomingLede"),
      lines: stock.upcoming,
      tone: "text-ink-2",
    },
  ];

  return (
    <>
      <div className="mb-[18px]">
        <h1 className="text-title font-medium">{t("title")}</h1>
        <Muted className="mt-[6px] max-w-[520px]">{t("lede")}</Muted>
      </div>

      <div className="grid gap-[14px]">
        {sections.map((section) => {
          const total = section.lines.reduce(
            (acc, line) => ({
              qty: acc.qty + line.qty,
              value: acc.value + line.value,
            }),
            { qty: 0, value: 0 },
          );

          return (
            <Card key={section.key}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-[14px]">
                <div>
                  <SectionTitle>{section.title}</SectionTitle>
                  <Muted className="mt-[2px]">{section.lede}</Muted>
                </div>
                <div className="text-end">
                  <div
                    className={`text-kpi font-medium tabular-nums ${section.tone}`}
                  >
                    {money(total.value)}
                  </div>
                  <div className="text-meta text-ink-3">
                    {tc("unitsCount", { count: total.qty })} ·{" "}
                    {t("skus", { count: section.lines.length })}
                  </div>
                </div>
              </div>

              {section.lines.length === 0 ? (
                <Empty>{t("empty")}</Empty>
              ) : (
                <StockTable lines={section.lines} />
              )}
            </Card>
          );
        })}
      </div>
    </>
  );

  function StockTable({ lines }: { lines: WarehouseLine[] }) {
    return (
      <div className="scroll-x">
        <table className="w-full border-collapse text-body">
          <thead>
            <tr>
              <th className={TH}>{t("colProduct")}</th>
              <th className={`${TH} text-end`}>{t("colQty")}</th>
              <th className={`${TH} text-end`}>{t("colValue")}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.product_id}>
                <td className={`${TD} rounded-s-[14px]`}>
                  <div className="flex items-center gap-[10px]">
                    <ProductMini src={line.image_url} alt={line.name} />
                    <div className="min-w-0">
                      <div className="font-medium">{line.name}</div>
                      <div className="latin font-mono text-meta text-ink-3">
                        {line.sku}
                      </div>
                    </div>
                  </div>
                </td>
                <td className={`${TD} text-end tabular-nums`}>
                  <b className="font-medium">{n(line.qty)}</b>
                </td>
                <td className={`${TD} rounded-e-[14px] text-end tabular-nums`}>
                  {money(line.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}
