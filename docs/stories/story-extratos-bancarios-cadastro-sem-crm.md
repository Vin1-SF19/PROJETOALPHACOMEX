# Story: Permitir cadastro de empresa em Extratos Bancários sem Alpha CRM

## Status

InProgress

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["lint", "typecheck", "test", "build", "coderabbit"]

## Story

**Como** usuário do módulo de Extratos Bancários,
**quero** iniciar uma análise para uma empresa consultada por CNPJ mesmo quando ela ainda não existe no Alpha CRM,
**para que** o módulo possa operar antes do lançamento do CRM, sem duplicar empresas ou enfraquecer a validação do documento.

## Contexto e decisão de escopo

O modal de nova empresa consulta a Receita Federal, exibe razão social e dados cadastrais, mas envia somente o CNPJ para `ExtratosClientes`. A action procura um `Cliente` existente e retorna o erro “Esta empresa ainda não está cadastrada no CRM”.

Esta story remove esse bloqueio **somente do fluxo de cadastro/vinculação de Extratos Bancários**: quando o Cliente Master não existir, ele deve ser criado a partir dos dados já retornados pela consulta do formulário; em seguida, o registro de `Extratos` deve ser vinculado a ele. Não criar cards, oportunidades, serviços, contatos ou qualquer outro artefato do Alpha CRM/BPM.

[AUTO-DECISION] Qual é a porta de entrada temporária? → `ExtratosClientes`, invocada exclusivamente por `ModalNovaEmpresa` (reason: é o fluxo solicitado e já possui autenticação, validação e criação idempotente de Extratos).

## Acceptance Criteria

1. Após consultar com sucesso um CNPJ válido no modal de nova empresa de Extratos Bancários, o usuário consegue confirmar o cadastro mesmo que não exista `Cliente` com aquele CNPJ.
2. Quando não houver Cliente Master para o CNPJ normalizado, o fluxo cria um único `Cliente` com os dados que o formulário já recebeu da consulta: `cnpj`, `razaoSocial`, `nomeFantasia`, `dataConstituicao`, `municipio`, `uf` e `regimeTributario`; os dados não disponíveis permanecem nos valores opcionais/default do schema atual.
3. Quando já houver Cliente Master para o CNPJ normalizado, o fluxo o reutiliza e não altera seus dados cadastrais existentes.
4. Em ambos os casos, o fluxo cria ou reutiliza exatamente um registro de `Extratos` vinculado ao `clienteId`, preservando o `upsert` atual e sua idempotência para confirmações repetidas do mesmo CNPJ formatado ou não formatado.
5. A validação atual de CNPJ é preservada: o modal só permite confirmar após consulta válida de 14 dígitos, e a action continua rejeitando entradas inválidas antes de qualquer escrita no banco.
6. O modal deixa de informar que a empresa precisa estar previamente cadastrada no Alpha CRM; sucesso e falha continuam exibindo feedback compreensível ao usuário.
7. O escopo não altera schema Prisma, migrations, seeds, backfills, tabelas existentes nem os fluxos de cadastro de empresa de CRM, CS&NPS, BPM ou outros módulos.
8. Há testes automatizados cobrindo: rejeição de CNPJ inválido sem escrita; criação do Cliente ausente com o payload cadastral disponível; reutilização sem atualização do Cliente existente; e idempotência do vínculo de Extratos.
9. Os gates `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` são executados e seus resultados documentados. A revisão CodeRabbit não apresenta issue `CRITICAL`, quando disponível.

## 🤖 CodeRabbit Integration

### Story Type Analysis

**Primary Type**: API / lógica de negócio
**Secondary Type(s)**: Integração de formulário e persistência existente
**Complexity**: Medium

### Specialized Agent Assignment

**Primary Agents**:

- @dev
- @qa

**Supporting Agents**:

- @architect — apenas se a implementação exigir ampliar o escopo para além de Extratos; caso contrário, não necessário.
- @github-devops — revisão pré-PR e deploy.

### Quality Gate Tasks

- [ ] Pre-Commit (@dev): executar revisão CodeRabbit antes de marcar a story concluída, quando disponível.
- [ ] Gate do projeto (@dev): executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.
- [ ] Pre-PR (@github-devops): revisar a diferença contra `main`, quando disponível.
- [ ] Pre-Deployment (@github-devops): confirmar que não houve migration/schema ou ampliação do fluxo para CRM/BPM.

### Self-Healing Configuration

**Expected Self-Healing**:

- Primary Agent: @dev (light mode)
- Max Iterations: 2
- Timeout: 15 minutos
- Severity Filter: CRITICAL

**Predicted Behavior**:

- CRITICAL issues: auto_fix, reexecutar os testes afetados e os gates aplicáveis.
- HIGH issues: documentar e encaminhar para decisão, sem ampliar o escopo da story.

### CodeRabbit Focus Areas

**Primary Focus**:

- Garantir normalização e validação do CNPJ antes de qualquer operação de escrita.
- Garantir idempotência e evitar duplicidade em `Cliente.cnpj` e `Extratos.clienteId`.

**Secondary Focus**:

- Verificar que dados de Cliente existente não sejam sobrescritos.
- Verificar que a permissão/autenticação e o `revalidatePath` atuais sejam preservados.

## Tasks / Subtasks

- [x] Task 1 — Transportar o resultado já consultado pelo modal para a action de Extratos (AC: 1, 2, 5, 6)
  - [x] Estender o contrato validado de `ExtratosClientes` para receber apenas os campos cadastrais já presentes em `dadosEmpresa`, além do CNPJ.
  - [x] Preservar o bloqueio de confirmação sem consulta válida e a validação normalizada de 14 dígitos no servidor.
  - [x] Remover a mensagem/UI que exige cadastro anterior no Alpha CRM, sem criar nova tela ou novo fluxo.
- [x] Task 2 — Criar ou reutilizar o Cliente Master dentro do fluxo de Extratos (AC: 2, 3, 4, 7)
  - [x] Resolver o Cliente pelo CNPJ normalizado; se ausente, criá-lo somente com os campos definidos no AC 2.
  - [x] Não atualizar campos de Cliente já existente.
  - [x] Manter o `upsert` de `Extratos` por `clienteId`, `criadoPorNome` e a revalidação da página atuais.
  - [x] Não tocar no schema Prisma ou em flows externos ao módulo de Extratos.
- [x] Task 3 — Cobrir a regra com testes de regressão (AC: 4, 5, 8)
  - [x] Atualizar `tests/extratos/vincular-empresa.test.ts` para o cenário de Cliente inexistente que agora deve criar e vincular.
  - [x] Cobrir payload cadastral, reutilização sem sobrescrita, CNPJ inválido sem escrita e confirmação repetida.
- [ ] Task 4 — Validar e registrar a entrega (AC: 9)
  - [ ] Executar os testes direcionados de Extratos e todos os gates do projeto.
  - [ ] Atualizar tarefas, Dev Agent Record, File List e Change Log desta story com resultados reais.

## Dev Notes

- `ModalNovaEmpresa` já consulta `GET /api/ReceitaFederal?cnpj=...` e mantém em `dadosEmpresa` os sete campos exigidos pelo AC 2. Hoje, na confirmação, ele descarta esses dados e chama `ExtratosClientes({ cnpj })`. [Source: `src/components/Extratos/ModalNovaEmpresa.tsx`]
- `ExtratosClientes` autentica o usuário, normaliza o CNPJ, busca `db.cliente.findUnique({ where: { cnpj } })`, bloqueia se ausente e executa `db.extratos.upsert({ where: { clienteId }, update: {}, create: { clienteId, criadoPorNome } })`. Alterar somente o ramo de Cliente ausente; preservar autenticação, normalização, `upsert` e `revalidatePath("/PainelAlpha/ExtratosBancarios")`. [Source: `src/actions/Extratos.ts#ExtratosClientes`]
- `Cliente.cnpj` é `@unique`; `Extratos.clienteId` também é `@unique`. Portanto, a implementação deve usar as garantias existentes para que tentativas repetidas não criem duplicatas. Não há necessidade nem autorização para migration. [Source: `prisma/schema.prisma#model Cliente`; `prisma/schema.prisma#model Extratos`]
- A validação de servidor atual aceita apenas o campo CNPJ e aplica limites de tamanho; o modal e a rota da Receita Federal exigem 14 dígitos normalizados. Ao ampliar o schema, preservar ou fortalecer essa regra no servidor, sem aceitar um CNPJ inválido só porque o cliente chamou a action diretamente. [Source: `src/lib/validations/extrato.ts#vincularEmpresaExtratoSchema`; `src/app/api/ReceitaFederal/route.ts#GET`]
- O teste existente descreve o comportamento anterior “NUNCA cria”; ele deve ser atualizado, não mantido como regra. A autenticação, Prisma e `revalidatePath` já são mockados nesse arquivo. [Source: `tests/extratos/vincular-empresa.test.ts`]
- Coerência entre stories: a story anterior de pesquisa em Extratos estabeleceu testes em `tests/extratos/`; `docs/stories/accumulated-context.md` não existe no workspace, portanto esta preparação usou as stories relacionadas e o fluxo atual de Extratos como contexto acumulado disponível. [Source: `docs/stories/story-extratos-bancarios-pesquisa-cnpj-razao-social.md`]

### Testing

- Testes unitários com Vitest em `tests/extratos/vincular-empresa.test.ts`, mockando autenticação, Prisma e `next/cache` como no padrão existente.
- Executar ao menos `npx vitest run tests/extratos/vincular-empresa.test.ts`, além dos gates obrigatórios do projeto.
- Não realizar teste que dependa da API externa da Receita Federal; a action recebe o resultado já consultado pelo modal.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-08-28 | 1.0 | Story criada para permitir o cadastro de empresa em Extratos antes do lançamento do CRM. | River |

## Story Draft Checklist Validation

| Category | Status | Issues |
|---|---|---|
| 1. Goal & Context Clarity | PASS | Objetivo, valor e limite temporário do fluxo de Extratos explicitados. |
| 2. Technical Implementation Guidance | PASS | Action, modal, validação, modelos e contrato de persistência identificados. |
| 3. Reference Effectiveness | PASS | Todas as referências são arquivos e símbolos específicos do workspace. |
| 4. Self-Containment Assessment | PASS | Regras de criação, reutilização, idempotência, escopo e exceções estão na story. |
| 5. Testing Guidance | PASS | Cenários, arquivo de teste, mocks e comandos direcionados definidos. |
| 6. CodeRabbit Integration (conditional) | PASS | Integração habilitada no `core-config.yaml`; seção completa e proporcional ao risco. |

**Final Assessment:** READY — a implementação pode iniciar sem dependência do Alpha CRM. Nenhuma migration ou alteração estrutural é necessária.

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- `npx vitest run tests/extratos/vincular-empresa.test.ts`: 6 testes aprovados.
- ESLint direcionado aos quatro arquivos alterados: aprovado.
- `npm run typecheck`: iniciado duas vezes; não produziu diagnóstico antes do limite de execução do ambiente (cerca de 30 segundos).

### Completion Notes List

- O modal agora envia os dados já confirmados pela Receita Federal ao confirmar o cadastro.
- `ExtratosClientes` cria o `Cliente` ausente com `upsert` pelo CNPJ e preserva dados de clientes existentes com `update: {}`.
- O vínculo de Extratos continua idempotente por `clienteId` e a validação no servidor exige CNPJ normalizado de 14 dígitos.
- Não houve alteração de schema, migration, seed, backfill ou fluxos de CRM/BPM.
- A story permanece `InProgress` até executar os gates globais restantes.

### File List

- `docs/stories/story-extratos-bancarios-cadastro-sem-crm.md`
- `src/actions/Extratos.ts`
- `src/components/Extratos/ModalNovaEmpresa.tsx`
- `src/lib/validations/extrato.ts`
- `tests/extratos/vincular-empresa.test.ts`

## QA Results

_A preencher pelo agente de QA._
