# Story RM-2026-0FC47A — Checklists pendentes devem virar tarefas

## Contexto

O Alpha CRM possui dois domínios adjacentes que hoje não se comunicam: **checklists por card** (`BpmCardChecklist`/`BpmCardChecklistItem`, RM-2026-209DB4) e **tarefas** (`BpmTarefa`, view `/PainelAlpha/AlphaCRM/tarefas`). Quando um checklist materializado em um card tem itens obrigatórios pendentes, isso não gera nenhuma tarefa visível na central de tarefas. O objetivo de negócio é que checklists pendentes apareçam como tarefa, de forma sincronizada (1:1), sem duplicar a fonte da verdade do progresso.

## Escopo

- Coluna aditiva e nullable `BpmTarefa.cardChecklistId String? @unique` com FK para `BpmCardChecklist`.
- Serviço `reconciliarTarefaChecklist` (idempotente, dentro de transação) que cria/atualiza a tarefa 1:1 correspondente ao estado do checklist.
- Integração do serviço nos pontos de mutação existentes: materialização do checklist, conclusão/reabertura de item, adição de item exclusivo.
- Guarda em `ConcluirTarefaBpm` para impedir conclusão manual de tarefa gerenciada por checklist enquanto houver pendência.
- Badge/indicação na UI de tarefas para tarefas gerenciadas por checklist.
- CLI de reconciliação inicial idempotente (dry-run + aplicação), executada apenas após aprovação Vault específica para mutação em massa.

## Fora de escopo

- Prazo, prioridade ou notificação além do que `BpmTarefa` já possui.
- Novo model de domínio.
- Alteração do fluxo de criação de tarefas manuais (ele continua como está).
- Propagação de mudança de template para checklists já materializados.
- Hard delete de tarefas ou checklists.
- SLA ou cadência específica para a tarefa derivada.

## Arquitetura

### Máquina de estado (tarefa derivada do checklist)

| Estado do checklist | Ação na tarefa |
|---|---|
| Item incompleto (qualquer) | tarefa `PENDENTE` (cria se não existe) |
| Todos os itens `CONCLUIDO` | tarefa `CONCLUIDA` |
| Item reaberto (`CONCLUIDO`→`PENDENTE`) | tarefa volta a `PENDENTE` |
| `responsavelId` do item alterado | `responsavelId` da tarefa sincronizado |

### Concorrência

- `BpmTarefa.cardChecklistId` com `@unique` garante no máximo uma tarefa por checklist.
- `reconciliarTarefaChecklist` usa `findUnique` por `cardChecklistId` + `create` com catch de `P2002`, mesmo padrão já usado em `materializarChecklistsAplicaveisCard`.
- Toda a reconciliação roda dentro da mesma transação da mutação de origem.

### FK e política de remoção

`BpmTarefa.cardChecklistId` referencia `BpmCardChecklist.id` com `onDelete: Restrict`: impede remover um checklist enquanto existir tarefa vinculada, preservando auditoria (mesmo padrão adotado em RM-2026-D100EB para versões/eventos).

## Arquivos previstos

**Criar:**
- `src/lib/bpm/checklists/reconciliacao-tarefa.ts`
- `prisma/migrations/<timestamp>_bpm_tarefa_card_checklist_fk/migration.sql`
- `tests/bpm/checklists-reconciliacao-tarefa.test.ts`
- CLI de reconciliação inicial (script em `scripts/`)

**Editar:**
- `prisma/schema.prisma`
- `src/lib/bpm/checklists/service.ts`
- `src/actions/bpm/Checklists.ts`
- `src/actions/bpm/Tarefas.ts`
- `src/app/PainelAlpha/AlphaCRM/tarefas/TarefasCentralClient.tsx`

## Riscos

- Concorrência entre materialização e atualização de item na mesma transação.
- Duplicação durante a reconciliação inicial se executada mais de uma vez sem idempotência.
- Divergência manual se alguém completar a tarefa fora do fluxo guardado.
- Performance da varredura inicial em ambientes com muitos checklists (mitigada pelo volume real, ver preflight na Fase 3).

## Rollback

Migration estritamente aditiva: `DROP COLUMN cardChecklistId` + `DROP INDEX` correspondente revertem a estrutura sem perda de dados de checklist/tarefa pré-existentes. Reconciliação inicial (dados) é revertida apagando apenas as tarefas criadas por ela (identificáveis por `cardChecklistId IS NOT NULL` e janela de criação).

## Dependências

- RM-2026-209DB4 (Checklist Builder) — concluído.
- View de tarefas (`/PainelAlpha/AlphaCRM/tarefas`) — já existe.
- Vault — 2 checkpoints obrigatórios: (1) antes de schema/migration; (2) antes de reconciliação inicial (mutação em massa).

## Checkpoint Vault obrigatório

Nenhuma migration ou reconciliação em massa desta story é executada sem: relatório Vault completo, backup específico verificado (≤48h) e aprovação explícita e específica do administrador registrada na execução.

## Critérios de aceite

1. `BpmTarefa.cardChecklistId` existe, é nullable e único.
2. FK `cardChecklistId → BpmCardChecklist.id` com `onDelete: Restrict`.
3. Migration é puramente aditiva (sem `DROP`/`RENAME` de estrutura existente).
4. Ao materializar um checklist com pendência obrigatória, uma tarefa `PENDENTE` é criada automaticamente.
5. Ao concluir todos os itens de um checklist, a tarefa correspondente muda para `CONCLUIDA` automaticamente.
6. Ao reabrir um item concluído, a tarefa volta para `PENDENTE` automaticamente.
7. Chamar a reconciliação duas vezes para o mesmo checklist não cria tarefa duplicada.
8. `ConcluirTarefaBpm` recusa conclusão manual de tarefa com `cardChecklistId` preenchido enquanto o checklist tiver pendência.
9. Em `/PainelAlpha/AlphaCRM/tarefas`, tarefas gerenciadas por checklist exibem indicação visual distinta.
10. A reconciliação inicial (mutação em massa) só roda após aprovação Vault específica, com backup validado.
11. A reconciliação inicial é idempotente: reexecutar não duplica tarefas já existentes.
12. Nenhuma regressão nos testes existentes de checklist (`tests/bpm/checklists-*`) e de tarefas (`tests/bpm/tarefas-tipo-*`).

## Checklist por fase

- [x] Fase 0 — Auditoria somente leitura.
- [x] Fase 1 — Blueprint técnico.
- [x] Fase 2 — Este artefato (story).
- [x] Fase 3 — Vault de schema/migration aprovado. Backup remoto completo verificado: `painelalpha_turso_pre_change_2026-09-08T13-57-30-252Z.sql` (304 tabelas, 76.223 linhas, SHA-256 `cce98ecf5dd52085c1e60888cd4d75423f9a33a74d3637e96c8f18c387995869`). Migration aditiva aplicada e validada com `integrity_check=ok` e 0 violações de FK.
- [x] Fase 4 — Implementação concluída (schema, serviço central, integração transacional, guarda server-side, UI, histórico e testes).
- [x] Fase 5 — Vault de reconciliação inicial aprovado. `--dry-run`: 1 examinada/1 criação prevista/0 falhas. `--apply`: tarefa `cmtsra3ce0000h2ihsk1tbkqe` criada. Repetição dry-run e apply: 1 ignorada/0 escritas/0 falhas.
- [x] Fase 6 — Verificação final concluída. Prisma validate/generate, build de produção e lint direcionado aprovados; 87 testes relacionados aprovados e E2E isolado `CRIADA→CONCLUIDA→REABERTA→IGNORADA` com um único ID, integridade `ok` e 0 violações de FK. Suíte global: 2.412/2.462 aprovados; 50 falhas de baseline em áreas fora da story. Typecheck global preserva erros de baseline fora da story. O diff-check apontou somente whitespace em linhas preexistentes de `components.md`, fora desta RM.

## Decisões reaproveitadas

- Ownership: `exigirAcessoBpmCard` (`src/lib/bpm/ownership.ts`).
- Histórico: `registrarHistoricoCard` (`src/lib/bpm/historico-server.ts`).
- Realtime: `notificarPipelineBpm` (`src/lib/bpm/realtime-server.ts`).
- Padrão de idempotência: catch de `P2002` já usado em `materializarChecklistsAplicaveisCard`.
- Defaults de `BpmTarefa` (`tipo`, `prioridade`, `status`) mantidos sem alteração.

## File list

- `prisma/schema.prisma`
- `prisma/migrations/20260908140000_bpm_tarefa_card_checklist_fk/migration.sql`
- `src/lib/bpm/checklists/reconciliacao-tarefa.ts`
- `src/lib/bpm/checklists/service.ts`
- `src/actions/bpm/Checklists.ts`
- `src/actions/bpm/Tarefas.ts`
- `src/app/PainelAlpha/AlphaCRM/tarefas/TarefasCentralClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelTarefasPorTipo.tsx`
- `src/lib/bpm/timeline.ts`
- `src/lib/bpm/historico-descricao.ts`
- `scripts/reconciliar-tarefas-checklists.ts`
- `scripts/verify-checklist-task-e2e.ts`
- `tests/bpm/checklists-reconciliacao-tarefa.test.ts`
- `tests/bpm/tarefas-checklist-actions.test.ts`
- `tests/bpm/tarefas-checklist-ui.test.ts`
- `tests/bpm/checklists-service.test.ts`
- `tests/bpm/checklists-card-actions.test.ts`
- `package.json`
