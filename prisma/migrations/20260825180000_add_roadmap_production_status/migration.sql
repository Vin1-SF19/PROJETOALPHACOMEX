-- Roadmap Production (novo motor de status manual): migration 100% aditiva.
-- Substitui o estado do motor de produção antigo (arquivos JSON) por 3
-- tabelas novas. Não faz DROP/ALTER em nenhuma tabela existente.
CREATE TABLE "RoadmapProductionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "objectiveId" TEXT NOT NULL,
    "sourceVersion" INTEGER NOT NULL,
    "phaseNumber" INTEGER NOT NULL,
    "artifactId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "assignee" TEXT NOT NULL DEFAULT 'claude',
    "approvedById" INTEGER,
    "approvedAt" DATETIME,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "resultSummary" TEXT,
    "errorCode" TEXT,
    "changedFilesJson" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoadmapProductionRun_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "RoadmapObjective" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoadmapProductionRun_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "RoadmapPromptArtifact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RoadmapProductionRun_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RoadmapProductionRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "RoadmapProductionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "content" TEXT,
    "authorKind" TEXT NOT NULL,
    "authorLabel" TEXT NOT NULL,
    "authorUserId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoadmapProductionEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RoadmapProductionRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoadmapProductionEvent_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "RoadmapApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "scopesJson" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" INTEGER NOT NULL,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "rateLimitWindowMs" INTEGER NOT NULL DEFAULT 60000,
    "rateLimitMax" INTEGER NOT NULL DEFAULT 120,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "lastRequestAt" DATETIME,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoadmapApiKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RoadmapProductionRun_objectiveId_sourceVersion_phaseNumber_key" ON "RoadmapProductionRun"("objectiveId", "sourceVersion", "phaseNumber");
CREATE INDEX "RoadmapProductionRun_status_updatedAt_id_idx" ON "RoadmapProductionRun"("status", "updatedAt", "id");
CREATE INDEX "RoadmapProductionRun_objectiveId_status_idx" ON "RoadmapProductionRun"("objectiveId", "status");
CREATE INDEX "RoadmapProductionEvent_runId_createdAt_id_idx" ON "RoadmapProductionEvent"("runId", "createdAt", "id");
CREATE UNIQUE INDEX "RoadmapApiKey_keyHash_key" ON "RoadmapApiKey"("keyHash");
CREATE INDEX "RoadmapApiKey_enabled_revokedAt_idx" ON "RoadmapApiKey"("enabled", "revokedAt");
