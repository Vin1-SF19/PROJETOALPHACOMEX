import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

const cardFindUnique = vi.hoisted(() => vi.fn());
const configFindMany = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ default: {
  bpmCard: { findUnique: cardFindUnique },
  bpmCampoEtapaConfig: { findMany: configFindMany },
} }));

import { gerarFichaViabilidadeCardBpm } from "@/lib/bpm/ficha-viabilidade-server";

describe("ficha de viabilidade", () => {
  it("gera PDF a partir do card autorizado e sinaliza dados ausentes", async () => {
    cardFindUnique.mockResolvedValue({
      id: "card-123", pipeline: { nome: "Revisão de Radar" },
      etapa: { id: "etapa-1", nome: "Reunião Agendada" },
      empresa: { razaoSocial: "Empresa Teste", cnpj: "12345678000100" },
      dataReuniao: new Date("2026-09-28T13:00:00.000Z"), transcricaoReuniao: null,
      campoValores: [{ campoId: "radar", valor: "Revisão de Radar Ilimitado" }],
    });
    configFindMany.mockResolvedValue([
      { campoId: "radar", grupo: "Análise de Viabilidade", campo: { nome: "Radar pretendido", ativo: true } },
      { campoId: "valor", grupo: "Análise de Viabilidade", campo: { nome: "Valor acordado no contrato", ativo: true } },
      { campoId: "resumo", grupo: "Resumo da reunião", campo: { nome: "Resumo da reunião", ativo: true } },
    ]);

    const resultado = await gerarFichaViabilidadeCardBpm("card-123");
    expect(cardFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "card-123" } }));
    expect(resultado.nome).toBe("ficha-viabilidade-card-123.pdf");
    const documento = await PDFDocument.load(Buffer.from(resultado.base64, "base64"));
    expect(documento.getPageCount()).toBeGreaterThan(0);
  });

  it("recusa card de outra etapa antes de consultar campos", async () => {
    cardFindUnique.mockResolvedValue({ pipeline: { nome: "Revisão de Radar" }, etapa: { nome: "Novo Lead" } });
    configFindMany.mockClear();
    await expect(gerarFichaViabilidadeCardBpm("outro-card")).rejects.toThrow("Reunião Agendada");
    expect(configFindMany).not.toHaveBeenCalled();
  });
});
