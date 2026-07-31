import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  commissionEvent: { findUnique: vi.fn(), findFirst: vi.fn() },
  commissionEntry: { findMany: vi.fn() },
  commissionDivergence: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  usuarios: { findUnique: vi.fn() },
  contratoColaborador: { findMany: vi.fn() },
  tariffVersion: { findFirst: vi.fn() },
  businessProcess: { findFirst: vi.fn() },
  syncError: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { detectarDivergenciasDeEvento, persistirDivergenciasDetectadas } from "@/lib/commissions/divergence-detector";

function eventoBase(overrides: Record<string, unknown> = {}) {
  return {
    id: "evento-1",
    eventType: "CONTRACTING",
    clienteId: 1,
    contratoComercialId: "contrato-1",
    cnpj: "12345678000190",
    razaoSocial: "Alpha Import",
    servico: "Revisão de RADAR Ilimitado",
    eventDate: new Date("2026-07-28T00:00:00.000Z"),
    grossContractAmountCents: 2_200_000,
    netContractAmountCents: 2_200_000,
    discountAmountCents: 0,
    formaPagamento: "A_VISTA_DESCONTO",
    sourceId: "merged:abc",
    sourceUpdatedAt: null,
    lastSyncAt: null,
    ...overrides,
  };
}

describe("detectarDivergenciasDeEvento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.commissionEntry.findMany.mockResolvedValue([]);
    prismaMock.commissionEvent.findFirst.mockResolvedValue(null);
    prismaMock.syncError.findMany.mockResolvedValue([]);
    prismaMock.businessProcess.findFirst.mockResolvedValue(null);
  });

  it("empresa sem CNPJ é detectada com severidade BLOCKED", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(eventoBase({ cnpj: "" }));

    const divergencias = await detectarDivergenciasDeEvento("evento-1");

    const encontrada = divergencias.find((d) => d.tipo === "EMPRESA_SEM_CNPJ");
    expect(encontrada).toBeDefined();
    expect(encontrada?.severidade).toBe("BLOCKED");
  });

  it("evento com valor zerado (grossContractAmountCents <= 0) é detectado", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(eventoBase({ grossContractAmountCents: 0 }));

    const divergencias = await detectarDivergenciasDeEvento("evento-1");

    const encontrada = divergencias.find((d) => d.tipo === "CONTRATO_SEM_VALOR");
    expect(encontrada).toBeDefined();
    expect(encontrada?.severidade).toBe("BLOCKED");
  });

  it("pagamento superior ao valor do lançamento é detectado", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(eventoBase());
    prismaMock.commissionEntry.findMany.mockResolvedValue([
      {
        id: "entry-1",
        collaboratorId: 42,
        totalCents: 10_000,
        status: "Pago",
        componentes: [],
        alocacoes: [{ valorCents: 15_000 }], // pago mais do que devido
      },
    ]);
    prismaMock.usuarios.findUnique.mockResolvedValue({ cargo: "Closer" });
    prismaMock.contratoColaborador.findMany.mockResolvedValue([
      { id: "c1", usuarioId: 42, tipo: "CLT", dataInicio: new Date("2026-01-01"), dataFim: null },
    ]);

    const divergencias = await detectarDivergenciasDeEvento("evento-1");

    const encontrada = divergencias.find((d) => d.tipo === "PAGAMENTO_SUPERIOR_AO_VALOR");
    expect(encontrada).toBeDefined();
    expect(encontrada?.severidade).toBe("BLOCKED");
    expect(encontrada?.entryId).toBe("entry-1");
  });

  it("FIRST_ATTEMPT_SUCCESS sem BusinessProcess.deferidoPrimeiraTentativa=true é detectado", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(
      eventoBase({ eventType: "FIRST_ATTEMPT_SUCCESS" }),
    );
    prismaMock.businessProcess.findFirst.mockResolvedValue(null); // sem processo correspondente

    const divergencias = await detectarDivergenciasDeEvento("evento-1");

    const encontrada = divergencias.find((d) => d.tipo === "PRIMEIRA_TENTATIVA_INCONSISTENTE");
    expect(encontrada).toBeDefined();
  });

  it("FIRST_ATTEMPT_SUCCESS COM BusinessProcess.deferidoPrimeiraTentativa=true NÃO gera divergência desse tipo", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(
      eventoBase({ eventType: "FIRST_ATTEMPT_SUCCESS" }),
    );
    prismaMock.businessProcess.findFirst.mockResolvedValue({ deferidoPrimeiraTentativa: true });

    const divergencias = await detectarDivergenciasDeEvento("evento-1");

    expect(divergencias.find((d) => d.tipo === "PRIMEIRA_TENTATIVA_INCONSISTENTE")).toBeUndefined();
  });

  it("honorários brutos do contrato dispensam TariffVersion e não geram SERVICO_SEM_TARIFARIO", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(eventoBase());
    prismaMock.tariffVersion.findFirst.mockResolvedValue(null);

    const divergencias = await detectarDivergenciasDeEvento("evento-1");

    expect(divergencias.find((d) => d.tipo === "SERVICO_SEM_TARIFARIO")).toBeUndefined();
    expect(prismaMock.tariffVersion.findFirst).not.toHaveBeenCalled();
  });

  it("erro de integração (SyncError associado ao sourceId) é detectado com severidade INTEGRATION_ERROR", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(eventoBase());
    prismaMock.syncError.findMany.mockResolvedValue([{ mensagem: "Falha ao consultar cliente" }]);

    const divergencias = await detectarDivergenciasDeEvento("evento-1");

    const encontrada = divergencias.find((d) => d.tipo === "ERRO_DE_INTEGRACAO");
    expect(encontrada).toBeDefined();
    expect(encontrada?.severidade).toBe("INTEGRATION_ERROR");
  });

  it("evento inexistente retorna lista vazia, nunca lança exceção", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(null);

    const divergencias = await detectarDivergenciasDeEvento("evento-inexistente");

    expect(divergencias).toEqual([]);
  });
});

describe("persistirDivergenciasDetectadas — idempotência", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.commissionEntry.findMany.mockResolvedValue([]);
    prismaMock.commissionEvent.findFirst.mockResolvedValue(null);
    prismaMock.syncError.findMany.mockResolvedValue([]);
    prismaMock.businessProcess.findFirst.mockResolvedValue(null);
    prismaMock.commissionDivergence.updateMany.mockResolvedValue({ count: 0 });
  });

  it("encerra automaticamente divergências legadas de serviço sem tarifário", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(eventoBase());

    await persistirDivergenciasDetectadas("evento-1");

    expect(prismaMock.commissionDivergence.updateMany).toHaveBeenCalledWith({
      where: {
        eventId: "evento-1",
        tipo: "SERVICO_SEM_TARIFARIO",
        resolvidoEm: null,
      },
      data: { resolvidoEm: expect.any(Date) },
    });
  });

  it("mesma divergência detectada 2x seguidas para o mesmo evento não é duplicada", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(eventoBase({ cnpj: "" }));
    prismaMock.commissionDivergence.findFirst.mockResolvedValue(null); // 1ª chamada: não existe ainda
    prismaMock.commissionDivergence.create.mockResolvedValue({ id: "div-1" });

    const primeiraChamada = await persistirDivergenciasDetectadas("evento-1");
    expect(primeiraChamada).toBeGreaterThan(0);
    expect(prismaMock.commissionDivergence.create).toHaveBeenCalled();

    vi.clearAllMocks();
    prismaMock.commissionEvent.findUnique.mockResolvedValue(eventoBase({ cnpj: "" }));
    prismaMock.commissionEntry.findMany.mockResolvedValue([]);
    prismaMock.commissionEvent.findFirst.mockResolvedValue(null);
    prismaMock.syncError.findMany.mockResolvedValue([]);
    prismaMock.businessProcess.findFirst.mockResolvedValue(null);
    prismaMock.commissionDivergence.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.commissionDivergence.findFirst.mockResolvedValue({ id: "div-1" }); // 2ª chamada: já existe

    const segundaChamada = await persistirDivergenciasDetectadas("evento-1");
    expect(segundaChamada).toBe(0);
    expect(prismaMock.commissionDivergence.create).not.toHaveBeenCalled();
  });
});
