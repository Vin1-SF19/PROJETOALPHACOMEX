import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  commissionEvent: { findUnique: vi.fn() },
  commissionEntry: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  entryComponent: { create: vi.fn() },
  eligibilityOverride: { findMany: vi.fn() },
  commissionDivergence: { create: vi.fn() },
  usuarios: { findUnique: vi.fn() },
  contratoColaborador: { findMany: vi.fn() },
  cargoColaborador: { findUnique: vi.fn() },
  setor: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { gerarLancamentosParaEvento } from "@/lib/commissions/entry-generator";

function eventoBase(overrides: Record<string, unknown> = {}) {
  return {
    id: "evento-1",
    eventType: "CONTRACTING",
    clienteId: 1,
    contratoComercialId: "contrato-1",
    servico: "Revisão de RADAR Ilimitado",
    formaPagamento: "A_VISTA_DESCONTO",
    eventDate: new Date("2026-07-15T00:00:00.000Z"),
    grossContractAmountCents: 2_200_000,
    netContractAmountCents: 2_200_000,
    ...overrides,
  };
}

function usuarioComCargo(cargoId: number, cargoNome: string) {
  return { id: 42, nome: "Sheila", cargo: cargoNome };
}

describe("gerarLancamentosParaEvento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.eligibilityOverride.findMany.mockResolvedValue([]);
    prismaMock.commissionEntry.findFirst.mockResolvedValue(null);
  });

  it("gera lançamento simples para 1 colaborador com regra clara (Auditor Contábil na contratação, valor fixo único)", async () => {
    // Auditor Contábil tem apenas 1 regra seed para CONTRACTING (sem DSR/prêmio
    // associado), condicionada a auditorParticipacaoAutomatica=true — caso mais simples
    // para confirmar "1 lançamento, 1 componente, valor fixo correto" sem ambiguidade
    // com outras regras do mesmo cargo.
    prismaMock.commissionEvent.findUnique.mockResolvedValue(eventoBase());
    prismaMock.usuarios.findUnique.mockResolvedValue(usuarioComCargo(7, "Auditor Contábil"));
    prismaMock.contratoColaborador.findMany.mockResolvedValue([
      { id: "c7", usuarioId: 42, tipo: "PJ", dataInicio: new Date("2026-01-01"), dataFim: null },
    ]);
    prismaMock.cargoColaborador.findUnique.mockResolvedValue({
      id: 7,
      nome: "Auditor Contábil",
      setorId: null,
      naturezaRecebimento: null,
      permiteMultiplosOcupantes: true,
    });
    prismaMock.commissionEntry.create.mockResolvedValue({ id: "entry-1" });

    const result = await gerarLancamentosParaEvento({ eventId: "evento-1", collaboratorIds: [42] });

    expect(result.divergencesCreated).toBe(0);
    expect(result.entriesCreated).toBe(1);
    expect(prismaMock.commissionEntry.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.entryComponent.create).toHaveBeenCalledTimes(1);

    const componentCall = prismaMock.entryComponent.create.mock.calls[0][0];
    expect(componentCall.data.tipo).toBe("COMISSAO");
    expect(componentCall.data.valorCents).toBe(23_652); // R$236,52 fixo do Auditor Contábil
  });

  it("comissão e DSR são gerados como componentes SEPARADOS dentro do MESMO CommissionEntry (Closer na contratação)", async () => {
    // Closer tem 2 regras seed para CONTRACTING: comissão (PERCENTAGE) e DSR (DSR) —
    // ambas devem virar EntryComponent distintos no mesmo lançamento, nunca somadas.
    prismaMock.commissionEvent.findUnique.mockResolvedValue(
      eventoBase({ eventType: "CONTRACTING", formaPagamento: "A_VISTA_DESCONTO" }),
    );
    prismaMock.usuarios.findUnique.mockResolvedValue(usuarioComCargo(2, "Closer"));
    prismaMock.contratoColaborador.findMany.mockResolvedValue([
      { id: "c2", usuarioId: 42, tipo: "CLT", dataInicio: new Date("2026-01-01"), dataFim: null },
    ]);
    prismaMock.cargoColaborador.findUnique.mockResolvedValue({
      id: 2,
      nome: "Closer",
      setorId: null,
      naturezaRecebimento: null,
      permiteMultiplosOcupantes: true,
    });
    prismaMock.commissionEntry.create.mockResolvedValue({ id: "entry-2" });

    const result = await gerarLancamentosParaEvento({ eventId: "evento-1", collaboratorIds: [42] });

    expect(result.entriesCreated).toBe(1);
    expect(prismaMock.commissionEntry.create).toHaveBeenCalledTimes(1); // 1 lançamento
    expect(prismaMock.entryComponent.create).toHaveBeenCalledTimes(2); // 2 componentes: COMISSAO + DSR

    const tipos = prismaMock.entryComponent.create.mock.calls.map((call: any) => call[0].data.tipo);
    expect(tipos).toContain("COMISSAO");
    expect(tipos).toContain("DSR");
    expect(new Set(tipos).size).toBe(2); // nunca o mesmo tipo duas vezes, nunca somados
  });

  it("recálculo não duplica lançamento já PAGO — pula (entriesSkipped)", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(eventoBase());
    prismaMock.commissionEntry.findFirst.mockResolvedValue({ id: "entry-pago", status: "Pago" });

    const result = await gerarLancamentosParaEvento({ eventId: "evento-1", collaboratorIds: [42] });

    expect(result.entriesSkipped).toBe(1);
    expect(result.entriesCreated).toBe(0);
    expect(prismaMock.commissionEntry.create).not.toHaveBeenCalled();
    expect(prismaMock.usuarios.findUnique).not.toHaveBeenCalled(); // nem chega a buscar o colaborador
  });

  it("recálculo de lançamento PENDENTE (não pago) atualiza em vez de duplicar", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(eventoBase());
    prismaMock.commissionEntry.findFirst.mockResolvedValue({ id: "entry-pendente", status: "Pendente" });
    prismaMock.usuarios.findUnique.mockResolvedValue(usuarioComCargo(1, "Analista II"));
    prismaMock.contratoColaborador.findMany.mockResolvedValue([
      { id: "c1", usuarioId: 42, tipo: "CLT", dataInicio: new Date("2026-01-01"), dataFim: null },
    ]);
    prismaMock.cargoColaborador.findUnique.mockResolvedValue({
      id: 1,
      nome: "Analista II",
      setorId: null,
      naturezaRecebimento: null,
      permiteMultiplosOcupantes: true,
    });
    prismaMock.commissionEntry.update.mockResolvedValue({ id: "entry-pendente" });

    const result = await gerarLancamentosParaEvento({ eventId: "evento-1", collaboratorIds: [42] });

    expect(prismaMock.commissionEntry.create).not.toHaveBeenCalled();
    expect(prismaMock.commissionEntry.update).toHaveBeenCalledTimes(1);
    expect(result.entriesCreated).toBe(1);
  });

  it("EligibilityOverride de BLOQUEIO impede o lançamento normal (pula, não cria nada)", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(eventoBase());
    prismaMock.usuarios.findUnique.mockResolvedValue(usuarioComCargo(1, "Analista II"));
    prismaMock.contratoColaborador.findMany.mockResolvedValue([
      { id: "c1", usuarioId: 42, tipo: "CLT", dataInicio: new Date("2026-01-01"), dataFim: null },
    ]);
    prismaMock.cargoColaborador.findUnique.mockResolvedValue({
      id: 1,
      nome: "Analista II",
      setorId: null,
      naturezaRecebimento: null,
      permiteMultiplosOcupantes: true,
    });
    prismaMock.eligibilityOverride.findMany.mockResolvedValue([
      {
        id: "override-bloqueio",
        collaboratorId: 42,
        cargoId: null,
        clienteId: null,
        contratoComercialId: null,
        servico: null,
        eventType: null,
        dataInicial: null,
        dataFinal: null,
        tipo: "BLOQUEIO",
        percentualEspecifico: null,
        valorEspecificoCents: null,
        justificativa: "Colaborador afastado",
        prioridade: 0,
        approvalRequired: false,
        aprovadoEm: null,
      },
    ]);

    const result = await gerarLancamentosParaEvento({ eventId: "evento-1", collaboratorIds: [42] });

    expect(result.entriesSkipped).toBe(1);
    expect(result.entriesCreated).toBe(0);
    expect(prismaMock.commissionEntry.create).not.toHaveBeenCalled();
  });

  it("ausência de regra aplicável (cargo sem nenhuma seed correspondente) gera divergência, NUNCA zero silencioso", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(eventoBase());
    prismaMock.usuarios.findUnique.mockResolvedValue(usuarioComCargo(99, "Cargo Sem Regra Nenhuma"));
    prismaMock.contratoColaborador.findMany.mockResolvedValue([
      { id: "c99", usuarioId: 42, tipo: "CLT", dataInicio: new Date("2026-01-01"), dataFim: null },
    ]);
    prismaMock.cargoColaborador.findUnique.mockResolvedValue({
      id: 99,
      nome: "Cargo Sem Regra Nenhuma",
      setorId: null,
      naturezaRecebimento: null,
      permiteMultiplosOcupantes: true,
    });
    prismaMock.commissionEntry.create.mockResolvedValue({ id: "entry-divergente" });

    const result = await gerarLancamentosParaEvento({ eventId: "evento-1", collaboratorIds: [42] });

    expect(result.divergencesCreated).toBe(1);
    expect(result.entriesCreated).toBe(0);
    // O lançamento divergente é criado com totalCents 0 e status EmDivergencia — nunca
    // um valor calculado incorretamente apresentado como se fosse um cálculo válido.
    expect(prismaMock.commissionEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "EmDivergencia", totalCents: 0 }) }),
    );
    expect(prismaMock.commissionDivergence.create).toHaveBeenCalledTimes(1);
  });

  it("vínculo não resolvido (colaborador sem ContratoColaborador vigente) gera divergência", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(eventoBase());
    prismaMock.usuarios.findUnique.mockResolvedValue(usuarioComCargo(1, "Analista II"));
    prismaMock.contratoColaborador.findMany.mockResolvedValue([]); // sem vínculo nenhum
    prismaMock.cargoColaborador.findUnique.mockResolvedValue({
      id: 1,
      nome: "Analista II",
      setorId: null,
      naturezaRecebimento: null,
      permiteMultiplosOcupantes: true,
    });
    prismaMock.commissionEntry.create.mockResolvedValue({ id: "entry-divergente-vinculo" });

    const result = await gerarLancamentosParaEvento({ eventId: "evento-1", collaboratorIds: [42] });

    expect(result.divergencesCreated).toBe(1);
    expect(prismaMock.commissionDivergence.create).toHaveBeenCalledTimes(1);
  });
});
