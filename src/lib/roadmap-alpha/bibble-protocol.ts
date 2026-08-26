import { readFile } from "node:fs/promises";
import path from "node:path";

import { listBibbleAgents } from "@/lib/roadmap-alpha/bibble-agents";

const BIBBLE_SKILL_RELATIVE_PATH = ".claude/skills/bibble-squad/bibble/SKILL.md";

/**
 * Lê o protocolo real do Bibble (persona + ordem obrigatória de agentes) para
 * a documentação (Qwen) montar o manifesto de fases seguindo a mesma ordem
 * que o orquestrador segue. Só existe dentro do PainelAlpha — um workspace
 * externo não tem squad Bibble instalada, então a ausência é esperada e não
 * deve bloquear a documentação daquele objetivo (fallback gracioso).
 */
async function loadBibbleProtocol(root: string): Promise<string | null> {
  try {
    return await readFile(path.resolve(root, BIBBLE_SKILL_RELATIVE_PATH), "utf8");
  } catch {
    console.warn(
      `[roadmap-alpha] bibble/SKILL.md não encontrado em ${root} — documentação seguirá sem o protocolo do Bibble (esperado para workspace externo).`,
    );
    return null;
  }
}

export interface BibbleOrchestrationContext {
  protocol: string | null;
  agentCatalog: string;
}

/**
 * Monta o contexto de orquestração que a documentação injeta no system prompt
 * do Qwen: o protocolo real do Bibble (se disponível) + um catálogo legível
 * dos agentes reais (nome + o que cada um faz), para o manifesto de fases
 * respeitar a mesma ordem obrigatória e escolher o agente certo por fase com
 * informação real, não só um nome solto.
 */
export async function loadBibbleOrchestrationContext(
  root: string,
): Promise<BibbleOrchestrationContext> {
  const [protocol, agents] = await Promise.all([
    loadBibbleProtocol(root),
    listBibbleAgents(root),
  ]);
  const agentCatalog = agents
    .filter((agent) => agent.available)
    .map((agent) => `- ${agent.id} (${agent.name}, ${agent.title}): ${agent.description}`)
    .join("\n");
  return { protocol, agentCatalog };
}
