import Link from "next/link";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/cn";

// Each variant owns its border colour — no shared default to be overridden,
// so the 1px hairline on the ghost and reject buttons always wins.
const variants = {
  primary:
    "border-orange bg-orange text-white hover:border-orange-hover hover:bg-orange-hover",
  ghost: "border-line bg-card text-ink hover:bg-card-soft",
  ok: "border-green bg-green text-white hover:brightness-95",
  no: "border-line bg-card text-orange-ink hover:bg-card-soft",
} as const;

export type ButtonVariant = keyof typeof variants;

const base =
  "inline-flex items-center justify-center rounded-btn border px-[14px] py-[9px] text-label font-medium transition-[background-color,border-color,color,filter] duration-150";

export function buttonClass(
  variant: ButtonVariant = "primary",
  className?: string,
): string {
  return cn(base, variants[variant], className);
}

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
      className={buttonClass(
        variant,
        cn(
          "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100",
          className,
        ),
      )}
      {...props}
    />
  );
}

/** A link that carries a button's weight — same shapes, real navigation. */
export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

/**
 * The small round arrow affordance in the top corner of a KPI card. The
 * glyph itself comes from the messages so it points outward in both
 * directions — `↗` reading left to right, `↖` reading right to left.
 */
export function ArrowButton({
  className,
  ...props
}: React.ComponentProps<"button">) {
  const t = useTranslations("common");

  return (
    <button
      type="button"
      className={cn(
        "grid size-7 place-items-center rounded-full bg-tint text-[12px] text-ink-2 transition-colors hover:text-ink",
        className,
      )}
      {...props}
    >
      {t("arrowUp")}
    </button>
  );
}
