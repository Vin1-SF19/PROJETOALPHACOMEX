# Vault — revalidação aprovada RM-2026-E1E1F7

RESULT: BLOCKED — DATABASE_BACKUP_UNAVAILABLE

Comprovante recebido: `2439549dca422dd73d6ab15a9bd1c55a4efcd55de3f68cb94377fa49e3ced7a8` (2026-09-19T13:55:48.183Z). Hash do plano original conferido: `9a8143fe3f5681d8c1eabd171ebc7ade7ccc0169242cb23d5551d7e635ba8226`. Plano auditável preservado em `../vault-plan.md`, com delta, comandos, riscos, alternativa, rollback e validação. Não falta aprovação nesta execução.

Escopo autorizado: criar BpmEtapaCardViewConfig e seu índice único pipelineId/etapaId, com relações Prisma inversas, no Turso de produção do Painel Alpha. Sem backfill. BpmPipeline e BpmEtapa foram relidos e correspondem literalmente ao plano; não há model CardView no schema local.

Backup executado: `node scripts/turso-backup.mjs 'RM-2026-E1E1F7 fase 3 retomada aprovada'`, exit 1, antes da conexão: configuração TURSO_DATABASE_URL/TURSO_AUTH_TOKEN indisponível. Nenhum segredo registrado. Nenhum dump novo produzido; não foi possível confirmar identidade remota, idade <48h, hash, restauração, integridade ou FKs. Evidência sanitizada em evidence.json.

A regra Vault exige backup completo verificado além da aprovação. Nenhum schema, migration ou banco alterado. Preflight remoto, migrate diff, ensaio SQL, rollback e aplicação não executados. Rollback aprovado continua documentado: preferir desativação do consumidor e conservação de dados; remoção somente da tabela nova após exportar configurações, se houver. Restauração sobre produção exige plano próprio.

Para retomar: disponibilizar configuração Turso ao worker pelo mecanismo seguro do projeto, gerar e verificar backup completo e executar os preflights/ensaio/validação do plano aprovado. Não é necessário repetir pedido de consentimento para o mesmo escopo.

## Entregabilidade

Artefato desta fase: relatório e evidências, consumidos pelo administrador/pipeline via repositório/CLI. Artefato funcional esperado: card compacto configurável para usuários do CRM. Reinspeção confirmou aba Card do Kanban em AdminPipelineClient.tsx:548/949 usando modo=card; preview FormularioEtapaRenderer em FormularioEtapaWorkspace.tsx:880; board ainda deriva apresentação por etapaEhAgendarReuniao em PipelineBoardClient.tsx:206.

AUTO_ADJUSTMENT_REQUIRED: editor e board ainda não compartilham configuração compacta persistida por etapa.
AUTO_ADJUSTMENT_ACCEPTANCE: administrador salva e recarrega composição em /PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId] → Card do Kanban; preview e card fechado em /PainelAlpha/AlphaCRM/pipeline/[pipelineId] refletem a mesma composição.

Sem DELIVERY_READY funcional.

## Gates e arquivos

Hash aprovado e equivalência dos models conferidos; backup falhou. Validação de preservação e whitespace registrada em final-check.json. Lint, typecheck e testes não repetidos: tentativa imediatamente anterior já os executou e registrou falhas em ../approved-retry-20260919/gates.json; nesta retomada houve somente documentação, sem mudanças de código que justifiquem repetição. Não se reivindica aprovação desses gates. Build não executado.

File List: report.md, evidence.json e final-check.json neste diretório; append na story docs/stories/story-rm-2026-e1e1f7-card-kanban-configuravel.md e em .bibble/memory/journal.md. Alterações preexistentes preservadas; sem Git mutável.
