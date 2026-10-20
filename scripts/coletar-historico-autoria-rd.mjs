/** Coleta somente leitura. Dados reais ficam exclusivamente no diretório privado. */
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "dotenv";

export async function collectPages(request, endpoint, params = {}) {
  const rows = new Map(), pages = [], seenCursors = new Set();
  let pagination = { page: 1 };
  for (let index = 0; index < 2000; index++) {
    const response = await request(endpoint, { limit: 200, ...params, ...pagination });
    if (!response || Array.isArray(response)) throw Error("INVALID_PAGE_OR_END_MARKER");
    const list = response[endpoint];
    if (!Array.isArray(list) || typeof response.has_more !== "boolean") throw Error("INVALID_PAGE_OR_END_MARKER");
    for (const row of list) {
      const id = row.id ?? row._id;
      if (typeof id !== "string" || rows.has(id)) throw Error("MISSING_OR_REPEATED_ID");
      rows.set(id, row);
    }
    pages.push({ pagination, count: list.length, hasMore: response.has_more, total: response.total });
    if (!response.has_more) return { rows: [...rows.values()], pages, complete: true };
    if (!list.length) throw Error("EMPTY_NONTERMINAL_PAGE");
    const next = response.next_page;
    const cursor = String(next ?? index + 2);
    if (seenCursors.has(cursor)) throw Error("REPEATED_CURSOR");
    seenCursors.add(cursor);
    pagination = typeof next === "string" && !/^\d+$/.test(next)
      ? { next_page: next }
      : { page: Number(next ?? index + 2) };
  }
  throw Error("PAGE_LIMIT");
}

async function main() {
  config({ path: ".env.local", quiet: true });
  const directory = path.resolve(process.argv[2] ?? "database-backups/pre-change/rd-historico-autoria-2026-10-20");
  if (!directory.includes("/database-backups/pre-change/")) throw Error("PRIVATE_DIRECTORY_REQUIRED");
  const token = process.env.RD_STATION_CRM_V1_TOKEN;
  if (!token) throw Error("RD_V1_TOKEN_REQUIRED");
  const alpha = JSON.parse(await readFile(path.join(directory, "alpha-snapshot.json"), "utf8"));
  const origins = alpha.origins.filter(o => o.provider === "RD_STATION_CRM_V1");
  const detailDir = path.join(directory, "details-v1");
  await mkdir(detailDir, { recursive: true, mode: 0o700 });
  const save = async (file, data) => {
    const target = path.join(directory, file), temporary = `${target}.tmp`;
    await writeFile(temporary, JSON.stringify(data), { mode: 0o600 });
    await rename(temporary, target);
  };
  let nextRequestAt = 0;
  const request = async (endpoint, params = {}) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const start = Math.max(Date.now(), nextRequestAt);
      nextRequestAt = start + 650;
      await new Promise(resolve => setTimeout(resolve, Math.max(0, start - Date.now())));
      const url = new URL(`https://crm.rdstation.com/api/v1/${endpoint}`);
      url.searchParams.set("token", token);
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
      let response;
      try { response = await fetch(url, { signal: AbortSignal.timeout(30000) }); } catch { /* bounded retry */ }
      if (response?.ok) return response.json();
      if (response && response.status < 500 && response.status !== 429) throw Error(`RD_HTTP_${response.status}`);
      if (response?.status === 429) {
        nextRequestAt = Math.max(nextRequestAt, Date.now() + Math.max(60000, Number(response.headers.get("retry-after") || 0) * 1000));
      } else await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
    throw Error("RD_RETRIES_EXHAUSTED");
  };
  let source = { startedAt: new Date().toISOString(), complete: false, origins: origins.length };
  try {
    const cached = JSON.parse(await readFile(path.join(directory, "source-v1.json"), "utf8"));
    if (Date.now() - Date.parse(cached.startedAt) < 3600000) source = { ...cached, complete: false };
  } catch { /* first collection */ }
  for (const endpoint of ["deals", "activities"]) {
    if (source[endpoint]?.complete) continue;
    source[endpoint] = await collectPages(request, endpoint);
    await save("source-v1.json", source);
    console.log(JSON.stringify({ phase: endpoint, rows: source[endpoint].rows.length, pages: source[endpoint].pages.length }));
  }
  // V1 /users is a non-paginated catalogue; V2 users is independently collected.
  const users = await request("users");
  if (!Array.isArray(users.users)) throw Error("INVALID_USERS_CATALOGUE");
  source.users = { rows: users.users, complete: true, collectedAt: new Date().toISOString() };
  source.tasks ??= {};
  for (const done of ["false", "true"]) {
    if (source.tasks[done]?.complete) continue;
    source.tasks[done] = await collectPages(request, "tasks", { done });
    await save("source-v1.json", source);
    console.log(JSON.stringify({ phase: "tasks", done, rows: source.tasks[done].rows.length }));
  }
  source.stages = [];
  for (const pipelineId of [...new Set(origins.map(o => o.sourcePipelineId))]) {
    const stages = await request("deal_stages", { deal_pipeline_id: pipelineId, limit: 200 });
    source.stages.push({ pipelineId, response: stages });
  }
  await save("source-v1.json", source);
  let index = 0, completed = 0, missing = 0;
  const worker = async () => {
    while (index < origins.length) {
      const origin = origins[index++];
      if (!/^[a-f0-9]{24}$/.test(origin.sourceDealId)) throw Error("INVALID_DEAL_ID");
      const file = `details-v1/${origin.sourceDealId}.json`;
      let cached;
      try { cached = JSON.parse(await readFile(path.join(directory, file), "utf8")); } catch { /* not collected */ }
      if (!cached?.complete || Date.now() - Date.parse(cached.collectedAt) > 3600000) {
        try {
          const data = await request(`deals/${origin.sourceDealId}`);
          if ((data.id ?? data._id) !== origin.sourceDealId || !Array.isArray(data.deal_stage_histories)) throw Error("INVALID_DEAL_DETAIL");
          cached = { complete: true, collectedAt: new Date().toISOString(), data };
        } catch (error) {
          if (error.message !== "RD_HTTP_404") throw error;
          cached = { complete: true, collectedAt: new Date().toISOString(), notFound: true };
        }
        await save(file, cached);
      }
      completed++;
      if (cached.notFound) missing++;
      if (completed % 25 === 0 || completed === origins.length) {
        const progress = { phase: "details", completed, total: origins.length, missing };
        await save("progress.json", progress);
        console.log(JSON.stringify(progress));
      }
    }
  };
  await Promise.all([worker(), worker()]);
  source.complete = true;
  source.completedAt = new Date().toISOString();
  source.detailCount = completed;
  source.detailMissing = missing;
  await save("source-v1.json", source);
  console.log(JSON.stringify({ complete: true, detailCount: completed, missing }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
