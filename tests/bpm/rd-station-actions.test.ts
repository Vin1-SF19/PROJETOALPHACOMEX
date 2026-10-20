import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn(), origin: vi.fn(), events: vi.fn(), event: vi.fn(), transaction: vi.fn() }));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: mocks.access }));
vi.mock("@/lib/prisma", () => ({ default: { bpmCardOrigemExterna: { findFirst: mocks.origin }, bpmEventoExternoCard: { findMany: mocks.events, findUnique: mocks.event }, $transaction: mocks.transaction } }));
import { ListarHistoricoExternoRd, CorrigirHistoricoExternoRd } from "@/actions/bpm/RdStationHistorico";

describe("histórico RD — acesso e consulta", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "1", role: "ADMIN" } });
    mocks.access.mockResolvedValue(undefined);
  });
  it("não consulta histórico sem autenticação", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await ListarHistoricoExternoRd("card")).success).toBe(false);
    expect(mocks.origin).not.toHaveBeenCalled();
  });
  it("não consulta origem quando acesso ao card é negado", async () => {
    mocks.access.mockRejectedValue(new Error("Não autorizado"));
    expect((await ListarHistoricoExternoRd("card")).success).toBe(false);
    expect(mocks.origin).not.toHaveBeenCalled();
  });
  it("devolve atividades e movimentos com payload intacto e ordem corrigida", async () => {
    mocks.origin.mockResolvedValue({ id: "origem", sourcePipelineName: "Operacional", sourceStageName: "Revisão", sourceDealName: "Empresa sintética" });
    mocks.events.mockResolvedValue([
      { id: "a", eventType: "ACTIVITY_UNKNOWN", occurredAt: "2026-01-01", projectedJson: '{"date":"2026-03-01","content":"Nota"}', rawJson: '{"text":"Nota"}', correcoes: [] },
      { id: "b", eventType: "DEAL_STAGE_HISTORY", occurredAt: "2026-02-01", projectedJson: '{"date":"2026-02-01","title":"Revisão"}', rawJson: '{"deal_stage_id":"etapa"}', correcoes: [] },
    ]);
    const response = await ListarHistoricoExternoRd("card");
    expect(response.success).toBe(true);
    expect(response.data.map((e) => e.id)).toEqual(["b", "a"]);
    expect(response.data[1]).not.toHaveProperty("original");
    expect(response.data[1].projecao.content).toBe("Nota");
    expect(mocks.access).toHaveBeenCalledWith("card", 1, "ADMIN", "visualizarHistorico");
  });
  it("preserva remoção explícita de autoria mesmo quando payload bruto contém nome", async () => {
    mocks.origin.mockResolvedValue({ id: "origem", sourcePipelineName: "Funil", sourceStageName: "Etapa", sourceDealName: "Negócio" });
    mocks.events.mockResolvedValue([{ id: "a", eventType: "ACTIVITY_NOTE", occurredAt: null,
      projectedJson: '{"authorName":null}', rawJson: '{"user":{"name":"Autor no bruto"}}',
      correcoes: [{ id: "manual", autorId: 1, camposAlteradosJson: '{"authorName":true}', projecaoAnteriorJson: '{}', projecaoNovaJson: '{}', createdAt: new Date(), autor: { nome: "Editora" } }] }]);
    const response = await ListarHistoricoExternoRd("card");
    expect(response.success).toBe(true);
    expect(response.data[0].projecao.authorName).toBeNull();
  });
  it("rejeita escrita não autenticada e entradas inválidas", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await CorrigirHistoricoExternoRd({ eventoId: "e", titulo: "a", conteudo: "b", data: "2026-01-01" })).success).toBe(false);
    expect((await CorrigirHistoricoExternoRd({ eventoId: "e", titulo: "a", conteudo: "b", data: "não-data" })).success).toBe(false);
  });
  it("exige permissão de edição no card de origem antes de alterar o histórico", async () => {
    mocks.event.mockResolvedValue({ id: "event", origem: { cardId: "outro-card", provider: "RD_STATION_CRM_V1" }, projectedJson: "{}" });
    mocks.access.mockRejectedValue(new Error("Não autorizado"));
    const result = await CorrigirHistoricoExternoRd({ eventoId: "event", titulo: "Texto", conteudo: "Nota", data: "" });
    expect(result.success).toBe(false);
    expect(mocks.access).toHaveBeenCalledWith("outro-card", 1, "ADMIN", "editarCard");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
