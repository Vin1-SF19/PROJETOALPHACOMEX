-- Roadmap Alpha: migration 100% aditiva aprovada em 2026-08-15.
CREATE TABLE "RoadmapObjective" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "moduleLabelSnapshot" TEXT NOT NULL,
    "moduleCategorySnapshot" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "desiredOutcome" TEXT,
    "constraints" TEXT,
    "acceptanceCriteriaJson" TEXT NOT NULL,
    "globalPriority" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "documentationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "sourceVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" INTEGER NOT NULL,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoadmapObjective_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "RoadmapDocumentationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "objectiveId" TEXT NOT NULL,
    "sourceVersion" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "prioritySnapshot" INTEGER NOT NULL,
    "availableAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "claimedBy" TEXT,
    "claimedAt" DATETIME,
    "claimExpiresAt" DATETIME,
    "heartbeatAt" DATETIME,
    "claimToken" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "completedAt" DATETIME,
    "deadLetteredAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoadmapDocumentationJob_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "RoadmapObjective" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "RoadmapDocumentationAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "durationMs" INTEGER,
    "httpStatus" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "responseSha256" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoadmapDocumentationAttempt_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "RoadmapDocumentationJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "RoadmapPromptArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "objectiveId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "attemptId" TEXT,
    "documentationVersion" INTEGER NOT NULL,
    "phaseNumber" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "dependsOnJson" TEXT NOT NULL,
    "contentMarkdown" TEXT NOT NULL,
    "relativePath" TEXT,
    "sha256" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoadmapPromptArtifact_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "RoadmapObjective" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoadmapPromptArtifact_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "RoadmapDocumentationJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoadmapPromptArtifact_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "RoadmapDocumentationAttempt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RoadmapObjective_code_key" ON "RoadmapObjective"("code");
CREATE UNIQUE INDEX "RoadmapObjective_globalPriority_key" ON "RoadmapObjective"("globalPriority");
CREATE INDEX "RoadmapObjective_archivedAt_globalPriority_createdAt_id_idx" ON "RoadmapObjective"("archivedAt", "globalPriority", "createdAt", "id");
CREATE INDEX "RoadmapObjective_moduleKey_archivedAt_globalPriority_createdAt_id_idx" ON "RoadmapObjective"("moduleKey", "archivedAt", "globalPriority", "createdAt", "id");
CREATE INDEX "RoadmapObjective_documentationStatus_globalPriority_createdAt_id_idx" ON "RoadmapObjective"("documentationStatus", "globalPriority", "createdAt", "id");
CREATE UNIQUE INDEX "RoadmapDocumentationJob_idempotencyKey_key" ON "RoadmapDocumentationJob"("idempotencyKey");
CREATE INDEX "RoadmapDocumentationJob_status_availableAt_prioritySnapshot_createdAt_id_idx" ON "RoadmapDocumentationJob"("status", "availableAt", "prioritySnapshot", "createdAt", "id");
CREATE INDEX "RoadmapDocumentationJob_status_claimExpiresAt_idx" ON "RoadmapDocumentationJob"("status", "claimExpiresAt");
CREATE INDEX "RoadmapDocumentationJob_objectiveId_status_idx" ON "RoadmapDocumentationJob"("objectiveId", "status");
CREATE UNIQUE INDEX "RoadmapDocumentationJob_objectiveId_sourceVersion_key" ON "RoadmapDocumentationJob"("objectiveId", "sourceVersion");
CREATE INDEX "RoadmapDocumentationAttempt_jobId_status_idx" ON "RoadmapDocumentationAttempt"("jobId", "status");
CREATE UNIQUE INDEX "RoadmapDocumentationAttempt_jobId_attemptNumber_key" ON "RoadmapDocumentationAttempt"("jobId", "attemptNumber");
CREATE INDEX "RoadmapPromptArtifact_jobId_phaseNumber_idx" ON "RoadmapPromptArtifact"("jobId", "phaseNumber");
CREATE INDEX "RoadmapPromptArtifact_attemptId_idx" ON "RoadmapPromptArtifact"("attemptId");
CREATE INDEX "RoadmapPromptArtifact_objectiveId_status_idx" ON "RoadmapPromptArtifact"("objectiveId", "status");
CREATE UNIQUE INDEX "RoadmapPromptArtifact_objectiveId_documentationVersion_phaseNumber_key" ON "RoadmapPromptArtifact"("objectiveId", "documentationVersion", "phaseNumber");
