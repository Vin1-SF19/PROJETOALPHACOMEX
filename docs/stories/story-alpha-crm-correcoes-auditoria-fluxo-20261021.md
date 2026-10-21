# Story — Corrigir os achados da auditoria do fluxo CRM

## Status

In Progress — CRM-01–09 e UX complementar implementados; Forge, Sage/Probe, Anubis e Lens/Flux aprovados no escopo local. Publicação e reteste autenticado no staging pendentes. Produção fora do escopo.

## Executor Assignment

- **Executor:** `@dev`, sob coordenação da entrega.
- **Quality gate:** `@qa`, com decisão de `@architect` para encaminhamentos, compatibilidade dos motores e semântica administrativa.
- **Ferramentas:** testes unitários/integração/React, lint, typecheck, suíte completa, build, revisão de diff e navegador autenticado em staging.
- **Publicação:** exclusivamente `@devops`, após os gates e primeiro no staging.
- **Responsabilidade desta preparação:** `@sm`, somente este documento; nenhum código, configuração, mutação de banco, commit ou push pelo Scrum Master.

## Story

**Como** administrador do Painel Alpha, **quero** que todas as correções e melhorias identificadas no PDF da auditoria do CRM sejam aplicadas e retestadas no staging, **para** encaminhar o cenário Comercial → Financeiro → Operacional com rastreabilidade e uma experiência de uso clara, sem perder a liberdade administrativa de reposicionar cards.

## Fonte, autorização e limites

Pedido explícito do usuário: **“aplique todas as correçoes auditadas no pdf”**. A fonte é o [relatório da auditoria de 21/10/2026](../reports/auditoria-fluxo-crm-2026-10-21.md), equivalente ao PDF e às evidências estruturadas versionados. O pedido abrange CRM-01 a CRM-09 e as sugestões complementares de reduzir títulos repetidos e manter o detalhe aberto ao avançar. A implementação não deve selecionar apenas os itens prioritários e abandonar os demais.

A [story da auditoria](story-alpha-crm-auditoria-fluxo-completo-20261021.md#qa-results) foi concluída com evidências aprovadas, mas o fluxo permaneceu bloqueado. O relatório/PDF/JSON históricos e suas capturas não devem ser reescritos para parecer que já estavam corrigidos. Evidências de reteste desta entrega serão novas e identificadas como posteriores à correção.

- Base inicial: `origin/staging` em `9d44e969`; worktree isolada `crm-correcoes-auditoria-20261021`. Preservar trabalhos concorrentes e reavaliar eventual avanço remoto sem force push.
- Destino autorizado: branch `staging`, `https://staging.alpha-comex.com`. A autorização permanente cobre commit/push automático e publicação/validação nesse ambiente. **Produção exige novo pedido explícito de promoção; a aprovação de uma release anterior não se aplica aqui.**
- Operações CLI de staging conferem ambiente e banco efetivos e usam `.env.staging.local`; nunca presumir que `.env.local` aponta ao ambiente correto. Não copiar credenciais, dados ou conexão de produção.
- Priorizar compatibilidade e correções de código, sem schema, migration, seed, backfill ou conversão em massa das automações existentes. Caso uma alteração estrutural ou mutação de risco elevado se torne efetivamente necessária, isolar essa dependência e cumprir Vault, backup verificado e confirmação específica antes de executar; o pedido geral não substitui esse consentimento.
- CRUD normal pelo aplicativo no cenário fictício está autorizado. Não alterar clientes reais nem disparar cobrança, assinatura, emissão fiscal, convites ou mensagens externas para fabricar um teste. Não forjar sessão, papel ou evidência financeira. Reutilizar conta Admin real e o cenário existente quando adequado.

## Critérios de aceite

1. **CRM-01 — Intenção administrativa explícita:** preservar reposicionamento livre de Admin/líder no painel e Kanban, sem transformá-lo implicitamente em execução de automações de negócio. Disponibilizar caminho explícito, autorizado e compreensível para encaminhar o card ao próximo pipeline, conforme decisão da arquitetura. Esse caminho registra intenção, ator, origem/destino, resultado e controle de concorrência; não fabrica conclusão financeira, assinatura, pagamento ou NF. A exceção Admin para o envio Financeiro → Operacional é específica dessa execução e não muda o status financeiro nem as guardas normais. O teste com Admin não pode depender de outra conta nem de alteração dos papéis existentes.
2. **CRM-02 — Encaminhamentos compatíveis:** o caminho que recebe as definições existentes de `CRIAR_CARD_OUTRO_PIPELINE` deve validar e executar parâmetros próprios da ação, incluindo destino, vínculo e deduplicação; não pode encaminhá-los incorretamente ao schema de oportunidade. Cobrir Comercial → Financeiro, Financeiro → Operacional e a definição Smart → Revisão observada na auditoria, preservando os destinos configurados ativos. Não concluir que todas as 37 automações estão quebradas pela ausência de versão central ativa. O editor impede publicar uma combinação ação/executor incompatível; o comportamento corrigido funciona sem batch de conversão de configuração.
3. **CRM-01/02 — Integridade do envio:** encaminhamento cria exatamente um destino autorizado por origem/ação configurada, mantém vínculo e dados aplicáveis, preserva documentos/histórico acessíveis e localização na origem. Reenvio, clique repetido, evento repetido e concorrência não duplicam cards/vínculos. Falha de autorização, destino inválido ou gravação não deixa estado falsamente enviado nem conclusão parcial. Não ampliar a autoridade pessoal do Admin a jobs, webhooks ou usuários comuns.
4. **CRM-03 — Origem e parceiro consistentes:** o valor informado no Novo Lead é reapresentado no fechamento e disponibilizado ao handoff como uma origem coerente, inclusive parceiro quando aplicável. Corrigir a resolução/mapeamento canônico sem sobrescrever uma escolha posterior explícita ou alterar valores históricos em massa. Cobrir origem padrão, indicação com parceiro, origem personalizada, campo vazio e dados legados divergentes; não confundir fallback visual com persistência confirmada.
5. **CRM-04 — Diagnóstico do encaminhamento:** exibir estado próprio do envio, separado da coluna do card: não disparado, aguardando, enviado ou falhou, com motivo pertinente, destino e horário quando existentes. Movimento livre informa que é reposicionamento e não executa envio. Retentativa autorizada atua apenas no encaminhamento específico e é idempotente; não dispara replay global nem apresenta sucesso antes da confirmação persistida.
6. **CRM-05 — Atualização sem conflito falso:** atualização remota sem rascunho local conflitante não apresenta alerta de conflito. Confirmações das próprias gravações não são tratadas como edição externa. Quando houver edição local realmente afetada, preservar rascunho, versão-base e resolução explícita, com aviso consolidado e compreensível, sem mensagens repetidas em vários blocos para o mesmo conflito.
7. **CRM-06 — Contexto de leitura e edição:** deixar inequívoco que abas de outros pipelines representam o histórico de passagem da jornada. O usuário identifica qual card/pipeline/etapa permanece em edição; ao abrir efetivamente um destino vinculado, o contexto e as permissões acompanham esse destino. Estado sem passagem não deve sugerir que o formulário central pertence ao pipeline vazio.
8. **CRM-07 — Resposta e medição:** movimentação/encaminhamento oferecem feedback imediato de operação em andamento e trava contra cliques repetidos; confirmação e erro refletem a resposta real. Medir etapas relevantes para distinguir tempo de requisição, atualização e reabertura, sem atribuir o pico auditado exclusivamente ao backend. Preservar rollback/recuperação de falha e não remover guardas de integridade para simular rapidez. Registrar resultados de reteste comparáveis, sem inventar meta numérica ausente do relatório.
9. **CRM-08 — Voz indisponível sem tempestade de polling:** o componente global de voz reduz tentativas em falha/503 com backoff limitado, evita sobreposição de requisições e apresenta indisponibilidade de forma discreta. Recuperação do serviço restaura o uso; desmontagem cancela timers/requisições pertinentes. Não ocultar erros do CRM nem afirmar relação causal não comprovada entre voz e encaminhamento.
10. **CRM-09 — Contadores coerentes com o movimento:** contadores de origem/destino acompanham a mesma atualização otimista dos cards, respeitando filtros/visibilidade. Sucesso reconcilia com o servidor sem dupla contagem; falha restaura card e totais. Polling/realtime durante operação pendente não provoca oscilação ou perda de contagem.
11. **UX complementar — Continuidade do detalhe:** reduzir repetição desnecessária de títulos como “CONTRATAÇÃO” e “DADOS PARA O FINANCEIRO” sem remover rótulos úteis ou acessibilidade. Ao avançar, manter o detalhe aberto com etapa atualizada, dados salvos e foco previsível quando o card continuar autorizado e disponível; em saída para destino ou perda de acesso, apresentar o estado correto e navegação pertinente, sem reaproveitar silenciosamente dados de outro card.
12. **Reteste real e regressão:** depois de publicado no staging, executar com Admin legítimo o cenário fictício Comercial → Financeiro → Operacional usando o novo caminho explícito. Demonstrar destino único em cada envio, primeira etapa configurada, vínculos, autoria, origem/parceiro quando usado, estado de envio e ausência de duplicata em repetição controlada. Verificar separadamente que reposicionar livremente continua sem disparar envio. Documentar qualquer pré-requisito legítimo sem inventar evidências financeiras, sem criar destinos manualmente para aparentar sucesso e sem declarar aprovado trecho não executado.
13. **Qualidade, entrega e segurança:** lint, typecheck, suíte e build passam; revisão independente de QA cobre os nove IDs e UX complementar. Atualizar checklist e File List com arquivos reais, registrar revisão/deployment e evidências novas sanitizadas, efetuar commit/push por DevOps e validar alias/runtime de staging. Não publicar nem configurar produção, não versionar segredos e preservar o relatório histórico original.

## Matriz de rastreabilidade

| Fonte auditada | Resultado esperado nesta entrega | AC |
| --- | --- | --- |
| CRM-01 | Reposicionamento preservado e ação intencional de envio para Admin | 1, 3, 12 |
| CRM-02 | Ação de criação reconhecida pelo executor correto, validação/editor e deduplicação | 2–3, 12 |
| CRM-03 | Herança de origem/parceiro sem sobrescrever escolha explícita | 4 |
| CRM-04 | Estado, motivo e retentativa específica do encaminhamento | 5 |
| CRM-05 | Conflito apenas para alteração local realmente afetada | 6 |
| CRM-06 | Histórico de passagem e contexto de edição diferenciados | 7 |
| CRM-07 | Feedback, trava, recuperação e medição comparável | 8 |
| CRM-08 | Backoff e recuperação do serviço de voz | 9 |
| CRM-09 | Card e contadores sincronizados, com rollback | 10 |
| Sugestões complementares de UX | Títulos sem repetição e detalhe aberto no avanço | 11 |
| Reteste recomendado no PDF | Dois envios reais, vínculos e prevenção de duplicatas | 12–13 |

## Tarefas / subtarefas

- [x] Preparar story, rastreabilidade completa, limites e checklist de draft. (AC 1–13)
- [x] Consolidar a decisão da arquitetura para envio explícito/Admin e compatibilidade dos motores; confirmar contratos atuais e ownership dos arquivos compartilhados. (AC 1–3, 5)
- [x] Implementar encaminhamento autorizado e idempotente, compatibilidade dos parâmetros existentes e prevenção de configuração incompatível, com regressão dos caminhos comuns. (AC 1–3)
- [x] Corrigir resolução/herança de origem e parceiro, respeitando escolha explícita e dados legados. (AC 4)
- [x] Integrar estado de envio, resultado auditável e retentativa específica na UI. (AC 5)
- [x] Corrigir conflitos falsos, contexto das abas, repetição de títulos e continuidade do detalhe/foco. (AC 6–7, 11)
- [x] Corrigir feedback/trava de movimentação e contadores otimistas; incluir medição e recuperação de falha. (AC 8, 10)
- [x] Aplicar backoff de voz indisponível, cancelamento e recuperação. (AC 9)
- [x] Executar testes de domínio/actions/React e regressões, lint, typecheck, suíte completa e build; registrar resultados reais. (AC 1–11, 13)
- [x] Obter revisão independente de QA, resolver achados bloqueantes e atualizar File List. (AC 13)
- [ ] Publicar código primeiro no staging por DevOps, conferir deployment/alias e ambiente próprio. (AC 13)
- [ ] Retestar no navegador autenticado os dois envios e a repetição controlada sem duplicatas; registrar nova matriz de movimentos e evidências sanitizadas. (AC 12–13)
- [ ] Confirmar cobertura final de CRM-01–09/UX, preservar os artefatos históricos, consolidar checklist e entregar resultado com revisão publicada. (AC 13)

## Dev Notes e contexto confirmado

### Evidência anterior e cenário disponível

A auditoria comprovou seis movimentos Admin com `automacoesSuprimidas: true`, zero execuções/vínculos e nenhum destino. O terceiro encaminhamento Smart foi examinado por configuração/prova pura, não executado como jornada real. Origem inicial permaneceu `Orgânico`, enquanto o campo distinto do fechamento estava vazio; não houve demonstração de perda em destino financeiro porque este não existia. As respostas 503 de voz e a diferença transitória de contador foram observações incidentais, sem causalidade demonstrada sobre os envios. [Source: `docs/reports/auditoria-fluxo-crm-2026-10-21.md#3-achados-prioritários`, `#4-outras-observações-e-melhorias-de-experiência`]

Cenário autorizado para reteste: empresa fictícia `3066`, card `cmvi5ztja000007l8livtiw1o`, conta Admin real ID `1`. Na última leitura auditada, estava em Contrato fechado, `ATIVO`, versão `6`, sem conclusão financeira. Reconsultar o estado atual antes de cada mutação; não assumir que continua nessa versão. Credenciais/sessão ficam privadas. [Source: relatório `#1-escopo-e-identificação`, `#2-o-que-foi-executado` e JSON sanitizado adjacente]

### Direção de arquitetura recebida

O arquiteto comunicou a direção inicial: reposicionamento livre continua suprimindo automações; o encaminhamento explícito Admin usa a regra ativa `CRIAR_CARD_OUTRO_PIPELINE`, execução idempotente e evento de autoria. A exceção de envio Financeiro → Operacional fica ligada à execução explícita e pode dispensar a exigência de status `CONCLUIDO`/dados de destino apenas nesse caminho administrativo, sem alterar assinatura, pagamento, NF ou status e sem relaxar o caminho normal. Um helper compartilhado extraído do runtime central atende central, legado e manual, evitando duplicação de semântica, batch de configuração e schema. [Source: mensagem do agente de arquitetura à preparação desta story, 21/10/2026; contrato detalhado a consolidar pela coordenação]

Interfaces sugeridas pelo arquiteto, sujeitas à consolidação do contrato: `ObterEncaminhamentosCardBpm(cardId)`, `SolicitarEncaminhamentoCardBpm({ cardId, automacaoId, etapaOrigemEsperadaId, versaoEsperada, idempotencyKey })` e `RepetirEncaminhamentoCardBpm({ cardId, execucaoId })`. O servidor revalida identidade, acesso, regra/etapa atual e versão; o cliente não fornece autoridade ou dispensa financeira. Essas sugestões não autorizam escrita estrutural de banco.

### Pontos existentes para investigar e integrar

Os caminhos abaixo são referências confirmadas de investigação e não autorizam substituição integral nem delimitam a File List final:

- `src/lib/bpm/transicao-command.ts` e `src/lib/bpm/automacoes/eventos.ts`: movimento livre e supressão de automações. Preservar as garantias da [story de movimentação excepcional](story-alpha-crm-movimentacao-excepcional-admin-lideres.md#acceptance-criteria) para o reposicionamento; a nova intenção de envio exige tratamento separado conforme arquitetura. [Source: relatório CRM-01]
- `src/lib/bpm/automacoes/{fila,executor,schemas,central-runtime}.ts`: seleção de caminho legado/central e parâmetros. O reprodutor histórico `docs/reports/evidencias/crm-2026-10-21/validacao-parametros.mjs` é a prova anterior; manter original e acrescentar regressão da compatibilidade corrigida em testes. [Source: relatório CRM-02 e `#7-verificações-técnicas-e-evidências`]
- `src/lib/bpm/origem-cliente.ts`, `origem-cliente-server.ts`: módulos existentes para catálogo/resolução; validar integração com Novo Lead, fechamento e dados de handoff. [Source: inventário de arquivos da base `9d44e969`; relatório CRM-03]
- `src/app/PainelAlpha/AlphaCRM/CardModal/{CardAbertoLayout,CardFullViewModal,PainelProximaEtapa,CardSaveContext,PainelCamposEtapaAtual}.tsx` e `pipeline/[pipelineId]/PipelineBoardClient.tsx`: contexto de edição, fechamento/atualização, rascunhos/conflitos e movimento. Há lógica existente de versão confirmada; corrigir a causa sem eliminar proteção de rascunho. [Source: inventário da base e relatório CRM-04–07/09]
- `src/app/api/bibble/voice/route.ts`: rota existente com respostas 503. Localizar seu consumidor e corrigir a política de tentativas no ponto apropriado; não alterar infraestrutura externa por presunção. [Source: inventário da base e relatório CRM-08]

Não foram encontrados `accumulated-context.md`, `.aiox/gotchas.json` ou os documentos gerais `docs/architecture/index.md`/`docs/framework/` nesta worktree. A coerência cruzada usa a story da auditoria, a de movimentação excepcional, a de conclusão financeira/handoff e os achados reais. A decisão específica do arquiteto desta entrega será vinculada pela coordenação; nenhum novo modelo ou biblioteca foi presumido.

## Testing

Usar os padrões de Vitest/React existentes em `tests/bpm/` e testes do componente de voz correspondente. Testes locais usam mocks/fixtures, sem trabalhadores globais ou banco remoto. Roteiro mínimo significativo:

- Admin reposiciona em painel/Kanban sem envio; envio explícito autorizado cria destino e autoria; papel inativo/sem acesso/destino inválido falha; parâmetros do cliente não elevam permissão.
- Três definições de `CRIAR_CARD_OUTRO_PIPELINE` aceitas e executadas no caminho compatível; outras ações legadas e motor central preservados; configuração incompatível recusada antes da publicação.
- Cliques/eventos repetidos e concorrência geram um destino/vínculo; falhas de gravação/worker preservam diagnóstico correto e retentativa específica sem replay de terceiros.
- Origem padrão/personalizada/parceiro, valor anterior explícito, ausência e divergência legada; herança observável no fechamento e destino, sem batch de dados históricos.
- Própria gravação/remoto sem edição não mostram conflito; edição local afetada mantém rascunho, CAS e aviso único.
- Abas sem passagem/com passagem e abertura de destino explicam contexto; avanço mantém modal e foco quando permitido; saída/perda de acesso não deixa dados de outro card na tela.
- Operação lenta tem feedback/trava, falha tem recuperação; contador e card avançam/revertem juntos mesmo com filtros/realtime e atualizações intermediárias.
- Voz 503/backoff com timers controlados, ausência de sobreposição, recuperação e desmontagem sem timers vazando; serviço indisponível não bloqueia o CRM.
- Gates obrigatórios: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, revisão de diff e QA independente. Registrar falhas efetivas, sem reutilizar os números da auditoria como prova desta implementação.
- Smoke/E2E após deploy: Admin legítimo, cenário fictício, Comercial → Financeiro → Operacional e retentativas controladas. Confirmar ambiente e revisão; registrar estados/vínculos contados no servidor e observados na UI. Não marcar aprovado um envio apenas pela mudança de coluna, toast ou leitura de código.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** Integration; secundárias API, Frontend e Security; complexidade alta por autoridade, dois motores, vínculo entre pipelines e estado concorrente.
- **Specialized Agents:** `@dev` implementa e revisa pré-commit; `@architect` decide contratos de envio e compatibilidade; `@qa` valida regressão e E2E; `@devops` cuida de commit/push/publicação. Vault/Data Engineer somente se surgir mudança de banco coberta pela política.
- **Quality Gates:** pré-commit com diff, testes, lint/typecheck/build e revisão; pré-PR por DevOps se aplicável; pré-deployment staging com ambiente correto e rollback de código identificado. Produção fora do escopo atual.
- **Self-Healing:** `@dev` light, até 2 iterações/15 min para CRITICAL; HIGH documentado e encaminhado; `@qa` full, até 3 iterações/30 min para CRITICAL/HIGH; `@devops` report-only. Correções de código estão autorizadas; nenhuma automação de revisão pode dispensar Vault/backup/consentimento para alterações de banco. Se CodeRabbit indisponível, registrar fallback de revisão independente.
- **Focus Areas:** intenção versus privilégio, ACL servidor, idempotência/atomicidade, parâmetros por ação, ausência de evidência financeira fabricada, rascunho/conflito, contagem otimista, cancelamento/backoff, dados sensíveis e staging separado de produção.

## Validação do draft — River

Checklist `.aiox-core/product/checklists/story-draft-checklist.md` aplicado.

| Categoria | Resultado | Observação |
| --- | --- | --- |
| Objetivo e contexto | PASS | Pedido atual cobre todos os achados e UX, não apenas prioridades. |
| Orientação técnica | PASS | Integrações conhecidas e decisão de arquitetura delimitadas; sem schema inventado. |
| Referências | PASS | Relatório histórico, prova reproduzível e cenário de teste resumidos. |
| Autossuficiência | PASS | Rastreabilidade, autorização, ambiente, dados e limites explícitos. |
| Testes | PASS | Regressões, falhas, concorrência, UX e dois envios reais definidos. |
| CodeRabbit | PASS | Agentes/gates/self-healing/fallback e segurança de banco previstos. |

**READY para desenvolvimento; clareza 9/10.** A preparação documental não executou implementação nem validou o fluxo corrigido. A decisão técnica de arquitetura é tarefa inicial da implementação, sem necessidade de renovar a autorização genérica do usuário.

[AUTO-DECISION] Novo epic/ClickUp ou story local → story descritiva no caminho solicitado pela coordenação, seguindo o padrão CRM; não criar item externo nem impor sequência numérica não solicitada. O escopo deriva integralmente do relatório e do novo pedido explícito.

## Dev Agent Record

### Execução e conclusão

Implementação concluída e revisada localmente em 21/10/2026; publicação e E2E ainda não foram declarados aprovados nesta etapa.

- CRM-01/02/04: envio explícito Admin por regra ativa, execução específica e auditada, helper compartilhado central/legado, validação própria de parâmetros, estado/horário/motivo, retentativa isolada e proteção de configuração. Criação, vínculo, cópia, histórico, CAS e outbox são atômicos. Reposicionamento livre continua suprimindo automações; o envio Admin preserva status financeiro, assinatura, pagamento e NF e não dispara automações amplas no destino.
- CRM-03: herança no mesmo card, preservação de valor/limpeza explícitos e mapeamento, parceiro somente na mesma empresa sem clonar indicação/comissão. Vínculo entre empresas diferentes não é reaproveitado no envio.
- CRM-05/06/07/09 e UX: comparação base/local/remoto, contexto de histórico/edição, títulos únicos, detalhe aberto enquanto autorizado, trava síncrona/feedback, métricas por fase e manifesto/contadores otimistas com rollback.
- CRM-08: backoff de voz 60/120/240/300 segundos, Retry-After, deduplicação e cancelamento de polling oculto/offline/sem assinantes, estado acessível e tentativa manual; microfone nativo preservado.
- Nenhuma migration, alteração de estrutura, backfill, worker global, mutação remota ou publicação em produção nesta implementação local. Testes de banco usam SQLite privado, com sentinela local e token vazio.

Validação real: `npm run lint` exit 0 (1.193 avisos preexistentes); `npm run typecheck` exit 0; `npm test -- --maxWorkers=2` exit 0, **686 arquivos/5.278 testes aprovados**, 4 skipped e 1 todo. Build equivalente ao script oficial (Prisma generate, player e Next webpack, heap 4 GiB/CPU controlada) exit 0 em **150,62 s**; smoke da aplicação compilada/auth/estáticos/banco de staging aprovado. Fonte permaneceu igual durante build. A primeira suíte apresentou 7 falhas em contratos textuais/mocks antigos; ajustes somente nos testes foram verificados e a execução completa final passou. Evidências privadas separadas preservam ambos os resultados.

Anubis aprovou segurança após 97 testes independentes; Lens/Flux aprovaram sem novos bloqueantes/importantes, com 77 testes focados. CodeRabbit CLI não estava disponível; revisão independente foi o fallback. Flux não afirma melhora percentual, CWV ou latência remota sem baseline comparável. A próxima etapa é comprovar os dois encaminhamentos no navegador real do staging e conferir contagens/estados persistidos.

### File List

- `docs/stories/story-alpha-crm-correcoes-auditoria-fluxo-20261021.md`
- `src/actions/bpm/Encaminhamentos.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/FormularioEtapaRenderer.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistFollowUp.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelEncaminhamentos.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelStatusPosFechamento.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `src/components/BibbleChatHome/BotaoFalarMensagem.tsx`
- `src/components/BibbleChatHome/useVoiceStatus.ts`
- `src/lib/bpm/automacoes/central-runtime.ts`
- `src/lib/bpm/automacoes/central-schemas.ts`
- `src/lib/bpm/automacoes/encaminhamento.ts`
- `src/lib/bpm/automacoes/eventos.ts`
- `src/lib/bpm/automacoes/executor.ts`
- `src/lib/bpm/automacoes/schemas.ts`
- `src/lib/bpm/card-modal-ui.ts`
- `src/lib/bpm/copiar-campos-card-vinculado.ts`
- `src/lib/bpm/medicao-ui.ts`
- `src/lib/bpm/origem-cliente-server.ts`
- `src/lib/bpm/requisitos-etapa-server.ts`
- `tests/bibble/voice-client.test.ts`
- `tests/bibble/voice-proxy.test.ts`
- `tests/bibble/voice-status-react.test.ts`
- `tests/bpm/arquivamento-modal-react.test.ts`
- `tests/bpm/automacoes-executor.test.ts`
- `tests/bpm/autosave-fixed-recovery-react.test.ts`
- `tests/bpm/card-modal-integration.test.ts`
- `tests/bpm/card-modal-ui.test.ts`
- `tests/bpm/card-save-flow.test.ts`
- `tests/bpm/edicao-campos-card.test.ts`
- `tests/bpm/encaminhamento-auditoria.test.ts`
- `tests/bpm/encaminhamento-sqlite.test.ts`
- `tests/bpm/encaminhamentos-actions.test.ts`
- `tests/bpm/encaminhamentos-painel-react.test.ts`
- `tests/bpm/financeiro-operacional-handoff.test.ts`
- `tests/bpm/formulario-etapa.test.ts`
- `tests/bpm/movimento-livre-eventos.test.ts`
- `tests/bpm/movimento-livre-react.test.ts`
- `tests/bpm/origem-cliente.test.ts`
- `tests/bpm/origem-novo-alias.test.ts`
- `tests/bpm/salvamento-manual-campos-react.test.ts`
- `tests/bpm/tarefas-alertas-foco-react.test.ts`

## QA Results

Pendente. A aprovação da auditoria anterior não aprova a implementação desta story.

### 2026-10-21 — Sage e Probe: gates locais aprovados; E2E de staging pendente

**Parecer local: APPROVED.** A suíte final terminou com exit 0, **686 arquivos e 5.278 testes aprovados**, quatro skipped e um todo. Esta aprovação cobre testes e integração local; não aprova por inferência os dois encaminhamentos no staging. AC 12 e a publicação/validação pública de AC 13 permanecem pendentes. Nenhuma etapa financeira, convite ou evidência fiscal foi fabricada para os testes.

**Testes e segurança:** criados `tests/bpm/encaminhamentos-actions.test.ts` e `tests/bpm/origem-novo-alias.test.ts`, com **58 casos focados aprovados**. Cobrem identidade/role ativa do banco em vez da sessão, ACL da origem e destino, payload estrito, contexto/versão obsoletos, diagnóstico sem revelar destino restrito, retentativa específica, configuração alterada exigindo nova intenção, nova autorização após salvar campos e falhas de cache/realtime após commit sem falso fracasso. A origem usa os IDs reais observados na auditoria com dados sintéticos: padrão/personalizada, escolha explícita inclusive vazia, precedência do mapeamento, aliases divergentes, isolamento por card/empresa, parceiro herdado e ausência de duplicação de indicação/comissão. O teste comprova fallback de leitura sem alegar que essa leitura persistiu uma nova linha.

O mock de `tests/bpm/edicao-campos-card.test.ts` recebeu somente `vinculosDestino: []`, alinhando o fixture ao array retornado pelo select real do Prisma. Seus 47 casos, somados aos 58 novos, passaram no grupo focado de **105 testes**. A atomicidade/concorrência e vínculo entre empresas são cobertos separadamente pelos testes do helper, incluindo SQLite real local; os testes de actions não substituem essa cobertura por mocks de gravação atômica.

**Histórico verdadeiro dos gates:** a primeira suíte encontrou **5 arquivos/7 testes com falha**, com 681 arquivos/5.271 testes aprovados. Eram contratos textuais antigos afetados por instrumentação/merge de rascunhos e o fixture sem o novo array. Os owners atualizaram as verificações afetadas e preservaram os testes de segurança. O resultado inicial permanece em `/var/tmp/alpha-crm-correcoes-20261021/gate-tests-first.log` e `gate-tests-first.json`; o resultado final está em `gate-tests.log` e `gate-tests.json` no mesmo diretório. Ambas as rodadas usaram `npm test -- --maxWorkers=2`, `TMPDIR` privado em `/dev/shm`, `TURSO_DATABASE_URL=file:.../sentinel.db` e token vazio, sem conexão a banco remoto.

**Forge conferido:** `forge-result.json` registra typecheck e lint exit 0 (1.193 avisos existentes), build completo exit 0 em 150,62 s e smoke local do build com proteção do CRM. O fingerprint de fontes permaneceu igual antes/depois do build (`5edd36e9174f89608584c9a7f183772ce4ed57bf0c87941eb27afc305c829e66`). A manutenção posterior foi somente dos testes. ESLint dos dois testes novos passou sem avisos. O build não foi repetido sem mudança de runtime.

**Probe — wiring local:** contrato comparado aos ACs e à direção arquitetural desta story e aos pontos de integração existentes; não foi localizado um blueprint Scout específico desta correção. O painel de encaminhamentos está efetivamente inserido na lateral de `CardAbertoLayout`, conectado às três actions autenticadas, com flush/releitura da versão antes do envio, confirmação administrativa, estados/erro/retentativa e abertura do destino. O backend revalida permissões; ocultar controles não é sua única proteção. Não existe necessidade de novo menu/rota para alcançar a funcionalidade no card. Reposicionamento explica que não dispara envio; detalhe permanece aberto e atualiza os dados; o contexto em edição está identificado; o manifesto e os cards avançam/revertem juntos no movimento otimista. As verificações React e de regressão correspondentes passaram na suíte final.

| Achados | Evidência local de cobertura |
| --- | --- |
| CRM-01/02/04 | Actions de envio/status/retry, helper/SQLite e painel React: intenção, ACL, idempotência, falha e diagnóstico. |
| CRM-03 | Aliases de origem, mapeamento/limpeza explícita, parceiro da mesma negociação e cópia para vínculo. |
| CRM-05/06 e UX | Merge de snapshots com rascunho, conflitos reais, contexto das abas, continuidade do detalhe e composição dos formulários. |
| CRM-07/09 | Flush/trava/recuperação, instrumentação por fase e atualização/rollback do manifesto junto do card. |
| CRM-08 | Testes de status/cliente/proxy de voz: backoff, ausência de sobreposição, recuperação e tentativa manual preservada. |

**Limites da decisão:** não foi executado E2E remoto por Sage/Probe, nem houve alteração de fonte da aplicação, banco remoto, configurações ou permissões por este agente. Permanecem necessários publicação no staging, revisão independente de código conforme coordenação e reteste autenticado com Admin demonstrando um destino Financeiro e um Operacional, vínculos/autoria, dados herdados e repetição sem duplicata. Não marcar a story como Done antes dessas evidências.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-21 | 0.2 | Implementação completa e gates/revisões locais aprovados; publicação e E2E staging pendentes. | Bibble (coordenação) |
| 2026-10-21 | 0.1 | Story pronta para desenvolver CRM-01–09 e UX complementar, com envio explícito, compatibilidade sem batch, reteste Admin e publicação exclusiva em staging. | River (@sm) |
