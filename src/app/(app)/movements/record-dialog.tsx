"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

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
  KIND_LABELS,
  RELEASE_KIND,
  releaseOutcome,
  type Direction,
  type MovementKind,
} from "@/lib/movements";
import { movementCsvTemplate, parseMovementCsv } from "@/lib/movements-csv";
import type { ApprovedRequestOption } from "@/lib/data/movements";
import type { ProductStock } from "@/lib/types";
import {
  recordMovements,
  type MovementResult,
  type MovementRow,
} from "./actions";

type Props = {
  direction: Direction;
  shelf: ProductStock[];
  approvedBySku: Record<string, ApprovedRequestOption[]>;
};

export function RecordMovementButton(props: Props) {
  const [open, setOpen] = useState(false);
  const inbound = props.direction === "in";

  return (
    <>
      <Button
        variant={inbound ? "primary" : "ghost"}
        onClick={() => setOpen(true)}
      >
        {inbound ? "Record inbound" : "Record outbound"}
      </Button>
      {open ? <RecordDialog {...props} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

const TH =
  "px-[10px] pb-[8px] text-left text-th font-normal uppercase tracking-[0.4px] text-ink-2";
const TD = "border-t border-line px-[10px] py-[9px] align-middle";

function RecordDialog({
  direction,
  shelf,
  approvedBySku,
  onClose,
}: Props & { onClose: () => void }) {
  const toast = useToast();
  const titleId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const inbound = direction === "in";
  const kinds = KINDS_BY_DIRECTION[direction];

  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState("");
  const [kind, setKind] = useState<MovementKind>(kinds[0]);
  const [requestId, setRequestId] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [csv, setCsv] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MovementResult[] | null>(null);
  const [pending, startTransition] = useTransition();

  const product = shelf.find((row) => row.sku === sku) ?? null;
  const options = approvedBySku[sku] ?? [];
  const chosen = options.find((option) => option.id === requestId) ?? null;
  const isRelease = kind === RELEASE_KIND;

  // A different product means a different set of approved requests.
  useEffect(() => setRequestId(""), [sku]);

  const parsed = useMemo(
    () => parseMovementCsv(csv, direction),
    [csv, direction],
  );

  const quantity = Number(qty);
  const outcome =
    isRelease && chosen ? releaseOutcome(quantity, chosen.outstanding) : null;

  // What the shelf looks like afterwards, so the guard is visible up front.
  const after =
    product && Number.isInteger(quantity) && quantity > 0
      ? inbound
        ? product.total_qty + quantity
        : product.total_qty - quantity
      : null;

  // A release hands reserved stock over, so the reserve falls with it. Any
  // other outbound leaves the reserve where it is.
  const reservedAfter =
    product === null
      ? 0
      : isRelease && Number.isInteger(quantity) && quantity > 0
        ? Math.max(0, product.reserved_qty - quantity)
        : product.reserved_qty;

  // Releasing does not change what was approved; it moves released up.
  const releasedAfter = chosen
    ? chosen.qty_released +
      (Number.isInteger(quantity) && quantity > 0 ? quantity : 0)
    : 0;

  const breachesReserve =
    !inbound && after !== null && product !== null && after < reservedAfter;

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
          ? `Recorded ${n(list.length)} ${list.length === 1 ? "movement" : "movements"}`
          : `${n(failed)} of ${n(list.length)} rows failed`,
      );
    });
  }

  function submitSingle() {
    if (!product) return setError("Pick a product first.");
    if (!Number.isInteger(quantity) || quantity < 1) {
      return setError("Enter a quantity of at least 1.");
    }
    if (isRelease && !chosen) {
      return setError("Pick the approved request this release is against.");
    }
    if (outcome && !outcome.valid) return setError(outcome.message);

    submit([
      {
        sku,
        qty: quantity,
        direction,
        kind,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(isRelease && chosen ? { request_id: chosen.id } : {}),
      },
    ]);
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(
      new Blob([movementCsvTemplate(direction)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${inbound ? "inbound" : "outbound"}-template.csv`;
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
        {inbound ? "Record inbound stock" : "Record outbound stock"}
      </div>
      <Muted className="mb-4">
        {inbound
          ? "Stock arriving on your shelf."
          : "Stock leaving your shelf. It can never take a product below what is reserved for Sllr."}
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
            setRequestId("");
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
                {option === "single" ? "One product" : "Bulk CSV"}
              </button>
            ))}
          </div>

          {mode === "single" ? (
            <>
              <Field label="Product" htmlFor="sku">
                <Select
                  id="sku"
                  value={sku}
                  onChange={(event) => setSku(event.target.value)}
                >
                  <option value="">Pick a SKU…</option>
                  {shelf.map((row) => (
                    <option key={row.id} value={row.sku}>
                      {row.sku} · {row.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Kind" htmlFor="kind">
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
                      {KIND_LABELS[option]}
                    </option>
                  ))}
                </Select>
              </Field>

              {isRelease ? (
                <Field
                  label="Against which approved request"
                  htmlFor="request"
                  hint="A release has to be booked against one approved reserve request."
                >
                  <Select
                    id="request"
                    value={requestId}
                    onChange={(event) => setRequestId(event.target.value)}
                    disabled={!sku}
                  >
                    <option value="">
                      {!sku
                        ? "Pick a product first…"
                        : options.length === 0
                          ? "No approved requests on this product"
                          : "Pick a request…"}
                    </option>
                    {options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {n(option.outstanding)} outstanding of{" "}
                        {n(option.qty_approved)} approved
                        {option.note ? ` · ${option.note}` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}

              <Field label="Quantity" htmlFor="qty">
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

              <Field label="Reference" htmlFor="reference" hint="Optional.">
                <Input
                  id="reference"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder={inbound ? "PO-4821" : "INV-3390"}
                />
              </Field>

              <Field label="Note" htmlFor="note" hint="Optional.">
                <Textarea
                  id="note"
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </Field>

              {product && after !== null ? (
                <Note calm={!breachesReserve}>
                  {n(product.total_qty)} → <b>{n(after)}</b> on the shelf
                  {breachesReserve ? (
                    <>
                      {" "}
                      — that is below the {n(product.reserved_qty)} reserved for
                      Sllr, so this will be refused.
                    </>
                  ) : reservedAfter !== product.reserved_qty ? (
                    <>
                      {" "}
                      · reserved for Sllr {n(product.reserved_qty)} →{" "}
                      <b>{n(reservedAfter)}</b>
                    </>
                  ) : (
                    <> · {n(product.reserved_qty)} stays reserved for Sllr</>
                  )}
                </Note>
              ) : null}

              {chosen ? (
                <Note calm>
                  <div className="mb-1 font-medium">This request</div>
                  <div className="flex flex-wrap gap-x-[18px] gap-y-[2px]">
                    <span>Requested {n(chosen.qty_requested)}</span>
                    <span>Approved {n(chosen.qty_approved)}</span>
                    <span>
                      Released {n(chosen.qty_released)}
                      {releasedAfter !== chosen.qty_released ? (
                        <>
                          {" "}
                          → <b>{n(releasedAfter)}</b>
                        </>
                      ) : null}
                    </span>
                    <span>
                      Outstanding {n(chosen.outstanding)}
                      {outcome?.valid ? (
                        <>
                          {" "}
                          → <b>{n(chosen.outstanding - quantity)}</b>
                        </>
                      ) : null}
                    </span>
                  </div>
                </Note>
              ) : null}

              {outcome ? (
                <Note calm={outcome.valid}>{outcome.message}</Note>
              ) : null}

              <FieldError>{error}</FieldError>

              <div className="flex gap-[9px]">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={onClose}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={submitSingle}
                  disabled={pending || !product}
                >
                  {pending
                    ? "Recording…"
                    : inbound
                      ? "Record inbound"
                      : "Record outbound"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Muted className="mb-[10px]">
                Columns are sku, qty, kind, reference, note. Kind must be one of{" "}
                {kinds
                  .filter((k) => k !== RELEASE_KIND)
                  .map((k) => KIND_LABELS[k].toLowerCase())
                  .join(", ")}
                .
                {!inbound
                  ? " Releases to Sllr are one at a time, because each names a request."
                  : ""}
              </Muted>

              <div className="mb-[13px] flex flex-wrap gap-[9px]">
                <Button
                  variant="ghost"
                  onClick={() => fileRef.current?.click()}
                >
                  Upload CSV
                </Button>
                <Button variant="ghost" onClick={downloadTemplate}>
                  Download CSV template
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
                placeholder={movementCsvTemplate(direction)}
                aria-label="Paste CSV"
                className="mb-[13px] font-mono text-meta"
              />

              {parsed.problems.length > 0 ? (
                <Note>
                  <div className="mb-1 font-medium">
                    {parsed.problems.length === 1
                      ? "1 line was skipped"
                      : `${n(parsed.problems.length)} lines were skipped`}
                  </div>
                  <ul className="flex flex-col gap-[2px]">
                    {parsed.problems.slice(0, 5).map((problem) => (
                      <li key={problem.line}>
                        Line {problem.line}: {problem.message}
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
                        <th className={TH}>SKU</th>
                        <th className={TH}>Qty</th>
                        <th className={TH}>Kind</th>
                        <th className={TH}>Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.map((row, index) => (
                        <tr key={`${row.sku}-${index}`}>
                          <td className={`${TD} font-mono text-meta`}>
                            {row.sku}
                          </td>
                          <td className={`${TD} tabular-nums`}>{n(row.qty)}</td>
                          <td className={TD}>{KIND_LABELS[row.kind]}</td>
                          <td className={`${TD} text-ink-2`}>
                            {row.reference ?? "—"}
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
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={pending || parsed.rows.length === 0}
                  onClick={() =>
                    submit(parsed.rows.map((row) => ({ ...row, direction })))
                  }
                >
                  {pending
                    ? "Recording…"
                    : `Record ${n(parsed.rows.length)} ${parsed.rows.length === 1 ? "row" : "rows"}`}
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
  return (
    <>
      {failedCount > 0 ? (
        <Note>
          {failedCount === 1
            ? "1 row was refused and nothing was recorded for it."
            : `${n(failedCount)} rows were refused and nothing was recorded for them.`}
        </Note>
      ) : (
        <Note calm>
          All {n(results.length)} {results.length === 1 ? "row" : "rows"} went
          through.
        </Note>
      )}

      <div className="scroll-x mb-[13px] max-h-[280px] overflow-y-auto">
        <table className="w-full border-collapse text-body">
          <thead>
            <tr>
              <th className={TH}>SKU</th>
              <th className={TH}>Result</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row, index) => (
              <tr key={`${row.sku}-${index}`}>
                <td className={`${TD} font-mono text-meta`}>
                  {row.sku ?? "—"}
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
          Record more
        </Button>
        <Button className="flex-1" onClick={onDone}>
          Done
        </Button>
      </div>
    </>
  );
}
