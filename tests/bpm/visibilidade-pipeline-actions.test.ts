import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), acesso: vi.fn(), count: vi.fn(), update: vi.fn(), before: vi.fn(), remove: vi.fn(), create: vi.fn(), audit: vi.fn(), transaction: vi.fn(), notify: vi.fn(), usuarios: vi.fn(), config: vi.fn(), setores: vi.fn(), pipeline: vi.fn() }));
vi.mock("../../auth", () => ({ auth: m.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoConfigPipeline: m.acesso, listarUsuariosVinculaveisBpm: m.usuarios }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: m.notify }));
vi.mock("@/lib/prisma", () => ({ default: { bpmPipeline: { findUnique: m.pipeline }, setor: { count: m.count, findMany: m.setores }, $transaction: m.transaction } }));
import { SalvarVisibilidadePipelineBpm, LerVisibilidadePipelineBpm } from "@/actions/bpm/VisibilidadePipeline";
const pipelineId = "clw000000000000000pipeline";
beforeEach(() => {
  vi.clearAllMocks(); m.auth.mockResolvedValue({ user: { id: "1" } }); m.acesso.mockResolvedValue(undefined); m.count.mockResolvedValue(1);
  m.usuarios.mockResolvedValue([{ id: 7, nome: "Líder" }]); m.config.mockResolvedValue({ visualizacaoConfigJson: null });
  m.before.mockResolvedValue([{ setorId: 2 }]); m.update.mockResolvedValue({ count: 1 }); m.notify.mockResolvedValue(undefined);
  m.transaction.mockImplementation((fn) => fn({ bpmPipeline: { updateMany: m.update, findUnique: m.config }, bpmPipelineSetor: { findMany: m.before, deleteMany: m.remove, createMany: m.create }, bpmPipelineConfigAuditoria: { create: m.audit } }));
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

it("salva supervisores e setores com CAS e auditoria independente", async () => {
  const visualizacao = { version: 1, supervisores: [{ usuarioId: 7, setorIds: [3] }] };
  expect(await SalvarVisibilidadePipelineBpm({ pipelineId, versao: 4, setorIds: [3], visualizacao })).toEqual({ success: true, versao: 5 });
  expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ data: { configVersion: { increment: 1 }, visualizacaoConfigJson: JSON.stringify(visualizacao) } }));
  expect(m.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ campoAlterado: "visualizacao_equipe", valorAnteriorJson: null, valorNovoJson: JSON.stringify(visualizacao) }) });
});
it("rejeita supervisor sem CRM e setor de equipe inválido antes da transação", async () => {
  const visualizacao = { version: 1, supervisores: [{ usuarioId: 99, setorIds: [3] }] };
  expect(await SalvarVisibilidadePipelineBpm({ pipelineId, versao: 4, setorIds: [3], visualizacao })).toMatchObject({ success: false });
  expect(m.transaction).not.toHaveBeenCalled();
  visualizacao.supervisores[0].usuarioId = 7; m.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
  expect(await SalvarVisibilidadePipelineBpm({ pipelineId, versao: 4, setorIds: [3], visualizacao })).toMatchObject({ success: false });
  expect(m.transaction).not.toHaveBeenCalled();
});
it("lê de volta a configuração publicada", async () => {
  const visualizacao = { version: 1, supervisores: [{ usuarioId: 7, setorIds: [3] }] };
  m.pipeline.mockResolvedValue({ configVersion: 5, setores: [{ setorId: 3 }], visualizacaoConfigJson: JSON.stringify(visualizacao) });
  m.setores.mockResolvedValue([{ id: 3, nome: "Comercial" }]);
  expect(await LerVisibilidadePipelineBpm(pipelineId)).toMatchObject({ success: true, data: { versao: 5, visualizacao, usuarios: [{ id: 7, nome: "Líder" }] } });
});

it("salva exceções por pessoa preservando legado e audita a lista", async () => {
  const anterior = { version: 1, supervisores: [{ usuarioId: 8, setorIds: [3] }] };
  m.config.mockResolvedValue({ visualizacaoConfigJson: JSON.stringify(anterior) });
  expect(await SalvarVisibilidadePipelineBpm({ pipelineId, versao: 4, setorIds: [3], usuariosAutorizados: [7, 7] })).toMatchObject({ success: true });
  expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ visualizacaoConfigJson: JSON.stringify({ ...anterior, usuariosAutorizados: [7] }) }) }));
  expect(m.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ campoAlterado: "acesso_individual_pipeline", valorNovoJson: "[7]" }) });
});
it("nega exceções fora do catálogo ativo CRM e preserva lista em payload antigo", async () => {
  expect(await SalvarVisibilidadePipelineBpm({ pipelineId, versao: 4, setorIds: [3], usuariosAutorizados: [99] })).toMatchObject({ success: false });
  expect(m.transaction).not.toHaveBeenCalled();
  const visualizacao = { version: 1, supervisores: [] };
  m.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
  m.config.mockResolvedValue({ visualizacaoConfigJson: JSON.stringify({ ...visualizacao, usuariosAutorizados: [7] }) });
  expect(await SalvarVisibilidadePipelineBpm({ pipelineId, versao: 4, setorIds: [3], visualizacao })).toMatchObject({ success: true });
  expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ visualizacaoConfigJson: JSON.stringify({ ...visualizacao, usuariosAutorizados: [7] }) }) }));
});
it("remove autorização explicitamente e lê de volta as pessoas", async () => {
  m.config.mockResolvedValue({ visualizacaoConfigJson: JSON.stringify({ version: 1, supervisores: [], usuariosAutorizados: [7] }) });
  expect(await SalvarVisibilidadePipelineBpm({ pipelineId, versao: 4, setorIds: [3], usuariosAutorizados: [] })).toMatchObject({ success: true });
  expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ visualizacaoConfigJson: JSON.stringify({ version: 1, supervisores: [], usuariosAutorizados: [] }) }) }));
  m.pipeline.mockResolvedValue({ configVersion: 5, setores: [], visualizacaoConfigJson: JSON.stringify({ version: 1, usuariosAutorizados: [7] }) });
  expect(await LerVisibilidadePipelineBpm(pipelineId)).toMatchObject({ success: true, data: { usuariosAutorizados: [7] } });
});

it("ignora autorizações aninhadas em payload legado, sem conceder nem revogar acesso", async () => {
  m.count.mockImplementation(({ where }) => Promise.resolve(where.id.in.length));
  const original = { version: 1, supervisores: [], usuariosAutorizados: [7] };
  m.config.mockResolvedValue({ visualizacaoConfigJson: JSON.stringify(original) });
  for (const ids of [[99], []]) {
    expect(await SalvarVisibilidadePipelineBpm({ pipelineId, versao: 4, setorIds: [3], visualizacao: { version: 1, supervisores: [], usuariosAutorizados: ids } })).toMatchObject({ success: true });
    expect(m.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ visualizacaoConfigJson: JSON.stringify(original) }) }));
  }
  expect(m.audit).not.toHaveBeenCalledWith({ data: expect.objectContaining({ campoAlterado: "acesso_individual_pipeline" }) });
});
