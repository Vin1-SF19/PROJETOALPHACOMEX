-- Aditiva e nullable: cadastros existentes mantêm suas fontes atuais.
-- Aplicação em ambiente compartilhado exige backup e consentimento específico.
ALTER TABLE "Cliente" ADD COLUMN "perfilCadastralJson" JSONB;
