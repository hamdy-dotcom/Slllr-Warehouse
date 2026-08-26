import { getLocale, getTranslations } from "next-intl/server";

import { ProductMini } from "@/components/product-thumb";
import { Card, Empty, Muted, SectionTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { money } from "@/lib/money";
import { listPoQueues, poSettlementHistory } from "@/lib/data/po";
import { poSuppliers, poTotals, type PoFilter } from "@/lib/po";
import type { SessionProfile } from "@/lib/auth";
import { PoCard } from "./po-card";
import { PoFilters } from "./po-filters";

/**
 * Purchase orders, grouped into one queue per product.
 *
 * The grouping carries meaning rather than tidiness: allocation is per
 * product, so the oldest PO for one SKU settles before its siblings and has
 * nothing to do with an older PO on a different SKU. A flat list sorted by
 * date would imply a single queue that does not exist.
 *
 * Filtering runs after grouping so a queue keeps its shape — hiding settled
 * POs must not promote the second PO in a queue to look like the first.
 */
export async function PoSection({
  profile,
  filter,
}: {
  profile: SessionProfile;
  filter: PoFilter;
}) {
  const [t, locale, queues, history] = await Promise.all([
    getTranslations("po"),
    getLocale(),
    listPoQueues(profile, filter),
    poSettlementHistory(profile),
  ]);

  // The supplier list comes from every PO the caller may see, not from the
  // filtered set, or picking one supplier would empty its own picker.
  const all = await listPoQueues(profile);
  const suppliers = poSuppliers(all);
  const totals = poTotals(queues);

  return (
    <Card id="po-settlements" className="scroll-mt-[18px] mt-[14px]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-[14px]">
        <div className="max-w-[560px]">
          <SectionTitle>{t("title")}</SectionTitle>
          <Muted className="mt-[2px]">{t("lede")}</Muted>
          <Muted className="mt-[6px]">{t("queueNote")}</Muted>
        </div>

        <div className="flex flex-wrap gap-x-[28px] gap-y-[8px]">
          <Total label={t("openValue")} value={money(totals.open)} />
          <Total
            label={t("inProgressValue")}
            value={money(totals.inProgress)}
            tone="text-orange"
          />
          <Total
            label={t("settledValue")}
            value={money(totals.settled)}
            tone="text-green"
          />
        </div>
      </div>

      <PoFilters
        status={filter.status}
        supplierId={filter.supplierId}
        suppliers={suppliers}
      />

      {queues.length === 0 ? (
        <Empty>{all.length === 0 ? t("empty") : t("noMatch")}</Empty>
      ) : (
        <>
          <Muted className="mb-[10px]">
            {t("countLabel", { count: totals.count })}
          </Muted>

          <div className="flex flex-col gap-[18px]">
            {queues.map((queue) => (
              <div key={queue.product_id}>
                <div className="mb-[10px] flex items-center gap-[11px]">
                  <ProductMini src={queue.image_url} alt={queue.product_name} />
                  <div className="min-w-0">
                    <div className="font-medium">{queue.product_name}</div>
                    <div className="latin font-mono text-meta text-ink-3">
                      {queue.sku}
                    </div>
                  </div>
                  <div className="ms-auto text-end text-label text-ink-2">
                    <div>
                      {/* Says the real size of the queue, and how much of it
                          a filter is hiding, so a position always reads
                          against the whole thing. */}
                      {queue.items.length === queue.size
                        ? t("posInQueue", { count: queue.size })
                        : t("posInQueueFiltered", {
                            shown: queue.items.length,
                            count: queue.size,
                          })}
                    </div>
                    <div className="text-meta text-ink-3">
                      {queue.supplier_name}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-[9px]">
                  {queue.items.map((item) => (
                    <PoCard
                      key={item.po.po_id}
                      po={item.po}
                      position={item.position}
                      head={{
                        dispatch: item.nextToDispatch,
                        settle: item.nextToSettle,
                      }}
                      formattedDate={formatDate(
                        item.po.po_date.slice(0, 10),
                        locale,
                      )}
                      history={(history.get(item.po.po_id) ?? []).map(
                        (entry) => ({
                          ...entry,
                          formatted_on: formatDate(entry.occurred_on, locale),
                        }),
                      )}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function Total({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <div className="text-label text-ink-2">{label}</div>
      <div className={`mt-[2px] text-kpi font-medium tabular-nums ${tone ?? ""}`}>
        {value}
      </div>
    </div>
  );
}
