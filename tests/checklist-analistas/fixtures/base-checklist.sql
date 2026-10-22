-- Fixture sintética: DDL dos modelos pertinentes extraído da base 69047dee.
-- Sem dados pessoais e sem acesso a banco/ambiente real.
PRAGMA foreign_keys=ON;

CREATE TABLE "usuarios" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'User',
    "permissoes" TEXT,
    "imagemUrl" TEXT,
    "esconderBloqueados" BOOLEAN NOT NULL DEFAULT false,
    "ultimo_aviso" TEXT,
    "atalhos" TEXT DEFAULT 'radar,chamados',
    "tema_interface" TEXT DEFAULT 'blue',
    "densidade_painel" TEXT DEFAULT 'default',
    "bibble_ativo" BOOLEAN NOT NULL DEFAULT true,
    "onboarding_ialpha_visto" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_blueprint_visto" BOOLEAN NOT NULL DEFAULT false,
    "cargo" TEXT,
    "data_contratacao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "cpf" TEXT,
    "data_nascimento" TEXT,
    "telefone" TEXT,
    "telefone_corporativo" TEXT,
    "callixHabilitado" BOOLEAN NOT NULL DEFAULT false,
    "callixUserId" TEXT,
    "contato_emerg_1_nome" TEXT,
    "contato_emerg_1_tel" TEXT,
    "contato_emerg_2_nome" TEXT,
    "contato_emerg_2_tel" TEXT,
    "observacoes_internas" TEXT,
    "meta_visivel_painel" BOOLEAN NOT NULL DEFAULT true,
    "reset_token" TEXT,
    "reset_expires" DATETIME,
    "token_onyx" TEXT,
    "senhaTemporaria" BOOLEAN NOT NULL DEFAULT false,
    "primeiroAcessoEm" DATETIME,
    "authSessionVersion" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE "Cliente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cnpj" TEXT,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "dataConstituicao" TEXT,
    "uf" TEXT,
    "municipio" TEXT,
    "regimeTributario" TEXT,
    "capitalSocial" TEXT,
    "situacaoCadastral" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ClienteOperacional" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "imagemUrl" TEXT
);

CREATE TABLE "operacional_clientes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "embasamento" TEXT NOT NULL,
    "progresso" INTEGER NOT NULL DEFAULT 0,
    "mesProtocolo" TEXT,
    "linkGrupo" TEXT,
    "tipo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clienteOperacionalId" TEXT NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "pastaChecklistId" TEXT,
    CONSTRAINT "operacional_clientes_clienteOperacionalId_fkey" FOREIGN KEY ("clienteOperacionalId") REFERENCES "ClienteOperacional" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "operacional_clientes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "operacional_clientes_pastaChecklistId_fkey" FOREIGN KEY ("pastaChecklistId") REFERENCES "PastaChecklist" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "PastaChecklist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Checklist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "Checklist_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "operacional_clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ModeloItemChecklist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "secao" TEXT NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ItemChecklist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checklistId" TEXT NOT NULL,
    "modeloItemId" TEXT,
    "codigo" TEXT NOT NULL,
    "secao" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "complemento" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "observacao" TEXT,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT true,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "ItemChecklist_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "DocumentoChecklist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedByCliente" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "deletadoEm" DATETIME,
    "deletadoPorCliente" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentoChecklist_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemChecklist" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "NotificacaoCliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT,
    "empresaId" TEXT NOT NULL,
    "itemId" TEXT,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "criadaEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificacaoCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "ClienteOperacional" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Auditoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "acao" TEXT NOT NULL,
    "detalhes" TEXT,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Auditoria_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BpmCard" ("id" TEXT NOT NULL PRIMARY KEY, "empresaId" INTEGER NOT NULL REFERENCES "Cliente"("id"), "versao" INTEGER NOT NULL DEFAULT 0);

CREATE UNIQUE INDEX "usuarios_usuario_key" ON "usuarios"("usuario");

CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

CREATE UNIQUE INDEX "Cliente_cnpj_key" ON "Cliente"("cnpj");

CREATE INDEX "Cliente_razaoSocial_idx" ON "Cliente"("razaoSocial");

CREATE INDEX "Cliente_status_idx" ON "Cliente"("status");

CREATE UNIQUE INDEX "ClienteOperacional_email_key" ON "ClienteOperacional"("email");

CREATE INDEX "NotificacaoCliente_clienteId_lida_idx" ON "NotificacaoCliente"("clienteId", "lida");

CREATE INDEX "NotificacaoCliente_clienteId_criadaEm_idx" ON "NotificacaoCliente"("clienteId", "criadaEm");

CREATE INDEX "operacional_clientes_pastaChecklistId_idx" ON "operacional_clientes"("pastaChecklistId");

CREATE INDEX "operacional_clientes_clienteId_idx" ON "operacional_clientes"("clienteId");

CREATE UNIQUE INDEX "PastaChecklist_nome_key" ON "PastaChecklist"("nome");

CREATE UNIQUE INDEX "Checklist_empresaId_tipo_key" ON "Checklist"("empresaId", "tipo");

CREATE INDEX "ModeloItemChecklist_tipo_secao_idx" ON "ModeloItemChecklist"("tipo", "secao");

CREATE INDEX "ItemChecklist_modeloItemId_idx" ON "ItemChecklist"("modeloItemId");

CREATE INDEX "DocumentoChecklist_itemId_deletadoEm_idx" ON "DocumentoChecklist"("itemId", "deletadoEm");
