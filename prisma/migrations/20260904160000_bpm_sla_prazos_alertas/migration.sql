-- RM-2026-095B40 — 5. Gestão de Prazos, SLA e Alertas (Fase: Modelagem).
-- Migration estritamente aditiva: cria somente tabelas e índices novos.
-- Nenhuma coluna existente é removida/renomeada/alterada; nenhum dado atual é tocado.

CREATE TABLE "BpmSlaConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pipelineId" TEXT NOT NULL,
    "etapaId" TEXT,
    "servico" TEXT,
    "tipoProcesso" TEXT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "quantidade" INTEGER NOT NULL,
    "unidade" TEXT NOT NULL DEFAULT 'DIAS',
    "inicioMomento" TEXT NOT NULL DEFAULT 'CARD_CRIADO',
    "antecedenciaDisparo" REAL NOT NULL DEFAULT 0.5,
    "suspendeAutomacaoAoVencer" BOOLEAN NOT NULL DEFAULT true,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "prioridade" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BpmSlaConfig_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "BpmPipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmSlaConfig_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "BpmEtapa" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "BpmSlaInstancia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "slaConfigId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AGUARDANDO_INICIO',
    "iniciadoEm" DATETIME,
    "deadline" DATETIME,
    "pausadoEm" DATETIME,
    "pausadosAcumuladosSegundos" INTEGER NOT NULL DEFAULT 0,
    "alertaPrazoEm" DATETIME,
    "alertaPrazoDisparadoEm" DATETIME,
    "vencidoEm" DATETIME,
    "statusAnterior" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BpmSlaInstancia_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "BpmCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmSlaInstancia_slaConfigId_fkey" FOREIGN KEY ("slaConfigId") REFERENCES "BpmSlaConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BpmSlaDisparo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instanciaId" TEXT NOT NULL,
    "slaConfigId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "tipoDisparo" TEXT NOT NULL,
    "disparadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BpmSlaDisparo_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "BpmSlaInstancia" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmSlaDisparo_slaConfigId_fkey" FOREIGN KEY ("slaConfigId") REFERENCES "BpmSlaConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmSlaDisparo_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "BpmCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BpmSlaConfig_pipelineId_ativa_idx" ON "BpmSlaConfig"("pipelineId", "ativa");

CREATE INDEX "BpmSlaConfig_pipelineId_etapaId_idx" ON "BpmSlaConfig"("pipelineId", "etapaId");

CREATE INDEX "BpmSlaConfig_prioridade_ativa_idx" ON "BpmSlaConfig"("prioridade", "ativa");

CREATE UNIQUE INDEX "BpmSlaInstancia_cardId_slaConfigId_key" ON "BpmSlaInstancia"("cardId", "slaConfigId");

CREATE INDEX "BpmSlaInstancia_cardId_status_idx" ON "BpmSlaInstancia"("cardId", "status");

CREATE INDEX "BpmSlaInstancia_deadline_status_idx" ON "BpmSlaInstancia"("deadline", "status");

CREATE INDEX "BpmSlaInstancia_alertaPrazoEm_status_alertaPrazoDisparadoEm_idx" ON "BpmSlaInstancia"("alertaPrazoEm", "status", "alertaPrazoDisparadoEm");

CREATE UNIQUE INDEX "BpmSlaDisparo_instanciaId_tipoDisparo_key" ON "BpmSlaDisparo"("instanciaId", "tipoDisparo");

CREATE INDEX "BpmSlaDisparo_cardId_tipoDisparo_idx" ON "BpmSlaDisparo"("cardId", "tipoDisparo");
