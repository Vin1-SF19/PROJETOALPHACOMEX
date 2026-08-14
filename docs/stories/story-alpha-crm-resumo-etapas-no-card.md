# Story: Resumo progressivo das etapas no card CRM

**Status:** Ready for Review

## Objetivo

Exibir, no lado esquerdo do card, um accordion com o resumo das etapas anteriores do pipeline.

## Critérios de aceite

- A primeira etapa não exibe accordion anterior.
- Na segunda etapa, o resumo da primeira é exibido aberto.
- Da terceira etapa em diante, a etapa imediatamente anterior inicia aberta e todas as anteriores aparecem abaixo fechadas.
- Na última etapa, somente o resumo da penúltima inicia aberto.
- Cada resumo mostra a entrada registrada na etapa e os valores de campos próprios já preenchidos.
- O formulário da etapa atual permanece no centro, em **Formulário da Etapa**.
- O accordion é navegável por teclado e informa seu estado para leitor de tela.

## Implementação

- Helper puro ordena as etapas anteriores da mais recente para a mais antiga.
- `PainelResumoEtapas` controla um único accordion aberto e o reinicializa ao mover o card.
- A leitura usa o histórico já autorizado do card e seus valores de campos; não adiciona rota, action ou alteração de banco.

## Validação

- [x] Testes unitários da ordem e da etapa inicialmente aberta.
- [x] ESLint focado.
- [x] Vitest BPM: 34 arquivos / 214 testes passaram.
- [x] `git diff --check`.
- [ ] Typecheck global: somente os 5 baselines externos já conhecidos (`ExclusaoFiscal` x2, `HabilitacaoRadarClient` e `google-calendar/sync-queue` x2); nenhum erro no escopo desta story.
- [ ] Suíte global: 1.339 testes passaram; 1 teste externo de CLI Google Calendar excedeu o timeout de 5 s (`tests/google-calendar/cli.test.ts`).

## File List

- `src/lib/bpm/resumo-etapas.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelResumoEtapas.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `tests/bpm/resumo-etapas.test.ts`
- `docs/stories/story-alpha-crm-resumo-etapas-no-card.md`
