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

- Backup: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-05T13-42-26-709Z.sql`
- SHA-256: `4f66f886d8ce379fdca8a82ada0a3e56a1d7f3bb6e3f400b86cc9a8f889d63c3`
- 96.433.799 bytes, 295 tabelas e 68.807 registros.
- Restauração descartável, integridade e FKs aprovadas.
- Autorização específica recebida para migration aditiva, backfills e aplicação no Turso.

## Baseline

Seleção focada: 13 arquivos, 131 testes; 119 aprovados e 12 falhas preexistentes (11 em `card-modal-integration`, 1 em `lost-actions`).

## File list

- `docs/stories/story-saneamento-ontologico-crm-bpm.md`
