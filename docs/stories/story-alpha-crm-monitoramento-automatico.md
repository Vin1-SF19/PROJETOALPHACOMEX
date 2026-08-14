# Story: Monitoramento automático do CRM

**Status:** Ready for Review

## Regra operacional definida

1. **Entrada:** o card entra em **Monitoramento** somente a partir de **Em Tratativa**. Não existe criação direta nesta etapa; drag, modal e chamadas diretas recebem a mesma validação do backend.
2. **Ciclo:** enquanto o card estiver `ATIVO` em Monitoramento, uma revisão interna é gerada a cada **30 dias corridos**, contados da entrada atual na etapa ou da última revisão automática.
3. **Ação automática:** o cron diário cria uma `BpmTarefa` pendente, do tipo `TAREFA`, com prazo e alerta no momento da revisão. A automação não envia WhatsApp, e-mail ou outro contato externo.
4. **Estado persistido:** o evento `MONITORAMENTO_AUTOMATICO_EXECUTADO`, com a origem `monitoramento_mensal`, registra o ciclo e o ID da tarefa no histórico do card. Não há coluna adicional: a data de entrada e o histórico são a fonte de verdade.
5. **Reentrada:** se o card sair e voltar a Monitoramento, a contagem reinicia a partir da nova entrada. Um ciclo da passagem anterior não antecipa a revisão atual.
6. **Saída:** não existe saída automática. De **Monitoramento**, o responsável ou administrador só pode mover o card para **Em Tratativa** ou **Lost**, sempre pelo backend. Assim que o card deixa Monitoramento, o cron para de gerar revisões.
7. **Pendência anterior:** a automação mantém uma tarefa por ciclo; se não for concluída, ela continua visível como pendente e as revisões futuras continuam sendo registradas mensalmente — não há contato externo automático.

## Automação

- Executada pela rota cron protegida já existente `/api/bpm/jobs/automacao-novos-leads` uma vez por dia.
- Escopo: pipeline ativo **Revisão de Radar**, etapa ativa **Monitoramento**.
- Concorrência: CAS por card, etapa, status e `updatedAt`; tarefa e histórico são gravados na mesma transação. Realtime é emitido apenas após o commit.
- Falha de configuração: sem a etapa Monitoramento, o job registra aviso e não cria tarefas. A execução de Monitoramento é independente da existência da etapa Standby.

## Sem alteração estrutural

O histórico de movimento e `BpmCardHistorico` já persistem as informações necessárias. Não há migration, schema, seed ou backfill nesta story.

## Validação executada

- `npx vitest run tests/bpm --reporter=dot`: 39 arquivos / 234 testes aprovados.
- ESLint focado dos arquivos de Monitoramento: aprovado.
- `git diff --check`: aprovado, sem erro de whitespace.
- `npm run typecheck`: sem erro nos arquivos desta story; permanece bloqueado por cinco baselines fora do CRM (`ExclusaoFiscal` x2, `HabilitacaoRadarClient` e `google-calendar/sync-queue` x2).
- `npm run lint`: iniciado, mas não concluiu nem emitiu saída após 60 segundos; o ESLint focado passou.
- `npm test -- --run`: 1.355/1.357 testes aprovados; falharam somente dois baselines fora do CRM (`google-calendar/cli` por timeout e `parceiros/responsavel` por mock de `cliente.findUnique`).

## File List

- `src/lib/bpm/monitoramento.ts`
- `src/lib/bpm/automacao-novos-leads.ts`
- `src/actions/bpm/Cards.ts`
- `tests/bpm/monitoramento.test.ts`
- `tests/bpm/automacao-monitoramento.test.ts`
- `.bibble/memory/plano-novos-leads-bpm.md`
- `docs/stories/story-alpha-crm-monitoramento-automatico.md`
