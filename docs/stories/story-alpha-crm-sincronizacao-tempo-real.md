# Story: AlphaCRM — sincronização em tempo real

## Status

Ready for Review

## Story

Como usuário do AlphaCRM, quero receber atualizações do pipeline aberto em tempo real para que o board e o card exibam dados recentes sem recarregar a página manualmente.

## Acceptance Criteria

1. Cada pipeline usa um canal Pusher privado próprio e um único evento tipado.
2. O payload contém somente `pipelineId`, `cardId` opcional, `tipo` e `timestamp`.
3. A autorização do canal exige sessão autenticada, valida o formato/nome do canal e confirma o ID do pipeline no banco.
4. Falhas do Pusher não alteram o resultado de mutações já persistidas.
5. São emitidas atualizações após criação, primeira visualização, atualização e movimento de card.
6. São emitidas atualizações após mudanças em tarefas, anexos, interações, reunião/reagendamento e vínculos.
7. Mudanças de etapa, campo e pipeline que afetam o board também emitem atualização.
8. Existe um helper server-side central, capaz de resolver `pipelineId` a partir de `cardId`.
9. Canal, evento e construção do payload possuem testes unitários puros.
10. Nenhuma migration ou alteração de schema é necessária.

## Blueprint de implementação

- `src/lib/bpm/realtime.ts`: contrato client-safe, gerador/validador de nome do canal e construtor do payload mínimo.
- `src/lib/bpm/realtime-server.ts`: resolução opcional de pipeline por card e emissão Pusher best-effort.
- `src/app/api/pusher/auth/route.ts`: autorização explícita do canal privado do pipeline.
- `src/actions/bpm/*.ts`: chamada do helper somente depois do sucesso persistido.
- `tests/bpm/realtime.test.ts`: testes puros do contrato, sem Pusher ou banco.

## Riscos e mitigação

- Vazamento entre pipelines: canal privado, parser estrito e confirmação do pipeline no banco.
- Falha externa invalidar uma mutação: emissão isolada em `try/catch`, sem relançar erro.
- Payload crescer e expor dados: construtor central retorna apenas quatro propriedades permitidas.
- Eventos duplicados: consumidor deve tratar o evento como sinal de invalidação; payload não transporta estado autoritativo.

## Tasks / Subtasks

- [x] Definir contrato client-safe de canal, evento e payload.
- [x] Implementar helper server-side resiliente com resolução por card.
- [x] Restringir autorização Pusher por pipeline.
- [x] Emitir eventos após mutações AlphaCRM relevantes.
- [x] Cobrir canal e payload com testes unitários puros.
- [x] Executar teste direcionado e registrar resultado.
- [x] Atualizar File List e conclusão da story.

## Quality Gates

- [x] Teste direcionado `tests/bpm/realtime.test.ts` aprovado.
- [x] Compatibilidade TypeScript do contrato exercitada pelo teste direcionado.
- [x] Sem migration/schema.
- [x] File List atualizada.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Dex)

### Debug Log References

- `npx vitest run tests/bpm/realtime.test.ts` — 1 arquivo e 4 testes aprovados.
- ESLint direcionado aos 14 arquivos da implementação — aprovado sem erros.
- `npx tsc --noEmit --pretty false` — nenhum erro novo no CRM; permanecem 4 erros de baseline fora do escopo em Exclusão Fiscal, Habilitação Radar e Google Calendar.
- Suite global e build não executados para evitar repetir gates demorados sem relação com este ajuste.

### Completion Notes List

- Canal privado canônico por pipeline e evento único tipado.
- Payload mínimo centralizado, sem dados de empresa, usuário ou conteúdo do card.
- Autorização exige sessão, canal válido e pipeline existente.
- Emissão Pusher best-effort e resolução do pipeline por card no helper server-side.
- Emissões conectadas a cards, tarefas, anexos, interações, reuniões, vínculos e configurações do board.

### File List

- `docs/stories/story-alpha-crm-sincronizacao-tempo-real.md` (novo)
- `src/lib/bpm/realtime.ts` (novo)
- `src/lib/bpm/realtime-server.ts` (novo)
- `src/app/api/pusher/auth/route.ts` (modificado)
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` (modificado)
- `src/actions/bpm/Anexos.ts` (modificado)
- `src/actions/bpm/Campos.ts` (modificado)
- `src/actions/bpm/Cards.ts` (modificado)
- `src/actions/bpm/Etapas.ts` (modificado)
- `src/actions/bpm/GoogleMeet.ts` (modificado)
- `src/actions/bpm/Interacoes.ts` (modificado)
- `src/actions/bpm/Pipelines.ts` (modificado)
- `src/actions/bpm/Tarefas.ts` (modificado)
- `src/actions/bpm/Vinculos.ts` (modificado)
- `tests/bpm/realtime.test.ts` (novo)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-08-12 | 0.1 | Story e blueprint inicial | Dex |
| 2026-08-12 | 1.0 | Realtime implementado e teste direcionado aprovado | Dex |
| 2026-08-12 | 1.1 | Board sincronizado, lint direcionado aprovado e typecheck global auditado | Dex |
