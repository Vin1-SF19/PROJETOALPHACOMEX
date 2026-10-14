import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { cnpjEhValido } from "../src/lib/format-cnpj.ts";
import { projetarEventosHistoricoRd } from "../src/lib/bpm/rd-station-history.ts";
import { carregarEtapasRd, completarEtapasHistoricasRd } from "../src/lib/bpm/rd-station-stages.ts";
import { resolverServicoRd } from "../src/lib/bpm/rd-station-service.ts";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true, override: false });

const PROVIDER = "RD_STATION_CRM_V1";
const CONFIRMATION = "AUTORIZO-RD-ALPHA-2026-10-13";
const PIPELINES = [
  { id: "6672fd5d2ba7e000181cdba0", name: "REVISÃO DE ESTIMATIVA DO RADAR (LEADS)", alpha: "Revisão de Radar", owner: null, map: {
    "Novos leads": "Novo Lead", "Sem qualificação": "Sem viabilidade",
    "Leads frios - Não fazer follow-up": "Lost", "Fechou com a concorrência": "Lost",
    "Aguardando retorno para reunião": "Agendar Reunião", "Stand-by - Folllow-up a 7 dias": "Stand By",
    "Em tratativa avançada": "Em tratativas", "Contratos à enviar": "Fechado",
    "Contratos enviados": "Fechado", "Pagamento recebido": "Fechado", "Contrato assinado": "Fechado",
  } },
  { id: "667ed153478ffa00212d88d7", name: "DIRETORIA OPERACIONAL - Vitor", alpha: "Operacional", owner: 10, map: {
    "Atribuição ao analista responsável": "Boas vindas", "Contratados stand-by": "Boas vindas",
    "Envio do checklist e boas vindas": "Boas vindas", "Documentação em análise - VITOR": "Documentação em análise",
    "CLIENTES CANCELADOS": "Cliente cancelado",
  } },
  { id: "6681a7ad67810b001961680c", name: "DEPTO. FINANCEIRO - Entrada", alpha: "Financeiro", owner: 8, map: {
    "Elaborar contrato": "Elaboração de Contrato", "STAND-BY": "Stand By",
    "Pagamento confirmado": "Confirmação de Pagamento", "Enviar NF - Contratação": "Emissão de Nota Fiscal",
  } },
  { id: "6681a8952a5fe30016466931", name: "DPTO. FINANCEIRO - Êxito", alpha: "Financeiro", owner: 8, map: {
    "Deferidos - EFETUAR COBRANÇA": "Emissão de Nota Fiscal", "Enviar NF - êxito": "Emissão de Nota Fiscal",
    "Pgto confirmado": "Concluido", "Clientes processos 2x1": "Processos 2x1", "Contratos cancelados": "Cancelado",
  } },
  { id: "6681bc96f250270010f9b253", name: "REVISÃO DO RADAR (OPERACIONAL PROTOCOLO)", alpha: "Operacional", owner: null, map: {
    "Processos para revisão": "Revisão", "Processos revisado para protocolo": "Revisado",
    "Revisão do protocolo feito": "Revisão do protocolo", "Aguardando despacho": "Aguardando despacho",
    "Exigência fiscal": "Exigência Fiscal", "Resposta ao fiscal": "Resposta", "Processo deferido": "Processo deferido",
  } },
  { id: "6682e64d5bdb1e00100a3dd9", name: "STAND-BY - Processos Revisão de RADAR", alpha: "Revisão de Radar", owner: null, map: {
    "Sem contato": "Stand By", "Revisão ILIMITADO": "Stand By", "Previsão para andamento": "Stand By", "Sem retorno do cliente": "Stand By",
  } },
  { id: "668302c9b9963200224cb913", name: "HABILITAÇÃO DO RADAR", alpha: "Revisão de Radar", owner: null, map: {
    "Novos leads": "Novo Lead", "Leads em tratativa": "Em tratativas", "Aguardando certificado digital": "Em tratativas",
    "Reunião realizada": "Reunião Agendada", "Negócio fechado": "Fechado", "Pagamento confirmado": "Fechado",
    "Processo protocolado": "Fechado", "Processo deferido": "Fechado", "Repescagem": "Monitoramento",
    "Contato futuro": "Monitoramento", "Desqualificados": "Lost",
  } },
  { id: "66881b2f26e5f20010518eee", name: "REVISÃO DO RADAR (OPERACIONAL) - Maria", alpha: "Operacional", owner: 15, map: {
    "Contratados stand-by": "Boas vindas", "Envio do checklist e boas vindas": "Boas vindas",
    "Documentação em análise": "Documentação em análise", "CLIENTES CANCELADOS": "Cliente cancelado",
  } },
  { id: "6879613ca7530700145929e8", name: "DEFERIDOS (PROCESSOS REVISÃO DO RADAR)", alpha: "Operacional", owner: null, map: {
    "Deferidos - RADAR": "Processo deferido", "Reunião agendada": "Processo deferido", "Em tratativa - Hot leads": "Processo deferido",
    "Repescagem": "Processo deferido", "Contato futuro": "Processo deferido", "Sem interesse": "Processo deferido",
  } },
  { id: "69fa3e31479dc00014f0cab6", name: "REVISÃO DO RADAR (OPERACIONAL) - Mariah", alpha: "Operacional", owner: 32, map: {
    "Contratos Stand-by": "Boas vindas", "Envio do checklist e boas vindas": "Boas vindas",
    "Documentação em análise": "Documentação em análise", "CLIENTES CANCELADOS": "Cliente cancelado",
  } },
];

const MIGRATION_FILE = path.resolve("prisma/migrations/20261013110000_rd_station_external_history/migration.sql");
const mode = process.argv[2] ?? "preview";
const confirmation = process.argv.find((value) => value.startsWith("--confirm="))?.split("=")[1];
if (!["preview", "apply"].includes(mode)) throw new Error("Use preview ou apply.");
if (mode === "apply" && confirmation !== CONFIRMATION) throw new Error("Confirmação específica ausente.");
const rdToken = process.env.RD_STATION_CRM_V1_TOKEN;
const dbUrl = process.env.TURSO_DATABASE_URL;
const dbToken = process.env.TURSO_AUTH_TOKEN;
if (!rdToken || !dbUrl || !dbToken) throw new Error("Configuração RD/Turso incompleta.");

const dbConfig = { url: dbUrl, authToken: dbToken };
let db = createClient(dbConfig);
let recordsSinceReconnect = 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
const sha = (value) => createHash("sha256").update(value).digest("hex");
const stableId = (prefix, ...parts) => `${prefix}_${sha(parts.join("\u001f")).slice(0, 28)}`;
const json = (value) => JSON.stringify(value ?? null);
async function executeWithRetry(statement) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt++) {
    try { return await db.execute(statement); }
    catch (error) {
      lastError = error;
      if (attempt < 4) { await sleep((attempt + 1) * 1500); await reconnectDb(); }
    }
  }
  throw lastError;
}

async function withWriteTransaction(operation) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt++) {
    let tx;
    try {
      tx = await db.transaction("write");
      const value = await operation(tx);
      await tx.commit();
      return value;
    } catch (error) {
      lastError = error;
      try { await tx?.rollback(); } catch { /* a lost socket may make rollback response unavailable */ }
      if (attempt < 4) { await sleep((attempt + 1) * 1500); await reconnectDb(); }
    } finally { tx?.close(); }
  }
  throw lastError;
}

async function reconnectDb() {
  try { await db.close(); } catch { /* close can fail after transport loss */ }
  db = createClient(dbConfig);
}

const rows = async (sql, args = []) => (await executeWithRetry({ sql, args })).rows;

async function rd(pathname, params = {}) {
  let last;
  for (let attempt = 0; attempt < 9; attempt++) {
    const url = new URL(`https://crm.rdstation.com/api/v1/${pathname}`);
    url.searchParams.set("token", rdToken);
    for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    try {
      const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30000) });
      if (response.status === 429 || response.status >= 500) {
        const retry = Number(response.headers.get("retry-after")) || Math.min(60, (attempt + 1) * 5);
        await sleep(retry * 1000); continue;
      }
      if (!response.ok && response.status < 500) throw new Error(`RD_HTTP_${response.status}`);
      if (!response.ok) throw new Error(`RD API retornou HTTP ${response.status}.`);
      return await response.json();
    } catch (error) { last = error; if (attempt === 8) break; await sleep(Math.min(60000, (attempt + 1) * 3000)); }
  }
  throw last ?? new Error("RD API indisponível após repetição segura.");
}

async function paged(pathname, initial) {
  const result = [];
  let cursor = null;
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const data = await rd(pathname, { ...initial, ...(cursor ? { next_page: cursor } : { page: page + 1 }) });
    const items = Array.isArray(data) ? data : (data.deals ?? data.activities ?? data.deal_stages ?? data.data ?? []);
    if (!Array.isArray(items)) throw new Error(`Formato inesperado da API RD em ${pathname}.`);
    result.push(...items);
    cursor = data.next_page || null;
    page++;
    hasMore = Boolean(cursor) || (!Array.isArray(data) && Boolean(data.has_more));
    if (page > 100) throw new Error("Paginação excedeu o limite de segurança.");
  }
  return result;
}

async function concurrent(items, limit, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) { const index = next++; if (index >= items.length) return; await fn(items[index], index); }
  });
  await Promise.all(workers);
}

function extractCnpj(deal) {
  const direct = [deal.name, deal.organization?.cnpj, deal.organization?.document];
  for (const item of deal.deal_custom_fields ?? []) {
    if (/cnpj|documento/i.test(`${item.custom_field?.label ?? ""} ${item.custom_field?.name ?? ""}`)) direct.push(item.value);
  }
  for (const value of direct) {
    const matches = String(value ?? "").match(/(?:\d[.\s/-]*){14,18}/g) ?? [];
    for (const match of matches) { const digits = match.replace(/\D/g, ""); if (digits.length === 14 && cnpjEhValido(digits)) return digits; }
  }
  return null;
}

async function backupGate() {
  const directory = path.resolve("database-backups/pre-change");
  const entries = await readdir(directory);
  const dumps = entries.filter((name) => name.endsWith(".sql")).sort().reverse();
  const candidate = dumps[0];
  if (!candidate) throw new Error("Backup pre-change ausente; carga bloqueada.");
  const dumpPath = path.join(directory, candidate);
  const manifestPath = dumpPath.replace(/\.sql$/, ".manifest.json");
  const modifiedAt = (await stat(dumpPath)).mtimeMs;
  if (Date.now() - modifiedAt > 48 * 60 * 60 * 1000) throw new Error("Backup pre-change venceu 48h; carga bloqueada.");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.databaseHash !== sha(dbUrl)) throw new Error("Backup não pertence ao banco Turso configurado; carga bloqueada.");
  const files = spawnSync("node", ["scripts/verify-turso-backup.mjs", dumpPath, manifestPath], { encoding: "utf8", stdio: "pipe" });
  if (files.status !== 0) throw new Error("A validação do backup Turso não passou; carga bloqueada.");
}

const summaries = new Map();
const full = [];
try {
  const stageNames = await carregarEtapasRd(PIPELINES.map((pipeline) => pipeline.id), rd);
  const stageMap = new Map([...stageNames].map(([id, name]) => [id, { id, name }]));
  const configuredPipelines = await rows("SELECT id,nome FROM BpmPipeline");
  const configuredStages = await rows("SELECT id,pipelineId,nome FROM BpmEtapa");
  const alphaPipelineByName = new Map(configuredPipelines.map((item) => [item.nome, item]));
  const alphaStageByName = new Map(configuredStages.map((item) => [`${item.pipelineId}:${item.nome}`, item]));
  const sourceDeals = [];
  for (const scope of PIPELINES) {
    const deals = await paged("deals", { deal_pipeline_id: scope.id, limit: 200 });
    const counter = { pipeline: scope.id, name: scope.name, leads: deals.length, activities: 0, histories: 0, missingActivities: 0, apiErrors: 0, unmappedStages: {}, bySourceStage: {} };
    summaries.set(scope.id, counter);
    for (const deal of deals) sourceDeals.push({ deal, scope, counter });
  }

  const detailed = new Array(sourceDeals.length);
  let collected = 0;
  await concurrent(sourceDeals, 3, async ({ deal, scope, counter }, index) => {
    const dealId = deal.id ?? deal._id;
    if (!dealId) throw new Error("Negócio RD sem identificador estável.");
    let detail, activities;
    try {
      [detail, activities] = await Promise.all([
        rd(`deals/${encodeURIComponent(dealId)}`),
        paged("activities", { deal_id: dealId, limit: 200 }),
      ]);
    } catch {
      counter.apiErrors++;
      detailed[index] = { failed: true };
      if (counter.apiErrors <= 10) console.info(`RD detail/activity consultation returned error for scoped lead ${counter.apiErrors}.`);
      collected++;
      return;
    }
    const stageId = detail.deal_stage?.id ?? detail.deal_stage?._id ?? deal.deal_stage?.id ?? deal.deal_stage?._id;
    const stageName = detail.deal_stage?.name ?? deal.deal_stage_name ?? deal.deal_stage?.nickname ?? "";
    const explicitStageName = stageName || stageMap.get(stageId)?.name || "";
    const destination = scope.map[explicitStageName];
    const alphaPipeline = alphaPipelineByName.get(scope.alpha);
    const alphaStage = destination && alphaPipeline ? alphaStageByName.get(`${alphaPipeline.id}:${destination}`) : null;
    const current = counter.bySourceStage[explicitStageName] ??= { leads: 0, destination: destination ?? null, unmapped: 0 };
    current.leads++;
    if (!destination || !alphaStage) { current.unmapped++; counter.unmappedStages[explicitStageName || "(sem etapa)"] = (counter.unmappedStages[explicitStageName || "(sem etapa)"] ?? 0) + 1; }
    const events = projetarEventosHistoricoRd(detail, activities, new Map([...stageMap].map(([id, stage]) => [id, stage.name])));
    counter.histories += (detail.deal_stage_histories ?? []).length;
    counter.activities += activities.length;
    if (!activities.length) counter.missingActivities++;
    detailed[index] = { deal, detail, scope, counter, activities, events, stageId, stageName: explicitStageName, destination, alphaPipeline, alphaStage, cnpj: extractCnpj(detail), ownerName: detail.user?.name ?? deal.user?.name ?? null, ownerId: detail.user?.id ?? detail.user?._id ?? deal.user?.id ?? null };
    collected++;
    if (collected % 100 === 0 || collected === sourceDeals.length) console.info(`RD read-only preflight: ${collected}/${sourceDeals.length} negócios detalhados.`);
  });
  full.push(...detailed.filter((item) => item && !item.failed));
  await completarEtapasHistoricasRd(stageNames, full.flatMap((item) => (item.detail.deal_stage_histories ?? []).map((h) => h.deal_stage_id)), rd);
  for (const item of full) item.events = projetarEventosHistoricoRd(item.detail, item.activities, stageNames);

  const [users, clients] = await Promise.all([
    rows("SELECT id,nome FROM usuarios"), rows("SELECT id,cnpj,razaoSocial,nomeFantasia FROM Cliente"),
  ]);
  const originTable = await rows("SELECT 1 FROM sqlite_master WHERE type='table' AND name='BpmCardOrigemExterna'");
  const existing = originTable.length ? await rows(`SELECT o.sourceDealId,o.cardId,o.rawJson,c.empresaId
    FROM BpmCardOrigemExterna o JOIN BpmCard c ON c.id=o.cardId WHERE o.provider=?`, [PROVIDER]) : [];
  const clientByCnpj = new Map(clients.filter((item) => item.cnpj).map((item) => [String(item.cnpj).replace(/\D/g, ""), item.id]));
  const clientByName = new Map();
  for (const client of clients) for (const name of [client.razaoSocial, client.nomeFantasia]) if (name) {
    const key = normalize(name); const ids = clientByName.get(key) ?? new Set(); ids.add(client.id); clientByName.set(key, ids);
  }
  const existingIds = new Set(existing.map((item) => item.sourceDealId));
  // De/para explícito aprovado; nomes abreviados não podem virar um usuário padrão.
  const mappingPath = process.argv.find((a) => a.startsWith("--owner-map="))?.slice(12);
  const ownerMappings = mappingPath ? JSON.parse(await readFile(mappingPath, "utf8")) : [];
  if (!Array.isArray(ownerMappings) || ownerMappings.some((m) => typeof m.rd !== "string" || !users.some((u) => Number(u.id) === m.alpha && u.nome === m.name))) throw new Error("De/para de responsáveis inválido.");
  const ownersBySourceId = new Map(ownerMappings.map((m) => [m.rd, m.alpha]));
  for (const item of full) item.resolvedOwner = item.scope.owner ?? ownersBySourceId.get(String(item.ownerId));
  const unresolvedOwners = full.filter((item) => !existingIds.has(String(item.deal.id ?? item.deal._id)) && !item.resolvedOwner).length;

  const cnpjCounts = new Map();
  for (const row of full) if (row.cnpj) cnpjCounts.set(row.cnpj, (cnpjCounts.get(row.cnpj) ?? 0) + 1);
  const duplicates = [...cnpjCounts.values()].reduce((n, count) => n + Math.max(0, count - 1), 0);
  const noDirectClient = full.filter(({ detail, cnpj }) => {
    if (cnpj) return !clientByCnpj.has(cnpj);
    const orgName = detail.organization?.name;
    const matches = orgName ? clientByName.get(normalize(orgName)) : null;
    return !(matches?.size === 1);
  }).length;
  const fingerprint = sha(full.map((item) => `${item.deal.id ?? item.deal._id}:${item.detail.updated_at ?? item.detail.created_at ?? ""}:${sha(json(item.events))}`).sort().join("\n"));
  const summary = {
    mode, fingerprint, unresolvedOwners, sourceDeals: sourceDeals.length, detailedDeals: full.length, failedDeals: [...summaries.values()].reduce((n, item) => n + item.apiErrors, 0), sourceStageHistories: [...summaries.values()].reduce((n, item) => n + item.histories, 0),
    sourceActivities: [...summaries.values()].reduce((n, item) => n + item.activities, 0),
    missingActivityDeals: [...summaries.values()].reduce((n, item) => n + item.missingActivities, 0),
    repeatedCnpjDeals: duplicates, dealsUsingCreatedClient: noDirectClient,
    alreadyImported: full.filter((item) => existingIds.has(String(item.deal.id ?? item.deal._id))).length,
    sourceStageMap: Object.fromEntries([...summaries.values()].map((item) => [item.name, { leads: item.leads, stageHistories: item.histories, activities: item.activities, missingActivities: item.missingActivities, apiErrors: item.apiErrors, stages: item.bySourceStage, unmapped: item.unmappedStages }])),
  };

  const hasUnmapped = unresolvedOwners > 0 || summary.failedDeals > 0 || Object.values(summary.sourceStageMap).some((pipeline) => Object.values(pipeline.unmapped).some(Boolean));

  if (mode === "preview") {
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = hasUnmapped ? 2 : 0;
  } else {
    console.log(JSON.stringify({ preflight: summary }, null, 2));
    if (hasUnmapped) throw new Error("Há etapas ou responsáveis sem destino Alpha verificado; nenhuma alteração foi aplicada. Execute preview e resolva o de/para.");
    await backupGate();
    const sql = await readFile(MIGRATION_FILE, "utf8");
    const executableSql = sql.split(/\r?\n/).filter((line) => !line.trimStart().startsWith("--")).join("\n");
    for (const statement of executableSql.split(";").map((item) => item.trim()).filter(Boolean)) await executeWithRetry(statement);
    const importId = stableId("rdimp", PROVIDER, fingerprint);
    await executeWithRetry({ sql: "INSERT OR IGNORE INTO BpmImportacaoExterna (id,provider,fingerprint,status,resumoJson) VALUES (?,?,?,'EM_ANDAMENTO',?)", args: [importId, PROVIDER, fingerprint, json(summary)] });

    const lookup = new Map();
    const unmatchedCnpjs = new Set(full.filter((item) => item.cnpj && !clientByCnpj.has(item.cnpj)).map((item) => item.cnpj));
    let cnpjEnrichmentFailures = 0;
    if (unmatchedCnpjs.size) {
      const { getReceitaData, EsperaReceitaWS } = await import("../src/lib/cnpj/receita-federal.ts");
      for (const cnpj of unmatchedCnpjs) {
        try {
          let result;
          for (let attempt = 0; attempt < 4; attempt++) {
            try { result = await getReceitaData(cnpj); break; }
            catch (error) {
              if (error instanceof EsperaReceitaWS && attempt < 3) { await sleep((error.segundos + 1) * 1000); continue; }
              throw error;
            }
          }
          lookup.set(cnpj, { razaoSocial: result.razaoSocial, nomeFantasia: result.nomeFantasia, municipio: result.municipio, uf: result.uf, dataConstituicao: result.dataConstituicao, regimeTributario: result.regimeTributario, capitalSocial: String(result.capitalSocial ?? ""), situacaoCadastral: result.situacao });
        } catch { lookup.set(cnpj, null); cnpjEnrichmentFailures++; }
      }
    }

    let importedCards = 0, importedEvents = 0, importedStageHistories = 0, importedActivityEvents = 0, skipped = 0;
    const clientBySourceOrganization = new Map();
    for (const origin of existing) {
      try {
        const organizationId = JSON.parse(origin.rawJson)?.organization?.id ?? JSON.parse(origin.rawJson)?.organization?._id;
        if (organizationId && origin.empresaId) clientBySourceOrganization.set(String(organizationId), origin.empresaId);
      } catch { /* do not infer an organization link from malformed source data */ }
    }
    for (const item of full) {
      const dealId = String(item.detail.id ?? item.detail._id ?? item.deal.id ?? item.deal._id);
      if (existingIds.has(dealId)) {
        skipped++;
        recordsSinceReconnect++;
        if (recordsSinceReconnect >= 80) { recordsSinceReconnect = 0; await reconnectDb(); }
        continue;
      }
      if (!item.alphaPipeline || !item.alphaStage) { skipped++; continue; }
      const dealName = String(item.detail.name ?? item.deal.name ?? "Lead RD Station").trim() || "Lead RD Station";
      const org = item.detail.organization ?? {};
      const sourceOrganizationId = org.id ?? org._id ?? null;
      let clientId = item.cnpj ? clientByCnpj.get(item.cnpj) : null;
      if (!item.cnpj && sourceOrganizationId && clientBySourceOrganization.has(String(sourceOrganizationId))) {
        clientId = clientBySourceOrganization.get(String(sourceOrganizationId));
      }
      const orgMatches = org.name ? clientByName.get(normalize(org.name)) : null;
      if (!item.cnpj && !clientId && orgMatches?.size === 1) clientId = [...orgMatches][0];
      if (!clientId) {
        const enriched = item.cnpj ? lookup.get(item.cnpj) : null;
        const legalName = enriched?.razaoSocial || org.name || dealName;
        if (item.cnpj) {
          await executeWithRetry({ sql: `INSERT OR IGNORE INTO Cliente (cnpj,razaoSocial,nomeFantasia,dataConstituicao,uf,municipio,regimeTributario,capitalSocial,situacaoCadastral,status,createdAt,updatedAt)
            VALUES (?,?,?,?,?,?,?,?,?,'ATIVO',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, args: [item.cnpj, legalName, enriched?.nomeFantasia ?? org.name ?? null, enriched?.dataConstituicao ?? null, enriched?.uf ?? null, enriched?.municipio ?? null, enriched?.regimeTributario ?? null, enriched?.capitalSocial ?? null, enriched?.situacaoCadastral ?? null] });
          clientId = clientByCnpj.get(item.cnpj) ?? (await rows("SELECT id FROM Cliente WHERE cnpj=? LIMIT 1", [item.cnpj]))[0]?.id;
        }
        if (!clientId) {
          clientId = await withWriteTransaction(async (tx) => {
            await tx.execute({ sql: `INSERT INTO Cliente (cnpj,razaoSocial,nomeFantasia,status,createdAt,updatedAt) VALUES (NULL,?,?,'ATIVO',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, args: [legalName, org.name ?? null] });
            return (await tx.execute("SELECT last_insert_rowid() id")).rows[0]?.id;
          });
        }
      }
      if (!clientId) throw new Error("Não foi possível criar ou resolver a empresa do negócio RD.");
      if (!item.cnpj && sourceOrganizationId) clientBySourceOrganization.set(String(sourceOrganizationId), clientId);
      const ownerId = item.resolvedOwner;
      if (!ownerId) throw new Error("Responsável sem de/para explícito; importação bloqueada.");
      const cardId = stableId("rdcard", PROVIDER, dealId);
      const originId = stableId("rdorigin", PROVIDER, dealId);
      const eventCounts = await withWriteTransaction(async (tx) => {
        await tx.execute({ sql: `INSERT OR IGNORE INTO BpmCard (id,empresaId,pipelineId,etapaId,responsavelId,servico,status,createdAt,updatedAt)
          VALUES (?,?,?,?,?,?,'ATIVO',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, args: [cardId, clientId, item.alphaPipeline.id, item.alphaStage.id, ownerId, resolverServicoRd(item.detail).servico] });
        await tx.execute({ sql: `INSERT OR IGNORE INTO BpmCardMembro (id,cardId,userId,role,createdAt) VALUES (?,?,?,'RESPONSAVEL',CURRENT_TIMESTAMP)`, args: [stableId("rdmember", cardId, ownerId), cardId, ownerId] });
        await tx.execute({ sql: `INSERT OR IGNORE INTO BpmCardOrigemExterna (id,provider,sourceDealId,cardId,importacaoId,sourcePipelineId,sourcePipelineName,sourceStageId,sourceStageName,sourceOwnerId,sourceOwnerName,sourceDealName,rawJson)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, args: [originId, PROVIDER, dealId, cardId, importId, item.scope.id, item.detail.deal_pipeline?.name ?? item.scope.name, item.stageId ?? "", item.stageName, item.ownerId ? String(item.ownerId) : null, item.ownerName, dealName, json(item.detail)] });
        const eventStatements = item.events.map((event) => ({
          sql: `INSERT OR IGNORE INTO BpmEventoExternoCard (id,origemId,sourceKey,sourceEventId,eventType,occurredAt,rawJson,projectedJson,createdAt,updatedAt)
            VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
          args: [stableId("rdevent", originId, event.sourceKey), originId, event.sourceKey, event.sourceEventId ? String(event.sourceEventId) : null, event.eventType, event.occurredAt, json(event.raw), json(event.projection)],
        }));
        for (let offset = 0; offset < eventStatements.length; offset += 100) await tx.batch(eventStatements.slice(offset, offset + 100));
        const counts = {
          events: item.events.length,
          stageHistories: item.events.filter((event) => event.eventType === "DEAL_STAGE_HISTORY").length,
          activityEvents: item.events.filter((event) => event.eventType.startsWith("ACTIVITY_")).length,
        };
        await tx.execute({ sql: `INSERT OR IGNORE INTO BpmCardHistorico (id,cardId,acao,valorNovoJson,automacaoOrigem,createdAt)
          VALUES (?,?,?,?,'RD_STATION_IMPORT',CURRENT_TIMESTAMP)`, args: [stableId("rdtag", originId), cardId, "ORIGEM_RD_STATION", json({ origem: "RD Station", pipelineOrigem: item.detail.deal_pipeline?.name ?? item.scope.name, etapaOrigem: item.stageName, tag: "RD Station" })] });
        return counts;
      });
      importedCards++;
      importedEvents += eventCounts.events;
      importedStageHistories += eventCounts.stageHistories;
      importedActivityEvents += eventCounts.activityEvents;
      existingIds.add(dealId);
      recordsSinceReconnect++;
      if (recordsSinceReconnect >= 80) { recordsSinceReconnect = 0; await reconnectDb(); }
    }
    const finalSummary = { ...summary, importedCards, importedEvents, importedStageHistories, importedActivityEvents, skipped, cnpjEnrichmentFailures, status: "CONCLUIDO" };
    await executeWithRetry({ sql: "UPDATE BpmImportacaoExterna SET status='CONCLUIDO', resumoJson=?, concluidoEm=CURRENT_TIMESTAMP WHERE id=?", args: [json(finalSummary), importId] });
    console.log(JSON.stringify(finalSummary, null, 2));
  }
} finally {
  await db.close();
}
