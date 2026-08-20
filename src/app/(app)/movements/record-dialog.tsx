"use client";

import { useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState, useTransition } from "react";

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
import { cn } from "@/lib/cn";
import { n } from "@/lib/format";
import {
  KINDS_BY_DIRECTION,
  type Direction,
  type MovementKind,
} from "@/lib/movements";
import { movementCsvTemplate, parseMovementCsv } from "@/lib/movements-csv";
import type { ProductStock } from "@/lib/types";
import {
  recordMovements,
  type MovementResult,
  type MovementRow,
} from "./actions";

type Props = {
  direction: Direction;
  shelf: ProductStock[];
};

export function RecordMovementButton(props: Props) {
  const t = useTranslations("movements");
  const [open, setOpen] = useState(false);
  const inbound = props.direction === "in";

  return (
    <>
      <Button
        variant={inbound ? "primary" : "ghost"}
        onClick={() => setOpen(true)}
      >
        {inbound ? t("recordInbound") : t("recordOutbound")}
      </Button>
      {open ? <RecordDialog {...props} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

const TH =
  "px-[10px] pb-[8px] text-start text-th font-normal uppercase tracking-[0.4px] text-ink-2";
const TD = "border-t border-line px-[10px] py-[9px] align-middle";

function RecordDialog({
  direction,
  shelf,
  onClose,
}: Props & { onClose: () => void }) {
  const t = useTranslations("movements");
  const tc = useTranslations("common");
  const tcsv = useTranslations("csv");
  const terr = useTranslations("csvErrors");
  const te = useTranslations("errors");
  const toast = useToast();
  const titleId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const inbound = direction === "in";
  const kinds = KINDS_BY_DIRECTION[direction];

  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState("");
  const [kind, setKind] = useState<MovementKind>(kinds[0]);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [csv, setCsv] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MovementResult[] | null>(null);
  const [pending, startTransition] = useTransition();

  const product = shelf.find((row) => row.sku === sku) ?? null;

  const parsed = useMemo(
    () => parseMovementCsv(csv, direction),
    [csv, direction],
  );

  const quantity = Number(qty);

  // What the shelf looks like afterwards, so the guard is visible up front.
  const after =
    product && Number.isInteger(quantity) && quantity > 0
      ? inbound
        ? product.total_qty + quantity
        : product.total_qty - quantity
      : null;

  // Nothing here touches the reserve — a dispatch is the only outbound that
  // does, and it is recorded on the daily update screen.
  const breachesReserve =
    !inbound &&
    after !== null &&
    product !== null &&
    after < product.reserved_qty;

  function submit(rows: MovementRow[]) {
    setError(null);
    const body = new FormData();
    body.set("rows", JSON.stringify(rows));

    startTransition(async () => {
      const result = await recordMovements({}, body);

      if (result.error) {
        setError(result.error);
        return;
      }

      const list = result.results ?? [];
      setResults(list);
      const failed = list.filter((row) => !row.ok).length;
      toast(
        failed === 0
          ? t("recordedToast", { count: list.length })
          : t("failedToast", { failed: n(failed), total: n(list.length) }),
      );
    });
  }

  function submitSingle() {
    if (!product) return setError(te("pickProduct"));
    if (!Number.isInteger(quantity) || quantity < 1) {
      return setError(te("qtyAtLeastOne"));
    }
    submit([
      {
        sku,
        qty: quantity,
        direction,
        kind,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      },
    ]);
  }

  const csvHeaders = {
    sku: tcsv("sku"),
    qty: tcsv("qty"),
    kind: tcsv("kind"),
    reference: tcsv("reference"),
    note: tcsv("note"),
  };
  // The kind written into the template is the enum value, not its label: an
  // Arabic word inside a comma-separated line reorders under bidi and comes
  // back unreadable. Arabic spellings still parse if someone types one.
  const template = movementCsvTemplate(direction, csvHeaders, kinds[0]);

  function downloadTemplate() {
    const url = URL.createObjectURL(
      new Blob([template], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = inbound ? t("templateInbound") : t("templateOutbound");
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setResults(null);
    setCsv(await file.text());
    event.target.value = "";
  }

  const failedCount = results?.filter((row) => !row.ok).length ?? 0;

  return (
    <Modal open onClose={onClose} labelledBy={titleId}>
      <div id={titleId} className="mb-1 text-product font-medium">
        {inbound ? t("inboundTitle") : t("outboundTitle")}
      </div>
      <Muted className="mb-4">
        {inbound ? t("inboundLede") : t("outboundLede")}
      </Muted>

      {results ? (
        <Results
          results={results}
          failedCount={failedCount}
          onDone={onClose}
          onAgain={() => {
            setResults(null);
            setCsv("");
            setQty("");
          }}
        />
      ) : (
        <>
          <div className="mb-[14px] flex gap-[2px] rounded-btn bg-card-soft p-[3px]">
            {(["single", "bulk"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={mode === option}
                onClick={() => {
                  setMode(option);
                  setError(null);
                }}
                className={cn(
                  "flex-1 rounded-[10px] px-3 py-[7px] text-label transition-colors",
                  mode === option
                    ? "bg-ink text-white"
                    : "text-ink-2 hover:text-ink",
                )}
              >
                {option === "single" ? t("oneProduct") : t("bulkCsv")}
              </button>
            ))}
          </div>

          {mode === "single" ? (
            <>
              <Field label={tc("product")} htmlFor="sku">
                <Select
                  id="sku"
                  value={sku}
                  onChange={(event) => setSku(event.target.value)}
                >
                  <option value="">{t("pickSku")}</option>
                  {shelf.map((row) => (
                    <option key={row.id} value={row.sku}>
                      {row.sku} · {row.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={tc("kind")} htmlFor="kind">
                <Select
                  id="kind"
                  value={kind}
                  onChange={(event) => {
                    setKind(event.target.value as MovementKind);
                    setError(null);
                  }}
                >
                  {kinds.map((option) => (
                    <option key={option} value={option}>
                      {t(`kind_${option}`)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={tc("qty")} htmlFor="qty">
                <Input
                  id="qty"
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(event) => {
                    setQty(event.target.value);
                    setError(null);
                  }}
                  placeholder="120"
                />
              </Field>

              <Field
                label={tc("reference")}
                htmlFor="reference"
                hint={tc("optional")}
              >
                <Input
                  id="reference"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder={inbound ? "PO-4821" : "INV-3390"}
                />
              </Field>

              <Field label={tc("note")} htmlFor="note" hint={tc("optional")}>
                <Textarea
                  id="note"
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </Field>

              {product && after !== null ? (
                <Note calm={!breachesReserve}>
                  {t.rich("shelfAfter", {
                    before: n(product.total_qty),
                    after: n(after),
                    b: (chunks) => <b>{chunks}</b>,
                  })}
                  {breachesReserve
                    ? t("wouldBreach", { reserved: n(product.reserved_qty) })
                    : t("staysReserved", {
                        reserved: n(product.reserved_qty),
                      })}
                </Note>
              ) : null}

              <FieldError>{error}</FieldError>

              <div className="flex gap-[9px]">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={onClose}
                  disabled={pending}
                >
                  {tc("cancel")}
                </Button>
                <Button
                  className="flex-1"
                  onClick={submitSingle}
                  disabled={pending || !product}
                >
                  {pending
                    ? tc("recording")
                    : inbound
                      ? t("recordInbound")
                      : t("recordOutbound")}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Muted className="mb-[10px]">
                {/* The values a file actually carries, not their labels —
                    the same words the template writes and the parser names
                    back in an error. */}
                {t("csvLede", { kinds: kinds.join(tc("listSep")) })}
                {!inbound ? t("csvDispatchNote") : ""}
              </Muted>

              <div className="mb-[13px] flex flex-wrap gap-[9px]">
                <Button
                  variant="ghost"
                  onClick={() => fileRef.current?.click()}
                >
                  {tc("uploadCsv")}
                </Button>
                <Button variant="ghost" onClick={downloadTemplate}>
                  {tc("downloadTemplate")}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFile}
                  className="hidden"
                />
              </div>

              <Textarea
                rows={5}
                value={csv}
                onChange={(event) => {
                  setCsv(event.target.value);
                  setError(null);
                }}
                placeholder={template}
                aria-label={tc("pasteCsv")}
                dir="ltr"
                className="mb-[13px] font-mono text-meta"
              />

              {parsed.problems.length > 0 ? (
                <Note>
                  <div className="mb-1 font-medium">
                    {tc("linesSkipped", { count: parsed.problems.length })}
                  </div>
                  <ul className="flex flex-col gap-[2px]">
                    {parsed.problems.slice(0, 5).map((problem) => (
                      <li key={problem.line}>
                        {tc("lineNumber", {
                          line: problem.line,
                          message: terr(problem.key, problem.params),
                        })}
                      </li>
                    ))}
                  </ul>
                </Note>
              ) : null}

              {parsed.rows.length > 0 ? (
                <div className="scroll-x mb-[13px] max-h-[220px] overflow-y-auto">
                  <table className="w-full border-collapse text-body">
                    <thead>
                      <tr>
                        <th className={TH}>{tc("sku")}</th>
                        <th className={TH}>{tc("qty")}</th>
                        <th className={TH}>{tc("kind")}</th>
                        <th className={TH}>{tc("reference")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.map((row, index) => (
                        <tr key={`${row.sku}-${index}`}>
                          <td className={`${TD} font-mono text-meta`}>
                            <span className="latin">{row.sku}</span>
                          </td>
                          <td className={`${TD} tabular-nums`}>{n(row.qty)}</td>
                          <td className={TD}>{t(`kind_${row.kind}`)}</td>
                          <td className={`${TD} text-ink-2`}>
                            {row.reference ?? tc("dash")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <FieldError>{error}</FieldError>

              <div className="flex gap-[9px]">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={onClose}
                  disabled={pending}
                >
                  {tc("cancel")}
                </Button>
                <Button
                  className="flex-1"
                  disabled={pending || parsed.rows.length === 0}
                  onClick={() =>
                    submit(parsed.rows.map((row) => ({ ...row, direction })))
                  }
                >
                  {pending
                    ? tc("recording")
                    : t("recordRows", { count: parsed.rows.length })}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

function Results({
  results,
  failedCount,
  onDone,
  onAgain,
}: {
  results: MovementResult[];
  failedCount: number;
  onDone: () => void;
  onAgain: () => void;
}) {
  const t = useTranslations("movements");
  const tc = useTranslations("common");

  return (
    <>
      {failedCount > 0 ? (
        <Note>{t("refused", { count: failedCount })}</Note>
      ) : (
        <Note calm>{t("allWentThrough", { count: n(results.length) })}</Note>
      )}

      <div className="scroll-x mb-[13px] max-h-[280px] overflow-y-auto">
        <table className="w-full border-collapse text-body">
          <thead>
            <tr>
              <th className={TH}>{tc("sku")}</th>
              <th className={TH}>{tc("result")}</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row, index) => (
              <tr key={`${row.sku}-${index}`}>
                <td className={`${TD} font-mono text-meta`}>
                  <span className="latin">{row.sku ?? tc("dash")}</span>
                </td>
                <td className={TD}>
                  <span
                    className={cn(
                      "inline-block rounded-pill px-[10px] py-[4px] text-meta",
                      row.ok
                        ? "bg-green-soft text-green"
                        : "bg-red-soft text-orange-ink",
                    )}
                  >
                    {row.message}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-[9px]">
        <Button variant="ghost" className="flex-1" onClick={onAgain}>
          {t("recordMore")}
        </Button>
        <Button className="flex-1" onClick={onDone}>
          {tc("done")}
        </Button>
      </div>
    </>
  );
}
