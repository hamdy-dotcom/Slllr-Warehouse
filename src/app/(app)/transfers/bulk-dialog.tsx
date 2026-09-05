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
import { parseArrivalCsv, arrivalCsvTemplate } from "@/lib/arrivals-csv";
import type { TransferLine } from "@/lib/transfers";
import { recordArrivals, type ArrivalResult } from "./actions";

export function BulkArrivalsButton({
  lines,
  today,
}: {
  lines: TransferLine[];
  today: string;
}) {
  const t = useTranslations("transfers");
  const [open, setOpen] = useState(false);

  if (lines.length === 0) return null;

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        {t("bulkAction")}
      </Button>
      {open ? (
        <BulkDialog
          lines={lines}
          today={today}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

const TH =
  "px-[10px] pb-[8px] text-start text-th font-normal uppercase tracking-[0.4px] text-ink-2";
const TD = "border-t border-line px-[10px] py-[9px] align-middle";

function BulkDialog({
  lines,
  today,
  onClose,
}: {
  lines: TransferLine[];
  today: string;
  onClose: () => void;
}) {
  const t = useTranslations("transfers");
  const tc = useTranslations("common");
  const tcsv = useTranslations("csv");
  const terr = useTranslations("csvErrors");
  const toast = useToast();
  const titleId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ArrivalResult[] | null>(null);
  const [pending, startTransition] = useTransition();

  // A row may name a PO by ref or by id; both resolve to the same queue line.
  const byRef = useMemo(() => {
    const map = new Map<string, TransferLine>();
    for (const line of lines) {
      map.set(line.po_ref.toLowerCase(), line);
      map.set(line.po_id.toLowerCase(), line);
    }
    return map;
  }, [lines]);

  const parsed = useMemo(() => parseArrivalCsv(text, today), [text, today]);

  const preview = useMemo(
    () =>
      parsed.rows.map((row) => {
        const line = byRef.get(row.ref.toLowerCase()) ?? null;
        return {
          row,
          line,
          tooMany: !!line && row.qty > line.qty_awaiting_transfer,
        };
      }),
    [parsed.rows, byRef],
  );

  const sendable = preview.filter((entry) => entry.line && !entry.tooMany);

  const headers = {
    po_ref: tcsv("po_ref"),
    qty: tcsv("qty"),
    arrived_on: tcsv("arrived_on"),
    reference: tcsv("reference"),
  };

  function commit() {
    setError(null);
    const body = new FormData();
    body.set(
      "rows",
      JSON.stringify(
        sendable.map((entry) => ({
          po_id: entry.line!.po_id,
          qty: entry.row.qty,
          arrived_on: entry.row.arrived_on,
          ...(entry.row.reference ? { reference: entry.row.reference } : {}),
        })),
      ),
    );

    startTransition(async () => {
      const result = await recordArrivals({}, body);
      if (result.error) return setError(result.error);

      const list = result.results ?? [];
      setResults(list);
      const failed = list.filter((row) => !row.ok).length;
      toast(
        failed === 0
          ? t("bulkAllOk", { count: n(list.length) })
          : t("bulkFailed", { count: failed }),
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
                  <th className={TH}>{tcsv("po_ref")}</th>
                  <th className={TH}>{tc("result")}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row, index) => (
                  <tr key={`${row.po_ref ?? "row"}-${index}`}>
                    <td className={`${TD} font-mono text-meta`}>
                      <span className="latin">{row.po_ref ?? tc("dash")}</span>
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
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => {
                setResults(null);
                setText("");
              }}
            >
              {t("bulkMore")}
            </Button>
            <Button className="flex-1" onClick={onClose}>
              {tc("done")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="mb-[13px] flex flex-wrap gap-[9px]">
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>
              {tc("uploadCsv")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                const csv = arrivalCsvTemplate(headers, today, lines[0].po_ref);
                const url = URL.createObjectURL(
                  new Blob([csv], { type: "text/csv;charset=utf-8" }),
                );
                const link = document.createElement("a");
                link.href = url;
                link.download = "arrivals-template.csv";
                document.body.append(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(url);
              }}
            >
              {tc("downloadTemplate")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setError(null);
                setResults(null);
                setText(await file.text());
                event.target.value = "";
              }}
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
            placeholder={t("bulkPlaceholder", {
              ref: headers.po_ref,
              qty: headers.qty,
              date: headers.arrived_on,
              reference: headers.reference,
              today,
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
            <div className="scroll-x mb-[13px] max-h-[240px] overflow-y-auto">
              <table className="w-full border-collapse text-body">
                <thead>
                  <tr>
                    <th className={TH}>{tcsv("po_ref")}</th>
                    <th className={TH}>{tc("product")}</th>
                    <th className={`${TH} text-end`}>{tc("qty")}</th>
                    <th className={`${TH} text-end`}>{t("colAwaiting")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map(({ row, line, tooMany }) => (
                    <tr key={row.ref}>
                      <td className={`${TD} font-mono text-meta`}>
                        <span className="latin">{row.ref}</span>
                        {!line ? (
                          <span className="ms-2 font-sans text-meta text-orange-ink">
                            {t("unknownRef")}
                          </span>
                        ) : null}
                      </td>
                      <td className={TD}>{line?.product_name ?? tc("dash")}</td>
                      <td
                        className={cn(
                          `${TD} text-end tabular-nums`,
                          tooMany && "text-orange",
                        )}
                      >
                        {n(row.qty)}
                      </td>
                      <td className={`${TD} text-end tabular-nums text-ink-3`}>
                        {line ? n(line.qty_awaiting_transfer) : tc("dash")}
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
              onClick={commit}
              disabled={pending || sendable.length === 0}
            >
              {pending
                ? t("recording")
                : t("bulkRows", { count: sendable.length })}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
