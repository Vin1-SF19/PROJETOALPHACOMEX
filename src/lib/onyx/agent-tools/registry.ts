// Catálogo das ferramentas do PainelAlpha expostas aos agentes Onyx.
// Os agentes rodam no servidor Onyx e chamam estes endpoints via HTTP (custom
// tools / OpenAPI). A autenticação é por SEGREDO compartilhado (não há sessão),
// e ações de escrita só rodam se houver um usuário de serviço configurado.

export interface AgentToolDef {
  /** Nome do case correspondente no tool-executor do Bibble. */
  executorName: string;
  /** true = a ação grava algo (chamado, ficha, arquivo). Exige usuário de serviço. */
  write: boolean;
  /** true = mexe no sistema de arquivos do servidor ("acesso ao computador"). */
  fs: boolean;
  /** Descrição em português (vai para o schema OpenAPI / o agente). */
  description: string;
  /** Parâmetros esperados no corpo JSON (nome → descrição). */
  params: Record<string, string>;
}

export const AGENT_TOOLS: Record<string, AgentToolDef> = {
  // ── Dados / sistema ──────────────────────────────────────────────
  buscar_empresa: {
    executorName: "buscar_empresa",
    write: false, fs: false,
    description: "Consulta dados de uma empresa por CNPJ (Receita Federal + RADAR).",
    params: { cnpj: "CNPJ da empresa (com ou sem máscara)." },
  },
  listar_clientes: {
    executorName: "listar_clientes",
    write: false, fs: false,
    description: "Busca clientes cadastrados por nome ou CNPJ.",
    params: { busca: "Texto de busca: nome ou CNPJ do cliente." },
  },
  consultar_chamados: {
    executorName: "consultar_chamados",
    write: false, fs: false,
    description: "Lista chamados de suporte registrados.",
    params: { status: "Filtro opcional de status (ABERTO, FECHADO...)." },
  },
  abrir_chamado: {
    executorName: "abrir_chamado",
    write: true, fs: false,
    description: "Abre um chamado de suporte no sistema.",
    params: {
      titulo: "Título resumido do problema.",
      descricao: "Descrição detalhada.",
      prioridade: "BAIXA, MEDIA, ALTA ou URGENTE.",
    },
  },
  gerar_ficha: {
    executorName: "gerar_ficha_pre_analise",
    write: true, fs: false,
    description: "Gera a ficha de reunião (PDF) de um CNPJ e devolve o link.",
    params: { cnpj: "CNPJ da empresa." },
  },

  // ── Acesso ao computador (sistema de arquivos do servidor) ───────
  ler_arquivo: {
    executorName: "ler_arquivo",
    write: false, fs: true,
    description: "Lê um arquivo ou lista o conteúdo de uma pasta.",
    params: { caminho: "Caminho do arquivo ou pasta." },
  },
  criar_pasta: {
    executorName: "criar_pasta",
    write: true, fs: true,
    description: "Cria uma pasta (e subpastas necessárias).",
    params: { caminho: "Caminho da pasta a criar." },
  },
  criar_arquivo: {
    executorName: "criar_arquivo",
    write: true, fs: true,
    description: "Cria um novo arquivo com conteúdo.",
    params: { caminho: "Caminho do arquivo.", conteudo: "Conteúdo do arquivo." },
  },
  escrever_arquivo: {
    executorName: "escrever_arquivo",
    write: true, fs: true,
    description: "Escreve ou sobrescreve um arquivo existente.",
    params: { caminho: "Caminho do arquivo.", conteudo: "Novo conteúdo." },
  },
  apagar: {
    executorName: "apagar",
    write: true, fs: true,
    description: "Apaga um arquivo ou pasta.",
    params: { caminho: "Caminho a apagar.", recursivo: "true para apagar pasta com conteúdo." },
  },
  mover_arquivo: {
    executorName: "mover_arquivo",
    write: true, fs: true,
    description: "Move ou renomeia um arquivo/pasta.",
    params: { origem: "Caminho de origem.", destino: "Caminho de destino." },
  },
  copiar_arquivo: {
    executorName: "copiar_arquivo",
    write: true, fs: true,
    description: "Copia um arquivo para outro local.",
    params: { origem: "Caminho de origem.", destino: "Caminho de destino." },
  },
};

export function getAgentTool(name: string): AgentToolDef | null {
  return AGENT_TOOLS[name] ?? null;
}
