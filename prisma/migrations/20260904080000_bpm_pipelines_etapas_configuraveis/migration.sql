-- RM-2026-F4B6A8 — Fase 1: pipelines e etapas configuráveis (ordem de pipeline,
-- cor/papel inicial-final de etapa, substatus por etapa e transições por
-- pipeline). Migration estritamente aditiva: novas colunas com DEFAULT e novas
-- tabelas; nenhuma coluna/tabela existente é alterada, renomeada ou removida.

-- 1) BpmPipeline: ordem de exibição configurável (hoje implícita por
-- ORDER BY nome ASC em ListarPipelinesBpm/src/actions/bpm/Pipelines.ts).
ALTER TABLE "BpmPipeline" ADD COLUMN "ordem" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "BpmPipeline_ordem_idx" ON "BpmPipeline"("ordem");

-- Backfill: reflete a ordem de exibição atual (alfabética por nome, com
-- desempate por id) para não mudar a ordem visível de nenhum pipeline
-- existente até um admin reordenar manualmente pela UI.
UPDATE "BpmPipeline"
SET "ordem" = (
  SELECT COUNT(*) FROM "BpmPipeline" AS p2
  WHERE p2."nome" < "BpmPipeline"."nome"
     OR (p2."nome" = "BpmPipeline"."nome" AND p2."id" < "BpmPipeline"."id")
);

-- 2) BpmEtapa: cor de exibição + papel de etapa inicial/final configurável.
-- "ordem" e "ativo" já existem no model e não são alterados aqui.
ALTER TABLE "BpmEtapa" ADD COLUMN "cor" TEXT;
ALTER TABLE "BpmEtapa" ADD COLUMN "ehInicial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BpmEtapa" ADD COLUMN "ehFinal" BOOLEAN NOT NULL DEFAULT false;

-- Sem backfill de ehInicial/ehFinal: hoje "inicial"/"final" são implícitos por
-- ordem/nome hardcoded em módulos distintos (lost.ts, status-pos-fechamento.ts
-- etc., ver relatório da Fase 0) e variam por pipeline; marcar automaticamente
-- exigiria inferir regra de negócio não confirmada. Fica false até um admin
-- configurar pela UI em fase futura — nenhum comportamento existente lê essas
-- colunas ainda.

-- 3) Substatus configuráveis por etapa (conceito novo — não existe hoje).
CREATE TABLE "BpmSubStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "etapaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BpmSubStatus_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "BpmEtapa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BpmSubStatus_etapaId_idx" ON "BpmSubStatus"("etapaId");
CREATE INDEX "BpmSubStatus_etapaId_ordem_idx" ON "BpmSubStatus"("etapaId", "ordem");

-- 4) Transições configuráveis por pipeline (conceito novo, tabela dedicada).
-- Mantém "BpmEtapaTransicaoPermitida" intocada: ela hoje é lida por
-- CardFullViewModal.tsx/CardAbertoLayout.tsx só para filtrar sugestões do
-- dropdown de próxima etapa (comportamento de UX curado por pipeline, não
-- pode ser sobrescrito por esta migration). "BpmTransicaoEtapa" é a base
-- separada para enforcement real no servidor em fase futura.
CREATE TABLE "BpmTransicaoEtapa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pipelineId" TEXT NOT NULL,
    "etapaOrigemId" TEXT NOT NULL,
    "etapaDestinoId" TEXT NOT NULL,
    "permitida" BOOLEAN NOT NULL DEFAULT true,
    "origem" TEXT NOT NULL DEFAULT 'AMBOS',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BpmTransicaoEtapa_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "BpmPipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmTransicaoEtapa_etapaOrigemId_fkey" FOREIGN KEY ("etapaOrigemId") REFERENCES "BpmEtapa" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmTransicaoEtapa_etapaDestinoId_fkey" FOREIGN KEY ("etapaDestinoId") REFERENCES "BpmEtapa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BpmTransicaoEtapa_etapaOrigemId_etapaDestinoId_key" ON "BpmTransicaoEtapa"("etapaOrigemId", "etapaDestinoId");
CREATE INDEX "BpmTransicaoEtapa_pipelineId_idx" ON "BpmTransicaoEtapa"("pipelineId");
CREATE INDEX "BpmTransicaoEtapa_etapaOrigemId_idx" ON "BpmTransicaoEtapa"("etapaOrigemId");

-- Backfill: hoje MoverCardBpm/executarMovimentoComRequisitos não impõe
-- nenhuma restrição de BpmEtapaTransicaoPermitida no servidor (ver relatório
-- da Fase 0) — na prática, qualquer etapa pode ir para qualquer outra etapa
-- do mesmo pipeline. Para que uma futura UI/enforcement de restrição não
-- quebre nenhum fluxo já em uso, populamos permitida=true/origem=AMBOS para
-- todo par origem→destino hoje alcançável (todas as combinações dentro do
-- mesmo pipeline).
INSERT INTO "BpmTransicaoEtapa" ("id", "pipelineId", "etapaOrigemId", "etapaDestinoId", "permitida", "origem")
SELECT
  lower(hex(randomblob(16))),
  eo."pipelineId",
  eo."id",
  ed."id",
  1,
  'AMBOS'
FROM "BpmEtapa" eo
JOIN "BpmEtapa" ed ON ed."pipelineId" = eo."pipelineId" AND ed."id" != eo."id";
