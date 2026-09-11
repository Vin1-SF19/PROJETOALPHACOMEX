# Story RM-2026-A6F2C9 — Feedback, técnico solicitado e prazo desejado em Chamados

## Status

Ready for Review — implementação concluída; migrations aditivas aplicadas e verificadas em produção; Forge, Probe, Anubis, Lens e Sage aprovados no escopo.

## Story

Como colaborador que abre chamados internos, quero indicar opcionalmente um técnico de TI e uma data desejada de conclusão e, ao final do atendimento, decidir se deixo uma avaliação estruturada, para direcionar a demanda e registrar a qualidade percebida do suporte.

## Objetivo

Evoluir o módulo de Chamados sem remover a notificação de conclusão existente, mantendo a preferência de técnico separada da assunção efetiva e oferecendo feedback persistente, condicional e seguro somente para novas conclusões.

## Acceptance Criteria

1. Ao concluir um chamado, a notificação atual continua sendo exibida e o solicitante recebe também um popup estilizado perguntando se deseja deixar feedback.
2. O popup não pode ser fechado por Escape, clique fora ou botão X e permanece pendente até o solicitante escolher **Sim** ou **Não**.
3. A escolha **Não** grava o estado `RECUSADO`, fecha o popup e impede que ele reapareça para o mesmo chamado.
4. A escolha **Sim** abre um modal com as perguntas:
   - nota inteira de 0 a 5 para rapidez do tempo de resposta, onde 0 é extremamente demorado e 5 extremamente rápido;
   - nota inteira de 0 a 5 para conclusão no tempo esperado, onde 0 é depois do esperado e 5 mais rápido que o esperado;
   - se a demanda foi solucionada da forma esperada, com resposta **SIM** ou **NÃO**.
5. Quando a demanda não foi solucionada da forma esperada, o modal exige relato textual com no mínimo 10 caracteres e não aceita nota de qualidade da solução.
6. Quando a demanda foi solucionada da forma esperada, o modal exige nota inteira de 0 a 5 sobre ter sido solucionada da melhor forma, onde 0 é forma mediana e 5 a melhor forma possível, e não aceita relato de insatisfação.
7. Somente o solicitante autenticado pode responder ou recusar feedback de um chamado `CONCLUIDO` com feedback `PENDENTE`.
8. A decisão usa atualização condicional/CAS e existe no máximo um feedback por chamado.
9. A linha `PENDENTE` é criada na mesma transação de uma nova transição real para `CONCLUIDO`, tanto na conclusão rápida quanto na conclusão com protocolo.
10. Chamados concluídos antes da implantação não recebem backfill nem popup retroativo.
11. A abertura manual oferece um select opcional contendo somente usuários ativos cuja role normalize para `TI`, inclusive valores legados equivalentes como `T.I`.
12. O técnico escolhido é persistido em `tecnicoSolicitadoId`; `tecnicoId` continua nulo até a assunção efetiva.
13. Se houver técnico solicitado, somente ele pode assumir. Outra pessoa recebe o aviso: “O solicitante pediu que [Nome] realizasse este chamado. Somente esse usuário pode assumir.”
14. Sem técnico solicitado, o fluxo concorrente atual continua permitindo que um usuário autorizado assuma uma única vez.
15. Assumir e finalizar exigem autorização no servidor. Somente o técnico efetivamente vinculado em `tecnicoId` pode finalizar o chamado.
16. A abertura manual oferece uma data desejada de conclusão opcional, persistida sem deslocamento de dia no fuso `America/Sao_Paulo`.
17. A data desejada é apenas uma preferência do solicitante e não altera automaticamente `GoogleCalendarTaskSchedule.fimPlanejadoEm` nem a automação da Agenda Alpha.
18. Técnico solicitado e data desejada aparecem nos detalhes do chamado, quando preenchidos.
19. Falha de Pusher não perde o convite: pendências são recuperadas do banco pelo shell principal, sem duplicar popup em iframes.
20. A entrega possui validação Zod compartilhada, testes de domínio/ações/UI/migration e passa pelos gates aplicáveis do projeto.

## Modelo de dados proposto

- `chamados.tecnicoSolicitadoId Int?` com relação própria para `usuarios`, `ON DELETE SET NULL`, sem substituir `tecnicoId`.
- `chamados.dataDesejadaConclusao DateTime?`.
- índice não único em `chamados.tecnicoSolicitadoId`.
- relação 1:1 `chamados.feedback`.
- `ChamadoFeedback` mapeado para `chamados_feedback`, com `chamadoId` como PK/FK, `status` (`PENDENTE`, `RESPONDIDO`, `RECUSADO`), notas condicionais, comentário, `createdAt`, `updatedAt` e `decidedAt`.
- constraints SQL limitam notas a 0–5 e impedem combinações incompatíveis com o status e com a resposta SIM/NÃO.
- não haverá backfill.

## Tasks / Subtasks

- [x] Task 1 — Checkpoint Vault e migration aditiva (AC: 8–10, 12, 16)
  - [x] Preparar o datamodel temporário e revisar `prisma migrate diff --script` sem acessar produção.
  - [x] Testar o SQL aditivo e os `CHECKs` em restauração offline.
  - [x] Gerar e validar backup completo específico em `database-backups/pre-change/`.
  - [x] Obter autorização explícita do usuário para o delta exato.
  - [x] Aplicar somente após liberação Vault e validar estrutura, índices, FKs e `PRAGMA foreign_key_check`.
  - [x] Corrigir, mediante nova autorização específica, o caso `RESPONDIDO` com resposta SIM/NÃO nula que a semântica ternária dos `CHECKs` do SQLite pode aceitar.
- [x] Task 2 — Contratos e persistência de feedback (AC: 3–10, 19)
  - [x] Criar schemas Zod para recusa e para as duas ramificações do formulário.
  - [x] Criar serviço transacional compartilhado pelos dois fluxos de conclusão para gerar `PENDENTE` sem retroatividade.
  - [x] Criar ações autenticadas para listar pendências, recusar e responder com ownership e CAS.
- [x] Task 3 — Abertura com preferência e prazo (AC: 11, 12, 16–18)
  - [x] Carregar no servidor somente IDs e nomes de usuários ativos com role canônica `TI`.
  - [x] Validar novamente o técnico e a data na action de criação.
  - [x] Adicionar select e data opcionais ao formulário manual e ajustar o texto que hoje diz que todos os campos são obrigatórios.
- [x] Task 4 — Assunção e finalização seguras (AC: 13–15)
  - [x] Restringir `assumirChamado` a atores autorizados e ao técnico solicitado, mantendo CAS concorrente.
  - [x] Resolver o nome do técnico solicitado no servidor para o aviso nominal.
  - [x] Restringir conclusão ao técnico efetivo e ao status correto.
  - [x] Exibir os novos metadados e corrigir a disponibilidade das ações no detalhe.
- [x] Task 5 — Popup e modal global (AC: 1–7, 19)
  - [x] Preservar o toast e a central de notificações existentes.
  - [x] Enfileirar o feedback pelo evento privado `chamado-concluido` e pela recuperação persistida.
  - [x] Montar o popup somente no shell principal, com bloqueio de Escape/overlay/X.
  - [x] Implementar escalas acessíveis 0–5 e formulário condicional responsivo.
- [x] Task 6 — Testes e gates (AC: 20)
  - [x] Cobrir abertura, role TI, data, assunção concorrente/restrita, ownership de finalização e mensagens de erro.
  - [x] Cobrir estados/constraints do feedback, não retroatividade, deduplicação, recuperação e popup/modal.
  - [x] Rodar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.
  - [x] Atualizar checklist, Dev Agent Record e File List antes de concluir.

## Dev Notes

### Fluxos existentes

- Abertura manual: `src/app/PainelAlpha/Chamados/NovoChamado/page.tsx` → `createChamadoAction` em `src/actions/chamados.ts`.
- Assunção: `DetalhesChamado.tsx` → `assumirChamado()`; hoje `tecnicoId` representa quem já assumiu.
- Conclusão: `updateChamadosStatus()` e `finalizarComProtocolo()` em `src/actions/protocolos.ts`.
- Realtime: `notificarChamadoConcluido()` publica no canal privado do solicitante; `useAdminChamadosNotifications.ts` alimenta o store e o `NotificationToast`.
- Shell: `src/components/layout/PainelLayoutClient.tsx`; montar o popup somente depois da detecção de iframe.

### Arquivos previstos

- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_chamados_feedback_preferencia_prazo/migration.sql`
- `src/lib/chamados/schemas.ts`
- `src/actions/chamados-feedback.ts`
- `src/actions/chamados.ts`
- `src/actions/protocolos.ts`
- `src/app/PainelAlpha/Chamados/NovoChamado/page.tsx` e, se extraído, seu Client Component de formulário
- `src/app/PainelAlpha/Chamados/page.tsx`
- `src/app/api/notificacoes/route.ts`
- `src/components/DetalhesChamado.tsx`
- `src/components/chamados/ChamadoFinalizadoFeedbackDialog.tsx`
- `src/hooks/useAdminChamadosNotifications.ts`
- `src/store/useChamadoNotificacoes.ts`
- `src/components/layout/PainelLayoutClient.tsx`
- testes em `tests/chamados/`

### Restrições técnicas

- Usar `isSameRole(role, "TI")`; `isAdminRole` inclui também Admin e CEO e não serve para filtrar o select.
- Usar `parseDataLocalInput()` de `src/lib/format-date.ts` para `input type="date"`.
- Validar auth, ownership e payload no servidor; a UI é apenas UX.
- Manter `tecnicoId` separado da preferência para não liberar finalização antes da assunção.
- Não alterar menu, middleware nem autorização Pusher: os integration points já existem.
- Não fazer fetch em iframe nem depender somente do evento efêmero.
- Não mudar o prazo automático da Agenda Alpha sem novo requisito.

### Vault

- Ambiente real: Turso/libSQL de produção, modo paranoico.
- Delta: dois `ADD COLUMN` nullable, um índice não único e uma tabela vazia; sem `DROP`, `RENAME`, reconstrução ou backfill.
- Qualquer complemento estrutural continua bloqueado até diff revisado, ensaio offline, backup específico verificado e confirmação explícita própria.
- Rollback preferencial: reverter código e manter estruturas aditivas inertes; rollback físico exige novo protocolo Vault.

### Evidências do checkpoint Vault — 2026-09-11

- `prisma migrate diff --script` executado entre schemas temporários: a saída sugeriu `DROP TABLE "chamados"`/reconstrução para materializar FKs e foi rejeitada como destrutiva. O artefato definitivo deverá usar somente os quatro statements aditivos classificados pelo Vault.
- Backup específico: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-11T12-43-02-826Z.sql` (ignorado pelo Git), 120.204.109 bytes, 306 tabelas e 104.669 linhas, SHA-256 `a8b14f1bbda55affdbbc568186851b0140fbf610ad0ea7f21b50b99f41834f9a`.
- Verificação do backup: restauração offline, hash, tamanho, `PRAGMA integrity_check`, FKs e contagens aprovados.
- Ensaio da migration manual em clone offline: 181 chamados antes/depois, duas colunas e índice presentes, tabela/`CHECKs` presentes, integridade `ok` e zero violações de FK.
- A migration principal foi autorizada e aplicada ao Turso em `2026-09-11`, com quatro statements aditivos; a validação remota confirmou as duas colunas nullable, índice não único, FKs, `CHECKs`, integridade `ok`, zero violações e tabela de feedback vazia, sem backfill.
- Revisão posterior identificou que SQLite aceita um `CHECK` cujo resultado seja `NULL`; por isso, uma escrita direta poderia persistir `RESPONDIDO` com `solucionadaComoEsperado = NULL`, embora Zod e Server Actions impeçam o caso no aplicativo. O Vault bloqueou a correção até nova autorização específica para dois triggers aditivos (`BEFORE INSERT` e `BEFORE UPDATE`).
- Backup pós-migration específico para a correção: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-11T13-23-34-691Z.sql` (ignorado pelo Git), 120.409.041 bytes, 307 tabelas e 104.739 linhas, SHA-256 `ffda7e93db984a4b97ba20329bddf4790d79f837eef35ce0850800351a00219f`; restauração, hash, tamanho, integridade, FKs e contagens aprovados.
- O novo `prisma migrate diff` foi inspecionado e rejeitado por incluir drift destrutivo preexistente; nenhuma parte dele foi aplicada. A correção permaneceu no artefato manual mínimo de dois `CREATE TRIGGER`.
- A migration corretiva `20260911133500_chamados_feedback_resposta_bool_triggers` foi ensaiada no backup restaurado e aplicada em produção após autorização específica. Os triggers `BEFORE INSERT` e `BEFORE UPDATE` abortam exclusivamente `RESPONDIDO` com `solucionadaComoEsperado IS NULL`.
- Validação remota pós-aplicação: definições dos dois triggers conferidas, INSERT/UPDATE inválidos rejeitados em transações revertidas, casos válidos aceitos no ensaio, zero linhas alteradas, `PRAGMA integrity_check = ok` e zero violações de FK.

## Testing

- Framework: Vitest, seguindo os mocks já usados em `tests/chamados/assumir.test.ts` e `finalizar-protocolo-agenda.test.ts`.
- Testar schemas puros sem banco e actions com auth/Prisma mockados.
- Executar migration duas vezes em SQLite isolado quando aplicável e validar constraints/rollback lógico.
- Cobrir teclado, foco, nomes acessíveis, erros, loading, fila com mais de uma pendência e viewport móvel.
- Confirmar que os testes existentes de notificações e Agenda permanecem aprovados.

## 🤖 CodeRabbit Integration

**Story Type Analysis:** Database + API + Frontend + Security; complexidade alta.

**Specialized Agents:** `@dev`, `@data-engineer`, `@ux-design-expert`, `@qa`, com revisão de segurança e Vault obrigatório.

**Quality Gate Tasks:**

- [x] Pre-Commit: revisar código não commitado, auth, validação, concorrência, SQL e acessibilidade.
- [x] Pre-PR: revisar integração e compatibilidade com notificações/Agenda.
- [x] Pre-Deployment: revisar backup, rollback, migration e ausência de operação fora do escopo.

**Self-Healing:** `@dev` em modo light, máximo 2 iterações/15 minutos, correção automática apenas para CRITICAL; HIGH documentado, MEDIUM/LOW fora do auto-fix.

**Focus Areas:** constraints e reversibilidade da migration; autorização/ownership; CAS; validação Zod; acessibilidade do Dialog; responsividade; preservação do toast e isolamento de iframe.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-09-11 | 0.1 | Story criada a partir do pedido do usuário, reconhecimento Scout e checkpoint Vault. | River (SM) |
| 2026-09-11 | 0.2 | Migration principal e correção aditiva por triggers aplicadas em produção com backups e validações Vault. | Vault / Codex |
| 2026-09-11 | 1.0 | Backend, frontend, recuperação persistida, testes e gates concluídos; story pronta para revisão. | Dex / Nova / Codex |

## Dev Agent Record

### Agent Model Used

Codex (orquestração Bibble com Scout, Vault, Echo, Nova, Forge, Probe, Anubis, Lens, Sage, Scribe e Kowalski).

### Debug Log References

- Backups e evidências Vault descritos na seção **Evidências do checkpoint Vault — 2026-09-11**.
- Forge final: ESLint estrito do escopo, 15 arquivos/85 testes, Prisma validate, build de produção e `git diff --check` aprovados.
- Gates globais executados: `npm run lint`, `npm run typecheck` e `npm test` continuam vermelhos somente por débitos preexistentes fora da feature; detalhes em **QA Results**.

### Completion Notes List

- Preferência de técnico separada da atribuição real e protegida por validação de role/estado e CAS.
- Data desejada opcional normalizada no fuso do projeto, sem impacto na Agenda Alpha.
- Nova conclusão cria feedback `PENDENTE` na mesma transação; não há retroatividade.
- Popup global não descartável preserva o toast, usa Pusher para baixa latência e polling autoritativo para recuperação/reconciliação entre abas.
- Feedback valida ownership, estado, notas, ramos condicionais, tamanho de comentário e concorrência no servidor e no banco.
- Revisões Anubis e Lens endureceram coerção de notas, limite de relato, falhas transitórias e datas civis inválidas.

### File List

- `docs/stories/story-rm-2026-a6f2c9-chamados-feedback-preferencia-prazo.md`
- `prisma/schema.prisma`
- `prisma/migrations/20260911131500_chamados_feedback_preferencia_prazo/migration.sql`
- `prisma/migrations/20260911133500_chamados_feedback_resposta_bool_triggers/migration.sql`
- `src/actions/chamados-feedback.ts`
- `src/actions/chamados.ts`
- `src/actions/protocolos.ts`
- `src/app/PainelAlpha/Chamados/page.tsx`
- `src/app/PainelAlpha/Chamados/NovoChamado/page.tsx`
- `src/app/PainelAlpha/Chamados/NovoChamado/NovoChamadoForm.tsx`
- `src/app/api/notificacoes/route.ts`
- `src/components/DetalhesChamado.tsx`
- `src/components/NotificacaoFlutuante.tsx`
- `src/components/chamados/ChamadoFeedbackForm.tsx`
- `src/components/chamados/ChamadoFinalizadoFeedbackDialog.tsx`
- `src/components/chamados/FeedbackRatingScale.tsx`
- `src/components/layout/PainelLayoutClient.tsx`
- `src/hooks/useAdminChamadosNotifications.ts`
- `src/lib/chamados/conclusao.ts`
- `src/lib/chamados/schemas.ts`
- `src/store/useChamadoNotificacoes.ts`
- `tests/chamados/assumir.test.ts`
- `tests/chamados/conclusao-feedback.test.ts`
- `tests/chamados/criar-chamado-preferencia.test.ts`
- `tests/chamados/feedback-actions.test.ts`
- `tests/chamados/feedback-migration.test.ts`
- `tests/chamados/feedback-schemas.test.ts`
- `tests/chamados/feedback-ui.test.ts`
- `tests/chamados/finalizar-protocolo-agenda.test.ts`
- `tests/chamados/finalizar-rapido-feedback.test.ts`
- `tests/chamados/notificacoes-api.test.ts`
- `tests/chamados/notificacoes-store.test.ts`

## QA Results

- **Forge (escopo): PASS** — ESLint sem warnings, 15 arquivos/85 testes de Chamados aprovados, schema Prisma válido, build de produção concluído e diff check limpo.
- **Probe: PASS** — abertura, preferência, assunção, conclusão, popup, polling, Pusher, iframe e não interferência na Agenda estão conectados.
- **Anubis: PASS no delta após correções** — nenhuma vulnerabilidade crítica nova; coerção de notas e limite do relato corrigidos. Débitos de segurança antigos no chat/Pusher e actions legadas permanecem fora desta story.
- **Lens: PASS** — validação de data civil tornada total após correção do caso `Invalid Date`; nenhum achado remanescente.
- **Sage: PASS** — 85 testes direcionados cobrindo autenticação, ownership, CAS, extremos 0/5, limites do comentário, migrations, triggers, integridade e FKs.
- **Gates globais executados:**
  - `npm run lint`: falha no baseline global (21.205 ocorrências em áreas legadas/artefatos AIOX); nenhum erro no escopo desta story.
  - `npm run typecheck`: falha no baseline global em Exclusão Fiscal, Gerador de Documentos, Habilitação Radar e Google Calendar; nenhum erro em arquivo da feature.
  - `npm test`: 359 arquivos aprovados e 14 falharam por suites preexistentes fora do escopo (2.814 testes aprovados, 28 falharam e 1 pendente).
  - `npm run build`: aprovado; somente avisos preexistentes do `pdfjs-polyfill`.
- **Risco residual:** não há E2E browser/Pusher real; a integração está coberta por testes de contrato estático, store, API e servidor.
