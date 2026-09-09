# RM-2026-158500 — Cadência por etapa sem bloqueio de avanço

## Status

Concluída — aguardando testes de homologação

## Story

Como operador do Alpha CRM,
quero que cada etapa do pipeline tenha sua própria cadência opcional,
para receber tarefas e alertas do que deve ser feito sem impedir a movimentação do card.

## Contexto confirmado

O bloqueio relatado não vem do motor de cadências. A exigência fixa de oito contatos está duplicada em `src/lib/bpm/transicao-command.ts` (guard transacional canônico) e `src/actions/bpm/Cards.ts` (prévia de requisitos), apoiada por constantes/funções em `src/lib/bpm/agendar-reuniao.ts`.

O modelo existente `BpmCadencia` já possui `pipelineId` e `etapaId`; `BpmCardCadencia` e `BpmCadenciaPassoExecucao` já suportam vínculo, ciclo e execução idempotente. Portanto, a regra solicitada cabe no schema atual e não requer migration.

A interface administrativa já existe em `/PainelAlpha/AlphaCRM/admin/cadencias`. No card, `PainelCadenciasCard` já é consumido pela aba **Cadências** de `PainelHistorico`, após a reorganização da RM-2026-B7694F. A lacuna remanescente é funcional: o formulário permite escopo universal, o operador usa uma listagem restrita a administradores e a movimentação não encerra/inicia o ciclo conforme a etapa.

## Escopo

1. Remover somente o bloqueio fixo de oito contatos dos dois caminhos de movimentação, preservando reunião obrigatória, transcrição, campos/requisitos, checklist, regras, política financeira e permissões.
2. Exigir pipeline e etapa ao criar/editar uma cadência, validar pertencimento e impedir mais de uma cadência configurada para a mesma etapa.
3. Listar para o operador apenas a cadência ativa da etapa atual do card, com autorização pelo próprio card.
4. Ao mover o card, encerrar o vínculo da etapa anterior e iniciar a cadência ativa da etapa de destino em modo best-effort, fora da transação da movimentação, para que falha de alerta nunca bloqueie o avanço.
5. Fazer o executor cancelar vínculos legados/fora da etapa antes de criar tarefas.
6. Tornar a chave idempotente específica do ciclo iniciado, permitindo reentrada na mesma etapa sem reaproveitar indevidamente uma execução anterior.
7. Manter o painel do card informativo e automático; início, pausa e reativação manuais ficam desabilitados, enquanto o cancelamento permanece disponível para recuperação operacional.

## Fora de escopo

- Remover os guards legítimos de Data/Hora da reunião, transcrição, campos obrigatórios, checklist, regras de negócio, política financeira ou autorização.
- Alterar o schema Prisma ou criar migration.
- Excluir tarefas já geradas por uma cadência anterior.
- Transformar passos em envio automático de ligação, WhatsApp ou e-mail; eles continuam gerando tarefas/alertas.
- Promover automaticamente a entrega para produção.

## Critérios de aceite

- [x] **AC1:** sair de **Agendar reunião** não consulta nem exige sequência de contatos; a Data/Hora continua obrigatória ao entrar em **Reunião Agendada**.
- [x] **AC2:** criação/edição de cadência exige pipeline e etapa válidos, e a etapa deve pertencer ao pipeline informado.
- [x] **AC3:** cada etapa aceita no máximo uma cadência; conflito retorna erro acionável e não altera o registro existente.
- [x] **AC4:** não existe opção operacional “Qualquer pipeline/etapa”; cadências sem `etapaId` são tratadas como legado inválido e não geram alertas.
- [x] **AC5:** o operador vê somente a cadência da etapa atual de um card autorizado; o ciclo começa automaticamente e não oferece início/pausa/retomada manual.
- [x] **AC6:** mover o card nunca é bloqueado por falha da cadência; o movimento permanece concluído e a sincronização é best-effort.
- [x] **AC7:** ao sair da etapa, vínculos ativos/pausados incompatíveis são cancelados; ao entrar em etapa com cadência ativa e passos, o ciclo é iniciado ou retomado como novo ciclo.
- [x] **AC8:** o executor cancela vínculo cuja cadência não corresponde à etapa atual antes de criar `BpmTarefa`.
- [x] **AC9:** reentrada na mesma etapa usa identidade de ciclo nova sem duplicar a execução concorrente do mesmo ciclo.
- [x] **AC10:** nenhuma migration/schema change foi introduzida por esta RM.

## Fases retomadas

- [x] Fase 0 — auditoria de contexto e entregabilidade (preservada da execução anterior).
- [x] Fase 1 — mapeamento de guards, cadências, UI, executor e integração.
- [x] Fase 2 — criação desta story com critérios verificáveis.
- [x] Fase 3 — avaliação de banco: `DATABASE_CHANGE_NOT_REQUIRED`; o schema atual já suporta o escopo por etapa.
- [x] Fase 4 — delta de dados: `NOOP`; nenhuma escrita direta. A cadência legada sem etapa permanece inerte até configuração administrativa explícita.
- [x] Fase 5 — domínio, movimentação e resolução de cadências.
- [x] Fase 6 — configuração administrativa, listagem do card e alertas.
- [x] Fase 7 — lint, typecheck, testes e build.
- [x] Fase 8 — integração ponta a ponta.
- [x] Fase 9 — segurança/autorização/isolamento.
- [x] Fase 10 — revisão de arquitetura e código.
- [x] Fase 11 — regressões e cenários limite.
- [x] Fase 12 — memória, decisões e story.
- [x] Fase 13 — arquivamento e relatório final.

## Plano de testes

- Testes unitários do domínio de ciclo por etapa e do executor.
- Testes das Server Actions: autenticação, autorização, etapa/pipeline, conflito e filtro por card.
- Testes da transição canônica e da prévia confirmando ausência de `CONTACT_SEQUENCE_REQUIRED`.
- Testes estáticos da UI administrativa/card para seletores obrigatórios e ação escopada.
- ESLint direcionado, `git diff --check`, testes BPM relevantes, `npm run typecheck`, `npm test` e build real.

## File List

- [x] `docs/stories/story-rm-2026-158500-cadencia-por-etapa-sem-bloqueio.md`
- [x] `src/lib/bpm/agendar-reuniao.ts`
- [x] `src/actions/bpm/Cards.ts`
- [x] `src/lib/bpm/transicao-command.ts`
- [x] `src/lib/bpm/cadencias/ativacao-automatica.ts`
- [x] `src/lib/bpm/cadencias/executor.ts`
- [x] `src/lib/bpm/cadencias/schemas.ts`
- [x] `src/actions/bpm/Cadencias.ts`
- [x] `src/components/bpm/cadencias/CadenciaFormDialog.tsx`
- [x] `src/components/bpm/cadencias/CadenciasWorkspace.tsx`
- [x] `src/components/bpm/cadencias/PainelCadenciasCard.tsx`
- [x] `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/CadenciaEtapasSection.tsx`
- [x] Integrações de criação/movimentação em `automacao-novos-leads.ts`, `automacoes.ts`, `central-runtime.ts`, `distribuicao-oportunidades.ts` e `NolossLeads.ts`.
- [x] Testes direcionados de domínio, actions, executor e UI em `tests/bpm/cadencias-*.test.ts` e remoção do guard fixo em `tests/bpm/agendar-reuniao.test.ts`.

## Notas de segurança e banco

- Nenhuma credencial ou payload de tarefa deve ser registrado em logs.
- As ações administrativas continuam protegidas por `configurarCadencias`; ações do card continuam protegidas por `exigirAcessoBpmCard`.
- A única cadência legada encontrada está sem `etapaId`. Ela permanecerá inoperante até receber uma etapa válida; qualquer correção direta do dado será tratada no checkpoint da Fase 4 conforme `AGENTS.md`.

## Evidências finais

- Testes focados: 55/55 aprovados.
- Suíte BPM ampla: 773/802 aprovados; as 29 falhas restantes pertencem a alterações concorrentes fora desta RM e não atingem os arquivos de cadência/transição entregues.
- ESLint direcionado: zero erros; um aviso preexistente em `Cards.ts`, fora do delta funcional desta RM.
- Typecheck: nenhum diagnóstico nos arquivos desta entrega; a execução global mantém somente débitos externos já existentes.
- `git diff --check`: aprovado.
- Build de produção Next.js: aprovado, com 78 páginas geradas.
- Nenhuma migration, alteração de schema, escrita direta de dados, commit, push, deploy ou promoção para produção foi executada.
