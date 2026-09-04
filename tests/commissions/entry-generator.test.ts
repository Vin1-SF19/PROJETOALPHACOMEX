import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  commissionEvent: { findUnique: vi.fn(), findFirst: vi.fn() },
  commissionRule: { findMany: vi.fn() },
  businessProcess: { findUnique: vi.fn() },
  commissionEntry: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  entryComponent: { create: vi.fn(), deleteMany: vi.fn() },
  eligibilityOverride: { findMany: vi.fn() },
  commissionDivergence: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  usuarios: { findUnique: vi.fn() },
  contratoColaborador: { findMany: vi.fn() },
  cargoColaborador: { findUnique: vi.fn() },
  setor: { findUnique: vi.fn() },
  holiday: { findMany: vi.fn() },
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
    prismaMock.commissionRule.findMany.mockResolvedValue([]);
    prismaMock.commissionEntry.findFirst.mockResolvedValue(null);
    prismaMock.commissionEntry.upsert.mockResolvedValue({ id: "entry-1" });
    prismaMock.entryComponent.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.commissionDivergence.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
    prismaMock.holiday.findMany.mockResolvedValue([]); // sem feriados estaduais/municipais cadastrados por padrão
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
    expect(prismaMock.commissionEntry.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.entryComponent.create).toHaveBeenCalledTimes(1);

    const componentCall = prismaMock.entryComponent.create.mock.calls[0][0];
    expect(componentCall.data.tipo).toBe("COMISSAO");
    expect(componentCall.data.valorCents).toBe(23_652); // R$236,52 fixo do Auditor Contábil
  });

  it("usa regra percentual publicada e persiste sua versão em vez da seed", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(eventoBase({
      grossContractAmountCents: 1_000_000,
      netContractAmountCents: 900_000,
    }));
    prismaMock.usuarios.findUnique.mockResolvedValue(usuarioComCargo(2, "Closer"));
    prismaMock.contratoColaborador.findMany.mockResolvedValue([
      { id: "c2", usuarioId: 42, tipo: "CLT", dataInicio: new Date("2026-01-01"), dataFim: null },
    ]);
    prismaMock.cargoColaborador.findUnique.mockResolvedValue({
      id: 2, nome: "Closer", setorId: null, naturezaRecebimento: null, permiteMultiplosOcupantes: true,
    });
    prismaMock.commissionRule.findMany.mockResolvedValue([{
      id: "regra-db", name: "5% sobre bruto", active: true, priority: 10,
      eventType: "CONTRACTING", benefitType: "COMMISSION", cargoId: 2,
      setorId: null, collaboratorId: null, servico: null, approvalRequired: false,
      versoes: [{
        id: "versao-db", version: 3,
        conditionsJson: "[]",
        calculationJson: JSON.stringify({ type: "PERCENTAGE", benefitType: "COMMISSION", rate: 0.05, baseCalculo: "VALOR_BRUTO" }),
        paymentScheduleJson: JSON.stringify({ scheduleRuleName: "QUINTO_DIA_UTIL_CLT" }),
      }],
    }]);

    const result = await gerarLancamentosParaEvento({ eventId: "evento-1", collaboratorIds: [42] });

    expect(result.entriesCreated).toBe(1);
    expect(prismaMock.entryComponent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ valorCents: 50_000 }),
    }));
    expect(prismaMock.commissionEntry.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ ruleVersionId: "versao-db" }),
      update: expect.objectContaining({ ruleVersionId: "versao-db" }),
    }));
  });

  it("Closer NÃO recebe DSR (decisão do usuário, 2026-07-30) — só o componente COMISSAO", async () => {
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
    expect(prismaMock.commissionEntry.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.entryComponent.create).toHaveBeenCalledTimes(1); // só COMISSAO, nunca DSR

    const componentCall = prismaMock.entryComponent.create.mock.calls[0][0];
    expect(componentCall.data.tipo).toBe("COMISSAO");
  });

  it("êxito na primeira tentativa gera prêmio de êxito e adicional no mesmo lançamento", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(
      eventoBase({
        eventType: "PROCESS_SUCCESS",
        businessProcessId: "processo-1",
        eventDate: new Date("2026-07-28T00:00:00.000Z"),
      }),
    );
    prismaMock.businessProcess.findUnique.mockResolvedValue({
      analistaAuxiliarId: null,
      auditorId: null,
      diretorId: null,
      deferidoPrimeiraTentativa: true,
    });
    prismaMock.usuarios.findUnique.mockResolvedValue(usuarioComCargo(4, "Analista II"));
    prismaMock.contratoColaborador.findMany.mockResolvedValue([
      { id: "c4", usuarioId: 42, tipo: "CLT", dataInicio: new Date("2026-01-01"), dataFim: null },
    ]);
    prismaMock.cargoColaborador.findUnique.mockResolvedValue({
      id: 4,
      nome: "Analista II",
      setorId: null,
      naturezaRecebimento: null,
      permiteMultiplosOcupantes: true,
    });

    const result = await gerarLancamentosParaEvento({ eventId: "evento-1", collaboratorIds: [42] });

    expect(result.entriesCreated).toBe(1);
    const premios = prismaMock.entryComponent.create.mock.calls
      .map(([call]) => call.data)
      .filter((componente) => componente.tipo === "PREMIO")
      .map((componente) => componente.valorCents);
    expect(premios).toEqual(expect.arrayContaining([25_000, 10_000]));
    expect(prismaMock.commissionEntry.upsert).toHaveBeenCalledTimes(1);
  });

  it("Analista Sênior: comissão e DSR são gerados como componentes SEPARADOS por decomposição do total fixo (R$350)", async () => {
    // Analista Sênior tem regra TOTAL_FIXO_COM_DSR (R$350) que decompõe em COMISSAO+DSR
    // usando dias úteis/descanso do mês do evento — nunca soma num único componente.
    prismaMock.commissionEvent.findUnique.mockResolvedValue(
      eventoBase({ eventType: "CONTRACTING", eventDate: new Date("2026-06-15T00:00:00.000Z") }),
    );
    prismaMock.usuarios.findUnique.mockResolvedValue(usuarioComCargo(3, "Analista Sênior"));
    prismaMock.contratoColaborador.findMany.mockResolvedValue([
      { id: "c3", usuarioId: 42, tipo: "CLT", dataInicio: new Date("2026-01-01"), dataFim: null },
    ]);
    prismaMock.cargoColaborador.findUnique.mockResolvedValue({
      id: 3,
      nome: "Analista Sênior",
      setorId: null,
      naturezaRecebimento: null,
      permiteMultiplosOcupantes: true,
    });
    prismaMock.commissionEntry.create.mockResolvedValue({ id: "entry-3" });

    const result = await gerarLancamentosParaEvento({ eventId: "evento-1", collaboratorIds: [42] });

    expect(result.entriesCreated).toBe(1);
    expect(prismaMock.entryComponent.create).toHaveBeenCalledTimes(2); // COMISSAO + DSR

    const tipos = prismaMock.entryComponent.create.mock.calls.map(
      (call: Array<{ data: { tipo: string } }>) => call[0].data.tipo,
    );
    expect(tipos).toContain("COMISSAO");
    expect(tipos).toContain("DSR");
    expect(new Set(tipos).size).toBe(2);

    // Junho/2026: 24 dias úteis, 6 de descanso (só domingos, sem feriado no período) — R$280+R$70=R$350.
    const valores = prismaMock.entryComponent.create.mock.calls.map(
      (call: Array<{ data: { tipo: string; valorCents: number } }>) => call[0].data,
    );
    const comissao = valores.find((v) => v.tipo === "COMISSAO");
    const dsr = valores.find((v) => v.tipo === "DSR");
    expect(comissao!.valorCents + dsr!.valorCents).toBe(35_000); // nunca diverge do total fixo
  });

  it("recálculo não duplica lançamento já PAGO — pula (entriesSkipped)", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(eventoBase());
    prismaMock.commissionEntry.findFirst.mockResolvedValue({ id: "entry-pago", status: "Pago" });

    const result = await gerarLancamentosParaEvento({ eventId: "evento-1", collaboratorIds: [42] });

    expect(result.entriesSkipped).toBe(1);
    expect(result.entriesCreated).toBe(0);
    expect(prismaMock.commissionEntry.upsert).not.toHaveBeenCalled();
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

    expect(prismaMock.commissionEntry.upsert).toHaveBeenCalledTimes(1);
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
    expect(prismaMock.commissionEntry.upsert).not.toHaveBeenCalled();
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
    expect(prismaMock.commissionEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ status: "EmDivergencia", totalCents: 0 }) }),
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
