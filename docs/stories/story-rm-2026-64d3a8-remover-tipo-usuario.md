# RM-2026-64D3A8 — Remover o tipo de campo Usuário das opções de criação

## Status

Pronta para testes — objetivo 9/10 implementado no terminal em 2026-09-22.

## Critérios e implementação

- [x] A criação de novo campo não oferece mais o tipo `usuario`.
- [x] Campos `usuario` já existentes continuam disponíveis na composição de formulários.
- [x] Campos `usuario` existentes continuam renderizando e aceitando edição no card.
- [x] A validação de valores legados no servidor foi preservada.
- [x] Sem schema, migration ou alteração de dados.

## File list

- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx`
- `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx` (compatibilidade existente, revalidada)
- `src/lib/bpm/campos-dinamicos.ts` (validação existente, preservada)
- `tests/bpm/relacionamento-ui.test.ts`
- `docs/stories/story-rm-2026-64d3a8-remover-tipo-usuario.md`

## Validação

31/31 testes em quatro suítes focadas, ESLint dos arquivos alterados e
`npm run typecheck` aprovados. A cobertura React verifica simultaneamente que
`usuario` não aparece no diálogo de criação e que um campo legado desse tipo
continua renderizando e emitindo alteração. Resultado: **PASS no escopo**,
encaminhado para **Em testes**. A homologação em navegador autenticado fica
para a etapa de testes.
