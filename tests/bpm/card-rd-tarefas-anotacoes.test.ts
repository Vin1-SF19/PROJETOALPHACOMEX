import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarInteracaoCardSchema, criarTarefaSchema } from "@/lib/validations/bpm";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), acesso: vi.fn(), historico: vi.fn(), notificar: vi.fn(),
  tarefa: vi.fn(), interacao: vi.fn(), card: vi.fn(), transaction: vi.fn(),
}));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {
  bpmTarefa: { create: mocks.tarefa }, bpmInteracaoCard: { create: mocks.interacao },
  bpmCard: { findUnique: mocks.card }, $transaction: mocks.transaction,
} }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: mocks.acesso }));
vi.mock("@/lib/bpm/historico-server", () => ({ registrarHistoricoCard: mocks.historico }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: mocks.notificar }));
vi.mock("@/lib/bpm/automacoes/fila", () => ({ enfileirarAutomacoesCriacaoTarefaBpm: vi.fn() }));
vi.mock("@/lib/bpm/sla", () => ({ criarSlaInstancia: vi.fn() }));

import { CriarTarefaBpm } from "@/actions/bpm/Tarefas";
import { CriarInteracaoCardBpm } from "@/actions/bpm/Interacoes";

const RD_ID = `rdcard_${"a".repeat(28)}`;
const NATIVE_ID = "clw0000000000000card";
const tarefa = (cardId: string) => ({
  cardId, tipo: "TAREFA", titulo: "Conferir documentos",
  prazo: new Date("2026-10-22T15:00:00Z"), alertaEm: new Date("2026-10-22T14:00:00Z"),
});
const anotacao = (cardId: string) => ({ cardId, tipo: "ANOTACAO", observacoes: "Documentação recebida." });
const tx = { bpmTarefa: { create: mocks.tarefa }, bpmInteracaoCard: { create: mocks.interacao }, bpmCard: { findUnique: mocks.card } };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "34", role: "OPERACIONAL" } });
  mocks.acesso.mockResolvedValue({ autorizado: true, role: "PARTICIPANTE" });
  mocks.tarefa.mockResolvedValue({ id: "clw0000000000000task", createdAt: new Date() });
  mocks.interacao.mockResolvedValue({ id: "clw0000000000000note", tipo: "ANOTACAO", observacoes: "Documentação recebida." });
  mocks.card.mockResolvedValue({ pipelineId: "clw0000000000000pipe", etapaId: "clw000000000000stage" });
  mocks.transaction.mockImplementation(async (fn: (client: typeof tx) => unknown) => fn(tx));
});

describe.each([NATIVE_ID, RD_ID])("tarefas e anotações do card %s", (cardId) => {
  it("cria tarefa com prazo, autoriza antes e dentro da transação e notifica após persistir", async () => {
    await expect(CriarTarefaBpm(tarefa(cardId))).resolves.toMatchObject({ success: true });
    expect(mocks.acesso).toHaveBeenNthCalledWith(1, cardId, 34, "OPERACIONAL", "criarTarefa");
    expect(mocks.acesso).toHaveBeenNthCalledWith(2, cardId, 34, "OPERACIONAL", "criarTarefa", tx);
    expect(mocks.tarefa).toHaveBeenCalledWith({ data: expect.objectContaining(tarefa(cardId)) });
    expect(mocks.historico).toHaveBeenCalledWith(expect.objectContaining({ cardId, acao: "TAREFA_CRIADA", usuarioId: 34 }), tx);
    expect(mocks.notificar).toHaveBeenCalledWith({ cardId, tipo: "TAREFA_ALTERADA" });
    expect(mocks.notificar).toHaveBeenCalledAfter(mocks.tarefa);
  });

  it("salva anotação com autor e histórico, revalidando permissão na transação", async () => {
    await expect(CriarInteracaoCardBpm(anotacao(cardId))).resolves.toMatchObject({ success: true });
    expect(mocks.acesso).toHaveBeenNthCalledWith(1, cardId, 34, "OPERACIONAL", "editarCard");
    expect(mocks.acesso).toHaveBeenNthCalledWith(2, cardId, 34, "OPERACIONAL", "editarCard", tx);
    expect(mocks.interacao).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ...anotacao(cardId), registradoPorId: 34 }) }));
    expect(mocks.historico).toHaveBeenCalledWith(expect.objectContaining({ cardId, acao: "ANOTACAO_REGISTRADA", usuarioId: 34 }), tx);
    expect(mocks.notificar).toHaveBeenCalledWith({ cardId, tipo: "INTERACAO_CRIADA" });
    expect(mocks.notificar).toHaveBeenCalledAfter(mocks.interacao);
  });

  it("recusa tarefas e anotações quando o usuário não pode editar o card", async () => {
    mocks.acesso.mockRejectedValue(new Error("Não autorizado"));
    await expect(CriarTarefaBpm(tarefa(cardId))).resolves.toEqual({ success: false, error: "Não autorizado" });
    await expect(CriarInteracaoCardBpm(anotacao(cardId))).resolves.toEqual({ success: false, error: "Não autorizado" });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.notificar).not.toHaveBeenCalled();
  });
});

it.each(["", "rdcard_invalido", `rdcard_${"a".repeat(29)}`, "outro_card"])("recusa ID inválido %j antes de consultar ou gravar", async (cardId) => {
  await expect(CriarTarefaBpm(tarefa(cardId))).resolves.toMatchObject({ success: false });
  await expect(CriarInteracaoCardBpm(anotacao(cardId))).resolves.toMatchObject({ success: false });
  expect(mocks.acesso).not.toHaveBeenCalled();
  expect(mocks.transaction).not.toHaveBeenCalled();
});

it("mantém validação de prazo obrigatório, alerta, título e anotação vazia em cards RD", () => {
  expect(criarTarefaSchema.safeParse(tarefa(RD_ID)).success).toBe(true);
  expect(criarInteracaoCardSchema.safeParse(anotacao(RD_ID)).success).toBe(true);
  for (const changes of [{ prazo: "" }, { prazo: "2026-10-22" }, { alertaEm: "" }, { alertaEm: "2026-10-23T15:00:00Z" }, { titulo: "" }]) {
    expect(criarTarefaSchema.safeParse({ ...tarefa(RD_ID), ...changes }).success).toBe(false);
  }
  expect(criarInteracaoCardSchema.safeParse({ ...anotacao(RD_ID), observacoes: "   " }).success).toBe(false);
});
