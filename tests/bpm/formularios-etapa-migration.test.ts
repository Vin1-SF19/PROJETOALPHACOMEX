import { describe, expect, it } from "vitest";

import {
  classificarComponenteCampo,
  criarPlanoMigracaoFormularioEtapa,
  type CampoFormularioInventoryRow,
} from "@/lib/bpm/formularios-etapa-migration";

function row(
  patch: Partial<CampoFormularioInventoryRow> = {},
): CampoFormularioInventoryRow {
  return {
    formId: "form:stage-1",
    formVersion: 1,
    formActive: true,
    pipelineId: "pipeline-1",
    pipelineName: "Comercial",
    stageId: "stage-1",
    stageName: "Novos leads",
    sectionId: "section:stage-1:fields",
    sectionKey: "fields",
    sectionOrder: 0,
    componentId: "component:stage-1:field:field-1",
    componentKey: "field:field-1",
    componentOrder: 0,
    fieldId: "field-1",
    fieldName: "CNPJ",
    fieldActive: true,
    fieldScope: "CARD",
    fieldPipelineId: "pipeline-1",
    fieldVisible: true,
    fieldEditable: true,
    fieldReadOnly: false,
    fieldOrder: 0,
    stageConfigId: "config-1",
    stageConfigVisible: true,
    validPipelineShare: false,
    otherStageConfigCount: 0,
    legacyStageMatch: false,
    legacyRequiredMatch: false,
    legacyHiddenMatch: false,
    cardValueCount: 0,
    canonicalReplacementFieldId: null,
    canonicalReplacementName: null,
    canonicalReplacementConfigVisible: null,
    duplicateRank: 1,
    duplicateCount: 1,
    ...patch,
  };
}

describe("migração dos formulários por etapa", () => {
  it("mantém campo válido com configuração canônica visível", () => {
    expect(classificarComponenteCampo(row())).toMatchObject({
      valid: true,
      category: null,
      action: "KEEP",
    });
  });

  it("não infere configuração para outra etapa e remove cópia automática", () => {
    const result = classificarComponenteCampo(
      row({ stageConfigId: null, stageConfigVisible: null, otherStageConfigCount: 2 }),
    );
    expect(result).toMatchObject({ valid: false, category: "B", action: "REMOVE" });
  });

  it("mantém campo global compartilhado somente quando configurado na etapa", () => {
    expect(
      classificarComponenteCampo(
        row({ fieldScope: "GLOBAL", fieldPipelineId: "pipeline-2", validPipelineShare: true }),
      ),
    ).toMatchObject({ valid: true, action: "KEEP" });

    expect(
      classificarComponenteCampo(
        row({
          fieldScope: "GLOBAL",
          fieldPipelineId: "pipeline-2",
          validPipelineShare: true,
          stageConfigId: null,
          stageConfigVisible: null,
          otherStageConfigCount: 1,
        }),
      ),
    ).toMatchObject({ valid: false, category: "B", action: "REMOVE" });
  });

  it("faz a configuração canônica invisível prevalecer", () => {
    expect(classificarComponenteCampo(row({ stageConfigVisible: false }))).toMatchObject({
      category: "H",
      action: "REMOVE",
    });
  });

  it("remapeia legado só com vínculo explícito, alvo válido e sem valor histórico", () => {
    expect(
      classificarComponenteCampo(
        row({
          stageConfigId: null,
          stageConfigVisible: null,
          canonicalReplacementFieldId: "field-2",
          canonicalReplacementName: "CNPJ canônico",
          canonicalReplacementConfigVisible: true,
        }),
      ),
    ).toMatchObject({ category: "D", action: "REMAP" });

    expect(
      classificarComponenteCampo(
        row({
          formId: "custom-form",
          componentId: "custom-component",
          sectionId: "custom-section",
          stageConfigId: null,
          stageConfigVisible: null,
          canonicalReplacementFieldId: "field-2",
          canonicalReplacementConfigVisible: true,
          cardValueCount: 1,
        }),
      ),
    ).toMatchObject({ category: "I", action: "REVIEW_REQUIRED" });
  });

  it("detecta duplicata e preserva caso ambíguo para revisão", () => {
    expect(classificarComponenteCampo(row({ duplicateRank: 2, duplicateCount: 2 }))).toMatchObject({
      category: "G",
      action: "REMOVE",
    });
    expect(
      classificarComponenteCampo(
        row({
          formId: "custom-form",
          sectionId: "custom-section",
          componentId: "custom-component",
          stageConfigId: null,
          stageConfigVisible: null,
        }),
      ),
    ).toMatchObject({ category: "I", action: "REVIEW_REQUIRED" });
  });

  it("gera plano determinístico e não transforma casos de revisão", () => {
    const now = new Date("2026-09-09T12:00:00.000Z");
    const inventory = [
      row(),
      row({
        componentId: "component:stage-1:field:field-2",
        componentKey: "field:field-2",
        fieldId: "field-2",
        fieldName: "Telefone",
        stageConfigId: null,
        stageConfigVisible: null,
        otherStageConfigCount: 1,
      }),
    ];
    const first = criarPlanoMigracaoFormularioEtapa(inventory, "history", now);
    const second = criarPlanoMigracaoFormularioEtapa(inventory, "history", now);

    expect(first.planHash).toBe(second.planHash);
    expect(first.totals).toMatchObject({
      fieldComponents: 2,
      valid: 1,
      incompatible: 1,
      remove: 1,
      reviewRequired: 0,
    });
    expect(inventory).toHaveLength(2);
  });
});
