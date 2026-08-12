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
10. A opção `Outro parceiro / Não cadastrado` funciona como alternância: um segundo clique cancela o modo, volta à lista de parceiros cadastrados e o aviso explica essa ação com destaque.
11. As pendências no módulo Parceiros ficam em uma gaveta compacta e recolhível, alinhada ao visual do Painel Alpha, com contador e área rolável quando houver muitos itens.
12. O Canal de Aquisição passa a oferecer `Prospecção ativa`.
13. Na primeira utilização, o canal exibe um input obrigatório para descrever a prospecção e persiste o texto no campo existente do contrato, sem migration.
14. Valores de prospecção previamente salvos ficam disponíveis em um select compartilhado nas próximas inclusões, sem duplicatas de caixa/espaçamento.
15. Quando o catálogo já possuir itens, o usuário ainda consegue escolher `Adicionar nova prospecção` e alimentar uma nova opção.

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
- [x] Task 6 — Refinamento visual e escalabilidade (AC: 10, 11)
  - [x] Transformar a opção de parceiro não cadastrado em controle reversível no mesmo botão.
  - [x] Substituir o retorno discreto por um aviso destacado com instrução de cancelamento.
  - [x] Extrair a listagem de pendências para uma gaveta compacta, recolhível e com rolagem interna.
  - [x] Rodar os quality gates proporcionais e atualizar File List e notas.
- [x] Task 7 — Canal Prospecção ativa com catálogo incremental (AC: 12–15)
  - [x] Criar constantes e normalização tipada do catálogo, com testes unitários.
  - [x] Validar e persistir a descrição em `canalOutro` somente para o canal correto.
  - [x] Listar valores distintos por Server Action autenticada, com select de reutilização e opção de novo valor.
  - [x] Atualizar o conhecimento do Bibble, a memória técnica e executar os quality gates.
- [ ] Task 8 — Select pesquisável de parceiros (AC: 2)
  - [ ] Substituir o select nativo por lista estilizada e alinhada ao visual do Painel Alpha.
  - [ ] Adicionar pesquisa digitável com filtro por nome, nome fantasia e representante, sem diferenciar acentos ou caixa.
  - [ ] Preservar seleção, limpeza, estado desabilitado, carregamento e acessibilidade do controle.
  - [ ] Adicionar testes focados e executar os quality gates proporcionais.

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
| 2026-08-07 | 1.3 | Refinamento visual solicitado: alternância no Metas e gaveta de pendências em Parceiros | Dex (Dev) |
| 2026-08-07 | 1.4 | Novo canal Prospecção ativa com catálogo incremental solicitado | Dex (Dev) |

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
- Refinamento visual: lint focado sem erros (mantém somente o warning preexistente em `ModalGerenciamentoLeads.tsx:1560`) e 25/25 testes focados aprovados.
- Suíte completa após o refinamento: 932/933 testes aprovados; o único timeout foi novamente `tests/google-calendar/cli.test.ts`, aprovado 2/2 quando executado isoladamente.
- `npm run typecheck` após o refinamento manteve somente os quatro erros preexistentes em Exclusão Fiscal, Habilitação RADAR e `google-calendar/sync-queue.test.ts`; nenhum erro nos arquivos alterados.
- `npm run lint` global permaneceu sem emitir diagnósticos por mais de 90 segundos e foi interrompido; o lint focado dos cinco arquivos de código da entrega foi concluído com zero erros.
- Prospecção ativa: lint focado em sete arquivos concluído sem erros e 19/19 testes de Metas/Bibble aprovados.
- Suíte completa após o novo canal: 937/938 testes aprovados; `tests/google-calendar/cli.test.ts` excedeu o timeout de 5s na suíte e passou 2/2 isoladamente (4,35s de testes).
- O typecheck global manteve erros externos em Exclusão Fiscal, RADAR, Notas e Google Calendar; nenhum diagnóstico nos arquivos desta entrega.
- `npm run build` parou no `prisma generate` por DLL em uso (`EPERM`) e `build:player` encontrou o entrypoint ausente de Apresentações; `npx next build` compilou e gerou 70 páginas com sucesso.
- O lint global da rodada de Prospecção ativa também excedeu 120 segundos sem emitir diagnósticos; a validação focada permanece a fonte concluída da entrega.

### Completion Notes List

- Os rótulos visuais foram atualizados sem alterar os valores internos legados, evitando migração de dados.
- O detalhe temporário é um envelope JSON estrito e versionado; entradas legadas, grandes ou adulteradas não geram cards.
- O módulo Parceiros lista somente pendências para quem possui `podeEditar` e abre o cadastro com dados server-side pré-preenchidos.
- Cadastro e vínculo usam transação com proteção contra concorrência. Contrato já fechado também cria a indicação retroativa; conflitos revertem toda a operação.
- Nenhuma migration, dependência, variável de ambiente, rota, menu ou permissão foi adicionada.
- O controle de parceiro não cadastrado agora é reversível no mesmo botão, limpa o rascunho ao cancelar e apresenta uma instrução destacada.
- As pendências foram movidas para uma gaveta recolhida por padrão, com contador, animação respeitando reduced motion e rolagem interna limitada a 460px.
- O tutorial de Parceiros e os manuais consultados pelo Bibble foram sincronizados com o novo comportamento.
- `Prospecção ativa` agora grava a descrição normalizada em `canalOutro`, reutiliza valores globais dos contratos existentes e permite alimentar novas opções sem tabela adicional.
- O Bibble ganhou um tópico específico ensinando o input inicial, o select e a opção `Adicionar nova prospecção`.

### File List

- `docs/stories/story-metas-parceiro-nao-cadastrado.md` (novo)
- `plan/self-critique-story-metas-parceiro-pendente.json` (novo)
- `src/lib/comercial/parceiro-nao-cadastrado.ts` (novo)
- `src/actions/ContratoComercial.ts`
- `src/lib/comercial/prospeccao-ativa.ts` (novo)
- `src/components/comercial/ModalGerenciamentoLeads.tsx`
- `src/components/comercial/CampoProspeccaoAtiva.tsx` (novo)
- `src/actions/parceiros.ts`
- `src/app/PainelAlpha/Parceiros/page.tsx`
- `src/components/Parceiros/ParceirosClient.tsx`
- `src/components/Parceiros/GavetaParceirosPendentes.tsx` (novo)
- `src/lib/shared/module-knowledge/metas.ts`
- `src/lib/shared/module-knowledge/parceiros.ts`
- `src/app/PainelAlpha/Parceiros/novo/page.tsx`
- `src/components/Parceiros/NovoParceiro.tsx`
- `tests/metas/parceiro-nao-cadastrado.test.ts` (novo)
- `tests/metas/prospeccao-ativa.test.ts` (novo)
- `tests/bibble/module-knowledge.test.ts`
- `tests/parceiros/responsavel.test.ts`
- `.bibble/memory/architecture.md`
- `.bibble/memory/components.md`

## QA Results

A preencher.
