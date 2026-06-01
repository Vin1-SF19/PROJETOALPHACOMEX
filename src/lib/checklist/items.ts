import { TipoEmbasamento } from "@prisma/client";

export interface ChecklistItemTemplate {
  codigo: string;
  secao: string;
  descricao: string;
  complemento?: string;
  obrigatorio: boolean;
}

// ─── SEÇÕES ──────────────────────────────────────────────────────────────────
export const SECOES = {
  CONSTITUICAO: "CONSTITUIÇÃO REGULAR",
  CAP_OPERACIONAL: "CAPACIDADE OPERACIONAL",
  CAP_FINANCEIRA: "CAPACIDADE FINANCEIRA",
  CAPITAL_SOCIAL: "ORIGEM DO CAPITAL SOCIAL",
  VALIDACAO: "VALIDAÇÃO",
} as const;

// ─── ITENS COMUNS ─────────────────────────────────────────────────────────────

const CONSTITUICAO: ChecklistItemTemplate[] = [
  {
    codigo: "CONST_001",
    secao: SECOES.CONSTITUICAO,
    descricao: "Contrato Social com TODAS as alterações",
    complemento: "Com TODAS as alterações que houverem.",
    obrigatorio: true,
  },
  {
    codigo: "CONST_002",
    secao: SECOES.CONSTITUICAO,
    descricao: "Certidão da Junta Comercial",
    complemento: "Atualizada. Com o mesmo endereço da Receita Federal.",
    obrigatorio: true,
  },
  {
    codigo: "CONST_003",
    secao: SECOES.CONSTITUICAO,
    descricao: "Documento de identificação de todos os sócios",
    complemento: "Preferencialmente CNH ou RG. TODOS os sócios.",
    obrigatorio: true,
  },
  {
    codigo: "CONST_004",
    secao: SECOES.CONSTITUICAO,
    descricao: "Procuração",
    complemento: "Assinada com Certificado Digital da empresa.",
    obrigatorio: true,
  },
];

const CAP_OPERACIONAL: ChecklistItemTemplate[] = [
  {
    codigo: "CAP_OP_001",
    secao: SECOES.CAP_OPERACIONAL,
    descricao: "Contas/faturas de energia elétrica (últimos 3 meses)",
    complemento: "Sob titularidade da empresa. *exceto coworking.",
    obrigatorio: true,
  },
  {
    codigo: "CAP_OP_002",
    secao: SECOES.CAP_OPERACIONAL,
    descricao: "Comprovantes de pagamento de energia elétrica",
    obrigatorio: true,
  },
  {
    codigo: "CAP_OP_003",
    secao: SECOES.CAP_OPERACIONAL,
    descricao: "Contas/faturas de internet (últimos 3 meses)",
    obrigatorio: true,
  },
  {
    codigo: "CAP_OP_004",
    secao: SECOES.CAP_OPERACIONAL,
    descricao: "Comprovantes de pagamento de internet",
    obrigatorio: true,
  },
  {
    codigo: "CAP_OP_005",
    secao: SECOES.CAP_OPERACIONAL,
    descricao: "Guia do IPTU do ano corrente",
    complemento: "Presente ano. Para locado: em nome do locador ou empresa.",
    obrigatorio: true,
  },
  {
    codigo: "CAP_OP_006",
    secao: SECOES.CAP_OPERACIONAL,
    descricao: "Contrato de locação do imóvel (se locado)",
    obrigatorio: false,
  },
  {
    codigo: "CAP_OP_007",
    secao: SECOES.CAP_OPERACIONAL,
    descricao: "Contrato de armazenagem e/ou fotos do estoque",
    obrigatorio: false,
  },
];

const VALIDACAO: ChecklistItemTemplate[] = [
  {
    codigo: "VAL_001",
    secao: SECOES.VALIDACAO,
    descricao: "Opção pelo DTE no Portal e-CAC",
    complemento: "Não enviar documento. Apenas confirmar no e-CAC.",
    obrigatorio: true,
  },
  {
    codigo: "VAL_002",
    secao: SECOES.VALIDACAO,
    descricao: "Habilitação Procuração Eletrônica no e-CAC",
    complemento:
      "Habilitar Andrew (109.541.959-57) e Edvan (757.806.409-63). 90 dias, todos os serviços.",
    obrigatorio: true,
  },
  {
    codigo: "VAL_003",
    secao: SECOES.VALIDACAO,
    descricao: "Fatos e Direitos (1500) assinado com cert. digital do procurador",
    obrigatorio: true,
  },
  {
    codigo: "VAL_004",
    secao: SECOES.VALIDACAO,
    descricao: "Formulário (1500) assinado com cert. digital do procurador",
    obrigatorio: true,
  },
];

const CAPITAL_SOCIAL: ChecklistItemTemplate[] = [
  {
    codigo: "CAPITAL_001",
    secao: SECOES.CAPITAL_SOCIAL,
    descricao: "Comprovantes de integralização",
    complemento: "Se ocorrido nos últimos 5 anos.",
    obrigatorio: false,
  },
  {
    codigo: "CAPITAL_002",
    secao: SECOES.CAPITAL_SOCIAL,
    descricao: "Extratos bancários dos meses de integralização",
    obrigatorio: false,
  },
  {
    codigo: "CAPITAL_003",
    secao: SECOES.CAPITAL_SOCIAL,
    descricao: "Balanços patrimoniais dos anos de aporte",
    complemento: "Assinados CPF do sócio e contador.",
    obrigatorio: false,
  },
];

// ─── CAPACIDADES FINANCEIRAS POR TIPO ────────────────────────────────────────

const CAP_FIN_DAS_CPRB: ChecklistItemTemplate[] = [
  {
    codigo: "CAP_FIN_DAS_001",
    secao: SECOES.CAP_FINANCEIRA,
    descricao: "Balancetes dos últimos 3 meses",
    complemento:
      "Assinados sócio administrador e contador. Individualizados mês a mês.",
    obrigatorio: true,
  },
  {
    codigo: "CAP_FIN_DAS_002",
    secao: SECOES.CAP_FINANCEIRA,
    descricao: "Balanço Patrimonial",
    complemento:
      "Assinado sócio administrador e contador. Se presente ano: Balanço Parcial.",
    obrigatorio: true,
  },
  {
    codigo: "CAP_FIN_DAS_003",
    secao: SECOES.CAP_FINANCEIRA,
    descricao: "Extratos bancários dos últimos 3 meses (todas as contas)",
    obrigatorio: true,
  },
];

const CAP_FIN_DISPONIBILIDADE: ChecklistItemTemplate[] = [
  {
    codigo: "CAP_FIN_DISP_001",
    secao: SECOES.CAP_FINANCEIRA,
    descricao: "Extratos bancários últimos 3 meses (todas as contas)",
    complemento:
      "Comprovar origem dos valores. Vincular NFs, Integralização, Empréstimos/Mútuo.",
    obrigatorio: true,
  },
  {
    codigo: "CAP_FIN_DISP_002",
    secao: SECOES.CAP_FINANCEIRA,
    descricao: "Balancetes dos últimos 3 meses",
    complemento: "Assinados sócio e contador.",
    obrigatorio: true,
  },
  {
    codigo: "CAP_FIN_DISP_003",
    secao: SECOES.CAP_FINANCEIRA,
    descricao: "Contrato de mútuo registrado em cartório",
    complemento: "Apenas se houver mútuo.",
    obrigatorio: false,
  },
  {
    codigo: "CAP_FIN_DISP_004",
    secao: SECOES.CAP_FINANCEIRA,
    descricao: "Guia de IOF e comprovante de recolhimento",
    complemento: "Apenas se houver mútuo.",
    obrigatorio: false,
  },
  {
    codigo: "CAP_FIN_DISP_005",
    secao: SECOES.CAP_FINANCEIRA,
    descricao: "Balancetes do mutuante (3 meses anteriores ao aporte)",
    complemento: "Apenas mútuo entre PJs.",
    obrigatorio: false,
  },
  {
    codigo: "CAP_FIN_DISP_006",
    secao: SECOES.CAP_FINANCEIRA,
    descricao: "Documento de identificação do mutuante",
    complemento: "PF: CNH/RG. PJ: Contrato Social.",
    obrigatorio: false,
  },
  {
    codigo: "CAP_FIN_DISP_007",
    secao: SECOES.CAP_FINANCEIRA,
    descricao: "Comprovantes de transferência com identificação dos remetentes",
    complemento: "Comprovar origem dos valores em conta.",
    obrigatorio: true,
  },
];

const CAP_FIN_INICIO_RETOMADA: ChecklistItemTemplate[] = [
  {
    codigo: "CAP_FIN_INIC_001",
    secao: SECOES.CAP_FINANCEIRA,
    descricao: "Balancetes dos últimos 3 meses",
    complemento: "Assinados sócio e contador. Individualizados.",
    obrigatorio: true,
  },
  {
    codigo: "CAP_FIN_INIC_002",
    secao: SECOES.CAP_FINANCEIRA,
    descricao: "Balanço Patrimonial",
    obrigatorio: true,
  },
  {
    codigo: "CAP_FIN_INIC_003",
    secao: SECOES.CAP_FINANCEIRA,
    descricao: "Tabela de cálculo de tributos com comprovantes de recolhimentos",
    obrigatorio: true,
  },
];

// ─── TEMPLATES POR TIPO ───────────────────────────────────────────────────────

export const CHECKLIST_TEMPLATES: Record<TipoEmbasamento, ChecklistItemTemplate[]> = {
  RECEITA_BRUTA_DAS: [
    ...CONSTITUICAO,
    ...CAP_OPERACIONAL,
    ...CAP_FIN_DAS_CPRB,
    ...CAPITAL_SOCIAL,
    ...VALIDACAO,
  ],
  RECEITA_BRUTA_CPRB: [
    ...CONSTITUICAO,
    ...CAP_OPERACIONAL,
    ...CAP_FIN_DAS_CPRB,
    ...CAPITAL_SOCIAL,
    ...VALIDACAO,
  ],
  INICIO_RETOMADA: [
    ...CONSTITUICAO,
    ...CAP_OPERACIONAL,
    ...CAP_FIN_INICIO_RETOMADA,
    ...CAPITAL_SOCIAL,
    ...VALIDACAO,
  ],
  DISPONIBILIDADE_FINANCEIRA: [
    ...CONSTITUICAO,
    ...CAP_OPERACIONAL,
    ...CAP_FIN_DISPONIBILIDADE,
    ...CAPITAL_SOCIAL,
    ...VALIDACAO,
  ],
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

export const TIPO_LABELS: Record<TipoEmbasamento, string> = {
  RECEITA_BRUTA_DAS: "Receita Bruta DAS",
  RECEITA_BRUTA_CPRB: "Receita Bruta CPRB",
  INICIO_RETOMADA: "Início ou Retomada",
  DISPONIBILIDADE_FINANCEIRA: "Disponibilidade Financeira",
};

export const TIPO_CORES: Record<TipoEmbasamento, string> = {
  RECEITA_BRUTA_DAS: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  RECEITA_BRUTA_CPRB: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  INICIO_RETOMADA: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  DISPONIBILIDADE_FINANCEIRA: "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

export const STATUS_LABELS: Record<string, string> = {
  PENDENTE: "Pendente",
  OK: "OK",
  IRREGULAR: "Irregular",
  PARCIALMENTE_IRREGULAR: "Parc. Irregular",
  REVISAR: "Revisar",
  DESNECESSARIO: "Desnecessário",
  EM_ANALISE: "Em Análise",
  AGUARDANDO_DOCUMENTOS: "Aguardando Docs",
  PRIORIDADE: "Prioridade",
  FALAR_DR_EDVAN: "Falar Dr. Edvan",
  FALAR_ANDREW: "Falar Andrew",
};

export const STATUS_CORES: Record<string, string> = {
  PENDENTE: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  OK: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  IRREGULAR: "text-red-400 bg-red-500/10 border-red-500/20",
  PARCIALMENTE_IRREGULAR: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  REVISAR: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  DESNECESSARIO: "text-slate-600 bg-slate-800/50 border-slate-700/30",
  EM_ANALISE: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  AGUARDANDO_DOCUMENTOS: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  PRIORIDADE: "text-red-400 bg-red-500/10 border-red-500/20",
  FALAR_DR_EDVAN: "text-pink-400 bg-pink-500/10 border-pink-500/20",
  FALAR_ANDREW: "text-pink-400 bg-pink-500/10 border-pink-500/20",
};

export const STATUS_CONCLUIDOS = new Set([
  "OK",
  "DESNECESSARIO",
]);

export function calcularProgressoItens(
  itens: { status: string; obrigatorio: boolean }[]
): number {
  const obrigatorios = itens.filter((i) => i.obrigatorio);
  if (obrigatorios.length === 0) return 0;
  const concluidos = obrigatorios.filter((i) => STATUS_CONCLUIDOS.has(i.status));
  return Math.round((concluidos.length / obrigatorios.length) * 100);
}
