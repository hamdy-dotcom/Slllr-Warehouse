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
 *
 * That clause admits `auth.uid() is null`, which is true for the service role
 * and equally true for an unauthenticated caller. Anonymous reads come back
 * empty only because the tables underneath refuse them and the view runs
 * security_invoker. Turning security_invoker off would hand every wallet to
 * anyone holding the public anon key.
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

/**
 * What is dispatched but unsettled, per SKU — the pool a delivery draws from.
 *
 * The count comes from `product_stock`, because that is what
 * `recordSettlements` caps a row against and the preview must not disagree
 * with it. The value comes from `po_settlement`, so the pool is worth what
 * was agreed when its POs were approved rather than what the product is
 * priced at today.
 */
export async function inProgressBySupplier(
  supplierId: string,
): Promise<InProgressLine[]> {
  const supabase = await createClient();

  const [{ data, error }, held] = await Promise.all([
    supabase
      .from("product_stock")
      .select("sku, name, in_progress_qty")
      .eq("supplier_id", supplierId)
      .gt("in_progress_qty", 0)
      .order("sku"),
    supabase
      .from("po_settlement")
      .select("sku, out_for_delivery_value")
      .eq("supplier_id", supplierId)
      .eq("request_status", "approved"),
  ]);

  if (error) throw new Error(`Could not load in progress: ${error.message}`);
  if (held.error) {
    throw new Error(`Could not value in progress: ${held.error.message}`);
  }

  const value = new Map<string, number>();
  for (const po of held.data ?? []) {
    const sku = po.sku;
    if (!sku) continue;
    value.set(sku, (value.get(sku) ?? 0) + (po.out_for_delivery_value ?? 0));
  }

  return (data ?? []).map((row) => ({
    sku: row.sku ?? "",
    name: row.name ?? "",
    in_progress_qty: row.in_progress_qty ?? 0,
    in_progress_value: value.get(row.sku ?? "") ?? 0,
  }));
}
