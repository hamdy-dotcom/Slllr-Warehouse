"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { HOME } from "@/lib/routes";

export type LoginState = { error?: string };

/** Only signs people in. Accounts are provisioned in Supabase, not here. */
export async function signIn(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  const t = await getTranslations("login");

  if (!email || !password) {
    return { error: t("bothFields") };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: t("wrong") };
  }

  revalidatePath("/", "layout");
  // Only same-origin paths — never bounce to a URL supplied in the query.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : HOME);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
