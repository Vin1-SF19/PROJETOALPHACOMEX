import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  acesso: vi.fn(),
  anexo: vi.fn(),
  documento: vi.fn(),
  get: vi.fn(),
}));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ default: {
  bpmCardAnexo: { findUnique: mocks.anexo },
  documentoGerado: { findUnique: mocks.documento },
} }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: mocks.acesso }));
vi.mock("@vercel/blob", () => ({ get: mocks.get }));

import { GET } from "@/app/api/bpm/anexos/[anexoId]/preview/route";

const token = "12345678-1234-1234-1234-123456789abc";
const anexo = { cardId: "card-1", tipo: "application/x-painel-alpha-documento", url: `/PainelAlpha/GeradorDocumentos/conferencia/${token}` };
const documento = {
  titulo: "Contrato Alpha", status: "CONFERENCIA", pdfUrl: null,
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
  });

  it("exige sessão e acesso ao card antes de ler o contrato", async () => {
    mocks.auth.mockResolvedValueOnce(null);
    expect((await GET(new Request("http://localhost/api/bpm/anexos/anexo-1/preview"), contexto)).status).toBe(401);
    expect(mocks.anexo).not.toHaveBeenCalled();

    mocks.acesso.mockRejectedValueOnce(new Error("Sem permissão"));
    expect((await GET(new Request("http://localhost/api/bpm/anexos/anexo-1/preview"), contexto)).status).toBe(403);
    expect(mocks.documento).not.toHaveBeenCalled();
  });

  it("mostra as cláusulas para quem pode visualizar o card, mesmo sem PDF", async () => {
    const resposta = await GET(new Request("http://localhost/api/bpm/anexos/anexo-1/preview"), contexto);
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toMatchObject({ titulo: "Contrato Alpha", pdfDisponivel: false, clausulas: [{ titulo: "Objeto" }] });
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
});
