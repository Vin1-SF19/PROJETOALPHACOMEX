# Story — Operacional: Boas-vindas com alerta e acesso da diretoria

**Status:** Ready for Review  
**Data:** 2026-08-14

## Objetivo

Dar destaque imediato aos cards de **Boas-vindas** ainda não acessados e impedir que qualquer pessoa fora da diretoria consulte ou altere esses cards.

## Regra de negócio

- Um card em etapa cujo nome normalizado seja `Boas-vindas` só pode ser acessado pela diretoria.
- No pipeline `Operacional`, somente `Admin` ou `Diretor` podem vincular pessoas aos cards da etapa `Boas-vindas`; responsável e administrador do card não recebem essa exceção.
- A base atual não possui a role `DIRETOR`: há somente uma conta global `Admin` e nenhum cargo preenchido. Para esta regra, `Admin` é a diretoria canônica; `CEO` e `TI` não recebem bypass automático.
- A regra é aplicada no backend, incluindo leitura, alteração, movimentação, tarefas, anexos e demais actions que usam `exigirAcessoBpmCard`.
- Listagens do board, perfil de empresa, dashboard e central de tarefas filtram esses cards para quem não é diretoria.
- Quando `primeiraVisualizacaoEm` estiver vazia, o card de Boas-vindas mostra borda/alerta vermelho com a mensagem **Nunca acessado — requer atenção**.

## Arquivos alterados

- `src/lib/bpm/boas-vindas.ts`
- `src/lib/bpm/ownership.ts`
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/Empresas.ts`
- `src/actions/bpm/Dashboard.ts`
- `src/actions/bpm/Tarefas.ts`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `tests/bpm/boas-vindas-acesso.test.ts`
- `tests/bpm/card-modal-integration.test.ts`
- `tests/bpm/membros-card-ui.test.ts`
- `tests/bpm/cpf-fechamento-react.test.ts`
- `tests/bpm/exclusao-modal-board-react.test.ts`
- `src/actions/bpm/Membros.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`

## Verificação

- [x] Testes focados de autorização e UI — 22 testes
- [x] Bloquear vínculo de pessoas em Boas-vindas/Operacional para cargos fora de Admin/Diretor, no backend e na UI
- [x] Suíte BPM — 41 arquivos / 243 testes
- [x] ESLint focado nos arquivos alterados
- [x] `git diff --check`
- [x] `npm run lint` — 0 erros, 1.191 avisos existentes
- [x] `npm run typecheck` — aprovado
- [x] `npm test` — 525 arquivos, 3.893 testes aprovados, 4 ignorados e 1 todo; fixtures de modal e expectativas de permissão atualizadas
- [x] `npm run build` — aprovado

## Sem migration

Não há alteração de schema ou dados.
