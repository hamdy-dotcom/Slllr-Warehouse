"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Select } from "@/components/ui/field";
import { PO_STATUSES, PO_STATUS_KEYS } from "@/lib/po";

/**
 * Status and supplier for the PO list, held in the URL like every other
 * filter here so the section stays a server read and a view is shareable.
 *
 * A supplier only ever has one supplier to pick, so the picker is dropped
 * rather than shown with a single option — the view already scopes the rows.
 */
export function PoFilters({
  status,
  supplierId,
  suppliers,
}: {
  status?: string;
  supplierId?: string;
  suppliers: { id: string; name: string }[];
}) {
  const t = useTranslations("po");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function push(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);

    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
  }

  return (
    <div className="mb-[14px] flex flex-wrap items-center gap-[10px]">
      <label className="flex items-center gap-[9px] rounded-[15px] bg-card-soft px-[15px] py-[8px] text-label text-ink-2">
        {t("filterStatus")}
        <Select
          value={status ?? ""}
          aria-label={t("filterStatus")}
          onChange={(event) => push("po_status", event.target.value)}
          className="min-w-[170px] border-none bg-tint py-[7px]"
        >
          <option value="">{t("allStatuses")}</option>
          {PO_STATUSES.map((option) => (
            <option key={option} value={option}>
              {t(PO_STATUS_KEYS[option])}
            </option>
          ))}
        </Select>
      </label>

      {suppliers.length > 1 ? (
        <label className="flex items-center gap-[9px] rounded-[15px] bg-card-soft px-[15px] py-[8px] text-label text-ink-2">
          {t("filterSupplier")}
          <Select
            value={supplierId ?? ""}
            aria-label={t("filterSupplier")}
            onChange={(event) => push("po_supplier", event.target.value)}
            className="min-w-[180px] border-none bg-tint py-[7px]"
          >
            <option value="">{t("allSuppliers")}</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </Select>
        </label>
      ) : null}
    </div>
  );
}
