/** Simulação OFFLINE de FKs sobre cópia restaurada do backup. Nunca conecta à produção. */
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const ids = [
  "cmthgb9xr00000akouoqf1cey", "cmtiw4i8o00000ai3b5ib7qfi", "cmtt3rnb900000agmstpk8mnm",
  "cmubkyq3200060agmc41pmoo3", "cmubmxtxh000009gmu5h8pml7", "cmud35kxa00000bgmm139fygr",
  "cmue7xwye000004jqa9dnzq5h", "cmue8390400000agmyg0p2qbu", "cmueb4uv100000agmu1z37b9d",
];
const dir = await mkdtemp(path.join(os.tmpdir(), "radar-cleanup-simulation."));
const db = new DatabaseSync(path.join(dir, "restore.db"));
try {
  const dump = await readFile("database-backups/pre-change/painelalpha_turso_pre_change_2026-09-23T21-02-51-547Z.sql", "utf8");
  db.exec(dump);
  db.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;");
  const slots = ids.map(() => "?").join(",");
  for (const table of ["BpmAutomacaoAgenda", "BpmEventoDominio", "BpmTarefa", "BpmCard"]) {
    const result = db.prepare(`DELETE FROM "${table}" WHERE "cardId" IN (${slots})`.replace('"BpmCard" WHERE "cardId"', '"BpmCard" WHERE "id"')).run(...ids);
    console.info(JSON.stringify({ table, deleted: result.changes }));
  }
  db.prepare("DELETE FROM BpmFormularioSecao WHERE formularioId = ?").run("form:cmsd9yvb90003dzgg34vyurim");
  db.prepare("UPDATE BpmCampoEtapaConfig SET obrigatorio = 0, obrigatorioEntrada = 0, obrigatorioSaida = 0 WHERE etapaId = ? AND (obrigatorio = 1 OR obrigatorioEntrada = 1 OR obrigatorioSaida = 1)").run("cmsd9yvb90003dzgg34vyurim");
  const violations = db.prepare("PRAGMA foreign_key_check").all();
  if (violations.length) throw new Error(`FK violations: ${JSON.stringify(violations)}`);
  db.exec("ROLLBACK;");
  console.info("offline simulation passed; temporary copy rolled back");
} finally {
  db.close();
  await rm(dir, { recursive: true, force: true });
}
