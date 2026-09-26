import { BPM_PIPELINE_KEYS } from "@/lib/bpm/ontology";

export type CampoNotaFiscal = { id: string; chave: string | null; nome: string; tipo: string; escopo: string; ativo: boolean };
export type ChaveNotaFiscal = "emitida" | "dataEmissao" | "numero" | "link";

const NOMES: Record<ChaveNotaFiscal, string> = {
  emitida: "NF emitida",
  dataEmissao: "Data de emissão",
  numero: "Número da NF",
  link: "Arquivo/link da NF",
};
const CHAVES: Record<ChaveNotaFiscal, string> = {
  emitida: "alpha.nf.emitida",
  dataEmissao: "alpha.data.de.emissao",
  numero: "alpha.numero.da.nf",
  link: "alpha.arquivo.link.da.nf",
};
const TIPOS: Record<ChaveNotaFiscal, readonly string[]> = {
  emitida: ["booleano"],
  dataEmissao: ["data"],
  numero: ["texto"],
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

export type DadosNotaFiscal = { emitida: "Sim" | "Não" | ""; dataEmissao: string; numero: string; link: string };

export function validarDadosNotaFiscal(dados: DadosNotaFiscal, linkArquivoExistente = ""): DadosNotaFiscal {
  const emitida = dados.emitida;
  const dataEmissao = dados.dataEmissao.trim();
  const numero = dados.numero.trim();
  const link = dados.link.trim();
  if (!["Sim", "Não", ""].includes(emitida)) throw new Error("Informe se a NF foi emitida.");
  const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(dataEmissao)
    && !Number.isNaN(Date.parse(`${dataEmissao}T00:00:00Z`))
    && new Date(`${dataEmissao}T00:00:00Z`).toISOString().slice(0, 10) === dataEmissao;
  if (dataEmissao && !dataValida) {
    throw new Error("Data de emissão inválida.");
  }
  if (numero.length > 120) throw new Error("O número da NF excede 120 caracteres.");
  if (link && link !== linkArquivoExistente) {
    let url: URL;
    try { url = new URL(link); } catch { throw new Error("Link da NF inválido."); }
    if (url.protocol !== "https:" || !url.hostname || link.length > 2048) throw new Error("Use um link HTTPS válido para a NF.");
  }
  return { emitida, dataEmissao, numero, link };
}
