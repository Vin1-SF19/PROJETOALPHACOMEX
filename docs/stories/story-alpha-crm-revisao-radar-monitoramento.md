# Story: Revisão de Radar — validar Monitoramento e expor Próxima verificação na configuração

## Status

Ready for Review — configuração Turso publicada; deploy da aplicação pendente

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `lint`, `typecheck`, `vitest`, `build`, inventário da configuração e homologação do card

## Story

**Como** responsável por um card em **Monitoramento**, **quero** visualizar a próxima verificação e administrar os campos da etapa na UI, **para** acompanhar o processo sem perder as revisões já programadas.

## Contexto e limites

O pedido atual trata da etapa **Monitoramento** no pipeline ativo **Revisão de Radar**. Há implementação anterior documentada em `story-alpha-crm-monitoramento-automatico.md`: somente **Em Tratativa → Monitoramento**; revisão interna após **30 dias corridos** enquanto o card está ativo; criação de `BpmTarefa` com prazo/alerta, sem mensagem externa; reentrada reinicia o ciclo; saídas manuais para **Em Tratativa** e **Lost**. Esses comportamentos são um **baseline a conferir**, não confirmação de que a configuração ativa esteja completa ou de que sejam as novas regras desejadas.

O usuário definiu a fonte como **dados do próprio CRM**, a revisão interna a cada **10 dias corridos**, e **Próxima verificação calculada automaticamente** pelo ciclo, sem obrigação de preenchimento manual. A condição de interesse permanece **editável e inativa** porque seu critério objetivo não foi definido. Quando vier a ser definida e ativada, o destino do retorno será **Agendar reunião**. A execução atual de 30 dias é o baseline que precisa ser substituído pelo intervalo escolhido, com configuração na UI e sem criar automações duplicadas. O retorno automático não pode ocorrer enquanto a condição não existir.

Não editar a story ou o código de **Standby** em paralelo. Reutilizar tarefa, histórico e automação de Monitoramento existentes quando forem válidos; evitar campo ou lembrete duplicado. O escopo desta story, até as definições pendentes, é inventariar e validar o que funciona, expor controles seguros de consulta/configuração e registrar diferenças verificadas. Mudanças de regra de negócio dependem de confirmação expressa.

## Acceptance Criteria

1. O inventário identifica a etapa ativa de Monitoramento, seu formulário, campos, transições, automações e tarefas publicadas; compara cada item com o baseline documentado e registra o que funciona, o que falta e o que depende de decisão do usuário.
2. O ciclo anterior de 30 dias é substituído por uma automação central de revisão interna a cada 10 dias, editável na UI. Apenas cards elegíveis geram tarefa e alerta; reentrada reinicia o ciclo; execução repetida ou concorrente não duplica tarefa do mesmo ciclo. O job legado deixa de executar quando a definição central existe, inclusive se ela estiver pausada.
3. A entrada publicada de Em tratativas é preservada. A etapa deixa de ser final e recebe uma transição de origem **AUTOMACAO** para Agendar Reunião. A automação que a utiliza permanece inativa até que a condição objetiva seja configurada. Não se habilita retorno manual por engano.
4. O card mostra de modo claro a **próxima verificação** calculada pela agenda da automação central. Um bloco somente leitura em **Configurações → Campos e Formulários** controla presença, rótulo e posição. Não há segunda data manual.
5. A UI administrativa permite visualizar e ajustar o bloco da etapa e a automação de revisão a cada 10 dias; a condição de interesse fica registrada como automação inativa e editável, sem critério presumido. Alterações feitas na UI persistem e reaparecem no card conforme o contrato vigente, sem ID de banco fixo no código.
6. A tarefa criada pela revisão aparece no fluxo de tarefas/notificações existente do responsável elegível conforme o contrato de `BpmTarefa`; tarefa antiga não é apresentada como revisão nova após saída ou reentrada. Falha do job não informa execução bem-sucedida inexistente.
7. O monitoramento usa dados do CRM e revisão a cada dez dias; a próxima verificação é derivada. A condição de interesse continua editável e inativa. Agendar reunião é o destino configurado para o retorno futuro, sem disparar retorno enquanto a condição objetiva não for cadastrada e ativada.
8. Se a configuração ativa do Turso precisar ser alterada, cumprir o gate Vault do `AGENTS.md`: relatar ambiente, comandos, impacto, riscos, alternativa e rollback; backup completo verificado de até 48 horas; relatório Vault e autorização específica do usuário antes da escrita. Aprovações de outras etapas não cobrem Monitoramento.
9. Testes cobrem baseline e desvios corrigidos, cálculo da próxima verificação, reentrada, idempotência, transições efetivas, visibilidade no card/administrador e integração com tarefa/alerta. Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar checklist e File List antes de concluir.

## Tasks / Subtasks

- [x] Inventariar pipeline/etapa ativos, automação publicada, tarefas e transições; confrontar com baseline de 2026-08-14 (AC: 1–3).
- [x] Documentar como a próxima revisão é calculada e selecionar apresentação inequívoca no card: valor derivado, bloco configurável somente leitura (AC: 4, 7).
- [x] Expor na UI administrativa o bloco de próxima verificação e as automações editáveis, sem presumir condição de interesse (AC: 4–5).
- [x] Validar por testes o ciclo legado, bloqueio de duplicação e data após reentrada; verificar tarefa/alerta central no código (AC: 2, 6).
- [x] Obter fonte, frequência, próxima verificação e destino; manter a condição objetiva inativa até definição; refletir respostas em AC/Change Log (AC: 7).
- [x] Publicação Turso com prévia, Vault, autorização específica e conferência remota após transação (AC: 8).
- [x] Rodar testes e gates; completar checklist, QA Results, Change Log e File List (AC: 9).

## Dev Notes

- [Source: `docs/stories/story-alpha-crm-monitoramento-automatico.md#regra-operacional-definida`] Baseline já implementado: entrada de Em Tratativa, revisão interna de 30 dias para card ativo, tarefa sem contato externo, reentrada e saídas manuais Em Tratativa/Lost. Confirmar contra o pipeline ativo antes de afirmar que funciona em produção.
- [Source: `.bibble/memory/plano-novos-leads-bpm.md#coluna-9--monitoramento-regra-operacional-e-automacao-mensal`] Plano técnico registra tarefa/histórico/CAS e ausência de alteração estrutural; não define novos critérios pedidos agora.
- [Source: `src/lib/bpm/monitoramento.ts`] `calcularProximaRevisaoMonitoramento` deriva a data da entrada atual ou da última execução; o intervalo é constante de 30 dias. `obterErroTransicaoMonitoramento` contém a matriz antiga.
- [Source: `src/lib/bpm/automacao-novos-leads.ts`] Job diário gera `BpmTarefa` e evento `MONITORAMENTO_AUTOMATICO_EXECUTADO`; revisar execução, autorização e estado publicado.
- [Source: `src/lib/bpm/automacoes/migracao-hardcoded.ts`] Existe definição migrável `monitoramento_mensal` com recorrência de 30 dias e ação `CRIAR_TAREFA`; não assumir que já está ativa no Turso.
- [Source: `docs/stories/story-alpha-crm-revisao-radar-em-tratativas.md#acceptance-criteria`] Monitoramento é uma das saídas de Em tratativas na configuração recente.
- Testes anteriores: `tests/bpm/monitoramento.test.ts` e `tests/bpm/automacao-monitoramento.test.ts`. Pontos de UI a localizar no card e no editor de **Configurações → Campos e Formulários** antes de alterar.
- `docs/stories/accumulated-context.md` e `.aiox/gotchas.json` não existem neste checkout; a coerência entre stories foi conferida nas referências acima. Evitar inferir requisitos da ausência desses arquivos.
- [Decisão do usuário] Fonte: CRM; revisão a cada 10 dias; Próxima verificação calculada automaticamente; condição de interesse editável e inativa por ora; destino de eventual retorno: Agendar reunião.

## Testing

Usar os testes de domínio/jobs em `tests/bpm/` e testes de UI do card/editor pertinentes. Verificar com card real autorizado o cálculo da próxima verificação, tarefa/alerta na agenda e configuração efetivamente publicada. Teste unitário isolado não comprova ativação no Turso nem cron em produção.

## 🤖 CodeRabbit Integration

**Story Type Analysis:** Full-stack, auditoria e eventual configuração BPM; complexidade média, com risco de divergência entre automação em código e automação publicada.

**Specialized Agent Assignment:** `@dev` implementa; `@qa` valida; `@ux-design-expert` revisa apresentação da data; Vault conduz qualquer alteração de configuração de banco; `@devops` cuida de eventual push/deploy.

**Quality Gate Tasks:**

- [x] Pre-Commit (`@dev`): lint, typecheck, testes, build, revisão de idempotência e matriz de transições.
- [ ] Pre-PR (`@devops`): compatibilidade e CodeRabbit se houver PR.
- [ ] Pre-Deployment (`@devops`): configuração ativa, backup/rollback e cron se houver publicação.

**Self-Healing Configuration:** `@dev` light, até 2 iterações/15 min (CRITICAL corrigir; HIGH documentar); `@qa` full, até 3 iterações/30 min (CRITICAL/HIGH corrigir); `@devops` check/report only. MEDIUM documentar como dívida quando pertinente; LOW avaliar no review.

**CodeRabbit Focus Areas:** cálculo e fonte única da data; automação publicada versus código; idempotência/CAS; reentrada; autorização e visibilidade da tarefa; UI configurável; não alterar regras indefinidas ou arquivos de Standby.

## Checklist de conclusão

- [x] Baseline verificado em código e configuração ativa: versão 20, Monitoramento final sem formulário/automação central, zero cards, única entrada habilitada de Em tratativas. Homologação em card real dependerá de publicação.
- [x] Fonte CRM, 10 dias corridos, data derivada e destino Agendar Reunião definidos; condição objetiva permanece inativa.
- [x] AC aplicáveis verificados com evidência; publicação Turso passou pelo gate Vault.
- [x] `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` executados.
- [x] QA, File List e Change Log atualizados; homologação de card real pendente de deploy e presença de card em Monitoramento.

## File List

- `docs/stories/story-alpha-crm-revisao-radar-monitoramento.md` — story e evidências.
- `scripts/configurar-monitoramento-radar.mts` — prévia e publicação protegida.
- `src/actions/bpm/Monitoramento.ts` — consulta autorizada da próxima verificação.
- `src/actions/bpm/Automacoes.ts` e `src/actions/bpm/AutomacoesCentrais.ts` — bloqueio de ativação sem condição.
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx` e `PainelMonitoramento.tsx` — exibição no formulário do card.
- `src/lib/bpm/automacao-novos-leads.ts` — desliga job legado quando a automação central existe.
- `src/lib/bpm/formularios-etapa.ts` e `src/lib/bpm/ontology.ts` — bloco configurável de próxima verificação.
- `src/lib/bpm/monitoramento.ts` — identidade das automações e validação da matriz.
- `tests/bpm/automacao-monitoramento.test.ts`, `tests/bpm/monitoramento.test.ts` e `tests/bpm/monitoramento-proxima-verificacao.test.ts` — regressões de ciclo, ativação e data.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-28 | 0.1 | Story de validação do Monitoramento existente e definição explícita das decisões abertas. | River (`@sm`) |
| 2026-09-28 | 0.2 | Incorporadas as respostas: CRM, 10 dias, data derivada, condição inativa e retorno futuro a Agendar reunião. | Codex (`@dev`) |
| 2026-09-28 | 0.3 | Código, prévia protegida, teste de reentrada e gates; publicação pendente de autorização específica. | Codex (`@dev`) |
| 2026-09-28 | 0.4 | Publicação Turso autorizada, v20→v21; formulário, automações e transição conferidos por leitura. | Codex (`@dev`) |

## Dev Agent Record

Inventário remoto inicial apenas de leitura: pipeline Revisão de Radar v20; Monitoramento `ehFinal=true`, sem formulário e sem automação central mensal, sem cards; apenas entrada de Em tratativas habilitada. A prévia planejou formulário com bloco somente leitura, automação de revisão de 10 dias corridos, condição inativa e transição exclusiva de automação para Agendar Reunião. Lint passou com 0 erros e 1.191 avisos existentes; typecheck e build passaram. Após correção do filtro de reentrada e validação do critério, 3 arquivos focados e 13 testes passaram; typecheck passou novamente. Vault preparou e verificou backup novo de 2026-09-28 19:58 UTC (332 tabelas, 189.338 linhas, SHA-256 `a47edd7ddf798cf47127ac4bd4a11b6f5290135de290dd657b823de1b9de8349`). QA aprovou o código.

Após autorização específica, `scripts/configurar-monitoramento-radar.mts --apply` publicou a configuração em transação auditada por Vinicius (TI), ID 8. Leitura remota confirmou v21, `ehFinal=false`, formulário ativo com `MONITORING_STATUS`, revisão central ativa com `intervaloDias=10`, condição CRM inativa com `condicaoJson=null`, transição `AUTOMACAO` para Agendar Reunião e auditoria. Suíte final após ajustes: 547 arquivos e 4.020 testes passaram. Sem card atual em Monitoramento, a homologação visual/operacional em card real aguarda o deploy e o primeiro card.

## QA Results

### Review Date: 2026-09-28

### Reviewed By: Quinn (Test Architect)

### Code Quality Assessment

**APPROVED para o código preparado, antes da publicação no Turso.** A revisão de 10 dias usa automação central editável; o job legado cessa quando essa definição existe, inclusive pausada. A consulta de Próxima verificação usa a agenda da passagem atual ou calcula a primeira data antes da materialização. O formulário inclui bloco somente leitura configurável, e a condição de retorno permanece inativa sem critério objetivo.

### Findings Resolved During Review

- O script passou a recusar publicação se surgir automação central mensal antiga, evitando revisões paralelas de 30 e 10 dias. Inventário remoto somente leitura confirmou ausência dessas automações.
- A consulta passou a filtrar a agenda pela chave da entrada atual, evitando exibir o ciclo anterior após saída e reentrada.

### Compliance Check

- Lint: aprovado, zero erros; 1.191 avisos existentes.
- Typecheck: aprovado.
- Testes: 547 arquivos e 4.019 testes aprovados; após o ajuste de reentrada, três arquivos focados e 13 testes aprovados.
- Build: aprovado.
- Segurança: consulta da próxima verificação exige sessão e autorização de leitura do card; nenhuma condição de retorno está ativa.

### Gate Status

**APPROVED** para implementação pré-publicação. A publicação Turso depende do gate Vault e de autorização específica. A conferência da automação, formulário, tarefa e alerta em card real depende da publicação e do deploy.

### Verificação após publicação

Publicação específica autorizada e executada após Vault: Revisão de Radar passou da versão 20 para 21. A leitura remota confirmou formulário ativo com `MONITORING_STATUS`, revisão de 10 dias ativa, condição CRM inativa e sem critério, transição exclusiva de automação para Agendar Reunião e auditoria atribuída a Vinicius (ID 8). A suíte final passou com 547 arquivos e 4.020 testes. **APPROVED** permanece. A homologação da exibição, tarefa e alerta em card real aguarda deploy e o primeiro card elegível.

## Story Draft Validation

| Category | Status | Issues |
| --- | --- | --- |
| Goal & Context Clarity | PASS | Objetivo e escopo de validação definidos. |
| Technical Implementation Guidance | PASS | Baseline, job, domínio, UI e testes identificados. |
| Reference Effectiveness | PASS | Story antiga e implementação resumidas com função de cada fonte. |
| Self-Containment Assessment | PASS | Decisões pendentes explicitadas sem inventar regra. |
| Testing Guidance | PASS | Critérios verificáveis para cron, card, editor e tarefa. |
| CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e foco presentes. |

**Final Assessment:** código pronto para publicação condicionada ao gate Vault. A condição objetiva de retorno permanece inativa e será definida depois pelo usuário.
