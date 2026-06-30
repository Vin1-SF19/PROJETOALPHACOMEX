/**
 * Helpers de CLIENTE para a tela de Conectores. Só faz fetch nas rotas
 * /api/onyx/connectors/* (que validam sessão + permissão no servidor).
 * NUNCA importa o client server (client.ts) — sem segredos no bundle.
 */

export type CCPairStatus = "ACTIVE" | "PAUSED" | "DELETING" | "INVALID";
export type IndexStatus =
  | "not_started" | "in_progress" | "success" | "canceled"
  | "failed" | "completed_with_errors" | "invalid";

export interface ConnectorIndexingStatus {
  cc_pair_id: number;
  name: string | null;
  source: string;
  access_type: string;
  cc_pair_status: CCPairStatus;
  in_progress: boolean;
  in_repeated_error_state: boolean;
  last_finished_status: IndexStatus | null;
  last_status: IndexStatus | null;
  last_success: string | null;
  is_editable: boolean;
  docs_indexed: number;
}

export interface ConnectorSourceSummary {
  total_connectors: number;
  active_connectors: number;
  public_connectors: number;
  total_docs_indexed: number;
}

export interface ConnectorIndexingGroup {
  source: string;
  summary: ConnectorSourceSummary;
  current_page: number;
  total_pages: number;
  indexing_statuses: ConnectorIndexingStatus[];
}

export interface OnyxCredential {
  id: number;
  name: string | null;
  source: string;
  admin_public: boolean;
  user_email?: string | null;
  time_created?: string;
}

export interface OnyxDocumentSet {
  id: number;
  name: string;
  description: string;
  is_public: boolean;
  cc_pair_descriptors?: Array<{ id: number; name: string | null }>;
}

export interface ConnectorsData {
  groups: ConnectorIndexingGroup[];
  credentials: OnyxCredential[];
  documentSets: OnyxDocumentSet[];
}

export interface CCPairDetail {
  id: number;
  name: string;
  status: CCPairStatus;
  num_docs_indexed: number;
  number_of_index_attempts: number;
  last_index_attempt_status: IndexStatus | null;
  access_type: string;
  indexing: boolean;
  last_indexed?: string | null;
  last_pruned?: string | null;
  creator_email?: string | null;
  latest_checkpoint_description?: string | null;
  connector: {
    id: number;
    name: string;
    source: string;
    input_type: string;
    connector_specific_config: Record<string, unknown>;
    refresh_freq: number | null;
    prune_freq: number | null;
    credential_ids?: number[];
  };
  credential: { id: number; name: string | null; source: string } | null;
}

// ─── Catálogo de conectores (galeria estilo Onyx) ─────────────────────────────

export interface SourceFieldDef {
  key: string;
  label: string;
  /** "json-file" = dropzone que lê o conteúdo de um arquivo .json (conta de serviço, etc.). */
  type: "text" | "password" | "number" | "boolean" | "json-file";
  placeholder?: string;
  help?: string;
  required?: boolean;
}

/**
 * Disponibilidade de cada conector NESTE servidor:
 *  - "ready":   dá pra criar agora pela UI (File/Web/NAS) — só preencher e criar.
 *  - "credential": funciona, mas exige uma credencial (token/API key/JSON) que
 *                  o usuário precisa obter no serviço de origem. A UI mostra o
 *                  formulário + guia de como conseguir.
 *  - "server": precisa de configuração no servidor Onyx (OAuth, app cadastrado).
 *              A UI explica e orienta a falar com o time técnico.
 */
export type Availability = "ready" | "credential" | "server";

export type ConnectorCategory =
  | "arquivos" | "google" | "microsoft" | "mensagens"
  | "docs" | "dev" | "suporte" | "vendas" | "armazenamento" | "outros";

export interface ConnectorMeta {
  id: string; // DocumentSource
  label: string;
  /** slug do simple-icons (ex: "siGmail"); null = usa o ícone lucide de fallback. */
  brandSlug: string | null;
  /** nome do ícone lucide de fallback (resolvido na UI). */
  fallbackIcon: string;
  /** cor da marca (#hex) para o tile do ícone. */
  color: string;
  category: ConnectorCategory;
  availability: Availability;
  input_type: "load_state" | "poll";
  /** frase curta no card. */
  short: string;
  /** descrição no painel de detalhe. */
  description: string;
  /** "O que você precisa ter" — pré-requisitos em linguagem simples. */
  requisitos: string[];
  /** "Como o conteúdo deve estar" — formato/condições esperadas. */
  formato?: string[];
  /** passo-a-passo para obter a credencial / configurar. */
  passos?: string[];
  configFields: SourceFieldDef[];
  credentialFields: SourceFieldDef[];
  isFileUpload?: boolean;
  defaultRefreshFreq?: number;
}

export const CONNECTOR_CATEGORIES: { id: ConnectorCategory; label: string }[] = [
  { id: "arquivos", label: "Arquivos & Web" },
  { id: "google", label: "Google" },
  { id: "microsoft", label: "Microsoft" },
  { id: "mensagens", label: "Mensagens" },
  { id: "docs", label: "Documentação & Wiki" },
  { id: "dev", label: "Desenvolvimento" },
  { id: "suporte", label: "Suporte & CRM" },
  { id: "vendas", label: "Vendas & Produto" },
  { id: "armazenamento", label: "Armazenamento" },
  { id: "outros", label: "Outros" },
];

/** Catálogo completo — espelha as fontes do Onyx. */
export const CONNECTOR_CATALOG: ConnectorMeta[] = [
  // ── Arquivos & Web (prontos) ──────────────────────────────────────────────
  {
    id: "file", label: "Upload de Arquivos", brandSlug: null, fallbackIcon: "FileUp", color: "#22d3ee",
    category: "arquivos", availability: "ready", input_type: "load_state",
    short: "PDFs, Word, Excel, textos",
    description: "Suba arquivos direto do seu computador para a base de conhecimento da IA. É o jeito mais rápido de ensinar algo à IAlpha.",
    requisitos: ["Os arquivos no seu computador", "Tamanho razoável por arquivo (evite arquivos gigantes)"],
    formato: [
      "Formatos aceitos: PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), texto (.txt), Markdown (.md), CSV e HTML.",
      "PDFs escaneados (imagem) podem não ser lidos — prefira PDFs com texto selecionável.",
      "Planilhas: deixe cabeçalhos claros na primeira linha; a IA lê o conteúdo das células.",
      "Um arquivo por assunto facilita a busca da IA.",
    ],
    configFields: [], credentialFields: [], isFileUpload: true,
  },
  {
    id: "web", label: "Site / Página Web", brandSlug: null, fallbackIcon: "Globe", color: "#38bdf8",
    category: "arquivos", availability: "ready", input_type: "load_state",
    short: "Indexa um site por URL",
    description: "A IA lê as páginas de um site público a partir de uma URL. Útil para documentação online, blogs e portais.",
    requisitos: ["A URL do site (precisa ser acessível publicamente)"],
    formato: [
      "O site precisa estar no ar e acessível sem login.",
      "Sites que dependem muito de JavaScript podem ser lidos parcialmente.",
      "Use 'recursive' para varrer o site inteiro a partir da URL, 'single' para só aquela página, 'sitemap' se o site tiver um sitemap.xml.",
    ],
    passos: ["Copie a URL base (ex: https://docs.suaempresa.com)", "Escolha o tipo de varredura", "Crie — a IA começa a ler as páginas"],
    configFields: [
      { key: "base_url", label: "URL do site", type: "text", placeholder: "https://exemplo.com", required: true },
      { key: "web_connector_type", label: "Tipo de varredura", type: "text", placeholder: "recursive | single | sitemap", help: "recursive (site todo), single (só a página), sitemap" },
    ],
    credentialFields: [], defaultRefreshFreq: 86400,
  },
  {
    id: "qnap_qts", label: "NAS QNAP", brandSlug: "siQnap", fallbackIcon: "Server", color: "#0C2E82",
    category: "armazenamento", availability: "credential", input_type: "poll",
    short: "Pasta de um NAS na rede",
    description: "Sincroniza uma pasta de um NAS QNAP da rede local. A IA passa a ler os arquivos daquela pasta automaticamente.",
    requisitos: ["IP e porta do NAS na rede", "Usuário e senha com acesso à pasta", "O NAS precisa estar acessível pelo servidor da IA"],
    formato: ["Coloque os documentos na pasta indicada do NAS.", "Mesmos formatos do upload de arquivos (PDF, Word, Excel, etc.)."],
    passos: ["Descubra o IP e a porta do QNAP (ex: 192.168.35.10:8080)", "Crie/escolha um usuário com permissão de leitura na pasta", "Informe o caminho da pasta dentro do NAS"],
    configFields: [{ key: "folder_path", label: "Caminho da pasta", type: "text", placeholder: "ONYX", required: true }],
    credentialFields: [
      { key: "qnap_host", label: "Host (IP)", type: "text", placeholder: "192.168.35.10", required: true },
      { key: "qnap_port", label: "Porta", type: "text", placeholder: "8080", required: true },
      { key: "qnap_use_https", label: "Usar HTTPS", type: "boolean" },
      { key: "qnap_username", label: "Usuário", type: "text", required: true },
      { key: "qnap_password", label: "Senha", type: "password", required: true },
    ],
    defaultRefreshFreq: 1800,
  },

  // ── Google ────────────────────────────────────────────────────────────────
  {
    id: "google_drive", label: "Google Drive", brandSlug: "siGoogledrive", fallbackIcon: "HardDrive", color: "#4285F4",
    category: "google", availability: "server", input_type: "poll",
    short: "Documentos do Drive",
    description: "Indexa documentos, planilhas e apresentações do Google Drive da empresa. Requer uma conta de serviço do Google configurada no servidor.",
    requisitos: ["Uma conta de serviço do Google Workspace (arquivo JSON de credencial)", "Acesso de administrador do Google Workspace", "Configuração feita no servidor da IA"],
    formato: ["Funciona com Google Docs, Planilhas, Apresentações e arquivos do Drive.", "A conta de serviço só enxerga o que for compartilhado com ela."],
    passos: [
      "No Google Cloud Console, crie uma conta de serviço e baixe o arquivo JSON.",
      "Ative a API do Google Drive para essa conta.",
      "Compartilhe as pastas do Drive com o e-mail da conta de serviço.",
      "Envie o JSON ao time técnico para cadastrar no servidor (OAuth/conta de serviço).",
    ],
    configFields: [
      { key: "include_shared_drives", label: "Incluir drives compartilhados", type: "boolean" },
      { key: "folder_paths", label: "Pastas (opcional, separadas por vírgula)", type: "text", placeholder: "Comercial, Financeiro" },
    ],
    credentialFields: [
      { key: "google_service_account_key_json", label: "JSON da conta de serviço", type: "json-file", required: true, help: "Arquivo .json baixado do Google Cloud (conta de serviço)" },
      { key: "google_primary_admin", label: "E-mail do administrador (Workspace)", type: "text", required: true, placeholder: "admin@suaempresa.com", help: "E-mail de um admin do Google Workspace que a conta de serviço vai impersonar (delegação de domínio)" },
    ],
    defaultRefreshFreq: 3600,
  },
  {
    id: "gmail", label: "Gmail", brandSlug: "siGmail", fallbackIcon: "Mail", color: "#EA4335",
    category: "google", availability: "server", input_type: "poll",
    short: "E-mails do Gmail",
    description: "Indexa e-mails de contas Gmail/Google Workspace. Útil para a IA consultar histórico de comunicações. Requer conta de serviço Google.",
    requisitos: ["Conta de serviço do Google Workspace com delegação de domínio", "Acesso de administrador do Workspace", "Configuração no servidor da IA"],
    formato: ["Indexa assunto, corpo e remetentes dos e-mails.", "Respeite a privacidade: só conecte caixas autorizadas."],
    passos: [
      "Crie a conta de serviço no Google Cloud e baixe o JSON.",
      "Ative a API do Gmail e a delegação de domínio (admin do Workspace).",
      "Autorize os escopos de leitura do Gmail.",
      "Entregue o JSON ao time técnico para cadastrar.",
    ],
    configFields: [],
    credentialFields: [
      { key: "google_service_account_key_json", label: "JSON da conta de serviço", type: "json-file", required: true, help: "Arquivo .json baixado do Google Cloud (conta de serviço)" },
      { key: "google_primary_admin", label: "E-mail do administrador (Workspace)", type: "text", required: true, placeholder: "admin@suaempresa.com", help: "E-mail de um admin do Google Workspace que a conta de serviço vai impersonar (delegação de domínio)" },
    ],
    defaultRefreshFreq: 3600,
  },
  {
    id: "google_sites", label: "Google Sites", brandSlug: "siGooglecloud", fallbackIcon: "Globe", color: "#4285F4",
    category: "google", availability: "credential", input_type: "load_state",
    short: "Páginas do Google Sites",
    description: "Indexa páginas publicadas no Google Sites.",
    requisitos: ["URL do site publicado", "Credencial do Google se o site for privado"],
    configFields: [{ key: "base_url", label: "URL do Google Site", type: "text", placeholder: "https://sites.google.com/...", required: true }],
    credentialFields: [],
    defaultRefreshFreq: 86400,
  },
  {
    id: "google_cloud_storage", label: "Google Cloud Storage", brandSlug: "siGooglecloud", fallbackIcon: "Cloud", color: "#4285F4",
    category: "armazenamento", availability: "credential", input_type: "poll",
    short: "Buckets do GCS",
    description: "Indexa arquivos de um bucket do Google Cloud Storage.",
    requisitos: ["Nome do bucket", "Chave de acesso (conta de serviço GCS)"],
    passos: ["Crie a conta de serviço com acesso ao bucket", "Baixe a chave JSON", "Informe o nome do bucket e a chave"],
    configFields: [{ key: "bucket_name", label: "Nome do bucket", type: "text", required: true }],
    credentialFields: [{ key: "access_key_id", label: "Access Key", type: "text", required: true }, { key: "secret_access_key", label: "Secret Key", type: "password", required: true }],
    defaultRefreshFreq: 3600,
  },

  // ── Microsoft ───────────────────────────────────────────────────────────────
  {
    id: "sharepoint", label: "SharePoint", brandSlug: null, fallbackIcon: "Building2", color: "#038387",
    category: "microsoft", availability: "server", input_type: "poll",
    short: "Sites e documentos do SharePoint",
    description: "Indexa bibliotecas de documentos do Microsoft SharePoint. Requer um app registrado no Azure AD.",
    requisitos: ["App registrado no Azure Active Directory", "Client ID, Client Secret e Tenant ID", "Permissões de leitura no SharePoint"],
    passos: [
      "No portal Azure, registre um aplicativo (App Registration).",
      "Gere um Client Secret e anote Client ID e Tenant ID.",
      "Conceda as permissões Sites.Read.All / Files.Read.All.",
      "Entregue as credenciais ao time técnico.",
    ],
    configFields: [{ key: "sites", label: "Sites (URLs, separados por vírgula)", type: "text", placeholder: "https://empresa.sharepoint.com/sites/..." }],
    credentialFields: [
      { key: "sp_client_id", label: "Client ID", type: "text", required: true },
      { key: "sp_client_secret", label: "Client Secret", type: "password", required: true },
      { key: "sp_directory_id", label: "Tenant (Directory) ID", type: "text", required: true },
    ],
    defaultRefreshFreq: 3600,
  },
  {
    id: "teams", label: "Microsoft Teams", brandSlug: null, fallbackIcon: "MessagesSquare", color: "#6264A7",
    category: "microsoft", availability: "server", input_type: "poll",
    short: "Mensagens e canais do Teams",
    description: "Indexa conversas de canais do Microsoft Teams. Requer app registrado no Azure AD.",
    requisitos: ["App registrado no Azure AD", "Client ID, Client Secret e Tenant ID", "Permissões de leitura do Teams"],
    passos: ["Registre o app no Azure", "Gere o Client Secret", "Conceda permissões ChannelMessage.Read.All", "Entregue ao time técnico"],
    configFields: [],
    credentialFields: [
      { key: "teams_client_id", label: "Client ID", type: "text", required: true },
      { key: "teams_client_secret", label: "Client Secret", type: "password", required: true },
      { key: "teams_directory_id", label: "Tenant ID", type: "text", required: true },
    ],
    defaultRefreshFreq: 3600,
  },

  // ── Mensagens ───────────────────────────────────────────────────────────────
  {
    id: "slack", label: "Slack", brandSlug: null, fallbackIcon: "Hash", color: "#4A154B",
    category: "mensagens", availability: "credential", input_type: "poll",
    short: "Canais e mensagens do Slack",
    description: "Indexa mensagens de canais do Slack para a IA consultar decisões e conversas. Requer um Bot Token do Slack.",
    requisitos: ["Um app do Slack com Bot Token (começa com xoxb-)", "O bot adicionado aos canais que você quer indexar"],
    formato: ["A IA lê o histórico dos canais onde o bot estiver.", "Canais privados precisam do bot convidado manualmente."],
    passos: [
      "Acesse api.slack.com/apps e crie um app.",
      "Em OAuth & Permissions, adicione os escopos channels:history, channels:read, users:read.",
      "Instale o app no workspace e copie o Bot User OAuth Token (xoxb-...).",
      "Convide o bot para os canais desejados (/invite @seu-bot).",
    ],
    configFields: [{ key: "channels", label: "Canais (opcional, separados por vírgula)", type: "text", placeholder: "geral, comercial" }],
    credentialFields: [{ key: "slack_bot_token", label: "Bot Token (xoxb-...)", type: "password", required: true }],
    defaultRefreshFreq: 3600,
  },
  {
    id: "discord", label: "Discord", brandSlug: "siDiscord", fallbackIcon: "MessageCircle", color: "#5865F2",
    category: "mensagens", availability: "credential", input_type: "poll",
    short: "Mensagens de servidores Discord",
    description: "Indexa mensagens de servidores do Discord. Requer um Bot Token do Discord.",
    requisitos: ["Um bot criado no Discord Developer Portal (Bot Token)", "O bot adicionado ao servidor com permissão de ler mensagens"],
    formato: ["A IA lê os canais de texto onde o bot tem acesso.", "Ative a intent 'Message Content' no portal do Discord."],
    passos: [
      "Acesse discord.com/developers, crie uma aplicação e um Bot.",
      "Em Bot, ative 'Message Content Intent' e copie o Token.",
      "Convide o bot ao servidor com permissão 'Read Messages/View Channels'.",
      "Cole o Bot Token aqui.",
    ],
    configFields: [{ key: "server_ids", label: "IDs dos servidores (opcional)", type: "text", placeholder: "separados por vírgula" }],
    credentialFields: [{ key: "discord_bot_token", label: "Bot Token", type: "password", required: true }],
    defaultRefreshFreq: 3600,
  },
  {
    id: "zulip", label: "Zulip", brandSlug: "siZulip", fallbackIcon: "MessageSquare", color: "#6492FE",
    category: "mensagens", availability: "credential", input_type: "poll",
    short: "Streams do Zulip",
    description: "Indexa mensagens de um servidor Zulip.",
    requisitos: ["URL do servidor Zulip", "E-mail e API key do bot"],
    configFields: [{ key: "realm_url", label: "URL do Zulip", type: "text", required: true }],
    credentialFields: [{ key: "zulip_email", label: "E-mail do bot", type: "text", required: true }, { key: "zulip_api_key", label: "API Key", type: "password", required: true }],
    defaultRefreshFreq: 3600,
  },

  // ── Documentação & Wiki ─────────────────────────────────────────────────────
  {
    id: "confluence", label: "Confluence", brandSlug: "siConfluence", fallbackIcon: "BookText", color: "#172B4D",
    category: "docs", availability: "credential", input_type: "poll",
    short: "Páginas do Confluence",
    description: "Indexa espaços e páginas do Atlassian Confluence (base de conhecimento da empresa).",
    requisitos: ["URL do Confluence", "E-mail e API Token do Atlassian"],
    passos: ["Em id.atlassian.com, gere um API Token", "Use seu e-mail Atlassian + o token", "Informe a URL do Confluence e o espaço (opcional)"],
    configFields: [
      { key: "wiki_base", label: "URL do Confluence", type: "text", placeholder: "https://empresa.atlassian.net/wiki", required: true },
      { key: "space", label: "Espaço (opcional)", type: "text", placeholder: "TI" },
    ],
    credentialFields: [{ key: "confluence_username", label: "E-mail Atlassian", type: "text", required: true }, { key: "confluence_access_token", label: "API Token", type: "password", required: true }],
    defaultRefreshFreq: 3600,
  },
  {
    id: "notion", label: "Notion", brandSlug: "siNotion", fallbackIcon: "BookOpen", color: "#000000",
    category: "docs", availability: "credential", input_type: "poll",
    short: "Páginas e bancos do Notion",
    description: "Indexa páginas e bancos de dados do Notion. Requer uma integração interna do Notion.",
    requisitos: ["Uma integração criada no Notion (Internal Integration Token)", "As páginas compartilhadas com a integração"],
    formato: ["A IA só lê páginas explicitamente compartilhadas com a integração.", "Compartilhe a página → Conexões → sua integração."],
    passos: [
      "Acesse notion.so/my-integrations e crie uma integração interna.",
      "Copie o 'Internal Integration Secret' (começa com secret_ ou ntn_).",
      "Em cada página/banco, clique em '...' → Conexões → adicione a integração.",
      "Cole o token aqui.",
    ],
    configFields: [{ key: "root_page_id", label: "ID da página raiz (opcional)", type: "text", help: "Deixe vazio para indexar tudo que foi compartilhado" }],
    credentialFields: [{ key: "notion_integration_token", label: "Integration Token", type: "password", required: true }],
    defaultRefreshFreq: 3600,
  },
  { id: "gitbook", label: "GitBook", brandSlug: "siGitbook", fallbackIcon: "BookText", color: "#BBDDE5", category: "docs", availability: "credential", input_type: "poll", short: "Documentação GitBook", description: "Indexa espaços do GitBook.", requisitos: ["API Token do GitBook", "ID do espaço"], configFields: [{ key: "space_id", label: "ID do espaço", type: "text", required: true }], credentialFields: [{ key: "gitbook_api_key", label: "API Token", type: "password", required: true }], defaultRefreshFreq: 86400 },
  { id: "bookstack", label: "BookStack", brandSlug: "siBookstack", fallbackIcon: "Library", color: "#0288D1", category: "docs", availability: "credential", input_type: "poll", short: "Wiki BookStack", description: "Indexa uma instância BookStack.", requisitos: ["URL do BookStack", "Token ID e Token Secret"], configFields: [{ key: "base_url", label: "URL", type: "text", required: true }], credentialFields: [{ key: "bookstack_token_id", label: "Token ID", type: "text", required: true }, { key: "bookstack_token_secret", label: "Token Secret", type: "password", required: true }], defaultRefreshFreq: 86400 },
  { id: "document360", label: "Document360", brandSlug: null, fallbackIcon: "FileText", color: "#f97316", category: "docs", availability: "credential", input_type: "poll", short: "Base Document360", description: "Indexa artigos do Document360.", requisitos: ["API Token do Document360"], configFields: [], credentialFields: [{ key: "document360_api_token", label: "API Token", type: "password", required: true }], defaultRefreshFreq: 86400 },
  { id: "guru", label: "Guru", brandSlug: null, fallbackIcon: "Lightbulb", color: "#FF512F", category: "docs", availability: "credential", input_type: "poll", short: "Cards do Guru", description: "Indexa cards de conhecimento do Guru.", requisitos: ["Usuário e API Token do Guru"], configFields: [], credentialFields: [{ key: "guru_user", label: "Usuário", type: "text", required: true }, { key: "guru_api_token", label: "API Token", type: "password", required: true }], defaultRefreshFreq: 86400 },
  { id: "slab", label: "Slab", brandSlug: null, fallbackIcon: "FileText", color: "#1B1F23", category: "docs", availability: "credential", input_type: "poll", short: "Posts do Slab", description: "Indexa posts do Slab.", requisitos: ["API Token do Slab"], configFields: [], credentialFields: [{ key: "slab_bot_token", label: "API Token", type: "password", required: true }], defaultRefreshFreq: 86400 },
  { id: "outline", label: "Outline", brandSlug: "siOutline", fallbackIcon: "BookOpen", color: "#0b1a2c", category: "docs", availability: "credential", input_type: "poll", short: "Wiki Outline", description: "Indexa documentos do Outline.", requisitos: ["URL do Outline", "API Token"], configFields: [{ key: "base_url", label: "URL", type: "text", required: true }], credentialFields: [{ key: "outline_api_token", label: "API Token", type: "password", required: true }], defaultRefreshFreq: 86400 },
  { id: "mediawiki", label: "MediaWiki", brandSlug: null, fallbackIcon: "BookText", color: "#36c", category: "docs", availability: "credential", input_type: "poll", short: "Wiki MediaWiki", description: "Indexa páginas de uma instância MediaWiki.", requisitos: ["URL da wiki"], configFields: [{ key: "hostname", label: "URL da wiki", type: "text", required: true }], credentialFields: [], defaultRefreshFreq: 86400 },
  { id: "wikipedia", label: "Wikipedia", brandSlug: "siWikipedia", fallbackIcon: "BookText", color: "#000000", category: "docs", availability: "ready", input_type: "load_state", short: "Artigos da Wikipedia", description: "Indexa artigos específicos da Wikipedia.", requisitos: ["Os títulos das páginas que quer indexar"], configFields: [{ key: "pages", label: "Páginas (separadas por vírgula)", type: "text", required: true }], credentialFields: [] },
  { id: "drupal_wiki", label: "Drupal Wiki", brandSlug: "siDrupal", fallbackIcon: "BookText", color: "#0678BE", category: "docs", availability: "credential", input_type: "poll", short: "Drupal Wiki", description: "Indexa um Drupal Wiki.", requisitos: ["URL e API Token"], configFields: [{ key: "base_url", label: "URL", type: "text", required: true }], credentialFields: [{ key: "drupal_wiki_api_token", label: "API Token", type: "password", required: true }], defaultRefreshFreq: 86400 },

  // ── Desenvolvimento ─────────────────────────────────────────────────────────
  {
    id: "github", label: "GitHub", brandSlug: "siGithub", fallbackIcon: "Github", color: "#181717",
    category: "dev", availability: "credential", input_type: "poll",
    short: "Repositórios e issues do GitHub",
    description: "Indexa código, README, issues e pull requests de repositórios do GitHub.",
    requisitos: ["Um Personal Access Token (PAT) do GitHub", "Nome do repositório (org/repo)"],
    passos: ["Em github.com/settings/tokens, gere um token (classic) com escopo 'repo'", "Informe org/repo e cole o token"],
    configFields: [{ key: "repo_owner", label: "Dono/Org", type: "text", placeholder: "minha-empresa", required: true }, { key: "repositories", label: "Repositório", type: "text", placeholder: "meu-repo", required: true }],
    credentialFields: [{ key: "github_access_token", label: "Personal Access Token", type: "password", required: true }],
    defaultRefreshFreq: 3600,
  },
  { id: "gitlab", label: "GitLab", brandSlug: "siGitlab", fallbackIcon: "GitBranch", color: "#FC6D26", category: "dev", availability: "credential", input_type: "poll", short: "Projetos do GitLab", description: "Indexa projetos, issues e wikis do GitLab.", requisitos: ["URL do GitLab", "Access Token"], configFields: [{ key: "project_owner", label: "Grupo/Owner", type: "text", required: true }, { key: "project_name", label: "Projeto", type: "text", required: true }], credentialFields: [{ key: "gitlab_url", label: "URL do GitLab", type: "text", placeholder: "https://gitlab.com" }, { key: "gitlab_access_token", label: "Access Token", type: "password", required: true }], defaultRefreshFreq: 3600 },
  { id: "bitbucket", label: "Bitbucket", brandSlug: "siBitbucket", fallbackIcon: "GitBranch", color: "#0052CC", category: "dev", availability: "credential", input_type: "poll", short: "Repositórios Bitbucket", description: "Indexa repositórios do Bitbucket.", requisitos: ["Workspace", "Usuário e App Password"], configFields: [{ key: "workspace", label: "Workspace", type: "text", required: true }], credentialFields: [{ key: "bitbucket_username", label: "Usuário", type: "text", required: true }, { key: "bitbucket_app_password", label: "App Password", type: "password", required: true }], defaultRefreshFreq: 3600 },
  { id: "jira", label: "Jira", brandSlug: "siJira", fallbackIcon: "SquareKanban", color: "#0052CC", category: "dev", availability: "credential", input_type: "poll", short: "Issues do Jira", description: "Indexa projetos e issues do Jira.", requisitos: ["URL do Jira", "E-mail e API Token do Atlassian"], passos: ["Gere um API Token em id.atlassian.com", "Use e-mail + token", "Informe a URL do Jira"], configFields: [{ key: "jira_base_url", label: "URL do Jira", type: "text", placeholder: "https://empresa.atlassian.net", required: true }, { key: "project_key", label: "Projeto (opcional)", type: "text" }], credentialFields: [{ key: "jira_user_email", label: "E-mail Atlassian", type: "text", required: true }, { key: "jira_api_token", label: "API Token", type: "password", required: true }], defaultRefreshFreq: 3600 },
  { id: "linear", label: "Linear", brandSlug: "siLinear", fallbackIcon: "SquareKanban", color: "#5E6AD2", category: "dev", availability: "credential", input_type: "poll", short: "Issues do Linear", description: "Indexa issues e projetos do Linear.", requisitos: ["API Key do Linear"], configFields: [], credentialFields: [{ key: "linear_api_key", label: "API Key", type: "password", required: true }], defaultRefreshFreq: 3600 },

  // ── Suporte & CRM ───────────────────────────────────────────────────────────
  { id: "zendesk", label: "Zendesk", brandSlug: "siZendesk", fallbackIcon: "LifeBuoy", color: "#03363D", category: "suporte", availability: "credential", input_type: "poll", short: "Tickets e artigos Zendesk", description: "Indexa artigos da central de ajuda e tickets do Zendesk.", requisitos: ["Subdomínio Zendesk", "E-mail e API Token"], configFields: [{ key: "subdomain", label: "Subdomínio", type: "text", placeholder: "minhaempresa", required: true }], credentialFields: [{ key: "zendesk_email", label: "E-mail", type: "text", required: true }, { key: "zendesk_token", label: "API Token", type: "password", required: true }], defaultRefreshFreq: 3600 },
  { id: "freshdesk", label: "Freshdesk", brandSlug: null, fallbackIcon: "LifeBuoy", color: "#25c16f", category: "suporte", availability: "credential", input_type: "poll", short: "Tickets do Freshdesk", description: "Indexa tickets e artigos do Freshdesk.", requisitos: ["Domínio Freshdesk", "API Key"], configFields: [{ key: "domain", label: "Domínio", type: "text", required: true }], credentialFields: [{ key: "freshdesk_api_key", label: "API Key", type: "password", required: true }], defaultRefreshFreq: 3600 },
  { id: "discourse", label: "Discourse", brandSlug: "siDiscourse", fallbackIcon: "MessagesSquare", color: "#000000", category: "suporte", availability: "credential", input_type: "poll", short: "Fórum Discourse", description: "Indexa tópicos de um fórum Discourse.", requisitos: ["URL do fórum", "API Key e usuário"], configFields: [{ key: "base_url", label: "URL", type: "text", required: true }], credentialFields: [{ key: "discourse_api_key", label: "API Key", type: "password", required: true }, { key: "discourse_api_username", label: "Usuário", type: "text", required: true }], defaultRefreshFreq: 3600 },
  { id: "salesforce", label: "Salesforce", brandSlug: null, fallbackIcon: "Cloud", color: "#00A1E0", category: "suporte", availability: "server", input_type: "poll", short: "Registros do Salesforce", description: "Indexa registros (contas, oportunidades, etc.) do Salesforce. Requer app conectado.", requisitos: ["App conectado no Salesforce", "Client ID, Secret, usuário e token de segurança"], passos: ["Crie um Connected App no Salesforce", "Anote Consumer Key/Secret", "Entregue ao time técnico"], configFields: [], credentialFields: [{ key: "sf_client_id", label: "Consumer Key", type: "text", required: true }, { key: "sf_client_secret", label: "Consumer Secret", type: "password", required: true }, { key: "sf_username", label: "Usuário", type: "text", required: true }, { key: "sf_password", label: "Senha+Token", type: "password", required: true }], defaultRefreshFreq: 3600 },
  { id: "hubspot", label: "HubSpot", brandSlug: "siHubspot", fallbackIcon: "Contact", color: "#FF7A59", category: "suporte", availability: "credential", input_type: "poll", short: "CRM do HubSpot", description: "Indexa contatos, negócios e tickets do HubSpot.", requisitos: ["Private App Token do HubSpot"], passos: ["Em Configurações → Integrações → Apps privados, crie um app", "Copie o token de acesso"], configFields: [], credentialFields: [{ key: "hubspot_access_token", label: "Private App Token", type: "password", required: true }], defaultRefreshFreq: 3600 },
  { id: "gong", label: "Gong", brandSlug: null, fallbackIcon: "Phone", color: "#8039DF", category: "suporte", availability: "credential", input_type: "poll", short: "Chamadas do Gong", description: "Indexa transcrições de chamadas do Gong.", requisitos: ["Access Key e Secret do Gong"], configFields: [], credentialFields: [{ key: "gong_access_key", label: "Access Key", type: "text", required: true }, { key: "gong_access_key_secret", label: "Secret", type: "password", required: true }], defaultRefreshFreq: 3600 },

  // ── Vendas & Produto ────────────────────────────────────────────────────────
  { id: "airtable", label: "Airtable", brandSlug: "siAirtable", fallbackIcon: "Table", color: "#18BFFF", category: "vendas", availability: "credential", input_type: "load_state", short: "Bases do Airtable", description: "Indexa registros de uma base do Airtable.", requisitos: ["Personal Access Token", "Base ID e Table"], configFields: [{ key: "base_id", label: "Base ID", type: "text", required: true }, { key: "table_name_or_id", label: "Tabela", type: "text", required: true }], credentialFields: [{ key: "airtable_access_token", label: "Access Token", type: "password", required: true }] },
  { id: "asana", label: "Asana", brandSlug: "siAsana", fallbackIcon: "CircleCheck", color: "#F06A6A", category: "vendas", availability: "credential", input_type: "poll", short: "Tarefas do Asana", description: "Indexa projetos e tarefas do Asana.", requisitos: ["Personal Access Token do Asana", "Workspace ID"], configFields: [{ key: "asana_workspace_id", label: "Workspace ID", type: "text", required: true }], credentialFields: [{ key: "asana_api_token_secret", label: "Access Token", type: "password", required: true }], defaultRefreshFreq: 3600 },
  { id: "clickup", label: "ClickUp", brandSlug: "siClickup", fallbackIcon: "CircleCheck", color: "#7B68EE", category: "vendas", availability: "credential", input_type: "poll", short: "Tarefas do ClickUp", description: "Indexa tarefas e documentos do ClickUp.", requisitos: ["API Token do ClickUp", "Team ID"], configFields: [{ key: "team_id", label: "Team ID", type: "text", required: true }], credentialFields: [{ key: "clickup_api_token", label: "API Token", type: "password", required: true }], defaultRefreshFreq: 3600 },
  { id: "productboard", label: "Productboard", brandSlug: null, fallbackIcon: "LayoutDashboard", color: "#FF2638", category: "vendas", availability: "credential", input_type: "poll", short: "Feedback do Productboard", description: "Indexa notas e features do Productboard.", requisitos: ["API Token do Productboard"], configFields: [], credentialFields: [{ key: "productboard_access_token", label: "API Token", type: "password", required: true }], defaultRefreshFreq: 3600 },
  { id: "coda", label: "Coda", brandSlug: "siCoda", fallbackIcon: "FileText", color: "#F46A54", category: "vendas", availability: "credential", input_type: "poll", short: "Docs do Coda", description: "Indexa documentos do Coda.", requisitos: ["API Token do Coda"], configFields: [{ key: "doc_id", label: "Doc ID (opcional)", type: "text" }], credentialFields: [{ key: "coda_api_key", label: "API Token", type: "password", required: true }], defaultRefreshFreq: 3600 },

  // ── Armazenamento ───────────────────────────────────────────────────────────
  { id: "s3", label: "Amazon S3", brandSlug: null, fallbackIcon: "Database", color: "#569A31", category: "armazenamento", availability: "credential", input_type: "poll", short: "Buckets S3", description: "Indexa arquivos de um bucket Amazon S3.", requisitos: ["Nome do bucket", "Access Key e Secret Key da AWS"], configFields: [{ key: "bucket_name", label: "Bucket", type: "text", required: true }, { key: "prefix", label: "Prefixo (pasta)", type: "text" }], credentialFields: [{ key: "aws_access_key_id", label: "Access Key", type: "text", required: true }, { key: "aws_secret_access_key", label: "Secret Key", type: "password", required: true }], defaultRefreshFreq: 3600 },
  { id: "r2", label: "Cloudflare R2", brandSlug: "siCloudflare", fallbackIcon: "Database", color: "#F38020", category: "armazenamento", availability: "credential", input_type: "poll", short: "Buckets R2", description: "Indexa arquivos de um bucket Cloudflare R2.", requisitos: ["Bucket", "Access Key, Secret e Account ID"], configFields: [{ key: "bucket_name", label: "Bucket", type: "text", required: true }], credentialFields: [{ key: "r2_access_key_id", label: "Access Key", type: "text", required: true }, { key: "r2_secret_access_key", label: "Secret Key", type: "password", required: true }, { key: "account_id", label: "Account ID", type: "text", required: true }], defaultRefreshFreq: 3600 },
  { id: "oci_storage", label: "Oracle Cloud Storage", brandSlug: null, fallbackIcon: "Database", color: "#F80000", category: "armazenamento", availability: "credential", input_type: "poll", short: "Buckets OCI", description: "Indexa arquivos do Oracle Cloud Object Storage.", requisitos: ["Namespace, bucket e credenciais OCI"], configFields: [{ key: "bucket_name", label: "Bucket", type: "text", required: true }, { key: "namespace", label: "Namespace", type: "text", required: true }], credentialFields: [{ key: "access_key_id", label: "Access Key", type: "text", required: true }, { key: "secret_access_key", label: "Secret", type: "password", required: true }], defaultRefreshFreq: 3600 },
  { id: "dropbox", label: "Dropbox", brandSlug: "siDropbox", fallbackIcon: "Box", color: "#0061FF", category: "armazenamento", availability: "credential", input_type: "poll", short: "Arquivos do Dropbox", description: "Indexa arquivos de uma conta Dropbox.", requisitos: ["Access Token do Dropbox"], passos: ["Crie um app em dropbox.com/developers", "Gere um Access Token", "Cole aqui"], configFields: [], credentialFields: [{ key: "dropbox_access_token", label: "Access Token", type: "password", required: true }], defaultRefreshFreq: 3600 },
  { id: "egnyte", label: "Egnyte", brandSlug: "siEgnyte", fallbackIcon: "Box", color: "#00968F", category: "armazenamento", availability: "credential", input_type: "poll", short: "Arquivos do Egnyte", description: "Indexa arquivos do Egnyte.", requisitos: ["Domínio e Access Token"], configFields: [{ key: "domain", label: "Domínio", type: "text", required: true }], credentialFields: [{ key: "egnyte_access_token", label: "Access Token", type: "password", required: true }], defaultRefreshFreq: 3600 },

  // ── Outros ──────────────────────────────────────────────────────────────────
  { id: "imap", label: "E-mail (IMAP)", brandSlug: null, fallbackIcon: "Mail", color: "#64748b", category: "outros", availability: "credential", input_type: "poll", short: "Caixa de e-mail IMAP", description: "Indexa e-mails de qualquer caixa via IMAP (Outlook, Zoho, etc.).", requisitos: ["Servidor IMAP, porta", "E-mail e senha (ou senha de app)"], configFields: [{ key: "host", label: "Servidor IMAP", type: "text", placeholder: "imap.gmail.com", required: true }, { key: "port", label: "Porta", type: "number", placeholder: "993" }], credentialFields: [{ key: "imap_username", label: "E-mail", type: "text", required: true }, { key: "imap_password", label: "Senha", type: "password", required: true }], defaultRefreshFreq: 3600 },
  { id: "fireflies", label: "Fireflies", brandSlug: null, fallbackIcon: "Mic", color: "#1F2A37", category: "outros", availability: "credential", input_type: "poll", short: "Transcrições Fireflies", description: "Indexa transcrições de reuniões do Fireflies.ai.", requisitos: ["API Key do Fireflies"], configFields: [], credentialFields: [{ key: "fireflies_api_key", label: "API Key", type: "password", required: true }], defaultRefreshFreq: 3600 },
  { id: "highspot", label: "Highspot", brandSlug: null, fallbackIcon: "Presentation", color: "#FF6900", category: "outros", availability: "credential", input_type: "poll", short: "Conteúdo Highspot", description: "Indexa conteúdo do Highspot.", requisitos: ["Key e Secret do Highspot"], configFields: [], credentialFields: [{ key: "highspot_key", label: "Key", type: "text", required: true }, { key: "highspot_secret", label: "Secret", type: "password", required: true }], defaultRefreshFreq: 3600 },
  { id: "loopio", label: "Loopio", brandSlug: null, fallbackIcon: "FileText", color: "#00B5A5", category: "outros", availability: "credential", input_type: "poll", short: "Biblioteca Loopio", description: "Indexa a biblioteca do Loopio.", requisitos: ["Client ID e Secret do Loopio"], configFields: [], credentialFields: [{ key: "loopio_client_id", label: "Client ID", type: "text", required: true }, { key: "loopio_client_token", label: "Client Secret", type: "password", required: true }], defaultRefreshFreq: 86400 },
  { id: "xenforo", label: "XenForo", brandSlug: null, fallbackIcon: "MessagesSquare", color: "#0c0c0d", category: "outros", availability: "credential", input_type: "poll", short: "Fórum XenForo", description: "Indexa um fórum XenForo.", requisitos: ["URL do fórum"], configFields: [{ key: "base_url", label: "URL", type: "text", required: true }], credentialFields: [], defaultRefreshFreq: 86400 },
  { id: "axero", label: "Axero", brandSlug: null, fallbackIcon: "Building2", color: "#1976D2", category: "outros", availability: "credential", input_type: "poll", short: "Intranet Axero", description: "Indexa conteúdo da intranet Axero.", requisitos: ["URL e API Token"], configFields: [{ key: "base_url", label: "URL", type: "text", required: true }], credentialFields: [{ key: "axero_api_token", label: "API Token", type: "password", required: true }], defaultRefreshFreq: 86400 },
  { id: "testrail", label: "TestRail", brandSlug: "siTestrail", fallbackIcon: "ClipboardCheck", color: "#65C179", category: "outros", availability: "credential", input_type: "poll", short: "Casos de teste TestRail", description: "Indexa casos de teste do TestRail.", requisitos: ["URL, e-mail e API Key"], configFields: [{ key: "base_url", label: "URL", type: "text", required: true }], credentialFields: [{ key: "testrail_email", label: "E-mail", type: "text", required: true }, { key: "testrail_api_key", label: "API Key", type: "password", required: true }], defaultRefreshFreq: 86400 },
  { id: "ingestion_api", label: "API de Ingestão", brandSlug: null, fallbackIcon: "Webhook", color: "#22d3ee", category: "outros", availability: "server", input_type: "poll", short: "Envio programático", description: "Permite enviar documentos por API para a base. Requer configuração técnica.", requisitos: ["Integração técnica via API do Onyx"], configFields: [], credentialFields: [] },
];

/** Compat: lista usada pela versão antiga (mantida para não quebrar imports). */
export const CREATABLE_SOURCES = CONNECTOR_CATALOG.filter((c) => c.availability !== "server");

/** Selo de disponibilidade → rótulo + cor. */
export function availabilityMeta(a: Availability): { label: string; cls: string } {
  if (a === "ready") return { label: "Disponível", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
  if (a === "credential") return { label: "Requer credencial", cls: "text-sky-400 bg-sky-500/10 border-sky-500/20" };
  return { label: "Config. no servidor", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
}

// ─── Rótulos amigáveis de fonte ───────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  file: "Arquivos",
  web: "Web / Site",
  qnap_qts: "NAS QNAP",
  google_drive: "Google Drive",
  slack: "Slack",
  confluence: "Confluence",
  notion: "Notion",
  github: "GitHub",
  ingestion_api: "API de Ingestão",
  user_file: "Arquivo de Usuário",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Status → cor/rótulo ──────────────────────────────────────────────────────

export function statusMeta(s: ConnectorIndexingStatus): { label: string; color: string; dot: string } {
  if (s.cc_pair_status === "PAUSED") return { label: "Pausado", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", dot: "bg-amber-400" };
  if (s.cc_pair_status === "DELETING") return { label: "Excluindo", color: "text-rose-400 bg-rose-500/10 border-rose-500/20", dot: "bg-rose-400" };
  if (s.in_progress) return { label: "Indexando…", color: "text-blue-400 bg-blue-500/10 border-blue-500/20", dot: "bg-blue-400 animate-pulse" };
  if (s.in_repeated_error_state || s.last_finished_status === "failed") return { label: "Erro", color: "text-rose-400 bg-rose-500/10 border-rose-500/20", dot: "bg-rose-400" };
  if (s.last_finished_status === "completed_with_errors") return { label: "Com avisos", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", dot: "bg-amber-400" };
  if (s.last_finished_status === "success") return { label: "Sincronizado", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400" };
  return { label: "Aguardando", color: "text-slate-400 bg-slate-500/10 border-slate-500/20", dot: "bg-slate-400" };
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "Nunca";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Agora mesmo";
  if (min < 60) return `${min} min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const dias = Math.floor(h / 24);
  if (dias < 30) return `${dias}d atrás`;
  return d.toLocaleDateString("pt-BR");
}

// ─── Chamadas à API ───────────────────────────────────────────────────────────

async function jsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

export async function fetchConnectors(): Promise<ConnectorsData> {
  return jsonOrThrow(await fetch("/api/onyx/connectors", { cache: "no-store" }));
}

export async function fetchCCPair(ccPairId: number): Promise<CCPairDetail> {
  return jsonOrThrow(await fetch(`/api/onyx/connectors/${ccPairId}`, { cache: "no-store" }));
}

export async function connectorAction(
  ccPairId: number,
  body: { action: "pause" | "resume" | "rename" | "reindex"; name?: string; fromBeginning?: boolean },
): Promise<void> {
  await jsonOrThrow(
    await fetch(`/api/onyx/connectors/${ccPairId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function deleteConnector(ccPairId: number): Promise<void> {
  await jsonOrThrow(await fetch(`/api/onyx/connectors/${ccPairId}`, { method: "DELETE" }));
}

export interface CreateConnectorPayload {
  name: string;
  source: string;
  input_type: string;
  connector_specific_config: Record<string, unknown>;
  credential_json?: Record<string, unknown>;
  credential_id?: number;
  refresh_freq?: number | null;
  run_now?: boolean;
}

export async function createConnector(payload: CreateConnectorPayload): Promise<void> {
  await jsonOrThrow(
    await fetch("/api/onyx/connectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

export async function uploadConnectorFiles(files: File[]): Promise<{ file_paths: string[]; file_names: string[] }> {
  const form = new FormData();
  for (const f of files) form.append("files", f);
  return jsonOrThrow(await fetch("/api/onyx/connectors/upload", { method: "POST", body: form }));
}

export async function deleteCredential(id: number): Promise<void> {
  await jsonOrThrow(await fetch(`/api/onyx/connectors/credentials?id=${id}`, { method: "DELETE" }));
}

export async function createDocumentSet(body: {
  name: string; description?: string; cc_pair_ids: number[]; is_public?: boolean;
}): Promise<void> {
  await jsonOrThrow(
    await fetch("/api/onyx/connectors/document-sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function deleteDocumentSet(id: number): Promise<void> {
  await jsonOrThrow(await fetch(`/api/onyx/connectors/document-sets?id=${id}`, { method: "DELETE" }));
}
