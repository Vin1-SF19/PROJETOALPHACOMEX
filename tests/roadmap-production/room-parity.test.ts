import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

async function source(relativePath: string): Promise<string> {
  return fs.readFile(path.join(process.cwd(), relativePath), "utf8");
}

describe("paridade de comandos da Sala de Implementação", () => {
  it("expõe no CLI os mesmos comandos de interação aceitos pelo worker", async () => {
    const cli = await source("scripts/roadmap-production.mjs");
    for (const [cliCommand, controlType] of [
      ["respond", "RESPOND"],
      ["authorize", "AUTHORIZE"],
      ["deny", "DENY"],
      ["message", "MESSAGE"],
      ["switch-agent", "SWITCH_AGENT"],
    ] as const) {
      expect(cli).toMatch(
        new RegExp(`["']?${cliCommand}["']?\\s*:\\s*["']${controlType}["']`),
      );
    }
  });

  it("liga mensagem, resposta e troca de agente da UI às Server Actions", async () => {
    const actions = await source("src/actions/RoadmapProduction.ts");
    const room = await source(
      "src/components/RoadmapAlpha/RoadmapImplementationRoom.tsx",
    );
    for (const action of [
      "EnviarMensagemRoadmapProduction",
      "ResponderIntervencaoRoadmapProduction",
      "TrocarAgenteFaseRoadmapProduction",
    ]) {
      expect(actions).toContain(`export async function ${action}`);
      expect(room).toContain(action);
    }
    expect(room).toContain('answer(item, "DENY")');
    expect(room).toContain('answer(item, "AUTHORIZE")');
    expect(room).toContain("Autorizar uma vez");
  });
});
