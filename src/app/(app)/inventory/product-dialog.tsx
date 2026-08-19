"use client";

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
import type { ProductStock } from "@/lib/types";
import {
  addProduct,
  updateProduct,
  uploadProductImage,
  type ProductFormState,
} from "./actions";
import { ImageField, type PickedImage } from "./image-field";

export function AddProductButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add product</Button>
      {open ? (
        <ProductDialog
          mode="add"
          onClose={() => setOpen(false)}
          toastMessage="Product added to the catalog"
        />
      ) : null}
    </>
  );
}

export function EditProductButton({ product }: { product: ProductStock }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Edit
      </Button>
      {open ? (
        <ProductDialog
          mode="edit"
          product={product}
          onClose={() => setOpen(false)}
          toastMessage="Product updated"
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
        toast(`${toastMessage} · image uploaded`);
        onClose();
      })
      .catch(() => {
        if (cancelled) return;
        setImageError("Could not upload that image. Try again.");
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
        {mode === "add" ? "Add product" : "Edit product"}
      </div>
      <Muted className="mb-[16px]">
        {product
          ? `${product.name} · ${product.sku}`
          : "New line on your shelf"}
      </Muted>

      <form action={formAction}>
        {product ? <input type="hidden" name="id" value={product.id} /> : null}

        <Field label="Product name" htmlFor="name">
          <Input
            id="name"
            name="name"
            defaultValue={v?.name ?? product?.name ?? ""}
            placeholder="Cordless kettle 1.7L"
            required
          />
        </Field>

        <Field label="SKU" htmlFor="sku">
          <Input
            id="sku"
            name="sku"
            defaultValue={v?.sku ?? product?.sku ?? ""}
            placeholder="SKU-9001"
            required
          />
        </Field>

        <Field
          label="Warehouse code"
          htmlFor="warehouse_code"
          hint="Line, rack, bin — for example L03-R02-B07"
        >
          <Input
            id="warehouse_code"
            name="warehouse_code"
            defaultValue={v?.warehouse_code ?? product?.warehouse_code ?? ""}
            placeholder="L03-R02-B07"
            className="font-mono"
            required
          />
        </Field>

        <Field label="Total units on shelf" htmlFor="total_qty">
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

        <ImageField
          currentUrl={product?.image_url ?? null}
          productName={product?.name ?? "New product"}
          onPick={setPicked}
          onError={setImageError}
        />

        <CheckField
          name="is_active"
          label="Listed in the Sllr catalog"
          hint="Unlisting keeps the row and its stock; it only hides the product from Sllr."
          defaultChecked={v?.is_active ?? product?.is_active ?? true}
        />

        {product ? (
          <Note calm>
            Reserved {n(product.reserved_qty)} · pending{" "}
            {n(product.pending_qty)}. Total cannot go below what is already
            reserved.
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
            Cancel
          </Button>
          <Submit
            label={mode === "add" ? "Add product" : "Save"}
            uploading={uploading}
          />
        </div>
      </form>
    </Modal>
  );
}

function Submit({ label, uploading }: { label: string; uploading: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="flex-1" disabled={pending || uploading}>
      {uploading ? "Uploading…" : pending ? "Saving…" : label}
    </Button>
  );
}
