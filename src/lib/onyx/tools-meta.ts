// Metadados das skills do Onyx — usado tanto na UI (modal) quanto nas rotas.
// Identificadores estáveis pelo campo `name` da tool no Onyx.

/** Skill de geração de imagem — restrita a Admin/CEO por enquanto (custo). */
export const IMAGE_GEN_TOOL_NAME = "generate_image";

/** Skills ativadas por padrão ao criar um agente novo. */
export const DEFAULT_AGENT_TOOL_NAMES = ["internal_search", "web_search", "open_url"];

/** Descrições em português, para o usuário comum entender cada skill. */
export const TOOL_DESCRIPTIONS_PT: Record<string, string> = {
  internal_search: "Busca em documentos e bases de conhecimento conectadas ao sistema.",
  web_search: "Pesquisa informações atualizadas na internet.",
  open_url: "Abre um link e lê o conteúdo da página informada.",
  generate_image: "Gera imagens a partir de uma descrição em texto.",
  python: "Executa código Python para cálculos e análises.",
  coding_agent: "Agente especializado em programação e tarefas de código.",
};

/** Descrição amigável de uma skill (PT), com fallback para a descrição da API. */
export function toolDescriptionPT(name: string, fallback?: string | null): string {
  return TOOL_DESCRIPTIONS_PT[name] ?? fallback ?? "Skill do Onyx.";
}
