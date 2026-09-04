-- RM-2026-4C9C6D — complemento do Gestor de Campos por etapa.
-- Estritamente aditivo: preserva campos, valores e configurações existentes.

ALTER TABLE "BpmCampo" ADD COLUMN "chave" TEXT;
ALTER TABLE "BpmCampo" ADD COLUMN "entidadeGlobal" TEXT;

ALTER TABLE "BpmCampoEtapaConfig" ADD COLUMN "obrigatorioEntrada" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BpmCampoEtapaConfig" ADD COLUMN "obrigatorioSaida" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BpmCampoEtapaConfig" ADD COLUMN "grupo" TEXT;
ALTER TABLE "BpmCampoEtapaConfig" ADD COLUMN "valorPadrao" TEXT;
ALTER TABLE "BpmCampoEtapaConfig" ADD COLUMN "condicaoVisibilidadeJson" TEXT;
ALTER TABLE "BpmCampoEtapaConfig" ADD COLUMN "condicaoObrigatoriedadeJson" TEXT;

CREATE UNIQUE INDEX "BpmCampo_chave_key" ON "BpmCampo"("chave");

CREATE TABLE "BpmCampoValorGlobal" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "campoId" TEXT NOT NULL,
  "entidadeTipo" TEXT NOT NULL DEFAULT 'CLIENTE',
  "entidadeId" TEXT NOT NULL,
  "valor" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BpmCampoValorGlobal_campoId_fkey" FOREIGN KEY ("campoId") REFERENCES "BpmCampo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BpmCampoValorGlobal_campoId_entidadeTipo_entidadeId_key"
  ON "BpmCampoValorGlobal"("campoId", "entidadeTipo", "entidadeId");
CREATE INDEX "BpmCampoValorGlobal_entidadeTipo_entidadeId_idx"
  ON "BpmCampoValorGlobal"("entidadeTipo", "entidadeId");
