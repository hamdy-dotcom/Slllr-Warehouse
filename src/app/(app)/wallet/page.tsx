import type { Metadata } from "next";

import { Card, Empty, Muted, SectionTitle } from "@/components/ui/card";
import { Pill } from "@/components/ui/tag";
import { requireProfile } from "@/lib/auth";
import {
  inProgressBySupplier,
  listSuppliers,
  listWallets,
  walletLedger,
} from "@/lib/data/wallet";
import { formatDate, n } from "@/lib/format";
import { money } from "@/lib/money";
import { RecordPaymentButton } from "./payment-dialog";
import { RecordSettlementsButton } from "./settle-dialog";
import { SupplierPicker } from "./supplier-picker";

export const metadata: Metadata = { title: "Wallet · Sllr warehouse" };

const TH =
  "px-[10px] pb-[10px] text-left text-th font-normal uppercase tracking-[0.4px] text-ink-2";
const TD = "border-t border-line px-[10px] py-[13px] align-middle";

const KIND_STYLE = {
  delivered: "bg-green-soft text-green",
  returned: "bg-amber-soft text-amber-ink",
  payment: "bg-neutral-soft text-ink-2",
} as const;

const KIND_LABEL = {
  delivered: "Delivered",
  returned: "Returned",
  payment: "Payment",
} as const;

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string }>;
}) {
  const profile = await requireProfile();
  const params = await searchParams;

  const [wallets, suppliers] = await Promise.all([
    listWallets(profile),
    listSuppliers(profile),
  ]);

  const canRecord = profile.role !== "supplier";
  const today = new Date().toISOString().slice(0, 10);

  const selectedId =
    wallets.find((wallet) => wallet.supplier_id === params.supplier)
      ?.supplier_id ??
    wallets[0]?.supplier_id ??
    null;

  const wallet = wallets.find((row) => row.supplier_id === selectedId) ?? null;

  const [ledger, lines] = selectedId
    ? await Promise.all([
        walletLedger(selectedId),
        canRecord ? inProgressBySupplier(selectedId) : Promise.resolve([]),
      ])
    : [[], []];

  return (
    <>
      <div className="mb-[18px] flex flex-wrap items-start justify-between gap-[14px]">
        <div>
          <h1 className="text-title font-medium">Wallet</h1>
          <Muted className="mt-[6px] max-w-[520px]">
            {canRecord
              ? "What each supplier is owed for stock Sllr has taken delivery of, and what has been paid."
              : "What you are owed for stock Sllr has taken delivery of, and what has been paid."}
          </Muted>
        </div>

        <div className="flex flex-wrap items-center gap-[10px]">
          {canRecord && suppliers.length > 1 && selectedId ? (
            <SupplierPicker suppliers={suppliers} selected={selectedId} />
          ) : null}
          {canRecord && wallet ? (
            <>
              <RecordSettlementsButton lines={lines} today={today} />
              <RecordPaymentButton
                supplierId={wallet.supplier_id}
                supplierName={wallet.supplier_name}
                balance={wallet.balance}
                today={today}
              />
            </>
          ) : null}
        </div>
      </div>

      {!wallet ? (
        <Card>
          <Empty>No wallet to show yet.</Empty>
        </Card>
      ) : (
        <>
          <div className="mb-[22px] grid gap-[14px] sm:grid-cols-2">
            <Card>
              <div className="text-label text-ink-2">Balance owed</div>
              <div className="mt-[2px] text-kpi font-medium tabular-nums text-orange">
                {money(wallet.balance)}
              </div>
              <div className="mt-[2px] text-body text-ink-3">
                {money(wallet.delivered_value)} delivered −{" "}
                {money(wallet.paid_total)} paid
              </div>
              <div className="mt-3">
                <Pill tone={wallet.balance > 0 ? "hot" : "good"}>
                  {wallet.balance > 0 ? "payable now" : "nothing outstanding"}
                </Pill>
              </div>
            </Card>

            <Card soft>
              <div className="text-label text-ink-2">In progress</div>
              <div className="mt-[2px] text-kpi font-medium tabular-nums">
                {money(wallet.in_progress_value)}
              </div>
              <div className="mt-[2px] text-body text-ink-3">
                {n(wallet.in_progress_qty)} units released, not yet settled
              </div>
              <div className="mt-3">
                <Pill tone="calm">not owed yet</Pill>
              </div>
              <Muted className="mt-[10px] max-w-[380px] text-meta">
                These units have left the shelf but have not been confirmed as
                delivered or returned. Nothing here is payable until they are.
              </Muted>
            </Card>
          </div>

          <Card>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-[14px]">
              <div>
                <SectionTitle>Ledger</SectionTitle>
                <Muted>
                  {ledger.length === 0
                    ? "Nothing settled or paid yet."
                    : `${n(ledger.length)} ${ledger.length === 1 ? "entry" : "entries"} · newest first`}
                </Muted>
              </div>
              <div className="flex flex-wrap gap-x-[28px] gap-y-[6px] text-label text-ink-2">
                <span>
                  Delivered{" "}
                  <b className="font-medium text-green">
                    {money(wallet.delivered_value)}
                  </b>
                </span>
                <span>
                  Returned{" "}
                  <b className="font-medium text-amber-ink">
                    {money(wallet.returned_value)}
                  </b>
                </span>
                <span>
                  Paid{" "}
                  <b className="font-medium text-ink">
                    {money(wallet.paid_total)}
                  </b>
                </span>
              </div>
            </div>

            {ledger.length === 0 ? (
              <Empty>
                Deliveries, returns, and payments show up here on one timeline.
              </Empty>
            ) : (
              <div className="scroll-x">
                <table className="w-full border-collapse text-body">
                  <thead>
                    <tr>
                      <th className={TH}>Date</th>
                      <th className={TH}>Entry</th>
                      <th className={TH}>Product</th>
                      <th className={TH}>Qty</th>
                      <th className={TH}>Amount</th>
                      <th className={TH}>Balance</th>
                      <th className={TH}>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((entry) => (
                      <tr key={`${entry.kind}-${entry.id}`}>
                        <td className={`${TD} rounded-l-[14px] text-label`}>
                          {formatDate(entry.on)}
                        </td>

                        <td className={TD}>
                          <span
                            className={`inline-block rounded-pill px-[10px] py-[4px] text-meta ${KIND_STYLE[entry.kind]}`}
                          >
                            {KIND_LABEL[entry.kind]}
                          </span>
                        </td>

                        <td className={TD}>
                          {entry.productName ? (
                            <>
                              <div className="font-medium">
                                {entry.productName}
                              </div>
                              <div className="font-mono text-meta text-ink-3">
                                {entry.sku}
                              </div>
                            </>
                          ) : (
                            <span className="text-ink-3">
                              {entry.method ?? "—"}
                            </span>
                          )}
                        </td>

                        <td className={`${TD} tabular-nums`}>
                          {entry.qty === null ? (
                            <span className="text-ink-3">—</span>
                          ) : (
                            n(entry.qty)
                          )}
                        </td>

                        <td className={`${TD} tabular-nums`}>
                          {entry.amount === 0 ? (
                            <span className="text-ink-3">—</span>
                          ) : (
                            <b
                              className={
                                entry.amount > 0
                                  ? "font-medium text-green"
                                  : "font-medium text-ink-2"
                              }
                            >
                              {entry.amount > 0 ? "+" : "−"}
                              {money(Math.abs(entry.amount))}
                            </b>
                          )}
                        </td>

                        <td className={`${TD} tabular-nums font-medium`}>
                          {money(entry.runningBalance)}
                        </td>

                        <td className={`${TD} text-label text-ink-2`}>
                          {entry.reference ? (
                            <span className="font-mono text-meta">
                              {entry.reference}
                            </span>
                          ) : (
                            <span className="text-ink-3">—</span>
                          )}
                          {entry.note ? (
                            <div className="text-meta text-ink-3">
                              {entry.note}
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
      )}
    </>
  );
}
