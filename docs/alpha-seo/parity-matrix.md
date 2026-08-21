# Alpha SEO — matriz de paridade OpenSEO → Painel Alpha

Fonte congelada: `source-manifest.json` (hash e contagens verificáveis pelo
comando `npm run alpha-seo:inventory -- --check --json`). Esta matriz usa três
status: `ported`, `infra-substituted` e `explicitly-non-seo`. Nenhum item pode
ficar sem destino.

## Server functions — 93/93

| Source | Exports congelados | Destino Alpha SEO | Status / evidência |
|---|---|---|---|
| `ahrefs.ts` | `getAhrefsDomainRatings` | `lib/alpha-seo/backlinks/service.ts` (enriquecimento DR) | ported · `backlinks.test.ts` |
| `ai-search.ts` | `explorePrompt`, `lookupBrand` | `AlphaSeoAiVisibility.ts`, `lib/alpha-seo/ai-visibility/service.ts` | ported · `ai-visibility.test.ts` |
| `audit.ts` | `deleteAudit`, `getAuditHistory`, `getAuditResults`, `getAuditStatus`, `getCrawlProgress`, `startAudit` | `AlphaSeoAudit.ts`, `lib/alpha-seo/audit/service.ts`, worker/cron | ported · `audit.test.ts`, `crawler.test.ts` |
| `backlinks.ts` | `getBacklinksOverview`, `getBacklinksReferringDomains`, `getBacklinksRows`, `getBacklinksTopPages` | `AlphaSeoBacklinks.ts`, `lib/alpha-seo/backlinks/service.ts` | ported · `backlinks.test.ts` |
| `billing.ts` | `getBillingUsageEvents` | aprovações e runs internos (`AlphaSeoCostApproval`, `AlphaSeoExternalOperationRun`, `AlphaSeoAiVisibilityRun`, `AlphaSeoRankRun`) | infra-substituted · sem checkout/paywall; `contracts.test.ts`, testes dos provedores |
| `config.ts` | `getSeoApiKeyStatus` | `AlphaSeoSettings.ts`, `lib/alpha-seo/config/status.ts`, doctor | ported · `backend-source-gaps.test.ts`, `doctor-worker.test.ts` |
| `dashboard.ts` | `dismissDashboardGa4Card`, `dismissDashboardMcpCard`, `getDashboardActivation`, `getDashboardOverview`, `markDashboardCompetitorClicked`, `refreshDashboardBacklinkSnapshot` | `AlphaSeoDashboard.ts`, `lib/alpha-seo/dashboard/service.ts` | ported · wiring/UI dashboard |
| `domain.ts` | `getDomainKeywordSuggestions`, `getDomainKeywordsPage`, `getDomainOverview`, `getDomainPagesPage` | `AlphaSeoDomain.ts`, `lib/alpha-seo/domain/service.ts` | ported · `domain.test.ts` |
| `ga4.ts` | `disconnectGa4`, `getGa4Connection`, `getGa4DashboardReport`, `listGa4Properties`, `setGa4Property`, `startSelfHostedGa4Link` | `AlphaSeoGa4.ts`, `lib/alpha-seo/google/ga4.ts`, OAuth start/callback | ported · `ga4.test.ts`, `google-oauth.test.ts` |
| `gsc.ts` | `disconnectGsc`, `getGscConnection`, `getGscGrantStatus`, `listGscSites`, `setGscSite`, `startSelfHostedGscLink` | `AlphaSeoGsc.ts`, `lib/alpha-seo/google/gsc.ts`, OAuth start/callback | ported · `gsc.test.ts`, `google-oauth.test.ts` |
| `keywords.ts` | `deleteSavedKeywordTag`, `exportSavedKeywords`, `getSavedKeywords`, `getSerpAnalysis`, `refreshSavedKeywordMetrics`, `removeSavedKeywords`, `researchKeywords`, `saveKeywords`, `updateSavedKeywordTag`, `updateSavedKeywordTags` | `AlphaSeoKeywords.ts`, `AlphaSeoSavedKeywords.ts`, `AlphaSeoExports.ts`, `lib/alpha-seo/{keywords,saved-keywords,exports}` | ported · `keywords.test.ts`, `exports.test.ts` |
| `lighthouse.ts` | `exportAuditLighthouseIssues`, `getAuditLighthouseIssues` | `AlphaSeoAudit.ts`, `lib/alpha-seo/lighthouse/{provider,sample,storage,results}.ts` | ported · `lighthouse.test.ts`, `backend-source-gaps.test.ts` |
| `middleware.ts` | `globalServerFunctionMiddleware`, `requireAuthenticatedContext`, `requireProjectContext` | NextAuth + `lib/alpha-seo/project-access.ts` em cada Action/Handler/tool | infra-substituted · `project-access.test.ts`, `integration-wiring.test.ts` |
| `onboarding.ts` | `dismissGscNudge`, `getOnboardingAnswers`, `saveOnboardingAnswers` | `AlphaSeoOnboarding.ts`, `lib/alpha-seo/onboarding/service.ts` | ported · `backend-source-gaps.test.ts` |
| `onboardingChat.ts` | `getOnboardingChatState`, `saveOnboardingSite` | `AlphaSeoOnboarding.ts`, onboarding + SAM | ported · `backend-source-gaps.test.ts`, `sam.test.ts` |
| `projectContext.ts` | `getProjectContext`, `updateProjectContext` | `AlphaSeoProjectMemory.ts`, `lib/alpha-seo/project-memory/service.ts` | ported · `project-memory.test.ts` |
| `projects.ts` | `archiveProject`, `createProject`, `getArchivedProjects`, `getProjectAccess`, `getProjects`, `restoreProject`, `setProjectDomain`, `setProjectMarket`, `updateProject` | `AlphaSeoProjects.ts`, `lib/alpha-seo/projects/service.ts`, `project-access.ts` | ported · `projects.test.ts`, `project-access.test.ts` |
| `rank-tracking.ts` | `addTrackingKeywords`, `createRankTrackingConfig`, `estimateRankCheckCost`, `getLatestRankResults`, `getLatestRankRun`, `getRankConfigTrend`, `getRankKeywordHistory`, `getRankPositionMatrix`, `getRankTrackingConfigSummaries`, `getRankTrackingConfigs`, `refreshTrackingKeywordMetrics`, `removeTrackingKeywords`, `triggerRankCheck`, `updateRankTrackingConfig` | `AlphaSeoRankTracking.ts`, `lib/alpha-seo/rank-tracking/{service,repository}.ts`, worker | ported · `rank-tracking.test.ts` |
| `sam.ts` | `archiveSamSession`, `createSamSession`, `listSamSessions` | `AlphaSeoSam.ts`, `lib/alpha-seo/sam/service.ts`, SSE handler | ported · `sam.test.ts` |
| `samAccess.ts` | `getSamAccessSetupStatus` | `AlphaSeoSettings.ts`, doctor e provider-missing UI | ported · `backend-source-gaps.test.ts` |
| `searchPerformance.ts` | `exportSearchPerformanceTable`, `getSearchPerformanceReport`, `getSearchPerformanceTable` | `AlphaSeoGsc.ts`, `lib/alpha-seo/google/gsc.ts`, export controls | ported · `gsc.test.ts`, `exports.test.ts` |
| `serp-locations.ts` | `prewarmSerpLocations`, `searchSerpLocations` | `AlphaSeoSettings.ts`, `lib/alpha-seo/serp-locations/service.ts` | ported · `backend-source-gaps.test.ts` |
| `workspace.ts` | `getWorkspaceMergeStatus`, `mergeLegacyWorkspaces` | projeto/membership Alpha nativos; não há workspaces Better Auth legados no Painel Alpha para mesclar | infra-substituted · inventário/exclusões + `projects.test.ts` |

## Rotas e superfícies

| Família source | Destino | Status |
|---|---|---|
| auth/sign-in/sign-up/reset/verificação | NextAuth e shell autenticado do Painel Alpha | infra-substituted |
| projects + project dashboard | `/PainelAlpha/AlphaSEO` e `[projectId]/dashboard` | ported |
| keywords, saved, rank + detail | `[projectId]/{keywords,saved,rank}` | ported |
| domain, backlinks, audit + Lighthouse detail | `[projectId]/{domain,backlinks,audit}` | ported |
| GSC/search performance | `[projectId]/search-performance` + integrations | ported |
| Brand Lookup, Prompt Explorer e SAM | `[projectId]/{brand-lookup,prompt-explorer,sam}` | ported |
| project context, Google integrations e MCP/API keys | `[projectId]/settings/{context,integrations,mcp}` | ported |
| billing hosted, marketing, pricing, support e release pages | governança interna/README ou fora do módulo | infra-substituted / explicitly-non-seo |

## Contratos transversais

| Contrato source | Destino | Evidência |
|---|---|---|
| 46 tools MCP nomeadas | `lib/alpha-seo/mcp/registry.ts` + Streamable HTTP/OAuth/API key | `mcp.test.ts`: 46/46, schemas, handlers, redaction |
| 9 skills + recurso do audit | `lib/alpha-seo/skills/{catalog,assets}.ts` | `skills.test.ts`: instruções integrais e template |
| 27 audit issue IDs | `lib/alpha-seo/audit/issues.ts` | `audit.test.ts` |
| rank/audit/watchdog/OAuth GC | persistent jobs + três crons protegidos | `rank-tracking.test.ts`, `audit.test.ts`, `oauth-cleanup.test.ts` |
| CSV/Sheets | `lib/alpha-seo/exports/` + controles compartilhados | `exports.test.ts` |
| D1/Drizzle/Cloudflare workflows | Prisma/Turso, leases/fencing, Next Route Handlers e Vercel cron | infra-substituted, Vault report |
| Better Auth organizations | NextAuth + permissão de módulo + owner/member por projeto | `project-access.test.ts` |
| Autumn billing | estimativa, aprovação explícita e ledger interno | `contracts.test.ts` e suites por provider |

## Gaps que fazem o gate falhar

O gate não aceita: nome MCP ausente/extra; skill sem instruções; issue ID removido;
rota funcional sem controle real; Action sem autorização; operação paga sem
estimate/approval; ou export que aceite formula injection. Dependências externas
ausentes são `provider-missing`, não implementação fictícia.
