# Story — Saneamento ontológico completo do CRM/BPM

**Status:** In Progress
**Especificação:** `ONTOLOGIA_CANONICA_CRM_BPM.md` e prompt administrativo de 2026-09-05
**Banco:** Turso de produção, sob gate Vault aprovado em 2026-09-05

## Objetivo

Convergir o CRM/BPM para identidade estável, uma definição canônica de transição, um único comando de movimento e separação explícita entre apresentação, políticas, lifecycle, outcome, substatus e ownership dos dados.

## Critérios de aceite

- [x] Uma única source of truth runtime define A → B.
- [ ] Todo mutador de `BpmCard.etapaId` usa o comando canônico, salvo migration/repair documentado.
- [ ] Movimento manual e automático avaliam as mesmas policies, requisitos, regras e checklists.
- [ ] Visibilidade, editabilidade, autorização, requisito e validade são independentes.
- [ ] Pipeline, etapa, campo, automação e substatus usam identidade estável.
- [ ] Lifecycle, outcome e substatus possuem estado e invariantes explícitos.
- [ ] Dados nativos especializados possuem owner relacionado e compatibilidade segura.
- [ ] Formulário de etapa possui definição determinística persistida.
- [ ] NoLoss é read model virtual discriminado, não `BpmCard` falso.
- [ ] Consulta de card é pura; primeira visualização é comando explícito.
- [ ] Transição persiste estado, auditoria e outbox atomicamente.
- [ ] SLA e automações reagem ao mesmo comando/evento.
- [ ] Testes de invariantes e regressão são aprovados ou comparados ao baseline documentado.

## Fases

- [x] Fase 0 — diagnóstico, inventário remoto, backup e baseline.
- [ ] Fase 1 — identidades estáveis e invariantes.
- [x] Fase 2 — `BpmTransicaoEtapa` como definição canônica única.
- [ ] Fase 3 — comando canônico de transição.
- [ ] Fase 4 — convergência de mutadores.
- [ ] Fase 5 — policies e requisitos independentes.
- [ ] Fase 6 — lifecycle, outcome e substatus.
- [ ] Fase 7 — ownership dos dados especializados.
- [ ] Fase 8 — definição/renderização de formulário.
- [ ] Fase 9 — SLA, eventos e automações.
- [ ] Fase 10 — quarentena dos legados.
- [ ] Fase 11 — auditoria final.

## Evidência Vault

- Backup original: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-05T13-42-26-709Z.sql`
- Backup imediatamente anterior à aplicação: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-05T16-18-58-738Z.sql`
- SHA-256: `cab3cfe95e117f1458645f01d7777e1c63bcde24895eb3a2d8681cab58d555a4`
- 96.486.540 bytes, 295 tabelas e 68.909 registros.
- Restauração descartável, integridade e FKs aprovadas.
- Autorização específica recebida para migration aditiva, backfills e aplicação no Turso.

## Implantação em produção — 2026-09-05

- Incidente: páginas dinâmicas de pipeline retornavam 404 porque o código publicado consultava o contrato canônico antes da migration correspondente existir no Turso.
- Migration aplicada: `prisma/migrations/20260905143000_bpm_ontologia_canonica/migration.sql` (`78` statements).
- Pós-validação: `PRAGMA integrity_check=ok`, zero violações de chave estrangeira e zero chaves canônicas nulas.
- Readback: 55 requisitos, 32 formulários e 2 estados de card materializados.
- Smoke da consulta da página: `Revisão de Radar` retornou 9 etapas, 29 campos e 2 cards, todos com `BpmCard.versao` legível.
- Rollback preservado no backup imediatamente anterior à aplicação; nenhum dump foi versionado.

## Baseline

Seleção focada: 13 arquivos, 131 testes; 119 aprovados e 12 falhas preexistentes (11 em `card-modal-integration`, 1 em `lost-actions`).

## File list

- `docs/stories/story-saneamento-ontologico-crm-bpm.md`
- `docs/reports/crm-config-canonical-sources-p0-1.md`
- `plan/self-critique-p0-1.json`
- `prisma/schema.prisma`
- `scripts/bpm-migrate-canonical-sources.mjs`
- `scripts/configurar-novos-leads-campos.mjs` (removido)
- `scripts/post-audit-novos-leads.ts` (removido)
- `src/actions/bpm/Cadencias.ts`
- `src/actions/bpm/Campos.ts`
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/Etapas.ts`
- `src/actions/bpm/PipelineFinanceiro.ts`
- `src/actions/bpm/Pipelines.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelResumoEtapas.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/CadenciaEtapasSection.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/ConfigurarEtapasFinanceiroButton.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `src/components/bpm/cadencias/CadenciaFormDialog.tsx`
- `src/components/bpm/cadencias/types.ts`
- `src/lib/bpm/cadencias/ativacao-automatica.ts`
- `src/lib/bpm/cadencias/executor.ts`
- `src/lib/bpm/lost.ts`
- `src/lib/bpm/pendencias/motor.ts`
- `src/lib/bpm/pipeline-financeiro-migration.ts` (removido)
- `src/lib/bpm/requisitos-etapa-server.ts`
- `src/lib/bpm/transicao-command.ts`
- `src/lib/validations/bpm.ts`
- `tests/bpm/cadencias-actions.test.ts`
- `tests/bpm/cadencias-ativacao-automatica.test.ts`
- `tests/bpm/cadencias-por-coluna.test.ts`
- `tests/bpm/canonical-sources-contract.test.ts`
- `tests/bpm/crud-campos-bpm.test.ts`
- `tests/bpm/fechado-actions.test.ts`
- `tests/bpm/kanban-transicao-integracao.test.ts`
- `tests/bpm/lost-actions.test.ts`
- `tests/bpm/lost.test.ts`
- `tests/bpm/pendencias-motor.test.ts`

## Dev Agent Record

### Agent Model Used

- Codex GPT-5

### Debug Log References

- Diagnóstico, dry-run, backup, rollback e matriz de requisitos: `docs/reports/crm-config-canonical-sources-p0-1.md`.
- Backup pré-alteração validado em restauração descartável; migration aplicada no Turso após autorização explícita.

### Completion Notes

- P0-1 concluída em worktree isolado: transições, campo-etapa, SLA, cadência-etapa e requisitos de campo possuem uma única fonte operacional.
- 35 configurações campo-etapa criadas, 39 obrigatoriedades materializadas, 94 associações redundantes removidas e 55 requisitos concorrentes preservados como histórico inativo.
- Nenhum dado de card foi removido; dry-run final e segunda aplicação local provaram idempotência.
- P0-2 deve iniciar pelo inventário/migração dos formulários, sem reabrir os contratos canônicos aqui consolidados.

### Change Log

- 2026-09-09 — P0-1 CRM-CONFIG-CANONICAL-SOURCES implementada, aplicada e validada.
