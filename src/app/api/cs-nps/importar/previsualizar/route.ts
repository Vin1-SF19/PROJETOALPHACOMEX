import { NextRequest, NextResponse } from "next/server";

import {
  CS_NPS_NO_STORE_HEADERS,
  registrarAuditoriaCsNpsBestEffort,
  verificarAcessoAdministrativoCsNps,
} from "@/lib/cs-nps/autorizacao";
import {
  ErroImportacao,
  previsualizarImportacao,
  validarArquivoImportacao,
  validarTiposImportacao,
} from "@/lib/cs-nps/importar-dados";
import {
  adquirirLimiteImportacao,
  obterIpImportacao,
} from "@/lib/cs-nps/importacao-rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LIMITE_CORPO_MULTIPART = 11 * 1024 * 1024;

function jsonError(error: string, status: number, code: string) {
  return NextResponse.json(
    { success: false, error, code },
    { status, headers: CS_NPS_NO_STORE_HEADERS },
  );
}

function validarRequisicaoUpload(request: NextRequest): void {
  const contentType = request.headers.get("content-type") ?? "";
  if (
    !/^multipart\/form-data\s*;/i.test(contentType) ||
    !/(?:^|;)\s*boundary=(?:"[^"]+"|[^;\s]+)(?:;|$)/i.test(contentType)
  ) {
    throw new ErroImportacao("Content-Type multipart/form-data com boundary é obrigatório", "INVALID_CONTENT_TYPE");
  }
  const bruto = request.headers.get("content-length");
  const contentLength = bruto === null ? Number.NaN : Number(bruto);
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
    throw new ErroImportacao("Content-Length válido é obrigatório", "INVALID_CONTENT_LENGTH", 413);
  }
  if (contentLength > LIMITE_CORPO_MULTIPART) {
    throw new ErroImportacao("O upload excede o limite de 11 MB", "FILE_TOO_LARGE", 413);
  }

  const host = request.headers.get("host");
  if (!host) throw new ErroImportacao("Host inválido", "INVALID_ORIGIN", 403);
  const origin = request.headers.get("origin");
  if (!origin) throw new ErroImportacao("Origem obrigatória", "INVALID_ORIGIN", 403);
  let origem: URL;
  try {
    origem = new URL(origin);
  } catch {
    throw new ErroImportacao("Origem inválida", "INVALID_ORIGIN", 403);
  }
  if (origem.host.toLocaleLowerCase("en-US") !== host.toLocaleLowerCase("en-US")) {
    throw new ErroImportacao("Origem não permitida", "INVALID_ORIGIN", 403);
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    throw new ErroImportacao("Requisição cross-site não permitida", "CROSS_SITE_REQUEST", 403);
  }
}

export async function POST(request: NextRequest) {
  let userId: number | null = null;
  let liberarLimite: (() => void) | null = null;
  try {
    const acesso = await verificarAcessoAdministrativoCsNps();
    if (!acesso.autorizado) {
      if (acesso.userId !== null) {
        await registrarAuditoriaCsNpsBestEffort(
          acesso.userId,
          "IMPORTAR_CS_NPS_PREVIA_NEGADA",
          "Prévia negada; sucesso=false",
        );
      }
      return jsonError(
        acesso.status === 401 ? "Não autenticado" : "Sem permissão para importar dados do CS & NPS",
        acesso.status,
        acesso.code,
      );
    }
    userId = acesso.userId;

    validarRequisicaoUpload(request);
    const limite = adquirirLimiteImportacao(userId, obterIpImportacao(request.headers));
    if (!limite.permitido) {
      throw new ErroImportacao(
        limite.motivo === "RATE_LIMIT"
          ? "Muitas tentativas de importação; aguarde um minuto"
          : "Já existe uma importação em processamento",
        limite.motivo,
        limite.motivo === "RATE_LIMIT" ? 429 : 409,
      );
    }
    liberarLimite = limite.liberar;
    const formData = await request.formData();
    const arquivo = formData.get("arquivo");
    const tiposBrutos = formData.get("tipos");
    if (!(arquivo instanceof File) || typeof tiposBrutos !== "string") {
      throw new ErroImportacao("Arquivo e tipos são obrigatórios", "INVALID_FORM_DATA");
    }
    validarArquivoImportacao(arquivo);

    let tiposJson: unknown;
    try {
      tiposJson = JSON.parse(tiposBrutos);
    } catch {
      throw new ErroImportacao("Seleção de tipos inválida", "INVALID_TYPES");
    }
    const tipos = validarTiposImportacao(tiposJson);
    const buffer = await arquivo.arrayBuffer();
    const preview = await previsualizarImportacao(buffer, arquivo.name, tipos);

    await registrarAuditoriaCsNpsBestEffort(
      userId,
      "IMPORTAR_CS_NPS_PREVIA",
      `Prévia concluída; tipos=${tipos.join(",")}; linhas=${preview.totais.total}; validas=${preview.totais.validas}; ambiguas=${preview.totais.ambiguas}; invalidas=${preview.totais.invalidas}; sucesso=true`,
    );
    return NextResponse.json(
      { success: true, data: preview },
      { status: 200, headers: CS_NPS_NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof ErroImportacao) {
      return jsonError(error.message, error.status, error.code);
    }
    if (userId !== null) {
      await registrarAuditoriaCsNpsBestEffort(
        userId,
        "IMPORTAR_CS_NPS_PREVIA_FALHA",
        "Falha técnica na prévia; sucesso=false",
      );
    }
    return jsonError("Não foi possível analisar a planilha", 500, "PREVIEW_FAILED");
  } finally {
    liberarLimite?.();
  }
}
