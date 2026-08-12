import { AnimatePresence, motion } from "framer-motion";
import { Pin, Star, Paperclip, MessageSquare, FileText, CheckSquare2, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { BarraAcoesLixeira } from "./BarraAcoesLixeira";

export interface NotaListada {
  id: string;
  title: string;
  plainText?: string;
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
  page: number;
  totalPages: number;
  onMudarPage: (page: number) => void;
  carregando: boolean;
  accent: string;
  isLixeira: boolean;
  modoSelecao: boolean;
  notasSelecionadas: ReadonlySet<string>;
  processandoLixeira: boolean;
  onAtivarSelecao: () => void;
  onCancelarSelecao: () => void;
  onToggleSelecionada: (noteId: string) => void;
  onExcluirSelecionadas: () => void;
  onEsvaziarLixeira: () => void;
}

function formatarData(data: Date | string): string {
  return new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** Imita a forma real de um card (título + prévia + rodapé) para não haver salto de layout quando os dados chegam. */
function CardNotaSkeleton() {
  return (
    <div className="flex h-40 w-full flex-col gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.035] p-3 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] backdrop-blur-md">
      <Skeleton className="h-3.5 w-3/5" />
      <Skeleton className="h-2.5 w-full" />
      <Skeleton className="h-2.5 w-4/5" />
      <div className="mt-auto">
        <Skeleton className="h-2.5 w-2/5" />
      </div>
    </div>
  );
}

export function ListaNotas({
  notas,
  notaSelecionadaId,
  onSelecionar,
  page,
  totalPages,
  onMudarPage,
  carregando,
  accent,
  isLixeira,
  modoSelecao,
  notasSelecionadas,
  processandoLixeira,
  onAtivarSelecao,
  onCancelarSelecao,
  onToggleSelecionada,
  onExcluirSelecionadas,
  onEsvaziarLixeira,
}: ListaNotasProps) {
  return (
    <div className="flex h-full w-full min-w-0 flex-col">
      {isLixeira && (
        <BarraAcoesLixeira
          quantidadeNotas={notas.length}
          quantidadeSelecionadas={notasSelecionadas.size}
          modoSelecao={modoSelecao}
          processando={processandoLixeira}
          onAtivarSelecao={onAtivarSelecao}
          onCancelarSelecao={onCancelarSelecao}
          onExcluirSelecionadas={onExcluirSelecionadas}
          onEsvaziarLixeira={onEsvaziarLixeira}
        />
      )}

      <div className="flex-1 overflow-y-auto p-3">
        {carregando && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardNotaSkeleton key={i} />
            ))}
          </div>
        )}

        {!carregando && notas.length > 0 && (
          <motion.div layout className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {notas.map((nota, index) => {
                const selecionada = nota.id === notaSelecionadaId;
                const marcadaParaExcluir = notasSelecionadas.has(nota.id);
                return (
                  <motion.button
                    key={nota.id}
                    type="button"
                    layout
                    initial={{ opacity: 0, y: 10, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
                    whileHover={{ y: -6, scale: 1.015 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => (modoSelecao ? onToggleSelecionada(nota.id) : onSelecionar(nota.id))}
                    aria-pressed={modoSelecao ? marcadaParaExcluir : selecionada}
                    className={cn(
                      "group relative flex h-40 flex-col overflow-hidden rounded-2xl border p-3 text-left backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-300",
                      "shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] hover:shadow-[0_20px_45px_-12px_rgba(0,0,0,0.65)]",
                      selecionada || marcadaParaExcluir
                        ? "border-transparent"
                        : "border-white/[0.06] bg-white/[0.035] hover:border-white/[0.12] hover:bg-white/[0.06]",
                    )}
                    style={
                      nota.color || selecionada || marcadaParaExcluir
                        ? {
                            ...(selecionada || marcadaParaExcluir
                              ? {
                                  background: `rgba(${accent},0.12)`,
                                  boxShadow: `0 20px 45px -12px rgba(${accent},0.35)`,
                                }
                              : undefined),
                            borderColor: nota.color ?? `rgba(${accent},0.4)`,
                          }
                        : undefined
                    }
                  >
                    {modoSelecao && (
                      <span
                        className="absolute right-2 top-2 z-10 rounded-md bg-slate-950/80 p-1 text-slate-300"
                        aria-hidden="true"
                      >
                        {marcadaParaExcluir ? <CheckSquare2 size={15} className="text-rose-300" /> : <Square size={15} />}
                      </span>
                    )}
                    {nota.color && (
                      <span
                        className="absolute left-0 top-0 h-full w-1"
                        style={{ background: nota.color }}
                        aria-hidden="true"
                      />
                    )}

                    <div className="mb-1 flex items-center gap-1.5">
                      {nota.isPinned && <Pin size={11} className="shrink-0" style={{ color: `rgba(${accent},1)` }} aria-label="Fixada" />}
                      {nota.isFavorite && <Star size={11} className="shrink-0" style={{ color: `rgba(${accent},1)` }} aria-label="Favorita" />}
                      <span className="truncate text-sm font-semibold text-slate-100">{nota.title || "Sem título"}</span>
                    </div>

                    {nota.plainText?.trim() ? (
                      <p className="line-clamp-3 flex-1 text-xs leading-relaxed text-slate-500">
                        {nota.plainText.trim()}
                      </p>
                    ) : (
                      <p className="flex flex-1 items-center gap-1.5 text-xs italic text-slate-700">
                        <FileText size={12} /> Nota vazia
                      </p>
                    )}

                    {nota.tags.length > 0 && (
                      <div className="mb-1.5 mt-1 flex flex-wrap gap-1">
                        {nota.tags.slice(0, 3).map(({ tag }) => (
                          <span
                            key={tag.id}
                            className="truncate rounded-full border px-1.5 py-0.5 text-[9px]"
                            style={{ borderColor: `${tag.color}55`, color: tag.color }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-auto flex items-center gap-2 border-t border-white/5 pt-1.5 text-[10px] text-slate-600">
                      <span className="truncate">{nota.owner.nome}</span>
                      <span className="shrink-0">·</span>
                      <span className="shrink-0">{formatarData(nota.updatedAt)}</span>
                      {nota._count.attachments > 0 && (
                        <span className="ml-auto flex shrink-0 items-center gap-0.5">
                          <Paperclip size={9} /> {nota._count.attachments}
                        </span>
                      )}
                      {nota._count.comments > 0 && (
                        <span className="flex shrink-0 items-center gap-0.5">
                          <MessageSquare size={9} /> {nota._count.comments}
                        </span>
                      )}
                    </div>

                    {nota.contexts.length > 0 && (
                      <span className="mt-1 truncate text-[9px] text-indigo-400/80">{nota.contexts[0].displayName}</span>
                    )}
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}

        {!carregando && notas.length === 0 && (
          <div className="flex h-full items-center justify-center px-3 py-4 text-xs text-slate-600">Nenhuma nota nesta seção.</div>
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
