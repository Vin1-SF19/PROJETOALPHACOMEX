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
| Agendar Reunião | Campos dinâmicos + data/hora + criar/reagendar Google Meet. |
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
- [ ] Atualizar testes de integração e regressão.
- [ ] Executar lint, typecheck, testes BPM e build quando possível.

## File List

- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx`
- `tests/bpm/card-modal-integration.test.ts`
- `tests/bpm/lost-ui.test.ts`

## Change Log

| Date | Description |
| --- | --- |
| 2026-08-13 | Story criada a partir da regra explícita de formulário por etapa dentro do card. |
