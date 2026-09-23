import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
 db: { bpmAutomacaoExecucao: { updateMany: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() }, bpmAutomacaoLease: { create: vi.fn(), deleteMany: vi.fn() }, bpmAutomacaoPassoExecucao: { upsert: vi.fn(), update: vi.fn() }, bpmCardHistorico: { create: vi.fn() } }, contexto: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({ default: mocks.db }));
vi.mock("@/lib/bpm/regras/contexto", () => ({ montarContextoAvaliacaoDoCard: mocks.contexto }));
vi.mock("@/lib/bpm/transcricao-reuniao-server", () => ({ sincronizarTranscricaoCardBpm: vi.fn() }));
vi.mock("@/lib/bpm/automacoes/executor", () => ({ executarAcaoLegadaNoMotorCentral: vi.fn() }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));
vi.mock("@/lib/bpm/cadencias/ativacao-automatica", () => ({ ativarCadenciasNaEntradaBpm: vi.fn() }));
import { processarFilaAutomacoesCentraisBpm } from "@/lib/bpm/automacoes/central-runtime";
beforeEach(() => { vi.resetAllMocks(); });
it.each(["ARQUIVADO", "ATIVO"])("fila real respeita status %s", async (status) => {
 let token = "";
 mocks.db.bpmAutomacaoExecucao.updateMany.mockImplementation(async ({ data }) => { if (data.claimToken) token = data.claimToken; return { count: 1 }; });
 mocks.db.bpmAutomacaoExecucao.findMany.mockResolvedValue([{ id: "exec" }]);
 mocks.db.bpmAutomacaoExecucao.findUnique.mockImplementation(async () => ({ id: "exec", claimToken: token, cardId: "card", card: { status }, passos: [], automacao: { ativa: true }, automacaoVersao: { status: "ATIVA", grafoJson: JSON.stringify({ inicioId: "fim", nos: [{ id: "fim", tipo: "FIM" }] }) } }));
 mocks.db.bpmAutomacaoPassoExecucao.upsert.mockResolvedValue({ id: "passo" });
 const result = await processarFilaAutomacoesCentraisBpm();
 if (status === "ARQUIVADO") {
  expect(result).toMatchObject({ ignorados: 1, executados: 0 });
  expect(mocks.db.bpmAutomacaoExecucao.update).toHaveBeenCalledWith({ where: { id: "exec" }, data: expect.objectContaining({ status: "IGNORADA", resultadoJson: '{"motivo":"CARD_ARQUIVADO"}', claimToken: null }) });
  expect(mocks.contexto).not.toHaveBeenCalled();
  expect(mocks.db.bpmAutomacaoPassoExecucao.upsert).not.toHaveBeenCalled();
  expect(mocks.db.bpmCardHistorico.create).not.toHaveBeenCalled();
  expect(mocks.db.bpmAutomacaoLease.create).not.toHaveBeenCalled();
 } else { expect(result).toMatchObject({ executados: 1, ignorados: 0 }); expect(mocks.db.bpmAutomacaoPassoExecucao.upsert).toHaveBeenCalledOnce(); }
});
