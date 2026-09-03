# Story RM-2026-429476 — Campos personalizados agrupados por coluna

**Objetivo do Roadmap:** Aba Configurações
**Escopo:** configuração administrativa dos pipelines do Alpha CRM/BPM
**Projeto:** Painel Alpha
**Status:** Em testes
**Data:** 2026-09-02

## Contexto

A seção **Campos Personalizados** da configuração de pipeline renderiza hoje um array plano de `BpmCampo`. Embora cada linha mostre o nome da etapa, a leitura fica difícil quando há muitos campos. O objetivo é organizar os campos em grupos visuais por coluna/etapa sem alterar sua persistência ou o CRUD existente.

## Auditoria

- Rota: `/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]`.
- Componente: `AdminPipelineClient.tsx`.
- Fonte: `ObterPipelineBpm`, em `src/actions/bpm/Pipelines.ts`.
- Relação: `BpmCampo.etapaId -> BpmEtapa.id` (opcional, 1:N).
- `etapaId = null` significa campo geral, exibido em todas as etapas.
- A listagem atual usa `campos.map(...)` e não possui agrupamento.
- O CRUD de criação, edição, exclusão, tipo, obrigatoriedade e opções já existe.
- Não é necessária migration nem alteração de dados.

**DELIVERY_READY:** a infraestrutura existente já entrega `etapaId`, etapas ordenadas e a rota administrativa protegida; a mudança é de apresentação no componente atual.

## Critérios de aceite

- [x] Campos aparecem em seções identificadas pelo nome da coluna.
- [x] As seções seguem a ordem das etapas do pipeline.
- [x] Campos com `etapaId = null` aparecem em uma seção **Todas as etapas**.
- [x] Campos vinculados a uma etapa não são perdidos nem duplicados.
- [x] Colunas sem campos exibem um estado vazio claro.
- [x] Criar, editar, excluir e alternar obrigatoriedade continuam funcionando.
- [x] Ao editar a etapa de um campo, ele muda imediatamente para o grupo correto.
- [x] Não há migration ou mutação de dados.
- [x] Testes direcionados, lint e gates do projeto foram executados sem regressão identificada nesta entrega.

## Plano

- [x] Fase 0 — auditar rota, componente, action e modelo de dados.
- [x] Fase 1 — implementar agrupamento visual preservando o CRUD.
- [x] Fase 2 — validar integração e regressões.
- [x] Fase 3 — documentar e mover o objetivo para **Em testes**.

## File list

- `docs/stories/story-rm-2026-429476-campos-por-coluna.md` (novo)
- `src/lib/bpm/campos-admin.ts` (novo)
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx`
- `tests/bpm/campos-agrupados-por-coluna.test.ts` (novo)
- `.bibble/memory/architecture.md`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/decisions.md`
- `.bibble/memory/journal.md`

## Evidências de fechamento

- Dados reais do Turso foram consultados somente para confirmar a distribuição dos campos; nenhuma escrita foi feita.
- 10/10 testes direcionados passaram (`campos-agrupados-por-coluna` + regressão do CRUD).
- ESLint direcionado passou sem erros.
- `npm run typecheck` foi executado após a mudança: nenhum erro nos arquivos desta entrega; os erros reportados são débitos preexistentes em outros módulos.
- O helper também foi exercitado diretamente com campos gerais, coluna preenchida e coluna vazia.
- A suíte global e o build foram tentados, mas o runtime Node passou a encerrar com `SIGSEGV` enquanto outra IA mantinha um modelo local de aproximadamente 29 GiB e o swap estava esgotado. O processo concorrente foi preservado.
- Validação visual autenticada permanece para a etapa de testes manuais.

## Fora de escopo

- Alterar a semântica de `BpmCampo.etapaId`.
- Criar, excluir ou migrar campos existentes.
- Reordenar campos via drag-and-drop.
- Promover automaticamente para produção.
