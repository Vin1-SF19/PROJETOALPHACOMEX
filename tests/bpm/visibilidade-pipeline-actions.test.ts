import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), acesso: vi.fn(), count: vi.fn(), update: vi.fn(), before: vi.fn(), remove: vi.fn(), create: vi.fn(), audit: vi.fn(), transaction: vi.fn(), notify: vi.fn() }));
vi.mock("../../auth", () => ({ auth: m.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoConfigPipeline: m.acesso }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: m.notify }));
vi.mock("@/lib/prisma", () => ({ default: { setor: { count: m.count }, $transaction: m.transaction } }));
import { SalvarVisibilidadePipelineBpm } from "@/actions/bpm/VisibilidadePipeline";
const pipelineId = "clw000000000000000pipeline";
beforeEach(() => {
  vi.clearAllMocks(); m.auth.mockResolvedValue({ user: { id: "1" } }); m.acesso.mockResolvedValue(undefined); m.count.mockResolvedValue(1);
  m.before.mockResolvedValue([{ setorId: 2 }]); m.update.mockResolvedValue({ count: 1 }); m.notify.mockResolvedValue(undefined);
  m.transaction.mockImplementation((fn) => fn({ bpmPipeline: { updateMany: m.update }, bpmPipelineSetor: { findMany: m.before, deleteMany: m.remove, createMany: m.create }, bpmPipelineConfigAuditoria: { create: m.audit } }));
});
it("publica só a permissão do pipeline escolhido com auditoria e revisão", async () => {
  expect(await SalvarVisibilidadePipelineBpm({ pipelineId, versao: 4, setorIds: [3] })).toEqual({ success: true, versao: 5 });
  expect(m.remove).toHaveBeenCalledWith({ where: { pipelineId } }); expect(m.create).toHaveBeenCalledWith({ data: [{ pipelineId, setorId: 3 }] });
  expect(m.audit).toHaveBeenCalledOnce(); expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: pipelineId, configVersion: 4 } }));
});
it("não salva em conflito de versão ou setor inválido", async () => {
  m.update.mockResolvedValue({ count: 0 }); expect(await SalvarVisibilidadePipelineBpm({ pipelineId, versao: 4, setorIds: [3] })).toMatchObject({ success: false }); expect(m.remove).not.toHaveBeenCalled();
  m.count.mockResolvedValue(0); expect(await SalvarVisibilidadePipelineBpm({ pipelineId, versao: 4, setorIds: [3] })).toMatchObject({ success: false });
});
it("não permite usuário comum configurar acesso", async () => {
  m.acesso.mockRejectedValue(new Error("Não autorizado")); expect(await SalvarVisibilidadePipelineBpm({ pipelineId, versao: 4, setorIds: [] })).toMatchObject({ success: false }); expect(m.transaction).not.toHaveBeenCalled();
});
it("seleção vazia remove apenas restrições desse pipeline", async () => {
  m.count.mockResolvedValue(0); expect(await SalvarVisibilidadePipelineBpm({ pipelineId, versao: 4, setorIds: [] })).toMatchObject({ success: true }); expect(m.remove).toHaveBeenCalledWith({ where: { pipelineId } }); expect(m.create).not.toHaveBeenCalled();
});
