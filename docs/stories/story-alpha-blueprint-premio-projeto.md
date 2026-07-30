# Story: Prêmio manual por projeto no Alpha Blueprint

## Status

InProgress

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["vault", "prisma-diff", "lint", "typecheck", "test", "build", "coderabbit"]

## Story

**Como** criador de um projeto no Alpha Blueprint,  
**quero** informar manualmente o valor do prêmio do sistema,  
**para que** essa informação fique visível no card e em “Sobre o projeto”, sem que outros usuários possam alterá-la.

## Acceptance Criteria

1. O modal “Novo sistema” possui um campo opcional “Prêmio”, em reais, para preenchimento manual.
2. O valor é persistido em centavos inteiros e aceita somente valores monetários válidos, não negativos e compatíveis com o tipo `Int` do Prisma.
3. O prêmio definido é exibido em formato BRL no card do projeto.
4. “Sobre o projeto” exibe o prêmio em formato BRL ou “Não definido” quando ele não foi informado.
5. O criador identificado por `BlueprintProject.createdById` pode alterar ou remover o prêmio na edição do projeto.
6. Nenhum outro usuário, inclusive Admin/CEO ou membro proprietário, pode alterar o prêmio de um projeto que não criou.
7. A restrição de autoria é aplicada no backend; esconder ou desabilitar o campo na interface é apenas uma proteção complementar.
8. A criação e a alteração do prêmio ficam registradas no histórico de atividade do projeto.
9. Os projetos existentes permanecem válidos e sem prêmio definido após a migration aditiva.
10. A migration só é aplicada no Turso após relatório Vault, backup completo verificado e confirmação explícita do usuário.
11. Testes cobrem conversão monetária, validação, exibição e autorização do criador.

## CodeRabbit Integration

### Story Type Analysis

**Primary Type**: Database  
**Secondary Type(s)**: Backend, Security e Frontend  
**Complexity**: Medium

### Specialized Agent Assignment

**Primary Agents**:

- @dev
- @data-engineer

**Supporting Agents**:

- @qa
- @ux-design-expert

### Quality Gate Tasks

- [ ] Pre-Commit (@dev): revisar alterações não commitadas.
- [ ] Pre-PR (@github-devops): revisar a diferença em relação à `main`.
- [ ] Pre-Deployment (@github-devops): confirmar migration aditiva, backup e rollback.

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

- Autorização baseada no `createdById`, sem bypass administrativo para o prêmio.
- Compatibilidade entre o campo `Int?` do Prisma, validação Zod e valores em centavos.

**Secondary Focus**:

- Acessibilidade e clareza do campo monetário.
- Preservação dos dados existentes e reversibilidade da migration.

## Tasks / Subtasks

- [x] Task 1 — Aplicar a evolução aditiva de dados (AC: 2, 9, 10)
  - [x] Adicionar `premioCents Int?` ao modelo `BlueprintProject`.
  - [x] Gerar e revisar o diff SQL antes da aplicação.
  - [x] Aplicar somente o `ADD COLUMN` autorizado no Turso e confirmar a coluna por `PRAGMA table_info`.
  - [x] Regenerar o Prisma Client sem remover mudanças preexistentes do schema.
- [x] Task 2 — Implementar domínio monetário e autorização (AC: 2, 5, 6, 7, 8)
  - [x] Validar prêmio opcional/nulo, inteiro, não negativo e limitado ao `Int` do Prisma.
  - [x] Persistir o prêmio na criação e disponibilizá-lo nas consultas.
  - [x] Bloquear no backend qualquer alteração feita por usuário diferente de `createdById`.
  - [x] Registrar valor anterior e novo na atividade de atualização.
  - [x] Cobrir validação e autorização com testes.
- [x] Task 3 — Implementar criação e edição na interface (AC: 1, 5, 7)
  - [x] Adicionar entrada monetária ao modal “Novo sistema”.
  - [x] Disponibilizar a edição/remoção do prêmio somente ao criador.
  - [x] Converter reais para centavos sem operações de ponto flutuante imprecisas.
- [x] Task 4 — Exibir o prêmio (AC: 3, 4)
  - [x] Exibir o prêmio formatado no card do projeto.
  - [x] Exibir o prêmio ou “Não definido” em “Sobre o projeto”.
  - [x] Cobrir os helpers de formatação/conversão com testes.
- [ ] Task 5 — Validar a entrega (AC: 1–11)
  - [x] Executar testes direcionados do Blueprint.
  - [ ] Executar `npm run lint`.
  - [ ] Executar `npm run typecheck`.
  - [x] Executar `npm test`.
  - [x] Executar `npm run build`.
  - [ ] Executar revisão CodeRabbit quando disponível.

## Dev Notes

- Não existem PRD ou documentos de arquitetura nos caminhos configurados em `.aiox-core/core-config.yaml`; esta story deriva diretamente da solicitação do usuário e dos padrões existentes do módulo.
- O modelo atual está em `prisma/schema.prisma`, e o acesso remoto ao Turso usa o Prisma com adaptador LibSQL em `src/lib/prisma.ts`.
- Valores monetários do projeto são armazenados como inteiros em centavos; o novo campo deve seguir o mesmo padrão e ser opcional para manter compatibilidade.
- `src/actions/BlueprintProjects.ts` concentra criação, listagem, detalhe e edição de projetos.
- `src/lib/blueprint/ownership.ts` possui bypass global para Admin/CEO. A regra do prêmio deve validar diretamente `createdById`, pois o requisito restringe a alteração ao criador real.
- Os pontos de interface existentes são `CreateProjectDialog`, `EditProjectDialog`, `BlueprintProjectCard`, `ProjectOverview` e `ProjectWorkspace`.
- Vault concluído antes da implementação: backup completo em `database-backups/pre-change/painelalpha_turso_pre_change_blueprint_premio_2026-07-30T09-22-00.sql`, 66.871.641 bytes, SHA-256 `889da9b4e9ab7b4e4ed7c0aa4cb546a9895317db84bbb65b41382d69399fd78a`, 140 tabelas, 34.428 registros e 3 projetos Blueprint.
- O usuário autorizou explicitamente em 2026-07-30: “Sim, pode aplicar a alteração do prêmio no Blueprint.”

### Testing

- Adicionar testes em `tests/blueprint/` seguindo Vitest.
- Cobrir valores ausentes, zero, centavos, limite máximo, negativos e valores acima do `Int` do Prisma.
- Cobrir a regra pura de que somente o usuário cujo ID corresponde a `createdById` pode alterar o prêmio.
- Os gates obrigatórios do projeto são lint, typecheck, testes e build.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-07-30 | 1.0 | Story criada e aprovada a partir da solicitação direta e da confirmação Vault do usuário. | River |
| 2026-07-30 | 1.1 | Implementação concluída; migration aplicada e validada, testes e build aprovados. Gates globais de lint/typecheck permanecem bloqueados por problemas preexistentes. | Dex |
| 2026-07-30 | 1.2 | Edição do prêmio destacada no topo do modal e ação direta “Definir/Editar prêmio” adicionada em “Sobre o projeto” para projetos existentes. | Dex |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `prisma migrate diff` — gerou somente `ALTER TABLE "BlueprintProject" ADD COLUMN "premioCents" INTEGER;`.
- Verificação Turso por `PRAGMA table_info` — coluna `premioCents INTEGER NULL` presente; 3 projetos preservados.
- `npx vitest run tests/blueprint/premio.test.ts tests/blueprint/premio-action.test.ts tests/blueprint/validations.test.ts tests/blueprint/ownership.test.ts` — 59 testes passaram.
- `npm test` — 51 arquivos e 432 testes passaram.
- Lint direcionado dos arquivos da story — passou sem erros ou avisos.
- `npm run build` — build de produção passou.
- `npx next build` — recompilação após destacar a edição de projetos existentes passou; `npm run build` encontrou somente um bloqueio transitório `EPERM` no DLL do Prisma já gerado.
- `npm run typecheck` — sem erros da story; bloqueado por erros preexistentes em `ExclusaoFiscal/route`, `ModalPerfilColaborador` e `HabilitacaoRadarClient`.
- `npm run lint` — bloqueado pela configuração global que inclui `.agents`, `.aiox-core` e `.claude/worktrees`.
- CodeRabbit — indisponível porque o WSL não está instalado nesta máquina.

### Completion Notes List

- Campo opcional de prêmio adicionado à criação, com entrada e exibição em reais.
- Conversão para centavos feita por parser textual com `BigInt`, sem arredondamento por ponto flutuante.
- Card e “Sobre o projeto” exibem o valor em BRL; ausência aparece como “Não definido” no detalhe.
- Edição e remoção ficam disponíveis na UI somente ao criador.
- A Server Action compara o usuário autenticado com `createdById`, bloqueando inclusive Admin/CEO não criador antes da transação.
- Criação e atualização registram `premioCents` no histórico de atividade.
- Migration aditiva aplicada após Vault, backup verificado e confirmação explícita; nenhum projeto existente foi alterado.
- Autocrítica registrada em `plan/self-critique-alpha-blueprint-premio.json`.
- Projetos antigos sem prêmio agora exibem “Definir prêmio” ao criador diretamente em “Sobre o projeto”; o campo correspondente aparece destacado no topo do modal de edição.

### File List

- `docs/stories/story-alpha-blueprint-premio-projeto.md`
- `plan/self-critique-alpha-blueprint-premio.json`
- `prisma/migrations/20260730092400_add_blueprint_project_premio/migration.sql`
- `prisma/schema.prisma`
- `src/actions/BlueprintProjects.ts`
- `src/components/AlphaBlueprint/BlueprintProjectCard.tsx`
- `src/components/AlphaBlueprint/CreateProjectDialog.tsx`
- `src/components/AlphaBlueprint/EditProjectDialog.tsx`
- `src/components/AlphaBlueprint/ProjectOverview.tsx`
- `src/components/AlphaBlueprint/ProjectWorkspace.tsx`
- `src/components/AlphaBlueprint/tipos.ts`
- `src/lib/blueprint/premio.ts`
- `src/lib/validations/blueprint.ts`
- `tests/blueprint/premio-action.test.ts`
- `tests/blueprint/premio.test.ts`
- `tests/blueprint/validations.test.ts`

## QA Results

_A preencher pelo agente de QA._
