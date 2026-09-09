"use client";

import { useMemo, useState } from "react";
import { CalendarClock, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { ConfigurarCadenciaEtapaBpm } from "@/actions/bpm/Cadencias";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CadenciaView } from "@/components/bpm/cadencias/types";

const SEM_CADENCIA = "SEM_CADENCIA";

export function CadenciaEtapasSection({
  pipelineId,
  etapas,
  cadencias,
  publicationBlocked = false,
  onPublished,
}: {
  pipelineId: string;
  etapas: { id: string; nome: string; ativo: boolean }[];
  cadencias: CadenciaView[];
  publicationBlocked?: boolean;
  onPublished?: () => void;
}) {
  const iniciais = useMemo(() => Object.fromEntries(etapas.map((etapa) => [
    etapa.id,
    cadencias.find((cadencia) => cadencia.ativa
      && cadencia.pipelineId === pipelineId
      && cadencia.etapas.some((associacao) => associacao.etapaId === etapa.id))?.id ?? SEM_CADENCIA,
  ])), [cadencias, etapas, pipelineId]);
  const [selecoes, setSelecoes] = useState<Record<string, string>>(iniciais);
  const [selecoesConfirmadas, setSelecoesConfirmadas] = useState<Record<string, string>>(iniciais);
  const [publicandoEtapa, setPublicandoEtapa] = useState<string | null>(null);
  const candidatas = cadencias.filter((cadencia) => !cadencia.pipelineId || cadencia.pipelineId === pipelineId);

  async function publicar(etapaId: string) {
    if (publicationBlocked || publicandoEtapa) return;
    const valor = selecoes[etapaId] ?? SEM_CADENCIA;
    setPublicandoEtapa(etapaId);
    try {
      const resposta = await ConfigurarCadenciaEtapaBpm({
        pipelineId,
        etapaId,
        cadenciaId: valor === SEM_CADENCIA ? null : valor,
      });
      if (!resposta.success) {
        toast.error(typeof resposta.error === "string" ? resposta.error : "Não foi possível salvar a cadência da coluna.");
        return;
      }
      setSelecoesConfirmadas((atual) => ({ ...atual, [etapaId]: valor }));
      toast.success(valor === SEM_CADENCIA ? "Coluna publicada sem cadência" : "Cadência da coluna publicada");
      onPublished?.();
    } finally {
      setPublicandoEtapa(null);
    }
  }

  return (
    <section aria-labelledby="cadencias-coluna-title" className="space-y-3">
      <div>
        <h2 id="cadencias-coluna-title" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white">
          <CalendarClock size={16} aria-hidden="true" /> Cadência por coluna
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Selecione uma orientação operacional ou deixe a coluna sem cadência. Cadências geram tarefas e alertas, mas nunca impedem o avanço do card.
        </p>
        <p className="mt-1 text-xs text-amber-200/80">A seleção fica pendente até a publicação explícita da coluna.</p>
      </div>

      <div className="space-y-2">
        {etapas.map((etapa) => (
          <div key={etapa.id} className="grid gap-2 rounded-xl border border-white/5 bg-slate-800/40 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(220px,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{etapa.nome}</p>
              <p className="text-[11px] text-slate-500">{etapa.ativo ? "Coluna ativa" : "Coluna inativa"}</p>
            </div>
            <Select value={selecoes[etapa.id] ?? iniciais[etapa.id]} onValueChange={(valor) => setSelecoes((atual) => ({ ...atual, [etapa.id]: valor }))} disabled={Boolean(publicandoEtapa) || !etapa.ativo}>
              <SelectTrigger aria-label={`Cadência da coluna ${etapa.nome}`}>
                <SelectValue placeholder="Nenhuma cadência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_CADENCIA}>Nenhuma cadência</SelectItem>
                {candidatas.map((cadencia) => (
                  <SelectItem key={cadencia.id} value={cadencia.id}>
                    {cadencia.nome}{cadencia.etapas.length > 0 ? ` — ${cadencia.etapas.length} coluna(s)` : " — entrada no pipeline"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={`Descartar cadência pendente de ${etapa.nome}`}
                disabled={Boolean(publicandoEtapa) || selecoes[etapa.id] === selecoesConfirmadas[etapa.id]}
                onClick={() => setSelecoes((atual) => ({ ...atual, [etapa.id]: selecoesConfirmadas[etapa.id] }))}
                className="inline-flex min-h-9 items-center rounded-lg border border-white/10 px-2 text-slate-300 disabled:opacity-35"
              >
                <RotateCcw size={14} />
              </button>
              <button
                type="button"
                disabled={publicationBlocked || Boolean(publicandoEtapa) || selecoes[etapa.id] === selecoesConfirmadas[etapa.id]}
                onClick={() => void publicar(etapa.id)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-cyan-400 px-3 text-xs font-bold text-slate-950 disabled:opacity-35"
              >
                <Save size={14} /> {publicandoEtapa === etapa.id ? "Publicando…" : "Publicar"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {publicationBlocked && (
        <p className="text-xs text-amber-200" role="status">Publique ou descarte o rascunho principal antes de publicar uma cadência.</p>
      )}

      {candidatas.length === 0 && (
        <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-xs text-slate-500">
          Nenhuma cadência disponível. Crie uma definição na área Cadências ou mantenha as colunas sem cadência.
        </p>
      )}
    </section>
  );
}
