# Story: Corrigir processamento do Extrato Mensal Itaú de julho de 2026

## Status

InProgress

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["lint", "typecheck", "test", "build", "coderabbit"]

## Story

**Como** usuária do módulo de Extratos Bancários,
**quero** que o PDF Itaú no layout `Extrato Mensal` seja processado integralmente,
**para que** os lançamentos de conta corrente das quatro páginas sejam carregados corretamente em `/PainelAlpha/ExtratosBancarios`.

## Contexto e escopo

Maria Eduarda Almeida de Azevedo reportou que as quatro páginas do arquivo `Extrato Mensal_Julho2026-zsj4IwML12vdmPHFLNoRXlaJjpMH4r.pdf` não foram processadas. A amostra é um PDF de quatro páginas, criado pelo eStatements/Fiserv, e deve ser usada apenas para investigação local e para construir uma fixture sanitizada; ela não pode se tornar dependência dos testes nem ser adicionada ao repositório.

O layout `Extrato Mensal` não deve ser assumido como equivalente ao layout Itaú simplificado já coberto em `parserItau`. A implementação deve identificar sua assinatura de forma inequívoca, encaminhá-lo ao parser determinístico adequado e manter o fallback atual para textos sem essa assinatura ou para os demais bancos/layouts.

[AUTO-DECISION] Como preservar a privacidade do extrato real? → Criar fixture mínima e sanitizada com os padrões estruturais necessários, substituindo nome, documento, conta, favorecidos e valores que não sejam indispensáveis ao oráculo (reason: a regressão precisa ser reproduzível no CI sem versionar dados financeiros ou cadastrais da usuária).

[AUTO-DECISION] É necessário alterar banco de dados? → Não (reason: a falha está na extração, detecção e normalização em memória; schema, migrations e dados persistidos estão explicitamente fora de escopo).

## Acceptance Criteria

1. O módulo reconhece de forma determinística o layout mensal do Itaú presente na amostra de julho/2026 e não o encaminha ao fluxo por agentes quando o texto contém a assinatura validada desse layout.
2. Ao processar o texto extraído das quatro páginas da amostra, o módulo retorna os lançamentos relevantes da seção de conta corrente, sem páginas com erro e sem perder lançamentos na primeira, nas intermediárias ou na última página.
3. Cada lançamento retornado possui data completa no formato `DD/MM/YYYY`, descrição não vazia em formato normalizado e valor numérico diferente de zero, com sinal positivo para crédito e negativo para débito conforme o extrato.
4. Datas curtas exibidas no layout são completadas com o mês e o ano de referência declarados no próprio PDF; o parser não usa o ano corrente nem infere uma data fora do período do extrato.
5. O parser mantém a associação correta entre data, histórico e valor quando uma movimentação, cabeçalho ou rodapé é quebrado entre linhas ou na transição entre páginas.
6. Saldos, aplicações, resgates ou rendimentos de investimentos que não pertençam à movimentação de conta corrente, cabeçalhos, rodapés, totais, dados cadastrais, avisos e notas não são retornados como transações.
7. Uma mesma movimentação é retornada uma única vez; a correção não cria duplicidades em limites de página nem descarta lançamentos válidos da conta corrente.
8. O contrato `ParserExtrato`, a seleção por `bancoId` e o comportamento dos parsers de outros bancos e dos layouts Itaú já validados permanecem compatíveis.
9. Há testes automatizados determinísticos derivados da amostra, com fixture sanitizada e versionada no repositório, que validam o conjunto esperado de transações (data, descrição, valor e sinal), as quatro páginas, datas curtas, limites entre páginas e a exclusão de linhas não transacionais. A suíte não depende de `C:\Users\TI\Downloads` nem do PDF original.
10. Não há alteração de schema, migration, seed, backfill, dados persistidos ou outra mudança de banco de dados nesta story.
11. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` são executados e seus resultados documentados. A revisão CodeRabbit não apresenta issue `CRITICAL` quando a ferramenta estiver disponível.

## 🤖 CodeRabbit Integration

### Story Type Analysis

**Primary Type**: Backend / parsing determinístico
**Secondary Type(s)**: Integração de processamento de PDF e testes de regressão
**Complexity**: Medium

### Specialized Agent Assignment

**Primary Agents**:

- @dev
- @qa

**Supporting Agents**:

- Nenhum obrigatório; não há alteração de banco, contrato externo ou arquitetura.

### Quality Gate Tasks

- [ ] Pre-Commit (@dev): executar a revisão CodeRabbit sobre alterações não commitadas, quando disponível.
- [ ] Pre-PR (@github-devops): executar a revisão CodeRabbit em relação à `main`, quando disponível.
- [ ] Gate do projeto (@dev): executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`, documentando bloqueios preexistentes separadamente do escopo da story.

### Self-Healing Configuration

**Expected Self-Healing**:

- Primary Agent: @dev (light mode)
- Max Iterations: 2
- Timeout: 15 minutes
- Severity Filter: CRITICAL

**Predicted Behavior**:

- CRITICAL issues: auto_fix
- HIGH issues: document_only
- MEDIUM issues: ignore
- LOW issues: ignore

### CodeRabbit Focus Areas

**Primary Focus**:

- Detecção específica do `Extrato Mensal` sem colisão com layouts de outros bancos ou com o Itaú simplificado.
- Reconstrução de lançamentos entre linhas/páginas, sinais monetários e ano de referência do PDF.

**Secondary Focus**:

- Exclusão de saldos, aplicações, notas e dados cadastrais.
- Fixtures sanitizadas e testes independentes de arquivos locais/serviços externos.

## Tasks / Subtasks

- [x] Task 1 — Diagnosticar a regressão com a amostra local (AC: 1–7)
  - [x] Extrair o texto por página usando a mesma camada `pdf-parse` utilizada no processamento real e registrar somente métricas/estrutura, sem expor conteúdo financeiro ou cadastral em logs.
  - [x] Comparar a assinatura e o texto extraído com a detecção em `detectarParserExtrato`, identificando por que as quatro páginas não receberam resultado determinístico.
  - [x] Definir o oráculo manual dos lançamentos relevantes de conta corrente, incluindo transições de página, para confrontar a saída final.
- [x] Task 2 — Implementar o suporte determinístico ao layout mensal (AC: 1–8)
  - [x] Adicionar ou especializar regras para a assinatura do `Extrato Mensal` no parser Itaú, sem transformar uma assinatura ambígua em detecção automática.
  - [x] Reconstituir registros divididos em linhas ou páginas e resolver datas curtas pelo período informado no PDF.
  - [x] Filtrar explicitamente saldo, aplicação, investimento, cabeçalho, rodapé, totais, notas e dados cadastrais antes de emitir `TransacaoNormalizada`.
  - [x] Preservar o fallback atual quando o layout não for reconhecido ou quando o parser determinístico não produzir transações.
- [x] Task 3 — Cobrir a regressão com testes sanitizados (AC: 2–9)
  - [x] Criar fixture textual mínima, sanitizada e representativa das quatro páginas; não adicionar o PDF original nem referências a Downloads.
  - [x] Testar detecção, conjunto completo esperado de lançamentos de conta corrente, datas, sinais, quebras de linha/página, ausência de duplicatas e exclusão das seções não transacionais.
  - [x] Manter os testes existentes do Itaú simplificado, Santander e fallback como proteção de compatibilidade.
- [ ] Task 4 — Validar e documentar a entrega (AC: 10–11)
  - [ ] Confirmar no diff que não há alteração de schema, migration, seed, backfill ou dados persistidos.
  - [ ] Executar os quatro gates do projeto e a revisão CodeRabbit quando disponível.
  - [ ] Atualizar tarefas, Dev Agent Record e File List antes de encaminhar a revisão.

## Dev Notes

### Contexto técnico

- O fluxo de produção extrai texto de PDF página a página via `pdf-parse`, junta as páginas para tentar um parser determinístico e só usa o Agente Organizador como fallback. O retorno determinístico bem-sucedido deve ter `paginasComErro: []`. [Source: `src/lib/onyx/extrato-agents.ts#extrairPaginas`; `src/lib/onyx/extrato-agents.ts#processarExtratoPorAgentes`]
- A detecção atual reconhece somente a assinatura do `Lançamentos do período`/`Saldo total disponível dia` para Itaú. A nova assinatura deve ser validada contra o layout mensal e ser específica o suficiente para não sequestrar arquivos não validados. [Source: `src/lib/extrato/parsers/index.ts#detectarParserExtrato`]
- `parserItau` já recompõe linhas lógicas a partir de datas completas e valores ao final da linha, e exclui alguns saldos. O layout mensal pode requerer uma especialização, mas não deve degradar o comportamento existente do Itaú simplificado. [Source: `src/lib/extrato/parsers/itau.ts#parse`; `tests/extratos/parsers-extratos-reais.test.ts`]
- `ParserExtrato.parse(texto)` retorna `TransacaoNormalizada[]`; a interface e o catálogo de parsers devem permanecer compatíveis. [Source: `src/lib/extrato/parsers/types.ts`; `src/lib/extrato/parsers/index.ts#PARSERS`]
- Os utilitários já convertem valores brasileiros e concentram padrões genéricos de linhas ignoráveis. Preferir regras específicas do layout quando a semântica de conta corrente/aplicações não puder ser expressa com segurança de forma compartilhada. [Source: `src/lib/extrato/parsers/utils.ts`]
- `docs/stories/accumulated-context.md` não existe neste workspace. Para coerência cruzada, esta story foi alinhada com `story-extratos-bancarios-pdfs-reais-itau-santander.md`: preservar parser determinístico, não depender de arquivos em Downloads, não registrar dados brutos e não alterar banco.

### Project Structure Notes

- Pontos prováveis de alteração: `src/lib/extrato/parsers/itau.ts`, possivelmente `src/lib/extrato/parsers/index.ts`, e testes/fixtures em `tests/extratos/`.
- `src/lib/onyx/extrato-agents.ts` só deve mudar se a investigação provar que o encadeamento de páginas/detecção impede o parser de receber o texto completo; não substituir o fallback por IA para corrigir este layout.
- Nenhuma rota, componente, variável de ambiente, dependência, schema ou migração nova é necessária.

### Testing

- Usar Vitest em `tests/extratos/`, no padrão de `tests/extratos/parsers-extratos-reais.test.ts`. [Source: `package.json#scripts`; `tests/extratos/parsers-extratos-reais.test.ts`]
- A fixture deve conter as quatro seções/páginas representativas e ser sanitizada. O teste precisa afirmar transações completas e não apenas uma contagem positiva.
- Além da suíte direcionada, executar os gates exigidos por `AGENTS.md`: lint, typecheck, testes e build. Resultados bloqueados por falhas preexistentes devem apontar o arquivo/causa fora de escopo, sem mascarar a validação direcionada.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-08-28 | 1.0 | Story criada para a regressão do layout Itaú Extrato Mensal de julho/2026, com quatro páginas não processadas. | River |
| 2026-08-28 | 1.0.1 | Desenvolvimento iniciado — Status: Ready → InProgress. | Dex |

## Story Draft Checklist Validation

| Category | Status | Evidence |
|---|---|---|
| 1. Goal & Context Clarity | PASS | Usuária, falha de quatro páginas, resultado esperado e escopo estão explícitos. |
| 2. Technical Implementation Guidance | PASS | Pipeline, pontos de extensão, contrato, fallback e limites de alteração foram identificados. |
| 3. Reference Effectiveness | PASS | As referências indicam arquivos e símbolos específicos do módulo. |
| 4. Self-Containment Assessment | PASS | Regras para conta corrente, datas, exclusões, privacidade e compatibilidade estão documentadas. |
| 5. Testing Guidance | PASS | Fixture sanitizada, oráculo determinístico, quatro páginas, transições e cenários negativos são exigidos. |
| 6. CodeRabbit Integration | PASS | Integração habilitada em `core-config.yaml`; tipo, agentes, gates, autocorreção e focos foram definidos. |

**Final Assessment:** READY — a story fornece contexto suficiente para corrigir a regressão sem alterar dados persistidos ou depender do arquivo privado em `Downloads`.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Inspeção visual e por `pdf-parse` da amostra: 4 páginas; a movimentação está nas páginas 1–2 e as páginas 3–4 são notas/rodapé.
- Validação local com o mesmo `pdf-parse` de produção: layout detectado como Itaú e 4 lançamentos retornados, sem páginas em erro; o líquido de R$ 0,92 reconcilia o saldo de conta corrente de R$ 0,08 para R$ 1,00.
- `npx vitest run tests/extratos/parsers-extratos-reais.test.ts` — 4 testes passaram.
- `npx eslint src/lib/extrato/parsers/itau.ts src/lib/extrato/parsers/index.ts tests/extratos/parsers-extratos-reais.test.ts` — passou sem erros.
- `npx tsc --noEmit --pretty false` — passou sem erros.
- `npm test` — bloqueado por falhas preexistentes fora deste escopo, principalmente em BPM, Alpha SEO, Apresentações e Google Calendar; a regressão de extratos passou isoladamente.
- CodeRabbit — indisponível: o ambiente WSL não possui `bash`.

### Completion Notes List

- A causa foi a linearização da tabela da primeira página pelo `pdf-parse`, que juntava cabeçalho, legenda e lançamentos em uma única linha; o layout também não tinha assinatura determinística e caía no fallback por agentes.
- O parser do Itaú agora detecta o `Extrato Mensal`, reconstitui os limites por data e pela movimentação de aplicação automática e herda a data na quebra de página.
- A fixture de regressão é sanitizada e mantém a proteção para layouts anteriores do Itaú, Santander e fallback.

### File List

- `docs/stories/story-extratos-bancarios-regressao-itau-extrato-mensal-julho-2026.md`
- `src/lib/extrato/parsers/index.ts`
- `src/lib/extrato/parsers/itau.ts`
- `tests/extratos/parsers-extratos-reais.test.ts`

## QA Results

_A preencher pelo agente de QA._
