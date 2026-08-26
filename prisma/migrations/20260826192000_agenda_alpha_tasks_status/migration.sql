-- Agenda Alpha: cache de Google Tasks e tipos especiais de evento.
-- Migration 100% aditiva; não há DROP, renomeação, backfill ou DML.

ALTER TABLE "GoogleCalendarEventoCache" ADD COLUMN "eventType" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "GoogleCalendarEventoCache" ADD COLUMN "statusPropertiesJson" TEXT;

CREATE INDEX "GoogleCalendarEventoCache_calendarioId_eventType_inicioEm_idx"
ON "GoogleCalendarEventoCache" ("calendarioId", "eventType", "inicioEm");

CREATE TABLE "GoogleCalendarTaskListCache" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conexaoId" TEXT NOT NULL,
  "googleTaskListId" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "ultimaSincronizacaoEm" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "GoogleCalendarTaskListCache_conexaoId_fkey"
    FOREIGN KEY ("conexaoId") REFERENCES "GoogleCalendarConexao" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "GoogleCalendarTaskListCache_conexaoId_googleTaskListId_key"
ON "GoogleCalendarTaskListCache" ("conexaoId", "googleTaskListId");
CREATE INDEX "GoogleCalendarTaskListCache_conexaoId_ultimaSincronizacaoEm_idx"
ON "GoogleCalendarTaskListCache" ("conexaoId", "ultimaSincronizacaoEm");

CREATE TABLE "GoogleCalendarTaskCache" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "taskListId" TEXT NOT NULL,
  "googleTaskId" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "notas" TEXT,
  "status" TEXT NOT NULL,
  "vencimentoEm" DATETIME,
  "concluidaEm" DATETIME,
  "excluida" BOOLEAN NOT NULL DEFAULT false,
  "oculta" BOOLEAN NOT NULL DEFAULT false,
  "parentGoogleTaskId" TEXT,
  "posicao" TEXT,
  "atualizadoGoogleEm" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "GoogleCalendarTaskCache_taskListId_fkey"
    FOREIGN KEY ("taskListId") REFERENCES "GoogleCalendarTaskListCache" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "GoogleCalendarTaskCache_taskListId_googleTaskId_key"
ON "GoogleCalendarTaskCache" ("taskListId", "googleTaskId");
CREATE INDEX "GoogleCalendarTaskCache_taskListId_status_vencimentoEm_idx"
ON "GoogleCalendarTaskCache" ("taskListId", "status", "vencimentoEm");
CREATE INDEX "GoogleCalendarTaskCache_taskListId_atualizadoGoogleEm_idx"
ON "GoogleCalendarTaskCache" ("taskListId", "atualizadoGoogleEm");
