"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Field, FieldError, Input, Note } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Muted } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { n } from "@/lib/format";
import type { ProductStock } from "@/lib/types";
import { addProduct, updateProduct, type ProductFormState } from "./actions";

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
        Update stock
      </Button>
      {open ? (
        <ProductDialog
          mode="edit"
          product={product}
          onClose={() => setOpen(false)}
          toastMessage="Stock updated"
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

  useEffect(() => {
    if (!state.savedAt) return;
    toast(toastMessage);
    onClose();
    // Only react to a fresh save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.savedAt]);

  return (
    <Modal open onClose={onClose} labelledBy={titleId}>
      <div id={titleId} className="mb-1 text-product font-medium">
        {mode === "add" ? "Add product" : "Update stock"}
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

        {product ? (
          <Note calm>
            Reserved {n(product.reserved_qty)} · pending{" "}
            {n(product.pending_qty)}. Total cannot go below what is already
            reserved.
          </Note>
        ) : null}

        <FieldError>{state.error}</FieldError>

        <div className="flex gap-[9px]">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Submit label={mode === "add" ? "Add product" : "Save"} />
        </div>
      </form>
    </Modal>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="flex-1" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}
