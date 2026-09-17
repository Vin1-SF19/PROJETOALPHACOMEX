import { normalizeRole } from "@/lib/roles";

export const DIAS_PARA_ALERTA_ULTIMO_CS = 10;
export const STATUS_EM_ANDAMENTO = "Em Andamento";

export const STATUS_CLIENTE_SERVICO = [
  STATUS_EM_ANDAMENTO,
  "Deferido",
  "Stand By",
  "Cancelado - Indeferimento",
  "Cancelado - Troca de Empresa",
] as const;

export type StatusClienteServico = (typeof STATUS_CLIENTE_SERVICO)[number];

export type TipoPendenciaCs = "SEM_CS" | "CS_VENCIDO";

type LogCsComData = {
  dataRegistro?: Date | string | null;
  data_registro?: Date | string | null;
};

export interface PendenciaUltimoCs {
  clienteServicoId: number;
  clienteId: number;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string | null;
  servico: string;
  tipo: TipoPendenciaCs;
  ultimoCsEm: string | null;
  venceEm: string | null;
  diasSemAtualizacao: number | null;
}

const MILISSEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

export function podeReceberAlertasUltimoCs(role?: string | null): boolean {
  const roleNormalizada = normalizeRole(role);
  return roleNormalizada === "ADMIN"
    || roleNormalizada === "TI"
    || roleNormalizada === "RECURSOSHUMANOS";
}

export function resolverUltimoCs(logs: readonly LogCsComData[]): Date | null {
  let maiorTimestamp = Number.NEGATIVE_INFINITY;

  for (const log of logs) {
    const valor = log.dataRegistro ?? log.data_registro;
    if (!valor) continue;
    const timestamp = new Date(valor).getTime();
    if (Number.isFinite(timestamp) && timestamp > maiorTimestamp) maiorTimestamp = timestamp;
  }

  return Number.isFinite(maiorTimestamp) ? new Date(maiorTimestamp) : null;
}

export function calcularAlertaUltimoCs(params: {
  status?: string | null;
  logs: readonly LogCsComData[];
  agora?: Date;
}): { ultimoCs: Date; venceEm: Date; diasSemAtualizacao: number } | null {
  if (params.status !== STATUS_EM_ANDAMENTO) return null;

  const ultimoCs = resolverUltimoCs(params.logs);
  if (!ultimoCs) return null;

  const agora = params.agora ?? new Date();
  const timestampAgora = agora.getTime();
  if (!Number.isFinite(timestampAgora)) return null;

  const venceEm = new Date(ultimoCs.getTime() + DIAS_PARA_ALERTA_ULTIMO_CS * MILISSEGUNDOS_POR_DIA);
  if (timestampAgora < venceEm.getTime()) return null;

  return {
    ultimoCs,
    venceEm,
    diasSemAtualizacao: Math.floor((timestampAgora - ultimoCs.getTime()) / MILISSEGUNDOS_POR_DIA),
  };
}

export function calcularPendenciaCs(params: {
  status?: string | null;
  logs: readonly LogCsComData[];
  agora?: Date;
}): {
  tipo: TipoPendenciaCs;
  ultimoCs: Date | null;
  venceEm: Date | null;
  diasSemAtualizacao: number | null;
} | null {
  if (params.status !== STATUS_EM_ANDAMENTO) return null;

  const ultimoCs = resolverUltimoCs(params.logs);
  if (!ultimoCs) {
    return {
      tipo: "SEM_CS",
      ultimoCs: null,
      venceEm: null,
      diasSemAtualizacao: null,
    };
  }

  const alerta = calcularAlertaUltimoCs(params);
  if (!alerta) return null;

  return {
    tipo: "CS_VENCIDO",
    ...alerta,
  };
}
