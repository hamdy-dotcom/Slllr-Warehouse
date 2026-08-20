import Link from "next/link";
import { useTranslations } from "next-intl";

import { Card } from "@/components/ui/card";
import { ArrowButton } from "@/components/ui/button";
import { Sparkline } from "@/components/ui/sparkline";
import { Pill, type PillTone } from "@/components/ui/tag";

export function Kpi({
  icon,
  label,
  value,
  unit,
  pill,
  pillTone = "good",
  seed,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  pill: React.ReactNode;
  pillTone?: PillTone;
  seed: number;
  /** Where the outward arrow in the top corner goes. */
  href?: string;
}) {
  const t = useTranslations("common");

  return (
    <Card className="relative flex flex-col gap-[10px]">
      {href ? (
        <Link
          href={href}
          aria-label={t("openLabel", { label })}
          className="absolute top-4 end-4 grid size-7 place-items-center rounded-full bg-tint text-[12px] text-ink-2 transition-colors hover:text-ink"
        >
          {t("arrowUp")}
        </Link>
      ) : (
        <ArrowButton
          aria-hidden
          tabIndex={-1}
          className="absolute top-4 end-4"
        />
      )}

      <div className="grid size-[34px] place-items-center rounded-[12px] bg-orange text-[15px] text-white">
        {icon}
      </div>

      <div className="text-label text-ink-2">{label}</div>

      {/*
        The unit sits on its own line rather than inline. A money value and a
        unit count are two numbers; side by side at 26px they run together and
        wrap mid-number. Sizes stay as docs/DESIGN.md sets them — 26px value,
        13px muted unit.
      */}
      <div>
        <div className="text-kpi font-medium">{value}</div>
        {unit ? (
          <div className="mt-[2px] text-body font-normal text-ink-3">
            {unit}
          </div>
        ) : null}
      </div>

      <Sparkline seed={seed} />

      <div>
        <Pill tone={pillTone}>{pill}</Pill>
      </div>
    </Card>
  );
}
