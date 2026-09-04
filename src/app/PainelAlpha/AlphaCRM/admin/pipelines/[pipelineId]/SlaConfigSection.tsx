"use client";

import { Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AtivarDesativarConfiguracaoSlaBpm, ExcluirConfiguracaoSlaBpm, ListarConfiguracoesSlaBpm, SalvarConfiguracaoSlaBpm } from "@/actions/bpm/Sla";
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

  async function recarregar() {
    const resultado = await ListarConfiguracoesSlaBpm(pipelineId);
    if (resultado.success) setConfiguracoes(resultado.data);
    else toast.error(erroMensagem(resultado.error, "Não foi possível recarregar os SLAs."));
  }

  async function salvar(dados: SlaConfiguracaoAdminInput) {
    setIsSaving(true);
    try {
      const resultado = await SalvarConfiguracaoSlaBpm(dados);
      if (!resultado.success) {
        toast.error(erroMensagem(resultado.error, "Não foi possível salvar o SLA."));
        return;
      }
      await recarregar();
      setEditando(null);
      toast.success(dados.id ? "SLA atualizado." : "SLA criado.");
    } finally {
      setIsSaving(false);
    }
  }

  async function alternar(config: SlaConfiguracaoAdmin) {
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

  return (
    <section className="space-y-4" aria-labelledby="sla-alertas-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 id="sla-alertas-title" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white"><ShieldAlert size={16} aria-hidden="true" />SLA e Alertas</h2><p className="mt-1 text-xs text-slate-500">Prazos, início da contagem, pausa e limites sem alterar código.</p></div>
        <Button size="sm" onClick={() => setEditando("novo")}><Plus aria-hidden="true" />Novo SLA</Button>
      </div>

      {editando && <SlaConfigForm key={editando === "novo" ? "novo" : editando.id} pipelineId={pipelineId} etapas={etapas} servicos={servicos} inicial={editando === "novo" ? undefined : editando} isSaving={isSaving} onCancel={() => setEditando(null)} onSave={salvar} />}

      {configuracoes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/30 px-5 py-10 text-center"><p className="text-sm font-medium text-slate-300">Nenhum SLA configurado</p><p className="mt-1 text-xs text-slate-500">Crie o primeiro prazo para este pipeline.</p></div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-900/35">
          <table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-white/5 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Configuração</th><th className="px-4 py-3">Escopo</th><th className="px-4 py-3">Prazo</th><th className="px-4 py-3">Início</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ações</th></tr></thead>
            <tbody className="divide-y divide-white/5">{configuracoes.map((config) => <tr key={config.id} className="text-slate-300"><td className="px-4 py-3"><p className="font-semibold text-white">{config.nome}</p><p className="mt-0.5 text-xs text-slate-500">{config.pausaRegra === "STANDBY" ? "Pausa em Standby" : "Sem pausa automática"}</p></td><td className="px-4 py-3">{nomeEscopo(config, pipelineNome)}</td><td className="px-4 py-3 tabular-nums">{config.quantidade} {unidadeLabel[config.unidade]}</td><td className="px-4 py-3">{inicioLabel[config.inicioMomento]}</td><td className="px-4 py-3"><span className={config.ativa ? "rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-300" : "rounded-full bg-slate-500/15 px-2 py-1 text-xs text-slate-400"}>{config.ativa ? "Ativo" : "Inativo"}</span></td><td className="px-4 py-3"><div className="flex justify-end gap-1"><button type="button" disabled={busyId === config.id} onClick={() => void alternar(config)} className="inline-flex items-center p-2 disabled:opacity-40" aria-label={`${config.ativa ? "Desativar" : "Ativar"} ${config.nome}`}><Switch checked={config.ativa} size="sm" /></button><Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditando(config)} aria-label={`Editar ${config.nome}`}><Pencil /></Button><Button type="button" variant="ghost" size="icon-sm" disabled={busyId === config.id} onClick={() => void excluir(config)} aria-label={`Excluir ${config.nome}`} className="text-slate-400 hover:text-rose-300"><Trash2 /></Button></div></td></tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
