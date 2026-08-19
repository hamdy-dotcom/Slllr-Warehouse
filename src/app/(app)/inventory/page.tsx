import type { Metadata } from "next";

import { ProductMini } from "@/components/product-thumb";
import { ShelfToolbar } from "@/components/shelf-toolbar";
import { Card, Empty, Muted } from "@/components/ui/card";
import { requireSupplier } from "@/lib/auth";
import { listProductStock } from "@/lib/data/products";
import { applyShelfFilter, isShelfFilter, type ShelfFilter } from "@/lib/shelf";
import { n, relativeTime } from "@/lib/format";
import { AddProductButton, EditProductButton } from "./product-dialog";

export const metadata: Metadata = { title: "Inventory · Sllr warehouse" };

const TH =
  "px-[10px] pb-[10px] text-left text-th font-normal uppercase tracking-[0.4px] text-ink-2";
const TD = "border-t border-line px-[10px] py-[13px] align-middle";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  await requireSupplier();

  const { q = "", filter } = await searchParams;
  const active: ShelfFilter = isShelfFilter(filter) ? filter : "all";

  const shelf = await listProductStock();
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
        <AddProductButton />
      </ShelfToolbar>

      <Card>
        {visible.length === 0 ? (
          <Empty>
            {shelf.length === 0
              ? "Nothing on the shelf yet. Add a product to start."
              : "Nothing matches that. Try a different SKU or clear the filter."}
          </Empty>
        ) : (
          <div className="scroll-x">
            <table className="w-full border-collapse text-body">
              <thead>
                <tr>
                  <th className={TH}>Product</th>
                  <th className={TH}>Warehouse code</th>
                  <th className={TH}>Total</th>
                  <th className={TH}>Reserved</th>
                  <th className={TH}>Pending</th>
                  <th className={TH}>Free</th>
                  <th className={TH}>Updated</th>
                  <th className={TH}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((product) => (
                  <tr key={product.id}>
                    <td className={`${TD} rounded-l-[14px]`}>
                      <div className="flex items-center gap-[11px]">
                        <ProductMini
                          src={product.image_url}
                          alt={product.name}
                        />
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <div className="font-mono text-meta text-ink-3">
                            {product.sku}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={`${TD} font-mono text-meta text-ink-3`}>
                      {product.warehouse_code}
                    </td>
                    <td className={TD}>
                      <b className="font-medium">{n(product.total_qty)}</b>
                    </td>
                    <td className={`${TD} text-orange`}>
                      {n(product.reserved_qty)}
                    </td>
                    <td className={`${TD} text-amber-ink`}>
                      {n(product.pending_qty)}
                    </td>
                    <td className={TD}>
                      <b
                        className={
                          product.free_qty < 0
                            ? "font-medium text-orange"
                            : "font-medium"
                        }
                      >
                        {n(product.free_qty)}
                      </b>
                    </td>
                    <td className={`${TD} text-label text-ink-2`}>
                      {relativeTime(product.updated_at)}
                    </td>
                    <td className={`${TD} rounded-r-[14px] text-right`}>
                      <EditProductButton product={product} />
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
