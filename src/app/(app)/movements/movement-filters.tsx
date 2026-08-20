"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  DIRECTIONS,
  FILTERABLE_KINDS,
  type Direction,
  type MovementKind,
} from "@/lib/movements";

/** Filters live in the URL, so the ledger stays a server read and is shareable. */
export function MovementFilters({
  direction,
  kind,
  from,
  to,
  q,
  children,
}: {
  direction?: Direction;
  kind?: MovementKind;
  from: string;
  to: string;
  q: string;
  children?: React.ReactNode;
}) {
  const t = useTranslations("movements");
  const tc = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [text, setText] = useState(q);

  useEffect(() => setText(q), [q]);

  function push(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams);

    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }

    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
  }

  useEffect(() => {
    if (text === q) return;
    const id = setTimeout(() => push({ q: text }), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // Changing direction drops a kind that does not belong to the new one.
  function pickDirection(next?: Direction) {
    const keepKind =
      kind && next && FILTERABLE_KINDS[next].includes(kind) ? kind : undefined;
    push({ direction: next, kind: keepKind });
  }

  const kinds = direction
    ? FILTERABLE_KINDS[direction]
    : [...FILTERABLE_KINDS.in, ...FILTERABLE_KINDS.out];

  const dirty = Boolean(direction || kind || from || to || q);

  return (
    <div className="mb-[14px] flex flex-col gap-[10px]">
      <div className="flex flex-wrap items-center gap-[10px]">
        <div className="flex min-w-[190px] flex-1 items-center gap-[9px] rounded-[15px] bg-card px-[15px] py-[11px]">
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

        <div className="flex gap-[2px] rounded-btn bg-card p-[3px]">
          <Chip active={!direction} onClick={() => pickDirection(undefined)}>
            {t("all")}
          </Chip>
          {DIRECTIONS.map((option) => (
            <Chip
              key={option}
              active={direction === option}
              onClick={() => pickDirection(option)}
            >
              {t(`direction_${option}`)}
            </Chip>
          ))}
        </div>

        {children}
      </div>

      <div className="flex flex-wrap items-center gap-[10px]">
        <div className="flex flex-wrap gap-[6px]">
          <Chip
            standalone
            active={!kind}
            onClick={() => push({ kind: undefined })}
          >
            {t("anyKind")}
          </Chip>
          {kinds.map((option) => (
            <Chip
              key={option}
              standalone
              active={kind === option}
              onClick={() => push({ kind: option })}
            >
              {t(`kind_${option}`)}
            </Chip>
          ))}
        </div>

        <div className="ms-auto flex flex-wrap items-center gap-[8px] text-label text-ink-2">
          <label htmlFor="from">{t("from")}</label>
          <input
            id="from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => push({ from: event.target.value })}
            className="rounded-btn border border-line bg-card px-[10px] py-[7px] text-label outline-none focus:border-orange"
          />
          <label htmlFor="to">{t("to")}</label>
          <input
            id="to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => push({ to: event.target.value })}
            className="rounded-btn border border-line bg-card px-[10px] py-[7px] text-label outline-none focus:border-orange"
          />
          {dirty ? (
            <Button
              variant="ghost"
              onClick={() =>
                push({
                  direction: undefined,
                  kind: undefined,
                  from: undefined,
                  to: undefined,
                  q: undefined,
                })
              }
            >
              {tc("clear")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Chip({
  active,
  standalone,
  onClick,
  children,
}: {
  active: boolean;
  standalone?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-btn px-[14px] py-2 text-label transition-colors",
        standalone && "bg-card",
        active ? "bg-ink text-white" : "text-ink-2 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
