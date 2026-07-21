"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { definirCalendarioSelecionado, personalizarCorCalendario } from "@/actions/google-calendar-eventos";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { TemaAlpha } from "@/lib/temas";
import { cn } from "@/lib/utils";

import type { GoogleCalendarioDTO } from "@/lib/google-calendar/types";
import { COR_CALENDARIO_PADRAO, type CalendarioSelecionadoView } from "./lib/tipos";

export function SeletorCalendarios({
  open,
  onOpenChange,
  tema,
  conexaoId,
  calendariosGoogle,
  calendariosSelecionados,
  onAtualizado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tema: TemaAlpha;
  conexaoId: string;
  calendariosGoogle: GoogleCalendarioDTO[];
  calendariosSelecionados: CalendarioSelecionadoView[];
  onAtualizado: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [emAndamento, setEmAndamento] = useState<string | null>(null);

  const mapaSelecionados = new Map(calendariosSelecionados.map((c) => [c.googleCalendarId, c]));

  function alternarVisivel(googleCalendarId: string, papelAcesso: GoogleCalendarioDTO["papelAcesso"], novoValor: boolean) {
    setEmAndamento(googleCalendarId);
    const atual = mapaSelecionados.get(googleCalendarId);
    startTransition(async () => {
      await definirCalendarioSelecionado({
        conexaoId,
        googleCalendarId,
        visivel: novoValor,
        gravavel: atual?.gravavel ?? (papelAcesso === "owner" || papelAcesso === "writer"),
      });
      setEmAndamento(null);
      onAtualizado();
    });
  }

  function personalizarCor(calendarioId: string, corHex: string) {
    startTransition(async () => {
      await personalizarCorCalendario(calendarioId, corHex);
      onAtualizado();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Calendários</SheetTitle>
          <SheetDescription>Escolha quais calendários do Google aparecem no Painel.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
          {calendariosGoogle.length === 0 && (
            <p className="text-sm text-slate-500 py-6 text-center">Nenhum calendário encontrado na sua conta Google.</p>
          )}
          {calendariosGoogle.map((calendario) => {
            const selecionado = mapaSelecionados.get(calendario.googleCalendarId);
            const visivel = selecionado?.visivel ?? false;
            const podeEscrever = calendario.papelAcesso === "owner" || calendario.papelAcesso === "writer";

            return (
              <div
                key={calendario.googleCalendarId}
                className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3"
              >
                {selecionado ? (
                  <input
                    type="color"
                    value={selecionado.corHex ?? COR_CALENDARIO_PADRAO}
                    onChange={(e) => personalizarCor(selecionado.id, e.target.value)}
                    aria-label={`Cor do calendário ${calendario.nome}`}
                    title="Personalizar cor"
                    className="h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
                  />
                ) : (
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: calendario.corHex ?? COR_CALENDARIO_PADRAO }}
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{calendario.nome}</p>
                  <p className="text-[11px] text-slate-500">
                    {podeEscrever ? "Leitura e escrita" : "Somente leitura"}
                    {calendario.principal ? " · Principal" : ""}
                  </p>
                </div>
                {isPending && emAndamento === calendario.googleCalendarId ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                ) : (
                  <Switch
                    checked={visivel}
                    onCheckedChange={(valor) => alternarVisivel(calendario.googleCalendarId, calendario.papelAcesso, valor)}
                    aria-label={`Mostrar calendário ${calendario.nome} no Painel`}
                    className={cn(visivel && tema.bg)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
