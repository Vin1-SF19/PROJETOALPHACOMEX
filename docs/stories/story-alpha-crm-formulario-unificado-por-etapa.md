# Story: Alpha CRM — formulário unificado por etapa no card

## Status

Ready for Dev

## Objetivo

Consolidar o detalhe do card para que a etapa atual seja a fonte única do conteúdo da aba central **Formulário da Etapa**. O modal de criação continua restrito a Novos Leads e não antecipa campos de etapas futuras.

## Contrato de composição

- Centro / **Formulário da Etapa**: campos dinâmicos e controles operacionais próprios da etapa atual.
- Esquerda: histórico, tarefas, anexos, vínculos, checklist e requisitos para avançar de etapa.
- Direita: ações de movimentação e acompanhamento não editável de reunião/transcrição.
- Google Meet: criar ou reagendar somente em **Agendar Reunião**, dentro da aba central. Em **Reunião Agendada**, mostrar apenas acompanhamento/transcrição, sem formulário de criação.

## Etapas e controles conhecidos

| Etapa | Conteúdo da aba central |
| --- | --- |
| Novos Leads | Campos dinâmicos de qualificação da etapa atual. |
| Agendar Reunião | Exclusivamente data/hora + criar/reagendar Google Meet. |
| Reunião Agendada | Campos dinâmicos; acompanhamento/transcrição sem criar/reagendar Meet. |
| Em Tratativa | Campos dinâmicos, Próximo Contato e checklist/anotações do último follow-up. |
| Sem Viabilidade | Campos dinâmicos e Próximo Contato. |
| Fechado | Campos dinâmicos e status pós-fechamento. |
| Lost | Campos dinâmicos, Motivo de Lost e complemento condicional Outro. |
| Standby - Follow Up | Campos dinâmicos e controles operacionais que a automação de follow-up vier a exigir. |

## Acceptance Criteria

1. Todo card possui uma aba central identificada como **Formulário da Etapa**.
2. `camposEtapa`, inclusive vazios e opcionais, são editáveis apenas nessa aba central e preservam CAS/rascunho/realtime.
3. Cada controle nativo é renderizado somente na etapa a que pertence, sem duplicação em painel esquerdo ou direito.
4. Agendar/reagendar Google Meet só aparece em **Agendar Reunião** e somente dentro da aba central.
5. Em **Reunião Agendada**, a interface não oferece criar/reagendar Meet; transcrição e acompanhamento permanecem acessíveis.
6. Os requisitos de entrada no destino permanecem no painel esquerdo e continuam usando as actions atômicas existentes.
7. As regras de Lost, Fechado, Em Tratativa e Sem Viabilidade continuam autoritativas no backend; esta story altera a composição visual, não enfraquece guards.
8. O modal de criação de card permanece somente com empresa/CNPJ, responsável e serviço, em Novos Leads.
9. Desktop e mobile mantêm rolagem acessível, foco de guardas e nenhum painel inacessível.
10. Nenhuma migration, schema, seed ou alteração de dados é necessária.

## Tasks

- [ ] Extrair e centralizar o editor de campos da etapa atual.
- [ ] Associar controles nativos à etapa correta na aba central.
- [ ] Reorganizar o painel esquerdo/direito sem duplicar formulários.
- [x] Restringir o Kanban e o formulário central de Agendar Reunião a data/hora + Google Meet (RM-2026-6BEA04).
- [x] Atualizar testes de integração e regressão de Agendar Reunião.
- [ ] Executar lint, typecheck, testes BPM e build quando possível.

### Fechamento RM-2026-6BEA04 — Entregue

- [x] Card fechado de Agendar Reunião restrito a data/hora e ação Google Meet.
- [x] Formulário central restrito a `PainelReuniao`, sem campos dinâmicos, Próximo Contato ou transcrição.
- [x] Loading com botão desabilitado e spinner visível.
- [x] Link oficial persistido acessível no card e no modal.
- [x] Seletor assistido de data/hora aceito pelo administrador como equivalente funcional ao `datetime-local`.
- [x] Testes direcionados e regressões da RM aprovados.
- [x] Forge e Probe registrados; feedback obrigatório corrigido e reinspecionado.
- [x] Memórias Scribe e journal Kowalski atualizados.

> A story permanece `Ready for Dev` porque contém tarefas guarda-chuva fora da RM-2026-6BEA04 ainda abertas; o escopo desta RM está fechado.

## File List

- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `src/actions/bpm/Cards.ts`
- `tests/bpm/card-modal-integration.test.ts`
- `tests/bpm/card-campos-agendar-reuniao.test.ts`
- `tests/bpm/formulario-etapa.test.ts`
- `tests/bpm/lost-ui.test.ts`
- `.bibble/memory/architecture.md`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/components.md`
- `.bibble/memory/decisions.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/known-errors.md`
- `.bibble/memory/journal.md`
- `docs/stories/story-alpha-crm-formulario-unificado-por-etapa.md`

## Change Log

| Date | Description |
| --- | --- |
| 2026-08-13 | Story criada a partir da regra explícita de formulário por etapa dentro do card. |
| 2026-09-04 | RM-2026-6BEA04 restringe Agendar Reunião a data/hora + Google Meet no Kanban e formulário central. |
| 2026-09-04 | Fechamento Scribe/Kowalski da RM: feedback visual validado, memória e checklist específico consolidados. |
