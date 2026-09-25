# RM-2026-8996E2 — Adicionar respostas visuais de loading

## Status

Implementação local concluída; Forge (reconciliação manual), Probe, Anubis, Lens e Sage aprovados. Documentação consolidada na Fase 9 (2026-09-24). Smoke autenticado de desktop/mobile com rede lenta segue para homologação em “Em testes”; commit/PR são pendências manuais.

## Story e pedido original

Pedido recebido: **“Adicionar respostas visuais de loading”**, projeto Painel Alpha.
Como usuário autenticado do Alpha CRM, quero perceber quando uma ação de navegação ou salvamento ainda está em andamento, para aguardar sua conclusão e poder tentar novamente em caso de erro sem perder alterações do card.

Fonte do escopo: objetivo RM-2026-8996E2, missão da Fase 2 e blueprint Scout da Fase 1 fornecido pelo pipeline. Não foi fornecida descrição original adicional. A primeira auditoria levantava hipóteses; o Scout confirmou L1 (fechamento) e L2 (arrasto), e classificou L3 (indicador agregado) como opcional.

## Consumidor e caminho real de acesso

O artefato documental é esta story, consumida pelos agentes e verificadores em `docs/stories/`; o artefato funcional são os indicadores integrados à UI existente.

O artefato funcional implementado é o feedback integrado ao CRM, consumido pelo usuário autenticado com acesso ao módulo e permissão da operação:

`Menu lateral → Alpha CRM (/PainelAlpha/AlphaCRM) → pipeline (/PainelAlpha/AlphaCRM/pipeline/[pipelineId]) → Kanban → card nativo → CardFullViewModal → fechar (X, Escape ou clique externo)`.

Para movimentação: mesma rota de pipeline → arrastar card nativo para outra etapa → soltar → aguardar confirmação/reconciliação no board.

Evidências reinspecionadas em 2026-09-23:
- `src/lib/modulos-registry.ts`: registro `crm`, rota `/PainelAlpha/AlphaCRM`, permissão `crm`.
- `src/app/PainelAlpha/AlphaCRM/layout.tsx`: `auth()`, redirecionamento sem sessão e `CardSaveProvider` acima dos consumidores.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/page.tsx`: montagem de `PipelineBoardClient`.
- `CardFullViewModal.tsx`: `solicitarFechamento`, handlers de X/Escape/clique externo e spinner de carregamento inicial.
- `PipelineBoardClient.tsx`: `onDragEnd`, `MoverCardBpm`, reconciliação, rollback e `DragOverlay`.

DELIVERY_READY: story acessível no repositório neste arquivo; infraestrutura funcional existente em `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → board → card nativo → modal/fechar e arrasto. Indicadores implementados e revalidados por inspeção do código e testes automatizados; smoke autenticado permanece pendente.

## Escopo e operações abrangidas

| ID | Operação | Delta previsto | Operação real que determina o estado |
|---|---|---|---|
| L1 | Fechar card por X, Escape ou clique externo | Feedback local de salvamento/fechamento, inclusive junto ao X, enquanto houver espera real; impedir reentrada | `solicitarFechamento()` e `flushSaves()` |
| L2 | Soltar card nativo em outra etapa | Indicador no card afetado enquanto a movimentação estiver pendente | `resolverMovimentoOtimistaBoard`, `MoverCardBpm` e reconciliação/rollback |
| R1 | Navegar dashboard → pipeline e abrir card | Preservar skeleton do board e spinner de carga do modal | Cargas já existentes; não criar timer artificial |
| R2 | Editar campos e mover pela ação do painel | Preservar feedback por campo e confirmação real do salvamento | `CardSaveContext` e `PainelProximaEtapa` |
| R3 | Atualizar board, criar card e buscar CNPJ | Verificação de não regressão dos indicadores existentes | Estados já implementados de atualização/criação/busca |

Fora do escopo: indicador global agregado L3, padronização de todos os módulos, novas rotas/permissões, automações de outras RMs, backend, banco/schema/migration e alteração dos contratos de persistência. Upload mantém o feedback existente; não criar progresso percentual sem evento real.

## Blueprint e ajustes técnicos de integração

1. **L1:** refletir a espera real em estado React local, mantendo proteção contra reentrada e encerramento em todos os caminhos (inclusive rejeição inesperada). Reutilizar `Loader2`, tokens e padrões existentes. Não mudar `CardSaveContext` para obter apenas um spinner.
2. `SheetContent` hoje injeta um X incondicional e não expõe slot de close/loading. A composição local deve manter exatamente um controle de fechar visível e acessível: ocultar somente o close padrão desta instância e compor o botão local, sem alterar `src/components/ui/sheet.tsx`. Não basta sobrepor outro botão deixando dois alvos de teclado. Validar seletor/composição real antes de editar.
3. **L2 — correção da sugestão do Scout:** `onDragEnd` chama `setActiveId(null)` antes de aguardar o servidor; portanto o `DragOverlay` sozinho NÃO entrega feedback durante a persistência. Manter identidade do card pendente e renderizar o indicador na instância do card no board, propagando o estado pela composição local de coluna/card conforme necessário. Não alterar a estratégia otimista nem restaurar posição após gravação confirmada apenas porque a releitura falhou.
4. Reutilizar `Loader2`, skeletons existentes, `AlertDialog`/toast e `useCardSave`; evitar dependências novas.
5. Estados distintos: gravando, gravado com sincronização pendente, falha de gravação. Não anunciar “Salvo” quando apenas o estado otimista mudou.

Não há lacuna de rota, menu ou download. O sinal condicional de autoajuste de L3 do Scout não se aplica: L3 não foi adotado. Os ajustes de composição de L1/L2 foram aplicados na implementação: close local único e overlay no card do board após o drop.

## Dependências, compatibilidade e divergência de memória

- Blueprint Scout recebido; esta story consolida e corrige detalhes verificáveis de integração.
- Reinspecionar o working tree antes de editar; preservar deltas de outras RMs nos mesmos componentes.
- `.bibble/memory/decisions.md` (RM-2026-B88712, 2026-09-22) descreve fechamento imediato com autosave em segundo plano e sem confirmação de saída. O código atualmente inspecionado ainda aguarda `flushSaves()` e mantém o diálogo “Campos não salvos”. **A divergência é registrada, não resolvida por esta RM de feedback visual.** Não reinstalar diálogos removidos por outra entrega, não remover o diálogo atual como parte desta RM e não converter fechamento imediato em bloqueante apenas para exibir spinner. Revalidar o contrato efetivamente presente na fase executora: o indicador acompanha somente a espera existente; se o modal desmontar imediatamente, preservar o provider e os indicadores de recuperação já disponíveis.
- Preservar guarda de follow-up, permissões de edição/movimentação, rascunhos e confirmação por revisão; nunca tratar resposta antiga como confirmação de edição nova.
- Preservar polling/realtime, rollback, ordenação, atualização manual e tratamento específico de lead virtual Noloss. O novo indicador L2 é para movimentação nativa; não alterar promoção de lead.
- Nenhuma dependência de backup ou aprovação de banco para este escopo frontend/documental.

## Critérios de aceite rastreáveis

| ID | Origem | Critério observável e validação |
|---|---|---|
| AC1 | L1 / loading real | Com Promise de flush controlada e pendente, iniciar fechamento mostra feedback visível junto ao X durante toda a espera existente; sem espera não há atraso artificial. Cobrir X, Escape e clique externo. |
| AC2 | L1 / conclusão | O feedback de salvamento só termina conforme o resultado real; sucesso mantém fechamento conforme contrato vigente. `onClose` não duplica e o spinner não implica gravação confirmada antecipadamente. |
| AC3 | L1 / erro e retry | Flush falso ou rejeitado encerra pending; modal/recuperação permanece utilizável, mensagem apropriada é acessível e uma nova tentativa funciona. Preservar os mecanismos de recuperação vigentes, sem perder rascunho. |
| AC4 | L1 / reentrada | Cliques/teclas repetidos durante espera não disparam flush concorrente nem fechamento duplicado. Bloqueio de follow-up não inicia spinner que fique preso. |
| AC5 | L2 / espera após drop | Após soltar, mesmo com `activeId=null`, apenas o card afetado comunica movimentação até a resolução do servidor/reconciliação. Tentativas concorrentes continuam bloqueadas. |
| AC6 | L2 / sucesso e falha | Sucesso mantém destino; rejeição/erro restaura snapshot e comunica falha, libera estado e permite novo arrasto. Cancelamento ou destino inválido não deixa indicador preso. |
| AC7 | L2 / confirmação parcial | Se gravação confirmar e releitura falhar, preservar mensagem de sincronização pendente e caminho de atualizar board; não repetir gravação nem fazer rollback de movimento confirmado. |
| AC8 | R1–R3 / regressão | Abertura/carga, criação, atualização manual, salvar campos e mover pelo painel mantêm feedback existente. Fechar/reabrir preserva valores confirmados e recuperação de revisões pendentes; realtime não sobrescreve edição nova com resposta antiga. |
| AC9 | L1/L2 / acessibilidade | Um único botão de fechar acessível por teclado, nome compreensível, estado ocupado/desabilitado e status textual anunciado sem depender só de animação/cor. Foco, contraste, mobile e preferência de movimento reduzido preservados. |
| AC10 | Entregabilidade / escopo | Pelo caminho autenticado de pipeline, executar fechamento e arrasto com rede lenta/sucesso/erro; indicadores consumíveis na UI e permissões preservadas. Nenhuma alteração de schema/API, nova rota ou indicador global opcional. |

## Plano de validação e gates da próxima fase

- Testes DOM com Promises controladas para AC1–AC7 e AC9, verificando estado antes e depois da resolução/rejeição; não usar apenas inspeção textual do código.
- Reutilizar/ampliar `tests/bpm/card-save-flow.test.ts`, `tests/bpm/card-modal-ui.test.ts`, `tests/bpm/card-modal-integration.test.ts` e `tests/bpm/drag-drop-rollback.test.ts` conforme seus contratos. Criar teste React específico para o indicador somente se não houver harness adequado.
- Regressão de recuperação: `tests/bpm/autosave-recovery-react.test.ts` e `tests/bpm/autosave-fixed-recovery-react.test.ts`.
- Executar lint dos arquivos TS/TSX efetivamente tocados e testes pertinentes; gates globais `npm run lint`, `npm run typecheck`, `npm test` e build real via Forge. Comparar falhas globais com baseline, registrar logs e não declarar gates reprovados como aprovados.
- Probe: presença visual, trigger, rota/proteção, permissões, persistência, estados, integração realtime e regressões; smoke autenticado desktop/mobile para AC8–AC10.
- Anubis se fronteiras auth/API/dados sensíveis forem tocadas; Lens somente após aprovação Forge; Sage para cobertura. Consolidar memórias via Scribe/Kowalski. Commit/push e screenshot são pendências manuais opcionais, sem bloquear esta preparação local.

## Checklist

- [x] Busca case-insensitive por RM em `docs/stories/` sem story anterior; artefato único criado.
- [x] Pedido, blueprint, evidências, consumidor e caminhos reais registrados.
- [x] L1/L2 delimitados; L3 opcional excluído.
- [x] Composição do X e ciclo pós-drop especificados; divergência da memória registrada.
- [x] Aceites rastreáveis, dependências, riscos e File List inicial definidos.
- [x] Implementação funcional reservada à fase seguinte.
- [x] Implementar L1 e L2 com estado vinculado às operações reais.
- [x] Registrar cobertura automatizada e por inspeção de AC1–AC10 e regressões pertinentes (51 testes direcionados PASS, conforme Fase 3). AC3/AC6 têm retry e exceção cobertos apenas por leitura; a parcela autenticada/responsiva de AC8–AC10 permanece pendente abaixo.
- [x] Registrar gates da implementação. (Lint: 0 erros; Typecheck: exit 0; Tests: 51/51 PASS; suíte e build confirmados na reconciliação Forge — ver “Fechamento da Fase 9”)
- [ ] Smoke autenticado desktop/mobile com rede lenta (sucesso, falha + nova tentativa, arrastes rápidos, persistência ao reabrir/recarregar). Pendência manual da etapa “Em testes”.
- [x] Atualizar checklist, File List final e memórias da implementação.
- [x] Reconciliar números divergentes do registro de validação (Fase 9).
- [x] Arquivar a sessão no `journal.md` e encerrar o plano (Fase 10, Kowalski). Sem commit, push, deploy nem `/virtus`.

## File List

### Alterações desta fase documental

- [x] `docs/stories/story-rm-2026-8996e2-respostas-visuais-loading.md` — story nova.
- [x] `.bibble/memory/journal.md` — registro aditivo desta preparação.
- Logs locais de gates: `.cache/rm-2026-8996e2-phase2/` (evidência operacional, não código funcional).

### Implementação efetiva

- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx` — L1 e composição local do fechamento.
- [x] `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` — L2, identificação e renderização do card pendente.
- [x] `tests/bpm/cpf-fechamento-react.test.ts` e `tests/bpm/board-polling-react.test.ts` — estados antes/depois do salvamento e do movimento.
Referências de regressão executadas, sem diff nesta RM: `tests/bpm/card-save-flow.test.ts`, `tests/bpm/drag-drop-rollback.test.ts` e `tests/bpm/card-modal-integration.test.ts`.

Referências sem edição prevista: `sheet.tsx`, `CardSaveContext.tsx`, `CardAbertoLayout.tsx`, `PipelineBoardSkeleton.tsx`, `NovoCardModal.tsx`, painéis existentes, layout, registro de módulos e rotas. Nenhum componente criado nesta fase.

## Registro de validação da Fase 2

Validação documental: unicidade da RM, caminhos locais, critérios, checklist e File List conferidos. Gates globais registrados abaixo após execução; não constituem aprovação funcional dos indicadores ainda não implementados.

- `npm run lint`: exit 0, zero erros e 1.192 warnings globais; nenhuma alteração TS/TSX nesta fase.
- `npm run typecheck`: exit 0.
- `npm test`: exit 1 antes dos testes, `EBUSY` ao remover `coverage`. Mesma falha comprovada em `docs/qa/rm-2026-1ffbaa/test.log`; não atribuível aos dois documentos desta fase. Suíte global NÃO aprovada.
- Validação documental por script: PASS — uma única story para a RM, AC1–AC10 presentes, arquivos referenciados existentes exceto o componente opcional explicitamente futuro.
- Build, testes funcionais novos e smoke autenticado não executados nesta preparação documental; permanecem no checklist da implementação. Não houve aprovação Forge/Lens da funcionalidade.
- Logs e exit codes: `.cache/rm-2026-8996e2-phase2/{lint,typecheck,test}.{log,exit}`.


## Fase 3 — implementação local Nova (2026-09-23)

L1: estado real de flush com finally e recuperação de rejeição; close local mantém nome, aria-busy/aria-disabled e status textual. O close padrão desta instância é ocultado por seletor direto (último botão filho), sem mudar Sheet. L2: identidade separada de activeId propagada ao card; overlay permanece após drop até reconciliação/rollback. Ambos respeitam movimento reduzido. Nenhum contrato de persistência alterado.

DELIVERY_READY: usuário autenticado → menu Alpha CRM → /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → card → fechar; na mesma rota, arrastar card nativo. Integração validada por inspeção e DOM controlado, sem smoke autenticado de navegador.

Validação: 32 testes passaram em 5 arquivos, incluindo X/Escape/externo, pending e reentrada, erro, recuperação, movimentação com sucesso/falha/sincronização pendente. Lint dos tocados: zero erros, 10 warnings em declarações preexistentes. Lint global: zero erros, 1.212 warnings (baseline documental: 1.192). npm test: EBUSY em coverage, igual ao baseline. Typecheck global encontra fixtures de pipeline-editor-react e relacionamento-ui fora do escopo; o erro na fixture nova foi corrigido e o gate repetido. Logs completos e códigos em .cache/rm-2026-8996e2-phase3/. Build real executado; consultar registro abaixo. Smoke desktop/mobile, rejeição inesperada de flush e homologação AC8–AC10 permanecem para verificação; não se declara aprovação Forge/Lens.

### File List efetiva
- src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx
- src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx
- tests/bpm/cpf-fechamento-react.test.ts
- tests/bpm/board-polling-react.test.ts
- docs/stories/story-rm-2026-8996e2-respostas-visuais-loading.md
- .bibble/memory/journal.md
- Gate lint: 0.
- Gate typecheck: 2.
- Gate test: 1.
- Gate build: 0.

Resultado final typecheck: exit 2. (Histórico da Fase 3, superado: a revalidação de 2026-09-24 e o Forge registraram `npm run typecheck` exit 0.)

Resultado final build: exit 0.

## Revalidação técnica de 2026-09-24

- `npx vitest run tests/bpm/cpf-fechamento-react.test.ts tests/bpm/board-polling-react.test.ts tests/bpm/card-save-flow.test.ts tests/bpm/drag-drop-rollback.test.ts tests/bpm/card-modal-integration.test.ts`: 51/51 testes aprovados.
- `npm run typecheck`: exit 0; `npm run lint`: exit 0, zero erros e 1.192 avisos globais; `npm test`: 504 arquivos e 3.796 testes aprovados; `npm run build`: exit 0.
- Os estados de espera do X e do card movido são vinculados às Promises reais e encerram em sucesso ou erro; a validação autenticada visual e responsiva continua como atividade da etapa “Em testes”.

## Fechamento da Fase 9 — documentação e rastreabilidade (2026-09-24)

### Onde o usuário encontra os indicadores

| Indicador | Caminho | Operação representada |
|---|---|---|
| Spinner no lugar do X + status “Salvando alterações…” | Menu lateral → Alpha CRM → `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → abrir card → fechar por X, Escape ou clique externo | `solicitarFechamento()` aguardando `flushSaves()` (`CardFullViewModal.tsx`) |
| Overlay “Movendo card…” no card afetado | Mesma rota → arrastar card nativo para outra etapa e soltar | `MoverCardBpm` + reconciliação/rollback (`PipelineBoardClient.tsx`, estado `cardMovendoId`) |

Indicadores preexistentes preservados (R1–R3): skeleton do board, spinner de carga do card, feedback por campo, mover pelo painel, atualização manual, criação de card e busca de CNPJ.

### Evidências herdadas das fases anteriores (não equivalem à reexecução abaixo)

- **Navegação/fechamento:** `tests/bpm/cpf-fechamento-react.test.ts` — X/Escape/clique externo com flush pendente, clique repetido grava uma vez, sucesso limpa o indicador, falha abre “Campos não salvos” com indicador limpo.
- **Movimentação:** `tests/bpm/board-polling-react.test.ts` — “Movendo card…” em um único card, some ao terminar; gravação confirmada com releitura falha mostra “Movimento salvo…”, sem rollback.
- **Recuperação:** `autosave-recovery-react.test.ts` e `autosave-fixed-recovery-react.test.ts` (Sage); nova tentativa após falha ao fechar e após falha de arraste comprovadas só por leitura de código.
- **Gates:** a reconciliação manual do Forge (terminal do projeto, 2026-09-24) é a referência: `npx vitest run --testTimeout 30000` com 505 arquivos e 3.808 testes aprovados (4 skipped, 1 todo), `npm run build` exit 0 com 78/78 páginas, typecheck e lint aprovados. Logs: `/tmp/alpha-rm-vitest-long-timeout.log` e `/tmp/alpha-rm-build.log`, fora do repositório. Os números da revalidação acima (504 arquivos, 3.796 testes) são um registro histórico distinto; não foi aferida equivalência de checkout/ambiente nem causalidade da diferença. A referência de aprovação recebida nesta fase é a reconciliação Forge (505/3.808). O gate do Forge no sandbox foi bloqueado por ambiente (sem URL de banco, `.env` e rede para fontes), não pelo código.
- **Revisões:** Probe (8 pontos), Anubis (somente visual, guardas de servidor preservadas), Lens (sem bloqueios) e Sage (AC1–AC10 com smoke manual pendente).

### Pendências explícitas

- Smoke autenticado desktop/mobile com rede lenta: sucesso, falha forçada + nova tentativa, arrastes rápidos seguidos, persistência ao reabrir/recarregar.
- Testes sugeridos pela Sage (não bloqueantes): falha ao fechar → Cancelar → novo X fecha uma vez; flush que lança erro → nova tentativa; arraste com falha → segundo arraste aceito.
- Lens (menor): card pode ser aberto enquanto “Movendo card…” está ativo (ignorar `onAbrir` enquanto `movendo`); `onAbrirCard` executa `flushSaves()` sem feedback nem `fechandoRef` (anterior a esta RM; sugerida story própria).
- Divergência de memória mantida: `decisions.md`/`known-errors.md` (RM-2026-B88712) descrevem fechamento imediato sem “Campos não salvos”, mas o código atual aguarda o flush e mantém o diálogo. Não resolvida nesta RM.
- Commit/PR e screenshot: manuais. Não houve publicação nem aprovação humana registrada nesta fase.

### File List da Fase 9

- `docs/stories/story-rm-2026-8996e2-respostas-visuais-loading.md` — status, checklist e fechamento.
- `.bibble/memory/decisions.md` — decisão de indicadores ligados às Promises reais.
- `.bibble/memory/known-errors.md` — armadilha do `DragOverlay` após o drop.
- `.bibble/memory/journal.md` — registro do fechamento.
- `codebase-map.md`, `integration-points.md` e `components.md` sem alteração: não houve estrutura, integração ou componente novo.


### Reinspeção local da Fase 9 — Scribe, 2026-09-24

Diff contra HEAD conferido nos dois componentes e dois testes alterados da RM. Há alterações de outras RMs no working tree; elas não pertencem à File List desta entrega. Corrigidos os trechos que ainda apresentavam os indicadores como trabalho futuro e a lista que confundia testes executados com modificados. Os registros históricos de gates são mantidos com proveniência, sem inferir que todas as execuções usaram o mesmo checkout.

Sem lacuna de acesso encontrada: o registro `crm` em `src/lib/modulos-registry.ts`, o layout autenticado com `CardSaveProvider` e a página de pipeline que monta `PipelineBoardClient` foram reinspecionados. Consumidor: usuário autenticado com acesso ao CRM e permissão de movimentação. Autoajuste aplicado: reconciliação documental; nenhuma rota, botão ou integração nova necessária.

DELIVERY_READY: Menu → Alpha CRM → `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → arrastar card nativo (“Movendo card…”); abrir/editar card → X, Escape ou clique externo (“Salvando alterações…”). Caminho validado em código e sustentado pelos testes recebidos; não representa smoke autenticado ou publicação.

File List adicional desta reexecução: esta story, `.bibble/memory/codebase-map.md` (ressalva factual do fechamento atual) e `.bibble/memory/journal.md`. `decisions.md` e `known-errors.md` já contêm os registros específicos da RM, preservados. `integration-points.md` e `components.md` não exigem atualização: não há integração nem componente reutilizável novo.

Gates executados nesta reexecução documental: `npm run lint` exit 0; `npm run typecheck` exit 0; `npm test -- --testTimeout 30000` exit 1 antes da suíte (`EBUSY` ao remover `coverage`). Sem apagar ou desbloquear a pasta, `npx vitest run` nos cinco arquivos direcionados acima, com `--testTimeout 30000` e sem cobertura, passou: 5 arquivos, 51 testes, exit 0. Logs e códigos: `.cache/rm-2026-8996e2-phase9/{lint,typecheck,test,targeted}.{log,exit}`. Build não repetido nesta fase exclusivamente documental; evidência recebida do Forge permanece identificada acima. A suíte global com cobertura continua sem resultado nesta reexecução e deve ser repetida quando `coverage` estiver disponível. PASS documental não significa aprovação nova do gate global nem conclusão do smoke.

## Encerramento do plano — Fase 10, Kowalski (2026-09-24)

Sessão arquivada em `.bibble/memory/journal.md` (entrada "Kowalski — RM-2026-8996E2 — Fase 10"), com o histórico preservado. O registro liga o pedido original às fases, à solução utilizável, ao caminho de consumo e às evidências de gate com a origem de cada uma.

- **Estado:** implementação validada localmente. **Não publicada em produção**: não houve commit, push nem deploy. `/virtus` fica disponível apenas por chamada manual do usuário e não foi ativado.
- **Vault:** não se aplica. Qualquer mudança de banco futura continua sujeita ao Vault e não é autorizada por este encerramento.
- **Pendências não impeditivas:** as mesmas listadas em "Pendências explícitas" acima, mais a suíte global com cobertura (`EBUSY` em `coverage`).
- **Gates desta fase:** nenhum comando executado (alteração só em Markdown, feita com Read/Grep/Edit). As evidências vêm da reconciliação Forge e das fases anteriores.

DELIVERY_READY: Menu → Alpha CRM → `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → arrastar card nativo ("Movendo card…"); abrir card → X, Escape ou clique externo ("Salvando alterações…").

### File List da Fase 10
- `.bibble/memory/journal.md` — registro de arquivamento do Kowalski.
- `docs/stories/story-rm-2026-8996e2-respostas-visuais-loading.md` — item de checklist e esta seção.
