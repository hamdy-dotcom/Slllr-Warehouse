import { useTranslations } from "next-intl";

import { ProductThumb } from "@/components/product-thumb";
import { StockBar } from "@/components/ui/stock-bar";
import { n } from "@/lib/format";
import { lineValue, money, unitCost } from "@/lib/money";
import type { ProductStock } from "@/lib/types";

/**
 * The grid view. Carries the same facts as a row — image, name, SKU,
 * warehouse code, total, reserved, pending, free — so switching layout
 * changes the shape, not the information.
 */
export function ProductCard({
  product,
  totalSlot,
  action,
}: {
  product: ProductStock;
  /** Replaces the total figure, e.g. the inventory's inline editor. */
  totalSlot?: React.ReactNode;
  /** Full-width action at the foot of the card. */
  action?: React.ReactNode;
}) {
  const t = useTranslations("common");
  const ts = useTranslations("shelf");
  const oversold = product.free_qty < 0;

  return (
    <div className="flex flex-col gap-[10px] rounded-card bg-card p-[13px]">
      <ProductThumb
        src={product.image_url}
        alt={product.name}
        code={product.warehouse_code}
        sizes="(max-width: 640px) 100vw, 232px"
        className="h-[126px]"
      />

      <div>
        <div className="flex items-center gap-2">
          <span className="text-product font-medium">{product.name}</span>
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

      <div className="flex items-center justify-between text-th text-ink-2">
        <span>{t("unitCost")}</span>
        <b
          className={
            product.unit_cost === null
              ? "font-normal text-ink-3"
              : "font-medium text-ink"
          }
        >
          {unitCost(product.unit_cost)}
        </b>
      </div>

      <StockBar
        reserved={product.reserved_qty}
        pending={product.pending_qty}
        total={product.total_qty}
      />

      <div className="flex items-center justify-between text-th text-ink-2">
        <span>{t("total")}</span>
        {totalSlot ?? (
          <b className="font-medium tabular-nums text-ink">
            {n(product.total_qty)}
          </b>
        )}
      </div>

      <div className="flex justify-between text-th text-ink-2">
        <span>
          {t("reserved")}{" "}
          <b className="text-orange">{n(product.reserved_qty)}</b>
        </span>
        <span>
          {t("pending")}{" "}
          <b className="text-amber-ink">{n(product.pending_qty)}</b>
        </span>
        <span>
          {t("free")}{" "}
          <b className={oversold ? "text-orange" : "text-ink"}>
            {n(product.free_qty)}
          </b>
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-line pt-[9px] text-th text-ink-2">
        <span>{t("reservedValue")}</span>
        <b
          className={
            product.unit_cost === null
              ? "font-normal text-ink-3"
              : "font-medium text-orange"
          }
        >
          {money(lineValue(product.reserved_qty, product.unit_cost))}
        </b>
      </div>

      {action}
    </div>
  );
}
