"use client";

import { useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, Muted, SectionTitle } from "@/components/ui/card";
import {
  Field,
  FieldError,
  Input,
  Note,
  Textarea,
} from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { simulateDaily } from "@/lib/daily";
import { n } from "@/lib/format";
import { money } from "@/lib/money";
import {
  DAILY_KIND_LABELS,
  parseSettlementCsv,
  settlementCsvTemplate,
  type DailyKind,
} from "@/lib/settlements-csv";
import type { InProgressLine, OutstandingLine } from "@/lib/data/wallet";
import { recordDaily, type DailyResult } from "./actions";

const TH =
  "px-[10px] pb-[8px] text-left text-th font-normal uppercase tracking-[0.4px] text-ink-2";
const TD = "border-t border-line px-[10px] py-[9px] align-middle";

const KIND_STYLE: Record<DailyKind, string> = {
  dispatched: "bg-orange-soft text-orange-ink",
  delivered: "bg-green-soft text-green",
  returned: "bg-amber-soft text-amber-ink",
};

/**
 * A day's stock movement in one paste.
 *
 * The preview is the point: every row shows the pool it draws from before and
 * after, walked in paste order, so a SKU dispatched on one line and delivered
 * on the next shows the delivery working against the dispatch.
 */
export function DailyForm({
  outstanding,
  inProgress,
  defaultDate,
  supplierId,
  supplierName,
}: {
  outstanding: OutstandingLine[];
  inProgress: InProgressLine[];
  defaultDate: string;
  supplierId: string;
  supplierName: string;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState(defaultDate);
  const [csv, setCsv] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DailyResult[] | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(() => parseSettlementCsv(csv, date), [csv, date]);

  const simulation = useMemo(
    () =>
      simulateDaily(
        parsed.rows,
        outstanding.map((line) => ({
          sku: line.sku,
          qty: line.outstanding_qty,
          value: line.outstanding_value,
        })),
        inProgress.map((line) => ({
          sku: line.sku,
          qty: line.in_progress_qty,
          value: line.in_progress_value,
        })),
      ),
    [parsed.rows, outstanding, inProgress],
  );

  function commit() {
    setError(null);
    const body = new FormData();
    body.set("supplier_id", supplierId);
    body.set("rows", JSON.stringify(parsed.rows));

    startTransition(async () => {
      const result = await recordDaily({}, body);
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

  if (results) {
    const failed = results.filter((row) => !row.ok).length;

    return (
      <Card>
        <SectionTitle>Result</SectionTitle>
        <Muted className="mb-4">
          {supplierName} · {date}
        </Muted>

        {failed > 0 ? (
          <Note>
            {failed === 1
              ? "1 row did not go through."
              : `${n(failed)} rows did not go through.`}{" "}
            Nothing is written unless the whole paste fits, so the rest were
            left alone too.
          </Note>
        ) : (
          <Note calm>
            All {n(results.length)} {results.length === 1 ? "row" : "rows"} went
            through.
          </Note>
        )}

        <div className="scroll-x mb-[13px]">
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
                  <td className={`${TD} font-mono text-meta`}>{row.sku}</td>
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

        <Button
          className="w-full"
          onClick={() => {
            setResults(null);
            if (failed === 0) setCsv("");
          }}
        >
          {failed === 0 ? "Record another day" : "Back to the paste"}
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid gap-[14px] xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="min-w-0">
        <SectionTitle>The day&rsquo;s numbers</SectionTitle>
        <Muted className="mb-4">
          One line per SKU and kind: sku, kind, qty, occurred_on, reference.
          Kind is dispatched, delivered, or returned. A blank date uses the one
          below.
        </Muted>

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
              link.download = `daily-${date}.csv`;
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
          rows={10}
          value={csv}
          onChange={(event) => {
            setCsv(event.target.value);
            setError(null);
          }}
          placeholder={settlementCsvTemplate(date)}
          aria-label="Paste the day's numbers"
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
              {parsed.problems.slice(0, 6).map((problem) => (
                <li key={problem.line}>
                  Line {problem.line}: {problem.message}
                </li>
              ))}
            </ul>
          </Note>
        ) : null}

        {simulation.rows.length > 0 ? (
          <>
            <div className="scroll-x mb-[13px] max-h-[300px] overflow-y-auto">
              <table className="w-full border-collapse text-body">
                <thead>
                  <tr>
                    <th className={TH}>SKU</th>
                    <th className={TH}>Kind</th>
                    <th className={TH}>Qty</th>
                    <th className={TH}>Draws from</th>
                    <th className={TH}>In progress</th>
                  </tr>
                </thead>
                <tbody>
                  {simulation.rows.map((entry, index) => (
                    <tr key={`${entry.row.sku}-${entry.row.kind}-${index}`}>
                      <td className={`${TD} font-mono text-meta`}>
                        {entry.row.sku}
                        {entry.problem ? (
                          <div className="font-sans text-meta text-orange-ink">
                            {entry.problem}
                          </div>
                        ) : null}
                      </td>

                      <td className={TD}>
                        <span
                          className={cn(
                            "inline-block rounded-pill px-[10px] py-[4px] text-meta",
                            KIND_STYLE[entry.row.kind],
                          )}
                        >
                          {DAILY_KIND_LABELS[entry.row.kind]}
                        </span>
                      </td>

                      <td className={`${TD} tabular-nums`}>
                        {n(entry.row.qty)}
                        {entry.value !== null ? (
                          <div className="text-meta text-ink-3">
                            {money(entry.value)}
                          </div>
                        ) : null}
                      </td>

                      <td className={`${TD} tabular-nums`}>
                        <div className="text-meta text-ink-3">{entry.pool}</div>
                        <span className="text-ink-3">{n(entry.before)}</span>
                        <span className="mx-1 text-ink-3">→</span>
                        <b
                          className={cn(
                            "font-medium",
                            entry.problem ? "text-orange" : "",
                          )}
                        >
                          {n(entry.after)}
                        </b>
                      </td>

                      <td className={`${TD} tabular-nums`}>
                        {entry.progressBefore === entry.progressAfter ? (
                          <span className="text-ink-3">
                            {n(entry.progressBefore)}
                          </span>
                        ) : (
                          <>
                            <span className="text-ink-3">
                              {n(entry.progressBefore)}
                            </span>
                            <span className="mx-1 text-ink-3">→</span>
                            <b className="font-medium">
                              {n(entry.progressAfter)}
                            </b>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {simulation.blocked > 0 ? (
              <Note>
                {simulation.blocked === 1
                  ? "1 row does not fit."
                  : `${n(simulation.blocked)} rows do not fit.`}{" "}
                Nothing is sent until the whole paste fits.
              </Note>
            ) : null}
          </>
        ) : null}

        <FieldError>{error}</FieldError>

        <Button
          className="w-full"
          onClick={commit}
          disabled={
            pending || parsed.rows.length === 0 || simulation.blocked > 0
          }
        >
          {pending
            ? "Recording…"
            : parsed.rows.length === 0
              ? "Paste the day's numbers"
              : `Record ${n(parsed.rows.length)} ${parsed.rows.length === 1 ? "row" : "rows"}`}
        </Button>
      </Card>

      <div className="grid content-start gap-[14px]">
        <Card soft>
          <SectionTitle>This paste</SectionTitle>
          <Muted className="mb-3">Before anything is sent</Muted>
          <Line
            label="Dispatched"
            value={simulation.dispatchedValue}
            tone="text-orange"
          />
          <Line
            label="Delivered"
            value={simulation.deliveredValue}
            tone="text-green"
          />
          <Line
            label="Returned"
            value={simulation.returnedValue}
            tone="text-amber-ink"
          />
          <div className="flex items-center justify-between py-[9px] text-body">
            <span className="text-label text-ink-2">Rows that do not fit</span>
            <b
              className={
                simulation.blocked > 0
                  ? "font-medium text-orange"
                  : "font-medium"
              }
            >
              {n(simulation.blocked)}
            </b>
          </div>
        </Card>

        <Pool
          title="Outstanding now"
          empty="Nothing approved is waiting to be dispatched."
          unit="approved, not yet dispatched"
          lines={outstanding.map((line) => ({
            sku: line.sku,
            qty: line.outstanding_qty,
            value: line.outstanding_value,
          }))}
        />

        <Pool
          title="In progress now"
          empty="Nothing is dispatched and waiting to be settled."
          unit="dispatched, not yet settled"
          lines={inProgress.map((line) => ({
            sku: line.sku,
            qty: line.in_progress_qty,
            value: line.in_progress_value,
          }))}
        />
      </div>
    </div>
  );
}

function Line({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-line py-[9px] text-body">
      <span className="text-label text-ink-2">{label}</span>
      <b className={cn("font-medium", value > 0 ? tone : "text-ink-3")}>
        {money(value)}
      </b>
    </div>
  );
}

function Pool({
  title,
  empty,
  unit,
  lines,
}: {
  title: string;
  empty: string;
  unit: string;
  lines: { sku: string; qty: number; value: number }[];
}) {
  return (
    <Card soft>
      <SectionTitle>{title}</SectionTitle>
      <Muted className="mb-3">
        {lines.length === 0
          ? empty
          : `${n(lines.length)} ${lines.length === 1 ? "SKU" : "SKUs"} ${unit}`}
      </Muted>
      <div className="flex max-h-[220px] flex-col gap-[2px] overflow-y-auto">
        {lines.map((line) => (
          <div
            key={line.sku}
            className="flex items-center justify-between border-b border-line py-[7px] text-body last:border-b-0"
          >
            <span className="font-mono text-meta text-ink-3">{line.sku}</span>
            <span className="tabular-nums">
              {n(line.qty)}{" "}
              <span className="text-ink-3">· {money(line.value)}</span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
