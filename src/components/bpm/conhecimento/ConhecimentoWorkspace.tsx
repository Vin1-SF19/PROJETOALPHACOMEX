"use client";

import { useMemo, useState } from "react";
import { BookOpen, ScrollText } from "lucide-react";

import { ScriptEtapaEditor } from "@/components/bpm/conhecimento/ScriptEtapaEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Etapa = { id: string; nome: string; ordem: number; script: string | null };
type Pipeline = { id: string; nome: string; etapas: Etapa[] };

export function ConhecimentoWorkspace({ pipelines, accent }: { pipelines: Pipeline[]; accent: string }) {
  const [dados, setDados] = useState(pipelines);
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? "");
  const pipelineAtual = useMemo(
    () => dados.find((pipeline) => pipeline.id === pipelineId) ?? null,
    [dados, pipelineId],
  );
  const [etapaId, setEtapaId] = useState(pipelines[0]?.etapas[0]?.id ?? "");
  const [selecaoBloqueada, setSelecaoBloqueada] = useState(false);
  const etapaAtual = pipelineAtual?.etapas.find((etapa) => etapa.id === etapaId) ?? null;

  function selecionarPipeline(novoPipelineId: string) {
    const novoPipeline = dados.find((pipeline) => pipeline.id === novoPipelineId);
    setPipelineId(novoPipelineId);
    setEtapaId(novoPipeline?.etapas[0]?.id ?? "");
  }

  function registrarScriptSalvo(script: string | null) {
    setDados((atuais) => atuais.map((pipeline) => pipeline.id !== pipelineId
      ? pipeline
      : {
          ...pipeline,
          etapas: pipeline.etapas.map((etapa) => etapa.id === etapaId ? { ...etapa, script } : etapa),
        }));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4">
      <div className="flex items-center gap-2">
        <BookOpen size={18} style={{ color: `rgb(${accent})` }} />
        <h1 className="text-lg font-bold text-slate-100">Gerenciador de scripts</h1>
      </div>
      <p className="text-xs text-slate-400">
        Escolha o pipeline e a etapa. O texto salvo aparece na aba Scripts dos cards que estiverem nessa etapa.
      </p>

      {dados.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
          Nenhum pipeline ativo disponível.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold text-slate-300">
              <span>Pipeline</span>
              <Select value={pipelineId} onValueChange={selecionarPipeline} disabled={selecaoBloqueada}>
                <SelectTrigger aria-label="Pipeline"><SelectValue placeholder="Selecione o pipeline" /></SelectTrigger>
                <SelectContent>
                  {dados.map((pipeline) => <SelectItem key={pipeline.id} value={pipeline.id}>{pipeline.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>

            <label className="space-y-1.5 text-xs font-semibold text-slate-300">
              <span>Etapa</span>
              <Select value={etapaId} onValueChange={setEtapaId} disabled={selecaoBloqueada || !pipelineAtual?.etapas.length}>
                <SelectTrigger aria-label="Etapa"><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
                <SelectContent>
                  {pipelineAtual?.etapas.map((etapa) => <SelectItem key={etapa.id} value={etapa.id}>{etapa.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
          </div>

          {etapaAtual ? (
            <section className="space-y-2" aria-labelledby="titulo-script-etapa">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ScrollText size={14} style={{ color: `rgb(${accent})` }} />
                <h2 id="titulo-script-etapa" className="font-semibold text-slate-200">Texto da aba Scripts</h2>
              </div>
              <ScriptEtapaEditor
                key={etapaAtual.id}
                pipelineId={pipelineId}
                etapaId={etapaAtual.id}
                scriptInicial={etapaAtual.script}
                onSalvo={registrarScriptSalvo}
                onEstadoChange={setSelecaoBloqueada}
              />
            </section>
          ) : (
            <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
              Este pipeline não possui etapas ativas.
            </p>
          )}
        </>
      )}
    </div>
  );
}
