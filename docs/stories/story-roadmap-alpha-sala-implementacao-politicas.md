# Story: Roadmap Alpha — Sala de Implementação e motor de políticas

## Status

Approved

## Executor Assignment

- executor: `@dev`
- quality_gate: `@architect`
- quality_gate_tools: `["lint", "typecheck", "test", "build", "coderabbit", "security-review", "runtime-e2e"]`

## Story

**Como** administrador do Painel Alpha,
**quero** conversar com os agentes e decidir solicitações de uma implementação na própria Produção do Roadmap, com políticas automáticas para ações seguras e bloqueios explícitos para ações críticas,
**para que** uma fase que dependa de informação ou autorização humana aguarde minha resposta e continue do ponto correto, sem repetir dezenas de vezes a mesma falha nem ampliar permissões indevidamente.

## Contexto e valor

A Produção já executa objetivos localmente, persiste estado em `.roadmap-production/`, mostra atividades por polling e permite pausar, retomar, tentar novamente ou relatar um erro global. Porém, o contrato de resultado aceita somente `PASS`, `FAIL` ou `BLOCKED`; o Claude roda em `dontAsk`; um bloqueio corrigível pode repetir até 30 vezes; e `REPORT_ERROR` reenfileira todas as fases. No incidente `RM-2026-CB8371`, uma fase de backend foi resolvida para Nova e repetiu a mesma lacuna até `AGENT_BLOCKED` atingir o limite.

Esta story adiciona um canal administrativo por objetivo e um motor determinístico de políticas/roteamento. Ela preserva a arquitetura local, a autoridade dos agentes e o princípio `CLI First -> Observability Second -> UI Third`.

## Decisões autônomas

- `[AUTO-DECISION] Como entregar a Sala sem violar CLI First? → Criar primeiro contratos, comandos CLI e comportamento do worker; a UI apenas observa e envia os mesmos comandos locais. (reason: princípio I da Constitution)`
- `[AUTO-DECISION] Onde persistir conversas e intervenções? → No estado local versionado de `.roadmap-production/`, sem banco ou migration. (reason: a Produção existente já usa esse armazenamento canônico local e a story-base proíbe migration para esse subsistema)`
- `[AUTO-DECISION] Quando abrir o circuit breaker? → Na terceira falha consecutiva com a mesma impressão digital. (reason: impede a repetição observada de 30 tentativas e ainda tolera uma recuperação transitória)`
- `[AUTO-DECISION] Como tratar segredos? → A Sala pode autorizar o uso de uma credencial já configurada, mas nunca recebe, persiste ou exibe o valor da credencial. (reason: manter sanitização e não transformar o histórico em cofre de segredos)`
- `[AUTO-DECISION] Como tratar banco, ação destrutiva e Git remoto? → Bloqueio rígido; aprovação genérica da Sala não libera essas ações. Banco exige o protocolo Vault, e push/PR/release continuam exclusivos de DevOps. (reason: AGENTS.md e Constitution)`
- `[AUTO-DECISION] accumulated-context.md → O arquivo não existe no workspace, inclusive na busca com arquivos ignorados; a coerência acumulada foi derivada das três stories anteriores do Roadmap e do código atual. (reason: não criar um segundo artefato fora da responsabilidade desta missão)`

## Critérios de aceitação

1. O domínio reconhece `NEEDS_INPUT` como resultado estruturado de agente, `NEEDS_INPUT` como estado de fase e `WAITING_FOR_ADMIN` como estado da execução; respostas antigas continuam legíveis por uma migração local compatível, sem alterar banco, Prisma ou migrations.
2. Um resultado `NEEDS_INPUT` contém, por contrato estrito, identificador da solicitação, fase, categoria (`PERMISSION | DECISION | CREDENTIAL | EXTERNAL_ACTION | DATABASE | DESTRUCTIVE | GIT_REMOTE`), pergunta, ação pretendida, justificativa/risco e opções permitidas; texto desconhecido ou incompleto não é tratado como autorização.
3. Ao receber `NEEDS_INPUT`, o worker encerra com segurança a chamada corrente, persiste a pergunta e muda somente a fase para `NEEDS_INPUT` e a execução para `WAITING_FOR_ADMIN`, sem consumir retry, sem manter processo CLI aberto e sem iniciar outra fase do mesmo objetivo.
4. A resposta administrativa é um comando local idempotente vinculado a `executionId`, `phaseNumber` e `requestId`; respostas duplicadas, obsoletas, de outra fase ou de uma solicitação já resolvida são rejeitadas com código público específico e não alteram estado.
5. Uma resposta válida registra autor, data, conteúdo/decisão e vínculo com a pergunta; resolve a intervenção, recoloca somente a fase solicitante em `PENDING` e a execução em `PENDING`, preservando fases concluídas, tentativas de outras fases, relatórios e mensagens anteriores.
6. A nova tentativa recebe a pergunta e a resposta administrativas no contexto, além dos resumos existentes; após concluir a fase, o fluxo segue normalmente para a próxima fase dependente.
7. Se o administrador negar uma ação sensível, a fase termina `BLOCKED` com `ADMIN_DENIED`, não entra em autocorreção e mantém a decisão visível no histórico.
8. O CLI oferece comandos JSON para listar intervenções pendentes e o histórico de uma execução, responder uma pergunta, autorizar/negar uma ação, enviar mensagem à fase elegível e trocar o agente da fase; validações e transições são as mesmas usadas pela UI.
9. O comando de mensagem livre aceita somente uma fase `RUNNING`, `NEEDS_INPUT`, `PENDING` ou `BLOCKED`; mensagem para fase concluída é somente leitura e não reabre trabalho implicitamente. Mensagem recebida durante `RUNNING` é registrada e aplicada no próximo limite seguro, sem matar o processo em andamento.
10. Dentro de Produção, cada objetivo possui o botão **Acompanhar implementação**, com badge da quantidade de intervenções pendentes e indicação visual de `WAITING_FOR_ADMIN`.
11. A Sala de Implementação abre por objetivo e apresenta, em ordem cronológica: fases e estados, mensagens de agente/admin/sistema, perguntas e respostas, agente solicitado/resolvido e trocas, atividades, arquivos alterados, gates executados e erros sanitizados; a seleção de fase filtra a conversa sem perder o histórico completo.
12. Administradores autorizados podem, na Sala, responder, autorizar, negar, pausar/retomar a execução e trocar o agente da fase; usuários sem `canManage` visualizam o histórico, mas não veem controles mutáveis. A feature gate local e a autorização server-side existentes continuam obrigatórias.
13. Os formulários da Sala exibem claramente ação, escopo, risco e duração da autorização, têm estados de envio/erro/sucesso, navegação por teclado, foco controlado e anúncio acessível de novas perguntas; conteúdo longo permanece legível em desktop e mobile.
14. O motor classifica ações em `SAFE`, `SENSITIVE` e `FORBIDDEN`: ações `SAFE` usam automaticamente apenas as tools já allowlisted; ações `SENSITIVE` criam intervenção explícita; ações `FORBIDDEN` nunca são executadas por aprovação genérica.
15. São `SAFE`, quando confinadas ao workspace e ao escopo da fase: listar/buscar/ler arquivos não protegidos, criar/editar extensões já allowlisted em caminhos graváveis e executar gates enumerados (`git status`, `git diff`, ESLint, typecheck e testes permitidos). Entrada do prompt não pode reclassificar uma ação.
16. São `SENSITIVE`, no mínimo: instalar dependência, acessar rede ou serviço externo, usar credencial já configurada e executar comando elevado. A autorização é de uso único, ligada à ação normalizada e à fase, expira ao terminar a tentativa e não habilita shell arbitrário, bypass global ou ferramentas adicionais.
17. São `FORBIDDEN`: alteração de `prisma/schema.prisma`, migrations, schema/índices/constraints/seeds/backfills, mutação em massa, comando destrutivo/recursivo, escrita fora do workspace ou em caminho protegido, alteração de HEAD, commit, push, PR, release e tag. A Sala mostra o protocolo correto e não oferece botão genérico de autorização.
18. Solicitação de banco cria intervenção de política com orientação para Vault, backup completo verificado de até 48 horas, impacto/riscos/rollback e confirmação explícita fora da automação; nenhuma resposta comum da Sala transforma essa solicitação em execução. Push/PR/release direcionam para DevOps e permanecem fora do executor do Roadmap.
19. O roteamento Nova/Echo usa tokens com limites de palavra e prioridade determinística: marcador explícito de capacidade, agente solicitado/tag estruturada, título da fase, depois corpo. `ui` dentro de palavras como `requisitos` não classifica frontend; backend/API/route handler/worker resolvem para Echo e frontend/React/componente/layout resolvem para Nova.
20. `CAPABILITY_ESCALATION_REQUIRED: BACKEND` promove a fase para Echo e `...: FRONTEND` para Nova, preservando diagnóstico e histórico. Troca manual só aceita agente instalado e compatível; toda troca é auditada e reinicia a impressão digital do circuito.
21. Cada falha gera impressão digital sanitizada e estável composta por fase, agente resolvido, código de erro e causa normalizada. Na terceira ocorrência consecutiva idêntica, o circuit breaker impede nova chamada, abre intervenção, muda fase/execução para espera administrativa e informa causa, tentativas e próximo passo.
22. A impressão digital é reiniciada somente quando muda agente, contexto relevante, política/autorização ou resposta administrativa; passagem de tempo, reinício do worker e cooldown não reiniciam o circuito. Falhas transitórias de provider mantêm o fallback Claude/Codex existente e são contabilizadas separadamente.
23. Nenhum fluxo pode repetir a mesma causa 30 vezes. O limite absoluto existente permanece como última barreira, mas o circuito interrompe causas idênticas antes disso; `REPORT_ERROR` global continua disponível e não substitui a resposta localizada da Sala.
24. Histórico, perguntas, respostas, autorizações e erros são limitados, sanitizados e nunca incluem token, header, URL autenticada, `.env`, prompt integral sensível ou valor de credencial; logs e relatório final registram decisões e rework sem expor segredos.
25. Reinício do worker preserva `WAITING_FOR_ADMIN`, mensagens, intervenção pendente, circuit breaker e autorização ainda não consumida; não transforma espera humana em `WORKER_INTERRUPTED_RETRY` e não duplica solicitações.
26. Testes unitários e de integração cobrem contratos/transições, idempotência, retomada de uma única fase, política, regressão Nova/Echo, circuit breaker, reinício e sanitização; teste de UI cobre permissões e interação principal; lint, typecheck, testes, build e CodeRabbit não apresentam regressão causada pela story.

## Fora do escopo

- Criar chat geral desacoplado de objetivo/fase ou substituir o Bibble Chat.
- Armazenar conversas no banco, alterar `prisma/schema.prisma` ou aplicar migration.
- Inserir segredos, tokens ou credenciais pela Sala.
- Dar bypass irrestrito de sandbox, habilitar shell arbitrário ou ampliar permissão de forma permanente.
- Executar commit, push, PR, release, tag, migration ou mutação destrutiva pelo worker.
- Reabrir automaticamente uma fase `SUCCEEDED` por mensagem livre.

## Tarefas / Subtarefas

- [ ] **Task 1 — Fechar contratos locais e compatibilidade de estado** (AC: 1–7, 21, 24, 25)
  - [ ] Adicionar estados, schemas estritos de mensagem/intervenção/resposta/autorização e campos de circuit breaker.
  - [ ] Definir migração local idempotente do estado atual para o novo contrato e limites de retenção/tamanho.
  - [ ] Definir parser estruturado de `RESULT: NEEDS_INPUT` sem aceitar texto ambíguo como consentimento.
  - [ ] Testar round-trip, estado legado, payload inválido, sanitização e resposta duplicada.

- [ ] **Task 2 — Implementar o motor de políticas antes da interface** (AC: 14–18, 24)
  - [ ] Centralizar a classificação `SAFE | SENSITIVE | FORBIDDEN` em módulo server-only, sem regras duplicadas em prompt ou componente.
  - [ ] Mapear as tools allowlisted atuais para `SAFE` e exigir solicitação estruturada para ações `SENSITIVE`.
  - [ ] Manter banco/destrutivo/Git remoto fora da autorização comum, com códigos e instruções específicas para Vault/DevOps.
  - [ ] Garantir autorização de uso único, escopo exato, expiração e consumo atômico.
  - [ ] Testar prompt injection, path traversal, tentativa de ampliar tool, reuse de autorização e não vazamento de segredo.

- [ ] **Task 3 — Corrigir roteamento e adicionar circuit breaker** (AC: 19–23)
  - [ ] Substituir regex de substring por classificação com tokens delimitados e precedência determinística.
  - [ ] Interpretar marcadores `CAPABILITY_ESCALATION_REQUIRED` para Nova/Echo e auditar troca manual/automática.
  - [ ] Calcular impressão digital sanitizada e interromper a terceira falha consecutiva idêntica.
  - [ ] Preservar fallback de provider, resetar circuito apenas por mudança relevante e impedir retry após `ADMIN_DENIED`.
  - [ ] Adicionar testes de regressão com “requisitos”, fase de backend, fase frontend, marcador explícito e reinício do worker.

- [ ] **Task 4 — Entregar comandos CLI e transições do worker** (AC: 3–9, 21, 25)
  - [ ] Adicionar comandos CLI para `interventions`, `history`, `respond`, `authorize`, `deny`, `message` e `switch-agent`, com saída JSON e exit codes estáveis.
  - [ ] Estender a fila atômica de comandos com `phaseNumber/requestId`, idempotência e mensagens públicas específicas.
  - [ ] Fazer `NEEDS_INPUT -> WAITING_FOR_ADMIN -> PENDING` retomar somente a fase e injetar o diálogo no próximo contexto.
  - [ ] Tratar mensagem durante execução no próximo limite seguro e preservar espera após restart.
  - [ ] Atualizar scripts npm e runbook do Roadmap.

- [ ] **Task 5 — Construir a Sala de Implementação sobre o domínio pronto** (AC: 10–13, 24)
  - [ ] Adicionar botão/badge por objetivo e uma lateral/dialog responsiva separada do componente principal.
  - [ ] Renderizar timeline e filtro por fase com mensagens, intervenções, atividades, arquivos, gates e trocas de agente.
  - [ ] Conectar responder/autorizar/negar/mensagem/pausa/retomada/troca às mesmas Server Actions e comandos do CLI.
  - [ ] Aplicar `canManage`, feature gate, feedback acessível, foco, teclado, loading e prevenção de duplo envio.
  - [ ] Manter polling atual de 2 segundos e preservar conteúdo local digitado durante refresh.

- [ ] **Task 6 — Verificar fluxo completo e atualizar rastreabilidade** (AC: 1–26)
  - [ ] Executar cenário controlado `RUNNING -> NEEDS_INPUT -> WAITING_FOR_ADMIN -> resposta -> mesma fase -> SUCCEEDED` e comprovar que fases concluídas não reiniciaram.
  - [ ] Executar cenário de três falhas idênticas e comprovar abertura do circuito sem quarta chamada.
  - [ ] Executar cenários `SAFE`, `SENSITIVE`, banco, destrutivo e push, confirmando os limites de autoridade.
  - [ ] Rodar ESLint direcionado, `npm run typecheck`, testes direcionados, `npm test` e `npm run build`; separar regressões da story de baselines externos.
  - [ ] Rodar CodeRabbit e registrar achados CRITICAL/HIGH conforme a configuração.
  - [ ] Atualizar checklist, Change Log, Completion Notes e File List real antes de revisão.

## Dev Notes

### Arquitetura e integração existentes

- A Produção é local, mantém configuração/telemetria em `.roadmap-production/`, deixa mudanças no working tree e não permite Git remoto. [Source: `docs/stories/story-roadmap-alpha-producao-local-bibble.md#decisões`]
- A Constituição exige que domínio e CLI funcionem antes da UI; dashboards observam e enviam comandos, mas não hospedam a inteligência decisória. [Source: `.aiox-core/constitution.md#i-cli-first-non-negotiable`]
- Estado e comandos locais já usam JSON validado por Zod e escrita temporária seguida de rename; reutilizar essa fronteira para conversa/intervenção. [Source: `src/lib/roadmap-production/storage.ts:92`; `src/lib/roadmap-production/storage.ts:169`]
- Hoje os estados não incluem espera humana e o comando `REPORT_ERROR` exige feedback global; a mudança precisa ser retrocompatível com o estado atual estrito. [Source: `src/lib/roadmap-production/contracts.ts:16`; `src/lib/roadmap-production/contracts.ts:33`]
- O worker já aplica comandos antes do claim, e `RETRY` localiza uma fase falha enquanto `REPORT_ERROR` reenfileira todas; a resposta da Sala deve seguir o primeiro padrão, com vínculo obrigatório à solicitação. [Source: `src/lib/roadmap-production/worker.ts:515`]
- O retry automático atual permite 30 correções e considera `AGENT_BLOCKED` recuperável para implementação; o circuito deve atuar antes desse limite. [Source: `src/lib/roadmap-production/worker.ts:35`; `src/lib/roadmap-production/worker.ts:796`]
- A regex atual testa `ui` sem limite de palavra antes de backend, causando falso positivo em conteúdo como “requisitos”. [Source: `src/lib/roadmap-production/agents.ts:67`]
- Codex já usa sandbox `read-only/workspace-write`; Claude usa tools limitadas, MCP vazio e `dontAsk`. A Sala deve provocar uma nova execução depois da decisão, não tentar conversar com um processo CLI bloqueado. [Source: `src/lib/roadmap-production/cli-providers.ts:460`]
- As tools confinadas já bloqueiam paths protegidos, schema/migrations e shell fora dos gates enumerados. O novo módulo de política deve centralizar e tornar explícitas essas regras, não afrouxá-las. [Source: `src/lib/roadmap-production/tools.ts:11`; `src/lib/roadmap-production/tools.ts:107`; `src/lib/roadmap-production/tools.ts:258`]
- A action de leitura já filtra por módulo, enriquece fases com Markdown e exige acesso à Produção; ações mutáveis existentes exigem `canMutate`. [Source: `src/actions/RoadmapProduction.ts:75`; `src/actions/RoadmapProduction.ts:209`]
- O painel atual faz polling a cada 2 segundos, apresenta atividades/feedback e já usa Dialog; preservar esse mecanismo e separar a Sala para não ampliar o arquivo principal de forma monolítica. [Source: `src/components/RoadmapAlpha/RoadmapProductionPanel.tsx:185`; `src/components/RoadmapAlpha/RoadmapProductionPanel.tsx:238`]

### Modelo mínimo de domínio

- **Mensagem:** ID, execução, fase, autor/role (`AGENT | ADMIN | SYSTEM`), tipo, conteúdo sanitizado, data e `requestId` opcional.
- **Intervenção:** ID/requestId, fase, categoria, pergunta, ação normalizada, risco, opções, status, datas e resolução administrativa; credenciais são somente referências redigidas, nunca valores.
- **Circuito:** fingerprint sanitizada, contagem consecutiva, primeira/última ocorrência e motivo de reset.
- **Autorização:** referência à intervenção, decisão, ação normalizada, escopo de fase, expiração/consumo; não é uma lista permanente de permissões.
- Os nomes finais podem ser ajustados pelo executor, desde que o contrato preserve todos os campos e invariantes dos ACs.

### Segurança e transições

```text
RUNNING --RESULT: NEEDS_INPUT--> phase NEEDS_INPUT + execution WAITING_FOR_ADMIN
WAITING_FOR_ADMIN --ANSWER/AUTHORIZE--> mesma phase PENDING + execution PENDING
WAITING_FOR_ADMIN --DENY--> mesma phase BLOCKED (ADMIN_DENIED)
falha com fingerprint idêntica x3 --> NEEDS_INPUT/WAITING_FOR_ADMIN (CIRCUIT_OPEN)
```

- A UI nunca altera arquivos de estado diretamente; somente Server Actions autenticadas enfileiram comandos validados.
- Responder não mata processo. O provider precisa encerrar a chamada com resultado estruturado; a nova tentativa começa depois de o comando ser aplicado.
- A aprovação não pode alterar a Constitution nem a matriz de autoridade. Banco e Git remoto permanecem fora do executor.
- Não há variável de ambiente nova prevista. Se a implementação descobrir necessidade, documentar e submeter à revisão antes de adicioná-la.
- Não há `docs/architecture/`, `docs/framework/`, `.aiox/gotchas.json` ou `accumulated-context.md` neste workspace. As fontes disponíveis e as stories anteriores foram resumidas acima; isso não autoriza inventar tecnologia ou requisito.

### Testing

- Framework existente: Vitest em `tests/roadmap-production/`; manter testes determinísticos, filesystem temporário e providers mockados.
- Unitários: schemas/migração local, parser `NEEDS_INPUT`, policy matrix, autorização one-shot, fingerprint/reset, roteamento com word boundaries e sanitização.
- Integração: fila de comandos, resposta idempotente, retomada exclusiva da fase, mensagem em limite seguro, restart em espera, fallback de provider e circuit breaker sem quarta chamada.
- Frontend: visibilidade por `canManage`, badge, filtro/timeline, duplo envio, preservação do texto durante polling, teclado/foco e estados responsivos.
- Runtime controlado: nenhuma migration/commit/push; comprovar que pergunta e resposta aparecem no histórico e no relatório sanitizado.
- Gates obrigatórios: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e CodeRabbit sem CRITICAL.

## 🤖 CodeRabbit Integration

### Story Type Analysis

- **Primary Type:** Architecture / Integration
- **Secondary Types:** API, Frontend, Security e CLI
- **Complexity:** High — altera contrato persistido, worker, adapters, autorização, CLI e UI concorrente.

### Specialized Agent Assignment

- **Primary Agents:** `@dev` (execução e pre-commit), `@architect` (contrato/políticas e gate de autoridade).
- **Supporting Agents:** `@qa` (transições, concorrência e regressão), `@ux-design-expert` (Sala, acessibilidade e responsividade), `@devops` somente para Pre-PR; `Vault` apenas se uma futura solicitação de banco for realmente autorizada fora desta story.

### Quality Gate Tasks

- [ ] Pre-Commit (`@dev`): CodeRabbit em mudanças não commitadas, lint, typecheck e testes direcionados.
- [ ] QA (`@qa`): validar matriz de políticas, idempotência, circuit breaker, restart e segurança.
- [ ] Pre-PR (`@devops`): CodeRabbit contra `main`, build, compatibilidade de estado e ausência de migration/Git mutation.
- [ ] Pre-Deployment (`@devops`): confirmar feature gate local, rollback do contrato local e runbook atualizado.

### Self-Healing Configuration

- Primary agent: `@dev`, modo light.
- Máximo: 2 iterações, 15 minutos, somente CRITICAL em auto-fix.
- CRITICAL: auto-fix; HIGH: documentar; MEDIUM/LOW: registrar sem auto-fix.
- O self-healing do CodeRabbit não pode contornar o circuit breaker ou as políticas `FORBIDDEN` desta story.

### CodeRabbit Focus Areas

- Transições inválidas, corrida entre worker/polling/comandos e idempotência de `requestId`.
- Bypass de autorização, autorização reutilizável, prompt injection e vazamento de segredos.
- Compatibilidade de `state.json` existente e escrita atômica.
- Regressão de roteamento Nova/Echo e circuit breaker determinístico.
- Acessibilidade, dupla submissão e preservação de estado da Sala durante polling.

## Initial File List

### Criar

- `docs/stories/story-roadmap-alpha-sala-implementacao-politicas.md`
- `src/lib/roadmap-production/policy.ts`
- `src/components/RoadmapAlpha/RoadmapImplementationRoom.tsx`
- `tests/roadmap-production/policy.test.ts`
- `tests/roadmap-production/interventions.test.ts`

### Modificar

- `package.json`
- `scripts/roadmap-production.mjs`
- `docs/roadmap-alpha/README.md`
- `src/lib/roadmap-production/contracts.ts`
- `src/lib/roadmap-production/agents.ts`
- `src/lib/roadmap-production/cli-providers.ts`
- `src/lib/roadmap-production/providers.ts`
- `src/lib/roadmap-production/storage.ts`
- `src/lib/roadmap-production/worker.ts`
- `src/lib/roadmap-production/completion-report.ts`
- `src/actions/RoadmapProduction.ts`
- `src/components/RoadmapAlpha/RoadmapProductionPanel.tsx`
- `tests/roadmap-production/agents.test.ts`
- `tests/roadmap-production/contracts.test.ts`
- `tests/roadmap-production/providers.test.ts`
- `tests/roadmap-production/storage.test.ts`

> A File List é uma previsão inicial. O agente executor deve manter a lista real atualizada e não tocar em `prisma/schema.prisma` ou migrations nesta story.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-08-24 | 0.1.0 | Story criada para Sala de Implementação, intervenções administrativas, motor de políticas, correção Nova/Echo e circuit breaker. | River (`@sm`) |
| 2026-08-24 | 0.2.0 | Checklist de draft validado; status promovido ao equivalente padrão de Ready for Development. | River (`@sm`) |

## Dev Agent Record

### Agent Model Used

_A preencher pelo agente de desenvolvimento._

### Debug Log References

_A preencher pelo agente de desenvolvimento._

### Completion Notes

_A preencher pelo agente de desenvolvimento._

### File List

_A substituir pela lista real antes da revisão._

## QA Results

_A preencher pelo agente de QA._
