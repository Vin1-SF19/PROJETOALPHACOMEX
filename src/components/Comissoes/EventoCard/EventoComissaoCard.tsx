"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SetorColaboradores } from "./SetorColaboradores";
import { ModalPagarTodos } from "./ModalPagarTodos";
import {
  EVENT_TYPE_LABELS,
  STATUS_LABELS,
  formatarCentavosBRL,
  formatarDataComissao,
  formatarFormaPagamentoComissao,
  traduzirDivergencia,
} from "../lib/formatters";
import { EditorResponsavel } from "../ModalDetalhes/EditorResponsavel";
import { GerarLancamentosAutomaticosEvento } from "@/actions/CommissionEvents";
import type { EventoComLancamentosResult } from "@/actions/CommissionEntries";
import type { TemaAlpha } from "@/lib/temas";

interface EventoComissaoCardProps {
  dados: EventoComLancamentosResult;
  tema: TemaAlpha;
  onAbrirDetalhes: (entryId: string) => void;
  onAtualizar?: () => void;
}

export function EventoComissaoCard({ dados, tema, onAbrirDetalhes, onAtualizar }: EventoComissaoCardProps) {
  const [modalPagarTodosAberto, setModalPagarTodosAberto] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { event, divergencias, setorComercial, setorOperacional, semSetor, totalGeralCents, totalPendenteCents } = dados;
  const entryIds = [...setorComercial, ...setorOperacional, ...semSetor].map((entry) => entry.id);
  const temLancamentos = entryIds.length > 0;

  function gerarLancamentos() {
    startTransition(async () => {
      const resultado = await GerarLancamentosAutomaticosEvento({ eventId: event.id });
      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao gerar lançamentos");
        return;
      }
      if (resultado.data.entriesCreated) {
        toast.success(`${resultado.data.entriesCreated} lançamento(s) gerado(s).`);
      } else {
        toast.warning("Nenhum lançamento novo foi gerado. Verifique elegibilidade e divergências.");
      }
      onAtualizar?.();
    });
  }

  return (
    <article className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-slate-900/40">
      <div className={`absolute inset-x-0 top-0 h-1 ${event.eventType === "PROCESS_SUCCESS" ? "bg-emerald-500" : "bg-blue-500"}`} />

      <div className="grid grid-cols-1 gap-6 p-4 sm:p-6 xl:grid-cols-[minmax(260px,0.9fr)_minmax(0,2fr)_220px]">
        <section className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-white">{event.razaoSocial}</h2>
              {event.nomeFantasia && <p className="truncate text-xs text-slate-500">{event.nomeFantasia}</p>}
            </div>
            <Badge variant="outline" className="border-white/10 text-slate-300">
              {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
            </Badge>
          </div>

          <dl className="mt-4 space-y-1.5 text-xs">
            <Linha label="CNPJ" valor={event.cnpj} />
            <Linha label="Serviço" valor={event.servico} />
            <Linha label="Data da contratação" valor={formatarDataComissao(event.dataContratacao)} />
            <Linha label="Honorários brutos" valor={formatarCentavosBRL(event.grossContractAmountCents)} mono />
            <Linha label="Honorários líquidos" valor={formatarCentavosBRL(event.netContractAmountCents)} mono />
            <Linha label="Forma de pagamento" valor={formatarFormaPagamentoComissao(event.formaPagamento)} />
            {event.commissionableBaseCents !== null && (
              <Linha label="Base comissionável" valor={formatarCentavosBRL(event.commissionableBaseCents)} mono />
            )}
            <EditorResponsavel label="Closer" eventId={event.id} nomeAtual={event.closerNome} campo="closer" onAtualizado={onAtualizar} />
            <EditorResponsavel label="Analista responsável" eventId={event.id} nomeAtual={event.analistaResponsavelNome} campo="analistaResponsavel" onAtualizado={onAtualizar} />

            {event.eventType === "PROCESS_SUCCESS" && (
              <>
                <Linha label="Data do êxito" valor={formatarDataComissao(event.dataExito)} />
                <Linha label="Tentativas" valor={event.tentativas === null ? "Não informado" : String(event.tentativas)} />
                <Linha
                  label="Primeira tentativa"
                  valor={event.deferidoPrimeiraTentativa === null ? "Não informado" : event.deferidoPrimeiraTentativa ? "Deferido" : "Não deferido"}
                />
                <Linha label="Status do processo" valor={event.processStatus ?? "Não informado"} />
              </>
            )}
            <Linha label="Status do evento" valor={STATUS_LABELS[event.status] ?? event.status} />
          </dl>

          {divergencias.length > 0 && (
            <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
              <p className="text-xs font-medium text-rose-300">{divergencias.length} divergência(s) pendente(s)</p>
              <ul className="mt-1 space-y-0.5 text-[11px] text-rose-300/80">
                {divergencias.map((divergencia) => <li key={divergencia.id}>{traduzirDivergencia(divergencia.tipo).titulo}</li>)}
              </ul>
              <Link href="/PainelAlpha/Comissoes/Divergencias" className="mt-2 inline-block text-[11px] text-rose-200 underline">
                Ver detalhes e como resolver
              </Link>
            </div>
          )}
        </section>

        <section className="grid min-w-0 gap-4 lg:grid-cols-2">
          {setorComercial.length > 0 && (
            <SetorColaboradores titulo="Comercial" entries={setorComercial} tema={tema} onAbrirDetalhes={onAbrirDetalhes} onPagamentoRegistrado={onAtualizar} />
          )}
          {setorOperacional.length > 0 && (
            <SetorColaboradores titulo="Operacional" entries={setorOperacional} tema={tema} onAbrirDetalhes={onAbrirDetalhes} onPagamentoRegistrado={onAtualizar} />
          )}
          {semSetor.length > 0 && (
            <SetorColaboradores titulo="Sem setor identificado" entries={semSetor} tema={tema} onAbrirDetalhes={onAbrirDetalhes} onPagamentoRegistrado={onAtualizar} />
          )}
          {!temLancamentos && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 p-5 text-center lg:col-span-2">
              <p className="text-xs text-slate-500">Nenhum lançamento gerado para este evento.</p>
              <Button size="sm" variant="outline" disabled={isPending} onClick={gerarLancamentos}>
                {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Gerar lançamentos
              </Button>
            </div>
          )}
        </section>

        <aside className="flex flex-col justify-between gap-6 rounded-2xl border border-white/5 bg-slate-950/55 p-4">
          <div className="space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Total do evento</p>
              <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-white">{formatarCentavosBRL(totalGeralCents)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Saldo pendente</p>
              <p className="mt-1 font-mono text-base tabular-nums text-amber-300">{formatarCentavosBRL(totalPendenteCents)}</p>
            </div>
          </div>
          <Button className="min-h-12 w-full whitespace-normal" disabled={!temLancamentos || totalPendenteCents <= 0} onClick={() => setModalPagarTodosAberto(true)}>
            Pagamento realizado
          </Button>
        </aside>
      </div>

      {modalPagarTodosAberto && (
        <ModalPagarTodos open onOpenChange={setModalPagarTodosAberto} entryIds={entryIds} onConfirmado={onAtualizar} />
      )}
    </article>
  );
}

function Linha({ label, valor, mono = false }: { label: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className={`min-w-0 break-words text-right text-slate-300 ${mono ? "font-mono tabular-nums" : ""}`}>{valor}</dd>
    </div>
  );
}
