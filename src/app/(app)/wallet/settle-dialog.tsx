"use client";

import { useMemo, useRef, useState, useTransition, useId } from "react";

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
import { cn } from "@/lib/cn";
import { n } from "@/lib/format";
import { money } from "@/lib/money";
import {
  parseSettlementCsv,
  settlementCsvTemplate,
  type SettlementCsvRow,
} from "@/lib/settlements-csv";
import type { InProgressLine } from "@/lib/data/wallet";
import { recordSettlements, type RowResult } from "./actions";

export const TH =
  "px-[10px] pb-[8px] text-left text-th font-normal uppercase tracking-[0.4px] text-ink-2";
export const TD = "border-t border-line px-[10px] py-[9px] align-middle";

export type Preview = {
  row: SettlementCsvRow;
  line: InProgressLine | null;
  before: number;
  after: number;
  tooMuch: boolean;
};

/** Both kinds draw down the same pool, so they are previewed together. */
export function buildPreview(
  rows: SettlementCsvRow[],
  lines: InProgressLine[],
): Preview[] {
  const bySku = new Map(lines.map((line) => [line.sku, line]));
  const left = new Map(lines.map((line) => [line.sku, line.in_progress_qty]));

  return rows.map((row) => {
    const line = bySku.get(row.sku) ?? null;
    const before = left.get(row.sku) ?? 0;
    const after = before - row.qty;
    if (line) left.set(row.sku, Math.max(after, 0));
    return { row, line, before, after, tooMuch: !line || after < 0 };
  });
}

export function RecordSettlementsButton({
  lines,
  today,
  label = "Record delivered or returned",
}: {
  lines: InProgressLine[];
  today: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open ? (
        <SettleDialog
          lines={lines}
          today={today}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function SettleDialog({
  lines,
  today,
  onClose,
}: {
  lines: InProgressLine[];
  today: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const titleId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState(today);
  const [csv, setCsv] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(() => parseSettlementCsv(csv, date), [csv, date]);
  const preview = useMemo(
    () => buildPreview(parsed.rows, lines),
    [parsed.rows, lines],
  );
  const blocked = preview.filter((entry) => entry.tooMuch).length;

  function commit() {
    setError(null);
    const body = new FormData();
    body.set("rows", JSON.stringify(parsed.rows));

    startTransition(async () => {
      const result = await recordSettlements({}, body);
      if (result.error) return setError(result.error);

      const list = result.results ?? [];
      setResults(list);
      const failed = list.filter((row) => !row.ok).length;
      toast(
        failed === 0
          ? `Recorded ${n(list.length)} ${list.length === 1 ? "row" : "rows"}`
          : `${n(failed)} of ${n(list.length)} rows failed`,
      );
    });
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setResults(null);
    setCsv(await file.text());
    event.target.value = "";
  }

  return (
    <Modal open onClose={onClose} labelledBy={titleId}>
      <div id={titleId} className="mb-1 text-product font-medium">
        Record delivered and returned
      </div>
      <Muted className="mb-4">
        Columns are sku, kind, qty, occurred_on, reference. Kind is delivered or
        returned; a blank date uses the one below.
      </Muted>

      {results ? (
        <SettleResults
          results={results}
          onDone={onClose}
          onAgain={() => {
            setResults(null);
            setCsv("");
          }}
        />
      ) : (
        <>
          <Field label="Date these happened on" htmlFor="occurred_on">
            <Input
              id="occurred_on"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>

          <div className="mb-[13px] flex flex-wrap gap-[9px]">
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>
              Upload CSV
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([settlementCsvTemplate(date)], {
                    type: "text/csv;charset=utf-8",
                  }),
                );
                const link = document.createElement("a");
                link.href = url;
                link.download = "settlements-template.csv";
                document.body.append(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(url);
              }}
            >
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
            placeholder={settlementCsvTemplate(date)}
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

          {preview.length > 0 ? (
            <>
              <SettlePreview preview={preview} />
              {blocked > 0 ? (
                <Note>
                  {blocked === 1
                    ? "1 row asks for more than is in progress."
                    : `${n(blocked)} rows ask for more than is in progress.`}{" "}
                  Nothing is sent until every row fits.
                </Note>
              ) : null}
            </>
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
              onClick={commit}
              disabled={pending || parsed.rows.length === 0 || blocked > 0}
            >
              {pending
                ? "Recording…"
                : `Record ${n(parsed.rows.length)} ${parsed.rows.length === 1 ? "row" : "rows"}`}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

/** Before and after on the in-progress pool, per row. */
export function SettlePreview({ preview }: { preview: Preview[] }) {
  return (
    <div className="scroll-x mb-[13px] max-h-[240px] overflow-y-auto">
      <table className="w-full border-collapse text-body">
        <thead>
          <tr>
            <th className={TH}>SKU</th>
            <th className={TH}>Kind</th>
            <th className={TH}>Qty</th>
            <th className={TH}>In progress</th>
          </tr>
        </thead>
        <tbody>
          {preview.map((entry) => (
            <tr key={`${entry.row.sku}-${entry.row.kind}`}>
              <td className={`${TD} font-mono text-meta`}>
                {entry.row.sku}
                {!entry.line ? (
                  <span className="ml-2 font-sans text-meta text-orange-ink">
                    nothing in progress
                  </span>
                ) : null}
              </td>
              <td className={TD}>
                <span
                  className={cn(
                    "inline-block rounded-pill px-[10px] py-[4px] text-meta",
                    entry.row.kind === "delivered"
                      ? "bg-green-soft text-green"
                      : "bg-amber-soft text-amber-ink",
                  )}
                >
                  {entry.row.kind}
                </span>
              </td>
              <td className={`${TD} tabular-nums`}>{n(entry.row.qty)}</td>
              <td className={`${TD} tabular-nums`}>
                <span className="text-ink-3">{n(entry.before)}</span>
                <span className="mx-1 text-ink-3">→</span>
                <b
                  className={cn(
                    "font-medium",
                    entry.tooMuch ? "text-orange" : "",
                  )}
                >
                  {n(entry.after)}
                </b>
                {entry.line && entry.line.in_progress_qty > 0 ? (
                  <div className="text-meta text-ink-3">
                    {money(
                      (entry.line.in_progress_value /
                        entry.line.in_progress_qty) *
                        entry.row.qty,
                    )}
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SettleResults({
  results,
  onDone,
  onAgain,
}: {
  results: RowResult[];
  onDone: () => void;
  onAgain: () => void;
}) {
  const failed = results.filter((row) => !row.ok).length;

  return (
    <>
      {failed > 0 ? (
        <Note>
          {failed === 1
            ? "1 row did not go through."
            : `${n(failed)} rows did not go through.`}
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
