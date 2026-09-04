# RM-2026-209DB4 — Checklist Builder (7. Checklists)

## Status

Concluído em 2026-09-04 — schema e migration aditivos aplicados após backup validado; backend, workspace administrativo, painel operacional, três motores, automação explícita, bloqueio de avanço e testes ponta a ponta entregues. Auditoria de segurança sem achados reportáveis.

## Contexto e resultado de negócio

Hoje "checklist" no Alpha CRM só existe como uma tarefa avulsa (`BpmTarefa.tipo = "CHECKLIST"`, itens em texto livre no campo `checklistJson`), sem template reutilizável, sem vínculo a pipeline/etapa/serviço e sem contrato de leitura para outros motores. O objetivo de negócio é permitir que um administrador construa **templates de checklist** vinculáveis a pipeline/etapa/serviço (e demais dimensões definidas abaixo), que cada card materialize uma instância desse template com progresso próprio, que itens exclusivos do card não alterem o template de origem, e que o estado de conclusão/obrigatoriedade seja consultável pelos Motores de Regras, Validações e Automações — inclusive para bloquear avanço de etapa quando o checklist obrigatório não estiver concluído.

## Escopo

- Modelo de dados aditivo para **template de checklist** (nome, escopo, itens ordenados) e para **instância por card** (progresso, observação, responsável, itens exclusivos do card).
- Vínculo opcional do template às cinco dimensões aprovadas: **pipeline, etapa, serviço, tipo de processo e card específico**. Campo vazio significa qualquer valor naquela dimensão.
- Campo textual opcional e controlado de tipo de processo no card, sem criar catálogo próprio nesta entrega.
- Server Actions de CRUD administrativo do template, seguindo o padrão de `configurarCadencias`/`configurarEtapas` (`src/lib/bpm/ownership.ts`, `exigirAcessoConfigPipeline`).
- Painel de consumo no card (`CardOpenFormSlot.tsx`) para listar, concluir itens, adicionar item exclusivo do card e registrar observação/responsável.
- Função de leitura pura do estado consolidado do checklist, consumível pelos três motores (Regras, Validações/`requisitos-etapa-server.ts`, Automações).
- Integração do bloqueio de avanço de etapa quando existir checklist obrigatório pendente, seguindo o padrão de `verificarTransicaoPermitidaBpm`/`listarCamposObrigatoriosFaltantes`.

## Explicitamente fora do escopo

- Catálogo/model próprio para "tipo de processo"; nesta entrega ele é somente um campo textual opcional e controlado no card.
- Qualquer generalização das guardas de negócio hardcoded por nome de etapa/pipeline (Financeiro, Revisão de Radar, Boas-vindas, Lost, Fechado) para consumir checklist — fora do escopo desta entrega.
- Materialização implícita apenas por criar ou mover o card. A materialização ocorre on-demand ao abrir o card em contexto compatível ou por automação explicitamente configurada.
- Propagação retroativa de edições do template para instâncias já materializadas; cada instância é um snapshot.
- Hard delete de template enquanto o contrato de backend não o definir; inativação impede apenas novas materializações.
- Qualquer alteração em `PainelTarefasPorTipo.tsx`/tarefa avulsa tipo `CHECKLIST` — é uma feature distinta e continua existindo sem relação com o builder.

## Artefato final, consumidores e caminhos de acesso

**Artefato administrativo:** workspace em `/PainelAlpha/AlphaCRM/admin/checklists`, acessível por `Configurações` → ação visível `Checklists`, sem criar item de topo na sidebar. A página e todas as ações são protegidas por `auth()` + `isAdminRole`. Consumidor: administradores do CRM.

**Artefato operacional:** `PainelChecklistsCard` dentro do card, composto em `CardOpenFormSlot.tsx` após `PainelCamposEtapaAtual` e antes de `PainelProximoContato`; no ramo especial **Agendar Reunião**, abaixo de `PainelReuniao`. É acessado por `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → `CardFullViewModal` → aba `Formulário da Etapa`. Consumidor: usuários com acesso ao card (`exigirAcessoBpmCard`), com leitura preservada e controles desabilitados quando não houver permissão de edição.

**Artefato de integração:** função de leitura pura (ex.: `obterEstadoChecklistCard`) exportada de um módulo novo em `src/lib/bpm/checklists/`, consumida por `requisitos-etapa-server.ts` (bloqueio de avanço), `src/lib/bpm/regras/contexto.ts` (nova referência allowlisted para o Motor de Regras) e pelo Motor de Automações (`BpmAutomacao`) como gatilho/condição.

**Caminho de entrega esperado:** administrador cria o template em `Configurações` → `Checklists`; usuário abre um card compatível no Kanban; a instância é materializada on-demand, de forma idempotente, e aparece em `Formulário da Etapa`; os três motores consultam o mesmo estado consolidado; item obrigatório pendente impede o avanço e oferece `Ir para pendências`.

O caminho está implementado no código real e validado por testes direcionados: rota e actions administrativas, painel no card, contrato comum dos três motores, ação explícita de materialização e cenário ponta a ponta de bloqueio/liberação.

## Critérios de aceite observáveis

- [x] Um administrador cria um template e consegue vinculá-lo às cinco dimensões aprovadas: pipeline, etapa, serviço, tipo de processo textual e card específico; valor vazio significa `Qualquer ...` naquela dimensão.
- [x] Ao abrir um card compatível, todos os templates ativos compatíveis são materializados on-demand; o mesmo template nunca é materializado duas vezes no mesmo card, inclusive sob concorrência ou reload.
- [x] Uma automação explicitamente configurada consegue materializar a mesma instância com a mesma garantia de idempotência; criar ou mover um card, sem essa configuração e sem abertura do card, não materializa checklist.
- [x] A instância preserva um snapshot do template no momento da materialização; editar ou inativar o template não altera instâncias existentes.
- [x] Um usuário adiciona um item exclusivo daquele card; esse item não aparece em nenhum outro card vinculado ao mesmo template, e o template original permanece inalterado.
- [x] Conclusão de item e adição de item exclusivo persistem após reload da página (consulta real ao banco, sem depender de cache de cliente).
- [x] O Motor de Validações (`requisitos-etapa-server.ts`) consegue consultar se o checklist obrigatório da etapa está concluído e bloquear `MoverCardBpm`/`SalvarRequisitosEMoverCardBpm` com mensagem clara quando não estiver.
- [x] O Motor de Regras consegue referenciar o estado do checklist (percentual concluído, obrigatório pendente sim/não) como fonte de condição, sem `eval`/resolução arbitrária.
- [x] O Motor de Automações consegue ler o mesmo estado como condição/gatilho de automação e possui a ação explícita `MATERIALIZAR_CHECKLIST`.
- [x] Cenário ponta a ponta obrigatório: **checklist não concluído → avanço bloqueado** — validado com teste de integração real (sem mock da engine de validação), reproduzindo o padrão de `kanban-transicao-integracao.test.ts`.
- [x] Diante de item obrigatório pendente, `PainelProximaEtapa` mostra alerta persistente com quantidade e templates envolvidos; `Ir para pendências` abre `Formulário da Etapa`, rola até o painel e foca o primeiro item pendente.
- [x] Erro de leitura/configuração é fail-open; somente pendência obrigatória explicitamente confirmada bloqueia o avanço.
- [x] Loading, erro com retry, vazio, salvamento, sucesso, conflito realtime, sem permissão e concluído são observáveis por texto/ícone, sem depender apenas de cor; progresso expõe semântica de `progressbar`.
- [x] Nenhuma regressão nos pipelines/etapas que hoje não têm checklist vinculado (comportamento de movimentação idêntico ao atual quando não há template aplicável).

## Decisões já existentes (reaproveitar, não redecidir)

- Escopo opcional por pipeline/etapa segue o padrão de `BpmCadencia`/`BpmRegra` (`etapaId?` nulo = aplica-se a qualquer etapa do pipeline).
- Gate de configuração administrativa: `exigirAcessoConfigPipeline` com novo valor em `BpmAcaoPipeline` (ex.: `"configurarChecklists"`), mesmo padrão de `configurarCadencias`.
- Gate de ação no card: `exigirAcessoBpmCard(cardId, userId, role, "editarCard")` para concluir item/adicionar item exclusivo; `"visualizar"` para leitura.
- Toda action mutante grava `BpmCardHistorico`, chama `revalidatePath` e `notificarPipelineBpm`, seguindo o padrão universal do projeto.
- `BpmCard.servico` é `String?` livre, sem FK a `ServicosComerciais` — vínculo por serviço só pode comparar por string, não por relação (limitação pré-existente, não corrigida nesta story).
- `BpmEtapaTransicaoPermitida` (model pré-existente, cliente-only) não deve ser confundida com o novo model de checklist nem reaproveitada para esse propósito.

## Decisões administrativas aprovadas em 2026-09-04

1. **Tipo de processo:** campo textual opcional e controlado no card, sem novo catálogo nesta entrega.
2. **Quinta dimensão:** card específico. As cinco dimensões são pipeline, etapa, serviço, tipo de processo e card específico.
3. **Compatibilidade:** todos os templates ativos compatíveis se aplicam; o mesmo template não pode ser materializado duas vezes no mesmo card.
4. **Propagação:** cada instância é snapshot do template no momento da materialização; edições futuras não alteram instâncias existentes.
5. **UX/UI:** seguir a especificação de Iris e os padrões atuais do Alpha CRM, sem navegação paralela.
6. **Materialização:** on-demand quando o card é aberto em contexto compatível ou por automação explicitamente configurada; nunca implicitamente apenas por criar/mover o card.

**Decisões que ainda exigem aceite:** nenhuma dentro do escopo aditivo aprovado. Qualquer `DROP`, perda de dados, backfill mutante, catálogo novo para tipo de processo ou ampliação funcional reabre o gate de decisão e exige nova confirmação específica.

## Especificação verificável de Iris

- Direção selecionada: workspace operacional denso e preciso, coerente com `RegrasWorkspace` e `AdminPipelineClient`; usar tokens do tema e estados semânticos existentes, sem paleta ou background paralelos.
- Lista administrativa: busca por nome e pelas cinco dimensões, filtro ativo/inativo, chips de vínculo, `Qualquer ...` para dimensão vazia, identificação legível do card específico e indicação não bloqueante de templates também compatíveis.
- Editor em `Dialog` responsivo com abas `Dados`, `Vínculos` e `Itens`; reordenação por botões acessíveis por teclado; confirmação antes de descartar rascunho sujo e restauração de foco ao fechar.
- Painel do card: progresso consolidado e por instância, badge `Do template`, badge `Exclusivo deste card`, obrigatoriedade expressa por ícone e texto, detalhes expansíveis, responsável limitado a membros válidos e estado persistente `Salvando…`/`Salvo`/`Erro ao salvar`.
- Estados obrigatórios: loading com `Skeleton` e anúncio, erro inline com retry, vazios distintos, sucesso, edição suja, salvamento granular, conflito realtime sem sobrescrever rascunho, leitura sem permissão e concluído a 100%.
- Acessibilidade/responsividade: mobile-first, alvos mínimos de 44 px, labels reais, foco visível, componentes Radix/shadcn existentes, `prefers-reduced-motion` e progresso com `role="progressbar"`/atributos ARIA.
- Não alterar nem substituir `PainelChecklistFollowUp` ou `PainelTarefasPorTipo`, que pertencem a domínios distintos.

## Dependências e riscos

- **Dependência:** a fase Vault deve traduzir as decisões aprovadas em inventário exato de models, colunas, FKs, índices e comandos antes de qualquer SQL.
- **Dependência:** Motor de Regras (`src/lib/bpm/regras/`) precisa aceitar uma nova referência allowlisted de fonte "checklist" — é uma extensão aditiva do catálogo existente, não uma reescrita.
- **Risco:** se o bloqueio de avanço por checklist obrigatório for fail-closed (ao contrário do fail-open documentado para `verificarTransicaoPermitidaBpm`/Motor de Regras), um checklist mal configurado pode travar movimentação de card em produção — a story recomenda seguir o mesmo padrão fail-open de erro de avaliação já adotado pelo Motor de Regras (`obterErroRegrasParaMovimento`), reservando fail-closed apenas para "item obrigatório explicitamente pendente", nunca para erro de leitura/configuração.
- **Risco:** ausência de FK entre `BpmCard.servico` e `ServicosComerciais` pode gerar vínculo de template por serviço inconsistente (string livre) — deve ser tratado como limitação conhecida, não silenciosamente contornado nesta story.

## Gate Vault

Esta story **exigirá** uma fase de schema (templates, vínculos, instâncias, itens e o campo textual opcional de tipo de processo no card) antes da implementação de backend/UI. O administrador aprovou **em princípio** uma migration exclusivamente aditiva, sem remoção, renomeação, backfill destrutivo ou alteração de estruturas existentes, e autorizou sua preparação/validação dentro desse limite.

Antes de aplicar SQL, Vault deve registrar o inventário exato de models, colunas, FKs, índices e comandos, ambiente/banco afetado, impacto, riscos, alternativa não destrutiva e rollback. O backup exclusivo informado é `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-04T14-13-22-575Z.sql` (91.384.300 bytes; 272 tabelas; 61.206 registros; SHA-256 `ffdce93ff3945fc9b3d5072da439f88f0276bafc34afb94ef8c854624850f4f9`). Vault deve reinspecionar e validar essa evidência e a janela de 48 horas na fase de execução. Qualquer `DROP`, perda de dados, backfill mutante ou ampliação do plano exige nova confirmação explícita.

## Checklist das fases

- [x] Fase 0 — Auditoria de entregabilidade (Scout): concluída, `AUTO_ADJUSTMENT_REQUIRED` registrado em `.bibble/memory/architecture.md`/journal (ver resumo consolidado nesta story).
- [x] Fase 1 — Blueprint técnico (Scout): concluído, mapeou fontes de verdade, gates de ownership, pontos de integração e padrão de composição no card.
- [x] Fase 2 — Especificação de UX/UI (Iris): concluída; direção `Workspace de checklists` incorporada nesta story.
- [x] Fase 3 — Formalização da story e critérios verificáveis (esta fase).
- [x] Fase 4 — Resolução das seis decisões administrativas: aprovação registrada em 2026-09-04 e incorporada nesta story.
- [x] Autoajuste condicional de entrega — ação `Checklists` em `Configurações` e shell administrativo protegido em `/PainelAlpha/AlphaCRM/admin/checklists`; sem domínio, schema ou persistência antecipados.
- [x] Fase 5 — Relatório Vault + inventário exato + schema aditivo; backup oficial validado e migration revisável gerada, sem aplicação remota nesta fase.
- [x] Fase 6 — Domínio, persistência e Server Actions de CRUD/materialização/operação do checklist implementados; UI e integração com motores permanecem nas fases seguintes.
- [x] Fase 7 — Painel de consumo no card (`CardOpenFormSlot.tsx`).
- [x] Fase 8 — Função de leitura consolidada + integração com os três motores.
- [x] Fase 9 — Verificação ponta a ponta do cenário "checklist não concluído → avanço bloqueado".
- [x] Fase 10 — Auditoria de segurança das novas actions/rotas; nenhum achado reportável.
- [x] Fases 11–14 — integração real, arquitetura, robustez e casos extremos validados após intervenção direta.
- [x] Fases 15–16 — memória permanente, registro cronológico e encerramento.

## Seção de testes

Testes obrigatórios a criar nas fases de execução (nenhum existe ainda para este contrato):

- Unitários do módulo puro de leitura de estado do checklist (percentual concluído, obrigatório pendente sim/não), sem banco.
- Server Actions de CRUD do template: autenticação, autorização (`isAdminRole`), validação Zod, persistência.
- Instância por card: criação on-demand, conclusão de item, adição de item exclusivo (isolado por card), observação/responsável.
- Integração real (não mockada) do bloqueio de avanço, seguindo o padrão de `kanban-transicao-integracao.test.ts`: card com checklist obrigatório incompleto → `MoverCardBpm` bloqueado com mensagem clara; checklist completo → movimento permitido.
- Regressão: pipelines/etapas sem template vinculado continuam se movimentando exatamente como hoje.
- Motor de Regras: nova referência de checklist avaliada corretamente por `avaliarRegras`, incluindo fail-open em erro de leitura.
- Compatibilidade/materialização: cinco dimensões, todos os templates compatíveis, unicidade template×card sob concorrência, snapshot e inativação sem alterar instâncias.
- UI/acessibilidade: estados obrigatórios, foco/teclado, `progressbar`, caminho `Ir para pendências`, ramo especial `Agendar Reunião` e preservação dos dois checklists legados.

## File List (provisória — sujeita a alteração nas fases de execução)

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `prisma/schema.prisma` | EDIT (fase Vault) | Models de template/instância/item de checklist |
| `prisma/migrations/<timestamp>_bpm_checklists/migration.sql` | NEW (fase Vault) | Migration aditiva |
| `src/lib/bpm/checklists/schemas.ts` | NEW | Zod schemas de template/instância/item |
| `src/lib/bpm/checklists/leitura.ts` | NEW | Função pura de leitura de estado consolidado |
| `src/actions/bpm/Checklists.ts` | NEW | Server Actions CRUD + vínculo card×template |
| `src/lib/bpm/ownership.ts` | EDIT | Novo valor `configurarChecklists` em `BpmAcaoPipeline` |
| `src/lib/bpm/requisitos-etapa-server.ts` | EDIT | Integração do bloqueio por checklist obrigatório |
| `src/lib/bpm/regras/contexto.ts` | EDIT | Nova referência allowlisted de checklist |
| `src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx` | EDIT | Novo ramo condicional do painel de checklist |
| `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistsCard.tsx` | NEW | Painel operacional e estados de UX do checklist |
| `src/app/PainelAlpha/AlphaCRM/admin/page.tsx` ou cliente associado | EDIT | Ação `Checklists` dentro da configuração existente |
| `src/app/PainelAlpha/AlphaCRM/admin/checklists/` | NEW | Rota e workspace administrativo do builder |
| `tests/bpm/checklists-entrega-shell.test.ts` | NEW | Wiring e proteção do shell administrativo |
| `tests/bpm/checklists-*.test.ts` | NEW | Testes descritos na seção anterior |
| `docs/stories/story-rm-2026-209db4-checklist-builder.md` | NEW | Esta story |
| `src/lib/bpm/checklists/service.ts` | NEW | Materialização on-demand idempotente e leitura consolidada |
| `tests/bpm/checklists-domain.test.ts` | NEW | Compatibilidade das cinco dimensões e progresso puro |
| `tests/bpm/checklists-actions.test.ts` | NEW | Auth, Zod, autorização e persistência das actions administrativas |
| `tests/bpm/checklists-service.test.ts` | NEW | Paginação completa, snapshot transacional e retry idempotente por `P2002` |
| `src/lib/bpm/checklists/integracao.ts` | NEW | Contrato aplicável compartilhado, guarda transacional e fato/placeholders para automações |
| `tests/bpm/checklists-integracao-motores.test.ts` | NEW | Bloqueio/liberação, regras, automações e fail-open |
| `prisma/migrations/20260904152000_bpm_checklists/migration.sql` | NEW | Diff aditivo revisado e aplicado ao Turso após backup validado |

## Registro da Fase 6 — domínio, persistência e actions

O gate oficial restaurou e validou o backup exclusivo com `verified=true`, SHA-256 `ffdce93ff3945fc9b3d5072da439f88f0276bafc34afb94ef8c854624850f4f9`, 91.384.300 bytes, 272 tabelas e 61.206 registros. O schema recebeu apenas o inventário aditivo aprovado: `BpmCard.tipoProcesso` nullable e os models `BpmChecklistTemplate`, `BpmChecklistTemplateItem`, `BpmCardChecklist` e `BpmCardChecklistItem`. O diff final foi gerado por `prisma migrate diff --script`, revisado e não aplicado ao Turso.

`src/actions/bpm/Checklists.ts` implementa CRUD/inativação de templates, gestão e ordenação de itens, materialização on-demand, item exclusivo, atualização de status/observação/responsável e resumo. Toda entrada mutável usa Zod; auth precede acesso a dados protegidos; configuração exige `configurarChecklists`; operações no card revalidam ownership dentro da transação. `src/lib/bpm/checklists/service.ts` é o contrato interno reutilizável por abertura do card ou automação explícita, com unicidade `cardId + templateId` como garantia contra reload, retry e concorrência. Snapshots não são propagados nem apagados pela inativação do template.

A busca de templates aplicáveis usa páginas limitadas de 250 registros com cursor estável, sem truncar silenciosamente o conjunto compatível. Erros esperados mantêm mensagens públicas controladas; falhas inesperadas geram observabilidade sanitizada (tipo/código, sem payload ou dado sensível).

AUTO_ADJUSTMENT_REQUIRED: o backend está pronto para consumo, mas o shell administrativo ainda não importa as actions, `CardOpenFormSlot` ainda não monta o painel operacional e os motores ainda não consultam `carregarResumoChecklistCard`; a migration também permanece não aplicada por exigência expressa desta fase.

AUTO_ADJUSTMENT_ACCEPTANCE: fase seguinte aplica a migration pelo mecanismo aprovado após novo gate operacional, conecta o workspace admin e o painel do card às actions e integra o mesmo resumo aos motores; validação ponta a ponta = template criado no admin → abertura materializa uma única instância → reload preserva itens → pendência obrigatória bloqueia avanço no servidor.

## Registro final da entrega — 2026-09-04

A migration aditiva foi aplicada ao Turso depois da validação do backup exclusivo `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-04T14-13-22-575Z.sql` (SHA-256 `ffdce93ff3945fc9b3d5072da439f88f0276bafc34afb94ef8c854624850f4f9`). Integridade, FKs, quatro tabelas, coluna `tipoProcesso`, índices e preservação dos cards anteriores foram confirmados.

O workspace administrativo substituiu o shell e salva edições completas em uma única transação. O painel operacional materializa todos os templates compatíveis na abertura, mantém snapshots, itens exclusivos e edição com CAS. `PainelProximaEtapa` consulta o resumo aplicável sem materializar, mostra alerta persistente e leva o foco ao primeiro item obrigatório. O Motor de Regras usa fonte allowlisted, o Motor de Validações bloqueia antes e dentro da transação de movimento, e o Motor de Automações lê os mesmos fatos e oferece a ação explícita `MATERIALIZAR_CHECKLIST`, que reutiliza o serviço idempotente e registra `automacaoOrigem`.

Gates finais: `prisma validate` e `git diff --check` aprovados; ESLint direcionado sem erros; 12 arquivos de testes relevantes/66 testes aprovados após as correções finais. O typecheck global mantém débitos concorrentes fora dos arquivos do objetivo. A suíte global previamente executada teve 2.249 testes aprovados e 37 falhas basais não relacionadas, sem falha de checklist. A auditoria Codex Security do escopo fechou com zero achados reportáveis e relatório canônico em `/tmp/codex-security-scans/painel-alpha/rm-2026-209db4-tmoqB3qP/report.md`. O build de produção passou e o deploy de staging concluiu na release `20260904-173601` (Build ID `7lmYciv2yOweBzB4dQB7m`); para destravar a coleta de páginas sem segredo no build, `onboarding.ts` e `RecuperarSenha.ts` passaram a instanciar Resend somente no envio.

## Resumo consolidado da auditoria de entregabilidade (Fase 0)

A superfície administrativa, o menu "Configurações" e o ponto único de composição do formulário do card (`CardOpenFormSlot.tsx`) já existem como padrão reaproveitável — não é lacuna de rota/menu/integração. A lacuna real é de modelo de dados e contrato: não há template persistível, instância por card nem leitura de checklist pelos três motores. A decisão posterior definiu `tipoProcesso` como texto opcional no card e card específico como quinta dimensão.

## Resumo consolidado do blueprint técnico (Fase 1)

`BpmPipeline`/`BpmEtapa` são as fontes de verdade estáveis; `ServicosComerciais` existe mas sem FK a partir de `BpmCard` (`servico` é string livre); `tipoProcesso` ainda não existe e será uma coluna textual opcional aprovada no card. Ownership de configuração usa `exigirAcessoConfigPipeline`/`isAdminRole`; ownership de ação no card usa `exigirAcessoBpmCard`. `executarMovimentoComRequisitos` (`src/actions/bpm/Cards.ts`) é o ponto de integração natural para bloqueio por checklist, no mesmo lugar onde já rodam `verificarTransicaoPermitidaBpm` e a checagem de campos obrigatórios. Os três motores têm pontos de extensão estruturalmente prontos (allowlist no Motor de Regras, guardas no Motor de Validações, condições/gatilhos no Motor de Automações), mas ainda precisam receber um contrato comum de leitura. Materialização foi decidida como on-demand na abertura ou por automação explícita, sempre idempotente.

## Auditoria de entregabilidade desta formalização

**Artefato final desta fase:** esta story autossuficiente. **Consumidores:** Vault, implementadores de backend/frontend e os gates Forge/Probe/Anubis/Lens/Sage. **Caminho real de acesso:** `docs/stories/story-rm-2026-209db4-checklist-builder.md` no repositório; as fases de execução devem consultá-la antes de editar código. A feature de produto ainda não está disponível na UI e não deve ser declarada pronta nesta fase documental.

DELIVERY_READY: `docs/stories/story-rm-2026-209db4-checklist-builder.md` → insumo versionável e localizável para Vault e para as fases de implementação/validação; acesso direto pelo caminho real em `docs/stories/`.

## Registro do autoajuste condicional de entrega

A aprovação administrativa de 2026-09-04 autorizou a direção de Iris sem navegação paralela. O menor suporte necessário foi implementado em `Configurações`: a ação visível `Checklists` leva ao shell `/PainelAlpha/AlphaCRM/admin/checklists`, protegido no servidor por `auth()` e `isAdminRole`. O shell informa explicitamente que o cadastro permanece indisponível até a implantação segura da estrutura de dados; não importa actions, Prisma nem banco.

`CardOpenFormSlot.tsx` já é o ponto de composição real do formulário do card e não foi alterado nesta fase. Montar um painel sem a estrutura e as actions previstas nas fases 5–7 criaria uma interface sem persistência, contrariando a auditoria de entregabilidade.

DELIVERY_READY: administrador autenticado → `/PainelAlpha/AlphaCRM` → `Configurações` → `Checklists` → `/PainelAlpha/AlphaCRM/admin/checklists`; usuário sem papel administrativo é redirecionado para `/PainelAlpha/AlphaCRM`.

### Verificação do autoajuste

- `git diff --check`: aprovado.
- ESLint direcionado aos dois arquivos de produção e ao teste: aprovado sem erros ou warnings.
- `npx vitest run tests/bpm/checklists-entrega-shell.test.ts`: 2/2 aprovados.
- `npm run lint`: gate global mantém o baseline de 2.485 erros e 1.259 warnings, fora dos arquivos desta fase.
- `npm test`: 2.223 aprovados e 39 falhas preexistentes/não relacionadas; o teste novo passou na execução direcionada e na suíte global.
- `npm run typecheck`: a execução padrão esgotou o heap; com `NODE_OPTIONS=--max-old-space-size=8192`, terminou com diagnósticos preexistentes fora dos arquivos desta fase e nenhum diagnóstico no shell novo ou no wiring administrativo.
- `npm run build`: Prisma Client e player foram gerados; o Next.js permaneceu em `Creating an optimized production build` por aproximadamente 10 minutos sem erro nem conclusão e foi interrompido. O gate não foi declarado aprovado.
