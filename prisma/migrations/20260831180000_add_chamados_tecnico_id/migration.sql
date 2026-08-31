-- Chamados — fluxo "Assumir Chamado".
-- Migration 100% aditiva: 1 ADD COLUMN nullable + 1 índice.
-- Nenhum dado existente é alterado ou removido.

ALTER TABLE "chamados" ADD COLUMN "tecnicoId" INTEGER;

CREATE INDEX "chamados_tecnicoId_idx" ON "chamados"("tecnicoId");
