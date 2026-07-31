import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("../../auth", () => ({ auth: authMock }));

const prismaMock = vi.hoisted(() => ({
  cargoColaborador: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  setor: { findMany: vi.fn() },
  usuarios: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
  servicosComerciais: { findMany: vi.fn() },
  tariffVersion: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  holiday: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  eligibilityOverride: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  commissionPermission: { deleteMany: vi.fn() },
  commissionRule: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  commissionRuleVersion: { create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  commissionAuditLog: { create: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { CriarCargo, ListarCargos, ReativarCargo } from "@/actions/CommissionPositions";
import {
  AtualizarTarifario,
  CriarTarifario,
  ExcluirTarifario,
  ListarServicosComTarifario,
} from "@/actions/CommissionTariffs";
import { CriarVersaoRegra, PublicarRegra, ReativarRegra } from "@/actions/CommissionRuleBuilder";
import { AtualizarFeriado } from "@/actions/CommissionHolidays";
import { ExcluirEligibilityOverride } from "@/actions/EligibilityOverrides";
import { RestaurarPermissoesPadrao } from "@/actions/CommissionPermissions";

function sessaoAdmin() {
  authMock.mockResolvedValue({ user: { id: "1", role: "Admin" } });
}

describe("cargos configuráveis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoAdmin();
  });

  it("rejeita vínculo padrão inválido", async () => {
    const result = await CriarCargo({
      nome: "Cargo Teste",
      // @ts-expect-error valor inválido proposital
      vinculoPadrao: "EFETIVO",
      permiteMultiplosOcupantes: true,
    });
    expect(result.success).toBe(false);
    expect(prismaMock.cargoColaborador.create).not.toHaveBeenCalled();
  });

  it("cria cargo válido", async () => {
    prismaMock.cargoColaborador.findUnique.mockResolvedValue(null);
    prismaMock.cargoColaborador.create.mockResolvedValue({ id: 1, nome: "Closer" });
    const result = await CriarCargo({
      nome: "Closer",
      vinculoPadrao: "CLT",
      naturezaRecebimento: "COMISSAO",
      permiteMultiplosOcupantes: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita nome duplicado", async () => {
    prismaMock.cargoColaborador.findUnique.mockResolvedValue({ id: 1, nome: "Closer" });
    const result = await CriarCargo({ nome: "Closer", permiteMultiplosOcupantes: true });
    expect(result.success).toBe(false);
    expect(prismaMock.cargoColaborador.create).not.toHaveBeenCalled();
  });

  it("reativa cargo sem apagar histórico", async () => {
    prismaMock.cargoColaborador.findUnique.mockResolvedValue({ id: 7, nome: "Analista", ativo: false });
    prismaMock.cargoColaborador.update.mockResolvedValue({ id: 7, nome: "Analista", ativo: true });
    const result = await ReativarCargo({ id: 7 });
    expect(result.success).toBe(true);
    expect(prismaMock.cargoColaborador.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { ativo: true } });
  });

  it("prioriza usuarios.role ao exibir setor do cargo", async () => {
    prismaMock.cargoColaborador.findMany.mockResolvedValue([{ id: 1, nome: "Closer", setorId: null, ativo: true }]);
    prismaMock.setor.findMany.mockResolvedValue([]);
    prismaMock.usuarios.findMany.mockResolvedValue([{ cargo: "Closer", role: "COMERCIAL" }]);
    const result = await ListarCargos();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].setorNome).toBe("COMERCIAL");
      expect(result.data[0].setorOrigem).toBe("USUARIOS_ROLE");
    }
  });

  it("mostra todas as roles encontradas para o mesmo cargo", async () => {
    prismaMock.cargoColaborador.findMany.mockResolvedValue([{ id: 1, nome: "Analista", setorId: null, ativo: true }]);
    prismaMock.setor.findMany.mockResolvedValue([]);
    prismaMock.usuarios.findMany.mockResolvedValue([
      { cargo: "Analista", role: "COMERCIAL" },
      { cargo: "analista", role: "OPERACIONAL" },
    ]);
    const result = await ListarCargos();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data[0].setorNome).toBe("COMERCIAL / OPERACIONAL");
  });
});

describe("tarifários configuráveis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoAdmin();
  });

  it("cria tarifário com campos obrigatórios", async () => {
    prismaMock.tariffVersion.create.mockResolvedValue({ id: "tarifario-1", servico: "Revisão de RADAR Ilimitado" });
    const result = await CriarTarifario({
      servico: "Revisão de RADAR Ilimitado",
      valorCents: 2_200_000,
      dataInicial: new Date("2026-07-01T00:00:00.000Z"),
      formasPagamentoJson: JSON.stringify(["A_VISTA_DESCONTO", "CARTAO_PARCELADO"]),
    });
    expect(result.success).toBe(true);
  });

  it("rejeita valor negativo", async () => {
    const result = await CriarTarifario({
      servico: "Revisão de RADAR Ilimitado",
      valorCents: -100,
      dataInicial: new Date("2026-07-01T00:00:00.000Z"),
      formasPagamentoJson: "[]",
    });
    expect(result.success).toBe(false);
    expect(prismaMock.tariffVersion.create).not.toHaveBeenCalled();
  });

  it("atualiza serviço, valor e vigência", async () => {
    prismaMock.tariffVersion.findUnique.mockResolvedValue({ id: "tar-1" });
    prismaMock.tariffVersion.update.mockResolvedValue({ id: "tar-1", valorCents: 500_000 });
    const result = await AtualizarTarifario({
      id: "tar-1",
      servico: "Revisão de RADAR",
      valorCents: 500_000,
      dataInicial: new Date("2026-08-01"),
      dataFinal: null,
    });
    expect(result.success).toBe(true);
    expect(prismaMock.tariffVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ servico: "Revisão de RADAR", valorCents: 500_000 }) }),
    );
  });

  it("exclui somente o tarifário selecionado", async () => {
    prismaMock.tariffVersion.findUnique.mockResolvedValue({ id: "tar-1" });
    prismaMock.tariffVersion.delete.mockResolvedValue({ id: "tar-1" });
    const result = await ExcluirTarifario({ id: "tar-1" });
    expect(result.success).toBe(true);
    expect(prismaMock.tariffVersion.delete).toHaveBeenCalledWith({ where: { id: "tar-1" } });
  });
});

describe("catálogo de serviços das comissões", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoAdmin();
    prismaMock.tariffVersion.findMany.mockResolvedValue([]);
  });

  it("exibe os seis serviços padrão usados no cadastro de clientes mesmo com a tabela vazia", async () => {
    prismaMock.servicosComerciais.findMany.mockResolvedValue([]);

    const result = await ListarServicosComTarifario();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.map((servico) => servico.nome)).toEqual(expect.arrayContaining([
        "Habilitação RADAR - 50K",
        "Revisão RADAR - 150K",
        "Revisão RADAR - ILIMITADO",
        "TTD 409",
        "Recuperação AFRMM",
        "Outras Recuperações Tributárias",
      ]));
      expect(result.data).toHaveLength(6);
    }
  });

  it("combina serviços padrão e personalizados sem duplicar nomes equivalentes", async () => {
    prismaMock.servicosComerciais.findMany.mockResolvedValue([
      { id: 10, nome: "Revisao RADAR - 150K", ativo: true },
      { id: 11, nome: "Planejamento Aduaneiro", ativo: true },
    ]);
    prismaMock.tariffVersion.findMany.mockResolvedValue([{ servico: "PLANEJAMENTO ADUANEIRO" }]);

    const result = await ListarServicosComTarifario();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(7);
      expect(result.data.find((servico) => servico.nome === "Planejamento Aduaneiro")).toMatchObject({
        origem: "CADASTRADO",
        temTarifarioVigente: true,
      });
    }
  });
});

describe("regras versionadas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoAdmin();
    prismaMock.commissionAuditLog.create.mockResolvedValue({});
  });

  it("publica versão em rascunho", async () => {
    prismaMock.commissionRuleVersion.findUnique.mockResolvedValue({ id: "v1", status: "DRAFT" });
    prismaMock.commissionRuleVersion.update.mockResolvedValue({ id: "v1", status: "PUBLISHED" });
    const result = await PublicarRegra({ versionId: "v1" });
    expect(result.success).toBe(true);
  });

  it("não sobrescreve versão já publicada", async () => {
    prismaMock.commissionRuleVersion.findUnique.mockResolvedValue({ id: "v1", status: "PUBLISHED" });
    const result = await PublicarRegra({ versionId: "v1" });
    expect(result.success).toBe(false);
    expect(prismaMock.commissionRuleVersion.update).not.toHaveBeenCalled();
  });

  it("editar regra publicada cria nova versão", async () => {
    prismaMock.commissionRule.findUnique.mockResolvedValue({ id: "rule-1", priority: 0 });
    prismaMock.commissionRuleVersion.findFirst.mockResolvedValue({ id: "v1", version: 1, status: "PUBLISHED" });
    prismaMock.commissionRuleVersion.create.mockResolvedValue({ id: "v2", version: 2, status: "DRAFT" });
    const result = await CriarVersaoRegra({
      ruleId: "rule-1",
      priority: 0,
      conditions: [],
      calculation: { type: "FIXED", benefitType: "COMMISSION", fixedAmountCents: 35_000 },
      paymentSchedule: { scheduleRuleName: "QUINTO_DIA_UTIL_CLT" },
      validFrom: new Date("2026-08-01T00:00:00.000Z"),
    });
    expect(result.success).toBe(true);
    expect(prismaMock.commissionRuleVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: 2, status: "DRAFT" }) }),
    );
    expect(prismaMock.commissionRuleVersion.update).not.toHaveBeenCalled();
  });

  it("reativa regra preservando versões", async () => {
    prismaMock.commissionRule.findUnique.mockResolvedValue({ id: "rule-1", active: false });
    prismaMock.commissionRule.update.mockResolvedValue({ id: "rule-1", active: true });
    const result = await ReativarRegra({ ruleId: "rule-1" });
    expect(result.success).toBe(true);
    expect(prismaMock.commissionRule.update).toHaveBeenCalledWith({ where: { id: "rule-1" }, data: { active: true } });
    expect(prismaMock.commissionRuleVersion.update).not.toHaveBeenCalled();
  });
});

describe("demais configurações mutáveis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoAdmin();
  });

  it("edita feriado estadual persistido", async () => {
    prismaMock.holiday.findUnique.mockResolvedValue({ id: "fer-1", escopo: "ESTADUAL" });
    prismaMock.holiday.update.mockResolvedValue({ id: "fer-1", nome: "Data regional" });
    const result = await AtualizarFeriado({
      id: "fer-1",
      data: new Date("2026-07-09"),
      nome: "Data regional",
      escopo: "ESTADUAL",
      uf: "SP",
    });
    expect(result.success).toBe(true);
  });

  it("exclui exceção pontual", async () => {
    prismaMock.eligibilityOverride.findUnique.mockResolvedValue({ id: "exc-1" });
    prismaMock.eligibilityOverride.delete.mockResolvedValue({ id: "exc-1" });
    const result = await ExcluirEligibilityOverride({ id: "exc-1" });
    expect(result.success).toBe(true);
    expect(prismaMock.eligibilityOverride.delete).toHaveBeenCalledWith({ where: { id: "exc-1" } });
  });

  it("restaura permissões removendo apenas overrides do usuário", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValue({ id: 33 });
    prismaMock.commissionPermission.deleteMany.mockResolvedValue({ count: 3 });
    const result = await RestaurarPermissoesPadrao({ userId: 33 });
    expect(result.success).toBe(true);
    expect(prismaMock.commissionPermission.deleteMany).toHaveBeenCalledWith({ where: { userId: 33 } });
  });
});
