export const FINANCIAL_PIPELINE_NAME = "Financeiro";
export const FINANCIAL_PIPELINE_SCHEMA_VERSION = "2026.08.22.1";

export const FINANCIAL_STAGES = [
  { key: "solicitacao_contrato", label: "Solicitação de Contrato", order: 1 },
  { key: "elaboracao_contrato", label: "Elaboração do Contrato", order: 2 },
  { key: "formalizacao", label: "Formalização", order: 3 },
  { key: "pagamento", label: "Pagamento", order: 4 },
  { key: "nota_fiscal", label: "Nota Fiscal", order: 5 },
  { key: "concluidos", label: "Concluídos", order: 6 },
] as const;

export type FinancialStageKey = (typeof FINANCIAL_STAGES)[number]["key"];

const FINANCIAL_STAGE_LABELS_BY_KEY: Readonly<Record<FinancialStageKey, readonly string[]>> = {
  solicitacao_contrato: ["Solicitação de Contrato"],
  elaboracao_contrato: ["Contrato", "Elaboração do Contrato"],
  formalizacao: ["Formalização", "Formalização da Contratação"],
  pagamento: ["Pagamento", "Confirmação do Pagamento"],
  nota_fiscal: ["Nota Fiscal", "Emissão da Nota Fiscal"],
  concluidos: ["Concluídos", "Concluídos / Liberado para Operacional"],
};

export function financialStageKeyFromLabel(label: string): FinancialStageKey | null {
  const match = FINANCIAL_STAGES.find((stage) =>
    FINANCIAL_STAGE_LABELS_BY_KEY[stage.key].includes(label),
  );
  return match?.key ?? null;
}

export type FinancialFieldCategory = "OBRIGATORIO" | "OBRIGATORIO_CONDICIONAL" | "AUTOMATICO_CALCULADO";
export type FinancialFieldType = "texto" | "texto_longo" | "numero" | "data" | "selecao" | "booleano";

export interface FinancialFieldDefinition {
  key: string;
  label: string;
  stage: FinancialStageKey;
  type: FinancialFieldType;
  category: FinancialFieldCategory;
  options?: readonly string[];
}

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;

export const FINANCIAL_FIELDS: readonly FinancialFieldDefinition[] = [
  { key: "cnpj", label: "CNPJ", stage: "solicitacao_contrato", type: "texto", category: "OBRIGATORIO" },
  { key: "razao_social", label: "Razão Social", stage: "solicitacao_contrato", type: "texto", category: "OBRIGATORIO" },
  { key: "rua", label: "Rua", stage: "solicitacao_contrato", type: "texto", category: "OBRIGATORIO" },
  { key: "numero", label: "Número", stage: "solicitacao_contrato", type: "texto", category: "OBRIGATORIO" },
  { key: "complemento", label: "Complemento", stage: "solicitacao_contrato", type: "texto", category: "OBRIGATORIO_CONDICIONAL" },
  { key: "bairro", label: "Bairro", stage: "solicitacao_contrato", type: "texto", category: "OBRIGATORIO" },
  { key: "cep", label: "CEP", stage: "solicitacao_contrato", type: "texto", category: "OBRIGATORIO" },
  { key: "municipio", label: "Município", stage: "solicitacao_contrato", type: "texto", category: "OBRIGATORIO" },
  { key: "estado", label: "Estado", stage: "solicitacao_contrato", type: "selecao", options: UFS, category: "OBRIGATORIO" },
  { key: "email", label: "E-mail", stage: "solicitacao_contrato", type: "texto", category: "OBRIGATORIO" },
  { key: "regime_cliente", label: "Regime tributário do cliente", stage: "solicitacao_contrato", type: "selecao", options: ["Simples Nacional", "Lucro Presumido", "Lucro Real", "Imune/Isento"], category: "OBRIGATORIO" },
  { key: "servico", label: "Serviço contratado", stage: "solicitacao_contrato", type: "texto", category: "OBRIGATORIO" },
  { key: "valor_bruto", label: "Valor bruto do contrato", stage: "solicitacao_contrato", type: "numero", category: "OBRIGATORIO" },
  { key: "forma_pagamento", label: "Forma de pagamento", stage: "solicitacao_contrato", type: "selecao", options: ["PIX", "Boleto", "Transferência", "Cartão", "Outro"], category: "OBRIGATORIO" },
  { key: "condicao_negociada", label: "Condição negociada", stage: "solicitacao_contrato", type: "texto_longo", category: "OBRIGATORIO" },
  { key: "vendedor", label: "Vendedor responsável", stage: "solicitacao_contrato", type: "texto", category: "OBRIGATORIO" },
  { key: "origem", label: "Origem do cliente", stage: "solicitacao_contrato", type: "selecao", options: ["Prospecção", "Indicação", "Parceiro", "Orgânico", "Outro"], category: "OBRIGATORIO" },
  { key: "parceiro", label: "Parceiro responsável", stage: "solicitacao_contrato", type: "texto", category: "OBRIGATORIO_CONDICIONAL" },
  { key: "contato", label: "Contato/Nome do responsável", stage: "solicitacao_contrato", type: "texto", category: "OBRIGATORIO" },
  { key: "observacoes", label: "Observações comerciais", stage: "solicitacao_contrato", type: "texto_longo", category: "OBRIGATORIO_CONDICIONAL" },
  { key: "contrato_elaborado", label: "Contrato elaborado", stage: "elaboracao_contrato", type: "booleano", category: "OBRIGATORIO" },
  { key: "data_elaboracao", label: "Data de elaboração", stage: "elaboracao_contrato", type: "data", category: "OBRIGATORIO_CONDICIONAL" },
  { key: "contrato_enviado", label: "Contrato enviado para assinatura", stage: "elaboracao_contrato", type: "booleano", category: "OBRIGATORIO" },
  { key: "data_envio", label: "Data do envio", stage: "elaboracao_contrato", type: "data", category: "AUTOMATICO_CALCULADO" },
  { key: "link_contrato", label: "Link/arquivo do contrato", stage: "elaboracao_contrato", type: "texto", category: "OBRIGATORIO_CONDICIONAL" },
  { key: "status_assinatura", label: "Status do contrato/assinatura", stage: "formalizacao", type: "selecao", options: ["Aguardando assinatura", "Assinado"], category: "OBRIGATORIO" },
  { key: "data_assinatura", label: "Data da assinatura", stage: "formalizacao", type: "data", category: "AUTOMATICO_CALCULADO" },
  { key: "contrato_assinado", label: "Contrato assinado/anexo", stage: "formalizacao", type: "texto", category: "OBRIGATORIO_CONDICIONAL" },
  { key: "regime_prestador", label: "Regime tributário do prestador", stage: "formalizacao", type: "selecao", options: ["Simples Nacional", "Lucro Presumido", "Lucro Real", "Imune/Isento"], category: "OBRIGATORIO" },
  { key: "irrf_aplicavel", label: "IRRF aplicável", stage: "formalizacao", type: "booleano", category: "OBRIGATORIO" },
  { key: "aliquota_irrf", label: "Alíquota IRRF", stage: "formalizacao", type: "numero", category: "OBRIGATORIO_CONDICIONAL" },
  { key: "valor_irrf", label: "Valor IRRF", stage: "formalizacao", type: "numero", category: "AUTOMATICO_CALCULADO" },
  { key: "csrf_aplicavel", label: "CSRF aplicável", stage: "formalizacao", type: "booleano", category: "OBRIGATORIO" },
  { key: "aliquota_csrf", label: "Alíquota CSRF", stage: "formalizacao", type: "numero", category: "OBRIGATORIO_CONDICIONAL" },
  { key: "valor_csrf", label: "Valor CSRF", stage: "formalizacao", type: "numero", category: "AUTOMATICO_CALCULADO" },
  { key: "total_retencoes", label: "Total de retenções", stage: "formalizacao", type: "numero", category: "AUTOMATICO_CALCULADO" },
  { key: "valor_liquido", label: "Valor líquido para pagamento", stage: "formalizacao", type: "numero", category: "AUTOMATICO_CALCULADO" },
  { key: "vencimento", label: "Vencimento", stage: "formalizacao", type: "data", category: "OBRIGATORIO" },
  { key: "dados_pagamento", label: "Link/dados para pagamento", stage: "formalizacao", type: "texto", category: "OBRIGATORIO" },
  { key: "memoria_calculo", label: "Memória de cálculo", stage: "formalizacao", type: "texto_longo", category: "AUTOMATICO_CALCULADO" },
  { key: "pagamento_confirmado", label: "Pagamento confirmado", stage: "pagamento", type: "booleano", category: "OBRIGATORIO" },
  { key: "valor_esperado", label: "Valor esperado", stage: "pagamento", type: "numero", category: "AUTOMATICO_CALCULADO" },
  { key: "data_pagamento", label: "Data do pagamento", stage: "pagamento", type: "data", category: "AUTOMATICO_CALCULADO" },
  { key: "valor_recebido", label: "Valor recebido", stage: "pagamento", type: "numero", category: "OBRIGATORIO_CONDICIONAL" },
  { key: "forma_pagamento_utilizada", label: "Forma de pagamento utilizada", stage: "pagamento", type: "selecao", options: ["PIX", "Boleto", "Transferência", "Cartão", "Outro"], category: "OBRIGATORIO_CONDICIONAL" },
  { key: "comprovante_pagamento", label: "Comprovante de pagamento", stage: "pagamento", type: "texto", category: "OBRIGATORIO_CONDICIONAL" },
  { key: "nf_emitida", label: "NF emitida", stage: "nota_fiscal", type: "booleano", category: "OBRIGATORIO" },
  { key: "numero_nf", label: "Número da NF", stage: "nota_fiscal", type: "texto", category: "OBRIGATORIO_CONDICIONAL" },
  { key: "data_emissao_nf", label: "Data de emissão", stage: "nota_fiscal", type: "data", category: "OBRIGATORIO_CONDICIONAL" },
  { key: "valor_nf", label: "Valor da NF", stage: "nota_fiscal", type: "numero", category: "OBRIGATORIO_CONDICIONAL" },
  { key: "arquivo_nf", label: "Arquivo/link da NF", stage: "nota_fiscal", type: "texto", category: "OBRIGATORIO_CONDICIONAL" },
] as const;

export const LEGACY_FINANCIAL_STAGE_LABELS = ["Ativo", "Em Cobrança", "Encerrado"] as const;
interface FinancialPipelineStage { nome: string; ordem: number }
interface FinancialPipelineField { nome: string }
function labelsOrdenados(etapas: readonly FinancialPipelineStage[]) { return etapas.slice().sort((a, b) => a.ordem - b.ordem).map((etapa) => etapa.nome) }
export function hasLegacyFinancialStages(etapas: readonly FinancialPipelineStage[]) { const labels = labelsOrdenados(etapas); return labels.length === LEGACY_FINANCIAL_STAGE_LABELS.length && labels.every((label, index) => label === LEGACY_FINANCIAL_STAGE_LABELS[index]) }
export function hasConfiguredFinancialStages(etapas: readonly FinancialPipelineStage[]) { const labels = labelsOrdenados(etapas); return labels.length === FINANCIAL_STAGES.length && labels.every((label, index) => label === FINANCIAL_STAGES[index]?.label) }
export function hasConfiguredFinancialPipeline(etapas: readonly FinancialPipelineStage[], campos: readonly FinancialPipelineField[]) { const nomes = new Set(campos.map((campo) => campo.nome)); return hasConfiguredFinancialStages(etapas) && FINANCIAL_FIELDS.every((campo) => nomes.has(campo.label)) }
export function campoFinanceiroSomenteLeitura(nome: string) { return FINANCIAL_FIELDS.some((campo) => campo.label === nome && campo.category === "AUTOMATICO_CALCULADO") }
export function etapaFinanceiraValida(nome: string) { return FINANCIAL_STAGES.some((etapa) => etapa.label === nome) }

export interface FinancialTaxCalculation { valorIrrf: number; valorCsrf: number; totalRetencoes: number; valorLiquido: number; memoriaCalculo: string }
function arredondarMoeda(valor: number) { return Math.round((valor + Number.EPSILON) * 100) / 100 }
export function calcularRetencoesFinanceiras(valorBruto: number, aliquotaIrrf: number, aliquotaCsrf: number): FinancialTaxCalculation {
  const valorIrrf = arredondarMoeda(valorBruto * aliquotaIrrf / 100); const valorCsrf = arredondarMoeda(valorBruto * aliquotaCsrf / 100); const totalRetencoes = arredondarMoeda(valorIrrf + valorCsrf); const valorLiquido = arredondarMoeda(valorBruto - totalRetencoes);
  return { valorIrrf, valorCsrf, totalRetencoes, valorLiquido, memoriaCalculo: JSON.stringify({ schemaVersion: FINANCIAL_PIPELINE_SCHEMA_VERSION, formula: "liquido = bruto - ((bruto × irrf%) + (bruto × csrf%))", entradas: { valorBruto, aliquotaIrrf, aliquotaCsrf }, resultados: { valorIrrf, valorCsrf, totalRetencoes, valorLiquido } }) };
}
function normalizar(valor: string | null | undefined) { return valor?.trim() ?? "" }
function numero(valor: string | null | undefined) { const text = normalizar(valor); const parsed = Number(text.replace(/\./g, "").replace(",", ".")); return Number.isFinite(parsed) ? parsed : 0 }
function sim(valor: string | null | undefined) { const text = normalizar(valor).toLowerCase(); return text === "sim" || text === "true" || text === "1" || text === "yes" }
function cnpjValido(cnpj: string) { const digits = cnpj.replace(/\D/g, ""); if (digits.length !== 14) return false; if (digits === digits[0].repeat(14)) return false; let sum = 0; for (let i = 0; i < 12; i++) sum += Number(digits[i]) * (12 - i); if ((sum % 11) >= 2) return false; sum = 0; for (let i = 0; i < 13; i++) sum += Number(digits[i]) * (13 - i); return (sum % 11) < 2 }

export interface FinancialTransitionInput { pipelineName: string; fromStage: string; toStage: string; values: Record<string, string | null>; now?: Date; attachmentNames?: string[] }
export interface FinancialTransitionResult { applicable: boolean; blocked: boolean; message?: string; pendingFields: string[]; automaticValues: Record<string, string> }

export function validateFinancialTransition(input: FinancialTransitionInput): FinancialTransitionResult {
  if (input.pipelineName !== FINANCIAL_PIPELINE_NAME) return { applicable: false, blocked: false, pendingFields: [], automaticValues: {} };
  const index = FINANCIAL_STAGES.findIndex((stage) => stage.label === input.fromStage); const expected = FINANCIAL_STAGES[index + 1]?.label;
  if (index < 0 || expected !== input.toStage) return { applicable: true, blocked: true, message: "Não é permitido pular etapas no pipeline Financeiro.", pendingFields: [], automaticValues: {} };
  const v = input.values; const missing: string[] = []; const automaticValues: Record<string, string> = {}; const today = (input.now ?? new Date()).toISOString().slice(0, 10);
  const require = (...labels: string[]) => labels.forEach((label) => { if (!normalizar(v[label])) missing.push(label) }); const requirePositive = (label: string) => { if (!(numero(v[label]) > 0)) missing.push(label) };
  if (index === 0) {
    require("CNPJ", "Razão Social", "Rua", "Número", "Bairro", "CEP", "Município", "Estado", "E-mail", "Regime tributário do cliente", "Serviço contratado", "Forma de pagamento", "Condição negociada", "Vendedor responsável", "Origem do cliente", "Contato/Nome do responsável"); requirePositive("Valor bruto do contrato");
    if (normalizar(v["Origem do cliente"]).toLowerCase() === "parceiro") require("Parceiro responsável"); if (normalizar(v.CNPJ) && !cnpjValido(normalizar(v.CNPJ))) missing.push("CNPJ (formato inválido)"); if (normalizar(v.CEP).replace(/\D/g, "").length !== 8) missing.push("CEP (formato inválido)"); if (normalizar(v["E-mail"]) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizar(v["E-mail"]))) missing.push("E-mail (formato inválido)");
  } else if (index === 1) {
    if (!sim(v["Contrato elaborado"])) missing.push("Contrato elaborado = Sim"); if (!sim(v["Contrato enviado para assinatura"])) missing.push("Contrato enviado para assinatura = Sim"); require("Data de elaboração", "Link/arquivo do contrato"); automaticValues["Data do envio"] = normalizar(v["Data do envio"]) || today;
  } else if (index === 2) {
    if (normalizar(v["Status do contrato/assinatura"]).toLowerCase() !== "assinado") missing.push("Status do contrato/assinatura = Assinado"); if (!normalizar(v["Contrato assinado/anexo"]) && !input.attachmentNames?.some((name) => /contrato/i.test(name))) missing.push("Contrato assinado/anexo"); require("Regime tributário do prestador", "Regime tributário do cliente", "Forma de pagamento", "Vencimento", "Link/dados para pagamento", "IRRF aplicável", "CSRF aplicável"); requirePositive("Valor bruto do contrato");
    if (sim(v["IRRF aplicável"]) && !(numero(v["Alíquota IRRF"]) >= 0 && numero(v["Alíquota IRRF"]) <= 100)) missing.push("Alíquota IRRF"); if (sim(v["CSRF aplicável"]) && !(numero(v["Alíquota CSRF"]) >= 0 && numero(v["Alíquota CSRF"]) <= 100)) missing.push("Alíquota CSRF");
    const calc = calcularRetencoesFinanceiras(numero(v["Valor bruto do contrato"]), sim(v["IRRF aplicável"]) ? numero(v["Alíquota IRRF"]) : 0, sim(v["CSRF aplicável"]) ? numero(v["Alíquota CSRF"]) : 0); if (!(calc.valorLiquido > 0)) missing.push("Valor líquido para pagamento"); Object.assign(automaticValues, { "Data da assinatura": normalizar(v["Data da assinatura"]) || today, "Valor IRRF": String(calc.valorIrrf), "Valor CSRF": String(calc.valorCsrf), "Total de retenções": String(calc.totalRetencoes), "Valor líquido para pagamento": String(calc.valorLiquido), "Valor esperado": String(calc.valorLiquido), "Memória de cálculo": calc.memoriaCalculo });
  } else if (index === 3) {
    if (!sim(v["Pagamento confirmado"])) missing.push("Pagamento confirmado = Sim"); requirePositive("Valor esperado"); requirePositive("Valor recebido"); require("Forma de pagamento utilizada"); automaticValues["Data do pagamento"] = normalizar(v["Data do pagamento"]) || today;
  } else if (index === 4) {
    if (!sim(v["NF emitida"])) missing.push("NF emitida = Sim"); require("Número da NF", "Data de emissão"); requirePositive("Valor da NF"); if (!normalizar(v["Arquivo/link da NF"]) && !input.attachmentNames?.some((name) => /nota|nf/i.test(name))) missing.push("Arquivo/link da NF"); if (normalizar(v["Status do contrato/assinatura"]).toLowerCase() !== "assinado") missing.push("Contrato assinado"); if (!sim(v["Pagamento confirmado"])) missing.push("Pagamento confirmado");
  }
  const pendingFields = [...new Set(missing)]; return { applicable: true, blocked: pendingFields.length > 0, message: pendingFields.length > 0 ? "Dados pendentes para avançar de etapa." : undefined, pendingFields, automaticValues };
}
