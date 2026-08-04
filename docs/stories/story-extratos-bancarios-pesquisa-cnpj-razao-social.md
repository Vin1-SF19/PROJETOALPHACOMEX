# Story: Corrigir pesquisa de Extratos Bancários por CNPJ e razão social

## Status

InProgress

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["lint", "typecheck", "test", "build", "coderabbit"]

## Story

**Como** usuário da página inicial de Extratos Bancários,  
**quero** pesquisar empresas por CNPJ ou razão social,  
**para que** a listagem mostre somente os registros correspondentes ao termo informado.

## Acceptance Criteria

1. A pesquisa por CNPJ formatado, por exemplo `00.000.000/0001-00`, retorna os registros cujo CNPJ corresponde aos dígitos pesquisados.
2. A pesquisa pelo mesmo CNPJ sem formatação, por exemplo `00000000000100`, retorna os mesmos registros.
3. A pesquisa por razão social retorna somente os registros correspondentes ao texto informado e não é anulada por uma condição de CNPJ vazia após a remoção de caracteres não numéricos.
4. A correção possui testes automatizados cobrindo CNPJ formatado, CNPJ não formatado e razão social.
5. Não há alteração de schema, migration, seed, backfill ou dados persistidos nesta story.
6. Os gates `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` passam; a revisão CodeRabbit não apresenta issue `CRITICAL` quando disponível.

## CodeRabbit Integration

### Story Type Analysis

**Primary Type**: Frontend  
**Secondary Type(s)**: Consulta de listagem  
**Complexity**: Low

### Specialized Agent Assignment

**Primary Agents**:

- @dev
- @qa

### Quality Gate Tasks

- [x] Pre-Commit (@dev): revisar alterações não commitadas com CodeRabbit, quando disponível. (Indisponível: WSL não está instalado.)
- [ ] Pre-PR (@github-devops): revisar a diferença em relação à `main`, quando disponível.
- [x] Gate do projeto (@dev): executar lint, typecheck, testes e build. (Bloqueios preexistentes documentados no Dev Agent Record.)

### Self-Healing Configuration

- Primary Agent: @dev (light mode)
- Max Iterations: 2
- Timeout: 15 minutos
- Severity Filter: CRITICAL
- CRITICAL: auto_fix; HIGH: document_only.

### CodeRabbit Focus Areas

- Normalização do CNPJ sem criar uma condição `contains: ""`.
- Regressão da filtragem por razão social e CNPJ.

## Tasks / Subtasks

- [x] Task 1 — Corrigir a composição do filtro de pesquisa (AC: 1–3)
  - [x] Normalizar os dígitos do termo para a condição de CNPJ.
  - [x] Incluir a condição de CNPJ somente quando houver dígitos pesquisáveis.
  - [x] Preservar a pesquisa por razão social.
- [x] Task 2 — Adicionar testes de regressão (AC: 1–4)
  - [x] Cobrir CNPJ formatado, CNPJ não formatado e razão social.
  - [x] Comprovar que uma busca textual não retorna toda a listagem por causa de CNPJ vazio.
- [x] Task 3 — Validar a entrega (AC: 5, 6)
  - [x] Confirmar que não há mudança de banco de dados.
  - [x] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.
  - [x] Executar CodeRabbit quando disponível e atualizar tarefas, Dev Agent Record e File List.

## Dev Notes

- O campo já envia `busca` para `ListarExtratos` e se apresenta como pesquisa por CNPJ ou razão social. [Source: `src/components/Extratos/ExtratosListagem.tsx`]
- A consulta atual normaliza o CNPJ com `busca.replace(/\D/g, "")`; em uma busca somente textual, o resultado vazio pode formar `cnpj: { contains: "" }` dentro do `OR`, fazendo a condição corresponder a todos os registros. [Source: `src/actions/Extratos.ts#ListarExtratos`]
- Escopo esperado: lógica de pesquisa e seus testes; nenhuma mudança de UI além do necessário para o funcionamento solicitado e nenhuma mudança de banco.
- `docs/stories/accumulated-context.md` não existe no workspace; a coerência foi verificada com a story anterior e o fluxo atual de Extratos Bancários.

### Testing

- Adicionar testes no escopo de `tests/extratos/` para os três cenários obrigatórios.
- Executar os gates definidos em `AGENTS.md` e na Constituição do projeto.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-08-04 | 1.0 | Story criada para corrigir a pesquisa por CNPJ e razão social. | River |
| 2026-08-04 | 1.1 | Filtro corrigido, regressões cobertas e gates executados. | Dex |

## Story Draft Checklist Validation

| Category | Status |
|---|---|
| Goal & Context | PASS |
| Technical Guidance | PASS |
| References | PASS |
| Self-Containment | PASS |
| Testing | PASS |
| CodeRabbit | PASS |

**Final Assessment:** READY.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npx vitest run tests/extratos/pesquisa-extratos.test.ts`: 4 testes aprovados.
- `npx vitest run tests/extratos`: 15 testes aprovados.
- ESLint direcionado aos arquivos alterados: aprovado.
- `npx next build`: aprovado, incluindo a rota `/PainelAlpha/ExtratosBancarios`.
- `npm run typecheck`: bloqueado somente por erros preexistentes em validadores de `ExclusaoFiscal`, `HabilitacaoRadarClient.tsx` e testes de Google Calendar.
- `npm test`: 712 testes aprovados; um timeout preexistente em `tests/google-calendar/cli.test.ts`.
- `npm run lint`: gate global preexistente bloqueado por diretórios de framework/worktrees fora do escopo; lint direcionado aprovado.
- CodeRabbit: indisponível porque WSL não está instalado neste ambiente.

### Completion Notes List

- Removida a condição `cnpj: { contains: "" }` que anulava buscas textuais dentro do `OR`.
- CNPJ formatado e sem formatação agora usam a mesma sequência de dígitos.
- Razão social é normalizada para maiúsculas, compatível com a forma persistida pelo módulo.
- Nenhuma mudança de UI, banco de dados, dependências ou configuração foi realizada.
- A entrega funcional está validada; a story permanece `InProgress` exclusivamente pelos gates globais preexistentes.

### File List

- `docs/stories/story-extratos-bancarios-pesquisa-cnpj-razao-social.md`
- `plan/self-critique-extratos-pesquisa.json`
- `src/actions/Extratos.ts`
- `src/lib/extrato/pesquisa-extratos.ts`
- `tests/extratos/pesquisa-extratos.test.ts`

## QA Results

_A preencher pelo agente de QA._
