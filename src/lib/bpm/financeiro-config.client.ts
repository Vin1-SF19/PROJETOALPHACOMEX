export const PIPELINE_CHAVE = "financeiro";
export const PIPELINE_NOME = "Financeiro";

export const ETAPAS = {
  SOLICITACAO_CONTRATO: "solicitacao_contrato",
  ELABORACAO_CONTRATO: "elaboracao_contrato",
  FORMALIZACAO_CONTRATACAO: "formalizacao_contratacao",
  CONFIRMACAO_PAGAMENTO: "confirmacao_pagamento",
  EMISSAO_NOTA_FISCAL: "emissao_nota_fiscal",
  CONTRATACAO_FINALIZADA: "contratacao_finalizada",
  BOAS_VINDAS: "boas_vindas",
} as const;

export type ChaveEtapaFinanceiro = (typeof ETAPAS)[keyof typeof ETAPAS];

export const CHAVES_CAMPOS = {
  STATUS_ASSINATURA: "alpha.financeiro.status.contrato.assinatura",
  STATUS_CONTRATO: "alpha.status.do.contrato",
  DATA_ASSINATURA: "alpha.data.da.assinatura",
  ANEXO_ASSINADO: "alpha.contrato.assinado.anexo",
  PAGAMENTO_CONFIRMADO: "alpha.pagamento.confirmado",
  PRAZO_ASSINATURA: "alpha.financeiro.prazo.assinatura",
  CNPJ: "alpha.cnpj",
  RAZAO_SOCIAL: "alpha.razao.social",
  CONTATO_RESPONSAVEL: "alpha.contato.responsavel.representante",
  EMAIL: "alpha.e.mail",
  SERVICO_CONTRATADO: "alpha.servico.contratado",
  VALOR_ACORDADO: "alpha.financeiro.valor.bruto.contrato",
  VALOR_CONTRATADO: "alpha.financeiro.valor.bruto.contrato",
  VALOR_LIQUIDO: "alpha.financeiro.valor.liquido.pagamento",
  FORMA_PAGAMENTO: "alpha.forma.de.pagamento",
  DATA_PAGAMENTO: "alpha.data.do.pagamento",
  NF_EMITIDA: "alpha.nf.emitida",
  DATA_EMISSAO_NF: "alpha.data.de.emissao",
  NUMERO_NF: "alpha.numero.da.nf",
  VALOR_NF: "alpha.valor.da.nf",
  LINK_NF: "alpha.arquivo.link.da.nf",
  VENDEDOR: "alpha.vendedor.a",
  VENDEDOR_RESPONSAVEL: "alpha.vendedor.a",
  PARCEIRO: "alpha.parceiro.responsavel",
  PARCEIRO_RESPONSAVEL: "alpha.parceiro.responsavel",
  ORIGEM: "alpha.canal.origem.do.cliente",
  ORIGEM_CLIENTE: "alpha.canal.origem.do.cliente",
  OBSERVACOES: "alpha.observacoes.comerciais",
  OBSERVACOES_COMERCIAIS: "alpha.observacoes.comerciais",
  CONTRATO_ELABORADO: "alpha.contrato.elaborado",
  DATA_ELABORACAO: "alpha.data.de.elaboracao",
  CONTRATO_ENVIADO: "alpha.contrato.enviado.para.assinatura",
  DATA_ENVIO: "alpha.data.do.envio",
  LINK_CONTRATO: "alpha.link.arquivo.do.contrato",
  VALOR_ESPERADO: "alpha.valor.esperado",
  VALOR_RECEBIDO: "alpha.valor.recebido",
  COMPROVANTE: "alpha.comprovante",
  COMPROVANTE_PAGAMENTO: "alpha.comprovante.pagamento",
  STATUS_FINANCEIRO: "alpha.status.financeiro",
  PAGAMENTO_NO_EXITO: "alpha.pagamento.no.exito",
  TOTAL_RETENCOES: "alpha.total.retencoes",
  VENCIMENTO: "alpha.vencimento",
  FORMA_PAGAMENTO_UTILIZADA: "alpha.financeiro.forma.pagamento.utilizada",
  STATUS_CONTRATACAO: "alpha.financeiro.status.contratacao",
} as const;

export type ChaveCampoFinanceiro = (typeof CHAVES_CAMPOS)[keyof typeof CHAVES_CAMPOS];

export const VALORES = {
  ASSINADO: "Assinado",
  SIM: "Sim",
  NAO: "Não",
  PENDENTE: "Pendente",
  CONCLUIDO: "Concluído",
} as const;

export type ValorFinanceiro = (typeof VALORES)[keyof typeof VALORES];

export const CHAVE_AUTOMACAO_HANDOFF = "financeiro.handoff.contrato.concluido.operacional";

export const ACAO_HISTORICO_CONTRATO = "CONTRATO_CONCLUIDO";
export const ACAO_HISTORICO_EXCECAO = "EXCECAO_LIBERACAO_OPERACIONAL";

export const TIPO_TAREFA_ASSINATURA = "ASSINATURA_CONTRATO";
export const TIPO_EVENTO_LEMBRETE = "LEMBRETE_ASSINATURA";
export const TIPO_EVENTO_TAREFA = "TAREFA_CRIADA";

export const REQUISITOS_CONTRATO = [
  { chave: CHAVES_CAMPOS.STATUS_ASSINATURA, valorEsperado: VALORES.ASSINADO, rotulo: "Status da assinatura" },
  { chave: CHAVES_CAMPOS.DATA_ASSINATURA, valorEsperado: null, rotulo: "Data da assinatura" },
  { chave: CHAVES_CAMPOS.ANEXO_ASSINADO, valorEsperado: null, rotulo: "Contrato assinado/anexo" },
] as const;

export const REQUISITOS_PAGAMENTO = [
  { chave: CHAVES_CAMPOS.PAGAMENTO_CONFIRMADO, valorEsperado: VALORES.SIM, rotulo: "Pagamento confirmado" },
] as const;

export function resolverChavesCampos(): ReadonlyArray<string> {
  return Object.values(CHAVES_CAMPOS);
}

export function resolverValorAssinatura(): string {
  return VALORES.ASSINADO;
}

export function resolverValorSim(): string {
  return VALORES.SIM;
}

export function resolverValorPendente(): string {
  return VALORES.PENDENTE;
}

export function resolverValorConcluido(): string {
  return VALORES.CONCLUIDO;
}

export function resolverChavePipeline(): string {
  return PIPELINE_CHAVE;
}

export function resolverNomePipeline(): string {
  return PIPELINE_NOME;
}

export function resolverEtapas(): ReadonlyArray<string> {
  return Object.values(ETAPAS);
}

export function resolverChaveHandoff(): string {
  return CHAVE_AUTOMACAO_HANDOFF;
}

export interface EntradaRequisitosFinanceiro {
  statusAssinatura: string | null | undefined;
  dataAssinatura: string | null | undefined;
  anexoAssinadoId: string | null | undefined;
  anexoAssinadoVinculado: boolean;
  pagamentoConfirmado: string | null | undefined;
}

export interface ResultadoRequisitosFinanceiro {
  contrato: string;
  pagamento: string;
  contratacaoConcluida: boolean;
  pendencias: string[];
}

export function avaliarRequisitosFinanceiro(entrada: EntradaRequisitosFinanceiro): ResultadoRequisitosFinanceiro {
  const assinaturaConfirmada = entrada.statusAssinatura === VALORES.ASSINADO;
  const dataConfirmada = dataCivilValida(entrada.dataAssinatura);
  const documentoConfirmado = Boolean(entrada.anexoAssinadoId?.trim() && entrada.anexoAssinadoVinculado);
  const contrato = assinaturaConfirmada && dataConfirmada && documentoConfirmado ? VALORES.CONCLUIDO : VALORES.PENDENTE;
  const pagamento = entrada.pagamentoConfirmado === VALORES.SIM ? VALORES.CONCLUIDO : VALORES.PENDENTE;
  const pendencias: string[] = [];
  if (!assinaturaConfirmada) pendencias.push(REQUISITOS_CONTRATO[0].rotulo);
  if (!dataConfirmada) pendencias.push(REQUISITOS_CONTRATO[1].rotulo);
  if (!documentoConfirmado) pendencias.push(REQUISITOS_CONTRATO[2].rotulo);
  if (pagamento === VALORES.PENDENTE) pendencias.push(REQUISITOS_PAGAMENTO[0].rotulo);
  return {
    contrato,
    pagamento,
    contratacaoConcluida: contrato === VALORES.CONCLUIDO && pagamento === VALORES.CONCLUIDO,
    pendencias,
  };
}

function dataCivilValida(valor: string | null | undefined): boolean {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}
