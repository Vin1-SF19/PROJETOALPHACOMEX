"use server";

// ChatBot Alpha — Server actions para chat (proxy para backend ChatbotX, workspace-token API)
// Autenticação e autorização verificadas no servidor; tokens nunca expostos ao cliente.

import { z } from "zod";
import { auth } from "../../auth";
import { isAdminRole } from "@/lib/roles";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import {
  isChatbotxConfigured,
  listarConversas,
  listarMensagens,
  enviarMensagem,
  identificadorPorId,
  chatbotxListarConversasInputSchema,
  type ChatbotxMensagem,
  type ChatbotxPagina,
  type ChatbotxPaginaConversas,
} from "@/lib/chatbot-alpha/chat-api";
import {
  startOperation,
  completeOperation,
  makeOperationalError,
} from "@/lib/chatbot-alpha/observability";

// ─── Helpers de auth ──────────────────────────────────────────────────────────

async function verificarAcessoChatbotAlpha(): Promise<{ ok: true; userId: string } | { ok: false; error: string; correlationId: string }> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Não autenticado.", correlationId: crypto.randomUUID() };
  }

  const userId = session.user.id;
  const role = (session.user as { role?: string }).role ?? "";

  if (isAdminRole(role)) return { ok: true, userId };

  try {
    const permissoes = await getPermissoesEfetivas(Number(userId));
    if (permissoes.includes("chatBotAlpha")) return { ok: true, userId };
  } catch { /* sem permissões */ }

  return { ok: false, error: "Sem permissão para acessar o ChatBot Alpha.", correlationId: crypto.randomUUID() };
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export type ResultadoChatbotx<T> =
  | { success: true; data: T; correlationId: string }
  | { success: false; error: string; correlationId: string; supportId: string; retryable: boolean };

export async function ListarConversasChatbotx(
  filtro: {
    keyword?: string;
    page?: number;
  } = {},
): Promise<ResultadoChatbotx<ChatbotxPaginaConversas>> {
  const ctx = startOperation("ListarConversasChatbotx", { system: "chat" });

  const parsed = chatbotxListarConversasInputSchema.safeParse(filtro);
  if (!parsed.success) {
    const entry = completeOperation(ctx, { status: "ERROR", message: "Filtro inválido", errorCategory: "VALIDATION", errorCode: "VALIDATION_ERROR" });
    const opErr = makeOperationalError("VALIDATION", entry.correlationId);
    return { success: false, error: opErr.message, correlationId: entry.correlationId, supportId: entry.correlationId, retryable: false };
  }

  const acesso = await verificarAcessoChatbotAlpha();
  if (!acesso.ok) {
    const entry = completeOperation(ctx, { status: "DENIED", message: acesso.error, errorCategory: "AUTH", errorCode: "PERMISSION_DENIED" });
    const opErr = makeOperationalError("AUTH", entry.correlationId);
    return { success: false, error: opErr.message, correlationId: entry.correlationId, supportId: entry.correlationId, retryable: false };
  }

  if (!isChatbotxConfigured()) {
    const entry = completeOperation(ctx, { status: "UNAVAILABLE", message: "Backend não configurado", errorCategory: "CONFIG", errorCode: "SERVICE_NOT_CONFIGURED" });
    const opErr = makeOperationalError("CONFIG", entry.correlationId);
    return { success: false, error: opErr.message, correlationId: entry.correlationId, supportId: entry.correlationId, retryable: false };
  }

  const resultado = await listarConversas(parsed.data, ctx.correlationId);
  if (resultado.success) {
    completeOperation(ctx, { status: "SUCCESS", message: `${resultado.data.data.length} conversas` });
    return { success: true, data: resultado.data, correlationId: ctx.correlationId };
  }

  const entry = completeOperation(ctx, { status: "ERROR", message: resultado.error, errorCategory: "EXTERNAL_UNAVAILABLE", errorCode: "SERVICE_UNAVAILABLE" });
  const opErr = makeOperationalError("EXTERNAL_UNAVAILABLE", entry.correlationId);
  return { success: false, error: opErr.message, correlationId: entry.correlationId, supportId: entry.correlationId, retryable: resultado.retryable };
}

export async function ListarMensagensChatbotx(
  contactId: string,
  opcoes: { cursor?: string } = {},
): Promise<ResultadoChatbotx<ChatbotxPagina<ChatbotxMensagem>>> {
  const ctx = startOperation("ListarMensagensChatbotx", { system: "chat" });

  const parsedContactId = z.string().min(1).safeParse(contactId);
  if (!parsedContactId.success) {
    const entry = completeOperation(ctx, { status: "ERROR", message: "Contato inválido", errorCategory: "VALIDATION", errorCode: "VALIDATION_ERROR" });
    const opErr = makeOperationalError("VALIDATION", entry.correlationId);
    return { success: false, error: opErr.message, correlationId: entry.correlationId, supportId: entry.correlationId, retryable: false };
  }

  const acesso = await verificarAcessoChatbotAlpha();
  if (!acesso.ok) {
    const entry = completeOperation(ctx, { status: "DENIED", message: acesso.error, errorCategory: "AUTH", errorCode: "PERMISSION_DENIED" });
    const opErr = makeOperationalError("AUTH", entry.correlationId);
    return { success: false, error: opErr.message, correlationId: entry.correlationId, supportId: entry.correlationId, retryable: false };
  }

  if (!isChatbotxConfigured()) {
    const entry = completeOperation(ctx, { status: "UNAVAILABLE", message: "Backend não configurado", errorCategory: "CONFIG", errorCode: "SERVICE_NOT_CONFIGURED" });
    const opErr = makeOperationalError("CONFIG", entry.correlationId);
    return { success: false, error: opErr.message, correlationId: entry.correlationId, supportId: entry.correlationId, retryable: false };
  }

  const resultado = await listarMensagens(
    { contatoIdentifier: identificadorPorId(parsedContactId.data), cursor: opcoes.cursor },
    ctx.correlationId,
  );
  if (resultado.success) {
    completeOperation(ctx, { status: "SUCCESS", message: `${resultado.data.data.length} mensagens` });
    return { success: true, data: resultado.data, correlationId: ctx.correlationId };
  }

  const entry = completeOperation(ctx, { status: "ERROR", message: resultado.error, errorCategory: "EXTERNAL_UNAVAILABLE", errorCode: "SERVICE_UNAVAILABLE" });
  const opErr = makeOperationalError("EXTERNAL_UNAVAILABLE", entry.correlationId);
  return { success: false, error: opErr.message, correlationId: entry.correlationId, supportId: entry.correlationId, retryable: resultado.retryable };
}

export async function EnviarMensagemChatbotx(contactId: string, texto: string): Promise<ResultadoChatbotx<void>> {
  const ctx = startOperation("EnviarMensagemChatbotx", { system: "chat" });

  const parsed = z.object({
    contactId: z.string().min(1),
    texto: z.string().trim().min(1).max(1000),
  }).safeParse({ contactId, texto });

  if (!parsed.success) {
    const entry = completeOperation(ctx, { status: "ERROR", message: "Mensagem inválida", errorCategory: "VALIDATION", errorCode: "VALIDATION_ERROR" });
    const opErr = makeOperationalError("VALIDATION", entry.correlationId);
    return { success: false, error: opErr.message, correlationId: entry.correlationId, supportId: entry.correlationId, retryable: false };
  }

  const acesso = await verificarAcessoChatbotAlpha();
  if (!acesso.ok) {
    const entry = completeOperation(ctx, { status: "DENIED", message: acesso.error, errorCategory: "AUTH", errorCode: "PERMISSION_DENIED" });
    const opErr = makeOperationalError("AUTH", entry.correlationId);
    return { success: false, error: opErr.message, correlationId: entry.correlationId, supportId: entry.correlationId, retryable: false };
  }

  if (!isChatbotxConfigured()) {
    const entry = completeOperation(ctx, { status: "UNAVAILABLE", message: "Backend não configurado", errorCategory: "CONFIG", errorCode: "SERVICE_NOT_CONFIGURED" });
    const opErr = makeOperationalError("CONFIG", entry.correlationId);
    return { success: false, error: opErr.message, correlationId: entry.correlationId, supportId: entry.correlationId, retryable: false };
  }

  const resultado = await enviarMensagem(
    { contatoIdentifier: identificadorPorId(parsed.data.contactId), text: parsed.data.texto },
    ctx.correlationId,
  );
  if (resultado.success) {
    completeOperation(ctx, { status: "SUCCESS", message: "Mensagem enviada" });
    return { success: true, data: undefined, correlationId: ctx.correlationId };
  }

  const entry = completeOperation(ctx, { status: "ERROR", message: resultado.error, errorCategory: "EXTERNAL_UNAVAILABLE", errorCode: "SERVICE_UNAVAILABLE" });
  const opErr = makeOperationalError("EXTERNAL_UNAVAILABLE", entry.correlationId);
  return { success: false, error: opErr.message, correlationId: entry.correlationId, supportId: entry.correlationId, retryable: resultado.retryable };
}
