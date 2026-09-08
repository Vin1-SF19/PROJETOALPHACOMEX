# RM-2026-B08DA8 — Deixar a aba Histórico amigável

## Status

Concluída — aguardando testes de homologação

## Story

Como usuário autenticado do Alpha CRM que abre a aba **Histórico** de um card,
quero ler frases claras em português para cada evento registrado,
para entender o que aconteceu no card sem precisar interpretar JSON bruto, IDs técnicos ou datas em ISO.

## Contexto e problema

`BpmCardHistorico` (`prisma/schema.prisma:5038-5053`) grava `acao` como string livre e `valorAnteriorJson`/`valorNovoJson` como JSON serializado, sem schema tipado por evento. Os produtores usam majoritariamente o helper central `registrarHistoricoCard` (`src/lib/bpm/historico-server.ts`), embora também existam escritas diretas em `bpmCardHistorico.create`; esta story não altera nenhum desses produtores.

O rótulo do evento (`acao`) já é traduzido por `LABELS_EVENTO_TIMELINE`/`rotuloEventoTimeline` (`src/lib/bpm/timeline.ts`). O problema está isolado na apresentação: `formatarValorHistorico`, extraída para `PainelHistoricoShared.tsx`, faz apenas `JSON.parse` + `JSON.stringify` do payload bruto, sem traduzir chaves nem formatar valores, e essa saída crua é renderizada diretamente na aba por `PainelHistorico.tsx`.

Exemplo real confirmado (`src/actions/bpm/GoogleMeet.ts:307-313`, evento `REUNIAO_AGENDADA`):

```json
{"dataReuniao":"...","googleEventId":"..."}
```

Esse JSON bruto — com data em ISO/UTC e ID técnico do Google Calendar — é exatamente o formato hoje apresentado ao usuário final, em vez de uma frase como "Reunião agendada para {data/hora} (horário de Brasília)".

## Consumidor e caminho de acesso

O consumidor é o usuário autenticado com acesso a um card nativo do Alpha CRM. O caminho já existe e não muda:

```text
/PainelAlpha/AlphaCRM/pipeline/[pipelineId]
  → abrir card nativo
  → CardFullViewModal → CardAbertoLayout → PainelHistorico
  → aba "Histórico"
```

DELIVERY_READY: a rota, o modal e `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx` já existem e já renderizam o feed; esta story define apenas a camada amigável que substituirá `formatarValorHistorico` em `PainelHistoricoShared.tsx` e será consumida pela renderização da aba. Nenhuma rota, menu, botão, exportação ou permissão nova é necessária.

## Escopo

Somente camada de apresentação/formatação do histórico já existente:

1. Criar um módulo de tradução de payload de histórico (mapa `acao → template de descrição`), reaproveitando:
   - `fmtDateTime` (`src/lib/format-date.ts`, fuso `America/Sao_Paulo`) para qualquer valor de data;
   - `LABELS_EVENTO_TIMELINE`/`rotuloEventoTimeline` (`src/lib/bpm/timeline.ts`) como fallback para eventos não mapeados;
   - os rótulos/config já existentes para status pós-fechamento (`src/lib/bpm/status-pos-fechamento.ts`), tipo de tarefa (`src/lib/bpm/tarefas-tipo.ts`) e nomes de campo dinâmico já carregados em `card.campoValores`/`card.campo`;
   - `etapas` (`{id, nome, ordem}[]`) já recebida por `PainelHistorico` para resolver `etapaId`.
2. Substituir `formatarValorHistorico` em `PainelHistoricoShared.tsx` pelo módulo comum e ajustar `PainelHistorico.tsx` para fornecer ação e metadados já carregados ao formatador.
3. Nunca renderizar IDs técnicos crus (`googleEventId`, `tarefaId`, `checklistId`, `templateId`, `cardDestinoId`/`cardOrigemId`, `presetId`, `itemId`, `cadenciaId`) — eles só podem influenciar a frase gerada, nunca aparecer como texto na tela.
4. Fallback seguro: qualquer `acao` sem entrada no catálogo, JSON malformado, ou payload com chaves inesperadas usa `rotuloEventoTimeline(acao)` como frase única, sem quebrar a renderização.
5. Nenhuma mudança nos ~15 pontos que chamam `registrarHistoricoCard` — todos continuam gravando exatamente como hoje.

## Fora de escopo

- Alterar `BpmCardHistorico`, criar migration, schema, índice, constraint ou qualquer estrutura de banco.
- Alterar qualquer produtor de histórico, seja ele usuário de `registrarHistoricoCard` ou de `bpmCardHistorico.create`, ou mudar o formato persistido de `valorAnteriorJson`/`valorNovoJson`.
- Alterar `montarFeedTimelineCard` ou o contrato do rótulo do evento (`acao`); `LABELS_EVENTO_TIMELINE` pode receber somente os rótulos ausentes catalogados na Fase 1, preservando o mesmo fallback.
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

- [x] **T1 — Criar o módulo de formatação amigável**
  - [x] Criar `src/lib/bpm/historico-descricao.ts` com o contrato puro `descreverEventoHistorico({ acao, valorAnteriorJson, valorNovoJson, contexto }): string` e contexto tipado para etapas, campos e usuários.
  - [x] Cobrir os 51 eventos catalogados na Fase 1: `ALERTA_AUTOMACAO`, `ANEXO_ADICIONADO`, `ANEXO_EXCLUIDO`, `ANOTACAO_AUTOMACAO`, `ANOTACAO_REGISTRADA`, `AUTOMACAO_CENTRAL_EXECUTADA`, `AUTOMACAO_DISPAROU_CARD`, `AUTOMACAO_EXECUTADA`, `AUTOMACAO_REPROCESSADA`, `AUTOMACAO_TAREFA_NF`, `CADENCIA_CANCELADA`, `CADENCIA_CONCLUIDA`, `CADENCIA_INICIADA`, `CADENCIA_PAUSADA`, `CADENCIA_PASSO_EXECUTADO`, `CADENCIA_REATIVADA`, `CARD_ATUALIZADO`, `CARD_CRIADO`, `CARD_CRIADO_POR_AUTOMACAO`, `CARD_CRIADO_POR_OPORTUNIDADE`, `CARD_MOVIDO`, `CARD_MOVIDO_POR_AUTOMACAO`, `CHECKLIST_ITEM_ATUALIZADO`, `CHECKLIST_ITEM_EXCLUSIVO_ADICIONADO`, `CHECKLIST_MATERIALIZADO`, `CHECKLIST_STATUS_ALTERADO`, `COMUNICACAO_PENDENTE`, `DISTRIBUICAO_AUTOMATICA`, `FOLLOW_UP_ATUALIZADO`, `FOLLOW_UP_CONCLUIDO`, `FOLLOW_UP_CRIADO_E_CONCLUIDO`, `FOLLOW_UP_INICIADO`, `INTERACAO_REGISTRADA`, `MEMBROS_ATUALIZADOS`, `MONITORAMENTO_AUTOMATICO_EXECUTADO`, `MOVIDO_AUTOMACAO`, `NOVOS_LEADS_LIGACOES_PLANEJADAS`, `OPORTUNIDADE_IDENTIFICADA`, `PRESET_APLICADO`, `RESUMO_REUNIAO_EDITADO`, `REUNIAO_AGENDADA`, `REUNIAO_REAGENDADA`, `STANDBY_FOLLOW_UP_EXECUTADO`, `STANDBY_FOLLOW_UP_INTERROMPIDO`, `SUBSTATUS_ALTERADO`, `TAREFA_ALERTA_DISPARADO`, `TAREFA_CONCLUIDA`, `TAREFA_CRIADA`, `TRANSCRICAO_REUNIAO_ATUALIZADA`, `TRANSCRICAO_REUNIAO_RECEBIDA` e `VINCULO_CRIADO`.
  - [x] Reaproveitar `fmtDateTime`, `STATUS_POS_FECHAMENTO_CONFIG`, `BPM_TAREFA_TIPO_CONFIG` e `rotuloEventoTimeline` como dependências, sem duplicar lógica já existente.
  - [x] Receber como parâmetros apenas dados já carregados pelo card (etapas, `card.campoValores[].campo`, `card.responsavel` e `card.membros[].usuario`), deduplicando usuários por ID e sem nova query.
  - [x] Analisar os snapshots anterior e novo conjuntamente; interpolar apenas campos permitidos pelo template e nunca renderizar recursivamente objetos.
  - [x] Garantir retorno sempre não vazio, sem JSON, `[object Object]`, `undefined`, `null` ou identificadores técnicos; JSON inválido, estrutura inesperada ou data inválida deve retornar `rotuloEventoTimeline(acao)`.

- [x] **T2 — Integrar ao componente existente**
  - [x] Em `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistoricoShared.tsx`, substituir a serialização bruta de `formatarValorHistorico` pela delegação ao módulo criado em T1, ou remover o wrapper se ele deixar de ter função.
  - [x] Em `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`, fornecer `item.acao` e o contexto derivado das props/dados já carregados, renderizando uma descrição única em vez do par de snapshots em JSON.
  - [x] Em `src/lib/bpm/timeline.ts`, completar apenas os rótulos ausentes dos eventos catalogados, sem criar outro mecanismo nem alterar `montarFeedTimelineCard`.
  - [x] Não alterar `montarFeedTimelineCard` nem os demais consumidores de `PainelHistorico`.

- [x] **T3 — Testes**
  - [x] Criar `tests/bpm/historico-descricao.test.ts` cobrindo cada evento do catálogo, os snapshots anterior/novo, datas, fallback e ausência de IDs técnicos no texto gerado.
  - [x] Atualizar `tests/bpm/timeline-card.test.ts` para cobrir reunião, movimento, checklist, automação, rótulos adicionados e fallback seguro.
  - [x] Atualizar/estender outros testes de `PainelHistorico` que hoje assumam JSON bruto, se houver.

- [x] **T4 — Fechamento**
  - [x] Marcar esta checklist e a checklist de conclusão.
  - [x] Atualizar a File List com os arquivos realmente afetados.
  - [x] Registrar o ponto de integração em `.bibble/memory/architecture.md`, sem reescrever entradas alheias.

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

- [x] Story aprovada e mantida atualizada durante a implementação.
- [x] Nenhum JSON bruto visível na aba Histórico para os eventos catalogados.
- [x] Datas no fuso `America/Sao_Paulo`.
- [x] Fallback seguro validado para evento não mapeado e payload malformado.
- [x] Nenhum identificador técnico exposto como texto.
- [x] Nenhuma alteração de banco/schema/migration por esta story.
- [x] Testes direcionados e regressivos executados.
- [x] File List atualizada com o diff final real.

## File List

### Criado nesta fase documental

- [x] `docs/stories/story-rm-2026-b08da8-historico-amigavel.md`

### Implementado na Fase 3

- [x] `src/lib/bpm/historico-descricao.ts` (novo módulo de tradução de payload)
- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistoricoShared.tsx` (remoção da serialização bruta)
- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx` (ação e contexto para a descrição)
- [x] `src/lib/bpm/timeline.ts` (rótulos ausentes)
- [x] `tests/bpm/historico-descricao.test.ts` (novo teste unitário)
- [x] `tests/bpm/timeline-card.test.ts` (integração, rótulos e fallback)
- [x] `.bibble/memory/architecture.md` (registro de fechamento)
- [x] `.bibble/memory/journal.md` (registro da sessão)

## Evidência de qualidade — retomada das Fases 4–6

- `npx eslint` nos 6 arquivos de código/teste afetados: PASS.
- `npx vitest run tests/bpm/historico-descricao.test.ts tests/bpm/timeline-card.test.ts`: PASS, 69/69.
- Integração do modal, autorização, abas, formulário e checklists: PASS, 129/129 em 8 arquivos.
- `git diff --check`: PASS.
- `NODE_OPTIONS=--max-old-space-size=8192 npm run build`: PASS; compilação Turbopack e geração das 78 páginas concluídas.
- `npm run lint`: FAIL por baseline global fora do escopo, concentrado em `.agents/`, `.aiox-core/` e outros módulos; nenhum diagnóstico nos arquivos da story no lint direcionado.
- `npm run typecheck`: FAIL por diagnósticos globais preexistentes/concorrentes em Exclusão Fiscal, Gerador de Documentos, Calendário Alpha, Radar e testes Google Calendar; nenhum diagnóstico nos arquivos desta RM.
- `npm test`: FAIL, 2.386 aprovados e 53 falhos fora do escopo; os testes direcionados desta RM passaram na retomada.
- A falha anterior da Fase 4 (`PROHIBITED_GIT_MUTATION`) foi causada por commits concorrentes no mesmo repositório; a retomada preservou o HEAD e continuou diretamente dos gates pendentes.

## Notas de segurança e banco

- Esta story não autoriza alteração de banco, schema ou migration.
- Nenhum backup ou aprovação Vault é necessário para a formatação frontend/apresentação descrita.
- Se a implementação descobrir necessidade estrutural de banco, deve interromper o trabalho e abrir o checkpoint Vault específico, sem ampliar esta story silenciosamente.
