import { ProductThumb } from "@/components/product-thumb";
import { StockBar } from "@/components/ui/stock-bar";
import { n } from "@/lib/format";
import type { ProductStock } from "@/lib/types";

export function ProductCard({
  product,
  action,
}: {
  product: ProductStock;
  /** Full-width action at the foot of the card. */
  action?: React.ReactNode;
}) {
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
        <div className="text-product font-medium">{product.name}</div>
        <div className="font-mono text-meta text-ink-3">{product.sku}</div>
      </div>

      <StockBar
        reserved={product.reserved_qty}
        pending={product.pending_qty}
        total={product.total_qty}
      />

      <div className="flex justify-between text-th text-ink-2">
        <span>
          Reserved <b className="text-ink">{n(product.reserved_qty)}</b>
        </span>
        <span>
          Free{" "}
          <b className={oversold ? "text-orange" : "text-ink"}>
            {n(product.free_qty)}
          </b>
        </span>
      </div>

      {action}
    </div>
  );
}
