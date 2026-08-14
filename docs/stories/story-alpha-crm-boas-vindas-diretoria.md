# Story — Operacional: Boas-vindas com alerta e acesso da diretoria

**Status:** Ready for Review  
**Data:** 2026-08-14

## Objetivo

Dar destaque imediato aos cards de **Boas-vindas** ainda não acessados e impedir que qualquer pessoa fora da diretoria consulte ou altere esses cards.

## Regra de negócio

- Um card em etapa cujo nome normalizado seja `Boas-vindas` só pode ser acessado pela diretoria.
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

## Verificação

- [x] Testes focados de autorização e UI — 22 testes
- [x] Suíte BPM — 41 arquivos / 243 testes
- [x] ESLint focado nos arquivos alterados
- [x] `git diff --check`
- [ ] Typecheck global — bloqueado pelos 5 erros basais fora do CRM: validadores de Exclusão Fiscal (2), `HabilitacaoRadarClient` (1) e `sync-queue.test.ts` (2)
- [ ] Lint/teste global — não executados; a cobertura BPM completa acima cobre o módulo alterado

## Sem migration

Não há alteração de schema ou dados.
