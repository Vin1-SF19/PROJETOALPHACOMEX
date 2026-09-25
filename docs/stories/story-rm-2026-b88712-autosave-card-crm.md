# Story RM-2026-B88712 — Autosave universal do formulário do card + remoção do modal 'Sair sem salvar'

**Objetivo do Roadmap:** Autosave universal do formulário do card + remoção do modal 'Sair sem salvar'
**Projeto:** Painel Alpha
**Módulo:** Alpha CRM / BPM
**Status:** Ready for Review — correção adicional de 2026-09-25 validada localmente; smoke autenticado pendente.
**Encerramento local:** 2026-09-22 — Scribe, Fase 11. Aceite Sage recebido com ressalvas; gates globais e homologação autenticada continuam pendentes.

## Contexto

O objetivo relata confirmação indevida ao sair do card e regressão com perda de campos. O Scout da Fase 1 identificou o diálogo real como “Campos não salvos”, com “Cancelar” e “Sair mesmo assim”. A causa comprovada é a persistência dependente de blur: `alterarCampo` atualiza o rascunho, mas não agenda um save universal. `flushSaves` aguarda operações registradas, sem iniciar todas as alterações ainda fora da fila. Templates e seleção isolada de data também podem deixar pendências fora dela. O provider local ao modal não mantém recuperação dos valores após desmontagem.

O fechamento normal força blur, portanto o diagnóstico não demonstra perda em todo fechamento. Não foi encontrado debounce cancelado nem comprovada closure enviando valor antigo nos campos dinâmicos. Upload já inicia persistência no onChange e registra a Promise na fila. Preservar as correções locais existentes: saves serializados, snapshots com revisão, comparação dentro da execução serial e confirmação real do servidor. Múltiplas seções com versões-base independentes representam risco de conflito CAS a testar, não reprodução confirmada.

A Fase 2 formalizou o blueprint como Ready. O encerramento local da Fase 11 consolida a implementação e os pareceres recebidos; as seções datadas abaixo preservam o histórico, inclusive lacunas posteriormente resolvidas.

## Escopo

- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`: fechamento por X, ESC e clique externo sem confirmação de descarte, capturando as revisões pendentes antes de desmontar.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx` e `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx`: autosave dos campos dinâmicos e templates, incluindo upload pelo contrato existente.
- Hooks de autosave e dirty tracking no mecanismo existente `CardModal/CardSaveContext.tsx`, reutilizando `criarRastreadorRascunho`; o Scout não localizou hooks `useAutosave`/`useDebounce` prontos em `src`.
- Integração mínima no `layout.tsx` do CRM e nos painéis `PainelProximoContato`, `PainelReuniao`, `PainelChecklistFollowUp`, `PainelStatusPosFechamento` e `PainelProximaEtapa`, sob `CardModal/`, para continuidade da fila e versão compartilhada por card.
- Validar consumidores `DashboardClient.tsx`, `pipeline/[pipelineId]/PipelineBoardClient.tsx` e `tarefas/TarefasCentralClient.tsx`, dentro do CRM.
- `src/actions/bpm/Campos.ts`: conferir compatibilidade das definições. **Valores do card são persistidos por `AtualizarCardBpm` em `src/actions/bpm/Cards.ts`**, com Zod, autorização e CAS. Não há mudança de backend demonstradamente necessária apenas para agendamento; Echo deve reutilizar o contrato existente.
- `tests/bpm/`: cobertura do autosave, concorrência, recuperação e saída sem confirmação.

## Fora de escopo

- Alterações de schema, migrations, seeds/backfills e mutação em massa.
- Mudanças em outros módulos, menus ou rotas sem necessidade para este formulário.
- Automatizar agendamento de reunião, conclusão de follow-up ou interrupção de Standby.
- Remover a guarda de negócio de follow-up, validações, autorização ou dependências de Lost.
- Criar um novo tipo de campo: booleano atualmente usa select Sim/Não; o aceite de checkbox exige verificar os controles aplicáveis, sem inventar tipo no schema.
- Commit, push, publicação e PR nesta fase local.

## Critérios de aceitação

- [x] Ao editar qualquer campo do card e sair, o campo é persistido sem perda.
- [x] Nenhum modal 'Sair sem salvar' / 'Descartar alterações' é exibido ao fechar o card, incluindo o diálogo atual “Campos não salvos”.
- [x] O autosave funciona para texto, textarea, número, moeda, select, multiselect, booleano (select Sim/Não; checkbox dinâmico não existe), data, arquivo e campos dinâmicos por etapa.
- [x] Testes automatizados cobrem o autosave e a saída sem modal.
- [ ] `npm run lint`, `npm run typecheck` e `npm test` passam.
- [x] Digitação agenda persistência em 500 ms por card/campo; seleções, booleanos, datas e arquivos disparam imediatamente; blur antecipa sem duplicação, incluindo edição por template e data sem editar a hora.
- [x] Fechar captura e enfileira imediatamente as revisões pendentes; a confirmação de rede permanece assíncrona. Reabertura e navegação interna do CRM preservam pendências e erros recuperáveis, com estados “Salvando…”, “Salvo” e “Erro”.
- [x] Valores inválidos não são considerados salvos; falha de rede e conflito externo não causam perda silenciosa. Movimento de etapa depende do sucesso real do flush e a guarda de follow-up permanece respeitada.
- [x] Respostas antigas, reversões durante requests e edições entre seções não sobrescrevem rascunhos recentes; upload mantém vínculo e download acessível ao usuário autorizado.

## Checklist por fase

- [x] Scout — Fase 1: blueprint recebido com causa raiz, contratos, consumidores e lacunas.
- [x] Nova — Fase 2: criar esta story no formato da referência RM-2026-EB7B58, com escopo, aceites verificáveis e status Ready.
- [x] Echo — persistência: verificar `AtualizarCardBpm`, CAS, validações e registro de anexos; preservar auth/ownership e retornar confirmação real; alterar backend somente se necessário ao contrato.
- [x] Nova — frontend: agendamento universal, fila e versão por card, preservação de rascunhos além do modal e remoção da confirmação de descarte, conforme blueprint.
- [x] Dev — testes: atualizar `cpf-fechamento-react.test.ts` e `card-save-flow.test.ts`; expandir `cpf-pendencias-react.test.ts`, `arquivo-persistencia-react.test.ts`, `edicao-campos-card.test.ts` e `rascunho-data-hora.test.ts` conforme aplicável.
- [x] Dev — cobrir 499/500 ms, edição sem blur, template, data sem hora, X/ESC/clique externo, troca/reabertura de card, navegação, latência, falha, concorrência, reversão e download de anexo.
- [x] Forge — executar typecheck, lint, testes e build reais; registrar saídas e separar falhas preexistentes, sem declarar aprovação indevida.
- [x] Probe — validar presença, trigger, rota protegida, permissões, persistência, estados da UI, integrações e ausência de regressões nos três consumidores.
- [x] Anubis — auditar auth, ownership, validação e upload nos contratos envolvidos.
- [x] Lens — revisão qualitativa somente após aprovação técnica de Forge.
- [x] Sage — validar cobertura e cenários de falha/concorrência.
- [x] Scribe/Kowalski — consolidar descobertas e histórico ao concluir a implementação; atualizar checklist e File List.


**Limite do checklist:** itens funcionais assinalados conforme aceite local Sage e verificações anteriores com mocks; não comprovam banco real, reload ou homologação autenticada. Forge do escopo está documentado em `docs/qa/rm-2026-b88712/forge-scope-report.md`; gates globais permanecem abertos. Pareceres Probe/Anubis/Lens/Sage recebidos no pipeline são registrados no fechamento abaixo, sem reatribuir essas aprovações ao Scribe.

## Auditoria de entregabilidade

**Artefato desta fase:** esta story, consumida pelos agentes Echo, Nova, Dev e revisores por leitura direta de `docs/stories/story-rm-2026-b88712-autosave-card-crm.md`. Não exige visualizador dentro do produto.

**Artefato final do objetivo:** formulário do card com autosave, consumido pelos usuários comerciais e operacionais autorizados. Caminho existente inspecionado: menu Alpha CRM (permissão `crm` em `src/lib/modulos-registry.ts`) → `/PainelAlpha/AlphaCRM` → link do pipeline em `DashboardClient` → `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → `PipelineBoardClient` → `CardFullViewModal` → formulário. Dashboard e central de tarefas também são consumidores mapeados pelo Scout. Anexos usam `/api/bpm/anexos/[anexoId]`, conforme a auditoria anterior.

DELIVERY_READY: story disponível no caminho acima para as fases executoras; acesso ao formulário confirmado por inspeção de código, sem homologação autenticada nesta fase.

AUTO_ADJUSTMENT_REQUIRED: o formulário ainda depende de blur e do provider local para pendências; faltam autosave universal, recuperação após desmontagem e remoção da confirmação, conforme Scout. O contrato de checkbox precisa ser verificado sem criar tipo de campo novo.

AUTO_ADJUSTMENT_ACCEPTANCE: executar a matriz de tipos e fechamento, navegar antes da resposta, reabrir e confirmar valores no servidor; simular falha/latência/concorrência, recuperar pendências sem perda silenciosa e verificar download do arquivo vinculado. Estes ajustes integram as fases Echo/Nova/Dev desta story; a entrega principal da Fase 2 é documental.

## Validação da Fase 2

- [x] Arquivo criado no caminho exigido, causa raiz atribuída ao Scout, critérios verificáveis e status Ready.
- [x] File List reservada vazia para as fases de implementação, conforme requisito desta fase.
- [x] Registrar resultados dos comandos de qualidade executados nesta sessão.

Validação documental: PASS (status, seções, responsáveis, aceites e File List vazia conferidos). `npm run typecheck`: exit 0. `npm run lint`: exit 1 — ✖ 3635 problems (2417 errors, 1218 warnings). `npm test`: exit 1 — 14 arquivos com falha, 464 aprovados; 19 testes com falha, 3529 aprovados e 1 todo. Logs em `docs/qa/rm-2026-b88712/phase2-{lint,typecheck,test}.log`. Esta sessão alterou documentação, não código executável; os gates globais não estão aprovados e suas falhas ficam registradas para triagem nas fases executoras. Build e homologação de UI não executados nesta fase documental.

## File List

Lista final consolidada dos arquivos atribuídos a este RM nas fases anteriores; não representa arquivos editados pelo Scribe nesta sessão.

- `.bibble/memory/codebase-map.md`
- `.bibble/memory/components.md`
- `.bibble/memory/decisions.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/journal.md`
- `.bibble/memory/known-errors.md`
- `docs/stories/story-rm-2026-b88712-autosave-card-crm.md`
- `src/actions/bpm/Anexos.ts`
- `src/actions/bpm/Campos.ts`
- `src/actions/bpm/Cards.ts`
- `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistFollowUp.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximoContato.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelStatusPosFechamento.tsx`
- `src/app/PainelAlpha/AlphaCRM/layout.tsx`
- `src/app/api/bpm/upload/route.ts`
- `src/lib/bpm/upload-conteudo.ts`
- `src/lib/validations/bpm.ts`
- `tests/bpm/anexos-idempotencia.test.ts`
- `tests/bpm/arquivo-persistencia-react.test.ts`
- `tests/bpm/autosave-fixed-recovery-react.test.ts`
- `tests/bpm/autosave-recovery-react.test.ts`
- `tests/bpm/autosave-tipos-imediatos-react.test.ts`
- `tests/bpm/campo-select-contraste-react.test.ts`
- `tests/bpm/card-modal-integration.test.ts`
- `tests/bpm/card-save-flow.test.ts`
- `tests/bpm/cpf-fechamento-react.test.ts`
- `tests/bpm/cpf-pendencias-react.test.ts`
- `tests/bpm/edicao-campos-card.test.ts`
- `tests/bpm/formulario-etapa.test.ts`
- `tests/bpm/lost-ui.test.ts`
- `tests/bpm/upload-validacao.test.ts`
- `docs/qa/rm-2026-b88712/` — evidências por fase, relatório Forge e logs/exit da Fase 11.

## Fase 3 — Echo (2026-09-22)

Persistência reutiliza AtualizarCardBpm, não Campos.ts. Zod agora normaliza number, boolean (Sim/Não), arrays JSON e null (string vazia), preservando strings e limite final de 4.000 caracteres e 100 campos. Datas e referências de arquivo continuam strings, validadas pelo contrato existente; uploads continuam em RegistrarAnexoBpm com recibo assinado, vínculo e download protegido. Não foi criado endpoint ou caminho paralelo. MoverCardBpm mantém seu schema anterior.

A action mantém auth antes das consultas, acesso ao card/pipeline/setor por exigirAcessoBpmCard, rechecagem na transação, aplicabilidade/readOnly, Lost e CAS. O retorno usa success/error, semanticamente equivalente ao resultado solicitado, preservando consumidores existentes. Repetir valores faz upsert pela chave cardId/campoId, sem duplicar valores; não significa eliminar eventos/históricos ou aceitar versão CAS obsoleta. Testes usam Prisma simulado, não comprovam persistência no banco real.

- [x] 51 testes direcionados passaram (edição, anexos idempotentes, ownership e Lost).
- [x] Typecheck exit 0; lint dos dois arquivos backend exit 0; diff check sem erros.
- [ ] Gates globais aprovados: lint exit 1; testes exit 1 (19 falhas, 3548 aprovados, 1 todo, execução anterior aos seis casos adicionais). Mesma contagem de falhas da Fase 2, sem atribuir causalidade apenas pela contagem.
- [ ] Homologação autenticada, Forge/Probe/Anubis/Lens e autoajustes frontend ainda pendentes; não há aprovação desses agentes nesta sessão.

✖ 3635 problems (2417 errors, 1218 warnings)
build: exit 0

DELIVERY_READY: contrato backend integrado ao caminho existente /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → PipelineBoardClient → CardFullViewModal → PainelCamposEtapaAtual → AtualizarCardBpm; inspeção de código e testes simulados. Upload usa RegistrarAnexoBpm e /api/bpm/anexos/[anexoId].

AUTO_ADJUSTMENT_REQUIRED: CardFullViewModal ainda hospeda CardSaveProvider local e o diálogo Campos não salvos; PainelCamposEtapaAtual ainda depende de blur. O autoajuste universal exigido pelas fases anteriores não foi implementado nesta execução Echo. Resultado global desta fase: FAIL por entrega incompleta e gates globais vermelhos; não requer aprovação de banco.
AUTO_ADJUSTMENT_ACCEPTANCE: executar o blueprint Nova da story, validar 500 ms, fechamento/navegação antes da resposta, recuperação de falha, reabertura e valores no servidor para cada tipo; preservar Lost, CAS e download autenticado.

Sem schema, migration, acesso ao banco real ou Git mutável.

## Reexecução Echo — vínculo de arquivo (2026-09-22)

- [x] Reinspecionado o backend anterior e preservadas todas as alterações locais.
- [x] Corrigido aceite de referências arbitrárias: AtualizarCardBpm consulta anexos dentro da transação, por cardId e pares id/campoId, antes de qualquer escrita. Limpeza null mantém o anexo armazenado e limpa somente o valor. Upload permanece em RegistrarAnexoBpm.
- [x] Testes negativos para referência ausente/campo divergente e teste de limpeza; suíte direcionada final: 54/54 PASS. Mocks não comprovam acesso ao banco real.
- [x] Lint backend direcionado PASS e diff check PASS.
- [ ] Entrega universal do frontend: continua pendente. A ferramenta de delegação retornou “no thread with id”; nenhum agente frontend foi iniciado. Não houve aprovação Forge/Probe/Anubis/Lens nesta execução.

File List adicional: src/actions/bpm/Cards.ts, tests/bpm/edicao-campos-card.test.ts, esta story, .bibble/memory/journal.md e docs/qa/rm-2026-b88712/phase3-recheck-*.

DELIVERY_READY: contrato servidor consumido pelo formulário em /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → CardFullViewModal → PainelCamposEtapaAtual → AtualizarCardBpm; validação por inspeção e testes simulados, sem homologação autenticada.
AUTO_ADJUSTMENT_REQUIRED: provider ainda local ao modal, agendamento dependente de blur e diálogo Campos não salvos; a entrega universal solicitada permanece incompleta.
AUTO_ADJUSTMENT_ACCEPTANCE: implementar blueprint frontend e comprovar edição, fechamento/navegação antes da resposta e reabertura com recuperação após falha, sem confirmação de descarte.

Nenhuma operação de banco, migration ou Git mutável executada. Resultado da fase FAIL por entrega incompleta. Os primeiros gates incluíram dois casos de teste mal parametrizados, corrigidos antes da repetição final.

Gates finais da reexecução: typecheck PASS (exit 0), build PASS (exit 0, com avisos de acesso a .env e pdfjs), testes direcionados 54/54 PASS, lint backend PASS. Lint global FAIL: 2417 erros/1218 warnings. npm test final FAIL: 18 falhas, 3558 aprovados, 1 todo. Evidências: docs/qa/rm-2026-b88712/phase3-recheck-final-{typecheck,test,build}.log e phase3-recheck-final-results.json. Sem homologação no navegador ou banco real.

## Fechamento Echo — Fase 3 (2026-09-22)

- [x] Reinspecionado sem alterar código: `atualizarCardSchema.camposValores` usa `camposAutosaveBpmSchema` (string, number, boolean, array, `null`, limite de 4.000 caracteres e 100 campos; `src/lib/validations/bpm.ts:338-364`). `AtualizarCardBpm` (`src/actions/bpm/Cards.ts:1101`) mantém `auth()` antes de qualquer operação, `exigirAcessoBpmCard(..., "editarCard")` antes e dentro da transação, validação de anexos por `cardId`/`campoId` (`:1295`) e `upsert` por `cardId_campoId` (`:1342`, `:1350`).
- [x] Critério da Fase 3 atendido no escopo servidor: persistência individual por tipo, idempotente, com retorno tipado `success/error`, sem action paralela e sem schema/migration.
- [ ] Autosave universal, provider fora do modal e remoção de “Campos não salvos”: pertencem ao item **Nova — frontend** do checklist e não fazem parte do critério desta fase. As execuções Echo anteriores marcaram FAIL por incluir essa lacuna frontend; este fechamento a repassa explicitamente à próxima fase.
- Gates não reexecutados nesta sessão: o catálogo de ferramentas disponível é apenas Read/Grep/Glob/Edit/Write, sem shell. Valem as evidências `phase3-recheck-final-*` acima. Nenhuma alteração de código foi feita depois delas.

## Fase 4 — Nova (2026-09-22), implementação local parcial

- [x] Agendamento por campo dinâmico: 500 ms para digitação; imediato para seleção, booleano, multisseleção e datas. Upload mantém registro imediato existente.
- [x] Provider elevado ao layout autenticado do CRM; fila serial, versão confirmada compartilhada e rascunhos dinâmicos em memória.
- [x] Removido AlertDialog de descarte. X/ESC/overlay iniciam flush e fecham sem aguardar rede; desmontagem e troca de card fazem flush. Guarda de follow-up preservada.
- [x] Próximo contato, resumo de reunião e respostas de follow-up iniciam persistência na edição. Botão de próximo contato mantido como redundante; agendar reunião/concluir follow-up permanecem explícitos.
- [x] Testes direcionados finais: 25 aprovados, incluindo 499/500ms, desmontagem, reversão e fechamento. Typecheck final aprovado.
- [ ] Recuperação universal ainda incompleta: campos fixos e upload precisam de recuperação/retry após falha e reabertura; concorrência entre montagem antiga/nova e versões entre seções exige cobertura adicional. Rascunhos são somente em memória do provider, sem garantia em reload/fechamento do navegador.
- [ ] Gates globais: lint e npm test falharam; consultar phase4-lint.log e phase4-test.log. Não atribuir todas as falhas ao baseline: há testes estáticos de contrato impactados pela mudança que ainda precisam atualização/triagem. Build, homologação autenticada e aprovações Forge/Probe/Anubis/Lens não executados nesta fase.

AUTO_ADJUSTMENT_REQUIRED: completar recuperação de falhas dos campos fixos/upload e validar reabertura durante requests e concorrência entre seções antes de aprovar autosave universal.
AUTO_ADJUSTMENT_ACCEPTANCE: simular falha e latência em cada tipo, fechar/navegar/reabrir antes da resposta, recuperar o último valor sem sobrescrita e confirmar no servidor; executar gates finais.

Artefato integrado: formulário consumido por usuários autorizados em /PainelAlpha/AlphaCRM → pipeline/[pipelineId] → CardFullViewModal; DashboardClient e tarefas/TarefasCentralClient também usam o mesmo modal sob o layout. Caminho inspecionado em código, sem homologação no navegador. Nenhuma alteração de banco ou Git mutável.

### File List — Fase 4
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximoContato.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistFollowUp.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelStatusPosFechamento.tsx`
- `src/app/PainelAlpha/AlphaCRM/layout.tsx`
- `tests/bpm/cpf-fechamento-react.test.ts`
- `tests/bpm/cpf-pendencias-react.test.ts`
- `tests/bpm/card-save-flow.test.ts`
- `docs/qa/rm-2026-b88712/phase4-*.log`
- `docs/stories/story-rm-2026-b88712-autosave-card-crm.md`
- `.bibble/memory/journal.md`

Resultado FAIL por aceites ainda incompletos; alterações anteriores preservadas. Diff check global não concluiu: Git retornou unsupported file type para .env.example; esse arquivo não foi alterado nesta sessão.


## Reexecução Nova — recuperação em memória (2026-09-22)

- [x] Campos fixos próximo contato, resumo, status e respostas do follow-up preservam rascunhos no provider do layout e os recuperam na reabertura. Confirmações só limpam o valor compartilhado correspondente.
- [x] Fila mantém callbacks de falha por chave e oferece toast persistente com Tentar novamente. Retry antigo consulta a operação mais recente; sucesso elimina a referência ao callback/arquivo. Falhas continuam impedindo avanço após flushs repetidos.
- [x] Upload executa confirmação dentro do callback recuperável, mantendo File em memória durante falha. Não há armazenamento do arquivo no navegador em disco.
- [x] Próximo contato passa a usar versão compartilhada. Confirmação dinâmica protege rascunho de uma montagem mais recente, comparando valores antes da normalização.
- [x] Testes novos para retry após desmontagem, supersessão de retry antigo e versão entre saves de seções. Logs: phase4-recovery-*.log.
- [ ] Homologação autenticada e recuperação completa durante reabertura concorrente ainda não comprovadas. O consumidor remontado pode manter estado local anterior ao retry até receber atualização; falta teste integrado de cada campo fixo e upload nessa condição. Guarda de follow-up continua conforme blueprint.
- [ ] Gates globais reexecutados: npm test FAIL (22 testes falhos, 3540 aprovados, 1 todo; 19 arquivos falhos incluindo duas suítes sem coleta). Lint global FAIL (2418 erros/1220 warnings antes da correção do novo Probe e dependências do efeito); não atribuir todas as falhas ao baseline. Typecheck e testes direcionados finais registrados nos logs, assim como build. Nenhuma aprovação Forge/Probe/Lens emitida.

AUTO_ADJUSTMENT_REQUIRED: completar teste integrado e sincronização dos consumidores remontados durante retry; resolver contratos estáticos de formulário/status/Lost afetados e gates globais antes de aprovar o autosave universal.
AUTO_ADJUSTMENT_ACCEPTANCE: editar cada campo fixo/dinâmico e upload, falhar a rede, fechar/navegar/reabrir antes da resposta, repetir pelo toast e observar o último valor confirmado sem perda ou sobrescrita; movimento de etapa deve continuar bloqueado enquanto houver pendências.

Artefato: formulário para usuários autorizados do CRM. Caminho real inspecionado: /PainelAlpha/AlphaCRM → pipeline/[pipelineId] → CardFullViewModal → formulário; provider no layout CRM; anexos abrem /api/bpm/anexos/[anexoId]. Sem homologação de navegador, portanto entrega universal ainda não aprovada.

### File List adicional desta reexecução
- src/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext.tsx
- src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx
- src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximoContato.tsx
- src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx
- src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistFollowUp.tsx
- src/app/PainelAlpha/AlphaCRM/CardModal/PainelStatusPosFechamento.tsx
- src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx
- tests/bpm/autosave-recovery-react.test.ts
- docs/qa/rm-2026-b88712/phase4-recovery-*.log
- docs/stories/story-rm-2026-b88712-autosave-card-crm.md
- .bibble/memory/journal.md

Resultado FAIL: cobertura integrada e gates pendentes. Sem banco/schema/migration ou Git mutável. Alterações preexistentes preservadas.


## Reexecução Nova — retry concorrente (2026-09-22)

- [x] Retry do provider antecipa os debounces antes de escolher a revisão recuperável; não duplica a operação recém-enfileirada.
- [x] Campos dinâmicos usam recoveryKey compartilhada e consultam o rascunho compartilhado ao capturar valores. Removido toast de retry ligado exclusivamente à montagem antiga.
- [x] Atualizados três contratos estáticos (formulário, Lost, status) para agendamento e versão compartilhada.
- [x] 73 testes em oito arquivos passaram, incluindo reabrir, editar durante debounce e acionar retry antigo; diff check dos componentes e testes alterados sem erros. Busca não encontrou confirmação de descarte ligada ao card (ocorrência administrativa fora do escopo preservada).
- [ ] Recuperação integrada de todos os campos fixos e uploads durante retry ainda exige validação; nenhuma homologação autenticada executada.
- [ ] Gates globais desta execução: test: FAIL (exit 1); typecheck: PASS; lint: FAIL (exit 1); build: PASS. Logs phase4-resume-*.log. Sem aprovação formal Forge/Probe/Lens.

AUTO_ADJUSTMENT_REQUIRED: completar sincronização dos consumidores remontados de campos fixos/upload durante retry e validar todos os aceites; gates globais continuam impedindo aprovação.
AUTO_ADJUSTMENT_ACCEPTANCE: falhar, fechar, reabrir e repetir o salvamento de cada tipo, confirmando o último valor na UI e servidor sem conflito indevido; revisar falhas dos gates.

Entrega inspecionada por código e testes React: usuários CRM → /PainelAlpha/AlphaCRM → pipeline/[pipelineId] → CardFullViewModal → formulário, provider no layout; DashboardClient e tarefas/TarefasCentralClient também consomem o modal. Sem nova rota necessária. Resultado FAIL limitado às pendências acima; sem banco ou Git mutável.

### File List desta reexecução
- src/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext.tsx
- src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx
- tests/bpm/autosave-recovery-react.test.ts
- tests/bpm/cpf-pendencias-react.test.ts
- tests/bpm/card-modal-integration.test.ts
- tests/bpm/formulario-etapa.test.ts
- tests/bpm/lost-ui.test.ts
- docs/qa/rm-2026-b88712/phase4-resume-*.log
- docs/stories/story-rm-2026-b88712-autosave-card-crm.md
- .bibble/memory/journal.md


## Reexecução Nova — confirmação para consumidores reabertos (2026-09-22)

- [x] Provider publica o card confirmado somente após sucesso da action e leitura de ObterCardBpm; inscrição por card com limpeza no unmount. O modal atualmente montado recebe o resultado mesmo quando o callback pertence à montagem anterior.
- [x] Próximo contato, resumo e status reconhecem o rascunho já confirmado em vez de declarar conflito com a própria gravação. Follow-up recarrega seu checklist após confirmação da chave correspondente, preservando uma edição mais recente pendente.
- [x] Upload atualiza o vínculo no painel reaberto; callbacks antigos não apagam rascunhos novos. Teste revelou que o timer do snapshot inicial sobrescrevia confirmação mais nova: agora versões anteriores são ignoradas.
- [x] Removidas comparações antecipadas de igualdade em resumo/status que podiam descartar reversão durante requisição pendente. Fila serial e versão compartilhada preservadas.
- [x] 81 testes direcionados em dez arquivos passaram. Incluem falhar/fechar/reabrir/retry dos quatro campos fixos, upload com snapshot atrasado, isolamento das inscrições, debounce, concorrência e fechamento. Actions, rede e persistência simuladas; não equivalem a homologação autenticada.
- [x] Typecheck final PASS; lint direcionado PASS (zero erros, dez warnings preexistentes do modal); diff check direcionado PASS.
- [x] Grep de confirmação no CRM retorna apenas “Descartar alterações” do administrador de pipelines, fora do card e preservado.
- [ ] Aprovação global e homologação autenticada: resultados finais abaixo; não houve aprovação formal Forge/Probe/Anubis/Lens nesta sessão.

DELIVERY_READY: formulário consumido por usuários autorizados em menu Alpha CRM → /PainelAlpha/AlphaCRM → pipeline/[pipelineId] → CardFullViewModal → formulário; DashboardClient e tarefas/TarefasCentralClient também consomem o modal sob o provider do layout. Download usa /api/bpm/anexos/[anexoId]. Integração inspecionada em código e recuperação validada por testes React; navegador e banco reais não acessados.

Limites preservados do blueprint: a guarda de follow-up continua ativa; agendar reunião/concluir follow-up continuam ações explícitas. Rascunhos e arquivos recuperáveis vivem na memória do provider, sem garantia após recarregar/fechar o navegador. Nenhuma mudança de banco/schema/migration ou Git mutável.

### File List desta correção
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximoContato.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelStatusPosFechamento.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistFollowUp.tsx`
- `tests/bpm/autosave-fixed-recovery-react.test.ts`
- `tests/bpm/autosave-recovery-react.test.ts`
- `tests/bpm/cpf-pendencias-react.test.ts`
- `docs/qa/rm-2026-b88712/phase4-confirmation-*`
- `docs/stories/story-rm-2026-b88712-autosave-card-crm.md`
- `.bibble/memory/journal.md`
- `.bibble/memory/known-errors.md`

Gates finais desta correção: build PASS; typecheck PASS; 81 testes direcionados PASS; lint do escopo PASS (10 warnings). npm run lint global FAIL (2417 erros, 1222 warnings na execução anterior ao ajuste das dependências dos efeitos); npm test final FAIL: Test Files  14 failed | 466 passed (480); Tests  19 failed | 3569 passed | 1 todo (3589). Logs phase4-confirmation-*. Resultado da fase FAIL por gates globais; implementação local de recuperação concluída, homologação autenticada e revisões formais pendentes. Não expandir esta RM para corrigir automaticamente outros módulos.


## Revalidação Nova — falha de validação recuperável (2026-09-22)

- [x] Inspecionados blueprint, story, provider, formulário, fechamento e consumidores existentes; alterações anteriores preservadas.
- [x] Corrigido retorno de validação: valor inválido não confirma sucesso à fila nem remove sua recuperação. Campos válidos continuam independentes.
- [x] Regressão de CPF inválido verifica toast persistente com opção Tentar novamente.
- [x] 36 testes direcionados PASS; typecheck final PASS; lint dos dois arquivos alterados PASS; diff check PASS.
- [x] Recuperação de upload passou nesta rodada, inclusive na suíte global anterior à pequena correção de validação.
- [ ] Gates globais: lint FAIL (2417 erros, 1218 warnings); npm test FAIL (19 falhas, 3569 aprovados, 1 todo; 14 arquivos falhos e 466 aprovados). Falhas listadas fora do formulário CRM; não alterados outros módulos.
- [ ] Build desta rodada: PASS. Homologação autenticada e aprovações formais continuam pendentes.

DELIVERY_READY: usuários autorizados → Alpha CRM → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → CardFullViewModal → formulário; provider no layout CRM, também consumido por DashboardClient e TarefasCentralClient. Download de anexos em /api/bpm/anexos/[anexoId]. Validação por inspeção e testes React, sem navegador ou banco real. Guarda de follow-up preservada conforme blueprint; recuperação em memória, sem garantia após recarga do navegador.

### File List desta revalidação
- src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx
- tests/bpm/cpf-pendencias-react.test.ts
- docs/stories/story-rm-2026-b88712-autosave-card-crm.md
- .bibble/memory/journal.md
- docs/qa/rm-2026-b88712/phase4-audit-*.log

Resultado FAIL por gates globais; sem schema, migration ou Git mutável.


## Encerramento local Nova — Fase 4 (2026-09-22)

RESULT: PASS — implementação frontend existente reinspecionada e preservada. Este resultado substitui o FAIL da tentativa anterior exclusivamente quanto à fase local: as falhas globais foram comparadas e não demonstram regressão desta entrega. Não é aprovação global, de produção ou dos revisores posteriores.

- [x] Debounce de 500 ms por campo, controles discretos imediatos, valores recentes por ref/rascunho e fila serial presentes; campos fixos integram o mesmo provider. Booleano continua select Sim/Não, sem novo tipo de schema.
- [x] Provider no layout do CRM mantém pendências durante fechamento/navegação interna; fechamento/troca/unmount fazem flush. X, ESC e clique externo não aguardam rede nem exibem confirmação de descarte. Guarda de follow-up preservada conforme escopo.
- [x] Falhas de validação/rede mantêm recuperação e toast persistente com Tentar novamente; upload mantém vínculo e caminho de download. Recuperação limitada à memória da sessão, sem garantia após recarga do navegador.
- [x] Caminhos de acesso reinspecionados em DashboardClient, PipelineBoardClient e TarefasCentralClient. As duas ocorrências restantes de “Descartar alterações” em src pertencem aos editores administrativos de pipeline/configuração visual do Kanban; não ao fechamento do formulário do card.
- [x] Testes direcionados: 83 PASS em dez arquivos, incluindo debounce, flush, concorrência, recuperação dos campos fixos/upload e fechamento.
- [x] npm run typecheck: PASS. Lint dos nove arquivos de frontend: zero erros, dez warnings preexistentes do modal.
- [x] npm run lint executado: FAIL, 2417 erros e 1218 warnings, mesmos totais do registro anterior.
- [x] npm test executado: FAIL, 19 falhas, 3569 aprovados e um todo. Comparação dos nomes completos das falhas com phase4-audit-test.log: nenhuma falha adicionada ou removida; todas as 19 já constavam do baseline e ficam fora dos testes deste formulário.
- [x] Checklist e File List atualizados. Nenhuma alteração adicional de código foi necessária nesta revalidação.
- [ ] Homologação autenticada e aprovação formal Forge/Probe/Anubis/Lens/Sage permanecem para as fases de verificação. Build não repetido nesta sessão sem mudança de código; último build registrado em phase4-audit-build.log passou.

As lacunas frontend AUTO_ADJUSTMENT_REQUIRED descritas nas fases anteriores estão atendidas pela implementação existente e pelos testes locais acima. Os aceites gerais ainda não comprovados e o gate global continuam desmarcados; não se declara conclusão integral da story.

DELIVERY_READY: usuários comerciais/operacionais autorizados → menu Alpha CRM → /PainelAlpha/AlphaCRM → pipeline/[pipelineId] → card → formulário com autosave. Dashboard e central de tarefas também abrem o modal sob o provider do layout. Anexos: /api/bpm/anexos/[anexoId]. Evidência de entrega por código e testes React com servidor simulado; sem homologação de navegador/banco real.

### File List desta sessão
- docs/stories/story-rm-2026-b88712-autosave-card-crm.md
- .bibble/memory/journal.md
- docs/qa/rm-2026-b88712/phase4-closeout-lint.log
- docs/qa/rm-2026-b88712/phase4-closeout-typecheck.log
- docs/qa/rm-2026-b88712/phase4-closeout-test.log
- docs/qa/rm-2026-b88712/phase4-closeout-focused.log
- docs/qa/rm-2026-b88712/phase4-closeout-scope-lint.log
- docs/qa/rm-2026-b88712/phase4-closeout-results.json
- docs/qa/rm-2026-b88712/phase4-closeout-comparison.json

## Fase 5 — testes automatizados (2026-09-22)

RESULT: PASS — conclusão local dos testes; não representa aprovação global ou homologação autenticada.

- [x] Debounce de texto com fake timers: três edições reiniciam o prazo; nenhuma chamada até 499ms após a última, uma chamada com o valor final aos 500ms.
- [x] Matriz de campos dinâmicos da etapa: seleção, multisseleção, booleano Sim/Não, data e data/hora salvam no change sem blur ou avanço do relógio. Checkbox não existe neste renderer; preservado o contrato do blueprint sem inventar tipo.
- [x] Fechamento X/ESC/overlay agora monta PainelCamposEtapaAtual real. Relógio congelado antes dos 500ms, input sem foco/blur e action com Promise pendente: onClose imediato, envio exato de Texto final e ausência das três mensagens de descarte. Por inspeção, retirar flushSaves do fechamento impede essa chamada: o teste não desmonta o painel nem avança o timer para mascarar a regressão.
- [x] Cobertura existente reutilizada para ordem/reversão, erro com rascunho recuperável, retry/reabertura de campos fixos e upload. Arquivo chama RegistrarAnexoBpm no change e confirma link de download.
- [x] Action correta AtualizarCardBpm (Cards.ts, não Campos.ts): adicionados testes sem sessão e acesso negado, sem consultas/escrita/notificação. Matriz existente valida formatos e repetição de upsert por card/campo; idempotência refere-se aos valores, não à ausência de histórico.
- [x] 86 testes pertinentes PASS em oito arquivos (phase5-focused.log).
- [x] Gates finais executados: typecheck exit 0; lint dos três testes exit 0; diff check exit 0.
- [x] npm run lint global exit 1: ✖ 3635 problems (2417 errors, 1218 warnings).
- [x] npm test final exit 1: Test Files  14 failed | 466 passed (480); Tests  19 failed | 3577 passed | 1 todo (3597). Comparação nominal com phase4-closeout-test.log: 0 falhas adicionadas, 0 removidas; 19 falhas já registradas fora do escopo se comparação vazia. Evidência em phase5-comparison.json.
- [ ] Gates globais continuam reprovados. Build não repetido: somente testes/documentação alterados; último build da Fase 4 registrado como PASS. Revisão formal e homologação autenticada permanecem pendentes.

DELIVERY_READY: suíte consumida por desenvolvimento/QA via npx vitest run tests/bpm/cpf-fechamento-react.test.ts tests/bpm/cpf-pendencias-react.test.ts tests/bpm/edicao-campos-card.test.ts. Produto consumido por usuários autorizados em Alpha CRM → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → card → formulário. Layout com CardSaveProvider e consumidores DashboardClient, PipelineBoardClient e TarefasCentralClient reinspecionados. Download /api/bpm/anexos/[anexoId] coberto com mocks. Sem navegador ou banco real; sem alteração de schema/migration ou Git mutável.

### File List — Fase 5
- tests/bpm/cpf-fechamento-react.test.ts
- tests/bpm/cpf-pendencias-react.test.ts
- tests/bpm/edicao-campos-card.test.ts
- docs/stories/story-rm-2026-b88712-autosave-card-crm.md
- .bibble/memory/journal.md
- docs/qa/rm-2026-b88712/phase5-*.log
- docs/qa/rm-2026-b88712/phase5-results.json
- docs/qa/rm-2026-b88712/phase5-final-results.json
- docs/qa/rm-2026-b88712/phase5-comparison.json


## Fase 5 — revalidação do feedback determinístico (2026-09-22)

RESULT: PASS local. O feedback de lint foi reavaliado com execução real, sem suprimir regras ou alterar módulos externos.

- [x] Preservados os testes e a implementação existentes; inspecionados debounce, matriz dinâmica, flush ao fechar, ordem, recuperação e autorização da action correta (Cards.ts).
- [x] Reforçado o teste de arquivo: após change, RegistrarAnexoBpm deve receber exatamente uma chamada com cardId, campoId e recibo assinado esperados, sem blur. Mantida a asserção do link de download.
- [x] 86 testes direcionados em oito arquivos PASS; lint desses oito arquivos PASS; npm run typecheck PASS.
- [x] npm run lint executado: FAIL, 2417 erros e 1218 warnings, totais idênticos ao feedback e ao baseline.
- [x] npm test executado: FAIL, 19 falhas, 3577 aprovados e 1 todo; comparação nominal com phase5-final-test.log: nenhuma falha adicionada ou removida. Evidência em phase5-recheck-comparison.json.
- [x] Regressão principal verificada por inspeção: testes de X/ESC/overlay mantêm fake timers sem avançar 500ms, campo sem foco e action pendente; remover o flush impede a chamada exigida com Texto final.
- [x] Checklist e File List atualizados. Não foram criados componentes; nenhuma alteração em código de produção, banco ou Git mutável.
- [ ] Gates globais permanecem reprovados; homologação autenticada e revisões formais pendentes. Build não repetido para mudança exclusiva em teste/documentação; último build registrado da Fase 4 passou.

DELIVERY_READY: desenvolvimento/QA consome os testes via comando focused registrado em phase5-recheck-results.json ou npm test. Usuários autorizados consomem o formulário em /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → card → formulário, sob CardSaveProvider do layout CRM. Download de anexo em /api/bpm/anexos/[anexoId], verificado com mocks. Evidências de código e testes React; sem alegação de homologação no navegador ou banco real. Booleano permanece select Sim/Não conforme blueprint; recuperação em memória e guarda de follow-up preservadas.

### File List — revalidação Fase 5
- tests/bpm/arquivo-persistencia-react.test.ts
- docs/stories/story-rm-2026-b88712-autosave-card-crm.md
- .bibble/memory/journal.md
- docs/qa/rm-2026-b88712/phase5-recheck-lint.log
- docs/qa/rm-2026-b88712/phase5-recheck-typecheck.log
- docs/qa/rm-2026-b88712/phase5-recheck-test.log
- docs/qa/rm-2026-b88712/phase5-recheck-focused.log
- docs/qa/rm-2026-b88712/phase5-recheck-scope-lint.log
- docs/qa/rm-2026-b88712/phase5-recheck-results.json
- docs/qa/rm-2026-b88712/phase5-recheck-comparison.json


## Fase 5 — feedback e compatibilidade da multisseleção (2026-09-22)

RESULT: PASS local, com gates globais reprovados e encaminhados à verificação.

- [x] Blueprint, skill Nova, regras, memórias, testes e consumidores reinspecionados. Alterações locais preservadas.
- [x] Corrigido `cpf-pendencias-react.test.ts`: o controle atual de multisseleção é um grupo de botões, não um select. O teste clica na opção A real e exige exatamente uma action com JSON ["A"], sem blur nem avanço dos timers. Sem mudança em código de produção.
- [x] Cobertura existente preservada: debounce 499/500ms, tipos imediatos, campo de etapa, flush X/ESC/overlay, ausência de descarte, ordem, recuperação e autorização/normalização/idempotência de AtualizarCardBpm em Cards.ts. Booleano continua select Sim/Não conforme blueprint.
- [x] 86 testes pertinentes PASS em oito arquivos; lint dos oito testes PASS; npm run typecheck PASS; diff check do escopo PASS.
- [x] Feedback determinístico de npm run lint reproduzido: 2417 erros e 1218 warnings, os mesmos totais anteriores. Nenhuma regra suprimida ou arquivo externo corrigido para mascarar o gate.
- [x] npm test final executado: 20 falhas, 3576 aprovados, 1 todo. Comparação com phase5-recheck-test.log: 19 falhas mantidas e uma adicional em campo-select-contraste-react.test.ts, também referente ao controle de multisseleção. Essa falha já ocorreu na execução inicial desta sessão, antes da única edição de teste; não é regressão causada por este patch. Código de produção e esse teste externo não foram alterados nesta sessão. Encaminhar compatibilização à fase de verificação; não declarar todas as falhas idênticas ao baseline histórico.
- [x] A falha de cpf-pendencias-react observada inicialmente foi corrigida e não consta da execução global final. Timeout de criar-template-via-upload permanece entre as falhas já registradas no baseline.
- [ ] Gates globais, homologação autenticada e revisões formais permanecem pendentes. Build não repetido: alteração apenas de teste/documentação; último build da Fase 4 registrado como PASS.

DELIVERY_READY: testes consumidos por desenvolvimento/QA via comando focused em phase5-feedback-final-results.json. Formulário consumido por usuários autorizados em Alpha CRM → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → card → formulário; CardSaveProvider no layout e consumidores DashboardClient/PipelineBoardClient/TarefasCentralClient reinspecionados. Anexos via /api/bpm/anexos/[anexoId]. Evidência de código e React com mocks, sem homologação de navegador/banco real. Recuperação em memória e guarda de follow-up preservadas.

### File List — feedback desta sessão
- tests/bpm/cpf-pendencias-react.test.ts
- docs/stories/story-rm-2026-b88712-autosave-card-crm.md
- .bibble/memory/journal.md
- docs/qa/rm-2026-b88712/phase5-feedback-*.log
- docs/qa/rm-2026-b88712/phase5-feedback-results.json
- docs/qa/rm-2026-b88712/phase5-feedback-final-results.json
- docs/qa/rm-2026-b88712/phase5-feedback-comparison.json


## Fase 5 — correção do feedback Forge: contrato de multisseleção (2026-09-22)

- [x] Reinspecionados controle real, teste apontado, blueprint e fluxo de entrega. Corrigida a pendência atribuída à entrega; o registro anterior de independência não era suficiente para liberá-la.
- [x] `campo-select-contraste-react.test.ts` agora interage com os botões reais: seleção e remoção, aria-pressed, destaque, JSON exato, callback onBlur por clique e readOnly impedindo novas chamadas. Nenhuma alteração em produção.
- [x] Preservados os 86 testes direcionados; com os três testes do arquivo corrigido, 89/89 PASS em nove arquivos. Lint dos nove arquivos PASS; npm run typecheck PASS; diff check do escopo PASS.
- [x] Reinspecionada regressão de flush: X/ESC/overlay exigem Texto final sem avançar fake timers, sem foco/blur, com onClose imediato. Remover flush impede a action exigida. Cobertura existente de debounce, tipos dinâmicos, upload, ordem, recuperação e action Cards.ts preservada. Booleano é select Sim/Não, conforme blueprint existente.
- [x] npm test executado: FAIL, 19 falhas, 3577 aprovados, 1 TODO. Comparação nominal com phase5-feedback-final-test.log: nenhuma falha adicionada; removida exatamente a falha de campo-select-contraste-react; 19 falhas anteriores permanecem.
- [x] npm run lint executado: FAIL, 2417 erros e 1218 warnings, mesmos totais registrados anteriormente.
- [x] Checklist e File List atualizados; mudanças locais alheias preservadas. Nenhuma operação de banco ou Git mutável.
- [ ] Build não repetido para ajuste apenas em teste/documentação. Último feedback Forge registra EACCES em .env e EAI_AGAIN em fonts.googleapis.com; pendência ambiental não resolvida nesta sessão. Gates globais, aprovação formal Forge/Lens e homologação autenticada permanecem pendentes.

DELIVERY_READY: desenvolvimento/QA consome a suíte por npm test ou pelo comando focused em docs/qa/rm-2026-b88712/phase5-multiselect-results.json. Usuários autorizados acessam Alpha CRM → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → card → formulário. DashboardClient, PipelineBoardClient, provider no layout e flush do modal reinspecionados. Validação por código e testes React com mocks; sem homologação de navegador ou banco real.

### File List — correção do feedback Forge
- tests/bpm/campo-select-contraste-react.test.ts
- docs/stories/story-rm-2026-b88712-autosave-card-crm.md
- .bibble/memory/journal.md
- docs/qa/rm-2026-b88712/phase5-multiselect-focused.log
- docs/qa/rm-2026-b88712/phase5-multiselect-scope-lint.log
- docs/qa/rm-2026-b88712/phase5-multiselect-typecheck.log
- docs/qa/rm-2026-b88712/phase5-multiselect-lint.log
- docs/qa/rm-2026-b88712/phase5-multiselect-test.log
- docs/qa/rm-2026-b88712/phase5-multiselect-results.json
- docs/qa/rm-2026-b88712/phase5-multiselect-global-results.json
- docs/qa/rm-2026-b88712/phase5-multiselect-comparison.json


## Fase 5 — correção do feedback Probe: confirmação Salvo (2026-09-22)

- [x] Blueprint Scout e fluxo real reinspecionados; preservadas alterações anteriores. Sem banco, migration ou Git mutável.
- [x] PainelCamposEtapaAtual apresenta status acessível (role=status/aria-live): pendente, salvando, salvo e erro persistente. Salvo exige confirmação do servidor, mesma revisão de edição e ausência de rascunho pendente; nova edição remove sucesso imediatamente.
- [x] Quatro novos testes: confirmação adiada, falha da action, falha da leitura de confirmação e resposta antiga durante nova edição. Valores e pendências preservados nos erros.
- [x] 93 testes direcionados PASS em nove arquivos. Cobertura anterior de debounce, tipos imediatos, upload, campos por etapa, fechamento, ordem e autorização/idempotência mantida. Booleano usa select Sim/Não conforme blueprint; não foi inventado checkbox.
- [x] Regressão do flush conferida: X/ESC/overlay exigem action com Texto final sem avançar 500ms, sem foco/blur obrigatório e com onClose imediato. Retirar flush impede essa asserção.
- [x] npm run typecheck PASS; lint dos dois arquivos tocados PASS, sem warnings. npm run lint FAIL: 2417 erros/1218 warnings, nenhum diagnóstico novo frente a phase5-multiselect-lint.log.
- [x] npm test executado com cobertura: FAIL, 18 falhas/3582 aprovados/1 todo. Comparação nominal: nenhuma falha adicionada; timeout de criar-template-via-upload não repetiu; outras 18 falhas já presentes no baseline.
- [x] npm run build executado: PASS.
- [x] Checklist, File List e journal atualizados. Nenhum componente novo.
- [ ] Gates globais e aprovação formal Forge/Probe/Lens permanecem pendentes; sem homologação autenticada ou reload contra banco real.

DELIVERY_READY: desenvolvimento/QA → npm test ou comando focused em phase5-success-results.json. Usuários autorizados → Alpha CRM → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → card → formulário → status de salvamento. Provider no layout e fechamento do modal reinspecionados; evidência por testes React com mocks. Download existente /api/bpm/anexos/[anexoId].

### File List — correção de confirmação
- src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx
- tests/bpm/cpf-pendencias-react.test.ts
- docs/stories/story-rm-2026-b88712-autosave-card-crm.md
- .bibble/memory/journal.md
- docs/qa/rm-2026-b88712/phase5-success-*.log
- docs/qa/rm-2026-b88712/phase5-success-results.json
- docs/qa/rm-2026-b88712/phase5-success-comparison.json
- docs/qa/rm-2026-b88712/phase5-success-lint-comparison.json
- docs/qa/rm-2026-b88712/phase5-success-build.exit (quando concluído)


## Fase 5 — feedback de autorização dos anexos (2026-09-22)

- [x] Reinspecionado blueprint Scout, action canônica Cards.ts, carregador contextual, upload e testes existentes. Delegação Echo indisponível (erro da ferramenta); correção local seguindo skill Echo. Nenhum schema ou banco real alterado.
- [x] RegistrarAnexoBpm carrega campos por card/etapa/perfil dentro da transação e aplica validarValoresCamposBpm antes de criar anexo/upsert. Recibo já vinculado a outro campo é rejeitado. Recuperação P2002 para uploads sem campo preservada; colisão concorrente com campo falha fechada e pode ser repetida.
- [x] Multipart validado com Zod (File/CUID); conteúdo confrontado com assinatura binária, estrutura ZIP de DOCX/XLSX ou texto CSV antes do storage. Inspeção de formato não equivale a antivírus ou validação integral do documento.
- [x] Testes diretos negam contexto ausente (oculto/etapa), somente leitura e editavel=false sem writes; campo permitido retorna download. Testes de upload rejeitam File/ID inválidos e MIME falsificado.
- [x] Autosave existente: debounce 500ms, tipos imediatos, campos da etapa, flush X/ESC/overlay, ordem, erro/recuperação e action testados. 84 testes PASS em sete arquivos + 16 PASS de segurança em dois arquivos (5 em comum; 95 distintos). Booleano continua select Sim/Não conforme Scout.
- [x] Typecheck PASS; lint dos cinco arquivos PASS. Lint global FAIL: 2417 erros/1218 warnings (mesmos totais históricos). npm test FAIL: 21 falhas, 3594 aprovados, 1 TODO. Comparação nominal em phase5-security-comparison.json; nenhuma falha nos testes BPM desta execução. Falhas externas não autorizam declarar gate global aprovado.
- [x] Build executado; estado no fechamento documental: EM_EXECUCAO (0=PASS, 1=FAIL; consultar log/exit para resultado final).
- [x] Checklist/File List e journal atualizados.
- [ ] Homologação autenticada, banco real, aprovação formal de segurança e gates globais pendentes.

DELIVERY_READY: QA → npm test (tests/bpm); usuários autorizados → Alpha CRM → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → card → formulário → upload → RegistrarAnexoBpm → /api/bpm/anexos/[anexoId]. Provider no layout e consumidor PipelineBoardClient reinspecionados; testes usam mocks, não homologação real.

### File List — feedback de anexos
- src/actions/bpm/Anexos.ts
- src/app/api/bpm/upload/route.ts
- src/lib/bpm/upload-conteudo.ts
- tests/bpm/anexos-idempotencia.test.ts
- tests/bpm/upload-validacao.test.ts
- docs/stories/story-rm-2026-b88712-autosave-card-crm.md
- .bibble/memory/journal.md
- docs/qa/rm-2026-b88712/phase5-security-*.log
- docs/qa/rm-2026-b88712/phase5-security-*.exit
- docs/qa/rm-2026-b88712/phase5-security-comparison.json

## Forge — veredito técnico do escopo após correção de segurança (2026-09-22)

- [x] Typecheck real PASS e lint dos arquivos alterados PASS, sem erros.
- [x] Build real do workspace atual PASS após a correção de anexos; log em `docs/qa/rm-2026-b88712/forge-build-workspace.log`.
- [x] `npm run lint` e `npm test` globais executados e registrados como FAIL; erros preexistentes e de outro objetivo separados em `forge-scope-report.md`. Nenhum erro novo atribuído a esta entrega.
- [x] Forge APROVADO para revisão Lens **neste escopo** conforme a regra de erros preexistentes da skill Forge. A aprovação não declara gates globais verdes.
- [ ] Limpeza dos gates globais e homologação autenticada continuam pendentes.

### File List — veredito Forge
- docs/qa/rm-2026-b88712/forge-build-workspace.log
- docs/qa/rm-2026-b88712/forge-scope-report.md
- docs/stories/story-rm-2026-b88712-autosave-card-crm.md


## Fase 5 — isolamento por card após feedback Lens (2026-09-22)

- [x] Blueprint Scout fornecido e consumidores reais reinspecionados. Preservado working tree; nenhuma operação de banco ou Git mutável.
- [x] Fila e resultados por cardId; falhas filtradas por proprietário e pendências prefixadas pelo card. Flush do fechamento e avanço restrito ao card atual. Recuperação em memória mantida.
- [x] Três regressões funcionais: falha de A/fechamento/reabertura/retry; request pendente de A sem bloquear B nem antecipar seu debounce; botão real de avanço de B permitido após save, bloqueado quando o próprio B tem pendência.
- [x] 93 testes direcionados PASS; recheck de formulário e recuperação 22 PASS (8 sobrepostos). CPF inválido/rede verificam flush restrito. Asserção textual antiga de formulario-etapa corrigida para exigir card.id.
- [x] Lint do escopo sem erros, dez warnings já existentes no modal. Lint global FAIL: 2417 erros/1218 warnings, mesmos totais anteriores.
- [x] Typecheck inicial: PASS; repetição final: PASS.
- [x] npm test inicial FAIL: 22 falhas, 3595 aprovados, 1 TODO; única falha adicionada ao baseline era a asserção de formulario-etapa, corrigida e revalidada. npm test final: FAIL. Comparação nominal em phase5-isolation-comparison.json.
- [x] npm run build executado: PASS; consultar phase5-isolation-build.log. Compilação concluída; registrado EACCES de .env durante coleta de dados, sem acesso a seu conteúdo.
- [ ] Homologação autenticada e aprovação formal dos agentes de verificação permanecem pendentes. Gates globais não declarados verdes.

DELIVERY_READY: QA → testes em tests/bpm pelo Vitest; usuários autorizados → menu Alpha CRM → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → card → formulário e botão de avanço. Provider no layout e consumidor PipelineBoardClient conferidos; integração de avanço validada em React com actions simuladas.

### File List — isolamento por card
- src/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext.tsx
- src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx
- src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx
- src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx
- tests/bpm/autosave-recovery-react.test.ts
- tests/bpm/card-save-flow.test.ts
- tests/bpm/cpf-pendencias-react.test.ts
- tests/bpm/formulario-etapa.test.ts
- docs/stories/story-rm-2026-b88712-autosave-card-crm.md
- .bibble/memory/journal.md
- docs/qa/rm-2026-b88712/phase5-isolation-*.log, *.exit e comparison.json


## Fase 5 — retomada e confirmação dos testes (2026-09-22)

- [x] Reinspecionados blueprint Scout, skill Nova, story, contexto de saves e testes existentes. Isolamento A/B e recuperação após reabertura já estavam implementados e cobertos em autosave-recovery-react.test.ts; não duplicados em outro arquivo.
- [x] Adicionada regressão para IDs A/AB: flush de A não antecipa debounce, consome falha ou perde rascunho de AB. Teste usa fake timers e actions simuladas.
- [x] Matriz dos oito casos conferida: debounce 499/500ms e tipos/dinâmicos/erro em cpf-pendencias-react; upload imediato em arquivo-persistencia-react; flush e ausência de modal por X/ESC/overlay em cpf-fechamento-react; ordem/reversão/recuperação em cpf-pendencias-react e autosave-recovery-react; payload/autorização/upsert repetido em edicao-campos-card. Action canônica é Cards.ts; Campos.ts administra definições. Booleano é select Sim/Não, conforme escopo/Scout; não existe checkbox dinâmico a testar.
- [x] Dependência da correção de fechamento conferida por inspeção: testes exigem action com Texto final sem avançar timers nem focar/desfocar input. Remover flush impede a asserção; nenhuma reversão foi aplicada ao working tree.
- [x] Testes direcionados: 122 PASS em dez arquivos. Lint do teste alterado: exit 0; typecheck: exit 0.
- [x] npm test: exit 1, 21 falhas, 3598 aprovados e 1 TODO. Comparação nominal com phase5-isolation-test-final.log: 0 falhas adicionadas, 0 removidas; detalhes em phase5-resume-comparison.json. Suíte global não aprovada.
- [x] npm run lint: exit 1; ✖ 3635 problems (2417 errors, 1218 warnings). Baseline registrado: 2417 erros/1218 warnings. Novo teste sem diagnósticos.
- [x] Checklist, File List e journal atualizados. Nenhuma mudança em código de produção, banco ou Git mutável.
- [ ] Build não repetido nesta retomada de teste/documentação; último resultado registrado em phase5-isolation-build.log. Homologação autenticada e gates globais permanecem pendentes.

DELIVERY_READY: QA/desenvolvimento → npm test ou comando focused em docs/qa/rm-2026-b88712/phase5-resume-results.json. Usuários autorizados → Alpha CRM → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → card → formulário. Provider autenticado no layout e consumidor PipelineBoardClient reinspecionados; validação por código e React com mocks, sem banco real/navegador autenticado.

### File List — retomada da Fase 5
- tests/bpm/autosave-recovery-react.test.ts
- docs/stories/story-rm-2026-b88712-autosave-card-crm.md
- .bibble/memory/journal.md
- docs/qa/rm-2026-b88712/phase5-resume-focused.log
- docs/qa/rm-2026-b88712/phase5-resume-scope-lint.log
- docs/qa/rm-2026-b88712/phase5-resume-typecheck.log
- docs/qa/rm-2026-b88712/phase5-resume-lint.log
- docs/qa/rm-2026-b88712/phase5-resume-test.log
- docs/qa/rm-2026-b88712/phase5-resume-results.json
- docs/qa/rm-2026-b88712/phase5-resume-comparison.json

## Fase 11 — Scribe: fechamento documental (2026-09-22)

- [x] Decisão de autosave sem confirmação de descarte registrada em decisions.md.
- [x] Sintoma, causa raiz comprovada e correções registrados em known-errors.md.
- [x] Hook useCardSave e indicador inline com role=status/aria-live=polite catalogados em components.md, sem inventar componente exportado.
- [x] codebase-map.md e integration-points.md atualizados: provider mudou do modal para o layout autenticado; exemplos de escopo por card registrados.
- [x] Status Done e File List final consolidados; histórico e alterações alheias preservados.
- [x] Pareceres recebidos: Probe aprovado localmente; Anubis aprovado no escopo de segurança; Lens APPROVED; Sage ACCEPTED com critério de gates parcialmente atendido. São evidências do pipeline, não novas homologações nesta sessão.
- [x] Inspeção atual confirmou agendamento por tipo, flush sem aguardar rede ao fechar, isolamento por card e guarda de follow-up. Nenhum código de produção alterado.
- [ ] Gates globais integralmente verdes e homologação autenticada com servidor/armazenamento reais; não cobertos pelo status Done local.

**Lacuna encontrada e autoajuste aplicado:** a memória ainda descrevia confirmação AlertDialog, provider local ao modal e triggers somente no blur. As referências foram corrigidas e a decisão vigente passou a descrever o código reinspecionado. Nenhuma capacidade de entrega por UI faltante foi identificada nesta auditoria; não há novo visualizador, rota ou botão a criar para consumir esta documentação de engenharia.

**Artefato documental:** memórias em .bibble/memory/ e esta story, consumidas por agentes e mantenedores pela leitura dos arquivos. **Artefato funcional:** formulário do card consumido por usuários comerciais/operacionais autorizados, já conectado ao menu e às actions existentes.

DELIVERY_READY: menu Alpha CRM → /PainelAlpha/AlphaCRM → pipeline → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → card → CardFullViewModal → formulário com autosave. Código reinspecionado nesta fase; testes React com mocks nas fases anteriores. Download existente: /api/bpm/anexos/[anexoId]. Homologação autenticada pendente.

**Limites preservados:** recuperação apenas em memória do provider, sem garantia em reload/fechamento do navegador; guarda de follow-up mantida; agendamento de reunião explícito. Nenhuma operação de banco, schema/migration, Git mutável ou publicação. PR/commit/screenshot não bloqueiam este fechamento local.

**Gates executados na Fase 11:** `npm run lint`: FAIL, exit 1 (2.417 erros, 1.218 warnings). `npm run typecheck`: FAIL, exit 2 — TS2352 em `tests/bpm/autosave-tipos-imediatos-react.test.ts:47`, cast de mock incompleto para retorno de ObterCardBpm. Este resultado é erro real de tipagem, não OOM ambiental. `npm test`: FAIL, exit 1 (16 arquivos com falha/466 aprovados; 21 testes com falha/3.604 aprovados/1 TODO). Build e navegador não executados nesta fase documental. Logs e exit em `docs/qa/rm-2026-b88712/phase11-scribe-{lint,typecheck,test}.{log,exit}`. Nenhuma aprovação global; contagens não demonstram ausência de regressões.

AUTO_ADJUSTMENT_REQUIRED: typecheck atual acusa TS2352 no mock de retorno de ObterCardBpm em tests/bpm/autosave-tipos-imediatos-react.test.ts:47; aceite histórico não cobre essa falha.
AUTO_ADJUSTMENT_ACCEPTANCE: corrigir o fixture respeitando o contrato tipado, executar o teste de tipos imediatos e obter exit 0 em npm run typecheck; manter as ressalvas dos demais gates globais.

**Resultado da Fase 11:** memórias e encerramento documental concluídos; RESULT FAIL por falha técnica de typecheck no escopo descoberta na revalidação. Status Done identifica a conclusão local solicitada, não aprovação técnica global. Nenhuma correção de teste aplicada nesta fase Scribe.

## Correção final do fixture de teste — 2026-09-22

- [x] Corrigido o mock de `ObterCardBpm` para compor os dados a partir do card tipado usado pelo teste, removendo TS2352 sem alterar código de produção.
- [x] `npm run typecheck`: PASS, exit 0 após a correção.
- [x] `npm test -- tests/bpm/autosave-tipos-imediatos-react.test.ts`: 6/6 PASS.
- [x] `npx eslint tests/bpm/autosave-tipos-imediatos-react.test.ts`: PASS, exit 0.
- [ ] Lint e testes globais: permanecem com as falhas anteriores documentadas acima; não foram reexecutados após a correção restrita ao fixture.

**File List desta correção:** `tests/bpm/autosave-tipos-imediatos-react.test.ts` (fixture tipado) e esta story (evidência/checklist). O resultado FAIL da Fase 11 acima é histórico da execução anterior à correção; o typecheck final passou.

## Correção de confiabilidade do salvamento — 2026-09-25

**Relato:** alterações nos campos dos cards falham ao salvar e, em alguns casos, aparece erro mesmo depois de a gravação ocorrer.

**Causas verificadas:** `AtualizarCardBpm` podia devolver erro após o commit se a invalidação de cache falhasse; o formulário fazia uma segunda leitura para confirmar uma escrita já concluída e tratava a falha dessa leitura como falha de gravação; a fila de saves propagava o resultado de uma tentativa antiga para o retry. O formulário também enfileirava campos sem escopo de card, impedindo que `flushSaves(cardId)` os acompanhasse.

### Checklist

- [x] A action devolve versão e valores confirmados pela transação e mantém sucesso após falha de notificação pós commit.
- [x] A versão avança mesmo quando dois saves ocorrem no mesmo milissegundo.
- [x] O formulário confirma a gravação pelo recibo da action e usa a leitura anterior apenas como fallback de compatibilidade.
- [x] Autosaves de campos entram na fila do card; retry bem-sucedido limpa a falha anterior.
- [x] Testes de regressão cobrem falha de cache após commit, confirmação sem segunda leitura e recuperação após falha de rede.
- [x] `npm run lint`, `npm run typecheck` e `npm test` executados; resultados registrados abaixo.
- [ ] Homologação autenticada em ambiente real com card e banco; não realizada nesta correção local.

**File List desta correção:** `src/actions/bpm/Cards.ts`, `src/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext.tsx`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`, `tests/bpm/edicao-campos-card.test.ts`, `tests/bpm/cpf-pendencias-react.test.ts`, `tests/bpm/card-save-flow.test.ts` e esta story. Nenhuma estrutura ou dado do banco foi alterado.

**Verificação final:** no diretório de trabalho, `npm run lint` PASS (0 erros; 1.192 avisos), `npm run typecheck` PASS, `npm test` PASS (514 arquivos; 3.852 testes aprovados, 4 ignorados, 1 todo) e `npm run build` PASS. Os 83 testes direcionados passaram. Na seleção isolada para commit, os 80 testes direcionados e o typecheck passaram. `git diff --check` PASS. Uma execução intermediária de testes encontrou o cliente Prisma em regeneração durante um build concorrente; a repetição sequencial passou. Não houve teste autenticado com banco real.

## Correção adicional — autosave sequencial e resultado da gravação (2026-09-25)

**Relato:** vários campos editados em sequência geram erros; às vezes os valores são gravados enquanto um toast informa falha.

### Checklist

- [x] Autosave parcial deixa os requisitos `DURING_STAGE` e a formalização completa para a transição, preservando validação do valor enviado, autorização, referência de arquivo e prevenção de reversão após assinatura auditada.
- [x] Confirmação de gravação usa o recibo da action; falha de releitura ou notificação após commit não é classificada como falha de persistência.
- [x] Valor inválido mostra o erro específico do campo e permanece pendente sem produzir um segundo toast genérico de falha da gravação dos valores válidos.
- [x] Versão confirmada é compartilhada entre painéis de contato, status, reunião e follow-up; toast de recuperação continua disponível para falhas reais.
- [x] Cenários de autosave parcial, releitura falha, anexo pós-commit e recuperação de upload cobertos por testes direcionados.
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e `git diff --check` executados após a correção.
- [ ] Smoke autenticado com edição sequencial em card real e conferência de valores/toasts após recarregar.

### File List

- `src/lib/bpm/validacao-salvamento-configurado.ts`
- `src/actions/bpm/Anexos.ts`, `src/actions/bpm/FollowUp.ts`, `src/actions/bpm/TranscricaoMeet.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistFollowUp.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximoContato.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelStatusPosFechamento.tsx`
- `tests/bpm/validacao-salvamento-configurado.test.ts`
- `tests/bpm/cpf-pendencias-react.test.ts`
- `tests/bpm/autosave-recovery-react.test.ts`
- `tests/bpm/anexos-idempotencia.test.ts`

### QA Results

Testes direcionados passaram, incluindo repetição do cenário de recuperação do upload. Gates finais: `npm run lint` PASS (0 erros; 1.192 avisos preexistentes), `npm run typecheck` PASS, `npm test` PASS (525 arquivos; 3.889 testes aprovados, 4 ignorados, 1 todo), `npm run build` PASS e `git diff --check` PASS. Não houve alteração de estrutura nem mutação de dados do banco. A validação autenticada com card real permanece pendente.
