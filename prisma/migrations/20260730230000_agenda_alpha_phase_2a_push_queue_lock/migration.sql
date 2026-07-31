-- Scope: Agenda Alpha Phase 2A only.
-- Structures: 3 tables, 7 explicit indexes, 3 unique indexes (10 total).

PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;

CREATE TABLE IF NOT EXISTS "GoogleCalendarPushChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "calendarioId" TEXT NOT NULL,
    "googleChannelId" TEXT NOT NULL,
    "googleResourceId" TEXT,
    "resourceUri" TEXT,
    "channelTokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATING'
        CHECK ("status" IN ('CREATING', 'ACTIVE', 'STOPPING', 'STOPPED', 'EXPIRED', 'ERROR')),
    "expiresAt" DATETIME NOT NULL,
    "renewAfter" DATETIME NOT NULL,
    "activatedAt" DATETIME,
    "stoppedAt" DATETIME,
    "lastMessageNumber" TEXT,
    "lastNotificationAt" DATETIME,
    "lastErrorCode" TEXT,
    "lastErrorAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GoogleCalendarPushChannel_calendarioId_fkey"
        FOREIGN KEY ("calendarioId")
        REFERENCES "GoogleCalendarSelecionado" ("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "GoogleCalendarPendingOperation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "calendarioId" TEXT NOT NULL,
    "pushChannelId" TEXT,
    "operationType" TEXT NOT NULL
        CHECK ("operationType" IN ('SYNC_CALENDAR', 'RENEW_CHANNEL', 'STOP_CHANNEL', 'RECONCILE_CHANNEL')),
    "source" TEXT NOT NULL
        CHECK ("source" IN ('WEBHOOK', 'MANUAL', 'SCHEDULED', 'ADMIN')),
    "idempotencyKey" TEXT NOT NULL,
    "payloadJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING'
        CHECK ("status" IN ('PENDING', 'PROCESSING', 'RETRY', 'SUCCEEDED', 'DEAD_LETTER', 'CANCELLED')),
    "priority" INTEGER NOT NULL DEFAULT 100,
    "attemptCount" INTEGER NOT NULL DEFAULT 0
        CHECK ("attemptCount" >= 0),
    "maxAttempts" INTEGER NOT NULL DEFAULT 8
        CHECK ("maxAttempts" > 0),
    "availableAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedBy" TEXT,
    "claimedAt" DATETIME,
    "claimExpiresAt" DATETIME,
    "claimToken" INTEGER NOT NULL DEFAULT 0
        CHECK ("claimToken" >= 0),
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "completedAt" DATETIME,
    "deadLetteredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GoogleCalendarPendingOperation_calendarioId_fkey"
        FOREIGN KEY ("calendarioId")
        REFERENCES "GoogleCalendarSelecionado" ("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT "GoogleCalendarPendingOperation_pushChannelId_fkey"
        FOREIGN KEY ("pushChannelId")
        REFERENCES "GoogleCalendarPushChannel" ("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "GoogleCalendarSyncLease" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "calendarioId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "fencingToken" INTEGER NOT NULL DEFAULT 1
        CHECK ("fencingToken" > 0),
    "leaseExpiresAt" DATETIME NOT NULL,
    "heartbeatAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GoogleCalendarSyncLease_calendarioId_fkey"
        FOREIGN KEY ("calendarioId")
        REFERENCES "GoogleCalendarSelecionado" ("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "GoogleCalendarPushChannel_googleChannelId_key"
    ON "GoogleCalendarPushChannel" ("googleChannelId");
CREATE INDEX IF NOT EXISTS "GoogleCalendarPushChannel_status_renewAfter_idx"
    ON "GoogleCalendarPushChannel" ("status", "renewAfter");
CREATE INDEX IF NOT EXISTS "GoogleCalendarPushChannel_calendarioId_status_expiresAt_idx"
    ON "GoogleCalendarPushChannel" ("calendarioId", "status", "expiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "GoogleCalendarPendingOperation_idempotencyKey_key"
    ON "GoogleCalendarPendingOperation" ("idempotencyKey");
CREATE INDEX IF NOT EXISTS "GoogleCalendarPendingOperation_status_availableAt_priority_createdAt_idx"
    ON "GoogleCalendarPendingOperation" ("status", "availableAt", "priority", "createdAt");
CREATE INDEX IF NOT EXISTS "GoogleCalendarPendingOperation_status_claimExpiresAt_idx"
    ON "GoogleCalendarPendingOperation" ("status", "claimExpiresAt");
CREATE INDEX IF NOT EXISTS "GoogleCalendarPendingOperation_calendarioId_operationType_status_idx"
    ON "GoogleCalendarPendingOperation" ("calendarioId", "operationType", "status");
CREATE INDEX IF NOT EXISTS "GoogleCalendarPendingOperation_pushChannelId_idx"
    ON "GoogleCalendarPendingOperation" ("pushChannelId");

CREATE UNIQUE INDEX IF NOT EXISTS "GoogleCalendarSyncLease_calendarioId_key"
    ON "GoogleCalendarSyncLease" ("calendarioId");
CREATE INDEX IF NOT EXISTS "GoogleCalendarSyncLease_leaseExpiresAt_idx"
    ON "GoogleCalendarSyncLease" ("leaseExpiresAt");

COMMIT;
