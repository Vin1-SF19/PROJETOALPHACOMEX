# RM-2026-09A642 — CPF e fechamento do card

Status: Pronta para testes — correção de fechamento implementada e gates do escopo aprovados.

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

## Retomada terminal 6/10 — 2026-09-22

Foi reproduzida uma falha real no caso “clique externo → Cancelar → clicar fora
novamente”: o segundo pedido de fechamento podia não reabrir a confirmação.

Alterações feitas agora:

- `CardFullViewModal.tsx`: Escape e `pointerDownOutside` agora são
  interceptados no `SheetContent`, têm o fechamento padrão cancelado e chamam
  diretamente `solicitarFechamento`, permitindo repetição segura.
- `cpf-fechamento-react.test.ts`: clique externo simula pointerdown, pointerup e
  click, e aguarda a finalização do cancelamento antes da segunda tentativa.

Validação real:

- [x] cenário de fechamento executado 5 vezes seguidas: 5/5 execuções verdes;
- [x] cinco suítes focadas: 38/38 testes aprovados;
- [x] ESLint do escopo: 0 erros (10 avisos preexistentes no modal);
- [x] typecheck completo: aprovado;
- [ ] persistência/reabertura em sessão autenticada permanece para homologação.

Resultado: **PASS no escopo**, encaminhado para **Em testes**. O objetivo 7/10
pode iniciar.

## Feedback obrigatório e correção do autosave — 2026-09-22
Ambos os relatos do administrador exigem restaurar o salvamento automático de todos os campos e preservar a confirmação de fechamento aprovada.
- [x] Reproduzir com input real: CPF inválido bloqueava outro campo; sucesso posterior retornava falha acumulada.
- [x] Autosave no blur usa rascunho atual e salva campos válidos independentemente dos inválidos, preservando regra dependente de Lost, readOnly e revisão de rascunhos.
- [x] Resultado da tentativa separado do resultado agregado de segurança do flush.
- [ ] Validar gates desta retomada.
- [ ] Homologar persistência real após reabrir/recarregar em Revisão de Radar; não confundir mocks de actions com banco real.
File list desta retomada: PainelCamposEtapaAtual.tsx; CardSaveContext.tsx; tests/bpm/cpf-pendencias-react.test.ts; esta story; .bibble/memory/journal.md; docs/qa/rm-2026-09a642/autosave-*.log.

Validação desta retomada: 4 suítes direcionadas, 22 testes PASS; ESLint dos três arquivos alterados PASS; git diff --check do escopo PASS. Lint global, typecheck, npm test e build executados, sem conclusão confirmada no limite de rodadas; suíte global já reporta falhas (incluindo contrato textual lost-ui). Aprovação global não concedida. Logs autosave-*.log. Persistência real autenticada continua pendente. RESULT: FAIL / VALIDATION_INCOMPLETE.


## Retomada Nova — fila de autosave, 2026-09-22

Blueprint Scout e feedbacks anteriores reutilizados. Os dois relatos obrigatórios são atendidos pela restauração do autosave no blur, isolamento de campos inválidos e preservação do diálogo aprovado. Nesta retomada foi reproduzida uma perda adicional: editar CPF, iniciar save, reverter ao valor original e sair do campo antes da resposta enviava somente a primeira edição (teste vermelho em resume-before.log).

- [x] Comparar alterações dentro da fila, após confirmação do save anterior, preservando valores e revisões capturados no blur. A reversão agora também é enviada.
- [x] Indicador de salvamento conta todas as tentativas pendentes.
- [x] Cobrir reversão durante save e recuperação após erro de rede com input real e actions simuladas.
- [x] Atualizar contratos textuais de Lost e edição por campo para a implementação atual; confirmação de fechamento preservada.
- [x] Executar npm run lint, npm run typecheck, npm test e npm run build.
- [ ] Aprovação global: lint falhou com 2417 erros/1218 warnings; suíte global reportou 20 falhas/3528 passes/1 todo. Duas expectativas textuais do escopo foram corrigidas depois dessa execução e revalidadas na suíte focada; demais falhas não foram alteradas.
- [ ] Homologação autenticada de persistência/reabertura em Revisão de Radar continua pendente. Testes com actions simuladas não comprovam gravação real no banco.

Build completo terminou com exit 0. Typecheck inicial exit 0; reexecução final e suíte focada registrados em resume-types-final.log e resume-focused-final.log. ESLint do escopo em resume-scope-lint.log. Logs atuais em docs/qa/rm-2026-09a642/resume-*.log.

DELIVERY_READY: caminho integrado inspecionado para usuário autorizado: Alpha CRM → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → card (PipelineBoardClient/CardFullViewModal) → Formulário da Etapa (CardOpenFormSlot/PainelCamposEtapaAtual). Sem nova rota necessária; prontidão de integração não equivale a homologação autenticada.

File list desta retomada: src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx; tests/bpm/cpf-pendencias-react.test.ts; tests/bpm/lost-ui.test.ts; tests/bpm/edicao-campos-card.test.ts; docs/stories/story-rm-2026-09a642-cpf-modal.md; .bibble/memory/journal.md; .bibble/memory/known-errors.md; docs/qa/rm-2026-09a642/resume-*.log. Alterações preexistentes preservadas. Nenhuma alteração de schema/banco nem Git mutável.

## Revalidação de 2026-09-23

O código atual foi reinspecionado após os relatos de autosave interrompido. A fila em `CardSaveContext` separa o resultado da tentativa individual do histórico de falhas usado para proteger o fechamento; `PainelCamposEtapaAtual` salva no blur e preserva revisões ainda não confirmadas. A confirmação ao fechar permanece no modal.

- Cinco suítes focadas de CPF, fechamento, fila, edição e Lost: **84/84 testes aprovados**.
- `npm run typecheck`: **exit 0**.
- ESLint dos componentes e testes focados: **exit 0**, com dez avisos de código não usado já presentes em `CardFullViewModal.tsx`.

A correção funcional está pronta para homologação autenticada de CPF e outros campos após reabrir o card na Revisão de Radar. O staging automático ainda recusa a autoria dos arquivos porque o worktree contém alterações compartilhadas com outras RMs; essa restrição de entrega não foi contornada.
