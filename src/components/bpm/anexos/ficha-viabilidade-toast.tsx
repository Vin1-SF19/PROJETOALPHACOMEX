"use client";

import { z } from "zod";
import { CircleCheck } from "lucide-react";
import { toast } from "sonner";
import type { ResultadoFichaViabilidade } from "@/lib/bpm/ficha-viabilidade-documento";
import { BPM_CARD_ABRIR_EVENT } from "@/lib/bpm/notificacoes-tarefas";

interface Destino { cardId: string; pipelineId: string }
const fichaToastSchema = z.object({ anexoId: z.string().min(1), empresaNome: z.string(), revision: z.number().int().positive() });
const respostaSchema = z.object({
  fichaViabilidade: fichaToastSchema.optional(), fichaViabilidadeGerada: z.boolean().optional(),
  fichaViabilidadeEstado: z.enum(["PRONTA", "PENDENTE", "FALHA", "AUSENTE"]).optional(),
  fichaViabilidadeSolicitacaoId: z.string().nullable().optional(),
});
const anunciadas = new Set<string>();
const acompanhando = new Set<string>();

export function abrirAnexosDaFicha({ cardId, pipelineId }: Destino) {
  const caminho = `/PainelAlpha/AlphaCRM/pipeline/${encodeURIComponent(pipelineId)}`;
  const url = `${caminho}?cardId=${encodeURIComponent(cardId)}&abaInicial=anexos`;
  if (window.parent !== window) window.parent.postMessage({ type: "ALPHA_OPEN_TAB", url, label: "CRM" }, window.location.origin);
  else if (window.location.pathname === caminho) window.dispatchEvent(new CustomEvent(BPM_CARD_ABRIR_EVENT, { detail: { cardId, pipelineId, abaInicial: "anexos" } }));
  else window.location.assign(url);
}

function anunciar(ficha: z.infer<typeof fichaToastSchema>, destino: Destino) {
  const chave = `${destino.cardId}:${ficha.anexoId}:${ficha.revision}`;
  if (anunciadas.has(chave)) return;
  anunciadas.add(chave);
  toast.custom((id) => <button type="button" onClick={() => { toast.dismiss(id); abrirAnexosDaFicha(destino); }} className="crm-tema-fixo flex w-full items-start gap-3 rounded-xl border border-emerald-300/40 bg-emerald-900 px-4 py-3 text-left text-sm text-white shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">
    <CircleCheck size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
    <span>Ficha de análise de viabilidade gerada para: {ficha.empresaNome}<span className="mt-1 block text-xs text-emerald-100">Abrir anexos da empresa</span></span>
  </button>, { id: `ficha-viabilidade:${chave}`, duration: 12_000 });
}

/** Chamado apenas com a resposta do comando originado neste navegador. Nunca por broadcast. */
export function avisarResultadoFichaViabilidade(resultado: Pick<ResultadoFichaViabilidade, "estado" | "data" | "gerada" | "solicitacaoId">, destino: Destino) {
  if (resultado.estado === "PRONTA" && resultado.data && resultado.gerada) anunciar(resultado.data, destino);
  if (resultado.estado !== "PENDENTE" || !resultado.solicitacaoId) return;
  const solicitacaoId = resultado.solicitacaoId;
  const chave = `${destino.cardId}:${solicitacaoId}`;
  if (acompanhando.has(chave)) return;
  acompanhando.add(chave);
  let tentativas = 0;
  const consultar = async () => {
    try {
      const { ObterFichaViabilidadeBpm } = await import("@/actions/bpm/FichaViabilidade");
      const resposta = await ObterFichaViabilidadeBpm({ cardId: destino.cardId, solicitacaoId });
      if (!resposta.success) { acompanhando.delete(chave); return; }
      if (resposta.estado === "PRONTA") {
        if (resposta.data && resposta.gerada) anunciar(resposta.data, destino);
        acompanhando.delete(chave);
        return;
      }
      if (resposta.estado !== "PENDENTE") { acompanhando.delete(chave); return; }
    } catch { /* Uma falha de transporte pode ser recuperada na próxima consulta limitada. */ }
    if (++tentativas >= 30) { acompanhando.delete(chave); return; }
    window.setTimeout(() => void consultar(), 5_000);
  };
  window.setTimeout(() => void consultar(), 5_000);
}

export function avisarFichaViabilidadeDoRetorno(retorno: unknown, destino: Destino) {
  const parsed = respostaSchema.safeParse(retorno);
  if (!parsed.success) return;
  const r = parsed.data;
  if (r.fichaViabilidadeEstado === "PRONTA" && r.fichaViabilidade && r.fichaViabilidadeGerada) anunciar(r.fichaViabilidade, destino);
  if (r.fichaViabilidadeEstado === "PENDENTE") avisarResultadoFichaViabilidade({ estado: "PENDENTE", data: null, gerada: false, solicitacaoId: r.fichaViabilidadeSolicitacaoId ?? null }, destino);
  if (r.fichaViabilidadeEstado === "FALHA") toast.error("Não foi possível gerar a ficha. Tente novamente pelo card.");
}
