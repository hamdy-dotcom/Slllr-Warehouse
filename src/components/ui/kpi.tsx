import Link from "next/link";

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
  /** Where the top-right `↗` goes. */
  href?: string;
}) {
  return (
    <Card className="relative flex flex-col gap-[10px]">
      {href ? (
        <Link
          href={href}
          aria-label={`Open ${label.toLowerCase()}`}
          className="absolute top-4 right-4 grid size-7 place-items-center rounded-full bg-tint text-[12px] text-ink-2 transition-colors hover:text-ink"
        >
          ↗
        </Link>
      ) : (
        <ArrowButton
          aria-hidden
          tabIndex={-1}
          className="absolute top-4 right-4"
        />
      )}

      <div className="grid size-[34px] place-items-center rounded-[12px] bg-orange text-[15px] text-white">
        {icon}
      </div>

      <div className="text-label text-ink-2">{label}</div>

      <div className="text-kpi font-medium">
        {value}
        {unit ? (
          <small className="ml-1 text-body font-normal text-ink-3">{unit}</small>
        ) : null}
      </div>

      <Sparkline seed={seed} />

      <div>
        <Pill tone={pillTone}>{pill}</Pill>
      </div>
    </Card>
  );
}
