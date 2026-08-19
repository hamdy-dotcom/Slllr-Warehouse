"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Muted } from "@/components/ui/card";
import { FieldError, Note, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { parseStockCsv, toStockCsv, type CsvRow } from "@/lib/csv";
import { n } from "@/lib/format";
import type { ProductStock } from "@/lib/types";
import { bulkUpdateStock, type BulkResult } from "./actions";

type Diff = {
  row: CsvRow;
  current: ProductStock | null;
  qtyChanged: boolean;
  codeChanged: boolean;
};

export function BulkUpdateButton({ shelf }: { shelf: ProductStock[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Bulk update
      </Button>
      {open ? (
        <BulkDialog shelf={shelf} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

const TH =
  "px-[10px] pb-[8px] text-left text-th font-normal uppercase tracking-[0.4px] text-ink-2";
const TD = "border-t border-line px-[10px] py-[9px] align-middle";

function BulkDialog({
  shelf,
  onClose,
}: {
  shelf: ProductStock[];
  onClose: () => void;
}) {
  const toast = useToast();
  const titleId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [pending, startTransition] = useTransition();

  const bySku = useMemo(
    () => new Map(shelf.map((product) => [product.sku, product])),
    [shelf],
  );

  const parsed = useMemo(() => parseStockCsv(text), [text]);

  const diffs: Diff[] = useMemo(
    () =>
      parsed.rows.map((row) => {
        const current = bySku.get(row.sku) ?? null;
        return {
          row,
          current,
          qtyChanged: !!current && current.total_qty !== row.total_qty,
          codeChanged:
            !!current &&
            !!row.warehouse_code &&
            current.warehouse_code !== row.warehouse_code,
        };
      }),
    [parsed.rows, bySku],
  );

  const unknown = diffs.filter((diff) => !diff.current).length;
  const changing = diffs.filter(
    (diff) => diff.qtyChanged || diff.codeChanged,
  ).length;

  function downloadTemplate() {
    const csv = toStockCsv(
      [...shelf]
        .sort((a, b) => a.sku.localeCompare(b.sku))
        .map((product) => ({
          sku: product.sku,
          total_qty: product.total_qty,
          warehouse_code: product.warehouse_code,
        })),
    );

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "stock-template.csv";
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
    setText(await file.text());
    event.target.value = "";
  }

  function commit() {
    setError(null);

    const body = new FormData();
    body.set("rows", JSON.stringify(parsed.rows));

    startTransition(async () => {
      const result = await bulkUpdateStock({}, body);

      if (result.error) {
        setError(result.error);
        return;
      }

      setResults(result.results ?? []);
      const failed = (result.results ?? []).filter((row) => !row.ok).length;
      toast(
        failed === 0
          ? `Updated ${n(result.results?.length ?? 0)} rows`
          : `${n(failed)} of ${n(result.results?.length ?? 0)} rows failed`,
      );
    });
  }

  const failedCount = results?.filter((row) => !row.ok).length ?? 0;

  return (
    <Modal open onClose={onClose} labelledBy={titleId}>
      <div id={titleId} className="mb-1 text-product font-medium">
        Bulk update stock
      </div>
      <Muted className="mb-4">
        Columns are sku, total_qty, and warehouse_code. The last one is
        optional.
      </Muted>

      {results ? (
        <Results
          results={results}
          failedCount={failedCount}
          onDone={onClose}
          onAgain={() => {
            setResults(null);
            setText("");
          }}
        />
      ) : (
        <>
          <div className="mb-[13px] flex flex-wrap gap-[9px]">
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>
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
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setError(null);
            }}
            placeholder={"sku,total_qty,warehouse_code\nSKU-1001,320,L01-R01-B01"}
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

          {diffs.length > 0 ? (
            <>
              <Muted className="mb-2">
                {n(changing)} of {n(diffs.length)} rows change something
                {unknown > 0 ? ` · ${n(unknown)} SKU not on your shelf` : ""}
              </Muted>

              <div className="scroll-x mb-[13px] max-h-[240px] overflow-y-auto">
                <table className="w-full border-collapse text-body">
                  <thead>
                    <tr>
                      <th className={TH}>SKU</th>
                      <th className={TH}>Total</th>
                      <th className={TH}>Warehouse code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffs.map((diff) => (
                      <tr key={diff.row.sku}>
                        <td className={`${TD} font-mono text-meta`}>
                          {diff.row.sku}
                          {!diff.current ? (
                            <span className="ml-2 font-sans text-meta text-orange-ink">
                              not found
                            </span>
                          ) : null}
                        </td>
                        <td className={`${TD} tabular-nums`}>
                          {diff.current ? (
                            <>
                              <span className="text-ink-3">
                                {n(diff.current.total_qty)}
                              </span>
                              <span className="mx-1 text-ink-3">→</span>
                              <b
                                className={cn(
                                  "font-medium",
                                  diff.qtyChanged && "text-orange",
                                )}
                              >
                                {n(diff.row.total_qty)}
                              </b>
                            </>
                          ) : (
                            <b className="font-medium">{n(diff.row.total_qty)}</b>
                          )}
                        </td>
                        <td className={`${TD} font-mono text-meta`}>
                          {diff.row.warehouse_code ? (
                            diff.codeChanged && diff.current ? (
                              <>
                                <span className="text-ink-3">
                                  {diff.current.warehouse_code}
                                </span>
                                <span className="mx-1 text-ink-3">→</span>
                                <b className="font-medium text-orange">
                                  {diff.row.warehouse_code}
                                </b>
                              </>
                            ) : (
                              diff.row.warehouse_code
                            )
                          ) : (
                            <span className="text-ink-3">unchanged</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
              disabled={pending || parsed.rows.length === 0}
            >
              {pending
                ? "Updating…"
                : `Update ${n(parsed.rows.length)} ${
                    parsed.rows.length === 1 ? "row" : "rows"
                  }`}
            </Button>
          </div>
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
  results: BulkResult[];
  failedCount: number;
  onDone: () => void;
  onAgain: () => void;
}) {
  return (
    <>
      {failedCount > 0 ? (
        <Note>
          {failedCount === 1
            ? "1 row failed and was left as it was."
            : `${n(failedCount)} rows failed and were left as they were.`}{" "}
          The rest went through.
        </Note>
      ) : (
        <Note calm>
          All {n(results.length)} rows went through.
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
            {results.map((row) => (
              <tr key={row.sku}>
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

      <div className="flex gap-[9px]">
        <Button variant="ghost" className="flex-1" onClick={onAgain}>
          Update more
        </Button>
        <Button className="flex-1" onClick={onDone}>
          Done
        </Button>
      </div>
    </>
  );
}
