# Story — Um único X para fechar o lead do CRM

## Status

Ready for Review — ajuste isolado sobre a produção publicada `274d6d6f`; QA final da integração aprovada, commit/push e validação remota do candidato ainda pendentes.

## Executor Assignment

executor: "@dev"; quality_gate: "@qa"; quality_gate_tools: ["npm run lint", "npm run typecheck", "npm test", "npm run build", "revisão e smoke"]

## Story e fonte

Como usuário do CRM, quero apenas um X no canto superior direito do detalhe de um lead do Instagram, para fechar a janela sem controles duplicados. Pedido explícito de 2026-10-23: excluir um dos dois botões; depois, “pode commitar direto para produção”. Esta autorização específica permite publicar somente este ajuste isolado sobre produção, sem promover outro pacote do staging.

Histórico: o alias READY inicial era `04cc69c0`; a ponta `main` em `274d6d6f` tinha vinte commits ainda não publicados e falha de deploy, por isso o primeiro candidato/QA foi isolado em `04cc69c0`. Outro fluxo publicou esses commits e o alias passou a READY `274d6d6f`. O candidato atual parte dessa produção nova, preserva os patches byte-idênticos dos dois arquivos e acrescenta só esta correção/documentação. Após QA de integração, DevOps pode fazer push normal para `main` se o fresh-ref ainda corresponder à produção verificada; se avançar, reavaliar o destino ou usar snapshot hotfix isolado, sem forçar refs ou recuar produção. `staging` permanece intocada.

## Acceptance Criteria

1. O detalhe do lead Instagram/NoLoss apresenta apenas um X no canto superior direito, mantendo o botão próprio do cabeçalho acessível por `aria-label="Fechar"`.
2. Clicar no X restante fecha o detalhe; Escape, fechamento pelo overlay e botão textual do rodapé mantêm seu comportamento existente. Formulário, dados e ação de assumir permanecem iguais.
3. Os demais consumidores de `SheetContent` continuam exibindo seu X padrão, salvo opt-out explícito; nenhuma mudança global de aparência ou navegação é introduzida.
4. Executar gates obrigatórios e verificação proporcional do fechamento; registrar File List e resultados reais antes do commit/push isolado de produção. Não alterar dados, schema, ENV ou configuração remota.

## Dev Notes — Scout e blueprint mínimo

- `NolossLeadModal.tsx` contém o X próprio no cabeçalho e usa `SheetContent`, que adiciona outro X automaticamente. O mesmo modal atende Instagram e site/NoLoss; preservar esse compartilhamento. [Source: `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NolossLeadModal.tsx`, render do Sheet e header]
- Adicionar `showCloseButton?: boolean`, com valor padrão `true`, a `SheetContent`; condicionar somente a renderização de seu `SheetPrimitive.Close`. Em `NolossLeadModal`, passar `showCloseButton={false}`. Não alterar `onOpenChange`, listeners Radix ou callbacks do lead. [Source: `src/components/ui/sheet.tsx#SheetContent`]
- A API opcional segue o padrão que já existe em `DialogContent`, sem novo componente ou seletor CSS dependente de estrutura. [Source: `src/components/ui/dialog.tsx#DialogContent`]
- Contexto anterior: leads pendentes usam modal próprio; cards promovidos continuam no detalhe nativo. [Source: `.bibble/memory/integration-points.md`, seção NolossLeadModal]
- `[AUTO-DECISION]` Manter X do cabeçalho e desabilitar apenas o automático neste consumidor; default dos outros Sheets permanece ligado. Não criar epic/PRD ou tarefa externa para esta correção pequena e autorizada.
- `accumulated-context.md` e `.aiox/gotchas.json` foram procurados e não existem nesta cópia; coerência conferida nos componentes reais e memória acima. Persona SM usa fallback `.aiox-core/development/agents/sm.md`.

## Testing e CodeRabbit Integration

Frontend, baixa complexidade. @dev/Nova implementa; @qa valida acessibilidade e regressão; @github-devops publica. Pre-Commit: quatro gates e revisão independente; Pre-Deployment: escopo, destino, rollback de código e deploy correto; Pre-PR só se houver PR. CodeRabbit, se disponível, sem inventar relatório; fallback de revisão independente se ausente. Self-healing Story 6.3.3: dev light (2 iterações/15 min, CRITICAL), QA full (3/30 min, CRITICAL/HIGH), DevOps report-only; foco: um X, callback, default compatível e ausência de mudança de negócio.

Verificar com testes existentes e/ou smoke de navegador um X gráfico no cabeçalho, fechamento pelo clique e Escape, e default de outro Sheet. Não criar testes que apenas espelham o JSX nem registros de lead para um ajuste visual reversível. Rodar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` no ambiente local sanitizado; produção só recebe código após QA.

## Tasks / Subtasks

- [x] Scout e story com escopo, origem e checklist de preparação.
- [x] Implementar opt-out local e preservar demais Sheets (AC1–3); dois arquivos de frontend aplicados por Nova e aprovados por QA.
- [x] Fechar QA da integração sobre `274d6d6f` e atualizar checklist/File List (AC1–4); gates e QA anteriores de `04cc69c0` preservados abaixo.
- [ ] DevOps: commit/push normal do ajuste isolado, conferir fresh-ref/alias e confirmar deploy sobre a produção atual (AC4).

## Story Draft Checklist

Objetivo/contexto PASS; orientação técnica PASS; referências PASS; autossuficiência PASS; testes PASS; CodeRabbit/fallback PASS. **READY**, clareza 10/10, nenhuma informação externa bloqueante. Isto valida a preparação, não declara código ou testes executados.

## File List

- Criado: `docs/stories/story-crm-lead-fechar-unico-20261023.md`.
- Modificados por Nova: `src/components/ui/sheet.tsx`; `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NolossLeadModal.tsx`.
- Atualizados somente na documentação: `.bibble/memory/known-errors.md`; `.bibble/memory/journal.md`. Total: cinco caminhos.

## Dev Agent Record / QA Results

Checkpoint histórico validado sobre `04cc69c0` — Forge: tipos exit 0/46,32 s; lint exit 0/43,75 s; build literal exit 0/92,23 s (pico agregado 7.470.018.560 bytes, abaixo do limite local de 7 GiB); `npm test` com quatro workers exit 0/51,44 s, 729 arquivos e 5.909 testes PASS, zero falhas, quatro skipped e um todo (5.914 no total). Fonte `2c72…` idêntica antes, no retry e ao final. Primeiro build falhou por ENOSPC do host, sem falha de código; evidência inicial preservada. Coordenação removeu apenas três outputs próprios regeneráveis, sem arquivos versionados ou processos ativos, liberando 10,3 GB; prova `cleanup-own-builds.json`. Repetido somente o build afetado, sem alterar app/package/ENV para contornar a falha.

**QA anterior de `04cc69c0` APPROVED.** Lens pós-gates revisou os dois arquivos de frontend: zero bloqueantes e zero importantes. Probe Chrome com os componentes NoLoss/Sheet e CSS reais confirmou um X de cabeçalho tanto para Instagram quanto site, rodapé legítimo, fechamento por cabeçalho/Escape/overlay/rodapé e um X automático funcional em outro Sheet sem opt-out; zero erros de página, zero pedidos à API e seis callbacks observados. Props locais e stub apenas da atribuição inativa: isso não é E2E de um cliente real. Provas privadas `qa-final-private.json` e `probe/instagram-one-x.png`.

**QA FINAL DA INTEGRAÇÃO `274d6d6f` APPROVED / GO.** Tipos oficiais exit 0/48,63 s; lint dos dois arquivos exit 0/1,33 s; oito arquivos/59 testes PASS, zero falhas, 1,60 s; hash `59660d46…` idêntico antes/depois. Os dois arquivos de runtime são byte-idênticos ao candidato anterior e o grafo fechado de imports/caller, React/lock/Next/config está inalterado. Por essa evidência, Probe/Lens anteriores e gates globais de `04cc69c0`, mais o READY do parent `274d6d6f`, foram herdados; não alegar novo rerun global ou outro build local sobre a integração.

Commit/push normal dos cinco caminhos para `main`, somente com fresh-ref igual à produção `274d6d6f`, e deploy/alias/smoke remotos permanecem **PENDENTES** neste checkpoint pré-publicação; evidência posterior será privada, sem novo commit documental que dispare outro deploy. Alteração inicial: 2026-10-23, River; primeiro isolamento em `04cc69c0` e atualização para `274d6d6f` somente após confirmação de que outro fluxo já publicou os vinte commits.
