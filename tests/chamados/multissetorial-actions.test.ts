import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(), usuario: vi.fn(), setores: vi.fn(), setor: vi.fn(), categoria: vi.fn(), categoriaCreate: vi.fn(), categoriaUpdate: vi.fn(), categoriaDelete: vi.fn(),
  chamado: vi.fn(), duplicado: vi.fn(), criarChamado: vi.fn(), count: vi.fn(), marcar: vi.fn(), transaction: vi.fn(),
}));
const tx = {
  usuarios: { findUnique: mocks.usuario }, setor: { findUnique: mocks.setor, findMany: mocks.setores },
  chamadoCategoria: { findUnique: mocks.categoria, create: mocks.categoriaCreate, update: mocks.categoriaUpdate, delete: mocks.categoriaDelete },
  chamados: { findUnique: mocks.chamado, findFirst: mocks.duplicado, create: mocks.criarChamado, count: mocks.count },
};
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {
  usuarios: { findUnique: mocks.usuario },
  setor: { findUnique: mocks.setor, findMany: mocks.setores },
  chamadoCategoria: { findUnique: mocks.categoria, create: mocks.categoriaCreate, update: mocks.categoriaUpdate, delete: mocks.categoriaDelete },
  chamados: { findUnique: mocks.chamado, findFirst: mocks.duplicado, create: mocks.criarChamado, count: mocks.count },
  mensagensChamado: { updateMany: mocks.marcar }, $transaction: mocks.transaction } }));
vi.mock("@/lib/pusher-server.ts", () => ({ pusherServer: { trigger: vi.fn() } }));
vi.mock("@/lib/chamados/notificacoes-server", () => ({ notificarAgendaChamadoAtualizada: vi.fn(), notificarChamadoAssumido: vi.fn(), notificarChamadoConcluido: vi.fn(), notificarMensagemChamado: vi.fn(), notificarNovoChamado: vi.fn() }));
vi.mock("@/lib/chamados/tarefa-agendada", () => ({ concluirTarefaAgendadaDoChamado: vi.fn(), criarTarefaAgendadaParaChamado: vi.fn() }));
import { marcarComoLidaAction } from "@/actions/chamados";
import { salvarCategoriaChamado, excluirCategoriaChamado } from "@/actions/chamados-categorias";
import { criarChamadoMultissetorial } from "@/lib/chamados/criacao";
import { criarChamadoSchema } from "@/lib/chamados/schemas";
const dados = { titulo: "Acesso", descricao: "Falha ao acessar", prioridade: "MEDIA" as const, setorDestinoId: 9, categoriaId: 5, tecnicoSolicitadoId: null, dataDesejadaConclusao: null };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "8", role: "TI" } });
  mocks.usuario.mockResolvedValue({ id: 8, nome: "Ana", role: "TI", status: "ATIVO" });
  mocks.setores.mockResolvedValue([{ id: 14, nome: "TI" }, { id: 9, nome: "Financeiro" }]);
  mocks.setor.mockResolvedValue({ id: 9, nome: "Financeiro", ativo: true, isBase: false });
  mocks.categoria.mockResolvedValue({ id: 5, setorId: 9, nome: "Pagamentos", ativo: true });
  mocks.duplicado.mockResolvedValue(null);
  mocks.criarChamado.mockResolvedValue({ id: 12 });
  mocks.transaction.mockImplementation(async (callback) => callback(tx));
});
describe("criação multissetorial", () => {
  it("exige destino e categoria mesmo quando o cliente envia categoria legada", () => {
    expect(criarChamadoSchema.safeParse({ ...dados, setorDestinoId: undefined, categoriaId: undefined, categoria: "Hardware" }).success).toBe(false);
  });
  it("valida categoria contra o setor e não cria combinação adulterada", async () => {
    mocks.categoria.mockResolvedValue({ id: 5, setorId: 14, ativo: true });
    await expect(criarChamadoMultissetorial(8, dados)).rejects.toThrow(/categoria ativa do setor/);
    expect(mocks.criarChamado).not.toHaveBeenCalled();
  });
  it("rejeita categorias arquivadas e destinos inativos", async () => {
    mocks.categoria.mockResolvedValue({ id: 5, setorId: 9, ativo: false });
    await expect(criarChamadoMultissetorial(8, dados)).rejects.toThrow(/categoria ativa/);
    mocks.setor.mockResolvedValue({ id: 9, ativo: false, isBase: false });
    await expect(criarChamadoMultissetorial(8, dados)).rejects.toThrow(/setor ativo/);
  });
  it("valida reserva contra colaborador ativo do destino", async () => {
    await expect(criarChamadoMultissetorial(8, { ...dados, tecnicoSolicitadoId: 8 })).rejects.toThrow(/responsável solicitado/);
    expect(mocks.criarChamado).not.toHaveBeenCalled();
  });
  it("preserva snapshots e escopa deduplicação ao destino", async () => {
    await criarChamadoMultissetorial(8, dados);
    expect(mocks.duplicado).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ usuarioId: 8, setorDestinoId: 9, titulo: "Acesso" }) }));
    expect(mocks.criarChamado).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ categoriaId: 5, categoria: "Pagamentos", setorDestinoId: 9, setorDestinoNome: "Financeiro" }) }));
  });
  it("marcador Bibble não consome o limite do texto e reserva confirma nome dentro da transação", async () => {
    await criarChamadoMultissetorial(8, { ...dados, descricao: "x".repeat(800) }, { origemBibble: true });
    expect(mocks.criarChamado).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ descricao: "[Aberto via Bibble]\n\n" + "x".repeat(800) }) }));
    mocks.usuario.mockResolvedValueOnce({ id: 8, nome: "Autor", role: "TI", status: "ATIVO" }).mockResolvedValueOnce({ id: 7, nome: "Carla", role: "Financeiro", status: "ATIVO" });
    await expect(criarChamadoMultissetorial(8, { ...dados, tecnicoSolicitadoId: 7 }, { responsavelNome: "Carlos" })).rejects.toThrow(/não corresponde/);
  });

});
describe("gerenciamento de categorias", () => {
  it.each(["Admin", "CEO", "Financeiro"])("nega gestão ao perfil %s mesmo com sessão declarando TI", async (role) => {
    mocks.usuario.mockResolvedValue({ id: 8, nome: "Ana", role, status: "ATIVO" });
    expect(await salvarCategoriaChamado({ setorId: 9, nome: "Pagar" })).toMatchObject({ success: false });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("normaliza unicidade do mesmo modo que catálogo inicial e preserva histórico", async () => {
    await salvarCategoriaChamado({ setorId: 9, nome: "  Conciliação  ", descricao: "Conferência" });
    expect(mocks.categoriaCreate).toHaveBeenCalledWith({ data: { setorId: 9, nome: "Conciliação", nomeNormalizado: "CONCILIACAO", descricao: "Conferência" } });
    mocks.count.mockResolvedValue(1);
    expect(await excluirCategoriaChamado(5)).toEqual({ success: true, arquivada: true });
    expect(mocks.categoriaUpdate).toHaveBeenCalledWith({ where: { id: 5 }, data: { ativo: false } });
    expect(mocks.categoriaDelete).not.toHaveBeenCalled();
  });
  it("exclui somente categoria sem histórico e impede transferir categoria entre setores", async () => {
    mocks.count.mockResolvedValue(0);
    expect(await excluirCategoriaChamado(5)).toEqual({ success: true, arquivada: false });
    expect(mocks.categoriaDelete).toHaveBeenCalledWith({ where: { id: 5 } });
    expect(await salvarCategoriaChamado({ id: 5, setorId: 14, nome: "Nova" })).toMatchObject({ success: false });
  });
});
describe("marcação de leitura", () => {
  it("bloqueia sessão ausente e não consulta ID protegido", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await marcarComoLidaAction(12, true)).toMatchObject({ error: expect.any(String) });
    expect(mocks.marcar).not.toHaveBeenCalled();
  });
  it("ignora isAdmin recebido e calcula lado pelo solicitante persistido", async () => {
    mocks.chamado.mockResolvedValue({ id: 12, usuarioId: 8, tecnicoId: null, setorDestinoId: 9, setorDestino: { id: 9, nome: "Financeiro", ativo: true, isBase: false } });
    expect(await marcarComoLidaAction(12, true)).toEqual({ success: true });
    expect(mocks.marcar).toHaveBeenCalledWith({ where: { chamadoId: 12, autorId: { not: 8 } }, data: { lida_usuario: true } });
  });
  it("observador global e colega sem atribuição não marcam leitura de atendimento", async () => {
    mocks.chamado.mockResolvedValue({ id: 12, usuarioId: 1, tecnicoId: 6, setorDestinoId: 9, setorDestino: { id: 9, nome: "Financeiro", ativo: true, isBase: false } });
    expect(await marcarComoLidaAction(12, true)).toEqual({ success: true });
    expect(mocks.marcar).not.toHaveBeenCalled();
    mocks.usuario.mockResolvedValue({ id: 8, nome: "Ana", role: "Comercial", status: "ATIVO" });
    expect(await marcarComoLidaAction(12, true)).toMatchObject({ error: expect.any(String) });
    expect(mocks.marcar).not.toHaveBeenCalled();
  });
});
