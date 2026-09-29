# Story — Operacional: Processo Revisado

## Status

Draft — o SLA de 24 horas está definido; faltam os eventos e parâmetros de alerta indicados abaixo antes de publicar automações.

## Story

**Como** responsável pelo protocolo no pipeline Operacional, **quero** registrar a anotação após o protocolo com sua data e o certificado digital utilizado, acompanhar o prazo e identificar cards ainda não acessados, **para** protocolar processos prontos no mesmo dia, salvo impeditivo, e agir antes do atraso.

## Contexto e fonte

- Pedido direto do usuário: coluna **Processo Revisado** (etapa técnica identificada como **Revisado**); anotação após protocolo contendo **data do protocolo** e **certificado digital utilizado**; processo pronto protocolado no mesmo dia, salvo impeditivo; alerta de card nunca acessado; alerta de atraso; controle de prazo para protocolo. Em continuidade ao pedido da etapa anterior, todos os campos da etapa devem ser configuráveis em **Configurações → Campos e Formulários**.
- Esclarecimento posterior do usuário: **SLA de até 24 horas após o processo ficar pronto** (1 dia corrido). O início depende da identificação do evento real que marca “ficar pronto”; não usar criação do card ou entrada na etapa por suposição.
- Inventário somente leitura do pipeline Operacional ativo, ID `cmuih4tnh000409gm5z34jvss`, versão 10: etapa Revisado ID `draft-stage-2bcb8beb-a711-4428-bd0d-0cf3404cba8d`, ordem 5, ativa; nenhum card na etapa; 22 campos herdados, sem campo correspondente à anotação, data de protocolo ou certificado. O catálogo `BpmCampo` também não possui nome que contenha protocolo, certificado ou anotação. Formulário v2 com seções herdadas de Alinhamento e negociação. Sem automação nem SLA próprios. A única saída permitida é **Revisão do protocolo**. Confirmar novamente a versão antes de publicar configuração.
- A story `docs/stories/story-alpha-crm-operacional-processo-para-revisao.md` já especifica o alerta de não acesso como padrão em todas as etapas, mas sua definição de “acesso” por etapa, escopo e canal permanece pendente. Esta story reutiliza essa regra, sem criar interpretação divergente.
- O indicador atual `primeiraVisualizacaoEm` descreve o primeiro acesso da vida do card, não comprova novo acesso à etapa Revisado. A UI administrativa oferece configuração de campos/formulários e SLA por etapa, mas isso não significa que os campos ou automações solicitados já estejam publicados.
- Existe `Processo.dataProtocolo` legado no schema e a fonte configurável `PROCESSO.dataProtocolo` é permitida; nenhum desses fatos demonstra que o campo seja preenchido no fluxo **Revisado**. Inventariar a origem real antes de usá-lo como marco ou valor do formulário.
- `docs/stories/accumulated-context.md` e `.aiox/gotchas.json` não existem neste checkout. `[AUTO-DECISION]` A coerência entre stories foi verificada nas stories Operacional disponíveis e no inventário; nenhum conteúdo foi presumido desses arquivos ausentes.

## Requisitos e critérios de aceite

1. [ ] A etapa **Revisado** permite registrar uma **anotação após protocolo** que contenha a **data do protocolo** e o **certificado digital utilizado**. O registro persiste e reaparece ao reabrir o card. A forma dos dados (campos estruturados ou conteúdo da anotação) depende da decisão indicada abaixo.
2. [ ] Todos os campos próprios da etapa aparecem em **Configurações → Campos e Formulários**, permitindo configurar tipo, rótulo, visibilidade, edição e obrigatoriedade conforme os recursos da UI; o card usa a versão publicada, inclusive validações de salvamento e avanço.
3. [ ] O processo marcado como **pronto** tem como meta o protocolo na **mesma data civil**, salvo impeditivo registrado. Antes do protocolo, permanece pendente; a conclusão conserva data/hora rastreável e o certificado usado. O fuso, os marcos e a representação do impeditivo constam nas decisões pendentes.
4. [ ] O **SLA máximo** de protocolo é **24 horas corridas (1 dia) a partir do evento real em que o processo fica pronto**. O acompanhamento mostra prazo, tempo restante ou atraso de forma verificável. A regra não usa automaticamente o início do dia, a criação do card ou a entrada na coluna como marco. Os estados pendente, no prazo, atrasado e protocolado são distinguíveis.
5. [ ] Um card **nunca acessado** na abrangência definida recebe alerta conforme a regra comum solicitada para todas as etapas; após acesso válido, o alerta é atualizado, sem duplicação. O primeiro acesso da vida do card não substitui, sem decisão, acesso novo a esta etapa.
6. [ ] Ao ultrapassar o prazo aplicável, o card recebe **alerta de atraso** rastreável, sem duplicação no mesmo ciclo. Um impeditivo não suspende nem estende automaticamente o SLA: seu efeito precisa da decisão indicada abaixo.
7. [ ] Testes de domínio, integração e UI verificam configuração e persistência dos campos, marcos de pronto/protocolo, limite exato de 24 horas, virada da data civil, impeditivo, alerta de não acesso, atraso e ausência de alertas duplicados.

## Decisões pendentes de produto

- **Marco de início:** identificar qual evento já existente comprova “processo ficou pronto”, quem o produz e como é auditado; confirmar o comportamento se o processo voltar a uma etapa anterior e depois ficar pronto novamente. `[AUTO-DECISION]` Não inferir a partir do nome da etapa.
- **Conclusão do protocolo:** identificar qual evento registra o protocolo efetivo e sua data/hora. Decidir se há campo de data editável, preenchimento automático por ação, integração externa ou outra fonte verificada. Avaliar se `Processo.dataProtocolo` participa deste fluxo; sua existência no schema não comprova preenchimento. Impedir que uma anotação sem protocolo real encerre o prazo.
- **Forma dos dados:** decidir se data e certificado serão dois campos estruturados e uma anotação textual, ou se integrarão um único campo com validação. Definir identificação permitida do certificado sem expor material secreto; não salvar senha ou chave privada.
- **“Mesmo dia” versus 24 horas:** confirmar fuso da data civil e como comunicar a meta de protocolar no mesmo dia quando o SLA ainda admite até 24 horas após um processo ficar pronto perto da meia-noite. `[AUTO-DECISION]` Registrar os dois critérios separadamente; não converter 24 horas em “até 23h59”.
- **Impedimento:** definir campos/evidência, quem registra, se impede protocolo ou apenas justifica atraso, e se suspende/reinicia o relógio do SLA. `[AUTO-DECISION]` Sem regra, o sistema apenas registra o motivo, sem alterar a contagem das 24 horas.
- **Alerta de acesso:** adotar a decisão comum da story da etapa Revisão sobre evento válido de acesso, marco de espera, abrangência, destinatário, canal e recorrência. Definir se o alerta de Revisado requer acesso novo nesta etapa ou apenas primeiro acesso da vida do card.
- **Alerta de atraso:** definir destinatário, canal, recorrência, fuso de exibição e encerramento após protocolo ou retorno de etapa.

## Tasks / Subtasks

- [ ] Confirmar a versão publicada e inventariar eventos reais de “pronto”, protocolo e impedimento, configuração de SLA/alertas e campos/formulários (AC 1–6).
- [ ] Resolver decisões de produto, especialmente fonte dos marcos, conflito de linguagem entre mesma data civil e 24 horas, e efeito do impeditivo (AC 3–6).
- [ ] Configurar a anotação e os dados do protocolo pela estrutura configurável existente; validar leitura, edição e salvamento no servidor (AC 1–2).
- [ ] Configurar o SLA de 24 horas e alertas com eventos auditáveis e idempotência, respeitando a configuração publicada (AC 3–6).
- [ ] Verificar bordas temporais, ciclos de retorno e protocolo, permissões, duplicação e apresentação acessível (AC 7).
- [ ] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar checklist, File List e evidências (AC 7).
- [ ] Se for necessário alterar schema, migrar, fazer backfill ou mutação em massa, cumprir o rito Vault do `AGENTS.md` antes da operação.

## Dev Notes / Testing

- Pontos reais para inventário: `src/actions/bpm/Campos.ts`, `src/actions/bpm/FormulariosEtapa.ts`, `src/actions/bpm/Automacoes.ts`, `src/actions/bpm/Cards.ts`, `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx`, `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/SlaConfigSection.tsx` e `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`. Referências de localização, não prescrição de alteração.
- Aplicar o mesmo padrão de alerta de não acesso definido para a etapa anterior; não contar leitura por bot ou automação como acesso humano sem decisão explícita. Testar resultado observável e persistência, além da configuração.
- **Executor:** `@dev`; **quality gate:** `@qa`; ferramentas: lint, typecheck, testes, build e inspeção da configuração publicada.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** automação/API e frontend; complexidade alta pela combinação de prazo temporal, evento de protocolo, campos configuráveis e regra comum de acesso.
- **Specialized Agents:** `@dev` implementa; `@qa` valida; `@architect` revisa a definição compartilhada de eventos e alertas; `@devops` atua em operações remotas.
- **Quality Gates:** pré-commit por `@dev`; pré-PR e pré-deploy por `@devops` quando aplicáveis; revisar validação, autorização, idempotência, bordas de prazo e acessibilidade.
- **Self-Healing Configuration:** `@dev` light, até 2 iterações/15 min para CRITICAL, HIGH documentado; `@qa` full, até 3 iterações/30 min para CRITICAL/HIGH; `@devops` check/report only.
- **Focus Areas:** origem e integridade dos marcos, cálculo de 24 horas, data civil/fuso, proteção da identidade do certificado, campos publicados e duplicação de alertas.

## Checklist da story

- [x] Pedido do usuário, SLA de 24 horas e inventário inicial registrados sem presumir eventos.
- [x] Critérios de aceite observáveis e cenários de teste preparados.
- [ ] Decisões pendentes de produto resolvidas.
- [ ] Implementação e testes concluídos.
- [ ] Quality gates executados e evidências registradas.
- [x] File List desta criação documental atualizada.

## File List

- `docs/stories/story-alpha-crm-operacional-processo-revisado.md` — criação desta story.
- Arquivos da implementação: a preencher após inventário e alterações reais.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-29 | 0.1 | Draft da etapa Revisado, SLA de 24 horas e alertas | @sm |

## Validação do draft

| Categoria | Estado | Observação |
| --- | --- | --- |
| Objetivo e contexto | PASS | Etapa, anotação, data, certificado, meta no mesmo dia, SLA e alertas identificados. |
| Guia técnico | PARTIAL | Fontes reais dos eventos e efeito do impeditivo precisam de decisão. |
| Referências | PASS | Story anterior e pontos de integração identificados. |
| Autossuficiência | PARTIAL | Marcos de pronto/protocolo, forma dos dados e parâmetros dos alertas ainda não estão definidos. |
| Testes | PASS | Cenários centrais, limite de 24 horas, virada de data e idempotência listados. |
| CodeRabbit | PASS | Tipo, agentes, gates, self-healing e focos registrados. |

**Resultado:** NEEDS REVISION para publicar automações; o inventário e a configuração dos campos podem avançar sem inventar os eventos pendentes.
