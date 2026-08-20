import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ProductCard } from "@/components/product-card";
import { ProductTable } from "@/components/product-table";
import { ShelfToolbar } from "@/components/shelf-toolbar";
import { ValueSummary } from "@/components/value-summary";
import { ViewToggle } from "@/components/view-toggle";
import { Card, Empty, Muted } from "@/components/ui/card";
import { listProductStock } from "@/lib/data/products";
import { applyShelfFilter, isShelfFilter, type ShelfFilter } from "@/lib/shelf";
import { readViewMode } from "@/lib/view-cookie";
import { ReserveButton } from "./reserve-dialog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("catalog.title")} · ${t("app.titleSuffix")}` };
}

const ROUTE = "/catalog";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const { q = "", filter } = await searchParams;
  const active: ShelfFilter = isShelfFilter(filter) ? filter : "all";

  const [t, shelf, view] = await Promise.all([
    getTranslations("catalog"),
    listProductStock({ activeOnly: true }),
    readViewMode(ROUTE),
  ]);

  const visible = applyShelfFilter(shelf, { q, filter: active });

  return (
    <>
      <div className="mb-[18px]">
        <h1 className="text-title font-medium">{t("title")}</h1>
        <Muted className="mt-[6px] max-w-[420px]">{t("lede")}</Muted>
      </div>

      <ShelfToolbar q={q} filter={active}>
        <ViewToggle route={ROUTE} mode={view} />
      </ShelfToolbar>

      {visible.length > 0 ? <ValueSummary products={visible} /> : null}

      {visible.length === 0 ? (
        <Card>
          <Empty>{shelf.length === 0 ? t("emptyShelf") : t("noMatch")}</Empty>
        </Card>
      ) : view === "grid" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-[14px]">
          {visible.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              action={<ReserveButton product={product} />}
            />
          ))}
        </div>
      ) : (
        <Card>
          <ProductTable
            products={visible}
            trailing={[
              {
                header: "",
                cell: (product) => <ReserveButton product={product} compact />,
              },
            ]}
          />
        </Card>
      )}
    </>
  );
}
