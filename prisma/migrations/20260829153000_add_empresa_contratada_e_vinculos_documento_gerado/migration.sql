-- Gerador de Documentos — contratante/contratada + PDF final.
-- Migration 100% aditiva: 1 CREATE TABLE nova + 3 ADD COLUMN nullable em
-- DocumentoGerado + índices. Nenhum dado existente é alterado ou removido.

CREATE TABLE "EmpresaContratada" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "cnpj" TEXT NOT NULL,
    "logradouro" TEXT,
    "numero" TEXT,
    "bairro" TEXT,
    "municipio" TEXT,
    "uf" TEXT,
    "cep" TEXT,
    "naturezaJuridica" TEXT,
    "representanteLegalNome" TEXT,
    "representanteLegalCpf" TEXT,
    "representanteLegalCargo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "criadoPorId" INTEGER NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "EmpresaContratada_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EmpresaContratada_cnpj_key" ON "EmpresaContratada"("cnpj");
CREATE INDEX "EmpresaContratada_status_criadoEm_idx" ON "EmpresaContratada"("status", "criadoEm");

ALTER TABLE "DocumentoGerado" ADD COLUMN "clienteId" INTEGER;
ALTER TABLE "DocumentoGerado" ADD COLUMN "empresaContratadaId" TEXT;
ALTER TABLE "DocumentoGerado" ADD COLUMN "pdfUrl" TEXT;

CREATE INDEX "DocumentoGerado_clienteId_idx" ON "DocumentoGerado"("clienteId");
CREATE INDEX "DocumentoGerado_empresaContratadaId_idx" ON "DocumentoGerado"("empresaContratadaId");
