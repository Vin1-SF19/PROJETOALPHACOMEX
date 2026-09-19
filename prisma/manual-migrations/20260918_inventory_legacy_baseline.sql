-- Baseline documental/replay para tabelas de estoque anteriores ao historico versionado.
-- Em producao existente, os tres CREATE TABLE sao no-op.
-- ListaCompra preserva o drift real: produtoId/categoriaId sem FK fisica.
CREATE TABLE IF NOT EXISTS "Categoria" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "nome" TEXT NOT NULL,
  "cor" TEXT DEFAULT '#6366f1',
  "icone" TEXT DEFAULT 'Package',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Categoria_nome_key" ON "Categoria"("nome");

CREATE TABLE IF NOT EXISTS "ProdutoEstoque" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "imagem" TEXT,
  "nome" TEXT NOT NULL,
  "quantidade" INTEGER NOT NULL DEFAULT 0,
  "estoqueMinimo" INTEGER NOT NULL DEFAULT 1,
  "unidade" TEXT NOT NULL,
  "precoMedio" REAL DEFAULT 0,
  "ultimaCompra" DATETIME,
  "categoriaId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ProdutoEstoque_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ListaCompra" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "produtoId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "quantidadeAtual" INTEGER NOT NULL,
  "minimoEsperado" INTEGER NOT NULL,
  "unidade" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CARRINHO',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "categoriaId" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "ListaCompra_produtoId_key" ON "ListaCompra"("produtoId");

