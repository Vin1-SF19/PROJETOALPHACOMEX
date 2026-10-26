# Story — Resiliência da sessão e carregamento durante falha temporária do banco

**Status:** In Progress — integração local de staging concluída; reteste Sage focal/Chrome PASS; gates globais/revisões/publicação pendentes
**Data:** 2026-10-26
**Base original:** origin/staging b115dd3802485e9b0a049f2a45a5010db77338b5; integrado localmente o avanço fb0e8546d75e95f96e780f2049b43d75f6466e15
**Pedido:** “realize as melhorias necessarias”, após diagnóstico de intermitência do banco, falso logout e carregamento prolongado. Autoriza desenvolvimento, testes e staging; produção exige promoção explícita.

## Resultado esperado

Usuário válido mantém sua identidade durante indisponibilidade temporária, recebe feedback recuperável e volta após revalidação válida. Toda operação protegida falha fechada durante essa indisponibilidade. Revogação real continua encerrando acesso.

## Referências

- Diagnóstico privado: `/home/ialpha/.config/painel-alpha/incidente-painel-banco-20261026/{echo-causal,devops-runtime}.md`.
- Contrato: `docs/architecture/sessao-resiliencia-banco-20261026.md`.
- Blueprint/inventário privado: `/home/ialpha/.config/painel-alpha/sessao-resiliencia-20261026/`.

## Critérios de aceitação

- [x] AC1 — Distinguir PERMITIDO, NEGADO DEFINITIVO e INDISPONÍVEL. Falha DB preserva claims JWT/cookie e nunca concede operação protegida; JWT não lança para sinalizar indisponibilidade.
- [x] AC2 — auth() servidor rejeita temporário fora do JWT; DTO público temporário não contém user autorizável. APIs protegidas mapeiam503 recuperável/no-store; actions negam sem efeitos; RSC oferece recuperação sem redirect ao login por falha DB.
- [x] AC3 — Usuário inativo/inexistente, identidade inválida e authSessionVersion divergente continuam bloqueados e não ressuscitam após recuperação; permissões/ownership existentes preservados.
- [x] AC4 — Transporte HTTP tem prazo curto com cancelamento real inclusive body e signal existente; retry no máximo limitado à leitura segura de revalidação. Nenhum replay automático de writes/transações.
- [x] AC5 — Heartbeat tem uma tentativa ativa, deadline/backoff/cleanup e logout só definitivo. Iframe em `/` confirma estado antes de logout; indisponibilidade preserva shell/rascunhos e timeout15s existente.
- [x] AC6 — Confirmação de login termina em prazo e ignora respostas atrasadas; estado desconhecido nunca vira AUTH_SUCCESS. Recuperação não exige novo login da sessão válida existente.
- [ ] AC7 — Testes causais comprovam cookies reais Auth.js, guards servidor/REST/action/RSC, abort do body, timers/no overlap e revogação. Gates lint/typecheck/test/build executados e revisão Forge→Probe/Anubis/Lens concluída.
- [ ] AC8 — Publicar e validar primeiro staging com ambiente/banco conferidos; preservar alterações concorrentes. Sem schema, migration, cópia de dados/credenciais ou mudança em produção.

## Tarefas e ownership (sequencial)

- [x] Scout: mapear fluxos, consumidores e dependências; preparar candidato isolado, blueprint e contrato.
- [x] Perspectiva Architect/Bibble: contrato mínimo fail-closed e ordem da entrega documentados.
- [x] Echo: estados/DTO/facade, transporte, HTTP mapper e pontos de servidor; File List atualizada.
- [x] Nova: heartbeat, login e shell/fallback de recuperação; manter rascunhos e15s.
- [x] Sage: auditoria causal independente e regressões executadas; três achados reparados por Nova e reteste focal/Chrome PASS em 26/10/2026.
- [ ] Forge: lint, typecheck, npm test e build reais; registrar evidências e limitações.
- [ ] Probe/Anubis/Lens: integração, fronteiras de auth e qualidade; fechar achados.
- [ ] DevOps: preservar staging mais recente, publicar e validar staging; nenhuma promoção implícita.
- [ ] Scribe/Kowalski: consolidar memória e story com evidência final.

## DoD

- [ ] Todos ACs verificados; checklist/file list refletem apenas o que foi executado.
- [ ] Nenhuma operação protegida autorizada com estado temporário; nenhuma deleção de cookie por falha transitória.
- [ ] Staging publicado e validado com identificação do commit/deployment e limites do smoke.
- [ ] Nenhum segredo/PII/artifact de build/dump entrou no Git; nenhuma alteração alheia revertida/incluída.

## File List

Arquivos efetivamente criados/editados nas estações Echo/Nova (não inclui artefato player ignorado):

- `auth.ts`
- `docs/architecture/sessao-resiliencia-banco-20261026.md`
- `docs/architecture/sessao-resiliencia-handoff-nova-20261026.md`
- `docs/stories/story-painel-alpha-resiliencia-sessao-banco-20261026.md`
- `src/actions/bpm/Anexos.ts`
- `src/actions/protocolos.ts`
- `src/app/api/ChatBot/AbrirChamado/route.ts`
- `src/app/api/ChatBot/route.ts`
- `src/app/api/ConsultaCompleta/route.ts`
- `src/app/api/ConsultaCpf/route.ts`
- `src/app/api/ConsultaRadar/route.ts`
- `src/app/api/ConsultaRadarCsv/route.ts`
- `src/app/api/EmpresaAqui/route.ts`
- `src/app/api/RadarFiscal/route.ts`
- `src/app/api/ReceitaFederal/route.ts`
- `src/app/api/alpha-catcher/diagnostico/route.ts`
- `src/app/api/alpha-catcher/historico/[id]/route.ts`
- `src/app/api/alpha-catcher/historico/route.ts`
- `src/app/api/alpha-catcher/importacoes/json/route.ts`
- `src/app/api/alpha-catcher/logcomex/route.ts`
- `src/app/api/alpha-catcher/route.ts`
- `src/app/api/alpha-seo/mcp/keys/route.ts`
- `src/app/api/alpha-seo/mcp/oauth/authorize/route.ts`
- `src/app/api/alpha-seo/oauth/[product]/callback/route.ts`
- `src/app/api/alpha-seo/oauth/[product]/start/route.ts`
- `src/app/api/alpha-seo/sam/stream/route.ts`
- `src/app/api/apresentacoes/[id]/exportar-html/route.ts`
- `src/app/api/apresentacoes/[id]/importar-pptx/route.ts`
- `src/app/api/apresentacoes/[id]/miniatura/route.ts`
- `src/app/api/apresentacoes/[id]/pptx-preview/route.ts`
- `src/app/api/apresentacoes/[id]/pptx-upload/route.ts`
- `src/app/api/apresentacoes/assets/route.ts`
- `src/app/api/apresentacoes/fontes/route.ts`
- `src/app/api/apresentacoes/gerar-slide/route.ts`
- `src/app/api/bibble/chat/route.ts`
- `src/app/api/bibble/cloud-providers/route.ts`
- `src/app/api/bibble/curiosidade/route.ts`
- `src/app/api/bibble/falas/route.ts`
- `src/app/api/bibble/gerar-ficha/route.ts`
- `src/app/api/bibble/models/route.ts`
- `src/app/api/bibble/piada/route.ts`
- `src/app/api/bibble/projects/[id]/route.ts`
- `src/app/api/bibble/projects/route.ts`
- `src/app/api/bibble/sessions/[id]/messages/route.ts`
- `src/app/api/bibble/sessions/[id]/route.ts`
- `src/app/api/bibble/sessions/route.ts`
- `src/app/api/bibble/upload-to-blob/route.ts`
- `src/app/api/bibble/upload/route.ts`
- `src/app/api/bibble/voice/route.ts`
- `src/app/api/blueprint/chat/route.ts`
- `src/app/api/blueprint/gerar-layout/route.ts`
- `src/app/api/blueprint/gerar-prompt/route.ts`
- `src/app/api/blueprint/upload/route.ts`
- `src/app/api/bpm/anexos/[anexoId]/preview/route.ts`
- `src/app/api/bpm/anexos/[anexoId]/route.ts`
- `src/app/api/bpm/cards/[cardId]/contrato/route.ts`
- `src/app/api/bpm/leads/alertas/route.ts`
- `src/app/api/bpm/tarefas/alertas/route.ts`
- `src/app/api/bpm/upload/direct/route.ts`
- `src/app/api/bpm/upload/finalize/route.ts`
- `src/app/api/bpm/upload/route.ts`
- `src/app/api/chatbotx/open/route.ts`
- `src/app/api/comissoes/comprovantes/[paymentId]/route.ts`
- `src/app/api/contratos/[contratoId]/assinado-financeiro/route.ts`
- `src/app/api/contratos/upload/route.ts`
- `src/app/api/cs-nps/exportar/route.ts`
- `src/app/api/cs-nps/importar/modelo/route.ts`
- `src/app/api/cs-nps/importar/previsualizar/route.ts`
- `src/app/api/cs-nps/importar/salvar/route.ts`
- `src/app/api/documentos/route.ts`
- `src/app/api/estoque/itens/[itemId]/imagem/route.ts`
- `src/app/api/estoque/itens/[itemId]/nota-fiscal/route.ts`
- `src/app/api/gerador-documentos/[id]/download/route.ts`
- `src/app/api/gerador-documentos/clientes/[clienteId]/historico/route.ts`
- `src/app/api/gerador-documentos/gerar/route.ts`
- `src/app/api/heartbeat/route.ts`
- `src/app/api/holerites/[id]/download/route.ts`
- `src/app/api/holerites/upload/route.ts`
- `src/app/api/integrations/alpha-crm/entry/route.ts`
- `src/app/api/integrations/alpha-crm/opportunities/route.ts`
- `src/app/api/mesclagem/exportar/route.ts`
- `src/app/api/mesclagem/historico/[id]/arquivo/[tipo]/route.ts`
- `src/app/api/mesclagem/inspecionar/route.ts`
- `src/app/api/mesclagem/previa/route.ts`
- `src/app/api/mesclagem/sugerir/route.ts`
- `src/app/api/mesclagem/template/route.ts`
- `src/app/api/metas/justificativas/[id]/route.ts`
- `src/app/api/metas/justificativas/upload/route.ts`
- `src/app/api/notas/anexos/[id]/route.ts`
- `src/app/api/notas/upload/route.ts`
- `src/app/api/notificacoes/route.ts`
- `src/app/api/onboarding/marcar-visto/route.ts`
- `src/app/api/onyx/agent-tools/register/route.ts`
- `src/app/api/onyx/agentes-fixados/route.ts`
- `src/app/api/onyx/agents/[id]/avatar/route.ts`
- `src/app/api/onyx/agents/[id]/route.ts`
- `src/app/api/onyx/agents/generate-avatar/route.ts`
- `src/app/api/onyx/agents/route.ts`
- `src/app/api/onyx/agents/upload-image/route.ts`
- `src/app/api/onyx/chat/route.ts`
- `src/app/api/onyx/connectors/[ccPairId]/route.ts`
- `src/app/api/onyx/connectors/credentials/route.ts`
- `src/app/api/onyx/connectors/document-sets/route.ts`
- `src/app/api/onyx/connectors/route.ts`
- `src/app/api/onyx/connectors/upload/route.ts`
- `src/app/api/onyx/extrato/reprocessar/route.ts`
- `src/app/api/onyx/extrato/route.ts`
- `src/app/api/onyx/file/[fileId]/route.ts`
- `src/app/api/onyx/image-models/route.ts`
- `src/app/api/onyx/llm-models/route.ts`
- `src/app/api/onyx/session/[id]/route.ts`
- `src/app/api/onyx/tools/route.ts`
- `src/app/api/onyx/voice/synthesize/route.ts`
- `src/app/api/onyx/voice/transcribe/route.ts`
- `src/app/api/painel-alpha/clientes/[id]/timeline/route.ts`
- `src/app/api/pusher/auth/route.ts`
- `src/app/api/roadmap/production/mcp/keys/route.ts`
- `src/app/api/usuarios/avatar/route.ts`
- `src/lib/alpha-explorer/http.ts`
- `src/lib/auth/acesso-painel.ts`
- `src/lib/auth/estado-acesso.ts`
- `src/lib/auth/indisponibilidade.ts`
- `src/lib/checklist/http.ts`
- `src/lib/checklist/result.ts`
- `src/lib/checklist/types.ts`
- `src/lib/db-fetch.ts`
- `src/lib/prisma.ts`
- `src/lib/roadmap-production-api/response.ts`
- `src/types/next-auth.d.ts`
- `tests/auth/acesso-painel.test.ts`
- `tests/auth/db-fetch.test.ts`
- `tests/auth/sessao-resiliencia.test.ts`
- `vitest.config.ts`

## Validação Echo

- [x] Testes causais com handlers Auth.js GET/POST reais: cookie TEMP preservado, DTO sem user inclusive RSC, recuperação, revogação e update forjado.
- [x] Facade bloqueia Action/REST/heartbeat antes de efeitos; mapper direto e indireto503, envelope Checklist recuperável.
- [x] Deadline de body5s, abort de sinais/cancelamento, nenhum retry de write; mutex real medido.
- [x] Budget total5s e admissão8: SDK pendente não acumula fila ilimitada; slot retido até settlement e resultado tardio ignorado.
- [x] 178 testes em24arquivos aprovados (161auth/21arquivos); typecheck real aprovado; lint focal0erros/3warnings herdadas.
- [ ] UI/RSC de recuperação, timers/clientes, gates globais Forge, Probe/Anubis/Lens e publicação/smoke staging.

Contratos concretos e limites: `docs/architecture/sessao-resiliencia-handoff-nova-20261026.md`.
Logs600 e manifesto detalhado privados em `/home/ialpha/.config/painel-alpha/sessao-resiliencia-20261026/`.
Nenhum schema, migration, escrita em banco real, configuração cloud, commit/push ou deploy nesta estação.


## File List adicional Nova

- `src/app/layout.tsx`
- `src/app/PainelAlpha/layout.tsx`
- `src/app/PainelAlpha/error.tsx`
- `src/components/Heartbeat.tsx`
- `src/lib/auth/navegacao-sessao.ts`
- `src/lib/auth/cliente-sessao.ts`
- `src/components/auth/SessaoResilienteProvider.tsx`
- `src/components/auth/SessaoIndisponivel.tsx`
- `src/components/login/LoginTransitionProvider.tsx`
- `src/components/layout/PainelLayoutClient.tsx`
- `src/app/PainelAlpha/AlphaComm/page.tsx`
- `src/app/PainelAlpha/PainelTarefas/PainelTarefaC/page.tsx`
- `src/app/PainelAlpha/PainelTarefas/painelTarefaSG/page.tsx`
- `tests/auth/sessao-cliente-resiliencia.test.tsx`
- `tests/auth/login-resiliencia-react.test.tsx`
- `tests/auth/navegacao-sessao.test.ts`
- `tests/layout/painel-embedded.test.ts`

## Validação Nova — UI concluída localmente

- [x] Root usa leitor explícito; layout Painel trata TEMP antes de children e falhas nas queries adicionais. Boundary RSC posterior confirma sessão, com reset manual e sem interpretar mensagem opaca de Server Action.
- [x] Provider usa o SessionContext público do Auth.js, com snapshots do endpoint real e confirmação GET/POST+CSRF abortável até body (8s). Nenhum provider nativo paralelo nem uso de __NEXTAUTH/_getSession; useSession/update existentes preservados. Broadcast next-auth e React Query coordenam cross-tab, focus/reconnect e single-flight.
- [x] TEMP remove user; camada live fica montada/inert durante recuperação. Só fallback SSR inicial pode refresh após prova permitida; frames/rascunhos existentes não são recarregados.
- [x] Heartbeat tem uma tentativa, abort/cleanup, intervalo20–60s; recuperação5–30s com backoff inclusive TEMP HTTP200. Status401/403 ou iframe em / não provam revogação: exige resposta válida do protocolo de sessão. HTML/WAF/rede/503 não fazem logout.
- [x] Login arma watchdog8,5s antes de update limitado8s; geração invalida resultados antigos. Iniciar nova validação cancela consulta anterior no bridge. Sem AUTH_SUCCESS por TEMP/truthy/statusauthenticated.
- [x] Guards opcionais em três clientes legados impedem crash/redirecionamento por DTO semuser. Nenhuma mudança de papel/permissão/menu.
- [x] 24arquivos/183testes auth+iframe PASS, incluindo12novosReact. Teste de rascunho prova estadoReact+mesmo inputDOM após TEMP→PERMITIDO; broadcastlogin/logout, updateCSRF, dedupe, abortbody, lateNEGADO e loginhung/late cobertos. Typecheck real PASS. Lintfocal0erros/45warnings nos três arquivos legados, semwarning nos novos componentes. git diff --check PASS.
- [x] Echo SSR complementar: consultas adicionais+onboarding com orçamento5s/admissão4grupos, todos os subtrabalhos rastreados por allSettled e slots retidos até settlement; sem promessa de cancelamento SQL.
- [ ] Sage independente, Forge global, Probe/Anubis/Lens, publicação e validação staging. Nenhum browserE2E remoto nesta estação.

Artefatos privados: nova-implementation.md/.json e nova-{tests-final,typecheck-final,eslint-final}.log em /home/ialpha/.config/painel-alpha/sessao-resiliencia-20261026/. Sem commit/push/deploy/DB/env reais.

## Complemento Echo — orçamento SSR adicional, 26/10/2026

- [x] Grupo de leitura iniciado só após admissão (máximo4grupos por instância, separado do limite8auth).
- [x] Orçamento5s inclui permissões/usuário/links/onboarding; todos os subtrabalhos são observados atésettlement mesmo após timeout/primeira falha.
- [x] Slot não libera no primeiro reject; resultado tardio não renderiza children antigos nem inicia onboarding após expirar.
- [x] Null/INATIVO confirmado produz NEGADO e redirect fora do catch; indisponibilidade/full retorna fallback Nova sem children protegidos.
- [x] Cinco testes focais causais passaram; lint focal0erros/0warnings. Typecheck final registrado em echo-ssr-budget.md.
- [ ] Sage/Forge/Probe/Anubis/Lens, build/suíteglobal, browser e staging continuam pendentes conforme fluxo.

File List deste complemento:
- `src/lib/painel-leituras-ssr.ts`
- `src/app/PainelAlpha/layout.tsx`
- `tests/auth/painel-leituras-ssr.test.tsx`
- `docs/architecture/sessao-resiliencia-handoff-nova-20261026.md` — contrato atualizado.
- `docs/architecture/sessao-resiliencia-banco-20261026.md` — implementação SSR registrada.
- `docs/stories/story-painel-alpha-resiliencia-sessao-banco-20261026.md` — checklist/evidência.

Evidências privadas: `echo-ssr-budget.md/json`, `echo-ssr-tests.log`, `echo-ssr-typecheck.log`, `echo-ssr-eslint.log` em `/home/ialpha/.config/painel-alpha/sessao-resiliencia-20261026/`.


## Validação Sage — 26/10/2026, reparos necessários

- [x] Auditoria independente com handlers/cookies reais, facade/REST/action, SSR/admissão, abort/timers, login/bridge, shell iframe e consumidores reais. Nenhum appcode ou banco real alterado nesta estação.
- [x] Uma execução focal combinada:31arquivos/217testes,213PASS/4FAIL (quatro regressões novas para três achados); sem somar execuções sobrepostas. Lint dos quatro testes alterados/criados PASS/0warnings; git diff --check PASS.
- [x] Chrome local com componentes reais/CDP trusted click confirmou portalchat interativo acima do aviso e focus/pointerlock de Sheet impedindo retry. CSS mínimo de fixture e backendmock; não é smoke Next/staging nem escrita real.
- [x] Nova F1: preservar modais/formulários montados, bloquear portais durante TEMP e permitir foco/clique/teclado na recuperação. Não basta somente zindex.
- [x] Nova F2: HoleritesPage real desmonta justificativa de rejeição por troca Gestao→Meus quando TEMP remove user. Preservar estado de apresentação sem repor claims autorizáveis no DTO.
- [x] Nova F3: bridge PERMITIDO não revalida em focus/reconnect porque query está desabilitada; restaurar checks abortáveis/deduplicados. Sem afirmar logout24h observado.
- [ ] Revalidação Sage PASS após reparos; Forge global/typecheck/build e demais revisões/publicação staging continuam pendentes. AC7 e AC8 não concluídos.

File List adicional Sage:

- `tests/auth/sessao-cliente-resiliencia.test.tsx` — seis cenários novos de focus/reconnect, lateTEMP, WAF e heartbeatbody/backoff/unmount.
- `tests/auth/sessao-portais-resiliencia.test.tsx` — suporte real preservado e regressão focus de Sheet real.
- `tests/auth/sessao-consumidores-resiliencia.test.tsx` — regressão de justificativa no módulo Holerites real.
- `tests/auth/iframe-sessao-resiliencia.test.tsx` — três cenários com shell real/protocolo/15s/dedup/logout.
- `docs/stories/story-painel-alpha-resiliencia-sessao-banco-20261026.md` — resultado e pendências reais.

Relatório/handoff detalhado e manifesto privados600: `/home/ialpha/.config/painel-alpha/sessao-resiliencia-20261026/sage-causal.md` e `sage-causal.json`; logs `sage-auth-focal.log`, `sage-eslint.log`, `sage-browser-causal.log` e fixture/resultado Chrome privados. Sem commit/push/deploy/DB/produção.


## Reparos Nova após Sage — 26/10/2026

- [x] F1: recuperação em dialog nativo no top layer, portado diretamente em body para evitar ancestrais aria-hidden do Sheet. Isolamento temporário em Window capture pausa handlers Radix de foco, dismiss/outside e Escape. Portais/editores existentes não são fechados nem desmontados. Cleanup restaura foco e operação normal.
- [x] Retry acessível: pointer-events:auto vence herança bodypointerlock; aria-disabled preserva foco durante consulta; click/Enter/Space delegados sem replay ou sobreposição. Tab mantém navegação nativa.
- [x] F2: Holerites guarda apenas composição de apresentação previamente permitida (gestão/ID de apresentação) durante TEMP, mantendo o formulário real de rejeição. Não restaura user/role no DTO nem autoriza operação; camada de pausa bloqueia interação e backend mantém ACL atual. Nova role confirmada altera apresentação normalmente.
- [x] F3: SSRseed/refetchOnMount:false evita GET extra inicial; focus/reconnect permitidos voltam a revalidar endpoint/cookie. Observer sem transição enabled evita GET duplicado após broadcast. Sem TTL/cache positivo para autorizar.
- [x] Compatibilidade adicional: update(undefined) explícito anuncia login confirmado no canal next-auth uma vez; peer consulta servidor uma vez. Poll/recebimento de broadcast/TEMP não reemitem, evitando loop. NEGADO inicial vira contexto unauthenticated sem heartbeat concorrente; JWT revogado não é restaurado.
- [x] Uma execução focal final: 31 arquivos / 220 testes PASS (217 anteriores + 3 novos), sem somar rodadas sobrepostas. Typecheck real PASS; lint focal 0 erros / 1 aviso legado (Link não usado em Holerites); git diff --check PASS.
- [x] Chrome local com componentes reais e CDP trusted input PASS: portalChat não envia ação mock nem perde mensagem, Escape preserva chat/Sheet, retry foca/clica com bodypointerlock, sem ancestral aria-hidden, foco se mantém após pending, Enter gera uma consulta; recuperação mantém nó/valor/foco, edição e Escape normais voltam depois.
- [ ] Revalidação Sage independente, Forge global e demais revisões/staging. Fixture usa CSS mínimo e backend fictício; não equivale a E2E Next, produção ou banco real.

File List desta correção:
- `src/components/auth/PausaSessaoDialog.tsx`
- `src/components/auth/SessaoIndisponivel.tsx`
- `src/components/auth/SessaoResilienteProvider.tsx`
- `src/components/holerites/HoleritesPage.tsx`
- `tests/auth/sessao-portais-resiliencia.test.tsx`
- `tests/auth/sessao-consumidores-resiliencia.test.tsx`
- `tests/auth/sessao-cliente-resiliencia.test.tsx`
- `docs/stories/story-painel-alpha-resiliencia-sessao-banco-20261026.md`

Relatório privado600: nova-fixes-sage.md/.json; logs nova-fixes-{focal,typecheck,eslint}.log; fixture/resultados nova-browser-causal.mjs/.json/.log, em /home/ialpha/.config/painel-alpha/sessao-resiliencia-20261026/. Backend SSR Echo preservado; nenhum banco/cloud/commit/push/deploy.


## Reteste Sage independente após reparos — 26/10/2026

- [x] F1/F2/F3 encerrados no escopo causal. As quatro regressões originais preservam exigências de mesmo nó/valor/foco e exatamente1GET por focus/reconnect; nenhuma expectativa relaxada. Relatório REPROVADO anterior preservado como histórico.
- [x] Uma execução focal:31arquivos/220testes PASS, sem somar execuções anteriores. Handlers/cookies/guards, bodyabort/admissão, SSR, heartbeat/login/iframe e consumidores reais incluídos.
- [x] Chrome independente/CDP trusted input PASS: portalChat0actionsmock e mensagem intacta, mesmo inputSheet, retry focável sem aria-hiddenancestor, click/Enter/Space1GETcada, EnterautoRepeat0GET, Escape preserva editores duranteTEMP; foco/edição/Escape normais restaurados após recuperar.
- [x] Story/checklist/FileList atualizados; git diff --check PASS. Nenhum appcode ou teste versionável alterado nesta rodada, somente story e evidências privadas600.
- [ ] Forge lint/typecheck/npmtest/build globais, revisões Probe/Anubis/Lens e staging continuam pendentes; AC7/AC8/DoD global permanecem abertos.

Evidências privadas600: `/home/ialpha/.config/painel-alpha/sessao-resiliencia-20261026/sage-retest.md` e `sage-retest.json`, `sage-retest-focal.log`, `sage-retest-browser.mjs/json/log`. FixtureChrome usa componentes reais, CSS mínimo e backendmock; não equivale a E2ENext/staging ou execução de escrita protegida real. Nenhum DB/schema/envreal/cloud/commit/push/deploy/produção. FileList do reteste: esta story; os quatro testes Sage e reparos Nova continuam listados nas seções anteriores.


## Forge preflight interrompido antes dos gates — 26/10/2026

- [x] Skill/known-errors, ambiente sanitizado planejado, recursos e isolamento de Prisma conferidos por leitura. Nenhum gate ou build iniciado.
- [x] DevOps integrou localmente staging `fb0e8546d75e95f96e780f2049b43d75f6466e15` após commit de preparação `213b801d`, preservando ambos os históricos; sem push/deploy. Evidência na seção seguinte.
- [ ] Executar todos os gates globais reais e smoke compilado sobre a fonte integrada. Nenhum PASS Forge declarado; reteste Sage focal anterior permanece evidência histórica.

Artefatos privados600: `forge-preflight.md/json` e `forge-preflight-source.json` em `/home/ialpha/.config/painel-alpha/sessao-resiliencia-20261026/`. FileList desta estação: esta story; sem alteração em appcode/testes/dependências/schema/DB/envreal/cloud/produção.


## DevOps — integração Git local antes dos gates — 26/10/2026

- [x] Snapshot privado600 dos 157 caminhos próprios, hashes de conteúdo/blob, patch e status do Root antes da preparação; nenhum arquivo de ambiente, dependência ou output gerado incluído. Commit local `213b801d`: `fix(auth): preservar sessao durante indisponibilidade temporaria`.
- [x] Merge local preservando ambos os históricos com staging `fb0e8546d75e95f96e780f2049b43d75f6466e15` (90 caminhos upstream). Sem rebase, force, reset, stash, clean ou operação no checkout original.
- [x] Quatro sobreposições mescladas automaticamente, sem conflitos: `src/actions/bpm/Anexos.ts`, `src/app/PainelAlpha/layout.tsx`, `src/app/PainelAlpha/PainelTarefas/PainelTarefaC/page.tsx` e `src/app/PainelAlpha/PainelTarefas/painelTarefaSG/page.tsx`. Comparação byte a byte com merge de três vias e blobs dos demais arquivos confirma preservação de ambos os lados. Helpers de salvamento/rascunhos/Blueprint/Notas/LegacyWriteAccess recebidos integralmente de upstream.
- [x] Verificados nos arquivos combinados: campos registrados sem formulário + rethrow TEMP; `PainelCardState` com key/userId nas duas instâncias + auth reader/orçamento SSR; finally/toast de salvamento + acessos opcionais de usuário nas duas páginas legadas. Nenhuma resolução manual de appcode necessária.
- [x] `git diff --cached --check` e `git diff --check` PASS. Removidos três espaços finais da story e atualizado status documental. Remoto staging conferido e permanece no SHA integrado.
- [ ] Forge deve executar lint/typecheck/npm test/build globais e smoke compilado sobre esta fonte integrada; evidências focais anteriores não aprovam a integração global. Probe/Anubis/Lens e publicação/validação em staging continuam pendentes. Produção não autorizada.

File List desta estação: esta story (status, checklist e registro de integração). Demais arquivos da tarefa já listados acima; alterações recebidas de upstream pertencem ao histórico preservado de staging. Evidências privadas600 `devops-before.json`, `devops-precommit.json`, `devops-before.patch`, `devops-merge-verification.json` e `devops-integration.md/json` em `/home/ialpha/.config/painel-alpha/sessao-resiliencia-20261026/`. Nenhum banco, schema, env real, cloud, push ou deploy acessado nesta estação.
