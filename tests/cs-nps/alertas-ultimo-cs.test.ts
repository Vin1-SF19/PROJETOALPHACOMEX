import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  clienteServico: { findMany: vi.fn() },
  clienteServicoLogCs: { create: vi.fn() },
}));
const authMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { buscarPendenciasUltimoCs, salvarLogCSPorAlerta } from "@/actions/Clientes";
import {
  calcularAlertaUltimoCs,
  podeReceberAlertasUltimoCs,
  resolverUltimoCs,
} from "@/lib/cs-nps/alertas-ultimo-cs";

describe("alertas de Último CS em 10 dias", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
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

  it("ignora ausência de CS e qualquer status diferente de Em Andamento", () => {
    const agora = new Date("2026-09-20T12:00:00.000Z");
    expect(calcularAlertaUltimoCs({ status: "Em Andamento", logs: [], agora })).toBeNull();
    expect(calcularAlertaUltimoCs({
      status: "Stand By",
      logs: [{ dataRegistro: "2026-09-01T12:00:00.000Z" }],
      agora,
    })).toBeNull();
  });

  it.each(["TI", "T.I", "Recursos Humanos", "RECURSOS-HUMANOS"])("autoriza a role %s", (role) => {
    expect(podeReceberAlertasUltimoCs(role)).toBe(true);
  });

  it.each(["Admin", "CEO", "OPERACIONAL", "COMERCIAL", undefined])("nega a role %s", (role) => {
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
    ]);

    const resultado = await buscarPendenciasUltimoCs();

    expect(resultado).toEqual({
      success: true,
      alertas: [expect.objectContaining({
        clienteServicoId: 31,
        razaoSocial: "Empresa Alpha",
        ultimoCsEm: "2026-09-01T12:00:00.000Z",
        diasSemAtualizacao: 14,
      })],
    });
    expect(prismaMock.clienteServico.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "Em Andamento", logCs: { some: {} } },
    }));
  });

  it("bloqueia a consulta e o salvamento rápido para Admin sem tocar no banco", async () => {
    authMock.mockResolvedValue({ user: { id: "1", role: "Admin" } });

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
