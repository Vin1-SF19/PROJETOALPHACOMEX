# Story: Automações gerais de tentativas do CRM

**Status:** Ready for Review

## Regra operacional consolidada

1. **Escopo:** as cinco ligações diárias existem somente para cards `ATIVO` em **Novos Leads**, enquanto `proximoContatoEm` estiver vazio. Como não há fonte canônica de “respondeu”, a permanência nessa etapa é o proxy operacional já definido no CRM.
2. **Execução diária:** o cron protegido existente roda às 09:00 de Brasília. Para cada card elegível, ele conta as interações reais `BpmInteracaoCard.tipo = LIGACAO` feitas no dia civil de São Paulo e cria somente as tarefas `LIGACAO` que faltarem até a meta de cinco.
3. **Tentativa e auditoria:** registrar uma ligação continua criando a interação real. O job registra o planejamento em `BpmCardHistorico` com `NOVOS_LEADS_LIGACOES_PLANEJADAS`, dia do ciclo e apenas IDs das tarefas — sem conteúdo ou PII.
4. **Sem duplicidade:** o histórico diário e o CAS por card, etapa, status, Próximo Contato e versão (`updatedAt`) impedem que retry ou concorrência crie outra série de tarefas no mesmo dia. Tarefa e histórico são gravados na mesma transação; realtime é emitido somente após commit.
5. **Ciclo:** o ciclo tem oito dias úteis, de segunda a sexta, sem desconto de feriados nesta fase. O dia de entrada conta como dia 1; no início do nono dia útil, o card ainda elegível é encaminhado uma única vez para **Standby - Follow Up** pelo fluxo já existente.
6. **Próximo Contato:** ao ser preenchido, interrompe novas tarefas e impede o encaminhamento automático para Standby. Caso seja removido antes do término, o card volta a ser elegível a partir da execução seguinte do cron.
7. **Término:** o ciclo termina por Próximo Contato, saída manual da etapa, mudança de status, ou encaminhamento para Standby. Em Standby, passa a vigorar a automação semanal NoLoss já documentada; não há ligação, WhatsApp ou e-mail enviados automaticamente pelo sistema.

## Entrega

- `executarAutomacaoFollowUpBpm` passou a planejar tarefas operacionais de ligação além de mover cards vencidos para Standby.
- A contagem diária usa interações reais; tarefas são instruções de trabalho com prazo e alerta, não simulação de contato externo.
- O resumo do cron expõe métricas de ligações planejadas, tentativas registradas, ignorados e falhos.
- Nenhuma alteração de schema, migration, seed ou backfill foi necessária.

## Validação

- `npx vitest run tests/bpm --reporter=dot`: 40 arquivos / 237 testes aprovados.
- Testes unitários para a meta restante e testes do job para tarefas faltantes, histórico, realtime, repetição diária, perda de CAS e encerramento em Standby.
- ESLint focado e `git diff --check`: aprovados.
- `npm run typecheck`: nenhum erro nos arquivos desta story; cinco baselines externos permanecem em `ExclusaoFiscal` x2, `HabilitacaoRadarClient` e `google-calendar/sync-queue` x2.
- `npm test -- --run`: 1.369/1.370 testes aprovados; o único erro é timeout preexistente em `tests/google-calendar/cli.test.ts`.

## File List

- `src/lib/bpm/novos-leads.ts`
- `src/lib/bpm/automacao-novos-leads.ts`
- `tests/bpm/novos-leads.test.ts`
- `tests/bpm/automacao-novos-leads-tentativas.test.ts`
- `docs/stories/story-alpha-crm-automacoes-gerais-tentativas.md`
