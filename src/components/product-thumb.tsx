import Image from "next/image";

import { cn } from "@/lib/cn";

/** Neutral fill for a product with no image yet. */
function Placeholder() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden className="size-1/2 opacity-70">
      <rect x="24" y="42" width="72" height="52" rx="10" fill="#C9C3BB" />
      <path d="M24 42l14-16h44l14 16z" fill="#EAE5DE" />
      <rect x="50" y="58" width="20" height="8" rx="4" fill="#A9A29A" />
    </svg>
  );
}

/**
 * Tint tile with the product image on top. Falls back to a neutral tile when
 * `image_url` is null.
 */
export function ProductThumb({
  src,
  alt,
  code,
  className,
  sizes = "126px",
}: {
  src: string | null;
  alt: string;
  /** Warehouse code, rendered as a white chip bottom-left. */
  code?: string;
  className?: string;
  sizes?: string;
}) {
  return (
    <div
      className={cn(
        "relative grid place-items-center overflow-hidden rounded-tile bg-tint",
        className,
      )}
    >
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
      ) : (
        <Placeholder />
      )}

      {code ? (
        <span className="absolute bottom-[9px] left-[9px] rounded-[8px] bg-card px-2 py-[3px] font-mono text-[10.5px] text-ink-2">
          {code}
        </span>
      ) : null}
    </div>
  );
}

/** The 44px square used in table rows and modal headers. */
export function ProductMini({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  return (
    <ProductThumb
      src={src}
      alt={alt}
      sizes="54px"
      className={cn("size-11 shrink-0 rounded-[12px]", className)}
    />
  );
}
