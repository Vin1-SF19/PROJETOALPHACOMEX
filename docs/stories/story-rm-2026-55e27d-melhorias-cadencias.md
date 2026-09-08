# Story — RM-2026-55E27D: Melhorias na função de cadências

## Objetivo

Permitir configurar uma cadência para um pipeline inteiro ou para uma etapa específica e ativá-la automaticamente quando um card entrar no escopo configurado, sem início, pausa ou reativação manual.

## Critérios de aceite

- [x] A configuração administrativa permite escolher pipeline e, opcionalmente, uma etapa pertencente a ele.
- [x] Uma etapa inválida ou pertencente a outro pipeline é rejeitada no servidor.
- [x] A entrada real do card na etapa configurada ativa a cadência automaticamente na mesma transação do movimento.
- [x] A criação do card ativa cadências compatíveis com sua entrada inicial.
- [x] A entrada em pipeline/etapa por automação também ativa cadências compatíveis.
- [x] Repetições e concorrência não criam vínculos, históricos ou tarefas duplicadas.
- [x] Vínculos `ATIVA` são no-op; vínculos legados `PAUSADA` são recuperados; `CONCLUIDA` e `CANCELADA` permanecem terminais.
- [x] Início, pausa e reativação manuais são recusados no servidor com erro de negócio estável.
- [x] A interface do card não oferece controles manuais e explica a ativação automática.
- [x] O card exibe escopo, estado, passo atual, próximo passo e próxima execução de forma textual.
- [x] O cancelamento terminal permanece disponível para usuário autorizado.
- [x] O executor não cria novos estados pausados quando a definição administrativa é desativada.
- [x] Gates direcionados e build passam; débitos globais externos foram executados e documentados.

## Auditoria (Fase 0)

- `BpmCadencia` já contém `pipelineId` e `etapaId`; não há delta de banco nem necessidade de migration.
- `BpmCardCadencia` já possui unicidade `(cardId, cadenciaId)` e estados necessários para compatibilidade legada.
- `BpmCadenciaPassoExecucao` já protege a criação de tarefas por chave idempotente.
- A UI administrativa só expunha pipeline; a UI do card ainda iniciava, pausava e reativava manualmente.
- A criação de card, o comando canônico de transição e o runtime de automações são os pontos principais de entrada no escopo.
- O executor pausava vínculos quando a definição era desativada, comportamento incompatível com a nova regra.

## Blueprint (Fase 1)

1. Criar um serviço server-only que receba `TransactionClient`, contexto anterior/destino e ator.
2. Validar destino e buscar apenas cadências ativas compatíveis com passos ativos.
3. Para cada cadência, criar vínculo `ATIVA`, reativar apenas legado `PAUSADA` ou fazer no-op para estados ativos/terminais.
4. Calcular a próxima execução pelo passo aplicável e registrar histórico somente quando houver mudança real.
5. Invocar o serviço na mesma transação da criação, da transição canônica e da movimentação por automação.
6. Emitir realtime somente depois do commit e apenas quando o serviço tiver alterado vínculos.
7. Validar pipeline/etapa nas ações CRUD, bloquear comandos manuais e adaptar as duas interfaces.
8. Cobrir escopos, idempotência, concorrência, terminalidade, legado e integração por testes.

## Checklist de fases

- [x] Fase 0 — Auditoria read-only
- [x] Fase 1 — Blueprint técnico
- [x] Fase 2 — Story criada
- [x] Fase 3 — Backend e integrações transacionais
- [x] Fase 4 — UI administrativa e painel do card
- [x] Fase 5 — Quality gates
- [x] Fase 6 — E2E funcional por fluxos integrados e mocks transacionais
- [x] Fase 7 — Revisão de segurança
- [x] Fase 8 — Revisão de arquitetura e qualidade
- [x] Fase 9 — Casos de borda
- [x] Fase 10 — Memória e documentação
- [x] Fase 11 — Fechamento e atualização do roadmap

## Evidências de validação

- `npx vitest run` direcionado: **26/26** testes aprovados, incluindo múltiplas cadências, retry `P2002`, terminalidade, saída da etapa, chamadas manuais e sete produtores transacionais.
- Compatibilidade de integrações tocadas: **36/36** testes aprovados; três testes preexistentes de criação de empresa continuam falhando por IDs fictícios inválidos na outbox, sem relação com cadências.
- ESLint direcionado: zero erros; um warning preexistente em função legada de `Cards.ts`.
- Typecheck: nenhum diagnóstico nos arquivos do objetivo; o repositório mantém diagnósticos concorrentes em calendário, gerador de documentos, SLA e outros módulos.
- Suíte global: **2.417/2.493** testes aprovados; 76 falhas externas/concorrentes, incluindo os contratos incompatíveis dos objetivos RM-2026-158500/E4849C que exigem cadência única e sem escopo de pipeline.
- Build de produção: aprovado, 78 páginas geradas.
- `git diff --check`: aprovado.

## Revisões

- Segurança: ações administrativas repetem autorização dentro da transação; comandos manuais validam sessão, payload e ownership antes da recusa estável; nenhuma entrada dinâmica vira SQL ou código; nenhuma migration ou segredo foi adicionado.
- Arquitetura: a ativação pertence ao domínio server-only e recebe `TransactionClient`; todos os produtores reais criam/movem e ativam atomicamente; realtime permanece pós-commit; o executor conserva idempotência por ciclo.
- Casos de borda: entrada repetida, card stale/inativo, etapa fora do pipeline, múltiplas cadências, definição desativada durante processamento, vínculo pausado, terminalidade e concorrência `P2002` estão cobertos.

## File List

- `src/lib/bpm/cadencias/ativacao-automatica.ts`
- `src/lib/bpm/cadencias/executor.ts`
- `src/lib/bpm/cadencias/schemas.ts`
- `src/actions/bpm/Cadencias.ts`
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/NolossLeads.ts`
- `src/lib/bpm/transicao-command.ts`
- `src/lib/bpm/automacoes.ts`
- `src/lib/bpm/automacao-novos-leads.ts`
- `src/lib/bpm/automacoes/central-runtime.ts`
- `src/lib/bpm/automacoes/distribuicao-oportunidades.ts`
- `src/components/bpm/cadencias/CadenciaFormDialog.tsx`
- `src/components/bpm/cadencias/CadenciasWorkspace.tsx`
- `src/components/bpm/cadencias/PainelCadenciasCard.tsx`
- `tests/bpm/cadencias-ativacao-automatica.test.ts`
- `tests/bpm/cadencias-executor.test.ts`
- `tests/bpm/cadencias-actions-automaticas.test.ts`
- `tests/bpm/cadencias-ui-automatica.test.ts`
- `tests/bpm/cadencias-integracao-transacional.test.ts`
- mocks de compatibilidade em testes existentes dos produtores transacionais.
