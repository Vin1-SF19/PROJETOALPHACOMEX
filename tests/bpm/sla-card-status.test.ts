import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), acesso: vi.fn(), card: vi.fn(), instancias: vi.fn(), status: vi.fn(), notificar: vi.fn(),
}));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {
  bpmCard: { findUniqueOrThrow: mocks.card }, bpmSlaInstancia: { findMany: mocks.instancias },
} }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: mocks.acesso, exigirAcessoConfigPipeline: vi.fn() }));
vi.mock("@/lib/bpm/sla", () => ({ obterStatusSla: mocks.status, criarSlaInstancia: vi.fn(), simularConfiguracaoSlaAplicavel: vi.fn() }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: mocks.notificar }));
vi.mock("@/lib/bpm/config-version", () => ({ avancarConfigVersionBpm: vi.fn() }));
import { ObterStatusSlaCard } from "@/actions/bpm/Sla";

const RD_ID = "rdcard_" + "a".repeat(28);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "1", role: "ADMIN" } });
  mocks.acesso.mockResolvedValue({ role: "RESPONSAVEL" });
  mocks.card.mockResolvedValue({ etapaId: "etapa-atual" });
  mocks.instancias.mockResolvedValue([]);
});
describe("SLA no card aberto", () => {
  it.each([RD_ID, "cm12345678901234567890123"])("aceita card %s sem SLA e não aciona o motor", async (id) => {
    expect(await ObterStatusSlaCard(id)).toEqual({ success: true, data: [] });
    expect(mocks.acesso).toHaveBeenCalledWith(id, 1, "ADMIN", "visualizar");
    expect(mocks.status).not.toHaveBeenCalled();
    expect(mocks.instancias).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      concluidoEm: null, status: { notIn: ["CONCLUIDO", "CANCELADO"] },
      slaConfig: { ativa: true, OR: [{ etapaId: null }, { etapaId: "etapa-atual" }] },
    }) }));
  });
  it("mostra somente ciclos aplicáveis e mantém leitura sem escrita do visualizador", async () => {
    mocks.acesso.mockResolvedValue({ role: "VISUALIZADOR" });
    mocks.instancias.mockResolvedValue([{ id: "aberto" }]);
    mocks.status.mockResolvedValue([{ id: "encerrado", statusAlterado: false }, { id: "aberto", statusAlterado: false }]);
    expect(await ObterStatusSlaCard(RD_ID)).toEqual({ success: true, data: [{ id: "aberto", statusAlterado: false }] });
    expect(mocks.status).toHaveBeenCalledWith({ cardId: RD_ID }, undefined, expect.any(Date), false);
  });
  it("continua exigindo acesso antes de consultar prazos", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.acesso.mockRejectedValue(new Error("Não autorizado"));
    expect(await ObterStatusSlaCard(RD_ID)).toEqual({ success: false, error: "Não autorizado" });
    expect(mocks.card).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it("rejeita IDs importados malformados", async () => {
    expect((await ObterStatusSlaCard("rdcard_invalido")).success).toBe(false);
    expect(mocks.acesso).not.toHaveBeenCalled();
  });
});
