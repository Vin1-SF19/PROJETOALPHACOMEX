import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { listBibbleAgents } from "@/lib/roadmap-alpha/bibble-agents";
import { ROADMAP_PHASE_AGENTS } from "@/lib/roadmap-alpha/contracts";

const root = process.cwd();
const readProjectFile = (relativePath: string) =>
  fs.readFile(path.join(root, relativePath), "utf8");

describe("Virtus como gate final manual de produção", () => {
  it("expõe a identidade de Virtus no fallback do catálogo Bibble", async () => {
    const agents = await listBibbleAgents(
      path.join(root, ".tmp-inexistente-para-fallback-virtus"),
    );

    expect(agents.find(({ id }) => id === "virtus")).toMatchObject({
      id: "virtus",
      name: "Virtus",
      title: "Guardião Final de Produção",
      icon: "🏛️",
      available: false,
    });
  });

  it("mantém Virtus invocável pelo usuário, com confirmação antes do push", async () => {
    const [skill, agentsInstructions] = await Promise.all([
      readProjectFile(".agents/skills/virtus/SKILL.md"),
      readProjectFile("AGENTS.md"),
    ]);

    expect(skill).toMatch(/^user-invocable:\s*true\s*$/m);
    expect(skill).toMatch(/^activation_type:\s*manual\s*$/m);
    expect(skill).toContain(
      "Deseja que eu faça o commit e o push para produção agora?",
    );
    expect(skill).toContain(
      "Exercer autoridade exclusiva para `git commit` e `git push` **somente dentro do fluxo final de produção do Virtus**, após confirmação explícita do usuário.",
    );
    expect(skill).toContain(
      "Nunca ativar este agente automaticamente, por heurística ou como continuação silenciosa de outro workflow.",
    );
    expect(agentsInstructions).toContain(
      "`/virtus` -> `.agents/skills/virtus/SKILL.md`",
    );
    expect(agentsInstructions).toContain("exclusivamente manual");
  });

  it("não permite que planejadores automáticos selecionem Virtus", async () => {
    const qwenGenerator = await readProjectFile(
      "src/lib/roadmap-alpha/qwen-generator.ts",
    );

    expect(ROADMAP_PHASE_AGENTS).not.toContain("virtus");
    expect(qwenGenerator.toLowerCase()).not.toContain("virtus");
  });
});
