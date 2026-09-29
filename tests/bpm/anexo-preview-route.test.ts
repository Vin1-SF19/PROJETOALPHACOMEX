import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  acesso: vi.fn(),
  anexo: vi.fn(),
  documento: vi.fn(),
  get: vi.fn(),
  carregarContratoPadrao: vi.fn(),
  gerarPdfDocumento: vi.fn(),
}));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ default: {
  bpmCardAnexo: { findUnique: mocks.anexo },
  documentoGerado: { findUnique: mocks.documento },
} }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: mocks.acesso }));
vi.mock("@vercel/blob", () => ({ get: mocks.get }));
vi.mock("@/lib/gerador-documentos/contrato-padrao", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/gerador-documentos/contrato-padrao")>(),
  carregarContratoPadrao: mocks.carregarContratoPadrao,
}));
vi.mock("@/lib/gerador-documentos/pdf", () => ({ gerarPdfDocumento: mocks.gerarPdfDocumento }));

import { GET } from "@/app/api/bpm/anexos/[anexoId]/preview/route";
import { CONTRATO_PADRAO_ID } from "@/lib/gerador-documentos/contrato-padrao-id";

const token = "12345678-1234-1234-1234-123456789abc";
const anexo = { cardId: "card-1", tipo: "application/x-painel-alpha-documento", url: `/PainelAlpha/GeradorDocumentos/conferencia/${token}` };
const documento = {
  titulo: "Contrato Alpha", status: "CONFERENCIA", pdfUrl: null, templateId: CONTRATO_PADRAO_ID,
  variaveisJson: JSON.stringify({ __bpmCardId: "card-1" }),
  clausulas: [{ id: "clausula-1", ordem: 1, titulo: "Objeto", conteudo: "Prestação de serviços" }],
};
const contexto = { params: Promise.resolve({ anexoId: "anexo-1" }) };

describe("prévia autenticada do contrato no card", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "Financeiro" } });
    mocks.anexo.mockResolvedValue(anexo);
    mocks.documento.mockResolvedValue(documento);
    mocks.acesso.mockResolvedValue(undefined);
    mocks.carregarContratoPadrao.mockResolvedValue({ estiloDocx: { fonteCorpo: "Palatino" } });
    mocks.gerarPdfDocumento.mockResolvedValue(Buffer.from("%PDF-teste"));
  });

  it("exige sessão e acesso ao card antes de ler o contrato", async () => {
    mocks.auth.mockResolvedValueOnce(null);
    expect((await GET(new Request("http://localhost/api/bpm/anexos/anexo-1/preview"), contexto)).status).toBe(401);
    expect(mocks.anexo).not.toHaveBeenCalled();

    mocks.acesso.mockRejectedValueOnce(new Error("Sem permissão"));
    expect((await GET(new Request("http://localhost/api/bpm/anexos/anexo-1/preview"), contexto)).status).toBe(403);
    expect(mocks.documento).not.toHaveBeenCalled();
  });

  it("mostra as cláusulas e oferece prévia do modelo mesmo sem PDF salvo", async () => {
    const resposta = await GET(new Request("http://localhost/api/bpm/anexos/anexo-1/preview"), contexto);
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toMatchObject({ titulo: "Contrato Alpha", pdfDisponivel: true,
      pendencias: expect.arrayContaining(["Valor total por extenso", "Data de assinatura"]),
      clausulas: [{ titulo: "Objeto" }] });
    expect(mocks.acesso).toHaveBeenCalledWith("card-1", 7, "Financeiro", "visualizar");
    expect(mocks.documento).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenAcesso: token } }));
  });

  it("não abre documento cujo vínculo aponta para outro card", async () => {
    mocks.documento.mockResolvedValueOnce({ ...documento, variaveisJson: JSON.stringify({ __bpmCardId: "outro-card" }) });
    expect((await GET(new Request("http://localhost/api/bpm/anexos/anexo-1/preview"), contexto)).status).toBe(404);
  });

  it("entrega PDF inline sob a mesma autorização do card", async () => {
    mocks.documento.mockResolvedValueOnce({ ...documento, pdfUrl: "https://blob.example/contrato.pdf" });
    mocks.get.mockResolvedValueOnce({ statusCode: 200, stream: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([37, 80, 68, 70])); controller.close(); } }) });
    const resposta = await GET(new Request("http://localhost/api/bpm/anexos/anexo-1/preview?formato=pdf"), contexto);
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("Content-Type")).toBe("application/pdf");
    expect(resposta.headers.get("Content-Disposition")).toContain("inline");
    expect(mocks.get).toHaveBeenCalledWith("https://blob.example/contrato.pdf", expect.objectContaining({ access: "public" }));
  });

  it("renderiza o contrato padrão existente com o estilo do Gerador quando falta PDF salvo", async () => {
    const resposta = await GET(new Request("http://localhost/api/bpm/anexos/anexo-1/preview?formato=pdf"), contexto);
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("Content-Type")).toBe("application/pdf");
    expect(resposta.headers.get("Content-Disposition")).toContain("contrato-rascunho.pdf");
    expect(mocks.gerarPdfDocumento).toHaveBeenCalledWith({
      titulo: "Contrato Alpha", clausulas: documento.clausulas, estiloDocx: { fonteCorpo: "Palatino" },
    });
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
