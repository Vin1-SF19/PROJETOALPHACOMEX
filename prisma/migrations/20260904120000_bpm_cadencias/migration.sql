-- RM-2026-97CC60 — Fase 3: modelo de domínio de Cadências (BpmCadencia,
-- BpmCadenciaPasso, BpmCardCadencia, BpmCadenciaPassoExecucao) e vínculo
-- opcional de BpmTarefa com o passo de cadência que a originou.
-- Migration estritamente aditiva: nenhuma tabela/coluna existente é
-- alterada, renomeada ou removida.

-- 1) Definição versionável de cadência (nome, descrição, escopo opcional de
-- pipeline/etapa, estado ativo/inativo, versão e autor).
CREATE TABLE "BpmCadencia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "pipelineId" TEXT,
    "etapaId" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criadoPorId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BpmCadencia_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "BpmPipeline" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BpmCadencia_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "BpmEtapa" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BpmCadencia_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "BpmCadencia_pipelineId_idx" ON "BpmCadencia" ("pipelineId");
CREATE INDEX "BpmCadencia_etapaId_idx" ON "BpmCadencia" ("etapaId");

-- 2) Passos ordenados de uma cadência: intervalo relativo ao passo anterior,
-- tipo/prazo/prioridade/checklist da BpmTarefa que o executor irá gerar.
CREATE TABLE "BpmCadenciaPasso" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cadenciaId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "intervaloDias" INTEGER NOT NULL,
    "tipoTarefa" TEXT NOT NULL DEFAULT 'TAREFA',
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "responsavelId" INTEGER,
    "prazoRelativoDias" INTEGER,
    "alertaAntecedenciaHoras" INTEGER,
    "prioridade" TEXT NOT NULL DEFAULT 'NORMAL',
    "checklistJson" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BpmCadenciaPasso_cadenciaId_fkey" FOREIGN KEY ("cadenciaId") REFERENCES "BpmCadencia" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmCadenciaPasso_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "BpmCadenciaPasso_cadenciaId_idx" ON "BpmCadenciaPasso" ("cadenciaId");
CREATE INDEX "BpmCadenciaPasso_cadenciaId_ordem_idx" ON "BpmCadenciaPasso" ("cadenciaId", "ordem");

-- 3) Vínculo entre um card e uma cadência (no máximo um vínculo por par),
-- com estado, passo atual e próxima execução calculada pelo executor.
CREATE TABLE "BpmCardCadencia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "cadenciaId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVA',
    "passoAtualOrdem" INTEGER NOT NULL DEFAULT 1,
    "proximaExecucaoEm" DATETIME,
    "iniciadaEm" DATETIME,
    "concluidaEm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BpmCardCadencia_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "BpmCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmCardCadencia_cadenciaId_fkey" FOREIGN KEY ("cadenciaId") REFERENCES "BpmCadencia" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BpmCardCadencia_cardId_cadenciaId_key" ON "BpmCardCadencia" ("cardId", "cadenciaId");
CREATE INDEX "BpmCardCadencia_status_idx" ON "BpmCardCadencia" ("status");
CREATE INDEX "BpmCardCadencia_proximaExecucaoEm_idx" ON "BpmCardCadencia" ("proximaExecucaoEm");

-- 4) Execução idempotente de um passo para um vínculo — a constraint única
-- (vinculoId, passoId, chaveEvento) é a chave de idempotência que impede
-- processamento duplicado do mesmo passo/ciclo por corridas do cron/worker.
CREATE TABLE "BpmCadenciaPassoExecucao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vinculoId" TEXT NOT NULL,
    "passoId" TEXT NOT NULL,
    "chaveEvento" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "disponivelEm" DATETIME,
    "erro" TEXT,
    "executadaEm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BpmCadenciaPassoExecucao_vinculoId_fkey" FOREIGN KEY ("vinculoId") REFERENCES "BpmCardCadencia" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmCadenciaPassoExecucao_passoId_fkey" FOREIGN KEY ("passoId") REFERENCES "BpmCadenciaPasso" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BpmCadenciaPassoExecucao_vinculoId_passoId_chaveEvento_key" ON "BpmCadenciaPassoExecucao" ("vinculoId", "passoId", "chaveEvento");
CREATE INDEX "BpmCadenciaPassoExecucao_status_disponivelEm_idx" ON "BpmCadenciaPassoExecucao" ("status", "disponivelEm");

-- 5) BpmTarefa: vínculo opcional com a execução de cadência que originou a
-- tarefa. Coluna nova, nullable, sem default — tarefas existentes e tarefas
-- manuais futuras permanecem com cadenciaExecucaoId = NULL.
ALTER TABLE "BpmTarefa" ADD COLUMN "cadenciaExecucaoId" TEXT REFERENCES "BpmCadenciaPassoExecucao" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "BpmTarefa_cadenciaExecucaoId_idx" ON "BpmTarefa" ("cadenciaExecucaoId");
