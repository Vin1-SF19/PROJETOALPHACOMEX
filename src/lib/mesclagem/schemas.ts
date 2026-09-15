import "server-only";

import { z } from "zod";

import {
  CAMPOS_DESTINO_MESCLAGEM,
  LIMITE_COLUNAS_MESCLAGEM,
  campoDestinoMesclagemSchema,
} from "./catalogo";
import { ErroMesclagem } from "./erro";

export const campoMapeamentoEntradaSchema = z.object({
  destino: campoDestinoMesclagemSchema,
  origem: z.number().int().positive().max(LIMITE_COLUNAS_MESCLAGEM).nullable(),
  origemNome: z.string().max(120).nullable().optional(),
  automatico: z.boolean().optional(),
  manual: z.boolean().optional(),
  origemPrincipal: z.number().int().positive().max(LIMITE_COLUNAS_MESCLAGEM).nullable().optional(),
  origemPrincipalNome: z.string().max(120).nullable().optional(),
}).strict();

export const mapeamentoEntradaSchema = z.array(campoMapeamentoEntradaSchema).max(CAMPOS_DESTINO_MESCLAGEM.length);

const arquivoSchema = z.custom<File>(
  (valor) => typeof File !== "undefined" && valor instanceof File,
  "Arquivo inválido",
);

const parametrosMultipartSchema = z.object({
  principal: arquivoSchema,
  complementar: arquivoSchema,
  abaPrincipal: z.string().trim().min(1).max(31).optional(),
  abaComplementar: z.string().trim().min(1).max(31).optional(),
  colunaCnpjPrincipal: z.number().int().positive().max(LIMITE_COLUNAS_MESCLAGEM).optional(),
  colunaCnpjComplementar: z.number().int().positive().max(LIMITE_COLUNAS_MESCLAGEM).optional(),
  mapeamento: mapeamentoEntradaSchema.optional(),
}).strict();

function numeroOpcional(formData: FormData, campo: string): number | undefined {
  const valor = formData.get(campo);
  return valor === null || valor === "" ? undefined : Number(valor);
}

export function extrairParametrosMultipartMesclagem(formData: FormData, exigirMapeamento = false) {
  const bruto = formData.get("mapeamento");
  let mapeamento: unknown = undefined;
  if (bruto !== null && bruto !== "") {
    if (typeof bruto !== "string") throw new ErroMesclagem("Mapeamento inválido", "INVALID_MAPPING", 422);
    try { mapeamento = JSON.parse(bruto); } catch { throw new ErroMesclagem("Mapeamento inválido", "INVALID_MAPPING", 422); }
  }
  if (exigirMapeamento && mapeamento === undefined) throw new ErroMesclagem("Mapeamento é obrigatório", "INVALID_MAPPING", 422);
  if (mapeamento !== undefined) {
    const validacaoMapeamento = mapeamentoEntradaSchema.safeParse(mapeamento);
    if (!validacaoMapeamento.success) throw new ErroMesclagem("Mapeamento inválido", "INVALID_MAPPING", 422);
    mapeamento = validacaoMapeamento.data;
  }
  const resultado = parametrosMultipartSchema.safeParse({
    principal: formData.get("principal"),
    complementar: formData.get("complementar"),
    abaPrincipal: formData.get("abaPrincipal") || undefined,
    abaComplementar: formData.get("abaComplementar") || undefined,
    colunaCnpjPrincipal: numeroOpcional(formData, "colunaCnpjPrincipal"),
    colunaCnpjComplementar: numeroOpcional(formData, "colunaCnpjComplementar"),
    mapeamento,
  });
  if (!resultado.success) throw new ErroMesclagem("Parâmetros da mesclagem inválidos", "INVALID_FORM_DATA", 422);
  return resultado.data;
}
