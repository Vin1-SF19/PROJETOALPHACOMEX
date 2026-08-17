"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { definirCalendarioSelecionado, personalizarCorCalendario } from "@/actions/google-calendar-eventos";
import { Switch } from "@/components/ui/switch";
import type { GoogleCalendarioDTO } from "@/lib/google-calendar/types";
import type { TemaAlpha } from "@/lib/temas";
import { cn } from "@/lib/utils";

import { AgendaModal3D } from "./AgendaModal3D";
import { COR_CALENDARIO_PADRAO, type CalendarioSelecionadoView } from "./lib/tipos";
import { SeletorCorPaleta } from "./SeletorCorPaleta";

interface SeletorCalendariosProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tema: TemaAlpha;
  conexaoId: string;
  calendariosGoogle: GoogleCalendarioDTO[];
  calendariosSelecionados: CalendarioSelecionadoView[];
  onAtualizado: () => void;
}

export function SeletorCalendarios({
  open,
  onOpenChange,
  tema,
  conexaoId,
  calendariosGoogle,
  calendariosSelecionados,
  onAtualizado,
}: SeletorCalendariosProps) {
  const [isPending, startTransition] = useTransition();
  const [emAndamento, setEmAndamento] = useState<string | null>(null);
  const mapaSelecionados = new Map(calendariosSelecionados.map((calendario) => [calendario.googleCalendarId, calendario]));

  function alternarVisivel(
    googleCalendarId: string,
    papelAcesso: GoogleCalendarioDTO["papelAcesso"],
    novoValor: boolean,
  ) {
    setEmAndamento(googleCalendarId);
    const atual = mapaSelecionados.get(googleCalendarId);
    startTransition(async () => {
      const resultado = await definirCalendarioSelecionado({
        conexaoId,
        googleCalendarId,
        visivel: novoValor,
        gravavel: atual?.gravavel ?? (papelAcesso === "owner" || papelAcesso === "writer"),
      });
      setEmAndamento(null);
      if (!resultado.success) {
        toast.error(resultado.error);
        return;
      }
      onAtualizado();
    });
  }

  function personalizarCor(calendarioId: string, corHex: string) {
    startTransition(async () => {
      const resultado = await personalizarCorCalendario(calendarioId, corHex);
      if (!resultado.success) {
        toast.error(resultado.error);
        return;
      }
      onAtualizado();
    });
  }

  return (
    <AgendaModal3D
      open={open}
      onOpenChange={onOpenChange}
      tema={tema}
      title="Agendas"
      description="Escolha quais agendas do Google aparecem no Painel."
      size="md"
    >
      <div className="space-y-2">
        {calendariosGoogle.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">Nenhuma agenda encontrada na sua conta Google.</p>
        )}
        {calendariosGoogle.map((calendario) => {
          const selecionado = mapaSelecionados.get(calendario.googleCalendarId);
          const visivel = selecionado?.visivel ?? false;
          const podeEscrever = calendario.papelAcesso === "owner" || calendario.papelAcesso === "writer";
          return (
            <div key={calendario.googleCalendarId} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.025] px-4 py-3">
              {selecionado ? (
                <SeletorCorPaleta
                  corAtual={selecionado.corHex ?? COR_CALENDARIO_PADRAO}
                  onEscolher={(cor) => personalizarCor(selecionado.id, cor)}
                  label={`Cor da agenda ${calendario.nome}`}
                />
              ) : (
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: calendario.corHex ?? COR_CALENDARIO_PADRAO }} aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{calendario.nome}</p>
                <p className="text-[11px] text-slate-500">
                  {podeEscrever ? "Leitura e escrita" : "Somente leitura"}{calendario.principal ? " · Principal" : ""}
                </p>
              </div>
              {isPending && emAndamento === calendario.googleCalendarId ? (
                <Loader2 className="size-4 animate-spin text-slate-500" />
              ) : (
                <Switch checked={visivel} onCheckedChange={(valor) => alternarVisivel(calendario.googleCalendarId, calendario.papelAcesso, valor)} aria-label={`Mostrar agenda ${calendario.nome}`} className={cn(visivel && tema.bg)} />
              )}
            </div>
          );
        })}
      </div>
    </AgendaModal3D>
  );
}
