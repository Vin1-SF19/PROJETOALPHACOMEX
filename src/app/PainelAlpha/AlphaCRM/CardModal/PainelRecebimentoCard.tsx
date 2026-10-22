"use client";
import { useRef, useState } from "react";
import { CheckCircle2, Loader2, UserPlus, Users } from "lucide-react";
import { AssumirRecebimentoPipelineBpm } from "@/actions/bpm/Recebimentos";
import type { RecebimentoPipelineBpm } from "@/lib/bpm/notificacoes-leads";
import { solicitarReconciliacaoLeadsBpm } from "@/lib/bpm/notificacoes-navegacao";

interface PainelRecebimentoCardProps {
  cardId: string;
  versao: number;
  pipelineNome: string;
  recebimento: RecebimentoPipelineBpm;
  onAtualizado: () => void;
}
const setorNome = { COMERCIAL: "Comercial", FINANCEIRO: "Financeiro", OPERACIONAL: "Operacional" };
export function PainelRecebimentoCard({ cardId, versao, pipelineNome, recebimento, onAtualizado }: PainelRecebimentoCardProps) {
  const [salvando, setSalvando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emCurso = useRef(false);
  const assumido = recebimento.status === "ASSUMIDO";
  async function assumir() {
    if (emCurso.current || confirmado || !recebimento.podeAssumir || assumido) return;
    emCurso.current = true; setSalvando(true); setErro(null);
    try {
      const resultado = await AssumirRecebimentoPipelineBpm({ cardId, recepcaoId: recebimento.recepcaoId, versaoEsperada: versao });
      if (!resultado.success) {
        setErro(resultado.error || "Não foi possível assumir. Atualize o card e tente novamente.");
        onAtualizado(); solicitarReconciliacaoLeadsBpm(); return;
      }
      setConfirmado(true);
      onAtualizado(); solicitarReconciliacaoLeadsBpm();
    } catch { setErro("Não foi possível confirmar a assunção. Tente novamente."); }
    finally { emCurso.current = false; setSalvando(false); }
  }
  return <section aria-label="Responsáveis por setor" aria-busy={salvando}
    className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0 space-y-1 text-xs text-slate-300">
      {recebimento.responsaveisAnteriores.map((pessoa) => <p key={`${pessoa.pipelineId}:${pessoa.usuarioId}`}>
        Responsável no {setorNome[pessoa.setor]}: <span className="font-medium text-slate-100">{pessoa.nome}</span>
      </p>)}
      <p className="flex items-center gap-1.5 font-medium text-slate-100">
        {assumido ? <CheckCircle2 className="size-3.5 text-emerald-400" aria-hidden="true" /> : <Users className="size-3.5 text-amber-300" aria-hidden="true" />}
        {assumido ? `Responsável no ${pipelineNome}: ${recebimento.assumidoPor?.nome || "Responsável confirmado"}` : `${pipelineNome}: ninguém assumiu ainda`}
      </p>
      {!assumido && !recebimento.podeAssumir && <p className="text-slate-400">{recebimento.motivoImpedimentoAssuncao || "Aguardando alguém com permissão para assumir nesta etapa."}</p>}
      {confirmado && !assumido && <p role="status" className="text-emerald-300">Assunção confirmada. Atualizando responsáveis...</p>}
      {erro && <p role="alert" className="max-w-lg text-rose-300">{erro}</p>}
    </div>
    {!assumido && recebimento.podeAssumir && <button type="button" disabled={salvando || confirmado} onClick={() => void assumir()}
      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-xs font-semibold text-sky-100 transition-colors hover:bg-sky-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-wait disabled:opacity-60">
      {salvando ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UserPlus className="size-4" aria-hidden="true" />}
      {salvando ? "Assumindo..." : confirmado ? "Assumido" : "Assumir card"}
    </button>}
  </section>;
}
