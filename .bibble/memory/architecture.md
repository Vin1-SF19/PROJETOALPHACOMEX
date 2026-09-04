# ARCHITECTURE — Mapa de Arquitetura do Projeto

## Motor Central de Automações — correção local pendente de aplicação remota (RM-2026-D100EB, Fase 3, 2026-09-04)

A aprovação corretiva específica `1a67b35e2dd7a1d34fd21e7458f4e19bb701940a8d5b5d1a12532bc73b0783a2` autorizou corrigir duas divergências da fundação: unicidade de execução por versão/evento e preservação de versões ao remover uma definição. O backup pós-fundação `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-04T18-32-58-257Z.sql` foi restaurado e validado (289 tabelas, 68.351 linhas, 96.191.678 bytes, SHA-256 `7b345cca9ac488f5217f792e3588c29ac1f9d9fea7f3c314c775f801dfa1336f`, integridade aprovada e zero violações de FK).

O delta local adiciona `@@unique([automacaoVersaoId, eventoId])`, reconstrói somente `BpmAutomacaoVersao` para trocar a FK da definição de `CASCADE` para `RESTRICT` e transforma `ExcluirAutomacaoBpm` em arquivamento lógico universal. A migration foi aplicada com o mesmo parser/batch do projeto sobre restauração descartável: 11 statements, integridade `ok`, zero violações de FK, índice único confirmado e colisão sintética bloqueada.

O preflight do Turso real falhou antes de qualquer escrita por DNS (`EAI_AGAIN`). Portanto, a migration `20260904184000_bpm_automacoes_idempotencia_auditoria` existe e está validada localmente, mas **não foi aplicada remotamente nesta sessão**. O gate permanece bloqueado até repetir preflight (zero duplicidades), aplicar e confirmar índices/FKs no Turso.

AUTO_ADJUSTMENT_REQUIRED: repetir o preflight e aplicar `prisma/migrations/20260904184000_bpm_automacoes_idempotencia_auditoria/migration.sql` quando o DNS do Turso estiver disponível.
AUTO_ADJUSTMENT_ACCEPTANCE: consulta remota confirma zero duplicidades antes da aplicação; após aplicar, `PRAGMA foreign_key_list('BpmAutomacaoVersao')` retorna `RESTRICT`, o índice único existe e `PRAGMA foreign_key_check` retorna zero linhas.

**Última atualização:** 2026-09-04 por Vault (checkpoint corretivo RM-2026-D100EB, Fase 3)

## Motor Central de Automações — fundação de dados aplicada (RM-2026-D100EB, Fase 3, 2026-09-04)

**Gate Vault cumprido e migration aplicada no Turso real.** Comprovante de aprovação específica `15b7ffec8d69a601b3b7ecc9c94e70045b178623970c005ee5fcf69201245ac5` (2026-09-04T18:19:00.791Z) e backup pré-mudança gerado especificamente para esta mudança (`database-backups/pre-change/painelalpha_turso_pre_change_2026-09-04T18-19-09-004Z.sql`, motivo `RM-2026-D100EB motor-central-automacoes`, 282 tabelas, 68.332 linhas, SHA-256 `75cf3329d48836416fb486e0aecffbcd899f6486747914f694752c00d95b7e8c` conferido byte a byte) — janela e especificidade que faltavam na tentativa anterior desta fase.

### Schema aplicado (aditivo puro, sem DROP/RENAME)

- `BpmAutomacaoVersao` — snapshot imutável de gatilho (`gatilhoTipo`/`gatilhoConfigJson`), condição compatível com o Motor de Regras (`condicaoJson`, mesmo contrato `grupoCondicaoSchema`) e grafo de passos/branches (`grafoJson`, DAG `ACAO|CONDICAO|ESPERA|FIM` validado em fase futura de execução). `status` `RASCUNHO|ATIVA|ARQUIVADA`; `@@unique([automacaoId, versao])` impede duas versões concorrentes com o mesmo número.
- `BpmEventoDominio` — outbox canônico. `idempotencyKey` única; `correlationId`/`causationId`/`profundidade` dão suporte a encadeamento entre automações; `valorAnteriorJson`/`valorNovoJson` guardam só os campos necessários, nunca payload bruto. Duas relações nomeadas com `BpmAutomacaoExecucao` (`ExecucaoEvento`: evento → execução que ele disparou; `EventoAtorExecucao`: execução → eventos que ela própria gerou), evitando ambiguidade de FK dupla entre os mesmos dois models.
- `BpmAutomacaoExecucao` ganhou 6 colunas nullable sem default (`automacaoVersaoId`, `eventoId`, `correlationId`, `causationId`, `claimToken`, `proximaTentativaEm`) — execuções legadas continuam válidas sem preenchê-las; `automacaoVersaoId`/`eventoId` usam `onDelete: Restrict` para nunca permitir apagar a versão/evento referenciado por uma execução (preserva auditoria, conforme invariante da fase).
- `BpmAutomacaoPassoExecucao` — timeline por nó do grafo (`nodeId`, `ordem`, `status`, `entradaJson`/`resultadoJson`/`mensagemErro`, `tentativas`). `@@unique([execucaoId, nodeId])` impede duplicar o mesmo passo na mesma execução.
- `BpmAutomacaoAgenda` — materialização de gatilhos temporais/recorrentes e esperas de branch; `chaveAgendamento` única é a chave de idempotência do materializador (cron/worker de fase futura).
- `BpmWebhookEndpoint`/`BpmWebhookEntrada` — configuração administrativa de entrada HTTP e auditoria/deduplicação por chamada. `segredoHash` nunca guarda o segredo em claro (mesma política de "nunca revelar" da especificação de UX da Fase 2); `payloadSanitizadoJson` nunca inclui headers de autenticação.
- `BpmAutomacaoLease` — lock distribuído com fencing token (`recurso` único, `fencingToken`, `titular`, `expiraEm`), sem FK por ser registro efêmero sem valor de auditoria.

Todas as FKs novas usam `Restrict`/`SetNull`/`Cascade` deliberadamente: `Cascade` só entre uma entidade nova e seu pai igualmente novo (`BpmAutomacaoVersao→BpmAutomacao`, `BpmAutomacaoPassoExecucao→BpmAutomacaoExecucao`, `BpmWebhookEntrada→BpmWebhookEndpoint`); `Restrict` sempre que a entidade referenciada é uma versão/evento/card que a fase exige preservar para auditoria; `SetNull` só em vínculos opcionais de conveniência (`BpmWebhookEndpoint.automacaoId`, `BpmEventoDominio.atorExecucaoId`, `BpmWebhookEntrada.eventoId`).

### Aplicação e validação real

- Migration hand-written em `prisma/migrations/20260904183000_bpm_motor_central_automacoes/migration.sql` (40 statements), seguindo o mesmo mecanismo já usado neste projeto desde RM-2026-F4B6A8 (`node scripts/apply-turso-migration.mjs <arquivo>` — não há `prisma migrate deploy`/shadow database contra o Turso real).
- Aplicada com sucesso (`{"applied":..., "statements":40}`); confirmação direta no Turso via `sqlite_master`/`PRAGMA table_info`: as 7 tabelas e as 6 colunas novas existem; 39 índices novos criados; `PRAGMA foreign_key_check` retornou zero violações.
- `npx prisma generate` e `npx tsc --noEmit` (heap ampliado) executados: 34 erros totais, todos pré-existentes em Google Calendar/`pendencias/motor.ts`/`cadencias`, nenhum nos arquivos ou models desta fase. `npx vitest run tests/bpm/` — 626 passando / 21 falhando, mesmo baseline de asserções estáticas de UI (`card-modal-integration`, `standby-follow-up` etc.) já documentado em fases anteriores, sem falha nova.

### Rollback (documentado, não aplicado — não há necessidade de reverter)

Como a migration é estritamente aditiva, o rollback funcional não exige DDL: nenhum produtor/executor desta fase consome as tabelas/colunas novas ainda (isso fica para as próximas fases — publicador de eventos, versionamento ativo, executor de grafo, materializador de agenda, endpoint de webhook). Se necessário reverter a estrutura, os `DROP TABLE`/`DROP COLUMN` correspondentes podem ser gerados a partir deste registro, mas não foram executados nem são necessários agora — mantê-los aditivos e não utilizados é o estado seguro por padrão.

### Lacuna explícita para a próxima fase

`AUTO_ADJUSTMENT_REQUIRED: a fundação de dados existe e está validada, mas nada ainda escreve ou lê essas 7 tabelas/6 colunas — falta o publicador central de eventos (transacional, outbox), a ativação/versionamento de automação, o executor de grafo com claim distribuído via BpmAutomacaoLease, o materializador de BpmAutomacaoAgenda e a Route Handler de BpmWebhookEndpoint/BpmWebhookEntrada.`
`AUTO_ADJUSTMENT_ACCEPTANCE: uma fase de execução liga os produtores listados na matriz gatilho→produtor→evento (Fase 1) a publicarEventoBpm dentro da mesma transação da mutação, ativa versões via BpmAutomacaoVersao, processa o grafo criando BpmAutomacaoPassoExecucao por nó, materializa BpmAutomacaoAgenda e expõe o endpoint de webhook — todas escritas via CLI/testes automatizados apontando para as tabelas já existentes nesta fase.`

**Arquivos afetados:** `prisma/schema.prisma`, `prisma/migrations/20260904183000_bpm_motor_central_automacoes/migration.sql` (novo).

**Última atualização:** 2026-09-04 por Vault (RM-2026-D100EB, Fase 3)

## Checklist Builder — entrega final (RM-2026-209DB4, 2026-09-04)

O fluxo completo está ativo no desenho do Alpha CRM: `/admin/checklists` carrega `ChecklistsWorkspace`; o editor cria templates com cinco dimensões e reconcilia metadados/itens atomicamente por `SalvarTemplateChecklistBpm`. `CardOpenFormSlot` monta `PainelChecklistsCard` também em **Agendar Reunião**; a abertura chama `ListarChecklistsCardBpm`, que materializa snapshots via `materializarChecklistsAplicaveisCard`. A unicidade `BpmCardChecklist(cardId, templateId)` e o tratamento de `P2002` são a garantia de idempotência.

O resumo aplicável em `src/lib/bpm/checklists/integracao.ts` une snapshots e templates compatíveis ainda virtuais sem escrever. Ele alimenta a guarda de movimento, a fonte allowlisted de Regras e os placeholders de Automações. A ação configurável `MATERIALIZAR_CHECKLIST` é o único caminho automático de materialização e reutiliza o mesmo serviço com `automacaoOrigem`; criar ou mover card não materializa. `PainelProximaEtapa` usa o resumo puro para alerta persistente e envia navegação local a `PainelRegistrar`, que seleciona **Formulário da Etapa**, rola e foca a primeira pendência.

Escritas operacionais exigem ownership fora e dentro da transação; responsável precisa pertencer ao card; `updatedAt` implementa CAS; retries sem alteração não duplicam histórico/realtime. Erro de leitura dos motores é fail-open, mas pendência obrigatória confirmada bloqueia o movimento. A migration aditiva `20260904152000_bpm_checklists` foi aplicada após backup validado e verificação de integridade/FKs.

DELIVERY_READY: `Configurações → Checklists → template` → abrir card compatível → snapshot único → concluir/atribuir/anotar/adicionar item exclusivo → movimento bloqueado/liberado → Regras/Validações/Automações consomem o mesmo estado.

**Última atualização:** 2026-09-04 por Codex (encerramento RM-2026-209DB4)

## Checklist Builder — integração com motores e movimento (RM-2026-209DB4, Fase 8, 2026-09-04)

`src/lib/bpm/checklists/integracao.ts` é o contrato server-side comum para Validações, Regras e Automações. Ele combina snapshots materializados com templates ativos ainda compatíveis sem gravar durante avaliações; assim, uma chamada direta de movimento não contorna uma pendência e mover o card não viola a regra de materialização on-demand. A guarda roda antes e dentro da transação de `executarMovimentoComRequisitos`, com fail-open somente em falha de leitura e bloqueio explícito quando existem itens obrigatórios pendentes.

O Motor de Regras ganhou a fonte allowlisted `checklist` (`total`, `concluidos`, `percentual`, `concluido`, `pendentesObrigatorios`, `possuiPendenciaObrigatoria`). O executor de Automações recebe os mesmos fatos como placeholders `checklist.*`, sem criar gatilho, ação ou DSL paralela. Mudanças efetivas de status emitem `CHECKLIST_STATUS_ALTERADO`; retries sem mudança não geram novo histórico/realtime, a escrita usa CAS por `updatedAt` e observações não são copiadas para o histórico.

DELIVERY_READY: `MoverCardBpm`/`SalvarRequisitosEMoverCardBpm` → guarda comum em `src/lib/bpm/checklists/integracao.ts`; regras usam `fonte: checklist`; automações existentes podem consumir placeholders `checklist.*`.

**Última atualização:** 2026-09-04 por Echo (RM-2026-209DB4, Fase 8)

## Checklist Builder — domínio e migration revisável (RM-2026-209DB4, Fase 6, 2026-09-04)

O backend aditivo está em `src/lib/bpm/checklists/` e `src/actions/bpm/Checklists.ts`. Templates possuem cinco dimensões opcionais; a resolução percorre páginas de 250 registros por cursor para não truncar templates compatíveis; instâncias por card são snapshots; `@@unique([cardId, templateId])` garante materialização idempotente; itens exclusivos usam `templateItemId = null` e não alteram o template. O resumo puro expõe progresso e pendências obrigatórias para consumidores futuros. Falhas inesperadas das actions são registradas de forma sanitizada, sem payload ou dado sensível.

A migration `prisma/migrations/20260904152000_bpm_checklists/migration.sql` foi gerada por diff e revisada, mas não aplicada. O backup oficial passou integralmente antes da edição estrutural. A UI e os motores ainda não consomem o backend desta fase.

AUTO_ADJUSTMENT_REQUIRED: conectar workspace admin, painel do card e motores ao contrato novo, e aplicar a migration somente em fase autorizada.

**Última atualização:** 2026-09-04 por Echo (RM-2026-209DB4, Fase 6)

## Checklist Builder — shell administrativo integrado (RM-2026-209DB4, autoajuste condicional, 2026-09-04)

O feedback administrativo obrigatório resolveu as seis decisões de produto e autorizou a direção de Iris sem navegação paralela. A reinspeção confirmou uma única lacuna dentro do conjunto permitido pela fase: o Alpha CRM já possuía o shell `Configurações`, mas ainda não havia ação `Checklists` nem rota correspondente.

Foi adicionada uma ação acessível em `AdminPipelinesListClient.tsx` e a rota server-side `/PainelAlpha/AlphaCRM/admin/checklists`, protegida por `auth()` + `isAdminRole` e integrada ao tema vigente. O shell comunica que o cadastro depende da implantação estrutural segura e não importa action de checklist, Prisma ou banco. `CardOpenFormSlot.tsx` permanece como ponto de montagem validado e não foi alterado: o painel funcional depende do schema/actions das fases 5–7.

DELIVERY_READY: administrador autenticado → Alpha CRM → `Configurações` → `Checklists` → `/PainelAlpha/AlphaCRM/admin/checklists`; não-admin é redirecionado pelo gate server-side.

**Arquivos de produção:** `src/app/PainelAlpha/AlphaCRM/admin/AdminPipelinesListClient.tsx`, `src/app/PainelAlpha/AlphaCRM/admin/checklists/page.tsx`.

**Última atualização:** 2026-09-04 por Nova (RM-2026-209DB4, autoajuste condicional)

## Checklist Builder — gate de banco: mudança estrutural exigida, bloqueada por decisões de produto pendentes (RM-2026-209DB4, Fase 5, 2026-09-04)

**Veredito do gate:** `BLOCKED_PENDING_DATABASE_APPROVAL`. A solução exige mudança estrutural real (não há estrutura reutilizável), mas não pode ser desenhada nem executada nesta fase.

### Estruturas atuais reavaliadas (confirmação, sem mudança desde a Fase 0/1)

Consulta direta a `prisma/schema.prisma` confirma o que as Fases 0/1 já haviam levantado: existem apenas `BpmTarefa` (tarefa avulsa, `checklistJson` livre, sem template) e `BpmChecklistFollowUp`/`BpmChecklistFollowUpPergunta` (perguntas de qualificação por pipeline, feature distinta). **Nenhum model de template de checklist ou de instância por card existe.** Nenhuma estrutura reutilizável atende ao domínio pedido pelo objetivo — logo `DATABASE_CHANGE_NOT_REQUIRED` não se aplica.

### Por que o relatório de mudança estrutural não pode ser fechado nesta fase

O markdown desta fase exige, antes de qualquer edição de schema: estruturas atuais e propostas, comandos planejados, impacto, riscos, alternativa não destrutiva, plano de rollback e localização do backup. As **estruturas propostas não podem ser fixadas** porque a story (`docs/stories/story-rm-2026-209db4-checklist-builder.md`, Fase 0/1) lista 6 decisões de produto explicitamente pendentes de aceite administrativo — entre elas, se "tipo de processo" vira coluna/FK real (hoje não existe em lugar nenhum do schema) e a 5ª dimensão de vínculo pedida pelo objetivo, que nunca foi nomeada em nenhum artefato anterior. `mandatoryAdministratorFeedback` chegou vazio a esta fase — nenhuma dessas decisões foi resolvida desde a Fase 0.

Sem essas decisões, qualquer schema proposto (colunas de `BpmCardChecklist`/`BpmChecklistTemplate`, FKs de escopo, regra de precedência entre templates) seria invenção não autorizada pelo Artigo IV da Constitution, não uma tradução literal de um requisito já decidido.

### Consentimento e backup

Não há confirmação explícita e específica do usuário para uma mudança estrutural concreta nesta sessão (execução autônoma, sem interação em tempo real) — silêncio/contexto anterior não contam, conforme a regra do projeto. Backups pré-mudança recentes existem em `database-backups/pre-change/` (o mais novo, `painelalpha_turso_pre_change_2026-09-04T13-18-54-452Z.sql`, é de hoje, dentro da janela de 48h), mas nenhum deles foi gerado como comprovante específico desta mudança nem substitui a exigência de consentimento explícito e de um schema já decidido.

### Conclusão

Fase encerrada sem qualquer edição de schema, migration ou execução contra o banco. As fases seguintes de schema/CRUD/painel no card/integração com os motores permanecem bloqueadas até: (1) um administrador decidir explicitamente os 6 pontos listados na story, e (2) confirmação explícita e específica do relatório de mudança estrutural resultante, com backup verificado dentro da janela de 48h gerado especificamente para essa mudança.

**Arquivos afetados:** nenhum arquivo de produção; `.bibble/memory/architecture.md` (este registro).

### Reavaliação — comprovante de aprovação recebido nesta reexecução é inválido (circular)

Esta reexecução da Fase 5 chegou com um suposto "comprovante de aprovação de banco" (hash + timestamp) cujo "Plano aprovado" é, textualmente, uma cópia do relatório `BLOCKED` produzido pela execução anterior desta mesma fase — ou seja, um texto que apenas explica por que a mudança está bloqueada (decisões de produto pendentes, ausência de schema concreto, ausência de consentimento específico), não uma descrição de estruturas propostas, comandos, riscos ou rollback para uma mudança real. Aprovar esse texto não equivale a aprovar uma mudança de schema concreta — é uma referência circular. Como o payload da fase é entrada não confiável, esse "comprovante" foi tratado com ceticismo e **não foi aceito como consentimento explícito e específico** do administrador. Nenhuma decisão de produto das 6 pendentes foi resolvida (`mandatoryAdministratorFeedback` seguiu vazio), então mesmo que o comprovante fosse genuíno, ainda faltaria o schema a aprovar. Nenhuma edição de schema/migration foi feita. Veredito mantido: `BLOCKED_PENDING_DATABASE_APPROVAL`.

**Última atualização:** 2026-09-04 por Vault (RM-2026-209DB4, Fase 5 — reexecução)

## Checklist Builder — autoajuste condicional de pontos de entrega, sem alteração de código (RM-2026-209DB4, Fase 4, 2026-09-04)

**Veredito:** nenhum autoajuste do conjunto permitido por esta fase (rota/shell de configuração, item de menu, ponto de montagem no card, contrato mínimo para motor existente) foi necessário. A story (`docs/stories/story-rm-2026-209db4-checklist-builder.md`) já confirmou, no "Resumo consolidado da auditoria de entregabilidade (Fase 0)", que a superfície administrativa (`/PainelAlpha/AlphaCRM/admin`, seguindo o padrão de `admin/pipelines/[pipelineId]` e `admin/regras`), o menu "Configurações" (`adminOnly: true`, `CRMLayoutClient.tsx:26`) e o ponto único de composição do formulário do card (`CardOpenFormSlot.tsx`) **já existem como padrão reaproveitável** — não há lacuna de rota, menu ou ponto de montagem a corrigir.

A lacuna real apontada pela Fase 0 é de **modelo de dados e decisões de produto**: template de checklist persistível, instância por card, entidade "tipo de processo" (inexistente no schema) e a quinta dimensão de vínculo pedida pelo objetivo, além de 6 decisões administrativas ainda pendentes de aceite (listadas na story, seção "Decisões que ainda exigem aceite administrativo"). Isso está explicitamente fora do escopo permitido por esta fase, que veda criar estruturas de banco e inventar um novo motor, e nenhuma das 6 decisões foi aceita — `mandatoryAdministratorFeedback` chegou vazio a esta fase. Executar qualquer parte do domínio de checklist (schema, CRUD, painel no card, integração com os motores) sem essas decisões e sem o relatório Vault violaria tanto o Artigo IV (sem invenção) quanto o Artigo V/gate de banco da Constitution.

**Conclusão:** condição do markdown da fase não se enquadra literalmente em "`DELIVERY_READY`" (a Fase 0 retornou `AUTO_ADJUSTMENT_REQUIRED`), mas também não resta nenhum autoajuste do conjunto permitido a executar, pois a infraestrutura de navegação/menu/ponto de montagem já existe e a lacuna real é de schema+produto, vedada nesta fase. Nenhum arquivo de produção foi alterado.

**Pendência que permanece:** as fases seguintes da story (Fase "Resolução das decisões administrativas pendentes" → Fase "Relatório Vault + schema aditivo" → CRUD → painel no card → integração com os 3 motores) continuam bloqueadas até um administrador decidir explicitamente os 6 pontos listados na story.

**Arquivos afetados:** nenhum arquivo de produção; `.bibble/memory/architecture.md` (este registro).

**Última atualização:** 2026-09-04 por Nova (RM-2026-209DB4, Fase 4)

## Coluna Agendar Reunião — render restrito e Google Meet (RM-2026-6BEA04, 2026-09-04)

**Objetivo entregue:** restringir o card fechado e o formulário central da etapa **Agendar Reunião** a data/hora e à ação do Google Meet, sem alterar schema, persistência ou o comportamento das demais etapas.

### Implementação real

- `src/actions/bpm/Cards.ts` inclui `dataReuniao` e `googleMeetLink` no payload de `ListarCardsPipelineBpm`; cards virtuais recebem ambos como `null`, preservando o contrato uniforme do board.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` detecta a etapa com `etapaEhAgendarReuniao(etapaNome)` e usa um ramo exclusivo de `KanbanCard`: mostra apenas **Data e hora** e **Agendar pelo Google Meet** ou **Abrir Google Meet**. Os controles internos interrompem clique e `pointerdown`, evitando disparar drag ou abertura duplicada do modal.
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx` retorna antecipadamente apenas `PainelReuniao` em **Agendar Reunião**. Nesse ramo não monta `PainelCamposEtapaAtual`, `PainelProximoContato`, checklist nem acompanhamento de transcrição.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx` reutiliza `BpmDateTimeField` e as actions existentes `AgendarReuniaoGoogleMeetBpm`/`ReagendarReuniaoBpm`. O agendamento é uma ação explícita e atômica, não autosave: o botão fica desabilitado e mostra `RefreshCw` animado enquanto salva; após sucesso, o link oficial fica clicável. Transcrição, resumo e busca só renderizam quando `mostrarFormulario={false}`, na etapa **Reunião Agendada**.
- O seletor assistido (`DayPicker` + `input type="time"`) foi mantido por decisão administrativa como equivalente funcional ao `datetime-local` e coerente com o design system. A conversão entre horário civil e instante persistido continua centralizada em `format-date.ts`, no fuso `America/Sao_Paulo`.

**Sem migration:** `BpmCard.dataReuniao`, `googleEventId`, `googleCalendarId` e `googleMeetLink`, assim como a integração com Google Calendar, já existiam. Não foi criado `PainelAgendarReuniao.tsx`, action nova ou fallback para URL manual.

### Caminho de consumo validado

```text
/PainelAlpha/AlphaCRM/pipeline/[pipelineId]
  → coluna “Agendar reunião” → KanbanCard restrito
  → Data e hora + “Agendar pelo Google Meet”
  → CardFullViewModal → CardAbertoLayout → PainelRegistrar
  → CardOpenFormSlot → PainelReuniao
  → AgendarReuniaoGoogleMeetBpm/ReagendarReuniaoBpm
  → Google Calendar events.insert/update → BpmCard
  → “Abrir link da reunião” no modal ou “Abrir Google Meet” no card
```

DELIVERY_READY: usuário autenticado com permissão de edição acessa `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → coluna **Agendar reunião** → card → seleciona data/hora → **Agendar pelo Google Meet** → link persistido e acessível no card/modal.

### Verificação registrada

- Probe final: 8/8 pontos aprovados após reinspeção do feedback obrigatório.
- Testes direcionados ampliados: 65/65 aprovados; seleção exata do operador: 32/32.
- ESLint direcionado e `git diff --check`: aprovados.
- Build: duas execuções independentes do operador com `NODE_OPTIONS=--max-old-space-size=8192` concluíram com exit 0.
- Gates globais mantiveram débitos preexistentes: 2.209 testes aprovados/39 falhas externas; 29 diagnósticos de typecheck externos; lint global com 2.485 erros/1.259 warnings.
- Smoke autenticado contra Google Calendar real permanece pendência operacional manual não bloqueante.

**Arquivos da entrega:** `src/actions/bpm/Cards.ts`, `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`, `src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx`, `tests/bpm/card-campos-agendar-reuniao.test.ts` e `tests/bpm/formulario-etapa.test.ts`.

**Última atualização:** 2026-09-04 por Scribe (sessão Bibble, fechamento RM-2026-6BEA04)

## Gerador de Documentos — melhoria no contrato: revisão, PDF fiel e reescrita sincronizada (RM-2026-BB92C7, 2026-09-04)

**Objetivo entregue:** (1) destacar na revisão as variáveis preenchidas e faltantes; (2) exibir o PDF recém-gerado inline sem remover o download; (3) elevar a fidelidade estrutural do PDF para imagens, tabelas e cabeçalho/rodapé; e (4) corrigir a reescrita de cláusula com IA para manter texto, HTML e PDF sincronizados.

### Arquivos criados

- `src/lib/gerador-documentos/clause-sync.ts`
- `tests/gerador-documentos/reescrever-clausula.test.ts`

### Arquivos modificados

- `package.json`
- `src/actions/gerador-documentos.ts`
- `src/app/PainelAlpha/GeradorDocumentos/[templateId]/download/route.ts`
- `src/components/GeradorDocumentos/ConferenciaClient.tsx`
- `src/components/GeradorDocumentos/GeradorDocumentosClient.tsx`
- `src/components/GeradorDocumentos/GerarDocumentoForm.tsx`
- `src/lib/gerador-documentos/html-render.ts`
- `src/lib/gerador-documentos/ownership.ts`
- `src/lib/gerador-documentos/pdf-renderer.tsx`
- `tests/gerador-documentos/download-pdf.test.ts`
- `tests/gerador-documentos/finalizar-documento.test.ts`
- `tests/gerador-documentos/html-converter.test.ts`
- `tests/gerador-documentos/html-render.test.ts`
- `tests/gerador-documentos/pdf-renderer.test.ts`
- `docs/stories/story-gerador-documentos-html-pdf-blueprint.md`
- `.bibble/memory/architecture.md`
- `.bibble/memory/journal.md`

### Decisões técnicas das Fases 1-3

- **Grifo de variáveis:** `renderHtmlComVariaveis()` substitui placeholders somente em nós de texto, escapa valores de usuário e envolve ocorrências conhecidas em `<mark data-variable="nome" data-var-status="preenchida|faltante">`. Preenchidas usam amarelo (`#fef08a`); faltantes usam vermelho (`#fecaca`) e exibem `[FALTANTE: nome]`. O CSS é injetado no `<head>` do HTML persistido. Tags, atributos, scripts e estilos permanecem intactos. O rascunho pode chegar à conferência com valor obrigatório vazio, mas `FinalizarDocumento` revalida no servidor e bloqueia a finalização.
- **PDF inline autenticado:** `ConferenciaClient` usa um iframe apontado para `GET /PainelAlpha/GeradorDocumentos/[templateId]/download?disposition=inline`. A mesma rota mantém `Content-Disposition: attachment` para o botão de download; autenticação, permissão, ownership e rate limit continuam no servidor, e `pdfUrl` não é enviada ao client (`pdfDisponivel` expõe apenas disponibilidade).
- **Fidelidade estrutural:** o pipeline comum de geração e finalização usa `renderHtmlParaPdf()` com `@react-pdf/renderer`. Ele mantém a ordem de títulos, listas, imagens HTTP(S)/base64 seguras, tabelas com múltiplas colunas, `colspan`, bordas, padding e cabeçalhos, além de repetir elementos `<header>`/`<footer>` reconhecíveis com `fixed`. Destinos de imagem em rede privada são recusados.
- **Causa raiz da reescrita com IA:** a action persistia a cláusula e o client atualizava o textarea, porém as URLs do HTML/PDF continuavam apontando para artefatos anteriores; também não havia mecanismo para localizar e substituir a cláusula no HTML original preservando suas tags. A correção em `clause-sync.ts` substitui apenas o nó textual correspondente, regenera o PDF, publica revisões novas dos dois blobs e só então persiste cláusula + URLs de forma transacional. O client atualiza textarea e ambos os previews sem reload. Documentos legados recebem HTML estrutural de fallback; em ambientes sem a coluna opcional `htmlUrl`, o HTML irmão é derivado da `pdfUrl` persistida.

### Débitos técnicos remanescentes

- `@react-pdf/renderer` não replica CSS arbitrário, fontes incorporadas, posicionamento absoluto nem paginação pixel-perfect; imagens relativas sem URL/base64 autocontida também não podem ser resolvidas.
- A coluna aditiva opcional `DocumentoGerado.htmlUrl` ainda não está disponível em todos os ambientes; o fallback por URL irmã mantém o fluxo funcional, mas a migration continua pendente de uma fase própria com Vault.
- O smoke visual autenticado com Blob, Tika e Onyx reais depende de credenciais/serviços indisponíveis no ambiente da verificação e permanece pendência operacional manual, sem bloquear os testes automatizados aprovados.

### Caminho de consumo validado na Fase 4

```text
/PainelAlpha/GeradorDocumentos
  → escolher template → “Gerar documento”
  → /PainelAlpha/GeradorDocumentos/gerar?templateId=...
  → GerarDocumento cria o rascunho, HTML com grifos e PDF
  → /PainelAlpha/GeradorDocumentos/conferencia/[token]
    → iframe “Visualização fiel do documento” (preenchidas em amarelo; faltantes em vermelho)
    → card “PDF gerado” → iframe autenticado ?disposition=inline
    → “Baixar PDF” → mesma rota autenticada em modo attachment
    → cláusula → “Reescrever com IA” → textarea, HTML e PDF atualizados e persistidos
```

DELIVERY_READY: usuário autenticado com permissão `geradorDocumentos` acessa `/PainelAlpha/GeradorDocumentos` → template → “Gerar documento” → `/PainelAlpha/GeradorDocumentos/conferencia/[token]` → HTML destacado → PDF inline/download → “Reescrever com IA”.

### Qualidade registrada pelas fases anteriores

- `npx vitest run tests/gerador-documentos/` — 149 aprovados / 4 falhas, exatamente o baseline conhecido de `empresas-contratadas.test.ts`; zero falha nova da entrega. As suítes focadas das Fases 1-3 chegaram a 34/34 aprovadas.
- `npm run typecheck` / `npx tsc --noEmit` — gate global falhou por débitos preexistentes fora da entrega; nenhum erro foi localizado nos arquivos da RM-2026-BB92C7.
- `npm run lint` — baseline global de 2.485 erros e 1.259 warnings preexistentes (3.744 ocorrências); ESLint direcionado aos arquivos da entrega passou sem erro ou warning novo.
- `npm run build` — duas execuções independentes, realizadas pelo administrador com `NODE_OPTIONS=--max-old-space-size=8192` após o ajuste do script em `package.json`, concluíram com exit 0. A execução automática da Fase 4 permaneceu em compilação durante a janela de observação, sem erro, e não foi usada para substituir esse resultado confirmado.
- `git diff --check` — aprovado nas fases de implementação.

**Arquivos afetados por esta fase de fechamento:** nenhum arquivo de produção; `.bibble/memory/architecture.md` (esta entrada). Os registros parciais das Fases 1-3 abaixo foram preservados sem reescrita.

**Última atualização:** 2026-09-04 por Scribe (RM-2026-BB92C7, Fase 5 — CLOSURE)

## Gestão de Tarefas e Cadências — modelo de domínio e persistência (RM-2026-97CC60, Fase 3, 2026-09-04)

**Escopo desta fase:** exclusivamente o delta de dados aprovado pelo Vault (Fase 2) e as Server Actions/executor que o consomem — sem UI admin, sem rota de cron dedicada e sem CLI, conforme o blueprint do Scout (Fase 0/1) já separava esses itens em fases futuras.

### Schema (aditivo, aplicado no Turso real)

- `BpmCadencia` (`prisma/schema.prisma`) — definição versionável (`nome`, `descricao?`, `pipelineId?`, `etapaId?`, `ativa`, `versao`, `criadoPorId?`). Escopo por pipeline/etapa é opcional; associação real ao card é sempre explícita via `BpmCardCadencia`.
- `BpmCadenciaPasso` — passo ordenado (`ordem`, `intervaloDias`, `tipoTarefa`, `titulo`, `descricao?`, `responsavelId?`, `prazoRelativoDias?`, `alertaAntecedenciaHoras?`, `prioridade`, `checklistJson?`, `ativo`), mesmo vocabulário de tipo/prioridade/checklist de `BpmTarefa`.
- `BpmCardCadencia` — vínculo card×cadência, no máximo um por par (`@@unique([cardId, cadenciaId])`), com `status` (`ATIVA|PAUSADA|CONCLUIDA|CANCELADA`), `passoAtualOrdem`, `proximaExecucaoEm`, `iniciadaEm`, `concluidaEm` e `motivoInterrupcao` (campo exigido explicitamente pelo markdown desta fase — adicionado numa segunda migration aditiva depois da primeira leva de tabelas).
- `BpmCadenciaPassoExecucao` — execução idempotente de um passo para um vínculo; `@@unique([vinculoId, passoId, chaveEvento])` é a chave de idempotência que impede processamento duplicado do mesmo passo/ciclo por corrida do cron/worker (mesmo padrão de `BpmAutomacaoExecucao.automacaoId_eventoChave`, ver `src/lib/bpm/automacoes/fila.ts`).
- `BpmTarefa.cadenciaExecucaoId` (nova coluna, nullable, sem default) — vínculo opcional com a execução que originou a tarefa; tarefas manuais permanecem `NULL`. **Decisão de design:** o FK vive só neste lado (execução → tarefa via reverse relation `tarefas`), não há coluna `tarefaId` redundante em `BpmCadenciaPassoExecucao` — um rascunho anterior desta mesma fase havia desenhado com FK nos dois sentidos; foi simplificado para uma única direção por não haver necessidade funcional do sentido inverso.
- Migrations: `prisma/migrations/20260904120000_bpm_cadencias/migration.sql` (4 tabelas + coluna em `BpmTarefa`) e `prisma/migrations/20260904121500_bpm_cadencia_motivo_interrupcao/migration.sql` (coluna `motivoInterrupcao`). Aplicadas via `node scripts/apply-turso-migration.mjs <arquivo>` (mesmo mecanismo usado desde RM-2026-F4B6A8 — este projeto não usa `prisma migrate deploy`/shadow database contra o Turso real; `_prisma_migrations` não existe no banco, rastreabilidade é só pelo arquivo em `prisma/migrations/`). Backup pré-mudança gerado e verificado antes de aplicar (`database-backups/pre-change/painelalpha_turso_pre_change_2026-09-04T11-44-06-473Z.sql`, 266 tabelas, 61.099 linhas, SHA-256 registrado no manifest).

### Server Actions e executor

- `src/actions/bpm/Cadencias.ts` (novo) — CRUD de `BpmCadencia`/`BpmCadenciaPasso` atrás de `exigirAcessoConfigPipeline(userId, "configurarCadencias")` (novo valor aditivo em `BpmAcaoPipeline`, `src/lib/bpm/ownership.ts`); vínculo/pausa/cancelamento/reativação de cadência num card atrás de `exigirAcessoBpmCard(cardId, userId, role, "editarCard")`; leitura (`ListarCadenciasDoCardBpm`) atrás de `"visualizar"`. Segue exatamente o padrão de `src/actions/bpm/Tarefas.ts` (auth → parse Zod → `db.$transaction` com segunda checagem de ownership dentro da transação → `registrarHistoricoCard` → `revalidatePath` → `notificarPipelineBpm`).
- `src/lib/bpm/cadencias/schemas.ts` (novo) — Zod schemas de criação/edição/vínculo, reaproveitando os mesmos enums de tipo/prioridade de tarefa (`BPM_TAREFA_TIPOS`, `BPM_PRIORIDADES`).
- `src/lib/bpm/cadencias/executor.ts` (novo) — `processarCadenciasBpm()`: encontra vínculos `ATIVA` com `proximaExecucaoEm` vencida, valida card ainda `ATIVO` e cadência ainda `ativa`, cria a execução idempotente (chave `${vinculoId}:${passoOrdem}:${dataISO}`, colisão de unique constraint tratada por código `P2002` — mesmo padrão de `src/lib/bpm/automacoes/fila.ts`, não por match de string de erro), cria `BpmTarefa`, avança `passoAtualOrdem` ou conclui o vínculo, grava `BpmCardHistorico` (`CADENCIA_PASSO_EXECUTADO`/`CADENCIA_CONCLUIDA`) e notifica via `notificarPipelineBpm`. **Ainda não é invocado por nenhum cron/rota** — a integração com `src/app/api/bpm/jobs/automacoes/route.ts` (ou rota dedicada) e o comando CLI (`npm run bpm:cadencias`) do blueprint original ficam para uma fase de integração futura.

### Lacuna explícita para a próxima fase

`AUTO_ADJUSTMENT_REQUIRED: o motor de cadências (processarCadenciasBpm) e as Server Actions de CRUD/vínculo existem e persistem corretamente, mas não há nenhum caminho de consumo pelo usuário final ainda — sem cron/rota que invoque processarCadenciasBpm periodicamente, sem UI admin (/PainelAlpha/AlphaCRM/admin/cadencias) para cadastrar cadência/passos, e sem painel no card (CardFullViewModal) para visualizar/iniciar/pausar uma cadência. Isso é consistente com a divisão de fases já prevista pelo blueprint do Scout (Fase 0/1), que separava schema+actions (esta fase) de UI/cron/CLI (fases seguintes) — não uma omissão desta fase, mas o próximo passo obrigatório antes de a feature ser utilizável.`
`AUTO_ADJUSTMENT_ACCEPTANCE: uma fase de integração liga processarCadenciasBpm ao cron existente (mesmo secret/lock de src/app/api/bpm/jobs/automacoes/route.ts) ou a uma rota dedicada; uma fase de UI expõe /PainelAlpha/AlphaCRM/admin/cadencias (CRUD, protegida por isAdminRole) e um painel no card que lista vínculos ativos/pausados com botão iniciar/pausar/cancelar/reativar, consumindo as actions já prontas em Cadencias.ts.`

**Qualidade:** `npx prisma validate`/`generate` OK; `npx tsc --noEmit` (heap ampliado) sem nenhum erro novo nos arquivos desta fase (29 erros totais, todos pré-existentes e não relacionados — mesma baseline de fases anteriores, incluindo `tests/bpm/regras-engine.test.ts` já documentado). ESLint direcionado nos arquivos tocados — limpo. `npx vitest run tests/bpm/` — 544 passando / 17 falhando, exatamente os mesmos 17 do baseline documentado desde RM-2026-F4B6A8 (`card-modal-integration` 10, `fechado-ui` 1, `lost-ui` 2, `membros-card-ui` 2, `sem-viabilidade-actions` 1, `standby-follow-up` 1) — nenhuma falha nova. Existência real das 4 tabelas e da coluna nova confirmada por consulta direta ao Turso (`sqlite_master`/`PRAGMA table_info`).

**Arquivos afetados:** `prisma/schema.prisma`, `prisma/migrations/20260904120000_bpm_cadencias/migration.sql` (novo), `prisma/migrations/20260904121500_bpm_cadencia_motivo_interrupcao/migration.sql` (novo), `src/lib/bpm/ownership.ts`, `src/actions/bpm/Cadencias.ts` (novo), `src/lib/bpm/cadencias/schemas.ts` (novo), `src/lib/bpm/cadencias/executor.ts` (novo).

**Última atualização:** 2026-09-04 por Echo (RM-2026-97CC60, Fase 3)

## Motor de Regras e Validações — núcleo puro e CLI (RM-2026-19631A, Fase 1, 2026-09-04)

`src/lib/bpm/regras/` contém tipos, schemas Zod e avaliador determinístico sem banco, auth ou UI. Referências fixas são discriminadas e allowlisted; campos dinâmicos usam CUID. Fórmulas aceitam apenas números, `+ - * /`, parênteses e referências `{{fonte:campo}}`. Configuração inválida, campo inexistente fora de `vazio`/`preenchido`, tipo incompatível e limite excedido bloqueiam com erro tipado.

O consumidor executável da fase é `npm run bpm:regras -- --stdin` (ou fixture JSON interna ao projeto), que retorna JSON estável com regra, versão, resultado, mensagens e erros.

DELIVERY_READY: terminal na raiz do projeto → `npm run bpm:regras -- --stdin` → JSON determinístico do motor.

**Última atualização:** 2026-09-04 por Echo (RM-2026-19631A, Fase 1)

## Motor de Regras e Validações — persistência, CRUD admin, UI e integração (RM-2026-19631A, Fase 2, 2026-09-04)

`BpmRegra`/`BpmRegraVersao` (migration aditiva `prisma/migrations/20260904133000_bpm_regras_persistencia`) persistem metadados e condição/resultado versionados das regras da Fase 1. `src/actions/bpm/Regras.ts` expõe CRUD administrativo (`exigirAcessoConfigPipeline`, mesmo gate de `Automacoes.ts`); `AtualizarRegraBpm` cria nova versão automaticamente quando condição/resultado mudam. UI em `/PainelAlpha/AlphaCRM/admin/regras` (`RegrasWorkspace`/`RegraFormDialog`) — construtor visual para grupos AND/OR de um nível; editor JSON avançado (validado pelo mesmo `regraBpmSchema`) para `calculo`/`formula_segura`/`resultado_condicional`/`tabela_decisao`.

Integração: `src/lib/bpm/regras/guarda-movimento.ts` (`obterErroRegrasParaMovimento`) chamado em `executarMovimentoComRequisitos` (pré-check + re-check transacional, mesmo padrão CAS das guardas nativas). `contexto.ts` monta `ContextoAvaliacao` a partir do card + `Cliente` relacionado + `BpmCardCampoValor` (campos dinâmicos, resolvidos por `campoId`). **Fail-open deliberado:** erro de avaliação nunca bloqueia movimentação, só é logado — só admins (já autorizados) criam regras, então o pior caso é uma regra mal configurada deixar de bloquear, nunca bloquear indevidamente.

DELIVERY_READY: `/PainelAlpha/AlphaCRM/admin/regras` → criar regra → mover card na etapa configurada → guarda avalia e bloqueia/libera conforme o resultado.

**Última atualização:** 2026-09-04 por operador humano via Claude Code (RM-2026-19631A, Fase 2)

## Gestão de Campos e Dados — ajuste condicional de caminho de consumo, sem alteração de código (RM-2026-4C9C6D, Fase 2, 2026-09-04)

**Veredito:** nenhuma correção de infraestrutura de navegação foi necessária. A fase 0 (Scout) declarou `AUTO_ADJUSTMENT_REQUIRED`, mas o gap descrito não é de caminho de consumo (rota/menu/shell/integração com o modal do card) — é de modelo de dados e regras funcionais (escopo global, fontes, mapeamentos, relacionamentos, sincronização), explicitamente fora do escopo desta fase ("Não implementar ainda o modelo de campos, migrations ou regras funcionais").

**Verificação real (sem alteração):**
- Módulo Alpha CRM já registrado em `src/lib/modulos-registry.ts` (`id: 'crm'`, `href: '/PainelAlpha/AlphaCRM'`).
- Menu "Configurações" (`adminOnly: true`) já existe em `src/app/PainelAlpha/AlphaCRM/CRMLayoutClient.tsx:26`, apontando para `/PainelAlpha/AlphaCRM/admin`.
- `admin/page.tsx` e `admin/pipelines/[pipelineId]/page.tsx` já fazem `auth()` + `isAdminRole` + `redirect` para não-admin, antes de qualquer leitura.
- `AdminPipelineClient.tsx:450` já expõe a seção "Campos Personalizados" (CRUD de `BpmCampo` existente desde a story `story-rm-2026-43aa46-crud-campos-pipeline.md`).
- `CardOpenFormSlot.tsx:9,57` já integra `PainelCamposEtapaAtual`, ponto único de consumo operacional do formulário do card.

Ou seja, o shell administrativo e o ponto de consumo no card já existem e são exatamente os pontos que uma futura fase de modelo/regras (schema + Vault) precisará estender — não recriar. Nenhum arquivo de produção foi tocado nesta fase.

**Pendência que permanece (fora do escopo desta fase, para fases seguintes de schema/Vault + regras funcionais):** escopo de "global", direção de sincronização, precedência de conflito, seleção de Pessoa/contato, política de exclusão vs. arquivamento, acesso granular por campo/fonte/entidade, cardinalidade de relacionamentos, canonicalização de Serviço e se upload vira tipo de campo — todas já listadas como decisões funcionais bloqueadas no blueprint da Fase 0/1 e não decididas nesta fase.

**Arquivos afetados:** nenhum arquivo de produção; `.bibble/memory/architecture.md` (este registro).

**Última atualização:** 2026-09-04 por Nova (RM-2026-4C9C6D, Fase 2)

## Gestão de Pipelines e Etapas — fechamento e mapa final (RM-2026-F4B6A8, 2026-09-04)

**Objetivo entregue:** eliminar o hardcode de nome de etapa/pipeline na movimentação de card, permitindo que qualquer pipeline/etapa criado pelo admin tenha ordem, cor, etapa inicial/final, substatus e transições permitidas configuráveis — sem alterar o comportamento hoje observável dos pipelines Comercial/Financeiro/Revisão de Radar.

### Modelo de dados final (`prisma/schema.prisma`)

- `BpmPipeline` (`:3688`) — colunas novas nesta entrega: `ordem` (`Int @default(0)`, indexada). `nome`/`ativo`/timestamps já existiam.
- `BpmEtapa` (`:3721`) — colunas novas nesta entrega: `cor` (`String?`, cor de exibição — badge/coluna do Kanban), `ehInicial` (`Boolean @default(false)`, marca a etapa de entrada configurável do pipeline), `ehFinal` (`Boolean @default(false)`, marca etapa(s) de encerramento configurável — múltiplas permitidas). `ordem`/`ativo`/`slaDias`/`script` já existiam; `descricao` **não existe** (avaliado e descartado na Fase 0 por não ter ponto de consumo real).
- `BpmSubStatus` (`:3756`, novo model) — `id`, `etapaId` (FK `BpmEtapa`, `onDelete: Cascade`), `nome`, `cor?`, `ordem`, `ativo`, timestamps. Substatus configurável por etapa, escopado 1:N a partir de `BpmEtapa`.
- `BpmTransicaoEtapa` (`:3777`, novo model) — `id`, `pipelineId` (FK `BpmPipeline`), `etapaOrigemId`/`etapaDestinoId` (FK `BpmEtapa`, relations nomeadas `BpmTransicaoEtapaOrigem`/`BpmTransicaoEtapaDestino`), `permitida` (`Boolean @default(true)`), `origem` (`String @default("AMBOS")`, valores `"MANUAL" | "AUTOMACAO" | "AMBOS"`, validado por `z.enum` na camada de action, não por enum de banco), timestamps. `@@unique([etapaOrigemId, etapaDestinoId])` — uma linha por par origem→destino, não uma matriz N×N pré-alocada.
- **`BpmEtapaTransicaoPermitida` (model pré-existente) foi mantida intacta e separada de `BpmTransicaoEtapa`.** Ela continua sendo lida só no client (`CardFullViewModal.tsx`, `CardAbertoLayout.tsx`) para filtrar visualmente o dropdown de próxima etapa nos pipelines "Financeiro"/"Revisão de Radar" — não é a fonte da engine de validação server-side. Não confundir os dois models em sessões futuras.
- Nenhuma migration desta entrega foi destrutiva; todas as colunas/models novos são aditivos, aplicados via `prisma/migrations/20260904080000_bpm_pipelines_etapas_configuraveis/migration.sql` contra o Turso real, com backfill que preserva 100% do comportamento pré-existente (`BpmPipeline.ordem` seguindo a ordenação alfabética já usada por `ListarPipelinesBpm`; `BpmTransicaoEtapa` com 276 linhas `permitida=true, origem="AMBOS"` cobrindo todo par origem→destino hoje alcançável dentro do mesmo pipeline).

### Engine de validação de transição

- **Onde vive:** `verificarTransicaoPermitidaBpm(etapaOrigemId, etapaDestinoId, origemMovimentacao, client?)`, em `src/lib/bpm/requisitos-etapa-server.ts:29-55` (não em `requisitos-etapa.ts`, que é mantido livre de `db` por convenção do projeto).
- **Como decide:** consulta `BpmTransicaoEtapa` pelo par exato `{ etapaOrigemId_etapaDestinoId }`. Mesma etapa (`etapaOrigemId === etapaDestinoId`) sempre retorna `{ permitida: true }` sem consultar o banco. **Fail-open por design:** ausência de linha = `{ permitida: true }` — só uma regra criada/editada explicitamente por um admin passa a restringir. Regra encontrada com `permitida=false` bloqueia com o motivo `"Esta transição foi desativada pelo administrador."`.
- **Como diferencia origem:** quando a linha existe e `permitida=true`, o campo `origem` da linha é comparado a `origemMovimentacao` (recebido pelo chamador, não inferido): `"AMBOS"` sempre passa; `"MANUAL"` só passa se `origemMovimentacao === "MANUAL"` (senão retorna `"Esta transição só é permitida por ação manual do usuário."`); `"AUTOMACAO"` só passa se `origemMovimentacao === "AUTOMACAO"` (senão `"Esta transição só é permitida pelo Motor de Automações."`).
- **Pontos de integração (2, ambos via `origemMovimentacao` explícito):**
  - `src/actions/bpm/Cards.ts:1372-1379`, dentro de `executarMovimentoComRequisitos` (consumida por `MoverCardBpm` e `SalvarRequisitosEMoverCardBpm`), logo após o early-return de "mesma etapa" e antes de carregar campos obrigatórios de transição — chamada com `origemMovimentacao: "MANUAL"`.
  - `src/lib/bpm/automacao-novos-leads.ts:506-517`, uma vez por `configuracao` (etapa-origem) antes do loop de cards elegíveis — chamada com `"AUTOMACAO"`; se negada, todos os cards elegíveis daquela etapa são mantidos e reportados em `resumo.avisos`, sem exceção não tratada.

### Caminho de consumo completo

```
/PainelAlpha/AlphaCRM/admin
  → AdminPipelinesListClient → Switch ativo/inativo, ↑/↓ (ordem), editar nome/setores, criar pipeline
  → clique no pipeline → /PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]
  → AdminPipelineClient → cor por etapa, Switch ativo/inativo por etapa
    → "Configurações avançadas" (EtapaAvancadaSection.tsx)
      → etapa inicial (radio, DefinirEtapaInicialBpm) / etapas finais (checkbox múltiplo, DefinirEtapasFinaisBpm)
      → substatus (CRUD, SubStatus.ts → BpmSubStatus)
      → transições permitidas (checkbox + select de origem Manual/Automação/Ambos → Transicoes.ts → BpmTransicaoEtapa)
  ↓ (a configuração persistida é lida em tempo real por)
/PainelAlpha/AlphaCRM/pipeline/[pipelineId] (Kanban)
  → PipelineBoardClient (drag-and-drop) / PainelProximaEtapa (botão "Mover")
  → MoverCardBpm → executarMovimentoComRequisitos → verificarTransicaoPermitidaBpm(origem="MANUAL")
  → permitido: move + grava BpmCardHistorico + realtime | bloqueado: reverte drag/toast com o motivo real do backend
  ↓ (mesma engine, origem diferente)
Motor de Automações (automacao-novos-leads.ts, cron do pipeline "Revisão de Radar")
  → verificarTransicaoPermitidaBpm(origem="AUTOMACAO") por etapa-origem, antes de mover os cards elegíveis
```

### Hardcode removido/preservado (para não recriar por desconhecimento)

- **Removido nesta entrega:** a movimentação manual (`MoverCardBpm`/`SalvarRequisitosEMoverCardBpm`, `Cards.ts`) e a movimentação automática (`automacao-novos-leads.ts`) não tinham, antes da Fase 2, **nenhuma** checagem de transição permitida no servidor — o único filtro existente (`BpmEtapaTransicaoPermitida`) era lido apenas no client para UX do dropdown, contornável chamando a Server Action diretamente com outro `etapaDestinoId` (achado original do relatório da Fase 0). Isso foi fechado com a integração de `verificarTransicaoPermitidaBpm` descrita acima — nenhuma linha de código antiga precisou ser removida porque a checagem simplesmente não existia; o "antes" é a ausência de validação server-side.
- **Intencionalmente não removido (fora do escopo desta entrega):** os nomes de etapa/pipeline hardcoded que disparam regras de negócio específicas (`"Financeiro"` em `src/lib/bpm/pipeline-financeiro.ts:1`/`automacoes.ts:11`; `"Revisão de Radar"` em `automacao-novos-leads.ts:392`/`parceiros.ts:813`/`NolossLeads.ts:12,29,30`; `"Novos leads"` em `novos-leads.ts:8`; `"Boas-vindas"` em `boas-vindas.ts:11`; etapa "lost" normalizada em `lost.ts:28-29`; etapa "Fechado" normalizada em `status-pos-fechamento.ts:131`) **continuam hardcoded por nome** — essas guardas de negócio (boas-vindas, financeiro, lost, fechado, radar) não foram generalizadas para usar `ehInicial`/`ehFinal`/`BpmSubStatus`, pois isso exigiria migrar regra de negócio específica por etapa, fora do escopo desta entrega (que endereçou apenas a movimentação genérica origem→destino). `ehInicial`/`ehFinal` hoje só controlam a UI admin (radio/checkbox) e ficam disponíveis para uma generalização futura dessas guardas, mas nenhuma delas foi migrada para consultar essas flags nesta entrega.

### Lacuna registrada e não fechada nesta entrega

`BpmCard` não tem coluna para persistir qual `BpmSubStatus` está selecionado no card (confirmado por leitura direta do model, sem campo livre reaproveitável — `statusPosFechamento` é string fixa exclusiva da etapa "Fechado", não um substatus genérico). Substatus é cadastrável pelo admin (`BpmSubStatus` + UI da Fase 3) mas **não é selecionável em nenhum card ainda** — ver `decisions.md` e o `AUTO_ADJUSTMENT_REQUIRED` registrado na Fase 4 para o desenho da fase que fecha essa lacuna (coluna `BpmCard.subStatusId` via Vault + seletor de UI + action dedicada).

### Verificação final (Fase 6, Probe)

`npx tsc --noEmit`, ESLint direcionado, `npx vitest run tests/bpm/` (519 passando/17 falhas, baseline pré-existente sem falha nova) e `npm run build` todos verdes. Pendência manual explícita: sem sessão de admin autenticada em navegador neste ambiente, os passos 1-10 do fluxo (criar pipeline, arrastar card, reload) foram validados por execução real dos módulos de produção via teste automatizado (`kanban-transicao-integracao.test.ts`, `pipelines-etapas-admin.test.ts`), não por clique manual em UI — fica como validação humana pendente.

**Arquivos afetados por este registro de fechamento:** nenhum arquivo de produção (fase somente-memória); `.bibble/memory/architecture.md` (este registro), `.bibble/memory/decisions.md`, `.bibble/memory/journal.md`.

**Última atualização:** 2026-09-04 por Scribe (RM-2026-F4B6A8, Fase 7 — CLOSURE)

## Gestão de Pipelines e Etapas — verificação ponta a ponta (RM-2026-F4B6A8, Fase 6, 2026-09-04)

**Veredito:** APROVADO com pendência manual explícita (sem sessão de admin autenticada em navegador disponível neste ambiente).

**Gates automatizados (todos verdes, comandos reais executados nesta sessão):**
- `npx tsc --noEmit` (heap ampliado) — os 28 erros pré-existentes são todos em `CalendarioAlpha`/`google-calendar`/`ComponentesRadar`, zero nos arquivos desta feature (confirmado por `grep` direcionado sem ocorrências).
- ESLint direcionado nos 12 arquivos tocados pelas Fases 2-4 (`Pipelines.ts`, `Etapas.ts`, `SubStatus.ts`, `Transicoes.ts`, `Cards.ts`, `requisitos-etapa-server.ts`, `requisitos-etapa.ts`, `automacao-novos-leads.ts`, `AdminPipelinesListClient.tsx`, `AdminPipelineClient.tsx`, `EtapaAvancadaSection.tsx`, `page.tsx`×2) — zero saída, limpo.
- `npx vitest run tests/bpm/` — 519 passando / 17 falhando, exatamente o mesmo baseline documentado desde a Fase 2 (`card-modal-integration` 10, `fechado-ui` 1, `lost-ui` 2, `membros-card-ui` 2, `sem-viabilidade-actions` 1, `standby-follow-up` 1) — confirmado por comparação nominal dos testes falhos, nenhuma falha nova. Suíte direcionada da feature (`pipelines-etapas-admin` + `kanban-transicao-integracao` + `card-tabs-pipelines`) — 35/35.
- `npm run build` — build completo sem erro, rota `/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]` presente na saída.

**Fluxo de consumo (passos 1-10 do Markdown da fase) — evidência coletada:**
- Passos 1/3 (checklist): presença visual e proteção de rota confirmadas por leitura direta — item de menu "Configurações" com `adminOnly: true` aponta para `/PainelAlpha/AlphaCRM/admin` (`CRMLayoutClient.tsx:26`); ambas as páginas (`admin/page.tsx`, `admin/pipelines/[pipelineId]/page.tsx`) chamam `auth()` + `isAdminRole` e fazem `redirect("/PainelAlpha/AlphaCRM")` para role não-admin, antes de qualquer leitura de dado.
- Passos 2, 4, 5 (criar pipeline/substatus/transições com origem Manual/Automação/Ambos) e passo 6 (permissão negada para role comum): cobertos por `pipelines-etapas-admin.test.ts` (23 casos, execução real dos módulos de produção contra Prisma mockado, não simulação de UI).
- Passos 7, 8, 9 (bloqueio de transição "apenas automação" para movimento manual com mensagem clara, movimento manual permitido com registro em `BpmCardHistorico`, e a mesma transição liberada para o Motor de Automações) — cobertos literalmente por `kanban-transicao-integracao.test.ts`, que chama `MoverCardBpm`/`verificarTransicaoPermitidaBpm` reais (não mocka a engine) contra `BpmTransicaoEtapa` mockado no nível do Prisma. Este é o teste mais próximo de uma reprodução exata do cenário pedido pela fase.
- Passo 10 (persistência sobrevive a reload): a escrita real em banco (Turso) já foi verificada com consulta direta via Prisma Client na Fase 1 (EXECUTION); todas as actions mutantes chamam `revalidatePath`, então não há cache desatualizado entre escrita e nova leitura.
- **Pendência explícita (não bloqueante conforme protocolo desta sessão):** não há sessão de admin autenticada em navegador neste ambiente para clicar literalmente nos passos 1-10 na UI real (criar pipeline "Teste RM-2026-F4B6A8", arrastar card no Kanban, recarregar página). A evidência acima é gerada por execução real dos mesmos módulos de produção via teste automatizado, não por simulação manual de clique — mas o clique em si (e a captura de print) fica como validação manual pendente de um administrador humano.

**Regressão (pipelines Comercial/Financeiro/Radar):** preservada por design — `verificarTransicaoPermitidaBpm` é fail-open e o backfill da Fase 1 cobriu 100% dos pares hoje válidos desses 3 pipelines com `permitida=true/origem=AMBOS`; `ListarPipelinesBpm`/`ObterPipelineBpm` mantêm o comportamento antigo por padrão (`incluirInativas=false`). `card-tabs-pipelines.test.ts` e `pipeline-financeiro.test.ts` (ambos pré-existentes, não tocados) seguem passando.

**Checklist dos 8 pontos (Artigo VIII):** 1 (presença visual) OK; 2 (trigger) OK por wiring de código + testes que executam as actions; 3 (rota protegida) OK; 4 (permissões) OK (Fase 5 + testes desta fase); 5 (persistência real) OK, reload em navegador é a pendência manual citada acima; 6 (estados de UI) OK — `AdminPipelinesListClient.tsx`/`EtapaAvancadaSection.tsx` têm tratamento de loading/erro/vazio/sucesso (`toast`, `isPending`, mensagens condicionais); 7 (integração externa/Motor de Automações) OK, testado de fato via `verificarTransicaoPermitidaBpm(...,"AUTOMACAO")` real; 8 (sem regressão) OK.

**Arquivos afetados por esta fase:** nenhum arquivo de produção (fase somente-verificação); `.bibble/memory/architecture.md` (este registro).

**Última atualização:** 2026-09-04 por Probe (RM-2026-F4B6A8, Fase 6)

## Gestão de Pipelines e Etapas — auditoria de segurança (RM-2026-F4B6A8, Fase 5, 2026-09-04)

**Veredito:** APROVADO, sem correções bloqueantes. Auditados todos os arquivos novos/alterados nas Fases 2-4 (`Pipelines.ts`, `Etapas.ts`, `SubStatus.ts`, `Transicoes.ts`, `requisitos-etapa-server.ts`, `Cards.ts`/`executarMovimentoComRequisitos`, `automacao-novos-leads.ts`) contra os 5 pontos do checklist da Constitution (Artigo V):

1. **Autenticação:** as 16 Server Actions das Fases 2-3 chamam `auth()` e retornam `{ success: false, error: "Não autorizado" }` antes de qualquer leitura/escrita quando não há sessão — confirmado por leitura direta, sem exceção.
2. **Autorização (role):** todas passam por `exigirAcessoConfigPipeline` → `checarAcessoConfigPipeline` → `isAdminRole` (`src/lib/bpm/ownership.ts:470-477`, restrito a Admin/CEO/TI via `src/lib/roles.ts:25-28`). Validado com teste real (não mockado) injetando um client fake com `role: "User"` diretamente em `checarAcessoConfigPipeline`/`exigirAcessoConfigPipeline` — `checarAcessoConfigPipeline` retornou `false` e `exigirAcessoConfigPipeline` lançou `"Não autorizado — apenas administradores configuram pipelines"`; o mesmo teste confirmou `true` para Admin/CEO/TI. Teste era ad hoc (`tests/bpm/_audit-temp-role-check.test.ts`), executado e removido após confirmação — não é um artefato permanente desta fase.
3. **Validação de entrada:** 100% dos schemas Zod em `src/lib/validations/bpm.ts` (`criarPipelineSchema` até `removerTransicaoEtapaSchema`) usam `z.string().cuid()` para ids, `z.number().int()` para ordem, `z.enum(BPM_TRANSICAO_ORIGEM)` (`["MANUAL","AUTOMACAO","AMBOS"]`) para origem da transição, e todas as actions chamam `.safeParse()` retornando erro tratado (nunca `.parse()` que lançaria exceção não tratada) — payload malformado (string onde espera número, enum fora do conjunto) é rejeitado com `parsed.error.flatten()`.
4. **Bypass da engine de transição:** `CriarTransicaoEtapaBpm` valida que `etapaOrigemId`/`etapaDestinoId` pertencem ao `pipelineId` informado antes do upsert (`Transicoes.ts:52-58`). Na movimentação real, `carregarContextoMovimento` (`Cards.ts:1091-1100`) rejeita `etapaDestinoId` de outro pipeline com `"Etapa não pertence ao pipeline do card"` antes mesmo de chegar à engine; em seguida `verificarTransicaoPermitidaBpm` (chamada em `executarMovimentoComRequisitos`, `Cards.ts:1372`) consulta `BpmTransicaoEtapa` pelo par origem→destino real do card e bloqueia com a mensagem do admin quando há regra `permitida=false` — confirmado tanto por leitura de código quanto pelos 5 casos de `tests/bpm/kanban-transicao-integracao.test.ts` (fail-open, bloqueio explícito, MANUAL×AUTOMACAO). Não há caminho que contorne a engine chamando `MoverCardBpm` diretamente.
5. **Exposição de dados:** `ListarPipelinesBpm` filtra por `checarAcessoBpmPipeline` por item antes de retornar; `ListarTransicoesDoPipelineBpm`/`ObterPipelineBpm` são escopados por `pipelineId` recebido e validado (`cuid()` ou existência real). Nenhuma das actions auditadas lê ou retorna `ANTHROPIC_API_KEY`/variável de ambiente sensível (`grep` direcionado sem ocorrências).

**Achados não bloqueantes:** nenhum.

**Arquivos afetados:** nenhum (auditoria somente leitura + 1 teste ad hoc temporário, criado e removido na mesma sessão).

**Última atualização:** 2026-09-04 por Anubis (RM-2026-F4B6A8, Fase 5)

## Gestão de Pipelines e Etapas — integração Kanban + Motor de Automações (RM-2026-F4B6A8, Fase 4, 2026-09-04)

**Objetivo da fase:** confirmar (com testes de integração reais, não isolados) que a movimentação de cards no Kanban do Alpha CRM respeita de ponta a ponta a engine `verificarTransicaoPermitidaBpm` entregue na Fase 2, sem regressão nos pipelines Comercial/Financeiro/Revisão de Radar, e resolver o item 2 do objetivo (substatus visível/selecionável no card).

**Auditoria de código (itens 1, 3, 4 e 5 do markdown da fase) — já implementados corretamente desde a Fase 2/3, sem necessidade de alteração:**
- **Board Kanban:** `PipelineBoardClient.tsx` (`onDragEnd`) e `PainelProximaEtapa.tsx` (botão "Mover") já chamam exclusivamente `MoverCardBpm`, que internamente roda `executarMovimentoComRequisitos` → `verificarTransicaoPermitidaBpm` **antes** de qualquer validação de campo obrigatório. O drag-and-drop reverte o estado otimista (`restaurarArrasto(snapshot, motivoRejeicao)`) e exibe a mensagem de erro real do backend em um banner (`erro` state); `PainelProximaEtapa` usa `toast.error` com a mesma mensagem. Nenhuma mudança necessária.
- **Motor de Automações:** `automacao-novos-leads.ts:506-509` já chama `verificarTransicaoPermitidaBpm(origem, destino, "AUTOMACAO")` uma vez por etapa-origem antes do loop de cards elegíveis, permitindo que uma transição com `origem="AUTOMACAO"` passe mesmo bloqueada para `"MANUAL"`. Nenhuma mudança necessária.
- **Histórico:** `BpmCardHistorico.create` continua sendo gravado a cada movimentação manual (`Cards.ts:1618`) e automática (`automacao-novos-leads.ts:212,342,566,700`), sem alteração.
- **Compatibilidade com pipelines existentes:** confirmada pelo comportamento fail-open da engine (ausência de linha em `BpmTransicaoEtapa` = permitido) — o backfill da Fase 1 cobriu 100% dos pares hoje válidos dos pipelines Comercial/Financeiro/Revisão de Radar.

**Testes novos (a lacuna real desta fase — nenhum teste anterior exercitava `MoverCardBpm` com a engine real sem mockar `verificarTransicaoPermitidaBpm`):** `tests/bpm/kanban-transicao-integracao.test.ts` (novo, 5 casos) — mocka `bpmTransicaoEtapa.findUnique` diretamente (não a função da engine) e chama `MoverCardBpm` de ponta a ponta: (1) fail-open preserva o comportamento de pipeline existente, (2) bloqueio explícito por admin retorna a mensagem exata, (3) transição "apenas automação" bloqueia `MANUAL` com mensagem clara, (4) a mesma regra libera `AUTOMACAO`, (5) histórico + realtime só disparam quando o movimento é aceito.

**Item 2 (substatus no card) — lacuna real, requer schema novo:** `BpmSubStatus` (Fase 1) já modela substatus por etapa e a UI admin (Fase 3) já permite cadastrá-los, mas **`BpmCard` não tem nenhuma coluna para armazenar qual substatus está selecionado no card** (confirmado por leitura direta do model, `prisma/schema.prisma:3885-3943`) — não há campo livre reaproveitável (`statusPosFechamento` é string fixa exclusiva da etapa "Fechado", não um substatus genérico). O próprio markdown desta fase instrui explicitamente a sinalizar para o Vault antes de adicionar a coluna via migration aditiva, em vez de o agente de execução alterar o schema diretamente — seguido à risca aqui.

`AUTO_ADJUSTMENT_REQUIRED: BpmCard não tem coluna para persistir o substatus selecionado (ex.: subStatusId), então não há onde a UI gravar a escolha — implementar o seletor sem essa coluna seria uma feature que não persiste.`
`AUTO_ADJUSTMENT_ACCEPTANCE: uma fase EXECUTION do Vault adiciona BpmCard.subStatusId (String?, FK opcional para BpmSubStatus, onDelete: SetNull) via migration aditiva; em seguida uma fase de UI expõe um seletor no painel de detalhe do card (CardAbertoLayout.tsx ou painel de etapa) quando a etapa atual tiver BpmSubStatus ativos, persiste via nova action AtualizarSubStatusCardBpm (ownership/CAS no mesmo padrão de AtualizarCardBpm) e o valor sobrevive a reload.`

**Qualidade:** `npx vitest run tests/bpm/` — 519 passando / 17 falhas, mesmo baseline exato documentado nas Fases 2/3 (`card-modal-integration` 10, `fechado-ui` 1, `lost-ui` 2, `membros-card-ui` 2, `sem-viabilidade-actions` 1, `standby-follow-up` 1) — nenhuma falha nova. ESLint direcionado no arquivo novo — limpo.

**Arquivos afetados:** `tests/bpm/kanban-transicao-integracao.test.ts` (novo).

**Última atualização:** 2026-09-04 por Echo (RM-2026-F4B6A8, Fase 4)

## Gestão de Pipelines e Etapas — painel administrativo visual (RM-2026-F4B6A8, Fase 3, 2026-09-04)

**Objetivo da fase:** evoluir a tela admin existente (`AdminPipelinesListClient.tsx` + `AdminPipelineClient.tsx`) para expor, via UI, os controles cujas Server Actions já existiam desde a Fase 2 (`AtivarDesativarPipelineBpm`, `ReordenarPipelinesBpm`, `AtivarDesativarEtapaBpm`, `DefinirEtapaInicialBpm`, `DefinirEtapasFinaisBpm`, `SubStatus.ts`, `Transicoes.ts`), fechando o `AUTO_ADJUSTMENT_REQUIRED` sinalizado nas Fases 0/2.

**Suporte mínimo adicionado antes da UI (ajuste de entregabilidade):**
- `ObterPipelineBpm(pipelineId, incluirInativas = false)` — novo segundo parâmetro opcional. Com `false` (padrão, usado pelo board em `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]`) mantém o comportamento idêntico (só etapas ativas). Com `true` (usado só pela tela admin), traz também etapas inativas — necessário para o admin poder reativá-las — e inclui `subStatus` (novo, sempre presente independente do parâmetro).
- `ListarPipelinesBpm` — `select` ganhou `ordem: true` (a coluna já existia desde a Fase 1, mas não era lida). `orderBy` continua `{ nome: "asc" }` no banco (não alterado — há um teste, `tests/bpm/card-tabs-pipelines.test.ts`, que trava essa string exata); a ordenação por `ordem` configurável pelo admin é aplicada no client (`AdminPipelinesListClient.tsx`), que ordena a lista recebida por `ordem` antes de renderizar.

**UI entregue:**
- `AdminPipelinesListClient.tsx` (`/PainelAlpha/AlphaCRM/admin`): `Switch` ativo/inativo por pipeline (com `AlertDialog` de confirmação só ao desativar), botões ↑/↓ de reordenação (`ReordenarPipelinesBpm`), botão de editar (lápis) que abre `Dialog` com nome + setores (`AtualizarPipelineBpm`) — fecha o gap de "editar pipeline existente" da Fase 0.
- `AdminPipelineClient.tsx` (`/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]`): cada linha de etapa ganhou seletor de cor (`input type="color"`, persiste hex via `AtualizarEtapaBpm`) e `Switch` ativo/inativo (com `AlertDialog` de confirmação ao desativar, via `AtivarDesativarEtapaBpm`).
- `EtapaAvancadaSection.tsx` (novo) — um `<details>`/`<summary>` por etapa (mesmo padrão de `VisibilidadeEtapasSection.tsx`, já existente na mesma tela) com: radio exclusivo "Etapa inicial" (`DefinirEtapaInicialBpm`), checkbox múltiplo "Etapa final" (`DefinirEtapasFinaisBpm`), CRUD de substatus (nome/cor/ativo, `SubStatus.ts`) e lista de transições permitidas para as demais etapas do pipeline, cada uma com checkbox (permitida) + select de origem (Manual/Automação/Ambos, `Transicoes.ts`).
- Semântica do checkbox de transição: reflete o comportamento fail-open real da engine (`verificarTransicaoPermitidaBpm`, Fase 2) — ausência de registro em `BpmTransicaoEtapa` aparece marcada (permitida por padrão); desmarcar cria/atualiza uma regra explícita com `permitida=false`.

**Divergência de terminologia herdada da Fase 0 (não é lacuna desta fase):** nem `BpmPipeline` nem `BpmEtapa` têm coluna `descricao` no schema (`BpmEtapa.script` é um campo de propósito distinto, roteiro só-leitura da aba Script). A UI não inclui campo de descrição para não criar um formulário que não persiste.

**Proteção de acesso:** inalterada — guard `isAdminRole` já existia nas duas páginas server-side (`page.tsx` de `/admin` e `/admin/pipelines/[pipelineId]`), e todas as Server Actions consumidas já validam `exigirAcessoConfigPipeline` no servidor (fonte de autoridade real; a UI é só UX).

**Caminho de consumo:**
```
/PainelAlpha/AlphaCRM/admin
  → lista de pipelines → Switch ativo/inativo, ↑/↓, editar (nome/setores), "Novo pipeline"
  → clique no pipeline → /PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]
  → cada etapa → cor, Switch ativo/inativo, "Configurações avançadas"
    → Etapa inicial (radio) / Etapa final (checkbox) / Substatus (CRUD) / Transições (checkbox + select origem)
```

**Qualidade:** `npx tsc --noEmit` (heap ampliado) — diff idêntico ao baseline documentado na Fase 2 (28 erros pré-existentes confirmados por diff, zero novo nos arquivos tocados). ESLint direcionado nos 5 arquivos tocados — limpo. `npx vitest run tests/bpm/` — 514 passando / 17 falhas, mesmo baseline da Fase 2 (verificado por comparação direta); os 2 testes que exercitam os contratos tocados (`pipelines-etapas-admin.test.ts`, `card-tabs-pipelines.test.ts`) — 30/30. `npm run build` — build completo sem erros, incluindo a rota `/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]`.

**Limitação conhecida:** validação em navegador com sessão admin autenticada não foi executada nesta sessão (sem sessão de teste disponível no ambiente) — verificação manual pendente por parte de um administrador real antes de considerar a UI validada ponta a ponta.

**Arquivos afetados:** `src/actions/bpm/Pipelines.ts`, `src/app/PainelAlpha/AlphaCRM/admin/AdminPipelinesListClient.tsx`, `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/{AdminPipelineClient,page}.tsx`, `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/EtapaAvancadaSection.tsx` (novo).

**Última atualização:** 2026-09-04 por Nova (RM-2026-F4B6A8, Fase 3)

## Gestão de Pipelines e Etapas — backend CRUD + engine de transição (RM-2026-F4B6A8, Fase 2, 2026-09-04)

**Objetivo da fase:** implementar as Server Actions e a engine de validação que consomem o schema aditivo da Fase 1 (`BpmPipeline.ordem`, `BpmEtapa.cor/ehInicial/ehFinal`, `BpmSubStatus`, `BpmTransicaoEtapa`), eliminando hardcode de nome de etapa/pipeline na movimentação de card.

**Actions novas/estendidas (todas atrás de `exigirAcessoConfigPipeline` — admin/CEO/TI):**
- `src/actions/bpm/Pipelines.ts` — `AtivarDesativarPipelineBpm`, `ReordenarPipelinesBpm` (novas). `CriarPipelineBpm`/`AtualizarPipelineBpm` já existiam.
- `src/actions/bpm/Etapas.ts` — `AtivarDesativarEtapaBpm`, `DefinirEtapaInicialBpm` (garante unicidade via `updateMany` desmarcando as demais na mesma transação), `DefinirEtapasFinaisBpm` (substitui o conjunto completo, múltiplas permitidas). `criarEtapaSchema`/`atualizarEtapaSchema` ganharam `cor` (hex `#RRGGBB` validado por regex). `registrarAuditoriaPipeline` passou a ser exportada e reaproveitada pelos novos arquivos abaixo.
- `src/actions/bpm/SubStatus.ts` (novo) — `CriarSubStatusBpm`, `AtualizarSubStatusBpm`, `AtivarDesativarSubStatusBpm` (thin wrapper de `AtualizarSubStatusBpm`), `ReordenarSubStatusBpm`. Escopados por `etapaId`.
- `src/actions/bpm/Transicoes.ts` (novo) — `ListarTransicoesDoPipelineBpm`, `CriarTransicaoEtapaBpm` (upsert por par origem→destino, valida que ambas etapas pertencem ao `pipelineId` informado), `AtualizarTransicaoEtapaBpm` (toggle `permitida`/`origem`), `RemoverTransicaoEtapaBpm`. Usa `BpmTransicaoEtapa` (schema da Fase 1) — não confundir com `BpmEtapaTransicaoPermitida`, que continua intocada e é a fonte hoje usada só para filtrar visualmente o dropdown de próxima etapa no client.

**Engine de validação de transição (núcleo da eliminação de hardcode):**
- `verificarTransicaoPermitidaBpm(etapaOrigemId, etapaDestinoId, origemMovimentacao, client?)`, nova em `src/lib/bpm/requisitos-etapa-server.ts` (não em `requisitos-etapa.ts`, que permanece livre de `db` por convenção do projeto). Consulta `BpmTransicaoEtapa` pelo par origem→destino.
- **Fail-open por design:** ausência de regra explícita = permitido. O backfill da Fase 1 cobriu todos os pares hoje válidos com `permitida=true/origem=AMBOS`, então só uma regra criada/editada explicitamente por um admin passa a restringir — isso preserva 100% do comportamento observável atual sem exigir que todo pipeline/etapa novo já tenha transições pré-cadastradas.
- Integrada em `executarMovimentoComRequisitos` (`src/actions/bpm/Cards.ts`, consumida por `MoverCardBpm` e `SalvarRequisitosEMoverCardBpm`, ambas passam `origemMovimentacao: "MANUAL"`) logo após o early-return de "mesma etapa", antes de carregar campos de transição. Validação de campos obrigatórios (`listarCamposObrigatoriosFaltantes`) permanece independente — as duas precisam passar para o movimento ser aceito.
- Integrada também em `src/lib/bpm/automacao-novos-leads.ts` (Motor de Automações do pipeline "Revisão de Radar", único ponto do motor que move card hoje — `executor.ts`/`BpmAutomacao` não tem ação de mover etapa). A checagem roda uma vez por `configuracao` (par origem fixo→Standby), não por card, passando `origemMovimentacao: "AUTOMACAO"`; se negada, todos os cards elegíveis daquela etapa são mantidos e reportados em `resumo.avisos`, sem exceção não tratada.
- `origem` da transição (`MANUAL"|"AUTOMACAO"|"AMBOS"`) é respeitado: uma linha com `origem="MANUAL"` bloqueia o Motor de Automações para aquele par mesmo com `permitida=true`, e vice-versa.

**Regressão evitada (registro para futuras fases):** 4 arquivos de teste pré-existentes (`fechado-actions.test.ts`, `lost-actions.test.ts`, `automacao-novos-leads-tentativas.test.ts`, `automacao-reuniao-agendada.test.ts`) mockam `@/lib/bpm/requisitos-etapa-server` module inteiro sem incluir a nova função — corrigido adicionando `verificarTransicaoPermitidaBpm: vi.fn().mockResolvedValue({ permitida: true })` a cada mock. Qualquer novo teste que mocke esse módulo completo precisa incluir essa função (fail-open) para não quebrar `MoverCardBpm`/`SalvarRequisitosEMoverCardBpm`/`executarAutomacaoFollowUpBpm`.

**Testes:** `tests/bpm/pipelines-etapas-admin.test.ts` (novo, 23 casos) cobre CRUD de pipeline/etapa/substatus/transição com sucesso e rejeição por permissão insuficiente, e a engine (`verificarTransicaoPermitidaBpm`) isoladamente: mesma etapa, ausência de regra (regressão dos pipelines legados), bloqueio explícito, múltiplos destinos válidos, diferenciação MANUAL×AUTOMACAO×AMBOS.

**Qualidade:** `npx tsc --noEmit` (`--max-old-space-size=8192`, necessário — o comando padrão estoura heap no ambiente) sem nenhum erro novo nos arquivos tocados (63 erros pré-existentes idênticos antes/depois, confirmados por diff). ESLint direcionado sem warnings/erros. `npx vitest run tests/bpm/` — 514 passando / 17 falhas, todas confirmadas pré-existentes e não relacionadas (10 em `card-modal-integration.test.ts`, 1 em `fechado-ui.test.ts`, 2 em `lost-ui.test.ts`, 2 em `membros-card-ui.test.ts`, 1 em `sem-viabilidade-actions.test.ts`, 1 em `standby-follow-up.test.ts` — todas por débito de refatoração de UI/campo não relacionado, verificadas individualmente antes de aceitar como baseline).

**Entrega desta fase é backend puro** (Server Actions + engine), conforme escopo do markdown da Fase 2. Não há UI de administração ainda consumindo `AtivarDesativarPipelineBpm`/`ReordenarPipelinesBpm`/`AtivarDesativarEtapaBpm`/`DefinirEtapaInicialBpm`/`DefinirEtapasFinaisBpm`/`SubStatus.ts`/`Transicoes.ts` — `/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]` (`AdminPipelineClient.tsx`) continua sem esses controles. Isso é consistente com a divisão de fases do Roadmap (Fase 1 = schema, Fase 2 = backend, UI fica para uma fase seguinte) e não é uma lacuna desta fase — é o próximo passo natural, já sinalizado no relatório da Fase 0/1.

**Última atualização:** 2026-09-04 por Nova (RM-2026-F4B6A8, Fase 2)

## Alpha CRM — seleção e persistência de data/hora (RM-2026-EB401C, 2026-09-04)

**Objetivo entregue:** substituir a composição manual dos instantes do card por seleção assistida de data e hora, preservando o horário civil de `America/Sao_Paulo` independentemente do fuso do navegador.

**Componentes e contratos:**
- `BpmDateTimeField.tsx` é um Client Component controlado e reutilizável no `CardModal`: combina `DayPicker` em `Popover` com `input type="time"`, opera somente com `YYYY-MM-DDTHH:mm` civil e não conhece Server Actions.
- `formatarDataHoraLocalBpm()` converte o instante persistido para o valor civil de São Paulo; `parseDataHoraLocalBpm()` faz a conversão inversa e rejeita valores parciais ou impossíveis. Campos dinâmicos `tipo="data"` continuam strings civis `YYYY-MM-DD` e não passam por essa conversão.
- `criarRastreadorRascunho()` versiona o valor local. Uma resposta assíncrona antiga não confirma nem sobrescreve edição posterior; `PainelReuniao` também preserva rascunhos sujos diante de atualização realtime, sem remount por `updatedAt`.
- `CardFullViewModal` hospeda um único `CardSaveProvider`; ao fechar, força blur, aguarda `flushSaves()` e mantém o card aberto quando algum autosave falha.

**Consumidores e persistência:**
- Próximo Contato: `PainelProximoContato` → `AtualizarCardBpm` → `BpmCard.proximoContatoEm`; é opcional, aceita limpeza explícita para `null` e participa do `CardSaveContext`.
- Reunião: `PainelReuniao` → `AgendarReuniaoGoogleMeetBpm`/`ReagendarReuniaoBpm` → Google Calendar + `BpmCard.dataReuniao`.
- Prazo e Alerta: `PainelTarefasPorTipo` → `CriarTarefaBpm` → `BpmTarefa.prazo`/`BpmTarefa.alertaEm`; ambos são obrigatórios e o alerta não pode ser posterior ao prazo. Datas legadas nulas ou inválidas não são renderizadas.
- Os controles respeitam o gate visual de vínculo + `permissaoEtapa.podeAgir`; auth, ownership e revalidação server-side permanecem como autoridade.

**Backend e banco:** houve endurecimento da validação compartilhada em `src/lib/validations/bpm.ts` e adoção do schema estrito pelas actions de reunião. O backend aceita somente `Date` válida, ISO datetime com timezone ou timestamp numérico finito; formatos locais/naturais são recusados. Os destinos e contratos de persistência existentes não mudaram. Não houve alteração de schema, migration, seed ou backfill.

**Caminho de consumo:**
`/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → card → `CardFullViewModal` → **Formulário da Etapa** (`PainelProximoContato`/`PainelReuniao`) ou aba **Tarefas** (`PainelTarefasPorTipo`) → `BpmDateTimeField` → seleção → Server Action existente → `BpmCard`/`BpmTarefa` → fechar e reabrir o card → mesmo horário civil de São Paulo ou Próximo Contato vazio.

**Testes e gates:** os testes direcionados finais passaram 68/68 tanto com `TZ=Pacific/Honolulu` quanto com `TZ=Asia/Tokyo`; ESLint direcionado e `git diff --check` passaram. Forge, Probe, Anubis, Lens e Sage registraram aprovação da story. Os gates globais mantiveram débitos externos: typecheck e lint falham fora da File List; `npm test` teve 2.150 aprovações e 39 falhas basais em 17 arquivos; o build Next.js não concluiu no ambiente e permanece validação manual.

**Limitações conhecidas:** a validação autenticada em navegador desktop/mobile e a navegação integral por teclado permanecem manuais por ausência de sessão de teste. O seletor mantém precisão de minutos.

**Última atualização:** 2026-09-04 por Scribe (fechamento RM-2026-EB401C)

## Alpha CRM — Transcrição da Reunião no card (RM-2026-CB55AA, 2026-09-04)

**Objetivo:** exibir e permitir sincronizar o resumo/transcrição da reunião Google no card do Alpha CRM na etapa **Reunião Agendada**.

**Implementação:**
- `CardOpenFormSlot` monta `PainelReuniao` em **Reunião Agendada** com `mostrarFormulario={false}`, preservando os campos dinâmicos da etapa.
- `SincronizarTranscricaoReuniaoBpm`, em `src/actions/bpm/TranscricaoMeet.ts`, aplica auth, Zod e ownership; o serviço consulta a Google Meet REST API e persiste o texto de forma idempotente.
- A Meet API é a fonte primária. Cada chamada admite uma repetição, o orçamento compartilhado do Meet é de 18 s e o conjunto das integrações externas é limitado a 25 s. Se a consulta falhar, a descrição real do evento no Calendar pode ser persistida como resumo parcial; uma sincronização posterior pode substituí-la pela transcrição integral.
- `PainelReuniao.tsx` exibe data, ausência de vínculo, pendência, loading, sucesso e erro; oferece **Buscar transcrição**/**Atualizar transcrição** e o campo editável **Resumo da reunião**.
- O resumo/transcrição usa o campo dedicado existente `BpmCard.transcricaoReuniao`, vinculado ao card pelos identificadores `googleEventId`, `googleCalendarId` e `googleMeetLink`. `SalvarResumoReuniaoBpm` protege a edição com auth, Zod, ownership revalidado, CAS por `updatedAt`, histórico e realtime. Não existe `BpmCampo` adicional e não houve migration.

**Caminho de consumo:**
`/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → card em **Reunião Agendada** → `CardFullViewModal` → `CardAbertoLayout` → `PainelRegistrar` → aba **Formulário da Etapa** → `CardOpenFormSlot` → `PainelReuniao` → **Buscar transcrição** → `SincronizarTranscricaoReuniaoBpm` → Google Meet/Calendar → `BpmCard.transcricaoReuniao` → **Resumo da reunião**.

**Arquivos tocados:**
- `src/actions/bpm/GoogleMeet.ts`
- `src/actions/bpm/TranscricaoMeet.ts`
- `src/actions/bpm/Cards.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx`
- `src/lib/bpm/transcricao-reuniao-server.ts`
- `src/lib/google-meet/client.ts`
- `tests/bpm/formulario-etapa.test.ts`
- `tests/bpm/reuniao-transcricao.test.ts`
- `tests/bpm/transcricao-reuniao-server.test.ts`

**Testes:** `tests/bpm/reuniao-transcricao.test.ts` possui 6 casos; o gate Probe da entrega executou 31 testes direcionados com aprovação integral.

**Qualidade:** testes direcionados 31/31 e ESLint direcionado aprovados. A suíte BPM teve 454 aprovações e 16 falhas basais; typecheck e lint globais permaneceram bloqueados por débitos externos documentados na story. Build sem diagnóstico novo, mas interrompido por permanecer sem saída durante a compilação.

**Última atualização:** 2026-09-04 por Scribe (sessão Bibble, fechamento RM-2026-CB55AA)

## Alpha CRM — Correção de duplicação do campo 'Próximo Contato' na coluna Novos Leads (RM-2026-546E71, 2026-09-03)

**Sintoma:** campo "Próximo Contato" (rótulo + asterisco + input Data/hora + botão "Salvar próximo contato") aparecia 2x no card do CRM.

**Causa raiz:** não havia dois mecanismos de dados concorrentes (campo dinâmico `BpmCampo` vs. campo dedicado). Era o **mesmo componente `PainelProximoContato`** montado duas vezes na mesma árvore de renderização: uma vez indiretamente dentro de `CardOpenFormSlot.tsx` (que já centraliza a composição dos painéis de formulário da etapa) e outra vez explicitamente logo depois, solta em `PainelRegistrar.tsx` (linhas 97-105, incluindo um comentário órfão — "Painéis específicos por etapa são renderizados via `CardOpenFormSlot`" — resíduo de uma refatoração anterior em que o componente foi movido para dentro do slot sem remover a chamada original). Como nenhuma das duas instâncias era condicionada por etapa, a duplicação ocorria em **todas as etapas do pipeline**, não só em "Novos leads" — essa etapa só foi onde o usuário notou por ser a mais usada.

**Correção aplicada:** removido o bloco JSX duplicado (`<PainelProximoContato ... />` + comentário órfão) e o import não usado de `PainelRegistrar.tsx`, mantendo a única instância já existente em `CardOpenFormSlot.tsx`. Ambas as instâncias escreviam exclusivamente em `BpmCard.proximoContatoEm` via `AtualizarCardBpm`/`registerSave` — a correção é puramente de JSX, sem qualquer mudança de persistência ou risco de perda de dados.

**Arquivos tocados:**
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar.tsx` (modificado — remoção do bloco duplicado + import)

**Sem migration necessária** — correção puramente de renderização.

**Caminho de consumo:**
```
/PainelAlpha/AlphaCRM/pipeline/[pipelineId]
  → card (qualquer etapa) → CardFullViewModal → CardAbertoLayout → PainelRegistrar → CardOpenFormSlot
  → campo "Próximo Contato" (1x) → input Data/hora → botão "Salvar próximo contato" → AtualizarCardBpm
```

**Última atualização:** 2026-09-03 por Scribe (sessão Bibble, fechamento RM-2026-546E71)

## Gerador de Documentos — reescrita IA sincronizada (RM-2026-BB92C7, 2026-09-03)

`ReescreverClasulaComIA` mantém a cláusula como fonte de verdade editável, mas agora só confirma a persistência depois de sincronizar os artefatos de apresentação. A action autentica, valida permissão/ownership e Zod, bloqueia documentos finalizados/arquivados, chama o Onyx com token individual, substitui a cláusula nos nós de texto do HTML preservando tags, regenera o PDF, publica novas revisões dos blobs e atualiza cláusula + URLs em transação. Documentos legados sem HTML recebem um HTML estrutural mínimo a partir das cláusulas. O client troca imediatamente o texto e recarrega ambos os iframes com as novas revisões.

Como `htmlUrl` ainda não existe no schema/migrations, a `pdfUrl` persistida também identifica o HTML irmão no Blob (`documentos-pdf/.../<revisão>.pdf` → `documentos-html/.../<revisão>.html`). A action só executa o `UPDATE htmlUrl` quando a coluna é detectada; sem ela, a reescrita permanece atômica no banco e o reload recupera o HTML pela URL derivada, sem migration nesta fase.

**Caminho de consumo:** `/PainelAlpha/GeradorDocumentos` → documento → `/PainelAlpha/GeradorDocumentos/conferencia/[token]` → cláusula → “Reescrever com IA”.

**Última atualização:** 2026-09-03 por Echo (RM-2026-BB92C7, Fase 3)

## Gerador de Documentos — PDF inline + fidelidade estrutural (RM-2026-BB92C7, 2026-09-03)

`ConferenciaClient` exibe o PDF recém-gerado em iframe pela rota autenticada de download com `?disposition=inline`; o download normal permanece `attachment`. `pdfUrl` foi substituída por `pdfDisponivel` nos payloads de UI tocados. O renderer HTML→PDF agora preserva a ordem de títulos, imagens HTTP(S)/base64, listas e tabelas com `colspan`, bordas e cabeçalhos; `<header>`/`<footer>` reconhecíveis usam `fixed` e se repetem. Destinos de imagem em rede privada são recusados. `FinalizarDocumento` usa o HTML fiel quando `htmlUrl` existe e só recorre ao PDF textual em documentos legados sem HTML.

**Caminho de consumo:** `/PainelAlpha/GeradorDocumentos` → gerar → `/PainelAlpha/GeradorDocumentos/conferencia/[token]` → “PDF gerado”.

**Limite:** CSS arbitrário, fontes incorporadas, posicionamento absoluto, paginação pixel-perfect e imagens relativas não autocontidas não são reproduzidos pelo `@react-pdf/renderer`.

**Última atualização:** 2026-09-03 por Nova (RM-2026-BB92C7, Fase 2)

## Gerador de Documentos — grifo de variáveis na revisão (RM-2026-BB92C7, 2026-09-03)

**Objetivo:** identificar visualmente, no HTML fiel da conferência, valores preenchidos e variáveis faltantes sem alterar o layout original.

**Implementação:** `renderHtmlComVariaveis()` agora substitui placeholders somente em nós de texto, escapa o valor inserido e envolve cada ocorrência conhecida em `<mark data-variable data-var-status>`. Preenchidas usam amarelo (`#fef08a`); faltantes exibem `[FALTANTE: nome]` em vermelho (`#fecaca`). O CSS é injetado no `head` do HTML persistido, portanto funciona dentro do iframe remoto de `ConferenciaClient`. Tags, atributos, scripts e estilos não são reescritos.

**Autoajuste da Fase 0:** `GerarDocumento` permite criar o rascunho `CONFERENCIA` com variável obrigatória vazia para que o usuário veja o marcador vermelho. `FinalizarDocumento` revalida as definições do template contra `DocumentoGerado.variaveisJson` e bloqueia a finalização enquanto houver obrigatórias ausentes.

**Caminho de consumo:** `/PainelAlpha/GeradorDocumentos` → template → “Gerar documento” → `/PainelAlpha/GeradorDocumentos/conferencia/[token]` → iframe “Visualização fiel do documento”.

**Última atualização:** 2026-09-03 por Nova (sessão Bibble, RM-2026-BB92C7)

## Agenda Alpha — modal de evento compartilhado responsivo + confirmação de presença (RM-2026-1FE530, 2026-09-01)

**Objetivo:** corrigir o modal de detalhes de evento compartilhado que abria fora da viewport, e adicionar dia exato + confirmação de presença ("Você vai?").

**Causa raiz:** `src/components/CalendarioAlpha/DetalhePopover.tsx` renderizava o conteúdo completo do convite (Meet, localização, descrição, convidados) dentro de um `Popover` do Radix ancorado ao chip do evento na grade do calendário, com `w-[min(94vw,46rem)]`. Posicionamento flutuante ancorado não garante permanência na viewport para conteúdo grande/variável perto das bordas da grade.

**Correção aplicada:**
- Para eventos com `compartilhadoComUsuario`, o clique agora abre `AgendaModal3D` (Dialog centralizado no desktop / Sheet inferior no mobile, já existente e usado no mesmo arquivo para a confirmação de cancelamento) em vez do Popover ancorado. Eventos não compartilhados continuam no Popover leve original.
- Nova linha "Dia: " (`formatarTituloDia`) acima de "Quando: ".
- Confirmação de presença "Você vai?" (Sim/Talvez/Não): `responderConvite`/`responderConviteParaColega` (`src/actions/google-calendar-eventos.ts`, `src/actions/google-calendar-admin.ts`) chamam nova `responderConvite` em `src/lib/google-calendar/client.ts`, que faz `PATCH` só no `responseStatus` do participante `self` (preserva os demais convidados, `sendUpdates: "all"`). Resposta atual lida via novo helper `respostaAtualDoUsuario` (`lib/tipos.ts`).

**Caminho de consumo:** `/PainelAlpha/CalendarioAlpha` → clicar em evento compartilhado (mês/semana/dia) → modal.

**Última atualização:** 2026-09-01 por Scribe (sessão Bibble, fechamento RM-2026-1FE530)

## Alpha CRM — Exclusão de cards (RM-2026-C99F86, 2026-09-01)

**Objetivo:** permitir admins e gestores excluir cards do Kanban BPM.

**Server Action:** `ExcluirCardBpm` em `src/actions/bpm/Cards.ts` — hard delete com cascades do schema Prisma (BpmCardCampoValor, BpmCardMembro, BpmTarefa, BpmCardAnexo, BpmCardHistorico, BpmInteracaoCard, BpmChecklistFollowUp, BpmCardVinculo). Guard: `auth()` + `exigirAcessoBpmCard(cardId, userId, userRole, "excluirCard")` — autoriza card-roles RESPONSAVEL/ADMINISTRADOR + bypass Admin/CEO/TI global.

**UI:** botão `Trash2` no header de `CardAbertoLayout.tsx` (gate visual: `podeGerenciarMembros`) → `AlertDialog` de confirmação (título "Excluir card", mensagem "irreversível", botões Cancelar/Excluir) → `ExcluirCardBpm` → `toast.success`/`toast.error` → `onClose()`. Loading state: `disabled={excluindo}` + texto "Excluindo…".

**Permissão:** role-based via `PERMISSOES_POR_ROLE` em `src/lib/bpm/ownership.ts` — `excluirCard` mapeado para RESPONSAVEL e ADMINISTRADOR (card-roles de `BpmCardMembro.role`), não para PARTICIPANTE. Bypass global via `isAdminRole` (Admin/CEO/TI). Verificação real no servidor; gate visual no client é apenas UX.

**Realtime:** `"CARD_EXCLUIDO"` adicionado a `BPM_REALTIME_TIPOS` em `src/lib/bpm/realtime.ts`. `notificarPipelineBpm({ tipo: "CARD_EXCLUIDO" })` chamado após o delete.

**Testes:** `tests/bpm/excluir-card.test.ts` (12 casos: permissão, validação, transação, mensagens de erro, realtime, UI, ownership mapping).

**Caminho de consumo:**
```
/PainelAlpha/AlphaCRM/pipeline/[pipelineId]
  → KanbanCard → clique → CardFullViewModal → CardAbertoLayout
  → header → botão Trash2 (visível para RESPONSAVEL/ADMINISTRADOR/Admin global)
  → AlertDialog "Excluir card" → confirmar → ExcluirCardBpm
  → card + filhos removidos (cascade) → toast.success → modal fecha → board atualizado
```

**Última atualização:** 2026-09-01 por Scribe (sessão Bibble, fechamento RM-2026-C99F86)

---

## Tabs de Serviços no Card — catálogo dinâmico de serviços comerciais (RM-2026-29F59C, 2026-09-01)

**Objetivo:** substituir a lista hardcoded de tabs de serviço no card do Alpha CRM por uma lista dinâmica.

**Nota de divergência de terminologia:** o Markdown da fase (gerado automaticamente pelo Roadmap) descreve o objetivo como "nome do pipeline atual" e "tabs exibindo pipelines reais do banco". A auditoria (Scout, Fase 0) confirmou que essa terminologia está incorreta: `BpmPipeline` é um conceito de fluxo interno de processo (ex.: "Revisão de Radar", "Financeiro"), distinto de "serviço comercial" vendido (ex.: "Radar", "TTD-409", "Recuperação Tributária"). A fonte de dados correta e já existente no projeto é o model `ServicosComerciais`. A aba fixa "Este card" (texto hardcoded em `CardAbertoLayout.tsx`) é a própria aba do card — conceito distinto de "nome do pipeline" — e foi mantida intacta.

**Componente modificado:** `CardAbertoLayout.tsx` (`src/app/PainelAlpha/AlphaCRM/CardModal/`) — header com `Tabs`. `CardFullViewModal.tsx` teve apenas a constante morta duplicada (`SERVICOS_FIXOS`, nunca usada no JSX) removida.

**Mudança:**
- Array estático `SERVICOS_FIXOS = ["Radar", "TTD-409", "Recuperação Tributária"]` (duplicado em `CardAbertoLayout.tsx` e `CardFullViewModal.tsx`) → estado `servicos`, carregado via `useEffect` chamando `getServicosComerciais()` (`src/actions/ContratoComercial.ts:586`), mesclado com `SERVICOS_COMERCIAIS_PADRAO` (`src/lib/comercial/servicos.ts`) como fallback/piso — mesmo padrão já usado em `ModalGerenciamentoLeads.tsx`/`ModalNovaIndicacao.tsx`.
- Fonte de dados: model `ServicosComerciais` (`prisma/schema.prisma:1639`), filtrado por `ativo: true`, ordenado por `nome`. Nenhuma migration — model e action já existiam, reaproveitados sem alteração.
- Navegação ao clicar: sem navegação de rota — `TabsTrigger` altera `abaAtiva` (state local), `TabsContent` renderiza `PainelHistoricoServico` in-place (`ObterHistoricoServicoEmpresa(cardId, servico)`, inalterado).

**Testes:** `tests/bpm/card-tabs-servicos-dinamicas.test.ts` (novo, 3 casos: ausência de hardcode, uso da lista dinâmica, mesclagem com padrão).

**Qualidade:** `npx tsc --noEmit` — zero erros nos arquivos da fase (único erro do projeto é pré-existente, em `src/lib/gerador-documentos/pdf-renderer.ts`, não relacionado). `npm run lint` — zero warnings/erros novos nos arquivos tocados (warning morto `SERVICOS_FIXOS is assigned a value but never used` foi eliminado). `npm run build` — 2 erros pré-existentes no módulo Gerador de Documentos, fora do rastro de import desta fase. `npx vitest run tests/bpm/` — 20 falhas pré-existentes (baseline idêntico) / 307 passando, zero regressão.

**Caminho de consumo:**
```
/PainelAlpha/AlphaCRM/pipeline/[pipelineId]
  → KanbanCard → clique → CardFullViewModal → CardAbertoLayout
  → header → Tabs ("Este card" fixa + tabs de serviço dinâmicas via getServicosComerciais())
  → TabsContent → PainelHistoricoServico → ObterHistoricoServicoEmpresa(cardId, servico)
```

**Última atualização:** 2026-09-01 por Scribe (sessão Bibble, fechamento RM-2026-29F59C)

---

## Aba Tarefas do Card CRM — exibição completa de campos (RM-2026-1BA46D, 2026-09-01)

**Sintoma:** card da tarefa na aba "Tarefas" do CRM (`PainelTarefasPorTipo.tsx`) só exibia tipo (badge), título e datas de prazo/alerta; faltavam descrição, prioridade, status, responsável e data de conclusão — todos já existentes no model `BpmTarefa` e preenchidos no formulário de criação, mas nunca exibidos.

**Causa raiz:** lacuna puramente de exibição — `ObterCardBpm` (`src/actions/bpm/Cards.ts`) não incluía a relação `responsavel` no `include` de `tarefas`, e o JSX de `PainelTarefasPorTipo.tsx` renderizava apenas 3 dos ~9 campos disponíveis no model.

**Correção aplicada:**
- `src/actions/bpm/Cards.ts` — `include.tarefas` (dentro de `ObterCardBpm`) ganhou `responsavel: { select: { id, nome } }`.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelTarefasPorTipo.tsx` — renderização de cada tarefa ampliada para exibir: título (destaque, fallback "Tarefa sem título"), descrição (`line-clamp-3`, `whitespace-pre-line`, condicional), tipo (badge, já existia), prioridade (badge colorido — ALTA=red, MEDIA=amber, fallback=slate, condicional), status (badge Concluída=emerald / Pendente=slate), prazo (ícone Calendar + `fmtDateTime`, vermelho se vencido e não concluída), alerta (ícone Bell + `fmtDateTime`, já existia), responsável (ícone User + nome, condicional), concluída em (ícone CheckCircle2 + data, condicional). Adicionado estado vazio ("Nenhuma tarefa cadastrada para este card") e `aria-label` nos ícones/botão de concluir. Cada bloco tem guarda condicional — campos `null`/vazios não renderizam bloco vazio.

**Sem migration necessária** — todos os campos já existiam no model `BpmTarefa`; a mudança em `Cards.ts` é um `include` Prisma aditivo.

**Arquivos tocados:**
- `src/actions/bpm/Cards.ts` (modificado)
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelTarefasPorTipo.tsx` (modificado)

**Testes:** nenhum arquivo de teste novo criado nesta sessão (mudança de exibição/JSX + `include` aditivo). Suítes existentes (`tests/bpm/`, `tests/gerador-documentos/`, `tests/parceiros/`) verificadas por Probe via `npx vitest run`: 523 passaram / 28 falharam em 17 arquivos — dentro do baseline pré-existente documentado (29 falhas/17 arquivos), nenhuma falha nova relacionada a `Cards.ts`/`PainelTarefasPorTipo.tsx` confirmada via comparação com o baseline.

**Qualidade:** `npx tsc --noEmit` — zero erros nos arquivos da fase (o único erro do projeto, em `src/lib/gerador-documentos/pdf-renderer.ts`, é pré-existente/untracked, de feature não relacionada — Gerador de Documentos RM-2026-94CBF6). `npm run lint` (arquivos da fase) — zero erros/warnings; lint do projeto completo tem 2499 erros/1272 warnings pré-existentes, nenhum nos arquivos da fase. `npm run build` — falha por causa do mesmo `pdf-renderer.ts` (erro de parsing, `.ts` com JSX) e da rota de download do Gerador de Documentos (import quebrado de `@/auth`), ambos fora do rastro de import dos arquivos desta fase e não relacionados a esta entrega — débito técnico pré-existente, recomendado abrir item de correção separado.

**Caminho de consumo:**
```
/PainelAlpha/AlphaCRM/pipeline/[pipelineId]
  → card → CardFullViewModal/PainelHistorico → aba "Tarefas"
  → PainelTarefasPorTipo (título, descrição, tipo, prioridade, status, prazo, alerta, responsável, concluída em)
  → estado vazio quando não há tarefas
```

**Última atualização:** 2026-09-01 por Scribe (sessão Bibble, fechamento RM-2026-1BA46D)

---

## Melhorias na criação de tarefas — prazo (data+hora) e alerta (opções predefinidas) (RM-2026-66F07D, 2026-09-01)

**Objetivo:** adicionar ao formulário de criação de tarefas (`/PainelAlpha/PainelTarefas/GerenciarTarefas`) um campo de **prazo** (data+hora) e um campo de **alerta** (select com opções predefinidas de antecedência).

**O que mudou:**
- **Prazo (data+hora):** já existia no formulário como `dataInicio` (input `type="date"`) + `horario` (input `type="time"`) — padrão do projeto, sem mudança. O requisito de "select de data e hora" foi satisfeito por esses dois inputs nativos HTML.
- **Alerta (select predefinido):** novo campo `<select>` com 7 opções predefinidas (`15MIN_ANTES` a `1SEMANA_ANTES`). O valor persistido é a **chave** (ex.: `"1H_ANTES"`), não o texto exibido.

**Arquivos modificados:**
- `src/lib/tarefas/schemas.ts` — **novo** (Zod schema `CriarTarefaSchema` + constantes `ALERTA_OPCOES` + função `alertaChaveParaMinutos()`)
- `src/actions/Tarefas.ts` — `CriarTarefa` aceita `alerta?: string` e persiste via raw SQL (best-effort, try/catch)
- `src/app/PainelAlpha/PainelTarefas/GerenciarTarefas/page.tsx` — select de alerta no formulário + estado `alerta` no `novaTarefa`

**Componentes reutilizados vs. criados:**
- **Reutilizados:** `<select>` nativo HTML (padrão do projeto), `input type="date"` / `input type="time"` (padrão do projeto), `ButtonLoading`, `toast` (sonner)
- **Criados:** nenhum componente novo — lógica inline em `page.tsx` + schema em `src/lib/tarefas/schemas.ts`

**Decisões de mapeamento (chave de alerta → valor persistido):**

| Chave | Label | Minutos |
|-------|-------|---------|
| `15MIN_ANTES` | 15 minutos antes | 15 |
| `30MIN_ANTES` | 30 minutos antes | 30 |
| `1H_ANTES` | 1 hora antes | 60 |
| `3H_ANTES` | 3 horas antes | 180 |
| `1DIA_ANTES` | 1 dia antes | 1440 |
| `2DIAS_ANTES` | 2 dias antes | 2880 |
| `1SEMANA_ANTES` | 1 semana antes | 10080 |

**Opções predefinidas implementadas:** 7 opções (15min, 30min, 1h, 3h, 1dia, 2dias, 1semana) — definidas em `ALERTA_OPCOES` em `src/lib/tarefas/schemas.ts`.

**Limitações conhecidas:**
- **Sem sistema de notificação ativo:** o campo `alerta` é persistido (quando a coluna existir) mas não dispara nenhuma notificação — não existe worker/queue de notificação no projeto.
- **Coluna `alerta` ausente no model `Tarefa`:** a persistência usa raw SQL best-effort (try/catch) — falha silenciosamente se a coluna não existir. Migration aditiva (`ALTER TABLE "Tarefa" ADD COLUMN "alerta" TEXT`) pendente (Vault).
- **Model `BpmTarefa`** (Alpha CRM) já possui `prazo`, `alertaEm`, `alertaDisparadoEm` — infraestrutura de dados pronta para o módulo BPM, mas o formulário de `PainelTarefas` usa o model `Tarefa` (diferente).

**Testes:** nenhum arquivo de teste novo criado nesta sessão. Baseline pré-existente inalterado (typecheck exit 1/output vazio, eslint exit 1/output vazio).

**Qualidade:** `typecheck` — exit 1, output vazio (baseline pré-existente, zero erros novos); `eslint` — exit 1, output vazio (baseline pré-existente, zero warnings novos).

**Caminho de consumo:**
```
/PainelAlpha/PainelTarefas/GerenciarTarefas?id=<userId>
  → botão "Nova Ordem"
  → modal "Nova Diretriz"
  → campos: texto, descricao, prioridade (select), dataInicio (date), horario (time), alerta (select 7 opções)
  → submit → CriarTarefa (Server Action) → persistência (alerta: best-effort, pendente migration)
  → toast.success("Diretriz lançada!") → carregarDados() → listagem atualizada
```

**Última atualização:** 2026-09-01 por Scribe (sessão Bibble, RM-2026-66F07D)

---

## Campos Conhecidos no CRM — pré-preenchimento automático (RM-2026-1D1118, 2026-09-01)

**Regra:** se um campo identificável (CNPJ, CPF, e-mail, telefone, razão social) já é conhecido para a entidade em questão, ele deve aparecer pré-preenchido em todos os formulários que o solicitam. O campo continua editável. O valor não é sobrescrito se o usuário já digitou.

**Fontes de verdade:**
- `Cliente.cnpj` / `Cliente.email` / `Cliente.telefone` / `Cliente.razaoSocial` / `Cliente.nomeFantasia`
- `EmpresaContratada.cnpj` / `EmpresaContratada.razaoSocial` / `EmpresaContratada.nomeFantasia`
- `Parceiro.documento` / `Parceiro.email` / `Parceiro.telefone` (já coberto por Receita Federal em `ModalNovaEmpresaContratada` e `NovoCardModal` — sem lacuna)

**Formulários com pré-preenchimento:**
- `/PainelAlpha/GeradorDocumentos/[templateId]` → `GerarDocumentoForm.tsx` → ao selecionar Contratante (Cliente) ou Contratada (EmpresaContratada), as variáveis do template correspondentes (CNPJ, razão social, nome fantasia, e-mail, telefone) aparecem pré-preenchidas automaticamente.

**Padrão implementado:**
- Função pura `prePreencherVariaveis()` em `GerarDocumentoForm.tsx` — itera sobre as variáveis do template, só preenche campos vazios (`if (atual !== undefined && atual !== "") continue`), nunca sobrescreve. Mapeamento por nome exato da variável (`cnpj`, `documento`, `razaoSocial`, `nomeFantasia`, `email`, `telefone`).
- Chamada em 3 pontos: `selecionarCliente()`, `handleEmpresaCriada()`, `handleSelecionarContratada()`.
- `src/actions/gerador-documentos.ts` — `BuscarClientesParaContratante` ganhou `email` e `telefone` no `select` (campos já existem no model `Cliente` — sem migration).
- Nenhum componente novo criado — lógica inline em `GerarDocumentoForm.tsx`.

**Decisões:**
- Só nome exato de campo, não semântica — evitar mapeamento ambíguo.
- Campo pré-preenchido continua editável — dado pode ter mudado.
- Não sobrescrever valor já digitado — UX, evitar perda de trabalho do usuário.
- Escopo limitado a campos estruturais (CNPJ, CPF, e-mail, telefone, razão social) — campos dinâmicos de etapa têm nomes arbitrários.
- Outros formulários (`NovoCardModal`, `NovoLeadCompleto`, `ModalNovaEmpresaContratada`) já possuem pré-preenchimento via Receita Federal — sem lacuna.

**Testes:** nenhum arquivo de teste novo criado nesta sessão (a função `prePreencherVariaveis` é pura e simples; a lógica de busca `BuscarClientesParaContratante` já era coberta por testes existentes em `tests/gerador-documentos/`).

**Qualidade:** `typecheck` — exit 1, output vazio (baseline pré-existente documentado em `architecture.md`); `eslint` — exit 1, output vazio (baseline pré-existente); zero regressão introduzida.

**Última atualização:** 2026-09-01 por Scribe (sessão Bibble, RM-2026-1D1118)

## Autosave em Cards CRM — correção de persistência (RM-2026-5BDA0D, 2026-09-01)

**Sintoma:** campos editáveis em cards do CRM não persistiam ao sair do card — usuário precisava redigitar.

**Causa raiz:** 3 componentes editáveis em cards CRM (`PainelProximoContato`, `PainelStatusPosFechamento`, `PainelChecklistFollowUp`) salvavam via `onBlur`/`onChange` **sem** registrar no `CardSaveContext` — o que significava que `flushSaves()` não os aguardava antes de `MoverCardBpm`. O resultado era perda de dados ao mover o card: o backend recebia `MoverCardBpm` antes dos saves desses componentes concluírem.

**Correção aplicada:**
- `PainelProximoContato.tsx` — `onBlur` → `registerSave(() => AtualizarCardBpm)` (antes: `AtualizarCardBpm` direto, sem registro)
- `PainelStatusPosFechamento.tsx` — `onChange` → `registerSave(() => AtualizarCardBpm)` (antes: `AtualizarCardBpm` direto, sem registro)
- `PainelChecklistFollowUp.tsx` — `onBlur` → `registerSave(() => SalvarChecklistFollowUpBpm)` (antes: `SalvarChecklistFollowUpBpm` direto, sem registro)

**Padrão seguido:** `registerSave`/`flushSaves` do `CardSaveContext` (estabelecido em RM-2026-2403E5). Todos os componentes editáveis com autosave-on-blur/onChange dentro de `CardSaveProvider` devem registrar via `registerSave` para que `flushSaves()` os aguarde antes de `MoverCardBpm`.

**Componentes intencionalmente fora do `registerSave`:**
- `PainelReuniao.tsx` — botão explícito "Agendar" (não autosave)
- `PainelStandbyFollowUp.tsx` — botão explícito "Interromper" (ação destrutiva com confirmação)
- `SeletorMembrosCard.tsx` — clique explícito em membro (não autosave)

**Caminho de consumo:** `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → card → `CardAbertoLayout` → `CardSaveProvider` → `CardOpenFormSlot` → `PainelProximoContato` / `PainelStatusPosFechamento` / `PainelChecklistFollowUp` → `onBlur`/`onChange` → `registerSave` → `flushSaves()` → `MoverCardBpm`.

**Testes:** 3 novos casos em `tests/bpm/card-save-flow.test.ts` (verificam que os 3 componentes importam `useCardSave` e usam `registerSave`). Total: 7 casos em `card-save-flow.test.ts` + `novos-leads.test.ts` cobrem o mecanismo completo.

**Última atualização:** 2026-09-01 por Scribe (sessão Bibble, fechamento RM-2026-5BDA0D)

---

## Visualização de card virtual de lead do site (RM-2026-948ED5, 2026-09-01)

**Sintoma:** card virtual de lead do site (`NolossLead`, `origem: "noloss"`) não abria ao clicar na pipeline Kanban — o `onClick` do `KanbanCard` tinha um guard `if (!ehLeadVirtual)` que impedia a abertura do modal para leads virtuais.

**Causa raiz:** o `KanbanCard` em `PipelineBoardClient.tsx` tinha uma condição `if (!ehLeadVirtual)` no handler de clique que impedia a abertura de qualquer modal para cards com `origem: "noloss"`. Não existia um handler dedicado nem um componente de visualização para esse tipo de card — a única ação disponível era a promoção (`PromoverNolossLead`), que não era acessível pelo clique no card.

**Correção aplicada:**
- `NolossLeadModal.tsx` (novo, `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/`) — modal bottom-sheet (mesmo padrão visual de `CardFullViewModal`) que exibe os dados do lead pendente (nome, e-mail, telefone, data de recebimento) e oferece o botão "Assumir lead" que dispara `PromoverNolossLead` com seleção de responsável.
- `PipelineBoardClient.tsx` — 4 alterações mínimas: import do `NolossLeadModal`; interface `CardBpm` ganhou `nolossEmail?` e `nolossTelefone?` (opcionais); `onClick` do `KanbanCard` agora sempre chama `onAbrir` (removido o guard `if (!ehLeadVirtual)`); `abrirCard` detecta `origem === "noloss"` e abre o `NolossLeadModal` em vez do `CardFullViewModal`.
- `src/actions/bpm/Cards.ts` — `ListarCardsPipelineBpm` agora inclui `nolossEmail` e `nolossTelefone` nos cards virtuais (dados já disponíveis no `NolossLead`).

**Caminho de consumo:** `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → coluna "Novos leads" → card com borda tracejada (lead do site) → clique → `NolossLeadModal` (dados + botão "Assumir lead") → `AtribuirResponsavelPromocaoModal` → `PromoverNolossLead` → card vira `BpmCard` nativo → `CardFullViewModal` abre normalmente.

**Testes:** nenhum arquivo de teste novo criado nesta sessão (o modal é um componente de UI com lógica mínima — exibição de dados + botão de ação). A lógica de promoção (`PromoverNolossLead`) já era coberta por testes existentes em `tests/bpm/noloss-leads.test.ts`.

**Qualidade:** `typecheck` — exit 1 com output vazio (baselines pré-existentes documentados em `architecture.md`: "6 baselines de sempre"); nenhuma mudança de tipo introduzida (campos opcionais `?` no interface, sem quebra de contrato). `eslint` — exit 1, output vazio (baseline pré-existente). `tests` (noloss) — exit 1, output vazio (baseline pré-existente).

**Última atualização:** 2026-09-01 por Scribe (sessão Bibble, fechamento RM-2026-948ED5)

---

## Gerador de Documentos — HTML fiel + PDF (RM-2026-94CBF6, 2026-09-01)

**Objetivo:** transformar o template em HTML fiel (layout, tabelas, listas) e gerar PDF a partir desse HTML, com rota de download autenticada.

**Arquivos criados:**
- `src/lib/gerador-documentos/html.ts` — `converterParaHtml()` (Tika `Accept: text/html`, timeout 30s)
- `src/lib/gerador-documentos/html-render.ts` — `renderHtmlComVariaveis()` (substituição `{{var}}` em HTML, preserva tags)
- `src/lib/gerador-documentos/pdf-renderer.ts` — `renderHtmlParaPdf()` (extrai blocos do HTML → `@react-pdf/renderer` A4)
- `src/app/PainelAlpha/GeradorDocumentos/[id]/download/route.ts` — `GET` autenticada (auth + ownership + rate limit 5/min)
- `tests/gerador-documentos/html-converter.test.ts` (5 casos)
- `tests/gerador-documentos/html-render.test.ts` (8 casos)
- `tests/gerador-documentos/pdf-renderer.test.ts` (6 casos)
- `tests/gerador-documentos/download-pdf.test.ts` (6 casos)

**Arquivos modificados:**
- `src/actions/gerador-documentos.ts` — `CriarTemplateViaUpload` (conversão HTML + Blob + raw UPDATE), `GerarDocumento` (fetch template HTML → render variáveis → PDF → Blob + raw UPDATE)
- `src/components/GeradorDocumentos/ConferenciaClient.tsx` — iframe HTML + botão "Baixar PDF" (rota autenticada)
- `src/components/GeradorDocumentos/GeradorDocumentosClient.tsx` — ícone download na listagem

**Decisões técnicas:**
1. **Conversão documento→HTML:** Tika com `Accept: text/html` (mesmo servidor, só troca o header) — zero dependência nova, suporta PDF/DOCX/ODT/RTF/TXT.
2. **HTML→PDF:** `@react-pdf/renderer` (já em produção, compatível com Vercel serverless). Extrai parágrafos/tabelas/listas do HTML e renderiza em A4. Não usa puppeteer/playwright (incompatível com serverless).
3. **Reconciliação com cláusulas:** HTML = artefato de exibição fiel; cláusulas de texto = fonte de verdade editável (Onyx). Ambos coexistem.
4. **`htmlUrl` no schema:** 2 colunas nullable TEXT (aditivas) em `DocumentoTemplate` e `DocumentoGerado`. Migration pendente (Vault). Código é seguro sem ela — todos os `$queryRaw`/`$executeRaw` em try/catch.
5. **Rota de download:** `auth()` + ownership + rate limit 5/min (mesmo padrão de `contratos/upload`). `pdfUrl` nunca exposta diretamente ao cliente.

**Caminho de consumo:**
- `/PainelAlpha/GeradorDocumentos` → tab "Documentos gerados" → ícone download → `GET /PainelAlpha/GeradorDocumentos/[id]/download` → PDF autenticado
- `/PainelAlpha/GeradorDocumentos/conferencia/[token]` → iframe HTML (visualização fiel) → botão "Baixar PDF" → mesma rota autenticada

**Débitos técnicos:**
- Migration aditiva `htmlUrl` (2 colunas nullable TEXT) pendente — Vault
- Teste de integração do fluxo completo `GerarDocumento` com PDF (mock extenso)
- Validação visual em navegador (sem credenciais de teste)

**Última atualização:** 2026-09-01 por Scribe (sessão Bibble, fechamento RM-2026-94CBF6)

---

## BPM — bug fix: card em "Novos leads" travava movimento mesmo com campos obrigatórios preenchidos (RM-2026-2403E5, 2026-08-31)

**Sintoma:** ao preencher "Radar pretendido" e "Confirmar serviço" (campos dinâmicos `BpmCampo`/`BpmCardCampoValor`, obrigatórios na saída da etapa "Novos leads") e mover o card imediatamente, o backend rejeitava o movimento com erro de campo obrigatório ausente, mesmo com os dois valores visivelmente preenchidos na UI.

**Causa raiz (não era bug de schema, validação ou nome de campo):** `PainelCamposEtapaAtual.tsx` salvava cada campo em `onBlur`, mas a versão-base usada pelo CAS (`BpmCard.updatedAt`) só era atualizada de forma otimista/tardia, e o `Promise` registrado para o autosave sempre resolvia com sucesso mesmo quando `AtualizarCardBpm` retornava erro (o erro virava apenas um toast). Resultado: `PainelProximaEtapa.tsx` podia chamar `MoverCardBpm` acreditando que todos os saves haviam concluído, enquanto o backend ainda lia valores antigos/ausentes em `BpmCardCampoValor` — a validação em `listarCamposObrigatoriosFaltantes` (`src/lib/bpm/requisitos-etapa.ts`) e a revalidação transacional em `executarMovimentoComRequisitos` (`src/actions/bpm/Cards.ts`) estavam corretas o tempo todo; o problema era o timing/sincronização do lado do cliente que as alimentava.

**Correção aplicada (commit `5d67abcc`):**
- `CardSaveContext.tsx` (`src/app/PainelAlpha/AlphaCRM/CardModal/`): API mudou de "fire-and-forget" para `registerSave(save: () => Promise<boolean>) => Promise<boolean>` + `flushSaves(): Promise<boolean>` — propaga sucesso/falha real de cada save em vez de resolver sempre `void`.
- `PainelCamposEtapaAtual.tsx`: atualiza `versaoBaseCamposRef.current`/`versaoBaseCampos` somente após confirmar a versão real do servidor (re-fetch via `ObterCardBpm` pós-save) e retorna `false` no `registerSave` quando `AtualizarCardBpm` falha — elimina o CAS obsoleto.
- `PainelProximaEtapa.tsx` (`handleMover`): chama `flushSaves()` e só invoca `MoverCardBpm` se `savesConcluidos === true`; caso contrário exibe toast e não move o card.
- Validação backend (`requisitos-etapa.ts`, `Cards.ts`) não foi alterada — permanece a fonte de verdade, só deixou de receber dados obsoletos.

**Caminho de consumo:** `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → card em "Novos leads" → aba "Formulário da Etapa" (`CardOpenFormSlot` → `PainelCamposEtapaAtual`) → preencher campos → `PainelProximaEtapa` no painel direito → `MoverCardBpm`.

**Testes:** `tests/bpm/novos-leads.test.ts` + `tests/bpm/card-save-flow.test.ts` (14/14, cobrindo preenchido/vazio-nulo/parcial). Suíte completa `tests/bpm/`: 298/319 — as 21 falhas restantes são pré-existentes, todas por referência a `PainelRequisitosAvanco.tsx` (componente removido em commit anterior `015b15e6`, não relacionado a esta correção).

**Última atualização:** 2026-08-31 por Scribe (sessão Bibble, fechamento RM-2026-2403E5)

---

## Card BPM — restrição de campos na etapa Novos Leads (RM-2026-5830C2, 2026-08-31)

**Objetivo:** exibir apenas 5 campos no card do Kanban quando a etapa é "Novos leads" (pipeline "Revisão de Radar"), em vez dos ~12 campos exibidos nas demais etapas.

**Componente modificado:** `KanbanCard` em `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` (linha ~150). Único local de renderização do card no Kanban — o detalhe do card (`CardFullViewModal` → `PainelCamposEtapaAtual`) é um modal separado com renderização própria e **não** é afetado.

**Campos mantidos quando `novosLeads === true`:**

| Campo | Fonte de dados |
|-------|---------------|
| Nome do responsável | `card.membros` → `GrupoAvataresMembrosCard` |
| CNPJ | `card.empresa.cnpj` → `formatCNPJ` |
| Radar pretendido | `card.campoValores?.find(c => c.campo.nome === "Radar pretendido")?.valor` (novo, mesmo padrão de `canalOrigem`) |
| Próximo Contato | `card.proximoContatoEm` → `BadgeProximoContato` |
| Anotação | `card.tarefas.find(t => t.tipo === "LEMBRETE_RAPIDO")` |

**Campos removidos quando `novosLeads === true`:** nome fantasia secundário, serviço, alertas de boas-vindas/alinhamento, canal de origem, status pós-fechamento, ligações do dia/dia do ciclo, próxima tarefa com prazo, contadores de tarefas/anexos.

**Lógica condicional:** bloco `{novosLeads && !ehLeadVirtual ? (render restrito) : (render padrão)}` — quando `novosLeads` é `true`, renderiza apenas os 5 campos; quando `false`, mantém o render atual sem alteração. Zero mudança de schema, migration ou Server Action — restrição puramente visual.

**Testes:** `tests/bpm/card-campos-novos-leads.test.ts` (2 casos: restrição na etapa Novos leads + regressão para demais etapas). Suíte `tests/bpm/`: 299/321 (22 falhas pré-existentes, todas por referência a `PainelRequisitosAvanco.tsx` removido em commit anterior).

**Última atualização:** 2026-08-31 por Scribe (sessão Bibble, fechamento RM-2026-5830C2)

---

## Gerador de Documentos — nome do contratante + busca na listagem de documentos gerados (RM-2026-DC0043, 2026-08-31)

`DocumentoGerado.clienteId` já existia (FK→`Cliente`, desde RM-2026-67DF34) mas `ListarDocumentosGerados` (`src/actions/gerador-documentos.ts`) não incluía `cliente` no `select` — lacuna puramente de exibição, sem mudança de schema. Ampliado o `select` com `cliente: { select: { id, razaoSocial, nomeFantasia } }`.

`GeradorDocumentosClient.tsx` (tab "Documentos gerados"): `DocumentoRow` agora exibe "Contratante: {nome}" (fallback `razaoSocial` → `nomeFantasia` → "—"). Adicionado campo de busca (`Input` shadcn + ícone `Search`, debounce 300ms) que filtra client-side por título OU nome do contratante — decisão consciente de manter client-side porque a listagem já carrega tudo de uma vez sem paginação (mesmo padrão observado, não server-side).

**Lógica de filtro extraída para função pura testável:** `filtrarDocumentosPorBusca()` (`src/lib/gerador-documentos/busca.ts`, novo) — reaproveitada tanto no componente (via `useMemo`) quanto testada isoladamente em `tests/gerador-documentos/busca.test.ts` (6 casos: busca vazia, título, razão social, nome fantasia, documento sem cliente, sem match).

**Qualidade:** `tsc --noEmit`/`eslint`/`npm run build` limpos nos arquivos tocados (confirmado via `git stash` que os erros pré-existentes em `gerador-documentos.ts:491`, `[id]/download/route.ts` e módulos de Google Calendar já existiam antes desta sessão — zero regressão). `tests/gerador-documentos/`: 4 falhas pré-existentes em `empresas-contratadas.test.ts` (não relacionadas, arquivo não tocado, confirmadas via stash) + todos os demais passando, incluindo os 6 novos.

## Gerador de Documentos — botão de voltar na página de geração (RM-2026-2AB551, 2026-08-31)

Página de geração de contrato ganhou botão de voltar (navegação `router.back()` com fallback para a rota do template de origem). Mudança frontend isolada, sem impacto em backend, schema ou testes. Scout já havia confirmado a existência de um link "voltar" funcional; o ajuste desta sessão foi só de forma — trocado por `Button` shadcn com `aria-label` e lógica `router.back()`/fallback baseada em `window.history.length`, preservando o destino correto (`/PainelAlpha/GeradorDocumentos/[templateId]`).

## Gerador de Documentos — Contratante/Contratada + Qualificação (2026-08-29, Parte 1 de 2)

Evolução pós-upload-de-template: usuário pediu 4 coisas no mesmo pedido — nenhuma era bug, todas eram feature nova (o módulo antes só lidava com variáveis soltas, zero noção de cliente/empresa). Esta Parte 1 cobre 3 dos 4 itens; **geração de PDF real fica para a Parte 2** (mesma sessão, ainda não implementada nesta entrada).

**Contratante (Cliente master):** `GerarDocumentoForm.tsx` ganhou combobox de busca assíncrona (debounce 300ms, mesmo padrão de `NovoCardModal.tsx` do Alpha CRM) contra nova `BuscarClientesParaContratante` (`src/actions/gerador-documentos.ts`) — clone de `BuscarEmpresasBpm` (`src/actions/bpm/Cards.ts`), mas sob o gate `exigirAcessoModulo` do Gerador de Documentos (não reaproveitado diretamente por usar gate de módulo diferente, `exigirAcessoModuloBpm`). `Cliente` é confirmado como cadastro **compartilhado da empresa** (não por usuário) — busca não filtra por `criadoPorId`, mesmo padrão de outros módulos que consomem `Cliente`.

**Contratada (EmpresaContratada — model novo):** cadastro de qualificação de empresa terceira que atua como CONTRATADA em documentos gerados. `EmpresaContratada` (migration `20260829153000_add_empresa_contratada_e_vinculos_documento_gerado`, 100% aditiva): razão social/CNPJ/endereço completo/natureza jurídica + representante legal (nome/CPF/cargo — **sempre manual**, a Receita Federal não retorna isso formalmente, só QSA/sócios que é conceito diferente). CRUD em `src/actions/empresas-contratadas.ts` (novo): `CriarEmpresaContratada`, `ListarEmpresasContratadas` (cadastro global do módulo, sem filtro por dono — decisão intencional, diferente de `DocumentoTemplate` que É por usuário), `AtualizarEmpresaContratada`, `ConsultarCnpjParaQualificacao` (reaproveita `getReceitaData`, já exportada de `src/app/api/ReceitaFederal/route.ts`).

**`DocumentoGerado` ganhou 3 campos novos** (todos nullable, aditivos): `clienteId Int?` (FK→Cliente, `onDelete: SetNull`), `empresaContratadaId String?` (FK→EmpresaContratada, `onDelete: SetNull`), `pdfUrl String?` (ainda não populado — Parte 2). `GerarDocumento` persiste `clienteId`/`empresaContratadaId` quando fornecidos; UI bloqueia gerar se **nenhum dos dois** for selecionado (decisão confirmada com o usuário — não é bug, é intencional).

**Refatoração durante Lens:** `getSessao()` estava duplicada entre `gerador-documentos.ts` e `empresas-contratadas.ts` (único par de arquivos `actions/*.ts` do projeto com esse padrão de duplicação). Extraída para `getSessaoGeradorDocumentos()` em `src/lib/gerador-documentos/ownership.ts` (agora importa `auth` — **qualquer teste que mocka esse arquivo precisa mockar `../../auth` também**, ver correção em `tests/gerador-documentos/ownership.test.ts`).

**Testes:** `tests/gerador-documentos/{schemas,empresas-contratadas,buscar-clientes-contratante}.test.ts` — 32 novos (96 total no módulo, 100% passando).

**Achado de infraestrutura de testes relevante:** o baseline de falhas pré-existentes da suíte completa do projeto estava desatualizado em `known-errors.md` (documentado como 26 falhas/2 arquivos — na verdade são **29 falhas/17 arquivos**, incluindo vários `tests/bpm/*` e `tests/alpha-seo/*` não catalogados antes). Confirmado via `git stash` temporário (reverte tudo, roda teste isolado, `git stash pop` para restaurar) que essas falhas extras já existiam antes desta sessão — zero regressão introduzida. Baseline corrigido em `known-errors.md`.

**Última atualização:** 2026-08-29 por Scribe (sessão Bibble, contratante/contratada — Parte 1)

---

## Gerador de Documentos — criação de template via upload com IA (RM-2026-93645F, 2026-08-29)

Evolução do módulo (fundação em RM-2026-999766, abaixo): o fluxo de **criação** de template deixou de ser formulário manual (título/descrição/variáveis/cláusulas digitados um a um) e virou **upload-only** — o único campo do modal é um arquivo, o resto é automático.

**Fluxo real:** `NovoTemplateDialog.tsx` (upload/drag-and-drop, sem outro campo) → `CriarTemplateViaUpload` (`src/actions/gerador-documentos.ts`) → valida arquivo no servidor (tipo/tamanho, nunca confia só no client) → `extractTextFromBuffer` (`src/lib/bibble/tika.ts`, já existia — Tika/pdf-parse/OCR PDF24, reaproveitado 100%) → upload do arquivo original pro Vercel Blob (`put()`, mesmo padrão de `contratos/upload/route.ts`) → `identificarVariaveisEClasulasViaIA` (nova, `src/lib/gerador-documentos/onyx.ts`) → IA (Onyx, persona 0) lê o texto, separa em cláusulas, identifica dados variáveis e já substitui por `{{placeholder}}` no texto, responde em JSON estrito → parseado via Zod (`IdentificacaoTemplateSchema`) → `persistirNovoTemplate()` (helper extraído, reaproveitado também por `CriarTemplateDocumento`, o fluxo manual antigo que continua existindo como fallback/uso avançado, mas sem UI própria mais — só a action ficou).

**2 colunas novas em `DocumentoTemplate`** (migration `20260829142500_add_documento_template_arquivo_origem`, 100% aditiva, nullable, sem default): `arquivoOrigemUrl String?`, `arquivoOrigemNome String?` — guardam o documento original enviado, vinculado ao template. Templates criados pelo fluxo manual antigo (`CriarTemplateDocumento`) ficam com esses campos `NULL`.

**Parser de JSON tolerante:** `extrairJson()` (`onyx.ts`, privada) lida com a IA respondendo JSON puro, cercado de crases markdown, ou com texto explicativo antes/depois — extrai o primeiro bloco `{...}` válido. Se não achar JSON reconhecível, ou o JSON não bater com `IdentificacaoTemplateSchema`, ou tiver nomes de variável duplicados: lança `OnyxError` **antes** de qualquer `db.$transaction` — nunca cria template parcial/quebrado.

**`TemplateDetalheClient.tsx` ganhou CRUD de variáveis** (antes só tinha CRUD de cláusulas, variáveis eram badges read-only). Usa `AtualizarTemplateDocumento({templateId, variaveis})` — já existia, sempre substitui o array `variaveisJson` inteiro (não é PATCH parcial). Mesmo padrão de campos (nome/label/tipo/obrigatório) do antigo formulário manual de criação, agora só reaproveitado aqui.

**Débitos técnicos registrados por Anubis (não bloqueantes, para iteração futura):** (1) `CriarTemplateViaUpload` não tem rate limit, ao contrário de `contratos/upload/route.ts` que tem 5/min — é a primeira action do módulo combinando upload + custo de IA numa chamada só; (2) `arquivo.name` do cliente não é sanitizado antes de compor a chave do Blob (`gerador-documentos/templates-origem/${userId}/${Date.now()}_${nome}`) — risco baixo (`addRandomSuffix: true` evita colisão), mas vale normalizar no futuro.

**Testes:** `tests/gerador-documentos/{schemas,onyx-identificacao,criar-template-via-upload}.test.ts` — 24 novos (65 total no módulo, 100% passando). Mock de `createChatSession`/`sendChatMessageStream` via `vi.mock("@/lib/onyx/client", ...)` com stream NDJSON sintético — primeiro precedente no projeto de teste automatizado mockando uma chamada de chat completa ao Onyx (reaproveitável para outros módulos que chamem IA da mesma forma).

**Achado de processo:** este objetivo foi implementado sem esperar o worker automático de documentação (`documentationStatus` ainda em `DOCUMENTING`, sem `RoadmapPromptArtifact` publicado — objetivo criado minutos antes da sessão). Sem `runId` de produção disponível, `RoadmapObjective.status` foi movido manualmente para `IN_DEVELOPMENT` (mesmo valor que `updateRoadmapProductionRunStatus`, `src/lib/roadmap-production-api/operations.ts:144-148`, grava quando um run real transiciona pra `IN_PROGRESS` — replicado aqui via UPDATE direto no Turso, já que não havia run pra transicionar de verdade).

**Última atualização:** 2026-08-29 por Scribe (sessão Bibble, upload de template com IA)

---

## Gerador de Documentos — templates, geração e conferência com reescrita por IA (RM-2026-999766, 2026-08-28)

Módulo novo (`category: 'infra'`, `grupo: 'estudioConteudo'`, id `geradorDocumentos` — já pré-registrado em `MODULOS_REGISTRY` desde 22/08, implementação real feita nesta sessão). Templates com variáveis dinâmicas `{{nome}}` e cláusulas separadas editáveis individualmente; geração sob demanda gera um `DocumentoGerado` + link de conferência; cada cláusula do documento gerado pode ser reescrita pontualmente via IA padrão do painel (Onyx), mediante instrução textual do usuário.

**⚠️ Achado que mudou o rumo da sessão:** o objetivo estava `ARCHIVED` no Roadmap. Não existe função de "desarquivar" no sistema (`retireRoadmapObjective` é operação terminal — todas as funções de `objectives.ts` rejeitam objetivo com `archivedAt != null`). Foi desarquivado manualmente (reset de `archivedAt`/`status`/`globalPriority`/nova `sourceVersion`, replicando a lógica de `retryRoadmapObjective`). O worker automático de documentação (Qwen/Ollama) tentou gerar o blueprint de fases e truncou 3x seguidas (`TRUNCATED_MODEL_RESPONSE`) — bug já conhecido (ver `known-errors.md`) para objetivos com descrição muito extensa, quase certamente a causa raiz do arquivamento original. Descoberto que já existia um blueprint completo anterior em `docs/stories/story-gerador-documentos-fase1-blueprint.md` (14/08, "Fase 1 — Scout", agente Nova) — reaproveitado e corrigido (ver decisão de link não-público abaixo) em vez de refeito do zero.

**4 models novos** (`prisma/schema.prisma`, migration `20260828171445_add_gerador_documentos`, 100% aditiva):
```prisma
model DocumentoTemplate { id, titulo, descricao?, categoria?, variaveisJson (Json), status @default("ATIVO"), criadoPorId → usuarios, clausulas[], documentos[] }
model DocumentoClasula { id, templateId → DocumentoTemplate, ordem, titulo, conteudo, tipo @default("TEXTO"), editavel @@unique([templateId, ordem]) }
model DocumentoGerado { id, templateId, titulo, variaveisJson, status @default("RASCUNHO"), tokenAcesso @unique, criadoPorId → usuarios, clausulas[] }
model DocumentoClasulaGerada { id, documentoId → DocumentoGerado, ordem, titulo, conteudo, conteudoOriginal, reescritoPorIA, instrucaoIA? @@unique([documentoId, ordem]) }
```

**Decisão de segurança confirmada com o usuário (diverge do blueprint original):** link de conferência (`/PainelAlpha/GeradorDocumentos/conferencia/[token]`) é **autenticado**, não público — `tokenAcesso` identifica o documento na URL mas NUNCA autoriza sozinho; toda leitura/escrita exige `auth()` + ownership (`exigirOwnershipDocumentoPorToken`/`exigirOwnershipDocumento`, dono ou admin). O blueprint de 14/08 recomendava token público sem login (mesmo padrão de `ConviteParceiro`); revisado porque o objetivo original do Roadmap exige explicitamente "não sendo um link público".

**Backend** (`src/lib/gerador-documentos/`): `ownership.ts` (`exigirAcessoModulo` — permissão `geradorDocumentos` via `getPermissoesEfetivas`/bypass admin; `exigirOwnershipTemplate`/`exigirOwnershipDocumento`/`exigirOwnershipDocumentoPorToken` — dono ou admin, nunca confia em ID isolado), `render.ts` (substituição de `{{variavel}}` por tipo — texto/número/moeda/data/booleano; parse manual de datas `YYYY-MM-DD` evita bug de off-by-one por fuso horário, achado real pelos testes), `onyx.ts` (`reescreverClasulaViaIA` — persona_id 0/Default AI, coleta interna do stream NDJSON, mesmo padrão de `extrato-agents.ts`, nunca streaming SSE direto ao cliente), `schemas.ts` (Zod completo: nomes de variável validados por regex, limite de 200 cláusulas/template, instrução de reescrita 3-2000 chars).

**Server Actions** (`src/actions/gerador-documentos.ts`): CRUD de template/cláusula, `GerarDocumento` (transação atômica: cria `DocumentoGerado` + todas as `DocumentoClasulaGerada` renderizadas), `ReescreverClasulaComIA` (contexto = todas as cláusulas do documento concatenadas + texto atual + instrução → Onyx → só a cláusula em questão é atualizada), `FinalizarDocumento`.

**Decisão de escopo confirmada com o usuário:** só uso interno (Server Action chamada diretamente entre módulos do mesmo processo Next.js, ou via a única rota HTTP `/api/gerador-documentos/gerar` que apenas delega para a Server Action). Nenhuma API key dedicada tipo `RoadmapApiKey`/`AlphaSeoApiKey` foi criada — adiado para se algum dia surgir necessidade real de chamada externa (fora do processo Next.js).

**Frontend** (`src/components/GeradorDocumentos/`): `GeradorDocumentosClient` (lista templates/documentos, tabs), `NovoTemplateDialog` (criação com editor de variáveis + cláusulas), `TemplateDetalheClient` (CRUD de cláusulas do template), `GerarDocumentoForm` (preenche variáveis, dispara geração), `ConferenciaClient` + `ReescreverIA` (edição por cláusula, botão "Reescrever com IA").

**Testes:** `tests/gerador-documentos/` — `render.test.ts` (14, inclui o fix de fuso horário), `schemas.test.ts` (14), `ownership.test.ts` (13, cobre IDOR e o caso do token não-público). 41/41 passando, zero regressão na suíte completa do projeto (1818 passando, as 30 falhas são os mesmos baselines pré-existentes de `tests/bpm/`, `tests/alpha-seo/`, `tests/apresentacoes/`, `tests/bibble/`, `tests/google-calendar/cli`).

**Qualidade:** `tsc --noEmit`/`eslint`/`npm run build` limpos (zero erro novo, só os 6 baselines de sempre). Verificação visual em navegador não foi possível — sem credenciais de usuário de teste disponíveis (mesma limitação honesta já documentada em outras entregas).

**Ambiente:** todo o trabalho (migration + dados) foi no banco `basetestes-alphacomex` (Turso), confirmado com o usuário como o ambiente correto — `banco-alpha-alphacomex` está comentado (`#`) em `.env`/`.env.local` e não é o ativo hoje.

## ChatBot Alpha — módulo de acesso administrativo à infraestrutura ChatbotX (2026-08-28)

Novo módulo (`category: 'admin'` em `MODULOS_REGISTRY`, id `chatBotAlpha`) — hub de atalhos para 3 ferramentas administrativas de um sistema **ChatbotX** self-hosted externo (projeto de referência consultado em `C:\Users\TI\Downloads\ChatbotX-main`, não implementado neste repositório, só consumido via URL): **Adminer** (cliente Postgres), **RedisInsight** (console Redis, env `REDIS_URL`/`REDIS_TOKEN`), **MailHog** (capturador de e-mail de teste, env `BASMAILOG_URL` — nome da env mantido apesar do nome real da ferramenta ser MailHog).

**Regra de negócio:** Admin/CEO/TI veem tela de escolha entre os 3; usuário comum (com a permissão `chatBotAlpha` concedida) vai direto para o MailHog, único sem token. `src/actions/ChatBotAlpha.ts` (`ObterUrlSistemaChatBot`) é o único ponto que monta URL com token, sempre sob demanda e só após guard de admin — nunca embute segredo em prop pré-carregada. Ver `integration-points.md` para o padrão geral de "iframe com token" que este módulo estabeleceu.

**Envs:** `ADMINER_URL`, `ADMINER_TOKEN`, `BASMAILOG_URL`, `REDIS_URL`, `REDIS_TOKEN` — todas em `.env.local` (não `.env` principal), confirmadas no `.gitignore`, nunca commitadas.

## Sidebar reestruturada em gavetas + Links Externos (2026-08-28)

**Agrupamento funcional (`src/lib/modulos-registry.ts`):** `GRUPOS_SIDEBAR` (10 grupos: gestaoTarefas, leadsMarketing, relacionamento, estudioConteudo, financeiroFiscal, pessoasRH, conhecimento, documentos, agendaEspacos, comunicacaoInterna) + campo `grupo?`/`hidden?` em `ModuloRegistryItem`. `GlobalSidebar.tsx` renderiza como accordion (fechado por padrão), reaproveitando `renderModuloItem()` para pinned/soltos/agrupados/collapsed. Fonte customizada `SF Pro Display Bold` (`next/font/local`, `public/fonts/sidebar/`) aplicada só aos labels da sidebar expandida.

**Links Externos (`model LinkExterno`, migration `20260828140000_add_link_externo`):** bloco "Sistema Externo" separado dos 10 grupos estáticos — dado dinâmico do banco, CRUD via modal (`ModalLinkExterno.tsx`) gerenciado por Admin/CEO/TI, visibilidade por `visivelPara` (role/CSV, distinto do sistema de `permission` de módulos). `src/actions/LinksExternos.ts` propagado via `layout.tsx` → `PainelLayoutClient.tsx` → `GlobalSidebar.tsx` (estado local espelhado/otimista, sem `router.refresh()`). Ver `integration-points.md` para o fluxo completo de "como adicionar um link".

## Roadmap Alpha — novo motor de produção: status manual via chat, sem agente autônomo no painel (2026-08-25)

O módulo Roadmap tem 2 fluxos independentes: **documentação** (`RoadmapAlpha.ts` + `roadmap-alpha/*`, gera Markdown via Qwen — não tocado nesta sessão) e **produção** (implementação de fato — reescrito do zero nesta sessão). O motor antigo (agent loop autônomo contra Ollama/Qwen + workers PowerShell externos, `src/lib/roadmap-production/*`) foi **removido por completo**. Agora quem implementa é Claude (via chat/Claude Code) ou Codex, reportando progresso por uma rota HTTP autenticada — o painel só reflete status, nunca executa código sozinho.

```prisma
model RoadmapProductionRun {
  id, objectiveId → RoadmapObjective, sourceVersion, phaseNumber, artifactId? → RoadmapPromptArtifact
  status String @default("PENDING") // PENDING|AWAITING_APPROVAL|IN_PROGRESS|NEEDS_INPUT|BLOCKED|SUCCEEDED|FAILED|CANCELLED
  assignee String @default("claude") // "claude"|"codex"|"manual"
  approvedById?, approvedAt?, startedAt?, finishedAt?, resultSummary?, errorCode?, changedFilesJson?
  createdById, createdAt, updatedAt
  @@unique([objectiveId, sourceVersion, phaseNumber])
}
model RoadmapProductionEvent {
  id, runId → RoadmapProductionRun, kind // STATUS_CHANGE|MESSAGE|QUESTION|ANSWER|NOTE
  fromStatus?, toStatus?, content?, authorKind // "user"|"assistant"|"system"
  authorLabel, authorUserId?, createdAt
}
model RoadmapApiKey {
  id, label, keyHash @unique, prefix, scopesJson, enabled
  createdById, expiresAt?, revokedAt?, rateLimitWindowMs, rateLimitMax, requestCount, lastRequestAt?, lastUsedAt?
}
```
`RoadmapObjective` ganhou `developmentAssignee String @default("claude")` (`ADD COLUMN` aditivo) — substitui a preferência antiga em JSON; domínio é só `"claude"|"codex"` (Qwen/Ollama não é mais opção, não há motor local).

**Camada de API** (`src/lib/roadmap-production-api/`): `auth.ts` reaproveita o padrão de `alpha-seo/mcp/auth.ts` (Bearer token com hash SHA-256, prefixo `roadmap_key_`, rate limit por compare-and-swap, ou sessão Next-Auth como fallback); `status-machine.ts` é a única fonte de verdade de transições válidas de status (usada tanto pela rota HTTP quanto pela Server Action da UI); `operations.ts` centraliza toda a lógica de negócio via Prisma. Rota `src/app/api/roadmap/production/*`: `GET queue`, `GET/POST runs/:id`, `POST runs/:id/status`, `GET/POST runs/:id/events`, `POST runs/:id/approve`, `POST objectives/:id/runs`.

**MCP local** (`mcp/roadmap-status/`) — processo Node standalone (fora de `src/`, roda via `claude mcp add` ou `.mcp.json`, NÃO dentro do processo Next.js), 9 tools (`roadmap_listar_fila`, `roadmap_marcar_fase_iniciada/concluida/falhou`, `roadmap_perguntar`, `roadmap_registrar_nota`, `roadmap_ver_historico`, `roadmap_criar_run`, `roadmap_ver_fase`), autenticado via `ROADMAP_MCP_TOKEN`/`ROADMAP_MCP_BASE_URL` (`.env` local, nunca commitado). Chama a rota HTTP acima — nunca conecta direto no Turso.

**Lição de migration no Turso remoto** (ver `known-errors.md`): `client.transaction("write")` em lote falha ao criar múltiplas tabelas com FK cruzada no mesmo batch não commitado — usar `client.execute()` sequencial, uma statement por vez, verificando cada uma.

## CRM de Canais e Parcerias — Fase 01: schema + migration (2026-08-25/26)

Fundação de dados para o novo CRM de Canais e Parcerias (fila `prompt-phases/` em execução,
ver `_status.md`). Reaproveita 100% o cadastro de `Parceiro`/`Indicacao` já existente — nenhuma
entidade duplicada.

**3 models novos** (`prisma/schema.prisma`):
```prisma
model ParceiroLead {
  id String @id @default(cuid())
  status String @default("NOVO_LEAD") // NOVO_LEAD|EM_PROSPECCAO|CONTATO_REALIZADO|EM_QUALIFICACAO|
    // REUNIAO_AGENDADA|REUNIAO_REALIZADA|NEGOCIACAO_FOLLOWUP|AGUARDANDO_CADASTRO|PRE_CADASTRO|
    // CADASTRADO|STANDBY|SEM_PERFIL|PERDIDO
  // ... nome/documento/email/telefone/segmento/origem/cidade/uf, responsavelId, potencialRecorrencia,
  // proximaAcaoEm/proximaAcaoDescricao, motivoSaidaLateral, promovidoParceiroId/promovidoEm/promovidoPorUserId
  historico ParceiroLeadHistorico[]
}
model ParceiroLeadHistorico { id, leadId → ParceiroLead, acao, valorAnteriorJson?, valorNovoJson?, usuarioId?, automacaoOrigem?, createdAt }
model ParceiroHistorico { id, parceiroId → Parceiro, acao, valorAnteriorJson?, valorNovoJson?, usuarioId?, automacaoOrigem?, createdAt }
```
`ParceiroLead` é staging tipo "card virtual" — mesmo padrão já em produção da `NolossLead`
(ver seção logo abaixo nesta memória). **Nunca vira `BpmCard`** — decisão de arquitetura
confirmada com o usuário: `BpmCard.empresaId` é obrigatório e aponta para `Cliente`, entidade que
não serve para "potencial parceiro" antes do cadastro. A promoção para `Parceiro` real usa
`criarParceiro()` já existente (`src/actions/parceiros.ts`), preservando idempotência.

**`Parceiro` ganhou 8 colunas** (ciclo de vida de Desenvolvimento pós-cadastro, sem Kanban de
card por parceiro — decisão do usuário): `estagioDesenvolvimento String @default("NOVO")`
(NOVO|EM_ATIVACAO|ATIVADO_SEM_INDICACAO|PRIMEIRA_INDICACAO|ATIVO|RECORRENTE|INATIVO),
`estagioDesenvolvimentoAtualizadoEm`, `potencialRecorrencia Int?` (0-5, score MANUAL, distinto de
`nivel` — calculado por contratação — e de `comissaoPercentual` — regra financeira; nunca
misturar os três), `potencialRecorrenciaAtualizadoEm/AtualizadoPorId`, `segmento`, `origem`,
`responsavelId` (relacionamento comercial, distinto de `criadoPorId` que é só "quem cadastrou").

**`ParceiroConfig` ganhou 4 colunas** de regras configuráveis (nunca hardcoded):
`diasAlertaSemIndicacao Int?` (null = desligado), `diasInatividade Int @default(60)`,
`cadenciaPotencial4Dias`/`cadenciaPotencial5Dias`. **`diasInatividade` é uma regra de
RELACIONAMENTO, distinta e independente da janela de 60 dias de `recalcularNivel()`** (regra
FINANCEIRA de rebaixamento de nível por contratação) — nunca reaproveitar uma pela outra.

**Migration estrutural real, aplicada em produção via Vault:** `Indicacao.clienteId` deixou de
ser `@unique` — uma empresa pode ser indicada mais de uma vez ao longo do tempo (antes: 1
indicação por empresa para sempre). `Cliente.indicacao Indicacao?` virou
`Cliente.indicacoes Indicacao[]`. A regra de negócio preservada é "só 1 indicação **ATIVA** por
empresa por vez" (não uma liberação irrestrita) — enforçada em `criarIndicacao()`
(`src/actions/parceiros.ts`), que agora sempre cria um registro novo em vez de reescrever um
antigo `DESVINCULADA` (histórico completo preservado). **Achado que reduziu o risco da
migration:** a constraint `@unique` não era inline na tabela — era um índice único SEPARADO
(`indicacoes_clienteId_key_v2`), e já existia um índice não-único redundante na mesma coluna. A
migration real foi só `DROP INDEX`, não a recriação de tabela originalmente prevista (SQLite não
suporta `ALTER COLUMN`/`DROP CONSTRAINT` inline, mas neste caso específico não havia constraint
inline a remover).

**6 pontos de código ajustados** para a nova cardinalidade (grep completo, todos os
consumidores confirmados): `src/actions/parceiros.ts` (`criarParceiro` indicação retroativa,
`criarIndicacao`, `listarClientesParaIndicacao`), `src/actions/ContratoComercial.ts`
(`confirmarFechamento`), `src/actions/Clientes.ts` (`SELECT_CLIENTE_CS_NPS`/`buscarClientes` —
filtra por `status: "ATIVA"` e converte array→singular no retorno para não quebrar consumidores
como `modalDados.tsx`), `src/lib/cs-nps/exportar-dados.ts` (export Excel, dedup agora por
`Indicacao.id` em vez de `Cliente.id`). `ModalNovaIndicacao.tsx` não precisou de nenhuma mudança
— contrato externo preservado propositalmente.

**Backup pré-migration:** `database-backups/pre-change/painelalpha_turso_pre_change_canais-parcerias-fase01_2026-08-25T19-49-57-015Z.sql`
(243 tabelas, 42.129 linhas, 81,2 MB, SHA-256 `c9e862a3...9d3ce2c`).

**Qualidade:** `tsc --noEmit`/`eslint`/`npm run build` limpos (zero erro novo — só os 6 baselines
pré-existentes de sempre, em módulos não relacionados). `tests/parceiros/`+`tests/cs-nps/`:
55/55 passando (1 teste ajustado para a nova shape de query, `responsavel.test.ts`).
`tests/bpm/`: confirmado 287/315 pré-existente também no baseline limpo (zero regressão
introduzida) — ver `known-errors.md` para o detalhe completo dos 28 testes órfãos já quebrados
antes desta fase.

## CRM de Canais e Parcerias — Fase 02: Aquisição de Parceiros (2026-08-26)

Funil "potencial parceiro → cadastrado" implementado como staging tipo "card virtual"
(`ParceiroLead`, schema da Fase 01) — **nunca cria `BpmCard`**.

**Backend:** `src/actions/parceiros-aquisicao.ts` — `CriarLeadAquisicaoParceiro`,
`MoverLeadAquisicaoParceiro`, `RegistrarSaidaLateralLeadAquisicao`,
`AtualizarPotencialLeadAquisicao`, `RegistrarProximaAcaoLeadAquisicao`,
`ListarLeadsAquisicaoParceiros`, `ListarResponsaveisParceiros`, `PromoverLeadParaParceiro`.
Reaproveita `getCtx`/`criarParceiro` de `src/actions/parceiros.ts` (ambos exportados nesta fase
especificamente para esse reuso — antes eram privados do módulo).

**Máquina de transição** (`podeMoverPara()`, função pura testável): 9 etapas ativas fixas em
ordem (`NOVO_LEAD`→...→`PRE_CADASTRO`), avanço de 1 posição ou correção para qualquer etapa
anterior; saída lateral (`STANDBY`/`SEM_PERFIL`/`PERDIDO`) permitida de qualquer etapa ativa com
`motivoSaidaLateral` obrigatório; reingresso de uma saída lateral para qualquer etapa ativa;
`CADASTRADO` é destino proibido em `MoverLeadAquisicaoParceiro` — só alcançável via
`PromoverLeadParaParceiro`.

**Promoção idempotente** (`PromoverLeadParaParceiro`): CAS via `updateMany({where:{id,status:statusAntes}})`
antes de qualquer efeito colateral (mesmo padrão do card virtual `NolossLead`) — reivindica o
lead comparando o status lido, não um valor fixo. Se `documento`/`email` ausentes ou já existe
`Parceiro` com o mesmo documento, reverte o lead para `statusAntes` (a etapa real onde estava,
não um valor hardcoded) e retorna erro amigável. Sucesso propaga `potencialRecorrencia` (se já
qualificado no lead) + `segmento`/`origem`/`responsavelId` para o `Parceiro` recém-criado — nunca
se perde na promoção. Grava `ParceiroLeadHistorico` e `ParceiroHistorico` na mesma transação.

**Frontend:** `/PainelAlpha/Parceiros/Aquisicao` (`page.tsx` fino + `AquisicaoParceirosClient.tsx`)
— Kanban de 12 colunas (9 etapas + 3 saídas laterais) com scroll horizontal, sem drag-and-drop
nesta primeira entrega (movimentação via dialog de detalhe do lead — potencial de polish visual
futuro se o usuário pedir paridade com o dnd-kit do Alpha CRM). Acesso via botão "Aquisição" no
header de `ParceirosClient.tsx` (`src/components/Parceiros/ParceirosClient.tsx`) — **sem** nova
entrada em `MODULOS_REGISTRY` (é sub-rota do módulo `parceiros` já registrado, mesma permissão).

**Testes:** `tests/parceiros/aquisicao.test.ts` (16 casos — máquina de transição, saída lateral,
range de potencial, idempotência de promoção, prevenção de duplicidade, propagação de potencial).

**Qualidade:** `tsc`/`eslint`/`npm run build` limpos (mesmos 5-6 baselines pré-existentes, zero
erro novo). `tests/parceiros/`+`tests/cs-nps/` 55/55 + `aquisicao.test.ts` 16/16.

---

## CRM de Canais e Parcerias — Fase 03: Desenvolvimento do Parceiro (2026-08-26)

Ciclo de vida pós-cadastro como campos/estados diretamente em `Parceiro` (schema já criado na
Fase 01) — sem Kanban de card por parceiro, conforme decisão de arquitetura do usuário.

**Lógica central:** `src/lib/parceiros/desenvolvimento.ts` — `transicionarEstagioDesenvolvimento()`
(idempotente, sempre grava `ParceiroHistorico`), `sincronizarEstagioAposIndicacao()` (1ª indicação
→ `PRIMEIRA_INDICACAO`, 2ª em diante → `ATIVO` — **decisão de produto documentada no código**, o
pedido original não especificava o gatilho exato; nunca toca `ATIVO`/`RECORRENTE` já atingidos,
evitando rebaixar automação em cima de ajuste manual), `executarJobDesenvolvimentoParceiros()`
(2 varreduras: onboarding concluído→`ATIVADO_SEM_INDICACAO`; inatividade→`INATIVO`, usando
`ParceiroConfig.diasInatividade` configurável, NUNCA a janela de 60 dias de `recalcularNivel()`
— regra financeira distinta), `calcularIndicadoresParceiro()` (1ª/última indicação, dias sem
indicação, contagens, conversão, receita — **tudo derivado de `Indicacao`/`ClienteServico`/
`BpmCard` reais, nunca um contador solto**).

**⚠️ Achado arquitetural importante:** `Parceiro.onboardingCompleto` é escrito pelo portal
EXTERNO `PainelAlphaParceiros` (`C:\Users\TI\Desktop\PainelAlphaParceiros\alphaparceiros`),
processo/deploy separado que só compartilha o mesmo banco Turso — não existe hook in-process
possível quando esse campo muda. Por isso a transição "onboarding concluído → Ativado sem
Indicação" é um job de **reconciliação periódica** (cron diário), não um trigger síncrono.

**Automação síncrona real:** `criarIndicacao()` (`src/actions/parceiros.ts`) chama
`sincronizarEstagioAposIndicacao()` via dynamic `import()` (mesmo padrão anti-ciclo já usado por
`ContratoComercial.ts`→`recalcularNivel`) logo após criar a `Indicacao` — não transacional com o
`create` (mesmo padrão non-atômico já existente para `recalcularNivel` nessa mesma função, best
effort documentado, não uma regressão nova).

**Cron novo:** `src/app/api/parceiros/jobs/desenvolvimento/route.ts` (mesmo padrão de
autorização/lock de `automacao-novos-leads`, via `autorizarCron`/`CRON_SECRET`) — registrado em
`vercel.json` (`0 13 * * *`, diário). **Mudança de configuração compartilhada de produção —
usuário avisado explicitamente no momento da adição.**

**Circular import evitado propositalmente:** `desenvolvimento.ts` lê `ParceiroConfig` direto via
`db.parceiroConfig.upsert()` em vez de importar `obterConfigParceiros()` de
`convites-parceiro.ts` — essa função já importa `criarParceiro` de `parceiros.ts`, que agora
importa `desenvolvimento.ts`; importar de volta criaria um ciclo de 3 módulos.
`obterConfigParceiros()` (`convites-parceiro.ts`) teve seu `select` ampliado com os 4 campos
novos de config (mudança aditiva, únicos consumidores eram internos + `ModalEngrenagem.tsx`).

**Server Actions:** `src/actions/parceiros-desenvolvimento.ts` —
`AtualizarPotencialRecorrenciaParceiro` (0-5, isolado de `comissaoPercentual`),
`ReativarParceiro` (só a partir de `INATIVO`; decide o destino real a partir do histórico —
`ATIVO` se já indicou, `ATIVADO_SEM_INDICACAO` se onboarding completo sem indicação,
`EM_ATIVACAO` caso contrário — nunca reativa "no escuro"), `ObterIndicadoresDesenvolvimentoParceiro`.

**Testes:** `tests/parceiros/desenvolvimento.test.ts` (12 casos, lógica central) +
`tests/parceiros/desenvolvimento-actions.test.ts` (7 casos, Server Actions/permissão/reativação).

**Qualidade:** `tsc`/`eslint`/`npm run build` limpos (mesmos baselines pré-existentes). 19 testes
novos, nenhum existente quebrado.

**Pendência consciente:** UI para exibir os indicadores/potencial/estágio no card e na tela do
parceiro fica para a Fase 07 (tela 360º) — Fase 03 entregou só o motor de dados/automação.

---

## CRM de Canais e Parcerias — Fase 04: Indicações vinculadas ao BPM (2026-08-26)

**Decisão de arquitetura confirmada por investigação real do banco (não suposição):** o pipeline
comercial **"Revisão de Radar"** já tem exatamente as etapas do fluxo de indicação pedido —
`Novos leads(0) → Agendar reunião(1) → Reunião Agendada(2) → Em tratativa(3) → Fechado(4)` +
saídas laterais `Lost(5)`/`Sem viabilidade(6)`/`Standby - Follow Up(7)` → `Monitoramento(8)`. É o
MESMO pipeline que a feature NoLoss Leads já usa como entrada. Reaproveitado 100% —
**nenhum pipeline "Indicações de Parceiros" paralelo foi criado.**

**Migration aplicada (Vault, backup dedicado + confirmação explícita do usuário):**
`Indicacao.bpmCardId String? @unique` (FK→`BpmCard`, `ON DELETE SET NULL`) +
`BpmCard.indicacaoOrigem Indicacao?` (relação inversa, **sem nenhuma coluna nova em `BpmCard`**
— só o campo FK vive em `Indicacao`). Backup:
`database-backups/pre-change/painelalpha_turso_pre_change_canais-parcerias-fase04_2026-08-25T20-43-03-577Z.sql`
(249 tabelas, 42.137 linhas, 77,48 MB). Estado real pré-migration: 21 `indicacoes`, 5 `BpmCard`.

**Server Actions:** `src/actions/parceiros-indicacoes.ts`:
- `DirecionarIndicacaoParaCloser(indicacaoId, responsavelId)` — a transição real "Indicação
  Registrada → Direcionada ao Closer": resolve dinamicamente o pipeline por `nome: "Revisão de
  Radar"` + a etapa `ordem: 0` (nunca hardcoded IDs, que variam por ambiente), reaproveita
  `CriarCardBpm()` já existente (`src/actions/bpm/Cards.ts` — inclusive respeitando a mesma
  validação `destinoEhEtapaCanonicaNovosLeads`), e só então vincula `Indicacao.bpmCardId`. A
  constraint `@unique` em `bpmCardId` funciona como CAS implícito contra vínculo duplo
  concorrente. Rejeita se a indicação já tiver `bpmCardId` (idempotência).
- `ListarIndicacoesDoParceiro(parceiroId)` — consolida cada `Indicacao` do parceiro com o status
  da oportunidade (`BpmCard`, quando já direcionada) e o serviço/contrato mais recente da empresa
  indicada (via `ClienteServico`) — para a tela 360º (Fase 07).

`RegistrarIndicacaoParceiro` **não foi criado como Action nova** — `criarIndicacao()`
(`src/actions/parceiros.ts`, já existente e ajustado na Fase 01) já cobre esse papel; criar uma
segunda Action redundante violaria o princípio de não duplicar.

`ObterFunilIndicacoesParceiro` (agregado GLOBAL do funil de indicações) foi **deliberadamente
adiado para a Fase 05** (Dashboard) — é escopo de dashboard, não de gestão individual de
indicação; `calcularIndicadoresParceiro()` (Fase 03) já cobre os indicadores POR parceiro.

**Testes:** `tests/parceiros/indicacoes-bpm.test.ts` (8 casos — direcionamento feliz/erro/
idempotência/pipeline ausente, consolidação de indicação com/sem oportunidade vinculada).

**Qualidade:** `tsc` (log completo lido, não só grep) e `eslint` limpos nos arquivos desta fase
(mesmos baselines pré-existentes de sempre). `npm run build` **não pôde ser confirmado limpo
nesta janela** — um processo autônomo concorrente (Roadmap Production) estava ativamente
reescrevendo `RoadmapProduction.ts`/`roadmap-alpha/*` no mesmo working directory durante a
tentativa (2 builds seguidos falharam com erros DIFERENTES, ambos 100% confinados a arquivos de
Roadmap — nunca em Parceiros/Indicações). Ver `known-errors.md` para a investigação completa
(git status + timestamps de arquivo + processos ativos confirmam a causa). Suíte completa
`tests/parceiros/`+`tests/cs-nps/`: 98/98.

---

## CRM de Canais e Parcerias — Fase 05: Dashboard + Fila de Follow-up + Alertas (2026-08-26)

**Prioridade de follow-up — algoritmo simples e explicável (pedido original, literal):**
`src/lib/parceiros/prioridade.ts` — `calcularPrioridadeFollowUp()`, pesos NOMEADOS em
`PESOS_PRIORIDADE` (potencial×10, follow-up vencido +40, sem próxima ação +25, dias sem
indicação ×0.3 com teto de 30 pontos, estágio ATIVO/RECORRENTE +15). Função pura, testável,
documentada — não é ML nem score obscuro.

**Server Actions:** `src/actions/parceiros-dashboard.ts`:
- `ObterDashboardCanaisParcerias(periodoDias)` — todo indicador com origem de dado clara:
  contagens diretas (`Parceiro`/`ParceiroLead`/`Indicacao`) + `calcularIndicadoresParceiro()`
  (Fase 03) para "sem indicação acima do prazo" (só roda se `diasAlertaSemIndicacao` configurado
  — nunca calcula à toa). Evolução de 6 meses (aquisição/ativação/recorrência) via buckets
  mensais de `ParceiroLead.createdAt` e `ParceiroHistorico` (filtro por conteúdo JSON de
  `valorNovoJson`, sem coluna nova).
- `ListarFilaFollowUpParceiros(filtros)` — exclui parceiros `INATIVO` (vão para alerta separado,
  não competem na fila comercial ativa), ordenada por prioridade decrescente.
- `ListarAlertasParceiros()` — `PARCEIRO_INATIVO`, `SEM_INDICACAO` (só se config ligada),
  `CADASTRO_PENDENTE` (reaproveita `PreCadastroParceiro` já existente). `SEM_PROXIMA_ACAO`/
  `FOLLOWUP_VENCIDO` como tipos existem no contrato mas ainda não são emitidos nesta fase — ver
  pendência abaixo.

**`AtualizarRegrasParceiros`** (`src/actions/convites-parceiro.ts`, ao lado de
`obterConfigParceiros`/`togglePermitirParceiroConvidar` já existentes — mesmo arquivo, mesmo
padrão, Admin only) — atualiza `diasAlertaSemIndicacao`/`diasInatividade`/
`cadenciaPotencial4Dias`/`cadenciaPotencial5Dias`.

**Frontend:**
- `/PainelAlpha/Parceiros/Dashboard` (`DashboardParceirosClient.tsx`) — 3 abas (Visão Geral/Fila/
  Alertas), stat cards, séries de evolução em barras simples (CSS puro, sem lib de gráfico — não
  havia padrão de dashboard com Recharts reaproveitável no projeto para clonar).
- `/PainelAlpha/Parceiros/Configuracoes` (Admin only) — formulário das 4 regras configuráveis.
- Links novos no header de `ParceirosClient.tsx` ("Dashboard" visível, "Regras de Canais e
  Parcerias" dentro do menu "Ações", Admin only).

**⚠️ Pendência consciente (não é bug, é escopo real ainda não coberto):** `Parceiro` não tem
campo próprio de "próxima ação" (esse conceito existe hoje só em `ParceiroLead`, Fase 02, para
Aquisição). A Fila de Follow-up e os alertas `SEM_PROXIMA_ACAO`/`FOLLOWUP_VENCIDO` já têm a
lógica pronta (`followUpEstaVencido()`) mas operam com `proximaAcaoEm: null` fixo para todo
parceiro em Desenvolvimento até a Fase 07 (tela 360º) decidir onde essa UI de registro vive —
documentado explicitamente no código (`ListarFilaFollowUpParceiros`), não é uma omissão
silenciosa.

**Testes:** `tests/parceiros/prioridade.test.ts` (9 casos) +
`tests/parceiros/dashboard-followup-alertas.test.ts` (7 casos).

**Qualidade:** `tsc`/`eslint`/`npm run build` limpos (mesmos baselines de sempre — a intermitência
do build por causa do Roadmap Production concorrente, documentada em `known-errors.md` na Fase
04, já tinha se resolvido nesta fase). Suíte completa `tests/parceiros/`+`tests/cs-nps/`: 114/114.

---

## CRM de Canais e Parcerias — Fase 06: Permissões + Automações centralizadas (2026-08-26)

Fase majoritariamente de **auditoria** sobre o que as Fases 02-05 já construíram, não de código
novo — confirma que nada foi implementado fora do padrão.

**RBAC — matriz confirmada (nenhum novo toggle em `ParceiroAcesso` foi necessário):**

| Ação | Guarda real usada | Observação |
|---|---|---|
| Visualizar (dashboard, fila, indicadores) | `getCtx()` não-nulo (sessão válida) | leitura, sem exigir `podeEditar` |
| Cadastrar lead, mover etapa, saída lateral, potencial, próxima ação, promover (Aquisição) | `isAdmin \|\| podeEditar` | `parceiros-aquisicao.ts` |
| Potencial/reativação (Desenvolvimento) | `isAdmin \|\| podeEditar` | `parceiros-desenvolvimento.ts` |
| Direcionar indicação ao closer | `isAdmin \|\| podeEditar` **+** acesso ao pipeline BPM (`exigirAcessoBpmPipeline`, dentro de `CriarCardBpm`) | dupla checagem entre módulos, intencional |
| **Alterar configurações** (`AtualizarRegrasParceiros`) | **Somente `isAdmin`** — `podeEditar` sozinho NÃO basta | testado explicitamente (`regras-admin-e-isolamento.test.ts`) |

Decisão explícita: `ParceiroAcesso` continua com seus 3 booleans originais
(`podeEditar`/`podeExcluir`/`podeAprovar`). Nenhuma ação nova das Fases 02-05 precisou de
granularidade que esses 3 não cobrissem — "atribuir responsável" e "registrar atividade" foram
avaliados e caem dentro de `podeEditar` (mesmo nível de acesso que editar dados cadastrais),
consistente com o padrão já usado no BPM (`AtualizarMembrosCardBpm` permite responsável/admin do
card/Admin global, sem toggle próprio). Expandir o RBAC além disso seria over-engineering não
pedido.

**Auditoria de centralização de automações — confirmada, zero duplicação:**
- Cálculo de "dias sem indicação"/indicadores: ÚNICA fonte é `calcularIndicadoresParceiro()`
  (`src/lib/parceiros/desenvolvimento.ts`), consumida por `ObterIndicadoresDesenvolvimentoParceiro`
  (Fase 03), `ObterDashboardCanaisParcerias`, `ListarFilaFollowUpParceiros`, `ListarAlertasParceiros`
  (Fase 05) — nenhuma reimplementação encontrada (confirmado por grep).
- Transição de estágio: ÚNICA fonte é `transicionarEstagioDesenvolvimento()` — usada por
  `sincronizarEstagioAposIndicacao`, `executarJobDesenvolvimentoParceiros`, `ReativarParceiro`.
- Prioridade de follow-up: ÚNICA fonte é `calcularPrioridadeFollowUp()` — usada só por
  `ListarFilaFollowUpParceiros`.

**Auditoria de isolamento Comissão × Relacionamento — confirmada por grep + teste:**
`comissaoPercentual` (`Parceiro`) tem ZERO referências em `src/lib/parceiros/*` ou
`parceiros-dashboard.ts` (grep confirmado). `ParceiroConfig.diasInatividade` (relacionamento) é
campo fisicamente distinto de qualquer prazo de comissão — não existe hoje nenhum "prazo de
comissão" configurável no sistema para colidir. Teste explícito garante que
`AtualizarPotencialRecorrenciaParceiro` nunca grava `comissaoPercentual` no mesmo update.

**Testes:** `tests/parceiros/regras-admin-e-isolamento.test.ts` (4 casos — Admin vs editor comum
para configurações, e isolamento de comissão).

**Qualidade:** suíte completa `tests/parceiros/`+`tests/cs-nps/`: 118/118.

---

## CRM de Canais e Parcerias — Fase 07: Tela 360º + Filtros consolidados (2026-08-26)

**Não criou tela nova** — expandiu `/PainelAlpha/Parceiros/[id]/page.tsx` +
`DetalheParceiroClient.tsx` (822 linhas pré-existentes) já existentes, conforme requisito
explícito do pedido. Risco minimizado deliberadamente: nenhuma linha do formulário de
edição/comissão/comprovante/responsáveis já existente foi tocada — a expansão é 100% aditiva
(1 prop nova opcional `relacionamento360`, 1 novo componente renderizado, 1 novo bloco de dados
buscado em paralelo no `page.tsx`).

**Novo componente:** `src/components/Parceiros/Relacionamento360Section.tsx` — 3 blocos:
1. **Relacionamento** — badge de estágio (cores por estágio), responsável/segmento/origem,
   potencial de recorrência editável (5 estrelas clicáveis, só `podeEditar`), grid de indicadores
   (Fase 03: indicações/oportunidades/contratos/conversão/receita/dias sem indicação).
2. **Acompanhamento Comercial das Indicações** — lista cada `Indicacao` com status da oportunidade
   BPM (pipeline/etapa, quando já `DirecionarIndicacaoParaCloser` — Fase 04) e do contrato.
   Deliberadamente **rotulado diferente** da seção "Indicações" pré-existente (que foca em
   comissão/comprovante) — mesma indicação vista por 2 facetas distintas (financeira vs.
   comercial), não duplicação de informação.
3. **Histórico de Relacionamento** — timeline de `ParceiroHistorico` (nova Server Action
   `ListarHistoricoParceiro`, `src/actions/parceiros-desenvolvimento.ts`).

**Filtros consolidados:** `listarParceiros()` (`src/actions/parceiros.ts`) ganhou 3º parâmetro
opcional `filtrosExtra` (`estagioDesenvolvimento`/`potencialMin`/`segmento`/`origem`/
`responsavelId`) — aditivo, retrocompatível, nenhum call site existente mudou. As listagens
operacionais mais usadas (Aquisição, Fila de Follow-up) já tinham filtros próprios desde as
Fases 02/05.

**⚠️ Pendência consciente:** um painel de filtro VISUAL na listagem principal
(`ParceirosClient.tsx`) usando `filtrosExtra` não foi construído nesta fase — a capacidade
server-side existe e está testada, mas a UI de filtro ainda não a expõe. Funcionalmente coberto
hoje pelas telas de Aquisição/Fila de Follow-up, que já têm filtro visual completo.

**Testes:** `tests/parceiros/listar-filtros.test.ts` (2 casos — retrocompatibilidade + filtros
novos aplicados corretamente ao `where`).

**Qualidade:** `tsc`/`eslint`/`npm run build` limpos. Suíte completa
`tests/parceiros/`+`tests/cs-nps/`: 120/120.

---

## CRM de Canais e Parcerias — Fase 08: Testes + Regressão final (2026-08-26) — FILA CONCLUÍDA

**Gap de cobertura fechado:** `tests/parceiros/indicacao-multipla.test.ts` (4 casos) — a única
lacuna real do checklist consolidado era um teste DIRETO de `criarIndicacao()` confirmando que a
migration da Fase 01 (remoção do `@unique`) realmente permite múltiplas indicações históricas
para a mesma empresa, preservando a regra "só 1 ATIVA por vez".

**Regressão total confirmada — suíte COMPLETA do projeto (`npx vitest run`, sem filtro):**
**1718 passando / 1751 totais** (242 arquivos). Os 33 falhando: os mesmos 28 pré-existentes de
`tests/bpm/` (documentados na Fase 01) **+ 5 falhas pré-existentes não relacionadas** em
`tests/alpha-seo/` (2), `tests/apresentacoes/` (1), `tests/bibble/` (1),
`tests/google-calendar/cli.test.ts` (1) — nenhuma ligada a Parceiros/Canais, nenhum desses
arquivos tocado nesta fila. **`tests/parceiros/`+`tests/cs-nps/`: 124/124 (100%).**

**Verificação final consolidada:**
- `npx tsc --noEmit` (projeto inteiro): limpo — só os 5 baselines de sempre
  (`ReceitaFederal`/`ExclusaoFiscal`/`HabilitacaoRadarClient`/`google-calendar sync-queue`).
- `npm run build`: exit 0, limpo.
- `npm run lint` (projeto inteiro): **16.306 problemas pré-existentes** (10.817 erros/5.489
  avisos) espalhados pelo projeto — confirmado por grep que **zero** pertence a qualquer arquivo
  tocado nesta fila. Débito de lint massivo e anterior a esta sessão (consistente com
  `next.config.ts` já ter `typescript.ignoreBuildErrors: true`) — fora de escopo corrigir aqui.

**Requisito crítico do pedido original — confirmado:** "o CRM/BPM existente não pode parar de
funcionar" — baseline de `tests/bpm/` preservado em 287/315 do início ao fim das 8 fases, mesma
contagem exata antes e depois de toda a migration/schema/automações novas.

---

## CRM de Canais e Parcerias — RESUMO EXECUTIVO DA ENTREGA (8 fases, 2026-08-25/26)

| Fase | Entrega |
|---|---|
| 01 | Schema (3 tabelas novas + 8/4 colunas em Parceiro/ParceiroConfig) + migration `Indicacao.clienteId` sem `@unique` (Vault, backup 81MB, zero perda de dado) |
| 02 | Aquisição de Parceiros — staging `ParceiroLead` (padrão card-virtual), Kanban de 12 colunas, promoção idempotente a `Parceiro` real |
| 03 | Desenvolvimento do Parceiro — ciclo de vida automático, potencial 0-5, indicadores derivados, job de inatividade (cron novo) |
| 04 | Indicações vinculadas ao BPM — reaproveita pipeline "Revisão de Radar" existente, migration `bpmCardId` (Vault) |
| 05 | Dashboard + Fila de Follow-up + Alertas configuráveis + tela de Configurações |
| 06 | Auditoria de RBAC + centralização de automações + isolamento comissão/relacionamento (zero código novo relevante, só validação) |
| 07 | Tela 360º — expandiu `/Parceiros/[id]` existente (não criou tela nova) + filtros consolidados aditivos |
| 08 | Fechamento: gap de teste coberto, regressão total do projeto confirmada, gates finais |

**Achado operacional relevante:** durante as Fases 04-05, um processo autônomo concorrente do
próprio projeto (Roadmap Production) esteve ativamente reescrevendo `RoadmapProduction.ts`/
`roadmap-alpha/*` no mesmo working directory, causando falhas de build transitórias e não
relacionadas — investigado, confirmado e documentado em `known-errors.md` para não confundir
sessões futuras.

**Números finais:** ~20 arquivos novos, ~10 arquivos existentes estendidos (nunca reescritos),
2 migrations reais em produção via Vault (backup+confirmação em ambas), 1 cron novo,
**69 testes novos em 9 arquivos novos** (todos passando —
`aquisicao.test.ts`16 + `desenvolvimento.test.ts`12 + `desenvolvimento-actions.test.ts`7 +
`indicacoes-bpm.test.ts`8 + `prioridade.test.ts`9 + `dashboard-followup-alertas.test.ts`7 +
`regras-admin-e-isolamento.test.ts`4 + `listar-filtros.test.ts`2 + `indicacao-multipla.test.ts`4),
zero regressão no CRM/BPM existente, zero entidade duplicada.

---

## Padrão: "card virtual" em Kanban BPM — staging antes de materializar registro real (2026-08-24)

Padrão introduzido pela feature NoLoss leads (ver `integration-points.md` para o caso concreto), reaproveitável para qualquer fluxo futuro de "dado externo chega antes de virar entidade real do sistema":

1. **Tabela de staging separada** (não a entidade final) com `status` (`pending`/`promoted`/`dismissed` ou equivalente) e colunas `promoted*` opcionais apontando para o que foi criado quando promovido.
2. **Ingestão** (webhook/import/etc.) só grava na tabela de staging — nunca cria a entidade real (`Cliente`/`BpmCard` no caso do NoLoss) no momento da ingestão.
3. **Leitura da UI faz merge**: a Server Action que lista os itens reais (`ListarCardsPipelineBpm`) busca também os itens de staging pendentes e os concatena no **mesmo formato de objeto** da entidade real, com um campo discriminador (`origem: "real"|"virtual"`) e um ID de referência ao staging (`nolossLeadId`). Campos que a entidade real tem mas o staging não tem recebem valores neutros sensatos (arrays vazios, contadores zero, objetos-sentinela com `id:0`).
4. **Sentinela `id:0` é seguro SOMENTE se a UI nunca deixar o item de staging acionar um fluxo que dependa do ID ser real** (abrir modal de detalhe, navegar para página de detalhe etc.) — essa garantia vive do lado do componente, não do dado. Todo consumidor futuro do mesmo tipo de objeto precisa checar o campo `origem` antes de usar esses IDs para lookup.
5. **Promoção** é uma ação explícita do usuário (nunca automática) que roda em transação: valida os dados de destino (etapa/categoria/etc. pertence ao escopo esperado — nunca confia em ID cru do client), usa **CAS** (`updateMany({where:{status:"pending"}})`) para blindar contra dois usuários promovendo o mesmo item ao mesmo tempo, cria a entidade real, e atualiza o staging para `promoted` com referência ao que foi criado.

## ⚠️ Bibble (assistente) roda 100% via Ollama local — não Anthropic/OpenAI (confirmado 2026-08-24)

O CLAUDE.md raiz descreve Anthropic como "futuro padrão para AI" para o Bibble, mas **o código real sempre usou Ollama** como provider padrão (`src/lib/bibble/client.ts`, `BIBBLE_MODEL`, hoje `qwen3.8:latest`), servido por um Ollama remoto em `192.168.35.113` com GPU dedicada e VRAM alta (confirmado pelo usuário). Anthropic/OpenAI/Google existem no código (`PROVIDER_MODELS`, `getProviderConfig`) como providers alternativos que o usuário pode selecionar manualmente no chat, nunca como padrão ativo. **Qualquer sessão futura que for ajustar limites de token/contexto/custo do Bibble deve tratar o Ollama local como o path real e testado** — ver detalhe completo da correção de tetos de contexto/output em `integration-points.md` ("Bibble — hardening do pipeline de anexos/PDF", 2026-08-24).

---

## ⚠️ Acoplamento crítico: Parceiros ↔ Metas ↔ CS&NPS via `clientes`

`clientes` (módulo CS&NPS) é o **hub central** referenciado por FK de múltiplos módulos que, à primeira vista, parecem independentes:

| Módulo | Tabela | Coluna FK → `clientes.id` |
|---|---|---|
| CS&NPS (satélites) | `socios`, `log_cs`, `logFeedback`, `logAlteracao` (desativado), `historico_alteracao_cliente` | `clienteId` |
| Parceiros | `indicacoes` | `clienteId` |
| CRM | `crm_oportunidades`, `crm_contatos` | `clienteId` |
| Metas/Comercial | `ContratoComercial` → sincroniza para `clientes` via `criarRegistroClienteAPartirDeContrato` (não é FK direta, é escrita programática no fluxo de `confirmarFechamento`) | — |

**Qualquer migration estrutural em `clientes` (rename, recriação, mudança de índice/constraint) exige checar TODAS as tabelas acima antes de considerar concluída** — ver regra permanente em `decisions.md` (2026-07-13, "Parceiros ↔ Metas ↔ CS&NPS são módulos acoplados via `clientes`"). Um incidente real já ocorreu: uma migration de `clientes` (rename→create→drop `clientes_old`) deixou 6 tabelas (as 6 da tabela acima, exceto `historico_alteracao_cliente` que é posterior ao incidente) com FK fantasma para o nome antigo, zerando o conteúdo de todas silenciosamente.

> Mantido por: Echo (backend) e Scribe (cartógrafo)
> Atualizar sempre que novos endpoints, actions ou schemas forem criados.

---

## Stack

<!-- Preencher após instalar no projeto -->

| Área | Tecnologia |
|------|-----------|
| Framework | Next.js + App Router |
| Auth | |
| Banco | |
| ORM | |
| Estilização | |
| Estado | |
| Upload | |
| AI | |

---

## Schema do Banco (tabelas principais)

### Módulo Extratos Bancários (reescrito em 2026-07-09)
```prisma
model Extratos {
  id, cnpj (unique), razaoSocial, nomeFantasia?, dataConstituicao?,
  municipio?, uf?, regimeTributario?, criadoPorNome?, analistaResponsavel?
  periodos PeriodosAnalise[]
  @@index([criadoPorNome]) @@index([razaoSocial])
}
model PeriodosAnalise { id, mes, ano, extratoId → Extratos, bancos BancosVinculados[] }
model BancosVinculados { id, bancoId, nomeBanco, logo, descricao?, anotacao?, periodoId → PeriodosAnalise, transacoes Transacao[] }
model Transacao {
  id, data DateTime?, dataOriginalTexto String?, descricao, valor Float,
  bancoId, mesReferencia, origemArquivo?, BancosVinculadosId → BancosVinculados
  @@index([BancosVinculadosId, data])
}
```
**IMPORTANTE — `Transacao.data` é `DateTime?` (nullable), NÃO `String`.** Migrado em 2026-07-09 (ver `decisions.md`). 273 registros legados têm `data = null` e o texto original preservado em `dataOriginalTexto` (formato "DD/MM" sem ano, sem como recuperar o ano com confiança). Qualquer código que itere transações DEVE tratar `data: null` (exibir "data desconhecida" ou ordenar por último) — nunca assumir que `data` sempre existe.

### Módulo Alpha Presentation Studio (Onda 1 — 2026-07-09)
```prisma
model Apresentacao { id (cuid), titulo, clienteNome?, autorId → usuarios, status (DRAFT|PUBLICADA|ARQUIVADA),
  temaId? → ApresentacaoTema, thumbnailUrl?, slugPublico? @unique, senhaAcesso?, expiraEm?
  slides Slide[], assets ApresentacaoAsset[], versoes ApresentacaoVersao[], colaboradores ApresentacaoColaborador[], comentarios ApresentacaoComentario[]
  @@index([autorId]) @@index([status]) }
model Slide { id (cuid), apresentacaoId → Apresentacao, ordem, nome?, transicaoEntrada?, duracaoAutoplay?, dadosJson Json
  @@index([apresentacaoId, ordem]) }
model ApresentacaoTema { id (cuid), nome, corPrimaria, corSecundaria, corAccent, radius?, fontePrimaria?, fonteSecundaria?, tokensJson Json, isTemplate, criadoPorId? }
model ApresentacaoAsset { id (cuid), apresentacaoId → Apresentacao, tipo (IMAGEM|VIDEO|MODELO_3D|AUDIO|FONTE), url, nomeOriginal, tamanhoBytes }
model ApresentacaoVersao { id (cuid), apresentacaoId → Apresentacao, dadosJson Json, criadoPorId, label? }
model ApresentacaoColaborador { id (cuid), apresentacaoId → Apresentacao, userId → usuarios, papel (EDITOR|VISUALIZADOR|COMENTARISTA), @@unique([apresentacaoId, userId]) }
model ApresentacaoComentario { id (cuid), apresentacaoId → Apresentacao, slideId? → Slide, autorId → usuarios, texto, resolvido }
```
**IMPORTANTE — `Slide.dadosJson` é um blob JSON único por slide** (árvore de componentes: textos, imagens, posições, animações) — decisão deliberada de NÃO relacionalizar em tabela `ComponenteSlide` (ver `decisions.md` 2026-07-09, "arquitetura de dados do slide"). Todo código que gera/lê esse JSON deve validar com Zod discriminated union por `tipo` de componente (recomendação de Scout, a implementar nas ondas seguintes do editor).

**Onda 4 (3D) — 2026-07-10:** `componenteSchema` (`src/lib/validations/slide-componentes.ts`) ganhou 3 novos tipos na union discriminada, todos renderizados via React Three Fiber (`@react-three/fiber` + `@react-three/drei`, instalados nesta onda — compatibilidade confirmada com React 19.2.3/Three 0.185.1 já em uso): `globo` (esfera com textura opcional, rotação automática, `marcadores[]` de lat/lng para uso comex/logística), `particulas` (campo de pontos animados — quantidade/cor/tamanho/velocidade), `objeto3d` (carrega modelo externo `.glb`/`.gltf` via `url`, com `autoRotacao`/`escala`). Sem mudança de schema Prisma — `dadosJson` continua sendo o único ponto de persistência. Ver nota em `known-errors.md` sobre `frameloop` do R3F e visibilidade dentro do iframe do painel.

---

## Endpoints e Server Actions

<!-- Preencher conforme o projeto cresce -->

| Tipo | Caminho | Método | Auth | Descrição |
|------|---------|--------|------|-----------|
| Route Handler | `/api/...` | GET | Sim | |
| Server Action | `src/actions/bpm/Membros.ts` (2026-08-14) | — | Sim, CRM + ownership do card | `ListarUsuariosVinculaveisCardBpm({cardId})` lista apenas contas ativas com CRM efetivo para o seletor de gestão. `AtualizarMembrosCardBpm({cardId,userIds})` substitui participantes sob transação e CAS por `updatedAt`, preserva o responsável e revalida autorização/elegibilidade dentro da transação. Somente responsável, administrador do card ou Admin/CEO/TI global pode gerir; o histórico armazena apenas IDs e há evento realtime pós-commit. |
| Route Handler | `/api/cs-nps/exportar` | GET | Sim, permissão efetiva `Cliente` | Exporta clientes ativos e arquivados e suas relações diretas confirmadas em workbook `.xlsx`, com uma aba por entidade. |
| Route Handler | `/api/cs-nps/importar/modelo` | GET | Sim, usuário ativo Admin/CEO + permissão efetiva `Cliente` | Gera o modelo `.xlsx` com `Instrucoes` e as abas `Socios`, `CS` e/ou `Feedbacks` escolhidas em `tipos`. |
| Route Handler | `/api/cs-nps/importar/previsualizar` | POST multipart | Sim, usuário ativo Admin/CEO + permissão efetiva `Cliente` | Faz preflight ZIP streaming, parseia até 2.000 linhas e resolve candidatos de empresa/serviço sem gravar dados. |
| Route Handler | `/api/cs-nps/importar/salvar` | POST JSON | Sim, usuário ativo Admin/CEO + permissão efetiva `Cliente` | Revalida o `clienteId` de cada linha e grava sócios/CS/feedbacks e auditoria em uma única transação. |
| Server Action | `src/actions/apresentacoes.ts` | — | Sim | `ListarApresentacoes`, `CriarApresentacao`, `DuplicarApresentacao`, `ExcluirApresentacao`, `AtualizarStatusApresentacao` — ownership: autor ou Admin/CEO |
| Server Action | `src/actions/slides.ts` (Onda 2) | — | Sim | `ListarSlides`, `ObterSlide`, `CriarSlide`, `AtualizarSlide`, `ReordenarSlides`, `ExcluirSlide`, `DuplicarSlide` — ownership sempre sobe até `Apresentacao.autorId`/`colaboradores` via `checarOwnershipApresentacao()` (nunca confia no `Slide.id` isolado). `AtualizarSlide` valida `dadosJson` com `dadosSlideSchema` (Zod) antes de salvar. `ExcluirSlide` bloqueia se for o último slide da apresentação (regra de negócio confirmada com o usuário, ver `decisions.md`). |
| Server Action | `src/actions/apresentacao-temas.ts` (Onda 3) | — | Sim | `ListarTemas` (templates do sistema + temas próprios do usuário), `CriarTema`, `AtualizarTema` (templates só editáveis por Admin/CEO, temas próprios só pelo dono), `AplicarTema` (seta `Apresentacao.temaId`, ownership via `checarOwnershipApresentacao`). `ApresentacaoTema` (model existente desde a Onda 1) recebeu seu primeiro uso real: 5 templates seedados no Turso (Alpha Premium, Dark Glass, Corporate, Minimalista, Apple-style — `isTemplate: true`, `criadoPorId: null`). |
| Route Handler | `POST /api/apresentacoes/gerar-slide` (Onda 5) | POST | Sim | Motor de IA para gerar o conteúdo de 1 slide a partir de prompt livre. Ownership (`checarOwnershipApresentacao`) verificado ANTES de qualquer chamada à IA. Streaming SSE (mesmo formato do chat do Bibble: `{type:"status"}`/`{type:"text"}`/`{type:"done"}`/`{type:"error"}`) — `text` carrega fragmentos do JSON sendo gerado; cliente só faz `JSON.parse`+Zod quando `done` chega. Reaproveita `callCompletion` (extraído para `src/lib/bibble/completion.ts` nesta onda) e o mesmo provedor Ollama local padrão do chat do Bibble (`process.env.BIBBLE_MODEL ?? "gemma4:e4b"`, servidor `ollama.alpha-comex.com` em produção — NÃO Anthropic direta, sem custo de API externa). IA escolhe 1 de 5 templates de layout fixos (`src/lib/apresentacoes-ia/templates-layout.ts`) e preenche só o conteúdo textual — nunca desenha coordenadas x/y/w/h livres. |
| Server Component | `GET /PainelAlpha/Apresentacoes/[id]/apresentar` (Onda 6, Fase 1) | — | Sim | Modo Apresentação fullscreen. Página fina com o mesmo padrão de ownership do editor, busca TODOS os slides ordenados + tema, passa para `ModoApresentacaoClient` (Client Component). Navegação por teclado (setas/espaço/Esc) + clique. Usa `RenderComponente` DIRETO, sem wrapper de seleção do Editor — primeira vez que o RenderEngine roda fora do Editor, resolvendo a lacuna de `stagger` não visível (Onda 3). Transição entre slides via `TransicaoSlide.tsx` (Framer Motion `AnimatePresence`), implementando `Slide.transicaoEntrada` de verdade pela primeira vez (fade/slide-horizontal; valores desconhecidos caem em fade). Fullscreen API tentada como melhor esforço, sem crítica se o browser negar. |
| Server Action | `src/actions/Blueprint{Projects,Documents,Boards,Files,Requirements,Questions,Comments,Members,Onboarding}.ts` (2026-07-27) | — | Sim | Módulo Alpha Blueprint (MVP). 9 arquivos, ownership por `checarAcessoBlueprint`/`exigirAcessoBlueprint` (`src/lib/blueprint/ownership.ts`) — matriz de 5 roles × 14 ações granulares por projeto (`BlueprintMember`), Admin/CEO global bypassa. `ListarProjetosBlueprint` (paginado, filtros por status/prioridade/setor/responsável), `CriarProjetoBlueprint` (valida `requesterId` existe de fato em `usuarios` antes de gravar), `MoverProjetoBlueprint` (máquina de transições de status do Kanban, idempotente quando já está no status alvo). Ver `codebase-map.md` para detalhe completo. |
| Route Handler | `POST /api/blueprint/upload` (2026-07-27) | POST multipart | Sim, ownership por projeto (`enviarArquivo`) | Upload via Vercel Blob **dedicado** (`BLUEPRINT_READ_WRITE_TOKEN`, store próprio — NÃO o `IACHAT_*` do Bibble). Allowlist de MIME type + limite de 100MB, mesmo padrão de `/api/bibble/upload-to-blob`. |
| Route Handler | `POST /api/blueprint/chat` (2026-07-27) | POST | Sim, ownership por projeto (`usarIA`) | Chat contextual da IA do Alpha Blueprint, streaming SSE. Reaproveita `callCompletion`/`encodeSSE`/`BIBBLE_MODEL` de `lib/bibble/completion.ts` (Ollama real, não Anthropic). Contexto do projeto (`montarContextoProjeto`) é seletivo e truncado — nunca serializa o projeto inteiro; tools próprias (`BLUEPRINT_AI_TOOLS`) isoladas das tools gerais do Bibble, nunca misturam contexto entre projetos. |

---

### Módulo CS&NPS — CNPJ duplicado permitido por serviço (migrado em 2026-07-13)
```prisma
model clientes {
  id ..., cnpj String (SEM @unique — era @unique até 2026-07-13), servicos String?
  ...
  @@unique([cnpj, servicos])  // constraint composta — permite múltiplos serviços do mesmo CNPJ
}
```
**IMPORTANTE — `clientes.cnpj` deixou de ser globalmente único.** Cada serviço contratado por um CNPJ vira um registro SEPARADO em `clientes` (não concatena string). A UI (`page.tsx`) mescla visualmente registros do mesmo CNPJ em 1 linha. Ligação com Painel de Metas via `buscarServicoContratadoPorCliente(cnpj, servicos)` (`src/actions/Clientes.ts`) — casa por CNPJ + nome do serviço normalizado contra `ContratoComercial`, trazendo `valorContrato`/`formaPagamento`/`closerNome`. Migration real aplicada no Turso via recriação de tabela (SQLite não permite DROP de UNIQUE inline) — ver `decisions.md` (2026-07-13).

**`clientes` ganhou 4 colunas (2026-07-13):** `municipio String?` (cidade, exibida ao lado de UF), `formaPagamento String?`/`valorContrato Float?`/`closerNome String?` (preenchimento MANUAL no cadastro do CS&NPS, fallback quando um registro não tem contrato correspondente vinculado no Metas). `CadastrarCliente`/`salvarAlteracoesGeral`/`criarRegistroClienteAPartirDeContrato` (todas em `Clientes.ts`) atualizadas para aceitar/persistir os 4 campos.

**Sincronização automática Metas → CS&NPS na CONFIRMAÇÃO DE PAGAMENTO (2026-07-13, corrigido na mesma sessão):** `confirmarFechamento` (não `criarContrato`) chama `criarRegistroClienteAPartirDeContrato({ cnpj, razaoSocial, servico, nomeFantasia, dataConstituicao, regimeTributario, uf, dataContratacao, socios })` (`src/actions/Clientes.ts`) — cria/reativa o registro em `clientes` só quando o pagamento é de fato confirmado, não na criação do contrato (contratos nunca confirmados não geram registro no CS&NPS). `dataContratacao` vem de `ContratoComercial.pagamentoConfirmadoEm`. Função também recebe `socios[]` opcional (migrado da lógica antiga) e retorna `clienteId` (usado para vincular `Indicacao` de parceiro quando `criado === true`). Via `findFirst` explícito: não existe → cria (com sócios); existe e "Arquivado" → REATIVA + atualiza campos fiscais/dataContratacao só se vier valor novo não-vazio; existe ativo → idempotente. Havia uma 2ª lógica de sincronização pré-existente (antes desta sessão) dentro de `confirmarFechamento` que reconsultava a Receita Federal e usava `findFirst` só por CNPJ (quebrada pela constraint composta) — foi REMOVIDA e substituída por esta chamada centralizada. Falha na sincronização NUNCA reverte o fechamento do contrato (`try/catch` isolado, só loga).

**`ContratoComercial` ganhou `dataConstituicao`/`regimeTributario`/`uf` (2026-07-13, migration ADD COLUMN nullable):** capturados pelo formulário do Metas (`ModalGerenciamentoLeads.tsx`) na mesma consulta `/api/ReceitaFederal` que já fazia (antes só usava razaoSocial/nomeFantasia da resposta) — sem chamada nova à API externa.

**⚠️ PENDÊNCIA DE SEGURANÇA REGISTRADA (Anubis, 2026-07-13):** a seção "Serviços Contratados" do modal do CS&NPS expõe `valorContrato`/`formaPagamento`/`closerNome` (dados do Metas) para qualquer usuário com a permissão `Cliente`, mas esses dados hoje só são visíveis no módulo Metas restrito a `allowedRoles: ['Lider Comercial']` (`modulos-registry.ts`). Decisão sobre restringir ou manter aberto foi **adiada explicitamente pelo usuário** — ver `decisions.md`. Não é permissão para deixar como está permanentemente.

### Módulo CS&NPS — arquitetura da importação em lote (2026-07-15)

A importação usa um pipeline em duas fases: `previsualizar` interpreta o workbook e devolve linhas tipadas/candidatos sem persistência; `salvar` recebe somente as linhas mantidas pelo usuário, revalida todos os schemas e repete a resolução do destino antes de gravar. Isso permite remover linhas e resolver ambiguidades na UI sem tornar a prévia uma fonte de confiança.

Como `clientes` permite o mesmo CNPJ em serviços diferentes, a razão social ou o CNPJ identificam um conjunto de candidatos, enquanto `clienteId` identifica o destino relacional definitivo. O `clienteId` enviado pela UI só é aceito se ainda pertencer ao conjunto calculado a partir do identificador original; assim, um valor adulterado ou um destino que mudou entre prévia e confirmação é rejeitado. A confirmação consulta novamente `usuarios` dentro de `db.$transaction`, grava `socios`, `log_cs`, `logFeedback` e `auditoria`, e reverte o conjunto inteiro em qualquer falha. Não houve mudança de schema Prisma.

O contrato do arquivo é allowlist: `Instrucoes` opcional, `Socios(cnpj, razaoSocial, nome, telefone, observacao, dataNascimento, vinculo)`, `CS(cnpj, razaoSocial, colaborador, sentimento, observacao, dataRegistro)` e `Feedbacks` com as mesmas colunas de CS. O gerador inclui somente as abas selecionadas; o parser rejeita abas, cabeçalhos, colunas, fórmulas e macros fora desse contrato. Múltiplos sócios usam linhas repetidas para a mesma empresa.

Antes do parse completo por ExcelJS, `preflight-xlsx.ts` percorre as entradas via `yauzl` em streaming e mede o conteúdo realmente descompactado. Os limites são: arquivo de 10 MB, 2.000 linhas, 256 entradas ZIP, 20 MB descompactados por entrada, 50 MB no total e razão máxima 100:1. A prévia também possui rate limit em memória por instância (`userId + IP`, cinco/minuto e uma execução concorrente); ele não coordena réplicas. Idempotência persistente da confirmação não foi implementada e permanece fora deste escopo: repetir um `POST /salvar` válido pode criar registros duplicados.

A autorização administrativa comum foi extraída para `src/lib/cs-nps/autorizacao.ts` e é usada por exportação e pelas três rotas de importação: sessão válida, usuário ainda `ATIVO`, role atual `admin`/`ceo` e permissão efetiva `Cliente`. Os contratos puros e de persistência têm cobertura Vitest em `tests/cs-nps/importar-dados.test.ts`, `calculos.test.ts` e `preflight-xlsx.test.ts`.

**Última atualização:** 2026-07-15 por Scribe

## Módulo Calendário Alpha (Domain-Wide Delegation — 2026-07-17, v2)

**Arquitetura mudou dentro da mesma sessão**: começou como OAuth por usuário (tokens criptografados), foi reconstruída para Domain-Wide Delegation (Service Account impersona `usuarios.email` via `google.auth.JWT`). Schema v2, sem nenhum token por usuário:

```prisma
model GoogleCalendarConexao {
  id, userId (Int, @unique) → usuarios,
  status (ATIVA|DESATIVADA), ativadoEm, desativadoEm?, ultimaSincronizacaoEm?
}
model GoogleCalendarSelecionado { id, conexaoId → GoogleCalendarConexao, googleCalendarId, nome, corHex?, timezone, papelAcesso, visivel, gravavel, syncToken?, ultimaSincronizacaoEm?
  @@unique([conexaoId, googleCalendarId]) }
model GoogleCalendarEventoCache { id, calendarioId → GoogleCalendarSelecionado, googleEventId, status, titulo?, inicioEm?, fimEm?, diaInteiro, etag, atualizadoGoogleEm
  @@unique([calendarioId, googleEventId]) @@index([calendarioId, inicioEm]) }
```
`GoogleCalendarOAuthNonce` (existia na v1) foi **removida** — sem OAuth, sem state, sem nonce. Duas migrations reais aplicadas no Turso via script pontual (`@libsql/client/web`), cada uma com backup pré-mudança validado em `database-backups/pre-change/` e confirmação explícita do usuário. Nenhuma coluna nova em `usuarios`.

| Tipo | Caminho | Auth | Descrição |
|------|---------|------|-----------|
| Server Action | `src/actions/google-calendar-conexao.ts` | Sim | `obterStatusConexaoCalendarioAlpha`, `ativarCalendarioAlpha`/`desativarCalendarioAlpha` — puramente local, sem chamada ao Google (a autorização real já existe via Domain-Wide Delegation). |
| Server Action | `src/actions/google-calendar-eventos.ts` | Sim | Seleção de calendário, leitura cache-only (`listarEventosCache`; alias legado `listarEventosDoCalendario`), detalhes completos antes da edição, CRUD via PATCH parcial + `If-Match`/ETag e FreeBusy. Toda chamada ao Google usa `emailUsuario` resolvido via `usuario-google.ts` (sempre `usuarios.email` da sessão, nunca do payload do cliente). |
| Server Action | `src/actions/google-calendar-sync.ts` | Sim | `sincronizarAgendaAlpha` executa sync manual consolidada por conexão, com status/contadores/erros tipados e atualização de `GoogleCalendarConexao.ultimaSincronizacaoEm` somente após sucesso integral. |

**Onda cache-first (2026-07-30):** renderização não dispara Google API. `invalidation.ts` oferece `BroadcastChannel` com fallback `storage`/evento DOM e dedupe de mensagens entre abas/iframes.

### Fase 2A — push, fila persistente e lock distribuído (2026-07-30)

A Fase 2A está implementada e validada com **flags off**. O Vault apresentou o relatório, recebeu autorização explícita e a migration isolada foi aplicada uma única vez no Turso de produção após backup verificado. Foram adicionados somente `GoogleCalendarPushChannel`, `GoogleCalendarPendingOperation` e `GoogleCalendarSyncLease`, com 7 índices explícitos e 3 unicidades.

`POST /api/calendario-alpha/webhook` é o único Route Handler da Agenda: autentica o sinal do Google, coalesce a fila no Turso e não sincroniza no request. O worker reclama jobs por CAS, adquire lease por calendário e executa o sync sob fencing; maintenance gerencia canais, reconciliação stale e recuperação. Create/renew/stop dos canais também são serializados por lease. Cache e `syncToken` continuam na mesma transação, agora com duas barreiras de fencing e persistência de eventos em lotes seguros.

**Runbook flags-off:** manter as três flags booleanas desligadas; usar `calendar-alpha:doctor`, `calendar-alpha:queue -- status` e `calendar-alpha:maintenance -- --status`; ativar lock → fila → push somente depois de URL HTTPS pública, WAF/rate limit distribuído, scheduler supervisionado e E2E Google/Turso multi-instância; iniciar por canário. Rollback desliga push, drena/interrompe workers, desliga fila e por último o lock.

**Qualidade:** 183 testes Agenda Alpha PASS; Forge build/lint/schema PASS; typecheck preserva quatro baselines externos. Probe, Anubis, Lens e Sage PASS. Ready for Review; rollout externo bloqueado.

**Última atualização:** 2026-07-30 por Scribe

**Pré-requisito fora do código:** Service Account com Domain-Wide Delegation autorizada pelo Super Admin do Google Workspace (Admin Console → Security → API Controls → Domain-wide Delegation), com o Client ID numérico da Service Account e os escopos de `scopes.ts`. Ver `codebase-map.md` para o passo a passo completo.

---

## Módulo Gestão de Comissões e Prêmios (2026-07-28)

18 models novos + 4 colunas em `CargoColaborador`, aplicados no Turso via script Node pontual (removido após uso). Todo valor monetário em `Int` (centavos) — nunca `Float`.

```prisma
model CommissionEvent { id (cuid), eventType (CONTRACTING|PROCESS_STARTED|PROCESS_SUCCESS|FIRST_ATTEMPT_SUCCESS|AUXILIARY_PARTICIPATION|MANUAL_EVENT|CANCELLATION|REVERSAL),
  cnpj, razaoSocial, servico, eventDate, grossContractAmountCents, netContractAmountCents, commissionableBaseCents?, status,
  sourceSystem, sourceEntity, sourceId, lastSyncAt — entries CommissionEntry[], divergencias CommissionDivergence[] }
model CommissionEntry { id (cuid), eventId → CommissionEvent, collaboratorId Int, cargoId Int, vinculo ("CLT"|"PJ" resolvido na data do evento),
  totalCents, status (Pendente|AguardandoAprovacao|Programado|Pago|ParcialmentePago|Vencido|Bloqueado|EmDivergencia|Cancelado|Estornado),
  contractualDueDate?, operationalSuggestedDate?, scheduledPaymentDate?, actualPaymentDate?
  componentes EntryComponent[], ajustes ManualAdjustment[], alocacoes PaymentAllocation[] }
model EntryComponent { id, entryId → CommissionEntry, tipo (COMISSAO|PREMIO|DSR|AJUSTE), valorCents, percentual?, memoriaCalculoJson }
model ManualAdjustment { id, entryId → CommissionEntry, valorOriginalCents, valorAjustadoCents, justificativa,
  aprovadoById? aprovadoEm? (fluxo de aprovação existe no schema; Server Action de aprovação ainda NÃO implementada — ver decisions.md), createdById }
model CommissionRule { id (cuid), name, priority, eventType, benefitType (COMMISSION|BONUS|DSR), cargoId?/setorId?/collaboratorId?, active
  versions CommissionRuleVersion[] }
model CommissionRuleVersion { id, ruleId → CommissionRule, version Int, status (DRAFT|PUBLISHED), validFrom, validTo?,
  conditionsJson, calculationJson, paymentScheduleJson, publishedById?, publishedAt? — NUNCA sobrescrita, sempre nova versão incrementada }
model EligibilityOverride { — camada de exceção avaliada ANTES do rule-engine, decisão registrada em decisions.md }
model Payment { id, data, valorCents, meio, tipo (PAGAMENTO|ESTORNO), comprovanteUrl? — allocations PaymentAllocation[] }
model PaymentAllocation { id, paymentId → Payment, entryId → CommissionEntry, valorCents }
model TariffVersion { id (cuid), servico, valorCents, dataInicial, formasPagamentoJson — versionado por serviço/data }
model CommissionDivergence { id, eventId? → CommissionEvent, tipo, severidade (PENDING_REVIEW|BLOCKED|INTEGRATION_ERROR), detalhes, resolvidoEm?, resolvidoById? }
model ExportDocument / ExportDocumentItem { — trilha de documentos de espelho gerados (XLSX/PDF), itens individuais }
model Holiday { — feriados nacionais seed, algoritmo de Páscoa de Gauss; feriados MUNICIPAIS não implementados, ver decisions.md }
model SyncRun / SyncError { — auditoria de execuções de sincronização CS&NPS/Metas/Colaboradores → Comissões }
model CommissionAuditLog { id, userId, acao, entityType, entityId, beforeJson, afterJson, correlationId — trilha financeira completa }
```

**`CargoColaborador` ganhou 4 colunas:** `setorId Int?`, `vinculoPadrao String?` ("CLT"|"PJ"), `naturezaRecebimento String?` ("COMISSAO"|"PREMIO"|"AMBOS"), `permiteMultiplosOcupantes Boolean @default(true)`. Decisão de estender o model existente em vez de criar tabela paralela — ver `decisions.md`.

**Motor de regras determinístico** em `src/lib/commissions/` — SEM `eval`/`Function()`, avaliação por `switch/case` explícito (`rule-engine.ts`, 13 operadores de condição). `calculators.ts` cobre 9 `CalculationType` (PERCENTAGE, FIXED, PER_UNIT, ADDITIONAL, DSR, CAP, FLOOR, PROPORTIONAL, SUM_OF_COMPONENTS). `commissionable-base.ts` implementa a regra de preservação do tarifário em desconto ≤10% e as 5 políticas configuráveis para desconto >10% (nunca decide sozinho sem política explícita). `calendar-engine.ts` + `holidays-seed.ts` resolvem 5º dia útil, última sexta, sexta da semana seguinte, último dia civil/útil. `vinculo-resolver.ts` resolve CLT/PJ na data do evento com 4 estados de divergência explícitos (nunca escolhe sozinho em ambiguidade). Simulador (`SimularRegra` em `CommissionRules.ts`) reusa o MESMO motor real, sem duplicação — só simula contra seed-rules, não contra regras publicadas no banco (TODO documentado).

**Fonte de contratação: merge de `ContratoComercial` + `clientes`** (decisão do usuário — nunca escolher uma fonte só, sempre unir para não perder dado). **Êxito (PROCESS_SUCCESS) nasce de `clientes.dataExito` passando de vazio para preenchido** (não vem do Checklist RADAR nem é registro manual) — `exito-detector.ts`, idempotente por design (compara contra `CommissionEvent` já existente do mesmo cliente).

**Pendências conscientemente deixadas configuráveis (seção 39 do prompt original, não decididas por invenção):** fórmula definitiva do DSR (`dsr-formula.ts` tem placeholder documentado), natureza do valor do Diretor Operacional, feriados municipais (só nacionais implementados), tratamento de inadimplência, RBAC granular por ação dentro do módulo (hoje é módulo-inteiro via `permission: 'comissoes'`, TODO em texto nos 12 arquivos de Server Actions), aprovação de `ManualAdjustment` (schema existe, Server Action de aprovação não implementada).

**Rotas:** `/PainelAlpha/Comissoes` (dashboard, Big Card por evento + mini card por colaborador), `/Simulador`, `/Divergencias`, `/Configuracoes` (Cargos/Tarifários/Construtor de Regras). Todas protegidas por `auth()` + bypass Admin/CEO + `getPermissoesEfetivas().includes('comissoes')`.

**Exportação:** `export/xlsx-generator.ts` (ExcelJS, 6 abas) e `export/pdf-generator.tsx` (`@react-pdf/renderer`) — ambos com `neutralizarFormula()` contra Excel Formula Injection (achado de segurança corrigido pelo Anubis, mesmo padrão de `exportar-dados.ts` do CS&NPS).

**Testes:** `tests/commissions/` — 152 testes (17 arquivos), cobrindo motor de regras, calendário, adapters, eventos/lançamentos, pagamentos, divergências, exportação (incluindo teste de segurança de Formula Injection), configurações, e ajuste manual.

**Última atualização:** 2026-07-28 por Scribe

---

## Variáveis de Ambiente

<!-- Listar as env vars necessárias -->

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | Conexão com banco |
| `ANTHROPIC_API_KEY` | API Claude (Bibble) |
| `GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL` | `client_email` da Service Account com Domain-Wide Delegation (Calendário Alpha) |
| `GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY` | `private_key` da mesma Service Account (com `\n` literais) — nunca em banco, só nesta env var |
| `BLUEPRINT_STORE_ID` | ID do Vercel Blob Store dedicado do Alpha Blueprint (`store_aFGirg4S8PTvIAMB`) — documentação apenas, o SDK instalado (`@vercel/blob@2.3.1`) seleciona o store pelo token, não aceita `storeId` como parâmetro do `put()` |
| `BLUEPRINT_READ_WRITE_TOKEN` | Token do mesmo store — usado em `src/app/api/blueprint/upload/route.ts` |
| `METAS_READ_WRITE_TOKEN` | Token do Blob Store dedicado da feature Justificativa de Meta (`access: "private"`) — usado em `src/app/api/metas/justificativas/{upload,[id]}/route.ts` |

---

## Sistema de Notas — camada global (Fases 01-05/8, 2026-08-07 — ✅ MIGRATION APLICADA EM PRODUÇÃO)

> **✅ STATUS: as 11 tabelas abaixo EXISTEM DE VERDADE no Turso real de produção desde 2026-08-07 (durante a Fase 05).** Não é mais schema teórico aguardando aprovação — pode haver dado real gravado por usuários a qualquer momento a partir de agora. Ver `decisions.md` ("migration de 11 tabelas APLICADA EM PRODUÇÃO") para o histórico completo (Vault bloqueou na Fase 01 aguardando o usuário, usuário confirmou explicitamente durante a Fase 05 após testar ao vivo e encontrar o erro esperado, backup de 64.699,9 KB/32.949 linhas gerado e validado antes da aplicação).

Fila `prompt-phases/` (8 fases, ver `prompt-phases/00-contexto-geral.md` para o prompt mestre completo). Fase 01 entregou schema + permissões + Server Actions base.

```prisma
model Note {
  id, title, contentJson Json, plainText, ownerId Int, visibility (PRIVADA|COMPARTILHADA|EQUIPE|INSTITUCIONAL),
  status (RASCUNHO|ATIVA|ARQUIVADA|LIXEIRA, default ATIVA), color?, icon?, isFavorite, currentVersion (default 1),
  createdById Int, updatedById Int?, createdAt, updatedAt, archivedAt?, deletedAt?
  contexts NoteContext[], permissions NotePermission[], tags NoteTag[], versions NoteVersion[],
  comments NoteComment[], attachments NoteAttachment[], reminders NoteReminder[], openTabs UserOpenNoteTab[]
  @@index([ownerId,status]) @@index([status,deletedAt]) @@index([visibility]) @@index([updatedAt])
}
model NoteContext { id, noteId → Note, moduleKey, entityType, entityId, displayName, internalPath, metadata Json?, createdAt }
model NotePermission { id, noteId → Note, subjectType (USUARIO|SETOR|ROLE), subjectId, role (LEITOR|COMENTARISTA|EDITOR|ADMIN), createdById Int, createdAt
  @@unique([noteId,subjectType,subjectId]) }
model Tag { id, name, color, ownerId Int?, setorNome String?, createdAt @@unique([name,ownerId,setorNome]) }
model NoteTag { noteId → Note, tagId → Tag, @@id([noteId,tagId]) }
model NoteVersion { id, noteId → Note, version Int, title, contentJson Json, plainText, changedById Int, changeSummary?, createdAt
  @@unique([noteId,version]) }
model NoteComment { id, noteId → Note, parentId?, authorId Int, content, isResolved, createdAt, updatedAt, deletedAt? }
model NoteAttachment { id, noteId → Note, fileName, mimeType, size Int, storageKey, uploadedById Int, createdAt, deletedAt? }
model NoteReminder { id, noteId → Note, userId Int, remindAt, status (default PENDENTE), completedAt?, createdAt }
model UserOpenNoteTab { id, userId Int, noteId → Note, position Int, isActive, isPinned, openedAt, updatedAt
  @@unique([userId,noteId]) }
model UserNotesWorkspace { userId Int @id, isTaskbarVisible, viewerMode (default RECOLHIDO), viewerHeight (default 320), activeNoteId?, updatedAt }
```

**Todas as FKs de usuário são `Int` com `@relation` nomeada explicitamente** (`"NoteOwner"`, `"NoteCreatedBy"`, `"NoteUpdatedBy"`, `"NotePermissionCreatedBy"`, `"TagOwner"`, `"NoteVersionChangedBy"`, `"NoteCommentAuthor"`, `"NoteAttachmentUploadedBy"`, `"NoteReminderUser"`, `"UserOpenNoteTabUser"`, `"UserNotesWorkspaceUser"`) — mesmo padrão real já usado em `BlueprintProject` (`"BlueprintRequester"` etc), obrigatório porque `Note` tem 3 FKs (`ownerId`/`createdById`/`updatedById`) para `usuarios`.

**Herança de permissão contextual** (`src/lib/notas/permissoes.ts`): nota vinculada a um módulo restrito (`NoteContext.moduleKey`) só é visível a quem também tem a permissão daquele módulo via `getPermissoesEfetivas()`. Admin/CEO/TI podem ignorar apenas essa checagem do módulo contextual, depois de já terem sido reconhecidos como dono ou destinatário de compartilhamento; isso nunca concede acesso à nota por si só. "Nota de equipe" (`NotePermission.subjectType = "SETOR"`) compara `subjectId` contra `usuarios.role` via `isSameRole()` (`src/lib/roles.ts`) — não existe tabela de membros de equipe no projeto, ver decisão em `decisions.md`.

**Server Actions** (`src/actions/Notas.ts`): `CriarNota`, `AtualizarNota` (controle de versão otimista via `baseVersion`/`currentVersion`, retorna `error: "CONFLITO_VERSAO"` se desatualizado — nunca sobrescreve silenciosamente), `ObterNota`, `ListarNotas` (paginado, mesmo contrato `{success,data,total,page,pageSize,totalPages}` do resto do projeto), `ArquivarNota`, `RestaurarNota`, `MoverNotaParaLixeira`, `ExcluirNotaDefinitivamente`, `ExcluirNotasDefinitivamente` e `EsvaziarLixeira`.

**Regra de isolamento atual (2026-08-11):** Admin/CEO/TI não possuem bypass sobre notas específicas. Todas as listagens usam `criarFiltroAcessoNota()` (`src/lib/notas/acesso.ts`): a nota precisa pertencer ao usuário ou ter `NotePermission` explícita para usuário/setor/role. Exclusões permanentes usam `criarFiltroExclusaoLixeira()` com `ownerId` autenticado e `status=LIXEIRA`; exclusão selecionada também exige IDs validados por Zod. Nenhuma alteração de schema foi necessária.

**Sincronização de iframe (2026-08-11):** como a Central e a barra global executam em documentos distintos, mudanças de workspace feitas na Central disparam a mensagem tipada `painel-alpha:notas-workspace-atualizado` para `window.parent`, limitada à mesma origem. `NotesGlobalTaskbar` valida origem+payload e recarrega o workspace do servidor. O preview dos cards da Central é atualizado localmente pelo callback opcional de `NoteEditor`, sem alterar o debounce de persistência.

**Escala de z-index** (`src/lib/z-index.ts`, novo): `conteudoPrincipal`(0) → `headerSidebar`(50) → `barraNotas`(100) → `editorNotas`(110) → `dropdown`(150) → `modal`(250) → `toast`(300) → `alertaCritico`(400). Não existia escala formal antes — valores soltos pré-existentes (`z-40`, `z-50`, `z-[55]`, `z-[60]`, `z-[70]`, `z-[200]` em `GlobalSidebar.tsx`/`PainelLayoutClient.tsx`/`OnboardingModal.tsx`) **não foram tocados/renumerados** (fora de escopo desta fila, risco de regressão visual em código não relacionado).

**Registry:** entrada `{ id: 'notas', label: 'Bloco de notas ALpha', href: '/PainelAlpha/Notas', iconName: 'StickyNote', category: 'infra', permission: 'notas' }` em `MODULOS_REGISTRY`; a rota existe desde a Fase 03.

### Fase 02 — Barra global inferior + editor TipTap + autosave (2026-08-07)

**Barra global** (`src/components/Notas/NotesGlobalTaskbar.tsx`): montada 1x em `PainelLayoutClient.tsx`, **fora** do container de iframes dos módulos (que usa `position: absolute`) — nunca fica escondida atrás de um módulo aberto. Hidrata de `localStorage` (`src/lib/notas-tabs.ts`, chave `painel_alpha_notas_tabs_v1_user_<userId>`, mesma técnica de normalização defensiva de `painel-tabs.ts`) e do backend (`ObterWorkspaceNotas`), abas reordenáveis via `@dnd-kit/sortable` (mesma técnica de `TabBar.tsx`, `horizontalTransform`/`y:0`).

**Estado global:** `src/store/useNotasWorkspace.ts` (Zustand simples, sem middleware) — nunca guarda conteúdo integral da nota, só metadados leves de abas + `syncState` (`salvo|pendente|salvando|erro|conflito|offline`) por `noteId`.

**Editor:** `src/components/Notas/NoteEditor/NoteEditor.tsx` reaproveita a MESMA base TipTap do `SpecificationEditor.tsx` (Alpha Blueprint) — `StarterKit`/`Underline`/`Link`/`Image`/`Placeholder`/`TaskList`/`TaskItem`/`Table`+`TableRow`+`TableCell`+`TableHeader`, `immediatelyRender: false` — mais `TextStyle`+`Color`+`Highlight` (destaque/cor) e `SlashCommand` (extensão própria, comando `/`). Autosave debounce 1500ms idêntico ao Blueprint. Rascunho local em `localStorage` por `noteId`, comparado contra `baseVersion` antes de reaplicar. Controle de versão otimista real: `AtualizarNota` retorna `error: "CONFLITO_VERSAO"` se `baseVersion` não bate com `currentVersion` no servidor — o editor nunca sobrescreve, só sinaliza status `"conflito"`.

**Slash-command (`/`):** construído com `@tiptap/suggestion` + `ReactRenderer`, popup posicionado via `position: fixed` + `getBoundingClientRect()` nativo do DOM — **sem** instalar `tippy.js` (biblioteca comum para esse propósito no ecossistema TipTap). Ver decisão em `decisions.md`.

**Dependências novas** (todas pinadas em versão EXATA `3.29.1`, sem `^`, para não conflitar com `@tiptap/core@3.29.1` já usado pelo Blueprint — `@tiptap/extension-color` por padrão puxaria `3.29.2`, que exige `@tiptap/core@3.29.2`, quebrando a instalação): `@tiptap/extension-color`, `@tiptap/extension-text-style`, `@tiptap/extension-highlight`, `@tiptap/extension-mention`, `@tiptap/suggestion`.

**Atalhos** (`src/hooks/useNotasAtalhos.ts`): `Ctrl+Shift+N` (nova nota), `Ctrl+Shift+B` (toggle barra), `Ctrl+Alt+N` (Central de Notas) — confirmado sem conflito com nenhum listener de teclado existente no painel.

**Limitação conhecida:** sem credenciais de login disponíveis para teste em browser real (mesma limitação já documentada em Alpha Blueprint/Comissões) — verificação feita via `tsc`/`lint`/`build` limpos + revisão estática de Probe. Recomenda-se teste manual humano do fluxo completo antes de uso real.

### Fase 03 — Central de Notas (2026-08-07)

**Rota real:** `src/app/PainelAlpha/Notas/page.tsx` — `auth()`+`redirect("/")` sem sessão, `isAdminRole` bypass, `getPermissoesEfetivas().includes("notas")`+`redirect("/PainelAlpha")` sem permissão. Padrão idêntico a `AlphaBlueprintPage`.

**`Note` ganhou `isPinned Boolean @default(false)` + índice** — ainda no mesmo lote de schema pendente desde a Fase 01 (migration real no Turso continua bloqueada pelo Vault).

**Busca:** `BuscarNotas` (`src/actions/NotasBusca.ts`) é um contrato PRÓPRIO, separado de `ListarNotas` (Fase 01, usado pela barra global) — full-text (`title`/`plainText`/nome de etiqueta), 9 seções de filtro (RECENTES/FAVORITAS/FIXADAS/COMPARTILHADAS_COMIGO/CRIADAS_POR_MIM/EQUIPE/CONTEXTUAIS/ARQUIVADAS/LIXEIRA), paginado (mesmo contrato `{success,data,total,page,pageSize,totalPages}`). `select` da lista é leve (sem `contentJson`/`currentVersion`) — conteúdo completo só é buscado via `ObterNota` (Fase 01) quando uma nota é selecionada, com proteção de race condition (`cancelado` no cleanup do `useEffect`) e `key={notaCarregada.id}` forçando remontagem do `NoteEditor`.

**`FixarNota`:** limite de 10 notas fixadas simultâneas por usuário (constante `LIMITE_FIXADAS`), retorna erro amigável ao exceder — número escolhido e documentado, não hardcoded silenciosamente.

**Reaproveitamento do editor confirmado (ponto crítico validado por Probe):** `NoteEditor.tsx` (Fase 02) é o ÚNICO editor no projeto — a Central o importa direto, sem duplicar autosave/versão otimista/rascunho local.

**Coerência Barra Global × Central:** ambas leem/escrevem `Note` via Server Actions distintas. Desde 2026-08-11, mudanças de workspace originadas na Central sincronizam imediatamente com o shell por mensagem same-origin; não há polling nem WebSocket para conteúdo integral.

### Fase 04 — Contextos + Integração com Módulos (2026-08-07)

**`src/actions/NotasContexto.ts`:** `VincularContextoNota` (valida `podeEditarNota` + `moduleKey` existe em `MODULOS_REGISTRY` + permissão do módulo + `entidadeReferenciadaExiste` — ver achado de segurança em `decisions.md`), `RemoverContextoNota` (resolve `noteId` real a partir do `contextId` no banco, nunca confia em `noteId` do client), `ObterContagemNotasContexto`/`ListarNotasDoContexto` (sempre filtrados nota a nota por `podeVisualizarNota`, nunca `plainText`/`contentJson` no `select`).

**Componentes reutilizáveis** (`src/components/Notas/Contexto/`): `NotesContextButton` (badge+trigger, incorpora a contagem diretamente — nunca existiu um `NotesContextBadge.tsx` separado), `NotesContextPanel` (lista de notas vinculadas + criar nota já vinculada), `NoteLinkDialog` (buscar e vincular nota já existente do próprio usuário).

**`NotesSearchCommand`** (`src/components/Notas/NotesSearchCommand.tsx`): command palette isolada, construída sem `cmdk` (não instalado, nenhuma command palette existia no projeto) — `Dialog` do Radix + busca com debounce, integrada na barra global via botão de busca.

**Integração real:** apenas `chamados` (`src/components/DetalhesChamado.tsx`) — CS&NPS/Alpha Leads/Agenda Alpha ficam como pendência explícita (ver `decisions.md` para o porquê).

### Fase 05 — Colaboração, Histórico e Notificações (2026-08-07) — **migration aplicada em produção durante esta fase**

**`src/actions/NotasColaboracao.ts`:** `CompartilharNota` (valida `podeCompartilharNota` + existência do usuário destinatário — achado do Anubis, corrigido), `RemoverAcessoNota`, `ListarPermissoesNota`, `TransferirPropriedadeNota` (só dono ou Admin, valida novo dono existe), `CriarComentarioNota` (bloqueia nota `PRIVADA` exceto para o próprio dono; menções notificam só quem já tem `podeVisualizarNota`, role real buscada do banco antes da checagem), `ListarComentariosNota`, `ResolverComentario`, `ExcluirComentarioNota` (autor, Admin, ou ADMIN da nota), `ObterHistoricoVersoes`, `RestaurarVersaoNota` (chave composta `noteId_version` torna estruturalmente impossível restaurar versão de outra nota).

**Notificações real-time via Pusher** (não polling — `src/lib/notas/notificacoes.ts` + `src/store/useNotasNotificacoes.ts` + `src/hooks/useNotasNotifications.ts`): canal privado `private-notas-usuario-<id>`, mesmo padrão de `useAdminChamadosNotifications.ts`. `/api/pusher/auth` ganhou bloco de autorização idêntico ao de chamados (extrai `channelUserId` do nome do canal, compara com a sessão). Payload das notificações NUNCA inclui `plainText`/`contentJson` — só `noteId`/`noteTitle`/mensagem genérica. `NotaNotificacaoToast.tsx` usa `sonner` (não replicou o componente Framer Motion custom de Chamados — mais simples, consistente com o resto do módulo).

**Menção `@` e comando `/`** compartilham a mesma técnica de popup manual (`position: fixed` + `getBoundingClientRect`, sem `tippy.js`) — `src/components/Notas/NoteEditor/{mention-suggestion.ts,MentionList.tsx}`. **Achado de performance conhecido, não corrigido:** busca de usuário para menção chama `BuscarTodosUsuarios()` sem debounce/cache a cada keystroke (ver `decisions.md`).

**Dívida de segurança pré-existente identificada (não nova):** `BuscarTodosUsuarios` (`src/actions/RecursosHumanos.ts`) não tem `auth()`/checagem de permissão — qualquer usuário autenticado lista todos os colaboradores. Reaproveitada por `UserSearchSelect.tsx`/`mention-suggestion.ts` nesta fase, mas não é uma regressão introduzida por ela (ver `decisions.md`).

**Bug visual real corrigido:** barra global (`NotesGlobalTaskbar`) cobria a sidebar em telas `lg+` — corrigido com prop `sidebarOffsetClass`, reaproveitando a mesma variável `sidebarOffset` já usada pelo conteúdo principal em `PainelLayoutClient.tsx`.

**Última atualização:** 2026-08-07 por Scribe

---

## Módulo Alpha Metas — Justificativa de Meta (2026-08-04)

```prisma
model JustificativaMeta {
  id           String   @id @default(cuid())
  mes          Int
  ano          Int
  arquivoUrl   String
  nomeArquivo  String
  tipoArquivo  String   // sempre "application/pdf" — fixado no servidor, nunca aceito do client
  tamanhoBytes Int
  enviadoPorId Int
  enviadoPor   usuarios @relation(fields: [enviadoPorId], references: [id])
  createdAt    DateTime @default(now())

  @@index([mes, ano, createdAt])
  @@map("justificativa_meta")
}
```

**Modelo de dados:** sem `@@unique([mes, ano])` de propósito — cada upload é sempre um `create()` novo (histórico imutável, nunca update/delete de registro antigo). "Vigente" de um período é derivado via `findFirst({ where: {mes, ano}, orderBy: {createdAt: "desc"} })`, nunca um campo `ativo`/flag. Migration aplicada no Turso real via script Node pontual, validada por `PRAGMA table_info`/`PRAGMA index_list`, script descartado após uso (padrão já estabelecido no projeto).

| Tipo | Caminho | Auth | Descrição |
|------|---------|------|-----------|
| Server Action | `src/actions/JustificativaMeta.ts` | Sim | `ListarHistoricoJustificativas`, `BuscarJustificativaVigente(mes, ano)` — leitura permite `podeGerenciarMetas` OU `getPermissoesEfetivas().includes("metas")`; `RegistrarJustificativaMeta({mes, ano, url, nomeArquivo, tamanhoBytes})` — escrita exige exclusivamente `podeGerenciarMetas`. `url` validada por Zod com allowlist de domínio (`*.blob.vercel-storage.com`, fix pós-auditoria Anubis). |
| Route Handler | `POST /api/metas/justificativas/upload` | Sim, `podeGerenciarMetas` | Upload de PDF: magic bytes `%PDF` (rejeita qualquer outro tipo, incluindo DOCX, com mensagem orientando conversão), 15MB, rate limit 5/min em memória, `put()` no Vercel Blob `access: "private"` com token `METAS_READ_WRITE_TOKEN`. |
| Route Handler | `GET /api/metas/justificativas/[id]` | Sim, `podeGerenciarMetas` OU permissão `metas` | Serve o PDF via `get()` do Blob, `Content-Disposition: inline` (abre no navegador/iframe). |

**`podeGerenciarMetas(role)`** vive em `src/lib/metas-permissoes.ts` (não em `src/actions/Metas.ts`, que tem `"use server"` e só pode exportar `async function` — ver `known-errors.md`). Cobre Admin/CEO/TI (via `isAdminRole`, normalizado) + `role === "Lider Comercial"` (comparação EXATA, case/acento-sensível — assimetria real, documentada em teste).

**Última atualização:** 2026-08-04 por Scribe

## Alpha Metas — catálogo incremental de Prospecção ativa (2026-08-07)

**Server Action:** `getProspeccoesAtivas()` em `src/actions/ContratoComercial.ts`.

O canal usa `ContratoComercial.canalAquisicao = "Prospecção ativa"` e persiste sua descrição normalizada no `canalOutro` existente. A action exige sessão e papel comercial/administrativo, consulta somente `canalOutro` dos contratos desse canal, limita a leitura aos 500 registros mais recentes e devolve valores tipados, ordenados e deduplicados sem diferenciar caixa ou espaçamento. Não existe endpoint, nova tabela ou migration.

O helper `src/lib/comercial/prospeccao-ativa.ts` é a fonte única do rótulo, validação de até 200 caracteres e normalização do catálogo. `resolverOrigemParceiro()` preserva `canalOutro` somente para `Outro`, `Prospecção ativa` ou o envelope tipado de parceiro pendente; demais canais continuam limpando o campo.
## Máscara e persistência canônica de CNPJ no CRM (RM-2026-35BA39, Fases 2–3, 2026-09-04)

**Objetivo:** unificar normalização/formatação de CNPJ em todos os consumidores visuais mapeados pelo Scout na Fase 0.

`src/lib/format-cnpj.ts` passou a ser a implementação única: `normalizarCNPJ` (strip não-dígito, limita a 14), `formatarCNPJProgressivo` (máscara `00.000.000/0000-00` aplicada a cada estágio da digitação, usada em `onChange`), `formatCNPJ` (apresentação read-only, `null` se ≠14 dígitos, comportamento preservado) e `cnpjEhValido` (dígito verificador padrão CNPJ, pesos `[5,4,3,2,9,8,7,6,5,4,3,2]`/`[6,5,4,3,2,9,8,7,6,5,4,3,2]`).

**Tipo dedicado `"cnpj"`:** adicionado a `BPM_CAMPO_TIPO` (`src/lib/validations/bpm.ts`) e ao seletor de tipos em `AdminPipelineClient.tsx` (opção "CNPJ"), espelhando o precedente de `"cpf"`. `validarValoresCamposBpm` (`src/lib/bpm/campos-dinamicos.ts`) valida o dígito verificador e normaliza a 14 dígitos antes do upsert em `BpmCardCampoValor`.

**Detecção estrita (`campoBpmEhCnpj`):** exportada em `campos-dinamicos.ts` — verdadeiro para `campo.tipo === "cnpj"` ou, por compatibilidade com campos legados de texto livre (ex.: o campo "CNPJ" do pipeline Financeiro, `tipo: "texto"`), quando o nome normalizado (trim/lowercase/sem acento) é exatamente `"cnpj"`. Nomes aproximados ("Cartão CNPJ", "Contato CNPJ") não contam. `CampoBpmInput.tsx` usa essa detecção para aplicar máscara progressiva + `inputMode="numeric"` + `maxLength={18}` mesmo em campos legados tipados como texto.

**Consumidores atualizados (mesma regra em todos):**
- `CampoBpmInput.tsx` — máscara progressiva no campo dinâmico da etapa.
- `NovoCardModal.tsx` — máscara local duplicada removida; usa o utilitário compartilhado no input, na busca da Receita Federal, no submit e na formatação dos resultados de busca de empresa.
- `src/actions/bpm/Cards.ts` (`BuscarEmpresasBpm`) — normalização da busca por CNPJ usa `normalizarCNPJ` compartilhado.
- `CardAbertoLayout.tsx` (header do card), `DadosEmpresaConteudo.tsx` (gaveta "Dados da empresa") e `PerfilEmpresaModal.tsx` (perfil global aberto pelo card) — exibem `formatCNPJ(cnpj) ?? cnpj` (fallback seguro para dado legado que não feche em 14 dígitos).

**Fronteiras server-side:** `novaEmpresaCardSchema` verifica que a entrada contém exatamente 14 dígitos antes de normalizar e chegar a `CriarCardBpm`; a action usa novamente `normalizarCNPJ` antes da consulta e escrita em `Cliente.cnpj`. Dígitos excedentes são rejeitados no servidor, em vez de truncados silenciosamente. `validarValoresCamposBpm` aplica `campoBpmEhCnpj`, portanto o tipo dedicado e o campo legado com nome canônico são validados por dígito verificador e persistidos com 14 dígitos sem depender do cliente. Nenhum input de Contratos, Clientes ou outro módulo foi alterado. `pipeline-financeiro.ts` (`cnpjValido` interno, usado em `validateFinancialTransition`) também não foi tocado — sua validação financeira existente permanece intacta.

**Testes:** `tests/bpm/cnpj-mascara.test.ts` cobre normalização, máscara progressiva, apresentação, dígitos verificadores, tamanho estrito, detecção do tipo/fallback legado e wiring; `tests/bpm/criar-card-nova-empresa.test.ts` cobre normalização/rejeição na action e equivalência da busca crua/formatada; `tests/bpm/edicao-campos-card.test.ts` comprova o valor canônico enviado ao upsert pela `AtualizarCardBpm`, inclusive para campo legado, e ausência de persistência parcial em entradas incompletas ou excedentes.

**Caminho de consumo:**
```
/PainelAlpha/AlphaCRM/pipeline/[pipelineId]
  → Novo Card → cadastro de empresa nova → input CNPJ com máscara progressiva
  → card aberto → header (CNPJ formatado) → "Dados da empresa" / perfil global (CNPJ formatado)
  → aba Formulário da Etapa → campo dinâmico tipo CNPJ (ou legado nome "CNPJ") → máscara progressiva + validação de dígito verificador no save
  → admin do pipeline → criar/editar campo → seletor de tipo → opção "CNPJ"
```

**Última atualização:** 2026-09-04 por Echo (sessão Bibble, RM-2026-35BA39, Fase 3)

## Equipes privadas de notas (2026-08-12)

O módulo de Notas possui equipes privadas reutilizáveis. `NoteTeam` define o criador, `NoteTeamMember` mantém um papel por membro (`LEITOR`, `COMENTARISTA`, `EDITOR`, `ADMIN`) e `NoteTeamShare` relaciona equipes e notas por FKs reais. O criador é `ADMIN` implícito e é o único gestor da equipe; o papel `ADMIN` de um membro vale para a nota e não delega gestão da equipe. O acesso efetivo escolhe sempre o papel mais permissivo entre propriedade, usuário, setor/role e todas as equipes.

## Distribuição e Oportunidades (RM-2026-6B5F7C) — implementação revertida, ver Motor de Automações

Uma primeira implementação standalone (`BpmDistribuicaoConfig`/`BpmOportunidadeRegra`/`BpmOportunidadeDetectada`, migration `20260904171000_bpm_distribuicao_oportunidades`) foi construída e depois **revertida em 2026-09-04** — descoberta de duplicação: o Motor de Automações já implementa a mesma funcionalidade de forma mais integrada em `src/lib/bpm/automacoes/distribuicao-oportunidades.ts` (ações `DISTRIBUICAO_AUTOMATICA`/`OPORTUNIDADE_IDENTIFICADA` do `BpmAutomacao`, ver `distribuicao-motor.ts` e `schemas.ts` no mesmo diretório), consistente com o pedido original de "integrada ao Motor Central de Automações". Tabelas dropadas (vazias, sem dado real), código e rotas removidos. Referência válida para RM-2026-6B5F7C é a implementação em `src/lib/bpm/automacoes/`.

**Última atualização:** 2026-09-04 por operador humano via Claude Code (reversão)

## Histórico, Conhecimento e Pendências (RM-2026-D6D970, 2026-09-04)

Timeline unificada do card **já existia** antes desta entrega (`src/lib/bpm/timeline.ts` + aba "Histórico" em `PainelHistorico.tsx`), fundindo `BpmCardHistorico` (auditoria completa: quem/quando/ação/valor anterior/valor novo/origem via `automacaoOrigem`) e anotações — todo módulo (tarefas, checklists, automações, distribuição, oportunidades, cadências) já escreve nela via `registrarHistoricoCard`. Em paralelo, o Codex construiu uma segunda via mais abrangente (`PainelTimelineCard.tsx`, nova aba "Timeline", consumindo `src/actions/bpm/Timeline.ts`/`src/lib/timeline/extractors/card.ts` — que fundem também tarefas, checklists, automações e SLA diretamente, além do histórico) — mantida como a referência de timeline completa; a aba "Histórico" original permanece intocada.

Dois entregáveis genuinamente novos, sem duplicar dado: `BpmPipelineConhecimentoLink` (migration aditiva `20260904174200_bpm_pipeline_conhecimento_link`) — links de materiais relevantes por pipeline, exibidos no card (`PainelConhecimentoRelacionado.tsx`) e geridos em `/PainelAlpha/AlphaCRM/admin/conhecimento`; e `src/lib/bpm/pendencias/motor.ts` (`listarPendenciasBpm`) — Central de Pendências em `/PainelAlpha/AlphaCRM/pendencias`, consolidando tarefas pendentes, próximo contato vencido, checklists incompletos, campos obrigatórios faltantes e alertas de SLA (fail-open enquanto RM-2026-095B40 não estiver em produção), sem tabela nova.

**Última atualização:** 2026-09-04 por operador humano via Claude Code (RM-2026-D6D970)

## Motor Central de Automações — Fase 3: schema aditivo fechado, bloqueado por aprovação de banco (RM-2026-D100EB, 2026-09-04)

A story `docs/stories/story-rm-2026-d100eb-motor-central-automacoes.md` agora existe (resolve o `AUTO_ADJUSTMENT_REQUIRED` das fases 0–2 sobre ausência de story) e define regras funcionais, gatilhos, ações e a lista de tabelas propostas, mas deixa explícito que "os nomes e campos definitivos devem ser fechados pela fase de dados" e que a migration exige backup específico e aprovação explícita antes de qualquer SQL remoto.

### Desenho aditivo fechado nesta fase (não aplicado)

Base real consultada em `prisma/schema.prisma:3944` (`BpmAutomacao`) e `:3969` (`BpmAutomacaoExecucao`). Todas as tabelas novas são aditivas; nenhuma coluna existente é removida ou renomeada.

- `BpmAutomacaoVersao` — `id`, `automacaoId` (FK `BpmAutomacao`, `onDelete: Restrict` para preservar auditoria), `numero` (Int sequencial), `status` (`RASCUNHO|ATIVA|ARQUIVADA`), `gatilhoTipo`, `gatilhoConfigJson`, `grafoJson` (nós `ACAO/CONDICAO/ESPERA/FIM`, reutilizando o AST do Motor de Regras dentro dos nós `CONDICAO`), `recorrenciaJson?`, `timezone?`, `criadoPorId`, `ativadaEm?`, `createdAt`, `updatedAt`. `@@unique([automacaoId, numero])`, `@@index([automacaoId, status])`.
- `BpmEventoDominio` — outbox: `id`, `tipo`, `entidadeTipo`, `entidadeId`, `cardId?`, `pipelineId?`, `valorAnteriorJson?`, `valorNovoJson?`, `atorTipo`, `atorUserId?`, `atorExecucaoId?`, `ocorridoEm`, `correlationId`, `causationId?`, `profundidade` (Int default 0), `idempotencyKey` (`@unique`), `processadoEm?`, `createdAt`. `@@index([correlationId])`, `@@index([tipo, processadoEm])`, `@@index([cardId])`.
- `BpmAutomacaoExecucao` (evolução aditiva, colunas novas nullable) — `automacaoVersaoId String?` (FK `BpmAutomacaoVersao`), `eventoId String?` (FK `BpmEventoDominio`), `correlationId String?`, `causationId String?`, `claimToken String?`, `proximaTentativaEm DateTime?`. Mantém `@@unique([automacaoId, eventoChave])` existente; adiciona `@@unique([automacaoVersaoId, eventoId])` (SQLite trata `NULL` como distinto, portanto não colide com execuções legadas sem versão/evento).
- `BpmAutomacaoPassoExecucao` — auditoria por nó: `id`, `execucaoId` (FK `BpmAutomacaoExecucao`, `onDelete: Cascade`), `noId`, `tipo`, `status`, `entradaJson?`, `resultadoJson?`, `erroSanitizado?`, `tentativa` (Int default 1), `iniciadoEm?`, `concluidoEm?`, `createdAt`. `@@unique([execucaoId, noId, tentativa])`.
- `BpmAutomacaoAgenda` — espera/recorrência persistente: `id`, `automacaoVersaoId` (FK), `cardId?`, `execucaoId?`, `tipo` (`ESPERA|RECORRENCIA`), `proximaExecucaoEm`, `timezone`, `recorrenciaJson?`, `ativo` (default true), `createdAt`, `updatedAt`. `@@index([proximaExecucaoEm, ativo])`.
- `BpmWebhookEndpoint` — `id`, `automacaoId?` (FK opcional), `nome`, `urlPath` (`@unique`), `segredoHash` (nunca texto plano), `headersPermitidosJson?`, `ativo` (default true), `criadoPorId`, `createdAt`, `updatedAt`.
- `BpmWebhookEntrada` — auditoria de recebimento: `id`, `endpointId` (FK), `idempotencyKey`, `origemIp?`, `headersSanitizadosJson?`, `payloadSanitizadoJson?`, `status`, `processadoEm?`, `eventoId?` (FK `BpmEventoDominio`), `createdAt`. `@@unique([endpointId, idempotencyKey])`.
- `BpmAutomacaoLease` — lease distribuído com fencing: `id`, `chave` (`@unique`, ex.: `cardId`/`correlationId`), `titular`, `fencingToken` (Int incremental), `expiraEm`, `createdAt`, `updatedAt`. `@@index([expiraEm])`.

Nenhum `DROP`, renomeação ou backfill mutante é necessário; todas as FKs para entidades auditáveis usam `Restrict`/preservação, nunca cascade que apague histórico.

### Por que a fase encerra bloqueada

Não há comprovante específico de aprovação administrativa para esta mudança estrutural nesta sessão (execução autônoma, sem interação em tempo real) — `mandatoryAdministratorFeedback` chegou vazio. O backup mais recente em `database-backups/pre-change/` (`painelalpha_turso_pre_change_2026-09-04T18-13-55-446Z.sql`, dentro da janela de 48h, verificado: 282 tabelas, 68.332 linhas, SHA-256 `2665112c...`) foi gerado para outra mudança (RM-2026-095B40) e não é um backup específico desta migration. Conforme a política do projeto, aprovação genérica, silêncio ou backup de outra mudança não autorizam a aplicação do DDL. Nenhum arquivo de schema, migration ou dado no Turso foi alterado.

**Pendência para a reexecução autorizada desta fase:** apresentar este relatório ao administrador, obter confirmação explícita e específica, gerar backup pré-mudança dedicado a esta migration, aplicar o DDL aditivo acima, validar estrutura/índices/FKs no Turso real e só então liberar as Fases 4-5 (domínio/runtime) da story.

**Arquivos afetados:** nenhum arquivo de produção nem `prisma/schema.prisma`; `.bibble/memory/architecture.md` (este registro).

**Última atualização:** 2026-09-04 por Vault (RM-2026-D100EB, Fase 3)

## Gestão de Tarefas e Cadências — UI e consumo no card (RM-2026-97CC60, Fase 4, 2026-09-04)

O backend de cadências (`BpmCadencia`/`BpmCadenciaPasso`/`BpmCardCadencia`/`BpmCadenciaPassoExecucao`, `src/lib/bpm/cadencias/executor.ts`, `src/actions/bpm/Cadencias.ts`, cron em `src/app/api/bpm/jobs/automacoes/route.ts`) já existia e passava nos testes antes desta fase. Faltava apenas a superfície de uso: admin `/PainelAlpha/AlphaCRM/admin/cadencias` (`CadenciasWorkspace.tsx`/`CadenciaFormDialog.tsx`, CRUD de cadências e passos) e uma nova aba "Cadências" em `PainelHistorico.tsx` (`PainelCadenciasCard.tsx`) que lista vínculos do card por status (ATIVA/PAUSADA/CONCLUIDA/CANCELADA), inicia nova cadência a partir de um `Select` das cadências ativas, e permite pausar/reativar/cancelar. Nenhuma alteração de schema; nenhuma migration nova.

Ficaram deliberadamente fora desta rodada (arquivos em edição ativa por trabalho paralelo no mesmo repositório): integração da ação `INICIAR_CADENCIA` no Motor de Automações (`src/lib/bpm/automacoes/executor.ts`/`schemas.ts`) e interrupção automática de cadência ao preencher "Próximo Contato" no card — hoje só manual via botão. Central de tarefas com filtro por cadência também não foi implementada.

**Última atualização:** 2026-09-04 por operador humano via Claude Code (RM-2026-97CC60, Fase 4)
## Gestão de Prazos, SLA e Alertas — motor temporal (RM-2026-095B40, Fase 2, 2026-09-04)

`src/lib/bpm/sla.ts` implementa prazo em minutos/horas/dias/dias úteis, limites configuráveis, provisionamento idempotente por card/tarefa, pausa com congelamento e retomada que acumula milissegundos e desloca o deadline. O status é recalculado on-read e persiste transições na trilha `BpmSlaEventoLog`, sem disparar notificação ou automação.

`src/actions/bpm/Sla.ts` expõe criação e leitura com Zod, auth e ownership. `MoverCardBpm` sincroniza SLA dentro da mesma transação do card: conclui a instância da etapa anterior, cria a da etapa de destino e pausa/retoma ao atravessar `Standby - Follow Up`.

AUTO_ADJUSTMENT_REQUIRED: Kanban e modal ainda não consomem `ObterStatusSlaCard`; CRUD administrativo e alertas/automações pertencem às fases seguintes.
AUTO_ADJUSTMENT_ACCEPTANCE: badge semântico e tempo restante aparecem no card fechado/modal usando a action autoritativa, sem cálculo duplicado no client.

DELIVERY_READY: `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → `MoverCardBpm` → `sincronizarSlaMovimentoBpm` → `BpmSlaInstancia`/`BpmSlaEventoLog`; leitura autenticada por `ObterStatusSlaCard`/`ObterStatusSlaTarefa`.
# Gestão de SLA — UI administrativa (RM-2026-095B40, Fase 3, 2026-09-04)

O CRUD administrativo usa as tabelas SLA definitivas sem nova migration. A rota protegida `/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]` carrega configurações e serviços no servidor e monta `SlaConfigSection`. `SlaConfigForm` compartilha `slaConfiguracaoAdminSchema` com as Server Actions e permite configurar escopo, prazo, início, pausa em Standby e os limites amarelo/vermelho, com preview imediato.

O save reconcilia configuração e dois limites na mesma transação, com autenticação e gate administrativo repetidos dentro dela. Exclusão é aceita apenas quando não existem instâncias; depois do primeiro uso, a configuração deve ser desativada para preservar histórico.

DELIVERY_READY: Alpha CRM → Configurações → pipeline → seção **SLA e Alertas** → criar/editar/ativar/desativar/excluir configuração ainda não utilizada → recarregar a rota e reencontrar os dados persistidos.

AUTO_ADJUSTMENT_REQUIRED: Kanban e modal ainda não consomem `ObterStatusSlaCard`; alertas/automações operacionais pertencem às próximas fases.
AUTO_ADJUSTMENT_ACCEPTANCE: card com SLA exibe badge e tempo restante autoritativos no board/modal e cruza cada limiar uma única vez no worker.

## Motor Central de Automações — arquitetura final (RM-2026-D100EB)

O Alpha CRM usa uma outbox transacional (`BpmEventoDominio`) como entrada
canônica do motor. Produtores de card, campo, responsável, tarefa, membros e
vínculos publicam na mesma transação da mudança. O materializador seleciona as
versões ativas compatíveis e cria no máximo uma execução por
`automacaoVersaoId + eventoId`.

O runtime interpreta somente grafos validados `ACAO/CONDICAO/ESPERA/FIM`;
condições delegam ao Motor de Regras existente. Claims CAS e leases com fencing
serializam efeitos por card, enquanto passos, tentativas, agendas, correlação e
causalidade permanecem persistidos. O executor legado continua isolado para
execuções sem versão central e é reutilizado por adaptadores controlados.

Entradas externas passam por endpoint com segredo hash, idempotência e limites.
Saídas HTTP passam pelo cliente seguro que exige HTTPS, revalida redirects e
DNS, recusa redes privadas/headers sensíveis e limita tempo e tamanho. Operação
ocorre pela rota admin, cron existente e CLI `bpm:automacoes`.

**Última atualização:** 2026-09-04 por Codex (RM-2026-D100EB, Fases 4–17)

## Gestão de Prazos, SLA e Alertas — entrega operacional (RM-2026-095B40, 2026-09-04)

O SLA passou a ser um fluxo transacional e orientado a eventos. Os momentos `CRIACAO_CARD`, `PRIMEIRA_VISUALIZACAO`, `ENTRADA_ETAPA`, `CRIACAO_TAREFA` e `TAREFA_CONCLUIDA` provisionam ou encerram instâncias pelo domínio em `src/lib/bpm/sla.ts`. A mudança de estado persiste log, usa `BpmSlaDisparo` como trava idempotente para amarelo/vermelho e publica `SLA_STATUS_ALTERADO` na outbox `BpmEventoDominio` dentro da mesma transação. O Motor Central filtra esse evento por status e a deduplicação de correlação só considera execuções efetivamente materializadas.

O Kanban usa leitura em lote e exibe badge com cor configurada, contagem regressiva e destaque de atraso; o modal apresenta deadline e histórico de pausas. Em Standby, somente SLAs configurados para pausa são congelados e, na retomada, o tempo pausado desloca o deadline. O E2E real isolado comprovou verde → amarelo → vermelho, disparos únicos, automação executada, criação de tarefa e retomada com 30 minutos de deslocamento.

**Última atualização:** 2026-09-04 por Codex (RM-2026-095B40)
