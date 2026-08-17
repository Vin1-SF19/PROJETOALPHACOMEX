import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { publishRoadmapProjection } from "@/lib/roadmap-alpha/projection";

const roots: string[] = [];
const manifest = {
  contractVersion: 1 as const,
  summary: "Documentação completa do objetivo selecionado para o Roadmap Alpha.",
  phases: [
    { number: 0, slug: "contexto-geral", title: "Contexto geral", kind: "CONTEXT" as const, agent: "context" as const, dependsOn: [], markdown: "# Contexto\n\n" + "Informação confiável e verificável. ".repeat(4) },
    { number: 1, slug: "executar", title: "Executar mudança", kind: "EXECUTION" as const, agent: "dev" as const, dependsOn: [0], markdown: "# Execução\n\n" + "Implemente o objetivo com testes proporcionais. ".repeat(4) },
  ],
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("publishRoadmapProjection", () => {
  it("publica a revisão no namespace isolado", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "roadmap-projection-"));
    roots.push(root);
    const result = await publishRoadmapProjection({ moduleKey: "crm", objectiveCode: "RM-2026-ABC123", version: 1, manifest }, root);
    expect(result.relativeDirectory).toBe("prompt-phases/roadmap-alpha/crm/RM-2026-ABC123/r0001");
    expect(await fs.readFile(path.join(root, result.relativeDirectory, "00-contexto-geral.md"), "utf8")).toContain("# Contexto");
    expect(await fs.readFile(path.join(root, result.relativeDirectory, "_status.md"), "utf8")).toContain("DOCUMENTED");
  });

  it("é idempotente quando a projeção existente é idêntica", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "roadmap-projection-"));
    roots.push(root);
    const input = { moduleKey: "crm", objectiveCode: "RM-2026-ABC123", version: 1, manifest };
    const first = await publishRoadmapProjection(input, root);
    const second = await publishRoadmapProjection(input, root);
    expect(second.relativeDirectory).toBe(first.relativeDirectory);
  });

  it("recusa sobrescrever uma revisão divergente", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "roadmap-projection-"));
    roots.push(root);
    const input = { moduleKey: "crm", objectiveCode: "RM-2026-ABC123", version: 1, manifest };
    const first = await publishRoadmapProjection(input, root);
    await fs.writeFile(path.join(root, first.relativeDirectory, "00-contexto-geral.md"), "divergente", "utf8");
    await expect(publishRoadmapProjection(input, root)).rejects.toThrow("PROJECTION_CONFLICT");
  });
});
