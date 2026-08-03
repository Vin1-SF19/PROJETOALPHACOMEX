import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { BookOpen, Users, MessageCircle } from "lucide-react";
import { listarTodosTemplatesOnboarding } from "@/actions/onboarding";
import GestaoOnboardingClient from "@/components/GestaoOnboarding/GestaoOnboardingClient";
import db from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

export default async function GestaoOnboardingPage() {
  const session = await auth();
  if (!session) redirect("/");

  const role = session.user.role;
  const isAdmin = isAdminRole(role);
  if (!isAdmin) redirect("/PainelAlpha");

  const [templates, totalUsuarios, totalOnboardings] = await Promise.all([
    listarTodosTemplatesOnboarding(),
    db.usuarios.count(),
    db.$queryRawUnsafe<{ total: number }[]>(
      "SELECT COUNT(*) as total FROM onboarding_log"
    ).then((r) => r[0]?.total ?? 0).catch(() => 0),
  ]);

  const totalAtivos = templates.filter((t) => t.ativo).length;

  return (
    <main className="min-h-screen bg-[#020617] text-slate-200 font-sans p-6 lg:p-10">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-white">
            Gestão de <span className="text-indigo-400">Onboarding</span>
          </h1>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">
            Templates de boas-vindas para novos colaboradores
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-5 rounded-2xl bg-white/3 border border-white/5">
            <div className="p-2 rounded-xl bg-indigo-600/15 border border-indigo-500/20 w-fit mb-3">
              <BookOpen className="text-indigo-400 w-4 h-4" />
            </div>
            <p className="text-2xl font-black text-white">{totalAtivos}</p>
            <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mt-0.5">Templates Ativos</p>
          </div>
          <div className="p-5 rounded-2xl bg-white/3 border border-white/5">
            <div className="p-2 rounded-xl bg-blue-600/15 border border-blue-500/20 w-fit mb-3">
              <Users className="text-blue-400 w-4 h-4" />
            </div>
            <p className="text-2xl font-black text-white">{totalUsuarios}</p>
            <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mt-0.5">Colaboradores</p>
          </div>
          <div className="p-5 rounded-2xl bg-white/3 border border-white/5">
            <div className="p-2 rounded-xl bg-emerald-600/15 border border-emerald-500/20 w-fit mb-3">
              <MessageCircle className="text-emerald-400 w-4 h-4" />
            </div>
            <p className="text-2xl font-black text-white">{totalOnboardings}</p>
            <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mt-0.5">Envios Realizados</p>
          </div>
        </div>

        {/* Client */}
        <GestaoOnboardingClient templates={templates} />
      </div>
    </main>
  );
}
