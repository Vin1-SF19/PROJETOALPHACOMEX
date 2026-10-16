# Story: Movimentação manual dos cards importados do RD com confirmação de dados pendentes

## Status

Ready for Review — hotfix do identificador RD no evento de movimento aprovado em quatro gates, revisão QA e smoke local; republicação da mesma entrega autorizada. Sem alteração de schema ou mutação de dados reais durante a investigação.

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["npm run lint", "npm run typecheck", "npm test", "npm run build", "revisao-permissoes", "regressao-movimentacao"]
```

## História

Como usuário autorizado do Alpha CRM, quero mover manualmente os cards importados do RD mesmo quando os dados obrigatórios ainda não estiverem disponíveis, após confirmar as informações pendentes, para organizar os leads nas etapas adequadas e completar os dados reais depois.

## Origem, contexto e dependências

O pedido atual exige comportamento uniforme para **todos os cards com origem RD comprovada**, em qualquer etapa ou funil. Quando houver informação obrigatória ausente conforme a configuração vigente, a interface deve identificar a pendência e oferecer **Mover mesmo assim** ou **Cancelar para preencher**. A decisão é específica da movimentação solicitada; não libera permanentemente o card nem preenche dados fictícios.

A story `story-alpha-crm-movimentacao-sem-obrigatoriedades-hardcoded.md`, em **Critérios de aceitação**, itens 2–5, e **File List**, estabelece que exigências devem vir da configuração persistida, preservando autorização e integridade. Sua implementação é a base: a nova story acrescenta a confirmação manual para importados RD, mantendo o comportamento atual dos demais cards. O item 8 da story anterior documenta uma limpeza específica de transições da Revisão de Radar; não ampliar aquela operação de banco para resolver este pedido.

A story `story-alpha-crm-recuperacao-campos-sincronizacao-rd-v1.md`, em **Critérios de aceite**, itens 2, 5–7 e 10, registra a origem comprovada, campos canônicos, lacunas e a necessidade de preservar dados reais. Esta movimentação manual não depende de concluir a recuperação: os dados ausentes continuam ausentes e são apresentados ao usuário. Não alterar o plano de sincronização nem permitir que importadores e automações usem o desvio manual.

O fluxo atual possui movimento pelo arrastar do Kanban e pelo `PainelProximaEtapa`, ações de servidor e um comando central de transição. Existe rejeição `TRANSITION_NOT_DEFINED` quando não há transição persistida. Cards RD de funis como Smart precisam poder mover entre etapas ativas do mesmo funil nesse caso, sem depender de regras por nomes/IDs ou de criar uma matriz de transições no banco.

## Critérios de aceite

1. **Elegibilidade por origem real:** o servidor identifica cards importados do RD pela relação/proveniência persistida existente. Nome de cliente, CNPJ, rótulo de card, nome de pipeline, ID fixo ou informação enviada isoladamente pelo navegador não habilitam o comportamento. A regra cobre todos os cards com essa origem, inclusive os novos importados pela sincronização, e não depende de uma lista fixa de clientes/funis.
2. **Pendências vindas da configuração:** ao solicitar movimento manual de um card RD, avaliar campos, formulários, checklists e demais requisitos configurados aplicáveis à entrada/saída da transição, usando os resolvedores atuais dos dados. Quando faltarem informações obrigatórias, retornar a lista real e legível das pendências, sem inventar exigências por nome/ID de etapa. Não tratar falta de autorização, etapa inválida ou erro de integridade como dado faltante que possa ser confirmado.
3. **Confirmação clara:** apresentar modal que indique etapa de destino e as informações obrigatórias ausentes, com os botões **Mover mesmo assim** e **Cancelar para preencher**. Cada pendência deve ser identificável pelo usuário, sem códigos internos ou JSON. A mesma decisão funcional deve existir no arrastar do Kanban e no `PainelProximaEtapa`, inclusive quando o painel já apresenta formulário para salvar requisitos. Não exigir que o usuário salve valores falsos para habilitar a confirmação.
4. **Confirmação por solicitação:** **Mover mesmo assim** envia uma confirmação explícita para aquele card, origem, destino e estado da solicitação, validada novamente no servidor com a identidade do usuário autenticado. A primeira tentativa sem confirmação não pode mover silenciosamente um card com pendências. A confirmação não é uma preferência global, flag permanente do card ou autorização reutilizável para outro destino/estado. Não permitir que dados enviados pelo cliente convertam uma chamada automática em ação manual autorizada.
5. **Cancelar preserva o card:** **Cancelar para preencher** fecha/interrompe o movimento sem persistir mudança de etapa, dados de formulário, responsáveis, datas operacionais ou histórico de movimentação. No Kanban, desfazer a posição visual provisória; no painel, manter o card na etapa original e permitir preencher depois. Fechar o modal sem confirmar tem o mesmo efeito. Eventual rascunho já digitado permanece somente no estado local até ser salvo por ação própria.
6. **Movimento confirmado e auditado:** após validação, mover o card RD mesmo com as pendências de dados apresentadas. Não criar dados fictícios, concluir itens de checklist nem marcar requisitos como satisfeitos. Registrar no histórico/auditoria existente a movimentação, ator, origem/destino, momento e a confirmação das pendências efetivamente dispensadas naquela solicitação. Preservar os dados e proveniência RD. Se não houver pendências, seguir o movimento manual normal sem modal adicional de dados faltantes.
7. **Transição ausente em importados:** para movimento manual de card RD, a ausência de uma transição configurada não impede a passagem entre etapas existentes e ativas do mesmo pipeline, inclusive Smart. Resolver isso por regra geral baseada na origem persistida e nas etapas reais, sem fallback por nome/ID, seed, backfill ou criação ad hoc de transições. Quando houver transição configurada, respeitar sua configuração, incluindo bloqueio/desativação explícita, origem manual permitida e efeitos de movimentação aplicáveis. Transição ausente e transição explicitamente desabilitada não podem ser confundidas.
8. **Autorização, integridade e concorrência:** os dois caminhos continuam verificando autenticação, acesso ao card/pipeline, permissão de movimentar, identidade e pertinência das etapas e estado atual. Rejeitar etapa inexistente/inativa, destino de outro pipeline e tentativa sem acesso. Se o card/etapa/configuração relevante mudar entre prévia e confirmação, reavaliar a solicitação e as pendências; não executar confirmação obsoleta. Cliques repetidos ou retry não geram dois movimentos/históricos. A auditoria deve refletir o movimento efetivamente realizado.
9. **Escopo manual restrito:** automações, importadores, jobs, integrações e outras execuções automáticas não podem usar a confirmação para dispensar requisitos ou transições. Cards sem proveniência RD mantêm o comportamento atual, incluindo exigências e transições configuradas. A funcionalidade não amplia permissões nem modifica configurações compartilhadas para liberar movimentos.
10. **Efeitos existentes preservados:** a confirmação dispensa somente a ausência de informações configuradas daquela solicitação e, quando aplicável, permite a transição manual ausente de importados. A movimentação conserva as garantias existentes de persistência, histórico, contexto de serviço e execução dos efeitos legítimos configurados para uma movimentação manual. Falhas desses efeitos não podem virar sucesso silencioso, criar movimento parcial inconsistente ou ser classificadas genericamente como dados faltantes. Não duplicar automações por repetir a confirmação.
11. **Testes, gates e entrega:** testes cobrem os casos abaixo nos dois caminhos da UI e no servidor. Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; registrar resultados reais, atualizar checklist e File List e obter revisão de qualidade. Entregar implementação revisada sem publicar em produção neste escopo. Não executar mutation em massa, migration ou backfill para viabilizar o comportamento.

## Tasks / Subtasks

- [x] Registrar origem, dependências e critérios verificáveis desta story.
- [x] Aplicar `story-draft-checklist.md` à preparação.
- [x] Mapear detecção de origem RD, avaliação de pendências e transição nos caminhos Kanban/painel (AC 1–3, 7).
- [x] Centralizar elegibilidade/decisão no servidor e manter regras atuais de outros cards/automação (AC 1–2, 7–10).
- [x] Implementar confirmação explícita por solicitação e auditoria com reavaliação/concorrência (AC 4, 6, 8).
- [x] Implementar modal e cancelamento consistente nos dois caminhos, sem salvar rascunhos automaticamente (AC 3–5).
- [x] Cobrir movimento RD sem transição configurada e bloqueio explícito respeitado (AC 7).
- [x] Implementar e executar testes focais, regressão e quatro gates do projeto (AC 11); ressalvas da suíte global registradas abaixo.
- [x] Revisar permissões, automações, efeitos e integridade; atualizar resultados, checklist e File List (AC 8–11).

## Dev Notes

### Pontos de integração verificados

- `src/lib/bpm/transicao-command.ts`: comando central de avaliação/execução, `ComandoTransicaoBpm`, `avaliarTransicaoBpm` e `executarTransicaoBpm`. O fluxo atual diferencia `TRANSITION_NOT_DEFINED`, `TRANSITION_DISABLED` e `REQUIREMENTS_PENDING`. Preservar essa distinção e não capturar falhas genéricas como permissão de ignorar dados.
- `src/actions/bpm/Cards.ts`: prévia e ações de movimentação; validar autorização no servidor e propagar a confirmação explícita no caminho apropriado.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`: arrastar entre etapas, estado visual e abertura/fechamento da confirmação. Há alterações concorrentes neste arquivo; integrar sem revertê-las.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`: atualmente usa `MoverCardBpm` e `SalvarRequisitosEMoverCardBpm`; contém modal de requisitos e botão Salvar e mover. Incorporar a alternativa de confirmação sem obrigar persistência de formulário para o caso RD.
- `src/lib/validations/bpm.ts`: schemas do movimento, inclusive IDs `draft-stage-<uuid>`; confirmar o contrato da nova opção sem flexibilizar identificadores ou permissão.
- `prisma/schema.prisma`: confirmar a relação `BpmCardOrigemExterna` e as trilhas existentes para comprovar origem/auditar dispensa, sem mudança de schema.
- `tests/bpm/movimentacao-sem-hardcode.test.ts`, `kanban-transicao-integracao.test.ts`, `transicao-requisitos-card-react.test.ts` e `requisitos-transicao-obrigatoriedade.test.ts`: testes existentes a ampliar conforme o contrato final.

Os pontos acima orientam o inventário; não impõem uma nova arquitetura de confirmação. Reutilizar componentes e trilhas existentes, mantendo a decisão do servidor compartilhada. Não adicionar lista fixa de funis/provedores por card/cliente; consultar a origem realmente registrada pelos importadores RD do projeto.

### Limites e decisões da preparação

- [AUTO-DECISION] Pendência de dados → oferecer confirmação manual auditável somente quando a origem RD está comprovada; os demais cards seguem configuração atual.
- [AUTO-DECISION] Transição inexistente → permitir o movimento manual RD entre etapas ativas do mesmo pipeline, por regra geral; bloqueio explicitamente configurado permanece válido.
- [AUTO-DECISION] Cancelamento → nenhuma persistência do card ou formulário, sem confundir tentativa cancelada com movimento executado.
- [AUTO-DECISION] Publicação → fora deste pedido de implementação/revisão; não fazer push/deploy automaticamente.
- `accumulated-context.md` não foi localizado na preparação anterior. A coerência entre stories usa os documentos existentes citados e os fluxos atuais; não atribuir decisão a contexto ausente. Constituição, preferências técnicas e core-config foram carregados na preparação desta sessão. `.aiox/gotchas.json` não foi localizado.

## Testing

Usar Vitest e os padrões de integração/React existentes em `tests/bpm/`, com dados sintéticos. O servidor é a fonte da decisão; teste de UI isolado não comprova autorização.

| Cenário | Resultado esperado |
|---|---|
| RD com campo obrigatório vazio, primeira tentativa | Modal lista a informação; nenhuma movimentação persistida. |
| RD confirma Mover mesmo assim | Movimento único com auditoria da confirmação; campo continua vazio. |
| RD cancela/fecha modal no Kanban | Posição visual e etapa persistida permanecem na origem. |
| RD cancela no PainelProximaEtapa após digitar rascunho | Nenhum valor/etapa/histórico persistido. |
| RD sem pendências | Movimento normal sem modal extra. |
| RD Smart sem transição configurada, etapas ativas no mesmo funil | Movimento manual permitido sem criação de transição ou mapa de nomes. |
| RD com transição explicitamente desativada | Bloqueio respeitado; confirmação de dados não libera. |
| Card nativo com exigência configurada/sem transição | Comportamento atual preservado; flag enviada pelo cliente não libera. |
| Automação/job com card RD e flag de confirmação | Não obtém o desvio manual. |
| Usuário sem permissão, etapa inativa/inexistente ou outro funil | Operação rejeitada sem persistência, mesmo com confirmação. |
| Nome/ID/rótulo simula RD sem proveniência | Não habilita a exceção. |
| Card ou configuração mudou entre prévia e confirmação | Reavaliação/conflito impede executar confirmação obsoleta. |
| Duplo clique/retry e falha transacional | Sem duplicação de movimento, efeitos ou histórico; estado consistente. |

Testar também pendências de fontes canônicas, requisitos de entrada/saída e checklist configurado para demonstrar que a lista corresponde à avaliação real. Executar regressões de movimentação, IDs de etapa criados pela UI e permissões existentes. Validar os dois caminhos completos, não apenas a renderização do modal. Registrar limites de verificação visual/autenticada sem afirmar inspeção não realizada.

## 🤖 CodeRabbit Integration

### Story Type Analysis

Primary Type: API. Secondary Types: Frontend, Security, Integration. Complexity: alta, pelo compartilhamento da decisão entre UI/servidor, concorrência e isolamento de automações.

### Specialized Agent Assignment

- @dev: implementação e revisão pré-commit.
- @qa: regressão, critérios e veredito de qualidade.
- @architect: revisão das fronteiras manual/automático e autorização.
- @ux-design-expert: clareza/acessibilidade do modal conforme padrões existentes.
- @devops: somente em eventual pedido posterior de publicação.

### Quality Gate Tasks

- [x] Pre-Commit (@dev): candidato final isolado aprovado em lint, typecheck, suíte completa e build; expectativas/fixtures antigas corrigidas sem alterar comportamento de produto.
- [ ] Pre-PR (@devops): se solicitado posteriormente, revisar diff e evidências.
- [x] Pre-Deployment (@devops): usuário solicitou publicação; artefato isolado, smoke local, versão saudável anterior e rollback de código conferidos. Acompanhar deploy e smoke da versão publicada.

### Self-Healing Configuration

Story 6.3.3: @dev light, até duas iterações/15 minutos, corrige CRITICAL e documenta HIGH; @qa full, até três iterações/30 minutos, corrige CRITICAL/HIGH e documenta MEDIUM; @devops check, somente relatório. Se CodeRabbit não estiver disponível, registrar a indisponibilidade conforme a configuração, mantendo revisão e demais gates.

### CodeRabbit Focus Areas

Autorização no servidor, origem comprovada, confirmação restrita à solicitação manual, proteção contra chamadas automáticas/clientes falsificados, cancelamento sem escrita, dados reais preservados, concorrência/idempotência e manutenção dos efeitos legítimos da movimentação.

## Resultado da Story Draft Checklist

Aplicado `.aiox-core/product/checklists/story-draft-checklist.md`. Readiness: **READY** para implementação; clareza 9/10.

| Categoria | Resultado | Evidência |
|---|---|---|
| Objetivo e contexto | PASS | Pedido, comportamento esperado e dependência da story anterior explícitos. |
| Orientação técnica | PASS | Caminhos UI/servidor e erros reais identificados; sem prescrever schema novo. |
| Referências | PASS | Stories anteriores com seções e contexto resumidos. |
| Autocontenção | PASS | Elegibilidade, confirmação, ausência de transição, exceções e limites definidos. |
| Testes | PASS | Matriz cobrindo UI, servidor, segurança, concorrência e automações. |
| CodeRabbit | PASS | Tipos, agentes, gates, self-healing e focos definidos. |

Perspectiva do desenvolvedor: pode implementar sem decisão adicional sobre clientes/funis. O principal risco é tratar toda falha de transição como pendência dispensável; os critérios exigem preservar as demais guardas e diferenciar transição ausente de bloqueio explícito.

## Dev Agent Record

Preparação: River (SM). Implementação: executor Dev, com blueprint Scout/Architect e revisão QA. Alterações anteriores de outras tarefas foram preservadas, inclusive filtros/equipe do board.

- Proveniência consultada no banco; formato `rdcard_<28 hex>` aceito nas ações de mover e atualizar, sem flexibilizar IDs de campos e etapas.
- Avaliação central retorna pendências configuradas em contrato estruturado. As verificações por nomes/chaves específicas do fluxo legado não impõem requisitos ao movimento manual RD.
- Confirmação vinculada ao ator autenticado, card, origem/destino, versão, configuração, valores e identidade da proveniência; listas relevantes ordenadas para hash estável. Token obsoleto também é rejeitado quando as pendências desaparecem.
- Caminho sem aresta usa CAS, histórico e outbox existentes; não cria transições nem execução com FK fictícia. Retry verifica vínculo com ator/card/destino e não repete automações imediatas.
- Aviso compartilhado acessível no Kanban e painel; primeira tentativa não persiste dados, cancelar restaura posição e preserva rascunhos. Confirmar não inventa valores nem conclui checklist.
- Correções da revisão: restringir validação de valores/anexos RD às exigências aplicáveis; rejeitar confirmação antiga com zero pendências; impedir repetição de automações na ação após retry idempotente.
- Sem mutation remota, schema/migration/backfill, commit, push ou deploy. Build executado em checkout isolado para preservar o servidor de desenvolvimento. Não houve inspeção autenticada do painel no navegador.
- CodeRabbit CLI indisponível (`coderabbit` e `cr` ausentes); revisão funcional humana assistida e gates executáveis mantidos.

### Candidato para publicação autorizada — 2026-10-16

- Release isolada baseada em `origin/main` `069fcdee79b6359d539264c67da32338830b8e8d`, preservando atualizações já publicadas e incluindo somente esta feature mais quatro ajustes de testes necessários para os gates. Workspace compartilhado e mudanças alheias preservados.
- `npm test`: **640 arquivos e 4796 testes aprovados**, 4 skipped e 1 todo. `npm run typecheck`: saída 0 após gerar o player pelo script existente; `npm run lint`: saída 0, 1193 warnings anteriores; `npm run build`: saída 0 no disco de trabalho. Primeira tentativa em `/tmp` falhou com quota de escrita, resolvida transferindo o checkout/build sem alterar fontes.
- Smoke local com build de produção: raiz e providers HTTP 200, CRM protegido para visitante sem sessão. Health de versão indisponível localmente é esperado sem metadados Vercel; verificar SHA real após o deploy. Não foi movimentado card real para testar.
- `package.json` e lockfile idênticos à produção anterior. Auditoria de dependências somente leitura identificou dívida preexistente (10 critical, 52 high, 61 moderate, 2 low); registrar **CONCERNS de baseline**, sem declarar segurança global PASS nem introduzir atualização de dependências fora do escopo. Gates oficiais de código aprovados, sem bypass de hooks ou proteção de branch.
- Versão saudável anterior para rollback: deploy Vercel `dpl_5Dy935yWxnaGor1Lhc5pBUEKot5C`, commit `069fcdee`. A publicação deve ser acompanhada até READY e `/api/health/version` deve corresponder ao SHA final, com smoke e logs contemporâneos.

### File List

- `docs/stories/story-alpha-crm-movimentacao-manual-importados-rd.md` — critérios, decisões, evidências e checklist.
- `src/lib/validations/bpm.ts` — identidades dos cards e contrato estrito de confirmação.
- `src/lib/bpm/movimento-importado-rd.ts` — proveniência, classificação de faltas e snapshot de confirmação.
- `src/lib/bpm/transicao-command.ts` — avaliação e execução transacional central, auditoria e retry.
- `src/actions/bpm/Cards.ts` — identificação RD nas consultas, prévia e propagação da confirmação.
- `src/actions/bpm/DisponibilidadeEtapasCard.ts` — disponibilidade incluindo pendências confirmáveis e ausência de aresta RD.
- `src/app/PainelAlpha/AlphaCRM/CardModal/ConfirmarMovimentoRdModal.tsx` — modal compartilhado acessível.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx` — confirmação/cancelamento e rascunhos no painel.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` — arrastar, confirmação e restauração da posição; alterações concorrentes preservadas.
- `tests/bpm/movimentacao-importados-rd-actions.test.ts` — schemas, ações, sessão e retry sem repetir automações.
- `tests/bpm/movimentacao-importados-rd-command.test.ts` — requisitos, confirmação, integridade, concorrência e transação.
- `tests/bpm/movimentacao-importados-rd-react.test.ts` — ambos os fluxos de interface.
- `tests/bpm/disponibilidade-etapas-card.test.ts` — regressão e disponibilidade RD sem aresta.
- `tests/bpm/em-tratativa.test.ts` — expectativas alinhadas à remoção anterior do requisito fixo, preservando validação em Sem viabilidade.
- `tests/bpm/card-modal-integration.test.ts` — valida tokens responsivos do mesmo grid sem depender da ordem literal das classes.
- `tests/bpm/arquivamento-modal-react.test.ts` — isola o chat não relacionado para preservar testes de arquivamento.
- `tests/builder/embed.test.ts` — alinha testes ao contrato publicado sem controles externos e preserva timeout, carregamento e falha de rede.
- `src/lib/bpm/automacoes/central-schemas.ts` — usa a identidade canônica dos cards no evento de domínio; correção pós-publicação.
- `tests/bpm/movimentacao-rd-eventos-reais.test.ts` — movimento e publicador reais, sem simular o parser do evento.
- `tests/bpm/eventos-rd-sqlite.test.ts` — publicador e Prisma/SQLite reais, atomicidade e retry em banco temporário.

## QA Results

Revisão funcional QA e parecer arquitetural concluídos sem CRITICAL/HIGH abertos após correções. A avaliação arquitetural confirmou que histórico + outbox únicos preservam a auditoria/idempotência do caminho sem aresta sem alteração de schema. Não equivale a inspeção autenticada em produção.

| Verificação real, 2026-10-16 | Resultado |
|---|---|
| `npm run typecheck` | PASS, código de saída 0, sem erros. |
| `npm run lint` | PASS, código 0, zero erros e 1193 warnings existentes. |
| `npm run build`, checkout isolado com fontes finais | PASS, código 0. Primeira tentativa foi interrompida por SIGTERM; repetição serial concluída. Avisos já existentes de importação dinâmica/pdfjs; TypeScript validado separadamente. |
| `npm test` | 638 arquivos aprovados, 4 falhos; 4827 testes aprovados, 6 assertions falhas, 4 skipped e 1 todo; uma suite falha na importação. |
| Regressão focal dos caminhos RD e movimento existente | PASS: 9 arquivos e 76 testes aprovados; evidência em `/tmp/rd-move-focused-reviewed.log`. |
| `git diff --check` | PASS, sem erros de whitespace. |

As quatro suites globais falhas são as mesmas reproduzidas em HEAD limpo `2658139b` na validação anterior desta sessão: `tests/bpm/em-tratativa.test.ts` (2 assertions), `tests/bpm/card-modal-integration.test.ts` (1 assertion de layout), `tests/builder/embed.test.ts` (3 assertions de DOM) e `tests/bpm/arquivamento-modal-react.test.ts` (importação `next/server` via next-auth). Nenhuma falha adicional permaneceu após a correção de blur/guard no painel. Essas pendências impedem declarar a suíte global verde; sua correção não integra esta story.

Evidências locais: `/tmp/rd-move-typecheck-reviewed.log`, `/tmp/rd-move-lint-reviewed.log`, `/tmp/rd-move-tests-reviewed.log`, `/tmp/rd-move-build-reviewed.log` e `/tmp/rd-move-focused-reviewed.log`. Credenciais temporárias do checkout de build removidas após a conclusão. Sem testes de movimentação em dados reais ou publicação.

### Parecer formal — Quinn (QA), 2026-10-16

**Gate: CONCERNS.** Revisão funcional concluída sem CRITICAL/HIGH abertos nesta implementação. A aprovação global permanece pendente devido às falhas preexistentes da suíte completa. Recomenda-se manter **Ready for Review**, com as ressalvas abaixo; este parecer não autoriza publicação.

- **AC 1–2 e 7–9:** origem persistida, ator da sessão, autorização, etapas ativas do mesmo pipeline, requisitos configurados e distinção entre transição ausente/desabilitada verificados no código e nos testes. A exceção permanece restrita ao movimento manual RD.
- **AC 3–6:** testes React exercitam Kanban e painel, apresentação das pendências, cancelamento sem salvar/mover e confirmação sem valores fictícios; testes de comando conferem auditoria das pendências dispensadas. A inspeção autenticada no navegador não foi realizada.
- **AC 4, 8 e 10:** confirmada vinculação ao ator, proveniência, card, destino, versão e configuração; CAS, outbox e idempotência preservados. Correções verificadas: validação RD limitada aos requisitos aplicáveis; rejeição `STALE_CONFIRMATION` quando as pendências desaparecem; automações imediatas não repetidas pela ação em retry idempotente. Falha transacional mantém o estado anterior nos testes.
- **AC 11:** checklist e File List revisados. Logs finais conferidos: typecheck, lint e build concluídos; regressão focal com **9 arquivos / 76 testes aprovados**. O QA também executou independentemente as quatro suítes específicas, com **46 testes aprovados** após as correções.

**Ressalvas abertas:** `npm test` continua com quatro suítes falhas, seis assertions falhas e uma falha de importação; as mesmas ocorrências foram reproduzidas pelo QA em checkout limpo do HEAD `2658139b`, com relatório `/tmp/rd-sync-clean-head.oHE4KO-qa-results.json`. O lint registra 1193 warnings existentes. Essas evidências não sustentam declarar PASS global. A revisão não realizou movimento em dados reais, commit, push ou deploy.

**Alteração realizada pelo QA:** somente este acréscimo na seção QA Results. Código de aplicação preservado. **Situação para aprovação integral: NEEDS_WORK**, limitada às falhas globais documentadas. A ausência de inspeção visual autenticada permanece registrada como limite da evidência disponível.

### Addendum — candidato de publicação autorizado, 2026-10-16

Após pedido explícito do usuário para publicar, a validação continuou no checkout isolado `/tmp/rd-publish-release-6baqp8m0`, baseado em `origin/main` (`069fcdee`). O parecer CONCERNS acima permanece como registro da revisão anterior. As falhas basais foram corrigidas exclusivamente nos testes, com evidência do contrato vigente:

- `tests/bpm/em-tratativa.test.ts`: expectativas alinhadas à remoção da obrigação hardcoded na entrada em Em tratativas, documentada no commit `ba833d97` e na story `story-alpha-crm-revisao-radar-em-tratativas.md`. Mantidas as verificações de Próximo Contato obrigatório, ausente/inválido e válido em Sem viabilidade.
- `tests/bpm/card-modal-integration.test.ts`: validação dos tokens de overflow responsivo no mesmo grid, sem depender da posição contígua das classes CSS.
- `tests/bpm/arquivamento-modal-react.test.ts`: mock do painel `ChatClienteCard`, como os demais painéis externos ao cenário de arquivamento, isolando a importação de autenticação. Os cinco casos reais de permissão, confirmação, loading e resultado do arquivamento voltaram a executar.
- `tests/builder/embed.test.ts`: cenários alinhados à retirada dos controles externos pelo commit `5f48b751`. Preservadas verificações de carregamento, fronteira de timeout em 29.999/30.000 ms, evento load, perda de rede, remoção do iframe e orientação para recarregar a página; adicionadas verificações do iframe integrado. Nenhuma regra do produto foi alterada por essas correções.

Antes das correções, as quatro suítes reproduziram seis assertions falhas e a falha de importação. Depois, **4 arquivos / 44 testes PASS**, com ESLint e diff-check focais aprovados. Relatórios: `/tmp/rd-publish-baseline-before.json` e `/tmp/rd-publish-baseline-after.json`.

| Gate do candidato isolado | Evidência conferida |
|---|---|
| `npm test` | **PASS:** 640 arquivos, 4796 testes aprovados, 4 skipped e 1 todo; `/tmp/rd-publish-tests.log`. |
| `npm run typecheck` | **PASS:** execução final sem erros; `/tmp/rd-publish-typecheck-final.log`. O artefato gerado do player foi preparado com `npm run build:player`, sem alterar fontes versionadas. |
| `npm run lint` | **PASS:** zero erros e 1193 warnings existentes; `/tmp/rd-publish-lint.log`. |
| `npm run build` | **PENDENTE de execução concluída:** o log em acompanhamento contém erro de escrita `errno -122`; `/tmp/rd-publish-build.log`. Esta tentativa não constitui PASS. |

**Parecer funcional: APPROVED**, sem CRITICAL/HIGH abertos no escopo revisado. A liberação final de publicação depende do build do candidato concluído com sucesso e da continuidade do fluxo DevOps autorizado. Não houve deploy pelo QA nem inspeção visual autenticada; esse limite permanece explícito.

### Addendum v2 — gates finais do candidato, 2026-10-16

**Gate final: PASS. Parecer funcional: APPROVED.** Os quatro gates exigidos foram concluídos com sucesso no candidato de publicação autorizado. Os registros anteriores de CONCERNS e da tentativa de build interrompida por quota permanecem como histórico; suas pendências de testes/build foram resolvidas neste candidato.

O checkout foi movido para `/home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/rd-movement-release-20261016`, sem alteração das fontes pela movimentação. O build repetido nesse disco concluiu com **código de saída 0**, confirmado pelo executor e pelo log final `/home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/rd-publish-build.log`, conferido pelo QA.

| Gate final | Resultado e evidência |
|---|---|
| `npm test` | **PASS:** 640 arquivos e 4796 testes aprovados; 4 skipped e 1 todo; `/tmp/rd-publish-tests.log`. |
| `npm run typecheck` | **PASS:** zero erros; `/tmp/rd-publish-typecheck-final.log`. |
| `npm run lint` | **PASS:** zero erros e 1193 warnings existentes; `/tmp/rd-publish-lint.log`. |
| `npm run build` | **PASS:** saída 0 no checkout final; `/home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/rd-publish-build.log`. |

Nenhum CRITICAL/HIGH permanece aberto no escopo funcional revisado. A aprovação abrange a implementação e os gates deste candidato; a continuidade da publicação solicitada pertence ao fluxo DevOps. **Inspeção visual autenticada não realizada.** O QA não executou deploy nem mutação em dados reais.

### Addendum v3 — revisão do hotfix do publicador de eventos, 2026-10-16

O erro relatado após a publicação foi identificado no contrato real de `CARD_MOVIDO`: o parser do publicador exigia CUID para `cardId`, apesar de as ações de movimentação já aceitarem a identidade RD persistida. A revisão anterior usava um mock do publicador nos testes do comando e não cobria essa fronteira. A correção compartilha `bpmCardIdSchema` no schema de eventos, com duas linhas alteradas em `central-schemas.ts`; os demais identificadores, permissões, requisitos, confirmação e CAS permanecem com seus contratos anteriores.

**Parecer funcional do hotfix: APPROVED**, sem CRITICAL/HIGH abertos na revisão desse patch. A reprodução RED registrou cinco falhas por identidade RD recusada; os novos testes GREEN mantêm comando, parser e publicador reais. Conferidos **2 arquivos / 9 testes aprovados**, incluindo publicação com identidades RD e CUID nativo, rejeição de identificadores malformados antes da persistência, cancelamento/prévia sem escrita e retry sem duplicar movimento, histórico ou outbox. Um teste adicional usa Prisma e SQLite temporário reais para demonstrar commit conjunto de etapa/evento, unicidade da publicação e rollback da etapa/versão quando a publicação falha. Evidência final: `/tmp/rd-hotfix-integration-final.log`.

| Gate do hotfix | Resultado conferido |
|---|---|
| `npm test` | **PASS:** 642 arquivos e 4805 testes aprovados; 4 skipped e 1 todo; `/tmp/rd-hotfix-tests.log`. |
| `npm run typecheck` | **PASS:** execução final sem erros; `/tmp/rd-hotfix-typecheck-final.log`. |
| `npm run lint` | **PASS:** zero erros e 1193 warnings anteriores; `/tmp/rd-hotfix-lint.log`. |
| `npm run build` | **PASS:** execução concluída com saída 0, confirmada pelo executor e log final conferido pelo QA; `/home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/rd-hotfix-build.log`. |

**Gate final do hotfix: PASS. Parecer: APPROVED.** Os quatro gates foram concluídos para o hotfix de quatro arquivos: contrato de eventos, duas regressões novas e esta story. A publicação corretiva solicitada pelo usuário pode seguir pelo fluxo DevOps. Esta revisão não executou movimentação em dados reais nem inspeção visual autenticada; os testes usam apenas dados sintéticos e banco descartável. O QA alterou somente esta seção da story nesta etapa.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-10-16 | 1.0 | Story focada na movimentação manual de importados RD com confirmação auditável de pendências, dois caminhos da UI e transição ausente sem hardcode. | River (SM) |
| 2026-10-16 | 1.1 | Implementação do contrato de confirmação manual RD, duas interfaces, auditoria e testes; revisão funcional corrigida. | Dev / QA |
| 2026-10-16 | 1.2 | Publicação autorizada; candidato isolado com 640 arquivos de testes aprovados, quatro fixtures antigas corrigidas, build e smoke local aprovados. | Dev / QA / DevOps |

## Correção pós-publicação: identificador no evento de movimento — 2026-10-16

Usuário testou arrastando um card RD e recebeu mensagem genérica de falha de transição. Logs contemporâneos da produção mostraram `[TransitionCommand] ZodError`, `invalid_format`, `cuid`, caminho `cardId`. A aplicação aceita o identificador importado no pedido de movimentação, mas `eventoDominioInputSchema` ainda o recusava na publicação de `CARD_MOVIDO`; a transação desfazia a alteração em seguida. O problema é o contrato de identidade do publicador, e não uma exigência de informação obrigatória.

- [x] Confirmar erro real de produção e reproduzir a rejeição de identidade localmente, sem escrever em dados reais.
- [x] Compartilhar `bpmCardIdSchema` também no contrato de eventos, preservando validação restrita dos demais identificadores.
- [x] Reproduzir a falha com comando e publicador de eventos reais, sem simular a validação que falhou.
- [x] Validar prévia/cancelamento sem escrita, movimento com/sem pendências, histórico/outbox, retry e identidades inválidas.
- [x] Executar quatro gates, obter revisão QA e preparar a republicação autorizada; acompanhar o deploy até READY e health correspondente.

Os testes anteriores simulavam `publicarEventoBpm`, por isso não exercitaram o contrato de publicação real. A regressão nova deve manter o parser e o publicador reais. Nenhuma exceção por cliente, pipeline ou ID individual será introduzida; nenhum valor obrigatório será inventado para liberar a operação.

### Evidência do hotfix

- Antes do patch: a nova regressão com comando/publicador/schema reais falhou em 5 casos, reproduzindo `ZodError: cardId / Invalid cuid`; 3 casos negativos já passavam.
- Depois: **8/8 casos passaram**, mais um caso com **Prisma/SQLite reais**, total **9/9**. A transação de teste grava mudança de etapa e outbox juntas, reaproveita a mesma publicação no retry e desfaz a mudança quando o publicador recebe identidade inválida.
- `npm test`: **642 arquivos / 4805 testes aprovados**, 4 skipped e 1 todo; `/tmp/rd-hotfix-tests.log`. Lint global: zero erros e 1193 warnings anteriores; `/tmp/rd-hotfix-lint.log`.
- O teste SQLite segue o padrão existente `createRequire` para o módulo nativo do Node 24, mantendo compatibilidade com os tipos Node 20 do projeto; teste focal e lint repetidos após esse ajuste de tipagem, sem alterar o produto.
- Escopo executável do hotfix: duas linhas no contrato do evento. Identidades de pipeline, etapa, campo e execução continuam restritas; autenticação, permissões, confirmação de pendências e CAS não foram flexibilizados. Banco temporário de teste não contém dados reais e é removido ao terminar.

- Typecheck final aprovado (`/tmp/rd-hotfix-typecheck-final.log`), regressões focais repetidas aprovadas (`/tmp/rd-hotfix-integration-final.log`) e lint focal sem erros (`/tmp/rd-hotfix-focal-lint.log`). Build final saída 0 em `/home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/rd-hotfix-build.log`.
- QA hotfix APPROVED. Smoke local do artefato aprovado (raiz/providers 200 e CRM protegido sem sessão); servidor temporário encerrado. Artefato contém somente o contrato compartilhado, dois testes novos e esta story. Publicação deve preservar rollback anterior, confirmar `/api/health/version` na SHA final e conferir logs contemporâneos.
