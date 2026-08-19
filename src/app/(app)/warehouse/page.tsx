import type { Metadata } from "next";

import { BinGrid, BinLegend } from "@/components/bin-grid";
import { Card, Muted, SectionTitle } from "@/components/ui/card";
import { listProductStock } from "@/lib/data/products";
import { n } from "@/lib/format";
import {
  BINS_PER_LINE,
  LINES,
  TOTAL_BINS,
  buildGrid,
  occupiedCount,
  offGrid,
} from "@/lib/warehouse";

export const metadata: Metadata = { title: "Warehouse layout · Sllr warehouse" };

export default async function WarehousePage() {
  const shelf = await listProductStock();
  const grid = buildGrid(shelf);
  const stray = offGrid(shelf);

  return (
    <>
      <div className="mb-[18px]">
        <h1 className="text-title font-medium">Warehouse layout</h1>
        <Muted className="mt-[6px] max-w-[460px]">
          Every bin is read from the warehouse code on the product. Nothing
          about the layout is stored separately.
        </Muted>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-[10px]">
          <div>
            <SectionTitle>Bins</SectionTitle>
            <Muted>
              {LINES} lines · {BINS_PER_LINE} bins per line · {TOTAL_BINS} bins
              total · {n(occupiedCount(grid))} in use
            </Muted>
          </div>
          <BinLegend />
        </div>

        <BinGrid grid={grid} />

        {stray.length > 0 ? (
          <Card soft className="mt-[14px]">
            <SectionTitle>Off the grid</SectionTitle>
            <Muted className="mb-2">
              {stray.length === 1 ? "1 product sits" : `${n(stray.length)} products sit`}{" "}
              outside the {LINES} × {BINS_PER_LINE} grid. Fix the warehouse code
              to place {stray.length === 1 ? "it" : "them"}.
            </Muted>
            <ul className="flex flex-col gap-1">
              {stray.map((product) => (
                <li key={product.id} className="text-body">
                  {product.name}{" "}
                  <span className="font-mono text-meta text-ink-3">
                    {product.sku} · {product.warehouse_code}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </Card>
    </>
  );
}
