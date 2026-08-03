import { getTema } from "@/lib/temas";
import { auth } from "../../../../auth";
import { ObterDashboardBpm } from "@/actions/bpm/Dashboard";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function AlphaCRMPage() {
  const session = await auth();
  const temaNome = (session?.user as { tema_interface?: string })?.tema_interface || "blue";
  const visual = getTema(temaNome);

  const dashboardResult = await ObterDashboardBpm();

  return (
    <DashboardClient
      dashboard={dashboardResult.data ?? null}
      erro={dashboardResult.success ? null : dashboardResult.error ?? "Erro ao carregar dashboard"}
      visual={visual}
      currentUserId={session?.user?.id ? Number(session.user.id) : null}
      currentUserRole={session?.user?.role ?? null}
    />
  );
}
