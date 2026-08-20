import { useTranslations } from "next-intl";

import { cn } from "@/lib/cn";

/** The five orange bars that make up the Sllr mark. */
const MARK_HEIGHTS = [9, 16, 22, 14, 7];

export function Logo() {
  const t = useTranslations("app");

  return (
    <div className="flex items-center gap-[9px] text-[17px] font-medium">
      <span className="flex h-[22px] w-[26px] items-end gap-[2px]" aria-hidden>
        {MARK_HEIGHTS.map((height, index) => (
          <i
            key={index}
            className="block w-[3px] rounded-[2px] bg-orange"
            style={{ height }}
          />
        ))}
      </span>
      {t("name")}
    </div>
  );
}

/** Rounded page container with the subtle vertical fade. */
export function Shell({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className="p-[18px]">
      <div
        className={cn(
          "mx-auto max-w-[1280px] rounded-shell border border-shell-line bg-linear-to-b from-shell-top to-shell-bottom px-[22px] pt-5 pb-[26px]",
          className,
        )}
        {...props}
      />
    </div>
  );
}
