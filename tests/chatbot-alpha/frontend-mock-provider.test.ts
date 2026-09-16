import { describe, expect, it, vi } from "vitest";
import { MockChatbotProvider, __testing } from "@/services/chatbot/mock-provider";

describe("ChatBot Alpha mock provider", () => {
  it("busca, filtra, ordena e pagina cópias dos dados", async () => {
    const provider = new MockChatbotProvider();
    const result = await provider.listConversations({ search: "ajuda", status: "pending", page: 1, limit: 2, sort: "recent" });
    expect(result.page).toBe(1);
    expect(result.limit).toBe(2);
    expect(result.total).toBeGreaterThan(0);
    expect(result.items.every((item) => item.status === "pending")).toBe(true);
    const contacts = await provider.listContacts({ search: "Contato Demo", sort: "name" });
    expect(contacts.items[0]?.name).toContain("Contato Demo");
  });

  it("envia mensagem e atualiza preview sem rede", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const provider = new MockChatbotProvider();
    const conversation = (await provider.listConversations()).items[0];
    const message = await provider.sendMessage(conversation.id, "Mensagem de teste");
    const updated = await provider.getConversation(conversation.id);
    expect(message.direction).toBe("outgoing");
    expect(updated.lastMessage).toBe("Mensagem de teste");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("gera IDs únicos em envios concorrentes no mesmo milissegundo", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const provider = new MockChatbotProvider();
    const conversation = (await provider.listConversations()).items[0];

    try {
      const messages = await Promise.all([
        provider.sendMessage(conversation.id, "Mensagem simultânea 1"),
        provider.sendMessage(conversation.id, "Mensagem simultânea 2"),
        provider.sendMessage(conversation.id, "Mensagem simultânea 3"),
      ]);

      expect(messages.map((message) => message.id)).toEqual([
        "message-local-1700000000000-1",
        "message-local-1700000000000-2",
        "message-local-1700000000000-3",
      ]);
      expect(new Set(messages.map((message) => message.id))).toHaveLength(messages.length);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("faz upsert das entidades sem alterar uma nova instância", async () => {
    const first = new MockChatbotProvider();
    const second = new MockChatbotProvider();
    const agent = (await first.listAgents()).items[0];
    await first.saveAgent({ ...agent, name: "Agente editado" });
    expect((await first.listAgents({ search: "editado" })).total).toBe(1);
    expect((await second.listAgents({ search: "editado" })).total).toBe(0);
  });

  it("não muta a entrada ao paginar", async () => {
    const agents = (await new MockChatbotProvider().listAgents()).items;
    const items = [
      { ...agents[0], id: "2", name: "Beta" },
      { ...agents[1], id: "1", name: "Alpha" },
    ];
    const before = structuredClone(items);
    expect(__testing.paginate(items, { sort: "name" }).items[0]?.name).toBe("Alpha");
    expect(items).toEqual(before);
  });

  it("permite simular e recuperar um estado de erro", async () => {
    const provider = new MockChatbotProvider({ fail: true });
    await expect(provider.loadSnapshot()).rejects.toMatchObject({ code: "simulated" });
    provider.setFailureMode(false);
    await expect(provider.loadSnapshot()).resolves.toMatchObject({ conversations: expect.any(Array) });
  });

  it("hidrata uma cópia completa somente pela operação assíncrona", async () => {
    const provider = new MockChatbotProvider({ delayMs: 1 });
    const pending = provider.loadSnapshot();
    expect(pending).toBeInstanceOf(Promise);
    const first = await pending;
    first.contacts.length = 0;
    expect((await provider.loadSnapshot()).contacts.length).toBeGreaterThan(0);
  });

  it("mantém fixtures inequivocamente sintéticas e não discáveis", async () => {
    const contacts = (await new MockChatbotProvider().listContacts({ limit: 100 })).items;
    expect(contacts).not.toHaveLength(0);
    expect(contacts.every((contact) => contact.name.startsWith("Contato Demo "))).toBe(true);
    expect(contacts.every((contact) => contact.phone?.startsWith("SYNTHETIC-NON-DIALABLE-"))).toBe(true);
    expect(contacts.every((contact) => contact.email?.endsWith("@example.com"))).toBe(true);
  });

  it("rejeita mensagens excessivas, paginação abusiva e mutações fora dos limites", async () => {
    const provider = new MockChatbotProvider();
    const conversation = (await provider.listConversations()).items[0];
    const agent = (await provider.listAgents()).items[0];
    await expect(provider.sendMessage(conversation.id, "x".repeat(8_001))).rejects.toMatchObject({ code: "invalid" });
    await expect(provider.listContacts({ limit: 101 })).rejects.toMatchObject({ code: "invalid" });
    await expect(provider.saveAgent({ ...agent, temperature: Number.POSITIVE_INFINITY })).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejeita campos inesperados e valores de enum forjados", async () => {
    const provider = new MockChatbotProvider();
    const contact = (await provider.listContacts()).items[0];
    await expect(provider.updateContact(contact.id, { name: "Teste", admin: true } as never)).rejects.toMatchObject({ code: "invalid" });
    await expect(provider.updateIntegration("integration-1", "compromised" as never)).rejects.toMatchObject({ code: "invalid" });
  });
});
