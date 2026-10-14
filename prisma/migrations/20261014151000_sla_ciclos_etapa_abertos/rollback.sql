-- Reversão protegida: nunca remover instâncias, eventos ou disparos.
-- Se já houver múltiplos ciclos por card/configuração, o primeiro CREATE UNIQUE
-- falha ANTES de remover o índice vigente. O executor deve emitir ROLLBACK e
-- interromper; resolver essa incompatibilidade exige decisão explícita.
BEGIN IMMEDIATE;
CREATE UNIQUE INDEX "BpmSlaInstancia_card_config_rollback_guard"
ON "BpmSlaInstancia"("cardId", "slaConfigId") WHERE "tarefaId" IS NULL;
DROP INDEX "BpmSlaInstancia_card_config_key";
CREATE UNIQUE INDEX "BpmSlaInstancia_card_config_key"
ON "BpmSlaInstancia"("cardId", "slaConfigId") WHERE "tarefaId" IS NULL;
DROP INDEX "BpmSlaInstancia_card_config_rollback_guard";
COMMIT;
