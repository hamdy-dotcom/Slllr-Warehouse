import { Card, Muted, SectionTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";

export default async function DashboardPage() {
  const profile = await requireProfile();

  return (
    <Card>
      <SectionTitle>Signed in as {profile.role}</SectionTitle>
      <Muted>
        The dashboard fills in once the stock data layer lands in step 3.
      </Muted>
    </Card>
  );
}
