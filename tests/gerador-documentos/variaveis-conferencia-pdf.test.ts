import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), permissoes: vi.fn(), findDocumento: vi.fn(), findClausulas: vi.fn(),
  carregarContratoPadrao: vi.fn(), gerarPdfDocumento: vi.fn(), put: vi.fn(), queryRaw: vi.fn(),
  transacao: vi.fn(), updateDocumento: vi.fn(), updateClausula: vi.fn(), executeRaw: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/actions/PermissoesSetor", () => ({ getPermissoesEfetivas: mocks.permissoes }));
vi.mock("@/lib/gerador-documentos/contrato-padrao", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/gerador-documentos/contrato-padrao")>(),
  carregarContratoPadrao: mocks.carregarContratoPadrao,
}));
vi.mock("@/lib/gerador-documentos/pdf", () => ({ gerarPdfDocumento: mocks.gerarPdfDocumento }));
vi.mock("@vercel/blob", () => ({ put: mocks.put }));
vi.mock("@/lib/bibble/tika", () => ({ extractTextFromBuffer: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    documentoGerado: { findUnique: mocks.findDocumento },
    documentoClasulaGerada: { findMany: mocks.findClausulas },
    $queryRaw: (...args: unknown[]) => mocks.queryRaw(...args),
    $transaction: (...args: unknown[]) => mocks.transacao(...args),
  },
}));

import { AtualizarVariaveisContratoPadrao } from "@/actions/gerador-documentos";
import { CONTRATO_PADRAO_ID } from "@/lib/gerador-documentos/contrato-padrao-id";

const DOCUMENTO_ID = "clx0000000000000000000000";
const CLAUSULA_ID = "clx1111111111111111111111";

describe("AtualizarVariaveisContratoPadrao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BLOB_READ_WRITE_TOKEN = "fake-token";
    mocks.auth.mockResolvedValue({ user: { id: "10", role: "User" } });
    mocks.permissoes.mockResolvedValue(["geradorDocumentos"]);
    mocks.findDocumento
      .mockResolvedValueOnce({ id: DOCUMENTO_ID, criadoPorId: 10, status: "CONFERENCIA", templateId: CONTRATO_PADRAO_ID, titulo: "Contrato", pdfUrl: "https://blob.example/anterior.pdf" })
      .mockResolvedValueOnce({ variaveisJson: JSON.stringify({ __bpmCardId: "card-1", __modeloContratoPadrao: "docx-v1", data_assinatura: "2026-09-25" }) });
    mocks.findClausulas.mockResolvedValue([{ id: CLAUSULA_ID, ordem: 0, titulo: "Data", conteudoOriginal: "Assinado em {{data_assinatura}}.", conteudo: "Assinado em 25/09/2026.", reescritoPorIA: false }]);
    mocks.carregarContratoPadrao.mockResolvedValue({ estiloDocx: { fonteCorpo: "Palatino Linotype", cabecalhoImagem: "logo" } });
    mocks.gerarPdfDocumento.mockResolvedValue(Buffer.from("%PDF-atualizado"));
    mocks.put.mockResolvedValueOnce({ url: "https://blob.example/novo.html" }).mockResolvedValueOnce({ url: "https://blob.example/novo.pdf" });
    mocks.queryRaw.mockResolvedValue([{ htmlUrl: "https://blob.example/anterior.html" }]);
    mocks.updateDocumento.mockResolvedValue({ count: 1 });
    mocks.updateClausula.mockResolvedValue({ count: 1 });
    mocks.transacao.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      documentoGerado: { updateMany: mocks.updateDocumento },
      documentoClasulaGerada: { updateMany: mocks.updateClausula },
      $executeRaw: mocks.executeRaw,
    }));
  });

  it("atualiza campos, cláusulas e PDF mesmo quando já havia um PDF", async () => {
    const resultado = await AtualizarVariaveisContratoPadrao({ documentoId: DOCUMENTO_ID, valores: { data_assinatura: "2026-10-01" } });

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;
    expect(resultado.data.pdfDisponivel).toBe(true);
    expect(resultado.data.clausulas[0].conteudo).toBe("Assinado em 01/10/2026.");
    expect(mocks.gerarPdfDocumento).toHaveBeenCalledWith(expect.objectContaining({
      estiloDocx: expect.objectContaining({ cabecalhoImagem: "logo" }),
      clausulas: expect.arrayContaining([expect.objectContaining({ conteudo: "Assinado em 01/10/2026." })]),
    }));
    expect(mocks.updateDocumento).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: DOCUMENTO_ID, status: "CONFERENCIA", pdfUrl: "https://blob.example/anterior.pdf" },
      data: expect.objectContaining({ pdfUrl: "https://blob.example/novo.pdf" }),
    }));
    expect(mocks.updateClausula).toHaveBeenCalledOnce();
  });

  it("não grava novos valores se a geração do PDF falhar", async () => {
    mocks.gerarPdfDocumento.mockRejectedValue(new Error("Falha no PDF"));
    const resultado = await AtualizarVariaveisContratoPadrao({ documentoId: DOCUMENTO_ID, valores: { data_assinatura: "2026-10-01" } });
    expect(resultado.success).toBe(false);
    expect(mocks.transacao).not.toHaveBeenCalled();
  });
});
