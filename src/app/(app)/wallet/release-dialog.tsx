"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useId, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Muted } from "@/components/ui/card";
import {
  Field,
  FieldError,
  Input,
  Note,
  Select,
  Textarea,
} from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { n } from "@/lib/format";
import { money } from "@/lib/money";
import { releasableProducts, simulateRelease, type Po } from "@/lib/po";
import { releaseReserved, type ReleaseState } from "./release-actions";

export function ReleaseReservedButton({ pos }: { pos: Po[] }) {
  const t = useTranslations("po");
  const [open, setOpen] = useState(false);
  const products = useMemo(() => releasableProducts(pos), [pos]);

  if (products.length === 0) return null;

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        {t("releaseAction")}
      </Button>
      {open ? (
        <ReleaseDialog pos={pos} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

/**
 * Releases approved-but-undispatched units back to the supplier.
 *
 * The preview names the POs the RPC will take them from, newest first, before
 * anything is sent — giving stock back is not reversible from this screen, so
 * which commitments it cancels should not be a surprise.
 */
function ReleaseDialog({ pos, onClose }: { pos: Po[]; onClose: () => void }) {
  const t = useTranslations("po");
  const tc = useTranslations("common");
  const toast = useToast();
  const titleId = useId();

  const products = useMemo(() => releasableProducts(pos), [pos]);
  const [sku, setSku] = useState(products[0]?.sku ?? "");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");

  const [state, formAction] = useActionState<ReleaseState, FormData>(
    releaseReserved,
    {},
  );

  const wanted = Number(qty);
  const preview = useMemo(
    () =>
      sku && Number.isInteger(wanted) && wanted > 0
        ? simulateRelease(sku, wanted, pos)
        : null,
    [sku, wanted, pos],
  );

  const reserved = products.find((product) => product.sku === sku)?.outstanding ?? 0;

  useEffect(() => {
    if (!state.savedAt) return;

    const failed = (state.results ?? []).filter((row) => !row.ok);
    if (failed.length > 0) {
      toast(failed[0].message);
      return;
    }

    toast(t("releaseDone", { qty: n(wanted) }));
    onClose();
    // Only react to a fresh send.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.savedAt]);

  const rows = JSON.stringify(
    preview && !preview.problem
      ? [{ sku, qty: wanted, ...(note.trim() ? { note: note.trim() } : {}) }]
      : [],
  );

  return (
    <Modal open onClose={onClose} labelledBy={titleId}>
      <div id={titleId} className="mb-1 text-product font-medium">
        {t("releaseTitle")}
      </div>
      <Muted className="mb-4">{t("releaseLede")}</Muted>

      <form action={formAction}>
        <input type="hidden" name="rows" value={rows} />

        <Field label={t("releaseProduct")} htmlFor="release-sku">
          <Select
            id="release-sku"
            value={sku}
            onChange={(event) => setSku(event.target.value)}
          >
            <option value="">{t("releasePickProduct")}</option>
            {products.map((product) => (
              <option key={product.sku} value={product.sku}>
                {product.sku} · {product.name} ({n(product.outstanding)})
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={t("releaseQty")}
          htmlFor="release-qty"
          hint={sku ? t("releaseReserved", { qty: n(reserved) }) : undefined}
        >
          <Input
            id="release-qty"
            type="number"
            min={1}
            max={reserved || undefined}
            value={qty}
            onChange={(event) => setQty(event.target.value)}
          />
        </Field>

        <Field label={t("releaseNote")} htmlFor="release-note" hint={tc("optional")}>
          <Textarea
            id="release-note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("releaseNotePlaceholder")}
          />
        </Field>

        {preview ? (
          preview.problem === "skuNotFound" ? (
            <Note>{t("releaseNothing")}</Note>
          ) : preview.problem === "onlyReserved" ? (
            <Note>
              {t("releaseTooMany", { available: n(preview.available) })}
            </Note>
          ) : (
            <Note calm>
              <div className="mb-1 font-medium">{t("releaseHits")}</div>
              <ul className="flex flex-col gap-[2px]">
                {preview.hits.map((hit, index) => (
                  <li key={hit.po_ref}>
                    <span className="text-ink-3">{index + 1}.</span>{" "}
                    <span className="latin font-mono">{hit.po_ref}</span>{" "}
                    <span className="text-ink-3">
                      {t("queueBadge", { position: hit.queue_position })}
                    </span>{" "}
                    <b className="font-medium tabular-nums">{n(hit.qty)}</b>
                  </li>
                ))}
              </ul>
              {preview.value === null ? null : (
                <div className="mt-1 text-ink-2">{money(preview.value)}</div>
              )}
            </Note>
          )
        ) : null}

        <FieldError>{state.error}</FieldError>

        <div className="flex gap-[9px]">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Submit
            label={t("releaseConfirm", { qty: n(wanted || 0) })}
            busy={t("releaseSubmitting")}
            disabled={!preview || preview.problem !== null}
          />
        </div>
      </form>
    </Modal>
  );
}

function Submit({
  label,
  busy,
  disabled,
}: {
  label: string;
  busy: string;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="flex-1" disabled={pending || disabled}>
      {pending ? busy : label}
    </Button>
  );
}
