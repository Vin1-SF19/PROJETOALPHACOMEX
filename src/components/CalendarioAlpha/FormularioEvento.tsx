"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Bell, Clock3, Loader2, MapPin, UsersRound, Video } from "lucide-react";
import { toast } from "sonner";

import { atualizarEventoParcialParaColega } from "@/actions/google-calendar-admin";
import {
  atualizarEventoParcialNoCalendario,
  criarEventoNoCalendario,
} from "@/actions/google-calendar-eventos";
import { atualizarTarefaAgendaAlpha, criarTarefaAgendaAlpha } from "@/actions/google-calendar-tarefas";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GoogleEventoDTO } from "@/lib/google-calendar/types";
import type { TemaAlpha } from "@/lib/temas";
import { cn } from "@/lib/utils";
import type { AtualizarEventoParcialInput } from "@/lib/validations/google-calendar";

import { AgendaModal3D } from "./AgendaModal3D";
import type { CalendarioSelecionadoView, EventoExibicao, ListaTarefasAgendaView } from "./lib/tipos";

const TIMEZONE_PADRAO = "America/Sao_Paulo";
const TIPOS_EVENTO = [
  ["default", "Evento"], ["task", "Tarefa"], ["outOfOffice", "Ausente"],
  ["focusTime", "Hora de foco"], ["workingLocation", "Local de trabalho"],
] as const;

interface FormularioEventoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tema: TemaAlpha;
  calendarios: CalendarioSelecionadoView[];
  dataInicial: Date;
  eventoParaEditar?: EventoExibicao;
  detalhesEvento?: GoogleEventoDTO;
  listasTarefas: ListaTarefasAgendaView[];
  onSalvo: () => void;
}

function paraInputDatetimeLocal(data: Date): string {
  const offset = data.getTimezoneOffset();
  return new Date(data.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function dataDoGoogle(
  detalhe: GoogleEventoDTO["inicio"] | GoogleEventoDTO["fim"] | undefined,
): Date | null {
  if (detalhe?.dataHora) return new Date(detalhe.dataHora);
  if (detalhe?.data) return new Date(`${detalhe.data}T00:00:00`);
  return null;
}

function somarUmaHora(valor: string): string {
  const data = new Date(valor);
  data.setHours(data.getHours() + 1);
  return paraInputDatetimeLocal(data);
}

function emailsNormalizados(valor: string): string[] {
  return Array.from(
    new Set(valor.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean)),
  ).sort();
}

function listasIguais(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((valor, indice) => valor === b[indice]);
}

export function FormularioEvento({
  open,
  onOpenChange,
  tema,
  calendarios,
  dataInicial,
  eventoParaEditar,
  detalhesEvento,
  listasTarefas,
  onSalvo,
}: FormularioEventoProps) {
  const calendariosGravaveis = calendarios.filter((calendario) => calendario.gravavel);
  const editandoEventoDeColega = Boolean(eventoParaEditar?.colegaId);
  const emEdicao = Boolean(eventoParaEditar);
  const editandoTarefa = eventoParaEditar?.tipo === "tarefa";
  const [isPending, startTransition] = useTransition();
  const inicioDetalhado = dataDoGoogle(detalhesEvento?.inicio);
  const fimDetalhado = dataDoGoogle(detalhesEvento?.fim);
  const inicioPadrao = inicioDetalhado ?? (eventoParaEditar?.inicioEm ? new Date(eventoParaEditar.inicioEm) : dataInicial);
  const fimPadrao = fimDetalhado ?? (eventoParaEditar?.fimEm ? new Date(eventoParaEditar.fimEm) : new Date(dataInicial.getTime() + 3600000));
  const [calendarId, setCalendarId] = useState(eventoParaEditar?.calendarioGoogleId ?? calendariosGravaveis[0]?.googleCalendarId ?? "");
  const [titulo, setTitulo] = useState(detalhesEvento?.titulo ?? eventoParaEditar?.titulo ?? "");
  const [inicio, setInicio] = useState(paraInputDatetimeLocal(inicioPadrao));
  const [fim, setFim] = useState(paraInputDatetimeLocal(fimPadrao));
  const [diaInteiro, setDiaInteiro] = useState(detalhesEvento?.diaInteiro ?? eventoParaEditar?.diaInteiro ?? false);
  const [localizacao, setLocalizacao] = useState(detalhesEvento?.localizacao ?? "");
  const [descricao, setDescricao] = useState(detalhesEvento?.descricao ?? eventoParaEditar?.tarefaNotas ?? "");
  const participantesIniciais = detalhesEvento?.participantes
    .filter((participante) => !participante.organizador)
    .map((participante) => participante.email)
    .sort() ?? [];
  const [participantes, setParticipantes] = useState(
    participantesIniciais.join(", "),
  );
  const [criarMeet, setCriarMeet] = useState(false);
  const [eventType, setEventType] = useState<"default" | "focusTime" | "outOfOffice" | "workingLocation" | "task">(
    editandoTarefa ? "task" : detalhesEvento?.eventType === "focusTime" || detalhesEvento?.eventType === "outOfOffice" || detalhesEvento?.eventType === "workingLocation"
      ? detalhesEvento.eventType
      : "default",
  );
  const [taskListId, setTaskListId] = useState(listasTarefas[0]?.googleTaskListId ?? "");
  const [repeticao, setRepeticao] = useState("nunca");
  const [visibilidade, setVisibilidade] = useState<"default" | "private" | "public">("default");
  const [disponibilidade, setDisponibilidade] = useState<"opaque" | "transparent">("opaque");
  const [lembreteMinutos, setLembreteMinutos] = useState("30");
  const [conflito, setConflito] = useState(false);

  function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (eventType !== "task" && !calendarId) return toast.error("Selecione uma agenda.");
    if (!titulo.trim()) return toast.error("Título é obrigatório.");

    const listaParticipantes = emailsNormalizados(participantes);
    const recorrenciaRegras = repeticao === "nunca" ? undefined : [
      repeticao === "diaria" ? "RRULE:FREQ=DAILY" : repeticao === "semanal" ? "RRULE:FREQ=WEEKLY" : repeticao === "mensal" ? "RRULE:FREQ=MONTHLY" : "RRULE:FREQ=YEARLY",
    ];
    startTransition(async () => {
      if (eventType === "task") {
        if (!editandoTarefa && !taskListId) {
          toast.error("Sincronize as tarefas antes de criar a primeira tarefa.");
          return;
        }
        const resultado = editandoTarefa && eventoParaEditar?.tarefaCacheId
          ? await atualizarTarefaAgendaAlpha({
            tarefaCacheId: eventoParaEditar.tarefaCacheId,
            titulo,
            notas: descricao || undefined,
            vencimentoEm: new Date(`${inicio.slice(0, 10)}T12:00:00`),
          })
          : await criarTarefaAgendaAlpha({
            taskListId,
            titulo,
            notas: descricao || undefined,
            vencimentoEm: new Date(`${inicio.slice(0, 10)}T12:00:00`),
          });
        if (!resultado.success) {
          toast.error(resultado.error);
          return;
        }
        toast.success(editandoTarefa ? "Tarefa atualizada." : "Tarefa criada.");
        onSalvo();
        onOpenChange(false);
        return;
      }
      const payloadBase = {
        calendarId,
        titulo,
        descricaoGoogle: descricao || undefined,
        localizacao: localizacao || undefined,
        timezone: detalhesEvento?.inicio.timezone ?? TIMEZONE_PADRAO,
        diaInteiro,
        inicio: new Date(inicio),
        fim: new Date(fim),
        participantes: listaParticipantes,
        criarMeet: eventType === "default" && criarMeet,
        eventType,
        recorrenciaRegras,
        visibilidade,
        transparencia: disponibilidade,
        lembretesMinutos: lembreteMinutos === "nenhum" ? [] : [Number(lembreteMinutos)],
      };

      if (emEdicao && eventoParaEditar) {
        const inicioInicial = inicioDetalhado ?? inicioPadrao;
        const fimInicial = fimDetalhado ?? fimPadrao;
        const tempoAlterado =
          new Date(inicio).getTime() !== inicioInicial.getTime() ||
          new Date(fim).getTime() !== fimInicial.getTime() ||
          diaInteiro !== (detalhesEvento?.diaInteiro ?? eventoParaEditar.diaInteiro);
        const payloadEdicao: AtualizarEventoParcialInput = {
          calendarId,
          googleEventId: eventoParaEditar.googleEventId,
          etagConhecido: detalhesEvento?.etag ?? eventoParaEditar.etag,
          ...(titulo.trim() !== (detalhesEvento?.titulo ?? eventoParaEditar.titulo ?? "")
            ? { titulo }
            : {}),
          ...(descricao !== (detalhesEvento?.descricao ?? "") ? { descricaoGoogle: descricao } : {}),
          ...(localizacao !== (detalhesEvento?.localizacao ?? "") ? { localizacao } : {}),
          ...(tempoAlterado
            ? {
                timezone: detalhesEvento?.inicio.timezone ?? TIMEZONE_PADRAO,
                diaInteiro,
                inicio: new Date(inicio),
                fim: new Date(fim),
              }
            : {}),
          ...(!listasIguais(listaParticipantes, participantesIniciais)
            ? { participantes: listaParticipantes }
            : {}),
          ...(!detalhesEvento?.linkMeet && criarMeet ? { criarMeet: true as const } : {}),
        };
        if (Object.keys(payloadEdicao).length === 3) {
          toast.info("Nenhuma alteração para salvar.");
          onOpenChange(false);
          return;
        }
        const resultado = eventoParaEditar.colegaId
          ? await atualizarEventoParcialParaColega(eventoParaEditar.colegaId, payloadEdicao)
          : await atualizarEventoParcialNoCalendario(payloadEdicao);
        if (!resultado.success) {
          toast.error(resultado.error);
          return;
        }
        if (resultado.data.conflito) {
          setConflito(true);
          toast.error("O evento mudou no Google. Reabra para carregar a versão atual.");
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

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
        Cancelar
      </Button>
      <Button type="submit" form="formulario-evento-agenda" disabled={isPending} className={cn(tema.bg, "text-white")}>
        {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
        {emEdicao ? "Salvar alterações" : eventType === "task" ? "Criar tarefa" : "Criar evento"}
      </Button>
    </div>
  );

  return (
    <AgendaModal3D
      open={open}
      onOpenChange={onOpenChange}
      tema={tema}
      title={emEdicao ? editandoTarefa ? "Editar tarefa" : "Editar evento" : eventType === "task" ? "Nova tarefa" : "Novo evento"}
      description={eventType === "task" ? "Sincronizado com o Google Tasks." : "Sincronizado com sua conta Google Calendar."}
      footer={footer}
      size="md"
    >
      <form id="formulario-evento-agenda" onSubmit={handleSubmit} className="space-y-4">
        {conflito && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            O evento foi alterado depois que esta janela abriu. Feche e reabra antes de salvar.
          </div>
        )}

        {!emEdicao && (
          <div className="flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-white/[0.035] p-1.5">
            {TIPOS_EVENTO.map(([valor, rotulo]) => <button key={valor} type="button" onClick={() => setEventType(valor)} className={cn("rounded-xl px-3 py-2 text-sm font-bold transition-colors", eventType === valor ? cn(tema.bg, "text-white shadow-lg") : "text-slate-400 hover:bg-white/10 hover:text-white")}>{rotulo}</button>)}
            {eventType !== "default" && eventType !== "task" && (
              <p className="basis-full px-2 pb-1 text-xs text-slate-400">Este tipo segue as regras e o status definidos pelo Google Calendar.</p>
            )}
          </div>
        )}

        {eventType === "task" ? (
          <div className="space-y-1.5">
            <Label htmlFor="ca-lista-tarefas">Lista de tarefas</Label>
            <Select value={taskListId} onValueChange={setTaskListId} disabled={editandoTarefa}>
              <SelectTrigger id="ca-lista-tarefas" className="w-full"><SelectValue placeholder="Sincronize para carregar as listas" /></SelectTrigger>
              <SelectContent>
                {listasTarefas.map((lista) => (
                  <SelectItem key={lista.googleTaskListId} value={lista.googleTaskListId}>{lista.titulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="ca-calendario">Agenda</Label>
            {editandoEventoDeColega ? (
              <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">Agenda de {eventoParaEditar?.calendarioNome}</p>
            ) : (
              <Select value={calendarId} onValueChange={setCalendarId} disabled={emEdicao}>
                <SelectTrigger id="ca-calendario" className="w-full"><SelectValue placeholder="Selecione uma agenda" /></SelectTrigger>
                <SelectContent>
                  {calendariosGravaveis.map((calendario) => (
                    <SelectItem key={calendario.googleCalendarId} value={calendario.googleCalendarId}>{calendario.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="ca-titulo">Título</Label>
          <Input id="ca-titulo" placeholder="Adicionar título" value={titulo} onChange={(evento) => setTitulo(evento.target.value)} maxLength={300} required className="h-12 border-x-0 border-t-0 rounded-none bg-transparent px-0 text-lg font-semibold" />
        </div>

        {eventType !== "task" && <div className="flex items-center gap-2">
          <Checkbox id="ca-dia-inteiro" checked={diaInteiro} onCheckedChange={(valor) => setDiaInteiro(valor === true)} />
          <Label htmlFor="ca-dia-inteiro" className="cursor-pointer">Dia inteiro</Label>
        </div>}

        {eventType === "task" ? (
          <div className="space-y-1.5">
            <Label htmlFor="ca-vencimento">Data da tarefa</Label>
            <Input id="ca-vencimento" type="date" value={inicio.slice(0, 10)} onChange={(evento) => setInicio(`${evento.target.value}T12:00`)} required />
          </div>
        ) : <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
          <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500"><Clock3 className="size-4" /> Quando</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ca-inicio">Início</Label>
            <Input
              id="ca-inicio"
              type={diaInteiro ? "date" : "datetime-local"}
              value={diaInteiro ? inicio.slice(0, 10) : inicio}
              onChange={(evento) => {
                const novoInicio = diaInteiro ? `${evento.target.value}T00:00` : evento.target.value;
                setInicio(novoInicio);
                setFim((atual) => new Date(atual) <= new Date(novoInicio) ? somarUmaHora(novoInicio) : atual);
              }}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ca-fim">Fim</Label>
            <Input id="ca-fim" type={diaInteiro ? "date" : "datetime-local"} value={diaInteiro ? fim.slice(0, 10) : fim} onChange={(evento) => setFim(diaInteiro ? `${evento.target.value}T00:00` : evento.target.value)} required />
          </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="ca-repeticao">Repetição</Label><Select value={repeticao} onValueChange={setRepeticao}><SelectTrigger id="ca-repeticao"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nunca">Não se repete</SelectItem><SelectItem value="diaria">Todos os dias</SelectItem><SelectItem value="semanal">Toda semana</SelectItem><SelectItem value="mensal">Todo mês</SelectItem><SelectItem value="anual">Todo ano</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label htmlFor="ca-fuso">Fuso horário</Label><Input id="ca-fuso" value={TIMEZONE_PADRAO} readOnly className="text-slate-400" /></div>
          </div>
        </div>}

        {eventType !== "task" && <div className="space-y-1.5">
          <Label htmlFor="ca-local">Localização</Label>
          <div className="relative"><MapPin className="pointer-events-none absolute left-3 top-3 size-4 text-slate-500" /><Input id="ca-local" value={localizacao} onChange={(evento) => setLocalizacao(evento.target.value)} maxLength={300} className="pl-9" placeholder="Adicionar local" /></div>
        </div>}
        <div className="space-y-1.5">
          <Label htmlFor="ca-descricao">Descrição</Label>
          <textarea id="ca-descricao" value={descricao} onChange={(evento) => setDescricao(evento.target.value)} maxLength={8000} rows={4} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20" />
        </div>
        {eventType !== "task" && <div className="space-y-1.5">
          <Label htmlFor="ca-participantes">Participantes (e-mails separados por vírgula)</Label>
          <div className="relative"><UsersRound className="pointer-events-none absolute left-3 top-3 size-4 text-slate-500" /><Input id="ca-participantes" value={participantes} onChange={(evento) => setParticipantes(evento.target.value)} className="pl-9" placeholder="Adicionar convidados: nome@empresa.com" /></div>
        </div>}
        {eventType === "task" || eventType !== "default" ? null : detalhesEvento?.linkMeet ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            Este evento já possui Google Meet. O link será preservado.
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2">
            <Checkbox id="ca-meet" checked={criarMeet} onCheckedChange={(valor) => setCriarMeet(valor === true)} />
            <Video className="size-4 text-slate-400" /><Label htmlFor="ca-meet" className="cursor-pointer">Adicionar videoconferência do Google Meet</Label>
          </div>
        )}
        {eventType !== "task" && <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3 sm:grid-cols-3">
          <div className="space-y-1.5"><Label htmlFor="ca-disponibilidade">Mostrar como</Label><Select value={disponibilidade} onValueChange={(v) => setDisponibilidade(v as typeof disponibilidade)}><SelectTrigger id="ca-disponibilidade"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="opaque">Ocupado</SelectItem><SelectItem value="transparent">Livre</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="ca-visibilidade">Visibilidade</Label><Select value={visibilidade} onValueChange={(v) => setVisibilidade(v as typeof visibilidade)}><SelectTrigger id="ca-visibilidade"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="default">Padrão</SelectItem><SelectItem value="private">Privado</SelectItem><SelectItem value="public">Público</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="ca-lembrete"><Bell className="mr-1 inline size-3.5" />Lembrete</Label><Select value={lembreteMinutos} onValueChange={setLembreteMinutos}><SelectTrigger id="ca-lembrete"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nenhum">Padrão da agenda</SelectItem><SelectItem value="10">10 min antes</SelectItem><SelectItem value="30">30 min antes</SelectItem><SelectItem value="60">1 h antes</SelectItem><SelectItem value="1440">1 dia antes</SelectItem></SelectContent></Select></div>
        </div>}
      </form>
    </AgendaModal3D>
  );
}
