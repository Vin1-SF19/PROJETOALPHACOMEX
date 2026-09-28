# Story: Revisão de Radar — operação de Em tratativas

## Status

In Progress — configuração Turso publicada; envio do código e homologação pendentes

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `lint`, `typecheck`, `vitest`, `build`, revisão da configuração e homologação da Agenda Alpha

## Story

**Como** responsável comercial do Alpha CRM, **quero** concluir cada follow-up de **Em tratativas** somente com anotações e Próximo Contato válido, **para** manter a próxima ação visível na minha Agenda Alpha e no sino de notificações e conduzir o card aos destinos corretos.

## Contexto e limites

O pedido atual aplica-se somente ao pipeline ativo **Revisão de Radar**, etapa **Em tratativas** (plural, grafia da configuração ativa). Essa etapa ainda não tem formulário configurado. A jornada anterior termina em **Reunião Agendada**; há controles canônicos de Próximo Contato (`BpmCard.proximoContatoEm`) e de checklist do último follow-up, mas não se deve presumir que a configuração ativa da nova etapa já os publica. Respeitar a configuração efetiva e não aplicar regras pelo nome a outros pipelines.

O checklist de perguntas ainda será definido pelo usuário. Até lá, usar apenas a pergunta textual **“Anotações sobre o último follow-up”**, obrigatória; perguntas adicionais devem poder ser configuradas em **Configurações → Campos e Formulários**, preservando o snapshot dos follow-ups já iniciados. O script comercial da etapa permanece vazio até o usuário preenchê-lo na UI, sem texto inventado. A tarefa de Próximo Contato é da pessoa vinculada como responsável pelo card; a Agenda Alpha existente deve exibi-la e o sino usa o mecanismo de notificações dessa agenda, sem segunda notificação independente.

Esta story refina `story-alpha-crm-card-por-etapa-em-tratativa.md` para a configuração **recriada** da Revisão de Radar. A regra atual de saída é **Fechado, Lost, Stand By, Monitoramento, Sem viabilidade**, respeitando os nomes/IDs efetivos do pipeline. O rótulo antigo “Standby - Follow Up” daquela story não substitui o destino atual sem confirmação da configuração publicada.

## Acceptance Criteria

1. A etapa ativa **Em tratativas** exibe no card o controle canônico **Próximo Contato** e o formulário de follow-up com **Anotações sobre o último follow-up**. Os controles também aparecem em **Configurações → Campos e Formulários** do pipeline/etapa, com visibilidade, ordem e regras administráveis pela UI, sem criar cópia paralela de `proximoContatoEm`.
2. Próximo Contato exige data válida, persistida no card, ao concluir um follow-up. Valor ausente, inválido ou não confirmado pelo servidor bloqueia a conclusão com mensagem específica. A UI mostra o valor atual e permite edição autorizada; regras de data/hora existentes continuam coerentes com a configuração.
3. Cada nova interação/follow-up exige anotações textuais não vazias após `trim()`. A action de conclusão valida as respostas obrigatórias do snapshot no servidor; uma falha mantém o follow-up em andamento e não produz conclusão ou histórico parcial. Uma conclusão anterior não satisfaz uma interação nova.
4. O editor permite adicionar, editar, ordenar, obrigar/desobrigar e desativar perguntas do checklist para interações futuras; alterações posteriores não mudam as perguntas/respostas históricas. Enquanto não houver perguntas adicionais, apenas as anotações explícitas são exigidas.
5. O card só oferece e o servidor só aceita as cinco saídas de **Em tratativas**: **Fechado**, **Lost**, **Stand By**, **Monitoramento** e **Sem viabilidade**. Drag, modal e chamada direta convergem na mesma regra; destino proibido ou ambíguo não altera card nem histórico.
6. O script comercial específico de Em tratativas aparece no editor da etapa, editável, inicialmente vazio. O card mostra o script configurado quando existir; sua ausência não gera texto fictício nem bloqueio comercial extra.
7. Ao salvar ou alterar Próximo Contato de card ativo em Em tratativas, criar/atualizar **uma** tarefa vinculada ao card, no horário indicado, atribuída ao responsável vigente. A tarefa aparece na Agenda Alpha do usuário vinculado e alimenta o sino de notificações existente no topo do painel. Repetição, retry e concorrência não geram duplicatas.
8. Ao mudar o responsável, atualizar a atribuição da tarefa; ao limpar o contato, sair da etapa ou deixar o card inativo, cancelar/concluir a tarefa pendente conforme o contrato da Agenda Alpha, sem entregar lembrete antigo ao responsável anterior. Falhas de sincronização não indicam sucesso fictício e têm diagnóstico seguro.
9. A configuração da etapa, formulário, perguntas, cinco transições e script é verificável na UI administrativa e no card real após publicação. Alteração de configuração no Turso segue o protocolo **Vault** do `AGENTS.md`: relatório do ambiente/comandos/impacto/rollback, backup completo verificado de até 48 horas e confirmação específica antes da escrita. A autorização de outras etapas não vale para esta publicação.
10. Testes verificam data ausente/inválida, anotações vazias e preenchidas por interação, perguntas configuradas/snapshot histórico, cinco saídas e destinos recusados, formulário e script na UI, tarefa na agenda e sino do responsável, reatribuição, limpeza/saída, idempotência e falhas. Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar checklist e File List antes de concluir.

## Tasks / Subtasks

- [x] Inventariar configuração ativa da Revisão de Radar e confirmar IDs/rótulos, formulário ausente e fonte canônica dos controles.
- [x] Publicar controles configuráveis, perguntas de follow-up, transições e script vazio após gate Vault.
- [x] Validar Próximo Contato e anotações na conclusão, em todos os caminhos de ação, mantendo histórico consistente.
- [x] Integrar tarefa de Próximo Contato à Agenda Alpha do responsável e ao sino existente, com atualização/cancelamento idempotente.
- [ ] Cobrir casos de negócio, UI, integração e regressão; executar gates e homologar card real. Gates completos; homologação real pendente da publicação.
- [x] Atualizar checklist, File List, QA Results e Change Log.

## Dev Notes

- Reutilizar `BpmCard.proximoContatoEm`, `BpmChecklistFollowUp` e `BpmChecklistFollowUpPergunta`. O catálogo pode ser configurado depois; não inventar perguntas comerciais.
- Pontos de entrada: `src/actions/bpm/Cards.ts`, actions do checklist, `src/lib/bpm/em-tratativa.ts`, painéis `PainelProximoContato`/`PainelChecklistFollowUp`, `FormularioEtapaWorkspace.tsx`, `src/lib/bpm/proximo-contato-agenda.ts`, `src/lib/bpm/alertas-tarefas.ts` e Agenda Alpha. Confirmar os caminhos reais antes da edição.
- O sino já consome notificações da Agenda Alpha; evitar mecanismo paralelo. Preservar autorização do card e da agenda, registrar somente dados mínimos na tarefa e não vazar dados a outro usuário.
- Qualquer necessidade de migration, seed ou backfill aciona Vault **antes** da execução. Preferir recursos existentes se bastarem.

## Testing

Testes de domínio/actions em `tests/bpm/` e integração da Agenda Alpha nos testes pertinentes. Homologação autenticada deve confirmar formulário editável, conclusão com anotação e data, tarefa na agenda do responsável e notificação no topo; teste automatizado não substitui a verificação da configuração Turso publicada.

## 🤖 CodeRabbit Integration

**Story Type Analysis:** Full-stack, configuração BPM e integração interna com Agenda Alpha; complexidade alta.

**Specialized Agent Assignment:** `@dev` implementa e revisa; `@qa` valida; `@ux-design-expert` avalia controles/editabilidade; `Vault` conduz a escrita configuracional protegida; `@devops` participa de eventual deploy.

**Quality Gate Tasks:**

- [ ] Pre-Commit (`@dev`): lint, typecheck, testes, build, revisão de autorização e idempotência.
- [ ] Pre-PR (`@devops`): compatibilidade se houver PR.
- [ ] Pre-Deployment (`@devops`): configuração, backup/rollback e integração da agenda se houver publicação.

**Self-Healing Configuration:** `@dev` light (até 2 iterações/15 min; CRITICAL corrigir, HIGH documentar); `@qa` full (até 3 iterações/30 min; CRITICAL/HIGH corrigir); `@devops` check/report only.

**CodeRabbit Focus Areas:** guard server-side, campos canônicos, autorização do responsável, snapshot de perguntas, não duplicar tarefas/notificações, rollback em falha, isolamento do pipeline ativo.

## Checklist de conclusão

- [ ] AC 1–10 verificados com evidência.
- [x] Gate Vault cumprido antes de publicar configuração Turso.
- [x] `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` aprovados ou falhas basais documentadas.
- [ ] QA e homologação da Agenda Alpha concluídos.
- [ ] File List e Change Log atualizados.

## File List

- `docs/stories/story-alpha-crm-revisao-radar-em-tratativas.md` — story, checklist e resultado dos gates.
- `scripts/configurar-em-tratativas-radar.mts` — prévia e publicação protegida da configuração.
- `src/actions/bpm/Cards.ts`, `FollowUp.ts`, `FormulariosEtapa.ts`, `PerguntasFollowUp.ts` — validações e catálogo configurável.
- `src/lib/bpm/em-tratativa.ts`, `transicao-command.ts`, `proximo-contato-agenda.ts`, `alertas-tarefas.ts` — transições, tarefa e alertas.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximoContato.tsx` — edição e limpeza do contato.
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx`, `PerguntasFollowUpEditor.tsx` — UI administrativa.
- `src/actions/google-calendar-agenda.ts`, `src/components/CalendarioAlpha/lib/tipos.ts`, `useAgendaAlphaController.ts` — tarefa na Agenda Alpha.
- `src/app/api/bpm/jobs/alertas-tarefas/route.ts`, `vercel.json` — processamento programado de alertas.
- `tests/bpm/edicao-campos-card.test.ts`, `em-tratativa.test.ts`, `followup-em-tratativas-action.test.ts`, `formularios-etapa-save.test.ts`, `perguntas-followup-config.test.ts`, `pipeline-editor-react.test.ts`, `proximo-contato-agenda.test.ts`, `relacionamento-ui.test.ts`, `tarefas-tipo-actions.test.ts`, `tests/google-calendar/agenda-snapshot.test.ts` — testes e mocks atualizados.

## QA Results

- QA read-only: APPROVED para o código; identificou e confirmou a correção de bloqueio de controles obrigatórios, limpeza da tarefa e retentativa do alerta após falha Pusher.
- `npm run typecheck` e `npm run build`: aprovados. `npm test`: 542 arquivos, 3993 testes aprovados, 4 ignorados, 1 TODO. `npm run lint`: 0 erros, 1191 avisos existentes.
- Homologação autenticada do card, Agenda Alpha e sino: pendente após publicação.
- Publicação Turso protegida: autorizada especificamente pelo usuário após prévia; backup completo de 170.445.077 bytes e 332 tabelas revalidado; auditor Vinicius de Souza Floriano (TI), ID 8. A configuração foi publicada na versão 17 e verificada por consulta somente leitura: formulário ativo, dois blocos e exatamente cinco saídas solicitadas.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-28 | 0.1 | Pedido Em tratativas, controles configuráveis, follow-up e tarefa na Agenda Alpha. | River (`@sm`) |
| 2026-09-28 | 0.2 | Código, prévia da configuração, testes focados e revisão QA; publicação protegida pendente. | Codex (`@dev`) |
| 2026-09-28 | 0.3 | Configuração publicada no Turso com autorização específica e verificação pós-escrita. | Codex (`@dev`) |

## Story Draft Validation

| Category | Status | Issues |
| --- | --- | --- |
| Goal & Context Clarity | PASS | Pedido, pipeline e benefício explícitos. |
| Technical Implementation Guidance | PASS | Fontes canônicas e pontos de integração identificados. |
| Reference Effectiveness | PASS | Regra anterior de Em Tratativa resumida e diferenças explicitadas. |
| Self-Containment Assessment | PASS | Script e perguntas pendentes preservados como configuráveis. |
| Testing Guidance | PASS | Cenários de domínio, UI e agenda mensuráveis. |
| CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e foco presentes. |

**Final Assessment:** READY para implementação; publicação no Turso depende do gate Vault e confirmação específica.
