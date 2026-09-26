# Story: reset completo dos pipelines do Alpha CRM

## Status

Draft — execução de dados condicionada ao checkpoint Vault.

## Executor Assignment

- **Executor:** @dev, com apoio de @data-engineer para o plano e a execução de dados.
- **Quality gate:** @qa, com revisão de @architect para dependências do BPM.
- **Ferramentas:** inventário e simulação somente leitura, relatório Vault, backup restaurável, testes BPM e gates do projeto.

## Story

**Como** administrador do Alpha CRM, **quero** apagar o conteúdo e as configurações atuais dos pipelines e ficar somente com Financeiro, Operacional e Revisão de Radar vazios, **para** reconstruir cada etapa do zero em pedidos posteriores.

## Origem e decisão de escopo

- **Pedido desta sessão:** “remova todos os campos e validações de todos os pipeline ... mantenha apenas o pipeline Financeiro, Operacional e Revisão de Radar ... iremos criar etapa por etapa novamente”.
- **Esclarecimento do usuário:** “Sim, tudo” para apagar também etapas, cards e histórico vinculados. Essa resposta define o **escopo funcional** desta story.
- **[AUTO-DECISION] Identidade dos três pipelines:** preservar os registros e identificadores atuais de Financeiro, Operacional e Revisão de Radar. Conforme inventário documentado em `docs/stories/story-alpha-crm-saidas-radar-financeiro-operacional.md`, Revisão de Radar é o pipeline de chave `comercial`; o registro de chave `radar` é antigo/inativo e deve sair. Confirmar por identificador, chave e nome no banco alvo antes de executar; nomes isolados não bastam.
- **[AUTO-DECISION] Limite do reset:** apagar dados e regras próprios do CRM/BPM, inclusive os registros dependentes de cards e etapas. Cadastros compartilhados fora do CRM, como clientes, usuários e contratos, não são alvo por simples vínculo a um card; inventariar referências antes da operação e não deixar ponteiros órfãos. A remoção de eventos em serviços externos exige inventário e plano próprios, se aplicável.
- **[AUTO-DECISION] Estado vazio:** os três pipelines permanecem existentes e ativos, sem etapas, cards, campos personalizados ou configurações operacionais. A primeira etapa será definida em story posterior; o CRM deve exibir esse estado sem recriar conteúdo automaticamente.
- Esta story substitui o estado funcional construído pelas stories anteriores do CRM. As stories passadas continuam como documentação histórica, não como requisito para repovoar os três pipelines agora.

## Critérios de aceitação

1. Após a limpeza, a consulta de pipelines do Alpha CRM retorna **exatamente três pipelines ativos e existentes**: Financeiro, Operacional e Revisão de Radar. Os seus identificadores são preservados. Nenhum outro pipeline, inclusive o `radar` antigo/inativo, continua no CRM.
2. Os três pipelines preservados têm **zero etapas** ativas ou inativas. Os demais pipelines e suas etapas são removidos. Nenhuma etapa padrão é semeada ou recriada no carregamento, em jobs ou na inicialização.
3. Todos os cards de todos os pipelines do CRM, em qualquer status, são apagados com seus valores de campos, vínculos, histórico, tarefas, checklists, anexos, interações, reuniões, cadências, eventos, agendas, execuções, estados e demais dependências próprias do card identificadas no inventário. A verificação final mostra zero cards e zero registros dependentes órfãos. Arquivos externos e integrações relacionadas são tratados conforme relatório de impacto, sem exclusão cega fora do CRM.
4. Campos personalizados de todos os pipelines e seus valores, opções, mapeamentos, acessos, configurações por etapa, formulários, seções e componentes são removidos. Não resta campo ou formulário antigo no catálogo, no board, no modal nem nas APIs do CRM.
5. Validações e regras operacionais antigas de todos os pipelines deixam de atuar e de aparecer na administração: obrigatoriedade, requisitos de entrada/saída, condições, transições, regras, automações, SLAs, visibilidade por etapa, scripts/capacidades, cadências, procedimentos/checklists, substatus e outras configurações ligadas aos pipelines/etapas. O inventário e a verificação cobrem tabelas e regras fixas em código que possam repovoar ou bloquear a reconstrução; guardas de autenticação, autorização e integridade gerais continuam operantes.
6. Páginas de lista, administração e quadro dos três pipelines abrem em estado vazio, com ação adequada para começar a configurar a primeira etapa. Criar uma etapa nova posteriormente não encontra campos, validações ou automações herdadas da configuração anterior.
7. A limpeza é planejada por inventário completo de dependências e contagens, simulada numa cópia restaurada, e executada de forma controlada e verificável. Falha parcial não produz estado publicado inconsistente; após a execução, conferir contagens esperadas, integridade e chaves estrangeiras e registrar relatório com os IDs preservados.
8. Antes de **qualquer mutação real do banco**, cumprir integralmente o checkpoint Vault do `AGENTS.md`: relatório Vault, descrição do ambiente e banco, comandos e impacto, riscos de perda/indisponibilidade, alternativa não destrutiva e rollback; backup completo criado antes da operação, com até 48 horas, integridade e restauração verificadas; confirmação explícita do usuário sobre o plano concreto. O “Sim, tudo” acima não substitui essa confirmação operacional específica.
9. Testes de regressão comprovam que nenhum processo, job ou preset recria etapas, campos ou validações antigas e que as telas suportam pipelines com zero etapas. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` passam; a story registra os resultados reais e a File List final.

## Tarefas / subtarefas

- [ ] **Inventariar o ambiente e o grafo de dados** (AC 1–5, 7): listar pipelines por ID/chave/nome/status, contagens de todas as tabelas CRM/BPM, dependências FK em ambos os sentidos, arquivos e integrações externas e regras fixas/presets que recriam dados. Registrar o banco/ambiente real e o estado antes da limpeza.
- [ ] **Preparar o plano de reset** (AC 1–5, 7–8): definir ordem de exclusão por FK, escopo exato por tabela, estratégia transacional ou de bloqueio de gravações, verificação de ausência de órfãos e rollback seletivo/total. Gerar simulação numa cópia restaurada e comparar contagens/IDs.
- [ ] **Passar pelo Vault e obter autorização operacional específica** (AC 8): produzir relatório, backup completo recente e validado; apresentar ao usuário o plano concreto e aguardar confirmação explícita antes da mutação.
- [ ] **Executar a limpeza protegida** (AC 1–5, 7): apagar os dados CRM/BPM inventariados, remover os pipelines excedentes e manter os três identificadores corretos. Registrar execução e contagens pós-operação.
- [ ] **Ajustar os consumidores do estado vazio** (AC 5–6, 9): retirar regras/presets fixos remanescentes e tratar ausência de etapas, formulários e cards nas páginas, ações e jobs, sem reintroduzir configuração legada.
- [ ] **Verificar e documentar** (AC 1–9): checar integridade/FKs, ausência de resíduos e de recriação automática, telas vazias, testes e gates. Atualizar checklist e File List desta story.

## Plano de segurança Vault — obrigatório antes da mutação

| Item | Exigência para a execução |
| --- | --- |
| Ambiente e banco | Identificar endpoint, ambiente e banco alvo no relatório Vault. Stories recentes citam Turso remoto de produção; confirmar o alvo atual, sem presumir que não mudou. |
| Operação | Documentar comandos exatos e ordem de exclusão, inclusive dependências com FK restritiva e interrupção temporária de jobs/gravações que possam repovoar dados. |
| Impacto e riscos | Explicar perda deliberada de etapas, cards, campos, validações e histórico, relações com outros módulos, possível indisponibilidade e efeito sobre integrações externas. |
| Alternativa não destrutiva | Apresentar manter os dados antigos isolados/arquivados e iniciar uma configuração vazia, se tecnicamente viável; o pedido atual prefere exclusão completa. |
| Backup | Criar em `database-backups/pre-change/` um backup **completo** anterior à execução, com até 48 horas; verificar tamanho, hash, restauração, integridade e FKs em cópia isolada. Nunca versionar dump, token ou dados reais. |
| Aprovação | Exibir plano, inventário, evidência do backup e rollback ao usuário e obter confirmação explícita para **esta execução**. Sem isso, parar antes de escrita no banco. |
| Rollback | Validar restauração em cópia isolada. Definir se a recuperação será completa ou seletiva, com atenção a gravações posteriores; qualquer restauração no banco vivo requer plano e consentimento próprios. |

## Dev Notes

- **Identidade:** `docs/stories/story-alpha-crm-saidas-radar-financeiro-operacional.md` documenta `comercial` = Revisão de Radar, além de `radar` antigo/inativo, e a cadeia de cards entre Financeiro e Operacional. A story anterior tinha cards e vínculos ativos; não presumir contagens atuais.
- **Modelo:** `prisma/schema.prisma` define `BpmPipeline`, `BpmEtapa`, `BpmCampo`, `BpmCard`, `BpmCardHistorico`, `BpmPipelineConfigAuditoria` e os modelos BPM associados. `BpmCampoMapeamento` usa FK com `Restrict`; cascatas não bastam para planejar a limpeza. `BpmCard` vincula `Cliente` e `usuarios`, que também servem outros módulos.
- **Pontos de entrada:** `src/actions/bpm/Pipelines.ts`, `Etapas.ts`, `Campos.ts`, `Cards.ts`, `FormulariosEtapa.ts`, automações e transições em `src/lib/bpm/`; páginas de lista e quadro em `src/app/PainelAlpha/AlphaCRM/`. Localizar consumidores adicionais pelo inventário, inclusive jobs `src/app/api/bpm/jobs/`.
- **Fonte técnica adicional:** `docs/stories/story-alpha-crm-formularios-edicao-limpeza-radar.md` documenta precedentes de limpeza protegida, FK restritiva, backup restaurado e verificação pós-operação. Aquela limpeza preservava parte dos dados; esta story substitui esse recorte pelo reset completo confirmado pelo usuário.
- **Contexto acumulado:** `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados neste checkout durante o draft; a coerência entre stories foi conferida pelas referências acima. O PRD sharded configurado em `.aiox-core/core-config.yaml` também não existe em `docs/prd/`; os critérios desta story derivam diretamente do pedido e da confirmação do usuário, sem alegar redação de epic inexistente.
- **Sem migração estrutural presumida:** o pedido é de reset de dados e comportamento. Se o inventário demonstrar necessidade de alterar schema, rever plano e submeter novamente ao Vault antes de aplicar.

## Testing

- Usar testes BPM existentes em `tests/bpm/` para ausência de etapas, campos, cards e regras herdadas; testar lista/administrador/board vazio e bloqueio de qualquer semeadura automática.
- Ensaiar plano de dados sobre cópia restaurada do backup; comparar contagens por tabela, IDs dos três pipelines, `PRAGMA integrity_check` e `PRAGMA foreign_key_check`, além de referências externas inventariadas.
- No banco alvo, repetir apenas as verificações de leitura após a execução autorizada. Não usar uma suíte que escreva no banco remoto.

## Preflight desta sessão (2026-09-26)

- Banco identificado: Turso remoto configurado em `.env.local`; tratar como produção. Nenhuma credencial foi registrada aqui.
- Inventário remoto somente leitura: Financeiro (`financeiro`) 7 etapas, 61 campos, 256 cards; Operacional (`operacional`) 13 etapas, 30 campos, 422 cards; Revisão de Radar (`comercial`) 9 etapas, 61 campos, 664 cards; Radar legado/inativo (`radar`) 3 etapas, 0 campos, 3 cards. Total observado: **1.345 cards**. Recontar imediatamente antes da operação, pois o banco continua em uso.
- Simulação preliminar numa cópia descartável do snapshot local de 2026-09-26 12:15Z: 65 tabelas `Bpm*` esvaziadas, exceto `BpmPipeline`; removido o pipeline de chave `radar`; `PRAGMA foreign_key_check` sem violações e `integrity_check=ok`; permaneceram exatamente `financeiro`, `operacional` e `comercial`. Esse snapshot tinha apenas 17 cards e **não substitui** o novo backup do estado remoto atual.
- `prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`: migração vazia; nenhuma alteração estrutural planejada.
- Relações externas com `BpmCard` identificadas: `NolossLead.promotedCardId` e `indicacoes.bpmCardId` usam `ON DELETE SET NULL`. Arquivos de anexos em storage e eventos de calendário externos não são restaurados pelo dump SQL; a limpeza planejada atinge as referências do CRM, sem excluir blobs ou eventos externos sem plano separado.
- Vault: **BLOQUEADO** para mutação real até novo backup completo verificado, plano e confirmação específica do usuário. O esclarecimento “Sim, tudo” não foi tratado como essa confirmação.
- Backup novo do Turso concluído em `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-26T13-17-12-005Z.sql` com manifesto correspondente: 177.812.468 bytes, SHA-256 `58a598f5d19eda162f05adbcf7c006e4a5b2f0b761552b27f31d177db0449f48`, 332 tabelas, 190.132 linhas. `node scripts/verify-turso-backup.mjs` restaurou a cópia isolada e confirmou hash, tamanho, contagem, `integrity_check=ok` e zero violações de FK. Validade para execução: até 2026-09-28 13:17 UTC, desde que o inventário vivo ainda corresponda ao backup.
- Simulação final com o backup novo via `scripts/bpm-reset-completo.mjs`: 66 tabelas BPM, 10.894 registros antes (1.345 cards), exatamente três registros de pipeline depois, zero demais registros BPM, `foreign_key_check` sem violações e `integrity_check=ok`. Um `NolossLead.promotedCardId` ligado a card foi definido como `NULL` pela FK `ON DELETE SET NULL`; `indicacoes.bpmCardId` tinha zero vínculos. Fingerprint do inventário do backup: `3d06f8d72e389ca61cbdccfe1498d31ddfdc31b98c9cdb5249ef87e3ae72de0e`.
- Prévia remota posterior ao backup: 11.343 registros BPM, ainda 1.345 cards; fingerprint `e40fbb50d3cf0516b7e4352590b747b06ef1367ef816befff085d2cf8029fc3e`. Como difere do backup, a execução do CLI está bloqueada. Antes da aplicação real, pausar gravações/jobs do CRM, gerar e verificar novo backup, repetir prévia/simulação e exigir fingerprint idêntico. A pausa temporária deve entrar na confirmação específica do usuário.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** Database e integração, com API/Frontend; complexidade alta pelo volume de dados e dependências entre módulos.
- **Specialized Agents:** @dev e @data-engineer executam seus escopos; Vault governa a mutação; @architect revisa o grafo e o estado vazio; @qa valida; @github-devops atua em PR/deploy.
- **Quality Gates:** Pre-Commit (@dev): lint, typecheck, testes, build e revisão; Pre-PR (@github-devops): impacto das exclusões e ausência de reintrodução; Pre-Deployment (@github-devops): relatório Vault, backup e rollback verificados.
- **Self-Healing (Story 6.3.3):** @dev light, até 2 iterações/15 min para CRITICAL; @qa full, até 3 iterações/30 min para CRITICAL/HIGH e registro de MEDIUM; @github-devops check, apenas reporta. Correção automática nunca autoriza mutação de banco sem o checkpoint Vault.
- **Focus Areas:** exclusão por FK e referências cruzadas, preservação dos três IDs, segurança de autorização, estado sem etapas, jobs/presets e ausência de dados residuais.

## Checklist da story

- [x] Pedido e resposta “Sim, tudo” incorporados; critérios derivados da fonte registrada.
- [x] Três identidades e pipeline legado diferenciados com referência à story anterior.
- [x] Checklist de draft aplicado: objetivo/contexto PASS; orientação técnica PASS; referências PARTIAL (sem epic/accumulated-context no checkout); autossuficiência PASS; testes PASS; CodeRabbit PASS. **Prontidão: READY para implementação e preparação, bloqueada para mutação até o Vault.**
- [x] Inventário real de produção, plano e simulação revisados; nova simulação será necessária após pausa das gravações.
- [ ] Relatório Vault, backup completo verificado e confirmação específica registrados.
- [ ] Limpeza executada e verificações pós-operação documentadas.
- [x] `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` executados com resultados registrados; a suíte global tem duas falhas em `tests/debug/error-bus.test.ts` fora do escopo CRM.
- [ ] File List final e resultados de QA atualizados.

## Dev Agent Record

### File List inicial

- `docs/stories/story-alpha-crm-reset-completo-pipelines.md` — esta story.
- `scripts/bpm-reset-completo.mjs` — prévia remota somente leitura, simulação local e aplicação protegida (ainda não executada).
- `docs/reports/alpha-crm-reset-vault-2026-09-26.md` — relatório Vault com plano, backup, riscos, rollback e checkpoint pendente.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` — mensagem específica para pipeline sem etapas.
- `src/app/api/bpm/jobs/automacao-novos-leads/route.ts` — interrompe o job legado por nomes de etapas durante a reconstrução.
- `src/app/api/bpm/jobs/automacoes/route.ts` — retira lembretes financeiros antigos; motor configurável permanece.
- `src/actions/bpm/Membros.ts`, `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx`, `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx` — retiram restrição especial de participantes da antiga etapa Boas-vindas; autorização geral permanece.
- `src/lib/bpm/transicao-command.ts`, `src/actions/bpm/Cards.ts` — retiram validações e atalhos fixos das etapas antigas; gates configurados permanecem.
- `tests/bpm/lost-actions.test.ts`, `tests/bpm/canonical-sources-contract.test.ts`, `tests/bpm/alinhamento-estrategico.test.ts` — alinham a regressão ao estado sem regras fixas antigas.
- `tests/bpm/board-exclusao-local.test.ts`, `tests/bpm/board-polling-react.test.ts`, `tests/bpm/card-modal-integration.test.ts`, `tests/bpm/membros-card-ui.test.ts` — cobrem o board vazio e a permissão geral de participantes sem exceção Boas-vindas.
- `prisma/schema.prisma` — referência para inventário de dependências; alteração estrutural não presumida.
- `src/actions/bpm/`, `src/lib/bpm/`, `src/app/PainelAlpha/AlphaCRM/`, `src/app/api/bpm/jobs/` — áreas a inspecionar e atualizar conforme o inventário.
- `tests/bpm/` — regressões do estado vazio e da ausência de regras antigas.
- Script/relatório de inventário, simulação e verificação: caminhos a definir pelo executor após inspeção; registrar aqui antes de concluir.

### Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-26 | 0.1 | Draft do reset completo, com escopo de cards/histórico confirmado e checkpoint Vault | River (@sm) |

## QA Results

- `npm run lint`: passou com 0 erros e 1.192 avisos preexistentes.
- `npm run typecheck`: passou.
- `npm test` após todas as mudanças: 529 arquivos/3.911 testes passaram; 1 arquivo/2 testes falharam em `tests/debug/error-bus.test.ts`, fora do escopo CRM. Quatro testes ignorados e um todo. Os 64 testes direcionados ao CRM alterado passaram.
- `npm run build` após todas as mudanças: passou.
- `node --check scripts/bpm-reset-completo.mjs` e ESLint direcionado: passaram.
- Board vazio: mensagem diferencia ausência de etapas de ausência de cards; checagem direcionada e typecheck repetidos após a edição.
- Quatro arquivos de testes BPM dirigidos às regras antigas: 23 testes passaram após a remoção; ESLint e typecheck dos arquivos alterados passaram.
- Quatro arquivos dirigidos ao board/modal: 41 testes passaram após atualizar o estado vazio e retirar a exceção de Boas-vindas.
- Execução autorizada e validação pós-operação pendentes.
