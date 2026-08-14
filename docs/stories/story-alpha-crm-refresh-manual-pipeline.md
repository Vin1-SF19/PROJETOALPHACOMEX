# Story: refresh manual do pipeline CRM

**Status:** Ready for Review

## Objetivo

Oferecer, em cada board de pipeline CRM, um botão de atualização manual como contingência para o realtime.

## Critérios de aceite

- O cabeçalho de todo pipeline exibe o botão **Atualizar**.
- O botão consulta a listagem autoritativa dos cards e atualiza somente o board atual.
- A ação não recarrega a página inteira.
- Enquanto a consulta estiver em andamento, o botão fica desabilitado e informa visualmente o carregamento.
- Uma falha usa o alerta acessível já existente no board.
- A ação não disputa estado com uma movimentação de drag-and-drop em curso.

## Implementação

- `PipelineBoardClient` reutiliza `recarregarCards`, que já descarta respostas obsoletas e trata falhas.
- `atualizarPipeline` mantém estado local de carregamento e não chama `router.refresh`.
- O botão fica no cabeçalho do board, portanto está presente em qualquer pipeline renderizado por esse componente.

## Validação

- [x] Teste de integração estático do botão, carregamento e ausência de recarga de página.
- [x] ESLint focado.
- [x] Vitest focado: 2 arquivos / 25 testes passaram.
- [x] Suíte global: 163 arquivos / 1.322 testes passaram.
- [x] `git diff --check`.
- [ ] Typecheck global: bloqueado por 5 baselines fora do CRM (`ExclusaoFiscal` x2, `HabilitacaoRadarClient` e `google-calendar/sync-queue` x2); nenhum erro no escopo desta story.
- [ ] Lint global: excedeu 60 segundos sem resultado; ESLint focado passou.

## File List

- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `tests/bpm/card-modal-integration.test.ts`
- `docs/stories/story-alpha-crm-refresh-manual-pipeline.md`
