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
    <div role="status" aria-label="Carregando Alpha CRM" className="mx-auto max-w-[1600px] space-y-7 px-5 py-7 sm:px-7 sm:py-9 lg:px-10">
      <div className="space-y-3"><Skeleton className="h-9 w-48" /><Skeleton className="h-4 w-full max-w-md" /></div>
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${admin ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
        {Array.from({ length: admin ? 4 : 3 }, (_, index) => <div key={index} className="min-h-[166px] rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 sm:p-6"><div className="flex justify-between"><div className="space-y-4"><Skeleton className="h-4 w-28" /><Skeleton className="h-9 w-20" /></div><Skeleton className="h-10 w-10 rounded-xl" /></div><Skeleton className="mt-4 h-3 w-36" /></div>)}
      </div>
      <div className="space-y-3"><div className="space-y-2"><Skeleton className="h-5 w-24" /><Skeleton className="h-4 w-64" /></div><div className="rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 sm:p-6"><div className="flex flex-wrap justify-between gap-4"><div className="space-y-3"><Skeleton className="h-6 w-44" /><Skeleton className="h-4 w-40" /></div><Skeleton className="h-10 w-36 rounded-lg" /></div><div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-4"><Skeleton className="h-3 w-16" /><Skeleton className="mt-2 h-4 w-28" /><Skeleton className="mt-5 h-1.5 w-full" /></div>)}</div></div></div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.9fr)]">{Array.from({ length: 2 }, (_, index) => <div key={index} className="min-h-72 space-y-4 rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5"><div className="flex justify-between"><div className="space-y-2"><Skeleton className="h-5 w-36" /><Skeleton className="h-3 w-24" /></div><Skeleton className="h-4 w-16" /></div><Skeleton className="h-8 w-64 max-w-full" />{Array.from({ length: 3 }, (_, row) => <div key={row} className="flex items-center gap-3 border-t border-slate-700/50 pt-4"><Skeleton className="h-8 w-8" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></div>)}</div>)}</div>
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
