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
import { n } from "@/lib/format";
import type { TransferLine } from "@/lib/transfers";
import { recordArrivals, type ArrivalState } from "./actions";

/**
 * The two ways a delivery turns up at the warehouse.
 *
 * "Arrived in full" is one tap because it is the common case — the lorry
 * brought what the PO said. The partial dialog exists for the rest, and both
 * end in the same RPC with a different quantity.
 */
export function ArrivalActions({
  line,
  today,
}: {
  line: TransferLine;
  today: string;
}) {
  const t = useTranslations("transfers");
  const [partialOpen, setPartialOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-end gap-[9px]">
      <Button variant="ghost" onClick={() => setPartialOpen(true)}>
        {t("arrivedPartially")}
      </Button>

      <FullArrivalForm line={line} today={today} />

      {partialOpen ? (
        <PartialDialog
          line={line}
          today={today}
          onClose={() => setPartialOpen(false)}
        />
      ) : null}
    </div>
  );
}

function FullArrivalForm({
  line,
  today,
}: {
  line: TransferLine;
  today: string;
}) {
  const t = useTranslations("transfers");
  const toast = useToast();
  const [state, formAction] = useActionState<ArrivalState, FormData>(
    recordArrivals,
    {},
  );

  useEffect(() => {
    if (!state.savedAt) return;
    const failed = (state.results ?? []).filter((row) => !row.ok);
    toast(
      failed.length > 0
        ? failed[0].message
        : t("arrivedToast", { count: n(line.qty_awaiting_transfer) }),
    );
    // Only react to a fresh send.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.savedAt]);

  return (
    <form action={formAction}>
      <input
        type="hidden"
        name="rows"
        value={JSON.stringify([
          {
            po_id: line.po_id,
            qty: line.qty_awaiting_transfer,
            arrived_on: today,
          },
        ])}
      />
      <Submit label={t("arrivedInFull")} busy={t("recording")} />
      <FieldError>{state.error}</FieldError>
    </form>
  );
}

function PartialDialog({
  line,
  today,
  onClose,
}: {
  line: TransferLine;
  today: string;
  onClose: () => void;
}) {
  const t = useTranslations("transfers");
  const tc = useTranslations("common");
  const toast = useToast();
  const titleId = useId();

  const [qty, setQty] = useState("");
  const [date, setDate] = useState(today);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const [state, formAction] = useActionState<ArrivalState, FormData>(
    recordArrivals,
    {},
  );

  const wanted = Number(qty);
  const tooMany =
    Number.isInteger(wanted) && wanted > line.qty_awaiting_transfer;
  const valid = Number.isInteger(wanted) && wanted > 0 && !tooMany;

  useEffect(() => {
    if (!state.savedAt) return;
    const failed = (state.results ?? []).filter((row) => !row.ok);
    if (failed.length > 0) {
      toast(failed[0].message);
      return;
    }
    toast(t("arrivedToast", { count: n(wanted) }));
    onClose();
    // Only react to a fresh send.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.savedAt]);

  return (
    <Modal open onClose={onClose} labelledBy={titleId}>
      <div id={titleId} className="mb-1 text-product font-medium">
        {t("partialTitle")}
      </div>
      <Muted className="mb-4">
        {t("partialLede", {
          product: line.product_name,
          ref: line.po_ref,
          awaiting: n(line.qty_awaiting_transfer),
        })}
      </Muted>

      <form action={formAction}>
        <input
          type="hidden"
          name="rows"
          value={JSON.stringify(
            valid
              ? [
                  {
                    po_id: line.po_id,
                    qty: wanted,
                    arrived_on: date,
                    ...(reference.trim()
                      ? { reference: reference.trim() }
                      : {}),
                    ...(note.trim() ? { note: note.trim() } : {}),
                  },
                ]
              : [],
          )}
        />

        <Field label={t("partialQty")} htmlFor="arrival-qty">
          <Input
            id="arrival-qty"
            type="number"
            min={1}
            max={line.qty_awaiting_transfer}
            value={qty}
            onChange={(event) => setQty(event.target.value)}
          />
        </Field>

        <Field label={t("partialDate")} htmlFor="arrival-date">
          <Input
            id="arrival-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>

        <Field
          label={t("partialReference")}
          htmlFor="arrival-ref"
          hint={tc("optional")}
        >
          <Input
            id="arrival-ref"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="TRF-1"
          />
        </Field>

        <Field
          label={t("partialNote")}
          htmlFor="arrival-note"
          hint={tc("optional")}
        >
          <Textarea
            id="arrival-note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>

        {tooMany ? (
          <Note>
            {t("tooMany", { awaiting: n(line.qty_awaiting_transfer) })}
          </Note>
        ) : null}

        <FieldError>{state.error}</FieldError>

        <div className="flex gap-[9px]">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Submit
            className="flex-1"
            label={t("partialConfirm", { qty: n(wanted || 0) })}
            busy={t("recording")}
            disabled={!valid}
          />
        </div>
      </form>
    </Modal>
  );
}

function Submit({
  label,
  busy,
  className,
  disabled,
}: {
  label: string;
  busy: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className={className} disabled={pending || disabled}>
      {pending ? busy : label}
    </Button>
  );
}
