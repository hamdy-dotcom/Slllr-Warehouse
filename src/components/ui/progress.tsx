import { cn } from "@/lib/cn";

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
  tone?: "orange" | "green";
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
          tone === "green" ? "bg-green" : "bg-orange",
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
