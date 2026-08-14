# Story: Anotação fixa no formulário da etapa

**Status:** Ready for Review

## Objetivo

Disponibilizar uma **Anotação** persistente no rodapé do painel central do card, em todas as etapas, sem que o tamanho do formulário esconda o campo.

## Critérios de aceite

- O rótulo do campo é **Anotação**.
- O campo fica no rodapé do painel central, fora da área de scroll do formulário e da aba de script.
- Continua disponível em todas as etapas do pipeline.
- O conteúdo é salvo como observação da interação existente, preservando o contrato de backend.
- Usuários sem permissão de edição não podem alterar nem registrar.

## Implementação

- `PainelRegistrar` agora é uma coluna flexível: abas e formulário rolam internamente; o footer é fixo no desktop e sticky no fluxo móvel.
- Data, Hora e Link continuam no conteúdo de registro de interação; a Anotação e o botão de registrar ficam no footer.
- O histórico passa a chamar o conteúdo exibido de **Anotação**.

## Validação

- [x] Teste de integração de composição e persistência da Anotação.
- [x] ESLint focado.
- [x] Vitest BPM: 34 arquivos / 216 testes passaram.
- [x] `git diff --check`.
- [ ] Typecheck global: bloqueado pelos 5 baselines externos conhecidos (`ExclusaoFiscal` x2, `HabilitacaoRadarClient` e `google-calendar/sync-queue` x2); nenhum erro no escopo desta story.

## File List

- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`
- `tests/bpm/formulario-etapa.test.ts`
- `docs/stories/story-alpha-crm-anotacao-fixa-formulario-etapa.md`
