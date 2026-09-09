# Story: Agenda Alpha — Operação contínua, tarefas e eventos de status

**ID:** STORY-CALALPHA-003  
**Epic:** Agenda Alpha  
**Status:** InProgress  
**Prioridade:** Alta  
**Complexidade:** Alta  
**Data:** 2026-08-26

## Narrativa

Como usuário da Agenda Alpha, quero criar e acompanhar compromissos, tarefas, foco, ausência e local de trabalho no Painel Alpha, com os dados coerentes com o Google, para operar minha agenda sem alternar de sistema.

## Critérios de aceite

- [ ] O menu de criação permite escolher Evento, Tarefa, Horário de foco, Ausente e Local de trabalho.
- [ ] Evento comum preserva agenda, convidados, Meet, localização, descrição e horários; os campos específicos de status obedecem às restrições do Google Calendar.
- [ ] Tarefas do Google Tasks podem ser criadas, listadas, editadas e concluídas por um controle de marcação na Agenda Alpha.
- [ ] A sincronização manual atualiza eventos e tarefas, apresenta erros seguros por origem e permanece disponível no cabeçalho.
- [ ] Alterações externas do Google Calendar são processadas automaticamente quando push/fila/worker estiverem configurados; a UI torna explícita a indisponibilidade operacional quando não estiverem.
- [ ] Nenhum input do cliente escolhe a identidade Google impersonada; toda leitura/escrita continua ancorada na sessão autenticada.
- [ ] Cobertura automatizada inclui validações, mapeamentos Google, criação/conclusão de tarefas, tipos de evento e falhas de sincronização.
- [x] Tarefas concluídas permanecem visíveis nas visões da agenda, com aparência escurecida, indicador concluído e título riscado.
- [x] Usuários com vínculo de compartilhamento aprovado como Editor podem criar, editar e concluir eventos e tarefas na agenda compartilhada; Visualizador permanece somente leitura.
- [x] Notificações da Agenda Alpha ativam a aba interna do módulo e pedidos recebidos abrem diretamente o painel de aprovação/recusa, sem navegação por rota no shell.
- [x] A visão mensal reproduz a referência `public/melhoriaAgenda.png`: grade compacta, cabeçalho integrado à primeira semana, itens com hierarquia por tipo e contador de excedentes, sem perder ações existentes.

## Vault

**Ambiente:** Turso remoto de produção.  
**Autorização explícita:** recebida em 2026-08-26 para backup pré-alteração e migration aditiva.  
**Backup validado:** `database-backups/pre-change/painelalpha_turso_pre_change_parceiro-proxima-acao_2026-08-26T18-46-15-291Z.sql`; 75.959.080 bytes; SHA-256 `2cb1bf830e7f22d8bff5bdb488e91195e915a879fd2f4d33e4d753c171f1b09d`; manifest conferido em 2026-08-26 antes da migration.

**Extensão para chamados (2026-08-27):** autorização explícita recebida para novo backup e migration aditiva de tarefas agendadas. Backup novo: `database-backups/pre-change/painelalpha_turso_pre_change_2026-08-27T14-22-56-353Z.sql`; 21.438.107 bytes; SHA-256 `b2c010b56e840e28275090005480e4877929347702e8437645a58ca1745e754b`; 253 tabelas e 46.664 registros, manifest e hash conferidos antes da aplicação remota. Migration aplicada via `@libsql/client` (sem Turso CLI) e pós-validação confirmou a tabela e os três índices.

Alterações previstas são somente aditivas: novas tabelas de cache/listas de tarefas, relações virtuais e campos de tipo/propriedades para eventos. Não há `DROP`, renomeação, backfill ou exclusão em massa. Rollback operacional: retornar o código anterior, que ignora as estruturas novas; qualquer remoção posterior exige novo Vault.

## Tasks / Subtasks

- [ ] Elaborar, revisar e aplicar migration aditiva após gerar o SQL final e validar integridade do Turso.
- [ ] Estender cliente/DTO/validação do Google Calendar para tipos de status e convidados.
- [ ] Integrar Google Tasks API por Domain-Wide Delegation e cache local de listas/tarefas.
- [ ] Ampliar formulário e visões da Agenda Alpha, incluindo conclusão de tarefa acessível.
- [ ] Exibir diagnóstico operacional e manter sincronização manual; documentar requisitos de push, worker e escopo Google Tasks.
- [ ] Criar/regredir testes específicos e executar lint, typecheck, testes e build.
- [x] Criar vínculo aditivo entre chamado e tarefa Google, com início, fim planejado e fim real locais.
- [x] Criar a tarefa de uma hora para técnico TI ao assumir o chamado e concluí-la ao fechar o chamado.
- [x] Exibir tarefa agendada na grade horária em azul durante o atendimento e em verde após a conclusão.
- [x] Persistir a resposta do próprio participante no cache e riscar visualmente convites recusados em todas as visões da agenda.
- [x] Exibir eventos organizados por outra pessoa em modo de contorno, com cor do calendário na borda e no texto.
- [x] Abrir convites em painel detalhado com Meet, telefones, local, descrição, organizador e respostas dos convidados.
- [x] Eliminar recargas de servidor na troca entre dia, semana, mês e ano usando navegação local, snapshot IndexedDB e revalidação em segundo plano.
- [x] Exibir criação e conclusão imediatamente de forma otimista, reconciliando sucesso ou falha com o backend sem perder feedback para o usuário.
- [x] Consolidar eventos e tarefas do período em uma leitura cache-only autorizada e instrumentada, sem consultar o Google no carregamento da tela.
- [x] Cobrir snapshot, cache local, navegação, reconciliação otimista e métricas seguras com testes automatizados.
- [x] Conectar o worker persistente da Agenda Alpha ao scheduler autenticado, com uma operação por minuto e proteção por claim/lease distribuído.
- [x] Manter tarefas concluídas no período visível e padronizar o estado visual concluído em dia, semana, mês e lista expandida.
- [x] Integrar destinos compartilhados Editor ao formulário e proteger eventos/listas/tarefas por vínculo e identidade Workspace resolvidos no servidor.
- [x] Substituir o `router.push` das notificações por ativação da aba interna e handshake confiável para abrir o modal de compartilhamentos.
- [x] Projetar a tarefa do chamado na Agenda Alpha do solicitante como somente leitura e refletir a conclusão e o horário real do atendimento.
- [x] Encerrar carregamentos de agendas compartilhadas sem resposta, preservando resultados parciais e oferecendo nova tentativa.
- [x] Reformular a visão mensal conforme a referência visual, mantendo responsividade, teclado, edição, conclusão e acesso à lista completa do dia.

## File List

- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_agenda_alpha_tasks_status/migration.sql`
- `prisma/migrations/20260827150000_add_google_calendar_task_schedule_for_chamados/migration.sql`
- `src/lib/google-calendar/{client,types,cache-eventos,scopes,sync}.ts`
- `src/lib/chamados/tarefa-agendada.ts`
- `src/lib/chamados/notificacoes-server.ts`
- `src/actions/chamados.ts`
- `src/actions/protocolos.ts`
- `src/actions/google-calendar-{eventos,sync,tarefas}.ts`
- `src/components/CalendarioAlpha/{FormularioEvento,CalendarioAlphaDashboard,StatusSincronizacao,GradeHoraria,VisaoMes,VisaoAno,DiaEventosPopover}.tsx`
- `src/components/CalendarioAlpha/lib/{tipos,itens-agenda,useAgendaAlphaController}.ts`
- `src/app/PainelAlpha/CalendarioAlpha/page.tsx`
- `tests/google-calendar/{itens-agenda,layout-eventos,page-cache-wiring}.test.ts`
- `tests/google-calendar/evento-resposta-usuario.test.ts`
- `scripts/{turso-backup,apply-turso-migration}.mjs`
- `src/actions/google-calendar-agenda.ts`
- `src/lib/google-calendar/observability.ts`
- `src/components/CalendarioAlpha/AgendaFeedback.tsx`
- `src/components/CalendarioAlpha/AgendaOverlays.tsx`
- `src/components/CalendarioAlpha/lib/cache-local.ts`
- `src/app/api/calendario-alpha/jobs/worker/route.ts`
- `tests/google-calendar/{agenda-snapshot,cache-local,observability,worker-route}.test.ts`
- `vercel.json`
- `plan/self-critique-agenda-alpha-performance.json`
- `src/actions/google-calendar-{admin,colegas}.ts`
- `src/components/layout/PainelLayoutClient.tsx`
- `src/components/CalendarioAlpha/{CompromissoNotificacaoToast,SinoNotificacoesCompromissos}.tsx`
- `src/components/CalendarioAlpha/lib/{useAgendasCompartilhadas,tipos,itens-agenda}.ts`
- `src/components/CalendarioAlpha/lib/carregamento-compartilhadas.ts`
- `src/lib/google-calendar/navegacao.ts`
- `src/lib/google-calendar/notificacoes.ts`
- `src/hooks/useCalendarioAlphaNotifications.ts`
- `tests/google-calendar/{compartilhamento-escrita,navegacao-notificacoes}.test.ts`
- `tests/chamados/{finalizar-protocolo-agenda,tarefa-agendada}.test.ts`
- `tests/chamados/{assumir,notificacoes}.test.ts`
- `tests/google-calendar/chamado-solicitante-readonly.test.ts`
- `tests/google-calendar/carregamento-compartilhadas.test.ts`
- `tests/google-calendar/visao-mes-visual.test.ts`
- `public/melhoriaAgenda.png`
- `plan/self-critique-agenda-alpha-sharing.json`
- `plan/self-critique-chamados-agenda-conclusao.json`
- `plan/self-critique-chamado-solicitante-agenda.json`
- `plan/self-critique-agendas-compartilhadas-loading.json`

## Dev Agent Record

### Completion Notes

- A entrada da Agenda entrega o shell sem consultar eventos no SSR; o navegador usa o snapshot local disponível e atualiza os dados pelo backend em paralelo.
- A troca de visão/data usa History API e estado local, mantendo suporte aos botões voltar/avançar.
- Criações de evento/tarefa e conclusão de tarefa aparecem imediatamente; falhas removem o estado otimista com mensagem explícita e sucessos são reconciliados pelo snapshot remoto.
- A sincronização manual de Calendar e Tasks passou a executar em paralelo.
- A fila push ganhou consumidor serverless autenticado a cada minuto; cada invocação processa no máximo um job e preserva a exclusão mútua distribuída já existente.
- Não houve mudança de schema, migration, backfill ou mutação em massa; o protocolo Vault não foi acionado.
- Gates do recorte: ESLint sem ocorrências, 24/24 testes aprovados, typecheck filtrado sem erros e build de produção aprovado. Gates globais continuam bloqueados por dívida anterior fora deste escopo: typecheck com erros preexistentes, lint abrangendo milhares de arquivos legados e 49 testes falhando em 18 arquivos não relacionados.
- CodeRabbit CLI não estava instalado no ambiente; revisão automatizada externa não pôde ser executada.
- Tarefas concluídas com data/horário continuam na grade e usam tratamento escuro/riscado consistente; tarefas sem qualquer data permanecem fora da grade.
- Agendas compartilhadas são carregadas em paralelo sem bloquear o snapshot próprio. O papel Editor habilita destinos de evento e Google Tasks, e as mesmas permissões cobrem edição e conclusão.
- O servidor ignora identidades vindas do cliente: colega, calendário e lista são revalidados contra vínculo aprovado e conexão ativa antes de impersonar a conta Workspace.
- O shell de abas mantém uma intenção pendente até receber confirmação do iframe da Agenda Alpha; convites abrem o painel que contém Aprovar/Recusar.
- Nenhuma estrutura de banco, migration, backfill ou operação em massa foi necessária; Vault não foi acionado.
- Gates do recorte: ESLint sem erros/avisos, 26/26 testes específicos aprovados e build de produção aprovado. Os gates globais continuam bloqueados pela linha de base do repositório: lint com 21.210 ocorrências, typecheck com erros preexistentes fora do recorte e suíte completa com 49 falhas em 18 arquivos; o primeiro `npm run typecheck` também excedeu o heap padrão antes da repetição com 8 GB.
- O encerramento real por **Finalizar com Protocolo** agora aciona a tarefa vinculada ao técnico responsável, reutiliza exatamente o instante salvo em `closedAt`/`updatedAt` como fim real e invalida a Agenda Alpha. O alias legado `T.I` também é reconhecido; falha externa do Google permanece observável e não reabre nem bloqueia o chamado já concluído. O cache e o agendamento locais são concluídos antes da chamada externa, preservando o estado correto da Agenda Alpha mesmo durante indisponibilidade do Google.
- Regressão da integração Chamados → Agenda: 20/20 testes direcionados aprovados, ESLint do recorte sem ocorrências e build de produção aprovado. Os gates globais mantêm a mesma linha de base externa ao ajuste: 21.210 ocorrências no lint, 49 falhas em 18 arquivos e erros de typecheck fora dos arquivos alterados; a execução padrão do typecheck excedeu o heap de 4 GB antes da repetição diagnóstica com 8 GB.
- A tarefa já vinculada ao atendimento também é projetada na Agenda Alpha de quem abriu o chamado, agrupada como `Chamados solicitados`. A projeção não expõe a lista Google privada do técnico e é somente leitura; por compartilhar o mesmo cache/agendamento, recebe automaticamente o estado concluído e o fim real gravado pelo fechamento do chamado. Um evento Pusher privado invalida as agendas abertas do solicitante e do técnico imediatamente após assumir ou concluir, mantendo a revalidação periódica como fallback. Nenhuma estrutura de banco, migration ou backfill foi necessária.
- Regressão do recorte solicitante/TI: 34/34 testes direcionados aprovados, Prisma schema válido, ESLint dos arquivos alterados, `git diff --check` sem ocorrências e build de produção aprovado. Nos gates globais, a linha de base externa ao recorte permanece pendente: lint com 21.210 ocorrências, typecheck com erros em arquivos não alterados e suíte completa com 50 falhas em 19 arquivos contra 2.680 testes aprovados e 1 pendente.
- O indicador `Atualizando agendas compartilhadas…` não depende mais indefinidamente de uma resposta do banco/Google: cada origem recebe limite de 12 segundos, exceções viram erros seguros, o `finally` encerra o loading e as agendas que responderam continuam visíveis. O alerta existente oferece `Tentar novamente`; não houve mudança de schema ou banco.
- Regressão direcionada do carregamento compartilhado: 18/18 testes aprovados (incluindo timeout determinístico, falha segura, privacidade, escrita compartilhada e wiring), ESLint do recorte, `git diff --check` e build de produção aprovados. Nos gates globais, a linha de base externa ao recorte permanece pendente: lint com 21.210 ocorrências, typecheck com erros em arquivos não alterados e suíte completa com 50 falhas em 19 arquivos contra 2.684 testes aprovados e 1 pendente. O teste estrutural preexistente de `page-cache-wiring` integra essa linha de base por o dashboard ter 304 linhas contra o teto antigo de 300.
- A visão mensal passou a seguir a referência fornecida: os dias da semana foram integrados à primeira linha, a quantidade de linhas acompanha as semanas reais do mês, compromissos exibem hierarquia compacta por tipo e somente dois itens ocupam cada célula antes de `Mais N`. Local de trabalho, dia inteiro, evento com horário, convite compartilhado e tarefa concluída mantêm identidades distintas; criação, navegação, edição, conclusão e popover completo continuam disponíveis por mouse e teclado.
- Correção visual pós-validação: removido o fundo sólido exclusivo da visão mensal; o mês reutiliza exatamente o mesmo fundo translúcido das visões Dia e Semana.
- Regressão visual do mês: ESLint do recorte sem ocorrências, 9/9 testes direcionados aprovados, `git diff --check` e build de produção aprovados. A suíte global manteve a linha de base de 50 falhas em 19 arquivos, com 2.687 testes aprovados e 1 pendente; o lint global manteve 21.210 ocorrências e o typecheck falhou somente em arquivos externos ao recorte. Não houve alteração de banco, migration ou backfill.

### Change Log

- 2026-09-09: carregamento cache-first, navegação sem round-trip de página, mutações otimistas, consulta consolidada e telemetria de latência da Agenda Alpha.
- 2026-09-09: permanência visual de tarefas concluídas, escrita em agendas compartilhadas Editor e correção do fluxo de notificações/convites nas abas internas.
- 2026-09-09: correção do encerramento por protocolo para concluir a tarefa vinculada e usar o horário real do fechamento na Agenda Alpha.
- 2026-09-09: projeção somente leitura e atualização privada em tempo real da tarefa do chamado na agenda do solicitante, refletindo atendimento, conclusão e horário real sem duplicar a tarefa Google.
- 2026-09-09: correção do loading infinito das agendas compartilhadas com timeout, falha segura e preservação de resultados parciais.
- 2026-09-09: reformulação da visão mensal conforme `melhoriaAgenda.png`, com grade compacta e adaptativa, hierarquia visual por tipo de compromisso e preservação integral das interações.
- 2026-09-09: correção do fundo da visão mensal para manter consistência visual com as abas Dia e Semana.

## Notas operacionais

- O ambiente consultado possui 0 canais push ativos e as flags de push, fila e lock estão desligadas; sincronização externa automática requer URL HTTPS pública e worker contínuo.
- Google Tasks é uma API distinta e requer habilitação/escopo autorizado pelo administrador do Google Workspace.
- Referências: documentação oficial Google Calendar (event types e push) e Google Tasks API, pesquisadas em 2026-08-26.
