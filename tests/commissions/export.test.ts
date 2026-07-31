import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";

const prismaMock = vi.hoisted(() => ({
  commissionEntry: { findMany: vi.fn() },
  usuarios: { findUnique: vi.fn() },
  exportDocument: { create: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

const authMock = vi.hoisted(() => vi.fn());
vi.mock("../../auth", () => ({ auth: authMock }));

import { construirPreviewEspelho, type PreviewResult } from "@/lib/commissions/export/preview-builder";
import { gerarXlsxEspelho } from "@/lib/commissions/export/xlsx-generator";
import { PreviewExportacao } from "@/actions/CommissionExports";

function entryMock(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    collaboratorId: 42,
    totalCents: 45_000,
    status: "Pago",
    createdAt: new Date("2026-07-20T00:00:00.000Z"),
    componentes: [
      { id: "comp-1", tipo: "COMISSAO", valorCents: 35_000, percentual: 0.04, memoriaCalculoJson: "{}" },
      { id: "comp-2", tipo: "DSR", valorCents: 10_000, percentual: null, memoriaCalculoJson: "{}" },
    ],
    event: {
      cnpj: "12345678000190",
      razaoSocial: "Alpha Import",
      nomeFantasia: null,
      servico: "Revisão de RADAR Ilimitado",
      eventType: "CONTRACTING",
      eventDate: new Date("2026-07-15T00:00:00.000Z"),
      commissionableBaseCents: 2_200_000,
      formaPagamento: "A_VISTA_DESCONTO",
    },
    ...overrides,
  };
}

describe("construirPreviewEspelho — sempre 1 colaborador, formato real do espelho", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.usuarios.findUnique.mockResolvedValue({ nome: "Sheila", cargo: "Closer" });
  });

  it("tipo 'comissoes': agrega COMISSAO+DSR por lançamento em linhasComissao", async () => {
    prismaMock.commissionEntry.findMany.mockResolvedValue([entryMock()]);

    const resultado = await construirPreviewEspelho({
      tipo: "comissoes",
      colaboradorId: 42,
      periodoInicio: new Date("2026-07-01T00:00:00.000Z"),
      periodoFim: new Date("2026-07-31T23:59:59.000Z"),
    });

    expect(resultado.linhasComissao).toHaveLength(1);
    expect(resultado.linhasComissao[0].comissaoCents).toBe(35_000);
    expect(resultado.linhasComissao[0].dsrCents).toBe(10_000);
    expect(resultado.linhasComissao[0].totalCents).toBe(45_000);
    expect(resultado.linhasPremio).toHaveLength(0);
  });

  it("tipo 'premios': separa componente PREMIO de 'primeira tentativa' pelo nome da regra na memória de cálculo", async () => {
    prismaMock.commissionEntry.findMany.mockResolvedValue([
      entryMock({
        componentes: [
          { id: "comp-3", tipo: "PREMIO", valorCents: 25_000, percentual: null, memoriaCalculoJson: JSON.stringify({ ruleName: "Analista II - Prêmio de êxito" }) },
          { id: "comp-4", tipo: "PREMIO", valorCents: 10_000, percentual: null, memoriaCalculoJson: JSON.stringify({ ruleName: "Analista II - Adicional por deferimento na primeira tentativa" }) },
        ],
      }),
    ]);

    const resultado = await construirPreviewEspelho({
      tipo: "premios",
      colaboradorId: 42,
      periodoInicio: new Date("2026-07-01T00:00:00.000Z"),
      periodoFim: new Date("2026-07-31T23:59:59.000Z"),
    });

    expect(resultado.linhasPremio).toHaveLength(1);
    expect(resultado.linhasPremio[0].exitoCents).toBe(25_000);
    expect(resultado.linhasPremio[0].primeiraCents).toBe(10_000);
    expect(resultado.linhasPremio[0].totalCents).toBe(35_000);
  });

  it("filtro por colaboradorId é repassado para a query Prisma", async () => {
    prismaMock.commissionEntry.findMany.mockResolvedValue([]);

    await construirPreviewEspelho({
      tipo: "comissoes",
      colaboradorId: 99,
      periodoInicio: new Date("2026-07-01T00:00:00.000Z"),
      periodoFim: new Date("2026-07-31T23:59:59.000Z"),
    });

    const chamadaWhere = prismaMock.commissionEntry.findMany.mock.calls[0][0];
    expect(chamadaWhere.where.collaboratorId).toBe(99);
    expect(chamadaWhere.where.event.eventDate.gte).toEqual(new Date("2026-07-01T00:00:00.000Z"));
    expect(chamadaWhere.where.event.eventDate.lt).toEqual(new Date("2026-08-01T00:00:00.000Z"));
    expect(chamadaWhere.where.createdAt).toBeUndefined();
  });

  it("resolve nome e cargo do colaborador a partir de usuarios", async () => {
    prismaMock.commissionEntry.findMany.mockResolvedValue([]);

    const resultado = await construirPreviewEspelho({
      tipo: "comissoes",
      colaboradorId: 42,
      periodoInicio: new Date("2026-07-01T00:00:00.000Z"),
      periodoFim: new Date("2026-07-31T23:59:59.000Z"),
    });

    expect(resultado.colaboradorNome).toBe("Sheila");
    expect(resultado.cargoNome).toBe("Closer");
  });
});

function previewComissaoBase(overrides: Partial<PreviewResult> = {}): PreviewResult {
  return {
    tipo: "comissoes",
    colaboradorId: 42,
    colaboradorNome: "Sheila",
    cargoNome: "Closer",
    periodoInicio: new Date("2026-07-01T00:00:00.000Z"),
    periodoFim: new Date("2026-07-31T23:59:59.000Z"),
    linhasComissao: [
      {
        entryId: "entry-1",
        data: new Date("2026-07-15T00:00:00.000Z"),
        empresaNome: "Alpha Import",
        comissaoCents: 88_000,
        dsrCents: 0,
        totalCents: 88_000,
      },
    ],
    linhasPremio: [],
    totais: { comissaoCents: 88_000, dsrCents: 0, exitoCents: 0, primeiraCents: 0, totalGeralCents: 88_000 },
    ...overrides,
  };
}

describe("gerarXlsxEspelho — formato real (1 aba, cabeçalho + tabela + totais + assinatura)", () => {
  it("gera um buffer XLSX válido com a aba nomeada conforme o tipo", async () => {
    const preview = previewComissaoBase();

    const buffer = await gerarXlsxEspelho({ preview, codigoVerificacao: "codigo-teste-123" });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer[0]).toBe(0x50); // XLSX é ZIP — magic bytes "PK"
    expect(buffer[1]).toBe(0x4b);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    expect(workbook.worksheets[0].name).toBe("ESPELHO DE COMISSÕES");
    expect(workbook.worksheets[0].getCell("B6").value).toBe("Sheila");
  });

  it("neutraliza Excel Formula Injection em campos de texto livre (empresaNome, colaboradorNome) — achado de segurança do Anubis, Fase 15", async () => {
    const preview = previewComissaoBase({
      colaboradorNome: "@SUM(1+1)*cmd|'/c calc'!A1",
      linhasComissao: [
        {
          entryId: "entry-malicioso",
          data: new Date("2026-07-15T00:00:00.000Z"),
          empresaNome: "=cmd|'/c calc'!A1",
          comissaoCents: 88_000,
          dsrCents: 0,
          totalCents: 88_000,
        },
      ],
    });

    const buffer = await gerarXlsxEspelho({ preview, codigoVerificacao: "codigo-teste-malicioso" });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];

    const colaboradorCell = String(sheet.getCell("B6").value ?? "");
    expect(colaboradorCell.startsWith("'")).toBe(true);

    const empresaCell = String(sheet.getCell(9, 2).value ?? "");
    expect(empresaCell.startsWith("'")).toBe(true);
  });
});

describe("PreviewExportacao — nunca persiste nada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "1", role: "Admin" } });
    prismaMock.commissionEntry.findMany.mockResolvedValue([]);
  });

  it("chama apenas leitura (findMany), nunca create/update/delete", async () => {
    const resultado = await PreviewExportacao({
      tipo: "comissoes",
      colaboradorId: 42,
      periodoInicio: new Date("2026-07-01T00:00:00.000Z"),
      periodoFim: new Date("2026-07-31T23:59:59.000Z"),
    });

    expect(resultado.success).toBe(true);
    expect(prismaMock.exportDocument.create).not.toHaveBeenCalled();
  });

  it("sem sessão autenticada, rejeita antes de montar preview", async () => {
    authMock.mockResolvedValue(null);

    const resultado = await PreviewExportacao({
      tipo: "comissoes",
      colaboradorId: 42,
      periodoInicio: new Date("2026-07-01T00:00:00.000Z"),
      periodoFim: new Date("2026-07-31T23:59:59.000Z"),
    });

    expect(resultado.success).toBe(false);
    expect(prismaMock.commissionEntry.findMany).not.toHaveBeenCalled();
  });
});
