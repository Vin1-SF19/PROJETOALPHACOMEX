# Story RM-2026-095B40 — Gestão de Prazos, SLA e Alertas

## Objetivo

Entregar gestão configurável de SLA no Alpha CRM/BPM, com persistência por card, cálculo de prazo, pausa/retomada, alertas visuais e gatilhos idempotentes no Motor de Automações.

## Caminhos de consumo

- Administração: `/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]`.
- Operação: `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` e modal do card.
- Processamento: jobs protegidos em `/api/bpm/jobs/*`.

## Critérios de aceite

- [x] Administrador configura duração, unidade, início, limites e política do SLA por pipeline/etapa.
- [x] A configuração persiste e é reapresentada após recarregar a página.
- [x] Cada card possui instância idempotente de SLA, com deadline e estados de início, pausa, retomada, vencimento e conclusão.
- [x] O tempo pausado não é consumido nem acrescentado ao prazo contratado.
- [x] Kanban e modal exibem status e tempo restante com estados verde, amarelo e vermelho.
- [x] Alertas de proximidade e vencimento são disparados uma única vez por instância/tipo.
- [x] O Motor de Regras e o Motor de Automações recebem o contexto real do SLA.
- [x] O gatilho de SLA vencido não duplica ações em retries ou concorrência.
- [x] Timeline e Central de Pendências conseguem consumir as fontes persistidas de SLA.
- [x] Ownership, autenticação, validação Zod e estados de UI são cobertos por testes.

## Segurança de banco

- Migrations aplicadas, em ordem:
  - `prisma/migrations/20260904160000_bpm_sla_prazos_alertas/migration.sql`;
  - `prisma/migrations/20260904180500_bpm_sla_config_completa/migration.sql`;
  - `prisma/migrations/20260904182000_bpm_sla_contrato_definitivo/migration.sql`.
- Alvo de runtime: Turso remoto `banco-alpha-alphacomex`.
- Backup imediatamente anterior à recriação definitiva: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-04T18-13-55-446Z.sql`.
- Manifest: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-04T18-13-55-446Z.manifest.json`.
- Verificação: 282 tabelas, 68.332 linhas, 96.174.621 bytes, SHA-256 `2665112c165a7b40a1ad20de2b57daabd3ca458e71da75367e4e2d280b8a491f`.
- Autorizações explícitas registradas no pipeline: `3cde4ecf8553d51f509199a7e982acf51bf28800f3203a4db0f81febde0584a7` (complemento aditivo) e `c365c52386cc5872fb3f2bd5da7af18ef2f386494d2dfc6d387506e67220b4e6` (recriação definitiva das cinco tabelas vazias).

### Evidência Vault persistida

- Preflight remoto imediatamente antes de `20260904182000`: `BpmSlaConfig=0`, `BpmSlaAlertaLimite=0`, `BpmSlaInstancia=0`, `BpmSlaDisparo=0`, `BpmSlaEventoLog=0`.
- Restauração integral do backup em SQLite em memória: cinco tabelas SLA presentes e vazias; aplicação simulada da migration definitiva concluída; `PRAGMA foreign_key_check=[]`.
- `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`: concluído, 5.616 linhas geradas para inspeção em `/tmp/rm-2026-095b40-prisma-diff.sql`.
- Aplicação remota autorizada: `node scripts/apply-turso-migration.mjs prisma/migrations/20260904182000_bpm_sla_contrato_definitivo/migration.sql` → `27 statements`.
- Pós-validação remota: cinco tabelas; dois índices únicos parciais (`BpmSlaInstancia_card_config_key`, `BpmSlaInstancia_tarefa_config_key`); 12 FKs; `PRAGMA foreign_key_check=[]`; `PRAGMA integrity_check=ok`.
- Pós-validação local: `npx prisma generate`, `npx prisma validate` e `git diff --check` aprovados.
- A tentativa automática posterior recebeu `EAI_AGAIN` dentro do sandbox somente leitura; esse erro de DNS ocorreu depois da aplicação/verificação acima e não representa falha do banco.

## Tarefas

- [x] Auditar infraestrutura existente e caminhos de consumo.
- [x] Preparar schema e migrations versionadas.
- [x] Validar o schema Prisma.
- [x] Gerar e verificar backup completo imediatamente anterior à mudança.
- [x] Aplicar as migrations no Turso após aprovações explícitas.
- [x] Implementar motor de cálculo, pausa/retomada e provisionamento.
- [x] Implementar CRUD e UI administrativa.
- [x] Integrar indicadores no Kanban e no modal.
- [x] Integrar gatilhos e ações ao Motor de Automações.
- [x] Criar testes unitários, de integração e de idempotência.
- [x] Executar lint, typecheck, testes e build proporcionais ao escopo.
- [x] Atualizar memória e relatório de conclusão.
- [x] Mover o card para “Em testes”.

## Evidências de conclusão

- Testes direcionados: `15/15` aprovados em `sla-calculo`, `sla-admin-ui` e `sla-alertas-automacao`.
- E2E com SQLite/libSQL real e isolado: estados `DENTRO_PRAZO → PROXIMO_VENCIMENTO → ATRASADO`, cores configuradas, dois disparos idempotentes, dois eventos de domínio, uma automação materializada/executada, uma tarefa real e retomada com deadline deslocado em 30 minutos.
- Rota administrativa compilada em servidor isolado e protegida: acesso anônimo respondeu `307` para `/?acesso=bloqueado`.
- ESLint direcionado e `git diff --check`: aprovados.
- Build de produção isolado: aprovado, incluindo `/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]` e `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]`.
- Typecheck global e suítes amplas ainda reportam débitos preexistentes/concorrentes fora deste objetivo; nenhum diagnóstico foi encontrado nos arquivos SLA modificados.

## File List

- `docs/stories/story-rm-2026-095b40-gestao-prazos-sla-alertas.md`
- `prisma/schema.prisma`
- `prisma/migrations/20260904160000_bpm_sla_prazos_alertas/migration.sql`
- `prisma/migrations/20260904180500_bpm_sla_config_completa/migration.sql`
- `prisma/migrations/20260904182000_bpm_sla_contrato_definitivo/migration.sql`
- `src/lib/bpm/sla.ts`
- `src/actions/bpm/Sla.ts`
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/Tarefas.ts`
- `tests/bpm/sla-calculo.test.ts`
- `tests/bpm/sla-alertas-automacao.test.ts`
- `src/lib/validations/bpm-sla.ts`
- `src/lib/bpm/automacoes/central-schemas.ts`
- `src/lib/bpm/automacoes/eventos.ts`
- `src/lib/bpm/realtime.ts`
- `src/lib/prisma.ts`
- `src/components/bpm/sla/SlaStatusBadge.tsx`
- `src/components/bpm/automacoes/MotorCentralPanel.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelSlaCard.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/SlaConfigForm.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/SlaConfigSection.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/page.tsx`
- `tests/bpm/sla-admin-ui.test.ts`
- `scripts/verify-sla-e2e.ts`
- `.bibble/memory/architecture.md`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/components.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/journal.md`
