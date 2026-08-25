"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { BriefcaseBusiness, Building2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { ListarInteracoesCardBpm } from "@/actions/bpm/Interacoes";
import { isAdminRole } from "@/lib/roles";
import PainelHistorico from "./PainelHistorico";
import PainelHistoricoServico from "./PainelHistoricoServico";
import PainelProximaEtapa from "./PainelProximaEtapa";
import {
  DadosEmpresaDrawer,
  DadosEmpresaToggle,
  useDadosEmpresaDrawer,
} from "./DadosEmpresaDrawer";
import { TelefonesCardButton } from "./TelefonesCardButton";
import { EmpresaPerfilModal } from "./EmpresaPerfilModal";
import { SeletorMembrosCard } from "./SeletorMembrosCard";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type EtapaOpcao = { id: string; nome: string; ordem: number; script: string | null };
type Interacao = Awaited<ReturnType<typeof ListarInteracoesCardBpm>>["data"][number];

const SERVICOS_FIXOS = ["Radar", "TTD-409", "Recuperação Tributária"];

export interface CardAbertoLayoutProps {
  card: CardDetalhe;
  etapas: EtapaOpcao[];
  interacoes: Interacao[];
  accent: string;
  currentUserId: number | null;
  currentUserRole: string | null;
  realtimeRevision: number;
  onClose: () => void;
  onAtualizado: () => void;
  onAbrirCard: (cardId: string) => void;
  onInteracaoCriada: (interacao: Interacao) => void;
  onEstadoFollowUpChange: (estado: "CARREGANDO" | "ERRO" | "NAO_INICIADO" | "EM_ANDAMENTO" | "CONCLUIDO") => void;
  estadoFollowUpAtual: "CARREGANDO" | "ERRO" | "NAO_INICIADO" | "EM_ANDAMENTO" | "CONCLUIDO";
  /** Slot: formulário da etapa ativa (renderizado pelo CardOpenFormSlot ou equivalente) */
  children: ReactNode;
}

/**
 * Layout padrão do card aberto — idêntico em todas as etapas do pipeline.
 *
 * Estrutura:
 * - Handle visual do bottom-sheet
 * - Header (empresa, CNPJ, serviço, tabs de serviço, ações)
 * - Grid de 3 painéis:
 *   - Esquerda: PainelHistorico (ou DadosEmpresaDrawer)
 *   - Centro: children (formulário da etapa ativa)
 *   - Direita: PainelProximaEtapa
 *
 * Apenas a seção central (children) varia entre etapas.
 */
export function CardAbertoLayout({
  card,
  etapas,
  interacoes,
  accent,
  currentUserId,
  currentUserRole,
  realtimeRevision,
  onClose,
  onAtualizado,
  onAbrirCard,
  onInteracaoCriada,
  onEstadoFollowUpChange,
  estadoFollowUpAtual,
  children,
}: CardAbertoLayoutProps) {
  const [abaAtiva, setAbaAtiva] = useState<string>("card");
  const [perfilEmpresaAberto, setPerfilEmpresaAberto] = useState(false);
  const dadosEmpresaDrawer = useDadosEmpresaDrawer(card.id);

  const meuVinculo = card.membros.find((m) => m.userId === currentUserId);
  const podeTrabalharNoCard = isAdminRole(currentUserRole) || Boolean(meuVinculo);
  const podeMoverEtapa = podeTrabalharNoCard;
  const podeEditar = podeTrabalharNoCard;
  const podeTrabalharTarefas = podeTrabalharNoCard;
  const podeGerenciarMembros = isAdminRole(currentUserRole)
    || meuVinculo?.role === "RESPONSAVEL"
    || meuVinculo?.role === "ADMINISTRADOR";
  const etapaAtual = etapas.find((e) => e.id === card.etapa.id) ?? null;

  const transicoesDaEtapaAtual = card.etapa.transicoesOrigem ?? [];
  const etapasParaMover =
    transicoesDaEtapaAtual.length > 0
      ? etapas.filter(
          (e) => e.id === card.etapa.id || transicoesDaEtapaAtual.some((t) => t.etapaDestinoId === e.id),
        )
      : etapas;

  return (
    <div className="flex flex-col h-full">
      {/* Handle visual do bottom-sheet */}
      <div className="flex justify-center pt-3 pb-1 shrink-0">
        <div className="w-10 h-1 rounded-full bg-white/15" />
      </div>

      {/* Header */}
      <div className="px-6 sm:px-8 pt-2 pb-5 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
              style={{
                background: `linear-gradient(135deg, rgba(${accent},0.35), rgba(${accent},0.08))`,
                boxShadow: `0 8px 24px -8px rgba(${accent},0.5)`,
              }}
            >
              <Building2 size={19} style={{ color: `rgb(${accent})` }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-black text-white tracking-tight truncate">
                {card.empresa.nomeFantasia || card.empresa.razaoSocial}
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span>{card.empresa.cnpj}</span>
                <span className="text-slate-700">·</span>
                <button
                  type="button"
                  onClick={() => setPerfilEmpresaAberto(true)}
                  className="hover:text-white transition-colors"
                  aria-label="Abrir perfil da empresa"
                >
                  Perfil da empresa
                </button>
              </div>
              {card.servico?.trim() && (
                <div
                  className="mt-2 inline-flex max-w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs shadow-[0_8px_20px_-14px_rgba(var(--accent-rgb),0.9)]"
                  style={{
                    background: `linear-gradient(110deg, rgba(${accent},0.22), rgba(${accent},0.06))`,
                    borderColor: `rgba(${accent},0.42)`,
                  }}
                >
                  <BriefcaseBusiness
                    aria-hidden="true"
                    size={13}
                    className="shrink-0"
                    style={{ color: `rgb(${accent})` }}
                  />
                  <span className="shrink-0 font-bold uppercase tracking-[0.11em] text-slate-300">
                    Serviço ativo
                  </span>
                  <span className="truncate font-extrabold text-white" title={card.servico}>
                    {card.servico}
                  </span>
                </div>
              )}
            </div>
            <DadosEmpresaToggle
              aberto={dadosEmpresaDrawer.aberto}
              empresaNome={card.empresa.nomeFantasia || card.empresa.razaoSocial}
              onToggle={dadosEmpresaDrawer.alternar}
            />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <SeletorMembrosCard
              cardId={card.id}
              membros={card.membros}
              podeGerenciar={podeGerenciarMembros}
              accent={accent}
              onMembrosAtualizados={() => { onAtualizado(); }}
              onAtualizado={() => { onAtualizado(); }}
            />
            <TelefonesCardButton
              cardId={card.id}
              empresaNome={card.empresa.nomeFantasia || card.empresa.razaoSocial}
            />
          </div>
        </div>

        {/* Tabs de serviço */}
        <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="mt-4">
          <TabsList className="flex-wrap h-auto bg-transparent border-none p-0 gap-2 justify-start">
            <TabsTrigger
              value="card"
              className="rounded-full px-3.5 py-1.5 text-xs font-semibold backdrop-blur-sm transition-colors border data-[state=active]:shadow-none"
              style={
                abaAtiva === "card"
                  ? { background: `rgba(${accent},0.18)`, color: `rgb(${accent})`, borderColor: `rgba(${accent},0.35)` }
                  : { background: "rgba(255,255,255,0.03)", color: "#64748b", borderColor: "rgba(255,255,255,0.08)" }
              }
            >
              Este card
            </TabsTrigger>
            {SERVICOS_FIXOS.map((servico) => {
              const ativo = abaAtiva === servico;
              return (
                <TabsTrigger
                  key={servico}
                  value={servico}
                  className="rounded-full px-3.5 py-1.5 text-xs font-semibold backdrop-blur-sm transition-colors border data-[state=active]:shadow-none"
                  style={
                    ativo
                      ? { background: `rgba(${accent},0.18)`, color: `rgb(${accent})`, borderColor: `rgba(${accent},0.35)` }
                      : { background: "rgba(255,255,255,0.03)", color: "#64748b", borderColor: "rgba(255,255,255,0.08)" }
                  }
                >
                  {servico}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* 3 painéis */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_max-content] gap-4 px-4 sm:px-6 pb-6 overflow-y-auto lg:overflow-hidden min-h-0">
        {dadosEmpresaDrawer.aberto ? (
          <DadosEmpresaDrawer
            accent={accent}
            carregando={dadosEmpresaDrawer.carregando}
            dados={dadosEmpresaDrawer.dados}
            erro={dadosEmpresaDrawer.erro}
            onFechar={dadosEmpresaDrawer.fechar}
            onRecarregar={dadosEmpresaDrawer.recarregar}
          />
        ) : (
          <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="min-h-0 lg:h-full lg:overflow-hidden">
            <TabsContent value="card" className="min-h-0 m-0 lg:h-full lg:overflow-hidden">
              <PainelHistorico
                card={card}
                accent={accent}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                onAtualizado={() => { onAtualizado(); }}
                etapas={etapas}
                podeTrabalharTarefas={podeTrabalharTarefas}
                anotacoes={interacoes.filter((interacao) => interacao.tipo === "ANOTACAO" || Boolean(interacao.observacoes))}
              />
            </TabsContent>
            {SERVICOS_FIXOS.map((servico) => (
              <TabsContent key={servico} value={servico} className="min-h-0 m-0 lg:h-full lg:overflow-hidden">
                <PainelHistoricoServico
                  cardId={card.id}
                  servico={servico}
                  accent={accent}
                  onAbrirCard={onAbrirCard}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* Centro: slot do formulário da etapa ativa */}
        <div className="min-h-0 lg:h-full lg:overflow-hidden">{children}</div>

        {/* Direita: próxima etapa */}
        <div className="flex flex-col gap-4 min-h-0 overflow-y-auto">
          <PainelProximaEtapa
            card={card}
            etapas={etapasParaMover}
            podeMoverEtapa={podeMoverEtapa}
            accent={accent}
            onMovido={() => { onAtualizado(); }}
          />
        </div>
      </div>

      <EmpresaPerfilModal
        empresaId={card.empresa.id}
        aberto={perfilEmpresaAberto}
        accent={accent}
        onAbertoChange={setPerfilEmpresaAberto}
        onAbrirCard={onAbrirCard}
      />
    </div>
  );
}
