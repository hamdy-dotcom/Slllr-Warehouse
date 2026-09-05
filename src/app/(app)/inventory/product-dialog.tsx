"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  CheckField,
  Field,
  FieldError,
  Input,
  Note,
} from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Muted } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { n } from "@/lib/format";
import { CURRENCY, money } from "@/lib/money";
import type { ProductStock } from "@/lib/types";
import {
  addProduct,
  updateProduct,
  uploadProductImage,
  type ProductFormState,
} from "./actions";
import { ImageField, type PickedImage } from "./image-field";

export function AddProductButton() {
  const t = useTranslations("inventory");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("addProduct")}</Button>
      {open ? (
        <ProductDialog
          mode="add"
          onClose={() => setOpen(false)}
          toastMessage={t("productAdded")}
        />
      ) : null}
    </>
  );
}

export function EditProductButton({
  product,
  fullWidth,
}: {
  product: ProductStock;
  /** The grid view wants the action to span the card. */
  fullWidth?: boolean;
}) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        className={fullWidth ? "w-full" : undefined}
        onClick={() => setOpen(true)}
      >
        {tc("edit")}
      </Button>
      {open ? (
        <ProductDialog
          mode="edit"
          product={product}
          onClose={() => setOpen(false)}
          toastMessage={t("productUpdated")}
        />
      ) : null}
    </>
  );
}

function ProductDialog({
  mode,
  product,
  onClose,
  toastMessage,
}: {
  mode: "add" | "edit";
  product?: ProductStock;
  onClose: () => void;
  toastMessage: string;
}) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const toast = useToast();
  const titleId = useId();
  const [state, formAction] = useActionState<ProductFormState, FormData>(
    mode === "add" ? addProduct : updateProduct,
    {},
  );

  // A failed save hands the typing back; a fresh dialog starts from the row.
  const v = state.values;

  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!state.savedAt || !state.productId) return;

    // The storage path is keyed by product id, so the image can only go up
    // once the row exists. A save with no new image is done already.
    if (!picked) {
      toast(toastMessage);
      onClose();
      return;
    }

    let cancelled = false;
    setUploading(true);

    const body = new FormData();
    body.set("product_id", state.productId);
    body.set("image", picked.blob, `${state.productId}.jpg`);

    uploadProductImage({}, body)
      .then((result) => {
        if (cancelled) return;
        if (result.error) {
          setImageError(result.error);
          setUploading(false);
          return;
        }
        toast(t("imageUploaded", { message: toastMessage }));
        onClose();
      })
      .catch(() => {
        if (cancelled) return;
        setImageError(te("uploadRetry"));
        setUploading(false);
      });

    return () => {
      cancelled = true;
    };
    // Only react to a fresh save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.savedAt]);

  return (
    <Modal open onClose={onClose} labelledBy={titleId}>
      <div id={titleId} className="mb-1 text-product font-medium">
        {mode === "add" ? t("addProduct") : t("editProduct")}
      </div>
      <Muted className="mb-[16px]">
        {product ? (
          <>
            {product.name} · <span className="latin">{product.sku}</span>
          </>
        ) : (
          t("newLine")
        )}
      </Muted>

      <form action={formAction}>
        {product ? <input type="hidden" name="id" value={product.id} /> : null}

        <Field label={t("productName")} htmlFor="name">
          <Input
            id="name"
            name="name"
            defaultValue={v?.name ?? product?.name ?? ""}
            placeholder={t("productNamePlaceholder")}
            required
          />
        </Field>

        <Field label={tc("sku")} htmlFor="sku">
          <Input
            id="sku"
            name="sku"
            defaultValue={v?.sku ?? product?.sku ?? ""}
            placeholder={t("skuPlaceholder")}
            className="latin"
            required
          />
        </Field>

        <Field
          label={tc("warehouseCode")}
          htmlFor="warehouse_code"
          hint={t("codeHint")}
        >
          <Input
            id="warehouse_code"
            name="warehouse_code"
            defaultValue={v?.warehouse_code ?? product?.warehouse_code ?? ""}
            placeholder="L03-R02-B07"
            className="latin font-mono"
            required
          />
        </Field>

        <Field label={t("totalUnits")} htmlFor="total_qty">
          <Input
            id="total_qty"
            name="total_qty"
            type="number"
            min={product?.reserved_qty ?? 0}
            defaultValue={v?.total_qty ?? product?.total_qty ?? ""}
            placeholder="500"
            required
          />
        </Field>

        <Field
          label={t("unitCostLabel", { currency: CURRENCY })}
          htmlFor="unit_cost"
          hint={t("unitCostHint")}
        >
          <Input
            id="unit_cost"
            name="unit_cost"
            type="number"
            min={0}
            step="0.01"
            defaultValue={v?.unit_cost ?? product?.unit_cost ?? ""}
            placeholder="0.00"
          />
        </Field>

        <ImageField
          currentUrl={product?.image_url ?? null}
          productName={product?.name ?? t("newProduct")}
          onPick={setPicked}
          onError={setImageError}
        />

        <CheckField
          name="is_active"
          label={t("listedInCatalog")}
          hint={t("listedHint")}
          defaultChecked={v?.is_active ?? product?.is_active ?? true}
        />

        {product ? (
          <Note calm>
            {t("reservedPending", {
              reserved: n(product.reserved_qty),
              pending: n(product.pending_qty),
            })}
            {product.unit_cost === null
              ? null
              : t.rich("custodyNote", {
                  // What Sllr actually holds of this product now, which is
                  // what has arrived in Riyadh — not what is still waiting
                  // here to be collected.
                  value: money(product.riyadh_value),
                  b: (chunks) => <b>{chunks}</b>,
                })}
          </Note>
        ) : null}

        <FieldError>{state.error ?? imageError}</FieldError>

        <div className="flex gap-[9px]">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={onClose}
            disabled={uploading}
          >
            {tc("cancel")}
          </Button>
          <Submit
            label={mode === "add" ? t("addProduct") : tc("save")}
            uploading={uploading}
          />
        </div>
      </form>
    </Modal>
  );
}

function Submit({ label, uploading }: { label: string; uploading: boolean }) {
  const tc = useTranslations("common");
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="flex-1" disabled={pending || uploading}>
      {uploading ? tc("uploading") : pending ? tc("saving") : label}
    </Button>
  );
}
