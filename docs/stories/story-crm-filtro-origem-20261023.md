# Story — Filtro de origem no Kanban e busca ampliada

## Status
Ready for Review — QA final APPROVED / GO STAGING. Quatro gates globais, Probe local e revisão Lens/Anubis aprovados; avanço remoto `f51b753b` integrado sem conflito, preservando a correção do X único e os caminhos próprios. Commit/push, READY remoto e smoke com Admin real pendentes neste checkpoint pré-publicação; somente staging autorizado.

## Executor Assignment
executor: "@dev"; quality_gate: "@qa"; quality_gate_tools: ["npm run lint", "npm run typecheck", "npm test", "npm run build", "revisão de autorização e paginação", "smoke de navegador"]

## Story e fonte
Como usuário autorizado do CRM, quero filtrar os leads do funil por origem existente, reconhecer a origem selecionada pela cor e enxergar melhor a busca, para localizar os leads com facilidade.
Pedido direto de 23/10/2026: colocar o select entre Buscar e “Meus e sem vínculos”; não listar uma origem sem lead cadastrado; cada seleção recebe cor vibrante, Instagram em roxo como seus cards; aumentar o campo de pesquisa.
Esta entrega estende o quadro existente e preserva [a visão/responsável](story-alpha-crm-visao-equipe-pipeline.md#critérios-de-aceite) e [o contrato de contagem visível](story-alpha-crm-contagem-cards-visiveis-kanban.md#acceptance-criteria). A exceção anterior para publicar o X diretamente em produção era específica daquela correção.

## Acceptance Criteria
1. A barra do Kanban apresenta, nesta ordem, busca ampliada, filtro de origem e o select existente de visão/responsável. A busca tem largura/visibilidade maiores que a atual e o conjunto continua utilizável em telas pequenas, com nomes acessíveis e navegação por teclado.
2. O filtro oferece “Todas as origens” e somente origens presentes nos cards/leads elegíveis do funil que o usuário pode consultar, incluindo virtuais e registros fora da primeira página carregada. Origens apenas cadastradas no catálogo, mas sem lead nesse conjunto, não aparecem. Nenhum dado, opção ou total revela pipeline, etapa ou card sem acesso.
3. Selecionar origem restringe corretamente os resultados e combina com busca e visão/responsável. A restrição ocorre antes da paginação/lotes; totais por coluna, manifesto, cartões exibidos e carregar mais permanecem coerentes. “Todas as origens” remove somente essa restrição.
4. A origem selecionada dá ao select uma cor vibrante estável e identificável, com fundo tingido e texto/borda legíveis; Instagram usa roxo coerente com seus cards e site usa azul. Outras origens recebem cores próprias; a escolha não muda apenas por reordenar/carregar opções. A identificação textual permanece disponível.
5. As opções usam o manifesto completo autorizado do funil, independentemente de busca, responsável, origem selecionada e paginação. Troca de filtro/pipeline, reconciliação/polling e promoção de virtual para card não reapresentam respostas antigas ou cartões fora do filtro. Uma seleção que deixe de existir recebe recuperação coerente; “Sem origem” só existe se houver entrada sem origem e se distingue de “Todas”.
6. Origens legadas/personalizadas continuam filtráveis quando existem no conjunto. Não renomear ou fundir origens por suposição, não classificar ausência como uma origem real e não mudar dados, cadastro, assunção, permissões ou contratos das integrações. Não há migration, backfill ou configuração de banco nesta entrega.
7. Testes verificam origem fora da primeira página, catálogo sem uso, origens desconhecidas/ausentes, virtual/nativo/importado, combinação de filtros, atualização e isolamento de acesso; conferir busca maior e cores em navegador. Executar os quatro gates obrigatórios e atualizar checklist/File List antes do commit/push para staging; produção exige pedido posterior específico.

## Dev Notes — referências e limites
- O quadro já dispõe de manifesto, consulta incremental e seleção paginada. Usar esse caminho para a origem, preservando as regras anteriores de escopo e contagem; não criar um poller ou download integral paralelo. [Source: `src/actions/bpm/Quadro.ts`; `src/lib/bpm/quadro-paginado.ts`; stories relacionadas acima]
- A barra e o estado dos filtros existentes vivem em `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`; cards virtuais distinguem Instagram e NoLoss. A origem comercial de um card não deve ser confundida automaticamente com seu provedor de importação. [Source: arquivo do quadro; `src/lib/bpm/origem-cliente.ts`; `src/lib/comercial/origens-lead.ts`]
- Contrato Scout/Architect: projetar `origem: string | null` na entrada do manifesto e validar o filtro no contrato compartilhado/action; compor origem, busca e responsável antes de contar/paginar. Projetar origens em lote, sem N+1. Instagram virtual usa “Instagram”; NoLoss usa `utmSource`, depois `utmMedium`, depois “NoLoss”, sem inventar “Site” para NULL; `site`/`website` legítimos representam Site. Nativos usam os campos de origem/chave existentes; SERVICO/CONTRATO somente por contexto explícito do card, nunca pelo último contrato da empresa. Representação de Todas/Sem origem e cores vivem no helper puro; manter distinção inequívoca. [Source: blueprint de `/root/arquitetura_filtro_origem`, 2026-10-23; arquivos reais acima]
- Filtro inequívoco: `origem` ausente/`undefined` = Todas; `null` = Sem origem; string = valor projetado. Não usar `default(null)`. Validar string com até 200 caracteres/nullable/optional; Select usa sentinels próprios e valores de origem prefixados/codificados para não colidir com origens personalizadas. Comparação deve usar o mesmo helper da projeção.
- Implementado em `origem-quadro.ts`: projeção/comparação, opções autorizadas, sentinels e cores compartilhados; a revisão do manifesto inclui as relações de origem, permitindo reidratar quando a origem muda mesmo sem alteração da data do card. A autorização existente de pipeline, coluna e card é preservada; nenhuma política nova de aplicabilidade de formulários é introduzida.
- Sem necessidade de variável de ambiente, dependência ou estrutura de banco nova. Cor vem de helper determinístico, com Instagram roxo/site azul e demais valores legíveis; ampliar busca para cerca de 320 px no desktop e largura disponível no mobile, sem colidir com os filtros.
- `[AUTO-DECISION]` Usar os componentes e tokens existentes, preservando tema/acessibilidade. As opções vêm dos dados autorizados do funil, e não da lista global de origens. Não inventar equivalência entre nomes antigos como Callix/Discadora ou Evento/Feiras e Eventos.
- `[AUTO-DECISION]` Story local descritiva conforme o padrão do repositório e pedido atual; nenhum epic/PRD ou sincronização externa é criado. `accumulated-context.md` e `.aiox/gotchas.json` foram procurados e não existem neste checkout; o contexto cruzado é o das duas stories vinculadas. Os documentos gerais configurados de framework/arquitetura também não foram localizados; as referências reais acima e o blueprint específico orientam a implementação.

## Tasks / Subtasks
- [x] Registrar pedido, limites, histórias relacionadas e checklist de preparação (AC1–7).
- [x] Consolidar blueprint do Architect e contrato da origem/facetas/seleção antes da implementação (AC2–6).
- [x] Implementar filtro completo, projeção/seleção compartilhada e UX da barra: busca de 320/360 px, controles de 44 px e largura disponível no mobile (AC1–6).
- [x] Executar testes dirigidos de origem/paginação/visibilidade, combinação de filtros, revisão e resposta antiga (AC2–6).
- [x] Validar Probe local com Radix/helper/CSS reais: cores, responsividade e navegação por teclado, sem clientes nem API (AC1,4,7).
- [x] Executar quatro gates, revisão independente, atualizar File List e documentação final (AC7).
- [x] Integrar `f51b753b` sem conflitos e executar QA proporcional; 14 caminhos próprios anteriores a known-errors preservados byte a byte (AC7).
- [ ] DevOps: commit/push staging, deploy READY/alias e smoke, sem produção (AC7).

## Testing e CodeRabbit Integration
Tipos: Frontend e contrato de consulta do quadro, complexidade média. `@dev` implementa; `@architect` valida contrato; `@ux-expert` orienta UX/a11y; `@qa` executa Forge e revisão independente; `@github-devops` publica staging. Testes em `tests/bpm/`, com regressões de quadro paginado/actions, visão/responsável, polling e navegação; banco de teste local descartável, sem credenciais reais. Smoke distingue fixture local de leitura autenticada no staging e não cria/assume leads reais.
Pre-Commit obrigatório: lint, typecheck, testes, build e revisão de autorização/consistência. Pre-PR somente se houver PR; produção não faz parte desta entrega. Self-healing 6.3.3: `@dev` light, 2 iterações/15 min, CRITICAL corrigir/HIGH documentar; `@qa` full, 3/30 min, CRITICAL/HIGH corrigir/MEDIUM dívida; DevOps check/report only. Se CodeRabbit CLI estiver indisponível, registrar e usar Lens independente, sem alegar execução. Foco: filtragem antes de paginar, ausência de vazamento, fontes de origem, legados, respostas antigas, contraste e responsividade.

## Story Draft Checklist
| Categoria | Resultado | Evidência |
| --- | --- | --- |
| Objetivo/contexto | PASS | Pedido e dependências resumidos; staging explícito. |
| Orientação técnica | PASS | Caminho existente e pontos reais; blueprint técnico é a primeira tarefa. |
| Referências | PASS | Stories/trechos reais e ausências documentadas. |
| Autossuficiência | PASS | ACs, limites e decisões explícitos, sem criar requisitos externos. |
| Testes | PASS | Cenários mensuráveis, quatro gates e limites do smoke. |
| CodeRabbit | PASS | Tipos/agentes/gates/self-healing/fallback definidos. |
Resultado da preparação: PASS, clareza 9/10. Implementação e QA local aprovados conforme provas abaixo; publicação remota permanece separada.

## File List
- Criados: `src/lib/bpm/origem-quadro.ts`; `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/FiltroOrigemBoard.tsx`; `tests/bpm/origem-quadro.test.ts`; `tests/bpm/board-origem-react.test.ts`; `docs/stories/story-crm-filtro-origem-20261023.md`.
- Alterados: `src/actions/bpm/Quadro.ts`; `src/lib/bpm/quadro-paginado.ts`; `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`; `tests/bpm/quadro-actions.test.ts`; `tests/bpm/board-visao-equipe-react.test.ts`; `tests/bpm/board-exclusao-local.test.ts`.
- Memórias atualizadas por apêndice próprio: `.bibble/memory/codebase-map.md`; `.bibble/memory/integration-points.md`; `.bibble/memory/journal.md`; `.bibble/memory/known-errors.md`. Total: 15 caminhos próprios, incluindo dez de código/testes, story e quatro memórias.

## Dev Agent Record / QA Results / Change Log
2026-10-23 v1 — River: preparação, contrato Scout/Architect e checklist, sem código ou dados alterados na preparação.
2026-10-23 v2 — Implementação congelada em nove caminhos de código/testes; River atualizou somente story e três memórias. Backend: seis arquivos/47 testes PASS e lint dirigido zero erros. UI: três arquivos/25 testes PASS e lint dirigido zero erros, com um aviso TanStack preexistente. São execuções dirigidas distintas, sem soma nem alegação de suíte global. Cobertura inclui faceta fora da primeira página, catálogo sem uso, null/sentinels/legados, contextos explícitos, ACL/revogação, mudança de origem com reidratação e polling/resposta antiga.
2026-10-23 v3 — QA final APPROVED / GO STAGING. Gates globais: typecheck oficial exit0/9,596 s com hash independente; lint exit0/50,58 s, zero erros/1.183 avisos; build exit0/99,4 s, pico agregado 7.354.613.760 bytes abaixo de 7 GiB; suíte exit0/58,95 s, 751 arquivos/6.156 PASS/zero falhas/quatro skipped/um todo (6.161 totais). Primeiras falhas foram preservadas: três spreads unknown nos testes corrigidos com guard real; teste legado de exclusão deixou a string de implementação e passou a verificar cenários DOM de erro/vazio/exclusão/filtro. Nenhuma correção runtime foi necessária para essas duas falhas; detalhes em known-errors.
Integração de `f51b753b` (17 caminhos financeiros disjuntos) sem conflito: 14 caminhos próprios byte-idênticos; typecheck exit0/23,44 s, lint em 17 fontes exit0/2,65 s e 18 arquivos/235 testes PASS/zero falhas em 2,89 s, fonte `52678…` idêntica antes/depois. Estes 235 são dirigidos, não uma nova suíte global. Lens/Anubis: zero bloqueantes/importantes. Probe local com componente Radix/helper/CSS reais: Instagram roxo, Site azul, Callix estável, sentinels distintos, teclado e controle 342×44 em viewport de 390 px; zero erros de página e zero requisições API. É prova de apresentação/seleção local, não E2E autenticado no staging.
Evidências privadas em `/var/tmp/alpha-crm-filtro-origem-20261023/`: resultados Forge por tentativa, `probe/probe-result.json`, `release/integration-f51.json` e fechamento QA. Commit/push, deployment READY/alias e smoke Admin remoto pendentes; resultados posteriores ficam nas provas privadas sem commit documental recursivo. Sem banco/schema/migration/ENV, novas origens cadastradas ou produção autorizada.
