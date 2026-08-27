-- Agenda Alpha: vínculo local e horários de tarefas de chamados.
-- Migration exclusivamente aditiva; não há DROP, ALTER, backfill ou DML.

CREATE TABLE "GoogleCalendarTaskSchedule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "chamadoId" INTEGER NOT NULL,
  "tarefaCacheId" TEXT NOT NULL,
  "usuarioAgendaId" INTEGER NOT NULL,
  "inicioEm" DATETIME NOT NULL,
  "fimPlanejadoEm" DATETIME NOT NULL,
  "fimConcluidoEm" DATETIME,
  "status" TEXT NOT NULL DEFAULT 'EM_ATENDIMENTO',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "GoogleCalendarTaskSchedule_chamadoId_fkey"
    FOREIGN KEY ("chamadoId") REFERENCES "chamados" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GoogleCalendarTaskSchedule_tarefaCacheId_fkey"
    FOREIGN KEY ("tarefaCacheId") REFERENCES "GoogleCalendarTaskCache" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "GoogleCalendarTaskSchedule_chamadoId_key"
ON "GoogleCalendarTaskSchedule" ("chamadoId");

CREATE UNIQUE INDEX "GoogleCalendarTaskSchedule_tarefaCacheId_key"
ON "GoogleCalendarTaskSchedule" ("tarefaCacheId");

CREATE INDEX "GoogleCalendarTaskSchedule_usuarioAgendaId_status_inicioEm_idx"
ON "GoogleCalendarTaskSchedule" ("usuarioAgendaId", "status", "inicioEm");
