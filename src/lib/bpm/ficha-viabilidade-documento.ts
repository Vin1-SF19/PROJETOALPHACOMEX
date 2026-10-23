import { z } from "zod";
import type { FichaAlphaDados } from "@/components/GerarFicha";
import { BPM_PIPELINE_KEYS, BPM_STAGE_KEYS } from "@/lib/bpm/ontology";

function normalizar(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
export function pipelinePossuiFichaViabilidade(pipeline: { chave: string | null; nome: string }) {
  return pipeline.chave === BPM_PIPELINE_KEYS.RADAR
    || ((!pipeline.chave || pipeline.chave === BPM_PIPELINE_KEYS.COMERCIAL) && normalizar(pipeline.nome) === "revisao de radar");
}
export function entradaSolicitaFichaViabilidade(pipeline: { chave: string | null; nome: string }, etapa: { chave: string | null; nome: string }) {
  return pipelinePossuiFichaViabilidade(pipeline) && (etapa.chave
    ? etapa.chave === BPM_STAGE_KEYS.REUNIAO_AGENDADA : normalizar(etapa.nome) === "reuniao agendada");
}

const texto = z.string().max(500);
export const fichaViabilidadeExtrasSchema = z.object({
  dataSituacao: texto.optional(), horaSituacao: texto.optional(),
  mesProtocolo: texto.optional(), telefone: texto.optional(),
  email: z.string().max(320).refine(value => !value || z.email().safeParse(value).success, "E-mail inválido").optional(),
  nomeResponsavel: texto.optional(), observacoes: z.string().max(10_000).optional(),
  origemLead: texto.optional(), origemLeadDetalhe: texto.optional(),
}).strict();
export type FichaViabilidadeExtras = z.infer<typeof fichaViabilidadeExtrasSchema>;

export const fichaViabilidadeDadosSchema = z.object({
  rfb: z.object({ dados: z.object({
    razaoSocial: z.string(), nomeFantasia: z.string().optional(), cnpj: z.string(), uf: z.string().optional(),
    dataConstituicao: z.string().optional(), capitalSocial: z.union([z.string(), z.number()]).optional(),
    natureza_juridica: z.string().optional(),
  }) }),
  radar: z.object({ situacao: z.string(), submodalidade: z.string() }),
  empresaqui: z.object({ dados: z.object({ regimeEA: z.string() }) }),
  extra: fichaViabilidadeExtrasSchema,
});

export type FichaViabilidadeDTO = {
  anexoId: string; empresaId: number; empresaNome: string;
  dados: FichaAlphaDados; userLogado: string; revision: number;
};
export type ResultadoFichaViabilidade = {
  estado: "PRONTA" | "PENDENTE" | "FALHA" | "AUSENTE";
  data: FichaViabilidadeDTO | null;
  gerada: boolean;
  solicitacaoId: string | null;
  mensagem?: string;
};

export const fichaViabilidadeInputSchema = z.object({ cardId: z.string().min(1).max(150) });
export const fichaViabilidadeLeituraSchema = fichaViabilidadeInputSchema.extend({ solicitacaoId: z.string().min(1).max(150).optional() });
export const fichaViabilidadeSalvarSchema = fichaViabilidadeInputSchema.extend({
  expectedRevision: z.number().int().positive(), extras: fichaViabilidadeExtrasSchema,
});
