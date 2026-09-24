# RM-2026 — Manter e-mail da reunião e remover atalho duplicado de procedimentos

## Status

Ready for Review — migração remota aplicada após autorização explícita; gates automatizados aprovados.

## Story

Como usuário do Alpha CRM, quero encontrar o e-mail informado ao agendar uma reunião quando reabrir o card e precisar reagendá-la, e acessar os procedimentos pela aba lateral já existente, para não redigitar o destinatário nem encontrar dois acessos para a mesma função.

## Contexto e dependências

- Pedido do usuário nesta conversa: retirar **Abrir procedimentos da etapa** do conteúdo central do card aberto; manter no input o e-mail usado no agendamento quando o horário for alterado.
- A aba lateral de procedimentos já existe. O componente `stage-checklist` no formulário central ainda renderiza um botão que a abre. [Fonte: `src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx`]
- O formulário de reunião recebe o e-mail de `card.emailClienteReuniao`; na leitura do card, esse valor é calculado apenas a partir de contatos vinculados. O e-mail digitado é enviado para o Google Calendar, mas não aparece nesse cálculo na próxima abertura. [Fontes: `PainelReuniao.tsx`, `src/actions/bpm/Cards.ts`, `src/actions/bpm/GoogleMeet.ts`]
- A story [E-mail na etapa Agendar Reunião](story-rm-2026-13ca69-email-agendar-reuniao.md) já definiu validação, normalização, convidados e preenchimento inicial inequívoco. A story [Formulário unificado por etapa](story-alpha-crm-formulario-unificado-por-etapa.md) reserva o painel lateral para procedimentos.

## Critérios de aceite

1. No card aberto, **Abrir procedimentos da etapa** não aparece no formulário central; a aba lateral de procedimentos permanece acessível e funcional.
2. Após agendar uma reunião com e-mail digitado ou corrigido manualmente, o mesmo endereço normalizado continua preenchido ao atualizar ou fechar e reabrir o card, inclusive para reagendamento.
3. Quando ainda não houver e-mail usado em reunião, o preenchimento inicial inequívoco a partir do contato vinculado continua funcionando conforme a story anterior; casos ambíguos continuam vazios.
4. Ao reagendar com outro e-mail, o input passa a refletir o novo endereço após atualizar ou reabrir o card; os convidados existentes seguem preservados conforme o fluxo atual.
5. Falha no agendamento ou reagendamento não apresenta como salvo um e-mail que não foi confirmado; validação, autorização e regras atuais de reunião continuam ativas.
6. Testes verificam o desaparecimento do atalho central, a presença da aba lateral e a recuperação do e-mail após nova leitura do card.

## Tasks / Subtasks

- [x] Remover da composição visível do formulário central o atalho de `stage-checklist`, sem deixar seção vazia e sem afetar a aba lateral (AC 1).
- [x] Identificar a fonte durável do e-mail efetivamente usado na reunião e fazer `ObterCardBpm` entregá-lo para `PainelReuniao` após nova leitura (AC 2–5).
- [x] Atualizar o e-mail da fonte escolhida apenas após sucesso confirmado das ações de agendar/reagendar, preservando validação e participantes existentes (AC 2, 4, 5).
- [x] Cobrir com testes o fluxo inicial, contato ambíguo, e-mail editado, atualização, reabertura e reagendamento (AC 1–6).
- [x] Aplicar migration no Turso remoto somente após confirmação explícita do usuário (Vault).
- [x] Executar `npm run lint`, `npm run typecheck` e `npm test`; registrar resultados, checklist e File List antes de concluir.
- [x] Confirmar `npm run build`.

## Dev Notes

- `PainelReuniao` mantém o input em estado local enquanto montado; ao remontar, inicializa com `card.emailClienteReuniao`. O endereço digitado precisa estar disponível em nova leitura. [Fonte: `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx`]
- `ObterCardBpm` calcula `emailClienteReuniao` por `selecionarEmailClienteReuniao(vinculosEmail)`; isso não representa necessariamente o destinatário informado no agendamento. [Fonte: `src/actions/bpm/Cards.ts`]
- `AgendarReuniaoGoogleMeetBpm` e `ReagendarReuniaoBpm` recebem `emailCliente` e o usam nos convidados. A implementação deve escolher uma fonte durável sem introduzir outra interpretação ambígua entre contato do cliente e e-mail da reunião. [Fonte: `src/actions/bpm/GoogleMeet.ts`; contexto: `story-rm-2026-13ca69-email-agendar-reuniao.md`]
- Se a solução exigir alteração de esquema, migration, seed ou backfill, seguir integralmente a política de banco do `AGENTS.md`: Vault, backup verificado e confirmação explícita antes de executar a alteração. Não há autorização implícita para executá-la.
- `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados neste workspace durante a preparação da story.

## Testing

- Testes de componente/integração do card aberto: botão central ausente e procedimentos laterais acessíveis.
- Testes de action/leitura: agendar com e-mail editado, carregar o card novamente, reagendar com outro e-mail e carregar novamente; conferir retorno normalizado.
- Regressão: contato único/principal, contato ambíguo, validação de e-mail, participantes e bloqueios de reunião já cobertos pelas stories anteriores.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** principal Frontend; secundários API e integração Google Calendar; complexidade média.
- **Specialized Agent Assignment:** @dev na implementação; @ux-design-expert para consistência da composição; @qa na revisão. @data-engineer e Vault apenas se houver mudança de banco.
- **Quality Gate Tasks:** [ ] Pre-Commit (@dev), revisão `coderabbit --prompt-only -t uncommitted` se a CLI estiver disponível; [ ] Pre-PR (@devops), revisão da diferença antes de eventual PR.
- **Self-Healing Configuration:** @dev em modo light, até 2 iterações e 15 minutos; CRITICAL corrigido, HIGH documentado, MEDIUM/LOW ignorados nesse gate. Revisão @qa pode usar modo full, até 3 iterações e 30 minutos, corrigindo CRITICAL/HIGH.
- **CodeRabbit Focus Areas:** sem espaço vazio no formulário; acessibilidade da aba lateral; precedência correta do e-mail usado na reunião; consistência após nova leitura; autorização e validação do servidor; convidados existentes no reagendamento.

## File List

- `docs/stories/story-rm-2026-email-reuniao-procedimento-card.md`
- `prisma/schema.prisma`
- `prisma/migrations/20260924175500_bpm_reuniao_email_cliente/migration.sql`
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/GoogleMeet.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx`
- `src/lib/bpm/email-reuniao.ts`
- `src/lib/bpm/email-reuniao-legado-server.ts`
- `tests/bpm/card-campos-agendar-reuniao.test.ts`
- `tests/bpm/email-reuniao.test.ts`
- `tests/bpm/email-reuniao-legado-server.test.ts`
- `tests/bpm/formulario-etapa.test.ts`
- `tests/bpm/google-meet-etapa-guard.test.ts`

## Evidências e pendência Vault

- `npm run lint`: 0 erros; 1.192 warnings do repositório.
- `npm run typecheck`: aprovado.
- `npm test`: 505 arquivos aprovados, 3.807 testes aprovados, 4 ignorados e 1 todo. A primeira execução encontrou asserção antiga do formulário, atualizada para o filtro de `stage-checklist`.
- `npm run build`: aprovado.
- Testes focados: 30 aprovados.
- `npx prisma validate` e `npx prisma generate`: aprovados.
- `prisma migrate diff --script`: somente `ALTER TABLE "BpmCardReuniao" ADD COLUMN "emailCliente" TEXT;`.
- Vault: backup novo `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-24T17-55-31-722Z.sql`, 153.887.652 bytes, SHA-256 `1e0e639ea9f27fd7a2036aba1a4826b3e0c0ad8dd56c9984a70163c38a1055a2`; restauração em banco temporário aprovada com 331 tabelas, 159.082 linhas, `integrity_check=ok` e nenhuma violação de FK.
- Autorização explícita do usuário recebida para esta coluna opcional; `node scripts/apply-turso-migration.mjs prisma/migrations/20260924175500_bpm_reuniao_email_cliente/migration.sql` aplicado ao Turso remoto (1 statement). `PRAGMA table_info` confirmou `emailCliente TEXT` anulável; `integrity_check=ok`, `foreign_key_check` sem violações e 3 reuniões anteriores preservadas.
- Reuniões anteriores possuem `emailCliente=NULL`. Quando a agenda pertence ao próprio usuário e o evento Google tem um único convidado inequívoco, a leitura do card recupera esse e-mail sem mutação em massa; casos ambíguos usam o contato sugerido ou permanecem vazios.
- Leitura ORM do Turso remoto após a migração: `bpmCardReuniao.count()` e `findFirst({ select: { emailCliente: true } })` aprovados, 3 reuniões presentes.
- `npm run lint`: 0 erros, 1.192 warnings preexistentes; `npm run typecheck` e `npm run build`: aprovados após o ajuste legado. CodeRabbit CLI indisponível neste ambiente.

## Validação do rascunho

Checklist `story-draft-checklist.md`: objetivo/contexto, orientação técnica, referências, autonomia, testes e CodeRabbit verificados como **PASS**. Story **READY** para implementação. O pedido direto do usuário é a origem dos critérios; não há epic específico para este ajuste. A escolha da fonte durável do e-mail fica para a implementação, sujeita à política de banco acima se exigir migration.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-24 | 0.1 | Story criada a partir do relato do usuário e do fluxo existente. | River (SM) |
| 2026-09-24 | 0.2 | Atalho central removido; e-mail da reunião persistido e recuperado; migração Turso autorizada, aplicada e verificada; gates aprovados. | Codex |
