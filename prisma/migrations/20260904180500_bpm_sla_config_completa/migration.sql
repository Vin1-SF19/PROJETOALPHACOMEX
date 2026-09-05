-- RM-2026-095B40 — complemento aditivo da modelagem de SLA.
-- A migration-base já criou BpmSlaConfig/BpmSlaInstancia/BpmSlaDisparo.
-- Este complemento adiciona escopos, políticas, limites configuráveis e trilha de eventos.

ALTER TABLE "BpmSlaConfig" ADD COLUMN "servicoId" INTEGER
  REFERENCES "servicos_comerciais" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BpmSlaConfig" ADD COLUMN "tipoTarefa" TEXT;
ALTER TABLE "BpmSlaConfig" ADD COLUMN "condicaoRegraJson" TEXT;
ALTER TABLE "BpmSlaConfig" ADD COLUMN "pausaCondicaoJson" TEXT;
ALTER TABLE "BpmSlaConfig" ADD COLUMN "retomadaCondicaoJson" TEXT;
ALTER TABLE "BpmSlaConfig" ADD COLUMN "criadoPorId" INTEGER
  REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BpmSlaInstancia" ADD COLUMN "tarefaId" TEXT
  REFERENCES "BpmTarefa" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BpmSlaInstancia" ADD COLUMN "concluidoEm" DATETIME;

CREATE TABLE "BpmSlaAlertaLimite" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "slaConfigId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "cor" TEXT NOT NULL,
  "tipoLimite" TEXT NOT NULL,
  "valor" REAL NOT NULL,
  "unidade" TEXT,
  "statusResultante" TEXT NOT NULL,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BpmSlaAlertaLimite_slaConfigId_fkey"
    FOREIGN KEY ("slaConfigId") REFERENCES "BpmSlaConfig" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BpmSlaEventoLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "instanciaId" TEXT NOT NULL,
  "statusAnterior" TEXT,
  "statusNovo" TEXT NOT NULL,
  "motivo" TEXT,
  "origem" TEXT NOT NULL DEFAULT 'SISTEMA',
  "metadataJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BpmSlaEventoLog_instanciaId_fkey"
    FOREIGN KEY ("instanciaId") REFERENCES "BpmSlaInstancia" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BpmSlaConfig_servicoId_idx" ON "BpmSlaConfig"("servicoId");
CREATE INDEX "BpmSlaConfig_criadoPorId_idx" ON "BpmSlaConfig"("criadoPorId");
CREATE INDEX "BpmSlaInstancia_tarefaId_status_idx" ON "BpmSlaInstancia"("tarefaId", "status");
CREATE INDEX "BpmSlaAlertaLimite_slaConfigId_ativo_ordem_idx"
  ON "BpmSlaAlertaLimite"("slaConfigId", "ativo", "ordem");
CREATE INDEX "BpmSlaEventoLog_instanciaId_createdAt_idx"
  ON "BpmSlaEventoLog"("instanciaId", "createdAt");
CREATE INDEX "BpmSlaEventoLog_statusNovo_createdAt_idx"
  ON "BpmSlaEventoLog"("statusNovo", "createdAt");
