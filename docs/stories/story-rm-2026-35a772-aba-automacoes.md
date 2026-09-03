# Story RM-2026-35A772 — Aba Automações do Alpha CRM/BPM

**Objetivo do Roadmap:** Aba Automações
**Escopo:** configuração global de automações vinculadas às colunas dos pipelines do Alpha CRM/BPM
**Projeto:** Painel Alpha
**Status:** Em testes
**Data:** 2026-09-02

## Contexto

Administradores precisam enxergar todos os pipelines do CRM em uma única aba e configurar automações reutilizáveis por coluna. Cada automação possui um gatilho (`entrar`, `sair` ou `tempo na coluna`), uma ação (`enviar e-mail`, `gerar contrato` ou `gerar ficha`) e pode ser ativada, desativada, editada, duplicada para outra coluna ou excluída.

## Auditoria de entregabilidade

- O domínio real é `BpmPipeline -> BpmEtapa -> BpmCard` e não há hoje persistência configurável de automações.
- O menu lateral de `CRMLayoutClient.tsx` já é a navegação global do AlphaCRM. Como o requisito manda listar **todos** os pipelines, a entrega será uma aba administrativa em `/PainelAlpha/AlphaCRM/automacoes`, não uma aba dentro de um card ou de um único pipeline.
- O projeto já possui cron autenticado por `CRON_SECRET` e tarefas Vercel a cada cinco minutos; o mesmo padrão comporta `TEMPO_NA_COLUNA` e o processamento assíncrono das ações.
- O movimento de card já grava `BpmCardHistorico` com origem, destino e data. Esse histórico fornece a identidade do evento e o início do ciclo atual na coluna.
- Resend já está instalado e em uso. A implementação criará um serviço de e-mail específico do BPM, com remetente configurável e falha registrada quando a credencial estiver indisponível.
- O Gerador de Documentos já tem templates, renderização de variáveis, documento em conferência e PDF. A automação utilizará um serviço interno, sem depender de sessão dentro do worker.
- `gerarFichaServer` já gera a ficha de reunião em PDF a partir do CNPJ. O resultado será registrado no histórico/resultado da execução para consumo pelo card.
- Configuração de pipeline é hoje exclusiva de Admin/CEO/TI por `exigirAcessoConfigPipeline`; a nova aba e todo o CRUD seguirão essa mesma fonte de verdade.
- Os componentes shadcn necessários (`Dialog`, `AlertDialog`, `Select`, `Switch`, `Badge`, `Button`, `Input`, `Textarea`) já existem.

**DELIVERY_READY:** a aplicação já oferece navegação global, domínio BPM, cron, e-mail, gerador de contratos, ficha PDF, autorização administrativa e componentes de UI necessários. O suporte configurável e sua fila persistente serão adicionados neste objetivo.

## Regras funcionais

1. A aba **Automações** aparece no menu do AlphaCRM somente para perfis administrativos.
2. A tela lista todos os pipelines, inclusive inativos, e as respectivas colunas na ordem configurada.
3. Cada automação pertence a um pipeline e a uma coluna desse mesmo pipeline.
4. Gatilhos suportados: `ENTRAR_COLUNA`, `SAIR_COLUNA` e `TEMPO_NA_COLUNA`.
5. `TEMPO_NA_COLUNA` exige um número inteiro de minutos e é verificado pelo cron a cada cinco minutos.
6. Ações suportadas: `ENVIAR_EMAIL`, `GERAR_CONTRATO` e `GERAR_FICHA`.
7. A automação pode ser duplicada para outra coluna; a cópia recebe identidade e histórico próprios.
8. O movimento do card apenas enfileira execuções. I/O externo roda no job e uma falha nunca reverte o movimento.
9. Cada automação executa no máximo uma vez por evento de entrada/saída ou por permanência contínua na coluna.
10. Toda execução é auditável como `PENDENTE`, `EM_EXECUCAO`, `SUCESSO` ou `FALHA`.

## Blueprint técnico

### Persistência aditiva

`BpmAutomacao`:

- IDs CUID e FKs para `BpmPipeline`, `BpmEtapa` e `usuarios` (`criadoPorId Int`).
- Tipos de gatilho e ação como `String`, coerente com SQLite/Turso e validados por Zod.
- Parâmetros como JSON serializado em `parametrosJson String`, sem introduzir enum/tipo nativo incompatível.
- Índices em `(pipelineId, etapaId, ativa)` e `(etapaId, gatilhoTipo, ativa)`.

`BpmAutomacaoExecucao`:

- FKs para automação e card, estado da fila, tentativas, erro e resultado serializados.
- `eventoChave` identifica o histórico do movimento ou o ciclo contínuo da coluna.
- Restrição única `(automacaoId, eventoChave)` para idempotência.
- Índices de worker em `(status, createdAt)`, além de `cardId` e `automacaoId`.

Não haverá `DROP`, renomeação, remoção de coluna nem transformação de dados existentes.

### Backend

- `src/lib/bpm/automacoes/schemas.ts`: contratos Zod e validação discriminada dos parâmetros.
- `src/actions/bpm/Automacoes.ts`: listar, criar, atualizar, duplicar, alternar, excluir e listar templates disponíveis; todas as mutações exigem sessão e `exigirAcessoConfigPipeline`.
- `src/lib/bpm/automacoes/fila.ts`: enfileiramento idempotente para entrada/saída, materialização de gatilhos por tempo e claim seguro de execuções pendentes.
- `src/lib/bpm/automacoes/executor.ts`: dispatch de e-mail, contrato e ficha, com atualização final do log.
- `src/actions/bpm/Cards.ts`: após persistir o movimento e seu histórico, enfileira gatilhos de saída e entrada dentro do fluxo transacional, sem executar integração externa.
- `src/app/api/bpm/jobs/automacoes/route.ts`: endpoint protegido por `CRON_SECRET`; materializa gatilhos temporais e processa a fila.
- `vercel.json`: agenda o job a cada cinco minutos.

### Parâmetros por ação

- `ENVIAR_EMAIL`: destinatários, assunto e corpo; suporta placeholders documentados do card/empresa/responsável.
- `GERAR_CONTRATO`: template, título e valores das variáveis do template; o cliente é derivado do card e o documento é criado em conferência.
- `GERAR_FICHA`: não exige parâmetros adicionais; utiliza o CNPJ da empresa do card.

### UI

- Rota server-side `/PainelAlpha/AlphaCRM/automacoes`, protegida para administradores.
- Workspace client-side agrupado por pipeline e por coluna.
- Modal único reutilizado em criação/edição, parâmetros dinâmicos, toggle de status, exclusão confirmada e duplicação para outra coluna.
- Estados de loading, erro, vazio e feedback com `sonner`; controles possuem nomes acessíveis.

## Critérios de aceite

- [x] Aba global **Automações** visível para Admin/CEO/TI e bloqueada no servidor para demais perfis.
- [x] Todos os pipelines e suas colunas aparecem na tela.
- [x] Criar, editar, ativar/desativar e excluir uma automação funciona e persiste.
- [x] Automação existente pode ser duplicada para outra coluna, inclusive de outro pipeline.
- [x] Formulário valida gatilho, tempo e parâmetros específicos da ação no cliente e no servidor.
- [x] Entrada e saída de coluna enfileiram as automações correspondentes sem bloquear o movimento.
- [x] Cron materializa `TEMPO_NA_COLUNA` com precisão de até cinco minutos.
- [x] Idempotência impede execução repetida do mesmo evento/ciclo.
- [x] E-mail, contrato e ficha são executados pelo worker e registrados com resultado ou erro claro.
- [x] Falha de integração não reverte nem impede o movimento do card.
- [x] Testes direcionados, regressão BPM, lint, typecheck e build foram executados e documentados.

## Plano e progresso

- [x] Fase 0 — auditoria de entregabilidade.
- [x] Fase 1 — blueprint técnico e story.
- [x] Fase 2 — confirmação específica, migration aditiva no Turso e verificação.
- [x] Fase 3 — implementação full-stack e worker.
- [x] Fase 4 — gates técnicos.
- [x] Fase 5 — verificação de integração.
- [x] Fase 6 — documentação e fechamento para **Em testes**.

## Plano de migration e rollback

- Ambiente afetado: banco Turso do Painel Alpha configurado em `.env.local`.
- Operação: criar somente `BpmAutomacao`, `BpmAutomacaoExecucao`, suas FKs e índices.
- Dados existentes: nenhuma linha será atualizada ou removida.
- Rollback, somente se necessário: pausar o job, remover primeiro `BpmAutomacaoExecucao` e depois `BpmAutomacao`; como as tabelas serão novas, o rollback não toca entidades legadas.
- Backup pré-mudança verificado: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-02T18-39-17-794Z.sql`, SHA-256 `da1f379618b68684d67daf56506c3a55154ca1998bd4b38a8ef76587512fd623`, 262 tabelas e 47.687 linhas.

## File list entregue

- `prisma/schema.prisma`
- `prisma/migrations/20260902185000_add_bpm_automacoes/migration.sql`
- `src/lib/bpm/automacoes/` (novo)
- `src/actions/bpm/Automacoes.ts` (novo)
- `src/actions/bpm/Cards.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`
- `src/app/api/bpm/jobs/automacoes/route.ts` (novo)
- `src/app/PainelAlpha/AlphaCRM/automacoes/` (novo)
- `src/app/PainelAlpha/AlphaCRM/CRMLayoutClient.tsx`
- `src/components/bpm/automacoes/` (novo)
- `tests/bpm/automacoes.test.ts`, `automacoes-actions.test.ts` e `automacoes-executor.test.ts` (novos)
- `vercel.json`
- `scripts/deploy-staging-release.sh`
- `ops/systemd/painel-alpha-stage.service`
- `.bibble/memory/architecture.md`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/components.md`
- `.bibble/memory/decisions.md`
- `.bibble/memory/journal.md`

## Evidências de verificação

- Backup pré-mudança verificado: 82.158.231 bytes, 262 tabelas, 47.687 linhas e SHA-256 `da1f379618b68684d67daf56506c3a55154ca1998bd4b38a8ef76587512fd623`.
- Turso pós-migration: tabelas `BpmAutomacao` e `BpmAutomacaoExecucao` presentes; 3 e 2 FKs respectivamente; zero violações de FK; `PRAGMA integrity_check = ok`.
- `prisma validate`: aprovado; Prisma Client regenerado.
- ESLint direcionado: aprovado sem erros ou warnings.
- Testes direcionados: 14/14 aprovados em 3 arquivos; testes de movimento relacionados: 47/47 aprovados em 4 arquivos.
- Regressão `tests/bpm`: 388/404 aprovados. As 16 falhas restantes estão em 7 suítes legadas fora deste objetivo (principalmente expectativas de componentes do card modal já alterados por outras entregas e uma expectativa antiga de `servico`).
- Typecheck global: nenhum erro nos arquivos deste objetivo; permanece bloqueado por 81 linhas de erros pré-existentes em outros módulos.
- Build inicial: compilação otimizada aprovada, mas a coleta de páginas revelou `CardFilhoCriado is not defined` em `/PainelAlpha/Parceiros/[id]`.
- Smoke HTTP sem sessão: a rota `/PainelAlpha/AlphaCRM/automacoes` respondeu com redirecionamento 307 para o bloqueio de acesso, confirmando o guard server-side. O endpoint de cron respondeu 503 quando `CRON_SECRET` não estava disponível no processo de desenvolvimento, sem executar a fila.

## Correção pós-verificação e deploy automático de staging

- [x] Removido o reexport de `CardFilhoCriado` do módulo `"use server"`; consumidores importam o tipo diretamente do domínio e o Turbopack não cria mais uma referência de runtime.
- [x] Build completo aprovado após a correção.
- [x] Adicionado `scripts/deploy-staging-release.sh`: build, snapshot isolado, smoke test em porta temporária, troca atômica da release, restart, health check e rollback automático.
- [x] Serviço versionado em `ops/systemd/painel-alpha-stage.service`, apontando para o symlink estável `painel-alpha-stage/current`.
- [x] `stagingDeployCommand` do Roadmap atualizado para executar o novo deploy a cada conclusão/reconclusão que entrar em **Em testes**.

**Deploy verificado:** release `/home/ialpha/deployments/painel-alpha-stage/releases/20260902-193109`, build ID `3MFv6xhuquokyblu65wJ_`, serviço ativo e processo executando a partir da release nova; `/` respondeu HTTP 200 e a rota protegida de Automações respondeu 307 sem sessão.

**Gates globais reapurados:** `npm run build` aprovado. Os gates históricos do repositório continuam com débitos externos ao objetivo: lint com 2.498 erros/1.273 warnings, typecheck com 88 linhas de diagnóstico sem ocorrências nos arquivos desta entrega e testes com 2.002/2.040 aprovados. As suítes direcionadas da correção ficaram em 51/51.

## Fora de escopo

- Motor arbitrário de scripts/webhooks definidos pelo usuário.
- Promover automaticamente o objetivo para Produção.
- Alterar automações legadas codificadas do CRM; elas continuam funcionando em paralelo.
