-- RM-2026-A6F2C9: o SQLite considera CHECK com resultado NULL como válido.
-- Estes triggers completam somente a obrigatoriedade da resposta SIM/NÃO no estado RESPONDIDO.
CREATE TRIGGER "chamados_feedback_respondido_solucao_insert"
BEFORE INSERT ON "chamados_feedback"
FOR EACH ROW
WHEN NEW."status" = 'RESPONDIDO' AND NEW."solucionadaComoEsperado" IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Feedback respondido exige resposta sobre a solução esperada');
END;

CREATE TRIGGER "chamados_feedback_respondido_solucao_update"
BEFORE UPDATE ON "chamados_feedback"
FOR EACH ROW
WHEN NEW."status" = 'RESPONDIDO' AND NEW."solucionadaComoEsperado" IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Feedback respondido exige resposta sobre a solução esperada');
END;
