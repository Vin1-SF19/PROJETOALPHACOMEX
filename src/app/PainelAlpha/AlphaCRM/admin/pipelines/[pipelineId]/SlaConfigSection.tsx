"use client";

import { Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AtivarDesativarConfiguracaoSlaBpm, ExcluirConfiguracaoSlaBpm, SalvarConfiguracaoSlaBpm, SimularConfiguracaoSlaBpm } from "@/actions/bpm/Sla";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { obterConfigTipoTarefa } from "@/lib/bpm/tarefas-tipo";
import type { SlaConfiguracaoAdmin, SlaConfiguracaoAdminInput } from "@/lib/validations/bpm-sla";
import { SlaConfigForm } from "./SlaConfigForm";

interface SlaConfigSectionProps {
  pipelineId: string;
  pipelineNome: string;
  etapas: { id: string; nome: string }[];
  servicos: { id: number; nome: string }[];
  configuracoesIniciais: SlaConfiguracaoAdmin[];
}

const unidadeLabel = { MINUTOS: "min", HORAS: "h", DIAS: "dias", DIAS_UTEIS: "dias úteis" } as const;
const inicioLabel = { CRIACAO_CARD: "Criação do card", ENTRADA_ETAPA: "Entrada na etapa", CRIACAO_TAREFA: "Criação da tarefa", PRIMEIRA_VISUALIZACAO: "Primeira visualização", TAREFA_CONCLUIDA: "Conclusão da tarefa", MANUAL: "Manual", CUSTOM: "Personalizado" } as const;

function nomeEscopo(config: SlaConfiguracaoAdmin, pipelineNome: string) {
  if (config.etapaNome) return `Etapa · ${config.etapaNome}`;
  if (config.tipoTarefa) return `Tarefa · ${obterConfigTipoTarefa(config.tipoTarefa).label}`;
  if (config.tipoProcesso) return `Processo · ${config.tipoProcesso}`;
  if (config.servicoNome) return `Serviço · ${config.servicoNome}`;
  return `Pipeline · ${pipelineNome}`;
}

function erroMensagem(error: unknown, fallback: string) {
  if (typeof error === "string") return error;
  return fallback;
}

export function SlaConfigSection({ pipelineId, pipelineNome, etapas, servicos, configuracoesIniciais }: SlaConfigSectionProps) {
  const [configuracoes, setConfiguracoes] = useState(configuracoesIniciais);
  const [editando, setEditando] = useState<SlaConfiguracaoAdmin | null | "novo">(null);
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cardSimulacao, setCardSimulacao] = useState("");
  const [tarefaSimulacao, setTarefaSimulacao] = useState("");
  const [gatilhoSimulacao, setGatilhoSimulacao] = useState<keyof typeof inicioLabel>("ENTRADA_ETAPA");
  const [resultadoSimulacao, setResultadoSimulacao] = useState<string | null>(null);
  const sobreposicoes = configuracoes.filter((config, indice) => config.ativa && configuracoes.some((outra, outroIndice) =>
    outroIndice !== indice
    && outra.ativa
    && outra.inicioMomento === config.inicioMomento
    && outra.etapaId === config.etapaId
    && outra.tipoTarefa === config.tipoTarefa
    && outra.tipoProcesso === config.tipoProcesso
    && outra.servicoId === config.servicoId,
  )).length;

  async function salvar(dados: SlaConfiguracaoAdminInput) {
    if (isSaving || busyId) return;
    setIsSaving(true);
    try {
      const resultado = await SalvarConfiguracaoSlaBpm(dados);
      if (!resultado.success || !resultado.data) {
        toast.error(erroMensagem(resultado.error, "Não foi possível salvar o SLA."));
        return;
      }
      setConfiguracoes((atuais) => {
        const existe = atuais.some((item) => item.id === resultado.data.id);
        return (existe
          ? atuais.map((item) => item.id === resultado.data.id ? resultado.data : item)
          : [...atuais, resultado.data]
        ).sort((a, b) => Number(b.ativa) - Number(a.ativa) || b.prioridade - a.prioridade);
      });
      setEditando(null);
      toast.success(dados.id ? "SLA atualizado." : "SLA criado.");
    } finally {
      setIsSaving(false);
    }
  }

  async function alternar(config: SlaConfiguracaoAdmin) {
    if (isSaving || busyId) return;
    setBusyId(config.id);
    try {
      const resultado = await AtivarDesativarConfiguracaoSlaBpm({ id: config.id, pipelineId, ativa: !config.ativa });
      if (!resultado.success) return toast.error(erroMensagem(resultado.error, "Não foi possível atualizar o status."));
      setConfiguracoes((atuais) => atuais.map((item) => item.id === config.id ? { ...item, ativa: !item.ativa } : item));
      toast.success(config.ativa ? "SLA desativado." : "SLA ativado.");
    } finally {
      setBusyId(null);
    }
  }

  async function excluir(config: SlaConfiguracaoAdmin) {
    if (isSaving || busyId) return;
    if (!window.confirm(`Excluir o SLA “${config.nome}”? Configurações com histórico devem ser apenas desativadas.`)) return;
    setBusyId(config.id);
    try {
      const resultado = await ExcluirConfiguracaoSlaBpm({ id: config.id, pipelineId });
      if (!resultado.success) return toast.error(erroMensagem(resultado.error, "Não foi possível excluir o SLA."));
      setConfiguracoes((atuais) => atuais.filter((item) => item.id !== config.id));
      toast.success("SLA excluído.");
    } finally {
      setBusyId(null);
    }
  }

  async function simular() {
    if (!cardSimulacao.trim() || isSaving || busyId) return;
    setBusyId("simulacao");
    setResultadoSimulacao(null);
    try {
      const resultado = await SimularConfiguracaoSlaBpm({
        pipelineId,
        cardId: cardSimulacao.trim(),
        tarefaId: tarefaSimulacao.trim() || undefined,
        gatilho: gatilhoSimulacao,
      });
      if (!resultado.success) {
        toast.error(erroMensagem(resultado.error, "Não foi possível simular o SLA."));
        return;
      }
      setResultadoSimulacao(resultado.data
        ? `${resultado.data.nome} · prioridade ${resultado.data.prioridade} · ${resultado.data.quantidade} ${unidadeLabel[resultado.data.unidade]}`
        : "Nenhuma configuração aplicável ao cenário informado.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="sla-alertas-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 id="sla-alertas-title" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white"><ShieldAlert size={16} aria-hidden="true" />SLA e Alertas</h2><p className="mt-1 text-xs text-slate-500">Prazos, início da contagem, pausa e limites sem alterar código.</p></div>
        <Button size="sm" disabled={isSaving || Boolean(busyId)} onClick={() => setEditando("novo")}><Plus aria-hidden="true" />Novo SLA</Button>
      </div>

      {editando && <SlaConfigForm key={editando === "novo" ? "novo" : editando.id} pipelineId={pipelineId} etapas={etapas} servicos={servicos} inicial={editando === "novo" ? undefined : editando} isSaving={isSaving} onCancel={() => setEditando(null)} onSave={salvar} />}

      {sobreposicoes > 0 && <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200" role="status">Há {sobreposicoes} configurações ativas com o mesmo escopo e gatilho. O runtime aplica maior prioridade, depois maior especificidade e, por fim, a mais antiga.</p>}

      <fieldset className="rounded-2xl border border-white/10 bg-slate-900/35 p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-400">Simulação real do runtime</legend>
        <p className="mb-3 text-xs text-slate-500">Executa a seleção canônica em modo somente leitura; nenhuma instância ou evento é criado.</p>
        <div className="grid gap-2 lg:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_220px_auto]">
          <input aria-label="ID do card para simulação" value={cardSimulacao} onChange={(event) => setCardSimulacao(event.target.value)} placeholder="ID do card" className="min-h-10 rounded-lg border border-white/10 bg-slate-800 px-3 text-sm text-white" />
          <input aria-label="ID opcional da tarefa para simulação" value={tarefaSimulacao} onChange={(event) => setTarefaSimulacao(event.target.value)} placeholder="ID da tarefa (opcional)" className="min-h-10 rounded-lg border border-white/10 bg-slate-800 px-3 text-sm text-white" />
          <select aria-label="Gatilho da simulação" value={gatilhoSimulacao} onChange={(event) => setGatilhoSimulacao(event.target.value as keyof typeof inicioLabel)} className="min-h-10 rounded-lg border border-white/10 bg-slate-800 px-3 text-sm text-white">{Object.entries(inicioLabel).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}</select>
          <Button type="button" disabled={!cardSimulacao.trim() || isSaving || Boolean(busyId)} onClick={() => void simular()}>{busyId === "simulacao" ? "Simulando…" : "Simular"}</Button>
        </div>
        {resultadoSimulacao && <p className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.05] px-3 py-2 text-xs text-cyan-100" role="status">{resultadoSimulacao}</p>}
      </fieldset>

      {configuracoes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/30 px-5 py-10 text-center"><p className="text-sm font-medium text-slate-300">Nenhum SLA configurado</p><p className="mt-1 text-xs text-slate-500">Crie o primeiro prazo para este pipeline.</p></div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-900/35">
          <table className="w-full min-w-[820px] text-left text-sm"><thead className="border-b border-white/5 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Configuração</th><th className="px-4 py-3">Escopo</th><th className="px-4 py-3">Prioridade</th><th className="px-4 py-3">Prazo</th><th className="px-4 py-3">Início</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ações</th></tr></thead>
            <tbody className="divide-y divide-white/5">{configuracoes.map((config) => <tr key={config.id} className="text-slate-300"><td className="px-4 py-3"><p className="font-semibold text-white">{config.nome}</p><p className="mt-0.5 text-xs text-slate-500">{config.pausaRegra === "STANDBY" ? "Pausa em Standby" : "Sem pausa automática"}</p></td><td className="px-4 py-3">{nomeEscopo(config, pipelineNome)}</td><td className="px-4 py-3 tabular-nums">{config.prioridade}</td><td className="px-4 py-3 tabular-nums">{config.quantidade} {unidadeLabel[config.unidade]}</td><td className="px-4 py-3">{inicioLabel[config.inicioMomento]}</td><td className="px-4 py-3"><span className={config.ativa ? "rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-300" : "rounded-full bg-slate-500/15 px-2 py-1 text-xs text-slate-400"}>{config.ativa ? "Ativo" : "Inativo"}</span></td><td className="px-4 py-3"><div className="flex justify-end gap-1"><button type="button" disabled={isSaving || Boolean(busyId)} onClick={() => void alternar(config)} className="inline-flex items-center p-2 disabled:opacity-40" aria-label={`${config.ativa ? "Desativar" : "Ativar"} ${config.nome}`}><Switch checked={config.ativa} size="sm" /></button><Button type="button" variant="ghost" size="icon-sm" disabled={isSaving || Boolean(busyId)} onClick={() => setEditando(config)} aria-label={`Editar ${config.nome}`}><Pencil /></Button><Button type="button" variant="ghost" size="icon-sm" disabled={isSaving || Boolean(busyId)} onClick={() => void excluir(config)} aria-label={`Excluir ${config.nome}`} className="text-slate-400 hover:text-rose-300"><Trash2 /></Button></div></td></tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
