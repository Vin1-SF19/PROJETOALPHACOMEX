import { describe, expect, it } from "vitest";

import { listBibbleAgents, resolvePhaseAgent } from "@/lib/roadmap-production/agents";

describe("catálogo dos agentes Bibble", () => {
  it("descobre os skills realmente instalados", async () => {
    const agents = await listBibbleAgents();
    expect(agents.length).toBeGreaterThanOrEqual(20);
    expect(agents.find((agent) => agent.id === "scout")?.available).toBe(true);
    expect(agents.find((agent) => agent.id === "nova")?.skillPath).toContain("bibble-squad/nova/SKILL.md");
  });

  it("resolve aliases do prompt-phases pelo conteúdo", () => {
    expect(resolvePhaseAgent("context", "Descoberta", "Mapear o projeto")).toBe("scout");
    expect(resolvePhaseAgent("dev", "Interface", "Criar UI e skeleton com Tailwind")).toBe("nova");
    expect(resolvePhaseAgent("dev", "API", "Criar server action backend")).toBe("echo");
    expect(resolvePhaseAgent("probe", "Validar", "Executar testes")).toBe("probe");
    expect(resolvePhaseAgent("forge", "Implementar background espacial", "Criar componente visual no layout do CRM")).toBe("nova");
  });
});
