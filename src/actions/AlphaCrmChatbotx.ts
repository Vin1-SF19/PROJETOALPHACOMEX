"use server";

import { randomUUID } from "node:crypto";
import { auth } from "../../auth";
import db from "@/lib/prisma";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import {
  enviarMensagemConversa,
  isChatbotxConfigured,
  listarConversasInbox,
  listarMensagensConversa,
  obterConversaInbox,
  type ChatbotxConversaPublica,
  type ChatbotxMensagem,
} from "@/lib/chatbot-alpha/chat-api";

type Resultado<T> = { success: true; data: T } | { success: false; error: string; retryable: boolean };
type IdentidadeCliente = { nomes: string[]; telefones: string[]; emails: string[] };

function normalizar(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]/g, "");
}

function contatoCorresponde(conversa: ChatbotxConversaPublica, identidade: IdentidadeCliente): boolean {
  const contato = conversa.contact;
  if (!contato) return false;
  const nomeContato = normalizar(contato.fullName || [contato.firstName, contato.lastName].filter(Boolean).join(" "));
  const telefoneContato = (contato.phoneNumber ?? "").replace(/\D/g, "");
  const emailContato = (contato.email ?? "").trim().toLocaleLowerCase("pt-BR");
  return identidade.nomes.some((nome) => {
    const nomeNormalizado = normalizar(nome);
    return nomeNormalizado.length >= 4 && nomeContato.length >= 4 && (nomeContato.includes(nomeNormalizado) || nomeNormalizado.includes(nomeContato));
  }) || identidade.telefones.some((telefone) => { const valor = telefone.replace(/\D/g, ""); return valor.length >= 8 && telefoneContato.endsWith(valor.slice(-8)); })
    || identidade.emails.some((email) => email.toLocaleLowerCase("pt-BR") === emailContato);
}

async function carregarIdentidade(cardId: string, acao: "visualizar" | "editarCard"): Promise<IdentidadeCliente | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = Number(session.user.id);
  if (!Number.isSafeInteger(userId)) return null;
  await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, acao);

  const card = await db.bpmCard.findUnique({
    where: { id: cardId },
    select: {
      empresa: { select: { razaoSocial: true, nomeFantasia: true } },
      empresaId: true,
    },
  });
  if (!card) return null;
  const pessoas = await db.pessoaClienteVinculo.findMany({
    where: { clienteId: card.empresaId },
    select: { pessoa: { select: { nome: true, celular: true, email: true } } },
  });
  return {
    nomes: [card.empresa.razaoSocial, card.empresa.nomeFantasia, ...pessoas.map(({ pessoa }) => pessoa.nome)].filter((value): value is string => Boolean(value?.trim())),
    telefones: pessoas.map(({ pessoa }) => pessoa.celular).filter((value): value is string => Boolean(value?.trim())),
    emails: pessoas.map(({ pessoa }) => pessoa.email).filter((value): value is string => Boolean(value?.trim())),
  };
}

async function identidadeAutorizada(cardId: string, acao: "visualizar" | "editarCard" = "visualizar"): Promise<Resultado<IdentidadeCliente>> {
  try {
    const identidade = await carregarIdentidade(cardId, acao);
    if (!identidade) return { success: false, error: "Card não encontrado ou acesso negado.", retryable: false };
    if (!isChatbotxConfigured()) return { success: false, error: "ChatbotX não está configurado.", retryable: false };
    return { success: true, data: identidade };
  } catch {
    return { success: false, error: "Não foi possível validar o acesso ao card.", retryable: false };
  }
}

export async function ListarConversasChatbotxDoCard(
  cardId: string,
  cursor?: string,
): Promise<Resultado<{ data: ChatbotxConversaPublica[]; nextCursor: string | null }>> {
  const autorizacao = await identidadeAutorizada(cardId);
  if (!autorizacao.success) return autorizacao;
  const keyword = autorizacao.data.nomes[0];
  if (!keyword) return { success: true, data: { data: [], nextCursor: null } };
  const resultado = await listarConversasInbox({ keyword, cursor, perPage: 50 }, randomUUID());
  if (!resultado.success) return { success: false, error: resultado.error, retryable: resultado.retryable };
  return { success: true, data: { data: resultado.data.data.filter((conversa) => contatoCorresponde(conversa, autorizacao.data)), nextCursor: resultado.data.nextCursor } };
}

export async function ListarMensagensChatbotxDoCard(
  cardId: string,
  conversationId: string,
  cursor?: string,
): Promise<Resultado<{ data: ChatbotxMensagem[]; nextCursor: string | null }>> {
  const autorizacao = await identidadeAutorizada(cardId);
  if (!autorizacao.success) return autorizacao;
  const conversa = await obterConversaInbox(conversationId, randomUUID());
  if (!conversa.success) return { success: false, error: conversa.error, retryable: conversa.retryable };
  if (!contatoCorresponde(conversa.data, autorizacao.data)) return { success: false, error: "Conversa não encontrada para este cliente.", retryable: false };
  const resultado = await listarMensagensConversa(conversationId, { cursor, perPage: 50 }, randomUUID());
  if (!resultado.success) return { success: false, error: resultado.error, retryable: resultado.retryable };
  return { success: true, data: { data: resultado.data.data, nextCursor: resultado.data.nextCursor } };
}

export async function EnviarMensagemChatbotxDoCard(
  cardId: string,
  conversationId: string,
  texto: string,
  inboxId?: string,
): Promise<Resultado<void>> {
  const autorizacao = await identidadeAutorizada(cardId, "editarCard");
  if (!autorizacao.success) return autorizacao;
  const conversa = await obterConversaInbox(conversationId, randomUUID());
  if (!conversa.success) return { success: false, error: conversa.error, retryable: conversa.retryable };
  if (!contatoCorresponde(conversa.data, autorizacao.data)) return { success: false, error: "Conversa não encontrada para este cliente.", retryable: false };
  const canalPermitido = !inboxId || conversa.data.contactInboxes.some((item) => item.inboxId === inboxId);
  if (!canalPermitido) return { success: false, error: "Canal inválido para esta conversa.", retryable: false };
  const resultado = await enviarMensagemConversa({ conversationId, text: texto, inboxId }, randomUUID());
  if (!resultado.success) return { success: false, error: resultado.error, retryable: resultado.retryable };
  return { success: true, data: undefined };
}
