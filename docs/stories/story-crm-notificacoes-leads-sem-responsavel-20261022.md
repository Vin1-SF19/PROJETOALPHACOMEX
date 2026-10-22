# Story — Notificações compartilhadas de leads sem responsável no CRM

## Status

Ready for Review — implementação e gates globais aprovados sobre a base `6659f00c`; integração preservadora de staging, checks combinados e validação remota ainda pendentes.

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

## Tasks / Subtasks

- [x] Registrar pedido, esclarecimentos explícitos, escopo por setor e checklist de draft (AC 1–17).
- [x] Consolidar contrato de arquitetura: audiência, elegibilidade por origem/pipeline, identidade estável, recuperação, resolução e destino virtual/nativo (AC 1–9, 11).
- [x] Implementar projeção/consulta autenticada somente leitura e integração de atualização pelo transporte existente (AC 1–3, 5, 8–9).
- [x] Integrar fonte compartilhada à central e toasts, com cor/origem textual, resumo e separação de leitura/resolução (AC 2–5, 7, 10).
- [x] Conectar clique ao protocolo existente de abertura do lead/modal e opções de assunção, sem atribuição automática (AC 6, 8).
- [x] Conciliar assunção, revogação, troca de conta e respostas atrasadas; deduplicar entradas/toasts sem esconder pendências (AC 4–9).
- [x] Cobrir cenários focados unitários, API/integração SQLite, segurança e React do plano de testes (AC 1–11, 13–17); smoke autenticado remoto e gates gerais seguem separados.
- [x] Executar quatro gates, revisão de QA e CodeRabbit/fallback documentado (AC 12).
- [ ] DevOps publicar e verificar somente staging; atualizar checklist, File List, evidências e limitações (AC 12).
- [x] Registrar confirmação explícita do usuário sobre audiência e novo fluxo Financeiro/Operacional (AC 13–15).
- [x] Implementar recepção/claim nativo transacional, responsáveis por setor e preservação de vendedor/campos de origem (AC 13–15).
- [x] Conectar proveniência site opcional no ingresso real e recuperação completa/realtime mínimo (AC 16–17).

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

Manifesto e File List concordam nos 54 caminhos desta entrega; scan de segredos sem achados. Staging avançou para `f7ceefdb`, data original do formulário Instagram, com dez caminhos externos e três sobreposições. A integração normal está autorizada; hunk de import em Cards foi ratificado por Echo para unir ambos os helpers de Instagram e preservar integralmente o import de recebimentos. Board e teste têm preview 3-way limpo. Typecheck oficial, lint dos cinco fontes afetados e suíte completa da combinação ainda pendem neste checkpoint; build final remoto/alias e E2E permanecem requisitos separados.

Configuração preexistente de liderança foi completada pelo fluxo administrativo normal já autorizado do usuário: Admin real1 adicionou somente o override `crm/ADD` da conta10 no staging. SELECT independente confirmou linha47/criadoPor1, motivo executado e doze assertivas aprovadas; cinco módulos anteriores, role, status, legado, outro override e regras pertinentes do setor preservados. A política reconstruída passou de zero para um assumidor elegível em Boas-vindas; isso não equivale a login/claim como Vitor. DevOps não executou mutação SQL, worker, alteração de conta, schema ou ambiente. Evidência privada `vitor-crm-after-proof.json`. Nenhuma operação de produção integra esta entrega.

## Integração e liberação pré-push — staging

A entrega foi congelada em `67f14b93` (54 caminhos) antes da integração normal de `f7ceefdb`. Preservados byte a byte os 51 caminhos próprios e sete externos sem sobreposição. Cards, Board e teste Kanban correspondem ao merge 3-way independente; o único conflito textual foi a união mínima de imports ratificada por Echo. Os helpers de data do formulário e os de recebimento foram mantidos integralmente, sem estratégia de substituir arquivos por ours/theirs. Prova privada: `release/merge-f7-proof.json`.

Árvore combinada: typecheck oficial **exit 0** (20,42 s), lint dos cinco fontes afetados **exit 0** (2,32 s) e suíte completa com cobertura **720 arquivos, 5.756 testes aprovados, zero falhas, quatro skipped e um todo**, em 171,67 s. Nenhuma correção adicional de código foi necessária. Custódia `3412c7bb06b0443b2b060b1fb04a1e92c3de467b5f7f2b25f396ee5109f58c10` idêntica antes/depois. QA ratificou GO de push normal staging após conferir os resultados e os hunks. Evidência privada: `/var/tmp/alpha-crm-notificacoes-leads-20261022/release/combined-f7-result.json`.

Build local combinado não foi repetido sem mudança de configuração/dependências: os builds-base aprovados e revisão dos hunks sustentam a integração, mas **build remoto final READY, SHA/alias e smoke autenticado continuam obrigatórios antes de concluir**. API Vercel com token existente responde 403; não houve reautenticação nem mudança de credenciais. A verificação operacional usará status Vercel no GitHub vinculado ao commit e ID de deployment nos assets do endereço canônico de staging; a base `f7ceefdb` já teve essa correspondência confirmada. Publicação e homologação remota ainda pendem neste checkpoint. Produção não autorizada.

## File List

Consolidada dos manifests de backend/frontend e do teste de QA; descreve arquivos efetivos, sem logs privados ou dados reais versionados.

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
- `.bibble/memory/codebase-map.md` — checkpoint documental Scribe/Kowalski, sem encerramento remoto.
- `.bibble/memory/integration-points.md` — checkpoint documental Scribe/Kowalski, sem encerramento remoto.
- `.bibble/memory/journal.md` — checkpoint documental Scribe/Kowalski, sem encerramento remoto.

## Story Draft Checklist

| Categoria | Resultado | Evidência |
| --- | --- | --- |
| Objetivo e contexto | PASS | Pedido, valor e audiência/claim por setor confirmados explicitamente. |
| Orientação técnica | PASS | Fontes existentes, contratos comportamentais e gate arquitetural antes das interfaces. |
| Referências | PASS | Stories e contrato de Instagram com seções específicas e conteúdo resumido. |
| Autossuficiência | PASS | Ciclo de vida, segurança, decisões, casos de erro e limites descritos. |
| Testes | PASS | Cenários mensuráveis por camada e quatro gates definidos. |
| CodeRabbit | PASS | Tipos, agentes, checkpoints, self-healing e foco presentes. |

**Resultado do draft preservado:** havia clareza para implementar Comercial e Financeiro/Operacional conforme confirmação do usuário. O código local foi entregue; os checks focados acima não constituem aceite final de QA, resultado dos quatro gates ou validação remota.

## Dev Agent Record

### Agent Model Used

Echo — backend; Nova — frontend; QA — testes adversariais; Scout/Architect e Scribe/Kowalski — arquitetura e consolidação. Modelos herdados da sessão. Forge executa a verificação integrada, ainda pendente neste checkpoint.

### Debug Log References

Frontend: `/var/tmp/alpha-crm-notificacoes-leads-20261022/frontend-tests.json` e `frontend-tests.log` (18 arquivos, 100 testes PASS); `frontend-lint.log` (0 erros, 1 warning preexistente do TanStack Virtual). Tentativa de typecheck com heap de 4 GiB terminou em OOM/134 antes de diagnósticos; não constitui aprovação. O typecheck focado oficial de backend com 8 GiB passou, conforme evidência do owner; isso não substitui os quatro gates integrados em execução pelo Forge. O Forge já informou typecheck e lint integrados exit 0; confirmação final de build, suíte global, revisão final e validação remota permanece pendente neste checkpoint. Nenhuma operação remota ou banco real feita pelo frontend. Backend: `backend-tests-freeze.log` (182 testes/12 arquivos), `backend-sqlite-v7.log` (sete casos SQLite, incluídos no total), `backend-typecheck-freeze.log`, `backend-lint-freeze.log`; manifests `backend-files.txt`/`frontend-files.txt` e `frontend-result.json` na mesma pasta privada. O resultado geral de Forge não é presumido a partir desses checks focados.

### Completion Notes

Backend e frontend entregues e congelados para verificação integrada: projeção/recepção/claim, central/toasts, navegação e proveniência site conectados. Evidências focadas de segurança, SQLite e React registradas; nenhuma aceitação remota ou resultado global inferido. Entrega geral ainda depende dos quatro gates, QA final e validação/publicação no staging. Produção, schema e backfill fora do escopo.

## QA Results

Pendente de implementação e revisão independente.


### 2026-10-22 — Quinn / Sage, Anubis, Probe e Lens — APPROVED local

**Parecer: APPROVED para a implementação local sobre `6659f00c`, fingerprint `c0e061779b0b1ebac93989268b3b1d60d9e25f2cbdd6408677b7afab527f7c59`.** Revisão de código e integração independente após quatro gates Forge PASS; sem bloqueador crítico/importante novo aberto. Este checkpoint libera integração/publicação em staging dentro das condições abaixo, sem declarar deploy, E2E setorial remoto ou Done já concluídos.

**Evidência objetiva:** `forge/forge-result.json` e `gate-runtime-result.json` conferidos: typecheck oficial exit 0 (8,54 s); lint exit 0 (52,24 s, zero erros e 1.193 avisos preexistentes); pipeline Prisma + player + Next completo exit 0 (158,36 s, pico 6,21 GiB, execução supervisionada); `npm test` com cobertura exit 0 (179,42 s): **720 arquivos, 5.739 testes PASS, quatro skipped, um todo, zero falhas**. As 1.668 suites internas do JSON não são contadas como arquivos. Custódia idêntica antes/depois dos gates e smoke. Build compilado testado em loopback com SQLite sentinela local: raiz/JavaScript/providers/sessão 200 e CRM anônimo protegido por redirecionamento; servidor encerrado. Nenhuma credencial remota carregada nesses gates. A tentativa focada anterior de tipos com 4 GiB/OOM não substitui o typecheck oficial aprovado.

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

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-22 | 1.0 | Story preparada a partir do pedido atual; núcleo Comercial e novo fluxo Financeiro/Operacional pendente; checklist de draft aplicada. | River / SM |
| 2026-10-22 | 1.1 | Esclarecimento do usuário: todos do setor, recepção/Assumir Financeiro e Operacional, responsáveis anteriores e vendedor preservados; contrato de arquitetura definido. | Aria / Architect (atualização autorizada) |

| 2026-10-22 | 1.2 | Checkpoint da implementação congelada: escopo/AC 1–17, evidências focadas, File List e memórias; Forge, QA final e staging ainda pendentes. | Scribe / Kowalski |
