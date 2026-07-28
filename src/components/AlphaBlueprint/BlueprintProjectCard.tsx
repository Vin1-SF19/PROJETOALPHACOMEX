"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown, ArrowUp, Minus, AlertTriangle, Siren,
  Paperclip, ListChecks, HelpCircle, Clock, Check,
} from "lucide-react";
import { PRIORIDADE_CONFIG, parseTags, type ProjetoBlueprintCard } from "./tipos";

const PRIORIDADE_ICONS: Record<string, typeof ArrowDown> = {
  ArrowDown, Minus, ArrowUp, AlertTriangle, Siren,
};

function formatarDataRelativa(data: string | Date): string {
  const d = new Date(data);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min atrás`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h atrás`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}d atrás`;
  return d.toLocaleDateString("pt-BR");
}

interface BlueprintProjectCardProps {
  projeto: ProjetoBlueprintCard;
  accent: string;
  onAbrir: (id: string) => void;
  modoSelecao?: boolean;
  selecionado?: boolean;
  onToggleSelecionado?: (id: string) => void;
}

export function BlueprintProjectCard({
  projeto, accent, onAbrir, modoSelecao = false, selecionado = false, onToggleSelecionado,
}: BlueprintProjectCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: projeto.id,
    disabled: modoSelecao,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const reducedMotion = useReducedMotion();

  function handleClick() {
    if (isDragging) return;
    if (modoSelecao) {
      onToggleSelecionado?.(projeto.id);
      return;
    }
    onAbrir(projeto.id);
  }

  const prioridade = PRIORIDADE_CONFIG[projeto.priority] ?? PRIORIDADE_CONFIG.NORMAL;
  const PrioridadeIcon = PRIORIDADE_ICONS[prioridade.icone] ?? Minus;
  const tags = parseTags(projeto.tagsJson);
  const responsavel = projeto.developer ?? projeto.owner ?? projeto.requester;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...(modoSelecao ? {} : attributes)}
      {...(modoSelecao ? {} : listeners)}
      onClick={handleClick}
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reducedMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.15 }}
      className={`group select-none rounded-2xl border p-3 space-y-2.5 transition-colors ${
        modoSelecao ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
      } ${
        selecionado ? "border-rose-400/50 bg-rose-500/[0.08]" : "border-white/5 bg-slate-800/80 hover:border-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        {modoSelecao && (
          <span
            className={`shrink-0 w-4 h-4 rounded-md border flex items-center justify-center mt-0.5 ${
              selecionado ? "bg-rose-500 border-rose-500" : "border-white/20"
            }`}
          >
            {selecionado && <Check size={11} className="text-white" />}
          </span>
        )}
        <p className="text-sm font-semibold text-white leading-tight line-clamp-2">{projeto.title}</p>
        <span className="shrink-0 text-[10px] font-mono text-slate-500">{projeto.code}</span>
      </div>

      {projeto.summary && (
        <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">{projeto.summary}</p>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[9px] px-1.5 py-0.5 rounded-full border border-white/10 text-slate-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, Math.max(0, projeto.progress))}%`, background: `rgba(${accent},0.7)` }}
        />
      </div>

      <div className="flex items-center justify-between pt-0.5">
        <span
          className="flex items-center gap-1 text-[10px] font-medium"
          style={{ color: `rgb(${prioridade.cor})` }}
          title={`Prioridade: ${prioridade.label}`}
        >
          <PrioridadeIcon size={11} />
          {prioridade.label}
        </span>

        <div className="flex items-center gap-2 text-slate-500">
          {(projeto._count?.files ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-[10px]" title="Anexos">
              <Paperclip size={10} />{projeto._count?.files}
            </span>
          )}
          {(projeto._count?.requirements ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-[10px]" title="Requisitos">
              <ListChecks size={10} />{projeto._count?.requirements}
            </span>
          )}
          {(projeto.perguntasAbertas ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-amber-400" title="Perguntas sem resposta">
              <HelpCircle size={10} />{projeto.perguntasAbertas}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-0.5 border-t border-white/5 mt-1.5">
        <span className="flex items-center gap-1 text-[10px] text-slate-500">
          <Clock size={10} />
          {formatarDataRelativa(projeto.updatedAt)}
        </span>
        {responsavel && (
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0"
            style={{ background: `rgba(${accent},0.5)` }}
            title={responsavel.nome}
          >
            {responsavel.nome?.[0]?.toUpperCase() ?? "?"}
          </span>
        )}
      </div>
    </motion.div>
  );
}
