import { head } from "@vercel/blob";
import type { NextRequest } from "next/server";
import { nomeArquivoSeguro } from "@/lib/apresentacoes/assets";
import { obterTokenMotion } from "@/lib/apresentacoes/blob";

export const PPTX_MAX_BYTES = 80 * 1024 * 1024;
export const PPTX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export const PPTX_ALLOWED_CONTENT_TYPES = [PPTX_CONTENT_TYPE, "application/octet-stream", "application/zip"] as const;

interface ReferenciaUploadPptx {
  fileUrl?: unknown;
  fileName?: unknown;
  excluirIndices?: unknown;
}

export interface ArquivoPptxCarregado {
  buffer: Buffer;
  nome: string;
  tamanho: number;
  blobUrl?: string;
  excluirIndices: Set<number>;
}

export class ErroEntradaPptx extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ErroEntradaPptx";
  }
}

export function prefixoOriginaisPptx(apresentacaoId: string): string {
  return `apresentacoes/${apresentacaoId}/originais/`;
}

export function prefixoPreviewPptx(apresentacaoId: string): string {
  return `apresentacoes/${apresentacaoId}/preview/`;
}

export function criarCaminhoUploadPptx(apresentacaoId: string, nomeOriginal: string): string {
  return `${prefixoOriginaisPptx(apresentacaoId)}${crypto.randomUUID()}-${nomeArquivoSeguro(nomeOriginal)}`;
}

export function caminhoPertenceAoPptx(pathname: string, apresentacaoId: string): boolean {
  return pathname.startsWith(prefixoOriginaisPptx(apresentacaoId))
    || pathname.startsWith(prefixoPreviewPptx(apresentacaoId));
}

export function extrairCaminhoBlobPublico(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".blob.vercel-storage.com")) return null;
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
}

function validarNomeETamanho(nome: string, tamanho: number): void {
  if (!nome.toLowerCase().endsWith(".pptx")) {
    throw new ErroEntradaPptx("Envie um arquivo .pptx (PowerPoint).", 400);
  }
  if (tamanho <= 0) throw new ErroEntradaPptx("O arquivo está vazio.", 400);
  if (tamanho > PPTX_MAX_BYTES) {
    throw new ErroEntradaPptx(`O arquivo excede o limite de ${Math.round(PPTX_MAX_BYTES / 1024 / 1024)} MB.`, 413);
  }
}

function normalizarIndices(valor: unknown): Set<number> {
  let candidato = valor;
  if (typeof candidato === "string" && candidato) {
    try {
      candidato = JSON.parse(candidato) as unknown;
    } catch {
      return new Set();
    }
  }
  if (!Array.isArray(candidato)) return new Set();
  return new Set(candidato.filter((item): item is number => Number.isInteger(item) && item >= 0));
}

async function carregarReferenciaBlob(
  payload: ReferenciaUploadPptx,
  apresentacaoId: string,
): Promise<ArquivoPptxCarregado> {
  if (typeof payload.fileUrl !== "string" || typeof payload.fileName !== "string") {
    throw new ErroEntradaPptx("Referência do arquivo ausente.", 400);
  }

  const caminhoInformado = extrairCaminhoBlobPublico(payload.fileUrl);
  if (!caminhoInformado || !caminhoInformado.startsWith(prefixoOriginaisPptx(apresentacaoId))) {
    throw new ErroEntradaPptx("O arquivo enviado não pertence a esta apresentação.", 403);
  }

  let metadata: Awaited<ReturnType<typeof head>>;
  try {
    metadata = await head(payload.fileUrl, { token: obterTokenMotion() });
  } catch {
    throw new ErroEntradaPptx("O upload do PowerPoint não foi encontrado ou expirou.", 404);
  }

  if (metadata.pathname !== caminhoInformado || !metadata.pathname.startsWith(prefixoOriginaisPptx(apresentacaoId))) {
    throw new ErroEntradaPptx("O arquivo enviado não pertence a esta apresentação.", 403);
  }
  validarNomeETamanho(payload.fileName, metadata.size);

  let resposta: Response;
  try {
    resposta = await fetch(metadata.url, { cache: "no-store" });
  } catch {
    throw new ErroEntradaPptx("Não foi possível baixar o PowerPoint enviado.", 502);
  }
  if (!resposta.ok) throw new ErroEntradaPptx("Não foi possível baixar o PowerPoint enviado.", 502);

  const buffer = Buffer.from(await resposta.arrayBuffer());
  validarNomeETamanho(payload.fileName, buffer.byteLength);
  if (buffer.byteLength !== metadata.size) {
    throw new ErroEntradaPptx("O PowerPoint enviado ficou incompleto. Tente novamente.", 422);
  }

  return {
    buffer,
    nome: payload.fileName,
    tamanho: buffer.byteLength,
    blobUrl: metadata.url,
    excluirIndices: normalizarIndices(payload.excluirIndices),
  };
}

/**
 * Aceita o fluxo novo (JSON apontando para upload direto no Blob) e mantém o multipart antigo
 * para desenvolvimento/compatibilidade com clientes ainda em cache. Em produção, o JSON é
 * essencial: o binário nunca atravessa o limite de corpo da Function.
 */
export async function carregarArquivoPptx(
  request: NextRequest,
  apresentacaoId: string,
): Promise<ArquivoPptxCarregado> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    let payload: ReferenciaUploadPptx;
    try {
      payload = await request.json() as ReferenciaUploadPptx;
    } catch {
      throw new ErroEntradaPptx("Dados do upload inválidos.", 400);
    }
    return carregarReferenciaBlob(payload, apresentacaoId);
  }

  const formData = await request.formData();
  const arquivo = formData.get("file");
  if (!(arquivo instanceof File)) throw new ErroEntradaPptx("Arquivo ausente.", 400);
  validarNomeETamanho(arquivo.name, arquivo.size);

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await arquivo.arrayBuffer());
  } catch {
    throw new ErroEntradaPptx("Não foi possível ler o arquivo enviado.", 400);
  }
  validarNomeETamanho(arquivo.name, buffer.byteLength);
  return {
    buffer,
    nome: arquivo.name,
    tamanho: buffer.byteLength,
    excluirIndices: normalizarIndices(formData.get("excluirIndices")),
  };
}
