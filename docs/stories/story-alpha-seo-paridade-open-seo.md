# Story: Alpha SEO — paridade funcional integral com OpenSEO no Painel Alpha

## Status

Review

## Executor Assignment

executor: `@dev`
quality_gate: `@architect`
quality_gate_tools: `["alpha-seo:inventory", "alpha-seo:doctor", "alpha-seo:worker:once", "lint", "typecheck", "test", "build", "coderabbit", "forge", "probe", "anubis", "vault"]`

## Story

**Como** usuário autenticado e autorizado do Painel Alpha,
**quero** um módulo Alpha SEO que preserve integralmente o front funcional e todas as capacidades SEO do projeto local `C:\Users\TI\Desktop\open-seo-main`,
**para que** eu execute pesquisa, monitoramento, auditoria e automações SEO dentro do Painel Alpha, com a stack, identidade visual, autenticação, banco, operação e controles de segurança nativos do painel.

## Contexto, objetivo e fonte de verdade

Esta é uma story brownfield de **paridade**, não uma reinterpretação reduzida do OpenSEO. O resultado só pode ser considerado completo quando cada capacidade do source tiver uma linha rastreável `source → port → test`, sem botão decorativo, mock permanente, rota órfã ou função silenciosamente removida.

Fontes obrigatórias, em ordem:

1. pedido do usuário e inventário/blueprint do Scout recebido nesta sessão;
2. código local de `C:\Users\TI\Desktop\open-seo-main` na versão existente no início da implementação;
3. contratos, stack, autenticação, componentes, memórias e integração do Painel Alpha;
4. esta story e a matriz de rastreabilidade abaixo.

O implementador deve congelar no primeiro commit de trabalho um manifesto sanitizado do source (rotas, funções, jobs, schemas funcionais, ferramentas MCP, skills, issue types e testes) para impedir perda por contagem manual ou drift durante a portabilidade.

### [AUTO-DECISION]

- `[AUTO-DECISION] Criar esta story fora da sequência numérica de epic → usar o nome solicitado story-alpha-seo-paridade-open-seo.md (reason: o usuário solicitou um módulo brownfield específico e não há epic/PRD sharded correspondente neste checkout).`
- `[AUTO-DECISION] accumulated-context.md ausente → usar Scout, source OpenSEO, stories existentes e memórias Bibble para coerência cruzada (reason: docs/stories/accumulated-context.md não existe; nenhum conteúdo fictício será criado para substituí-lo).`
- `[AUTO-DECISION] ClickUp → não sincronizar (reason: instrução explícita do lead para não usar ClickUp).`
- `[AUTO-DECISION] Branch → não criar nem trocar branch (reason: instrução explícita do lead; preservar worktree compartilhado e alterações locais).`
- `[AUTO-DECISION] AC do epic → derivar literalmente do pedido confirmado e do inventário Scout (reason: não existe epic Alpha SEO no checkout; não há wording de epic a copiar).`

## Substituições de infraestrutura — paridade de função, não de hosting

| No OpenSEO source | No Alpha SEO | Regra de paridade |
|---|---|---|
| Better Auth, organização/workspace e telas próprias de sign-in | NextAuth v5 do Painel Alpha, sessão ativa, permissão efetiva `alphaSeo` e ownership/membership por projeto | Não portar auth independente. Preservar isolamento, seleção de projeto e autorização em toda leitura/mutação. |
| D1/Postgres + Drizzle | Turso/libSQL via Prisma 6 e `src/lib/prisma.ts` | Não portar adapters Drizzle. Preservar entidades e comportamento após gate Vault. |
| Autumn/checkout/plan gates | Governança interna do Painel Alpha | Não portar billing hosted, paywall ou checkout. Preservar estimativa, aprovação e observabilidade de custo das chamadas SEO. |
| Cloudflare Workers, Durable Objects, Workflows, R2/KV e Alchemy/Wrangler | Next.js 16 App Router, services server-only, Turso, fila/locks/jobs e runtime do Painel Alpha | Não portar deploy/marketing do produto OpenSEO. Preservar streaming, jobs, progresso, stale recovery, mutex e cache por equivalentes do painel. |
| Vite/TanStack Router + DaisyUI | Next.js App Router + React 19 + Tailwind 4 + Radix/shadcn existentes + Framer Motion | Copiar fluxos, estados e densidade informacional; refazer a apresentação para combinar com o Painel Alpha. |
| Site institucional, pricing, support/marketing e release/deploy OpenSEO | Fora do módulo | Excluídos apenas porque não são funções SEO internas. Nenhuma função SEO pode ser excluída por essa regra. |

## Escopo funcional obrigatório

### 1. Projetos e dashboard

- Criar, listar, selecionar, editar, arquivar e restaurar projetos; domínio, mercado, idioma e localização; project switcher persistente.
- Cada projeto possui exatamente um `owner` e zero ou mais membros. Papéis mínimos: `OWNER`, `EDITOR`, `VIEWER`; o owner não pode ser removido sem transferência explícita.
- Dashboard com ativação, status/conexão GSC, último audit, snapshot de backlinks, visão GA4, links de retomada e estados loading/empty/error/stale.

### 2. Keyword Research e Saved Keywords

- Pesquisa com até 200 seeds por execução; modos auto, related, suggestions e ideas; mercado/local/idioma; clickstream quando disponível.
- Métricas, filtros, ordenação, paginação, seleção individual/em massa, análise SERP e histórico reproduzível.
- Saved Keywords com dedupe por projeto, paginação, filtros, tags CRUD, ações em massa, refresh de métricas, remoção, exportação CSV e Google Sheets.

### 3. Rank Tracking

- Configurações por domínio/local/device/depth e agendas manual, diária, semanal e mensal.
- Gestão de keywords, estimativa prévia e aprovação explícita antes de operação paga, mutex por configuração/projeto, idempotência e polling/progresso.
- Resultado current/previous, URL ranqueada, SERP features, tendências, histórico e matriz temporal.
- Execução agendada com skip justificável, fallback controlado e regra **no drift**: a próxima agenda deriva da agenda contratada, não do horário em que o worker terminou.

### 4. Domain Overview e Backlinks

- Domain Overview nos escopos exact, subfolder, domain e subdomains; overview e tabs de keywords/pages; filtros, sort, paginação, save e histórico.
- Backlinks com summary, charts, tabs de backlinks/referring domains/top pages, filtros, expansão de domínio, Domain Rating, histórico e exportação.

### 5. Site Audit e Lighthouse

- Iniciar, acompanhar, listar histórico e excluir auditoria; execução em background com robots, sitemap, redirects, discovery, streaming de progresso, stale recovery e preservação de resultado parcial diagnosticável.
- Resultados por issues, pages e performance; Lighthouse mobile e desktop; exportação.
- Cobrir, no mínimo, os 26 tipos reportados pelo Scout e **todos** os tipos do registry congelado. O checkout inspecionado contém 27 IDs: `blocked-page`, `server-error`, `broken-internal-link`, `missing-title`, `broken-page`, `duplicate-title`, `duplicate-meta-description`, `duplicate-content`, `missing-meta-description`, `missing-h1`, `multiple-h1`, `redirect-chain`, `redirect-loop`, `canonical-conflict`, `thin-content`, `images-missing-alt`, `orphan-page`, `no-outgoing-links`, `title-too-long`, `title-too-short`, `meta-description-too-long`, `meta-description-too-short`, `heading-order-skip`, `slow-response`, `noindex-page`, `canonicalized-page` e `deep-page`. Nenhum pode ser descartado para forçar a contagem antiga.

### 6. Google Search Console e Google Analytics 4

- GSC OAuth com state + PKCE, seleção de property, períodos 7 dias/28 dias/3 meses, device/country, clicks/impressions/CTR/position, comparação, tabs, salvar, CSV/Sheets e inspeção de URL também via MCP.
- GA4 OAuth, seleção de property e dashboard; preservar os 10 relatórios MCP: organic landing pages, page performance, key events, search opportunities, organic overview, traffic acquisition, measurement health, ecommerce performance, site search e audience breakdown.

### 7. AI Visibility, SAM e onboarding

- Brand Lookup e Prompt Explorer para ChatGPT, Claude, Gemini e Perplexity; citações/fontes seguras, tendências, share of voice, histórico, filtros e exportação.
- SAM com sessões, streaming, cancelamento, tools, skills e contexto de projeto; onboarding chat com o mesmo contrato funcional, adaptado ao provedor/runtime do Painel Alpha.
- Toda saída com URL externa usa link seguro; prompt/HTML externo nunca é confiável; tool calls validam input e ownership antes de custo ou acesso a dados.

### 8. Project Memory

- Contexto por projeto com seções de competidores, páginas-chave e research log; leitura e atualização pela UI, SAM e MCP sob o mesmo authorization helper.
- Histórico/auditoria suficiente para atribuir usuário, projeto e timestamp das mudanças.

### 9. MCP, skills, jobs, exportações e settings

- MCP com OAuth, API key e project auth, transporte compatível e outputs validados. A fonte autoritativa é o registry executável `createOpenSeoMcpServer` do checkout fornecido, que registra **46 tools nomeadas**. A paridade desta entrega é, portanto, **46/46**: toda tool registrada no source deve existir no port, e nenhuma tool pode ser inventada para completar contagem. O número 48 permanece documentado apenas como claim histórico do Scout sem dois nomes/registrations correspondentes; o gap histórico 48−46 é informativo, não bloqueador e não pode fazer inventory/doctor/DoD falhar. As famílias obrigatórias são: identidade/projetos/contexto; saved/research/save keywords; domain/backlinks/SERP; rank tracking; ranked keywords/competitors/local business/local SERP/questions/profile/reviews/updates/categories/grid/metrics; GSC/URL inspection; 10 GA4 reports; e 4 audit tools.
- Preservar as tools explicitamente observadas: `whoami`, list/create projects, get/update project context, list/save/research keywords, domain overview/suggestions, backlinks overview/profile, SERP, create/get/add/remove/estimate/run rank tracker, ranked keywords, SERP competitors, local businesses/SERP/questions, business profile/reviews/updates/categories/local rank grid, keyword metrics, GSC performance/inspect URLs, os 10 relatórios GA4 e run/status/issues/pages do audit.
- Baseline Scout exige **8 skills**. O checkout inspecionado contém 9 diretórios: `competitive-landscape`, `competitor-analysis`, `keyword-clustering`, `keyword-research`, `link-prospecting`, `local-seo`, `seo-audit`, `seo-coach`, `seo-project-setup`. O manifesto deve preservar todos os encontrados; jamais remover a nona skill para adequar contagem anterior.
- Jobs/cron para rank checks, audit reconcile e limpeza de OAuth expirado; fila observável e retomável, dead-letter/erro diagnosticável e execução manual equivalente.
- Exportações CSV e Google Sheets com os mesmos dados/filtros da tela; neutralizar CSV injection (`=`, `+`, `-`, `@`), manter UTF-8 e não exportar secrets/tokens.
- Settings server-only para DataForSEO, OpenRouter e Google OAuth, com status sanitizado, teste de configuração e disconnect/revoke. Segredos nunca retornam ao client.

## Acceptance Criteria

1. [x] `alpha-seo:inventory --source "C:\Users\TI\Desktop\open-seo-main" --json` é read-only, gera manifesto versionável/sanitizado e lista todas as rotas, serviços, server functions, tabelas funcionais, jobs, as 46 tools MCP nomeadas no registry autoritativo, skills, issue types, exports e settings. O output deve registrar `source=46`, `ported=46`, `missing=[]`, `unexpected=[]` e paridade `46/46`; o claim histórico 48 e seu gap sem nomes permanecem como metadado não bloqueador, impedindo tanto falso FAIL quanto falso PASS.
2. [x] A matriz source→port→test está 100% preenchida e validada por teste: cada item do manifesto possui destino, status (`ported`, `infra-substituted` ou `explicitly-non-seo`) e evidência; `missing`, duplicidade não explicada ou botão sem handler falha o gate de paridade.
3. [x] O módulo está registrado em `MODULOS_REGISTRY` como `alphaSeo`, rota `/PainelAlpha/AlphaSEO`, categoria coerente, ícone Lucide, card/atalho/sidebar/breadcrumb/search conforme pontos existentes, e só aparece para quem possui permissão efetiva `alphaSeo`.
4. [x] Toda rota, Server Action, Route Handler, job, tool MCP e chamada externa exige sessão/credencial válida, permissão do módulo e autorização por projeto no servidor; trocar `projectId`, membership id, run id, audit id, keyword id ou export id por recurso alheio retorna 403/404 fail-closed sem vazar existência/dados (testes IDOR obrigatórios).
5. [x] Owner e membros funcionam por projeto: OWNER administra projeto/membros e transfere ownership; EDITOR opera SEO e contexto; VIEWER somente lê/exporta resultados permitidos. Convite/mudança/remoção é auditável e o último owner não pode ser removido.
6. [x] Projetos e dashboard cumprem integralmente o item 1 do escopo, incluindo archive/restore, market/language/location, switcher, ativação e cards GSC/audit/backlinks/GA4 com loading/empty/error/stale.
7. [x] Keyword Research aceita 1–200 seeds e cumpre todos os modos, métricas, clickstream, filtros, sort, seleção, SERP e histórico do item 2; payload 0 ou >200 é rejeitado por Zod sem custo externo.
8. [x] Saved Keywords cumpre dedupe, paginação, filtros, tags CRUD/bulk, refresh, remoção e exportações; operações em massa são atômicas ou retornam relatório parcial explícito, nunca sucesso enganoso.
9. [x] Rank Tracking cumpre configurações, devices/depth/agendas, estimate+approval, keywords, mutex, idempotência, polling/progresso, current/previous/URL/features/trends/history, scheduled skip/fallback e no-drift; duas execuções concorrentes não duplicam cobrança nem snapshot.
10. [x] Domain Overview e Backlinks cumprem todos os escopos, tabs, filtros, paginação, expansão, DR, save, charts, history e exports descritos, com parâmetros iguais produzindo resultado cacheável/repetível dentro da política documentada.
11. [x] Site Audit executa em background e cumpre robots/sitemap/redirect/discovery, limites, streaming, progresso, cancelamento/deleção segura, stale reconciliation, partial results e Lighthouse mobile+desktop; os 26 tipos baseline e todos os 27 encontrados no registry possuem fixture/teste determinístico.
12. [x] O crawler bloqueia SSRF: somente HTTP(S), resolução e revalidação contra loopback/link-local/private/metadata, limite de redirects/tamanho/tempo/páginas, DNS rebinding mitigado, sem headers/credentials arbitrários e sem acesso à rede interna.
13. [x] GSC cumpre OAuth state+PKCE, properties, períodos, dimensões, métricas, comparação, tabs, save/export e URL inspection; tokens são criptografados server-side, refresh é mutex/idempotente e revoke/disconnect remove o acesso sem apagar resultados históricos indevidamente.
14. [x] GA4 cumpre OAuth/properties/dashboard e os 10 relatórios listados; cada tool MCP e tela usa o mesmo service/authorization contract e tem contract test de output.
15. [x] Brand Lookup e Prompt Explorer cobrem os quatro provedores, citações, trends, SOV, history, filtros e export; timeout/erro parcial por provedor é visível e não invalida silenciosamente respostas válidas dos demais.
16. [x] SAM e onboarding suportam session/create/list, stream, cancel, tools, skills e project context; cancelamento encerra consumo, e prompt injection não amplia tool permissions nem expõe secrets/dados de outro projeto.
17. [x] Project Memory cumpre competidores, key pages e research log, com acesso consistente em UI/SAM/MCP e teste de concorrência/autorização.
18. [x] A superfície MCP preserva autenticação OAuth/API key/projeto, schema de input/output, instrumentação e **46/46 tools nomeadas no registry autoritativo**; existem contract tests por tool/família, teste de token expirado/revogado e IDOR. O gate falha se qualquer nome registrado no source estiver ausente, duplicado ou sem handler real, mas não falha pelos dois nomes inexistentes do claim histórico 48. Nenhuma tool de custo alto executa lote >limite configurado sem estimate+approval.
19. [x] As 8 skills baseline e toda skill adicional encontrada no manifesto (9 no checkout atual) são portadas sem perder instruções/recursos, testadas quanto a descoberta, carregamento e acesso somente às tools autorizadas.
20. [x] `alpha-seo:doctor --json` é estritamente read-only, valida env, Turso, DataForSEO, OpenRouter, Google OAuth/encryption, fila/locks e manifesto de paridade; nunca imprime segredo/token/authorization URL completa e usa exit codes estáveis 0=healthy, 1=dependência indisponível, 2=config/contrato inválido.
21. [x] `alpha-seo:worker --once --json` processa rank/audit/OAuth-cleanup de forma observável, com lease/mutex, retry limitado, backoff, idempotência, stale recovery e resultado `{ok, command, code, jobs, checks, timestamp}`; cron apenas enfileira/aciona o mesmo núcleo do CLI.
22. [x] CSV/Sheets preservam filtros/colunas/dados, bloqueiam formula injection e não vazam secrets; erro de Sheets não destrói o CSV nem marca export como concluído.
23. [x] UI usa layout e componentes de `src/components/AlphaSEO/`, Tailwind/Radix/shadcn e tokens do tema do Painel Alpha; fundo `#020617`, cards legíveis, accent do usuário, responsividade, teclado, foco, labels e `prefers-reduced-motion`. Não reutiliza DaisyUI nem copia identidade visual de marketing do OpenSEO.
24. [x] UI é adaptador fino sobre services já provados via CLI/testes. Doctor e worker ficam funcionais antes das telas; nenhuma decisão de negócio, autorização, job ou chamada DataForSEO existe somente em Client Component.
25. [x] Toda chamada DataForSEO/OpenRouter/Google possui timeout, retry apenas seguro, rate limit, cache com escopo correto, idempotency key, classificação de custo e logs sanitizados com `requestId`, `projectId`, operação, duração e custo estimado/real sem payload sensível.
26. [x] Nenhum schema/migration/seed/backfill/mutação em massa é executado até existir relatório Vault, backup completo verificado com até 48h em `database-backups/pre-change/` e confirmação explícita do usuário para os comandos exatos. Sem os três itens, a onda de persistência fica bloqueada; trabalhos read-only/contratos/testes podem continuar.
27. [x] Auth independente, billing hosted, deployment Cloudflare e páginas de marketing não são portados; testes provam que a substituição usa infraestrutura do Painel Alpha sem remover qualquer capacidade SEO.
28. [ ] `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` passam sem regressões; cobertura não diminui no módulo; CodeRabbit não possui CRITICAL aberto; Forge, Probe e Anubis aprovam seus gates.
29. [x] README/ajuda do módulo documenta configuração, comandos, matriz de paridade, custos, recovery, jobs e limites; Scribe atualiza memórias e integração após implementação, sem registrar secrets.

### Evidência de conclusão dos ACs

- Os ACs marcados `[x]` possuem implementação e evidência local automatizada, estática, documental ou operacional nos relatórios Alpha SEO. Isso não equivale a smoke externo: OAuth GSC/GA4 real, APIs pagas, cron publicado e browser autenticado continuam explicitamente não executados.
- O AC 28 permanece `[ ]`: os gates dirigidos do módulo passaram, porém o typecheck global conserva 5 erros de baseline alheios ao Alpha SEO, o build global foi bloqueado pelo sandbox/Google Fonts e o CodeRabbit não iniciou por `WSL E_ACCESSDENIED`.
- Evidência consolidada: Vault aplicado com 44 tabelas e 110 índices; MCP 46/46; 9 skills; 27 issue types; Forge pós-audit com 35 arquivos/153 testes; Sage final com 37 arquivos/161 testes; Lens final PASS com 0 issues; Probe aprovado; Anubis com 0 críticos.
- O hardening final prova `CANCEL`/`DELETE` atômico no audit e corrige governança/runtime de operações pagas, cancelamento SAM/SSE, revogação concorrente de grants Google e classificação do resultado do worker.

## Definition of Done (DoD)

- [x] O manifesto MCP congela exatamente os 46 nomes registrados por `createOpenSeoMcpServer`, sem duplicatas, nomes sintéticos ou registrations omitidas.
- [x] A comparação source→port retorna `46/46`, `missing=[]` e `unexpected=[]`; cada uma das 46 tools possui handler, schema de input/output e evidência de contract test.
- [x] O claim histórico `48` e o gap sem nomes `2` permanecem registrados para auditoria como informação não bloqueadora; não participam do cálculo de paridade, exit code ou readiness.
- [x] `npm run alpha-seo:inventory -- --check --json` encerra com exit code `0` quando as 46 registrations do source estão manifestadas e não há outro drift bloqueador.
- [x] No doctor, o check `contract.mcp-source-parity` (ou o check legado equivalente) retorna `ok: true` e detalhes `{ source: 46, ported: 46, missing: 0, unexpected: 0, historicalClaim: 48, historicalUnnamedGap: 2, historicalGapBlocking: false }`.
- [x] Com configuração válida e modo offline/fixtures, `alpha-seo:doctor` retorna code `0`; em ambiente local sem configuração pode retornar code `2` somente pelos checks de configuração realmente ausentes, nunca pelo claim histórico 48. Dependência configurada porém indisponível continua code `1`.
- [x] Testes de inventory/doctor provam que remover uma das 46 tools produz FAIL/code `2`, enquanto manter 46/46 com o metadado histórico 48 produz PASS.
- [x] Story Draft Checklist, Testing, Completion Notes e documentação de comandos usam o mesmo contrato autoritativo 46/46.

## Matriz de rastreabilidade source → port → test

| Capacidade | Source OpenSEO | Port Painel Alpha | Evidência mínima |
|---|---|---|---|
| Projetos/workspaces | `src/serverFunctions/projects.ts`, `workspace.ts`, `src/server/features/projects/`, `src/client/features/projects/` | `src/actions/AlphaSeoProjects.ts`, `src/lib/alpha-seo/projects/`, `src/components/AlphaSEO/projects/` | `tests/alpha-seo/projects.*` + E2E owner/member/archive/restore/IDOR |
| Dashboard | `src/serverFunctions/dashboard.ts`, `src/server/features/dashboard/`, `src/client/features/dashboard/` | `AlphaSeoDashboard.ts`, `lib/alpha-seo/dashboard/`, `components/AlphaSEO/dashboard/` | contract + UI states + snapshot cards |
| Keyword Research | `src/serverFunctions/keywords.ts`, `server/features/keywords/`, `client/features/keywords/`, `server/lib/dataforseo/` | `AlphaSeoKeywords.ts`, `lib/alpha-seo/keywords/`, `components/AlphaSEO/keywords/` | 200-seed boundary, modes, filters, SERP, cost/idempotency |
| Saved Keywords/tags | `server/features/keywords/repositories/`, `client/features/saved-keywords/`, shared tag schemas | `AlphaSeoSavedKeywords.ts`, `lib/alpha-seo/saved/`, `components/AlphaSEO/saved/` | dedupe/tag/bulk/pagination/refresh/export |
| Rank Tracking | `serverFunctions/rank-tracking.ts`, `server/features/rank-tracking/`, `server/workflows/RankCheckWorkflow.ts`, client rank tracking | `AlphaSeoRankTracking.ts`, `lib/alpha-seo/rank/`, worker + rank UI | mutex/concurrency/schedule/no-drift/poll/trend/history |
| Domain Overview | `serverFunctions/domain.ts`, `server/features/domain/`, `client/features/domain/` | `AlphaSeoDomain.ts`, `lib/alpha-seo/domain/`, domain UI | 4 scopes/tabs/filter/page/save/history |
| Backlinks | `serverFunctions/backlinks.ts`, `server/features/backlinks/`, `client/features/backlinks/` | `AlphaSeoBacklinks.ts`, `lib/alpha-seo/backlinks/`, backlinks UI | overview/charts/tabs/filter/DR/expand/history/export |
| Site Audit | `serverFunctions/audit.ts`, `server/features/audit/`, `server/lib/audit/`, `server/workflows/SiteAuditWorkflow.ts`, `shared/audit-issues.ts` | `AlphaSeoAudit.ts`, `lib/alpha-seo/audit/`, worker, audit UI | SSRF suite, fixtures para todo issue id, stale/partial/progress |
| Lighthouse | `serverFunctions/lighthouse.ts`, `server/lib/lighthouse*`, client lighthouse | `lib/alpha-seo/lighthouse/`, audit performance UI | mobile/desktop payload/storage/export contracts |
| GSC | `serverFunctions/gsc.ts`, `searchPerformance.ts`, `server/features/gsc/`, `server/lib/gscClient.ts`, OAuth callback | `AlphaSeoGsc.ts`, `lib/alpha-seo/google/gsc/`, `/api/alpha-seo/oauth/gsc/*` | OAuth/PKCE/refresh/periods/dimensions/inspect/export/IDOR |
| GA4 | `serverFunctions/ga4.ts`, `server/features/ga4/`, `server/lib/ga4Client.ts`, GA4 MCP tools | `AlphaSeoGa4.ts`, `lib/alpha-seo/google/ga4/`, `/api/alpha-seo/oauth/ga4/*` | OAuth/property/dashboard + 10 report contracts |
| AI Visibility | `serverFunctions/ai-search.ts`, `server/features/ai-search/`, `client/features/ai-search/` | `AlphaSeoAiVisibility.ts`, `lib/alpha-seo/ai-visibility/`, brand/prompt UI | 4 providers/citations/SOV/trends/history/partial/export |
| SAM/onboarding | `serverFunctions/sam*.ts`, `onboarding*.ts`, `server/features/sam/`, `server/features/onboarding/` | `/api/alpha-seo/sam/*`, `lib/alpha-seo/sam/`, SAM/onboarding UI | stream/cancel/session/tools/skills/injection/access |
| Project Memory | `serverFunctions/projectContext.ts`, `server/features/project-context/`, `client/features/projects/project-context/` | `AlphaSeoProjectMemory.ts`, `lib/alpha-seo/project-memory/`, context UI | competitors/key pages/log/UI+SAM+MCP parity |
| MCP + skills | `src/server/mcp/**`, `plugins/openseo/skills/**` | `/api/alpha-seo/mcp`, `lib/alpha-seo/mcp/`, `lib/alpha-seo/skills/` | manifest count, auth/revoke, input/output per tool, skill discovery |
| Jobs/cron | `src/server.ts`, rank/audit workflows, cron config | `scripts/alpha-seo.mjs`, `lib/alpha-seo/jobs/`, protected cron handlers | doctor/worker once, lease/retry/reconcile/OAuth cleanup |
| Exports | table/export components, audit/backlink exports, `client/lib/exportToSheets.ts` | `lib/alpha-seo/exports/`, shared AlphaSEO export controls | CSV injection, UTF-8, filter parity, Sheets error/retry |
| Settings | `serverFunctions/config.ts`, settings/help UI, runtime env/OAuth config | `AlphaSeoSettings.ts`, `lib/alpha-seo/config/`, settings UI | secrets redaction, connect/test/disconnect, missing config |

## Tasks / Subtasks por ondas

- [x] Onda 0 — congelar inventário e contrato de paridade (AC: 1, 2, 27)
  - [x] Implementar `alpha-seo:inventory` read-only e registrar hash/data/caminho do source, rotas, services, tools, skills, issue types e testes.
  - [x] Reconciliar o claim histórico 48 com as 46 registrations nomeadas: source autoritativo 46/46, zero ausente, gap histórico 2 não bloqueador; manter também os registries autoritativos de 9 skills e 27 issue types sem remover capacidade nem inventar nome.
  - [x] Completar a matriz até zero `missing`; marcar somente auth/billing/deploy/marketing como `infra-substituted`/`explicitly-non-seo` com justificativa.
- [x] Onda 1 — contratos, CLI-first, segurança e gate de dados (AC: 4, 5, 20, 24–26)
  - [x] Criar schemas Zod, errors, auth/project authorization, ownership/membership matrix, redaction, cost policy, idempotency/cache/lock contracts.
  - [x] Entregar `alpha-seo:doctor`, `worker --once`, fila fake/in-memory e contract tests antes da UI.
  - [x] Acionar Vault; apresentar ambiente/comandos/impacto/risco/alternativa/rollback; criar e validar backup; obter confirmação explícita antes de qualquer schema/migration.
- [x] Onda 2 — persistência e projetos (AC: 3–6, 17, 26)
  - [x] Após o gate Vault, modelar no Prisma entidades equivalentes com owner/members, relações, índices, uniques, cascade/restrict e timestamps.
  - [x] Implementar projetos, archive/restore/switcher, project memory e dashboard; adicionar autorização server-side e testes IDOR.
  - [x] Integrar registry, permissão, rota, menu/sidebar/atalhos/breadcrumb/search sem quebrar módulos existentes.
- [x] Onda 3 — DataForSEO core: keywords, saved, domain e backlinks (AC: 7, 8, 10, 25)
  - [x] Portar client/server DataForSEO, normalização, cache, metering interno, estimate+approval e rate limits.
  - [x] Portar Keyword Research + SERP + history; Saved + tags/bulk/refresh; Domain; Backlinks + DR/expansion/history/export.
  - [x] Criar testes de contrato com fixtures; suíte padrão nunca chama API paga real.
- [x] Onda 4 — Rank Tracking e worker (AC: 9, 21, 25)
  - [x] Portar configs, keyword management, snapshots, current/previous, trends/history e estimate/approval.
  - [x] Implementar agendas e worker com lease/mutex/idempotência/retry/fallback/skip/no-drift; cron chama o mesmo núcleo.
  - [x] Testar corrida de workers, crash recovery, polling e prevenção de dupla cobrança.
- [x] Onda 5 — Site Audit/Lighthouse (AC: 11, 12, 21)
  - [x] Portar discovery/crawl/robots/sitemap/redirect, 27 issue IDs atuais, pages/issues/performance e Lighthouse mobile/desktop.
  - [x] Implementar fila, stream/progress, cancel/delete, partial/stale reconcile e limites.
  - [x] Executar Anubis no crawler e provar SSRF defenses/DNS rebinding/redirect limits com testes hostis.
- [x] Onda 6 — Google GSC/GA4 e exports (AC: 13, 14, 22)
  - [x] Portar OAuth state+PKCE, criptografia, refresh/revoke, properties, GSC reports/inspection e GA4 dashboard/10 reports.
  - [x] Portar CSV/Sheets e testes de formula injection, scopes, revoke, token race e IDOR.
- [x] Onda 7 — AI Visibility, SAM e onboarding (AC: 15–17, 25)
  - [x] Portar Brand Lookup/Prompt Explorer, quatro provedores, citations/SOV/trends/history/export e partial failures.
  - [x] Portar SAM/onboarding sessions, SSE, cancel, tools, skills e project memory; testar injection, cancellation e cost cutoff.
- [x] Onda 8 — MCP e skills (AC: 18, 19)
  - [x] Portar OAuth/API key/project auth, transporte, schemas, instrumentação e todas as tools do manifesto reconciliado.
  - [x] Portar todas as skills encontradas com seus recursos e validar tool allowlist/contexto por projeto.
  - [x] Rodar contract test por tool/família e confirmar zero capacidade sem handler real.
- [ ] Onda 9 — UI Alpha e integração completa (AC: 3, 6–19, 23, 24)
  - [x] Criar subrotas `dashboard/keywords/saved/rank/search-performance/domain/backlinks/audit/brand-lookup/prompt-explorer/sam/settings` sob `src/app/PainelAlpha/AlphaSEO/`.
  - [x] Adaptar componentes para `src/components/AlphaSEO/` com tokens, states, a11y, responsive, reduced motion e comportamento correto dentro do iframe/abas do Painel.
  - [ ] Provar no E2E que cada controle visível aciona service real e que refresh preserva seleção/histórico esperado. **Pendente:** browser autenticado não foi autorizado; não há evidência E2E real.
- [ ] Onda 10 — gates e documentação (AC: 2, 28, 29)
  - [x] Forge pós-audit: 35 arquivos/153 testes Alpha SEO, lint dirigido, Prisma, inventory 46/46 e worker aprovados; Sage final: 37 arquivos/161 testes.
  - [ ] Gates globais e E2E real: o typecheck mantém 5 erros globais alheios, o build global foi bloqueado pelo sandbox/Google Fonts e não houve browser autenticado.
  - [ ] Executar CodeRabbit, corrigir CRITICAL/HIGH conforme política e registrar dívida MEDIUM. **Bloqueado:** WSL retornou `E_ACCESSDENIED`; nenhum resultado do review foi inventado.
  - [x] Probe aprovado e Anubis com 0 críticos para auth/API/AI/OAuth/crawler.
  - [x] Lens final após hardening: PASS, 0 issues.
  - [x] Scribe atualiza codebase-map/integration-points/decisions/components e Kowalski arquiva a sessão.

## Dev Notes

### Stack e estrutura comprovadas

- Painel Alpha usa Next.js 16.1.6 App Router, React 19.2.3, TypeScript, Tailwind 4, NextAuth 5 beta, Prisma 6.19.2, Zod 4.4.3, Zustand e Vitest. [Source: `package.json`]
- O banco de runtime é Turso/libSQL pelo adapter `PrismaLibSql`; não presumir que migrations Drizzle/D1/Postgres do source sejam aplicáveis. [Source: `src/lib/prisma.ts`; `.bibble/memory/known-errors.md`]
- `MODULOS_REGISTRY` é fonte central para módulo, rota, permissão e metadados consumidos pela navegação. [Source: `src/lib/modulos-registry.ts`; `.bibble/memory/codebase-map.md`]
- O layout do Painel revalida sessão, usuário ativo e permissões efetivas. A proteção global de login não substitui autorização por recurso nas actions/routes. [Source: `auth.ts`; `middleware.ts`; `src/app/PainelAlpha/layout.tsx`]
- Todo código de domínio fica server-only em `src/lib/alpha-seo/`; Server Actions devem ser segmentadas como `src/actions/AlphaSeo*.ts`; Route Handlers somente para OAuth, streaming/chat, cron e MCP. [Source: blueprint Scout; precedentes `docs/stories/story-storage-alpha-fundacao-cli-multipart-poc.md` e `story-roadmap-alpha-fundacao-cli-contrato-qwen.md`]

### UI/UX do Painel

- Usar fundo base `#020617`, cards `bg-slate-900/30..40`, borda `border-white/5`, accent dinâmico de `CONFIG_TEMAS`, radius consistente, feedback textual de loading/save/error e `prefers-reduced-motion`. [Source: `.bibble/memory/design-tokens.md`]
- Alpha SEO é denso em tabelas/gráficos; priorizar legibilidade e fundo estável, sem copiar DaisyUI nem background de marketing OpenSEO. Sidebar, tabs, filtros e paginação devem reutilizar Radix/shadcn e padrões já catalogados. [Source: `.bibble/memory/patterns.md`; `.bibble/memory/components.md`]

### Segurança e operação

- Toda action/tool/API valida `auth()` primeiro, permissão efetiva e ownership/membership do projeto consultando o banco; nunca confiar em `projectId` vindo do client/MCP. [Source: `bibblesquad/constitution.md#Artigo-V`; `.bibble/memory/architecture.md#Endpoints-e-Server-Actions`]
- Segredos DataForSEO/OpenRouter/Google e encryption keys são server-only. Logs, doctor, streams e erros devem passar por redaction central.
- Chamadas pagas ficam atrás de estimate+approval, idempotência e cache; a suíte automática usa fakes/fixtures, nunca rede paga.
- O crawler é uma superfície crítica de SSRF. Anubis é gate obrigatório.
- Alteração estrutural/migration é bloqueada até Vault + backup verificado <=48h + confirmação explícita. Esta story não concede essa confirmação.

### Project Structure Notes

- `docs/architecture/`, `docs/framework/`, `docs/prd/` e `docs/stories/accumulated-context.md` configurados no AIOX não estão presentes neste checkout. As orientações foram extraídas do source real, Scout, Constitution, código atual, memórias Bibble e stories precedentes; não foram inventadas bibliotecas.
- O source OpenSEO possui contagens em drift em relação ao inventário Scout. Para MCP, o registry executável resolve o drift em favor de 46 tools nomeadas e a entrega passa com 46/46; o claim 48 sem os dois nomes é apenas trilha histórica não bloqueadora. Para skills/issues, o manifesto preserva todos os 9/27 itens explicitamente encontrados. O manifesto da Onda 0 é gate de produto, não detalhe opcional.

## Testing

### Evidência executada e aprovada

| Gate | Resultado | Evidência |
|---|---|---|
| Vault | PASS | Migração aplicada transacionalmente: 44 `CREATE TABLE`, 110 `CREATE INDEX`, 73 FKs e 5 índices parciais; zero `ALTER`, `DROP`, seed, backfill ou DML; backup pre-change verificado e zero violações FK. |
| Inventory/paridade | PASS | Source autoritativo MCP 46, ported 46, `missing=[]`, `unexpected=[]`; 9 skills e 27 issue types preservados. |
| Forge pós-audit | PASS | Suíte Alpha SEO → 35 arquivos, 153 testes aprovados; lint dirigido, Prisma, inventory e worker também aprovados. |
| Sage final | PASS | Suíte ampliada → 37 arquivos, 161 testes aprovados, incluindo os regressivos finais de lifecycle, custo, cancelamento, grant e worker. |
| Wiring dirigido | PASS | `npx vitest run tests/alpha-seo/integration-wiring.test.ts --reporter=verbose` → 8 testes aprovados. |
| Audit lifecycle | PASS | `CANCEL` e `DELETE` usam intenção explícita e transições atômicas/fail-closed; conflitos de estado e IDOR têm cobertura determinística. |
| Hardening operacional | PASS | Governança/runtime de paid ops, cancelamento SAM/SSE, revogação de Google grant compartilhado e classificação de processor result do worker têm testes dedicados. |
| Lint dirigido | PASS | ESLint dirigido a Alpha SEO (app, components, lib, actions, scripts e testes) sem warnings. |
| Prisma | PASS | Validação/geração Prisma aprovada pelo Forge após aplicação controlada do schema. |
| CLI inventory | PASS | `npm run alpha-seo:inventory -- --check --json` → exit 0, MCP 46/46. |
| CLI worker | PASS | Worker em modo `--once`/fixture aprovado, cobrindo rank, audit e OAuth cleanup sem chamada paga. |
| Probe | APPROVED | Registry, acesso, wiring, rotas e famílias funcionais aprovados; relatório em `docs/alpha-seo/probe-report.md`. |
| Anubis | PASS | 0 achados críticos reportados no gate de segurança. |
| Lens | PASS | Revisão final concluída com 0 issues. |

### Evidência pendente ou bloqueada externamente

- `alpha-seo:doctor --json` retornou code `2` porque as variáveis reais de DataForSEO/OpenRouter/Google não estão configuradas; o check de paridade MCP permaneceu saudável em 46/46.
- O typecheck global conserva 5 erros preexistentes/alheios ao Alpha SEO; o lint dirigido e as suítes do módulo passaram.
- O build global foi bloqueado por restrições de sandbox/download do Google Fonts; não há evidência de build global concluído.
- O browser autenticado foi negado/indisponível; responsividade, foco, permissão real e fluxos visuais autenticados não foram validados em E2E.
- CodeRabbit via WSL não iniciou por `E_ACCESSDENIED`; portanto não existe resultado CodeRabbit a marcar como aprovado.
- Não executados: OAuth real GSC/GA4, chamadas pagas DataForSEO/OpenRouter, Google Sheets real, cron em deploy e concorrência multi-instância real no Turso.

### Smokes futuros obrigatórios antes de Done/deploy

- Configurar providers em ambiente seguro e repetir doctor até code `0`, sem expor secrets.
- Executar OAuth GSC/GA4 end-to-end e revoke/refresh com contas sandbox.
- Executar smoke pago sob teto de custo e aprovação explícita; validar exports Google Sheets.
- Validar crons publicados, leases multi-instância e recuperação em runtime de deploy.
- Executar browser autenticado nos breakpoints, teclado/foco, permissão oculta e rotas completas.
- Resolver os 5 erros globais, concluir o build e repetir CodeRabbit; Lens já está aprovado.

## 🤖 CodeRabbit Integration

### Story Type Analysis

- **Primary Type**: Architecture
- **Secondary Type(s)**: Integration, API, Database, Frontend, Security
- **Complexity**: High — módulo transversal com APIs pagas, OAuth, MCP, IA, crawler, jobs e persistência multiusuário.

### Specialized Agent Assignment

**Primary Agents**:

- `@dev` — implementação e pre-commit.
- `@architect` — contrato de paridade, fronteiras server/client e substituições de runtime.

**Supporting Agents**:

- `Vault`/`@data-engineer` — schema somente após gate de backup/consentimento.
- `Anubis` — auth, IDOR, OAuth, MCP, IA, secrets e SSRF.
- `Iris`/`Nova` — adaptação UI do Painel sem reduzir função.
- `Sage`, `Forge`, `Probe`, `Lens`, `DevOps`, `Scribe` e `Kowalski` nos gates de suas autoridades.

### Quality Gate Tasks

- [ ] Pre-Commit (`@dev`): `coderabbit --prompt-only -t uncommitted`; bloqueado por WSL `E_ACCESSDENIED`.
- [ ] Pre-PR (`@devops`): `coderabbit --prompt-only -t committed --base main`; não executado enquanto o gate local estiver bloqueado.
- [x] Security (`Anubis`): IDOR/OAuth/SSRF/prompt injection/secrets aprovados, com 0 críticos.
- [x] Architecture (`@architect`): manifesto e matriz com zero `missing`, MCP 46/46, 9 skills e 27 issues.
- [x] Database (`Vault`): relatório, backup válido e consentimento anexados; aplicação controlada de 44 tabelas/110 índices, sem `ALTER`/`DROP`/seed/backfill.

### Self-Healing Configuration

- Primary Agent: `@dev` (light mode)
- Max Iterations: 2
- Timeout: 15 minutos
- Severity Filter: CRITICAL
- CRITICAL: `auto_fix`; HIGH: `document_only`; MEDIUM/LOW: não corrigir silenciosamente, registrar conforme política do projeto.

### CodeRabbit Focus Areas

- Falhas de autorização/IDOR e secrets em logs/streams/exports.
- SSRF/DNS rebinding/redirects no crawler e unsafe external links.
- Duplicação de cobrança, race conditions, locks, idempotência e schedule drift.
- Contratos Zod/API/MCP, paridade source→port e handlers decorativos.
- A11y/responsividade/reduced-motion e separação Server/Client Components.

## Story Draft Checklist Validation

| Categoria | Status | Evidência/observação |
|---|---|---|
| 1. Goal & Context Clarity | PASS | Objetivo, valor, substituições e fronteiras SEO/não-SEO explícitos. |
| 2. Technical Implementation Guidance | PASS | Stack, paths, serviços, CLI, segurança, dados, UI, waves e contrato MCP autoritativo 46/46 definidos. |
| 3. Reference Effectiveness | PASS | Source local, caminhos concretos, Scout, código/memórias e precedentes citados. |
| 4. Self-Containment Assessment | PASS | Inventário funcional, contagens/drift, edge cases, ownership e fora do escopo presentes. |
| 5. Testing Guidance | PASS | Unit/contract/integration/E2E/smoke, SSRF/IDOR/OAuth/custo e gates definidos. |
| 6. CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e focos preenchidos. |

**Final Assessment:** READY FOR FINAL REVIEW. A implementação local, o hardening pós-audit, Forge, Sage, Lens, Probe e Anubis estão evidenciados; o status não é `Done` porque smokes externos, typecheck/build globais, browser autenticado e CodeRabbit permanecem pendentes ou bloqueados, conforme Testing.

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-08-20 | 0.1 | Draft brownfield completo de paridade OpenSEO → Alpha SEO, com matriz, ondas e checklist. | River (SM) |
| 2026-08-20 | 0.2 | Reconcilia MCP com o registry autoritativo: 46/46; claim histórico 48 mantido como metadado não bloqueador; DoD/doctor/testes alinhados. | River (SM) |
| 2026-08-20 | 1.0 | Consolida estado implementado para Review: Vault aplicado, 46/46 tools, 9 skills, 27 issues, Forge/Probe/Anubis e pendências externas registradas sem falso PASS. | River (SM) |
| 2026-08-20 | 1.1 | Consolida hardening final: Forge 35/153, Sage 37/161, Lens PASS 0 issues, audit atômico e fixes de paid ops/cancel/grant/worker; mantém bloqueios externos abertos. | River (SM) |

## Dev Agent Record

### Agent Model Used

Squad Bibble em execução coordenada; River (SM) consolidou as evidências de Vault, Forge, Probe, Anubis e inventário. Esta atualização não alterou código da aplicação.

### Debug Log References

- Forge pós-audit — 35 arquivos/153 testes PASS, além de lint dirigido, Prisma, inventory e worker.
- Sage final — 37 arquivos/161 testes PASS.
- `npx vitest run tests/alpha-seo/integration-wiring.test.ts --reporter=verbose` — 8 testes PASS.
- ESLint dirigido aos paths Alpha SEO — PASS, zero warnings.
- Prisma validate/generate — PASS no gate Forge.
- `npm run alpha-seo:inventory -- --check --json` — exit 0; source 46, ported 46, `missing=[]`, `unexpected=[]`.
- `npm run alpha-seo:worker:once -- --json` — PASS em fixture/local, sem chamada paga.
- Vault — backup verificado e aplicação transacional de 44 tabelas/110 índices, sem `ALTER`/`DROP`/seed/backfill.
- Probe — APPROVED; Anubis — 0 críticos.
- Lens final — PASS, 0 issues.
- `alpha-seo:doctor --json` — code 2 por provider env ausente; paridade MCP 46/46 saudável.
- CodeRabbit/WSL — bloqueado por `E_ACCESSDENIED`.

### Completion Notes List

- A paridade funcional cobre projetos/dashboard, keywords/saved, rank, domain/backlinks, audit/Lighthouse, GSC/GA4, AI Visibility, SAM/onboarding, project memory, MCP/skills, jobs, exports e settings na stack/UI do Painel Alpha.
- O manifesto congelou 47 route definitions (incluindo root), 23 arquivos/93 exports de serverFunctions, 46 registrations MCP nomeadas, 9 skills, 27 audit issue IDs, 32 arquivos de schema funcional e 7 jobs/cron/workflows.
- O manifesto autoritativo registra 46 tools nomeadas e a paridade correta é 46/46, com zero registration real ausente. O claim histórico 48 e seu gap sem dois nomes ficam documentados como metadado não bloqueador; nenhum nome foi inventado.
- `alpha-seo:doctor` é read-only, redigido e usa códigos 0/1/2. O check MCP deve passar em 46/46; neste ambiente, code `2` é aceitável somente por configuração realmente ausente, nunca pelo gap histórico 48−46.
- `alpha-seo:worker --once` foi aprovado em fixtures, com contratos de mutex, idempotência, retry limitado e stale recovery.
- Vault foi aplicado após backup/validação/consentimento: 44 tabelas, 110 índices, 73 FKs e 5 índices parciais; zero `ALTER`, `DROP`, seed, backfill ou DML.
- Forge pós-audit aprovou 35/153, lint dirigido, Prisma, inventory e worker; Sage encerrou com 37/161; Lens final PASS com 0 issues; Probe aprovado e Anubis com 0 críticos.
- O audit aplica `CANCEL`/`DELETE` atômico e fail-closed; foram corrigidos paid operations/governance/runtime, cancelamento SAM/SSE, lifecycle/revogação de grants e classificação do resultado do worker.
- Não executados: OAuth real GSC/GA4, APIs pagas DataForSEO/OpenRouter, Sheets real, cron em deploy, concorrência Turso multi-instância e browser autenticado.
- Bloqueios mantidos: 5 erros de typecheck global alheios, build global por sandbox/Google Fonts, browser autenticado negado e CodeRabbit WSL `E_ACCESSDENIED`.
- Status `Review`, não `Done`: AC 28, E2E da Onda 9 e gates globais da Onda 10 permanecem abertos.

### File List

#### Integração compartilhada e story

- `.bibble/memory/codebase-map.md`
- `.bibble/memory/components.md`
- `.bibble/memory/decisions.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/journal.md`
- `.env.example`
- `docs/stories/story-alpha-seo-paridade-open-seo.md`
- `package-lock.json`
- `package.json`
- `prisma/schema.prisma`
- `src/lib/modulos-registry.ts`
- `vercel.json`

#### Artefatos Alpha SEO

- `docs/alpha-seo/alpha-seo-migration-candidate.sql`
- `docs/alpha-seo/alpha-seo-schema-draft.prisma`
- `docs/alpha-seo/mcp-evaluation.xml`
- `docs/alpha-seo/OPEN-SEO-LICENSE.md`
- `docs/alpha-seo/parity-matrix.md`
- `docs/alpha-seo/probe-report.md`
- `docs/alpha-seo/README.md`
- `docs/alpha-seo/schema-invariants.md`
- `docs/alpha-seo/source-manifest.json`
- `docs/alpha-seo/ui-spec.md`
- `docs/alpha-seo/vault-report.md`
- `scripts/alpha-seo.mjs`
- `src/actions/AlphaSeoAiVisibility.ts`
- `src/actions/AlphaSeoAudit.ts`
- `src/actions/AlphaSeoBacklinks.ts`
- `src/actions/AlphaSeoDashboard.ts`
- `src/actions/AlphaSeoDomain.ts`
- `src/actions/AlphaSeoExports.ts`
- `src/actions/AlphaSeoGa4.ts`
- `src/actions/AlphaSeoGsc.ts`
- `src/actions/AlphaSeoKeywords.ts`
- `src/actions/AlphaSeoOnboarding.ts`
- `src/actions/AlphaSeoProjectMemory.ts`
- `src/actions/AlphaSeoProjects.ts`
- `src/actions/AlphaSeoRankTracking.ts`
- `src/actions/AlphaSeoSam.ts`
- `src/actions/AlphaSeoSavedKeywords.ts`
- `src/actions/AlphaSeoSettings.ts`
- `src/app/api/alpha-seo/cron/oauth-cleanup/route.ts`
- `src/app/api/alpha-seo/cron/schedules/route.ts`
- `src/app/api/alpha-seo/cron/worker/route.ts`
- `src/app/api/alpha-seo/mcp/keys/route.ts`
- `src/app/api/alpha-seo/mcp/oauth/authorize/route.ts`
- `src/app/api/alpha-seo/mcp/oauth/metadata/route.ts`
- `src/app/api/alpha-seo/mcp/oauth/register/route.ts`
- `src/app/api/alpha-seo/mcp/oauth/revoke/route.ts`
- `src/app/api/alpha-seo/mcp/oauth/token/route.ts`
- `src/app/api/alpha-seo/mcp/route.ts`
- `src/app/api/alpha-seo/oauth/[product]/callback/route.ts`
- `src/app/api/alpha-seo/oauth/[product]/start/route.ts`
- `src/app/api/alpha-seo/sam/stream/route.ts`
- `src/app/PainelAlpha/AlphaSEO/[projectId]/audit/[auditId]/page.tsx`
- `src/app/PainelAlpha/AlphaSEO/[projectId]/audit/[auditId]/performance/[resultId]/page.tsx`
- `src/app/PainelAlpha/AlphaSEO/[projectId]/audit/page.tsx`
- `src/app/PainelAlpha/AlphaSEO/[projectId]/backlinks/page.tsx`
- `src/app/PainelAlpha/AlphaSEO/[projectId]/brand-lookup/page.tsx`
- `src/app/PainelAlpha/AlphaSEO/[projectId]/dashboard/page.tsx`
- `src/app/PainelAlpha/AlphaSEO/[projectId]/domain/page.tsx`
- `src/app/PainelAlpha/AlphaSEO/[projectId]/keywords/page.tsx`
- `src/app/PainelAlpha/AlphaSEO/[projectId]/layout.tsx`
- `src/app/PainelAlpha/AlphaSEO/[projectId]/page.tsx`
- `src/app/PainelAlpha/AlphaSEO/[projectId]/prompt-explorer/page.tsx`
- `src/app/PainelAlpha/AlphaSEO/[projectId]/rank/[trackerId]/page.tsx`
- `src/app/PainelAlpha/AlphaSEO/[projectId]/rank/page.tsx`
- `src/app/PainelAlpha/AlphaSEO/[projectId]/sam/page.tsx`
- `src/app/PainelAlpha/AlphaSEO/[projectId]/saved/page.tsx`
- `src/app/PainelAlpha/AlphaSEO/[projectId]/search-performance/page.tsx`
- `src/app/PainelAlpha/AlphaSEO/[projectId]/settings/context/page.tsx`
- `src/app/PainelAlpha/AlphaSEO/[projectId]/settings/integrations/page.tsx`
- `src/app/PainelAlpha/AlphaSEO/[projectId]/settings/mcp/page.tsx`
- `src/app/PainelAlpha/AlphaSEO/[projectId]/settings/page.tsx`
- `src/app/PainelAlpha/AlphaSEO/error.tsx`
- `src/app/PainelAlpha/AlphaSEO/invite/page.tsx`
- `src/app/PainelAlpha/AlphaSEO/layout.tsx`
- `src/app/PainelAlpha/AlphaSEO/loading.tsx`
- `src/app/PainelAlpha/AlphaSEO/page.tsx`
- `src/components/AlphaSEO/AlphaSeoShell.tsx`
- `src/components/AlphaSEO/audit/AuditResultsWorkspace.tsx`
- `src/components/AlphaSEO/audit/LighthouseIssuesClient.tsx`
- `src/components/AlphaSEO/dashboard/DashboardOverview.tsx`
- `src/components/AlphaSEO/dashboard/OnboardingPanel.tsx`
- `src/components/AlphaSEO/gsc/GscOverview.tsx`
- `src/components/AlphaSEO/projects/InviteAcceptClient.tsx`
- `src/components/AlphaSEO/projects/ProjectsClient.tsx`
- `src/components/AlphaSEO/rank/RankControls.tsx`
- `src/components/AlphaSEO/rank/SerpLocationPicker.tsx`
- `src/components/AlphaSEO/research/BacklinksWorkspace.tsx`
- `src/components/AlphaSEO/research/DomainResearchTables.tsx`
- `src/components/AlphaSEO/research/DomainResearchWorkspace.tsx`
- `src/components/AlphaSEO/research/KeywordResearchResults.tsx`
- `src/components/AlphaSEO/sam/SamSessionRail.tsx`
- `src/components/AlphaSEO/sam/SamWorkspace.tsx`
- `src/components/AlphaSEO/saved/SavedKeywordsTable.tsx`
- `src/components/AlphaSEO/settings/GoogleIntegrations.tsx`
- `src/components/AlphaSEO/settings/McpManager.tsx`
- `src/components/AlphaSEO/settings/MembersManager.tsx`
- `src/components/AlphaSEO/settings/MemoryWorkspace.tsx`
- `src/components/AlphaSEO/settings/SettingsClients.tsx`
- `src/components/AlphaSEO/settings/SettingsPage.tsx`
- `src/components/AlphaSEO/shared/CompleteExportButtons.tsx`
- `src/components/AlphaSEO/shared/DetailViews.tsx`
- `src/components/AlphaSEO/shared/ExportButtons.tsx`
- `src/components/AlphaSEO/shared/FeatureConsole.tsx`
- `src/components/AlphaSEO/shared/FeatureRoute.tsx`
- `src/components/AlphaSEO/shared/PageHeader.tsx`
- `src/components/AlphaSEO/shared/PaginationControls.tsx`
- `src/components/AlphaSEO/visibility/AiHistoryPanel.tsx`
- `src/lib/alpha-seo/action-error.ts`
- `src/lib/alpha-seo/ai-visibility/service.ts`
- `src/lib/alpha-seo/audit/checkpoint.ts`
- `src/lib/alpha-seo/audit/contracts.ts`
- `src/lib/alpha-seo/audit/issues.ts`
- `src/lib/alpha-seo/audit/service.ts`
- `src/lib/alpha-seo/backlinks/service.ts`
- `src/lib/alpha-seo/config/status.ts`
- `src/lib/alpha-seo/contracts.ts`
- `src/lib/alpha-seo/crawler/fetch.ts`
- `src/lib/alpha-seo/crawler/html.ts`
- `src/lib/alpha-seo/crawler/pinned-fetch.ts`
- `src/lib/alpha-seo/crawler/robots.ts`
- `src/lib/alpha-seo/crawler/url-policy.ts`
- `src/lib/alpha-seo/dashboard/service.ts`
- `src/lib/alpha-seo/dataforseo/client.ts`
- `src/lib/alpha-seo/dataforseo/operations.ts`
- `src/lib/alpha-seo/dataforseo/schemas.ts`
- `src/lib/alpha-seo/dataforseo/target.ts`
- `src/lib/alpha-seo/doctor.ts`
- `src/lib/alpha-seo/domain/service.ts`
- `src/lib/alpha-seo/exports/csv.ts`
- `src/lib/alpha-seo/exports/google-sheets.ts`
- `src/lib/alpha-seo/exports/service.ts`
- `src/lib/alpha-seo/google/crypto.ts`
- `src/lib/alpha-seo/google/ga4.ts`
- `src/lib/alpha-seo/google/gsc.ts`
- `src/lib/alpha-seo/google/oauth.ts`
- `src/lib/alpha-seo/index.ts`
- `src/lib/alpha-seo/inventory.ts`
- `src/lib/alpha-seo/jobs/mutex.ts`
- `src/lib/alpha-seo/jobs/oauth-cleanup.ts`
- `src/lib/alpha-seo/jobs/processor-result.ts`
- `src/lib/alpha-seo/jobs/queue.ts`
- `src/lib/alpha-seo/keywords/mappers.ts`
- `src/lib/alpha-seo/keywords/schemas.ts`
- `src/lib/alpha-seo/keywords/service.ts`
- `src/lib/alpha-seo/lighthouse/issues.ts`
- `src/lib/alpha-seo/lighthouse/provider.ts`
- `src/lib/alpha-seo/lighthouse/report.ts`
- `src/lib/alpha-seo/lighthouse/sample.ts`
- `src/lib/alpha-seo/lighthouse/storage.ts`
- `src/lib/alpha-seo/mcp/auth.ts`
- `src/lib/alpha-seo/mcp/format.ts`
- `src/lib/alpha-seo/mcp/host-policy.ts`
- `src/lib/alpha-seo/mcp/oauth.ts`
- `src/lib/alpha-seo/mcp/registry.ts`
- `src/lib/alpha-seo/mcp/server.ts`
- `src/lib/alpha-seo/mcp/tool-executor.ts`
- `src/lib/alpha-seo/mcp/transport.ts`
- `src/lib/alpha-seo/mcp/types.ts`
- `src/lib/alpha-seo/onboarding/contracts.ts`
- `src/lib/alpha-seo/onboarding/service.ts`
- `src/lib/alpha-seo/operation-policy.ts`
- `src/lib/alpha-seo/project-access.ts`
- `src/lib/alpha-seo/project-memory/service.ts`
- `src/lib/alpha-seo/projects/normalize.ts`
- `src/lib/alpha-seo/projects/schemas.ts`
- `src/lib/alpha-seo/projects/service.ts`
- `src/lib/alpha-seo/rank-tracking/contracts.ts`
- `src/lib/alpha-seo/rank-tracking/provider.ts`
- `src/lib/alpha-seo/rank-tracking/queued-state.ts`
- `src/lib/alpha-seo/rank-tracking/repository.ts`
- `src/lib/alpha-seo/rank-tracking/service.ts`
- `src/lib/alpha-seo/sam/safe-url.ts`
- `src/lib/alpha-seo/sam/service.ts`
- `src/lib/alpha-seo/sam/tools.ts`
- `src/lib/alpha-seo/saved-keywords/schemas.ts`
- `src/lib/alpha-seo/saved-keywords/service.ts`
- `src/lib/alpha-seo/security.ts`
- `src/lib/alpha-seo/serp-locations/service.ts`
- `src/lib/alpha-seo/skills/assets.ts`
- `src/lib/alpha-seo/skills/catalog.ts`
- `src/lib/alpha-seo/worker.ts`
- `tests/alpha-seo/action-error.test.ts`
- `tests/alpha-seo/ai-visibility.test.ts`
- `tests/alpha-seo/audit-lifecycle.test.ts`
- `tests/alpha-seo/audit.test.ts`
- `tests/alpha-seo/backend-source-gaps.test.ts`
- `tests/alpha-seo/backlinks.test.ts`
- `tests/alpha-seo/contracts.test.ts`
- `tests/alpha-seo/crawler.test.ts`
- `tests/alpha-seo/dataforseo.test.ts`
- `tests/alpha-seo/doctor-worker.test.ts`
- `tests/alpha-seo/domain.test.ts`
- `tests/alpha-seo/exports.test.ts`
- `tests/alpha-seo/feature-options.test.ts`
- `tests/alpha-seo/ga4.test.ts`
- `tests/alpha-seo/google-oauth.test.ts`
- `tests/alpha-seo/gsc.test.ts`
- `tests/alpha-seo/integration-wiring.test.ts`
- `tests/alpha-seo/inventory.test.ts`
- `tests/alpha-seo/keywords.test.ts`
- `tests/alpha-seo/lighthouse.test.ts`
- `tests/alpha-seo/mcp-tenant-runtime.test.ts`
- `tests/alpha-seo/mcp.test.ts`
- `tests/alpha-seo/oauth-cleanup.test.ts`
- `tests/alpha-seo/paid-operation-governance.test.ts`
- `tests/alpha-seo/paid-operation-runtime.test.ts`
- `tests/alpha-seo/project-access.test.ts`
- `tests/alpha-seo/project-memory.test.ts`
- `tests/alpha-seo/projects.test.ts`
- `tests/alpha-seo/rank-tracking.test.ts`
- `tests/alpha-seo/sam-cancellation.test.ts`
- `tests/alpha-seo/sam-stream-cancellation.test.ts`
- `tests/alpha-seo/sam.test.ts`
- `tests/alpha-seo/schema-draft.test.ts`
- `tests/alpha-seo/skills.test.ts`
- `tests/alpha-seo/ssrf.test.ts`
- `tests/alpha-seo/ui-pagination-history.test.ts`
- `tests/alpha-seo/worker-processor-result.test.ts`

## QA Results

**READY FOR FINAL REVIEW / CONCERNS externos.**

- PASS: Vault 44/110; MCP 46/46; 9 skills; 27 issues; Forge pós-audit 35/153; Sage final 37/161; lint dirigido; Prisma; inventory; worker; audit `CANCEL`/`DELETE` atômico; Lens 0 issues; Probe aprovado; Anubis 0 críticos.
- PENDENTE: AC 28 completo, providers/OAuth/API paga/Sheets reais, cron deploy, browser autenticado, 5 type errors globais alheios, build global bloqueado e CodeRabbit.
- Não mover para `Done` nem declarar deploy integralmente validado até concluir os smokes/gates pendentes com evidência sanitizada.
