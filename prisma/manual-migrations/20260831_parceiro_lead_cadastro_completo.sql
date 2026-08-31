-- ParceiroLead: campos de cadastro completo (mesmos de Parceiro), sem criar
-- login/senha nem vínculo real — fica só no card virtual do funil de Aquisição
-- até uma promoção manual (PromoverLeadParaParceiro).
ALTER TABLE "parceiro_lead" ADD COLUMN "nomeFantasia" TEXT;
ALTER TABLE "parceiro_lead" ADD COLUMN "tipoParceiro" TEXT;
ALTER TABLE "parceiro_lead" ADD COLUMN "dataNascimento" TEXT;
ALTER TABLE "parceiro_lead" ADD COLUMN "chavePix" TEXT;
ALTER TABLE "parceiro_lead" ADD COLUMN "tipoChavePix" TEXT;
ALTER TABLE "parceiro_lead" ADD COLUMN "nomeBanco" TEXT;
ALTER TABLE "parceiro_lead" ADD COLUMN "agencia" TEXT;
ALTER TABLE "parceiro_lead" ADD COLUMN "conta" TEXT;
ALTER TABLE "parceiro_lead" ADD COLUMN "comissaoPercentual" REAL;
ALTER TABLE "parceiro_lead" ADD COLUMN "dadosConsulta" TEXT;
ALTER TABLE "parceiro_lead" ADD COLUMN "cep" TEXT;
ALTER TABLE "parceiro_lead" ADD COLUMN "logradouro" TEXT;
ALTER TABLE "parceiro_lead" ADD COLUMN "numero" TEXT;
ALTER TABLE "parceiro_lead" ADD COLUMN "complemento" TEXT;
ALTER TABLE "parceiro_lead" ADD COLUMN "bairro" TEXT;
ALTER TABLE "parceiro_lead" ADD COLUMN "responsaveisJson" TEXT;
