# Story: CRM/BPM — contagem de cards alinhada ao Kanban

## Status

Ready for Review

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `lint`, `typecheck`, `vitest`, `build`, comparação autenticada de contadores e Kanban

## Story

**Como** usuário do Alpha CRM, **quero** que o contador de cada pipeline mostre o número de cards que posso ver no Kanban e que haja acesso aos cards arquivados pelo dashboard, **para** distinguir a carga de trabalho atual do histórico preservado.

## Contexto e limites

Na **Revisão de Radar**, o contador mostra **4** e o Kanban mostra **3**. O inventário somente leitura informado para esta story encontrou **3 cards `ATIVO` e 1 `ARQUIVADO`**; o arquivado é **Teste Diagnostico**, na etapa Reunião Agendada. O arquivamento é legítimo e o card deve permanecer armazenado. O usuário também pediu um **card de navegação no dashboard** que abra a lista dos cards arquivados e permita consultar seus dados, incluindo **pipeline e etapa imediatamente antes do arquivamento**. Esta story ajusta consultas, rótulos e navegação, sem exclusão de dados, migration, seed ou backfill.

`ListarPipelinesBpm` usa `_count.cards` sem filtro. `ObterDashboardBpm` agrupa todos os status e soma todos para `_count.cards`, embora a UI chame o resultado de “cards ativos”; somente `totalAtivos` filtra `ATIVO`. O Kanban (`ListarCardsPipelineBpm`) filtra etapas visíveis e membership/permissão: mostra cards `ATIVO` e alguns `CONCLUIDO` em etapas finais conforme vínculo ou saída, além de possíveis leads virtuais do NoLoss em Novos Leads. Portanto, aplicar apenas `status=ATIVO` a um contador não garante igualdade com todos os quadros. Definir um contrato compartilhado para **contagem de cards visíveis no quadro** e indicar expressamente se o número inclui os virtuais; usar a mesma semântica na interface que apresenta o total.

## Acceptance Criteria

1. Para o mesmo usuário, pipeline e instante de leitura, o contador com rótulo de **cards no quadro** coincide com o número de cards exibidos pelo Kanban, respeitando etapas visíveis, vínculo/membership, estados elegíveis e cards virtuais que o quadro exibir. Diferenças transitórias de atualização/realtime são tratadas sem apresentar um total persistente incoerente.
2. No cenário informado da Revisão de Radar, sem leads virtuais adicionais, o card arquivado **Teste Diagnostico** não entra no contador nem reaparece no Kanban: lista e quadro mostram **3**. O registro continua íntegro no banco e disponível em consulta autorizada de histórico/arquivados.
3. `ListarPipelinesBpm` deixa de apresentar `_count.cards` bruto como se fosse total do Kanban. Admins e usuários comuns recebem apenas contagens permitidas por acesso ao pipeline, visibilidade de etapa e vínculo do card; um usuário não infere quantidade de cards ocultos pela contagem.
4. `ObterDashboardBpm` mantém métricas de status distintas quando necessárias, mas o campo exibido como contador de cards visíveis adota o mesmo contrato do Kanban. O rótulo **ativos** é usado apenas quando a consulta conta somente `ATIVO`; se a métrica incluir `CONCLUIDO` elegível ou leads virtuais, usar rótulo correspondente ao conteúdo real.
5. Cards `CONCLUIDO` exibidos pelo Kanban em etapas finais segundo a regra vigente entram na contagem do quadro; cards `CONCLUIDO` ocultos, `ARQUIVADO` e outros estados não exibidos ficam fora. A implementação evita duplicação de lógica que possa divergir novamente entre consulta do quadro e contadores.
6. O tratamento de leads virtuais do NoLoss fica explícito e consistente: se são exibidos no Kanban, o contador rotulado como total do quadro os inclui; se houver contador separado de registros BPM persistidos, seu rótulo deixa clara a diferença. Nenhum lead virtual é contado duas vezes ao virar card real.
7. Testes cobrem `ATIVO`, `ARQUIVADO`, `CONCLUIDO` final visível e oculto, acesso por usuário/perfil/etapa, NoLoss virtual, conversão para card real e consistência entre lista, dashboard e Kanban. Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar checklist e File List antes de concluir.
8. O dashboard oferece um card de navegação **Cards arquivados**. Ao acessá-lo, o usuário vê uma lista de cards `ARQUIVADO` que tem permissão de consultar, com identificação da empresa/card, pipeline e etapa em que cada card estava imediatamente antes de ser arquivado. A lista permite abrir os dados preservados do card em modo de consulta autorizado, inclusive histórico e anexos conforme as permissões existentes; não oferece edição ou restauração por esta story.
9. A consulta dos arquivados valida autorização no servidor por pipeline, etapa e card, inclusive ao abrir um card por URL/ID direto; quantidade, nomes, dados e anexos de cards sem acesso não vazam pela lista, contador ou detalhe. Paginação ou carregamento incremental evita trazer todo o arquivo em uma única resposta.
10. O pipeline e a etapa anteriores ao arquivamento são obtidos de fonte persistida confiável. Para novos arquivamentos, registrar um snapshot mínimo no evento `CARD_ARQUIVADO` se necessário; para cards já arquivados, usar o estado/histórico existente com fallback explícito. Renomeações posteriores de pipeline/etapa não devem apresentar o novo nome como se fosse o nome histórico quando houver snapshot. Essa melhoria não reescreve eventos antigos nem exige backfill.
11. Arquivar um card atualiza a lista/contagem de ativos e a lista de arquivados após confirmação; falha na operação não move o card entre listas nem mostra sucesso. A página de arquivados permite voltar ao dashboard e apresenta estado vazio claro quando não há registros acessíveis.

## Tasks / Subtasks

- [x] Reconfirmar inventário e localizar todas as UIs que exibem `_count.cards`; identificar rótulos e contrato de cada indicador (AC: 1–4).
- [x] Definir fonte compartilhada/derivação do conjunto exibido por `ListarCardsPipelineBpm`, inclusive finalizados elegíveis e NoLoss virtual (AC: 1, 5–6).
- [x] Ajustar contagens de `ListarPipelinesBpm` e `ObterDashboardBpm` com as mesmas regras de autorização e visibilidade, evitando vazamento por contagem (AC: 1–6).
- [x] Corrigir rótulos para descrever a métrica real sem mudar a semântica de `totalAtivos` nem excluir dados (AC: 2, 4).
- [x] Cobrir cenários de estado/permissão/lead virtual e comparar contadores com o Kanban autenticado; rodar quality gates (AC: 7).
- [x] Adicionar card de navegação no dashboard e lista paginada de arquivados com etapa/pipeline anteriores ao arquivamento (AC: 8–9, 11).
- [x] Expor consulta autorizada dos dados do card arquivado em modo de leitura e preservar/fazer fallback da localização histórica sem backfill (AC: 8–10).
- [x] Testar acesso direto negado, visibilidade, histórico, anexos, arquivamento recente e fallback de card antigo (AC: 8–11).
- [x] Completar checklist, QA Results, Change Log e File List após implementação (AC: 7–11).

## Dev Notes

- [Source: `src/actions/bpm/Pipelines.ts#ListarPipelinesBpm`] A seleção atual usa `_count: { cards: true }` sem filtro, embora o pipeline passe pelo gate de acesso.
- [Source: `src/actions/bpm/Dashboard.ts#ObterDashboardBpm`] O agrupamento por pipeline/status já filtra etapas visíveis e membership no ramo comum; `_count.cards` soma todos os status. `totalAtivos` filtra `ATIVO`. A UI `DashboardClient.tsx` chama `_count.cards` de “cards ativos”.
- [Source: `src/actions/bpm/Cards.ts#ListarCardsPipelineBpm`] A consulta exige pipeline, etapa visível e membership quando aplicável. Mostra `ATIVO` e parte dos `CONCLUIDO` finais, conforme vínculo/saída, e acrescenta leads virtuais NoLoss na Revisão de Radar quando Novos Leads é visível.
- [Source: `src/app/PainelAlpha/AlphaCRM/pipelines/PipelinesListClient.tsx`] Lista de pipelines mostra `_count.cards`; `AdminPipelinesListClient.tsx` também mostra a contagem. Conferir se a lista administrativa deve usar rótulo de total no quadro ou métrica administrativa separada.
- [Source: `src/actions/bpm/CardsExcluir.ts#ExcluirCardBpm`] Arquivamento é soft-delete: muda status para `ARQUIVADO` e registra `CARD_ARQUIVADO`; o evento atual guarda apenas o status anterior/novo, não um snapshot de pipeline/etapa. O card preserva `pipelineId`/`etapaId`, úteis para fallback de registros antigos.
- [Source: `src/app/PainelAlpha/AlphaCRM/DashboardClient.tsx`] Já existem cards de navegação reutilizáveis para abrir uma página dedicada de arquivados.
- [Inventário informado nesta missão] Revisão de Radar: 3 `ATIVO`, 1 `ARQUIVADO` em Reunião Agendada. Este inventário descreve o caso de reprodução, não deve ser codificado como dado fixo.
- `docs/stories/accumulated-context.md` e `.aiox/gotchas.json` não existem neste checkout; o contexto foi conferido no código e nas stories BPM relacionadas.
- [AUTO-DECISION] O contador voltado ao usuário representará **cards visíveis no quadro**, pois foi essa a comparação feita no pedido. A métrica administrativa de total persistido, se necessária, recebe rótulo próprio em vez de reutilizar esse contador.

## Testing

Usar testes de actions/visibilidade em `tests/bpm/` e verificar visualmente um usuário administrativo e um usuário com etapas/cards restritos. O caso de reprodução exige 3 exibidos para o quadro sem virtual adicional; testar também o caso com virtual, finalizado exibido e arquivado oculto. A lista de arquivados deve cobrir acesso direto por ID, paginação, detalhe em leitura, localização histórica e fallback dos cards antigos. Nenhuma operação de escrita em banco é necessária para corrigir a contagem; novos eventos de arquivamento podem incluir metadado histórico sem migration.

## 🤖 CodeRabbit Integration

**Story Type Analysis:** Backend/query e frontend de métricas e arquivo consultável, com implicação de autorização; complexidade média/alta.

**Specialized Agent Assignment:** `@dev` implementa; `@qa` valida; `@ux-design-expert` revisa rótulos; `@architect` revisa contrato compartilhado se necessário; `@devops` atua em eventual push/deploy.

**Quality Gate Tasks:**

- [x] Pre-Commit (`@dev`): lint, typecheck, testes, build e revisão de visibilidade/autorização.
- [ ] Pre-PR (`@devops`): compatibilidade e CodeRabbit se houver PR.
- [ ] Pre-Deployment (`@devops`): smoke test autenticado de contadores e quadro se houver publicação.

**Self-Healing Configuration:** `@dev` light, até 2 iterações/15 min (CRITICAL corrigir; HIGH documentar); `@qa` full, até 3 iterações/30 min (CRITICAL/HIGH corrigir); `@devops` check/report only. MEDIUM documentar como dívida quando pertinente; LOW avaliar no review.

**CodeRabbit Focus Areas:** não vazar contagem ou dados de card oculto; equivalência com Kanban; `CONCLUIDO` final; NoLoss virtual; histórico de pipeline/etapa; modo de leitura; paginação; nenhuma exclusão ou mudança estrutural.

## Checklist de conclusão

- [x] Contadores e Kanban comparados para admin e usuário restrito em testes da seleção compartilhada; verificação em produção depende de publicação.
- [x] AC 1–11 cobertos com evidência; card arquivado permanece armazenado e consultável conforme permissões.
- [x] `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` executados.
- [x] QA, File List e Change Log atualizados.

## File List

- `docs/stories/story-alpha-crm-contagem-cards-visiveis-kanban.md` — esta story; adicionar arquivos alterados ao implementar.
- `src/lib/bpm/cards-no-quadro.ts` — predicado compartilhado e contagem de cards do quadro.
- `src/actions/bpm/Cards.ts`, `Pipelines.ts`, `Dashboard.ts` — board e contadores alinhados.
- `src/actions/bpm/CardsExcluir.ts` — snapshot da etapa/pipeline no evento de arquivamento.
- `src/actions/bpm/Arquivados.ts` — lista e consulta autorizada do arquivo.
- `src/app/PainelAlpha/AlphaCRM/DashboardClient.tsx`, `page.tsx`, `pipelines/PipelinesListClient.tsx`, `admin/AdminPipelinesListClient.tsx` — navegação e rótulos.
- `src/app/PainelAlpha/AlphaCRM/arquivados/page.tsx`, `[cardId]/page.tsx` — lista paginada e detalhe somente leitura.
- `src/app/api/bpm/anexos/[anexoId]/route.ts` — proteção do download de anexos arquivados.
- `tests/bpm/cards-no-quadro.test.ts`, `arquivados-action.test.ts`, `excluir-card-action.test.ts`, `anexo-handoff-access.test.ts` — regressões.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-28 | 0.1 | Story para alinhar contadores de pipeline e dashboard aos cards visíveis no Kanban. | River (`@sm`) |
| 2026-09-28 | 0.2 | Acrescentados dashboard, lista e consulta autorizada de cards arquivados com localização anterior ao arquivamento. | River (`@sm`) |
| 2026-09-28 | 0.3 | Contagem compartilhada com Kanban, acesso paginado ao arquivo, snapshot histórico e links autenticados para anexos. | Codex (`@dev`) |

## Dev Agent Record

Lint: 0 erros, 1191 avisos preexistentes. Testes completos: 4031 aprovados, 4 ignorados, 1 pendente. Testes direcionados após o ajuste de anexos: 34 aprovados. Typecheck final e build final concluídos com sucesso.

## QA Results

### Review Date: 2026-09-28

### Reviewed By: Quinn (Test Architect)

### Code Quality Assessment

**APPROVED.** A contagem usa a mesma seleção do Kanban para estados, etapas visíveis, membership, cards concluídos elegíveis e leads virtuais NoLoss. As listas de pipelines e o dashboard só calculam contagens de pipelines acessíveis. O arquivo oferece lista paginada e detalhe somente leitura; ambos exigem autorização no servidor. O evento novo de arquivamento preserva os nomes de pipeline e etapa, com fallback explícito para cards antigos.

### Findings Resolved During Review

- O detalhe de arquivados usava a referência privada do Blob como link de anexo. Agora devolve apenas `/api/bpm/anexos/{id}` e a rota exige acesso ao pipeline arquivado e ao card; campos de arquivo também apontam para o anexo autenticado.

### Compliance Check

- Lint: zero erros; 1.191 avisos preexistentes.
- Typecheck e build finais: aprovados após o ajuste de anexos.
- Suíte completa: 4.031 testes aprovados; 34 testes direcionados da correção de anexos aprovados.
- Segurança: acesso direto ao detalhe e ao download é validado no servidor; a referência privada do Blob não é exposta pela action de arquivo.

### Gate Status

**APPROVED.** A comparação autenticada dos contadores com o Kanban e a abertura de um card arquivado real em produção permanecem como homologação após o deploy.

## Story Draft Validation

| Category | Status | Issues |
| --- | --- | --- |
| Goal & Context Clarity | PASS | Caso 4 versus 3 e acesso ao arquivo definidos. |
| Technical Implementation Guidance | PASS | Queries, UI, evento de arquivamento e diferenças de status/virtual mapeados. |
| Reference Effectiveness | PASS | Cada referência aponta para a causa ou regra visível. |
| Self-Containment Assessment | PASS | Semântica de contagem e limites de dados definidos. |
| Testing Guidance | PASS | Estados, perfis, NoLoss e arquivo consultável verificáveis. |
| CodeRabbit Integration | PASS | Agentes, gates, self-healing e focos presentes. |

**Final Assessment:** implementação concluída e QA aprovado; nenhuma alteração estrutural de banco foi necessária.
