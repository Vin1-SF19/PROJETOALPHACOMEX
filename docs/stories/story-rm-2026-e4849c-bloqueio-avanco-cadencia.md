# RM-2026-E4849C — Cadência por coluna sem bloqueio de avanço

## Status

Pronto para testes.

## História

Como operador do Alpha CRM, quero que a cadência seja definida pela coluna atual do card e funcione somente como orientação operacional, para que tarefas e alertas sejam gerados sem impedir a movimentação do card.

## Diagnóstico e caminho de consumo

O bloqueio fixo de oito contatos era aplicado tanto na prévia de requisitos de `Cards.ts` quanto no comando transacional `transicao-command.ts`, e o board ainda comunicava essa regra. O domínio já possui `BpmCadencia.pipelineId`, `BpmCadencia.etapaId`, passos, vínculos e execuções idempotentes; não é necessária alteração de schema.

O resultado é consumido em:

- `Configurações → Pipelines → Configurar Pipeline`, onde cada coluna seleciona uma cadência ou “Nenhuma cadência”;
- `/PainelAlpha/AlphaCRM/admin/cadencias`, para criar e editar as definições e seus passos;
- `Pipeline → Card → Cadências`, para visualizar orientação, próxima execução e histórico;
- cron/CLI de cadências, que geram tarefas e alertas sem participar da decisão de movimento.

`AUTO_ADJUSTMENT_REQUIRED`: o editor do pipeline ainda não expõe a associação por coluna e o painel do card consulta opções por uma action restrita a administradores.

`AUTO_ADJUSTMENT_ACCEPTANCE`: um administrador configura a coluna, a seleção persiste, um card nessa coluna recebe a cadência correspondente e continua podendo avançar com zero contatos quando as demais regras permitirem.

## Invariantes

- A cadência operacional é resolvida somente por `pipelineId + etapaId` da coluna atual, sem fallback universal.
- Cada coluna admite no máximo uma cadência ativa efetiva ou nenhuma.
- Uma coluna sem cadência não gera alerta de cadência e não produz erro.
- Cadência produz orientação, tarefas e alertas; nunca é requisito de avanço.
- Zero, um ou oito contatos não mudam a autorização de movimento.
- Permissão, ownership, transições, data/hora de reunião, transcrição, checklists, campos e regras independentes continuam válidos.
- Cadências legadas sem etapa permanecem inertes até associação explícita ou desativação.
- Ao trocar de coluna, vínculos incompatíveis são encerrados e somente a cadência da coluna de destino pode iniciar.
- Retry do executor não duplica tarefa, histórico ou alerta.

## Blueprint técnico

1. Remover a guarda fixa dos oito contatos da prévia, do comando canônico e do texto transitório do board.
2. Consolidar a sincronização pós-movimento em um único serviço best-effort, cancelando vínculos de outra etapa e resolvendo apenas a etapa de destino.
3. Validar escopo e cardinalidade nas actions administrativas dentro de transação; ativação universal é inválida.
4. Validar escopo novamente no início/reativação de vínculo e no executor, inclusive contra corrida com movimento do card.
5. Usar a identidade do ciclo de entrada na chave idempotente da execução.
6. Adicionar o seletor “cadência ou nenhuma” por coluna no editor real do pipeline e ajustar o editor global para exigir pipeline e coluna.
7. Manter o painel do card informativo, sem seleção arbitrária de cadência de outro escopo nem linguagem bloqueante.

## Matriz de integração

| Origem | Autoridade | Persistência/efeito | Resultado |
| --- | --- | --- | --- |
| Configuração do pipeline | Server Action admin + Zod | `BpmCadencia.pipelineId/etapaId/ativa` | uma ou nenhuma por coluna |
| Drag/modal do card | `executarTransicaoBpm` | movimento, histórico, outbox e SLA | movimento independente da cadência |
| Pós-movimento | serviço de cadência best-effort | encerra vínculo anterior e inicia o exato | alerta não reverte movimento |
| Cron/CLI | executor de cadências | execução idempotente + `BpmTarefa` | somente orientação operacional |
| Aba Cadências | action autorizada pelo card | leitura de vínculos | loading, vazio, erro e sucesso |

## Riscos e rollback funcional

- Concorrência sem índice parcial: as actions serializam a validação e rejeitam ambiguidade; o resolvedor também falha de forma segura, iniciando nenhuma.
- Registro legado universal: não haverá backfill nem exclusão; ele será exibido como pendente de associação e ignorado operacionalmente.
- Falha no motor: sincronização pós-movimento é best-effort e o executor revalida o escopo antes de gerar tarefa.
- Rollback: desativar a cadência da coluna restaura o estado “nenhuma”; o código anterior não deve ser restaurado porque recolocaria o bloqueio universal.

## Fora de escopo

- Migration, constraint, seed, backfill ou mutação em massa.
- Excluir tarefas ou históricos já produzidos.
- Remover regras de negócio independentes da cadência.
- Enviar automaticamente ligações, WhatsApp ou e-mails; os passos continuam gerando tarefas.
- Promover para produção.

## Critérios de aceite e regressão

- [x] Administrador associa uma cadência válida ou nenhuma a cada coluna no editor do pipeline.
- [x] Criação, edição e ativação rejeitam escopo inválido e segunda cadência ativa na mesma coluna.
- [x] Cadência de outra coluna/pipeline e legado sem etapa não são executados.
- [x] Zero, um e oito contatos permitem o mesmo movimento quando as demais guardas permitem.
- [x] Chamada direta ao backend não retorna `CONTACT_SEQUENCE_REQUIRED`.
- [x] Troca de coluna encerra o vínculo incompatível e inicia, quando existir, apenas o da coluna de destino.
- [x] Coluna sem cadência não gera alerta fantasma.
- [x] Retry/concorrência não duplica tarefa, histórico ou alerta.
- [x] Usuário sem permissão administrativa não configura cadência e usuário sem permissão de mover não avança o card.
- [x] Data/hora, transcrição, checklist, campos, regras, visibilidade e ownership permanecem protegidos.
- [x] Interfaces cobrem loading, erro, vazio e sucesso sem linguagem de bloqueio por cadência.

## Gate de banco

`DATABASE_CHANGE_NOT_REQUIRED`: `BpmCadencia.etapaId`, os vínculos e a chave idempotente existentes atendem ao objetivo. Nenhum arquivo de schema ou migration pertence a esta entrega.

## Checklist de fases

- [x] Fases 0–1 — auditoria e blueprint.
- [x] Fase 2 — story executável criada antes da implementação de produção.
- [x] Fase 3 — `DATABASE_CHANGE_NOT_REQUIRED`.
- [x] Fases 4–5 — backend e interface.
- [x] Fases 6–10 — gates técnico, integração, segurança, revisão e robustez.
- [x] Fases 11–12 — memória, evidências e arquivamento.

## Evidências e File List

### Resultado entregue

- A antiga guarda fixa de oito contatos foi removida da prévia, do comando canônico e do board. As demais guardas continuam no mesmo comando transacional.
- O serviço `ativacao-automatica.ts` encerra vínculos incompatíveis e resolve exclusivamente uma cadência ativa em `pipelineId + etapaId`; legado sem coluna fica inerte e ambiguidade inicia nenhuma.
- A sincronização acontece depois do commit do movimento/criação e é best-effort, portanto falha da cadência não reverte o card.
- O executor revalida card, pipeline, etapa e definição ativa antes de criar tarefa; a chave inclui o ciclo de entrada e colisão `P2002` é idempotente.
- O editor real do pipeline ganhou o seletor por coluna com “Nenhuma cadência”; o cadastro global agora exige pipeline e etapa, e o painel do card ficou informativo, sem início/pausa/reativação arbitrários.
- Actions administrativas validam inputs com Zod, repetem autorização dentro das transações e protegem alteração/reordenação dos passos; transações de cardinalidade usam isolamento serializável.

### Gates executados em 2026-09-08

| Gate | Resultado | Evidência |
| --- | --- | --- |
| Suíte direcionada | PASS | 7 arquivos, 37/37 testes |
| ESLint direcionado | PASS | 0 erros; 1 aviso preexistente em `Cards.ts` |
| Build | PASS | Next.js/Turbopack compilou e gerou 78 páginas |
| `git diff --check` | PASS | sem whitespace inválido |
| `npm run typecheck` | BASELINE | falhou somente fora dos arquivos da RM (calendário, gerador de documentos, rota Exclusão Fiscal e script de checklist) |
| `npm run lint` global | BASELINE | 2.484 erros e 1.255 avisos já espalhados pelo repositório/AIOX; nenhum erro no lint direcionado |
| `npm test` global | BASELINE | 2.435 aprovados, 50 falhas em 19 arquivos externos; todas as 37 verificações da RM passaram novamente após o gate |

### File List

- `src/lib/bpm/cadencias/ativacao-automatica.ts` (novo)
- `src/lib/bpm/cadencias/{executor,schemas}.ts`
- `src/lib/bpm/{transicao-command,agendar-reuniao,automacao-novos-leads,automacoes}.ts`
- `src/lib/bpm/automacoes/{central-runtime,distribuicao-oportunidades}.ts`
- `src/actions/bpm/{Cadencias,Cards,NolossLeads}.ts`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/{CadenciaEtapasSection,AdminPipelineClient,page}.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `src/components/bpm/cadencias/{CadenciaFormDialog,CadenciasWorkspace,PainelCadenciasCard}.tsx`
- `src/components/bpm/cadencias/types.ts`
- `tests/bpm/{agendar-reuniao,cadencias-actions,cadencias-actions-automaticas,cadencias-ativacao-automatica,cadencias-executor,cadencias-por-coluna,cadencias-ui-automatica}.test.ts`
- `.bibble/memory/{architecture,components,decisions,integration-points,journal}.md`
- `docs/stories/story-rm-2026-e4849c-bloqueio-avanco-cadencia.md`
