import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getPermissoesEfetivas: vi.fn(),
  findUniqueDocumento: vi.fn(),
  findUniqueDocumentoOwnership: vi.fn(),
  updateDocumento: vi.fn(),
  put: vi.fn(),
  gerarPdfDocumento: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));

vi.mock("@/lib/prisma", () => ({
  default: {
    documentoGerado: {
      findUnique: (...args: unknown[]) => {
        // Primeira chamada real do fluxo é dentro de exigirOwnershipDocumento (ownership.ts,
        // select {id, criadoPorId, status, templateId}), a segunda é a busca de título+cláusulas
        // feita diretamente em FinalizarDocumento — diferenciamos pelo shape do select.
        const arg = args[0] as { select?: Record<string, unknown> };
        if (arg?.select && "criadoPorId" in arg.select) {
          return mocks.findUniqueDocumentoOwnership(...args);
        }
        return mocks.findUniqueDocumento(...args);
      },
      update: mocks.updateDocumento,
    },
    documentoTemplate: { findUnique: vi.fn() },
  },
}));

vi.mock("@/actions/PermissoesSetor", () => ({
  getPermissoesEfetivas: mocks.getPermissoesEfetivas,
}));

vi.mock("@vercel/blob", () => ({ put: mocks.put }));

vi.mock("@/lib/gerador-documentos/pdf", () => ({
  gerarPdfDocumento: mocks.gerarPdfDocumento,
}));

vi.mock("@/lib/bibble/tika", () => ({ extractTextFromBuffer: vi.fn() }));
vi.mock("@/lib/onyx/user-token", () => ({ getUserOnyxToken: vi.fn() }));
vi.mock("@/lib/gerador-documentos/onyx", () => ({
  identificarVariaveisEClasulasViaIA: vi.fn(),
  reescreverClasulaViaIA: vi.fn(),
}));

import { FinalizarDocumento } from "@/actions/gerador-documentos";

const DOCUMENTO_ID = "clx0000000000000000000000";

describe("FinalizarDocumento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "10", role: "User" } });
    mocks.getPermissoesEfetivas.mockResolvedValue(["geradorDocumentos"]);
    mocks.findUniqueDocumentoOwnership.mockResolvedValue({
      id: DOCUMENTO_ID,
      criadoPorId: 10,
      status: "CONFERENCIA",
      templateId: "template-1",
    });
    process.env.BLOB_READ_WRITE_TOKEN = "fake-token";
  });

  it("caminho feliz: gera PDF, sobe pro blob, atualiza status+pdfUrl e retorna pdfUrl", async () => {
    mocks.findUniqueDocumento.mockResolvedValue({
      titulo: "Contrato de Teste",
      clausulas: [{ titulo: "Objeto", conteudo: "Texto da cláusula." }],
    });
    mocks.gerarPdfDocumento.mockResolvedValue(Buffer.from("%PDF-fake"));
    mocks.put.mockResolvedValue({ url: "https://blob.vercel-storage.com/documento-final.pdf" });
    mocks.updateDocumento.mockResolvedValue({});

    const resultado = await FinalizarDocumento(DOCUMENTO_ID);

    expect(resultado).toEqual({ success: true, pdfUrl: "https://blob.vercel-storage.com/documento-final.pdf" });
    expect(mocks.gerarPdfDocumento).toHaveBeenCalledWith({
      titulo: "Contrato de Teste",
      clausulas: [{ titulo: "Objeto", conteudo: "Texto da cláusula." }],
    });
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.updateDocumento).toHaveBeenCalledWith({
      where: { id: DOCUMENTO_ID },
      data: { status: "FINALIZADO", finalizadoEm: expect.any(Date), pdfUrl: "https://blob.vercel-storage.com/documento-final.pdf" },
    });
  });

  it("se gerarPdfDocumento falhar, o update de status NUNCA é chamado (garantia de atomicidade)", async () => {
    mocks.findUniqueDocumento.mockResolvedValue({
      titulo: "Contrato de Teste",
      clausulas: [{ titulo: "Objeto", conteudo: "Texto." }],
    });
    mocks.gerarPdfDocumento.mockRejectedValue(new Error("Falha ao renderizar PDF"));

    const resultado = await FinalizarDocumento(DOCUMENTO_ID);

    expect(resultado.success).toBe(false);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.updateDocumento).not.toHaveBeenCalled();
  });

  it("se o upload (put) falhar, o update de status NUNCA é chamado", async () => {
    mocks.findUniqueDocumento.mockResolvedValue({
      titulo: "Contrato de Teste",
      clausulas: [{ titulo: "Objeto", conteudo: "Texto." }],
    });
    mocks.gerarPdfDocumento.mockResolvedValue(Buffer.from("%PDF-fake"));
    mocks.put.mockRejectedValue(new Error("Falha no upload do blob"));

    const resultado = await FinalizarDocumento(DOCUMENTO_ID);

    expect(resultado.success).toBe(false);
    expect(mocks.updateDocumento).not.toHaveBeenCalled();
  });

  it("documento não encontrado: retorna erro sem tentar gerar PDF", async () => {
    mocks.findUniqueDocumento.mockResolvedValue(null);

    const resultado = await FinalizarDocumento(DOCUMENTO_ID);

    expect(resultado).toEqual({ success: false, error: "Documento não encontrado" });
    expect(mocks.gerarPdfDocumento).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("usuário sem ownership do documento é bloqueado antes de buscar cláusulas", async () => {
    mocks.findUniqueDocumentoOwnership.mockResolvedValue({
      id: DOCUMENTO_ID,
      criadoPorId: 999, // outro usuário
      status: "CONFERENCIA",
      templateId: "template-1",
    });

    const resultado = await FinalizarDocumento(DOCUMENTO_ID);

    expect(resultado.success).toBe(false);
    expect(mocks.findUniqueDocumento).not.toHaveBeenCalled();
    expect(mocks.gerarPdfDocumento).not.toHaveBeenCalled();
  });

  it("BLOB_READ_WRITE_TOKEN ausente: retorna erro amigável sem vazar detalhe, sem chamar put", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    mocks.findUniqueDocumento.mockResolvedValue({
      titulo: "Contrato de Teste",
      clausulas: [{ titulo: "Objeto", conteudo: "Texto." }],
    });
    mocks.gerarPdfDocumento.mockResolvedValue(Buffer.from("%PDF-fake"));

    const resultado = await FinalizarDocumento(DOCUMENTO_ID);

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error).not.toMatch(/BLOB_READ_WRITE_TOKEN/);
    }
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.updateDocumento).not.toHaveBeenCalled();
  });
});
