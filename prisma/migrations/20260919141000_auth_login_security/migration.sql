-- Sessões JWT anteriores a uma troca/reset de senha são invalidadas pela
-- versão persistida por usuário. O default preserva todas as contas atuais.
ALTER TABLE "usuarios" ADD COLUMN "authSessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Rate limit compartilhado entre instâncias. `key` recebe somente HMAC e não
-- armazena e-mail ou endereço IP em claro.
CREATE TABLE "AuthRateLimit" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" DATETIME NOT NULL,
    "blockedUntil" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "AuthRateLimit_updatedAt_idx" ON "AuthRateLimit"("updatedAt");
