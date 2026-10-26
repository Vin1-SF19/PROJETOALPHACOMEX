# Story: estabilidade do Painel Alpha e recuperação de conexão

## Status

**Ready for Review** — Forge, Probe, Anubis, Lens e Sage locais aprovados; concorrência de reconsultas corrigida e casos de identidade/desmontagem revalidados. Validação/publicação staging→produção pendentes.

## Executor Assignment

executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["npm run lint", "npm run typecheck", "npm test", "npm run build", "review auth/ACL", "staging smoke"]

Execução especializada: Echo backend, Nova frontend, DevOps publicação. Revisor independente da implementação.

## Story

Como usuário do Painel Alpha, quero que lentidão temporária do banco e serviços auxiliares seja limitada, diagnosticável e recuperável, para continuar trabalhando sem perder rascunhos, repetir operações ou ter minha sessão tratada incorretamente como revogada.

Origem: solicitação direta do usuário para executar todas as melhorias documentadas em staging e produção. Não há epic de produto novo: correção operacional vinculada ao [relatório de incidente](../reports/investigacao-lentidao-conexao-2026-10-26.md) e à [arquitetura aprovada para execução](../architecture/estabilidade-painel-20261026.md). Base investigada ca156313; candidato também preserva filho concorrente20f310 (CRM mês protocolar), sem mudança estrutural de banco.

## Acceptance Criteria

1. Transporte default10 s, auth12 s, SSR20 s, cliente sessão30 s e frame45 s são finitos/configuráveis/validados conforme limites da arquitetura. Headers e corpo permanecem limitados; csrf+session compartilham budget total. Fixture real de relógio falso5.502 ms passa e após10 s aborta.
2. Autorização permanece fail-closed: sem public user durante indisponibilidade; inativo/revogado/version mismatch negados; slots8 auth/4 SSR só liberados quando SDK real termina. Sem cache positivo de acesso. Uma repetição estrita de leitura auth/BPM pode reconhecer timeout tipado com saldo; POST/transação/escrita nunca ganham retry automático.
3. Logs estruturados distinguem admissão, duração observer/SDK e headers/body/falha; sem SQL, args, tokens, URLs privadas, PII ou raw Error. Não chamar diferença não correlacionada de mutex medido.
4. Pollers globais só rodam no principal com sessão/permissões corretas, sem sobreposição, com cancel/backoff/Retry-After bounded. Heartbeat mantém20 s saudável e confirmação Auth.js antes de encerrar sessão; broadcast mantém15 s visível e notificações mantêm consolidação/cursor/dismiss sem duplicatas. Lembretes não repetem automaticamente action que também escreve.
5. Toda rejeição de notas/workspace/lembretes atingidos é consumida e tem recuperação visível. Hidratação inicial não gera upsert sem mudança; sync antigo não pisa estado novo. Rascunho/texto/abas/intenção ficam preservados; nenhuma mensagem falsa de salvo, reload ou replay de write desconhecido.
6. APIs IA distinguem AUTH_UNAVAILABLE, metadata/config e upstream por HTTP+code público seguro; models falha não retorna200. Consumidores mostram indisponibilidade sem apagar conversa/pins. Onyx mantém token individual/owner ACL, signal externo+deadline e body bounded para JSON sem encerrar SSE pelo limite de JSON. Voz mantém fallback e backoff existentes.
7. Política geolocation=() e demais headers permanecem; widgets não chamam geo quando bloqueada/sem evidência de permissão. Iframe preserva fullscreen com atributo allow sem redundância.
8. Versão antiga gera somente aviso e ação manual, com health version no-store/SHA válido também testável em staging. Sem auto-reload/remount/limpeza. Atualização manual passa por guardas dos frames e preservação de drafts; frame sem resposta não autoriza descarte.
9. Lint, typecheck, testes e build executados com sucesso; revisão de auth/ACL, Probe e Lens após Forge; checklist e file list atualizados com resultados reais. Não alterar schema/migration/dados em massa nem importar trabalho remoto alheio cegamente.
10. Deploy e validação primeiro staging com banco staging separado e `.env.staging.local`; depois mesmo conteúdo em produção autorizada pelo usuário com binding production preservado, recibos de hash/deployment/horários, observação10–15 min e rollback de código pronto. Sem testes de falha/caos em produção.

## 🤖 CodeRabbit Integration

Tipo principal: API/estabilidade; secundários: frontend, segurança, integração e deploy; complexidade alta pelo alcance transversal, sem nova arquitetura de produto. Primário @dev; especialistas Echo/Nova; apoio @architect, @qa/Anubis/Probe e @devops. Sem schema: Vault somente se surgir escopo estrutural separado.

- [ ] Pre-Commit @dev: revisão antes de marcar entrega completa.
- [ ] Pre-PR @devops: compatibilidade e origem do artefato, se houver PR.
- [ ] Pre-Deployment @devops: configuração, segurança e rollback antes de produção.

Self-healing: @dev light2 iterações/15 min/CRITICAL; HIGH documentado. @qa full3/30 min/CRITICAL+HIGH. @devops check/report only. Se CLI indisponível, registrar evidência e aplicar fallback de revisão manual previsto no core-config, sem fingir execução. Foco: replay, fail-closed, cancel/cleanup, estado local, contratos HTTP e segredos.

## Tasks / Subtasks

- [x] Aria: mapear base publicada, analisar trade-offs e documentar arquitetura antes do código (AC1–10).
- [x] River: preparar story com owners/ACs/testes; Pax: validar prontidão documental (AC9).
- [x] Echo: configuração bounded, transporte e observabilidade segura (AC1–3), validação focada local.
- [x] Echo: alinhar auth/SSR e classificação estrita de leitura BPM; heartbeat503 seguro (AC1–4), validação focada local.
- [x] Echo: contratos IA/token individual, body/signals JSON e version endpoint staging (AC6,8), validação focada local.
- [x] Nova: alinhar cliente sessão/frame; habilitação por identidade, pollers e backoff/cancel/Retry-After (AC1,4).
- [x] Nova: catches e hidratação/persistência workspace; preservar drafts e resultado desconhecido (AC5).
- [x] Nova: estados recuperáveis IA, policy geo/fullscreen e aviso de versão com guardas (AC6–8).
- [x] Sage/QA: casos locais de prazo/falha, auth/ACL, concorrência, troca de identidade, desmontagem e preservação;9arquivos/94testes PASS (AC1–9). Validação ambiental permanece separada.
- [x] Forge: lint/typecheck/test/build reais e runtime local, conforme rodada5 e revalidação incremental documentada (AC9).
- [x] Probe: integração local após Forge;11arquivos/79testes PASS e wiring conferido (AC9).
- [x] Anubis: revisão de segurança após Forge/Probe;13arquivos/103testes PASS, sem bloqueante novo no hotfix (AC9).
- [x] Lens: revisão manual de qualidade após os gates anteriores; bloqueante de refetch corrigido, delta aprovado após Forge rodada6 (AC9).
- [ ] DevOps: preparar candidato preservando20f310 e refs concorrentes; conferir env/binding; publicar staging (AC10).
- [ ] DevOps/Probe: smoke autenticado staging, evidências de pollers/codes/drafts e aceitar recuperação (AC4–10).
- [ ] DevOps: produção após staging, recibos/monitoramento/rollback, sem mutação estrutural (AC10).
- [x] Scribe/Kowalski: consolidar mapa/journal, checklist e file list documental; deploy/homologação staging e produção permanecem pendentes (AC9–10).

## Dev Notes

Ler arquitetura se precisar dos detalhes completos. Contratos executáveis resumidos: DB10 s clamp1–12; auth12 s clamp3–15 e >=DB+1; SSR20 s clamp5–25 e >=DB+2; browser30 s mínimo30 máximo60; frame45 s mínimo45 máximo90. Máximos server auth15+write12 cabem browser30 e auth15+SSR25 cabem frame45. Env inválida recai em default seguro. Pools8/4 permanecem; races não liberam vaga antes de settlement.

Echo possui `src/lib/db-fetch.ts`, `src/lib/prisma.ts`, `src/lib/auth/acesso-painel.ts`, `src/lib/painel-leituras-ssr.ts`, configuração server, API heartbeat/IA/Onyx/health-version, retry BPM e actions workspace somente se contrato exigir. Nova possui cliente-sessao, Heartbeat/BroadcastBanner/NotificacaoFlutuante, useNotasLembretesPendentes, NotesGlobalTaskbar, BibbleChatHome/voz/geo, Onyx browser, PainelLayoutClient/constante frame e helpers client. Não editar arquivos do outro owner sem coordenação.

Heartbeat já usa React Query/backoff e é top-window; corrigir enabled undefined e key por identidade, não criar outro timer. `UsuariosOnline/page.tsx` tem cutoff20 s: não reduzir writes aumentando cadência saudável isoladamente. Notificações já agregam checklist/chamados: não duplicar poller. Lembrete action mistura read+Pusher+updateMany, portanto não é retry read-only. Broadcast15 visível/60 oculto, falha30→300; notificações6 saudável/30 oculto, falha até60 e Retry-After até300. Cada próximo poll ocorre após settlement.

Auth.js mantém claims criptografadas durante INDISPONIVEL sem identidade pública; não lançar dentro callback JWT, não trocar fail-closed por stale allow. Workspace espera hidratação, compara mudança real e preserva geração local. Mutation timeout significa resultado desconhecido; leitura de reconciliação é permitida, write replay não. Onyx não pode cair em token global e timeout de JSON não vale cegamente para stream SSE.

Geo permanece bloqueada por header. Version health indisponível não é logout; novo SHA não autoriza reload. UI de aviso acessível, ação teclado e feedback existentes, sem redesenho de módulos. Bancos separados; nenhuma migration necessária. Necessidade estrutural futura exige Vault/backup/explicação/confirmação específica, não aprovação genérica.

## Testing

Ampliar `tests/auth/{db-fetch,acesso-painel,heartbeat-status,prisma-vercel-runtime,painel-leituras-ssr,sessao-cliente-resiliencia,sessao-consumidores-resiliencia,iframe-sessao-resiliencia}` conforme nomes existentes; BPM retry/API/notificações; notas editor/salvamento/rascunhos; Bibble voice/Onyx security e Onyx token; layout embedded/security-headers/version-route.

Cenários obrigatórios:5.502 ms vs deadline10 s; body stalled e external abort; fetch POST exatamente1; observer expirado com SDK ainda pendente; late allow descartado; inativo/version mismatch; principal+3frames somente1poller/canal; foco+reconnect sem overlap; troca usuário cancelando estado antigo; erro workspace sem unhandledrejection nem perda draft; falha models status!=200; metadata/auth/upstream distintos e redaction; SSE não cortado pelo JSON budget; geo sem chamada; aviso de nova versão sem reload e guardas recusando descarte.

Executar `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Injeção de lentidão/falha somente testes ou staging controlado. Recibo staging cobre home/checklist/cadastro/calendário, autenticação, drafts, notificações e IA; recibo produção inclui janela10–15 min. Comparações de carga usam janela/origem equivalentes, sem inventar p95 ou atribuir todos503 ao banco.

## Change Log

| Date | Version | Description | Author |
| --- | --- | --- | --- |
| 2026-10-26 | 0.1.0 | Story criada do relatório e arquitetura; Status Draft | River / @sm |
| 2026-10-26 | 0.1.1 | Validated GO (9/10) — Status: Draft → Ready; escopo/testes/owners/riscos rastreáveis | Pax / @po |
| 2026-10-26 | 0.2.0 | Backend limitado e instrumentado, códigos IA sanitizados, deadlines JSON e testes focados; Status In Progress | Echo |

## Dev Agent Record

### Agent Model Used

Preparação documental: GPT-6 / Aria, River e Pax em sequência por instrução do lead. Backend: GPT-6 / Echo em worktree isolada.

### Debug Log References

Sem execução de aplicação nesta preparação. Relatório de origem aponta artefatos privados de diagnóstico fora do Git.

Backend: `/var/tmp/alpha-estabilidade-20261026/echo-focused.log` (fora do Git, somente fixtures; AUTH_SECRET descartável de teste). Handoff e contratos em `docs/reports/estabilidade-painel-20261026-echo.md`.

### Completion Notes List

Aprovação PO é da prontidão da story, não dos quality gates nem da produção. Prontidão9/10, confiança alta no desenho; resultado de conectividade externa continua dependente de medição. Sem blocker documental crítico. Risco residual: SDK mutex, resultado de writes desconhecido, migração de contrato HTTP e drafts; mitigados pelos ACs. Atualizar com resultados reais.

### File List

- `docs/reports/estabilidade-painel-20261026-sage.md` — QA local e limites; ampliados `tests/notas/workspace-resiliencia-react.test.tsx` e `tests/layout/estabilidade-consumidores-react.test.tsx` com seis regressões, sem appcode.
- `docs/reports/estabilidade-painel-20261026-lens.md` — revisão manual e reprodução real de concorrência do QueryObserver; sem appcode alterado por Lens.

Criados nesta preparação:

- `docs/architecture/estabilidade-painel-20261026.md`
- `docs/stories/story-estabilidade-painel-conexao-20261026.md`
- `docs/reports/investigacao-lentidao-conexao-2026-10-26.md` (cópia integral do diagnóstico já existente no checkout raiz)

Arquivos de app/test/env efetivamente alterados serão acrescentados pelos executores; lista de ownership acima é planejamento.

Backend efetivamente alterado:

- `src/lib/db-resilience-config.ts`, `src/lib/db-observability.ts`, `src/lib/db-transport-error.ts`, `src/lib/db-fetch.ts`
- `src/lib/auth/acesso-painel.ts`, `src/lib/painel-leituras-ssr.ts`, `src/lib/bpm/alertas-leitura-retry.ts`
- `src/lib/http-deadline.ts`, `src/lib/ai-unavailability.ts`, `src/lib/onyx/client.ts`, `src/lib/bibble/voice-service.ts`
- `src/app/api/heartbeat/route.ts`, `src/app/api/bpm/tarefas/alertas/route.ts`, `src/app/api/health/version/route.ts`
- `src/app/api/bibble/models/route.ts`, `src/app/api/bibble/voice/route.ts`, `src/app/api/onyx/agents/route.ts`, `src/app/api/onyx/voice/status/route.ts`
- `tests/auth/db-fetch.test.ts`, `tests/auth/db-resilience-config.test.ts`, `tests/auth/db-observability.test.ts`, `tests/auth/acesso-painel.test.ts`, `tests/auth/heartbeat-status.test.ts`, `tests/auth/painel-leituras-ssr.test.tsx`
- `tests/bpm/alertas-leitura-retry.test.ts`, `tests/onyx/client-user-token.test.ts`, `tests/onyx/routes-user-token.test.ts`, `tests/bibble/availability-routes.test.ts`, `tests/roadmap/production-version-route.test.ts`
- `docs/reports/estabilidade-painel-20261026-echo.md`

## QA Results

### Sage — 26/10/2026,22:10UTC

**APROVADO LOCAL:**9arquivos/94testes PASS,1,78s, com seis regressões novas para leitura/escrita antigas após troca de identidade, leitura/action após desmontagem e limites de Retry-After. Abas/drafts/estado novo preservados, sem toast tardio ou escrita cruzada. ESLint das2fixtures0errors/0warnings; aplicação intacta. AUTH_SECRET e DBURLs exclusivamente sintéticos depois de conferir bindingstaging. Recibos Forge/Anubis cobrem os demais limites auth/slots/cancel/JSON/SSE/ownership; subconjuntos não somados à suíte integral. QA remoto e publicação staging→produção ainda pendentes. Detalhes e limites no relatório Sage.

### Lens — revisão final do delta, 26/10/2026, 22:06 UTC

**APROVADO:** workspace e reconsulta manual da nota usam cancelRefetch:false, preservando a Server Action em voo. Regressões reais de cache preenchido/mensagens/cliques confirmam active1/peak1 e preservação de aba/draft. Recibo Forge rodada6 conferido: TCNext/lint/63focados/build/runtime aprovados, fonteaa16cb5a…; nenhum novo teste executado por Lens nesta revisão proporcional. Zero bloqueantes abertos no patch. Fallback manual CodeRabbit realizado; Sage e QA autenticado staging→produção continuam pendentes. Somente relatório Lens/story alterados.

### Lens — 26/10/2026, correção solicitada

**REPROVADO:** `useNotasWorkspaceSync.ts:78` usa `refetch()` com cancelRefetch padrão true. Depois de preencher cache, reconsultas próximas cancelam apenas o observador e iniciam outras Server Actions não canceláveis. Reprodução com QueryObserver instalado confirmou peak2 ações simultâneas; a opção cancelRefetch:false confirmou peak1. Nova deve usar a opção no refresh do workspace e na reconsulta manual da nota, com regressão de cache preenchido + múltiplos eventos/refetch mantendo rascunhos. Demais áreas examinadas sem outro bloqueante novo. Revisão manual efetiva no fallback permitido para CodeRabbit ausente; nenhuma alteração app/test/env/schema/deploy feita por Lens. Relatório: `docs/reports/estabilidade-painel-20261026-lens.md`.

Pendente: nenhum gate runtime, lint, typecheck, teste, build ou deploy foi executado pelo preparador documental. Veredito de entrega somente após evidências.

Echo: suíte focada final14arquivos/115testes aprovada e ESLint direcionado nos18arquivos backend sem erro; `git diff --check` sem erro. Gates completos Forge/Probe/Anubis/Lens/Sage ainda pendentes; esta evidência não autoriza declarar a entrega homologada.


### Nova — execução frontend26/10/2026

Handoff completo/file list: `docs/reports/estabilidade-painel-20261026-nova.md`. Criados app: `src/lib/{painel-polling,geolocation-policy,ai-availability-client}.ts`, `src/hooks/useNotasWorkspaceSync.ts`, `src/components/layout/PainelVersionNotice.tsx`. Alterados app: `src/lib/auth/cliente-sessao.ts`, `src/lib/painel-embedded.ts`, `src/lib/onyx/browser.ts`, `src/components/{Heartbeat,BroadcastBanner,NotificacaoFlutuante}.tsx`, `src/hooks/useNotasLembretesPendentes.ts`, `src/components/Notas/NotesGlobalTaskbar.tsx`, `src/components/BibbleChatHome/{BibbleChatLayout,useVoiceStatus,BibbleWeatherWidget,BibbleSpriteCompanion}.*`, `src/components/layout/PainelLayoutClient.tsx`, `src/app/PainelAlpha/layout.tsx` (wiring público SHA40 aprovado).

Testes criados: `tests/auth/cliente-sessao-budget.test.ts`, `tests/layout/estabilidade-consumidores-react.test.tsx`, `tests/notas/{workspace-resiliencia-react,taskbar-rejeicoes-react}.test.tsx`, `tests/bibble/availability-client.test.ts`. Adaptados: `tests/auth/{sessao-cliente-resiliencia,iframe-sessao-resiliencia}.test.tsx`, `tests/layout/painel-frame-guards-composition.test.tsx`, `tests/bibble/voice-status-react.test.ts`, `tests/chamados/{feedback-ui,central-notificacoes-painel}.test.ts`.

Suíte final16arquivos/128testes PASS sem unhandled errors; ESLint direcionado29arquivos e novos testes IA/voz sem erro/warning; diff-check PASS. Tsc isolado heap4GB terminou OOM: NÃO é aprovação, Forge executará gate8GB. Nenhum gate global/deploy concluído. Aviso de versão orientativo sem ação destrutiva aprovado pelo lead porque os frames legados não garantem preservação universal; nenhum auto-reload/remount/limpeza implementado. Logs privados em `/var/tmp/alpha-estabilidade-20261026/nova-focused-final.log` e `nova-eslint-final.log`.

### Forge — rodada1 (26/10/2026, 21:28 UTC)

**REPROVADO:** `npm run typecheck` real com8GB terminou exit2/55,934s: TS2307 de bundle gerado ausente (preparo existente `npm run build:player` executado com sucesso) e TS2339 novo em `BibbleChatLayout.tsx:228`, propriedade `capabilities` sobre `{}` inferido. Devolvido a Nova. Nenhum lint/test/build global ou deploy iniciado; checkbox Forge permanece pendente. CodeRabbit ausente, fallback de revisão manual previsto em core-config; não equivale a aprovação automatizada. Evidência e file list Forge: `docs/reports/estabilidade-painel-20261026-forge.md`.

### Forge — rodada2 (26/10/2026, 21:33 UTC)

Typecheck oficial8GB PASS/8,455s e lint global PASS/47,375s,0errors/1.172warnings fora dos arquivos alterados. Suíte integral com cobertura e4workers **FAIL**/184,181s:814arquivos(806pass/8fail),6.744testes pass/21fail/38skipped/1todo. Nova: corrigir contrato de sessão das fixtures `notifications-subscription` e `eventos-recovery-client` (11falhas), mantendo guard fail-closed. Harness: segredo AUTH_SECRET sintético ausente foi preparado para próximo rerun;4setupsSQLite30s e1CLI5s serão revalidados com1worker, sem relaxar prazos. Build/runtime não iniciados; gate Forge ainda pendente. Detalhes e file list no relatório Forge, com logs anteriores preservados.

### Forge — rodada3 (26/10/2026, 21:44 UTC)

Typecheck PASS/8,642s; lint da aplicação intacta reutilizado e fixtures Nova com ESLint focado PASS. Suíte integral cobertura/1worker **PASS**/304,909s:814arquivos,6.801testes/4skipped/1todo. Build literal **PASS**/108,705s. Contudo, smoke local SSR de `/` e `/login` retornou500 por `document` ausente em `BroadcastBanner.tsx:23` (refetchInterval avaliado também durante SSR). **Forge continua REPROVADO**, Nova deve guardar callbacks e cobrir SSR real; sem promoção. APIs anônimas401/headers preservados; servidor próprio encerrado e porta3478 livre. Relatório detalhado e file list: `docs/reports/estabilidade-painel-20261026-forge.md`.

### Forge — rodada4 (26/10/2026, 21:47 UTC)

Guarda SSR e teste Node adicionados por Nova; única mudança app comprovada por reconstrução/hash. Typecheck oficial com validadores `.next/types` do build anterior **FAIL**/62,369s: GET opcional `Request|undefined` da rota models viola contrato Next RouteHandler. Devolver Echo para parâmetro Request obrigatório/testes concretos; não ignorar tipos gerados. Nenhum gate adicional ou processo ativo nesta rodada; Forge/deploy permanecem pendentes. Fonte/log/file list no relatório Forge.

### Forge — rodada5 (26/10/2026, 21:51 UTC)

**APROVADO.** Typecheck oficial com validadores Next PASS antes8,822s/depois14,719s do build final; lint global anterior0errors mais deltas finais0errors/0warnings. Suíte integral anterior814arquivos/6.801testes PASS com cobertura reutilizada proporcionalmente: hash comprova apenas dois deltas app (guarda SSR Broadcast e Request obrigatório models); regressões finais3arquivos/22testes PASS. Não afirmar suíte integral repetida na fonte final. Build literal final PASS/50,372s. Login real `/`200, painel anônimo307para`/`, sessão200/null e APIs protegidas401; `/login`404legítimo. Health503/no-store esperado local sem metadadosVercel. SSR sem erro, headers preservados, servidor próprio encerrado/ECONNREFUSED3478. Fonte finalce48c29e… idêntica antes/depois. File list acrescida: `tests/layout/pollers-ssr.test.tsx` (Nova) e `docs/reports/estabilidade-painel-20261026-forge.md` (Forge); detalhes/limites no relatório. Liberado para próximos gates; nenhuma publicação realizada.


Nova, correção pontual pós-Forge: `src/components/BibbleChatHome/BibbleChatLayout.tsx` recebeu contrato `BibbleModelsResponse` e generic explícito em `useQuery`, corrigindo inferência TS2339 sem `any`/casts. Testes IA client7PASS, lint direcionado0errors/0warnings; typecheck global reservado ao Forge. Sem outro appcode/schema/env/deploy.


Nova, fixtures CheckList pós-suite global: `tests/checklist-analistas/{notifications-subscription,eventos-recovery-client}.test.tsx` ajustam sessão autorizada explícita e cobrem INDISPONIVEL sem fetch. Recovery de página2 respeita cooldown6s com relógio controlado.2arquivos/15testes PASS; ESLint0errors/0warnings. Nenhum appcode/canPoll enfraquecido; gates globais continuam Forge.


Nova, correção SSR pós-smoke Forge: `src/components/BroadcastBanner.tsx` protege acesso document.hidden no callback avaliado por React Query em SSR mesmo disabled. Novo `tests/layout/pollers-ssr.test.tsx`: renderToString real semwindow/document dos pollers/hooks em4estadosauth, semfetch.2arquivos/13testesPASS comregressõesconcorrência; lint0errors/0warnings/diffcheckPASS. Build/runtime globais permanecem Forge; nenhumauth/backoffrelaxado.

### Probe — integração local (26/10/2026,21:54 UTC)

**APROVADO LOCAL.** Wiring de pollers globais/auth/iframes, taskbar/workspace/rascunhos, codes IA/voz por identidade, policy geo/fullscreen e SHA server→shell→health conferidos contra blueprint. Execução própria:11arquivos/79testes de integração PASS,2,97s,sem unhandled; fixtures com segredo/DB locais sintéticos, sem I/O de negócio real. Smoke HTTP compilado e gates globais são evidências Forge reaproveitadas, não novas execuções Probe. Não houve Chromium autenticado, deploy, comparação de carga ou validação de upstream real. Smoke autenticado staging→produção permanece DevOps e checkbox ambiental continua pendente. File list Probe: `docs/reports/estabilidade-painel-20261026-probe.md` e esta story; sem appcode/test/schema/env alterados.

### Anubis — segurança do hotfix (26/10/2026)

**APROVADO no escopo da entrega**, após Forge e Probe. Comparação com20f310 confirmou autorização fail-closed/identidade pública ausente durante indisponibilidade, retenção real de slots8/4, retry apenas de leitura, métricas sem dados sensíveis, token Onyx individual/ownership, cancelamento JSON/SSE e isolamento de cache por usuário. Execução própria13arquivos/103testes PASS,1,67s, segredo/DB sintéticos locais após conferir binding staging; sem I/O remoto de negócio. Não somar esse subconjunto à contagem integral Forge. Não é scan completo do repositório nem homologação autenticada staging/prod. File list: `docs/reports/estabilidade-painel-20261026-anubis.md` e esta story; nenhuma aplicação/teste/schema/env alterado. Próximo gate Lens; rollout ambiental permanece pendente.


Nova, blocker Lens concorrência: `src/hooks/useNotasWorkspaceSync.ts` e `src/components/Notas/NotesGlobalTaskbar.tsx` usam refetch({cancelRefetch:false}) para leituras Server Action não abortáveis. Regressões reais com cache preenchido/eventos/cliques e leitura pendente em `tests/notas/{workspace-resiliencia-react,taskbar-rejeicoes-react}.test.tsx` provam active1/peak1 e preservação de draft/aba.5arquivos/41testesPASS, lint4arquivos0errors/0warnings e diff-checkPASS; gates proporcionais/revisão delta reservados Forge/Lens.

### Forge — rodada6 pós-Lens (26/10/2026, 22:05 UTC)

**APROVADO:** typecheck com.next/types9,125s; lint4arquivos do delta0errors/0warnings;8arquivos/63testes de notas/concurrency/drafts/SSR/models PASS; build literal95,295s e smoke local login`/`200, painel307→`/`, sessão200/null e APIs401, sem500/headers alterados. Health503 esperado local semVercel. Fonteaa16cb5a… idêntica antes/depois. Suíte integral814arquivos/6.801testes com cobertura anterior reutilizada proporcionalmente, não repetida nem somada ao subconjunto. Servidor próprio encerrado e3478ECONNREFUSED; liberado para revisão Lens do delta. File list Forge: relatório e esta story; nenhuma app/schema/env/deploy alterada pelo verificador.


### Scribe/Kowalski — consolidação documental pré-rollout (2026-10-26)
Mapas e memória atualizados somente por append em `.bibble/memory/{codebase-map,integration-points,components,patterns,decisions,architecture,known-errors,journal,session-draft}.md`; histórico e draft alheio preservados. File list documental adicional: esses9arquivos. Gates locais aprovados conforme recibos Forge/Probe/Anubis/Lens/Sage; nenhum novo teste executado pelo cronista, nenhum app/test/env/schema/commit/deploy alterado. **Deploy e homologação autenticada de staging/produção continuam PENDENTES** para DevOps.
