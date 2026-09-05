import { useTranslations } from "next-intl";

import { ProductMini } from "@/components/product-thumb";
import { n } from "@/lib/format";
import { money, unitCost } from "@/lib/money";
import type { ProductStock } from "@/lib/types";

const TH =
  "px-[10px] pb-[10px] text-start text-th font-normal uppercase tracking-[0.4px] text-ink-2";
const TD = "border-t border-line px-[10px] py-[13px] align-middle";

export type TrailingColumn = {
  header: string;
  /** Empty header renders as a screen-reader-only label. */
  cell: (product: ProductStock) => React.ReactNode;
};

/**
 * The rows view, shared by the catalog and the inventory. Both carry the same
 * facts — image, name, SKU, warehouse code, total, reserved, pending, free —
 * and each page adds what only it needs through `totalCell` and `trailing`.
 */
export function ProductTable({
  products,
  totalCell,
  trailing = [],
}: {
  products: ProductStock[];
  /** Overrides the total cell, e.g. the inventory's inline editor. */
  totalCell?: (product: ProductStock) => React.ReactNode;
  trailing?: TrailingColumn[];
}) {
  const t = useTranslations("common");
  const ts = useTranslations("shelf");

  return (
    <div className="scroll-x">
      <table className="w-full border-collapse text-body">
        <thead>
          <tr>
            <th className={TH}>{t("product")}</th>
            <th className={TH}>{t("warehouseCode")}</th>
            <th className={TH}>{t("unitCost")}</th>
            <th className={TH}>{t("total")}</th>
            <th className={TH}>{t("reserved")}</th>
            <th className={TH}>{t("pending")}</th>
            <th className={TH}>{t("free")}</th>
            <th className={TH}>{t("reservedValue")}</th>
            {trailing.map((column) => (
              <th key={column.header} className={TH}>
                {column.header ? (
                  column.header
                ) : (
                  <span className="sr-only">{t("actions")}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td className={`${TD} rounded-s-[14px]`}>
                <div className="flex items-center gap-[11px]">
                  <ProductMini src={product.image_url} alt={product.name} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{product.name}</span>
                      {product.is_active ? null : (
                        <span className="rounded-pill bg-neutral-soft px-[10px] py-[4px] text-meta text-ink-2">
                          {ts("unlisted")}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-meta text-ink-3">
                      <span className="latin">{product.sku}</span>
                    </div>
                  </div>
                </div>
              </td>

              <td className={`${TD} font-mono text-meta text-ink-3`}>
                <span className="latin">{product.warehouse_code}</span>
              </td>

              <td
                className={`${TD} tabular-nums ${
                  product.unit_cost === null ? "text-ink-3" : ""
                }`}
              >
                {unitCost(product.unit_cost)}
              </td>

              <td className={TD}>
                {totalCell ? (
                  totalCell(product)
                ) : (
                  <b className="font-medium tabular-nums">
                    {n(product.total_qty)}
                  </b>
                )}
              </td>

              <td className={`${TD} tabular-nums text-orange`}>
                {n(product.reserved_qty)}
              </td>

              <td className={`${TD} tabular-nums text-amber-ink`}>
                {n(product.pending_qty)}
              </td>

              <td className={TD}>
                <b
                  className={
                    product.free_qty < 0
                      ? "font-medium tabular-nums text-orange"
                      : "font-medium tabular-nums"
                  }
                >
                  {n(product.free_qty)}
                </b>
              </td>

              <td
                className={`${TD} tabular-nums ${
                  product.awaiting_transfer_value === null
                    ? "text-ink-3"
                    : "font-medium text-orange"
                }`}
              >
                {money(product.awaiting_transfer_value)}
              </td>

              {trailing.map((column, index) => (
                <td
                  key={column.header}
                  className={`${TD} ${
                    index === trailing.length - 1
                      ? "rounded-e-[14px] text-end"
                      : ""
                  }`}
                >
                  {column.cell(product)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
