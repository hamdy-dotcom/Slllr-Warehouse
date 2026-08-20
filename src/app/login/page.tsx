import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Card, Muted } from "@/components/ui/card";
import { Note } from "@/components/ui/field";
import { Logo } from "@/components/ui/shell";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("login.title")} · ${t("app.titleSuffix")}` };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const t = await getTranslations("login");

  return (
    <main className="grid min-h-dvh place-items-center p-[18px]">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        <Card className="p-6">
          <h1 className="text-section font-medium">{t("title")}</h1>
          <Muted className="mb-[18px]">{t("lede")}</Muted>

          {error === "no-profile" ? <Note>{t("noProfile")}</Note> : null}

          <LoginForm next={next ?? ""} />
        </Card>

        <p className="mt-4 text-center text-meta text-ink-3">{t("footnote")}</p>
      </div>
    </main>
  );
}
