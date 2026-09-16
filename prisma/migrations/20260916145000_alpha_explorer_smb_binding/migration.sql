-- Alpha Explorer SMB: metadados não secretos do vínculo usuário ↔ principal QNAP.
-- A senha permanece exclusivamente no Vault; secretRef é uma referência opaca.
-- Migration estritamente aditiva: sem DROP, ALTER, seed ou backfill.

CREATE TABLE "AlphaExplorerSmbBinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "qnapPrincipal" TEXT NOT NULL,
    "qnapPrincipalKey" TEXT NOT NULL,
    "secretRef" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "credentialVersion" INTEGER NOT NULL DEFAULT 0,
    "lastValidatedAt" DATETIME,
    "lastRotatedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdById" INTEGER NOT NULL,
    "updatedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaExplorerSmbBinding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AlphaExplorerSmbBinding_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AlphaExplorerSmbBinding_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AlphaExplorerSmbBinding_userId_key" ON "AlphaExplorerSmbBinding"("userId");
CREATE UNIQUE INDEX "AlphaExplorerSmbBinding_qnapPrincipalKey_key" ON "AlphaExplorerSmbBinding"("qnapPrincipalKey");
CREATE UNIQUE INDEX "AlphaExplorerSmbBinding_secretRef_key" ON "AlphaExplorerSmbBinding"("secretRef");
CREATE INDEX "AlphaExplorerSmbBinding_status_updatedAt_idx" ON "AlphaExplorerSmbBinding"("status", "updatedAt");
CREATE INDEX "AlphaExplorerSmbBinding_createdById_idx" ON "AlphaExplorerSmbBinding"("createdById");
CREATE INDEX "AlphaExplorerSmbBinding_updatedById_idx" ON "AlphaExplorerSmbBinding"("updatedById");
