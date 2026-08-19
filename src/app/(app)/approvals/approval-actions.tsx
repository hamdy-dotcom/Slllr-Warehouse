"use client";

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
  const [partialOpen, setPartialOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  // The RPC caps the grant itself; showing the capped number keeps the button
  // honest about what pressing it will do.
  const grant = Math.min(props.qtyRequested, Math.max(props.available, 0));
  const capped = grant < props.qtyRequested;

  return (
    <div className="flex flex-wrap items-center gap-[9px]">
      <Button variant="no" onClick={() => setRejectOpen(true)}>
        Reject
      </Button>

      <Button
        variant="ghost"
        onClick={() => setPartialOpen(true)}
        disabled={props.available < 1}
      >
        Approve part
      </Button>

      <ApproveForm
        id={props.id}
        qty={capped ? String(grant) : ""}
        label={capped ? `Approve ${n(grant)}` : "Approve"}
        disabled={props.available < 1}
        toastMessage={`Approved — ${n(grant)} units moved to Reserved for Sllr`}
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
      <SubmitButton variant="ok" label={label} busy="Approving…" disabled={disabled} />
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
    toast(`Approved — ${n(Number(qty))} units moved to Reserved for Sllr`);
    onClose();
    // Only react to a fresh decision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.savedAt]);

  return (
    <Modal open onClose={onClose} labelledBy={titleId}>
      <div id={titleId} className="mb-1 text-product font-medium">
        Approve part of this request
      </div>
      <Muted className="mb-4">
        {productName} · {n(qtyRequested)} units requested
      </Muted>

      <form action={formAction}>
        <input type="hidden" name="id" value={id} />

        <Field label="Units to approve" htmlFor="partial-qty">
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
          {n(available)} left to grant. The request keeps its original{" "}
          {n(qtyRequested)} on record.
        </Note>

        <FieldError>{state.error}</FieldError>

        <div className="flex gap-[9px]">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <SubmitButton
            variant="ok"
            label={`Approve ${n(Number(qty) || 0)}`}
            busy="Approving…"
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
  const toast = useToast();
  const titleId = useId();
  const [state, formAction] = useActionState<DecisionState, FormData>(
    rejectRequest,
    {},
  );

  useEffect(() => {
    if (!state.savedAt) return;
    toast("Request rejected");
    onClose();
    // Only react to a fresh decision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.savedAt]);

  return (
    <Modal open onClose={onClose} labelledBy={titleId}>
      <div id={titleId} className="mb-1 text-product font-medium">
        Reject this request
      </div>
      <Muted className="mb-4">
        {productName} · {n(qtyRequested)} units requested
      </Muted>

      <form action={formAction}>
        <input type="hidden" name="id" value={id} />

        <Field label="Reason (optional)" htmlFor="reject-note">
          <Textarea
            id="reject-note"
            name="note"
            rows={2}
            placeholder="Tell the Sllr team why"
          />
        </Field>

        <FieldError>{state.error}</FieldError>

        <div className="flex gap-[9px]">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Keep it pending
          </Button>
          <SubmitButton
            variant="no"
            label="Reject request"
            busy="Rejecting…"
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
