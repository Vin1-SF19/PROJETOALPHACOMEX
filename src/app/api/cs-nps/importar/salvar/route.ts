import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import {
  CS_NPS_NO_STORE_HEADERS,
  registrarAuditoriaCsNpsBestEffort,
  verificarAcessoAdministrativoCsNps,
} from "@/lib/cs-nps/autorizacao";
import {
  ErroImportacao,
  payloadSalvarImportacaoSchema,
  salvarImportacao,
} from "@/lib/cs-nps/importar-dados";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LIMITE_PAYLOAD_BYTES = 5 * 1024 * 1024;

function jsonError(error: string, status: number, code: string) {
  return NextResponse.json(
    { success: false, error, code },
    { status, headers: CS_NPS_NO_STORE_HEADERS },
  );
}

function validarRequisicaoJson(request: NextRequest): void {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    throw new ErroImportacao("Content-Type application/json é obrigatório", "INVALID_CONTENT_TYPE");
  }
  const bruto = request.headers.get("content-length");
  const contentLength = bruto === null ? Number.NaN : Number(bruto);
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
    throw new ErroImportacao("Content-Length válido é obrigatório", "INVALID_CONTENT_LENGTH", 413);
  }
  if (contentLength > LIMITE_PAYLOAD_BYTES) {
    throw new ErroImportacao("A confirmação excede o limite permitido", "PAYLOAD_TOO_LARGE", 413);
  }

  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  if (!host || !origin) {
    throw new ErroImportacao("Origem obrigatória", "INVALID_ORIGIN", 403);
  }
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
  try {
    const acesso = await verificarAcessoAdministrativoCsNps();
    if (!acesso.autorizado) {
      if (acesso.userId !== null) {
        await registrarAuditoriaCsNpsBestEffort(
          acesso.userId,
          "IMPORTAR_CS_NPS_SALVAR_NEGADO",
          "Confirmação negada; sucesso=false",
        );
      }
      return jsonError(
        acesso.status === 401 ? "Não autenticado" : "Sem permissão para importar dados do CS & NPS",
        acesso.status,
        acesso.code,
      );
    }
    userId = acesso.userId;

    validarRequisicaoJson(request);
    const payload: unknown = await request.json();
    const validacao = payloadSalvarImportacaoSchema.safeParse(payload);
    if (!validacao.success) {
      throw new ErroImportacao("Existem linhas inválidas para salvar", "INVALID_SAVE_PAYLOAD", 422);
    }

    const resumo = await salvarImportacao(validacao.data.linhas, userId);
    revalidatePath("/PainelAlpha/CadastroClientes");

    return NextResponse.json(
      {
        success: true,
        data: {
          resumo,
          idempotencia: {
            persistente: false,
            motivo: "A story não cria tabela de lotes; a interface bloqueia reenvio concorrente, mas uma nova confirmação manual cria novos registros.",
          },
        },
        message: `${resumo.total} registros importados com sucesso`,
      },
      { status: 201, headers: CS_NPS_NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof ErroImportacao) {
      if (userId !== null) {
        await registrarAuditoriaCsNpsBestEffort(
          userId,
          "IMPORTAR_CS_NPS_SALVAR_REJEITADO",
          `Confirmação rejeitada; code=${error.code}; sucesso=false`,
        );
      }
      return jsonError(error.message, error.status, error.code);
    }
    if (userId !== null) {
      await registrarAuditoriaCsNpsBestEffort(
        userId,
        "IMPORTAR_CS_NPS_SALVAR_FALHA",
        "Falha técnica na confirmação; sucesso=false",
      );
    }
    return jsonError("Não foi possível salvar a importação", 500, "SAVE_FAILED");
  }
}
