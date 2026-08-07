# Story: Guia Inteligente de Módulo para Alpha Metas e Parceiros

**ID:** STORY-GUIA-INTELIGENTE-METAS-PARCEIROS  
**Módulos:** Bibble/IAlpha, Alpha Metas e Parceiros  
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
```

## Story

**Como** usuário do PainelAlpha,  
**quero** que o Bibble saiba ensinar as funcionalidades de Alpha Metas e Parceiros e que Parceiros ofereça um tour guiado na primeira visita,  
**para** aprender a operar os módulos sem depender de treinamento externo e reutilizar o mesmo padrão em outros módulos.

## Nome reutilizável da funcionalidade

**Guia Inteligente de Módulo** = conhecimento operacional sob demanda no Bibble + tour sequencial de primeira visita + ação para rever o tutorial.

Solicitação futura esperada: **“Adicione o Guia Inteligente neste módulo.”**

## Acceptance Criteria

1. Existe um catálogo modular e tipado de conhecimento, consultável por módulo/tópico, sem inserir os manuais completos em todas as chamadas do Bibble.
2. O manual de Alpha Metas cobre dashboard, metas individual/equipe, visibilidade, atualização em tempo real, modo TV, gerenciamento de leads/contratos, fechamento, justificativas e o fluxo de parceiro não cadastrado.
3. O manual de Parceiros cobre dashboard, busca/filtros, cadastro PF/PJ, tipos de comissão, indicações, convites/PIN, pré-cadastros, pendências vindas de Metas, detalhe/edição, comprovantes, termos, acesso e níveis.
4. O Bibble possui uma tool somente leitura para consultar o manual por módulo/tópico e orienta o modelo a usá-la em perguntas de “como fazer”, sem acionar mutações.
5. A consulta do manual respeita a permissão do módulo, com bypass apenas para papéis administrativos já reconhecidos pelo sistema.
6. O Bibble corrige a premissa “cadastrar cliente no módulo Parceiros”: Parceiros vincula cliente já existente; cliente novo nasce no fechamento do contrato pelo fluxo de Metas/CS & NPS.
7. No primeiro acesso do usuário ao dashboard de Parceiros naquele navegador, abre automaticamente um tour sequencial com spotlight, título, explicação, progresso, Voltar, Avançar/Concluir e Pular.
8. O tour destaca apenas elementos existentes para o perfil atual, funciona com passos ausentes por permissão/estado, acompanha resize/scroll, respeita reduced motion e pode ser fechado por teclado.
9. Concluir ou pular persiste o estado por usuário, módulo e versão em armazenamento local; nenhuma migration é criada.
10. Há uma ação “Tutoriais” no módulo Parceiros que reabre o tour a qualquer momento sem apagar a preferência persistida.
11. O mecanismo visual/persistência é genérico e configurável para uso futuro em outros módulos, sem acoplamento a Parceiros.
12. O padrão “Guia Inteligente de Módulo” fica registrado nas memórias do projeto com contrato, arquivos e frase de ativação futura.
13. Testes cobrem aliases/tópicos do catálogo, permissão da tool, conteúdo crítico dos dois manuais e chave/estado da persistência do tour.
14. Nenhuma tabela, coluna, rota, permissão, item de menu, dependência ou variável de ambiente é adicionada.
15. O escopo não corrige lacunas preexistentes de autorização em Metas/Parceiros nem integra o manual aos agentes Onyx; esses achados ficam documentados separadamente.

## Tasks / Subtasks

- [x] Task 1 — Catálogo de conhecimento modular (AC: 1–3, 6, 11)
  - [x] Criar tipos, registry e resolutor por aliases/tópicos.
  - [x] Escrever os manuais de Alpha Metas e Parceiros a partir do comportamento real do código.
  - [x] Diferenciar procedimento estático de dados vivos.
- [x] Task 2 — Tool somente leitura do Bibble (AC: 4–6)
  - [x] Registrar `consultar_manual_modulo` no catálogo de tools.
  - [x] Executar a consulta com autorização por módulo.
  - [x] Adicionar Parceiros ao resumo de módulos e instrução de uso da tool.
- [x] Task 3 — Tour reutilizável (AC: 7–11)
  - [x] Criar contrato genérico de passos e helper de persistência versionada.
  - [x] Criar overlay acessível com spotlight, navegação, pular e reduced motion.
  - [x] Integrar no dashboard Parceiros com âncoras estáveis e ação de replay.
- [x] Task 4 — Testes e documentação (AC: 12–15)
  - [x] Testar catálogo, conteúdo, aliases, autorização e persistência.
  - [x] Registrar o padrão em `patterns.md`, `components.md` e `integration-points.md`.
  - [x] Atualizar esta story, File List e notas de conclusão.
- [x] Task 5 — Quality gates (AC: 1–15)
  - [x] Rodar testes focados.
  - [x] Rodar `npm run lint`, `npm run typecheck` e `npm test`.
  - [x] Executar revisão de integração, segurança e código.

## Dev Notes

- A fonte fixa atual do Bibble é `src/lib/shared/painelalpha-knowledge.ts`, interpolada por `src/lib/bibble/system-prompt.ts`; manuais grandes devem ser consultados sob demanda para não inflar todas as chamadas. [Source: reconhecimento Scout 2026-08-07]
- Tools são declaradas em `src/lib/bibble/tools.ts` e executadas em `src/lib/bibble/tool-executor.ts`; `UserCtx` já carrega role e permissões e oferece o padrão `temPermissao`. [Source: reconhecimento Scout 2026-08-07]
- O único tour sequencial presente no checkout é `src/components/AlphaBlueprint/BlueprintOnboarding.tsx`, ancorado por `data-onboarding`. Gestão de Comissões e Prêmios não possui onboarding equivalente no código atual. [Source: reconhecimento Scout 2026-08-07]
- Para evitar a migration exigida por uma nova coluna de usuário, o visto do tour será local e versionado, isolado por userId. [Source: AGENTS.md#Database-Safety-and-Backup-Policy]
- O dashboard Parceiros já recebe dados de sessão no Server Component e centraliza as ações em `ParceirosClient.tsx`; a integração deve preservar seus filtros por URL, permissões e modais. [Source: `.bibble/memory/codebase-map.md#Parceiros`]
- O fluxo recente de parceiro não cadastrado está descrito em `docs/stories/story-metas-parceiro-nao-cadastrado.md` e deve entrar nos dois manuais. [Source: story anterior]
- Integração com agentes Onyx, correção de prompt de projetos e falhas de autorização preexistentes foram identificadas no reconhecimento, porém estão fora desta story para evitar expansão material de escopo.

### Testing

- Vitest em `tests/bibble/` para catálogo/tool e em `tests/guias/` para persistência/configuração do tour.
- Casos mínimos: aliases com/sem acento, tópico específico, manual completo, módulo desconhecido, tópico desconhecido, usuário autorizado, usuário negado, Admin, conteúdo crítico e chave por usuário/versão.
- Validação manual: limpar a chave local, abrir Parceiros, avançar/pular, recarregar e reabrir por “Tutoriais”; validar perfil com e sem `podeEditar`.

## CodeRabbit Integration

**Primary Type:** Architecture  
**Secondary Types:** Frontend, API, Security  
**Complexity:** High

**Primary Agents:** `@dev`, `@architect`  
**Supporting Agents:** `@ux-design-expert`, `@qa`

- [ ] Pre-Commit: revisar tool read-only, autorização, acessibilidade e persistência.
- [ ] Pre-PR: revisar compatibilidade do prompt e integração do dashboard.

**Self-Healing:** `@dev` light, 2 iterações, 15 minutos, CRITICAL; HIGH documentado.

**Focus:** não vazar manual a usuário sem permissão; não transformar tutorial em mutação; teclado/foco/reduced motion; evitar prompt permanente volumoso; não sobrescrever alterações não relacionadas.

## Story Draft Checklist Validation

| Categoria | Status | Evidência |
|---|---|---|
| Objetivo e contexto | PASS | Valor, nome do padrão e escopo definidos. |
| Orientação técnica | PASS | Arquivos e integrações mapeados. |
| Referências | PASS | Código, memória e story anterior citados. |
| Autocontenção | PASS | ACs cobrem fluxos, persistência e limites. |
| Testes | PASS | Cenários unitários e manuais definidos. |
| CodeRabbit | PASS | Tipos, agentes, gates e foco definidos. |

**Final Assessment:** READY

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-08-07 | 1.0 | Story criada a partir do pedido e do mapeamento Scout/Bibble. | River (SM) |
| 2026-08-07 | 1.1 | Catálogo, tool, tour, testes e documentação concluídos. | Dex (Dev) |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Bibble/Dex).

### Debug Log References

- `npx vitest run tests/bibble/module-knowledge.test.ts tests/guias/tutorial-modulo.test.ts --coverage=false` — 11/11 aprovados.
- ESLint focado nos arquivos da feature — aprovado sem erros/warnings.
- `npm run typecheck` — somente 4 erros preexistentes em Exclusão Fiscal, Habilitação RADAR e `google-calendar/sync-queue.test.ts`; zero erro da feature.
- `npm test` — 903/904 aprovados; único timeout em `tests/google-calendar/cli.test.ts`, que passou 2/2 isoladamente logo depois.
- `npm run lint` — falha global preexistente porque o script inclui `.agents`, `.aiox-core` e `.claude/worktrees`, com milhares de violações `no-require-imports`; lint focado aprovado.

### Completion Notes List

- Manuais completos ficam sob demanda e não aumentam permanentemente o prompt do Bibble.
- A tool é somente leitura, valida módulo/tópico e bloqueia usuários sem permissão efetiva/role aceita.
- O tour funciona com passos ausentes, scroll/resize, Escape e reduced motion; pular e concluir persistem a mesma chave local versionada.
- O padrão foi registrado como **Guia Inteligente de Módulo** para replicação futura.
- Nenhuma migration, rota, permissão, menu, dependência ou variável de ambiente foi adicionada.

### File List

- `.bibble/memory/codebase-map.md`
- `.bibble/memory/components.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/journal.md`
- `.bibble/memory/patterns.md`
- `docs/stories/story-guia-inteligente-metas-parceiros.md` (novo)
- `src/lib/shared/module-knowledge/types.ts` (novo)
- `src/lib/shared/module-knowledge/registry.ts` (novo)
- `src/lib/shared/module-knowledge/metas.ts` (novo)
- `src/lib/shared/module-knowledge/parceiros.ts` (novo)
- `src/lib/shared/module-knowledge/index.ts` (novo)
- `src/lib/bibble/system-prompt.ts`
- `src/lib/bibble/tools.ts`
- `src/lib/bibble/tool-executor.ts`
- `src/lib/guias/tutorial-modulo.ts` (novo)
- `src/components/Guias/GuiaModuloTour.tsx` (novo)
- `src/app/PainelAlpha/Parceiros/page.tsx`
- `src/components/Parceiros/ParceirosClient.tsx`
- `tests/bibble/module-knowledge.test.ts` (novo)
- `tests/guias/tutorial-modulo.test.ts` (novo)

## QA Results

**Gate:** PASS com limitações preexistentes do repositório.

- Catálogo/tool: consulta somente leitura, aliases, tópico específico e autorização cobertos por teste direto do executor.
- Tour: chave local por usuário/módulo/versão e remoção de passos ausentes cobertas; overlay usa conteúdo textual React, sem HTML injetado.
- Integração: `userId` vem da sessão no Server Component; nenhum valor sensível é salvo no navegador.
- Regressão focada: 28/28 testes de Guia, Bibble, parceiro pendente e responsáveis aprovados.
- Lint focado e `git diff --check` aprovados.
- Limitações globais: `npm run lint` inclui fontes auxiliares/worktrees fora da aplicação e já falha em massa; `npm run typecheck` mantém 4 erros não relacionados; suíte completa teve somente o timeout intermitente do Google Calendar, aprovado isoladamente.
- Teste visual autenticado em navegador não foi executado nesta sessão; validar manualmente primeira visita, replay e perfis com/sem edição antes do deploy.
