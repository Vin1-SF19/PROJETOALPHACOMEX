"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CheckCircle2, Loader2, Timer, XCircle } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { BPM_TAREFA_TIPOS, obterConfigTipoTarefa } from "@/lib/bpm/tarefas-tipo";
import {
  SLA_INICIOS,
  SLA_TIPOS_LIMITE,
  SLA_UNIDADES,
  slaConfiguracaoAdminSchema,
  type SlaConfiguracaoAdmin,
  type SlaConfiguracaoAdminInput,
} from "@/lib/validations/bpm-sla";

interface SlaConfigFormProps {
  pipelineId: string;
  etapas: { id: string; nome: string }[];
  servicos: { id: number; nome: string }[];
  inicial?: SlaConfiguracaoAdmin;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (dados: SlaConfiguracaoAdminInput) => Promise<void>;
}

const labels = {
  unidade: { MINUTOS: "Minutos", HORAS: "Horas", DIAS: "Dias", DIAS_UTEIS: "Dias úteis" },
  inicio: { CRIACAO_CARD: "Criação do card", ENTRADA_ETAPA: "Entrada na etapa", CRIACAO_TAREFA: "Criação da tarefa", PRIMEIRA_VISUALIZACAO: "Primeira visualização", TAREFA_CONCLUIDA: "Conclusão da tarefa", MANUAL: "Início manual", CUSTOM: "Regra personalizada" },
  limite: { PERCENTUAL_CONSUMIDO: "% do prazo consumido", TEMPO_RESTANTE: "Tempo restante", ATRASO: "Tempo em atraso" },
} as const;

function detectarEscopo(config?: SlaConfiguracaoAdmin): SlaConfiguracaoAdminInput["escopo"] {
  if (config?.etapaId) return "ETAPA";
  if (config?.tipoTarefa) return "TAREFA";
  if (config?.tipoProcesso) return "TIPO_PROCESSO";
  if (config?.servicoId) return "SERVICO";
  return "PIPELINE";
}

function limite(config: SlaConfiguracaoAdmin | undefined, status: "PROXIMO_VENCIMENTO" | "ATRASADO") {
  return config?.alertaLimites.find((item) => item.statusResultante === status);
}

export function SlaConfigForm({ pipelineId, etapas, servicos, inicial, isSaving, onCancel, onSave }: SlaConfigFormProps) {
  const amarelo = limite(inicial, "PROXIMO_VENCIMENTO");
  const vermelho = limite(inicial, "ATRASADO");
  const { register, control, handleSubmit, formState: { errors } } = useForm<SlaConfiguracaoAdminInput>({
    resolver: zodResolver(slaConfiguracaoAdminSchema),
    defaultValues: {
      id: inicial?.id,
      pipelineId,
      nome: inicial?.nome ?? "",
      escopo: detectarEscopo(inicial),
      etapaId: inicial?.etapaId ?? null,
      tipoTarefa: (inicial?.tipoTarefa as SlaConfiguracaoAdminInput["tipoTarefa"]) ?? null,
      tipoProcesso: inicial?.tipoProcesso ?? null,
      servicoId: inicial?.servicoId ?? null,
      quantidade: inicial?.quantidade ?? 1,
      unidade: inicial?.unidade ?? "DIAS",
      inicioMomento: inicial?.inicioMomento ?? "ENTRADA_ETAPA",
      pausaRegra: inicial?.pausaRegra ?? "STANDBY",
      ativa: inicial?.ativa ?? true,
      amareloTipo: amarelo?.tipoLimite ?? "PERCENTUAL_CONSUMIDO",
      amareloValor: amarelo?.valor ?? 75,
      amareloUnidade: amarelo?.unidade ?? null,
      vermelhoTipo: vermelho?.tipoLimite ?? "ATRASO",
      vermelhoValor: vermelho?.valor ?? 0,
      vermelhoUnidade: vermelho?.unidade ?? "MINUTOS",
    },
  });
  const escopo = useWatch({ control, name: "escopo" });
  const amareloTipo = useWatch({ control, name: "amareloTipo" });
  const vermelhoTipo = useWatch({ control, name: "vermelhoTipo" });

  const fieldClass = "w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-indigo-400 aria-invalid:border-rose-400";
  const erro = errors.escopo?.message ?? errors.nome?.message ?? errors.quantidade?.message ?? errors.amareloUnidade?.message ?? errors.vermelhoUnidade?.message;

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-5 rounded-2xl border border-white/10 bg-slate-900/60 p-4" noValidate>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-xs text-slate-400">Nome
          <input {...register("nome")} aria-invalid={Boolean(errors.nome)} className={fieldClass} placeholder="Ex.: Retorno comercial" />
        </label>
        <label className="space-y-1 text-xs text-slate-400">Escopo
          <select {...register("escopo")} className={fieldClass}><option value="PIPELINE">Pipeline atual</option><option value="ETAPA">Etapa</option><option value="TAREFA">Tipo de tarefa</option><option value="TIPO_PROCESSO">Tipo de processo</option><option value="SERVICO">Serviço</option></select>
        </label>
        {escopo === "ETAPA" && <label className="space-y-1 text-xs text-slate-400">Etapa<select {...register("etapaId", { setValueAs: (v) => v || null })} className={fieldClass}><option value="">Selecione</option>{etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></label>}
        {escopo === "TAREFA" && <label className="space-y-1 text-xs text-slate-400">Tipo de tarefa<select {...register("tipoTarefa", { setValueAs: (v) => v || null })} className={fieldClass}><option value="">Selecione</option>{BPM_TAREFA_TIPOS.map((tipo) => <option key={tipo} value={tipo}>{obterConfigTipoTarefa(tipo).label}</option>)}</select></label>}
        {escopo === "TIPO_PROCESSO" && <label className="space-y-1 text-xs text-slate-400">Tipo de processo<input {...register("tipoProcesso", { setValueAs: (v) => v || null })} className={fieldClass} placeholder="Nome do processo" /></label>}
        {escopo === "SERVICO" && <label className="space-y-1 text-xs text-slate-400">Serviço<select {...register("servicoId", { setValueAs: (v) => v ? Number(v) : null })} className={fieldClass}><option value="">Selecione</option>{servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></label>}
        <label className="space-y-1 text-xs text-slate-400">Prazo<input type="number" min={1} {...register("quantidade", { valueAsNumber: true })} aria-invalid={Boolean(errors.quantidade)} className={fieldClass} /></label>
        <label className="space-y-1 text-xs text-slate-400">Unidade<select {...register("unidade")} className={fieldClass}>{SLA_UNIDADES.map((item) => <option key={item} value={item}>{labels.unidade[item]}</option>)}</select></label>
        <label className="space-y-1 text-xs text-slate-400">Início da contagem<select {...register("inicioMomento")} className={fieldClass}>{SLA_INICIOS.map((item) => <option key={item} value={item}>{labels.inicio[item]}</option>)}</select></label>
        <label className="space-y-1 text-xs text-slate-400">Pausa e retomada<select {...register("pausaRegra")} className={fieldClass}><option value="STANDBY">Pausar em Standby e retomar ao sair</option><option value="NUNCA">Nunca pausar</option></select></label>
      </div>

      <fieldset className="grid gap-3 rounded-xl border border-white/5 bg-slate-950/40 p-3 md:grid-cols-2">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-300">Limites de alerta</legend>
        {(["amarelo", "vermelho"] as const).map((prefixo) => {
          const tipo = prefixo === "amarelo" ? amareloTipo : vermelhoTipo;
          return <div key={prefixo} className="space-y-2 rounded-xl border border-white/5 p-3">
            <p className={prefixo === "amarelo" ? "text-sm font-semibold text-amber-300" : "text-sm font-semibold text-rose-300"}>{prefixo === "amarelo" ? "Amarelo — atenção" : "Vermelho — vencido"}</p>
            <select {...register(`${prefixo}Tipo`)} className={fieldClass}>{SLA_TIPOS_LIMITE.map((item) => <option key={item} value={item}>{labels.limite[item]}</option>)}</select>
            <div className="grid grid-cols-2 gap-2"><input aria-label={`Valor do limite ${prefixo}`} type="number" min={0} step="0.1" {...register(`${prefixo}Valor`, { valueAsNumber: true })} className={fieldClass} />{tipo === "PERCENTUAL_CONSUMIDO" ? <div className={`${fieldClass} text-slate-400`}>%</div> : <select aria-label={`Unidade do limite ${prefixo}`} {...register(`${prefixo}Unidade`, { setValueAs: (v) => v || null })} className={fieldClass}>{SLA_UNIDADES.map((item) => <option key={item} value={item}>{labels.unidade[item]}</option>)}</select>}</div>
          </div>;
        })}
      </fieldset>

      <div aria-label="Prévia dos estados do SLA" className="flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-slate-950/50 p-3">
        <span className="mr-1 flex items-center gap-1 text-xs text-slate-500"><Timer size={14} aria-hidden="true" />Prévia</span>
        <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300"><CheckCircle2 size={13} />Dentro do prazo</span>
        <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300"><AlertTriangle size={13} />Próximo do vencimento</span>
        <span className="flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-300"><XCircle size={13} />Vencido</span>
      </div>
      {erro && <p className="text-xs text-rose-300" role="alert">{erro}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="animate-spin" aria-hidden="true" />}{isSaving ? "Salvando..." : "Salvar SLA"}</Button></div>
    </form>
  );
}
