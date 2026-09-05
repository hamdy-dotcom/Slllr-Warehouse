import { useTranslations } from "next-intl";

import { AppNav } from "@/components/app-nav";
import { LanguageToggle } from "@/components/language-toggle";
import { Logo } from "@/components/ui/shell";
import { signOut } from "@/app/login/actions";
import { NAV } from "@/lib/routes";
import type { SessionProfile } from "@/lib/auth";

const roleKey = {
  sllr: "roleSllr",
  supplier: "roleSupplier",
  admin: "roleAdmin",
  warehouse: "roleWarehouse",
} as const;

export function Topbar({ profile }: { profile: SessionProfile }) {
  const t = useTranslations("nav");

  return (
    <div className="mb-[22px] flex flex-wrap items-center gap-[14px]">
      <Logo />

      <AppNav items={NAV[profile.role]} />

      <div className="flex items-center gap-2 rounded-[16px] bg-card py-[5px] pe-[6px] ps-[14px]">
        <span className="text-label text-ink-2">
          {profile.full_name ?? profile.email}
        </span>
        <span className="rounded-[11px] bg-tint px-[10px] py-[7px] text-label font-medium">
          {profile.supplier_name ?? t(roleKey[profile.role])}
        </span>
        <LanguageToggle label={t("language")} />
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-[11px] px-[10px] py-[7px] text-label text-ink-2 transition-colors hover:text-ink"
          >
            {t("signOut")}
          </button>
        </form>
      </div>
    </div>
  );
}
