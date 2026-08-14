import db from "@/lib/prisma";

/**
 * Adapter somente-leitura do Alpha Metas (`ContratoComercial`) — fonte contratual formal
 * de fechamento comercial. Nunca escreve nessa tabela.
 */

export interface ContratoComercialSource {
  id: string;
  clienteId: number;
  cnpj: string | null;
  razaoSocial: string;
  nomeFantasia: string | null;
  valorContratoCents: number;
  formaPagamento: string;
  servico: string;
  closerNome: string;
  usuarioId: number;
  pagamentoConfirmado: boolean;
  pagamentoConfirmadoEm: Date | null;
  updatedAt: Date;
}

interface ContratoComercialRow {
  id: string;
  clienteId: number;
  valorContrato: number;
  formaPagamento: string;
  servico: string;
  closerNome: string;
  usuarioId: number;
  pagamentoConfirmado: boolean;
  pagamentoConfirmadoEm: Date | null;
  updatedAt: Date;
  cliente: { cnpj: string | null; razaoSocial: string; nomeFantasia: string | null };
}

export function mapContratoComercialToSource(row: ContratoComercialRow): ContratoComercialSource {
  return {
    id: row.id,
    clienteId: row.clienteId,
    cnpj: row.cliente.cnpj,
    razaoSocial: row.cliente.razaoSocial,
    nomeFantasia: row.cliente.nomeFantasia,
    valorContratoCents: Math.round(row.valorContrato * 100),
    formaPagamento: row.formaPagamento,
    servico: row.servico,
    closerNome: row.closerNome,
    usuarioId: row.usuarioId,
    pagamentoConfirmado: row.pagamentoConfirmado,
    pagamentoConfirmadoEm: row.pagamentoConfirmadoEm,
    updatedAt: row.updatedAt,
  };
}

/**
 * Lista contratos comerciais com pagamento confirmado (evento de CONTRATAÇÃO só nasce
 * quando o pagamento é de fato confirmado — mesmo critério já usado por
 * `criarRegistroClienteAPartirDeContrato`, ver `architecture.md`), atualizados desde `since`.
 * Fase 3.6 do Cliente Master (2026-08-14): cnpj/razaoSocial/nomeFantasia vêm de `Cliente`
 * via include, não são mais campos próprios de ContratoComercial.
 */
export async function listarContratosComerciaisParaSync(since: Date | null): Promise<ContratoComercialSource[]> {
  const rows = await db.contratoComercial.findMany({
    where: {
      pagamentoConfirmado: true,
      ...(since ? { updatedAt: { gt: since } } : {}),
    },
    select: {
      id: true,
      clienteId: true,
      valorContrato: true,
      formaPagamento: true,
      servico: true,
      closerNome: true,
      usuarioId: true,
      pagamentoConfirmado: true,
      pagamentoConfirmadoEm: true,
      updatedAt: true,
      cliente: { select: { cnpj: true, razaoSocial: true, nomeFantasia: true } },
    },
    take: 500,
  });

  return rows.map(mapContratoComercialToSource);
}
