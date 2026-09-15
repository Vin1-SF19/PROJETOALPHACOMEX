-- Histórico durável de mesclagens. Os arquivos permanecem no storage privado;
-- o banco mantém apenas referências, metadados e totais operacionais.
CREATE TABLE "MesclagemHistorico" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "criadoPorId" INTEGER NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "principalNome" TEXT NOT NULL,
    "principalStorageKey" TEXT NOT NULL,
    "principalTamanhoBytes" INTEGER NOT NULL,
    "complementarNome" TEXT NOT NULL,
    "complementarStorageKey" TEXT NOT NULL,
    "complementarTamanhoBytes" INTEGER NOT NULL,
    "resultadoNome" TEXT NOT NULL,
    "resultadoStorageKey" TEXT NOT NULL,
    "resultadoTamanhoBytes" INTEGER NOT NULL,
    "empresasProcessadas" INTEGER NOT NULL,
    "empresasComCorrespondencia" INTEGER NOT NULL,
    "empresasSemCorrespondencia" INTEGER NOT NULL,
    "linhasResultado" INTEGER NOT NULL,
    CONSTRAINT "MesclagemHistorico_criadoPorId_fkey"
      FOREIGN KEY ("criadoPorId") REFERENCES "usuarios" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "MesclagemHistorico_criadoPorId_criadoEm_idx"
  ON "MesclagemHistorico"("criadoPorId", "criadoEm");

CREATE INDEX "MesclagemHistorico_criadoEm_idx"
  ON "MesclagemHistorico"("criadoEm");
