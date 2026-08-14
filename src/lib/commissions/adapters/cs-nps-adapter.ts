import db from "@/lib/prisma";
import { parseClienteDateString } from "./date-parsing";
import type { CompanyEventSource } from "./types";

/**
 * Adapter somente-leitura do módulo CS&NPS (`Cliente`+`ClienteServico`, Fase 3.6 do
 * Cliente Master, 2026-08-14 — substitui a antiga tabela `clientes`). Nunca escreve.
 * `valorContrato` é `Float?` no schema de origem — convertido para centavos aqui
 * (Math.round(valor * 100)), já que o módulo de Comissões nunca usa Float internamente.
 */

interface ClienteServicoAdapterRow {
  id: number;
  servico: string;
  formaPagamento: string | null;
  valorContrato: number | null;
  closerNome: string | null;
  analistaResponsavel: string | null;
  dataContratacao: string | null;
  dataExito: string | null;
  embasamento: string | null;
  origemLead: string | null;
  updatedAt: Date;
  cliente: { cnpj: string | null; razaoSocial: string; nomeFantasia: string | null };
}

export function mapClienteServicoToCompanyEventSource(registro: ClienteServicoAdapterRow): CompanyEventSource {
  const dataContratacao = parseClienteDateString(registro.dataContratacao);
  const dataExito = parseClienteDateString(registro.dataExito);

  return {
    cnpj: registro.cliente.cnpj ?? "",
    razaoSocial: registro.cliente.razaoSocial,
    nomeFantasia: registro.cliente.nomeFantasia,
    servico: registro.servico,
    formaPagamento: registro.formaPagamento,
    valorContratoCents: registro.valorContrato !== null ? Math.round(registro.valorContrato * 100) : null,
    closerNome: registro.closerNome,
    analistaResponsavel: registro.analistaResponsavel,
    dataContratacao: dataContratacao.date,
    dataExito: dataExito.date,
    embasamento: registro.embasamento,
    origemLead: registro.origemLead,
    dataContratacaoInvalida: dataContratacao.invalid,
    dataExitoInvalida: dataExito.invalid,
  };
}

const SELECT_CLIENTE_SERVICO_ADAPTER = {
  id: true,
  servico: true,
  formaPagamento: true,
  valorContrato: true,
  closerNome: true,
  analistaResponsavel: true,
  dataContratacao: true,
  dataExito: true,
  embasamento: true,
  origemLead: true,
  updatedAt: true,
  cliente: { select: { cnpj: true, razaoSocial: true, nomeFantasia: true } },
} as const;

export async function buscarClientePorId(clienteServicoId: number): Promise<CompanyEventSource | null> {
  const registro = await db.clienteServico.findUnique({
    where: { id: clienteServicoId },
    select: SELECT_CLIENTE_SERVICO_ADAPTER,
  });

  return registro ? mapClienteServicoToCompanyEventSource(registro) : null;
}

/**
 * Lista serviços contratados (CS&NPS) atualizados desde `since`. `updatedAt` agora é
 * `DateTime` real (era `String?` no schema legado) — comparação direta, sem mais
 * tratamento de string vazia/nula.
 */
export async function listarClientesParaSync(since: Date | null): Promise<ClienteServicoAdapterRow[]> {
  return db.clienteServico.findMany({
    where: since ? { updatedAt: { gt: since } } : undefined,
    select: SELECT_CLIENTE_SERVICO_ADAPTER,
    take: 500,
  });
}
