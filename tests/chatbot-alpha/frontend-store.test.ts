import { describe, expect, it } from "vitest";
import { MockChatbotProvider } from "@/services/chatbot/mock-provider";
import { createChatbotStore } from "@/store/useChatbotStore";

describe("ChatBot Alpha async store", () => {
  it("transita idle/loading/success durante a hidratação", async () => {
    const store = createChatbotStore(new MockChatbotProvider({ delayMs: 5 }));
    expect(store.getState().loadState).toBe("idle");
    const pending = store.getState().initialize();
    expect(store.getState().loadState).toBe("loading");
    await pending;
    expect(store.getState().loadState).toBe("success");
    expect(store.getState().snapshot.conversations.length).toBeGreaterThan(0);
  });

  it("expõe erro, permite retry e não mascara falhas de mutação", async () => {
    const provider = new MockChatbotProvider({ fail: true });
    const store = createChatbotStore(provider);
    await expect(store.getState().initialize()).rejects.toMatchObject({ code: "simulated" });
    expect(store.getState()).toMatchObject({ loadState: "error", isBusy: false });
    provider.setFailureMode(false);
    await store.getState().retry();
    expect(store.getState().loadState).toBe("success");
    provider.setFailureMode(true);
    const flow = store.getState().snapshot.flows[0];
    await expect(store.getState().saveFlow(flow)).rejects.toMatchObject({ code: "simulated" });
    expect(store.getState().isBusy).toBe(false);
    expect(store.getState().error).toContain("Falha controlada");
  });

  it("bloqueia mutações concorrentes e sempre libera o estado busy", async () => {
    const store = createChatbotStore(new MockChatbotProvider({ delayMs: 20 }));
    await store.getState().initialize();
    const agent = store.getState().snapshot.agents[0];
    const first = store.getState().saveAgent({ ...agent, active: !agent.active });
    expect(store.getState().isBusy).toBe(true);
    await expect(store.getState().saveAgent(agent)).rejects.toThrow("Aguarde a operação em andamento");
    await first;
    expect(store.getState().isBusy).toBe(false);
  });
});
