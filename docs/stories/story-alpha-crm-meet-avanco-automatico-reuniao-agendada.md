# Story: Revisão de Radar — avançar ao confirmar o agendamento do Google Meet

## Status

Ready for Review — código implementado e definição no Turso publicada; implantação do código pendente.

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: testes de integração do motor BPM, `lint`, `typecheck`, `test`, `build` e CodeRabbit.

## Story

**Como** usuário comercial do pipeline **Revisão de Radar**, **quero** que o card saia automaticamente de **Agendar Reunião** para **Reunião Agendada** quando a reunião Google Meet for confirmada, **para que** a etapa do card represente o agendamento concluído sem movimento manual.

## Contexto e limites

Pedido explícito do usuário em 2026-09-28. A automação deve aparecer na lista azul de **Automações** da etapa **Agendar Reunião**, com contagem, nome, estado e ações, no mesmo mecanismo que já mostra a automação de **Fechado**. O escopo é o pipeline **Revisão de Radar**. Não executar retroativamente em cards que já tinham reunião antes da ativação, salvo decisão posterior do usuário.

Hoje `AgendarReuniaoGoogleMeetBpm` confirma o link do Meet, vincula evento, data e `BpmCardReuniao`, registra `REUNIAO_AGENDADA` e notifica o board, mas preserva a etapa de origem. O motor central já tem gatilhos versionados e ação `MOVER_CARD`, cujo movimento usa `executarTransicaoBpm`. `ObterPipelineBpm` projeta automações ativas vinculadas à etapa para a lista do editor. O tipo `REUNIAO_AGENDADA` é ação de histórico, não é ainda gatilho do catálogo; não confundir histórico com evento de automação.

Esta story complementa `story-alpha-crm-revisao-radar-agendar-reuniao-atribuicao-cadencia.md`: mantém Data e Hora obrigatórias e as saídas permitidas da etapa. A criação inicial da reunião é o gatilho; reagendamento posterior não deve gerar novo movimento. A automação de oito dias de **Agendar Reunião** não deve vencer ou mover para Standby um card que já saiu da etapa.

## Acceptance Criteria

1. Ao criar uma reunião na etapa **Agendar Reunião** do pipeline **Revisão de Radar**, o card somente é elegível depois de o Google confirmar um evento com link Meet e o vínculo local (`googleEventId`, `googleCalendarId`, `googleMeetLink`, `dataReuniao` e reunião principal) estar persistido com sucesso. Falha ou compensação da criação não dispara avanço.
2. Para o agendamento elegível, a automação ativa executa `MOVER_CARD` para a etapa **Reunião Agendada** do mesmo pipeline, usando a transição BPM existente e suas validações, histórico, correlação e atualização em tempo real. Após o commit local, a action aciona o processamento síncrono do evento; no caminho de sucesso, o card já aparece na etapa destino na resposta, sem necessidade de drag ou clique manual.
3. A etapa **Agendar Reunião** mostra a nova automação no painel azul com contagem atualizada, nome compreensível, gatilho e ação visíveis, usando uma definição persistida/versionada do motor central associada à etapa. Ela pode ser inspecionada e administrada pelas telas de automações existentes; não simular a contagem com texto fixo na UI.
4. A definição só reage ao evento de **criação confirmada** de Google Meet deste pipeline e desta etapa; salvar Data/Hora, criar convite sem confirmação, mover manualmente, reagendar, sincronizar transcrição ou agendar em outro pipeline não dispara este avanço.
5. Uma repetição do mesmo evento, retry, clique duplo ou execução concorrente produz no máximo um movimento e um histórico de movimento para a mesma criação. Se o card já estiver em **Reunião Agendada**, a execução é tratada como concluída/ignorada; se estiver em outra etapa por ação posterior, não o reposiciona.
6. Se a automação falhar após o Google Meet e o vínculo local terem sido confirmados, não cancelar a reunião válida. Registrar falha recuperável e observável no motor, sem informar ao usuário que o agendamento falhou; o retorno/UI distingue **reunião criada, avanço pendente** de falha de criação. Retry pode concluir o movimento sem novo evento Google.
7. Se o destino estiver ausente/inativo, a automação estiver desativada ou uma regra de transição impedir o movimento, nenhum movimento parcial é registrado. A execução informa a causa de forma segura no monitoramento e respeita a configuração vigente. Desativar ou apagar a automação pela UI impede futuros avanços por ela.
8. A interface e o board recebem a etapa persistida após a operação, inclusive quando o movimento é assíncrono; o modal não deve mostrar sucesso de avanço antes da confirmação da transição. Reabrir o card reflete etapa, reunião e histórico reais.
9. Testes cobrem sucesso, Google sem Meet, falha no vínculo local/compensação, automação inativa, destino inválido, transição recusada, duplicidade/concorrência, reagendamento, card que mudou de etapa, contagem/lista azul e feedback de avanço pendente. Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar checklist e File List antes de concluir.

## Decisões e dependências

- Reutilizar o motor central, seu evento idempotente e `MOVER_CARD`; criar o menor gatilho específico necessário para o fato **Meet confirmado e vinculado**. Não disparar por evento genérico `CARD_ATUALIZADO`, pois ele inclui alterações sem agendamento.
- Gravar o evento na outbox `BpmEventoDominio` na mesma transação que confirma o vínculo local, com chave estável derivada da criação da reunião. Após o commit, acionar o processamento síncrono desse evento. A execução do motor não pode ocorrer antes da persistência do vínculo. Falha no flush preserva evento pendente para retry e não compensa o Meet já confirmado.
- A ação de movimento deve revalidar origem e destino no momento da execução. Não atualizar `etapaId` diretamente na action Google Meet.
- A configuração de uma automação em banco é alteração persistida. Antes de publicar no Turso, seguir a política de `AGENTS.md`: agente Vault, relatório de impacto/rollback, backup completo verificado de até 48 horas e confirmação explícita e específica do usuário. A aprovação anterior para outras configurações não cobre esta.
- Não criar schema, migration, seed em massa ou backfill sem necessidade comprovada. Se qualquer um for necessário, aplicar o mesmo protocolo Vault antes de executar.

## Tasks / Subtasks

- [x] 1. Confirmar IDs, transição permitida, configuração atual da etapa e contrato do motor (AC 1–4, 7).
- [x] 2. Preparar gatilho idempotente de agendamento confirmado, publicá-lo na outbox na mesma transação do vínculo local e fazer flush síncrono após commit (AC 1, 2, 4–6).
- [x] 3. Configurar a automação versionada com escopo da etapa e ação `MOVER_CARD` para Reunião Agendada; verificar persistência usada pela lista azul (AC 2–3, 7).
- [x] 4. Ajustar feedback de sucesso/pendência e atualização do board/modal (AC 6, 8).
- [x] 5. Cobrir fluxo de evento, escopo, sucesso, falha posterior ao commit e feedback; executar gates do projeto (AC 5–9).
- [x] 6. Aplicar protocolo Vault e obter confirmação específica antes de publicar a definição no banco; atualizar esta story com evidência, checklist e File List (AC 3, 9).

## Dev Notes

- `src/actions/bpm/GoogleMeet.ts`: criação, confirmação, persistência transacional e compensação do evento Google. Emitir o sinal de automação somente depois do vínculo local concluído; revisar tratamento do erro posterior para não acionar compensação de reunião válida.
- `src/lib/bpm/automacoes/central-schemas.ts`: catálogo de gatilhos e ações; `MOVER_CARD` já existe.
- `src/lib/bpm/automacoes/eventos.ts`, `fila.ts`, `central-runtime.ts`: publicação em outbox, execução idempotente e transição; verificar a chave única efetiva de versão + evento antes de alterar o fluxo. A publicação aceita um transaction client, permitindo gravar o evento na mesma transação do vínculo.
- `src/lib/bpm/automacoes/migracao-hardcoded.ts`: exemplos de definições por etapa, inclusive a automação de **Fechado**. Reutilizar padrão de configuração sem executar a migração de todas as automações como efeito colateral.
- `src/actions/bpm/Pipelines.ts` e `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/PipelineWorkspaceSections.tsx`: projeção e renderização da lista azul de automações por etapa.
- `docs/stories/story-alpha-crm-revisao-radar-agendar-reuniao-atribuicao-cadencia.md#acceptance-criteria`: guarda de Data/Hora, saídas e cadência da etapa. `docs/stories/story-rm-2026-d100eb-motor-central-automacoes.md`: motor central, versão, idempotência e observabilidade.
- `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados no workspace; nenhum requisito foi inferido desses arquivos ausentes.

### Testing

- Testes determinísticos em `tests/bpm/` com Google Calendar e fila de automações simulados, mais integração do motor e transição reais quando o harness permitir.
- Testar publicação da definição e leitura/projeção de `etapa.automacoes`, não apenas a aparência do componente. Testar outbox no mesmo commit e flush síncrono depois dele.
- Verificar que cada falha preserva reunião, card, histórico e resultado de execução coerentes; testar retry sobre o mesmo evento sem novo `events.insert`.

## CodeRabbit Integration

**Primary Type:** Integration / API. **Secondary Type(s):** Frontend, automação BPM e persistência de configuração. **Complexity:** alta.

### Specialized Agent Assignment

- `@dev`: implementação e pre-commit.
- `@qa`: cenários de concorrência, transição e revisão funcional.
- `@architect`: revisar entrega de evento e consistência entre Google, vínculo local e motor, se exigir novo padrão.
- `@devops`: PR/deploy, quando solicitados.

### Quality Gate Tasks

- [ ] Pre-Commit (`@dev`): lint, typecheck, test, build e revisão da idempotência.
- [ ] Pre-PR (`@devops`): compatibilidade da configuração versionada, quando houver PR.
- [ ] Pre-Deployment (`@devops`): backup/autorização Vault para publicação e ensaio de rollback, quando houver deploy.

### Self-Healing Configuration

- `@dev`: light mode, até 2 iterações/15 minutos; corrigir CRITICAL, documentar HIGH.
- `@qa`: full mode, até 3 iterações/30 minutos; corrigir CRITICAL/HIGH.
- `@devops`: check mode, report only.

### CodeRabbit Focus Areas

- Evento emitido somente após vínculo confirmado; falhas posteriores não apagam reunião válida.
- Idempotência sob retry/concorrência e guarda contra card movido por outra ação.
- Uso da transição BPM, histórico/realtime e automação realmente visível na configuração.
- Nenhum vazamento de email, link privado, token ou payload do Google em logs/erros.

## Initial File List

- `docs/stories/story-alpha-crm-meet-avanco-automatico-reuniao-agendada.md` — esta story.
- `src/actions/bpm/GoogleMeet.ts` — previsto: emissão após vínculo e feedback.
- `src/lib/bpm/automacoes/central-schemas.ts` — previsto: gatilho específico, se necessário.
- `src/lib/bpm/automacoes/eventos.ts` e `fila.ts` — previstos: publicação idempotente.
- `src/lib/bpm/automacoes/central-runtime.ts` — revisar somente se o contrato atual de movimento não cobrir o caso.
- `src/actions/bpm/Pipelines.ts` e `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/PipelineWorkspaceSections.tsx` — revisar projeção da lista; editar somente se houver lacuna.
- `tests/bpm/` — previstos: action, motor, idempotência, projeção e UI.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-28 | 0.1 | Story criada para avanço automático após criação confirmada do Google Meet. | River (`@sm`) |

## Dev Agent Record

### Completion Notes

- Turso remoto `banco-alpha-alphacomex`: Revisão de Radar ativa; Agendar Reunião e Reunião Agendada ativas, transição `permitida=true`, origem `AMBOS`; a chave `agendar_reuniao_meet_para_reuniao_agendada` ainda não existe. Conta administrativa Vinicius de Souza Floriano (`TI`, ativa, ID 8) verificada em leitura.
- O vínculo da reunião, o histórico e o evento `REUNIAO_AGENDADA` da outbox são gravados na mesma transação. Depois do commit, o motor central é processado imediatamente. O movimento usa `executarTransicaoBpm`; se o card já saiu da origem, o gatilho da reunião não o reposiciona.
- Falha no processamento posterior ao commit mantém o Meet e retorna `avancoConcluido=false`; o modal informa que o avanço está pendente. Falha na criação ou vínculo ainda usa compensação existente e não publica evento.
- A lista azul passa a apresentar também a ação de cada automação. A nova definição usa a mesma projeção persistida/versionada da automação Fechado.
- Gates: `npm run lint` 0 erros, 1191 warnings preexistentes; `npm run typecheck` passou; `npm test` 536 arquivos e 3961 testes aprovados (4 skipped, 1 todo); `npm run build` passou.
- Vault verificou backup completo Turso `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-28T13-13-20-383Z.sql` (170.445.077 bytes; 332 tabelas; 180.760 linhas; SHA-256 `5d5417b27e3ae403a78104765e3a4939343d373def84c7d4ee99655491ea20c2`; restore, integridade e chaves estrangeiras verificados). O manifesto é `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-28T13-13-20-383Z.manifest.json`. Revalidar idade e hash imediatamente antes de publicar.
- Autorização específica recebida do usuário em 2026-09-28 para ativar no Turso com auditoria Vinicius (TI) e depois fazer commit. `scripts/verify-turso-backup.mjs` foi executado novamente com resultado `verified=true` antes da escrita.
- Publicação pontual via `scripts/configurar-avanco-meet-revisao-radar.mts --apply`: uma `BpmAutomacao` (`cmulcg51a000050ih9ned345t`), uma `BpmAutomacaoVersao` ativa (`cmulcg551000150ih34xdi78m`) e uma auditoria com `adminId=8`, na mesma transação; `configVersion` de 13 para 14. Leitura posterior confirmou regra ativa, uma versão ativa, gatilho `REUNIAO_AGENDADA`, ação `MOVER_CARD` e destino correto. Nenhum card existente foi movido.

### File List

- `docs/stories/story-alpha-crm-meet-avanco-automatico-reuniao-agendada.md`
- `src/actions/bpm/GoogleMeet.ts`
- `src/lib/bpm/automacoes/central-schemas.ts`
- `src/lib/bpm/automacoes/central-runtime.ts`
- `src/components/bpm/automacoes/AutomacaoCentralFormDialog.tsx`
- `src/components/bpm/automacoes/AutomacoesWorkspace.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `tests/bpm/automacoes-central.test.ts`
- `tests/bpm/google-meet-etapa-guard.test.ts`
- `tests/bpm/google-meet-convidados-input-react.test.ts`
- `scripts/configurar-avanco-meet-revisao-radar.mts`

## QA Results

Pendente.

## Story Draft Validation

| Category | Status | Issues |
| --- | --- | --- |
| Goal & Context Clarity | PASS | Gatilho, origem, destino e visibilidade na lista azul explícitos. |
| Technical Implementation Guidance | PASS | Action, motor, transição, projeção e riscos de consistência identificados. |
| Reference Effectiveness | PASS | Stories anteriores resumidas e referências com seção relevante. |
| Self-Containment Assessment | PASS | Falha, compensação, retry, concorrência e escopo delimitados. |
| Testing Guidance | PASS | Cenários mensuráveis para action, motor, UI e configuração. |
| CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e foco presentes. |

**Final Assessment:** READY como rascunho de implementação. A publicação da definição persistida no Turso depende do protocolo Vault e de confirmação específica do usuário.
