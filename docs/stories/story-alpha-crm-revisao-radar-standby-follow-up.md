# Story: Revisão de Radar — Stand By com follow-up semanal NoLoss configurável

## Status

Ready for Review — configuração publicada; aguardando card elegível para homologação operacional

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `lint`, `typecheck`, `vitest`, `build`, verificação da configuração e homologação da agenda/tarefas

## Story

**Como** responsável comercial do Alpha CRM, **quero** acompanhar cards em Stand By com follow-up semanal e interromper os contatos quando a pessoa solicitar, **para** manter o acompanhamento sem perder um retorno combinado nem gerar tarefas após o pedido de interrupção.

## Contexto e limites

Aplica-se à etapa **Stand By** do pipeline ativo **Revisão de Radar**. O inventário recebido para esta story aponta pipeline na versão 19 e etapa `draft-stage-10cb9f48-1e00-4814-8ccd-6e076a82a8d1`, atualmente sem campos, formulário, automação ou cadência publicados e com zero cards; reconfirmar antes de qualquer publicação. O pedido atual exige **Próximo Contato** quando houver data específica combinada, **Status de follow-up** (`Ativo`/`Interrompido`), **Motivo da interrupção** quando o cliente pedir que os contatos parem, uma tarefa de follow-up por semana sem prazo final, estratégia **NoLoss**, cancelamento das tarefas futuras após a interrupção e histórico das tentativas. Campos, regras e automações devem ser administráveis nas telas de configuração do pipeline, com efeito no runtime após publicação.

A story histórica `story-alpha-crm-standby-follow-up.md` descreve código legado de cadência semanal interna, estado no card, opt-out permanente e histórico. Esse código ainda existe, mas sua presença não comprova a configuração nem o disparo no pipeline recriado. O cron legado `/api/bpm/jobs/automacao-novos-leads` não está listado em `vercel.json`; o agendador atual lista `/api/bpm/jobs/automacoes`. O executor deve escolher a integração canônica vigente e verificar a execução real antes de afirmar que há automação ativa.

**NoLoss** significa que o pedido de não contato interrompe o acompanhamento do card permanentemente, inclusive após saída e reentrada em Stand By; não presumir retomada automática. O follow-up é **tarefa operacional interna** para o responsável, sem envio automático de WhatsApp, e-mail ou ligação. A execução/registro da tarefa é distinta da tentativa de contato efetivamente realizada: o histórico deve registrar cada tentativa real com data, ator e resultado disponível, e não rotular uma tarefa apenas criada como contato realizado.

Não alterar as regras de outras etapas nem introduzir limite temporal de permanência em Stand By. **Próximo Contato** é uma data específica combinada, não o cronômetro da cadência semanal: sua ausência não bloqueia a entrada no Stand By quando nenhuma data foi acordada. Reutilizar o dado canônico do card se confirmado; evitar campo paralelo divergente. A publicação de configuração no banco e qualquer migration seguem o protocolo Vault antes da escrita.

## Acceptance Criteria

1. Em **Configurações → Campos e Formulários** da Revisão de Radar, o administrador pode configurar para Stand By os controles **Próximo Contato**, **Status de follow-up** (`Ativo`/`Interrompido`) e **Motivo da interrupção**, com rótulo, visibilidade, ordem e validações aplicáveis persistidos na configuração. O card usa a configuração publicada, sem catálogo ou IDs de banco fixados no componente.
2. **Próximo Contato** pode ser informado e mantido quando houver data específica combinada; o valor aparece no card e permanece coerente com a fonte canônica. Sem data combinada, a entrada e a permanência em Stand By continuam possíveis. Alterar ou limpar a data atualiza qualquer lembrete individual associado sem duplicá-lo nem afetar a cadência semanal.
3. O card mostra o estado **Ativo** ou **Interrompido** conforme o estado persistido. O administrador consegue ajustar a apresentação e a regra desse controle nas configurações, mas a UI não pode declarar `Ativo` enquanto o opt-out persistido proíbe contato. Se uma mudança administrativa exigir migração de valores, ela deve ser explicitada antes da publicação.
4. Quando o cliente solicitar a interrupção, o usuário autorizado informa **Motivo da interrupção** e confirma a ação; motivo ausente/inválido impede concluir. O servidor revalida sessão, acesso, etapa, estado e motivo na transação, persiste data/ator/motivo e expõe o novo estado no card. A regra e o campo aparecem na configuração administrativa, não apenas em um modal hardcoded.
5. A automação NoLoss semanal é visível e administrável na área de **Automações** do pipeline: gatilho/etapa, intervalo de sete dias, tarefa interna, condição de elegibilidade, repetição sem data final e interrupção podem ser inspecionados, ajustados e publicados pela UI conforme o modelo canônico de automações/cadências. Alterar intervalo ou ativação na UI altera a execução sem editar código. A configuração inicial publicada segue exatamente uma vez por semana, por prazo indeterminado.
6. Enquanto o card permanecer ativo e elegível em Stand By, o agendador realmente executado cria no máximo uma tarefa de follow-up por ciclo semanal para o responsável vigente. A primeira execução respeita a entrada atual na etapa; reprocessamento, concorrência e atraso do job não criam duplicatas nem uma sequência retroativa de tarefas. A criação da tarefa fica auditável, sem ser confundida com uma tentativa realizada.
7. Depois do pedido de interrupção, nenhuma nova tarefa de follow-up é gerada, inclusive em corrida com o agendador ou em reentrada na etapa. Tarefas futuras de follow-up já agendadas e ainda pendentes são canceladas ou invalidadas com vínculo e motivo auditáveis; tarefas concluídas e histórico passado são preservados. Nenhuma retomada automática ocorre.
8. Cada tentativa de contato efetivamente registrada pelo usuário gera evento de histórico com data/hora, ator e informação de resultado disponível no fluxo existente. O histórico separa tentativa realizada, tarefa criada, tarefa cancelada e interrupção, mantendo rastreabilidade mesmo após mudança de etapa.
9. Formulário, regras e automação publicados ficam visíveis e editáveis pela UI administrativa; configuração futura válida governa apresentação e execução, mantendo validação autoritativa no servidor. Uma configuração incompleta ou desativada não pode produzir tarefas com parâmetros antigos escondidos em código. CLI/diagnóstico ou serviço canônico consegue inspecionar e operar a mesma configuração independentemente da UI.
10. Antes de publicar no Turso ou executar migration, aplicar o **gate Vault** do `AGENTS.md`: apresentar ambiente, comandos, impacto, riscos, alternativa e rollback; obter backup completo validado de até 48 horas, relatório Vault e confirmação específica do usuário. Autorizações para Lost ou outras etapas não cobrem Stand By. Se houver necessidade comprovada de migration, detalhá-la separadamente antes de pedir confirmação.
11. Testes cobrem configuração administrativa, Próximo Contato opcional/atualização, estado e motivo, ciclos de sete dias, repetição indeterminada, concorrência, cron ativo, reentrada, opt-out, cancelamento de tarefas futuras e histórico de tentativas. Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar checklist e File List antes da conclusão.

## Tasks / Subtasks

- [x] Reconfirmar inventário ativo de Stand By, fonte canônica dos três controles, automações/cadências disponíveis e job realmente agendado (AC: 1–2, 5–6, 9).
- [x] Preparar prévia de campos, formulário e regra de interrupção configuráveis; distinguir data combinada de cadência semanal (AC: 1–4, 9–10).
- [x] Preparar automação semanal NoLoss editável pela UI e integrar executor atual com intervalo/estado publicados, preservando idempotência e ownership (AC: 5–6, 9).
- [x] Garantir opt-out transacional, bloqueio de novas tarefas e cancelamento auditável das pendentes futuras; preservar histórico (AC: 4, 7–8).
- [x] Expor registro de tentativa realizada e sua linha do tempo sem confundir criação de tarefa com contato efetivo (AC: 8).
- [x] Preparar gate Vault; publicar somente depois de relatório, backup e confirmação específica; conferir banco, UI e job (AC: 9–10).
- [x] Executar testes e gates, preencher QA, checklist, Change Log e File List real (AC: 11).

## Dev Notes

- [Source: `docs/stories/story-alpha-crm-standby-follow-up.md#decisões-de-produto`] O desenho anterior definiu tarefa interna a cada sete dias, primeira após entrada na etapa, NoLoss permanente, opt-out autenticado e histórico. Não confundir esse estado anterior com a configuração ativa do pipeline recriado.
- [Source: `.bibble/memory/plano-novos-leads-bpm.md`] O desenho anterior usa `BpmCard.standbyFollowUpUltimoEm` e `standbyFollowUpInterrompidoEm`, registra opt-out permanente e reinicia a referência semanal na reentrada. Rever se essas fontes continuam canônicas no runtime atual.
- [Source: `docs/stories/story-alpha-crm-revisao-radar-lost.md#contexto-e-limites`] O pipeline foi recriado e requer publicar controles administráveis; a aprovação Vault daquela etapa não abrange esta.
- [Source: `docs/stories/story-rm-2026-8c3862-revisao-radar.md#fontes-canônicas-e-invariantes`] O editor do pipeline já possui áreas de campos/formulários e automações, publicação versionada e auditoria; reutilizar as entidades canônicas.
- [Finding no checkout] `src/actions/bpm/StandbyFollowUp.ts` lê estado e interrompe com CAS/histórico; `src/lib/bpm/automacao-novos-leads.ts` ainda contém criação semanal com `7 * 24h` no código; `src/app/PainelAlpha/AlphaCRM/CardModal/PainelStandbyFollowUp.tsx` apresenta rótulos e validações fixos. `vercel.json` agenda `/api/bpm/jobs/automacoes`, mas não o job legado. Investigar integração com `src/lib/bpm/automacoes/central-runtime.ts`, `src/lib/bpm/automacoes/migracao-hardcoded.ts`, `src/actions/bpm/Cadencias.ts` e editor admin antes de escolher o ponto de execução.
- [Inventário recebido em 2026-09-28] Pipeline `configVersion=19`, Stand By `draft-stage-10cb9f48-1e00-4814-8ccd-6e076a82a8d1`, sem campos, formulário, automação ou cadência e sem cards. Estes dados são ponto de partida somente leitura e precisam ser revalidados imediatamente antes da publicação.
- `docs/stories/accumulated-context.md` e `.aiox/gotchas.json` não existem neste workspace. Coerência conferida nas stories relacionadas; caminhos de arquitetura citados no core config também podem faltar e não autorizam inventar tecnologia.
- [AUTO-DECISION] A data combinada não é requisito universal de entrada: o texto do usuário condiciona Próximo Contato à existência de uma data específica, e o prazo do acompanhamento é indeterminado.
- [AUTO-DECISION] NoLoss preserva o opt-out permanente do desenho anterior; pedidos de retomada futura exigem decisão de produto separada.
- [AUTO-DECISION] A criação de `BpmTarefa` representa uma ação interna pendente, não uma tentativa já realizada; histórico de tentativas reais requer evento próprio ou integração com registro existente de interação.

## Testing

Usar testes de domínio/actions e configuração em `tests/bpm/`, inclusive o fluxo real do job listado em `vercel.json`; simular relógio, concorrência e reentrada. Homologação autenticada deve confirmar o formulário em Stand By, a automação editável e publicada, a tarefa no responsável, o registro de uma tentativa e o cancelamento após opt-out. Testes isolados não comprovam que a configuração foi publicada nem que o agendador de produção está ativo.

## 🤖 CodeRabbit Integration

**Story Type Analysis:** Full-stack, configuração BPM e automação interna; complexidade alta por agendamento recorrente, opt-out e concorrência.

**Specialized Agent Assignment:** `@dev` implementa; `@qa` valida; `@ux-design-expert` revisa formulários/acessibilidade; Vault conduz gate de publicação; `@devops` participa de eventual deploy/PR e valida agendador de produção.

**Quality Gate Tasks:**

- [ ] Pre-Commit (`@dev`): lint, typecheck, testes, build e CodeRabbit no diff.
- [ ] Pre-PR (`@devops`): compatibilidade, agendador e CodeRabbit se houver PR.
- [ ] Pre-Deployment (`@devops`): automação publicada, backup/rollback, cron e ausência de duplicatas.

**Self-Healing Configuration:** `@dev` light, até 2 iterações/15 min (CRITICAL corrigir; HIGH documentar); `@qa` full, até 3 iterações/30 min (CRITICAL/HIGH corrigir); `@devops` check/report only. MEDIUM documentar como dívida quando pertinente; LOW avaliar na revisão.

**CodeRabbit Focus Areas:** configuração canônica sem parâmetros escondidos; cron realmente ativo; CAS/idempotência; opt-out e cancelamento atômicos; autorização; histórico factual das tentativas; isolamento do pipeline e acessibilidade dos controles.

## Checklist de conclusão

- [ ] AC 1–11 verificados com evidência de código, configuração e execução.
- [ ] Gate Vault cumprido antes de qualquer escrita Turso/migration.
- [x] `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` executados.
- [ ] Homologação autenticada de card, tarefa, tentativa e opt-out concluída.
- [x] QA, Change Log e File List real atualizados.

## File List

- `docs/stories/story-alpha-crm-revisao-radar-standby-follow-up.md` — story, checklist e evidência dos gates.
- `scripts/configurar-standby-radar.mts` — preview e publicação transacional com guardas Vault.
- `src/actions/bpm/StandbyFollowUp.ts` — consulta da cadência ativa e opt-out com campos, agendas e tarefas.
- `src/actions/bpm/Campos.ts` — preserva as chaves semânticas do status NoLoss na edição administrativa.
- `src/actions/bpm/Tarefas.ts` — impede concluir tarefa cancelada.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelStandbyFollowUp.tsx` — frequência dinâmica e orientação de registro de tentativas.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelTarefasPorTipo.tsx` — status Cancelada no card.
- `src/app/PainelAlpha/AlphaCRM/tarefas/TarefasCentralClient.tsx` — status Cancelada na lista central.
- `src/lib/bpm/automacoes/agenda.ts` — agenda apenas cards elegíveis e desativa agendamentos após opt-out.
- `src/lib/bpm/automacoes/central-runtime.ts` — revalidação transacional e histórico de tarefa semanal.
- `src/lib/bpm/requisitos-etapa-server.ts` — status exibido deriva do opt-out persistido, inclusive após reentrada.
- `tests/bpm/standby-follow-up.test.ts` — cobre persistência e cancelamento no opt-out.
- `tests/bpm/automacoes-correcoes-motor.test.ts` — cobre exclusão de opt-out na sincronização e materialização da agenda.
- `tests/bpm/tarefas-tipo.test.ts` — cobre a indisponibilidade de conclusão para tarefas canceladas.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-28 | 0.1 | Story de Stand By com campos e automação NoLoss configuráveis. | River (`@sm`) |
| 2026-09-28 | 0.2 | Implementação preparada; preview e gates passaram; backup dedicado validado. | Codex (`@dev`) |
| 2026-09-28 | 0.3 | Configuração publicada na versão 20; tarefas passam a ser canceladas com histórico individual. | Codex (`@dev`) |
| 2026-09-28 | 0.4 | QA aprovado; rótulos configuráveis, suíte completa e build final validados. | Codex (`@dev`) |

## Dev Agent Record

Prévia no Turso de produção: Revisão de Radar v19, Stand By sem campos/formulário/automação. O job ativo é `/api/bpm/jobs/automacoes` em `vercel.json`; o job legado não está agendado. `npm run lint` passou com 1.191 avisos preexistentes e zero erros; `npm run typecheck`, `npm test` (546 arquivos, 4.015 testes aprovados) e `npm run build` passaram após as correções. Backup lógico dedicado em `database-backups/pre-change/` validado por restauração local: 179.427.096 bytes, 332 tabelas e 189.254 linhas. Após autorização específica, a publicação transacional concluiu e a leitura posterior confirmou Revisão de Radar v20, dois campos, quatro componentes do formulário e a versão ativa da automação semanal. Não havia cards ativos em Stand By no inventário, portanto uma homologação de disparo com card real fica para quando houver um card elegível. Os testes focais cobrem sincronização e materialização da agenda, mudança de intervalo, reentrada, criação da tarefa, corrida com opt-out, cancelamento individual e rótulos configuráveis. O CodeRabbit CLI não está instalado neste ambiente; a revisão manual QA foi aprovada sem issue bloqueante.

## QA Results

### Revisão de 2026-09-28 — Quinn (Guardian)

**Gate: NEEDS_WORK.** O teste focal (`npx vitest run tests/bpm/standby-follow-up.test.ts`) passou: 6 testes. O fluxo de opt-out revalida acesso e card dentro da transação, usa CAS e desativa agendas. A criação de tarefa no motor central também revalida elegibilidade na transação.

**Correções necessárias:**

1. `InterromperStandbyFollowUpBpm` apaga tarefas pendentes com `bpmTarefa.deleteMany`. A exclusão impede inspecionar o status e o vínculo de cada tarefa cancelada; o histórico registra somente a contagem. Preservar cada tarefa e registrar seu cancelamento com motivo e ID (AC 7–8).
2. O teste novo valida o helper legado de sete dias e a action com mocks, mas não exercita o agendador e o motor central publicados, nem reprocessamento, concorrência, reentrada, mudança de intervalo e histórico de tentativa real. Cobrir os cenários críticos do AC 11 com testes de integração ou de domínio sobre a configuração vigente.
3. Antes de a agenda ser sincronizada após reentrada, o fallback da próxima data usa `standbyFollowUpUltimoEm` da passagem anterior, podendo mostrar um vencimento anterior à reentrada. Usar a entrada atual como limite da referência (AC 6).
4. O painel mantém o título e mensagens de “follow-up semanal” mesmo quando o administrador altera o intervalo da automação; exibir a frequência publicada (AC 5, 9).

**Revisão pendente após correções:** conferir novamente lint, typecheck, testes, build e evidência da publicação/configuração. A configuração de produção foi publicada conforme relato do executor; esta revisão não realizou escrita no banco nem homologação autenticada com card real.

### Reavaliação de 2026-09-28 — Quinn (Guardian)

**Gate: NEEDS_WORK.** As tarefas de follow-up pendentes agora permanecem no banco com status `CANCELADA`, e cada cancelamento tem evento próprio com ID e motivo. O fallback usa a entrada atual na reentrada e o título apresenta NoLoss com intervalo publicado. Os dois testes focais passaram (16/16); typecheck e ESLint focal foram informados como aprovados pelo executor.

**Pendências:** os dois testes novos do agendador cobrem apenas o descarte de cards interrompidos; o AC 11 ainda carece de prova para criação semanal via motor central, idempotência/reprocessamento, intervalo editado e reentrada. O texto “A tarefa semanal é apenas o lembrete” continua fixo depois de alterar o intervalo. As opções do campo administrativo de status podem ser editadas, mas a ação e o valor derivado persistem os literais `Ativo`/`Interrompido`; trocar as opções pode tornar o valor incompatível com a configuração publicada.

### Terceira revisão de 2026-09-28 — Quinn (Guardian)

**Gate: NEEDS_WORK.** Os testes focais passaram (19/19). A correção incluiu criação de tarefa e histórico pelo motor central, corrida de opt-out via CAS, reentrada e intervalo configurado em três dias. O texto do lembrete é neutro; o campo operacional de status usa os rótulos das opções de chave `ativo` e `interrompido`, e a edição administrativa mantém essas chaves obrigatórias.

**Pendência final:** o indicador de estado no `PainelStandbyFollowUp` ainda mostra os literais `Ativo`/`Interrompido` após a edição dos rótulos no admin. Usar os rótulos publicados também nesse indicador para satisfazer a apresentação configurável do AC 3. O fluxo real com card em produção permanece sem homologação porque o inventário da etapa tinha zero cards.

### Revisão final de 2026-09-28 — Quinn (Guardian)

**Gate: APPROVED.** O indicador usa os rótulos ativos das opções semânticas `ativo`/`interrompido`; teste com rótulos personalizados confirma a leitura. Verifiquei novamente opt-out transacional, cancelamento auditável sem exclusão física, bloqueio de conclusão da tarefa cancelada, frequência publicada, reentrada e criação de tarefa com revalidação no motor central. Os testes focais `standby-follow-up`, `automacoes-correcoes-motor` e `tarefas-tipo` passaram (24/24). O executor informou typecheck e suíte completa aprovados após corrigir uma expectativa textual antiga.

**Limite da evidência:** não houve homologação autenticada com card real em Stand By, pois o inventário da etapa tinha zero cards. A publicação da configuração e o gate Vault foram conduzidos pelo executor; esta revisão permaneceu somente leitura no banco.

## Story Draft Validation

| Category | Status | Issues |
| --- | --- | --- |
| Goal & Context Clarity | PASS | Etapa, ciclo semanal, opt-out, configuração e benefício explícitos. |
| Technical Implementation Guidance | PASS | Runtime legado, agendador vigente e fontes de estado identificados como pontos de investigação. |
| Reference Effectiveness | PASS | Story histórica e arquitetura administrativa resumidas com diferença do pipeline atual. |
| Self-Containment Assessment | PASS | Data combinada, NoLoss, tarefa interna e tentativa efetiva distinguidas. |
| Testing Guidance | PASS | Casos verificáveis de cron, concorrência, interrupção, cancelamento e histórico. |
| CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e focos presentes. |

**Final Assessment:** READY para implementação; publicação da configuração e eventual migration dependem de gate Vault e confirmação específica.
