/**
 * Operação pontual, restrita aos IDs auditados em 23/09/2026.
 * Padrão: inventário somente leitura. --execute exige autorização específica
 * e um backup completo dedicado e verificado. Não apaga evento Google externo.
 */
import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { readFile, stat } from "node:fs/promises";

config({ path: ".env.local" });

const pipelineId = "cmsd9yvb90000dzggt1gjl980";
const etapaId = "cmsd9yvb90003dzgg34vyurim";
const formularioId = "form:cmsd9yvb90003dzgg34vyurim";
const preservarId = "cmubiy7zm00010agmru1wbspt";
const excluirIds = [
  "cmthgb9xr00000akouoqf1cey", "cmtiw4i8o00000ai3b5ib7qfi", "cmtt3rnb900000agmstpk8mnm",
  "cmubkyq3200060agmc41pmoo3", "cmubmxtxh000009gmu5h8pml7", "cmud35kxa00000bgmm139fygr",
  "cmue7xwye000004jqa9dnzq5h", "cmue8390400000agmyg0p2qbu", "cmueb4uv100000agmu1z37b9d",
];
const backupBase = "database-backups/pre-change/painelalpha_turso_pre_change_2026-09-23T21-02-51-547Z";
const backupSha = "820aff68da3c535c1e378fdd387ea2742afe6bde479e648159f57e4df4f42ad4";
const execute = process.argv.includes("--execute");
const approval = process.argv.find((arg) => arg.startsWith("--approval="))?.slice("--approval=".length);
if (execute && approval !== "EXCLUIR_9_CARDS_E_LIMPAR_NOVOS_LEADS") {
  throw new Error("Execução bloqueada: falta autorização específica para estes nove cards e o formulário.");
}

const url = process.env.TURSO_DATABASE_URL ?? "";
const authToken = process.env.TURSO_AUTH_TOKEN ?? "";
if (!url || !authToken) throw new Error("Turso remoto não configurado em .env.local.");
const client = createClient({ url: url.replace(/^libsql:\/\//, "https://"), authToken });
const slots = excluirIds.map(() => "?").join(", ");
const count = (result) => Number(result.rows[0]?.total ?? 0);

async function verifyBackup() {
  const manifest = JSON.parse(await readFile(`${backupBase}.manifest.json`, "utf8"));
  const info = await stat(`${backupBase}.sql`);
  if (manifest.sha256 !== backupSha || manifest.sizeBytes !== info.size || info.size < 1_000_000 ||
      Date.now() - Date.parse(manifest.generatedAt) > 48 * 60 * 60 * 1000) {
    throw new Error("Backup dedicado ausente, divergente ou vencido. Gere e verifique um novo antes de executar.");
  }
}

async function inventory(tx) {
  const cards = await tx.execute({ sql: "SELECT id, status FROM BpmCard WHERE pipelineId = ? ORDER BY id", args: [pipelineId] });
  const idsAtuais = cards.rows.map((row) => String(row.id)).sort();
  const idsEsperados = [...excluirIds, preservarId].sort();
  if (JSON.stringify(idsAtuais) !== JSON.stringify(idsEsperados)) throw new Error("Inventário de cards mudou. Operação bloqueada.");
  const form = await tx.execute({ sql: "SELECT id, versao, ativo FROM BpmEtapaFormulario WHERE id = ? AND etapaId = ?", args: [formularioId, etapaId] });
  if (form.rows.length !== 1 || Number(form.rows[0].versao) !== 31) throw new Error("Versão do formulário mudou. Operação bloqueada.");
  const sections = count(await tx.execute({ sql: "SELECT COUNT(*) AS total FROM BpmFormularioSecao WHERE formularioId = ?", args: [formularioId] }));
  const components = count(await tx.execute({ sql: "SELECT COUNT(*) AS total FROM BpmFormularioComponente c JOIN BpmFormularioSecao s ON s.id = c.secaoId WHERE s.formularioId = ?", args: [formularioId] }));
  const required = count(await tx.execute({ sql: "SELECT COUNT(*) AS total FROM BpmCampoEtapaConfig WHERE etapaId = ? AND (obrigatorio = 1 OR obrigatorioEntrada = 1 OR obrigatorioSaida = 1)", args: [etapaId] }));
  const legacy = count(await tx.execute({ sql: "SELECT COUNT(*) AS total FROM BpmCampoObrigatorioEtapa WHERE etapaId = ?", args: [etapaId] }));
  const agenda = count(await tx.execute({ sql: `SELECT COUNT(*) AS total FROM BpmAutomacaoAgenda WHERE cardId IN (${slots})`, args: excluirIds }));
  const events = count(await tx.execute({ sql: `SELECT COUNT(*) AS total FROM BpmEventoDominio WHERE cardId IN (${slots})`, args: excluirIds }));
  const dependentExecutions = count(await tx.execute({ sql: `SELECT COUNT(*) AS total FROM BpmAutomacaoExecucao WHERE eventoId IN (SELECT id FROM BpmEventoDominio WHERE cardId IN (${slots}))`, args: excluirIds }));
  const restrictiveTemplates = count(await tx.execute({ sql: `SELECT COUNT(*) AS total FROM BpmChecklistTemplate WHERE cardId IN (${slots})`, args: excluirIds }));
  const restrictiveTransitions = count(await tx.execute({ sql: `SELECT COUNT(*) AS total FROM BpmTransicaoExecucao WHERE cardId IN (${slots})`, args: excluirIds }));
  const tasks = count(await tx.execute({ sql: `SELECT COUNT(*) AS total FROM BpmTarefa WHERE cardId IN (${slots})`, args: excluirIds }));
  const crossCardChecklistTasks = count(await tx.execute({ sql: `SELECT COUNT(*) AS total FROM BpmTarefa WHERE cardChecklistId IN (SELECT id FROM BpmCardChecklist WHERE cardId IN (${slots})) AND (cardId IS NULL OR cardId NOT IN (${slots}))`, args: [...excluirIds, ...excluirIds] }));
  const preservedValues = count(await tx.execute({ sql: "SELECT COUNT(*) AS total FROM BpmCardCampoValor WHERE cardId = ?", args: [preservarId] }));
  const result = { cards: cards.rows.map((row) => ({ id: String(row.id), status: String(row.status) })), sections, components, required, legacy, agenda, events, dependentExecutions, restrictiveTemplates, restrictiveTransitions, tasks, crossCardChecklistTasks, preservedValues };
  if (sections !== 1 || components !== 14 || required !== 21 || legacy !== 3 || agenda !== 4 || events !== 92 || dependentExecutions !== 0 || restrictiveTemplates !== 0 || restrictiveTransitions !== 0 || tasks !== 12 || crossCardChecklistTasks !== 0) {
    throw new Error(`Inventário de dependências mudou: ${JSON.stringify(result)}. Operação bloqueada.`);
  }
  return result;
}

try {
  if (execute) await verifyBackup();
  const tx = await client.transaction(execute ? "write" : "read");
  try {
    const before = await inventory(tx);
    if (!execute) {
      await tx.commit();
      console.info(JSON.stringify({ mode: "dry-run", backup: backupBase, ...before }));
    } else {
      const foreignKeys = await tx.execute("PRAGMA foreign_keys");
      if (Number(foreignKeys.rows[0]?.foreign_keys) !== 1) throw new Error("Chaves estrangeiras não estão ativas.");
      await tx.execute({ sql: `DELETE FROM BpmAutomacaoAgenda WHERE cardId IN (${slots})`, args: excluirIds });
      await tx.execute({ sql: `DELETE FROM BpmEventoDominio WHERE cardId IN (${slots})`, args: excluirIds });
      // BpmTarefa.cardChecklistId usa RESTRICT; retirar tarefas antes da cascata dos checklists.
      await tx.execute({ sql: `DELETE FROM BpmTarefa WHERE cardId IN (${slots})`, args: excluirIds });
      const removed = await tx.execute({ sql: `DELETE FROM BpmCard WHERE id IN (${slots})`, args: excluirIds });
      if (Number(removed.rowsAffected) !== 9) throw new Error("A quantidade de cards excluídos divergiu de nove.");
      await tx.execute({ sql: "DELETE FROM BpmFormularioSecao WHERE formularioId = ?", args: [formularioId] });
      await tx.execute({ sql: "UPDATE BpmCampoEtapaConfig SET obrigatorio = 0, obrigatorioEntrada = 0, obrigatorioSaida = 0 WHERE etapaId = ? AND (obrigatorio = 1 OR obrigatorioEntrada = 1 OR obrigatorioSaida = 1)", args: [etapaId] });
      await tx.execute({ sql: "UPDATE BpmEtapaFormulario SET versao = versao + 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND versao = 31", args: [formularioId] });
      await tx.execute({ sql: "UPDATE BpmPipeline SET configVersion = configVersion + 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?", args: [pipelineId] });
      const remaining = await tx.execute({ sql: "SELECT id FROM BpmCard WHERE pipelineId = ?", args: [pipelineId] });
      if (remaining.rows.length !== 1 || String(remaining.rows[0].id) !== preservarId) throw new Error("Verificação final dos cards falhou.");
      const afterValues = count(await tx.execute({ sql: "SELECT COUNT(*) AS total FROM BpmCardCampoValor WHERE cardId = ?", args: [preservarId] }));
      if (afterValues !== before.preservedValues) throw new Error("Valores do card preservado mudaram.");
      await tx.commit();
      console.info(JSON.stringify({ mode: "executed", deletedCards: excluirIds, remainingCard: preservarId, preservedValues: afterValues, formSections: 0, requiredRules: 0 }));
    }
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
} finally {
  await client.close();
}
