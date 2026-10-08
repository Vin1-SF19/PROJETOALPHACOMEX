# Story: Histórico compartilhado do Alpha Catcher com autoria

## Status

Ready for Review.

executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["testes focais de autorização", "lint", "typecheck", "test", "build"]

## Story

Como usuário com acesso ao Alpha Catcher, quero consultar os históricos de todos os usuários do módulo e ver no card o @ de quem realizou a consulta/importação, para acompanhar os lotes compartilhados e identificar sua autoria.

## Contexto

Requisito recebido do usuário pelo agente principal: históricos Alpha Catcher compartilhados entre todos com acesso ao módulo; card mostra @ do autor da consulta/importação. Esta story altera a política anterior de leitura por dono, mantendo a política de escrita e jobs por dono.

Coerência com `docs/stories/story-alpha-catcher.md` (histórico e modal) e `docs/stories/story-alpha-catcher-historico-json.md` (JSON/recuperação). `accumulated-context.md` e `.aiox/gotchas.json` não encontrados no carregamento anterior; usar essas stories como contexto acumulado. Não assumir migration/backfill. Nenhum requisito de compartilhamento de outros módulos foi solicitado.

## Acceptance Criteria

1. A listagem de histórico do Alpha Catcher retorna importações de todos os autores para usuários autenticados autorizados pelo gate existente `acessoCatcher`, mantendo paginação, ordenação e atualizações. Inclui Logcomex, JSON e lotes recuperados.
2. Usuário autorizado pode abrir o detalhe/modal de lote criado por outro usuário e acessar sua lista persistida com filtros, ordenação e exportação existentes. A leitura não modifica autoria, registros, contadores, datas ou estados.
3. Usuário sem sessão recebe 401 e usuário sem acesso ao módulo recebe 403 na listagem e no detalhe, inclusive por ID direto. O compartilhamento não libera leitura de registros Auditoria de outras funcionalidades.
4. Cada card exibe o autor no formato @identificador. A autoria é resolvida no servidor a partir de `Auditoria.userId` e da identidade existente do usuário, inclusive para históricos legados sem autor no JSON. Não confiar em autor enviado pelo cliente nem expor o perfil completo do usuário.
5. Quando não existir username/handle persistido, usar uma identidade disponível do usuário com regra determinística documentada e testada; não presumir novo campo. Autor indisponível deve receber indicação explícita e estável, sem atribuir ao usuário leitor. Nenhuma escrita retroativa é necessária para exibir autoria legada.
6. Criação de importações mantém autor autenticado. Consultas/processamento associados ao lote, resultado, estado, cancelamento, retomada e controle de jobs permanecem restritos ao dono nas operações já existentes. A leitura compartilhada não autoriza CNPJ, job ou lote de terceiros para escrita.
7. Separar explicitamente contratos de leitura compartilhada e operações do proprietário, inclusive nos helpers internos utilizados por APIs e CLI. Uma consulta de detalhe compartilhado não altera funções de aceitação de CNPJ, recuperação de origem confiável ou autorização de processamento. Origem JSON/Logcomex, data personalizada e informação desconhecida dos lotes recuperados permanecem compatíveis.
8. Testes demonstram dois usuários autorizados lendo os mesmos históricos, autoria correta em ambos, legado por Auditoria.userId, autorização negada sem permissão e escrita negada para não dono. Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; documentar resultados reais e atualizar checklist/file list antes da conclusão.
9. Card e detalhe usam `registroId` numérico de Auditoria como chave inequívoca; UUID legado só pode resolver detalhe quando houver um único registro correspondente. Dois autores com mesmo UUID não causam mescla de cards, snapshots ou atribuição incorreta; acesso legado ambíguo é recusado.

## Tasks / Subtasks

- [x] Mapear métodos de leitura e ownership de escrita/job, preservando separação (AC 1–3, 6–7).
- [x] Implementar leitura compartilhada e projeção mínima da identidade do autor via contratos de serviço/CLI antes da UI (AC 1–5, 7).
- [x] Integrar rotas autorizadas e card com @autor; manter detalhe/modal e comportamento existente (AC 1–5).
- [x] Cobrir permissões, identidade legada e proteção contra escrita em lote de terceiros (AC 3–8).
- [x] Executar gates, atualizar docs/checklist/file list e registrar evidências (AC 8).

## Dev Notes e referências técnicas

`src/lib/alpha-catcher/access.ts`: autenticação, permissão `alphaCatcher` e exceção administrativa existentes. Não substituir por simples presença de sessão.

`src/lib/alpha-catcher/historico.ts`: leituras atualmente recebem userId e usam Auditoria/snapshots; separar explicitamente leitura compartilhada de owner checks. `src/lib/alpha-catcher/historico-tipos.ts`: contrato retornado e validação cliente; autoria pode ser enriquecimento de leitura sem exigir persistência retroativa.

`src/app/api/alpha-catcher/historico/route.ts` e `[id]/route.ts`: ambas já passam pelo gate; preservar respostas/cache no-store/validação de cursor e UUID. `src/app/PainelAlpha/AlphaCatcher/HistoricoConsultas.tsx`: renderiza card e paginação; incluir autoria mantendo acessibilidade. `ModalHistorico.tsx`: consumirá detalhe compartilhado pela mesma rota.

`prisma/schema.prisma`: identidade existente contém `usuarios.usuario` único e obrigatório; reutilizar este handle. Resolver regra de @identificador com os dados existentes. `Auditoria.userId` é a fonte da autoria para novos e legados.

Arquitetura aprovada pelo agente principal: DTO inclui `autor: { usuario }` e `registroId` numérico de Auditoria. Expor métodos explícitos de leitura compartilhada; manter owner writes intactas. CLI adota `--compartilhado` com verificação de identidade/permissão administrativa ou `alphaCatcher`. Detalhe por UUID legado só resolve quando único. Acrescentar testes de colisão de UUID entre donos, paginação/cards por registroId e CLI sem permissão.

`src/app/api/alpha-catcher/route.ts`, rotas de importações/Logcomex e `src/lib/alpha-catcher/logcomex-job.ts`: proteger ownership nas mutações, evitando reutilizar o helper de leitura compartilhada como autorização de escrita. `scripts/alpha-catcher-history.mts`: documentar contratos/semântica de leitura, sem enfraquecer gate HTTP.

[AUTO-DECISION] Alterar autoria persistida? → Não; enriquecer leitura por Auditoria.userId. [AUTO-DECISION] Compartilhar controle de job? → Não; pedido é leitura de histórico. [AUTO-DECISION] Criar username/tabela? → Não presumir; usar identidade existente e regra documentada. Se implementação descobrir necessidade real de alteração estrutural ou backfill, interromper essa operação e aplicar gate Vault de AGENTS.md antes da execução.

## Testing

Usar fixtures sintéticas em `tests/alpha-catcher/`. Testar listagem paginada de autores distintos, detalhe de outro dono, autenticação/permissão, exclusão de Auditoria alheia ao módulo, autor do legado, usuário inexistente, ausência de campos opcionais e renderização @. Testes de regressão devem provar que não dono continua impedido de registrar resultados, processar CNPJ, alterar estado ou controlar job, enquanto o dono continua operando normalmente. Cobrir JSON/Logcomex/recuperados sem alterar datas, estados ou valores desconhecidos. Testar apenas leitura sem writes/backfill.

## CodeRabbit Integration

**Story Type Analysis:** API; secundários Frontend e Security; complexidade média.

**Specialized Agents:** @dev executor; @architect revisão de fronteira leitura/escrita; @qa autorização/regressão; @ux-expert autoria/acessibilidade; @github-devops somente PR/deploy quando aplicável.

**Quality Gates:** Pre-Commit @dev obrigatório; Pre-PR @github-devops quando houver PR; Pre-Deployment @github-devops quando houver publicação. Foco: gate módulo em toda leitura, ownership em toda escrita/job, autoria confiável, minimização dos dados de identidade e compatibilidade do legado.

**Self-Healing Configuration (Story 6.3.3):** @dev light, 2 iterações/15 minutos, CRITICAL auto-fix e HIGH documentado; @qa full, 3 iterações/30 minutos, CRITICAL/HIGH corrigidos e MEDIUM dívida; @github-devops check, somente relatório. Registrar indisponibilidade da CLI conforme graceful degradation configurada.

## File List inicial

Criado: `docs/stories/story-alpha-catcher-historico-compartilhado.md`.

Previstos, confirmar durante implementação: `src/lib/alpha-catcher/historico.ts`, `src/lib/alpha-catcher/historico-tipos.ts`, `src/app/api/alpha-catcher/historico/route.ts`, `src/app/api/alpha-catcher/historico/[id]/route.ts`, `src/app/PainelAlpha/AlphaCatcher/HistoricoConsultas.tsx`, `scripts/alpha-catcher-history.mts`, testes histórico/API/UI em `tests/alpha-catcher/`, `docs/alpha-catcher.md`. Rotas de processamento/jobs somente se necessário para preservar isolamento das operações. Nenhuma migration/backfill prevista.

## Story Draft Checklist

| Categoria | Resultado | Evidência |
| --- | --- | --- |
| Objetivo/contexto | PASS | Leitura compartilhada e @autor derivados do pedido |
| Orientação técnica | PASS | Gate módulo e fronteira leitura/escrita definidos |
| Referências | PASS | Stories existentes, schema e caminhos reais |
| Autossuficiência | PASS | Legado, fallback autor e ausência de migration definidos |
| Testes | PASS | Dois usuários, negativas de escrita, auth e gates |
| CodeRabbit | PASS | Tipos, agentes, checkpoints e self-healing |

**Readiness: READY**, clareza 9/10. Regra de @identificador sem username deve ser definida/documentada pelo implementador com identidade existente; não bloqueia desenvolvimento. Validação documental, sem execução de testes de aplicação nesta criação da story.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-08 | 1.0 | Story de leitura compartilhada e autoria por usuário | River (@sm) |

## Dev Agent Record / QA Results

Pendente. Nenhum código ou banco alterado nesta elaboração.

### Evidência de implementação

Shared reads separados de buscar/listar/detalhar owner; projeção Auditoria.usuario.usuario + registroId. Schema usuarios.usuario é único obrigatório; string vazia recebe indicação autor indisponível. Sem schema/migration/backfill. CLI real: usuário41 leu registro198, autorLUCCA,2491linhas2375salvas; usuário inexistente2147483647 recusado. 239 testesAlphaCatcherPASS; typecheck exit0. Buildisolado exit0, BUILD_ID e5W4rBAesS_wGhUKvdtLW. Workspace suíteNode22:594arquivos4405testesPASS,duasfalhaspreexistentesBuilder. Candidato:594arquivos4404testesPASS,7skipped,1todo,1arquivoskipped; expectativasBuilder conforme patch anterior somente cópia. Temporários iniciais em /tmp atingiram cota; candidato movido para /var/tmp/painel-alpha-shared-history-candidate e testesTMPDIR no disco principal.

File List final adicional: ModalHistorico.tsx; tests/alpha-catcher/historico-compartilhado.test.ts; tests/alpha-catcher/historico.test.ts; tests/alpha-catcher/historico-api.test.ts; tests/alpha-catcher/historico-modal.test.ts; scripts/activate-alpha-catcher-shared-history-stage.sh; .bibble/memory/codebase-map.md; .bibble/memory/integration-points.md. Logs privados em database-backups/build-candidates/shared-{global,candidate-tests,build,lint-final,runtime}.log; typecheck /tmp/alpha-catcher-shared-typecheck.log. QA segurança APPROVED; revisão final aguardando lint/smoke/manifesto.

Validação final: lint exit0 com 1.192 warnings anteriores e zero erros; tipos/build PASS. HTTP isolado raiz200,historico401,detalhe198401 sem sessão. Ativador bash-nPASS e diff-checkPASS. Candidato no disco principal fora do workspace; temporários de banco .env.local removidos após smoke. Manifesto shared-history-stage-manifest.json valida base20261008-182531-alpha-catcher-json-history, BUILD_ID e5W4rBAesS_wGhUKvdtLW e hashes; ativação depende de sudo interativo pelo usuário. Build/runtime não modificaram o staging ativo.

QA final: feature/candidato APPROVED; workspace global NEEDS_WORK somente por duas falhas anteriores Builder. Não há bloqueador identificado específico para esta feature. Navegador autenticado e publicação aguardam ativação operacional do usuário.

### Ativação confirmada

Usuário executou ativador e publicou20261008-191201-alpha-catcher-shared-history, preservando20261008-182531-alpha-catcher-json-history. Conferidos current e BUILD_ID e5W4rBAesS_wGhUKvdtLW. Smoke real porta3300: raizHTTP200, listagemHTTP401 e detalhe198HTTP401 sem sessão. Exibição autenticada dos cards compartilhados/@autor deve ser conferida pelo usuário ao atualizar a página.
