// ChatBot Alpha — formatação pura de exibição (sem I/O, sem estado, testável isoladamente)

import type { ChatbotxConversa, ChatbotxMensagem } from "@/lib/chatbot-alpha/chat-api";

export function tituloConversa(conv: ChatbotxConversa): string {
  return conv.contact?.fullName || conv.contact?.phoneNumber || conv.contact?.email || `Conversa ${conv.id}`;
}

export function ultimaMensagemConversa(conv: ChatbotxConversa): string | null {
  const ultima = conv.messages?.at(-1);
  return ultima?.text ?? null;
}

const ROTULOS_REMETENTE: Record<ChatbotxMensagem["senderType"], string> = {
  bot: "Bot",
  contact: "Contato",
  system: "Sistema",
  user: "Você",
  api: "API",
};

export function rotuloRemetente(senderType: ChatbotxMensagem["senderType"]): string {
  return ROTULOS_REMETENTE[senderType];
}

export function isMensagemDoContato(senderType: ChatbotxMensagem["senderType"]): boolean {
  return senderType === "contact";
}
