# Story: Indicação de parceiro não cadastrado no Alpha Metas

**ID:** STORY-METAS-PARCEIRO-PENDENTE  
**Módulos:** Alpha Metas e Parceiros  
**Status:** Ready for Review  
**Prioridade:** Alta  
**Data de criação:** 2026-08-07

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@qa"
quality_gate_tools:
  - lint
  - typecheck
  - tests
  - build
```

## Story

**Como** usuário do gerenciamento de leads do Alpha Metas,  
**quero** registrar quem indicou o cliente mesmo quando o parceiro ainda não estiver cadastrado,  
**para** salvar o lead sem perder a origem e permitir que o responsável pelo módulo de Parceiros finalize o cadastro depois.

## Acceptance Criteria

1. O campo Canal de Aquisição exibe os rótulos `Indicação de parceiros` e `Indicação de Clientes`, preservando a compatibilidade com contratos antigos.
2. Ao escolher `Indicação de parceiros`, a lista de parceiros cadastrados termina com uma linha visualmente destacada `Outro parceiro / Não cadastrado`.
3. Ao selecionar a linha destacada, aparecem os campos `Nome do parceiro`, `Empresa` e `Telefone`; somente `Nome do parceiro` é obrigatório.
4. O backend valida os dados temporários e persiste nome, empresa e telefone sem criar parceiro incompleto, sem alterar o schema e sem aceitar payload arbitrário do cliente.
5. O módulo Parceiros mostra um card destacado por indicação pendente aos usuários responsáveis, contendo parceiro, empresa, telefone, cliente de origem e data do registro.
6. O card oferece a ação `Finalizar cadastro`, abre o cadastro manual com os dados conhecidos pré-preenchidos e identifica claramente a origem da pendência.
7. Ao concluir o cadastro, o novo parceiro é vinculado ao contrato comercial em uma operação consistente; o card deixa de ser listado e o fluxo normal de indicação permanece disponível quando o contrato for fechado.
8. Edição de contrato alternando entre parceiro cadastrado, não cadastrado e outro canal remove os dados temporários que não forem mais aplicáveis.
9. A entrega não adiciona rota, item de menu, permissão, variável de ambiente ou migration.

## Tasks / Subtasks

- [x] Task 1 — Contrato temporário tipado (AC: 3, 4, 8, 9)
  - [x] Criar helper compartilhado para serializar e interpretar o detalhe de parceiro não cadastrado no campo textual existente.
  - [x] Validar tamanho, campos opcionais e versão com Zod no servidor.
  - [x] Cobrir serialização, parsing e rejeição de valores legados/inválidos.
- [x] Task 2 — Formulário do Alpha Metas (AC: 1–4, 8)
  - [x] Atualizar somente os rótulos visuais dos canais, mantendo os valores internos legados.
  - [x] Adicionar a opção destacada e os três campos condicionais.
  - [x] Ajustar validação, payload de criação e edição.
- [x] Task 3 — Pendências no módulo Parceiros (AC: 5, 6)
  - [x] Listar contratos com detalhe temporário válido e sem parceiro vinculado.
  - [x] Respeitar a permissão existente de edição do módulo.
  - [x] Renderizar cards destacados e responsivos antes da listagem regular.
- [x] Task 4 — Finalização e vínculo (AC: 6, 7)
  - [x] Buscar a pendência pelo ID do contrato no Server Component, sem confiar em dados da URL.
  - [x] Pré-preencher o cadastro manual e exibir banner de contexto.
  - [x] Criar o parceiro e vincular o contrato de forma atômica quando houver pendência válida.
- [x] Task 5 — Quality gates (AC: 1–9)
  - [x] Rodar testes focados.
  - [x] Rodar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.
  - [x] Atualizar checklist, File List e notas de conclusão desta story.

## Dev Notes

- `ContratoComercial.canalOutro` já é `String?`; a story usa esse armazenamento somente quando o canal é indicação de parceiro sem cadastro, com envelope versionado e validação server-side. Não há migration. [Source: `prisma/schema.prisma#model-ContratoComercial`]
- `ContratoComercial.indicadoPorParceiroId` identifica o parceiro depois que o cadastro for finalizado. [Source: `prisma/schema.prisma#model-ContratoComercial`]
- A seleção e o salvamento atuais vivem em `src/components/comercial/ModalGerenciamentoLeads.tsx` e `src/actions/ContratoComercial.ts`. [Source: reconhecimento Scout 2026-08-07]
- O módulo Parceiros centraliza permissões em `getCtx()`/`getPermissaoParceiros()` e usa `podeEditar` para ações de cadastro. [Source: `src/actions/parceiros.ts#permissoes-do-modulo`]
- A página `src/app/PainelAlpha/Parceiros/page.tsx` busca dados em paralelo e entrega ao `ParceirosClient`; o novo conjunto de pendências deve seguir o mesmo padrão. [Source: `.bibble/memory/codebase-map.md#estrutura-de-arquivos`]
- Menu, atalhos, permissões e middleware foram verificados pelo Scout; nenhum deles muda porque as duas rotas e a permissão `parceiros` já existem. [Source: `.bibble/memory/integration-points.md#checklist-de-integracao-para-novos-modulos`]
- Não existe epic/PRD específico em `docs/prd`; esta story deriva diretamente do requisito do usuário e do comportamento observado no código, sem ClickUp nesta sessão.

### Testing

- Testes unitários em `tests/metas/` para o envelope temporário, incluindo acentos, opcionais vazios, limites e payload inválido.
- Testes de regressão devem garantir que texto comum de `canalOutro` não seja interpretado como parceiro pendente.
- Validação manual: criar lead com parceiro ausente, abrir Parceiros, entrar pelo card, concluir cadastro e confirmar que o card desaparece.

## CodeRabbit Integration

**Story Type Analysis:** Frontend + API/integração interna; complexidade média.  
**Primary Agents:** `@dev`, `@ux-design-expert`.  
**Supporting Agent:** `@qa`.  
**Quality Gates:** Pre-Commit por `@dev`; Pre-PR por `@devops`.  
**Self-Healing:** `@dev` light, 2 iterações, 15 minutos, CRITICAL; HIGH apenas documentado.  
**Focus:** validação de input e autorização, compatibilidade com contratos existentes, consistência do vínculo, acessibilidade e responsividade dos novos controles.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-08-07 | 1.0 | Story criada a partir do pedido e do blueprint Scout | River (SM) |
| 2026-08-07 | 1.1 | Story iniciada para implementação | Dex (Dev) |
| 2026-08-07 | 1.2 | Fluxo completo implementado, testado e preparado para revisão | Dex (Dev) |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Dex / Builder).

### Debug Log References

- `npx vitest run tests/metas/parceiro-nao-cadastrado.test.ts tests/parceiros/responsavel.test.ts --coverage=false` — 17/17 testes aprovados.
- `npx eslint <arquivos da feature>` — zero erros; um warning preexistente fora das linhas alteradas em `ModalGerenciamentoLeads.tsx:1529`.
- `npm test` — 892/893 aprovados; o único timeout foi `tests/google-calendar/cli.test.ts`, que passou 2/2 isoladamente.
- `npm run typecheck` — manteve os quatro erros preexistentes em Exclusão Fiscal, Habilitação RADAR e `google-calendar/sync-queue.test.ts`; zero erro nos arquivos da feature.
- `npm run lint` — excedeu 180 segundos sem emitir diagnóstico; lint focado aprovado.
- `npm run build` — bloqueado no `prisma generate` por DLL do Prisma em uso (`EPERM`); `npm run build:player` e `npx next build` passaram, com 70 páginas geradas.
- CodeRabbit — não executado porque WSL não está instalado; degradação prevista pelo skill.

### Completion Notes List

- Os rótulos visuais foram atualizados sem alterar os valores internos legados, evitando migração de dados.
- O detalhe temporário é um envelope JSON estrito e versionado; entradas legadas, grandes ou adulteradas não geram cards.
- O módulo Parceiros lista somente pendências para quem possui `podeEditar` e abre o cadastro com dados server-side pré-preenchidos.
- Cadastro e vínculo usam transação com proteção contra concorrência. Contrato já fechado também cria a indicação retroativa; conflitos revertem toda a operação.
- Nenhuma migration, dependência, variável de ambiente, rota, menu ou permissão foi adicionada.

### File List

- `docs/stories/story-metas-parceiro-nao-cadastrado.md` (novo)
- `plan/self-critique-story-metas-parceiro-pendente.json` (novo)
- `src/lib/comercial/parceiro-nao-cadastrado.ts` (novo)
- `src/actions/ContratoComercial.ts`
- `src/components/comercial/ModalGerenciamentoLeads.tsx`
- `src/actions/parceiros.ts`
- `src/app/PainelAlpha/Parceiros/page.tsx`
- `src/components/Parceiros/ParceirosClient.tsx`
- `src/app/PainelAlpha/Parceiros/novo/page.tsx`
- `src/components/Parceiros/NovoParceiro.tsx`
- `tests/metas/parceiro-nao-cadastrado.test.ts` (novo)
- `tests/parceiros/responsavel.test.ts`

## QA Results

A preencher.
