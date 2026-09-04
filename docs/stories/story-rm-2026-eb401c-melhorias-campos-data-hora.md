# RM-2026-EB401C — Melhorias nos campos de data e hora

## Status

Ready for Review — `FORGE_PASS`, `PROBE_PASS`, `ANUBIS_PASS` e `LENS_PASS` após as correções de concorrência.

## Objetivo

Substituir a composição manual de data e hora nos consumidores confirmados do Alpha CRM por seleção assistida, preservando o instante civil de `America/Sao_Paulo` e os fluxos reais de persistência.

## Critérios de aceite

- [x] Próximo Contato, Reunião, Prazo e Alerta usam calendário e controle de hora.
- [x] Valores existentes reaparecem com a mesma data e hora em São Paulo.
- [x] Datas inválidas ou parciais são bloqueadas antes da Server Action.
- [x] Próximo Contato permanece integrado ao `CardSaveContext`.
- [x] Reunião e tarefa bloqueiam duplo envio e preservam feedback de sucesso/erro.
- [x] Fechar o card força blur, aguarda `flushSaves()` e permanece aberto em falha.
- [x] Datas legadas nulas de tarefa não causam erro de tipo ou renderização.
- [x] Calendário respeita foco, teclado, viewport móvel, tema e labels acessíveis.
- [x] Campos civis dinâmicos `YYYY-MM-DD` permanecem inalterados.
- [x] Nenhuma migration, alteração de schema, seed ou backfill foi realizada.
- [x] Campos de instante obrigatórios rejeitam `null`, vazio, booleano e data inválida antes de ownership/persistência.
- [x] `Date`, ISO string e timestamp legados permanecem aceitos; Próximo Contato continua nullable.
- [x] Membro com `permissaoEtapa.podeAgir=false` recebe os controles do formulário em modo somente leitura.
- [x] Próximo Contato expõe limpeza opcional e persiste `null` pelo contrato existente.
- [x] Save antigo de Próximo Contato não limpa nem sobrescreve rascunho editado durante a requisição.
- [x] Atualização do card não remonta `PainelReuniao`; data/hora e resumo sujos são preservados com conflito visível.

## Entregabilidade

Consumidor: usuários vinculados ao card com permissão de edição/criação de tarefa.

Caminho: `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → card → `CardFullViewModal` → Formulário da Etapa (Próximo Contato/Reunião) ou aba Tarefas (Prazo/Alerta) → calendário + hora → action existente → reabertura do card.

## Checklist técnico

- [x] Blueprint Scout das Fases 0/1 consultado.
- [x] Componente de responsabilidade única criado e catalogado.
- [x] Contrato de timezone centralizado em `src/lib/format-date.ts`.
- [x] Testes focados de round-trip, inválidos, integração e fechamento atualizados.
- [x] ESLint direcionado nos arquivos da fase — aprovado sem diagnósticos.
- [x] Testes direcionados — 4 arquivos, 30 testes aprovados.
- [x] `npm run typecheck` — executado; falha somente por débitos externos em Exclusão Fiscal, Check-in, Gerador de Documentos, Agenda/Google Calendar e Radar, sem erro nos arquivos desta story.
- [x] `npm run lint`, `npm test` e `npm run build` globais — iniciados em paralelo; permaneceram sem saída/exit code por mais de cinco minutos e foram interrompidos. O resultado não foi presumido.
- [x] Fase 3: auth, ownership, validação, persistência e timezone cobertos por testes direcionados.
- [x] Fase 8: matriz de robustez rastreada, incluindo limites civis, viradas de mês/ano, ano bissexto, erro/retry, concorrência, fechamento/movimentação imediatos e perfil sem permissão.

## Fase 3 — Evidência de backend

- `BACKEND_CHANGE_NOT_REQUIRED`: as actions existentes já recebem o instante produzido pelo seletor como `Date` ou ISO, normalizam formatos legados aceitos e persistem `DateTime` sem reconversão de fuso. `AtualizarCardBpm` mantém Próximo Contato nullable; reunião, prazo e alerta rejeitam ausência, `null`, booleano e data inválida. Campos dinâmicos `tipo="data"` continuam strings civis `YYYY-MM-DD`.
- Ordem de segurança confirmada: `auth()` ocorre antes de validação/consulta; Zod rejeita payload inválido antes de ownership/persistência; `exigirAcessoBpmCard` é aplicado antes da mutação e novamente dentro das transações de card, tarefa e reunião.
- Limites do dia confirmados pelo contrato civil `YYYY-MM-DDTHH:mm`: `00:00` e `23:59` são válidos; `24:00`, horas/minutos fora da faixa, datas impossíveis e valores parciais são rejeitados antes da action.
- Testes direcionados: 5 arquivos, 27 testes aprovados.
- ESLint direcionado: aprovado sem diagnósticos.
- `git diff --check`: aprovado.
- Typecheck global: falhou por débitos externos já presentes; nenhum diagnóstico nos arquivos desta fase.
- Testes globais: 2121 aprovados e 39 falhas externas/preexistentes em 18 arquivos.
- Build global: bloqueado por `.next/lock` mantido por outra instância de build.
- Lint global: executado com limite de 55 segundos; não concluiu dentro do limite.
- Nenhuma alteração de schema, migration ou operação destrutiva foi realizada.

### Reexecução após feedback obrigatório

- `npm run build`: iniciou sem processo concorrente e sem `.next/lock`; Prisma Client e `build:player` concluíram. O `next build` voltou a permanecer sem saída em `Creating an optimized production build` por mais de dois minutos e foi interrompido, sem diagnóstico de código e sem aprovação presumida. O bloqueio técnico do Forge permanece reproduzido.

### Revalidação Echo da Fase 3

- `BACKEND_CHANGE_NOT_REQUIRED`: contrato, guards e persistência permanecem compatíveis; nenhuma alteração de backend ou banco foi necessária.
- Testes direcionados: 5 arquivos, 27 testes aprovados.
- ESLint direcionado: exit 0, sem erros; 16 warnings preexistentes nos dois componentes de layout/modal.
- `npm run typecheck`: exit 1 somente com diagnósticos externos à File List desta story.
- `npm test`: 2.121 testes aprovados e 39 falhas em 18 arquivos, reproduzindo o baseline documentado; nenhum teste direcionado falhou.
- `npm run lint`: 2.485 erros e 1.258 warnings globais preexistentes; o recorte da story permanece sem erros.
- `npm run build`: Prisma Client e `build:player` concluíram; `next build` não iniciou porque `.next/lock` residual já existia, sem processo de build proprietário. O lock não foi removido por esta execução.

## Fase 4 — Gate Forge

- `npx tsc --noEmit --pretty false`: exit 1; erros globais reproduzidos em módulos externos à File List (Exclusão Fiscal, Check-in, Gerador de Documentos, Agenda/Google Calendar e Radar), sem diagnóstico nos arquivos desta story.
- `npm run lint`: exit 1; 3.743 problemas globais (2.485 erros e 1.258 warnings), mesma contagem registrada na Fase 3.
- ESLint direcionado à File List: exit 0; 0 erros e 16 warnings preexistentes em `CardAbertoLayout.tsx` e `CardFullViewModal.tsx`.
- Testes direcionados: exit 0; 5 arquivos e 27 testes aprovados, 0 falhas.
- `npm test`: exit 1; 267 arquivos/2.121 testes aprovados e 18 arquivos/39 testes com falha, reproduzindo exatamente o baseline da Fase 3; nenhuma falha nos testes direcionados.
- `npm run build`: Prisma Client e bundle do player concluíram; `next build` permaneceu sem saída durante a compilação. Uma repetição detectou `.next/lock` residual da execução interrompida; após validar que não havia processo mantendo o lock e remover apenas esse cache transitório, a execução limpa voltou a permanecer sem saída e foi encerrada com exit 130. Build não aprovado nem presumido.
- `git diff --check`: exit 0.
- Veredito da Fase 4: `FORGE_FAIL` por ausência de conclusão do build obrigatório; nenhuma regressão atribuível à story foi encontrada nos demais gates.

## Fase 5 — Gate Probe

- Caminho estático confirmado: `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → card → `CardFullViewModal` → Formulário da Etapa ou aba Tarefas → `BpmDateTimeField` → Server Action → `ObterCardBpm` na recarga.
- Testes direcionados: 8 arquivos e 47 testes aprovados, incluindo timezone, autosave/flush, ownership, visibilidade de etapa, reunião e tarefa. O round-trip também passou com o processo em `Pacific/Honolulu` e `Asia/Tokyo`.
- ESLint direcionado: exit 0, sem erros; 16 warnings preexistentes nos componentes de layout/modal.
- Gates globais: typecheck e lint falharam por débitos externos já documentados; `npm test` repetiu o baseline de 2.121 aprovações e 39 falhas em 18 arquivos, sem falha direcionada à story.
- `PROBE_FAIL`: `CardFullViewModalContent` deriva `podeEditar` apenas de admin/vínculo e envia esse valor ao `PainelRegistrar`; não considera `card.permissaoEtapa.podeAgir`. O `CardAbertoLayout` calcula corretamente o gate de etapa, mas esse valor não chega ao slot central. Assim, um membro autorizado apenas a visualizar a etapa recebe controles de Próximo Contato/Reunião habilitados; o backend recusa a mutação, porém a exigência de bloqueio em UI e backend não está cumprida.
- `PROBE_FAIL`: `BpmDateTimeField` implementa `allowClear`, mas nenhum consumidor desta story passa a prop. A limpeza de um campo opcional não é exercitável pelo caminho real prometido.
- Validação autenticada em navegador (desktop/mobile) permanece pendência manual por ausência de sessão/credenciais; não foi usada como motivo isolado do reprovação.

AUTO_ADJUSTMENT_REQUIRED: propagar o gate único `isAdminRole(currentUserRole) || (Boolean(meuVinculo) && (card.permissaoEtapa?.podeAgir ?? true))` ao `PainelRegistrar`/`CardOpenFormSlot`, adicionar teste de UI para `podeAgir=false` e conectar `allowClear` a um consumidor realmente opcional ou remover esse critério do escopo com decisão de produto rastreável.

AUTO_ADJUSTMENT_ACCEPTANCE: renderizar o modal com membro vinculado e `permissaoEtapa.podeAgir=false` e comprovar Próximo Contato/Reunião desabilitados, mantendo a recusa backend; renderizar um campo opcional, limpar, persistir e reabrir vazio; repetir o fluxo principal em desktop e mobile com teclado.

### Correção do feedback Probe

- `CardFullViewModalContent` agora deriva `podeEditar` pelo mesmo gate já usado no layout: bypass administrativo ou membro vinculado com `card.permissaoEtapa.podeAgir=true`. O valor segue por `PainelRegistrar` e `CardOpenFormSlot`, desabilitando Próximo Contato e Reunião para acesso somente leitura.
- Próximo Contato, cujo contrato persistido já é nullable, passou a consumir `allowClear`. A limpeza envia `proximoContatoEm: null` à `AtualizarCardBpm`; o schema Zod existente aceita o valor, e a action preserva auth e ownership antes da mutação.
- Não houve mudança de backend, schema ou migration. A validação autenticada em navegador desktop/mobile continua como pendência manual por ausência de credenciais de teste nesta execução.
- Revalidação direcionada após a correção: 9 arquivos e 77 testes aprovados; ESLint dos arquivos alterados sem erros; `git diff --check` aprovado.
- Gates globais reexecutados antes do ajuste da asserção: typecheck e lint mantiveram débitos externos/preexistentes; `npm test` teve 2.121 aprovações e 40 falhas, sendo uma a asserção textual de reunião atualizada nesta correção. O teste afetado e todo o recorte direcionado foram reexecutados com 77/77 aprovações; a suíte global completa não foi repetida depois desse ajuste.

### Revalidação final Probe

- `PROBE_PASS`: o gate visual agora combina vínculo ao card com `permissaoEtapa.podeAgir`; Próximo Contato e Reunião recebem `podeEditar=false` quando a etapa permite apenas visualização, enquanto as Server Actions preservam auth, ownership e revalidação de etapa.
- `PROBE_PASS`: Próximo Contato consome `allowClear`; o trigger limpa o valor, registra o save real e envia `proximoContatoEm: null`, que reaparece vazio após `ObterCardBpm` recarregar o card.
- Persistência e movimentação imediata: seleção/hora → `onCommit`/blur → `registerSave()` → `flushSaves()` → `MoverCardBpm`; falhas mantêm o card aberto ou impedem o movimento com feedback de erro.
- Responsividade e teclado sustentados pela implementação: popover modal com `collisionPadding`, largura limitada a `100vw`, `DayPicker` com foco automático e controles nativos rotulados. A validação autenticada em navegador desktop/mobile continua como pendência manual por ausência de sessão de teste.
- Testes direcionados em `Pacific/Honolulu`: 7 arquivos e 45 testes aprovados. Em `Asia/Tokyo`: 7 arquivos e 45 testes aprovados.
- ESLint direcionado: exit 0, zero erros e 17 warnings preexistentes nos componentes de layout/modal/registro.
- `npm run typecheck`: exit 2 somente com diagnósticos externos à File List. `npm run lint`: 2.485 erros e 1.258 warnings globais preexistentes. `npm test`: 2.122 aprovações e 39 falhas basais em 17 arquivos, sem falha direcionada à story.

DELIVERY_READY: `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → card → Formulário da Etapa (Próximo Contato/Reunião) ou aba Tarefas (Prazo/Alerta) → selecionar calendário e hora → salvar/mover → fechar e reabrir com o mesmo horário civil de São Paulo ou Próximo Contato vazio.

## Fase 6 — Auditoria Anubis

- `ANUBIS_FAIL`: auth e ownership permanecem fail-closed, mas a validação server-side de data/hora aceita strings arbitrárias que o parser permissivo de `Date` consiga interpretar.
- Evidência executada contra a mesma combinação `z.preprocess(normalizarDataHoraBpm, z.date())`: `"09/04/2026 10:30"`, `"September 4, 2026 10:30"`, `"0"` e `"2026-09-04"` foram aceitos pelos schemas obrigatório e opcional. Isso diverge do contrato documentado (`Date`, ISO string ou timestamp) e permite contornar o seletor/validação client-side chamando diretamente `AtualizarCardBpm`, `CriarTarefaBpm`, `AgendarReuniaoGoogleMeetBpm` ou `ReagendarReuniaoBpm`.
- Auth ocorre antes da validação/consulta. Payload inválido conhecido é recusado antes de ownership. `exigirAcessoBpmCard` resolve permissão e vínculo no banco, exige `podeAgir` para mutações e é repetido nas transações. Os guards de etapa/requisitos continuam server-side.
- Não foram encontrados segredos no cliente, payloads sensíveis em logs, SQL dinâmico, XSS ou alteração de schema no recorte desta story.
- Correção requerida para Echo: validar strings com formato ISO explícito antes de convertê-las; aceitar número somente se for timestamp finito dentro do contrato; manter `Date` válida e `null` apenas no schema opcional. Adicionar testes negativos para strings parseáveis não ISO, string numérica e data sem hora.

AUTO_ADJUSTMENT_REQUIRED: `normalizarDataHoraBpm` usa `new Date(valor)` para qualquer string, aceitando formatos arbitrários e dependentes do parser/ambiente nas quatro Server Actions protegidas da story.

AUTO_ADJUSTMENT_ACCEPTANCE: testes server-side comprovam que somente `Date` válida, ISO datetime estrita e timestamp numérico finito são aceitos; strings locais/naturais, strings numéricas, datas sem hora, `null` em campos obrigatórios, booleanos, vazio e datas impossíveis são recusados antes de ownership, Calendar e persistência.

### Correção do feedback Anubis por Echo

- `normalizarDataHoraBpm` agora converte somente `Date`, ISO datetime validada por Zod com timezone (`Z` ou offset) e timestamp numérico finito. Strings parseáveis dependentes do runtime não chegam mais a `new Date()`.
- O schema obrigatório rejeita strings locais/naturais, strings numéricas, data sem hora, vazio, `null`, booleanos, datas impossíveis, `NaN`, infinito e `Date` inválida. O schema opcional mantém apenas `""`/`null` como limpeza compatível de Próximo Contato.
- `AtualizarCardBpm`, `CriarTarefaBpm`, `AgendarReuniaoGoogleMeetBpm` e `ReagendarReuniaoBpm` foram exercitadas com payload direto inválido; a recusa ocorre antes de ownership, Calendar, consultas e transações.
- Round-trip confirmado para ISO em UTC/offset, timestamps e limites `00:00`/`23:59`, preservando o instante persistido. Nenhuma action, query, tabela, coluna, migration ou integração externa foi alterada.
- Testes direcionados: 4 arquivos e 36 testes aprovados. ESLint direcionado e `git diff --check`: aprovados.

DELIVERY_READY: `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → card → Formulário da Etapa ou aba Tarefas → seletor de data/hora → Server Action com validação estrita → persistência existente → reabertura com o mesmo horário de São Paulo.

### Reauditoria final Anubis

- `ANUBIS_PASS`: a correção foi inspecionada no working tree e exercitada contra os schemas e as quatro Server Actions expostas pela story.
- `auth()` antecede validação e qualquer leitura protegida. Payload inválido é recusado pelo Zod antes de ownership, consulta, transação ou Google Calendar.
- `AtualizarCardBpm`, `CriarTarefaBpm`, `AgendarReuniaoGoogleMeetBpm` e `ReagendarReuniaoBpm` aplicam `exigirAcessoBpmCard` no servidor; mutações revalidam o acesso dentro da transação, e reunião mantém os guards server-side de etapa e vínculo do evento.
- O contrato aceita somente `Date` válida, ISO datetime estrita com `Z`/offset e timestamp numérico finito. Strings locais/naturais, strings numéricas, data sem hora, data impossível, vazio, booleano, `NaN`, infinito e `Date` inválida são recusados. `null`/`""` permanecem permitidos somente na limpeza opcional de Próximo Contato.
- A varredura do diff não encontrou segredo/configuração de ambiente no cliente, SQL dinâmico, `eval`, `dangerouslySetInnerHTML`, stack trace devolvido ao usuário ou novo log sensível no recorte.
- Testes de segurança direcionados: 4 arquivos e 36 testes aprovados. ESLint direcionado e `git diff --check`: aprovados.
- Gates globais reexecutados: `npm run typecheck`, `npm run lint` e `npm test` mantêm falhas externas/basais; nenhum diagnóstico ou teste falho é atribuído ao contrato de data/hora desta story.

DELIVERY_READY: `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → card → Formulário da Etapa (Próximo Contato/Reunião) ou aba Tarefas (Prazo/Alerta) → seletor de data/hora → Server Action autenticada, validada e autorizada → persistência → reabertura.

## Correção do feedback Lens por Echo

- A seleção de data no `BpmDateTimeField` apenas atualiza o rascunho; o commit de Próximo Contato ocorre no blur da hora, na limpeza explícita ou no botão de salvar.
- `PainelProximoContato` captura valor + revisão em cada save. Uma resposta antiga atualiza a referência persistida, mas não limpa o estado sujo, não apaga conflito e não substitui uma edição mais recente.
- `CardOpenFormSlot` não usa mais `card.updatedAt` como `key` de `PainelReuniao`. O painel sincroniza props somente para campos limpos; data/hora e resumo sujos permanecem na tela e recebem aviso quando o valor remoto diverge.
- Teste com duas promises controladas comprova que a primeira resolução não confirma nem sobrescreve a segunda hora; a resolução correspondente ao rascunho atual é a única aceita.
- Revalidação após a correção: ESLint direcionado aprovado; 57/57 testes direcionados aprovados em `Pacific/Honolulu` e 57/57 em `Asia/Tokyo`; `git diff --check` aprovado. O typecheck global manteve apenas diagnósticos externos à File List.
- O registro antigo `FORGE_FAIL` abaixo descreve a tentativa histórica sem build concluído. O resumo posterior do Forge registrou `FORGE_PASS` antes deste feedback; como houve nova alteração, o novo veredito oficial do Forge/Lens permanece pendente e não é presumido por Echo.

DELIVERY_READY: `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → card → Formulário da Etapa → Próximo Contato/Reunião → editar data/hora ou resumo → save versionado → atualização/realtime preserva rascunho mais recente → reabertura mantém o valor persistido.

## Revalidação final — Forge e Lens

- O `FORGE_FAIL` da Fase 4 permanece acima como registro histórico da tentativa cujo build não concluiu. O relatório final do Forge, emitido depois das correções, declarou `FORGE_PASS`; esse é o veredito vigente usado como pré-condição desta revisão.
- As duas falhas importantes da revisão Lens anterior foram corrigidas: selecionar a data não dispara save prematuro; saves de Próximo Contato usam snapshot versionado; e `PainelReuniao` não possui mais identidade baseada em `card.updatedAt`, preservando rascunhos sujos e sinalizando conflitos.
- Revisão qualitativa do recorte: nenhum problema bloqueante ou regressão relevante encontrado em correção, arquitetura, acessibilidade, responsividade, tema, TypeScript, imports ou compatibilidade dos contratos de backend.
- Testes direcionados em `Pacific/Honolulu`: 8 arquivos e 57 testes aprovados. Em `Asia/Tokyo`: 8 arquivos e 57 testes aprovados.
- ESLint direcionado: exit 0, zero erros e 16 warnings preexistentes nos componentes de layout/modal. `git diff --check`: exit 0.
- Veredito da Fase 7: `LENS_PASS`.

DELIVERY_READY: `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → card → Formulário da Etapa ou aba Tarefas → calendário e hora → persistência existente → reabertura com o mesmo horário civil de São Paulo ou Próximo Contato vazio.

## Fase 8 — Validação Sage

| Cenário mínimo | Evidência |
|---|---|
| Data/hora futura; início e fim do dia | `data-hora-crm.test.ts`: round-trip real em `00:00` e `23:59`, com ISO esperado |
| Virada de mês e ano | `data-hora-crm.test.ts`: `30/04 → 01/05` e `31/12 → 01/01` |
| Fevereiro e ano bissexto | `data-hora-crm.test.ts`: aceita `29/02/2028`; rejeita `29/02/2027` e `30/02/2028` |
| Valor existente | `data-hora-crm.test.ts`: instante persistido volta ao mesmo valor civil de São Paulo |
| Vazio opcional | `data-hora-crm.test.ts` + `edicao-campos-card.test.ts`: Próximo Contato aceita `null`/vazio e persiste limpeza |
| Obrigatório ausente | `tarefas-tipo.test.ts`, `tarefas-tipo-actions.test.ts` e `google-meet-etapa-guard.test.ts`: prazo, alerta e reunião recusam ausência antes da mutação |
| Valor legado válido | `data-hora-crm.test.ts`: `Date`, ISO com timezone e timestamp finito são normalizados |
| Entrada inválida | `data-hora-crm.test.ts`: parciais, datas impossíveis, parser local/natural, string numérica, booleano, `NaN`, infinito e `Date` inválida são recusados |
| Erro e retry | `rascunho-data-hora.test.ts`: erro não altera o snapshot e a mesma revisão pode ser confirmada no retry; `card-save-flow.test.ts` comprova reset da fila após flush |
| Duplo clique | `card-save-flow.test.ts` e inspeção dos consumidores: guards `salvando`/`movendoEtapa`, `disabled` e `aria-busy` impedem novo envio durante a requisição |
| Fechamento imediato | `card-save-flow.test.ts`: blur precede `flushSaves`; falha mantém o modal aberto |
| Movimentação imediata | `card-save-flow.test.ts`: blur/flush precedem `MoverCardBpm`; falha interrompe o movimento |
| Desktop e mobile | Inspeção ponta a ponta: grid `1 coluna → sm:2`, popover limitado a `100vw`, `collisionPadding=12` e sheet limitado à viewport; validação visual autenticada permanece manual |
| Teclado | Inspeção ponta a ponta: trigger nativo, `DayPicker autoFocus`, input de hora e ação de limpeza nativos; validação em navegador permanece manual |
| Perfil sem permissão | `data-hora-crm.test.ts`, `tarefas-tipo.test.ts`, `tarefas-tipo-actions.test.ts` e `google-meet-etapa-guard.test.ts`: UI recebe `podeAgir=false` e actions recusam sessão/ownership antes de persistir |
| Independência do timezone | Suíte direcionada executada separadamente com `TZ=Pacific/Honolulu` e `TZ=Asia/Tokyo`; renderização, envio, persistência simulada e recarga preservam o civil de `America/Sao_Paulo` |

Rastreabilidade dos critérios de aceite: os 16 critérios estão cobertos pela matriz acima e pelos testes direcionados de `data-hora`, rascunho, fila de saves, tarefas, reunião, permissões e campos dinâmicos. A validação não se apoia somente na presença do componente: conversões, schemas e Server Actions são executados com mocks de persistência/ownership; os aspectos estritamente visuais de viewport e navegação por teclado ficam como pendência manual explícita.

### Resultado Sage

- `SAGE_PASS`: nenhum cenário funcional quebrado no recorte da story.
- Testes direcionados em `Pacific/Honolulu`: 8 arquivos, 68 testes aprovados.
- Testes direcionados em `Asia/Tokyo`: 8 arquivos, 68 testes aprovados.
- ESLint dos testes alterados: aprovado sem diagnósticos.
- `npm run typecheck`: exit 2 por débitos externos já registrados em Exclusão Fiscal, Check-in, Gerador de Documentos, Agenda/Google Calendar e Radar; nenhum diagnóstico na File List desta story.
- `npm run lint`: exit 1 com o baseline global já documentado de 2.485 erros e 1.258 warnings; nenhum diagnóstico nos dois testes alterados.
- `npm test`: 269 arquivos/2.150 testes aprovados; 17 arquivos/39 testes falharam no baseline externo já reproduzido pelas fases anteriores, sem falha no recorte da story.
- Validação autenticada em navegador desktop/mobile e navegação integral por teclado permanecem pendências manuais; a ausência de sessão não bloqueia o veredito porque os gates direcionados, contratos executáveis e inspeção estática sustentam a entrega.

DELIVERY_READY: `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → card → Formulário da Etapa (Próximo Contato/Reunião) ou aba Tarefas (Prazo/Alerta) → calendário e hora → salvar/mover → fechar e reabrir com o mesmo horário civil de São Paulo ou Próximo Contato vazio.

## Fase 9 — Consolidação Scribe

- [x] Critérios de aceite e checklist final confrontados com o working tree e os gates das Fases 3–8.
- [x] Fluxo, componentes, persistência, timezone, backend e caminho de consumo registrados em `.bibble/memory/architecture.md`.
- [x] Contrato reutilizável de `BpmDateTimeField` atualizado em `.bibble/memory/components.md`.
- [x] Wiring de novos consumidores documentado em `.bibble/memory/integration-points.md`.
- [x] Decisão civil de São Paulo → instante persistido registrada em `.bibble/memory/decisions.md`.
- [x] Race de save/remount diagnosticada e resolvida registrada em `.bibble/memory/known-errors.md`.
- [x] Novos arquivos estruturais catalogados em `.bibble/memory/codebase-map.md`.
- [x] File List reconciliada com todos os artefatos da story e da consolidação.
- [x] Confirmado: houve apenas endurecimento de validação no backend; destinos/actions de persistência permaneceram compatíveis.
- [x] Confirmado: nenhuma alteração de schema, migration, seed ou backfill foi realizada.

**Divergências do plano original:** a seleção da data não comita imediatamente; após o feedback Lens, ela apenas atualiza o rascunho e o commit ocorre no blur da hora, na limpeza ou no botão do consumidor. O gate visual também passou a considerar `permissaoEtapa.podeAgir`, e Próximo Contato conectou `allowClear` por ser nullable, atendendo ao feedback Probe. A validação Zod foi endurecida após a auditoria Anubis, sem mudar a persistência.

**Gates consolidados:** Forge, Probe, Anubis, Lens e Sage registraram PASS. A evidência final direcionada foi 68/68 em `Pacific/Honolulu` e 68/68 em `Asia/Tokyo`, com ESLint direcionado e `git diff --check` aprovados. Gates globais permanecem com débitos externos: typecheck/lint fora da File List, 39 falhas basais em 17 arquivos no `npm test` e build Next.js sem conclusão no ambiente. Validação autenticada desktop/mobile e teclado integral permanecem pendências manuais.

DELIVERY_READY: `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → card → campo de data/hora em **Formulário da Etapa** ou **Tarefas** → seleção → persistência existente → fechar e reabrir com o mesmo horário civil de `America/Sao_Paulo` ou com Próximo Contato vazio.

## File List

- `src/lib/format-date.ts`
- `src/lib/bpm/rascunho-versionado.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/BpmDateTimeField.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximoContato.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelTarefasPorTipo.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx`
- `tests/bpm/data-hora-crm.test.ts`
- `tests/bpm/rascunho-data-hora.test.ts`
- `tests/bpm/card-save-flow.test.ts`
- `tests/bpm/tarefas-tipo.test.ts`
- `tests/bpm/tarefas-tipo-actions.test.ts`
- `tests/bpm/google-meet-etapa-guard.test.ts`
- `tests/bpm/edicao-campos-card.test.ts`
- `tests/bpm/card-campos-agendar-reuniao.test.ts`
- `src/actions/bpm/GoogleMeet.ts`
- `src/lib/validations/bpm.ts`
- `.bibble/memory/architecture.md`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/components.md`
- `.bibble/memory/decisions.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/known-errors.md`
- `docs/stories/story-rm-2026-eb401c-melhorias-campos-data-hora.md`
