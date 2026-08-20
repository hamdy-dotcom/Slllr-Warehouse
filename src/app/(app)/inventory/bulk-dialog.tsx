"use client";

import { useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Muted } from "@/components/ui/card";
import { FieldError, Note, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { parseStockCsv, toStockCsv, type CsvRow } from "@/lib/csv";
import { n } from "@/lib/format";
import { unitCost } from "@/lib/money";
import type { ProductStock } from "@/lib/types";
import { bulkUpdateStock, type BulkResult } from "./actions";

type Diff = {
  row: CsvRow;
  current: ProductStock | null;
  qtyChanged: boolean;
  codeChanged: boolean;
  costChanged: boolean;
};

export function BulkUpdateButton({ shelf }: { shelf: ProductStock[] }) {
  const t = useTranslations("inventory");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        {t("bulkUpdate")}
      </Button>
      {open ? (
        <BulkDialog shelf={shelf} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

const TH =
  "px-[10px] pb-[8px] text-start text-th font-normal uppercase tracking-[0.4px] text-ink-2";
const TD = "border-t border-line px-[10px] py-[9px] align-middle";

function BulkDialog({
  shelf,
  onClose,
}: {
  shelf: ProductStock[];
  onClose: () => void;
}) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const tcsv = useTranslations("csv");
  const tm = useTranslations("movements");
  const terr = useTranslations("csvErrors");
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
          costChanged:
            !!current &&
            row.unit_cost !== undefined &&
            current.unit_cost !== row.unit_cost,
        };
      }),
    [parsed.rows, bySku],
  );

  const unknown = diffs.filter((diff) => !diff.current).length;
  const changing = diffs.filter(
    (diff) => diff.qtyChanged || diff.codeChanged || diff.costChanged,
  ).length;

  function downloadTemplate() {
    const csv = toStockCsv(
      {
        sku: tcsv("sku"),
        total_qty: tcsv("total_qty"),
        warehouse_code: tcsv("warehouse_code"),
        unit_cost: tcsv("unit_cost"),
      },
      [...shelf]
        .sort((a, b) => a.sku.localeCompare(b.sku))
        .map((product) => ({
          sku: product.sku,
          total_qty: product.total_qty,
          warehouse_code: product.warehouse_code,
          unit_cost: product.unit_cost,
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
          ? t("updatedRows", { count: n(result.results?.length ?? 0) })
          : tm("failedToast", {
              failed: n(failed),
              total: n(result.results?.length ?? 0),
            }),
      );
    });
  }

  const failedCount = results?.filter((row) => !row.ok).length ?? 0;

  return (
    <Modal open onClose={onClose} labelledBy={titleId}>
      <div id={titleId} className="mb-1 text-product font-medium">
        {t("bulkTitle")}
      </div>
      <Muted className="mb-4">{t("bulkLede")}</Muted>

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
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setError(null);
            }}
            placeholder={t("csvPlaceholder", {
              sku: tcsv("sku"),
              total: tcsv("total_qty"),
              code: tcsv("warehouse_code"),
              cost: tcsv("unit_cost"),
            })}
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

          {diffs.length > 0 ? (
            <>
              <Muted className="mb-2">
                {t("bulkChanging", {
                  changing: n(changing),
                  total: n(diffs.length),
                })}
                {unknown > 0 ? t("bulkUnknown", { count: n(unknown) }) : ""}
              </Muted>

              <div className="scroll-x mb-[13px] max-h-[240px] overflow-y-auto">
                <table className="w-full border-collapse text-body">
                  <thead>
                    <tr>
                      <th className={TH}>{tc("sku")}</th>
                      <th className={TH}>{tc("total")}</th>
                      <th className={TH}>{tc("warehouseCode")}</th>
                      <th className={TH}>{tc("unitCost")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffs.map((diff) => (
                      <tr key={diff.row.sku}>
                        <td className={`${TD} font-mono text-meta`}>
                          <span className="latin">{diff.row.sku}</span>
                          {!diff.current ? (
                            <span className="ms-2 font-sans text-meta text-orange-ink">
                              {t("notFound")}
                            </span>
                          ) : null}
                        </td>
                        <td className={`${TD} tabular-nums`}>
                          {diff.current ? (
                            <>
                              <span className="text-ink-3">
                                {n(diff.current.total_qty)}
                              </span>
                              <span className="mx-1 text-ink-3">
                                {tc("arrow")}
                              </span>
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
                            <b className="font-medium">
                              {n(diff.row.total_qty)}
                            </b>
                          )}
                        </td>
                        <td className={`${TD} font-mono text-meta`}>
                          {diff.row.warehouse_code ? (
                            diff.codeChanged && diff.current ? (
                              <>
                                <span className="latin text-ink-3">
                                  {diff.current.warehouse_code}
                                </span>
                                <span className="mx-1 text-ink-3">
                                  {tc("arrow")}
                                </span>
                                <b className="latin font-medium text-orange">
                                  {diff.row.warehouse_code}
                                </b>
                              </>
                            ) : (
                              <span className="latin">
                                {diff.row.warehouse_code}
                              </span>
                            )
                          ) : (
                            <span className="text-ink-3">{t("unchanged")}</span>
                          )}
                        </td>
                        <td className={`${TD} tabular-nums`}>
                          {diff.row.unit_cost === undefined ? (
                            <span className="text-ink-3">{t("unchanged")}</span>
                          ) : diff.costChanged && diff.current ? (
                            <>
                              <span className="text-ink-3">
                                {unitCost(diff.current.unit_cost)}
                              </span>
                              <span className="mx-1 text-ink-3">
                                {tc("arrow")}
                              </span>
                              <b className="font-medium text-orange">
                                {unitCost(diff.row.unit_cost)}
                              </b>
                            </>
                          ) : (
                            unitCost(diff.row.unit_cost)
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
              {tc("cancel")}
            </Button>
            <Button
              className="flex-1"
              onClick={commit}
              disabled={pending || parsed.rows.length === 0}
            >
              {pending
                ? t("updating")
                : t("updateRows", { count: parsed.rows.length })}
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
  const t = useTranslations("inventory");
  const tc = useTranslations("common");

  return (
    <>
      {failedCount > 0 ? (
        <Note>{t("bulkFailed", { count: failedCount })}</Note>
      ) : (
        <Note calm>{t("bulkAllOk", { count: n(results.length) })}</Note>
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
            {results.map((row) => (
              <tr key={row.sku}>
                <td className={`${TD} font-mono text-meta`}>
                  <span className="latin">{row.sku}</span>
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
          {t("updateMore")}
        </Button>
        <Button className="flex-1" onClick={onDone}>
          {tc("done")}
        </Button>
      </div>
    </>
  );
}
