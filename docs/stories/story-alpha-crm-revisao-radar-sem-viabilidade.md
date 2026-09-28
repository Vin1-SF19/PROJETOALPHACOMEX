# Story: Revisão de Radar — entrada em Sem viabilidade e lembrete de Próximo Contato

## Status

In Progress — código pronto; publicação Turso pendente de autorização específica

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `lint`, `typecheck`, `vitest`, `build`, revisão da configuração e homologação da Agenda Alpha

## Story

**Como** responsável por um card da Revisão de Radar, **quero** que Sem viabilidade exija Próximo Contato e crie um lembrete para essa data, **para** que a decisão tenha um retorno programado e visível na minha agenda.

## Contexto e limites

Esta story se aplica à etapa ativa **Sem viabilidade** do pipeline **Revisão de Radar**. O inventário recebido aponta etapa `draft-stage-fbd48b37-faa8-4740-aa50-61e925a36ac5`, `ehFinal=true`, sem formulário e sem capacidades publicadas, com pipeline em `configVersion=19`; reconfirmar esses dados imediatamente antes de publicar. O pedido exige **Próximo Contato obrigatório para entrada**, bloqueio do movimento vazio e tarefa/lembrete na data informada. O controle e a regra devem aparecer em **Configurações → Campos e Formulários** desta etapa.

Usar o valor canônico `BpmCard.proximoContatoEm`, sem criar outro campo de data desconectado do card. Há um helper `etapaExigeProximoContato` que reconhece Sem Viabilidade, mas o comando atual de transição valida apenas Em tratativas manualmente; a sincronização atual com a Agenda Alpha também atende apenas Em tratativas com status `ATIVO`. Portanto, a presença do helper não comprova que a etapa publicada esteja protegida nem que o lembrete seja gerado. A story anterior `story-alpha-crm-sem-viabilidade-proximo-contato.md` foi supersedida quanto à criação direta: a criação normal ocorre em Novo Lead; focar na entrada por movimento e no fluxo do card existente.

Não acrescentar restrição de data futura, prazo, cadência, destinatário alternativo ou transições de saída que o usuário não especificou. A regra de entrada deve seguir a configuração vigente da UI, mantendo validação autoritativa no servidor. Para o lembrete, aproveitar a Agenda Alpha e o mecanismo de notificação existentes, respeitando o responsável vinculado ao card. O caráter final da etapa precisa ser contemplado explicitamente para que não suprima o lembrete pedido.

## Acceptance Criteria

1. Em **Configurações → Campos e Formulários** da Revisão de Radar, Sem viabilidade expõe **Próximo Contato** como requisito de entrada com rótulo, visibilidade, ordem e obrigatoriedade administráveis conforme as capacidades existentes do editor. O card mostra e permite editar o mesmo valor canônico, sem criar uma cópia divergente.
2. Com a configuração obrigatória publicada, selecionar Sem viabilidade como destino exibe Próximo Contato e a pendência quando vazio; o usuário autorizado pode informar a data/hora no fluxo de avanço. O movimento só conclui após valor válido e confirmado pelo servidor.
3. Drag no board, modal do card e chamada direta da action convergem na validação server-side. Valor ausente, inválido, não salvo ou removido por atualização concorrente bloqueia a entrada com mensagem específica, sem alterar etapa, criar histórico parcial ou sinalizar sucesso.
4. Se Próximo Contato for informado durante o movimento, valor e transição são persistidos de modo coerente; o card já em Sem viabilidade apresenta a data confirmada e permite ajuste autorizado. A configuração pela UI governa a obrigatoriedade de entrada, sem um bloqueio permanente hardcoded que contradiga alteração administrativa posterior.
5. Ao entrar em Sem viabilidade com Próximo Contato, a integração cria ou atualiza **uma** tarefa/lembrete do card para essa data na Agenda Alpha do responsável vinculado. A tarefa fica visível no calendário e usa o sino de notificações já alimentado pela agenda, inclusive apesar de a etapa ser marcada final.
6. Editar a data ou trocar o responsável atualiza o lembrete existente; reprocessamento/retry não duplica tarefas. Limpeza posterior ou saída da etapa retira ou atualiza o lembrete obsoleto conforme o contrato atual da Agenda Alpha, sem notificar o responsável antigo.
7. O formulário e a regra publicados podem ser vistos e ajustados pela UI administrativa; alterações futuras de configuração são refletidas no card e na validação sem editar código ou depender de IDs de banco fixos. Autorizações de card, pipeline, edição e agenda continuam aplicadas.
8. A publicação no Turso segue o gate **Vault** do `AGENTS.md`: relatar ambiente, comandos, impacto, risco, alternativa e rollback; verificar backup completo com até 48 horas; obter relatório Vault e confirmação específica do usuário antes de escrever. Aprovações de outras etapas não se aplicam.
9. Testes cobrem configuração, entrada sem data e com data, drag/modal/action, concorrência, persistência atômica, tarefa na etapa final, agenda/sino, edição, reatribuição, limpeza e idempotência. Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar checklist e File List antes de concluir.

## Tasks / Subtasks

- [x] Reconfirmar inventário ativo da etapa, caminhos de movimento e contrato do Próximo Contato canônico (AC: 1–4).
- [x] Preparar prévia de formulário/requisito configurável em Sem viabilidade e revisar impacto na UI administrativa, sem gravar banco antes do gate Vault (AC: 1, 7–8).
- [x] Unificar requisito de entrada no executor de transição, com validação na transação e apresentação nos fluxos de card/board (AC: 2–4).
- [x] Estender sincronização da Agenda Alpha à etapa final, com vínculo ao responsável, atualização e idempotência; conferir o sino existente (AC: 5–6).
- [ ] Publicar configuração somente após relatório Vault, backup e confirmação específica; conferir configuração remota e card real (AC: 7–8).
- [x] Cobrir testes e quality gates; atualizar checklist, QA Results, Change Log e File List (AC: 9).

## Dev Notes

- [Source: `docs/stories/story-alpha-crm-sem-viabilidade-proximo-contato.md#contexto`] Story anterior registra o guard de entrada e seu helper, mas também a supersessão da criação direta. Não repetir o fluxo de criação em Sem viabilidade.
- [Source: `docs/stories/story-alpha-crm-revisao-radar-em-tratativas.md#acceptance-criteria`] Em tratativas já conecta Próximo Contato à Agenda Alpha e ao sino; reutilizar essa integração, sem tarefa ou notificação paralela.
- [Source: `docs/stories/story-alpha-crm-card-por-etapa-em-tratativa.md#acceptance-criteria`] O valor canônico é `BpmCard.proximoContatoEm`; a mesma story cita Sem Viabilidade entre os destinos protegidos pelo requisito.
- [Inventário informado nesta missão] Sem viabilidade está final, sem formulário/capacidades; `etapaExigeProximoContato` a reconhece, mas o comando de transição e a agenda ainda não cobrem a etapa no fluxo ativo. Reconfirmar antes de implementar/publicar.
- Pontos de integração a examinar: `src/lib/bpm/em-tratativa.ts`, `src/lib/bpm/transicao-command.ts`, `src/lib/bpm/proximo-contato-agenda.ts`, `src/actions/bpm/Cards.ts`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximoContato.tsx`, `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx` e testes em `tests/bpm/`. Os caminhos são pistas, não prescrição de arquitetura nova.
- `docs/stories/accumulated-context.md` e `.aiox/gotchas.json` não existem neste checkout. Coerência entre stories foi conferida nas referências acima. A configuração do projeto aponta para arquitetura sharded, mas os artefatos gerais não foram usados como fonte de requisitos adicionais.
- [AUTO-DECISION] O lembrete pertence ao responsável vigente do card e usa a Agenda Alpha existente, pois o pedido não define outro destinatário e a etapa Em tratativas já segue esse contrato.
- [AUTO-DECISION] Próximo Contato continua sendo regra de **entrada**; a edição posterior segue o fluxo normal do card, enquanto o lembrete acompanha o valor atual.

## Testing

Usar testes de domínio e actions em `tests/bpm/` e integração existente da Agenda Alpha. Verificar em card real autorizado a pendência no avanço, o valor após movimentação, o controle administrativo, a tarefa no calendário do responsável e a notificação no topo. Testes isolados não comprovam publicação Turso nem renderização autenticada da agenda.

## 🤖 CodeRabbit Integration

**Story Type Analysis:** Full-stack, configuração BPM e integração interna com Agenda Alpha; complexidade média/alta devido ao guard transacional e à etapa final.

**Specialized Agent Assignment:** `@dev` implementa; `@qa` valida; `@ux-design-expert` revisa controle e acessibilidade; Vault conduz o gate da publicação; `@devops` cuida de eventual push/deploy.

**Quality Gate Tasks:**

- [x] Pre-Commit (`@dev`): lint, typecheck, testes, build e revisão de concorrência/autorização.
- [ ] Pre-PR (`@devops`): compatibilidade e CodeRabbit se houver PR.
- [ ] Pre-Deployment (`@devops`): configuração, rollback e integração de agenda se houver publicação.

**Self-Healing Configuration:** `@dev` light, até 2 iterações/15 min (CRITICAL corrigir; HIGH documentar); `@qa` full, até 3 iterações/30 min (CRITICAL/HIGH corrigir); `@devops` check/report only. MEDIUM documentar como dívida quando pertinente; LOW avaliar no review.

**CodeRabbit Focus Areas:** guard no servidor e dentro da transação; formulário editável sem data duplicada; etapa final com tarefa ativa; idempotência e reatribuição; autorização do responsável; isolamento da Revisão de Radar; ausência de efeitos em falha.

## Checklist de conclusão

- [ ] AC 1–9 verificados com evidência; publicação e homologação remota pendentes.
- [x] Gate Vault preparado: backup completo verificado; execução depende de autorização específica.
- [x] `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` executados.
- [ ] QA e homologação do card e da Agenda Alpha concluídos.
- [x] File List e Change Log atualizados.

## File List

- `docs/stories/story-alpha-crm-revisao-radar-sem-viabilidade.md` — story e evidências.
- `scripts/configurar-sem-viabilidade-radar.mts` — prévia e publicação protegida da configuração.
- `src/lib/bpm/formularios-etapa.ts` — opção de obrigatoriedade na entrada.
- `src/lib/bpm/campos-formulario-publicado.ts` — leitura da regra publicada.
- `src/lib/bpm/em-tratativa.ts` — identificação da etapa e validação canônica.
- `src/lib/bpm/transicao-command.ts` — bloqueio transacional de entrada.
- `src/lib/bpm/proximo-contato-agenda.ts` — sincronização da tarefa na etapa final.
- `src/actions/bpm/Cards.ts` — requisitos de movimento.
- `src/actions/google-calendar-agenda.ts` — tarefa visível na Agenda Alpha.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx` — edição da data durante o movimento.
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx` — controle em Campos e Formulários.
- `tests/bpm/sem-viabilidade-proximo-contato-config.test.ts` — requisito e tarefa.
- `tests/bpm/proximo-contato-agenda.test.ts` — atualização de descrição da tarefa.
- `tests/bpm/transicao-requisitos-card-react.test.ts` — preenchimento no modal de movimento.
- `tests/google-calendar/agenda-snapshot.test.ts` — filtro da Agenda Alpha.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-28 | 0.1 | Story da etapa Sem viabilidade, com requisito de entrada e lembrete configuráveis. | River (`@sm`) |
| 2026-09-28 | 0.2 | Implementação, testes focados e prévia de publicação; aguardando autorização Turso. | Codex (`@dev`) |

## Dev Agent Record

Configuração remota conferida em modo leitura: Revisão de Radar v19, Sem viabilidade sem formulário. Prévia de publicação validada; nenhuma escrita no Turso. Backup Vault de 2026-09-28 19:32 UTC: 332 tabelas, 189.249 linhas, verificação de integridade e restauração temporária aprovada, SHA-256 `71b6f01983ea482075cb399103b1b83f6005cd6aec4e35630b86cbcf8dbed2fc`. Testes focados: 4 arquivos, 15 testes passaram. `npm run typecheck`, `npm test` (546 arquivos, 4.008 testes) e `npm run build` passaram. `npm run lint` passou com 0 erros e 1.191 avisos preexistentes.

## QA Results

### Review Date: 2026-09-28

### Reviewed By: Quinn (Test Architect)

### Code Quality Assessment

**APPROVED para o código preparado.** A regra de entrada lê o bloco publicado no formulário e valida Próximo Contato dentro da transação de movimento. O modal permite informar data e hora no mesmo movimento. A tarefa de agenda usa o identificador único do card, acompanha data e responsável e aparece no filtro da Agenda Alpha. A descrição é atualizada quando o card passa de Em tratativas para Sem viabilidade sem mudar data ou responsável.

### Compliance Check

- Lint: aprovado, zero erros (1.191 avisos existentes).
- Typecheck: aprovado.
- Testes: 546 arquivos, 4.008 testes aprovados; quatro arquivos focados, 15 testes aprovados.
- Build: aprovado.
- ACs funcionais de código: atendidos na revisão. Publicação Turso e homologação autenticada dependem da autorização específica prevista no AGENTS.md.

### Security and Reliability Review

- O guard autoritativo está na transação; a prévia do modal não substitui a validação do servidor.
- O valor canônico é `BpmCard.proximoContatoEm`; a tarefa é vinculada ao responsável vigente do card.
- A prévia do script não grava dados. A execução requer backup verificado, versão esperada, auditor e confirmação específica.

### Gate Status

**APPROVED** para implementação pré-publicação. A verificação do formulário publicado e de um card real na Agenda Alpha permanece para depois da autorização e do deploy.

## Story Draft Validation

| Category | Status | Issues |
| --- | --- | --- |
| Goal & Context Clarity | PASS | Etapa, requisito, benefício e limites explícitos. |
| Technical Implementation Guidance | PASS | Controle canônico, caminhos de transição e integração de agenda identificados. |
| Reference Effectiveness | PASS | Histórias anteriores resumidas, inclusive supersessão da criação direta. |
| Self-Containment Assessment | PASS | Regras de entrada, comportamento do lembrete e etapa final descritos. |
| Testing Guidance | PASS | Fluxos, falhas, concorrência, agenda e publicação verificáveis. |
| CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e focos definidos. |

**Final Assessment:** READY para implementação; publicação do banco depende de gate Vault e confirmação específica.
