# Story: Release integral staging → main/produção e leads Instagram

## Status

Ready for Review — autoria `@sm`. Pedido explícito em 2026-10-23 às 12:13 UTC: analisar o staging, promover todos os commits/features aprovados para main/produção e enviar os leads Instagram para produção. `@devops` prepara/publica; `Vault` avalia banco/lote; `@qa` valida. Candidato isolado preparado; gates locais aprovados, publicação em staging e promoção condicionadas aos gates operacionais descritos abaixo.

## Story

Como responsável pelo painel, quero promover integralmente as funcionalidades aprovadas de staging e receber os leads reais Instagram no ambiente oficial, preservando produção, identidade dos leads e dados de cada ambiente.

## Acceptance Criteria

1. Conferir snapshots reais de branches, ancestralidade, runtimes e aliases; inventariar todas as aproximadamente seis funcionalidades aprovadas e seus commits. Referências iniciais `main=1504…` e `staging=d6bb…` são provisórias até o preflight DevOps. Não incorporar alterações locais dirty sem vínculo com o escopo aprovado.
2. Promoção do código para produção está autorizada. Eventual DDL ou operação em massa sujeita à política AGENTS exige plano concreto e consentimento específico correspondente; não confundir a aprovação genérica da release com essa aprovação de banco, nem pedir novamente aprovação genérica do código.
3. Preparar candidato isolado que preserve o conteúdo oficial de produção, incluindo o marco `04cc…` e mudanças posteriores, e todas as funcionalidades atuais aprovadas de staging. Resolver conflitos e conferir a árvore completa, sem force push ou perda de features exclusivas.
4. Concluir lint, typecheck, testes, build e QA da árvore candidata; validar primeiro staging READY e smoke pertinente. Reutilizar evidência apenas quando a identidade dos arquivos/contratos e contexto estiver comprovada; não promover artefato não coberto pelos gates.
5. Vault confere estrutura, escopo da carga e backup completo/verificado/válido antes de eventual mudança estrutural ou lote. Preparar SQL/comandos exatos, banco/ambiente, volume, impacto, riscos, alternativa e rollback antes de solicitar consentimento específico necessário. Não executar DDL/lote enquanto esse gate aplicável estiver pendente.
6. Origem da carga é a **planilha real → NoLoss produção → CRM produção**. Não copiar fixtures, leads ou bancos de staging. Preparar snapshot revisável, identidade textual estável, deduplicação/idempotência e dry run atual; executar a carga somente após plano revisado e consentimentos específicos aplicáveis.
7. Reconciliar contagens, IDs e ACKs de recebimento, erros e duplicatas nos dois sistemas, sem assumir leads nem atribuir responsável por causa da importação. Preservar card personalizado, origem Instagram e data original do formulário; UTMs/publicidade permanecem no NoLoss e fora do CRM. Reenvio não duplica ou sobrescreve edição humana.
8. Confirmar SHA efetivamente publicado, deployment READY e alias correto de produção; registrar QA, reconciliação, limites, recibos privados e ponto de rollback da versão anterior, sem expor segredos/dados pessoais. Atualizar checklist e File List. Rollback de código não executa DROP ou reversão silenciosa de dados.

## Tasks

- [ ] Fixar snapshots/aliases e inventariar integralmente commits/features aprovados.
- [ ] Preparar candidato isolado preservando produção e todo staging aprovado.
- [ ] Concluir gates, QA e validação em staging READY.
- [ ] Preparar Vault, backup, plano exato e obter consentimentos específicos aplicáveis antes de DDL/lote.
- [ ] Publicar produção e executar integração/carga real autorizada pelo NoLoss, com reconciliação/idempotência.
- [ ] Confirmar READY/alias, QA final, relatórios/rollback e atualizar File List.

## File List

- `src/lib/checklist/storage.ts` — consumo da credencial nativa exclusivamente com marcador e ambiente de produção, preservando prioridade da credencial atual.
- `tests/checklist-analistas/storage-production-binding.test.ts` — nove cenários de precedência e isolamento de ambiente.
- `docs/stories/story-release-integral-staging-main-instagram-20261023.md` — escopo, gates e pré-requisitos da release.

## Validação local do adaptador — 2026-10-23

- QA e arquitetura: PASS para o consumo nativo em servidor, sem exportação de segredo.
- Main: testes completos 748 arquivos, 6.131 PASS, quatro ignorados e um todo; lint zero erros/1.183 avisos legados; build padrão e typecheck sequencial exit 0.
- Portal: 66 testes Vitest e três Node PASS, lint/typecheck/build exit 0; staging e63fe49e READY.
- Usuário confirmou especificamente o plano de 67 DDL, bootstrap de três identidades e carga de 27 leads reais. Vault executa o banco; a publicação Portal produção depende de Vault PASS, e Main produção depende também de staging atualizado e Portal produção READY.
- Não executar lote de hash legado, grants ou dados de staging em produção.
- Avanço concorrente staging eec5eff9 identificado no preflight; preservar seu conteúdo e validar a união antes da publicação do Main.
