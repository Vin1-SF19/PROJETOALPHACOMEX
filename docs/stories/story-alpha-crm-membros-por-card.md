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
