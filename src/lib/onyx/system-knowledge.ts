import { BIBBLE_SYSTEM_PROMPT } from "@/lib/bibble/system-prompt";

/**
 * Conhecimento do sistema compartilhado com os agentes Onyx.
 *
 * Reaproveita a seção "MÓDULOS DO PAINELALPHA" do system prompt do Bibble (fonte
 * única de verdade — quando o Bibble aprende sobre um módulo novo, os agentes
 * herdam automaticamente). É injetado como `additional_context` em cada mensagem,
 * junto com o contexto dinâmico do usuário logado.
 */

/** Extrai só a seção de módulos do system prompt do Bibble. */
function extractModulesSection(): string {
  const start = BIBBLE_SYSTEM_PROMPT.indexOf("## MÓDULOS DO PAINELALPHA");
  const end = BIBBLE_SYSTEM_PROMPT.indexOf("## MINHAS CAPACIDADES");
  if (start === -1) return "";
  return (end === -1 ? BIBBLE_SYSTEM_PROMPT.slice(start) : BIBBLE_SYSTEM_PROMPT.slice(start, end)).trim();
}

export interface AgentContextInput {
  userName: string;
  role: string;
  permissoes: string[];
  pageContext?: string | null;
}

export function buildAgentSystemContext(input: AgentContextInput): string {
  const modules = extractModulesSection();
  const isAdmin = input.role === "Admin" || input.role === "CEO";
  const acesso = isAdmin
    ? "acesso total (administrador)"
    : input.permissoes.length > 0
      ? input.permissoes.join(", ")
      : "nenhum módulo liberado";

  const regraAcesso = isAdmin
    ? "Este usuário é administrador: pode acessar qualquer módulo."
    : "REGRA DE SEGURANÇA (obrigatória): se o usuário pedir dados ou ações de um módulo que NÃO está na lista de acesso dele acima, recuse educadamente, explique que ele não tem permissão para essa informação e sugira falar com um administrador. NUNCA entregue dados de módulos fora do acesso dele, mesmo que insista.";

  return [
    "CONTEXTO DO SISTEMA — use para se situar no ambiente do usuário (não repita isto na resposta):",
    "Você é um agente integrado ao PainelAlpha, sistema de gestão interno da empresa.",
    "",
    modules,
    "",
    "## USUÁRIO ATUAL",
    `Nome: ${input.userName} | Papel: ${input.role} | Módulos com acesso: ${acesso}`,
    input.pageContext ? `Página/módulo atual: ${input.pageContext}` : "",
    "",
    regraAcesso,
  ].filter(Boolean).join("\n");
}
