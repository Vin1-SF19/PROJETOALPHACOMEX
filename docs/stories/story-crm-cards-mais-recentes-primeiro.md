# Story — Cards mais recentes primeiro nos funis CRM

## Status

Ready for Review — staging publicado e verificado READY. Integração main e gates aprovados; produção aguardando publicação remota.

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["npm run lint", "npm run typecheck", "npm test", "npm run build"]

## Story

Como usuário do CRM, quero que os cards mais novos apareçam acima dos antigos nas etapas dos funis, para acompanhar primeiro as entradas recentes sem procurar no fim da coluna.

Origem: pedido direto do usuário; hoje novos cards chegam abaixo dos antigos. O usuário autorizou explicitamente **staging e produção para esta atualização**. A entrega passa primeiro pelo staging e promove somente a correção validada, sem incluir automaticamente alterações concorrentes alheias. Sem mutação de dados, schema, migration ou backfill.

## Acceptance Criteria

1. Os funis exibem os cards em cada etapa do mais recente para o mais antigo, usando a data de criação já presente no fluxo (`BpmCard.createdAt`) e, para leads NoLoss ainda pendentes, sua data de recebimento (`receivedAt`). Quando compartilham a coluna, as origens são intercaladas pela mesma ordem cronológica, sem anexar uma origem inteira ao fim.
2. A ordem é aplicada antes da seleção/paginação, permanece coerente na carga inicial, recarga, realtime/polling e “carregar mais”, com desempate determinístico por ID. Nenhum card desaparece ou duplica em razão da ordenação; filtros e autorização existentes são preservados.
3. Arrastar um card entre etapas mantém o comportamento canônico de movimentação e rollback. Após a reconciliação, a coluna respeita a ordenação pela data definida no AC 1. Alterar etapa ou editar um card antigo não inventa uma nova data de criação nem uma ordem manual persistida.
4. A correção usa o fluxo real do quadro e é somente de leitura/apresentação. Não modifica registros ou datas, não cria regras de entrada na etapa, configurações, controles de ordenação ou filtros novos.
5. Lint, typecheck, suíte completa de testes e build são executados sobre a entrega e seus resultados reais registrados; QA revisa a correção e as regressões pertinentes. Após aprovação, DevOps publica/verifica staging primeiro e então o patch autorizado em produção, preservando configurações/bancos distintos e alterações locais/concorrentes alheias.
6. Checklist e File List refletem o trabalho real. Evidências incluem commits/releases, READY/SHA/alias e smoke de ambos os ambientes, com limites de teste autenticado explícitos. Publicação iniciada ou testes parciais não são relatados como aprovação integral.

## Dev Notes e referências

- `src/actions/bpm/Quadro.ts`, consulta/manifesto: cards já são consultados por `createdAt DESC, id DESC`; leads NoLoss são acrescentados ao fim. A seleção de página usa o manifesto recebido; ordenar somente o JSX pode deixar os mais recentes fora da página.
- `src/actions/bpm/Cards.ts`, `ListarCardsPipelineBpm`: consulta cards em DESC e converte `lead.receivedAt` para `createdAt` no resumo NoLoss. Conferir também a combinação final das origens neste caminho de hidratação/carga.
- `src/lib/bpm/noloss-leads.ts`, `buscarNolossLeadsPendentes`: atualmente ordena `receivedAt ASC`. Acesso ao pipeline é responsabilidade do chamador; preservar filtros de status e contratos de acesso existentes.
- `src/lib/bpm/quadro-paginado.ts`, `selecionarPaginaQuadro`: percorre entradas na ordem recebida, com limite por etapa; `mesclarResumosQuadro` monta resumos na ordem de IDs da página. A ordem canônica deve chegar coerente a esses pontos.
- `src/lib/bpm/drag-drop-board.ts`: movimento otimista substitui apenas `etapaId`; snapshots preservam a lista para rollback. Não transformar o pedido de ordem cronológica em reordenação manual ou nova regra de transição.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`: reconciliação/manifesto, filtros e “carregar mais” compõem o fluxo efetivo; preservar guards de arrasto e respostas concorrentes.
- Testes existentes relevantes: `tests/bpm/quadro-actions.test.ts`, `quadro-paginado.test.ts`, `board-polling-react.test.ts` e `cards-no-quadro.test.ts`. Reutilizar fixtures e acrescentar regressões de ordenação onde necessário.
- `AGENTS.md`, Quality Gates e Fluxo de ambientes: staging primeiro e promoção após pedido explícito. Esse pedido cobre o patch desta atualização em produção; não amplia o escopo para outras alterações. `package.json`, scripts: comandos reais dos quatro gates.

**[AUTO-DECISION] Critério de recência:** preservar `createdAt`, já usado pelos cards no servidor, e `receivedAt` dos leads NoLoss. Não introduzir data de entrada na etapa nem `updatedAt` como prioridade sem requisito do usuário. O diagnóstico final e a implementação mínima cabem ao executor. `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados nas preparações anteriores; contexto cruzado nas stories de staging/promoção e regras citadas.

## Tarefas / subtarefas

- [x] Registrar pedido, autorização específica, inventário e aplicar checklist de draft.
- [x] Reproduzir ordenação no fluxo inicial/manifesto e confirmar combinação de cards/NoLoss (AC 1–2).
- [x] Aplicar correção mínima de ordem antes da paginação e coerente com hidratação/reconciliação (AC 1–4).
- [x] Testar cards novos/antigos, fontes misturadas, empate, paginação, realtime e drag/rollback pertinentes (AC 1–4).
- [x] Executar quatro gates completos nos candidatos e revisão QA (AC 5); integração atualizada ratificada por equivalência integral de código ao staging aprovado.
- [ ] DevOps publicar/validar staging; depois integrar/publicar somente o patch autorizado em produção (AC 5–6).
- [ ] Registrar releases, smoke, limitações e atualizar status, checklist e File List (AC 6).

## Testing

Usar fixtures com datas fora de ordem, cards antigos e recentes e leads NoLoss intercalados, incluindo empate de data. Validar que a primeira página contém os mais novos e as seguintes continuam a sequência sem duplicação. Testar inclusão/reconciliação de novo card e manutenção da ordem no polling, preservando filtros/ACL. Verificar movimentação e rollback existentes sem mutar datas. Smoke remoto distingue disponibilidade/versão de teste visual autenticado; não modificar dados reais para fabricar evidência.

## CodeRabbit Integration

- **Story Type Analysis:** lógica de leitura/apresentação com integração frontend; complexidade baixa a média pela paginação e múltiplas origens.
- **Specialized Agents:** @dev implementação/Pre-Commit; @qa regressões; @devops staging e promoção do patch autorizado.
- **Quality Gates:** Pre-Commit com diff e quatro gates; CodeRabbit se disponível, documentando ausência/revisão alternativa. Pre-PR e Pre-Deployment por DevOps: escopo do patch, compatibilidade, ambiente e rollback de código.
- **Self-Healing:** @dev light, 2 iterações/15 minutos para CRITICAL e HIGH documentado; @qa full, 3 iterações/30 minutos para CRITICAL/HIGH, MEDIUM como dívida; @devops check, somente reporte.
- **Focus Areas:** data canônica, combinação de origens, ordem antes da paginação, reconciliação, imutabilidade e escopo específico da promoção.

## Validação da preparação — @sm

Checklist `story-draft-checklist.md` aplicado: objetivo/contexto PASS; orientação técnica PASS; referências PASS; informação autocontida PASS; testes PASS; CodeRabbit PASS. **READY, clareza 9/10.** Nenhuma implementação, teste ou publicação foi realizada nesta preparação.

## Dev Agent Record e File List

- `docs/stories/story-crm-cards-mais-recentes-primeiro.md` — escopo, checklist e evidências.
- `src/lib/bpm/ordem-cards.ts` — helper puro, ordem decrescente por criação/recebimento, ID DESC em empates e datas ausentes/inválidas ao final, sem mutar entrada.
- `src/lib/bpm/quadro-paginado.ts` — data de criação opcional no manifesto para compatibilidade de contrato.
- `src/lib/bpm/noloss-leads.ts` — consulta por receivedAt DESC e ID DESC.
- `src/actions/bpm/Quadro.ts` — projeta datas das duas origens e ordena antes da página/seleção de resumos.
- `src/actions/bpm/Cards.ts` — ordena o retorno combinado de cards reais e virtuais na carga/hidratação.
- `tests/bpm/ordem-cards.test.ts` — datas/origens, fusos, empates e sem-data, paginação, reconciliação, drag e rollback.
- `tests/bpm/cards-ordenacao-actions.test.ts` — action ListarCards e consulta NoLoss reais com IO mockado, IDs e ACL.
- `tests/bpm/quadro-actions.test.ts` — primeira página inclui o lead recente, atualização e carregar mais; expectativas de empate alinhadas.
- `tests/bpm/board-polling-react.test.ts` — componente real mostra lead recente antes do card existente após polling.

Regressão focada executada: 6 arquivos e 47 testes aprovados (`cards-ordenacao-actions`, `ordem-cards`, `quadro-actions`, `quadro-paginado`, `board-polling-react`, `cards-no-quadro`). ESLint dos nove arquivos de código/testes do escopo passou sem mensagens. Não houve escrita de dados/schema, novas dependências ou alterações de ambiente.

Preflight de publicação: staging remoto f8ef731232920a29a2339f416b402e30d99afb40 e main remoto 31151e2a8f9eec0e55b551841b8a2ff67be612fe. Existem 55 caminhos de alterações concorrentes entre eles; somente o patch dos dez caminhos acima será promovido nesta entrega, sem copiar o arquivo Cards.ts inteiro de staging sobre produção. Worktrees isolados preparados por DevOps. CodeRabbit indisponível na sessão; revisão independente QA utilizada como alternativa.

## QA Results

**PASS / APPROVED** — revisão independente final dos dez caminhos ratificada. Ordenação cronológica, empate por ID DESC, datas ausentes, paginação, polling, ACL e drag/rollback aprovados. Integração main também PASS: somente dez caminhos e hunks estritos; nenhum dos 55 caminhos concorrentes foi incluído. Gates próprios do candidato main original aprovados; integração atualizada validada por equivalência integral ao staging READY.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-21 | 0.1 | Preparação da ordenação e autorização específica staging/produção | River (@sm) |
| 2026-10-21 | 0.2 | Ordenação única antes de paginar/hidratar e regressões focadas aprovadas | Dex / Codex |

## Evidências DevOps — staging antes da publicação

- Base staging congelada: `f8ef731232920a29a2339f416b402e30d99afb40`; promoção main restrita ao patch sobre `31151e2a8f9eec0e55b551841b8a2ff67be612fe`.
- Lint: exit 0, zero erros e 1.193 avisos preexistentes. Build padrão: exit 0. Typecheck após build: exit 0.
- Primeira suíte completa: seis falhas em quatro arquivos CLI antigos por timeouts/subprocesso, enquanto havia build e typecheck concorrentes. Nenhuma alteração de fonte/teste foi feita. Repetição do mesmo `npm test`, sem concorrência: **688 arquivos e 5.287 testes aprovados**, 4 ignorados, 1 todo, exit 0.
- Logs: `/tmp/crm-cards-novos-staging-20261021-{lint,build,typecheck,tests,tests-retry}.log`. QA independente da implementação e da integração main: PASS / APPROVED. CodeRabbit indisponível.
- Somente URLs SQLite locais sintéticas nos gates; sem credenciais, dados reais, schema ou configurações alterados. Estado naquela revisão pré-publicação: staging/produção READY e smoke ainda pendentes. Staging posteriormente confirmado READY conforme seção de promoção abaixo.
- Limite: não foi executado teste visual autenticado nem mutação de cards reais.

## Evidências DevOps — promoção restrita para main

- Staging `347c61a4f54365715f50bc3a5a82375d938ebd3d` publicado e verificado **READY**, alias `https://staging.alpha-comex.com`, deployment `dpl_Gb3owd49fCsza2MfEHFKXW2AcPbp`. Smoke: `/` 200, CRM/Automações 307, API CRM 401.
- Candidato main original sobre `31151e2a`: lint/typecheck aprovados; 682 arquivos e 5.181 testes aprovados, 4 ignorados e 1 todo. Build padrão atingiu heap local de 3 GB; equivalente webpack 6 GB passou sem alterar configurações/fontes.
- Antes do push, outra sessão avançou main para `5fd0d1c230858800e337a79c3202ead84c13d73e`. Esse trabalho foi integralmente preservado e somente o mesmo patch foi reaplicado, sem conflito. Nenhum commit concorrente foi introduzido por esta promoção.
- A árvore resultante possui **todo código, testes, configurações e dependências byte-idênticos** ao staging `347c61a4` aprovado (688 arquivos/5.287 testes e build padrão). As únicas diferenças são esta story e a story de promoção já pertencente à nova base main. Gates do staging permanecem válidos por equivalência integral; nenhuma repetição sem nova mudança comportamental.
- Artefatos: `/tmp/crm-cards-novos-staging-20261021-deployment-evidence.json` e `/tmp/crm-cards-novos-{staging,main}-20261021-gates.json`. Produção READY/SHA/alias/smoke pendente nesta revisão; fechamento local após verificação, sem novo commit documental.
