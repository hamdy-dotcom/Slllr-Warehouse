import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/tag";
import { money, unpricedNote, type ValueRoll } from "@/lib/money";
import { shelfValues } from "@/lib/shelf";
import type { ProductStock } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * One figure in the strip.
 *
 * The colour lives in a small swatch on the label, not in the number. Four
 * 26px figures in four different colours read as four competing headlines;
 * the swatches carry the same orange/amber coding as the stock bar while the
 * amounts stay in ink and scan as one row.
 */
function Figure({
  label,
  roll,
  swatch,
}: {
  label: string;
  roll: ValueRoll;
  swatch?: "orange" | "amber" | "track";
}) {
  return (
    <div>
      <div className="flex items-center gap-[6px] text-label text-ink-2">
        {swatch ? (
          <i
            className={cn(
              "inline-block h-[5px] w-[14px] shrink-0 rounded-[3px]",
              swatch === "orange" && "bg-orange",
              swatch === "amber" && "bg-amber",
              swatch === "track" && "bg-track-deep",
            )}
          />
        ) : null}
        {label}
      </div>
      <div className="mt-[2px] text-kpi font-medium tabular-nums">
        {money(roll.total)}
      </div>
    </div>
  );
}

/**
 * What the shelf on screen is worth. Sits above both the catalog and the
 * inventory so the value moves with whatever search and filter are applied.
 *
 * Rendered on `card-soft` so it reads as a summary band rather than a second
 * data card competing with the table underneath it.
 */
export function ValueSummary({ products }: { products: ProductStock[] }) {
  const values = shelfValues(products);
  const caveat = unpricedNote(values.stock);

  return (
    <Card soft className="mb-[22px]">
      <div className="flex flex-wrap items-start justify-between gap-[18px]">
        <div className="flex flex-wrap items-start gap-x-[42px] gap-y-[16px]">
          <Figure label="Stock value" roll={values.stock} />
          <Figure
            label="Reserved for Sllr"
            roll={values.reserved}
            swatch="orange"
          />
          <Figure
            label="Requested, awaiting approval"
            roll={values.pending}
            swatch="amber"
          />
          <Figure label="Free" roll={values.free} swatch="track" />
        </div>

        {caveat ? (
          <Pill tone="warn">{caveat}</Pill>
        ) : (
          <Pill>every SKU priced</Pill>
        )}
      </div>
    </Card>
  );
}
