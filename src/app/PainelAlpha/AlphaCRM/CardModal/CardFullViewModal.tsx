"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Loader2, XIcon } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";



import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import { isAdminRole } from "@/lib/roles";
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
import { type EstadoFollowUpModal } from "@/lib/bpm/card-modal-ui";
import { formularioPossuiTarget } from "@/lib/bpm/formulario-renderer";
import { BPM_CAPABILITIES } from "@/lib/bpm/ontology";
import { CardAbertoLayout } from "./CardAbertoLayout";
import { useCardSave, type PendingCardChange } from "./CardSaveContext";
const PreencherCnpjNoloss = lazy(() => import("./PreencherCnpjNoloss").then((modulo) => ({ default: modulo.PreencherCnpjNoloss })));

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type EtapaOpcao = { id: string; chave?: string | null; nome: string; ordem: number; script: string | null };
type Interacao = Awaited<ReturnType<typeof ListarInteracoesCardBpm>>["data"][number];

function resultadoRevogaAcessoCard(resultado: Awaited<ReturnType<typeof ObterCardBpm>>) {
  return (!resultado.success && ["Não autorizado", "NÃO_AUTORIZADO"].includes(resultado.error ?? "")) || (resultado.success && !resultado.data);
}

function valorParaRevisao(valor: string | undefined): string {
  if (!valor) return "Vazio";
  try {
    const lista: unknown = JSON.parse(valor);
    if (Array.isArray(lista) && lista.every((item) => typeof item === "string")) return lista.join(", ") || "Vazio";
  } catch { /* valor simples */ }
  return valor;
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
}

function CardFullViewModalContent({ cardId, realtimeRevision = 0, accent, currentUserId, currentUserRole, onClose, onAtualizado, onCardExcluido, onAbrirCard, abrirChecklistInicial = false, focarAgendamentoInicial = false }: Props) {
  const { flushSaves, flushScheduled, getPendingChanges, getFailedSaveKeys, retryFailedSaves, discardPending, subscribeConfirmation } = useCardSave();
  const fechandoRef = useRef(false);
  const [fechando, setFechando] = useState(false);
  const focoAnteriorRef = useRef<HTMLElement | null>(null);
  const [camposNaoSalvos, setCamposNaoSalvos] = useState<PendingCardChange[]>([]);
  const [salvandoNoDialogo, setSalvandoNoDialogo] = useState(false);
  const [erroNoDialogo, setErroNoDialogo] = useState(false);
  const acaoAposConfirmacaoRef = useRef<() => void>(onClose);
  useEffect(() => () => flushScheduled(`${cardId}:`), [cardId, flushScheduled]);
  const [card, setCard] = useState<CardDetalhe | null>(null);
  useEffect(() => subscribeConfirmation(cardId, (confirmed) => setCard(confirmed)), [cardId, subscribeConfirmation]);
  const [etapas, setEtapas] = useState<EtapaOpcao[]>([]);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<string>("card");
  const [estadoFollowUpPorCard, setEstadoFollowUpPorCard] = useState<Record<string, EstadoFollowUpModal>>({});
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

  const recarregar = useCallback(async () => {
    const res = await ObterCardBpm(cardId);
    if (resultadoRevogaAcessoCard(res)) {
      fecharPorAcessoRevogado();
      return;
    }
    if (res.success && res.data) setCard(res.data);
  }, [cardId, fecharPorAcessoRevogado]);

  const handleAtualizado = useCallback(() => {
    void recarregar();
    onAtualizado();
  }, [onAtualizado, recarregar]);

  const meuVinculo = card?.membros.find((m) => m.userId === currentUserId);
  const podeAgirNaEtapa = card?.permissaoEtapa?.podeAgir ?? true;
  const podeTrabalharNoCard = !card?.encaminhado && (isAdminRole(currentUserRole)
    || (Boolean(meuVinculo) && podeAgirNaEtapa));
  const podeMoverEtapa = podeTrabalharNoCard;
  const podeEditar = podeTrabalharNoCard;
  const podeTrabalharTarefas = podeTrabalharNoCard;
  const podeGerenciarMembros = !card?.encaminhado && (isAdminRole(currentUserRole)
    || meuVinculo?.role === "RESPONSAVEL" || meuVinculo?.role === "ADMINISTRADOR");
  const etapaAtual = card ? etapas.find((e) => e.id === card.etapa.id) ?? null : null;

  const estadoFollowUpAtual = card ? estadoFollowUpPorCard[card.id] ?? "CARREGANDO" : "CARREGANDO";
  const deveBloquearFechamento = Boolean(
    card &&
    formularioPossuiTarget(card.formularioEtapa, BPM_CAPABILITIES.FOLLOW_UP_CHECKLIST) &&
    ["CARREGANDO", "ERRO", "EM_ANDAMENTO"].includes(estadoFollowUpAtual),
  );

  function listarAlteracoesNaoSalvas(): PendingCardChange[] {
    const alteracoes = getPendingChanges(cardId);
    if (alteracoes.length) return alteracoes;
    const falhas = getFailedSaveKeys(cardId);
    return falhas.length ? falhas.map((key) => {
      const campoId = key.split(":arquivo:")[1];
      const campo = card?.camposEtapa.find((item) => item.id === campoId);
      return { label: campo?.nome ?? "Alteração no card" };
    }) : [{ label: "Alteração no card" }];
  }

  async function solicitarFechamento(aoConcluir: () => void = onClose) {
    if (deveBloquearFechamento && card) {
      const checklist = document.getElementById(`follow-up-${card.id}`);
      checklist?.scrollIntoView({ behavior: "smooth", block: "center" });
      checklist?.focus({ preventScroll: true });
      toast.error(estadoFollowUpAtual === "CARREGANDO"
        ? "Aguarde a validação do último follow-up antes de fechar este card."
        : estadoFollowUpAtual === "ERRO"
          ? "Não foi possível validar o follow-up. Recarregue a seção antes de fechar o card."
          : "Conclua o procedimento do último follow-up antes de fechar este card.");
      return;
    }
    if (fechandoRef.current || camposNaoSalvos.length) return;
    fechandoRef.current = true;
    setFechando(true);
    focoAnteriorRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    acaoAposConfirmacaoRef.current = aoConcluir;
    try {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      await Promise.resolve();
      const savesConcluidos = await flushSaves(cardId);
      if (!savesConcluidos) {
        setCamposNaoSalvos(listarAlteracoesNaoSalvas());
        return;
      }
      aoConcluir();
    } catch {
      setCamposNaoSalvos(listarAlteracoesNaoSalvas());
      setErroNoDialogo(true);
    } finally {
      fechandoRef.current = false;
      setFechando(false);
    }
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
        className="[&>button:last-child]:hidden h-[94vh] max-h-[94vh] rounded-t-[2rem] border-t border-white/10 bg-[radial-gradient(ellipse_120%_60%_at_50%_-10%,rgba(var(--accent-rgb),0.12),transparent_60%)] p-0 overflow-hidden sm:max-w-none"
        style={{ ["--accent-rgb" as string]: accent }}
      >
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <span role="status" aria-live="polite" className="text-xs text-slate-200">
            {fechando ? "Salvando alterações…" : ""}
          </span>
          <button
            type="button"
            aria-label="Fechar"
            aria-busy={fechando}
            aria-disabled={fechando}
            onClick={() => { void solicitarFechamento(); }}
            className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {fechando
              ? <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
              : <XIcon aria-hidden="true" className="size-4" />}
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
                  && <Suspense fallback={null}><PreencherCnpjNoloss cardId={card.id} onAtualizado={handleAtualizado} /></Suspense>}
                <PainelRegistrar card={card} etapaAtual={etapaAtual} accent={accent}
                  podeEditar={podeEditar} realtimeRevision={realtimeRevision}
                  currentUserRole={currentUserRole}
                   onAtualizado={handleAtualizado}
                   onEstadoFollowUpChange={atualizarEstadoFollowUp}
                   />
                {card.pipeline.nome === "Financeiro" && card.status === "CONCLUIDO" &&
                  <PainelNotaFiscalConcluida cardId={card.id} onAtualizado={handleAtualizado} />}
              </CardAbertoLayout>
        )}
        <AlertDialog open={camposNaoSalvos.length > 0} onOpenChange={(open) => { if (!open && !salvandoNoDialogo) { setCamposNaoSalvos([]); setErroNoDialogo(false); } }}>
          <AlertDialogContent onCloseAutoFocus={(event) => { event.preventDefault(); focoAnteriorRef.current?.focus(); }}>
            <AlertDialogHeader>
              <AlertDialogTitle>Revisar alterações</AlertDialogTitle>
              <AlertDialogDescription>O salvamento não foi confirmado. Confira o que mudou e escolha como continuar.</AlertDialogDescription>
            </AlertDialogHeader>
            <ul className="max-h-60 space-y-2 overflow-auto text-sm text-foreground">
              {camposNaoSalvos.map((alteracao, indice) => <li key={`${alteracao.label}-${indice}`} className="rounded-lg border border-border p-3">
                <strong className="block">{alteracao.label}</strong>
                {(alteracao.before !== undefined || alteracao.after !== undefined) && <div className="mt-2 grid gap-1 text-xs">
                  <p className="break-words whitespace-pre-wrap"><span className="font-semibold">Antes:</span> {valorParaRevisao(alteracao.before)}</p>
                  <p className="break-words whitespace-pre-wrap"><span className="font-semibold">Alterado para:</span> {valorParaRevisao(alteracao.after)}</p>
                </div>}
              </li>)}
            </ul>
            {erroNoDialogo && <p role="alert" className="text-sm text-destructive">Ainda não foi possível salvar. Revise os campos ou tente novamente.</p>}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={salvandoNoDialogo}>Continuar editando</AlertDialogCancel>
              <button type="button" disabled={salvandoNoDialogo} className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50" onClick={async () => {
                setSalvandoNoDialogo(true);
                setErroNoDialogo(false);
                try {
                  const salvo = await retryFailedSaves(cardId);
                  if (salvo) {
                    setCamposNaoSalvos([]);
                    acaoAposConfirmacaoRef.current();
                  } else {
                    setCamposNaoSalvos(listarAlteracoesNaoSalvas());
                    setErroNoDialogo(true);
                  }
                } catch {
                  setCamposNaoSalvos(listarAlteracoesNaoSalvas());
                  setErroNoDialogo(true);
                } finally {
                  setSalvandoNoDialogo(false);
                }
              }}>{salvandoNoDialogo ? "Salvando…" : "Salvar alterações"}</button>
              <AlertDialogAction disabled={salvandoNoDialogo} className="bg-destructive text-white hover:bg-destructive/90" onClick={() => {
                discardPending(cardId);
                toast.warning("As alterações pendentes foram descartadas.");
                acaoAposConfirmacaoRef.current();
              }}>Sair sem salvar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

export default function CardFullViewModal(props: Props) {
  return <CardFullViewModalContent key={props.cardId} {...props} />;
}
