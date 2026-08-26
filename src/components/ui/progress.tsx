import { cn } from "@/lib/cn";

export type ProgressTone = "orange" | "green" | "amber";

const TONE: Record<ProgressTone, string> = {
  orange: "bg-orange",
  green: "bg-green",
  amber: "bg-amber",
};

/**
 * A single filled bar on the shared track.
 *
 * The shelf bar stacks two shares of one total; this one shows how far along
 * a single thing is, which is a different question and reads better as its
 * own mark. Tones come from docs/DESIGN.md — orange for movement off the
 * shelf, green for money that has settled.
 */
export function Progress({
  pct,
  tone = "orange",
  className,
}: {
  /** 0–100. Clamped, so a rounding overshoot cannot spill the track. */
  pct: number;
  tone?: ProgressTone;
  className?: string;
}) {
  const width = Math.min(100, Math.max(0, pct));

  return (
    <div
      className={cn("h-[7px] overflow-hidden rounded-bar bg-track", className)}
    >
      <span
        className={cn(
          "block h-full rounded-bar transition-[width] duration-200",
          TONE[tone],
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

/**
 * Several shares of one total, laid end to end on the shared track.
 *
 * Used where a quantity has moved on through more than one state but all of
 * it counts towards the same progress — a PO's units that have left the
 * shelf are dispatched, delivered or returned, and the bar has to fill
 * whichever of the three they are sitting in now.
 */
export function StackedProgress({
  segments,
  className,
}: {
  /** Shares of the same total, in order. Together they are clamped to 100. */
  segments: { pct: number; tone: ProgressTone }[];
  className?: string;
}) {
  let left = 100;

  return (
    <div
      className={cn("flex h-[7px] overflow-hidden rounded-bar bg-track", className)}
    >
      {segments.map((segment, index) => {
        const width = Math.min(left, Math.max(0, segment.pct));
        left -= width;

        return (
          <span
            key={index}
            className={cn("block h-full", TONE[segment.tone])}
            style={{ width: `${width}%` }}
          />
        );
      })}
    </div>
  );
}
