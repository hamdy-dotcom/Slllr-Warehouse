import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

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
import { DEFAULT_SORT, isPoSort, isPoStatus } from "@/lib/po";
import { PoSection } from "./po-section";
import { RecordPaymentButton } from "./payment-dialog";
import { RecordSettlementsButton } from "./settle-dialog";
import { SupplierPicker } from "./supplier-picker";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("wallet.title")} · ${t("app.titleSuffix")}` };
}

const TH =
  "px-[10px] pb-[10px] text-start text-th font-normal uppercase tracking-[0.4px] text-ink-2";
const TD = "border-t border-line px-[10px] py-[13px] align-middle";

const KIND_STYLE = {
  delivered: "bg-green-soft text-green",
  returned: "bg-amber-soft text-amber-ink",
  payment: "bg-neutral-soft text-ink-2",
} as const;

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{
    supplier?: string;
    po_status?: string;
    po_supplier?: string;
    po_q?: string;
    po_sort?: string;
    po_dir?: string;
  }>;
}) {
  const profile = await requireProfile();
  const params = await searchParams;

  const [t, tc, locale, wallets, suppliers] = await Promise.all([
    getTranslations("wallet"),
    getTranslations("common"),
    getLocale(),
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
          <h1 className="text-title font-medium">{t("title")}</h1>
          <Muted className="mt-[6px] max-w-[520px]">
            {canRecord ? t("ledeSllr") : t("ledeSupplier")}
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
          <Empty>{t("noWallet")}</Empty>
        </Card>
      ) : (
        <>
          <div className="mb-[22px] grid gap-[14px] sm:grid-cols-2">
            <Card>
              <div className="text-label text-ink-2">{t("balanceOwed")}</div>
              <div className="mt-[2px] text-kpi font-medium tabular-nums text-orange">
                {money(wallet.balance)}
              </div>
              <div className="mt-[2px] text-body text-ink-3">
                {t("balanceBreakdown", {
                  delivered: money(wallet.delivered_value),
                  paid: money(wallet.paid_total),
                })}
              </div>
              <div className="mt-3">
                <Pill tone={wallet.balance > 0 ? "hot" : "good"}>
                  {wallet.balance > 0
                    ? t("payableNow")
                    : t("nothingOutstanding")}
                </Pill>
              </div>
            </Card>

            <Card soft>
              <div className="text-label text-ink-2">{t("inProgress")}</div>
              <div className="mt-[2px] text-kpi font-medium tabular-nums">
                {money(wallet.in_progress_value)}
              </div>
              <div className="mt-[2px] text-body text-ink-3">
                {t("inProgressUnits", { count: n(wallet.in_progress_qty) })}
              </div>
              <div className="mt-3">
                <Pill tone="calm">{t("notOwedYet")}</Pill>
              </div>
              <Muted className="mt-[10px] max-w-[380px] text-meta">
                {t("inProgressExplain")}
              </Muted>
            </Card>
          </div>

          <Card>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-[14px]">
              <div>
                <SectionTitle>{t("ledger")}</SectionTitle>
                <Muted>
                  {ledger.length === 0
                    ? t("nothingYet")
                    : t("entriesCount", { count: ledger.length })}
                </Muted>
              </div>
              <div className="flex flex-wrap gap-x-[28px] gap-y-[6px] text-label text-ink-2">
                <span>
                  {t("delivered")}{" "}
                  <b className="font-medium text-green">
                    {money(wallet.delivered_value)}
                  </b>
                </span>
                <span>
                  {t("returned")}{" "}
                  <b className="font-medium text-amber-ink">
                    {money(wallet.returned_value)}
                  </b>
                </span>
                <span>
                  {t("paid")}{" "}
                  <b className="font-medium text-ink">
                    {money(wallet.paid_total)}
                  </b>
                </span>
              </div>
            </div>

            {ledger.length === 0 ? (
              <Empty>{t("ledgerEmpty")}</Empty>
            ) : (
              <div className="scroll-x">
                <table className="w-full border-collapse text-body">
                  <thead>
                    <tr>
                      <th className={TH}>{tc("date")}</th>
                      <th className={TH}>{t("entry")}</th>
                      <th className={TH}>{tc("product")}</th>
                      <th className={TH}>{tc("qty")}</th>
                      <th className={TH}>{t("amount")}</th>
                      <th className={TH}>{t("balance")}</th>
                      <th className={TH}>{tc("reference")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((entry) => (
                      <tr key={`${entry.kind}-${entry.id}`}>
                        <td className={`${TD} rounded-s-[14px] text-label`}>
                          {formatDate(entry.on, locale)}
                        </td>

                        <td className={TD}>
                          <span
                            className={`inline-block rounded-pill px-[10px] py-[4px] text-meta ${KIND_STYLE[entry.kind]}`}
                          >
                            {t(`kind_${entry.kind}`)}
                          </span>
                        </td>

                        <td className={TD}>
                          {entry.productName ? (
                            <>
                              <div className="font-medium">
                                {entry.productName}
                              </div>
                              <div className="font-mono text-meta text-ink-3">
                                <span className="latin">{entry.sku}</span>
                              </div>
                            </>
                          ) : (
                            <span className="text-ink-3">
                              {entry.method ?? tc("dash")}
                            </span>
                          )}
                        </td>

                        <td className={`${TD} tabular-nums`}>
                          {entry.qty === null ? (
                            <span className="text-ink-3">{tc("dash")}</span>
                          ) : (
                            n(entry.qty)
                          )}
                        </td>

                        <td className={`${TD} tabular-nums`}>
                          {entry.amount === 0 ? (
                            <span className="text-ink-3">{tc("dash")}</span>
                          ) : (
                            <b
                              className={
                                entry.amount > 0
                                  ? "latin font-medium text-green"
                                  : "latin font-medium text-ink-2"
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
                            <span className="latin font-mono text-meta">
                              {entry.reference}
                            </span>
                          ) : (
                            <span className="text-ink-3">{tc("dash")}</span>
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

      {/* Outside the wallet branch on purpose: a supplier with nothing
          settled yet still has POs worth reading. */}
      <PoSection
        profile={profile}
        filter={{
          status: isPoStatus(params.po_status) ? params.po_status : undefined,
          supplierId: params.po_supplier || undefined,
          q: params.po_q || undefined,
        }}
        sort={isPoSort(params.po_sort) ? params.po_sort : DEFAULT_SORT}
        dir={params.po_dir === "desc" ? "desc" : "asc"}
      />
    </>
  );
}
