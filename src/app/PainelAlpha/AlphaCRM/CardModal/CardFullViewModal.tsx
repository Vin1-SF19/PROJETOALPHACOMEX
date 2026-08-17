"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BriefcaseBusiness, Building2, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { isAdminRole } from "@/lib/roles";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { ObterPipelineBpm } from "@/actions/bpm/Pipelines";
import { ListarInteracoesCardBpm } from "@/actions/bpm/Interacoes";
import PainelHistorico from "./PainelHistorico";
import PainelHistoricoServico from "./PainelHistoricoServico";
import PainelRegistrar from "./PainelRegistrar";
import PainelProximaEtapa from "./PainelProximaEtapa";
import {
  DadosEmpresaDrawer,
  DadosEmpresaToggle,
  useDadosEmpresaDrawer,
} from "./DadosEmpresaDrawer";
import { TelefonesCardButton } from "./TelefonesCardButton";
import { EmpresaPerfilModal } from "./EmpresaPerfilModal";
import { SeletorMembrosCard } from "./SeletorMembrosCard";
import { toast } from "sonner";
import { followUpBloqueiaFechamento, type EstadoFollowUpModal } from "@/lib/bpm/card-modal-ui";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type EtapaOpcao = { id: string; nome: string; ordem: number; script: string | null };
type Interacao = Awaited<ReturnType<typeof ListarInteracoesCardBpm>>["data"][number];

const SERVICOS_FIXOS = ["Radar", "TTD-409", "Recuperação Tributária"];

function resultadoRevogaAcessoCard(resultado: Awaited<ReturnType<typeof ObterCardBpm>>) {
  return (!resultado.success && resultado.error === "Não autorizado") || (resultado.success && !resultado.data);
}

interface Props {
  cardId: string;
  realtimeRevision?: number;
  accent: string;
  currentUserId: number | null;
  currentUserRole: string | null;
  onClose: () => void;
  onAtualizado: () => void;
  onAbrirCard: (cardId: string) => void;
}

export default function CardFullViewModal({ cardId, realtimeRevision = 0, accent, currentUserId, currentUserRole, onClose, onAtualizado, onAbrirCard }: Props) {
  const [card, setCard] = useState<CardDetalhe | null>(null);
  const [etapas, setEtapas] = useState<EtapaOpcao[]>([]);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<string>("card");
  const [perfilEmpresaAberto, setPerfilEmpresaAberto] = useState(false);
  const [estadoFollowUpPorCard, setEstadoFollowUpPorCard] = useState<Record<string, EstadoFollowUpModal>>({});
  const acessoRevogadoRef = useRef(false);
  const dadosEmpresaDrawer = useDadosEmpresaDrawer(cardId);
  const fecharPorAcessoRevogado = useCallback(() => {
    if (acessoRevogadoRef.current) return;
    acessoRevogadoRef.current = true;
    toast.error("Seu acesso a este card foi removido.");
    onClose();
  }, [onClose]);
  const atualizarEstadoFollowUp = useCallback((estado: EstadoFollowUpModal) => {
    setEstadoFollowUpPorCard((estados) => ({ ...estados, [cardId]: estado }));
  }, [cardId]);
  const focarPainelReuniao = useCallback(() => {
    const painel = document.getElementById(`formulario-etapa-${cardId}`);
    painel?.scrollIntoView({ behavior: "smooth", block: "center" });
    painel?.focus({ preventScroll: true });
  }, [cardId]);

  const carregando = card?.id !== cardId && erro === null;

  useEffect(() => {
    let cancelado = false;

    ObterCardBpm(cardId).then((res) => {
      if (cancelado) return;
      if (!res.success || !res.data) {
        if (resultadoRevogaAcessoCard(res)) {
          fecharPorAcessoRevogado();
          return;
        }
        setErro(typeof res.error === "string" ? res.error : "Erro ao carregar card");
        return;
      }
      setCard(res.data);

      Promise.all([
        ObterPipelineBpm(res.data.pipeline.id),
        ListarInteracoesCardBpm(cardId),
      ]).then(([pipelineRes, interacoesRes]) => {
        if (cancelado) return;
        if (pipelineRes.success && pipelineRes.data) {
          setEtapas([...pipelineRes.data.etapas].sort((a, b) => a.ordem - b.ordem));
        }
        setInteracoes(interacoesRes.data ?? []);
      });
    });

    return () => { cancelado = true; };
  }, [cardId, fecharPorAcessoRevogado]);

  useEffect(() => {
    if (realtimeRevision === 0) return;
    let cancelado = false;
    Promise.all([ObterCardBpm(cardId), ListarInteracoesCardBpm(cardId)]).then(([cardRes, interacoesRes]) => {
      if (cancelado) return;
      if (resultadoRevogaAcessoCard(cardRes)) {
        fecharPorAcessoRevogado();
        return;
      }
      if (cardRes.success && cardRes.data) setCard(cardRes.data);
      setInteracoes(interacoesRes.data ?? []);
    });
    return () => { cancelado = true; };
  }, [cardId, fecharPorAcessoRevogado, realtimeRevision]);

  async function recarregar() {
    const res = await ObterCardBpm(cardId);
    if (resultadoRevogaAcessoCard(res)) {
      fecharPorAcessoRevogado();
      return;
    }
    if (res.success && res.data) setCard(res.data);
  }

  const meuVinculo = card?.membros.find((m) => m.userId === currentUserId);
  const podeTrabalharNoCard = isAdminRole(currentUserRole) || Boolean(meuVinculo);
  const podeMoverEtapa = podeTrabalharNoCard;
  const podeEditar = podeTrabalharNoCard;
  const podeTrabalharTarefas = podeTrabalharNoCard;
  const podeGerenciarMembros = isAdminRole(currentUserRole)
    || meuVinculo?.role === "RESPONSAVEL"
    || meuVinculo?.role === "ADMINISTRADOR";
  const etapaAtual = card ? etapas.find((e) => e.id === card.etapa.id) ?? null : null;

  // Máquina de estado (BpmEtapaTransicaoPermitida, ver plano-novos-leads-bpm.md): se a etapa
  // atual tem QUALQUER transição cadastrada, só os destinos permitidos + a própria etapa atual
  // (referência visual) aparecem. Sem nenhuma transição cadastrada, mostra todas — mesmo
  // fallback já aplicado em MoverCardBpm, para não quebrar pipelines sem essa restrição.
  const transicoesDaEtapaAtual = card?.etapa.transicoesOrigem ?? [];
  const etapasParaMover =
    transicoesDaEtapaAtual.length > 0
      ? etapas.filter(
          (e) => e.id === card?.etapa.id || transicoesDaEtapaAtual.some((t) => t.etapaDestinoId === e.id),
        )
      : etapas;
  const estadoFollowUpAtual = card ? estadoFollowUpPorCard[card.id] ?? "CARREGANDO" : "CARREGANDO";
  const deveBloquearFechamento = followUpBloqueiaFechamento(card?.etapa.nome, estadoFollowUpAtual);

  return (
    <Sheet open onOpenChange={(open) => {
      if (open) return;
      if (deveBloquearFechamento && card) {
        const checklist = document.getElementById(`follow-up-${card.id}`);
        checklist?.scrollIntoView({ behavior: "smooth", block: "center" });
        checklist?.focus({ preventScroll: true });
        toast.error(estadoFollowUpAtual === "CARREGANDO"
          ? "Aguarde a validação do último follow-up antes de fechar este card."
          : estadoFollowUpAtual === "ERRO"
            ? "Não foi possível validar o follow-up. Recarregue a seção antes de fechar o card."
            : "Conclua o checklist do último follow-up antes de fechar este card.");
        return;
      }
      onClose();
    }}>
      <SheetContent
        side="bottom"
        className="h-[94vh] max-h-[94vh] rounded-t-[2rem] border-t border-white/10 bg-[radial-gradient(ellipse_120%_60%_at_50%_-10%,rgba(var(--accent-rgb),0.12),transparent_60%)] p-0 overflow-hidden sm:max-w-none"
        style={{ ["--accent-rgb" as string]: accent }}
      >
        {carregando ? (
          <>
            <SheetTitle className="sr-only">Carregando card</SheetTitle>
            <div className="flex-1 flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-slate-500" size={28} />
            </div>
          </>
        ) : erro || !card ? (
          <>
            <SheetTitle className="sr-only">Erro ao carregar card</SheetTitle>
            <div className="p-8 text-sm text-rose-300">{erro || "Card não encontrado"}</div>
          </>
        ) : (
          <div className="flex flex-col h-full">
            <SheetTitle className="sr-only">
              {card.empresa.nomeFantasia || card.empresa.razaoSocial}
            </SheetTitle>

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
                    onMembrosAtualizados={(membros) => {
                      setCard((atual) => atual ? { ...atual, membros } : atual);
                    }}
                    onAtualizado={() => { void recarregar(); onAtualizado(); }}
                  />
                  <TelefonesCardButton
                    cardId={card.id}
                    empresaNome={card.empresa.nomeFantasia || card.empresa.razaoSocial}
                  />
                </div>
              </div>

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
                      onAtualizado={() => { recarregar(); onAtualizado(); }}
                      etapasParaMover={etapasParaMover}
                      etapas={etapas}
                      podeEditar={podeEditar}
                      podeMoverEtapa={podeMoverEtapa}
                      podeTrabalharTarefas={podeTrabalharTarefas}
                      realtimeRevision={realtimeRevision}
                      onFocarPainelReuniao={focarPainelReuniao}
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
              <PainelRegistrar
                card={card}
                etapaAtual={etapaAtual}
                accent={accent}
                onInteracaoCriada={(nova) => setInteracoes((prev) => [nova, ...prev])}
                podeEditar={podeEditar}
                realtimeRevision={realtimeRevision}
                onAtualizado={() => { recarregar(); onAtualizado(); }}
                onEstadoFollowUpChange={atualizarEstadoFollowUp}
              />
              <div className="flex flex-col gap-4 min-h-0 overflow-y-auto">
                <PainelProximaEtapa
                  card={card}
                  etapas={etapasParaMover}
                  podeMoverEtapa={podeMoverEtapa}
                  accent={accent}
                  onMovido={() => { recarregar(); onAtualizado(); }}
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
        )}
      </SheetContent>
    </Sheet>
  );
}
