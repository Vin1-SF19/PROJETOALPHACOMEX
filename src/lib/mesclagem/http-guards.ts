import "server-only";

import { ErroMesclagem } from "./erro";

type RequisicaoComHeaders = { headers: Headers };

export function validarMesmaOrigemMesclagem(request: RequisicaoComHeaders): void {
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  if (!host || !origin) throw new ErroMesclagem("Origem obrigatória", "INVALID_ORIGIN", 403);
  let origem: URL;
  try { origem = new URL(origin); } catch { throw new ErroMesclagem("Origem inválida", "INVALID_ORIGIN", 403); }
  if (origem.host.toLocaleLowerCase("en-US") !== host.toLocaleLowerCase("en-US")) {
    throw new ErroMesclagem("Origem não permitida", "INVALID_ORIGIN", 403);
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    throw new ErroMesclagem("Requisição cross-site não permitida", "CROSS_SITE_REQUEST", 403);
  }
}

function validarContentLength(request: RequisicaoComHeaders, limiteBytes: number, mensagemLimite: string): void {
  const bruto = request.headers.get("content-length");
  const tamanho = bruto === null ? Number.NaN : Number(bruto);
  if (!Number.isSafeInteger(tamanho) || tamanho <= 0) {
    throw new ErroMesclagem("Content-Length válido é obrigatório", "INVALID_CONTENT_LENGTH", 413);
  }
  if (tamanho > limiteBytes) throw new ErroMesclagem(mensagemLimite, "FILE_TOO_LARGE", 413);
}

export function validarMultipartMesclagem(
  request: RequisicaoComHeaders,
  limiteBytes: number,
  mensagemLimite: string,
): void {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType) || !/(?:^|;)\s*boundary=(?:"[^"]+"|[^;\s]+)(?:;|$)/i.test(contentType)) {
    throw new ErroMesclagem("Content-Type multipart/form-data com boundary é obrigatório", "INVALID_CONTENT_TYPE");
  }
  validarContentLength(request, limiteBytes, mensagemLimite);
  validarMesmaOrigemMesclagem(request);
}

export function validarJsonMesclagem(request: RequisicaoComHeaders, limiteBytes: number): void {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    throw new ErroMesclagem("Content-Type application/json é obrigatório", "INVALID_CONTENT_TYPE");
  }
  validarContentLength(request, limiteBytes, "Payload acima do limite permitido");
  validarMesmaOrigemMesclagem(request);
}
