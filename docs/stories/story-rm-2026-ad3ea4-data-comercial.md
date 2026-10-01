# RM-2026-AD3EA4 — Data comercial do fechamento
Status: Encerrada — memória permanente registrada (journal, codebase-map, integration-points, decisions); validações pendentes registradas

## Aceite
- [x] Data escolhida obrigatória e válida, persistida sem deslocamento de dia.
- [x] Metas e contratos usam exclusivamente pagamentoConfirmadoEm com limites UTC.
- [x] Retroativo, fronteiras de mês/ano e fusos cobertos por regressão.
- [ ] Investigar históricos sem mutação nem inferência baseada apenas em mes/ano.
- [x] Executar lint, typecheck, test e build; registrar limitações.

## Blueprint Scout recebido
ModalConfirmacaoFechamento → confirmarFechamento → DateTime pagamentoConfirmadoEm → getDadosMetas/getContratos → /PainelAlpha/Metas. Reutilizar rotas, permissões e efeitos existentes. Schema inalterado. mes/ano na criação do contrato não comprovam a data comercial.

## File list
- src/lib/comercial/data-comercial.ts
- src/actions/ContratoComercial.ts
- src/actions/Metas.ts
- src/components/comercial/ModalConfirmacaoFechamento.tsx
- src/components/comercial/ModalGerenciamentoLeads.tsx
- tests/metas/data-comercial.test.ts
- scripts/auditar-datas-comerciais.mts
- docs/stories/story-rm-2026-ad3ea4-data-comercial.md
- .bibble/memory/journal.md

- .bibble/memory/codebase-map.md

- .bibble/memory/integration-points.md

- .bibble/memory/decisions.md

- .bibble/memory/known-errors.md

## Validação e limites
29 testes focados aprovados antes da rodada global. Consulte tmp/rm-ad3ea4 para resultados reais dos gates e fusos. Build bloqueado por EACCES em .env e EOVERFLOW no client Prisma; npm test falhou por EBUSY na pasta coverage. Auditoria somente leitura tentada, indisponível por EACCES no ambiente. Caso informado não revalidado; nenhuma alteração de banco. mes/ano são fornecidos na criação, portanto divergência não comprova erro histórico.

## Entregabilidade
Rota autenticada /PainelAlpha/Metas → MetasClient → gerenciamento de leads → modal → action. Consultas e exibição usam data comercial; integração verificada por inspeção e testes de actions, sem navegador nesta fase.

## Revalidação Nova — 2026-10-01
- [x] Preservar implementação existente e confirmar integração real da rota autenticada.
- [x] Acrescentar três regressões com relógio controlado: retroativo 01/10 → 30/09, mesmo dia e 01/01 → 31/12.
- [x] Executar 18 testes em UTC, America/Sao_Paulo, America/Los_Angeles e Asia/Tokyo: todos aprovados.
- [x] npm run lint e npm run typecheck: exit 0; lint focado: exit 0.
- [x] npm test e npm run build executados: exit 1 por EBUSY em coverage e EOVERFLOW no client Prisma, respectivamente; mesmas limitações dos logs anteriores, sem evidência de regressão do escopo.
- [x] Tentar auditoria histórica somente leitura: exit 1 por ambiente indisponível (EACCES .env / URL_INVALID).
- [ ] Validar registros históricos com acesso ao banco e evidência da data original. O caso informado não foi confirmado nesta sessão; mes/ano não autorizam correção.

Arquivos alterados nesta revalidação: tests/metas/data-comercial.test.ts, esta story e .bibble/memory/journal.md. Evidências locais: tmp/rm-ad3ea4/revalidation/. Nenhuma alteração de schema, migration ou dado real.

DELIVERY_READY: /PainelAlpha/Metas → MetasClient → ModalGerenciamentoLeads → ModalConfirmacaoFechamento → confirmarFechamento → getDadosMetas/getContratos. Caminho confirmado no código, com actions validadas por mocks; navegação em navegador e gates globais de teste/build ficam para verificação.


## Encerramento Scribe — 2026-10-01 — RM-2026-AD3EA4

- [x] Reinspecionar implementação, regressões, rota e botão consumidor reais.
- [x] Consolidar mapa, integrações, convenção técnica e causa corrigida sem alterar código funcional.
- [x] Executar npm run lint, npm run typecheck e npm test; registrar resultados sem inferir aprovação global.
- [x] Atualizar checklist, file list e journal, preservando alterações anteriores.
- [ ] Concluir auditoria histórica com acesso autorizado e evidência da data originalmente escolhida.
- [ ] Obter suíte global/build completos e smoke autenticado antes de promoção pelo fluxo normal.

### Relatório de conclusão local
Implementação existente confirmada: data escolhida validada YYYY-MM-DD, persistência determinística UTC sem fallback do servidor, filtros mensais UTC nas duas actions, mesma data no sync CS&NPS e exibição UTC. Helper compartilhado evita deslocamento nas fronteiras de mês/ano. Esta fase alterou somente documentação; nenhuma alteração de schema, migration, backfill, mutação de banco ou backup foi executada. Backup não necessário para esta fase documental.

Gates desta sessão: npm run lint exit 0; npm run typecheck exit 0; npm test exit 1 (EBUSY no diretório coverage); npx vitest run tests/metas/data-comercial.test.ts --coverage.enabled=false exit 0 (18/18). Logs e códigos: tmp/rm-ad3ea4/closure/. Build não repetido nesta fase; histórico da revalidação registra exit 1 por EOVERFLOW Prisma. A passagem do lint informada pelo worker é evidência anterior, não comprovação de aprovação de todos os gates. Testes mockados não comprovam persistência no banco real; auditoria histórica e smoke em navegador continuam pendentes. Não há aprovação Forge/Probe/Lens global nesta conclusão documental.

Artefato final consumido pelos usuários Comercial/gestores: contabilização e exibição de contratos pela data comercial em /PainelAlpha/Metas. Relatório técnico consumido pela próxima fase/revisão: esta story e memória do projeto, acessíveis pelos caminhos locais da file list. Nenhum visualizador ou download novo é necessário para consumir a correção na UI existente.

Lacuna encontrada: documentação técnica permanente não registrava o helper e seus consumidores. Autoajuste aplicado: acrescentados mapa, integração com exemplo, convenção UTC e causa corrigida; não houve lacuna de rota/botão nem mudança funcional nesta fase.

DELIVERY_READY: /PainelAlpha/Metas (sessão autenticada) → botão Gerenciamento de Leads → ModalGerenciamentoLeads → ModalConfirmacaoFechamento → confirmarFechamento → getDadosMetas/getContratos. Caminho validado por inspeção do código; 18 regressões aprovadas, sem smoke em navegador.

Encerramento documental local PASS. O card segue o fluxo normal de conclusão/revisão, com pendências explícitas; nenhuma promoção, commit, push ou publicação automática foi realizada.

### Registro na memória permanente (Fase 3 — CLOSURE)
- [x] `journal.md` — entrada 2026-10-01 (Scribe, Fase 3 CLOSURE) com causa raiz, solução, gates e pendências.
- [x] `codebase-map.md` — entrada da fonte única de verdade `src/lib/comercial/data-comercial.ts` e seus consumidores.
- [x] `integration-points.md` — caminho de integração escrita → consulta → exibição.
- [x] `decisions.md` — decisão de ancoragem UTC como fonte única de verdade, sem fallback do servidor.
Nenhuma alteração de código funcional nesta fase; apenas documentação/memória.
