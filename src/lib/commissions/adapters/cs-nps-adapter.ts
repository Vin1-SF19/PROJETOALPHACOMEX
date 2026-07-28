import db from "@/lib/prisma";
import { parseClienteDateString } from "./date-parsing";
import type { CompanyEventSource } from "./types";

/**
 * Adapter somente-leitura do módulo CS&NPS (`clientes`). Nunca escreve nessa tabela.
 * `valorContrato` é `Float?` no schema de origem — convertido para centavos aqui
 * (Math.round(valor * 100)), já que o módulo de Comissões nunca usa Float internamente.
 */

interface ClienteAdapterRow {
  id: number;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  servicos: string | null;
  formaPagamento: string | null;
  valorContrato: number | null;
  closerNome: string | null;
  analistaResponsavel: string | null;
  dataContratacao: string | null;
  dataExito: string | null;
  embasamento: string | null;
  origemLead: string | null;
}

export function mapClienteToCompanyEventSource(cliente: ClienteAdapterRow): CompanyEventSource {
  const dataContratacao = parseClienteDateString(cliente.dataContratacao);
  const dataExito = parseClienteDateString(cliente.dataExito);

  return {
    cnpj: cliente.cnpj,
    razaoSocial: cliente.razaoSocial,
    nomeFantasia: cliente.nomeFantasia,
    servico: cliente.servicos ?? "",
    formaPagamento: cliente.formaPagamento,
    valorContratoCents: cliente.valorContrato !== null ? Math.round(cliente.valorContrato * 100) : null,
    closerNome: cliente.closerNome,
    analistaResponsavel: cliente.analistaResponsavel,
    dataContratacao: dataContratacao.date,
    dataExito: dataExito.date,
    embasamento: cliente.embasamento,
    origemLead: cliente.origemLead,
    dataContratacaoInvalida: dataContratacao.invalid,
    dataExitoInvalida: dataExito.invalid,
  };
}

export async function buscarClientePorId(clienteId: number): Promise<CompanyEventSource | null> {
  const cliente = await db.clientes.findUnique({
    where: { id: clienteId },
    select: {
      id: true,
      cnpj: true,
      razaoSocial: true,
      nomeFantasia: true,
      servicos: true,
      formaPagamento: true,
      valorContrato: true,
      closerNome: true,
      analistaResponsavel: true,
      dataContratacao: true,
      dataExito: true,
      embasamento: true,
      origemLead: true,
    },
  });

  return cliente ? mapClienteToCompanyEventSource(cliente) : null;
}

/**
 * Lista clientes atualizados desde `since` (usa `updatedAt`, também String? no schema de
 * origem — comparação textual funciona porque o formato gravado é consistente ISO/lexicográfico
 * quando presente; strings vazias são tratadas como "nunca atualizado" e sempre incluídas).
 */
export async function listarClientesParaSync(since: Date | null): Promise<Array<ClienteAdapterRow & { id: number }>> {
  return db.clientes.findMany({
    where: since
      ? {
          OR: [{ updatedAt: { gt: since.toISOString() } }, { updatedAt: "" }, { updatedAt: null }],
        }
      : undefined,
    select: {
      id: true,
      cnpj: true,
      razaoSocial: true,
      nomeFantasia: true,
      servicos: true,
      formaPagamento: true,
      valorContrato: true,
      closerNome: true,
      analistaResponsavel: true,
      dataContratacao: true,
      dataExito: true,
      embasamento: true,
      origemLead: true,
    },
    take: 500,
  });
}
