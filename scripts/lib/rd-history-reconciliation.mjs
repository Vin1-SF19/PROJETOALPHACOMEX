import { hash, stateHash, stableId, guard, statement as q } from "./rd-complement-recovery.mjs";

const eventColumns = ["id", "origemId", "sourceKey", "sourceEventId", "eventType", "occurredAt", "rawJson", "projectedJson"];
const correctionColumns = ["id", "eventoId", "versao", "camposAlteradosJson", "projecaoAnteriorJson", "projecaoNovaJson", "autorId"];
const correctionSql = `SELECT ${correctionColumns.join(",")} FROM BpmEventoExternoCorrecao WHERE eventoId=? ORDER BY id`;
const pick = (row, keys) => Object.fromEntries(keys.map(key => [key, row[key] ?? null]));
const idOf = row => row?.id ?? row?._id;
const validDate = value => typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
const family = type => type === "DEAL_STAGE_HISTORY" ? "stage" : type === "TASK_RD" ? "task" : type.startsWith("ACTIVITY_") ? "activity" : null;
const same = (key, a, b) => ["date", "startDate", "endDate", "dueDate", "completedAt"].includes(key) && validDate(a) && validDate(b)
  ? Date.parse(a) === Date.parse(b) : JSON.stringify(a) === JSON.stringify(b);
const automaticCorrection = c => {
  if (c.autorId != null) return false;
  let fields;
  try { fields = JSON.parse(c.camposAlteradosJson); } catch { return false; }
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return false;
  const keys = Object.keys(fields);
  const only = allowed => keys.length > 0 && keys.every(key => allowed.includes(key) && fields[key] === true);
  return /^rdrepair_[a-f0-9]{28}$/.test(c.id) && only(["title", "sourceStageName"])
    || /^rdnote_[a-f0-9]{28}$/.test(c.id) && only(["type", "authorName"])
    || /^rdhistsync_[a-f0-9]{28}$/.test(c.id) && fields.rdHistorySource === true;
};
const insertion = (table, columns, row) => q(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`, columns.map(k => row[k] ?? null));

/** V2 confirma a identidade/autoria/data; seu HTML não substitui o texto V1. */
export function verifyNotesV2({ alpha, source, crosscheck, changes }) {
  if (!crosscheck?.complete || !Array.isArray(crosscheck.rows) || !Array.isArray(crosscheck.expectedDealIds)) throw Error("V2_CROSSCHECK_INCOMPLETE");
  const expected = new Set(crosscheck.expectedDealIds), seen = new Set(), notes = new Map();
  if (expected.size !== crosscheck.expectedDealIds.length) throw Error("V2_DUPLICATE_DEAL");
  const v1 = new Map(source.activities.rows.map(n => [idOf(n), n]));
  let notesChecked = 0, differentContentRepresentation = 0;
  for (const row of crosscheck.rows) {
    if (!expected.has(row.dealId) || seen.has(row.dealId) || !Array.isArray(row.response?.data)
      || !row.response.links || row.response.links.next) throw Error("V2_CROSSCHECK_INCOMPLETE");
    seen.add(row.dealId);
    for (const note of row.response.data) {
      if (!note.id || notes.has(note.id)) throw Error("V2_DUPLICATE_NOTE");
      const original = v1.get(note.id);
      if (!original || original.deal_id !== row.dealId || original.user_id !== note.user_id
        || !validDate(original.date) || !validDate(note.registered_at)
        || Date.parse(original.date) !== Date.parse(note.registered_at)) throw Error("V1_V2_NOTE_IDENTITY_DIVERGED");
      notes.set(note.id, row.dealId);
      notesChecked++;
      if (original.text !== note.description) differentContentRepresentation++;
    }
  }
  if (seen.size !== expected.size) throw Error("V2_CROSSCHECK_INCOMPLETE");
  const dealsByCard = new Map(alpha.origins.map(o => [o.cardId, o.sourceDealId]));
  for (const change of changes.filter(c => c.source.endpoint === "activities")) {
    if (notes.get(change.source.sourceId) !== dealsByCard.get(change.cardId)) throw Error("CHANGED_NOTE_NOT_VERIFIED_V2");
  }
  return { v2DealsChecked: seen.size, v2NotesChecked: notesChecked, v2DifferentContentRepresentation: differentContentRepresentation };
}

/** Produz apenas SQL de histórico/auditoria. Nunca altera card, tarefa operacional ou RD. */
export function buildHistoryPlan({ alpha, source, details, usersV2, databaseHash, sourceHashes, generatedAt = new Date().toISOString() }) {
  if (!source.complete || source.detailCount !== alpha.origins.length || !source.activities?.complete || !source.deals?.complete) throw Error("INCOMPLETE_SOURCE");
  const userNames = new Map(), userEvidence = new Map(), userConflicts = [];
  for (const row of source.users.rows) if (idOf(row) && row.name?.trim()) {
    userNames.set(idOf(row), row.name.trim()); userEvidence.set(idOf(row), "RD_V1_EXACT_ID");
  }
  for (const row of usersV2.data ?? []) {
    if (userNames.has(row.id) && userNames.get(row.id) !== row.name?.trim()) {
      userConflicts.push(row.id); userNames.delete(row.id); userEvidence.delete(row.id); continue;
    }
    if (row.id && row.name?.trim()) {
      userEvidence.set(row.id, userNames.has(row.id) ? "RD_V1_V2_EXACT_ID" : "RD_V2_EXACT_ID");
      userNames.set(row.id, row.name.trim());
    }
  }
  // The same original IDs in both catalogues establish account/source compatibility.
  if (!(usersV2.data ?? []).some(u => source.users.rows.some(v => idOf(v) === u.id))) throw Error("V1_V2_USERS_NOT_MATCHED");
  const stages = new Map();
  for (const entry of source.stages) for (const stage of Array.isArray(entry.response) ? entry.response : entry.response.deal_stages ?? []) {
    if (idOf(stage) && stage.name) stages.set(idOf(stage), stage.name);
  }
  const origins = new Map(alpha.origins.map(o => [o.sourceDealId, o]));
  if (origins.size !== alpha.origins.length) throw Error("DUPLICATE_ORIGIN");
  const byOrigin = new Map(), corrections = new Map();
  for (const event of alpha.events) {
    const rows = byOrigin.get(event.origemId) ?? [];
    rows.push(event); byOrigin.set(event.origemId, rows);
  }
  for (const correction of alpha.corrections) {
    const rows = corrections.get(correction.eventoId) ?? [];
    rows.push(pick(correction, correctionColumns)); corrections.set(correction.eventoId, rows);
  }
  const changes = [], exceptions = userConflicts.map(id => ({ kind: "author_catalogue_conflict", sourceUserId: id })), compared = new Set(), sourceKeys = new Set();
  const summary = { alphaCards: alpha.cards.length, linkedCards: origins.size, unlinkedCards: alpha.cards.filter(c => !alpha.origins.some(o => o.cardId === c.id)).length,
    rdDeals: source.deals.rows.length, rdDealsWithoutAlpha: source.deals.rows.filter(d => !origins.has(idOf(d))).length,
    notesCompared: 0, stagesCompared: 0, tasksCompared: 0, authorNamesRecovered: 0, originalStageAuthorUnavailable: 0, missingDeals: 0, unchanged: 0, additions: 0, updates: 0, protectedFields: 0 };

  function propose(origin, kind, raw, desired, type, date) {
    const sourceId = idOf(raw);
    if (typeof sourceId !== "string" || !sourceId) { exceptions.push({ kind: "source_without_id", cardId: origin.cardId }); return; }
    const sourceKey = `${kind}:${sourceId}`, identity = `${origin.id}:${sourceKey}`;
    if (sourceKeys.has(identity)) throw Error("DUPLICATE_SOURCE_EVENT");
    sourceKeys.add(identity);
    const candidates = (byOrigin.get(origin.id) ?? []).filter(e => e.sourceKey === sourceKey || (e.sourceEventId === sourceId && family(e.eventType) === kind));
    if (candidates.length > 1) { exceptions.push({ kind: "ambiguous_event", cardId: origin.cardId, sourceKey }); return; }
    const existing = candidates[0];
    const previous = existing ? JSON.parse(existing.projectedJson) : {};
    const history = [...(corrections.get(existing?.id) ?? [])].sort((a, b) => a.id.localeCompare(b.id));
    const protectedFields = new Set(history.filter(c => !automaticCorrection(c)).flatMap(c => Object.keys(JSON.parse(c.camposAlteradosJson))));
    const next = { ...previous };
    const changedFields = {};
    for (const [key, value] of Object.entries(desired)) {
      if (protectedFields.has(key)) {
        if (!same(key, previous[key], value)) { summary.protectedFields++; exceptions.push({ kind: "local_edit_preserved", eventId: existing?.id, field: key }); }
        continue;
      }
      if (!same(key, previous[key], value)) { next[key] = value; changedFields[key] = true; }
    }
    if (existing) compared.add(existing.id);
    if (existing && Object.keys(changedFields).length === 0) { summary.unchanged++; return; }
    if (changedFields.authorName && desired.authorName) summary.authorNamesRecovered++;
    const endpoint = kind === "stage" ? `deals/${origin.sourceDealId}` : kind === "task" ? "tasks" : "activities";
    next.rdHistorySource = { version: 1, api: "RD_STATION_CRM_V1", endpoint, sourceId, sourceHash: hash(raw), verifiedAt: generatedAt,
      ...(kind === "activity" && desired.authorName ? { authorId: raw.user_id, authorCatalogue: userEvidence.get(raw.user_id) } : {}) };
    changedFields.rdHistorySource = true;
    const binding = guard("SELECT id,cardId,provider,sourceDealId FROM BpmCardOrigemExterna WHERE id=?", [origin.id],
      [pick(origin, ["id", "cardId", "provider", "sourceDealId"])]);
    const eventId = existing?.id ?? stableId("rdhistnew", origin.id, sourceKey);
    const after = existing ? { ...pick(existing, eventColumns), projectedJson: JSON.stringify(next) } : {
      id: eventId, origemId: origin.id, sourceKey, sourceEventId: sourceId, eventType: type, occurredAt: date,
      rawJson: JSON.stringify(raw), projectedJson: JSON.stringify(next),
    };
    const typeFilter = kind === "activity" ? "substr(eventType,1,9)='ACTIVITY_'" : `eventType='${kind === "stage" ? "DEAL_STAGE_HISTORY" : "TASK_RD"}'`;
    // Same identity used in matching and inside the guarded transaction, including legacy keys.
    const eventSql = `SELECT ${eventColumns.join(",")} FROM BpmEventoExternoCard WHERE origemId=? AND (sourceKey=? OR (sourceEventId=? AND ${typeFilter})) ORDER BY id`;
    const params = [origin.id, sourceKey, sourceId];
    const before = [binding, guard(eventSql, params, existing ? [pick(existing, eventColumns)] : []), guard(correctionSql, [eventId], history)];
    const change = { key: `history:${eventId}`, cardId: origin.cardId, eventId, kind: existing ? "update" : "insert",
      label: existing ? "Histórico do RD reconciliado com a fonte" : "Registro do histórico RD recuperado",
      source: { endpoint, sourceId, hash: hash(raw) }, before };
    if (existing) {
      const version = Math.max(0, ...history.map(c => Number(c.versao))) + 1;
      const correctionId = stableId("rdhistsync", eventId, String(version), hash(next));
      const correction = { id: correctionId, eventoId: eventId, versao: version, camposAlteradosJson: JSON.stringify(changedFields),
        projecaoAnteriorJson: existing.projectedJson, projecaoNovaJson: after.projectedJson, autorId: null };
      const afterHistory = [...history, correction].sort((a, b) => a.id.localeCompare(b.id));
      const undoCorrection = { ...correction, id: stableId("rdhistundo", correctionId), versao: version + 1,
        projecaoAnteriorJson: after.projectedJson, projecaoNovaJson: existing.projectedJson };
      change.writes = [
        q("UPDATE BpmEventoExternoCard SET projectedJson=?,updatedAt=? WHERE id=?", [after.projectedJson, generatedAt, eventId]),
        insertion("BpmEventoExternoCorrecao", [...correctionColumns, "createdAt"], { ...correction, createdAt: generatedAt }),
      ];
      change.after = [binding, guard(eventSql, params, [after]), guard(correctionSql, [eventId], afterHistory)];
      change.undo = [
        q("UPDATE BpmEventoExternoCard SET projectedJson=?,updatedAt=? WHERE id=?", [existing.projectedJson, generatedAt, eventId]),
        insertion("BpmEventoExternoCorrecao", [...correctionColumns, "createdAt"], { ...undoCorrection, createdAt: generatedAt }),
      ];
      change.rollbackAfter = [binding, guard(eventSql, params, [pick(existing, eventColumns)]),
        guard(correctionSql, [eventId], [...afterHistory, undoCorrection].sort((a, b) => a.id.localeCompare(b.id)))];
      summary.updates++;
    } else {
      change.writes = [insertion("BpmEventoExternoCard", [...eventColumns, "createdAt", "updatedAt"], { ...after, createdAt: generatedAt, updatedAt: generatedAt })];
      change.after = [binding, guard(eventSql, params, [after]), guard(correctionSql, [eventId], [])];
      change.undo = [q("DELETE FROM BpmEventoExternoCard WHERE id=?", [eventId])];
      change.rollbackAfter = before;
      summary.additions++;
    }
    changes.push(change);
  }

  for (const raw of source.activities.rows) {
    const origin = origins.get(raw.deal_id);
    if (!origin) continue;
    summary.notesCompared++;
    const existing = (byOrigin.get(origin.id) ?? []).find(e => e.sourceEventId === idOf(raw) && family(e.eventType) === "activity");
    const author = userNames.get(raw.user_id);
    const projection = { type: "ANOTACAO" };
    // O título genérico já é apresentado pela interface; não gerar milhares de
    // correções sem mudança histórica quando a API só fornece texto/data/autor.
    const sourceTitle = raw.subject ?? raw.title;
    if (typeof sourceTitle === "string") projection.title = sourceTitle;
    else if (!existing) projection.title = "Anotação";
    const content = typeof raw.text === "string" ? raw.text : typeof raw.content === "string" ? raw.content : undefined;
    if (content !== undefined) projection.content = content;
    else {
      exceptions.push({ kind: "note_content_unavailable", cardId: origin.cardId, sourceId: idOf(raw) });
      if (!existing) continue;
    }
    const date = validDate(raw.date ?? raw.created_at);
    if (date) projection.date = date;
    else exceptions.push({ kind: "note_date_unavailable", cardId: origin.cardId, sourceId: idOf(raw) });
    if (author) projection.authorName = author;
    else exceptions.push({ kind: "note_author_unavailable", cardId: origin.cardId, sourceId: idOf(raw), sourceUserId: raw.user_id ?? null });
    propose(origin, "activity", raw, projection, "ACTIVITY_NOTE", date);
  }
  const taskIds = new Set();
  for (const raw of [...source.tasks.false.rows, ...source.tasks.true.rows]) {
    if (taskIds.has(idOf(raw))) throw Error("TASK_MOVED_DURING_COLLECTION");
    taskIds.add(idOf(raw));
    const origin = origins.get(raw.deal_id ?? idOf(raw.deal));
    if (!origin) continue;
    summary.tasksCompared++;
    const existing = (byOrigin.get(origin.id) ?? []).find(e => e.sourceEventId === idOf(raw) && family(e.eventType) === "task");
    if (typeof raw.done !== "boolean") { exceptions.push({ kind: "invalid_task_status", cardId: origin.cardId, sourceId: idOf(raw) }); continue; }
    const ownerIds = raw.user_ids ?? raw.users?.map(idOf) ?? [];
    const missingOwners = ownerIds.filter(id => !userNames.has(id));
    if (missingOwners.length) exceptions.push({ kind: "task_owner_unavailable", cardId: origin.cardId, sourceId: idOf(raw), sourceUserIds: missingOwners });
    const owners = ownerIds.map(id => userNames.get(id)).filter(Boolean).join(", ");
    const old = existing ? JSON.parse(existing.projectedJson) : {};
    const projection = { title: raw.subject || old.title || "Tarefa", status: raw.done ? "CONCLUIDA" : "PENDENTE", type: "TAREFA" };
    for (const [key, value] of Object.entries({ date: raw.created_at, dueDate: raw.date, ...(raw.done ? { completedAt: raw.done_date } : {}) })) {
      if (validDate(value)) projection[key] = value;
      else exceptions.push({ kind: "task_date_unavailable", cardId: origin.cardId, sourceId: idOf(raw), field: key });
    }
    if (!raw.done) projection.completedAt = null;
    // Owners belong to the task; they never establish who wrote a note.
    if (!missingOwners.length && (!existing || owners !== (old.responsibleNames ?? old.authorName ?? ""))) {
      projection.responsibleNames = owners; projection.authorName = null;
    }
    if (typeof raw.notes === "string") projection.content = raw.notes;
    else if (!existing) projection.content = "";
    propose(origin, "task", raw, projection, "TASK_RD", validDate(raw.created_at));
  }
  for (const origin of origins.values()) {
    const detail = details[origin.sourceDealId];
    if (!detail?.complete) throw Error("MISSING_DEAL_DETAIL");
    if (detail.notFound) { summary.missingDeals++; exceptions.push({ kind: "deal_not_found", cardId: origin.cardId, sourceDealId: origin.sourceDealId }); continue; }
    if (idOf(detail.data) !== origin.sourceDealId) throw Error("DETAIL_ID_MISMATCH");
    for (const raw of detail.data.deal_stage_histories) {
      summary.stagesCompared++;
      const projection = { sourceStageId: raw.deal_stage_id ?? raw.stage_id };
      if (validDate(raw.start_date)) { projection.date = raw.start_date; projection.startDate = raw.start_date; }
      else exceptions.push({ kind: "stage_date_unavailable", cardId: origin.cardId, sourceId: idOf(raw), field: "startDate" });
      if (raw.end_date === null || validDate(raw.end_date)) projection.endDate = raw.end_date;
      else exceptions.push({ kind: "stage_date_unavailable", cardId: origin.cardId, sourceId: idOf(raw), field: "endDate" });
      const name = stages.get(projection.sourceStageId);
      if (name) { projection.title = name; projection.sourceStageName = name; }
      else exceptions.push({ kind: "stage_name_unavailable", cardId: origin.cardId, sourceId: idOf(raw), stageId: projection.sourceStageId });
      const author = raw.user_id ? userNames.get(raw.user_id) : null;
      if (author) projection.authorName = author;
      else summary.originalStageAuthorUnavailable++;
      propose(origin, "stage", raw, projection, "DEAL_STAGE_HISTORY", validDate(raw.start_date));
    }
  }
  for (const event of alpha.events) if (!compared.has(event.id)) exceptions.push({ kind: "existing_event_not_reconciled_preserved", eventId: event.id });
  summary.affectedCards = new Set(changes.map(c => c.cardId)).size;
  summary.userNamesDifferentAcrossApis = userConflicts.length;
  return { version: 1, generatedAt, databaseHash, sourceHashes, summary, exceptions, changes };
}

/** An interrupted apply may have untouched groups whose concurrent edits must survive. */
export async function verifyHistoryRollback(db, changes, fingerprint) {
  const result = { reverted: 0, neverApplied: 0, untouchedChanged: 0, checked: 0 };
  for (let offset = 0; offset < changes.length; offset += 100) {
    const group = changes.slice(offset, offset + 100);
    const marks = await db.batch(group.map(c => q("SELECT id FROM BpmCardHistorico WHERE id IN (?,?)",
      [stableId("rdcomp", fingerprint, c.key), stableId("rdcompundo", fingerprint, c.key)])), "read");
    for (const [index, change] of group.entries()) {
      const ids = new Set(marks[index].rows.map(r => r.id));
      const reverted = ids.has(stableId("rdcompundo", fingerprint, change.key));
      if (!reverted && ids.has(stableId("rdcomp", fingerprint, change.key))) throw Error("ROLLBACK_INCOMPLETE");
      const checks = reverted ? change.rollbackAfter : change.before;
      const rows = await db.batch(checks.map(({ sql, args }) => ({ sql, args })), "read");
      const matches = checks.every((check, i) => stateHash(rows[i].rows.map(row => ({ ...row }))) === check.hash);
      if (reverted && !matches) throw Error("ROLLBACK_STATE_DIVERGED");
      if (reverted) result.reverted++;
      else { result.neverApplied++; if (!matches) result.untouchedChanged++; }
      result.checked += checks.length;
    }
  }
  return result;
}
