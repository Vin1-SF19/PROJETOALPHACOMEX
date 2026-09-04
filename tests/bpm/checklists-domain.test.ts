import { describe, expect, it } from "vitest";

import { calcularResumoChecklist, templateChecklistCompativel } from "@/lib/bpm/checklists/leitura";

const card = { id: "card-1", pipelineId: "pipe-1", etapaId: "etapa-1", servico: "Radar", tipoProcesso: "Importação" };

describe("domínio de checklists BPM", () => {
  it("considera todas as dimensões nulas como compatíveis", () => {
    expect(templateChecklistCompativel({ pipelineId: null, etapaId: null, servico: null, tipoProcesso: null, cardId: null }, card)).toBe(true);
  });

  it("exige correspondência em cada dimensão preenchida", () => {
    expect(templateChecklistCompativel({ pipelineId: "pipe-1", etapaId: "etapa-1", servico: "Radar", tipoProcesso: "Importação", cardId: "card-1" }, card)).toBe(true);
    expect(templateChecklistCompativel({ pipelineId: "pipe-2", etapaId: null, servico: null, tipoProcesso: null, cardId: null }, card)).toBe(false);
    expect(templateChecklistCompativel({ pipelineId: null, etapaId: null, servico: "Comercial", tipoProcesso: null, cardId: null }, card)).toBe(false);
  });

  it("calcula progresso, conclusão e pendências obrigatórias deterministicamente", () => {
    const resumo = calcularResumoChecklist([
      { id: "a", templateNome: "Documentos", itens: [{ status: "CONCLUIDO", obrigatorio: true }, { status: "PENDENTE", obrigatorio: true }] },
      { id: "b", templateNome: "Opcional", itens: [{ status: "PENDENTE", obrigatorio: false }] },
    ]);
    expect(resumo).toMatchObject({
      total: 3, concluidos: 1, percentual: 33, concluido: false,
      pendentesObrigatorios: 1, possuiPendenciaObrigatoria: true,
      templatesComPendencia: [{ id: "a", nome: "Documentos" }],
    });
  });

  it("não declara checklist vazio como concluído", () => {
    expect(calcularResumoChecklist([])).toMatchObject({ total: 0, percentual: 0, concluido: false, possuiPendenciaObrigatoria: false });
  });
});
