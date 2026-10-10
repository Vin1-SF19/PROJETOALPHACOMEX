"use server";

import { randomUUID } from "node:crypto";
import { auth } from "../../auth";
import db from "@/lib/prisma";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import {
  enviarMensagemConversa,
  isChatbotxConfigured,
  listarCamposFiltroContato,
  listarConversasInbox,
  listarMensagensConversa,
  obterCampoPersonalizadoContato,
  obterConversaInbox,
  type ChatbotxCampoFiltro,
  type ChatbotxConversaPublica,
  type ChatbotxFiltroContato,
  type ChatbotxMensagem,
} from "@/lib/chatbot-alpha/chat-api";

type Resultado<T> = { success: true; data: T } | { success: false; error: string; retryable: boolean; retryAfterMs?: number };
type ClienteAutorizado = { cnpj: string; campoCnpj: ChatbotxCampoFiltro };
type CursorConversas = { version: 1; formatIndex: number; cursor?: string };

function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

function formatosCnpj(valor: string): string[] {
  const original = valor.trim();
  const digitos = apenasDigitos(original);
  const formatado = digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  return [...new Set([original, digitos, formatado])];
}

function filtroPorCnpj(campo: ChatbotxCampoFiltro, valor: string): ChatbotxFiltroContato {
  return {
    operator: "and",
    conditions: [{
      field: "customField",
      customFieldId: campo.id,
      customFieldType: campo.type,
      valueType: campo.valueType,
      operator: "eq",
      value: valor,
    }],
  };
}

function lerCursor(valor?: string): CursorConversas | null {
  if (!valor) return { version: 1, formatIndex: 0 };
  try {
    const cursor = JSON.parse(valor) as CursorConversas;
    if (cursor.version !== 1 || !Number.isSafeInteger(cursor.formatIndex) || cursor.formatIndex < 0 ||
      (cursor.cursor !== undefined && typeof cursor.cursor !== "string")) return null;
    return cursor;
  } catch {
    return null;
  }
}

async function carregarCnpj(cardId: string, acao: "visualizar" | "editarCard"): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = Number(session.user.id);
  if (!Number.isSafeInteger(userId)) return null;
  await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, acao);

  const card = await db.bpmCard.findUnique({
    where: { id: cardId },
    select: { empresa: { select: { cnpj: true } } },
  });
  return card ? (card.empresa.cnpj?.trim() ?? "") : null;
}

async function clienteAutorizado(cardId: string, acao: "visualizar" | "editarCard" = "visualizar"): Promise<Resultado<ClienteAutorizado>> {
  let cnpj: string | null;
  try {
    cnpj = await carregarCnpj(cardId, acao);
  } catch {
    return { success: false, error: "Não foi possível validar o acesso ao card.", retryable: false };
  }
  if (cnpj === null) return { success: false, error: "Card não encontrado ou acesso negado.", retryable: false };
  if (apenasDigitos(cnpj).length !== 14) return { success: false, error: "O cliente do card não possui um CNPJ válido para localizar a conversa.", retryable: false };
  if (!isChatbotxConfigured()) return { success: false, error: "ChatbotX não está configurado.", retryable: false };

  const campos = await listarCamposFiltroContato(randomUUID());
  if (!campos.success) return { success: false, error: campos.error, retryable: campos.retryable, retryAfterMs: campos.retryAfterMs };
  const campoCnpj = campos.data.find((campo) => campo.name.trim().toLocaleLowerCase("pt-BR") === "cnpj");
  if (!campoCnpj) return { success: false, error: "O campo personalizado CNPJ não foi encontrado no ChatbotX.", retryable: false };
  return { success: true, data: { cnpj, campoCnpj } };
}

async function conversaDoCliente(conversationId: string, cliente: ClienteAutorizado): Promise<Resultado<ChatbotxConversaPublica>> {
  const conversa = await obterConversaInbox(conversationId, randomUUID());
  if (!conversa.success) return { success: false, error: conversa.error, retryable: conversa.retryable, retryAfterMs: conversa.retryAfterMs };
  const campo = await obterCampoPersonalizadoContato(conversa.data.contactId, cliente.campoCnpj.id, randomUUID());
  if (!campo.success) {
    if (campo.error === "Recurso não encontrado no backend ChatbotX.") {
      return { success: false, error: "Conversa não encontrada para este cliente.", retryable: false };
    }
    return { success: false, error: campo.error, retryable: campo.retryable, retryAfterMs: campo.retryAfterMs };
  }
  if (apenasDigitos(campo.data) !== apenasDigitos(cliente.cnpj)) {
    return { success: false, error: "Conversa não encontrada para este cliente.", retryable: false };
  }
  return { success: true, data: conversa.data };
}

export async function ListarConversasChatbotxDoCard(
  cardId: string,
  cursor?: string,
): Promise<Resultado<{ data: ChatbotxConversaPublica[]; nextCursor: string | null }>> {
  const autorizacao = await clienteAutorizado(cardId);
  if (!autorizacao.success) return autorizacao;
  const formatos = formatosCnpj(autorizacao.data.cnpj);
  const posicao = lerCursor(cursor);
  if (!posicao || posicao.formatIndex >= formatos.length) {
    return { success: false, error: "Cursor de conversas inválido.", retryable: false };
  }

  for (let index = posicao.formatIndex; index < formatos.length; index++) {
    const resultado = await listarConversasInbox({
      contactFilter: filtroPorCnpj(autorizacao.data.campoCnpj, formatos[index]),
      cursor: index === posicao.formatIndex ? posicao.cursor : undefined,
      perPage: 50,
    }, randomUUID());
    if (!resultado.success) return { success: false, error: resultado.error, retryable: resultado.retryable, retryAfterMs: resultado.retryAfterMs };
    const nextCursor = resultado.data.nextCursor
      ? JSON.stringify({ version: 1, formatIndex: index, cursor: resultado.data.nextCursor } satisfies CursorConversas)
      : index + 1 < formatos.length
        ? JSON.stringify({ version: 1, formatIndex: index + 1 } satisfies CursorConversas)
        : null;
    if (resultado.data.data.length || nextCursor === null || resultado.data.nextCursor) {
      return { success: true, data: { data: resultado.data.data, nextCursor } };
    }
  }
  return { success: true, data: { data: [], nextCursor: null } };
}

export async function ListarMensagensChatbotxDoCard(
  cardId: string,
  conversationId: string,
  cursor?: string,
): Promise<Resultado<{ data: ChatbotxMensagem[]; nextCursor: string | null }>> {
  const autorizacao = await clienteAutorizado(cardId);
  if (!autorizacao.success) return autorizacao;
  const conversa = await conversaDoCliente(conversationId, autorizacao.data);
  if (!conversa.success) return conversa;
  const resultado = await listarMensagensConversa(conversationId, { cursor, perPage: 50 }, randomUUID());
  if (!resultado.success) return { success: false, error: resultado.error, retryable: resultado.retryable, retryAfterMs: resultado.retryAfterMs };
  return { success: true, data: { data: resultado.data.data, nextCursor: resultado.data.nextCursor } };
}

export async function EnviarMensagemChatbotxDoCard(
  cardId: string,
  conversationId: string,
  texto: string,
  inboxId?: string,
): Promise<Resultado<void>> {
  const autorizacao = await clienteAutorizado(cardId, "editarCard");
  if (!autorizacao.success) return autorizacao;
  const conversa = await conversaDoCliente(conversationId, autorizacao.data);
  if (!conversa.success) return conversa;
  const canalPermitido = !inboxId || conversa.data.contactInboxes.some((item) => item.inboxId === inboxId);
  if (!canalPermitido) return { success: false, error: "Canal inválido para esta conversa.", retryable: false };
  const resultado = await enviarMensagemConversa({ conversationId, text: texto, inboxId }, randomUUID());
  if (!resultado.success) return { success: false, error: resultado.error, retryable: resultado.retryable, retryAfterMs: resultado.retryAfterMs };
  return { success: true, data: undefined };
}
