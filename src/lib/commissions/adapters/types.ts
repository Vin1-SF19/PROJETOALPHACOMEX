/**
 * Contratos compartilhados entre os adapters de integração do módulo de Comissões.
 * Nenhum adapter escreve nos módulos de origem (clientes, ContratoComercial, usuarios) —
 * são somente leitura, traduzindo dados existentes para o vocabulário de Comissões.
 */

export interface CompanyEventSource {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  servico: string;
  formaPagamento: string | null;
  valorContratoCents: number | null;
  closerNome: string | null;
  analistaResponsavel: string | null;
  /** Parseada de String? — null quando ausente OU quando o formato não pôde ser interpretado com confiança. */
  dataContratacao: Date | null;
  dataExito: Date | null;
  embasamento: string | null;
  origemLead: string | null;
  /** true quando dataContratacao veio de uma string presente mas não interpretável — vira divergência, nunca é tratado como "sem data". */
  dataContratacaoInvalida: boolean;
  dataExitoInvalida: boolean;
}

export interface AdapterFieldConflict {
  field: string;
  valorContratoComercial: unknown;
  valorClientes: unknown;
}

export interface MergedCompanyEvent {
  clienteId: number | null;
  contratoComercialId: string | null;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  servico: string;
  formaPagamento: string | null;
  valorContratoCents: number | null;
  closerNome: string | null;
  analistaResponsavel: string | null;
  dataContratacao: Date | null;
  dataExito: Date | null;
  usuarioIdCloser: number | null;
  pagamentoConfirmado: boolean | null;
  pagamentoConfirmadoEm: Date | null;
  conflicts: AdapterFieldConflict[];
}
