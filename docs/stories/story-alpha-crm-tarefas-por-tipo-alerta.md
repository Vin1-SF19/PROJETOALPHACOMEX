# Story: Tarefas CRM por tipo, prazo e alerta

**Status:** Ready for Review

## Objetivo

Criar tarefas operacionais do card por tipo, cada uma com formulário próprio, prazo obrigatório e alerta interno persistido.

## Tipos

- Checklist: título e itens.
- Ligação: contato, telefone e objetivo.
- WhatsApp: contato e mensagem a enviar.
- E-mail: destinatário, assunto e mensagem a enviar.
- Tarefa: título e descrição.
- Lembrete rápido: texto curto e contexto opcional.

## Banco e automação

- Migration manual já aplicada no Turso remoto em 2026-08-13, após backup completo validado: `tipo`, `alertaEm`, `alertaDisparadoEm` e índice `status + alertaEm` em `BpmTarefa`.
- Backup pré-alteração: `database-backups/pre-change/painelalpha_turso_pre_change_bpm-tarefas-tipo_2026-08-13T20-38-28-289Z.sql` (67.829.191 bytes; SHA-256 `28902b9a6eb9bfcf4aeeae40bc86869c099ec76e01f3d71893e9aee42870a47f`; 184 tabelas; 34.536 linhas).
- Alertas são internos: o cron protegido marca tarefas vencidas uma vez e emite realtime para o pipeline. Tipos WhatsApp/E-mail criam tarefas, não enviam mensagens externas automaticamente.
- Presets também exigem prazo e alerta para cada item; presets legados incompletos são recusados, sem criar tarefas parciais.
- O card do board mostra o próximo prazo pendente e, quando existir, a anotação rápida pendente; isso dispensa abrir o modal apenas para consultar a próxima ação.

## Validação executada

- `npx prisma generate` concluído após a DDL remota.
- `npx vitest run tests/bpm --reporter=dot`: 36 arquivos / 224 testes aprovados.
- ESLint focado dos arquivos desta story: aprovado.
- `git diff --check`: aprovado (sem erro de whitespace).
- `npm run typecheck`: bloqueado por execuções concorrentes de TypeScript no workspace; a última execução isolada anterior deste conjunto tinha somente os cinco baselines já conhecidos fora do CRM. Não houve erro de tipo nos testes/eslint desta story.

## Rollback e operação

- O backup pré-alteração está em `database-backups/pre-change/` e não é versionado.
- A migration é aditiva. Em recuperação, restaure o backup em um banco Turso de recuperação; não use remoção de colunas como rollback rotineiro.

## File List

- `prisma/schema.prisma`
- `prisma/manual-migrations/20260813_bpm_tarefas_tipo_alerta.sql`
- `src/lib/bpm/tarefas-tipo.ts`
- `src/lib/bpm/alertas-tarefas.ts`
- `src/actions/bpm/Tarefas.ts`
- `src/actions/bpm/Cards.ts`
- `src/lib/validations/bpm.ts`
- `src/app/api/bpm/jobs/alertas-tarefas/route.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelTarefasPorTipo.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `src/lib/bpm/automacao-novos-leads.ts`
- `vercel.json`
- `tests/bpm/tarefas-tipo.test.ts`
- `tests/bpm/tarefas-tipo-actions.test.ts`
