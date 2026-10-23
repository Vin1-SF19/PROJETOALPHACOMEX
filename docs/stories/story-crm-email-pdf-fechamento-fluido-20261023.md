# Story — E-mail completo na ficha PDF e fechamento fluido do card

## Status

Ready for Review — QA LOCAL APPROVED / GO para staging. Typecheck e lint globais, 52 arquivos afetados/417 testes e build literal aprovados. **LIVE do Root após publicar permanece pendente**; não se declara validação remota concluída. Produção não autorizada.

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["PDF real e regressões sintéticas", "integração React com promessas pendentes", "npm run lint", "npm run typecheck", "npm test no escopo afetado", "npm run build", "validação LIVE no staging"]

## Story e contexto

Como usuário do CRM, quero ler o e-mail inteiro na ficha PDF e fechar a visualização de um card imediatamente, para consultar o documento com precisão e navegar sem aguardar carregamentos de follow-up.

Fonte: pedido direto para corrigir o e-mail cortado e o erro que exige aguardar o último follow-up ao fechar o card, inclusive quando não há registros. O usuário quer o fechamento imediato da interface e processamento no backend. Base inicial: staging `8378358f`, em worktree isolado `crm-ficha-email-fechar-fluido-20261023`.

O corte do e-mail é preexistente e foi comprovado com o template anterior à correção de salvamento; prova privada `qa/baseline-long-email-proof.json` em `/var/tmp/alpha-crm-ficha-salvar-erro-20261023/`. O caso original tem 72 caracteres. Não copiar o e-mail ou outros dados reais para a story, fixtures ou logs versionados. O reconhecimento confirmou o acoplamento indevido entre fechar e carregar/validar follow-up; a implementação separa essas operações e preserva o processamento de saves/drafts. O defeito do PDF foi reproduzido em testes sintéticos antes do ajuste; os resultados estão registrados abaixo.

## Acceptance Criteria

1. A ficha PDF preserva todos os caracteres do e-mail em casos curtos, no caso de 72 caracteres e nos comprimentos válidos aceitos pelo contrato atual até seu limite de 320. O conteúdo não é cortado, truncado, sobreposto ou alterado com hífen inexistente. Quebras visuais de linha mantêm o endereço original ao recompor os trechos, sem inventar caracteres.
2. A correção usa o `FichaAlphaPDF` compartilhado, preservando A4, conteúdo e paginação dos consumidores Pré-Análise, Bibble e CRM. Não criar outro template ou reduzir a ficha inteira para contornar um campo. Testes usam apenas empresas e endereços sintéticos e verificam renderização/extração reais do PDF, além da regressão pertinente dos consumidores.
3. Fechar o card pelo X, Escape ou `onOpenChange` atualiza imediatamente o estado de abertura e permite dispensar a visualização sem esperar uma promise de leitura do último follow-up. Follow-up carregando, em erro, ausente ou incompleto não bloqueia o ato de fechar nem apresenta a exigência de aguardar o carregamento. A troca expressa de contexto de card preserva os rascunhos; os guards de navegação global/unload permanecem, distinguindo dispensar a visualização, sair da página e movimentar etapa.
4. As regras de follow-up necessárias a movimentos comerciais de etapa continuam válidas nos caminhos de avanço/servidor. Corrigir o fechamento não remove requisitos do processo comercial, permissões, validação de dados ou proteção contra movimento indevido.
5. Edições e salvamentos pendentes não são descartados silenciosamente para conseguir fechar. A interface fecha sem aguardar a persistência; o provider global existente de `CardSaveContext`/`PainelCardState` mantém fila, draft e recovery após desmontar o card, drenando apenas autosaves elegíveis em segundo plano com tratamento de rejeição. Formulários de salvamento manual preservam rascunho reabrível; fechar não os submete automaticamente nem agenda/envia convites. Falha real de save gera feedback honesto sem manter a visualização aberta; ausência de edição ou erro de leitura de follow-up não gera toast falso de falha de salvamento. Erro/rascunho não é atribuído a outro card ao navegar.
6. Testes meaningful verificam fechamento antes de resolver promises de follow-up/save, estados sem registros/erro, sucesso e falha de persistência e os guards de movimento preservados. Conferir os pontos reais de abertura/fechamento, sem introduzir comportamento especial só para testes ou mocks que escondam a integração.
7. Executar e registrar lint, typecheck, testes afetados e build conforme regras do projeto; atualizar checklist e File List. Após publicar em staging, Root deve confirmar LIVE o e-mail de 72 caracteres completo no PDF e o fechamento do card enquanto a leitura de follow-up está realmente atrasada. Testes locais não equivalem a essa evidência remota.
8. Publicação automática limitada ao staging, pelo DevOps após gates/revisão. Sem alteração de schema, scripts/mutações diretas de banco remoto, env, backfill ou produção; o ensaio LIVE usa apenas o fluxo normal controlado do aplicativo. Preservar entregas concorrentes e a correção de salvar a ficha já publicada.

## Tasks / Subtasks

- [x] Registrar requisitos, precedente do PDF e limites antes da implementação (AC 1–8).
- [x] Confirmar mapa de integração frontend e alcance mínimo do salvamento/draft em segundo plano; aprovar a story (AC 3–6).
- [x] Reproduzir corte com dados sintéticos e corrigir renderização no PDF compartilhado (AC 1–2).
- [x] Separar fechamento de visualização das validações/carregamentos de follow-up, preservando guards de movimento e saves/drafts (AC 3–5).
- [x] Escrever/executar regressões de PDF real e integração React com promises pendentes (AC 1–6).
- [x] Executar gates/revisão e atualizar checklist, File List e limitações reais (AC 7–8).
- [ ] Publicar no staging e confirmar a versão servida (AC 8).
- [ ] Root validar LIVE PDF com e-mail72 integral e X/Escape fechando em até 100 ms com a leitura real de follow-up atrasada, sem conteúdo fake ou código especial no app, preservando valores de teste (AC 7).

## Dev Notes

- `src/components/GerarFicha.tsx` contém o template `FichaAlphaPDF` reutilizado por Pré-Análise/Bibble/CRM. A entrega anterior adotou a variante `pre-analise` para a ficha automática, sem a segunda página `viabilidade`; não desfazer essa paridade ao corrigir o campo de e-mail. [Source: docs/architecture/crm-ficha-viabilidade-automatica-20261023.md#paridade-com-pré-análise]
- Blueprint PDF aprovado: alteração focal em `src/components/GerarFicha.tsx`, campo E-MAIL, e regressão real nova em `tests/pre-analise/ficha-email-longo.test.ts`. A solução confirmada fica somente no campo E-MAIL: quebra explícita em trechos de 16 caracteres, Helvetica Bold original de 10pt, sem hifenização automática e preservando caixa. Não adiciona fonte nem caracteres de largura zero e não reduz o restante do template.
- Blueprint frontend aprovado: o provider global `PainelCardState`/`CardSaveContext` já preserva fila/draft/recovery depois que o modal é desmontado. Adicionar drenagem dos autosaves elegíveis em segundo plano com `catch`; retirar o AlertDialog local do X e o guard duplicado de follow-up no ato de fechar. Rascunhos de salvamento manual são preservados sem autoexecutar `SalvarDadosEmpresa`/agendamento. O host de card vinculado/troca expressa mantém o contexto do rascunho. Guards de navegação global, unload e transição comercial permanecem. Root aprovou esse alcance mínimo antes da implementação; os caminhos definitivos de edição serão registrados na File List real.
- Caminhos frontend planejados/confirmados pelo reconhecimento: `src/app/PainelAlpha/AlphaCRM/CardModal/{CardFullViewModal,CardSaveContext,CardModalHost}.tsx`; helper morto específico de fechamento em `src/lib/bpm/card-modal-ui.ts` e expectativa antiga em `tests/bpm/card-modal-ui.test.ts`. Regressão nova `tests/bpm/card-close-fluid-react.test.tsx`, com ajustes de expectativas em `tests/bpm/autosave-recovery-react.test.ts` e `tests/bpm/empresa-cadastro-editor-react.test.ts`. São alvos planejados, não arquivos já alterados neste checkpoint; não modificar handlers globais de navegação/unload ou backend nesta frente.
- As stories `story-crm-ficha-viabilidade-automatica-20261023.md` e `story-crm-ficha-erro-salvar-complemento-20261023.md` são o contexto cruzado: manter PDF privado, um anexo atual, CAS/lease e complemento no modal compartilhado. O bug do lease ao salvar já foi corrigido na base e não integra esta nova alteração.
- `accumulated-context.md`, `.Codex/commands/AIOX/agents/sm.md` e `.aiox/gotchas.json` não estão disponíveis; usar contexto das stories/contrato anteriores e fallback `.aiox-core/development/agents/sm.md`. Não inventar uma nova biblioteca, plataforma de autosave ou persistência paralela sem reconhecimento e decisão do Root.

[AUTO-DECISION] Remover toda validação de follow-up para fechar? → Retirar o acoplamento ao ato de dispensar a visualização, mantendo as validações nos movimentos comerciais; isso deriva do pedido de fechar imediatamente e preserva o fluxo existente.

## Testing

PDF: casos 100% sintéticos de e-mail curto/longo72 e limites válidos do contrato; renderização e extração reais devem preservar o endereço completo e verificar A4/conteúdo/paginação nos consumidores compartilhados. Não versionar o endereço original da auditoria.

UI: testar X/Escape/`onOpenChange`/navegação com promise de follow-up não resolvida, falha/ausência/incompletude, além de save pendente que termina com sucesso ou erro depois de fechar. Confirmar que a UI já fechou antes de resolver a promise, que o rascunho pode ser recuperado e que outro card não recebe estado/erro indevido. Guards de movimento comercial continuam testados. Não relaxar assertions/timeouts para esconder regressão.

Gates: `npm run lint`, `npm run typecheck`, `npm test` com os testes afetados e `npm run build`; revisão independente proporcional. Registrar separadamente a validação local e os ensaios LIVE após deploy. Nenhum banco remoto ou ambiente é alterado pelos testes locais.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** Frontend/Integration, complexidade média pelo ciclo de vida de save/fechamento e PDF compartilhado.
- **Specialized Agents:** `@dev` executor/pre-commit; frontend/PDF segue mapa e padrões existentes; `@qa` regressões/revisão; `@architect` somente se o mapa exigir decisão estrutural; DevOps publica staging.
- **Quality Gates:** Pre-Commit com testes, diff e gates; Pre-PR somente se houver PR; produção fora do escopo. Se CodeRabbit estiver ausente, registrar fallback permitido em `core-config.yaml` e revisão manual sem alegar execução.
- **Self-Healing:** `@dev` light até 2 iterações/15min para CRITICAL, HIGH documentado; `@qa` full até 3 iterações/30min para CRITICAL/HIGH; DevOps check/report only.
- **Focus Areas:** integridade dos caracteres/PDF, reuso e paginação, fechamento sem espera, guard de movimento preservado, save/draft pós-unmount, isolamento de card, erro honesto e acessibilidade de fechar.

## Story Draft Checklist

**READY** — validação YOLO de `.aiox-core/product/checklists/story-draft-checklist.md`: objetivo/contexto PASS; orientação técnica PASS (blueprints e alcance mínimo aprovados); referências PASS; autossuficiência PASS; testes PASS; CodeRabbit PASS. Não há lacuna de produto bloqueante; investigação da técnica de renderização não altera os critérios de integridade definidos. Nenhum resultado de implementação/gate/LIVE é presumido.

## Dev Agent Record / File List

### Completion Notes

- PDF estável: três caminhos próprios (`GerarFicha.tsx`, seis casos novos de PDF e um ajuste de assert SQLite autorizado para comparar somente quebras/whitespace, sem mascarar hífens). Baseline RED reproduziu cinco falhas/um sucesso; focal final de quatro arquivos/24 testes PASS em 6,02 s. Evidência privada: `/var/tmp/alpha-crm-ficha-email-fechar-fluido-20261023/pdf/handoff.json` e provas ali referidas.
- A prova privada do e-mail original de 72 caracteres passou por igualdade estrita na extração PDF.js e na coluna de texto XML Ghostscript: 72/72, fonte10pt e uma página A4. Os testes versionados usam somente dados sintéticos; o extremo sintético com caracteres largos e 320 posições conserva todo o conteúdo em duas páginas A4, com geometria/legibilidade sem overflow. Esse fluxo para segunda página em conteúdo extremo não é truncamento nem redesenho do modelo.
- Frontend estável: sete caminhos próprios. Fechar atualiza o estado sincronamente sem aguardar follow-up ou save; o provider persistente drena autosave com catch/recovery, conserva rascunho manual sem chamar seu submit e não lança erro falso por simples leitura pendente. Host e troca expressa conferem owner/card para que resposta tardia não feche outro card; rejeição de leitura após fechar é tratada. Guards gerais de navegação/unload e transições comerciais continuam.
- Frontend focado: sete suites/71 testes PASS, incluindo a suite nova com 11 casos de fechar pendente, erro, X/Escape/onOpenChange, save lento/falho e rascunho manual/reabertura. Resultados de PDF/UI são grupos focados separados, não uma soma de testes únicos de toda a aplicação.
- A tentativa de typecheck do worker com heap4GiB terminou por OOM e **não é PASS**. A execução oficial de QA com8GiB passou: typecheck global54,89s, lint global49,76s (zero erros), **52 arquivos afetados/417 testes PASS25,52s**, build literal `npm run build` PASS115,96s. Não se apresenta a rodada afetada como execução da suíte global inteira. Nenhum timeout/assert de comportamento foi relaxado. Os 3.085 hashes de fonte permaneceram intactos e a configuração alterada automaticamente pelo Next foi restaurada. QA LOCAL APPROVED, gate `docs/qa/gates/crm-email-pdf-fechamento-fluido-20261023.yml`, evidência privada `qa/qa-local-final.json` no diretório desta entrega.
- **LIVE pós-publicação permanece obrigatório e pendente:** Root deve conferir o PDF do e-mail original72 completo por extração estrita e fechar por X/Escape em até100ms durante atraso da leitura real, sem substituir o conteúdo por fake ou inserir caminhos de teste no aplicativo. Testes locais e provas privadas de render não equivalem a essa validação remota. Sem gravação direta de banco remoto, alteração de schema/env ou publicação em produção.

### File List

- `.bibble/memory/codebase-map.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/journal.md`
- `docs/qa/gates/crm-email-pdf-fechamento-fluido-20261023.yml`
- `docs/stories/story-crm-email-pdf-fechamento-fluido-20261023.md`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardModalHost.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext.tsx`
- `src/components/GerarFicha.tsx`
- `src/lib/bpm/card-modal-ui.ts`
- `tests/bpm/card-close-fluid-react.test.tsx`
- `tests/bpm/card-modal-ui.test.ts`
- `tests/bpm/empresa-cadastro-editor-react.test.ts`
- `tests/bpm/ficha-viabilidade-automatica-sqlite.test.ts`
- `tests/pre-analise/ficha-email-longo.test.ts`

## QA Results

### Revisão Quinn — 2026-10-23 — APPROVED local para staging

- **PDF:** template compartilhado `FichaAlphaPDF`, somente o campo E-MAIL recebe linhas explícitas curtas, sem hifenização automática ou transformação de caixa. Teste real cobre e-mail curto com pontuação,72,254 e320 caracteres com glifos largos; recomposição ignora apenas whitespace visual, preservando todos os caracteres e a caixa. Nenhum hífen artificial, reticência ou caractere invisível é tolerado. Fonte10 legível, bounds de coluna e A4 conferidos;72 permanece uma página,320 amplo usa duas, perguntas/conteúdo e consumidores Pré-Análise/CRM/Bibble preservados. Prova independente Ghostscript XML por coluna confirma o caso privado72 sem expor PII.
- **Fechamento:** testes usam Radix Sheet, CardFullViewModal, host e provider reais. X, Escape, clique externo e onOpenChange fecham antes de resolver follow-up/save; erro/ausência/incompletude não bloqueiam nem geram erro falso de salvamento. Autosave continua no provider após unmount com fila/retry; rascunho manual reabre sem submeter cadastro/agenda. Troca expressa anexada preserva o rascunho e não entra no guard geral; respostas antigas não fecham o próximo card. Guards de página/unload e de movimento comercial permanecem e foram incluídos nas regressões.
- **Findings resolvidos durante implementação:** rejeições tardias de leituras sem catch; troca direta de card anexado com draft ainda acoplada a requestLeave. Corrigidos minimamente e cobertos por integração, sem ampliar backend ou fluxo manual.
- **Gates nesta árvore:** `npm run typecheck` global8GB PASS; `npm run lint` global PASS (0erros/1183warnings do repositório); `npm test -- --coverage.enabled=false --maxWorkers=1` no escopo afetado: **52 suites/417 testes PASS, zero falhas**; `npm run build` literal webpack PASS em **115.96s**. Não foi repetida a suíte inteira não relacionada; escopo proporcional explicitamente autorizado. O npx tsc4GB anterior do worker terminou OOM134, preservado como tentativa de harness e substituído pelo comando oficial PASS, sem erro TS remanescente.
- **Revisão final:** Forge/Probe/Anubis/Lens/Sage APPROVED, sem P0/P1 pendentes. 3085 hashes de src/testes/schema/config idênticos antes/depois dos gates após restauração guardada dos includes gerados pelo Next. Sem alteração de schema/env remoto/produção. CodeRabbit/WSL/CLI indisponíveis; fallback manual configurado executado. Build tem somente os avisos conhecidos de require dinâmico em bibble/pdfjs-polyfill.ts, fora do diff.
- **Gate e evidência:** `docs/qa/gates/crm-email-pdf-fechamento-fluido-20261023.yml`; privado `/var/tmp/alpha-crm-ficha-email-fechar-fluido-20261023/qa/qa-local-final.json`.
- **Aceite remoto ainda pendente:** publicar somente no staging, confirmar READY/SHA/alias e Root validar PDF72 regenerado com match estrito (whitespace apenas) e fechamento do card com leitura real de follow-up atrasada/erro tratado. Não presumir LIVE a partir de testes locais. QA não fez mutação remota, commit ou push.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-23 | 1 | Rascunho dos dois ajustes; fechamento sem espera, integridade do e-mail e validação LIVE definida. | River / SM |
| 2026-10-23 | 2 | Blueprints e alcance mínimo aprovados; autosave background/manual draft/guards explícitos; checklist READY, Approved. | River / SM |
| 2026-10-23 | 3 | PDF e fechamento implementados; focais/TC QA confirmados; File List real e gates finais/LIVE pendentes. | River / SM |
| 2026-10-23 | 4 | QA LOCAL APPROVED, 417 testes/tipos/lint/build PASS, File List15; publicação/LIVE Root continuam pendentes. | River / SM |
