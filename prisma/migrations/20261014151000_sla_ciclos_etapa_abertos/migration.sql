-- Um ciclo encerrado permanece como histórico; somente o ciclo aberto é único.
-- Executar em transação com a importação revisada pelo Vault.
-- O índice de tarefas permanece inalterado.
DROP INDEX "BpmSlaInstancia_card_config_key";
CREATE UNIQUE INDEX "BpmSlaInstancia_card_config_key"
ON "BpmSlaInstancia"("cardId", "slaConfigId")
WHERE "tarefaId" IS NULL
  AND "concluidoEm" IS NULL
  AND "status" NOT IN ('CONCLUIDO', 'CANCELADO');
