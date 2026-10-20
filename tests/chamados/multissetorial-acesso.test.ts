import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ usuario: vi.fn(), setores: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: { usuarios: { findUnique: mocks.usuario }, setor: { findMany: mocks.setores } } }));
import { chamadoDestinoEhTI, chamadoVisivelWhere, obterAtorChamados, podeAssumirChamado, podeConcluirChamado, podeResponderChamado, podeVerChamado, type AtorChamados, type ChamadoAcesso } from "@/lib/chamados/acesso";
const financeiro: AtorChamados = { id: 8, nome: "Ana", role: "Financeiro", setorId: 9, setorNome: "FINANCEIRO", visaoGlobal: false, gerenciaCategorias: false };
const chamado: ChamadoAcesso = { usuarioId: 1, tecnicoId: null, tecnicoSolicitadoId: null, status: "ABERTO", setorDestinoId: 9, setorDestino: { id: 9, nome: "FINANCEIRO", ativo: true, isBase: false } };
const admin: AtorChamados = { ...financeiro, id: 20, role: "Admin", setorId: 2, setorNome: "Admin", visaoGlobal: true };

describe("política multissetorial de chamados", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("revalida status e resolve role normalizada sem confiar na sessão", async () => {
    mocks.usuario.mockResolvedValue({ id: 8, nome: "Ana", role: "Financeiro", status: "ATIVO" });
    mocks.setores.mockResolvedValue([{ id: 9, nome: "FINANCEIRO" }]);
    expect(await obterAtorChamados(8)).toEqual(financeiro);
    mocks.usuario.mockResolvedValue({ id: 8, role: "TI", status: "INATIVO" });
    expect(await obterAtorChamados(8)).toBeNull();
  });
  it("não escolhe um setor arbitrário diante de nomes normalizados duplicados", async () => {
    mocks.usuario.mockResolvedValue({ id: 8, nome: "Ana", role: "T.I", status: "ATIVO" });
    mocks.setores.mockResolvedValue([{ id: 14, nome: "TI" }, { id: 15, nome: "T.I" }]);
    expect(await obterAtorChamados(8)).toMatchObject({ setorId: null });
  });
  it("equipe lê e assume; somente responsável atribuído atende e conclui", () => {
    expect(podeVerChamado(financeiro, chamado)).toBe(true);
    expect(podeAssumirChamado(financeiro, chamado)).toBe(true);
    expect(podeResponderChamado(financeiro, chamado)).toBe(false);
    expect(podeConcluirChamado(financeiro, chamado)).toBe(false);
    const assumido = { ...chamado, tecnicoId: 8, status: "EM_ATENDIMENTO" };
    expect(podeResponderChamado(financeiro, assumido)).toBe(true);
    expect(podeConcluirChamado(financeiro, assumido)).toBe(true);
  });
  it("administração pode assumir em outro setor e atender somente após atribuição", () => {
    expect(chamadoVisivelWhere(admin)).toEqual({});
    expect(podeVerChamado(admin, chamado)).toBe(true);
    expect(podeAssumirChamado(admin, chamado)).toBe(true);
    expect(podeResponderChamado(admin, chamado)).toBe(false);
    expect(podeConcluirChamado(admin, chamado)).toBe(false);
    expect(podeResponderChamado(admin, { ...chamado, tecnicoId: 20 })).toBe(true);
    expect(podeConcluirChamado(admin, { ...chamado, tecnicoId: 20, status: "EM_ATENDIMENTO" })).toBe(true);
    expect(podeConcluirChamado(admin, { ...chamado, tecnicoId: 8, status: "EM_ATENDIMENTO" })).toBe(false);
  });
  it.each(["TI", "T.I", "Admin", "CEO"])("%s assume destino externo sem depender de vínculo com o setor", (role) => {
    const ator = { ...admin, role, setorId: null, setorNome: null };
    expect(podeAssumirChamado(ator, chamado)).toBe(true);
    expect(podeAssumirChamado(ator, { ...chamado, tecnicoSolicitadoId: 8 })).toBe(false);
    expect(podeAssumirChamado(ator, { ...chamado, tecnicoId: 8 })).toBe(false);
    expect(podeAssumirChamado(ator, { ...chamado, status: "CONCLUIDO" })).toBe(false);
  });
  it("continua bloqueando atuação de colaborador comum em outro setor", () => {
    const outroSetor = { ...financeiro, setorId: 5, setorNome: "COMERCIAL", role: "COMERCIAL" };
    expect(podeAssumirChamado(outroSetor, chamado)).toBe(false);
    expect(podeResponderChamado(outroSetor, { ...chamado, tecnicoId: outroSetor.id })).toBe(false);
    expect(podeConcluirChamado(outroSetor, { ...chamado, tecnicoId: outroSetor.id, status: "EM_ATENDIMENTO" })).toBe(false);
  });
  it.each([
    null,
    { ...chamado.setorDestino!, ativo: false },
    { ...chamado.setorDestino!, isBase: true },
  ])("administração não atende destino inválido: %j", (setorDestino) => {
    expect(podeAssumirChamado(admin, { ...chamado, setorDestino })).toBe(false);
    expect(podeConcluirChamado(admin, { ...chamado, setorDestino, tecnicoId: admin.id, status: "EM_ATENDIMENTO" })).toBe(false);
  });
  it("reserva exclusiva continua exigida e autoatendimento do próprio setor é permitido", () => {
    expect(podeAssumirChamado(financeiro, { ...chamado, tecnicoSolicitadoId: 7 })).toBe(false);
    expect(podeAssumirChamado(financeiro, { ...chamado, tecnicoSolicitadoId: 8 })).toBe(true);
    expect(podeAssumirChamado(financeiro, { ...chamado, usuarioId: 8 })).toBe(true);
  });
  it("solicitante preserva leitura e chat quando destino é desativado, mas perde operação", () => {
    const desativado = { ...chamado, usuarioId: 8, tecnicoId: 8, status: "EM_ATENDIMENTO", setorDestino: { ...chamado.setorDestino!, ativo: false } };
    expect(podeVerChamado(financeiro, desativado)).toBe(true);
    expect(podeResponderChamado(financeiro, desativado)).toBe(true);
    expect(podeConcluirChamado(financeiro, desativado)).toBe(false);
  });
  it("legado sem destino permanece da TI independente da categoria histórica", () => {
    const legado = { ...chamado, setorDestinoId: null, setorDestino: null };
    expect(chamadoDestinoEhTI(legado)).toBe(true);
    expect(podeVerChamado(financeiro, legado)).toBe(false);
    const ti = { ...financeiro, role: "T.I", setorNome: "TI", setorId: 14 };
    expect(podeAssumirChamado(ti, legado)).toBe(true);
    expect(chamadoVisivelWhere(financeiro)).toEqual({ OR: [{ usuarioId: 8 }, { setorDestinoId: 9, setorDestino: { ativo: true, isBase: false } }] });
  });
});
