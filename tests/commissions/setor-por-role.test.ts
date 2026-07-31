import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("../../auth", () => ({ auth: authMock }));

const prismaMock = vi.hoisted(() => ({
  commissionEvent: { findUnique: vi.fn() },
  commissionEntry: { findMany: vi.fn() },
  commissionDivergence: { findMany: vi.fn() },
  usuarios: { findUnique: vi.fn(), findMany: vi.fn() },
  cargoColaborador: { findUnique: vi.fn(), findMany: vi.fn() },
  setor: { findUnique: vi.fn(), findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { BuscarEventoComLancamentos } from "@/actions/CommissionEntries";

function sessaoAdmin() {
  authMock.mockResolvedValue({ user: { id: "1", role: "Admin" } });
}

function eventoBase(overrides: Record<string, unknown> = {}) {
  return {
    id: "evento-1",
    eventType: "CONTRACTING",
    cnpj: "12345678000190",
    razaoSocial: "Alpha Import",
    nomeFantasia: null,
    servico: "Revisão de RADAR Ilimitado",
    eventDate: new Date("2026-07-15T00:00:00.000Z"),
    formaPagamento: "A_VISTA_DESCONTO",
    grossContractAmountCents: 2_200_000,
    netContractAmountCents: 2_200_000,
    commissionableBaseCents: 2_200_000,
    status: "OK",
    closerUsuarioId: null,
    closerNomeManual: null,
    analistaResponsavelUsuarioId: null,
    analistaResponsavelNomeManual: null,
    ...overrides,
  };
}

function entryBase(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    eventId: "evento-1",
    collaboratorId: 16,
    vinculo: "CLT",
    totalCents: 35_000,
    status: "Pendente",
    contractualDueDate: null,
    operationalSuggestedDate: null,
    scheduledPaymentDate: null,
    actualPaymentDate: null,
    componentes: [],
    alocacoes: [],
    ...overrides,
  };
}

describe("BuscarEventoComLancamentos — setor resolvido por usuarios.role (bug real corrigido, 2026-07-30)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoAdmin();
    prismaMock.commissionEvent.findUnique.mockResolvedValue(eventoBase());
    prismaMock.commissionDivergence.findMany.mockResolvedValue([]);
    prismaMock.cargoColaborador.findMany.mockResolvedValue([]);
    prismaMock.setor.findMany.mockResolvedValue([]);
  });

  it("role='COMERCIAL' vai para setorComercial, mesmo sem CargoColaborador.setorId cadastrado", async () => {
    prismaMock.commissionEntry.findMany.mockResolvedValue([entryBase()]);
    prismaMock.usuarios.findMany.mockResolvedValue([{ id: 16, nome: "Sheila", cargo: "Closer", role: "COMERCIAL" }]);

    const result = await BuscarEventoComLancamentos({ eventId: "evento-1" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.setorComercial).toHaveLength(1);
      expect(result.data.setorOperacional).toHaveLength(0);
      expect(result.data.semSetor).toHaveLength(0);
      expect(result.data.setorComercial[0].setorNome).toBe("Comercial");
    }

    // Nunca deveria precisar consultar CargoColaborador/Setor quando o role já resolve.
    expect(prismaMock.cargoColaborador.findUnique).not.toHaveBeenCalled();
  });

  it("role='OPERACIONAL' vai para setorOperacional", async () => {
    prismaMock.commissionEntry.findMany.mockResolvedValue([entryBase({ collaboratorId: 20 })]);
    prismaMock.usuarios.findMany.mockResolvedValue([{ id: 20, nome: "Heline", cargo: "Analista II", role: "OPERACIONAL" }]);

    const result = await BuscarEventoComLancamentos({ eventId: "evento-1" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.setorOperacional).toHaveLength(1);
      expect(result.data.setorOperacional[0].setorNome).toBe("Operacional");
    }
  });

  it("role que não é Comercial/Operacional (ex: 'Admin') cai para CargoColaborador.setorId como fallback", async () => {
    prismaMock.commissionEntry.findMany.mockResolvedValue([entryBase()]);
    prismaMock.usuarios.findMany.mockResolvedValue([{ id: 16, nome: "Vinicius", cargo: "Diretor Operacional", role: "Admin" }]);
    prismaMock.cargoColaborador.findMany.mockResolvedValue([{ nome: "Diretor Operacional", setorId: 5 }]);
    prismaMock.setor.findMany.mockResolvedValue([{ id: 5, nome: "Operacional" }]);

    const result = await BuscarEventoComLancamentos({ eventId: "evento-1" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.setorOperacional).toHaveLength(1);
    }
    expect(prismaMock.cargoColaborador.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { nome: { in: ["Diretor Operacional"] } } }),
    );
  });

  it("sem role reconhecido e sem CargoColaborador cadastrado: cai em semSetor (nunca esconde o colaborador)", async () => {
    prismaMock.commissionEntry.findMany.mockResolvedValue([entryBase()]);
    prismaMock.usuarios.findMany.mockResolvedValue([{ id: 16, nome: "Fulano", cargo: null, role: "TI" }]);

    const result = await BuscarEventoComLancamentos({ eventId: "evento-1" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.semSetor).toHaveLength(1);
    }
  });
});
