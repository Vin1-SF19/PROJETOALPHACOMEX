"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2, Video } from "lucide-react";

import { cancelarEventoParaColega } from "@/actions/google-calendar-admin";
import { cancelarEventoNoCalendario } from "@/actions/google-calendar-eventos";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { TemaAlpha } from "@/lib/temas";

import { formatarHora } from "./lib/datas";
import { COR_CALENDARIO_PADRAO, type EventoExibicao } from "./lib/tipos";

/** Substitui o antigo Sheet lateral de detalhe — painel flutuante que abre só ao clicar no evento. */
export function DetalhePopover({
  evento,
  tema,
  onEditar,
  onCancelado,
  children,
}: {
  evento: EventoExibicao;
  tema: TemaAlpha;
  onEditar: (evento: EventoExibicao) => void;
  onCancelado: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function cancelar() {
    startTransition(async () => {
      const resultado = evento.colegaId
        ? await cancelarEventoParaColega(evento.colegaId, {
            calendarId: evento.calendarioGoogleId,
            googleEventId: evento.googleEventId,
          })
        : await cancelarEventoNoCalendario({
            calendarId: evento.calendarioGoogleId,
            googleEventId: evento.googleEventId,
          });
      if (!resultado.success) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Evento cancelado.");
      setOpen(false);
      onCancelado();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start">
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-2">
            <span
              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: evento.calendarioCorHex ?? COR_CALENDARIO_PADRAO }}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="font-bold leading-snug text-white">{evento.titulo || "(sem título)"}</p>
              <p className="text-xs text-slate-500">{evento.calendarioNome}</p>
            </div>
          </div>

          <div className="text-sm text-slate-300 space-y-1.5">
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
              {evento.status === "tentative" ? "Provisório" : evento.status === "cancelled" ? "Cancelado" : "Confirmado"}
            </p>
          </div>

          {evento.linkMeet && (
            <a
              href={evento.linkMeet}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-emerald-300 hover:bg-emerald-500/20 transition-colors"
            >
              <Video className="w-3.5 h-3.5" /> Entrar no Google Meet
            </a>
          )}

          {!evento.calendarioGravavel && (
            <p className="text-[11px] text-amber-400">Calendário somente leitura — sem edição/cancelamento.</p>
          )}

          {evento.calendarioGravavel && (
            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setOpen(false);
                  onEditar(evento);
                }}
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" size="sm" className="flex-1" disabled={isPending}>
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                    Cancelar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar este evento?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O evento será cancelado na sua Google Agenda. Participantes podem ser notificados pelo
                      próprio Google. Esta ação não pode ser desfeita por aqui.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction onClick={cancelar} className={cn(tema.bg)}>
                      Sim, cancelar evento
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
