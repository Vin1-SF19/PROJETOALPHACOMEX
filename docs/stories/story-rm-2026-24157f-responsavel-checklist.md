# RM-2026-24157F — Responsável do Checklist

## Status

Pronto para testes.

## História

Como operador do Alpha CRM, quero que cada novo item de checklist assuma por padrão o responsável principal do card e possa ser transferido para outra pessoa vinculada, para que a execução tenha dono explícito sem exigir atribuição manual repetitiva.

## Diagnóstico e caminho de consumo

O domínio já persiste responsabilidade em `BpmCardChecklistItem.responsavelId`; criar um segundo responsável no cabeçalho do checklist produziria fontes concorrentes. O card possui um responsável principal obrigatório e mantém as demais pessoas internas vinculadas em `BpmCardMembro`. A lacuna está nos dois produtores de itens: materialização de template e inclusão de item exclusivo ainda criam itens sem responsável.

O resultado é consumido em:

- `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]`;
- modal do card → painel esquerdo → aba Checklist;
- `PainelChecklistsCard`, que exibe e transfere a responsabilidade de cada item;
- reconciliador de tarefa derivada, que usa o primeiro item pendente atribuído e mantém fallback para o responsável principal do card.

`AUTO_ADJUSTMENT_REQUIRED`: o artefato antigo cita `CardOpenFormSlot`, mas o consumidor real e protegido por regressão é a aba Checklist em `PainelHistorico`. A entrega seguirá o caminho efetivamente montado, sem duplicar o painel no centro do modal.

`AUTO_ADJUSTMENT_ACCEPTANCE`: ao abrir um card com template aplicável, os novos itens são materializados com o responsável principal atual; um operador autorizado transfere um item para um membro do card e a escolha persiste após recarregar.

## Invariantes

- A fonte canônica do padrão é `BpmCard.responsavelId` no instante em que o item é criado.
- Responsabilidade é granular por item em `BpmCardChecklistItem.responsavelId`.
- Materialização e item exclusivo aplicam o mesmo padrão.
- Instâncias e itens já existentes nunca são reatribuídos automaticamente.
- Trocar o responsável principal do card não sobrescreve transferências já persistidas.
- Uma transferência aceita o responsável principal, um membro vinculado ou `null` (`Sem responsável`), preservando a semântica existente.
- Usuário não vinculado é rejeitado pelo backend, mesmo por chamada direta.
- Autorização de edição é verificada antes e dentro da transação.
- Escritas efetivas mantêm CAS, histórico, reconciliação da tarefa e notificação em tempo real; no-op não duplica efeitos.
- Não há seleção arbitrária de outro usuário quando o card não pode ser resolvido.

## Blueprint técnico

1. Projetar `responsavelId` junto ao card no serviço de materialização.
2. Copiar esse valor para cada item criado no nested create, antes da reconciliação da tarefa na mesma transação.
3. Aplicar o mesmo default ao item exclusivo criado diretamente no card.
4. Preservar a transferência por item já existente, a validação de vínculo, o CAS e os efeitos pós-escrita.
5. Cobrir default, transferência válida, rejeição, `null`, idempotência e ausência de sobrescrita em testes.
6. Tornar o estado de salvamento do seletor inequívoco na interface, impedindo duplo envio do mesmo item.

## Matriz de integração

| Origem | Autoridade | Persistência/efeito | Resultado |
| --- | --- | --- | --- |
| Abertura/materialização | serviço de checklist | itens novos recebem `card.responsavelId` | responsável visível imediatamente |
| Item exclusivo | Server Action autorizada | item novo recebe `card.responsavelId` | mesmo padrão dos templates |
| Transferência | Server Action + Zod + ownership + vínculo | atualiza `responsavelId` com CAS | escolha persiste no reload |
| Escrita efetiva | transação do checklist | histórico + reconciliação de tarefa | rastreabilidade e dono coerente |
| Pós-commit | realtime do pipeline | `TAREFA_ALTERADA` | demais sessões recarregam |

## Riscos e rollback funcional

- O serviço e a action possuem alterações concorrentes do RM-2026-0FC47A para tarefas derivadas; os patches desta story devem ser mínimos e preservar a reconciliação existente.
- A alteração é prospectiva. Não haverá backfill, rematerialização nem update em massa.
- Um membro removido pode permanecer como responsável histórico de um item, mas deixa de ser candidato a novas transferências; esse comportamento legado não será ampliado aqui.
- Rollback funcional: remover somente a cópia de `card.responsavelId` nos dois produtores restaura a criação sem padrão, sem alteração de dados históricos.

## Fora de escopo

- Nova coluna no checklist, migration, seed ou backfill.
- Responsável único no cabeçalho do checklist ou transferência em lote.
- Reatribuir itens quando o responsável principal do card mudar.
- Alterar a política de membros, perfis, visibilidade ou ownership do CRM.
- Promover para produção.

## Critérios de aceite e regressão

- [x] Itens de template recém-materializados recebem o responsável principal atual do card.
- [x] Item exclusivo recém-criado recebe o mesmo responsável padrão.
- [x] Item pode ser transferido ao responsável principal ou a um membro válido do card.
- [x] Usuário não vinculado é rejeitado por chamada direta ao backend.
- [x] `Sem responsável` continua permitido e persiste.
- [x] Reabrir/recarregar o card preserva a responsabilidade gravada.
- [x] Template já materializado não é recriado nem reatribui seus itens.
- [x] Troca posterior do responsável principal não sobrescreve item existente.
- [x] Transferência mantém CAS, histórico, reconciliação da tarefa e um único sinal realtime.
- [x] Interface comunica responsável e bloqueia nova interação no item durante o salvamento.
- [x] Regressões de checklist e tarefa derivada permanecem verdes.

## Gate de banco

`DATABASE_CHANGE_NOT_REQUIRED`: `BpmCardChecklistItem.responsavelId`, `BpmCard.responsavelId` e `BpmCardMembro` já atendem ao comportamento. Nenhum arquivo de schema ou migration pertence a esta entrega.

## Checklist de fases

- [x] Fases 0–1 — auditoria e blueprint.
- [x] Fase 2 — story executável criada antes da implementação de produção.
- [x] Fase 3 — `DATABASE_CHANGE_NOT_REQUIRED`.
- [x] Fases 4–5 — backend e interface.
- [x] Fases 6–10 — gates técnico, integração, segurança, revisão e robustez.
- [x] Fases 11–12 — memória, evidências e arquivamento.

## Evidências e File List

### Resultado entregue

- O serviço projeta `BpmCard.responsavelId` e o grava nos itens do snapshot antes da reconciliação da tarefa.
- A action de item exclusivo aplica o mesmo padrão, mantendo autorização fora e dentro da transação.
- A transferência existente foi preservada: responsável principal dispensa lookup adicional; outro usuário precisa ser membro; `null` continua válido; CAS evita escrita perdida.
- Materialização já existente continua sendo ignorada, sem update, backfill ou sobrescrita da responsabilidade persistida.
- O painel resume os responsáveis de cada checklist e bloqueia checkbox, observação e seletor enquanto o item salva.
- Revisão de segurança confirmou Zod, auth, ownership transacional, vínculo de candidatos, histórico e realtime somente em mudança efetiva.
- Revisão arquitetural confirmou uma única fonte de verdade por item e compatibilidade com a tarefa derivada do RM-2026-0FC47A.

### Gates executados em 2026-09-08

| Gate | Resultado | Evidência |
| --- | --- | --- |
| Suíte dirigida ampliada | PASS | 9 arquivos, 40/40 testes |
| ESLint direcionado | PASS | zero erros e avisos nos arquivos da entrega |
| Build de produção | PASS | Next.js/Turbopack compilou e gerou 78 páginas |
| `git diff --check` | PASS | nenhum whitespace inválido |
| `npm run typecheck` global | BASELINE | falhas somente em calendário, documentos, SLA/cadência, configuração de pipeline e script concorrente; nenhum diagnóstico nos arquivos desta RM |
| `npm run lint` global | BASELINE | 2.484 erros e 1.255 avisos preexistentes/externos; lint direcionado limpo |
| `npm test` global | BASELINE | 2.424 aprovados e 69 falhas em 29 arquivos externos; todos os 40 testes relacionados passaram depois do gate |

### File List

- `src/lib/bpm/checklists/service.ts`
- `src/actions/bpm/Checklists.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistsCard.tsx`
- `tests/bpm/checklists-service.test.ts`
- `tests/bpm/checklists-card-actions.test.ts`
- `tests/bpm/checklists-entrega-shell.test.ts`
- `.bibble/memory/architecture.md`
- `.bibble/memory/components.md`
- `.bibble/memory/decisions.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/journal.md`
- `docs/stories/story-rm-2026-24157f-responsavel-checklist.md`

Os hunks de reconciliação de tarefa já presentes em `service.ts`, `Checklists.ts` e seus testes pertencem ao RM-2026-0FC47A e foram preservados. `prisma/schema.prisma` e a migration concorrente desse objetivo não fazem parte desta entrega.
