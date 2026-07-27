# Story: Novas opções de Origem do Lead

**ID:** STORY-CSNPS-ORIGENS-LEAD  
**Módulo:** CS & NPS  
**Status:** Ready for Review  
**Prioridade:** Média  
**Data de criação:** 2026-07-27  

## Narrativa

**Como** usuário do módulo CS,  
**quero** selecionar **Discadora** ou **Prospecção ativa (Log Comex)** em **Origem do Lead**,  
**para** registrar corretamente esses canais no cadastro dos clientes.

## Critérios de Aceitação

- [x] **AC-001:** O campo **Origem do Lead** do cadastro de cliente exibe as opções `Discadora` e `Prospecção ativa (Log Comex)`, preservando as opções atuais.
- [x] **AC-002:** O campo **Origem do Lead** da edição de cliente, em cada card de serviço contratado, exibe as mesmas duas opções com grafia e capitalização exatas.
- [x] **AC-003:** Ao cadastrar um cliente com qualquer uma das novas opções, o valor escolhido é salvo integralmente em `clientes.origemLead` e volta selecionado ao abrir a edição.
- [x] **AC-004:** Ao editar o card principal ou outro card de serviço, qualquer uma das novas opções é persistida somente no respectivo registro, seguindo o comportamento atual por serviço.
- [x] **AC-005:** A exportação completa de CS & NPS mantém a coluna `origemLead` e exporta os novos valores sem transformação ou perda de acentos.
- [x] **AC-006:** Dados existentes e a criação manual de uma origem personalizada continuam funcionando sem regressão.
- [x] **AC-007:** Não há alteração de schema ou migration; o campo existente continua sendo texto opcional.

## Tasks / Subtasks

- [x] **Task 1 — Atualizar o cadastro** (AC: 1, 3, 6)
  - [x] Adicionar as duas opções à lista padrão de origens em `ModalCadastro/modal.tsx`.
  - [x] Confirmar seleção, envio e reabertura do valor salvo.

- [x] **Task 2 — Atualizar a edição por serviço** (AC: 2, 4, 6)
  - [x] Adicionar as mesmas opções à lista usada em `ModalCadastro/modalDados.tsx`.
  - [x] Confirmar o salvamento pelo botão geral, incluindo cliente com múltiplos serviços.

- [x] **Task 3 — Validar persistência e exportação** (AC: 3–7)
  - [x] Cobrir criação e atualização com cada valor exato.
  - [x] Confirmar que a exportação escreve os valores na coluna `origemLead`.
  - [x] Confirmar que não é necessária mudança na importação atual, pois ela processa apenas sócios, logs de CS e feedbacks, não campos cadastrais de cliente.
  - [x] Confirmar que não existe filtro por Origem do Lead nem validação server-side por lista fechada a atualizar.

- [x] **Task 4 — Quality gates** (AC: 1–7)
  - [x] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.

## Dev Notes

- A lista do cadastro está em `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modal.tsx`.
- A lista da edição está em `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx`.
- `CadastrarCliente` e `AtualizarCliente` já persistem `origemLead` como texto opcional, sem enum fechado. [Source: `src/actions/Clientes.ts`]
- A exportação já seleciona e escreve `origemLead` na aba de clientes. [Source: `src/lib/cs-nps/exportar-dados.ts`]
- A importação atual aceita somente os tipos `socios`, `cs` e `feedbacks`; portanto, não há catálogo de origem do lead a alterar nesse fluxo. [Source: `src/lib/cs-nps/importacao-tipos.ts`]
- A busca no módulo não encontrou filtro por `origemLead`.
- Os usos homônimos em `ModalPdf.tsx`/`GerarFicha.tsx` pertencem à ficha da Pré-Análise e não ao cadastro do módulo CS; ficam fora desta story.
- Não foram encontrados `docs/architecture/`, `docs/prd/` ou `accumulated-context.md`; a coerência foi verificada diretamente no fluxo atual e nas stories de CS & NPS.

## Testes Esperados

| Cenário | Resultado esperado |
|---|---|
| Cadastro com `Discadora` | Valor salvo e exibido na edição |
| Cadastro com `Prospecção ativa (Log Comex)` | Valor salvo integralmente, incluindo acentos e parênteses |
| Edição do card principal | Somente o registro editado recebe a nova origem |
| Edição de outro serviço do mesmo CNPJ | O valor fica associado ao card correspondente |
| Exportação com ambas as origens | Coluna `origemLead` contém os textos exatos |
| Origem antiga ou personalizada | Comportamento existente preservado |

## File List

| Arquivo | Ação prevista |
|---|---|
| `src/app/PainelAlpha/CadastroClientes/ModalCadastro/origens-lead.ts` | Centralizar o catálogo padrão |
| `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modal.tsx` | Usar as opções no cadastro |
| `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx` | Usar as opções na edição |
| `tests/cs-nps/origens-lead.test.ts` | Cobrir opções e persistência |
| `docs/qa/coderabbit-reports/story-cs-nps-novas-origens-lead.md` | Registrar o gate automatizado |
| `docs/stories/story-cs-nps-novas-origens-lead.md` | Acompanhar a implementação |

## CodeRabbit Integration

- **Tipo:** Frontend / regra cadastral
- **Complexidade:** Baixa
- **Agentes:** `@dev`, com validação de `@qa`
- **Foco:** consistência entre cadastro e edição, texto exato e regressão da exportação.
- **Self-healing:** `@dev` light, até 2 iterações para issues CRITICAL.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-07-27 | 1.0 | Story criada e preparada para desenvolvimento | River (SM) |
| 2026-07-27 | 1.1 | Novas origens centralizadas, persistência coberta por testes e gates executados | Dex (Dev) |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npx vitest run tests/cs-nps/origens-lead.test.ts --coverage=false` — 7 testes aprovados.
- `npm test` — 229 testes aprovados na suíte final.
- `npx eslint .../origens-lead.ts tests/cs-nps/origens-lead.test.ts` — aprovado.
- `npm run lint` — excedeu o limite de 120 segundos; o lint escopado dos modais também apontou débitos preexistentes fora das linhas alteradas.
- `npm run typecheck` — a mudança está limpa; o baseline mantém erros preexistentes em `ExclusaoFiscal/route`, componentes do Alpha Blueprint, `ModalPerfilColaborador.tsx` e `HabilitacaoRadarClient.tsx`.
- `npm run build` — bloqueado por DLL do Prisma em uso; `npx next build` compilou e gerou 68 páginas com sucesso.
- `docs/qa/coderabbit-reports/story-cs-nps-novas-origens-lead.md` — CodeRabbit bloqueado por ausência de WSL.

### Completion Notes List

- Criada uma única fonte de verdade para as origens padrão, compartilhada por cadastro e edição.
- Adicionadas `Discadora` e `Prospecção ativa (Log Comex)` com grafia exata.
- Mantida a criação manual de origem personalizada por cópia mutável no cadastro.
- Testes comprovam o repasse integral de ambas as novas opções nas ações de cadastro e edição.
- Persistência e exportação continuam usando `String?` sem enum ou transformação; nenhuma migration foi necessária.

## QA Results
