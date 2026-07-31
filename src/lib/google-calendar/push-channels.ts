import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import db from "@/lib/prisma";

import {
  encerrarWatchEventos,
  iniciarWatchEventos,
} from "./client";
import {
  AgendaAlphaLeaseLostError,
  adquirirLeaseSincronizacao,
  exigirLeaseSincronizacao,
  liberarLeaseSincronizacao,
  renovarLeaseSincronizacao,
} from "./distributed-lock";
import { GoogleCalendarError } from "./errors";
import { obterUsuarioGoogleAtivoPorCalendario } from "./usuario-google";

const DURACAO_CANAL_PADRAO_MS = 6 * 24 * 60 * 60 * 1000;
const ANTECEDENCIA_RENOVACAO_PADRAO_MS = 12 * 60 * 60 * 1000;
const TAMANHO_MAXIMO_TOKEN_CANAL = 256;
const HASH_SHA256_HEX = /^[a-f0-9]{64}$/;
const HASH_DUMMY_CANAL_INEXISTENTE = hashTokenCanalPush(
  "agenda-alpha-invalid-channel",
);
const DURACAO_LEASE_CANAL_MS = 90_000;
const INTERVALO_HEARTBEAT_CANAL_MS = 30_000;

export interface CanalPushAtivo {
  id: string;
  calendarioId: string;
  googleChannelId: string;
  expiresAt: Date;
  renewAfter: Date;
}

export interface CriarCanalPushOpcoes {
  webhookBaseUrl: string;
  duracaoMs?: number;
  antecedenciaRenovacaoMs?: number;
  agora?: () => Date;
  gerarChannelId?: () => string;
  gerarToken?: () => string;
}

export interface CanalPushAutenticado {
  id: string;
  calendarioId: string;
  googleChannelId: string;
  googleResourceId: string | null;
  lastMessageNumber: string | null;
}

async function executarComLeaseCanal<T>(
  calendarioId: string,
  executar: (exigirLease: () => Promise<void>) => Promise<T>,
): Promise<T> {
  const ownerId = `agenda-alpha-push:${process.pid}:${randomUUID()}`;
  const leaseAdquirido = await adquirirLeaseSincronizacao({
    calendarioId,
    ownerId,
    leaseDurationMs: DURACAO_LEASE_CANAL_MS,
  });
  if (!leaseAdquirido) {
    throw new Error("Outro processo está alterando os canais deste calendário.");
  }
  let lease = leaseAdquirido;

  let leasePerdido = false;
  let heartbeatEmCurso: Promise<void> = Promise.resolve();
  const heartbeat = setInterval(() => {
    heartbeatEmCurso = heartbeatEmCurso
      .then(async () => {
        if (leasePerdido) return;
        const renovado = await renovarLeaseSincronizacao(lease, {
          leaseDurationMs: DURACAO_LEASE_CANAL_MS,
        });
        if (!renovado) {
          leasePerdido = true;
          return;
        }
        lease = renovado;
      })
      .catch(() => {
        leasePerdido = true;
      });
  }, INTERVALO_HEARTBEAT_CANAL_MS);
  heartbeat.unref?.();

  const exigirLease = async () => {
    await heartbeatEmCurso;
    if (leasePerdido) throw new AgendaAlphaLeaseLostError();
    await exigirLeaseSincronizacao(lease);
  };

  try {
    await exigirLease();
    return await executar(exigirLease);
  } finally {
    clearInterval(heartbeat);
    await heartbeatEmCurso;
    await liberarLeaseSincronizacao(lease).catch(() => false);
  }
}

export function gerarTokenCanalPush(): string {
  return randomBytes(32).toString("base64url");
}

export function hashTokenCanalPush(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Compara token e hash SHA-256 sem early return dependente do segredo. */
export function tokenCanalPushCorresponde(
  tokenRecebido: string,
  hashEsperado: string,
): boolean {
  const tokenLimitado =
    tokenRecebido.length <= TAMANHO_MAXIMO_TOKEN_CANAL ? tokenRecebido : "";
  const hashCalculado = Buffer.from(hashTokenCanalPush(tokenLimitado), "hex");
  const hashPersistido = Buffer.from(
    HASH_SHA256_HEX.test(hashEsperado) ? hashEsperado : "0".repeat(64),
    "hex",
  );
  return (
    timingSafeEqual(hashCalculado, hashPersistido) &&
    tokenRecebido.length > 0 &&
    tokenRecebido.length <= TAMANHO_MAXIMO_TOKEN_CANAL &&
    HASH_SHA256_HEX.test(hashEsperado)
  );
}

function urlWebhookPublica(baseUrl: string): string {
  const url = new URL("/api/calendario-alpha/webhook", baseUrl);
  if (url.protocol !== "https:") {
    throw new Error("A URL pública do webhook da Agenda Alpha deve usar HTTPS.");
  }
  return url.toString();
}

function codigoErroSeguro(erro: unknown): string {
  if (erro instanceof GoogleCalendarError) {
    return `GOOGLE_${erro.kind.toUpperCase()}`;
  }
  return "PUSH_CHANNEL_OPERATION_FAILED";
}

export async function autenticarCanalPush(input: {
  googleChannelId: string;
  channelToken: string;
  googleResourceId: string;
}): Promise<CanalPushAutenticado | null> {
  const canal = await db.googleCalendarPushChannel.findUnique({
    where: { googleChannelId: input.googleChannelId },
    select: {
      id: true,
      calendarioId: true,
      googleChannelId: true,
      googleResourceId: true,
      channelTokenHash: true,
      status: true,
      expiresAt: true,
      lastMessageNumber: true,
    },
  });

  const tokenValido = tokenCanalPushCorresponde(
    input.channelToken,
    canal?.channelTokenHash ?? HASH_DUMMY_CANAL_INEXISTENTE,
  );
  const resourceValido =
    canal !== null &&
    (canal.googleResourceId === null ||
      canal.googleResourceId === input.googleResourceId);
  if (
    !canal ||
    !["CREATING", "ACTIVE"].includes(canal.status) ||
    canal.expiresAt.getTime() <= Date.now() ||
    !tokenValido ||
    !resourceValido
  ) {
    return null;
  }

  return {
    id: canal.id,
    calendarioId: canal.calendarioId,
    googleChannelId: canal.googleChannelId,
    googleResourceId: canal.googleResourceId,
    lastMessageNumber: canal.lastMessageNumber,
  };
}

async function criarCanalPushSemLease(
  calendarioId: string,
  opcoes: CriarCanalPushOpcoes,
  exigirLease: () => Promise<void>,
): Promise<CanalPushAtivo> {
  const usuarioGoogle = await obterUsuarioGoogleAtivoPorCalendario(calendarioId);
  if (!usuarioGoogle.ok) {
    throw new Error("Calendário indisponível para criação de canal push.");
  }

  const agora = opcoes.agora?.() ?? new Date();
  const duracaoMs = opcoes.duracaoMs ?? DURACAO_CANAL_PADRAO_MS;
  const antecedencia =
    opcoes.antecedenciaRenovacaoMs ?? ANTECEDENCIA_RENOVACAO_PADRAO_MS;
  if (
    !Number.isSafeInteger(duracaoMs) ||
    duracaoMs <= 0 ||
    !Number.isSafeInteger(antecedencia) ||
    antecedencia < 0 ||
    antecedencia >= duracaoMs
  ) {
    throw new Error("Janela de expiração/renovação do canal push inválida.");
  }

  const googleChannelId = opcoes.gerarChannelId?.() ?? randomUUID();
  const token = opcoes.gerarToken?.() ?? gerarTokenCanalPush();
  if (!token || token.length > TAMANHO_MAXIMO_TOKEN_CANAL) {
    throw new Error("Token de canal push inválido.");
  }
  const expiresAtSolicitado = new Date(agora.getTime() + duracaoMs);
  const renewAfterSolicitado = new Date(
    expiresAtSolicitado.getTime() - antecedencia,
  );

  const registro = await db.googleCalendarPushChannel.create({
    data: {
      calendarioId,
      googleChannelId,
      channelTokenHash: hashTokenCanalPush(token),
      status: "CREATING",
      expiresAt: expiresAtSolicitado,
      renewAfter: renewAfterSolicitado,
    },
    select: { id: true },
  });

  let watchCriado: Awaited<ReturnType<typeof iniciarWatchEventos>> | null = null;
  try {
    await exigirLease();
    watchCriado = await iniciarWatchEventos({
      emailUsuario: usuarioGoogle.emailUsuario,
      calendarId: usuarioGoogle.googleCalendarId,
      channelId: googleChannelId,
      channelToken: token,
      webhookUrl: urlWebhookPublica(opcoes.webhookBaseUrl),
      expirationMs: expiresAtSolicitado.getTime(),
    });
    if (watchCriado.googleChannelId !== googleChannelId) {
      throw new Error("O Google devolveu um identificador de canal divergente.");
    }
    await exigirLease();

    const renewAfter = new Date(watchCriado.expiresAt.getTime() - antecedencia);
    const canal = await db.googleCalendarPushChannel.update({
      where: { id: registro.id },
      data: {
        googleResourceId: watchCriado.googleResourceId,
        resourceUri: watchCriado.resourceUri,
        status: "ACTIVE",
        expiresAt: watchCriado.expiresAt,
        renewAfter,
        activatedAt: new Date(),
        lastErrorCode: null,
        lastErrorAt: null,
      },
      select: {
        id: true,
        calendarioId: true,
        googleChannelId: true,
        expiresAt: true,
        renewAfter: true,
      },
    });
    return canal;
  } catch (erro) {
    if (watchCriado) {
      await encerrarWatchEventos({
        emailUsuario: usuarioGoogle.emailUsuario,
        channelId: watchCriado.googleChannelId,
        resourceId: watchCriado.googleResourceId,
      }).catch(() => undefined);
    }
    await db.googleCalendarPushChannel
      .updateMany({
        where: { id: registro.id, status: "CREATING" },
        data: {
          status: "ERROR",
          lastErrorCode: codigoErroSeguro(erro),
          lastErrorAt: new Date(),
        },
      })
      .catch(() => undefined);
    throw erro;
  }
}

export async function criarCanalPush(
  calendarioId: string,
  opcoes: CriarCanalPushOpcoes,
): Promise<CanalPushAtivo> {
  return executarComLeaseCanal(calendarioId, (exigirLease) =>
    criarCanalPushSemLease(calendarioId, opcoes, exigirLease),
  );
}

async function encerrarCanalPushSemLease(
  canalId: string,
  calendarioId: string,
  opcoes: { bestEffort?: boolean },
  exigirLease: () => Promise<void>,
): Promise<boolean> {
  const canal = await db.googleCalendarPushChannel.findUnique({
    where: { id: canalId },
    select: {
      id: true,
      calendarioId: true,
      googleChannelId: true,
      googleResourceId: true,
      status: true,
    },
  });
  if (!canal || canal.status === "STOPPED" || canal.status === "EXPIRED") {
    return true;
  }
  if (canal.calendarioId !== calendarioId) {
    throw new Error("Canal push mudou de calendário durante o processamento.");
  }

  const reivindicado = await db.googleCalendarPushChannel.updateMany({
    where: {
      id: canal.id,
      calendarioId,
      status: { in: ["CREATING", "ACTIVE", "ERROR"] },
    },
    data: { status: "STOPPING" },
  });
  if (reivindicado.count !== 1) {
    const atual = await db.googleCalendarPushChannel.findUnique({
      where: { id: canal.id },
      select: { status: true },
    });
    if (!atual || atual.status === "STOPPED" || atual.status === "EXPIRED") {
      return true;
    }
    if (opcoes.bestEffort) return false;
    throw new Error("Canal push não está disponível para encerramento.");
  }

  const usuarioGoogle = await obterUsuarioGoogleAtivoPorCalendario(
    calendarioId,
  );
  if (!usuarioGoogle.ok) {
    await db.googleCalendarPushChannel.updateMany({
      where: { id: canal.id, status: "STOPPING" },
      data: {
        status: "ERROR",
        lastErrorCode: "CALENDAR_NOT_ACTIVE",
        lastErrorAt: new Date(),
      },
    });
    if (opcoes.bestEffort) return false;
    throw new Error("Calendário indisponível para encerrar canal push.");
  }

  try {
    await exigirLease();
    if (canal.googleResourceId) {
      await encerrarWatchEventos({
        emailUsuario: usuarioGoogle.emailUsuario,
        channelId: canal.googleChannelId,
        resourceId: canal.googleResourceId,
      });
    }
    await exigirLease();
    const encerrado = await db.googleCalendarPushChannel.updateMany({
      where: { id: canal.id, status: "STOPPING" },
      data: {
        status: "STOPPED",
        stoppedAt: new Date(),
        lastErrorCode: null,
        lastErrorAt: null,
      },
    });
    if (encerrado.count !== 1) {
      throw new Error("Canal push mudou durante o encerramento.");
    }
    return true;
  } catch (erro) {
    await db.googleCalendarPushChannel
      .updateMany({
        where: { id: canal.id, status: "STOPPING" },
        data: {
          status: "ERROR",
          lastErrorCode: codigoErroSeguro(erro),
          lastErrorAt: new Date(),
        },
      })
      .catch(() => undefined);
    if (opcoes.bestEffort) return false;
    throw erro;
  }
}

export async function encerrarCanalPush(
  canalId: string,
  opcoes: { bestEffort?: boolean } = {},
): Promise<boolean> {
  const canal = await db.googleCalendarPushChannel.findUnique({
    where: { id: canalId },
    select: { calendarioId: true, status: true },
  });
  if (!canal || canal.status === "STOPPED" || canal.status === "EXPIRED") {
    return true;
  }
  return executarComLeaseCanal(canal.calendarioId, (exigirLease) =>
    encerrarCanalPushSemLease(
      canalId,
      canal.calendarioId,
      opcoes,
      exigirLease,
    ),
  );
}

/** Cria o novo canal antes de encerrar o antigo, preservando overlap. */
export async function renovarCanalPush(
  canalId: string,
  opcoes: CriarCanalPushOpcoes,
): Promise<CanalPushAtivo> {
  const canalAnterior = await db.googleCalendarPushChannel.findUnique({
    where: { id: canalId },
    select: { id: true, calendarioId: true },
  });
  if (!canalAnterior) throw new Error("Canal push não encontrado.");

  return executarComLeaseCanal(
    canalAnterior.calendarioId,
    async (exigirLease) => {
      const ativo = await db.googleCalendarPushChannel.findUnique({
        where: { id: canalAnterior.id },
        select: {
          id: true,
          calendarioId: true,
          status: true,
          renewAfter: true,
        },
      });
      if (
        !ativo ||
        ativo.calendarioId !== canalAnterior.calendarioId ||
        ativo.status !== "ACTIVE"
      ) {
        throw new Error("Somente canal ACTIVE pode ser renovado.");
      }
      const cas = await db.googleCalendarPushChannel.updateMany({
        where: {
          id: ativo.id,
          calendarioId: ativo.calendarioId,
          status: "ACTIVE",
          renewAfter: ativo.renewAfter,
        },
        data: { renewAfter: ativo.renewAfter },
      });
      if (cas.count !== 1) {
        throw new Error("Canal push mudou durante a renovação.");
      }
      await exigirLease();
      const novoCanal = await criarCanalPushSemLease(
        ativo.calendarioId,
        opcoes,
        exigirLease,
      );
      await encerrarCanalPushSemLease(
        ativo.id,
        ativo.calendarioId,
        { bestEffort: true },
        exigirLease,
      );
      return novoCanal;
    },
  );
}

export interface ResultadoLoteCanaisPush {
  encontrados: number;
  concluidos: number;
  falhas: number;
}

export async function renovarCanaisPushProximosExpiracao(input: {
  webhookBaseUrl: string;
  limite?: number;
  agora?: Date;
}): Promise<ResultadoLoteCanaisPush> {
  const limite = input.limite ?? 50;
  if (!Number.isInteger(limite) || limite < 1 || limite > 200) {
    throw new Error("Limite de renovação de canais inválido.");
  }
  const canais = await db.googleCalendarPushChannel.findMany({
    where: {
      status: "ACTIVE",
      renewAfter: { lte: input.agora ?? new Date() },
    },
    orderBy: { renewAfter: "asc" },
    take: limite,
    select: { id: true },
  });

  let concluidos = 0;
  let falhas = 0;
  for (const canal of canais) {
    try {
      await renovarCanalPush(canal.id, {
        webhookBaseUrl: input.webhookBaseUrl,
      });
      concluidos += 1;
    } catch {
      falhas += 1;
    }
  }
  return { encontrados: canais.length, concluidos, falhas };
}

export async function encerrarCanaisPushAtivos(
  input: { limite?: number } = {},
): Promise<ResultadoLoteCanaisPush> {
  const limite = input.limite ?? 50;
  if (!Number.isInteger(limite) || limite < 1 || limite > 200) {
    throw new Error("Limite de encerramento de canais inválido.");
  }
  const canais = await db.googleCalendarPushChannel.findMany({
    where: { status: { in: ["CREATING", "ACTIVE", "ERROR"] } },
    orderBy: { createdAt: "asc" },
    take: limite,
    select: { id: true },
  });

  let concluidos = 0;
  let falhas = 0;
  for (const canal of canais) {
    const encerrado = await encerrarCanalPush(canal.id, { bestEffort: true });
    if (encerrado) concluidos += 1;
    else falhas += 1;
  }
  return { encontrados: canais.length, concluidos, falhas };
}
