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
  it("visão global não concede operação em outro setor", () => {
    expect(chamadoVisivelWhere(admin)).toEqual({});
    expect(podeVerChamado(admin, chamado)).toBe(true);
    expect(podeAssumirChamado(admin, chamado)).toBe(false);
    expect(podeResponderChamado(admin, { ...chamado, tecnicoId: 20 })).toBe(false);
    expect(podeConcluirChamado(admin, { ...chamado, tecnicoId: 20, status: "EM_ATENDIMENTO" })).toBe(false);
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
