"use client";

import { lazy, Suspense, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useCardModalHost } from "./CardModalHost";
import { PerfilEmpresaProvider } from "@/components/PerfilEmpresaGlobal/PerfilEmpresaProvider";
import { Loader2, XIcon } from "lucide-react";



import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import { medirFaseCrm } from "@/lib/bpm/medicao-ui";
import { isAdminRole } from "@/lib/roles";
import { etapaEhBoasVindas, PIPELINE_OPERACIONAL_ATIVO_ID, podeAgirBoasVindasOperacional } from "@/lib/bpm/boas-vindas";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { ObterPipelineBpm } from "@/actions/bpm/Pipelines";
import { ListarInteracoesCardBpm } from "@/actions/bpm/Interacoes";


import PainelRegistrar from "./PainelRegistrar";
import { PainelNotaFiscalConcluida } from "./PainelNotaFiscalConcluida";

import {
  DadosEmpresaDrawer,
  DadosEmpresaToggle,
  useDadosEmpresaDrawer,
} from "./DadosEmpresaDrawer";



import { toast } from "sonner";
import { BPM_FIELD_KEYS } from "@/lib/bpm/ontology";
import { CardAbertoLayout } from "./CardAbertoLayout";
import { PainelBoasVindasOperacional } from "./PainelBoasVindasOperacional";
import { PainelAlinhamentoEstrategico } from "./PainelAlinhamentoEstrategico";
import { PainelEnvioChecklistOperacional } from "./PainelEnvioChecklistOperacional";
import { CAMPO_CHECKLIST_EXCEL, ETAPA_ENVIO_CHECKLIST_ID, TITULO_TAREFA_CHECKLIST } from "@/lib/bpm/checklist-envio-operacional";
import { etapaEhAlinhamentoEstrategico } from "@/lib/bpm/alinhamento-estrategico";
import { useCardSave } from "./CardSaveContext";
import { chaveEditorEmpresa } from "@/lib/bpm/dados-empresa-edicao";
const PreencherCnpjNoloss = lazy(() => import("./PreencherCnpjNoloss").then((modulo) => ({ default: modulo.PreencherCnpjNoloss })));

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type EtapaOpcao = { id: string; chave?: string | null; nome: string; ordem: number; script: string | null };
type Interacao = Awaited<ReturnType<typeof ListarInteracoesCardBpm>>["data"][number];

function resultadoRevogaAcessoCard(resultado: Awaited<ReturnType<typeof ObterCardBpm>>) {
  return (!resultado.success && ["Não autorizado", "NÃO_AUTORIZADO"].includes(resultado.error ?? "")) || (resultado.success && !resultado.data);
}

interface Props {
  cardId: string;
  realtimeRevision?: number;
  accent: string;
  currentUserId: number | null;
  currentUserRole: string | null;
  onClose: () => void;
  onAtualizado: () => void;
  onCardExcluido?: (cardId: string) => void;
  onAbrirCard: (cardId: string) => void;
  abrirChecklistInicial?: boolean;
  focarAgendamentoInicial?: boolean;
  focoTarefa?: { cardId: string; tarefaId: string } | null;
  focoAnexos?: { cardId: string } | null;
}

function CardFullViewModalContent({ cardId, realtimeRevision = 0, accent, currentUserId, currentUserRole, onClose, onAtualizado, onCardExcluido, onAbrirCard, abrirChecklistInicial = false, focarAgendamentoInicial = false, focoTarefa, focoAnexos }: Props) {
  const { flushSavesInBackground, subscribeConfirmation, setDraft, setPendingFields, clearFailedSave } = useCardSave();
  const fechandoRef = useRef(false);
  useEffect(() => () => flushSavesInBackground(cardId), [cardId, flushSavesInBackground]);
  const [card, setCard] = useState<CardDetalhe | null>(null);
  const ultimaConsultaRef = useRef(0);
  const confirmarSnapshot = useCallback((novo: CardDetalhe) => {
    setCard((atual) => atual?.id === novo.id && (
      atual.versao > novo.versao || new Date(atual.updatedAt).getTime() > new Date(novo.updatedAt).getTime()
    ) ? atual : novo);
  }, []);
  useEffect(() => subscribeConfirmation(cardId, (confirmed) => {
    ultimaConsultaRef.current += 1;
    confirmarSnapshot(confirmed);
  }), [cardId, subscribeConfirmation, confirmarSnapshot]);
  const [etapas, setEtapas] = useState<EtapaOpcao[]>([]);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<string>("card");
  const acessoRevogadoRef = useRef(false);
  const checklistInicialAbertoRef = useRef<string | null>(null);
  const agendamentoInicialFocadoRef = useRef<string | null>(null);
  const dadosEmpresaDrawer = useDadosEmpresaDrawer(cardId);
  const fecharPorAcessoRevogado = useCallback(() => {
    if (acessoRevogadoRef.current) return;
    acessoRevogadoRef.current = true;
    toast.error("Seu acesso a este card foi removido.");
    onClose();
  }, [onClose]);
  const focarPainelReuniao = useCallback(() => {
    const painel = document.getElementById(`formulario-etapa-${cardId}`);
    painel?.scrollIntoView({ behavior: "smooth", block: "center" });
    painel?.focus({ preventScroll: true });
  }, [cardId]);

  const carregando = card?.id !== cardId && erro === null;

  useEffect(() => {
    let cancelado = false;

    const consulta = ++ultimaConsultaRef.current;
    ObterCardBpm(cardId).then((res) => {
      if (cancelado) return;
      if (!res.success || !res.data) {
        if (consulta !== ultimaConsultaRef.current) return;
        if (resultadoRevogaAcessoCard(res)) {
          fecharPorAcessoRevogado();
          return;
        }
        setErro(typeof res.error === "string" ? res.error : "Erro ao carregar card");
        return;
      }
      confirmarSnapshot(res.data);

      Promise.all([
        ObterPipelineBpm(res.data.pipeline.id),
        ListarInteracoesCardBpm(cardId),
      ]).then(([pipelineRes, interacoesRes]) => {
        if (cancelado) return;
        if (pipelineRes.success && pipelineRes.data) {
          setEtapas([...pipelineRes.data.etapas].sort((a, b) => a.ordem - b.ordem));
        }
        if (consulta === ultimaConsultaRef.current) setInteracoes(interacoesRes.data ?? []);
      }).catch(() => { /* Metadados indisponíveis não invalidam o card já carregado. */ });
    }).catch(() => {
      if (!cancelado && consulta === ultimaConsultaRef.current) setErro("Não foi possível carregar o card. Tente novamente.");
    });

    return () => { cancelado = true; };
  }, [cardId, fecharPorAcessoRevogado, confirmarSnapshot]);

  useEffect(() => {
    if (!abrirChecklistInicial || card?.id !== cardId || checklistInicialAbertoRef.current === cardId) return;
    checklistInicialAbertoRef.current = cardId;
    const timeout = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("bpm:abrir-pendencias-checklist", {
        detail: { cardId },
      }));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [abrirChecklistInicial, card?.id, cardId]);

  useEffect(() => {
    if (!focarAgendamentoInicial || card?.id !== cardId || agendamentoInicialFocadoRef.current === cardId) return;
    agendamentoInicialFocadoRef.current = cardId;
    const timeout = window.setTimeout(() => {
      focarPainelReuniao();
      document.getElementById(`reuniao-data-hora-${cardId}`)?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [card?.id, cardId, focarAgendamentoInicial, focarPainelReuniao]);

  useEffect(() => {
    if (realtimeRevision === 0) return;
    let cancelado = false;
    const consulta = ++ultimaConsultaRef.current;
    Promise.all([ObterCardBpm(cardId), ListarInteracoesCardBpm(cardId)]).then(([cardRes, interacoesRes]) => {
      if (cancelado || consulta !== ultimaConsultaRef.current) return;
      if (resultadoRevogaAcessoCard(cardRes)) {
        fecharPorAcessoRevogado();
        return;
      }
      if (cardRes.success && cardRes.data) confirmarSnapshot(cardRes.data);
      setInteracoes(interacoesRes.data ?? []);
    }).catch(() => { /* A próxima atualização pode recuperar a leitura, sem erro de salvamento. */ });
    return () => { cancelado = true; };
  }, [cardId, fecharPorAcessoRevogado, realtimeRevision, confirmarSnapshot]);

  const recarregar = useCallback(async () => {
    if (fechandoRef.current) return;
    const consulta = ++ultimaConsultaRef.current;
    try {
      const res = await medirFaseCrm("atualizacao", () => ObterCardBpm(cardId));
      if (fechandoRef.current || consulta !== ultimaConsultaRef.current) return;
      if (resultadoRevogaAcessoCard(res)) {
        fecharPorAcessoRevogado();
        return;
      }
      if (res.success && res.data) confirmarSnapshot(res.data);
    } catch { /* Falha de atualização não descarta o snapshot confirmado nem bloqueia fechar. */ }
  }, [cardId, fecharPorAcessoRevogado, confirmarSnapshot]);

  const handleAtualizado = useCallback(() => {
    void recarregar();
    onAtualizado();
  }, [onAtualizado, recarregar]);

  const meuVinculo = card?.membros.find((m) => m.userId === currentUserId);
  const podeAgirNaEtapa = card?.permissaoEtapa?.podeAgir ?? true;
  const restritoBoasVindas = card?.pipelineId === PIPELINE_OPERACIONAL_ATIVO_ID
    && etapaEhBoasVindas(card.etapa.nome);
  const permitidoBoasVindas = !restritoBoasVindas
    || (currentUserId !== null && podeAgirBoasVindasOperacional(currentUserId, currentUserRole));
  const podeTrabalharNoCard = permitidoBoasVindas && !card?.encaminhado && (isAdminRole(currentUserRole)
    || (Boolean(meuVinculo) && podeAgirNaEtapa));
  const podeMoverEtapa = Boolean(card?.podeMoverLivremente) || podeTrabalharNoCard;
  const podeEditar = podeTrabalharNoCard;
  const podeTrabalharTarefas = podeTrabalharNoCard;
  const podeGerenciarMembros = permitidoBoasVindas && !card?.encaminhado && (isAdminRole(currentUserRole)
    || meuVinculo?.role === "RESPONSAVEL" || meuVinculo?.role === "ADMINISTRADOR");
  const etapaAtual = card ? etapas.find((e) => e.id === card.etapa.id) ?? null : null;

  function solicitarFechamento(aoConcluir: () => void = onClose) {
    if (fechandoRef.current) return;
    fechandoRef.current = true;
    // Blur captura a última edição; a fila pertence ao layout e continua viva
    // depois de dispensar o card, sem submeter formulários manuais.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    flushSavesInBackground(cardId);
    aoConcluir();
  }

  return (
    <Sheet open onOpenChange={(open) => {
      if (open) return;
      void solicitarFechamento();
    }}>
      <SheetContent
        side="bottom"
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          void solicitarFechamento();
        }}
        onPointerDownOutside={(event) => {
          event.preventDefault();
          void solicitarFechamento();
        }}
        className="[&>button:last-child]:hidden h-[94vh] max-h-[94vh] rounded-t-[2rem] border-t border-white/10 bg-[var(--crm-painel-card,#141b24)] p-0 overflow-hidden sm:max-w-none"
        style={{ ["--accent-rgb" as string]: accent }}
      >
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => { void solicitarFechamento(); }}
            className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <XIcon aria-hidden="true" className="size-4" />
            <span className="sr-only">Fechar</span>
          </button>
        </div>
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
              <CardAbertoLayout
                key={card.id}
                focoTarefa={focoTarefa}
                focoAnexos={focoAnexos}
                card={card} etapas={etapas} interacoes={interacoes}
                accent={accent} currentUserId={currentUserId} currentUserRole={currentUserRole}
                realtimeRevision={realtimeRevision} onClose={solicitarFechamento}
                onAtualizado={handleAtualizado}
                onCardExcluido={onCardExcluido}
                onAbrirCard={(id) => { void solicitarFechamento(() => onAbrirCard(id)); }}
                onInteracaoCriada={(nova) => setInteracoes((prev) => [nova, ...prev])}
              >
                {card.pipeline.nome === "Revisão de Radar" && card.nolossLeadOrigem.length > 0
                  && !card.empresa.cnpj && podeEditar
                  && <Suspense fallback={null}><PreencherCnpjNoloss cardId={card.id} onAtualizado={() => {
                    handleAtualizado();
                    if (dadosEmpresaDrawer.aberto || dadosEmpresaDrawer.dados) dadosEmpresaDrawer.recarregar();
                  }}
                    onVinculado={(dados) => {
                      const chave = chaveEditorEmpresa(card.id);
                      setDraft(chave); setPendingFields(chave, []); clearFailedSave(chave);
                      dadosEmpresaDrawer.confirmarDados(dados);
                    }} /></Suspense>}
                {restritoBoasVindas &&
                  <PainelBoasVindasOperacional cardId={card.id}
                    emailInicial={card.emailClienteReuniao ?? null}
                    dataReuniao={card.dataReuniao ?? null}
                    googleMeetLink={card.googleMeetLink ?? null}
                    responsavelNome={card.responsavel.nome}
                    podeEditar={podeEditar} onAtualizado={handleAtualizado} />}
                {card.pipelineId === PIPELINE_OPERACIONAL_ATIVO_ID && etapaEhAlinhamentoEstrategico(card.etapa.nome) &&
                  <PainelAlinhamentoEstrategico cardId={card.id} dataReuniao={card.dataReuniao ?? null}
                    googleEventId={card.googleEventId ?? null}
                    responsavelNome={card.responsavel.nome}
                    linkResumo={card.campoValores.find((valor) =>
                      valor.campo.chave === BPM_FIELD_KEYS.STRATEGIC_ALIGNMENT_SUMMARY_LINK)?.valor ?? null} />}
                {card.pipelineId === PIPELINE_OPERACIONAL_ATIVO_ID && card.etapa.id === ETAPA_ENVIO_CHECKLIST_ID && (() => {
                  const valor = card.campoValores.find((item) => item.campo.chave === CAMPO_CHECKLIST_EXCEL);
                  const anexo = card.anexos.find((item) => item.id === valor?.valor) ?? null;
                  const tarefa = card.tarefas.find((item) => item.titulo.startsWith(TITULO_TAREFA_CHECKLIST)) ?? null;
                  return <PainelEnvioChecklistOperacional dataReuniao={card.dataReuniao ?? null}
                    anexo={anexo} tarefa={tarefa} />;
                })()}
                <PainelRegistrar card={card} etapaAtual={etapaAtual} accent={accent}
                  podeEditar={podeEditar} realtimeRevision={realtimeRevision}
                  currentUserRole={currentUserRole}
                   onAtualizado={handleAtualizado}
                   />
                {card.pipeline.nome === "Financeiro" && card.status === "CONCLUIDO" &&
                  <PainelNotaFiscalConcluida cardId={card.id} onAtualizado={handleAtualizado} />}
              </CardAbertoLayout>
        )}

      </SheetContent>
    </Sheet>
  );
}

export default function CardFullViewModal(props: Props) {
  const host = useCardModalHost();
  const owner = useId();
  useLayoutEffect(() => {
    if (!host) return;
    host.attach(owner);
    return () => host.detach(owner);
  }, [host, owner]);
  useLayoutEffect(() => {
    if (!host) return;
    const content = (active: Props) => <PerfilEmpresaProvider key={active.cardId}><CardFullViewModalContent key={active.cardId} {...active}
      onClose={() => { const notify = host.close(owner, active.cardId); if (notify && host.isAttached(owner)) active.onClose(); }}
      onAtualizado={() => { if (host.isAttached(owner)) active.onAtualizado(); }}
      onCardExcluido={(id) => { if (host.isAttached(owner)) active.onCardExcluido?.(id); else host.close(owner, active.cardId); }}
      onAbrirCard={(id) => {
        if (host.isAttached(owner)) {
          if (host.releaseForNavigation(owner, active.cardId)) active.onAbrirCard(id);
        }
        else {
          const next = { ...active, cardId: id, focoTarefa: null, focoAnexos: null, abrirChecklistInicial: false, focarAgendamentoInicial: false };
          host.replaceDetached({ owner, cardId: id, node: content(next) });
        }
      }}
    /></PerfilEmpresaProvider>;
    host.publish({ owner, cardId: props.cardId, node: content(props) });
  }, [host, owner, props]);
  if (host) return null;
  return <CardFullViewModalContent key={props.cardId} {...props} />;
}
