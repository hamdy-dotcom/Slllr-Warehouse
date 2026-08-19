import { AppNav } from "@/components/app-nav";
import { Logo } from "@/components/ui/shell";
import { signOut } from "@/app/login/actions";
import { NAV } from "@/lib/routes";
import type { SessionProfile } from "@/lib/auth";

const roleLabel = {
  sllr: "Sllr",
  supplier: "Supplier",
  admin: "Admin",
} as const;

export function Topbar({ profile }: { profile: SessionProfile }) {
  return (
    <div className="mb-[22px] flex flex-wrap items-center gap-[14px]">
      <Logo />

      <AppNav items={NAV[profile.role]} />

      <div className="flex items-center gap-2 rounded-[16px] bg-card py-[5px] pr-[6px] pl-[14px]">
        <span className="text-label text-ink-2">
          {profile.full_name ?? profile.email}
        </span>
        <span className="rounded-[11px] bg-tint px-[10px] py-[7px] text-label font-medium">
          {profile.supplier_name ?? roleLabel[profile.role]}
        </span>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-[11px] px-[10px] py-[7px] text-label text-ink-2 transition-colors hover:text-ink"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
