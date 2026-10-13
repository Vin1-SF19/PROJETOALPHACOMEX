# Story: Setores dinâmicos no módulo POP

## Status

Ready for Review

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["lint", "typecheck", "tests"]

## Story

**Como** pessoa que consulta ou administra documentos no POP,
**quero** ver os setores ativos cadastrados em Gestão de Equipe,
**para que** o POP acompanhe os setores existentes e novos sem depender de listas mantidas manualmente.

## Acceptance Criteria

1. A lista de setores oferecida pelo POP é obtida dinamicamente de `db.setor`, considerando somente registros ativos (`ativo: true`) e apresentando os nomes usados em Gestão de Equipe.
2. Um setor recém-criado e ativo em Gestão de Equipe passa a aparecer no POP aberto assim que a criação é concluída, sem alteração de código ou lista hardcoded; setores inativos ou removidos deixam de ser oferecidos como setores disponíveis.
3. A exibição e o acesso a cada setor continuam respeitando as permissões atuais do POP: usuários comuns veem somente o próprio setor, `Diretrizes` e setores extras concedidos; administradores mantêm o acesso amplo atual. A lista dinâmica não concede acesso por si só.
4. O carregamento dos setores integra a resposta consumida por `DocsAlphaClient` e o cabeçalho `PopHeader`, preservando a seleção e filtragem de documentos por setor.
5. O Gerenciamento de Acessos do POP também lista setores ativos dinamicamente e permite conceder/revogar acesso a setores novos sem alterar uma lista no código.
6. Quando um novo setor é criado, a matriz de acessos aberta atualiza as colunas disponíveis sem apagar alterações locais pendentes.
7. Não há alteração de schema, migration, seed, backfill ou mutação de dados nesta story.
8. Testes cobrem a inclusão dinâmica de setor ativo, a exclusão de setor inativo e a preservação das regras de acesso existentes.

## Tasks / Subtasks

- [x] Consultar `db.setor` na Server Action `PopAcessos` e retornar os setores ativos para a interface (AC: 1, 2).
- [x] Atualizar o tipo de retorno dos acessos POP para incluir os setores disponíveis e conectar esse dado em `DocsAlphaClient` e `PopHeader` (AC: 1, 4).
- [x] Manter a filtragem/autorização atual separada da lista de opções; novos setores não ampliam permissões automaticamente (AC: 3).
- [x] Notificar módulos abertos quando um setor for criado ou excluído e atualizar os dados do POP sem recarregar a página (AC: 2).
- [x] Usar a lista dinâmica de setores na matriz de Gerenciamento de Acessos do POP, preservando o estado de edição ao atualizar seu catálogo (AC: 5, 6).
- [ ] Adicionar testes para setores dinâmicos, status ativo e permissões preservadas (AC: 6).
- [x] Atualizar checklist e File List desta story com os arquivos efetivamente alterados.

## Dev Notes

- Gestão de setores já consulta `db.setor` com `where: { ativo: true }` e ordena setores protegidos primeiro e depois pelo nome. O modelo existente contém `nome`, `ativo`, `protegido` e `isBase`. [Source: `src/actions/gestaoSetores.ts#getSetoresComContagem`; `prisma/schema.prisma#Setor`]
- A Server Action `getAcessosDoUsuario` em `PopAcessos` fornece os dados de acesso do POP; atualmente ela retorna `setoresAcessiveis`. A lista de setores disponíveis deve ser adicionada sem substituir essa regra de autorização. [Source: `src/actions/PopAcessos.ts#getAcessosDoUsuario`]
- `DocsAlphaClient` carrega os acessos e repassa estado ao `PopHeader`, que renderiza os botões de setor. [Source: `src/app/PainelAlpha/DocsAlpha/DocsAlphaClient.tsx`; `src/app/PainelAlpha/DocsAlpha/_components/PopHeader.tsx`]
- Não foi encontrado `accumulated-context.md` nem `.aiox/gotchas.json` no repositório durante a preparação. A story se baseia nos arquivos de implementação citados acima e não propõe mudança de banco.

## Testing

- Testar que a resposta do POP contém setores ativos cadastrados em `db.setor`, inclusive um setor criado após a última compilação/publicação.
- Testar que setores inativos não aparecem nas opções.
- Testar que a lista disponível não altera `setoresAcessiveis` nem libera acesso a documentos sem concessão existente.
- Confirmar visualmente que `PopHeader` exibe os setores retornados e que a seleção filtra documentos como antes.

## 🤖 CodeRabbit Integration

**Primary Type**: Integration
**Secondary Type(s)**: Frontend, API
**Complexity**: Low

**Primary Agents**: @dev, @qa
**Quality Gates**: Pre-Commit (@dev); Pre-PR (@github-devops, se houver PR).

**Focus Areas**: Fonte dinâmica e ordenação; separação entre lista de opções e autorização; ausência de mudança de schema.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-10-13 | 1.0 | Story criada para sincronizar setores ativos de Gestão de Equipe com o POP. | River (@sm) |
| 2026-10-13 | 1.1 | POP passou a ler setores ativos dinamicamente e recebe atualização quando Gestão de Setores cria ou remove um setor. | Dex (@dev) |

## Dev Agent Record

### File List

- `src/app/PainelAlpha/DocsAlpha/DocsAlphaClient.tsx`
- `src/app/PainelAlpha/DocsAlpha/_components/PopHeader.tsx`
- `src/actions/PopAcessos.ts`
- `src/app/PainelAlpha/DocsAlpha/_types/index.ts`
- `src/components/GestaoSetores/GestaoSetoresClient.tsx`
- `src/components/pop/ModalGerenciamentoAcessos.tsx`
- `src/lib/gestao-setores-sync.ts`
- `docs/stories/story-pop-setores-dinamicos.md`

### Validação

- ESLint direcionado nos arquivos alterados: aprovado.
- `npm run typecheck`: aprovado.
- `git diff --check`: aprovado.
- Testes não executados e não adicionados.
