import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

async function loadClient(options?: { serviceToken?: string }) {
  vi.resetModules();
  vi.stubEnv("ONYX_API_URL", "https://onyx.example.com/");
  vi.stubEnv("ONYX_API_KEY", options?.serviceToken ?? "service-token");
  vi.stubGlobal("fetch", fetchMock);
  return import("@/lib/onyx/client");
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("client Onyx com token individual", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("usa o token individual ao listar agentes, tools e consultar um agente", async () => {
    const client = await loadClient();
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ id: 42, name: "Agente" }));

    await client.listAgents(" user-token ");
    await client.listTools("user-token");
    await client.getAgent(42, "user-token");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://onyx.example.com/api/persona",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer user-token" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://onyx.example.com/api/tool",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer user-token" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://onyx.example.com/api/persona/42",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer user-token" }),
      }),
    );
  });

  it("propaga o token individual ao localizar a tool de imagem", async () => {
    const client = await loadClient();
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 99, name: "generate_image" }]));

    await expect(client.getImageGenToolId("user-token")).resolves.toBe(99);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://onyx.example.com/api/tool",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer user-token" }),
      }),
    );
  });

  it("bloqueia chamadas sem token individual mesmo com PAT de servico configurado", async () => {
    const client = await loadClient();
    await expect(client.listAgents()).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aceita token individual mesmo sem PAT global configurado", async () => {
    const client = await loadClient({ serviceToken: "" });
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    await expect(client.listTools("user-token")).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://onyx.example.com/api/tool",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer user-token" }),
      }),
    );
  });

  it("keeps the JSON deadline after headers and never retries a stalled body", async () => {
    const client = await loadClient();
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(new Response(new ReadableStream()));
    const rejected = expect(client.listAgents("user-token")).rejects.toMatchObject({ status: 504, code: "AI_UPSTREAM_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(30_000);
    await rejected;
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retains caller cancellation after stream headers without applying the JSON30s deadline", async () => {
    const client = await loadClient();
    vi.useFakeTimers();
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => new Response(new ReadableStream({
      start(stream) { init.signal?.addEventListener("abort", () => stream.error(init.signal?.reason), { once: true }); },
    })));
    const controller = new AbortController();
    const response = await client.sendChatMessageStream({ chatSessionId: "safe-session", message: "test", userToken: "user-token", signal: controller.signal });
    const read = response.body!.getReader().read();
    const aborted = expect(read).rejects.toBe("caller stopped");
    await vi.advanceTimersByTimeAsync(31_000);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);
    controller.abort("caller stopped");
    await aborted;
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not replace an external abort with its own timeout", async () => {
    const client = await loadClient();
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    }));
    const controller = new AbortController();
    const rejected = expect(client.getAgentAvatar(1, "user-token", controller.signal)).rejects.toBe("cancelled");
    await vi.advanceTimersByTimeAsync(1_000);
    controller.abort("cancelled");
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });
});
