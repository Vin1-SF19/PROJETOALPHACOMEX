-- RM-2026-4C9C6D — gestão configurável de campos e dados.
-- Mudança estritamente aditiva: sem DROP, rename, rebuild, UPDATE ou backfill.

ALTER TABLE "BpmCampo" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "BpmCampo" ADD COLUMN "escopo" TEXT NOT NULL DEFAULT 'CARD'
  CHECK ("escopo" IN ('CARD', 'GLOBAL'));
ALTER TABLE "BpmCampo" ADD COLUMN "valorPadrao" TEXT;
ALTER TABLE "BpmCampo" ADD COLUMN "fonteEntidade" TEXT
  CHECK ("fonteEntidade" IS NULL OR "fonteEntidade" IN ('CLIENTE', 'CONTATO', 'PARCEIRO', 'CONTRATO', 'SERVICO', 'PROCESSO', 'CARD'));
ALTER TABLE "BpmCampo" ADD COLUMN "fonteAtributo" TEXT;
ALTER TABLE "BpmCampo" ADD COLUMN "visivel" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "BpmCampo" ADD COLUMN "editavel" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "BpmCampo" ADD COLUMN "somenteLeitura" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BpmCampo" ADD COLUMN "configVersao" INTEGER NOT NULL DEFAULT 1
  CHECK ("configVersao" > 0);

CREATE TABLE "BpmCampoOpcao" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "campoId" TEXT NOT NULL,
  "chave" TEXT NOT NULL,
  "rotulo" TEXT NOT NULL,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BpmCampoOpcao_campoId_fkey" FOREIGN KEY ("campoId") REFERENCES "BpmCampo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BpmCampoPipeline" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "campoId" TEXT NOT NULL,
  "pipelineId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BpmCampoPipeline_campoId_fkey" FOREIGN KEY ("campoId") REFERENCES "BpmCampo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BpmCampoPipeline_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "BpmPipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BpmCampoEtapaConfig" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "campoId" TEXT NOT NULL,
  "etapaId" TEXT NOT NULL,
  "visivel" BOOLEAN NOT NULL DEFAULT true,
  "editavel" BOOLEAN NOT NULL DEFAULT true,
  "somenteLeitura" BOOLEAN NOT NULL DEFAULT false,
  "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BpmCampoEtapaConfig_campoId_fkey" FOREIGN KEY ("campoId") REFERENCES "BpmCampo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BpmCampoEtapaConfig_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "BpmEtapa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BpmCampoAcesso" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "campoId" TEXT NOT NULL,
  "perfil" TEXT NOT NULL,
  "visivel" BOOLEAN NOT NULL DEFAULT true,
  "editavel" BOOLEAN NOT NULL DEFAULT true,
  "somenteLeitura" BOOLEAN NOT NULL DEFAULT false,
  "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BpmCampoAcesso_campoId_fkey" FOREIGN KEY ("campoId") REFERENCES "BpmCampo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BpmCampoMapeamento" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "campoOrigemId" TEXT NOT NULL,
  "campoDestinoId" TEXT NOT NULL,
  "modo" TEXT NOT NULL CHECK ("modo" IN ('COPIAR', 'SINCRONIZAR', 'REFERENCIAR')),
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BpmCampoMapeamento_campos_distintos_check" CHECK ("campoOrigemId" <> "campoDestinoId"),
  CONSTRAINT "BpmCampoMapeamento_campoOrigemId_fkey" FOREIGN KEY ("campoOrigemId") REFERENCES "BpmCampo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BpmCampoMapeamento_campoDestinoId_fkey" FOREIGN KEY ("campoDestinoId") REFERENCES "BpmCampo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "BpmCardAnexo" ADD COLUMN "campoId" TEXT
  REFERENCES "BpmCampo" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "BpmCampoOpcao_campoId_chave_key" ON "BpmCampoOpcao"("campoId", "chave");
CREATE INDEX "BpmCampoOpcao_campoId_ativo_ordem_idx" ON "BpmCampoOpcao"("campoId", "ativo", "ordem");
CREATE UNIQUE INDEX "BpmCampoPipeline_campoId_pipelineId_key" ON "BpmCampoPipeline"("campoId", "pipelineId");
CREATE INDEX "BpmCampoPipeline_pipelineId_idx" ON "BpmCampoPipeline"("pipelineId");
CREATE UNIQUE INDEX "BpmCampoEtapaConfig_campoId_etapaId_key" ON "BpmCampoEtapaConfig"("campoId", "etapaId");
CREATE INDEX "BpmCampoEtapaConfig_etapaId_idx" ON "BpmCampoEtapaConfig"("etapaId");
CREATE UNIQUE INDEX "BpmCampoAcesso_campoId_perfil_key" ON "BpmCampoAcesso"("campoId", "perfil");
CREATE INDEX "BpmCampoAcesso_perfil_idx" ON "BpmCampoAcesso"("perfil");
CREATE UNIQUE INDEX "BpmCampoMapeamento_campoDestinoId_key" ON "BpmCampoMapeamento"("campoDestinoId");
CREATE INDEX "BpmCampoMapeamento_campoOrigemId_ativo_idx" ON "BpmCampoMapeamento"("campoOrigemId", "ativo");
CREATE INDEX "BpmCardAnexo_campoId_idx" ON "BpmCardAnexo"("campoId");
