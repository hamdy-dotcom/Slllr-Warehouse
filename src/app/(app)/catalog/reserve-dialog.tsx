"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";

import { ProductMini } from "@/components/product-thumb";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  Input,
  Note,
  Textarea,
} from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { sendReserveRequest, type ReserveState } from "@/lib/actions/reserve";
import { n } from "@/lib/format";
import { lineValue, money, unitCost } from "@/lib/money";
import type { ProductStock } from "@/lib/types";

export function ReserveButton({
  product,
  compact,
}: {
  product: ProductStock;
  /** Row view wants a button that sits in a cell, not a full-width one. */
  compact?: boolean;
}) {
  const t = useTranslations("catalog");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        className={compact ? undefined : "w-full"}
        onClick={() => setOpen(true)}
      >
        {compact ? t("reserve") : t("reserveStock")}
      </Button>
      {open ? (
        <ReserveDialog product={product} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function ReserveDialog({
  product,
  onClose,
}: {
  product: ProductStock;
  onClose: () => void;
}) {
  const t = useTranslations("reserve");
  const tc = useTranslations("common");
  const toast = useToast();
  const titleId = useId();
  const [state, formAction] = useActionState<ReserveState, FormData>(
    sendReserveRequest,
    {},
  );

  const [qty, setQty] = useState(state.values?.qty ?? "100");
  const requested = Number(qty);
  const after = product.free_qty - (Number.isFinite(requested) ? requested : 0);

  useEffect(() => {
    if (!state.savedAt) return;
    toast(t("sent"));
    onClose();
    // Only react to a fresh save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.savedAt]);

  // A failed save hands the typing back.
  useEffect(() => {
    if (state.values?.qty !== undefined) setQty(state.values.qty);
  }, [state.values?.qty]);

  return (
    <Modal open onClose={onClose} labelledBy={titleId}>
      <div className="mb-4 flex items-center gap-[11px]">
        <ProductMini
          src={product.image_url}
          alt={product.name}
          className="size-[54px]"
        />
        <div>
          <div id={titleId} className="text-product font-medium">
            {t("title", { product: product.name })}
          </div>
          <div className="font-mono text-meta text-ink-3">
            <span className="latin">
              {product.sku} · {product.warehouse_code}
            </span>
          </div>
        </div>
      </div>

      <form action={formAction}>
        <input type="hidden" name="product_id" value={product.id} />

        <Field label={t("quantity")} htmlFor="qty">
          <Input
            id="qty"
            name="qty"
            type="number"
            min={1}
            value={qty}
            onChange={(event) => setQty(event.target.value)}
            required
          />
        </Field>

        <Field label={t("holdUntil")} htmlFor="hold_until">
          <Input
            id="hold_until"
            name="hold_until"
            type="date"
            defaultValue={state.values?.hold_until ?? ""}
          />
        </Field>

        <Field label={t("noteToSupplier")} htmlFor="note">
          <Textarea
            id="note"
            name="note"
            rows={2}
            defaultValue={state.values?.note ?? ""}
            placeholder={t("notePlaceholder")}
          />
        </Field>

        <Note calm={after >= 0}>
          {t.rich("freeNow", {
            before: n(product.free_qty),
            after: n(after),
            b: (chunks) => <b>{chunks}</b>,
          })}
        </Note>

        <Note calm>
          {product.unit_cost === null
            ? t("notPriced")
            : t.rich("worth", {
                cost: unitCost(product.unit_cost),
                value: money(
                  lineValue(
                    Number.isFinite(requested) && requested > 0 ? requested : 0,
                    product.unit_cost,
                  ),
                ),
                b: (chunks) => <b>{chunks}</b>,
              })}
        </Note>

        <FieldError>{state.error}</FieldError>

        <div className="flex gap-[9px]">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Submit />
        </div>
      </form>
    </Modal>
  );
}

function Submit() {
  const t = useTranslations("reserve");
  const tc = useTranslations("common");
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="flex-1" disabled={pending}>
      {pending ? tc("sending") : t("send")}
    </Button>
  );
}
