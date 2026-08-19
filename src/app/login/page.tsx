import type { Metadata } from "next";

import { Card, Muted } from "@/components/ui/card";
import { Note } from "@/components/ui/field";
import { Logo } from "@/components/ui/shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Sllr warehouse" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="grid min-h-dvh place-items-center p-[18px]">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        <Card className="p-6">
          <h1 className="text-section font-medium">Sign in</h1>
          <Muted className="mb-[18px]">
            One shelf, shared between Sllr and the supplier.
          </Muted>

          {error === "no-profile" ? (
            <Note>
              That account has no profile yet. Ask an admin to set it up, then
              sign in again.
            </Note>
          ) : null}

          <LoginForm next={next ?? ""} />
        </Card>

        <p className="mt-4 text-center text-meta text-ink-3">
          Accounts are created in Supabase, not here.
        </p>
      </div>
    </main>
  );
}
