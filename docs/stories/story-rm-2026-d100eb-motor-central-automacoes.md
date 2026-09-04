# Story RM-2026-D100EB — Motor Central de Automações

**Objetivo do Roadmap:** 4. Motor Central de Automações  
**Projeto:** Painel Alpha  
**Módulo:** Alpha CRM / BPM  
**Status:** Concluído  
**Data:** 2026-09-04

## Contexto

O Alpha CRM já possui automações simples no formato de um gatilho e uma ação,
com fila persistente e execução assíncrona. Esta story evolui essa base para o
mecanismo central e configurável do BPM no modelo `GATILHO → CONDIÇÕES → AÇÕES`,
com versionamento imutável, branches, sequência de passos, recorrência,
webhooks, idempotência, retry e observabilidade administrativa.

A implementação deve reutilizar o Motor de Regras de `src/lib/bpm/regras` para
todas as condições. Não será criado um segundo avaliador de expressões.

## Resultado esperado

Administradores conseguem criar, validar, ativar e acompanhar automações na
rota existente `/PainelAlpha/AlphaCRM/automacoes`. Mutações do CRM publicam
eventos canônicos em uma outbox dentro da mesma transação; o worker cria uma
execução idempotente da versão ativa, percorre condições e ações em sequência,
agenda esperas e registra cada passo. Falhas transitórias usam retry com
backoff; falhas terminais permanecem auditáveis e podem ser reprocessadas por
um administrador.

## Regras funcionais

1. Uma automação possui identidade estável e versões imutáveis. Alterações de
   gatilho, condições ou fluxo geram um novo rascunho; ativar congela a versão.
2. O fluxo é um grafo dirigido acíclico com uma raiz e nós `ACAO`, `CONDICAO`,
   `ESPERA` e `FIM`. Ciclos, referências ausentes, nós inalcançáveis e múltiplas
   raízes são rejeitados antes da ativação.
3. Nós de condição usam exclusivamente o AST e os limites do Motor de Regras.
4. A mesma versão não pode executar duas vezes para o mesmo evento.
5. Eventos de uma mesma cadeia preservam `correlationId`, registram
   `causationId` e incrementam profundidade. A profundidade máxima é 10 e uma
   versão não pode reaparecer na própria cadeia causal.
6. A execução é serializada por card/correlação com claim por CAS, lease e
   fencing token; mais de uma instância do worker não pode duplicar efeitos.
7. Falhas transitórias usam tentativas limitadas e backoff. Falha terminal é
   mantida para auditoria; retry manual cria uma nova tentativa controlada sem
   apagar a anterior.
8. Payloads, resultados, logs e histórico não armazenam credenciais, tokens,
   cabeçalhos sensíveis ou corpos ilimitados.
9. A remoção/desativação de uma definição nunca apaga versões ou execuções
   históricas.
10. Componentes React não publicam eventos diretamente; os produtores são as
    Server Actions/serviços transacionais do domínio.

## Gatilhos do escopo

- Card criado e card atualizado.
- Entrada/saída de etapa, derivados do evento canônico de movimento.
- Campo alterado e valor específico assumido por campo.
- Responsável atribuído e membros alterados.
- Tarefa criada e tarefa concluída.
- Vínculo entre cards criado.
- Prazo atingido e tempo decorrido em etapa.
- Execução recorrente por intervalo, diária, semanal e em dias configurados.
- Webhook recebido.
- Resultado de chamada externa.

## Ações do escopo

- Alterar campo e substatus persistido.
- Mover card.
- Criar tarefa, prazo/SLA e alerta.
- Adicionar anotação/histórico.
- Criar card em outro pipeline.
- Atualizar card relacionado.
- Atribuir responsável.
- Reutilizar as comunicações existentes.
- Executar HTTP/API ou webhook com política segura de URL, timeout, tamanho,
  redirects, headers permitidos e proteção contra SSRF.
- Reutilizar ações legadas já cadastradas (e-mail, contrato, ficha, checklist,
  distribuição e oportunidade) por adaptadores do catálogo central.

## Contrato canônico de evento

O contrato Zod deve representar: tipo do evento; entidade e IDs de card e
pipeline; valores anterior e novo; ator (`USUARIO`, `AUTOMACAO`, `SISTEMA` ou
`WEBHOOK`); instante; `correlationId`; `causationId`; profundidade; e uma
`idempotencyKey` única. O publicador recebe o cliente transacional do Prisma e
insere o evento na mesma transação da mutação de origem.

Produtores mínimos: criação/atualização/movimento de card, alterações reais de
campos e responsável, criação/conclusão de tarefa, membros, vínculos, eventos
temporais e entrada de webhook. O payload deve conter somente o necessário para
matching e execução.

## Persistência proposta

A fundação deve ser exclusivamente aditiva e preservar as tabelas existentes:

- `BpmAutomacaoVersao`: snapshot de gatilho, condições, grafo e estado.
- `BpmEventoDominio`: outbox canônica, idempotência e rastreio causal.
- Evolução compatível de `BpmAutomacaoExecucao`: versão, evento, correlação,
  claim, tentativas, próxima tentativa e estado terminal.
- `BpmAutomacaoPassoExecucao`: auditoria por nó.
- `BpmAutomacaoAgenda`: espera e recorrência persistentes.
- `BpmWebhookEndpoint` e `BpmWebhookEntrada`: configuração, autenticação,
  deduplicação e auditoria da entrada.
- `BpmAutomacaoLease`: lease distribuído com fencing.

Os nomes e campos definitivos devem ser fechados pela fase de dados. Antes de
qualquer SQL remoto, a execução deve gerar backup exclusivo e verificado,
apresentar DDL, índices, FKs, riscos e rollback, e aguardar aprovação explícita.
Não são permitidos `DROP`, renomeação, transformação destrutiva ou backfill
mutante neste objetivo.

## Runtime e operação

- O cron existente materializa outbox, agendas, prazos e recorrências e processa
  lotes limitados.
- Um comando `npm run bpm:automacoes -- status|run|retry` oferece operação
  controlada, saída determinística e códigos de retorno úteis.
- O monitoramento administrativo possui filtros e paginação por automação,
  status, evento e período; detalhe de execução e passos; erros sanitizados;
  resultado; tentativa; duração; correlation ID; e retry autorizado.
- Atualizações de execução são observáveis sem reload completo, reutilizando o
  realtime do BPM com fallback de atualização periódica.
- A automação legada continua funcional durante a migração progressiva. Novos
  produtores usam um único ponto central e não duplicam a publicação antiga.

## Critérios de aceite

- [x] Story, contratos e decisões arquiteturais estão rastreáveis.
- [x] Migration aditiva foi aprovada, precedida por backup específico e
      validada no Turso com integridade e FKs íntegras.
- [x] Definições possuem rascunho, versão imutável e ativação transacional.
- [x] Grafo valida branches `SE/ENTÃO/SENÃO`, múltiplas ações e esperas.
- [x] Condições usam o Motor de Regras existente.
- [x] Eventos de domínio são persistidos atomicamente pelos produtores do BPM.
- [x] Execução é idempotente e segura sob concorrência entre workers.
- [x] Retry, backoff, dead-letter lógico e reprocessamento manual são auditáveis.
- [x] Gatilhos temporais e recorrentes são persistentes e processados pelo cron.
- [x] Webhook e HTTP aplicam autenticação, deduplicação, limites e proteção SSRF.
- [x] Catálogo executa as ações listadas nesta story sem scripts arbitrários.
- [x] CLI oferece `status`, `run` e `retry`.
- [x] Painel administrativo permite configurar e monitorar o motor central.
- [x] Histórico paginado mostra execução e passos sem dados sensíveis.
- [x] Evento de teste gera uma única execução e efeitos únicos.
- [x] Testes direcionados, lint focado, Prisma validate, typecheck, build e
      regressão proporcional foram executados e documentados.
- [x] Staging foi publicado por release isolada e validado sem derrubar a
      release anterior durante build/smoke.

## Plano de entrega

- [x] Fases 0–2 — auditoria, blueprint e especificação administrativa.
- [x] Fase 3 — fundação de dados e gate Vault.
- [x] Fases 4–5 — domínio, validação, runtime, branches e catálogo.
- [x] Fases 6–8 — produtores, temporalidade, webhooks e integrações.
- [x] Fases 9–10 — CLI, painel e observabilidade.
- [x] Fases 11–15 — gates, integração, dispensa explícita da auditoria formal,
      arquitetura e resiliência.
- [x] Fases 16–17 — memória técnica, fechamento e relatório.

## Rollback

Desativar os produtores e o worker centrais, manter o motor legado ativo e
preservar tabelas novas para auditoria. Como a migration é aditiva, a reversão
operacional não exige remover dados. Restauração do backup somente em caso de
corrupção confirmada e mediante nova autorização administrativa.

## Fora de escopo

- Executar JavaScript, SQL ou código arbitrário cadastrado por usuário.
- Expor tokens ou segredos no editor, logs ou payload de eventos.
- Remover imediatamente o motor legado antes da migração verificada.
- Promover automaticamente a produção; a conclusão publica somente staging.

## Checkpoint Vault — correção de idempotência e auditoria (2026-09-04)

- [x] Aprovação corretiva específica registrada: `1a67b35e2dd7a1d34fd21e7458f4e19bb701940a8d5b5d1a12532bc73b0783a2`.
- [x] Backup pós-fundação específico restaurado e validado: `painelalpha_turso_pre_change_2026-09-04T18-32-58-257Z.sql` (289 tabelas, 68.351 linhas, 96.191.678 bytes, SHA-256 `7b345cca9ac488f5217f792e3588c29ac1f9d9fea7f3c314c775f801dfa1336f`).
- [x] Snapshot confirmou zero pares duplicados `(automacaoVersaoId, eventoId)`.
- [x] Migration corretiva simulada com o aplicador do projeto em restauração descartável: integridade `ok`, zero violações de FK, FK `RESTRICT` e índice único efetivo.
- [x] Exclusão administrativa alterada para arquivamento lógico de toda automação.
- [x] Após o bloqueio por DNS, o operador reaplicou os mesmos 11 statements
      aprovados com `scripts/apply-turso-migration.mjs`; a aplicação concluiu.
- [x] Validação remota pós-aplicação confirmou a FK `RESTRICT`, o índice único
      `BpmAutomacaoExecucao_automacaoVersaoId_eventoId_key`, zero duplicidades,
      `PRAGMA integrity_check = ok` e zero violações em `foreign_key_check`.

### File List — delta corretivo local

- `prisma/schema.prisma`
- `prisma/migrations/20260904184000_bpm_automacoes_idempotencia_auditoria/migration.sql`
- `src/actions/bpm/Automacoes.ts`
- `tests/bpm/automacoes.test.ts`
- `docs/stories/story-rm-2026-d100eb-motor-central-automacoes.md`
- `.bibble/memory/architecture.md`
- `.bibble/memory/journal.md`

## Registro final de implementação (2026-09-04)

O motor central foi conectado ao CRM/BPM real. O domínio canônico, o runtime,
as agendas, webhooks e a política HTTP segura estão em
`src/lib/bpm/automacoes/`; os produtores transacionais foram integrados em
`Cards.ts`, `Tarefas.ts`, `Membros.ts` e `Vinculos.ts`. A rota de jobs existente
passou a materializar eventos, agendas e gatilhos temporais antes de executar
os lotes central e legado.

A administração permanece na rota
`/PainelAlpha/AlphaCRM/automacoes`, agora com versionamento, ativação, editor do
grafo, monitor paginado, detalhe dos passos, correlação e retry manual. A CLI
foi registrada como `npm run bpm:automacoes -- status|run|retry`. A entrada
externa usa `/api/bpm/webhooks/[slug]`, segredo com hash, chave de idempotência,
limite de corpo, rate limit e publicação atômica na outbox.

### Evidências finais

- `npx prisma validate`: aprovado.
- `npm run typecheck`: aprovado durante a implementação; a repetição final,
  após mudanças concorrentes no workspace, não apontou diagnóstico nos arquivos
  do objetivo, mas falhou por débitos externos e pelo `tsbuildinfo` somente
  leitura.
- `npm run lint`: aprovado.
- Testes focados finais do motor central e Vault: 20/20 aprovados.
- Regressão relevante ampliada: 47 aprovados; 1 falha concorrente fora deste
  objetivo (`sem-viabilidade-actions`, diferença `null`/`undefined`).
- Suíte global: 2.297/2.357 testes aprovados; 60 falhas preexistentes ou
  concorrentes em outros módulos, documentadas sem atribuí-las ao motor.
- `npm run build`: aprovado; 78 páginas estáticas geradas e as rotas do motor
  constam no manifesto.
- CLI real `status --limit=1`: aprovada contra o banco configurado.
- Stage: release isolada `20260904-194401`, build
  `eUmVTb9bfF5tLSBYr2h-q`; serviço ativo e domínio público respondendo HTTP 200.

### Segurança — disposição da fase 13

A auditoria formal Codex Security não foi executada por instrução explícita do
administrador (`pule essa parte`). A fase foi encerrada como **dispensada pelo
usuário**, e não como auditoria aprovada. Permaneceram validadas pelos gates
funcionais as proteções implementadas de autenticação/autorização, segredo com
hash, sanitização, idempotência, limites de entrada e defesa SSRF.

### File List — motor central

- `prisma/schema.prisma`
- `prisma/migrations/20260904183000_bpm_motor_central_automacoes/migration.sql`
- `prisma/migrations/20260904184000_bpm_automacoes_idempotencia_auditoria/migration.sql`
- `scripts/bpm-automacoes.ts`
- `src/actions/bpm/AutomacoesCentrais.ts`
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/Membros.ts`
- `src/actions/bpm/Tarefas.ts`
- `src/actions/bpm/Vinculos.ts`
- `src/app/PainelAlpha/AlphaCRM/automacoes/page.tsx`
- `src/app/api/bpm/jobs/automacoes/route.ts`
- `src/app/api/bpm/webhooks/[slug]/route.ts`
- `src/components/bpm/automacoes/MotorCentralPanel.tsx`
- `src/lib/bpm/automacoes/agenda.ts`
- `src/lib/bpm/automacoes/central-runtime.ts`
- `src/lib/bpm/automacoes/central-schemas.ts`
- `src/lib/bpm/automacoes/eventos.ts`
- `src/lib/bpm/automacoes/safe-http.ts`
- `src/lib/bpm/automacoes/executor.ts`
- `src/lib/bpm/automacoes/fila.ts`
- `tests/bpm/automacoes-central.test.ts`
- `tests/bpm/automacoes.test.ts`

## Extensão — fonte única de verdade e migração das automações existentes

O fechamento anterior entregou a infraestrutura central, mas manteve o editor e
o executor legados em paralelo e não migrou as rotinas automáticas já existentes
em código. Esta extensão corrige essa divergência: a definição persistida e sua
versão ativa passam a alimentar, ao mesmo tempo, execução, edição, página geral e
representação por etapa.

### Critérios adicionais

- [ ] Inventariar banco, motores, frontend, backend, crons, filas, webhooks,
      cadências, SLA, integrações e mutações automáticas do CRM/BPM.
- [ ] Documentar gatilho, condição, ação, recorrência, escopo e idempotência de
      cada comportamento encontrado.
- [ ] Toda definição criada/editada pelo painel gera uma versão central válida;
      o executor legado não pode disputar a mesma definição.
- [ ] Migrar definições legadas e rotinas hardcoded antes de desligar seus
      entrypoints antigos, preservando comportamento e histórico.
- [ ] A página de Automações usar a mesma fonte persistida do runtime, sem uma
      lista manual ou um segundo editor para legados.
- [ ] Suportar automações globais no pipeline e vínculo com uma ou várias etapas
      sem duplicar a definição no banco.
- [ ] Exibir nome, descrição, pipeline, etapas, status, gatilho, condições,
      ações, recorrência, próxima/última execução, resultado e origem.
- [ ] Mostrar resumos das automações em cada coluna do Kanban, derivados da
      mesma versão ativa usada pelo worker.
- [ ] Cadências, SLA, alertas e integrações automáticas ficarem visíveis e
      rastreáveis no catálogo central.
- [ ] Cobrir migração, equivalência, ausência de duplicidade, edição e projeção
      por etapa com testes e E2E isolado.

### Auditoria desta extensão

- Documento autoritativo: `docs/audits/automacoes-crm-bpm-2026-09-04.md`.
- Banco consultado em modo somente leitura: zero `BpmAutomacao`, zero
  `BpmAutomacaoVersao`, zero `BpmCadencia`, zero `BpmSlaConfig`; um webhook
  global de teste sem entradas.
- Nenhum `CREATE TRIGGER` foi encontrado nas migrations ou no schema Prisma.
