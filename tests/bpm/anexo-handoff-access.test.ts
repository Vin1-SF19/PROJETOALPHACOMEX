import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), acesso: vi.fn(), acessoPipeline: vi.fn(), anexo: vi.fn(), vinculos: vi.fn(), get: vi.fn(), token: vi.fn() }));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ default: {
  bpmCardAnexo: { findUnique: mocks.anexo }, bpmCardVinculo: { findMany: mocks.vinculos },
} }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: mocks.acesso, checarAcessoBpmPipeline: mocks.acessoPipeline }));
vi.mock("@/lib/bpm/anexos-storage", () => ({
  extrairPathnamePrivadoAnexoBpm: () => "contratos/assinado.pdf",
  extrairUrlLegadaAnexoBpm: () => null,
  obterTokenBlobPrivadoAnexoBpm: mocks.token,
}));
vi.mock("@vercel/blob", () => ({ get: mocks.get }));

import { GET } from "@/app/api/bpm/anexos/[anexoId]/route";

const contexto = { params: Promise.resolve({ anexoId: "anexo-financeiro" }) };
const requisicao = new Request("http://localhost/api/bpm/anexos/anexo-financeiro");

describe("acesso a documento da contratação pelo card Operacional", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "Operacional" } });
    mocks.anexo.mockResolvedValue({ cardId: "financeiro", url: "privado", nome: "Contrato assinado.pdf",
      tipo: "application/pdf", card: { pipeline: { chave: "financeiro" } } });
    mocks.vinculos.mockResolvedValue([{ cardDestinoId: "operacional" }]);
    mocks.acessoPipeline.mockResolvedValue(true);
    mocks.acesso.mockImplementation(async (cardId: string) => {
      if (cardId !== "operacional") throw new Error("Sem acesso ao card de origem");
    });
    mocks.get.mockResolvedValue({ statusCode: 200, blob: { contentType: "application/pdf" },
      stream: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([37, 80, 68, 70])); controller.close(); } }) });
    mocks.token.mockReturnValue("token-privado-teste");
  });

  it("entrega via proxy quando o usuário pode ver o destino explicitamente vinculado", async () => {
    const resposta = await GET(requisicao, contexto);
    expect(resposta.status).toBe(200);
    expect(mocks.acesso).toHaveBeenCalledWith("operacional", 7, "Operacional", "visualizar");
    expect(mocks.vinculos).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ cardOrigemId: "financeiro" }) }));
    expect(mocks.get).toHaveBeenCalledWith("contratos/assinado.pdf", expect.objectContaining({ access: "private", token: "token-privado-teste" }));
  });

  it("nega se o vínculo não existe ou o destino não é visível", async () => {
    mocks.vinculos.mockResolvedValueOnce([]);
    expect((await GET(requisicao, contexto)).status).toBe(403);
    mocks.acesso.mockRejectedValue(new Error("Sem acesso"));
    expect((await GET(requisicao, contexto)).status).toBe(403);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("preserva acesso ao documento comercial de uma cadeia antiga com vínculo em dois passos", async () => {
    mocks.anexo.mockResolvedValueOnce({ cardId: "comercial", url: "privado", nome: "Proposta.pdf",
      tipo: "application/pdf", card: { pipeline: { chave: "comercial" } } });
    mocks.vinculos.mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ cardDestinoId: "financeiro" }])
      .mockResolvedValueOnce([{ cardDestinoId: "operacional" }]);
    expect((await GET(requisicao, contexto)).status).toBe(200);
    expect(mocks.acesso).toHaveBeenCalledWith("operacional", 7, "Operacional", "visualizar");
  });

  it("não usa o vínculo operacional para documento de outro pipeline", async () => {
    mocks.anexo.mockResolvedValueOnce({ cardId: "outro", url: "privado", nome: "Interno.pdf",
      tipo: "application/pdf", card: { pipeline: { chave: "interno" } } });
    expect((await GET(requisicao, contexto)).status).toBe(403);
    expect(mocks.vinculos).not.toHaveBeenCalled();
  });

  it("nega anexo de card arquivado sem acesso ao pipeline, antes de consultar o Blob", async () => {
    mocks.anexo.mockResolvedValueOnce({ cardId: "arquivado", url: "privado", nome: "Contrato.pdf",
      tipo: "application/pdf", card: { status: "ARQUIVADO", pipelineId: "radar", pipeline: { chave: "comercial" } } });
    mocks.acessoPipeline.mockResolvedValueOnce(false);
    expect((await GET(requisicao, contexto)).status).toBe(403);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("retorna indisponibilidade quando a store privada não está configurada", async () => {
    mocks.token.mockReturnValueOnce(null);
    const resposta = await GET(requisicao, contexto);
    expect(resposta.status).toBe(503);
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
