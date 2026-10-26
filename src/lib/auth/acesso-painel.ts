import db from "@/lib/prisma";
import { cache } from "react";
import { AcessoTemporariamenteIndisponivel } from "./indisponibilidade";
import type { EstadoAcessoSessao } from "./estado-acesso";
import { prazosBanco } from "@/lib/db-resilience-config";
import { registrarMetricaBanco } from "@/lib/db-observability";
import { erroTransporteBanco } from "@/lib/db-transport-error";

export const STATUS_USUARIO_ATIVO = "ATIVO";
// Transport and authorization observation are separate deadlines. An expired
// observer never releases its pending-query slot until the SDK actually settles.
export const AUTH_VALIDATION_BUDGET_MS = prazosBanco.authMs;
export const AUTH_PENDING_READ_LIMIT = 8;
export const AUTH_READ_RETRY_DELAY_MS = 50;
let pendingReads = 0;
export type TokenAcessoPainel = Record<string, unknown> & {
  id?: unknown;
  acessoBloqueado?: boolean;
  estadoAcesso?: EstadoAcessoSessao;
  statusUsuario?: string;
  authSessionVersion?: unknown;
};

export function statusPermiteAcessoPainel(status: unknown): boolean {
  return status === STATUS_USUARIO_ATIVO;
}

type EstadoAcessoPainel =
  | { estado: "PERMITIDO"; authSessionVersion: number }
  | { estado: "NEGADO" }
  | { estado: "INDISPONIVEL" };

function idValido(value: unknown): boolean {
  return (typeof value === "number" || typeof value === "string" && /^[1-9]\d*$/.test(value)) &&
    Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

// React cache shares only the current render, never a stale authorization decision.
const obterEstadoAcessoPainel = cache(async (userId: unknown): Promise<EstadoAcessoPainel> => {
  if (!idValido(userId)) return { estado: "NEGADO" };
  if (pendingReads >= AUTH_PENDING_READ_LIMIT) {
    registrarMetricaBanco({ component: "auth", phase: "admission", outcome: "saturated", pending: pendingReads, limit: AUTH_PENDING_READ_LIMIT });
    return { estado: "INDISPONIVEL" };
  }
  pendingReads++;
  const startedAt = Date.now();
  let outcome: "ok" | "denied" | "unavailable" = "unavailable";
  let expired = false;
  const expiresAt = Date.now() + AUTH_VALIDATION_BUDGET_MS;
  const budgetExpired = () => expired || Date.now() >= expiresAt;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<EstadoAcessoPainel>((resolve) => {
    timer = setTimeout(() => {
      expired = true;
      registrarMetricaBanco({ component: "auth", phase: "observer", outcome: "deadline", totalMs: Date.now() - startedAt, pending: pendingReads, observerExpired: true });
      resolve({ estado: "INDISPONIVEL" });
    }, AUTH_VALIDATION_BUDGET_MS);
  });
  const query = (async (): Promise<EstadoAcessoPainel> => {
    try {
      for (let attempt = 0; attempt < 2 && !budgetExpired(); attempt++) {
        try {
          const usuario = await db.usuarios.findUnique({
            where: { id: Number(userId) },
            select: { status: true, authSessionVersion: true },
          });
          if (budgetExpired()) return { estado: "INDISPONIVEL" };
          if (!usuario || !statusPermiteAcessoPainel(usuario.status) ||
              !Number.isSafeInteger(usuario.authSessionVersion) || usuario.authSessionVersion < 0) {
            outcome = "denied";
            return { estado: "NEGADO" };
          }
          outcome = "ok";
          return { estado: "PERMITIDO", authSessionVersion: usuario.authSessionVersion };
        } catch (error) {
          if (attempt === 0 && expiresAt - Date.now() > AUTH_READ_RETRY_DELAY_MS + 25 && erroTransporteBanco(error)) {
            await new Promise((resolve) => setTimeout(resolve, AUTH_READ_RETRY_DELAY_MS + Math.floor(Math.random() * 25)));
            continue;
          }
          return { estado: "INDISPONIVEL" };
        }
      }
      return { estado: "INDISPONIVEL" };
    } finally {
      // A timed-out observer cannot create unlimited work behind the adapter mutex.
      pendingReads--;
      registrarMetricaBanco({ component: "auth", phase: "sdk", outcome, totalMs: Date.now() - startedAt, pending: pendingReads, observerExpired: expired });
      clearTimeout(timer);
    }
  })();
  // Late outcomes are consumed, not used to authorize a request already denied.
  // Transport aborts independently when the queued SDK call reaches fetch.
  return Promise.race([query, deadline]);
});

export async function usuarioPodeAcessarPainel(userId: unknown): Promise<boolean> {
  const estado = await obterEstadoAcessoPainel(userId);
  if (estado.estado === "INDISPONIVEL") throw new AcessoTemporariamenteIndisponivel();
  return estado.estado === "PERMITIDO";
}

export function bloquearTokenAcesso<T extends TokenAcessoPainel>(token: T): T {
  return {
    ...token,
    sub: undefined,
    id: undefined,
    email: undefined,
    nome: undefined,
    usuario: undefined,
    role: undefined,
    permissoes: undefined,
    authSessionVersion: undefined,
    acessoBloqueado: true,
    estadoAcesso: "NEGADO",
  };
}

export async function revalidarTokenAcesso<T extends TokenAcessoPainel>(token: T): Promise<T & TokenAcessoPainel> {
  if (token.acessoBloqueado || !idValido(token.id) ||
      typeof token.authSessionVersion !== "number" || !Number.isSafeInteger(token.authSessionVersion) || token.authSessionVersion < 0) {
    return bloquearTokenAcesso(token);
  }
  const estado = await obterEstadoAcessoPainel(token.id);
  if (estado.estado === "INDISPONIVEL") {
    // Preserve encrypted claims, but never expose them as an authorized public user.
    return { ...token, acessoBloqueado: false, estadoAcesso: "INDISPONIVEL" };
  }
  if (estado.estado === "NEGADO" || token.authSessionVersion !== estado.authSessionVersion) {
    return bloquearTokenAcesso(token);
  }
  return {
    ...token,
    statusUsuario: STATUS_USUARIO_ATIVO,
    authSessionVersion: estado.authSessionVersion,
    acessoBloqueado: false,
    estadoAcesso: "PERMITIDO",
  };
}
