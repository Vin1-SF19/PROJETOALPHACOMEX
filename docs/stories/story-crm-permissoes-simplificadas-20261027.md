# Story: permissões simples por setor ou usuário e funil no CRM

<!-- Source: pedido explícito do usuário em 2026-10-27 -->
<!-- Context: substituição brownfield das configurações de acesso do Alpha CRM -->

## Status

Ready for Review — implementação validada em `staging`; integração seletiva em `main` e push de `main` autorizados posteriormente pelo usuário, conforme registro ao final.

executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["revisão de autorização", "testes unitários e de integração", "lint", "typecheck", "build"]

## Story

Como administrador do Alpha CRM, quero escolher um setor ou usuário, escolher o funil e liberar acesso comum ou administrativo, para configurar permissões de forma clara e direta.

O pedido exige substituir o estilo de configuração anterior, eliminar código morto e manter a visibilidade de colunas. Acesso administrativo significa administrar os cards do funil, incluindo movimentação livre, edição e atribuição. Não implica transformar a pessoa em administradora global do sistema.

## Context Source

- Fonte funcional: solicitação atual do usuário; substitui a experiência de permissões anterior.
- Referência brownfield: `docs/stories/story-alpha-crm-acesso-individual-pipeline.md`, especialmente os guards centrais, auditoria e controle de versão já existentes.
- Contexto anterior: autorização individual de entrada complementava os setores e não concedia edição de terceiros. Esta story acrescenta o nível administrativo explícito por funil.
- Não foi identificado epic específico ou `accumulated-context.md` aplicável. A story é independente e não cria epic ou requisitos adicionais.
- Ambiente de desenvolvimento: branch `staging`; preservar alterações alheias presentes no workspace.
- Restrição inicial: **não executar commit nem push**; substituída pelo pedido posterior de commit em staging/main e push somente de main. Nenhuma alteração de configuração ou mutação em banco remoto foi autorizada nem executada.

## Acceptance Criteria

1. **Liberação direta:** a configuração apresenta um fluxo compreensível para escolher tipo de destinatário (setor ou usuário), selecionar o destinatário e o funil, selecionar o nível de acesso e salvar. A configuração deixa claro a quem e a qual funil cada liberação pertence.
2. **Gestão das liberações:** permissões salvas são exibidas com destinatário, funil e nível. O administrador consegue conceder, alterar e remover acesso. Duplicidades do mesmo destinatário no mesmo funil não geram entradas conflitantes.
3. **Acesso comum:** uma concessão por setor libera integrantes elegíveis desse setor; uma concessão por usuário funciona independentemente do setor. O acesso comum respeita as regras de ação por vínculo/card e de visibilidade de coluna existentes.
4. **Acesso administrativo ao funil:** uma concessão administrativa por setor ou usuário permite agir sobre os cards daquele funil, inclusive editar, atribuir e mover livremente, sem depender de ser responsável ou participante. A concessão é limitada ao funil e não concede administração global nem permissão de conceder acesso a outros usuários.
5. **Composição e revogação:** se existirem concessões por setor e por usuário, o acesso efetivo reflete as concessões aplicáveis, prevalecendo o nível administrativo quando presente. Remover ou rebaixar uma concessão elimina apenas o acesso decorrente dela; outras concessões válidas continuam aplicáveis. Conta inativa ou sem acesso ao módulo CRM não ganha acesso por uma concessão ao funil.
6. **Visibilidade por coluna:** manter a configuração de visibilidade de colunas e seu funcionamento para o acesso comum. Os privilégios administrativos do funil são explicitamente considerados pelos guards e pela interface, com comportamento consistente ao abrir, editar e movimentar cards.
7. **Autorização real:** o servidor valida sessão, autoridade para configurar, tipo e identificadores do destinatário, existência/elegibilidade do setor ou usuário, funil e nível. Listagens, entrada por URL, quadro, detalhes dos cards e operações de edição, atribuição e movimentação usam a mesma decisão de acesso. Não confiar em flags enviadas pelo navegador.
8. **Persistência e concorrência:** publicar permissões usa o controle de versão e a auditoria do pipeline. Um conflito de versão não salva alterações parciais. Revogação e concessão atualizam a navegação e o quadro pelos mecanismos existentes de revalidação/notificação.
9. **Substituição completa:** remover a interface, controladores, exports, tipos, utilitários, estilos exclusivos e testes obsoletos que perderem seus consumidores. Não deixar painéis antigos ocultos, caminhos alternativos de edição ou APIs antigas sem uso sustentando o modelo substituído. Componentes compartilhados e regras ainda necessárias, como visibilidade de colunas, permanecem em uso.
10. **Estados de interface:** contemplar carregamento, erro com recuperação, lista vazia, salvamento em andamento, confirmação de sucesso e conflito. Controles têm rótulos acessíveis, funcionam por teclado e seguem o tema claro/escuro próprio do CRM.
11. **Validação e limites:** executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`, além dos testes dirigidos de autorização. Registrar resultados reais e limitações. Concluir com checklist e file list efetivos atualizados e informar ao usuário o que foi feito, sem commit ou push.

## Tasks / Subtasks

- [x] Revisar a arquitetura do contrato único de acesso, persistência e limites administrativos (AC 3–9).
- [x] Completar a integração de todos os consumidores do blueprint Scout (AC 3–9).
- [x] Definir representação das concessões por setor/usuário e nível administrativo usando a infraestrutura existente (AC 2–8).
- [x] Implementar resolvedor central e integrar listagens, entrada no funil e ações de card (AC 3–7).
- [x] Implementar leitura/gravação administrativa com validação, CAS, auditoria e notificação (AC 2, 7, 8).
- [x] Substituir a experiência de permissões pelo fluxo de destinatário → funil → nível e sua lista de liberações (AC 1, 2, 10).
- [x] Preservar e integrar visibilidade de colunas (AC 6).
- [x] Remover caminhos e código antigos sem consumidores e atualizar testes afetados (AC 9).
- [x] Cobrir concessão, revogação, níveis, escopo de funil, privilégios e conflitos com fixtures sintéticas (AC 3–8).
- [x] Executar lint, typecheck, build e revisão de integração/autorização locais (AC 7, 11).
- [x] Registrar resultado da última suite global sequencial: 729 arquivos e 5.607 testes aprovados, 4 ignorados e 1 todo (AC 11).
- [x] Atualizar checklist, file list efetiva e evidências locais, preservando a proibição de commit/push (AC 11).

## Dev Notes

### Pontos de integração implementados

- `src/app/PainelAlpha/AlphaCRM/admin/page.tsx` protege a entrada administrativa e carrega a lista de funis.
- `src/app/PainelAlpha/AlphaCRM/admin/AdminPipelinesListClient.tsx` abre na aba **Configurações** com o gerenciador de acessos; a aba **Funis** mantém criação, renomeação, ordenação, ativação e entrada no editor. Criação e renomeação não editam setores.
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AcessosPipelineSection.tsx` é o único componente de edição de acesso, usado na central com seleção de funil e no editor com funil fixo. Usa React Query, RHF e Zod, salva concessão/rebaixamento/revogação com CAS e conserva destinatário/nível quando troca o funil.
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx` integra o novo componente e mantém `VisibilidadeEtapasSection.tsx` e a configuração de distribuição de closers.
- `src/actions/bpm/AcessosPipeline.ts` oferece `LerAcessosPipelineBpm` e `SalvarAcessosPipelineBpm`. Revalida autoridade global na transação, valida destinatários, usa `configVersion`, grava auditoria/espelho de setores e notifica o pipeline.
- `src/lib/bpm/acesso-pipeline.ts` concentra concessões `SETOR`/`USUARIO` × `PADRAO`/`ADMINISTRATIVO`, composição, validação, escrita e leitura de transição dos dados existentes.
- `src/lib/bpm/ownership.ts` concentra acesso por pipeline/card e elegibilidade. `isAdminPipeline` permanece separado de `isAdminGlobal`, e o papel de card `ADMINISTRADOR` é aplicado à autorização dentro do funil.
- `src/actions/bpm/Pipelines.ts` cria funis com lista explícita vazia e renomeia sem reescrever ACL. `ObterPipelineBpm` filtra colunas/transições pelo papel persistido e acesso administrativo; remove o JSON de ACL e regras de coluna do DTO.
- Quadro/cards, agregados (Dashboard, Empresas e Tarefas), arquivados, jornada, membros, Meet, notas fiscais, integração de leads e comandos de transição usam os novos resolvedores/capacidades nos pontos afetados.
- A UI e actions antigas de visibilidade do pipeline, os helpers `acesso-individual-pipeline.ts` e `lideranca-setor.ts`, o esquema de supervisores e o export `ListarSetoresParaPipelineBpm` foram removidos. `visao-equipe.ts` mantém somente tipos/filtros do quadro ainda consumidos.

### Arquitetura e decisões delimitadas

- [AUTO-DECISION] Usar story própria para o pedido atual, sem novo epic: a fonte é a solicitação explícita e as referências são implementação e stories reais.
- [AUTO-DECISION] O acesso administrativo solicitado é do pipeline: não concede administração global, configuração geral ou gestão das próprias permissões.
- [AUTO-DECISION] No novo contrato explícito, ausência de concessões não deve significar acesso aberto a todos. Um leitor mínimo dos dados anteriores preserva somente o acesso base até a publicação das novas permissões; não concede administração implícita.
- [AUTO-DECISION] Não criar dependência, papel global ou variável de ambiente adicional sem necessidade demonstrada. O blueprint técnico orientou os arquivos e consumidores efetivamente alterados.
- A implementação da regra central e sua validação por CLI/testes precedem a UI, seguindo `CLI First → Observability Second → UI Third`.
- O tema próprio do CRM remapeia classes da paleta; consultar `.bibble/rules/styling-rules.md` antes de alterar componentes.
- Qualquer necessidade de alteração estrutural, migration, seed/backfill ou mutação em massa exige Vault, backup válido, relatório e confirmação explícita do usuário antes de execução, conforme `AGENTS.md`. Esta story não autoriza tais operações.

### Arquitetura aprovada pelo fluxo principal

- Centralizar o novo contrato em `src/lib/bpm/acesso-pipeline.ts`: concessões por ID de setor ou usuário, com nível `PADRAO` ou `ADMINISTRATIVO`, persistidas no JSON existente do pipeline.
- Manter `BpmPipelineSetor` como espelho dos setores concedidos para os consumidores que necessitam dessa relação; não adicionar tabelas/colunas nem executar migration/backfill remoto.
- Retirar os escritores e interfaces da configuração anterior de supervisão. O leitor mínimo dos dados existentes é código ativo de transição, necessário para não perder acesso base antes de uma publicação; não manter formulários ou caminhos antigos de edição.
- Administrador de pipeline continua com `isAdminGlobal=false`. Guard de configuração global permanece exclusivo para administrador global.
- A movimentação administrativa reutiliza o mecanismo existente de reposicionamento livre, mantendo a integridade de cards encaminhados.
- Logs e artefatos grandes de verificação devem ficar em `~/work-tmp`, evitando `/tmp` e `/dev/shm`.

## Testing

- Unitários do contrato: destinatários/tipos/níveis válidos e inválidos; duplicidades; listas vazias; configuração inválida sem concessão; composição setor/usuário; prevalência administrativa; escopo de pipeline.
- Guards: setor autorizado; usuário autorizado fora do setor; usuário inativo/sem CRM; terceiro sem vínculo com acesso comum; administrador de funil com ações liberadas; ausência de privilégio em outro funil; ausência de ganho de administração global.
- Movimentação: acesso comum mantém limites; concessão administrativa habilita movimentação livre, inclusive quando não houver vínculo com o card; revogação retira esse privilégio.
- Actions: ator sem autoridade recusado, IDs inexistentes ou inelegíveis recusados, alteração/removal persistidos, conflito de versão sem gravação parcial e auditoria da concessão.
- React/integrados: selecionar setor/usuário e funil, escolher nível, salvar, listar, alterar, remover, recuperar erro e preservar visibilidade por coluna.
- Regressão: navegação/listagens/URL e ações usam o mesmo acesso; busca por imports/exports confirma remoção do fluxo obsoleto. Usar fixtures sintéticas e mocks locais sem credenciais ou dados reais.
- Quality gates obrigatórios: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`; registrar falha de baseline ou de ambiente com a evidência, sem declarar aprovação inexistente.

## Risk Assessment

O risco principal é a autorização divergir entre o quadro e as ações do servidor, liberando direitos além do pipeline ou impedindo a revogação efetiva. Mitigar com contrato central, matriz de testes de autorização e revisão de todos os consumidores levantados pelo Scout.

Remover caminhos antigos requer busca de referências e atualização dos testes que expressem o modelo substituído. Não remover recursos compartilhados ou alterações alheias do workspace.

Rollback de código: separar os arquivos desta story na revisão e reverter somente essas mudanças, preservando o restante do workspace. Não executar rollback de dados ou converter dados em massa nesta entrega. A adoção futura em staging deve tratar eventual reversibilidade do formato persistido antes de publicação.

## 🤖 CodeRabbit Integration

### Story Type Analysis

Primary Type: Security. Secondary Types: Frontend, API, Integration. Complexity: High. Risk Level: HIGH RISK, por alterar autorização de pipeline e operações sobre cards.

Integration Points: configuração administrativa, resolvedor de acesso, listagens/entrada, quadro/card, movimentação/edição/atribuição, auditoria/realtime e visibilidade de colunas.

### Specialized Agent Assignment

Primary: @dev e @architect. Supporting: @ux-design-expert para acessibilidade/consistência da UI; @qa para autorização e regressão. Vault somente se surgir necessidade de operação coberta pela política de banco.

### Quality Gate Tasks

- [x] Revisão local de qualidade, integração e autorização concluída: Lens/Anubis/Probe aprovaram sem achados bloqueantes ou importantes. CodeRabbit indisponível; não foi declarado executado. A autorização posterior de commit/push consta no registro de integração ao final.
- Pre-PR e Pre-Deployment: não aplicáveis nesta entrega, sem PR/deploy autorizado; não marcar como executados.

### Self-Healing Configuration

@dev: light, até duas iterações/15 minutos, corrigir CRITICAL e documentar HIGH. @qa: full, até três iterações/30 minutos para CRITICAL/HIGH. @devops: check/report only quando houver fluxo futuro autorizado.

### Focus Areas

Escalada de privilégios, isolamento por pipeline, revogação, validação server-side, concorrência/atomicidade, remoção real de legado, integração de colunas, acessibilidade, coerência entre UI e ações, regressão e rollback de código.

## Story Draft Checklist

Aplicação da `.aiox-core/product/checklists/story-draft-checklist.md` ao artefato antes de implementação:

| Categoria | Resultado | Evidência |
| --- | --- | --- |
| Objetivo e contexto | PASS | Pedido, benefício, fluxo e substituição explícitos; story independente |
| Orientação técnica | PASS | Pontos confirmados e contrato comportamental; blueprint detalhado atribuído ao Scout/arquitetura |
| Referências | PASS | Story anterior resumida e caminhos reais com propósito descrito |
| Informação autocontida | PASS | Níveis, composição, revogação, limites e casos de erro explícitos |
| Testes | PASS | Matriz de guard/action/React e gates verificáveis |
| CodeRabbit | PASS | Tipo, risco, responsáveis, gates aplicáveis, self-healing e foco documentados |

Resultado: **READY** para implementação; clareza 9/10. Contrato e persistência definidos pelo fluxo principal; lista exaustiva de consumidores rastreada pelo blueprint Scout. Esta validação documental não atesta testes nem entrega funcional.

## Dev Agent Record

Implementação local concluída em `staging`, com alterações anteriores do workspace preservadas. Nenhum commit, push, deploy, configuração de produção ou mutação em banco remoto foi executado. Não houve alteração de schema, migration ou backfill.

O novo JSON fica em `BpmPipeline.visualizacaoConfigJson.permissoesPipeline`, com `version: 2` e lista `regras`. `BpmPipelineSetor` espelha os setores das concessões. O leitor mínimo conserva o acesso base de dados anteriores até uma publicação, sem conceder administração implícita. A UI avisa quando o funil anterior ainda está aberto a todos, permite publicar lista vazia por **Restringir a administradores** e informa que salvar torna a lista explícita.

Os privilégios administrativos são limitados ao funil e permitem edição, atribuição e movimentação livre nos guards e capacidades do card. A integridade de cards encaminhados permanece: reposicionamento administrativo usa o mecanismo próprio, sem reabrir efeitos irreversíveis ou permitir edição indevida de card concluído/encaminhado. Configuração global e gestão de permissões continuam restritas ao administrador global.

### Evidências de validação local — 2026-10-27

- `npm run lint` FINAL: exit 0, zero erros e 1.175 avisos do repositório após as limpezas. Primeira rodada havia passado com 1.182 avisos.
- `npm run typecheck` FINAL após todas as limpezas: exit 0. Rodada anterior `FINAL-2` também havia passado após atualizar fixtures de capacidades e o mock de `getDraftBase`.
- `npm run build` FINAL: exit 0, executado sob cgroup com `MemoryMax=18G`, com artefatos em disco fora de tmpfs. Ajustes de resolução/cache do ambiente de verificação foram concluídos; avisos existentes de `pdfjs-polyfill` não impediram o build.
- Testes dirigidos de core: 9 arquivos/105 testes; rodada final de core/agregados: 5 arquivos/35 testes; Membros: 9 testes; rodada final de ownership: 3 arquivos/31 testes, todos aprovados. Lint dirigido do core sem erros/avisos.
- Testes dirigidos do novo editor, criação/renomeação e filtragem do DTO: 2 arquivos/14 testes aprovados. Anexos/autorização/NovoCardModal: 3 arquivos/24 testes aprovados. Runtime: 14 arquivos/134 testes aprovados; data-hora: 30 testes; convidados Meet: 2 testes aprovados.
- Primeira suite completa: 724 arquivos passaram e 4 arquivos falharam. Foram corrigidos dois asserts do contrato anterior, um mock ausente de distribuição de closers e um mock incompleto de contexto de salvamento. Não houve contorno no código da aplicação para ocultar essas falhas.
- **Suite global final:** `npm test -- --maxWorkers=2`, sem build/typecheck/lint concorrentes, exit 0: 729 arquivos aprovados, 5.607 testes aprovados, 4 ignorados e 1 todo; duração 90,59 s. As falhas transitórias de CLI nas rodadas sob carga não se repetiram. Cobertura: statements 68,31%, branches 61,10%, functions 75,92%, lines 71,84%. Artefatos temporários removidos após validação; nenhuma configuração de build temporária permanece no projeto.
- Parecer final Lens/Anubis/Probe: aprovado localmente, sem achados bloqueantes ou importantes. Parâmetro morto `ehMembroPipeline` e prop morta `currentUserRole` do layout de card foram removidos, com fixtures ajustadas. CodeRabbit indisponível; revisão real alternativa registrada, sem afirmar execução da ferramenta.
- Smoke HTTP local do artefato compilado: login respondeu 200; rota administrativa CRM sem sessão respondeu 307; servidor de verificação encerrado. Isso verifica disponibilidade/redirect anônimo, não autenticação nem fluxo funcional do CRM.
- `git diff --check` dirigido aprovado. Resultados duráveis constam nesta story; logs/build temporários serão removidos ao final e não são referências de evidência persistente.
- Nenhuma navegação autenticada, publicação em staging/produção ou mutação em banco remoto nesta entrega local. Sem commit nem push.


## File List

### Arquivos criados

- `docs/stories/story-crm-permissoes-simplificadas-20261027.md`
- `src/lib/bpm/acesso-pipeline.ts`
- `src/actions/bpm/AcessosPipeline.ts`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AcessosPipelineSection.tsx`
- `tests/bpm/acesso-pipeline.test.ts`
- `tests/bpm/acesso-pipeline-agregados.test.ts`
- `tests/bpm/acessos-pipeline-actions.test.ts`
- `tests/bpm/acessos-pipeline-config-react.test.ts`
- `tests/bpm/pipelines-criar-editar-acessos.test.ts`

### Arquivos alterados

Lista restrita às mudanças desta entrega; diversos caminhos já tinham alterações de outras tarefas, que foram preservadas.

- `src/lib/bpm/ownership.ts`
- `src/lib/bpm/visao-equipe.ts`
- `src/lib/bpm/visao-equipe-server.ts`
- `src/lib/bpm/transicao-command.ts`
- `src/lib/bpm/cards-no-quadro.ts`
- `src/lib/bpm/contratacao-comercial-server.ts`
- `src/lib/validations/bpm.ts` — somente contratos de criar/atualizar funil.
- `src/actions/bpm/Pipelines.ts`
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/Quadro.ts`
- `src/actions/bpm/Arquivados.ts`
- `src/actions/bpm/Dashboard.ts`
- `src/actions/bpm/Empresas.ts`
- `src/actions/bpm/Tarefas.ts`
- `src/actions/bpm/GoogleMeet.ts`
- `src/actions/bpm/InstagramLeads.ts`
- `src/actions/bpm/Jornada.ts`
- `src/actions/bpm/Membros.ts`
- `src/actions/bpm/NolossLeads.ts`
- `src/actions/bpm/NotaFiscal.ts`
- `src/app/PainelAlpha/AlphaCRM/admin/page.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/AdminPipelinesListClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`
- `tests/bpm/anexos-aba-card-react.test.ts`
- `tests/bpm/arquivados-action.test.ts`
- `tests/bpm/arquivamento-modal-react.test.ts`
- `tests/bpm/authorization-actions.test.ts`
- `tests/bpm/boas-vindas-agendamento-action.test.ts`
- `tests/bpm/card-modal-integration.test.ts`
- `tests/bpm/cards-no-quadro.test.ts`
- `tests/bpm/consulta-colegas-side-effects.test.ts`
- `tests/bpm/data-hora-crm.test.ts`
- `tests/bpm/google-meet-convidados-input-react.test.ts`
- `tests/bpm/instagram-leads-assumir.test.ts`
- `tests/bpm/jornada-card-action.test.ts`
- `tests/bpm/membros-card-ownership.test.ts`
- `tests/bpm/membros-card-ui.test.ts`
- `tests/bpm/movimentacao-importados-rd-command.test.ts`
- `tests/bpm/movimento-livre-command.test.ts`
- `tests/bpm/novo-card-modal-react.test.ts`
- `tests/bpm/ownership-security.test.ts`
- `tests/bpm/promover-noloss-lead.test.ts`
- `tests/bpm/quadro-actions.test.ts`
- `tests/bpm/tarefas-alertas-foco-react.test.ts`
- `tests/bpm/visao-equipe.test.ts`
- `tests/bpm/visibilidade-etapa.test.ts`
- `.bibble/memory/codebase-map.md` — apêndice identificado desta entrega.
- `.bibble/memory/integration-points.md` — apêndice identificado desta entrega.
- `.bibble/memory/components.md` — apêndice identificado desta entrega.
- `.bibble/memory/decisions.md` — apêndice identificado desta entrega.
- `.bibble/memory/journal.md` — apêndice identificado desta entrega.
- `.bibble/memory/session-draft.md` — anotação identificada; rascunhos alheios preservados.

### Arquivos removidos

- `src/actions/bpm/VisibilidadePipeline.ts`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/VisibilidadePipelineSection.tsx`
- `src/lib/bpm/acesso-individual-pipeline.ts`
- `src/lib/bpm/lideranca-setor.ts`
- `tests/bpm/acesso-individual-pipeline.test.ts`
- `tests/bpm/lideranca-setor.test.ts`
- `tests/bpm/visao-equipe-config-react.test.ts`
- `tests/bpm/visibilidade-pipeline-actions.test.ts`

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-27 | 1.0 | Story preparada para substituir configuração de permissões do CRM, sem commit/push | Pax (@po) |
| 2026-10-27 | 1.1 | Implementação e remoções documentadas; evidências parciais registradas; gates finais pendentes | Scribe/Kowalski |
| 2026-10-27 | 1.2 | Lint/typecheck/build/revisão locais aprovados e file list final consolidada; suite global sequencial pendente | Scribe/Kowalski |

| 2026-10-27 | 1.3 | Suite global final aprovada: 729 arquivos e 5.607 testes; todos os gates locais concluídos, temporários removidos, sem commit/push/publicação | Bibble |

| 2026-10-27 | 1.4 | Integração seletiva de main autorizada; consumidores publicados adaptados, gates e 6.840 testes aprovados, push somente main preparado | Gage (@devops) |

## Integração autorizada em main — 2026-10-27

Pedido posterior do usuário: registrar a entrega em staging/main locais e fazer push somente de main. O commit seletivo staging é `a8d52057`; a integração parte de `origin/main` `552f28a8`, preservando seus 99 commits exclusivos e sem transportar os três commits exclusivos da base staging. Os conflitos foram resolvidos por intenção de acesso, preservando o salvamento em background, o drawer ativo, os documentos de contratação e a execução de minuta configurada já publicados em main. A UI de distribuição de closers e seu mock, ausentes em main, não foram introduzidos.

### Adaptações de consumidores exclusivos de main

- Alertas usam IDs/atividade dos setores e nível canônico. Usuários com administração explícita do funil podem agir fora de seu setor/coluna; Admin/TI continuam observadores de alertas sem poder de assunção e a exceção não inscreve CEO.
- A capacidade de administração da fila é derivada somente no servidor; a assunção revalida a audiência e a elegibilidade dentro da transação, preservando CAS, proveniência, idempotência e rollback.
- A atribuição no encaminhamento manual reconhece administração do funil de destino após conferir conta ativa, CRM e acesso ao destino; nenhuma autoridade da origem é transferida.
- Automações de minuta e financeiro reconhecem `ADMIN_PIPELINE`, mantendo prova causal persistida e revalidação atual. Marcador anterior de liderança não cria autorização.
- Fixtures privadas usam disco em `~/work-tmp`, com WAL e `synchronous=OFF` exclusivamente na conexão de montagem. A conexão runtime mantém suas configurações e os testes continuam exercitando rollback/concorrência.

### File List adicional da integração

- `src/lib/bpm/notificacoes-leads-server.ts`
- `src/lib/bpm/recebimentos-card-server.ts`
- `src/lib/bpm/encaminhamento-manual-server.ts`
- `src/lib/bpm/automacoes/minuta-movimento-livre-server.ts`
- `src/lib/bpm/automacoes/financeiro-movimento-livre-server.ts`
- `tests/bpm/notificacoes-leads-seguranca.test.ts`
- `tests/bpm/notificacoes-leads-sqlite.test.ts`
- `tests/bpm/encaminhamento-manual-sqlite.test.ts`
- `tests/bpm/minuta-movimento-livre-seguranca.test.ts`
- `tests/bpm/minuta-movimento-livre-sqlite.test.ts`
- `tests/bpm/financeiro-movimento-livre-seguranca.test.ts`

### Gates do snapshot integrado

- Instalação e cliente Prisma isolados da worktree original, pois o schema de main diverge da base staging. Nenhuma conexão ou alteração em banco remoto.
- `npm run typecheck`: exit 0; `npm run lint`: exit 0, 1.165 avisos do repositório. Focais: 341 testes cobertos; a repetição de 40 testes SQLite em disco passou após otimizar somente a montagem, sem ampliar timeouts globais.
- `package.json`/`package-lock.json` permanecem byte-idênticos a `552f28a8`. Blob do lockfile: `8d55a395274c4b8f41b7bc8a481d2e2d8fcb97c9`. `npm audit` identificou baseline já existente de 10 critical e 48 high; não foram introduzidas nem atualizadas dependências nesta entrega. O diagnóstico é registrado sem incluir upgrade amplo fora do escopo.
- `npm run build`: exit 0 no snapshot integrado, em escopo de sistema com MemoryHigh 17 GiB, MemoryMax 18 GiB, swap 4 GiB e CPU 200%; pico observado 7,72 GiB. Avisos existentes de pdfjs não impediram a compilação.
- Typecheck repetido e lint da fixture final: exit 0. Nenhuma fonte runtime mudou depois do build.
- Smoke local com ambiente staging e segredo de autenticação sintético somente no processo: `/` 200, rota administrativa anônima 307 para `/?acesso=bloqueado`, `/api/auth/session` 200 com `null`. Sem sessão autenticada de navegador.
- Lens/Anubis/Probe independentes aprovaram após Forge, sem achados bloqueantes ou importantes; CodeRabbit indisponível, sem afirmar execução. Patch sem padrões de segredo, sem schema/migration/env/dependências.
- `npm test -- --maxWorkers=1`: exit 0, 816 arquivos aprovados, 6.840 testes aprovados, 4 ignorados e 1 todo; duração 338,41 s. Cobertura: statements 71,69%, linhas 75,31%. Rodadas anteriores expuseram configuração sintética de auth ausente e timeouts de fixtures sob concorrência; o ambiente de teste foi corrigido sem tocar auth/Checklist de produção nem ampliar limites de timeout. A rodada final passou integralmente.
- [x] Gates do snapshot integrado aprovados; revisão independente concluída.
- [x] Escopo seletivo conferido, mudanças alheias preservadas e `origin/main` rechecado em `552f28a8` após os gates.
- [x] Preparação de promoção autorizada: commits locais de staging/main e envio somente de main, sem force push, sem envio de staging e sem operação de banco remoto.


## Follow-up Virtus — falha de build Vercel (2026-10-27)

O deployment `dpl_C6fc9xQiuKDAiVUa8eGVwrCs4GJP`, commit `0ed15bb8`, falhou no builder padrão de 4 CPUs/8 GiB. A API e o relatório do provedor registram `out_of_memory` e encerramento do worker Next.js por `SIGKILL` durante a compilação. O último artefato READY `dpl_GQhBrWMXvCPzDEYGc8eCFivcT8yy` foi gerado por CLI a partir de `552f28a8`, com override de máquina turbo de 30 CPUs/60 GiB; portanto não comprovava compatibilidade com o builder Git padrão.

Correção mínima candidata: reduzir somente o heap V8 do script de build de 4096 para 3072 MiB, preservando Webpack, `RAYON_NUM_THREADS=1`, `UV_THREADPOOL_SIZE=1`, as otimizações existentes e o comportamento do aplicativo. Nenhuma dependência, schema, credencial, configuração de produção ou plano/custo do provedor alterado.

- [x] Confirmar causa nos logs reais e identificar último artefato saudável.
- [x] Preparar patch isolado de configuração de build.
- [x] Validar build frio e com cache com limite real de 7 GiB e sem swap: ambos exit 0, picos 6,056 e 6,002 GiB, zero OOM/kill.
- [x] Typecheck exit 0 e lint exit 0, preservando os 1.165 avisos da baseline.
- [x] Executar a suíte global com autenticação sintética coerente: **CONCERNS**, 814 arquivos aprovados e 2 com timeouts de fixtures SQLite (6.831 testes aprovados, 2 falhas, 11 ignorados, 1 todo; 441,56 s). O reteste isolado dos 2 arquivos passou integralmente: 20/20 em 9,30 s, sem modificar fontes nem ampliar timeouts. O focal de autenticação passou 17/17 após corrigir apenas o wrapper para origem HTTPS e secrets sintéticos coerentes. A rodada global anterior com origem HTTP inadequada foi preservada como falha de ambiente, não como aprovação. O runtime e os testes permanecem idênticos ao `0ed15bb8`, cuja baseline global havia passado 816/6.840.
- [x] Revisão independente do diff pelo fluxo principal: somente heap de build e documentação; nenhuma alteração de runtime ou dependências. Publicação ainda pendente de acompanhamento do preview e coordenação final.
- [x] Preview isolado `dpl_AzyZdLAaegRGAexCGSvt9ABFVhSr` chegou a READY com builder padrão de 4 CPUs/8 GiB, build frio e heap 3072 MiB confirmados nos logs reais. Compilação em 4,8 min, sem OOM; build concluído e cache novo gerado.
- [x] Smoke do preview em 2026-10-27 14:51 UTC: `/` 200, `/PainelAlpha/AlphaCRM/admin` anônimo 307 para `/`, `/api/auth/session` 200 com `null`, asset JavaScript 200. Consulta contemporânea ao deployment registrou zero logs runtime e requests 200/307, sem erro novo observado.

Rollback de aplicação não foi executado: o deployment falho não substituiu o alias público saudável. Plano de recuperação é manter o último READY enquanto a correção é validada; qualquer promoção/redeploy será coordenada com o fluxo principal.

### Limitações e integridade da pré-produção

O preview recebeu somente overrides de ambiente por deployment, em runtime e build, com URL/token do banco de staging carregados de `.env.staging.local` e secrets de auth sintéticos coerentes. Nenhum arquivo de ambiente foi enviado. A origem sintética `https://virtus-auth.invalid` limita o teste a fluxos anônimos; login autenticado e escrita remota não foram executados. Configuração de projeto, proteções, plano e variáveis persistentes permaneceram intactos. Os aliases compartilhados de produção e staging continuaram associados, respectivamente, aos READY `552f28a8` e `90222449`. Este preview não substitui nem declara validação do alias staging compartilhado.

O snapshot CLI excluiu somente os cinco artefatos históricos `.next-*` já versionados na base, pois symlinks absolutos de builds antigos impediam a validação do archive pelo provedor. Nenhuma remoção desses arquivos alheios foi incluída no patch Git. Os arquivos do aplicativo e o `package.json` do preview correspondem ao candidato; diferença de código é exclusivamente o heap de build. Produção ainda será acompanhada pelo fluxo principal após a publicação autorizada.

### File list do follow-up

- `package.json` — teto do heap de compilação.
- `docs/stories/story-crm-permissoes-simplificadas-20261027.md` — causa, evidências e validação.
