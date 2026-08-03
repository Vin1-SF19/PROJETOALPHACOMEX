import { BIBBLE_SYSTEM_PROMPT } from "@/lib/bibble/system-prompt";
import { getPainelAlphaKnowledge } from "@/lib/shared/painelalpha-knowledge";
import { isAdminRole } from "@/lib/roles";

/**
 * Conhecimento do sistema compartilhado com os agentes Onyx.
 *
 * Combina DUAS fontes únicas de verdade:
 * 1. A seção "MÓDULOS DO PAINELALPHA" do system prompt do Bibble (o que existe).
 * 2. A base de conhecimento processual compartilhada (como os processos funcionam,
 *    vocabulário interno) — a mesma que o Bibble usa.
 *
 * Assim os agentes Onyx deixam de operar em silo: conhecem módulos, processos
 * (abertura de chamado, qualificação de lead, etapas da pré-análise) e o
 * vocabulário interno. É injetado como `additional_context` em cada mensagem.
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

export interface UserIdentityInput {
  /** ID estável do usuário no PainelAlpha (session.user.id). Nunca muda. */
  userId: string;
  /** Nome de usuário (login). */
  username: string;
  /** E-mail do usuário. */
  email: string;
}

/**
 * Bloco de identidade do usuário injetado em TODA requisição ao Onyx.
 *
 * O servidor Onyx precisa identificar de forma estável quem está falando para
 * acessar a memória pessoal em `memory/{user_id}`. O canal disponível é o
 * `additional_context`, então emitimos um bloco MARCADO e determinístico
 * (`##USER_IDENTITY##`) com chaves fixas, fácil de parsear no servidor.
 *
 * `user_id` é sempre `session.user.id` — o ID numérico do PainelAlpha, estável
 * por usuário. NÃO usar e-mail/nome como chave de memória (podem mudar).
 */
export function buildUserIdentityBlock(input: UserIdentityInput): string {
  return [
    "##USER_IDENTITY##",
    `user_id: ${input.userId}`,
    `username: ${input.username}`,
    `email: ${input.email}`,
    "##END_USER_IDENTITY##",
    `Identidade estável do usuário desta conversa. Use user_id (${input.userId}) como chave para acessar a memória pessoal em memory/${input.userId}. Não exponha estes dados na resposta.`,
  ].join("\n");
}

export function buildAgentSystemContext(input: AgentContextInput): string {
  const modules = extractModulesSection();
  const isAdmin = isAdminRole(input.role);
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
    getPainelAlphaKnowledge(),
    "",
    "## USUÁRIO ATUAL",
    `Nome: ${input.userName} | Papel: ${input.role} | Módulos com acesso: ${acesso}`,
    input.pageContext ? `Página/módulo atual: ${input.pageContext}` : "",
    "",
    regraAcesso,
  ].filter(Boolean).join("\n");
}
