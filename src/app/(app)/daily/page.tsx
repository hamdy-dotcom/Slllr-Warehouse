import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Card, Empty, Muted } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import {
  inProgressBySupplier,
  listSuppliers,
  outstandingBySupplier,
} from "@/lib/data/wallet";
import { SupplierPicker } from "@/app/(app)/wallet/supplier-picker";
import { DailyForm } from "./daily-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("daily.title")} · ${t("app.titleSuffix")}` };
}

/** Yesterday, in the same `YYYY-MM-DD` shape the RPC takes. */
function yesterday(now: number = Date.now()): string {
  return new Date(now - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default async function DailyPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string }>;
}) {
  const profile = await requireProfile();
  // Only Sllr settles; a supplier landing here belongs on its own wallet.
  if (profile.role === "supplier") redirect("/wallet");

  const params = await searchParams;
  const [t, suppliers] = await Promise.all([
    getTranslations("daily"),
    listSuppliers(profile),
  ]);

  const selectedId =
    suppliers.find((supplier) => supplier.id === params.supplier)?.id ??
    suppliers[0]?.id ??
    null;

  const supplier = suppliers.find((row) => row.id === selectedId) ?? null;

  const [outstanding, inProgress] = selectedId
    ? await Promise.all([
        outstandingBySupplier(selectedId),
        inProgressBySupplier(selectedId),
      ])
    : [[], []];

  return (
    <>
      <div className="mb-[18px] flex flex-wrap items-start justify-between gap-[14px]">
        <div>
          <h1 className="text-title font-medium">{t("title")}</h1>
          <Muted className="mt-[6px] max-w-[520px]">{t("lede")}</Muted>
        </div>

        {suppliers.length > 1 && selectedId ? (
          <SupplierPicker suppliers={suppliers} selected={selectedId} />
        ) : null}
      </div>

      {!supplier ? (
        <Card>
          <Empty>{t("noSuppliers")}</Empty>
        </Card>
      ) : (
        <DailyForm
          outstanding={outstanding}
          inProgress={inProgress}
          defaultDate={yesterday()}
          supplierId={supplier.id}
          supplierName={supplier.name}
        />
      )}
    </>
  );
}
