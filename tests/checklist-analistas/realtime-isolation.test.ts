import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canalReservadoChecklist,
  resolverTransporteChecklist,
} from "@/lib/checklist/realtime";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  authorize: vi.fn(),
  atorChamados: vi.fn(),
  atorChecklist: vi.fn(),
  chamado: vi.fn(),
  bpmModulo: vi.fn(),
  bpmPipeline: vi.fn(),
}));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ default: { chamados: { findUnique: mocks.chamado } } }));
vi.mock("@/lib/pusher-server.ts", () => ({ pusherServer: { authorizeChannel: mocks.authorize } }));
vi.mock("@/lib/checklist/acesso", () => ({ obterAtorChecklist: mocks.atorChecklist }));
vi.mock("@/lib/chamados/acesso", () => ({
  obterAtorChamados: mocks.atorChamados,
  podeVerChamado: vi.fn(),
  chamadoAcessoSelect: {},
}));
vi.mock("@/lib/bpm/ownership", () => ({
  checarAcessoModuloBpm: mocks.bpmModulo,
  checarAcessoRealtimeBpmPipeline: mocks.bpmPipeline,
}));

import { POST } from "@/app/api/pusher/auth/route";

function request(channel: string | File | null, socket: string | File | null = "123.456") {
  const body = new FormData();
  if (channel !== null) body.set("channel_name", channel);
  if (socket !== null) body.set("socket_id", socket);
  return new Request("https://example.invalid/api/pusher/auth", { method: "POST", body });
}

describe("CheckList — configuração pura sem transporte externo", () => {
  it.each([undefined, "polling"])("usa polling para %s", (value) => {
    expect(resolverTransporteChecklist(value)).toEqual({ valid: true, transport: "polling" });
  });
  it.each(["pusher", "", " ", "Polling", "POLLING", " polling", "polling ", "stage"])("falha fechada para %j", (value) => {
    expect(resolverTransporteChecklist(value)).toEqual({ valid: false, transport: null });
  });
  it.each(["private-checklist", "private-checklist-docs", "private-checklist-stage-docs", "private-checklist-prod-docs", "private-checklist???", "private-checklistdocs"])("reserva inclusive canal antigo/futuro/malformado %s", (channel) => {
    expect(canalReservadoChecklist(channel)).toBe(true);
  });
  it("preserva namespaces alheios", () => {
    expect(canalReservadoChecklist("private-holerite-alerts")).toBe(false);
    expect(canalReservadoChecklist("private-alpha-crm-pipeline-p1")).toBe(false);
  });
});

describe("rota Pusher — CheckList nunca chega à assinatura", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "42", nome: "Synthetic", role: "Admin" } });
    mocks.authorize.mockReturnValue({ auth: "synthetic-signature" });
    mocks.atorChamados.mockResolvedValue({ visaoGlobal: true });
    mocks.bpmPipeline.mockResolvedValue(true);
  });

  it.each(["private-checklist", "private-checklist-docs", "private-checklist-stage-docs", "private-checklist-prod-docs", "private-checklist???", "private-checklistdocs"])("nega Admin no canal %s antes de ACL/fallback", async (channel) => {
    expect((await POST(request(channel))).status).toBe(403);
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(mocks.atorChecklist).not.toHaveBeenCalled();
    expect(mocks.atorChamados).not.toHaveBeenCalled();
    expect(mocks.bpmPipeline).not.toHaveBeenCalled();
    expect(mocks.bpmModulo).not.toHaveBeenCalled();
    expect(mocks.chamado).not.toHaveBeenCalled();
  });

  it.each(["CEO", "TI", "Lider Operacional", "Analista Operacional"])("nega também role %s", async (role) => {
    mocks.auth.mockResolvedValue({ user: { id: "42", role } });
    expect((await POST(request("private-checklist-docs"))).status).toBe(403);
    expect(mocks.authorize).not.toHaveBeenCalled();
  });

  it.each([null, {}, { user: {} }])("exige sessão válida antes de ler o formulário: %j", async (session) => {
    mocks.auth.mockResolvedValue(session);
    const malformed = new Request("https://example.invalid/api/pusher/auth", { method: "POST", body: "not-form-data" });
    expect((await POST(malformed)).status).toBe(401);
    expect(mocks.authorize).not.toHaveBeenCalled();
  });

  it.each([null, "", "   "])("nega campo ausente/vazio %j sem assinar", async (value) => {
    expect((await POST(request(value))).status).toBe(400);
    expect((await POST(request("private-holerite-alerts", value))).status).toBe(400);
    expect(mocks.authorize).not.toHaveBeenCalled();
  });

  it("nega File em ambos campos, sem coerção para string nem erro 500", async () => {
    const file = new File(["synthetic"], "channel.txt", { type: "text/plain" });
    expect((await POST(request(file))).status).toBe(400);
    expect((await POST(request("private-holerite-alerts", file))).status).toBe(400);
    expect(mocks.authorize).not.toHaveBeenCalled();
  });

  it("preserva assinatura e ACL de outros canais conhecidos", async () => {
    expect((await POST(request("private-holerite-alerts"))).status).toBe(200);
    expect(mocks.authorize).toHaveBeenLastCalledWith("123.456", "private-holerite-alerts");
    expect((await POST(request("private-admin-chamados"))).status).toBe(200);
    expect(mocks.atorChamados).toHaveBeenCalledWith("42");
    expect((await POST(request("private-alpha-crm-pipeline-p1"))).status).toBe(200);
    expect(mocks.bpmPipeline).toHaveBeenCalledWith("p1", 42);
    mocks.bpmPipeline.mockResolvedValue(false);
    expect((await POST(request("private-alpha-crm-pipeline-p2"))).status).toBe(403);
    expect(mocks.authorize).toHaveBeenCalledTimes(3);
  });

  it("mantém o fallback de outros namespaces sem ampliar esta mudança", async () => {
    expect((await POST(request("presence-other-module"))).status).toBe(200);
    expect(mocks.authorize).toHaveBeenCalledWith("123.456", "presence-other-module", {
      user_id: "42", user_info: { name: "Synthetic" },
    });
  });
});
