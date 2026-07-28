# Story: Editar sócios e responsáveis no detalhe do parceiro

**ID:** STORY-PARCEIROS-EDITAR-RESPONSAVEIS  
**Módulo:** Parceiros  
**Status:** Ready for Review  
**Prioridade:** Alta  
**Data de criação:** 2026-07-28  

## Narrativa

**Como** usuário autorizado a editar parceiros,  
**quero** editar também os sócios/responsáveis ao abrir o detalhe de um parceiro,  
**para** manter os dados da empresa e de seus representantes atualizados em um único salvamento.

> No modelo atual, os “sócios/responsáveis” exibidos no detalhe são persistidos na relação `Parceiro.representantes`.

## Critérios de Aceitação

- [ ] **AC-001 — Liberação conjunta:** Ao clicar em **Editar** no detalhe de um parceiro PJ, os responsáveis exibidos passam do modo leitura para campos editáveis junto com os demais dados do parceiro.
- [ ] **AC-002 — Campos editáveis:** Cada responsável permite editar nome, CPF, data de nascimento, cargo, e-mail e WhatsApp/telefone, preservando valores opcionais vazios.
- [ ] **AC-003 — Múltiplos responsáveis:** Um parceiro PJ com vários responsáveis permite editar cada item independentemente e salva todos os registros corretamente.
- [ ] **AC-004 — Adicionar:** Durante a edição de um PJ, o usuário pode adicionar um novo responsável usando o mesmo padrão já disponível no cadastro de parceiro.
- [ ] **AC-005 — Remover:** Durante a edição de um PJ, o usuário pode remover responsáveis existentes, mas o formulário e o servidor impedem salvar o parceiro sem ao menos um responsável válido.
- [ ] **AC-006 — Salvamento único:** O botão **Salvar** envia os dados do parceiro e o array completo de responsáveis em uma única operação; após sucesso, a tela volta ao modo leitura e exibe os dados atualizados.
- [ ] **AC-007 — Atomicidade:** Se a validação ou persistência de qualquer responsável falhar, os dados do parceiro e o conjunto anterior de responsáveis permanecem inalterados, sem remoção ou atualização parcial.
- [ ] **AC-008 — Cancelamento:** Clicar em **Cancelar** descarta inclusões, remoções e edições ainda não salvas; ao entrar novamente em edição, aparecem os últimos valores persistidos.
- [ ] **AC-009 — Parceiro PF:** Parceiro PF continua sem a seção de responsáveis obrigatórios; sua edição e salvamento não criam, substituem nem removem representantes.
- [ ] **AC-010 — Segurança:** Somente Admin/CEO ou usuário com `podeEditar` pode enviar alterações. Chamada direta sem permissão é negada no servidor.
- [ ] **AC-011 — Sem mudança de banco:** A implementação reutiliza `ParceiroRepresentante` e o contrato `responsaveis` já existentes, sem schema change ou migration.

## Tasks / Subtasks

- [x] **Task 1 — Criar estado editável dos responsáveis** (AC: 1–5, 8, 9)
  - [x] Inicializar o formulário a partir de `parceiro.representantes`, mapeando `documento` para CPF e `telefone` para WhatsApp.
  - [x] Renderizar modo leitura quando `editando=false` e inputs quando `editando=true`.
  - [x] Reutilizar o padrão de múltiplas “gavetas” do cadastro, com adicionar e remover.
  - [x] Manter a seção restrita a parceiros PJ.

- [x] **Task 2 — Integrar salvar e cancelar** (AC: 3–9)
  - [x] Incluir `responsaveis` no payload de `editarParceiro` somente para PJ.
  - [x] Enviar todos os responsáveis válidos, normalizando CPF conforme o contrato atual.
  - [x] Ao cancelar, reconstruir o estado do formulário com os dados persistidos, sem chamar a Server Action.
  - [x] Em falha de salvamento, manter o modo edição e informar o erro sem perder os dados digitados.

- [x] **Task 3 — Reforçar validação server-side** (AC: 5–7, 9–11)
  - [x] Exigir ao menos um responsável com nome válido quando o parceiro existente for PJ.
  - [x] Garantir que PF não altere `representantes` quando o payload omitir `responsaveis`.
  - [x] Preservar a autorização atual de `editarParceiro`.
  - [x] Manter a substituição do conjunto de representantes dentro da mesma operação transacional do parceiro.

- [x] **Task 4 — Testes e quality gates** (AC: 1–11)
  - [x] Cobrir edição de um responsável e de múltiplos responsáveis.
  - [x] Cobrir adição, remoção, tentativa de remover o último responsável de PJ e cancelamento.
  - [x] Cobrir PF sem alteração de representantes.
  - [x] Cobrir falha atômica e usuário sem permissão.
  - [x] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.

## Dev Notes

- `buscarParceiro` já carrega `representantes` completos para a página de detalhe. [Source: `src/actions/parceiros.ts`]
- `DetalheParceiroClient` já exibe os responsáveis de PJ, mas apenas em modo leitura; o payload de `salvar` os omite explicitamente. [Source: `src/components/Parceiros/DetalheParceiroClient.tsx`]
- `EditarParceiroSchema` já aceita `responsaveis`, e `editarParceiro` substitui `representantes` com `deleteMany` + `create` dentro do nested write. [Source: `src/actions/parceiros.ts`]
- O cadastro já suporta múltiplos responsáveis, adicionar/remover e exige ao menos um nome válido para PJ; esse é o padrão visual e funcional a preservar. [Source: `src/components/Parceiros/NovoParceiro.tsx`]
- O fluxo em escopo usa `ParceiroRepresentante`; não migrar nem duplicar dados em `ParceiroResponsavel`.
- Não foram encontrados `docs/architecture/`, `docs/prd/` ou `accumulated-context.md`; a coerência foi verificada no fluxo atual do módulo.

## Testes Esperados

| Cenário | Resultado esperado |
|---|---|
| PJ com um responsável editado | Dados atualizados após salvar e recarregar |
| PJ com vários responsáveis | Todos preservados; somente alterações solicitadas aparecem |
| Adicionar responsável | Novo item persistido junto com o parceiro |
| Remover um entre vários | Item removido e demais preservados |
| Remover o último responsável de PJ | Salvamento bloqueado no cliente e no servidor |
| Cancelar alterações | Nenhuma persistência; reabrir restaura dados originais |
| Erro ao salvar um responsável | Parceiro e representantes anteriores permanecem íntegros |
| Editar parceiro PF | Fluxo funciona sem payload ou mutação de representantes |
| Usuário sem `podeEditar` | Server Action retorna erro e não altera dados |

## File List

| Arquivo | Ação prevista |
|---|---|
| `src/components/Parceiros/DetalheParceiroClient.tsx` | Liberar edição, adição, remoção e cancelamento dos responsáveis |
| `src/components/Parceiros/responsaveis-form.ts` | Normalizar estado, CPF, cancelamento e payload |
| `src/actions/parceiros.ts` | Reforçar a validação de PJ e a persistência atômica |
| `tests/parceiros/responsavel.test.ts` | Cobrir edição, múltiplos responsáveis, PF/PJ e autorização |
| `docs/qa/coderabbit-reports/story-parceiros-editar-socios-responsaveis.md` | Registrar indisponibilidade do CodeRabbit |
| `docs/stories/story-parceiros-editar-socios-responsaveis.md` | Acompanhar a implementação |
| `plan/self-critique-story-parceiros-editar-responsaveis.json` | Registrar a autocrítica obrigatória do desenvolvimento |

## CodeRabbit Integration

- **Tipo:** Frontend / API / Segurança
- **Complexidade:** Média
- **Agentes:** `@dev`, com validação de `@qa`
- **Foco:** atomicidade, regra mínima de PJ, cancelamento e ausência de mutação em PF.
- **Self-healing:** `@dev` light, até 2 iterações para issues CRITICAL.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-07-28 | 1.0 | Story criada e preparada para desenvolvimento | River (SM) |
| 2026-07-28 | 1.1 | Edição de responsáveis conectada ao detalhe e protegida por testes | Dex (Dev) |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npx vitest run tests/parceiros/responsavel.test.ts --coverage=false` — 9/9 testes aprovados.
- `npx vitest run --coverage=false --exclude tests/commissions/configuracoes.test.ts` — 371/371 testes aprovados.
- `npm test` — 377/380 aprovados; 3 falhas preexistentes em `tests/commissions/configuracoes.test.ts` por mock ausente de `auditoriaComissao.create`.
- `npx eslint src/components/Parceiros/DetalheParceiroClient.tsx src/components/Parceiros/responsaveis-form.ts src/actions/parceiros.ts tests/parceiros/responsavel.test.ts` — aprovado.
- `npm run lint` — baseline global inválido por varrer `.aiox-core`, `.agents/skills` e worktrees auxiliares.
- `npm run typecheck` — alteração limpa; permanecem 4 erros preexistentes em `ExclusaoFiscal/route`, `ModalPerfilColaborador.tsx` e `HabilitacaoRadarClient.tsx`.
- `npm run build` — bloqueado pela DLL do Prisma em uso; `npx next build` compilou e gerou 68 páginas com sucesso.
- `docs/qa/coderabbit-reports/story-parceiros-editar-socios-responsaveis.md` — CodeRabbit bloqueado por ausência de WSL.
- Checklist DoD — requisitos, estrutura, segurança, testes focados, build e documentação aprovados; regressão global, lint global, typecheck global e CodeRabbit permanecem parciais por baselines documentados acima.

### Completion Notes List

- O botão Editar agora libera nome, CPF, nascimento, cargo, e-mail e WhatsApp de todos os representantes do PJ.
- Inclusão e remoção reutilizam o padrão de gavetas do cadastro; somente o nome permanece obrigatório.
- Cancelar reconstrói os responsáveis a partir dos valores persistidos.
- O salvamento envia parceiro e array completo de responsáveis em um único nested write do Prisma.
- O servidor recusa PJ sem responsável válido, preserva a autorização existente e não toca em representantes de PF.
- Nenhuma alteração de schema, migration ou dados em massa foi necessária.

## QA Results
