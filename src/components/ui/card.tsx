import { cn } from "@/lib/cn";

type CardProps = React.ComponentProps<"div"> & {
  /** Nested or secondary card — sits on `card-soft` instead of white. */
  soft?: boolean;
};

export function Card({ soft, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card px-5 py-[18px]",
        soft ? "bg-card-soft" : "bg-card",
        className,
      )}
      {...props}
    />
  );
}

export function SectionTitle({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("text-section font-medium", className)}
      {...props}
    />
  );
}

export function Muted({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-label text-ink-2", className)} {...props} />;
}

export function Meta({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("font-mono text-meta text-ink-3", className)} {...props} />
  );
}

/** Label/value line used inside summary cards. Hairline between rows only. */
export function Row({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-line py-[9px] text-body last:border-b-0">
      <span className="text-label text-ink-2">{label}</span>
      <b className="font-medium">{children}</b>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 py-[46px] text-center text-body text-ink-2">
      {children}
    </div>
  );
}
