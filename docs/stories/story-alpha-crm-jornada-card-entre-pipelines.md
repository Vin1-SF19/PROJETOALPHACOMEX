# Story — Alpha CRM: jornada do card entre pipelines

## Status

Ready for Review — implementação local validada; smoke autenticado com jornada real pendente.

## Executor Assignment

- **Executor:** @dev
- **Quality gate:** @qa; revisão de @architect se a leitura dos vínculos exigir uma regra nova de percurso.
- **Ferramentas:** testes BPM, `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.

## Story

**Como** usuário do Alpha CRM, **quero** clicar em cada pipeline no topo do card aberto e ver as etapas pelas quais a jornada daquele card passou naquele pipeline, **para** acompanhar seu percurso completo ao longo dos pipelines sem confundir essa jornada com outros cards da mesma empresa.

## Critérios de aceite

1. As abas de pipelines do topo do card aberto continuam disponíveis. Ao selecionar uma aba, a área de histórico mostra, em ordem de passagem, somente as etapas efetivamente percorridas pela jornada do card naquele pipeline.
2. A jornada atravessa os cards de origem e destino conectados pelos vínculos persistidos entre cards. A consulta não inclui outro card apenas por ter a mesma empresa, mesmo que ele esteja no mesmo pipeline.
3. A aba do pipeline atual também permite ver as etapas já percorridas pelo card nesse pipeline. O formulário da etapa atual e os demais controles do card aberto continuam funcionando.
4. Cada passagem apresentada corresponde ao histórico de movimentação persistido. A entrada inicial e a etapa atual são representadas quando os registros existentes permitem identificá-las; uma etapa que o card nunca visitou não aparece como percorrida. Reentradas na mesma etapa permanecem distinguíveis na ordem histórica.
5. Quando a jornada não tiver passagem por um pipeline, a aba informa claramente que este card ainda não passou por ele. Não apresenta cards avulsos da empresa como substitutos do histórico.
6. Somente etapas e cards que o usuário está autorizado a visualizar aparecem. A leitura no servidor valida o acesso ao card aberto e a cada card vinculado antes de expor histórico, inclusive ao atravessar vários vínculos.
7. A visualização preserva a identidade da jornada ao abrir um card vinculado em outro pipeline: as abas refletem o percurso relacionado ao card aberto e não o conjunto indiscriminado de cards da empresa.
8. Testes cobrem ao menos uma cadeia com três pipelines, card não vinculado da mesma empresa, pipeline sem passagem, revisita de etapa e acesso negado a card vinculado.

## Escopo e decisões registradas

- **Fonte:** pedido confirmado pelo usuário nesta conversa: histórico de toda a jornada do card entre pipelines, com clique nas abas do topo para mostrar as etapas percorridas em cada pipeline. A confirmação exclui a listagem atual de todos os cards da mesma empresa.
- **[AUTO-DECISION] Unidade da jornada:** percorrer vínculos persistidos a partir do card aberto, inclusive por mais de um salto, com proteção contra ciclos e duplicação. Isso permite a cadeia Comercial/Radar → Financeiro → Operacional já descrita na story de saídas, sem associar processos independentes pela empresa.
- **[AUTO-DECISION] Fonte da ordem:** usar os registros existentes de criação/movimentação do card e uma ordenação estável. Não inventar etapas intermediárias a partir da ordem configurada no pipeline.
- **[AUTO-DECISION] Ausência de dados antigos:** se o histórico legado não comprovar uma passagem, mostrar apenas o que é verificável, com estado vazio claro; não fabricar eventos retroativos.
- Esta story é de leitura e apresentação. Nenhuma mudança de schema, migration, seed ou backfill está autorizada. Se a implementação identificar necessidade de alteração de banco, interromper essa parte e cumprir o checkpoint Vault do `AGENTS.md` antes de qualquer execução.

## Tarefas / subtarefas

- [x] Inventariar os eventos de criação e movimentação e a direção dos vínculos existentes; definir projeção de etapas a partir de dados persistidos (AC 1, 2, 4).
- [x] Criar leitura autorizada da cadeia vinculada e das passagens por pipeline, com ordenação estável e proteção contra ciclos/duplicatas (AC 1, 2, 4, 6, 7).
- [x] Atualizar as abas do card aberto para exibir etapas percorridas e estado sem passagem; remover a dependência da listagem por empresa nessa visualização (AC 1, 3, 5).
- [x] Verificar a integração com abertura de card vinculado e com o painel da etapa atual (AC 3, 7).
- [x] Cobrir cenários principais e adversos em testes e executar os gates do projeto (AC 8): lint com zero erros, typecheck, 522 arquivos/3.879 testes aprovados, build e diff check.
- [x] Atualizar checklist, File List e estado desta story após a implementação.
- [ ] Confirmar visualmente em sessão autenticada uma jornada real entre pipelines, sem alterar cards para fabricar histórico.

## Dev Notes

- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx` cria as abas de todos os pipelines; a aba atual usa `PainelHistorico` e as demais usam `PainelHistoricoPipeline`.
- `PainelHistoricoPipeline.tsx` chama `ListarCardsEmpresaPorPipeline`, em `src/actions/bpm/Cards.ts`. Essa action filtra por `empresaId` e `pipelineId`; essa é a causa da mistura de jornadas. Ela verifica acesso aos cards retornados, mas o critério de pertencimento continua incorreto para o novo requisito.
- `src/actions/bpm/Vinculos.ts` já contém `ObterHistoricoCruzadoBpm`, que agrega o card e os vinculados diretos com filtro de acesso. Avaliar reutilização, mas a jornada entre três pipelines exige percorrer a cadeia e projetar especificamente passagens de etapa; a função atual devolve histórico genérico e apenas vínculos diretos.
- `prisma/schema.prisma` contém `BpmCardVinculo` e `BpmCardHistorico`. A story `story-alpha-crm-saidas-radar-financeiro-operacional.md` documenta a cadeia de cards vinculados entre pipelines e a exigência de respeitar permissões.
- `story-alpha-crm-resumo-etapas-no-card.md` documenta o resumo de etapas anteriores do card atual. Preservar o comportamento útil do formulário e do resumo ao alterar a aba do pipeline atual.
- `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados neste checkout; contexto cruzado consultado nas stories citadas e no código existente.

## Testing

- Testes da projeção de passagens: criação, movimentos, revisita, ordenação, histórico antigo incompleto e ausência de passagem.
- Testes de action: cadeia de três pipelines, ciclo/vínculo repetido, card avulso da mesma empresa excluído e card vinculado sem permissão omitido.
- Testes React das abas: pipeline atual, outro pipeline com histórico e pipeline sem passagem; verificar que formulário e navegação continuam acessíveis.
- Gates: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** Frontend + API de leitura; complexidade média pela cadeia de vínculos e autorização.
- **Specialized Agents:** @dev implementa; @qa valida; @ux-design-expert revisa a legibilidade e acessibilidade das abas; @architect revisa eventual decisão nova de percurso.
- **Quality Gates:** Pre-Commit (@dev): lint, typecheck, testes, build e revisão; Pre-PR (@devops), se houver PR: conferir regressão e autorização.
- **Self-Healing:** @dev light, até 2 iterações/15 min, corrige CRITICAL; @qa full, até 3 iterações/30 min, corrige CRITICAL/HIGH e documenta MEDIUM; @devops check, apenas reporta.
- **Focus Areas:** pertinência pelo vínculo, ordem real das etapas, autorização em cada salto, ausência de duplicatas, estado vazio e navegação por teclado.

## Checklist de draft

- [x] Requisito e benefício definidos a partir do pedido do usuário.
- [x] Critérios de aceite observáveis para jornada, histórico, permissões e estado vazio.
- [x] Ponto atual de mistura e modelos existentes identificados.
- [x] Contexto cruzado das stories relevantes consultado.
- [x] Checklist `story-draft-checklist.md` aplicado: objetivo/contexto PASS; orientação técnica PASS; referências PASS; autossuficiência PASS; testes PASS; CodeRabbit PASS.
- [x] Implementação, testes e gates concluídos.
- [x] File List final e QA Results atualizados.

## Dev Agent Record

### File List

- `docs/stories/story-alpha-crm-jornada-card-entre-pipelines.md` — esta story.
- `src/actions/bpm/Jornada.ts` — leitura da cadeia vinculada com autorização por card e projeção por pipeline.
- `src/lib/bpm/jornada-card.ts` — projeção cronológica de etapas, incluindo revisitas e estado atual verificável.
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx` — integração das abas.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistoricoPipeline.tsx` — apresentação de etapas por pipeline.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx` — jornada na aba do pipeline atual e preservação dos dados anteriores.
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx` — reinicialização das abas ao abrir outro card.
- `tests/bpm/jornada-card.test.ts` — projeção de passagens, revisita e card antigo.
- `tests/bpm/jornada-card-action.test.ts` — cadeia, ciclo, card avulso e acesso negado.
- `tests/bpm/jornada-card-painel-react.test.ts` — renderização, navegação, estado vazio e troca de card.
- `tests/bpm/card-tabs-pipelines.test.ts` e `tests/bpm/card-modal-integration.test.ts` — contrato de integração das abas.

### Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-25 | 0.1 | Draft da jornada do card entre pipelines | River (@sm) |
| 2026-09-25 | 0.2 | Consulta autorizada e abas da jornada implementadas; gates locais aprovados | Codex |
| 2026-09-25 | 0.3 | Incluídos movimentos automáticos, filtro de visibilidade por etapa histórica e data desconhecida quando não há evento de entrada; revisão QA tratada | Codex |

## QA Results

Revisão QA identificou ausência de movimentos automáticos, exposição de etapas históricas restritas e data de entrada incorreta no fallback. Os três pontos foram corrigidos e cobertos por testes. Testes focados: 5 arquivos/42 casos aprovados. Gates: lint sem erros (1.192 avisos preexistentes), typecheck aprovado, 522 arquivos/3.879 testes aprovados, build aprovado. Smoke visual autenticado com jornada real permanece pendente; nenhum card ou dado foi alterado nesta story.
