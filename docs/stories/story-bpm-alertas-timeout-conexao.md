# Story — Recuperação dos alertas BPM após timeout de conexão

## Status

Ready for Review — QA APPROVED do candidato estreito integrado na base remota `aca95ddb402da03a5d58b7833a04bd99b018e537`; quatro gates finais aprovados. Publicação autorizada em preparação; não declarar concluída antes de READY/alias/SHA e smoke.

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["npm run lint", "npm run typecheck", "npm test", "npm run build"]

## Story

Como usuário do Painel Alpha, quero que a consulta de notificações de tarefas BPM se recupere de falhas transitórias de conexão com o banco, para continuar recebendo alertas sem perder os já carregados nem gerar uma sequência de novas requisições durante a indisponibilidade.

Origem: investigação solicitada pelo usuário e autorização subsequente “Faça as alterações”. Foi confirmada em produção, em 2026-10-26 às 16:13:05 UTC, uma resposta HTTP 500 de `GET /api/bpm/tarefas/alertas`, na release `dpl_5YLLWoidj4A6EDZ7ZeSrX49fmvVw`, associada a `UND_ERR_CONNECT_TIMEOUT` após 10000 ms na conexão Turso. O hook registrou a resposta como `[BpmTarefas/notificacoes]`. Outras rotas apresentaram o mesmo timeout, mas o escopo desta correção é o fluxo de leitura de alertas de tarefas.

## Acceptance Criteria

1. A leitura de alertas admite no máximo uma repetição adicional, após espera curta, somente quando a cadeia de erro comprovar `UND_ERR_CONNECT_TIMEOUT`. O detector aceita encapsulamento real de `cause`/Prisma e encerra a inspeção em cadeias cíclicas. Mensagens genéricas como `fetch failed`, erros de negócio, autorização, validação ou disputa de escrita não disparam essa repetição.
2. Se a leitura se recuperar na segunda tentativa, a rota responde com o contrato normal de sucesso, preservando sessão, autorização de módulo/card, filtros, paginação e ausência de cache. Se o timeout persistir, responde HTTP 503 com `Retry-After` válido e mensagem segura, sem devolver host do banco, stack ou credenciais. Erros não classificados mantêm o tratamento de erro existente.
3. No navegador, falhas transitórias de rede e respostas temporárias de indisponibilidade respeitam espera progressiva limitada e `Retry-After` válido. Polling, foco, reconexão e Pusher não antecipam uma chamada enquanto esse intervalo estiver vigente. Uma falha com atualização pendente não provoca repetição imediata em loop.
4. Uma tentativa incompleta ou malsucedida mantém os alertas anteriormente carregados e não publica páginas parciais como sincronização completa. A recuperação permite nova leitura e restabelece a cadência normal. Identificadores já vistos/lidos continuam deduplicados, e um alerta novo legítimo continua sendo exibido.
5. Respostas 401/403 continuam limpando os alertas da sessão sem serem tratadas como indisponibilidade transitória. Logout, troca de usuário e desmontagem cancelam timers/trabalho pendente; respostas atrasadas não atualizam outra conta. Não há retry global de Prisma/fetch, alteração de fluxos de escrita ou de regras de autorização.
6. Implementação e validação respeitam staging primeiro, o ambiente efetivo e `.env.staging.local` quando necessário. Em 2026-10-26, o usuário autorizou explicitamente o push para `main` (“faça o pusha para o main”): publicar/validar primeiro staging e então promover somente esta correção para `main`, preservando seus conteúdos anteriores. Não há migration, mudança estrutural, seed/backfill, mutação em massa nem mudança de configuração remota. Deploy exige conferência de READY, SHA, ambiente e alias; código local não comprova publicação.
7. Regressões significativas de API e hook são executadas, assim como `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`. Checklist e File List são atualizados com os caminhos efetivamente alterados, resultados reais e limitações, sem declarar um gate pendente como aprovado.

## Tarefas / subtarefas

- [x] Registrar pedido, evidência do incidente, limites e critérios de aceite.
- [x] Aplicar `story-draft-checklist.md` à preparação desta story.
- [x] Implementar classificação estreita de timeout e repetição limitada da leitura dos alertas (AC 1–2, 5).
- [x] Tratar indisponibilidade persistente com 503 e `Retry-After`, preservando contrato e controles existentes (AC 2).
- [x] Implementar espera progressiva e reconciliação após recuperação no hook, com lifecycle cancelável (AC 3–5).
- [x] Testar recuperação, esgotamento das tentativas, erros permanentes e autorização na API (AC 1–2, 5).
- [x] Testar espera entre eventos, preservação de alertas/paginação, recuperação/deduplicação e troca de sessão (AC 3–5).
- [x] Conferir ambiente e executar os quatro quality gates; registrar resultados e revisão (AC 6–7). Execução concluída; suíte global com uma falha preexistente documentada abaixo.
- [x] Atualizar status, checklist, File List e limitações reais da entrega (AC 7).

## Dev Notes e referências

- [Fonte: `src/app/api/bpm/tarefas/alertas/route.ts`, `GET`]: rota dinâmica somente leitura, sessão via `auth()`, permissão de módulo e ACL por card. Consulta até 51 tarefas, entrega até 50 por página e usa ID crescente como cursor. O `Map` de acessos evita repetir a ACL de um mesmo card na página. Qualquer exceção atualmente resulta em 500 genérico. Repetir a unidade de leitura deve preservar nova avaliação de autorização e evitar capturar promessas rejeitadas de tentativa anterior.
- [Fonte: `src/hooks/useBpmTarefasNotifications.ts`, `atualizar` e cleanup]: o hook busca todas as páginas antes de sincronizar, usa `AbortController`, evita chamadas simultâneas e consulta por intervalo de 30 segundos, foco, online e eventos Pusher. O bloco `finally` atualmente executa imediatamente a atualização pendente; esse caminho também deve respeitar a espera após falha.
- [Fonte: `src/store/useBpmTarefasNotificacoes.ts`; `docs/stories/story-crm-alertas-tarefas-leitura-navegacao.md#acceptance-criteria`]: reconhecimento por ID e isolamento por usuário são contratos existentes. A correção anterior mantém leitura entre remontagens e reutiliza a aba CRM. Não substituir esses mecanismos nem persistir conteúdo adicional de clientes para implementar espera.
- [Fonte: `src/lib/prisma.ts`, construção do adapter]: runtime remoto usa Prisma com adapter libSQL HTTP e variáveis `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`. Não mudar adapter, timeout global ou configuração de banco nesta entrega.
- [Fonte: `src/lib/bpm/sqlite-busy-retry.ts`, `erroSqliteBusy` e `repetirTransacaoOcupada`]: helper existente é específico para reiniciar transações revertidas por `SQLITE_BUSY`. Não ampliar esse helper com falhas de transporte nem reutilizá-lo para repetir escritas por erro de conexão.
- [Fonte: `tests/bpm/tarefas-alertas-api.test.ts`; `tests/bpm/tarefas-notificacoes-hook-react.test.ts`]: harnesses Vitest existentes permitem controlar sessão/ACL/consulta e simular polling/Pusher com relógio falso. Ampliar essas regressões com dados sintéticos.
- [Fonte: `AGENTS.md#fluxo-de-ambientes--staging-primeiro`; `AGENTS.md#quality-gates`; `package.json`, scripts]: staging primeiro, produção somente com pedido explícito de promoção e quatro gates reais. Não são necessárias novas variáveis de ambiente ou dependências para este escopo.

Não foram encontrados `accumulated-context.md`, `.aiox/gotchas.json`, `docs/prd/`, `docs/architecture/index.md` ou os documentos genéricos de `docs/framework/` neste checkout. O contexto cruzado foi obtido das stories `story-crm-alertas-tarefas-leitura-navegacao.md` e `story-staging-sincronizacao-fluxo-staging-primeiro.md`. Não há orientação arquitetural genérica adicional específica disponível; as referências de implementação acima apontam para os contratos reais do código.

**[AUTO-DECISION] Identificação e rastreabilidade:** usar o nome de arquivo e o escopo delimitado pelo executor principal, derivados do pedido direto e do incidente confirmado. Não inventar número de epic, criar tarefa externa ou alterar outra story neste trabalho.

**[AUTO-DECISION] Operação:** plano confirmado pelo executor: `src/lib/bpm/alertas-leitura-retry.ts` detecta o código exato em `cause`/`meta` e admite uma repetição após 250 ms; na rota, a repetição abrange autorização de banco, consulta e serialização após `auth()`. Timeout persistente retorna 503 com `Retry-After: 30`. O hook usa espera de 30/60/120/240/300 segundos, respeita `Retry-After`, preserva o snapshot anterior e cancela trabalho da sessão encerrada. Esses valores devem ser explícitos no código e cobertos por testes. Não prometer correção da conectividade do provedor: o tratamento melhora a recuperação do aplicativo.

**Ambiente conferido pelo executor:** branch `staging`; SHA-256 da URL de banco staging `7fdd160737ba6f9cf84d0ac2fb1c3cf1084311e7fccea454f7bac368f9e4d42b`, sem expor URL ou token. Essa conferência local não comprova publicação remota.

## Testing

Usar Vitest com fixtures sintéticas e relógio falso; não causar indisponibilidade real nem criar tarefas de clientes para fabricar evidência.

| Cenário | Evidência esperada |
| --- | --- |
| Timeout seguido de recuperação | Duas tentativas no máximo; resposta normal e ACL válida |
| Timeout persistente, inclusive encapsulado | Exatamente duas tentativas; resposta 503, `Retry-After` válido e corpo sem detalhes internos |
| Erro genérico/permanente ou cadeia cíclica | Sem repetição indevida e sem loop no detector |
| Sessão ausente, permissão revogada, card sem ACL | 401/403 e filtros mantidos; nenhum alerta indevido |
| Falha na página subsequente | Alertas existentes preservados; nenhuma sincronização parcial |
| Foco/online/Pusher/polling durante espera | Sem requisição antecipada nem loop por atualização pendente |
| `Retry-After` válido, inválido ou ausente | Espera respeitada quando válida e fallback limitado quando inválida/ausente |
| Recuperação | Novo alerta legítimo aparece; alerta já reconhecido não repete; cadência normal retorna |
| Logout/troca de usuário/desmontagem | Timers e resposta antiga não consultam nem atualizam outra conta |
| Gates globais | Comando, resultado e logs reais; falhas preexistentes distinguidas de regressões |

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** tipo primário API; secundários Frontend/Integration; complexidade média por repetição limitada, paginação e lifecycle de sessão. Nenhuma alteração visual.
- **Specialized Agent Assignment:** @dev implementa e realiza Pre-Commit; @qa revisa contratos e regressões. @devops somente se houver pedido posterior de PR/deploy; @architect somente se surgir mudança de arquitetura fora do plano mínimo. Não há trabalho de schema.
- **Quality Gates:** Pre-Commit obrigatório com revisão do diff, testes de regressão, quatro gates e CodeRabbit quando disponível; documentar indisponibilidade e revisão alternativa conforme configuração. Pre-PR e Pre-Deployment não se aplicam ao escopo local atual e devem ser realizados por @devops se acionados posteriormente.
- **Self-Healing Configuration:** @dev em modo light, até duas iterações/15 minutos para CRITICAL; HIGH documentado. @qa em modo full, até três iterações/30 minutos para CRITICAL/HIGH, MEDIUM como dívida; @devops em modo check, somente reporte quando aplicável.
- **Focus Areas:** restrição da repetição a leitura/timeout comprovado, limites de tentativas e espera, `Retry-After`, manutenção de ACL, ausência de respostas parciais, isolamento entre sessões, cancelamento de timers e prevenção de loops.

## Validação da preparação — @sm

Checklist `.aiox-core/product/checklists/story-draft-checklist.md` aplicado integralmente. Resultado: **READY, clareza 9/10**. Objetivo/contexto PASS; orientação técnica PASS; referências PASS; informação autocontida PASS; testes PASS; integração CodeRabbit PASS. O pedido direto substitui epic inexistente para esta correção delimitada. Sem dependência bloqueante de produto; implementação, gates e qualquer validação remota continuam pendentes.

## Dev Agent Record

### Debug Log References

Evidência diagnóstica: `/tmp/bpm-alertas-historico-20261026.jsonl`. Logs de validação: `/tmp/bpm-alertas-timeout-{lint,typecheck,test,build}.log`. Baseline independente da falha herdada: `/tmp/bpm-alertas-timeout-baseline-theme.log`. Esses arquivos são temporários e não integram publicação. Resultados essenciais estão resumidos nesta story.

### Completion Notes

- Implementado retry restrito ao código `UND_ERR_CONNECT_TIMEOUT`, com uma única repetição após 250 ms, somente na leitura dos alertas. A segunda tentativa recarrega autorização de módulo e ACL dos cards; o mapa de promessas é novo por tentativa. Nenhum helper de escrita/transação, adapter ou configuração global alterado.
- Timeout persistente retorna 503 com `Retry-After: 30`, `Cache-Control: private, no-store` e mensagem segura. Log desse caso contém somente rótulo/código, sem host, stack ou credenciais. Erros permanentes mantêm 500 e diagnóstico existentes.
- Hook respeita espera de 30/60/120/240/300 s, com teto de cinco minutos também para `Retry-After` numérico/data HTTP. Falhas de rede e HTTP 408/429/500/502/503/504 não apagam o snapshot e geram somente um aviso por período de falha. Foco, reconexão, Pusher, polling e atualização pendente respeitam a espera. Sucesso restaura cadência e deduplicação; 401/403 continuam limpando os alertas; cleanup cancela sessão antiga.
- 35 regressões focadas PASS em três arquivos. Cobrem código exato e envelopes/ciclos, espera e limite, cancelamento, 503 seguro, cursor, revalidação de ACL, falha em página posterior, reconhecimento de alertas, recuperação, troca de usuário e erros permanentes/payload inválido.
- Validação isolada em `/tmp/painel-bpm-alertas-timeout-20261026`, base imutável `392ec53e5b6dfbf3717f3dbf31e19824afe13b51`, acrescida apenas dos sete caminhos da File List. SHA-256 dos seis arquivos técnicos conferido igual ao checkout principal. Dependências via link local; nenhum ambiente de produção copiado. Operações CLI utilizaram os valores staging conferidos de `.env.staging.local`; nenhuma conexão de diagnóstico/mutação de banco foi adicionada.
- `npm run lint`: PASS, zero erros e 1194 warnings do snapshot. Após os dois testes adicionais, lint incremental dos seis caminhos técnicos PASS, zero avisos.
- `npm run build`: PASS com comando padrão (inclui Prisma generate e build:player), 81 páginas estáticas geradas. Warnings existentes de importação dinâmica em `pdfjs-polyfill.ts`; sem modificação desse módulo.
- `npm test -- --maxWorkers=4`: executado no código final; 700 arquivos aprovados e um arquivo com falha, 5406 testes aprovados, um falhou, quatro skipped e um todo. Única falha: `tests/bpm/novo-card-modal-react.test.ts:223`, expectativa de `colorScheme` literal `dark` versus valor atual `var(--crm-color-scheme, dark)`. Reproduzida sem nenhuma alteração da entrega no worktree limpo `/tmp/painel-bpm-alertas-baseline-20261026`, mesmo commit base: 11 testes aprovados e a mesma única falha. Nenhuma alteração do tema ou de seu teste foi incluída nesta correção; não declarar suíte global verde.
- Typecheck inicial encontrou somente ausência do bundle ignorado `src/generated/apresentacoes-player-bundle.ts` no novo worktree. O build padrão gerou esse artefato; `npm run typecheck` final PASS, exit 0, após o build, sem concorrência com geração de tipos Next.
- CodeRabbit CLI indisponível no caminho padrão e no PATH. Revisão independente manual por @qa e regressões executadas como alternativa. Veredito final: **NEEDS_WORK exclusivamente pelo gate global herdado**; nenhum bloqueador no código da correção e AC 1–6 atendidos. AC 7 mantém a pendência da suíte global. QA reexecutou os 35 testes focados com sucesso e conferiu os quatro resultados reais. Não houve dispensa do gate nem aprovação de publicação.
- Na etapa inicial não houve commit, push, deploy, migration, mudança de schema ou de configuração remota. O tratamento não resolve nem comprova resolução da instabilidade de conectividade Vercel–Turso. A autorização posterior e a promoção ficam registradas na seção DevOps abaixo.

### File List

Arquivos efetivamente criados ou editados nesta correção:

- `docs/stories/story-bpm-alertas-timeout-conexao.md` — story, critérios, checklist e evidências.
- `src/app/api/bpm/tarefas/alertas/route.ts` — recuperação restrita da leitura e resposta de indisponibilidade.
- `src/hooks/useBpmTarefasNotifications.ts` — espera progressiva e recuperação cancelável.
- `tests/bpm/tarefas-alertas-api.test.ts` — regressões de timeout, contrato e autorização.
- `tests/bpm/tarefas-notificacoes-hook-react.test.ts` — regressões de espera, preservação e lifecycle.
- `src/lib/bpm/alertas-leitura-retry.ts` — detector do timeout de conexão e uma repetição limitada de leitura.
- `tests/bpm/alertas-leitura-retry.test.ts` — regressões do detector e limite de tentativas/espera.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-26 | 0.1 | Preparação da correção a partir do timeout comprovado e autorização do usuário; checklist de draft aprovado | River (@sm) |

| 2026-10-26 | 0.2 | Retry de leitura, 503, espera progressiva e 35 regressões implementadas; build/lint aprovados, falha de tema comprovada no baseline | Dex / Codex |
| 2026-10-26 | 0.3 | Typecheck final aprovado; QA sem bloqueadores na correção e NEEDS_WORK pela falha global herdada; checklist e evidências concluídos, sem deploy | Dex / Quinn / Codex |


## Publicação autorizada — DevOps — 2026-10-26

**Autorização:** pedido explícito “faça o pusha para o main”, limitado à correção desta story. A autorização permite a preparação e validação em staging antes de main; não autoriza migrations ou publicação das outras alterações locais. `[AUTO-DECISION]` não pedir confirmação genérica repetida: a autorização de push já foi recebida.

**Base congelada:** `origin/main` e `origin/staging` conferidos iguais a `aca95ddb402da03a5d58b7833a04bd99b018e537`. Candidato em `/tmp/painel-bpm-alertas-release-20261026`, branch `fix/bpm-alertas-timeout-20261026`. O delta dos quatro arquivos rastreados foi calculado relativo à base local `392ec53e` e integrado com três vias; os três arquivos novos foram adicionados seletivamente. Não sobrepor o hook inteiro: as 16 linhas de integração de notificações de leads existentes em main, seus imports, inicialização, eventos/Pusher/postMessage, reconciliação e cleanup permaneceram preservados. O mock de leads preexistente também foi preservado. Nenhuma alteração de tema ou de seu teste integra o candidato.

**Gates finais do candidato remoto:**

- `npm run lint`: PASS, exit 0, zero erros e 1183 warnings herdados. Log `/tmp/bpm-alertas-release-lint.log`.
- `npm test -- --maxWorkers=2`, com `TMPDIR=/tmp`, sem build concorrente: PASS, exit 0, 779 arquivos e 6509 testes aprovados; quatro skipped e um todo já existentes. Log `/tmp/bpm-alertas-release-test.log`. Nenhum teste excluído nem timeout alterado. Os 35 testes específicos da correção também passaram nesse candidato.
- `npm run build`: PASS, exit 0, comando padrão da base; compilação e 86 páginas estáticas concluídas. Log `/tmp/bpm-alertas-release-build.log`.
- `npm run typecheck`: PASS, exit 0, executado após build e testes. Log `/tmp/bpm-alertas-release-typecheck.log`.
- `git diff --check`: PASS; sem conflito de integração, sem debug temporário, formato de segredos sem ocorrências nos sete caminhos.

**Ambiente local e tentativas intermediárias:** o client Prisma gerado foi isolado em `node_modules/.prisma` e `node_modules/@prisma/client` do candidato porque o schema remoto contém modelos ausentes no checkout local. O pacote `extenso@3.0.0`, já presente no package/lock remotos mas ausente nas dependências locais compartilhadas, foi obtido pelo tarball exato do lock e teve integridade SHA-512/SRI conferida; sem scripts de instalação ou mudança de dependências. As tentativas anteriores são preservadas em `/tmp/bpm-alertas-release-test-initial-client-mismatch.log`, `/tmp/bpm-alertas-release-test-during-build.log` e `/tmp/bpm-alertas-release-build-initial-missing-dependency.log`. A tentativa durante o build também teve timeouts de fixtures SQLite sob disputa de recursos; a execução final foi feita sozinha, com dois workers e sem alterar o código dos testes. Não apresentar essas tentativas como gates aprovados.

**Dívida de dependências:** `npm audit` retornou 120 advisories herdados: dez críticos, 48 altos, 61 moderados e um baixo. Classificação **CONCERNS**, nunca PASS, seguindo o protocolo contextual já registrado e aprovado para esta mesma base em `story-chamados-conclusao-sqlite-busy.md` (parecer de equivalência para promoção) e `docs/reports/staging-sincronizacao-20261020.md` (validação contextual do audit). `package.json`, `package-lock.json` e `prisma/schema.prisma` são byte a byte idênticos à base remota; a entrega não amplia o grafo de dependências. Novos achados do delta continuam bloqueantes. CodeRabbit indisponível; revisão independente por QA substitui a automação ausente, conforme graceful degradation do projeto.

**Isolamento/rollback:** os 225 metadados de ambiente Vercel foram capturados antes da publicação, sem valores ou credenciais. Nenhuma configuração de projeto/env será enviada no deploy. Cada ambiente deverá reconstruir o mesmo SHA usando suas variáveis existentes; não promover o artefato compilado com credenciais de staging para produção. Baseline staging: `dpl_4FNZcAwwNeLa3kd9Ai7aqtpdn4sW`; produção anterior: `dpl_5YLLWoidj4A6EDZ7ZeSrX49fmvVw`, ambas no SHA `aca95ddb`. Em necessidade de rollback de código, restaurar o deployment anterior do ambiente correspondente, sem reverter banco. Nenhum rollback foi executado.

- [x] Conferir typecheck final e parecer QA APPROVED; commit seletivo dos sete caminhos preparado para checkout candidato limpo.
- [ ] Publicar staging, conferir READY/SHA/alias e smoke de disponibilidade/proteção.
- [ ] Promover o mesmo commit para main sem force, acompanhar nova build de produção e conferir READY/SHA/alias/smoke.
- [ ] Registrar resultados finais, limites de teste autenticado e preservação do checkout raiz.

**QA final do candidato remoto:** APPROVED, sem achados bloqueadores no delta. Revisão independente confirmou preservação das notificações de leads e executou 177 testes de integração com sucesso. Os quatro gates finais e 6509 testes globais aprovados encerram, para este candidato baseado no remoto, a pendência de gate registrada na etapa local com base `392ec53e`. A classificação CONCERNS do audit é mantida separada. Limitação: ainda não foi realizado teste visual autenticado com dados reais; smoke remoto validará disponibilidade, versão e proteção de acesso.
