import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  permissoes: vi.fn(),
  findDocumento: vi.fn(),
  findClausulas: vi.fn(),
  findTemplate: vi.fn(),
  queryRaw: vi.fn(),
  transacao: vi.fn(),
  updateManyClausula: vi.fn(),
  updateManyDocumento: vi.fn(),
  executeRaw: vi.fn(),
  renderHtmlParaPdf: vi.fn(),
  gerarPdfDocumento: vi.fn(),
  carregarEstiloDocxPdf: vi.fn(),
  put: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/actions/PermissoesSetor", () => ({ getPermissoesEfetivas: mocks.permissoes }));
vi.mock("@/lib/gerador-documentos/pdf-renderer", () => ({ renderHtmlParaPdf: mocks.renderHtmlParaPdf }));
vi.mock("@/lib/gerador-documentos/pdf", () => ({ gerarPdfDocumento: mocks.gerarPdfDocumento }));
vi.mock("@/lib/gerador-documentos/docx-style", () => ({ carregarEstiloDocxPdf: mocks.carregarEstiloDocxPdf }));
vi.mock("@vercel/blob", () => ({ put: mocks.put }));
vi.mock("@/lib/bibble/tika", () => ({ extractTextFromBuffer: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    documentoGerado: { findUnique: mocks.findDocumento },
    documentoTemplate: { findUnique: mocks.findTemplate },
    documentoClasulaGerada: { findMany: mocks.findClausulas },
    $queryRaw: (...args: unknown[]) => mocks.queryRaw(...args),
    $transaction: (...args: unknown[]) => mocks.transacao(...args),
  },
}));

import { EditarClasulaGerada } from "@/actions/gerador-documentos";

const DOCUMENTO_ID = "clx0000000000000000000000";
const CLAUSULA_ID = "clx1111111111111111111111";

describe("EditarClasulaGerada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BLOB_READ_WRITE_TOKEN = "fake-token";
    mocks.auth.mockResolvedValue({ user: { id: "10", role: "User" } });
    mocks.permissoes.mockResolvedValue(["geradorDocumentos"]);
    mocks.findDocumento.mockResolvedValue({
      id: DOCUMENTO_ID,
      criadoPorId: 10,
      status: "CONFERENCIA",
      templateId: "template-1",
      titulo: "Contrato",
      pdfUrl: "https://blob.example/gerador-documentos/documentos-pdf/10/anterior.pdf",
    });
    mocks.findClausulas.mockResolvedValue([
      { id: CLAUSULA_ID, titulo: "Objeto", conteudo: "Prestação mensal." },
      { id: "clx2222222222222222222222", titulo: "Prazo", conteudo: "Doze meses." },
    ]);
    mocks.findTemplate.mockResolvedValue(null);
    mocks.queryRaw.mockResolvedValue([{ htmlUrl: "https://blob.example/anterior.html" }]);
    mocks.renderHtmlParaPdf.mockResolvedValue(Buffer.from("%PDF-atualizado"));
    mocks.put
      .mockResolvedValueOnce({ url: "https://blob.example/revisao.html" })
      .mockResolvedValueOnce({ url: "https://blob.example/revisao.pdf" });
    mocks.updateManyClausula.mockResolvedValue({ count: 1 });
    mocks.updateManyDocumento.mockResolvedValue({ count: 1 });
    mocks.transacao.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      documentoClasulaGerada: { updateMany: mocks.updateManyClausula },
      documentoGerado: { updateMany: mocks.updateManyDocumento },
      $executeRaw: mocks.executeRaw,
    }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("<html><body><p>Prestação mensal.</p><p>Doze meses.</p></body></html>"),
    ));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("salva a cláusula e publica PDF e HTML da mesma revisão", async () => {
    const resultado = await EditarClasulaGerada({
      documentoId: DOCUMENTO_ID,
      clasulaId: CLAUSULA_ID,
      conteudo: "Prestação trimestral.",
    });

    expect(resultado).toEqual({ success: true, pdfDisponivel: true, atualizado: true });
    expect(mocks.renderHtmlParaPdf).toHaveBeenCalledWith(expect.stringContaining("Prestação trimestral."));
    expect(mocks.gerarPdfDocumento).not.toHaveBeenCalled();
    expect(Buffer.from(mocks.put.mock.calls[0][1]).toString("utf8")).toContain("Prestação trimestral.");
    expect(mocks.put.mock.calls[0][0].replace("documentos-html", "documentos-pdf").replace(".html", ".pdf"))
      .toBe(mocks.put.mock.calls[1][0]);
    expect(mocks.updateManyClausula).toHaveBeenCalledWith({
      where: { id: CLAUSULA_ID, documentoId: DOCUMENTO_ID, conteudo: "Prestação mensal." },
      data: { conteudo: "Prestação trimestral." },
    });
    expect(mocks.updateManyDocumento).toHaveBeenCalledWith(expect.objectContaining({
      data: { pdfUrl: "https://blob.example/revisao.pdf" },
    }));
  });

  it("não permite editar documento finalizado", async () => {
    mocks.findDocumento.mockResolvedValue({ id: DOCUMENTO_ID, criadoPorId: 10, status: "FINALIZADO" });
    const resultado = await EditarClasulaGerada({ documentoId: DOCUMENTO_ID, clasulaId: CLAUSULA_ID, conteudo: "Novo texto" });
    expect(resultado).toEqual({ success: false, error: "Este documento não pode mais ser editado" });
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("conserva o cabeçalho e a fonte do DOCX no PDF após edição manual", async () => {
    const estiloDocx = { fonteCorpo: "Palatino Linotype", cabecalhoImagem: "data:image/png;base64,abc" };
    mocks.findTemplate.mockResolvedValue({ arquivoOrigemNome: "Contrato.docx", arquivoOrigemUrl: "https://blob.example/modelo.docx" });
    mocks.carregarEstiloDocxPdf.mockResolvedValue(estiloDocx);
    mocks.gerarPdfDocumento.mockResolvedValue(Buffer.from("%PDF-com-logo"));

    const resultado = await EditarClasulaGerada({ documentoId: DOCUMENTO_ID, clasulaId: CLAUSULA_ID, conteudo: "Prestação trimestral." });

    expect(resultado.success).toBe(true);
    expect(mocks.gerarPdfDocumento).toHaveBeenCalledWith(expect.objectContaining({
      estiloDocx,
      clausulas: expect.arrayContaining([expect.objectContaining({ conteudo: "Prestação trimestral." })]),
    }));
    expect(mocks.renderHtmlParaPdf).not.toHaveBeenCalled();
  });

  it("não persiste texto quando a geração do PDF falha", async () => {
    mocks.renderHtmlParaPdf.mockRejectedValue(new Error("Falha no PDF"));
    const resultado = await EditarClasulaGerada({ documentoId: DOCUMENTO_ID, clasulaId: CLAUSULA_ID, conteudo: "Novo texto" });
    expect(resultado.success).toBe(false);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.transacao).not.toHaveBeenCalled();
  });
});
