-- Scope: remove legacy AlphaCRM tables, replaced by Alpha BPM (D-048).
-- Pré-condição validada em produção (Turso) em 2026-08-03: as 3 tabelas estavam
-- vazias (0 registros cada) — nenhuma migração de dados foi necessária.
-- Nenhum outro código do repositório referencia estas tabelas após a remoção de
-- src/actions/CRM.ts e da seleção crm_oportunidades/crm_contatos em
-- src/lib/cs-nps/exportar-dados.ts.

PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;

DROP TABLE IF EXISTS "crm_atividades";
DROP TABLE IF EXISTS "crm_oportunidades";
DROP TABLE IF EXISTS "crm_contatos";

COMMIT;
