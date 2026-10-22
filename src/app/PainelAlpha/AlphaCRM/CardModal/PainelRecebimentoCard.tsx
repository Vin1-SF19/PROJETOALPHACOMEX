"use client";
import { useRef, useState } from "react";
import type { ReactNode } from "react";
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
  contextoEtapa?: ReactNode;
}
const setorNome = { COMERCIAL: "Comercial", FINANCEIRO: "Financeiro", OPERACIONAL: "Operacional" };
export function PainelRecebimentoCard({ cardId, versao, pipelineNome, recebimento, onAtualizado, contextoEtapa }: PainelRecebimentoCardProps) {
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
    className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
    {contextoEtapa}
    {recebimento.responsaveisAnteriores.map((pessoa) => <div key={`${pessoa.pipelineId}:${pessoa.usuarioId}`}
      className="min-w-0 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Responsável no {setorNome[pessoa.setor]}:</p>{" "}
      <p className="mt-1 break-words text-xs font-medium text-slate-100">{pessoa.nome}</p>
    </div>)}
    <div className="min-w-0 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {assumido ? <CheckCircle2 className="size-3.5 text-emerald-400" aria-hidden="true" /> : <Users className="size-3.5 text-amber-300" aria-hidden="true" />}
        {assumido ? `Responsável no ${pipelineNome}:` : `${pipelineNome}:`}
      </p>{" "}
      <p className="mt-1 break-words text-xs font-medium text-slate-100">{assumido ? recebimento.assumidoPor?.nome || "Responsável confirmado" : "ninguém assumiu ainda"}</p>
      {!assumido && recebimento.podeAssumir && <button type="button" disabled={salvando || confirmado} onClick={() => void assumir()}
      className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg border border-sky-400/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-100 transition-colors hover:bg-sky-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-wait disabled:opacity-60">
      {salvando ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UserPlus className="size-4" aria-hidden="true" />}
      {salvando ? "Assumindo..." : confirmado ? "Assumido" : "Assumir card"}
      </button>}
    </div>
    {!assumido && !recebimento.podeAssumir && <div className="min-w-0 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-amber-300">Permissão nesta etapa</p>
      <p className="mt-1 break-words text-xs text-slate-300">{recebimento.motivoImpedimentoAssuncao || "Aguardando alguém com permissão para assumir nesta etapa."}</p>
    </div>}
    {confirmado && !assumido && <p role="status" className="col-span-full text-xs text-emerald-300">Assunção confirmada. Atualizando responsáveis...</p>}
    {erro && <p role="alert" className="col-span-full text-xs text-rose-300">{erro}</p>}
  </section>;
}
