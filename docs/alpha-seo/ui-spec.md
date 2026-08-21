# Alpha SEO — especificação UX/UI

> Direção Iris para implementação por Nova. Este documento traduz a paridade funcional do OpenSEO para a stack, o tema e os padrões do Painel Alpha. Não altera contratos de domínio, schema ou requisitos da story.

## 1. Fontes e limites

Esta direção foi baseada em:

- `docs/stories/story-alpha-seo-paridade-open-seo.md` e Constituição AIOX;
- UI fonte em `open-seo-main/src/client/features/**`, rotas e navegação;
- `AlphaCRM/CRMLayoutClient.tsx`, `AlphaBlueprint`, `components/ui`, `temas.ts`;
- memórias de design, padrões e componentes do Painel Alpha;
- Tailwind, shadcn/Radix, Lucide, Framer Motion e Recharts já adotados.

Regras invioláveis:

- fundo-base `#020617`; nenhum novo sistema de cor;
- toda ênfase primária deriva de `visual.accent` via `getTema()`;
- cards em `bg-slate-900/30` ou `/40`, bordas `border-white/5`; superfícies densas podem usar `bg-slate-950/70 backdrop-blur-2xl`;
- sem DaisyUI, CSS Modules, CSS-in-JS, canvas ou WebGL;
- sem loops visuais contínuos: tabs globais do painel podem manter o módulo montado mesmo oculto;
- status nunca depende apenas de cor: sempre ícone + texto;
- cada componente novo deve permanecer abaixo de 300 linhas; dividir por responsabilidade antes desse limite;
- textos de billing, checkout, Discord e self-hosting do OpenSEO não entram. Créditos e provedores são capacidades internas do Alpha.

## 2. Três direções visuais

### Opção A — Observatório Operacional (recomendada)

Uma cabine de análise escura, calma e precisa. Sidebar translúcida como o AlphaCRM, superfícies compactas e estáveis para dados, brilho radial estático apenas nos vazios da página. Métricas usam números tabulares; gráficos aparecem como instrumentos, não decoração. O accent dinâmico identifica seleção, foco, tendência principal e ação.

**Força:** melhor equilíbrio entre a identidade do Painel Alpha e a densidade extrema das ferramentas SEO. Escala de dashboard narrativo para tabelas com centenas de linhas sem trocar de linguagem visual.

### Opção B — Atelier de Pesquisa

Mais espaço em branco negativo, cards maiores, títulos editoriais e progressão narrativa por blocos. Keyword Research, Brand Lookup e SAM ficam excelentes; tabelas de backlinks, auditoria e rank exigem mais rolagem e perdem comparação simultânea.

**Força:** onboarding e descoberta mais acolhedores. **Custo:** menor eficiência para operação recorrente e telas multi-coluna.

### Opção C — Command Center

Rail estreito, densidade máxima, cabeçalhos baixos, tabelas dominantes e quase nenhuma superfície ornamental. Ideal para analistas avançados, mas hostil para criação de projeto, configuração de integrações, estados vazios e usuários ainda aprendendo SEO.

**Força:** throughput de operação. **Custo:** curva de aprendizado e contraste excessivo com módulos mais humanos do Alpha.

### Comparação e decisão

| Critério | A — Observatório | B — Atelier | C — Command Center |
|---|---:|---:|---:|
| Coerência com AlphaCRM | Excelente | Boa | Boa |
| Leitura de dados densos | Excelente | Regular | Excelente |
| Onboarding e estados vazios | Excelente | Excelente | Regular |
| Mobile | Excelente | Boa | Regular |
| Custo/performance visual | Baixo | Baixo | Baixo |
| Acessibilidade cognitiva | Excelente | Excelente | Boa |

**Escolha: Opção A — Observatório Operacional.** Ela será a única direção implementada. B e C não devem gerar variantes no código.

## 3. Princípios da direção escolhida

1. **Dados primeiro, cenário depois.** O fundo é estático: base `#020617`, um ou dois glows radiais muito suaves em áreas vazias e, opcionalmente, grid CSS quase imperceptível. Nunca atrás de texto/tabela.
2. **Uma hierarquia por superfície.** A página contém shell, cabeçalho, toolbar e conteúdo; evitar card dentro de card. Divisões internas usam borda ou fundo tonal.
3. **Accent como estado, não tinta.** Accent marca item ativo, foco, CTA, série principal e progresso. Não colorir todas as métricas.
4. **Densidade adaptativa.** Desktop privilegia comparação simultânea; mobile transforma painéis secundários em tabs/Sheet e ações em barra aderente.
5. **Progresso explícito.** Operações pagas ou demoradas mostram estimativa, aprovação, fases, consumo e resultado parcial.
6. **Contexto persistente.** Projeto, domínio, mercado e recorte temporal devem permanecer visíveis nas telas em que mudam a interpretação dos dados.
7. **Movimento funcional.** Framer Motion apenas em entrada/troca de página, abertura de superfície e feedback de estado; nada pulsa sem comunicar trabalho real.

## 4. Shell do módulo

### 4.1 Desktop (a partir de `md`)

- Layout `flex min-h-0 h-full`; sidebar de 224 px, conteúdo `min-w-0 flex-1`.
- Sidebar: `bg-slate-950/20 backdrop-blur-md`, `border-r border-white/5`, seguindo o AlphaCRM.
- Cabeçalho da sidebar: marca “Alpha SEO” + Project Switcher. Rodapé: Configurações e voltar ao Painel Alpha.
- Navegação usa `FlowButton`, ícone Lucide + rótulo. Item ativo recebe o accent dinâmico e `aria-current="page"`.
- Conteúdo rola internamente. Largura: `max-w-[1600px]` nas telas de dados; `max-w-5xl` em settings; chat `max-w-3xl`.
- Page header é aderente apenas quando houver toolbar longa; usar fundo denso e blur para não misturar linhas de tabela.

### 4.2 Mobile-first

- Abaixo de `md`, sidebar vira `Sheet` pela esquerda e fecha após navegação/troca de projeto.
- Topbar de 56 px: menu, título curto da rota, seletor do projeto, ação primária quando houver.
- Área útil começa com `px-4 py-4`, sem containers de largura fixa.
- Filtros avançados, colunas, exportação e histórico abrem em `Sheet` inferior/lateral.
- Comparações multi-painel viram `Tabs`; não empilhar acordeões que representam visões mutuamente exclusivas.
- Nenhum viewport entre 320 e 767 px pode gerar scroll horizontal na página. Somente a região de tabela, quando explicitamente necessária, pode rolar no eixo X.

### 4.3 Navegação do Alpha SEO

Ordem e grupos:

- **Workspace:** Projetos, Dashboard.
- **Pesquisa:** Keywords, Domain, Backlinks, Brand Lookup, Prompt Explorer.
- **Meu site:** Saved Keywords, Rank Tracking, Search Performance, Site Audit.
- **Inteligência:** SAM.
- **Configuração:** Geral, Contexto, Integrações, MCP.

Regras:

- “Projetos” é global; todas as outras rotas dependem do projeto ativo.
- Ao trocar projeto, preservar a seção equivalente somente nas rotas sem entidade filha. Rank detail, audit detail e performance detail voltam à lista da seção.
- Filtros, seleção, sessão SAM e IDs de entidade nunca migram para outro projeto.
- “Configuração” pode ser um grupo colapsável no desktop, mas as opções continuam alcançáveis por teclado e abertas quando uma filha está ativa.
- Não copiar o toggle Browse/Chat do OpenSEO: SAM é uma rota explícita e o histórico ocupa um painel próprio dentro dela.

### 4.4 Project Switcher

- Trigger mostra nome, domínio e chevrons; botão adjacente abre Settings.
- Até 7 projetos: lista direta. A partir de 8: busca com foco automático somente em pointer fino.
- Com teclado: `Enter/Space` abre, setas movem destaque, `Enter` seleciona, `Esc` fecha e devolve foco, digitação no trigger inicia type-ahead.
- Cada opção mostra nome, domínio e check no atual; lista limitada a 60vh.
- Rodapé: “Novo projeto” e “Gerenciar projetos”.
- Loading usa três skeleton rows; vazio conduz a “Criar primeiro projeto”; erro mantém trigger e oferece “Tentar novamente”.

## 5. Mapa de rotas e composição

Rotas canônicas propostas sob `src/app/PainelAlpha/AlphaSEO`:

| URL | Tela |
|---|---|
| `/AlphaSEO` | Projetos |
| `/AlphaSEO/[projectId]/dashboard` | Dashboard |
| `/AlphaSEO/[projectId]/keywords` | Keyword Research |
| `/AlphaSEO/[projectId]/saved` | Saved Keywords |
| `/AlphaSEO/[projectId]/rank` | Rank list |
| `/AlphaSEO/[projectId]/rank/[trackerId]` | Rank detail |
| `/AlphaSEO/[projectId]/domain` | Domain Research |
| `/AlphaSEO/[projectId]/backlinks` | Backlinks |
| `/AlphaSEO/[projectId]/audit` | Audit list/launch |
| `/AlphaSEO/[projectId]/audit/[auditId]` | Audit detail/issues/pages |
| `/AlphaSEO/[projectId]/audit/[auditId]/performance/[resultId]` | Lighthouse detail |
| `/AlphaSEO/[projectId]/search-performance` | Search Performance |
| `/AlphaSEO/[projectId]/brand-lookup` | Brand Lookup |
| `/AlphaSEO/[projectId]/prompt-explorer` | Prompt Explorer |
| `/AlphaSEO/[projectId]/sam` | SAM |
| `/AlphaSEO/[projectId]/settings` | Geral e membros |
| `/AlphaSEO/[projectId]/settings/context` | Memória do projeto |
| `/AlphaSEO/[projectId]/settings/integrations` | GSC/GA4/provedores |
| `/AlphaSEO/[projectId]/settings/mcp` | MCP e chaves |

Se a story/arquitetura consolidar `rank-tracking` em vez de `rank`, o rótulo visual continua “Rank Tracking”; não criar duas telas.

## 6. Especificação por tela

### 6.1 Projetos

**Objetivo:** criar, escolher, administrar membros, arquivar e restaurar workspaces.

- Header: “Projetos”, descrição curta, CTA “Novo projeto”.
- Lista em superfície única. Linha: nome, domínio, mercado/idioma, papel do usuário, membros, último acesso e status “Atual”.
- Ações em `DropdownMenu`: Abrir, Configurar, Membros, Arquivar. Arquivar usa `AlertDialog` e explica preservação de histórico.
- Seção “Arquivados” colapsável ao final, com Restaurar.
- Create Project Dialog: nome obrigatório; domínio opcional; país/localização e idioma relacionados; texto explicando herança de mercado para APIs. Ao concluir, ir para Integrações.
- Members Dialog/Sheet: membros, papel owner/admin/member, convite por e-mail, estado pendente, reenviar/revogar, transferência de propriedade protegida por confirmação forte.
- Mobile: cards em lista; ações no menu; modal de membros vira Sheet.
- Empty: ícone FolderSearch, explicação de isolamento dos dados e CTA. Sem ilustração externa.

### 6.2 Dashboard

**Objetivo:** resumo acionável do projeto, não mosaico decorativo.

- Header: projeto/domínio, mercado, seletor de período e “Atualizar”. Mostrar “Atualizado há…”/stale.
- Checklist inicial com 4 passos: domínio, GSC, auditoria e rank/competidor; progresso textual `n de 4`, links profundos e possibilidade de recolher após completo.
- Grade desktop em 12 colunas:
  - GSC: 7 colunas, clicks/impressions/CTR/posição + mini tendência;
  - Site Audit: 5 colunas, score, críticos/warnings, última execução;
  - Rank Tracking: 4 colunas, top 3/top 10/up/down;
  - Backlinks: 4 colunas, referring domains/new/lost;
  - GA4: 4 colunas, organic sessions/engagement/key events;
  - MCP/SAM: 12 colunas compacto, estado de ativação e próximos passos.
- Cada card tem título, status do provedor, timestamp, CTA de detalhe. Sem provider: estado contextual no próprio card; falha de um card não derruba os demais.
- Partial: cards com sucesso permanecem; os falhos exibem erro local e retry.
- Gráficos Recharts com tooltip, legenda textual e resumo acessível fora do SVG.

### 6.3 Keyword Research

**Busca:** textarea de seeds (1–200; uma por linha), `Enter` executa e `Shift+Enter` quebra linha, localização/idioma, limite, modo Auto/Related/Suggestions/Ideas e switch clickstream com custo claramente alterado. Mostrar contagem válida, duplicadas removidas e estimativa.

**Resultado desktop:** split 3/5 + 2/5. Esquerda: overview + toolbar + tabela. Direita: SERP e tendência da keyword focada. Em telas abaixo de `lg`, usar tabs “Keywords” e “SERP”.

- KPIs: total, volume combinado, CPC médio, difficulty média.
- Tabela: seleção, keyword, volume, CPC, competition, difficulty, intent; header sticky, ordenação e linha focada.
- Toolbar: busca, filtros, colunas, page size, Salvar, Exportar. Bulk bar aparece aderente após seleção.
- Filtros: volume/CPC/KD mínimos e máximos, intent, include/exclude. Mostrar contador e chips removíveis.
- Paginação server-side; opções 50/100/300/500 quando suportadas pelo serviço.
- SERP: top results, domínio/URL/título/snippet/rank e indicação de features; links externos usam `SafeExternalLink`.
- Aprovação de custo precede a chamada paga. Clickstream mostra multiplicador sem usar cor como único aviso.
- Recent searches em tabs ou popover; reabrir preserva parâmetros, não seleção antiga.

### 6.4 Saved Keywords

- Header: total salvo, “Atualizar métricas”, export CSV/Sheets e gerenciar tags.
- Toolbar: pesquisa; include/exclude; ranges volume/CPC/KD; intents; tag; status de métrica; chips ativos.
- Tabela adiciona tags, data salva e última atualização às métricas padrão.
- Bulk bar: copiar, adicionar/remover/criar tag, atualizar métricas, exportar, excluir.
- Tag Manager Dialog: nome, cor apenas dentre opções semânticas existentes, contagem de uso, editar/excluir; nunca depender da cor para distinguir tag.
- Atualização de métricas abre estimativa + Cost Approval; progresso não limpa seleção.
- Exclusão bulk usa AlertDialog com contagem e sem ambiguidade.
- Empty sem filtro: CTA para Keyword Research. Empty filtrado: “Nenhuma keyword corresponde” + limpar filtros.

### 6.5 Rank Tracking — lista

- Header com CTA “Novo rastreador”. Resumo: domínios ativos, keywords, checks no período, consumo estimado.
- Lista/tabela: domínio, localização, dispositivos, keywords, frequência, última execução, próxima execução, custo/check, status.
- Busca/filtros aparecem quando agregam valor (precedente: listas maiores); filtros por estado, dispositivo e frequência.
- Linha abre detalhe; menu: Configurar, Executar agora, Arquivar. Arquivar preserva histórico e exige AlertDialog.
- Create/Configure é wizard curto no Dialog:
  1. domínio, país e nacional/local com cidade;
  2. idioma, desktop/mobile, frequência diária/semanal/mensal/manual, profundidade 1–10;
  3. keywords digitadas/sugeridas/selecionadas;
  4. revisão de volume, dispositivos, páginas, duração e custo.
- A revisão final é o Cost Approval; não criar rastreador pago por acidente.

### 6.6 Rank Tracking — detalhe

- Breadcrumb/back, domínio, localização, dispositivos, frequência, último/next run e custo previsto.
- Header actions: Configurar, Adicionar keywords, Atualizar métricas, “Executar agora”.
- Controles: desktop/mobile e intervalo de comparação. Avisos stale/sem checks são banners locais.
- Overview: distribuição top 3/top 10/top 20/top 100/unranked em Stacked Area; legenda clicável com texto.
- Tabela latest: keyword, posição atual, delta, URL, volume, intent, checked at. Alternativa “Histórico” vira matriz keyword × data com header/primeira coluna sticky.
- Check Now: Cost Approval sempre, com keywords × devices × depth, duração estimada e custo. Após aprovar, Job Progress substitui o CTA sem bloquear consulta ao histórico.
- Resultado parcial preserva posições retornadas e lista itens que falharam; retry somente para falhas.

### 6.7 Domain Research

- Search Card: domínio/URL, scope Exact URL/Subfolder/Domain/Subdomains, localização e sort (rank/traffic/volume/score/CPC).
- Histórico recente acessível antes do primeiro resultado.
- Resultado: domain scope, mercado e timestamp; métricas organic traffic/keywords e variação quando houver.
- Tabs mutuamente exclusivas “Top Keywords” e “Top Pages”.
- Keywords: palavra, rank, URL, volume, traffic, CPC, score/intent. Pages: URL, keywords, traffic e top keyword.
- Filter Panel com draft/aplicar/cancelar, contador de condições e chips ativos; não disparar request por cada keystroke.
- Seleção permite salvar keywords. Exports: Sheets/JSON/CSV/Excel conforme contratos disponíveis.
- Sem dados é diferente de erro: explicar que o provider não encontrou cobertura para o scope.

### 6.8 Backlinks

- Search Card: target e scope; histórico recente quando vazio.
- Overview: backlinks, referring domains, DR quando disponível, dofollow/nofollow, new/lost e tendência. Gráficos Growth e New/Lost.
- Tabs: Backlinks, Referring Domains, Top Pages.
- Backlinks table: source page/domain, target, anchor, type, first/last seen, rank/DR. Toggle “Um por domínio / Todos os links”.
- Referring Domains: linha expansível para links do domínio; buscar expansão sob demanda e preservar expansões ao paginar somente se os IDs ainda estiverem na página.
- “Obter DR” é operação separada com estimativa/Cost Approval quando cobrada.
- Top Pages: URL alvo, backlinks, referring domains, dofollow e variação.
- Filtros, paginação e export seguem o padrão compartilhado; partial mantém tabs com dados válidos.

### 6.9 Site Audit — lista e lançamento

- Launch Card: URL, limite de páginas, switch Lighthouse, estimativa e CTA “Revisar auditoria”.
- Cost Approval mostra páginas máximas, Lighthouse ligado/desligado, duração, cache e custo.
- Histórico: data, URL, status, páginas, Lighthouse, issues, ações Ver/Excluir. Status running abre Job Progress.
- Empty: proposta de valor + formulário já visível, sem CTA redundante.
- Delete usa AlertDialog. Uma auditoria em progresso continua visível após recarregar.

### 6.10 Site Audit — detalhe, issues e pages

- Durante execução: fases Discovery/Crawling/Lighthouse/Finalizing, barra, páginas `n/max`, URL atual, lista curta de páginas processadas e ação cancelar quando suportada.
- Falha com dados: banner “Auditoria parcial”, timestamp/razão/correlation ID; resultados válidos abaixo. Falha sem dados: StatePanel de erro e retry.
- Summary: health score, páginas, críticos, warnings, info, duração e páginas bloqueadas.
- Tabs “Issues”, “Pages”, “Performance”.
- Issues agrupadas Critical/Warning/Info. Cada issue é accordion acessível: descrição, impacto, como corrigir, contagem, até 100 URLs inicialmente e “mostrar mais”.
- Pages: URL, status, title, H1, words, imagens e tempo; busca/filtros/status; drill-down somente se contrato existir.
- Performance tab mostra execuções Lighthouse por URL com quatro scores e métricas principais; selecionar uma abre detail.
- Export no nível do audit respeita o tab/recorte atual e informa formato.

### 6.11 Lighthouse Performance detail

- Back para auditoria, URL, device, scanned at e status.
- Quatro score rings: Performance, Accessibility, Best Practices, SEO; cada um tem rótulo e valor textual.
- Métricas FCP/LCP/TBT/SI/TTI/CLS/INP/TTFB em grid; unidade explícita, tooltip para sigla.
- Filtro de categoria All/Performance/Accessibility/Best Practices/SEO e severidade.
- Issues table expansível com título, categoria, impacto, economia estimada e detalhes.
- Export Sheets/copy/JSON/CSV no menu; links externos seguros.
- Não animar rings ao rolar; uma entrada curta respeitando reduced motion basta.

### 6.12 Search Performance (GSC)

- Sem conexão: Provider Missing com logo, explicação read-only, CTA “Conectar Search Console” e link a Integrações.
- Header: propriedade conectada, data range 7/28/90 dias, country/device e atualizar.
- KPI cards: clicks, impressions, CTR e average position, com delta, período comparado e números tabulares.
- Tabs: Striking Distance, Queries, Pages.
- Striking Distance permite selecionar, copiar e salvar como keywords; colunas keyword/page/position/impressions/clicks/CTR/opportunity.
- Queries/Pages mantêm as quatro métricas, comparação e paginação.
- Exports incluem recorte atual. Partial preserva totais/tabs que responderam e identifica dimensão ausente.

### 6.13 Brand Lookup (AI Visibility)

- Form: brand, domain, até 5 concorrentes, escopo/país quando aplicável e estimativa de custo antes de executar.
- Histórico recente em lista compacta, com timestamp e status dos provedores.
- Results header: brand/domain, competitors, scope, execução, total gasto e status partial/complete.
- KPIs: mentions, share of voice, citations e sentiment somente se o contrato entregar; não inferir valor ausente.
- Platform cards para ChatGPT, Claude, Gemini e Perplexity: ícone/rótulo, disponibilidade, mentions/citations e erro local.
- Gráficos: Mention Trend e SOV com legenda textual; tabs de citations por provider, domínio e prompt.
- Todos os providers falharam = erro da execução. Parte falhou = banner partial + dados válidos, retry direcionado aos providers falhos.
- Out-of-credits substitui CTA por ação de gestão interna de créditos; nunca “Upgrade”.

### 6.14 Prompt Explorer

- Composer: prompt com contador/limite, brand highlight opcional, seleção dos quatro modelos, web search e país.
- Custo calculado por modelos/recursos e confirmado antes de “Executar prompt”.
- Results em grid responsivo 1/2 colunas. Cada model card tem status independente, modelo/versão, tokens, web search e brand mention.
- Resposta Markdown sanitizada, citations numeradas com links seguros e fan-out queries colapsáveis.
- Streaming/progresso é por card; digitação visual só enquanto texto realmente chega e é removida em reduced motion.
- Falha parcial não apaga as respostas concluídas. Retry oferece somente modelos falhos e nova estimativa.
- Histórico recente reabre uma execução imutável; “Duplicar prompt” preenche o composer para nova chamada.

### 6.15 SAM

- Layout desktop: rail de histórico 280 px + conversa. Mobile: histórico em Sheet; composer sempre visível sem cobrir a última mensagem.
- Rail: “Nova conversa”, sessões por recência, título e idade, busca quando volume exigir, archive em menu. Arquivar sessão ativa seleciona a próxima.
- Conversation header: título, status e atalho “Memória do projeto”.
- Estado inicial apresenta descrição curta e quatro suggestions úteis: keywords, SERP competitors, GSC trend e quick wins.
- Mensagens: usuário e assistente visualmente distinguíveis sem balões saturados; Markdown sanitizado; tool calls exibem badge persistente `Executando/Concluído/Falhou` com nome humanizado.
- Composer auto-grow até 160 px; `Enter` envia, `Shift+Enter` quebra; botão de envio tem rótulo acessível. Enquanto busy, permitir cancelamento se o serviço expuser abort.
- Ações em mensagem do usuário: Editar e desfazer/rewind. Confirmar rewind quando remover respostas subsequentes; foco retorna ao composer.
- Streaming mantém stick-to-bottom somente se o usuário já estiver no fim; quando ele rolar para cima, mostrar “Ir para resposta mais recente”.
- Provider missing: gate dentro da área de chat com explicação, CTA para Integrações e Retry. Nunca instruir usuário final a editar variável de ambiente.
- Error não destrói transcript; mostra retry no turno. Empty e loading não piscam durante auto-seleção da sessão.

### 6.16 Settings — Geral e membros

- Shell `max-w-5xl`, breadcrumb Projetos, título e tabs Geral/Contexto/Integrações/MCP; tabs roláveis no mobile.
- Geral: nome, domínio opcional, localização, idioma e SaveStatus persistente (Salvando/Salvo/Erro).
- Membros: owner, papel, e-mail, último acesso/convite; convite, reenvio, revogação e alteração de papel conforme autorização.
- Danger Zone: Arquivar projeto, explicitando preservação dos dados; não permitir arquivar único projeto quando a regra de domínio impedir.
- Erros inline junto ao campo + resumo no topo apenas quando múltiplos campos falham.

### 6.17 Settings — Contexto

- Subtítulo: memória compartilhada por SAM e MCP. Mostrar provenance e última atualização.
- Seções: Business Overview, Current Goal, Positioning, Writing Preferences, Competitors, Key Pages, Custom Sections e Research Log.
- Desktop: índice lateral sticky + formulário. Mobile: Select “Ir para seção”.
- Seções editáveis usam modo leitura/edição explícito; não autosalvar texto longo sem sinal. SaveStatus permanece visível.
- Competitors/Key Pages usam linhas reordenáveis somente se a story exigir; caso contrário, simples add/edit/remove.
- Research Log é append-only visualmente, com origem, agente/usuário, timestamp e detalhes colapsáveis.
- Empty por seção descreve benefício e CTA pequeno; não mostrar um empty global se outras seções tiverem conteúdo.

### 6.18 Settings — Integrações

- Cards de conexão compartilhados para GSC, GA4 e providers internos necessários.
- Card: logo, título, status Connected/Not connected/Setup required/Error, conta/propriedade, escopos read-only, última sincronização e ações.
- Conectar abre fluxo autorizado pelo backend; desconectar usa AlertDialog e esclarece que dados históricos permanecem ou não conforme contrato.
- GSC permite selecionar propriedade após conexão; GA4 permite selecionar conta/property/stream quando aplicável.
- Provider técnico ausente mostra setup required e orientação administrativa adequada ao Alpha; não expor secrets nem instrução para editar `.env` a usuário comum.
- Falha em um card não bloqueia os demais; loading skeleton preserva altura do card.

### 6.19 Settings — MCP

- Hero compacto: descrição e status do servidor MCP.
- Server URL em CodeBlock com copy feedback; nunca exibir token junto da URL.
- Guias em Accordion: Claude Code, Claude Desktop, Codex e Codex Desktop. Passos numerados, comandos copiáveis e links seguros.
- Available Tools agrupadas: Project Context, Keywords, Competitive Research, Local Business, Search Console e Google Analytics. Cada item: title, nome monoespaçado e descrição.
- API Keys: tabela nome/prefixo/criado/último uso/status. Criar via Dialog; chave completa aparece uma única vez, backdrop/Escape não fecham antes de confirmação “Copiei e guardei”.
- Revogar usa AlertDialog e informa impacto imediato nos clientes.
- Skills/install commands do OpenSEO só aparecem se fizerem parte do escopo real do Alpha; não copiar roadmap ou marketing do produto fonte.

### 6.20 Primeira ativação

Não criar um funil comercial separado como o onboarding do OpenSEO. As capacidades úteis dele entram no fluxo real do módulo:

1. `CreateProjectDialog`: nome, domínio, país e idioma;
2. redirecionamento para Integrações: conectar conta Google, escolher propriedade GSC e, opcionalmente, propriedade GA4;
3. Dashboard: checklist persistente para domínio, GSC, primeira auditoria e primeiro rank tracker/competidor;
4. SAM: suggestions contextuais somente depois de existir projeto e provider disponível.

O usuário pode pular integrações sem perder o projeto. Cada etapa salva ao concluir, o progresso sobrevive a reload e existe sempre um caminho “Fazer depois”. Questionário de aquisição, preview com limite comercial, checkout e upgrade do produto fonte não pertencem ao Alpha SEO e não devem ser reproduzidos.

## 7. Padrões compartilhados

### 7.1 Superfícies e hierarquia

- `SEOPage`: `min-w-0`, padding responsivo, conteúdo com z-index acima do fundo.
- `SEOSurface`: `rounded-2xl border-white/5 bg-slate-900/30`; tabelas densas usam `rounded-xl bg-slate-950/70`.
- Cabeçalhos 24–30 px; subtítulos 14 px; labels 12–14 px; nunca reduzir texto operacional abaixo de 12 px.
- Números: `tabular-nums`; IDs/URLs/código: fonte mono existente, truncamento + title/copy.

### 7.2 Data tables

- Um componente base de tabela pode usar HTML semântico; shadcn não possui Table local no inventário atual.
- Header sticky, `aria-sort`, foco visível, checkbox com label contextual e caption/descrição fora da tabela.
- A primeira coluna textual permanece visível apenas quando isso não comprometer 320 px; em mobile, preferir cards para listas operacionais e scroll regional para matrizes.
- Células nunca escondem dado crítico somente em hover. Tooltip complementa, não substitui texto.
- Seleção gera `BulkActionBar` sticky; sempre exibir contagem e “Limpar seleção”.
- Row click não envolve checkbox/menu; `Enter` na linha abre detalhe quando a linha for interativa.

### 7.3 Filtros e paginação

- Desktop: filtros essenciais na toolbar; avançados em Popover/Sheet. Mobile: botão “Filtros (n)” abre Sheet.
- Campos de range têm min/max relacionados e validação inline. “Aplicar” executa; “Cancelar” restaura draft; “Limpar tudo” é secundário.
- Chips ativos podem ser removidos individualmente.
- Paginação server-side: anterior/próxima, página atual/total, total de resultados e page size; botões desabilitados mantêm contraste legível.
- Alterar filtro/page size volta à página 1. Selection cross-page só existe se o backend suportar explicitamente.

### 7.4 Dialogs, Sheets e ações destrutivas

- `Dialog` para create/edit/cost; `AlertDialog` para archive/delete/revoke; `Sheet` para mobile filters/history.
- Focus trap, foco inicial lógico, `Esc`, retorno ao trigger e `aria-labelledby/aria-describedby` são obrigatórios.
- Operação pendente pode impedir fechamento somente quando cancelar causaria inconsistência; explicar visualmente.
- Botões destrutivos usam ícone + verbo preciso e nunca são ação default do teclado.

### 7.5 Cost Approval

Todo pedido pago passa por `CostApprovalDialog`, inclusive quando o custo é baixo:

- operação e alvo;
- quantidade de seeds/keywords/URLs/models/pages × devices/depth;
- provedor(es), cache/reuso quando conhecido;
- estimativa em créditos e faixa/duração;
- saldo antes e saldo previsto depois;
- aviso de estimativa, sem prometer valor exato quando o contrato não garante;
- CTA “Aprovar e executar” e “Cancelar”. Nenhum checkbox pré-marcado.

Out-of-credits dentro do mesmo fluxo informa necessário/disponível, preserva o formulário e oferece ação interna de créditos. Nunca redireciona a checkout do OpenSEO.

### 7.6 Job Progress

- Cabeçalho com operação, estado e elapsed time; barra determinística quando há total, indeterminada apenas durante descoberta sem total.
- Fases com ícone + texto; current step com accent, completos com estado semântico existente.
- Contadores processados/total/falhas, custo consumido e atualização recente.
- “Pode sair desta página” quando job for persistente. Cancelar apenas se suportado.
- Ao terminar: resumo, CTA para resultado e retry apenas das falhas. Resultado parcial é sucesso parcial, não tela de erro total.

### 7.7 Exports e links

- `ExportMenu` lista formato + escopo (“Página atual”, “Todos os resultados filtrados”, “Selecionados”) apenas quando suportado.
- Export pendente tem progress/toast; erro inclui retry e correlation ID quando disponível.
- Link externo abre nova aba com `noopener noreferrer`, ícone ExternalLink e domínio visível.

## 8. Estados obrigatórios

### StatePanel base

Todos os estados usam ícone, título, explicação curta, detalhe técnico/correlation ID opcional e uma ação clara.

| Estado | Tratamento |
|---|---|
| Loading inicial | Skeleton que preserva a geometria final; sem spinner central em páginas inteiras |
| Refresh | Dados atuais permanecem, botão indica progresso e timestamp atualiza ao concluir |
| Empty inicial | Benefício/contexto + CTA primário para gerar/conectar/criar |
| Empty filtrado | “Nenhum resultado” + limpar filtros; não sugerir criar dados |
| Error total | Explicação humana, retry e ID técnico copiável |
| Error local | Banner/card na região; demais regiões permanecem operáveis |
| Out of credits | Necessário/disponível, formulário preservado, ação interna de créditos |
| Provider missing | Nome/capacidade ausente, impacto, link Integrações e retry |
| Partial | Banner âmbar, completados/falhos, timestamp e retry seletivo |
| Stale | Dados visíveis, badge “Desatualizado”, timestamp e refresh |
| Unauthorized | Explica papel necessário; não renderiza controles proibidos desabilitados sem motivo |

Matriz mínima por rota:

- Projetos/settings: loading, empty, validation, unauthorized, error.
- Dashboard: loading por card, provider missing, stale, error local, partial.
- Keywords/domain/backlinks/brand/prompt: form idle, cost approval, running, complete, empty-data, out-of-credits, provider missing, partial, error.
- Saved/rank: loading, empty, filtered-empty, cost approval, progress, stale, partial, error.
- Audit: idle, approval, queued, running por fase, complete, partial, cancelled, error.
- Search Performance: provider missing, loading, empty-data, complete, stale, partial, error.
- SAM: sessions loading/empty/error, conversation loading/empty/streaming/error, provider missing, out-of-credits sem perder transcript.

## 9. Movimento

- Entrada de página: opacity 0→1 e y 8→0 em 320–420 ms, easing padrão do painel.
- Cards/rows: hover de 150–200 ms; no máximo 1–2 px de elevação visual em cards clicáveis. Tabelas não fazem scale.
- Sidebar/Sheet: transição 240–320 ms. Active indicator do FlowButton mantém 700 ms já existente.
- Chart transitions podem ocorrer apenas na primeira carga e devem ser desativadas com reduced motion.
- Streaming, progress e skeleton são os únicos loops permitidos e somente enquanto existe trabalho real.
- `useReducedMotion()` remove deslocamento, spring, bounce e chart animation; mantém troca instantânea/opacity curta.

## 10. Acessibilidade WCAG AA

- Contraste mínimo 4.5:1 para texto normal e 3:1 para texto grande/ícones essenciais/bordas de foco.
- Accent dinâmico deve ser testado em todos os temas; quando insuficiente como texto, usar foreground claro e accent apenas em fundo/borda.
- Foco visível consistente: ring de 2 px com offset em base escura; nunca `outline-none` sem substituição.
- Alvos touch mínimos 44×44 px, inclusive ícones, paginação e fechar Sheet.
- Headings em ordem; cada página tem um único `h1`. Landmarks `nav`, `main`, `aside`, `section` nomeados.
- Inputs têm `Label`, ajuda e erro por `aria-describedby`; required e invalid comunicados ao leitor.
- Tabs seguem padrão Radix: setas navegam, estado selecionado e painel associados.
- Live regions: job progress com atualização moderada; toast não é o único lugar de erro. Streaming não anuncia token a token, apenas blocos/frases.
- Gráficos têm título, legenda, summary textual e tabela/export alternativo. Cor nunca é único codificador.
- Tables têm caption/descrição, headers associados e sort anunciado.
- Dialog/Sheet restaura foco; menus fecham com Escape; atalhos não interceptam textarea.
- Links e URLs longos podem quebrar/truncar, mas nome acessível contém destino completo.

## 11. Mapa componente → arquivo para Nova

Os nomes abaixo são recomendados; manter cada arquivo abaixo de 300 linhas.

### Shell

| Arquivo | Responsabilidade |
|---|---|
| `src/components/AlphaSEO/layout/AlphaSEOLayoutClient.tsx` | Resolve tema, shell desktop/mobile e outlet |
| `src/components/AlphaSEO/layout/AlphaSEOSidebar.tsx` | Grupos de navegação + FlowButton |
| `src/components/AlphaSEO/layout/AlphaSEOMobileHeader.tsx` | Topbar, Sheet e ação contextual |
| `src/components/AlphaSEO/layout/AlphaSEOBackground.tsx` | Glows/grid CSS estáticos, reduced motion |
| `src/components/AlphaSEO/layout/ProjectSwitcher.tsx` | Combobox, busca, troca segura e atalhos |
| `src/components/AlphaSEO/layout/AlphaSEOPageHeader.tsx` | Título, contexto, timestamp e actions |

### Compartilhados

| Arquivo | Responsabilidade |
|---|---|
| `src/components/AlphaSEO/shared/SEOSurface.tsx` | Variantes card/dense/flat |
| `src/components/AlphaSEO/shared/SEOMetricCard.tsx` | Valor, delta, source, timestamp |
| `src/components/AlphaSEO/shared/SEOStatePanel.tsx` | Loading/empty/error/provider/credits/partial |
| `src/components/AlphaSEO/shared/ProviderStatusBanner.tsx` | Estado e CTA de integração |
| `src/components/AlphaSEO/shared/StatusBadge.tsx` | Ícone + texto semântico |
| `src/components/AlphaSEO/shared/CostApprovalDialog.tsx` | Revisão e aprovação explícita |
| `src/components/AlphaSEO/shared/JobProgressCard.tsx` | Fases, contadores, custo, cancel/retry |
| `src/components/AlphaSEO/shared/SEODataTable.tsx` | Shell semântico, sort/selection/sticky |
| `src/components/AlphaSEO/shared/SEOFilterBar.tsx` | Busca, essenciais, chips e mobile Sheet |
| `src/components/AlphaSEO/shared/SEOFilterSheet.tsx` | Draft/aplicar/cancelar/limpar |
| `src/components/AlphaSEO/shared/SEOPagination.tsx` | Paginação server-side e page size |
| `src/components/AlphaSEO/shared/SEOBulkActionBar.tsx` | Contagem e ações aderentes |
| `src/components/AlphaSEO/shared/SEOExportMenu.tsx` | Formato/escopo/progresso |
| `src/components/AlphaSEO/shared/SafeExternalLink.tsx` | URL segura e destino anunciado |
| `src/components/AlphaSEO/shared/SEOChartFrame.tsx` | Título, legenda e summary acessível |
| `src/components/AlphaSEO/shared/SaveStatus.tsx` | Salvando/Salvo/Erro persistente |

### Projetos e dashboard

| Arquivo | Responsabilidade |
|---|---|
| `src/components/AlphaSEO/projects/ProjectsPageClient.tsx` | Orquestra listas ativa/arquivada |
| `src/components/AlphaSEO/projects/ProjectRow.tsx` | Linha/card responsivo e ações |
| `src/components/AlphaSEO/projects/CreateProjectDialog.tsx` | Form de criação e mercado |
| `src/components/AlphaSEO/projects/ProjectMembersDialog.tsx` | Lista, convite e papéis |
| `src/components/AlphaSEO/dashboard/SEODashboard.tsx` | Grid e estados independentes |
| `src/components/AlphaSEO/dashboard/SetupChecklist.tsx` | Checklist recolhível |
| `src/components/AlphaSEO/dashboard/DashboardMetricPanel.tsx` | Card reutilizável de integração |

### Keywords, saved e rank

| Arquivo | Responsabilidade |
|---|---|
| `src/components/AlphaSEO/keywords/KeywordResearchForm.tsx` | Seeds, modos, mercado, estimativa |
| `src/components/AlphaSEO/keywords/KeywordResults.tsx` | Split/tabs e seleção focada |
| `src/components/AlphaSEO/keywords/KeywordTable.tsx` | Colunas SEO e bulk hooks |
| `src/components/AlphaSEO/keywords/SERPPanel.tsx` | Results e trend da keyword |
| `src/components/AlphaSEO/saved/SavedKeywordsView.tsx` | Toolbar/table/bulk |
| `src/components/AlphaSEO/saved/TagManagerDialog.tsx` | CRUD visual de tags |
| `src/components/AlphaSEO/saved/BulkTagsDialog.tsx` | Add/remove/create em seleção |
| `src/components/AlphaSEO/rank/RankTrackerList.tsx` | Resumo, filtros e trackers |
| `src/components/AlphaSEO/rank/RankTrackerWizard.tsx` | Configuração em quatro passos |
| `src/components/AlphaSEO/rank/RankTrackerDetail.tsx` | Header, overview e tabs |
| `src/components/AlphaSEO/rank/RankDistributionChart.tsx` | Distribuição acessível |
| `src/components/AlphaSEO/rank/RankLatestTable.tsx` | Posições atuais |
| `src/components/AlphaSEO/rank/RankHistoryMatrix.tsx` | Matriz keyword × data |

### Pesquisa e auditoria

| Arquivo | Responsabilidade |
|---|---|
| `src/components/AlphaSEO/domain/DomainResearchView.tsx` | Search, history e result shell |
| `src/components/AlphaSEO/domain/DomainKeywordsTab.tsx` | Tabela keywords |
| `src/components/AlphaSEO/domain/DomainPagesTab.tsx` | Tabela pages |
| `src/components/AlphaSEO/backlinks/BacklinksView.tsx` | Search/overview/tabs |
| `src/components/AlphaSEO/backlinks/BacklinksTable.tsx` | Links e one/all toggle |
| `src/components/AlphaSEO/backlinks/ReferringDomainsTable.tsx` | Expansão sob demanda |
| `src/components/AlphaSEO/backlinks/TopLinkedPagesTable.tsx` | Top pages |
| `src/components/AlphaSEO/audit/AuditListView.tsx` | Launch e histórico |
| `src/components/AlphaSEO/audit/AuditLaunchForm.tsx` | URL/limite/Lighthouse |
| `src/components/AlphaSEO/audit/AuditDetailView.tsx` | Progress/summary/tabs |
| `src/components/AlphaSEO/audit/AuditIssuesPanel.tsx` | Grupos e accordion |
| `src/components/AlphaSEO/audit/AuditPagesTable.tsx` | Pages e filtros |
| `src/components/AlphaSEO/audit/AuditPerformancePanel.tsx` | Lista Lighthouse |
| `src/components/AlphaSEO/audit/LighthouseDetailView.tsx` | Scores, metrics, issue filter |

### GSC, AI Visibility e SAM

| Arquivo | Responsabilidade |
|---|---|
| `src/components/AlphaSEO/search-performance/SearchPerformanceView.tsx` | KPIs, controls e tabs |
| `src/components/AlphaSEO/search-performance/StrikingDistanceTable.tsx` | Oportunidades e save |
| `src/components/AlphaSEO/search-performance/GSCPerformanceTable.tsx` | Queries/Pages por configuração |
| `src/components/AlphaSEO/visibility/BrandLookupForm.tsx` | Brand/competitors/scope/cost |
| `src/components/AlphaSEO/visibility/BrandLookupResults.tsx` | KPIs, charts e platform states |
| `src/components/AlphaSEO/visibility/PromptExplorerForm.tsx` | Prompt/modelos/search/cost |
| `src/components/AlphaSEO/visibility/PromptModelResultCard.tsx` | Streaming/result/citations/error |
| `src/components/AlphaSEO/sam/SAMWorkspace.tsx` | Rail + conversa responsivos |
| `src/components/AlphaSEO/sam/SAMSessionList.tsx` | Histórico/new/archive/search |
| `src/components/AlphaSEO/sam/SAMConversation.tsx` | Transcript, rewind e streaming |
| `src/components/AlphaSEO/sam/SAMMessage.tsx` | Markdown, tool badges e ações |
| `src/components/AlphaSEO/sam/SAMComposer.tsx` | Auto-grow, send/cancel, keyboard |

### Settings/MCP

| Arquivo | Responsabilidade |
|---|---|
| `src/components/AlphaSEO/settings/SEOSettingsLayout.tsx` | Header, tabs e outlet |
| `src/components/AlphaSEO/settings/GeneralSettingsForm.tsx` | Identidade/mercado/archive |
| `src/components/AlphaSEO/settings/ProjectMembersSection.tsx` | Membros e convites |
| `src/components/AlphaSEO/settings/ProjectContextView.tsx` | Índice e seções de memória |
| `src/components/AlphaSEO/settings/ContextSectionEditor.tsx` | Read/edit/save por seção |
| `src/components/AlphaSEO/settings/IntegrationCard.tsx` | Shell de GSC/GA4/provider |
| `src/components/AlphaSEO/settings/IntegrationsView.tsx` | Orquestra conexões independentes |
| `src/components/AlphaSEO/mcp/MCPSettingsView.tsx` | URL, guides, tools e keys |
| `src/components/AlphaSEO/mcp/MCPSetupGuide.tsx` | Accordion de um cliente |
| `src/components/AlphaSEO/mcp/MCPToolsCatalog.tsx` | Categorias/ferramentas |
| `src/components/AlphaSEO/mcp/APIKeysTable.tsx` | Lista/revoke |
| `src/components/AlphaSEO/mcp/CreateAPIKeyDialog.tsx` | Criação e reveal único |

## 12. Critérios visuais verificáveis

Nova/Probe/Forge devem confirmar:

1. Tema Blue, Emerald e Midnight alteram todos os itens ativos, foco primário, séries principais e progress sem cores órfãs.
2. Fundo é `#020617`; não há nova paleta, canvas, WebGL nem animação contínua fora de trabalho real.
3. Sidebar desktop é translúcida e usa FlowButton; mobile usa Sheet e fecha em navegação.
4. Viewports 320, 375, 768, 1024 e 1440 px não apresentam clipping nem scroll horizontal global.
5. Nenhum componente Alpha SEO excede 300 linhas.
6. Dashboard suporta falha independente de GSC, GA4, audit, rank e backlinks sem perder cards válidos.
7. Todas as operações pagas passam por Cost Approval; out-of-credits preserva dados inseridos.
8. Jobs continuam consultáveis fora do modal e resultados parciais nunca são descartados.
9. Tabelas têm header/ordenação acessíveis, paginação server-side, filtros claros e ação bulk com contagem.
10. Focus order acompanha leitura; `Esc`/retorno de foco funcionam em Dialog, AlertDialog, Popover, DropdownMenu e Sheet.
11. Todos os controles de ícone têm accessible name e 44×44 px em touch.
12. `prefers-reduced-motion` remove deslocamento/bounce/chart animation e não remove feedback de estado.
13. Texto normal e controles passam WCAG AA; status permanece compreensível em grayscale.
14. Gráficos têm resumo textual e alternativa exportável/tabular.
15. SAM preserva transcript em erro/credits/provider missing e não força scroll se o usuário estiver lendo acima.
16. API key completa aparece uma vez e o Dialog não fecha acidentalmente antes da confirmação.
17. Links externos mostram destino, abrem com segurança e respostas Markdown são sanitizadas.
18. Nenhuma tela contém CTA de checkout, upgrade, Discord ou instrução de `.env` herdada do OpenSEO.

## 13. Definição de pronto visual

- Todas as rotas e estados desta especificação estão cobertos em Storybook/testes de componente ou cenários reproduzíveis do app.
- Existe pelo menos um cenário mobile e desktop por família de tela.
- Loading, empty, error, out-of-credits, provider missing e partial são verificáveis sem alterar código em runtime.
- Fluxos de custo, progress, cancelamento/retry, filtros, paginação, export e modais funcionam integralmente por teclado.
- Revisão visual compara o módulo lado a lado com AlphaCRM: mesma família de superfícies, sidebar, accent e ritmo; Alpha SEO permanece mais denso apenas onde os dados exigem.
- A UI é uma camada fina: não calcula regras de custo, estado de job, permissão ou métricas que pertencem aos serviços.
