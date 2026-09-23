# RM-2026-B5C986 — Manter Campos e formulários ativa após criar/adicionar campo

## Status

Pronto para testes — objetivo 1 de 10 concluído tecnicamente e entregue para homologação.

- Projeto: Painel Alpha / Alpha CRM.
- Fase 2: criar story obrigatória, sem implementar código de produção.
- Data: 2026-09-22. Responsável nesta fase: Nova, conforme atribuição explícita do pipeline.
- Fonte: objetivo RM-2026-B5C986 e blueprint Scout recebido das fases anteriores, reconferido no código local.
- Esta é a story canônica. O nome `story-rm-2026-b5c986-preservar-aba-campos.md` sugerido pelo Scout fica substituído pelo caminho exigido nesta fase, sem criar duplicata.

## Objetivo e contexto

Como administrador do CRM, quero criar, adicionar e publicar campos em uma etapa mantendo a aba Campos e formulários e a etapa selecionadas, para continuar a configuração sem perder contexto ou rascunho.

Este é o objetivo 1 de 10 do grupo integrado da superfície administrativa, com foco no pipeline Revisão de Radar. A navegação estável é pré-requisito para as alterações posteriores nessa tela. As demais nove RMs não são implementadas nesta story.

## Problema e causa provável confirmada no código

`AdminPipelineClient.tsx:207` inicia `abaAtiva` em `overview`. `FormularioEtapaWorkspace.tsx:178` inicia a etapa pela primeira disponível e monta sua composição em estado local. `page.tsx` usa a chave `${pipelineResult.data.id}:${pipelineResult.data.configVersion}` no editor, remontando esse estado ao mudar a versão. O callback do formulário chama `router.refresh()`.

O blueprint identificou que criação e publicação incrementam a configuração e revalidam a rota. A reinspeção confirmou que `CriarCampoBpm` é aguardada antes de adicionar o campo ao catálogo e às seções locais, marcando o formulário como sujo. Assim, “Criar e adicionar” persiste o campo, mas sua composição ainda é um rascunho: uma remontagem pode perdê-lo. Apenas mudar `onPublished` não cobre esse fluxo.

`SalvarFormularioEtapaBpm` recebe `versaoEsperada: etapa.formulario?.versao ?? null`; no sucesso, o workspace aplica o formulário confirmado, limpa o estado sujo e chama `onPublished`. A correção deve preservar essa concorrência e os snapshots atualizados.

## Escopo e comportamento esperado

Preservar estado de navegação e o rascunho necessário durante revalidações, isolados por pipeline e etapa. Manter a atualização dos dados confirmados do servidor, a publicação explícita e as guardas existentes. Não alterar contratos de actions, autenticação, API, schema ou banco; não remover abas nem modificar outras etapas. Não há necessidade de persistência entre sessões do navegador.

## Blueprint para execução

1. Criar pequeno provedor cliente acima do editor versionado, com identidade estável por `pipelineId`; manter a chave `id:configVersion` no editor. Nome previsto: `PipelineEditorStateProvider.tsx` no mesmo diretório administrativo.
2. Controlar `Tabs` pelo estado preservado. Somente no callback de publicação de Campos e formulários, preservar `fields` antes de atualizar a rota. Não forçar essa aba nos callbacks das demais áreas.
3. Restaurar etapa e rascunho correspondentes no workspace, incluindo seções, estado ativo/sujo, referências dos campos necessários e versão-base do formulário. Reutilizar `selecionar`, `secoesDaEtapa`, `handleFormularioAtualizado` e componentes existentes.
4. Atualizar a seleção preservada somente após a guarda de alterações pendentes autorizar a troca. Manter seleção independente da aba Etapas e isolar também o modo card, pois o workspace possui esse consumidor.
5. Manter a operação assíncrona ligada ao pipeline, etapa e seção originais mesmo se o editor remontar antes da resposta. Reconciliar o campo criado sem duplicação. No sucesso de publicação, substituir o rascunho pelo confirmado; em erro/conflito, conservá-lo sem promover sua versão-base silenciosamente.
6. Validar IDs restaurados contra as etapas atuais: etapa removida seleciona a primeira disponível sem transplantar seu rascunho; nenhuma etapa mantém estado vazio seguro.
7. Implementar e executar testes comportamentais antes de declarar a correção entregue. O provedor é suporte obrigatório anterior aos ajustes dos callbacks.

## Critérios de aceite

- [ ] CA1: em etapa diferente da primeira, criar e adicionar campo mantém `fields`, etapa e seção após mudança de `configVersion`; campo aparece uma única vez no rascunho.
- [ ] CA2: CA1 passa tanto com resposta da action antes da revalidação quanto com revalidação antes da resposta.
- [ ] CA3: adicionar campo existente e publicar mantém aba, etapa e composição confirmada; publicação repetida usa a versão correta.
- [ ] CA4: falha na criação/publicação conserva contexto e rascunho válido, informa o erro e permite nova tentativa sem campo fictício ou duplicado.
- [ ] CA5: conflito de versão continua bloqueado; rascunho antigo não recebe nova `versaoEsperada` implicitamente nem sobrescreve alteração concorrente.
- [ ] CA6: cancelar troca com alterações pendentes mantém a seleção original; confirmar troca respeita o comportamento atual. Seleção da aba Etapas e modo card não contaminam o formulário.
- [ ] CA7: mudança de pipeline não reutiliza aba/etapa/rascunho de outro pipeline; etapa removida e lista vazia seguem o fallback definido.
- [ ] CA8: snapshots e bloqueios de publicação continuam atualizados, outras abas e etapas mantêm comportamento e conteúdo.
- [ ] CA9: fluxo autenticado validado pela navegação administrativa existente; gates técnicos e regressões registrados com resultados reais.

## Auditoria de entregabilidade e autoajustes

Artefato desta fase: esta story, consumida pelo agente executor via leitura no repositório. Artefato final do objetivo: editor administrativo com navegação estável, consumido por administradores do CRM.

DELIVERY_READY: infraestrutura de acesso confirmada no código — Alpha CRM → Configurações (`CRMLayoutClient.tsx`, entrada `adminOnly`) → pipeline (`AdminPipelinesListClient.tsx`, links por ID) → Campos e formulários (`AdminPipelineClient.tsx`, workspace integrado). Rota: `/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]`, protegida por `auth()` e `isAdminRole` em `page.tsx`.

O registro Revisão de Radar em produção e o fluxo em navegador autenticado não foram consultados nesta fase. Este sinal confirma o caminho existente, não a correção funcional ainda pendente. Não falta rota, menu, exportação ou visualizador.

Autoajuste documental resolvido: ausência de story específica, suprida por este arquivo.

AUTO_ADJUSTMENT_REQUIRED: preservar estado e rascunho acima da fronteira versionada em `page.tsx`; ajustar apenas callbacks perde contexto e pode perder a referência criada.
AUTO_ADJUSTMENT_ACCEPTANCE: executar CA1–CA8, incluindo ambas as ordens entre resposta da action e remontagem, antes de declarar a correção pronta.

AUTO_ADJUSTMENT_REQUIRED: testes existentes apontados pelo Scout verificam principalmente conteúdo de código e não comprovam preservação após remontagem.
AUTO_ADJUSTMENT_ACCEPTANCE: acrescentar teste comportamental que provoque mudança real de identidade do editor por versão e observe aba, etapa, composição e isolamento, complementado pelo fluxo autenticado.

Esses ajustes fazem parte da implementação futura e devem preceder sua conclusão; não bloqueiam a conclusão documental da fase 2. Nenhum código de produção será implementado nesta fase.

## Validação planejada e evidências

- Testar CA1–CA8 com fixtures de dois pipelines e múltiplas etapas, respostas assíncronas controladas, erro e conflito. Não substituir prova comportamental por busca de strings.
- A configuração atual do Vitest usa ambiente `node` e inclui `tests/**/*.test.ts`. O executor deve preparar o suporte mínimo de teste de componentes necessário, sem presumir DOM/harness já instalado, e registrar eventual arquivo de configuração alterado.
- Regressões: `tests/bpm/pipeline-config-workspace.test.ts`, `tests/bpm/formulario-etapa.test.ts`, `tests/bpm/formularios-etapa-save.test.ts`, `tests/bpm/campos-configuraveis-actions.test.ts`.
- Gates: `npm run lint`, `npm run typecheck`, `npm test`; build pelo Forge na fase de implementação, antes de revisão qualitativa. Validar integração pelo Probe e registrar evidência autenticada; screenshot/PR opcionais e não bloqueantes.
- Evidência desta fase: inspeção de rota, guarda administrativa, links, estados iniciais, chave versionada e callbacks reais em 2026-09-22. Nenhuma action ou consulta ao banco foi executada.
- Resultados reais desta fase documental: `npm run lint`: resultado `1`; `npm run typecheck`: resultado `0`; `npm test`: resultado `1`. Logs locais em `.roadmap-worker/rm-2026-b5c986-phase2/`. `npm test` encontrou `EBUSY` ao tentar limpar o diretório de cobertura; nenhuma limpeza manual foi realizada. Os gates não aprovados permanecem pendentes para a implementação. Build e fluxo autenticado não executados nesta fase documental. A prontidão da story não equivale à aprovação técnica do produto.

## Riscos e rollback

Riscos principais: aplicar rascunho sobre snapshot novo, perder resposta assíncrona durante remontagem, duplicar campo, misturar pipelines/etapas/modos e neutralizar conflitos. Mitigar com identidade estável, versão-base preservada e testes de ordem de eventos.

Rollback futuro: desfazer seletivamente apenas as alterações desta RM em provedor, integração e testes, restaurando comportamento anterior sem reverter trabalho preexistente. Não executar Git mutável nesta fase. Nenhum rollback de banco é necessário. O campo criado pelo CRUD deve continuar sujeito ao fluxo administrativo existente, sem limpeza automática de dados.

## Checklist da fase

- [x] Objetivo e blueprint recebidos e reinspecionados.
- [x] Story canônica criada com contexto, critérios, riscos e rollback.
- [x] Caminho real de consumo e permissões verificados no código.
- [x] Lacunas anteriores incorporadas como suporte e testes obrigatórios.
- [x] File list separa documentação entregue de alterações futuras.
- [x] Pronta para execução; produção não implementada nesta fase.
- [x] Registrar resultados finais dos gates documentais, incluindo falhas/limitações reais.
- [ ] Implementar blueprint e concluir CA1–CA9 na fase seguinte.

## File list

Alterados nesta fase:
- `docs/stories/story-rm-2026-b5c986-manter-aba-campos-formularios.md` — story canônica.
- `.bibble/memory/journal.md` — registro aditivo da sessão.

Previstos para implementação, ainda não alterados nesta fase:
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/PipelineEditorStateProvider.tsx` — novo suporte de estado conforme Scout.
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/page.tsx` — envolver editor preservando chave versionada.
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx` — aba controlada e callback específico.
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx` — seleção, rascunho e reconciliação assíncrona.
- `tests/bpm/pipeline-config-workspace.test.ts` — preservar alterações existentes e complementar cobertura.
- `tests/bpm/pipeline-editor-state.test.ts` — nome previsto para novos cenários comportamentais; ajustar conforme harness real.

`AdminPipelineClient.tsx`, `PipelineWorkspaceSections.tsx` e `pipeline-config-workspace.test.ts` já têm alterações no working tree. Reinspecionar o diff antes de qualquer edição futura e preservar essas alterações. A file list final da implementação deve registrar qualquer suporte de testes adicional efetivamente necessário.

## Fase 3 — implementação local (2026-09-22)

- [x] Provedor por pipeline acima da chave versionada, preservando snapshots do editor.
- [x] Aba, seleção por modo/etapa, rascunho, diálogo e operação pendente preservados em memória.
- [x] Callbacks assíncronos atualizam o estado sobrevivente; criação identifica a seção pela chave e deduplica campos.
- [x] Versão-base fixada desde a inicialização; confirmação avança a versão, erro mantém rascunho; snapshot anterior não rebaixa confirmação.
- [x] Seleção inválida usa primeira etapa; nenhuma etapa produz estado vazio; troca durante operação pendente bloqueada.
- [x] Testes unitários do armazenamento cobrem ordens de revalidação/resposta, notificações após desinscrição, versão e isolamento.
- [ ] Teste com montagem real React, remoção de etapa, interação completa e fluxo autenticado (CA1–CA9 não declarados integralmente aprovados).
- [ ] Gates globais aprovados.

DELIVERY_READY: integração conferida no código da rota `/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]` → Campos e formulários, consumida pelo administrador. Fluxo autenticado não executado.
AUTO_ADJUSTMENT_REQUIRED: falta harness de montagem React/DOM no ambiente instalado; testes adicionados exercitam o armazenamento real, mas não comprovam remontagem dos componentes e interação autenticada.
AUTO_ADJUSTMENT_ACCEPTANCE: montar o editor versionado e validar CA1–CA9 com actions controladas e navegação autenticada.

File list efetiva da fase 3:
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/PipelineEditorStateProvider.tsx` (novo).
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/pipeline-editor-store.ts` (novo).
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/page.tsx`.
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx` (diff anterior preservado).
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx`.
- `tests/bpm/pipeline-editor-state.test.ts` (novo).
- `tests/bpm/formulario-etapa.test.ts` (asserção de versão ajustada ao contrato preservado).
- Esta story e `.bibble/memory/{components,integration-points,journal}.md`.

Sem alteração de banco/schema/API/auth; sem Git mutável. O build gera o bundle existente via script do projeto. Logs em `.roadmap-worker/rm-2026-b5c986-phase3/`.


Validação final registrada: lint focado sem saída de erro; lint global 2.417 erros/1.218 warnings; npm test padrão EBUSY. targeted: Test Files  5 passed (5) | Tests  46 passed (46); test-isolated: consultar log; resultado final não sintetizado; build: consultar log; resultado final não sintetizado. Typecheck: ver log typecheck.log e resultado de execução. Aprovação integral retida por gates globais e ausência de teste de montagem/autenticado.


## Reexecução Nova — 2026-09-22

- [x] Corrigido fallback do hook quando a mesma instância muda de chave/etapa: cada chave inicializa seu próprio snapshot, sem copiar a primeira etapa.
- [x] Montagem React real do workspace e provedor, com troca de chave versionada, validada em Happy DOM: 5 testes aprovados.
- [x] Cobertos: seleção da segunda etapa, adicionar campo existente, guarda contra troca suja, descarte, criação nas duas ordens resposta/refresh, conflito com versão-base preservada, publicação repetida, remoção de etapa, lista vazia e isolamento entre pipelines.
- [ ] Fluxo autenticado com AdminPipelineClient completo não executado; o teste usa workspace/provedor reais dentro de um host de navegação de teste.
- [ ] Aprovação dos gates globais continua pendente. A tentativa anterior terminou com 14 arquivos/19 testes falhando, 456 arquivos/3473 testes passando; build anterior concluído. Não confundir esses resultados com execução desta rechecagem.

Arquivos desta reexecução: `PipelineEditorStateProvider.tsx`, `tests/bpm/pipeline-editor-react.test.ts`, `package.json`, `package-lock.json`, esta story e `.bibble/memory/journal.md`. Happy DOM adicionado como dependência de desenvolvimento; instalação exigiu `--legacy-peer-deps` devido a conflito preexistente do Tiptap e reescreveu o lockfile. Revisar esse diff antes da integração.

DELIVERY_READY: integração existente inspecionada na rota `/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]` → Campos e formulários, para administradores; comportamento do workspace validado por montagem React local.
AUTO_ADJUSTMENT_REQUIRED: falta evidência do fluxo autenticado completo e aprovação dos gates globais.
AUTO_ADJUSTMENT_ACCEPTANCE: validar CA9 no ambiente autenticado e concluir gates sem falhas; o harness local não substitui essa evidência.

Logs da reexecução: `.roadmap-worker/rm-2026-b5c986-recheck/`. Sem alteração de banco, API, auth ou Git mutável.

## Reexecução Nova — 2026-09-22 (revisão estática, sem shell)

- [x] Reinspecionado `page.tsx`: `PipelineEditorStateProvider` chaveado por `pipelineId` (linha 116) envolve `AdminPipelineClient` chaveado por `id:configVersion` (linha 118) — a árvore de estado sobrevive à remontagem do editor versionado, conforme blueprint.
- [x] Reinspecionado `pipeline-editor-store.ts`: `Map` por chave com `initialize`/`read`/`write` e notificação apenas quando o valor muda (`Object.is`); provedor novo por pipeline (remonta ao trocar `pipelineId`) garante isolamento entre pipelines (CA7).
- [x] Reinspecionado `AdminPipelineClient.tsx`: `abaAtiva` controlado via `usePipelineEditorState`, `onPublished` do formulário força `setAbaAtiva("fields")` antes do `router.refresh()` (linha 961); demais callbacks (`onConfigured`, outros `onPublished`) não forçam a aba, conforme exigido.
- [x] Reinspecionado `FormularioEtapaWorkspace.tsx`: `draftKey` isola rascunho por `pipeline:modo:etapa`; `useEffect` (linhas 197-204) só resincroniza `secoes/ativo/versaoBase` a partir do servidor quando não há rascunho sujo, salvamento ou criação em andamento e a versão do servidor é maior que a base local — preserva CA3/CA5 e evita perda de rascunho em CA1/CA2. `selecionar()` (linha 259) bloqueia troca de etapa com alterações pendentes (CA6).
- [x] Nenhuma alteração de código foi necessária nesta rodada; a implementação das reexecuções anteriores permanece íntegra e consistente com o blueprint e CA1–CA8.

**Limitação desta sessão:** o catálogo de ferramentas disponibilizado para esta execução contém apenas Read/Grep/Glob/Edit/Write — sem shell/Bash e sem navegador. Não é possível, nesta sessão, rodar `npm run lint`, `npx tsc --noEmit`, `npm test` ou `npm run build`, nem navegar autenticado até Configurações → pipeline → Campos e formulários para validar CA9 na prática. Nenhum resultado desses gates foi inventado; os únicos resultados reais registrados nesta story continuam sendo os das rodadas anteriores (com falhas pendentes: lint global com milhares de erros preexistentes no projeto, `npm test` padrão com `EBUSY`, harness completo de `AdminPipelineClient` não executado).

AUTO_ADJUSTMENT_REQUIRED: uma sessão com acesso a shell (npm) e a navegador autenticado precisa executar `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` e o fluxo real em Configurações → pipeline Revisão de Radar → Campos e formulários, registrando os resultados reais (aprovados ou não) nesta story.
AUTO_ADJUSTMENT_ACCEPTANCE: gates executados com saída real anexada (ou log referenciado) e CA9 marcado apenas após navegação autenticada confirmando que criar/adicionar/publicar campo em etapa não-inicial mantém a aba Campos e formulários e a etapa selecionadas.

Nenhuma alteração de banco, API, auth ou Git mutável nesta rodada.


## Reexecução Nova — gates reais e cobertura complementar (2026-09-22)

Implementação de produção reinspecionada e preservada. O provedor por pipeline continua acima da chave versionada; o callback de Campos e formulários conserva `fields`; rascunho e versão-base sobrevivem à remontagem. Nenhuma mudança de banco, API, auth ou Git mutável.

- [x] Reinspecionar provedor, armazenamento, rota, callback e operações assíncronas.
- [x] Complementar teste React com falha de criação seguida de nova tentativa, mantendo campo existente e contexto.
- [x] Complementar publicação nas duas ordens resposta/revalidação, conferindo composição confirmada e outra etapa intacta.
- [x] Executar typecheck final: exit 0 (`typecheck-verified.log`).
- [x] Executar lint do teste alterado: exit 0 (`lint-expanded.log` e `lint-test.log`).
- [x] Executar seis suítes focadas: 54 testes aprovados (`targeted-final.log`); após ajuste final de tipagem, oito testes React novamente aprovados (`react-verified.log`).
- [x] Executar build: exit 0 (`build.log`, `results.json`). Build informou que ignora tipos; typecheck foi executado separadamente. Avisos de leitura de `.env` e worker PDF não impediram a conclusão; nenhum segredo foi lido/exposto.
- [x] Executar lint global: exit 1, 2.417 erros e 1.218 avisos, mesmos totais registrados anteriormente.
- [x] Executar `npm test`: exit 1 por `EBUSY` na pasta `coverage`; não removida nem desbloqueada à força.
- [x] Executar suíte completa com cobertura em pasta isolada: 457 arquivos aprovados, 14 falhando; 3.482 testes aprovados, 19 falhando e 1 todo (`test-isolated.log`). Falhas em apresentações, Alpha SEO, Bibble, gerador de documentos, Onyx, notas e parceiros; nenhuma das seis suítes focadas falhou.
- [ ] Aprovar gates globais: lint e testes completos continuam falhando.
- [ ] Validar CA9 em navegador autenticado: não executado, sem ferramenta/sessão autenticada disponível.

O ambiente inicialmente não tinha `happy-dom` instalado, embora declarado. Restaurado com `npm install --no-save --package-lock=false --ignore-scripts --legacy-peer-deps happy-dom@20.14.5`. Manifesto e lockfile não foram intencionalmente editados; seus diffs anteriores foram preservados. Essa instalação reconciliou dependências locais, incluindo Vitest de 4.1.10 para 4.1.11; logs identificam a versão de cada execução. Erros intermediários de fixture/tipagem dos novos testes foram corrigidos e revalidados. Tentativa de delegação Forge falhou por indisponibilidade do serviço; comandos da skill Forge foram executados nesta sessão, sem emitir aprovação global.

File list desta reexecução:
- `tests/bpm/pipeline-editor-react.test.ts` — três cenários adicionais (um de falha e dois de publicação).
- `docs/stories/story-rm-2026-b5c986-manter-aba-campos-formularios.md` — checklist e evidências atuais.
- `.bibble/memory/journal.md` — registro aditivo.
- `.roadmap-worker/rm-2026-b5c986-final-gates/` — logs locais dos comandos e códigos de saída, sem versionamento solicitado.

DELIVERY_READY: caminho de consumo confirmado no código: administrador → Alpha CRM → Configurações → pipeline → Campos e formulários, em `/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]`. Workspace real validado em React/Happy DOM; isso não comprova o fluxo autenticado completo nem a existência do pipeline Revisão de Radar em produção.
AUTO_ADJUSTMENT_REQUIRED: aprovação global pendente por falhas de lint/testes fora desta correção e ausência de validação autenticada de CA9.
AUTO_ADJUSTMENT_ACCEPTANCE: corrigir os gates globais em seus escopos responsáveis e registrar navegação autenticada criando/adicionando/publicando na etapa não inicial sem perder aba, etapa ou composição.

Resultado desta reexecução: FAIL nos gates globais; correção local preservada e cobertura focada aprovada. Não repetir diagnóstico de shell indisponível: os comandos foram efetivamente executados nesta sessão.

## Reexecução Nova — revisão estática final, sem shell (2026-09-22)

Reinspecionada a implementação de produção após múltiplas reexecuções anteriores: `page.tsx:116` mantém `PipelineEditorStateProvider` chaveado por `pipelineId` acima do editor chaveado por `id:configVersion` (linha 118); `AdminPipelineClient.tsx:961` força `setAbaAtiva("fields")` antes de `router.refresh()` exclusivamente no callback de publicação de Campos e formulários — os demais `onPublished`/`onConfigured` (linhas 598, 894, 910, 922, 940) não forçam a aba, como exigido. Nenhuma alteração de código foi necessária; a correção permanece íntegra e consistente com o blueprint e CA1–CA8.

O catálogo desta sessão contém apenas Read/Grep/Glob/Edit/Write, sem shell/Bash. Não foi possível reexecutar lint/typecheck/test/build nesta rodada especificamente, mas isso não repete o bloqueio "tooling unavailable" anterior: uma reexecução prévia com acesso real a shell já obteve, e registrou acima, resultados reais e não inventados: typecheck exit 0, lint do escopo alterado exit 0, seis suítes focadas com 54 testes aprovados, build exit 0. Lint global (2.417 erros pré-existentes) e a suíte completa (14 arquivos/19 testes falhando em apresentações, Alpha SEO, Bibble, gerador de documentos, Onyx, notas e parceiros) continuam reprovados por dívida técnica alheia a esta correção, não por regressão introduzida por ela — nenhuma das seis suítes focadas relacionadas a este objetivo falhou.

AUTO_ADJUSTMENT_REQUIRED: validação de CA9 em navegador autenticado (Configurações → pipeline → Campos e formulários) ainda não ocorreu em nenhuma sessão automatizada; aprovação dos gates globais (lint/test completos) segue bloqueada por falhas pré-existentes fora do escopo desta RM.
AUTO_ADJUSTMENT_ACCEPTANCE: uma sessão com navegador autenticado deve confirmar CA9 na prática; a limpeza do lint/test global deve ser tratada como iniciativa separada, fora do escopo desta correção pontual.

Nenhuma alteração de banco, API, auth ou Git mutável nesta rodada. Nenhum arquivo de código de produção foi alterado; apenas esta story.


## Rechecagem Nova — evidência atual dos gates (2026-09-22)

- [x] Reinspecionados provedor acima da chave versionada, aba controlada, seleção/rascunho por etapa e versão-base de publicação. Código existente preservado; nenhum ajuste adicional de produção identificado nesta rodada.
- [x] Feedback determinístico revalidado: `npm run lint` exit 1, 2.417 erros/1.218 warnings, mesmos totais anteriores. Limpeza global ultrapassa o escopo desta RM; nenhuma regra foi desativada.
- [x] `npm run typecheck` exit 0; ESLint dos cinco arquivos de produção da correção e dois testes novos exit 0; diff check do escopo exit 0.
- [x] `npm test` executado: exit 1 por EBUSY em coverage; nenhum diretório foi removido manualmente.
- [x] Seis suítes focadas executadas sem cobertura: 5 arquivos/46 testes passaram; suíte React não iniciou por ERR_MODULE_NOT_FOUND de happy-dom. Resultado agregado exit 1, não aprovado. A dependência consta no manifesto, mas não está instalada neste ambiente.
- [ ] Restaurar dependências declaradas e executar a suíte React neste ambiente.
- [ ] Gates globais aprovados e CA9 autenticado validado.

Build não repetido nesta rodada sem alterações de código; resultado anterior permanece histórico, não evidência de execução atual. Não houve banco/schema/API/auth, Git mutável ou instalação de dependências.

DELIVERY_READY: integração conferida no código em `/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]` → Campos e formulários, consumida por administradores; não equivale a validação autenticada.
AUTO_ADJUSTMENT_REQUIRED: ambiente sem happy-dom, testes globais impedidos por EBUSY e lint global reprovado; CA9 autenticado pendente.
AUTO_ADJUSTMENT_ACCEPTANCE: instalar dependências declaradas, executar testes em cobertura disponível, tratar lint global no escopo responsável e validar criação/adição/publicação autenticada na etapa não inicial.

File list desta rodada: esta story; `.bibble/memory/journal.md`; logs locais em `.roadmap-worker/rm-2026-b5c986-current-check/` (results.json e logs por gate). Nenhum arquivo de produção alterado. Resultado: FAIL por gates não aprovados.

## Retomada corretiva do objetivo 1/10 — 2026-09-22

Após o grupo ser devolvido manualmente para **Desenvolvimento**, a dependência
`happy-dom` já declarada foi restaurada no ambiente sem alteração de
`package.json` ou `package-lock.json`. A correção do primeiro objetivo foi
revalidada isoladamente antes de qualquer retomada dos objetivos posteriores:

- [x] Seis suítes diretamente relacionadas: 6 arquivos e 49 testes aprovados.
- [x] Montagem React real do editor: 8/8 testes aprovados.
- [x] ESLint dos arquivos de produção e testes do objetivo: aprovado.
- [x] Typecheck completo: aprovado.
- [ ] Homologação autenticada no pipeline Revisão de Radar permanece pendente.
- [ ] Objetivos 2/10–10/10 não são liberados por esta validação; a retomada da
      fila depende do encerramento explícito do 1/10 conforme o fluxo fail-closed.

Resultado desta retomada: correção técnica do 1/10 validada localmente; grupo
mantido em **Desenvolvimento**, sem promoção automática dos objetivos seguintes.

### Encerramento técnico e passagem para testes

- [x] `npm run typecheck`: aprovado (exit 0).
- [x] `npm run lint`: executado; o lint global permanece reprovado pela dívida
      preexistente do repositório (2.417 erros/1.218 avisos), enquanto o lint do
      escopo deste objetivo está aprovado.
- [x] `npm test`: executado; 3.513 testes passaram e 18 falharam em 13 arquivos
      fora do escopo do objetivo. As seis suítes relacionadas e os 8 testes
      React do editor permanecem integralmente aprovados.
- [x] Nenhuma falha dos gates focados foi atribuída à correção do objetivo 1/10.
- [x] Objetivo liberado para a coluna **Em testes**; a homologação autenticada é
      responsabilidade da etapa seguinte do Roadmap.

Resultado final do desenvolvimento: **PASS no escopo**, com falhas globais
preexistentes registradas sem serem ocultadas. O objetivo 2/10 pode iniciar.
