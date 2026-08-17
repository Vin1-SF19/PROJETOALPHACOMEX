import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { readProductionConfig, readProductionState, writeProductionConfig, writeProductionState } from "@/lib/roadmap-production/storage";

const roots: string[] = [];
async function root() { const value = await fs.mkdtemp(path.join(os.tmpdir(), "roadmap-production-")); roots.push(value); return value; }
afterEach(async () => { await Promise.all(roots.splice(0).map((value) => fs.rm(value, { recursive: true, force: true }))); });

describe("estado local de Produção", () => {
  it("cria configuração padrão e persiste atualização", async () => {
    const project = await root();
    const initial = await readProductionConfig(project);
    expect(initial.provider).toBe("ollama");
    const saved = await writeProductionConfig({ version: 1, provider: "ollama", model: "qwen3.8:27b", autoRun: false, maxToolSteps: 12 }, project);
    expect(saved.autoRun).toBe(false);
    expect((await readProductionConfig(project)).maxToolSteps).toBe(12);
  });

  it("persiste estado validado de forma recuperável", async () => {
    const project = await root();
    const state = await readProductionState(project);
    await writeProductionState(state, project);
    expect((await readProductionState(project)).executions).toEqual([]);
  });
});
