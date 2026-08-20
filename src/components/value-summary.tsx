import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/tag";
import { money, unpricedNote, type ValueRoll } from "@/lib/money";
import { shelfValues } from "@/lib/shelf";
import type { ProductStock } from "@/lib/types";

function Figure({
  label,
  roll,
  tone,
}: {
  label: string;
  roll: ValueRoll;
  tone?: "orange" | "amber";
}) {
  return (
    <div>
      <div className="text-label text-ink-2">{label}</div>
      <div
        className={
          tone === "orange"
            ? "text-kpi font-medium text-orange"
            : tone === "amber"
              ? "text-kpi font-medium text-amber-ink"
              : "text-kpi font-medium"
        }
      >
        {money(roll.total)}
      </div>
    </div>
  );
}

/**
 * What the shelf on screen is worth. Sits above both the catalog and the
 * inventory so the value moves with whatever search and filter are applied.
 */
export function ValueSummary({ products }: { products: ProductStock[] }) {
  const values = shelfValues(products);
  const caveat = unpricedNote(values.stock);

  return (
    <Card className="mb-[14px]">
      <div className="flex flex-wrap items-end justify-between gap-[18px]">
        <div className="flex flex-wrap items-end gap-x-[42px] gap-y-[14px]">
          <Figure label="Stock value" roll={values.stock} />
          <Figure
            label="Reserved for Sllr"
            roll={values.reserved}
            tone="orange"
          />
          <Figure
            label="Requested, awaiting approval"
            roll={values.pending}
            tone="amber"
          />
          <Figure label="Free" roll={values.free} />
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
