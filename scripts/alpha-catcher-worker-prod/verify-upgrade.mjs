import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [source, manifestFile] = process.argv.slice(2);
if (!source || !manifestFile) throw Error('Informe release e manifesto explícitos.');
const root = fs.realpathSync(source);
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
if (manifest.validated !== true || typeof manifest.buildId !== 'string' || !manifest.buildId) throw Error('Manifesto não validado.');
if (fs.readFileSync(path.join(root, '.next/BUILD_ID'), 'utf8').trim() !== manifest.buildId) throw Error('Build ID divergente.');
const hashes = manifest.sha256;
if (!hashes || typeof hashes !== 'object' || !Object.keys(hashes).length) throw Error('Hashes ausentes.');
for (const [name, expected] of Object.entries(hashes)) {
  if (path.isAbsolute(name) || name.split('/').includes('..') || typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) throw Error('Entrada inválida no manifesto.');
  const file = path.join(root, name);
  if (!fs.realpathSync(file).startsWith(root + path.sep)) throw Error('Arquivo fora da release.');
  const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (actual !== expected) throw Error(`Hash divergente: ${name}`);
}
for (const name of ['package.json', 'scripts/alpha-catcher-logcomex.mjs', 'scripts/alpha-catcher-stream.mjs', '.next/server/app/api/internal/alpha-catcher/worker/route.js']) {
  if (!hashes[name]) throw Error(`Arquivo obrigatório sem hash: ${name}`);
}
const routes = JSON.parse(fs.readFileSync(path.join(root, '.next/server/app-paths-manifest.json'), 'utf8'));
if (!routes['/api/internal/alpha-catcher/worker/route']) throw Error('Rota do worker ausente no build.');
if (!fs.existsSync(path.join(root, 'node_modules/next/dist/bin/next'))) throw Error('Dependências ausentes.');
console.log(`Release verificada: build ${manifest.buildId}, ${Object.keys(hashes).length} hashes.`);
