# Sincronização do aplicativo em staging — 2026-10-20

Story: `docs/stories/story-staging-sincronizacao-fluxo-staging-primeiro.md`.

## Escopo e isolamento

- Base: `1ab82aec9377d15d814e075548f73b6d75087a2e` (`origin/staging`).
- Snapshot isolado: `painel-alpha-worktrees/staging-todas-modificacoes-20261020`.
- Publicação autorizada exclusivamente na branch `staging`, ambiente custom da Vercel `env_sKT0JOh0HB03g20jmcqN5pTHMjqT`.
- URL estável: `https://staging.alpha-comex.com`.
- Antes desta publicação: deployment READY `dpl_6zD8Z5skFJMjUbzcXu8PDGdoKJSk`, SHA da base acima.
- Produção preservada: target `production` identificado como `dpl_6w5Pbv2Jw3VM72gmtB7LkpAuq6hz`; nenhum push para `main` ou promoção de produção autorizado nesta execução.
- Serviço systemd legado `painel-alpha-stage.service` estava inativo, aponta release de 2026-10-09 e não participa da publicação atual. O script `deploy-staging-release.sh` não foi executado.
- Build isolado usa `.env.local` ignorado contendo somente credenciais do banco staging, copiado de `.env.staging.local`; nenhuma credencial de produção foi copiada ao snapshot.
- Vercel: atualizados somente os valores de `TURSO_DATABASE_URL` (ID `InV8A2ow9Xj9AJny`) e `TURSO_AUTH_TOKEN` (ID `nv7sFCCjdGAINAWS`) já exclusivos do custom staging, com `target: []`. A comparação dos demais objetos de ambiente antes/depois confirmou ausência de outras alterações. Evidência local protegida em `/tmp/alpha-staging-env-update-evidence.json`, com hashes dos valores enviados, sem segredos.

## Inventário incluído

Lista de arquivos do aplicativo/documentação transferidos do checkout original ou criados para esta entrega. A lista cobre modificações de CRM, chamados, contratos, metas, BI e scripts/testes existentes pendentes, conforme pedido de sincronizar todas as modificações do aplicativo.

- `.bibble/memory/codebase-map.md`
- `.bibble/memory/decisions.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/journal.md`
- `AGENTS.md`
- `docs/dev-tools.md`
- `docs/reports/staging-sincronizacao-20261020.md`
- `docs/stories/relatorio-alpha-crm-alinhamento-cards-fluxo.md`
- `docs/stories/relatorio-vault-crm-alinhamento.md`
- `docs/stories/story-alpha-crm-acesso-individual-pipeline.md`
- `docs/stories/story-alpha-crm-alinhamento-cards-fluxo-contrato.md`
- `docs/stories/story-alpha-crm-assessoria-smart-enviar-revisao.md`
- `docs/stories/story-alpha-crm-migracao-historico-rd-station-v1.md`
- `docs/stories/story-alpha-crm-movimentacao-manual-importados-rd.md`
- `docs/stories/story-alpha-crm-reconciliacao-historico-autoria-rd.md`
- `docs/stories/story-alpha-crm-recuperacao-campos-sincronizacao-rd-v1.md`
- `docs/stories/story-alpha-crm-seletor-pipeline-no-quadro.md`
- `docs/stories/story-alpha-crm-visao-equipe-pipeline.md`
- `docs/stories/story-central-dev-painel-api-radar.md`
- `docs/stories/story-chamados-multissetorial.md`
- `docs/stories/story-metas-empresa-em-constituicao.md`
- `docs/stories/story-staging-sincronizacao-fluxo-staging-primeiro.md`
- `package.json`
- `scripts/configurar-assessoria-smart-revisao.mts`
- `scripts/lib/rd-field-mapping.mjs`
- `scripts/lib/rd-sync-engine.mjs`
- `scripts/lib/rd-sync-plan.mjs`
- `scripts/sincronizar-rd-alpha.mjs`
- `src/actions/ContratoComercial.ts`
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/Checklists.ts`
- `src/actions/bpm/Dashboard.ts`
- `src/actions/bpm/DisponibilidadeEtapasCard.ts`
- `src/actions/bpm/Empresas.ts`
- `src/actions/bpm/NotaFiscal.ts`
- `src/actions/bpm/Quadro.ts`
- `src/actions/bpm/Tarefas.ts`
- `src/actions/bpm/VisibilidadePipeline.ts`
- `src/actions/chamados.ts`
- `src/app/PainelAlpha/AlphaBI/page.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/ConfirmarMovimentoRdModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/VisibilidadePipelineSection.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/SeletorPipelineBoard.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/page.tsx`
- `src/app/PainelAlpha/Chamados/page.tsx`
- `src/app/api/integrations/alpha-crm/opportunities/route.ts`
- `src/components/DetalhesChamado.tsx`
- `src/components/comercial/ModalGerenciamentoLeads.tsx`
- `src/lib/bpm/acesso-individual-pipeline.ts`
- `src/lib/bpm/automacoes/central-schemas.ts`
- `src/lib/bpm/movimento-importado-rd.ts`
- `src/lib/bpm/ownership.ts`
- `src/lib/bpm/transicao-command.ts`
- `src/lib/bpm/visao-equipe-server.ts`
- `src/lib/bpm/visao-equipe.ts`
- `src/lib/chamados/acesso.ts`
- `src/lib/chamados/conclusao.ts`
- `src/lib/modulos-registry.ts`
- `src/lib/validations/bpm.ts`
- `tests/bpm/acesso-individual-pipeline.test.ts`
- `tests/bpm/arquivados-action.test.ts`
- `tests/bpm/arquivamento-modal-react.test.ts`
- `tests/bpm/board-visao-equipe-react.test.ts`
- `tests/bpm/boas-vindas-acesso.test.ts`
- `tests/bpm/card-modal-integration.test.ts`
- `tests/bpm/cards-no-quadro.test.ts`
- `tests/bpm/consulta-colegas-side-effects.test.ts`
- `tests/bpm/disponibilidade-etapas-card.test.ts`
- `tests/bpm/em-tratativa.test.ts`
- `tests/bpm/eventos-rd-sqlite.test.ts`
- `tests/bpm/filtro-responsavel-board.test.ts`
- `tests/bpm/listar-pipelines-seletor.test.ts`
- `tests/bpm/membros-card-ownership.test.ts`
- `tests/bpm/movimentacao-importados-rd-actions.test.ts`
- `tests/bpm/movimentacao-importados-rd-command.test.ts`
- `tests/bpm/movimentacao-importados-rd-react.test.ts`
- `tests/bpm/movimentacao-rd-eventos-reais.test.ts`
- `tests/bpm/oportunidades-integracao-permissoes.test.ts`
- `tests/bpm/pendencias-motor.test.ts`
- `tests/bpm/pipeline-page-seletor.test.ts`
- `tests/bpm/quadro-actions.test.ts`
- `tests/bpm/rd-field-mapping.test.ts`
- `tests/bpm/rd-sync-collection.test.ts`
- `tests/bpm/rd-sync-engine.test.ts`
- `tests/bpm/rd-sync-plan.test.ts`
- `tests/bpm/seletor-pipeline-pendente-react.test.ts`
- `tests/bpm/visao-equipe-config-react.test.ts`
- `tests/bpm/visao-equipe.test.ts`
- `tests/bpm/visibilidade-pipeline-actions.test.ts`
- `tests/builder/embed.test.ts`
- `tests/chamados/assumir-administrativo-react.test.ts`
- `tests/chamados/assumir.test.ts`
- `tests/chamados/conclusao-feedback.test.ts`
- `tests/chamados/multissetorial-acesso.test.ts`
- `tests/comercial/criar-contrato.test.ts`
- `tests/metas/empresa-em-constituicao-react.test.ts`

## Exclusões deliberadas

- `.env*`, tokens, dumps e `database-backups/`: credenciais/dados reais e artefatos operacionais permanecem fora do Git.
- `.cache/`, `coverage/`, `.next*/`, `node_modules/`, `tsconfig.tsbuildinfo`, `.snapshot-manifest.json`: artefatos locais/gerados.
- `.aiox/project-status.yaml`: estado volátil do checkout compartilhado.
- `.agents/skills/speckit-*/`, `.specify/` e arquivo `h`: ferramentas/configuração local independentes do runtime do aplicativo, fora do pacote.
- `testApis/`: cópias de fontes, testes e contrato de outro repositório de API, sem importação pelo runtime do Painel; não publicadas como código do Painel.

O checkout original foi preservado; nenhum reset, stash ou descarte de alterações foi executado.

## Quality gates e limitações

- `npm run lint`: PASS, 0 erros e 1193 avisos existentes na base de trabalho.
- `npm test -- --maxWorkers=4`: PASS, 674 arquivos, 5083 testes aprovados; 4 skipped e 1 todo já sinalizados pela suíte.
- `npm run typecheck`: PASS após geração normal do player pelo build. A primeira execução em checkout novo detectou somente esse artefato gerado ausente.
- `npm run build`: PASS no snapshot isolado, com banco staging; webpack compilou e gerou 81 páginas. Avisos conhecidos de pdfjs/dependências dinâmicas, sem erro de build.
- `git diff --check`: PASS.
- Busca de formatos de segredos nos arquivos app alterados: PASS; nenhum `.env` de credenciais adicionado.
- CodeRabbit CLI indisponível; revisão automática não executada. Revisão independente da política/script feita pelo agente principal.
- `npm audit --omit=dev`: 126 advisories na árvore herdada (10 críticos, 53 altos, 61 moderados, 2 baixos). `dependencies`, `devDependencies` e `package-lock.json` são idênticos à base `1ab82aec`; esta entrega apenas acrescenta um comando em `scripts` do package.json. Delta do grafo de dependências: zero. O agente principal determinou classificação contextual CONCERNS para a dívida preexistente desta publicação exclusiva de staging; críticas introduzidas pela mudança continuam bloqueantes. O task pre-push genérico calcula FAIL para qualquer crítico no grafo total (linhas 577/590), sem distinguir baseline; esta exceção contextual segue a instrução explícita do agente principal para o escopo autorizado, sem alegar aprovação do audit. Não houve atualização de dependências fora de escopo.

Checksum SHA-256 do lockfile idêntico ao da base: `3bf04c2b4134bb44c017189c574a86be9a05b0aa36c89890d914086043f2d4b2`.

## Publicação e verificação

Commit do aplicativo: `2d80e4f0ccd3142b1b1f7b6ccc6345c33a127d1c`, 98 arquivos. Push `HEAD:staging` concluído sem force; branch `main` preservada. Deploy automático custom staging READY identificado como `dpl_FXxXhhByQ5g4wppqZd4ZTTpQjvo4`, URL `https://painel-alpha-projeto-gdsrpte2n-alpha-comexs-projects.vercel.app`.

Verificação remota às `2026-10-20T20:51:54Z`:

- Deployment READY, `customEnvironment.id = env_sKT0JOh0HB03g20jmcqN5pTHMjqT`, slug `staging`, SHA do aplicativo `2d80e4f0ccd3142b1b1f7b6ccc6345c33a127d1c`.
- Alias `staging.alpha-comex.com` aponta para o mesmo deployment `dpl_FXxXhhByQ5g4wppqZd4ZTTpQjvo4` na API da Vercel.
- HTTP `/`: 200; CRM e central de automações: 307 para `/?acesso=bloqueado` sem sessão, conforme proteção esperada; API de oportunidades: 401 sem credenciais.
- Target production segue `dpl_6w5Pbv2Jw3VM72gmtB7LkpAuq6hz`; branch remota `main` segue `1504a1c6255693073ef437d2103d271065d7168a`.
- Evidência local sem segredos: `/tmp/alpha-staging-deployment-evidence.json` e `/tmp/alpha-staging-remote-smoke.json`.

Configuração administrativa staging concluída pelo agente principal às `2026-10-20T20:50:06.837Z`: Smart versão 2, `Enviar para REVISÃO` na ordem 3 antes de `CLIENTES CANCELADOS` na ordem 4; automação `cmvh5pf9a001yg5ihmwgah3mh` ativa, versão 1, destino Operacional/Revisão. Preflight repetido confirmou `JA_CONFIGURADO`. Cards Smart e etapas Operacional preservados por comparação antes/depois. Backup consistente staging anterior à configuração: 337 tabelas, 295171 linhas, dump de 308225012 bytes, SHA-256 `f23c7834fa0348c6836843ae8836cf7166a15b1ef01d3d4b9739b863182a1b0c`. Dump e manifesto permanecem em `database-backups/pre-change/`, fora do Git. Evidências completas e limites da validação autenticada estão nas stories da entrega.
