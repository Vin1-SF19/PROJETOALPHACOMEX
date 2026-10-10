import { describe, expect, it } from "vitest";
import type { ChatbotxMensagem } from "@/lib/chatbot-alpha/chat-api";
import { mesclarMensagens } from "@/lib/chatbot-alpha/mesclar-mensagens";

function mensagem(id: string, createdAt: string): ChatbotxMensagem {
  return {
    id,
    createdAt,
    conversationId: "1",
    contactInboxId: "2",
    messageType: "incoming",
    senderType: "contact",
    text: id,
  };
}

describe("mesclar mensagens do Inbox", () => {
  it("adiciona respostas recentes sem perder páginas antigas nem duplicar IDs", () => {
    const antiga = mensagem("101", "2026-10-09T10:00:00.000Z");
    const atual = mensagem("102", "2026-10-09T10:01:00.000Z");
    const nova = mensagem("103", "2026-10-09T10:02:00.000Z");
    const resultado = mesclarMensagens([antiga, atual], [nova, atual]);
    expect(resultado.map((item) => item.id)).toEqual(["101", "102", "103"]);
  });

  it("ordena uma página recebida da mais recente para a mais antiga", () => {
    const antiga = mensagem("9007199254740993", "2026-10-09T10:00:00.000Z");
    const nova = mensagem("9007199254740994", "2026-10-09T10:01:00.000Z");
    expect(mesclarMensagens([], [nova, antiga]).map((item) => item.id)).toEqual([antiga.id, nova.id]);
  });
});
