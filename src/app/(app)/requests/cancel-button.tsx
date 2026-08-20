"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cancelRequest, type DecisionState } from "@/lib/actions/reserve";

export function CancelButton({ id }: { id: string }) {
  const t = useTranslations("requests");
  const toast = useToast();
  const [state, formAction] = useActionState<DecisionState, FormData>(
    cancelRequest,
    {},
  );

  useEffect(() => {
    if (state.savedAt) toast(t("cancelled"));
    else if (state.error) toast(state.error);
  }, [state, toast, t]);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <Submit />
    </form>
  );
}

function Submit() {
  const t = useTranslations("requests");
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="ghost" disabled={pending}>
      {pending ? t("cancelling") : t("cancel")}
    </Button>
  );
}
