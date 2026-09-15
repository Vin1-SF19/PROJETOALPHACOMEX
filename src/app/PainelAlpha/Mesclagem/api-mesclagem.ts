import type { CampoMapeamento, ColunaPlanilha, InspecaoPlanilha, PreviaMesclagem, SugestaoMapeamento } from "@/lib/mesclagem";
import { EXTENSOES_MESCLAGEM } from "@/lib/mesclagem/catalogo";
import { z } from "zod";

export const ACCEPT_MESCLAGEM = EXTENSOES_MESCLAGEM.join(",");
export { EXTENSOES_MESCLAGEM };

const colunaSchema: z.ZodType<ColunaPlanilha> = z.object({
  numero: z.number().int().positive(), nome: z.string(), nomeNormalizado: z.string(),
}).strict();
const inspecaoSchema: z.ZodType<InspecaoPlanilha> = z.object({
  nomeArquivo: z.string(), extensao: z.string(),
  abas: z.array(z.object({ nome: z.string(), colunas: z.array(colunaSchema), totalLinhas: z.number().int().nonnegative() }).strict()),
  colunasCnpjSugeridas: z.array(z.number().int().positive()),
}).strict();
const campoMapeamentoSchema: z.ZodType<CampoMapeamento> = z.object({
  destino: z.string(), origem: z.number().int().positive().nullable(), origemNome: z.string().nullable(),
  automatico: z.boolean(), manual: z.boolean().optional(), origemPrincipal: z.number().int().positive().nullable().optional(),
  origemPrincipalNome: z.string().nullable().optional(),
}).strict();
const resultadoSchema = z.object({
  resumo: z.object({
    totalLinhas: z.number().int().nonnegative(), comMatch: z.number().int().nonnegative(),
    semMatch: z.number().int().nonnegative(), linhasComplementares: z.number().int().nonnegative(),
    cnpj: z.object({
      status: z.enum(["valido", "invalido", "vazio"]), total: z.number().int().nonnegative(),
      validos: z.number().int().nonnegative(), invalidos: z.number().int().nonnegative(),
      vazios: z.number().int().nonnegative(), duplicados: z.number().int().nonnegative(),
      exemplosInvalidos: z.array(z.string()),
    }).strict(),
  }).strict(),
  linhas: z.array(z.object({
    id: z.string(), cnpj: z.string().nullable(), origemPrincipal: z.number().int().positive(),
    origemComplementar: z.number().int().positive().nullable(), valores: z.record(z.string(), z.string()),
  }).strict()),
}).strict();
const previaSchema: z.ZodType<PreviaMesclagem> = z.object({
  principal: inspecaoSchema, complementar: inspecaoSchema, abaPrincipal: z.string(), abaComplementar: z.string(),
  colunaCnpjPrincipal: z.number().int().positive(), colunaCnpjComplementar: z.number().int().positive(),
  mapeamento: z.array(campoMapeamentoSchema), resultado: resultadoSchema,
}).strict();
const sugestaoSchema: z.ZodType<SugestaoMapeamento> = z.object({
  mapeamento: z.array(campoMapeamentoSchema),
  ia: z.object({
    status: z.enum(["nao_necessario", "sucesso", "timeout", "falha", "resposta_invalida", "truncado"]),
    finishReason: z.string().nullable(), duracaoMs: z.number().nonnegative(),
    pendentes: z.number().int().nonnegative(), aplicados: z.number().int().nonnegative(),
  }).strict(),
}).strict();
const erroSchema = z.object({ success: z.literal(false), error: z.string(), code: z.string().optional() }).strict();

async function lerResposta<T>(response: Response, dataSchema: z.ZodType<T>) {
  const schema = z.discriminatedUnion("success", [
    z.object({ success: z.literal(true), data: dataSchema }).strict(),
    erroSchema,
  ]);
  try {
    const resultado = schema.safeParse(await response.json());
    return resultado.success
      ? resultado.data
      : { success: false as const, error: "O servidor retornou uma resposta inesperada." };
  } catch {
    return { success: false as const, error: "O servidor retornou uma resposta inesperada." };
  }
}

function nomeArquivoResposta(contentDisposition: string | null): string {
  const encontrado = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
    ?? contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1];
  return encontrado ? decodeURIComponent(encontrado) : "mesclagem-planilhas.xlsx";
}

export async function baixarTemplateMesclagem(): Promise<void> {
  const response = await fetch("/api/mesclagem/template", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) {
    const resultado = await lerResposta(response, z.never());
    throw new Error(resultado.success ? "Não foi possível baixar o template." : resultado.error);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivoResposta(response.headers.get("content-disposition"));
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function inspecionarArquivo(arquivo: File): Promise<InspecaoPlanilha> {
  const formData = new FormData();
  formData.append("arquivo", arquivo);
  const response = await fetch("/api/mesclagem/inspecionar", { method: "POST", credentials: "same-origin", body: formData });
  const resultado = await lerResposta(response, inspecaoSchema);
  if (!response.ok || !resultado.success) throw new Error(resultado.success ? "Não foi possível inspecionar a planilha." : resultado.error);
  return resultado.data;
}

export async function sugerirMapeamento(params: {
  colunasPrincipal: ColunaPlanilha[];
  colunasComplementar: ColunaPlanilha[];
  mapeamento?: CampoMapeamento[];
}, signal?: AbortSignal): Promise<SugestaoMapeamento> {
  const response = await fetch("/api/mesclagem/sugerir", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
    signal,
  });
  const resultado = await lerResposta(response, sugestaoSchema);
  if (!response.ok || !resultado.success) {
    throw new Error(resultado.success ? "Não foi possível sugerir o mapeamento." : resultado.error);
  }
  return resultado.data;
}

export async function prepararPrevia(params: {
  principal: File;
  complementar: File;
  abaPrincipal?: string;
  abaComplementar?: string;
  colunaCnpjPrincipal?: number;
  colunaCnpjComplementar?: number;
  mapeamento?: unknown[];
}): Promise<PreviaMesclagem> {
  const formData = new FormData();
  formData.append("principal", params.principal);
  formData.append("complementar", params.complementar);
  if (params.abaPrincipal) formData.append("abaPrincipal", params.abaPrincipal);
  if (params.abaComplementar) formData.append("abaComplementar", params.abaComplementar);
  if (params.colunaCnpjPrincipal) formData.append("colunaCnpjPrincipal", String(params.colunaCnpjPrincipal));
  if (params.colunaCnpjComplementar) formData.append("colunaCnpjComplementar", String(params.colunaCnpjComplementar));
  if (params.mapeamento?.length) formData.append("mapeamento", JSON.stringify(params.mapeamento));

  const response = await fetch("/api/mesclagem/previa", { method: "POST", credentials: "same-origin", body: formData });
  const resultado = await lerResposta(response, previaSchema);
  if (!response.ok || !resultado.success) throw new Error(resultado.success ? "Não foi possível preparar a prévia." : resultado.error);
  return resultado.data;
}

export async function baixarResultado(params: {
  principal: File;
  complementar: File;
  abaPrincipal?: string;
  abaComplementar?: string;
  colunaCnpjPrincipal?: number;
  colunaCnpjComplementar?: number;
  mapeamento: CampoMapeamento[];
}): Promise<string> {
  const formData = new FormData();
  formData.append("principal", params.principal);
  formData.append("complementar", params.complementar);
  if (params.abaPrincipal) formData.append("abaPrincipal", params.abaPrincipal);
  if (params.abaComplementar) formData.append("abaComplementar", params.abaComplementar);
  if (params.colunaCnpjPrincipal) formData.append("colunaCnpjPrincipal", String(params.colunaCnpjPrincipal));
  if (params.colunaCnpjComplementar) formData.append("colunaCnpjComplementar", String(params.colunaCnpjComplementar));
  formData.append("mapeamento", JSON.stringify(params.mapeamento));

  const response = await fetch("/api/mesclagem/exportar", {
    method: "POST",
    credentials: "same-origin",
    body: formData,
  });
  if (!response.ok) {
    const resultado = await lerResposta(response, z.never());
    throw new Error(resultado.success ? "Não foi possível exportar a planilha." : resultado.error);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivoResposta(response.headers.get("content-disposition"));
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  const historicoId = response.headers.get("x-mesclagem-historico-id");
  if (!historicoId) throw new Error("A exportação foi baixada, mas o histórico não foi confirmado pelo servidor.");
  return historicoId;
}

export async function baixarResultadoHistorico(historicoId: string): Promise<void> {
  const response = await fetch(`/api/mesclagem/historico/${encodeURIComponent(historicoId)}/arquivo/resultado`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    const resultado = await lerResposta(response, z.never());
    throw new Error(resultado.success ? "Não foi possível baixar o resultado salvo." : resultado.error);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivoResposta(response.headers.get("content-disposition"));
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
