# Story: Anexos e procedimentos dos cards nativos e importados no Alpha CRM

**ID:** STORY-ALPHA-CRM-ANEXOS-PROCEDIMENTOS-CARD
**Status:** Ready for Review — correção validada; ressalvas de baseline registradas
**Origem:** Pedido direto do usuário em 2026-10-20.

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: [lint, typecheck, tests, build, review]
```

## Story

**Como** usuário do Alpha CRM, **quero** consultar e enviar anexos nos cards, distinguir seus indicadores de tarefas e encontrar uma mensagem amigável quando não houver procedimento, **para** acompanhar o fluxo sem interpretar ausência de conteúdo como falha.

## Contexto e referências

A investigação do executor, exclusivamente por leitura, identificou que o card importado Green Coast `rdcard_eb75bb7c722eac28f456e351467b` tem duas tarefas e nenhum anexo: a prancheta com `2` representa tarefas. O card nativo Green Coast possui procedimento; importados inspecionados não possuem template ou instância aplicável. Isso não comprova perda de anexos e não autoriza fabricar registros nem copiar dados entre cards.

`cardChecklistSchema` em `src/lib/bpm/checklists/schemas.ts` aceita apenas CUID e rejeita o identificador persistido dos cards importados antes da consulta. A mesma restrição aparece em `registrarAnexoSchema` e nos contratos das rotas de upload direto/finalização. O schema canônico `bpmCardIdSchema` já aceita CUID e `rdcard_` seguido de 28 caracteres hexadecimais minúsculos. Aceitar o formato não concede acesso ao card.

Fontes locais verificadas:

- `src/lib/validations/bpm.ts`, exports `bpmCardIdSchema` e `registrarAnexoSchema`: contrato de identidade e registro por recibo.
- `src/lib/bpm/checklists/schemas.ts`, `cardChecklistSchema` e `dadosTemplateSchema.cardId`: validação anterior à leitura de procedimentos e vínculo opcional do template.
- `src/app/api/bpm/upload/direct/route.ts`, `payloadSchema` e `caminhoDoCard`: autorização e vinculação do upload ao caminho/card.
- `src/app/api/bpm/upload/finalize/route.ts`: finalização do upload.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistsCard.tsx`, `carregar` e estados erro/vazio: retry real e ausência de procedimento.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`, aba `anexos`: listagem, upload e visualização dos anexos do card.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`, indicadores `_count.tarefas`/`_count.anexos`: contagens distintas atualmente apresentadas por ícone e número.
- `docs/stories/story-rm-2026-ffd798-renomear-checklist-procedimento.md#contexto`: usar “procedimento” nos textos públicos; identificadores internos de checklist permanecem existentes.
- `docs/stories/story-alpha-crm-origem-cliente-parceiro.md#entrega-do-ajuste-visual-para-staging--20102026`: preservar alterações concorrentes e aplicar a preferência permanente de commit/push para staging após validação.

Não foi fornecido epic específico; os critérios abaixo derivam do pedido e dos contratos verificados. `accumulated-context.md`, `.aiox/gotchas.json`, `.Codex/commands/AIOX/agents/sm.md` e os documentos gerais de arquitetura/framework configurados não foram encontrados. Foi usado o fallback `.aiox-core/development/agents/sm.md`; a coerência entre stories é coberta pelas referências acima. Code intelligence indisponível: verificação retornou `false`.

## Acceptance Criteria

1. O Kanban distingue explicitamente as contagens de tarefas e anexos com rótulos legíveis e acessíveis, respeitando singular/plural. A prancheta com duas tarefas de Green Coast não sugere dois anexos.
2. Cards nativos e importados com identificadores válidos podem consultar procedimentos e usar o fluxo existente de upload e registro de anexos. Reutilizar `bpmCardIdSchema` nos campos `cardId` afetados, incluindo o vínculo opcional de template, mantendo os outros identificadores restritos aos formatos existentes.
3. A aba Anexos lista os arquivos efetivamente vinculados ao card; quando vazia, informa claramente que o card ainda não possui anexos. Upload concluído reaparece pelo fluxo normal de atualização/leitura, sem exigir recriar ou mover o card.
4. A aba Procedimentos apresenta aviso amigável quando a consulta autorizada retorna sucesso sem procedimentos aplicáveis ao card/etapa, sem alerta de erro nem botão “Tentar novamente” nessa ausência normal. Procedimentos existentes continuam sendo apresentados.
5. Falhas reais de leitura, indisponibilidade, validação ou autorização não são mascaradas como ausência de conteúdo; o tratamento existente de erro e retry permanece apropriado. Autenticação, ACL do card, recibo assinado, associação de caminho/card/usuário, limites e tipos de arquivo continuam obrigatórios.
6. Nenhuma migration, alteração de schema, backfill, upload de teste em dados reais ou materialização manual é executada para corrigir a apresentação. Testes devem cobrir tanto cards CUID quanto importados e a diferença entre ausência e falha real.

## Tasks / Subtasks

- [x] Reutilizar o contrato canônico nos schemas de procedimentos, registro e upload afetados, mantendo demais validações e autorizações (AC 2, 5; fontes de identidade/upload acima).
- [x] Tornar os indicadores de tarefas/anexos explícitos e acessíveis no Kanban, sem alterar as contagens (AC 1).
- [x] Ajustar as mensagens vazias nas abas Anexos e Procedimentos, usando a nomenclatura pública existente e preservando falhas reais (AC 3–5).
- [x] Testar contratos CUID/RD e formatos inválidos, leitura autorizada vazia/com conteúdo/com falha, fronteiras de upload e atualização de anexos (AC 2–6).
- [x] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; registrar evidências, falhas preexistentes e revisão do delta.
- [x] Atualizar checklist, File List efetiva e status da story; publicar somente o escopo autorizado em `staging` pelo fluxo DevOps.

## Dev Notes

Nenhuma orientação específica desses contratos foi encontrada nos documentos gerais de arquitetura configurados. As fontes de código verificadas acima fornecem o contexto desta manutenção: Next.js/React/TypeScript e Zod já existentes, sem nova biblioteca ou variável de ambiente. `cardId` é uma identidade de card; IDs de template, item e instância de procedimento não devem ser ampliados por substituição indiscriminada.

Os fluxos de upload direto e finalização e a action `RegistrarAnexoBpm` precisam continuar verificando a mesma identidade durante todo o envio. A mudança de schema deve preservar as verificações existentes de sessão, acesso e recibo. Um erro de acesso nunca deve ser convertido em lista vazia para cumprir AC 4.

Não há necessidade de alteração estrutural nem mutação em massa. Se surgir essa necessidade, interromper essa parte e seguir relatório Vault, backup verificado e consentimento específico do `AGENTS.md`. Preservar todas as alterações de outras tarefas já presentes nos arquivos compartilhados.

## Testing

Utilizar Vitest e os padrões de mocks existentes em `tests/bpm/`. Cobrir aceitação do formato importado persistido, continuidade do CUID e rejeição de formatos arbitrários; ausência de procedimentos retorna vazio amigável enquanto falha de action mantém erro/retry. Verificar contagens/nomes acessíveis de tarefas e anexos no Kanban, mensagem vazia de anexos, arquivo existente e resultado atualizado após envio. Testes de rotas devem assegurar que ID válido não contorna ACL, caminho nem recibo; simular storage e banco, sem escrever dados reais. A File List de testes será completada pelo executor conforme os cenários efetivamente exercitados.

## 🤖 CodeRabbit Integration

**Story Type Analysis:** API; secundários Frontend e Security; complexidade média, manutenção de contratos e estados existentes.

**Specialized Agent Assignment:** `@dev` implementa e revisa antes do commit; `@qa` valida contratos, regressão e segurança; `@ux-design-expert` é referência para mensagens/acessibilidade; `@devops` publica em staging.

**Quality Gates:**

- [x] Pre-Commit (`@dev`): lint, typecheck, testes, build, revisão de ACL/recibo e CodeRabbit se disponível.
- Pre-PR e Pre-Deployment: não aplicáveis ao escopo atual; entrega solicitada é commit/push em staging.

**Self-Healing:** `@dev`, modo light, até 2 iterações/15 minutos; CRITICAL deve ser corrigido, HIGH documentado e encaminhado à revisão. Revisão `@qa` full: até 3 iterações/30 minutos para CRITICAL/HIGH. Se CLI ausente, registrar indisponibilidade e revisão substituta conforme `core-config.yaml`.

**Focus Areas:** schema canônico sem perda de validação; autenticação/ACL e integridade do recibo/caminho; erro versus vazio; rótulos acessíveis; regressão de cards nativos.

## File List

- `docs/stories/story-alpha-crm-anexos-procedimentos-card.md` (nova).
- `src/lib/bpm/checklists/schemas.ts`.
- `src/lib/validations/bpm.ts`.
- `src/app/api/bpm/upload/direct/route.ts`.
- `src/app/api/bpm/upload/finalize/route.ts`.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistsCard.tsx`.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`.
- `src/components/bpm/kanban/CardKanbanRenderer.tsx`.
- `tests/bpm/anexos-idempotencia.test.ts`.
- `tests/bpm/upload-direto-privado.test.ts`.
- `tests/bpm/movimento-livre-react.test.ts`.
- `tests/bpm/anexos-aba-card-react.test.ts` (novo).
- `tests/bpm/procedimentos-cards-rd.test.ts` (novo).
- `tests/bpm/procedimentos-vazio-react.test.ts` (novo).

## Dev Agent Record

- Investigação CLI somente leitura: Green Coast importado com duas tarefas (uma pendente e uma concluída), zero anexos e zero instâncias/templates aplicáveis. O card nativo da mesma empresa possui um procedimento materializado. Nenhum arquivo perdido foi identificado nessa consulta.
- Causa reproduzida: `cardChecklistSchema` rejeitava `rdcard_*` antes de consultar conteúdo. O mesmo limite estava nos contratos de autorização/finalização/registro de upload. Reutilizado schema canônico mantendo validação estrita e autorização de cada operação.
- Mensagens informativas para ausência de anexos/procedimentos, preservando alertas e retry em falhas reais. Rótulos de contagem corrigidos nos dois renderizadores do Kanban (fallback e composição configurada), inclusive singular/plural.
- Testes cobrem identificação do card nativo/importado, rejeição de ID inválido, ACL negada, caminho trocado, assinatura/recibo existentes, leitura vazia versus falha, anexos persistidos, abertura de arquivo e upload→finalização→registro→atualização da lista. Storage e banco simulados; nenhum upload real efetuado.
- `npm run typecheck`: exit 0, `/tmp/alpha-anexos-procedimentos-typecheck.log`.
- `npm run lint`: exit 0, zero erros e 1.193 warnings preexistentes, `/tmp/alpha-anexos-procedimentos-lint.log`.
- `npm test`: 644 arquivos aprovados, 4 com falha e 1 ignorado; 4.828 testes aprovados, 6 com falha, 7 ignorados e 1 todo. Falhas idênticas à base staging documentada: Builder (3), scroll do modal (1), Próximo Contato (2), além da importação de `next/server` na suíte de arquivamento. Nenhuma nova falha no delta. `/tmp/alpha-anexos-procedimentos-tests.log`.
- Testes focados iniciais: 36/36. Incremento final de UI: 8/8, sem warnings, incluindo composição configurada e ciclo de upload. Evidências `/tmp/alpha-anexos-procedimentos-focused.log` e `/tmp/alpha-anexos-procedimentos-ui-final.log`.
- QA independente: APPROVED para o delta final. O apontamento de rótulos na composição configurada foi corrigido e reavaliado; nenhuma regressão de segurança identificada. Aprovação do delta não declara a suíte global aprovada. CodeRabbit CLI indisponível; revisão independente usada como alternativa.
- Build final equivalente aprovado: Prisma/player gerados por scripts oficiais, Next.js webpack com heap de 4.096 MiB e uma CPU; exit 0 em 58,71 segundos, sem alterar configuração versionada. Evidências `/tmp/alpha-anexos-procedimentos-build.log` e `/tmp/alpha-anexos-procedimentos-build-result.json`. A primeira execução foi interrompida pelo executor para incluir o ajuste de composição; não foi tratada como falha funcional nem aprovação.
- Preferência permanente do usuário: commit e push automáticos para staging após validação. Base isolada `480948d9f73b480a2e266472f85677f04e5dd2b7`; alterações concorrentes do workspace preservadas.


## Validação do draft

Checklist `.aiox-core/product/checklists/story-draft-checklist.md` aplicado integralmente em modo YOLO. `[AUTO-DECISION] Criar epic/registro externo? → Não; manutenção solicitada diretamente, escopo local definido, sem autorização para comunicação externa.`

| Categoria | Resultado | Evidência |
| --- | --- | --- |
| Objetivo e contexto | PASS | Pedido, distinção Green Coast e benefício descritos; sem dependência bloqueante |
| Orientação técnica | PASS | Contratos, rotas, componentes, segurança e limites identificados |
| Referências | PASS | Fontes locais verificadas e contexto de story anterior resumido |
| Autossuficiência | PASS | Causa, limites de identidade e diferença vazio/erro explícitos |
| Testes | PASS | Cenários de leitura, UI e fronteiras de upload definidos |
| CodeRabbit | PASS | Tipos, agentes, gates, self-healing e focos presentes |

**Resultado:** READY, clareza 9/10. Nenhuma lacuna bloqueante. N/A: nova variável de ambiente, migration, epic externo e deploy de produção. A implementação deve validar o efeito real em leitura e upload, sem confundir o número de tarefas com arquivos.

## Change Log

| Data | Versão | Alteração | Autor |
| --- | --- | --- | --- |
| 2026-10-20 | 1.0 | Story preparada a partir do pedido e diagnóstico do executor, com checklist de draft | River (SM) |

| 2026-10-20 | 1.1 | Schemas canônicos para procedimentos/upload em cards RD, contadores explícitos nos dois renderizadores, estados vazios e regressão do ciclo de anexo; QA do delta aprovado e build concluído. | Codex |
