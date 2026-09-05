import { redirect } from "next/navigation";

import { canWriteShelf } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types";

export type SessionProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  supplier_id: string | null;
  supplier_name: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: AppRole;
  supplier_id: string | null;
  suppliers: { name: string } | null;
};

/** The signed-in profile, or null. Middleware already turned most nulls away. */
export async function getProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, supplier_id, suppliers(name)")
    .eq("id", user.id)
    .single<ProfileRow>();

  if (!data) return null;

  return {
    id: data.id,
    email: user.email ?? "",
    full_name: data.full_name,
    role: data.role,
    supplier_id: data.supplier_id,
    supplier_name: data.suppliers?.name ?? null,
  };
}

/** Same, but bounces to login instead of returning null. */
export async function requireProfile(): Promise<SessionProfile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

/**
 * For writes against a supplier's own shelf. The RPCs check ownership against
 * `supplier_id`, and rows are inserted carrying it, so a profile without one
 * has nothing to act on — admin included. An operator belongs to no supplier
 * by design, which is exactly why they cannot write on one's behalf.
 */
export async function requireSupplier(): Promise<
  SessionProfile & { supplier_id: string }
> {
  const profile = await requireProfile();

  // The same predicate the pages use to decide whether to draw the control,
  // so the two can never disagree about who may write.
  if (!canWriteShelf(profile.role)) redirect("/dashboard");
  if (!profile.supplier_id) redirect("/dashboard");

  return profile as SessionProfile & { supplier_id: string };
}

/**
 * For reading a supplier's screens: the shelf, its ledger, its approvals.
 *
 * Admin is admitted by role rather than by carrying a `supplier_id`. Giving
 * an operator one would make them look like they belong to a single supplier
 * and would quietly scope their reads to it; the RLS policies already assume
 * admin sees everything and belongs to nobody. `supplier_id` is therefore
 * still nullable here — use `requireSupplier` where a concrete owner matters.
 */
export async function requireSupplierView(): Promise<SessionProfile> {
  const profile = await requireProfile();

  if (profile.role === "admin") return profile;
  if (!profile.supplier_id) redirect("/dashboard");

  return profile;
}
