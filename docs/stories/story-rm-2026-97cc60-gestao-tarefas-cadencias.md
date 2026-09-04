# Story — RM-2026-97CC60: Gestão de Tarefas e Cadências

## Objetivo

Implementar o menor delta de dados aprovado para suportar tarefas, recorrências, checklists e cadências, reutilizando estruturas existentes sempre que forem semanticamente compatíveis.

## Checklist

- [x] Fase 0 — Auditoria de capacidades existentes (Scout)
- [x] Fase 1 — Blueprint técnico (Scout)
- [x] Fase 2 — Relatório Vault (schema aditivo aprovado)
- [x] Fase 3 — Modelo de domínio e persistência (EXECUTION)
  - [x] Schema Prisma: `BpmCadencia`, `BpmCadenciaPasso`, `BpmCardCadencia`, `BpmCadenciaPassoExecucao`, `BpmTarefa.cadenciaExecucaoId`
  - [x] Migrations aditivas aplicadas no Turso real
  - [x] `src/lib/bpm/cadencias/schemas.ts` — Zod schemas
  - [x] `src/actions/bpm/Cadencias.ts` — Server Actions CRUD + vínculos
  - [x] `src/lib/bpm/cadencias/executor.ts` — `processarCadenciasBpm()`
  - [x] `scripts/bpm-cadencias-cli.mjs` — CLI `npm run bpm:cadencias`
  - [x] Integração com cron existente (`src/app/api/bpm/jobs/automacoes/route.ts`)
  - [x] Executor atômico (transação por vínculo, recuperação de falha)
  - [x] Testes de idempotência, concorrência e avanço persistido
  - [x] Story com checklist e File List atualizados

## File List

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `prisma/schema.prisma` | EDIT | Models `BpmCadencia`, `BpmCadenciaPasso`, `BpmCardCadencia`, `BpmCadenciaPassoExecucao`, coluna `BpmTarefa.cadenciaExecucaoId` |
| `prisma/migrations/20260904120000_bpm_cadencias/migration.sql` | NEW | Migration aditiva (4 tabelas + coluna) |
| `prisma/migrations/20260904121500_bpm_cadencia_motivo_interrupcao/migration.sql` | NEW | Coluna `motivoInterrupcao` em `BpmCardCadencia` |
| `src/lib/bpm/cadencias/schemas.ts` | NEW | Zod schemas de criação/edição/vínculo |
| `src/lib/bpm/cadencias/executor.ts` | NEW | `processarCadenciasBpm()` — motor de avanço de passos |
| `src/actions/bpm/Cadencias.ts` | NEW | Server Actions CRUD + vínculos card×cadência |
| `src/lib/bpm/ownership.ts` | EDIT | Novo valor `configurarCadencias` em `BpmAcaoPipeline` |
| `scripts/bpm-cadencias-cli.mjs` | NEW | CLI `npm run bpm:cadencias` |
| `package.json` | EDIT | Script `bpm:cadencias` |
| `src/app/api/bpm/jobs/automacoes/route.ts` | EDIT | Invoca `processarCadenciasBpm()` no cron existente |
| `tests/bpm/cadencias-executor.test.ts` | NEW | Testes de idempotência, concorrência e avanço |
| `src/components/bpm/cadencias/types.ts` | NEW | Tipos de visualização usados pela UI de cadências |
| `src/components/bpm/cadencias/CadenciaFormDialog.tsx` | NEW | Formulário de criação/edição de cadência e passos |
| `src/components/bpm/cadencias/CadenciasWorkspace.tsx` | NEW | Listagem administrativa com edição e ativação/desativação |
| `src/components/bpm/cadencias/PainelCadenciasCard.tsx` | NEW | Painel do card para iniciar, pausar, reativar e cancelar cadências |
| `src/app/PainelAlpha/AlphaCRM/admin/cadencias/page.tsx` | NEW | Página administrativa protegida por perfil de administrador |
| `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx` | EDIT | Adiciona a aba `Cadências` ao card |
| `src/app/PainelAlpha/AlphaCRM/CRMLayoutClient.tsx` | EDIT | Adiciona o item administrativo `Cadências` ao menu |
| `docs/stories/story-rm-2026-97cc60-gestao-tarefas-cadencias.md` | NEW | Esta story |
| `.bibble/memory/architecture.md` | EDIT | Registra a arquitetura e o escopo entregue na Fase 4 |

## Divergências

- `BpmTarefa.cadenciaExecucaoId` é a única direção de FK (execução → tarefa via reverse relation `tarefas`), não há coluna redundante em `BpmCadenciaPassoExecucao`.
- O executor usa `db.$transaction` por vínculo para atomicidade; falha intermediária marca a execução como `FALHA` em vez de deixar `EM_EXECUCAO` órfã.
- A chave de idempotência (`vinculoId:passoOrdem:dataISO`) usa a data do dia, não o timestamp exato, para permitir reprocessamento no mesmo dia sem duplicar.

## Fase 4 — UI e consumo no card (2026-09-04, operador humano via Claude Code)

Concluída sem alteração de schema (backend já existia e passa nos testes):

- [x] UI admin `/PainelAlpha/AlphaCRM/admin/cadencias` — CRUD de cadências e passos (`CadenciasWorkspace.tsx`/`CadenciaFormDialog.tsx`), rota já esperada pelo backend (`ROTA_ADMIN_CADENCIAS`).
- [x] Painel no card — nova aba "Cadências" em `PainelHistorico.tsx` (`PainelCadenciasCard.tsx`): lista vínculos ativos/pausados com passo atual e próxima execução, inicia nova cadência, pausa/cancela/reativa.
- [x] Item de menu "Cadências" em `CRMLayoutClient.tsx`.
- [x] `npx tsc --noEmit`, `npx eslint`, `npm run build` (exit 0) sem diagnósticos novos.

### Pendências para fases futuras (não implementadas nesta rodada — arquivos correspondentes estão em edição ativa por trabalho paralelo no mesmo repositório, ver `git status`)

- Integração com Motor de Automações (ação `INICIAR_CADENCIA` em `src/lib/bpm/automacoes/executor.ts`/`schemas.ts`) — adiado por risco de colisão com edição concorrente desses arquivos.
- Interrupção automática de cadência quando `proximoContatoEm` é preenchido no card (exemplo da descrição original) — hoje só manual via botão "Cancelar"/"Pausar"; requer hook em `AtualizarCardBpm` (também em edição ativa) ou uma regra do Motor de Regras.
- Central de tarefas com filtro por cadência.
