import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  clienteServicoLogCs: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  clienteServicoLogFeedback: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  pessoaClienteVinculo: {
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

describe("ações dos modais de CS e Feedback (Fase 3.6 do Cliente Master)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: "7", nome: "Ana Responsável" },
    });
  });

  it("cria o CS imediatamente e devolve o registro persistido", async () => {
    const dataRegistro = new Date("2026-07-23T15:00:00.000Z");
    const registro = {
      id: "log-cs-1",
      colaborador: "Ana Responsável",
      sentimento: "pos",
      observacao: "Cliente está satisfeito",
      clienteServicoId: 10,
      dataRegistro,
    };
    prismaMock.clienteServicoLogCs.create.mockResolvedValue(registro);

    const resultado = await salvarLogCS(10, {
      sentimento: "pos",
      observacao: "Cliente está satisfeito",
      data_registro: dataRegistro.toISOString(),
    });

    expect(resultado).toEqual({ success: true, data: registro });
    expect(prismaMock.clienteServicoLogCs.create).toHaveBeenCalledWith({
      data: {
        colaborador: "Ana Responsável",
        sentimento: "pos",
        observacao: "Cliente está satisfeito",
        clienteServicoId: 10,
        dataRegistro,
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/PainelAlpha/CadastroClientes");
  });

  it("edita o CS aceitando uma data ISO sem formar uma data inválida", async () => {
    const dataRegistro = new Date("2026-07-22T15:00:00.000Z");
    const registro = {
      id: "log-cs-1",
      colaborador: "Ana Responsável",
      sentimento: "neg",
      observacao: "Cliente pediu novo retorno",
      clienteServicoId: 10,
      dataRegistro,
    };
    prismaMock.clienteServicoLogCs.update.mockResolvedValue(registro);

    const resultado = await atualizarLogCS("log-cs-1", {
      sentimento: "neg",
      observacao: "Cliente pediu novo retorno",
      dataRegistro: dataRegistro.toISOString(),
    });

    expect(resultado).toEqual({ success: true, data: registro });
    expect(prismaMock.clienteServicoLogCs.update).toHaveBeenCalledWith({
      where: { id: "log-cs-1" },
      data: {
        sentimento: "neg",
        observacao: "Cliente pediu novo retorno",
        dataRegistro,
      },
    });
  });

  it("preserva a semântica de data local ao editar pelo input de data", async () => {
    const dataRegistro = new Date("2026-07-22T12:00:00");
    prismaMock.clienteServicoLogCs.update.mockResolvedValue({
      id: "log-cs-1",
      colaborador: "Ana Responsável",
      sentimento: "pos",
      observacao: "Atendimento atualizado hoje",
      clienteServicoId: 10,
      dataRegistro,
    });

    await atualizarLogCS("log-cs-1", {
      sentimento: "pos",
      observacao: "Atendimento atualizado hoje",
      dataRegistro: "2026-07-22",
    });

    expect(prismaMock.clienteServicoLogCs.update).toHaveBeenCalledWith({
      where: { id: "log-cs-1" },
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
      id: "log-fb-1",
      colaborador: "Ana Responsável",
      sentimento: "na",
      observacao: "Cliente ainda não respondeu",
      clienteServicoId: 10,
      dataRegistro,
    };
    prismaMock.clienteServicoLogFeedback.create.mockResolvedValue(registro);

    const resultado = await salvarLogFeedback(10, {
      sentimento: "na",
      observacao: "Cliente ainda não respondeu",
      data_registro: dataRegistro.toISOString(),
    });

    expect(resultado).toEqual({ success: true, data: registro });
    expect(prismaMock.clienteServicoLogFeedback.create).toHaveBeenCalledWith({
      data: {
        colaborador: "Ana Responsável",
        sentimento: "na",
        observacao: "Cliente ainda não respondeu",
        clienteServicoId: 10,
        dataRegistro,
      },
    });
  });

  it("edita o Feedback e devolve o registro atualizado", async () => {
    const dataRegistro = new Date("2026-07-21T12:00:00");
    const registro = {
      id: "log-fb-1",
      colaborador: "Ana Responsável",
      sentimento: "pos",
      observacao: "Cliente publicou o feedback",
      clienteServicoId: 10,
      dataRegistro,
    };
    prismaMock.clienteServicoLogFeedback.update.mockResolvedValue(registro);

    const resultado = await atualizarLogFeedback("log-fb-1", {
      sentimento: "pos",
      observacao: "Cliente publicou o feedback",
      dataRegistro: "2026-07-21",
    });

    expect(resultado).toEqual({ success: true, data: registro });
    expect(prismaMock.clienteServicoLogFeedback.update).toHaveBeenCalledWith({
      where: { id: "log-fb-1" },
      data: {
        sentimento: "pos",
        observacao: "Cliente publicou o feedback",
        dataRegistro,
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/PainelAlpha/CadastroClientes");
  });
});

describe("exclusão de sócio — desvincula Pessoa do Cliente (Fase 3.6 do Cliente Master)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: "7", nome: "Ana Responsável" },
    });
  });

  it("exclui o vínculo e revalida o módulo para uma sessão autenticada", async () => {
    prismaMock.pessoaClienteVinculo.delete.mockResolvedValue({ pessoaId: 42, clienteId: 501 });

    const resultado = await excluirSocio(42, 501);

    expect(resultado).toEqual({ success: true });
    expect(prismaMock.pessoaClienteVinculo.delete).toHaveBeenCalledWith({
      where: { pessoaId_clienteId: { pessoaId: 42, clienteId: 501 } },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/PainelAlpha/CadastroClientes");
  });

  it("não acessa o banco sem uma sessão autenticada", async () => {
    authMock.mockResolvedValue(null);

    const resultado = await excluirSocio(42, 501);

    expect(resultado).toEqual({ success: false, error: "Não autorizado" });
    expect(prismaMock.pessoaClienteVinculo.delete).not.toHaveBeenCalled();
  });

  it("rejeita um ID de pessoa inválido antes de acessar o banco", async () => {
    const resultado = await excluirSocio(0, 501);

    expect(resultado).toEqual({ success: false, error: "ID de sócio inválido" });
    expect(prismaMock.pessoaClienteVinculo.delete).not.toHaveBeenCalled();
  });

  it("retorna uma mensagem tratável quando a exclusão falha", async () => {
    prismaMock.pessoaClienteVinculo.delete.mockRejectedValue(new Error("falha de banco"));

    const resultado = await excluirSocio(42, 501);

    expect(resultado).toEqual({ success: false, error: "Não foi possível excluir o sócio." });
  });
});
