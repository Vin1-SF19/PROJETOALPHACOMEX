-- RM-2026-095B40 — contrato definitivo de SLA.
-- Autorização explícita: recriar somente as cinco tabelas SLA, confirmadas vazias.

DROP TABLE "BpmSlaEventoLog";
DROP TABLE "BpmSlaDisparo";
DROP TABLE "BpmSlaAlertaLimite";
DROP TABLE "BpmSlaInstancia";
DROP TABLE "BpmSlaConfig";

CREATE TABLE "BpmSlaConfig" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "pipelineId" TEXT,
  "etapaId" TEXT,
  "servicoId" INTEGER,
  "tipoProcesso" TEXT,
  "tipoTarefa" TEXT,
  "condicaoRegraJson" TEXT,
  "pausaCondicaoJson" TEXT,
  "retomadaCondicaoJson" TEXT,
  "criadoPorId" INTEGER,
  "nome" TEXT NOT NULL,
  "descricao" TEXT,
  "quantidade" INTEGER NOT NULL CHECK ("quantidade" > 0),
  "unidade" TEXT NOT NULL DEFAULT 'DIAS'
    CHECK ("unidade" IN ('MINUTOS', 'HORAS', 'DIAS', 'DIAS_UTEIS')),
  "inicioMomento" TEXT NOT NULL DEFAULT 'CRIACAO_CARD'
    CHECK ("inicioMomento" IN ('CRIACAO_CARD', 'ENTRADA_ETAPA', 'CRIACAO_TAREFA', 'PRIMEIRA_VISUALIZACAO', 'TAREFA_CONCLUIDA', 'MANUAL', 'CUSTOM')),
  "suspendeAutomacaoAoVencer" BOOLEAN NOT NULL DEFAULT true,
  "ativa" BOOLEAN NOT NULL DEFAULT true,
  "prioridade" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BpmSlaConfig_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "BpmPipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BpmSlaConfig_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "BpmEtapa" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "BpmSlaConfig_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "servicos_comerciais" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "BpmSlaConfig_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "BpmSlaAlertaLimite" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "slaConfigId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "cor" TEXT NOT NULL,
  "tipoLimite" TEXT NOT NULL
    CHECK ("tipoLimite" IN ('PERCENTUAL_CONSUMIDO', 'TEMPO_RESTANTE', 'ATRASO')),
  "valor" REAL NOT NULL CHECK ("valor" >= 0),
  "unidade" TEXT CHECK ("unidade" IS NULL OR "unidade" IN ('MINUTOS', 'HORAS', 'DIAS', 'DIAS_UTEIS')),
  "statusResultante" TEXT NOT NULL
    CHECK ("statusResultante" IN ('AGUARDANDO_INICIO', 'DENTRO_PRAZO', 'PROXIMO_VENCIMENTO', 'ATRASADO', 'PAUSADO', 'CONCLUIDO', 'CANCELADO')),
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BpmSlaAlertaLimite_slaConfigId_fkey" FOREIGN KEY ("slaConfigId") REFERENCES "BpmSlaConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BpmSlaInstancia" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cardId" TEXT,
  "tarefaId" TEXT,
  "slaConfigId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'AGUARDANDO_INICIO'
    CHECK ("status" IN ('AGUARDANDO_INICIO', 'DENTRO_PRAZO', 'PROXIMO_VENCIMENTO', 'ATRASADO', 'PAUSADO', 'CONCLUIDO', 'CANCELADO')),
  "inicioContagem" DATETIME,
  "prazoFinal" DATETIME,
  "deadline" DATETIME,
  "pausadoEm" DATETIME,
  "tempoPausadoAcumuladoMs" INTEGER NOT NULL DEFAULT 0 CHECK ("tempoPausadoAcumuladoMs" >= 0),
  "alertaPrazoEm" DATETIME,
  "alertaPrazoDisparadoEm" DATETIME,
  "vencidoEm" DATETIME,
  "concluidoEm" DATETIME,
  "statusAnterior" TEXT
    CHECK ("statusAnterior" IS NULL OR "statusAnterior" IN ('AGUARDANDO_INICIO', 'DENTRO_PRAZO', 'PROXIMO_VENCIMENTO', 'ATRASADO', 'PAUSADO', 'CONCLUIDO', 'CANCELADO')),
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BpmSlaInstancia_alvo_check" CHECK ("cardId" IS NOT NULL OR "tarefaId" IS NOT NULL),
  CONSTRAINT "BpmSlaInstancia_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "BpmCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BpmSlaInstancia_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "BpmTarefa" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BpmSlaInstancia_slaConfigId_fkey" FOREIGN KEY ("slaConfigId") REFERENCES "BpmSlaConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BpmSlaDisparo" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "instanciaId" TEXT NOT NULL,
  "slaConfigId" TEXT NOT NULL,
  "cardId" TEXT,
  "tipoDisparo" TEXT NOT NULL,
  "disparadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BpmSlaDisparo_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "BpmSlaInstancia" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BpmSlaDisparo_slaConfigId_fkey" FOREIGN KEY ("slaConfigId") REFERENCES "BpmSlaConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BpmSlaDisparo_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "BpmCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BpmSlaEventoLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "instanciaId" TEXT NOT NULL,
  "statusAnterior" TEXT
    CHECK ("statusAnterior" IS NULL OR "statusAnterior" IN ('AGUARDANDO_INICIO', 'DENTRO_PRAZO', 'PROXIMO_VENCIMENTO', 'ATRASADO', 'PAUSADO', 'CONCLUIDO', 'CANCELADO')),
  "statusNovo" TEXT NOT NULL
    CHECK ("statusNovo" IN ('AGUARDANDO_INICIO', 'DENTRO_PRAZO', 'PROXIMO_VENCIMENTO', 'ATRASADO', 'PAUSADO', 'CONCLUIDO', 'CANCELADO')),
  "motivo" TEXT,
  "origem" TEXT NOT NULL DEFAULT 'SISTEMA',
  "metadataJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BpmSlaEventoLog_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "BpmSlaInstancia" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BpmSlaConfig_pipelineId_ativa_idx" ON "BpmSlaConfig"("pipelineId", "ativa");
CREATE INDEX "BpmSlaConfig_pipelineId_etapaId_idx" ON "BpmSlaConfig"("pipelineId", "etapaId");
CREATE INDEX "BpmSlaConfig_servicoId_idx" ON "BpmSlaConfig"("servicoId");
CREATE INDEX "BpmSlaConfig_criadoPorId_idx" ON "BpmSlaConfig"("criadoPorId");
CREATE INDEX "BpmSlaConfig_prioridade_ativa_idx" ON "BpmSlaConfig"("prioridade", "ativa");
CREATE INDEX "BpmSlaAlertaLimite_slaConfigId_ativo_ordem_idx" ON "BpmSlaAlertaLimite"("slaConfigId", "ativo", "ordem");
CREATE UNIQUE INDEX "BpmSlaInstancia_card_config_key" ON "BpmSlaInstancia"("cardId", "slaConfigId") WHERE "tarefaId" IS NULL;
CREATE UNIQUE INDEX "BpmSlaInstancia_tarefa_config_key" ON "BpmSlaInstancia"("tarefaId", "slaConfigId") WHERE "tarefaId" IS NOT NULL;
CREATE INDEX "BpmSlaInstancia_cardId_status_idx" ON "BpmSlaInstancia"("cardId", "status");
CREATE INDEX "BpmSlaInstancia_tarefaId_status_idx" ON "BpmSlaInstancia"("tarefaId", "status");
CREATE INDEX "BpmSlaInstancia_prazoFinal_status_idx" ON "BpmSlaInstancia"("prazoFinal", "status");
CREATE INDEX "BpmSlaInstancia_deadline_status_idx" ON "BpmSlaInstancia"("deadline", "status");
CREATE INDEX "BpmSlaInstancia_alertaPrazoEm_status_alertaPrazoDisparadoEm_idx" ON "BpmSlaInstancia"("alertaPrazoEm", "status", "alertaPrazoDisparadoEm");
CREATE UNIQUE INDEX "BpmSlaDisparo_instanciaId_tipoDisparo_key" ON "BpmSlaDisparo"("instanciaId", "tipoDisparo");
CREATE INDEX "BpmSlaDisparo_cardId_tipoDisparo_idx" ON "BpmSlaDisparo"("cardId", "tipoDisparo");
CREATE INDEX "BpmSlaEventoLog_instanciaId_createdAt_idx" ON "BpmSlaEventoLog"("instanciaId", "createdAt");
CREATE INDEX "BpmSlaEventoLog_statusNovo_createdAt_idx" ON "BpmSlaEventoLog"("statusNovo", "createdAt");
