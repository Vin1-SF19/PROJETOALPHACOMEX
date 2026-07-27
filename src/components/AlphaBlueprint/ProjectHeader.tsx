"use client";

import { ArrowLeft } from "lucide-react";
import { STATUS_LABELS, PRIORIDADE_CONFIG } from "./tipos";
import type { ProjetoDetalhado } from "./ProjectWorkspace";

interface ProjectHeaderProps {
  projeto: ProjetoDetalhado;
  onVoltar: () => void;
}

export function ProjectHeader({ projeto, onVoltar }: ProjectHeaderProps) {
  const prioridade = PRIORIDADE_CONFIG[projeto.priority] ?? PRIORIDADE_CONFIG.NORMAL;

  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b border-white/5 shrink-0">
      <button onClick={onVoltar} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeft size={16} />
        Projetos
      </button>

      <div className="h-4 w-px bg-white/10" />

      <h1 className="text-sm font-semibold text-white truncate">{projeto.title}</h1>
      <span className="text-[10px] font-mono text-slate-500 shrink-0">{projeto.code}</span>

      <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-slate-300 shrink-0">
        {STATUS_LABELS[projeto.status] ?? projeto.status}
      </span>

      <span
        className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
        style={{ background: `rgba(${prioridade.cor},0.15)`, color: `rgb(${prioridade.cor})` }}
      >
        {prioridade.label}
      </span>

      <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
        {projeto.updatedAt && <span>Atualizado {new Date(projeto.updatedAt).toLocaleDateString("pt-BR")}</span>}
      </div>
    </header>
  );
}
