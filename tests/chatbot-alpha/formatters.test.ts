import { describe, it, expect } from "vitest";
import {
  tituloConversa,
  ultimaMensagemConversa,
  rotuloRemetente,
  isMensagemDoContato,
} from "@/lib/chatbot-alpha/formatters";
import type { ChatbotxConversa, ChatbotxMensagem } from "@/lib/chatbot-alpha/chat-api";

function conversa(overrides: Partial<ChatbotxConversa> = {}): ChatbotxConversa {
  return {
    id: "conv-1",
    contactId: "contact-1",
    workspaceId: "ws-1",
    ...overrides,
  } as ChatbotxConversa;
}

function mensagem(overrides: Partial<ChatbotxMensagem> = {}): ChatbotxMensagem {
  return {
    id: "msg-1",
    createdAt: new Date().toISOString(),
    conversationId: "conv-1",
    contactInboxId: "inbox-1",
    workspaceId: "ws-1",
    text: "olá",
    messageType: "incoming",
    contentType: "text",
    senderType: "contact",
    ...overrides,
  } as ChatbotxMensagem;
}

describe("chatbot-alpha formatters", () => {
  describe("tituloConversa", () => {
    it("usa fullName quando disponível", () => {
      expect(tituloConversa(conversa({ contact: { id: "c1", workspaceId: "ws-1", fullName: "Maria Silva" } }))).toBe(
        "Maria Silva",
      );
    });

    it("usa phoneNumber quando fullName está ausente", () => {
      expect(
        tituloConversa(conversa({ contact: { id: "c1", workspaceId: "ws-1", phoneNumber: "+5511999999999" } })),
      ).toBe("+5511999999999");
    });

    it("usa email quando fullName e phoneNumber estão ausentes", () => {
      expect(
        tituloConversa(conversa({ contact: { id: "c1", workspaceId: "ws-1", email: "maria@teste.com" } })),
      ).toBe("maria@teste.com");
    });

    it("cai para 'Conversa {id}' quando não há dados de contato", () => {
      expect(tituloConversa(conversa({ contact: null }))).toBe("Conversa conv-1");
    });

    it("cai para 'Conversa {id}' quando contact é undefined", () => {
      expect(tituloConversa(conversa({ contact: undefined }))).toBe("Conversa conv-1");
    });
  });

  describe("ultimaMensagemConversa", () => {
    it("retorna o texto da última mensagem da lista", () => {
      const conv = conversa({
        messages: [mensagem({ text: "primeira" }), mensagem({ text: "última" })],
      });
      expect(ultimaMensagemConversa(conv)).toBe("última");
    });

    it("retorna null quando não há mensagens", () => {
      expect(ultimaMensagemConversa(conversa({ messages: [] }))).toBeNull();
    });

    it("retorna null quando messages é undefined", () => {
      expect(ultimaMensagemConversa(conversa({ messages: undefined }))).toBeNull();
    });
  });

  describe("rotuloRemetente", () => {
    it("mapeia cada senderType para o rótulo em português", () => {
      expect(rotuloRemetente("bot")).toBe("Bot");
      expect(rotuloRemetente("contact")).toBe("Contato");
      expect(rotuloRemetente("system")).toBe("Sistema");
      expect(rotuloRemetente("user")).toBe("Você");
      expect(rotuloRemetente("api")).toBe("API");
    });
  });

  describe("isMensagemDoContato", () => {
    it("retorna true somente para senderType 'contact'", () => {
      expect(isMensagemDoContato("contact")).toBe(true);
      expect(isMensagemDoContato("bot")).toBe(false);
      expect(isMensagemDoContato("user")).toBe(false);
      expect(isMensagemDoContato("system")).toBe(false);
      expect(isMensagemDoContato("api")).toBe(false);
    });
  });
});
