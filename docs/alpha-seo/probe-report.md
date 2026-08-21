# Probe + Sage Report — Alpha SEO

**Reauditoria final:** 2026-08-21
**Escopo:** registry/menu/abas, visibilidade e busca no `GlobalSidebar`, autenticação e ownership, 18 rotas, wiring UI, lifecycle de auditoria, fluxos funcionais, MCP, crons, estados e suíte Alpha SEO.
**Restrições observadas:** nenhuma alteração em produção, schema, env, banco ou registry durante este gate; sem browser, rede, providers ou banco real.

## Veredicto

**✅ APROVADO no gate de integração, com ressalvas operacionais externas.**

**Estado local:** PASS. **Estado publicado:** CONCERN operacional — o `HEAD` atual ainda não contém o registry nem os paths do Alpha SEO; a implementação validada vive no working tree e só alcançará um ambiente publicado após commit e deploy. Isso não é defeito do delta de visibilidade.

O módulo está alcançável pelo Painel Alpha, protegido em todas as camadas relevantes e conectado às ações/serviços reais. As lacunas apontadas no relatório anterior foram fechadas: convites são utilizáveis, as superfícies avançadas foram conectadas, Saved Keywords possui filtros/paginação e CRUD de tags, e os estados operacionais pedidos estão visíveis.

As ressalvas ao fim deste relatório dizem respeito a OAuth/provedores reais, execução paga, scheduler implantado e browser autenticado; esses cenários não foram simulados nem marcados como concluídos por inspeção estática.

O inventário source-authoritative também reconciliou o manifesto atual: 47 rotas fonte, 23 arquivos/93 exports server-side, 46 tools MCP, 9 skills, 27 issue IDs, 133 testes fonte, 32 schemas funcionais, 7 jobs/crons e 15 capacidades de export/settings.

## Blueprint do Scout

### Registry, presença e lifecycle de abas — PASS

- [✓] Existe uma única entrada `alphaSeo` em `MODULOS_REGISTRY`.
- [✓] O rótulo visível é `Open SEO · Alpha SEO`; rota canônica `/PainelAlpha/AlphaSEO`, permissão `alphaSeo`, categoria `comercial` e ícone `ScanSearch`.
- [✓] É a primeira entrada `comercial` do registry. O `GlobalSidebar` preserva essa ordem entre módulos não fixados; pins pessoais continuam precedendo a ordem normal por design.
- [✓] A busca normaliza caixa/acentos e consulta label, ID, tag, descrição e aliases; `Open SEO`, `Alpha SEO` e `OpenSEO` encontram a mesma entrada.
- [✓] `ScanSearch` resolve no `ICON_MAP` da sidebar.
- [✓] Card inicial, sidebar, gestão de permissões, título e abas internas derivam do registry central.
- [✓] URLs filhas continuam associadas ao mesmo módulo pelo prefix match do `PainelLayoutClient` e `TabBar`.
- [✓] O shell interno possui sidebar desktop, drawer mobile, overlay/fechamento rotulados e navegação para todas as famílias.

### Consumidor real `GlobalSidebar` — PASS local

- [✓] O componente filtra diretamente `MODULOS_REGISTRY`; não existe lista paralela para o Alpha SEO.
- [✓] `Admin`, `CEO`, `TI` e `T.I` recebem o bypass de `isAdminRole` e veem o módulo mesmo com `permissoes=[]`.
- [✓] Um não-admin com `alphaSeo` vê o link; um não-admin sem `alphaSeo` não recebe o item nem o `href`.
- [✓] Renderização server-side de prova confirmou admin sem permissão, usuário com permissão e usuário sem permissão; nos dois casos visíveis, o Alpha SEO apareceu antes de Alpha CRM e com `href="/PainelAlpha/AlphaSEO"`.
- [✓] O clique no `Link` chama `onOpenTab(mod.href, mod.label)`; `PainelLayoutClient` injeta `openTab`, ativa/reutiliza a tab e monta o conteúdo com `iframe src={tab.url}`.
- [✓] A `TabBar` resolve a categoria pela rota exata ou prefixo filho, enquanto o layout raiz reforça sessão/permissão para acesso direto.

### Autenticação, permissão e ownership — PASS

- [✓] O middleware exige sessão para todo `/PainelAlpha`.
- [✓] O layout raiz do Alpha SEO reforça `auth()` e permissão efetiva `alphaSeo`.
- [✓] O layout `[projectId]` chama `requireAlphaSeoProjectAccess({ action: "seo:read" })` antes de renderizar qualquer subrota.
- [✓] Server Actions, Route Handlers, SAM, OAuth, MCP keys e crons aplicam seus helpers de acesso próprios no servidor.
- [✓] Testes existentes cobrem identidade client-supplied divergente, IDOR cross-project e role mínima.
- [✓] O filtro de projetos combina ownership e pesquisa via `AND`; a busca não substitui o predicado de ownership.

### Rotas e boundaries — PASS

Existem e são alcançáveis sob o layout protegido:

- projetos e aceite de convite;
- dashboard;
- keyword research e saved keywords;
- rank tracking e detalhe do tracker;
- domain research e backlinks;
- site audit, detalhe, páginas/issues e detalhe Lighthouse;
- Search Performance/GSC;
- Brand Lookup e Prompt Explorer;
- SAM;
- settings geral, contexto, integrações e MCP.

As 18 páginas canônicas do projeto, o redirect `[projectId] → dashboard`, a rota `/invite`, `loading.tsx` e `error.tsx` são verificados automaticamente.

## Fluxos funcionais

### Projetos, membros e convites — PASS

- Criar, arquivar e restaurar projeto estão conectados.
- Settings lista membros e convites pendentes sob o layout project-scoped.
- Convite revela link copy-once usando o token retornado pelo servidor.
- `/PainelAlpha/AlphaSEO/invite?token=...` aceita o convite e redireciona ao projeto.
- Atualização de papel, remoção, transferência de ownership e revogação de convite possuem controles reais.
- O serviço valida e-mail do convidado, expiração, revogação e hash do token.

### Dashboard e onboarding — PASS

- Dashboard usa `ObterAtivacaoDashboardAlphaSeo` e `ObterOverviewDashboardAlphaSeo`, não contadores decorativos.
- Rank, audit, backlinks, GSC, GA4 e MCP exibem sinais/empty/stale apropriados.
- Refresh de backlinks chama o serviço real e preserva o overview completo.
- Marcar etapa de concorrente e dispensar cards GA4/MCP persistem no servidor.
- Onboarding salva site/mercado e respostas, permite dispensar nudge GSC e exibe o estado do chat para continuar no SAM.

### Keyword Research e Saved Keywords — PASS

- Pesquisa usa estimate → aprovação explícita → execução.
- Resultados têm seleção, salvamento, métricas, análise SERP e export CSV/Sheets.
- Saved usa `ListarPalavrasChaveSalvasAlphaSeo` como listagem autoritativa.
- Filtros: busca, include/exclude, volume, CPC, dificuldade, tags, sort e order.
- Paginação server-side: 50, 100 ou 250 por página.
- Tags: criar/aplicar, remover associação, renomear/cor e excluir.
- Refresh, remoção e export de seleção ou de todos os resultados filtrados estão conectados.

### Rank Tracking e localidades SERP — PASS

- Criar/editar tracker, adicionar/remover keywords, sugerir termos e atualizar métricas.
- Estimate/aprovação/run, resultados, histórico e tendência estão conectados.
- Busca de localidade SERP usa catálogo filtrado e o prewarm manual é acessível por país.
- Detail view mantém snapshots, estado vazio e histórico de runs.

### Domain e Backlinks — PASS

- Domain oferece overview e tabs reais de keywords, páginas e sugestões.
- Backlinks oferece overview, histórico, backlinks, referring domains e top pages.
- Filtros/escopo, paginação do serviço e exports por tabela estão conectados.

### Audit e Lighthouse — PASS

- Lançamento, histórico, status, refresh de resultados, cancelamento e exclusão estão conectados.
- O contrato de mutação exige `mode: "CANCEL" | "DELETE"`: `CANCEL` só atualiza auditorias `PENDING/RUNNING`, enquanto `DELETE` só remove estados terminais `COMPLETED/FAILED/CANCELLED`.
- As mutações usam predicado atômico com `projectId`; alvo inexistente produz `AUDIT_NOT_FOUND` e mudança concorrente produz `AUDIT_CANCEL_STATE_CONFLICT` ou `AUDIT_DELETE_STATE_CONFLICT`.
- A UI deriva o modo de `currentStatus`; em conflito, relê o status, fecha a confirmação e exige nova decisão humana. Não há retry automático da mutação.
- O refresh de status possui versionamento anti-stale e os controles ficam bloqueados por `pending || auditBusy` durante operação concorrente.
- Detalhe separa issues, pages e performance, com estados vazios e resultado parcial.
- As tabs de resultado apenas alternam painéis; não executam estimate/aprovação/start. Cada etapa paga da auditoria tem exatamente um ponto explícito no `FeatureConsole`.
- Mappers de issues/pages aceitam `unknown`, descartam linhas sem IDs/campos mínimos tipados e normalizam somente os campos reconhecidos antes de renderizar.
- Issues/pages/Lighthouse possuem exports próprios.
- Detalhe Lighthouse exibe métricas, Core Web Vitals, carrega issues normalizadas do payload persistido e exporta issues ou payload completo.
- Issues e pages paginam em lotes de 100, exportam todas as páginas por loader limitado e não voltaram ao `take: 500` fixo.
- A suíte cobre lifecycle `CANCEL/DELETE`, conflitos, crawler/SSRF, os 27 issue IDs, serialização determinística e contratos de export Lighthouse.

### GSC, GA4 e status de provedores — PASS

- OAuth GSC/GA4 parte de Route Handler protegido.
- GSC lista/seleciona properties, consulta overview/dimensões, exporta, inspeciona URL e desconecta.
- GA4 lista/seleciona properties, expõe os dez relatórios e desconecta.
- Settings exibe status sanitizado de DataForSEO e OpenRouter/SAM por Server Actions protegidas.
- Tokens/segredos não são enviados ao client pelos componentes inspecionados.

### AI Visibility, SAM e Project Memory — PASS

- Brand Lookup/Prompt Explorer usam estimate/aprovação/execução, mostram histórico por provedor, falha parcial e exports.
- SAM cria, lista, abre e arquiva sessões; carrega transcript, descobre skills, estima/aprova custo, transmite SSE e cancela via `AbortController` + ação server-side.
- Erro de streaming preserva transcript.
- Project Memory permite seções, concorrentes, páginas-chave e research log com inclusão/edição/remoção aplicáveis.

### Opções, paginação, export e histórico — PASS

- Keyword Research expõe `auto/related/suggestions/ideas`, limites 150/300/500, clickstream, location e language no payload real.
- Audit expõe máximo de páginas e Lighthouse `AUTO/NONE`; Brand/Prompt expõem marca, domínio, país, até cinco concorrentes e web search.
- Saved, Domain, Backlinks e Audit usam paginação autoritativa; exports completos materializam páginas limitadas, enquanto seleção exporta apenas as linhas marcadas.
- GSC descarta respostas stale ao trocar filtros; SAM preserva transcript em erro/cancelamento; onboarding e AI Visibility recuperam estado/histórico persistido.

### MCP — PASS

- Registry executável contém exatamente **46 nomes únicos**.
- As 46 tools possuem handler, schema strict e annotations.
- Inventory confirma `46/46`, `missing=[]`, `unexpected=[]`.
- Outputs grandes são truncados; falhas genéricas não vazam mensagens internas.
- UI MCP cria, revela uma única vez, lista e revoga API keys project-scoped.

### Jobs e crons — PASS estático

- `/api/alpha-seo/cron/schedules`: rank devido + auditorias stale.
- `/api/alpha-seo/cron/worker`: núcleo persistente compartilhado com CLI.
- `/api/alpha-seo/cron/oauth-cleanup`: limpeza de grants/tokens expirados.
- Os três endpoints exigem `CRON_SECRET`/`autorizarCron` e estão registrados em `vercel.json`.

## Estados, mobile e acessibilidade estrutural

- [✓] Loading inicial preserva geometria e respeita `motion-reduce:animate-none`.
- [✓] Error boundary possui retry e mensagem que não promete repetição automática de cobrança.
- [✓] Empty, filtered-empty, provider pending, stale, partial e feedback local aparecem nas famílias correspondentes.
- [✓] Ações novas usam alvos mínimos de 44 px (`min-h-11`/`size-11`) nos fluxos auditados.
- [✓] Tabelas possuem captions acessíveis e overflow local em viewports menores.
- [✓] Drawer mobile possui accessible names para abrir/fechar.
- [✓] Operações persistentes informam que o usuário pode sair e retornar.

## Sage — cobertura automatizada

`tests/alpha-seo/integration-wiring.test.ts` possui 8 cenários:

1. registry, primeira posição Comercial, aliases, bypass admin, non-admin com/sem permissão e ícone;
2. consumidor real da sidebar e cadeia clique/tab/rota;
3. middleware + layouts auth/ownership;
4. exatamente 18 rotas canônicas e boundaries;
5. wiring das famílias primárias;
6. superfícies concluídas: Lighthouse, providers, onboarding, prewarm, dashboard, convites e Saved avançado;
7. mobile/loading/error/reduced-motion;
8. três schedulers protegidos e worker persistente.

A suíte Alpha SEO também cobre contratos, inventário, providers, projetos, rank, lifecycle de audit, crawler/SSRF, opções de UI, paginação/histórico, OAuth, GSC, GA4, AI Visibility, SAM, MCP, exports, skills, schema e jobs.

## Comandos e evidências finais

```text
npx vitest run tests/alpha-seo/integration-wiring.test.ts --reporter=verbose
→ 1 arquivo, 8 testes PASS

npx tsx -e <renderToStaticMarkup de GlobalSidebar para admin-zero, user-with e user-without>
→ admin-zero: visível/href correto/antes do CRM; user-with: visível/href correto/antes do CRM; user-without: ausente/sem href

npx vitest run tests/alpha-seo --reporter=dot --testTimeout=30000
→ 37 arquivos, 161 testes PASS

npm run alpha-seo:inventory -- --check --json
→ exit 0; source 46, ported 46, missing [], unexpected [], parity 46/46

npx eslint tests/alpha-seo/integration-wiring.test.ts src/components/layout/GlobalSidebar.tsx src/lib/modulos-registry.ts --max-warnings=0
→ PASS, zero warnings

git diff --check -- tests/alpha-seo/integration-wiring.test.ts docs/alpha-seo/probe-report.md
→ exit 0; a verificação complementar `--no-index --check` dos arquivos ainda untracked não emitiu diagnóstico de whitespace
```

## Ressalvas operacionais não bloqueadoras deste gate

- Não foi executado OAuth real GSC/GA4, chamada paga DataForSEO/OpenRouter ou qualquer provider externo nesta auditoria.
- Não foi disparado cron implantado, rede externa, operação contra banco real ou concorrência multi-instância contra Turso.
- Não houve sessão de browser autenticada disponível para confirmar visualmente 320/375/768/1024/1440 px, foco restaurado por Radix e ausência do módulo para um usuário real sem permissão.
- A primeira tentativa da suíte completa com timeout padrão de 5 s encontrou três timeouts de varredura em `inventory.test.ts`/`doctor-worker.test.ts`, sem falha de asserção. A repetição com 30 s passou 37/161, o inventory isolado passou 46/46 e o Forge já havia registrado 37/161 no gate determinístico.
- `git show HEAD:src/lib/modulos-registry.ts` e `git ls-tree` confirmam que o `HEAD` não contém o Alpha SEO. O módulo está validado localmente, mas ainda não pode ser chamado de publicado até passar pelo fluxo de commit/deploy.
- Esses cenários devem compor o smoke test de implantação; não invalidam o wiring, os contratos ou os testes locais aprovados acima, mas não devem ser apresentados como E2E remoto já realizado.
