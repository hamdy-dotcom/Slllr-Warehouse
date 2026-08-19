import { cn } from "@/lib/cn";
import { widthPct } from "@/lib/format";

/**
 * Stacked shelf split: orange (reserved) → amber (pending) → track (free).
 * `deepTrack` uses the heavier track tone the dashboard summary card wants.
 */
export function StockBar({
  reserved,
  pending,
  total,
  className,
  deepTrack,
}: {
  reserved: number;
  pending: number;
  total: number;
  className?: string;
  deepTrack?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-[7px] overflow-hidden rounded-bar",
        deepTrack ? "bg-track-deep" : "bg-track",
        className,
      )}
    >
      <span
        className="block h-full bg-orange"
        style={{ width: widthPct(reserved, total) }}
      />
      <span
        className="block h-full bg-amber"
        style={{ width: widthPct(pending, total) }}
      />
    </div>
  );
}
