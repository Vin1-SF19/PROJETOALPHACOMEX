-- RM-2026-8B7DC7 — Tarefas de Parceiros (manual + geração automática por alerta).
-- Migration 100% aditiva: 1 CREATE TABLE + 3 CREATE INDEX + 1 ADD COLUMN.

CREATE TABLE "parceiro_tarefa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parceiroId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "responsavelId" INTEGER,
    "prazo" DATETIME,
    "prioridade" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "origemAutomatica" BOOLEAN NOT NULL DEFAULT false,
    "alertaOrigemTipo" TEXT,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "concluidaEm" DATETIME,
    CONSTRAINT "parceiro_tarefa_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES "parceiros" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "parceiro_tarefa_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "parceiro_tarefa_parceiroId_idx" ON "parceiro_tarefa" ("parceiroId");
CREATE INDEX "parceiro_tarefa_status_idx" ON "parceiro_tarefa" ("status");
CREATE INDEX "parceiro_tarefa_responsavelId_idx" ON "parceiro_tarefa" ("responsavelId");

ALTER TABLE "parceiro_config" ADD COLUMN "gerarTarefaAutomaticaAlertas" BOOLEAN NOT NULL DEFAULT false;
