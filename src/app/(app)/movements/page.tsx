import type { Metadata } from "next";

import { ProductMini } from "@/components/product-thumb";
import { Card, Empty, Muted, SectionTitle } from "@/components/ui/card";
import { requireSupplier } from "@/lib/auth";
import { listProductStock } from "@/lib/data/products";
import {
  LEDGER_LIMIT,
  listMovements,
  movementTotals,
} from "@/lib/data/movements";
import { n, relativeTime } from "@/lib/format";
import {
  DIRECTION_LABELS,
  KIND_LABELS,
  isDirection,
  isMovementKind,
  signedQty,
} from "@/lib/movements";
import { MovementFilters } from "./movement-filters";
import { RecordMovementButton } from "./record-dialog";

export const metadata: Metadata = { title: "Movements · Sllr warehouse" };

const TH =
  "px-[10px] pb-[10px] text-left text-th font-normal uppercase tracking-[0.4px] text-ink-2";
const TD = "border-t border-line px-[10px] py-[13px] align-middle";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<{
    direction?: string;
    kind?: string;
    from?: string;
    to?: string;
    q?: string;
  }>;
}) {
  await requireSupplier();

  const params = await searchParams;
  const direction = isDirection(params.direction)
    ? params.direction
    : undefined;
  const kind = isMovementKind(params.kind) ? params.kind : undefined;
  const from = ISO_DATE.test(params.from ?? "") ? params.from! : "";
  const to = ISO_DATE.test(params.to ?? "") ? params.to! : "";
  const q = params.q ?? "";

  const [movements, shelf, totals] = await Promise.all([
    listMovements({ direction, kind, from, to, q }),
    listProductStock(),
    movementTotals(30),
  ]);

  return (
    <>
      <div className="mb-[18px]">
        <h1 className="text-title font-medium">Movements</h1>
        <Muted className="mt-[6px] max-w-[520px]">
          Everything that has come onto your shelf or left it. Outbound stock
          can never take a product below what is reserved for Sllr.
        </Muted>
      </div>

      <Card soft className="mb-[22px]">
        <div className="flex flex-wrap items-start gap-x-[42px] gap-y-[16px]">
          <div>
            <div className="flex items-center gap-[6px] text-label text-ink-2">
              <i className="inline-block h-[5px] w-[14px] shrink-0 rounded-[3px] bg-green" />
              Inbound, last {totals.days} days
            </div>
            <div className="mt-[2px] text-kpi font-medium tabular-nums">
              {signedQty("in", totals.inbound)}
            </div>
            <div className="mt-[2px] text-body text-ink-3">
              {n(totals.inboundCount)}{" "}
              {totals.inboundCount === 1 ? "movement" : "movements"}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-[6px] text-label text-ink-2">
              <i className="inline-block h-[5px] w-[14px] shrink-0 rounded-[3px] bg-orange" />
              Outbound, last {totals.days} days
            </div>
            <div className="mt-[2px] text-kpi font-medium tabular-nums">
              {signedQty("out", totals.outbound)}
            </div>
            <div className="mt-[2px] text-body text-ink-3">
              {n(totals.outboundCount)}{" "}
              {totals.outboundCount === 1 ? "movement" : "movements"}
            </div>
          </div>

          <div>
            <div className="text-label text-ink-2">Net</div>
            <div className="mt-[2px] text-kpi font-medium tabular-nums">
              {signedQty(
                totals.inbound - totals.outbound >= 0 ? "in" : "out",
                totals.inbound - totals.outbound,
              )}
            </div>
            <div className="mt-[2px] text-body text-ink-3">units</div>
          </div>
        </div>
      </Card>

      <MovementFilters
        direction={direction}
        kind={kind}
        from={from}
        to={to}
        q={q}
      >
        <RecordMovementButton direction="out" shelf={shelf} />
        <RecordMovementButton direction="in" shelf={shelf} />
      </MovementFilters>

      <Card>
        <SectionTitle>Ledger</SectionTitle>
        <Muted className="mb-4">
          {movements.length === 0
            ? "Nothing matches those filters."
            : `${n(movements.length)} ${movements.length === 1 ? "movement" : "movements"}${
                movements.length === LEDGER_LIMIT
                  ? ` · showing the most recent ${n(LEDGER_LIMIT)}, narrow the dates to see further back`
                  : ""
              }`}
        </Muted>

        {movements.length === 0 ? (
          <Empty>
            No movements yet. Record what arrives and what leaves and it shows
            up here.
          </Empty>
        ) : (
          <div className="scroll-x">
            <table className="w-full border-collapse text-body">
              <thead>
                <tr>
                  <th className={TH}>When</th>
                  <th className={TH}>Product</th>
                  <th className={TH}>Direction</th>
                  <th className={TH}>Kind</th>
                  <th className={TH}>Qty</th>
                  <th className={TH}>Resulting qty</th>
                  <th className={TH}>Reference</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td
                      className={`${TD} rounded-l-[14px] text-label text-ink-2`}
                    >
                      {relativeTime(movement.created_at)}
                    </td>

                    <td className={TD}>
                      <div className="flex items-center gap-[11px]">
                        <ProductMini
                          src={movement.product.image_url}
                          alt={movement.product.name}
                        />
                        <div>
                          <div className="font-medium">
                            {movement.product.name}
                          </div>
                          <div className="font-mono text-meta text-ink-3">
                            {movement.product.sku} ·{" "}
                            {movement.product.warehouse_code}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className={TD}>
                      <span
                        className={`inline-block rounded-pill px-[10px] py-[4px] text-meta ${
                          movement.direction === "in"
                            ? "bg-green-soft text-green"
                            : "bg-orange-soft text-orange-ink"
                        }`}
                      >
                        {DIRECTION_LABELS[movement.direction]}
                      </span>
                    </td>

                    <td className={`${TD} text-label text-ink-2`}>
                      {KIND_LABELS[movement.kind]}
                    </td>

                    <td className={TD}>
                      <b
                        className={`font-medium tabular-nums ${
                          movement.direction === "in"
                            ? "text-green"
                            : "text-orange"
                        }`}
                      >
                        {signedQty(movement.direction, movement.delta)}
                      </b>
                    </td>

                    <td className={`${TD} tabular-nums`}>
                      {n(movement.qty_after)}
                    </td>

                    <td className={`${TD} text-label text-ink-2`}>
                      {movement.reference ? (
                        <span className="font-mono text-meta">
                          {movement.reference}
                        </span>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                      {movement.note ? (
                        <div className="text-meta text-ink-3">
                          {movement.note}
                        </div>
                      ) : null}
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
