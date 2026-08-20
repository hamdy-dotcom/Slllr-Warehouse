import type { Metadata } from "next";

import { ProductMini } from "@/components/product-thumb";
import { Card, Empty, Muted, SectionTitle } from "@/components/ui/card";
import { requireSupplier } from "@/lib/auth";
import { availableToGrant, listPendingApprovals } from "@/lib/data/requests";
import { formatDate, n } from "@/lib/format";
import {
  lineValue,
  money,
  rollValue,
  unitCost,
  unpricedNote,
} from "@/lib/money";
import { ApprovalActions } from "./approval-actions";

export const metadata: Metadata = { title: "Approvals · Sllr warehouse" };

export default async function ApprovalsPage() {
  await requireSupplier();

  const pending = await listPendingApprovals();

  const asked = rollValue(
    pending,
    (request) => request.qty_requested,
    (request) => request.unit_cost,
  );
  const caveat = unpricedNote(asked);

  return (
    <>
      <div className="mb-[18px]">
        <h1 className="text-title font-medium">Approvals</h1>
        <Muted className="mt-[6px] max-w-[460px]">
          Approving moves units into Reserved for Sllr. A partial approve keeps
          the original request on record.
        </Muted>
      </div>

      <Card>
        <SectionTitle>Waiting on you</SectionTitle>
        <Muted className="mb-4">
          {pending.length === 1
            ? "1 request waiting."
            : `${n(pending.length)} requests waiting.`}{" "}
          {pending.length > 0 ? (
            <>
              Worth <b className="text-amber-ink">{money(asked.total)}</b>, each
              at the cost it was requested at.
              {caveat ? ` ${caveat}.` : ""}
            </>
          ) : null}
        </Muted>

        {pending.length === 0 ? (
          <Empty>
            Nothing waiting. Approved requests show up in the inventory table.
          </Empty>
        ) : (
          <div className="flex flex-col gap-[11px]">
            {pending.map((request) => {
              const available = availableToGrant(request.product);
              const short = request.qty_requested - available;

              return (
                <Card key={request.id} soft>
                  <div className="flex flex-wrap items-center gap-[11px]">
                    <ProductMini
                      src={request.product.image_url}
                      alt={request.product.name}
                      className="size-[54px]"
                    />

                    <div className="min-w-[220px] flex-1">
                      <div className="text-product font-medium">
                        {request.product.name} · {n(request.qty_requested)}{" "}
                        units
                      </div>
                      <div className="font-mono text-meta text-ink-3">
                        {request.product.sku} · {request.product.warehouse_code}
                      </div>
                      <div className="mt-1 text-[12px] text-ink-2">
                        {request.unit_cost === null ? (
                          <span className="text-ink-3">Not priced</span>
                        ) : (
                          <>
                            {unitCost(request.unit_cost)} per unit · worth{" "}
                            <b className="text-amber-ink">
                              {money(
                                lineValue(
                                  request.qty_requested,
                                  request.unit_cost,
                                ),
                              )}
                            </b>
                          </>
                        )}
                      </div>
                      <div
                        className={`mt-1 text-[12px] ${
                          short > 0 ? "text-orange" : "text-ink-2"
                        }`}
                      >
                        {short > 0
                          ? `Exceeds what is left to grant by ${n(
                              short,
                            )} — approve ${n(Math.max(available, 0))} instead`
                          : `Leaves ${n(
                              available - request.qty_requested,
                            )} to grant · hold until ${formatDate(
                              request.hold_until,
                            )}`}
                      </div>
                      {request.note ? (
                        <div className="mt-1 text-[12px] text-ink-3">
                          &ldquo;{request.note}&rdquo;
                        </div>
                      ) : null}
                    </div>

                    <ApprovalActions
                      id={request.id}
                      productName={request.product.name}
                      qtyRequested={request.qty_requested}
                      available={available}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
