-- RM-2026-A6F2C9: preferência de atendimento, prazo desejado e feedback pós-conclusão.
ALTER TABLE "chamados" ADD COLUMN "dataDesejadaConclusao" DATETIME;

ALTER TABLE "chamados" ADD COLUMN "tecnicoSolicitadoId" INTEGER
  CONSTRAINT "chamados_tecnicoSolicitadoId_fkey"
  REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "chamados_tecnicoSolicitadoId_idx"
  ON "chamados"("tecnicoSolicitadoId");

CREATE TABLE "chamados_feedback" (
  "chamadoId" INTEGER NOT NULL PRIMARY KEY,
  "status" TEXT NOT NULL DEFAULT 'PENDENTE',
  "notaRapidezResposta" INTEGER,
  "notaPrazoConclusao" INTEGER,
  "solucionadaComoEsperado" BOOLEAN,
  "comentario" TEXT,
  "notaQualidadeSolucao" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" DATETIME,
  CONSTRAINT "chamados_feedback_chamadoId_fkey"
    FOREIGN KEY ("chamadoId") REFERENCES "chamados" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chamados_feedback_status_check"
    CHECK ("status" IN ('PENDENTE', 'RESPONDIDO', 'RECUSADO')),
  CONSTRAINT "chamados_feedback_notaRapidezResposta_check"
    CHECK (
      "notaRapidezResposta" IS NULL OR
      (typeof("notaRapidezResposta") = 'integer' AND "notaRapidezResposta" BETWEEN 0 AND 5)
    ),
  CONSTRAINT "chamados_feedback_notaPrazoConclusao_check"
    CHECK (
      "notaPrazoConclusao" IS NULL OR
      (typeof("notaPrazoConclusao") = 'integer' AND "notaPrazoConclusao" BETWEEN 0 AND 5)
    ),
  CONSTRAINT "chamados_feedback_notaQualidadeSolucao_check"
    CHECK (
      "notaQualidadeSolucao" IS NULL OR
      (typeof("notaQualidadeSolucao") = 'integer' AND "notaQualidadeSolucao" BETWEEN 0 AND 5)
    ),
  CONSTRAINT "chamados_feedback_estado_check"
    CHECK (
      (
        "status" = 'PENDENTE' AND
        "decidedAt" IS NULL AND
        "notaRapidezResposta" IS NULL AND
        "notaPrazoConclusao" IS NULL AND
        "solucionadaComoEsperado" IS NULL AND
        "comentario" IS NULL AND
        "notaQualidadeSolucao" IS NULL
      ) OR (
        "status" = 'RECUSADO' AND
        "decidedAt" IS NOT NULL AND
        "notaRapidezResposta" IS NULL AND
        "notaPrazoConclusao" IS NULL AND
        "solucionadaComoEsperado" IS NULL AND
        "comentario" IS NULL AND
        "notaQualidadeSolucao" IS NULL
      ) OR (
        "status" = 'RESPONDIDO' AND
        "decidedAt" IS NOT NULL AND
        "notaRapidezResposta" IS NOT NULL AND
        "notaPrazoConclusao" IS NOT NULL AND
        (
          (
            "solucionadaComoEsperado" = 0 AND
            "comentario" IS NOT NULL AND
            length(trim("comentario")) >= 10 AND
            "notaQualidadeSolucao" IS NULL
          ) OR (
            "solucionadaComoEsperado" = 1 AND
            "comentario" IS NULL AND
            "notaQualidadeSolucao" IS NOT NULL
          )
        )
      )
    )
);
