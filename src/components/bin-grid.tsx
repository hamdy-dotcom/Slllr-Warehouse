"use client";

import { useState } from "react";

import { ProductMini } from "@/components/product-thumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { n } from "@/lib/format";
import type { Bin, BinTone } from "@/lib/warehouse";

const toneStyles: Record<BinTone, string> = {
  empty: "bg-bin-empty text-ink-3",
  neutral: "bg-bin-empty text-ink-3",
  low: "bg-amber text-[#5B3F04]",
  heavy: "bg-orange text-white",
};

export function BinGrid({ grid }: { grid: Bin[][] }) {
  const [selected, setSelected] = useState<string | null>(null);

  const selectedBin =
    grid.flat().find((bin) => bin.key === selected && bin.products.length > 0) ??
    null;

  return (
    <>
      <div className="scroll-x flex gap-4 pt-3">
        {grid.map((line) => (
          <div key={line[0].line} className="min-w-[74px]">
            <div className="mb-[7px] text-meta text-ink-2">
              Line {String(line[0].line).padStart(2, "0")}
            </div>

            <div className="grid grid-cols-2 gap-1">
              {line.map((bin) => {
                const occupied = bin.products.length > 0;

                return (
                  <button
                    key={bin.key}
                    type="button"
                    disabled={!occupied}
                    aria-pressed={occupied ? selected === bin.key : undefined}
                    aria-label={
                      occupied
                        ? `Bin ${bin.key}, ${bin.products
                            .map((product) => product.name)
                            .join(", ")}, ${n(bin.freeQty)} free`
                        : `Bin ${bin.key}, empty`
                    }
                    onClick={() =>
                      setSelected(selected === bin.key ? null : bin.key)
                    }
                    className={cn(
                      "grid h-[19px] place-items-center rounded-bin text-[9.5px] transition-transform duration-150",
                      toneStyles[bin.tone],
                      occupied
                        ? "cursor-pointer hover:scale-[1.18]"
                        : "cursor-default",
                      selected === bin.key && "outline-2 outline-offset-1 outline-ink",
                    )}
                  >
                    {bin.bin}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selectedBin ? (
        <BinPanel bin={selectedBin} onClose={() => setSelected(null)} />
      ) : null}
    </>
  );
}

function BinPanel({ bin, onClose }: { bin: Bin; onClose: () => void }) {
  return (
    <Card soft className="mt-[14px]">
      <div className="flex flex-col gap-3">
        {bin.products.map((product) => (
          <div key={product.id} className="flex items-center gap-[11px]">
            <ProductMini src={product.image_url} alt={product.name} />

            <div className="min-w-[160px] flex-1">
              <div className="text-product font-medium">{product.name}</div>
              <div className="font-mono text-meta text-ink-3">
                {product.sku} · {product.warehouse_code}
              </div>
            </div>

            <div className="text-right">
              <div className="text-label text-ink-2">free</div>
              <b
                className={cn(
                  "text-[17px] font-medium",
                  product.free_qty < 0 ? "text-orange" : "text-ink",
                )}
              >
                {n(product.free_qty)}
              </b>
            </div>
          </div>
        ))}

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function BinLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-[12px] text-ink-2">
      <span>
        <i className="mr-[6px] inline-block h-[5px] w-[22px] rounded-[3px] bg-orange align-middle" />
        Reserved heavy
      </span>
      <span>
        <i className="mr-[6px] inline-block h-[5px] w-[22px] rounded-[3px] bg-amber align-middle" />
        Running low
      </span>
      <span>
        <i className="mr-[6px] inline-block h-[5px] w-[22px] rounded-[3px] bg-bin-empty align-middle" />
        Empty bin
      </span>
    </div>
  );
}
