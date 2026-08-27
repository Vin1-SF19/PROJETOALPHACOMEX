# Story: Agenda Alpha — Operação contínua, tarefas e eventos de status

**ID:** STORY-CALALPHA-003  
**Epic:** Agenda Alpha  
**Status:** InProgress  
**Prioridade:** Alta  
**Complexidade:** Alta  
**Data:** 2026-08-26

## Narrativa

Como usuário da Agenda Alpha, quero criar e acompanhar compromissos, tarefas, foco, ausência e local de trabalho no Painel Alpha, com os dados coerentes com o Google, para operar minha agenda sem alternar de sistema.

## Critérios de aceite

- [ ] O menu de criação permite escolher Evento, Tarefa, Horário de foco, Ausente e Local de trabalho.
- [ ] Evento comum preserva agenda, convidados, Meet, localização, descrição e horários; os campos específicos de status obedecem às restrições do Google Calendar.
- [ ] Tarefas do Google Tasks podem ser criadas, listadas, editadas e concluídas por um controle de marcação na Agenda Alpha.
- [ ] A sincronização manual atualiza eventos e tarefas, apresenta erros seguros por origem e permanece disponível no cabeçalho.
- [ ] Alterações externas do Google Calendar são processadas automaticamente quando push/fila/worker estiverem configurados; a UI torna explícita a indisponibilidade operacional quando não estiverem.
- [ ] Nenhum input do cliente escolhe a identidade Google impersonada; toda leitura/escrita continua ancorada na sessão autenticada.
- [ ] Cobertura automatizada inclui validações, mapeamentos Google, criação/conclusão de tarefas, tipos de evento e falhas de sincronização.

## Vault

**Ambiente:** Turso remoto de produção.  
**Autorização explícita:** recebida em 2026-08-26 para backup pré-alteração e migration aditiva.  
**Backup validado:** `database-backups/pre-change/painelalpha_turso_pre_change_parceiro-proxima-acao_2026-08-26T18-46-15-291Z.sql`; 75.959.080 bytes; SHA-256 `2cb1bf830e7f22d8bff5bdb488e91195e915a879fd2f4d33e4d753c171f1b09d`; manifest conferido em 2026-08-26 antes da migration.

**Extensão para chamados (2026-08-27):** autorização explícita recebida para novo backup e migration aditiva de tarefas agendadas. Backup novo: `database-backups/pre-change/painelalpha_turso_pre_change_2026-08-27T14-22-56-353Z.sql`; 21.438.107 bytes; SHA-256 `b2c010b56e840e28275090005480e4877929347702e8437645a58ca1745e754b`; 253 tabelas e 46.664 registros, manifest e hash conferidos antes da aplicação remota. Migration aplicada via `@libsql/client` (sem Turso CLI) e pós-validação confirmou a tabela e os três índices.

Alterações previstas são somente aditivas: novas tabelas de cache/listas de tarefas, relações virtuais e campos de tipo/propriedades para eventos. Não há `DROP`, renomeação, backfill ou exclusão em massa. Rollback operacional: retornar o código anterior, que ignora as estruturas novas; qualquer remoção posterior exige novo Vault.

## Tasks / Subtasks

- [ ] Elaborar, revisar e aplicar migration aditiva após gerar o SQL final e validar integridade do Turso.
- [ ] Estender cliente/DTO/validação do Google Calendar para tipos de status e convidados.
- [ ] Integrar Google Tasks API por Domain-Wide Delegation e cache local de listas/tarefas.
- [ ] Ampliar formulário e visões da Agenda Alpha, incluindo conclusão de tarefa acessível.
- [ ] Exibir diagnóstico operacional e manter sincronização manual; documentar requisitos de push, worker e escopo Google Tasks.
- [ ] Criar/regredir testes específicos e executar lint, typecheck, testes e build.
- [x] Criar vínculo aditivo entre chamado e tarefa Google, com início, fim planejado e fim real locais.
- [x] Criar a tarefa de uma hora para técnico TI ao assumir o chamado e concluí-la ao fechar o chamado.
- [x] Exibir tarefa agendada na grade horária em azul durante o atendimento e em verde após a conclusão.

## File List

- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_agenda_alpha_tasks_status/migration.sql`
- `prisma/migrations/20260827150000_add_google_calendar_task_schedule_for_chamados/migration.sql`
- `src/lib/google-calendar/{client,types,cache-eventos,scopes,sync}.ts`
- `src/lib/chamados/tarefa-agendada.ts`
- `src/actions/chamados.ts`
- `src/actions/google-calendar-{eventos,sync,tarefas}.ts`
- `src/components/CalendarioAlpha/{FormularioEvento,CalendarioAlphaDashboard,StatusSincronizacao,GradeHoraria,VisaoMes,VisaoAno,DiaEventosPopover}.tsx`
- `src/components/CalendarioAlpha/lib/{tipos,itens-agenda,useAgendaAlphaController}.ts`
- `src/app/PainelAlpha/CalendarioAlpha/page.tsx`
- `tests/google-calendar/{itens-agenda,layout-eventos,page-cache-wiring}.test.ts`
- `scripts/{turso-backup,apply-turso-migration}.mjs`

## Notas operacionais

- O ambiente consultado possui 0 canais push ativos e as flags de push, fila e lock estão desligadas; sincronização externa automática requer URL HTTPS pública e worker contínuo.
- Google Tasks é uma API distinta e requer habilitação/escopo autorizado pelo administrador do Google Workspace.
- Referências: documentação oficial Google Calendar (event types e push) e Google Tasks API, pesquisadas em 2026-08-26.
