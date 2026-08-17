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

export function resolvePhaseAgent(requestedAgent: string, title: string, markdown: string): string {
  if (requestedAgent === "context") return "scout";
  if (requestedAgent !== "dev") return requestedAgent;
  const normalized = `${title} ${markdown}`.toLocaleLowerCase("pt-BR");
  if (/(ui|ux|css|tailwind|layout|componente|frontend|visual|hover|skeleton|anima)/.test(normalized)) return "nova";
  if (/(api|server action|backend|rota|serviço|worker|fila|integração)/.test(normalized)) return "echo";
  return "echo";
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
