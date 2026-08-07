import { z } from "zod";

export const CANAL_INDICACAO_PARCEIRO = "Indicação Parceiro";
export const CANAL_INDICACAO_CLIENTE = "Indicação Cliente";
export const LABEL_INDICACAO_PARCEIRO = "Indicação de parceiros";
export const LABEL_INDICACAO_CLIENTE = "Indicação de Clientes";
const LIMITE_NOME = 120;
const LIMITE_EMPRESA = 160;
const LIMITE_TELEFONE = 40;
const LIMITE_ENVELOPE = 1_000;

export const ParceiroNaoCadastradoInputSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do parceiro").max(LIMITE_NOME),
  empresa: z.string().trim().max(LIMITE_EMPRESA).optional(),
  telefone: z.string().trim().max(LIMITE_TELEFONE).optional(),
}).strict();

const ParceiroNaoCadastradoPersistidoSchema = ParceiroNaoCadastradoInputSchema.extend({
  tipo: z.literal("PARCEIRO_NAO_CADASTRADO"),
  versao: z.literal(1),
}).strict();

export type ParceiroNaoCadastradoInput = z.input<typeof ParceiroNaoCadastradoInputSchema>;
export type ParceiroNaoCadastrado = z.output<typeof ParceiroNaoCadastradoInputSchema>;

export interface ParceiroPendenteCadastro extends ParceiroNaoCadastrado {
  contratoId: string;
  clienteRazaoSocial: string;
  clienteNomeFantasia: string | null;
  cnpj: string;
  criadoEm: Date;
}

function removerOpcionaisVazios(input: ParceiroNaoCadastradoInput) {
  return {
    nome: input.nome,
    ...(input.empresa?.trim() ? { empresa: input.empresa } : {}),
    ...(input.telefone?.trim() ? { telefone: input.telefone } : {}),
  };
}

/** Cria o envelope versionado persistido temporariamente junto ao contrato comercial. */
export function serializarParceiroNaoCadastrado(input: ParceiroNaoCadastradoInput): string {
  const dados = ParceiroNaoCadastradoInputSchema.parse(removerOpcionaisVazios(input));
  return JSON.stringify({
    tipo: "PARCEIRO_NAO_CADASTRADO",
    versao: 1,
    ...dados,
  });
}

/** Interpreta apenas envelopes conhecidos; texto livre legado e payloads futuros são ignorados. */
export function parseParceiroNaoCadastrado(valor: string | null | undefined): ParceiroNaoCadastrado | null {
  if (!valor || valor.length > LIMITE_ENVELOPE) return null;

  try {
    const parsed = ParceiroNaoCadastradoPersistidoSchema.safeParse(JSON.parse(valor));
    if (!parsed.success) return null;

    const { nome, empresa, telefone } = parsed.data;
    return { nome, ...(empresa ? { empresa } : {}), ...(telefone ? { telefone } : {}) };
  } catch {
    return null;
  }
}
