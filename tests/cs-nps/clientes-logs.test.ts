import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  log_cs: {
    create: vi.fn(),
    update: vi.fn(),
  },
  logFeedback: {
    create: vi.fn(),
    update: vi.fn(),
  },
  socios: {
    delete: vi.fn(),
  },
}));

const authMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import {
  atualizarLogCS,
  atualizarLogFeedback,
  excluirSocio,
  salvarLogCS,
  salvarLogFeedback,
} from "@/actions/Clientes";

describe("ações dos modais de CS e Feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: "7", nome: "Ana Responsável" },
    });
  });

  it("cria o CS imediatamente e devolve o registro persistido", async () => {
    const dataRegistro = new Date("2026-07-23T15:00:00.000Z");
    const registro = {
      id: 31,
      colaborador: "Ana Responsável",
      sentimento: "pos",
      observacao: "Cliente está satisfeito",
      clienteId: 10,
      dataRegistro,
    };
    prismaMock.log_cs.create.mockResolvedValue(registro);

    const resultado = await salvarLogCS(10, {
      sentimento: "pos",
      observacao: "Cliente está satisfeito",
      data_registro: dataRegistro.toISOString(),
    });

    expect(resultado).toEqual({ success: true, data: registro });
    expect(prismaMock.log_cs.create).toHaveBeenCalledWith({
      data: {
        colaborador: "Ana Responsável",
        sentimento: "pos",
        observacao: "Cliente está satisfeito",
        clienteId: 10,
        dataRegistro,
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/PainelAlpha/CadastroClientes");
  });

  it("edita o CS aceitando uma data ISO sem formar uma data inválida", async () => {
    const dataRegistro = new Date("2026-07-22T15:00:00.000Z");
    const registro = {
      id: 31,
      colaborador: "Ana Responsável",
      sentimento: "neg",
      observacao: "Cliente pediu novo retorno",
      clienteId: 10,
      dataRegistro,
    };
    prismaMock.log_cs.update.mockResolvedValue(registro);

    const resultado = await atualizarLogCS(31, {
      sentimento: "neg",
      observacao: "Cliente pediu novo retorno",
      dataRegistro: dataRegistro.toISOString(),
    });

    expect(resultado).toEqual({ success: true, data: registro });
    expect(prismaMock.log_cs.update).toHaveBeenCalledWith({
      where: { id: 31 },
      data: {
        sentimento: "neg",
        observacao: "Cliente pediu novo retorno",
        dataRegistro,
      },
    });
  });

  it("preserva a semântica de data local ao editar pelo input de data", async () => {
    const dataRegistro = new Date("2026-07-22T12:00:00");
    prismaMock.log_cs.update.mockResolvedValue({
      id: 31,
      colaborador: "Ana Responsável",
      sentimento: "pos",
      observacao: "Atendimento atualizado hoje",
      clienteId: 10,
      dataRegistro,
    });

    await atualizarLogCS(31, {
      sentimento: "pos",
      observacao: "Atendimento atualizado hoje",
      dataRegistro: "2026-07-22",
    });

    expect(prismaMock.log_cs.update).toHaveBeenCalledWith({
      where: { id: 31 },
      data: {
        sentimento: "pos",
        observacao: "Atendimento atualizado hoje",
        dataRegistro,
      },
    });
  });

  it("cria o Feedback imediatamente pelo mesmo contrato seguro", async () => {
    const dataRegistro = new Date("2026-07-23T15:00:00.000Z");
    const registro = {
      id: 19,
      colaborador: "Ana Responsável",
      sentimento: "na",
      observacao: "Cliente ainda não respondeu",
      clienteId: 10,
      dataRegistro,
    };
    prismaMock.logFeedback.create.mockResolvedValue(registro);

    const resultado = await salvarLogFeedback(10, {
      sentimento: "na",
      observacao: "Cliente ainda não respondeu",
      data_registro: dataRegistro.toISOString(),
    });

    expect(resultado).toEqual({ success: true, data: registro });
    expect(prismaMock.logFeedback.create).toHaveBeenCalledWith({
      data: {
        colaborador: "Ana Responsável",
        sentimento: "na",
        observacao: "Cliente ainda não respondeu",
        clienteId: 10,
        dataRegistro,
      },
    });
  });

  it("edita o Feedback e devolve o registro atualizado", async () => {
    const dataRegistro = new Date("2026-07-21T12:00:00");
    const registro = {
      id: 19,
      colaborador: "Ana Responsável",
      sentimento: "pos",
      observacao: "Cliente publicou o feedback",
      clienteId: 10,
      dataRegistro,
    };
    prismaMock.logFeedback.update.mockResolvedValue(registro);

    const resultado = await atualizarLogFeedback(19, {
      sentimento: "pos",
      observacao: "Cliente publicou o feedback",
      dataRegistro: "2026-07-21",
    });

    expect(resultado).toEqual({ success: true, data: registro });
    expect(prismaMock.logFeedback.update).toHaveBeenCalledWith({
      where: { id: 19 },
      data: {
        sentimento: "pos",
        observacao: "Cliente publicou o feedback",
        dataRegistro,
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/PainelAlpha/CadastroClientes");
  });
});

describe("exclusão de sócio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: "7", nome: "Ana Responsável" },
    });
  });

  it("exclui o sócio e revalida o módulo para uma sessão autenticada", async () => {
    prismaMock.socios.delete.mockResolvedValue({ id: 42 });

    const resultado = await excluirSocio(42);

    expect(resultado).toEqual({ success: true });
    expect(prismaMock.socios.delete).toHaveBeenCalledWith({ where: { id: 42 } });
    expect(revalidatePathMock).toHaveBeenCalledWith("/PainelAlpha/CadastroClientes");
  });

  it("não acessa o banco sem uma sessão autenticada", async () => {
    authMock.mockResolvedValue(null);

    const resultado = await excluirSocio(42);

    expect(resultado).toEqual({ success: false, error: "Não autorizado" });
    expect(prismaMock.socios.delete).not.toHaveBeenCalled();
  });

  it("rejeita um ID de sócio inválido antes de acessar o banco", async () => {
    const resultado = await excluirSocio(0);

    expect(resultado).toEqual({ success: false, error: "ID de sócio inválido" });
    expect(prismaMock.socios.delete).not.toHaveBeenCalled();
  });

  it("retorna uma mensagem tratável quando a exclusão falha", async () => {
    prismaMock.socios.delete.mockRejectedValue(new Error("falha de banco"));

    const resultado = await excluirSocio(42);

    expect(resultado).toEqual({ success: false, error: "Não foi possível excluir o sócio." });
  });
});
