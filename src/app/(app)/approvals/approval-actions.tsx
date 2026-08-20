"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Muted } from "@/components/ui/card";
import { Field, FieldError, Input, Note, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  approveRequest,
  rejectRequest,
  type DecisionState,
} from "@/lib/actions/reserve";
import { n } from "@/lib/format";

type Props = {
  id: string;
  productName: string;
  qtyRequested: number;
  /** `total_qty - reserved_qty` — what the RPC will cap a grant at. */
  available: number;
};

export function ApprovalActions(props: Props) {
  const t = useTranslations("approvals");
  const [partialOpen, setPartialOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  // The RPC caps the grant itself; showing the capped number keeps the button
  // honest about what pressing it will do.
  const grant = Math.min(props.qtyRequested, Math.max(props.available, 0));
  const capped = grant < props.qtyRequested;

  return (
    <div className="flex flex-wrap items-center gap-[9px]">
      <Button variant="no" onClick={() => setRejectOpen(true)}>
        {t("reject")}
      </Button>

      <Button
        variant="ghost"
        onClick={() => setPartialOpen(true)}
        disabled={props.available < 1}
      >
        {t("approvePart")}
      </Button>

      <ApproveForm
        id={props.id}
        qty={capped ? String(grant) : ""}
        label={capped ? t("approveN", { count: n(grant) }) : t("approve")}
        disabled={props.available < 1}
        toastMessage={t("approvedToast", { count: n(grant) })}
      />

      {partialOpen ? (
        <PartialDialog {...props} onClose={() => setPartialOpen(false)} />
      ) : null}

      {rejectOpen ? (
        <RejectDialog {...props} onClose={() => setRejectOpen(false)} />
      ) : null}
    </div>
  );
}

/** Full approve sends no qty; a capped approve sends the number. */
function ApproveForm({
  id,
  qty,
  label,
  disabled,
  toastMessage,
}: {
  id: string;
  qty: string;
  label: string;
  disabled?: boolean;
  toastMessage: string;
}) {
  const t = useTranslations("approvals");
  const toast = useToast();
  const [state, formAction] = useActionState<DecisionState, FormData>(
    approveRequest,
    {},
  );

  useEffect(() => {
    if (state.savedAt) toast(toastMessage);
    else if (state.error) toast(state.error);
  }, [state, toast, toastMessage]);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      {qty ? <input type="hidden" name="qty" value={qty} /> : null}
      <SubmitButton
        variant="ok"
        label={label}
        busy={t("approving")}
        disabled={disabled}
      />
    </form>
  );
}

function PartialDialog({
  id,
  productName,
  qtyRequested,
  available,
  onClose,
}: Props & { onClose: () => void }) {
  const t = useTranslations("approvals");
  const tc = useTranslations("common");
  const toast = useToast();
  const titleId = useId();
  const [state, formAction] = useActionState<DecisionState, FormData>(
    approveRequest,
    {},
  );
  const [qty, setQty] = useState(
    String(Math.min(qtyRequested, Math.max(available, 0))),
  );

  useEffect(() => {
    if (!state.savedAt) return;
    toast(t("approvedToast", { count: n(Number(qty)) }));
    onClose();
    // Only react to a fresh decision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.savedAt]);

  return (
    <Modal open onClose={onClose} labelledBy={titleId}>
      <div id={titleId} className="mb-1 text-product font-medium">
        {t("partialTitle")}
      </div>
      <Muted className="mb-4">
        {t("partialLede", { product: productName, count: n(qtyRequested) })}
      </Muted>

      <form action={formAction}>
        <input type="hidden" name="id" value={id} />

        <Field label={t("unitsToApprove")} htmlFor="partial-qty">
          <Input
            id="partial-qty"
            name="qty"
            type="number"
            min={1}
            max={available}
            value={qty}
            onChange={(event) => setQty(event.target.value)}
            required
          />
        </Field>

        <Note calm>
          {t("leftToGrant", {
            available: n(available),
            requested: n(qtyRequested),
          })}
        </Note>

        <FieldError>{state.error}</FieldError>

        <div className="flex gap-[9px]">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <SubmitButton
            variant="ok"
            label={t("approveN", { count: n(Number(qty) || 0) })}
            busy={t("approving")}
            className="flex-1"
          />
        </div>
      </form>
    </Modal>
  );
}

function RejectDialog({
  id,
  productName,
  qtyRequested,
  onClose,
}: Props & { onClose: () => void }) {
  const t = useTranslations("approvals");
  const toast = useToast();
  const titleId = useId();
  const [state, formAction] = useActionState<DecisionState, FormData>(
    rejectRequest,
    {},
  );

  useEffect(() => {
    if (!state.savedAt) return;
    toast(t("rejectedToast"));
    onClose();
    // Only react to a fresh decision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.savedAt]);

  return (
    <Modal open onClose={onClose} labelledBy={titleId}>
      <div id={titleId} className="mb-1 text-product font-medium">
        {t("rejectTitle")}
      </div>
      <Muted className="mb-4">
        {t("partialLede", { product: productName, count: n(qtyRequested) })}
      </Muted>

      <form action={formAction}>
        <input type="hidden" name="id" value={id} />

        <Field label={t("reasonOptional")} htmlFor="reject-note">
          <Textarea
            id="reject-note"
            name="note"
            rows={2}
            placeholder={t("reasonPlaceholder")}
          />
        </Field>

        <FieldError>{state.error}</FieldError>

        <div className="flex gap-[9px]">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            {t("keepPending")}
          </Button>
          <SubmitButton
            variant="no"
            label={t("rejectRequest")}
            busy={t("rejecting")}
            className="flex-1"
          />
        </div>
      </form>
    </Modal>
  );
}

function SubmitButton({
  variant,
  label,
  busy,
  className,
  disabled,
}: {
  variant: "ok" | "no";
  label: string;
  busy: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      className={className}
      disabled={pending || disabled}
    >
      {pending ? busy : label}
    </Button>
  );
}
