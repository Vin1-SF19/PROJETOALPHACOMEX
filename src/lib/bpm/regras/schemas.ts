import { z } from "zod";
import { CAMPOS_FIXOS_POR_FONTE, LIMITES_REGRAS, OPERADORES_REGRAS, TIPOS_VALOR, type GrupoCondicao, type ValorRegra } from "./types";

export const campoReferenciaSchema = z.discriminatedUnion("fonte", [
  z.object({ fonte: z.literal("card"), campo: z.enum(CAMPOS_FIXOS_POR_FONTE.card) }),
  z.object({ fonte: z.literal("cliente"), campo: z.enum(CAMPOS_FIXOS_POR_FONTE.cliente) }),
  z.object({ fonte: z.literal("processo"), campo: z.enum(CAMPOS_FIXOS_POR_FONTE.processo) }),
  z.object({ fonte: z.literal("contratacao"), campo: z.enum(CAMPOS_FIXOS_POR_FONTE.contratacao) }),
  z.object({ fonte: z.literal("relacionada"), campo: z.enum(CAMPOS_FIXOS_POR_FONTE.relacionada) }),
  z.object({ fonte: z.literal("checklist"), campo: z.enum(CAMPOS_FIXOS_POR_FONTE.checklist) }),
  z.object({ fonte: z.literal("campo_dinamico"), campo: z.string().cuid() }),
]);
export const operadorSchema = z.enum(OPERADORES_REGRAS);
export const tipoValorSchema = z.enum(TIPOS_VALOR);
export const valorRegraSchema: z.ZodType<ValorRegra> = z.lazy(() => z.union([
  z.string().max(4_000), z.number().finite(), z.boolean(), z.null(), z.array(valorRegraSchema).max(LIMITES_REGRAS.listaMaxima),
]));
export const condicaoFolhaSchema = z.object({
  tipo: z.literal("condicao"), campo: campoReferenciaSchema, operador: operadorSchema,
  valor: z.unknown().optional(), tipoEsperado: tipoValorSchema.optional(),
}).superRefine((condicao, contexto) => {
  const semOperando = condicao.operador === "preenchido" || condicao.operador === "vazio";
  if (!semOperando && condicao.valor === undefined) contexto.addIssue({ code: "custom", path: ["valor"], message: "Operador exige valor de comparação" });
  if ((condicao.operador === "estaEm" || condicao.operador === "naoEstaEm") && !Array.isArray(condicao.valor)) contexto.addIssue({ code: "custom", path: ["valor"], message: "Operador exige uma lista" });
  if (Array.isArray(condicao.valor) && condicao.valor.length > LIMITES_REGRAS.listaMaxima) contexto.addIssue({ code: "custom", path: ["valor"], message: `Lista excede ${LIMITES_REGRAS.listaMaxima} itens` });
});
function criarGrupoSchema(nivel: number): z.ZodType<GrupoCondicao> {
  const itens = nivel >= LIMITES_REGRAS.profundidadeMaxima ? condicaoFolhaSchema : z.union([condicaoFolhaSchema, z.lazy(() => criarGrupoSchema(nivel + 1))]);
  return z.object({ operador: z.enum(["AND", "OR"]), condicoes: z.array(itens).min(1).max(LIMITES_REGRAS.condicoesMaximas) }) as z.ZodType<GrupoCondicao>;
}
export const grupoCondicaoSchema = criarGrupoSchema(1);
export const tabelaDecisaoSchema = z.object({
  linhas: z.array(z.object({ condicao: grupoCondicaoSchema, resultado: valorRegraSchema })).min(1).max(LIMITES_REGRAS.tabelaDecisaoLinhasMaximas),
  padrao: valorRegraSchema.optional(),
});
export const resultadoRegraSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("campo_obrigatorio"), campos: z.array(campoReferenciaSchema).min(1).max(50), mensagem: z.string().trim().min(1).max(1_000).optional() }),
  z.object({ tipo: z.literal("bloqueio_movimentacao"), mensagem: z.string().trim().min(1).max(1_000) }),
  z.object({ tipo: z.literal("mensagem_validacao"), mensagem: z.string().trim().min(1).max(1_000) }),
  z.object({ tipo: z.literal("calculo"), operacao: z.enum(["soma", "subtracao", "multiplicacao", "divisao"]), operandos: z.array(campoReferenciaSchema).min(2).max(20), campoDestino: campoReferenciaSchema }),
  z.object({ tipo: z.literal("formula_segura"), expressao: z.string().trim().min(1).max(LIMITES_REGRAS.formulaCaracteresMaximos), campoDestino: campoReferenciaSchema }),
  z.object({ tipo: z.literal("tabela_decisao"), tabela: tabelaDecisaoSchema, campoDestino: campoReferenciaSchema }),
  z.object({ tipo: z.literal("resultado_condicional"), valor: valorRegraSchema, campoDestino: campoReferenciaSchema.optional() }),
]);
export const regraBpmSchema = z.object({
  id: z.string().trim().min(1).max(100), versao: z.number().int().min(1).max(10_000), nome: z.string().trim().min(1).max(200),
  ativa: z.boolean().default(true), prioridade: z.number().int().min(0).max(10_000).default(0),
  pipelineId: z.string().cuid().optional(), etapaOrigemId: z.string().cuid().optional(), etapaDestinoId: z.string().cuid().optional(),
  condicao: grupoCondicaoSchema, resultado: resultadoRegraSchema,
});
export type RegraBpmInput = z.infer<typeof regraBpmSchema>;
export const contextoAvaliacaoSchema = z.object({
  card: z.record(z.string(), z.unknown()), cliente: z.record(z.string(), z.unknown()).optional(), processo: z.record(z.string(), z.unknown()).optional(),
  contratacao: z.record(z.string(), z.unknown()).optional(), relacionada: z.record(z.string(), z.unknown()).optional(), checklist: z.record(z.string(), z.unknown()).optional(), camposDinamicos: z.record(z.string().cuid(), z.unknown()).optional(),
}).strict();
export const fixtureCliSchema = z.object({ contexto: contextoAvaliacaoSchema, regra: regraBpmSchema }).strict();
