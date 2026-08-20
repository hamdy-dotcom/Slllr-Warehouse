"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import type { NavItem } from "@/lib/routes";

export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav className="mx-auto flex flex-wrap gap-[6px]">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-nav px-[17px] py-[9px] text-[13.5px] transition-colors duration-150",
              active
                ? "bg-card font-medium text-ink shadow-nav"
                : "text-ink-2 hover:bg-card/70",
            )}
          >
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}
