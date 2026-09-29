# Story — Operacional: Revisão do protocolo feito

## Status

Draft — prazo de 24 horas e dois itens que devem estar em “Sim” definidos; fonte do instante do protocolo e referência documental ainda exigem inventário.

## Story

**Como** responsável pela revisão do protocolo no pipeline Operacional, **quero** conferir documentos e códigos, registrar data e número do protocolo e identificar pendências e atrasos, **para** concluir a revisão com os dados mínimos e no prazo definido.

## Contexto e fonte

- Pedido direto do usuário para a coluna **Revisão do protocolo feito** (etapa publicada como **Revisão do protocolo**): **Data do protocolo** e **Número do protocolo** obrigatórios; conferir se todos os documentos foram juntados e se possuem códigos corretos; revisar o quanto antes/no mesmo dia do protocolo; alertas visuais de pendência/atraso; impedir conclusão sem data e número; todos os campos configuráveis em **Configurações → Campos e Formulários**. Em respostas posteriores, o usuário definiu **dois itens obrigatórios no formulário** (“documentos juntados” e “códigos corretos”), prazo de revisão **até 24 horas após o protocolo** e bloqueio da conclusão até **ambos estarem em “Sim”**.
- Inventário somente leitura do pipeline Operacional ativo, ID `cmuih4tnh000409gm5z34jvss`, versão **11**: etapa `draft-stage-3297611b-1023-4993-978d-01986d834e5c`, ordem 6, ativa, sem cards; 23 campos herdados, sem data/número do protocolo ou campos próprios de documentos/códigos no catálogo publicado `BpmCampo`. Formulário v3 com seções herdadas, inclusive checklist Excel. Não há automações, SLA, requisitos de avanço nem template de checklist específicos desta etapa. A única saída permitida é **Revisão do protocolo → Aguardando despacho**, sem requisitos de transição. Revalidar versão imediatamente antes de qualquer publicação.
- `scripts/bpm-aplicar-mapeamento-campos-etapas.mjs` lista Data do protocolo, Número do protocolo, Informações de conferência e Documentos/códigos utilizados como mapeamento desejado para esta etapa. Esse script e o relatório histórico `docs/reports/crm-campos-etapas-2026-09-24.csv` **não representam a configuração atualmente publicada**; não executar o script como substituto de inventário ou decisão de produto.
- A story `docs/stories/story-alpha-crm-operacional-processo-revisado.md` define a etapa anterior e o SLA de até 24 horas após o processo ficar pronto para **protocolar**. Esta etapa tem outro SLA de **24 horas após o protocolo efetivo** para revisar. Um campo legado `Processo.dataProtocolo` existe no schema, mas sua existência não prova vínculo com a etapa configurável nem preenchimento real.
- `docs/stories/accumulated-context.md` e `.aiox/gotchas.json` não existem neste checkout. `[AUTO-DECISION]` A coerência foi verificada nas stories Operacional disponíveis e no inventário publicado; não se presume conteúdo dos arquivos ausentes.

## Requisitos e critérios de aceite

1. [ ] A etapa permite configurar e preencher **Data do protocolo** e **Número do protocolo** como campos obrigatórios em **Configurações → Campos e Formulários**. Os valores salvos persistem, reaparecem no card e são validados também no servidor conforme a versão publicada.
2. [ ] A conclusão da revisão, inclusive a saída **Revisão do protocolo → Aguardando despacho**, é bloqueada quando Data do protocolo **ou** Número do protocolo estiver vazio/inválido. O usuário vê quais campos faltam; após preenchê-los, os demais requisitos publicados continuam a ser avaliados.
3. [ ] O formulário inclui **dois itens obrigatórios e separados**: “Todos os documentos foram juntados?” e “Os documentos possuem os códigos corretos?”. Ambos são configuráveis na mesma UI e persistem ao reabrir o card. A conclusão é bloqueada se qualquer item estiver vazio ou em “Não”; só dois “Sim” permitem concluir, além dos demais requisitos publicados.
4. [ ] Cards com **revisão pendente** ou **atrasada** exibem estados visuais distinguíveis no board e/ou no card, com texto ou ícone além de cor. O atraso ocorre após **24 horas corridas do protocolo efetivo** enquanto a revisão não foi concluída; estados são atualizados após revisão e não geram alertas duplicados.
5. [ ] O prazo máximo de conclusão da revisão é **24 horas corridas após o protocolo efetivo**; acompanhar a meta operacional de revisar o quanto antes. O sistema apresenta vencimento e atraso calculados a partir de um instante verificável, inclusive em virada de dia. A data do protocolo não é automaticamente tratada como hora exata de início quando contém apenas data civil.
6. [ ] O alerta comum de **card nunca acessado**, solicitado para todas as etapas na story da etapa Revisão, aplica-se aqui quando seu escopo e parâmetros forem aprovados; acessos válidos atualizam o estado sem alertas duplicados. A regra desta etapa não redefine esse padrão global.
7. [ ] Testes de domínio, integração e UI cobrem configuração de campos, persistência, bloqueio da conclusão com cada campo ausente/inválido, conferência documental, cálculo de prazo e virada de dia, estados visuais, ciclo de transição e idempotência dos alertas.

## Decisões pendentes de produto

- **Prazo de revisão:** 24 horas corridas após o protocolo efetivo, conforme resposta do usuário. `[AUTO-DECISION]` “No mesmo dia” permanece meta operacional; não o converter em vencimento às 23h59 nem herdar o marco da etapa anterior. Confirmar fuso de apresentação e se “o quanto antes” precisa de alerta anterior ao vencimento.
- **Marco inicial e conclusão:** identificar a fonte verificável da data/hora real do protocolo e qual evento encerra a revisão; definir comportamento quando a data for retroativa, editada ou faltar hora. `[AUTO-DECISION]` Não derivar hora de um campo que armazena somente data.
- **Conferência documental:** dois itens obrigatórios e separados no formulário já estão definidos. O usuário determinou que uma resposta “Não” bloqueia a conclusão até ser corrigida para “Sim”. Identificar a lista/fonte concreta de documentos e códigos a conferir; preservar no card a resposta negativa e o histórico enquanto houver pendência.
- **Alertas:** definir o que conta como pendência, destinatários/canal/recorrência do alerta de atraso e comportamento após edição da data ou retorno de etapa. Herdar a decisão comum de alerta de card não acessado da story `story-alpha-crm-operacional-processo-para-revisao.md`, sem criar parâmetros locais conflitantes.
- **Nome da coluna:** confirmar se o rótulo publicado deve mudar de “Revisão do protocolo” para “Revisão do protocolo feito”; o pedido foi registrado como nome de negócio, sem renomear a etapa automaticamente.

## Tasks / Subtasks

- [ ] Revalidar versão publicada, campos/formulário, requisitos de transição, eventos de protocolo/revisão e UI de configuração antes de alterar o pipeline (AC 1–6).
- [ ] Resolver fonte do instante do protocolo, referência documental, efeito de resposta negativa, parâmetros de alertas e rótulo antes de publicar automações (AC 3–6).
- [ ] Configurar data/número e os dois itens obrigatórios de conferência na UI; verificar persistência e validação no servidor (AC 1–3).
- [ ] Configurar bloqueio da conclusão e alertas visuais segundo a versão publicada, sem duplicação de disparos (AC 2, 4–6).
- [ ] Testar bordas de data/hora e fuso, edição retroativa, campos ausentes, checklist/conferência e avanço da etapa (AC 7).
- [ ] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar checklist, File List e evidências (AC 7).
- [ ] Se houver necessidade de schema, migration, seed/backfill ou mutação em massa, cumprir antes o rito Vault do `AGENTS.md`: relatório, backup completo verificado e confirmação explícita específica.

## Dev Notes / Testing

- Pontos de integração a verificar: `src/actions/bpm/Campos.ts`, `src/actions/bpm/FormulariosEtapa.ts`, `src/actions/bpm/Cards.ts`, `src/actions/bpm/Automacoes.ts`, `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx`, `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/SlaConfigSection.tsx` e `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`. São referências para inventário, não uma prescrição de mudança.
- O bloqueio deve ocorrer na ação que conclui ou avança a etapa, inclusive quando chamada sem UI. Verificar que um salvamento parcial do card ainda pode registrar rascunho sem encerrar a revisão, conforme as regras publicadas.
- Testar resultados observáveis do card e da transição. Diferenciar “data do protocolo registrada” de “revisão concluída”; um campo preenchido não comprova sozinho a conferência documental.
- **Executor:** `@dev`; **quality gate:** `@qa`; ferramentas: lint, typecheck, testes, build e inspeção da configuração publicada.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** API/automação e frontend; complexidade alta pela validação de transição, campos configuráveis, prazo temporal e estados visuais.
- **Specialized Agents:** `@dev` implementa; `@qa` valida; `@architect` revisa o uso do evento compartilhado de protocolo; `@ux-design-expert` revisa acessibilidade; `@devops` cuida das operações remotas.
- **Quality Gates:** pré-commit por `@dev`; pré-PR e pré-deploy por `@devops` quando aplicáveis; verificar versão publicada, validação no servidor, idempotência, autorização e acessibilidade.
- **Self-Healing Configuration:** `@dev` light, até 2 iterações/15 min para CRITICAL e HIGH documentado; `@qa` full, até 3 iterações/30 min para CRITICAL/HIGH; `@devops` check/report only.
- **Focus Areas:** requisitos de transição, persistência e configuração dos campos, fonte/fuso do prazo, mudança retroativa da data, duplicação de alertas e estados visuais acessíveis.

## Checklist da story

- [x] Pedido do usuário e configuração publicada v11 registrados, distinguindo script histórico de estado atual.
- [x] Critérios de aceite observáveis e cenários de teste preparados.
- [ ] Decisões pendentes de produto resolvidas.
- [ ] Implementação e testes concluídos.
- [ ] Quality gates executados e evidências registradas.
- [x] File List desta criação documental atualizada.

## File List

- `docs/stories/story-alpha-crm-operacional-revisao-protocolo.md` — criação desta story.
- Arquivos da implementação: a preencher após inventário e alterações reais.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-29 | 0.1 | Draft da revisão do protocolo, bloqueio por data/número e alertas | @sm |
| 2026-09-29 | 0.2 | Incorpora dois itens obrigatórios e SLA de 24 horas definidos pelo usuário | @sm |
| 2026-09-29 | 0.3 | Registra bloqueio da conclusão até ambos os itens estarem em “Sim” | @sm |

## Validação do draft

| Categoria | Estado | Observação |
| --- | --- | --- |
| Objetivo e contexto | PASS | Etapa, dados mínimos, conferência e prazo identificados. |
| Guia técnico | PARTIAL | Instante verificável do protocolo e referência documental exigem inventário/decisão. |
| Referências | PASS | Configuração publicada, script histórico e stories anteriores distinguidos. |
| Autossuficiência | PARTIAL | Prazo, itens obrigatórios e bloqueio de respostas negativas definidos; fonte do instante e referência documental pendentes. |
| Testes | PASS | Casos de bloqueio, persistência, prazo, transição e alertas listados. |
| CodeRabbit | PASS | Tipo, agentes, gates, self-healing e focos registrados. |

**Resultado:** NEEDS REVISION antes de publicar a automação temporal; a fonte do instante do protocolo e a referência documental devem ser verificadas. Campos obrigatórios e bloqueio podem avançar após confirmar a configuração vigente.
