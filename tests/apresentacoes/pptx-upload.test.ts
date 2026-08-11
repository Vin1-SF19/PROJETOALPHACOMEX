import { describe, expect, it } from "vitest";
import {
  caminhoPertenceAoPptx,
  criarCaminhoUploadPptx,
  extrairCaminhoBlobPublico,
  PPTX_MAX_BYTES,
  prefixoOriginaisPptx,
} from "@/lib/apresentacoes/pptx/upload";

describe("upload de PPTX do Alpha Motion", () => {
  it("aceita somente URLs HTTPS do Vercel Blob e extrai o pathname", () => {
    expect(extrairCaminhoBlobPublico(
      "https://store.public.blob.vercel-storage.com/apresentacoes/ap-1/originais/deck.pptx",
    )).toBe("apresentacoes/ap-1/originais/deck.pptx");
    expect(extrairCaminhoBlobPublico("http://store.public.blob.vercel-storage.com/a.pptx")).toBeNull();
    expect(extrairCaminhoBlobPublico("https://blob.vercel-storage.com.evil.test/a.pptx")).toBeNull();
  });

  it("isola originais e temporários por apresentação", () => {
    expect(caminhoPertenceAoPptx("apresentacoes/ap-1/originais/a.pptx", "ap-1")).toBe(true);
    expect(caminhoPertenceAoPptx("apresentacoes/ap-1/preview/a.png", "ap-1")).toBe(true);
    expect(caminhoPertenceAoPptx("apresentacoes/ap-2/originais/a.pptx", "ap-1")).toBe(false);
    expect(caminhoPertenceAoPptx("apresentacoes/ap-1/outro/a.png", "ap-1")).toBe(false);
  });

  it("gera pathname seguro no diretório de originais e mantém o limite de 80 MB", () => {
    const pathname = criarCaminhoUploadPptx("ap-1", "Proposta São Paulo #1.pptx");
    expect(pathname).toMatch(new RegExp(`^${prefixoOriginaisPptx("ap-1")}[^/]+-Proposta_Sao_Paulo__1\\.pptx$`));
    expect(PPTX_MAX_BYTES).toBe(80 * 1024 * 1024);
  });
});
