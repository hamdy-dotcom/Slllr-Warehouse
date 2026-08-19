import { Shell, Logo } from "@/components/ui/shell";
import { Card, SectionTitle, Muted, Meta, Row, Empty } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Kpi } from "@/components/ui/kpi";
import { StockBar } from "@/components/ui/stock-bar";
import { Tag, Pill } from "@/components/ui/tag";
import { Field, Input, Note, FieldError } from "@/components/ui/field";
import { PrimitivesDemo } from "@/components/primitives-demo";
import { n } from "@/lib/format";

/**
 * Placeholder while auth lands in step 2 — it doubles as a visual check that
 * every token and primitive matches `docs/DESIGN.md`.
 */
export default function Home() {
  return (
    <Shell>
      <div className="mb-[22px] flex flex-wrap items-center gap-[14px]">
        <Logo />
        <div className="ml-auto text-label text-ink-2">Design primitives</div>
      </div>

      <h1 className="text-title font-medium">Shared shelf, one set of numbers</h1>
      <Muted className="mt-[6px] max-w-[330px] text-[13.5px] leading-[1.55]">
        Reserve, approve, and watch the free stock move in one place. Sign-in
        arrives in the next step.
      </Muted>

      <div className="mt-[22px] grid gap-[14px] sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon="📦"
          label="Total stock"
          value={n(7950)}
          unit="units"
          pill="8 SKUs live"
          seed={1}
        />
        <Kpi
          icon="🔒"
          label="Reserved for Sllr"
          value={n(650)}
          unit="units"
          pill="8% of shelf"
          seed={2}
        />
        <Kpi
          icon="⏳"
          label="Pending approval"
          value={n(1100)}
          unit="units"
          pill="2 requests waiting"
          pillTone="warn"
          seed={3}
        />
        <Kpi
          icon="✅"
          label="Free stock"
          value={n(6200)}
          unit="units"
          pill="available now"
          seed={4}
        />
      </div>

      <div className="mt-[14px] grid gap-[14px] lg:grid-cols-3">
        <Card>
          <SectionTitle>Stock bar</SectionTitle>
          <Muted className="mb-[14px]">Orange reserved, amber pending.</Muted>
          <StockBar reserved={450} pending={600} total={1200} />
          <div className="mt-[10px] flex justify-between text-th text-ink-2">
            <span>
              Reserved <b className="text-ink">{n(450)}</b>
            </span>
            <span>
              Free <b className="text-orange">{n(-450)}</b>
            </span>
          </div>
          <Meta className="mt-3">SKU-1042 · L03-R02-B07</Meta>
        </Card>

        <Card>
          <SectionTitle>Tags and pills</SectionTitle>
          <Muted className="mb-[14px]">Every request status.</Muted>
          <div className="flex flex-wrap gap-[6px]">
            <Tag status="pending" />
            <Tag status="approved" />
            <Tag status="rejected" />
            <Tag status="cancelled" />
            <Tag status="consumed" />
          </div>
          <div className="mt-[14px] flex flex-wrap gap-[6px]">
            <Pill>available now</Pill>
            <Pill tone="warn">running low</Pill>
            <Pill tone="hot">oversold</Pill>
            <Pill tone="calm">no change</Pill>
          </div>
        </Card>

        <Card soft>
          <SectionTitle>Summary rows</SectionTitle>
          <Muted className="mb-2">Across all 8 SKUs</Muted>
          <Row label="Approved requests">2</Row>
          <Row label="Waiting on supplier">2</Row>
          <Row label="Bins in use">8 / 112</Row>
        </Card>
      </div>

      <div className="mt-[14px] grid gap-[14px] lg:grid-cols-2">
        <Card>
          <SectionTitle>Buttons and fields</SectionTitle>
          <Muted className="mb-[14px]">Actions name what they do.</Muted>
          <div className="mb-[14px] flex flex-wrap gap-[9px]">
            <Button>Reserve stock</Button>
            <Button variant="ghost">Update stock</Button>
            <Button variant="ok">Approve 340</Button>
            <Button variant="no">Reject</Button>
            <Button disabled>Send request</Button>
          </div>
          <Field label="Quantity" htmlFor="demo-qty">
            <Input id="demo-qty" type="number" defaultValue={450} min={1} />
          </Field>
          <FieldError>Enter a number of at least 450.</FieldError>
          <Note calm>
            Free now <b>1,200</b> → free after approval <b>750</b>
          </Note>
          <Note>Exceeds free stock by 450 — partial approve available.</Note>
        </Card>

        <div className="grid gap-[14px]">
          <PrimitivesDemo />
          <Card>
            <SectionTitle>Empty state</SectionTitle>
            <Empty>
              Nothing waiting. Approved requests show up in the inventory table.
            </Empty>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
