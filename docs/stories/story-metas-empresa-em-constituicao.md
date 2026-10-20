# Story: Restaurar cadastro de empresa em constituição no Alpha Metas

**ID:** STORY-METAS-EMPRESA-EM-CONSTITUICAO
**Status:** Ready for Review
**Prioridade:** Alta
**Origem:** Correção solicitada pelo usuário em 2026-10-19.

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: [lint, typecheck, tests, review]
```

## Story

**Como** usuário do Alpha Metas, **quero** cadastrar um cliente cuja empresa está em constituição diretamente no formulário de cadastro, **para** registrar o contrato sem precisar selecionar uma empresa previamente cadastrada no BPM.

## Contexto e diagnóstico

O diagnóstico entregue pelo agente principal identifica o commit `a1bc31769bac694d8bd0c9a685708e9889f4edef`, de 14/08/2026, como a introdução da dependência de seleção de um Cliente existente no BPM durante a fase Cliente Master. O comportamento anterior preenchia razão social com `Em constituição` e CNPJ com zeros. A correção restaura o cadastro direto, respeitando o modelo atual: `Cliente.cnpj = null`, sem recuperar o CNPJ sentinela.

O código atual explicita essa dependência nos comentários e controles de constituição de `src/components/comercial/ModalGerenciamentoLeads.tsx` e no schema/resolução de cliente em `src/actions/ContratoComercial.ts`.

Esta é uma correção localizada, sem epic específico fornecido. A story `story-metas-parceiro-nao-cadastrado.md`, seção Tasks / Subtasks, documenta outros comportamentos do mesmo formulário (parceiros e prospecção); eles devem ser preservados. `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados na busca do repositório; a coerência foi conferida pela story relacionada e pelo diagnóstico recebido.

## Acceptance Criteria

1. Ao marcar `Empresa em constituição` no cadastro de clientes de Metas, o formulário permite continuar sem select de empresa, cadastro prévio no BPM ou consulta de CNPJ.
2. O cadastro aceita os demais dados comerciais válidos e cria um Cliente distinto para cada nova empresa em constituição, com razão social `Em constituição` e `cnpj: null`, vinculado ao contrato criado.
3. A criação desse Cliente e do contrato ocorre atomicamente; falha na gravação do contrato não deixa um Cliente órfão criado por essa tentativa.
4. Na edição de contrato já vinculado a empresa em constituição, o `clienteId` existente é preservado, sem criar outro Cliente.
5. Ao desmarcar a opção, o formulário retorna ao fluxo normal de CNPJ; dados ou identificadores do modo anterior não podem produzir vínculo indevido. O cadastro e a edição por CNPJ real mantêm consulta, validações e resolução/criação de Cliente existentes.
6. O servidor valida explicitamente o modo de cadastro, preservando autenticação, autorização e validações comerciais existentes; não persiste CNPJ de zeros nem reutiliza indiscriminadamente Clientes sem CNPJ.
7. A entrega não altera schema, migrations ou dados reais, não executa operações em massa e não publica/deploya a aplicação.

## Tasks / Subtasks

- [x] Ajustar o contrato de entrada e a criação transacional de empresa em constituição no servidor (AC 2, 3, 6).
- [x] Substituir a dependência do select no formulário pelo cadastro direto, mantendo alternância e validações comerciais (AC 1, 5).
- [x] Preservar identidade na edição e o fluxo de CNPJ real (AC 4, 5).
- [x] Cobrir criação repetida, falha transacional, edição e regressão de CNPJ nos testes de actions (AC 2–6).
- [x] Cobrir em teste React o clique no toggle, ausência do select/consulta, submissão, edição e retorno ao modo CNPJ (AC 1, 4, 5).
- [x] Executar `npm run lint`, `npm run typecheck` e `npm test`; registrar falhas preexistentes separadamente.
- [x] Atualizar checklist, File List efetiva e resultados antes de concluir.

## Dev Notes

Não foi encontrada orientação específica de arquitetura para este fluxo em `docs/architecture/`. As decisões abaixo derivam do diagnóstico recebido e dos critérios desta correção, não representam mudança geral de arquitetura.

- Reutilizar a action de contratos e o modelo atual de Cliente; não criar nova rota, dependência ou variável de ambiente.
- Implementação acordada: nested create do Prisma para gravar Cliente e contrato atomicamente; manter `listarClientesEmConstituicao` exportado por compatibilidade, removendo seu uso no formulário.
- Usar modo explícito e validado para distinguir nova empresa em constituição de vínculo existente. Edição deve enviar/manter a identidade já associada ao contrato.
- Executar testes com mocks ou infraestrutura de testes isolada, sem gravações no banco real.
- [AUTO-DECISION] Criar epic ou sincronizar ClickUp? → Manter somente a story local solicitada, pois o escopo recebido restringe a produção a este arquivo.
- [AUTO-DECISION] Reintroduzir CNPJ sentinela? → Não; preservar `null` do modelo atual e criar Cliente distinto em cada novo cadastro, conforme diagnóstico e escopo recebidos.

### Testing

Testes de actions em `tests/comercial/` devem comprovar novo Cliente por cadastro, transação com rollback em falha, preservação de `clienteId` na edição e manutenção do caminho por CNPJ real. O teste React deve usar interação do usuário para verificar seleção do modo, submissão sem escolher empresa, ausência de consulta de CNPJ nesse modo e limpeza ao retornar ao modo normal. Nenhum critério depende de alterar dados de produção.

## 🤖 CodeRabbit Integration

**Story Type Analysis:** Frontend; secundário API; complexidade média.
**Specialized Agents:** `@dev` como executor, `@ux-design-expert` para comportamento do formulário e `@qa` para regressão.
**Quality Gates:** Pre-Commit por `@dev` antes de concluir; Pre-PR e Pre-Deployment não se aplicam ao escopo atual. Quando indisponível, registrar a ausência da CLI conforme `skip_if_not_installed` da configuração.
**Self-Healing:** `@dev`, light, até 2 iterações/15 minutos; CRITICAL corrigido, HIGH documentado, MEDIUM/LOW fora da correção automática.
**Focus Areas:** validação de entrada, atomicidade, identidade na edição, alternância acessível do formulário e regressão do cadastro por CNPJ.

## Dev Agent Record

### File List

- `docs/stories/story-metas-empresa-em-constituicao.md` (criado).
- `src/actions/ContratoComercial.ts` (alterado).
- `src/components/comercial/ModalGerenciamentoLeads.tsx` (alterado).
- `tests/comercial/criar-contrato.test.ts` (alterado).
- `tests/metas/empresa-em-constituicao-react.test.ts` (novo).

### Resultados da implementação

- Removidos select, carregamento e exigência de empresa previamente cadastrada no BPM. O toggle apresenta razão social `Em constituição` e permite continuar com os dados comerciais.
- Payload explícito `empresaEmConstituicao: true` validado por Zod; nested create do Prisma grava empresa com CNPJ null junto ao contrato. Cada novo cadastro cria sua própria empresa. A edição de empresa em constituição preserva `clienteId`, inclusive após desmarcar/remarcar.
- Mantidos o caminho de CNPJ real e a action de listagem por compatibilidade. Nenhuma migration, mutação de dados reais ou publicação executada.
- `npm run lint`: exit 0, zero erros e 1.193 warnings no repositório. Lint focado dos quatro arquivos de código/teste: zero diagnósticos.
- `npm run typecheck`: exit 0 nas duas execuções, incluindo o teste React final.
- `npm test -- --maxWorkers=4`: exit 0, 648 arquivos aprovados, 4.873 testes aprovados, 4 skipped e 1 todo. Um teste adicional de alternância na edição foi acrescentado depois dessa execução.
- `npx vitest run tests/comercial/criar-contrato.test.ts tests/metas --coverage=false`: exit 0, 10 arquivos e 112 testes aprovados após o último ajuste. Inclui cadastro pelo modal real, validações comerciais, envio do marcador, retorno à consulta de CNPJ e edição com identidade preservada.
- Atomicidade: testes de actions verificam uma única escrita aninhada e tratamento da falha, sem criação separada de Cliente; rollback real depende da transação do Prisma e não foi exercitado contra banco real.
- `npm run build`: primeira tentativa compilou com warnings e foi encerrada por `SIGTERM`, com erros de cache no diretório padrão. A repetição com `NEXT_DIST_DIR=.next-metas-constituicao-validation npm run build` também terminou com exit 1 e worker encerrado por `SIGTERM`, após compilação com warnings em `src/lib/bibble/pdfjs-polyfill.ts`. Não há diagnóstico de erro de compilação nos arquivos desta correção; build completo permanece não validado.
- CodeRabbit não executado: CLI ausente no ambiente.
- Logs desta sessão em `/tmp/metas-constituicao-{lint,typecheck-final,tests,focused,react,build,build-isolated}.log`.

## Validação do draft

Checklist aplicado: `.aiox-core/product/checklists/story-draft-checklist.md`.

| Categoria | Resultado |
| --- | --- |
| Objetivo e contexto | PASS |
| Orientação técnica | PASS |
| Referências | PASS |
| Autossuficiência | PASS |
| Testes | PASS |
| CodeRabbit | PASS |

**Resultado:** READY para implementação/revisão do responsável; clareza 9/10. Sem dependência externa bloqueante. A ausência de documentos específicos de arquitetura e contexto acumulado está explicitada acima.

## Change Log

| Data | Versão | Alteração | Autor |
| --- | --- | --- | --- |
| 2026-10-19 | 1.0 | Draft da correção de cadastro de empresa em constituição | River (SM) |

| 2026-10-19 | 1.1 | Cadastro direto restaurado, testes de actions e React, quality gates registrados | Codex |

## Commit solicitado em main

Em 2026-10-19, o usuário solicitou commit na `main`. Os cinco arquivos desta story foram transferidos para worktree isolada a partir de `75315482`, preservando as demais alterações da `staging`. Nessa base, os 112 testes focados e o lint dos quatro arquivos de código/testes passaram novamente. O escopo é commit local, sem push ou deploy. A limitação do build registrada acima permanece.
