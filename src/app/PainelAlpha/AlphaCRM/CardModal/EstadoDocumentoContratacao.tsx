"use client";

import { useState } from "react";
import { CheckCircle2, Clock3, FileCheck2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SlotContratoComercial, TipoContratoComercial } from "@/lib/bpm/contratos-comerciais";
import { VisualizadorAnexoCard, type AnexoParaVisualizar } from "@/components/bpm/anexos/VisualizadorAnexoCard";
import { urlContratoComercialSegura } from "@/components/bpm/anexos/VisualizadorContratoComercial";

export interface EstadoDocumentoContratacaoProps {
  tipo: TipoContratoComercial;
  slot: SlotContratoComercial;
  arquivoLocal?: AnexoParaVisualizar | null;
  cardId: string;
  label: string;
  revisao?: string;
}

export function EstadoDocumentoContratacao({ tipo, slot, arquivoLocal = null, cardId, label, revisao }: EstadoDocumentoContratacaoProps) {
  const [selecionado, setSelecionado] = useState<AnexoParaVisualizar | null>(null);
  const financeiro = slot.estado === "DISPONIVEL" && slot.documento && urlContratoComercialSegura(slot.documento, cardId) ? slot.documento : null;
  const arquivo = financeiro ?? arquivoLocal;
  const disponivel = Boolean(arquivo);
  const IconeDocumento = tipo === "assinado" ? FileCheck2 : FileText;
  return <div className={cn("relative isolate overflow-hidden rounded-xl border px-3 py-3", disponivel ? "border-emerald-400/30 bg-emerald-400/[0.06]" : "border-amber-300/25 bg-amber-300/[0.04]")}>
    {!disponivel && <span aria-hidden="true" data-documento-pendente="true" className="pointer-events-none absolute inset-0 -z-10 rounded-xl bg-amber-300/[0.06] motion-safe:animate-pulse motion-reduce:animate-none" />}
    <div role="status" aria-label={`${label}: ${disponivel ? "disponível" : "pendente"}`} className="flex items-start gap-2.5">
      <IconeDocumento size={17} aria-hidden="true" className={cn("mt-0.5 shrink-0", disponivel ? "text-emerald-300" : "text-amber-200")} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className={cn("flex items-center gap-1.5 text-xs font-semibold", disponivel ? "text-emerald-200" : "text-amber-100")}>{disponivel ? <CheckCircle2 size={12} aria-hidden="true" /> : <Clock3 size={12} aria-hidden="true" />}{disponivel ? financeiro ? "Disponível pelo Financeiro" : "Anexado no Comercial" : "Pendente"}</p>
        {arquivo ? <button type="button" onClick={() => setSelecionado(arquivo)} className="block max-w-full break-words text-left text-xs font-medium text-emerald-100 underline decoration-emerald-300/50 underline-offset-4 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300" aria-label={`Abrir ${label}: ${arquivo.nome}`}>{arquivo.nome}</button> : <p className="text-xs text-slate-300">{tipo === "para_envio" ? "Sendo preparado pelo Financeiro" : "Aguardando contrato assinado"}</p>}
        {!disponivel && tipo === "para_envio" && <p className="text-[11px] text-slate-400">Disponível após a conferência e finalização do contrato.</p>}
      </div>
    </div>
    <VisualizadorAnexoCard anexo={selecionado && arquivo?.id === selecionado.id ? arquivo : null} cardId={cardId} revisao={revisao} onClose={() => setSelecionado(null)} />
  </div>;
}
