"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Input } from "@/components/ui/field";

/**
 * Date range, search and "edited only" for the recorded arrivals.
 *
 * Kept in the URL under its own keys so it never collides with the transfer
 * queue's filters higher up the page, and so the page stays a server read.
 */
export function ArrivalFilters({
  from,
  to,
  q,
  editedOnly,
}: {
  from?: string;
  to?: string;
  q?: string;
  editedOnly?: boolean;
}) {
  const t = useTranslations("arrivals");
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
    const id = setTimeout(() => push("aq", text), 250);
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
        {t("filterFrom")}
        <Input
          type="date"
          value={from ?? ""}
          aria-label={t("filterFrom")}
          onChange={(event) => push("from", event.target.value)}
          className="w-[150px] border-none bg-tint py-[7px]"
        />
      </label>

      <label className="flex items-center gap-[9px] rounded-[15px] bg-card px-[15px] py-[8px] text-label text-ink-2">
        {t("filterTo")}
        <Input
          type="date"
          value={to ?? ""}
          aria-label={t("filterTo")}
          onChange={(event) => push("to", event.target.value)}
          className="w-[150px] border-none bg-tint py-[7px]"
        />
      </label>

      <label className="flex cursor-pointer items-center gap-[9px] rounded-[15px] bg-card px-[15px] py-[11px] text-label text-ink-2">
        <input
          type="checkbox"
          checked={editedOnly ?? false}
          onChange={(event) => push("edited", event.target.checked ? "1" : "")}
          className="size-4 shrink-0 accent-orange"
        />
        {t("editedOnly")}
      </label>
    </div>
  );
}
