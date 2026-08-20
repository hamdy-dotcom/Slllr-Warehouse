"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Select } from "@/components/ui/field";
import type { SupplierOption } from "@/lib/data/wallet";

/** Which supplier's wallet is on screen. Lives in the URL so it is shareable. */
export function SupplierPicker({
  suppliers,
  selected,
}: {
  suppliers: SupplierOption[];
  selected: string;
}) {
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-[9px] rounded-[15px] bg-card px-[15px] py-[8px] text-label text-ink-2">
      {t("supplier")}
      <Select
        value={selected}
        aria-label={t("supplier")}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams);
          params.set("supplier", event.target.value);
          startTransition(() => {
            router.replace(`${pathname}?${params.toString()}`, {
              scroll: false,
            });
          });
        }}
        className="min-w-[200px] border-none bg-tint py-[7px]"
      >
        {suppliers.map((supplier) => (
          <option key={supplier.id} value={supplier.id}>
            {supplier.name}
          </option>
        ))}
      </Select>
    </label>
  );
}
