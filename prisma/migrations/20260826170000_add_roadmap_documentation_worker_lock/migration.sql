-- Roadmap Documentation Worker Lock: migration 100% aditiva.
-- Lock global singleton para garantir processamento estritamente sequencial
-- da fila de documentação (no máximo 1 objetivo em DOCUMENTING por vez).
CREATE TABLE "RoadmapDocumentationWorkerLock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claimedBy" TEXT,
    "claimedAt" DATETIME,
    "claimExpiresAt" DATETIME,
    "heartbeatAt" DATETIME,
    "claimToken" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
