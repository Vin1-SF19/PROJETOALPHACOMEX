# Vault — RM-2026-E1E1F7 — retomada aprovada

RESULT: BLOCKED

Comprovante recebido: `7d1242a301e136a0be69fc1b3c93a16c1de69f3d02fd864771a0d189f8d2e927`. Plano original conferido por SHA-256 `9a8143fe3f5681d8c1eabd171ebc7ade7ccc0169242cb23d5551d7e635ba8226`, preservado sem edição. O comprovante de autorização é um identificador distinto do hash do plano; sua diferença não invalida o consentimento registrado na entrada, que referencia este plano. Não se exige nova aprovação do mesmo escopo nesta retomada.

Ambiente pretendido: Turso de produção do Painel Alpha. Identidade remota não confirmada: nova execução do backup específico terminou com exit 1 antes de conectar, por TURSO_DATABASE_URL e/ou TURSO_AUTH_TOKEN indisponíveis. Nenhum dump desta tentativa foi produzido; restauração, idade, integridade e rollback ensaiado não puderam ser validados. Nenhuma credencial foi exibida.

Models BpmPipeline/BpmEtapa correspondem literalmente ao plano. BpmEtapaCardViewConfig permanece ausente. Escopo continua restrito à tabela nova e índice composto, sem backfill; sequência, riscos, alternativa e rollback estão no vault-plan.md original. Sem backup verificável, nenhuma migration foi criada/aplicada nem schema alterado.

Auditoria de entregabilidade reinspecionada: AdminPipelineClient.tsx:949 monta modo="card"; FormularioEtapaWorkspace.tsx:443 salva via SalvarFormularioEtapaBpm e :880 usa FormularioEtapaRenderer; o consumidor operacional continua KanbanCard em PipelineBoardClient.tsx:182. O checkpoint é consumido pelo pipeline/administrador via arquivo e CLI; a funcionalidade final permanece pendente.

AUTO_ADJUSTMENT_REQUIRED: Configurações → pipeline → Card do Kanban salva formulário; o board não consome configuração compacta persistida.
AUTO_ADJUSTMENT_ACCEPTANCE: administrador salva composição por etapa; preview e card fechado aplicam a mesma composição após recarregar.

Gates executados: hash do plano, comparação literal dos models, ausência do model compacto, rastreamento editor/preview/board e nova tentativa real de backup. Lint, typecheck, testes e build não repetidos: não houve mudança de código; resultados anteriores da story permanecem sem aprovação. Preflight remoto, migrate diff e ensaio de rollback não executados por bloqueio anterior ao preparo da migration.

Arquivos afetados nesta retomada: este relatório, evidence.json, append na story e append no journal. Alterações anteriores preservadas. Nenhum Git mutável executado.

Retomada operacional: disponibilizar as variáveis pelo mecanismo seguro do projeto, gerar/verificar o backup específico e cumprir preflight, diff, ensaio e validações previstos no plano aprovado.

PIPELINE_RESULT: {"status":"BLOCKED","code":"DATABASE_BACKUP_UNAVAILABLE","retryable":true}
