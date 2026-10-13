# Vault — Migração RD Station → Painel Alpha — 2026-10-13

## Decisão

**APROVADO para a execução descrita, após autorização explícita do usuário em 2026-10-13.** A aprovação cobre somente os dez funis mapeados, os leads associados e seus históricos/atividades disponíveis, a criação de vínculos/cards Alpha e as tabelas aditivas de proveniência/correção. Não cobre exclusões, atualização de negócios no RD, outros funis, nem alteração das tabelas existentes.

## Ambiente e dados afetados

- Origem somente leitura: RD Station CRM API v1, token configurado em `RD_STATION_CRM_V1_TOKEN`.
- Destino: banco Turso remoto configurado por `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` em `.env.local`.
- Escopo de referência: 1.212 negócios em dez funis, com históricos de etapa e atividades que a consulta atual conseguir recuperar. O funil Assessoria Smart permanece fora.
- Escritas previstas no Alpha: até 1.212 `BpmCard`, vínculos para `Cliente` existente ou clientes de origem/enriquecidos conforme o plano, eventos externos, lote de importação e marcação de proveniência. Deal IDs distintos continuam como cards distintos mesmo quando compartilham CNPJ.
- Esquema: quatro tabelas novas e índices associados. Nenhuma coluna, tabela, índice, chave ou registro existente será removido.

## Passos e controles

1. Buscar novamente os dez funis por paginação; consultar o detalhe e as atividades por negócio; calcular fingerprint e reconciliação sem gravar dados.
2. Bloquear aplicação se faltar detalhe/atividade por erro de API, se existir etapa sem destino Alpha, ou se não houver backup recente e íntegro.
3. Revalidar o backup integral imediatamente antes da primeira escrita.
4. Aplicar exclusivamente o SQL aditivo `prisma/migrations/20261013110000_rd_station_external_history/migration.sql`.
5. Gravar cada card, vínculo de origem e eventos em transação idempotente por identificador RD. Reexecução não cria duplicatas.
6. Reconciliar totais de cards e eventos no resultado final.

## Impacto e riscos

- Risco de divergência de etapa/responsável/identidade: mitigado pelo mapeamento explícito, exceções que bloqueiam a aplicação e reconciliação por funil/etapa.
- Risco de interrupção de rede/API durante a carga: retomar a mesma carga usando IDs e chaves únicas; transações por card evitam registros parciais daquele card.
- Risco de quota da consulta cadastral de CNPJ: execução limitada pelo cliente já configurado; a origem RD continua intacta.
- A carga aumenta o volume de clientes/cards/eventos no Turso e pode afetar temporariamente sincronização e consultas do CRM.
- Os payloads brutos RD contêm dados de negócio e ficam restritos no banco Alpha; relatórios/logs versionados registram apenas totais, nunca payloads pessoais ou tokens.

## Alternativa não destrutiva

Manter a exportação somente leitura e adiar a aplicação. A camada de proveniência proposta é aditiva; os cards e eventos também podem ser removidos por lote identificado antes de serem utilizados/alterados pelos usuários.

## Backup verificado

- Arquivo: `database-backups/pre-change/painelalpha_turso_pre_change_2026-10-13T18-41-59-079Z.sql`
- Manifesto: `database-backups/pre-change/painelalpha_turso_pre_change_2026-10-13T18-41-59-079Z.manifest.json`
- SHA-256: `e45ca8f9d7cbf4f63df75608c2ff5b2abb7bc1f5437a07118428847661ff9f67`
- Tamanho: 216.708.721 bytes
- Inventário: 332 tabelas, 226.746 linhas
- Evidência da verificação: hash e tamanho conferidos; restauração local passou `integrity_check`; `foreign_key_check` sem violações.
- Requisito operacional: o importador verifica novamente integridade/idade (<48h) no momento de uso. Nenhuma carga prossegue se essa checagem falhar.

## Rollback

- Se a falha ocorrer durante uma transação de card, reverter a transação; os IDs determinísticos permitem retomar.
- Para reversão completa antes de uso operacional, selecionar as origens pelo lote/provedor RD, remover correções/eventos/vínculos/cards importados em dependência e remover apenas `Cliente` criado pela carga que não possua referência posterior. Não remover clientes existentes nem clientes que receberam novos vínculos/uso.
- As quatro tabelas novas podem permanecer vazias após rollback, evitando qualquer reconstrução de estruturas preexistentes.
- Se uma divergência for detectada depois que usuários editarem/moverem cards, interromper a reversão em massa e reconciliar individualmente para preservar alterações novas.

## Histórico do controle

- 2026-10-13: autorização explícita do usuário para executar a migração RD → Painel Alpha conforme o plano.
- 2026-10-13: backup integral revalidado antes da implementação/aplicação; nenhuma escrita foi feita durante auditoria/preflight.

## Resultado da execução

- Preflight final consultou 1.212/1.212 negócios nos dez funis configurados: 0 falhas de API e 0 etapas sem destino Alpha. Assessoria Smart permaneceu fora do escopo.
- Fingerprint da fotografia aplicada: `0d45bcd4ab61dbca58562b32397e53502d1828a72799f658f5bd88c533c2a29f`.
- Contagens atuais da origem: 7.107 históricos de etapa, 3.605 atividades e 165 negócios sem atividade retornada. A quantidade de eventos de etapa estava diferente da auditoria anterior, por mudança de dados entre fotografias.
- Resultado reconciliado no Turso: 1.212 cards, 7.107 eventos `DEAL_STAGE_HISTORY`, 3.605 eventos `ACTIVITY_*`, total de 10.712 eventos; 1.212 vínculos de proveniência/tags e 0 associações de evento sem origem. Os 47 deals além do número de CNPJs distintos seguem separados por ID RD.
- Distribuição de cards confirmada: Revisão de Estimativa do Radar 572; Diretoria Operacional Vitor 1; Financeiro Entrada 16; Financeiro Êxito 221; Operacional Protocolo 8; Stand-by 35; Habilitação do Radar 151; Operacional Maria 16; Deferidos 176; Operacional Mariah 16.
- 979 cards e 9.214 eventos foram inseridos pelo batch concluído `rdimp_630af8b7f81bfe76566870b54cea`. A tentativa anterior tinha 233 cards e 1.497 eventos; foi retomada por IDs estáveis e seu batch foi marcado `RETOMADO`. Na conferência dos 233 registros parciais, a API atual retornou um histórico de etapa adicional; ele foi acrescentado pela chave estável do evento, sem substituir o payload original do detalhe já salvo. O total final passou a coincidir com a origem consultada.
- A consulta cadastral não enriqueceu 489 CNPJs; os leads correspondentes foram mantidos usando os dados de nome/organização disponíveis no RD, sem fallback por nome quando havia conflito de CNPJ com cliente existente.
- Não houve escrita ou exclusão na origem RD. Não foi executado rollback; os registros permanecem identificáveis pelo provider, lote e IDs RD.
- O backup descrito acima foi revalidado pelo gate automatizado imediatamente antes da migration aditiva e da gravação.
