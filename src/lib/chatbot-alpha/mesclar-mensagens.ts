import type { ChatbotxMensagem } from "./chat-api";

/** Mescla páginas recebidas da mais recente para a mais antiga sem perder o histórico já carregado. */
export function mesclarMensagens(
  atuais: ChatbotxMensagem[],
  paginaMaisRecentesPrimeiro: ChatbotxMensagem[],
): ChatbotxMensagem[] {
  const porId = new Map(atuais.map((mensagem) => [mensagem.id, mensagem]));
  for (const mensagem of paginaMaisRecentesPrimeiro) porId.set(mensagem.id, mensagem);
  return [...porId.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}
