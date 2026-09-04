import { z } from "zod";

import { BPM_TAREFA_TIPOS } from "@/lib/bpm/tarefas-tipo";

export const SLA_ESCOPOS = ["PIPELINE", "ETAPA", "TAREFA", "TIPO_PROCESSO", "SERVICO"] as const;
export const SLA_UNIDADES = ["MINUTOS", "HORAS", "DIAS", "DIAS_UTEIS"] as const;
export const SLA_INICIOS = [
  "CRIACAO_CARD",
  "ENTRADA_ETAPA",
  "CRIACAO_TAREFA",
  "PRIMEIRA_VISUALIZACAO",
  "TAREFA_CONCLUIDA",
  "MANUAL",
  "CUSTOM",
] as const;
export const SLA_TIPOS_LIMITE = ["PERCENTUAL_CONSUMIDO", "TEMPO_RESTANTE", "ATRASO"] as const;
export const SLA_REGRAS_PAUSA = ["NUNCA", "STANDBY"] as const;

const nullableCuid = z.string().cuid().nullable();
const nullableTexto = z.string().trim().max(120).nullable();

export const slaConfiguracaoAdminSchema = z.object({
  id: z.string().cuid().optional(),
  pipelineId: z.string().cuid(),
  nome: z.string().trim().min(2, "Informe um nome.").max(120),
  escopo: z.enum(SLA_ESCOPOS),
  etapaId: nullableCuid,
  tipoTarefa: z.enum(BPM_TAREFA_TIPOS).nullable(),
  tipoProcesso: nullableTexto,
  servicoId: z.number().int().positive().nullable(),
  quantidade: z.number().int().min(1, "O prazo deve ser maior que zero.").max(100_000),
  unidade: z.enum(SLA_UNIDADES),
  inicioMomento: z.enum(SLA_INICIOS),
  pausaRegra: z.enum(SLA_REGRAS_PAUSA),
  ativa: z.boolean(),
  amareloTipo: z.enum(SLA_TIPOS_LIMITE),
  amareloValor: z.number().min(0).max(100_000),
  amareloUnidade: z.enum(SLA_UNIDADES).nullable(),
  vermelhoTipo: z.enum(SLA_TIPOS_LIMITE),
  vermelhoValor: z.number().min(0).max(100_000),
  vermelhoUnidade: z.enum(SLA_UNIDADES).nullable(),
}).superRefine((dados, context) => {
  const requisitos = {
    ETAPA: Boolean(dados.etapaId),
    TAREFA: Boolean(dados.tipoTarefa),
    TIPO_PROCESSO: Boolean(dados.tipoProcesso),
    SERVICO: Boolean(dados.servicoId),
    PIPELINE: true,
  };
  if (!requisitos[dados.escopo]) {
    context.addIssue({ code: "custom", path: ["escopo"], message: "Preencha o detalhe do escopo selecionado." });
  }
  for (const prefixo of ["amarelo", "vermelho"] as const) {
    if (dados[`${prefixo}Tipo`] !== "PERCENTUAL_CONSUMIDO" && !dados[`${prefixo}Unidade`]) {
      context.addIssue({ code: "custom", path: [`${prefixo}Unidade`], message: "Selecione a unidade do limite." });
    }
  }
});

export const slaConfigIdSchema = z.object({
  id: z.string().cuid(),
  pipelineId: z.string().cuid(),
});

export const slaConfigStatusSchema = slaConfigIdSchema.extend({ ativa: z.boolean() });

export type SlaConfiguracaoAdminInput = z.infer<typeof slaConfiguracaoAdminSchema>;

export interface SlaAlertaAdmin {
  id: string;
  tipoLimite: (typeof SLA_TIPOS_LIMITE)[number];
  valor: number;
  unidade: (typeof SLA_UNIDADES)[number] | null;
  statusResultante: "PROXIMO_VENCIMENTO" | "ATRASADO";
}

export interface SlaConfiguracaoAdmin {
  id: string;
  pipelineId: string;
  nome: string;
  etapaId: string | null;
  etapaNome: string | null;
  tipoTarefa: string | null;
  tipoProcesso: string | null;
  servicoId: number | null;
  servicoNome: string | null;
  quantidade: number;
  unidade: (typeof SLA_UNIDADES)[number];
  inicioMomento: (typeof SLA_INICIOS)[number];
  pausaRegra: (typeof SLA_REGRAS_PAUSA)[number];
  ativa: boolean;
  alertaLimites: SlaAlertaAdmin[];
}
