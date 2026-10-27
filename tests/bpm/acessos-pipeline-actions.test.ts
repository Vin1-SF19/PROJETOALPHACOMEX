import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), acesso: vi.fn(), count: vi.fn(), update: vi.fn(), remove: vi.fn(), create: vi.fn(), audit: vi.fn(), transaction: vi.fn(), notify: vi.fn(), usuarios: vi.fn(), pipeline: vi.fn(), setores: vi.fn() }));
vi.mock("../../auth", () => ({ auth: m.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoConfigPipeline: m.acesso, listarUsuariosVinculaveisBpm: m.usuarios }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: m.notify }));
vi.mock("@/lib/prisma", () => ({ default: { bpmPipeline: { findUnique: m.pipeline }, setor: { count: m.count, findMany: m.setores }, $transaction: m.transaction } }));
import { SalvarAcessosPipelineBpm, LerAcessosPipelineBpm } from "@/actions/bpm/AcessosPipeline";
import type { RegraAcessoPipeline } from "@/lib/bpm/acesso-pipeline";
const pipelineId = "clw000000000000000pipeline";
const regras: RegraAcessoPipeline[] = [{ tipo: "SETOR", id: 3, nivel: "PADRAO" }, { tipo: "USUARIO", id: 7, nivel: "ADMINISTRATIVO" }];
const tx = { bpmPipeline: { updateMany: m.update, findUnique: m.pipeline }, setor: { count: m.count }, bpmPipelineSetor: { deleteMany: m.remove, createMany: m.create }, bpmPipelineConfigAuditoria: { create: m.audit } };
beforeEach(() => {
  vi.clearAllMocks(); m.auth.mockResolvedValue({ user: { id: "1" } }); m.acesso.mockResolvedValue(undefined);
  m.count.mockImplementation(({ where }) => Promise.resolve(where.id.in.length));
  m.usuarios.mockResolvedValue([{ id: 7, nome: "Ana" }]);
  m.pipeline.mockResolvedValue({ configVersion: 4, visualizacaoConfigJson: null, setores: [] });
  m.setores.mockResolvedValue([{ id: 3, nome: "Comercial" }]);
  m.update.mockResolvedValue({ count: 1 }); m.notify.mockResolvedValue(undefined);
  m.transaction.mockImplementation((fn) => fn(tx));
});
it("salva regras do funil com revisão, auditoria e relação setorial na mesma transação", async () => {
  expect(await SalvarAcessosPipelineBpm({ pipelineId, versao: 4, regras })).toEqual({ success: true, versao: 5 });
  expect(m.remove).toHaveBeenCalledWith({ where: { pipelineId } });
  expect(m.create).toHaveBeenCalledWith({ data: [{ pipelineId, setorId: 3 }] });
  expect(m.update).toHaveBeenCalledWith({ where: { id: pipelineId, configVersion: 4 }, data: { configVersion: { increment: 1 }, visualizacaoConfigJson: JSON.stringify({ permissoesPipeline: { version: 2, regras } }) } });
  expect(m.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ pipelineId, adminId: 1, campoAlterado: "acessos_pipeline", valorNovoJson: JSON.stringify(regras) }) });
  expect(m.acesso).toHaveBeenLastCalledWith(1, "configurarEtapas", tx);
  expect(m.usuarios).toHaveBeenCalledWith(tx);
});
it("seleção vazia revoga concessões e preserva configuração de closers", async () => {
  const distribuicaoClosers = { ativa: true, usuariosIds: [7], ultimoUsuarioId: 7 };
  m.pipeline.mockResolvedValue({ setores: [{ setor: { id: 3, nome: "Comercial" } }], visualizacaoConfigJson: JSON.stringify({ version: 1, supervisores: [], usuariosAutorizados: [7], distribuicaoClosers }) });
  expect(await SalvarAcessosPipelineBpm({ pipelineId, versao: 4, regras: [] })).toMatchObject({ success: true });
  expect(m.create).not.toHaveBeenCalled();
  expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ visualizacaoConfigJson: JSON.stringify({ distribuicaoClosers, permissoesPipeline: { version: 2, regras: [] } }) }) }));
});
it("rejeita conflito antes de tocar relações e não notifica", async () => {
  m.update.mockResolvedValue({ count: 0 });
  expect(await SalvarAcessosPipelineBpm({ pipelineId, versao: 4, regras })).toMatchObject({ success: false, error: expect.stringContaining("mudou") });
  expect(m.remove).not.toHaveBeenCalled(); expect(m.notify).not.toHaveBeenCalled();
});
it("nega setor inativo/inexistente e usuário sem acesso efetivo ao CRM", async () => {
  m.count.mockResolvedValueOnce(0);
  expect(await SalvarAcessosPipelineBpm({ pipelineId, versao: 4, regras })).toMatchObject({ success: false });
  m.usuarios.mockResolvedValueOnce([]);
  expect(await SalvarAcessosPipelineBpm({ pipelineId, versao: 4, regras })).toMatchObject({ success: false });
  expect(m.update).not.toHaveBeenCalled();
});
it("nega ator comum e revalida revogação do ator dentro da transação", async () => {
  m.acesso.mockRejectedValueOnce(new Error("Não autorizado"));
  expect(await SalvarAcessosPipelineBpm({ pipelineId, versao: 4, regras })).toMatchObject({ success: false });
  expect(m.transaction).not.toHaveBeenCalled();
  m.acesso.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Não autorizado"));
  expect(await SalvarAcessosPipelineBpm({ pipelineId, versao: 4, regras })).toMatchObject({ success: false });
  expect(m.update).not.toHaveBeenCalled();
});
it("não aceita payload antigo, duplicatas ou chaves extras", async () => {
  for (const input of [{ pipelineId, versao: 4, setorIds: [3] }, { pipelineId, versao: 4, regras: [regras[0], regras[0]] }, { pipelineId, versao: 4, regras, admin: true }]) {
    expect(await SalvarAcessosPipelineBpm(input)).toMatchObject({ success: false });
  }
  expect(m.transaction).not.toHaveBeenCalled();
});
it("lê regras publicadas e converte apenas concessões existentes sem supervisão", async () => {
  m.pipeline.mockResolvedValue({ configVersion: 5, setores: [{ setor: { id: 3, nome: "Comercial" } }], visualizacaoConfigJson: JSON.stringify({ version: 1, supervisores: [{ usuarioId: 99, setorIds: [3] }], usuariosAutorizados: [7] }) });
  expect(await LerAcessosPipelineBpm(pipelineId)).toMatchObject({ success: true, data: { versao: 5, regras: [{ tipo: "SETOR", id: 3, nivel: "PADRAO" }, { tipo: "USUARIO", id: 7, nivel: "PADRAO" }] } });
});
