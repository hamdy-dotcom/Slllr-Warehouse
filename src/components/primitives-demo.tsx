"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, SectionTitle, Muted } from "@/components/ui/card";
import { Field, Input, Note } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ToastProvider, useToast } from "@/components/ui/toast";

/** Exercises the two client primitives — modal and toast — in one card. */
export function PrimitivesDemo() {
  return (
    <ToastProvider>
      <Inner />
    </ToastProvider>
  );
}

function Inner() {
  const [open, setOpen] = useState(false);
  const toast = useToast();

  return (
    <Card>
      <SectionTitle>Modal and toast</SectionTitle>
      <Muted className="mb-[14px]">Escape or a click outside closes it.</Muted>
      <div className="flex flex-wrap gap-[9px]">
        <Button onClick={() => setOpen(true)}>Open modal</Button>
        <Button variant="ghost" onClick={() => toast("Stock updated")}>
          Show toast
        </Button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="demo-title">
        <div id="demo-title" className="mb-1 text-product font-medium">
          Reserve air fryer 5L digital
        </div>
        <Muted className="mb-[16px]">SKU-1042 · L03-R02-B07</Muted>
        <Field label="Quantity" htmlFor="modal-qty">
          <Input id="modal-qty" type="number" defaultValue={100} min={1} />
        </Field>
        <Note calm>
          Free now <b>1,200</b> → free after approval <b>1,100</b>
        </Note>
        <div className="flex gap-[9px]">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              setOpen(false);
              toast("Request sent — waiting on supplier approval");
            }}
          >
            Send request
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
