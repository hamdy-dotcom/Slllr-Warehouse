import type { Metadata } from "next";

import { ProductCard } from "@/components/product-card";
import { ShelfToolbar } from "@/components/shelf-toolbar";
import { Card, Empty, Muted } from "@/components/ui/card";
import { listProductStock } from "@/lib/data/products";
import { applyShelfFilter, isShelfFilter, type ShelfFilter } from "@/lib/shelf";

export const metadata: Metadata = { title: "Catalog · Sllr warehouse" };

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const { q = "", filter } = await searchParams;
  const active: ShelfFilter = isShelfFilter(filter) ? filter : "all";

  const shelf = await listProductStock({ activeOnly: true });
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

      <ShelfToolbar q={q} filter={active} />

      {shelf.length === 0 ? (
        <Card>
          <Empty>
            The shelf is empty. Products show up here once the supplier lists
            them.
          </Empty>
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <Empty>
            Nothing matches that. Try a different SKU or clear the filter.
          </Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-[14px]">
          {visible.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </>
  );
}
