import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SessionProfile } from "@/lib/auth";

export type Wallet = {
  supplier_id: string;
  supplier_name: string;
  delivered_qty: number;
  delivered_value: number;
  returned_qty: number;
  returned_value: number;
  paid_total: number;
  /** `delivered_value - paid_total`. Returns are not billed, so not subtracted. */
  balance: number;
  /** Dispatched to Sllr, not yet settled. Not owed yet. */
  in_progress_qty: number;
  in_progress_value: number;
};

export type SupplierOption = { id: string; name: string };

/**
 * Every wallet the caller may look at.
 *
 * `supplier_wallet` now carries its own WHERE clause, so a supplier querying
 * it straight at the API gets only its own row. The filter here is kept as a
 * second lock rather than the only one — and it is what makes a Sllr user's
 * supplier picker work, since they can see them all.
 */
export async function listWallets(profile: SessionProfile): Promise<Wallet[]> {
  const supabase = await createClient();

  let query = supabase
    .from("supplier_wallet")
    .select("*")
    .order("supplier_name");
  if (profile.role === "supplier") {
    if (!profile.supplier_id) return [];
    query = query.eq("supplier_id", profile.supplier_id);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not load the wallet: ${error.message}`);

  return (data ?? []).flatMap((row) =>
    row.supplier_id
      ? [
          {
            supplier_id: row.supplier_id,
            supplier_name: row.supplier_name ?? "Unnamed supplier",
            delivered_qty: row.delivered_qty ?? 0,
            delivered_value: row.delivered_value ?? 0,
            returned_qty: row.returned_qty ?? 0,
            returned_value: row.returned_value ?? 0,
            paid_total: row.paid_total ?? 0,
            balance: row.balance ?? 0,
            in_progress_qty: row.in_progress_qty ?? 0,
            in_progress_value: row.in_progress_value ?? 0,
          },
        ]
      : [],
  );
}

export type LedgerEntry = {
  id: string;
  /** `YYYY-MM-DD`, the day the thing happened rather than when it was typed. */
  on: string;
  kind: "delivered" | "returned" | "payment";
  qty: number | null;
  /** Positive adds to what is owed, negative reduces it. */
  amount: number;
  sku: string | null;
  productName: string | null;
  reference: string | null;
  note: string | null;
  method: string | null;
};

export type LedgerRow = LedgerEntry & { runningBalance: number };

/**
 * Deliveries, returns, and payments on one timeline with a running balance.
 *
 * Only deliveries and payments move the balance. A return sends units back to
 * the supplier rather than reversing a bill — those units were never
 * delivered, so they were never owed for.
 */
export async function walletLedger(supplierId: string): Promise<LedgerRow[]> {
  const supabase = await createClient();

  const [settlements, payments] = await Promise.all([
    supabase
      .from("settlements")
      .select(
        "id, kind, qty, value, occurred_on, reference, note, products(sku, name)",
      )
      .eq("supplier_id", supplierId)
      .overrideTypes<
        {
          id: string;
          kind: "delivered" | "returned";
          qty: number;
          value: number | null;
          occurred_on: string;
          reference: string | null;
          note: string | null;
          products: { sku: string; name: string } | null;
        }[]
      >(),
    supabase
      .from("supplier_payments")
      .select("id, amount, paid_on, method, reference, note")
      .eq("supplier_id", supplierId),
  ]);

  if (settlements.error) {
    throw new Error(`Could not load settlements: ${settlements.error.message}`);
  }
  if (payments.error) {
    throw new Error(`Could not load payments: ${payments.error.message}`);
  }

  const entries: LedgerEntry[] = [
    ...(settlements.data ?? []).map((row) => ({
      id: row.id,
      on: row.occurred_on,
      kind: row.kind,
      qty: row.qty,
      amount: row.kind === "delivered" ? (row.value ?? 0) : 0,
      sku: row.products?.sku ?? null,
      productName: row.products?.name ?? null,
      reference: row.reference,
      note: row.note,
      method: null,
    })),
    ...(payments.data ?? []).map((row) => ({
      id: row.id,
      on: row.paid_on,
      kind: "payment" as const,
      qty: null,
      amount: -row.amount,
      sku: null,
      productName: null,
      reference: row.reference,
      note: row.note,
      method: row.method,
    })),
  ];

  // Oldest first to accumulate, then newest first for reading.
  entries.sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : 0));

  let running = 0;
  const withBalance = entries.map((entry) => {
    running += entry.amount;
    return { ...entry, runningBalance: running };
  });

  return withBalance.reverse();
}

/** Suppliers the caller may pick between. */
export async function listSuppliers(
  profile: SessionProfile,
): Promise<SupplierOption[]> {
  const supabase = await createClient();

  let query = supabase.from("suppliers").select("id, name").order("name");
  if (profile.role === "supplier") {
    if (!profile.supplier_id) return [];
    query = query.eq("id", profile.supplier_id);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not load suppliers: ${error.message}`);

  return data ?? [];
}

export type InProgressLine = {
  sku: string;
  name: string;
  in_progress_qty: number;
  in_progress_value: number;
};

/** What is dispatched but unsettled, per SKU — the pool a delivery draws from. */
export async function inProgressBySupplier(
  supplierId: string,
): Promise<InProgressLine[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("product_stock")
    .select("sku, name, in_progress_qty, in_progress_value")
    .eq("supplier_id", supplierId)
    .gt("in_progress_qty", 0)
    .order("sku");

  if (error) throw new Error(`Could not load in progress: ${error.message}`);

  return (data ?? []).map((row) => ({
    sku: row.sku ?? "",
    name: row.name ?? "",
    in_progress_qty: row.in_progress_qty ?? 0,
    in_progress_value: row.in_progress_value ?? 0,
  }));
}

export type OutstandingLine = {
  sku: string;
  name: string;
  /** `qty_outstanding` summed over that product's approved requests. */
  outstanding_qty: number;
  outstanding_value: number;
  /** Oldest approved request first — the order a dispatch allocates in. */
  requests: { id: string; outstanding: number; unit_cost: number | null }[];
};

/**
 * What is approved and still waiting to leave the shelf, per SKU.
 *
 * A dispatch draws against this. The per-request breakdown comes with it
 * because `record_stock_movements` books a dispatch against one request at a
 * time, so a row larger than the oldest request has to be split across
 * several.
 */
export async function outstandingBySupplier(
  supplierId: string,
): Promise<OutstandingLine[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reserve_request_dispatch")
    .select(
      "id, qty_outstanding, outstanding_value, unit_cost, created_at, products!inner(sku, name, supplier_id)",
    )
    .eq("status", "approved")
    .eq("products.supplier_id", supplierId)
    .order("created_at", { ascending: true })
    .overrideTypes<
      {
        id: string;
        qty_outstanding: number | null;
        outstanding_value: number | null;
        unit_cost: number | null;
        created_at: string;
        products: { sku: string; name: string; supplier_id: string };
      }[]
    >();

  if (error) throw new Error(`Could not load outstanding: ${error.message}`);

  const bySku = new Map<string, OutstandingLine>();

  for (const row of data ?? []) {
    const outstanding = row.qty_outstanding ?? 0;
    if (outstanding <= 0) continue;

    const line = bySku.get(row.products.sku) ?? {
      sku: row.products.sku,
      name: row.products.name,
      outstanding_qty: 0,
      outstanding_value: 0,
      requests: [],
    };

    line.outstanding_qty += outstanding;
    line.outstanding_value += row.outstanding_value ?? 0;
    line.requests.push({
      id: row.id,
      outstanding,
      unit_cost: row.unit_cost,
    });

    bySku.set(row.products.sku, line);
  }

  return [...bySku.values()].sort((a, b) => a.sku.localeCompare(b.sku));
}
