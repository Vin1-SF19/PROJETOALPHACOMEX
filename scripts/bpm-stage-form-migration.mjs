import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@libsql/client";
import { config } from "dotenv";

import {
  criarPlanoMigracaoFormularioEtapa,
  sha256Stable,
} from "../src/lib/bpm/formularios-etapa-migration.ts";
import { BPM_CAPABILITIES } from "../src/lib/bpm/ontology.ts";

const APPLY_CONFIRMATION = "P0-2-STAGE-FORM-MIGRATION";
const ROLLBACK_CONFIRMATION = "P0-2-STAGE-FORM-ROLLBACK";
const args = process.argv.slice(2);

function option(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? null : null;
}

const envFile = option("--env-file");
if (envFile) config({ path: envFile, quiet: true });
else {
  config({ path: ".env.local", quiet: true });
  config({ path: ".env", quiet: true });
}

const rawUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "";
if (!rawUrl) throw new Error("CONFIGURACAO_BANCO_AUSENTE");

const mode = args.includes("--apply")
  ? "apply"
  : args.includes("--rollback")
    ? "rollback"
    : "dry-run";
const declaredEnvironment = option("--environment");
const actualEnvironment = /^(file:|sqlite:)/.test(rawUrl) ? "test" : "production";
const outputDirectory = path.resolve(
  option("--output-dir") ?? "database-backups/pre-change",
);

if (mode !== "dry-run") {
  if (!declaredEnvironment || declaredEnvironment !== actualEnvironment) {
    throw new Error(
      `AMBIENTE_INCOMPATIVEL: declarado=${declaredEnvironment ?? "ausente"}, detectado=${actualEnvironment}`,
    );
  }
  const expectedConfirmation =
    mode === "apply" ? APPLY_CONFIRMATION : ROLLBACK_CONFIRMATION;
  if (option("--confirm") !== expectedConfirmation) {
    throw new Error(`CONFIRMACAO_EXPLICITA_AUSENTE: use --confirm ${expectedConfirmation}`);
  }
}

const client = createClient({
  url: rawUrl.replace(/^libsql:\/\//, "https://"),
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

const INVENTORY_SQL = `
WITH campo_componentes AS (
  SELECT
    f.id formId,
    f.versao formVersion,
    f.ativo formActive,
    p.id pipelineId,
    p.nome pipelineName,
    e.id stageId,
    e.nome stageName,
    s.id sectionId,
    s.chave sectionKey,
    s.ordem sectionOrder,
    c.id componentId,
    c.chave componentKey,
    c.ordem componentOrder,
    c.campoId fieldId,
    campo.nome fieldName,
    campo.ativo fieldActive,
    campo.escopo fieldScope,
    campo.pipelineId fieldPipelineId,
    campo.visivel fieldVisible,
    campo.editavel fieldEditable,
    campo.somenteLeitura fieldReadOnly,
    campo.ordem fieldOrder,
    cfg.id stageConfigId,
    cfg.visivel stageConfigVisible,
    EXISTS(
      SELECT 1 FROM BpmCampoPipeline cp
      WHERE cp.campoId=campo.id AND cp.pipelineId=p.id
    ) validPipelineShare,
    (
      SELECT COUNT(*) FROM BpmCampoEtapaConfig otherCfg
      WHERE otherCfg.campoId=campo.id AND otherCfg.etapaId<>e.id
    ) otherStageConfigCount,
    CASE WHEN campo.etapaId=e.id THEN 1 ELSE 0 END legacyStageMatch,
    EXISTS(
      SELECT 1 FROM BpmCampoObrigatorioEtapa legacyRequired
      WHERE legacyRequired.campoId=campo.id AND legacyRequired.etapaId=e.id
    ) legacyRequiredMatch,
    EXISTS(
      SELECT 1 FROM BpmCampoOcultoEtapa legacyHidden
      WHERE legacyHidden.campoId=campo.id AND legacyHidden.etapaId=e.id
    ) legacyHiddenMatch,
    (
      SELECT COUNT(*) FROM BpmCardCampoValor cardValue
      WHERE cardValue.campoId=campo.id
    ) cardValueCount,
    replacement.id canonicalReplacementFieldId,
    replacement.nome canonicalReplacementName,
    replacementCfg.visivel canonicalReplacementConfigVisible,
    ROW_NUMBER() OVER (
      PARTITION BY f.id, c.campoId ORDER BY s.ordem, c.ordem, c.id
    ) duplicateRank,
    COUNT(*) OVER (PARTITION BY f.id, c.campoId) duplicateCount
  FROM BpmFormularioComponente c
  JOIN BpmFormularioSecao s ON s.id=c.secaoId
  JOIN BpmEtapaFormulario f ON f.id=s.formularioId
  JOIN BpmEtapa e ON e.id=f.etapaId
  JOIN BpmPipeline p ON p.id=e.pipelineId
  LEFT JOIN BpmCampo campo ON campo.id=c.campoId
  LEFT JOIN BpmCampoEtapaConfig cfg
    ON cfg.campoId=campo.id AND cfg.etapaId=e.id
  LEFT JOIN BpmCampoMapeamento mapping
    ON mapping.campoOrigemId=campo.id AND mapping.ativo=1
  LEFT JOIN BpmCampo replacement ON replacement.id=mapping.campoDestinoId
  LEFT JOIN BpmCampoEtapaConfig replacementCfg
    ON replacementCfg.campoId=replacement.id AND replacementCfg.etapaId=e.id
  WHERE c.tipo='CAMPO'
)
SELECT * FROM campo_componentes
ORDER BY pipelineName, stageName, sectionOrder, componentOrder, componentId`;

const SNAPSHOT_SQL = `
SELECT
  f.id formId, f.etapaId stageId, f.versao formVersion, f.ativo formActive,
  f.createdAt formCreatedAt, f.updatedAt formUpdatedAt,
  p.id pipelineId, p.nome pipelineName, e.nome stageName,
  s.id sectionId, s.chave sectionKey, s.titulo sectionTitle,
  s.ordem sectionOrder, s.createdAt sectionCreatedAt, s.updatedAt sectionUpdatedAt,
  c.id componentId, c.chave componentKey, c.tipo componentType,
  c.campoId fieldId, c.capability, c.configJson, c.ordem componentOrder,
  c.createdAt componentCreatedAt, c.updatedAt componentUpdatedAt,
  campo.nome fieldName, campo.ativo fieldActive, campo.escopo fieldScope,
  campo.pipelineId fieldOwnerPipelineId,
  cfg.id stageConfigId, cfg.visivel stageConfigVisible,
  cfg.editavel stageConfigEditable, cfg.somenteLeitura stageConfigReadOnly,
  cfg.obrigatorio stageConfigRequired, cfg.ordem stageConfigOrder,
  EXISTS(
    SELECT 1 FROM BpmCampoPipeline cp
    WHERE cp.campoId=campo.id AND cp.pipelineId=p.id
  ) validPipelineShare
FROM BpmEtapaFormulario f
JOIN BpmEtapa e ON e.id=f.etapaId
JOIN BpmPipeline p ON p.id=e.pipelineId
LEFT JOIN BpmFormularioSecao s ON s.formularioId=f.id
LEFT JOIN BpmFormularioComponente c ON c.secaoId=s.id
LEFT JOIN BpmCampo campo ON campo.id=c.campoId
LEFT JOIN BpmCampoEtapaConfig cfg
  ON cfg.campoId=campo.id AND cfg.etapaId=e.id
ORDER BY p.nome, e.ordem, f.id, s.ordem, s.id, c.ordem, c.id`;

const HISTORICAL_TABLES = [
  "BpmCard",
  "BpmCardCampoValor",
  "BpmCardChecklist",
  "BpmCardChecklistItem",
  "BpmCardHistorico",
  "BpmCardAnexo",
];

function number(value) {
  return Number(value ?? 0);
}

function boolean(value) {
  return number(value) === 1;
}

function normalize(value) {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof ArrayBuffer) return Buffer.from(value).toString("base64");
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalize(item)]),
    );
  }
  return value;
}

async function rows(db, sql, statementArgs = []) {
  return normalize((await db.execute({ sql, args: statementArgs })).rows);
}

async function historicalState(db) {
  const tables = {};
  for (const table of HISTORICAL_TABLES) {
    const values = await rows(db, `SELECT * FROM ${table} ORDER BY id`);
    tables[table] = {
      count: values.length,
      fingerprint: sha256Stable(values),
    };
  }
  return { tables, fingerprint: sha256Stable(tables) };
}

function mapInventory(rawRows) {
  return rawRows.map((item) => ({
    ...item,
    formVersion: number(item.formVersion),
    formActive: boolean(item.formActive),
    fieldActive: item.fieldActive === null ? null : boolean(item.fieldActive),
    fieldVisible: item.fieldVisible === null ? null : boolean(item.fieldVisible),
    fieldEditable: item.fieldEditable === null ? null : boolean(item.fieldEditable),
    fieldReadOnly: item.fieldReadOnly === null ? null : boolean(item.fieldReadOnly),
    fieldOrder: item.fieldOrder === null ? null : number(item.fieldOrder),
    stageConfigVisible:
      item.stageConfigVisible === null ? null : boolean(item.stageConfigVisible),
    validPipelineShare: boolean(item.validPipelineShare),
    otherStageConfigCount: number(item.otherStageConfigCount),
    legacyStageMatch: boolean(item.legacyStageMatch),
    legacyRequiredMatch: boolean(item.legacyRequiredMatch),
    legacyHiddenMatch: boolean(item.legacyHiddenMatch),
    cardValueCount: number(item.cardValueCount),
    canonicalReplacementConfigVisible:
      item.canonicalReplacementConfigVisible === null
        ? null
        : boolean(item.canonicalReplacementConfigVisible),
    duplicateRank: number(item.duplicateRank),
    duplicateCount: number(item.duplicateCount),
    sectionOrder: number(item.sectionOrder),
    componentOrder: number(item.componentOrder),
  }));
}

async function formStatistics(db) {
  const [summary] = await rows(
    db,
    `SELECT
      (SELECT COUNT(*) FROM BpmEtapaFormulario) forms,
      (SELECT COUNT(*) FROM BpmEtapaFormulario WHERE ativo=1) activeForms,
      (SELECT COUNT(*) FROM BpmEtapaFormulario WHERE versao=1) versionOneForms,
      (SELECT COUNT(*) FROM BpmFormularioSecao) sections,
      (SELECT COUNT(*) FROM BpmFormularioComponente) components,
      (SELECT COUNT(*) FROM BpmFormularioComponente WHERE tipo='CAMPO') fields,
      (SELECT COUNT(*) FROM BpmFormularioComponente WHERE tipo='CHECKLIST') checklists,
      (SELECT COUNT(*) FROM BpmFormularioComponente WHERE tipo='CAPABILITY') capabilities`,
  );
  return Object.fromEntries(
    Object.entries(summary).map(([key, value]) => [key, number(value)]),
  );
}

async function capabilityDiagnostics(db) {
  const entries = await rows(
    db,
    `SELECT c.id, c.tipo, c.capability, e.id stageId, e.nome stageName,
            e.capabilitiesJson
     FROM BpmFormularioComponente c
     JOIN BpmFormularioSecao s ON s.id=c.secaoId
     JOIN BpmEtapaFormulario f ON f.id=s.formularioId
     JOIN BpmEtapa e ON e.id=f.etapaId
     WHERE c.tipo IN ('CHECKLIST','CAPABILITY')
     ORDER BY c.id`,
  );
  const allowed = new Set(Object.values(BPM_CAPABILITIES));
  const invalid = entries.filter((entry) => {
    if (entry.tipo === "CHECKLIST") {
      return entry.capability !== BPM_CAPABILITIES.STAGE_CHECKLIST;
    }
    if (!entry.capability || !allowed.has(entry.capability)) return true;
    try {
      const stageCapabilities = JSON.parse(entry.capabilitiesJson ?? "[]");
      return !Array.isArray(stageCapabilities) || !stageCapabilities.includes(entry.capability);
    } catch {
      return true;
    }
  });
  return {
    total: entries.length,
    checklists: entries.filter((entry) => entry.tipo === "CHECKLIST").length,
    capabilities: entries.filter((entry) => entry.tipo === "CAPABILITY").length,
    invalid,
  };
}

async function canonicalCoverageDiagnostics(db) {
  const entries = await rows(
    db,
    `SELECT cfg.id configId, cfg.campoId fieldId, cfg.etapaId stageId,
            campo.nome fieldName, etapa.nome stageName, pipeline.nome pipelineName,
            COUNT(component.id) componentCount
     FROM BpmCampoEtapaConfig cfg
     JOIN BpmCampo campo ON campo.id=cfg.campoId
     JOIN BpmEtapa etapa ON etapa.id=cfg.etapaId
     JOIN BpmPipeline pipeline ON pipeline.id=etapa.pipelineId
     LEFT JOIN BpmEtapaFormulario form ON form.etapaId=etapa.id AND form.ativo=1
     LEFT JOIN BpmFormularioSecao section ON section.formularioId=form.id
     LEFT JOIN BpmFormularioComponente component
       ON component.secaoId=section.id AND component.tipo='CAMPO' AND component.campoId=campo.id
     WHERE cfg.visivel=1 AND campo.ativo=1
       AND (campo.pipelineId=etapa.pipelineId OR EXISTS (
         SELECT 1 FROM BpmCampoPipeline share
         WHERE share.campoId=campo.id AND share.pipelineId=etapa.pipelineId
       ))
     GROUP BY cfg.id, cfg.campoId, cfg.etapaId, campo.nome, etapa.nome, pipeline.nome
     ORDER BY pipeline.nome, etapa.nome, campo.nome, cfg.id`,
  );
  const missing = entries.filter((entry) => number(entry.componentCount) === 0);
  const duplicate = entries.filter((entry) => number(entry.componentCount) > 1);
  return {
    visibleActiveConfigurations: entries.length,
    representedExactlyOnce: entries.filter(
      (entry) => number(entry.componentCount) === 1,
    ).length,
    missing,
    duplicate,
  };
}

async function diagnose(db, now = new Date()) {
  const inventory = mapInventory(await rows(db, INVENTORY_SQL));
  const history = await historicalState(db);
  const plan = criarPlanoMigracaoFormularioEtapa(
    inventory,
    history.fingerprint,
    now,
  );
  const [statistics, capabilities, canonicalCoverage] = await Promise.all([
    formStatistics(db),
    capabilityDiagnostics(db),
    canonicalCoverageDiagnostics(db),
  ]);
  return {
    inventory,
    history,
    plan,
    statistics,
    capabilities,
    canonicalCoverage,
  };
}

function groupByStage(plan) {
  const grouped = new Map();
  for (const item of plan.items) {
    const key = item.stageId;
    const current = grouped.get(key) ?? {
      pipeline: item.pipelineName,
      stage: item.stageName,
      stageId: item.stageId,
      fields: 0,
      incompatible: 0,
      valid: 0,
      categories: {},
    };
    current.fields += 1;
    if (item.valid) current.valid += 1;
    else {
      current.incompatible += 1;
      current.categories[item.category] =
        (current.categories[item.category] ?? 0) + 1;
    }
    grouped.set(key, current);
  }
  return [...grouped.values()].sort((left, right) =>
    `${left.pipeline}/${left.stage}`.localeCompare(`${right.pipeline}/${right.stage}`),
  );
}

function timestamp() {
  return new Date().toISOString().replaceAll(":", "-").replace(".", "-");
}

async function persistArtifacts(diagnosis, suffix = timestamp()) {
  await mkdir(outputDirectory, { recursive: true });
  const snapshotRows = await rows(client, SNAPSHOT_SQL);
  const snapshot = {
    version: 1,
    generatedAt: new Date().toISOString(),
    environment: actualEnvironment,
    databaseIdentity: createHash("sha256").update(rawUrl).digest("hex"),
    statistics: diagnosis.statistics,
    historicalState: diagnosis.history,
    forms: snapshotRows,
  };
  const snapshotPath = path.join(
    outputDirectory,
    `p0-2-stage-forms-snapshot-${suffix}.json`,
  );
  const planPath = path.join(
    outputDirectory,
    `p0-2-stage-forms-plan-${suffix}.json`,
  );
  await Promise.all([
    writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8"),
    writeFile(planPath, `${JSON.stringify(diagnosis.plan, null, 2)}\n`, "utf8"),
  ]);
  return { snapshotPath, planPath };
}

function publicSummary(diagnosis, artifacts = null) {
  return {
    mode,
    environment: actualEnvironment,
    statistics: diagnosis.statistics,
    fields: diagnosis.plan.totals,
    categories: diagnosis.plan.byCategory,
    capabilities: {
      total: diagnosis.capabilities.total,
      checklists: diagnosis.capabilities.checklists,
      capabilities: diagnosis.capabilities.capabilities,
      invalid: diagnosis.capabilities.invalid,
    },
    canonicalCoverage: diagnosis.canonicalCoverage,
    historicalState: diagnosis.history,
    planHash: diagnosis.plan.planHash,
    byStage: groupByStage(diagnosis.plan),
    reviewRequired: diagnosis.plan.items
      .filter((item) => item.action === "REVIEW_REQUIRED")
      .map((item) => ({
        componentId: item.componentId,
        pipeline: item.pipelineName,
        stage: item.stageName,
        fieldId: item.fieldId,
        field: item.fieldName,
        reason: item.reason,
      })),
    artifacts,
  };
}

async function selectComponents(db, ids) {
  if (!ids.length) return [];
  const result = [];
  for (let index = 0; index < ids.length; index += 200) {
    const chunk = ids.slice(index, index + 200);
    result.push(
      ...(await rows(
        db,
        `SELECT * FROM BpmFormularioComponente WHERE id IN (${chunk.map(() => "?").join(",")}) ORDER BY id`,
        chunk,
      )),
    );
  }
  return result;
}

async function applyPlan(expectedPlanHash) {
  if (!expectedPlanHash) throw new Error("PLANO_AUSENTE: use --plan <hash>");
  const tx = await client.transaction("write");
  try {
    const diagnosis = await diagnose(tx);
    if (diagnosis.plan.planHash !== expectedPlanHash) {
      throw new Error(
        `DRIFT_DETECTADO: esperado=${expectedPlanHash}, atual=${diagnosis.plan.planHash}`,
      );
    }
    if (diagnosis.capabilities.invalid.length) {
      throw new Error(
        `REFERENCIA_ESTRUTURAL_INVALIDA:${diagnosis.capabilities.invalid.length}`,
      );
    }

    const actionable = diagnosis.plan.items.filter(
      (item) => item.action !== "KEEP" && item.action !== "REVIEW_REQUIRED",
    );
    const removeIds = actionable
      .filter((item) => item.action === "REMOVE")
      .map((item) => item.componentId);
    const removedComponents = await selectComponents(tx, removeIds);
    const affectedForms = [
      ...new Map(
        actionable.map((item) => [
          item.formId,
          { id: item.formId, version: item.formVersion },
        ]),
      ).values(),
    ];
    const formSnapshots = [];
    const now = new Date().toISOString();

    for (const form of affectedForms) {
      const [before] = await rows(
        tx,
        "SELECT id,versao,updatedAt FROM BpmEtapaFormulario WHERE id=?",
        [form.id],
      );
      if (!before || number(before.versao) !== form.version) {
        throw new Error(`CONFLITO_VERSAO_FORMULARIO:${form.id}`);
      }
      const result = await tx.execute({
        sql: "UPDATE BpmEtapaFormulario SET versao=versao+1, updatedAt=? WHERE id=? AND versao=?",
        args: [now, form.id, form.version],
      });
      if (number(result.rowsAffected) !== 1) {
        throw new Error(`CONFLITO_VERSAO_FORMULARIO:${form.id}`);
      }
      formSnapshots.push({ ...before, appliedVersion: form.version + 1 });
    }

    const createdStageConfigs = [];
    for (const item of actionable.filter(
      (candidate) => candidate.action === "CREATE_STAGE_CONFIG",
    )) {
      const id = `c${createHash("sha256")
        .update(`p02_field_stage:${item.fieldId}:${item.stageId}`)
        .digest("hex")
        .slice(0, 24)}`;
      await tx.execute({
        sql: `INSERT INTO BpmCampoEtapaConfig
          (id,campoId,etapaId,visivel,editavel,somenteLeitura,obrigatorio,
           obrigatorioEntrada,obrigatorioSaida,ordem,createdAt,updatedAt)
          VALUES (?,?,?,1,?,?,?,0,0,?,?,?)`,
        args: [
          id,
          item.fieldId,
          item.stageId,
          item.fieldReadOnly ? 0 : item.fieldEditable ? 1 : 0,
          item.fieldReadOnly ? 1 : 0,
          item.legacyRequiredMatch ? 1 : 0,
          item.fieldOrder ?? item.componentOrder,
          now,
          now,
        ],
      });
      createdStageConfigs.push(id);
    }

    const remappedComponents = [];
    for (const item of actionable.filter(
      (candidate) => candidate.action === "REMAP",
    )) {
      const [before] = await rows(
        tx,
        "SELECT * FROM BpmFormularioComponente WHERE id=?",
        [item.componentId],
      );
      if (!before || !item.canonicalReplacementFieldId) {
        throw new Error(`REMAP_INCONSISTENTE:${item.componentId}`);
      }
      const nextKey = `field:${item.canonicalReplacementFieldId}`;
      await tx.execute({
        sql: "UPDATE BpmFormularioComponente SET campoId=?, chave=?, updatedAt=? WHERE id=? AND campoId=?",
        args: [
          item.canonicalReplacementFieldId,
          nextKey,
          now,
          item.componentId,
          item.fieldId,
        ],
      });
      remappedComponents.push(before);
    }

    for (let index = 0; index < removeIds.length; index += 200) {
      const chunk = removeIds.slice(index, index + 200);
      await tx.execute({
        sql: `DELETE FROM BpmFormularioComponente WHERE id IN (${chunk.map(() => "?").join(",")})`,
        args: chunk,
      });
    }

    const rollback = {
      version: 1,
      generatedAt: new Date().toISOString(),
      environment: actualEnvironment,
      sourcePlanHash: diagnosis.plan.planHash,
      historicalFingerprint: diagnosis.history.fingerprint,
      formSnapshots,
      removedComponents,
      remappedComponents,
      createdStageConfigs,
    };
    await mkdir(outputDirectory, { recursive: true });
    const rollbackPath = path.join(
      outputDirectory,
      `p0-2-stage-forms-rollback-${timestamp()}.json`,
    );
    await writeFile(rollbackPath, `${JSON.stringify(rollback, null, 2)}\n`, "utf8");

    const foreignKeys = await rows(tx, "PRAGMA foreign_key_check");
    if (foreignKeys.length) {
      throw new Error(`FOREIGN_KEY_VIOLATION:${foreignKeys.length}`);
    }
    await tx.commit();
    return { diagnosis, rollbackPath };
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}

async function rollback(rollbackPath) {
  if (!rollbackPath) throw new Error("ROLLBACK_AUSENTE: informe --rollback <arquivo>");
  const payload = JSON.parse(await readFile(path.resolve(rollbackPath), "utf8"));
  if (payload.environment !== actualEnvironment) {
    throw new Error("ROLLBACK_AMBIENTE_INCOMPATIVEL");
  }
  const tx = await client.transaction("write");
  try {
    for (const form of payload.formSnapshots) {
      const [current] = await rows(
        tx,
        "SELECT versao FROM BpmEtapaFormulario WHERE id=?",
        [form.id],
      );
      if (number(current?.versao) !== number(form.appliedVersion)) {
        throw new Error(`ROLLBACK_DRIFT_FORMULARIO:${form.id}`);
      }
    }
    for (const component of payload.remappedComponents) {
      await tx.execute({
        sql: "UPDATE BpmFormularioComponente SET campoId=?, chave=?, updatedAt=? WHERE id=?",
        args: [component.campoId, component.chave, component.updatedAt, component.id],
      });
    }
    for (const component of payload.removedComponents) {
      await tx.execute({
        sql: `INSERT INTO BpmFormularioComponente
          (id,secaoId,chave,tipo,campoId,capability,configJson,ordem,createdAt,updatedAt)
          VALUES (?,?,?,?,?,?,?,?,?,?)`,
        args: [
          component.id,
          component.secaoId,
          component.chave,
          component.tipo,
          component.campoId,
          component.capability,
          component.configJson,
          component.ordem,
          component.createdAt,
          component.updatedAt,
        ],
      });
    }
    for (const configId of payload.createdStageConfigs) {
      await tx.execute({
        sql: "DELETE FROM BpmCampoEtapaConfig WHERE id=?",
        args: [configId],
      });
    }
    for (const form of payload.formSnapshots) {
      await tx.execute({
        sql: "UPDATE BpmEtapaFormulario SET versao=?, updatedAt=? WHERE id=? AND versao=?",
        args: [form.versao, form.updatedAt, form.id, form.appliedVersion],
      });
    }
    const history = await historicalState(tx);
    if (history.fingerprint !== payload.historicalFingerprint) {
      throw new Error("ROLLBACK_HISTORICO_DIVERGIU");
    }
    const foreignKeys = await rows(tx, "PRAGMA foreign_key_check");
    if (foreignKeys.length) throw new Error("ROLLBACK_FOREIGN_KEY_VIOLATION");
    await tx.commit();
    return { rollbackPath: path.resolve(rollbackPath), restored: true };
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}

try {
  if (mode === "dry-run") {
    const diagnosis = await diagnose(client);
    const artifacts = await persistArtifacts(diagnosis);
    console.info(JSON.stringify(publicSummary(diagnosis, artifacts), null, 2));
  } else if (mode === "apply") {
    const before = await applyPlan(option("--plan"));
    const after = await diagnose(client);
    console.info(
      JSON.stringify(
        {
          mode,
          environment: actualEnvironment,
          appliedPlanHash: before.diagnosis.plan.planHash,
          rollbackPath: before.rollbackPath,
          before: publicSummary(before.diagnosis),
          after: publicSummary(after),
          historicalStatePreserved:
            before.diagnosis.history.fingerprint === after.history.fingerprint,
        },
        null,
        2,
      ),
    );
  } else {
    console.info(
      JSON.stringify(await rollback(option("--rollback")), null, 2),
    );
  }
} finally {
  await client.close();
}
