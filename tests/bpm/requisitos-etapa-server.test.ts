import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  carregarCamposAplicaveisCardEtapa,
  carregarCamposObrigatoriosEtapa,
} from "@/lib/bpm/requisitos-etapa-server";

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
      where: { pipelineId: "pipeline-1", OR: [{ etapaId: "etapa-2" }, { etapaId: null }] },
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

  it("inclui campo com etapaId null (\"Todas as etapas\" no admin) mesmo sem vínculo em BpmCampoObrigatorioEtapa — RM-2026-04C4B0", async () => {
    const client = {
      bpmCampo: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "campo-global-direto",
            pipelineId: "pipeline-1",
            etapaId: null,
            nome: "CNPJ",
            tipo: "texto",
            opcoesJson: null,
            obrigatorio: false,
            ordem: 1,
          },
        ]),
      },
      bpmCampoObrigatorioEtapa: { findMany: vi.fn().mockResolvedValue([]) },
      bpmCardCampoValor: {
        findMany: vi.fn().mockResolvedValue([
          { campoId: "campo-global-direto", valor: "12.345.678/0001-90" },
        ]),
      },
    };

    const campos = await carregarCamposAplicaveisCardEtapa(
      "card-1",
      "pipeline-1",
      "etapa-qualquer",
      client as never,
    );

    expect(client.bpmCampo.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { pipelineId: "pipeline-1", OR: [{ etapaId: "etapa-qualquer" }, { etapaId: null }] },
    }));
    expect(campos).toHaveLength(1);
    expect(campos[0]).toMatchObject({
      id: "campo-global-direto",
      obrigatorio: false,
      valor: "12.345.678/0001-90",
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

  it("preserva a definição sem valor, ordena por ordem/nome e não duplica associação", async () => {
    const campoRepetido = {
      id: "campo-repetido",
      pipelineId: "pipeline-1",
      etapaId: "etapa-2",
      nome: "Zeta",
      tipo: "texto",
      opcoesJson: null,
      obrigatorio: false,
      ordem: 2,
    };
    const client = {
      bpmCampo: {
        findMany: vi.fn().mockResolvedValue([
          campoRepetido,
          {
            id: "campo-alpha",
            pipelineId: "pipeline-1",
            etapaId: "etapa-2",
            nome: "Alpha",
            tipo: "texto",
            opcoesJson: null,
            obrigatorio: false,
            ordem: 2,
          },
        ]),
      },
      bpmCampoObrigatorioEtapa: {
        findMany: vi.fn().mockResolvedValue([
          { campo: campoRepetido },
          {
            campo: {
              id: "campo-primeiro",
              pipelineId: "pipeline-1",
              etapaId: null,
              nome: "Obrigatório primeiro",
              tipo: "texto",
              opcoesJson: null,
              obrigatorio: false,
              ordem: 1,
            },
          },
        ]),
      },
      bpmCardCampoValor: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const campos = await carregarCamposAplicaveisCardEtapa(
      "card-1",
      "pipeline-1",
      "etapa-2",
      client as never,
    );

    expect(campos.map((campo) => campo.id)).toEqual([
      "campo-primeiro",
      "campo-alpha",
      "campo-repetido",
    ]);
    expect(campos).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "campo-primeiro", obrigatorio: true, valor: null }),
      expect.objectContaining({ id: "campo-repetido", obrigatorio: true, valor: null }),
      expect.objectContaining({ id: "campo-alpha", obrigatorio: false, valor: null }),
    ]));
  });

  it("campo global sem valor salvo aparece com valor null, não é omitido", async () => {
    const client = {
      bpmCampo: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "campo-global-vazio",
            pipelineId: "pipeline-1",
            etapaId: null,
            nome: "Radar pretendido",
            tipo: "texto",
            opcoesJson: null,
            obrigatorio: false,
            ordem: 1,
          },
        ]),
      },
      bpmCampoObrigatorioEtapa: { findMany: vi.fn().mockResolvedValue([]) },
      bpmCardCampoValor: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const campos = await carregarCamposAplicaveisCardEtapa(
      "card-1",
      "pipeline-1",
      "etapa-qualquer",
      client as never,
    );

    expect(campos).toHaveLength(1);
    expect(campos[0]).toMatchObject({ id: "campo-global-vazio", valor: null });
  });
});

describe("campos obrigatórios por etapa (validação de transição)", () => {
  it("RM-2026-04C4B0: inclui campo global (etapaId null) marcado como obrigatório, sem depender de BpmCampoObrigatorioEtapa", async () => {
    const client = {
      bpmCampo: {
        findMany: vi.fn().mockResolvedValue([
          { id: "campo-global-obrigatorio", nome: "CNPJ" },
        ]),
      },
      bpmCampoObrigatorioEtapa: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const campos = await carregarCamposObrigatoriosEtapa(
      "pipeline-1",
      "etapa-2",
      client as never,
    );

    expect(client.bpmCampo.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        pipelineId: "pipeline-1",
        OR: [{ etapaId: "etapa-2" }, { etapaId: null }],
        obrigatorio: true,
      },
    }));
    expect(campos).toEqual([{ id: "campo-global-obrigatorio", nome: "CNPJ" }]);
  });
});
