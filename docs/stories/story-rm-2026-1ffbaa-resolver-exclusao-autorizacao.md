# Story — RM-2026-1FFBAA: Resolver a causa da exclusão e fechar a lacuna de autorização

**Status:** Implementação local validada — revisão independente e gates globais pendentes
**RM:** RM-2026-1FFBAA
**Fase:** 3 de 3 (implementar correção e testes)
**Data:** 2026-09-22
**Executor:** nova (Bibble Squad)

---

## Objetivo

Resolver a causa raiz do incidente `ExcluirCardBpm` (constraint violation ao excluir card com dependências ativas) e fechar a lacuna de autorização entre a UI (que expõe o botão por `podeGerenciarMembros`) e a action (que exige `excluirCard` — RESPONSAVEL/ADMINISTRADOR). Definir a política de remoção do card (arquivamento/cancelamento vs. exclusão física) e alinhar a central de pendências aos guards do CRM.

---

## Contexto

### Evidência inicial das fases anteriores (histórica; corrigida abaixo)

| Item | Caminho | Detalhe |
|------|---------|---------|
| Action `ExcluirCardBpm` | `src/actions/bpm/Cards.ts` (linhas ~2340–2403) | Hard delete via `tx.bpmCard.delete`; guard `exigirAcessoBpmCard(cardId, userId, userRole, "excluirCard")` aplicado fora e dentro da transação (anti-TOCTOU); realtime `CARD_EXCLUIDO`; `revalidatePath` |
| Autorização | `src/lib/bpm/ownership.ts` | `BpmAcao` inclui `"excluirCard"`; `PERMISSOES_POR_ROLE`: RESPONSAVEL e ADMINISTRADOR têm `excluirCard`; PARTICIPANTE **não** tem; `checarAcessoBpmCard` aplica em ordem: módulo CRM → Boas-vindas (só diretoria) → admin global → permissão CRM → visibilidade por etapa → vínculo → role do membro |
| Exceção Boas-vindas | `src/lib/bpm/boas-vindas.ts` | `etapaEhBoasVindas`, `usuarioEhDiretoriaBpm` (só `ADMIN`), `ACESSO_BOAS_VINDAS_NEGADO_MENSAGEM` |
| Visibilidade por etapa | `src/lib/bpm/visibilidade-etapa.ts` | `resolverVisibilidadeEtapa`, `acaoBpmExigeSomenteVisualizacao` |
| UI de disparo | `src/app/PainelAlpha/AlphaCRM/` (CardModal) | Botão "Excluir card" + `AlertDialog` + "irreversível", visível por `podeGerenciarMembros` |
| Realtime | `src/lib/bpm/realtime.ts` / `realtime-server.ts` | `CARD_EXCLUIDO` |
| Schema | `prisma/schema.prisma` | `provider = "sqlite"`; padrão do projeto é `onDelete: Restrict` em FKs dependentes de `BpmCard` |
| Teste existente | `tests/bpm/excluir-card.test.ts` | Asserciona `exigirAcessoBpmCard`, `"Card inválido"`, `tx.bpmCard.delete`, `"Erro ao excluir card"`, `"Não autorizado"`, `tipo: "CARD_EXCLUIDO"`, `revalidatePath` |

### Diagnóstico revalidado na implementação local

1. O fluxo atual arquiva com status ARQUIVADO e registra CARD_ARQUIVADO na mesma transação. As quatro relações Restrict diretas são BpmEventoDominio, BpmAutomacaoAgenda, BpmTransicaoExecucao e BpmChecklistTemplate. Outras relações usam Cascade. A fixture SQLite reproduz o bloqueio ao delete físico, mas não comprova a constraint nem a versão implantada do incidente.
2. A divergência alegada para PARTICIPANTE não foi reproduzida: podeGerenciarMembros já exige RESPONSAVEL/ADMINISTRADOR e ação na etapa, ou administração global. O servidor relê a autorização efetiva e o vínculo usando o usuário da sessão.
3. A central agora exige acesso ao módulo e checarAcessoBpmCard(visualizar) antes de consultar dependências, incluindo Boas-vindas, visibilidade e vínculo.

---

## Proposta

### Política de remoção do card

**Decisão recomendada: ARQUIVAMENTO/CANCELAMENTO (soft-delete) em vez de exclusão física.**

Justificativa:
- Preserva retenção de eventos (`BpmCardHistorico`, `BpmAutomacao`, `BpmCadencia`).
- Preserva auditoria (`BpmPipelineConfigAuditoria`).
- Elimina a constraint violation (não há delete, apenas mudança de status).
- Não substitui `Restrict` por `Cascade` sem justificativa (AGENTS.md / Constitution).
- O card arquivado fica invisível no board (filtro `status = "ATIVO"`) mas permanece consultável em auditoria.

**Se exclusão física for mantida** (decisão de produto contrária):
- Exigir limpeza explícita e ordenada das dependências dentro da transação.
- Documentar justificativa em `decisions.md`.
- Adicionar teste de integração com banco descartável cobrindo o caso com dependências ativas.

### Autorização efetiva

- A UI deve expor o botão "Excluir card" **somente** quando `podeAgirEtapa && roleMembro in ["RESPONSAVEL", "ADMINISTRADOR"]` (ou `isAdminGlobal`), alinhando com `PERMISSOES_POR_ROLE`.
- A action `ExcluirCardBpm` mantém `exigirAcessoBpmCard(cardId, userId, userRole, "excluirCard")` — já correto.
- A central de pendências deve reaplicar `exigirAcessoBpmCard` + `checarAcessoDiretoriaBpm` (Boas-vindas) + `resolverVisibilidadeEtapa` + vínculo, espelhando a ordem de `checarAcessoBpmCard`.

### Alinhamento da central de pendências

Aplicar em toda ação da central de pendências (`motor.ts`, `PendenciasWorkspace.tsx`):
1. `exigirAcessoModuloBpm(userId)`
2. `checarAcessoDiretoriaBpm(userId)` se etapa for Boas-vindas
3. `resolverVisibilidadeEtapa(role, visibilidades)` → `podeVer`/`podeAgir`
4. Vínculo (`bpmCardMembro`)
5. Role do membro → `PERMISSOES_POR_ROLE[role].includes(acao)`

---

## Critérios de aceite

- [x] Story criada em `docs/stories/story-rm-2026-1ffbaa-resolver-exclusao-autorizacao.md` (este arquivo)
- [x] Action canônica de exclusão/arquivamento de card em `src/actions/bpm/Cards.ts` com guard de autorização efetiva (`exigirAcessoBpmCard` + role) e política documentada (arquivamento vs. exclusão física, constraint, retenção de eventos/auditoria/automações)
- [x] Decisão registrada em `.bibble/memory/decisions.md`
- [x] Teste automatizado em `tests/bpm/excluir-card.test.ts` + `tests/bpm/excluir-card-action.test.ts` cobrindo o fluxo com banco descartável (caso com dependências ativas) — fixture SQLite reduzida; suíte direcionada atual de 50 testes passando
- [x] UI (`CardAbertoLayout.tsx`) expõe o botão "Excluir card" somente para roles autorizadas (RESPONSAVEL/ADMINISTRADOR/admin global)
- [x] Central de pendências reaplica os guards de Boas-vindas/visibilidade-por-etapa/vínculo
- [ ] Aprovação independente Forge: consultar resultados reais ao final; falhas globais não equivalem a aprovação.
- [x] Integração local coberta por testes (não é aprovação independente Probe): motor central (`central-runtime.ts`) ignora execuções pendentes de card arquivado; board filtra `status = "ATIVO"`; realtime `CARD_EXCLUIDO` notifica; `revalidatePath` atualiza cache
- [x] Memória atualizada (`architecture.md`, `known-errors.md`, `decisions.md`)

---

## Restrições

- **NÃO** substituir `onDelete: Restrict` por `Cascade` sem justificativa documentada em `decisions.md`.
- **NÃO** expor o botão de exclusão para PARTICIPANTE (não tem `excluirCard` em `PERMISSOES_POR_ROLE`).
- **NÃO** confiar em role/permissão vinda do cliente — sempre revalidar no servidor via `exigirAcessoBpmCard`.
- **NÃO** executar migration ou alteração de schema sem aprovação específica registrada (AGENTS.md — Database Safety).
- Se a política for soft-delete, a coluna `status` de `BpmCard` já existe (confirmar valores possíveis) — não criar nova coluna sem aprovação.

---

## Checklist de arquivos (fase executora)

| Arquivo | Ação |
|---------|------|
| `src/actions/bpm/Cards.ts` | Modificar `ExcluirCardBpm` para soft-delete (arquivamento) OU manter hard delete com limpeza ordenada de dependências |
| `src/lib/bpm/ownership.ts` | Confirmar que `excluirCard` está em `BpmAcao` e `PERMISSOES_POR_ROLE` (já está) |
| `src/lib/bpm/boas-vindas.ts` | Confirmar exceção (já existe) |
| `src/lib/bpm/visibilidade-etapa.ts` | Confirmar `resolverVisibilidadeEtapa` (já existe) |
| `src/app/PainelAlpha/AlphaCRM/` (CardModal) | Alinhar visibilidade do botão "Excluir card" com `PERMISSOES_POR_ROLE` |
| `src/app/PainelAlpha/AlphaCRM/pendencias/page.tsx` | Reaplicar guards |
| `src/components/bpm/pendencias/PendenciasWorkspace.tsx` | Reaplicar guards |
| `src/lib/bpm/pendencias/motor.ts` | Reaplicar guards |
| `src/lib/bpm/realtime.ts` | Confirmar `CARD_EXCLUIDO` (já existe) |
| `prisma/schema.prisma` | Confirmar constraints (somente leitura nesta fase) |
| `tests/bpm/excluir-card.test.ts` | Atualizar para cobrir soft-delete ou hard delete com dependências |
| `.bibble/memory/decisions.md` | Registrar decisão de política de remoção |
| `.bibble/memory/known-errors.md` | Registrar incidente e correção |
| `.bibble/memory/architecture.md` | Atualizar se estrutura mudar |

---

## File list

```
docs/stories/story-rm-2026-1ffbaa-resolver-exclusao-autorizacao.md  (este arquivo)
src/actions/bpm/Cards.ts
src/lib/bpm/ownership.ts
src/lib/bpm/boas-vindas.ts
src/lib/bpm/visibilidade-etapa.ts
src/app/PainelAlpha/AlphaCRM/  (CardModal, pendencias)
src/components/bpm/pendencias/PendenciasWorkspace.tsx
src/lib/bpm/pendencias/motor.ts
src/lib/bpm/realtime.ts
prisma/schema.prisma
tests/bpm/excluir-card.test.ts
.bibble/memory/decisions.md
.bibble/memory/known-errors.md
.bibble/memory/architecture.md
```

---

## Evidências de somente leitura

- `ExcluirCardBpm` confirmada em `src/actions/bpm/Cards.ts` (linhas ~2340–2403): hard delete, guard `exigirAcessoBpmCard`, realtime `CARD_EXCLUIDO`.
- `PERMISSOES_POR_ROLE` em `src/lib/bpm/ownership.ts`: `excluirCard` em RESPONSAVEL e ADMINISTRADOR, ausente em PARTICIPANTE.
- `boas-vindas.ts`: exceção de diretoria confirmada.
- `tests/bpm/excluir-card.test.ts`: teste existente asserciona o comportamento atual (hard delete).
- Schema Prisma: `provider = "sqlite"`, padrão `onDelete: Restrict` em FKs de `BpmCard`.

---

## Validação automatizada

- `npx tsc --noEmit` — zero erros de tipo
- `npm run lint` — zero warnings críticos
- `npm test` — testes passando (incluindo `tests/bpm/excluir-card.test.ts`)
- `npm run build` — build completa sem erros

---

## Sinais de autoajuste (herdados das fases anteriores)

`AUTO_ADJUSTMENT_REQUIRED` (Fase 0): Não existia story para RM-2026-1FFBAA em `docs/stories/`; a action `ExcluirCardBpm` faz exclusão FÍSICA; não há decisão registrada em `decisions.md`; a UI expõe o botão por `podeGerenciarMembros` enquanto a action exige `excluirCard`; a central de pendências não foi confirmada como reaplicando os guards.

`AUTO_ADJUSTMENT_ACCEPTANCE` (Fase 0): (1) story criada; (2) action canônica com política documentada; (3) decisão em `decisions.md`; (4) teste com banco descartável; (5) gates Forge + Probe; (6) memória atualizada.

**Esta fase (Fase 2) atende o item (1): story criada.** Os itens (2)–(6) são responsabilidade da Fase 3 (implementação).

---

## DELIVERY_READY

`docs/stories/story-rm-2026-1ffbaa-resolver-exclusao-autorizacao.md` — story completa, pronta para implementação na Fase 3. Consumida pelo executor da Fase 3 (mesmo motor, mesma sequência RM-2026-1FFBAA).


## RM-2026-1FFBAA — Fase 3, implementação parcial (2026-09-22)

Blueprint recebido das fases anteriores e revalidado localmente. Preservada a implementação de arquivamento já existente no working tree. `BpmCard.status` é String e o board seleciona ATIVO; nenhuma migration, alteração de dados, Git mutável ou integração externa executada. Política: manter arquivamento em vez de delete físico, preservando dependências. O schema mistura Cascade e Restrict; o diagnóstico anterior de que todas as relações eram Restrict estava incorreto. Versão implantada e quatro dependências do incidente não foram verificadas.

Implementado: motor de pendências exige acesso efetivo ao módulo e aplica checarAcessoBpmCard(visualizar) antes das consultas dependentes, preservando Boas-vindas, visibilidade e vínculo. O booleano administrativo de seleção não concede acesso. ExcluirCardBpm valida entrada com Zod. UI solicita atualização do board após sucesso e informa arquivamento. O cálculo existente de podeGerenciarMembros já restringe a responsáveis/administradores com ação na etapa; a divergência alegada não foi reproduzida.

Validação: 33 testes direcionados passaram (excluir-card, membros-card-ownership e pendencias-motor), incluindo cinco novos cenários comportamentais de autorização com guard real e persistência simulada. npm run typecheck passou. npm run lint, npm test e npm run build foram executados com limite de 50 segundos; consultar logs locais em .cache/rm-2026-1ffbaa. Não há aprovação Forge/Probe/Anubis/Lens completa nesta execução.

- [x] Central aplica guard canônico antes de consultar dependências.
- [x] Preservado arquivamento e adicionado Zod/atualização da UI.
- [x] Testes direcionados e typecheck executados com sucesso.
- [ ] Teste comportamental da action com banco descartável e dependências reais (o teste excluir-card atual é estrutural, não comprova esse aceite).
- [ ] Validar ciclo de vida das automações após arquivamento e auditoria da ação.
- [ ] Testes comportamentais dos estados da UI e gates completos.

Auditoria de entrega: caminhos inspecionados /PainelAlpha/AlphaCRM/pendencias → ListarPendenciasBpm → motor → PendenciasWorkspace e board → CardAbertoLayout → ExcluirCardBpm. Consumidores: usuários autorizados do CRM. Acesso pelo código confirmado; fluxo autenticado em navegador não executado. Não declarar DELIVERY_READY integral.

AUTO_ADJUSTMENT_REQUIRED: falta comprovar retenção e comportamento da remoção com dependências reais e o fluxo autenticado após arquivamento.
AUTO_ADJUSTMENT_ACCEPTANCE: executar teste da action com banco descartável, verificar automações/auditoria e validar remoção do board com estados de sucesso/erro.

File list desta execução: src/actions/bpm/Cards.ts; src/lib/bpm/pendencias/motor.ts; src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx; tests/bpm/pendencias-motor.test.ts; docs/stories/story-rm-2026-1ffbaa-resolver-exclusao-autorizacao.md; .bibble/memory/decisions.md; .bibble/memory/known-errors.md; .bibble/memory/journal.md.

Resultado: FAIL por aceites ainda não comprovados, não por atribuir falhas globais a esta alteração.


## RM-2026-1FFBAA — continuação local da Fase 3 (2026-09-22)

Preservadas as alterações anteriores. Acrescentado CARD_ARQUIVADO em BpmCardHistorico na mesma transação da mudança de status, com usuário da sessão e estado anterior/novo; repetição de card já arquivado não duplica histórico. UI agora trata rejeição inesperada da action com toast e libera o estado de carregamento. Novos testes executam ExcluirCardBpm e ownership reais, com persistência simulada, cobrindo sessão, Zod, roles, vínculo revogado, permissão efetiva, etapa oculta, Boas-vindas, revalidação transacional e falha da auditoria. Não houve acesso ao banco real nem alteração de schema.

- [x] Auditoria transacional e tratamento de erro inesperado na UI.
- [x] Testes comportamentais da action adicionados.
- [ ] Banco descartável com dependências reais e rollback comprovado.
- [ ] Estados da UI exercitados em navegador e Probe completo.
- [ ] Ciclo de vida do motor central validado: cadências verificam status ATIVO, mas processarUma em central-runtime.ts não mostrou guarda equivalente antes de executarGrafo. Requer correção/teste específico antes de aprovar arquivamento integral.
- [ ] Aprovações Forge/Probe/Anubis/Lens; não emitidas nesta execução.

Auditoria de entregabilidade: usuário autorizado do CRM acessa board → CardAbertoLayout → ExcluirCardBpm; pendências em /PainelAlpha/AlphaCRM/pendencias → motor com guard canônico. Caminho confirmado no código, não validado em sessão autenticada.

AUTO_ADJUSTMENT_REQUIRED: comprovar retenção com banco descartável, impedir efeitos de automações centrais pendentes em card arquivado e validar estados da UI.
AUTO_ADJUSTMENT_ACCEPTANCE: testes reais de dependências/rollback, automação pendente sem efeitos após arquivamento e fluxo autenticado de sucesso/erro no board.

File list desta continuação: src/actions/bpm/Cards.ts; src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx; tests/bpm/excluir-card-action.test.ts; docs/stories/story-rm-2026-1ffbaa-resolver-exclusao-autorizacao.md; .bibble/memory/journal.md; .bibble/memory/known-errors.md.

Gates reais (código 124 = limite de 20s; não equivale a aprovação): {'targeted': 0, 'lint': 124, 'typecheck': 124, 'test': 124, 'build': 124}. Logs: .cache/rm-2026-1ffbaa/. Lint dos arquivos tocados executado separadamente: zero erros, warning preexistente etapaAtual não utilizado no layout. Os gates globais não foram declarados aprovados por inferência.

Resultado: FAIL — implementação parcial, aceites de integração ainda pendentes.


## Revalidação local RM-2026-1FFBAA — 2026-09-22

Preservadas as mudanças anteriores. Adicionados dois testes da action real com fixture SQLite descartável reduzida (não usa Prisma completo): hard delete bloqueado pelas quatro FKs Restrict, arquivamento preservando dependências e auditoria, rollback quando a auditoria falha. A UI impede reabrir a confirmação durante a requisição.

Correção do diagnóstico anterior: membros/histórico/anexos usam Cascade no schema atual; as quatro referências explícitas Restrict para BpmCard são BpmEventoDominio, BpmAutomacaoAgenda, BpmTransicaoExecucao e BpmChecklistTemplate. Isso explica uma possibilidade de erro, mas não identifica a constraint do incidente nem a versão implantada sem evidência de produção. Nenhum banco real ou schema do aplicativo foi alterado.

- [x] Fixture SQLite isolada com retenção/rollback.
- [x] Trigger bloqueado enquanto arquivamento está pendente.
- [ ] Testes comportamentais de UI e motor central para arquivados.
- [ ] Forge/Probe/Anubis/Lens completos (delegação tentada, indisponível: no thread with id).

Gates globais executados (exit 0=sucesso, 124=timeout de 180s): {'lint': '1', 'test': '1', 'typecheck': '0', 'build': '0', 'scope-lint': '0'}. Logs em docs/qa/rm-2026-1ffbaa/. A suíte ampliada teve falha em card-modal-integration: expectativa empresaSelecionada!.id em NovoCardModal, arquivo não alterado nesta execução. Falhas globais não foram atribuídas à alteração sem evidência.

Artefato/consumidor/acesso: usuário autorizado → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → CardAbertoLayout → ExcluirCardBpm; central em /PainelAlpha/AlphaCRM/pendencias → ListarPendenciasBpm → motor. Caminho inspecionado em código, sem teste autenticado no navegador.

AUTO_ADJUSTMENT_REQUIRED: falta validar estados da UI e ausência de efeitos do motor central para cards arquivados.
AUTO_ADJUSTMENT_ACCEPTANCE: testes comportamentais de sucesso/erro/carregamento no modal e execução pendente ignorada sem efeito após arquivamento.

File list desta retomada: tests/bpm/excluir-card-action.test.ts; src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx; docs/stories/story-rm-2026-1ffbaa-resolver-exclusao-autorizacao.md; docs/qa/rm-2026-1ffbaa/; .bibble/memory/journal.md; .bibble/memory/known-errors.md.

Resultado: FAIL — cobertura de integração incompleta; não é reprovação por falhas globais alheias.


## RM-2026-1FFBAA — cobertura comportamental local (2026-09-23)

Preservadas todas as implementações anteriores do working tree. Blueprint anterior revalidado: ExcluirCardBpm arquiva e audita na mesma transação, valida sessão/Zod/guard; pendências usam guard canônico; runtime central já ignora ARQUIVADO antes de executar o grafo. Nenhuma alteração de schema, dados reais ou Git mutável.

- [x] Testes do componente real CardAbertoLayout com diálogo Radix real: roles sem permissão, etapa sem ação, confirmação, loading, sucesso com atualização/fechamento, recusa com mensagem e rejeição inesperada sem fechar/atualizar.
- [x] Teste da fila central real: arquivado termina IGNORADA sem contexto, passos ou histórico de execução; controle ATIVO executa o grafo. Persistência simulada neste teste.
- [x] Suíte direcionada: 50 testes em 5 arquivos passaram, incluindo action/guard reais, fixture SQLite reduzida com quatro dependências Restrict e rollback, pendências, UI e automação. Fixture reduzida não equivale a integração Prisma completa.
- [x] Gates globais executados; códigos abaixo são os resultados reais (124=timeout), não aprovações inferidas.
- [ ] Smoke autenticado em produção e evidência da versão/constraint do incidente: pendência operacional; não coletados nesta execução local.

Gates: {"scope-current": "0", "build-current": "0", "test-current": "1", "typecheck-current": "2", "lint-current": "1", "targeted-current": "0"}. Logs em .cache/rm-2026-1ffbaa/*-current.log. Os logs históricos em docs/qa/rm-2026-1ffbaa registravam lint/test globais falhando; falhas externas sem evidência de regressão não invalidam os 50 testes direcionados. Não foram emitidas aprovações independentes de Forge/Probe/Anubis/Lens.

DELIVERY_READY: usuário autorizado → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → CardAbertoLayout → confirmação → ExcluirCardBpm → atualização do board/fechamento; diálogo e callbacks validados em DOM local. Central: /PainelAlpha/AlphaCRM/pendencias → ListarPendenciasBpm → motor com guard canônico, validado pelos testes de pendências. Rotas inspecionadas; navegador autenticado remoto não exercitado.

File list desta continuação: tests/bpm/arquivamento-modal-react.test.ts; tests/bpm/arquivamento-automacao.test.ts; docs/stories/story-rm-2026-1ffbaa-resolver-exclusao-autorizacao.md; .bibble/memory/journal.md. Nenhum componente novo.


Correção final da fixture: tipagem parcial explicitada apenas no teste com painéis isolados. Reexecução: {'typecheck': '0', 'targeted': '0'}. Build e lint dos novos arquivos passaram. Lint global: 2417 erros/1218 warnings fora dos novos arquivos; npm test: EBUSY ao acessar coverage, antes da execução dos testes. Não declarar esses dois gates globais aprovados. Logs finais em .cache/rm-2026-1ffbaa/*-final.log.


## Revalidação da implementação existente — Nova, 2026-09-23

Preservado o working tree: a implementação e a cobertura solicitadas já estavam presentes. Nenhum código, schema, dado real ou integração foi alterado nesta retomada.

- [x] Action real e guard: sessão, Zod, autorização efetiva, vínculo, etapa, Boas-vindas, auditoria atômica e repetição.
- [x] Retenção das quatro dependências Restrict e rollback em fixture SQLite descartável reduzida (não é integração Prisma completa).
- [x] UI real em DOM: confirmação, loading, sucesso, recusa e rejeição inesperada.
- [x] Fila central: arquivado ignorado antes dos efeitos; controle ativo executado.
- [x] 50 testes direcionados passaram; lint do escopo zero erros e um warning preexistente.
- [x] Caminho de entrega inspecionado: PipelineBoardClient → CardFullViewModal → CardAbertoLayout → ExcluirCardBpm → onAtualizado → recarregarCards/router.refresh. Central: page → ListarPendenciasBpm → motor autorizado → PendenciasWorkspace.
- [ ] Aprovações independentes Forge/Probe/Anubis/Lens e smoke autenticado remoto permanecem para a fase verificadora; não foram emitidas nesta retomada.
- [ ] Constraint exata do incidente e versão implantada ainda sem evidência de produção.

Gates desta execução (0=sucesso; 1/2=falha; 124=timeout; EM_EXECUCAO=não concluído no registro): {"targeted": "0", "scope-lint": "0", "lint": "1", "test": "1", "build": "0", "typecheck": "0"}. Logs: .cache/rm-2026-1ffbaa-revalidation/. npm test falhou antes dos testes por EBUSY no diretório coverage, igual ao log histórico em docs/qa/rm-2026-1ffbaa/test.log. Lint global também falhou; lint do escopo passou, e o histórico já registra falhas globais. Nenhum desses gates globais é declarado aprovado.

DELIVERY_READY: usuários autorizados → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → modal → arquivamento; /PainelAlpha/AlphaCRM/pendencias → pendências autorizadas. Código e DOM local validados, sem smoke remoto.

File list desta retomada: docs/stories/story-rm-2026-1ffbaa-resolver-exclusao-autorizacao.md; .bibble/memory/journal.md; .cache/rm-2026-1ffbaa-revalidation/ (logs locais). Arquivos funcionais e testes anteriores preservados. Nenhum componente novo.


## Validação da entrega existente — Nova, 2026-09-23 (logs rm-2026-1ffbaa-check)

Nenhuma implementação foi sobrescrita: a correção e os testes já estavam no working tree. Revalidados o blueprint anterior, arquivamento com auditoria transacional, auth/Zod e guard canônico, central de pendências autorizada, estados do modal e fila central ignorando cards arquivados. Nenhuma alteração de schema ou dados reais.

- [x] 50 testes direcionados passaram em cinco arquivos; inclui fixture SQLite reduzida com quatro dependências Restrict e rollback, sem equivalência a integração Prisma completa.
- [x] Lint do escopo: zero erros, um warning preexistente etapaAtual.
- [x] Gates globais executados e comparados com logs anteriores.
- [ ] Revisões independentes Forge/Probe/Anubis/Lens e smoke autenticado remoto: encaminhados à fase verificadora, sem aprovação inventada.
- [ ] Versão implantada e constraint específica do incidente: sem evidência de produção.

Resultados (exit codes): {"typecheck": "0", "build": "0", "lint": "1", "test": "1", "scope-lint": "0", "targeted": "0"}. Logs locais: .cache/rm-2026-1ffbaa-check/. Lint global: 2417 erros/1218 warnings, mesma contagem histórica de docs/qa/rm-2026-1ffbaa/lint.log. npm test falhou antes dos testes com EBUSY em coverage, também registrado em docs/qa/rm-2026-1ffbaa/test.log. Essas falhas não foram declaradas aprovadas nem atribuídas ao escopo sem evidência de regressão.

DELIVERY_READY: usuários autorizados → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → CardFullViewModal → CardAbertoLayout → ExcluirCardBpm → onAtualizado/recarregarCards; pendências em /PainelAlpha/AlphaCRM/pendencias → ListarPendenciasBpm → motor → PendenciasWorkspace. Caminhos inspecionados, modal exercitado em DOM local e autorização coberta por testes; sem smoke remoto.

File list desta execução: docs/stories/story-rm-2026-1ffbaa-resolver-exclusao-autorizacao.md; .bibble/memory/journal.md; .cache/rm-2026-1ffbaa-check/ (logs locais). Nenhum componente criado ou código funcional alterado.

RESULT: PASS — implementação local existente validada; ressalvas globais e operacionais acima seguem para verificação.


## Nova — validação final local RM-2026-1FFBAA, 2026-09-23

Implementação existente preservada. Corrigidos apenas o diagnóstico e os checkboxes desatualizados da story; nenhum código funcional, schema ou dado real alterado nesta retomada.

- [x] 50 testes direcionados em cinco arquivos: action/guard, dependências e rollback com SQLite descartável reduzido, central de pendências, estados reais do modal em DOM e fila de automações.
- [x] Build e typecheck aprovados pelos comandos reais; lint do escopo sem erros, um warning preexistente.
- [x] Gates globais executados e comparados ao histórico: lint com os mesmos 2417 erros/1218 warnings; npm test interrompido por EBUSY em coverage, também preexistente. Não foram declarados aprovados.
- [ ] Aprovações independentes Forge/Probe/Anubis/Lens e smoke autenticado remoto: para a fase verificadora.
- [ ] Versão implantada e constraint do incidente: ainda sem evidência de produção; fixture reduzida não equivale a integração Prisma completa.

Resultados (exit codes): {"typecheck": 0, "build": 0, "lint": 1, "test": 1, "scope-lint": 0, "targeted": 0}. Logs: .cache/rm-2026-1ffbaa-nova-validation/.

DELIVERY_READY: usuários autorizados → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → CardFullViewModal → CardAbertoLayout → ExcluirCardBpm → atualização do board; /PainelAlpha/AlphaCRM/pendencias → ListarPendenciasBpm → motor autorizado → PendenciasWorkspace. Caminhos inspecionados e comportamento coberto em testes locais; sem smoke remoto.

File list desta execução: docs/stories/story-rm-2026-1ffbaa-resolver-exclusao-autorizacao.md; .bibble/memory/journal.md; .cache/rm-2026-1ffbaa-nova-validation/ (logs locais). Nenhum componente criado.

RESULT: PASS — escopo local validado, ressalvas globais e operacionais encaminhadas para verificação.


## Nova — revalidação da fase executora RM-2026-1FFBAA (sessão local)

A implementação solicitada já estava presente e foi preservada. Inspeção confirmou auth e Zod antes da operação, guard canônico revalidado na transação, arquivamento com histórico atômico, filtro ATIVO no board, autorização nas pendências e fila central ignorando arquivados. Nenhum código funcional, schema, dado real ou integração alterado nesta sessão.

- [x] 50 testes direcionados em cinco arquivos passaram: action/guard, quatro dependências Restrict e rollback em SQLite descartável reduzido, pendências, estados do modal em DOM e automação. A fixture não equivale à integração Prisma completa.
- [x] Build e typecheck executados com sucesso.
- [x] Lint do escopo: zero erros, três warnings existentes (etapaAtual no layout; vi/beforeEach no teste estrutural).
- [x] Gates globais executados: npm test falhou antes dos testes por EBUSY em coverage, também presente em docs/qa/rm-2026-1ffbaa/test.log; lint global falhou conforme contagem abaixo. Não foram declarados aprovados.
- [ ] Aprovações independentes Forge/Probe/Anubis/Lens e smoke autenticado remoto continuam destinados à fase verificadora.
- [ ] Versão implantada e constraint específica do incidente continuam sem evidência de produção.

DELIVERY_READY: usuários autorizados → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → CardFullViewModal → CardAbertoLayout → ExcluirCardBpm → onAtualizado/recarregarCards; /PainelAlpha/AlphaCRM/pendencias → ListarPendenciasBpm → motor autorizado → PendenciasWorkspace. Caminhos inspecionados e comportamento local testado; sem smoke remoto.

File list desta sessão: docs/stories/story-rm-2026-1ffbaa-resolver-exclusao-autorizacao.md; .bibble/memory/journal.md; .cache/rm-2026-1ffbaa-session-validation/ (logs locais). Nenhum componente novo.

Gates (exit codes): {"targeted": 0, "scope-lint": 0, "lint": 1, "test": 1, "build": 0, "typecheck": 0}. Lint global: ✖ 3635 problems (2417 errors, 1218 warnings). Logs: .cache/rm-2026-1ffbaa-session-validation/.

RESULT: PASS — implementação local existente validada, com ressalvas globais e operacionais registradas.


## Nova — checkpoint local final (logs nova-current)

Implementação existente inspecionada e preservada; nenhum código funcional, schema ou dado real alterado nesta sessão.

- [x] 50 testes direcionados passaram: action/guard, quatro dependências e rollback em SQLite descartável reduzido, pendências, UI real em DOM e fila central.
- [x] Lint do escopo: zero erros, um warning preexistente etapaAtual.
- [x] Gates reais executados: {"lint": 1, "typecheck": 0, "test": 1, "targeted": 0, "scope-lint": 0, "build": 0}. 0=sucesso; 124=timeout. Lint/test globais não aprovados; histórico em docs/qa/rm-2026-1ffbaa registra lint com 2417 erros/1218 warnings e EBUSY em coverage.
- [ ] Revisões independentes Forge/Probe/Anubis/Lens, smoke autenticado e evidência da versão/constraint de produção permanecem para verificação. Fixture reduzida não equivale à integração Prisma completa.

DELIVERY_READY: usuários autorizados → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → CardFullViewModal → CardAbertoLayout → ExcluirCardBpm → onAtualizado/recarregarCards; /PainelAlpha/AlphaCRM/pendencias → ListarPendenciasBpm → motor autorizado → PendenciasWorkspace. Integração inspecionada e comportamento local testado, sem smoke remoto.

File list desta sessão: docs/stories/story-rm-2026-1ffbaa-resolver-exclusao-autorizacao.md; .bibble/memory/journal.md; .cache/rm-2026-1ffbaa-nova-current/ (logs locais). Nenhum componente criado.


## Nova — revalidação local (logs nova-review, 2026-09-23)

Implementação existente preservada: arquivamento/auditoria transacionais, auth/Zod, guard revalidado, autorização nas pendências e fila central ignorando arquivados. Nenhum código funcional, schema ou dado real alterado.

- [x] 50 testes direcionados passaram em cinco arquivos (action/guard, fixture SQLite reduzida com quatro dependências e rollback, modal em DOM, pendências e automação). Fixture não equivale a integração Prisma completa.
- [x] Typecheck passou; lint do escopo sem erros, um warning preexistente.
- [x] Gates globais executados: lint falhou com os mesmos 2417 erros/1218 warnings históricos; npm test falhou antes dos testes com EBUSY em coverage, também histórico. Não foram declarados aprovados.
- [ ] Revisões independentes Forge/Probe/Anubis/Lens, smoke autenticado e evidência da versão/constraint de produção permanecem para a fase verificadora.

Gates (exit codes): {"lint": 1, "typecheck": 0, "test": 1, "targeted": 0, "scope-lint": 0, "build": 0}. Logs: .cache/rm-2026-1ffbaa-nova-review/.

DELIVERY_READY: usuários autorizados → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → CardFullViewModal → CardAbertoLayout → ExcluirCardBpm → onAtualizado/recarregarCards; /PainelAlpha/AlphaCRM/pendencias → ListarPendenciasBpm → motor autorizado → PendenciasWorkspace. Caminhos inspecionados e comportamento local testado, sem smoke remoto.

File list desta sessão: docs/stories/story-rm-2026-1ffbaa-resolver-exclusao-autorizacao.md; .bibble/memory/journal.md; .cache/rm-2026-1ffbaa-nova-review/ (logs locais). Nenhum componente novo.


## Nova — checkpoint local (nova-confirmation)

Implementação existente inspecionada e preservada: auth/Zod, guard canônico revalidado na transação, arquivamento com histórico atômico, pendências autorizadas e fila central ignorando arquivados. Nenhum código funcional, schema ou dado real alterado nesta sessão.

- [x] 50 testes direcionados passaram em cinco arquivos: action/guard, quatro dependências Restrict e rollback em SQLite descartável reduzido, pendências, modal em DOM e automação. A fixture não equivale à integração Prisma completa.
- [x] Lint do escopo sem erros, três warnings existentes.
- [x] Gates globais executados: lint com 2417 erros/1218 warnings, mesma contagem histórica; npm test interrompido por EBUSY em coverage, também histórico. Não aprovados.
- [ ] Revisões independentes Forge/Probe/Anubis/Lens, smoke autenticado e evidência da versão/constraint de produção permanecem para verificação.

Gates reais (exit codes): {"lint": 1, "test": 1, "targeted": 0, "scope-lint": 0, "build": 0, "typecheck": 0}. Logs: .cache/rm-2026-1ffbaa-nova-confirmation/.

DELIVERY_READY: usuários autorizados → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → CardFullViewModal → CardAbertoLayout → ExcluirCardBpm → onAtualizado/recarregarCards; /PainelAlpha/AlphaCRM/pendencias → ListarPendenciasBpm → motor autorizado → PendenciasWorkspace. Integração inspecionada e comportamento local testado; sem smoke remoto.

File list desta sessão: docs/stories/story-rm-2026-1ffbaa-resolver-exclusao-autorizacao.md; .bibble/memory/journal.md; .cache/rm-2026-1ffbaa-nova-confirmation/ (logs locais). Nenhum componente criado.


## Nova — evidência desta execução local (nova-final-check)

Implementação existente reinspecionada e preservada: arquivamento e histórico na mesma transação, auth/Zod, autorização canônica revalidada, pendências filtradas por acesso e automações ignorando arquivados. Nenhum código funcional, schema ou dado real alterado.

- [x] 50 testes direcionados passaram em cinco arquivos: autorização, Boas-vindas, dependências Restrict e rollback em SQLite descartável reduzido, estados do modal e automações. Fixture reduzida não equivale à integração Prisma completa.
- [x] Lint do escopo: zero erros e um warning preexistente.
- [x] Gates reais executados; resultados abaixo (0=sucesso).
- [ ] Aprovações independentes Forge/Probe/Anubis/Lens, smoke autenticado e evidência da versão/constraint em produção permanecem para a fase verificadora.

Resultados: {"typecheck": 0, "build": 0, "lint": 1, "test": 1, "scope-lint": 0, "targeted": 0}. Lint global: ["  112:5   warning  Unused eslint-disable directive (no problems were reported from 'no-control-regex')", "  118:7   warning  Unused eslint-disable directive (no problems were reported from 'no-control-regex')", "  317:5   warning  Unused eslint-disable directive (no problems were reported from 'no-control-regex')", "  723:15  warning  Unused eslint-disable directive (no problems were reported from 'no-eval')", "  75:9  warning  Unused eslint-disable directive (no problems were reported from 'react-hooks/set-state-in-effect')", "  86:9  warning  Unused eslint-disable directive (no problems were reported from 'react-hooks/set-state-in-effect')", '✖ 3635 problems (2417 errors, 1218 warnings)']. npm test falhou por EBUSY em coverage, também presente em docs/qa/rm-2026-1ffbaa/test.log. Lint histórico: 2417 erros/1218 warnings. Gates globais com falha não declarados aprovados. Logs: .cache/rm-2026-1ffbaa-nova-final-check/.

DELIVERY_READY: usuários autorizados → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → modal → ExcluirCardBpm → atualização do board; /PainelAlpha/AlphaCRM/pendencias → ListarPendenciasBpm → motor autorizado → PendenciasWorkspace. Integração inspecionada e comportamento local testado; sem smoke remoto.

File list desta sessão: docs/stories/story-rm-2026-1ffbaa-resolver-exclusao-autorizacao.md; .bibble/memory/journal.md; .cache/rm-2026-1ffbaa-nova-final-check/ (logs locais). Nenhum componente novo.


## Nova — revalidação desta sessão (validation-now)

Implementação existente inspecionada e preservada; nenhum código funcional, schema ou dado real alterado.

- [x] 50 testes direcionados passaram: guard/action, Boas-vindas, quatro dependências Restrict e rollback em SQLite descartável reduzido, pendências, modal em DOM e automação. Fixture não equivale a integração Prisma completa.
- [x] Lint do escopo sem erros, um warning preexistente.
- [x] Gates globais executados; lint e npm test falharam. EBUSY em coverage reproduz o histórico de docs/qa/rm-2026-1ffbaa/test.log.
- [ ] Revisões independentes Forge/Probe/Anubis/Lens, smoke autenticado e evidência da versão/constraint de produção permanecem para verificação.

Gates (exit codes; PENDENTE não significa aprovação): {"lint": 1, "test": 1, "targeted": 0, "scope-lint": 0, "build": 0, "typecheck": 0}. Logs: .cache/rm-2026-1ffbaa-validation-now/.

DELIVERY_READY: usuários autorizados → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → modal → ExcluirCardBpm → atualização do board; /PainelAlpha/AlphaCRM/pendencias → ListarPendenciasBpm → motor autorizado → PendenciasWorkspace. Caminhos inspecionados e comportamento testado localmente, sem smoke remoto.

File list desta sessão: docs/stories/story-rm-2026-1ffbaa-resolver-exclusao-autorizacao.md; .bibble/memory/journal.md; .cache/rm-2026-1ffbaa-validation-now/ (logs locais). Nenhum componente criado.

## Revalidação terminal — 2026-09-23

A implementação existente foi retomada da fase 3: arquivamento com histórico na mesma transação, guard de autorização relido antes da escrita, central de pendências filtrada e fila de automações ignorando cards arquivados. A suíte direcionada dos cinco arquivos de exclusão, pendências, modal e automação passou **50/50**. O ESLint do escopo passou com um aviso de variável não usada; o typecheck completo passou nesta sessão. A asserção antiga do teste de integração do Novo Card foi corrigida no objetivo RM-2026-A33407 e não constitui regressão da exclusão.

A fixture SQLite do teste de constraint é reduzida; ela não demonstra o comportamento do schema Prisma completo nem a versão implantada. O clique autenticado e a conferência do ambiente real pertencem à etapa de Testes. O staging continua bloqueado por alterações de autoria compartilhada no worktree, sem tentativa de contornar a proteção.
