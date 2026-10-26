import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/helpers/server-only.ts"),
    },
  },
  test: {
    // Resolve Auth.js extensionless Next imports as Next's bundler does; tests
    // exercise the real session handlers instead of mocking their cookie logic.
    server: { deps: { inline: ["next-auth"] } },
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/lib/cs-nps/importar-dados.ts",
        "src/lib/cs-nps/preflight-xlsx.ts",
        "src/app/PainelAlpha/CadastroClientes/importacao/calculos.ts",
        "src/actions/bpm/**/*.ts",
        "src/lib/bpm/**/*.ts",
      ],
    },
  },
});
