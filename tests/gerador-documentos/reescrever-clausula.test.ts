import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getPermissoesEfetivas: vi.fn(),
  findUniqueDocumento: vi.fn(),
  findManyClausulas: vi.fn(),
  getUserOnyxToken: vi.fn(),
  reescreverClasulaViaIA: vi.fn(),
  queryRaw: vi.fn(),
  renderHtmlParaPdf: vi.fn(),
  put: vi.fn(),
  transaction: vi.fn(),
  updateClausula: vi.fn(),
  updateDocumento: vi.fn(),
  executeRaw: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/actions/PermissoesSetor", () => ({ getPermissoesEfetivas: mocks.getPermissoesEfetivas }));
vi.mock("@/lib/onyx/user-token", () => ({ getUserOnyxToken: mocks.getUserOnyxToken }));
vi.mock("@/lib/gerador-documentos/onyx", () => ({
  identificarVariaveisEClasulasViaIA: vi.fn(),
  reescreverClasulaViaIA: mocks.reescreverClasulaViaIA,
}));
vi.mock("@/lib/gerador-documentos/pdf-renderer", () => ({ renderHtmlParaPdf: mocks.renderHtmlParaPdf }));
vi.mock("@vercel/blob", () => ({ put: mocks.put }));
vi.mock("@/lib/bibble/tika", () => ({ extractTextFromBuffer: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    documentoGerado: { findUnique: mocks.findUniqueDocumento },
    documentoTemplate: { findUnique: vi.fn() },
    documentoClasulaGerada: { findMany: mocks.findManyClausulas },
    $queryRaw: (...args: unknown[]) => mocks.queryRaw(...args),
    $transaction: (...args: unknown[]) => mocks.transaction(...args),
  },
}));

import { ReescreverClasulaComIA } from "@/actions/gerador-documentos";
import { OnyxError } from "@/lib/onyx/client";

const DOCUMENTO_ID = "clx0000000000000000000000";
const CLAUSULA_ID = "clx1111111111111111111111";

describe("ReescreverClasulaComIA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "10", role: "User" } });
    mocks.getPermissoesEfetivas.mockResolvedValue(["geradorDocumentos"]);
    mocks.findUniqueDocumento.mockResolvedValue({
      id: DOCUMENTO_ID,
      criadoPorId: 10,
      status: "CONFERENCIA",
      templateId: "template-1",
      titulo: "Contrato",
      pdfUrl: "https://blob.example/gerador-documentos/documentos-pdf/10/documento-anterior.pdf",
    });
    mocks.findManyClausulas.mockResolvedValue([
      { id: CLAUSULA_ID, titulo: "Objeto", conteudo: "A prestação será mensal." },
      { id: "clx2222222222222222222222", titulo: "Prazo", conteudo: "Vigência de 12 meses." },
    ]);
    mocks.getUserOnyxToken.mockResolvedValue("token-individual");
    mocks.queryRaw.mockResolvedValue([{ titulo: "Contrato", htmlUrl: "https://blob.example/documento.html" }]);
    mocks.renderHtmlParaPdf.mockResolvedValue(Buffer.from("%PDF-atualizado"));
    mocks.put
      .mockResolvedValueOnce({ url: "https://blob.example/documento-revisado.html" })
      .mockResolvedValueOnce({ url: "https://blob.example/documento-revisado.pdf" });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        documentoClasulaGerada: { update: mocks.updateClausula },
        documentoGerado: { update: mocks.updateDocumento },
        $executeRaw: mocks.executeRaw,
      }),
    );
    process.env.BLOB_READ_WRITE_TOKEN = "fake-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html><body><h2>Objeto</h2><p>A prestação será <mark>mensal</mark>.</p><h2>Prazo</h2><p>Vigência de 12 meses.</p></body></html>"),
      ),
    );
  });

  it("chama a IA e sincroniza cláusula, HTML e PDF antes de retornar à UI", async () => {
    mocks.reescreverClasulaViaIA.mockResolvedValue("A prestação será trimestral.");

    const resultado = await ReescreverClasulaComIA({
      documentoId: DOCUMENTO_ID,
      clasulaId: CLAUSULA_ID,
      instrucao: "Troque a periodicidade para trimestral",
    });

    expect(resultado).toEqual({
      success: true,
      conteudo: "A prestação será trimestral.",
      htmlUrl: "https://blob.example/documento-revisado.html",
      pdfDisponivel: true,
    });
    expect(mocks.reescreverClasulaViaIA).toHaveBeenCalledWith(expect.objectContaining({
      textoAtual: "A prestação será mensal.",
      userToken: "token-individual",
    }));
    const htmlEnviado = Buffer.from(mocks.put.mock.calls[0][1]).toString("utf8");
    expect(htmlEnviado).toContain("A prestação será trimestral.");
    expect(htmlEnviado).not.toContain("A prestação será <mark>mensal</mark>.");
    expect(mocks.renderHtmlParaPdf).toHaveBeenCalledWith(expect.stringContaining("trimestral"));
    expect(mocks.updateClausula).toHaveBeenCalledOnce();
    expect(mocks.updateDocumento).toHaveBeenCalledWith({
      where: { id: DOCUMENTO_ID },
      data: { pdfUrl: "https://blob.example/documento-revisado.pdf" },
    });
  });

  it("bloqueia falta de ownership antes de consultar cláusula ou chamar IA", async () => {
    mocks.findUniqueDocumento.mockResolvedValue({
      id: DOCUMENTO_ID,
      criadoPorId: 99,
      status: "CONFERENCIA",
      templateId: "template-1",
      titulo: "Contrato",
      pdfUrl: null,
    });

    const resultado = await ReescreverClasulaComIA({
      documentoId: DOCUMENTO_ID,
      clasulaId: CLAUSULA_ID,
      instrucao: "Deixe mais formal",
    });

    expect(resultado).toEqual({ success: false, error: "Não autorizado" });
    expect(mocks.findManyClausulas).not.toHaveBeenCalled();
    expect(mocks.reescreverClasulaViaIA).not.toHaveBeenCalled();
  });

  it("persiste a revisão sem htmlUrl no schema e recupera o HTML irmão do PDF", async () => {
    mocks.queryRaw.mockRejectedValue(new Error("no such column: htmlUrl"));
    mocks.reescreverClasulaViaIA.mockResolvedValue("A prestação será trimestral.");

    const resultado = await ReescreverClasulaComIA({
      documentoId: DOCUMENTO_ID,
      clasulaId: CLAUSULA_ID,
      instrucao: "Troque a periodicidade para trimestral",
    });

    expect(resultado.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "https://blob.example/gerador-documentos/documentos-html/10/documento-anterior.html",
    );
    expect(mocks.updateClausula).toHaveBeenCalledOnce();
    expect(mocks.updateDocumento).toHaveBeenCalledOnce();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });

  it.each([
    new OnyxError("A IA não respondeu dentro do tempo limite.", 504),
    new OnyxError("A IA não retornou nenhum texto para esta cláusula.", 502),
  ])("não persiste artefatos quando a IA falha: %s", async (erro) => {
    mocks.reescreverClasulaViaIA.mockRejectedValue(erro);

    const resultado = await ReescreverClasulaComIA({
      documentoId: DOCUMENTO_ID,
      clasulaId: CLAUSULA_ID,
      instrucao: "Deixe mais formal",
    });

    expect(resultado).toEqual({ success: false, error: erro.message });
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
