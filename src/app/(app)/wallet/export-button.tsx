"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { buttonClass } from "@/components/ui/button";

/**
 * Downloads the PO table as a workbook.
 *
 * A plain link rather than a fetch: the browser handles the download and the
 * filename off Content-Disposition, and it carries the session cookie without
 * any of it passing through JavaScript. It hands the route the same query the
 * page is already reading, so the export is whatever is on screen.
 */
export function ExportButton() {
  const t = useTranslations("po");
  const searchParams = useSearchParams();

  const query = new URLSearchParams();
  for (const key of ["po_status", "po_supplier", "po_q", "po_sort", "po_dir"]) {
    const value = searchParams.get(key);
    if (value) query.set(key, value);
  }

  const href = query.toString()
    ? `/wallet/export?${query.toString()}`
    : "/wallet/export";

  return (
    <a href={href} download className={buttonClass("ghost")}>
      {t("export.button")}
    </a>
  );
}
