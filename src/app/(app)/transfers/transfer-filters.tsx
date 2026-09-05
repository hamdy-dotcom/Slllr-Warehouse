"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Select } from "@/components/ui/field";
import { TRANSFER_STATUSES, transferStatusKey } from "@/lib/transfers";

/** Search and status for the queue, in the URL so the page stays a server read. */
export function TransferFilters({
  status,
  q,
  children,
}: {
  status?: string;
  q?: string;
  children?: React.ReactNode;
}) {
  const t = useTranslations("transfers");
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

  useEffect(() => {
    if (text === (q ?? "")) return;
    const id = setTimeout(() => push("q", text), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className="mb-[14px] flex flex-wrap items-center gap-[10px]">
      <div className="flex min-w-[200px] flex-1 items-center gap-[9px] rounded-[15px] bg-card px-[15px] py-[11px]">
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

      <label className="flex items-center gap-[9px] rounded-[15px] bg-card px-[15px] py-[8px] text-label text-ink-2">
        {t("filterStatus")}
        <Select
          value={status ?? ""}
          aria-label={t("filterStatus")}
          onChange={(event) => push("status", event.target.value)}
          className="min-w-[150px] border-none bg-tint py-[7px]"
        >
          <option value="">{t("allStatuses")}</option>
          {TRANSFER_STATUSES.map((option) => (
            <option key={option} value={option}>
              {t(transferStatusKey(option) as string)}
            </option>
          ))}
        </Select>
      </label>

      {children}
    </div>
  );
}
