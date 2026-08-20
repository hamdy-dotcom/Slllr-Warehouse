"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";

import { cn } from "@/lib/cn";
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT } from "@/i18n/config";
import { setLocale } from "@/i18n/set-locale";

/**
 * Segmented control for the language, matching the layout toggle.
 *
 * The choice goes to a cookie through a server action, then the router is
 * refreshed so the next render — including the `dir` and `lang` on `<html>` —
 * already speaks it. Each label is written in its own language, so it reads
 * the same whichever one is on.
 */
export function LanguageToggle({ label }: { label: string }) {
  const current = useLocale();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(current);

  return (
    <div
      role="group"
      aria-label={label}
      className="flex gap-[2px] rounded-[13px] bg-tint p-[3px]"
    >
      {LOCALES.map((locale) => {
        const active = shown === locale;

        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            aria-pressed={active}
            title={LOCALE_LABELS[locale]}
            onClick={() => {
              if (active) return;
              startTransition(async () => {
                setShown(locale);
                await setLocale(locale);
                router.refresh();
              });
            }}
            className={cn(
              "grid h-[24px] min-w-[26px] place-items-center rounded-[10px] px-[6px] text-label leading-none transition-colors",
              active
                ? "bg-ink text-white"
                : "text-ink-2 hover:bg-card hover:text-ink",
            )}
          >
            <span aria-hidden>{LOCALE_SHORT[locale]}</span>
            <span className="sr-only">{LOCALE_LABELS[locale]}</span>
          </button>
        );
      })}
    </div>
  );
}
