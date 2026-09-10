# Story: Alpha CRM — criar campo no formulário da etapa

## Status

Review

## Contexto

O editor canônico do formulário permite adicionar campos já configurados para a etapa, mas não oferece um caminho para criar um campo novo. O administrador precisa conseguir fazer isso no próprio contexto da seção sem reintroduzir o editor legado removido.

## Story

**Como** administrador do CRM,
**quero** criar um campo diretamente no formulário de uma etapa,
**para que** eu possa ampliar o card/formulário sem sair do editor nem associar o campo indevidamente às demais etapas.

## Critérios de aceite

- [x] Cada seção oferece a ação explícita “Criar novo campo”.
- [x] A criação permite informar nome, tipo, obrigatoriedade e opções para tipos de seleção.
- [x] O novo campo é criado pela action canônica e recebe `BpmCampoEtapaConfig` apenas para a etapa selecionada.
- [x] O componente é adicionado à seção escolhida e fica pendente no editor até o salvamento da composição.
- [x] A criação não usa os atributos legados de aplicabilidade/obrigatoriedade e não propaga o campo para todas as etapas.
- [x] Nenhuma migration, alteração estrutural ou mutation em massa é introduzida.

## Tasks / Subtasks

- [x] Adicionar modal de criação de campo ao builder canônico.
- [x] Integrar a criação à action `CriarCampoBpm` e ao catálogo local do editor.
- [x] Adicionar automaticamente o novo campo à seção de origem.
- [x] Cobrir o contrato canônico e a presença do fluxo com testes focados.
- [x] Executar lint, typecheck e testes aplicáveis.

## Dev Agent Record

### Completion Notes

- O editor passou a oferecer “Criar novo campo” em cada seção, com nome, tipo, obrigatoriedade e opções para seleção simples/múltipla.
- A action canônica existente cria `BpmCampo` e `BpmCampoEtapaConfig` na mesma transação; o editor envia somente a etapa corrente e adiciona o componente ao rascunho local.
- Não houve mudança de schema, migration, seed, backfill ou escrita direta no banco.
- Testes focados e ampliados do CRM: 65/65 verdes. ESLint dos arquivos alterados: verde.
- Typecheck global continua bloqueado por erros preexistentes fora do escopo (Exclusão Fiscal, gerador de documentos, Radar e Google Calendar); nenhum erro aponta para os arquivos desta story.
- Suíte global: 2.782 testes verdes, 1 todo e 28 falhas preexistentes em 14 arquivos fora desta alteração.
- Lint global permanece bloqueado pelo baseline do repositório: 21.203 ocorrências, principalmente em `.aiox-core`, `.agents` e módulos não alterados.
- O botão e o modal de criação permanecem disponíveis também no layout restaurado do Card do Kanban; o campo novo aparece imediatamente na prévia ao vivo.

### File List

- [x] `docs/stories/story-alpha-crm-criar-campo-no-formulario.md`
- [x] `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx`
- [x] `tests/bpm/campos-configuraveis-actions.test.ts`
- [x] `tests/bpm/formulario-etapa.test.ts`

### Change Log

- 2026-09-10: fluxo de criação de campo iniciado no editor canônico do formulário.
- 2026-09-10: implementação validada e movida para Review.
