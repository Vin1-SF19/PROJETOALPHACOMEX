import { PlusCircle, Headphones, BookOpen } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "../../../../auth";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import db from "@/lib/prisma";
import DetalhesChamado from "@/components/DetalhesChamado";

import ChatChamado from "@/components/ChatChamado";
import { FiltroChamadosCards } from "@/components/FiltroChamado";
import { listarTemplates } from "@/actions/protocolos";
import { isAdminRole } from "@/lib/roles";

const STATUS_STYLES: Record<string, string> = {
  ABERTO: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  EM_ATENDIMENTO: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  CONCLUIDO: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
};

const STATUS_LABEL: Record<string, string> = {
  ABERTO: "Aberto",
  EM_ATENDIMENTO: "Em Atendimento",
  CONCLUIDO: "Concluído",
};

const PRIORIDADE_STYLES: Record<string, string> = {
  URGENTE: "bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse",
  ALTA: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  MEDIA: "bg-slate-800 text-slate-400 border-white/5",
  BAIXA: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const PRIORIDADE_LABEL: Record<string, string> = {
  URGENTE: "Urgente",
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
};

function tempoRelativo(data: Date | string): string {
  const diff = Date.now() - new Date(data).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

export default async function Chamados({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/");

  const { status } = await searchParams;
  const isAdmin = isAdminRole(session.user.role);
  const isCeo = session.user.role === "CEO";
  const userId = Number(session.user.id);
  const podeVerTodos = isAdmin || isCeo;
  const podeAbrirChamado = !isAdmin || isCeo;

  const [todosChamados, templates] = await Promise.all([
    db.chamados.findMany({
      where: podeVerTodos ? {} : { usuarioId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        solicitante: {
          select: { nome: true, usuario: true, telefone: true, telefone_corporativo: true },
        },
        mensagens: {
          include: {
            autor: { select: { id: true, nome: true, usuario: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: {
            mensagens: {
              where: {
                AND: [
                  { autorId: { not: userId } },
                  isAdmin ? { lida_admin: false } : { lida_usuario: false },
                ],
              },
            },
          },
        },
      },
    }),
    podeVerTodos ? listarTemplates().catch(() => []) : Promise.resolve([]),
  ]);

  const total = todosChamados.length;
  const abertos = todosChamados.filter((c) => c.status === "ABERTO").length;
  const emCurso = todosChamados.filter((c) => c.status === "EM_ATENDIMENTO").length;
  const finalizados = todosChamados.filter((c) => c.status === "CONCLUIDO").length;

  const chamadosFiltrados =
    status && status !== "TODOS"
      ? todosChamados.filter((c) => c.status === status)
      : todosChamados;

  return (
    <div className="min-h-screen bg-[#020617] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black px-4 py-10 sm:px-8 custom-scrollbar">

      {/* HEADER */}
      <div className="mx-auto max-w-7xl mb-10 rounded-[2.5rem] border border-white/5 bg-slate-900/20 backdrop-blur-3xl shadow-2xl p-8 flex flex-col lg:flex-row items-center justify-between gap-6 ring-1 ring-white/5 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 bg-blue-600/20 rounded-2xl border border-blue-500/20">
              <Headphones className="text-blue-400 w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tighter uppercase italic">
                Chamados <span className="text-blue-500">Internos</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4 pl-1">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Operador:</span>
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/10">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-blue-400 font-bold text-xs uppercase">@{session.user.usuario}</span>
            </div>
            {abertos > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-400 font-black text-[10px] uppercase tracking-widest">{abertos} pendente{abertos > 1 ? "s" : ""}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 relative z-10">
          {podeVerTodos && (
            <Link href="/PainelAlpha/GestaoProtocolos">
              <Button variant="ghost" className="cursor-pointer text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded-[1.5rem] px-6 h-12 font-black uppercase tracking-widest border border-violet-500/20 hover:border-violet-500/40 transition-all">
                <BookOpen className="mr-2 w-4 h-4" />
                Protocolos
              </Button>
            </Link>
          )}
          {podeAbrirChamado && (
            <Link href="/PainelAlpha/Chamados/NovoChamado">
              <Button className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white rounded-[1.5rem] px-8 h-14 font-black uppercase tracking-widest shadow-2xl shadow-blue-900/40 border-t border-white/20 transition-all active:scale-95 group">
                <PlusCircle className="mr-2 w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                Novo Chamado
              </Button>
            </Link>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-7xl space-y-8 relative">

        <FiltroChamadosCards
          total={total}
          abertos={abertos}
          emCurso={emCurso}
          finalizados={finalizados}
        />

        <div className="rounded-[2.5rem] border border-white/5 bg-slate-900/10 backdrop-blur-xl overflow-hidden shadow-2xl">
          {/* Cabeçalho da tabela */}
          <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/3">
            <div className="flex items-center gap-4">
              <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-tighter">
                  Histórico de Atendimentos
                </h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                  {chamadosFiltrados.length} registro{chamadosFiltrados.length !== 1 ? "s" : ""}
                  {status && status !== "TODOS" ? ` • filtrando por ${STATUS_LABEL[status] ?? status}` : ""}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-600 text-[9px] font-black uppercase tracking-[0.2em] bg-black/20">
                  <th className="px-8 py-4">#</th>
                  <th className="px-8 py-4">Assunto / Categoria</th>
                  {podeVerTodos && <th className="px-8 py-4">Solicitante</th>}
                  <th className="px-8 py-4 text-center">Urgência</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4">Abertura</th>
                  <th className="px-8 py-4 text-center">Chat</th>
                  <th className="px-8 py-4 text-right">Gestão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {chamadosFiltrados.length > 0 ? (
                  chamadosFiltrados.map((chamado) => (
                    <tr
                      key={chamado.id}
                      className="hover:bg-blue-600/5 transition-all duration-200 group"
                    >
                      {/* ID */}
                      <td className="px-8 py-5">
                        <span className="text-slate-600 text-xs font-black font-mono group-hover:text-blue-500 transition-colors">
                          #{chamado.id}
                        </span>
                      </td>

                      {/* Assunto */}
                      <td className="px-8 py-5">
                        <div className="flex flex-col gap-1">
                          <span className="text-white font-black text-sm uppercase tracking-tight group-hover:text-blue-400 transition-colors max-w-[220px] truncate">
                            {chamado.titulo}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase">
                            {chamado.categoria}
                          </span>
                        </div>
                      </td>

                      {/* Solicitante (admin/CEO) */}
                      {podeVerTodos && (
                        <td className="px-8 py-5">
                          <div className="flex flex-col">
                            <span className="text-slate-300 text-xs font-bold">{chamado.solicitante.nome}</span>
                            <span className="text-[10px] text-slate-600 font-bold">@{chamado.solicitante.usuario}</span>
                          </div>
                        </td>
                      )}

                      {/* Prioridade */}
                      <td className="px-8 py-5">
                        <div className="flex justify-center">
                          <span
                            className={`px-3 py-1 rounded-lg text-[9px] font-black border uppercase tracking-widest ${PRIORIDADE_STYLES[chamado.prioridade] ?? PRIORIDADE_STYLES.MEDIA}`}
                          >
                            {PRIORIDADE_LABEL[chamado.prioridade] ?? chamado.prioridade}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-8 py-5">
                        <div
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-tight ${STATUS_STYLES[chamado.status] ?? ""}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full bg-current ${chamado.status === "ABERTO" ? "animate-ping" : ""}`}
                          />
                          {STATUS_LABEL[chamado.status] ?? chamado.status}
                        </div>
                      </td>

                      {/* Data */}
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          <span className="text-slate-400 text-[10px] font-black font-mono">
                            {new Date(chamado.createdAt).toLocaleDateString("pt-BR")}
                          </span>
                          <span className="text-slate-600 text-[9px] font-bold">
                            {tempoRelativo(chamado.createdAt)}
                          </span>
                        </div>
                      </td>

                      {/* Chat */}
                      <td className="px-8 py-5 text-center">
                        <ChatChamado
                          chamadoId={chamado.id}
                          titulo={chamado.titulo}
                          mensagensIniciais={chamado.mensagens}
                          contagem={chamado._count.mensagens}
                          status={chamado.status}
                          usuarioAtualId={userId}
                          isAdmin={isAdmin}
                        />
                      </td>

                      {/* Ações */}
                      <td className="px-8 py-5 text-right">
                        <DetalhesChamado chamado={chamado} isAdmin={isAdmin} templates={templates} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={podeVerTodos ? 8 : 7} className="px-8 py-24 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-20">
                        <Headphones size={48} />
                        <div>
                          <p className="text-sm font-black uppercase tracking-widest">Nenhum chamado encontrado</p>
                          <p className="text-xs text-slate-500 mt-1 font-bold">
                            {status && status !== "TODOS" ? "Tente remover o filtro" : "A fila está vazia"}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
