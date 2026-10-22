# Story — Comparar ambientes e promover as correções auditadas do CRM

## Status

Done — produção atualizada, READY/SHA/aliases/smoke confirmados; aplicação e testes equivalentes ao staging validado, incluindo ordenação concorrente preservada.

## Executor Assignment

- **Executor:** `@devops` — comparação, integração Git e publicação.
- **Quality gate:** `@qa`, com revisão de compatibilidade por `@architect`.
- **Ferramentas:** Git CLI, lint, typecheck, Vitest, build Next, inspeção do deployment e smoke HTTP somente de leitura.
- **Preparação:** `@sm`, somente este documento; nenhum código, banco, commit ou push pelo Scrum Master.

## Story

**Como** administrador do Painel Alpha, **quero** comparar staging e produção e publicar o que falta em produção, **para** disponibilizar as correções já aprovadas do CRM preservando dados, configuração e histórico dos dois ambientes.

## Fonte, autorização e escopo

Pedido atual: **“compare o staging com o produção, se o produçãp precisar de atualizaçoes, faça os”**. Esse pedido autoriza a promoção após comparação e gates; não requer nova confirmação genérica ou ativação automática de Virtus. A autorização não dispensa consentimento específico exigido para eventual alteração de banco coberta pela política Vault.

A entrega anterior [corrigiu CRM-01–09 e UX complementar](story-alpha-crm-correcoes-auditoria-fluxo-20261021.md#dev-agent-record), com runtime `027881435e8e296c89519604a37790bd554a3b3f` e documentação `f8ef7312`. O [reteste no staging](../reports/validacao-correcoes-crm-2026-10-21.md#percurso-e-persistencia) demonstrou Comercial → Financeiro → entrada do Operacional, origem preservada e reenvios sem duplicatas. Os limites permanecem: não foi validada conclusão financeira de negócio, jornada remota de usuário comum/Smart/parceiro ou recuperação do serviço de voz. Não ampliar essas conclusões na promoção.

Comparação inicial informada pela coordenação, sujeita à reconferência antes do push: `origin/main` em `31151e2a`, com árvore idêntica à base `9d44e969`; `origin/staging` em `f8ef7312`, com delta de 55 arquivos, sem alteração de schema/migrations, dependências, autenticação ou configurações Next/Vercel. Ambos deployments foram observados READY. O candidato deve preservar os dois históricos por merge normal e manter runtime byte a byte igual ao staging aprovado. Se os refs avançarem, reavaliar o delta; nunca force push ou substituir silenciosamente alterações concorrentes.

## Critérios de aceite

1. **Comparação verificável:** registrar refs completos, ancestrais/delta relevante, revisões efetivamente publicadas e resultado da comparação de runtime/configuração. Se produção já contiver a entrega, registrar essa conclusão e evitar deploy redundante.
2. **Integração isolada:** preparar candidato em worktree `crm-comparacao-promocao-20261021`, preservar histórico e mudanças próprias de main, manter runtime equivalente ao staging aprovado e excluir arquivos locais alheios, dumps, credenciais e o PDF solto da raiz. Sem features novas.
3. **Ambientes separados:** verificar configuração efetiva do projeto/branch/alias e evidência sanitizada de bancos distintos. Produção deve receber build próprio com suas variáveis e banco; não promover runtime compilado de staging, copiar dados/env ou imprimir segredos. Ausência de evidência deve permanecer explicitamente pendente.
4. **Gates do candidato:** lint, typecheck, suíte completa e build aprovados, com logs/contagens reais e revisão QA. Evidência anterior pode explicar equivalência, mas não deve ser descrita como execução nova. Nenhum bloqueante CRITICAL pode ficar aberto; registrar indisponibilidade do CodeRabbit e fallback independente quando aplicável.
5. **Publicação confirmada:** exclusivamente DevOps faz commit/push normal para main; confirmar deployment READY, Git SHA associado e alias `https://painel.alpha-comex.com`. Mudança de alias isolada ou HTTP 200 sem conferência da revisão não comprova promoção.
6. **Smoke seguro em produção:** verificar rotas públicas/login, proteção das rotas CRM sem sessão e consulta de saúde/banco somente de leitura. Sessão Admin real pode ser usada apenas para inspeção se disponível. Não criar/mover cards, fabricar aprovações, repetir encaminhamentos nem disparar convites/cobranças em produção para simular o E2E já realizado no staging; registrar o limite de cobertura remota.
7. **Rollback e fechamento:** registrar SHA/deployment anterior e procedimento de rollback somente de código/build com configuração de produção, sem restaurar/copiar banco. Atualizar checklist, File List e evidência sanitizada final. Não marcar Done antes de READY e smoke comprovados; se falhar, corrigir/reverter com rastreabilidade.

## Tasks / Subtasks

- [x] Reconfirmar refs, deployments e diferença entre árvores; registrar decisão de promover ou nenhuma ação necessária (AC 1).
- [x] Integrar candidato preservando históricos na worktree isolada; conferir ausência de artefatos indevidos e equivalência de runtime (AC 2).
- [x] Conferir destino efetivo e separação das configurações/bancos sem revelar valores; preparar rollback (AC 3, 7).
- [x] Executar lint, typecheck, testes e build; revisar diff/segurança de publicação e obter decisão QA (AC 4).
- [x] Commit/push por DevOps; acompanhar READY, SHA e alias efetivo de produção (AC 5).
- [x] Executar smoke somente de leitura e registrar alcance/limites; finalizar checklist, File List e evidência (AC 6, 7).

## Dev Notes / Testing

- Nenhuma implementação de aplicação, dependência nova ou migração é prevista. A interface de envio explícito e os contratos de idempotência já existem no candidato; este trabalho trata de comparação e publicação. [Fonte: story de correções, Dev Agent Record; relatório de validação, Rastreabilidade dos achados.]
- Gates obrigatórios: `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` ou execução equivalente integral documentada. Suíte de banco automatizada deve usar fixture SQLite privada e token vazio, sem conexão remota. Staging anterior: 686 arquivos/5.278 testes aprovados, quatro skipped, um todo; 1.193 avisos de lint preexistentes; build 150,62 s. Esses números são referência histórica, não resultado desta promoção. [Fonte: relatório de validação, Gates e limites; Constitution, Quality First.]
- `/api/broadcast` oferece leitura para smoke de banco; não incluir conteúdo de aviso real no relatório. Rotas protegidas devem continuar exigindo autenticação. Não forjar sessão nem descrever resposta sem sessão como prova de um E2E autenticado. [Fonte: plano de promoção da coordenação; política de segurança do projeto.]
- Variáveis de ambiente e credenciais permanecem privadas. Operações CLI de staging usam `.env.staging.local`; configuração de produção é validada no seu ambiente efetivo. Se a entrega passar a exigir estrutura/migration/backfill ou operação em massa, interromper apenas esse passo e acionar Vault, backup completo verificado até 48 h e confirmação detalhada específica antes de executar. [Fonte: AGENTS.md, Fluxo de ambientes e Database Safety.]
- A coerência entre stories usa os dois documentos anteriores acima. `accumulated-context.md`, `.aiox/gotchas.json` e o caminho legado `.Codex/commands/AIOX/agents/sm.md` não foram encontrados; persona canônica carregada de `.aiox-core/development/agents/sm.md`. Não há guia arquitetural de deploy adicional no diretório `docs/architecture` consultado; usar o fluxo operacional existente sem inventar nova infraestrutura.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** Deployment; secundárias Integration e Security; complexidade média, release existente sem novas funcionalidades.
- **Specialized Agents:** `@devops` executa, `@dev` revisa pré-commit, `@architect` avalia compatibilidade, `@qa` emite parecer independente. Vault somente se surgir trabalho de banco sujeito à política.
- **Quality Gates:** pré-commit com diff e verificações; pré-PR se houver PR; pré-deployment com ambiente, revisão independente, rollback e gates aprovados. CodeRabbit habilitado na configuração; se CLI indisponível, registrar fallback conforme `skip_if_not_installed`.
- **Self-Healing:** DevOps check/report-only, sem correções automáticas de infraestrutura/banco; Dev light até 2 iterações/15 min para CRITICAL; QA full até 3 iterações/30 min CRITICAL/HIGH; qualquer correção exige nova comparação de runtime e gates afetados.
- **Focus Areas:** preservação de main, equivalência staging/candidato, ambiente e banco corretos, segredos ausentes do Git/evidências, autenticação preservada, deploy/SHA/alias verificados, rollback somente de código.

## Validação do draft — River

Checklist `.aiox-core/product/checklists/story-draft-checklist.md` aplicado integralmente em modo YOLO.

| Categoria | Resultado | Evidência no draft |
| --- | --- | --- |
| Objetivo/contexto | PASS | Pedido atual, benefício, dependência já concluída e limites definidos. |
| Orientação técnica | PASS | Refs, worktree, merge preservador, gates, aliases e separação de ambientes. |
| Referências | PASS | Story e relatório anteriores com trechos relevantes resumidos. |
| Autossuficiência | PASS | Escopo, autorização, riscos, concorrência e rollback explícitos. |
| Testes | PASS | Gates e smoke com critérios observáveis e limite de produção. |
| CodeRabbit | PASS | Agentes, gates, self-healing e fallback documentados. |

**READY para execução, clareza 9/10; nenhum bloqueio documental.** Confirmação de bancos, gates do candidato, publicação e smoke são tarefas pendentes, não resultados presumidos.

[AUTO-DECISION] Epic/ClickUp externo e sequência numérica → story local no nome solicitado, seguindo padrão CRM; a missão é uma promoção específica autorizada, sem novo epic nem envio a serviço externo. A story histórica `story-promocao-integral-staging-producao.md` e trabalhos concorrentes permanecem preservados.

## Dev Agent Record

### Execução / evidências

Preflight DevOps em 21/10/2026: `origin/main=31151e2a8f9eec0e55b551841b8a2ff67be612fe`, `origin/staging=f8ef731232920a29a2339f416b402e30d99afb40`, ancestral `9d44e969b540b5e84b61f02f1c863f5a7b087ad2`. A árvore de main é idêntica à do ancestral. Merge normal preparado na worktree isolada, com esses dois pais e sem conflitos; índice antes desta story igual à árvore integral de staging `8a54963e3149e4b1d83bfeb0714f5c0bc89d0f2a`. Nenhum código novo nem alteração de schema, dependência, autenticação ou configuração de ambiente. Artefato player ignorado e dependências compartilhadas foram disponibilizados para gates locais sem copiar `.env`.

Runtime efetivo: staging READY `dpl_NxbqBN6LxyTimMHJaNn1TCQqrz6N` em `f8ef7312`, custom environment staging; produção READY `dpl_3b5bm53F5xT1mQYsNmZuBwuQzhYh` em `31151e2a`, target production. Antes do push os refs serão conferidos novamente. Bancos separados: `sameDatabaseUrl=false`, `distinctDatabaseUrls=true`, ambos os perfis compatíveis com fingerprints previamente verificados. Limite: segredo staging não pode ser relido na API; comparação usa fingerprint do envio validado, perfil CLI e metadados de escopo. Nenhuma variável foi copiada ou alterada.

Verificação de configuração em produção executada exclusivamente com SELECT em transação de leitura: 23 tabelas, nenhuma coluna esperada ausente, três regras com fontes/destinos ativos e parâmetros legados equivalentes aos de staging. Smart tem ID próprio de produção e foi localizado por rota, sem duplicação. As três regras de produção têm versões centrais ativas e grafos válidos ACAO→FIM, sem condições/temporizadores; gatilhos correspondem à etapa e pipeline de origem. Os schemas reais do candidato aprovaram todos os grafos, gatilhos e parâmetros. O grafo Financeiro→Operacional mantém responsável explícito `10`; o legado/Admin usa seu fallback próprio. Essa diferença de configuração preexistente é preservada e foi julgada compatível por arquitetura, pois a expressão de escolha do responsável já existia no runtime anterior. Zero consultas a dados de clientes/execuções, zero writes, workers ou migrations.

Smoke inicial de produção, nos dois aliases: raiz/login 200; `/api/health/version` 200 com SHA `31151e2a`; `/api/broadcast` 200 sem erro; providers credentials e sessão anônima 200; CRM sem sessão 307 para `/?acesso=bloqueado`; três chunks públicos 200. Corpos das respostas descartados. Isso é baseline, não prova de promoção concluída.

Gates reais do candidato concluídos: `npm run typecheck` exit 0 (38,13 s); `npm run lint` exit 0 (43,68 s, 1.193 avisos existentes); `npm test -- --maxWorkers=2` exit 0, 686 arquivos/5.278 testes aprovados, quatro skipped e um todo (93,51 s). Build integral equivalente ao script oficial exit 0 (221 s): `prisma generate && npm run build:player && NODE_OPTIONS=--max-old-space-size=4096 taskset -c 0 node node_modules/next/dist/bin/next build --webpack`, com diretório exclusivo e limite de memória do processo; heap aumentado de 3.072 para 4.096 MiB por restrição conhecida, sem mudar fonte/configuração. Fingerprint de todos os arquivos versionados não documentais antes/depois: `5e6440d7893024a8ba27d2ed5db88eb72747c77921a291e86af2abbd126533dc`, inalterado. Gates usaram fixture SQLite privada e segredo efêmero, sem ENV/banco remoto carregados. CodeRabbit ausente no caminho configurado; revisão independente QA e arquitetura como fallback, ambas APPROVED/PASS. Diff de publicação sem segredos ou arquivos de ambiente; refs main/staging reconferidos sem avanço. Publicação e smoke final ainda pendentes nesta revisão documental.

Rollback preparado: código anterior `31151e2a` e deployment READY `dpl_3b5bm53F5xT1mQYsNmZuBwuQzhYh`; se necessário reassociar somente aliases de produção ao deployment válido ou publicar reversão de código/build com ENV própria de produção. Nenhuma restauração de banco. Evidências sanitizadas privadas em `/var/tmp/alpha-comparacao-promocao-20261021/{runtime-comparison,git-candidate-preflight,production-config-readonly,smoke-preflight,forge-result}.json`.

Não houve commit, push ou alteração de código/banco pelo SM. DevOps preservou worktree principal e alterações concorrentes alheias.

### Publicação final — DevOps

Merge `5fd0d1c230858800e337a79c3202ead84c13d73e` publicado por push normal, pais `31151e2a` + `f8ef7312`; build Git próprio de produção HAM/5fd READY e smoke aprovado. Ordenação concorrente validada em staging `347c61a4` foi publicada pelo outro owner como `824db63caa1726aeb4d3ff36e40f6b7a0f611eb8`, descendente do merge. Nossa worktree fez FF seguro preservando QA Results local. 26.435 entradas Git não documentais idênticas entre `824db63c` e `347c61a4`; diferenças só nas duas stories.

QA aceitou reuso imutável dos quatro gates executados pelo outro owner no staging combinado: lint/typecheck/build exit 0, 688 arquivos/5.287 testes aprovados, quatro skipped e um todo. Primeiro run com timeouts CLI por concorrência, retry sem mudanças de fonte/testes aprovado. Não são descritos como execução nova nesta worktree. Deployment produção `dpl_Hd9KHDcuQkfmmJTRxKp5wkqCsukG` READY em `824db63c`, target production/customEnvironment null; staging `dpl_Gb3owd49fCsza2MfEHFKXW2AcPbp` READY em `347c61a4`.

Dois aliases de produção e project target conferidos: health/version 200 no SHA, broadcast/banco 200 sem erro, raiz/providers/sessão anônima 200, CRM anônimo bloqueado com 307, três chunks públicos 200 por host. Somente GET sem dados de clientes persistidos; nenhuma alteração ENV/DB, worker ou novo E2E autenticado de produção. Rollback intermediário saudável `5fd0d1c2`/HAM além da baseline `31151e2a`/3b5. Relatório `docs/reports/comparacao-staging-producao-2026-10-21.md`; evidências `aliases-aligned-ready.json`, `smoke-aligned-ready.json`, `environment-after-ready.json`, `concurrent-release-equivalence.json`, `concurrent-gates-evidence.json`, `publication.json`, no diretório privado indicado.

Fechamento deste fluxo em um commit apenas documental (story, relatório e append no journal), sem alterar runtime nem trabalhos alheios. QA final será registrada antes desse commit; último redeploy documental será conferido privadamente sem abrir novo ciclo documental.

### File List

67 caminhos únicos desde baseline de produção: correções auditadas, ordenação concorrente preservada e fechamento documental. O último commit deste fluxo altera somente story, relatório e journal.

- `.bibble/memory/codebase-map.md`
- `.bibble/memory/components.md`
- `.bibble/memory/decisions.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/journal.md`
- `docs/reports/comparacao-staging-producao-2026-10-21.md`
- `docs/reports/evidencias/crm-correcoes-2026-10-21/operacional-boas-vindas.png`
- `docs/reports/validacao-correcoes-crm-2026-10-21.json`
- `docs/reports/validacao-correcoes-crm-2026-10-21.md`
- `docs/stories/story-alpha-crm-correcoes-auditoria-fluxo-20261021.md`
- `docs/stories/story-crm-cards-mais-recentes-primeiro.md`
- `docs/stories/story-promocao-correcoes-auditoria-crm-producao-20261021.md`
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/Encaminhamentos.ts`
- `src/actions/bpm/Quadro.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/FormularioEtapaRenderer.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistFollowUp.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelEncaminhamentos.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelStatusPosFechamento.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `src/components/BibbleChatHome/BotaoFalarMensagem.tsx`
- `src/components/BibbleChatHome/useVoiceStatus.ts`
- `src/lib/bpm/automacoes/central-runtime.ts`
- `src/lib/bpm/automacoes/central-schemas.ts`
- `src/lib/bpm/automacoes/encaminhamento.ts`
- `src/lib/bpm/automacoes/eventos.ts`
- `src/lib/bpm/automacoes/executor.ts`
- `src/lib/bpm/automacoes/schemas.ts`
- `src/lib/bpm/card-modal-ui.ts`
- `src/lib/bpm/copiar-campos-card-vinculado.ts`
- `src/lib/bpm/medicao-ui.ts`
- `src/lib/bpm/noloss-leads.ts`
- `src/lib/bpm/ordem-cards.ts`
- `src/lib/bpm/origem-cliente-server.ts`
- `src/lib/bpm/quadro-paginado.ts`
- `src/lib/bpm/requisitos-etapa-server.ts`
- `tests/bibble/voice-client.test.ts`
- `tests/bibble/voice-proxy.test.ts`
- `tests/bibble/voice-status-react.test.ts`
- `tests/bpm/arquivamento-modal-react.test.ts`
- `tests/bpm/automacoes-executor.test.ts`
- `tests/bpm/autosave-fixed-recovery-react.test.ts`
- `tests/bpm/board-polling-react.test.ts`
- `tests/bpm/card-modal-integration.test.ts`
- `tests/bpm/card-modal-ui.test.ts`
- `tests/bpm/card-save-flow.test.ts`
- `tests/bpm/cards-ordenacao-actions.test.ts`
- `tests/bpm/edicao-campos-card.test.ts`
- `tests/bpm/encaminhamento-auditoria.test.ts`
- `tests/bpm/encaminhamento-sqlite.test.ts`
- `tests/bpm/encaminhamentos-actions.test.ts`
- `tests/bpm/encaminhamentos-painel-react.test.ts`
- `tests/bpm/financeiro-operacional-handoff.test.ts`
- `tests/bpm/formulario-etapa.test.ts`
- `tests/bpm/movimento-livre-eventos.test.ts`
- `tests/bpm/movimento-livre-react.test.ts`
- `tests/bpm/ordem-cards.test.ts`
- `tests/bpm/origem-cliente.test.ts`
- `tests/bpm/origem-novo-alias.test.ts`
- `tests/bpm/quadro-actions.test.ts`
- `tests/bpm/salvamento-manual-campos-react.test.ts`
- `tests/bpm/tarefas-alertas-foco-react.test.ts`

## QA Results

Pendente de revisão e execução dos gates do candidato; aprovação histórica de staging não substitui este registro.

### 2026-10-21 — Quinn: revisão da integração e pré-readiness

**Conteúdo da candidata: APPROVED; GO de publicação pendente dos gates novos e da conferência final de configuração.** Revisão somente de leitura em `crm-comparacao-promocao-20261021`: merge normal de `31151e2a8f9eec0e55b551841b8a2ff67be612fe` com `f8ef731232920a29a2339f416b402e30d99afb40`, sem conflitos. O índice completo não apresenta diferença contra `f8ef7312`; fontes, testes, schema, dependências, autenticação e configuração de build são equivalentes ao staging aprovado. A nova story é o único documento adicional previsto. `git diff --cached --check` passou. A árvore de main é igual à base `9d44e969` (`4ad083517aa4f77c846bb41f2469b1e379b97fda`): os commits exclusivos de main não introduzem contrato de aplicação ausente no staging.

`runtime-comparison.json`, observado em 21/10/2026 às 18:02:19 UTC, confirma staging READY em `f8ef7312`/`dpl_NxbqBN6LxyTimMHJaNn1TCQqrz6N`, ambiente customizado staging, e produção ainda READY em `31151e2a`/`dpl_3b5bm53F5xT1mQYsNmZuBwuQzhYh`, target production. Os aliases e targets do projeto correspondem a essas revisões. A comparação sanitizada registra bancos distintos e os dois perfis compatíveis com os fingerprints esperados; não se copiam variáveis, bancos ou runtime compilado de staging.

**Cobertura e rastreabilidade:** AC 1–2 sustentados por refs, comparação do conteúdo e índice; AC 3 parcialmente conferido pela separação dos ambientes, com diagnóstico de configuração de produção em curso; AC 4 aguarda Forge do candidato; AC 5–7 dependem da publicação, SHA/READY/alias, smoke somente de leitura e registro de rollback. O E2E histórico do runtime `02788143` sustenta a cadeia Admin com três cards, duas execuções SUCESSO e três vínculos, com replays sem duplicação. As revisões arquiteturais/Anubis/Lens anteriores continuam aplicáveis ao runtime idêntico; esta integração mecânica não cria nova decisão arquitetural. CodeRabbit CLI indisponível no caminho configurado; revisão independente é o fallback documentado.

Não foram identificados novos casos de teste exigidos por conteúdo exclusivo de main. A suíte existente cobre identidade/ACL, intenção administrativa distinta do movimento livre, dedupe/atomicidade/retry, estado financeiro preservado, origem/parceiro da mesma empresa, rascunhos/contexto/contadores e voz. Os quatro gates serão comprovados pelo owner Forge sem duplicação de execução por QA. O teste autenticado completo permanece evidência de staging; não se criam cards ou disparos em produção para reproduzi-lo. Voz 503 e latência perceptível permanecem limitações conhecidas, sem promessa de recuperação ou melhora percentual.

Nenhuma fonte, teste, configuração ou banco foi alterado por QA. Esta entrada modifica exclusivamente QA Results; **não declara publicação concluída nem autoriza ignorar gates pendentes**.

### 2026-10-21 — Quinn: GO pré-push / APPROVED

**GO pré-push: APPROVED.** Forge finalizado em 18:14:41 UTC: `forge-result.json` registra `FORGE_PASS`, quatro gates exit 0 e fingerprint de fontes inalterado. Typecheck 38,13 s; lint 43,68 s, zero erros e 1.193 avisos existentes; build completo 221 s; suíte completa 93,51 s incluindo execução/cobertura, **686 arquivos e 5.278 testes aprovados**, quatro skipped, um todo e zero falhas. A contagem JSON de 1.597 suites inclui grupos internos; não é contagem de arquivos. Fixtures SQLite privadas e sentinela local/token vazio impediram consultas dos testes a bancos remotos. Metadados gerados de build foram restaurados; diff contra staging permanece vazio no índice e nas fontes da candidata.

**Compatibilidade de produção conferida:** `production-config-readonly.json` identifica destino confirmado, leitura SELECT-only, zero gravações, sem leitura de clientes/execuções e sem worker. As 23 tabelas verificadas contêm todas as colunas esperadas; as três regras de encaminhamento estão ativas/válidas e correspondem às rotas homologadas. Grafos, schemas de gatilho/parâmetros e correspondência dos IDs de pipeline/etapa passaram. A identidade própria da regra Smart em produção não representa divergência funcional. No Financeiro→Operacional, o nó central conserva `responsavelId=10` explícito e o legado/manual mantém seu fallback ao responsável da origem; essa diferença preexistente não foi homogeneizada nem exige alterar o banco. Ambiente de produção usa suas próprias configurações e banco distinto do staging.

A revisão independente não encontrou bloqueante novo de integração, segurança ou configuração. O índice permanece equivalente à árvore `f8ef7312`, com a nova story deliberadamente adicionada como documentação. Os contratos e limites do E2E staging/027 continuam aplicáveis ao runtime idêntico; arquitetura/Anubis/Lens anteriores são complementados pela revisão desta integração e gates novos. CodeRabbit indisponível foi registrado com fallback independente. Nenhum teste novo foi necessário para o merge mecânico sem alteração de runtime.

**Decisão:** liberar DevOps para commit/push normal e publicação com configuração de produção. AC 1–4 conferidos; AC 5–7 ainda exigem a revisão efetivamente publicada, deploy READY, aliases/target, smoke somente de leitura e registro final/rollback. Este GO não declara produção atualizada. Não criar cards, mover negociações ou disparar encaminhamentos em produção para obter evidência. O serviço de voz continua sendo uma limitação externa conhecida; nenhum aceite de recuperação TTS ou validação financeira/operacional completa é inferido.

Evidências privadas conferidas em `/var/tmp/alpha-comparacao-promocao-20261021`: `forge-result.json`, `gate-build-result.json`, `gate-tests.log`, `runtime-comparison.json`, `production-config-readonly.json` e `git-candidate-preflight.json`. Sem mudanças de fonte, testes, banco ou configuração por QA; somente esta seção foi atualizada.

### 2026-10-21 — Quinn: primeira publicação confirmada; alinhamento concorrente pendente

**Primeira promoção CRM: APPROVED / publicada.** Evidências `aliases-first-ready.json` (18:19:46 UTC) e `smoke-first-ready.json` (18:19:52 UTC) confirmam `5fd0d1c230858800e337a79c3202ead84c13d73e` em produção, deployment `dpl_HAMBD1DGJS2dDFjD84KpRfSNkHtZ` READY, target production, domínio `painel.alpha-comex.com`, alias Vercel e target do projeto correspondentes. Smoke GET sem sessão: versão retorna SHA exato/saúde ok; raiz, leitura de banco, providers, sessão e três chunks HTTP 200; CRM HTTP 307 para acesso bloqueado. Nenhuma mutação de dados foi usada como smoke, e isso não constitui E2E autenticado em produção.

**Comparação global ainda aberta:** enquanto essa publicação ocorria, staging avançou para `347c61a4f54365715f50bc3a5a82375d938ebd3d`, deployment `dpl_Gb3owd49fCsza2MfEHFKXW2AcPbp` READY, com dez caminhos de ordenação cronológica dos cards aprovados por fluxo independente. Portanto, não se declara que produção contém o staging mais recente nesta fase. O relatório anterior e o aceite do runtime CRM permanecem válidos para seu escopo; o delta novo exige reconciliação preservando os dois trabalhos e verificação do resultado efetivamente publicado.

Revisado o diff dos cinco arquivos de aplicação da ordenação: helper puro, datas no manifesto e ordenação anterior à paginação/hidratação; sem alteração de ACL, transição ou configuração. Gates do conjunto staging `f8 + ordenação`: 688 arquivos/5.287 testes PASS, quatro skipped/um todo, lint/typecheck/build PASS. A rodada inicial com seis falhas por timeouts/subprocessos e sua repetição sem mudanças permanecem registradas no fluxo independente. Gates de `main 311 + ordenação` (682 arquivos/5.181 testes) não são confundidos com validação do conjunto que também contém as correções CRM/027.

É admissível reutilizar os gates completos imutáveis do staging/347 se a integração final comprovar fontes, testes, dependências, configurações e demais entradas de build equivalentes; nova localização de worktree ou SHA somente documental não altera essa cobertura. Alteração de runtime ou entrada de build exigiria nova avaliação. Build próprio com ambiente de produção, READY/SHA/aliases e smoke do resultado final continuam obrigatórios. Fechamento global permanece pendente.

### 2026-10-21 — Quinn: integração concorrente 05c5bae2 / GO APPROVED

**GO para publicar a revisão combinada `05c5bae2001da5b73da1334dd706b504ed3a3d6c`: APPROVED.** O commit é filho direto de `5fd0d1c230858800e337a79c3202ead84c13d73e`, preserva a primeira entrega e adiciona somente os dez caminhos da correção de ordenação. A leitura Git independente comparou os **26.435 registros rastreados fora de docs/.bibble** contra staging `347c61a4f54365715f50bc3a5a82375d938ebd3d`: mesmos caminhos, modos e objetos, sem divergência. O diff completo limita-se às duas stories. A evidência `concurrent-release-equivalence.json` registra o mesmo mapa SHA-256 em ambos: `c20f409e36e127bad43fbd2e79664c0f7f7b0ca49312533accf193f85de9af52`.

**Gates aplicáveis ao conjunto combinado:** os quatro gates reais do staging/f8+ordenação aprovados em `/tmp/crm-cards-novos-staging-20261021-gates.json` sustentam essa candidata equivalente, sem execução redundante por mudança de worktree. Log da suíte final conferido independentemente: **688 arquivos e 5.287 testes aprovados**, quatro skipped, um todo, zero falhas. Lint sem erros/1.193 avisos existentes, typecheck e build padrão exit 0. A primeira execução falhou em seis testes/quatro arquivos por timeouts/subprocessos sob concorrência; repetição da mesma fonte/testes sem os outros gates passou, mantendo a rastreabilidade. Os resultados menores de main311+ordenação não são usados como prova do conjunto combinado.

Não foram alterados schema, dependências, autenticação, ambiente ou banco; permanecem válidas a leitura de compatibilidade de produção e a separação dos ambientes. Código dos encaminhamentos, autorização, idempotência e dados herdados permanece preservado. O pedido atual de comparação/atualização e a autorização própria da ordenação abrangem esta integração; nenhuma nova implementação ou alteração de configuração foi adicionada por QA.

Liberação restrita ao mesmo SHA por push normal preservando concorrência e build próprio com ambiente de produção. **Publicação final/alinhamento ainda pendentes:** conferir remoto, deployment READY, Git SHA, ambos aliases de produção/target e smoke somente de leitura. Não declarar staging/produção alinhados antes dessas provas. O aceite do E2E continua sendo o do staging; não fabricar evidências negociais em produção.

### 2026-10-21 — Quinn: ratificação do SHA publicado em main

**GO ratificado para `824db63caa1726aeb4d3ff36e40f6b7a0f611eb8`: APPROVED.** O owner substituiu a candidata `05c5bae2` antes do push por revisão com o mesmo pai `5fd0d1c2` e apenas 20 linhas adicionadas/três removidas na story de ordenação. Diff Git independente confirma nenhum outro caminho alterado entre as candidatas; runtime, testes e entradas de build permanecem exatamente equivalentes ao staging `347c61a4` e aos gates completos de 688 arquivos/5.287 testes. A atualização documental não exige repetir gates. A ratificação acompanha o SHA efetivamente enviado a main; READY, aliases/target e smoke desse SHA permanecem pendentes e não são presumidos pela disponibilidade da primeira promoção.

### 2026-10-21 — Quinn: QA FINAL / APPROVED — produção funcionalmente alinhada

**QA FINAL: APPROVED.** Às 18:26:40 UTC, `aliases-aligned-ready.json` confirma produção em **`824db63caa1726aeb4d3ff36e40f6b7a0f611eb8`**, deployment **`dpl_Hd9KHDcuQkfmmJTRxKp5wkqCsukG` READY**, target production, sem ambiente customizado de staging. Domínio `painel.alpha-comex.com`, alias `painel-alpha-projeto.vercel.app` e target production do projeto apontam para o mesmo deployment/SHA. Staging permanece READY em `347c61a4f54365715f50bc3a5a82375d938ebd3d`/`dpl_Gb3owd49fCsza2MfEHFKXW2AcPbp`, no ambiente customizado staging. As revisões têm históricos/documentos próprios, mas seu runtime e entradas de build estão funcionalmente alinhados: 26.435 objetos rastreados não documentais iguais, conforme prova independente e mapa `c20f409e36e127bad43fbd2e79664c0f7f7b0ca49312533accf193f85de9af52`.

**Smoke final conferido:** `smoke-aligned-ready.json`, 18:26:38 UTC, contém somente GET sem sessão, com corpos descartados. Nos dois hosts de produção, raiz, versão/saúde, leitura de banco, providers, sessão e três chunks respondem HTTP 200; a versão confirma exatamente `824db63c`, saúde ok e nenhuma falha na leitura de banco. CRM responde HTTP 307 para `/?acesso=bloqueado`, preservando proteção de acesso. Isso comprova disponibilidade/identidade e proteção; não substitui login ou E2E autenticado em produção. Não foram criados cards, movidas negociações, repetidos envios ou disparados serviços externos para este smoke.

**Fundamentação consolidada:** quatro gates novos da primeira integração passaram (686 arquivos/5.278 testes), e os quatro gates do conjunto final equivalente ao staging/347 também passaram (688 arquivos/5.287 testes). O E2E Admin de encaminhamentos continua válido para o runtime preservado; a integração inclui a ordenação cronológica aprovada, sem regressão identificada de ACL, dedupe, origem, rascunhos ou movimento. Produção conserva banco e configuração próprios, com três regras compatíveis e 23 tabelas sem colunas esperadas ausentes; nenhuma migration, seed, backfill ou alteração de configuração/dados foi necessária. Permanecem explícitos os limites de usuário comum/parceiro/Smart remotos, regras financeiras completas, trabalho operacional além da entrada e voz 503.

**Fechamento documental permitido:** DevOps pode concluir checklist/File List e publicar um commit exclusivamente documental sobre esta revisão. Esta aprovação continua aplicável se o commit conservar integralmente o mapa de código/testes/dependências/configuração e não alterar ambiente/banco; conferir o novo SHA em READY, aliases/target e smoke, guardando a evidência privada. Não é necessário criar novo ciclo de commit documental ou repetir gates por um SHA sem mudança de runtime. Qualquer alteração fora dessa condição exige reavaliação. Rollback permanece somente de código/deployment, preservando o banco e usando a configuração de produção; o registro operacional final pertence ao executor DevOps.

QA encerra sua escrita neste arquivo: apenas QA Results foi atualizado. Conclusão funcional aprovada; formalização final do registro e verificação mecânica do SHA documental ficam com DevOps.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-21 | 0.1 | Story específica de comparação/promoção autorizada, com separação de ambientes, gates e smoke sem mutação de produção. | River (@sm) |
