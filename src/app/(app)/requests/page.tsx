import type { Metadata } from "next";

import { ProductMini } from "@/components/product-thumb";
import { Card, Empty, Muted, SectionTitle } from "@/components/ui/card";
import { Pill, Tag } from "@/components/ui/tag";
import { listMyRequests } from "@/lib/data/requests";
import { formatDate, n, relativeTime } from "@/lib/format";
import {
  lineValue,
  money,
  rollValue,
  unitCost,
  unpricedNote,
} from "@/lib/money";
import { CancelButton } from "./cancel-button";

export const metadata: Metadata = { title: "My requests · Sllr warehouse" };

const TH =
  "px-[10px] pb-[10px] text-left text-th font-normal uppercase tracking-[0.4px] text-ink-2";
const TD = "border-t border-line px-[10px] py-[13px] align-middle";

export default async function RequestsPage() {
  const requests = await listMyRequests();

  // Approved is what Sllr actually holds; pending is what it has asked for.
  // Each line uses its own snapshot, so a later cost edit cannot rewrite these.
  const held = rollValue(
    requests.filter((request) => request.status === "approved"),
    (request) => request.qty_approved ?? 0,
    (request) => request.unit_cost,
  );
  const asked = rollValue(
    requests.filter((request) => request.status === "pending"),
    (request) => request.qty_requested,
    (request) => request.unit_cost,
  );
  const caveat = unpricedNote({
    total: 0,
    priced: held.priced + asked.priced,
    unpriced: held.unpriced + asked.unpriced,
  });

  return (
    <>
      <div className="mb-[18px]">
        <h1 className="text-title font-medium">My requests</h1>
        <Muted className="mt-[6px] max-w-[460px]">
          Approved quantity is what lands in Reserved for Sllr. Nothing is
          deducted before approval.
        </Muted>
      </div>

      <Card className="mb-[14px]">
        <div className="flex flex-wrap items-end justify-between gap-[18px]">
          <div className="flex flex-wrap items-end gap-x-[42px] gap-y-[14px]">
            <div>
              <div className="text-label text-ink-2">In custody, approved</div>
              <div className="text-kpi font-medium text-orange">
                {money(held.total)}
              </div>
            </div>
            <div>
              <div className="text-label text-ink-2">
                Requested, awaiting approval
              </div>
              <div className="text-kpi font-medium text-amber-ink">
                {money(asked.total)}
              </div>
            </div>
          </div>
          {caveat ? <Pill tone="warn">{caveat}</Pill> : null}
        </div>
      </Card>

      <Card>
        <SectionTitle>Reserve requests</SectionTitle>
        <Muted className="mb-4">
          {requests.length === 0
            ? "None sent yet."
            : `${n(requests.length)} sent · ${n(
                requests.filter((request) => request.status === "pending")
                  .length,
              )} waiting on the supplier`}
        </Muted>

        {requests.length === 0 ? (
          <Empty>
            Nothing sent yet. Reserve a product from the catalog and it shows up
            here.
          </Empty>
        ) : (
          <div className="scroll-x">
            <table className="w-full border-collapse text-body">
              <thead>
                <tr>
                  <th className={TH}>Product</th>
                  <th className={TH}>Unit cost</th>
                  <th className={TH}>Requested</th>
                  <th className={TH}>Approved</th>
                  <th className={TH}>Value</th>
                  <th className={TH}>Hold until</th>
                  <th className={TH}>Sent</th>
                  <th className={TH}>Note</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  // Partial approve leaves qty_requested alone, so both
                  // numbers stay on screen as the audit trail.
                  const partial =
                    request.status === "approved" &&
                    request.qty_approved !== null &&
                    request.qty_approved < request.qty_requested;

                  return (
                    <tr key={request.id}>
                      <td className={`${TD} rounded-l-[14px]`}>
                        <div className="flex items-center gap-[11px]">
                          <ProductMini
                            src={request.product.image_url}
                            alt={request.product.name}
                          />
                          <div>
                            <div className="font-medium">
                              {request.product.name}
                            </div>
                            <div className="font-mono text-meta text-ink-3">
                              {request.product.sku} ·{" "}
                              {request.product.warehouse_code}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td
                        className={`${TD} tabular-nums ${
                          request.unit_cost === null ? "text-ink-3" : ""
                        }`}
                      >
                        {unitCost(request.unit_cost)}
                      </td>

                      <td className={TD}>
                        <b className="font-medium tabular-nums">
                          {n(request.qty_requested)}
                        </b>
                      </td>
                      <td className={TD}>
                        {request.qty_approved === null ? (
                          <span className="text-ink-3">—</span>
                        ) : (
                          <span className={partial ? "text-amber-ink" : ""}>
                            <b className="font-medium">
                              {n(request.qty_approved)}
                            </b>
                            {partial ? (
                              <span className="ml-1 text-meta">partial</span>
                            ) : null}
                          </span>
                        )}
                      </td>
                      <td
                        className={`${TD} tabular-nums ${
                          request.unit_cost === null
                            ? "text-ink-3"
                            : "font-medium"
                        }`}
                      >
                        {money(
                          lineValue(
                            request.qty_approved ?? request.qty_requested,
                            request.unit_cost,
                          ),
                        )}
                      </td>

                      <td className={TD}>{formatDate(request.hold_until)}</td>
                      <td className={`${TD} text-label text-ink-2`}>
                        {relativeTime(request.created_at)}
                      </td>
                      <td
                        className={`${TD} max-w-[220px] text-label text-ink-2`}
                      >
                        {request.note || "—"}
                      </td>
                      <td className={TD}>
                        <Tag status={request.status} />
                      </td>
                      <td className={`${TD} rounded-r-[14px] text-right`}>
                        {request.status === "pending" ? (
                          <CancelButton id={request.id} />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
