"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle, Pencil } from "lucide-react";
import { STATUS_LABELS, PRIORIDADE_CONFIG, parseTags } from "./tipos";
import { ProjectMaturity } from "./ProjectMaturity";
import { EditProjectDialog } from "./EditProjectDialog";
import type { ProjetoDetalhado } from "./ProjectWorkspace";
import type { AbaProjeto } from "./ProjectSidebar";
import { formatarPremioBRL } from "@/lib/blueprint/premio";

interface ProjectOverviewProps {
  projeto: ProjetoDetalhado;
  accent: string;
  userId: number;
  onNavegar: (aba: AbaProjeto) => void;
}

export function ProjectOverview({ projeto, accent, userId, onNavegar }: ProjectOverviewProps) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const prioridade = PRIORIDADE_CONFIG[projeto.priority] ?? PRIORIDADE_CONFIG.NORMAL;
  const tags = parseTags(projeto.tagsJson);
  const podeEditarPremio = projeto.createdById === userId;

  const checklist = [
    { label: "Problema descrito", completo: !!projeto.problem },
    { label: "Objetivo definido", completo: !!projeto.objective },
    { label: "Usuários identificados", completo: !!projeto.requester },
    { label: "Fluxo principal documentado", completo: (projeto._count?.documents ?? 0) > 0 },
    { label: "Telas principais descritas", completo: (projeto._count?.boards ?? 0) > 0 },
    { label: "Regras de negócio registradas", completo: (projeto._count?.requirements ?? 0) > 0 },
    { label: "Arquivos e referências anexados", completo: (projeto._count?.files ?? 0) > 0 },
    { label: "Dúvidas respondidas", completo: (projeto._count?.questions ?? 0) === 0 },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-5xl">
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Sobre o projeto</h2>
            <button
              onClick={() => setEditando(true)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <Pencil size={12} />
              Editar
            </button>
          </div>
          {projeto.summary && <p className="text-sm text-slate-300">{projeto.summary}</p>}

          {projeto.problem && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Problema</p>
              <p className="text-sm text-slate-300">{projeto.problem}</p>
            </div>
          )}

          {projeto.objective && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Objetivo</p>
              <p className="text-sm text-slate-300">{projeto.objective}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
            <div>
              <p className="text-slate-500">Setor</p>
              <p className="text-slate-300">{projeto.setor ?? "—"}</p>
            </div>
            <div>
              <p className="text-slate-500">Solicitante</p>
              <p className="text-slate-300">{projeto.requester?.nome ?? "—"}</p>
            </div>
            <div>
              <p className="text-slate-500">Responsável (especificação)</p>
              <p className="text-slate-300">{projeto.owner?.nome ?? "Não definido"}</p>
            </div>
            <div>
              <p className="text-slate-500">Responsável (desenvolvimento)</p>
              <p className="text-slate-300">{projeto.developer?.nome ?? "Não definido"}</p>
            </div>
            <div>
              <p className="text-slate-500">Prazo desejado</p>
              <p className="text-slate-300">{projeto.dueDate ? new Date(projeto.dueDate).toLocaleDateString("pt-BR") : "Não definido"}</p>
            </div>
            <div>
              <p className="text-slate-500">Status</p>
              <p className="text-slate-300">{STATUS_LABELS[projeto.status] ?? projeto.status}</p>
            </div>
            <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.04] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-slate-500">Prêmio</p>
                  <p className="font-medium text-emerald-300">
                    {projeto.premioCents === null ? "Não definido" : formatarPremioBRL(projeto.premioCents)}
                  </p>
                </div>
                {podeEditarPremio && (
                  <button
                    type="button"
                    onClick={() => setEditando(true)}
                    className="shrink-0 rounded-lg border border-emerald-400/20 px-2 py-1 text-[10px] font-medium text-emerald-200 hover:bg-emerald-400/10 transition-colors"
                  >
                    {projeto.premioCents === null ? "Definir prêmio" : "Editar prêmio"}
                  </button>
                )}
              </div>
              {!podeEditarPremio && (
                <p className="mt-1 text-[9px] text-slate-600">Somente o criador do projeto pode alterar.</p>
              )}
            </div>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {tags.map((tag) => (
                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-slate-400">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Pessoas com acesso</h2>
          <div className="flex flex-wrap gap-2">
            {projeto.members?.map((m) => (
              <div key={m.id} className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-white/5 border border-white/5">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white"
                  style={{ background: `rgba(${accent},0.5)` }}
                >
                  {m.usuario.nome?.[0]?.toUpperCase() ?? "?"}
                </span>
                <span className="text-xs text-slate-300">{m.usuario.nome}</span>
                <span className="text-[9px] text-slate-500">{m.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <ProjectMaturity itens={checklist} accent={accent} />

        {(projeto._count?.questions ?? 0) > 0 && (
          <button
            onClick={() => onNavegar("perguntas")}
            className="w-full flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-left hover:bg-amber-500/10 transition-colors"
          >
            <HelpCircle size={16} className="text-amber-400 shrink-0" />
            <div>
              <p className="text-sm text-amber-300 font-medium">Perguntas pendentes</p>
              <p className="text-xs text-amber-400/70">Ver e responder</p>
            </div>
          </button>
        )}

        <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4">
          <p className="text-xs text-slate-500 mb-2">Prioridade</p>
          <span
            className="inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-lg"
            style={{ background: `rgba(${prioridade.cor},0.15)`, color: `rgb(${prioridade.cor})` }}
          >
            {prioridade.label}
          </span>
        </div>
      </div>

      <EditProjectDialog
        open={editando}
        onOpenChange={setEditando}
        projeto={projeto}
        accent={accent}
        podeEditarPremio={podeEditarPremio}
        onSalvo={() => router.refresh()}
      />
    </div>
  );
}
