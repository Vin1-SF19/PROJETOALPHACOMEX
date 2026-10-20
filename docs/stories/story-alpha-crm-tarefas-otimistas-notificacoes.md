# Story: Conclusão imediata de tarefas e alertas nas notificações do Painel Alpha

**Status:** Ready for Review

```yaml
executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: [review, vitest, lint, typecheck, build]
```

## Story

Como usuário do CRM, quero ver a tarefa concluída assim que a marcar e receber os alertas configurados na central de notificações do Painel Alpha, para trabalhar com uma interface fluida e identificar a ação e o horário do compromisso.

## Contexto e origem

Solicitação direta do usuário: concluir tarefas demora para registrar, leva a cliques repetidos e erros; os alertas podem ser cadastrados, mas não chegam às notificações já existentes no painel. Esta story corrige a experiência e conecta a entrega dos alertas ao sistema existente.

A [story anterior](story-alpha-crm-tarefas-por-tipo-alerta.md#tipos) já definiu tarefas de checklist, ligação, WhatsApp, e-mail, tarefa comum e lembrete rápido. Os campos `tipo`, `alertaEm` e `alertaDisparadoEm` já existem; não é necessário alterar o schema para esta correção. WhatsApp e e-mail continuam representando tarefas internas, sem envio externo automático.

[AUTO-DECISION] Epic numerado e integração ClickUp → usar a solicitação explícita do usuário e o caminho de story solicitado pela coordenação; não criar epic, item externo ou requisito adicional.

## Critérios de aceitação

1. Ao concluir uma tarefa elegível, o frontend mostra imediatamente o estado concluído, antes da resposta do servidor, com indicação discreta de salvamento. O usuário pode continuar usando o card durante a persistência.
2. Durante a requisição, novos cliques na mesma tarefa não enviam novas conclusões. Tarefas diferentes continuam independentes; atualizações de dados durante o salvamento não desfazem a marcação pendente nem fazem uma resposta antiga alterar outro card.
3. Após sucesso, o estado é conciliado com os dados do servidor. Em falha real de autorização, validação ou persistência, a tarefa volta ao estado anterior e o usuário recebe uma mensagem clara com possibilidade de tentar novamente. A finalização do salvamento libera o controle também quando a chamada lança uma exceção.
4. A conclusão no servidor é idempotente e protegida contra concorrência: uma tarefa já concluída não duplica histórico, eventos ou outros efeitos. A autorização existente é verificada antes de aceitar a operação ou o resultado de uma repetição. Falha de notificação posterior a uma conclusão já persistida não é devolvida como falha da conclusão. A validação aceita os IDs nativos e o formato importado estrito `rdtask_<28 caracteres hexadecimais>`, recusando formatos inválidos e mantendo a mesma ACL para tarefas importadas.
5. As regras existentes de tarefas de procedimento, checklist e nota fiscal, bem como a autorização de edição do card/tarefa, continuam sendo respeitadas. A atualização otimista só ocorre para ações de conclusão permitidas e não contorna formulários ou condições obrigatórias.
6. Uma tarefa pendente com alerta configurado e vencido aparece nas notificações existentes do Painel Alpha para seu responsável autorizado, incluindo todos os tipos de tarefa aplicáveis; não fica restrita ao tipo `PROXIMO_CONTATO`.
7. A notificação informa título, tipo e descrição/contexto disponíveis, empresa/card, nome do responsável, data e hora do alerta e prazo da tarefa quando disponível. Horários seguem a convenção de apresentação do painel. Campos opcionais ausentes não geram valores `undefined`, IDs exibidos no lugar de nomes ou erros de renderização.
8. Ao abrir a notificação, o usuário navega para o pipeline e o card corretos utilizando o mecanismo de abertura do CRM e sua autorização existente. Os dados do alerta não são enviados a canais públicos ou a usuários sem responsabilidade/acesso; a consulta de recuperação é autenticada e limitada ao usuário da sessão.
9. O cron legado e a ação `MARCAR_ALERTA_TAREFA` do motor central utilizam o mesmo contrato/emissor de alerta. A configuração de migração para o motor não deixa tarefas sem entrega; a marcação persistida e a consulta de recuperação permitem mostrar alertas pendentes mesmo após ausência do usuário ou falha do realtime, incluindo os já marcados como disparados antes desta correção, sem duplicar a mesma notificação na interface.
10. A consulta de recuperação de notificações é somente leitura: não conclui tarefas, não executa o worker/motor, não marca alertas nem escreve histórico. Conclusões, reagendamentos e mudanças de responsabilidade são conciliados para evitar notificações obsoletas ou atribuídas a outra pessoa.
11. A implementação reutiliza a central existente, mantém a contagem/leitura e a apresentação coerentes com suas demais fontes, sem criar schema, migration, backfill ou serviço externo novo. Nenhum worker ou teste que escreva dados reais é executado para validar esta story.
12. Checklist, File List e evidências de validação são atualizados antes de concluir. Após validação, o commit e o push para `staging` seguem a autorização permanente do usuário, preservando alterações de outras tarefas no workspace.

## Tasks / Subtasks

- [x] Confirmar contrato de conclusão e de notificação com a arquitetura e o sistema existente. (AC: 4–11)
  - [x] Registrar os dados do alerta, canal autenticado e mecanismo de navegação do card.
  - [x] Confirmar como cron e motor se complementam durante a migração, sem pular tipos de tarefa.
- [x] Tornar a conclusão segura no servidor antes de ligar o estado otimista. (AC: 3–5)
  - [x] Manter ACL e todas as condições de tarefas de procedimento/nota fiscal.
  - [x] Aplicar mudança condicional de status e retorno idempotente sem duplicar efeitos.
  - [x] Separar falha da persistência de falha posterior de publicação realtime.
- [x] Implementar atualização otimista por tarefa no painel de tarefas. (AC: 1–3, 5)
  - [x] Marcar e bloquear repetição imediatamente, com salvamento assíncrono.
  - [x] Conciliar sucesso, refetch, respostas atrasadas e troca de card.
  - [x] Restaurar o estado e exibir feedback em erro real ou exceção.
- [x] Conectar os alertas ao sistema de notificações existente. (AC: 6–11)
  - [x] Reutilizar um emissor/contrato no cron e na ação do motor central.
  - [x] Implementar recuperação autenticada somente leitura por responsabilidade do usuário.
  - [x] Integrar fonte CRM no hook/store e central, com deduplicação, contagem e estado de leitura.
  - [x] Exibir informação completa e abrir o card correto; conciliar alertas obsoletos.
- [x] Executar testes isolados com mocks e relógio controlado. (AC: 1–11)
  - [x] Cobrir interface otimista, duplo clique, concorrência e reversão em falhas.
  - [x] Cobrir idempotência, ACL, condições obrigatórias e falha posterior à persistência.
  - [x] Cobrir todos os tipos, cron/motor, recuperação, deduplicação, autorização e navegação.
- [x] Rodar gates, revisar alterações e atualizar esta story. (AC: 12)
  - [x] `npm run lint`.
  - [x] `npm run typecheck`.
  - [x] `npm test`.
  - [x] `npm run build`.
  - [x] Atualizar File List, resultados e limitações; delegar commit/push de `staging` a `@devops`.

## Dev Notes

### Evidências e pontos de integração

- `PainelTarefasPorTipo.tsx` chama `ConcluirTarefaBpm` no clique e só chama `onAtualizado` após o sucesso, sem estado pendente por tarefa. É o ponto principal para a resposta imediata e bloqueio de repetição. [Source: `src/app/PainelAlpha/AlphaCRM/CardModal/PainelTarefasPorTipo.tsx`, handler de conclusão]
- `ConcluirTarefaBpm` possui transação de conclusão e publica `notificarPipelineBpm` depois dela; a publicação e a alteração persistida precisam de tratamentos de erro separados. O arquivo já contém trabalho paralelo, que deve ser preservado. [Source: `src/actions/bpm/Tarefas.ts#ConcluirTarefaBpm`]
- O diagnóstico adicional confirmou que `ConcluirTarefaSchema` aceita apenas CUID, enquanto existem tarefas importadas com ID `rdtask_<28hex>`. Corrigir a validação estritamente para os dois formatos, sem aceitar strings arbitrárias. [Source: diagnóstico da coordenação; `src/lib/validations/bpm.ts`, `ConcluirTarefaSchema`]
- O runner de alertas já usa `status`, `alertaEm` e `alertaDisparadoEm` para selecionar/marcar tarefas e notifica o pipeline. A ação central `MARCAR_ALERTA_TAREFA` também altera o marcador e publica a mudança. Precisam compartilhar a entrega de notificação pessoal. [Source: `src/lib/bpm/alertas-tarefas.ts`; `src/lib/bpm/automacoes/central-runtime.ts`, ação `MARCAR_ALERTA_TAREFA`]
- O endpoint protegido de jobs existente é `src/app/api/bpm/jobs/alertas-tarefas/route.ts`; sua condição de migração deve ser inspecionada para não interromper a entrega dos demais tipos. Não chamar esse endpoint contra dados reais para testes.
- A central está em `src/components/layout/CentralNotificacoesPainel.tsx`. `src/hooks/useCalendarioAlphaNotifications.ts` e `src/store/useCalendarioAlphaNotificacoes.ts` são referências existentes para fonte de notificação, cliente realtime e estado local. O endpoint de autorização de canais privados é `src/app/api/pusher/auth/route.ts`.
- A [story anterior, seção Banco e automação](story-alpha-crm-tarefas-por-tipo-alerta.md#banco-e-automação) descreve a persistência já disponível. Esta correção não reaplica a migration dessa story e não usa seus backups antigos como autorização para mudanças de banco.

### Decisões e limites

[AUTO-DECISION] Atualização instantânea → usar estado otimista por tarefa com reconciliação, bloqueio de duplicação e reversão em erro real; não remover as validações de negócio do servidor.

[AUTO-DECISION] Alerta sem usuário conectado ou com falha do realtime → recuperar os alertas de responsabilidade do usuário em uma consulta autenticada somente leitura. O backend continua responsável por avaliar/disparar alertas; a consulta não substitui o worker nem produz efeitos.

[AUTO-DECISION] Fonte de notificações → integrar o alerta CRM à central já usada pelo painel, sem tabela ou sistema paralelo. O contrato exato e os nomes de novos módulos ficam a cargo da arquitetura/implementação e devem ser registrados na File List final.

A arquitetura confirmou canal próprio CRM, hook/store integrados à central e recuperação autenticada via GET a cada 30 segundos. Diagnóstico somente leitura identificou cinco tarefas pendentes com alerta vencido e `alertaDisparadoEm` já preenchido; portanto a recuperação deve incluir alertas previamente marcados e ainda pertinentes, sem backfill. A configuração do cron/realtime foi confirmada por presença, sem expor credenciais.

Não há novo ambiente, credencial ou variável de ambiente prevista. Reutilizar a configuração existente do realtime. Nenhuma alteração estrutural ou mutação em massa está autorizada por esta story; se uma necessidade desse tipo surgir, aplicar a política Vault do projeto antes de executar.

### Coerência e estrutura

`accumulated-context.md` foi procurado no workspace e não foi encontrado. A coerência foi baseada na story anterior de tarefas e alertas e na solicitação atual, que explicitamente reutiliza o sistema de notificações existente. `.aiox/gotchas.json` também não foi encontrado. O caminho de persona `.Codex/commands/AIOX/agents/sm.md` não existe; foi usado `.aiox-core/development/agents/sm.md`.

Os documentos de arquitetura gerais configurados (`docs/architecture/index.md` e `docs/framework/`) não estão presentes nesta cópia do projeto; não foi encontrada orientação adicional específica nesses documentos. Os pontos técnicos acima vêm dos arquivos reais e do diagnóstico da coordenação, sem introduzir dependências novas.

## Testing

Usar Vitest e os padrões existentes em `tests/bpm/`, com mocks de Prisma, actions, realtime e relógio. Não executar banco remoto, cron ou worker real.

- Interface: promessa de conclusão controlada para confirmar que a marca muda antes da resolução; duplo clique gera uma chamada; tarefas diferentes podem salvar em paralelo; sucesso, retorno de erro e exceção; refetch durante salvamento; troca de card e retorno tardio; controles especiais de procedimento/NF preservados.
- Action: transição condicional, repetição e concorrência sem duplicar histórico/efeitos; IDs nativos e importados válidos, formatos inválidos recusados; tarefa sem acesso continua recusada; falha de publicação após commit retorna sucesso da conclusão; validação ou persistência falhando retorna erro real.
- Alertas: datas antes/no/depois do horário com relógio fixo; todos os tipos; tarefa concluída ou sem alerta não dispara; cron e motor usam o mesmo contrato; migração não elimina tipos; falha de realtime pode ser recuperada.
- Consulta e central: sessão ausente e acesso negado; apenas tarefas do responsável autorizado; rota somente leitura sem chamadas de escrita; título, tipo, descrição, empresa, responsável, data e hora; campos opcionais vazios; uma entrada por alerta; conclusão/reagendamento remove informação antiga; abertura correta do pipeline/card; nenhuma regressão das demais fontes.

Critério de sucesso: ACs demonstrados por testes determinísticos e gates registrados. Falhas preexistentes, se houver, devem ser comparadas com a base e documentadas separadamente; não alterar código de outras tarefas apenas para corrigir o baseline.

## 🤖 CodeRabbit Integration

### Story Type Analysis

- **Primary Type:** Integration.
- **Secondary Types:** Frontend, API, Security.
- **Complexity:** High — conclusão concorrente, tarefas especiais, canais autenticados e integração cron/motor/central.

### Specialized Agent Assignment

- `@dev`: implementação e revisão pre-commit.
- `@architect`: contrato compartilhado e autorização da entrega/recuperação.
- `@ux-expert` / `@ux-design-expert`: estados de salvamento e mensagens acessíveis.
- `@qa`: cobertura de concorrência, erro e regressão.
- `@github-devops` / `@devops`: revisão final e push autorizado para staging.

### Quality Gate Tasks

- [x] Pre-Commit (`@dev`): revisão dos ACs, testes, lint, typecheck e build.
- [x] Pre-Push (`@devops`): diff isolado da story, evidências e ausência de segredos.
- Pre-PR: N/A, não há PR solicitado.
- Pre-Deployment de produção: N/A, escopo autorizado é staging.

### Self-Healing Configuration

`@dev`: light, até 2 iterações/15 minutos, corrigir CRITICAL e documentar HIGH. `@qa`: full, até 3 iterações/30 minutos para CRITICAL/HIGH; MEDIUM como dívida. `@devops`: check, somente relatório. LOW pode ser ignorado. Se o CLI CodeRabbit não estiver instalado, registrar a indisponibilidade e aplicar o fallback de revisão previsto no core-config.

### Focus Areas

- Concorrência, idempotência e classificação correta de falhas após commit.
- ACL, canal privado, recuperação limitada à sessão e ausência de vazamento entre usuários.
- Acessibilidade dos controles, reconciliação de estado e navegação correta.
- Deduplicação e compatibilidade dos alertas nos caminhos cron/motor.

## File List

- `docs/stories/story-alpha-crm-tarefas-otimistas-notificacoes.md`
- `src/actions/bpm/Tarefas.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelTarefasPorTipo.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/page.tsx`
- `src/app/api/bpm/tarefas/alertas/route.ts`
- `src/app/api/pusher/auth/route.ts`
- `src/components/layout/CentralNotificacoesPainel.tsx`
- `src/components/layout/PainelLayoutClient.tsx`
- `src/hooks/useBpmCardNotificacaoNavigation.ts`
- `src/hooks/useBpmTarefasNotifications.ts`
- `src/hooks/useConclusaoTarefasBpm.ts`
- `src/lib/bpm/alertas-tarefas.ts`
- `src/lib/bpm/automacoes/central-runtime.ts`
- `src/lib/bpm/notificacoes-tarefas.ts`
- `src/lib/validations/bpm.ts`
- `src/store/useBpmTarefasNotificacoes.ts`
- `tests/bpm/tarefas-alertas-api.test.ts`
- `tests/bpm/tarefas-alertas-central-runtime.test.ts`
- `tests/bpm/tarefas-checklist-actions.test.ts`
- `tests/bpm/tarefas-conclusao-otimista-react.test.ts`
- `tests/bpm/tarefas-notificacoes-board-react.test.ts`
- `tests/bpm/tarefas-notificacoes-hook-react.test.ts`
- `tests/bpm/tarefas-notificacoes-navegacao-react.test.ts`
- `tests/bpm/tarefas-notificacoes-pusher.test.ts`
- `tests/bpm/tarefas-notificacoes-store.test.ts`
- `tests/bpm/tarefas-tipo-actions.test.ts`
- `tests/bpm/tarefas-tipo.test.ts`
- `tests/chamados/central-notificacoes-painel.test.ts`

## Validação da story-draft-checklist

**Resultado:** READY — clareza 9/10. Story preparada para implementação sem bloqueio documental; os nomes dos novos módulos são decisões de arquitetura já identificadas, sem dependência de novo schema.

| Categoria | Resultado | Evidência |
| --- | --- | --- |
| Objetivo e contexto | PASS | Solicitação, valor e relação com a story de tarefas explícitos. |
| Orientação técnica | PASS | Pontos de integração, contratos comportamentais, limites e arquivos prováveis descritos. |
| Referências | PASS | Contexto anterior resumido e referências a seções/handlers reais. |
| Autossuficiência | PASS | Regras, decisões, segurança e casos de erro presentes. |
| Testes | PASS | Cenários determinísticos por camada e gates definidos. |
| CodeRabbit | PASS | Tipos, agentes, checkpoints, self-healing e foco presentes. |

Perspectiva do desenvolvedor: há contexto suficiente para implementar; confirmar a interface concreta de notificações durante a arquitetura evita duplicar o mecanismo existente. Os únicos artefatos gerais ausentes estão documentados, e o trabalho não depende deles para começar.

## Dev Agent Record

Modelo: GPT-6 (Codex). Implementação isolada da base `7b2d8642` para preservar as alterações concorrentes do workspace.

- Conclusão otimista por tarefa, trava síncrona, reconciliação de snapshots atrasados e rollback em erro. As regras de procedimento/NF continuam no backend.
- Conclusão com CAS na transação; somente o vencedor publica histórico/eventos/SLA. Falhas de cache/realtime após commit são registradas sem informar perda do salvamento.
- Formatos nativos, importados RD e próximo contato validados estritamente, com a mesma ACL. Criação de tarefas aceita card RD.
- Emissor comum cron/motor com canal privado individual; o evento contém apenas a identidade da tarefa e aciona leitura autorizada. Falha de entrega libera somente a marcação da tentativa corrente.
- Recuperação GET somente leitura, paginada por responsabilidade antes da ACL. Inclui alertas antigos marcados, remove pendências concluídas/reagendadas/revogadas e usa timezone America/Sao_Paulo.
- Fonte CRM adicionada à central do painel com dados completos, deduplicação, leitura/remoção e navegação por URL/intenção autenticada no iframe. A consulta ocorre na entrada, foco, reconexão e a cada 30s com a aba visível.
- A abertura por alerta respeita o filtro de cards sem confundir ausência no filtro com revogação: o detalhe revalida ACL no polling. O protocolo de intenção permite reabrir o mesmo card em aba existente, com handshake e validação de origem/frame/pipeline/IDs.
- Nenhum schema, migration, backfill ou job real executado. Todos os testes de escrita usam mocks.

Logs: `/tmp/alpha-tarefas-lint.log`, `/tmp/alpha-tarefas-typecheck.log`, `/tmp/alpha-tarefas-suite-entrega.log`, `/tmp/alpha-tarefas-alertas-build.log`.

Validação final:

- `npm run lint`: exit 0; zero erros e 1.193 avisos preexistentes.
- `npm run typecheck`: exit 0.
- `npm test -- --maxWorkers=2`: 652 arquivos / 4.860 testes aprovados; quatro arquivos falham com os mesmos seis testes e uma falha de importação da base. Comparação exata dos nomes em `/tmp/alpha-tarefas-comparacao-base.json`: nenhuma falha nova. Falhas existentes: `builder/embed.test.ts` (3), `bpm/em-tratativa.test.ts` (2), `bpm/card-modal-integration.test.ts` (1), `bpm/arquivamento-modal-react.test.ts` (import de `next/server`). Não houve inclusão das correções de outras tarefas nesta entrega.
- Pipeline de build executado integralmente: `prisma generate`, `npm run build:player` e `next build --webpack`; exit 0 em 62,72s. Usada afinidade de uma CPU e heap de 4 GiB para limitar recursos neste host. Pico RSS observado: 5,60 GiB. O ajuste transitório gerado no tsconfig foi restaurado.
- Testes com mocks cobrem otimista/duplo clique/rollback, CAS/repetição/ACL/pós-commit, tipos de tarefas, falha de entrega, caminho do motor central, recuperação paginada, isolamento de usuário, polling, realtime, deduplicação e navegação do card com revalidação de ACL.
- `git diff --check`: sem erros. CodeRabbit CLI indisponível; revisão independente realizada por QA.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-20 | 1.0 | Story preparada a partir da solicitação atual e diagnóstico do código; checklist de draft aprovada. | River / SM |

## QA Results

Revisão independente `@qa` executada. Três achados P2 foram corrigidos e reavaliados: reabertura da mesma notificação, permanência de card fora da visão Meus e revalidação periódica da ACL sem realtime. Sem novos achados de implementação. Gate final: **CONCERNS, restrito ao baseline preexistente**; sem regressão identificada no delta. Lint, typecheck e build aprovados; comparação da suíte confirma `newFailures=[]`.

A integração com o workspace principal, que contém mudanças simultâneas não incluídas neste commit, também passou em typecheck e em 44 testes específicos. As duas adaptações de contexto em Board/page preservaram as edições concorrentes.


## DevOps Pre-Push

Gage revisou os 29 arquivos staged desta story no worktree isolado. `git diff --cached --check` sem erros, nenhum conflito, nenhum arquivo unstaged e File List completa. Inspeção dos arquivos e busca de padrões de credenciais não identificaram segredos; nenhum `.env`, dump, chave, migration ou alteração de dependência integra o commit.

Evidências de lint, typecheck, build e QA conferidas; a comparação automatizada da suíte confirma `newFailures=[]`. O resultado permanece CONCERNS exclusivamente pelas falhas preexistentes documentadas acima. CodeRabbit indisponível, com revisão independente de QA como fallback.

[AUTO-DECISION] Confirmação de commit/push → seguir a autorização permanente explícita do usuário para publicar cada alteração em `staging`. Publicação limitada ao delta desta story, sem force push, alteração de versão, PR ou operação de banco. O remoto foi consultado/fetched e permanece na base `7b2d8642`; a operação planejada é commit convencional e `git push origin HEAD:staging`, com conferência posterior do hash remoto. As alterações concorrentes do workspace principal serão preservadas pela coordenação.

Verificação adicional somente leitura de dependências: `npm audit --audit-level=moderate --json` reportou 136 vulnerabilidades (10 critical, 60 high, 64 moderate, 2 low), log `/tmp/alpha-tarefas-devops-audit.json`. O delta não altera `package.json`, lockfile nem dependências; trata-se do inventário herdado da base e não de dependência introduzida por esta correção. Nenhuma atualização automática de pacote foi executada.
