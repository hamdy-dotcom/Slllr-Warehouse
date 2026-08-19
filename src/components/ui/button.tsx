import { cn } from "@/lib/cn";

// Each variant owns its border colour — no shared default to be overridden,
// so the 1px hairline on the ghost and reject buttons always wins.
const variants = {
  primary: "border-orange bg-orange text-white hover:border-orange-hover hover:bg-orange-hover",
  ghost: "border-line bg-card text-ink hover:bg-card-soft",
  ok: "border-green bg-green text-white hover:brightness-95",
  no: "border-line bg-card text-orange-ink hover:bg-card-soft",
} as const;

export type ButtonVariant = keyof typeof variants;

type ButtonProps = React.ComponentProps<"button"> & {
  variant?: ButtonVariant;
};

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "rounded-btn border px-[14px] py-[9px] text-label font-medium transition-[background-color,border-color,color,filter] duration-150",
        "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

/** The small round `↗` affordance in the top-right of a KPI card. */
export function ArrowButton({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "grid size-7 place-items-center rounded-full bg-tint text-[12px] text-ink-2 transition-colors hover:text-ink",
        className,
      )}
      {...props}
    >
      ↗
    </button>
  );
}
