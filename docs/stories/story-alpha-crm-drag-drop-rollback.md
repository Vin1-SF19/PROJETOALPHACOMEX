# Story: Alpha CRM — rollback determinístico do drag-and-drop

## Status

Ready for Review

## Objetivo

Fazer com que a movimentação otimista do board seja sempre reconciliada com o
backend: uma recusa, exceção, cancelamento ou drop sem destino restaura
imediatamente a lista original, a etapa e a ordem dos cards, sem refresh da
página.

## Acceptance Criteria

1. O início do drag cria um snapshot determinístico da lista completa do board.
2. Uma recusa ou exceção de `MoverCardBpm` restaura esse snapshot antes de
   qualquer tentativa de recarregamento e expõe a mensagem do backend em um
   alerta acessível.
3. Cancelamento e drop sem destino também restauram o snapshot integral.
4. A reconciliação é feita por `ListarCardsPipelineBpm`, sem `router.refresh`
   no caminho de drag-and-drop; se ela falhar após uma movimentação salva, o
   board mantém a mudança confirmada e informa a sincronização pendente.
5. Listagens/Pusher iniciados antes do drag não podem sobrescrever um rollback
   ou uma confirmação posterior; eventos recebidos durante o drag são
   reconciliados somente após sua finalização.
6. Colunas vazias continuam sendo destinos válidos de drop.
7. Nenhuma regra de negócio, action de backend, schema ou migration é alterada.

## Tasks / Subtasks

- [x] Criar helper puro para snapshot, movimento otimista e restauração integral.
- [x] Guardar geração do board no início do drag e descartar respostas antigas.
- [x] Restaurar localmente antes de sincronizar nas recusas, exceções,
  cancelamentos e drops inválidos.
- [x] Manter a razão de rejeição em alerta acessível durante a reconciliação.
- [x] Reconciliar sucesso e Pusher sem refresh de rota no fluxo DnD.
- [x] Tornar a superfície de cada coluna droppable, inclusive quando vazia.
- [x] Cobrir snapshot/ordem, rejeição, cancelamento, sucesso, falha de
  reconciliação e integração estrutural.

## Dev Agent Record

### Agent Model Used

GPT-5 / Codex.

### Debug Log References

- `npx vitest run tests/bpm/drag-drop-rollback.test.ts`: 9/9 testes aprovados.
- `npx vitest run tests/bpm`: 27 arquivos / 188 testes aprovados.
- `npx eslint src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx src/lib/bpm/drag-drop-board.ts tests/bpm/drag-drop-rollback.test.ts`: aprovado.

### Completion Notes List

- O snapshot conserva a ordem global e a etapa anterior de todos os cards;
  restaurações usam uma cópia nova para não reutilizar estado mutável.
- Uma geração é incrementada no começo do drag e novamente no rollback. Assim,
  listagens que começaram antes não atualizam o estado atual.
- Eventos realtime que chegam durante a transação de drag ficam pendentes e são
  sincronizados após o resultado local ser determinado.
- O motivo devolvido pela action é exibido por `role="alert"` e não é apagado por
  uma falha de reconciliação.
- Após `MoverCardBpm` confirmar, uma falha de `ListarCardsPipelineBpm` mantém a
  mudança confirmada e mostra sincronização pendente; ela nunca executa rollback.
- Um segundo drag fica indisponível até a ação anterior e sua reconciliação
  terminarem, evitando snapshots concorrentes.

### File List

- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `src/lib/bpm/drag-drop-board.ts` (novo)
- `tests/bpm/drag-drop-rollback.test.ts` (novo)
- `docs/stories/story-alpha-crm-drag-drop-rollback.md` (novo)

## Change Log

| Date | Description |
| --- | --- |
| 2026-08-13 | Implementado rollback determinístico e reconciliação sem refresh para DnD do CRM. |
