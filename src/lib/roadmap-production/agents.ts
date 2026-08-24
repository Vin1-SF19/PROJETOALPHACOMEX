import fs from "node:fs/promises";
import path from "node:path";

export interface BibbleAgentInfo {
  id: string;
  name: string;
  title: string;
  icon: string;
  description: string;
  skillPath: string;
  available: boolean;
}

const AGENT_META: Record<string, { name: string; title: string; icon: string }> = {
  bibble: { name: "Bibble", title: "Arquiteto-Chefe", icon: "🧠" },
  scout: { name: "Scout", title: "Detetive de Código", icon: "🔭" },
  forge: { name: "Forge", title: "Verificador de Build", icon: "⚡" },
  vault: { name: "Vault", title: "Guardião do Banco", icon: "🔒" },
  probe: { name: "Probe", title: "Verificador de Integração", icon: "🔎" },
  anubis: { name: "Anubis", title: "Guardião de Segurança", icon: "🛡️" },
  lens: { name: "Lens", title: "Revisor de Código", icon: "🔍" },
  sage: { name: "Sage", title: "Arquiteto de Testes", icon: "🧪" },
  nova: { name: "Nova", title: "Engenheiro Frontend", icon: "✨" },
  echo: { name: "Echo", title: "Engenheiro Backend", icon: "📡" },
  iris: { name: "Iris", title: "Designer UI/UX", icon: "🎨" },
  flux: { name: "Flux", title: "Especialista em Performance", icon: "⚡" },
  atlas: { name: "Atlas", title: "Analista Visual", icon: "🗺️" },
  scribe: { name: "Scribe", title: "Cartógrafo do Codebase", icon: "📝" },
  kowalski: { name: "Kowalski", title: "Cronista de Sessões", icon: "🐧" },
  pm: { name: "PM", title: "Product Manager", icon: "📊" },
  analyst: { name: "Analyst", title: "Analista de Produto", icon: "🔬" },
  "data-engineer": { name: "DataEngineer", title: "Engenheiro de Dados", icon: "🗄️" },
  devops: { name: "DevOps", title: "Operador de Infraestrutura", icon: "🚀" },
  "bibble-muse": { name: "Muse", title: "Designer de Persona", icon: "🎭" },
  "bibble-cortex": { name: "Cortex", title: "Engenheiro de IA", icon: "🧬" },
};

function extractDescription(skill: string): string {
  const match = skill.match(/^description:\s*["']?(.+?)["']?\s*$/m);
  return match?.[1]?.slice(0, 300) ?? "Agente especializado do Bibble Squad.";
}

export async function listBibbleAgents(root = process.cwd()): Promise<BibbleAgentInfo[]> {
  const skillsRoot = path.resolve(root, ".claude", "skills", "bibble-squad");
  let entries: string[] = [];
  try {
    entries = (await fs.readdir(skillsRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    entries = Object.keys(AGENT_META).sort();
  }

  return Promise.all(entries.map(async (id) => {
    const skillPath = path.join(skillsRoot, id, "SKILL.md");
    const meta = AGENT_META[id] ?? { name: id, title: "Agente Bibble", icon: "🤖" };
    try {
      const content = await fs.readFile(skillPath, "utf8");
      return { id, ...meta, description: extractDescription(content), skillPath: path.relative(root, skillPath).replaceAll(path.sep, "/"), available: true };
    } catch {
      return { id, ...meta, description: "Skill não instalado.", skillPath: path.relative(root, skillPath).replaceAll(path.sep, "/"), available: false };
    }
  }));
}

const FRONTEND_CAPABILITY = /\b(?:ui|ux|css|tailwind|layout|painel|interface|componentes?|frontend|front-end|react|visual|hover|skeleton|anima(?:ção|ções|r))\b/i;
const BACKEND_CAPABILITY = /\b(?:api|apis|server actions?|backend|back-end|route handlers?|rotas?|serviços?|worker|fila|integra(?:ção|ções)|servidor)\b/i;

export function resolveCapabilityEscalationAgent(value: string): "nova" | "echo" | null {
  const marker = value.match(/\bCAPABILITY_ESCALATION_REQUIRED\s*:\s*(FRONTEND|BACKEND)\b/i)?.[1]?.toUpperCase();
  if (marker === "FRONTEND") return "nova";
  if (marker === "BACKEND") return "echo";
  return null;
}

function classifyCapability(value: string): "nova" | "echo" | null {
  if (BACKEND_CAPABILITY.test(value)) return "echo";
  if (FRONTEND_CAPABILITY.test(value)) return "nova";
  return null;
}

export function resolvePhaseAgent(requestedAgent: string, title: string, markdown: string): string {
  const escalation = resolveCapabilityEscalationAgent(`${title}\n${markdown}`);
  if (escalation) return escalation;
  if (requestedAgent === "context") return "scout";
  if (["nova", "echo"].includes(requestedAgent)) return requestedAgent;
  const implementationIntent = /\b(implementar|criar|adicionar|corrigir|desenvolver|integrar)\b/i.test(title);
  const misroutedReadOnlyAgent = ["forge", "probe", "scout"].includes(requestedAgent) && implementationIntent;
  if (requestedAgent !== "dev" && !misroutedReadOnlyAgent) return requestedAgent;
  return classifyCapability(title) ?? classifyCapability(markdown) ?? "echo";
}

export async function loadBibbleAgentContext(agentId: string, root = process.cwd()): Promise<string> {
  const candidates = [
    `.claude/skills/bibble-squad/${agentId}/SKILL.md`,
    "AGENTS.md",
    ".bibble/constitution.md",
    ".bibble/memory/architecture.md",
    ".bibble/memory/codebase-map.md",
    ".bibble/memory/patterns.md",
    ".bibble/memory/known-errors.md",
  ];
  const parts: string[] = [];
  let budget = 45_000;
  for (const relative of candidates) {
    if (budget <= 0) break;
    try {
      const content = (await fs.readFile(path.resolve(root, relative), "utf8")).slice(0, budget);
      parts.push(`\n--- ${relative} ---\n${content}`);
      budget -= content.length;
    } catch {
      // Arquivos opcionais de memória podem não existir.
    }
  }
  if (!parts.length) throw new Error("BIBBLE_AGENT_CONTEXT_MISSING");
  return parts.join("\n");
}
