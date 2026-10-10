import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const [mode, source, candidate, destination, config] = process.argv.slice(2);
const manifest = JSON.parse(fs.readFileSync(path.join(candidate, 'logcomex-worker-stage-manifest.json')));
if (!manifest.validated || fs.readFileSync(path.join(source, '.next/BUILD_ID'), 'utf8').trim() !== manifest.buildId) throw Error('Build validado divergente.');
let checked = 0;
for (const [file, expected] of Object.entries(manifest.sha256)) {
  if (!(file.startsWith('.next/') || file.startsWith('scripts/') || file === 'package.json' || file === 'package-lock.json')) continue;
  if (file.startsWith('.next/cache/')) continue;
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(source, file))).digest('hex');
  if (actual !== expected) throw Error(`Integridade divergente: ${file}`);
  checked++;
}
if (!checked || !fs.existsSync(path.join(source, '.next/server/app/api/internal/alpha-catcher/worker/route.js'))) throw Error('Runtime incompleto.');
console.log(`Build ${manifest.buildId}; ${checked} arquivos de runtime verificados.`);
if (mode === 'verify') process.exit(0);
const require = createRequire(path.join(source, 'package.json'));
require('@next/env').loadEnvConfig(source, false, { info() {}, error() {} });
require.resolve('next/dist/bin/next');
require.resolve('@prisma/client');
if (!/^libsql:\/\//.test(process.env.TURSO_DATABASE_URL || '') || !process.env.TURSO_AUTH_TOKEN) throw Error('Credenciais Turso ausentes ou URL inesperada.');
const automation = process.env.LOGCOMEX_AUTOMATION_DIR;
const shipment = process.env.LOGCOMEX_SHIPMENT_DIR;
for (const directory of [automation, shipment]) if (!directory || !path.isAbsolute(directory) || !fs.statSync(directory).isDirectory()) throw Error('Configure paths absolutos LOGCOMEX_AUTOMATION_DIR/LOGCOMEX_SHIPMENT_DIR na release fonte.');
if (fs.existsSync(path.join(automation, '.env'))) process.loadEnvFile(path.join(automation, '.env'));
const secrets = process.env.LOGCOMEX_SECRETS_DIR || path.join('/home/ialpha', 'LogcomexAutomation');
for (const file of ['credentials.json', 'token.json']) if (!fs.statSync(path.join(secrets, file)).isFile()) throw Error('OAuth Gmail incompleto.');
if (mode === 'preflight') process.exit(0);
if (mode !== 'prepare') throw Error('Modo inválido.');
const state = path.join(path.dirname(path.dirname(destination)), 'state');
fs.mkdirSync(path.join(state, 'gmail'), { recursive: true, mode: 0o700 });
fs.mkdirSync(path.join(state, 'sessions'), { recursive: true, mode: 0o700 });
for (const file of ['credentials.json', 'token.json']) {
  fs.copyFileSync(path.join(secrets, file), path.join(state, 'gmail', file), fs.constants.COPYFILE_EXCL);
  fs.chmodSync(path.join(state, 'gmail', file), 0o600);
}
for (const file of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  const original = path.join(source, file);
  if (!fs.existsSync(original)) continue;
  const clean = fs.readFileSync(original, 'utf8').split('\n').filter(line => !/^\s*(?:export\s+)?(?:ALPHA_CATCHER_WORKER_(?:HOST|URL|SECRET)|LOGCOMEX_(?:SESSION_DIR|SECRETS_DIR)|TMPDIR|VERCEL)\s*=/.test(line)).join('\n');
  fs.writeFileSync(path.join(destination, file), clean, { mode: 0o600, flag: 'wx' });
}
const values = {
  ALPHA_CATCHER_WORKER_HOST: 'true', ALPHA_CATCHER_WORKER_URL: '',
  ALPHA_CATCHER_WORKER_SECRET: crypto.randomBytes(32).toString('hex'),
  LOGCOMEX_AUTOMATION_DIR: automation, LOGCOMEX_SHIPMENT_DIR: shipment,
  LOGCOMEX_SECRETS_DIR: path.join(state, 'gmail'), LOGCOMEX_SESSION_DIR: path.join(state, 'sessions'),
};
// systemd EnvironmentFile suporta aspas duplas; paths não podem conter controles.
for (const value of Object.values(values)) if (/[\r\n\0]/.test(value)) throw Error('Valor de ambiente inválido.');
const serialized = Object.entries(values).map(([key, value]) => `${key}="${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`).join('\n') + '\n';
fs.writeFileSync(config, serialized, { mode: 0o600, flag: 'wx' });
