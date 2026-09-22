# RM-2026-09A642 — CPF e fechamento do card

Status: Implementação local; validação bloqueada pelo ambiente (fase 4, Nova).

## Objetivo e problema
Persistir CPF pelo CRUD existente e proteger alterações não confirmadas ao fechar o card. Blueprint Scout recebido das fases anteriores: contexto de saves não guarda rascunhos e sucesso limpa dirty sem conferir revisões posteriores. Causa do relato em produção ainda não reproduzida.

## Escopo e critérios de aceite
- [x] CPF válido com/sem máscara usa validação existente e valor confirmado pelo servidor.
- [x] Edição durante save não é sobrescrita nem confirmada indevidamente.
- [x] X, Escape e clique externo aguardam saves e apresentam nomes das pendências.
- [x] Cancelar preserva formulário; Sair mesmo assim fecha e informa descarte.
- [x] Falhas repetidas continuam protegendo rascunhos.
- [ ] Executar lint, typecheck e testes; entregar diff para Forge.

## Fora de escopo
Schema, migrations, mutações em massa, auth/API, Git mutável e publicação.

## Dependências e riscos
CRUD AtualizarCardBpm/ObterCardBpm com auth, Zod e editarCard; AlertDialog existente; preservar readOnly, fallback, contraste, concorrência/realtime e follow-up. Working tree já alterado por outros objetivos.

## Entregabilidade
Usuário autorizado: Alpha CRM → Pipelines → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → card → Formulário da Etapa. PipelineBoardClient monta CardFullViewModal; PainelRegistrar/CardOpenFormSlot monta PainelCamposEtapaAtual. Caminho inspecionado no código. Validação autenticada de Revisão de Radar pendente.

## File list
- docs/stories/story-rm-2026-09a642-cpf-modal.md
- src/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext.tsx
- src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx
- src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx

## Evidências e decisão
Preflight somente leitura: schema não necessário (Vault NO_DB_CHANGE_REQUIRED). Implementação local autorizada; gates ainda pendentes.

## Resultado da fase 4
Autoajustes: story criada; registro persistente dos nomes dos campos pendentes por instância/card, independente do resultado consumível do flush. Fila aguarda estabilização. CPF usa validação compartilhada antes da action e reconcilia a leitura confirmada; rastreador de revisão protege edições posteriores. Mesma versão confirmada via realtime não cria conflito espúrio. AlertDialog existente oferece Cancelar/Sair mesmo assim após X/Escape/clique externo pelo onOpenChange do Sheet. Guardas de follow-up e revogação permanecem.

Os itens marcados acima descrevem código implementado, não homologação autenticada. Não foi reproduzida a causa específica da configuração real de Revisão de Radar. Permanecem pendentes testes de interação do modal, recarga/reabertura com persistência real e concorrência entre usuários.

### Gates
- npm run typecheck: PASS (exit 0).
- Teste direcionado card-save-flow: 9 testes PASS; novo teste React impedido por ERR_MODULE_NOT_FOUND: happy-dom (dependência já declarada no package.json).
- npm test: FAIL antes da execução, EBUSY no diretório coverage; nenhum diretório compartilhado foi removido.
- Lint global, lint dos arquivos e build: comandos executados, consultar logs em docs/qa/rm-2026-09a642; ausência de resumo final não equivale a aprovação.
- git diff --check dos três arquivos: PASS antes do ajuste final de realtime.
- Sem alteração de banco, commit, push ou publicação.

### File list adicional
- tests/bpm/cpf-pendencias-react.test.ts
- docs/qa/rm-2026-09a642/ (logs de gates)
- .cpf-targeted.log (log local)
- .bibble/memory/journal.md
- .bibble/memory/components.md

### Decisão de entrega
Caminho integrado validado no código: usuário autorizado → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → card → Formulário da Etapa. Entrega funcional não homologada; encaminhar diff para Forge após regularizar o ambiente de testes. Não declarar aprovação técnica completa.

Atualização dos gates: lint global falhou com 2418 erros/1218 warnings (incluía uma atribuição no render do novo teste, corrigida para useEffect). Lint focado reexecutado após correção; ver lint-scope.log. Build iniciado, sem conclusão confirmada nesta fase. Resultado final FAIL por validação incompleta.

## Reexecução local — 2026-09-22
- [x] Reinspecionados contexto de saves, reconciliação de CPF, guardas da action e acesso pelo PipelineBoardClient.
- [x] Acrescentado teste de interação com Sheet/AlertDialog reais para X, Escape, clique externo, Cancelar, repetição e Sair mesmo assim (dependências do formulário isoladas por mocks).
- [x] npm run typecheck: exit 0 nesta reexecução.
- [x] npm test executado com diretório de cobertura isolado: exit 1; consultar test-retry.log.
- [ ] Homologação autenticada de CPF após recarregar e configuração real de Revisão de Radar.
- [ ] Aprovação técnica global: não concedida; logs desta reexecução em docs/qa/rm-2026-09a642/*retry.log.

File list adicional desta reexecução: tests/bpm/cpf-fechamento-react.test.ts; esta story; .bibble/memory/journal.md; logs docs/qa/rm-2026-09a642/. Instalação convencional sem scripts falhou por resolução de dependências; tentativa isolada em .cache/rm-2026-09a642 registrada em dom-install.log. Nenhuma alteração de schema/dados ou Git mutável.

Resultado direcionado após regularizar happy-dom e corrigir fixture do formulário:
```text
 Test Files  3 passed (3)
      Tests  19 passed (19)
```
Lint focado: 0 erros, 10 warnings preexistentes no modal. Lint global: 2417 erros/1218 warnings. Suíte global: 16 arquivos falharam, 454 passaram; 19 testes falharam, 3463 passaram, 1 todo; 4 erros de execução. Build compilou; conclusão não confirmada, com diagnóstico EACCES no carregamento de .env (conteúdo não acessado). Resultado da fase: FAIL / VALIDATION_INCOMPLETE.
