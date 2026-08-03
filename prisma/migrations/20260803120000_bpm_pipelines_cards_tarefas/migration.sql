-- Scope: Alpha BPM foundation only (D-049: reaproveita clientes/socios/Setor como Empresa/Pessoa/Setor).
-- Structures: 13 new tables (BpmPipeline, BpmPipelineSetor, BpmEtapa, BpmCampo, BpmCard,
-- BpmCardCampoValor, BpmCardMembro, BpmCardVinculo, BpmTarefa, BpmTarefaPreset,
-- BpmCardHistorico, BpmPipelineConfigAuditoria, BpmCardAnexo) + PessoaEmpresaVinculo.
-- 100% additive: no ALTER/DROP on existing tables (clientes, socios, usuarios, Setor,
-- crm_oportunidades, crm_contatos, crm_atividades untouched). Prisma relation fields added
-- to clientes/socios/usuarios/Setor are virtual (no physical column change on those tables).
-- Generated via `prisma migrate diff` comparing prior schema.prisma (git HEAD) to current.

PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;

-- CreateTable
CREATE TABLE IF NOT EXISTS "BpmPipeline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BpmPipelineSetor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pipelineId" TEXT NOT NULL,
    "setorId" INTEGER NOT NULL,
    CONSTRAINT "BpmPipelineSetor_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "BpmPipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmPipelineSetor_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BpmEtapa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pipelineId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "slaDias" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BpmEtapa_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "BpmPipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BpmCampo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pipelineId" TEXT NOT NULL,
    "etapaId" TEXT,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "opcoesJson" TEXT,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BpmCampo_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "BpmPipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmCampo_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "BpmEtapa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BpmCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" INTEGER NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    "responsavelId" INTEGER NOT NULL,
    "servico" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "concluidoEm" DATETIME,
    CONSTRAINT "BpmCard_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BpmCard_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "BpmPipeline" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BpmCard_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "BpmEtapa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BpmCard_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BpmCardCampoValor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "campoId" TEXT NOT NULL,
    "valor" TEXT,
    CONSTRAINT "BpmCardCampoValor_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "BpmCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmCardCampoValor_campoId_fkey" FOREIGN KEY ("campoId") REFERENCES "BpmCampo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BpmCardMembro" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BpmCardMembro_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "BpmCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmCardMembro_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BpmCardVinculo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardOrigemId" TEXT NOT NULL,
    "cardDestinoId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BpmCardVinculo_cardOrigemId_fkey" FOREIGN KEY ("cardOrigemId") REFERENCES "BpmCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmCardVinculo_cardDestinoId_fkey" FOREIGN KEY ("cardDestinoId") REFERENCES "BpmCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BpmTarefa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "responsavelId" INTEGER,
    "prazo" DATETIME,
    "prioridade" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "checklistJson" TEXT,
    "presetId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "concluidaEm" DATETIME,
    CONSTRAINT "BpmTarefa_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "BpmCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmTarefa_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BpmTarefa_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "BpmTarefaPreset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BpmTarefaPreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pipelineId" TEXT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipoGeracao" TEXT NOT NULL DEFAULT 'UNICA',
    "templateJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BpmCardHistorico" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "valorAnteriorJson" TEXT,
    "valorNovoJson" TEXT,
    "usuarioId" INTEGER,
    "automacaoOrigem" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BpmCardHistorico_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "BpmCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmCardHistorico_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BpmPipelineConfigAuditoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pipelineId" TEXT NOT NULL,
    "adminId" INTEGER NOT NULL,
    "campoAlterado" TEXT NOT NULL,
    "valorAnteriorJson" TEXT,
    "valorNovoJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BpmPipelineConfigAuditoria_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "BpmPipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmPipelineConfigAuditoria_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BpmCardAnexo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT,
    "tamanho" INTEGER,
    "enviadoPorId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BpmCardAnexo_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "BpmCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmCardAnexo_enviadoPorId_fkey" FOREIGN KEY ("enviadoPorId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PessoaEmpresaVinculo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pessoaId" INTEGER NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "funcao" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PessoaEmpresaVinculo_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "socios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PessoaEmpresaVinculo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "clientes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmPipeline_ativo_idx" ON "BpmPipeline"("ativo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmPipelineSetor_setorId_idx" ON "BpmPipelineSetor"("setorId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BpmPipelineSetor_pipelineId_setorId_key" ON "BpmPipelineSetor"("pipelineId", "setorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmEtapa_pipelineId_idx" ON "BpmEtapa"("pipelineId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmEtapa_pipelineId_ordem_idx" ON "BpmEtapa"("pipelineId", "ordem");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmCampo_pipelineId_idx" ON "BpmCampo"("pipelineId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmCampo_etapaId_idx" ON "BpmCampo"("etapaId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmCard_empresaId_idx" ON "BpmCard"("empresaId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmCard_pipelineId_idx" ON "BpmCard"("pipelineId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmCard_etapaId_idx" ON "BpmCard"("etapaId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmCard_responsavelId_idx" ON "BpmCard"("responsavelId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmCard_status_idx" ON "BpmCard"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmCardCampoValor_campoId_idx" ON "BpmCardCampoValor"("campoId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BpmCardCampoValor_cardId_campoId_key" ON "BpmCardCampoValor"("cardId", "campoId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmCardMembro_userId_idx" ON "BpmCardMembro"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BpmCardMembro_cardId_userId_key" ON "BpmCardMembro"("cardId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmCardVinculo_cardDestinoId_idx" ON "BpmCardVinculo"("cardDestinoId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BpmCardVinculo_cardOrigemId_cardDestinoId_key" ON "BpmCardVinculo"("cardOrigemId", "cardDestinoId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmTarefa_cardId_idx" ON "BpmTarefa"("cardId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmTarefa_responsavelId_idx" ON "BpmTarefa"("responsavelId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmTarefa_status_idx" ON "BpmTarefa"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmTarefaPreset_pipelineId_idx" ON "BpmTarefaPreset"("pipelineId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmCardHistorico_cardId_idx" ON "BpmCardHistorico"("cardId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmCardHistorico_createdAt_idx" ON "BpmCardHistorico"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmPipelineConfigAuditoria_pipelineId_idx" ON "BpmPipelineConfigAuditoria"("pipelineId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmPipelineConfigAuditoria_createdAt_idx" ON "BpmPipelineConfigAuditoria"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BpmCardAnexo_cardId_idx" ON "BpmCardAnexo"("cardId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PessoaEmpresaVinculo_empresaId_idx" ON "PessoaEmpresaVinculo"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PessoaEmpresaVinculo_pessoaId_empresaId_key" ON "PessoaEmpresaVinculo"("pessoaId", "empresaId");

COMMIT;
