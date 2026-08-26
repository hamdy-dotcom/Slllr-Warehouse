"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Select } from "@/components/ui/field";
import { PO_STATUSES, poStatusKey } from "@/lib/po";

/**
 * Status, supplier and product search for the PO table, held in the URL like
 * every other filter here so the section stays a server read and a view is
 * shareable.
 *
 * A supplier only ever has one supplier to pick, so that control is dropped
 * rather than shown with a single option — the view already scopes the rows.
 */
export function PoFilters({
  status,
  supplierId,
  q,
  suppliers,
  children,
}: {
  status?: string;
  supplierId?: string;
  q?: string;
  suppliers: { id: string; name: string }[];
  /** Trailing action, e.g. the release button. */
  children?: React.ReactNode;
}) {
  const t = useTranslations("po");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [text, setText] = useState(q ?? "");

  useEffect(() => setText(q ?? ""), [q]);

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

  // Debounce so typing does not fire a request per keystroke.
  useEffect(() => {
    if (text === (q ?? "")) return;
    const id = setTimeout(() => push("po_q", text), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className="mb-[14px] flex flex-wrap items-center gap-[10px]">
      <div className="flex min-w-[200px] flex-1 items-center gap-[9px] rounded-[15px] bg-card-soft px-[15px] py-[10px]">
        <span aria-hidden className="text-ink-3">
          ⌕
        </span>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchLabel")}
          className="w-full border-none bg-transparent text-body outline-none placeholder:text-ink-3"
        />
      </div>

      <label className="flex items-center gap-[9px] rounded-[15px] bg-card-soft px-[15px] py-[8px] text-label text-ink-2">
        {t("filterStatus")}
        <Select
          value={status ?? ""}
          aria-label={t("filterStatus")}
          onChange={(event) => push("po_status", event.target.value)}
          className="min-w-[160px] border-none bg-tint py-[7px]"
        >
          <option value="">{t("allStatuses")}</option>
          {PO_STATUSES.map((option) => (
            <option key={option} value={option}>
              {t(poStatusKey(option) as string)}
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
            className="min-w-[170px] border-none bg-tint py-[7px]"
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

      {children}
    </div>
  );
}
