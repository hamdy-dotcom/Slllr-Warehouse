"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Muted } from "@/components/ui/card";
import {
  Field,
  FieldError,
  Input,
  Note,
  Textarea,
} from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { CURRENCY, money } from "@/lib/money";
import { recordPayment, type PaymentState } from "./actions";

export function RecordPaymentButton({
  supplierId,
  supplierName,
  balance,
  today,
}: {
  supplierId: string;
  supplierName: string;
  balance: number;
  today: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Record payment</Button>
      {open ? (
        <PaymentDialog
          supplierId={supplierId}
          supplierName={supplierName}
          balance={balance}
          today={today}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function PaymentDialog({
  supplierId,
  supplierName,
  balance,
  today,
  onClose,
}: {
  supplierId: string;
  supplierName: string;
  balance: number;
  today: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const titleId = useId();
  const [amount, setAmount] = useState("");
  const [state, formAction] = useActionState<PaymentState, FormData>(
    recordPayment,
    {},
  );

  useEffect(() => {
    if (!state.savedAt) return;
    toast("Payment recorded");
    onClose();
    // Only react to a fresh save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.savedAt]);

  const paid = Number(amount);
  const after = Number.isFinite(paid) && paid > 0 ? balance - paid : null;

  return (
    <Modal open onClose={onClose} labelledBy={titleId}>
      <div id={titleId} className="mb-1 text-product font-medium">
        Record payment
      </div>
      <Muted className="mb-4">
        To {supplierName}. Balance owed is {money(balance)}.
      </Muted>

      <form action={formAction}>
        <input type="hidden" name="supplier_id" value={supplierId} />

        <Field label={`Amount (${CURRENCY})`} htmlFor="amount">
          <Input
            id="amount"
            name="amount"
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            required
          />
        </Field>

        <Field label="Paid on" htmlFor="paid_on">
          <Input
            id="paid_on"
            name="paid_on"
            type="date"
            defaultValue={today}
            required
          />
        </Field>

        <Field label="Method" htmlFor="method" hint="Optional.">
          <Input
            id="method"
            name="method"
            placeholder="Bank transfer"
            list="payment-methods"
          />
        </Field>
        <datalist id="payment-methods">
          <option value="Bank transfer" />
          <option value="Cheque" />
          <option value="Cash" />
          <option value="Card" />
        </datalist>

        <Field label="Reference" htmlFor="reference" hint="Optional.">
          <Input id="reference" name="reference" placeholder="PAY-9001" />
        </Field>

        <Field label="Note" htmlFor="note" hint="Optional.">
          <Textarea id="note" name="note" rows={2} />
        </Field>

        {after !== null ? (
          <Note calm={after >= 0}>
            Balance owed {money(balance)} → <b>{money(after)}</b>
            {after < 0 ? " — that pays more than is owed." : ""}
          </Note>
        ) : null}

        <FieldError>{state.error}</FieldError>

        <div className="flex gap-[9px]">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Submit />
        </div>
      </form>
    </Modal>
  );
}

function Submit() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="flex-1" disabled={pending}>
      {pending ? "Recording…" : "Record payment"}
    </Button>
  );
}
