# Roadmap Alpha — preflight da persistência

## Estado

Aplicada após consentimento explícito do usuário em 2026-08-15.

### Verificação pós-migration

- Transação única: concluída.
- Instruções aplicadas: `20/20`, todas `CREATE TABLE` ou `CREATE INDEX`.
- Tabelas: `191 → 195`.
- Tabelas Roadmap: `4/4`.
- Índices Roadmap nomeados: `16/16`.
- `PRAGMA quick_check`: `ok`.
- `PRAGMA foreign_key_check`: zero violações.
- Tabelas preexistentes com contagem alterada durante a operação: zero.

## Backup selecionado

- Snapshot: `painelalpha_turso_pre_change_bpm-campos-reuniao-agendada_2026-08-15T14-54-19-278Z.sql`
- Gerado em: `2026-08-15T14:54:20.979Z` (`11:54:20` BRT)
- Tamanho: `68.565.368` bytes
- SHA-256: `191699d57bf6192ff3446d7f9f7b6393cf58232b3ed5d2861062deaf032d2c63`
- Origem: dump remoto Turso/libSQL por leitura.

### Validação de restauração descartável

- SHA-256 recalculado: confere.
- `PRAGMA quick_check`: `ok`.
- `PRAGMA foreign_key_check`: zero violações.
- Tabelas: `191/191`.
- Índices e triggers: `257/257`.
- Contagens: `191/191` tabelas conferem.
- Linhas: `36.219/36.219`.
- Banco temporário: removido automaticamente após a validação.

## Change set proposto

A migration é 100% aditiva. Ela cria quatro tabelas e seus índices; não executa `DROP`, não renomeia coluna, não reescreve tabela existente e não altera registros existentes.

### `RoadmapObjective`

Fonte canônica do objetivo e de sua posição global.

- Identidade: `id`, `code` único.
- Módulo: `moduleKey` lógico, `moduleLabelSnapshot`, `moduleCategorySnapshot`; sem FK para o registry em código.
- Conteúdo: `title`, `description`, `desiredOutcome`, `constraints`, `acceptanceCriteriaJson`.
- Planejamento: `globalPriority` única, `status`, `documentationStatus`, `sourceVersion`.
- Auditoria: `createdById` com FK para `usuarios.id`, `archivedAt`, `createdAt`, `updatedAt`.
- Índices: prioridade ativa; módulo + prioridade; estado documental + prioridade.

### `RoadmapDocumentationJob`

Fila idempotente, com um job por versão do objetivo.

- Identidade e versão: `id`, `objectiveId`, `sourceVersion`, `idempotencyKey` único e unicidade de `(objectiveId, sourceVersion)`.
- Ordenação: `prioritySnapshot`, `availableAt`, `createdAt`.
- Estado: `status`, `attemptCount`, `maxAttempts`.
- Lease/fencing: `claimedBy`, `claimedAt`, `claimExpiresAt`, `heartbeatAt`, `claimToken`.
- Falha sanitizada: `lastErrorCode`, `lastErrorMessage`, `completedAt`, `deadLetteredAt`, `cancelledAt`.
- FK para objetivo com cascade; índices de fila, lease e objetivo/estado.

### `RoadmapDocumentationAttempt`

Histórico sanitizado de cada chamada ao provedor.

- Identidade: `id`, `jobId`, `attemptNumber`, únicos por job.
- Execução: `provider`, `model`, `status`, `startedAt`, `finishedAt`, `durationMs`, `httpStatus`.
- Diagnóstico: `errorCode`, `errorMessage`, `responseSha256`; sem token, URL autenticada ou resposta bruta.
- FK para job com cascade.

### `RoadmapPromptArtifact`

Conteúdo Markdown canônico que será projetado em `prompt-phases`.

- Vínculos: `objectiveId`, `jobId`, `attemptId` opcional, `documentationVersion`.
- Fase: `phaseNumber`, `slug`, `title`, `kind`, `agent`, `dependsOnJson`.
- Conteúdo: `contentMarkdown`, `relativePath` opcional, `sha256`, `status`, `publishedAt`.
- Unicidade: `(objectiveId, documentationVersion, phaseNumber)`.
- FKs para objetivo/job com cascade e tentativa com `SET NULL`; índice por job/fase.

### Relação Prisma não destrutiva

O model `usuarios` recebe apenas o campo virtual de relação `roadmapObjectives RoadmapObjective[]`; isso não cria coluna nova em `usuarios`.

## Aplicação executada

1. `prisma/schema.prisma` atualizado com os quatro models e a relação virtual.
2. SQL isolado gerado em `prisma/migrations/20260815130000_add_roadmap_alpha/migration.sql`.
3. SQL revisado e validado primeiro sobre restauração descartável.
4. Transação aplicada uma única vez no Turso remoto com `@libsql/client/web`.
5. Tabelas, índices, FKs, integridade e contagens preexistentes verificadas.
6. Cliente Prisma regenerado; testes e build executados.

## Risco e rollback

- Risco esperado: baixo a moderado, pois a mudança é apenas aditiva; o maior risco é operacional (aplicar no endpoint errado ou interromper a transação).
- Mitigação: host validado sem exibir credenciais, transação única, SQL allowlist apenas `CREATE TABLE/INDEX` e smoke test pós-migration.
- Rollback normal: desligar rota e worker e manter as tabelas aditivas sem uso.
- Rollback destrutivo: não executar automaticamente. Um eventual `DROP` exige novo preflight, novo backup e novo consentimento.
- Recuperação de desastre: restaurar o snapshot validado em banco de recuperação e promover somente após nova conferência.
