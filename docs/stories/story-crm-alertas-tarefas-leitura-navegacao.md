# Story — Leitura dos alertas de tarefas e navegação na mesma aba CRM

## Status

Ready for Review — revisão independente e quatro gates finais aprovados no snapshot isolado; publicação e verificação de staging pendentes.

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["npm run lint", "npm run typecheck", "npm test", "npm run build"]

## Story

Como usuário do CRM, quero que os alertas de tarefas já visualizados parem de reaparecer e que seu clique reutilize a aba CRM mostrando o card/tarefa indicado, para alternar entre tarefas sem criar abas internas adicionais.

Origem: correção solicitada pelo usuário em 2026-10-21. Comportamento relatado: alertas repetidos após visualização e abertura de aba interna separada “CRM - Tarefa”. Staging primeiro; produção não autorizada. Sem migrations, backfill ou alteração de registros do banco.

## Acceptance Criteria

1. Um mesmo alerta de tarefa já visualizado/lido não volta a ser apresentado como novidade nos ciclos de atualização, foco, reconexão ou remontagem do fluxo. O reconhecimento continua eficaz após recarregar o Painel no mesmo navegador, com estado isolado por usuário, sem guardar dados de clientes ou conteúdo de tarefas.
2. A leitura pelo fluxo existente da central e a abertura do alerta reconhecem o alerta correspondente. Repetição do mesmo identificador não gera outro toast nem volta ao estado não lido. Um novo alerta legítimo de outra tarefa ou novo horário continua sendo apresentado; a correção não suprime todos os lembretes.
3. Clicar no alerta, tanto no toast quanto na central, ativa e reutiliza a aba interna CRM existente e abre o card/tarefa indicado. Não cria uma aba “CRM - Tarefa” por notificação. Se ainda não existir aba CRM, abre uma única aba para o destino.
4. Clicar depois em outro alerta substitui o card/tarefa anterior na mesma aba CRM, inclusive se for de outro pipeline. O último clique determina o destino visível; respostas ou confirmações atrasadas não reabrem o anterior. Reabrir alerta do mesmo card após fechar seu modal continua funcionando.
5. A navegação preserva autorização do CRM e validação de origem/frame das mensagens. Outras abas e notificações de outros módulos mantêm seu comportamento. Logout ou troca de conta não entrega alerta/intenção de outro usuário.
6. Os quatro quality gates são executados com resultados reais registrados. Após validação, DevOps publica e verifica somente staging, registrando URL e commit/release. Checklist e File List refletem os arquivos efetivamente alterados; testes ou publicação pendentes não são declarados concluídos.

## Dev Notes e referências

- `src/store/useBpmTarefasNotificacoes.ts`: mantém `vistas`, `removidas` e `lida` em memória por usuário; `sincronizar` deduplica por ID. O comentário atual proíbe persistir dados de clientes. Preservar essa proteção ao reconhecer alertas entre remontagens/recarregamentos, limitando qualquer estado persistido ao mínimo de identificadores necessário.
- `src/hooks/useBpmTarefasNotifications.ts`: reconcilia via polling de 30 segundos, foco, online e Pusher; cleanup reinicia o usuário do store para zero. Toasts chamam abertura com URL específica e label `CRM · Tarefa`. O executor confirmou perda do estado na desmontagem e ausência de leitura individual nos cliques do toast/central.
- `src/hooks/useBpmCardNotificacaoNavigation.ts`: identifica a aba por igualdade da URL completa; intenção pendente inclui URL e confirmações validam origem/frame. URLs com outro `cardId` não equivalem à aba CRM já aberta. Reutilizar a integração canônica de abas/intenção, sem listener paralelo inseguro.
- `src/components/layout/PainelLayoutClient.tsx`: conecta o hook de navegação ao gerenciador `openTab` e ao hook de tarefas. `src/components/layout/CentralNotificacoesPainel.tsx`: compartilha o fluxo de abertura e marcação de leitura.
- `src/lib/bpm/notificacoes-tarefas.ts`: define URL, payload e eventos abrir/pronto/aberto. A URL atual identifica pipeline/card; incluir `tarefaId` no fluxo existente para localizar a tarefa indicada, sem inventar outra tela.
- `src/lib/painel-tabs.ts`: identidade das abas, normalização e persistência por usuário. Preservar home fixa e comportamento dos demais módulos.
- `tests/bpm/tarefas-notificacoes-{store,hook-react,navegacao-react,board-react}.test.ts`: bases existentes para deduplicação, integração e abertura. Os testes atuais de navegação cobrem a mesma URL, mas não substituição entre cards/pipelines.
- `AGENTS.md`, Fluxo de ambientes e Quality Gates: validação/publicação em `https://staging.alpha-comex.com` antes de produção, com banco separado e destino efetivo conferido. `package.json`, scripts: comandos dos quatro gates.

**[AUTO-DECISION] Escopo:** tratar reconhecimento de alertas e reutilização da aba como uma correção integrada do fluxo existente. Plano mínimo confirmado pelo executor: persistir somente IDs exibidos/lidos/removidos por usuário no navegador, marcar clique individual como lido, permitir aba alvo opcional em `openTab` e atualizar URL no mesmo iframe CRM, mantendo o handshake existente. Não criar epic, configuração de UI, regra de prazo, migração ou persistência de conteúdo. `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados; contexto cruzado consultado na story `story-staging-sincronizacao-fluxo-staging-primeiro.md` e contratos citados.

## Tarefas / subtarefas

- [x] Registrar pedido, evidências, critérios e aplicar checklist de draft.
- [x] Reproduzir repetição e conferir reconhecimento/lifecycle do store e hook (AC 1–2).
- [x] Corrigir leitura/deduplicação e isolamento entre usuários sem persistir dados de clientes (AC 1–2, 5).
- [x] Reutilizar aba CRM e substituir intenção/destino nos cliques subsequentes, via toast e central (AC 3–5).
- [x] Testar alertas repetidos/novos, remontagem/recarga e troca de conta; testar cards/pipelines distintos, cliques rápidos e mensagens atrasadas (AC 1–5).
- [x] Executar lint, typecheck, testes e build; registrar resultados reais (AC 6).
- [ ] DevOps publicar/validar somente staging e registrar URL/commit/release (AC 6).
- [ ] Atualizar status, checklist, File List, evidências e limitações (AC 6).

## Testing

Usar Vitest e harness React existentes com alertas sintéticos. Verificar leitura na central e clique no toast; repetição do mesmo ID por polling/Pusher/foco; remontagem/recarga; novo ID/horário legítimo; conta A→B; resposta antiga após logout. Verificar CRM aberto/fechado, card A→B na mesma aba, pipeline A→B, modal fechado e reabertura, cliques rápidos com confirmação antiga, mensagem de origem/frame inválido e preservação das outras abas. Registrar smoke em staging sem alterar dados reais para fabricar evidência.

### Evidências globais finais — DevOps

Snapshot isolado `painel-alpha-worktrees/crm-alertas-tarefas-20261021`, base `c2c4bc0853e0d98e2be76114946df9284bbfa98f`, contendo somente os 22 caminhos da File List. Ambiente local ignorado contém apenas as duas credenciais do banco staging; nenhum banco, configuração de produção ou dependência alterado.

- `npm run lint`: PASS, zero erros e 1193 avisos existentes; `/tmp/crm-alertas-20261021-lint-retry.log`. Após o último ajuste, lint incremental dos dois caminhos alterados também PASS, sem avisos, em `/tmp/crm-alertas-20261021-lint-final-scoped.log`.
- `npm run build`: PASS no código final, com o comando padrão e seu limite de 3072 MB; `/tmp/crm-alertas-20261021-build-final.log`. Não foi necessário override de memória nesta entrega.
- `npm run typecheck`: PASS após o build terminar, sem execução concorrente que remova tipos gerados; `/tmp/crm-alertas-20261021-typecheck-final.log`.
- `npm test -- --maxWorkers=4`: PASS, 680 arquivos e 5172 testes aprovados, 4 skipped e 1 todo; `/tmp/crm-alertas-20261021-tests-final.log`.
- `git diff --check` dos caminhos da entrega: PASS. Busca de formatos de segredos: PASS; arquivos de ambiente, backups e artefatos excluídos. Dependências e lockfile idênticos à base; auditoria herdada registrada em `docs/reports/staging-sincronizacao-20261020.md`, sem ampliação de escopo.

Falhas intermediárias preservadas nos logs: primeiro typecheck encontrou inferência restrita da fixture `cardChecklistId: null` e a primeira suíte global encontrou o contrato estático de abertura do checklist. A fixture foi tipada com `string | null`, o callback de seleção foi estabilizado com `useCallback` e a chamada legítima mantida, com regressões aprovadas. Uma segunda execução concorrente de tsc/build encontrou `TS6053` em `.next/types` removidos durante o rebuild; o typecheck final foi executado somente após o build completo, sem alterar configuração ou ignorar tipos. A última regressão também cobre nova intenção de alerta com o drawer “Dados da empresa” aberto, fechando-o para revelar o destino indicado. QA incremental desse cenário: APPROVED.

Limitação: não houve teste visual autenticado com uma conta real. A validação funcional usa componentes/layout reais nos harnesses com dados sintéticos; o smoke remoto verificará disponibilidade, proteção e versão do staging, sem criar alertas nem alterar dados reais. Publicação, SHA e READY ainda pendentes nesta versão documental; a prova remota final será mantida fora do Git para evitar outra publicação exclusivamente documental.

## CodeRabbit Integration

- **Story Type Analysis:** frontend e integração; complexidade média pelo estado por usuário e navegação entre frames.
- **Specialized Agents:** @dev implementação/Pre-Commit; @qa regressões; @devops publicação staging.
- **Quality Gates:** Pre-Commit com revisão do diff, quatro gates e CodeRabbit se disponível; registrar limitação/revisão alternativa se ausente. Pre-PR por DevOps quando aplicável; conferir ambiente/release antes do deploy staging.
- **Self-Healing:** @dev light, 2 iterações/15 minutos para CRITICAL e HIGH documentado; @qa full, 3 iterações/30 minutos para CRITICAL/HIGH, MEDIUM como dívida; @devops check, somente reporte.
- **Focus Areas:** identidade do alerta, reconhecimento e isolamento, armazenamento mínimo, reutilização de abas, última intenção, permissões e validação postMessage.

## Validação da preparação — @sm

Checklist `story-draft-checklist.md` aplicado: objetivo/contexto PASS; orientação técnica PASS; referências PASS; informação autocontida PASS; testes PASS; CodeRabbit PASS. **READY, clareza 9/10.** Não comprova implementação, testes ou deploy.

## Dev Agent Record e File List

- `docs/stories/story-crm-alertas-tarefas-leitura-navegacao.md` — escopo, checklist e evidências.
- `src/store/useBpmTarefasNotificacoes.ts` — persistência exclusiva de IDs exibidos/lidos/removidos por usuário, leitura individual e reconciliação entre abas.
- `src/hooks/useBpmTarefasNotifications.ts` — clique marca leitura e ignora callback de sessão encerrada.
- `src/hooks/useBpmCardNotificacaoNavigation.ts` — reutiliza CRM, preserva iframe do mesmo funil e distingue documento/geração ao navegar entre funis.
- `src/lib/bpm/notificacoes-tarefas.ts` — tarefaId no link/intenção validada.
- `src/lib/painel-tabs.ts` — identificação do módulo CRM entre suas rotas.
- `src/components/layout/PainelLayoutClient.tsx` — aba alvo opcional e reutilização também em cliques antes do próximo render.
- `src/components/layout/CentralNotificacoesPainel.tsx` — leitura individual e timer cancelado/isolado entre contas.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/page.tsx` — valida destino inicial da tarefa.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` — substitui card/tarefa selecionados e entrega intenção declarativa ao modal.
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx` — encaminha intenção ao layout do card autorizado.
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx` — volta à aba do funil do card ao receber novo clique de alerta.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx` — abre Tarefas/Procedimento e aguarda DOM para focar o alvo, com cleanup.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelTarefasPorTipo.tsx` — âncora e foco visível na tarefa.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistsCard.tsx` — âncora e foco no procedimento representado pela tarefa vinculada.
- `tests/bpm/tarefas-notificacoes-store.test.ts` — recarga, leitura, remoção, usuário, outro horário e storage bloqueado.
- `tests/bpm/tarefas-notificacoes-hook-react.test.ts` — clique, remontagem, polling e callback de conta antiga.
- `tests/bpm/tarefas-notificacoes-navegacao-react.test.ts` — reutilização, funis, frame real, cliques rápidos, origem/ACK e usuário.
- `tests/bpm/tarefas-notificacoes-board-react.test.ts` — um único card e tarefa substituídos pela mensagem autorizada.
- `tests/layout/painel-tabs.test.ts` — identidade CRM sem confundir outros módulos.
- `tests/bpm/tarefas-alertas-central-react.test.ts` — central real reconhece clique/visualização e cancela leitura de outra conta.
- `tests/bpm/tarefas-alertas-foco-react.test.ts` — layout, histórico, Tabs e painéis reais: foco da tarefa e procedimento carregado depois.

Regressão focada: 11 arquivos, 47 testes aprovados. Cenários incluem voltar ao funil anterior antes do fim da navegação intermediária e clicar novamente com aba interna do card em outro funil. Foco utiliza props declarativas até o painel; o procedimento tem uma tarefa por cardChecklistId, portanto o alvo é o procedimento inteiro, sem inventar item inexistente no contrato.

Nenhuma alteração de schema, migration, escrita em banco, dependências ou conteúdo persistido de clientes. O reconhecimento entre recargas vale no mesmo navegador/usuário; se o navegador bloquear armazenamento, a deduplicação permanece em memória. CodeRabbit indisponível no PATH e em ~/.local/bin/coderabbit; revisão independente @qa aplicada como alternativa. Pendências concretas da revisão inicial (documento antigo na navegação, foco assíncrono e timer entre contas) corrigidas e cobertas pelos testes.

`git diff --check` global aponta apenas os dois espaços finais preexistentes em AlphaBI, fora do escopo e preservados. Os caminhos deste bugfix serão conferidos isoladamente antes de publicar.

## QA Results

**PASS / APPROVED na revisão independente de código dos 22 caminhos.** Achados iniciais corrigidos e cobertos por regressões: URL registrada diferente do documento real; P1→P2→P1 com navegação em andamento; ACK atrasado/origem/frame; tarefa e procedimento carregado depois; retorno da aba interna de outro funil; timer da conta A não reconhece alertas da conta B. Somente IDs são persistidos por usuário; novos horários continuam elegíveis. Nenhum defeito remanescente identificado. A aprovação da entrega depende dos quatro gates e de READY/smoke de staging; QA não repetiu os gates de DevOps.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-21 | 0.1 | Preparação da correção e checklist de draft | River (@sm) |
| 2026-10-21 | 0.2 | Reconhecimento persistido por ID, CRM reutilizado, tarefa focada e regressões reais aprovadas | Dex / Codex |
| 2026-10-21 | 0.3 | Gates globais finais aprovados, regressões intermediárias corrigidas e pacote pronto para staging | Gage / Codex |
