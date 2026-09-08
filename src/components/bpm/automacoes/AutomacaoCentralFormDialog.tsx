"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { SalvarDefinicaoAutomacaoCentralBpm } from "@/actions/bpm/AutomacoesCentrais";
import type {
  AutomacaoBpmView,
  CatalogosAutomacao,
  PipelineAutomacaoView,
  TemplateAutomacao,
} from "@/components/bpm/automacoes/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AUTOMACOES_EXECUTAVEIS_AUDITADAS,
  obterAuditoriaAcao,
} from "@/lib/bpm/automacoes/catalogo-modulos";
import type { TipoAcaoCentral } from "@/lib/bpm/automacoes/central-schemas";

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

function primeiraAcao(grafoJson: string) {
  try {
    const grafo = JSON.parse(grafoJson) as { nos?: Array<{ tipo?: string; acaoTipo?: string; parametros?: unknown }> };
    const acao = grafo.nos?.find((no) => no.tipo === "ACAO");
    if (!acao || !AUTOMACOES_EXECUTAVEIS_AUDITADAS.some((item) => item.acaoTipo === acao.acaoTipo)) return null;
    return {
      tipo: acao.acaoTipo as TipoAcaoCentral,
      parametros: acao.parametros && typeof acao.parametros === "object" && !Array.isArray(acao.parametros)
        ? acao.parametros as Record<string, unknown>
        : {},
    };
  } catch {
    return null;
  }
}

export function AutomacaoCentralFormDialog({
  automacao,
  pipelineInicialId,
  etapaInicialId,
  pipelines,
  catalogos,
  templates,
  onClose,
  onSaved,
}: {
  automacao?: AutomacaoBpmView | null;
  pipelineInicialId?: string;
  etapaInicialId?: string;
  pipelines: PipelineAutomacaoView[];
  catalogos: CatalogosAutomacao;
  templates: TemplateAutomacao[];
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
  const acaoAtual = useMemo(() => primeiraAcao(grafoJson), [grafoJson]);
  const auditoriaAcao = acaoAtual ? obterAuditoriaAcao(acaoAtual.tipo) : null;
  const catalogoPipeline = catalogos.pipelines.find((item) => item.id === pipelineId);

  function parametrosPadrao(tipo: TipoAcaoCentral): Record<string, unknown> {
    if (tipo === "GERAR_CONTRATO") return { templateId: templates[0]?.id ?? "", titulo: "Contrato — {{empresa.razaoSocial}}", variaveis: {} };
    if (["GERAR_FICHA", "MATERIALIZAR_CHECKLIST", "MARCAR_ALERTA_TAREFA", "SINCRONIZAR_TRANSCRICAO_REUNIAO"].includes(tipo)) return {};
    if (tipo === "ADICIONAR_ANOTACAO" || tipo === "CRIAR_ALERTA") return { texto: "" };
    if (tipo === "CRIAR_TAREFA") return { titulo: "", tipo: "TAREFA", prioridade: "NORMAL", naoDuplicarPendenteTipo: false };
    if (tipo === "MOVER_CARD") return { etapaId: pipeline?.etapas[0]?.id ?? "", validarRequisitos: true, exigirProximoContatoVazio: false };
    if (tipo === "ATRIBUIR_RESPONSAVEL") return { responsavelId: catalogos.usuarios[0]?.id ?? 0 };
    if (tipo === "ALTERAR_CAMPO") return { campoId: catalogoPipeline?.campos[0]?.id ?? "", valor: "" };
    if (tipo === "ENVIAR_EMAIL") return { para: "", assunto: "", corpo: "", cc: [] };
    if (tipo === "COMUNICACAO_EXISTENTE") return { canal: "EMAIL", mensagem: "", destinatario: "" };
    if (tipo === "HTTP" || tipo === "WEBHOOK") return { url: "https://", metodo: "POST", headers: {}, timeoutMs: 10_000 };
    if (tipo === "CRIAR_CARD_OUTRO_PIPELINE") return { pipelineId, etapaId: pipeline?.etapas[0]?.id ?? "", vincularAoOriginal: true, somenteSeNaoExistirAtivo: false };
    if (tipo === "CRIAR_TAREFAS_POR_META") return { meta: 1, interacaoTipo: "LIGACAO", tarefaTipo: "LIGACAO", titulo: "Ligação {{indice}}", prioridade: "NORMAL" };
    return {};
  }

  function trocarAcao(tipo: TipoAcaoCentral) {
    try {
      const grafo = JSON.parse(grafoJson) as { inicioId: string; nos: Array<Record<string, unknown>> };
      const indice = grafo.nos.findIndex((no) => no.tipo === "ACAO");
      if (indice >= 0) grafo.nos[indice] = { ...grafo.nos[indice], acaoTipo: tipo, parametros: parametrosPadrao(tipo) };
      else grafo.nos = [{ id: "acao-1", tipo: "ACAO", acaoTipo: tipo, parametros: parametrosPadrao(tipo), proximoId: "fim" }, { id: "fim", tipo: "FIM" }];
      setGrafoJson(JSON.stringify(grafo, null, 2));
    } catch {
      setGrafoJson(JSON.stringify({ inicioId: "acao-1", nos: [{ id: "acao-1", tipo: "ACAO", acaoTipo: tipo, parametros: parametrosPadrao(tipo), proximoId: "fim" }, { id: "fim", tipo: "FIM" }] }, null, 2));
    }
  }

  function atualizarParametros(parcial: Record<string, unknown>) {
    try {
      const grafo = JSON.parse(grafoJson) as { nos: Array<Record<string, unknown>> };
      const indice = grafo.nos.findIndex((no) => no.tipo === "ACAO");
      if (indice < 0) return;
      const anteriores = grafo.nos[indice].parametros && typeof grafo.nos[indice].parametros === "object"
        ? grafo.nos[indice].parametros as Record<string, unknown>
        : {};
      grafo.nos[indice] = { ...grafo.nos[indice], parametros: { ...anteriores, ...parcial } };
      setGrafoJson(JSON.stringify(grafo, null, 2));
    } catch { /* O modo avançado continua responsável por corrigir JSON inválido. */ }
  }

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

          <section className="space-y-4 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.025] p-4 sm:col-span-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-cyan-300">O que esta automação fará?</p>
              <p className="mt-1 text-xs text-slate-500">As opções abaixo são as mesmas ações registradas e validadas pelo Motor Central.</p>
            </div>
            <label className="block text-xs text-slate-300">Ação principal
              <Select value={acaoAtual?.tipo ?? ""} onValueChange={(valor) => trocarAcao(valor as TipoAcaoCentral)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione uma ação existente" /></SelectTrigger>
                <SelectContent>{AUTOMACOES_EXECUTAVEIS_AUDITADAS.map((item) => <SelectItem key={item.id} value={item.acaoTipo!}>{item.modulo} · {item.nome}</SelectItem>)}</SelectContent>
              </Select>
            </label>

            {auditoriaAcao && (
              <div className="rounded-lg border border-emerald-400/15 bg-emerald-400/[0.04] p-3 text-xs">
                <p className="font-semibold text-emerald-300">✓ Executável no Motor Central · {auditoriaAcao.acaoTipo}</p>
                <p className="mt-1 text-slate-400">{auditoriaAcao.descricao}</p>
                <p className="mt-1 text-[11px] text-slate-500">Resultado: {auditoriaAcao.resultado}</p>
              </div>
            )}

            {acaoAtual?.tipo === "GERAR_CONTRATO" && (() => {
              const templateId = String(acaoAtual.parametros.templateId ?? "");
              const template = templates.find((item) => item.id === templateId);
              const variaveis = acaoAtual.parametros.variaveis && typeof acaoAtual.parametros.variaveis === "object"
                ? acaoAtual.parametros.variaveis as Record<string, unknown>
                : {};
              return <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-slate-300">Template do Gerador de Documentos
                  <Select value={templateId} onValueChange={(valor) => atualizarParametros({ templateId: valor })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione um template ativo" /></SelectTrigger>
                    <SelectContent>{templates.map((item) => <SelectItem key={item.id} value={item.id}>{item.titulo}{item.categoria ? ` · ${item.categoria}` : ""}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
                <label className="text-xs text-slate-300">Título do contrato<Input className="mt-1" value={String(acaoAtual.parametros.titulo ?? "")} onChange={(event) => atualizarParametros({ titulo: event.target.value })} /></label>
                {templates.length === 0 && <p className="text-xs text-amber-300 sm:col-span-2">Nenhum template ativo foi encontrado no Gerador de Documentos.</p>}
                {template?.variaveis.map((variavel) => <label key={variavel.nome} className="text-xs text-slate-300">{variavel.label}{variavel.obrigatorio ? " *" : ""}<Input className="mt-1" placeholder={variavel.placeholder} value={String(variaveis[variavel.nome] ?? "")} onChange={(event) => atualizarParametros({ variaveis: { ...variaveis, [variavel.nome]: event.target.value } })} /></label>)}
              </div>;
            })()}

            {(acaoAtual?.tipo === "GERAR_FICHA" || acaoAtual?.tipo === "MATERIALIZAR_CHECKLIST" || acaoAtual?.tipo === "SINCRONIZAR_TRANSCRICAO_REUNIAO" || acaoAtual?.tipo === "MARCAR_ALERTA_TAREFA") && (
              <p className="rounded-lg border border-white/[0.07] bg-slate-950/50 p-3 text-xs text-slate-400">Esta ação não exige parâmetros adicionais. O Motor usa os dados e vínculos do próprio card.</p>
            )}

            {(acaoAtual?.tipo === "ADICIONAR_ANOTACAO" || acaoAtual?.tipo === "CRIAR_ALERTA") && (
              <label className="block text-xs text-slate-300">Texto<textarea className="mt-1 min-h-24 w-full rounded-md border border-white/10 bg-slate-900 p-3 text-sm" value={String(acaoAtual.parametros.texto ?? "")} onChange={(event) => atualizarParametros({ texto: event.target.value })} /></label>
            )}

            {acaoAtual?.tipo === "MOVER_CARD" && <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-300">Etapa de destino<Select value={String(acaoAtual.parametros.etapaId ?? "")} onValueChange={(valor) => atualizarParametros({ etapaId: valor })}><SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a etapa" /></SelectTrigger><SelectContent>{(pipeline?.etapas ?? []).map((etapa) => <SelectItem key={etapa.id} value={etapa.id}>{etapa.nome}</SelectItem>)}</SelectContent></Select></label>
              <div className="space-y-2 rounded-lg border border-white/[0.07] p-3"><label className="flex items-center justify-between gap-3 text-xs text-slate-300">Validar requisitos da etapa<Switch checked={acaoAtual.parametros.validarRequisitos !== false} onCheckedChange={(valor) => atualizarParametros({ validarRequisitos: valor })} /></label><label className="flex items-center justify-between gap-3 text-xs text-slate-300">Só mover sem próximo contato<Switch checked={acaoAtual.parametros.exigirProximoContatoVazio === true} onCheckedChange={(valor) => atualizarParametros({ exigirProximoContatoVazio: valor })} /></label></div>
            </div>}

            {acaoAtual?.tipo === "ALTERAR_CAMPO" && <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-300">Campo do pipeline<Select value={String(acaoAtual.parametros.campoId ?? "")} onValueChange={(valor) => atualizarParametros({ campoId: valor })}><SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o campo" /></SelectTrigger><SelectContent>{(catalogoPipeline?.campos ?? []).map((campo) => <SelectItem key={campo.id} value={campo.id}>{campo.nome}</SelectItem>)}</SelectContent></Select></label>
              <label className="text-xs text-slate-300">Novo valor<Input className="mt-1" value={String(acaoAtual.parametros.valor ?? "")} onChange={(event) => atualizarParametros({ valor: event.target.value })} /></label>
            </div>}

            {acaoAtual?.tipo === "ATRIBUIR_RESPONSAVEL" && <label className="block text-xs text-slate-300">Novo responsável<Select value={String(acaoAtual.parametros.responsavelId ?? "")} onValueChange={(valor) => atualizarParametros({ responsavelId: Number(valor) })}><SelectTrigger className="mt-1"><SelectValue placeholder="Selecione um usuário" /></SelectTrigger><SelectContent>{catalogos.usuarios.map((usuario) => <SelectItem key={usuario.id} value={String(usuario.id)}>{usuario.nome}</SelectItem>)}</SelectContent></Select></label>}

            {acaoAtual?.tipo === "CRIAR_TAREFA" && <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-300 sm:col-span-2">Título da tarefa<Input className="mt-1" value={String(acaoAtual.parametros.titulo ?? "")} onChange={(event) => atualizarParametros({ titulo: event.target.value })} /></label>
              <label className="text-xs text-slate-300">Tipo<Input className="mt-1" value={String(acaoAtual.parametros.tipo ?? "TAREFA")} onChange={(event) => atualizarParametros({ tipo: event.target.value })} /></label>
              <label className="text-xs text-slate-300">Prioridade<Select value={String(acaoAtual.parametros.prioridade ?? "NORMAL")} onValueChange={(valor) => atualizarParametros({ prioridade: valor })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BAIXA">Baixa</SelectItem><SelectItem value="NORMAL">Normal</SelectItem><SelectItem value="ALTA">Alta</SelectItem></SelectContent></Select></label>
              <label className="text-xs text-slate-300">Prazo em minutos<Input className="mt-1" type="number" min={0} value={acaoAtual.parametros.prazoMinutos === undefined ? "" : Number(acaoAtual.parametros.prazoMinutos)} onChange={(event) => atualizarParametros({ prazoMinutos: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
              <label className="text-xs text-slate-300">Responsável<Select value={String(acaoAtual.parametros.responsavelId ?? "RESPONSAVEL_CARD")} onValueChange={(valor) => atualizarParametros({ responsavelId: valor === "RESPONSAVEL_CARD" ? undefined : Number(valor) })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="RESPONSAVEL_CARD">Responsável do card</SelectItem>{catalogos.usuarios.map((usuario) => <SelectItem key={usuario.id} value={String(usuario.id)}>{usuario.nome}</SelectItem>)}</SelectContent></Select></label>
            </div>}

            {acaoAtual?.tipo === "ENVIAR_EMAIL" && <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-300">Destinatário<Input className="mt-1" type="email" value={String(acaoAtual.parametros.para ?? "")} onChange={(event) => atualizarParametros({ para: event.target.value })} /></label>
              <label className="text-xs text-slate-300">Assunto<Input className="mt-1" value={String(acaoAtual.parametros.assunto ?? "")} onChange={(event) => atualizarParametros({ assunto: event.target.value })} /></label>
              <label className="text-xs text-slate-300 sm:col-span-2">Mensagem<textarea className="mt-1 min-h-28 w-full rounded-md border border-white/10 bg-slate-900 p-3 text-sm" value={String(acaoAtual.parametros.corpo ?? "")} onChange={(event) => atualizarParametros({ corpo: event.target.value })} /></label>
            </div>}

            {(acaoAtual?.tipo === "HTTP" || acaoAtual?.tipo === "WEBHOOK") && <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
              <label className="text-xs text-slate-300">URL HTTPS<Input className="mt-1" value={String(acaoAtual.parametros.url ?? "")} onChange={(event) => atualizarParametros({ url: event.target.value })} /></label>
              <label className="text-xs text-slate-300">Método<Select value={String(acaoAtual.parametros.metodo ?? "POST")} onValueChange={(valor) => atualizarParametros({ metodo: valor })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{["GET", "POST", "PUT", "PATCH"].map((metodo) => <SelectItem key={metodo} value={metodo}>{metodo}</SelectItem>)}</SelectContent></Select></label>
            </div>}

            {acaoAtual && ![
              "GERAR_CONTRATO", "GERAR_FICHA", "MATERIALIZAR_CHECKLIST", "SINCRONIZAR_TRANSCRICAO_REUNIAO", "MARCAR_ALERTA_TAREFA",
              "ADICIONAR_ANOTACAO", "CRIAR_ALERTA", "MOVER_CARD", "ALTERAR_CAMPO", "ATRIBUIR_RESPONSAVEL", "CRIAR_TAREFA", "ENVIAR_EMAIL", "HTTP", "WEBHOOK",
            ].includes(acaoAtual.tipo) && <p className="rounded-lg border border-amber-400/15 bg-amber-400/[0.04] p-3 text-xs text-amber-100">A ação existe no Motor, mas possui uma configuração composta. Use o modo avançado abaixo para seus parâmetros específicos.</p>}
          </section>

          <details className="group rounded-xl border border-white/10 sm:col-span-2">
            <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold text-slate-300 marker:content-none">Modo avançado <span className="font-normal text-slate-500">— gatilho, condições e grafo JSON</span></summary>
            <div className="grid gap-4 border-t border-white/10 p-4">
              <label className="text-xs text-slate-300">Configuração adicional do gatilho<textarea className="mt-1 min-h-28 w-full rounded-md border border-white/10 bg-slate-900 p-3 font-mono text-xs" value={gatilhoExtrasJson} onChange={(e) => setGatilhoExtrasJson(e.target.value)} spellCheck={false} /></label>
              <label className="text-xs text-slate-300">Condições — Motor de Regras (vazio = sempre)<textarea className="mt-1 min-h-32 w-full rounded-md border border-white/10 bg-slate-900 p-3 font-mono text-xs" value={condicaoJson} onChange={(e) => setCondicaoJson(e.target.value)} spellCheck={false} /></label>
              <label className="text-xs text-slate-300">Ações e ordem — grafo do Motor Central<textarea className="mt-1 min-h-72 w-full rounded-md border border-white/10 bg-slate-900 p-3 font-mono text-xs" value={grafoJson} onChange={(e) => setGrafoJson(e.target.value)} spellCheck={false} /></label>
            </div>
          </details>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose} disabled={pending}>Cancelar</Button><Button onClick={salvar} disabled={pending}>{pending ? "Salvando..." : "Salvar nova versão"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
