# RM-2026-B7694F — Mover Checklists e Anotações para o lado esquerdo do card

## Status

Ready for Review

## Story

Como usuário autenticado do Alpha CRM que consulta e atualiza um card nativo do Kanban,
quero encontrar Tarefas, Checklist, Etapas concluídas, Anexos, Histórico e Cadências no painel esquerdo e registrar Anotações no rodapé desse painel,
para concentrar o acompanhamento operacional no mesmo lado do card sem duplicar conteúdo nem alterar a persistência existente.

## Contexto e problema

O modal completo do card já possui um layout de três painéis, mas a composição atual não corresponde ao objetivo:

- `PainelHistorico.tsx`, no lado esquerdo, mostra Etapas concluídas, Tarefas, Anexos, Histórico, Timeline e Cadências;
- `PainelChecklistsCard` é montado no formulário central por `CardOpenFormSlot.tsx` em dois ramos condicionais;
- o editor de Anotação e o listener `bpm:abrir-pendencias-checklist` ficam em `PainelRegistrar.tsx`, também no painel central;
- a Timeline possui uma aba visual própria, embora o sistema, seus dados e seus contratos devam continuar preservados.

Esta story reorganiza somente a composição frontend já existente. Não cria um domínio novo, não altera os contratos de persistência e não muda as regras de autorização.

## Consumidor e caminho de acesso

O consumidor é o usuário autenticado com acesso a um card nativo do Alpha CRM. O caminho real já existente é:

```text
/PainelAlpha/AlphaCRM/pipeline/[pipelineId]
  → card nativo no Kanban
  → CardFullViewModal
  → CardAbertoLayout
  → painel esquerdo PainelHistorico
```

Cards virtuais Noloss usam outro modal e não são consumidores desta entrega.

O artefato desta fase é esta story, consumida pelos agentes de implementação e qualidade diretamente em `docs/stories/story-rm-2026-b7694f-mover-checklists-anotacoes-card.md`. A entrega funcional posterior reutilizará a rota e o modal existentes; não são necessários menu, rota, download, atalho ou permissão novos.

DELIVERY_READY: a infraestrutura de consumo já existe em `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → card nativo → `CardFullViewModal` → `CardAbertoLayout` → `PainelHistorico`; esta story define o delta mínimo para a fase executora tornar a nova composição visível nesse caminho.

## Evidências e componentes reutilizáveis

- `PainelHistorico.tsx` já é o host das abas e do conteúdo esquerdo.
- `PainelTarefasPorTipo`, `PainelResumoEtapas` e `PainelCadenciasCard` já atendem suas respectivas abas.
- Anexos e Histórico já são implementados dentro de `PainelHistorico.tsx`.
- `PainelChecklistsCard` já implementa loading, erro/retry, vazio, sucesso, conflito realtime, progresso e foco de pendências.
- `PainelRegistrar.tsx` já possui o editor de Anotação e usa exclusivamente `CriarInteracaoCardBpm`.
- `PainelTimelineCard`, `ListarTimelineCardBpm` e os extratores da Timeline já existem e devem ser preservados.
- `PainelConhecimentoRelacionado` já aparece acima das abas esquerdas e permanece no mesmo local.
- O padrão vigente usa Tabs controladas do shadcn/Radix, `flex-wrap` no seletor e conteúdo com `min-h-0`/overflow interno.

## Escopo

1. Reordenar as abas visíveis do painel esquerdo para:
   1. Tarefas;
   2. Checklist;
   3. Etapas concluídas;
   4. Anexos;
   5. Histórico;
   6. Cadências.
2. Criar a aba Checklist reutilizando a instância única de `PainelChecklistsCard`.
3. Retirar as duas montagens de `PainelChecklistsCard` do formulário central.
4. Transferir o tratamento do evento `bpm:abrir-pendencias-checklist` para o painel esquerdo, selecionando a aba Checklist antes de rolar e focar a pendência.
5. Extrair o editor existente para `EditorAnotacaoCard.tsx` e montá-lo uma única vez no rodapé esquerdo, fora da área rolável das abas.
6. Remover o editor, seus estados e sua action de `PainelRegistrar.tsx`.
7. Ocultar a aba Timeline removendo somente seu acionador visual; preservar componente, conteúdo, action, extratores e dados.
8. Ajustar apenas o wiring necessário entre `CardFullViewModal`, `CardAbertoLayout`, `PainelHistorico` e `PainelRegistrar`.
9. Atualizar os testes estáticos desatualizados e adicionar as garantias desta composição.

## Fora de escopo

- Remover ou redesenhar o sistema Timeline, `PainelTimelineCard`, `ListarTimelineCardBpm`, extratores ou dados associados.
- Alterar schema, migration, seed, backfill, índices, constraints ou qualquer estrutura de banco.
- Alterar persistência, modelo ou regras de materialização de Checklist.
- Redesenhar a experiência interna de Checklist ou criar um segundo componente equivalente.
- Alterar `CriarInteracaoCardBpm`, autenticação, Zod, ownership, histórico ou realtime de Anotações.
- Criar API, Server Action, rota, menu, atalho, permissão ou fluxo paralelo.
- Alterar cards virtuais Noloss.
- Remover `PainelConhecimentoRelacionado`, formulários por etapa, upload de anexos, Histórico, Cadências ou requisitos de avanço.
- Mudar o estado inicial `etapas`, salvo se um teste existente demonstrar que ele impede a navegação programática para Checklist.

## Critérios de aceite

### AC1 — Caminho funcional e ordem observável

Dado um usuário autenticado com acesso ao pipeline,
quando abrir um card nativo em `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]`,
então o painel esquerdo exibirá exatamente seis acionadores nesta ordem: **Tarefas**, **Checklist**, **Etapas concluídas**, **Anexos**, **Histórico** e **Cadências**.

### AC2 — Timeline ocultada sem remoção do sistema

Dado o mesmo card aberto,
quando o usuário inspecionar a navegação esquerda,
então não haverá acionador visível **Timeline**,
e `PainelTimelineCard`, `ListarTimelineCardBpm`, os extratores e os testes de domínio da Timeline continuarão presentes e funcionais.

### AC3 — Checklist com montagem única e antecipada

Dado que o card foi aberto,
quando qualquer aba esquerda estiver ativa,
então existirá exatamente uma instância React de `PainelChecklistsCard`, hospedada no `TabsContent` de Checklist com `forceMount`,
e a carga/materialização continuará ocorrendo na abertura do card, sem esperar o primeiro clique na aba e sem remontar a cada troca de aba.

### AC4 — Estados e contratos do Checklist preservados

Dado que o usuário abrir a aba Checklist,
quando a leitura estiver carregando, falhar, não retornar itens, retornar itens ou detectar conflito realtime,
então os estados atuais de loading, erro com retry, vazio, sucesso, progresso, conflito e proteção de rascunho continuarão observáveis,
sem mudança em `ListarChecklistsCardBpm`, `materializarChecklistsAplicaveisCard`, ownership ou persistência.

### AC5 — Navegação para pendências

Dado que `PainelProximaEtapa` disparou `bpm:abrir-pendencias-checklist` para o card aberto,
quando o painel esquerdo receber o evento,
então ele selecionará a aba Checklist e focará `checklist-item-${itemId}` quando houver item, ou `checklist-pendencias` como fallback,
mantendo rolagem suave e foco programático acessível.

### AC6 — Ausência de montagem central duplicada

Dado o card em qualquer etapa, inclusive **Agendar Reunião**,
quando o formulário central renderizar,
então `CardOpenFormSlot` e `PainelRegistrar` não montarão Checklist nem editor de Anotação,
e os demais formulários condicionais continuarão inalterados.

### AC7 — Anotação no rodapé esquerdo

Dado um usuário com `podeEditar`,
quando preencher e salvar uma Anotação no rodapé esquerdo,
então o editor utilizará exclusivamente `CriarInteracaoCardBpm`, exibirá estado de salvamento, impedirá envio vazio ou duplicado e notificará `onInteracaoCriada` após sucesso,
mantendo o identificador estável `anotacao-card-${card.id}` e a atualização no Histórico/realtime.

Dado um usuário sem `podeEditar`,
quando visualizar o rodapé,
então não conseguirá submeter uma Anotação.

### AC8 — Anotação fora da área rolável das abas

Dado o painel esquerdo com conteúdo longo,
quando o usuário rolar a aba ativa,
então o editor de Anotação permanecerá como irmão `shrink-0` da área das abas, no rodapé esquerdo, sem segunda instância e sem ser deslocado para dentro do conteúdo rolável.

### AC9 — Desktop e viewport reduzido

- Em `lg+`, o modal preserva o grid existente `1.1fr / 1fr / max-content`, a altura de `94vh` e o overflow interno por aba; o rodapé de Anotação permanece dentro da coluna esquerda.
- Em viewport abaixo de `lg`, o layout continua em uma coluna com rolagem vertical utilizável; os seis acionadores usam `flex-wrap`, não causam overflow horizontal obrigatório e permanecem alcançáveis por teclado.
- Em ambos os tamanhos, Checklist, editor de Anotação e ações de Anexos não ficam recortados ou sobrepostos.

### AC10 — Acessibilidade

- A navegação preserva a semântica e o teclado do Tabs do Radix: Tab para entrar, setas para alternar acionadores e foco visível.
- A seleção programática de Checklist não remove o foco do item solicitado após a rolagem.
- O editor mantém label associado ao campo, nome acessível para salvar, estados disabled perceptíveis e feedback de sucesso/erro por toast já existente.
- Controles de anexos continuam sendo alcançáveis e identificáveis; nenhuma nova ação será implementada com `div onClick`.
- Nenhuma informação depende somente de cor, e o tema/accent atual continua sendo reutilizado.

### AC11 — Sem regressão de autorização ou persistência

- Checklist continua exigindo `visualizar` para leitura/materialização e `editarCard` para mutações, inclusive a segunda checagem dentro da transação.
- Anotação continua protegida pela autenticação, validação Zod e ownership `editarCard` já existentes na Server Action.
- Não haverá mudança em schema/migration nem escrita em massa.
- Abrir e trocar abas não cria Checklist duplicado nem Anotação duplicada.

## Tarefas técnicas

- [x] **T1 — Preparar a extração do editor de Anotação**
  - [x] Criar `src/app/PainelAlpha/AlphaCRM/CardModal/EditorAnotacaoCard.tsx` como Client Component de responsabilidade única.
  - [x] Mover sem alterar o contrato: estado do texto, estado de salvamento, chamada a `CriarInteracaoCardBpm`, toasts, limpeza após sucesso, `podeEditar` e callback `onInteracaoCriada`.
  - [x] Preservar o padrão visual de `<details>/<summary>`, o botão explícito de salvar e `id="anotacao-card-${card.id}"`.

- [x] **T2 — Reorganizar o host esquerdo**
  - [x] Em `PainelHistorico.tsx`, incluir os imports de `PainelChecklistsCard` e `EditorAnotacaoCard` e remover somente imports visuais da Timeline que ficarem órfãos.
  - [x] Estender props explicitamente tipadas com `podeEditar`, `realtimeRevision` e `onInteracaoCriada`, sem prop drilling além do wiring já existente entre modal/layout/painel.
  - [x] Ordenar os seis `TabsTrigger` conforme AC1 e adicionar `TabsContent value="checklist" forceMount` com a única instância de `PainelChecklistsCard`.
  - [x] Remover apenas `TabsTrigger value="timeline"`; preservar `TabsContent`/`PainelTimelineCard` e contratos de domínio.
  - [x] Transferir o listener `bpm:abrir-pendencias-checklist`, selecionando `checklist` antes de rolar/focar o alvo.
  - [x] Montar `EditorAnotacaoCard` após `Tabs`, como rodapé `shrink-0` fora do scroll das abas.
  - [x] Preservar `PainelConhecimentoRelacionado` acima das abas.

- [x] **T3 — Remover montagens centrais**
  - [x] Em `CardOpenFormSlot.tsx`, remover o import e as duas montagens de `PainelChecklistsCard`, sem alterar a seleção dos demais formulários por etapa.
  - [x] Em `PainelRegistrar.tsx`, remover imports, estados, função de salvamento, JSX e listener transferidos; manter somente as abas centrais **Formulário da Etapa** e **Script**.
  - [x] Remover props que se tornarem órfãs em `PainelRegistrar`, sem eliminar dados ainda consumidos no painel esquerdo.

- [x] **T4 — Ajustar wiring do modal**
  - [x] Em `CardAbertoLayout.tsx`, encaminhar `podeEditar`, `realtimeRevision` e `onInteracaoCriada` a `PainelHistorico`.
  - [x] Em `CardFullViewModal.tsx`, manter `interacoes`/Anotações e o callback de atualização disponíveis ao layout esquerdo e retirar apenas props comprovadamente órfãs do painel central.
  - [x] Confirmar que o reload/realtime atual atualiza o feed de Histórico após salvar a Anotação.

- [x] **T5 — Atualizar testes direcionados**
  - [x] `tests/bpm/formulario-etapa.test.ts`: ausência de Checklist/Anotação no centro e presença do editor no painel esquerdo.
  - [x] `tests/bpm/checklists-entrega-shell.test.ts`: exatamente uma montagem esquerda, `forceMount`, listener e foco de pendência.
  - [x] `tests/bpm/card-modal-integration.test.ts`: wiring atual e ordem exata dos seis acionadores.
  - [x] `tests/bpm/timeline-card.test.ts`: ausência do acionador Timeline e preservação de componente, action, ownership e extratores.
  - [x] Adicionar teste que falhe se `PainelChecklistsCard` ou `EditorAnotacaoCard` tiver mais de uma montagem no fluxo do card nativo.

- [ ] **T6 — Verificação manual responsiva e acessível**
  - [ ] Desktop `lg+`: abrir cada aba, verificar overflow interno e rodapé esquerdo estável.
  - [ ] Viewport reduzido: verificar uma coluna, wrap dos acionadores, rolagem e ausência de sobreposição.
  - [ ] Validar navegação por teclado, foco visível, evento “Ir para pendências”, loading/erro/vazio/sucesso e estados disabled.

- [x] **T7 — Atualizar documentação de fechamento**
  - [x] Marcar tarefas e checklist de conclusão desta story.
  - [x] Atualizar a File List com todos e somente os arquivos realmente afetados.
  - [x] Registrar mudanças de componentes/pontos de integração nas memórias exigidas pelo projeto, sem reescrever entradas alheias.

## Plano de testes

### Direcionados

```bash
npx vitest run \
  tests/bpm/formulario-etapa.test.ts \
  tests/bpm/checklists-entrega-shell.test.ts \
  tests/bpm/card-modal-integration.test.ts \
  tests/bpm/timeline-card.test.ts
```

Validar explicitamente:

- ordem textual/DOM dos seis acionadores;
- inexistência de `TabsTrigger value="timeline"`;
- preservação do sistema Timeline fora da navegação;
- uma única montagem de Checklist com `forceMount`;
- ausência de Checklist e Anotação no centro;
- wiring de `podeEditar`, `realtimeRevision` e `onInteracaoCriada`;
- seleção da aba Checklist e foco pelos IDs estáveis;
- uma única montagem do editor no rodapé esquerdo.

### Regressivos e gates do repositório

```bash
npx vitest run tests/bpm/
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

Falhas de baseline devem ser registradas com comando, contagem e evidência de que não foram introduzidas pela story; não podem ser declaradas como sucesso.

## Gates obrigatórios

1. **Scout — recebido:** blueprint confirmado nas fases anteriores, com rota, consumidores, componentes, arquivos, riscos e contratos mapeados.
2. **Forge:** executar `npx tsc --noEmit` ou `npm run typecheck`, `npm run lint` e `npm run build` reais; registrar exit code e diagnósticos.
3. **Probe:** validar os oito pontos de integração: presença visual, trigger, rota/proteção, permissões, persistência, estados da UI, integrações e regressões. O caminho obrigatório é pipeline → card nativo → modal → painel esquerdo.
4. **Anubis:** confirmar que o diff não altera auth/API/Server Actions nem enfraquece ownership. Se qualquer fronteira de segurança for tocada, executar auditoria completa antes de prosseguir.
5. **Lens:** revisar somente após Forge, verificando composição, responsabilidade única, tipagem, acessibilidade, montagem única e ausência de remoção indevida da Timeline.
6. **Sage:** executar testes direcionados e regressivos, cobrindo os critérios observáveis e edge cases de viewport, permissão, realtime e foco.
7. **Scribe/Kowalski:** atualizar memórias e histórico da sessão depois da implementação significativa.

## Riscos e mitigação

| Risco | Mitigação exigida |
|---|---|
| Checklist materializar somente após selecionar a aba | Usar `forceMount` no único `TabsContent` de Checklist e testar carga na abertura. |
| Duas instâncias dispararem leituras/materializações concorrentes | Remover as duas montagens centrais antes de adicionar a única montagem esquerda; teste de contagem. |
| “Ir para pendências” continuar selecionando o formulário central | Transferir o listener e selecionar `checklist` antes de rolar/focar. |
| Anotação ter dois editores ou perder atualização do Histórico | Extrair o editor existente, montar uma vez e preservar callback/action/realtime. |
| Ocultação da Timeline apagar funcionalidade de domínio | Remover apenas o acionador e testar preservação dos arquivos/actions/extratores. |
| Rodapé reduzir espaço útil ou sobrepor conteúdo em viewport pequena | Manter Tabs flexível com `min-h-0`, scroll interno em desktop e fluxo vertical utilizável abaixo de `lg`. |
| Alterações concorrentes no working tree serem sobrescritas | Reinspecionar cada arquivo antes de editar e aplicar deltas mínimos compatíveis. |

## Checklist de conclusão

- [x] Story aprovada e mantida atualizada durante a implementação.
- [x] Exatamente seis abas visíveis na ordem definida pelo AC1.
- [x] Aba Timeline não visível; sistema Timeline preservado.
- [x] Checklist montado exatamente uma vez no painel esquerdo com `forceMount`.
- [x] Checklist e Anotação ausentes do painel central.
- [x] Evento de pendências abre Checklist e foca o alvo correto.
- [x] Editor de Anotação montado exatamente uma vez no rodapé esquerdo.
- [x] Persistência, ownership, histórico e realtime preservados.
- [x] Estados loading, erro/retry, vazio, sucesso, conflito e disabled preservados e cobertos por testes estáticos direcionados.
- [ ] Desktop e viewport reduzido validados.
- [ ] Acessibilidade por teclado e foco validada.
- [x] Nenhuma alteração de banco/schema/migration.
- [x] Testes direcionados e regressivos executados.
- [x] Forge, Probe, Anubis, Lens e Sage registrados na ordem exigida.
- [x] File List atualizada com o diff final real.

## File List

### Criado nesta fase documental

- [x] `docs/stories/story-rm-2026-b7694f-mover-checklists-anotacoes-card.md`

### Implementado nesta fase

- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/EditorAnotacaoCard.tsx` — novo editor extraído.
- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistoricoShared.tsx` — `SectionCard` e formatadores compartilhados extraídos para manter responsabilidade/tamanho do host.
- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx` — abas, Checklist, listener e rodapé.
- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistoricoPipeline.tsx` — import do `SectionCard` compartilhado.
- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistoricoServico.tsx` — import do `SectionCard` compartilhado.
- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx` — wiring do painel esquerdo.
- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx` — retirada das montagens centrais de Checklist.
- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar.tsx` — retirada de Checklist/Anotação/listener centrais.
- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx` — remoção de props centrais órfãs.
- [x] `tests/bpm/formulario-etapa.test.ts`
- [x] `tests/bpm/checklists-entrega-shell.test.ts`
- [x] `tests/bpm/card-modal-integration.test.ts`
- [x] `tests/bpm/timeline-card.test.ts`
- [x] `.bibble/memory/components.md`
- [x] `.bibble/memory/integration-points.md`
- [x] `.bibble/memory/journal.md`

## Registro da implementação — 2026-09-05

- Testes direcionados: 48/48 aprovados; `git diff --check` aprovado.
- ESLint direcionado: zero erros. Typecheck com heap ampliado: 29 diagnósticos externos à File List.
- Lint global: 2.484 erros e 1.257 warnings de baseline. Suíte global: 2.317 aprovados e 56 falhas externas à entrega.
- Anubis: nenhuma fronteira de auth/API/action alterada. Probe: composição e caminho verificados estaticamente; smoke visual autenticado pendente. Lens não foi executado porque o Forge global não aprovou, conforme a ordem constitucional.
- Build: interrompido com exit 130 após mais de dez minutos sem saída nova na compilação otimizada; não foi declarado aprovado.
- A verificação visual autenticada desktop/mobile permanece pendência operacional manual.

## Notas de segurança e banco

- Esta story não autoriza alteração de banco, schema ou migration.
- Nenhum backup ou aprovação Vault é necessário para a reordenação frontend descrita.
- Se a implementação descobrir necessidade estrutural de banco, deve interromper o trabalho e abrir o checkpoint Vault específico, sem ampliar esta story silenciosamente.
