-- CreateTable
CREATE TABLE "AlphaSeoProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "normalizedDomain" TEXT,
    "locationCode" INTEGER NOT NULL DEFAULT 2840,
    "locationName" TEXT,
    "languageCode" TEXT NOT NULL DEFAULT 'pt',
    "market" TEXT NOT NULL DEFAULT 'BR',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaSeoProject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoProjectMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaSeoProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoProjectInvitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "tokenHash" TEXT NOT NULL,
    "inviterId" INTEGER NOT NULL,
    "acceptedById" INTEGER,
    "expiresAt" DATETIME NOT NULL,
    "acceptedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaSeoProjectInvitation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoProjectInvitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoProjectInvitation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoUserOnboarding" (
    "userId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "activeProjectId" TEXT,
    "interestedFeatures" JSONB NOT NULL,
    "workFor" TEXT,
    "clientWebsiteCount" TEXT,
    "foundVia" TEXT,
    "mcpSetupIntent" TEXT,
    "completedAt" DATETIME,
    "gscNudgeDismissedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaSeoUserOnboarding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoUserOnboarding_activeProjectId_fkey" FOREIGN KEY ("activeProjectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoUserActivation" (
    "userId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "firstMcpAuthorizedAt" DATETIME,
    "firstMcpToolCallAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaSeoUserActivation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoProjectActivation" (
    "projectId" TEXT NOT NULL PRIMARY KEY,
    "competitorStepClickedAt" DATETIME,
    "mcpCardDismissedAt" DATETIME,
    "ga4CardDismissedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaSeoProjectActivation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoKeywordResearchRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "requestedById" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "locationCode" INTEGER NOT NULL,
    "languageCode" TEXT NOT NULL,
    "includeClickstream" BOOLEAN NOT NULL DEFAULT false,
    "seeds" JSONB NOT NULL,
    "request" JSONB NOT NULL,
    "requestHash" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "partialResult" JSONB,
    "errorCode" TEXT,
    "estimatedUnits" INTEGER NOT NULL DEFAULT 0,
    "estimatedMicrosUsd" INTEGER NOT NULL DEFAULT 0,
    "actualUnits" INTEGER,
    "actualMicrosUsd" INTEGER,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlphaSeoKeywordResearchRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoKeywordResearchRun_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoSavedKeyword" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "locationCode" INTEGER NOT NULL DEFAULT 2840,
    "languageCode" TEXT NOT NULL DEFAULT 'pt',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlphaSeoSavedKeyword_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoSavedKeywordTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlphaSeoSavedKeywordTag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoSavedKeywordTagAssignment" (
    "savedKeywordId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("savedKeywordId", "tagId"),
    CONSTRAINT "AlphaSeoSavedKeywordTagAssignment_savedKeywordId_fkey" FOREIGN KEY ("savedKeywordId") REFERENCES "AlphaSeoSavedKeyword" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoSavedKeywordTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "AlphaSeoSavedKeywordTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoKeywordMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "normalizedKeyword" TEXT NOT NULL,
    "locationCode" INTEGER NOT NULL,
    "languageCode" TEXT NOT NULL,
    "searchVolume" INTEGER,
    "cpcMicros" INTEGER,
    "competition" REAL,
    "keywordDifficulty" INTEGER,
    "intent" TEXT,
    "monthlySearches" JSONB,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlphaSeoKeywordMetric_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoRankConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "normalizedDomain" TEXT NOT NULL,
    "locationCode" INTEGER NOT NULL DEFAULT 2840,
    "locationName" TEXT,
    "languageCode" TEXT NOT NULL DEFAULT 'pt',
    "devices" TEXT NOT NULL DEFAULT 'BOTH',
    "serpDepth" INTEGER NOT NULL,
    "scheduleInterval" TEXT NOT NULL DEFAULT 'WEEKLY',
    "scheduleAnchorAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" DATETIME,
    "nextCheckAt" DATETIME,
    "lastSkipReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaSeoRankConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoRankKeyword" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "normalizedKeyword" TEXT NOT NULL,
    "searchVolume" INTEGER,
    "keywordDifficulty" INTEGER,
    "cpcMicros" INTEGER,
    "metricsFetchedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlphaSeoRankKeyword_configId_fkey" FOREIGN KEY ("configId") REFERENCES "AlphaSeoRankConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoRankRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configId" TEXT NOT NULL,
    "requestedById" INTEGER,
    "trigger" TEXT NOT NULL,
    "scheduledFor" DATETIME,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "keywordsTotal" INTEGER NOT NULL DEFAULT 0,
    "keywordsChecked" INTEGER NOT NULL DEFAULT 0,
    "isSubsetRun" BOOLEAN NOT NULL DEFAULT false,
    "estimatedUnits" INTEGER NOT NULL DEFAULT 0,
    "estimatedMicrosUsd" INTEGER NOT NULL DEFAULT 0,
    "actualUnits" INTEGER,
    "actualMicrosUsd" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "leaseOwner" TEXT,
    "leaseToken" INTEGER NOT NULL DEFAULT 0,
    "leaseExpiresAt" DATETIME,
    "heartbeatAt" DATETIME,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "AlphaSeoRankRun_configId_fkey" FOREIGN KEY ("configId") REFERENCES "AlphaSeoRankConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoRankRun_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoRankSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "trackingKeywordId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "position" INTEGER,
    "rankedUrl" TEXT,
    "serpFeatures" JSONB,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlphaSeoRankSnapshot_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AlphaSeoRankRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoSiteAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "startedById" INTEGER NOT NULL,
    "startUrl" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "workflowInstanceId" TEXT,
    "config" JSONB NOT NULL,
    "pagesCrawled" INTEGER NOT NULL DEFAULT 0,
    "pagesTotal" INTEGER NOT NULL DEFAULT 0,
    "lighthouseTotal" INTEGER NOT NULL DEFAULT 0,
    "lighthouseCompleted" INTEGER NOT NULL DEFAULT 0,
    "lighthouseFailed" INTEGER NOT NULL DEFAULT 0,
    "currentPhase" TEXT NOT NULL DEFAULT 'DISCOVERY',
    "errorCode" TEXT,
    "errorDetail" TEXT,
    "failedPhase" TEXT,
    "leaseOwner" TEXT,
    "leaseToken" INTEGER NOT NULL DEFAULT 0,
    "leaseExpiresAt" DATETIME,
    "heartbeatAt" DATETIME,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlphaSeoSiteAudit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoSiteAudit_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoAuditPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auditId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "statusCode" INTEGER,
    "redirectUrl" TEXT,
    "title" TEXT,
    "metaDescription" TEXT,
    "canonicalUrl" TEXT,
    "robotsMeta" TEXT,
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "ogImage" TEXT,
    "h1Count" INTEGER NOT NULL DEFAULT 0,
    "h2Count" INTEGER NOT NULL DEFAULT 0,
    "h3Count" INTEGER NOT NULL DEFAULT 0,
    "h4Count" INTEGER NOT NULL DEFAULT 0,
    "h5Count" INTEGER NOT NULL DEFAULT 0,
    "h6Count" INTEGER NOT NULL DEFAULT 0,
    "headingOrder" JSONB,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "imagesTotal" INTEGER NOT NULL DEFAULT 0,
    "imagesMissingAlt" INTEGER NOT NULL DEFAULT 0,
    "images" JSONB,
    "internalLinkCount" INTEGER NOT NULL DEFAULT 0,
    "externalLinkCount" INTEGER NOT NULL DEFAULT 0,
    "hasStructuredData" BOOLEAN NOT NULL DEFAULT false,
    "hreflangTags" JSONB,
    "isIndexable" BOOLEAN NOT NULL DEFAULT true,
    "xRobotsTag" TEXT,
    "headerCanonicalUrl" TEXT,
    "crawlDepth" INTEGER,
    "inSitemap" BOOLEAN NOT NULL DEFAULT false,
    "contentHash" TEXT,
    "fetchClass" TEXT NOT NULL DEFAULT 'OK',
    "responseTimeMs" INTEGER,
    CONSTRAINT "AlphaSeoAuditPage_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "AlphaSeoSiteAudit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoAuditIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auditId" TEXT NOT NULL,
    "pageId" TEXT,
    "pageUrl" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "details" JSONB,
    CONSTRAINT "AlphaSeoAuditIssue_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "AlphaSeoSiteAudit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoAuditIssue_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "AlphaSeoAuditPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoAuditLighthouse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auditId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "performanceScore" INTEGER,
    "accessibilityScore" INTEGER,
    "bestPracticesScore" INTEGER,
    "seoScore" INTEGER,
    "lcpMs" REAL,
    "cls" REAL,
    "inpMs" REAL,
    "ttfbMs" REAL,
    "errorMessage" TEXT,
    "storageKey" TEXT,
    "payloadSizeBytes" INTEGER,
    CONSTRAINT "AlphaSeoAuditLighthouse_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "AlphaSeoSiteAudit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoAuditLighthouse_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "AlphaSeoAuditPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoGoogleOAuthNonce" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "projectId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "codeVerifierCiphertext" TEXT NOT NULL,
    "tokenKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "redirectUriHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlphaSeoGoogleOAuthNonce_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoGoogleOAuthNonce_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoGoogleOAuthGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "product" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountEmail" TEXT,
    "accessTokenCiphertext" TEXT NOT NULL,
    "refreshTokenCiphertext" TEXT,
    "idTokenCiphertext" TEXT,
    "scopes" JSONB NOT NULL,
    "tokenKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaSeoGoogleOAuthGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoGscConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "connectedById" INTEGER NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "connectedAccountEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaSeoGscConnection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoGscConnection_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "AlphaSeoGoogleOAuthGrant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoGscConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoGa4Connection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "connectedById" INTEGER NOT NULL,
    "propertyId" TEXT NOT NULL,
    "propertyDisplayName" TEXT NOT NULL,
    "propertyTimeZone" TEXT NOT NULL,
    "propertyCurrencyCode" TEXT NOT NULL,
    "connectedAccountEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaSeoGa4Connection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoGa4Connection_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "AlphaSeoGoogleOAuthGrant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoGa4Connection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoProjectContextSection" (
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "updatedByKind" TEXT NOT NULL,
    "updatedByUserId" INTEGER,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("projectId", "key"),
    CONSTRAINT "AlphaSeoProjectContextSection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoProjectContextSection_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoProjectCompetitor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "normalizedDomain" TEXT NOT NULL,
    "name" TEXT,
    "notes" TEXT,
    "updatedByKind" TEXT NOT NULL,
    "updatedByUserId" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaSeoProjectCompetitor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoProjectCompetitor_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoProjectKeyPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "topic" TEXT,
    "notes" TEXT,
    "updatedByKind" TEXT NOT NULL,
    "updatedByUserId" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaSeoProjectKeyPage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoProjectKeyPage_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoProjectResearchLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "entryDate" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdByKind" TEXT NOT NULL,
    "createdByUserId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlphaSeoProjectResearchLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoProjectResearchLog_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoSamSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Nova conversa',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "cancelledAt" DATETIME,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaSeoSamSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoSamSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoSamMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCall" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlphaSeoSamMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AlphaSeoSamSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoBacklinkSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "rank" INTEGER,
    "backlinks" INTEGER,
    "referringDomains" INTEGER,
    "brokenBacklinks" INTEGER,
    "newBacklinks" INTEGER,
    "lostBacklinks" INTEGER,
    "newReferringDomains" INTEGER,
    "lostReferringDomains" INTEGER,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlphaSeoBacklinkSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "scopes" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "rateLimitWindowMs" INTEGER NOT NULL DEFAULT 60000,
    "rateLimitMax" INTEGER NOT NULL DEFAULT 120,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "lastRequestAt" DATETIME,
    "lastUsedAt" DATETIME,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaSeoApiKey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoApiKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoMcpOAuthClient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "clientSecretHash" TEXT,
    "clientName" TEXT NOT NULL,
    "redirectUris" JSONB NOT NULL,
    "grantTypes" JSONB NOT NULL,
    "responseTypes" JSONB NOT NULL,
    "tokenEndpointAuthMethod" TEXT NOT NULL,
    "scopes" JSONB NOT NULL,
    "createdById" INTEGER,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaSeoMcpOAuthClient_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoMcpOAuthGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "oauthClientId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "projectId" TEXT NOT NULL,
    "scopes" JSONB NOT NULL,
    "resource" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "consentedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaSeoMcpOAuthGrant_oauthClientId_fkey" FOREIGN KEY ("oauthClientId") REFERENCES "AlphaSeoMcpOAuthClient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoMcpOAuthGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoMcpOAuthGrant_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoMcpAuthorizationCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "grantId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "redirectUriHash" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "codeChallengeMethod" TEXT NOT NULL DEFAULT 'S256',
    "nonceHash" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlphaSeoMcpAuthorizationCode_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "AlphaSeoMcpOAuthGrant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoMcpAccessToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "grantId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" JSONB NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlphaSeoMcpAccessToken_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "AlphaSeoMcpOAuthGrant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoMcpRefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "grantId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenFamilyId" TEXT NOT NULL,
    "parentTokenId" TEXT,
    "scopes" JSONB NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlphaSeoMcpRefreshToken_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "AlphaSeoMcpOAuthGrant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoMcpRefreshToken_parentTokenId_fkey" FOREIGN KEY ("parentTokenId") REFERENCES "AlphaSeoMcpRefreshToken" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "availableAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedBy" TEXT,
    "claimedAt" DATETIME,
    "claimExpiresAt" DATETIME,
    "claimToken" INTEGER NOT NULL DEFAULT 0,
    "heartbeatAt" DATETIME,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "completedAt" DATETIME,
    "deadLetteredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaSeoJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoCostApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "operation" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "estimatedUnits" INTEGER NOT NULL DEFAULT 0,
    "estimatedMicrosUsd" INTEGER NOT NULL DEFAULT 0,
    "approvedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaSeoCostApproval_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoCostApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoExport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "columns" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "storageRef" TEXT,
    "errorCode" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlphaSeoExport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoExport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoAiVisibilityRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "requestedById" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "estimatedMicrosUsd" INTEGER NOT NULL DEFAULT 0,
    "actualMicrosUsd" INTEGER,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlphaSeoAiVisibilityRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoAiVisibilityRun_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoAiVisibilityProviderResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB,
    "errorCode" TEXT,
    "durationMs" INTEGER,
    "actualMicrosUsd" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlphaSeoAiVisibilityProviderResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AlphaSeoAiVisibilityRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoExternalOperationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "requestedById" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "target" TEXT,
    "request" JSONB NOT NULL,
    "requestHash" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "partialResult" JSONB,
    "estimatedUnits" INTEGER NOT NULL DEFAULT 0,
    "estimatedMicrosUsd" INTEGER NOT NULL DEFAULT 0,
    "actualUnits" INTEGER,
    "actualMicrosUsd" INTEGER,
    "errorCode" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlphaSeoExternalOperationRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoExternalOperationRun_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoProviderCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "cacheKeyHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "sourceRunId" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaSeoProviderCache_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaSeoAuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "requestId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlphaSeoAuditEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AlphaSeoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlphaSeoAuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AlphaSeoProject_ownerId_status_updatedAt_idx" ON "AlphaSeoProject"("ownerId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "AlphaSeoProject_status_archivedAt_updatedAt_idx" ON "AlphaSeoProject"("status", "archivedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "AlphaSeoProject_normalizedDomain_idx" ON "AlphaSeoProject"("normalizedDomain");

-- CreateIndex
CREATE INDEX "AlphaSeoProjectMember_userId_active_updatedAt_idx" ON "AlphaSeoProjectMember"("userId", "active", "updatedAt");

-- CreateIndex
CREATE INDEX "AlphaSeoProjectMember_projectId_role_active_idx" ON "AlphaSeoProjectMember"("projectId", "role", "active");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoProjectMember_projectId_userId_key" ON "AlphaSeoProjectMember"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoProjectInvitation_tokenHash_key" ON "AlphaSeoProjectInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "AlphaSeoProjectInvitation_projectId_status_expiresAt_idx" ON "AlphaSeoProjectInvitation"("projectId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "AlphaSeoProjectInvitation_normalizedEmail_status_expiresAt_idx" ON "AlphaSeoProjectInvitation"("normalizedEmail", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "AlphaSeoUserOnboarding_activeProjectId_idx" ON "AlphaSeoUserOnboarding"("activeProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoKeywordResearchRun_idempotencyKey_key" ON "AlphaSeoKeywordResearchRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AlphaSeoKeywordResearchRun_projectId_createdAt_idx" ON "AlphaSeoKeywordResearchRun"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AlphaSeoKeywordResearchRun_projectId_requestHash_createdAt_idx" ON "AlphaSeoKeywordResearchRun"("projectId", "requestHash", "createdAt");

-- CreateIndex
CREATE INDEX "AlphaSeoKeywordResearchRun_status_createdAt_idx" ON "AlphaSeoKeywordResearchRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AlphaSeoSavedKeyword_projectId_createdAt_idx" ON "AlphaSeoSavedKeyword"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoSavedKeyword_projectId_normalized_locationCode_languageCode_key" ON "AlphaSeoSavedKeyword"("projectId", "normalized", "locationCode", "languageCode");

-- CreateIndex
CREATE INDEX "AlphaSeoSavedKeywordTag_projectId_name_idx" ON "AlphaSeoSavedKeywordTag"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoSavedKeywordTag_projectId_normalizedName_key" ON "AlphaSeoSavedKeywordTag"("projectId", "normalizedName");

-- CreateIndex
CREATE INDEX "AlphaSeoSavedKeywordTagAssignment_tagId_idx" ON "AlphaSeoSavedKeywordTagAssignment"("tagId");

-- CreateIndex
CREATE INDEX "AlphaSeoKeywordMetric_projectId_normalizedKeyword_locationCode_languageCode_fetchedAt_idx" ON "AlphaSeoKeywordMetric"("projectId", "normalizedKeyword", "locationCode", "languageCode", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoKeywordMetric_projectId_normalizedKeyword_locationCode_languageCode_key" ON "AlphaSeoKeywordMetric"("projectId", "normalizedKeyword", "locationCode", "languageCode");

-- CreateIndex
CREATE INDEX "AlphaSeoRankConfig_projectId_isActive_createdAt_idx" ON "AlphaSeoRankConfig"("projectId", "isActive", "createdAt");

-- CreateIndex
CREATE INDEX "AlphaSeoRankConfig_isActive_nextCheckAt_idx" ON "AlphaSeoRankConfig"("isActive", "nextCheckAt");

-- CreateIndex
CREATE INDEX "AlphaSeoRankConfig_projectId_normalizedDomain_locationCode_locationName_idx" ON "AlphaSeoRankConfig"("projectId", "normalizedDomain", "locationCode", "locationName");

-- CreateIndex
CREATE INDEX "AlphaSeoRankKeyword_configId_createdAt_idx" ON "AlphaSeoRankKeyword"("configId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoRankKeyword_configId_normalizedKeyword_key" ON "AlphaSeoRankKeyword"("configId", "normalizedKeyword");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoRankRun_idempotencyKey_key" ON "AlphaSeoRankRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AlphaSeoRankRun_configId_startedAt_idx" ON "AlphaSeoRankRun"("configId", "startedAt");

-- CreateIndex
CREATE INDEX "AlphaSeoRankRun_status_leaseExpiresAt_idx" ON "AlphaSeoRankRun"("status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "AlphaSeoRankRun_scheduledFor_status_idx" ON "AlphaSeoRankRun"("scheduledFor", "status");

-- CreateIndex
CREATE INDEX "AlphaSeoRankSnapshot_trackingKeywordId_device_checkedAt_idx" ON "AlphaSeoRankSnapshot"("trackingKeywordId", "device", "checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoRankSnapshot_runId_trackingKeywordId_device_key" ON "AlphaSeoRankSnapshot"("runId", "trackingKeywordId", "device");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoSiteAudit_idempotencyKey_key" ON "AlphaSeoSiteAudit"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AlphaSeoSiteAudit_projectId_createdAt_idx" ON "AlphaSeoSiteAudit"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AlphaSeoSiteAudit_startedById_createdAt_idx" ON "AlphaSeoSiteAudit"("startedById", "createdAt");

-- CreateIndex
CREATE INDEX "AlphaSeoSiteAudit_status_heartbeatAt_idx" ON "AlphaSeoSiteAudit"("status", "heartbeatAt");

-- CreateIndex
CREATE INDEX "AlphaSeoAuditPage_auditId_statusCode_idx" ON "AlphaSeoAuditPage"("auditId", "statusCode");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoAuditPage_auditId_url_key" ON "AlphaSeoAuditPage"("auditId", "url");

-- CreateIndex
CREATE INDEX "AlphaSeoAuditIssue_auditId_issueType_idx" ON "AlphaSeoAuditIssue"("auditId", "issueType");

-- CreateIndex
CREATE INDEX "AlphaSeoAuditIssue_pageId_idx" ON "AlphaSeoAuditIssue"("pageId");

-- CreateIndex
CREATE INDEX "AlphaSeoAuditIssue_auditId_severity_idx" ON "AlphaSeoAuditIssue"("auditId", "severity");

-- CreateIndex
CREATE INDEX "AlphaSeoAuditLighthouse_auditId_idx" ON "AlphaSeoAuditLighthouse"("auditId");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoAuditLighthouse_pageId_strategy_key" ON "AlphaSeoAuditLighthouse"("pageId", "strategy");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoGoogleOAuthNonce_stateHash_key" ON "AlphaSeoGoogleOAuthNonce"("stateHash");

-- CreateIndex
CREATE INDEX "AlphaSeoGoogleOAuthNonce_userId_product_expiresAt_idx" ON "AlphaSeoGoogleOAuthNonce"("userId", "product", "expiresAt");

-- CreateIndex
CREATE INDEX "AlphaSeoGoogleOAuthNonce_projectId_product_expiresAt_idx" ON "AlphaSeoGoogleOAuthNonce"("projectId", "product", "expiresAt");

-- CreateIndex
CREATE INDEX "AlphaSeoGoogleOAuthGrant_product_accessTokenExpiresAt_idx" ON "AlphaSeoGoogleOAuthGrant"("product", "accessTokenExpiresAt");

-- CreateIndex
CREATE INDEX "AlphaSeoGoogleOAuthGrant_userId_revokedAt_idx" ON "AlphaSeoGoogleOAuthGrant"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoGoogleOAuthGrant_userId_product_accountId_key" ON "AlphaSeoGoogleOAuthGrant"("userId", "product", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoGscConnection_projectId_key" ON "AlphaSeoGscConnection"("projectId");

-- CreateIndex
CREATE INDEX "AlphaSeoGscConnection_grantId_idx" ON "AlphaSeoGscConnection"("grantId");

-- CreateIndex
CREATE INDEX "AlphaSeoGscConnection_connectedById_grantId_idx" ON "AlphaSeoGscConnection"("connectedById", "grantId");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoGa4Connection_projectId_key" ON "AlphaSeoGa4Connection"("projectId");

-- CreateIndex
CREATE INDEX "AlphaSeoGa4Connection_grantId_idx" ON "AlphaSeoGa4Connection"("grantId");

-- CreateIndex
CREATE INDEX "AlphaSeoGa4Connection_connectedById_grantId_idx" ON "AlphaSeoGa4Connection"("connectedById", "grantId");

-- CreateIndex
CREATE INDEX "AlphaSeoProjectContextSection_updatedByUserId_updatedAt_idx" ON "AlphaSeoProjectContextSection"("updatedByUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "AlphaSeoProjectCompetitor_updatedByUserId_updatedAt_idx" ON "AlphaSeoProjectCompetitor"("updatedByUserId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoProjectCompetitor_projectId_normalizedDomain_key" ON "AlphaSeoProjectCompetitor"("projectId", "normalizedDomain");

-- CreateIndex
CREATE INDEX "AlphaSeoProjectKeyPage_updatedByUserId_updatedAt_idx" ON "AlphaSeoProjectKeyPage"("updatedByUserId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoProjectKeyPage_projectId_normalizedUrl_key" ON "AlphaSeoProjectKeyPage"("projectId", "normalizedUrl");

-- CreateIndex
CREATE INDEX "AlphaSeoProjectResearchLog_projectId_entryDate_createdAt_idx" ON "AlphaSeoProjectResearchLog"("projectId", "entryDate", "createdAt");

-- CreateIndex
CREATE INDEX "AlphaSeoProjectResearchLog_createdByUserId_createdAt_idx" ON "AlphaSeoProjectResearchLog"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AlphaSeoSamSession_projectId_updatedAt_idx" ON "AlphaSeoSamSession"("projectId", "updatedAt");

-- CreateIndex
CREATE INDEX "AlphaSeoSamSession_userId_status_updatedAt_idx" ON "AlphaSeoSamSession"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "AlphaSeoSamMessage_sessionId_createdAt_idx" ON "AlphaSeoSamMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AlphaSeoBacklinkSnapshot_projectId_capturedAt_idx" ON "AlphaSeoBacklinkSnapshot"("projectId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoApiKey_keyHash_key" ON "AlphaSeoApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "AlphaSeoApiKey_projectId_revokedAt_idx" ON "AlphaSeoApiKey"("projectId", "revokedAt");

-- CreateIndex
CREATE INDEX "AlphaSeoApiKey_prefix_idx" ON "AlphaSeoApiKey"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoMcpOAuthClient_clientId_key" ON "AlphaSeoMcpOAuthClient"("clientId");

-- CreateIndex
CREATE INDEX "AlphaSeoMcpOAuthClient_createdById_revokedAt_idx" ON "AlphaSeoMcpOAuthClient"("createdById", "revokedAt");

-- CreateIndex
CREATE INDEX "AlphaSeoMcpOAuthGrant_oauthClientId_userId_projectId_status_idx" ON "AlphaSeoMcpOAuthGrant"("oauthClientId", "userId", "projectId", "status");

-- CreateIndex
CREATE INDEX "AlphaSeoMcpOAuthGrant_userId_status_expiresAt_idx" ON "AlphaSeoMcpOAuthGrant"("userId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "AlphaSeoMcpOAuthGrant_projectId_status_idx" ON "AlphaSeoMcpOAuthGrant"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoMcpAuthorizationCode_codeHash_key" ON "AlphaSeoMcpAuthorizationCode"("codeHash");

-- CreateIndex
CREATE INDEX "AlphaSeoMcpAuthorizationCode_grantId_expiresAt_consumedAt_idx" ON "AlphaSeoMcpAuthorizationCode"("grantId", "expiresAt", "consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoMcpAccessToken_tokenHash_key" ON "AlphaSeoMcpAccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AlphaSeoMcpAccessToken_grantId_expiresAt_revokedAt_idx" ON "AlphaSeoMcpAccessToken"("grantId", "expiresAt", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoMcpRefreshToken_tokenHash_key" ON "AlphaSeoMcpRefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AlphaSeoMcpRefreshToken_grantId_expiresAt_revokedAt_idx" ON "AlphaSeoMcpRefreshToken"("grantId", "expiresAt", "revokedAt");

-- CreateIndex
CREATE INDEX "AlphaSeoMcpRefreshToken_tokenFamilyId_createdAt_idx" ON "AlphaSeoMcpRefreshToken"("tokenFamilyId", "createdAt");

-- CreateIndex
CREATE INDEX "AlphaSeoMcpRefreshToken_parentTokenId_idx" ON "AlphaSeoMcpRefreshToken"("parentTokenId");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoJob_idempotencyKey_key" ON "AlphaSeoJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AlphaSeoJob_status_availableAt_priority_createdAt_idx" ON "AlphaSeoJob"("status", "availableAt", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "AlphaSeoJob_status_claimExpiresAt_idx" ON "AlphaSeoJob"("status", "claimExpiresAt");

-- CreateIndex
CREATE INDEX "AlphaSeoJob_projectId_type_status_idx" ON "AlphaSeoJob"("projectId", "type", "status");

-- CreateIndex
CREATE INDEX "AlphaSeoCostApproval_expiresAt_idx" ON "AlphaSeoCostApproval"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoCostApproval_projectId_userId_operation_requestHash_key" ON "AlphaSeoCostApproval"("projectId", "userId", "operation", "requestHash");

-- CreateIndex
CREATE INDEX "AlphaSeoExport_projectId_createdAt_idx" ON "AlphaSeoExport"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AlphaSeoExport_createdById_createdAt_idx" ON "AlphaSeoExport"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoAiVisibilityRun_idempotencyKey_key" ON "AlphaSeoAiVisibilityRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AlphaSeoAiVisibilityRun_projectId_kind_createdAt_idx" ON "AlphaSeoAiVisibilityRun"("projectId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "AlphaSeoAiVisibilityRun_projectId_requestHash_createdAt_idx" ON "AlphaSeoAiVisibilityRun"("projectId", "requestHash", "createdAt");

-- CreateIndex
CREATE INDEX "AlphaSeoAiVisibilityProviderResult_provider_createdAt_idx" ON "AlphaSeoAiVisibilityProviderResult"("provider", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoAiVisibilityProviderResult_runId_provider_key" ON "AlphaSeoAiVisibilityProviderResult"("runId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoExternalOperationRun_idempotencyKey_key" ON "AlphaSeoExternalOperationRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AlphaSeoExternalOperationRun_projectId_operation_createdAt_idx" ON "AlphaSeoExternalOperationRun"("projectId", "operation", "createdAt");

-- CreateIndex
CREATE INDEX "AlphaSeoExternalOperationRun_projectId_requestHash_createdAt_idx" ON "AlphaSeoExternalOperationRun"("projectId", "requestHash", "createdAt");

-- CreateIndex
CREATE INDEX "AlphaSeoExternalOperationRun_provider_status_createdAt_idx" ON "AlphaSeoExternalOperationRun"("provider", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AlphaSeoProviderCache_expiresAt_idx" ON "AlphaSeoProviderCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlphaSeoProviderCache_projectId_provider_operation_cacheKeyHash_key" ON "AlphaSeoProviderCache"("projectId", "provider", "operation", "cacheKeyHash");

-- CreateIndex
CREATE INDEX "AlphaSeoAuditEvent_projectId_createdAt_idx" ON "AlphaSeoAuditEvent"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AlphaSeoAuditEvent_userId_createdAt_idx" ON "AlphaSeoAuditEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AlphaSeoAuditEvent_entityType_entityId_createdAt_idx" ON "AlphaSeoAuditEvent"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AlphaSeoAuditEvent_requestId_idx" ON "AlphaSeoAuditEvent"("requestId");

-- Manual partial indexes required by Alpha SEO invariants that Prisma cannot express.
CREATE UNIQUE INDEX "AlphaSeoRankConfig_national_scope_active_key"
ON "AlphaSeoRankConfig"("projectId", "normalizedDomain", "locationCode")
WHERE "locationName" IS NULL;

CREATE UNIQUE INDEX "AlphaSeoRankConfig_local_scope_active_key"
ON "AlphaSeoRankConfig"("projectId", "normalizedDomain", "locationCode", "locationName")
WHERE "locationName" IS NOT NULL;

CREATE UNIQUE INDEX "AlphaSeoRankRun_one_inflight_per_config_key"
ON "AlphaSeoRankRun"("configId")
WHERE "status" IN ('PENDING', 'RUNNING');

CREATE UNIQUE INDEX "AlphaSeoProjectInvitation_one_pending_per_email_key"
ON "AlphaSeoProjectInvitation"("projectId", "normalizedEmail")
WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX "AlphaSeoMcpOAuthGrant_one_active_consent_key"
ON "AlphaSeoMcpOAuthGrant"("oauthClientId", "userId", "projectId", COALESCE("resource", ''))
WHERE "status" = 'ACTIVE';
