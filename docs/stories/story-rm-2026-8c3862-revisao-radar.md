# Story — RM-2026-8C3862: Configuração integral do pipeline Revisão de Radar

## Status

Concluída — aguardando validação em testes.

## Contexto

O diagnóstico de 2026-09-05 identificou divergências entre a configuração exibida, a persistência e o runtime do pipeline `Revisão de Radar` (`cmsd9yvb90000dzggt1gjl980`). O RM-2026-9E89F2 já estabilizou as mutations imediatas, a auditoria transacional, o agregado de campos, a fonte `BpmCampoEtapaConfig`, a semântica de transições e o editor operacional de SLA. Esta story preserva essa base e conclui as lacunas restantes sem fragmentar o objetivo.

## Artefato, consumidor e acesso

- Artefato: workspace administrativo integral e diagnóstico CLI somente leitura.
- Consumidor: administrador autenticado e autorizado do Alpha CRM.
- Rota: Alpha CRM → Configurações → Pipelines → Revisão de Radar → `/PainelAlpha/AlphaCRM/admin/pipelines/cmsd9yvb90000dzggt1gjl980`.
- Persistência: ações server-side autorizadas e transações Prisma; runtime continua consumindo as mesmas entidades canônicas.

`DELIVERY_READY`: rota, navegação, sessão, papel administrativo, página server-side e agregado atual existem.

`AUTO_ADJUSTMENT_REQUIRED`: faltam diagnóstico CLI/gate de compatibilidade, workspace navegável por assunto, visão de saúde, estado de versão/alterações e publicação protegida contra snapshot obsoleto.

`AUTO_ADJUSTMENT_ACCEPTANCE`: administrador acessa a rota real, identifica problemas, navega pelas seis áreas, altera ou descarta o rascunho e publica com CAS; reload apresenta o agregado confirmado, enquanto CLI e testes derivam o diagnóstico do banco.

## Estado revalidado em 2026-09-08

- 9 etapas ativas; `Novos leads` inicial.
- `Fechado`, `Lost` e `Sem viabilidade` finais.
- 72 transições explícitas: 52 permitidas e 20 bloqueadas.
- 29 campos, 28 ativos e 27 configurações modernas por etapa.
- Nenhum `BpmSlaConfig` no pipeline.
- As nove estruturas canônicas verificadas estão presentes no banco ativo.
- `Regime tributário` usa `CLIENTE.regimeTributario` e é somente leitura.
- `Radar atual` e `Status da sede` são compartilhados com o pipeline Operacional e não possuem catálogo.

## Decisões administrativas aprovadas

1. Preservar `Novos leads` como inicial.
2. Preservar `Fechado`, `Lost` e `Sem viabilidade` como finais.
3. Preservar as 52 arestas permitidas e as 20 bloqueadas atuais.
4. Novas etapas materializam arestas bloqueadas por padrão.
5. Manter `Regime tributário` canônico e somente leitura.
6. Desativar `Radar atual` e `Status da sede` até que exista catálogo aprovado, aceitando o impacto nos pipelines associados.
7. Usar publicação com controle de concorrência sobre a versão do agregado e auditoria, sem migration.

## Fontes canônicas e invariantes

- `BpmCampoEtapaConfig` define aplicabilidade, ordem, visibilidade e obrigatoriedade por etapa.
- `BpmSlaConfig` é a única fonte operacional de SLA; `BpmEtapa.slaDias` é legado somente leitura.
- `BpmTransicaoEtapa` define toda aresta; ausência significa não configurada.
- Mutação de domínio e `BpmPipelineConfigAuditoria` confirmam ou revertem juntas.
- Toda escrita exige sessão, permissão do pipeline, Zod e revalidação dentro da transação.
- Campo compartilhado sempre exibe origem e impacto; alteração não pode ocorrer por mass assignment.
- Logs e CLI não expõem tokens, URLs de banco, conteúdo de campos ou dados pessoais.
- Nenhuma migration, schema change, seed, backfill ou mutação em massa integra esta entrega.

## Requisitos funcionais

- Diagnóstico CLI por pipeline, em texto e JSON, com gate de schema somente leitura.
- Cabeçalho do workspace com saúde derivada, versão carregada e estado `Salvo`, `Alterações pendentes`, `Salvando` ou `Conflito`.
- Navegação: Visão geral, Etapas e fluxo, Campos e formulários, SLA, Permissões e Histórico.
- Etapas e transições com semântica explícita, edição confirmável e rollback.
- Tabela de campos derivada do agregado completo, sem seletor singular legado.
- SLA com prioridade, compatibilidade de gatilho, sobreposição e simulação real.
- Publicação atômica com CAS; snapshot obsoleto é recusado e oferece recarga segura.
- Estados loading, erro, vazio, sucesso e conflito; controles acessíveis por teclado e responsivos.

## Segurança

- Impedir IDOR por troca de `pipelineId` e alteração de pipeline não autorizado.
- Validar versão, IDs e payload completo no servidor.
- Não confiar em estado do client para ownership, campo compartilhado ou opções válidas.
- Auditar somente metadados/diff sanitizado.

## Gate Vault

`DATABASE_CHANGE_NOT_REQUIRED`: schema e tabelas canônicas já estão compatíveis. O versionamento utilizará o `updatedAt` do pipeline como token CAS atualizado na publicação. A desativação dos dois campos é CRUD administrativo normal, explicitamente aprovado, auditado e transacional; não há migration, backfill ou operação em massa.

## Critérios de aceite

- [x] CLI diagnostica qualquer pipeline sem escrever e oferece JSON sanitizado.
- [x] Gate detecta ausência de estruturas canônicas e passa no banco ativo compatível.
- [x] Workspace amplo possui seis áreas e saúde derivada.
- [x] Rascunho pode ser descartado ou publicado com CAS e auditoria.
- [x] Snapshot obsoleto não sobrescreve publicação concorrente.
- [x] Etapas inicial/finais e transições aprovadas permanecem inalteradas.
- [x] Novas etapas usam arestas bloqueadas.
- [x] A publicação aprovada desativa `Radar atual` e `Status da sede`; `Regime tributário` permanece canônico.
- [x] Campos usam `BpmCampoEtapaConfig` e preservam relações na segunda edição.
- [x] SLA usa somente `BpmSlaConfig` e rejeita combinação incompatível.
- [x] Permissões e histórico são representados sem alterar sua autoridade.
- [x] Falha de mutation restaura o estado confirmado.
- [x] Rota e ações permanecem protegidas.
- [x] Gates técnicos e fluxo integrado são comprovados.

## Matriz inicial de rastreabilidade

| Achado | Autoridade | Correção/validação |
| --- | --- | --- |
| Auditoria divergente | transação Prisma | helper recebe `tx`; testes forçam rollback |
| Campos em grupos falsos | `BpmCampoEtapaConfig` | tabela e contadores derivados do agregado |
| SLA duplo | `BpmSlaConfig` | `slaDias` somente leitura |
| Estado otimista stale | retorno da action | busy, resultado explícito e rollback |
| Campo perde relações | include administrativo | agregado completo após create/update |
| Aresta ausente parece permitida | `BpmTransicaoEtapa` | estado “Não configurada”; nova aresta bloqueada |
| Configuração concorrente | `BpmPipeline.updatedAt` | publicação CAS + auditoria |
| Schema incompatível | `sqlite_master`/Prisma | CLI read-only e gate automatizável |

## Fases

- [x] 0 — auditoria de contexto e entregabilidade.
- [x] 1 — blueprint e mapa de integração.
- [x] 2 — checkpoint administrativo aprovado.
- [x] 3 — story executável criada.
- [x] 4–5 — Vault e compatibilidade de banco.
- [x] 6 — diagnóstico CLI.
- [x] 7–9 — estabilização, fontes canônicas e feedback.
- [x] 10–11 — especificação e implementação do workspace.
- [x] 12–16 — gates, E2E, segurança, arquitetura e robustez.
- [x] 17–18 — consolidação e encerramento.

## Especificação UX entregue

- Workspace largo, cabeçalho persistente com versão, saúde e estado da publicação.
- Oito áreas navegáveis: visão geral, etapas, campos, card, SLA, automações, permissões e histórico.
- Tabelas e matrizes preservam navegação horizontal em telas estreitas; drawers e formulários mantêm rótulos, foco e operação por teclado.
- Campos inválidos são identificados no resumo e podem receber em rascunho as correções administrativas aprovadas antes da publicação.
- Estados vazio, carregando, erro, alteração pendente, salvando e conflito possuem mensagem textual, sem depender apenas de cor.

## Implementação e validação

O diagnóstico somente leitura confirmou as nove estruturas canônicas, nove etapas, 72 arestas explícitas (52 permitidas e 20 bloqueadas) e nenhuma configuração de SLA. O agregado completo inclui campos compartilhados e por isso totaliza 31 associações, enquanto a auditoria simples inicial contabilizava 29 campos proprietários; a diferença é intencional e rastreável.

A publicação recebe o snapshot completo, repete autorização e ownership na transação, exige os conjuntos exatos de IDs, valida fluxo/seleções e usa `BpmPipeline.updatedAt` como CAS. A auditoria armazena versão anterior/nova, IDs e contagens alteradas, sem payload de negócio. A correção de `Radar atual` e `Status da sede` é preparada pelo comando autenticado do administrador; não houve mutation direta pelo terminal, pois isso forjaria o `adminId` da auditoria. Testes de publicação comprovam que somente esses dois campos são desativados e que etapas/transições permanecem idênticas.

A simulação de SLA reutiliza o mesmo resolvedor do runtime e não cria instância, evento ou disparo. Não houve migration, seed, backfill ou promoção de ambiente.

### Gates executados

- 86/86 testes focados aprovados em 11 arquivos.
- ESLint direcionado sem erros e `git diff --check` limpo.
- Build de produção aprovado, com 78 páginas geradas.
- Smoke HTTP: rota administrativa sem sessão respondeu `307` para `/`; raiz respondeu `200`.
- CLI real com `--check-schema`: schema 9/9 compatível.
- Suíte global: 2.512/2.566 testes aprovados; as 54 falhas estão em contratos legados ou módulos concorrentes externos a esta story. O typecheck direcionado não apontou diagnóstico nos arquivos entregues; lint/typecheck globais conservam débitos preexistentes documentados.

### Revisão de segurança e arquitetura

- IDOR: sessão, papel administrativo, acesso ao pipeline, card e tarefa são revalidados no servidor.
- Concorrência: snapshot obsoleto falha fechado por CAS e solicita recarga.
- Mass assignment: IDs precisam coincidir exatamente com o agregado persistido; ownership e endpoints não são editáveis pelo payload.
- Dados compartilhados: o impacto é visível e a alteração aprovada é explícita.
- Privacidade: diagnóstico, logs e histórico administrativo não expõem valores brutos, PII ou segredos.
- Arquitetura: não há segunda fonte de etapa, campo, transição ou SLA; diagnóstico, editor e runtime consomem as entidades canônicas existentes.

### Casos de borda cobertos

Versão stale; IDs ausentes, extras ou duplicados; múltiplas etapas iniciais; ausência de etapa final; etapa ativa inalcançável; transição inativa ou com endpoint inválido; seleção ativa sem catálogo; tabela canônica ausente; ausência de SLA; card/tarefa de outro pipeline; falha de notificação após commit.

## File List entregue

- `scripts/diagnosticar-pipeline-bpm.ts`
- `src/lib/bpm/pipeline-config-diagnostico.ts`
- `src/lib/bpm/pipeline-config-publicacao.ts`
- `src/actions/bpm/ConfiguracaoPipeline.ts`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/page.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx`
- componentes do workspace na mesma pasta administrativa.
- testes BPM direcionados.
- memórias Bibble e esta story.

Arquivos concorrentes já modificados no worktree foram preservados; esta story integrou apenas os trechos necessários ao objetivo.
