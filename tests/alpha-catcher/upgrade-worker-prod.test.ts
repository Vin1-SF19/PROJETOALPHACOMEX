import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

it('aceita release isolada com build e hashes válidos e rejeita adulteração', () => {
  const root = mkdtempSync(join(tmpdir(), 'catcher-upgrade-'));
  dirs.push(root);
  const source = join(root, 'release');
  const files: Record<string, string> = {
    '.next/BUILD_ID': 'build-123\n',
    '.next/server/app-paths-manifest.json': JSON.stringify({ '/api/internal/alpha-catcher/worker/route': 'route.js' }),
    '.next/server/app/api/internal/alpha-catcher/worker/route.js': 'worker route',
    'package.json': '{}',
    'scripts/alpha-catcher-logcomex.mjs': 'collector',
    'scripts/alpha-catcher-stream.mjs': 'stream',
    'node_modules/next/dist/bin/next': 'next',
  };
  for (const [name, value] of Object.entries(files)) {
    const target = join(source, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, value);
  }
  const sha256 = Object.fromEntries(Object.entries(files).filter(([name]) => name !== 'node_modules/next/dist/bin/next').map(([name, value]) => [name, createHash('sha256').update(value).digest('hex')]));
  const manifest = join(root, 'manifest.json');
  writeFileSync(manifest, JSON.stringify({ validated: true, buildId: 'build-123', sha256 }));
  const script = join(process.cwd(), 'scripts/alpha-catcher-worker-prod/verify-upgrade.mjs');
  const run = () => spawnSync(process.execPath, [script, source, manifest], { encoding: 'utf8' });
  expect(run().status).toBe(0);
  writeFileSync(join(source, 'scripts/alpha-catcher-stream.mjs'), 'tampered');
  expect(run().status).not.toBe(0);
});

it('bloqueia plan sem inspeção privilegiada antes de qualquer efeito', () => {
  if (process.getuid?.() === 0) return;
  const script = join(process.cwd(), 'scripts/upgrade-alpha-catcher-worker-prod.sh');
  const result = spawnSync('bash', [script, 'plan', '/tmp/release', '/tmp/manifest.json'], { encoding: 'utf8' });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('exige sudo');
});
