# RM-2026-E4F8AF — Exclusão segura de campos aplicáveis

## Status

Pronta para testes — objetivo 10/10 implementado no terminal em 2026-09-22.

## Critérios e implementação

- [x] A área “Adicionar campo aplicável” oferece controle de exclusão.
- [x] A exclusão exige confirmação explícita em modal.
- [x] A action valida sessão e permissão administrativa antes da operação.
- [x] A exclusão ocorre em transação e somente quando o campo não possui valor de card, valor global ou anexo associado.
- [x] Em caso de dados associados, nada é removido e a interface apresenta o erro mantendo o modal aberto.
- [x] Mapeamentos sem dados são removidos antes do campo para respeitar as constraints existentes.
- [x] A exclusão é auditada, avança a versão de configuração e notifica as pipelines afetadas.
- [x] Sem schema, migration, seed, backfill ou mutação de dados executada durante o desenvolvimento.

## File list

- `src/actions/bpm/Campos.ts`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx`
- `tests/bpm/campos-configuraveis-actions.test.ts`
- `tests/bpm/pipeline-editor-react.test.ts`
- `tests/bpm/relacionamento-ui.test.ts`
- `docs/stories/story-rm-2026-e4f8af-exclusao-segura-campos.md`
- `.bibble/memory/journal.md`

## Validação

- Testes focados: **33/33 aprovados** em quatro arquivos.
- ESLint dos arquivos alterados: **aprovado**.
- `npm run typecheck`: **aprovado**.
- `npm test -- --run`: **3528 aprovados, 16 falharam, 1 todo**; as 16 falhas estão em 11 arquivos fora do escopo deste objetivo.
- `npm run lint`: **2417 erros e 1218 warnings globais**, baseline já existente em arquivos fora do escopo; nenhum erro no lint focado.

Resultado: **PASS no escopo** e encaminhado para **Em testes**. A homologação
em navegador autenticado e a execução contra banco real ficam para a etapa de
testes; nenhuma exclusão real de dados foi realizada nesta implementação.
