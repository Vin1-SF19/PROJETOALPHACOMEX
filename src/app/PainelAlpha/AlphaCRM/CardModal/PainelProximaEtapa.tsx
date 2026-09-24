"use client";

import { toast } from "sonner";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Check, Loader2, Settings2 } from "lucide-react";
import { ObterCardBpm, MoverCardBpm, ObterRequisitosTransicaoBpm, SalvarRequisitosEMoverCardBpm, type CardFilhoCriado } from "@/actions/bpm/Cards";
import { ObterResumoChecklistCardBpm } from "@/actions/bpm/Checklists";
import { CampoBpmInput } from "@/app/PainelAlpha/AlphaCRM/CampoBpmInput";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCardSave } from "./CardSaveContext";
import { BPM_CAPABILITIES, BPM_STAGE_KEYS } from "@/lib/bpm/ontology";
import { formularioExigeCapacidade } from "@/lib/bpm/formulario-renderer";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type EtapaOpcao = { id: string; chave?: string | null; nome: string; ordem: number; script: string | null };
type RequisitosTransicao = NonNullable<Awaited<ReturnType<typeof ObterRequisitosTransicaoBpm>>["data"]>;

interface Props {
  card: CardDetalhe;
  etapas: EtapaOpcao[];
  podeMoverEtapa: boolean;
  accent: string;
  onMovido: () => void;
}

export default function PainelProximaEtapa({ card, etapas, podeMoverEtapa, accent, onMovido }: Props) {
  const router = useRouter();
  const { flushSaves } = useCardSave();
  const [movendoEtapa, setMovendoEtapa] = useState(false);
  const [requisitos, setRequisitos] = useState<RequisitosTransicao | null>(null);
  const [valoresRequisitos, setValoresRequisitos] = useState<Record<string, string>>({});
  const [pendenciasChecklist, setPendenciasChecklist] = useState<{
    quantidade: number;
    templates: string[];
    primeiroItemId: string | null;
  } | null>(null);
  const aguardandoTranscricao = card.etapa.chave === BPM_STAGE_KEYS.REUNIAO_AGENDADA
    && !card.transcricaoReuniao?.trim()
    && formularioExigeCapacidade(card.formularioEtapa, BPM_CAPABILITIES.MEETING_TRANSCRIPT);

  const carregarPendencias = useCallback(async () => {
    const resposta = await ObterResumoChecklistCardBpm({ cardId: card.id });
    if (!resposta.success) return;
    setPendenciasChecklist(resposta.data.pendentesObrigatorios > 0 ? {
      quantidade: resposta.data.pendentesObrigatorios,
      templates: resposta.data.templatesComPendencia.map((item) => item.nome),
      primeiroItemId: resposta.data.itensObrigatoriosPendentes[0]?.id ?? null,
    } : null);
  }, [card.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void carregarPendencias(), 0);
    function atualizarResumo(event: Event) {
      const detail = (event as CustomEvent<{
        cardId: string;
        pendentesObrigatorios: number;
        templates: string[];
        primeiroItemId: string | null;
      }>).detail;
      if (detail?.cardId !== card.id) return;
      setPendenciasChecklist(detail.pendentesObrigatorios > 0 ? {
        quantidade: detail.pendentesObrigatorios,
        templates: detail.templates,
        primeiroItemId: detail.primeiroItemId,
      } : null);
    }
    window.addEventListener("bpm:checklist-resumo", atualizarResumo);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("bpm:checklist-resumo", atualizarResumo);
    };
  }, [card.id, carregarPendencias]);

  function irParaPendencias() {
    window.dispatchEvent(new CustomEvent("bpm:abrir-pendencias-checklist", {
      detail: { cardId: card.id, itemId: pendenciasChecklist?.primeiroItemId ?? null },
    }));
  }

  function irParaTranscricao() {
    setRequisitos(null);
    window.setTimeout(() => {
      const campo = document.getElementById(`resumo-reuniao-${card.id}`);
      campo?.scrollIntoView({ behavior: "smooth", block: "center" });
      campo?.focus({ preventScroll: true });
    }, 0);
  }

  function confirmarMovimento(res: Awaited<ReturnType<typeof MoverCardBpm>>) {
      if (res.success) {
        setRequisitos(null);
        toast.success("Card movido");
        const filhos = (res as { cardsFilhosCriados?: CardFilhoCriado[] }).cardsFilhosCriados;
        if (filhos && filhos.length > 0) {
          for (const filho of filhos) {
            toast.success(`Card interligado criado no pipeline ${filho.pipelineNome}.`, {
              action: {
                label: "Ver card",
                onClick: () => router.push(`/PainelAlpha/AlphaCRM/pipeline/${filho.pipelineId}`),
              },
            });
          }
        }
        onMovido();
      }
      else {
        toast.error(typeof res.error === "string" ? res.error : "Não foi possível mover o card");
        if (typeof res.error === "string" && res.error.startsWith("Avanço bloqueado:")) {
          void carregarPendencias();
        }
      }
  }

  async function buscarRequisitos(etapaDestinoId: string, mostrarMesmoSemPendencias = false) {
    const resposta = await ObterRequisitosTransicaoBpm(card.id, etapaDestinoId);
    if (!resposta.success || !resposta.data) {
      toast.error(typeof resposta.error === "string" ? resposta.error : "Não foi possível consultar os requisitos da etapa.");
      return null;
    }
    if (mostrarMesmoSemPendencias || resposta.data.faltantes.length || resposta.data.guardas.length) setRequisitos(resposta.data);
    else setRequisitos(null);
    setValoresRequisitos(Object.fromEntries(resposta.data.campos.map((campo) => [campo.id, campo.valor ?? ""])));
    return resposta.data;
  }

  async function handleMover(etapaDestinoId: string) {
    if (etapaDestinoId === card.etapa.id || movendoEtapa) return;
    setMovendoEtapa(true);
    try {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      const savesConcluidos = await flushSaves(card.id);
      if (!savesConcluidos) {
        toast.error("Não foi possível salvar os campos. O card não foi movido.");
        return;
      }
      const dados = await buscarRequisitos(etapaDestinoId);
      if (!dados || dados.faltantes.length || dados.guardas.length) return;
      confirmarMovimento(await MoverCardBpm({ cardId: card.id, etapaDestinoId }));
    } finally {
      setMovendoEtapa(false);
    }
  }

  async function salvarRequisitosEMover() {
    if (!requisitos || movendoEtapa) return;
    const faltantes = requisitos.faltantes.filter((campo) => !valoresRequisitos[campo.id]?.trim());
    if (faltantes.length || requisitos.guardas.length) return;
    setMovendoEtapa(true);
    try {
      const savesConcluidos = await flushSaves(card.id);
      if (!savesConcluidos) {
        toast.error("Não foi possível salvar os campos. O card não foi movido.");
        return;
      }
      const camposValores = Object.fromEntries(requisitos.campos
        .filter((campo) => campo.editavel && !campo.somenteLeitura && (valoresRequisitos[campo.id] ?? "") !== (campo.valor ?? ""))
        .map((campo) => [campo.id, valoresRequisitos[campo.id] ?? ""]));
      confirmarMovimento(await SalvarRequisitosEMoverCardBpm({
        cardId: card.id, etapaDestinoId: requisitos.etapaDestino.id, camposValores,
      }));
    } finally {
      setMovendoEtapa(false);
    }
  }

  const camposPendentes = requisitos?.faltantes.flatMap((pendente) => {
    const campo = requisitos.campos.find((item) => item.id === pendente.id);
    return campo ? [{ ...campo, contexto: pendente.contexto, etapaAplicacaoNome: pendente.etapaAplicacaoNome }] : [];
  }) ?? [];
  const camposSemEdicao = camposPendentes.filter((campo) => !campo.editavel || campo.somenteLeitura);
  const faltantesNoRascunho = requisitos?.faltantes.filter((campo) => !valoresRequisitos[campo.id]?.trim()) ?? [];
  const camposIndisponiveis = requisitos?.faltantes.filter((pendente) => !requisitos.campos.some((campo) => campo.id === pendente.id)) ?? [];

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent overflow-y-auto p-3 space-y-1.5">
      <Dialog open={Boolean(requisitos)} onOpenChange={(aberto) => { if (!aberto && !movendoEtapa) setRequisitos(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-slate-950 text-white sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Antes de mover para {requisitos?.etapaDestino.nome}</DialogTitle>
            <DialogDescription className="text-slate-400">Preencha os campos exigidos pela configuração desta transição.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {requisitos?.guardas.map((guarda) => <p key={guarda} role="alert" className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">{guarda}</p>)}
            {aguardandoTranscricao && requisitos?.guardas.some((guarda) => guarda.includes("transcrição")) && (
              <button type="button" onClick={irParaTranscricao} className="min-h-11 rounded-lg border border-amber-300/30 px-3 text-xs font-bold text-amber-100 hover:bg-amber-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
                Ir para a transcrição da reunião
              </button>
            )}
            {camposPendentes.map((campo) => <label key={campo.id} className="block space-y-1.5 text-xs text-slate-300">
              <span className="font-semibold">{campo.nome} <span className="text-amber-300">*</span></span>
              <span className="block text-[11px] text-slate-500">{campo.etapaAplicacaoNome} · {campo.contexto === "ORIGEM" ? "exigido na saída" : "exigido na entrada"}</span>
              <CampoBpmInput campo={campo} value={valoresRequisitos[campo.id] ?? ""} onChange={(valor) => setValoresRequisitos((atuais) => ({ ...atuais, [campo.id]: valor }))} className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" disabled={movendoEtapa} readOnly={!campo.editavel || campo.somenteLeitura} cardId={card.id} />
            </label>)}
            {camposSemEdicao.length > 0 && <div role="alert" className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-xs text-amber-100">
              <p>{camposSemEdicao.map((campo) => campo.nome).join(", ")} {camposSemEdicao.length === 1 ? "está configurado como obrigatório e somente leitura" : "estão configurados como obrigatórios e somente leitura"}. Peça a um administrador para ajustar a regra em Campos e formulários.</p>
              <a href={`/PainelAlpha/AlphaCRM/admin/pipelines/${card.pipelineId}?tab=fields&etapaId=${encodeURIComponent(requisitos?.etapaDestino.id ?? "")}&campoId=${encodeURIComponent(camposSemEdicao[0]?.id ?? "")}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 font-semibold underline"><Settings2 size={13} /> Abrir regra em Campos e formulários</a>
            </div>}
            {camposIndisponiveis.length > 0 && <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-xs text-rose-100">Há um requisito sem campo acessível nesta transição. Peça ao administrador para revisar Campos e formulários da etapa.</p>}
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setRequisitos(null)} disabled={movendoEtapa} className="min-h-10 rounded-lg border border-white/15 px-4 text-xs font-semibold text-slate-300">Cancelar</button>
            <button type="button" onClick={() => void buscarRequisitos(requisitos!.etapaDestino.id, true)} disabled={movendoEtapa} className="min-h-10 rounded-lg border border-white/15 px-4 text-xs font-semibold text-slate-200">Recarregar requisitos</button>
            <button type="button" onClick={() => void salvarRequisitosEMover()} disabled={movendoEtapa || faltantesNoRascunho.length > 0 || Boolean(requisitos?.guardas.length)} className="min-h-10 rounded-lg bg-cyan-500 px-4 text-xs font-bold text-slate-950 disabled:opacity-50">{movendoEtapa ? "Movendo…" : "Salvar e mover"}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {pendenciasChecklist && (
        <div role="alert" className="mb-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-3 text-[11px] leading-relaxed text-amber-100">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-bold">
                {pendenciasChecklist.quantidade} {pendenciasChecklist.quantidade === 1 ? "item obrigatório pendente" : "itens obrigatórios pendentes"}
              </p>
              <p className="mt-1 text-amber-200/80">{pendenciasChecklist.templates.join(", ")}</p>
              <button type="button" onClick={irParaPendencias} className="mt-2 min-h-11 rounded-lg border border-amber-300/30 px-3 font-bold text-amber-100 transition hover:bg-amber-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
                Ir para pendências
              </button>
            </div>
          </div>
        </div>
      )}
      {aguardandoTranscricao && etapas.some((etapa) => [BPM_STAGE_KEYS.EM_TRATATIVA, BPM_STAGE_KEYS.SEM_VIABILIDADE].some((chave) => chave === etapa.chave)) && (
        <div role="status" className="mb-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-3 text-[11px] leading-relaxed text-amber-100">
          <p className="font-bold">Transcrição da reunião pendente</p>
          <p className="mt-1 text-amber-200/80">Para avançar, busque a transcrição do Meet ou registre o resumo da reunião no acompanhamento do card.</p>
          <button type="button" onClick={irParaTranscricao} className="mt-2 min-h-11 rounded-lg border border-amber-300/30 px-3 font-bold text-amber-100 transition hover:bg-amber-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
            Ir para a transcrição
          </button>
        </div>
      )}
      
      {etapas.map((etapa) => {
        const ativa = etapa.id === card.etapa.id;
        return (
          <button
            key={etapa.id}
            onClick={() => handleMover(etapa.id)}
            disabled={movendoEtapa || !podeMoverEtapa}
            aria-busy={movendoEtapa}
            className="w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 not-disabled:hover:bg-white/[0.07]"
            style={
              ativa
                ? {
                    background: `linear-gradient(135deg, rgb(${accent}), rgba(${accent},0.75))`,
                    color: "#0f172a",
                    boxShadow: `0 10px 30px -8px rgba(${accent},0.65), inset 0 1px 0 rgba(255,255,255,0.3)`,
                  }
                : {
                    background: "rgba(255,255,255,0.03)",
                    color: "#cbd5e1",
                    border: "1px solid rgba(255,255,255,0.06)",
                    boxShadow: "0 4px 12px -4px rgba(0,0,0,0.3)",
                  }
            }
          >
            <span className="whitespace-nowrap">{etapa.nome}</span>
            {movendoEtapa && !ativa
              ? <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden="true" />
              : ativa
                ? <Check size={15} className="shrink-0" />
                : <ArrowRight size={14} className="shrink-0 opacity-50" />}
          </button>
        );
      })}

      {!podeMoverEtapa && (
        <p className="text-[11px] text-slate-500 mt-3 px-1">
          Somente o responsável ou um administrador pode mover este card.
        </p>
      )}
    </div>
  );
}
