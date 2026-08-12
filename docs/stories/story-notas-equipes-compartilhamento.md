# Story: Equipes privadas para compartilhamento de notas

**ID:** STORY-NOTAS-EQUIPES-COMPARTILHAMENTO  
**Módulo:** Bloco de notas ALpha  
**Status:** Ready for Review  
**Prioridade:** Alta  
**Origem:** solicitação direta do usuário em 2026-08-12

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@qa"
quality_gate_tools:
  - prisma-validate
  - migration-diff
  - lint
  - typecheck
  - tests
  - build
```

## Story

**Como** usuário do Bloco de notas ALpha,  
**quero** criar equipes privadas, adicionar vários colaboradores e definir o papel de cada membro,  
**para** compartilhar notas com grupos reutilizáveis sem conceder acesso individual repetidamente.

## Acceptance Criteria

1. Qualquer usuário com acesso ao módulo de Notas pode criar uma equipe informando um nome válido e, opcionalmente, vários membros de uma só vez.
2. Equipes são privadas: aparecem apenas para o dono e seus membros; uma nota só pode ser compartilhada com uma equipe da qual o usuário autenticado seja dono ou membro.
3. O dono é `ADMIN` implícito e é o único que pode renomear/excluir a equipe, adicionar/remover membros e alterar papéis; ser membro `ADMIN` não concede gestão da equipe.
4. Cada membro possui exatamente um papel sobre notas compartilhadas com a equipe: `LEITOR`, `COMENTARISTA`, `EDITOR` ou `ADMIN`.
5. O dono não é duplicado na tabela de membros, não pode sair da própria equipe e não pode ser adicionado novamente; ele pode excluir a equipe.
6. Um membro pode sair voluntariamente. Remoção ou saída revoga imediatamente o acesso recebido exclusivamente por aquela equipe, preservando acessos obtidos por propriedade, usuário, setor, role ou outra equipe.
7. O gestor pode adicionar múltiplos usuários ativos numa única operação, sem IDs duplicados, sem usuários inexistentes/inativos e sem exceder o limite definido no schema Zod.
8. O nome é normalizado para impedir duplicatas do mesmo dono por caixa, acentos ou espaços; equipes de donos diferentes podem usar o mesmo nome.
9. O diálogo de compartilhamento separa claramente `Usuário`, `Setor organizacional` e `Equipe de notas`; o papel global existente continua aplicável apenas a usuário/setor.
10. Compartilhar com uma equipe cria uma relação real `NoteTeamShare`; o papel efetivo de cada destinatário vem da associação `NoteTeamMember`, e o dono recebe `ADMIN`.
11. Quando houver múltiplos caminhos de acesso à mesma nota, prevalece o papel mais permissivo, seguindo `LEITOR < COMENTARISTA < EDITOR < ADMIN`; o resultado nunca depende da ordem dos registros.
12. `Compartilhadas comigo` inclui acesso por equipe; `Notas de equipe` lista notas acessíveis vinculadas a uma equipe real, sem depender apenas do campo `visibility`.
13. Excluir uma equipe remove somente suas associações de membros e compartilhamentos por cascade; nenhuma nota, comentário, versão ou permissão individual/setorial é excluída.
14. A listagem e busca de colaboradores usada pelas equipes exige sessão, acesso ao módulo, retorna somente usuários ativos e expõe apenas os campos mínimos necessários à seleção.
15. A UI de gestão é responsiva, acessível por teclado, possui loading/estado vazio/feedback de erro e confirmação para excluir equipe, remover membro e sair.
16. O fluxo existente de compartilhamento por usuário e setor permanece compatível e sem regressões.
17. Nenhuma nova rota, item global de menu, permissão de módulo, dependência ou variável de ambiente é criada.
18. A migration só pode ser aplicada ao Turso após relatório Vault, backup completo verificado e autorização explícita do usuário.

## Tasks / Subtasks

- [x] Task 1 — Segurança de banco e contrato de dados (AC: 3–8, 10, 13, 18)
  - [ ] Obter autorização explícita para a migration exata descrita no Vault Report.
  - [ ] Adicionar relações reversas em `usuarios`/`Note` e os models `NoteTeam`, `NoteTeamMember` e `NoteTeamShare` ao schema.
  - [ ] Validar schema e diff; aplicar SQL idempotente no Turso somente após o gate Vault.
  - [ ] Verificar tabelas, FKs, índices e unicidades via `sqlite_master`/PRAGMA; documentar rollback.
- [x] Task 2 — Validações e papéis efetivos (AC: 3–8, 11)
  - [ ] Criar schemas Zod para nome, criação, renomeação, adição em lote, mudança de papel, remoção, saída, exclusão e compartilhamento.
  - [ ] Centralizar normalização do nome e ranking de papéis em helper puro testável.
  - [ ] Resolver o maior papel por propriedade, permissão existente e uma ou mais equipes, sem dependência de ordem.
- [x] Task 3 — Server Actions de equipes (AC: 1–8, 13–14)
  - [ ] Implementar CRUD/gestão com sessão, acesso ao módulo, ownership e transações.
  - [ ] Implementar listagem `criadas OU membro`, detalhe autorizado e busca mínima de usuários ativos.
  - [ ] Proteger concorrência, duplicatas, dono como membro, remoção alheia e enum de papel adulterado.
- [x] Task 4 — Integração ao motor de acesso/busca (AC: 6, 10–12, 16)
  - [ ] Incluir `NoteTeamShare` em `criarFiltroAcessoNota` e na seção `Compartilhadas comigo`.
  - [ ] Trocar `Notas de equipe` por filtro relacional de compartilhamento real.
  - [ ] Preservar herança de contexto e todos os caminhos legados de usuário/setor/role.
- [x] Task 5 — Compartilhamento e notificações (AC: 2, 9–13, 16)
  - [ ] Criar/remover compartilhamento de equipe somente para equipes das quais o ator participa.
  - [ ] Unificar a listagem “Quem tem acesso” com permissões existentes e equipes, usando IDs tipados por origem.
  - [ ] Notificar destinatários da equipe sem expor conteúdo e sem notificar o próprio ator.
- [x] Task 6 — UI de gestão de equipes (AC: 1–9, 15)
  - [ ] Criar manager acessível pela Central e pelo diálogo de compartilhamento.
  - [ ] Implementar criação, seleção múltipla segura, cards, edição de nome/papel e ações condicionais a dono/membro.
  - [ ] Implementar confirmações destrutivas e estados responsivos/loading/vazio/erro.
- [x] Task 7 — Quality gates e documentação (AC: 15–18)
  - [ ] Criar testes unitários e de integração para validação, RBAC, acesso relacional, maior papel, cascades lógicos e regressões.
  - [ ] Rodar lint focado/global, typecheck, testes e build; separar baselines preexistentes.
  - [ ] Atualizar checklist, File List, `architecture.md`, `codebase-map.md` e `integration-points.md`.

## Dev Notes

### Decisões fechadas

- Escopo específico do módulo de Notas; não cria conceito global de equipe. [Source: requisito confirmado no blueprint anexado]
- `NotePermission` permanece responsável por `USUARIO | SETOR | ROLE`; equipe usa `NoteTeamShare` com FKs reais. Isso elimina `subjectId` órfão, resolve cascade e mantém um único papel por membro. [Source: `prisma/schema.prisma#NotePermission` e reconhecimento Scout 2026-08-12]
- Somente o dono gerencia equipe. `ADMIN` é capacidade sobre notas, não delegação administrativa da equipe. [Source: pedido do usuário: “o criador da equipe pode remover, adicionar, mudar o nome, dar funções”]
- Equipe compartilhável é restrita às equipes do usuário; não existe catálogo público. [Source: pedido do usuário: “na lista aparece as equipe que ele faz parte ou a que ele criou”]
- A busca nova não deve reutilizar `BuscarTodosUsuarios`, pois a action existente não possui auth e expõe campos além do necessário. [Source: `.bibble/memory/architecture.md#Fase-05`]

### Modelo planejado

```prisma
model NoteTeam {
  id String @id @default(cuid())
  name String
  nameKey String
  ownerId Int
  owner usuarios @relation("NoteTeamOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  members NoteTeamMember[]
  shares NoteTeamShare[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([ownerId, nameKey])
  @@index([ownerId])
}

model NoteTeamMember {
  id String @id @default(cuid())
  teamId String
  userId Int
  role String @default("LEITOR")
  team NoteTeam @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user usuarios @relation("NoteTeamMemberUser", fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([teamId, userId])
  @@index([userId])
}

model NoteTeamShare {
  id String @id @default(cuid())
  noteId String
  teamId String
  createdById Int
  note Note @relation(fields: [noteId], references: [id], onDelete: Cascade)
  team NoteTeam @relation(fields: [teamId], references: [id], onDelete: Cascade)
  createdBy usuarios @relation("NoteTeamShareCreatedBy", fields: [createdById], references: [id])
  createdAt DateTime @default(now())
  @@unique([noteId, teamId])
  @@index([teamId])
}
```

[Source: padrões de `Note`, `NotePermission`, `ApresentacaoColaborador` e relações nomeadas de `usuarios` em `prisma/schema.prisma`]

### Arquivos planejados

#### Criar

- `src/actions/NotasEquipes.ts`
- `src/lib/notas/equipes.ts`
- `src/components/Notas/Colaboracao/NoteTeamsManager.tsx`
- `src/components/Notas/Colaboracao/NoteTeamMembersEditor.tsx`
- `src/components/Notas/Colaboracao/NoteTeamUserMultiSelect.tsx`
- `tests/notas/equipes.test.ts`
- `tests/notas/equipes-acesso.test.ts`

#### Editar

- `prisma/schema.prisma`
- `src/lib/validations/notas.ts`
- `src/lib/notas/permissoes.ts`
- `src/lib/notas/acesso.ts`
- `src/actions/NotasColaboracao.ts`
- `src/actions/NotasBusca.ts`
- `src/components/Notas/Colaboracao/NoteShareDialog.tsx`
- `src/components/Notas/Central/CentralDeNotas.tsx`
- `src/components/Notas/Central/CentralNotasHeader.tsx`
- `.bibble/memory/architecture.md`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/integration-points.md`

### Integration points verificados

- Menu/nav: `src/lib/modulos-registry.ts` — nenhuma alteração; permanece dentro de Notas.
- Atalhos: `src/hooks/useNotasAtalhos.ts` — nenhuma alteração obrigatória.
- Permissão: chave existente `notas`; nenhuma permissão global nova.
- Rota: `/PainelAlpha/Notas`; nenhuma rota nova.
- Auth: `auth()` em toda Server Action e `temAcessoAoModuloNotas()` para operações sem `noteId`.
- UI: `NoteShareDialog` é usado na Central e na barra global; a integração nele cobre ambas as superfícies.

### Testing

- Vitest em `tests/notas/`.
- Cobrir normalização/duplicidade, array em lote, roles inválidos, owner imutável, RBAC/IDOR, saída voluntária, maior papel, equipe alheia, acesso revogado, coexistência de permissões e listagens.
- Validar schema/diff e verificar objetos remotos após migration.
- Teste manual autenticado: criar equipe, adicionar múltiplos membros, compartilhar nota, validar cada papel, sair/remover e excluir equipe.

## Vault Report — AUTORIZADO

**Ambiente:** PRODUÇÃO — Turso remoto (`libsql`, host remoto confirmado).  
**Operação:** criar `NoteTeam`, `NoteTeamMember`, `NoteTeamShare`, FKs e índices.

### Classificação

- 🟢 3 × `CREATE TABLE` aditivas.
- 🟢 3 × índices simples.
- 🟡 3 × índices únicos (`ownerId+nameKey`, `teamId+userId`, `noteId+teamId`). Tabelas nascem vazias, portanto não existe colisão prévia.
- 🟡 FKs com cascade em equipe/membro/share; risco controlado porque atuam apenas sobre as novas tabelas. `NoteTeamShare` nunca faz cascade para `Note`.

### Backup e rollback

- Backup: `database-backups/pre-change/backup_daily_20260812_020308.sql`
- Manifest: `database-backups/pre-change/backup_daily_20260812_020308.manifest.json`
- Timestamp: 2026-08-12 02:03:08 (`America/Sao_Paulo`), idade na validação: 9,9 h.
- Tamanho: 65.928.444 bytes; SHA-256 conferido; validação `passed`; `BEGIN`/`COMMIT`; 379 objetos e 33.365 linhas.
- Rollback lógico antes de uso: remover somente `NoteTeamShare`, `NoteTeamMember` e `NoteTeam`, nessa ordem.
- Rollback completo após uso: restaurar o dump verificado em banco de recuperação e promover conforme runbook; não executar `prisma migrate reset`.

### Alternativa não destrutiva

Manter compartilhamento individual/setorial existente e não criar equipes. Não atende ao requisito de grupo reutilizável, mas não altera o schema.

### Gate concluído

O usuário autorizou inequivocamente a execução da feature e da migration delimitada nesta story em 2026-08-12. Alteração de escopo continua exigindo novo relatório Vault.

## CodeRabbit Integration

**Primary Type:** Database  
**Secondary Types:** API, Frontend, Security, Architecture  
**Complexity:** Alta

**Primary Agents:** `@dev`, `@data-engineer`, `@ux-design-expert`  
**Supporting Agents:** `@architect`, `@qa`, `@devops`

### Quality Gates

- [x] Pre-Commit: schema/diff, auth/IDOR, cascades, lint focado e testes da feature.
- [x] Pre-PR: compatibilidade do compartilhamento legado e revisão SQL.
- [x] Pre-Deployment: backup, confirmação Vault, execução idempotente e rollback.

### Self-Healing

- `@dev` light: até 2 iterações, 15 minutos, CRITICAL auto-fix; HIGH documentado.
- `@qa` full: até 3 iterações, CRITICAL/HIGH.

### Focus Areas

- FKs/cascades nunca podem excluir `Note` ao excluir equipe.
- Toda mutação valida owner no servidor e nunca confia em IDs do cliente.
- Equipe alheia não pode ser descoberta nem usada para compartilhar.
- Maior papel efetivo deve ser determinístico.
- Busca de usuários deve ser autenticada, mínima e limitada.
- UI deve diferenciar setor organizacional de equipe de notas.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-08-12 | 1.0 | Story criada a partir do pedido, blueprint anterior e reconhecimento Scout; modelagem corrigida para shares relacionais | River (SM) |
| 2026-08-12 | 2.0 | Feature implementada, migration aplicada e validada, UI integrada e quality gates executados | Dex (Dev) |
| 2026-08-12 | 2.1 | Acesso ao gerenciador movido do cabeçalho para a visualização contextual Notas de equipe | Dex (Dev) |
| 2026-08-12 | 2.2 | Equipes exibidas como cards-pasta animados na seção Notas de equipe | Dex (Dev) |
| 2026-08-12 | 2.3 | Clique da pasta corrigido para abrir notas filtradas; engrenagem isolada para configurações | Dex (Dev) |
| 2026-08-12 | 2.4 | Raiz de Notas de equipe isolada para exibir somente pastas | Dex (Dev) |
| 2026-08-12 | 2.5 | Painel lateral de ações limitado à viewport com scroll interno sutil | Dex (Dev) |

## Dev Agent Record

### Agent Model Used

Codex GPT-5.

### Debug Log References

- `npx prisma validate`: aprovado.
- Migration Turso: 3 tabelas, 6 FKs e 9 índices verificados por PRAGMA.
- Lint focado: aprovado; lint global excedeu 5 minutos sem reportar erro.
- Testes da feature: 15/15 aprovados.
- Suíte global: 1.094/1.096 aprovados; 2 timeouts preexistentes fora do módulo.
- Build de produção: aprovado.

### Completion Notes List

- Criador é administrador implícito e único gestor da equipe.
- Pesquisa de usuários autenticada, limitada e sem exposição de e-mail.
- Compartilhamento por equipe usa FKs reais e preserva o legado usuário/setor.
- Maior papel efetivo é calculado deterministicamente entre todos os caminhos.
- Teste visual interno ficou limitado pela ausência de sessão autenticada no navegador isolado.
- O botão de gerenciamento é exibido somente dentro da seção `Notas de equipe`.
- Equipes aparecem como pastas responsivas com membros e quantidade de notas.
- Clique principal abre as notas da equipe; somente a engrenagem abre o gerenciamento, com navegação de retorno às pastas.
- Cards de notas não são consultados nem renderizados na raiz da seção; aparecem somente dentro de uma pasta aberta.
- Painel de ações usa altura flexível, rolagem interna e scrollbar discreto para não cortar conteúdo em telas menores.

### File List

- `docs/stories/story-notas-equipes-compartilhamento.md` (novo)
- `prisma/schema.prisma`
- `src/actions/NotasEquipes.ts` (novo)
- `src/actions/NotasBusca.ts`
- `src/lib/notas/equipes.ts` (novo)
- `src/lib/notas/acesso.ts`
- `src/lib/notas/permissoes.ts`
- `src/lib/validations/notas.ts`
- `src/components/Notas/Colaboracao/NoteTeamsManager.tsx` (novo)
- `src/components/Notas/Colaboracao/NoteTeamMembersEditor.tsx` (novo)
- `src/components/Notas/Colaboracao/NoteTeamUserMultiSelect.tsx` (novo)
- `src/components/Notas/Colaboracao/NoteShareDialog.tsx`
- `src/components/Notas/Central/CentralDeNotas.tsx`
- `src/components/Notas/Central/CentralNotasHeader.tsx`
- `src/components/Notas/Central/ListaNotas.tsx`
- `src/components/Notas/Central/NoteTeamFolderGrid.tsx` (novo)
- `tests/notas/equipes.test.ts` (novo)
- `tests/notas/equipes-acesso.test.ts` (novo)
- `tests/notas/painel-propriedades-responsivo.test.ts` (novo)
- `tests/notas/acesso-e-lixeira.test.ts`
- `.bibble/memory/architecture.md`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/integration-points.md`

## QA Results

A preencher.
