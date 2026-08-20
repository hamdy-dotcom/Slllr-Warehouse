"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Field, FieldError, Input } from "@/components/ui/field";
import { signIn, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("login");
  const [state, formAction] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <form action={formAction}>
      <input type="hidden" name="next" value={next} />

      <Field label={t("email")} htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
          dir="ltr"
        />
      </Field>

      <Field label={t("password")} htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          dir="ltr"
        />
      </Field>

      <FieldError>{state.error}</FieldError>

      <Submit />
    </form>
  );
}

function Submit() {
  const t = useTranslations("login");
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? t("submitting") : t("submit")}
    </Button>
  );
}
