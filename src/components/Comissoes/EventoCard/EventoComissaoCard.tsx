"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SetorColaboradores } from "./SetorColaboradores";
import { ModalPagarTodos } from "./ModalPagarTodos";
import { EVENT_TYPE_LABELS, formatarCentavosBRL, formatarDataComissao, STATUS_LABELS } from "../lib/formatters";
import type { EventoComLancamentosResult } from "@/actions/CommissionEntries";
import type { TemaAlpha } from "@/lib/temas";

interface EventoComissaoCardProps {
  dados: EventoComLancamentosResult;
  tema: TemaAlpha;
  onAbrirDetalhes: (entryId: string) => void;
  onAtualizar?: () => void;
}

/**
 * Componente equivalente ao "Big Card" do prompt do usuário — 3 áreas (dados da empresa,
 * setor Comercial, setor Operacional) + rodapé de totais e ações. Padrão "Ledger Vivo"
 * (Fase 03): faixa de 4px azul=CONTRATAÇÃO/verde=ÊXITO, grid 3 colunas no desktop,
 * empilhado em mobile. Setores só aparecem quando têm colaborador de verdade.
 */
export function EventoComissaoCard({ dados, tema, onAbrirDetalhes, onAtualizar }: EventoComissaoCardProps) {
  const [modalPagarTodosAberto, setModalPagarTodosAberto] = useState(false);

  const { event, divergencias, setorComercial, setorOperacional, semSetor, totalGeralCents } = dados;
  const corFaixa = event.eventType === "PROCESS_SUCCESS" ? "bg-emerald-500" : "bg-blue-500";

  const todosOsEntryIds = [...setorComercial, ...setorOperacional, ...semSetor].map((e) => e.id);
  const temColaboradores = todosOsEntryIds.length > 0;

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-slate-900/40">
      <div className={`absolute inset-x-0 top-0 h-1 ${corFaixa}`} aria-hidden="true" />

      <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-[1.2fr_1fr_1fr]">
        {/* Dados da empresa/evento */}
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white">{event.razaoSocial}</p>
              {event.nomeFantasia && <p className="text-xs text-slate-500">{event.nomeFantasia}</p>}
            </div>
            <Badge variant="outline" className="border-white/10 text-slate-300">
              {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
            </Badge>
          </div>

          <dl className="mt-3 space-y-1 text-xs">
            <div className="flex justify-between">
              <dt className="text-slate-500">CNPJ</dt>
              <dd className="text-slate-300">{event.cnpj}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Serviço</dt>
              <dd className="text-slate-300">{event.servico}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Data do evento</dt>
              <dd className="text-slate-300">{formatarDataComissao(event.eventDate)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Valor contratado</dt>
              <dd className="font-mono tabular-nums text-slate-300">
                {formatarCentavosBRL(event.netContractAmountCents)}
              </dd>
            </div>
            {event.formaPagamento && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Forma de pagamento</dt>
                <dd className="text-slate-300">{event.formaPagamento}</dd>
              </div>
            )}
            {event.commissionableBaseCents !== null && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Base comissionável</dt>
                <dd className="font-mono tabular-nums text-slate-300">
                  {formatarCentavosBRL(event.commissionableBaseCents)}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-500">Status</dt>
              <dd className="text-slate-300">{STATUS_LABELS[event.status] ?? event.status}</dd>
            </div>
          </dl>

          {divergencias.length > 0 && (
            <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-2">
              <p className="text-xs font-medium text-rose-400">
                {divergencias.length} divergência(s) pendente(s)
              </p>
              <ul className="mt-1 space-y-0.5 text-[11px] text-rose-300/80">
                {divergencias.map((d) => (
                  <li key={d.id}>{d.detalhes}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Setor Comercial — só renderiza se tiver colaborador real */}
        {setorComercial.length > 0 && (
          <SetorColaboradores
            titulo="Comercial"
            entries={setorComercial}
            tema={tema}
            onAbrirDetalhes={onAbrirDetalhes}
            onPagamentoRegistrado={onAtualizar}
          />
        )}

        {/* Setor Operacional — só renderiza se tiver colaborador real */}
        {setorOperacional.length > 0 && (
          <SetorColaboradores
            titulo="Operacional"
            entries={setorOperacional}
            tema={tema}
            onAbrirDetalhes={onAbrirDetalhes}
            onPagamentoRegistrado={onAtualizar}
          />
        )}

        {/* Colaboradores sem setor identificado — não escondidos, mas sinalizados */}
        {semSetor.length > 0 && (
          <SetorColaboradores
            titulo="Sem setor identificado"
            entries={semSetor}
            tema={tema}
            onAbrirDetalhes={onAbrirDetalhes}
            onPagamentoRegistrado={onAtualizar}
          />
        )}
      </div>

      <div className="flex items-center justify-between border-t border-white/5 px-6 py-4">
        <Button
          size="sm"
          variant="outline"
          className="border-white/10"
          disabled={!temColaboradores}
          onClick={() => setModalPagarTodosAberto(true)}
        >
          Marcar todos como pagos
        </Button>
        <span className="font-mono text-lg font-semibold tabular-nums text-white">
          {formatarCentavosBRL(totalGeralCents)}
        </span>
      </div>

      <ModalPagarTodos
        open={modalPagarTodosAberto}
        onOpenChange={setModalPagarTodosAberto}
        entryIds={todosOsEntryIds}
        onConfirmado={onAtualizar}
      />
    </div>
  );
}
