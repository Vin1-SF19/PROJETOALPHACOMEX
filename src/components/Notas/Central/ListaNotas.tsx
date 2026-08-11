import { Pin, Star, Paperclip, MessageSquare } from "lucide-react";
import type { OrdenacaoNotas } from "@/lib/validations/notas";
import { cn } from "@/lib/utils";

export interface NotaListada {
  id: string;
  title: string;
  visibility: string;
  status: string;
  isFavorite: boolean;
  isPinned: boolean;
  color: string | null;
  icon: string | null;
  updatedAt: Date | string;
  createdAt: Date | string;
  owner: { id: number; nome: string };
  contexts: { moduleKey: string; displayName: string }[];
  tags: { tag: { id: string; name: string; color: string } }[];
  _count: { attachments: number; comments: number };
}

interface ListaNotasProps {
  notas: NotaListada[];
  notaSelecionadaId: string | null;
  onSelecionar: (noteId: string) => void;
  ordenarPor: OrdenacaoNotas;
  onMudarOrdenacao: (ordenacao: OrdenacaoNotas) => void;
  page: number;
  totalPages: number;
  onMudarPage: (page: number) => void;
  carregando: boolean;
  accent: string;
}

const OPCOES_ORDENACAO: { id: OrdenacaoNotas; label: string }[] = [
  { id: "ATUALIZACAO", label: "Última edição" },
  { id: "CRIACAO", label: "Data de criação" },
  { id: "TITULO", label: "Título" },
];

function formatarData(data: Date | string): string {
  return new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function ListaNotas({
  notas,
  notaSelecionadaId,
  onSelecionar,
  ordenarPor,
  onMudarOrdenacao,
  page,
  totalPages,
  onMudarPage,
  carregando,
  accent,
}: ListaNotasProps) {
  return (
    <div className="flex h-full w-full min-w-0 flex-col">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
        <span className="text-[10px] uppercase tracking-wide text-slate-600">Ordenar por</span>
        <select
          value={ordenarPor}
          onChange={(event) => onMudarOrdenacao(event.target.value as OrdenacaoNotas)}
          className="rounded-md border border-white/10 bg-transparent px-2 py-1 text-xs text-slate-300 outline-none"
        >
          {OPCOES_ORDENACAO.map((opcao) => (
            <option key={opcao.id} value={opcao.id} className="bg-[#0b1120]">
              {opcao.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto">
        {carregando && <div className="px-3 py-4 text-xs text-slate-600">Carregando...</div>}

        {!carregando &&
          notas.map((nota) => {
            const selecionada = nota.id === notaSelecionadaId;
            return (
            <button
              key={nota.id}
              type="button"
              onClick={() => onSelecionar(nota.id)}
              className={cn(
                "flex w-full flex-col gap-1 border-b border-white/5 border-l-2 px-3 py-2.5 text-left transition-colors",
                !selecionada && "border-l-transparent hover:bg-white/[0.03]",
              )}
              style={selecionada ? { background: `rgba(${accent},0.08)`, borderLeftColor: `rgba(${accent},1)` } : undefined}
            >
              <div className="flex items-center gap-1.5">
                {nota.isPinned && <Pin size={10} className="shrink-0" style={{ color: `rgba(${accent},1)` }} aria-label="Fixada" />}
                {nota.isFavorite && <Star size={10} className="shrink-0" style={{ color: `rgba(${accent},1)` }} aria-label="Favorita" />}
                <span className="truncate text-sm font-medium text-slate-200">{nota.title || "Sem título"}</span>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-slate-600">
                <span>{formatarData(nota.updatedAt)}</span>
                <span>·</span>
                <span>{nota.owner.nome}</span>
                {nota._count.attachments > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Paperclip size={9} /> {nota._count.attachments}
                  </span>
                )}
                {nota._count.comments > 0 && (
                  <span className="flex items-center gap-0.5">
                    <MessageSquare size={9} /> {nota._count.comments}
                  </span>
                )}
              </div>

              {nota.contexts.length > 0 && (
                <span className="truncate text-[10px] text-indigo-400/80">{nota.contexts[0].displayName}</span>
              )}
            </button>
            );
          })}

        {!carregando && notas.length === 0 && (
          <div className="px-3 py-4 text-xs text-slate-600">Nenhuma nota nesta seção.</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-white/5 px-3 py-2 text-xs text-slate-500">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onMudarPage(page - 1)}
            className="disabled:opacity-30"
          >
            Anterior
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onMudarPage(page + 1)}
            className="disabled:opacity-30"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
