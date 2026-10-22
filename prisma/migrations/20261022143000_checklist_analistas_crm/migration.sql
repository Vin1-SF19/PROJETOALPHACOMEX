-- CheckList Analistas / CRM — fase estritamente aditiva.
-- NÃO executar sem Vault, backup verificado <=48h e consentimento específico.
-- Base canônica obrigatória: clienteId INTEGER(master), clienteOperacionalId TEXT(conta).
-- Legados permanecem sem analista/identidade/revisão/metadata: não inferir nem backfill.
-- Rollback preferencial: código compatível; nunca DROP automático.

CREATE TABLE "ModeloChecklistIdentidade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "escopo" TEXT NOT NULL,
    "codigoNormalizado" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "autorId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ModeloChecklistIdentidade_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ChecklistCrmVinculo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "empresaOperacionalId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "autorId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChecklistCrmVinculo_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "BpmCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChecklistCrmVinculo_empresaOperacionalId_fkey" FOREIGN KEY ("empresaOperacionalId") REFERENCES "operacional_clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChecklistCrmVinculo_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ChecklistEvento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mutationId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "agregadoTipo" TEXT NOT NULL,
    "agregadoId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "empresaId" TEXT,
    "atorTipo" TEXT NOT NULL,
    "atorUsuarioId" INTEGER,
    "atorContaId" TEXT,
    "dados" JSONB,
    "resultado" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicadoEm" DATETIME,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "proximaTentativaEm" DATETIME,
    "claimToken" TEXT,
    "claimAte" DATETIME,
    "ultimoErro" TEXT,
    CONSTRAINT "ChecklistEvento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "operacional_clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChecklistEvento_atorUsuarioId_fkey" FOREIGN KEY ("atorUsuarioId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ChecklistEvento_atorContaId_fkey" FOREIGN KEY ("atorContaId") REFERENCES "ClienteOperacional" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ChecklistEventoLeitura" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventoId" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "lidoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChecklistEventoLeitura_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "ChecklistEvento" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChecklistEventoLeitura_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ChecklistUploadRecibo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "usuarioId" INTEGER,
    "clienteOperacionalId" TEXT,
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageAccess" TEXT NOT NULL DEFAULT 'private',
    "nome" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sha256" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "consumidoEm" DATETIME,
    "documentoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChecklistUploadRecibo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "operacional_clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChecklistUploadRecibo_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemChecklist" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChecklistUploadRecibo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ChecklistUploadRecibo_clienteOperacionalId_fkey" FOREIGN KEY ("clienteOperacionalId") REFERENCES "ClienteOperacional" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ChecklistUploadRecibo_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoChecklist" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "Auditoria" ADD COLUMN "checklistEventoId" TEXT REFERENCES "ChecklistEvento" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClienteOperacional" ADD COLUMN "senhaHash" TEXT;

ALTER TABLE "ClienteOperacional" ADD COLUMN "authSessionVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ClienteOperacional" ADD COLUMN "resetSenhaTokenHash" TEXT;

ALTER TABLE "ClienteOperacional" ADD COLUMN "resetSenhaExpiraEm" DATETIME;

ALTER TABLE "NotificacaoCliente" ADD COLUMN "eventoId" TEXT REFERENCES "ChecklistEvento" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "operacional_clientes" ADD COLUMN "analistaId" INTEGER REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "operacional_clientes" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ModeloItemChecklist" ADD COLUMN "identidadeId" TEXT REFERENCES "ModeloChecklistIdentidade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ModeloItemChecklist" ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "ModeloItemChecklist" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "ModeloItemChecklist" ADD COLUMN "ordem" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ModeloItemChecklist" ADD COLUMN "autorId" INTEGER REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ItemChecklist" ADD COLUMN "modeloRevisaoId" TEXT REFERENCES "ModeloItemChecklist" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ItemChecklist" ADD COLUMN "ordem" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "DocumentoChecklist" ADD COLUMN "storageProvider" TEXT;

ALTER TABLE "DocumentoChecklist" ADD COLUMN "storageKey" TEXT;

ALTER TABLE "DocumentoChecklist" ADD COLUMN "storageAccess" TEXT;

ALTER TABLE "DocumentoChecklist" ADD COLUMN "tamanhoBytes" INTEGER;

ALTER TABLE "DocumentoChecklist" ADD COLUMN "mimeType" TEXT;

ALTER TABLE "DocumentoChecklist" ADD COLUMN "sha256" TEXT;

ALTER TABLE "DocumentoChecklist" ADD COLUMN "uploadedByUsuarioId" INTEGER REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentoChecklist" ADD COLUMN "uploadedByContaId" TEXT REFERENCES "ClienteOperacional" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentoChecklist" ADD COLUMN "deletadoPorUsuarioId" INTEGER REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentoChecklist" ADD COLUMN "deletadoPorContaId" TEXT REFERENCES "ClienteOperacional" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Checklist" ADD COLUMN "modelosSnapshot" JSONB;

CREATE UNIQUE INDEX "Auditoria_checklistEventoId_key" ON "Auditoria"("checklistEventoId");

CREATE UNIQUE INDEX "ClienteOperacional_resetSenhaTokenHash_key" ON "ClienteOperacional"("resetSenhaTokenHash");

CREATE UNIQUE INDEX "NotificacaoCliente_eventoId_clienteId_key" ON "NotificacaoCliente"("eventoId", "clienteId");

CREATE INDEX "operacional_clientes_analistaId_createdAt_id_idx" ON "operacional_clientes"("analistaId", "createdAt", "id");

CREATE INDEX "operacional_clientes_clienteOperacionalId_idx" ON "operacional_clientes"("clienteOperacionalId");

CREATE INDEX "operacional_clientes_createdAt_id_idx" ON "operacional_clientes"("createdAt", "id");

CREATE INDEX "ModeloItemChecklist_autorId_idx" ON "ModeloItemChecklist"("autorId");

CREATE INDEX "ModeloItemChecklist_tipo_ativo_secao_ordem_idx" ON "ModeloItemChecklist"("tipo", "ativo", "secao", "ordem");

CREATE UNIQUE INDEX "ModeloItemChecklist_identidadeId_versao_key" ON "ModeloItemChecklist"("identidadeId", "versao");

CREATE INDEX "ItemChecklist_modeloRevisaoId_idx" ON "ItemChecklist"("modeloRevisaoId");

CREATE INDEX "ItemChecklist_checklistId_secao_ordem_id_idx" ON "ItemChecklist"("checklistId", "secao", "ordem", "id");

CREATE INDEX "DocumentoChecklist_uploadedByUsuarioId_idx" ON "DocumentoChecklist"("uploadedByUsuarioId");

CREATE INDEX "DocumentoChecklist_uploadedByContaId_idx" ON "DocumentoChecklist"("uploadedByContaId");

CREATE INDEX "DocumentoChecklist_deletadoPorUsuarioId_idx" ON "DocumentoChecklist"("deletadoPorUsuarioId");

CREATE INDEX "DocumentoChecklist_deletadoPorContaId_idx" ON "DocumentoChecklist"("deletadoPorContaId");

CREATE INDEX "ModeloChecklistIdentidade_autorId_idx" ON "ModeloChecklistIdentidade"("autorId");

CREATE UNIQUE INDEX "ModeloChecklistIdentidade_escopo_codigoNormalizado_key" ON "ModeloChecklistIdentidade"("escopo", "codigoNormalizado");

CREATE UNIQUE INDEX "ChecklistCrmVinculo_cardId_key" ON "ChecklistCrmVinculo"("cardId");

CREATE INDEX "ChecklistCrmVinculo_empresaOperacionalId_idx" ON "ChecklistCrmVinculo"("empresaOperacionalId");

CREATE INDEX "ChecklistCrmVinculo_autorId_idx" ON "ChecklistCrmVinculo"("autorId");

CREATE UNIQUE INDEX "ChecklistEvento_mutationId_key" ON "ChecklistEvento"("mutationId");

CREATE INDEX "ChecklistEvento_empresaId_createdAt_id_idx" ON "ChecklistEvento"("empresaId", "createdAt", "id");

CREATE INDEX "ChecklistEvento_publicadoEm_proximaTentativaEm_claimAte_idx" ON "ChecklistEvento"("publicadoEm", "proximaTentativaEm", "claimAte");

CREATE INDEX "ChecklistEvento_createdAt_id_idx" ON "ChecklistEvento"("createdAt", "id");

CREATE INDEX "ChecklistEvento_atorUsuarioId_idx" ON "ChecklistEvento"("atorUsuarioId");

CREATE INDEX "ChecklistEvento_atorContaId_idx" ON "ChecklistEvento"("atorContaId");

CREATE UNIQUE INDEX "ChecklistEvento_agregadoTipo_agregadoId_revision_key" ON "ChecklistEvento"("agregadoTipo", "agregadoId", "revision");

CREATE INDEX "ChecklistEventoLeitura_usuarioId_lidoEm_idx" ON "ChecklistEventoLeitura"("usuarioId", "lidoEm");

CREATE UNIQUE INDEX "ChecklistEventoLeitura_eventoId_usuarioId_key" ON "ChecklistEventoLeitura"("eventoId", "usuarioId");

CREATE UNIQUE INDEX "ChecklistUploadRecibo_tokenHash_key" ON "ChecklistUploadRecibo"("tokenHash");

CREATE UNIQUE INDEX "ChecklistUploadRecibo_documentoId_key" ON "ChecklistUploadRecibo"("documentoId");

CREATE INDEX "ChecklistUploadRecibo_empresaId_expiresAt_idx" ON "ChecklistUploadRecibo"("empresaId", "expiresAt");

CREATE INDEX "ChecklistUploadRecibo_itemId_idx" ON "ChecklistUploadRecibo"("itemId");

CREATE INDEX "ChecklistUploadRecibo_usuarioId_idx" ON "ChecklistUploadRecibo"("usuarioId");

CREATE INDEX "ChecklistUploadRecibo_clienteOperacionalId_idx" ON "ChecklistUploadRecibo"("clienteOperacionalId");

CREATE UNIQUE INDEX "ChecklistUploadRecibo_storageProvider_storageKey_key" ON "ChecklistUploadRecibo"("storageProvider", "storageKey");
