"use client";

import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { ObterEncaminhamentosCardBpm, RecuperarEncaminhamentoFinanceiroCardBpm, SolicitarEncaminhamentoCardBpm, RepetirEncaminhamentoCardBpm, type EncaminhamentoCardBpm } from "@/actions/bpm/Encaminhamentos";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCardSave } from "./CardSaveContext";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
interface PainelEncaminhamentosProps {
  card: CardDetalhe;
  realtimeRevision: number;
  onAtualizado: () => void;
  onAbrirCard: (cardId: string) => void;
}
const ROTULOS = { NAO_DISPARADO: "Não enviado", AGUARDANDO: "Aguardando envio", ENVIADO: "Enviado", FALHOU: "Falha no envio", INDISPONIVEL: "Indisponível" };
function horario(valor: string | null) {
  return valor ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(valor)) : null;
}

export function PainelEncaminhamentos(props: PainelEncaminhamentosProps) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5_000 } } }));
  return <QueryClientProvider client={client}><EncaminhamentosConteudo {...props} /></QueryClientProvider>;
}

function EncaminhamentosConteudo({ card, realtimeRevision, onAtualizado, onAbrirCard }: PainelEncaminhamentosProps) {
  const { flushSaves } = useCardSave();
  const operacaoRef = useRef(false);
  const recuperacoesRef = useRef(new Set<string>());
  const [processando, setProcessando] = useState(false);
  const [confirmacao, setConfirmacao] = useState<EncaminhamentoCardBpm | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const consulta = useQuery({
    queryKey: ["crm-encaminhamentos", card.id, card.etapa.id, card.versao, card.updatedAt, realtimeRevision],
    queryFn: async () => {
      const resultado = await ObterEncaminhamentosCardBpm(card.id);
      if (!resultado.success) throw new Error(resultado.error);
      return resultado.data.regras;
    },
    refetchInterval: (query) => query.state.data?.some((regra) => regra.estado === "AGUARDANDO") ? 5_000 : false,
  });

  async function enviar(regra: EncaminhamentoCardBpm, automatico = regra.automaticoFinanceiro === true) {
    if (operacaoRef.current) return;
    operacaoRef.current = true;
    setProcessando(true);
    setErroEnvio(null);
    const inicio = performance.now();
    try {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      if (!await flushSaves(card.id)) throw new Error("Não foi possível salvar os campos. O encaminhamento não foi enviado.");
      // O flush pode ter alterado a versão. Releitura autenticada evita enviar
      // uma versão capturada antes da confirmação das próprias gravações.
      const atual = await ObterCardBpm(card.id);
      if (!atual.success || !atual.data) throw new Error("Não foi possível confirmar o estado atual do card.");
      if (atual.data.etapa.id !== card.etapa.id) throw new Error("A etapa mudou. Revise o card antes de encaminhar.");
      const resultado = regra.podeRepetir && regra.execucaoId
        ? await RepetirEncaminhamentoCardBpm({ cardId: card.id, execucaoId: regra.execucaoId })
        : await (automatico ? RecuperarEncaminhamentoFinanceiroCardBpm : SolicitarEncaminhamentoCardBpm)({ cardId: card.id, automacaoId: regra.automacaoId,
          etapaOrigemEsperadaId: atual.data.etapa.id, versaoEsperada: atual.data.versao, idempotencyKey: crypto.randomUUID() });
      if (!resultado.success) throw new Error(resultado.error);
      toast.success(resultado.data.existente ? "Encaminhamento já realizado. O destino existente foi preservado." : "Card encaminhado com sucesso.");
      setConfirmacao(null);
      onAtualizado();
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Não foi possível encaminhar o card.";
      setErroEnvio(mensagem);
      toast.error(mensagem);
    } finally {
      operacaoRef.current = false;
      setProcessando(false);
      performance.measure("crm:encaminhamento:duracao", { start: inicio, end: performance.now() });
      void consulta.refetch();
    }
  }

  useEffect(() => {
    const regra = consulta.data?.find(item => item.automaticoFinanceiro && item.podeEnviar && item.estado === "NAO_DISPARADO");
    if (!regra || operacaoRef.current) return;
    const chave = `${card.id}:${regra.automacaoId}:${regra.destinoPipeline.id}:${regra.destinoEtapa.id}`;
    if (recuperacoesRef.current.has(chave)) return;
    recuperacoesRef.current.add(chave);
    void enviar(regra, true);
    // A consulta versionada dispara uma tentativa; a referência impede loops e StrictMode duplicado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta.data, card.id]);

  return <section aria-label="Encaminhamentos entre setores" aria-busy={processando} className="space-y-3 rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
    <h2 className="text-xs font-bold uppercase tracking-wide text-slate-200">Encaminhamentos</h2>
    <p className="text-[11px] text-slate-400">{consulta.data?.some(regra => regra.automaticoFinanceiro) ? "O fechamento comercial encaminha automaticamente o card ao Financeiro. Acompanhe o envio aqui." : "O envio ao próximo setor é acompanhado aqui."}</p>
    {consulta.isPending && <p role="status" className="flex items-center gap-2 text-xs text-slate-400"><Loader2 size={13} className="animate-spin" /> Consultando encaminhamentos…</p>}
    {consulta.isError && <div role="alert" className="text-xs text-amber-200"><p>Não foi possível consultar os encaminhamentos.</p><button type="button" className="mt-2 underline" onClick={() => void consulta.refetch()}>Tentar novamente</button></div>}
    {consulta.data?.length === 0 && <p className="text-xs text-slate-400">Não há envio para outro setor configurado nesta etapa.</p>}
    {consulta.data?.map((regra) => <div key={regra.automacaoId} className="space-y-2 border-t border-white/10 pt-3">
      <p className="text-xs font-semibold text-slate-100">{regra.destinoPipeline.nome} <span className="font-normal text-slate-400">· {regra.destinoEtapa.nome}</span></p>
      <p role="status" className="flex items-center gap-1.5 text-xs text-slate-300">{regra.estado === "ENVIADO" && <CheckCircle2 size={13} aria-hidden="true" />}{ROTULOS[regra.estado]}</p>
      {regra.motivo && <p className="text-[11px] text-slate-400">{regra.motivo}</p>}
      {(regra.enviadoEm || regra.solicitadoEm) && <p className="text-[11px] text-slate-500">{regra.enviadoEm ? "Enviado" : "Solicitado"} em {horario(regra.enviadoEm ?? regra.solicitadoEm)}</p>}
      {regra.cardDestinoId && <button type="button" className="text-xs font-semibold text-slate-200 underline" onClick={() => { if (regra.cardDestinoId) onAbrirCard(regra.cardDestinoId); }}>Abrir card de destino</button>}
      {(regra.podeEnviar || regra.podeRepetir) && (!regra.automaticoFinanceiro || Boolean(erroEnvio) || regra.estado === "FALHOU") && <button type="button" disabled={processando} onClick={() => { setErroEnvio(null); setConfirmacao(regra); }} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-50"><ArrowRight size={13} aria-hidden="true" />{regra.podeRepetir ? "Tentar este envio novamente" : `Encaminhar para ${regra.destinoPipeline.nome}`}</button>}
    </div>)}
    {consulta.data?.some(regra => regra.automaticoFinanceiro && regra.estado === "NAO_DISPARADO") && !erroEnvio && !processando && <p role="status" className="text-xs text-slate-300">Preparando encaminhamento automático para o Financeiro…</p>}
    {processando && <p role="status" className="flex items-center gap-2 text-xs text-slate-200"><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Salvando e encaminhando… Aguarde a confirmação.</p>}
    {erroEnvio && <p role="alert" className="text-xs text-amber-200">{erroEnvio}</p>}
    <Dialog open={Boolean(confirmacao)} onOpenChange={(aberto) => { if (!aberto && !processando) setConfirmacao(null); }}>
      <DialogContent className="border-white/10 bg-slate-950 text-slate-100">
        <DialogHeader><DialogTitle>Encaminhar para {confirmacao?.destinoPipeline.nome}</DialogTitle>
          <DialogDescription className="text-slate-400">O envio cria ou reutiliza um card vinculado na etapa {confirmacao?.destinoEtapa.nome}. O card de origem permanece no histórico.</DialogDescription></DialogHeader>
        {confirmacao?.excecaoAdministrativa && <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-100">Encaminhamento administrativo excepcional: este envio não confirma assinatura, pagamento ou emissão de nota fiscal e não conclui a situação financeira do card. Sua autoria ficará registrada.</p>}
        {erroEnvio && <p role="alert" className="text-sm text-amber-200">{erroEnvio}</p>}
        <DialogFooter><button type="button" disabled={processando} onClick={() => setConfirmacao(null)} className="min-h-10 rounded-lg border border-white/15 px-4 text-sm">Cancelar</button><button type="button" disabled={processando} onClick={() => { if (confirmacao) void enviar(confirmacao); }} className="min-h-10 rounded-lg border border-white/20 bg-white/10 px-4 text-sm font-semibold disabled:opacity-50">{processando ? "Encaminhando…" : "Confirmar encaminhamento"}</button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
