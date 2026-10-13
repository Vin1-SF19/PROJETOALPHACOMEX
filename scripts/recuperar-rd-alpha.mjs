import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { carregarEtapasRd, completarEtapasHistoricasRd } from "../src/lib/bpm/rd-station-stages.ts";
import { resolverServicoRd } from "../src/lib/bpm/rd-station-service.ts";
import { repararNomeEtapaRd, camposProtegidosHistoricoRd } from "../src/lib/bpm/rd-station-recovery.ts";
import { verificarBackupTurso } from "./lib/verificar-backup-turso.mjs";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true, override: false });
const mode = process.argv[2] ?? "preview";
const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const sha = (value) => createHash("sha256").update(value).digest("hex");
const provider = "RD_STATION_CRM_V1";
const url = process.env.TURSO_DATABASE_URL;
if (!url || !["preview", "apply", "rollback", "verify"].includes(mode)) throw new Error("Use preview, apply, rollback ou verify com o Turso configurado.");
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const directory = path.resolve("database-backups/pre-change/rd-recovery");
const planPath = path.resolve(option("plan") ?? path.join(directory, "plan.json"));
const query = async (sql, args = [], client = db) => (await client.execute({ sql, args })).rows;

async function rd(endpoint, params = {}) {
  if (!process.env.RD_STATION_CRM_V1_TOKEN) throw new Error("Token RD ausente.");
  for (let attempt = 0; attempt < 4; attempt++) {
    const target = new URL(`https://crm.rdstation.com/api/v1/${endpoint}`);
    target.search = new URLSearchParams({ ...params, token: process.env.RD_STATION_CRM_V1_TOKEN }).toString();
    let response;
    try { response = await fetch(target, { signal: AbortSignal.timeout(30000) }); }
    catch { if (attempt === 3) throw new Error("RD indisponível; nenhuma escrita realizada."); }
    if (response?.ok) return response.json();
    if (response && response.status !== 429 && response.status < 500) throw new Error(`RD_HTTP_${response.status}`);
    if (attempt === 3) throw new Error("RD indisponível após tentativas limitadas.");
    await new Promise((resolve) => setTimeout(resolve, Math.min(30000, (Number(response?.headers.get("retry-after")) || attempt + 1) * 1000)));
  }
}

async function preview() {
  const origins = await query(`SELECT o.id origemId,o.sourceDealId,o.sourcePipelineId,o.rawJson,c.id cardId,c.empresaId,c.servico,c.pipelineId,c.etapaId,cl.cnpj FROM BpmCardOrigemExterna o JOIN BpmCard c ON c.id=o.cardId JOIN Cliente cl ON cl.id=c.empresaId WHERE o.provider=? ORDER BY o.id`, [provider]);
  const events = await query(`SELECT e.* FROM BpmEventoExternoCard e JOIN BpmCardOrigemExterna o ON o.id=e.origemId WHERE o.provider=? ORDER BY e.id`, [provider]);
  const corrections = await query(`SELECT c.id,c.autorId,c.eventoId,c.versao,c.camposAlteradosJson FROM BpmEventoExternoCorrecao c JOIN BpmEventoExternoCard e ON e.id=c.eventoId JOIN BpmCardOrigemExterna o ON o.id=e.origemId WHERE o.provider=?`, [provider]);
  const clientServices = await query("SELECT id,clienteId,servico FROM ClienteServico");
  const contexts = await query("SELECT cardId FROM BpmCardServicoContexto");
  const names = await carregarEtapasRd(origins.map((o) => o.sourcePipelineId), rd);
  const unavailable = await completarEtapasHistoricasRd(names, events.filter((e) => e.eventType === "DEAL_STAGE_HISTORY").map((e) => JSON.parse(e.rawJson).deal_stage_id), rd);
  const eventChanges = [];
  const missingStages = [];
  for (const event of events.filter((e) => e.eventType === "DEAL_STAGE_HISTORY")) {
    const raw = JSON.parse(event.rawJson);
    const stageName = names.get(raw.deal_stage_id);
    if (!stageName) { missingStages.push({ id: event.id, stageId: raw.deal_stage_id }); continue; }
    const previous = JSON.parse(event.projectedJson);
    const edited = corrections.filter((c) => c.eventoId === event.id);
    const fields = camposProtegidosHistoricoRd(edited);
    const next = repararNomeEtapaRd(previous, stageName, fields);
    if (JSON.stringify(previous) === JSON.stringify(next)) continue;
    eventChanges.push({ id: event.id, origemId: event.origemId, rawHash: sha(event.rawJson), before: event.projectedJson, after: JSON.stringify(next), version: Math.max(0, ...edited.map((c) => Number(c.versao))) + 1 });
  }
  const serviceChanges = [], exceptions = [], groups = new Map();
  for (const origin of origins) {
    const resolved = resolverServicoRd(JSON.parse(origin.rawJson));
    const key = origin.cnpj ? origin.cnpj.replace(/\D/g, "") : `sem-cnpj:${origin.empresaId}`;
    const group = groups.get(key) ?? [];
    group.push({ cardId: origin.cardId, service: origin.servico ?? resolved.servico, evidence: resolved.evidencias, reason: resolved.motivo });
    groups.set(key, group);
    if (origin.servico) continue; // Não sobrescrever escolhas feitas no Alpha.
    if (!resolved.servico) { exceptions.push({ cardId: origin.cardId, reason: resolved.motivo, candidates: resolved.candidatos }); continue; }
    if (contexts.some((c) => c.cardId === origin.cardId)) { exceptions.push({ cardId: origin.cardId, reason: "contexto_alpha_existente" }); continue; }
    const matches = clientServices.filter((s) => s.clienteId === origin.empresaId && s.servico === resolved.servico);
    serviceChanges.push({ cardId: origin.cardId, origemId: origin.origemId, empresaId: origin.empresaId, pipelineId: origin.pipelineId, etapaId: origin.etapaId, rawHash: sha(origin.rawJson), before: null, after: resolved.servico, clienteServicoId: matches.length === 1 ? matches[0].id : null, evidence: resolved.evidencias });
  }
  const duplicateGroups = [...groups.values()].filter((g) => g.length > 1);
  const summary = {
    cards: origins.length, events: events.length, stageNamesToRepair: eventChanges.length,
    unavailableStageEvents: missingStages.length, unavailableStages: unavailable.size,
    servicesToAssign: serviceChanges.length, servicesMatchedToAlpha: serviceChanges.filter((s) => s.clienteServicoId !== null).length,
    serviceExceptions: exceptions.length, duplicateGroups: duplicateGroups.length,
    duplicateCards: duplicateGroups.reduce((n, g) => n + g.length, 0),
    groupsWithDifferentServices: duplicateGroups.filter((g) => new Set(g.map((c) => c.service).filter(Boolean)).size > 1).length,
    groupsWithUnresolvedServices: duplicateGroups.filter((g) => g.some((c) => !c.service)).length,
    newCards: 0, removedCards: 0,
  };
  const plan = { version: 1, databaseHash: sha(url), generatedAt: new Date().toISOString(), summary, eventChanges, serviceChanges, exceptions, duplicateGroups, missingStages };
  const fingerprint = sha(JSON.stringify(plan));
  await mkdir(path.dirname(planPath), { recursive: true, mode: 0o700 });
  await writeFile(planPath, JSON.stringify({ ...plan, fingerprint }, null, 2), { mode: 0o600 });
  console.info(JSON.stringify({ planPath, fingerprint, summary }));
}

// Leituras do lote dentro da mesma transação de escrita: nenhuma janela entre guarda e mutação.
async function snapshotLote(tx, changes, fingerprint) {
  const eventIds = changes.filter((c) => c.kind === "event").map((c) => c.id);
  const cards = changes.filter((c) => c.kind === "service");
  const cardIds = cards.map((c) => c.cardId);
  const auditIds = cards.flatMap((c) => {
    const id = `rdrepair_${sha(`${fingerprint}:service:${c.cardId}`).slice(0, 28)}`;
    return [id, `rdrollback_${sha(id).slice(0, 28)}`];
  });
  const selectIn = (sql, values) => ({ sql: `${sql} (${values.map(() => "?").join(",") || "NULL"})`, args: values });
  const results = await tx.batch([
    selectIn("SELECT e.*,o.provider FROM BpmEventoExternoCard e JOIN BpmCardOrigemExterna o ON o.id=e.origemId WHERE e.id IN", eventIds),
    selectIn("SELECT id,eventoId,versao FROM BpmEventoExternoCorrecao WHERE eventoId IN", eventIds),
    selectIn("SELECT c.*,o.id origemId,o.provider,o.rawJson FROM BpmCard c JOIN BpmCardOrigemExterna o ON o.cardId=c.id WHERE c.id IN", cardIds),
    selectIn("SELECT id FROM BpmCardHistorico WHERE id IN", auditIds),
    selectIn("SELECT * FROM BpmCardServicoContexto WHERE cardId IN", cardIds),
    selectIn("SELECT id,clienteId,servico FROM ClienteServico WHERE clienteId IN", [...new Set(cards.map((c) => c.empresaId))]),
  ]);
  return {
    events: new Map(results[0].rows.map((r) => [r.id, r])),
    corrections: new Set(results[1].rows.map((r) => r.id)),
    versions: new Map(eventIds.map((id) => [id, Math.max(0, ...results[1].rows.filter((r) => r.eventoId === id).map((r) => Number(r.versao)))])),
    cards: new Map(results[2].rows.map((r) => [r.id, r])),
    history: new Set(results[3].rows.map((r) => r.id)),
    contexts: new Map(results[4].rows.map((r) => [r.cardId, r])),
    services: results[5].rows,
  };
}

async function apply() {
  const rollback = mode === "rollback";
  const { fingerprint, ...plan } = JSON.parse(await readFile(planPath, "utf8"));
  if (sha(JSON.stringify(plan)) !== fingerprint || option("confirm") !== (rollback ? `rollback:${fingerprint}` : fingerprint)) throw new Error("Plano alterado ou confirmação do fingerprint ausente.");
  if (plan.databaseHash !== sha(url)) throw new Error("Plano pertence a outro banco.");
  const backup = option("backup");
  if (!backup) throw new Error("Backup pré-correção obrigatório.");
  const manifestPath = backup.replace(/\.sql$/, ".manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const age = Date.now() - Date.parse(manifest.generatedAt);
  if (manifest.databaseHash !== sha(url) || !Number.isFinite(age) || age < 0 || age > 48 * 3600000) throw new Error("Backup inválido/expirado ou de outro banco.");
  await verificarBackupTurso(backup, manifestPath);
  let repaired = 0, assigned = 0, alreadyApplied = 0;
  // Lotes pequenos reduzem viagens HTTP; estado, auditoria e escritas ficam na mesma transação.
  const changes = [...plan.eventChanges.map((c) => ({ ...c, kind: "event" })), ...plan.serviceChanges.map((c) => ({ ...c, kind: "service" }))];
  for (let offset = 0; offset < changes.length; offset += 25) {
    const chunk = changes.slice(offset, offset + 25);
    const tx = await db.transaction("write");
    try {
      const snapshot = await snapshotLote(tx, chunk, fingerprint);
      const writes = [];
      for (const change of chunk) {
        const auditId = `rdrepair_${sha(`${fingerprint}:${change.kind}:${change.id ?? change.cardId}`).slice(0, 28)}`;
        const rollbackId = `rdrollback_${sha(auditId).slice(0, 28)}`;
        if (change.kind === "event") {
          const current = snapshot.events.get(change.id);
          const audit = snapshot.corrections.has(auditId);
          const reverted = snapshot.corrections.has(rollbackId);
          if (rollback) {
            if (reverted || !audit) { alreadyApplied++; continue; }
            const version = snapshot.versions.get(change.id);
            if (!current || current.provider !== provider || current.origemId !== change.origemId || sha(current.rawJson) !== change.rawHash || current.projectedJson !== change.after || Number(version) !== change.version) throw new Error("Evento recebeu alterações posteriores; rollback bloqueado.");
            const before = JSON.parse(change.before), after = JSON.parse(change.after);
            const fields = Object.fromEntries([...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])).map((key) => [key, true]));
            writes.push({ sql: "INSERT INTO BpmEventoExternoCorrecao (id,eventoId,versao,camposAlteradosJson,projecaoAnteriorJson,projecaoNovaJson,autorId) VALUES (?,?,?,?,?,?,NULL)", args: [rollbackId, change.id, change.version + 1, JSON.stringify(fields), change.after, change.before] });
            writes.push({ sql: "UPDATE BpmEventoExternoCard SET projectedJson=?,updatedAt=CURRENT_TIMESTAMP WHERE id=?", args: [change.before, change.id] });
            repaired++; continue;
          }
          if (reverted) throw new Error("Plano já revertido; gere uma nova prévia.");
          if (audit) { alreadyApplied++; continue; }
          if (!current || current.provider !== provider || current.origemId !== change.origemId || sha(current.rawJson) !== change.rawHash || current.projectedJson !== change.before) throw new Error("Evento mudou após a prévia; refaça o plano.");
          const version = snapshot.versions.get(change.id) + 1;
          if (Number(version) !== change.version) throw new Error("Evento recebeu nova correção após a prévia.");
          const before = JSON.parse(change.before), after = JSON.parse(change.after);
          const fields = Object.fromEntries(Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])).map((key) => [key, true]));
          writes.push({ sql: "INSERT INTO BpmEventoExternoCorrecao (id,eventoId,versao,camposAlteradosJson,projecaoAnteriorJson,projecaoNovaJson,autorId) VALUES (?,?,?,?,?,?,NULL)", args: [auditId, change.id, change.version, JSON.stringify(fields), change.before, change.after] });
          writes.push({ sql: "UPDATE BpmEventoExternoCard SET projectedJson=?,updatedAt=CURRENT_TIMESTAMP WHERE id=?", args: [change.after, change.id] });
          repaired++;
        } else {
          const audit = snapshot.history.has(auditId);
          const reverted = snapshot.history.has(rollbackId);
          if (rollback) {
            if (reverted || !audit) { alreadyApplied++; continue; }
            const current = snapshot.cards.get(change.cardId);
            const context = snapshot.contexts.get(change.cardId);
            if (!current || current.provider !== provider || current.origemId !== change.origemId || sha(current.rawJson) !== change.rawHash || current.servico !== change.after || current.empresaId !== change.empresaId || !context || context.clienteServicoId !== change.clienteServicoId || context.nomeLegado !== change.after || context.contratoComercialId != null) throw new Error("Serviço/contexto recebeu alterações posteriores; rollback bloqueado.");
            writes.push({ sql: "UPDATE BpmCard SET servico=NULL,updatedAt=CURRENT_TIMESTAMP WHERE id=?", args: [change.cardId] });
            writes.push({ sql: "DELETE FROM BpmCardServicoContexto WHERE cardId=?", args: [change.cardId] });
            writes.push({ sql: "INSERT INTO BpmCardHistorico (id,cardId,acao,valorAnteriorJson,valorNovoJson,automacaoOrigem) VALUES (?,?,'CARD_ATUALIZADO',?,?,?)", args: [rollbackId, change.cardId, JSON.stringify({ servico: change.after }), JSON.stringify({ servico: null }), "RD_STATION_SERVICE_ROLLBACK"] });
            assigned++; continue;
          }
          if (reverted) throw new Error("Plano já revertido; gere uma nova prévia.");
          if (audit) { alreadyApplied++; continue; }
          const current = snapshot.cards.get(change.cardId);
          if (!current || current.provider !== provider || current.origemId !== change.origemId || sha(current.rawJson) !== change.rawHash || current.servico !== null || current.empresaId !== change.empresaId || current.pipelineId !== change.pipelineId || current.etapaId !== change.etapaId) throw new Error("Card mudou após a prévia; refaça o plano.");
          if (snapshot.contexts.has(change.cardId)) throw new Error("Contexto de serviço mudou após a prévia.");
          const currentMatches = snapshot.services.filter((s) => s.clienteId === change.empresaId && s.servico === change.after);
          if ((currentMatches.length === 1 ? currentMatches[0].id : null) !== change.clienteServicoId) throw new Error("Serviço Alpha mudou após a prévia.");
          writes.push({ sql: "UPDATE BpmCard SET servico=?,updatedAt=CURRENT_TIMESTAMP WHERE id=? AND servico IS NULL", args: [change.after, change.cardId] });
          writes.push({ sql: "INSERT INTO BpmCardServicoContexto (cardId,clienteServicoId,nomeLegado,createdAt,updatedAt) VALUES (?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)", args: [change.cardId, change.clienteServicoId, change.after] });
          writes.push({ sql: "INSERT INTO BpmCardHistorico (id,cardId,acao,valorAnteriorJson,valorNovoJson,automacaoOrigem) VALUES (?,?,'CARD_ATUALIZADO',?,?,?)", args: [auditId, change.cardId, JSON.stringify({ servico: null }), JSON.stringify({ servico: change.after, evidencias: change.evidence }), "RD_STATION_SERVICE_RECOVERY"] });
          assigned++;
        }
      }
      if (writes.length) await tx.batch(writes);
      await tx.commit();
    } catch (error) { try { await tx.rollback(); } catch { /* conexão perdida: o mesmo plano é retomável */ } throw error; }
    finally { tx.close(); }
    if ((offset + chunk.length) % 100 === 0) console.info(JSON.stringify({ repaired, assigned, alreadyApplied }));
  }
  console.info(JSON.stringify({ fingerprint, repaired, assigned, alreadyApplied, status: rollback ? "REVERTIDO" : "CONCLUIDO" }));
}

async function verify() {
  const { fingerprint, ...plan } = JSON.parse(await readFile(planPath, "utf8"));
  if (sha(JSON.stringify(plan)) !== fingerprint || plan.databaseHash !== sha(url)) throw new Error("Plano inválido para este banco.");
  const events = new Map((await query("SELECT e.* FROM BpmEventoExternoCard e JOIN BpmCardOrigemExterna o ON o.id=e.origemId WHERE o.provider=?", [provider])).map((e) => [e.id, e]));
  const cards = new Map((await query("SELECT c.*,o.rawJson FROM BpmCard c JOIN BpmCardOrigemExterna o ON o.cardId=c.id WHERE o.provider=?", [provider])).map((c) => [c.id, c]));
  const corrections = new Set((await query("SELECT id FROM BpmEventoExternoCorrecao WHERE id LIKE 'rdrepair_%'")).map((c) => c.id));
  const history = new Set((await query("SELECT id FROM BpmCardHistorico WHERE automacaoOrigem='RD_STATION_SERVICE_RECOVERY'")).map((h) => h.id));
  const contexts = new Map((await query("SELECT * FROM BpmCardServicoContexto")).map((c) => [c.cardId, c]));
  const report = { cards: cards.size, events: events.size, eventsApplied: 0, eventsMatchingPlan: 0, servicesApplied: 0, servicesMatchingPlan: 0, contextsMatchingPlan: 0, exceptionsStillUnassigned: 0, unavailableEventsPresent: 0, changedOriginals: 0, missingRecords: 0 };
  for (const change of plan.eventChanges) {
    const current = events.get(change.id);
    if (!current) { report.missingRecords++; continue; }
    if (sha(current.rawJson) !== change.rawHash) report.changedOriginals++;
    if (current.projectedJson === change.after) report.eventsMatchingPlan++;
    if (corrections.has(`rdrepair_${sha(`${fingerprint}:event:${change.id}`).slice(0, 28)}`)) report.eventsApplied++;
  }
  for (const change of plan.serviceChanges) {
    const current = cards.get(change.cardId);
    if (!current) { report.missingRecords++; continue; }
    if (sha(current.rawJson) !== change.rawHash) report.changedOriginals++;
    if (current.servico === change.after) report.servicesMatchingPlan++;
    const context = contexts.get(change.cardId);
    if (context?.nomeLegado === change.after && context.clienteServicoId === change.clienteServicoId) report.contextsMatchingPlan++;
    if (history.has(`rdrepair_${sha(`${fingerprint}:service:${change.cardId}`).slice(0, 28)}`)) report.servicesApplied++;
  }
  for (const exception of plan.exceptions ?? []) if (cards.get(exception.cardId)?.servico === null) report.exceptionsStillUnassigned++;
  for (const missing of plan.missingStages ?? []) {
    const event = events.get(missing.id);
    if (event && JSON.parse(event.rawJson).deal_stage_id === missing.stageId) report.unavailableEventsPresent++;
  }
  console.info(JSON.stringify({ fingerprint, report, note: "Aplicado e coincidência atual são medidas distintas; alterações posteriores são preservadas." }));
}

try { await (mode === "preview" ? preview() : mode === "verify" ? verify() : apply()); }
finally { db.close(); }
