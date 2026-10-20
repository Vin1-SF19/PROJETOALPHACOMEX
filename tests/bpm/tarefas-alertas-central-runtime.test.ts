import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  execListar: vi.fn(), execBuscar: vi.fn(), execCas: vi.fn(), execAtualizar: vi.fn(),
  tarefaBuscar: vi.fn(), disparar: vi.fn(), passo: vi.fn(), historico: vi.fn(), leaseCriar: vi.fn(), leaseLiberar: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ default: {
  bpmAutomacaoExecucao: { findMany: mocks.execListar, findUnique: mocks.execBuscar, updateMany: mocks.execCas, update: mocks.execAtualizar },
  bpmAutomacaoLease: { create: mocks.leaseCriar, deleteMany: mocks.leaseLiberar },
  bpmAutomacaoPassoExecucao: { upsert: mocks.passo, update: vi.fn() },
  bpmTarefa: { findFirst: mocks.tarefaBuscar }, bpmCardHistorico: { create: mocks.historico },
} }));
vi.mock("@/lib/bpm/alertas-tarefas", () => ({ dispararAlertaTarefaBpm: mocks.disparar, tarefaAlertaSelect: { id: true } }));
vi.mock("@/lib/bpm/regras/contexto", () => ({ montarContextoAvaliacaoDoCard: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/bpm/transicao-command", () => ({ executarTransicaoBpm: vi.fn() }));
vi.mock("@/lib/bpm/automacoes/executor", () => ({ executarAcaoLegadaNoMotorCentral: vi.fn() }));
vi.mock("@/lib/bpm/contratacao-comercial-server", () => ({ disponibilizarContratoComercial: vi.fn() }));
vi.mock("@/lib/bpm/transcricao-reuniao-server", () => ({ sincronizarTranscricaoCardBpm: vi.fn() }));
vi.mock("@/lib/bpm/cadencias/ativacao-automatica", () => ({ ativarCadenciasNaEntradaBpm: vi.fn() }));
import { processarFilaAutomacoesCentraisBpm } from "@/lib/bpm/automacoes/central-runtime";
const grafo = { inicioId: "alerta", nos: [
  { id: "alerta", tipo: "ACAO", acaoTipo: "MARCAR_ALERTA_TAREFA", parametros: {}, proximoId: "fim" },
  { id: "fim", tipo: "FIM" },
] };
const tarefa = { id: "tarefa-1", cardId: "card-1" };
describe("alerta de tarefas no motor central", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.execListar.mockResolvedValue([{ id: "exec-1" }]);
    mocks.execCas.mockImplementation(async (args) => {
      if (args.data.claimToken) mocks.execBuscar.mockResolvedValue({
        id: "exec-1", tentativas: 1, cardId: "card-1", automacaoId: "automacao-1", claimToken: args.data.claimToken,
        automacaoVersaoId: "versao-1", automacao: { ativa: true }, passos: [],
        automacaoVersao: { status: "ATIVA", grafoJson: JSON.stringify(grafo), condicaoJson: null },
        card: { id: "card-1", pipelineId: "pipeline-1", status: "ATIVO" },
        evento: { entidadeTipo: "TAREFA", entidadeId: tarefa.id },
      });
      return { count: 1 };
    });
    mocks.tarefaBuscar.mockResolvedValue(tarefa); mocks.disparar.mockResolvedValue(true);
    mocks.passo.mockResolvedValue({ id: "passo-1" });
  });
  it("entrega pelo mesmo emissor do cron, sem somente marcar a tarefa", async () => {
    expect(await processarFilaAutomacoesCentraisBpm()).toMatchObject({ executados: 1, falhos: 0 });
    expect(mocks.disparar).toHaveBeenCalledWith(tarefa, expect.any(Date), "automacao-1");
    expect(mocks.tarefaBuscar).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: tarefa.id, cardId: tarefa.cardId, status: "PENDENTE", alertaDisparadoEm: null }) }));
  });
  it("não dispara quando a tarefa foi concluída ou reagendada antes da execução", async () => {
    mocks.tarefaBuscar.mockResolvedValue(null);
    expect(await processarFilaAutomacoesCentraisBpm()).toMatchObject({ executados: 1 });
    expect(mocks.disparar).not.toHaveBeenCalled();
  });
  it("permite retentativa quando a entrega falha", async () => {
    mocks.disparar.mockRejectedValue(new Error("Pusher indisponível"));
    expect(await processarFilaAutomacoesCentraisBpm()).toMatchObject({ executados: 0, adiados: 1 });
    expect(mocks.execAtualizar).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PENDENTE" }) }));
  });
});
