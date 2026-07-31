"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  PauseCircle,
  RefreshCw,
  Unplug,
} from "lucide-react";
import Image from "next/image";

import type { ResumoSincronizacaoAgenda } from "@/actions/google-calendar-sync";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { TemaAlpha } from "@/lib/temas";
import { cn } from "@/lib/utils";

import { useAgendaDesktop } from "./lib/useAgendaDesktop";

interface StatusSincronizacaoProps {
  tema: TemaAlpha;
  emailUsuario?: string;
  ultimaSincronizacaoEm?: string | null;
  sincronizando: boolean;
  erro?: string | null;
  erroCompartilhadas?: string | null;
  resumo?: ResumoSincronizacaoAgenda | null;
  onSincronizar: () => Promise<void> | void;
  onDesativar: () => void;
}

function formatarUltimaSincronizacao(valor?: string | null): string {
  if (!valor) return "Aguardando a primeira sincronização";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "Horário da sincronização indisponível";
  return `Última sincronização ${new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(data)}`;
}

function rotuloStatus(status?: string): string {
  const rotulos: Record<string, string> = {
    sucesso: "Sincronizado",
    parcial: "Concluído com pendências",
    erro: "Falha na sincronização",
    cooldown: "Aguardando intervalo seguro",
    em_andamento: "Sincronização já em andamento",
    sem_calendarios: "Nenhuma agenda selecionada",
    sincronizado: "Sincronizado",
  };
  return status ? rotulos[status] ?? status.replaceAll("_", " ") : "Sincronizado";
}

function IconeStatus({ status, carregando }: { status?: string; carregando?: boolean }) {
  if (carregando || status === "em_andamento") return <Loader2 className="size-4 animate-spin" />;
  if (status === "cooldown") return <PauseCircle className="size-4 text-amber-400" />;
  if (status === "erro" || status === "parcial") return <AlertTriangle className="size-4 text-amber-400" />;
  return <CheckCircle2 className="size-4 text-emerald-400" />;
}

export function StatusSincronizacao({
  tema,
  emailUsuario,
  ultimaSincronizacaoEm,
  sincronizando,
  erro,
  erroCompartilhadas,
  resumo,
  onSincronizar,
  onDesativar,
}: StatusSincronizacaoProps) {
  const isDesktop = useAgendaDesktop();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const emSincronizacao = sincronizando || isPending;
  const statusAtual = erro ? "erro" : resumo?.status;
  const textoStatus = emSincronizacao ? "Sincronizando…" : rotuloStatus(statusAtual);

  function sincronizarAgora() {
    startTransition(async () => {
      await onSincronizar();
    });
  }

  const trigger = (
    <button
      type="button"
      aria-label={`Status: ${textoStatus}`}
      className="flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    >
      <IconeStatus status={statusAtual} carregando={emSincronizacao} />
      <span className="hidden xl:inline">{textoStatus}</span>
    </button>
  );

  const content = (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.025] p-3">
        <IconeStatus status={statusAtual} carregando={emSincronizacao} />
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">{textoStatus}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {formatarUltimaSincronizacao(ultimaSincronizacaoEm)}
          </p>
        </div>
      </div>

      {resumo && (
        <>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-white/5 bg-white/[0.025] p-2.5">
              <p className="text-slate-500">Agendas</p>
              <p className="mt-1 font-bold text-white">
                {resumo.contadores.calendariosSincronizados}/{resumo.contadores.calendariosSolicitados}
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.025] p-2.5">
              <p className="text-slate-500">Eventos atualizados</p>
              <p className="mt-1 font-bold text-white">{resumo.contadores.eventosAtualizados}</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.025] p-2.5">
              <p className="text-slate-500">Em espera</p>
              <p className="mt-1 font-bold text-white">{resumo.contadores.calendariosEmCooldown}</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.025] p-2.5">
              <p className="text-slate-500">Em andamento</p>
              <p className="mt-1 font-bold text-white">{resumo.contadores.calendariosEmAndamento}</p>
            </div>
          </div>
          <div className="max-h-44 space-y-1.5 overflow-y-auto">
            {resumo.calendarios.map((calendario) => (
              <div key={calendario.calendarioId} className="flex items-center gap-2 rounded-xl border border-white/5 px-3 py-2">
                <IconeStatus status={calendario.resultado.status} />
                <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{calendario.nome}</span>
                <span className="text-[10px] text-slate-500">{rotuloStatus(calendario.resultado.status)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {(erro || erroCompartilhadas || resumo?.erros.length) ? (
        <div className="space-y-1 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
          <p className="font-bold">Pendências de sincronização</p>
          {erro && <p>{erro}</p>}
          {erroCompartilhadas && <p>Compartilhadas: {erroCompartilhadas}</p>}
          {resumo?.erros.map((item) => <p key={item.calendarioId}>{item.nome}: {item.mensagem}</p>)}
        </div>
      ) : null}

      <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.025] p-3">
        {emailUsuario ? <Image src="/google.png" alt="" width={20} height={20} /> : <Unplug className="size-5 text-slate-500" />}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">Conta Google</p>
          <p className="truncate text-xs text-slate-300">{emailUsuario ?? "Conta não identificada"}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={sincronizarAgora} disabled={emSincronizacao} className={cn("flex-1 gap-2 text-white", tema.bg)}>
          {emSincronizacao ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {emSincronizacao ? "Sincronizando…" : "Sincronizar agora"}
        </Button>
        <Button type="button" variant="outline" onClick={() => { setOpen(false); onDesativar(); }} className="gap-2 border-rose-500/20 text-rose-300 hover:bg-rose-500/10">
          <Clock3 className="size-4" /> Desativar
        </Button>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent align="end" className="w-[28rem] p-4">{content}</PopoverContent>
      </Popover>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[88dvh] rounded-t-[2rem]">
        <SheetHeader>
          <SheetTitle>Status da sincronização</SheetTitle>
          <SheetDescription>Resultado por agenda, conta conectada e ações de recuperação.</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-5 pb-5">{content}</div>
      </SheetContent>
    </Sheet>
  );
}
