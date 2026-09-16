import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const CHATBOT_SOURCE_ROOTS = [
  "src/app/PainelAlpha/ChatBotAlpha",
  "src/components/ChatBotAlpha",
  "src/mocks/chatbot",
  "src/services/chatbot",
  "src/store/useChatbotStore.ts",
];

function filesIn(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap((name) => filesIn(join(path, name)));
}

describe.sequential("ChatBot Alpha sem structuredClone nativo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("importa, carrega, envia, atualiza o store e manipula fluxo pelo fallback", async () => {
    vi.stubGlobal("structuredClone", undefined);
    vi.resetModules();

    const [{ createChatbotMockSnapshot }, services, { MockChatbotProvider }, storeModule] = await Promise.all([
      import("@/mocks/chatbot/data"),
      import("@/services/chatbot"),
      import("@/services/chatbot/mock-provider"),
      import("@/store/useChatbotStore"),
    ]);

    expect(globalThis.structuredClone).toBeUndefined();

    const snapshot = createChatbotMockSnapshot();
    const provider = new MockChatbotProvider();
    const loaded = await provider.loadSnapshot();
    const conversation = loaded.conversations[0];
    const message = await provider.sendMessage(conversation.id, "Mensagem pelo fallback");

    const store = storeModule.createChatbotStore(provider);
    await store.getState().initialize();
    await store.getState().sendMessage(conversation.id, "Mensagem no store");
    store.getState().applyEvent({
      type: "message.delivered",
      payload: { id: message.id, conversationId: conversation.id },
    });

    const flow = services.cloneChatbotData(snapshot.flows[0]);
    const savedFlow = await provider.saveFlow(flow);
    const flowWithoutMessage = provider.removeNode(savedFlow, "node-message");

    expect(loaded).not.toBe(snapshot);
    expect(message.body).toBe("Mensagem pelo fallback");
    expect(store.getState().loadState).toBe("success");
    expect(store.getState().snapshot.messages.some((item) => item.body === "Mensagem no store")).toBe(true);
    expect(flowWithoutMessage.nodes.some((node) => node.id === "node-message")).toBe(false);
  });

  it("mantém o único acesso direto à API nativa dentro do helper compatível", () => {
    const directUsages = CHATBOT_SOURCE_ROOTS
      .flatMap(filesIn)
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .filter((file) => /\bstructuredClone\s*\(/.test(readFileSync(file, "utf8")));

    expect(directUsages).toEqual(["src/services/chatbot/clone.ts"]);
  });

  it("preserva o caminho nativo quando structuredClone está disponível", async () => {
    const nativeClone = vi.fn(<T>(value: T): T => JSON.parse(JSON.stringify(value)));
    vi.stubGlobal("structuredClone", nativeClone);
    vi.resetModules();

    const { cloneChatbotData } = await import("@/services/chatbot/clone");
    const original = { nested: { enabled: true }, items: ["inbox", "flows"] };
    const cloned = cloneChatbotData(original);

    expect(nativeClone).toHaveBeenCalledOnce();
    expect(nativeClone).toHaveBeenCalledWith(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.nested).not.toBe(original.nested);
  });
});
