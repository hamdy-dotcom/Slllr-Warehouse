"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { updateStockQty } from "./actions";

/**
 * Quantity box that lives in the row. Saves on Enter or on blur, and only when
 * the number actually changed — tabbing through the table is not an edit.
 *
 * A rejected save keeps what was typed so it can be corrected in place; the
 * hairline turns orange until the next keystroke, and the toast says why.
 */
export function InlineQty({
  sku,
  totalQty,
  reservedQty,
}: {
  sku: string;
  totalQty: number;
  reservedQty: number;
}) {
  const t = useTranslations("inventory");
  const toast = useToast();
  const [value, setValue] = useState(String(totalQty));
  const [rejected, setRejected] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Follow the server once it revalidates, unless the box is being edited or
  // is showing a number the shelf refused.
  useEffect(() => {
    if (rejected) return;
    if (document.activeElement === inputRef.current) return;
    setValue(String(totalQty));
  }, [totalQty, rejected]);

  function save() {
    const next = value.trim();
    if (next === String(totalQty)) return;

    const body = new FormData();
    body.set("sku", sku);
    body.set("total_qty", next);

    startTransition(async () => {
      const result = await updateStockQty({}, body);

      if (result.error) {
        setRejected(true);
        toast(result.error);
        return;
      }

      setRejected(false);
      if (result.total_qty !== undefined) setValue(String(result.total_qty));
      toast(t("stockUpdated"));
    });
  }

  function revert() {
    setRejected(false);
    setValue(String(totalQty));
  }

  return (
    <input
      ref={inputRef}
      type="number"
      min={0}
      inputMode="numeric"
      value={value}
      disabled={pending}
      aria-label={t("qtyAria", { total: totalQty, reserved: reservedQty })}
      aria-invalid={rejected || undefined}
      onChange={(event) => {
        setRejected(false);
        setValue(event.target.value);
      }}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          inputRef.current?.blur();
        }
        if (event.key === "Escape") {
          revert();
          inputRef.current?.blur();
        }
      }}
      className={cn(
        "w-[86px] rounded-btn border bg-card-soft px-[10px] py-[6px] text-body font-medium tabular-nums outline-none transition-colors",
        "focus:border-orange focus:bg-card disabled:opacity-45",
        rejected ? "border-orange" : "border-line",
      )}
    />
  );
}
