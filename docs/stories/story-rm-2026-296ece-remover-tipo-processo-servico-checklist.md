# Story — RM-2026-296ECE: Remover Tipo de processo e Serviço da função Checklist

## Objetivo

Remover `Tipo de processo` e `Serviço` da configuração e da apresentação de checklists, fazendo com que templates novos e legados sejam aplicados somente por pipeline, etapa e card específico.

## Auditoria (Fase 0)

- O builder administrativo ainda projeta, pesquisa, edita e envia `servico` e `tipoProcesso`.
- As Server Actions ainda aceitam e persistem os dois campos nos payloads de criação e edição.
- Os serviços de resumo e materialização ainda usam os valores como dimensões de aplicabilidade.
- A aba Checklist do card ainda oferece uma edição de `Tipo de processo`, acoplando uma propriedade geral do card à função Checklist.
- As colunas legadas existem em `BpmChecklistTemplate`; removê-las fisicamente exigiria migration e perda desnecessária de reversibilidade.

## Blueprint (Fase 1)

1. Retirar os campos dos schemas Zod, DTOs e payloads do builder.
2. Parar de projetar e persistir os campos nas ações administrativas, sem zerar valores legados durante uma edição.
3. Remover as duas condições das consultas de aplicabilidade e do comparador puro de domínio.
4. Retirar inputs, filtros, badges, estados e textos correspondentes do builder e do painel do card.
5. Preservar as colunas e os valores antigos como dados inertes, sem schema, migration, seed ou backfill.
6. Cobrir payload antigo ignorado, template legado aplicável, idempotência, progresso, permissões e ausência visual dos campos.

## Invariantes

- Autenticação, permissão administrativa e ownership do card permanecem obrigatórios.
- Pipeline, etapa e card específico continuam sendo dimensões válidas de vínculo.
- Valores legados de `servico` e `tipoProcesso` não são apagados ao editar um template.
- Valores legados deixam de restringir resumo, materialização, bloqueio de movimento e automações.
- Uma segunda materialização continua idempotente e não recria instâncias.
- Checklists já materializados, progresso, conclusão, responsáveis, histórico, tarefas derivadas e realtime não mudam de semântica.
- Payloads antigos são validados por Zod e têm as chaves removidas do objeto parseado, sem persistência funcional.

## Critérios de aceite

- [x] Builder não exibe, pesquisa, filtra nem envia `Serviço` ou `Tipo de processo`.
- [x] Card não exibe controle ou texto desses campos na função Checklist ou no cabeçalho.
- [x] Schemas e DTOs públicos da função Checklist não expõem as duas propriedades.
- [x] Criação e edição não escrevem nem apagam as colunas legadas.
- [x] Templates legados com os campos preenchidos continuam aplicáveis por pipeline, etapa e card.
- [x] Materialização, conclusão e cálculo de progresso continuam funcionando.
- [x] Materializar duas vezes não duplica checklist nem efeitos.
- [x] Autenticação, autorização administrativa, ownership e validação Zod permanecem protegidos.
- [x] Nenhuma alteração de schema, migration, seed ou dados é realizada.
- [x] Gates direcionados e build são executados; débitos globais externos são documentados.

## Fora de escopo

- Remover ou limpar fisicamente as colunas legadas.
- Alterar ou apagar os campos persistidos `servico` e `tipoProcesso` do domínio do card.
- Promover a entrega para produção.

## Gate de banco

`DATABASE_CHANGE_NOT_REQUIRED`: a remoção é funcional e visual. As colunas existentes permanecem como armazenamento legado inerte para evitar migration destrutiva e preservar rollback.

## Checklist de fases

- [x] Fase 0 — auditoria read-only.
- [x] Fase 1 — blueprint e story executável.
- [x] Fase 2 — contratos e backend.
- [x] Fase 3 — frontend administrativo e card.
- [x] Fase 4 — gates técnicos.
- [x] Fase 5 — fluxo integrado/E2E.
- [x] Fase 6 — revisão de segurança.
- [x] Fase 7 — revisão de arquitetura e qualidade.
- [x] Fase 8 — casos de borda.
- [x] Fase 9 — memória e documentação.
- [x] Fase 10 — fechamento e atualização do Roadmap.

## Evidências

- O schema Zod descarta chaves antigas, e as três ações de gravação não incluem os dois campos no `data` do Prisma; uma edição mantém o valor legado existente sem expô-lo.
- As consultas de resumo e materialização filtram somente por pipeline, etapa e card; os adaptadores de movimento, regras e automações enviam somente esse contexto.
- O builder não carrega catálogo de serviços, não mantém estado para os campos e lista apenas os três vínculos restantes.
- O painel de Checklist não altera mais `tipoProcesso`; o cabeçalho do card não renderiza mais `Serviço ativo`.
- Segurança: `exigirAdminChecklist`, `exigirAcessoBpmCard`, schemas Zod, validação de vínculo e checagens transacionais foram preservados.
- Robustez: materialização repetida, conclusão, progresso, tarefa derivada, histórico e realtime permanecem cobertos.

### Gates executados em 2026-09-08

| Gate | Resultado | Evidência |
| --- | --- | --- |
| Suíte focal final | PASS | 10 arquivos, 64/64 testes |
| Suíte ampliada de consumidores | BASELINE | 206/225 aprovados; 19 falhas em `fechado-actions`, `lost-actions` e `kanban-transicao-integracao` causadas por mocks concorrentes sem `bpmCampoObrigatorioEtapa`, fora desta RM |
| ESLint direcionado | PASS | zero erros; warnings legados somente em `Cards.ts` e `CardAbertoLayout.tsx` |
| `npm run build` | PASS | Next.js/Turbopack compilou e gerou as rotas, incluindo `/admin/checklists` |
| `git diff --check` | PASS | nenhum whitespace inválido |
| `npm run typecheck` global | BASELINE | nenhum diagnóstico de checklist; falhas externas em calendário, documentos, configuração Lost e scripts concorrentes |
| `npm run lint` global | BASELINE | 2.484 erros e 1.255 avisos preexistentes/externos; lint direcionado sem erros |
| `npm test` global | BASELINE | 2.452/2.506 testes aprovados; 54 falhas externas à entrega |

## File List

- `src/lib/bpm/checklists/schemas.ts`
- `src/lib/bpm/checklists/leitura.ts`
- `src/lib/bpm/checklists/integracao.ts`
- `src/lib/bpm/checklists/service.ts`
- `src/actions/bpm/Checklists.ts`
- `src/components/bpm/checklists/ChecklistsWorkspace.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistsCard.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx`
- `src/actions/bpm/Cards.ts`
- `src/lib/bpm/automacoes/executor.ts`
- `src/lib/bpm/regras/contexto.ts`
- `src/lib/bpm/transicao-command.ts`
- `tests/bpm/checklists-actions.test.ts`
- `tests/bpm/checklists-domain.test.ts`
- `tests/bpm/checklists-service.test.ts`
- `tests/bpm/checklists-integracao-motores.test.ts`
- `tests/bpm/checklists-entrega-shell.test.ts`
- `tests/bpm/card-modal-integration.test.ts`
- `.bibble/memory/architecture.md`
- `.bibble/memory/components.md`
- `.bibble/memory/decisions.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/journal.md`
- `docs/stories/story-rm-2026-296ece-remover-tipo-processo-servico-checklist.md`
