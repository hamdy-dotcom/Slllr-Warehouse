"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("wallet");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("recordPayment")}</Button>
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
  const t = useTranslations("wallet");
  const tc = useTranslations("common");
  const toast = useToast();
  const titleId = useId();
  const [amount, setAmount] = useState("");
  const [state, formAction] = useActionState<PaymentState, FormData>(
    recordPayment,
    {},
  );

  useEffect(() => {
    if (!state.savedAt) return;
    toast(t("paymentRecorded"));
    onClose();
    // Only react to a fresh save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.savedAt]);

  const paid = Number(amount);
  const after = Number.isFinite(paid) && paid > 0 ? balance - paid : null;

  return (
    <Modal open onClose={onClose} labelledBy={titleId}>
      <div id={titleId} className="mb-1 text-product font-medium">
        {t("recordPayment")}
      </div>
      <Muted className="mb-4">
        {t("paymentTo", { supplier: supplierName, balance: money(balance) })}
      </Muted>

      <form action={formAction}>
        <input type="hidden" name="supplier_id" value={supplierId} />

        <Field
          label={t("amountLabel", { currency: CURRENCY })}
          htmlFor="amount"
        >
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

        <Field label={t("paidOn")} htmlFor="paid_on">
          <Input
            id="paid_on"
            name="paid_on"
            type="date"
            defaultValue={today}
            required
          />
        </Field>

        <Field label={t("method")} htmlFor="method" hint={tc("optional")}>
          <Input
            id="method"
            name="method"
            placeholder={t("methodPlaceholder")}
            list="payment-methods"
          />
        </Field>
        <datalist id="payment-methods">
          <option value={t("methodBank")} />
          <option value={t("methodCheque")} />
          <option value={t("methodCash")} />
          <option value={t("methodCard")} />
        </datalist>

        <Field
          label={tc("reference")}
          htmlFor="reference"
          hint={tc("optional")}
        >
          <Input id="reference" name="reference" placeholder="PAY-9001" />
        </Field>

        <Field label={tc("note")} htmlFor="note" hint={tc("optional")}>
          <Textarea id="note" name="note" rows={2} />
        </Field>

        {after !== null ? (
          <Note calm={after >= 0}>
            {t.rich("balanceAfter", {
              before: money(balance),
              after: money(after),
              b: (chunks) => <b>{chunks}</b>,
            })}
            {after < 0 ? t("overpays") : ""}
          </Note>
        ) : null}

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
  const t = useTranslations("wallet");
  const tc = useTranslations("common");
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="flex-1" disabled={pending}>
      {pending ? tc("recording") : t("recordPayment")}
    </Button>
  );
}
