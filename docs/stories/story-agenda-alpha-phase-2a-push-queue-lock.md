# Story: Agenda Alpha Fase 2A — push, fila persistente e lock distribuído

**ID:** STORY-AGENDA-ALPHA-2A  
**Epic:** Agenda Alpha  
**Status:** Ready for Review — implementação concluída com flags off; rollout externo bloqueado  
**Prioridade:** Alta  
**Complexidade:** Muito Alta  
**Data de criação:** 2026-07-30  
**Executor:** Bibble Squad  
**Quality gate:** @data-engineer + @qa + @architect  

> **VAULT CONCLUÍDO:** o relatório final foi apresentado, o usuário autorizou explicitamente a migration específica da Agenda Alpha Fase 2A e ela foi aplicada **uma única vez** no Turso de produção, com as flags desligadas. O schema remoto foi validado após a aplicação. Qualquer nova alteração estrutural continua exigindo novo ciclo Vault, backup e confirmação.

### Evidência do backup já concluído

- Dump: `database-backups/pre-change/painelalpha_turso_pre_change_agenda-alpha-phase2a_2026-07-30T20-13-38Z.sql`
- Manifest: `database-backups/pre-change/painelalpha_turso_pre_change_agenda-alpha-phase2a_2026-07-30T20-13-38Z.manifest.json`
- Tamanho do dump: `67.049.087` bytes
- SHA-256: `d254a1906a7597eb3f073ddb4dac5d2ddd8f4ba9332a9b1c5acf1cd6ac3208cf`
- Inventário: `141` tabelas e `34.667` linhas
- Restore descartável: `quick_check` aprovado
- Integridade referencial no restore: `0` violações de foreign key

Este foi o backup usado no gate autorizado. A autorização já foi consumida pela aplicação única da migration desta story; ela não autoriza reaplicação, rollback destrutivo nem mudança estrutural adicional.

## Story

**Como** responsável pela operação da Agenda Alpha em múltiplas instâncias do PainelAlpha,  
**quero** receber sinais push do Google Calendar em um webhook seguro, persistir o trabalho em uma fila no Turso e serializar cada sincronização com lock distribuído,  
**para que** alterações externas sejam reconciliadas de modo confiável, idempotente e operável por CLI, sem depender da memória de uma única instância Node.

## Valor e relação com a fase anterior

A onda cache-first de 2026-07-30 separou corretamente leitura e sincronização: o SSR lê apenas `GoogleCalendarEventoCache`, `sincronizarAgendaAlpha` dispara o trabalho explícito e `sync.ts` troca cache e `syncToken` somente após todas as páginas. O dedupe/cooldown atual de `sync-orchestrator.ts`, porém, usa `Map` em memória e não coordena réplicas ou processos diferentes.

Esta Fase 2A fecha somente essa lacuna operacional:

1. push do Google é um **sinal de mudança**, nunca o conteúdo do evento;
2. webhook validado apenas coalesce/enfileira trabalho no Turso e responde rápido;
3. worker CLI consome a fila;
4. lock persistente impede duas réplicas de sincronizarem o mesmo calendário ao mesmo tempo;
5. maintenance CLI cria, renova e encerra canais e agenda reconciliações;
6. o motor incremental, o tratamento de `410 Gone` e a atomicidade cache/`syncToken` existentes continuam sendo a base.

[Source: `docs/stories/story-calendario-alpha.md#2026-07-30--Reestruturação-Agenda-Alpha--onda-cache-first-sem-migration`]  
[Source: `.bibble/memory/architecture.md#Calendário-Alpha--MVP-via-Domain-Wide-Delegation`]  
[Source: `.bibble/memory/integration-points.md#Agenda-Alpha-rota-legada-CalendarioAlpha--Domain-Wide-Delegation`]

## Decisões autônomas registradas

- `[AUTO-DECISION] Status final → Ready for Review com implementação concluída e flags off; rollout externo permanece bloqueado até cumprir os itens operacionais pendentes.`
- `[AUTO-DECISION] Push executa sync dentro do webhook? → Não; o webhook só valida, coalesce a fila no Turso e responde rapidamente (reason: desacopla disponibilidade do Google da duração do sync e tolera reentrega).`
- `[AUTO-DECISION] Estado da fila é memória local? → Não; canal, fila e lock são DB-backed no Turso (reason: o requisito é coordenação entre réplicas).`
- `[AUTO-DECISION] Canal por calendário pode ser único? → Não; renovações admitem sobreposição temporária de canal antigo e novo, enquanto googleChannelId permanece único (reason: canais expiram e a substituição não é automática).`
- `[AUTO-DECISION] Push elimina reconciliação periódica/manual? → Não (reason: webhooks podem atrasar ou se perder; push apenas reduz latência).`
- `[AUTO-DECISION] accumulated-context.md ausente → usar story existente e memórias architecture/codebase-map/integration-points/journal como continuidade (reason: o arquivo obrigatório não existe neste checkout).`
- `[AUTO-DECISION] .aiox/gotchas.json ausente → registrar os gotchas comprovados nas memórias e no working tree (reason: o arquivo não existe neste checkout).`

## Escopo

### Incluído

- exatamente três novos models Prisma/Turso definidos nesta story;
- Route Handler público HTTPS para notificações Google Calendar;
- criação, renovação e encerramento de watches de eventos;
- fila persistente coalescida por calendário;
- claim de job e lock distribuído com lease e fencing token;
- worker CLI finito (`--once`/`--max-jobs`) e modo drain;
- maintenance CLI para canais, reconciliação, status e recuperação de leases expirados;
- feature flags com rollout e rollback graduais;
- métricas/logs estruturados sem conteúdo privado;
- testes unitários, integração Turso/SQLite compatível, concorrência e contrato do webhook;
- validação real, controlada, de watch → webhook → fila → worker → delta, se URL pública e credenciais estiverem disponíveis.

### Explicitamente fora do escopo

- preferências de notificação ou qualquer novo model/tela de preferências;
- tarefas, vínculo de evento com tarefas ou automações de tarefas;
- reserva de salas, disponibilidade de salas ou vínculos com salas;
- clientes e outros vínculos internos;
- mudança visual na Agenda Alpha;
- cache persistente de agendas de colegas; o fluxo compartilhado permanece live e explícito;
- OAuth individual ou suporte a contas Gmail pessoais;
- mudança de login, permissões do módulo ou DWD;
- polling contínuo dentro do processo web;
- garantir entrega perfeita do webhook.

## Arquitetura normativa

```text
Google Calendar events.watch
  -> POST /api/calendario-alpha/webhook
      -> valida headers + channel/token/resource
      -> enqueue/coalesce GoogleCalendarPendingOperation no Turso
      -> 204 rápido

npm run calendar-alpha:worker -- --once|--drain
  -> claim atômico do job
  -> acquire GoogleCalendarSyncLease
  -> resolve conexao.user.email no servidor
  -> DWD subject = usuarios.email
  -> sincronizarCalendario (delta/full recovery 410 já existente)
  -> verifica owner + fencingToken antes do commit final
  -> conclui/reagenda job
  -> libera lease sem poder liberar lock de outro worker

npm run calendar-alpha:maintenance
  -> cria/renova/encerra canais
  -> enfileira reconciliação de calendários stale
  -> recupera claims/leases vencidos
  -> reporta status operacional sanitizado
```

O runtime deve continuar usando `src/lib/prisma.ts`, que conecta o Prisma ao Turso por `PrismaLibSql`. `prisma db push`/`prisma migrate` não devem ser tratados como prova de alteração do Turso real. [Source: `.bibble/memory/known-errors.md#prisma-db-push--migrate-não-aplicam-mudança-de-schema-no-Turso`]

## Os três models exatos

Não criar quarto model, enum persistido, tabela de preferência, tabela de delivery ou tabela de vínculo. Os estados permanecem `String` validada no domínio para compatibilidade com o padrão SQLite/Turso.

### 1. `GoogleCalendarPushChannel`

```prisma
model GoogleCalendarPushChannel {
  id                  String                     @id @default(cuid())
  calendarioId        String
  calendario          GoogleCalendarSelecionado @relation(fields: [calendarioId], references: [id], onDelete: Cascade)
  googleChannelId     String                     @unique
  googleResourceId    String?
  resourceUri         String?
  channelTokenHash    String
  status              String                     @default("CREATING")
  expiresAt           DateTime
  renewAfter          DateTime
  activatedAt         DateTime?
  stoppedAt           DateTime?
  lastMessageNumber   String?
  lastNotificationAt  DateTime?
  lastErrorCode       String?
  lastErrorAt         DateTime?
  createdAt           DateTime                   @default(now())
  updatedAt           DateTime                   @updatedAt

  pendingOperations GoogleCalendarPendingOperation[]

  @@index([status, renewAfter])
  @@index([calendarioId, status, expiresAt])
}
```

Regras:

- `googleChannelId` é aleatório/UUID, opaco e único;
- token de canal é aleatório, tem no máximo 256 caracteres, é enviado ao Google uma vez e somente seu SHA-256 (`channelTokenHash`) é persistido;
- comparação do token recebido é constante no tempo;
- `status` aceita exatamente `CREATING | ACTIVE | STOPPING | STOPPED | EXPIRED | ERROR`;
- mais de um canal pode existir temporariamente para o mesmo calendário durante renovação;
- `googleResourceId`, quando presente, precisa coincidir com o header recebido antes de qualquer enqueue.

### 2. `GoogleCalendarPendingOperation`

```prisma
model GoogleCalendarPendingOperation {
  id                String                      @id @default(cuid())
  calendarioId      String
  calendario        GoogleCalendarSelecionado  @relation(fields: [calendarioId], references: [id], onDelete: Cascade)
  pushChannelId     String?
  pushChannel       GoogleCalendarPushChannel? @relation(fields: [pushChannelId], references: [id], onDelete: SetNull)
  operationType     String
  source            String
  idempotencyKey    String                      @unique
  payloadJson       String?
  status            String                      @default("PENDING")
  priority          Int                         @default(100)
  attemptCount      Int                         @default(0)
  maxAttempts       Int                         @default(8)
  availableAt       DateTime                    @default(now())
  claimedBy         String?
  claimedAt         DateTime?
  claimExpiresAt    DateTime?
  claimToken        Int                         @default(0)
  lastErrorCode     String?
  lastErrorMessage  String?
  completedAt       DateTime?
  deadLetteredAt    DateTime?
  createdAt         DateTime                    @default(now())
  updatedAt         DateTime                    @updatedAt

  @@index([status, availableAt, priority, createdAt])
  @@index([status, claimExpiresAt])
  @@index([calendarioId, operationType, status])
  @@index([pushChannelId])
}
```

Regras:

- `operationType` aceita exatamente `SYNC_CALENDAR | RENEW_CHANNEL | STOP_CHANNEL | RECONCILE_CHANNEL`;
- `source` aceita exatamente `WEBHOOK | MANUAL | SCHEDULED | ADMIN`;
- `status` aceita exatamente `PENDING | PROCESSING | RETRY | SUCCEEDED | DEAD_LETTER | CANCELLED`;
- `idempotencyKey` única e coalescência impedem que reentregas equivalentes criem trabalho efetivo duplicado;
- webhook durante uma operação `PROCESSING` cria/coalesce uma próxima operação idempotente, sem perder a mudança nem compartilhar o claim atual;
- claim é feito por atualização condicional atômica; `claimToken Int @default(0)` é incrementado a cada claim, e somente o mesmo worker/token pode concluir ou reagendar;
- falhas transitórias usam backoff limitado e `maxAttempts`; 400/401/403 permanentes não entram em retry cego;
- falhas permanentes ou tentativas esgotadas movem a operação para `DEAD_LETTER`, preservando replay explícito e auditável;
- erros persistidos são códigos/mensagens normalizadas, nunca descrição, participantes, e-mail, chave DWD ou payload Google sensível.

### 3. `GoogleCalendarSyncLease`

```prisma
model GoogleCalendarSyncLease {
  id              String                     @id @default(cuid())
  calendarioId    String                     @unique
  calendario      GoogleCalendarSelecionado @relation(fields: [calendarioId], references: [id], onDelete: Cascade)
  ownerId         String
  fencingToken    Int                        @default(1)
  leaseExpiresAt  DateTime
  heartbeatAt     DateTime
  createdAt       DateTime                   @default(now())
  updatedAt       DateTime                   @updatedAt

  @@index([leaseExpiresAt])
}
```

Regras:

- aquisição usa uma única operação SQL atômica no Turso: cria a linha ou troca owner somente se o lease estiver expirado ou pertencer ao mesmo owner;
- a primeira aquisição nasce com `fencingToken=1`; cada troca de owner ou reaquisição posterior incrementa o token monotonicamente;
- heartbeat renova somente quando `ownerId` e `fencingToken` ainda coincidem;
- antes da troca atômica de cache/`syncToken`, o executor confirma que ainda possui owner/fencing vigentes;
- release nunca apaga nem libera o lease de outro owner; deve ser condicional a owner + fencing;
- processo morto é recuperado por `leaseExpiresAt`, sem `force unlock` baseado apenas em tempo do processo local.

`GoogleCalendarSelecionado` recebe somente estas relações reversas:

```prisma
pushChannels       GoogleCalendarPushChannel[]
pendingOperations GoogleCalendarPendingOperation[]
syncLease          GoogleCalendarSyncLease?
```

### Estruturas de integridade e consulta

O desenho Dara possui exatamente **10 estruturas**, além das primary keys:

- **7 índices explícitos:** 2 em `GoogleCalendarPushChannel`, 4 em `GoogleCalendarPendingOperation` e 1 em `GoogleCalendarSyncLease`;
- **3 unicidades:** `googleChannelId`, `idempotencyKey` e `calendarioId`.

Não adicionar índice, unique ou quarto model à migration sem nova revisão Dara/Vault.

## Webhook

**Endpoint exato:** `POST /api/calendario-alpha/webhook`

O Route Handler:

1. não exige sessão de usuário, pois é callback server-to-server, mas não autoriza por ausência de sessão;
2. rejeita método, content-type/body inesperado e headers ausentes/malformados dentro de limites;
3. lê `X-Goog-Channel-ID`, `X-Goog-Channel-Token`, `X-Goog-Resource-ID`, `X-Goog-Resource-State`, `X-Goog-Message-Number` e `X-Goog-Channel-Expiration`;
4. encontra o canal pelo `googleChannelId`, compara `googleResourceId` e o token contra `channelTokenHash` em tempo constante;
5. aceita somente estado `sync | exists | not_exists`;
6. não confia em `userId`, e-mail, calendarId ou subject DWD enviados pelo request;
7. atualiza metadados técnicos e faz upsert/coalescência atômica da fila;
8. não chama Google, não roda sync e não executa DWD no request;
9. responde `204` após enqueue válido; canal desconhecido/token inválido recebe resposta 4xx sem revelar qual campo divergiu;
10. permite reentrega: a mesma notificação é segura e não duplica trabalho;
11. mantém logs apenas com correlation ID, `googleChannelId` truncado/hasheado, estado, resultado e latência;
12. precisa estar acessível por HTTPS público e não bloqueado pelo `robots.txt`.

Referências oficiais:

- Google Calendar Push Notifications: `https://developers.google.com/workspace/calendar/api/guides/push`
- Events watch: `https://developers.google.com/workspace/calendar/api/v3/reference/events/watch`
- Incremental sync e `410 Gone`: `https://developers.google.com/workspace/calendar/api/guides/sync`

## Segurança DWD

- `subject` continua vindo exclusivamente de `usuarios.email`, resolvido no servidor pela relação `operation.calendario.conexao.user`; nunca do webhook, CLI argument livre ou payload do cliente.
- Service Account e chave privada permanecem server-only nas env vars existentes.
- nenhuma credencial Google, token de canal em claro, conteúdo de evento, lista de participantes ou URL privada é persistida nos três models ou logada;
- worker e maintenance validam calendário selecionado, conexão `ATIVA`, usuário `ATIVO` e ownership antes de impersonar;
- a rota pública possui limites de tamanho, parsing estrito, tempo constante para segredo e rate limiting/mitigação compatível com reentrega do Google;
- erros 401/403 desativam/retenção operacional do canal conforme contrato definido, sem revelar detalhes ao webhook;
- Anubis deve bloquear qualquer regressão que aceite e-mail/`userId` externo para DWD.

## Feature flags e rollout

Flags exatas, todas `false` por padrão:

```env
AGENDA_ALPHA_DISTRIBUTED_LOCK_ENABLED=false
AGENDA_ALPHA_QUEUE_ENABLED=false
AGENDA_ALPHA_PUSH_ENABLED=false
AGENDA_ALPHA_WEBHOOK_BASE_URL=
```

Validações:

- `PUSH_ENABLED=true` exige queue e lock habilitados e URL HTTPS pública;
- `QUEUE_ENABLED=true` exige lock habilitado;
- configuração inválida falha fechada no doctor/maintenance e não cria canais;
- flags não podem alterar leitura SSR nem o CRUD existente.

Ordem de rollout:

1. migration aplicada e validada, todas as flags `false`;
2. ativar lock distribuído e observar sync manual;
3. ativar fila e executar worker/maintenance de forma controlada;
4. validar URL pública, headers e canal de teste;
5. ativar push em lote pequeno, depois ampliar;
6. manter reconciliação periódica/manual mesmo com push.

## Acceptance Criteria

- [x] **AC-2A-001:** os três e somente os três models exatos desta story existem no schema, com as 10 estruturas normativas: 7 índices explícitos e 3 unicidades.
- [x] **AC-2A-002:** backup exclusivo validado; Vault apresentou o relatório, recebeu confirmação explícita e autorizou a aplicação única no Turso de produção.
- [x] **AC-2A-003:** a migration da Agenda contém apenas os três models e as 10 estruturas desta story, isolada das mudanças de Comissões.
- [x] **AC-2A-004:** tabelas, FKs, índices, unicidades e contagens foram verificados no Turso real após a migration.
- [x] **AC-2A-005:** canal pode ser criado, sobreposto na renovação, encerrado e marcado com erro por CLI sem expor segredo.
- [x] **AC-2A-006:** webhook válido responde rapidamente e enfileira/coalesce operação por `idempotencyKey`, sem executar sync no request.
- [x] **AC-2A-007:** canal desconhecido, resource divergente, token inválido ou headers malformados não enfileiram trabalho.
- [x] **AC-2A-008:** notificações duplicadas e notificações durante processamento não perdem mudança nem geram sync concorrente.
- [x] **AC-2A-009:** concorrência local/integrada comprova um único detentor válido do lock por calendário.
- [x] **AC-2A-010:** lease expirado pode ser retomado; owner obsoleto é barrado por owner + fencing em heartbeat, conclusão, cursor e release.
- [x] **AC-2A-011:** cache e `syncToken` avançam em uma transação após todas as páginas e sob fencing válido; `410 Gone` preserva a recuperação controlada.
- [x] **AC-2A-012:** retry respeita backoff/limites e não repete cegamente erros permanentes 400/401/403.
- [x] **AC-2A-013:** doctor, fila, worker e maintenance são operáveis por CLI sem UI.
- [x] **AC-2A-014:** maintenance renova canais com overlap, agenda reconciliação stale e recupera claims/leases expirados.
- [x] **AC-2A-015:** flags inválidas falham fechadas; defaults off preservam sync manual/cache-first.
- [x] **AC-2A-016:** DWD resolve `usuarios.email` apenas no servidor; webhook/CLI não escolhem subject por input livre.
- [x] **AC-2A-017:** logs/métricas são estruturados e sanitizados, sem tokens, chave privada ou conteúdo de evento.
- [x] **AC-2A-018:** agendas de colegas, preferências, tarefas e salas permaneceram inalteradas.
- [x] **AC-2A-019:** 183 testes da Agenda passaram, incluindo unidade, integração, concorrência, webhook e regressão.
- [x] **AC-2A-020:** Forge registrou build, lint e schema PASS; typecheck mantém somente quatro erros baseline externos, explicitamente separados.
- [ ] **AC-2A-021:** Anubis, Forge, Lens, Probe e Sage passaram; falta evidência final do CodeRabbit sem CRITICAL.
- [x] **AC-2A-022:** story, checkboxes, Completion Notes e File List real foram atualizados para Review.

## Tasks / Subtasks — ordem CLI First

- [x] **Task 0 — Gate Vault obrigatório (AC: 002–004)**
  - [x] Acionar Vault antes de editar `prisma/schema.prisma` ou criar SQL.
  - [x] Informar ambiente/banco, comandos planejados, impacto, risco, alternativa não destrutiva e rollback.
  - [x] Criar/validar backup exclusivo em `database-backups/pre-change/`: dump de `67.049.087` bytes, SHA-256 `d254a1906a7597eb3f073ddb4dac5d2ddd8f4ba9332a9b1c5acf1cd6ac3208cf`, 141 tabelas/34.667 linhas, restore descartável com `quick_check` aprovado e 0 violações de FK; nunca versionar o dump.
  - [x] Obter “sim” explícito para a migration Agenda Alpha Fase 2A.
  - [x] Manter o bloqueio até o relatório Vault e a confirmação; aplicar a migration autorizada uma única vez.

- [x] **Task 1 — Isolar schema/migration (AC: 001–004)**
  - [x] Preservar a alteração dirty de Comissões sem incorporá-la à migration da Agenda.
  - [x] Não reverter, incorporar ou regenerar a migration de Comissões.
  - [x] Criar migration isolada `prisma/migrations/20260730230000_agenda_alpha_phase_2a_push_queue_lock/migration.sql`, somente com três tabelas, 7 índices explícitos e 3 unicidades desta story.
  - [x] Não usar `prisma db push` como mecanismo/prova para o Turso real.
  - [x] Validar em ambiente seguro e aplicar no Turso somente pelo processo aprovado pelo Vault.

- [x] **Task 2 — Domínio CLI-first de lock e fila (AC: 008–012)**
  - [x] Criar store DB-backed de lock com acquire/heartbeat/release atômicos e fencing.
  - [x] Criar store de fila com enqueue idempotente/coalescido, claim, retry, DLQ, replay explícito e recuperação de claim.
  - [x] Integrar lock ao caminho manual e ao worker sem remover a atomicidade atual de `sync.ts`.
  - [x] Testar dois executores e relógio/lease controlados.

- [x] **Task 3 — Cliente de canais push (AC: 005, 014)**
  - [x] Encapsular `events.watch` e `channels.stop` em `src/lib/google-calendar/client.ts` ou módulo dedicado.
  - [x] Gerar channel/token seguros; persistir apenas hash do token.
  - [x] Implementar renovação com overlap e encerramento best-effort do canal substituído.

- [x] **Task 4 — Webhook mínimo e seguro (AC: 006–008, 016–017)**
  - [x] Implementar `POST /api/calendario-alpha/webhook`.
  - [x] Validar todos os headers/canal/resource/token sem depender de sessão.
  - [x] Enfileirar atomicamente e responder sem executar sync.
  - [x] Aplicar limite local, redaction, correlation ID e testes de contrato; WAF/rate limit distribuído permanece item externo de rollout.

- [x] **Task 5 — Worker CLI (AC: 009–013)**
  - [x] Criar `scripts/calendar-alpha-worker.mjs` e script npm `calendar-alpha:worker`.
  - [x] Suportar `--once`, `--drain` e `--max-jobs`, sempre com término observável.
  - [x] Resolver subject DWD pela relação server-side e executar delta sob lock.
  - [x] Definir exit codes: `0` sucesso/sem trabalho, `1` falha operacional, `2` configuração inválida.

- [x] **Task 6 — Maintenance CLI (AC: 005, 013–015)**
  - [x] Criar `scripts/calendar-alpha-maintenance.mjs` e `calendar-alpha:maintenance`.
  - [x] Suportar `--status`, `--renew-watches`, `--reconcile-stale`, `--recover-expired` e modo combinado explícito.
  - [x] Atualizar doctor para validar flags/dependências sem imprimir valores sensíveis.
  - [x] Documentar o comando operacional sem afirmar cron inexistente; scheduler supervisionado permanece pendente de infraestrutura.

- [x] **Task 7 — Feature flags, observabilidade e rollback (AC: 015, 017)**
  - [x] Implementar matriz de dependências e defaults false.
  - [x] Emitir contadores de webhook aceito/rejeitado, fila, retries, lock contention, lease perdido, sync e canais próximos da expiração.
  - [x] Não registrar payload/conteúdo privado.

- [ ] **Task 8 — Testes e gates (AC: 018–022)**
  - [x] Unitários: token hash, state machines, backoff, flags, fencing e redaction.
  - [x] Integração: SQL atômico/constraints no adapter compatível com Turso.
  - [x] Webhook: headers válidos/inválidos, duplicata, canal overlap e tempestade controlada.
  - [x] Concorrência local: dois workers, crash, lease expirado, stale owner e próxima operação idempotente durante processamento.
  - [x] Regressão: cache-first, `410`, DWD, CRUD, colegas live e sync manual.
  - [x] Rodar lint, testes, build, schema e revisões especializadas; quatro erros externos permanecem no typecheck global.
  - [x] Atualizar story/checklist/File List real.
  - [ ] Registrar CodeRabbit sem CRITICAL e executar E2E Google/Turso multi-instância real.

## Migração, backup, rollback e estado dirty

O working tree já está **dirty por Comissões**:

- `prisma/schema.prisma` contém `@@unique([eventId, collaboratorId])` em `CommissionEntry`;
- existe `prisma/migrations/20260730161000_commission_entry_event_collaborator_unique/`.

A migration da Agenda deve ser criada e revisada isoladamente. É proibido gerar uma migration combinada a partir do schema dirty, alterar/apagar a migration de Comissões ou considerar a aprovação Vault de Comissões como consentimento para Agenda.

### Plano não destrutivo

Manter as quatro flags desativadas e continuar com cache-first + sync manual/dedupe in-process. Isso preserva o comportamento atual enquanto Vault, URL HTTPS ou scheduler não estiverem prontos.

### Rollback operacional

1. `AGENDA_ALPHA_PUSH_ENABLED=false`;
2. impedir criação/renovação de canais e executar stop best-effort nos canais ativos;
3. `AGENDA_ALPHA_QUEUE_ENABLED=false` depois de interromper/drain controlado dos workers;
4. `AGENDA_ALPHA_DISTRIBUTED_LOCK_ENABLED=false` somente após nenhum worker ativo;
5. voltar ao sync manual/orquestrador in-process existente;
6. manter tabelas aditivas durante estabilização para preservar diagnóstico.

### Rollback de schema

Somente em janela aprovada pelo Vault, após flags off, workers parados e backup validado: remover as três tabelas novas em ordem dependente. Como o DDL de remoção perde dados operacionais, exige nova confirmação explícita; não é parte automática do deploy.

## Testing

- Framework atual: Vitest em `tests/google-calendar/`.
- Mocks somente na fronteira Google; fila/lock devem exercitar SQL/adapter real de teste.
- Tempo, UUID, workerId e backoff devem ser injetáveis/determinísticos.
- O teste real não pode marcar push como validado sem HTTPS público, watch criado e callback recebido.
- O E2E mínimo real deve provar: criar watch → receber `sync/exists` → operação idempotente coalescida → worker adquire lease → delta atualiza cache/cursor → canal renova.
- Nenhum teste pode usar evento/participante real em fixture versionada.

## CodeRabbit Integration

**Primary Type:** Database  
**Secondary Types:** Integration, API, Security, Architecture, Deployment  
**Complexity:** High

**Primary Agents:**

- @dev — implementação e pre-commit
- @data-engineer/@db-sage — schema, SQL atômico, migration e Turso
- @architect — concorrência, leases, fencing e compatibilidade

**Supporting Agents:**

- Vault — gate obrigatório de banco
- @qa — testes de concorrência e regressão
- Anubis — webhook público, DWD, secrets e redaction
- @github-devops — PR/deploy/flags/scheduler

**Quality Gates:**

- [ ] Pre-Commit: CodeRabbit uncommitted; CRITICAL auto-fix até 2 iterações/15 min; HIGH documentado.
- [ ] Pre-PR: CodeRabbit committed contra `main`; migration isolada e rollback revisados.
- [x] Pre-Deployment técnico: backup/Vault/consentimento, migration, flags false, configuração, worker/maintenance e rollback verificados.

**Pendência ambiental CodeRabbit (2026-07-30):** houve tentativa real de executar `wsl bash -lc '~/.local/bin/coderabbit auth status'`, mas ela falhou antes de qualquer revisão porque o WSL não está instalado e não há CLI nativa do CodeRabbit disponível neste ambiente. Portanto, nenhum resultado CodeRabbit foi produzido e os gates correspondentes permanecem desmarcados. Esta pendência é ambiental e não indica falha no código.

### Pendências externas para rollout

- [ ] Configurar e comprovar `AGENDA_ALPHA_WEBHOOK_BASE_URL` HTTPS pública.
- [ ] Configurar WAF/rate limit distribuído para o webhook; o limitador atual é por instância.
- [ ] Configurar scheduler supervisionado para worker/maintenance.
- [ ] Executar E2E autenticado Google → webhook → Turso → worker em múltiplas instâncias.
- [ ] Ativar canário em lote pequeno e observar antes de ampliar.

Até concluir os cinco itens, manter `AGENDA_ALPHA_DISTRIBUTED_LOCK_ENABLED=false`, `AGENDA_ALPHA_QUEUE_ENABLED=false` e `AGENDA_ALPHA_PUSH_ENABLED=false`.

**Focus Areas:**

- atomicidade de claim/acquire/heartbeat/release;
- fencing contra stale worker;
- constraints e índices Turso/SQLite;
- validação e idempotência do webhook;
- DWD server-side e secrets;
- retries limitados e observabilidade sem PII;
- isolamento da migration dirty de Comissões.

## File List prevista

**Story e configuração**

- `docs/stories/story-agenda-alpha-phase-2a-push-queue-lock.md`
- `package.json`
- `.env.example` (se existir na implementação; nunca `.env.local`)

**Schema/migration — somente após Vault**

- `prisma/schema.prisma`
- `prisma/migrations/20260730230000_agenda_alpha_phase_2a_push_queue_lock/migration.sql`

**Backend**

- `src/app/api/calendario-alpha/webhook/route.ts`
- `src/lib/google-calendar/client.ts`
- `src/lib/google-calendar/sync.ts`
- `src/lib/google-calendar/sync-orchestrator.ts`
- `src/lib/google-calendar/push-channels.ts`
- `src/lib/google-calendar/sync-queue.ts`
- `src/lib/google-calendar/distributed-lock.ts`
- `src/lib/google-calendar/runtime-config.ts`
- `src/actions/google-calendar-sync.ts`

**CLI**

- `scripts/calendar-alpha-doctor.mjs`
- `scripts/calendar-alpha-worker.mjs`
- `scripts/calendar-alpha-maintenance.mjs`

**Testes**

- `tests/google-calendar/push-channels.test.ts`
- `tests/google-calendar/webhook.test.ts`
- `tests/google-calendar/sync-queue.test.ts`
- `tests/google-calendar/distributed-lock.test.ts`
- `tests/google-calendar/worker.test.ts`
- `tests/google-calendar/maintenance.test.ts`
- `tests/google-calendar/runtime-config.test.ts`
- testes de regressão existentes em `tests/google-calendar/`

## Dev Agent Record

### Agent Model Used

Codex com agentes Bibble especializados.

### Debug Log References

- Sage: 183 testes da Agenda Alpha PASS.
- Forge: build, lint e validação de schema PASS.
- Typecheck global: somente quatro erros baseline externos em `ExclusaoFiscal` (2 gerados), `ModalPerfilColaborador.tsx` e `HabilitacaoRadarClient.tsx`.
- Probe, Anubis, Lens e Sage: PASS.
- CodeRabbit: tentativa real bloqueada antes da revisão; WSL ausente e nenhuma CLI nativa disponível.

### Completion Notes List

- Migration isolada da Fase 2A autorizada pelo Vault, aplicada uma vez no Turso de produção e validada com 3 models e 10 estruturas.
- Fila persistente com coalescência, claim CAS, retry/backoff, DLQ, replay e recuperação de claims.
- Lease distribuído com heartbeat, fencing e release condicional integrado ao sync manual, worker e lifecycle de canais.
- Push channels com token em hash, criação/renovação sobreposta/stop serializados e compensação de watch órfão.
- Webhook público implementado como sinal rápido: valida canal/resource/token/headers, atualiza metadados e enfileira sem chamar Google.
- Worker, maintenance, queue e doctor disponíveis por CLI, com saída estruturada e códigos de saída.
- Flags permanecem desligadas. O código está pronto para Review; rollout depende exclusivamente dos cinco itens externos listados acima.

### File List real

- `docs/stories/story-agenda-alpha-phase-2a-push-queue-lock.md`
- `.bibble/memory/architecture.md`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/integration-points.md`
- `package.json`
- `package-lock.json`
- `prisma/schema.prisma`
- `prisma/migrations/20260730230000_agenda_alpha_phase_2a_push_queue_lock/migration.sql`
- `scripts/calendar-alpha-doctor.mjs`
- `scripts/calendar-alpha-worker.mjs`
- `scripts/calendar-alpha-maintenance.mjs`
- `scripts/calendar-alpha-queue.mjs`
- `src/actions/google-calendar-sync.ts`
- `src/app/api/calendario-alpha/webhook/route.ts`
- `src/lib/google-calendar/client.ts`
- `src/lib/google-calendar/distributed-lock.ts`
- `src/lib/google-calendar/maintenance.ts`
- `src/lib/google-calendar/observability.ts`
- `src/lib/google-calendar/push-channels.ts`
- `src/lib/google-calendar/runtime-config.ts`
- `src/lib/google-calendar/sync.ts`
- `src/lib/google-calendar/sync-orchestrator.ts`
- `src/lib/google-calendar/sync-queue.ts`
- `src/lib/google-calendar/usuario-google.ts`
- `src/lib/google-calendar/worker.ts`
- `tests/google-calendar/cli.test.ts`
- `tests/google-calendar/client-watch.test.ts`
- `tests/google-calendar/distributed-lock.test.ts`
- `tests/google-calendar/maintenance.test.ts`
- `tests/google-calendar/observability.test.ts`
- `tests/google-calendar/push-channels.test.ts`
- `tests/google-calendar/runtime-config.test.ts`
- `tests/google-calendar/sync-action.test.ts`
- `tests/google-calendar/sync-fencing.test.ts`
- `tests/google-calendar/sync-orchestrator-distributed.test.ts`
- `tests/google-calendar/sync-orchestrator.test.ts`
- `tests/google-calendar/sync-queue.test.ts`
- `tests/google-calendar/sync.test.ts`
- `tests/google-calendar/webhook.test.ts`
- `tests/google-calendar/worker.test.ts`

## QA Results

**Resultado:** PASS para implementação flags-off; rollout externo bloqueado.

- Sage: 183 testes Agenda Alpha PASS.
- Forge: build, lint e schema PASS.
- Typecheck: quatro erros baseline externos, nenhum introduzido pela Fase 2A.
- Probe: PASS.
- Anubis: PASS.
- Lens: PASS após hardening de lifecycle lease/CAS, heartbeat e persistência em lotes.
- CodeRabbit: não executado; o comando `wsl bash -lc '~/.local/bin/coderabbit auth status'` falhou antes da revisão porque WSL/CLI nativa não estão disponíveis.
- Pendências não cobertas pelo gate local: CodeRabbit final, URL HTTPS pública, WAF/rate limit distribuído, scheduler supervisionado, E2E Google/Turso multi-instância e canário.

## Story Draft Checklist

| Categoria | Status | Evidência |
|---|---|---|
| Goal & Context Clarity | PASS | objetivo, valor, relação com cache-first e dependências explícitos |
| Technical Implementation Guidance | PASS | fluxo, endpoint, flags, três models exatos, CLI e migration definidos |
| Reference Effectiveness | PASS | story anterior, memórias técnicas e docs oficiais apontadas por seção/URL |
| Self-Containment | PASS | contratos, estados, edge cases, escopo e rollback estão na própria story |
| Testing Guidance | PASS | unidade, integração, concorrência, webhook, regressão e E2E real definidos |
| CodeRabbit Integration | PASS | tipos, agentes, gates, self-healing e focos preenchidos |

**Clarity score:** 10/10  
**Story readiness:** READY FOR REVIEW com implementação e migration concluídas; **BLOCKED somente para rollout externo**.  
**Infraestrutura remanescente:** URL HTTPS pública, WAF/rate limit distribuído, scheduler supervisionado, E2E Google/Turso multi-instância e ativação canário.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-07-30 | 1.0 | Draft da Fase 2A criado com arquitetura Turso DB-backed, três models exatos, webhook, CLI, flags, segurança, Vault, rollback e checklist. | River |
| 2026-07-30 | 1.1 | Evidência do backup validado registrada; models, estados, fila, lease, 7 índices e 3 unicidades alinhados ao desenho Dara. | River |
| 2026-07-30 | 2.0 | Vault autorizado; migration aplicada uma vez e validada no Turso. Fila, lease/fencing, push, webhook, worker, maintenance, CLIs, flags e observabilidade concluídos flags-off. Gates especializados PASS; rollout externo mantido bloqueado. | Scribe |
| 2026-07-30 | 2.1 | Tentativa real do CodeRabbit registrada como bloqueada antes da revisão por ausência de WSL e CLI nativa; gate mantido pendente, sem resultado inventado. | Scribe |
