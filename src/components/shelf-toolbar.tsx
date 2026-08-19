"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/cn";
import { FILTER_LABELS, type ShelfFilter } from "@/lib/shelf";

const FILTERS: ShelfFilter[] = ["all", "low", "reserved"];

/**
 * Search and filter live in the URL, so the page stays a server read and the
 * view is shareable.
 */
export function ShelfToolbar({
  q,
  filter,
  children,
}: {
  q: string;
  filter: ShelfFilter;
  /** Trailing action, e.g. the inventory "Add product" button. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [value, setValue] = useState(q);

  // Keep the box in step when the URL changes from elsewhere (back button).
  useEffect(() => setValue(q), [q]);

  function push(next: { q?: string; filter?: ShelfFilter }) {
    const params = new URLSearchParams(searchParams);

    if (next.q !== undefined) {
      if (next.q) params.set("q", next.q);
      else params.delete("q");
    }

    if (next.filter !== undefined) {
      if (next.filter !== "all") params.set("filter", next.filter);
      else params.delete("filter");
    }

    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
  }

  // Debounce so a search does not fire a request per keystroke.
  useEffect(() => {
    if (value === q) return;
    const id = setTimeout(() => push({ q: value }), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="mb-[14px] flex flex-wrap items-center gap-[10px]">
      <div className="flex min-w-[190px] flex-1 items-center gap-[9px] rounded-[15px] bg-card px-[15px] py-[11px]">
        <span aria-hidden className="text-ink-3">
          ⌕
        </span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search by name, SKU, or warehouse code"
          aria-label="Search the shelf"
          className="w-full border-none bg-transparent text-body outline-none placeholder:text-ink-3"
        />
      </div>

      {FILTERS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={filter === option}
          onClick={() => push({ filter: option })}
          className={cn(
            "rounded-btn px-[14px] py-2 text-label transition-colors",
            filter === option
              ? "bg-ink text-white"
              : "bg-card text-ink-2 hover:text-ink",
          )}
        >
          {FILTER_LABELS[option]}
        </button>
      ))}

      {children}
    </div>
  );
}
