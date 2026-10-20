import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), acesso: vi.fn(), materializar: vi.fn(), resumo: vi.fn(), card: vi.fn() }));
vi.mock("../../auth", () => ({ auth: m.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: { bpmCard: { findUnique: m.card } } }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: m.acesso, exigirAcessoConfigPipeline: vi.fn() }));
vi.mock("@/lib/bpm/historico-server", () => ({ registrarHistoricoCard: vi.fn() }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));
vi.mock("@/lib/bpm/checklists/service", () => ({ materializarChecklistsAplicaveisCard: m.materializar, listarChecklistsMaterializadosCard: vi.fn() }));
vi.mock("@/lib/bpm/checklists/integracao", () => ({ carregarResumoChecklistAplicavelCard: m.resumo }));
vi.mock("@/lib/bpm/checklists/reconciliacao-tarefa", () => ({ reconciliarTarefaChecklist: vi.fn() }));
import { ListarChecklistsCardBpm, ObterResumoChecklistCardBpm } from "@/actions/bpm/Checklists";
import { criarTemplateChecklistSchema, cardChecklistSchema } from "@/lib/bpm/checklists/schemas";
const rd = "rdcard_0123456789abcdef0123456789ab";
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: "7", role: "COMERCIAL" } });
  m.acesso.mockResolvedValue({ podeAgirEtapa: true });
  m.materializar.mockResolvedValue({ criados: [], checklists: [] });
  m.card.mockImplementation(async ({ where }) => ({ id: where.id, pipelineId: "pipeline", etapaId: "etapa" }));
  m.resumo.mockResolvedValue({ total: 0, checklists: [] });
});
it.each(["clw0000000000000card", rd])("retorna sucesso vazio para card %s sem procedimento", async (cardId) => {
  expect(await ListarChecklistsCardBpm({ cardId })).toEqual({ success: true, data: [], materializados: 0 });
  expect(m.acesso).toHaveBeenCalledWith(cardId, 7, "COMERCIAL", "visualizar");
  expect(m.materializar).toHaveBeenCalledWith({ cardId, usuarioId: 7 });
  expect(await ObterResumoChecklistCardBpm({ cardId })).toMatchObject({ success: true, data: { total: 0 } });
});
it("mantém procedimentos existentes de card RD", async () => {
  m.materializar.mockResolvedValue({ criados: [], checklists: [{ id: "procedimento", templateNome: "Conferência" }] });
  expect(await ListarChecklistsCardBpm({ cardId: rd })).toMatchObject({ success: true, data: [{ id: "procedimento" }] });
});
it("permite vincular template específico a um card RD e recusa identidades inválidas", () => {
  expect(criarTemplateChecklistSchema.safeParse({ nome: "Procedimento", cardId: rd }).success).toBe(true);
  for (const cardId of ["rdcard_invalido", "../../arquivo", "", "qualquer-card"]) {
    expect(cardChecklistSchema.safeParse({ cardId }).success).toBe(false);
  }
});
it("não mascara falha real de leitura como ausência de procedimento", async () => {
  m.materializar.mockRejectedValueOnce(new Error("falha de leitura"));
  expect(await ListarChecklistsCardBpm({ cardId: rd })).toMatchObject({ success: false });
});
it("rejeita card inacessível antes de consultar os procedimentos", async () => {
  m.acesso.mockRejectedValue(new Error("Não autorizado"));
  expect(await ListarChecklistsCardBpm({ cardId: rd })).toMatchObject({ success: false, error: "Não autorizado" });
  expect(m.materializar).not.toHaveBeenCalled();
});
