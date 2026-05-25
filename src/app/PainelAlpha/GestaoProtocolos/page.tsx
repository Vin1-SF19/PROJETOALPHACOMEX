import { redirect } from "next/navigation";
import { auth } from "../../../../auth";
import { BookOpen, FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { listarTodosTemplates } from "@/actions/protocolos";
import GestaoProtocolosClient from "@/components/GestaoProtocolos/GestaoProtocolosClient";
import db from "@/lib/prisma";

export default async function GestaoProtocolosPage() {
  const session = await auth();
  if (!session) redirect("/");

  const role = session.user.role;
  const temPermissao =
    role === "Admin" ||
    role === "CEO" ||
    role === "SUPORTE" ||
    (session.user as { permissoes?: string[] }).permissoes?.includes("gestaoProtocolos");

  if (!temPermissao) redirect("/PainelAlpha");

  type CountResult = { total: bigint }[];
  const [templates, totalChamados, protocolosResult] = await Promise.all([
    listarTodosTemplates(),
    db.chamados.count(),
    db.$queryRawUnsafe<CountResult>(`SELECT COUNT(*) as total FROM chamados WHERE mensagemFinal IS NOT NULL`),
  ]);
  const totalProtocolos = Number(protocolosResult[0]?.total ?? 0);

  return (
    <div className="min-h-screen bg-[#020617] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black px-4 py-10 sm:px-8">

      <div className="mx-auto max-w-4xl">

        {/* Voltar */}
        <Link
          href="/PainelAlpha/Chamados"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-violet-400 mb-8 group transition-colors"
        >
          <div className="p-2 rounded-lg bg-white/5 border border-white/5 group-hover:border-violet-500/50 transition-all">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest">Voltar para Chamados</span>
        </Link>

        {/* Header */}
        <div className="mb-10 rounded-[2.5rem] border border-white/5 bg-slate-900/20 backdrop-blur-3xl shadow-2xl p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600/5 to-transparent pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-violet-600/20 rounded-2xl border border-violet-500/20">
                <BookOpen className="text-violet-400 w-7 h-7" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tighter uppercase italic">
                  Gestão de <span className="text-violet-500">Protocolos</span>
                </h1>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-1">
                  Biblioteca de templates de resposta
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-4">
              <div className="text-center p-4 rounded-2xl bg-white/3 border border-white/5 min-w-[80px]">
                <p className="text-2xl font-black text-violet-400">{templates.length}</p>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Templates</p>
              </div>
              <div className="text-center p-4 rounded-2xl bg-white/3 border border-white/5 min-w-[80px]">
                <p className="text-2xl font-black text-emerald-400">{totalProtocolos}</p>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Com protocolo</p>
              </div>
              <div className="text-center p-4 rounded-2xl bg-white/3 border border-white/5 min-w-[80px]">
                <p className="text-2xl font-black text-blue-400">{totalChamados}</p>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Total chamados</p>
              </div>
            </div>
          </div>
        </div>

        {/* Conteúdo principal */}
        <div className="rounded-[2.5rem] border border-white/5 bg-slate-900/10 backdrop-blur-xl overflow-hidden shadow-2xl p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-2.5 bg-violet-500/10 rounded-2xl border border-violet-500/20">
              <FileText className="text-violet-400 w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-tighter">
                Templates de Protocolo
              </h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                Gerencie modelos de resposta para cada categoria de chamado
              </p>
            </div>
          </div>

          <GestaoProtocolosClient templates={templates} />
        </div>

        <p className="mt-8 text-center text-[9px] font-bold text-slate-700 uppercase tracking-widest">
          Alpha Systems • Gestão de Protocolos • {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
