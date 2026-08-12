import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { carregarCamposAplicaveisCardEtapa } from "@/lib/bpm/requisitos-etapa-server";

describe("campos aplicáveis por etapa", () => {
  it("retorna somente campos diretos e globais explicitamente associados", async () => {
    const client = {
      bpmCampo: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "campo-direto",
            pipelineId: "pipeline-1",
            etapaId: "etapa-2",
            nome: "Campo da etapa",
            tipo: "texto",
            opcoesJson: null,
            obrigatorio: false,
            ordem: 2,
          },
        ]),
      },
      bpmCampoObrigatorioEtapa: {
        findMany: vi.fn().mockResolvedValue([
          {
            campo: {
              id: "campo-global-associado",
              pipelineId: "pipeline-1",
              etapaId: null,
              nome: "Campo global associado",
              tipo: "numero",
              opcoesJson: null,
              obrigatorio: false,
              ordem: 1,
            },
          },
        ]),
      },
      bpmCardCampoValor: {
        findMany: vi.fn().mockResolvedValue([
          { campoId: "campo-direto", valor: "valor existente" },
        ]),
      },
    };

    const campos = await carregarCamposAplicaveisCardEtapa(
      "card-1",
      "pipeline-1",
      "etapa-2",
      client as never,
    );

    expect(client.bpmCampo.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { pipelineId: "pipeline-1", etapaId: "etapa-2" },
    }));
    expect(campos.map((campo) => campo.id)).toEqual([
      "campo-global-associado",
      "campo-direto",
    ]);
    expect(campos[0]).toMatchObject({ obrigatorio: true, valor: null });
    expect(campos[1]).toMatchObject({
      obrigatorio: false,
      valor: "valor existente",
    });
  });

  it("deduplica campo direto também associado e preserva obrigatoriedade efetiva", async () => {
    const campo = {
      id: "campo-reutilizado",
      pipelineId: "pipeline-1",
      etapaId: "etapa-2",
      nome: "Campo reutilizado",
      tipo: "texto",
      opcoesJson: null,
      obrigatorio: false,
      ordem: 1,
    };
    const client = {
      bpmCampo: { findMany: vi.fn().mockResolvedValue([campo]) },
      bpmCampoObrigatorioEtapa: {
        findMany: vi.fn().mockResolvedValue([{ campo }]),
      },
      bpmCardCampoValor: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const campos = await carregarCamposAplicaveisCardEtapa(
      "card-1",
      "pipeline-1",
      "etapa-2",
      client as never,
    );
    expect(campos).toHaveLength(1);
    expect(campos[0].obrigatorio).toBe(true);
  });
});
