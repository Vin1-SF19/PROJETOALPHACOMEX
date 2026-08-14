# Story: Alpha CRM — Standby — Follow Up semanal NoLoss

## Status

Ready for Review

## Objetivo

Operar o Standby — Follow Up como uma cadência interna de uma tarefa a cada sete dias, sem prazo de encerramento, e encerrar definitivamente a cadência quando o lead solicitar não receber novos contatos.

## Decisões de produto

- O sistema cria uma **tarefa operacional**, atribuída ao responsável do card; não afirma nem simula envio de WhatsApp, e-mail ou outro contato externo.
- A primeira tarefa fica elegível somente após sete dias corridos da entrada atual em Standby. As seguintes contam sete dias desde a última execução.
- O estado NoLoss é permanente: não há retomada automática nem ação de retomada neste fluxo.
- O formulário operacional pertence somente ao centro do card, na aba **Formulário da Etapa**, e somente em Standby — Follow Up.

## Persistência e migration remota

| Item | Evidência |
| --- | --- |
| Ambiente | Turso remoto configurado para o PainelAlpha. |
| Backup pré-alteração | `database-backups/pre-change/painelalpha_turso_pre_change_standby-followup_2026-08-13T18-16-24-788Z.sql` (67.795.585 bytes), manifest SHA-256 `506d6446519f01d49a938edd16a85b5e3f480b78e5b4bab94fdbb76bea1033f9`. |
| DDL aditivo | `ALTER TABLE "BpmCard" ADD COLUMN "standbyFollowUpUltimoEm" DATETIME`; `ALTER TABLE "BpmCard" ADD COLUMN "standbyFollowUpInterrompidoEm" DATETIME`. |
| Verificação | `PRAGMA table_info("BpmCard")` confirmou as duas colunas; contagem de `BpmCard` permaneceu 4 antes e depois. |
| Rollback | Restaurar o dump integral em banco de recuperação; não usar `DROP COLUMN` como rollback rotineiro. |

## Acceptance Criteria

1. O cron protegido roda diariamente às 12:00 UTC e avalia cards ativos em Standby do pipeline Revisão de Radar.
2. A primeira tarefa semanal só é criada após sete dias da entrada atual na etapa; reentrada em Standby reinicia a referência da primeira execução.
3. Cada ciclo cria no máximo uma `BpmTarefa` PENDENTE para o responsável, mais histórico `STANDBY_FOLLOW_UP_EXECUTADO`.
4. Atualização condicional (CAS) impede tarefa, histórico e realtime duplicados em concorrência.
5. A interrupção exige usuário autenticado, ownership de edição, card ativo na etapa Standby, motivo e confirmação explícita na UI.
6. A interrupção persiste data, histórico com ator/motivo e realtime após o commit. Opt-out não tem retomada automática.
7. O painel central mostra último follow-up, próxima tarefa, status e o controle de interrupção; não existe cópia no painel direito.
8. A documentação explica que não há envio externo automatizado configurado.

## File List

- `prisma/schema.prisma`
- `src/lib/bpm/novos-leads.ts`
- `src/lib/bpm/automacao-novos-leads.ts`
- `src/lib/validations/bpm.ts`
- `src/actions/bpm/StandbyFollowUp.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelStandbyFollowUp.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar.tsx`
- `src/app/api/bpm/jobs/automacao-novos-leads/route.ts`
- `vercel.json`
- `tests/bpm/automacao-reuniao-agendada.test.ts`
- `tests/bpm/standby-follow-up.test.ts`

## Verificação

- Testes direcionados cobrem cadência de 7 dias, opt-out, CAS perdedor, histórico, realtime e posicionamento da UI.
- `npx prisma generate` executado com sucesso: o client foi regenerado com engine, requisito do adapter LibSQL/Turso.

## QA Results

- Suíte focada: 4 arquivos / 25 testes aprovados; após a correção de reentrada, 2 arquivos / 9 testes aprovados.
- ESLint focado e `git diff --check` sem erros.
- Auditoria independente aprovou CAS, autorização, realtime, cron diário, persistência, NoLoss e o posicionamento exclusivo no formulário central.
- `npm run typecheck` continua bloqueado apenas por cinco erros basais fora deste escopo: dois validators de Exclusão Fiscal, `HabilitacaoRadarClient.tsx` e dois testes de `google-calendar/sync-queue`.
- `npx next build` excedeu o limite de 60 segundos deste ambiente sem resultado; a inicialização real de `PrismaClient({ adapter })` foi verificada com sucesso após o `prisma generate`.

## Change Log

| Data | Descrição |
| --- | --- |
| 2026-08-13 | Migration aditiva autorizada, automação semanal NoLoss, UI central e testes implementados. |
