# Story — Alpha CRM: pessoas vinculadas por card

**Status:** Ready for Review

## Objetivo

Permitir vincular pessoas da tabela `usuarios` a um card do CRM. Somente contas
vinculadas podem executar as operações do card previstas pelo seu papel; o
responsável nunca pode ser removido da relação. A UI exibe a seleção múltipla
no cabeçalho do card aberto e os avatares das pessoas no card fechado.

## Acceptance Criteria

1. A listagem do seletor retorna somente `usuarios` ativos com acesso efetivo ao
   CRM, expondo apenas `id`, `nome` e `imagemUrl`.
2. Consultar candidatos e substituir participantes exige sessão e permissão de
   gestão do card; a autorização da escrita é revalidada dentro da transação.
3. Somente responsável, administrador do card ou Admin/CEO/TI global pode gerir
   os vínculos. Participantes não recebem a ação `adicionarParticipantes`.
4. O responsável é sempre incluído como `RESPONSAVEL`; o seletor não consegue
   removê-lo. Novos vínculos entram como `PARTICIPANTE`, enquanto um papel
   `ADMINISTRADOR` já existente é preservado enquanto selecionado.
5. A substituição é atômica e usa CAS por `updatedAt`, não aceita IDs repetidos,
   não vincula contas inativas/sem CRM e registra no histórico somente IDs.
6. Depois do commit há revalidação do CRM e evento realtime `CARD_ATUALIZADO`.
7. `ObterCardBpm` e `ListarCardsPipelineBpm` incluem `imagemUrl` na projeção de
   `membros`, sem expor dados pessoais ou credenciais.
8. Um `PARTICIPANTE` vinculado pode executar o trabalho operacional do card:
   editar campos/anotações, registrar interações, tarefas, anexos e reuniões,
   além de mover etapa. Ele não pode gerir vínculos nem excluir o card.
9. O realtime por pipeline publica somente `pipelineId`, `tipo` e timestamp;
   `cardId` é usado internamente para resolver o canal, mas não é exposto aos
   assinantes. Um membro CRM ativo fora do setor pode assinar a invalidação
   genérica do pipeline; ao ser removido, a autorização é revogada e a recarga
   deixa de listar o card.

## Tasks

- [x] Criar schemas Zod para listar candidatos e substituir pessoas, incluindo
  limite e rejeição de duplicatas. (AC: 4–5)
- [x] Centralizar a elegibilidade ativa + CRM efetiva no ownership BPM. (AC: 1, 5)
- [x] Criar Server Actions seguras para listagem e atualização atômica. (AC: 1–6)
- [x] Preservar responsável e papéis administrativos existentes. (AC: 3–5)
- [x] Projetar avatares dos membros nas leituras de card e board. (AC: 7)
- [x] Cobrir permissão, elegibilidade, CAS, histórico mínimo e realtime. (AC: 1–6)
- [x] Liberar capacidades operacionais de participantes vinculados sem liberar
  gestão de pessoas ou exclusão. (AC: 8)
- [x] Remover `cardId` do payload realtime por pipeline. (AC: 9)
- [x] Permitir assinatura realtime a membro CRM ativo do pipeline sem expor a
  atividade de cards individuais. (AC: 9)
- [x] Corrigir consulta e atualização de vínculos em cards importados do RD
  usando `bpmCardIdSchema`, preservando autorização, elegibilidade e responsável.
- [x] Encerrar o carregamento ao falhar a requisição do seletor e permitir nova
  tentativa ao reabrir; cobrir o fluxo com teste React.

## Contrato das Server Actions

- `ListarUsuariosVinculaveisCardBpm({ cardId })` →
  `{ success, data: Array<{ id, nome, imagemUrl }>, error? }`.
- `AtualizarMembrosCardBpm({ cardId, userIds })` →
  `{ success, data: Array<{ userId, role, usuario: { id, nome, imagemUrl } }>, error? }`.
- O cliente envia somente os IDs adicionais selecionados; o responsável é
  automaticamente preservado e incluído pelo servidor.

## Validação

- `npx vitest run tests/bpm/membros-card-actions.test.ts tests/bpm/membros-card-ownership.test.ts` — passou (5 testes).
- `npx vitest run tests/bpm` — passou (45 arquivos, 269 testes).
- `npx eslint src/actions/bpm/Membros.ts src/lib/bpm/ownership.ts src/lib/validations/bpm.ts src/actions/bpm/Cards.ts` — passou.
- `git diff --check` — passou.
- `npx tsc --noEmit --pretty false` — não há erro da feature; permanecem cinco
  baselines conhecidos fora deste escopo.

## File List

- `src/actions/bpm/Membros.ts` (novo)
- `src/lib/bpm/ownership.ts`
- `src/lib/bpm/realtime.ts`
- `src/lib/bpm/realtime-server.ts`
- `src/lib/validations/bpm.ts`
- `src/actions/bpm/Cards.ts`
- `tests/bpm/membros-card-actions.test.ts` (novo)
- `tests/bpm/membros-card-ownership.test.ts` (novo)
- `tests/bpm/realtime.test.ts`
- `tests/bpm/realtime-authorization.test.ts`
- `.bibble/memory/architecture.md`
- `docs/stories/story-alpha-crm-membros-por-card.md` (novo)
- `src/app/PainelAlpha/AlphaCRM/CardModal/SeletorMembrosCard.tsx`
- `tests/bpm/membros-card-carregamento-react.test.ts`

## Dev Agent Record — correção do seletor (2026-10-19)

- Causa: os schemas de listagem e atualização exigiam CUID, rejeitando os IDs
  persistidos `rdcard_<hash>` antes da consulta e do salvamento. Ambos agora
  usam o schema compartilhado de IDs do CRM; as permissões continuam revalidadas.
- Consulta de candidatos em modo somente leitura: 22 usuários elegíveis.
- Testes direcionados: 23 testes de actions/ownership/UI e 1 teste React passaram.
- `npm run typecheck`: passou.
- `npm test`: 649 arquivos passaram; 4899 testes passaram, 4 skipped e 1 todo.
- ESLint direcionado aos arquivos da correção: passou.
- `npm run lint`: passou sem erros (1193 warnings no projeto).
- Build: as duas tentativas (saída padrão e isolada em `.cache/crm-membros-build`)
  foram interrompidas por SIGTERM no worker. A tentativa isolada compilou com
  warnings em `src/lib/bibble/pdfjs-polyfill.ts`, depois registrou `socket hang up`.
  Build completo não validado; log: `/tmp/crm-membros-build-isolado.log`.
- Logs completos das verificações desta execução: `/tmp/crm-membros-*.log`.

### Validação para envio à main (2026-10-19)

- Correção aplicada isoladamente sobre `origin/main` (`a9f03dfc`), preservando
  o schema de confirmação de movimentação RD já presente na main.
- `npm run lint`: passou (0 erros; warnings existentes).
- `npm run typecheck`: passou na repetição isolada após interrupção da primeira tentativa.
- `npm test`: 648 arquivos passaram; 4858 testes passaram, 4 skipped e 1 todo.
- `npm run build`: passou na worktree isolada; warnings de dependências existentes.
- `git diff origin/main --check`: passou.
- CodeRabbit CLI indisponível neste ambiente.
- Logs desta validação: `/tmp/crm-main-*.log`.
