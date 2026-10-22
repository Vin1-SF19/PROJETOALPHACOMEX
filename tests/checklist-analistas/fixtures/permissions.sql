-- Synthetic SQLite fixture using the canonical permission schema; no real account data.
CREATE TABLE "setor" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "nome" TEXT NOT NULL UNIQUE,
  "isBase" BOOLEAN NOT NULL DEFAULT false,
  "protegido" BOOLEAN NOT NULL DEFAULT false,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "SetorPermissao" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "setor" TEXT NOT NULL,
  "modulo" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  UNIQUE("setor", "modulo")
);
CREATE TABLE "UsuarioPermissaoOverride" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "usuarioId" INTEGER NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "modulo" TEXT NOT NULL,
  "acao" TEXT NOT NULL,
  "motivo" TEXT,
  "criadoPor" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("usuarioId", "modulo")
);
