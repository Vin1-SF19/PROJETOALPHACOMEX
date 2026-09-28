import { getTema } from "@/lib/temas";
import { auth } from "../../../../auth";
import { Suspense } from "react";
import { ObterDashboardBpm } from "@/actions/bpm/Dashboard";
import { isAdminRole } from "@/lib/roles";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

async function DashboardContent({
  temaNome,
  currentUserId,
  currentUserRole,
}: {
  temaNome: string;
  currentUserId: number | null;
  currentUserRole: string | null;
}) {
  const dashboardResult = await ObterDashboardBpm();
  return (
    <DashboardClient
      dashboard={dashboardResult.data ?? null}
      erro={dashboardResult.success ? null : dashboardResult.error ?? "Erro ao carregar dashboard"}
      visual={getTema(temaNome)}
      currentUserId={currentUserId}
      currentUserRole={currentUserRole}
    />
  );
}

function DashboardSkeleton({ admin }: { admin: boolean }) {
  return (
    <div role="status" aria-label="Carregando Alpha CRM" className="mx-auto max-w-[1600px] space-y-8 px-5 py-7 sm:px-7 sm:py-10 lg:px-10">
      <div className="space-y-3"><Skeleton className="h-9 w-48" /><Skeleton className="h-4 w-full max-w-md" /></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: admin ? 4 : 3 }, (_, index) => <div key={index} className="min-h-52 space-y-6 rounded-2xl border border-white/10 bg-slate-900/60 p-6"><Skeleton className="h-12 w-12" /><Skeleton className="h-6 w-28" /><Skeleton className="h-4 w-48" /></div>)}
      </div>
      <div className="space-y-3"><Skeleton className="h-4 w-28" /><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-52 space-y-5 rounded-2xl border border-white/10 bg-slate-900/60 p-5"><Skeleton className="h-12 w-12" /><Skeleton className="h-5 w-36" /><Skeleton className="h-4 w-24" /></div>)}</div></div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">{Array.from({ length: 2 }, (_, index) => <div key={index} className="space-y-3"><Skeleton className="h-4 w-36" /><div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4">{Array.from({ length: 3 }, (_, row) => <div key={row} className="flex items-center gap-3"><Skeleton className="h-8 w-8" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></div>)}</div></div>)}</div>
      <span className="sr-only">Carregando informações do CRM</span>
    </div>
  );
}

export default async function AlphaCRMPage() {
  const session = await auth();
  const currentUserRole = session?.user?.role ?? null;
  const temaNome = (session?.user as { tema_interface?: string })?.tema_interface || "blue";

  return (
    <Suspense fallback={<DashboardSkeleton admin={isAdminRole(currentUserRole)} />}>
      <DashboardContent
        temaNome={temaNome}
        currentUserId={session?.user?.id ? Number(session.user.id) : null}
        currentUserRole={currentUserRole}
      />
    </Suspense>
  );
}
