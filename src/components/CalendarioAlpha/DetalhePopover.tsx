"use client";

import { useState, useTransition, type ReactNode } from "react";
import { CheckCircle2, CircleUserRound, HelpCircle, Loader2, MapPin, Phone, Pencil, Trash2, Users, Video, XCircle } from "lucide-react";
import { toast } from "sonner";

import {
  cancelarEventoParaColega,
  carregarDetalhesEventoColegaParaEdicao,
} from "@/actions/google-calendar-admin";
import {
  cancelarEventoNoCalendario,
  carregarDetalhesEventoParaEdicao,
  carregarDetalhesEventoParaVisualizacao,
} from "@/actions/google-calendar-eventos";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TemaAlpha } from "@/lib/temas";
import type { GoogleEventoDTO } from "@/lib/google-calendar/types";

import { AgendaModal3D } from "./AgendaModal3D";
import { formatarHora } from "./lib/datas";
import { COR_CALENDARIO_PADRAO, type EventoExibicao } from "./lib/tipos";

interface DetalhePopoverProps {
  evento: EventoExibicao;
  tema: TemaAlpha;
  onEditar: (evento: EventoExibicao) => void;
  onCancelado: () => void;
  children: ReactNode;
}

function rotuloResposta(status: GoogleEventoDTO["participantes"][number]["status"]): string {
  return status === "accepted" ? "Sim" : status === "declined" ? "Não" : status === "tentative" ? "Talvez" : "Pendente";
}

function IconeResposta({ status }: { status: GoogleEventoDTO["participantes"][number]["status"] }) {
  return status === "accepted" ? <CheckCircle2 className="size-4 text-emerald-400" /> : status === "declined" ? <XCircle className="size-4 text-rose-400" /> : <HelpCircle className="size-4 text-amber-300" />;
}

export function DetalhePopover({
  evento,
  tema,
  onEditar,
  onCancelado,
  children,
}: DetalhePopoverProps) {
  const [open, setOpen] = useState(false);
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);
  const [etagCancelamento, setEtagCancelamento] = useState(evento.etag || null);
  const [isPending, startTransition] = useTransition();
  const [detalhesCompartilhado, setDetalhesCompartilhado] = useState<GoogleEventoDTO | null>(null);
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(false);

  async function alternarPopover(proximoAberto: boolean) {
    setOpen(proximoAberto);
    if (!proximoAberto || !evento.compartilhadoComUsuario || detalhesCompartilhado || carregandoDetalhes) return;
    setCarregandoDetalhes(true);
    const resultado = await carregarDetalhesEventoParaVisualizacao({
      calendarioId: evento.calendarioId,
      googleEventId: evento.googleEventId,
    });
    setCarregandoDetalhes(false);
    if (!resultado.success) {
      toast.error(resultado.error);
      return;
    }
    setDetalhesCompartilhado(resultado.data);
  }

  async function prepararCancelamento() {
    if (etagCancelamento) {
      setOpen(false);
      setConfirmacaoAberta(true);
      return;
    }

    const resultado = evento.colegaId
      ? await carregarDetalhesEventoColegaParaEdicao(evento.colegaId, {
          calendarId: evento.calendarioGoogleId,
          googleEventId: evento.googleEventId,
        })
      : await carregarDetalhesEventoParaEdicao({
          calendarioId: evento.calendarioId,
          googleEventId: evento.googleEventId,
        });
    if (!resultado.success || !resultado.data.etag) {
      toast.error(resultado.success ? "Não foi possível confirmar a versão atual do evento." : resultado.error);
      return;
    }
    setEtagCancelamento(resultado.data.etag);
    setOpen(false);
    setConfirmacaoAberta(true);
  }

  function cancelar() {
    if (!etagCancelamento) {
      toast.error("Reabra o evento para confirmar a versão atual antes de cancelar.");
      return;
    }
    startTransition(async () => {
      const resultado = evento.colegaId
        ? await cancelarEventoParaColega(evento.colegaId, {
            calendarId: evento.calendarioGoogleId,
            googleEventId: evento.googleEventId,
            etagConhecido: etagCancelamento,
          })
        : await cancelarEventoNoCalendario({
            calendarId: evento.calendarioGoogleId,
            googleEventId: evento.googleEventId,
            etagConhecido: etagCancelamento,
          });
      if (!resultado.success) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Evento cancelado.");
      setConfirmacaoAberta(false);
      onCancelado();
    });
  }

  return (
    <>
      <Popover open={open} onOpenChange={alternarPopover}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent align="start" className={evento.compartilhadoComUsuario ? "max-h-[80vh] w-[min(94vw,46rem)] overflow-y-auto border-white/10 bg-[#202124] p-0 text-slate-100 shadow-2xl shadow-black/60" : undefined}>
          <div className="space-y-3 p-4">
            <div className="flex items-start gap-2">
              <span
                className="mt-1.5 size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: evento.calendarioCorHex ?? COR_CALENDARIO_PADRAO }}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className={evento.recusadoPeloUsuario ? "font-bold leading-snug text-white line-through opacity-60" : "font-bold leading-snug text-white"}>{evento.titulo || "(sem título)"}</p>
                <p className="text-xs text-slate-500">{evento.compartilhadoComUsuario ? "Evento compartilhado com você" : evento.calendarioNome}</p>
              </div>
            </div>
            <div className="space-y-1.5 text-sm text-slate-300">
              <p>
                <span className="text-slate-500">Quando: </span>
                {evento.diaInteiro
                  ? "Dia inteiro"
                  : evento.inicioEm && evento.fimEm
                    ? `${formatarHora(new Date(evento.inicioEm))} – ${formatarHora(new Date(evento.fimEm))}`
                    : "—"}
              </p>
              <p>
                <span className="text-slate-500">Status: </span>
                {evento.recusadoPeloUsuario ? "Você recusou" : evento.status === "tentative" ? "Provisório" : evento.status === "cancelled" ? "Cancelado" : "Confirmado"}
              </p>
            </div>
            {evento.compartilhadoComUsuario && carregandoDetalhes && <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300"><Loader2 className="size-4 animate-spin" /> Carregando detalhes do convite…</div>}
            {evento.compartilhadoComUsuario && detalhesCompartilhado && (
              <div className="space-y-4 border-t border-white/10 pt-4">
                {(detalhesCompartilhado.conferencia?.videoUrl ?? evento.linkMeet) && (
                  <a href={detalhesCompartilhado.conferencia?.videoUrl ?? evento.linkMeet ?? undefined} target="_blank" rel="noopener noreferrer" className="flex w-fit items-center gap-2 rounded-full bg-[#a8c7fa] px-5 py-3 text-sm font-bold text-[#062e6f] transition hover:brightness-105"><Video className="size-4" /> Entrar com o Google Meet</a>
                )}
                {detalhesCompartilhado.conferencia?.telefones.map((telefone) => <a key={telefone} href={telefone} className="flex items-center gap-2 text-sm font-semibold text-[#a8c7fa] hover:underline"><Phone className="size-4" /> {telefone.replace(/^tel:/, "")}</a>)}
                {detalhesCompartilhado.localizacao && <p className="flex items-start gap-2 text-sm text-slate-200"><MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" /> {detalhesCompartilhado.localizacao}</p>}
                {detalhesCompartilhado.descricao && <p className="whitespace-pre-wrap border-l-2 border-white/15 pl-3 text-sm leading-relaxed text-slate-300">{detalhesCompartilhado.descricao}</p>}
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-bold text-slate-100"><Users className="size-4 text-slate-400" /> {detalhesCompartilhado.participantes.length} convidado(s)</p>
                  <div className="space-y-2">
                    {detalhesCompartilhado.participantes.map((participante) => (
                      <div key={participante.email} className="flex items-center gap-2 rounded-lg px-1 py-1">
                        <CircleUserRound className="size-6 shrink-0 text-slate-400" />
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-100">{participante.nome || participante.email || "Convidado"}{participante.organizador ? " · Organizador" : ""}</span>
                        <span className="flex items-center gap-1 text-xs text-slate-400"><IconeResposta status={participante.status} /> {rotuloResposta(participante.status)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {!evento.compartilhadoComUsuario && evento.linkMeet && (
              <a href={evento.linkMeet} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-emerald-300 hover:bg-emerald-500/20">
                <Video className="size-3.5" /> Entrar no Google Meet
              </a>
            )}
            {!evento.calendarioGravavel && (
              <p className="text-[11px] text-amber-400">Agenda somente leitura — sem edição ou cancelamento.</p>
            )}
            {evento.calendarioGravavel && (
              <div className="flex items-center gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => { setOpen(false); onEditar(evento); }}>
                  <Pencil className="mr-1.5 size-3.5" /> Editar
                </Button>
                <Button type="button" variant="destructive" size="sm" className="flex-1" disabled={isPending} onClick={() => void prepararCancelamento()}>
                  {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="mr-1.5 size-3.5" />} Cancelar
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <AgendaModal3D
        open={confirmacaoAberta}
        onOpenChange={setConfirmacaoAberta}
        tema={tema}
        title="Cancelar este evento?"
        description="O Google poderá notificar os participantes. Esta ação não pode ser desfeita por aqui."
        size="sm"
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setConfirmacaoAberta(false)} disabled={isPending}>Voltar</Button>
            <Button type="button" variant="destructive" onClick={cancelar} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />} Sim, cancelar evento
            </Button>
          </div>
        )}
      >
        <p className="text-sm leading-relaxed text-slate-300">
          O cancelamento usa a versão atual do evento para impedir que uma alteração mais recente seja apagada.
        </p>
      </AgendaModal3D>
    </>
  );
}
