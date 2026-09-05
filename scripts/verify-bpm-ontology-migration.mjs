import { readFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const [dumpArg, migrationArg] = process.argv.slice(2);
if (!dumpArg || !migrationArg) {
  throw new Error("Uso: node scripts/verify-bpm-ontology-migration.mjs <dump.sql> <migration.sql>");
}

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "bpm-ontology-migration."));
const databasePath = path.join(temporaryDirectory, "restore.db");
const database = new DatabaseSync(databasePath);

const scalar = (sql) => Number(database.prepare(sql).get().value);

try {
  database.exec(await readFile(path.resolve(dumpArg), "utf8"));
  database.exec(await readFile(path.resolve(migrationArg), "utf8"));

  const integrity = database.prepare("PRAGMA integrity_check").get().integrity_check;
  const foreignKeyIssues = database.prepare("PRAGMA foreign_key_check").all();
  const report = {
    integrity,
    foreignKeyIssues: foreignKeyIssues.length,
    nullPipelineKeys: scalar('SELECT count(*) value FROM "BpmPipeline" WHERE "chave" IS NULL'),
    nullStageKeys: scalar('SELECT count(*) value FROM "BpmEtapa" WHERE "chave" IS NULL'),
    nullFieldKeys: scalar('SELECT count(*) value FROM "BpmCampo" WHERE "chave" IS NULL'),
    nullTransitionKeys: scalar('SELECT count(*) value FROM "BpmTransicaoEtapa" WHERE "chave" IS NULL'),
    canonicalTransitions: scalar('SELECT count(*) value FROM "BpmTransicaoEtapa"'),
    deniedTransitions: scalar('SELECT count(*) value FROM "BpmTransicaoEtapa" WHERE "permitida" = false'),
    requirements: scalar('SELECT count(*) value FROM "BpmRequisito"'),
    forms: scalar('SELECT count(*) value FROM "BpmEtapaFormulario"'),
    stages: scalar('SELECT count(*) value FROM "BpmEtapa"'),
    cards: scalar('SELECT count(*) value FROM "BpmCard"'),
    cardStates: scalar('SELECT count(*) value FROM "BpmCardEstado"'),
    legacyMeetings: scalar('SELECT count(*) value FROM "BpmCard" WHERE "dataReuniao" IS NOT NULL OR "googleEventId" IS NOT NULL OR "googleCalendarId" IS NOT NULL OR "googleMeetLink" IS NOT NULL OR "transcricaoReuniao" IS NOT NULL'),
    ownedMeetings: scalar('SELECT count(*) value FROM "BpmCardReuniao"'),
    legacyFollowUps: scalar('SELECT count(*) value FROM "BpmCard" WHERE "proximoContatoEm" IS NOT NULL OR "standbyFollowUpUltimoEm" IS NOT NULL OR "standbyFollowUpInterrompidoEm" IS NOT NULL'),
    ownedFollowUps: scalar('SELECT count(*) value FROM "BpmCardFollowUpEstado"'),
    legacyServices: scalar('SELECT count(*) value FROM "BpmCard" WHERE "servico" IS NOT NULL'),
    ownedServices: scalar('SELECT count(*) value FROM "BpmCardServicoContexto"'),
    lifecycleContradictions: scalar(`
      SELECT count(*) value FROM "BpmCard"
      WHERE ("status" = 'CONCLUIDO' AND "concluidoEm" IS NULL)
         OR ("status" = 'ATIVO' AND "concluidoEm" IS NOT NULL)
    `),
  };

  const failures = [];
  if (integrity !== "ok") failures.push("integrity");
  if (foreignKeyIssues.length > 0) failures.push("foreign keys");
  if (report.nullPipelineKeys || report.nullStageKeys || report.nullFieldKeys || report.nullTransitionKeys) failures.push("null stable keys");
  if (report.forms !== report.stages) failures.push("missing stage forms");
  if (report.cards !== report.cardStates) failures.push("missing card runtime states");
  if (report.legacyMeetings !== report.ownedMeetings) failures.push("meeting backfill mismatch");
  if (report.legacyFollowUps !== report.ownedFollowUps) failures.push("follow-up backfill mismatch");
  if (report.legacyServices !== report.ownedServices) failures.push("service backfill mismatch");
  if (report.lifecycleContradictions > 0) failures.push("lifecycle contradictions");

  console.info(JSON.stringify({ verified: failures.length === 0, failures, ...report }));
  if (failures.length > 0) process.exitCode = 1;
} finally {
  database.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
