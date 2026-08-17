import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { runProductionAgent } from "@/lib/roadmap-production/providers";

const roots: string[] = [];
afterEach(async () => { vi.unstubAllEnvs(); await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

describe("adapter Ollama de Produção", () => {
  it("solicita uma conclusão curta quando a primeira resposta é truncada", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "roadmap-provider-"));
    roots.push(root);
    await fs.mkdir(path.join(root, ".claude", "skills", "bibble-squad", "scout"), { recursive: true });
    await fs.writeFile(path.join(root, ".claude", "skills", "bibble-squad", "scout", "SKILL.md"), "# Scout\nInvestigue o contexto.", "utf8");
    vi.stubEnv("BIBBLE_OLLAMA_URL", "http://ollama.test");
    vi.stubEnv("OLLAMA_API_KEY", "test-token");
    vi.stubEnv("ROADMAP_QWEN_MODEL", "qwen3.8:27b");
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { role: "assistant", content: "parcial" } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: "RESULT: PASS\nContexto validado." } }] }), { status: 200 }));
    const activities: string[] = [];
    const result = await runProductionAgent(
      { version: 1, provider: "ollama", model: "qwen3.8:27b", autoRun: true, maxToolSteps: 4, updatedAt: new Date().toISOString() },
      { agentId: "scout", objectiveCode: "RM-TEST", objectiveTitle: "Teste", moduleKey: "crm", phaseNumber: 0, phaseTitle: "Contexto", phaseKind: "CONTEXT", phaseMarkdown: "Mapeie o contexto da aplicação sem alterar arquivos.", previousSummaries: [], allowWrite: false },
      (message) => { activities.push(message); },
      root,
      { fetchImpl: fetchImpl as typeof fetch },
    );
    expect(result.success).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(activities).toContain("Resposta parcial; solicitando conclusão objetiva");
    const secondBody = JSON.parse(String(fetchImpl.mock.calls[1][1]?.body)) as { reasoning_effort: string; messages: Array<{ content: string }> };
    expect(secondBody.reasoning_effort).toBe("low");
    expect(secondBody.messages.at(-1)?.content).toContain("Conclua agora");
  });
});
