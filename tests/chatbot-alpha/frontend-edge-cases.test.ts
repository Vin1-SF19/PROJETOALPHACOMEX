import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CHATBOT_NAVIGATION } from "@/components/ChatBotAlpha/shell/navigation";
import { createChatbotMockSnapshot } from "@/mocks/chatbot/data";
import {
  campaignSchema,
  chatbotFlowSchema,
  chatbotSettingsSchema,
  createChatbotService,
  messageBodySchema,
  sequenceSchema,
} from "@/services/chatbot";
import { MockChatbotProvider } from "@/services/chatbot/mock-provider";
import { removeFlowNode, validateChatbotFlow } from "@/services/chatbot/flow-validation";
import { applyChatbotRealtimeEvent, createChatbotStore } from "@/store/useChatbotStore";
import type { ChatbotRealtimeEvent, Message } from "@/types/chatbot";

describe("ChatBot Alpha provider boundaries", () => {
  it("mantém o provider de API desabilitado e não tenta transporte externo", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(() => createChatbotService("api")).toThrow(/futuro.*não está implementado/i);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("normaliza recursos ausentes e rejeita filtros fora do contrato", async () => {
    const provider = new MockChatbotProvider();
    await expect(provider.getConversation("conversation-missing")).rejects.toMatchObject({ code: "not-found" });
    await expect(provider.updateContact("contact-missing", { name: "Contato sintético" })).rejects.toMatchObject({ code: "not-found" });
    await expect(provider.listConversations({ page: 0 })).rejects.toMatchObject({ code: "invalid" });
    await expect(provider.listConversations({ search: "x".repeat(201) })).rejects.toMatchObject({ code: "invalid" });
  });

  it("recupera o mesmo store por retry após falha de hidratação", async () => {
    const provider = new MockChatbotProvider({ fail: true });
    const loadSpy = vi.spyOn(provider, "loadSnapshot");
    const store = createChatbotStore(provider);

    await expect(store.getState().initialize()).rejects.toMatchObject({ code: "simulated" });
    provider.setFailureMode(false);
    await store.getState().retry();

    expect(loadSpy).toHaveBeenCalledTimes(2);
    expect(store.getState()).toMatchObject({ loadState: "success", error: null, isBusy: false });
  });

  it("deduplica inicializações concorrentes no acesso ao provider", async () => {
    const provider = new MockChatbotProvider({ delayMs: 10 });
    const loadSpy = vi.spyOn(provider, "loadSnapshot");
    const store = createChatbotStore(provider);

    const first = store.getState().initialize();
    const second = store.getState().initialize();
    await Promise.all([first, second]);

    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(store.getState().loadState).toBe("success");
  });
});

describe("ChatBot Alpha realtime idempotency", () => {
  it("não muta o snapshot de entrada e repetições convergem para o mesmo estado", () => {
    const original = createChatbotMockSnapshot();
    const baseline = structuredClone(original);
    const message: Message = {
      id: "message-idempotent",
      conversationId: original.conversations[0].id,
      direction: "incoming",
      body: "Evento sintético",
      createdAt: "2026-09-15T14:00:00.000Z",
      status: "received",
      senderName: "Contato Demo",
    };
    const events: ChatbotRealtimeEvent[] = [
      { type: "message.created", payload: message },
      { type: "message.updated", payload: { id: message.id, body: "Evento consolidado" } },
      { type: "message.delivered", payload: { id: message.id, conversationId: message.conversationId } },
      { type: "message.read", payload: { id: message.id, conversationId: message.conversationId } },
    ];

    const once = events.reduce(applyChatbotRealtimeEvent, original);
    const twice = events.reduce(applyChatbotRealtimeEvent, once);

    expect(original).toEqual(baseline);
    expect(twice).toEqual(once);
    expect(twice.messages.filter((item) => item.id === message.id)).toHaveLength(1);
  });

  it("ignora updates de entidades desconhecidas sem criar registros parciais", () => {
    const snapshot = createChatbotMockSnapshot();
    const updated = applyChatbotRealtimeEvent(snapshot, {
      type: "conversation.updated",
      payload: { id: "conversation-unknown", status: "resolved" },
    });

    expect(updated.conversations).toHaveLength(snapshot.conversations.length);
    expect(updated.conversations.some((item) => item.id === "conversation-unknown")).toBe(false);
  });
});

describe("ChatBot Alpha flow and schema guards", () => {
  it("remove node ausente sem mutar o grafo e remove todas as arestas incidentes", () => {
    const flow = createChatbotMockSnapshot().flows[0];
    const baseline = structuredClone(flow);
    const unchanged = removeFlowNode(flow, "node-missing");
    const removed = removeFlowNode(flow, "node-message");

    expect(flow).toEqual(baseline);
    expect(unchanged).toEqual(flow);
    expect(removed.edges.every((edge) => edge.source !== "node-message" && edge.target !== "node-message")).toBe(true);
  });

  it("distingue fluxo vazio de node órfão e mantém mensagens determinísticas", () => {
    const flow = { ...createChatbotMockSnapshot().flows[1], nodes: [], edges: [] };
    const result = validateChatbotFlow(flow);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([{ code: "missing-trigger", message: "Adicione um node de início ao fluxo." }]);
  });

  it("rejeita inconsistências de schemas operacionais nas fronteiras", () => {
    const snapshot = createChatbotMockSnapshot();
    const invalidFlow = structuredClone(snapshot.flows[0]);
    invalidFlow.nodes[0].data.kind = "wait";
    const invalidSequence = { ...snapshot.sequences[0], steps: snapshot.sequences[0].steps.map((step) => ({ ...step, order: 2 })) };
    const invalidCampaign = { ...snapshot.campaigns[1], delivered: snapshot.campaigns[1].sent + 1 };

    expect(chatbotFlowSchema.safeParse(invalidFlow).success).toBe(false);
    expect(sequenceSchema.safeParse(invalidSequence).success).toBe(false);
    expect(campaignSchema.safeParse(invalidCampaign).success).toBe(false);
    expect(chatbotSettingsSchema.safeParse({ ...snapshot.settings, queueLimit: 0 }).success).toBe(false);
    expect(messageBodySchema.safeParse("   ").success).toBe(false);
    expect(messageBodySchema.parse("  mensagem válida  ")).toBe("mensagem válida");
  });
});

describe("ChatBot Alpha route structure", () => {
  it("possui rotas únicas, internas e materializadas para as dez seções", () => {
    const items = CHATBOT_NAVIGATION.flatMap((group) => group.items);
    const hrefs = items.map((item) => item.href);

    expect(new Set(hrefs).size).toBe(10);
    for (const href of hrefs) {
      expect(href).toMatch(/^\/PainelAlpha\/ChatBotAlpha\/[a-z-]+$/);
      const relative = href.replace("/PainelAlpha/ChatBotAlpha/", "");
      expect(statSync(join("src/app/PainelAlpha/ChatBotAlpha", relative, "page.tsx")).isFile()).toBe(true);
    }
  });

  it("centraliza autenticação/permissão no layout e mantém a raiz como redirect", () => {
    const layout = readFileSync("src/app/PainelAlpha/ChatBotAlpha/layout.tsx", "utf8");
    const rootPage = readFileSync("src/app/PainelAlpha/ChatBotAlpha/page.tsx", "utf8");

    expect(layout).toContain("await auth()");
    expect(layout).toContain("getPermissoesEfetivas");
    expect(layout).toContain('permissions.includes("chatBotAlpha")');
    expect(layout).toContain("isAdminRole");
    expect(rootPage).toContain('redirect("/PainelAlpha/ChatBotAlpha/dashboard")');
    expect(rootPage).not.toMatch(/ChatBotAlphaChat|chat-api|fetch\s*\(/);
  });
});
