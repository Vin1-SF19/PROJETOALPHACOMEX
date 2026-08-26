# Roadmap Documentation Worker Lock — preflight da persistência

## Estado

Aplicada após consentimento explícito do usuário em 2026-08-26.

### Verificação pós-migration

- Tabelas: `250 → 251`.
- Tabela nova: `RoadmapDocumentationWorkerLock` confirmada.
- `PRAGMA quick_check`: `ok`.
- `PRAGMA foreign_key_check`: zero violações.
- Amostra de contagens pré-existentes conferida: `RoadmapObjective` 26 (esperado, cresceu desde a última migration desta sessão), `usuarios` 30 — nenhuma alterada.

## Backup selecionado

- Snapshot gerado nesta mesma sessão, imediatamente antes da migration: `painelalpha_turso_pre_change_roadmap-documentation-worker-lock_2026-08-26T16-48-01-862Z.sql`
- Tamanho: `75.755.741` bytes
- SHA-256: `289f91f8a3b304d7dd4dd69d2976714d4d25a56ccca762ac00160eafb54ac661`
- Tabelas: `249`, Linhas: `42.397`
- Origem: dump completo do Turso remoto de produção, gerado por script pontual (`@libsql/client`), descartado após uso.

## Contexto e motivo

Usuário reportou que o worker de documentação (Qwen) estava processando vários objetivos do Roadmap ao mesmo tempo, quando deveria ser estritamente sequencial (1 por vez). Investigação confirmou: `RoadmapDocumentationJob.claimToken` já protege contra o mesmo job ser reivindicado duas vezes, mas **nada impede dois processos worker diferentes de reivindicarem jobs diferentes simultaneamente** — cada um chamando o servidor Ollama ao mesmo tempo, sem nenhuma serialização.

## Change set aplicado

100% aditivo — cria 1 tabela nova, sem `DROP`/`ALTER`/mudança em dado existente.

### `RoadmapDocumentationWorkerLock`

Lock global singleton (`id` fixo `"singleton"`) com o mesmo padrão de fencing otimista já usado em `RoadmapDocumentationJob` (`claimToken` incremental, `claimedBy`/`claimedAt`/`claimExpiresAt`/`heartbeatAt`). Antes de reivindicar um job da fila, o worker precisa primeiro adquirir este lock — só o dono do lock pode chamar `claimNextJob`. Lease de 12 minutos (mesmo `LEASE_MS` do job), renovado a cada heartbeat de 30s junto com o heartbeat do job.

## Aplicação executada

1. `prisma/schema.prisma` atualizado com o model `RoadmapDocumentationWorkerLock`.
2. SQL isolado gerado em `prisma/migrations/20260826170000_add_roadmap_documentation_worker_lock/migration.sql` (só `CREATE TABLE`).
3. SQL validado antes contra SQLite local via `@libsql/client` — sem erro.
4. Transação aplicada via `client.execute()` simples no Turso remoto (não `client.transaction()` — lição já documentada em `known-errors.md` sobre o Hrana remoto não resolver referências dentro do mesmo batch).
5. Tabelas, integridade e contagens preexistentes verificadas.
6. Cliente Prisma regenerado.
7. `src/lib/roadmap-alpha/worker.ts` atualizado: `acquireWorkerLock`/`releaseWorkerLock`/`heartbeatWorkerLock`, integrados em `processNextRoadmapJob` (adquire antes de `claimNextJob`, libera no `finally` final, heartbeat junto do heartbeat do job).

## Risco e rollback

- Risco esperado: baixo — mudança aditiva, sem tocar em tabela existente.
- Risco operacional mitigado: se o lock ficar preso por um worker que morreu sem liberar, o lease expira em 12 minutos e o próximo worker recupera automaticamente (mesmo padrão de recuperação já usado em `RoadmapDocumentationJob`).
- Rollback normal: tabela aditiva sem uso fica órfã se algo não seguir adiante.
- Rollback destrutivo: não executado. Um eventual `DROP` exigiria novo preflight, novo backup e novo consentimento.
