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
import { n } from "@/lib/format";
import { money } from "@/lib/money";
import {
  parseSettlementCsv,
  settlementCsvTemplate,
} from "@/lib/settlements-csv";
import type { InProgressLine } from "@/lib/data/wallet";
import { recordSettlements, type RowResult } from "@/app/(app)/wallet/actions";
import {
  SettlePreview,
  SettleResults,
  buildPreview,
} from "@/app/(app)/wallet/settle-dialog";

/**
 * Yesterday's numbers in one paste.
 *
 * The preview is the point: every row shows what the SKU had in progress
 * before and what it would have after, so a day's figures can be checked
 * against the shelf before any of it is committed.
 */
export function DailyForm({
  lines,
  defaultDate,
  supplierName,
}: {
  lines: InProgressLine[];
  defaultDate: string;
  supplierName: string;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState(defaultDate);
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
  const delivered = preview.filter((e) => e.row.kind === "delivered");
  const returned = preview.filter((e) => e.row.kind === "returned");

  const valueOf = (entries: typeof preview) =>
    entries.reduce((sum, entry) => {
      if (!entry.line || entry.line.in_progress_qty === 0) return sum;
      const each = entry.line.in_progress_value / entry.line.in_progress_qty;
      return sum + each * entry.row.qty;
    }, 0);

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

  if (results) {
    return (
      <Card>
        <SectionTitle>Result</SectionTitle>
        <Muted className="mb-4">
          {supplierName} · {date}
        </Muted>
        <SettleResults
          results={results}
          onDone={() => {
            setResults(null);
            setCsv("");
          }}
          onAgain={() => {
            setResults(null);
            setCsv("");
          }}
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-[14px] xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="min-w-0">
        <SectionTitle>Yesterday&rsquo;s numbers</SectionTitle>
        <Muted className="mb-4">
          One line per SKU and kind: sku, kind, qty, occurred_on, reference. A
          blank date uses the one below.
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

        {preview.length > 0 ? (
          <>
            <Muted className="mb-2">
              {n(delivered.length)} delivered · {n(returned.length)} returned
            </Muted>
            <SettlePreview preview={preview} />
            {blocked > 0 ? (
              <Note>
                {blocked === 1
                  ? "1 row asks for more than that SKU has in progress."
                  : `${n(blocked)} rows ask for more than those SKUs have in progress.`}{" "}
                Nothing is sent until every row fits.
              </Note>
            ) : null}
          </>
        ) : null}

        <FieldError>{error}</FieldError>

        <Button
          className="w-full"
          onClick={commit}
          disabled={pending || parsed.rows.length === 0 || blocked > 0}
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
          <div className="flex items-center justify-between border-b border-line py-[9px] text-body">
            <span className="text-label text-ink-2">Delivered</span>
            <b className="font-medium text-green">
              {money(valueOf(delivered))}
            </b>
          </div>
          <div className="flex items-center justify-between border-b border-line py-[9px] text-body">
            <span className="text-label text-ink-2">Returned</span>
            <b className="font-medium text-amber-ink">
              {money(valueOf(returned))}
            </b>
          </div>
          <div className="flex items-center justify-between py-[9px] text-body">
            <span className="text-label text-ink-2">
              Rows that will not fit
            </span>
            <b
              className={
                blocked > 0 ? "font-medium text-orange" : "font-medium"
              }
            >
              {n(blocked)}
            </b>
          </div>
        </Card>

        <Card soft>
          <SectionTitle>In progress now</SectionTitle>
          <Muted className="mb-3">
            {lines.length === 0
              ? "Nothing is released and waiting to be settled."
              : `${n(lines.length)} ${lines.length === 1 ? "SKU" : "SKUs"} released, not yet settled`}
          </Muted>
          <div className="flex max-h-[280px] flex-col gap-[2px] overflow-y-auto">
            {lines.map((line) => (
              <div
                key={line.sku}
                className="flex items-center justify-between border-b border-line py-[7px] text-body last:border-b-0"
              >
                <span className="font-mono text-meta text-ink-3">
                  {line.sku}
                </span>
                <span className="tabular-nums">
                  {n(line.in_progress_qty)}{" "}
                  <span className="text-ink-3">
                    · {money(line.in_progress_value)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
