# RM-2026-B08DA8 — Deixar a aba Histórico amigável

## Status

Ready for Development

## Story

Como usuário autenticado do Alpha CRM que abre a aba **Histórico** de um card,
quero ler frases claras em português para cada evento registrado,
para entender o que aconteceu no card sem precisar interpretar JSON bruto, IDs técnicos ou datas em ISO.

## Contexto e problema

`BpmCardHistorico` (`prisma/schema.prisma:5038-5053`) grava `acao` como string livre e `valorAnteriorJson`/`valorNovoJson` como JSON serializado, sem schema tipado por evento. Cerca de 15 arquivos gravam nesse model através do helper único `registrarHistoricoCard` (`src/lib/bpm/historico-server.ts:9-18`).

O rótulo do evento (`acao`) já é traduzido por `LABELS_EVENTO_TIMELINE`/`rotuloEventoTimeline` (`src/lib/bpm/timeline.ts:33-76`). O problema está isolado em `PainelHistorico.tsx:117-126`, na função `formatarValorHistorico`: ela faz apenas `JSON.parse` + `JSON.stringify` do payload bruto, sem traduzir chaves nem formatar valores, e essa saída crua é renderizada diretamente em `PainelHistorico.tsx:288-294`.

Exemplo real confirmado (`src/actions/bpm/GoogleMeet.ts:307-313`, evento `REUNIAO_AGENDADA`):

```json
{"dataReuniao":"2026-09-04T18:30:00.000Z","googleEventId":"abc123xyz"}
```

Esse JSON bruto — com data em ISO/UTC e ID técnico do Google Calendar — é exatamente o que hoje aparece na tela para o usuário final, em vez de uma frase como "Reunião agendada para 04/09/2026 às 15:30 (horário de Brasília)".

## Consumidor e caminho de acesso

O consumidor é o usuário autenticado com acesso a um card nativo do Alpha CRM. O caminho já existe e não muda:

```text
/PainelAlpha/AlphaCRM/pipeline/[pipelineId]
  → abrir card nativo
  → CardFullViewModal → CardAbertoLayout → PainelHistorico
  → aba "Histórico"
```

DELIVERY_READY: a rota, o modal e o componente `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx` já existem e já renderizam o feed; esta story define apenas a camada de formatação amigável consumida por `formatarValorHistorico` (linhas 117-126) e pelo trecho de renderização (linhas 288-294) desse mesmo componente. Nenhuma rota, menu, botão, exportação ou permissão nova é necessária.

## Escopo

Somente camada de apresentação/formatação do histórico já existente:

1. Criar um módulo de tradução de payload de histórico (mapa `acao → template de descrição`), reaproveitando:
   - `fmtDateTime` (`src/lib/format-date.ts`, fuso `America/Sao_Paulo`) para qualquer valor de data;
   - `LABELS_EVENTO_TIMELINE`/`rotuloEventoTimeline` (`src/lib/bpm/timeline.ts`) como fallback para eventos não mapeados;
   - os rótulos/config já existentes para status pós-fechamento (`src/lib/bpm/status-pos-fechamento.ts`), tipo de tarefa (`src/lib/bpm/tarefas-tipo.ts`) e nomes de campo dinâmico já carregados em `card.campoValores`/`card.campo`;
   - `etapas` (`{id, nome, ordem}[]`) já recebida por `PainelHistorico` para resolver `etapaId`.
2. Substituir o uso de `formatarValorHistorico` em `PainelHistorico.tsx` para consumir esse módulo em vez de `JSON.parse`/`JSON.stringify` cru.
3. Nunca renderizar IDs técnicos crus (`googleEventId`, `tarefaId`, `checklistId`, `templateId`, `cardDestinoId`/`cardOrigemId`, `presetId`, `itemId`, `cadenciaId`) — eles só podem influenciar a frase gerada, nunca aparecer como texto na tela.
4. Fallback seguro: qualquer `acao` sem entrada no catálogo, JSON malformado, ou payload com chaves inesperadas usa `rotuloEventoTimeline(acao)` como frase única, sem quebrar a renderização.
5. Nenhuma mudança nos ~15 pontos que chamam `registrarHistoricoCard` — todos continuam gravando exatamente como hoje.

## Fora de escopo

- Alterar `BpmCardHistorico`, criar migration, schema, índice, constraint ou qualquer estrutura de banco.
- Alterar qualquer chamador de `registrarHistoricoCard` ou o formato de `valorAnteriorJson`/`valorNovoJson` persistido.
- Alterar `montarFeedTimelineCard`, `LABELS_EVENTO_TIMELINE` ou o rótulo do evento (`acao`) — esta story só formata o payload, não o rótulo.
- Alterar a aba/sistema Timeline (`PainelTimelineCard`, `ListarTimelineCardBpm`), autenticação, ownership ou realtime.
- Criar rota, menu, botão, exportação, download ou permissão nova.
- Buscar dados adicionais em banco (nova query) para resolver nomes; a resolução deve usar apenas dados já carregados no card/props existentes.

## Critérios de aceite

### AC1 — Nenhum JSON bruto visível

Dado um usuário autenticado que abre a aba Histórico de um card,
quando qualquer evento catalogado na Fase 1 for exibido,
então a tela mostrará uma frase em português, nunca a estrutura `{"chave":"valor"}` bruta de `valorAnteriorJson`/`valorNovoJson`.

### AC2 — Datas formatadas em `America/Sao_Paulo`

Dado um evento cujo payload contenha uma data (ex.: `dataReuniao`, `proximoContatoEm`, `prazo`),
quando a frase for montada,
então a data será exibida via `fmtDateTime` no fuso `America/Sao_Paulo`, nunca em ISO/UTC cru.

### AC3 — Fallback seguro para eventos não mapeados

Dado um `acao` sem entrada no catálogo de tradução, ou um payload malformado/inesperado,
quando a aba Histórico renderizar esse item,
então o componente exibirá `rotuloEventoTimeline(acao)` sem lançar erro e sem expor o JSON bruto.

### AC4 — IDs técnicos nunca expostos como texto

Dado qualquer evento cujo payload contenha um identificador técnico (`googleEventId`, `tarefaId`, `checklistId`, `templateId`, `cardDestinoId`/`cardOrigemId`, `presetId`, `itemId`, `cadenciaId`),
quando a frase for montada,
então esse identificador não aparecerá como texto renderizado, podendo apenas condicionar a frase internamente.

### AC5 — Nomes resolvidos sem nova query

Dado um evento que referencie `campoId`, `etapaId`, `responsavelId` ou `membrosIds`,
quando o dado correspondente já estiver disponível em `card.campoValores`/`etapas`/`card.responsavel`/`card.membros` (props já carregadas),
então o nome será resolvido e exibido; caso o id não seja encontrado nesses dados já carregados, o componente usará um rótulo genérico, nunca o id cru, e não fará nova consulta ao banco.

### AC6 — Sem regressão de persistência ou contrato

Dado que a formatação amigável foi aplicada,
quando qualquer chamador gravar um novo evento em `BpmCardHistorico`,
então o formato de `valorAnteriorJson`/`valorNovoJson` persistido permanecerá idêntico ao atual, sem migration e sem mudança de schema.

## Tarefas técnicas

- [ ] **T1 — Criar o módulo de formatação amigável**
  - [ ] Criar `src/lib/bpm/historico-descricao.ts` (ou nome equivalente) com o catálogo `acao → template`, cobrindo ao menos os eventos listados no blueprint da Fase 1 (`CARD_CRIADO*`, `CARD_MOVIDO*`, `CARD_ATUALIZADO`, `MEMBROS_ATUALIZADOS`, `TAREFA_CRIADA`, `TAREFA_CONCLUIDA`, `TAREFA_ALERTA_DISPARADO`, `PRESET_APLICADO`, `ANEXO_ADICIONADO`, `ANEXO_EXCLUIDO`, `REUNIAO_AGENDADA`, `REUNIAO_REAGENDADA`, `CHECKLIST_MATERIALIZADO`, `CHECKLIST_STATUS_ALTERADO`/`CHECKLIST_ITEM_ATUALIZADO`, `CHECKLIST_ITEM_EXCLUSIVO_ADICIONADO`, `VINCULO_CRIADO`, `CADENCIA_INICIADA`/`PAUSADA`/`REATIVADA`/`CONCLUIDA`/`CANCELADA`/`PASSO_EXECUTADO`, `INTERACAO_REGISTRADA`).
  - [ ] Reaproveitar `fmtDateTime`, `STATUS_POS_FECHAMENTO_CONFIG`, `BPM_TAREFA_TIPO_CONFIG` e `rotuloEventoTimeline` como dependências, sem duplicar lógica já existente.
  - [ ] Receber como parâmetros apenas dados já carregados pelo card (mapa `campoId → nome`, `etapas`, `membros`, `responsavel`), sem nova query.
  - [ ] Implementar o fallback do AC3 para `acao` desconhecido ou JSON inválido.

- [ ] **T2 — Integrar ao componente existente**
  - [ ] Em `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`, substituir a implementação de `formatarValorHistorico` (linhas 117-126) para delegar ao módulo criado em T1.
  - [ ] Ajustar a renderização (linhas 288-294) apenas se o novo contrato de retorno exigir.
  - [ ] Não alterar `montarFeedTimelineCard` nem os demais consumidores de `PainelHistorico`.

- [ ] **T3 — Testes**
  - [ ] Criar teste unitário do módulo de formatação cobrindo cada evento do catálogo, o fallback e a ausência de IDs técnicos no texto gerado.
  - [ ] Atualizar/estender testes existentes de `PainelHistorico`/timeline que hoje assumem JSON bruto, se algum depender desse comportamento.

- [ ] **T4 — Fechamento**
  - [ ] Marcar esta checklist e a checklist de conclusão.
  - [ ] Atualizar a File List com os arquivos realmente afetados.
  - [ ] Registrar o ponto de integração em `.bibble/memory/architecture.md`, sem reescrever entradas alheias.

## Plano de testes

### Direcionados

```bash
npx vitest run tests/bpm/ -t historico
npx vitest run tests/bpm/timeline-card.test.ts
```

Validar explicitamente:

- nenhum evento do catálogo produz JSON bruto na saída;
- datas formatadas em `America/Sao_Paulo`;
- fallback funciona para `acao` desconhecida e para JSON malformado;
- nenhum identificador técnico aparece como texto.

### Regressivos e gates do repositório

```bash
npm run lint
npm run typecheck
npm test
```

Falhas de baseline preexistentes devem ser registradas com comando, contagem e evidência de que não foram introduzidas por esta story.

## Gates obrigatórios

1. **Scout — recebido:** blueprint da Fase 1 confirmado, com catálogo de eventos, payloads reais e fontes reutilizáveis mapeadas.
2. **Forge:** executar `npx tsc --noEmit`/`npm run typecheck`, `npm run lint` e `npm run build` reais; registrar exit code e diagnósticos.
3. **Probe:** validar que a aba Histórico continua acessível pelo mesmo caminho, sem regressão visual/funcional.
4. **Sage:** executar os testes direcionados e regressivos cobrindo os critérios de aceite.
5. **Scribe:** atualizar `.bibble/memory/architecture.md` após a implementação.

## Riscos e mitigação

| Risco | Mitigação exigida |
|---|---|
| Catálogo incompleto deixar algum evento sem tradução | Fallback `rotuloEventoTimeline(acao)` cobre qualquer `acao` fora do catálogo (AC3). |
| Exposição acidental de ID técnico dentro de uma frase | Testar explicitamente que nenhum dos IDs listados no AC4 aparece como substring do texto renderizado. |
| Payload salvo por versão antiga do código não bater com o template esperado | Tratar campos ausentes/opcionais como opcionais no template, nunca lançar exceção; usar fallback em caso de erro de parse. |
| Nova query de banco ser adicionada por engano para resolver nomes | Revisão explícita em T1/T2 confirmando que só dados já carregados pelo card são usados. |

## Checklist de conclusão

- [ ] Story aprovada e mantida atualizada durante a implementação.
- [ ] Nenhum JSON bruto visível na aba Histórico para os eventos catalogados.
- [ ] Datas no fuso `America/Sao_Paulo`.
- [ ] Fallback seguro validado para evento não mapeado e payload malformado.
- [ ] Nenhum identificador técnico exposto como texto.
- [ ] Nenhuma alteração de banco/schema/migration.
- [ ] Testes direcionados e regressivos executados.
- [ ] File List atualizada com o diff final real.

## File List

### Criado nesta fase documental

- [x] `docs/stories/story-rm-2026-b08da8-historico-amigavel.md`

### Planejado para a fase de implementação

- [ ] `src/lib/bpm/historico-descricao.ts` (novo módulo de tradução de payload)
- [ ] `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx` (integração de `formatarValorHistorico`)
- [ ] `tests/bpm/historico-descricao.test.ts` (novo, ou equivalente)
- [ ] `.bibble/memory/architecture.md` (registro de fechamento)

## Notas de segurança e banco

- Esta story não autoriza alteração de banco, schema ou migration.
- Nenhum backup ou aprovação Vault é necessário para a formatação frontend/apresentação descrita.
- Se a implementação descobrir necessidade estrutural de banco, deve interromper o trabalho e abrir o checkpoint Vault específico, sem ampliar esta story silenciosamente.
