"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Building2, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { toast } from "sonner";
import { ExcluirCardBpm } from "@/actions/bpm/Cards";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { ListarInteracoesCardBpm } from "@/actions/bpm/Interacoes";
import { ListarPipelinesBpm } from "@/actions/bpm/Pipelines";
import { isAdminRole } from "@/lib/roles";
import { etapaEhBoasVindas, PIPELINE_OPERACIONAL_ATIVO_ID, podeAgirBoasVindasOperacional } from "@/lib/bpm/boas-vindas";
import { formatCNPJ } from "@/lib/format-cnpj";
import PainelHistorico from "./PainelHistorico";
import PainelHistoricoPipeline from "./PainelHistoricoPipeline";
import PainelProximaEtapa from "./PainelProximaEtapa";
import {
  DadosEmpresaDrawer,
  DadosEmpresaToggle,
  useDadosEmpresaDrawer,
} from "./DadosEmpresaDrawer";
import { TelefonesCardButton } from "./TelefonesCardButton";
import { usePerfilEmpresa } from "@/components/PerfilEmpresaGlobal";
import { SeletorMembrosCard } from "./SeletorMembrosCard";
import { PainelEncaminhamentos } from "./PainelEncaminhamentos";
import { PainelSlaCard } from "./PainelSlaCard";
import { ChatClienteCard } from "./ChatClienteCard";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type EtapaOpcao = { id: string; chave?: string | null; nome: string; ordem: number; script: string | null };
type Interacao = Awaited<ReturnType<typeof ListarInteracoesCardBpm>>["data"][number];

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
  onCardExcluido?: (cardId: string) => void;
  onAbrirCard: (cardId: string) => void;
  onInteracaoCriada: (interacao: Interacao) => void;
  /** Slot: formulário da etapa ativa (renderizado pelo CardOpenFormSlot ou equivalente) */
  children: ReactNode;
  focoTarefa?: { cardId: string; tarefaId: string } | null;
}

/**
 * Layout padrão do card aberto — idêntico em todas as etapas do pipeline.
 *
 * Estrutura:
 * - Handle visual do bottom-sheet
 * - Header (empresa, CNPJ, serviço, tabs de pipeline, ações)
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
  onCardExcluido,
  onAbrirCard,
  onInteracaoCriada,
  children,
  focoTarefa = null,
}: CardAbertoLayoutProps) {
  const [selecaoAba, setSelecaoAba] = useState({ valor: card.pipeline.id, foco: focoTarefa });
  const abaAtiva = selecaoAba.foco === focoTarefa ? selecaoAba.valor : card.pipeline.id;
  const setAbaAtiva = (valor: string) => setSelecaoAba({ valor, foco: focoTarefa });
  const [outrosPipelines, setOutrosPipelines] = useState<{ id: string; nome: string }[]>([]);
  const [excluindo, setExcluindo] = useState(false);
  const dadosEmpresaDrawer = useDadosEmpresaDrawer(card.id);
  const ultimoFocoTarefaRef = useRef(focoTarefa);
  useEffect(() => {
    if (ultimoFocoTarefaRef.current === focoTarefa) return;
    ultimoFocoTarefaRef.current = focoTarefa;
    if (focoTarefa?.cardId === card.id) dadosEmpresaDrawer.fechar();
  }, [card.id, focoTarefa, dadosEmpresaDrawer]);
  const { openPerfilEmpresa } = usePerfilEmpresa();


  useEffect(() => {
    let cancelado = false;
    ListarPipelinesBpm().then((res) => {
      if (cancelado) return;
      if (res.success) {
        setOutrosPipelines(res.data.filter((p) => p.id !== card.pipelineId).map((p) => ({ id: p.id, nome: p.nome })));
      }
    });
    return () => { cancelado = true; };
  }, [card.pipelineId]);

  const meuVinculo = card.membros.find((m) => m.userId === currentUserId);
  const podeAgirNaEtapa = card.permissaoEtapa?.podeAgir ?? true;
  const restritoBoasVindas = card.pipelineId === PIPELINE_OPERACIONAL_ATIVO_ID
    && etapaEhBoasVindas(card.etapa.nome);
  const permitidoBoasVindas = !restritoBoasVindas
    || (currentUserId !== null && podeAgirBoasVindasOperacional(currentUserId, currentUserRole));
  const podeTrabalharNoCard = permitidoBoasVindas && (isAdminRole(currentUserRole)
    || (Boolean(meuVinculo) && podeAgirNaEtapa));
  const podeMoverEtapa = Boolean(card?.podeMoverLivremente) || podeTrabalharNoCard;
  const podeEditar = podeTrabalharNoCard;
  const podeTrabalharTarefas = podeTrabalharNoCard;
  const podeGerenciarMembros = permitidoBoasVindas && (isAdminRole(currentUserRole) || (podeAgirNaEtapa && (
      meuVinculo?.role === "RESPONSAVEL" || meuVinculo?.role === "ADMINISTRADOR"
    )));
  const transicoesDaEtapaAtual = card.etapa.transicoesEtapaOrigem ?? [];
  const etapasParaMover = etapas.filter(
    (e) => e.id === card.etapa.id || card.podeMoverLivremente || transicoesDaEtapaAtual.some((t) => t.etapaDestinoId === e.id),
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Handle visual do bottom-sheet */}
      <div className="flex justify-center pt-3 pb-1 shrink-0">
        <div className="w-10 h-1 rounded-full bg-white/15" />
      </div>

      {/* Header */}
      <div className="px-5 pt-4 pb-6 shrink-0 sm:px-8 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-xl border border-slate-700 bg-slate-800 flex items-center justify-center shrink-0"
            >
              <Building2 size={19} className="text-slate-300" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-slate-100 tracking-tight truncate">
                {card.empresa.nomeFantasia || card.empresa.razaoSocial}
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span>{formatCNPJ(card.empresa.cnpj) ?? card.empresa.cnpj}</span>
                <span className="text-slate-700">·</span>
                <button
                  type="button"
                  onClick={() =>
                    openPerfilEmpresa(
                      card.empresa.id,
                      {
                        cnpj: card.empresa.cnpj ?? "",
                        razaoSocial: card.empresa.razaoSocial,
                        nomeFantasia: card.empresa.nomeFantasia ?? undefined,
                      },
                      onAbrirCard
                    )
                  }
                  className="hover:text-white transition-colors"
                  aria-label="Abrir perfil da empresa"
                >
                  Perfil da empresa
                </button>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <DadosEmpresaToggle
                aberto={dadosEmpresaDrawer.aberto}
                empresaNome={card.empresa.nomeFantasia || card.empresa.razaoSocial}
                onToggle={dadosEmpresaDrawer.alternar}
              />
              <SeletorMembrosCard
                cardId={card.id}
                membros={card.membros}
                podeGerenciar={podeGerenciarMembros}
                accent={accent}
                onMembrosAtualizados={() => { onAtualizado(); }}
                onAtualizado={() => { onAtualizado(); }}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {(card.pipeline.chave === "comercial" || card.pipeline.nome === "Revisão de Radar") && (
              <ChatClienteCard
                cardId={card.id}
                clienteNome={card.empresa.razaoSocial || card.empresa.nomeFantasia || "cliente"}
                podeEnviar={podeEditar}
              />
            )}
            <TelefonesCardButton
              cardId={card.id}
              empresaNome={card.empresa.nomeFantasia || card.empresa.razaoSocial}
            />
            {podeGerenciarMembros && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    aria-label="Excluir card"
                    disabled={excluindo}
                    className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir card</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir o card{" "}
                      <strong>{card.empresa.nomeFantasia || card.empresa.razaoSocial}</strong>?
                      O card será arquivado e sairá do board. Esta ação é irreversível pela interface.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      disabled={excluindo}
                      onClick={async () => {
                        setExcluindo(true);
                        try {
                          const res = await ExcluirCardBpm(card.id);
                          if (res.success) {
                            toast.success("Card arquivado com sucesso");
                            onCardExcluido?.(card.id);
                            onAtualizado();
                            onClose();
                          } else {
                            const msg = (res as { mensagem?: string }).mensagem ?? res.error ?? "Erro ao excluir card";
                            toast.error(msg);
                          }
                        } catch {
                          toast.error("Não foi possível arquivar o card. Tente novamente.");
                        } finally {
                          setExcluindo(false);
                        }
                      }}
                    >
                      {excluindo ? "Excluindo…" : "Excluir"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-300">Em edição: <strong>{card.pipeline.nome}</strong> · {card.etapa.nome}</p>
        <p className="mt-2 text-[11px] text-slate-400">Histórico de passagem — as abas consultam a jornada; o formulário permanece no card em edição.</p>

        {/* Tabs de pipeline (1ª: pipeline atual do card; demais: outros pipelines do sistema) */}
        <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="mt-2">
          <TabsList className="flex-wrap h-auto bg-transparent border-none p-0 gap-2 justify-start">
            <TabsTrigger
              value={card.pipeline.id}
              className="rounded-full px-3.5 py-1.5 text-xs font-semibold backdrop-blur-sm transition-colors border data-[state=active]:shadow-none"
              style={
                abaAtiva === card.pipeline.id
                  ? { background: `rgba(${accent},0.18)`, color: `rgb(${accent})`, borderColor: `rgba(${accent},0.35)` }
                  : { background: "rgba(255,255,255,0.03)", color: "#64748b", borderColor: "rgba(255,255,255,0.08)" }
              }
            >
              {card.pipeline.nome}
            </TabsTrigger>
            {outrosPipelines.map((pipeline) => {
              const ativo = abaAtiva === pipeline.id;
              return (
                <TabsTrigger
                  key={pipeline.id}
                  value={pipeline.id}
                  className="rounded-full px-3.5 py-1.5 text-xs font-semibold backdrop-blur-sm transition-colors border data-[state=active]:shadow-none"
                  style={
                    ativo
                      ? { background: `rgba(${accent},0.18)`, color: `rgb(${accent})`, borderColor: `rgba(${accent},0.35)` }
                      : { background: "rgba(255,255,255,0.03)", color: "#64748b", borderColor: "rgba(255,255,255,0.08)" }
                  }
                >
                  {pipeline.nome}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* 3 painéis */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-y-auto px-5 pb-8 sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(240px,0.7fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden lg:px-10">
        {dadosEmpresaDrawer.aberto ? (
          <DadosEmpresaDrawer
            cardId={card.id}
            podeEditar={podeEditar && !card.encaminhado}
            registrarGuard={dadosEmpresaDrawer.registrarGuard}
            onSalvo={(dados) => { dadosEmpresaDrawer.confirmarDados(dados); onAtualizado(); }}
            accent={accent}
            carregando={dadosEmpresaDrawer.carregando}
            dados={dadosEmpresaDrawer.dados}
            erro={dadosEmpresaDrawer.erro}
            onFechar={dadosEmpresaDrawer.fechar}
            onRecarregar={dadosEmpresaDrawer.recarregar}
          />
        ) : (
          <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="min-h-0 lg:h-full lg:overflow-hidden">
            <TabsContent value={card.pipeline.id} className="min-h-0 m-0 lg:h-full lg:overflow-hidden">
              <PainelHistorico
                card={card}
                focoTarefa={focoTarefa}
                accent={accent}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                onAtualizado={() => { onAtualizado(); }}
                etapas={etapas}
                podeTrabalharTarefas={podeTrabalharTarefas}
                podeEditar={podeEditar}
                realtimeRevision={realtimeRevision}
                onInteracaoCriada={onInteracaoCriada}
                onAbrirCard={onAbrirCard}
                anotacoes={interacoes.filter((interacao) => interacao.tipo === "ANOTACAO" || Boolean(interacao.observacoes))}
              />
            </TabsContent>
            {outrosPipelines.map((pipeline) => (
              <TabsContent key={pipeline.id} value={pipeline.id} className="min-h-0 m-0 lg:h-full lg:overflow-hidden">
                <PainelHistoricoPipeline
                  cardId={card.id}
                  pipelineId={pipeline.id}
                  pipelineNome={pipeline.nome}
                  accent={accent}
                  realtimeRevision={realtimeRevision}
                  onAbrirCard={onAbrirCard}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* Centro: slot do formulário da etapa ativa */}
        <div
          role="region"
          aria-label={`Formulário em edição: ${card.pipeline.nome} · ${card.etapa.nome}`}
          tabIndex={0}
          className="min-h-0 min-w-0 lg:h-full lg:overflow-y-auto lg:overscroll-y-contain"
        >
          {children}
        </div>

        {/* Direita: próxima etapa */}
        <div className="flex flex-col gap-5 min-w-0 min-h-0 overflow-y-auto">
          <PainelEncaminhamentos card={card} realtimeRevision={realtimeRevision} onAtualizado={onAtualizado} onAbrirCard={onAbrirCard} />
          <PainelSlaCard cardId={card.id} realtimeRevision={realtimeRevision} />
          <PainelProximaEtapa
            card={card}
            etapas={etapasParaMover}
            currentUserId={currentUserId}
            podeMoverEtapa={podeMoverEtapa}
            realtimeRevision={realtimeRevision}
            accent={accent}
            onMovido={() => { onAtualizado(); }}
          />
        </div>
      </div>
    </div>
  );
}
