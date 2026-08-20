import type { Metadata } from "next";

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

export const metadata: Metadata = { title: "Catalog · Sllr warehouse" };

const ROUTE = "/catalog";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const { q = "", filter } = await searchParams;
  const active: ShelfFilter = isShelfFilter(filter) ? filter : "all";

  const [shelf, view] = await Promise.all([
    listProductStock({ activeOnly: true }),
    readViewMode(ROUTE),
  ]);

  const visible = applyShelfFilter(shelf, { q, filter: active });

  return (
    <>
      <div className="mb-[18px]">
        <h1 className="text-title font-medium">Catalog</h1>
        <Muted className="mt-[6px] max-w-[420px]">
          The supplier&rsquo;s whole shelf. Reserving asks for stock — nothing
          is deducted until the supplier approves.
        </Muted>
      </div>

      <ShelfToolbar q={q} filter={active}>
        <ViewToggle route={ROUTE} mode={view} />
      </ShelfToolbar>

      {visible.length > 0 ? <ValueSummary products={visible} /> : null}

      {visible.length === 0 ? (
        <Card>
          <Empty>
            {shelf.length === 0
              ? "The shelf is empty. Products show up here once the supplier lists them."
              : "Nothing matches that. Try a different SKU or clear the filter."}
          </Empty>
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
