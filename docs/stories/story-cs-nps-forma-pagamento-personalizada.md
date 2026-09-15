# Story: Formas de pagamento personalizadas no CS & NPS

**ID:** STORY-CS-NPS-FORMA-PAGAMENTO-PERSONALIZADA
**Módulo:** CS & NPS > Dados do Cliente > Editar
**Status:** Ready for Review
**Prioridade:** Alta
**Data de criação:** 2026-09-15

## Executor Assignment

executor: "@dev"
quality_gate: "@ux-design-expert"
quality_gate_tools: ["eslint", "typescript", "vitest", "next-build", "coderabbit"]

## Story

**Como** usuário que edita os dados de um cliente no CS & NPS,
**quero** cadastrar, reutilizar e remover formas de pagamento personalizadas,
**para** registrar condições reais sem perder a agilidade das opções recorrentes.

## Acceptance Criteria

1. [x] Ao editar um serviço em **Dados do Cliente**, o campo **Forma Pagto.** mantém as três opções padrão atuais e exibe uma quarta entrada chamada **Personalizado**.
2. [x] Ao selecionar **Personalizado**, o usuário pode digitar uma forma de pagamento; texto vazio ou composto apenas por espaços não pode ser confirmado.
3. [x] Ao confirmar um texto personalizado válido, ele é selecionado no formulário e incluído no catálogo personalizado local para aparecer em edições futuras no mesmo navegador.
4. [x] As três opções padrão não exibem ação de exclusão; cada opção personalizada exibe um **X** ao lado.
5. [x] Ao acionar o **X**, somente a opção personalizada é removida do catálogo futuro, sem apagar ou alterar o valor já salvo em qualquer cliente e sem disparar o salvamento do formulário.
6. [x] Opções personalizadas são normalizadas com `trim` e não são duplicadas quando diferem apenas por maiúsculas/minúsculas; uma nova digitação equivalente reutiliza a opção existente.
7. [x] Selecionar uma opção padrão ou personalizada continua preenchendo `formaPagamento` e o botão geral **Salvar Alterações** continua persistindo o valor pelo fluxo existente.
8. [x] Um valor personalizado já salvo no cliente continua legível e selecionável mesmo que tenha sido removido do catálogo local.
9. [x] A implementação não cria nem altera tabela, coluna, índice, constraint, seed, migration ou backfill; o catálogo é uma preferência local do navegador e a persistência do valor do cliente permanece no fluxo existente.

## Tasks / Subtasks

- [x] **Task 1 — Definir o catálogo local de formas personalizadas** (AC: 2, 3, 5, 6, 8, 9)
  - [x] Adicionar funções pequenas para ler, normalizar, deduplicar, gravar e remover opções personalizadas no armazenamento local do navegador.
  - [x] Manter separadas as três opções padrão e as opções personalizadas.
  - [x] Tratar armazenamento ausente ou conteúdo inválido sem quebrar o modal.

- [x] **Task 2 — Integrar a experiência no campo Forma Pagto.** (AC: 1–8)
  - [x] Exibir **Personalizado** depois das três opções padrão e abrir a entrada de texto inline.
  - [x] Selecionar e adicionar o valor confirmado ao catálogo local.
  - [x] Exibir **X** apenas nas opções personalizadas e impedir que o clique no **X** selecione a opção ou salve o formulário.
  - [x] Manter visível o valor atual do cliente quando ele não fizer mais parte do catálogo.

- [x] **Task 3 — Cobrir regressões e executar quality gates proporcionais** (AC: 1–9)
  - [x] Testar carregamento, inclusão, deduplicação, remoção e recuperação diante de armazenamento inválido.
  - [x] Testar que padrões não são removíveis, que o valor atual é preservado e que a seleção continua atualizando `formaPagamento`.
  - [x] Executar testes focados, ESLint focado, `git diff --check` e registrar o resultado do typecheck global.

## Dev Notes

- As opções padrão são `ENTRADA_EXITO`, `PARCELADO_CC` e `INTEGRAL_PIX`; seus rótulos e a formatação de texto livre já estão centralizados em `formas-pagamento.ts`. [Source: `src/app/PainelAlpha/CadastroClientes/ModalCadastro/formas-pagamento.ts`]
- O campo **Forma Pagto.** da edição usa `DropdownSelecaoComCriacao`, converte rótulos padrão de volta para seus códigos e atualiza `formPorCard[registro.id].formaPagamento`. [Source: `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx#Serviços-Contratados`]
- `DropdownSelecaoComCriacao` já possui criação inline opt-in por `permiteCriarNovo`, mas ainda não oferece remoção visual de itens. A extensão deve ser opt-in para não alterar os demais consumidores. [Source: `src/app/PainelAlpha/CadastroClientes/ModalCadastro/DropdownSelecaoComCriacao.tsx`]
- `formaPagamento` já aceita texto livre de até 120 caracteres no contrato atual. [Source: `src/lib/validations/cs-nps.ts`]
- O salvamento existente atualiza `ClienteServico`; esta story não muda a action nem o contrato de persistência do cliente. [Source: `src/actions/Clientes.ts#salvarAlteracoesServico`]
- [AUTO-DECISION] Onde persistir o catálogo sem alteração estrutural? → Armazenamento local do navegador, com chave estável e payload JSON versionável (reason: atende ao reaproveitamento futuro no mesmo navegador e respeita explicitamente o escopo sem schema/migration).
- Remover uma opção do catálogo é uma preferência de UI e não uma exclusão de dado de cliente. Se o valor removido for o valor atual, ele permanece no formulário e no banco até uma alteração explícita seguida de **Salvar Alterações**.
- `accumulated-context.md` e a arquitetura sharded configurada não existem neste repositório; as orientações foram derivadas do código atual e da story relacionada `story-cs-nps-editar-servico-sincronizar-metas.md`.

## Testing

- **Framework:** Vitest, seguindo os testes existentes em `tests/cs-nps/`.
- **Unitário:** funções puras do catálogo, incluindo normalização, deduplicação case-insensitive, remoção e JSON inválido.
- **Integração/UI:** quarta entrada **Personalizado**, confirmação, seleção, **X** exclusivo para customizadas, propagação de clique e preservação do valor atual.
- **Regressão:** as três opções padrão e o salvamento geral do card continuam funcionando.

## File List

| Arquivo | Ação realizada |
|---|---|
| `src/app/PainelAlpha/CadastroClientes/ModalCadastro/formas-pagamento.ts` | Modificado — adicionados catálogo local versionado, normalização, deduplicação, leitura tolerante a falhas e remoção com lista de exclusões |
| `src/app/PainelAlpha/CadastroClientes/ModalCadastro/DropdownSelecaoComCriacao.tsx` | Modificado — adicionados texto/placeholder configuráveis e botão **X** acessível para opções removíveis, sem afetar consumidores não opt-in |
| `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx` | Modificado — carregamento do catálogo, entrada **Personalizado**, seleção, persistência local e remoção no campo **Forma Pagto.** |
| `tests/cs-nps/formas-pagamento-personalizadas.test.ts` | Criado — cobertura focada do catálogo, três padrões, persistência, deduplicação, remoção, corrupção local e wiring acessível da UI |
| `docs/stories/story-cs-nps-forma-pagamento-personalizada.md` | Criado e atualizado — rastreabilidade, conclusão e evidências dos gates |

## CodeRabbit Integration

### Story Type Analysis

- **Tipo primário:** Frontend
- **Complexidade:** Baixa — extensão localizada de um dropdown e persistência local, sem API ou banco.

### Specialized Agent Assignment

- **Agente primário:** `@dev`
- **Quality gate:** `@ux-design-expert`, com apoio de `@qa` para os testes.

### Quality Gate Tasks

- [ ] **Pre-Commit (`@dev`):** revisar alterações não commitadas, acessibilidade, isolamento entre consumidores e testes.
- [ ] **Pre-PR (`@devops`):** revisar compatibilidade com `main`, se houver PR.
- **Pre-Deployment:** não aplicável.

### Self-Healing Configuration

- **Modo:** light (`@dev`), até 2 iterações, 15 minutos, filtro CRITICAL.
- **Comportamento:** CRITICAL recebe tentativa de correção automática; HIGH é documentado; MEDIUM e LOW não bloqueiam esta etapa.

### Focus Areas

- Acessibilidade do botão **X**, incluindo nome acessível e navegação por teclado.
- O clique no **X** não pode selecionar a opção nem submeter/salvar o formulário.
- Compatibilidade do componente compartilhado com consumidores que não habilitam criação ou remoção.
- Robustez da leitura do armazenamento local e preservação do valor já salvo no cliente.

## Story Draft Checklist Validation

| Categoria | Status | Observação |
|---|---|---|
| Goal & Context Clarity | PASS | Fluxo, valor e limites estão explícitos. |
| Technical Implementation Guidance | PASS | Pontos de integração e arquivos principais identificados. |
| Reference Effectiveness | PASS | Referências apontam para código e story existentes. |
| Self-Containment Assessment | PASS | Persistência local, exclusão e edge cases estão definidos. |
| Testing Guidance | PASS | Cenários unitários, UI e regressão descritos. |
| CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e foco preenchidos. |

**Final Assessment:** READY — clareza 9/10; sem dependência de schema, migration ou ação Vault.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-09-15 | 1.0.0 | Story criada e validada para implementação | River (SM) |
| 2026-09-15 | 1.1.0 | Implementação concluída; ACs, tasks, File List e gates atualizados; status alterado para Ready for Review | River (SM) |

## Dev Agent Record

### Agent Model Used

Nova (especialista frontend; modelo não informado)

### Debug Log References

- Testes focados: **12/12 aprovados**.
- ESLint focado nos arquivos da implementação: **aprovado**.
- `git diff --check`: **aprovado**.
- `npm run typecheck`: **não aprovado por baseline preexistente fora do escopo**, sem erro novo atribuído a esta story, conforme relato de Nova.

### Completion Notes List

- Mantidas exatamente as três formas de pagamento padrão e adicionada a entrada **Personalizado**.
- Valores personalizados são normalizados, deduplicados e persistidos localmente para reutilização no mesmo navegador.
- Opções personalizadas possuem **X** acessível; a remoção afeta somente o catálogo futuro e preserva dados já salvos no cliente.
- O componente compartilhado recebeu comportamento opt-in, preservando os demais consumidores.
- Nenhuma alteração de schema, migration, backfill ou action de persistência foi realizada.

## QA Results

**PASS / APPROVED.** A revisão confirmou a seleção pela grafia canônica nas
deduplicações case-insensitive e a proteção contra `SecurityError` no acesso ao
`localStorage`. Os dois achados iniciais foram corrigidos e cobertos por testes;
não restam bloqueios no escopo.
