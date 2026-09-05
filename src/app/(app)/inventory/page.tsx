import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { ProductCard } from "@/components/product-card";
import { ProductTable } from "@/components/product-table";
import { ShelfToolbar } from "@/components/shelf-toolbar";
import { ValueSummary } from "@/components/value-summary";
import { ViewToggle } from "@/components/view-toggle";
import { Card, Empty, Muted } from "@/components/ui/card";
import { requireSupplierView } from "@/lib/auth";
import { canWriteShelf } from "@/lib/routes";
import { listProductStock } from "@/lib/data/products";
import { applyShelfFilter, isShelfFilter, type ShelfFilter } from "@/lib/shelf";
import { relativeTime } from "@/lib/format";
import { readViewMode } from "@/lib/view-cookie";
import { BulkUpdateButton } from "./bulk-dialog";
import { AddProductsButton } from "./create-dialog";
import { InlineQty } from "./inline-qty";
import { AddProductButton, EditProductButton } from "./product-dialog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("inventory.title")} · ${t("app.titleSuffix")}` };
}

const ROUTE = "/inventory";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const profile = await requireSupplierView();
  // Admin reads every shelf but belongs to no supplier, so every write here
  // would be refused. Draw the page without the controls rather than with
  // buttons that bounce.
  const canWrite = canWriteShelf(profile.role);

  const { q = "", filter } = await searchParams;
  const active: ShelfFilter = isShelfFilter(filter) ? filter : "all";

  const [t, tc, locale, shelf, view] = await Promise.all([
    getTranslations("inventory"),
    getTranslations("common"),
    getLocale(),
    listProductStock(),
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
        {canWrite ? (
          <>
            <BulkUpdateButton shelf={shelf} />
            <AddProductsButton shelf={shelf} />
            <AddProductButton />
          </>
        ) : null}
      </ShelfToolbar>

      {visible.length > 0 ? <ValueSummary products={visible} /> : null}

      {visible.length === 0 ? (
        <Card>
          <Empty>{shelf.length === 0 ? t("empty") : t("noMatch")}</Empty>
        </Card>
      ) : view === "grid" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-[14px]">
          {visible.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              totalSlot={
                canWrite ? (
                  <InlineQty
                    sku={product.sku}
                    totalQty={product.total_qty}
                    reservedQty={product.reserved_qty}
                  />
                ) : undefined
              }
              action={
                canWrite ? (
                  <EditProductButton product={product} fullWidth />
                ) : undefined
              }
            />
          ))}
        </div>
      ) : (
        <Card>
          <ProductTable
            products={visible}
            totalCell={
              canWrite
                ? (product) => (
                    <InlineQty
                      sku={product.sku}
                      totalQty={product.total_qty}
                      reservedQty={product.reserved_qty}
                    />
                  )
                : undefined
            }
            trailing={[
              {
                header: tc("updated"),
                cell: (product) => (
                  <span className="text-label text-ink-2">
                    {relativeTime(product.updated_at, locale)}
                  </span>
                ),
              },
              ...(canWrite
                ? [
                    {
                      header: "",
                      cell: (product: (typeof visible)[number]) => (
                        <EditProductButton product={product} />
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </Card>
      )}
    </>
  );
}
