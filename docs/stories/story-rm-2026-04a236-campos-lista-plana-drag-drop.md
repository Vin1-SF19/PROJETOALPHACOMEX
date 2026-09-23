# Story RM-2026-04A236 — Campos do formulário em lista plana com drag & drop e metadados visíveis

**Projeto:** Painel Alpha  
**Módulo:** Alpha CRM / BPM  
**Status:** Ready — pronto para execução  
**Preparação:** Nova, Fase 2, 2026-09-22  
**Origem:** objetivo RM-2026-04A236, auditoria da Fase 0 e blueprint Scout da Fase 1 recebidos no pipeline.

## Contexto, problema e objetivo

O editor atual apresenta seções aninhadas, reordenação por setas e o badge genérico CAMPO. Administradores precisam visualizar os campos em lista única, reconhecer tipo e obrigatoriedade e reordenar por drag & drop. A sequência publicada deve chegar ao formulário do card para usuários autorizados, sem perda de dados ou das composições existentes.

Esta fase entrega a especificação consumida por Echo, Nova e verificadores pelo arquivo desta story no repositório. Não entrega ainda a funcionalidade. O nome canônico é este arquivo com sufixo `-drag-drop.md`, conforme Fase 2; ele substitui a sugestão de nome `story-rm-2026-04a236-campos-lista-plana.md` do Scout, evitando duplicação.

## Escopo

- Lista plana na configuração da etapa, sem agrupamento visual por seções, com reordenação global por ponteiro e teclado.
- Nome, tipo real pelo catálogo TIPOS_CAMPO e obrigatoriedade efetiva da configuração da etapa visíveis por campo.
- Tradução da sequência visual para os arrays de seções/componentes existentes, mantendo publicação explícita e ordem no card.
- Compatibilidade com CHECKLIST, CAPABILITY, labels, IDs, chaves, configurações, criação/exclusão e componentes especializados existentes.
- Acessibilidade, estados da interface, testes e verificação dos caminhos integrados.

## Fora de escopo e segurança de banco

- Alterar ordem das colunas do Kanban, regras de negócio das etapas ou a estrutura de configuração de pipeline.
- Criar rota, menu, atalho ou permissão: os caminhos existentes atendem ao objetivo.
- Consolidar automaticamente componentes em uma seção única, apagar seções vazias ou reescrever valores dos cards.
- Reformular autosave, remover recuperação de rascunhos, alterar contratos de seção incidentalmente ou corrigir falhas de outros módulos.
- Migration, schema, seed/backfill ou mutação em massa. Se uma implementação demonstrar essa necessidade, interromper antes da execução e abrir fase Vault adicional com plano exato, backup completo verificado de até 48 horas, rollback e aprovação humana específica; nenhuma aprovação histórica autoriza a operação. Emitir WAITING_APPROVAL pelo pipeline, sem executar a mudança protegida.
- Commit, push, reset, checkout, publicação ou PR nesta fase local.

## Auditoria de entregabilidade e integração real

**Artefato final do objetivo:** editor integrado de campos em lista plana e sequência publicada consumida pelo formulário do card.

**Administrador:** Painel Alpha → Alpha CRM → Configurações → pipeline → Campos e formulários → selecionar etapa, em `/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]`. A aba Etapas e fluxo também integra a configuração do pipeline, sem confundir campos com colunas.

`src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/page.tsx` verifica sessão e perfil administrativo, carrega ObterPipelineBpm e monta PipelineEditorStateProvider / AdminPipelineClient. Este monta FormularioEtapaWorkspace. PipelineEditorStateProvider, usePipelineEditorState e pipeline-editor-store preservam rascunhos por pipeline, modo e etapa.

**Usuário autorizado:** Alpha CRM → Pipelines → pipeline → abrir card → Formulário da Etapa, em `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]`. Cadeia: PipelineBoardClient → CardFullViewModal → PainelRegistrar → CardOpenFormSlot → FormularioEtapaRenderer → PainelCamposEtapaAtual.

ObterCardBpm, em `src/actions/bpm/Cards.ts`, carrega a composição e usa resolverFormularioEtapa. O resolver ordena seções/componentes; PainelCamposEtapaAtual respeita a ordem recebida em campoIds. Preservar contratos secoes, secaoId, secaoTitulo e agrupamento de campos consecutivos no consumidor.

Navegação e proteção existentes: `src/lib/modulos-registry.ts`, `src/components/layout/GlobalSidebar.tsx`, `src/app/PainelAlpha/AlphaCRM/CRMLayoutClient.tsx` e `src/lib/bpm/ownership.ts`. Publicação exige configurarCampos; leitura/ações do card mantêm controle de acesso.

DELIVERY_READY: infraestrutura de configuração e consumo conectada no código pelas duas rotas acima; inspeção estática revalidada na Fase 2. Navegação autenticada e nova interação ainda precisam de validação na fase executora.

## Autoajuste obrigatório das fases 0 e 1

AUTO_ADJUSTMENT_REQUIRED: não foi localizada story da RM-2026-04A236 em docs/stories/.

AUTO_ADJUSTMENT_ACCEPTANCE: criar esta story antes de alterar a aplicação, com blueprint, critérios, checklist e File List.

- [x] ADJ-01 — Criar a story canônica, incorporar integralmente os achados e tarefas do Scout e marcar Ready.
- [x] AC-DOC — Arquivo existe no caminho exigido, rastreia RM-2026-04A236 e distingue preparação documental de implementação pendente.

**Autoajuste aplicado:** criação desta story. Nenhuma lacuna de rota, visualizador ou exportação foi demonstrada; documentação técnica é consumida no repositório, enquanto a funcionalidade será consumida nas telas existentes.

## Blueprint técnico e preservação de dados

1. Nova altera FormularioEtapaWorkspace para projetar os componentes das seções em lista única. Mostrar o tipo real via TIPOS_CAMPO e a obrigatoriedade da configuração da etapa, preservando aplicabilidade e visibilidade.
2. Reutilizar o estado de PipelineEditorStateProvider/usePipelineEditorState/pipeline-editor-store. Preservar alterações preexistentes em FormularioEtapaWorkspace e PainelCamposEtapaAtual, especialmente autosave e recuperação de rascunhos; reinspecionar o diff antes de editar.
3. Traduzir movimento global removendo o componente da origem e inserindo antes/depois do destino, inclusive entre seções, mantendo ordem relativa dos demais. Preservar IDs e seções vazias; não consolidar automaticamente a composição.
4. Validar colisão de chave no destino e limite de 100 componentes por seção antes de aceitar o movimento. Em rejeição, manter o estado anterior e informar o motivo. IDs de drag devem ser estáveis, independentes do índice e sem colisão entre seções, inclusive para itens ainda não publicados.
5. Reutilizar DndContext, SortableContext, useSortable, sensores de ponteiro/teclado e sortableKeyboardCoordinates do padrão de `src/components/layout/TabBar.tsx`, adaptando a estratégia horizontal para lista vertical.
6. Reutilizar `src/components/ui/card.tsx`, `src/components/ui/badge.tsx`, ícones Lucide e tokens de `src/app/globals.css` / `src/lib/temas.ts`; consultar catálogo de componentes e regras Nova. Não criar biblioteca paralela.
7. Manter sem etapas, lista vazia, criação/publicação em andamento, erro de validação, conflito de versão e sucesso. Falhas conservam rascunhos; descarte restaura snapshot. Trocar etapa/modo/pipeline não mistura rascunhos.
8. Echo valida/reutiliza `src/actions/bpm/FormulariosEtapa.ts` e `src/lib/bpm/formularios-etapa.ts`. SalvarFormularioEtapaBpm grava posições dos arrays e preserva identidades mesmo entre seções. Não substituir composição publicada pela ordem de BpmCampoEtapaConfig.
9. Schema existente: BpmFormularioSecao.ordem e BpmFormularioComponente.ordem persistem sequência; BpmCampoEtapaConfig mantém visibilidade, obrigatoriedade e aplicabilidade. Nenhuma migration é necessária no desenho recebido.
10. Preservar sessão, configurarCampos, vínculo etapa/pipeline, identidade e aplicabilidade dos componentes, Zod, transação, versaoEsperada e atualização condicional contra concorrência. Publicação mantém BpmPipelineConfigAuditoria, avanço da versão, revalidação administrativa e PIPELINE_ALTERADO.
11. Usar `src/lib/bpm/formulario-renderer.ts` e FormularioEtapaRenderer.tsx como contratos de referência. Não perder CHECKLIST/CAPABILITY intercalados nem revelar campos invisíveis. Alterar consumidor somente se uma lacuna comprovada impedir paridade da ordem.
12. Configuração estrutural de etapas/colunas permanece em `src/actions/bpm/ConfiguracaoPipeline.ts`, com Etapas.ts, SubStatus.ts e Campos.ts relacionados; esta story trata da composição do formulário.

## Critérios de aceite verificáveis

- [x] AC-01 — Na configuração de uma etapa com múltiplas seções, todos os componentes aparecem em lista única sem cabeçalhos/grupos visuais de seção; especializados continuam disponíveis.
- [x] AC-02 — Arrastar um item para cima/baixo, inclusive entre antigas seções e para extremos, produz a ordem esperada sem duplicar/perder IDs; soltar fora ou cancelar não altera a sequência.
- [x] AC-03 — Publicar, recarregar a configuração e reabrir a mesma etapa mantém exatamente a sequência confirmada; alteração não publicada permanece rascunho e não modifica o formulário publicado.
- [x] AC-04 — Cada campo mostra nome, tipo real e indicação textual de obrigatório/opcional coerente com sua configuração na etapa, sem depender apenas de cor ou do badge CAMPO.
- [x] AC-05 — Abrir card autorizado na etapa reproduz a sequência publicada dos campos visíveis, mantendo os componentes especializados em suas posições, labels, valores e comportamento de edição existentes.
- [x] AC-06 — Movimento preserva IDs, chaves, configurações, seções vazias e valores dos cards. Colisão de chave e exceder 100 componentes no destino são rejeitados sem alteração parcial.
- [x] AC-07 — Alça tem nome acessível com o nome do item, foco visível e instruções. Tab alcança os controles; teclado permite iniciar, mover, concluir e cancelar o arraste. Foco permanece no item movido/cancelado e leitor de tela anuncia nome e nova posição/total ou cancelamento/erro.
- [x] AC-08 — Há alternativa ao arraste por ponteiro: controles Mover para cima/baixo, acionáveis por teclado e clique simples, com os mesmos limites e persistência. Nos extremos, ações indisponíveis são identificadas; lista vazia/única não quebra foco ou leitura.
- [x] AC-09 — Falha de publicação, validação ou conflito de versão mantém o rascunho, informa erro e não simula sucesso; descarte restaura snapshot. Sem etapas, vazio, carregamento/criação/publicação e sucesso permanecem tratados.
- [x] AC-10 — Troca de etapa/modo/pipeline mantém isolamento de rascunhos; publicar respeita sessão/permissões e nega IDs ou vínculos inválidos. Nenhuma regressão de autosave/recuperação no card.
- [x] AC-11 — Fluxo integrado reordenar → publicar → recarregar configuração → abrir card é validado com múltiplas seções, campo invisível e componentes especializados, sem perda de dados.

## Responsabilidades e tarefas

- [x] Scout/Fase 1 — blueprint recebido e integração revalidada nesta preparação.
- [x] Nova/Fase 2 — preparar story Ready e resolver ADJ-01, sem editar aplicação.
- [x] Echo — conferir contrato de publicação, movimento entre seções, identidade, concorrência, auditoria e rejeições; mudança de backend somente se necessária ao aceite, sem schema ou lote.
- [x] Nova — implementar lista plana, metadados, movimentos globais, validações locais, acessibilidade e estados usando componentes/estado existentes; preservar contratos e trabalho alheio.
- [ ] Echo/Nova — testar publicação e paridade no consumidor; atualizar File List real ao editar.
- [ ] Forge — executar gates reais, registrar códigos/saídas e distinguir baseline global de regressões do escopo; aprovação técnica não presumida.
- [ ] Probe — presença, trigger, rota protegida, permissões, persistência, estados da UI, integrações existentes e regressões, incluindo fluxo autenticado completo.
- [ ] Anubis — auditar contratos de auth/autorização e dados caso tocados; não reduzir guardas existentes.
- [ ] Lens — revisão qualitativa apenas após aprovação técnica Forge.
- [ ] Sage — confirmar testes relevantes e registrar evidência de regressão ausente.
- [ ] Scribe — atualizar `codebase-map.md` e `integration-points.md` se estrutura mudar.
- [ ] Kowalski — arquivar sessão com trabalho real em `journal.md`.

## Casos de teste

| # | Suíte | Cenário | Esperado |
|---|-------|---------|----------|
| T-01 | `tests/bpm/pipeline-editor-react.test.ts` | Arraste por ponteiro: mover item da posição 2 para 5 em lista com 8 itens | Ordem atualizada, IDs preservados, sem duplicação |
| T-02 | `tests/bpm/pipeline-editor-react.test.ts` | Arraste por teclado: iniciar, mover 2 posições, confirmar | Mesma ordem que ponteiro; foco retorna ao item |
| T-03 | `tests/bpm/pipeline-editor-react.test.ts` | Cancelar arraste (Escape) | Sequência inalterada; foco no item original |
| T-04 | `tests/bpm/pipeline-editor-react.test.ts` | Mover item entre seções (ex.: seção A pos. 3 → seção B pos. 1) | Item removido de A, inserido em B; seções vazias preservadas |
| T-05 | `tests/bpm/pipeline-editor-react.test.ts` | Colisão de chave no destino | Movimento rejeitado; estado anterior mantido; mensagem de erro |
| T-06 | `tests/bpm/pipeline-editor-react.test.ts` | Exceder 100 componentes na seção destino | Movimento rejeitado; estado anterior mantido |
| T-07 | `tests/bpm/pipeline-editor-react.test.ts` | Descarte de rascunho após reordenação | Snapshot restaurado; sequência volta ao estado publicado |
| T-08 | `tests/bpm/pipeline-editor-react.test.ts` | Troca de etapa com rascunho pendente | Rascunho isolado por etapa; nova etapa mostra seu próprio estado |
| T-09 | `tests/bpm/formularios-etapa-save.test.ts` | Publicar com movimento entre seções | `BpmFormularioComponente.ordem` atualizado; IDs preservados; auditoria gravada |
| T-10 | `tests/bpm/formularios-etapa-save.test.ts` | Conflito de versão (`versaoEsperada` divergente) | Publicação rejeitada; rascunho mantido; mensagem de conflito |
| T-11 | `tests/bpm/formularios-etapa-save.test.ts` | Publicação sem permissão `configurarCampos` | Rejeição 403; nenhum dado alterado |
| T-12 | `tests/bpm/formulario-renderer.test.ts` | Renderizar composição com 3 seções, campo invisível e CAPABILITY intercalado | Ordem respeitada; invisível oculto; CAPABILITY em posição correta |
| T-13 | `tests/bpm/card-modal-integration.test.ts` | Abrir card após publicação com nova ordem | `PainelCamposEtapaAtual` exibe sequência publicada; metadados corretos |

## Checklist de gates

- [ ] `npm run lint` — zero erros nos arquivos tocados
- [ ] `npm run typecheck` (`npx tsc --noEmit`) — zero erros de tipo
- [ ] `npm test` — suítes T-01 a T-13 passando
- [ ] `npm run build` — build completa sem erros
- [ ] Forge — gates reais executados e registrados com saída
- [ ] Probe — 8 pontos de integração verificados (presença, trigger, rota, permissão, persistência, estados, integrações, regressão)
- [ ] Anubis — auditoria de auth/ownership se contratos de API tocados
- [ ] Lens — revisão qualitativa após Forge
- [ ] Scribe — memória atualizada
- [ ] Kowalski — sessão arquivada

## File List

| Arquivo | Ação | Responsável |
|---------|------|-------------|
| `docs/stories/story-rm-2026-04a236-campos-lista-plana-drag-drop.md` | Criar (esta story) | Nova |
| `src/components/bpm/FormularioEtapaWorkspace.tsx` | Editar — lista plana, drag & drop, metadados | Nova |
| `src/components/bpm/PainelCamposEtapaAtual.tsx` | Editar (se necessário) — paridade de ordem no card | Nova |
| `src/actions/bpm/FormulariosEtapa.ts` | Editar (se necessário) — contrato de publicação | Echo |
| `src/lib/bpm/formularios-etapa.ts` | Editar (se necessário) — helpers de composição | Echo |
| `src/lib/bpm/formulario-renderer.ts` | Referenciar — contrato de renderização | Echo/Nova |
| `src/components/bpm/FormularioEtapaRenderer.tsx` | Referenciar — contrato de renderização | Echo/Nova |
| `src/components/layout/TabBar.tsx` | Referenciar — padrão `@dnd-kit` | Nova |
| `tests/bpm/pipeline-editor-react.test.ts` | Ampliar — T-01 a T-08 | Nova |
| `tests/bpm/formularios-etapa-save.test.ts` | Ampliar — T-09 a T-11 | Echo |
| `tests/bpm/formulario-renderer.test.ts` | Ampliar — T-12 | Nova |
| `tests/bpm/card-modal-integration.test.ts` | Ampliar — T-13 | Nova |

## Rastreabilidade

- **RM:** RM-2026-04A236
- **Fase atual:** 2 — Preparação documental (concluída)
- **Fase seguinte:** 3 — Implementação (Echo + Nova)
- **Status:** Ready para execução
- **Dependências:** nenhuma externa; contratos internos já mapeados
- **Requisitos inventados:** nenhum — todos os critérios derivam do blueprint Scout da Fase 1 e da auditoria da Fase 0s de sucesso, falha, concorrência e acessibilidade.
- [ ] Scribe/Kowalski — consolidar memória pertinente e histórico da implementação, checklist e File List.

## Casos de teste e gates da implementação

| Suíte / verificação | Cenários e critérios |
| --- | --- |
| tests/bpm/pipeline-editor-react.test.ts | Ponteiro, teclado, alternativa por botões, foco/anúncios, metadados, extremos, cancelamento, descarte, troca de etapa, falha de publicação; AC-01/02/04/07/08/09/10 |
| tests/bpm/formularios-etapa-save.test.ts | Movimento entre seções, IDs e seções vazias, colisão, limite 100/101, autorização, conflito de versão, atomicidade e auditoria; AC-03/06/10 |
| tests/bpm/formulario-renderer.test.ts | Ordem publicada, CHECKLIST/CAPABILITY intercalados e campos invisíveis; AC-05/11 |
| tests/bpm/card-modal-integration.test.ts | Integração da composição com card, ordem e valores existentes, compatibilidade com autosave; AC-05/10/11 |
| Fluxo autenticado e leitor de tela | Publicar/recarregar/abrir card, tipo/obrigatoriedade, foco após mover/cancelar, anúncio e alternativa ao ponteiro; AC-03/04/07/08/11 |

- [ ] `npm run lint`
- [ ] `npm run typecheck` (e `npx tsc --noEmit` no gate Forge)
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Testes pertinentes acima aprovados; falhas globais comparadas com logs anteriores e registradas sem atribuição indevida.

## File List

### Alterações efetivas da Fase 2

- `docs/stories/story-rm-2026-04a236-campos-lista-plana-drag-drop.md` — criada; especificação e checklist.
- `.bibble/memory/journal.md` — registro incremental da preparação documental.
- `docs/qa/rm-2026-04a236/phase2-*.log` — evidências dos gates executados nesta fase; nomes e resultados consolidados abaixo.

### Arquivos previstos para implementação (ainda não alterados por esta fase)

- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx` — mudança principal Nova.
- `tests/bpm/pipeline-editor-react.test.ts`
- `tests/bpm/formularios-etapa-save.test.ts`
- `tests/bpm/formulario-renderer.test.ts`
- `tests/bpm/card-modal-integration.test.ts`

### Referências / alteração somente se lacuna comprovada

- `src/actions/bpm/FormulariosEtapa.ts`, `src/lib/bpm/formularios-etapa.ts`, `src/lib/bpm/formulario-renderer.ts` — contratos Echo.
- `src/app/PainelAlpha/AlphaCRM/CardModal/FormularioEtapaRenderer.tsx`, `PainelCamposEtapaAtual.tsx` no mesmo diretório — consumidor e rascunhos.
- `PipelineEditorStateProvider.tsx`, `pipeline-editor-store.ts` e `AdminPipelineClient.tsx` no diretório administrativo acima — integração e estado.
- Demais rotas, navegação, schema e componentes citados no blueprint são referências, não alterações planejadas.

## Registro de execução da Fase 2

Preparação documental concluída; critérios funcionais e gates de implementação continuam pendentes. Evidência de entregabilidade é estática, sem navegação autenticada. Nenhuma operação de banco ou Git mutável realizada.

### Gates executados na preparação documental

- `npm run lint`: FAIL, exit 1; 2.417 erros e 1.218 warnings globais, mesmas contagens do histórico registrado em journal.md. Markdown não é coberto pelo ESLint configurado; nenhum código foi editado nesta fase.
- `npm run typecheck`: PASS, exit 0. O erro TS2352 relatado no histórico não ocorreu nesta execução; nenhuma correção de tipos foi realizada nesta fase.
- `npm test`: FAIL, exit 1; 16 arquivos com falha / 466 aprovados, 21 testes com falha / 3.604 aprovados / 1 TODO. Comparação automática das linhas FAIL com `docs/qa/rm-2026-b88712/phase11-scribe-test.log`: conjuntos idênticos, zero falhas novas. Inclui card-modal-integration, que exige tratamento na fase executora sem atribuir a esta documentação a regressão preexistente.
- `npm run build`: PASS (exit 0). Consultar log para limitações do ambiente; compilação webpack concluída, com avisos de pdfjs e acesso negado ao .env durante coleta de páginas. Nenhuma credencial foi lida para contornar a restrição.
- Validação documental: conteúdo mínimo, rastreabilidade, AC-DOC/ADJ-01, blueprint, responsabilidades, acessibilidade, limites de banco, caminhos de entrega e checklist conferidos. Critérios funcionais continuam desmarcados e status Ready preservado.

Evidências efetivas: `docs/qa/rm-2026-04a236/phase2-lint.log`, `phase2-typecheck.log`, `phase2-test.log` e `phase2-build.log` no mesmo diretório. PASS desta fase é documental; não representa aprovação dos gates globais nem conclusão da feature.


## Fase 4 — Echo: contrato de persistência (2026-09-22)

- [x] Reutilizada SalvarFormularioEtapaBpm: sessão antes de acesso, configurarCampos antes e dentro da transação, vínculo etapa/pipeline e aplicabilidade canônica.
- [x] Zod exige snapshot completo (`secoes` e `componentes` obrigatórios), IDs/chaves únicos e limites de 30 seções/100 componentes; posições são índices dos arrays, campos `ordem` arbitrários são rejeitados. Omissão explícita de componente continua sendo exclusão pelo contrato CRUD existente; não se introduziu endpoint de reordenação parcial nem se bloqueou a exclusão legítima.
- [x] Preservados CAS/versaoEsperada, identidades/targets, metadados, auditoria e avanço de configVersion. Nenhuma escrita em valores, tipos ou obrigatoriedade dos campos. Nenhuma operação contra banco real, schema, migration ou mutação em massa.
- [x] Acrescentada revalidação da rota do pipeline consumidor além da administrativa. PIPELINE_ALTERADO continua atualizando board e revisão do card aberto.
- [x] Testes de payload inválido, duplicidade, posições arbitrárias, sessão, permissão inclusive revogada na transação, etapa/campo/componente estranho, movimento entre seções com seção vazia, metadados, CAS e falha durante componente/auditoria.
- [x] Rollback testado com adaptador transacional em memória: erro escapa do callback, estado não é confirmado e não há revalidação/notificação. Não equivale a ensaio de rollback no motor de banco real.

DELIVERY_READY: administrador em `/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]` → Campos e formulários → etapa → publicação chama a action; usuário autorizado em `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → abrir card consome Cards/resolverFormularioEtapa/PainelCamposEtapaAtual. PipelineBoardClient recebe o evento e recarrega cards/revisão do modal. Caminho inspecionado no código, persistência/notificação verificadas por testes com mocks; navegação autenticada permanece para Probe/Nova.

### Gates efetivamente executados

- PASS: testes focados de save e renderer, 40/40; ESLint dos dois arquivos tocados; npm run typecheck; npm run build; git diff --check dos arquivos de código.
- FAIL global: npm run lint, 2.417 erros/1.218 warnings, mesmas contagens da Fase 2; lint do escopo limpo.
- npm test inicial: falhou antes dos casos por EBUSY no diretório compartilhado coverage. Reexecução `npm test -- --coverage.reportsDirectory=docs/qa/rm-2026-04a236/phase4-coverage`: 21 falhas em 16 arquivos; 3.638 testes aprovados, 1 TODO. Linhas FAIL comparadas com phase2-test.log: nenhuma falha nova. Gates globais não declarados aprovados.
- Resultado local da fase: PASS. UI drag & drop, ensaio autenticado e demais gates especializados permanecem pendentes nas fases responsáveis.

### File List efetiva da Fase 4

- `src/actions/bpm/FormulariosEtapa.ts` — revalidação adicional da rota consumidora.
- `tests/bpm/formularios-etapa-save.test.ts` — cobertura negativa/transacional e movimento entre seções; reset dos mocks para isolamento.
- `docs/stories/story-rm-2026-04a236-campos-lista-plana-drag-drop.md` — checklist e evidências desta fase.
- `.bibble/memory/journal.md` — registro incremental.
- `docs/qa/rm-2026-04a236/phase4-{focused,scope,lint,typecheck,test,test-isolated,build}.log` — saídas reais dos gates. Diretório phase4-coverage reservado para saída de cobertura isolada.


### Revalidação Echo da Fase 4 — 2026-09-22

- [x] Reinspecionados action, schema Zod, autorização administrativa e testes existentes; nenhum ajuste adicional de código necessário. Blueprint Scout e implementação anterior preservados.
- [x] Persistência/renderer: 40/40 testes aprovados; ESLint da action, schema e teste aprovado (exit 0).
- [x] npm run typecheck aprovado (exit 0), sem OOM nesta execução.
- [x] npm run lint executado: FAIL (exit 1), 2.417 erros e 1.218 warnings, mesmas contagens anteriores.
- [x] npm test com coverage.reportsDirectory isolado executado: FAIL (exit 1), 21 falhas / 3.638 aprovados / 1 TODO; 16 arquivos falharam e 467 passaram. Comparação das linhas FAIL com phase4-test-isolated.log: nenhuma nova falha.
- [x] npm run build executado: PASS, exit 0.
- [x] Entregabilidade reinspecionada: administrador publica em /PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId], pela action SalvarFormularioEtapaBpm; usuário autorizado abre o card em /PainelAlpha/AlphaCRM/pipeline/[pipelineId], com Cards/resolverFormularioEtapa e PainelCamposEtapaAtual respeitando campoIds. Testes verificam revalidação das duas rotas e notificação. Navegação autenticada não executada.

File List desta revalidação: esta story; .bibble/memory/journal.md; docs/qa/rm-2026-04a236/echo-recheck-{focused,lint,typecheck,test,build}.log; cobertura gerada em echo-recheck-coverage/. Nenhum arquivo de aplicação/teste alterado, nenhuma operação contra banco real ou Git mutável. PASS local do contrato não significa aprovação dos gates globais ou da fase de UI.


## Fase 5 — Nova: execução local

- [x] Lista linear de cards com nome, tipo humano e obrigatoriedade; componentes especializados preservados. Controles estruturais existentes ficam em detalhes recolhidos, sem agrupar os cards.
- [x] @dnd-kit existente reutilizado: ponteiro, teclado, cancelamento, alça explícita, foco, anúncios e botões alternativos; nenhuma dependência adicionada.
- [x] Movimentos globais preservam IDs/metadados/seções vazias e validam colisão de chave e limite 100 antes de aplicar.
- [x] Publicação explícita mantida. Não há publicação otimista: falhas preservam rascunho e snapshot publicado; Descartar restaura o snapshot. Ref bloqueia publicação duplicada; controles ficam desabilitados durante operações.
- [x] Testes focados: 64/64 PASS, incluindo sensores reais em happy-dom, cancelamento, read-only, metadados, ordem consumida pelo resolver, conflitos/publicação e recuperação existentes.
- [x] ESLint do escopo e npm run typecheck: PASS (exit 0). npm run build: PASS (exit 0).
- [x] npm run lint executado: FAIL global, 2.417 erros/1.218 warnings, mesmas contagens da fase Echo.
- [x] npm test reexecutado: 3.645 PASS, 21 FAIL, 1 TODO; 16 arquivos falharam e 468 passaram. Comparação das linhas FAIL com echo-recheck-test.log: nenhuma falha nova. Uma falha transitória de Prisma durante geração concorrente desapareceu na reexecução; expectativa antiga de seções no teste de integração foi atualizada.
- [ ] Navegação autenticada, leitor de tela real, avaliação visual/responsividade e gates especializados posteriores permanecem para verificação. PASS local não declara aprovação global ou publicação em produção.

DELIVERY_READY: administrador acessa /PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId] → Campos e formulários → etapa → lista plana → Publicar composição. Usuário autorizado abre card em /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → Formulário da Etapa. Workspace conectado à action existente; resolver testado com sequência reordenada; PainelCamposEtapaAtual ordena por campoIds recebido. Evidência por código e testes, sem sessão autenticada de navegador.

### File List efetiva da Fase 5

- src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx — integração, bloqueios e preservação dos controles existentes.
- src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/ListaCamposFormulario.tsx — lista acessível e metadados.
- src/lib/bpm/ordem-formulario.ts — projeção e movimento imutável entre seções.
- tests/bpm/formulario-lista-plana.test.ts — testes de componente, sensores e consumidor.
- tests/bpm/crm-configuracoes-centralizadas.test.ts — contrato atualizado para lista extraída.
- Esta story; .bibble/memory/components.md, codebase-map.md, integration-points.md e journal.md — registro incremental.
- docs/qa/rm-2026-04a236/nova-*.log e *.exit — gates iniciais/finais; nova-workspace-before.txt — snapshot anterior; nova-final-coverage/ — cobertura.

Nenhuma operação de banco/schema/migration ou Git mutável. Alterações preexistentes preservadas.

## Revalidação terminal de 2026-09-23

Retomada a partir da fase 6, sem refazer a implementação. Quatro suítes de lista plana, publicação, renderer e editor React passaram **58/58**; ESLint dos componentes/helper/teste pertinentes e typecheck completo passaram. O contrato de versão, autorização e publicação foi reinspecionado no código. O fluxo com login, arraste no navegador e recarga contra banco real fica para Testes. O staging automático permanece bloqueado por alterações de autoria compartilhada com outras RMs no worktree; nenhum deploy foi feito nesta revalidação.
