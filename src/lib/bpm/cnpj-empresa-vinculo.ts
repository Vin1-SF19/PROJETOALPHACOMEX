import { z } from "zod";
import { cnpjEhValido } from "@/lib/format-cnpj";

export const propostaVinculoEmpresaSchema = z.object({
  versao: z.literal(1), modo: z.enum(["EDITOR", "NOLOSS"]),
  cardId: z.string().min(1).max(150), empresaOrigemId: z.number().int().positive(),
  empresaDestinoId: z.number().int().positive(),
  cnpj: z.string().regex(/^\d{14}$/).refine(cnpjEhValido),
  empresaOrigemNome: z.string().max(500), empresaDestinoNome: z.string().max(500),
  versaoCardEsperada: z.number().int().nonnegative(),
  atualizadoCardEsperado: z.iso.datetime({ offset: true }),
  atualizadoOrigemEsperado: z.iso.datetime({ offset: true }),
  atualizadoDestinoEsperado: z.iso.datetime({ offset: true }),
  snapshot: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export type PropostaVinculoEmpresa = z.infer<typeof propostaVinculoEmpresaSchema>;
export const confirmarVinculoEmpresaSchema = z.object({ proposta: propostaVinculoEmpresaSchema, confirmar: z.literal(true) }).strict();
export const ACAO_VINCULO_EMPRESA = "EMPRESA_VINCULO_ALTERADO";
export const CODIGO_CNPJ_EXISTENTE = "CNPJ_EMPRESA_EXISTENTE";
export const MENSAGEM_CNPJ_EXISTENTE = "Este CNPJ já pertence a uma empresa cadastrada. Você pode confirmar o vínculo deste card à empresa existente.";
