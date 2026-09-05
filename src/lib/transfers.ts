/**
 * Transfer vocabulary. Pure, so the client rows and the server reads share it.
 *
 * A transfer is the leg between the supplier's shelf and the Riyadh
 * warehouse. Units are approved on the shelf and sit there until the
 * warehouse records them as arrived; that is the moment the supplier's
 * `total_qty` drops, and nothing on the Sllr side can dispatch a unit that
 * has not made this trip.
 */

export const TRANSFER_STATUSES = [
  "not started",
  "part arrived",
  "complete",
] as const;

export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

export function isTransferStatus(
  value: string | undefined,
): value is TransferStatus {
  return TRANSFER_STATUSES.includes(value as TransferStatus);
}

const STATUS_KEYS: Record<TransferStatus, string> = {
  "not started": "statusNotStarted",
  "part arrived": "statusPartArrived",
  complete: "statusComplete",
};

/** Null for a literal the view has started emitting that we do not know. */
export function transferStatusKey(status: string): string | null {
  return STATUS_KEYS[status as TransferStatus] ?? null;
}

export type TransferLine = {
  po_id: string;
  po_ref: string;
  po_date: string;
  /** The queue is ordered by this: oldest approval moves first. */
  approved_at: string;
  product_id: string;
  sku: string;
  product_name: string;
  image_url: string | null;
  warehouse_code: string;
  supplier_id: string;
  supplier_name: string;
  unit_cost: number | null;
  qty_approved: number;
  qty_arrived: number;
  qty_cancelled: number;
  qty_awaiting_transfer: number;
  awaiting_transfer_value: number;
  transfer_status: TransferStatus;
};

export type TransferFilter = { status?: TransferStatus; q?: string };

export function matchesTransferFilter(
  line: TransferLine,
  filter: TransferFilter,
): boolean {
  if (filter.status && line.transfer_status !== filter.status) return false;

  if (filter.q) {
    const needle = filter.q.trim().toLowerCase();
    if (needle) {
      const hay =
        `${line.product_name} ${line.sku} ${line.po_ref} ${line.supplier_name}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
  }

  return true;
}

export type TransferTotals = { awaiting: number; value: number; pos: number };

export function transferTotals(lines: TransferLine[]): TransferTotals {
  return lines.reduce<TransferTotals>(
    (acc, line) => ({
      awaiting: acc.awaiting + line.qty_awaiting_transfer,
      value: acc.value + line.awaiting_transfer_value,
      pos: acc.pos + 1,
    }),
    { awaiting: 0, value: 0, pos: 0 },
  );
}
