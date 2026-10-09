// Diagnóstico somente leitura; não inicia coleta nem consulta empresa.
const uso = 'node --conditions=react-server --import tsx scripts/diagnose-alpha-catcher-worker.mts [--user-id ID] [--job-id UUID]';
const args = process.argv.slice(2);
if (args[0] === '--help') { console.log(uso); process.exit(0); }
let userId: number | undefined, jobId: string | undefined;
for (let i = 0; i < args.length; i += 2) {
  const key = args[i], value = args[i + 1];
  if (key === '--user-id' && value && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0 && !userId) userId = Number(value);
  else if (key === '--job-id' && value && /^[0-9a-f-]{36}$/i.test(value) && !jobId) jobId = value;
  else throw new Error(uso);
}
for (const file of ['.env.local', '.env']) {
  try { process.loadEnvFile(file); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
(process.env as Record<string, string>).NODE_ENV = 'production';
const url = process.env.ALPHA_CATCHER_WORKER_URL;
console.log(JSON.stringify({ remotoConfigurado: Boolean(url), chaveConfigurada: (process.env.ALPHA_CATCHER_WORKER_SECRET?.length || 0) >= 32, host: process.env.ALPHA_CATCHER_WORKER_HOST === 'true', vercel: Boolean(process.env.VERCEL) }));
if (userId) {
  const { encaminharWorkerCatcher } = await import('../src/lib/alpha-catcher/worker-client');
  const res = await encaminharWorkerCatcher(jobId ? 'ler' : 'listar-historico', userId, jobId || null);
  console.log(JSON.stringify({ modo: 'somente_leitura', status: res?.status ?? null, local: res === null }));
  if (res && !res.ok) process.exitCode = 1;
}
