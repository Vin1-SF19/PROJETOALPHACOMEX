# Story: Melhorias no relatório e no upload de Extratos Bancários

## Status

InProgress

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["lint", "typecheck", "test", "build", "coderabbit"]

## Story

**Como** usuário do módulo de Extratos Bancários,  
**quero** gerar relatórios mais claros e iniciar o processamento ao arrastar os arquivos para um modal responsivo,  
**para que** a conferência mensal e a importação de extratos sejam mais rápidas e fáceis de compreender em qualquer tamanho de tela.

## Acceptance Criteria

1. No extrato simplificado do Itaú, a descrição apresentada no relatório prioriza somente a nomenclatura do lançamento e não concatena a razão social na mesma informação.
2. A regra de simplificação do Itaú não altera descrições de extratos de outros bancos.
3. A planilha mantém o cabeçalho atual e apresenta separações visuais claras entre grupos de meses.
4. As transações permanecem ordenadas por mês, banco e data, sem perda de dados durante a exportação.
5. Ao arrastar um ou mais arquivos válidos para a área de upload, o processamento do novo relatório começa automaticamente.
6. O usuário também pode selecionar arquivos pelo seletor e iniciar o processamento manualmente; o fluxo manual permanece disponível como opção.
7. Arquivos inválidos ou acima do limite não iniciam o processamento e geram uma mensagem clara, sem apagar os arquivos válidos já adicionados.
8. O modal de inclusão de extratos possui rolagem vertical e, nas tabelas, rolagem horizontal quando necessária, sem esconder cabeçalho, ações ou feedback de progresso.
9. O modal se adapta a telas pequenas e grandes nos estados de seleção, processamento e revisão, preservando fechamento, filtros, edição e confirmação.
10. O fluxo pode ser operado por clique e teclado, e o estado visual de arrastar arquivos é perceptível.
11. Não há alteração de schema, migration, seed, backfill ou mutação em massa de banco de dados nesta story.

## CodeRabbit Integration

### Story Type Analysis

**Primary Type**: Frontend  
**Secondary Type(s)**: Exportação de planilha e normalização de dados  
**Complexity**: Medium

### Specialized Agent Assignment

**Primary Agents**:

- @dev
- @qa

**Supporting Agents**:

- @ux-design-expert

### Quality Gate Tasks

- [ ] Pre-Commit (@dev): revisar alterações não commitadas.
- [ ] Pre-PR (@github-devops): revisar a diferença em relação à `main`.

### Self-Healing Configuration

**Expected Self-Healing**:

- Primary Agent: @dev (light mode)
- Max Iterations: 2
- Timeout: 15 minutes
- Severity Filter: CRITICAL

**Predicted Behavior**:

- CRITICAL issues: auto_fix
- HIGH issues: document_only

### CodeRabbit Focus Areas

**Primary Focus**:

- Responsividade, rolagem e acessibilidade do modal.
- Preservação de dados, agrupamento mensal e compatibilidade do XLSX.

**Secondary Focus**:

- Validação de arquivos no drag-and-drop.
- Isolamento da simplificação de descrições do Itaú.

## Tasks / Subtasks

- [x] Task 1 — Normalizar a nomenclatura do Itaú (AC: 1, 2)
  - [x] Criar uma transformação testável e restrita ao Itaú para remover da descrição o trecho de razão social quando vier concatenado ao lançamento.
  - [x] Aplicar a transformação antes da visualização/exportação, preservando a descrição original dos demais bancos.
  - [x] Cobrir exemplos representativos e casos sem razão social em testes unitários.
- [x] Task 2 — Separar visualmente os meses no XLSX (AC: 3, 4)
  - [x] Manter o cabeçalho e a ordenação existentes.
  - [x] Aplicar divisões visuais no início/fim de cada grupo mensal.
  - [x] Verificar o workbook gerado com ExcelJS.
- [x] Task 3 — Automatizar o drag-and-drop sem remover o fluxo manual (AC: 5, 6, 7, 10)
  - [x] Implementar eventos de arrastar, sair e soltar, com indicação visual acessível.
  - [x] Validar tipo, extensão, tamanho e duplicidade antes de enfileirar.
  - [x] Iniciar automaticamente o processamento dos arquivos soltos válidos.
  - [x] Manter seleção por clique e botão de processamento manual.
- [x] Task 4 — Tornar o modal responsivo e rolável (AC: 8, 9, 10)
  - [x] Adequar altura máxima, espaçamentos e disposição de cabeçalho, conteúdo e rodapé.
  - [x] Garantir rolagem vertical no conteúdo e horizontal na revisão tabular.
  - [x] Manter ações importantes visíveis e utilizáveis em telas pequenas.
- [ ] Task 5 — Validar a entrega (AC: 1–11)
  - [x] Executar testes específicos do módulo.
  - [ ] Executar `npm run lint`.
  - [ ] Executar `npm run typecheck`.
  - [x] Executar `npm test`.
  - [ ] Executar `npm run build`.
  - [ ] Executar a revisão CodeRabbit quando disponível.

## Dev Notes

- A solicitação é uma melhoria isolada do módulo já existente e não depende de migration ou mudança estrutural de banco.
- Não foram encontrados documentos de arquitetura ou framework nos caminhos configurados em `core-config.yaml`; as instruções técnicas específicas devem seguir os padrões existentes do próprio módulo.
- Pontos de integração já existentes identificados pelo code intelligence: `ModalUploadExtrato`, `ModalConferencia`, `ExtratoDetalhe` e `lib/exportar-excel` em `src/components/Extratos/`.
- O endpoint de upload atual aceita PDF e DOCX, limita cada arquivo a 20 MB e processa um arquivo por requisição.

### Testing

- Adicionar testes unitários em `tests/extratos/` para a simplificação de descrição do Itaú e para a estrutura/estilo do workbook.
- Validar manualmente os estados do modal em viewport móvel e desktop quando o ambiente local estiver disponível.
- Os gates obrigatórios do projeto são lint, typecheck, testes e build.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-07-29 | 1.0 | Story criada a partir da solicitação de melhoria do módulo de Extratos Bancários. | River |
| 2026-07-29 | 1.1 | Implementação, testes e validações direcionadas concluídos; gates globais bloqueados pelo estado pré-existente do ambiente. | Dex |
| 2026-07-30 | 1.2 | Cabeçalho completo do relatório repetido em cada troca de mês para reforçar a separação visual. | Dex |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npx vitest run tests/extratos/relatorio-extrato.test.ts tests/extratos/upload-extrato.test.ts` — 8 testes passaram.
- `npm test` — 48 arquivos e 397 testes passaram.
- `npx vitest run tests/extratos/relatorio-extrato.test.ts` — 5 testes passaram, incluindo a repetição do cabeçalho mensal após serializar e reabrir o XLSX.
- `npm test` — 52 arquivos e 438 testes passaram após o ajuste do cabeçalho mensal.
- Lint direcionado dos arquivos alterados — passou.
- `npx next build` — build de produção passou.
- `npm run typecheck` — bloqueado por três erros preexistentes fora de Extratos.
- `npm run lint` — bloqueado porque a configuração global inclui `.agents`, `.aiox-core` e `.claude/worktrees`.
- `npm run build` — bloqueado no `prisma generate` por `EPERM` no DLL local em uso; o build direto do Next passou.
- CodeRabbit — indisponível porque o WSL não está instalado nesta máquina.

### Completion Notes List

- Descrições do Itaú simples removem a razão social concatenada e preservam a nomenclatura do lançamento; outros bancos e Itaú Consolidado não são alterados.
- O XLSX mantém a ordenação, congela as cinco primeiras linhas e repete o cabeçalho completo antes de cada novo mês, sem permitir que as mesclagens de mês ou banco atravessem os cabeçalhos.
- O drop de PDF/DOCX válido inicia o processamento automaticamente; a seleção por clique continua enfileirando para processamento manual.
- Validações de extensão, tamanho, arquivo vazio e duplicidade preservam os arquivos válidos do lote.
- O modal foi reorganizado com altura baseada em `dvh`, layout móvel, conteúdo rolável, revisão com rolagem horizontal e rodapé responsivo.
- Nenhuma dependência, variável de ambiente, migration ou alteração de banco foi adicionada.
- Definition of Done permanece parcial somente pelos gates globais descritos em Debug Log References.

### File List

- `docs/stories/story-extratos-bancarios-relatorio-upload-responsivo.md`
- `plan/self-critique-extratos-bancarios.json`
- `src/components/Extratos/ExtratoDetalhe.tsx`
- `src/components/Extratos/ModalUploadExtrato.tsx`
- `src/components/Extratos/lib/exportar-excel.ts`
- `src/components/Extratos/lib/relatorio-extrato.ts`
- `src/components/Extratos/lib/upload-extrato.ts`
- `tests/extratos/relatorio-extrato.test.ts`
- `tests/extratos/upload-extrato.test.ts`

## QA Results

_A preencher pelo agente de QA._
