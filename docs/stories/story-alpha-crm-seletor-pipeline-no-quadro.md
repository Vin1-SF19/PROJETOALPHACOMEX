# Story: trocar de pipeline pelo cabeçalho do quadro CRM

**Status:** Done
**Data:** 2026-10-16
**Origem:** solicitação direta do usuário nesta sessão.

## Objetivo e contexto

Como usuário do Alpha CRM, quero selecionar outro funil ao lado do filtro de vínculos/responsável no topo do quadro, para navegar diretamente entre os funis disponíveis sem retornar à listagem do CRM.

O quadro já tem um único select de responsáveis e utiliza a rota `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]`. A mudança acrescenta a navegação nesse mesmo cabeçalho e conserva as regras existentes de acesso e de leitura por pipeline. “Trocar de pipeline” significa abrir o quadro selecionado; não significa transferir cards entre funis.

## Critérios de aceite

1. O cabeçalho de cada quadro exibe um select de funil imediatamente ao lado do select existente de vínculos/responsável. O filtro atual mantém suas opções e comportamento.
2. O select identifica o funil atualmente aberto e apresenta os demais funis ativos acessíveis à sessão. Nomes e IDs vêm da listagem autorizada canônica; não há nomes de funis, usuários, cargos ou IDs fixados no componente.
3. A origem da lista aplica as verificações existentes de sessão, módulo CRM e acesso ao pipeline. Funis inativos ou sem acesso não são introduzidos por fallback; uma falha de listagem não expõe opções fabricadas nem libera acesso.
4. Selecionar outro funil navega diretamente para a rota existente desse pipeline, sem passar pela página de seleção de funis. Selecionar o próprio funil não dispara navegação adicional.
5. A nova página carrega o quadro e o manifesto do pipeline de destino por seus consumidores canônicos. Busca, responsável selecionado, card aberto, paginação e demais estados locais do pipeline anterior não contaminam o destino; a montagem já identificada por `key={pipelineId}` deve continuar assegurando o isolamento.
6. O seletor informa o carregamento da navegação e impede solicitações concorrentes enquanto a troca está pendente. Também não inicia troca durante arrasto, movimentação pendente ou confirmação de movimento do quadro que ainda precise ser resolvida.
7. O controle possui nome acessível, operação por teclado, foco visível e disposição responsiva compatível com o cabeçalho. A lista pode conter poucos ou muitos funis sem depender de largura fixa para o nome completo.
8. A navegação não modifica cards, vínculos, responsáveis, etapas, configuração, schema ou permissões. O acesso ao destino continua sendo verificado no servidor mesmo quando a URL é acessada diretamente ou a lista fica desatualizada.
9. Testes focais demonstram a integração entre a página servidora, a lista autorizada e a seleção no cliente, incluindo ausência de navegação inválida e estado ocupado. Os gates do projeto são executados e seus resultados reais, limitações e eventual baseline são registrados.

## Orientação de implementação e fontes verificadas

- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/page.tsx`: autentica a sessão, carrega `ObterPipelineBpm` e `SincronizarQuadroBpm` e monta `PipelineBoardClient` com `key={pipelineId}`. É o ponto de fornecimento da lista de opções ao quadro e preservação da checagem do destino.
- `src/actions/bpm/Pipelines.ts`, função `ListarPipelinesBpm`: a listagem existente exige sessão e módulo, busca pipelines ativos por padrão e filtra cada resultado com `checarAcessoBpmPipeline`. Reutilizar a política canônica; evitar introduzir uma segunda regra de autorização no cliente. Se houver extração de listagem leve para o seletor, manter as mesmas verificações e não carregar contagens de cards sem necessidade para essa navegação.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`: contém o filtro `filtroResponsaveis`, o select com nome acessível “Filtrar cards por responsável”, `router`, estados de arrasto/movimento e cabeçalho responsivo. Integrar o novo controle sem retirar o filtro existente ou alterar o protocolo de movimentação RD.
- `src/components/ui/select.tsx`: componente Select já utilizado no cabeçalho; manter o padrão visual e a acessibilidade existentes.
- `docs/stories/story-alpha-crm-visao-equipe-pipeline.md`, seção “Correção solicitada após publicação”: determina o select único de responsáveis e o catálogo/escopo autorizados. O novo controle tem a finalidade distinta de navegação entre funis e não recria um seletor de visão.
- `docs/stories/story-alpha-crm-refresh-manual-pipeline.md`, critérios de aceite: o botão Atualizar pertence ao mesmo cabeçalho e não deve disputar uma movimentação. Preservar esse comportamento.
- `.bibble/memory/codebase-map.md`, seção “Alpha CRM — Padronizar layout dos pipelines do quadro Kanban”: preservação do contêiner flexível, altura e rolagem do quadro ao adicionar o controle.

Não são necessárias novas variáveis de ambiente, dependências, migrations, backfills ou operações de banco. A verificação começa por testes via CLI e observação do contrato existente. Navegação e estado de interface constituem o escopo desta story; nenhuma nova operação de domínio é criada.

## Tarefas

- [x] Confirmar os pontos de integração da listagem autorizada, página, filtro existente e estados de movimento.
- [x] Fornecer à página/quadro a lista mínima de funis ativos acessíveis com a autorização canônica.
- [x] Acrescentar o seletor adjacente ao filtro existente, com valor atual e navegação direta.
- [x] Tratar seleção atual, destino fora da lista, navegação pendente, arrasto e movimentação pendente.
- [x] Preservar a remontagem por pipeline e o isolamento dos estados locais.
- [x] Implementar e executar testes focais de página/listagem e interação React.
- [x] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.
- [x] Executar revisão QA, atualizar esta checklist, evidências e File List.

## Matriz mínima de validação

| Cenário | Resultado esperado |
| --- | --- |
| Página de um funil acessível com vários destinos | Select mostra o atual e apenas as opções autorizadas fornecidas pelo servidor |
| Seleção de outro destino autorizado | Uma navegação para `/PainelAlpha/AlphaCRM/pipeline/<id>`; nenhuma mutação de card |
| Seleção do próprio destino ou valor ausente da lista | Nenhuma navegação adicional |
| Listagem sem sessão, sem módulo, com pipeline negado ou inativo | Nenhuma opção indevida é exposta; política canônica mantida |
| Lista vazia ou falha da consulta | Estado coerente sem opções artificiais ou ampliação de acesso |
| Navegação em andamento, arrasto ou movimento pendente | Controle indisponível e sem navegação concorrente |
| Mudança real do parâmetro da rota | Novo quadro/manifesto e estado local inicial do destino |
| Teclado e cabeçalho estreito | Controle identificado e operável; layout permite quebra sem sobrepor ações |

Usar fixtures sintéticas. Testes de autorização devem verificar a chamada da política/consulta real apropriada, sem substituir a própria lógica sob teste por uma lista já filtrada. Testes de seleção devem exercitar o comportamento do controle, além de eventuais contratos de fonte. Caso não haja navegador autenticado, registrar essa limitação e não declarar validação visual/produção.

## CodeRabbit Integration

- **Tipo:** Frontend; adicional Integration/Security pela reutilização da lista autorizada. Complexidade baixa a média, sem novo modelo de dados.
- **Agentes:** @dev executa; @qa revisa autorização, navegação, estado e regressões. @ux-expert é pertinente apenas se surgir decisão visual adicional. Operações remotas, se autorizadas posteriormente, pertencem a @devops.
- **Pre-Commit:** testes focais, quatro gates do projeto e revisão de acessibilidade/consistência do cabeçalho. Pre-PR/Pre-Deployment aplicam-se somente se essas etapas forem solicitadas.
- **Self-Healing:** @dev em modo light, no máximo duas iterações/15 minutos; corrigir CRITICAL e registrar/avaliar HIGH com os agentes pertinentes. Não declarar revisão CodeRabbit se a CLI estiver indisponível; registrar a indisponibilidade real e a revisão alternativa efetuada.
- **Foco:** fonte autorizada, ausência de fallback permissivo, isolamento por pipeline, competição com movimento e navegação, teclado e layout responsivo.

## Validação da preparação — @sm

Checklist `.aiox-core/product/checklists/story-draft-checklist.md` aplicado em modo autônomo à solicitação direta. Os documentos genéricos `docs/framework/*` configurados no AIOX não estão disponíveis; a orientação foi fundamentada nos arquivos e stories existentes identificados acima. Nenhuma integração externa de tracking é necessária para esta entrega local.

| Categoria | Resultado |
| --- | --- |
| Objetivo e contexto | PASS |
| Orientação técnica | PASS |
| Referências | PASS |
| Informação autocontida | PASS |
| Testes | PASS |
| Integração CodeRabbit | PASS — plano definido; execução ainda não realizada |

**Preparação: READY**, clareza 9/10. Não há dependência bloqueante identificada. Este resultado avalia a preparação da story, sem aprovar código ou afirmar execução de testes, revisão de aplicação ou publicação.

## Dev Agent Record

A página reutiliza `ListarPipelinesBpm()` com filtro padrão de ativos e política por pipeline, repassando somente `id`/`nome`. O controle `SeletorPipelineBoard` foi inserido imediatamente após o filtro de responsáveis. A navegação usa a rota existente e `useTransition`; não há alteração de cards ou de banco. Seleções atuais/inválidas são ignoradas. Durante arrasto, movimento ou modal aberto o controle fica desabilitado. A `key={pipelineId}` foi preservada para reiniciar o estado e encerrar assinaturas do quadro anterior.

Validação inicial: 43 testes focais passaram; suíte global: 643 arquivos, 4.810 testes PASS, 4 skipped e 1 todo. Lint exit 0, com 1.193 avisos preexistentes e zero erros. Typecheck e build de produção exit 0. O typecheck inicial identificou um fixture incompleto (`data: []` ausente no retorno de erro da listagem); o fixture foi corrigido e os três testes da página foram repetidos com sucesso. Não houve falha no código de produção. Testes adicionais de autorização da listagem real e de navegação suspensa foram acrescentados após revisão; resultados finais abaixo.

Não há navegador autenticado disponível: os testes React usam happy-dom e adaptador dos primitives Select, enquanto teclado/foco reutilizam o Radix canônico. Não se declara validação visual com sessão real. CodeRabbit CLI indisponível; revisão QA independente do agente e execução independente dos testes são a alternativa registrada. Publicação pertence ao DevOps.

## File List

- `docs/stories/story-alpha-crm-seletor-pipeline-no-quadro.md` — criada na preparação.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/page.tsx` — lista autorizada e dados mínimos de navegação.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` — integração no cabeçalho e guards de atividade.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/SeletorPipelineBoard.tsx` — seletor dinâmico com transição e estado acessível.
- `tests/bpm/board-visao-equipe-react.test.ts` — regressão do filtro e interação/guard do novo seletor.
- `tests/bpm/pipeline-page-seletor.test.ts` — lista, projeção, chave de remontagem e revalidação do destino.
- `tests/bpm/seletor-pipeline-pendente-react.test.ts` — transição React real suspensa, aviso e bloqueio concorrente.
- `tests/bpm/listar-pipelines-seletor.test.ts` — ação real de listagem, sessão, módulo, ativos e política por funil.


### Validação final

- `npm test`: exit 0; 645 arquivos, 4.820 testes PASS, 4 skipped e 1 todo (nova execução após os testes adicionais).
- QA reexecutou independentemente os quatro focais iniciais (43 PASS) e os dois arquivos adicionais (10 PASS).
- O teste de transição usa React `useTransition`/`Suspense` reais com Promise controlada, verificando carregamento, `aria-busy`, anúncio, bloqueio da segunda seleção e liberação ao resolver.
- A ação real de listagem e seu contador real foram testados com delegates isolados: sessão, módulo, ativos, política por item, contagem só dos permitidos e falhas sem exposição parcial.
- Build de produção exit 0 (80 páginas); avisos de dependências já existentes. Nenhuma fonte de produção mudou depois do build.
- Smoke local compilado: página inicial e providers HTTP 200, CRM sem sessão redireciona como previsto. Processo encerrado após verificação; sem sessão autenticada nem validação visual declarada.

## QA Results

### Revisão final — Quinn (QA), 2026-10-16

**Gate: PASS. Parecer: APPROVED.** Nenhum CRITICAL/HIGH ou defeito funcional permanece aberto no escopo revisado. Os quatro gates finais foram concluídos com saída 0, com evidências conferidas pelo QA.

- **AC 1–4 e 8:** integração imediatamente após o filtro de responsáveis, uso de `ListarPipelinesBpm()` sem incluir inativos e projeção somente de `id`/`nome` verificados. A ação real de listagem e seu contador foram exercitados, preservando sessão, módulo, política por pipeline e contagem apenas dos permitidos. Falhas não devolvem opções brutas ou parciais. A seleção atual e destinos fora da lista não navegam; o destino continua sujeito à autorização servidora existente.
- **AC 5–6:** `key={pipelineId}` e consumidores canônicos do destino preservados. Os guards do quadro cobrem arrasto, movimento e modais pendentes. Teste com `useTransition` e `Suspense` reais demonstrou estado ocupado, segunda seleção ignorada e liberação após a resolução da navegação. A funcionalidade não cria operação de domínio nem altera dados do card.
- **AC 7:** nome acessível, `aria-busy`, anúncio de carregamento, foco do componente Radix existente e contêiner responsivo revisados no código. Testes React verificam anúncio e estado do controle; teclado e apresentação visual em navegador autenticado não foram inspecionados.
- **AC 9:** duas lacunas da primeira revisão foram encerradas com testes da listagem real e da navegação suspensa. O QA executou independentemente os quatro arquivos focais iniciais (**43 PASS**) e os dois adicionais (**10 PASS**). Checklist e File List conferidos; mudança do status e fechamento da checklist pertencem ao executor.

| Gate final | Resultado conferido |
|---|---|
| `npm test` | **PASS:** 645 arquivos, 4820 testes aprovados, 4 skipped e 1 todo; `../pipeline-switch-tests.log`. |
| `npm run typecheck` | **PASS:** zero erros após correção de fixture; `../pipeline-switch-typecheck.log`. |
| `npm run lint` | **PASS:** zero erros e 1193 warnings preexistentes; `../pipeline-switch-lint.log`. |
| `npm run build` | **PASS:** saída 0, 80 páginas, fontes de produção preservadas após o build; `../pipeline-switch-build.log`. |
| `git diff --check` | **PASS**, executado pelo QA sem erros de whitespace. |

Os logs acima ficam em `/home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/`. Smoke do artefato compilado, realizado pelo DevOps, confirmou respostas públicas e redirecionamento do CRM sem sessão. **Não houve inspeção visual autenticada.** CodeRabbit indisponível, conforme registro do executor. Nesta revisão o QA alterou somente esta seção; não executou mutação de banco, commit, push ou deploy.


### Publicação verificada

DevOps publicou o commit `40bd0541cfd9572dd7a0c112db5c0462f30c7c2b` em 2026-10-16. Deployment `dpl_C3LDiVAzF7xEh6SSkArJ6Jm4oJNY` READY, alias `https://painel.alpha-comex.com` atualizado e health HTTP 200 com o SHA exato às 18:28:32 UTC. Smoke público aprovado; zero erros de requests encontrados nessa verificação. Nenhuma mutação de negócio executada para o smoke. Evidência operacional privada: `../painel-alpha-worktrees/pipeline-switch-production-verification.json`. Arquivos temporários de ambiente removidos do checkout isolado. O registro pós-publicação foi acrescentado somente ao workspace principal, sem criar novo deploy de documentação.
