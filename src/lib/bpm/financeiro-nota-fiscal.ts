import { BPM_PIPELINE_KEYS } from "@/lib/bpm/ontology";

export type CampoNotaFiscal = { id: string; chave: string | null; nome: string; tipo: string; escopo: string; ativo: boolean };
export type ChaveNotaFiscal = "emitida" | "dataEmissao" | "numero" | "valor" | "link";

const NOMES: Record<ChaveNotaFiscal, string> = {
  emitida: "NF emitida",
  dataEmissao: "Data de emissão",
  numero: "Número da NF",
  valor: "Valor da NF",
  link: "Arquivo/link da NF",
};
const CHAVES: Record<ChaveNotaFiscal, string> = {
  emitida: "alpha.nf.emitida",
  dataEmissao: "alpha.data.de.emissao",
  numero: "alpha.numero.da.nf",
  valor: "alpha.valor.da.nf",
  link: "alpha.arquivo.link.da.nf",
};
const TIPOS: Record<ChaveNotaFiscal, readonly string[]> = {
  emitida: ["booleano", "selecao"],
  dataEmissao: ["data"],
  numero: ["texto"],
  valor: ["moeda"],
  link: ["texto", "arquivo", "url_ou_arquivo", "url"],
};

export function resolverCamposNotaFiscal(pipelineChave: string | null, campos: readonly CampoNotaFiscal[]): Record<ChaveNotaFiscal, CampoNotaFiscal> {
  if (pipelineChave !== BPM_PIPELINE_KEYS.FINANCEIRO) throw new Error("Nota fiscal disponível apenas no Financeiro.");
  const resultado = {} as Record<ChaveNotaFiscal, CampoNotaFiscal>;
  for (const chave of Object.keys(NOMES) as ChaveNotaFiscal[]) {
    const encontrados = campos.filter((campo) => campo.ativo && campo.escopo === "CARD" && campo.chave === CHAVES[chave] && TIPOS[chave].includes(campo.tipo));
    if (encontrados.length !== 1) throw new Error(`Configuração da nota fiscal ausente ou ambígua: ${NOMES[chave]}.`);
    resultado[chave] = encontrados[0];
  }
  return resultado;
}

export type DadosNotaFiscal = { emitida: "Sim" | "Não" | ""; dataEmissao: string; numero: string; valor: string; link: string };

export function dataNotaFiscalValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

export function valorNotaFiscalPositivo(valor: string): boolean {
  const normalizado = valor.trim().replace(",", ".");
  return /^\d+(?:\.\d{1,2})?$/.test(normalizado) && Number(normalizado) > 0;
}

export function linkNotaFiscalHttps(valor: string): boolean {
  try {
    const url = new URL(valor);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password && valor.length <= 2048;
  } catch { return false; }
}

export function pendenciasNotaFiscal(dados: DadosNotaFiscal, arquivoValido: boolean): string[] {
  if (dados.emitida !== "Sim") return [];
  const pendencias: string[] = [];
  if (!dados.numero.trim() || dados.numero.trim().length > 120) pendencias.push("Número da NF");
  if (!dataNotaFiscalValida(dados.dataEmissao.trim())) pendencias.push("Data de emissão");
  if (!valorNotaFiscalPositivo(dados.valor)) pendencias.push("Valor da NF");
  if (!arquivoValido && !linkNotaFiscalHttps(dados.link.trim())) pendencias.push("Arquivo/link da NF");
  return pendencias;
}

export function validarDadosNotaFiscal(dados: DadosNotaFiscal, linkArquivoExistente = ""): DadosNotaFiscal {
  const emitida = dados.emitida;
  const dataEmissao = dados.dataEmissao.trim();
  const numero = dados.numero.trim();
  const valor = dados.valor.trim().replace(",", ".");
  const link = dados.link.trim();
  if (!["Sim", "Não", ""].includes(emitida)) throw new Error("Informe se a NF foi emitida.");
  if (dataEmissao && !dataNotaFiscalValida(dataEmissao)) throw new Error("Data de emissão inválida.");
  if (numero.length > 120) throw new Error("O número da NF excede 120 caracteres.");
  if (link && link !== linkArquivoExistente && !linkNotaFiscalHttps(link)) throw new Error("Use um link HTTPS válido para a NF.");
  const normalizados = { emitida, dataEmissao, numero, valor, link };
  const pendencias = pendenciasNotaFiscal(normalizados, Boolean(link && link === linkArquivoExistente && !link.startsWith("https://")));
  if (pendencias.length) throw new Error(`Campos da NF pendentes: ${pendencias.join(", ")}.`);
  return normalizados;
}
