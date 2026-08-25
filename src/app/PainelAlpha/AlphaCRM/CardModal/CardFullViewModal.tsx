"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";



import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import { isAdminRole } from "@/lib/roles";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { ObterPipelineBpm } from "@/actions/bpm/Pipelines";
import { ListarInteracoesCardBpm } from "@/actions/bpm/Interacoes";


import PainelRegistrar from "./PainelRegistrar";

import {
  DadosEmpresaDrawer,
  DadosEmpresaToggle,
  useDadosEmpresaDrawer,
} from "./DadosEmpresaDrawer";



import { toast } from "sonner";
import { followUpBloqueiaFechamento, type EstadoFollowUpModal } from "@/lib/bpm/card-modal-ui";
import { resolveCardAbertoLayout } from "./pipelines";

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
          (() => {
            const Layout = resolveCardAbertoLayout(card.pipeline.nome);
            return (
              <Layout
                card={card} etapas={etapas} interacoes={interacoes}
                accent={accent} currentUserId={currentUserId} currentUserRole={currentUserRole}
                realtimeRevision={realtimeRevision} onClose={onClose}
                onAtualizado={() => { void recarregar(); onAtualizado(); }}
                onAbrirCard={onAbrirCard}
                onInteracaoCriada={(nova) => setInteracoes((prev) => [nova, ...prev])}
                onEstadoFollowUpChange={atualizarEstadoFollowUp}
                estadoFollowUpAtual={estadoFollowUpAtual}
              >
                <PainelRegistrar card={card} etapaAtual={etapaAtual} accent={accent}
                  interacoes={interacoes}
                  onInteracaoCriada={(nova) => setInteracoes((prev) => [nova, ...prev])}
                  podeEditar={podeEditar} realtimeRevision={realtimeRevision}
                  onAtualizado={() => { void recarregar(); onAtualizado(); }}
                  />
              </Layout>
            );
          })()
        )}
      </SheetContent>
    </Sheet>
  );
}
