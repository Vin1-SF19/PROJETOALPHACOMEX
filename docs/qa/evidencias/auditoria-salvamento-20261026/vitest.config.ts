import path from 'node:path';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  resolve: { alias: { '@': path.resolve(process.cwd(), 'src'), 'server-only': path.resolve(process.cwd(), 'tests/helpers/server-only.ts') } },
  test: { include: ['docs/qa/evidencias/auditoria-salvamento-20261026/*.test.ts'], environment: 'node' },
});
