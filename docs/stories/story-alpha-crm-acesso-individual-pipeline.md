# Story: autorizar usuários individualmente no pipeline

## Status

Ready for Review

executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["revisão de autorização", "testes de regressão", "lint", "typecheck"]

## Story

Como administrador do Alpha CRM, quero selecionar usuários em Configurações > Permissões > Visibilidade por pipeline, para permitir a entrada dessas pessoas mesmo quando o setor delas não estiver autorizado.

Pedido confirmado pelo usuário: **“Autorizar mesmo que o setor nao seja autorizado”**. A funcionalidade complementa o acesso por setor e a configuração de visão de equipe já existente; autorização individual de entrada não concede supervisão nem edição de terceiros.

## Acceptance Criteria

1. A seção Visibilidade por pipeline apresenta seleção múltipla de usuários ativos com acesso ao CRM, independente do setor autorizado. Exibe nome, seleção atual, estado de carregamento, erro e confirmação de salvamento; permite adicionar e remover pessoas com teclado e rótulos acessíveis.
2. A lista individual é persistida como `usuariosAutorizados` opcional no JSON existente `BpmPipeline.visualizacaoConfigJson`, sem nova tabela, coluna, migration ou backfill. A lista contém IDs inteiros positivos únicos. Configurações legadas sem essa propriedade continuam válidas e equivalem a lista vazia.
3. O controle central de acesso permite entrada no pipeline a usuário explicitamente autorizado, mesmo com setor não autorizado, preservando as condições de status ATIVO e acesso ao módulo CRM. Usuário inativo ou com CRM revogado perde o acesso efetivo mesmo que seu ID permaneça configurado. A regra existente para administradores e setores permanece compatível.
4. Listagem de pipelines, acesso direto, quadro, detalhes e autorização realtime usam a mesma regra de entrada. A autorização individual não ultrapassa permissões de coluna, ownership, visão de equipe ou capacidades de edição/movimentação/configuração.
5. Apenas o administrador autorizado pelo guard de configuração atual pode consultar/alterar a configuração. O servidor valida IDs e elegibilidade dos usuários, rejeita valores inválidos/inexistentes e deduplica a seleção; a interface não constitui a barreira de autorização.
6. Leitura e gravação preservam os supervisores existentes e demais configurações legadas. Payload antigo que omite a lista individual preserva a lista persistida; lista vazia explícita revoga apenas as concessões individuais. Salvamento de setores ou supervisores não apaga concessões individuais.
7. A publicação usa a versão esperada `configVersion`, grava configuração e auditoria atomicamente e rejeita versão obsoleta sem alteração parcial. Auditoria registra ator, pipeline e valores anterior/novo da concessão individual. Revalidação e evento existentes atualizam o acesso após salvar/remover uma pessoa.
8. Testes demonstram concessão e revogação por pessoa, preservação do acesso por setor/admin, negação por status/módulo/coluna e ausência de ganho de edição ou supervisão. Não executar mutação em banco remoto durante a implementação.

## Tasks / Subtasks

- [x] Estender contrato de leitura/validação com helper de IDs individuais separado da supervisão, preservando JSON legado (AC 2, 6).
- [x] Integrar a concessão individual ao resolvedor central e conferir todos os consumidores de entrada do pipeline (AC 3, 4).
- [x] Estender actions administrativas com validação server-side, merge do JSON atual, CAS de versão e auditoria transacional (AC 5, 6, 7).
- [x] Conectar select de usuários à seção de visibilidade com seleção independente dos setores, carregamento, erro e publicação (AC 1).
- [x] Cobrir matriz de autorização e regressões de configuração/UI com fixtures sintéticas (AC 1–8).
- [x] Executar `npm run lint`, `npm run typecheck`, `npm test` e testes direcionados. Documentar falhas de baseline sem declarar aprovação inexistente.
- [x] Atualizar checklist, file list efetiva e evidências antes de concluir.

## Dev Notes

A implementação atual oferece apenas seleção de setores na seção `VisibilidadePipelineSection.tsx`. `LerVisibilidadePipelineBpm` já retorna catálogo de usuários vinculáveis, configuração de visão de equipe e versão. `SalvarVisibilidadePipelineBpm` valida setores, usa transação/CAS, registra auditoria, revalida layout e notifica `PIPELINE_ALTERADO`; ampliar esse fluxo existente.

O schema de visão de equipe em `src/lib/bpm/visao-equipe.ts` usa `version: 1` e `supervisores`, com objeto estrito. Acrescentar propriedade opcional compatível ou helper separado sem fazer configurações legadas perderem validade. Distinguir campo ausente no payload de lista vazia. Não reconstruir JSON descartando a concessão individual quando salvar somente supervisores. Leitura inválida nunca deve inventar concessões.

`src/lib/bpm/ownership.ts` concentra `podeAcessarPipelineBpm`, `checarAcessoBpmPipeline`, catálogo de pessoas, ownership e acesso realtime. A nova lista permite entrada; as verificações subsequentes de coluna/ação continuam vigentes. Conferir listagens e consultas que filtram setores diretamente, evitando divergência entre menu e URL.

Arquitetura aprovada no fluxo principal: helper separado para lista opcional de IDs no JSON existente, compatibilidade do legado e preservação quando ausente no payload. Nenhuma nova dependência ou variável de ambiente é necessária.

### Contexto e referências

- `docs/stories/story-alpha-crm-visao-equipe-pipeline.md` — evolução anterior de leitura por equipe; manter separação entre entrada, supervisão e edição.
- `src/actions/bpm/VisibilidadePipeline.ts` — contrato administrativo, CAS, auditoria e notificação existentes.
- `src/lib/bpm/ownership.ts` — guard central e elegibilidade de pessoas.
- `.aiox-core/constitution.md` — qualidade, escopo autorizado e segurança do projeto.
- `.aiox-core/core-config.yaml` — gates e CodeRabbit habilitado.

[AUTO-DECISION] Criar story específica sem epic novo → usar o pedido confirmado e o escopo técnico fornecido pelo fluxo principal; não inventar requisitos de produto.

[AUTO-DECISION] `accumulated-context.md`, `.aiox/gotchas.json` e documentos de arquitetura gerais não encontrados na árvore consultada → usar a story anterior e os pontos de integração reais acima para coerência; não criar referências inexistentes. Persona carregada pelo fallback `.aiox-core/development/agents/sm.md`, pois `.Codex/commands/AIOX/agents/sm.md` não existe.

### Testing

- Unitários: JSON null/ausente/legado, lista inválida/duplicada, permissões por setor/admin/indivíduo, usuário sem setor, inativo e CRM revogado.
- Integração de actions: ator proibido, usuário inexistente/inelegível, revogação com `[]`, payload omitido preservando configuração, preservação de supervisores, versão conflitante e auditoria atômica.
- Integração de acesso: pessoa de setor bloqueado consegue listar/abrir pipeline após concessão; coluna bloqueada e edição de card de terceiro permanecem negadas; revogar concessão retorna ao acesso definido pelos setores.
- React: carregar catálogo, adicionar/remover pessoa fora do setor, salvar, recarregar seleção, estados de erro/conflito e navegação por teclado.
- Usar padrão Vitest e fixtures dos testes BPM existentes; simular persistência sem credenciais ou dados reais.

## 🤖 CodeRabbit Integration

### Story Type Analysis

Principal: Security. Secundários: API e Frontend. Complexidade média: autorização transversal com persistência em configuração existente.

### Specialized Agent Assignment

Executor @dev; revisão de autorização @architect; testes @qa; interface @ux-design-expert quando necessária. @devops somente para PR/publicação posteriormente autorizados.

### Quality Gate Tasks

- [x] Pre-Commit (@dev): testes, lint, typecheck e revisão de autorização/compatibilidade.
- [x] Pre-PR (@devops): se houver PR autorizado, conferir diff, evidências e integração.
- [x] Pre-Deployment (@devops): se houver publicação autorizada, validar artefato e rollback de código.

### Self-Healing Configuration — Story 6.3.3

@dev: light, até duas iterações e 15 minutos, corrigir CRITICAL; documentar HIGH para revisão. @qa: full, até três iterações e 30 minutos para CRITICAL/HIGH. @devops: check, somente relatório. Se CLI indisponível, registrar essa limitação e revisão real realizada.

### CodeRabbit Focus Areas

Escalada de privilégio, composição setor/usuário/coluna, validação server-side, compatibilidade do JSON legado, CAS/atomicidade, revogação, ausência de ampliação de edição e acessibilidade do seletor.

## Story Draft Checklist

| Categoria | Resultado | Evidência |
| --- | --- | --- |
| Objetivo/contexto | PASS | Pedido confirmado e benefício explícitos |
| Orientação técnica | PASS | Contrato JSON, actions, guards e limites descritos |
| Referências | PASS | Fontes locais e coerência com story anterior |
| Informação autocontida | PASS | Elegibilidade, omissão/revogação, legado e conflitos definidos |
| Testes | PASS | Matriz unitária, actions, acesso e React |
| CodeRabbit | PASS | Tipos, responsáveis, gates, self-healing e foco preenchidos |

Resultado: **READY**, clareza 9/10, sem dependência bloqueante identificada. Esta validação aprova somente a preparação, sem atestar execução de código, testes ou publicação.

## Dev Agent Record

Implementação local concluída em base isolada de `main` (`0ed223a5`), sem migração, carga ou alteração no banco remoto. A lista individual reutiliza o JSON existente e concede somente exceção ao setor. Pipeline/card, elegibilidade de responsável, atribuição automática, catálogo, Tarefas, Empresas e Dashboard usam a mesma configuração. Supervisão legada e lista omitida são preservadas; autorizações aninhadas em payload de supervisão são ignoradas e possuem regressão própria.

### Validação

- `npm run lint`: exit 0, zero erros e 1.193 avisos existentes; lint direcionado final sem avisos/erros.
- `npm run typecheck`: exit 0 após geração oficial do player.
- `npm test`: exit 0, 650 arquivos e 4.890 testes aprovados; 7 ignorados e 1 todo.
- `npm run build`: exit 0.
- Testes direcionados: 5 arquivos e 34 testes aprovados, incluindo concessão, revogação, CRM removido, conta inativa, coluna negada, terceiros sem edição e adicionar/remover/publicar na interface.
- `git diff --check`: aprovado. CodeRabbit indisponível (`coderabbit`/`cr` ausentes); revisão real de arquitetura/autorização executada e achados corrigidos.
- As primeiras execuções identificaram arquivos públicos, bundle gerado e pasta `.cache` ausentes no checkout isolado. Ambiente recomposto e gates repetidos com sucesso. Nenhum código de produção foi alterado para contornar as verificações.
- Logs locais em `/dev/shm/crm-individual-{lint,typecheck-final,test-complete,build,focused}.log`.
- Sem navegador autenticado ou publicação nesta entrega.

### File List efetiva

- `docs/stories/story-alpha-crm-acesso-individual-pipeline.md`
- `src/actions/bpm/Dashboard.ts`
- `src/actions/bpm/Empresas.ts`
- `src/actions/bpm/Tarefas.ts`
- `src/actions/bpm/VisibilidadePipeline.ts`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/VisibilidadePipelineSection.tsx`
- `src/lib/bpm/acesso-individual-pipeline.ts`
- `src/lib/bpm/ownership.ts`
- `src/lib/bpm/visao-equipe-server.ts`
- `src/lib/bpm/visao-equipe.ts`
- `tests/bpm/acesso-individual-pipeline.test.ts`
- `tests/bpm/visao-equipe-config-react.test.ts`
- `tests/bpm/visao-equipe.test.ts`
- `tests/bpm/visibilidade-pipeline-actions.test.ts`

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-19 | 1.0 | Story pronta para implementar concessão individual de entrada no pipeline | River (@sm) |

| 2026-10-19 | 1.1 | Autorização individual implementada; gates locais aprovados; sem publicação | Dex (@dev) |
