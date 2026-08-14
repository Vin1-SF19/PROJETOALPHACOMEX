# Story: Anotação fixa no formulário da etapa

**Status:** Ready for Review

## Objetivo

Disponibilizar uma **Anotação** persistente no rodapé do painel central do card, em todas as etapas, sem que o tamanho do formulário esconda o campo.

## Critérios de aceite

- O rótulo do campo é **Anotação**.
- O campo fica no rodapé do painel central, fora da área de scroll do formulário e da aba de script.
- Continua disponível em todas as etapas do pipeline.
- O conteúdo é salvo automaticamente ao sair do campo, como uma Anotação identificada no card.
- Usuários sem permissão de edição não podem alterar nem registrar.

## Implementação

- `PainelRegistrar` agora é uma coluna flexível: abas e formulário rolam internamente; o footer é fixo no desktop e sticky no fluxo móvel.
- Os campos de cada etapa ficam no painel central; os formulários locais persistem automaticamente ao perder o foco, sem botão de salvar.
- Data, Hora, Link e o bloco genérico de registro de interação foram removidos dos layouts de card. A Anotação fica no footer.
- Os comandos de efeito operacional permanecem explícitos: avançar de etapa, concluir follow-up, criar tarefa e agendar/reagendar no Google Meet.
- Os botões de avançar do painel direito foram compactados para o mesmo padrão nas etapas Agendar Reunião e Reunião Agendada.

## Validação

- [x] Teste de integração de composição e persistência da Anotação.
- [x] ESLint focado.
- [x] Vitest focado: 2 arquivos / 28 testes passaram.
- [x] Vitest BPM: 42 arquivos / 252 testes passaram.
- [x] `git diff --check`.
- [ ] Typecheck global: bloqueado pelos 5 baselines externos conhecidos (`ExclusaoFiscal` x2, `HabilitacaoRadarClient` e `google-calendar/sync-queue` x2); nenhum erro no escopo desta story.
- [ ] `npm test` global: 172 arquivos / 1.382 testes passaram; falhou apenas em dois baselines externos (`google-calendar/cli` por timeout e `apresentacoes/pptx-parser` por expectativa de mime type).

## File List

- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistFollowUp.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximoContato.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelRequisitosAvanco.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelStatusPosFechamento.tsx`
- `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx`
- `src/actions/bpm/Interacoes.ts`
- `src/lib/validations/bpm.ts`
- `tests/bpm/formulario-etapa.test.ts`
- `docs/stories/story-alpha-crm-anotacao-fixa-formulario-etapa.md`
