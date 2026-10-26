import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getUserOnyxToken: vi.fn(),
  listAgents: vi.fn(),
  listTools: vi.fn(),
  getAgent: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
  createCustomTool: vi.fn(),
  getImageGenToolId: vi.fn(),
  getVoiceStatus: vi.fn(),
  getOwnerInfoMap: vi.fn(),
  recordAgentOwner: vi.fn(),
  userOwnsAgent: vi.fn(),
  userCanUseAgent: vi.fn(),
  removeAgentOwner: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));

vi.mock("@/lib/onyx/user-token", () => ({
  getUserOnyxToken: mocks.getUserOnyxToken,
}));

vi.mock("@/lib/onyx/client", () => ({
  listAgents: mocks.listAgents,
  listTools: mocks.listTools,
  getAgent: mocks.getAgent,
  createAgent: mocks.createAgent,
  updateAgent: mocks.updateAgent,
  deleteAgent: mocks.deleteAgent,
  createCustomTool: mocks.createCustomTool,
  getImageGenToolId: mocks.getImageGenToolId,
  getVoiceStatus: mocks.getVoiceStatus,
  OnyxError: class OnyxError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock("@/lib/onyx/ownership", () => ({
  isAdminRole: (role: string) => role === "Admin" || role === "CEO",
  getOwnerInfoMap: mocks.getOwnerInfoMap,
  recordAgentOwner: mocks.recordAgentOwner,
  userOwnsAgent: mocks.userOwnsAgent,
  userCanUseAgent: mocks.userCanUseAgent,
  removeAgentOwner: mocks.removeAgentOwner,
}));

import { GET as getAgents, POST as createAgent } from "@/app/api/onyx/agents/route";
import { GET as getAgent } from "@/app/api/onyx/agents/[id]/route";
import { GET as getTools } from "@/app/api/onyx/tools/route";
import { GET as getVoiceStatus } from "@/app/api/onyx/voice/status/route";
import { OnyxError } from "@/lib/onyx/client";
import { AcessoTemporariamenteIndisponivel } from "@/lib/auth/indisponibilidade";

describe("rotas Onyx com token individual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "COLABORADOR" } });
    mocks.getUserOnyxToken.mockResolvedValue("user-token");
    mocks.listAgents.mockResolvedValue([]);
    mocks.listTools.mockResolvedValue([]);
    mocks.getAgent.mockResolvedValue({ id: 42, name: "Agente" });
    mocks.getImageGenToolId.mockResolvedValue(99);
    mocks.getVoiceStatus.mockResolvedValue({ stt_enabled: true, tts_enabled: true });
    mocks.getOwnerInfoMap.mockResolvedValue(new Map());
    mocks.userCanUseAgent.mockResolvedValue(true);
    mocks.createAgent.mockResolvedValue({ id: 43, name: "Novo agente" });
    mocks.recordAgentOwner.mockResolvedValue(undefined);
  });

  it("resolve o token da sessao para listar agentes", async () => {
    const response = await getAgents();

    expect(response.status).toBe(200);
    expect(mocks.getUserOnyxToken).toHaveBeenCalledWith("7");
    expect(mocks.listAgents).toHaveBeenCalledWith("user-token");
  });
  it("distinguishes auth, private metadata and upstream errors without exposing SDK details", async () => {
    mocks.auth.mockRejectedValueOnce(new AcessoTemporariamenteIndisponivel());
    const auth = await getAgents();
    expect(auth.status).toBe(503);
    expect(await auth.json()).toMatchObject({ code: "AUTH_UNAVAILABLE" });
    mocks.getUserOnyxToken.mockRejectedValueOnce(new Error("private-sql-private-token"));
    const metadata = await getAgents();
    expect(metadata.status).toBe(503);
    expect(await metadata.json()).toMatchObject({ code: "AI_METADATA_UNAVAILABLE" });
    mocks.listAgents.mockRejectedValueOnce(new OnyxError("private-upstream-private-token", 502));
    const upstream = await getAgents();
    expect(upstream.status).toBe(502);
    const body = await upstream.text();
    expect(body).toContain("AI_UPSTREAM_UNAVAILABLE");
    expect(body).not.toContain("private-");
  });

  it("resolve o token da sessao para listar tools", async () => {
    const response = await getTools();

    expect(response.status).toBe(200);
    expect(mocks.getUserOnyxToken).toHaveBeenCalledWith("7");
    expect(mocks.listTools).toHaveBeenCalledWith("user-token");
  });
  it("resolves voice status only with the caller's individual token", async () => {
    const response = await getVoiceStatus();
    expect(response.status).toBe(200);
    expect(mocks.getVoiceStatus).toHaveBeenCalledWith("user-token");
    mocks.auth.mockResolvedValueOnce(null);
    expect((await getVoiceStatus()).status).toBe(401);
    expect(mocks.getVoiceStatus).toHaveBeenCalledOnce();
  });

  it("resolve o token da sessao para consultar o detalhe de um agente", async () => {
    const response = await getAgent(
      new NextRequest("https://painel.example.com/api/onyx/agents/42"),
      { params: Promise.resolve({ id: "42" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.getUserOnyxToken).toHaveBeenCalledWith("7");
    expect(mocks.getAgent).toHaveBeenCalledWith(42, "user-token");
  });

  it("usa o mesmo token ao localizar tools e criar um agente", async () => {
    const request = new NextRequest("https://painel.example.com/api/onyx/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Novo agente",
        description: "Descricao",
        system_prompt: "Prompt",
        tool_ids: [99, 100],
      }),
    });

    const response = await createAgent(request);

    expect(response.status).toBe(201);
    expect(mocks.getImageGenToolId).toHaveBeenCalledWith("user-token");
    expect(mocks.createAgent).toHaveBeenCalledWith(
      expect.objectContaining({ tool_ids: [100] }),
      "user-token",
    );
  });
});
