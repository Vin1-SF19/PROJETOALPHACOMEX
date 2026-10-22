# Story — Notificações compartilhadas de leads sem responsável no CRM

## Status

Ready for Review — correção TI/Admin observador implementada, quatro gates reais e QA local APPROVED sobre a base `69047dee`; publicação e teste visual autenticado da correção em staging ainda pendentes neste commit. A evidência remota posterior será privada, sem novo commit documental. O E2E de `60ae49ff`/`69047dee` é histórico; produção fora do escopo.

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["npm run lint", "npm run typecheck", "npm test", "npm run build", "revisão de autorização", "smoke staging"]

## Story

**Como** integrante autorizado do setor correspondente, **quero** receber um toast quando chegar um lead/card ainda não assumido e encontrá-lo na central até alguém assumi-lo, **para** iniciar o atendimento do meu setor preservando os responsáveis dos setores anteriores.

## Fonte, escopo e coerência

Pedido do usuário em 2026-10-22: notificações por pipeline quando um lead entrar; exemplo Instagram em Novo Lead, toast para todos os closers do Comercial, roxo para Instagram, azul para site e aparência normal para demais origens. A notificação deve mostrar detalhes do lead e que ninguém o assumiu; permanece na central até a assunção. Clicar leva ao lead aberto, com as opções de assumir já existentes.

O usuário confirmou também nova ação Assumir para Financeiro/Operacional, mantendo a assunção comercial existente e sem atribuição automática no clique da notificação. A central e a navegação do CRM já existem. A story de alertas de tarefas implementou reconhecimento de leitura e deduplicação; sua regra de desaparecer após leitura não se aplica à nova pendência compartilhada. O documento de Instagram descreve entrada virtual sem responsável e promoção canônica ao assumir, separada da ingestão. Referências:

- [Alertas de tarefas — Acceptance Criteria](story-crm-alertas-tarefas-leitura-navegacao.md#acceptance-criteria): reutilizar navegação e deduplicação, preservando o ciclo próprio dessas notificações.
- [Tarefas e notificações — Dev Notes](story-alpha-crm-tarefas-otimistas-notificacoes.md#dev-notes): central existente, consulta autenticada e recuperação sem efeitos colaterais.
- [Instagram — Dados comerciais mantidos no CRM](../integrations/instagram-leads.md#dados-comerciais-mantidos-no-crm): dados comerciais disponíveis, responsável somente na assunção e limites de metadados publicitários.

**Esclarecimento explícito posterior do usuário:** todos os integrantes do setor correspondente recebem no Financeiro/Operacional. Ao mudar de pipeline, o responsável anterior permanece identificado pelo setor (por exemplo, “Responsável no Comercial: Sheila”); a pessoa do Financeiro assume o card de destino, e o Operacional segue a mesma lógica. Esta confirmação autoriza uma recepção pendente e nova ação de assunção nesses setores, sem inferir assunção de responsável nominal herdado.

**Contrato:** [Arquitetura — pendências e assunção por pipeline](../architecture/crm-notificacoes-leads-sem-responsavel-20261022.md). Não inventar pendências para legados nem executar backfill. Audiência e claim respeitam setor, CRM efetivo, pipeline e etapa; bypass de Admin fora do setor não o transforma em integrante para assumir.

## Acceptance Criteria

1. A entrada de um lead sem responsável em uma fila comercial canônica que já oferece Assumir (incluindo Novo Lead) disponibiliza uma notificação na central para todos os usuários habilitados que já podem assumir nessa fila, incluindo os closers elegíveis e autorizados nesse pipeline, independentemente de qual pipeline esteja aberto. Com a sessão ativa, cada destinatário recebe também um toast de chegada. A identificação da audiência respeita as permissões canônicas do sistema, sem lista de usuários fixa no código.
2. Instagram apresenta destaque roxo; site apresenta destaque azul; outras origens mantêm o estilo padrão do painel. A origem também é identificada por texto, sem depender apenas da cor. A classificação usa a proveniência canônica disponível, não nome do lead, aparência do card ou heurística que classifique toda entrada NoLoss como site sem confirmação.
3. Toast e central identificam o lead, sua origem, pipeline/etapa e data/hora de chegada, apresentando os detalhes comerciais disponíveis e a mensagem explícita de que ninguém o assumiu. Campos opcionais ausentes não impedem a entrega e não são preenchidos com dados inventados. A lista exata de detalhes respeita a projeção comercial existente e não expõe credenciais nem metadados publicitários excluídos do CRM.
4. A pendência permanece na central enquanto o lead continuar elegível e sem responsável, inclusive depois de clicar, visualizar, marcar como lida, limpar notificações comuns, recarregar a página ou voltar a entrar. Leitura local pode reconhecer o toast, mas não resolve nem oculta definitivamente a pendência compartilhada. Fechar o toast não assume o lead nem remove a entrada da central.
5. A assunção bem-sucedida pelo fluxo canônico correspondente (existente no Comercial, novo claim de recepção no Financeiro/Operacional) resolve a pendência para todos os destinatários autorizados. Após a atualização/recuperação correspondente, nenhuma central continua indicando que o lead está sem responsável. Uma tentativa recusada ou falha não resolve a pendência. Preservar as validações existentes e usar somente a ação explícita e autorizada de assunção; o clique na notificação não cria outro caminho de escrita.
6. Clicar no toast ou na central abre o lead correto, no pipeline correto, com seu detalhe/modal aberto e com a opção de assunção correspondente ao setor. O clique não assume automaticamente. Reutiliza a aba CRM e seu protocolo autorizado de navegação, incluindo leads virtuais antes de existir card nativo. Cliques subsequentes e respostas atrasadas não abrem outro lead ou duplicam abas.
7. Repetição da entrega, polling, foco, reconexão, remontagem ou resposta duplicada não cria entradas ou toasts repetidos para a mesma chegada e usuário. Um novo lead legítimo continua produzindo sua própria notificação. Estado de reconhecimento fica isolado por usuário; logout/troca de conta não entrega dados ou intenções de outra sessão. Não persistir conteúdo de leads no armazenamento local apenas para deduplicar.
8. Consulta de recuperação e qualquer canal realtime aplicam autenticação e autorização no servidor, limitadas à audiência e ao pipeline elegíveis e aos limites de organização/tenant existentes. Manipular pipeline/lead/card/usuário no payload ou URL não concede acesso. O cliente revalida o destino ao abrir e concilia revogação de acesso, assunção por outro usuário e respostas antigas, sem ressuscitar uma pendência resolvida.
9. A recuperação de notificações é somente leitura e deriva a pendência da fonte canônica de lead/assunção. Não promove lead, cria card, altera responsável, executa worker nem grava histórico para produzir a lista. Concorrência entre dois usuários assumindo mantém a garantia existente de um único vencedor, sem duplicar card, responsabilidade ou efeitos. A entrega usa os mecanismos existentes de recuperação/realtime do painel, com tratamento de ausência de conexão.
10. Alertas de tarefas, notificações de outros módulos, contagens, leitura e limpeza mantêm seus comportamentos próprios. A nova fonte é integrada à central existente e preserva acessibilidade por teclado, rótulos, contraste e responsividade. Não criar central, painel de configuração, serviço externo ou botão independente de CRM por conveniência.
11. A implementação prioriza projeção dos modelos atuais, sem schema, migration, seed, backfill ou mutação em massa presumidos. Se uma mudança estrutural indispensável for identificada, a parcela afetada segue o fluxo Vault, backup verificado e confirmação específica de `AGENTS.md` antes de qualquer execução. Nenhuma mudança em produção faz parte desta entrega.
12. Testes demonstram os critérios acima e os quatro gates obrigatórios são executados com resultados reais. Checklist e File List refletem o delta efetivo. Após validação, DevOps faz commit/push para `staging` e confere deploy/alias e smoke no ambiente correto, conforme autorização permanente do usuário. Limitações e itens pendentes são explicitados, sem declarar testes ou publicação não realizados.

13. Um novo card de destino Financeiro/Operacional criado pelo helper compartilhado de encaminhamento registra uma recepção pendente auditável na mesma transação de card, vínculo e evento. Destino existente/retry não cria nova chegada nem reinicia assunção. Responsável nominal herdado não prova que alguém assumiu; mover etapa, inclusive Admin, não resolve a recepção. Legados sem recepção e criações manuais com responsável escolhido não viram pendência automaticamente.
14. Todos os integrantes ativos do setor correspondente, com CRM efetivo, acesso ao pipeline e `podeVer`, recebem a recepção, mesmo que sejam visualizadores sem permissão de assumir. A elegibilidade de responsável, `podeAgir` e as guardas específicas de trabalho são exigidas apenas no claim. Quem não pode assumir visualiza motivo claro, sem ocultar a pendência nem receber promessa de ação disponível. A nova ação explícita Assumir revalida ator/ACL/setor/estado em transação e usa CAS: dois concorrentes têm um vencedor, replay é idempotente e falha não resolve a pendência. Atualiza somente responsável e membros do card alvo, registra autor/recepção e publica evento idempotente. Visualizar antes de assumir não concede edição por ser notificado; restrições específicas de trabalho permanecem aplicáveis.
    Se Financeiro ainda não assumido foi encaminhado administrativamente e permanece ATIVO, o claim continua possível para o ator elegível como atribuição específica; não libera a edição/trabalho bloqueados pelo encaminhamento. O snapshot do Operacional não recebe responsável financeiro retroativo. Cards concluídos/arquivados/cancelados não ganham claim por essa regra.
15. Comercial mantém seu responsável original; Financeiro e Operacional apresentam nomes claros dos responsáveis por setor e a assunção atual. “Vendedor responsável” continua sendo o vendedor comercial, nunca o usuário que assumiu Financeiro/Operacional. A garantia inclui o resolver de fonte automática e a projeção real `ObterCardBpm`, não apenas o valor persistido ou snapshot. No Financeiro/Operacional, ausência de prova Comercial retorna vazio/indisponível, com fallback somente por vínculo Comercial inequívoco da mesma negociação, inclusive em legado sem escrita: Closer A → Financeiro B → Operacional C mantém vendedor A. Assumir não altera cards de origem, vínculo da negociação, parceiro/origem, contrato, finalização, pagamento, NF ou documentos. Setor atual pendente mostra aguardando assunção, sem apresentar uma atribuição técnica como claim concluído.
16. A projeção é completa, com ordenação estável e coleta de todas as páginas antes da conciliação. Falha parcial ou resposta antiga não remove pendências nem ressuscita resolvidas. Arquivado/excluído, pipeline inativo ou perda de autorização retiram recursos indisponíveis da projeção sem manter órfãos. Realtime envia somente invalidação mínima no canal privado já autorizado, nunca os dados do lead.
17. Site azul pode ser comprovado no ingresso NoLoss autenticado pelos opcionais `utmSource`/`utmMedium`/`utmCampaign` guardados nas colunas existentes, sem migration; `utmSource=site|website` identifica site. Payload antigo permanece válido, campos omitidos não apagam proveniência e retries não resetam status de assunção. Origem desconhecida permanece normal, sem classificar todo NoLoss como site.

18. Conforme correção explícita do usuário (“eu (TI) não recebi notificação, preciso receber para testar e ver”), contas ativas com role canônica normalizada exatamente `ADMIN` ou `TI` também recebem como observadoras as pendências existentes Instagram, site/NoLoss e recepções Financeiro/Operacional: consulta completa, central persistente, toast e clique para abrir. `T.I` mantém compatibilidade pela normalização existente; CEO, líderes genéricos, nomes/e-mails/IDs de usuário ou roles parecidas não entram nessa exceção. Reutilizar CRM efetivo e ACL de leitura vigentes do módulo/pipeline/etapa, recursos ativos e os mesmos canais privados. Observador recebe `podeAgir=false`; a nova inscrição não concede assunção nativa, edição ou participação. Tanto `podeAssumir` quanto a mutação de claim nativo exigem explicitamente o setor do alvo, além das guardas atuais. Não modificar a autorização preexistente de promoção Instagram/NoLoss; clique continua sem claim, promoção ou encaminhamento automático. A abertura nativa mantém primeiro acesso/SLA preexistentes de `ObterCardBpm`; não prometer zero escrita global ao abrir. A correção não cria notificações paralelas, schema, configuração, ENV, backfill ou efeitos em produção.

## Decisões de preparação

- **Escopo confirmado pelo usuário:** Comercial com assunção existente; novos encaminhamentos Financeiro/Operacional com recepção e claim explícitos, todos os integrantes autorizados a visualizar do setor, preservando responsáveis anteriores. Sem responsável nulo, migração ou backfill.
- **[AUTO-DECISION] Ciclo de vida:** tratar a entrada da central como pendência compartilhada, separando reconhecimento individual de toast e resolução canônica por assunção. Isso deriva diretamente do pedido de permanecer até alguém assumir.
- **[AUTO-DECISION] Dados do lead:** mostrar apenas informações comerciais existentes e autorizadas; composição final do resumo será fechada no contrato de arquitetura, sem exigir campos hoje ausentes.
- **[AUTO-DECISION] Processo:** story local descritiva seguindo o padrão do repositório; o pedido atual é a fonte de requisitos, sem criar epic ou sincronizar ferramentas externas. Os arquivos configurados de PRD/arquitetura gerais não estão presentes nesta cópia.

## Dev Notes

### Integrações verificadas e contexto anterior

O fluxo de Instagram preserva nome, e-mail, WhatsApp, CNPJ quando disponível, data de captação e dados comerciais de Radar/volume/prazo; seus dados publicitários ficam no NoLoss. O responsável só passa a existir ao assumir. Não confundir ingestão virtual com criação de `BpmCard`. [Source: `docs/integrations/instagram-leads.md#dados-comerciais-mantidos-no-crm` e `#atribuição-guardada-somente-no-noloss`]

A central já agrega outras fontes; alertas de tarefas usam hook/store, consulta de recuperação e protocolo de abertura do card em aba CRM existente. O estado de leitura deles não deve controlar a elegibilidade desta nova fonte. [Source: `docs/stories/story-crm-alertas-tarefas-leitura-navegacao.md#dev-notes-e-referências`; `docs/stories/story-alpha-crm-tarefas-otimistas-notificacoes.md#dev-notes`]

Pontos iniciais de reconhecimento, já identificados nas stories/fontes acima:

- `src/components/layout/CentralNotificacoesPainel.tsx` e `src/components/layout/PainelLayoutClient.tsx`: composição da central, toast e integração de fontes.
- `src/hooks/useBpmCardNotificacaoNavigation.ts` e `src/lib/bpm/notificacoes-tarefas.ts`: mecanismo atual de intenção/handshake e navegação autorizada; confirmar extensão necessária para lead virtual.
- `src/hooks/useBpmTarefasNotifications.ts` e `src/store/useBpmTarefasNotificacoes.ts`: referência para recuperação/deduplicação, sem copiar o comportamento de remoção por leitura.
- `src/lib/bpm/noloss-leads.ts`, `src/lib/bpm/instagram-leads-server.ts`, `src/actions/bpm/NolossLeads.ts` e `src/actions/bpm/InstagramLeads.ts`: fontes e assunção existentes a confirmar na arquitetura antes de editar.
- `src/actions/bpm/Cards.ts` e `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`: projeção/abertura de leads virtuais e cards.

**Contrato de arquitetura:** documento vinculado acima define `AlertaLeadBpm`, `RecebimentoPipelineBpm`, destinos discriminados virtual/card, GET somente leitura `/api/bpm/leads/alertas`, evento mínimo no canal privado por usuário e `AssumirRecebimentoPipelineBpm`. Recepção/assunção usam histórico versionado com identidades determinísticas, CAS do card e outbox transacional existentes. O núcleo comercial usa estados canônicos Instagram/NoLoss. Novos módulos e ownership constam no blueprint; não criar schema por conveniência.

Não há variável de ambiente nova prevista. Reutilizar a configuração existente apenas depois de conferir destino efetivo de staging; ausência de transporte realtime deve ter recuperação autorizada. [Source: `AGENTS.md#fluxo-de-ambientes--staging-primeiro`; story de tarefas, `#decisões-e-limites`]

### Implementação frontend — Nova (2026-10-22)

A central agrega pendências de leads em coleção independente: leitura automática, marcar todas, clique e fechamento do toast não removem o lead. O armazenamento local guarda somente IDs de toasts vistos, separado por usuário. Instagram usa violeta, site comprovado usa azul e outras origens seguem a superfície padrão; origem textual acompanha as cores, com contato disponível, pipeline, etapa, chegada e responsáveis anteriores. O hook BPM existente compartilha assinatura privada e timer de recuperação entre tarefas e leads; só substitui a coleção após snapshot completo, rejeita páginas divergentes/ciclos e invalida respostas anteriores a eventos/troca de conta.

Navegação usa união validada para card físico e lead virtual, preservando URLs de tarefas. O lookup virtual direcionado revalida a disponibilidade no servidor e abre o modal de assunção existente, inclusive fora da página do quadro; o clique não promove. A confirmação do iframe ocorre depois da montagem e distingue fonte/lead/card/recepção/tarefa. A ação autorizada de assunção Financeiro/Operacional fica no cabeçalho existente, com nomes por setor, motivo quando não permitido, bloqueio de duplo clique e confirmação antes da releitura. O Kanban exibe “Aguardando assumir” no lugar do owner técnico quando a projeção canônica indica recepção pendente; filtro Meus permanece preservado.

Não há dependência nova, provider global adicional ou assinatura/poller paralelo. Componentes novos: `LeadNotificacaoToast` e `PainelRecebimentoCard`; hooks e helper de navegação são reaproveitados pela central/board atuais. Testes React usam componentes reais com I/O de servidor simulado e não equivalem a validação autenticada multicliente remota.

### Implementação backend e checkpoint integrado — 2026-10-22

`notificacoes-leads.ts` fornece DTOs/schemas puros; `notificacoes-leads-server.ts` projeta as fontes canônicas e a audiência no GET readonly `/api/bpm/leads/alertas`, com paginação/snapshot completos e invalidação mínima no canal privado já existente. Instagram/NoLoss usam seus claims canônicos; ingresso NoLoss aceita proveniência opcional de site sem apagar valores omitidos ou resetar promoção. Comercial conserva os closers autorizados a assumir da fila (AC 1); Financeiro/Operacional notificam todos os integrantes autorizados a visualizar, separando leitura de capacidade de claim (AC 14).

`recebimentos-card-server.ts` registra recepção somente para novo destino do helper compartilhado; valida card/vínculo/execução/evento e reconcilia assunção idempotente por histórico determinístico, CAS e outbox. Claim modifica apenas owner/membros do alvo; nominal herdado não representa assunção. Financeiro pendente ATIVO já encaminhado pode ser assumido como atribuição específica, sem liberar edição/trabalho bloqueados e sem reescrever snapshot do Operacional. Fonte automática `alpha.vendedor.a` preserva Comercial na mesma negociação; sem prova, retorna indisponível, com fallback só por vínculo inequívoco, inclusive em legado readonly. A identificação operacional usa também o ID canônico quando `chave=null`, preservando Boas-vindas e as permissões existentes.

Evidência focada informada pelos owners: backend 182/182 testes em 12 arquivos (incluindo os 64 casos de segurança e os sete casos SQLite, sem somar novamente essas parcelas), typecheck oficial com 8 GiB exit 0 e lint focado exit 0. A fixture SQLite final cobre Operacional com ID canônico e `chave=null`; não atribuir essa prova específica aos 64 testes adversariais. Frontend: 100/100 testes em 18 arquivos e lint exit 0 (um warning preexistente); tentativa própria de tipos com 4 GiB terminou em OOM/134 antes de diagnósticos, sem indicar erro de tipos e sem aprovar o gate global. Forge registrou typecheck integrado exit 0 (8,54 s) e lint integrado exit 0 (52,24 s, warnings preexistentes); o resultado final dos quatro gates e smoke ainda aguarda consolidação. Não inferir aceite global do build supervisionado antes do relatório final do responsável.

| ACs | Evidência disponível neste checkpoint | Limite de aceite |
| --- | --- | --- |
| 1–3, 17 | Audiência/origem/ingresso, detalhes e componentes cobertos nos checks focados | Chegada/toast real por setor ainda depende do smoke staging |
| 4–7, 10 | Coleção persistente, leitura, dedupe, navegação e regressões React | Sem prova remota multicliente pelos testes locais |
| 8–9, 13–16 | Segurança, CAS/recepção, vendedor A/B/C, snapshots e SQLite focados | QA final após Forge e integração real ainda pendentes |
| 11 | Projeção/modelos existentes, sem schema/migration/backfill nesta entrega | Não autoriza mutação em massa ou produção |
| 12 | Manifests/evidências focadas e File List consolidados | Quatro gates, QA final, commit/push, deploy/alias e smoke pendentes |

Permissão operacional em staging: coordenação realizou CRUD canônico pela UI com Admin real em 2026-10-22 13:04:52 UTC, resposta 200/sucesso, habilitando o override individual CRM ADD do líder operacional. Papel de liderança e cinco outras permissões efetivas foram preservados; CRM passou a constar como sexta permissão visível. Isso configura a capacidade solicitada pelo usuário, sem exceção nova de ACL nem sessão forjada. Evidências privadas `vitor-permission-ui-proof.json`/`vitor-permission-ui-effective.json` em `/var/tmp/alpha-crm-notificacoes-leads-sem-responsavel-20261022/`; verificação SELECT posterior do delta pelo DevOps permanece pendente. Houve uma alteração normal de configuração pelo aplicativo, portanto não se alega ausência global de escritas no banco. Sem SQL manual, migration, backfill, operação em massa, ENV, worker manual ou mudança em produção. Ainda não há publicação desta feature nem prova autenticada multicliente no checkpoint.

### Estrutura e contexto acumulado

`accumulated-context.md` e `.aiox/gotchas.json` foram procurados e não encontrados. O caminho de persona `.Codex/commands/AIOX/agents/sm.md` também está ausente; usada a skill SM do projeto como fallback. Coerência cruzada estabelecida pelas stories relacionadas e pelo contrato de Instagram citados. Nenhum desses arquivos ausentes foi criado artificialmente.

Worktree isolada da base `6659f00c`, preservando alterações não relacionadas do workspace principal. Implementação local congelada pelos owners; esta consolidação Scribe/Kowalski altera somente a story e três memórias. Rollback da implementação será de código/artefatos da entrega, sem presumir exclusão ou regravação de dados.

### Correção TI/Admin observador — 2026-10-22

A ausência de alertas na sessão TI/Admin decorre do filtro setorial em `listarDestinatariosFilaLeadsBpm`, compartilhado por GET, fanout e lookup virtual. O bypass administrativo de visualização não era inscrição na audiência. O pedido posterior autoriza acrescentar observadores TI/Admin, sem converter CEO em observador ou alterar a política de assunção setorial. As negativas de audiência Admin registradas na homologação anterior são históricas e deixam de ser o comportamento esperado para leitura após a correção; as negativas de claim nativo permanecem esperadas.

Contrato e blueprint no adendo da arquitetura: helper `ehObservadorTiAlertasLeadsBpm` normaliza somente `Admin`/`TI`, usando papel carregado do banco, nunca sessão/client input como autoridade. O recipient observador tem `podeAgir=false`. GET paginado, fanout privado e `ObterLeadPendenteNotificacaoBpm` compartilham essa audiência. `obterRecebimentoPipelineBpm` e `assumirRecebimentoPipelineBpm` reafirmam o setor do ator para que audiência ampliada não vire autorização de mutação. Não há mudança de DTO/rota, UI extra, modal readonly novo ou exceção para testes; promoção virtual mantém suas permissões anteriores.

Verificar todos os adapters, inclusive origem desconhecida NoLoss, Operacional de chave nula/ID canônico, inatividade/revogação e destinos já assumidos. Testes devem provar leitura/central/fanout/abertura para Admin/TI, exclusão do CEO apenas da nova exceção, negação de claim nativo sem writes e clique sem claim/promoção/encaminhamento. Lookup virtual é readonly; primeiro acesso/SLA preexistentes do detalhe nativo não mudam. Novos resultados ficam separados das evidências históricas; logs/relatório remoto privados são referenciados após sua execução, sem exigir novo commit apenas para atualizar status remoto.

## Tasks / Subtasks

- [x] Registrar pedido, esclarecimentos explícitos, escopo por setor e checklist de draft (AC 1–17).
- [x] Consolidar contrato de arquitetura: audiência, elegibilidade por origem/pipeline, identidade estável, recuperação, resolução e destino virtual/nativo (AC 1–9, 11).
- [x] Implementar projeção/consulta autenticada somente leitura e integração de atualização pelo transporte existente (AC 1–3, 5, 8–9).
- [x] Integrar fonte compartilhada à central e toasts, com cor/origem textual, resumo e separação de leitura/resolução (AC 2–5, 7, 10).
- [x] Conectar clique ao protocolo existente de abertura do lead/modal e opções de assunção, sem atribuição automática (AC 6, 8).
- [x] Conciliar assunção, revogação, troca de conta e respostas atrasadas; deduplicar entradas/toasts sem esconder pendências (AC 4–9).
- [x] Cobrir cenários focados unitários, API/integração SQLite, segurança e React do plano de testes (AC 1–11, 13–17); smoke autenticado remoto e gates gerais seguem separados.
- [x] Executar quatro gates, revisão de QA e CodeRabbit/fallback documentado (AC 12).
- [x] DevOps publicar e verificar somente staging; atualizar checklist, File List, evidências e limitações (AC 12).
- [x] Registrar confirmação explícita do usuário sobre audiência e novo fluxo Financeiro/Operacional (AC 13–15).
- [x] Implementar recepção/claim nativo transacional, responsáveis por setor e preservação de vendedor/campos de origem (AC 13–15).
- [x] Conectar proveniência site opcional no ingresso real e recuperação completa/realtime mínimo (AC 16–17).

### Checklist do delta TI/Admin (AC 18)

- [x] Mapear causa, definir exceção TI/Admin exclusiva e registrar contrato antes do código.
- [x] Implementar observação no ponto compartilhado GET/fanout/lookup e defesa setorial explícita do claim, sem ampliar os demais bypasses.
- [x] Atualizar testes de audiência/segurança/SQLite e navegação afetados; preservar lifecycle, cores e políticas anteriores.
- [x] Executar os quatro gates sobre o delta congelado e revisão independente local; registrar evidências e limites reais.
- [ ] Publicar a correção no staging e executar smoke visual TI/Admin autenticado; registrar o resultado privado sem novo commit documental.

## Testing

Usar Vitest e os harnesses existentes em `tests/bpm/` e testes da central, com leads sintéticos, sessão e transporte controlados. Testes com escrita usam banco local isolado ou mocks adequados; não usar ingestão remota de dados reais para fabricar evidência.

- **Elegibilidade/audiência:** dois closers autorizados veem o mesmo lead; outro setor/pipeline/organização sem acesso não vê; usuário desativado ou acesso revogado é excluído. Diferenciar lead pendente e já assumido, origem Instagram/site/outra e campos opcionais ausentes.
- **Ciclo compartilhado:** clicar, ler, fechar toast, limpar todas, recarregar e reconectar mantêm a pendência na central. Assunção válida por A remove para A e B após conciliação; falha mantém para ambos; resposta antiga recebida depois não ressuscita o lead. Duas tentativas de assunção preservam um vencedor e não duplicam efeitos.
- **Deduplicação:** mesma identidade em polling/realtime/foco não repete toast; chegada diferente gera notificação; troca de conta limpa estado; persistência local não guarda conteúdo de cliente. Usuário ausente recupera pendências ao voltar.
- **Recepção por setor:** novo handoff e repetição; dois claims concorrentes e replay; responsável nominal não assume; Comercial/Financeiro preservados no Operacional, vendedor não muda; mover etapa não resolve e cards legados não são convertidos. Admin fora do setor não ganha claim por bypass; visualizadores do setor recebem sem `podeAgir`, com motivo caso não possam assumir, e a guarda Boas-vindas permanece.
- **Navegação:** toast e central abrem lead virtual e card nativo apropriados; existe/não existe aba CRM; trocar rapidamente A→B mantém último clique; reabrir após fechar modal; mensagens/frame/origem inválidos rejeitados; clique não invoca assunção.
- **Segurança/contrato:** sessão ausente, parâmetros adulterados, pipeline sem acesso, limite organizacional e canal não autorizado; GET sem escrita/promoção/worker/histórico; payload mínimo sem publicidade/segredos. Dados da UI não substituem ACL server-side.
- **Regressão/UX:** cores e origem textual, rótulos e teclado, responsividade; tarefas continuam reconhecendo leitura como antes; demais fontes e contadores permanecem corretos.
- **Gates:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, seguidos de revisão independente e smoke em staging com contas/fixtures autorizadas. Registrar fronteiras efetivamente verificadas; não declarar teste multicliente real quando só coberto por harness.

Sucesso: critérios demonstrados por resultados verificáveis, sem pendência resolvida reaparecer e sem lead ainda não assumido ser ocultado por leitura. O tempo de propagação observado é registrado no smoke; não prometer entrega instantânea se o transporte efetivo usar recuperação periódica.

## 🤖 CodeRabbit Integration

### Story Type Analysis

**Primary Type:** Integration. **Secondary Types:** API, Frontend, Security. **Complexity:** High — audiência por pipeline, pendência compartilhada, leitura individual, assunção concorrente e navegação de entidade virtual.

### Specialized Agent Assignment

`@dev` implementa e revisa pre-commit; `@architect` fecha os contratos e limites de autorização; `@ux-design-expert` verifica estados/cores/acessibilidade; `@qa` revisa isolamento, concorrência e regressões; `@devops` publica staging. Vault somente se for proposta alteração estrutural abrangida pela política do projeto.

### Quality Gate Tasks

- [x] Pre-Commit (`@dev`): revisão de implementação/contratos, testes, lint, typecheck e build.
- [x] Pre-Push (`@devops`): delta isolado, evidências reais, ausência de segredos e destino staging.
- Pre-PR: N/A nesta preparação; revisar se PR for solicitado.
- Pre-Deployment de produção: N/A, produção não autorizada.

### Self-Healing Configuration

`@dev`: light, até 2 iterações/15 minutos, CRITICAL corrigido e HIGH documentado. `@qa`: full, até 3 iterações/30 minutos para CRITICAL/HIGH; MEDIUM documentado como dívida. `@devops`: check/report-only. LOW pode ser ignorado. Se CLI indisponível, registrar e seguir fallback de revisão independente previsto no core-config, sem declarar execução inexistente.

### Focus Areas

Autorização de audiência e destino no servidor; separação entre leitura e resolução; deduplicação e respostas atrasadas; fonte canônica de assunção; recuperação sem efeitos; payload comercial mínimo; contraste/teclado e não regressão das demais fontes.

## Gates globais e preparação de publicação — DevOps

Forge real sobre a base `6659f00c`: typecheck oficial **exit 0** (8,54 s), lint **exit 0** (52,24 s; zero erros e 1.193 avisos existentes), build equivalente supervisionado Prisma/player/Next **exit 0** (158,36 s), suíte completa com cobertura **720 arquivos e 5.739 testes aprovados, zero falhas, quatro skipped e um todo** (179,42 s). Sentinel SQLite privado/local e variáveis sanitizadas; nenhum `.env` remoto carregado. Smoke compilado anônimo confirmou raiz, asset, providers, sessão e proteção do CRM; servidor encerrado. Custódia `c0e061779b0b1ebac93989268b3b1d60d9e25f2cbdd6408677b7afab527f7c59` idêntica antes/depois e após o smoke. Evidência privada: `/var/tmp/alpha-crm-notificacoes-leads-20261022/forge/forge-result.json`.

Manifesto e File List concordam nos 54 caminhos desta entrega; scan de segredos sem achados. Staging avançou para `f7ceefdb`, data original do formulário Instagram, com dez caminhos externos e três sobreposições. A integração normal está autorizada; hunk de import em Cards foi ratificado por Echo para unir ambos os helpers de Instagram e preservar integralmente o import de recebimentos. Board e teste têm preview 3-way limpo. Nesse checkpoint histórico, os checks combinados e a validação remota ainda pendiam; foram concluídos nas seções seguintes.

Configuração preexistente de liderança foi completada pelo fluxo administrativo normal já autorizado do usuário: Admin real1 adicionou somente o override `crm/ADD` da conta10 no staging. SELECT independente confirmou linha47/criadoPor1, motivo executado e doze assertivas aprovadas; cinco módulos anteriores, role, status, legado, outro override e regras pertinentes do setor preservados. A política reconstruída passou de zero para um assumidor elegível em Boas-vindas; isso não equivale a login/claim como Vitor. DevOps não executou mutação SQL, worker, alteração de conta, schema ou ambiente. Evidência privada `vitor-crm-after-proof.json`. Nenhuma operação de produção integra esta entrega.

## Integração e liberação pré-push — staging

A entrega foi congelada em `67f14b93` (54 caminhos) antes da integração normal de `f7ceefdb`. Preservados byte a byte os 51 caminhos próprios e sete externos sem sobreposição. Cards, Board e teste Kanban correspondem ao merge 3-way independente; o único conflito textual foi a união mínima de imports ratificada por Echo. Os helpers de data do formulário e os de recebimento foram mantidos integralmente, sem estratégia de substituir arquivos por ours/theirs. Prova privada: `release/merge-f7-proof.json`.

Árvore combinada: typecheck oficial **exit 0** (20,42 s), lint dos cinco fontes afetados **exit 0** (2,32 s) e suíte completa com cobertura **720 arquivos, 5.756 testes aprovados, zero falhas, quatro skipped e um todo**, em 171,67 s. Nenhuma correção adicional de código foi necessária. Custódia `3412c7bb06b0443b2b060b1fb04a1e92c3de467b5f7f2b25f396ee5109f58c10` idêntica antes/depois. QA ratificou GO de push normal staging após conferir os resultados e os hunks. Evidência privada: `/var/tmp/alpha-crm-notificacoes-leads-20261022/release/combined-f7-result.json`.

Build local combinado não foi repetido sem mudança de configuração/dependências: os builds-base aprovados e revisão dos hunks sustentam a integração, mas **build remoto final READY, SHA/alias e smoke autenticado continuam obrigatórios antes de concluir**. API Vercel com token existente responde 403; não houve reautenticação nem mudança de credenciais. A verificação operacional usará status Vercel no GitHub vinculado ao commit e ID de deployment nos assets do endereço canônico de staging; a base `f7ceefdb` já teve essa correspondência confirmada. Publicação e homologação remota pendiam nesse checkpoint pré-push; a conclusão factual está registrada a seguir. Produção não autorizada.

## Publicação e homologação concluídas — staging

Merge normal `60ae49ff` publicado, preservando a feature `67f14b93` e o formulário Instagram `f7ceefdb`. GitHub/Vercel registrou Deployment has completed para o SHA e `dpl_x5PS1gz68aTR611tBtH3dBD2hSMa`; o HTML de staging referenciou o mesmo deployment em duas leituras. Smoke público: raiz/providers/sessão anônima/broadcast 200, banco acessível e CRM protegido. A API Vercel continua 403, portanto não se alega releitura de ENV/customEnvironment pela API; nenhuma credencial ou ENV foi alterada.

Admin real criou uma negociação fictícia pela UI e executou os dois encaminhamentos normais, chegando a três cards/três vínculos/duas recepções PENDENTE, sem claim. Os quadros/painéis exibiram aguardando assunção e a negação correta para Admin fora do setor; vendedor apresentado nominalmente e preservado. Etapa Financeiro Concluido com lifecycle ATIVO não resolveu sua recepção. Nenhum responsável Financeiro foi inventado no snapshot Operacional. Elaboração/envio/assinatura/pagamento/NF vazios, zero documentos e anexos.

Read-model canônico privado com atores Financeiro e liderança Operacional efetivamente persistidos: três páginas completas por ator, 109 leituras guardadas, zero writes/raw/transações. Cada um recebeu somente a pendência fictícia de seu setor e capacidade de assumir no próprio card; cruzamento negado. Prisma default e cliente passado em todas as páginas foram guardados no processo diagnóstico. Isso não equivale a login/claim positivo dessas contas. Não houve sessão forjada, ingestão IG/site ao vivo ou toast multicliente remoto; esses caminhos e a concorrência positiva têm cobertura local.

A homologação observou zero pageerrors JavaScript, cinco respostas 503 de voz Bibble e avisos de geolocalização/allowfullscreen/descrição de diálogo; não se declara console/rede inteiramente limpos. Falhas do harness de captura após criar a fixture e do loader CJS inicial foram preservadas como problemas da automação, sem duplicar criação nem alterar o app. Perfil CLI de staging verificado por fingerprints; produção/estrutura/backfill/worker manual fora do escopo. Relatório sanitizado: [CRM notificações — staging](../reports/crm-notificacoes-leads-staging-20261022.md).

## Gates da correção TI/Admin — liberação local pré-push

Fonte backend limitada a `notificacoes-leads-server.ts` e `recebimentos-card-server.ts`; testes de segurança/SQLite atualizados. Observador Admin/TI é definido por papel persistido normalizado, com `podeAgir=false`; audiência ampliada não concede claim nativo fora do setor. Lookup é readonly; o clique não promove/assume/encaminha automaticamente e preserva primeira visualização/SLA preexistentes do detalhe.

Forge executou uma rodada completa real: typecheck oficial8GiB **exit0/47,36s**, lint **exit0/52,40s** (1.193 warnings existentes, zero erros), novo build equivalente Prisma/player/Nextwebpack **exit0/216,68s** (heap4GiB/CPU1, capRSSpróprio7GiB; pico6.474.780.672bytes), `npm test` com cobertura **exit0/193,11s: 720 arquivos, 5.784 PASS, zero falhas, quatro skipped e um todo**. Custódia `1fc1f5e59524c39c21890cd031376f8bc949474cfd7217f7d19c830b169600a9` igual antes/depois. Segurança90 e SQLite9 são checks focados incluídos na suíte, não contagem adicional. Todos os gates usaram env sanitizado e SQLite local privado, sem `.env` remoto.

Prisma compartilhado de outra worktree tinha coluna incompatível com a fixture. O harness foi corrigido com farm de dependências/client próprios e geração de output privado a partir de cópia do schema, sem alterar schema fonte, versões ou client compartilhado (hash antes/depois idêntico). Falha inicial preservada; nove SQLite passaram após isolar o artefato. Aprendizado em `.bibble/memory/known-errors.md`.

QA/Lens/Probe/Anubis aprovaram o patch local após Forge; CodeRabbit indisponível usa o fallback de revisão independente, sem alegar execução. Build remoto/alias e teste visual Admin da nova audiência permanecem pendentes neste checkpoint pré-push, com resultado posterior somente privado. Não foi repetido smoke loopback amplo: a homologação autenticada real é a próxima verificação. Evidências em `/var/tmp/alpha-crm-notificacoes-ti-observador-20261022/forge/forge-result.json`, `focused-sqlite-result.json` e `private-client-generate-result.json`. Não há migration, ENV, SQLDML/worker manual ou ação de produção.

## File List

Consolidada dos manifests de backend/frontend e do teste de QA: 54 caminhos próprios da entrega funcional mais relatório e known-errors, total cumulativo de 56 caminhos únicos. O patch TI/Admin sobre `69047dee` altera 11 caminhos: dois runtime, dois testes, arquitetura/story/relatório e quatro memórias; não adiciona dependência ou schema. Não inclui os dez caminhos externos de `f7ceefdb` como autoria desta feature, logs privados ou dados reais.

- `src/lib/bpm/notificacoes-leads.ts` — DTOs, schemas e apresentação neutros de alertas/recepções.
- `src/lib/bpm/notificacoes-leads-server.ts` — projeção autorizada, audiência, paginação e invalidação por usuário.
- `src/lib/bpm/recebimentos-card-server.ts` — prova de recepção, responsáveis por setor e claim CAS transacional.
- `src/lib/bpm/campos-configuraveis-server.ts` — vendedor comercial preservado no resolver canônico.
- `src/lib/bpm/automacoes/encaminhamento.ts` — recepção no destino realmente novo e integração pós-commit.
- `src/actions/bpm/Recebimentos.ts` — action autenticada de claim nativo.
- `src/actions/bpm/NotificacoesLeads.ts` — lookup autorizado de lead virtual para navegação.
- `src/actions/bpm/Cards.ts` — integração da fonte de leads/recepção aos fluxos existentes.
- `src/actions/bpm/InstagramLeads.ts` — integração da fonte de leads/recepção aos fluxos existentes.
- `src/actions/bpm/NolossLeads.ts` — integração da fonte de leads/recepção aos fluxos existentes.
- `src/actions/bpm/Encaminhamentos.ts` — integração da fonte de leads/recepção aos fluxos existentes.
- `src/app/api/bpm/leads/alertas/route.ts` — GET readonly paginado de alertas.
- `src/app/api/bpm/noloss-leads/ingest/route.ts` — integração da fonte de leads/recepção aos fluxos existentes.
- `src/app/api/integrations/instagram/leads/route.ts` — integração da fonte de leads/recepção aos fluxos existentes.
- `tests/bpm/notificacoes-leads-sqlite.test.ts` — cobertura focada ou adaptação do harness de regressão da integração.
- `tests/bpm/encaminhamento-sqlite.test.ts` — cobertura focada ou adaptação do harness de regressão da integração.
- `tests/bpm/encaminhamento-auditoria.test.ts` — cobertura focada ou adaptação do harness de regressão da integração.
- `tests/bpm/financeiro-operacional-handoff.test.ts` — cobertura focada ou adaptação do harness de regressão da integração.
- `docs/integrations/instagram-leads.md` — documentação de origem e ingresso NoLoss opcional.
- `src/store/useBpmLeadsNotificacoes.ts` — integração da fonte de leads/recepção aos fluxos existentes.
- `src/components/bpm/notificacoes/LeadNotificacaoToast.tsx` — toast reutilizado pela central/hook com origem, detalhes e navegação.
- `src/hooks/bpm-leads-notificacoes-client.tsx` — integração da fonte de leads/recepção aos fluxos existentes.
- `src/hooks/useBpmTarefasNotifications.ts` — integração da fonte de leads/recepção aos fluxos existentes.
- `src/hooks/useBpmCardNotificacaoNavigation.ts` — integração da fonte de leads/recepção aos fluxos existentes.
- `src/hooks/useBpmNotificacaoBoardNavigation.ts` — integração da fonte de leads/recepção aos fluxos existentes.
- `src/lib/bpm/notificacoes-navegacao.ts` — integração da fonte de leads/recepção aos fluxos existentes.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelRecebimentoCard.tsx` — painel de responsáveis por setor, motivo e ação explícita de assumir.
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx` — integração da fonte de leads/recepção aos fluxos existentes.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` — integração da fonte de leads/recepção aos fluxos existentes.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/page.tsx` — integração da fonte de leads/recepção aos fluxos existentes.
- `src/components/layout/CentralNotificacoesPainel.tsx` — integração da fonte de leads/recepção aos fluxos existentes.
- `tests/bpm/leads-notificacoes-store.test.ts` — cobertura focada ou adaptação do harness de regressão da integração.
- `tests/bpm/leads-notificacoes-client-react.test.ts` — cobertura focada ou adaptação do harness de regressão da integração.
- `tests/bpm/leads-notificacoes-hook-react.test.ts` — cobertura focada ou adaptação do harness de regressão da integração.
- `tests/bpm/leads-notificacoes-navegacao.test.ts` — cobertura focada ou adaptação do harness de regressão da integração.
- `tests/bpm/leads-central-react.test.ts` — cobertura focada ou adaptação do harness de regressão da integração.
- `tests/bpm/leads-board-navigation-react.test.ts` — cobertura focada ou adaptação do harness de regressão da integração.
- `tests/bpm/recebimento-card-react.test.ts` — cobertura focada ou adaptação do harness de regressão da integração.
- `tests/bpm/tarefas-notificacoes-hook-react.test.ts` — cobertura focada ou adaptação do harness de regressão da integração.
- `tests/bpm/tarefas-notificacoes-navegacao-react.test.ts` — cobertura focada ou adaptação do harness de regressão da integração.
- `tests/bpm/tarefas-notificacoes-board-react.test.ts` — cobertura focada ou adaptação do harness de regressão da integração.
- `tests/bpm/movimento-livre-react.test.ts` — cobertura focada ou adaptação do harness de regressão da integração.
- `tests/bpm/board-visao-equipe-react.test.ts` — cobertura focada ou adaptação do harness de regressão da integração.
- `tests/bpm/board-polling-react.test.ts` — cobertura focada ou adaptação do harness de regressão da integração.
- `tests/bpm/movimentacao-importados-rd-react.test.ts` — cobertura focada ou adaptação do harness de regressão da integração.
- `tests/bpm/kanban-card-origem-agendar-react.test.ts` — cobertura focada ou adaptação do harness de regressão da integração.
- `tests/bpm/arquivamento-modal-react.test.ts` — cobertura focada ou adaptação do harness de regressão da integração.
- `tests/bpm/tarefas-alertas-foco-react.test.ts` — cobertura focada ou adaptação do harness de regressão da integração.
- `tests/bpm/notificacoes-leads-seguranca.test.ts` — cobertura focada ou adaptação do harness de regressão da integração.
- `docs/architecture/crm-notificacoes-leads-sem-responsavel-20261022.md` — contrato, escopo e evidências da entrega.
- `docs/stories/story-crm-notificacoes-leads-sem-responsavel-20261022.md` — contrato, escopo e evidências da entrega.
- `.bibble/memory/codebase-map.md` — checkpoint histórico e fechamento factual Scribe/Kowalski/DevOps.
- `.bibble/memory/integration-points.md` — checkpoint histórico e fechamento factual Scribe/Kowalski/DevOps.
- `.bibble/memory/journal.md` — checkpoint histórico e fechamento factual Scribe/Kowalski/DevOps.

- `docs/reports/crm-notificacoes-leads-staging-20261022.md` — validação histórica e adendo TI/Admin com evidências sanitizadas e limites reais.
- `.bibble/memory/known-errors.md` — isolamento do client Prisma divergente entre worktrees, sem mudar schema ou client alheio.

## Story Draft Checklist

| Categoria | Resultado | Evidência |
| --- | --- | --- |
| Objetivo e contexto | PASS | Pedido, valor e audiência/claim por setor confirmados explicitamente. |
| Orientação técnica | PASS | Fontes existentes, contratos comportamentais e gate arquitetural antes das interfaces. |
| Referências | PASS | Stories e contrato de Instagram com seções específicas e conteúdo resumido. |
| Autossuficiência | PASS | Ciclo de vida, segurança, decisões, casos de erro e limites descritos. |
| Testes | PASS | Cenários mensuráveis por camada e quatro gates definidos. |
| CodeRabbit | PASS | Tipos, agentes, checkpoints, self-healing e foco presentes. |

**Resultado do draft preservado:** havia clareza para implementar Comercial e Financeiro/Operacional conforme confirmação do usuário. O draft precedeu a implementação; checks focados isolados não constituem gates globais nem homologação. As seções de fechamento e QA registram os resultados efetivamente concluídos.

## Dev Agent Record

### Agent Model Used

Echo — backend; Nova — frontend; Scout/Architect — contratos; Forge — gates reais; QA — revisão independente; Scribe/Kowalski e DevOps — consolidação, integração e publicação. Modelos herdados da sessão.

### Debug Log References

Evidências privadas em `/var/tmp/alpha-crm-notificacoes-leads-20261022/`: `forge/forge-result.json` e `forge/gate-runtime-result.json`; `release/combined-f7-result.json`, `merge-f7-proof.json`, `publication.json`, `github-stage-ready-stable.json`, `public-http-smoke.json`, `fixture-operational-final.json` e `read-model-operational-final.json`. Owners: frontend 100/18, backend 182/12 (incluindo 64 adversariais e sete SQLite), sem somar subconjuntos. OOM frontend com heap4 GiB foi anterior ao gate oficial aprovado. Harness CLI CJS precisou loader ESM; tentativa original registrada sem mudança runtime.

UI real em diretório privado distinto `/var/tmp/alpha-crm-notificacoes-leads-sem-responsavel-20261022/`: `remote-browser-result.json`, `operational-panel.json`, `operational-board.json` e prova do CRUD individual de permissão. Conteúdo bruto, imagens, credenciais e dados pessoais não são versionados.

### Completion Notes

Entrega funcional `60ae49ff` em staging, build remoto concluído e domínio correspondente, smoke público e Admin real aprovados, QA FINAL APPROVED. Audiência/capacidade setorial confirmada pelo helper real com DB staging somente leitura; não se afirma login ou claim positivo de sessões Financeiro/Operacional nem ingestão IG/site ou toast multicliente remoto. Um override aditivo pelo CRUD UI autorizado completou o CRM da liderança Operacional, preservando outros acessos. Nenhuma alteração de produção, ENV, schema, backfill ou execução manual de worker/global. Fechamento documental acompanha runtime idêntico à revisão funcional, sem repetir gates por Markdown.

## QA Results

Checkpoints históricos abaixo; a revisão final de staging ao fim desta seção substitui as pendências anteriores.


### 2026-10-22 — Quinn / Sage, Anubis, Probe e Lens — APPROVED local

**Parecer: APPROVED para a implementação local sobre `6659f00c`, fingerprint `c0e061779b0b1ebac93989268b3b1d60d9e25f2cbdd6408677b7afab527f7c59`.** Revisão de código e integração independente após quatro gates Forge PASS; sem bloqueador crítico/importante novo aberto. Este checkpoint libera integração/publicação em staging dentro das condições abaixo, sem declarar deploy, E2E setorial remoto ou Done já concluídos.

**Evidência objetiva:** `forge/forge-result.json` e `forge/gate-runtime-result.json` conferidos: typecheck oficial exit 0 (8,54 s); lint exit 0 (52,24 s, zero erros e 1.193 avisos preexistentes); pipeline Prisma + player + Next completo exit 0 (158,36 s, pico 6,21 GiB, execução supervisionada); `npm test` com cobertura exit 0 (179,42 s): **720 arquivos, 5.739 testes PASS, quatro skipped, um todo, zero falhas**. As 1.668 suites internas do JSON não são contadas como arquivos. Custódia idêntica antes/depois dos gates e smoke. Build compilado testado em loopback com SQLite sentinela local: raiz/JavaScript/providers/sessão 200 e CRM anônimo protegido por redirecionamento; servidor encerrado. Nenhuma credencial remota carregada nesses gates. A tentativa focada anterior de tipos com 4 GiB/OOM não substitui o typecheck oficial aprovado.

**Sage/Anubis:** 64 adversários independentes em `tests/bpm/notificacoes-leads-seguranca.test.ts` usam ownership, normalização de role, visibilidade, parser de recepção, resolver canônico e GET reais; apenas I/O/sessão/transporte são substituídos. Cobrem visualizadores F/O versus Comercial capaz de agir, lideranças reais dos três setores, Admin/CEO/TI fora do setor, CRM efetivo/REMOVE/inatividade, pipeline/etapa sem acesso, recibo forjado e inconsistências de card/empresa/vínculo/execução/evento/histórico/claim/setor, cursor vinculado à conta, entrada adulterada e GET sem writes. Pusher envia somente pipeline/timestamp ao canal privado existente e sua falha não altera persistência. As primeiras falhas Comercial/podeAgir e vendedor sem prova foram preservadas e corrigidas pelo owner; hardening do setor do claim também passou. Nenhuma fonte foi alterada por QA.

**Backend e preservação da negociação:** os sete cenários Prisma/SQLite reais exercitam paginação de 121 leads, ingresso NoLoss/UTMs omitidas, GET readonly sem SQL de escrita, fanout, novo handoff versus reuso, rollback de outbox, dois claims concorrentes/um vencedor e replay sem duplicar evento. Closer A → Financeiro B → Operacional C passa pelo resolver, resumo e `ObterCardBpm.camposEtapa.valorExibicao`, mantendo vendedor A. A fonte específica é confirmada por catálogo `alpha.vendedor.a`; demais campos continuam com o responsável atual. Falta/ambiguidade de prova comercial resulta em vazio, com fallback somente por vínculo inequívoco da mesma empresa. A fixture Operacional usa **ID canônico com chave NULL**: marcador, audiência, detalhe, Kanban e vendedor reconhecem o legado pelo helper existente, sem alterar sua configuração. A guarda Boas-vindas usa esse mesmo identificador tanto na projeção do CTA quanto no claim; sua negativa independente com chave operacional e o percurso SQLite com chave nula são evidências distintas, sem alegar um caso remoto de Boas-vindas já executado.

**Recepção é atribuição, não autorização ampla:** marker somente na criação real do destino, dentro da transação de card/vínculo/outbox; retry/destino existente não reinicia pendência. Parser exige identidade determinística, proveniência causal e empresa compatível; atribuição técnica não conta como assunção. Claim revalida ator ativo, CRM/setor, pipeline/visibilidade/ação e elegibilidade, CAS de versão/updatedAt, owner/membros/histórico/outbox no mesmo commit. O caso Financeiro pendente ATIVO já encaminhado administrativamente foi caracterizado em SQLite: pode assumir como atribuição, continua impedido de editar o source bloqueado e não reescreve retrospectivamente o snapshot Operacional.

**Probe/Lens:** conferidos producers de ingresso/claim/handoff, GET, actions novas, projeção física/virtual, central, store, hook e montagem no board/detalhe. Erros internos de GET/lookup têm mensagem genérica; a action de claim só devolve mensagens de negócio de famílias conhecidas, sem retorno genérico de `PrismaError.message` demonstrado. O wrapper `NotificacoesLeads.ts` aparece com 0% na cobertura instrumental porque seus testes de UI o substituem; isso é limite real, não prova de defeito nem alegação de cobertura total. Seu contrato foi revisado diretamente: sessão/schema estrito, fonte/audiência/pendência e retorno compatível com pipeline/lead/etapa. Os serviços e GET possuem execução real local.

| AC | Cenário e resultado local conferido |
| --- | --- |
| 1–3 / 17 | Dadas fontes canônicas, somente audiência autorizada recebe; IG roxo, site azul só com UTM comprovada e demais normal; dados ausentes não impedem a projeção. Ingresso omitido preserva UTM/promoção. |
| 4 / 7 / 10 | Dada pendência recebida, fechar toast/clicar/marcar todas/reload preserva central, sem novo toast; IDs vistos isolados por usuário e sem conteúdo persistido. Tarefas mantêm ciclo próprio. |
| 5 / 9 / 13–14 | Dada recepção válida, claim explícito CAS tem um vencedor; rollback não resolve, replay não duplica, reuso não cria nova recepção e readonly não recebe capacidade de trabalho. |
| 6 / 8 | Dado destino virtual fora da página, lookup autorizado abre modal existente sem promover; card real abre detalhe. Same-origin + source do iframe e ACK da intenção atual rejeitam navegação estrangeira/atrasada. |
| 7 / 16 | Dado snapshot paginado, só o conjunto completo concilia; segunda página/schema/cursor/snapshot inválidos preservam o anterior; invalidação durante request e troca de sessão descartam resposta antiga. |
| 11 / 12 | Sem diff de schema/deps/ENV, sem migração/backfill; quatro gates e smoke locais PASS. Commit/deploy/alias e verificação remota ainda são etapas posteriores. |
| 15 | Dado ABC com owners distintos, resolver e projeção real exibem vendedor Comercial A; cards anteriores, vínculos e estados financeiros não são substituídos pelo claim. |

Os 100 testes frontend em 18 arquivos incluem componentes reais com I/O simulado, central, coleta de páginas, navegação em iframe/board e tarefas; não são teste multicliente remoto. A negativa frontend de revogação executou especificamente HTTP 403; 401 compartilha o ramo no código e tem cobertura própria no endpoint independente. Polling de 30 s/foco/online/reconexão recupera ausência de realtime. Reaproveitam-se subscription/timer existentes, sem novo provider/dependência; projeção nativa faz leitura em lote e cache de audiência por pipeline/etapa na página. Não há medição remota de latência nem promessa de propagação instantânea. A regra anterior de modal keyed por card já protegia troca A→B; chave adicional por recepção é robustez, não correção de um bug reproduzido.

**Integração concorrente `f7ceefdb`: GO condicionado.** Delta completo de dez caminhos revisado: adiciona data original do formulário Instagram, sem schema/deps/ENV. Há três sobreposições textuais em Cards, board e teste Kanban; imports/novo atributo/render/data de captura são compatíveis com recepção e navegação desta entrega. DevOps deve preservar ambas as features por merge normal, provar hunks/manifests, executar typecheck oficial, lint dos cinco runtime afetados e **suíte completa combinada**. Não aprovar o combinado com base só nos gates acima. Os builds das fontes revistas podem ser herdados neste delta sem mudança de build inputs; o build remoto do SHA combinado deve atingir READY, com alias/SHA/ambiente corretos e smoke antes do fechamento. Nenhum push com sobrescrita de atualização concorrente é autorizado por este parecer.

**Limites remotos/configuração:** não houve login de Closer/Financeiro/Operacional nem assunção positiva remota nesta revisão. Admin fora do setor não ganha audiência/claim por bypass; smoke com essa conta deve verificar leitura/negativas honestamente. `vitor-crm-after-proof.json` registra PASS em doze asserts após configuração individual CRM ADD feita pelo Admin real via CRUD normal da UI de staging: mantém papel e permissões anteriores, altera só CRM e reconstitui política canônica. Isso não equivale a login/claim do usuário alvo e não significa zero escritas globais. QA não fez SQL remoto, worker, alteração de configuração/dados, Git ou produção. CodeRabbit ausente no PATH e em `~/.local/bin/coderabbit` nesta sessão; revisão independente acima é o fallback, sem varredura externa.

**Recomendação:** manter Ready for Review/publicação staging condicionada aos checks combinados e à validação remota; não marcar Done antes deles. Evidências privadas sob `/var/tmp/alpha-crm-notificacoes-leads-20261022/`: `forge/`, `qa-plan.md`, `qa-preliminary.md`, `qa-security.{log,json}`, primeiras rodadas separadas, resultados dos owners e prova de configuração. Dados brutos/credenciais não foram copiados para o Git. QA editou somente esta seção nesta revisão final; o arquivo de testes independente já consta na File List do owner. **Seção liberada ao executor após este checkpoint.**


### 2026-10-22 — Quinn — APPROVED final de staging, com alcance remoto delimitado

**Parecer: APPROVED; QA recomenda Done para a entrega publicada em staging, com os limites abaixo preservados.** Integração concorrente, compilação remota e homologação Admin concluídas; não se declara E2E autenticado multicliente nem autorização de produção.

**Combinado e publicação:** conferidos `release/combined-f7-result.json` e `merge-f7-proof.json`: typecheck oficial exit 0 (20,42 s), lint dos cinco runtime afetados exit 0 (2,32 s), suíte completa com cobertura exit 0 (171,67 s), **720 arquivos / 5.756 testes PASS, quatro skipped, um todo, zero falhas**. Fingerprint `3412c7bb06b0443b2b060b1fb04a1e92c3de467b5f7f2b25f396ee5109f58c10` idêntico antes/depois. Cinquenta e um caminhos próprios e sete concorrentes fora das sobreposições permaneceram byte a byte; três sobreposições conferem com a integração independente de três vias, incluindo apenas união de imports ratificada pelo backend em Cards. Sem marcadores/conflitos, descarte de arquivos ou push forçado. O runtime publicado é `60ae49ffeb3711592337b63225934ccb88119543`, pais `67f14b93` e `f7ceefdb`; deployment `dpl_x5PS1gz68aTR611tBtH3dBD2hSMa`, com sucesso Vercel observado pelo GitHub e identificação do mesmo deployment nos assets do alias `staging.alpha-comex.com`. Smoke público confirmou raiz/providers/sessão/broadcast e proteção do CRM anônimo. A API Vercel retornou 403 para o token disponível; não se afirma releitura independente de `customEnvironment` ou valores ENV por essa API. Nenhuma configuração de deploy/ENV foi alterada para publicar.

**UI autenticada real:** Admin1 criou somente a negociação fictícia da empresa 3069, Comercial `cmvjl1fjy000008ia6hxom5x3`, e usou os envios administrativos explícitos para Financeiro `cmvjl9san000408kuihagcc29` e Operacional `cmvjlcpfr000l08kuhl0tajx0`. Não houve assunção. Financeiro e Operacional mostraram “Responsável no Comercial: ADM”, o setor atual ainda não assumido, motivo de impedimento e **zero botões Assumir para Admin fora do setor**. Os dois quadros exibiram “Aguardando assumir”. No Operacional → Boas vindas, o seletor Vendedor responsável exibiu **ADM**, mantendo `value=1` como referência interna. A consulta real de alertas desse Admin percorreu três páginas HTTP 200 e retornou zero entradas; o bypass administrativo não o inscreveu como destinatário do setor. O diálogo de envio esclareceu que não confirma assinatura, pagamento, NF ou conclusão financeira.

**Persistência independente:** `fixture-operational-final.json` confirmou três cards ATIVO com owner técnico 1, três vínculos e duas recepções PENDENTE, sem assunção; nenhuma foi inferida do owner ou do movimento de etapa. Comercial v2, Financeiro v2 e Operacional v0; `concluidoEm/statusPosFechamento` nulos. Financeiro estar na coluna “Concluido” não foi apresentado como status financeiro concluído. Vendedor persistido 1 e origem Orgânico; elaborado/enviado/assinatura/pagamento/NF permanecem nulos, sem documentos ou anexos criados. Operacional real tem chave NULL e ID canônico, portanto a compatibilidade legada foi observada também na UI/recepção remotas. Como Financeiro não foi assumido, o snapshot anterior do Operacional contém somente Comercial, sem inventar responsável financeiro.

**Diagnóstico de audiência com dados atuais, separado de login:** `read-model-operational-final.json` executou a projeção canônica do runtime publicado com Prisma limitado a reads; 109 operações de leitura, zero writes, raw SQL ou transações, nenhum bloqueio acionado. Cada ator percorreu as três páginas completas. O usuário Financeiro 7 recebe somente a recepção Financeiro e tem `podeAssumir=true`; o líder Operacional 10 recebe somente a recepção Operacional e tem `podeAssumir=true` em Boas vindas; os destinos cruzados são negados. Essas são chamadas diagnósticas server-side com IDs e ACL persistidas, **não sessões autenticadas, JWTs ou claims desses usuários**. Complementam a prova local e a UI Admin, sem substituí-las por um teste remoto positivo de assunção.

**Limites e observações:** assunção positiva com Financeiro/Vitor, dois clientes reais recebendo/resolvendo toast e ingresso Instagram/site autenticado não foram exercitados remotamente; não havia credenciais dessas contas nem segredos de ingestão disponíveis no perfil de staging. ABC, concorrência, replay, rollback, proveniência, cores/toast, snapshots e navegação permanecem demonstrados por Prisma/SQLite/React locais e revisão dos contratos. A sessão de navegador registrou zero `pageerror`, mas não console/rede limpos: cinco HTTP 503 de `/api/bibble/voice`, abortos em navegação/prefetch e avisos de geolocalização/policy, precedência de fullscreen e descrição Radix. Nenhuma nova exceção JavaScript da entrega foi demonstrada; esses eventos não foram convertidos em correções de outros módulos. Browser e processo de teste foram encerrados. Não se alega latência instantânea ou ganho percentual.

**Fechamento:** a configuração individual CRM do líder continua documentada como CRUD autorizado de staging e verificada em doze asserts, sem alegar login do alvo. QA não fez mutações remotas, worker manual, mudança de ambiente, schema, backfill ou ação de produção. Leituras de conferência não devem ser confundidas com as ações UI legítimas que criaram a fixture e com essa configuração. O último commit documental pode fechar status/checklist/File List preservando o runtime/dependências/testes publicados; sua identidade de deploy será verificação mecânica de DevOps, sem repetir gates por mudança só documental.

Evidências privadas: `/var/tmp/alpha-crm-notificacoes-leads-20261022/release/{combined-f7-result,merge-f7-proof,publication,public-http-smoke,fixture-operational-final,read-model-operational-final}.json`; UI em `/var/tmp/alpha-crm-notificacoes-leads-sem-responsavel-20261022/{finance-panel,operational-panel,remote-browser-result,fixture}.json`, imagem do painel Operacional conferida. Nenhum JSON bruto de navegador, conteúdo de outros clientes ou credencial foi versionado por QA. **Somente QA Results foi atualizado nesta conclusão; arquivo liberado para o commit documental de DevOps.**


### 2026-10-22 — Quinn — AC18 TI/Admin observador: APPROVED local / GO staging

**Parecer: APPROVED para a correção local sobre `69047dee`; GO para commit/push normal exclusivamente staging, com teste visual remoto pendente.** Os pareceres anteriores descrevem o contrato e os runtimes anteriores. O AC18 posterior substitui a exclusão de Admin/TI apenas na audiência de leitura; a negação de assunção nativa permanece válida. Recomenda-se **Ready for Review / validação remota pendente**, sem novo Done ou alegação de publicação nesta revisão.

**Forge novo conferido, não herdado da entrega anterior:** `forge/forge-result.json` em `/var/tmp/alpha-crm-notificacoes-ti-observador-20261022/`: typecheck exit 0 (47,36 s), lint exit 0 (52,40 s; zero erros e 1.193 avisos existentes), novo pipeline Prisma/player/Next exit 0 (216,68 s, pico RSS 6.474.780.672 bytes), suíte completa com cobertura exit 0 (193,11 s): **720 arquivos / 5.784 testes PASS, quatro skipped, um todo, zero falhas**. As 1.669 suites internas não são apresentadas como arquivos. Fingerprint `1fc1f5e59524c39c21890cd031376f8bc949474cfd7217f7d19c830b169600a9` inalterado antes/depois. Prisma privado foi gerado localmente do schema fonte preservado para isolar a fixture do client compartilhado; não houve migration, mudança de schema ou banco remoto nos gates.

**Lens/Anubis:** diff dos dois módulos de runtime e dos dois arquivos de teste confrontado com AC18/adendo; nenhum bloqueante crítico/importante novo. `ehObservadorTiAlertasLeadsBpm` usa `normalizeRole` e compara exatamente ADMIN/TI, incluindo T.I, sem usar o bypass que inclui CEO. Conta e papel vêm da leitura canônica de usuários ativos/CRM efetivo. Pipeline/etapa ativos e ACL de leitura continuam exigidos; não se inventa revogação contrária à política de bypass administrativo existente. O ramo observador sempre retorna `podeAgir=false`. Tanto o CTA quanto a mutação nativa exigem explicitamente setor compatível, além de elegibilidade/visibilidade/guardas atuais; a audiência ampliada não vira autorização para assumir. Boas-vindas e Operacional por ID canônico/chave NULL permanecem cobertos. Não foram alteradas as permissões administrativas preexistentes de promoção virtual.

**Sage:** arquivo independente passou de 64 para **90 casos**, com 26 novos adversários e expectativas antigas atualizadas somente quanto à audiência Admin/TI. Helper positivo/aliases, CEO e papéis parecidos negativos, inatividade, pipeline/etapa/tipo de fila, papel do banco versus role forjada da sessão, lookup virtual readonly e recusa de claim Financeiro/Operacional legado preservando owner, membros, versão, histórico e outbox. ESLint próprio sem erros/avisos. Evidências separadas em `/var/tmp/alpha-crm-notificacoes-leads-20261022/ti-observador-qa-security.{log,json}`; os resultados antigos não foram sobrescritos nem reapresentados como validação deste delta.

**Probe/integração real local:** **nove cenários Prisma/SQLite privados PASS** (`focused-sqlite-result.json`) exercitam GET paginado e a action de lookup reais para Instagram/site/NoLoss desconhecido, inclusive fora da primeira página; mesmos resultados para Admin/TI observadores, CEO excluído. Fanout continua mínimo em canais privados individuais; autenticação Pusher existente exige a própria identidade de sessão e CRM efetivo. Em F/O, observadores abrem o card real mas não assumem: tentativa recusada sem SQL de escrita de claim ou mudança de owner/membros/versão/recepção; inativação retira acesso, perda de CRM do ator setorial retira sua pendência, e claim setorial legítimo resolve o alerta também para o observador. Os testes de ABC, reuso/CAS e snapshot continuam passando. Sem novo DTO, route, provider, poller, frontend ou canal; GET/fanout/lookup compartilham o mesmo ponto de audiência, e hook/central/handshake existentes continuam conectados.

**Limites corretos do clique:** GET e lookup virtual permanecem readonly; clicar não chama promoção, claim ou encaminhamento. Abrir detalhe nativo via `ObterCardBpm` pode registrar primeira visualização/SLA pela política anterior, portanto a aprovação não promete zero escrita global ao abrir um card. Essa distinção está no contrato e foi respeitada na revisão dos testes. CodeRabbit continua indisponível no PATH nesta sessão; revisão independente é o fallback, sem varredura externa ou execução fictícia.

**Próxima verificação, após deploy:** conferir SHA/alias/ambiente e usar a sessão Admin legítima contra as duas recepções existentes da fixture 3069. Demonstrar GET completo, toast/central, clique para o card certo, permanência da pendência e zero assunções, sem novas fixtures/credenciais forjadas/worker ou republicação de eventos antigos. O baseline autenticado anterior retornou zero alertas e não valida o comportamento corrigido. Este commit único deve conservar o estado Ready for Review e a pendência remota explícita; a evidência posterior pode ser registrada privadamente pelo executor sem inventar segundo commit documental. Nenhuma configuração ENV, backfill ou publicação em produção é autorizada por este GO.

QA alterou exclusivamente seu arquivo de testes autorizado nesta correção e **somente QA Results nesta revisão final**; fontes e documentos dos demais autores preservados. **Arquivo liberado a DevOps para o commit único e publicação staging.**

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-22 | 1.0 | Story preparada a partir do pedido atual; núcleo Comercial e novo fluxo Financeiro/Operacional pendente; checklist de draft aplicada. | River / SM |
| 2026-10-22 | 1.1 | Esclarecimento do usuário: todos do setor, recepção/Assumir Financeiro e Operacional, responsáveis anteriores e vendedor preservados; contrato de arquitetura definido. | Aria / Architect (atualização autorizada) |

| 2026-10-22 | 1.2 | Checkpoint da implementação congelada: escopo/AC 1–17, evidências focadas, File List e memórias; Forge, QA final e staging ainda pendentes. | Scribe / Kowalski |

| 2026-10-22 | 1.3 | Done: gates combinados, staging60ae e homologação Admin/diagnóstico readonly aprovados; relatório e memórias finais com limites explícitos. | DevOps / QA |

| 2026-10-22 | 1.4 | Reabertura pelo usuário: TI/Admin como observadores de notificações; CEO excluído da exceção e claim nativo permanece setorial. Contrato anterior à implementação, gates e staging pendentes. | Scout / Architect |

| 2026-10-22 | 1.5 | Correção observadora implementada; Forge quatro gates e QA local APPROVED; staging/teste visual posteriores em evidência privada, sem novo commit documental. | DevOps / QA |
