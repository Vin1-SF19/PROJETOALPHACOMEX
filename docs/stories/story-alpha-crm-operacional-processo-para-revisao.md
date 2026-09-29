# Story — Operacional: Processo para Revisão

## Status

Draft — regras de prazo, retorno e alertas precisam dos parâmetros indicados abaixo antes da publicação completa.

## Story

**Como** responsável pela revisão no pipeline Operacional, **quero** registrar o resultado da revisão, acompanhar o prazo e identificar processos pendentes, **para** revisar no mesmo dia os processos enviados ao diretor e devolver à etapa anterior aqueles com impeditivo ou dependência do cliente.

## Contexto e fonte

- Pedido direto do usuário: coluna **Processo para Revisão** (etapa identificada no pipeline como **Revisão**), com anotação do resultado; revisão no mesmo dia do envio ao diretor; retorno à etapa anterior se houver impeditivo ou dependência de retorno do cliente; alerta de card ainda não acessado como padrão em todas as etapas; alerta de atraso; destaque visual de processos pendentes; campos configuráveis em **Configurações → Campos e Formulários**.
- Inventário somente leitura recebido do pipeline Operacional ativo: ID `cmuih4tnh000409gm5z34jvss`, versão 10; etapa Revisão ID `draft-stage-cb2023f8-7e31-438e-83f9-4bb0fc359f79`; 22 campos herdados, sem campo específico de resultado da revisão, sem automações ou SLA próprios. O formulário v2 herda seções de outras etapas. Confirmar novamente a versão antes de publicar qualquer configuração.
- A transição **Documentação em análise → Revisão** e a saída **Revisão → Revisado** estão permitidas; a volta **Revisão → Documentação em análise** está expressamente desabilitada. Havia um card na etapa anterior e nenhum em Revisão na leitura de 2026-09-29.
- A UI administrativa já permite criar campos, associá-los a formulários e configurar SLA por etapa. O SLA relativo de 1 dia não equivale automaticamente a encerrar às 23h59 do dia do envio. O indicador `primeiraVisualizacaoEm` e o aviso no quadro tratam do primeiro acesso na vida do card; não comprovam acesso novo em cada etapa.
- A story `docs/stories/story-alpha-crm-operacional-documentacao-analise.md` trata de pendências documentais em outra etapa do fluxo; esta story não presume que o resultado daquela análise já representa a revisão do diretor.
- `docs/stories/accumulated-context.md` e `.aiox/gotchas.json` não existem neste checkout. `[AUTO-DECISION]` A coerência foi verificada pelas stories Operacional disponíveis e pelo inventário; não se atribui conteúdo aos arquivos ausentes.

## Requisitos e critérios de aceite

1. [ ] A etapa **Revisão** expõe um campo de anotação para registrar o **resultado da revisão**. O valor salvo reaparece ao reabrir o card e integra o histórico com autor e data/hora quando esse histórico já oferecer esses metadados.
2. [ ] O campo de resultado e qualquer outro campo criado para esta etapa aparecem em **Configurações → Campos e Formulários**, com tipo, rótulo, visibilidade, edição e requisito configuráveis conforme os recursos da UI. A leitura e a validação do card respeitam a versão publicada da configuração.
3. [ ] O processo enviado ao diretor é identificado como **no prazo** somente quando a revisão efetiva ocorre na mesma data civil do envio; antes do registro de revisão, permanece pendente. A data/hora de envio e a de conclusão devem ser rastreáveis. A fonte do envio, o fuso e o evento que conclui a revisão constam em **Decisões pendentes**.
4. [ ] Se a revisão apontar **impeditivo** ou **dependência de retorno do cliente**, o processo retorna à etapa imediatamente anterior do mesmo pipeline, mantendo anotação, histórico e motivo. O gatilho e a forma de representar o motivo precisam da decisão indicada abaixo; não inferir impeditivo a partir de texto livre sem regra definida.
5. [ ] Cards ainda **não acessados** geram alerta segundo regra reutilizável, ativada como padrão em **todas as etapas** do pipeline abrangido. Depois do acesso válido, o estado do alerta é atualizado; acessos repetidos e ciclos de verificação não geram alertas duplicados.
6. [ ] Um card que ultrapassa o prazo de revisão mostra **alerta de atraso** rastreável, sem duplicação no mesmo ciclo. A regra preserva a distinção entre revisão pendente, concluída no prazo e concluída com atraso.
7. [ ] Os **processos pendentes** recebem destaque visual no board e/ou no card, distinguível do estado concluído e coerente com a configuração publicada. Cor, texto e ícone não podem ser a única forma de transmitir o estado.
8. [ ] Testes de domínio/integração/UI cobrem anotação persistida, configuração do campo, prazo no mesmo dia e virada de data, retorno por impeditivo ou dependência, alerta de não acesso em etapas distintas, atraso, idempotência e destaque visual.

## Decisões pendentes de produto

- **Marco do prazo:** qual evento existente significa “processo enviado ao diretor” e qual evento confirma “revisado”? É preciso identificar fonte e fuso da data civil, inclusive envio perto da meia-noite e reenvio após retorno. `[AUTO-DECISION]` Não usar criação do card ou abertura da etapa como substituto sem evidência.
- **Resultado e retorno:** definir se o motivo será opção estruturada, anotação livre com ação explícita ou ambos; quem pode acionar retorno; se o retorno ocorre automaticamente ao salvar o motivo ou por ação confirmada. `[AUTO-DECISION]` Sem essa definição, o texto da anotação não dispara movimentação automática.
- **Etapa anterior:** confirmar a ordem publicada e o comportamento se ela for reordenada/desativada; o aceite usa a etapa imediatamente anterior na configuração vigente, sem nome presumido.
- **Alerta de não acesso:** o que conta como acesso, qual marco inicia a espera, após quanto tempo alertar, destinatário, canal, recorrência e se “todas as etapas” inclui os demais pipelines ou somente Operacional. A abrangência deve ser confirmada antes de ativar o padrão global.
- **Alerta de atraso:** horário de disparo, fuso, destinatário/canal, recorrência e política após retorno ou conclusão. A expressão “mesmo dia” por si só não determina esses parâmetros.
- **Processo pendente:** definir se significa apenas revisão ainda não concluída, também impedimento/dependência, ou outros estados existentes; refletir essa definição no destaque visual.

## Tasks / Subtasks

- [ ] Inventariar etapa e ordem publicadas, campos/formulário, histórico de acesso, fonte do envio ao diretor, eventos de revisão, motor de alertas/SLA e board (AC 1–7).
- [ ] Resolver as decisões de produto e registrar as regras exatas antes de ligar automações temporais ou retorno automático (AC 3–7).
- [ ] Configurar o campo de resultado e o formulário pela estrutura configurável existente; verificar leitura, edição, histórico e validação no servidor (AC 1–2).
- [ ] Implementar detecção de prazo, retorno à etapa anterior e alertas com observabilidade e idempotência, respeitando configurações publicadas (AC 3–6).
- [ ] Mostrar pendências de forma acessível no board/card e testar etapas distintas e transições (AC 5–8).
- [ ] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar checklist, File List e evidências (AC 8).
- [ ] Se a solução exigir schema, migration, seed/backfill ou mutação em massa, cumprir o rito Vault do `AGENTS.md`: relatório, backup completo verificado e autorização específica antes de executar.

## Dev Notes / Testing

- Pontos reais para inventário: `src/actions/bpm/Campos.ts`, `src/actions/bpm/FormulariosEtapa.ts`, `src/actions/bpm/Automacoes.ts`, `src/actions/bpm/AutomacoesCentrais.ts`, `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx`, `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/SlaConfigSection.tsx` e `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`. Referências de localização, não prescrições de alteração.
- Usar o motor existente de eventos e configuração antes de propor persistência nova. Não tratar abertura de página por automação/bot como acesso humano sem decisão. Testes devem verificar resultado observável e evitar replicar somente detalhes internos.
- **Executor:** `@dev`; **quality gate:** `@qa`; ferramentas: lint, typecheck, testes, build e inspeção da configuração publicada.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** API/automação e frontend; complexidade alta pelo prazo temporal, escopo multietapas e retorno de fluxo.
- **Specialized Agents:** `@dev` implementa; `@qa` valida; `@architect` revisa a regra compartilhada de não acesso se ela abranger outros pipelines; `@devops` cuida de operações remotas.
- **Quality Gates:** pré-commit por `@dev`; pré-PR e pré-deploy por `@devops` quando aplicáveis; revisar concorrência, idempotência, autorização e acessibilidade.
- **Self-Healing Configuration:** `@dev` light, até 2 iterações/15 min para CRITICAL, HIGH documentado; `@qa` full, até 3 iterações/30 min para CRITICAL/HIGH; `@devops` check/report only.
- **Focus Areas:** fonte e fuso dos eventos, duplicação dos alertas, integridade do histórico e movimento, configuração da UI e estados visuais acessíveis.

## Checklist da story

- [x] Pedido do usuário e inventário inicial registrados sem presumir eventos ou horários.
- [x] Critérios de aceite observáveis e cenários de teste preparados.
- [ ] Decisões pendentes de produto resolvidas.
- [ ] Implementação e testes concluídos.
- [ ] Quality gates executados e evidências registradas.
- [ ] File List atualizada com todos os arquivos efetivamente alterados.

## File List

- `docs/stories/story-alpha-crm-operacional-processo-para-revisao.md` — criação desta story.
- Arquivos da implementação: a preencher após inventário e alterações reais.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-29 | 0.1 | Draft da etapa Revisão e padrão de alerta de não acesso | @sm |

## Validação do draft

| Categoria | Estado | Observação |
| --- | --- | --- |
| Objetivo e contexto | PASS | Etapa, resultado, prazo, retorno, alertas e UI configurável identificados. |
| Guia técnico | PARTIAL | Fontes de eventos e abrangência do alerta comum exigem inventário/decisão. |
| Referências | PASS | Story anterior e pontos reais de integração identificados. |
| Autossuficiência | PARTIAL | Parâmetros temporais e gatilho de retorno ainda não foram definidos. |
| Testes | PASS | Cenários centrais, fronteiras temporais e idempotência listados. |
| CodeRabbit | PASS | Tipo, agentes, gates, self-healing e focos registrados. |

**Resultado:** NEEDS REVISION antes de publicar automações e retorno; o campo de resultado e o diagnóstico técnico podem avançar sem inventar regras.
