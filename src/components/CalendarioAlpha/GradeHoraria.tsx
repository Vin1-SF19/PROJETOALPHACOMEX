"use client";

import { useEffect, useRef, type ReactNode } from "react";

import type { TemaAlpha } from "@/lib/temas";
import { CheckCircle2, Sparkles } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import { DetalhePopover } from "./DetalhePopover";
import { formatarDiaSemanaCurto, formatarHora, mesmodia } from "./lib/datas";
import { calcularPosicoesEventosDoDia, eventosDiaInteiroDoDia } from "./lib/layout-eventos";
import { corDoItemAgenda, COR_CALENDARIO_PADRAO, FUNDO_TAREFA_CONCLUIDA, type EventoExibicao } from "./lib/tipos";

const ALTURA_HORA_PX = 64;
const HORAS = Array.from({ length: 24 }, (_, i) => i);

function iniciaisDoNome(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte.charAt(0))
    .join("")
    .toUpperCase() || "?";
}

interface GrupoCalendario {
  calendarioId: string;
  nome: string;
  cor: string;
}

/** Uma coluna por calendário (agenda própria, colega ou lista de tarefas) presente nos eventos do dia — na ordem em que aparecem. */
function agruparPorCalendario(eventos: EventoExibicao[]): GrupoCalendario[] {
  const grupos = new Map<string, GrupoCalendario>();
  for (const evento of eventos) {
    if (!grupos.has(evento.calendarioId)) {
      grupos.set(evento.calendarioId, {
        calendarioId: evento.calendarioId,
        nome: evento.calendarioNome || evento.calendarioGoogleId,
        cor: evento.calendarioCorHex ?? COR_CALENDARIO_PADRAO,
      });
    }
  }
  return [...grupos.values()];
}

interface ColunaGrade {
  chave: string;
  dia: Date;
  eventosColuna: EventoExibicao[];
  header: ReactNode;
  cor?: string;
}

/** Grade horária compartilhada — colunas por dia (Dia/Semana) ou, na Dia com mais de um calendário, uma coluna por calendário/pessoa. */
export function GradeHoraria({
  dias,
  eventos,
  tema,
  onEditarEvento,
  onEventoCancelado,
  onSelecionarHorario,
  onConcluirTarefa,
}: {
  dias: Date[];
  eventos: EventoExibicao[];
  tema: TemaAlpha;
  onEditarEvento: (evento: EventoExibicao) => void;
  onEventoCancelado: () => void;
  onSelecionarHorario: (data: Date) => void;
  onConcluirTarefa: (tarefaCacheId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hoje = new Date();
  const gruposCalendario = dias.length === 1 ? agruparPorCalendario(eventos) : [];
  const modoPessoas = gruposCalendario.length > 1;

  useEffect(() => {
    // Abre a grade já rolada para perto da hora atual — sem isso o usuário cai no topo (meia-noite).
    if (containerRef.current) {
      const agora = new Date();
      const offsetPx = ((agora.getHours() * 60 + agora.getMinutes()) / 60) * ALTURA_HORA_PX;
      containerRef.current.scrollTop = Math.max(0, offsetPx - ALTURA_HORA_PX * 2);
    }
  }, []);

  const colunas: ColunaGrade[] = modoPessoas
    ? gruposCalendario.map((grupo) => ({
        chave: grupo.calendarioId,
        dia: dias[0],
        eventosColuna: eventos.filter((evento) => evento.calendarioId === grupo.calendarioId),
        cor: grupo.cor,
        header: (
          <div className="flex flex-col items-center gap-1 px-1 py-2">
            <Avatar size="sm" className="shadow-[0_2px_8px_rgba(0,0,0,0.35)] ring-2" style={{ ["--tw-ring-color" as string]: grupo.cor }}>
              <AvatarFallback className="text-[11px] font-black text-white" style={{ background: grupo.cor }}>
                {iniciaisDoNome(grupo.nome)}
              </AvatarFallback>
            </Avatar>
            <span className="max-w-full truncate text-[10px] font-bold text-slate-300" title={grupo.nome}>
              {grupo.nome}
            </span>
          </div>
        ),
      }))
    : dias.map((dia) => {
        const ehHoje = mesmodia(dia, hoje);
        return {
          chave: dia.toISOString(),
          dia,
          eventosColuna: eventos,
          header: (
            <div className="px-2 py-2.5 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {formatarDiaSemanaCurto(dia)}
              </p>
              <p className={cn("mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-slate-200", ehHoje && "bg-white text-slate-950")}>
                {dia.getDate()}
              </p>
            </div>
          ),
        };
      });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] shadow-2xl shadow-slate-950/20">
      {modoPessoas && (
        <div className="px-3 pt-2 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            {formatarDiaSemanaCurto(dias[0])} · {dias[0].getDate()}
          </p>
        </div>
      )}
      <div
        className="grid shrink-0 border-b border-white/10 bg-slate-950/20"
        style={{ gridTemplateColumns: `4rem repeat(${colunas.length}, 1fr)` }}
      >
        <div />
        {colunas.map((coluna) => (
          <div
            key={coluna.chave}
            className="border-l border-white/5"
            style={coluna.cor ? { borderTopWidth: 3, borderTopColor: coluna.cor } : undefined}
          >
            {coluna.header}
          </div>
        ))}
      </div>

      {colunas.some((coluna) => eventosDiaInteiroDoDia(coluna.dia, coluna.eventosColuna).length > 0) && (
        <div className="grid max-h-28 shrink-0 overflow-y-auto border-b border-white/5" style={{ gridTemplateColumns: `4rem repeat(${colunas.length}, 1fr)` }}>
          <div className="flex items-center justify-end pr-2 text-[9px] font-bold uppercase text-slate-600">Dia todo</div>
          {colunas.map((coluna) => (
            <div key={coluna.chave} className="border-l border-white/[0.07] p-1 space-y-1 min-h-[2rem]">
              {eventosDiaInteiroDoDia(coluna.dia, coluna.eventosColuna).map((evento) => evento.tipo === "tarefa" ? (
                <div key={evento.id} className={cn("group/task flex w-full items-center gap-1.5 overflow-hidden rounded-lg border py-1 pr-1 text-[10px] font-bold shadow-[0_5px_14px_rgba(16,185,129,0.14)] transition-all hover:-translate-y-px", evento.status === "completed" ? "border-slate-500/30 bg-slate-800/80 text-slate-400" : "border-emerald-200/20 bg-emerald-500/15 text-emerald-50 hover:bg-emerald-400/25")} style={{ borderLeftColor: corDoItemAgenda(evento), borderLeftWidth: 3 }}>
                  {evento.status === "completed" ? (
                    <span className="ml-1 flex size-4 shrink-0 items-center justify-center rounded-full border border-slate-400/60 bg-slate-950/30" title="Tarefa concluída"><CheckCircle2 className="size-3 text-slate-300" aria-hidden="true" /></span>
                  ) : (
                    <button type="button" onClick={() => evento.tarefaCacheId && onConcluirTarefa(evento.tarefaCacheId)} className="ml-1 flex size-4 shrink-0 items-center justify-center rounded-full border border-emerald-100/80 bg-emerald-950/30 transition-colors hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label={`Concluir tarefa: ${evento.titulo || "sem título"}`} title="Concluir tarefa">
                      <CheckCircle2 className="size-3 text-emerald-100 group-hover/task:text-emerald-600" aria-hidden="true" />
                    </button>
                  )}
                  <button type="button" onClick={() => onEditarEvento(evento)} className={cn("min-w-0 flex-1 truncate px-0.5 text-left focus:outline-none", evento.status === "completed" && "line-through decoration-slate-400")} title={`Editar tarefa: ${evento.titulo || "sem título"}`}>
                    {evento.titulo || "(sem título)"}
                  </button>
                </div>
              ) : (
                <DetalhePopover key={evento.id} evento={evento} tema={tema} onEditar={onEditarEvento} onCancelado={onEventoCancelado}>
                  <button type="button" className={cn("flex w-full items-center gap-1.5 truncate rounded-lg border border-white/10 px-1.5 py-1 text-left text-[10px] font-bold text-white shadow-[0_5px_14px_rgba(15,23,42,0.18)] transition-all hover:-translate-y-px hover:brightness-110", evento.recusadoPeloUsuario && "opacity-55 grayscale line-through", evento.compartilhadoComUsuario && "shadow-none")} style={{ background: evento.compartilhadoComUsuario ? "rgba(15,23,42,0.84)" : `linear-gradient(135deg, ${corDoItemAgenda(evento)}f2, ${corDoItemAgenda(evento)}b8)`, borderColor: evento.compartilhadoComUsuario ? corDoItemAgenda(evento) : undefined, borderLeftColor: evento.compartilhadoComUsuario ? corDoItemAgenda(evento) : "rgba(255,255,255,0.75)", borderLeftWidth: 3, color: evento.compartilhadoComUsuario ? corDoItemAgenda(evento) : undefined }}>
                    {evento.eventType === "focusTime" && <Sparkles className="size-3 shrink-0 text-white/90" aria-hidden="true" />}
                    <span className="truncate">{evento.titulo || "(sem título)"}</span>
                  </button>
                </DetalhePopover>
              ))}
            </div>
          ))}
        </div>
      )}

      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="grid" style={{ gridTemplateColumns: `4rem repeat(${colunas.length}, 1fr)` }}>
          <div>
            {HORAS.map((hora) => (
              <div key={hora} style={{ height: ALTURA_HORA_PX }} className="pr-2 text-right text-[10px] text-slate-600 -translate-y-2">
                {hora > 0 && `${String(hora).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>

          {colunas.map((coluna) => {
            const posicoes = calcularPosicoesEventosDoDia(coluna.dia, coluna.eventosColuna);
            const ehHoje = mesmodia(coluna.dia, hoje);
            return (
              <div
                key={coluna.chave}
                className="relative border-l border-white/[0.07]"
                style={{
                  height: ALTURA_HORA_PX * 24,
                  background: coluna.cor ? `color-mix(in srgb, ${coluna.cor} 5%, transparent)` : undefined,
                }}
              >
                {HORAS.map((hora) => (
                  <button
                    key={hora}
                    type="button"
                    onClick={() => {
                      const dataHorario = new Date(coluna.dia);
                      dataHorario.setHours(hora, 0, 0, 0);
                      onSelecionarHorario(dataHorario);
                    }}
                    aria-label={`Novo evento às ${String(hora).padStart(2, "0")}:00`}
                    className="absolute inset-x-0 w-full border-b border-white/[0.05] hover:bg-white/[0.04] focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/20"
                    style={{ top: hora * ALTURA_HORA_PX, height: ALTURA_HORA_PX }}
                  />
                ))}

                {ehHoje && (
                  <div
                    className="absolute inset-x-0 z-10 h-px bg-rose-500"
                    style={{ top: ((hoje.getHours() * 60 + hoje.getMinutes()) / 60) * ALTURA_HORA_PX }}
                  >
                    <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-rose-500" />
                  </div>
                )}

                {posicoes.map(({ evento, topoPercentual, alturaPercentual, coluna: colunaIndice, totalColunas }) => evento.tipo === "tarefa" ? (
                  <div
                    key={evento.id}
                    className={cn("group/task absolute z-20 overflow-hidden rounded-xl border border-white/15 border-l-[3px] px-2 py-1.5 text-left text-[10px] font-bold text-white shadow-[0_10px_22px_rgba(15,23,42,0.30)] transition-all duration-150 hover:z-30 hover:-translate-y-px hover:brightness-110 hover:shadow-xl", evento.status === "completed" && "border-slate-500/35 text-slate-400")}
                    style={{
                      top: `${topoPercentual}%`,
                      height: `${alturaPercentual}%`,
                      left: `${(colunaIndice / totalColunas) * 100}%`,
                      width: `${100 / totalColunas}%`,
                      background: evento.status === "completed" ? FUNDO_TAREFA_CONCLUIDA : `linear-gradient(135deg, ${corDoItemAgenda(evento)}f5, ${corDoItemAgenda(evento)}bc)`,
                      borderLeftColor: "rgba(255,255,255,0.8)",
                      boxShadow: evento.status === "completed" ? "0 8px 18px rgba(2,6,23,0.35)" : `0 10px 22px ${corDoItemAgenda(evento)}33`,
                    }}
                  >
                    <span className="flex items-center gap-1 truncate leading-tight">
                      {evento.status === "completed" ? (
                        <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/20" title="Tarefa concluída"><CheckCircle2 className="size-3 text-white" aria-hidden="true" /></span>
                      ) : (
                        <button type="button" onClick={() => evento.tarefaCacheId && onConcluirTarefa(evento.tarefaCacheId)} className="flex size-4 shrink-0 items-center justify-center rounded-full border border-white/80 bg-slate-950/25 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label={`Concluir tarefa: ${evento.titulo || "sem título"}`} title="Concluir tarefa"><CheckCircle2 className="size-3 text-white" aria-hidden="true" /></button>
                      )}
                      <button type="button" onClick={() => onEditarEvento(evento)} className={cn("min-w-0 flex-1 truncate text-left focus:outline-none", evento.status === "completed" && "line-through decoration-slate-400")} title={`Editar tarefa: ${evento.titulo || "sem título"}`}><span className="truncate">{evento.titulo || "(sem título)"}</span></button>
                    </span>
                    {evento.inicioEm && <span className="mt-0.5 block truncate text-[9px] font-medium text-white/75">{formatarHora(new Date(evento.inicioEm))}</span>}
                  </div>
                ) : (
                  <DetalhePopover key={evento.id} evento={evento} tema={tema} onEditar={onEditarEvento} onCancelado={onEventoCancelado}>
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className={cn("group/event absolute z-20 overflow-hidden rounded-xl border border-white/15 border-l-[3px] px-2 py-1.5 text-left text-[10px] font-bold text-white shadow-[0_10px_22px_rgba(15,23,42,0.30)] transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent before:opacity-70 hover:z-30 hover:-translate-y-px hover:brightness-110 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40", evento.recusadoPeloUsuario && "opacity-55 grayscale line-through", evento.compartilhadoComUsuario && "shadow-none")}
                      style={{
                        top: `${topoPercentual}%`,
                        height: `${alturaPercentual}%`,
                        left: `${(colunaIndice / totalColunas) * 100}%`,
                        width: `${100 / totalColunas}%`,
                        background: evento.compartilhadoComUsuario ? "rgba(15,23,42,0.88)" : `linear-gradient(135deg, ${corDoItemAgenda(evento)}f5, ${corDoItemAgenda(evento)}bc)`,
                        borderColor: evento.compartilhadoComUsuario ? corDoItemAgenda(evento) : undefined,
                        borderLeftColor: evento.compartilhadoComUsuario ? corDoItemAgenda(evento) : "rgba(255,255,255,0.8)",
                        boxShadow: evento.compartilhadoComUsuario ? "none" : `0 10px 22px ${corDoItemAgenda(evento)}33`,
                        color: evento.compartilhadoComUsuario ? corDoItemAgenda(evento) : undefined,
                      }}
                      title={evento.titulo ?? "(sem título)"}
                    >
                      <span className={cn("flex items-center gap-1 truncate leading-tight", evento.compartilhadoComUsuario && "text-current")}>
                        {evento.eventType === "focusTime" && <Sparkles className="size-3 shrink-0 text-white/90" aria-hidden="true" />}
                        <span className="truncate">{evento.titulo || "(sem título)"}</span>
                      </span>
                      {evento.inicioEm && <span className={cn("mt-0.5 block truncate text-[9px] font-medium text-white/75", evento.compartilhadoComUsuario && "text-current opacity-80")}>{formatarHora(new Date(evento.inicioEm))}</span>}
                    </button>
                  </DetalhePopover>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
