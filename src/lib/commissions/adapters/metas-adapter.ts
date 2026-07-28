import db from "@/lib/prisma";

/**
 * Adapter somente-leitura do Alpha Metas (`ContratoComercial`) — fonte contratual formal
 * de fechamento comercial. Nunca escreve nessa tabela.
 */

export interface ContratoComercialSource {
  id: string;
  cnpj: string;
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
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  valorContrato: number;
  formaPagamento: string;
  servico: string;
  closerNome: string;
  usuarioId: number;
  pagamentoConfirmado: boolean;
  pagamentoConfirmadoEm: Date | null;
  updatedAt: Date;
}

export function mapContratoComercialToSource(row: ContratoComercialRow): ContratoComercialSource {
  return {
    id: row.id,
    cnpj: row.cnpj,
    razaoSocial: row.razaoSocial,
    nomeFantasia: row.nomeFantasia,
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
 */
export async function listarContratosComerciaisParaSync(since: Date | null): Promise<ContratoComercialSource[]> {
  const rows = await db.contratoComercial.findMany({
    where: {
      pagamentoConfirmado: true,
      ...(since ? { updatedAt: { gt: since } } : {}),
    },
    select: {
      id: true,
      cnpj: true,
      razaoSocial: true,
      nomeFantasia: true,
      valorContrato: true,
      formaPagamento: true,
      servico: true,
      closerNome: true,
      usuarioId: true,
      pagamentoConfirmado: true,
      pagamentoConfirmadoEm: true,
      updatedAt: true,
    },
    take: 500,
  });

  return rows.map(mapContratoComercialToSource);
}
