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
import {
  editRange,
  isVoiding,
  qtyProblem,
  reasonMissing,
  type ArrivalRow,
} from "@/lib/arrivals";
import { n } from "@/lib/format";
import { amendArrival, type AmendState } from "./actions";

/** The button that opens the editor, kept beside the row it edits. */
export function AmendButton({ row }: { row: ArrivalRow }) {
  const t = useTranslations("arrivals");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        {t("edit")}
      </Button>
      {open ? <AmendDialog row={row} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/**
 * Correcting one arrival.
 *
 * The three limits the RPC enforces are shown as one range and explained
 * while the operator types, and submit stays disabled outside it. That is the
 * point of the dialog: a refusal after the fact tells someone they were
 * wrong, a live range tells them what is right.
 */
function AmendDialog({
  row,
  onClose,
}: {
  row: ArrivalRow;
  onClose: () => void;
}) {
  const t = useTranslations("arrivals");
  const tc = useTranslations("common");
  const toast = useToast();
  const titleId = useId();

  const [qty, setQty] = useState(String(row.qty));
  const [date, setDate] = useState(row.arrived_on);
  const [reference, setReference] = useState(row.reference ?? "");
  const [note, setNote] = useState(row.note ?? "");
  const [reason, setReason] = useState("");

  const [state, formAction] = useActionState<AmendState, FormData>(
    amendArrival,
    {},
  );

  const range = editRange(row);
  const wanted = Number(qty);
  const problem = qty.trim() === "" ? "notANumber" : qtyProblem(wanted, range);
  const noReason = reasonMissing(reason);
  const valid = problem === null && !noReason;
  const voiding = valid && isVoiding(wanted);

  useEffect(() => {
    if (!state.savedAt) return;
    toast(state.voided ? t("savedVoided") : t("saved"));
    onClose();
    // Only react to a fresh send.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.savedAt]);

  return (
    <Modal open onClose={onClose} labelledBy={titleId}>
      <div id={titleId} className="mb-1 text-product font-medium">
        {t("editTitle")}
      </div>
      <Muted className="mb-4">
        {t("editLede", {
          sku: row.sku,
          ref: row.po_ref,
          date: row.arrived_on,
        })}
      </Muted>

      <Note calm>
        <div>{t("allowedRange", { min: n(range.min), max: n(range.max) })}</div>
        <ul className="mt-[6px] space-y-[3px] text-meta">
          {range.min > 0 ? (
            <li>{t("floorWhy", { count: n(range.min) })}</li>
          ) : null}
          <li>{t("ceilingWhy", { count: n(row.qty_still_awaiting) })}</li>
          {range.min === 0 ? <li>{t("voidWhy")}</li> : null}
        </ul>
      </Note>

      <form action={formAction}>
        <input type="hidden" name="arrival_id" value={row.arrival_id} />

        <Field label={t("qty")} htmlFor="amend-qty">
          <Input
            id="amend-qty"
            name="qty"
            type="number"
            min={range.min}
            max={range.max}
            value={qty}
            aria-invalid={problem !== null || undefined}
            onChange={(event) => setQty(event.target.value)}
          />
        </Field>

        {problem === "belowFloor" ? (
          <FieldError>{t("belowFloor", { min: n(range.min) })}</FieldError>
        ) : null}
        {problem === "aboveCeiling" ? (
          <FieldError>{t("aboveCeiling", { max: n(range.max) })}</FieldError>
        ) : null}
        {problem === "notANumber" && qty.trim() !== "" ? (
          <FieldError>{t("notANumber")}</FieldError>
        ) : null}

        <Field label={t("arrivedOn")} htmlFor="amend-date">
          <Input
            id="amend-date"
            name="arrived_on"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>

        <Field label={t("reference")} htmlFor="amend-reference">
          <Input
            id="amend-reference"
            name="reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </Field>

        <Field label={t("note")} htmlFor="amend-note">
          <Textarea
            id="amend-note"
            name="note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>

        <Field
          label={t("reason")}
          htmlFor="amend-reason"
          hint={t("reasonHint")}
        >
          <Input
            id="amend-reason"
            name="reason"
            value={reason}
            placeholder={t("reasonPlaceholder")}
            aria-invalid={noReason || undefined}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>

        <FieldError>{state.error}</FieldError>

        <div className="mt-1 flex gap-[9px]">
          <Button type="button" variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Submit
            className="flex-1"
            label={voiding ? t("savedVoided") : tc("save")}
            busy={tc("saving")}
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
