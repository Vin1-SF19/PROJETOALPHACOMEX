"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { SalvarDefinicaoAutomacaoCentralBpm } from "@/actions/bpm/AutomacoesCentrais";
import type { AutomacaoBpmView, PipelineAutomacaoView } from "@/components/bpm/automacoes/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const GATILHOS = [
  "CARD_CRIADO", "CARD_ATUALIZADO", "ENTRAR_COLUNA", "SAIR_COLUNA",
  "CAMPO_ALTERADO", "CAMPO_VALOR_ASSUMIDO", "RESPONSAVEL_ATRIBUIDO",
  "MEMBROS_ATUALIZADOS", "TAREFA_CRIADA", "TAREFA_CONCLUIDA",
  "TAREFA_PRAZO_ATINGIDO", "TAREFA_ALERTA_ATINGIDO", "VINCULO_CRIADO",
  "TEMPO_NA_ETAPA_ATINGIDO", "RECORRENCIA_ATINGIDA", "SLA_STATUS_ALTERADO",
  "PROCESSO_DEFERIDO", "CADENCIA_INICIADA", "WEBHOOK_RECEBIDO",
  "CHAMADA_EXTERNA_CONCLUIDA",
] as const;

const GRAFO_PADRAO = {
  inicioId: "acao-1",
  nos: [
    { id: "acao-1", tipo: "ACAO", acaoTipo: "ADICIONAR_ANOTACAO", parametros: { texto: "Executado pelo Motor Central" }, proximoId: "fim" },
    { id: "fim", tipo: "FIM" },
  ],
};

function jsonObjeto(valor: string | null | undefined, fallback: Record<string, unknown>) {
  try {
    const parsed = valor ? JSON.parse(valor) : fallback;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : fallback;
  } catch { return fallback; }
}

export function AutomacaoCentralFormDialog({
  automacao,
  pipelineInicialId,
  etapaInicialId,
  pipelines,
  onClose,
  onSaved,
}: {
  automacao?: AutomacaoBpmView | null;
  pipelineInicialId?: string;
  etapaInicialId?: string;
  pipelines: PipelineAutomacaoView[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const versao = automacao?.versaoAtiva;
  const configInicial = jsonObjeto(versao?.gatilhoConfigJson, {});
  const pipelineIdInicial = pipelineInicialId ?? pipelines.find((pipeline) => (pipeline.automacoesGlobais ?? []).some((item) => item.id === automacao?.id) || pipeline.etapas.some((etapa) => etapa.automacoes.some((item) => item.id === automacao?.id)))?.id ?? pipelines[0]?.id ?? "";
  const [nome, setNome] = useState(automacao?.nome ?? "");
  const [descricao, setDescricao] = useState(automacao?.descricao ?? "");
  const [pipelineId, setPipelineId] = useState(pipelineIdInicial);
  const [escopo, setEscopo] = useState<"ETAPAS" | "GLOBAL_PIPELINE">(automacao?.escopo ?? (configInicial.escopo === "GLOBAL_PIPELINE" ? "GLOBAL_PIPELINE" : "ETAPAS"));
  const [etapasIds, setEtapasIds] = useState<string[]>(automacao?.etapasIds?.length ? automacao.etapasIds : etapaInicialId ? [etapaInicialId] : []);
  const [ativa, setAtiva] = useState(automacao?.ativa ?? true);
  const [gatilhoTipo, setGatilhoTipo] = useState(versao?.gatilhoTipo ?? automacao?.gatilhoTipo ?? "CARD_CRIADO");
  const extrasIniciais = { ...configInicial };
  delete extrasIniciais.escopo;
  delete extrasIniciais.etapaId;
  delete extrasIniciais.etapasIds;
  const [gatilhoExtrasJson, setGatilhoExtrasJson] = useState(JSON.stringify(extrasIniciais, null, 2));
  const [condicaoJson, setCondicaoJson] = useState(versao?.condicaoJson ? JSON.stringify(JSON.parse(versao.condicaoJson), null, 2) : "");
  const grafoInicial = versao?.grafoJson
    ? JSON.parse(versao.grafoJson)
    : automacao
      ? { inicioId: "acao-1", nos: [{ id: "acao-1", tipo: "ACAO", acaoTipo: automacao.acaoTipo, parametros: jsonObjeto(automacao.parametrosJson, {}), proximoId: "fim" }, { id: "fim", tipo: "FIM" }] }
      : GRAFO_PADRAO;
  const [grafoJson, setGrafoJson] = useState(JSON.stringify(grafoInicial, null, 2));
  const [pending, startTransition] = useTransition();
  const pipeline = useMemo(() => pipelines.find((item) => item.id === pipelineId), [pipelineId, pipelines]);

  function alternarEtapa(id: string, marcada: boolean) {
    setEtapasIds((atuais) => marcada ? [...new Set([...atuais, id])] : atuais.filter((item) => item !== id));
  }

  function salvar() {
    try {
      const extras = jsonObjeto(gatilhoExtrasJson, {});
      const selecionadas = escopo === "GLOBAL_PIPELINE" ? [] : etapasIds;
      const etapaAncoraId = selecionadas[0] ?? pipeline?.etapas[0]?.id;
      if (!etapaAncoraId) return toast.error("O pipeline não possui etapa de referência");
      if (escopo === "ETAPAS" && selecionadas.length === 0) return toast.error("Selecione ao menos uma etapa");
      const payload = {
        automacaoId: automacao?.id,
        nome,
        descricao: descricao || null,
        pipelineId,
        etapaAncoraId,
        ativa,
        gatilhoTipo,
        gatilhoConfig: {
          ...extras,
          escopo,
          ...(escopo === "ETAPAS" ? { etapaId: selecionadas[0], etapasIds: selecionadas } : {}),
        },
        condicao: condicaoJson.trim() ? JSON.parse(condicaoJson) : null,
        grafo: JSON.parse(grafoJson),
        timezone: versao?.timezone ?? "America/Sao_Paulo",
      };
      startTransition(async () => {
        const resultado = await SalvarDefinicaoAutomacaoCentralBpm(payload);
        if (!resultado.success) {
          toast.error(resultado.error);
          return;
        }
        toast.success(automacao ? `Automação atualizada na versão ${resultado.data.versao}` : "Automação criada e versionada");
        onSaved();
      });
    } catch { toast.error("Revise os JSONs do gatilho, condições e ações"); }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent className="max-h-[94vh] overflow-y-auto border-white/10 bg-slate-950 text-white sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{automacao ? "Editar automação" : "Nova automação"}</DialogTitle>
          <DialogDescription>Identidade, escopo, gatilho, condições e ações são salvos juntos na versão executada pelo Motor Central.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <label className="text-xs text-slate-300 sm:col-span-2">Nome<Input className="mt-1" value={nome} onChange={(e) => setNome(e.target.value)} /></label>
          <label className="text-xs text-slate-300 sm:col-span-2">Descrição<Input className="mt-1" value={descricao} onChange={(e) => setDescricao(e.target.value)} /></label>
          <label className="text-xs text-slate-300">Pipeline<Select value={pipelineId} onValueChange={(id) => { setPipelineId(id); setEtapasIds([]); }}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{pipelines.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent></Select></label>
          <label className="text-xs text-slate-300">Escopo<Select value={escopo} onValueChange={(valor) => setEscopo(valor as typeof escopo)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ETAPAS">Etapa(s) selecionada(s)</SelectItem><SelectItem value="GLOBAL_PIPELINE">Automação global do pipeline</SelectItem></SelectContent></Select></label>
          {escopo === "ETAPAS" && <fieldset className="grid gap-2 rounded-xl border border-white/10 p-3 sm:col-span-2 sm:grid-cols-3"><legend className="px-1 text-xs text-slate-400">Etapas relacionadas</legend>{(pipeline?.etapas ?? []).map((etapa) => <label key={etapa.id} className="flex items-center gap-2 text-xs text-slate-200"><input type="checkbox" checked={etapasIds.includes(etapa.id)} onChange={(e) => alternarEtapa(etapa.id, e.target.checked)} />{etapa.nome}</label>)}</fieldset>}
          <label className="text-xs text-slate-300">Gatilho<Select value={gatilhoTipo} onValueChange={setGatilhoTipo}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{GATILHOS.map((item) => <SelectItem key={item} value={item}>{item.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></label>
          <label className="flex items-center justify-between rounded-xl border border-white/10 px-3 text-xs text-slate-300">Status <Switch checked={ativa} onCheckedChange={setAtiva} /></label>
          <label className="text-xs text-slate-300 sm:col-span-2">Configuração adicional do gatilho<textarea className="mt-1 min-h-28 w-full rounded-md border border-white/10 bg-slate-900 p-3 font-mono text-xs" value={gatilhoExtrasJson} onChange={(e) => setGatilhoExtrasJson(e.target.value)} spellCheck={false} /></label>
          <label className="text-xs text-slate-300 sm:col-span-2">Condições — Motor de Regras (vazio = sempre)<textarea className="mt-1 min-h-32 w-full rounded-md border border-white/10 bg-slate-900 p-3 font-mono text-xs" value={condicaoJson} onChange={(e) => setCondicaoJson(e.target.value)} spellCheck={false} /></label>
          <label className="text-xs text-slate-300 sm:col-span-2">Ações e ordem — grafo do Motor Central<textarea className="mt-1 min-h-72 w-full rounded-md border border-white/10 bg-slate-900 p-3 font-mono text-xs" value={grafoJson} onChange={(e) => setGrafoJson(e.target.value)} spellCheck={false} /></label>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose} disabled={pending}>Cancelar</Button><Button onClick={salvar} disabled={pending}>{pending ? "Salvando..." : "Salvar nova versão"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
