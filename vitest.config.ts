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
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/lib/cs-nps/importar-dados.ts",
        "src/lib/cs-nps/preflight-xlsx.ts",
        "src/app/PainelAlpha/CadastroClientes/importacao/calculos.ts",
      ],
    },
  },
});
