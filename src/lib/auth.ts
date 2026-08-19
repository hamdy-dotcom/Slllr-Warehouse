import { redirect } from "next/navigation";

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
 * For pages that act on a supplier's own shelf. The RPCs check ownership
 * against `supplier_id`, so a profile without one has nothing to act on —
 * whatever its role.
 */
export async function requireSupplier(): Promise<
  SessionProfile & { supplier_id: string }
> {
  const profile = await requireProfile();

  if (!profile.supplier_id) redirect("/dashboard");

  return profile as SessionProfile & { supplier_id: string };
}
