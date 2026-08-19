import { cn } from "@/lib/cn";
import type { RequestStatus } from "@/lib/types";

const statusStyles: Record<RequestStatus, string> = {
  pending: "bg-amber-soft text-amber-ink",
  approved: "bg-green-soft text-green",
  rejected: "bg-red-soft text-orange-ink",
  cancelled: "bg-neutral-soft text-ink-2",
  consumed: "bg-neutral-soft text-ink-2",
};

export function Tag({
  status,
  className,
}: {
  status: RequestStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-pill px-[10px] py-[4px] text-meta",
        statusStyles[status],
        className,
      )}
    >
      {status}
    </span>
  );
}

const pillTones = {
  good: "bg-green-soft text-green",
  warn: "bg-amber-soft text-amber-ink",
  hot: "bg-orange-soft text-orange-ink",
  calm: "bg-neutral-soft text-ink-2",
} as const;

export type PillTone = keyof typeof pillTones;

/** Small status pill — the strip along the bottom of a KPI card. */
export function Pill({
  tone = "good",
  className,
  children,
}: {
  tone?: PillTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[5px] rounded-pill px-[9px] py-[4px] text-th",
        pillTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
