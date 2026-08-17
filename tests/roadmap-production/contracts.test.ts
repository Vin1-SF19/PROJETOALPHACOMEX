import { describe, expect, it } from "vitest";

import { productionConfigSchema, productionStateSchema } from "@/lib/roadmap-production/contracts";

describe("contratos de Produção do Roadmap", () => {
  it("aceita configuração local válida e rejeita chaves desconhecidas", () => {
    const config = { version: 1, provider: "ollama", model: "qwen3.8:27b", autoRun: true, maxToolSteps: 24, updatedAt: new Date().toISOString() };
    expect(productionConfigSchema.parse(config).provider).toBe("ollama");
    expect(productionConfigSchema.safeParse({ ...config, token: "secret" }).success).toBe(false);
  });

  it("valida a estrutura persistida de execuções", () => {
    const state = productionStateSchema.parse({ version: 1, updatedAt: new Date().toISOString(), executions: [] });
    expect(state.executions).toEqual([]);
  });
});
