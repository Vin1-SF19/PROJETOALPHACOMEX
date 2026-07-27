"use client";

import { LayoutDashboard, FileText, Waypoints, Paperclip, ListChecks, MessageSquare, Activity, Sparkles } from "lucide-react";

export type AbaProjeto =
  | "visao-geral"
  | "especificacao"
  | "canvas"
  | "arquivos"
  | "requisitos"
  | "perguntas"
  | "comentarios"
  | "atividade"
  | "ia";

const ITENS: { id: AbaProjeto; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "visao-geral", label: "Visão geral", icon: LayoutDashboard },
  { id: "especificacao", label: "Especificação", icon: FileText },
  { id: "canvas", label: "Canvas", icon: Waypoints },
  { id: "arquivos", label: "Arquivos", icon: Paperclip },
  { id: "requisitos", label: "Requisitos", icon: ListChecks },
  { id: "comentarios", label: "Comentários", icon: MessageSquare },
  { id: "ia", label: "Assistente IA", icon: Sparkles },
  { id: "atividade", label: "Atividade", icon: Activity },
];

interface ProjectSidebarProps {
  abaAtiva: AbaProjeto;
  onMudarAba: (aba: AbaProjeto) => void;
  accent: string;
}

export function ProjectSidebar({ abaAtiva, onMudarAba, accent }: ProjectSidebarProps) {
  return (
    <nav className="w-48 shrink-0 border-r border-white/5 p-2 space-y-0.5">
      {ITENS.map((item) => {
        const Icon = item.icon;
        const ativo = abaAtiva === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onMudarAba(item.id)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors relative"
            style={ativo ? { background: `rgba(${accent},0.1)`, color: `rgb(${accent})` } : undefined}
          >
            {ativo && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ background: `rgb(${accent})` }} />
            )}
            <Icon size={15} className={ativo ? "" : "text-slate-500"} />
            <span className={ativo ? "" : "text-slate-400"}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
