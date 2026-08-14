import { createHmac, timingSafeEqual } from "node:crypto";

// Este módulo é importado exclusivamente por Route Handlers/Server Actions BPM.
// O uso de node:crypto impede que ele seja incluído num componente client.

const PREFIXO_REFERENCIA_PRIVADA = "bpm-blob:";
const PREFIXO_PATHNAME = "bpm/";
const DURACAO_RECIBO_MS = 10 * 60 * 1000;

export type ReciboUploadAnexoBpm = {
  cardId: string;
  pathname: string;
  nome: string;
  tipo: string;
  tamanho: number;
  expiraEm: number;
};

function obterSegredoRecibo(): string | null {
  return process.env.CRM_ANEXO_RECEIPT_SECRET ?? null;
}

export function recibosAnexoBpmConfigurados(): boolean {
  return Boolean(obterSegredoRecibo());
}

function assinar(payloadCodificado: string): string {
  const segredo = obterSegredoRecibo();
  if (!segredo) throw new Error("Armazenamento de anexos não configurado");
  return createHmac("sha256", segredo).update(payloadCodificado).digest("base64url");
}

export function pathnameAnexoBpmValido(pathname: string): boolean {
  return pathname.startsWith(PREFIXO_PATHNAME)
    && pathname.length <= 1_024
    && !pathname.includes("\\")
    && !pathname.includes("..")
    && !pathname.includes("?")
    && !pathname.includes("#");
}

export function criarReferenciaAnexoBpm(pathname: string): string {
  if (!pathnameAnexoBpmValido(pathname)) throw new Error("Referência de anexo inválida");
  return `${PREFIXO_REFERENCIA_PRIVADA}${pathname}`;
}

export function extrairPathnamePrivadoAnexoBpm(referencia: string): string | null {
  if (!referencia.startsWith(PREFIXO_REFERENCIA_PRIVADA)) return null;
  const pathname = referencia.slice(PREFIXO_REFERENCIA_PRIVADA.length);
  return pathnameAnexoBpmValido(pathname) ? pathname : null;
}

export function criarReciboUploadAnexoBpm(input: Omit<ReciboUploadAnexoBpm, "expiraEm">): string {
  const payload: ReciboUploadAnexoBpm = { ...input, expiraEm: Date.now() + DURACAO_RECIBO_MS };
  if (!pathnameAnexoBpmValido(payload.pathname)) throw new Error("Referência de anexo inválida");
  const codificado = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${codificado}.${assinar(codificado)}`;
}

export function validarReciboUploadAnexoBpm(recibo: string): ReciboUploadAnexoBpm | null {
  const [codificado, assinatura, ...restante] = recibo.split(".");
  if (!codificado || !assinatura || restante.length > 0) return null;

  let assinaturaEsperada: Buffer;
  let assinaturaRecebida: Buffer;
  try {
    assinaturaEsperada = Buffer.from(assinar(codificado), "base64url");
    assinaturaRecebida = Buffer.from(assinatura, "base64url");
  } catch {
    return null;
  }
  if (assinaturaRecebida.length !== assinaturaEsperada.length
    || !timingSafeEqual(assinaturaRecebida, assinaturaEsperada)) return null;

  try {
    const payload = JSON.parse(Buffer.from(codificado, "base64url").toString("utf8")) as unknown;
    if (!payload || typeof payload !== "object") return null;
    const dados = payload as Record<string, unknown>;
    if (typeof dados.cardId !== "string" || typeof dados.pathname !== "string"
      || typeof dados.nome !== "string" || typeof dados.tipo !== "string"
      || typeof dados.tamanho !== "number" || typeof dados.expiraEm !== "number") return null;
    if (!pathnameAnexoBpmValido(dados.pathname) || dados.expiraEm < Date.now()) return null;
    return {
      cardId: dados.cardId,
      pathname: dados.pathname,
      nome: dados.nome,
      tipo: dados.tipo,
      tamanho: dados.tamanho,
      expiraEm: dados.expiraEm,
    };
  } catch {
    return null;
  }
}

/** Legado: referências públicas antigas continuam disponíveis somente via proxy autenticado. */
export function extrairUrlLegadaAnexoBpm(referencia: string): string | null {
  try {
    const url = new URL(referencia);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".blob.vercel-storage.com")) return null;
    if (!pathnameAnexoBpmValido(url.pathname.slice(1))) return null;
    return url.toString();
  } catch {
    return null;
  }
}
