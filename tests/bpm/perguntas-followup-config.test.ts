import { beforeEach, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  bpmPipeline: { findUnique: vi.fn() },
  bpmChecklistFollowUpPergunta: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/bpm/ownership", () => ({ isAdminRole: (role: string) => role === "ADMIN" }));

import { ExcluirPerguntaFollowUpBpm, ListarPerguntasFollowUpBpm, SalvarPerguntaFollowUpBpm } from "@/actions/bpm/PerguntasFollowUp";

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: "1", role: "ADMIN" } });
  prismaMock.bpmPipeline.findUnique.mockResolvedValue({ id: "radar" });
  prismaMock.bpmChecklistFollowUpPergunta.findMany.mockResolvedValue([]);
  prismaMock.bpmChecklistFollowUpPergunta.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.bpmChecklistFollowUpPergunta.deleteMany.mockResolvedValue({ count: 1 });
});

it("só administrador configura perguntas adicionais", async () => {
  authMock.mockResolvedValue({ user: { id: "2", role: "COMERCIAL" } });
  expect(await ListarPerguntasFollowUpBpm("radar")).toEqual({ success: false, error: "Não autorizado" });
  expect((await SalvarPerguntaFollowUpBpm({})).success).toBe(false);
  expect((await ExcluirPerguntaFollowUpBpm("radar", "pergunta")).success).toBe(false);
  expect(prismaMock.bpmChecklistFollowUpPergunta.create).not.toHaveBeenCalled();
});

it("exige opções de seleção e preserva anotações obrigatórias do sistema", async () => {
  const base = { pipelineId: "radar", pergunta: "Canal preferido?", tipo: "selecao", opcoes: [], obrigatoria: true, ativo: true, ordem: 1 };
  expect(await SalvarPerguntaFollowUpBpm(base)).toEqual({ success: false, error: "Informe ao menos uma opção." });
  expect((await SalvarPerguntaFollowUpBpm({ ...base, pergunta: "Anotações sobre o último follow-up", opcoes: ["Sim"] })).success).toBe(false);
  expect(prismaMock.bpmChecklistFollowUpPergunta.create).not.toHaveBeenCalled();
  expect((await SalvarPerguntaFollowUpBpm({ ...base, opcoes: ["Telefone", "Email"] })).success).toBe(true);
  expect(prismaMock.bpmChecklistFollowUpPergunta.create).toHaveBeenCalledWith({ data: expect.objectContaining({ opcoesJson: '["Telefone","Email"]' }) });
});
