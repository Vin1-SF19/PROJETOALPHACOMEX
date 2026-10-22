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


  it("deriva o extenso no servidor, corrige cláusula original e preserva manual/IA", async () => {
    mocks.findDocumento.mockReset()
      .mockResolvedValueOnce({ id: DOCUMENTO_ID, criadoPorId: 10, status: "CONFERENCIA", templateId: CONTRATO_PADRAO_ID, titulo: "Contrato", pdfUrl: "https://blob.example/anterior.pdf" })
      .mockResolvedValueOnce({ variaveisJson: JSON.stringify({ __bpmCardId: "card-1", valor_total: "1.01", valor_total_extenso: "texto antigo" }) });
    const original = "Preço {{valor_total}} ({{valor_total_extenso}})";
    mocks.findClausulas.mockResolvedValue([
      { id: CLAUSULA_ID, ordem: 0, titulo: "Preço", conteudoOriginal: original, conteudo: "Preço R$\u00a01,01 (texto antigo)", reescritoPorIA: false },
      { id: "manual", ordem: 1, titulo: "Manual", conteudoOriginal: original, conteudo: "Texto negociado manualmente", reescritoPorIA: false },
      { id: "ia", ordem: 2, titulo: "IA", conteudoOriginal: original, conteudo: "Preço R$\u00a01,01 (texto antigo)", reescritoPorIA: true },
    ]);
    const resultado = await AtualizarVariaveisContratoPadrao({ documentoId: DOCUMENTO_ID, valores: { valor_total: "2.02", valor_total_extenso: "forjado" } });
    expect(resultado.success).toBe(true);
    if (!resultado.success) return;
    expect(resultado.data.variaveisJson.valor_total_extenso).toBe("dois reais e dois centavos");
    expect(resultado.data.variaveisJson.__bpmCardId).toBe("card-1");
    expect(resultado.data.clausulas.map((item) => item.conteudo)).toEqual(["Preço R$\u00a02,02 (dois reais e dois centavos)", "Texto negociado manualmente", "Preço R$\u00a01,01 (texto antigo)"]);
    expect(mocks.updateClausula).toHaveBeenCalledTimes(1);
    expect(mocks.updateDocumento).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ variaveisJson: expect.stringContaining('"valor_total_extenso":"dois reais e dois centavos"') }) }));
    expect(mocks.gerarPdfDocumento).toHaveBeenCalledWith(expect.objectContaining({ clausulas: expect.arrayContaining([expect.objectContaining({ conteudo: "Preço R$\u00a02,02 (dois reais e dois centavos)" })]) }));
    expect(mocks.put.mock.calls[0][1].toString()).toContain("dois reais e dois centavos");
  });

  it.each(["FINALIZADO", "ARQUIVADO"])("preserva documento %s", async (status) => {
    mocks.findDocumento.mockReset().mockResolvedValue({ id: DOCUMENTO_ID, criadoPorId: 10, status, templateId: CONTRATO_PADRAO_ID });
    const resultado = await AtualizarVariaveisContratoPadrao({ documentoId: DOCUMENTO_ID, valores: { valor_total: "2" } });
    expect(resultado.success).toBe(false);
    expect(mocks.transacao).not.toHaveBeenCalled();
    expect(mocks.gerarPdfDocumento).not.toHaveBeenCalled();
  });

  it("não grava novos valores se a geração do PDF falhar", async () => {
    mocks.gerarPdfDocumento.mockRejectedValue(new Error("Falha no PDF"));
    const resultado = await AtualizarVariaveisContratoPadrao({ documentoId: DOCUMENTO_ID, valores: { data_assinatura: "2026-10-01" } });
    expect(resultado.success).toBe(false);
    expect(mocks.transacao).not.toHaveBeenCalled();
  });
});
