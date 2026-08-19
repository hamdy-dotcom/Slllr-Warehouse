import { ReserveRequestsLive } from "@/components/reserve-requests-live";
import { Topbar } from "@/components/topbar";
import { Shell } from "@/components/ui/shell";
import { ToastProvider } from "@/components/ui/toast";
import { requireProfile } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  return (
    <ToastProvider>
      <ReserveRequestsLive />
      <Shell>
        <Topbar profile={profile} />
        {children}
      </Shell>
    </ToastProvider>
  );
}
