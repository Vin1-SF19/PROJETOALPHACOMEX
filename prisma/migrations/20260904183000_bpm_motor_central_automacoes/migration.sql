-- RM-2026-D100EB — Motor Central de Automações (Fase 3): fundação de dados aditiva.
-- Cria versionamento imutável de automação, outbox de eventos de domínio, execução por
-- passo/branch, agenda materializada, webhook de entrada e lock distribuído com fencing.
-- Estritamente aditivo: nenhum DROP, RENAME ou alteração de coluna existente.

-- Snapshot imutável de gatilho/condição/grafo por automação.
CREATE TABLE "BpmAutomacaoVersao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "automacaoId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "gatilhoTipo" TEXT NOT NULL,
    "gatilhoConfigJson" TEXT NOT NULL DEFAULT '{}',
    "condicaoJson" TEXT,
    "grafoJson" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "criadoPorId" INTEGER NOT NULL,
    "ativadaEm" DATETIME,
    "arquivadaEm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BpmAutomacaoVersao_automacaoId_fkey" FOREIGN KEY ("automacaoId") REFERENCES "BpmAutomacao" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmAutomacaoVersao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BpmAutomacaoVersao_automacaoId_versao_key" ON "BpmAutomacaoVersao"("automacaoId", "versao");
CREATE INDEX "BpmAutomacaoVersao_automacaoId_status_idx" ON "BpmAutomacaoVersao"("automacaoId", "status");

-- Outbox de eventos de domínio (fonte canônica dos gatilhos do motor central).
CREATE TABLE "BpmEventoDominio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "entidadeTipo" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "cardId" TEXT,
    "pipelineId" TEXT,
    "valorAnteriorJson" TEXT,
    "valorNovoJson" TEXT,
    "atorTipo" TEXT NOT NULL,
    "atorUserId" INTEGER,
    "atorExecucaoId" TEXT,
    "ocorridoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlationId" TEXT NOT NULL,
    "causationId" TEXT,
    "profundidade" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BpmEventoDominio_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "BpmCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BpmEventoDominio_atorExecucaoId_fkey" FOREIGN KEY ("atorExecucaoId") REFERENCES "BpmAutomacaoExecucao" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BpmEventoDominio_idempotencyKey_key" ON "BpmEventoDominio"("idempotencyKey");
CREATE INDEX "BpmEventoDominio_cardId_tipo_idx" ON "BpmEventoDominio"("cardId", "tipo");
CREATE INDEX "BpmEventoDominio_correlationId_idx" ON "BpmEventoDominio"("correlationId");
CREATE INDEX "BpmEventoDominio_tipo_ocorridoEm_idx" ON "BpmEventoDominio"("tipo", "ocorridoEm");
CREATE INDEX "BpmEventoDominio_atorExecucaoId_idx" ON "BpmEventoDominio"("atorExecucaoId");

-- Colunas aditivas nullable em BpmAutomacaoExecucao — execuções legadas continuam válidas.
ALTER TABLE "BpmAutomacaoExecucao" ADD COLUMN "automacaoVersaoId" TEXT REFERENCES "BpmAutomacaoVersao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BpmAutomacaoExecucao" ADD COLUMN "eventoId" TEXT REFERENCES "BpmEventoDominio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BpmAutomacaoExecucao" ADD COLUMN "correlationId" TEXT;
ALTER TABLE "BpmAutomacaoExecucao" ADD COLUMN "causationId" TEXT;
ALTER TABLE "BpmAutomacaoExecucao" ADD COLUMN "claimToken" TEXT;
ALTER TABLE "BpmAutomacaoExecucao" ADD COLUMN "proximaTentativaEm" DATETIME;

CREATE INDEX "BpmAutomacaoExecucao_automacaoVersaoId_idx" ON "BpmAutomacaoExecucao"("automacaoVersaoId");
CREATE INDEX "BpmAutomacaoExecucao_eventoId_idx" ON "BpmAutomacaoExecucao"("eventoId");
CREATE INDEX "BpmAutomacaoExecucao_correlationId_idx" ON "BpmAutomacaoExecucao"("correlationId");
CREATE INDEX "BpmAutomacaoExecucao_claimToken_idx" ON "BpmAutomacaoExecucao"("claimToken");

-- Estado por nó do grafo executado (timeline de passos/branches de uma execução).
CREATE TABLE "BpmAutomacaoPassoExecucao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "execucaoId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "entradaJson" TEXT,
    "resultadoJson" TEXT,
    "mensagemErro" TEXT,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "iniciadoEm" DATETIME,
    "concluidoEm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BpmAutomacaoPassoExecucao_execucaoId_fkey" FOREIGN KEY ("execucaoId") REFERENCES "BpmAutomacaoExecucao" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BpmAutomacaoPassoExecucao_execucaoId_nodeId_key" ON "BpmAutomacaoPassoExecucao"("execucaoId", "nodeId");
CREATE INDEX "BpmAutomacaoPassoExecucao_execucaoId_ordem_idx" ON "BpmAutomacaoPassoExecucao"("execucaoId", "ordem");
CREATE INDEX "BpmAutomacaoPassoExecucao_status_idx" ON "BpmAutomacaoPassoExecucao"("status");

-- Agenda materializada de gatilhos temporais/recorrentes e esperas de branch.
CREATE TABLE "BpmAutomacaoAgenda" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "automacaoVersaoId" TEXT NOT NULL,
    "cardId" TEXT,
    "chaveAgendamento" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "proximaExecucaoEm" DATETIME NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "recorrenciaJson" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimaMaterializacaoEm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BpmAutomacaoAgenda_automacaoVersaoId_fkey" FOREIGN KEY ("automacaoVersaoId") REFERENCES "BpmAutomacaoVersao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BpmAutomacaoAgenda_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "BpmCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BpmAutomacaoAgenda_chaveAgendamento_key" ON "BpmAutomacaoAgenda"("chaveAgendamento");
CREATE INDEX "BpmAutomacaoAgenda_proximaExecucaoEm_ativo_idx" ON "BpmAutomacaoAgenda"("proximaExecucaoEm", "ativo");
CREATE INDEX "BpmAutomacaoAgenda_automacaoVersaoId_idx" ON "BpmAutomacaoAgenda"("automacaoVersaoId");
CREATE INDEX "BpmAutomacaoAgenda_cardId_idx" ON "BpmAutomacaoAgenda"("cardId");

-- Configuração administrativa de endpoint de entrada de webhook. segredoHash nunca guarda
-- o segredo em claro.
CREATE TABLE "BpmWebhookEndpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "pipelineId" TEXT,
    "automacaoId" TEXT,
    "caminhoSlug" TEXT NOT NULL,
    "segredoHash" TEXT NOT NULL,
    "headersEsperadosJson" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoPorId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BpmWebhookEndpoint_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "BpmPipeline" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BpmWebhookEndpoint_automacaoId_fkey" FOREIGN KEY ("automacaoId") REFERENCES "BpmAutomacao" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BpmWebhookEndpoint_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BpmWebhookEndpoint_caminhoSlug_key" ON "BpmWebhookEndpoint"("caminhoSlug");
CREATE INDEX "BpmWebhookEndpoint_pipelineId_idx" ON "BpmWebhookEndpoint"("pipelineId");
CREATE INDEX "BpmWebhookEndpoint_automacaoId_idx" ON "BpmWebhookEndpoint"("automacaoId");
CREATE INDEX "BpmWebhookEndpoint_ativo_idx" ON "BpmWebhookEndpoint"("ativo");

-- Auditoria/deduplicação de cada chamada recebida em um BpmWebhookEndpoint.
-- payloadSanitizadoJson nunca guarda headers de autenticação ou segredos recebidos.
CREATE TABLE "BpmWebhookEntrada" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpointId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "statusRecebimento" TEXT NOT NULL DEFAULT 'RECEBIDO',
    "origemIp" TEXT,
    "payloadSanitizadoJson" TEXT,
    "motivoRejeicao" TEXT,
    "eventoId" TEXT,
    "recebidoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BpmWebhookEntrada_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "BpmWebhookEndpoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmWebhookEntrada_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "BpmEventoDominio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BpmWebhookEntrada_endpointId_idempotencyKey_key" ON "BpmWebhookEntrada"("endpointId", "idempotencyKey");
CREATE INDEX "BpmWebhookEntrada_endpointId_recebidoEm_idx" ON "BpmWebhookEntrada"("endpointId", "recebidoEm");
CREATE INDEX "BpmWebhookEntrada_eventoId_idx" ON "BpmWebhookEntrada"("eventoId");

-- Lock distribuído com fencing token — serializa execução por card/correlation entre
-- instâncias concorrentes do worker. Chave lógica, sem FK: registro efêmero.
CREATE TABLE "BpmAutomacaoLease" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recurso" TEXT NOT NULL,
    "fencingToken" INTEGER NOT NULL DEFAULT 0,
    "titular" TEXT NOT NULL,
    "expiraEm" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "BpmAutomacaoLease_recurso_key" ON "BpmAutomacaoLease"("recurso");
CREATE INDEX "BpmAutomacaoLease_expiraEm_idx" ON "BpmAutomacaoLease"("expiraEm");
