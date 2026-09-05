# Story — Saneamento ontológico completo do CRM/BPM

**Status:** In Progress
**Especificação:** `ONTOLOGIA_CANONICA_CRM_BPM.md` e prompt administrativo de 2026-09-05
**Banco:** Turso de produção, sob gate Vault aprovado em 2026-09-05

## Objetivo

Convergir o CRM/BPM para identidade estável, uma definição canônica de transição, um único comando de movimento e separação explícita entre apresentação, políticas, lifecycle, outcome, substatus e ownership dos dados.

## Critérios de aceite

- [ ] Uma única source of truth runtime define A → B.
- [ ] Todo mutador de `BpmCard.etapaId` usa o comando canônico, salvo migration/repair documentado.
- [ ] Movimento manual e automático avaliam as mesmas policies, requisitos, regras e checklists.
- [ ] Visibilidade, editabilidade, autorização, requisito e validade são independentes.
- [ ] Pipeline, etapa, campo, automação e substatus usam identidade estável.
- [ ] Lifecycle, outcome e substatus possuem estado e invariantes explícitos.
- [ ] Dados nativos especializados possuem owner relacionado e compatibilidade segura.
- [ ] Formulário de etapa possui definição determinística persistida.
- [ ] NoLoss é read model virtual discriminado, não `BpmCard` falso.
- [ ] Consulta de card é pura; primeira visualização é comando explícito.
- [ ] Transição persiste estado, auditoria e outbox atomicamente.
- [ ] SLA e automações reagem ao mesmo comando/evento.
- [ ] Testes de invariantes e regressão são aprovados ou comparados ao baseline documentado.

## Fases

- [x] Fase 0 — diagnóstico, inventário remoto, backup e baseline.
- [ ] Fase 1 — identidades estáveis e invariantes.
- [ ] Fase 2 — `BpmTransicaoEtapa` como definição canônica única.
- [ ] Fase 3 — comando canônico de transição.
- [ ] Fase 4 — convergência de mutadores.
- [ ] Fase 5 — policies e requisitos independentes.
- [ ] Fase 6 — lifecycle, outcome e substatus.
- [ ] Fase 7 — ownership dos dados especializados.
- [ ] Fase 8 — definição/renderização de formulário.
- [ ] Fase 9 — SLA, eventos e automações.
- [ ] Fase 10 — quarentena dos legados.
- [ ] Fase 11 — auditoria final.

## Evidência Vault

- Backup original: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-05T13-42-26-709Z.sql`
- Backup imediatamente anterior à aplicação: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-05T16-18-58-738Z.sql`
- SHA-256: `cab3cfe95e117f1458645f01d7777e1c63bcde24895eb3a2d8681cab58d555a4`
- 96.486.540 bytes, 295 tabelas e 68.909 registros.
- Restauração descartável, integridade e FKs aprovadas.
- Autorização específica recebida para migration aditiva, backfills e aplicação no Turso.

## Implantação em produção — 2026-09-05

- Incidente: páginas dinâmicas de pipeline retornavam 404 porque o código publicado consultava o contrato canônico antes da migration correspondente existir no Turso.
- Migration aplicada: `prisma/migrations/20260905143000_bpm_ontologia_canonica/migration.sql` (`78` statements).
- Pós-validação: `PRAGMA integrity_check=ok`, zero violações de chave estrangeira e zero chaves canônicas nulas.
- Readback: 55 requisitos, 32 formulários e 2 estados de card materializados.
- Smoke da consulta da página: `Revisão de Radar` retornou 9 etapas, 29 campos e 2 cards, todos com `BpmCard.versao` legível.
- Rollback preservado no backup imediatamente anterior à aplicação; nenhum dump foi versionado.

## Baseline

Seleção focada: 13 arquivos, 131 testes; 119 aprovados e 12 falhas preexistentes (11 em `card-modal-integration`, 1 em `lost-actions`).

## File list

- `docs/stories/story-saneamento-ontologico-crm-bpm.md`
