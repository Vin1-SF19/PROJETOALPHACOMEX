import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  acesso: vi.fn(),
  findCard: vi.fn(),
  configured: vi.fn(),
  fields: vi.fn(),
  conversations: vi.fn(),
  conversation: vi.fn(),
  contactField: vi.fn(),
  messages: vi.fn(),
  send: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ default: { bpmCard: { findUnique: mocks.findCard } } }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: mocks.acesso }));
vi.mock("@/lib/chatbot-alpha/chat-api", () => ({
  isChatbotxConfigured: mocks.configured,
  listarCamposFiltroContato: mocks.fields,
  listarConversasInbox: mocks.conversations,
  obterConversaInbox: mocks.conversation,
  obterCampoPersonalizadoContato: mocks.contactField,
  listarMensagensConversa: mocks.messages,
  enviarMensagemConversa: mocks.send,
}));

import {
  EnviarMensagemChatbotxDoCard,
  ListarConversasChatbotxDoCard,
  ListarMensagensChatbotxDoCard,
} from "@/actions/AlphaCrmChatbotx";

const campoCnpj = { id: "12", name: "CNPJ", type: "text", valueType: "text" };
const conversa = { id: "99", contactId: "88", contactInboxes: [{ inboxId: "77" }], messages: [] };

describe("chat do card Alpha CRM por CNPJ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "10", role: "CLOSER" } });
    mocks.acesso.mockResolvedValue(undefined);
    mocks.findCard.mockResolvedValue({ empresa: { cnpj: "44342670000161" } });
    mocks.configured.mockReturnValue(true);
    mocks.fields.mockResolvedValue({ success: true, data: [campoCnpj] });
    mocks.conversation.mockResolvedValue({ success: true, data: conversa });
    mocks.contactField.mockResolvedValue({ success: true, data: "44.342.670/0001-61" });
    mocks.messages.mockResolvedValue({ success: true, data: { data: [], nextCursor: null } });
    mocks.send.mockResolvedValue({ success: true, data: undefined });
  });

  it("filtra pelo campo personalizado e tenta o CNPJ com máscara quando necessário", async () => {
    mocks.conversations
      .mockResolvedValueOnce({ success: true, data: { data: [], nextCursor: null } })
      .mockResolvedValueOnce({ success: true, data: { data: [conversa], nextCursor: null } });

    const primeira = await ListarConversasChatbotxDoCard("card-1");
    expect(primeira).toMatchObject({ success: true, data: { data: [conversa], nextCursor: null } });
    expect(mocks.conversations.mock.calls[0][0].contactFilter).toEqual({
      operator: "and",
      conditions: [{
        field: "customField",
        customFieldId: "12",
        customFieldType: "text",
        valueType: "text",
        operator: "eq",
        value: "44342670000161",
      }],
    });
    expect(mocks.conversations.mock.calls[1][0].contactFilter.conditions[0].value).toBe("44.342.670/0001-61");
  });

  it("permite ler histórico quando o CNPJ do contato corresponde ao card", async () => {
    const resultado = await ListarMensagensChatbotxDoCard("card-1", "99");
    expect(resultado.success).toBe(true);
    expect(mocks.contactField).toHaveBeenCalledWith("88", "12", expect.any(String));
    expect(mocks.messages).toHaveBeenCalledWith("99", { cursor: undefined, perPage: 50 }, expect.any(String));
  });

  it("bloqueia envio se o CNPJ do contato for de outra empresa", async () => {
    mocks.contactField.mockResolvedValue({ success: true, data: "00000000000000" });
    const resultado = await EnviarMensagemChatbotxDoCard("card-1", "99", "Olá", "77");
    expect(resultado).toMatchObject({ success: false, error: "Conversa não encontrada para este cliente." });
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
