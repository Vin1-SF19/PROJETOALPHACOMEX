"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { atualizarEventoParaColega } from "@/actions/google-calendar-admin";
import { atualizarEventoNoCalendario, criarEventoNoCalendario } from "@/actions/google-calendar-eventos";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { TemaAlpha } from "@/lib/temas";
import { cn } from "@/lib/utils";

import type { CalendarioSelecionadoView, EventoExibicao } from "./lib/tipos";

const TIMEZONE_PADRAO = "America/Sao_Paulo";

function paraInputDatetimeLocal(data: Date): string {
  const offset = data.getTimezoneOffset();
  const local = new Date(data.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function somarUmaHora(valor: string): string {
  const data = new Date(valor);
  data.setHours(data.getHours() + 1);
  return paraInputDatetimeLocal(data);
}

export function FormularioEvento({
  open,
  onOpenChange,
  tema,
  calendarios,
  dataInicial,
  eventoParaEditar,
  onSalvo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tema: TemaAlpha;
  calendarios: CalendarioSelecionadoView[];
  dataInicial: Date;
  eventoParaEditar?: EventoExibicao;
  onSalvo: () => void;
}) {
  const calendariosGravaveis = calendarios.filter((c) => c.gravavel);
  const editandoEventoDeColega = Boolean(eventoParaEditar?.colegaId);
  const [isPending, startTransition] = useTransition();

  const inicioPadrao = paraInputDatetimeLocal(eventoParaEditar?.inicioEm ? new Date(eventoParaEditar.inicioEm) : dataInicial);
  const [calendarId, setCalendarId] = useState(eventoParaEditar?.calendarioGoogleId ?? calendariosGravaveis[0]?.googleCalendarId ?? "");
  const [titulo, setTitulo] = useState(eventoParaEditar?.titulo ?? "");
  const [inicio, setInicio] = useState(inicioPadrao);
  const [fim, setFim] = useState(
    paraInputDatetimeLocal(eventoParaEditar?.fimEm ? new Date(eventoParaEditar.fimEm) : new Date(dataInicial.getTime() + 3600000)),
  );
  const [diaInteiro, setDiaInteiro] = useState(eventoParaEditar?.diaInteiro ?? false);
  const [localizacao, setLocalizacao] = useState("");
  const [descricao, setDescricao] = useState("");
  const [participantes, setParticipantes] = useState("");
  const [criarMeet, setCriarMeet] = useState(false);
  const [conflito, setConflito] = useState(false);

  const emEdicao = Boolean(eventoParaEditar);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!calendarId) {
      toast.error("Selecione um calendário.");
      return;
    }
    if (!titulo.trim()) {
      toast.error("Título é obrigatório.");
      return;
    }

    const listaParticipantes = participantes
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);

    startTransition(async () => {
      const payloadBase = {
        calendarId,
        titulo,
        descricaoGoogle: descricao || undefined,
        localizacao: localizacao || undefined,
        timezone: TIMEZONE_PADRAO,
        diaInteiro,
        inicio: new Date(inicio),
        fim: new Date(fim),
        participantes: listaParticipantes,
        criarMeet,
      };

      if (emEdicao && eventoParaEditar) {
        const payloadEdicao = {
          ...payloadBase,
          googleEventId: eventoParaEditar.googleEventId,
          etagConhecido: eventoParaEditar.etag,
        };
        const resultado = eventoParaEditar.colegaId
          ? await atualizarEventoParaColega(eventoParaEditar.colegaId, payloadEdicao)
          : await atualizarEventoNoCalendario(payloadEdicao);

        if (!resultado.success) {
          toast.error(resultado.error);
          return;
        }
        if (resultado.data.conflito) {
          setConflito(true);
          toast.error("Este evento mudou no Google desde que você abriu. Recarregue antes de salvar.");
          return;
        }
        toast.success("Evento atualizado.");
      } else {
        const resultado = await criarEventoNoCalendario(payloadBase);
        if (!resultado.success) {
          toast.error(resultado.error);
          return;
        }
        toast.success("Evento criado.");
      }

      onSalvo();
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{emEdicao ? "Editar evento" : "Novo evento"}</SheetTitle>
          <SheetDescription>Sincronizado com sua conta Google Agenda.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 space-y-4">
          {conflito && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              O evento foi alterado no Google depois que você abriu esta tela. Feche e reabra para ver a versão atual.
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ca-calendario">Calendário</Label>
            {editandoEventoDeColega ? (
              <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
                Agenda de {eventoParaEditar?.calendarioNome}
              </p>
            ) : (
              <Select value={calendarId} onValueChange={setCalendarId} disabled={emEdicao}>
                <SelectTrigger id="ca-calendario" className="w-full">
                  <SelectValue placeholder="Selecione um calendário" />
                </SelectTrigger>
                <SelectContent>
                  {calendariosGravaveis.map((c) => (
                    <SelectItem key={c.googleCalendarId} value={c.googleCalendarId}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ca-titulo">Título</Label>
            <Input id="ca-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={300} required />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="ca-dia-inteiro"
              checked={diaInteiro}
              onCheckedChange={(valor) => setDiaInteiro(valor === true)}
            />
            <Label htmlFor="ca-dia-inteiro" className="cursor-pointer">Dia inteiro</Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ca-inicio">Início</Label>
              <Input
                id="ca-inicio"
                type={diaInteiro ? "date" : "datetime-local"}
                value={diaInteiro ? inicio.slice(0, 10) : inicio}
                onChange={(e) => {
                  const novoInicio = diaInteiro ? `${e.target.value}T00:00` : e.target.value;
                  setInicio(novoInicio);
                  setFim((fimAtual) => (new Date(fimAtual) <= new Date(novoInicio) ? somarUmaHora(novoInicio) : fimAtual));
                }}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ca-fim">Fim</Label>
              <Input
                id="ca-fim"
                type={diaInteiro ? "date" : "datetime-local"}
                value={diaInteiro ? fim.slice(0, 10) : fim}
                onChange={(e) => setFim(diaInteiro ? `${e.target.value}T00:00` : e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ca-local">Localização (opcional)</Label>
            <Input id="ca-local" value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} maxLength={300} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ca-descricao">Descrição (opcional)</Label>
            <textarea
              id="ca-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              maxLength={8000}
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ca-participantes">Participantes (e-mails separados por vírgula)</Label>
            <Input
              id="ca-participantes"
              value={participantes}
              onChange={(e) => setParticipantes(e.target.value)}
              placeholder="fulano@empresa.com, ciclana@empresa.com"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="ca-meet" checked={criarMeet} onCheckedChange={(valor) => setCriarMeet(valor === true)} />
            <Label htmlFor="ca-meet" className="cursor-pointer">Criar link do Google Meet</Label>
          </div>
        </form>

        <SheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={isPending} className={cn(tema.bg, "text-white")}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {emEdicao ? "Salvar alterações" : "Criar evento"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
