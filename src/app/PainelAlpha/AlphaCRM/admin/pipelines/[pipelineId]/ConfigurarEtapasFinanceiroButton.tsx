"use client";
import { useState } from "react";
import { ConfigurarPipelineFinanceiro } from "@/actions/bpm/PipelineFinanceiro";
interface ConfiguracaoFinanceira { etapas: Array<{ id: string; nome: string; ordem: number; slaDias: number | null; ativo: boolean }>; campos: Array<{ id: string; etapaId: string | null; nome: string; tipo: string; obrigatorio: boolean; ordem: number }> }
interface Props { pipelineId: string; accent: string; onConfigured: (data: ConfiguracaoFinanceira) => void }
export function ConfigurarEtapasFinanceiroButton({ pipelineId, accent, onConfigured }: Props) {
  const [isApplying, setIsApplying] = useState(false); const [feedback, setFeedback] = useState<string | null>(null);
  async function handleApply() { setIsApplying(true); setFeedback(null); const result = await ConfigurarPipelineFinanceiro(pipelineId); if (result.success && result.data) { setFeedback("Pipeline configurado com seis etapas, campos e validações."); onConfigured(result.data) } else setFeedback(typeof result.error === "string" ? result.error : "Não foi possível configurar o pipeline Financeiro."); setIsApplying(false) }
  return <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-4"><p className="text-sm font-semibold text-amber-100">Configuração financeira pendente</p><p className="mt-1 text-xs text-amber-200/70">Aplique o schema versionado de seis etapas sem recriar o pipeline nem os cards existentes.</p><button type="button" className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" style={{ background: `rgba(${accent},0.85)` }} disabled={isApplying} aria-busy={isApplying} onClick={handleApply}>{isApplying ? "Aplicando configuração…" : "Aplicar pipeline financeiro"}</button>{feedback && <p className="mt-2 text-xs text-amber-100" role="status" aria-live="polite">{feedback}</p>}</div>;
}
