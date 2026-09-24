/** Restauração pontual de Novos leads a partir da auditoria v2. Padrão: somente leitura. */
import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

config({ path: ".env.local", quiet: true });

const pipelineId = "cmsd9yvb90000dzggt1gjl980";
const etapaId = "cmsd9yvb90003dzgg34vyurim";
const formularioId = `form:${etapaId}`;
const auditId = "cmtvq4jwk00000agmfkm6jra3";
const backupBase = "database-backups/pre-change/painelalpha_turso_pre_change_2026-09-24T12-33-39-250Z";
const backupSha = "4ef2c455f044db8bc331074c38fabf6c6fe8a9be76e2f996577bc707506e8d30";
const experimentsSha = "1d50b86fb9aa014e74169d477170ee666c7c95fadc31282aa241fd3f5ef5499e";
const execute = process.argv.includes("--execute");
const approval = process.argv.find((arg) => arg.startsWith("--approval="))?.slice("--approval=".length);
if (execute && approval !== "RESTAURAR_FORMULARIO_V2_E_ARQUIVAR_26_CAMPOS_RADAR") {
  throw new Error("Execução bloqueada: falta autorização específica para restaurar v2 e arquivar 26 campos experimentais.");
}

const url = process.env.TURSO_DATABASE_URL ?? "";
const authToken = process.env.TURSO_AUTH_TOKEN ?? "";
if (!url || !authToken) throw new Error("Turso remoto não configurado.");
const db = createClient({ url: url.replace(/^libsql:\/\//, "https://"), authToken });
const single = (result) => result.rows[0] ?? null;
const asNumber = (value) => Number(value ?? 0);

async function verifyBackup() {
  const manifest = JSON.parse(await readFile(`${backupBase}.manifest.json`, "utf8"));
  const info = await stat(`${backupBase}.sql`);
  if (manifest.sha256 !== backupSha || manifest.sizeBytes !== info.size || info.size < 1_000_000 ||
      Date.now() - Date.parse(manifest.generatedAt) > 48 * 60 * 60 * 1000) {
    throw new Error("Backup dedicado ausente, divergente ou vencido.");
  }
  const dump = await readFile(`${backupBase}.sql`);
  if (createHash("sha256").update(dump).digest("hex") !== backupSha) throw new Error("Hash do backup divergente.");
}

async function inventory(tx) {
  const form = single(await tx.execute({
    sql: "SELECT id, versao, ativo FROM BpmEtapaFormulario WHERE id = ? AND etapaId = ?",
    args: [formularioId, etapaId],
  }));
  if (!form || asNumber(form.versao) !== 34 || asNumber(form.ativo) !== 1) throw new Error("Formulário mudou; recalcule o plano.");
  const currentSections = (await tx.execute({
    sql: "SELECT id, chave, titulo FROM BpmFormularioSecao WHERE formularioId = ? ORDER BY ordem, id",
    args: [formularioId],
  })).rows;
  if (currentSections.length !== 2 || currentSections[0].titulo !== "Seção Inicial" || currentSections[1].titulo !== "Data proximo contato") {
    throw new Error("Composição atual mudou; recalcule o plano.");
  }
  const currentComponents = asNumber(single(await tx.execute({
    sql: "SELECT COUNT(*) total FROM BpmFormularioComponente c JOIN BpmFormularioSecao s ON s.id = c.secaoId WHERE s.formularioId = ?",
    args: [formularioId],
  }))?.total);
  if (currentComponents !== 3) throw new Error("Componentes atuais mudaram; recalcule o plano.");

  const audit = single(await tx.execute({
    sql: "SELECT valorAnteriorJson FROM BpmPipelineConfigAuditoria WHERE id = ? AND pipelineId = ? AND campoAlterado = 'formulario_etapa'",
    args: [auditId, pipelineId],
  }));
  if (!audit?.valorAnteriorJson) throw new Error("Snapshot auditado v2 ausente.");
  const snapshot = JSON.parse(String(audit.valorAnteriorJson));
  if (snapshot.id !== formularioId || snapshot.etapaId !== etapaId || snapshot.versao !== 2 || snapshot.secoes.length !== 2 ||
      snapshot.secoes[0].chave !== "fields" || snapshot.secoes[1].chave !== "workflow") {
    throw new Error("Snapshot auditado não corresponde à versão legada esperada.");
  }
  const fields = snapshot.secoes.flatMap((secao) => secao.componentes.filter((item) => item.tipo === "CAMPO").map((item) => item.campoId));
  if (fields.length !== 6 || new Set(fields).size !== 6 || snapshot.secoes[1].componentes.length !== 2) {
    throw new Error("Snapshot legado tem composição inesperada.");
  }
  const fieldRows = (await tx.execute({
    sql: `SELECT c.id,c.nome,c.ativo,ec.visivel FROM BpmCampo c JOIN BpmCampoEtapaConfig ec ON ec.campoId=c.id AND ec.etapaId=? WHERE c.id IN (${fields.map(() => "?").join(",")})`,
    args: [etapaId, ...fields],
  })).rows;
  if (fieldRows.length !== 6 || fieldRows.some((row) => asNumber(row.ativo) !== 1 || asNumber(row.visivel) !== 1)) {
    throw new Error("Um campo legado não está mais ativo e visível.");
  }
  const experiments = (await tx.execute({
    sql: "SELECT id,nome,ativo,createdAt FROM BpmCampo WHERE pipelineId=? AND createdAt >= '2026-09-21' ORDER BY id",
    args: [pipelineId],
  })).rows;
  if (experiments.length !== 26 || experiments.some((row) => asNumber(row.ativo) !== 1) ||
      experiments.filter((row) => /test/i.test(String(row.nome))).length !== 22) {
    throw new Error("Inventário de campos experimentais mudou; recalcule o plano.");
  }
  const currentSha = createHash("sha256").update(JSON.stringify(experiments.map(({ id, nome }) => [id, nome]))).digest("hex");
  if (currentSha !== experimentsSha) throw new Error("Identidades ou nomes dos campos experimentais mudaram.");
  const unrelatedReferences = asNumber(single(await tx.execute({
    sql: `SELECT COUNT(*) total FROM BpmFormularioComponente c JOIN BpmFormularioSecao s ON s.id=c.secaoId
          WHERE c.campoId IN (${experiments.map(() => "?").join(",")}) AND s.formularioId<>?`,
    args: [...experiments.map((row) => row.id), formularioId],
  }))?.total);
  if (unrelatedReferences !== 0) throw new Error("Campo experimental usado em outro formulário; operação bloqueada.");
  const obligations = asNumber(single(await tx.execute({
    sql: `SELECT COUNT(*) total FROM BpmCampoEtapaConfig WHERE campoId IN (${experiments.map(() => "?").join(",")})
          AND (obrigatorio=1 OR obrigatorioEntrada=1 OR obrigatorioSaida=1 OR condicaoObrigatoriedadeJson IS NOT NULL)`,
    args: experiments.map((row) => row.id),
  }))?.total);
  const requirements = asNumber(single(await tx.execute({
    sql: `SELECT COUNT(*) total FROM BpmRequisito WHERE ativo=1 AND campoId IN (${experiments.map(() => "?").join(",")})`,
    args: experiments.map((row) => row.id),
  }))?.total);
  if (obligations !== 0 || requirements !== 0) throw new Error("Campo experimental passou a ser obrigatório; operação bloqueada.");
  return { form, snapshot, currentSections, currentComponents, experiments, fields: fieldRows };
}

try {
  if (execute) await verifyBackup();
  const tx = await db.transaction(execute ? "write" : "read");
  try {
    const before = await inventory(tx);
    if (execute) {
      const fk = single(await tx.execute("PRAGMA foreign_keys"));
      if (asNumber(fk?.foreign_keys) !== 1) throw new Error("Foreign keys desativadas.");
      await tx.execute({ sql: "DELETE FROM BpmFormularioSecao WHERE formularioId = ?", args: [formularioId] });
      for (const [sectionOrder, secao] of before.snapshot.secoes.entries()) {
        await tx.execute({
          sql: "INSERT INTO BpmFormularioSecao(id,formularioId,chave,titulo,ordem,createdAt,updatedAt) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
          args: [secao.id, formularioId, secao.chave, secao.titulo, sectionOrder],
        });
        for (const [componentOrder, componente] of secao.componentes.entries()) {
          await tx.execute({
            sql: "INSERT INTO BpmFormularioComponente(id,secaoId,chave,tipo,campoId,capability,configJson,ordem,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
            args: [componente.id, secao.id, componente.chave, componente.tipo, componente.campoId, componente.capability, componente.configJson, componentOrder],
          });
        }
      }
      const archived = await tx.execute({
        sql: `UPDATE BpmCampo SET ativo=0,updatedAt=CURRENT_TIMESTAMP WHERE id IN (${before.experiments.map(() => "?").join(",")}) AND ativo=1`,
        args: before.experiments.map((row) => row.id),
      });
      if (asNumber(archived.rowsAffected) !== 26) throw new Error("Quantidade de campos arquivados divergiu.");
      const updated = await tx.execute({
        sql: "UPDATE BpmEtapaFormulario SET versao=versao+1,updatedAt=CURRENT_TIMESTAMP WHERE id=? AND versao=34",
        args: [formularioId],
      });
      if (asNumber(updated.rowsAffected) !== 1) throw new Error("Versão do formulário mudou durante a restauração.");
      await tx.execute({ sql: "UPDATE BpmPipeline SET configVersion=configVersion+1,updatedAt=CURRENT_TIMESTAMP WHERE id=?", args: [pipelineId] });
      const restoredSections = asNumber(single(await tx.execute({
        sql: "SELECT COUNT(*) total FROM BpmFormularioSecao WHERE formularioId=?", args: [formularioId],
      }))?.total);
      const restoredComponents = asNumber(single(await tx.execute({
        sql: "SELECT COUNT(*) total FROM BpmFormularioComponente WHERE secaoId IN (SELECT id FROM BpmFormularioSecao WHERE formularioId=?)",
        args: [formularioId],
      }))?.total);
      if (restoredSections !== 2 || restoredComponents !== 8) throw new Error("Composição restaurada divergiu.");
      const violations = (await tx.execute("PRAGMA foreign_key_check")).rows.length;
      if (violations !== 0) throw new Error(`Violações de FK após restauração: ${violations}`);
    }
    await tx.commit();
    console.info(JSON.stringify({
      mode: execute ? "executed" : "dry-run", pipelineId, etapaId,
      currentVersion: asNumber(before.form.versao), restoredFromVersion: before.snapshot.versao,
      currentSections: before.currentSections.map(({ titulo }) => titulo), currentComponents: before.currentComponents,
      restoredSections: before.snapshot.secoes.map(({ titulo, componentes }) => ({ titulo, componentes: componentes.length })),
      restoredFields: before.fields.map(({ nome }) => nome), archivedFields: before.experiments.map(({ id, nome }) => ({ id, nome })),
      backup: backupBase,
    }));
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
} finally {
  await db.close();
}
