import type { ContratoComercialSource } from "./metas-adapter";
import type { AdapterFieldConflict, CompanyEventSource, MergedCompanyEvent } from "./types";

/**
 * Merge de ContratoComercial (Alpha Metas) + clientes (CS&NPS) por cnpj+servico
 * normalizado — decisão confirmada pelo usuário (Fase 01, não reabrir): nenhuma das duas
 * fontes é descartada. Campo presente em ContratoComercial prevalece quando ambas têm
 * valor (fonte contratual formal); campo ausente em ContratoComercial mas presente em
 * clientes (analistaResponsavel, dataExito, embasamento, origemLead) é herdado de lá.
 * Conflito real (mesmo campo, valores DIFERENTES nas duas fontes) nunca é resolvido em
 * silêncio — vira entrada em `conflicts`, que o chamador (sync-engine) transforma em
 * CommissionDivergence (PENDING_REVIEW).
 */

function normalizarServico(servico: string): string {
  return servico.trim().toUpperCase();
}

function normalizarCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

export function chaveDeCasamento(cnpj: string, servico: string): string {
  return `${normalizarCnpj(cnpj)}::${normalizarServico(servico)}`;
}

/** true quando os dois valores diferem de forma NÃO trivial (ambos presentes e diferentes). */
function difereRealmente(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return a !== b;
}

export function mergeCompanyEvent(params: {
  clienteId: number | null;
  contratoComercialId: string | null;
  cliente: CompanyEventSource | null;
  contrato: ContratoComercialSource | null;
}): MergedCompanyEvent {
  const { clienteId, contratoComercialId, cliente, contrato } = params;

  if (!cliente && !contrato) {
    throw new Error("mergeCompanyEvent requer pelo menos uma fonte (cliente ou contrato) presente.");
  }

  const conflicts: AdapterFieldConflict[] = [];

  function resolveField<T>(fieldName: string, contratoValue: T | null | undefined, clienteValue: T | null | undefined): T | null {
    const cVal = contratoValue ?? null;
    const clVal = clienteValue ?? null;

    if (cVal !== null && clVal !== null && difereRealmente(cVal, clVal)) {
      conflicts.push({ field: fieldName, valorContratoComercial: cVal, valorClientes: clVal });
    }

    // ContratoComercial prevalece quando ambos têm valor; senão usa o que existir.
    return cVal !== null ? cVal : clVal;
  }

  const razaoSocial = resolveField("razaoSocial", contrato?.razaoSocial, cliente?.razaoSocial) ?? "";
  const cnpj = resolveField("cnpj", contrato?.cnpj, cliente?.cnpj) ?? "";
  const servico = resolveField("servico", contrato?.servico, cliente?.servico) ?? "";
  const formaPagamento = resolveField("formaPagamento", contrato?.formaPagamento, cliente?.formaPagamento);
  const valorContratoCents = resolveField("valorContratoCents", contrato?.valorContratoCents, cliente?.valorContratoCents);
  const closerNome = resolveField("closerNome", contrato?.closerNome, cliente?.closerNome);
  const nomeFantasia = resolveField("nomeFantasia", contrato?.nomeFantasia, cliente?.nomeFantasia);

  // Campos que só existem em `clientes` — sempre herdados de lá, nunca em conflito (ContratoComercial não os tem).
  const analistaResponsavel = cliente?.analistaResponsavel ?? null;
  const dataExito = cliente?.dataExito ?? null;

  // dataContratacao: prioriza pagamentoConfirmadoEm (ContratoComercial, mais formal), senão a de clientes.
  const dataContratacao = contrato?.pagamentoConfirmadoEm ?? cliente?.dataContratacao ?? null;

  return {
    clienteId,
    contratoComercialId,
    cnpj,
    razaoSocial,
    nomeFantasia,
    servico,
    formaPagamento,
    valorContratoCents,
    closerNome,
    analistaResponsavel,
    dataContratacao,
    dataExito,
    usuarioIdCloser: contrato?.usuarioId ?? null,
    pagamentoConfirmado: contrato?.pagamentoConfirmado ?? null,
    pagamentoConfirmadoEm: contrato?.pagamentoConfirmadoEm ?? null,
    conflicts,
  };
}
