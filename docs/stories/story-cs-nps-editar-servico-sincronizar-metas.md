# Story: Editar serviço contratado no CS & NPS com sincronização no Alpha Metas

**ID:** STORY-CS-NPS-EDITAR-SERVICO-SINCRONIZAR-METAS
**Módulos:** CS & NPS e Alpha Metas
**Status:** InProgress
**Prioridade:** Alta
**Data de criação:** 2026-09-14

## Executor Assignment

executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["eslint", "typescript", "vitest", "next-build", "coderabbit"]

## Narrativa

**Como** usuário responsável pelos dados do cliente,
**quero** editar o “Serviço Contratado Recentemente” no CS & NPS com aviso de impacto adequado à origem do registro,
**para** corrigir o serviço sem deixar os cards do CS & NPS ou o contrato correspondente do Alpha Metas divergentes.

## Critérios de Aceitação

- [ ] **AC-001 — Campo editável:** Ao ativar “Editar Dados”, o campo “Serviço Contratado Recentemente” permite selecionar ou informar o novo serviço; fora da edição, permanece somente leitura.
- [ ] **AC-002 — Card sincronizado:** Alterar o campo principal atualiza imediatamente o nome do serviço no card correspondente da seção “Serviços Contratados”, antes mesmo do salvamento.
- [ ] **AC-003 — Identificação server-side:** O sistema identifica como originado/vinculado ao Alpha Metas somente o `ClienteServico` cujo cliente e serviço atual possuem `ContratoComercial` ativo correspondente; a UI não decide sozinha essa origem.
- [ ] **AC-004 — Alerta com Alpha Metas:** Ao salvar uma troca vinculada ao Alpha Metas, abre um modal de maior risco que informa os módulos “CS & NPS” e “Alpha Metas”, mostra o serviço anterior e o novo e explica que ambos serão alterados.
- [ ] **AC-005 — Confirmação da sincronização:** Confirmar a troca vinculada atualiza o serviço em `ClienteServico` e no `ContratoComercial` correspondente; cancelar não persiste a troca e mantém o formulário aberto.
- [ ] **AC-006 — Alerta legado:** Ao salvar uma troca sem vínculo com Alpha Metas, abre modal informativo de menor risco, deixando claro que apenas o módulo “CS & NPS” será alterado.
- [ ] **AC-007 — Persistência legada:** Confirmar uma troca legada atualiza somente o `ClienteServico`; cancelar não persiste a troca.
- [ ] **AC-008 — Atomicidade:** Quando houver vínculo com Alpha Metas, a alteração dos dois registros ocorre na mesma transação; falha em qualquer atualização preserva os dois serviços anteriores.
- [ ] **AC-009 — Conflito:** A troca é recusada com mensagem clara se o cliente já possuir outro `ClienteServico` com o novo nome, preservando os registros anteriores.
- [ ] **AC-010 — Histórico e atualização:** A troca registra o campo `servico` no histórico do `ClienteServico`, revalida CS & NPS e Alpha Metas quando aplicável e atualiza a listagem após o salvamento.
- [ ] **AC-011 — Sem mudança estrutural:** A implementação reutiliza `ClienteServico`, `ContratoComercial` e o vínculo existente por cliente/serviço, sem schema change, migration, backfill ou mutação em massa.

## Tasks / Subtasks

- [x] **Task 1 — Estender o contrato de edição de serviço** (AC: 3, 5, 7–11)
  - [x] Aceitar `servico` validado no salvamento de `ClienteServico`.
  - [x] Resolver o contrato ativo correspondente no servidor pelo cliente e serviço anterior.
  - [x] Atualizar CS & NPS e Alpha Metas atomicamente quando houver vínculo.
  - [x] Registrar a mudança no histórico e retornar o impacto efetivamente aplicado.
  - [x] Tratar conflito da chave única `ClienteServico(clienteId, servico)` com mensagem amigável.

- [x] **Task 2 — Adicionar análise de impacto e confirmação** (AC: 3–7)
  - [x] Expor análise server-side de impacto para a troca solicitada.
  - [x] Abrir modal diferenciado para registro vinculado ao Alpha Metas e registro legado.
  - [x] Permitir confirmar ou cancelar sem persistência antecipada.

- [x] **Task 3 — Integrar edição ao modal de dados** (AC: 1, 2, 4–7, 10)
  - [x] Reutilizar o catálogo de serviços comerciais e permitir valor existente/customizado conforme o padrão do módulo.
  - [x] Manter o campo principal e o título do card correspondente no mesmo estado local.
  - [x] Incluir a troca no botão geral “Salvar Alterações” sem duplicar atualizações.

- [ ] **Task 4 — Testes e quality gates** (AC: 1–11)
  - [x] Cobrir identificação vinculada e legada, confirmação, cancelamento, transação e conflito.
  - [x] Cobrir o wiring do campo principal, card inferior e textos dos dois modais.
  - [ ] Executar lint, typecheck, testes, build e CodeRabbit previstos pelo projeto.

## Dev Notes

- `ClienteServico` é o registro de serviço do CS & NPS e possui chave única composta `clienteId + servico`. [Source: `prisma/schema.prisma#model-ClienteServico`]
- `ContratoComercial` representa o contrato do Alpha Metas e referencia o mesmo `Cliente` master por `clienteId`. [Source: `prisma/schema.prisma#model-ContratoComercial`]
- `buscarServicoContratadoPorCliente` já associa visualmente um serviço do CS & NPS a um contrato ativo do Alpha Metas por cliente/CNPJ e nome normalizado. A mutação deve repetir a identificação no servidor e não confiar em sinalizador enviado pela UI. [Source: `src/actions/Clientes.ts#buscarServicoContratadoPorCliente`]
- `salvarAlteracoesServico` já atualiza `ClienteServico` e seu histórico dentro de `db.$transaction`; a sincronização deve estender essa transação. [Source: `src/actions/Clientes.ts#salvarAlteracoesServico`]
- `modalDados.tsx` mantém um formulário por card e salva todos no botão geral. O campo “Serviço Contratado Recentemente” está hoje somente leitura e o card inferior usa diretamente `registro.servico`. [Source: `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx`]
- O catálogo existente é `SERVICOS_COMERCIAIS_PADRAO`; nenhum catálogo novo deve ser criado. [Source: `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modal.tsx`]
- Esta é uma alteração CRUD pontual acionada pelo usuário. Não há schema, migration, backfill nem operação em massa; portanto a política Vault de backup por mudança estrutural não é acionada.

## Testing

- **Framework:** Vitest.
- **Backend:** ampliar testes de CS & NPS com mocks de `ClienteServico`, `ContratoComercial`, histórico e transação.
- **Frontend:** regressão estrutural do modal para o estado compartilhado e os dois níveis de aviso.
- **Gates:** lint focado, `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.

## File List

| Arquivo | Ação prevista |
|---|---|
| `src/lib/validations/cs-nps.ts` | Validar o novo nome do serviço na edição |
| `src/actions/Clientes.ts` | Analisar impacto e sincronizar CS & NPS/Alpha Metas |
| `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx` | Campo editável, atualização do card e modal de confirmação |
| `tests/cs-nps/editar-servico.test.ts` | Cobrir regras server-side e atomicidade |
| `tests/cs-nps/editar-servico-ui.test.ts` | Cobrir wiring e alertas na UI |
| `tests/cs-nps/origens-lead.test.ts` | Atualizar mock transacional legado para o contrato atual da action |
| `plan/self-critique-cs-nps-editar-servico-sincronizar-metas.json` | Registrar autocrítica e resultados dos gates |
| `.ai/story-validation-cs-nps-editar-servico-sincronizar-metas.json` | Registrar validação da story pelo PO |
| `docs/qa/coderabbit-reports/story-cs-nps-editar-servico-sincronizar-metas.md` | Registrar indisponibilidade da CLI CodeRabbit |
| `docs/stories/story-cs-nps-editar-servico-sincronizar-metas.md` | Rastrear a implementação |

## CodeRabbit Integration

### Story Type Analysis

- **Tipo primário:** Integração
- **Tipos secundários:** API, Frontend
- **Complexidade:** Média — sincroniza dois registros existentes e adiciona confirmação condicional.

### Specialized Agent Assignment

- **Agente primário:** `@dev`
- **Agentes especializados:** `@architect` para atomicidade e `@ux-expert` para os alertas.
- **Apoio:** `@github-devops` somente em eventual PR.

### Quality Gate Tasks

- [ ] **Pre-Commit (`@dev`):** CodeRabbit sobre alterações não commitadas.
- [ ] **Pre-PR (`@github-devops`):** CodeRabbit comparando com `main`, se houver PR.
- **Pre-Deployment:** não aplicável.

### Self-Healing Configuration

- **Modo:** light (`@dev`), até 2 iterações, 15 minutos, filtro CRITICAL.
- **Comportamento:** CRITICAL recebe tentativa de correção automática; HIGH é documentado; demais severidades não bloqueiam esta etapa.

### Focus Areas

- Atomicidade e identificação server-side do vínculo.
- Preservação dos dois registros em falha ou cancelamento.
- Mensagens claras, acessibilidade e responsividade dos modais.
- Compatibilidade com clientes legados e chave única de serviço.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-09-14 | 1.0.0 | Story criada a partir do pedido do usuário | River (SM) |
| 2026-09-14 | 1.0.1 | Validated GO (9/10) — Status: Draft → Ready | @po |
| 2026-09-14 | 1.1.0 | Development started (interactive mode) — Status: Ready → InProgress | @dev |
| 2026-09-14 | 1.2.0 | Implementação e testes focados concluídos; gates globais preexistentes documentados | @dev |

## Dev Agent Record

### Agent Model Used

Codex (GPT-5)

### Debug Log References

- `npx vitest run tests/cs-nps/editar-servico.test.ts tests/cs-nps/editar-servico-ui.test.ts tests/cs-nps/origens-lead.test.ts` — 17/17 testes aprovados.
- `npx eslint src/actions/Clientes.ts src/lib/validations/cs-nps.ts tests/cs-nps/editar-servico.test.ts tests/cs-nps/editar-servico-ui.test.ts tests/cs-nps/origens-lead.test.ts` — aprovado.
- `npm run build` — aprovado; avisos preexistentes do `pdfjs-polyfill` não bloquearam o build.
- `npm run lint` — reprovado por 204.277 achados globais preexistentes, principalmente em `.agents`, `.aiox-core` e código não relacionado.
- `npm run typecheck` — reprovado por erros não relacionados em validadores Next gerados, Gerador de Documentos, Radar e Google Calendar.
- `npm test` — 2.892 aprovados, 26 reprovados em 13 arquivos não relacionados e 1 pendente.
- CodeRabbit — não executado: `wsl` e `/home/ialpha/.local/bin/coderabbit` indisponíveis; diagnóstico salvo em `docs/qa/coderabbit-reports/`.

### Completion Notes List

- O serviço principal agora é editável pelo catálogo comercial, aceita valor customizado e atualiza imediatamente o card inferior.
- A origem é identificada no servidor pelo Cliente e serviço atual, sem confiar em sinalizador da UI.
- Contratos vinculados são atualizados no CS & NPS e no Alpha Metas dentro da mesma transação; clientes legados alteram somente CS & NPS.
- Os dois cenários exibem confirmações responsivas com níveis de risco, módulos e comparação antes/depois.
- Não houve alteração estrutural, migration, backfill ou mutação em massa no banco.

## QA Results

_A preencher pela validação de qualidade._
