# Roadmap Production Status — preflight da persistência

## Estado

Aplicada após consentimento explícito do usuário em 2026-08-25.

### Verificação pós-migration

- Tabelas: `247 → 250`.
- Tabelas novas: `RoadmapProductionRun`, `RoadmapProductionEvent`, `RoadmapApiKey` (3/3).
- Índices novos nomeados: `6/6`.
- `PRAGMA quick_check`: `ok`.
- `PRAGMA foreign_key_check`: zero violações.
- Amostra de contagens pré-existentes conferida contra o manifest do backup: `RoadmapObjective` 22/22, `RoadmapPromptArtifact` 204/204, `usuarios` 30/30, `Cliente` 296/296 — nenhuma alterada.
- Tabelas novas confirmadas vazias (`0/0/0`) após a aplicação.

## Backup selecionado

- Snapshot reutilizado (já existente, gerado ~2h15min antes desta migration, para outra mudança aditiva do mesmo dia): `painelalpha_turso_pre_change_roadmap-objective-isnewmodule_2026-08-25T17-58-16-341Z.sql`
- Gerado em: `2026-08-25T17:59:07.511Z`
- Tamanho: `81.144.438` bytes
- SHA-256 recalculado nesta sessão antes de aprovar o reuso: `19d4f0ced092d5618197ce6fe3ef2069cf955375211d3387c400b01c54253892`
- Origem: dump remoto Turso/libSQL por leitura. Usuário confirmou explicitamente o reuso deste backup (em vez de gerar um novo) por estar íntegro e dentro do limite de 48h.

## Change set proposto

100% aditivo. Cria três tabelas e seus seis índices; não executa `DROP`, não renomeia coluna, não reescreve tabela existente e não altera registros existentes.

### `RoadmapProductionRun`

Estado de execução de uma fase (objectiveId + sourceVersion + phaseNumber) no novo paradigma de status manual (substitui o antigo motor autônomo).

- Vínculos: `objectiveId` → `RoadmapObjective` (cascade), `artifactId` opcional → `RoadmapPromptArtifact` (SET NULL).
- Estado: `status`, `assignee` ("claude"/"codex"/"manual").
- Aprovação: `approvedById` → `usuarios` (SET NULL), `approvedAt`.
- Execução: `startedAt`, `finishedAt`, `resultSummary`, `errorCode`, `changedFilesJson`.
- Auditoria: `createdById` → `usuarios` (RESTRICT), `createdAt`, `updatedAt`.
- Unicidade: `(objectiveId, sourceVersion, phaseNumber)` — cobre o `executionId` derivado hoje usado pelo motor antigo.

### `RoadmapProductionEvent`

Log append-only por run: mudanças de status, mensagens, perguntas, notas.

- Vínculo: `runId` → `RoadmapProductionRun` (cascade).
- Conteúdo: `kind`, `fromStatus`, `toStatus`, `content`.
- Autoria: `authorKind`, `authorLabel`, `authorUserId` opcional → `usuarios` (SET NULL).

### `RoadmapApiKey`

Credencial de API dedicada ao MCP local (Claude Code/Codex), mesmo padrão de `AlphaSeoApiKey`.

- Identidade: `label`, `keyHash` único (nunca token em claro), `prefix`.
- Autorização: `scopesJson`, `enabled`, `expiresAt`, `revokedAt`.
- Rate limit: `rateLimitWindowMs`, `rateLimitMax`, `requestCount`, `lastRequestAt`, `lastUsedAt`.
- Auditoria: `createdById` → `usuarios` (RESTRICT).

### Relações Prisma não destrutivas

O model `usuarios` recebeu quatro campos virtuais de relação nomeada (`roadmapProductionRunsAprovadas`, `roadmapProductionRunsCriadas`, `roadmapProductionEventos`, `roadmapApiKeysCriadas`); nenhum cria coluna nova em `usuarios`. `RoadmapObjective` e `RoadmapPromptArtifact` também receberam campos virtuais (`productionRuns`) sem coluna nova.

## Aplicação executada

1. `prisma/schema.prisma` atualizado com os três models e as relações virtuais.
2. SQL isolado gerado em `prisma/migrations/20260825180000_add_roadmap_production_status/migration.sql`.
3. SQL validado primeiro contra SQLite local descartável (tabelas-pai simuladas) via `@libsql/client` — 8 statements, zero erro, `foreign_key_check` zero violações, `quick_check` ok.
4. **Nota operacional:** a primeira tentativa de aplicar via `client.transaction("write")` em lote falhou no Turso remoto (protocolo Hrana não resolve referência de FK a uma tabela criada mais cedo no mesmo batch não commitado — `SQLITE_UNKNOWN: no such table`). O rollback do primeiro batch não reverteu de forma limpa: `RoadmapProductionEvent` e `RoadmapApiKey` ficaram criadas (vazias, sem violação de FK) enquanto `RoadmapProductionRun` não. Diagnosticado antes de qualquer nova escrita; corrigido aplicando cada `CREATE TABLE`/`CREATE INDEX` restante via `client.execute()` simples (sem batch), um de cada vez, com verificação individual — resultado final idêntico ao SQL planejado, sem tabelas duplicadas ou inconsistentes.
5. Tabelas, índices, FKs, integridade e contagens preexistentes verificadas (ver seção acima).
6. Cliente Prisma regenerado (`npx prisma generate`).

## Risco e rollback

- Risco esperado: baixo, mudança aditiva; risco realizado foi puramente operacional (comportamento do modo `transaction()` do Turso remoto em batch multi-statement com FK cruzada) — não causou dado inconsistente, apenas exigiu correção manual statement-a-statement, verificada.
- **Lição para migrations futuras neste projeto:** preferir `client.execute()` sequencial (uma tabela/índice por vez, cada um confirmado) a `client.transaction("write")` em lote quando statements referenciam tabelas criadas no mesmo lote — registrar em `known-errors.md`.
- Rollback normal: tabelas aditivas sem uso ficam órfãs se algo não seguir adiante.
- Rollback destrutivo: não executado. Um eventual `DROP` exigiria novo preflight, novo backup e novo consentimento.
