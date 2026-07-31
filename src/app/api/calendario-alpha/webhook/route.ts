import { createHash } from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";

import {
  criarCorrelationIdAgendaAlpha,
  registrarEventoAgendaAlpha,
  type MotivoWebhookAgendaAlpha,
  type ResultadoWebhookAgendaAlpha,
} from "@/lib/google-calendar/observability";
import { autenticarCanalPush } from "@/lib/google-calendar/push-channels";
import { lerAgendaAlphaRuntimeConfig } from "@/lib/google-calendar/runtime-config";
import {
  enfileirarOperacao,
  type AgendaAlphaSqlExecutor,
} from "@/lib/google-calendar/sync-queue";
import db from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ESTADOS_RECURSO = new Set(["sync", "exists", "not_exists"]);
const MAX_HEADER_OPACO = 512;
const JANELA_RATE_LIMIT_MS = 60_000;
const LIMITE_PRE_DB_POR_ORIGEM = 300;
const LIMITE_POS_AUTH_POR_CANAL = 120;
const MAX_CHAVES_RATE_LIMIT = 5_000;

interface EntradaRateLimit {
  inicioJanela: number;
  total: number;
}

const rateLimitPreDb = new Map<string, EntradaRateLimit>();
const rateLimitPosAuth = new Map<string, EntradaRateLimit>();

interface HeadersWebhook {
  googleChannelId: string;
  channelToken: string;
  googleResourceId: string;
  resourceState: "sync" | "exists" | "not_exists";
  messageNumber: string;
  channelExpiration: string | null;
}

function headerOpacoValido(
  valor: string | null,
  maxLength = MAX_HEADER_OPACO,
): valor is string {
  return (
    valor !== null &&
    valor.length > 0 &&
    valor.length <= maxLength &&
    !/[\u0000-\u001f\u007f]/.test(valor)
  );
}

function lerHeadersWebhook(request: NextRequest): HeadersWebhook | null {
  const googleChannelId = request.headers.get("x-goog-channel-id");
  const channelToken = request.headers.get("x-goog-channel-token");
  const googleResourceId = request.headers.get("x-goog-resource-id");
  const resourceState = request.headers.get("x-goog-resource-state");
  const messageNumber = request.headers.get("x-goog-message-number");
  const channelExpiration = request.headers.get("x-goog-channel-expiration");

  if (
    !headerOpacoValido(googleChannelId, 128) ||
    !headerOpacoValido(channelToken, 256) ||
    !headerOpacoValido(googleResourceId) ||
    !headerOpacoValido(resourceState, 32) ||
    !ESTADOS_RECURSO.has(resourceState) ||
    !headerOpacoValido(messageNumber, 32) ||
    !/^\d+$/.test(messageNumber)
  ) {
    return null;
  }
  if (
    channelExpiration !== null &&
    (!headerOpacoValido(channelExpiration, 128) ||
      Number.isNaN(Date.parse(channelExpiration)))
  ) {
    return null;
  }

  return {
    googleChannelId,
    channelToken,
    googleResourceId,
    resourceState: resourceState as HeadersWebhook["resourceState"],
    messageNumber,
    channelExpiration,
  };
}

async function requestTemBody(request: NextRequest): Promise<boolean> {
  if (request.headers.get("content-type")) return true;
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const tamanho = Number(contentLength);
    if (!Number.isSafeInteger(tamanho) || tamanho < 0 || tamanho > 0) return true;
  }
  if (!request.body) return false;

  const leitor = request.body.getReader();
  try {
    const primeiro = await leitor.read();
    return !primeiro.done && (primeiro.value?.byteLength ?? 0) > 0;
  } finally {
    await leitor.cancel().catch(() => undefined);
  }
}

function idempotencyKey(headers: HeadersWebhook): string {
  const digest = createHash("sha256")
    .update(
      [
        headers.googleChannelId,
        headers.googleResourceId,
        headers.resourceState,
        headers.messageNumber,
      ].join("\u0000"),
      "utf8",
    )
    .digest("hex");
  return `webhook:${digest}`;
}

function referenciaTecnica(valor: string): string {
  return createHash("sha256").update(valor, "utf8").digest("hex").slice(0, 24);
}

function origemTecnica(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const origem =
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    forwardedFor ||
    "unknown";
  return referenciaTecnica(origem.slice(0, 128));
}

function consumirRateLimit(
  store: Map<string, EntradaRateLimit>,
  chave: string,
  limite: number,
  agora = Date.now(),
): { allowed: boolean; retryAfterSeconds: number } {
  const existente = store.get(chave);
  if (!existente || agora - existente.inicioJanela >= JANELA_RATE_LIMIT_MS) {
    if (store.size >= MAX_CHAVES_RATE_LIMIT) {
      for (const [chaveExistente, entrada] of store) {
        if (agora - entrada.inicioJanela >= JANELA_RATE_LIMIT_MS) {
          store.delete(chaveExistente);
        }
      }
      if (store.size >= MAX_CHAVES_RATE_LIMIT) {
        const primeiraChave = store.keys().next().value;
        if (primeiraChave) store.delete(primeiraChave);
      }
    }
    store.set(chave, { inicioJanela: agora, total: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existente.total += 1;
  if (existente.total <= limite) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return {
    allowed: false,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil(
        (JANELA_RATE_LIMIT_MS - (agora - existente.inicioJanela)) / 1_000,
      ),
    ),
  };
}

function respostaRateLimit(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { success: false, error: "Notificação de calendário temporariamente limitada." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}

/**
 * Limiter local, limitado em memória, para absorver abuso por instância. Em
 * produção multi-instância, WAF/rate limit distribuído continua obrigatório.
 */
export function resetAgendaAlphaWebhookRateLimiterForTests(): void {
  if (process.env.NODE_ENV !== "test") return;
  rateLimitPreDb.clear();
  rateLimitPosAuth.clear();
}

function respostaErro(status: number): NextResponse {
  return NextResponse.json(
    { success: false, error: "Notificação de calendário inválida." },
    { status },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const iniciadoEm = Date.now();
  const correlationId = criarCorrelationIdAgendaAlpha();
  const observar = (
    outcome: ResultadoWebhookAgendaAlpha,
    reason?: MotivoWebhookAgendaAlpha,
    headers?: HeadersWebhook,
  ) => {
    registrarEventoAgendaAlpha({
      correlationId,
      outcome,
      reason,
      googleChannelId: headers?.googleChannelId,
      resourceState: headers?.resourceState,
      latencyMs: Date.now() - iniciadoEm,
    });
  };

  const config = lerAgendaAlphaRuntimeConfig();
  if (
    !config.valid ||
    !config.pushEnabled ||
    !config.queueEnabled ||
    !config.distributedLockEnabled
  ) {
    observar("rejected", "FEATURE_DISABLED");
    return respostaErro(503);
  }
  const preDb = consumirRateLimit(
    rateLimitPreDb,
    origemTecnica(request),
    LIMITE_PRE_DB_POR_ORIGEM,
  );
  if (!preDb.allowed) {
    observar("rejected");
    return respostaRateLimit(preDb.retryAfterSeconds);
  }
  if (await requestTemBody(request)) {
    observar("rejected", "INVALID_REQUEST");
    return respostaErro(400);
  }

  const headers = lerHeadersWebhook(request);
  if (!headers) {
    observar("rejected", "INVALID_REQUEST");
    return respostaErro(400);
  }

  const canal = await autenticarCanalPush({
    googleChannelId: headers.googleChannelId,
    channelToken: headers.channelToken,
    googleResourceId: headers.googleResourceId,
  });
  if (!canal) {
    observar("rejected", "AUTH_FAILED", headers);
    return respostaErro(403);
  }
  const posAuth = consumirRateLimit(
    rateLimitPosAuth,
    referenciaTecnica(canal.googleChannelId),
    LIMITE_POS_AUTH_POR_CANAL,
  );
  if (!posAuth.allowed) {
    observar("rejected", undefined, headers);
    return respostaRateLimit(posAuth.retryAfterSeconds);
  }

  let outcome: ResultadoWebhookAgendaAlpha = "accepted";
  try {
    await db.$transaction(async (tx) => {
      const canalAtual = await tx.googleCalendarPushChannel.findUnique({
        where: { id: canal.id },
        select: {
          status: true,
          googleResourceId: true,
          lastMessageNumber: true,
        },
      });
      if (
        !canalAtual ||
        !["CREATING", "ACTIVE"].includes(canalAtual.status) ||
        (canalAtual.googleResourceId !== null &&
          canalAtual.googleResourceId !== headers.googleResourceId)
      ) {
        throw new Error("Canal push mudou durante o processamento.");
      }

      const messageNumberRecebido = BigInt(headers.messageNumber);
      const messageNumberAnterior =
        canalAtual.lastMessageNumber &&
        /^\d+$/.test(canalAtual.lastMessageNumber)
          ? BigInt(canalAtual.lastMessageNumber)
          : null;
      if (
        messageNumberAnterior !== null &&
        messageNumberRecebido <= messageNumberAnterior
      ) {
        outcome = "duplicate";
        return;
      }

      const atualizados = await tx.googleCalendarPushChannel.updateMany({
        where: {
          id: canal.id,
          status: { in: ["CREATING", "ACTIVE"] },
          OR: [
            { googleResourceId: null },
            { googleResourceId: headers.googleResourceId },
          ],
          lastMessageNumber: canalAtual.lastMessageNumber,
        },
        data: {
          googleResourceId: headers.googleResourceId,
          lastMessageNumber: headers.messageNumber,
          lastNotificationAt: new Date(),
        },
      });
      if (atualizados.count !== 1) {
        throw new Error("Canal push mudou durante o processamento.");
      }

      const chaveIdempotencia = idempotencyKey(headers);
      const duplicada =
        await tx.googleCalendarPendingOperation.findUnique({
          where: { idempotencyKey: chaveIdempotencia },
          select: { id: true },
        });
      const coalescivel = duplicada
        ? null
        : await tx.googleCalendarPendingOperation.findFirst({
            where: {
              calendarioId: canal.calendarioId,
              operationType: "SYNC_CALENDAR",
              status: { in: ["PENDING", "RETRY"] },
            },
            select: { id: true },
          });
      outcome = duplicada ? "duplicate" : coalescivel ? "coalesced" : "accepted";

      const sql: AgendaAlphaSqlExecutor = {
        query<T>(query: string, values = []) {
          return tx.$queryRawUnsafe<T[]>(query, ...values);
        },
        execute(query: string, values = []) {
          return tx.$executeRawUnsafe(query, ...values);
        },
      };
      await enfileirarOperacao(
        {
          calendarioId: canal.calendarioId,
          operationType: "SYNC_CALENDAR",
          source: "WEBHOOK",
          idempotencyKey: chaveIdempotencia,
          pushChannelId: canal.id,
          priority: 50,
        },
        { sql },
      );
    });
  } catch {
    observar("rejected", "PERSISTENCE_FAILED", headers);
    return respostaErro(503);
  }

  observar(outcome, undefined, headers);
  return new NextResponse(null, { status: 204 });
}
