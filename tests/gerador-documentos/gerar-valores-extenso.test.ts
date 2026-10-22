import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findTemplate: vi.fn(), criar: vi.fn(), criarClausulas: vi.fn(), update: vi.fn(), transacao: vi.fn(), pdf: vi.fn(), pdfHtml: vi.fn(), put: vi.fn(), carregar: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/bpm/contratacao-comercial-server", () => ({}));
vi.mock("@/lib/gerador-documentos/ownership", () => ({
  getSessaoGeradorDocumentos: vi.fn().mockResolvedValue({ userId: 10, role: "User" }),
  exigirAcessoModulo: vi.fn().mockResolvedValue({ userId: 10, isAdmin: false }),
}));
vi.mock("@/lib/bibble/tika", () => ({ extractTextFromBuffer: vi.fn() }));
vi.mock("@/lib/gerador-documentos/contrato-padrao", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/gerador-documentos/contrato-padrao")>(), carregarContratoPadrao: mocks.carregar }));
vi.mock("@/lib/gerador-documentos/pdf", () => ({ gerarPdfDocumento: mocks.pdf }));
vi.mock("@/lib/gerador-documentos/pdf-renderer", () => ({ renderHtmlParaPdf: mocks.pdfHtml }));
vi.mock("@vercel/blob", () => ({ put: mocks.put }));
vi.mock("@/lib/prisma", () => ({ default: {
  documentoTemplate: { findUnique: mocks.findTemplate }, documentoGerado: { update: mocks.update },
  $transaction: (...args: unknown[]) => mocks.transacao(...args), $executeRaw: vi.fn(),
} }));

import { GerarDocumento } from "@/actions/gerador-documentos";
import { CONTRATO_PADRAO_ID } from "@/lib/gerador-documentos/contrato-padrao-id";
const defs = [{ nome: "valor_total", label: "Valor", tipo: "moeda", obrigatorio: true }, { nome: "valor_total_extenso", label: "Extenso", tipo: "texto", obrigatorio: true }];
const blobTokenAnterior = process.env.BLOB_READ_WRITE_TOKEN;
beforeEach(() => {
  vi.clearAllMocks();
  process.env.BLOB_READ_WRITE_TOKEN = "fake-test";
  mocks.findTemplate.mockResolvedValue({ id: CONTRATO_PADRAO_ID, status: "ATIVO", clausulas: [] });
  mocks.carregar.mockResolvedValue({ variaveis: defs, clausulas: [{ titulo: "Preço", ordem: 0, conteudo: "Preço {{valor_total}} ({{valor_total_extenso}})" }] });
  mocks.criar.mockResolvedValue({ id: "doc-fixture" });
  mocks.transacao.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({ documentoGerado: { create: mocks.criar }, documentoClasulaGerada: { createMany: mocks.criarClausulas } }));
  mocks.pdf.mockResolvedValue(Buffer.from("%PDF-fixture"));
  mocks.pdfHtml.mockResolvedValue(Buffer.from("%PDF-html-fixture"));
  mocks.put.mockResolvedValue({ url: "https://blob.example/fixture.pdf" });
});
afterEach(() => { if (blobTokenAnterior === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = blobTokenAnterior; });

describe("geração com extenso autoritativo", () => {
  it.each([undefined, "texto forjado"])("deriva antes da validação, persistência, cláusula, HTML e PDF (%s)", async (extenso) => {
    const resultado = await GerarDocumento({ templateId: CONTRATO_PADRAO_ID, titulo: "Contrato", variaveis: { valor_total: "1.01", ...(extenso ? { valor_total_extenso: extenso } : {}), __bpmCardId: "não-aceitar", __outraFlag: true } });
    expect(resultado.success).toBe(true);
    const persistidas = JSON.parse(mocks.criar.mock.calls[0][0].data.variaveisJson);
    expect(persistidas).toMatchObject({ valor_total: "1.01", valor_total_extenso: "um real e um centavo", __modeloContratoPadrao: "docx-v1", __outraFlag: true });
    expect(persistidas.__bpmCardId).toBeUndefined();
    const conteudo = "Preço R$\u00a01,01 (um real e um centavo)";
    expect(mocks.criarClausulas).toHaveBeenCalledWith({ data: [expect.objectContaining({ conteudo })] });
    expect(mocks.pdf).toHaveBeenCalledWith(expect.objectContaining({ clausulas: [{ titulo: "Preço", conteudo }] }));
    expect(mocks.pdfHtml.mock.calls[0][0]).toContain("um real e um centavo");
    expect(mocks.pdfHtml.mock.calls[0][0]).not.toContain("texto forjado");
    expect(mocks.put.mock.calls[0][1].toString()).toBe("%PDF-fixture");
    expect(mocks.put.mock.calls[2][1].toString()).toBe("%PDF-html-fixture");
  });

  it.each(["", "1.234", "abc", "90071992547409.91"])("mantém validação de extenso obrigatório para valor inválido %s", async (valor) => {
    const resultado = await GerarDocumento({ templateId: CONTRATO_PADRAO_ID, titulo: "Contrato", variaveis: { valor_total: valor, valor_total_extenso: "forjado" } });
    expect(resultado).toMatchObject({ success: false, error: expect.stringContaining("obrigatórios") });
    expect(mocks.transacao).not.toHaveBeenCalled();
    expect(mocks.pdf).not.toHaveBeenCalled();
  });
});
