"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { ProductMini } from "@/components/product-thumb";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { MAX_UPLOAD_BYTES, MAX_WIDTH, compressImage } from "@/lib/image";

export type PickedImage = { blob: Blob; previewUrl: string };

/**
 * Picks an image and compresses it to `MAX_WIDTH` in the browser. The upload
 * itself waits until the product exists, because the storage path is keyed by
 * product id.
 */
export function ImageField({
  currentUrl,
  productName,
  onPick,
  onError,
}: {
  currentUrl: string | null;
  productName: string;
  onPick: (picked: PickedImage | null) => void;
  onError: (message: string | null) => void;
}) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Revoke the object URL when it is replaced or the dialog closes.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    onError(null);

    if (!file.type.startsWith("image/")) {
      onError(t("chooseImage"));
      event.target.value = "";
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      onError(t("imageTooLarge"));
      event.target.value = "";
      return;
    }

    setBusy(true);
    try {
      const { blob } = await compressImage(file);
      const previewUrl = URL.createObjectURL(blob);
      setPreview(previewUrl);
      onPick({ blob, previewUrl });
    } catch {
      onError(t("imageUnreadable"));
      event.target.value = "";
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setPreview(null);
    onPick(null);
    onError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <Field
      label={t("productImage")}
      hint={t("imageHint", { width: MAX_WIDTH })}
    >
      <div className="flex items-center gap-[11px]">
        {preview ? (
          // A blob: URL from the file the supplier just picked — the image
          // optimiser cannot fetch it, so this stays a plain <img>.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className="size-11 shrink-0 rounded-[12px] object-cover"
          />
        ) : (
          <ProductMini src={currentUrl} alt={productName} />
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="min-w-0 flex-1 text-label text-ink-2 file:me-3 file:rounded-btn file:border file:border-line file:bg-card file:px-3 file:py-[7px] file:text-label file:font-medium file:text-ink hover:file:bg-card-soft"
        />

        {preview ? (
          <Button variant="ghost" onClick={clear} disabled={busy}>
            {tc("clear")}
          </Button>
        ) : null}
      </div>
    </Field>
  );
}
