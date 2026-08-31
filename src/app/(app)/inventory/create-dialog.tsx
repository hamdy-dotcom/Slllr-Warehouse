"use client";

import { useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Muted } from "@/components/ui/card";
import { FieldError, Note, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { n } from "@/lib/format";
import { unitCost } from "@/lib/money";
import {
  parseProductCsv,
  productCsvTemplate,
  type ProductCsvRow,
} from "@/lib/products-csv";
import type { ProductStock } from "@/lib/types";
import { bulkCreateProducts, type CreateResult } from "./actions";

export function AddProductsButton({ shelf }: { shelf: ProductStock[] }) {
  const t = useTranslations("inventory");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        {t("createAction")}
      </Button>
      {open ? (
        <CreateDialog shelf={shelf} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

const TH =
  "px-[10px] pb-[8px] text-start text-th font-normal uppercase tracking-[0.4px] text-ink-2";
const TD = "border-t border-line px-[10px] py-[9px] align-middle";

type Preview = { row: ProductCsvRow; duplicate: boolean };

function CreateDialog({
  shelf,
  onClose,
}: {
  shelf: ProductStock[];
  onClose: () => void;
}) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const tcsv = useTranslations("csv");
  const terr = useTranslations("csvErrors");
  const toast = useToast();
  const titleId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CreateResult[] | null>(null);
  const [pending, startTransition] = useTransition();

  const existing = useMemo(
    () => new Set(shelf.map((product) => product.sku)),
    [shelf],
  );

  const parsed = useMemo(() => parseProductCsv(text), [text]);

  // A SKU already on the shelf is shown as blocked here rather than left to
  // come back as a failure: the RPC refuses it either way, and finding out
  // before sending is the point of a preview.
  const preview: Preview[] = useMemo(
    () =>
      parsed.rows.map((row) => ({ row, duplicate: existing.has(row.sku) })),
    [parsed.rows, existing],
  );

  const creatable = preview.filter((entry) => !entry.duplicate);
  const blocked = preview.length - creatable.length;

  const headers = {
    sku: tcsv("sku"),
    name: tcsv("name"),
    warehouse_code: tcsv("warehouse_code"),
    total_qty: tcsv("total_qty"),
    unit_cost: tcsv("unit_cost"),
    image_url: tcsv("image_url"),
  };

  function downloadTemplate() {
    const url = URL.createObjectURL(
      new Blob([productCsvTemplate(headers)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "products-template.csv";
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
    // Only the rows the button promises, so the result table says exactly
    // what was attempted.
    body.set("rows", JSON.stringify(creatable.map((entry) => entry.row)));

    startTransition(async () => {
      const result = await bulkCreateProducts({}, body);
      if (result.error) return setError(result.error);

      const list = result.results ?? [];
      setResults(list);
      const failed = list.filter((row) => !row.ok).length;
      toast(
        failed === 0
          ? t("createdRows", { count: list.length })
          : t("createFailed", { count: failed }),
      );
    });
  }

  const failedCount = results?.filter((row) => !row.ok).length ?? 0;

  return (
    <Modal open onClose={onClose} labelledBy={titleId}>
      <div id={titleId} className="mb-1 text-product font-medium">
        {t("createTitle")}
      </div>
      <Muted className="mb-4">{t("createLede")}</Muted>

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
            placeholder={t("createPlaceholder", {
              sku: headers.sku,
              name: headers.name,
              code: headers.warehouse_code,
              total: headers.total_qty,
              cost: headers.unit_cost,
              image: headers.image_url,
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

          {preview.length > 0 ? (
            <>
              <Muted className="mb-2">
                {t("createReady", { count: creatable.length })}
                {blocked > 0 ? t("createBlocked", { count: blocked }) : ""}
              </Muted>

              <div className="scroll-x mb-[13px] max-h-[240px] overflow-y-auto">
                <table className="w-full border-collapse text-body">
                  <thead>
                    <tr>
                      <th className={TH}>{tc("sku")}</th>
                      <th className={TH}>{t("productName")}</th>
                      <th className={TH}>{tc("warehouseCode")}</th>
                      <th className={`${TH} text-end`}>{tc("total")}</th>
                      <th className={`${TH} text-end`}>{tc("unitCost")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map(({ row, duplicate }) => (
                      <tr key={row.sku}>
                        <td className={`${TD} font-mono text-meta`}>
                          <span className="latin">{row.sku}</span>
                          {duplicate ? (
                            <span className="ms-2 font-sans text-meta text-orange-ink">
                              {t("createDuplicate")}
                            </span>
                          ) : null}
                        </td>
                        <td
                          className={cn(TD, duplicate && "text-ink-3")}
                        >
                          {row.name}
                        </td>
                        <td className={`${TD} font-mono text-meta`}>
                          <span className="latin">{row.warehouse_code}</span>
                        </td>
                        <td className={`${TD} text-end tabular-nums`}>
                          {n(row.total_qty)}
                        </td>
                        <td className={`${TD} text-end tabular-nums`}>
                          {row.unit_cost === undefined ||
                          row.unit_cost === null ? (
                            <span className="text-ink-3">{tc("dash")}</span>
                          ) : (
                            unitCost(row.unit_cost)
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
              disabled={pending || creatable.length === 0}
            >
              {pending
                ? t("creating")
                : t("createRows", { count: creatable.length })}
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
  results: CreateResult[];
  failedCount: number;
  onDone: () => void;
  onAgain: () => void;
}) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");

  return (
    <>
      {failedCount > 0 ? (
        <Note>{t("createFailed", { count: failedCount })}</Note>
      ) : (
        <Note calm>{t("createAllOk", { count: n(results.length) })}</Note>
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
              <tr key={`${row.sku ?? "row"}-${index}`}>
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
          {t("createMore")}
        </Button>
        <Button className="flex-1" onClick={onDone}>
          {tc("done")}
        </Button>
      </div>
    </>
  );
}
