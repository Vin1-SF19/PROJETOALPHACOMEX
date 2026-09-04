# RM-2026-19631A — Motor de Regras e Validações

## Status

Ready for Review — Fases 1 e 2 implementadas (núcleo determinístico + persistência/CRUD/UI admin/integração com movimentação de card). Motor de Automações, SLA e Financeiro reutilizando este engine ficam para objetivos futuros dedicados.

## Fase 2 — Persistência, CRUD administrativo, UI e integração (autorizada e executada em 2026-09-04)

**Autorização (equivalente a VAULT_APPROVED):** operador humano (via Claude Code, seguindo `.bibble/tasks/db-backup.md`) autorizou explicitamente a migration aditiva abaixo após revisar o plano já produzido pelo agente Vault na tentativa anterior (BLOCKED_BY_VAULT, fase somente-leitura). Backup de produção gerado e verificado antes de aplicar — ver seção "Migration" abaixo.

### Modelo de dados (aditivo)

- `BpmRegra`: metadados/roteamento (nome, descrição, ativa, prioridade, pipelineId opcional, etapasJson opcional, versaoAtualNum, criadoPorId).
- `BpmRegraVersao`: condição e resultado versionados (`condicaoJson`/`resultadoJson`, serialização de `GrupoCondicao`/`ResultadoRegra` da Fase 1), únicos por `(regraId, versao)`.
- Relação inversa em `BpmPipeline.regras` e em `usuarios.bpmRegrasCriadas`/`bpmRegraVersoesCriadas`.

### Migration

- `prisma/migrations/20260904133000_bpm_regras_persistencia/migration.sql` — estritamente aditiva (`CREATE TABLE`/`CREATE INDEX`, sem `DROP`/`ALTER` destrutivo).
- Backup pré-mudança: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-04T13-18-54-452Z.sql` (270 tabelas, 61.153 linhas, sha256 `8d2f4ef8...`), verificado com `scripts/verify-turso-backup.mjs` (`verified: true`).
- Aplicada em produção (Turso) via `scripts/apply-turso-migration.mjs` — 7 statements.
- Smoke test transacional real (criar regra+versão, ler, desativar, apagar) validado após `prisma generate`.

### Server Actions (`src/actions/bpm/Regras.ts`)

`ListarWorkspaceRegrasBpm`, `CriarRegraBpm`, `AtualizarRegraBpm` (cria nova versão automaticamente quando condição/resultado mudam), `AlternarAtivacaoRegraBpm`, `ExcluirRegraBpm`. Gating: `exigirAcessoConfigPipeline(userId, "configurarEtapas")`, igual ao padrão de `Automacoes.ts`.

### UI administrativa

`/PainelAlpha/AlphaCRM/admin/regras` (`RegrasWorkspace.tsx` + `RegraFormDialog.tsx`): lista, cria, edita, ativa/desativa e exclui regras sem editar código. O construtor de condição cobre grupos AND/OR de um nível (lista de condições simples: fonte/campo/operador/valor); para árvores de condição aninhadas e para os resultados `calculo`/`formula_segura`/`resultado_condicional`/`tabela_decisao`, o formulário oferece um editor JSON avançado validado pelo mesmo `regraBpmSchema` da Fase 1 — cobre o `resultado_regra` completo sem exigir um construtor visual para cada operador de fórmula/tabela, adiado para uma iteração de UX dedicada se necessário.

### Integração — bloqueio de movimentação

`src/lib/bpm/regras/guarda-movimento.ts` (`obterErroRegrasParaMovimento`) chamado em `executarMovimentoComRequisitos` (`src/actions/bpm/Cards.ts`), no pré-check e de novo dentro da transação (mesmo padrão CAS das demais guardas nativas). Carrega regras ativas escopadas ao pipeline/etapa (`src/lib/bpm/regras/contexto.ts`), monta o `ContextoAvaliacao` a partir do card + `Cliente` relacionado e reaplica o avaliador puro da Fase 1 (`avaliarRegras`).

**Fail-open deliberado:** qualquer erro de avaliação (regra malformada, exceção inesperada) é logado e NÃO bloqueia a movimentação — evita que uma regra mal configurada trave o CRM inteiro em produção. Só uma regra que avalia com sucesso e retorna `permitida: false` bloqueia.

### Gates da Fase 2

- `npx tsc --noEmit`: sem diagnósticos nos arquivos da fase (baseline global pré-existente inalterado).
- `npx eslint` nos arquivos da fase: sem diagnósticos.
- `npx vitest run tests/bpm/`: 561 aprovados, 17 falhas — mesmas 6 suítes/17 casos da baseline documentada em fases anteriores (não relacionadas a esta entrega). Testes novos: `tests/bpm/regras-guarda-movimento.test.ts` (4/4) e `tests/bpm/regras-actions.test.ts` (7/7), ambos aprovados.
- `npm run build`: exit 0 após corrigir a causa raiz do travamento (ver nota abaixo).

### Nota separada — causa raiz do travamento de build corrigida

Durante o trabalho em RM-2026-6BEA04 e RM-2026-BB92C7 (mesma sessão), identificou-se que `next build` ficava sem progresso sob pressão de memória do host (swap cheio) e o próprio agente autointerrompia o processo por volta de 150–240s, bem abaixo do timeout real de 10 min da tool. Correção aplicada em `package.json`: `"build": "prisma generate && npm run build:player && NODE_OPTIONS=--max-old-space-size=8192 next build"`. Build confirmado com exit 0 em múltiplas execuções após a correção.

## File List (Fase 2)

- `prisma/schema.prisma`
- `prisma/migrations/20260904133000_bpm_regras_persistencia/migration.sql`
- `src/lib/bpm/regras/persistencia-schemas.ts`
- `src/lib/bpm/regras/contexto.ts`
- `src/lib/bpm/regras/guarda-movimento.ts`
- `src/actions/bpm/Regras.ts`
- `src/actions/bpm/Cards.ts`
- `src/components/bpm/regras/types.ts`
- `src/components/bpm/regras/RegraFormDialog.tsx`
- `src/components/bpm/regras/RegrasWorkspace.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/regras/page.tsx`
- `tests/bpm/regras-guarda-movimento.test.ts`
- `tests/bpm/regras-actions.test.ts`
- `package.json`
- `.bibble/memory/architecture.md`

### Achado e correção durante a revisão (Fases 9-11)

`ContextoAvaliacao.camposDinamicos` não estava populado em `montarContextoAvaliacaoDoCard` — regras usando `fonte: "campo_dinamico"` com qualquer operador além de `vazio` lançavam `ErroRegra` (fail-closed no avaliador da Fase 1), capturada pelo fail-open do guarda de movimentação e, portanto, nunca bloqueavam de fato. Corrigido consultando `BpmCardCampoValor` por `cardId` em `contexto.ts`; teste de regressão adicionado.

## Objetivo da Fase 1

Entregar o núcleo determinístico, versionado e independente de banco/UI do Rules Engine, com executor CLI e falha segura para configurações inválidas.

## Critérios de aceite

- [x] Regra versionada e árvore Zod com grupos `AND`/`OR` aninhados.
- [x] Quatorze operadores implementados e testados.
- [x] Referências estruturadas com allowlist por card, cliente, processo, contratação, entidades relacionadas e campo dinâmico por CUID.
- [x] Sem `eval`, `new Function`, JavaScript/SQL arbitrário ou resolução dinâmica irrestrita.
- [x] Resultados tipados para obrigatoriedade, bloqueio, mensagem, cálculo, fórmula, tabela de decisão e resultado condicional.
- [x] Coerção explícita para texto, número, booleano, lista, nulo e data.
- [x] Data civil `YYYY-MM-DD` interpretada como meia-noite UTC; datetime só é aceita com `Z` ou offset explícito.
- [x] Campo inexistente só satisfaz `vazio`; nos demais operadores gera erro fail-closed.
- [x] Limites de profundidade, condições, listas, fórmula e tabela de decisão.
- [x] CLI recebe fixture por arquivo interno ao projeto ou stdin e não depende de banco/UI.
- [x] Testes cobrem operadores, grupos, tipos, vazios, datas, resultados e limites.
- [x] Nenhuma alteração de schema ou migration.

## Autoajuste formal vindo da Fase 0

As lacunas de `BpmRegra`, CRUD administrativo, workspace `/admin/regras`, integração com `executarMovimentoComRequisitos` e migração gradual das guardas nativas passam a ser requisitos obrigatórios das fases específicas de schema/backend/frontend/integração. Não foram antecipadas nesta fase porque o seu contrato exige núcleo puro sem banco e proíbe alteração de schema/migration.

## Entregabilidade

Artefato: pacote `src/lib/bpm/regras` e harness `scripts/bpm-regras-cli.mjs`.

Consumidor nesta fase: desenvolvimento, QA e futuras camadas de Server Actions/execução BPM.

Caminho validado: `npm run bpm:regras -- --stdin` ou `npm run bpm:regras -- caminho/interno/fixture.json` → validação Zod → avaliação determinística → JSON com regra, versão, resultado, mensagens e erros.

## Checklist técnico

- [x] Blueprint Scout da Fase 0 consultado.
- [x] Constitution, regras Echo e memória do projeto consultadas.
- [x] ESLint direcionado executado.
- [x] Typecheck executado e recorte da fase verificado.
- [x] Testes direcionados executados.
- [x] Gates globais documentados no fechamento da fase.

## Gates da Fase 1

- `npx vitest run tests/bpm/regras-engine.test.ts`: 25/25 aprovados.
- ESLint direcionado (`src/lib/bpm/regras`, CLI e teste): exit 0, sem diagnósticos.
- CLI real com fixture: exit 0 e JSON determinístico esperado.
- `git diff --check` direcionado: exit 0.
- `npm run typecheck`: exit 2 por diagnósticos externos em Exclusão Fiscal, Check-in, Gerador de Documentos, Calendar e Radar; nenhum diagnóstico na File List desta fase.
- `npm run lint`: exit 1, baseline global de 2.485 erros e 1.258 warnings; recorte da fase limpo.
- `npm test`: 2.202 aprovações e 40 falhas. Uma falha transitória era do teste CLI desta fase e foi corrigida; o recorte foi reexecutado com 25/25. As outras 39 são basais/externas já documentadas ou de módulos concorrentes.
- `npm run build`: Prisma Client e player gerados; `next build` permaneceu sem saída na etapa `Creating an optimized production build` por mais de 150 segundos e foi interrompido. Sucesso não presumido.

DELIVERY_READY: raiz do projeto → `npm run bpm:regras -- tests/fixtures/bpm-regra-bloqueio.json` (ou `--stdin`) → JSON com regra, versão, resultado, mensagens e erros.

## File List

- `package.json`
- `scripts/bpm-regras-cli.mjs`
- `src/lib/bpm/regras/types.ts`
- `src/lib/bpm/regras/schemas.ts`
- `src/lib/bpm/regras/avaliador.ts`
- `src/lib/bpm/regras/index.ts`
- `tests/bpm/regras-engine.test.ts`
- `tests/fixtures/bpm-regra-bloqueio.json`
- `docs/stories/story-rm-2026-19631a-motor-regras-validacoes.md`
- `.bibble/memory/architecture.md`
- `.bibble/memory/decisions.md`
