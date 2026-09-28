# Story: Revisão de Radar — entrada em Lost e data da perda

## Status

In Progress — catálogo aprovado; publicação condicionada ao gate Vault

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `lint`, `typecheck`, `vitest`, `build`, revisão da configuração e homologação do card

## Story

**Como** responsável comercial do Alpha CRM, **quero** escolher um motivo antes de mover um card para **Lost** e poder contextualizá-lo, **para** registrar perdas consistentes e medir quando ocorreram.

## Contexto e limites

Aplica-se à etapa **Lost** do pipeline ativo **Revisão de Radar**. O inventário recebido para esta story indica que a configuração ativa de Lost ainda não possui campos nem formulário publicados; reconfirmar antes de escrever. A etapa **Em tratativas** já inclui Lost entre suas cinco saídas. A entrega deve manter a definição dos campos, da obrigatoriedade, das opções, da visibilidade e da ordem administrável em **Configurações → Campos e Formulários**, sem criar valores paralelos ou fixar IDs de banco no código.

O usuário pediu **Motivo do Lost** obrigatório, preferencialmente Select; **Observação complementar** para contextualização quando necessária; bloqueio da entrada sem motivo; abertura do campo ao selecionar Lost; e data da perda para métricas. O usuário confirmou nesta sessão o catálogo: **Sem orçamento**, **Escolheu concorrente**, **Sem resposta**, **Empresa não tem viabilidade** e **Outro**. A observação geral pedida agora não deve ser presumida idêntica ao antigo campo condicional `Motivo de Lost - Outro`; o pipeline ativo não possui esse companion associado.

Não alterar **Fechado** nem as outras quatro saídas de Em tratativas. Não criar migration, seed ou backfill por conveniência. Se a data da entrada em Lost já estiver no histórico persistido de transições, reutilizá-la como fonte para a métrica; confirmar esse contrato antes de propor campo novo.

## Acceptance Criteria

1. **Configurações → Campos e Formulários** permite administrar, na etapa Lost da Revisão de Radar, **Motivo do Lost** como Select obrigatório: rótulo, opções, ordem, visibilidade e obrigatoriedade ficam persistidos na configuração existente e refletem no card, sem ID ou catálogo hardcoded.
2. O catálogo de motivos usado em produção é documentado e confirmado antes da publicação. A configuração publicada não pode deixar um Select obrigatório sem opções válidas; opções históricas não são republicadas apenas por existirem em story antiga.
3. A mesma UI permite administrar **Observação complementar** como campo textual visível em Lost e opcional por padrão, com possibilidade de ajustar suas propriedades suportadas pelo editor. A ausência dessa observação não bloqueia o movimento enquanto sua configuração for opcional.
4. Ao selecionar Lost como destino no card, o formulário de requisitos exibe **Motivo do Lost** como obrigatório e **Observação complementar** para contexto. A conclusão permanece bloqueada e informa a pendência enquanto o motivo não for informado; o mesmo vale para opção fora do catálogo vigente.
5. Todo caminho de movimento autorizado para Lost — painel do card, arrastar no board e action direta — aplica a validação no servidor conforme a configuração persistida. Motivo ausente/inválido ou configuração essencial inconsistente impede mudança de etapa, valores, histórico parcial e sinalização de sucesso.
6. Ao concluir o movimento para Lost, motivo e observação preenchida são persistidos junto com a transição. O card já em Lost exibe os campos conforme a configuração para consulta e edição autorizada, sem perder a exigência do motivo válido.
7. Cada entrada efetiva em Lost possui uma **data da perda** recuperável para métricas, vinculada ao evento persistido de entrada na etapa e sem depender do relógio do navegador. Reentrada gera novo evento; métricas que precisem de uma data por card usam a entrada atual/mais recente, documentada na implementação. Movimento recusado não registra perda.
8. Configurações futuras de campos/opções pela UI refletem na validação e apresentação sem alterar código. Se uma mudança de catálogo invalidar valor antigo, o sistema não interpreta silenciosamente esse valor como opção válida para uma nova entrada ou edição.
9. A publicação de configuração no banco respeita o protocolo Vault do `AGENTS.md`: ambiente/comandos/impacto/risco/alternativa/rollback apresentados, backup completo verificado de até 48 horas, relatório Vault e confirmação específica do usuário antes da escrita. Autorizações para outras etapas não cobrem Lost.
10. Testes cobrem editor/configuração, ausência e invalidade do motivo, observação opcional, painel e drag/action, edição, consistência transacional, data de perda/reentrada e ausência de evento em falha. Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar checklist e File List antes da conclusão.

## Tasks / Subtasks

- [x] Reconfirmar inventário ativo de Lost e os caminhos de entrada/edição; documentar a fonte persistida da data de perda (AC: 1, 5–7).
- [x] Obter e documentar catálogo de motivos aprovado para esta configuração antes da publicação; preparar prévia das alterações de campos e formulário (AC: 1–3, 9).
- [x] Preparar configuração de motivo obrigatório e observação opcional, sem publicar no banco antes do gate Vault (AC: 1–3, 8–9).
- [x] Garantir apresentação e bloqueio nos movimentos para Lost e edição de card já perdido, com validação autoritativa no servidor (AC: 4–6, 8).
- [x] Expor a data de entrada efetiva em Lost para métricas usando a fonte persistida confirmada, incluindo reentrada e falha sem evento (AC: 7).
- [ ] Publicar a configuração após aprovação específica e homologar no card real (AC: 1–9).
- [x] Executar testes e quality gates locais (AC: 10).
- [ ] Atualizar checklist, QA Results, Change Log e File List exata antes do handoff (AC: 10).

## Dev Notes

- [Source: `docs/stories/story-alpha-crm-lost-motivo.md#contexto-e-escopo`] A implementação anterior validava motivo no servidor em criação/movimento/edição e tinha opção `Outro` com campo companion. Ela descreve um estado anterior do banco; não prova que os campos ou opções existam no pipeline atual.
- [Source: `.bibble/memory/plano-novos-leads-bpm.md#coluna-6--lost-desenho-tecnico-por-sub-feature`] A primeira especificação deixou o catálogo de motivos pendente. Uma seção posterior fechou cinco opções para o desenho anterior; o pedido atual volta a declarar os critérios pendentes.
- [Source: `docs/stories/story-alpha-crm-revisao-radar-em-tratativas.md#acceptance-criteria`] Lost é uma das cinco saídas permitidas de Em tratativas no pipeline recriado. Esta story não redefine a matriz de saídas.
- [Source: `docs/stories/story-rm-2026-fe6c53-desenho-pipelines.md`] Transições são persistidas em `BpmTransicaoEtapa`; não presumir que editar Lost exige migration.
- Pontos de integração a verificar: `src/lib/bpm/lost.ts`, `src/lib/bpm/transicao-command.ts`, `src/actions/bpm/Cards.ts`, `src/actions/bpm/Campos.ts`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelRequisitosAvanco.tsx`, `PainelCamposEtapaAtual.tsx` e `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx`.
- `docs/stories/accumulated-context.md` e `.aiox/gotchas.json` não existem neste workspace; coerência conferida nas stories relacionadas acima. Os arquivos gerais de arquitetura descritos em `.aiox-core/core-config.yaml` também não estão presentes; os caminhos técnicos aqui são pontos de investigação, não decisões de arquitetura.
- [AUTO-DECISION] “Observação complementar” → campo textual opcional por padrão, pois o usuário a recomenda apenas quando necessária. Obrigatoriedade futura segue capacidades reais da UI.
- [AUTO-DECISION] Fonte da data de perda → investigar histórico da transição antes de considerar dado novo; evita migration sem requisito explícito.
- [Finding 2026-09-28] Pipeline remoto `cmuih48la000009gmzw3wwuzf` (versão 17 no inventário), etapa Lost `draft-stage-2428ce47-2fef-4746-83cd-09d587161153`: nenhum campo ou formulário associado. `CARD_MOVIDO` é persistido na transação com `createdAt` e `valorNovoJson.etapaId`; a entrada mais recente em Lost pode ser extraída desses eventos para métricas, sem alterar schema.
- [User confirmation 2026-09-28] Catálogo aprovado: Sem orçamento; Escolheu concorrente; Sem resposta; Empresa não tem viabilidade; Outro.
- [Vault 2026-09-28] Backup Turso completo `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-28T19-09-02-200Z.sql`, 175145855 bytes, 332 tabelas, 184037 linhas, SHA-256 `c4dc3197a0454a69aa8f7c0ad140d93788b4016fa021bcc286a97e9ffdc587fb`; manifesto correspondente. Restore local, `integrity_check`, `foreign_key_check`, contagem de tabelas/linhas e hash verificados. Validade máxima de 48 horas antes da execução.
- [Publication] `npx tsx scripts/configurar-lost-radar.mts --preview` é somente leitura; `--apply` exige backup/manifeste, versão vigente, admin de auditoria e token específico de aprovação. Faz duas inserções de campos, cinco opções, duas configurações por etapa, um formulário, uma seção, dois componentes, um registro de auditoria e incremento de `configVersion` em transação. Nenhuma migration/seed/backfill/alteração de outros estágios. Reverter por exclusão seletiva dos registros novos após checagem de versão e uso, preservando quaisquer cards/edições posteriores; dump completo só como último recurso controlado.

## Testing

Usar testes de domínio/actions e UI existentes em `tests/bpm/`. Verificar catálogo configurado, campo obrigatório vazio/inválido, observação vazia/preenchida, acesso direto à action, drag, painel do card, configuração alterada, escrita atômica, entrada e reentrada em Lost e nenhuma data/histórico em tentativa recusada. Homologação autenticada deve confirmar campos no editor e no card real; teste automatizado isolado não comprova publicação no Turso.

## 🤖 CodeRabbit Integration

**Story Type Analysis:** Full-stack, configuração BPM e frontend; complexidade média/alta por validação transversal e dados de métricas.

**Specialized Agent Assignment:** `@dev` implementa; `@qa` valida; `@ux-design-expert` revisa campos/acessibilidade; Vault conduz o gate de publicação de dados; `@devops` participa somente se houver deploy/PR.

**Quality Gate Tasks:**

- [ ] Pre-Commit (`@dev`): lint, typecheck, testes, build e CodeRabbit no diff da story.
- [ ] Pre-PR (`@devops`): compatibilidade e CodeRabbit se houver PR.
- [ ] Pre-Deployment (`@devops`): configuração, backup/rollback e homologação se houver publicação.

**Self-Healing Configuration:** `@dev` light, até 2 iterações/15 min (CRITICAL corrigir; HIGH documentar); `@qa` full, até 3 iterações/30 min (CRITICAL/HIGH corrigir); `@devops` check/report only. MEDIUM documentar como dívida quando pertinente; LOW avaliar no review.

**CodeRabbit Focus Areas:** ausência de bypass server-side, catálogo vindo da UI, acessibilidade do requisito, atomicidade do movimento, data de perda por evento efetivo, isolamento da etapa Lost e nenhuma alteração de Fechado.

## Checklist de conclusão

- [x] Catálogo aprovado; opções a conferir na UI após publicação.
- [ ] AC 1–10 verificados com evidência.
- [ ] Vault, backup e confirmação específica cumpridos antes de alterar a configuração Turso.
- [x] `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` executados; lint 0 erros/1191 avisos existentes, typecheck limpo, 545 arquivos/4004 testes passando, build concluído com avisos de pdfjs preexistentes.
- [ ] QA, homologação do card e File List final concluídos.

## File List

- `docs/stories/story-alpha-crm-revisao-radar-lost.md`
- `scripts/configurar-lost-radar.mts`
- `src/actions/bpm/Cards.ts`
- `src/lib/bpm/data-perda.ts`
- `src/lib/bpm/transicao-command.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx`
- `tests/bpm/data-perda.test.ts`

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-28 | 0.1 | Pedido Lost no pipeline recriado, com catálogo pendente e data da perda. | River (`@sm`) |
| 2026-09-28 | 0.2 | Catálogo confirmado, implementação e prévia prontas, backup verificado; publicação pendente de aprovação Vault. | Codex (`@dev`) |

## Dev Agent Record

Implementação e quality gates locais concluídos. Configuração remota e homologação aguardam aprovação específica do usuário conforme AGENTS.md. O evento `CARD_MOVIDO.createdAt`, filtrado por etapa de destino, é a fonte da data da perda; a resposta de `ObterCardBpm` expõe a última entrada em Lost como `dataPerdaEm` quando o card está em Lost.

## QA Results

Pendente.

## Story Draft Validation

| Category | Status | Issues |
| --- | --- | --- |
| Goal & Context Clarity | PASS | Pedido, pipeline e benefício mensurável explícitos. |
| Technical Implementation Guidance | PARTIAL | Fonte da data de perda e configuração ativa devem ser reconfirmadas pelo executor. |
| Reference Effectiveness | PASS | Histórias anterior e atual resumidas com diferenças de estado. |
| Self-Containment Assessment | PARTIAL | Catálogo de motivos depende de definição do usuário antes da publicação. |
| Testing Guidance | PASS | Casos de fluxo, bloqueio e métrica são verificáveis. |
| CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e focos presentes. |

**Final Assessment:** READY para investigação e implementação local; publicação da configuração fica pendente do catálogo aprovado e do gate Vault.
