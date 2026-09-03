"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { BriefcaseBusiness, Building2, Trash2 } from "lucide-react";
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
import { CardSaveProvider } from "./CardSaveContext";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type EtapaOpcao = { id: string; nome: string; ordem: number; script: string | null };
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
  onAbrirCard,
  onInteracaoCriada,
  onEstadoFollowUpChange,
  estadoFollowUpAtual,
  children,
}: CardAbertoLayoutProps) {
  const [abaAtiva, setAbaAtiva] = useState<string>(card.pipeline.id);
  const [outrosPipelines, setOutrosPipelines] = useState<{ id: string; nome: string }[]>([]);
  const [excluindo, setExcluindo] = useState(false);
  const dadosEmpresaDrawer = useDadosEmpresaDrawer(card.id);
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
  const podeTrabalharNoCard = isAdminRole(currentUserRole)
    || (Boolean(meuVinculo) && podeAgirNaEtapa);
  const podeMoverEtapa = podeTrabalharNoCard;
  const podeEditar = podeTrabalharNoCard;
  const podeTrabalharTarefas = podeTrabalharNoCard;
  const podeGerenciarMembros = isAdminRole(currentUserRole)
    || (podeAgirNaEtapa && (
      meuVinculo?.role === "RESPONSAVEL"
      || meuVinculo?.role === "ADMINISTRADOR"
    ));
  const etapaAtual = etapas.find((e) => e.id === card.etapa.id) ?? null;

  const transicoesDaEtapaAtual = card.etapa.transicoesOrigem ?? [];
  const etapasParaMover =
    transicoesDaEtapaAtual.length > 0
      ? etapas.filter(
          (e) => e.id === card.etapa.id || transicoesDaEtapaAtual.some((t) => t.etapaDestinoId === e.id),
        )
      : etapas;

  return (
    <CardSaveProvider>
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
            {podeGerenciarMembros && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    aria-label="Excluir card"
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
                      Esta ação é irreversível e removerá todos os campos, tarefas e anexos vinculados.
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
                            toast.success("Card excluído com sucesso");
                            onClose();
                          } else {
                            toast.error(res.error ?? "Erro ao excluir card");
                          }
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

        {/* Tabs de pipeline (1ª: pipeline atual do card; demais: outros pipelines do sistema) */}
        <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="mt-4">
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
            <TabsContent value={card.pipeline.id} className="min-h-0 m-0 lg:h-full lg:overflow-hidden">
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
            {outrosPipelines.map((pipeline) => (
              <TabsContent key={pipeline.id} value={pipeline.id} className="min-h-0 m-0 lg:h-full lg:overflow-hidden">
                <PainelHistoricoPipeline
                  cardId={card.id}
                  pipelineId={pipeline.id}
                  pipelineNome={pipeline.nome}
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
    </div>
    </CardSaveProvider>
  );
}
