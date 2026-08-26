"use client";

import { useTranslations } from "next-intl";
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
import { simulateDaily, type PoQueueLine } from "@/lib/daily";
import { n } from "@/lib/format";
import { money } from "@/lib/money";
import {
  parseSettlementCsv,
  settlementCsvTemplate,
  type DailyKind,
} from "@/lib/settlements-csv";
import { recordDaily, type DailyResult } from "./actions";

const TH =
  "px-[10px] pb-[8px] text-start text-th font-normal uppercase tracking-[0.4px] text-ink-2";
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
  queue,
  defaultDate,
  supplierId,
  supplierName,
}: {
  /** The POs with something left to move, oldest first within each product. */
  queue: PoQueueLine[];
  defaultDate: string;
  supplierId: string;
  supplierName: string;
}) {
  const t = useTranslations("daily");
  const tc = useTranslations("common");
  const tcsv = useTranslations("csv");
  const terr = useTranslations("csvErrors");
  const tsim = useTranslations("sim");
  const tm = useTranslations("movements");
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState(defaultDate);
  const [csv, setCsv] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DailyResult[] | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(() => parseSettlementCsv(csv, date), [csv, date]);

  const template = settlementCsvTemplate(
    date,
    {
      sku: tcsv("sku"),
      kind: tcsv("kind"),
      qty: tcsv("qty"),
      occurred_on: tcsv("occurred_on"),
      reference: tcsv("reference"),
    },
    {
      dispatched: tcsv("kind_dispatched"),
      delivered: tcsv("kind_delivered"),
      returned: tcsv("kind_returned"),
    },
  );

  const simulation = useMemo(
    () => simulateDaily(parsed.rows, queue),
    [parsed.rows, queue],
  );

  // The two side panels are rolled up from the same queue the preview walks.
  const pools = useMemo(() => {
    const roll = (of: (line: PoQueueLine) => number) => {
      const bySku = new Map<string, { sku: string; qty: number; value: number }>();
      for (const line of queue) {
        const qty = of(line);
        if (qty <= 0) continue;
        const entry = bySku.get(line.sku) ?? { sku: line.sku, qty: 0, value: 0 };
        entry.qty += qty;
        entry.value += (line.unit_cost ?? 0) * qty;
        bySku.set(line.sku, entry);
      }
      return [...bySku.values()].sort((a, b) => a.sku.localeCompare(b.sku));
    };

    return {
      outstanding: roll((line) => line.outstanding),
      inProgress: roll((line) => line.in_progress),
    };
  }, [queue]);

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
          ? t("recordedRows", { count: list.length })
          : tm("failedToast", { failed: n(failed), total: n(list.length) }),
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
        <SectionTitle>{t("resultTitle")}</SectionTitle>
        <Muted className="mb-4">
          {supplierName} · <span className="latin">{date}</span>
        </Muted>

        {failed > 0 ? (
          <Note>{t("resultFailed", { count: failed })}</Note>
        ) : (
          <Note calm>{t("resultAllOk", { count: n(results.length) })}</Note>
        )}

        <div className="scroll-x mb-[13px]">
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

        <Button
          className="w-full"
          onClick={() => {
            setResults(null);
            if (failed === 0) setCsv("");
          }}
        >
          {failed === 0 ? t("recordAnother") : t("backToPaste")}
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid gap-[14px] xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="min-w-0">
        <SectionTitle>{t("numbers")}</SectionTitle>
        <Muted className="mb-4">{t("numbersLede")}</Muted>
        <Muted className="mb-4">{t("queueNote")}</Muted>

        <Field label={t("dateLabel")} htmlFor="occurred_on">
          <Input
            id="occurred_on"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>

        <div className="mb-[13px] flex flex-wrap gap-[9px]">
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            {tc("uploadCsv")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([template], { type: "text/csv;charset=utf-8" }),
              );
              const link = document.createElement("a");
              link.href = url;
              link.download = t("templateName", { date });
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
          placeholder={template}
          aria-label={t("pasteLabel")}
          dir="ltr"
          className="mb-[13px] font-mono text-meta"
        />

        {parsed.problems.length > 0 ? (
          <Note>
            <div className="mb-1 font-medium">
              {tc("linesSkipped", { count: parsed.problems.length })}
            </div>
            <ul className="flex flex-col gap-[2px]">
              {parsed.problems.slice(0, 6).map((problem) => (
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

        {simulation.rows.length > 0 ? (
          <>
            <div className="scroll-x mb-[13px] max-h-[300px] overflow-y-auto">
              <table className="w-full border-collapse text-body">
                <thead>
                  <tr>
                    <th className={TH}>{tc("sku")}</th>
                    <th className={TH}>{tc("kind")}</th>
                    <th className={TH}>{tc("qty")}</th>
                    <th className={TH}>{t("drawsFrom")}</th>
                    <th className={TH}>{t("poQueueCol")}</th>
                    <th className={TH}>{t("inProgressCol")}</th>
                  </tr>
                </thead>
                <tbody>
                  {simulation.rows.map((entry, index) => (
                    <tr key={`${entry.row.sku}-${entry.row.kind}-${index}`}>
                      <td className={`${TD} font-mono text-meta`}>
                        <span className="latin">{entry.row.sku}</span>
                        {entry.problem ? (
                          <div className="font-sans text-meta text-orange-ink">
                            {tsim(entry.problem.key, entry.problem.params)}
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
                          {t(`kind_${entry.row.kind}`)}
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
                        <div className="text-meta text-ink-3">
                          {t(
                            `pool${entry.pool === "outstanding" ? "Outstanding" : "InProgress"}`,
                          )}
                        </div>
                        <span className="text-ink-3">{n(entry.before)}</span>
                        <span className="mx-1 text-ink-3">{tc("arrow")}</span>
                        <b
                          className={cn(
                            "font-medium",
                            entry.problem ? "text-orange" : "",
                          )}
                        >
                          {n(entry.after)}
                        </b>
                      </td>

                      {/* Which POs the RPC will book this row against, in the
                          order it will walk them. */}
                      <td className={`${TD} text-meta`}>
                        {entry.hits.length === 0 ? (
                          <span className="text-ink-3">{t("poNone")}</span>
                        ) : (
                          <div className="flex flex-col gap-[2px]">
                            {entry.hits.map((hit, position) => (
                              <span key={hit.po_ref}>
                                <span className="text-ink-3">
                                  {position + 1}.
                                </span>{" "}
                                <span className="latin font-mono">
                                  {hit.po_ref}
                                </span>{" "}
                                <b className="font-medium tabular-nums">
                                  {n(hit.qty)}
                                </b>
                              </span>
                            ))}
                          </div>
                        )}
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
                            <span className="mx-1 text-ink-3">
                              {tc("arrow")}
                            </span>
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
              <Note>{t("doNotFit", { count: simulation.blocked })}</Note>
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
            ? tc("recording")
            : parsed.rows.length === 0
              ? t("pasteEmpty")
              : t("recordRows", { count: parsed.rows.length })}
        </Button>
      </Card>

      <div className="grid content-start gap-[14px]">
        <Card soft>
          <SectionTitle>{t("thisPaste")}</SectionTitle>
          <Muted className="mb-3">{t("beforeSent")}</Muted>
          <Line
            label={t("dispatched")}
            value={simulation.dispatchedValue}
            tone="text-orange"
          />
          <Line
            label={t("delivered")}
            value={simulation.deliveredValue}
            tone="text-green"
          />
          <Line
            label={t("returned")}
            value={simulation.returnedValue}
            tone="text-amber-ink"
          />
          <div className="flex items-center justify-between py-[9px] text-body">
            <span className="text-label text-ink-2">
              {t("rowsThatDoNotFit")}
            </span>
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
          title={t("outstandingNow")}
          empty={t("outstandingEmpty")}
          unit={t("outstandingUnit")}
          lines={pools.outstanding}
        />

        <Pool
          title={t("inProgressNow")}
          empty={t("inProgressEmpty")}
          unit={t("inProgressUnit")}
          lines={pools.inProgress}
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
  const tc = useTranslations("common");

  return (
    <Card soft>
      <SectionTitle>{title}</SectionTitle>
      <Muted className="mb-3">
        {lines.length === 0
          ? empty
          : `${tc("skusCount", { count: lines.length })} ${unit}`}
      </Muted>
      <div className="flex max-h-[220px] flex-col gap-[2px] overflow-y-auto">
        {lines.map((line) => (
          <div
            key={line.sku}
            className="flex items-center justify-between border-b border-line py-[7px] text-body last:border-b-0"
          >
            <span className="latin font-mono text-meta text-ink-3">
              {line.sku}
            </span>
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
