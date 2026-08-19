"use server";

import { revalidatePath } from "next/cache";

import { requireProfile, requireSupplier } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Every write to `reserve_requests` goes through the RPCs — they are the only
 * place that enforces who may decide what, and that a grant never exceeds the
 * stock actually on the shelf.
 *
 * The single exception is cancelling your own pending request, which the
 * schema handles with the `rr_cancel_own` RLS policy instead of an RPC.
 */

function revalidateAll() {
  revalidatePath("/dashboard");
  revalidatePath("/catalog");
  revalidatePath("/requests");
  revalidatePath("/inventory");
  revalidatePath("/approvals");
  revalidatePath("/warehouse");
}

/** Turns a Postgres exception into copy that says what to do next. */
function explain(message: string): string {
  if (message.includes("quantity must be at least 1")) {
    return "Enter a quantity of at least 1.";
  }
  if (message.includes("only Sllr users can request stock")) {
    return "Only a Sllr account can request stock.";
  }
  if (message.includes("no free stock left")) {
    return "There is no free stock left on this product. Reject it, or ask the Sllr team to reduce the quantity.";
  }
  if (message.includes("only the owning supplier")) {
    return "That product belongs to another supplier.";
  }

  const already = message.match(/request is already (\w+)/);
  if (already) {
    return `Someone already ${already[1]} this request. Refresh to see where it stands.`;
  }

  return message;
}

export type ReserveState = {
  error?: string;
  /** Bumped on success so an open dialog knows to close. */
  savedAt?: number;
  values?: { qty: string; hold_until: string; note: string };
};

export async function sendReserveRequest(
  _previous: ReserveState,
  formData: FormData,
): Promise<ReserveState> {
  const product_id = String(formData.get("product_id") ?? "");
  const rawQty = String(formData.get("qty") ?? "").trim();
  const hold_until = String(formData.get("hold_until") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  const values = { qty: rawQty, hold_until, note };
  const qty = Number(rawQty);

  if (!product_id) {
    return { error: "That product is no longer on the shelf.", values };
  }

  if (!rawQty || !Number.isInteger(qty) || qty < 1) {
    return { error: "Enter a quantity of at least 1.", values };
  }

  const profile = await requireProfile();
  if (profile.role === "supplier") {
    return { error: "Only a Sllr account can request stock.", values };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_reserve_request", {
    p_product_id: product_id,
    p_qty: qty,
    p_hold_until: hold_until || undefined,
    p_note: note || undefined,
  });

  if (error) return { error: explain(error.message), values };

  revalidateAll();
  return { savedAt: Date.now() };
}

export type DecisionState = { error?: string; savedAt?: number };

/** Cancelling is a plain update — see the `rr_cancel_own` policy. */
export async function cancelRequest(
  _previous: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "That request no longer exists." };

  await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reserve_requests")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");

  if (error) return { error: explain(error.message) };
  if (!data || data.length === 0) {
    return {
      error: "That request is no longer pending. Refresh to see where it stands.",
    };
  }

  revalidateAll();
  return { savedAt: Date.now() };
}

/**
 * Full approve leaves `p_qty` unset so the RPC grants the whole request.
 * A partial approve passes the number, which sets `qty_approved` and leaves
 * `qty_requested` untouched — the audit trail both pages render.
 */
export async function approveRequest(
  _previous: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "That request no longer exists." };

  const rawQty = String(formData.get("qty") ?? "").trim();
  const partial = rawQty !== "";
  const qty = Number(rawQty);

  if (partial && (!Number.isInteger(qty) || qty < 1)) {
    return { error: "Enter a quantity of at least 1." };
  }

  await requireSupplier();
  const supabase = await createClient();

  const { error } = await supabase.rpc("approve_reserve_request", {
    p_request_id: id,
    p_qty: partial ? qty : undefined,
  });

  if (error) return { error: explain(error.message) };

  revalidateAll();
  return { savedAt: Date.now() };
}

export async function rejectRequest(
  _previous: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "That request no longer exists." };

  const note = String(formData.get("note") ?? "").trim();

  await requireSupplier();
  const supabase = await createClient();

  const { error } = await supabase.rpc("reject_reserve_request", {
    p_request_id: id,
    p_note: note || undefined,
  });

  if (error) return { error: explain(error.message) };

  revalidateAll();
  return { savedAt: Date.now() };
}
