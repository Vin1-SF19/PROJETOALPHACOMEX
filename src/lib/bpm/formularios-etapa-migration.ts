import { createHash, randomUUID } from "node:crypto";

export const FORMULARIO_MIGRATION_CATEGORIES = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
] as const;

export type FormularioMigrationCategory =
  (typeof FORMULARIO_MIGRATION_CATEGORIES)[number];

export type FormularioMigrationAction =
  | "KEEP"
  | "REMOVE"
  | "CREATE_STAGE_CONFIG"
  | "REMAP"
  | "REVIEW_REQUIRED";

export type CampoFormularioInventoryRow = {
  formId: string;
  formVersion: number;
  formActive: boolean;
  pipelineId: string;
  pipelineName: string;
  stageId: string;
  stageName: string;
  sectionId: string;
  sectionKey: string;
  sectionOrder: number;
  componentId: string;
  componentKey: string;
  componentOrder: number;
  fieldId: string | null;
  fieldName: string | null;
  fieldActive: boolean | null;
  fieldScope: string | null;
  fieldPipelineId: string | null;
  fieldVisible: boolean | null;
  fieldEditable: boolean | null;
  fieldReadOnly: boolean | null;
  fieldOrder: number | null;
  stageConfigId: string | null;
  stageConfigVisible: boolean | null;
  validPipelineShare: boolean;
  otherStageConfigCount: number;
  legacyStageMatch: boolean;
  legacyRequiredMatch: boolean;
  legacyHiddenMatch: boolean;
  cardValueCount: number;
  canonicalReplacementFieldId: string | null;
  canonicalReplacementName: string | null;
  canonicalReplacementConfigVisible: boolean | null;
  duplicateRank: number;
  duplicateCount: number;
};

export type ClassifiedCampoFormulario = CampoFormularioInventoryRow & {
  valid: boolean;
  category: FormularioMigrationCategory | null;
  action: FormularioMigrationAction;
  reason: string;
};

export type FormularioMigrationPlan = {
  version: 1;
  correlationId: string;
  generatedAt: string;
  stateFingerprint: string;
  historicalFingerprint: string;
  planHash: string;
  totals: {
    fieldComponents: number;
    valid: number;
    incompatible: number;
    affectedForms: number;
    remove: number;
    remap: number;
    createStageConfig: number;
    reviewRequired: number;
  };
  byCategory: Record<FormularioMigrationCategory, number>;
  items: ClassifiedCampoFormulario[];
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256Stable(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

function criadoPelaMigrationOntologica(
  item: CampoFormularioInventoryRow,
): boolean {
  if (!item.fieldId) return false;
  return (
    item.formVersion === 1 &&
    item.formId === `form:${item.stageId}` &&
    item.sectionId === `section:${item.stageId}:fields` &&
    item.componentId === `component:${item.stageId}:field:${item.fieldId}` &&
    item.componentKey === `field:${item.fieldId}`
  );
}

export function classificarComponenteCampo(
  item: CampoFormularioInventoryRow,
): ClassifiedCampoFormulario {
  if (item.duplicateRank > 1) {
    return {
      ...item,
      valid: false,
      category: "G",
      action: "REMOVE",
      reason: "Referência duplicada ao mesmo campo no formulário.",
    };
  }

  if (!item.fieldId || !item.fieldName) {
    return {
      ...item,
      valid: false,
      category: "F",
      action: "REMOVE",
      reason: "Referência de campo órfã ou inexistente.",
    };
  }

  if (!item.fieldActive) {
    return {
      ...item,
      valid: false,
      category: "E",
      action: "REMOVE",
      reason:
        item.cardValueCount > 0
          ? "Campo inativo retirado apenas da apresentação; valores históricos permanecem preservados."
          : "Campo inativo sem uso operacional atual.",
    };
  }

  const catalogoValido =
    item.fieldPipelineId === item.pipelineId || item.validPipelineShare;
  if (!catalogoValido) {
    return {
      ...item,
      valid: false,
      category: "I",
      action: "REVIEW_REQUIRED",
      reason:
        "Campo fora do catálogo do pipeline sem compartilhamento canônico comprovado.",
    };
  }

  if (item.stageConfigId && item.stageConfigVisible) {
    return {
      ...item,
      valid: true,
      category: null,
      action: "KEEP",
      reason: "Campo ativo, compartilhamento válido e configuração canônica visível.",
    };
  }

  if (item.stageConfigId && !item.stageConfigVisible) {
    return {
      ...item,
      valid: false,
      category: "H",
      action: "REMOVE",
      reason:
        "O componente contradiz BpmCampoEtapaConfig.visivel=false; a configuração canônica prevalece.",
    };
  }

  if (
    item.canonicalReplacementFieldId &&
    item.canonicalReplacementConfigVisible &&
    item.cardValueCount === 0
  ) {
    return {
      ...item,
      valid: false,
      category: "D",
      action: "REMAP",
      reason:
        "Mapeamento canônico explícito, alvo visível na etapa e nenhuma informação histórica no campo substituído.",
    };
  }

  const evidenciaLegadaDaEtapa =
    item.legacyStageMatch ||
    item.legacyRequiredMatch ||
    item.legacyHiddenMatch;
  if (evidenciaLegadaDaEtapa) {
    const compartilhado = item.fieldPipelineId !== item.pipelineId;
    return {
      ...item,
      valid: false,
      category: compartilhado ? "C" : "A",
      action: "CREATE_STAGE_CONFIG",
      reason: compartilhado
        ? "Compartilhamento canônico e evidência legada específica da etapa comprovam aplicabilidade incompleta."
        : "Evidência legada específica da etapa comprova configuração campo-etapa ausente.",
    };
  }

  if (
    item.otherStageConfigCount > 0 &&
    criadoPelaMigrationOntologica(item)
  ) {
    return {
      ...item,
      valid: false,
      category: "B",
      action: "REMOVE",
      reason:
        "Componente gerado automaticamente para todo o pipeline, enquanto o campo está configurado somente em outra etapa.",
    };
  }

  return {
    ...item,
    valid: false,
    category: "I",
    action: "REVIEW_REQUIRED",
    reason:
      "Não há evidência suficiente para criar configuração, remapear ou remover automaticamente.",
  };
}

function semMetadadosVolateis(
  plan: Omit<FormularioMigrationPlan, "planHash">,
) {
  return {
    version: plan.version,
    stateFingerprint: plan.stateFingerprint,
    historicalFingerprint: plan.historicalFingerprint,
    totals: plan.totals,
    byCategory: plan.byCategory,
    items: plan.items,
  };
}

export function criarPlanoMigracaoFormularioEtapa(
  inventory: readonly CampoFormularioInventoryRow[],
  historicalFingerprint: string,
  now = new Date(),
): FormularioMigrationPlan {
  const items = inventory
    .map(classificarComponenteCampo)
    .sort((left, right) => left.componentId.localeCompare(right.componentId));
  const incompatibles = items.filter((item) => !item.valid);
  const byCategory = Object.fromEntries(
    FORMULARIO_MIGRATION_CATEGORIES.map((category) => [
      category,
      incompatibles.filter((item) => item.category === category).length,
    ]),
  ) as Record<FormularioMigrationCategory, number>;
  const base = {
    version: 1 as const,
    correlationId: randomUUID(),
    generatedAt: now.toISOString(),
    stateFingerprint: sha256Stable(inventory),
    historicalFingerprint,
    totals: {
      fieldComponents: items.length,
      valid: items.filter((item) => item.valid).length,
      incompatible: incompatibles.length,
      affectedForms: new Set(incompatibles.map((item) => item.formId)).size,
      remove: items.filter((item) => item.action === "REMOVE").length,
      remap: items.filter((item) => item.action === "REMAP").length,
      createStageConfig: items.filter(
        (item) => item.action === "CREATE_STAGE_CONFIG",
      ).length,
      reviewRequired: items.filter(
        (item) => item.action === "REVIEW_REQUIRED",
      ).length,
    },
    byCategory,
    items,
  };
  return { ...base, planHash: sha256Stable(semMetadadosVolateis(base)) };
}

export function planoMigracaoSemMudancas(
  plan: FormularioMigrationPlan,
): boolean {
  return (
    plan.totals.remove === 0 &&
    plan.totals.remap === 0 &&
    plan.totals.createStageConfig === 0
  );
}
