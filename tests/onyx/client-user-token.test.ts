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

  it("preserva o PAT de servico quando uma chamada tecnica nao informa token", async () => {
    const client = await loadClient();
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    await client.listAgents();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://onyx.example.com/api/persona",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer service-token" }),
      }),
    );
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
});
