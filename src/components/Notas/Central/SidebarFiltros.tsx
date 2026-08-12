import {
  Clock, Star, Pin, Users, User, UsersRound, Link2, Archive, Trash2,
  type LucideIcon,
} from "lucide-react";
import type { SecaoCentralNotas } from "@/lib/validations/notas";
import { cn } from "@/lib/utils";

const SECOES: { id: SecaoCentralNotas; label: string; icon: LucideIcon }[] = [
  { id: "RECENTES", label: "Recentes", icon: Clock },
  { id: "FAVORITAS", label: "Favoritas", icon: Star },
  { id: "FIXADAS", label: "Fixadas", icon: Pin },
  { id: "COMPARTILHADAS_COMIGO", label: "Compartilhadas comigo", icon: Users },
  { id: "CRIADAS_POR_MIM", label: "Criadas por mim", icon: User },
  { id: "EQUIPE", label: "Notas de equipe", icon: UsersRound },
  { id: "CONTEXTUAIS", label: "Contextuais", icon: Link2 },
  { id: "ARQUIVADAS", label: "Arquivadas", icon: Archive },
  { id: "LIXEIRA", label: "Lixeira", icon: Trash2 },
];

interface TagDisponivel {
  id: string;
  name: string;
  color: string;
}

interface SidebarFiltrosProps {
  secaoAtiva: SecaoCentralNotas;
  onSelecionarSecao: (secao: SecaoCentralNotas) => void;
  tags: TagDisponivel[];
  tagsSelecionadas: string[];
  onToggleTag: (tagId: string) => void;
  accent: string;
  className?: string;
}

export function SidebarFiltros({
  secaoAtiva,
  onSelecionarSecao,
  tags,
  tagsSelecionadas,
  onToggleTag,
  accent,
  className,
}: SidebarFiltrosProps) {
  return (
    <nav className={cn("flex h-full w-56 shrink-0 flex-col gap-1 overflow-y-auto p-3", className)} data-guia-notas="secoes">
      {SECOES.map((secao) => {
        const Icon = secao.icon;
        const ativa = secao.id === secaoAtiva;
        return (
          <button
            key={secao.id}
            type="button"
            onClick={() => onSelecionarSecao(secao.id)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
              !ativa && "text-slate-400 hover:bg-white/5 hover:text-slate-200",
            )}
            style={
              ativa
                ? { background: `rgba(${accent},0.14)`, color: `rgba(${accent},1)` }
                : undefined
            }
          >
            <Icon size={14} aria-hidden="true" />
            {secao.label}
          </button>
        );
      })}

      {tags.length > 0 && (
        <div className="mt-4 border-t border-white/5 pt-3" data-guia-notas="tags">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Etiquetas</p>
          <div className="flex flex-wrap gap-1.5 px-3">
            {tags.map((tag) => {
              const selecionada = tagsSelecionadas.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onToggleTag(tag.id)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                    selecionada ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-slate-500 hover:text-slate-300",
                  )}
                  style={selecionada ? { borderColor: tag.color } : undefined}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
