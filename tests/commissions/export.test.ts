import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";

const prismaMock = vi.hoisted(() => ({
  commissionEntry: { findMany: vi.fn() },
  usuarios: { findUnique: vi.fn() },
  payment: { findUnique: vi.fn() },
  exportDocument: { create: vi.fn() },
  exportDocumentItem: { createMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

const authMock = vi.hoisted(() => vi.fn());
vi.mock("../../auth", () => ({ auth: authMock }));

import { construirPreviewEspelho } from "@/lib/commissions/export/preview-builder";
import { gerarXlsxEspelho } from "@/lib/commissions/export/xlsx-generator";
import { PreviewExportacao } from "@/actions/CommissionExports";

function entryMock(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    collaboratorId: 42,
    totalCents: 45_000,
    status: "Pago",
    contractualDueDate: new Date("2026-08-07T00:00:00.000Z"),
    createdAt: new Date("2026-07-20T00:00:00.000Z"),
    componentes: [
      { id: "comp-1", tipo: "COMISSAO", valorCents: 35_000, percentual: 0.04 },
      { id: "comp-2", tipo: "DSR", valorCents: 10_000, percentual: null },
    ],
    ajustes: [],
    alocacoes: [],
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

describe("construirPreviewEspelho", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.usuarios.findUnique.mockResolvedValue({ nome: "Sheila", cargo: "Closer" });
  });

  it("filtro por tipo 'comissoes' só inclui componentes COMISSAO na linha (comissaoCents preenchido, dsrCents zerado)", async () => {
    // Simula o comportamento real do Prisma: `include.componentes.where` filtra no banco
    // ANTES de retornar — o mock só devolve o componente COMISSAO, nunca o DSR, para esta chamada.
    prismaMock.commissionEntry.findMany.mockResolvedValue([
      entryMock({ componentes: [{ id: "comp-1", tipo: "COMISSAO", valorCents: 35_000, percentual: 0.04 }] }),
    ]);

    const resultado = await construirPreviewEspelho({
      tipo: "comissoes",
      periodoInicio: new Date("2026-07-01T00:00:00.000Z"),
      periodoFim: new Date("2026-07-31T23:59:59.000Z"),
    });

    expect(resultado.linhas).toHaveLength(1);
    expect(resultado.linhas[0].comissaoCents).toBe(35_000);
    expect(resultado.linhas[0].dsrCents).toBe(0);

    // Confirma que o filtro foi de fato solicitado ao Prisma (where recebeu só COMISSAO)
    const chamadaWhere = prismaMock.commissionEntry.findMany.mock.calls[0][0];
    expect(chamadaWhere.include.componentes.where.tipo.in).toEqual(["COMISSAO"]);
  });

  it("filtro por tipo 'comissao_dsr' inclui COMISSAO e DSR", async () => {
    prismaMock.commissionEntry.findMany.mockResolvedValue([entryMock()]);

    const resultado = await construirPreviewEspelho({
      tipo: "comissao_dsr",
      periodoInicio: new Date("2026-07-01T00:00:00.000Z"),
      periodoFim: new Date("2026-07-31T23:59:59.000Z"),
    });

    expect(resultado.linhas[0].comissaoCents).toBe(35_000);
    expect(resultado.linhas[0].dsrCents).toBe(10_000);
    expect(resultado.totais.totalGeralCents).toBe(45_000);
  });

  it("filtro por colaboradorId é repassado para a query Prisma", async () => {
    prismaMock.commissionEntry.findMany.mockResolvedValue([]);

    await construirPreviewEspelho({
      tipo: "todos",
      colaboradorId: 99,
      periodoInicio: new Date("2026-07-01T00:00:00.000Z"),
      periodoFim: new Date("2026-07-31T23:59:59.000Z"),
    });

    const chamadaWhere = prismaMock.commissionEntry.findMany.mock.calls[0][0];
    expect(chamadaWhere.where.collaboratorId).toBe(99);
  });

  it("honorários/tarifário ficam null — nunca inventa valor sem TariffVersion", async () => {
    prismaMock.commissionEntry.findMany.mockResolvedValue([entryMock()]);

    const resultado = await construirPreviewEspelho({
      tipo: "todos",
      periodoInicio: new Date("2026-07-01T00:00:00.000Z"),
      periodoFim: new Date("2026-07-31T23:59:59.000Z"),
    });

    expect(resultado.linhas[0].honorariosCents).toBeNull();
    expect(resultado.linhas[0].tarifarioCents).toBeNull();
  });
});

describe("gerarXlsxEspelho — arquivo real", () => {
  it("gera um buffer que é um XLSX válido (reabrível com ExcelJS) com as 6 abas esperadas", async () => {
    const preview = {
      linhas: [
        {
          entryId: "entry-1",
          componenteId: "comp-1",
          data: new Date("2026-07-15T00:00:00.000Z"),
          cnpj: "12345678000190",
          razaoSocial: "Alpha Import",
          nomeFantasia: null,
          servico: "Revisão de RADAR Ilimitado",
          evento: "CONTRACTING",
          honorariosCents: null,
          tarifarioCents: null,
          baseComissionavelCents: 2_200_000,
          formaPagamento: "A_VISTA_DESCONTO",
          percentual: 0.04,
          valorFixoCents: null,
          comissaoCents: 88_000,
          dsrCents: 0,
          premioCents: 0,
          ajusteCents: 0,
          totalCents: 88_000,
          previsao: new Date("2026-08-07T00:00:00.000Z"),
          pagamento: null,
          status: "Pendente",
          observacao: null,
          colaboradorId: 42,
          colaboradorNome: "Sheila",
          cargoNome: "Closer",
        },
      ],
      totais: { comissaoCents: 88_000, dsrCents: 0, premioCents: 0, ajusteCents: 0, totalGeralCents: 88_000 },
    };

    const buffer = await gerarXlsxEspelho({
      preview,
      tipo: "comissoes",
      periodoInicio: new Date("2026-07-01T00:00:00.000Z"),
      periodoFim: new Date("2026-07-31T23:59:59.000Z"),
      codigoVerificacao: "codigo-teste-123",
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);

    // XLSX é um ZIP — magic bytes "PK" (0x50 0x4B) no início do arquivo.
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);

    // Reabre com ExcelJS para confirmar que é um workbook válido com as 6 abas esperadas.
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const nomesAbas = workbook.worksheets.map((w) => w.name);
    expect(nomesAbas).toEqual(["Resumo", "Lançamentos", "Memória de Cálculo", "Regras Aplicadas", "Ajustes", "Metadados"]);

    const abaLancamentos = workbook.getWorksheet("Lançamentos");
    expect(abaLancamentos?.rowCount).toBeGreaterThan(1); // cabeçalho + pelo menos 1 linha de dado
  });

  it("neutraliza Excel Formula Injection em campos de texto livre (razaoSocial, observacao) — achado de segurança do Anubis, Fase 15", async () => {
    const preview = {
      linhas: [
        {
          entryId: "entry-malicioso",
          componenteId: "comp-malicioso",
          data: new Date("2026-07-15T00:00:00.000Z"),
          cnpj: "12345678000190",
          // Payload de Excel Formula Injection — se não neutralizado, o Excel executaria
          // isso como fórmula ao abrir o arquivo.
          razaoSocial: "=cmd|'/c calc'!A1",
          nomeFantasia: "+HYPERLINK(\"http://evil.com\")",
          servico: "Revisão de RADAR Ilimitado",
          evento: "CONTRACTING",
          honorariosCents: null,
          tarifarioCents: null,
          baseComissionavelCents: 2_200_000,
          formaPagamento: "A_VISTA_DESCONTO",
          percentual: 0.04,
          valorFixoCents: null,
          comissaoCents: 88_000,
          dsrCents: 0,
          premioCents: 0,
          ajusteCents: 0,
          totalCents: 88_000,
          previsao: null,
          pagamento: null,
          status: "Pendente",
          observacao: "-2+3+cmd|'/c calc'!A1",
          colaboradorId: 42,
          colaboradorNome: "@SUM(1+1)*cmd|'/c calc'!A1",
          cargoNome: "Closer",
        },
      ],
      totais: { comissaoCents: 88_000, dsrCents: 0, premioCents: 0, ajusteCents: 0, totalGeralCents: 88_000 },
    };

    const buffer = await gerarXlsxEspelho({
      preview,
      tipo: "comissoes",
      periodoInicio: new Date("2026-07-01T00:00:00.000Z"),
      periodoFim: new Date("2026-07-31T23:59:59.000Z"),
      codigoVerificacao: "codigo-teste-malicioso",
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const abaLancamentos = workbook.getWorksheet("Lançamentos");
    const linhaDado = abaLancamentos?.getRow(2);

    // Toda célula que começava com =, +, -, @ deve ter sido prefixada com aspas simples
    // (texto literal), nunca chegar ao Excel como fórmula executável.
    const razaoSocialCell = String(linhaDado?.getCell("C").value ?? "");
    const nomeFantasiaCell = String(linhaDado?.getCell("D").value ?? "");
    expect(razaoSocialCell.startsWith("'")).toBe(true);
    expect(nomeFantasiaCell.startsWith("'")).toBe(true);

    const abaMemoria = workbook.getWorksheet("Memória de Cálculo");
    const colaboradorCell = String(abaMemoria?.getRow(2).getCell("B").value ?? "");
    expect(colaboradorCell.startsWith("'")).toBe(true);
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
      tipo: "todos",
      periodoInicio: new Date("2026-07-01T00:00:00.000Z"),
      periodoFim: new Date("2026-07-31T23:59:59.000Z"),
    });

    expect(resultado.success).toBe(true);
    expect(prismaMock.exportDocument.create).not.toHaveBeenCalled();
    expect(prismaMock.exportDocumentItem.createMany).not.toHaveBeenCalled();
  });

  it("sem sessão autenticada, rejeita antes de montar preview", async () => {
    authMock.mockResolvedValue(null);

    const resultado = await PreviewExportacao({
      tipo: "todos",
      periodoInicio: new Date("2026-07-01T00:00:00.000Z"),
      periodoFim: new Date("2026-07-31T23:59:59.000Z"),
    });

    expect(resultado.success).toBe(false);
    expect(prismaMock.commissionEntry.findMany).not.toHaveBeenCalled();
  });
});
