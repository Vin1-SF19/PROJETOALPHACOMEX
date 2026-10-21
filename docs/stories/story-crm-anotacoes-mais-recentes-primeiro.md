# Story — Anotações dos cards CRM mais recentes primeiro

## Status

Ready for Review — correção revisada, testes e build equivalente aprovados; publicação e conferência remota de staging pendentes.

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["npm run lint", "npm run typecheck", "npm test", "npm run build"]

## Story

Como usuário do CRM, quero visualizar as anotações dos cards da mais recente para a mais antiga, incluindo as feitas no Painel Alpha e as importadas do RD Station, para consultar primeiro as informações atuais.

Origem: pedido direto do usuário em 2026-10-21. Correção de apresentação/ordenação, sem alterar registros, schema, backfill ou importação. Entrega em staging primeiro; produção não autorizada.

## Acceptance Criteria

1. As anotações dos cards CRM aparecem em ordem decrescente de data, tanto para registros feitos no Painel Alpha quanto para os importados do RD Station, inclusive quando as duas origens aparecem no histórico unificado.
2. Eventos RD usam a data efetivamente exibida por `apresentarEventoRd`: data original ou sua correção vigente. Não se usa a data de importação como substituta; datas removidas, ausentes ou inválidas permanecem ao final. Empates no histórico RD usam ID para resultado determinístico, preservando os arrays recebidos.
3. A consulta RD adota ordenação decrescente coerente com a apresentação; a ordenação final continua considerando correções. A atualização da lista após criar ou corrigir anotações mantém a ordem mais recente primeiro, sem perder, duplicar ou modificar conteúdo/autoria dos registros.
4. O fluxo Alpha já decrescente e o histórico unificado continuam funcionando. Não são adicionados controles de UI, filtros, variáveis de ambiente ou regras de importação.
5. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` são executados e têm seus resultados reais registrados. Após validação, DevOps publica e verifica a entrega em staging, registrando URL e commit/release. Não há publicação em produção.

## Dev Notes e referências

- `src/lib/bpm/rd-station-display.ts`, `ordenarHistoricoRd`: atualmente ordena ASC usando a data de `apresentarEventoRd`, com cópia do array e desempate por ID. Ajustar para DESC, mantendo datas inválidas/ausentes ao final; não inverter um array ordenado de forma que essas datas passem para o início.
- `src/actions/bpm/RdStationHistorico.ts`, `ListarHistoricoExternoRd`: consulta eventos por `occurredAt ASC, id ASC` e aplica o helper após montar projeções. Alinhar consulta para DESC sem alterar a ordem ASC das versões de correção.
- `src/lib/bpm/rd-station-display.ts`, `combinarHistoricosRd`: já intercala Alpha/RD em DESC e considera a data RD exibida. Preservar esse comportamento e cobrir fontes misturadas.
- `src/lib/bpm/timeline.ts`, `montarFeedTimelineCard`, e `src/actions/bpm/Interacoes.ts`: notas Alpha já são ordenadas por data decrescente. Evitar mudanças de runtime sem necessidade comprovada.
- `tests/bpm/rd-station-recovery.test.ts`: possui expectativa ASC no helper RD e cenário de histórico misto. Ajustar a expectativa e acrescentar regressões pertinentes. `tests/bpm/timeline-card.test.ts` cobre o feed Alpha.
- `AGENTS.md`, Fluxo de ambientes: staging `https://staging.alpha-comex.com`, branch `staging`, antes de produção; conferir ambiente efetivo. `package.json`, scripts: comandos reais dos quatro gates.

**[AUTO-DECISION] Escopo:** usar o pedido direto como origem, sem inventar epic ou tarefa externa. Correção mínima no helper/consulta RD; testes devem preservar os caminhos Alpha/unificado já corretos. `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados na preparação anterior; contexto cruzado disponível em `story-staging-sincronizacao-fluxo-staging-primeiro.md` e no código citado.

## Tarefas / subtarefas

- [x] Registrar escopo, critérios, evidências e aplicar checklist de draft.
- [x] Corrigir helper RD para DESC com datas ausentes/invalidas ao final, desempate e imutabilidade (AC 1–2).
- [x] Alinhar ordenação da consulta RD, preservando projeções e versões de correção (AC 2–3).
- [x] Cobrir RD, Alpha, fontes misturadas e atualização da lista com testes adequados (AC 1–4).
- [x] Executar os quatro gates e registrar resultados reais (AC 5).
- [ ] DevOps publicar/validar somente staging e registrar URL e commit/release (AC 5).
- [ ] Atualizar checklist, File List, evidências e status ao concluir.

## Testing

Testar anotações RD fora de ordem; data corrigida que muda a posição; data removida, vazia e inválida ao final; empate por ID e array de entrada intacto. Confirmar notas Alpha em DESC, intercaladas com RD pela data exibida. Verificar lista recarregada após inclusão/correção sem duplicação. Usar testes existentes e fixtures; não alterar registros reais nem banco para fabricar evidência.

## CodeRabbit Integration

- **Story Type Analysis:** correção de lógica/apresentação; secundário API; complexidade baixa.
- **Specialized Agents:** @dev para implementação/Pre-Commit; @qa para regressões; @devops para publicação staging.
- **Quality Gates:** Pre-Commit: revisar diff e quatro gates; CodeRabbit se disponível, registrando limitação/revisão alternativa se ausente. Pre-PR por DevOps se houver PR; conferir destino/release antes do deploy staging.
- **Self-Healing:** @dev light, 2 iterações/15 minutos para CRITICAL, HIGH documentado; @qa full, 3 iterações/30 minutos para CRITICAL/HIGH, MEDIUM como dívida; @devops check, somente reporte.
- **Focus Areas:** data exibida versus importação, correções RD, datas ausentes, desempate, imutabilidade e regressão Alpha/histórico misto.

## Validação da preparação — @sm

`story-draft-checklist.md` aplicado: objetivo/contexto PASS; orientação técnica PASS; referências PASS; informação autocontida PASS; testes PASS; CodeRabbit PASS. **READY, clareza 9/10.** Nenhum teste ou deploy foi executado nesta preparação.

## Dev Agent Record e File List

- `docs/stories/story-crm-anotacoes-mais-recentes-primeiro.md` — criado na preparação.
- `src/lib/bpm/rd-station-display.ts` — ordenação RD decrescente pela data exibida, com ausentes/inválidas ao final e desempate por ID.
- `src/actions/bpm/RdStationHistorico.ts` — consulta inicial por occurredAt desc; versões de correção preservadas em asc.
- `tests/bpm/rd-station-recovery.test.ts` — data corrigida, fusos, datas ausentes/inválidas, desempate, imutabilidade e notas Alpha/RD intercaladas após inclusão.
- `tests/bpm/rd-station-actions.test.ts` — contrato de retorno RD decrescente, preservando conteúdo e autorização.
- `tests/bpm/timeline-card.test.ts` — nova nota Alpha no topo independentemente da posição recebida, sem mutar a entrada.

Validação focada executada: `npx vitest run tests/bpm/rd-station-recovery.test.ts tests/bpm/rd-station-actions.test.ts tests/bpm/timeline-card.test.ts tests/bpm/rd-station-ui.test.ts` → 4 arquivos, 35 testes aprovados. `git diff --check` do escopo passou. Não houve acesso ou alteração de banco neste bugfix.

A base local era b79a1382, mas o remoto staging recebeu alterações posteriores. DevOps confirmou que os cinco arquivos de código/testes deste escopo não mudaram entre b79a1382 e a base atual ab018025; a release isolada partirá de ab018025 para preservar os 34 arquivos alterados por terceiros nesse intervalo. Não copiar o checkout inteiro nem restaurar o editor de anotação antigo.

Gates no worktree isolado atualizado: `npm run lint` passou sem erros (1.193 avisos legados); `npm run typecheck` passou; `npm test` passou com 678 arquivos, 5.151 testes aprovados, 4 skipped e 1 todo. O `npm run build` padrão foi executado e falhou por esgotamento do heap V8 limitado a 3.072 MB, sem diagnóstico de erro do código. A compilação equivalente Next.js/webpack completou com 6.144 MB, usando Prisma e bundle do player já gerados pelo pipeline, sem alterar package.json/configuração/dependências. Não se declara a tentativa padrão como aprovada. O build padrão remoto da Vercel será acompanhado até READY antes de concluir a entrega.

Logs DevOps: `/tmp/crm-notas-20261021-lint.log`, `/tmp/crm-notas-20261021-typecheck.log`, `/tmp/crm-notas-20261021-tests.log`, `/tmp/crm-notas-20261021-build.log` (OOM) e `/tmp/crm-notas-20261021-build-retry.log` (sucesso). Nenhuma dependência/lockfile mudou, diff do escopo sem espaços inválidos e inspeção de segredos aprovada. Não houve migration ou escrita em banco.

## QA Results

**PASS / APPROVED na revisão focada de código.** QA independente conferiu o comparador DESC, data exibida/corrigida, inválidos ao final, desempate, imutabilidade e consumo pela UI após recarregar/corrigir. Os feeds Alpha e unificado permanecem decrescentes; os testes e os cinco arquivos do snapshot conferem com a revisão. A aprovação da publicação remota depende de READY/smoke de staging; não há autorização de produção.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-21 | 0.1 | Preparação do bugfix e checklist de draft | River (@sm) |
| 2026-10-21 | 0.2 | Ordenação RD corrigida, regressões Alpha/RD aprovadas e QA PASS; resultados reais de build e memória documentados | Codex |
