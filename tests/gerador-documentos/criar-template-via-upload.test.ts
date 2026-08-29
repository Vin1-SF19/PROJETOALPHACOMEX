import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getPermissoesEfetivas: vi.fn(),
  extractTextFromBuffer: vi.fn(),
  put: vi.fn(),
  identificarVariaveisEClasulasViaIA: vi.fn(),
  getUserOnyxToken: vi.fn(),
  createTemplate: vi.fn(),
  createManyClasula: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));

vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: mocks.transaction,
    documentoTemplate: { create: mocks.createTemplate },
    documentoClasula: { createMany: mocks.createManyClasula },
  },
}));

vi.mock("@/actions/PermissoesSetor", () => ({
  getPermissoesEfetivas: mocks.getPermissoesEfetivas,
}));

vi.mock("@/lib/bibble/tika", () => ({
  extractTextFromBuffer: mocks.extractTextFromBuffer,
}));

vi.mock("@vercel/blob", () => ({
  put: mocks.put,
}));

vi.mock("@/lib/onyx/user-token", () => ({
  getUserOnyxToken: mocks.getUserOnyxToken,
}));

vi.mock("@/lib/gerador-documentos/onyx", () => ({
  identificarVariaveisEClasulasViaIA: mocks.identificarVariaveisEClasulasViaIA,
  reescreverClasulaViaIA: vi.fn(),
}));

import { CriarTemplateViaUpload } from "@/actions/gerador-documentos";

function criarFormData(file: File | null): FormData {
  const formData = new FormData();
  if (file) formData.append("arquivo", file);
  return formData;
}

function arquivoValido(overrides: Partial<{ nome: string; tipo: string; tamanho: number }> = {}): File {
  const { nome = "contrato.pdf", tipo = "application/pdf", tamanho = 1024 } = overrides;
  const conteudo = new Uint8Array(tamanho);
  return new File([conteudo], nome, { type: tipo });
}

describe("CriarTemplateViaUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "10", role: "User" } });
    mocks.getPermissoesEfetivas.mockResolvedValue(["geradorDocumentos"]);
    process.env.BLOB_READ_WRITE_TOKEN = "fake-token";
  });

  it("rejeita quando nenhum arquivo é enviado no FormData", async () => {
    const resultado = await CriarTemplateViaUpload(criarFormData(null));

    expect(resultado).toEqual({ success: false, error: "Envie um documento para criar o template" });
    expect(mocks.extractTextFromBuffer).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.identificarVariaveisEClasulasViaIA).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejeita arquivo com size 0 (vazio) sem chamar extração/IA/blob", async () => {
    const resultado = await CriarTemplateViaUpload(criarFormData(arquivoValido({ tamanho: 0 })));

    expect(resultado).toEqual({ success: false, error: "O arquivo enviado está vazio" });
    expect(mocks.extractTextFromBuffer).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.identificarVariaveisEClasulasViaIA).not.toHaveBeenCalled();
  });

  it("rejeita arquivo maior que 10MB sem chamar extração/IA/blob", async () => {
    const resultado = await CriarTemplateViaUpload(criarFormData(arquivoValido({ tamanho: 10 * 1024 * 1024 + 1 })));

    expect(resultado).toEqual({ success: false, error: "O arquivo excede o limite de 10MB" });
    expect(mocks.extractTextFromBuffer).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.identificarVariaveisEClasulasViaIA).not.toHaveBeenCalled();
  });

  it("rejeita tipo MIME não suportado sem chamar extração/IA/blob", async () => {
    const resultado = await CriarTemplateViaUpload(
      criarFormData(arquivoValido({ nome: "planilha.xlsx", tipo: "application/vnd.ms-excel" })),
    );

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error).toMatch(/Formato não suportado/);
    }
    expect(mocks.extractTextFromBuffer).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.identificarVariaveisEClasulasViaIA).not.toHaveBeenCalled();
  });

  it("rejeita quando extractTextFromBuffer não consegue extrair texto (fonte 'unsupported')", async () => {
    mocks.extractTextFromBuffer.mockResolvedValue({ text: "", source: "unsupported" });

    const resultado = await CriarTemplateViaUpload(criarFormData(arquivoValido()));

    expect(resultado.success).toBe(false);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.identificarVariaveisEClasulasViaIA).not.toHaveBeenCalled();
  });

  it("rejeita quando o texto extraído é vazio mesmo com fonte suportada (ex: PDF de imagem sem OCR)", async () => {
    mocks.extractTextFromBuffer.mockResolvedValue({ text: "   ", source: "pdf-parse" });

    const resultado = await CriarTemplateViaUpload(criarFormData(arquivoValido()));

    expect(resultado.success).toBe(false);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.identificarVariaveisEClasulasViaIA).not.toHaveBeenCalled();
  });

  it("bloqueia usuário não autenticado antes de qualquer validação de arquivo", async () => {
    mocks.auth.mockResolvedValue(null);

    const resultado = await CriarTemplateViaUpload(criarFormData(arquivoValido()));

    expect(resultado.success).toBe(false);
    expect(mocks.extractTextFromBuffer).not.toHaveBeenCalled();
  });

  it("bloqueia usuário sem permissão do módulo", async () => {
    mocks.getPermissoesEfetivas.mockResolvedValue(["outroModulo"]);

    const resultado = await CriarTemplateViaUpload(criarFormData(arquivoValido()));

    expect(resultado.success).toBe(false);
    expect(mocks.extractTextFromBuffer).not.toHaveBeenCalled();
  });

  it("caminho feliz: extrai texto, sobe blob, chama IA e persiste o template", async () => {
    mocks.extractTextFromBuffer.mockResolvedValue({ text: "Contrato entre as partes...", source: "tika" });
    mocks.put.mockResolvedValue({ url: "https://blob.vercel-storage.com/fake-url" });
    mocks.getUserOnyxToken.mockResolvedValue("onyx-token");
    mocks.identificarVariaveisEClasulasViaIA.mockResolvedValue({
      variaveis: [{ nome: "cliente", label: "Cliente", tipo: "texto", obrigatorio: true, placeholder: "" }],
      clausulas: [{ titulo: "Objeto", conteudo: "Texto com {{cliente}}." }],
    });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => {
      const tx = {
        documentoTemplate: { create: vi.fn().mockResolvedValue({ id: "template-1" }) },
        documentoClasula: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      };
      return callback(tx);
    });

    const resultado = await CriarTemplateViaUpload(criarFormData(arquivoValido({ nome: "Contrato Prestação.pdf" })));

    expect(resultado).toEqual({ success: true, templateId: "template-1" });
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.identificarVariaveisEClasulasViaIA).toHaveBeenCalledWith("Contrato entre as partes...", "onyx-token");
  });

  it("propaga erro amigável quando a IA falha (nenhum template parcial é criado)", async () => {
    mocks.extractTextFromBuffer.mockResolvedValue({ text: "Contrato entre as partes...", source: "tika" });
    mocks.put.mockResolvedValue({ url: "https://blob.vercel-storage.com/fake-url" });
    mocks.getUserOnyxToken.mockResolvedValue("onyx-token");
    mocks.identificarVariaveisEClasulasViaIA.mockRejectedValue(new Error("A IA não conseguiu estruturar variáveis e cláusulas a partir deste documento."));

    const resultado = await CriarTemplateViaUpload(criarFormData(arquivoValido()));

    expect(resultado.success).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
