import { describe, expect, it } from "vitest";

/**
 * Réplica isolada da checagem de magic bytes usada em
 * src/app/api/metas/justificativas/upload/route.ts — a rota inteira depende
 * de Request/NextResponse reais do runtime Next.js, então a lógica de
 * validação (que é pura) é testada aqui separadamente.
 */
function ehPdf(bytes: Uint8Array): boolean {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

describe("validação de magic bytes de PDF (upload de Justificativa de Meta)", () => {
  it("aceita buffer que começa com %PDF", () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // "%PDF-1.4"
    expect(ehPdf(bytes)).toBe(true);
  });

  it("rejeita assinatura ZIP (DOCX/XLSX/PPTX começam com PK\\x03\\x04)", () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    expect(ehPdf(bytes)).toBe(false);
  });

  it("rejeita PNG (assinatura conhecida, caso de arquivo de imagem disfarçado)", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(ehPdf(bytes)).toBe(false);
  });

  it("rejeita buffer vazio sem lançar exceção", () => {
    const bytes = new Uint8Array([]);
    expect(() => ehPdf(bytes)).not.toThrow();
    expect(ehPdf(bytes)).toBe(false);
  });

  it("rejeita buffer com menos de 4 bytes sem lançar exceção", () => {
    const bytes = new Uint8Array([0x25, 0x50]);
    expect(() => ehPdf(bytes)).not.toThrow();
    expect(ehPdf(bytes)).toBe(false);
  });

  it("rejeita texto simples disfarçado de PDF", () => {
    const bytes = new TextEncoder().encode("nao sou um pdf de verdade");
    expect(ehPdf(bytes)).toBe(false);
  });
});
