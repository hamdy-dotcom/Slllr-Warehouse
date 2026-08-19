import type { Metadata } from "next";

import { ProductCard } from "@/components/product-card";
import { ProductTable } from "@/components/product-table";
import { ShelfToolbar } from "@/components/shelf-toolbar";
import { ViewToggle } from "@/components/view-toggle";
import { Card, Empty, Muted } from "@/components/ui/card";
import { requireSupplier } from "@/lib/auth";
import { listProductStock } from "@/lib/data/products";
import { applyShelfFilter, isShelfFilter, type ShelfFilter } from "@/lib/shelf";
import { relativeTime } from "@/lib/format";
import { readViewMode } from "@/lib/view-cookie";
import { BulkUpdateButton } from "./bulk-dialog";
import { InlineQty } from "./inline-qty";
import { AddProductButton, EditProductButton } from "./product-dialog";

export const metadata: Metadata = { title: "Inventory · Sllr warehouse" };

const ROUTE = "/inventory";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  await requireSupplier();

  const { q = "", filter } = await searchParams;
  const active: ShelfFilter = isShelfFilter(filter) ? filter : "all";

  const [shelf, view] = await Promise.all([
    listProductStock(),
    readViewMode(ROUTE),
  ]);

  const visible = applyShelfFilter(shelf, { q, filter: active });

  return (
    <>
      <div className="mb-[18px]">
        <h1 className="text-title font-medium">Inventory</h1>
        <Muted className="mt-[6px] max-w-[420px]">
          Your shelf. Reserved is what Sllr has been granted — it is worked out
          from approved requests, never typed in.
        </Muted>
      </div>

      <ShelfToolbar q={q} filter={active}>
        <ViewToggle route={ROUTE} mode={view} />
        <BulkUpdateButton shelf={shelf} />
        <AddProductButton />
      </ShelfToolbar>

      {visible.length === 0 ? (
        <Card>
          <Empty>
            {shelf.length === 0
              ? "Nothing on the shelf yet. Add a product to start."
              : "Nothing matches that. Try a different SKU or clear the filter."}
          </Empty>
        </Card>
      ) : view === "grid" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-[14px]">
          {visible.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              totalSlot={
                <InlineQty
                  sku={product.sku}
                  totalQty={product.total_qty}
                  reservedQty={product.reserved_qty}
                />
              }
              action={<EditProductButton product={product} fullWidth />}
            />
          ))}
        </div>
      ) : (
        <Card>
          <ProductTable
            products={visible}
            totalCell={(product) => (
              <InlineQty
                sku={product.sku}
                totalQty={product.total_qty}
                reservedQty={product.reserved_qty}
              />
            )}
            trailing={[
              {
                header: "Updated",
                cell: (product) => (
                  <span className="text-label text-ink-2">
                    {relativeTime(product.updated_at)}
                  </span>
                ),
              },
              {
                header: "",
                cell: (product) => <EditProductButton product={product} />,
              },
            ]}
          />
        </Card>
      )}
    </>
  );
}
