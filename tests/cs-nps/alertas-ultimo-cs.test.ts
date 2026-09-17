import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  clienteServico: { findMany: vi.fn() },
  clienteServicoLogCs: { create: vi.fn() },
  usuarios: { findUnique: vi.fn() },
}));
const authMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { buscarPendenciasUltimoCs, salvarLogCSPorAlerta } from "@/actions/Clientes";
import {
  calcularAlertaUltimoCs,
  calcularPendenciaCs,
  podeReceberAlertasUltimoCs,
  resolverUltimoCs,
} from "@/lib/cs-nps/alertas-ultimo-cs";

describe("alertas de Último CS em 10 dias", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    prismaMock.usuarios.findUnique.mockResolvedValue({ role: "RECURSOS HUMANOS", status: "ATIVO" });
  });

  it("respeita a fronteira exata de dez dias corridos", () => {
    const ultimoCs = "2026-09-01T12:00:00.000Z";

    expect(calcularAlertaUltimoCs({
      status: "Em Andamento",
      logs: [{ dataRegistro: ultimoCs }],
      agora: new Date("2026-09-11T11:59:59.999Z"),
    })).toBeNull();

    expect(calcularAlertaUltimoCs({
      status: "Em Andamento",
      logs: [{ dataRegistro: ultimoCs }],
      agora: new Date("2026-09-11T12:00:00.000Z"),
    })).toMatchObject({ diasSemAtualizacao: 10 });
  });

  it("seleciona o maior histórico válido mesmo fora de ordem", () => {
    const ultimo = resolverUltimoCs([
      { dataRegistro: "inválida" },
      { data_registro: "2026-08-01T12:00:00.000Z" },
      { dataRegistro: "2026-09-03T12:00:00.000Z" },
      { dataRegistro: "2026-08-20T12:00:00.000Z" },
    ]);

    expect(ultimo?.toISOString()).toBe("2026-09-03T12:00:00.000Z");
  });

  it("diferencia ausência de CS e ignora qualquer status diferente de Em Andamento", () => {
    const agora = new Date("2026-09-20T12:00:00.000Z");
    expect(calcularAlertaUltimoCs({ status: "Em Andamento", logs: [], agora })).toBeNull();
    expect(calcularPendenciaCs({ status: "Em Andamento", logs: [], agora })).toEqual({
      tipo: "SEM_CS",
      ultimoCs: null,
      venceEm: null,
      diasSemAtualizacao: null,
    });
    expect(calcularAlertaUltimoCs({
      status: "Stand By",
      logs: [{ dataRegistro: "2026-09-01T12:00:00.000Z" }],
      agora,
    })).toBeNull();
  });

  it.each(["Admin", "TI", "T.I", "Recursos Humanos", "RECURSOS-HUMANOS"])("autoriza a role %s", (role) => {
    expect(podeReceberAlertasUltimoCs(role)).toBe(true);
  });

  it.each(["CEO", "ADMINISTRATIVO", "OPERACIONAL", "COMERCIAL", undefined])("nega a role %s", (role) => {
    expect(podeReceberAlertasUltimoCs(role)).toBe(false);
  });

  it("consulta somente serviços em andamento com histórico e devolve DTO serializável", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z"));
    authMock.mockResolvedValue({ user: { id: "7", role: "Recursos Humanos" } });
    prismaMock.clienteServico.findMany.mockResolvedValue([
      {
        id: 31,
        clienteId: 12,
        servico: "Habilitação RADAR",
        status: "Em Andamento",
        cliente: { razaoSocial: "Empresa Alpha", nomeFantasia: "Alpha", cnpj: "123" },
        logCs: [{ dataRegistro: new Date("2026-09-01T12:00:00.000Z") }],
      },
      {
        id: 32,
        clienteId: 13,
        servico: "Revisão",
        status: "Em Andamento",
        cliente: { razaoSocial: "Empresa Recente", nomeFantasia: null, cnpj: null },
        logCs: [{ dataRegistro: new Date("2026-09-10T12:00:00.000Z") }],
      },
      {
        id: 33,
        clienteId: 14,
        servico: "Consultoria",
        status: "Em Andamento",
        cliente: { razaoSocial: "Empresa Sem CS", nomeFantasia: null, cnpj: "456" },
        logCs: [],
      },
    ]);

    const resultado = await buscarPendenciasUltimoCs();

    expect(resultado).toEqual({
      success: true,
      alertas: [
        expect.objectContaining({
          clienteServicoId: 33,
          tipo: "SEM_CS",
          ultimoCsEm: null,
          diasSemAtualizacao: null,
        }),
        expect.objectContaining({
          clienteServicoId: 31,
          razaoSocial: "Empresa Alpha",
          tipo: "CS_VENCIDO",
          ultimoCsEm: "2026-09-01T12:00:00.000Z",
          diasSemAtualizacao: 14,
        }),
      ],
    });
    expect(prismaMock.clienteServico.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "Em Andamento" },
    }));
  });

  it("usa a role atual persistida quando o JWT está desatualizado", async () => {
    authMock.mockResolvedValue({ user: { id: "39", role: "User", nome: "Francielli" } });
    prismaMock.usuarios.findUnique.mockResolvedValue({ role: "RECURSOS HUMANOS", status: "ATIVO" });
    prismaMock.clienteServico.findMany.mockResolvedValue([]);

    await expect(buscarPendenciasUltimoCs()).resolves.toEqual({ success: true, alertas: [] });
    expect(prismaMock.usuarios.findUnique).toHaveBeenCalledWith({
      where: { id: 39 },
      select: { role: true, status: true },
    });
  });

  it.each(["Admin", "TI", "RECURSOS HUMANOS"])("autoriza no servidor o perfil persistido %s", async (role) => {
    authMock.mockResolvedValue({ user: { id: "7", role: "User" } });
    prismaMock.usuarios.findUnique.mockResolvedValue({ role, status: "ATIVO" });
    prismaMock.clienteServico.findMany.mockResolvedValue([]);

    await expect(buscarPendenciasUltimoCs()).resolves.toEqual({ success: true, alertas: [] });
  });

  it("bloqueia a consulta e o salvamento rápido para CEO sem tocar nos dados de CS", async () => {
    authMock.mockResolvedValue({ user: { id: "1", role: "CEO" } });
    prismaMock.usuarios.findUnique.mockResolvedValue({ role: "CEO", status: "ATIVO" });

    await expect(buscarPendenciasUltimoCs()).resolves.toMatchObject({ success: false, alertas: [] });
    await expect(salvarLogCSPorAlerta(31, {
      sentimento: "pos",
      observacao: "Atendimento atualizado",
      data_registro: "2026-09-15T12:00:00.000Z",
    })).resolves.toMatchObject({ success: false });
    expect(prismaMock.clienteServico.findMany).not.toHaveBeenCalled();
    expect(prismaMock.clienteServicoLogCs.create).not.toHaveBeenCalled();
  });

  it("salva pelo fluxo rápido para TI reutilizando o contrato existente", async () => {
    authMock.mockResolvedValue({ user: { id: "7", nome: "Ana", role: "TI" } });
    prismaMock.usuarios.findUnique.mockResolvedValue({ role: "TI", status: "ATIVO" });
    prismaMock.clienteServicoLogCs.create.mockResolvedValue({ id: "cs-1" });

    const resultado = await salvarLogCSPorAlerta(31, {
      sentimento: "pos",
      observacao: "Atendimento atualizado",
      data_registro: "2026-09-15T12:00:00.000Z",
    });

    expect(resultado.success).toBe(true);
    expect(prismaMock.clienteServicoLogCs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ clienteServicoId: 31, colaborador: "Ana" }),
    });
  });
});
