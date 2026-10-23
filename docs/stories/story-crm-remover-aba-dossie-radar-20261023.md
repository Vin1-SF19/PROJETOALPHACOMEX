# Story — Remover a aba Dossiê RADAR do card CRM

## Status

Ready for Review — QA APPROVED / GO STAGING, quatro gates reais e revisão focal aprovados. Commit/push, deployment READY/alias e smoke remoto ainda pendentes neste checkpoint; produção não autorizada.

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["npm run lint", "npm run typecheck", "npm test", "npm run build", "revisão do diff e das abas do card"]

## Story e fonte

Como usuário do CRM, quero remover a aba Dossiê RADAR da visão do card aberto, para manter somente as funcionalidades que fazem sentido no meu fluxo.

Fonte: pedido explícito de 23/10/2026, após a explicação do funcionamento: “remova, nao faz sentido”. A remoção é da aba apresentada no card. Atendimentos, documentos e o módulo CheckList continuam existentes.

## Acceptance Criteria

1. A visão do card aberto não apresenta a aba “Dossiê RADAR”, nem monta seu painel de conteúdo.
2. O import de `PainelDossieChecklist` é removido de `CardModal/PainelHistorico.tsx`.
3. As demais abas e seus comportamentos permanecem preservados: Tarefas, Procedimento, Jornada, Anexos e Histórico; os conteúdos auxiliares existentes não são alterados.
4. A alteração não modifica o módulo CheckList, os serviços/actions de dossiê, as permissões, os atendimentos, os documentos, os vínculos persistidos nem o schema do banco. Não há migration, backfill ou exclusão de dados.
5. Os gates obrigatórios são executados e registrados. Commit/push e validação de publicação limitam-se à branch e ao ambiente staging; produção depende de pedido explícito posterior.

## Tasks / Subtasks

- [x] Mapear o ponto de integração e delimitar a remoção à interface do card (AC 1–4).
- [x] Remover o trigger, o conteúdo da aba e o import no `PainelHistorico.tsx` (AC 1–2).
- [x] Conferir preservação das demais abas e ausência de modificações de backend/dados (AC 3–4).
- [x] Executar lint, typecheck, testes existentes e build; revisar o diff (AC 5).
- [x] Atualizar checklist e File List com evidências reais, sem presumir resultados (AC 5).
- [ ] Publicar no staging por DevOps e verificar deployment/alias do commit (AC 5).

## Dev Notes

O ponto de montagem atual é `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`: o arquivo importa `PainelDossieChecklist`, registra `TabsTrigger value="dossie"` e monta `TabsContent value="dossie"`. Basta retirar esses três pontos. Não é necessário refatorar a seleção das abas ou criar componentes novos.

O contrato anterior descreve o vínculo como resumo/atalho para o atendimento operacional, independente de Procedimentos BPM. A presente decisão do usuário substitui apenas a apresentação dessa integração no modal. [Source: docs/architecture/checklist-analistas-crm-20261022.md#10-integração-crm-b]

A base de implementação é o staging `65c3b50b5edbeada0e0a322b0234adfa84bed11b`, em worktree isolado. Preservar trabalhos concorrentes e o tema existente. Não executar scripts contra banco nem mudar variáveis remotas.

`accumulated-context.md` não foi localizado na busca local; o contexto relevante está resumido nesta story e no contrato citado. `.Codex/commands/AIOX/agents/sm.md` e `.aiox/gotchas.json` também não estão disponíveis; usado o fallback `.aiox-core/development/agents/sm.md`.

[AUTO-DECISION] Criar epic ou solicitar esclarecimento? → Não criar escopo adicional: story de manutenção derivada integralmente do pedido direto, com nome descritivo conforme as stories CRM existentes.

## Testing

Mudança pequena, reversível e somente de interface: usar os testes existentes e revisão proporcional do ponto de integração, sem adicionar testes que apenas espelhem a remoção de linhas. Confirmar ausência do trigger/conteúdo/import do dossiê e preservação das demais abas. Registrar separadamente qualquer validação de navegador efetivamente executada; revisão de fonte não equivale a E2E autenticado.

Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`, conforme AGENTS e Constitution. Não iniciar dev server para esta remoção. O diff esperado de aplicação fica restrito a `PainelHistorico.tsx`.

## 🤖 CodeRabbit Integration

### Story Type Analysis

Primary Type: Frontend. Secondary Type: Deployment somente staging. Complexity: baixa, remoção localizada.

### Specialized Agent Assignment

`@dev` implementa e faz revisão pré-commit; especialista frontend cobre a integração existente; `@qa` verifica os critérios; `@github-devops` executa a publicação em staging. Não há novo design, decisão de arquitetura ou operação de banco.

### Quality Gate Tasks

- [x] Pre-Commit (`@dev`): gates obrigatórios, diff restrito, preservação das demais abas e ausência de segredos; revisão independente aprovada.
- Pre-PR: não aplicável se a entrega seguir push direto já autorizado para staging.
- Pre-Deployment de produção: não aplicável; produção não está autorizada nesta story.

### Self-Healing Configuration

`@dev`: light, até 2 iterações/15 minutos, correção de CRITICAL e documentação de HIGH. `@qa`: full, até 3 iterações/30 minutos, CRITICAL/HIGH; MEDIUM como dívida. DevOps: check/report only. A indisponibilidade real da CLI deve ser documentada e usar o fallback configurado, sem alegar execução.

### Focus Areas

Remoção completa do ponto visual, navegação das abas preservadas, ausência de consulta do dossiê pelo painel removido e ausência de alterações de dados/serviços.

## Story Draft Checklist

Validação aplicada com `.aiox-core/product/checklists/story-draft-checklist.md`: READY, clareza 10/10.

| Categoria | Resultado | Observação |
| --- | --- | --- |
| Objetivo e contexto | PASS | Pedido direto e escopo de remoção explícitos. |
| Orientação técnica | PASS | Três pontos no mesmo arquivo; backend fora do escopo. |
| Referências | PASS | Contrato anterior contextualizado e fonte atual identificada. |
| Autossuficiência | PASS | Fluxo, limites, dependências e arquivos descritos. |
| Testabilidade | PASS | AC verificáveis e gates definidos. |
| CodeRabbit | PASS | Tipo, agentes, gates, self-healing e foco documentados. |

Sem lacunas impeditivas para implementação. Nenhum resultado de execução ou publicação é presumido.

## Dev Agent Record

### Completion Notes

Implementação conferida: três deleções exatas em `PainelHistorico.tsx` retiram import, trigger e conteúdo da aba. Demais abas e arquivos de runtime preservados; `git diff --check` PASS.

O typecheck identificou erro de inferência preexistente no teste Portal introduzido por `3ceb1c9c`, presente na base `65c3b50b`. Para desbloquear a verificação, o worker explicitou somente o generic `flatMap<[string, string]>` de `Headers` em `tests/portal-api/http-integration.test.ts:49`; não alterou runtime, cenários nem expectativas. `build:player` PASS gerou o bundle ignorado necessário ao typecheck, sem incluir artefato no Git. A correção do teste é manutenção de tipagem necessária ao gate; não amplia a funcionalidade solicitada.

Fechamento local: typecheck PASS/14,14 s; lint PASS/44,82 s (zero erros/1.184 avisos); suíte existente PASS/201,19 s, 760 arquivos/6.310 testes, zero falhas/quatro skipped/um todo; `npm run build` literal Webpack PASS/115,20 s. Tentativa Turbo falhou em 0,96 s pela localização do symlink privado de dependências; fallback padrão passou sem mudar configuração/pacotes. Os dois includes adicionados automaticamente ao tsconfig foram restaurados byte a byte, e hashes de fontes/schema/pacotes/config permaneceram estáveis. CodeRabbit indisponível; revisão manual configurada aplicada. QA/Probe/Lens/Sage aprovaram sem bloqueantes. Prova: `/var/tmp/alpha-crm-remover-dossie-20261023/qa/qa-final-private.json`.

Não houve E2E autenticado nem inspeção visual remota; os testes React existentes de anexos/foco integram a suíte aprovada. Publicação staging e verificação remota ficam pendentes para DevOps. Evidências pós-commit serão privadas, sem commit documental recursivo.

### File List

- `docs/stories/story-crm-remover-aba-dossie-radar-20261023.md` — criada.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx` — três deleções para remover a aba.
- `tests/portal-api/http-integration.test.ts` — generic explícito na transformação de headers, corrigindo inferência preexistente da base.
- `.bibble/memory/codebase-map.md` — registro curto da remoção visual.
- `.bibble/memory/integration-points.md` — decisão de retirar a montagem no card.
- `.bibble/memory/journal.md` — contexto e limites do pedido.

## QA Results

**APPROVED — GO para publicação em staging** (Quinn, 23/10/2026). Produção não autorizada; commit/push, READY/alias e smoke remoto ainda pendentes neste checkpoint.

- Forge real: `npm run typecheck` PASS (14,14 s), `npm run lint` PASS (44,82 s; zero erros/1.184 avisos), `npm test -- --coverage.enabled=false --maxWorkers=2 --no-file-parallelism` PASS (201,19 s; 760 arquivos, 6.310 testes aprovados, zero falhas, quatro skipped/um todo) e `npm run build` literal Webpack PASS (115,20 s). O build usou diretório privado e variáveis fictícias, sem conexão com banco remoto.
- Tentativas preservadas: TC inicial detectou bundle gerado ausente (resolvido pelo `build:player`) e tipagem preexistente do teste HTTP Portal (corrigida com generic de tupla, sem alterar comportamento/asserts). Turbo explícito falhou por symlink privado fora do filesystem root; fallback para o build padrão autorizado, sem mudar configuração/pacotes. O build adicionou apenas dois includes temporários ao tsconfig; restaurados byte a byte ao original, com prova privada.
- Probe/Lens/Sage focal após Forge: três remoções exatas na interface, demais abas/estado inicial/navegação preservados, sem mudança de backend, permissões, dados, schema ou dependências. Testes React existentes de anexos e foco de tarefas/procedimentos integram a suíte aprovada. Hashes de fonte, schema, package/lock e next.config idênticos antes/depois do build. Nenhum teste novo que apenas espelhe a remoção.
- CodeRabbit indisponível (CLI ausente); aplicado fallback de revisão manual configurado. Nenhum E2E autenticado, inspeção visual remota ou validação de dados reais foi executado nesta revisão.
- Evidências privadas: `/var/tmp/alpha-crm-remover-dossie-20261023/qa/qa-final-private.json`, logs dos gates e `tsconfig-autogenerated-restore.json`. Revisão sem bloqueantes; risco baixo, reversível por código.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-23 | 1 | Story restrita à remoção da aba solicitada; checklist de draft READY. | River / SM |
| 2026-10-23 | 2 | Três deleções implementadas; documentada correção de inferência preexistente no teste Portal e geração local do player. Gates finais pendentes. | River / SM |
| 2026-10-23 | 3 | QA APPROVED/GO STAGING; quatro gates e revisão focal PASS, File List final de seis caminhos. READY/alias e smoke remoto pendentes para DevOps. | River / SM |
