"use server";

// ChatBot Alpha — hub de acesso a ferramentas administrativas de infraestrutura
// (Adminer/Postgres, RedisInsight/Redis, MailHog) de um sistema ChatbotX self-hosted externo.
// Admin/CEO/TI escolhem entre os 3; usuário comum só acessa o MailHog (sem token).

import { z } from "zod";
import { auth } from "../../auth";
import { isAdminRole } from "@/lib/roles";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import {
  startOperation,
  completeOperation,
  makeOperationalError,
} from "@/lib/chatbot-alpha/observability";

const SistemaSchema = z.enum(["adminer", "redis", "mailhog"]);
export type SistemaChatBot = z.infer<typeof SistemaSchema>;

export type ResultadoUrlChatBot =
  | { success: true; url: string; correlationId: string }
  | { success: false; error: string; correlationId: string; supportId: string };

function montarUrlComToken(url: string | undefined, token: string | undefined): string | null {
  if (!url || !token) return null;
  return `${url}?token=${token}`;
}

export async function ObterUrlSistemaChatBot(sistema: SistemaChatBot): Promise<ResultadoUrlChatBot> {
  const ctx = startOperation("ObterUrlSistemaChatBot", { system: sistema });

  const parsed = SistemaSchema.safeParse(sistema);
  if (!parsed.success) {
    const entry = completeOperation(ctx, {
      status: "ERROR",
      message: "Sistema inválido",
      errorCategory: "VALIDATION",
      errorCode: "VALIDATION_ERROR",
    });
    const opErr = makeOperationalError("VALIDATION", entry.correlationId);
    return { success: false, error: opErr.message, correlationId: entry.correlationId, supportId: entry.correlationId };
  }

  const session = await auth();
  if (!session?.user) {
    const entry = completeOperation(ctx, {
      status: "DENIED",
      message: "User not authenticated",
      errorCategory: "AUTH",
      errorCode: "UNAUTHENTICATED",
    });
    const opErr = makeOperationalError("AUTH", entry.correlationId);
    return { success: false, error: opErr.message, correlationId: entry.correlationId, supportId: entry.correlationId };
  }

  ctx.userId = session.user.id;

  const role = (session.user as { role?: string }).role ?? "";
  const isAdmin = isAdminRole(role);
  if (!isAdmin) {
    let possuiPermissao = false;
    try {
      const permissoes = await getPermissoesEfetivas(Number(session.user.id));
      possuiPermissao = permissoes.includes("chatBotAlpha");
    } catch {
      possuiPermissao = false;
    }
    if (!possuiPermissao) {
      const entry = completeOperation(ctx, {
        status: "DENIED",
        message: "User lacks chatBotAlpha permission",
        errorCategory: "PERMISSION",
        errorCode: "PERMISSION_DENIED",
      });
      const opErr = makeOperationalError("PERMISSION", entry.correlationId);
      return { success: false, error: opErr.message, correlationId: entry.correlationId, supportId: entry.correlationId };
    }
  }

  if (parsed.data === "mailhog") {
    const url = process.env.BASMAILOG_URL;
    if (!url) {
      const entry = completeOperation(ctx, {
        status: "UNAVAILABLE",
        message: "MailHog URL not configured",
        errorCategory: "CONFIG",
        errorCode: "SERVICE_NOT_CONFIGURED",
      });
      const opErr = makeOperationalError("CONFIG", entry.correlationId);
      return { success: false, error: opErr.message, correlationId: entry.correlationId, supportId: entry.correlationId };
    }
    completeOperation(ctx, { status: "SUCCESS", message: "MailHog URL resolved" });
    return { success: true, url, correlationId: ctx.correlationId };
  }

  if (!isAdmin) {
    const entry = completeOperation(ctx, {
      status: "DENIED",
      message: "User lacks admin role",
      errorCategory: "PERMISSION",
      errorCode: "PERMISSION_DENIED",
    });
    const opErr = makeOperationalError("PERMISSION", entry.correlationId);
    return { success: false, error: opErr.message, correlationId: entry.correlationId, supportId: entry.correlationId };
  }

  const url =
    parsed.data === "adminer"
      ? montarUrlComToken(process.env.ADMINER_URL, process.env.ADMINER_TOKEN)
      : montarUrlComToken(process.env.REDIS_URL, process.env.REDIS_TOKEN);

  if (!url) {
    const entry = completeOperation(ctx, {
      status: "UNAVAILABLE",
      message: `${parsed.data} URL or token not configured`,
      errorCategory: "CONFIG",
      errorCode: "SERVICE_NOT_CONFIGURED",
    });
    const opErr = makeOperationalError("CONFIG", entry.correlationId);
    return { success: false, error: opErr.message, correlationId: entry.correlationId, supportId: entry.correlationId };
  }

  completeOperation(ctx, { status: "SUCCESS", message: `${parsed.data} URL resolved` });
  return { success: true, url, correlationId: ctx.correlationId };
}
