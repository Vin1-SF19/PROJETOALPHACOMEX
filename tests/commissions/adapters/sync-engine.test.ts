import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  syncRun: {
    create: vi.fn(),
    update: vi.fn(),
  },
  syncError: {
    create: vi.fn(),
  },
  contratoComercial: {
    findMany: vi.fn(),
  },
  clientes: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  commissionEvent: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  commissionDivergence: {
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  businessProcess: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

const gerarLancamentosParaEventoMock = vi.hoisted(() => vi.fn().mockResolvedValue({ entriesCreated: 0, entriesSkipped: 0, divergencesCreated: 0 }));
vi.mock("@/lib/commissions/entry-generator", () => ({ gerarLancamentosParaEvento: gerarLancamentosParaEventoMock }));
const resolverParticipantesMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/commissions/participant-resolver", () => ({
  resolverParticipantesAutomaticosEvento: resolverParticipantesMock,
  registrarAmbiguidadesParticipantes: vi.fn(),
}));

import { sincronizarComissoes } from "@/lib/commissions/sync-engine";

function contratoRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "contrato-1",
    cnpj: "12345678000190",
    razaoSocial: "Alpha Import",
    nomeFantasia: null,
    valorContrato: 22000,
    formaPagamento: "A_VISTA_DESCONTO",
    servico: "Revisão de RADAR Ilimitado",
    closerNome: "Sheila",
    usuarioId: 10,
    pagamentoConfirmado: true,
    pagamentoConfirmadoEm: new Date("2026-07-15T00:00:00.000Z"),
    updatedAt: new Date("2026-07-15T00:00:00.000Z"),
    ...overrides,
  };
}

describe("sincronizarComissoes — idempotência e divergência", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.syncRun.create.mockResolvedValue({ id: "sync-run-1" });
    prismaMock.syncRun.update.mockResolvedValue({});
    prismaMock.clientes.findMany.mockResolvedValue([]); // sem êxitos pendentes por padrão
    prismaMock.commissionEvent.findMany.mockResolvedValue([]);
    prismaMock.commissionEvent.findFirst.mockResolvedValue(null); // sem CONTRACTING prévio por padrão
    prismaMock.businessProcess.findFirst.mockResolvedValue(null); // sem BusinessProcess por padrão
    prismaMock.commissionDivergence.updateMany.mockResolvedValue({ count: 0 });
    gerarLancamentosParaEventoMock.mockResolvedValue({ entriesCreated: 0, entriesSkipped: 0, divergencesCreated: 0 });
    resolverParticipantesMock.mockImplementation(async (eventId: string) => ({
      collaboratorIds: eventId.includes("exito") ? [10, 42] : eventId.includes("novo") ? [10] : [],
      ambiguidades: [],
    }));
  });

  it("evento de contratação já existente (idempotência): não cria novo CommissionEvent", async () => {
    prismaMock.contratoComercial.findMany.mockResolvedValue([contratoRow()]);
    prismaMock.commissionEvent.findUnique.mockResolvedValue({ id: "evento-existente" }); // já processado

    const result = await sincronizarComissoes({ triggeredBy: "manual" });

    expect(prismaMock.commissionEvent.create).not.toHaveBeenCalled();
    expect(result.totalProcessed).toBe(0);
    expect(result.status).toBe("SUCCESS");
  });

  it("contratação nova (sem evento prévio): cria CommissionEvent uma única vez", async () => {
    prismaMock.contratoComercial.findMany.mockResolvedValue([contratoRow()]);
    prismaMock.commissionEvent.findUnique.mockResolvedValue(null); // ainda não processado
    prismaMock.clientes.findFirst.mockResolvedValue(null); // sem cliente correspondente ainda
    prismaMock.commissionEvent.create.mockResolvedValue({ id: "evento-novo" });

    const result = await sincronizarComissoes({ triggeredBy: "manual" });

    expect(prismaMock.commissionEvent.create).toHaveBeenCalledTimes(1);
    expect(result.totalProcessed).toBe(1);
    expect(result.totalErrors).toBe(0);
  });

  it("contratação nova grava closerUsuarioId (FK real) quando ContratoComercial.usuarioId existe — nunca usa nome manual junto com o FK", async () => {
    prismaMock.contratoComercial.findMany.mockResolvedValue([contratoRow({ usuarioId: 10, closerNome: "Sheila" })]);
    prismaMock.commissionEvent.findUnique.mockResolvedValue(null);
    prismaMock.clientes.findFirst.mockResolvedValue(null);
    prismaMock.commissionEvent.create.mockResolvedValue({ id: "evento-novo" });

    await sincronizarComissoes({ triggeredBy: "manual" });

    expect(prismaMock.commissionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ closerUsuarioId: 10, closerNomeManual: null }),
      }),
    );
  });

  it("contratação nova com closer resolvido (FK): gera lançamento automático só para o closer", async () => {
    prismaMock.contratoComercial.findMany.mockResolvedValue([contratoRow({ usuarioId: 10 })]);
    prismaMock.commissionEvent.findUnique.mockResolvedValue(null);
    prismaMock.clientes.findFirst.mockResolvedValue(null);
    prismaMock.commissionEvent.create.mockResolvedValue({ id: "evento-novo", closerUsuarioId: 10 });

    await sincronizarComissoes({ triggeredBy: "manual" });

    expect(gerarLancamentosParaEventoMock).toHaveBeenCalledWith({ eventId: "evento-novo", collaboratorIds: [10] });
  });

  it("contratação nova sem closer resolvido: NÃO chama geração automática (nada a gerar)", async () => {
    prismaMock.contratoComercial.findMany.mockResolvedValue([contratoRow({ usuarioId: null as unknown as number, closerNome: null })]);
    prismaMock.commissionEvent.findUnique.mockResolvedValue(null);
    prismaMock.clientes.findFirst.mockResolvedValue(null);
    prismaMock.commissionEvent.create.mockResolvedValue({ id: "evento-novo", closerUsuarioId: null });
    resolverParticipantesMock.mockResolvedValue({ collaboratorIds: [], ambiguidades: [] });

    await sincronizarComissoes({ triggeredBy: "manual" });

    expect(gerarLancamentosParaEventoMock).not.toHaveBeenCalled();
  });

  it("dado ausente (falha ao processar 1 contrato) vira SyncError e é registrado, sem derrubar o resto da sincronização", async () => {
    prismaMock.contratoComercial.findMany.mockResolvedValue([contratoRow({ id: "contrato-com-erro" })]);
    prismaMock.commissionEvent.findUnique.mockResolvedValue(null);
    prismaMock.clientes.findFirst.mockRejectedValue(new Error("Falha simulada de leitura"));

    const result = await sincronizarComissoes({ triggeredBy: "manual" });

    expect(prismaMock.syncError.create).toHaveBeenCalledTimes(1);
    expect(result.totalErrors).toBe(1);
    expect(result.status).toBe("FAILED");
  });

  it("êxito detectado (clientes.dataExito preenchida, sem evento prévio) gera CommissionEvent de PROCESS_SUCCESS", async () => {
    prismaMock.contratoComercial.findMany.mockResolvedValue([]);
    prismaMock.clientes.findMany.mockResolvedValue([{ id: 5 }]); // 1 cliente com dataExito não processado
    prismaMock.commissionEvent.findMany.mockResolvedValue([]); // nenhum evento de êxito já existe
    prismaMock.commissionEvent.findFirst.mockResolvedValue(null); // sem CONTRACTING prévio para herdar closer
    prismaMock.clientes.findUnique.mockResolvedValue({
      id: 5,
      cnpj: "12345678000190",
      razaoSocial: "Alpha Import",
      nomeFantasia: null,
      servicos: "Revisão de RADAR Ilimitado",
      formaPagamento: "A_VISTA_DESCONTO",
      valorContrato: 22000,
      closerNome: "Sheila",
      analistaResponsavel: "Maria",
      dataContratacao: "2026-07-15",
      dataExito: "2026-07-20",
      embasamento: null,
      origemLead: null,
    });
    prismaMock.commissionEvent.create.mockResolvedValue({ id: "evento-exito" });
    prismaMock.businessProcess.findFirst.mockResolvedValue(null); // sem BusinessProcess -> divergência

    const result = await sincronizarComissoes({ triggeredBy: "manual" });

    expect(prismaMock.commissionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: "PROCESS_SUCCESS", clienteId: 5 }) }),
    );
    expect(prismaMock.commissionDivergence.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: "EXITO_SEM_BUSINESS_PROCESS" }) }),
    );
    expect(result.totalProcessed).toBe(1);
  });

  it("êxito herda closerUsuarioId do evento de CONTRATAÇÃO já sincronizado, e analistaResponsavelUsuarioId do BusinessProcess (FK real)", async () => {
    prismaMock.contratoComercial.findMany.mockResolvedValue([]);
    prismaMock.clientes.findMany.mockResolvedValue([{ id: 5 }]);
    prismaMock.commissionEvent.findMany.mockResolvedValue([]);
    prismaMock.commissionEvent.findFirst.mockResolvedValue({ closerUsuarioId: 10, closerNomeManual: null });
    prismaMock.clientes.findUnique.mockResolvedValue({
      id: 5,
      cnpj: "12345678000190",
      razaoSocial: "Alpha Import",
      nomeFantasia: null,
      servicos: "Revisão de RADAR Ilimitado",
      formaPagamento: "A_VISTA_DESCONTO",
      valorContrato: 22000,
      closerNome: "Sheila",
      analistaResponsavel: "Maria",
      dataContratacao: "2026-07-15",
      dataExito: "2026-07-20",
      embasamento: null,
      origemLead: null,
    });
    prismaMock.commissionEvent.create.mockResolvedValue({
      id: "evento-exito",
      closerUsuarioId: 10,
      analistaResponsavelUsuarioId: 42,
    });
    prismaMock.businessProcess.findFirst.mockResolvedValue({
      id: "processo-1",
      analistaResponsavelId: 42,
      tentativas: 2,
      deferidoPrimeiraTentativa: false,
    });

    await sincronizarComissoes({ triggeredBy: "manual" });

    expect(prismaMock.commissionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          closerUsuarioId: 10,
          closerNomeManual: null,
          analistaResponsavelUsuarioId: 42,
          analistaResponsavelNomeManual: null,
          businessProcessId: "processo-1",
        }),
      }),
    );
    // Com BusinessProcess encontrado, não deve gerar a divergência de ausência.
    expect(prismaMock.commissionDivergence.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: "EXITO_SEM_BUSINESS_PROCESS" }) }),
    );
    // Gera lançamento automático para closer E analista responsável (ambos resolvidos por FK).
    expect(gerarLancamentosParaEventoMock).toHaveBeenCalledWith({
      eventId: "evento-exito",
      collaboratorIds: expect.arrayContaining([10, 42]),
    });
  });

  it("êxito sem CONTRACTING prévio nem BusinessProcess: cai para nome manual (clientes.closerNome/analistaResponsavel), nunca inventa FK", async () => {
    prismaMock.contratoComercial.findMany.mockResolvedValue([]);
    prismaMock.clientes.findMany.mockResolvedValue([{ id: 5 }]);
    prismaMock.commissionEvent.findMany.mockResolvedValue([]);
    prismaMock.commissionEvent.findFirst.mockResolvedValue(null);
    prismaMock.clientes.findUnique.mockResolvedValue({
      id: 5,
      cnpj: "12345678000190",
      razaoSocial: "Alpha Import",
      nomeFantasia: null,
      servicos: "Revisão de RADAR Ilimitado",
      formaPagamento: "A_VISTA_DESCONTO",
      valorContrato: 22000,
      closerNome: "Sheila",
      analistaResponsavel: "Maria",
      dataContratacao: "2026-07-15",
      dataExito: "2026-07-20",
      embasamento: null,
      origemLead: null,
    });
    prismaMock.commissionEvent.create.mockResolvedValue({ id: "evento-exito" });
    prismaMock.businessProcess.findFirst.mockResolvedValue(null);

    await sincronizarComissoes({ triggeredBy: "manual" });

    expect(prismaMock.commissionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          closerUsuarioId: null,
          closerNomeManual: "Sheila",
          analistaResponsavelUsuarioId: null,
          analistaResponsavelNomeManual: "Maria",
        }),
      }),
    );
  });

  it("êxito já processado (idempotência): listarClientesComExitoNaoProcessado já filtra, não reprocessa", async () => {
    prismaMock.contratoComercial.findMany.mockResolvedValue([]);
    prismaMock.clientes.findMany.mockResolvedValue([{ id: 5 }]);
    // Simula que já existe evento de êxito para o cliente 5 — filtro deve excluí-lo.
    prismaMock.commissionEvent.findMany.mockResolvedValue([{ clienteId: 5 }]);

    const result = await sincronizarComissoes({ triggeredBy: "manual" });

    expect(prismaMock.clientes.findUnique).not.toHaveBeenCalled();
    expect(result.totalProcessed).toBe(0);
  });
});
