"use client";

import { useOptimistic, useTransition } from "react";

import { cn } from "@/lib/cn";
import { setViewMode } from "@/lib/actions/view";
import type { ToggleRoute, ViewMode } from "@/lib/view-mode";

function GridIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="size-[15px]">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.6" fill="currentColor" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.6" fill="currentColor" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.6" fill="currentColor" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1.6" fill="currentColor" />
    </svg>
  );
}

function RowsIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="size-[15px]">
      <rect x="1.5" y="2" width="13" height="3" rx="1.4" fill="currentColor" />
      <rect x="1.5" y="6.5" width="13" height="3" rx="1.4" fill="currentColor" />
      <rect x="1.5" y="11" width="13" height="3" rx="1.4" fill="currentColor" />
    </svg>
  );
}

const OPTIONS: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
  { mode: "grid", label: "Grid", icon: <GridIcon /> },
  { mode: "rows", label: "Rows", icon: <RowsIcon /> },
];

/**
 * Segmented control for the two layouts. The choice is written to a cookie by
 * a server action, so the next render — including a fresh page load — already
 * knows which view to build.
 */
export function ViewToggle({
  route,
  mode,
}: {
  route: ToggleRoute;
  mode: ViewMode;
}) {
  const [, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(mode);

  return (
    <div
      role="group"
      aria-label="Layout"
      className="flex gap-[2px] rounded-btn bg-card p-[3px]"
    >
      {OPTIONS.map((option) => {
        const active = shown === option.mode;

        return (
          <button
            key={option.mode}
            type="button"
            aria-pressed={active}
            title={option.label}
            onClick={() => {
              if (active) return;
              startTransition(async () => {
                setShown(option.mode);
                await setViewMode(route, option.mode);
              });
            }}
            className={cn(
              "grid size-[30px] place-items-center rounded-[10px] transition-colors",
              active
                ? "bg-ink text-white"
                : "text-ink-2 hover:bg-card-soft hover:text-ink",
            )}
          >
            {option.icon}
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
