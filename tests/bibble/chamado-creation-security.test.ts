import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usuariosFindMany: vi.fn(),
  usuariosFindFirst: vi.fn(),
  chamadosFindFirst: vi.fn(),
  chamadosCreate: vi.fn(),
  transaction: vi.fn(),
  notificar: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    usuarios: { findMany: mocks.usuariosFindMany },
    chamados: {
      findFirst: mocks.chamadosFindFirst,
      create: mocks.chamadosCreate,
    },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/chamados/notificacoes-server", () => ({
  notificarNovoChamado: mocks.notificar,
}));
vi.mock("@/lib/cnpj/receita-federal", () => ({ getReceitaData: vi.fn() }));
vi.mock("@/lib/bibble/gerar-ficha-server", () => ({ gerarFichaServer: vi.fn() }));
vi.mock("@/lib/bibble/calendar-tools", () => ({
  executarCalendarTool: vi.fn(),
  isCalendarTool: vi.fn(() => false),
}));

import { executarTool, type UserCtx } from "@/lib/bibble/tool-executor";
import {
  consumeBibbleMutationGrant,
  issueBibbleMutationGrant,
  type BibbleMutationGrant,
} from "@/lib/bibble/mutation-grant";

const requester: UserCtx = {
  userId: 10,
  userName: "Solicitante",
  role: "USER",
  permissoes: [],
};

const authorizedRequest = "Abra um chamado para Exclusão do manual de CS/NPS. Substituído por versão mais completa, autorizada pela Thaís. Responsável Vinicius.";

function grant(userId = requester.userId, requestId = "req-ticket", authorizedText = authorizedRequest) {
  return issueBibbleMutationGrant({
    userId,
    requestId,
    tool: "abrir_chamado",
    expiresAt: Date.now() + 60_000,
    authorizedText,
  });
}

function options(mutationGrant?: BibbleMutationGrant, requestId = "req-ticket") {
  return {
    requestId,
    deadlineAt: Date.now() + 60_000,
    mutationGrant,
  };
}

const validParams = {
  titulo: "Exclusão do manual de CS/NPS",
  descricao: "Substituído por versão mais completa, autorizada pela Thaís",
  responsavel: "Vinicius",
};

describe("Bibble ticket mutation grant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chamadosFindFirst.mockResolvedValue(null);
    mocks.usuariosFindFirst.mockImplementation(async (query: { where?: { id?: number } }) => (
      query.where?.id === requester.userId
        ? { id: requester.userId }
        : { id: 44, nome: "Vinicius de Souza", role: "TI" }
    ));
    mocks.chamadosCreate.mockResolvedValue({
      id: 321,
      titulo: validParams.titulo,
      prioridade: "MEDIA",
      createdAt: new Date("2026-09-17T12:00:00.000Z"),
    });
    mocks.notificar.mockResolvedValue(true);
    mocks.usuariosFindMany.mockResolvedValue([
      { id: 44, nome: "Vinicius de Souza", role: "TI" },
    ]);
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      usuarios: { findFirst: mocks.usuariosFindFirst },
      chamados: {
        findFirst: mocks.chamadosFindFirst,
        create: mocks.chamadosCreate,
      },
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates the requested ticket once and resolves a unique active TI by name", async () => {
    const result = await executarTool("abrir_chamado", validParams, requester, options(grant()));

    expect(result).toContain("SUCESSO_ABRIR_CHAMADO: Chamado #321");
    expect(mocks.chamadosCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        titulo: validParams.titulo,
        prioridade: "MEDIA",
        categoria: "Outro",
        usuarioId: requester.userId,
        tecnicoSolicitadoId: 44,
        status: "ABERTO",
      }),
    });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(mocks.notificar).toHaveBeenCalledWith({
      chamadoId: 321,
      titulo: validParams.titulo,
      usuario: requester.userName,
      setor: requester.role,
      urgencia: "MEDIA",
      createdAt: "2026-09-17T12:00:00.000Z",
    });
  });

  it("accepts an explicitly mentioned ALTA priority", async () => {
    mocks.chamadosCreate.mockResolvedValueOnce({
      id: 322,
      titulo: "Falha no acesso fiscal",
      prioridade: "ALTA",
      createdAt: new Date("2026-09-17T12:00:00.000Z"),
    });
    const params = {
      titulo: "Falha no acesso fiscal",
      descricao: "Usuário não consegue acessar o módulo fiscal",
      prioridade: "ALTA",
    };
    const authorizedText = "Abra um chamado. Falha no acesso fiscal. Usuário não consegue acessar o módulo fiscal. Prioridade ALTA.";

    const result = await executarTool(
      "abrir_chamado",
      params,
      requester,
      options(grant(requester.userId, "req-ticket", authorizedText)),
    );

    expect(result).toContain("SUCESSO_ABRIR_CHAMADO");
    expect(mocks.chamadosCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ prioridade: "ALTA" }),
    });
  });

  it("matches authorized Portuguese text after Unicode accent normalization", async () => {
    const params = {
      titulo: "Correção de acesso à área fiscal",
      descricao: "Usuário não consegue emitir a certidão",
    };
    const authorizedText = "Abra um chamado para correcao de acesso a area fiscal. Usuario nao consegue emitir a certidao.";

    const result = await executarTool(
      "abrir_chamado",
      params,
      requester,
      options(grant(requester.userId, "req-ticket", authorizedText)),
    );

    expect(result).toContain("SUCESSO_ABRIR_CHAMADO");
    expect(mocks.chamadosCreate).toHaveBeenCalledTimes(1);
  });

  it("keeps the successful creation authoritative when notification delivery fails", async () => {
    mocks.notificar.mockRejectedValueOnce(new Error("notification unavailable"));
    const result = await executarTool("abrir_chamado", validParams, requester, options(grant()));

    expect(result).toContain("SUCESSO_ABRIR_CHAMADO");
    expect(mocks.chamadosCreate).toHaveBeenCalledTimes(1);
  });

  it("keeps success and emits a sanitized warning when notification returns false", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.notificar.mockResolvedValueOnce(false);

    const result = await executarTool("abrir_chamado", validParams, requester, options(grant()));

    expect(result).toContain("SUCESSO_ABRIR_CHAMADO");
    expect(warn).toHaveBeenCalledWith("[BIBBLE_TOOL] notification-failed", {
      requestId: "req-ticket",
      tool: "abrir_chamado",
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain(validParams.titulo);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(validParams.descricao);
    warn.mockRestore();
  });

  it("denies an absent, forged, expired, reused, or cross-user grant", async () => {
    const absent = await executarTool("abrir_chamado", validParams, requester, options());
    const forged = await executarTool(
      "abrir_chamado",
      validParams,
      requester,
      options(Object.freeze({}) as BibbleMutationGrant),
    );

    const crossUserGrant = grant(requester.userId);
    const crossUser = await executarTool(
      "abrir_chamado",
      validParams,
      { ...requester, userId: 11 },
      options(crossUserGrant),
    );
    const consumedAfterCrossUser = await executarTool(
      "abrir_chamado",
      validParams,
      requester,
      options(crossUserGrant),
    );
    const wrongRequestGrant = grant(requester.userId, "req-original");
    const wrongRequest = await executarTool(
      "abrir_chamado",
      validParams,
      requester,
      options(wrongRequestGrant, "req-adulterado"),
    );
    const reusedAfterWrongRequest = await executarTool(
      "abrir_chamado",
      validParams,
      requester,
      options(wrongRequestGrant, "req-original"),
    );

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T12:00:00.000Z"));
    const expiring = issueBibbleMutationGrant({
      userId: requester.userId,
      requestId: "req-expired",
      tool: "abrir_chamado",
      expiresAt: Date.now() + 1_000,
      authorizedText: authorizedRequest,
    });
    vi.advanceTimersByTime(1_001);
    const expired = consumeBibbleMutationGrant(expiring, {
      userId: requester.userId,
      requestId: "req-expired",
      tool: "abrir_chamado",
    });

    for (const result of [absent, forged, crossUser, consumedAfterCrossUser, wrongRequest, reusedAfterWrongRequest]) {
      expect(result).toContain("não foi autorizada neste turno");
    }
    expect(expired).toBeNull();
    expect(mocks.chamadosCreate).not.toHaveBeenCalled();
  });

  it("rejects model-supplied IDs and unresolved, ambiguous, or non-TI responsible names", async () => {
    const withId = await executarTool(
      "abrir_chamado",
      { ...validParams, tecnicoSolicitadoId: 44 },
      requester,
      options(grant()),
    );
    expect(withId).toContain("dados do chamado são inválidos");

    mocks.usuariosFindMany.mockResolvedValueOnce([]);
    const missing = await executarTool("abrir_chamado", validParams, requester, options(grant()));
    expect(missing).toContain("não corresponde a um usuário de TI ativo");

    mocks.usuariosFindMany.mockResolvedValueOnce([
      { id: 44, nome: "Vinicius de Souza", role: "TI" },
      { id: 45, nome: "Vinicius Almeida", role: "T.I" },
    ]);
    const ambiguous = await executarTool("abrir_chamado", validParams, requester, options(grant()));
    expect(ambiguous).toContain("mais de um usuário de TI ativo");

    mocks.usuariosFindMany.mockResolvedValueOnce([
      { id: 46, nome: "Vinicius", role: "COMERCIAL" },
    ]);
    const nonTi = await executarTool("abrir_chamado", validParams, requester, options(grant()));
    expect(nonTi).toContain("não corresponde a um usuário de TI ativo");
    expect(mocks.chamadosCreate).not.toHaveBeenCalled();
  });

  it("binds every persisted field to literal text from the authorized current turn", async () => {
    const generic = await executarTool(
      "abrir_chamado",
      validParams,
      requester,
      options(grant(requester.userId, "req-ticket", "Abra um chamado.")),
    );
    expect(generic).toContain("não foram informados literalmente");

    const inventedPayload = await executarTool(
      "abrir_chamado",
      { ...validParams, titulo: "Acesso administrativo urgente" },
      requester,
      options(grant()),
    );
    expect(inventedPayload).toContain("não foram informados literalmente");

    const inventedPriority = await executarTool(
      "abrir_chamado",
      { ...validParams, prioridade: "ALTA" },
      requester,
      options(grant()),
    );
    expect(inventedPriority).toContain("não foram informados literalmente");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.chamadosCreate).not.toHaveBeenCalled();
  });

  it("revalidates the requester inside the serializable transaction immediately before write", async () => {
    mocks.usuariosFindFirst.mockResolvedValueOnce(null);

    const result = await executarTool("abrir_chamado", validParams, requester, options(grant()));

    expect(result).toContain("usuário não está mais ativo");
    expect(mocks.usuariosFindFirst).toHaveBeenCalledWith({
      where: { id: requester.userId, status: "ATIVO" },
      select: { id: true },
    });
    expect(mocks.chamadosFindFirst).not.toHaveBeenCalled();
    expect(mocks.chamadosCreate).not.toHaveBeenCalled();
  });

  it("revalidates the selected technician inside the transaction immediately before write", async () => {
    mocks.usuariosFindFirst
      .mockResolvedValueOnce({ id: requester.userId })
      .mockResolvedValueOnce(null);

    const result = await executarTool("abrir_chamado", validParams, requester, options(grant()));

    expect(result).toContain("responsável de TI deixou de estar elegível");
    expect(mocks.usuariosFindFirst).toHaveBeenNthCalledWith(2, {
      where: { id: 44, status: "ATIVO" },
      select: { id: true, nome: true, role: true },
    });
    expect(mocks.chamadosCreate).not.toHaveBeenCalled();
  });

  it("fails closed when the technician stays active but changes role or no longer matches the requested name", async () => {
    mocks.usuariosFindFirst
      .mockResolvedValueOnce({ id: requester.userId })
      .mockResolvedValueOnce({ id: 44, nome: "Vinicius de Souza", role: "COMERCIAL" });
    const changedRole = await executarTool("abrir_chamado", validParams, requester, options(grant()));
    expect(changedRole).toContain("responsável de TI deixou de estar elegível");

    mocks.usuariosFindFirst
      .mockResolvedValueOnce({ id: requester.userId })
      .mockResolvedValueOnce({ id: 44, nome: "Carlos Silva", role: "TI" });
    const changedName = await executarTool(
      "abrir_chamado",
      validParams,
      requester,
      options(grant(requester.userId, "req-ticket-name"), "req-ticket-name"),
    );
    expect(changedName).toContain("responsável de TI deixou de estar elegível");
    expect(mocks.chamadosCreate).not.toHaveBeenCalled();
  });

  it("returns failure without false success when the Serializable transaction aborts", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.transaction.mockRejectedValueOnce(new Error("serialization conflict"));

    const result = await executarTool("abrir_chamado", validParams, requester, options(grant()));

    expect(result).toContain("FALHA_ABRIR_CHAMADO");
    expect(result).not.toContain("SUCESSO_ABRIR_CHAMADO");
    expect(mocks.chamadosCreate).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith("[BIBBLE_TOOL] execution-failed", {
      requestId: "req-ticket",
      tool: "abrir_chamado",
    });
    errorLog.mockRestore();
  });

  it("uses a Serializable transaction for the five-minute dedupe and a sequential retry creates once", async () => {
    mocks.chamadosFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 321 });

    const first = await executarTool("abrir_chamado", validParams, requester, options(grant()));
    const second = await executarTool(
      "abrir_chamado",
      validParams,
      requester,
      options(grant(requester.userId, "req-ticket-2"), "req-ticket-2"),
    );

    expect(first).toContain("SUCESSO_ABRIR_CHAMADO");
    expect(second).toContain("já havia sido registrado há poucos minutos");
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(mocks.transaction).toHaveBeenNthCalledWith(1, expect.any(Function), { isolationLevel: "Serializable" });
    expect(mocks.transaction).toHaveBeenNthCalledWith(2, expect.any(Function), { isolationLevel: "Serializable" });
    expect(mocks.chamadosCreate).toHaveBeenCalledTimes(1);
  });
});
