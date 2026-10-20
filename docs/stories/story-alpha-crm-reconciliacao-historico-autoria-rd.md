# Story: Reconciliação de histórico e autoria entre Alpha CRM e RD Station

## Status

Done — aplicação autorizada e concluída, reconciliação posterior sem diferenças e correção publicada em produção. QA APPROVED. Plano `4be6d3428252a7c6aca9d9463ea7a520d1fa6643d355ba39a61b1e566c89bece`; commit funcional `4ce99fe67f1041d69f1b535613208bd32d368645`.

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@architect"
quality_gate_tools:
  - "revisão de identidade, proveniência e preservação das correções locais"
  - "simulação de aplicação, idempotência e rollback em cópia restaurada"
```

## História

**Como** responsável pela operação do Alpha CRM,
**quero** comparar todos os cards do painel com os dados disponíveis nas APIs V1 e V2 do RD Station e atualizar exclusivamente seu histórico e autoria,
**para que** a equipe consulte os registros recuperáveis com seus autores reais e tenha clareza sobre as informações que a origem não permite recuperar.

## Contexto e limites

O usuário relatou a permanência de `Sistema / autor não disponível · 13/10/2026, 19:41` e confirmou expressamente o recorte **“Histórico e autoria”**. Essa referência é um caso de investigação; a data exibida, sem identificação do evento e fuso confirmado, não basta para associar registros.

A story anterior de migração registrou importação de histórico, recuperação de tarefas/anotações e vínculos comerciais. Esta é uma reconciliação atual, com inventário novo, sem reutilizar contagens antigas como prova de completude. A alteração recente de apresentação recupera nomes contidos no payload já importado; isso não comprova consulta atual ao RD nem recuperação de autores ausentes desse payload.

Diagnóstico somente de leitura recebido do agente principal nesta preparação: inventário de 1.234 cards, 1.221 origens RD, 12.361 eventos e 7.994 correções. O horário relatado corresponde a 1.843 correções automáticas de título/etapa em `BpmEventoExternoCorrecao`, com `autorId` nulo às 22:41 UTC, exibidas às 19:41. Essas correções são distintas dos eventos originais RD: seu autor não pode ser preenchido com o autor da atividade de origem. Os números são fotografia inicial a reconciliar no relatório de coleta, não resultado de aplicação desta story.

Inclui inventário de todos os cards Alpha, ativos e arquivados, de todos os pipelines, e comparação dos que possuam vínculo RD inequívoco. Cards sem vínculo explícito ou com identidade ambígua são contabilizados como exceção; não criar vínculos por nome, CNPJ ou responsável. Negócios RD sem card correspondente são reportados, sem criar cards. Tarefas podem compor o histórico, mas suas atribuições, estado operacional e lembretes não são alterados nesta story.

Não alterar campos comerciais, empresas, contatos, etapas atuais, pipelines, membros, responsáveis, permissões, formulários ou automações. Não escrever no RD. Não inferir autoria a partir do responsável atual pelo negócio, executor da importação, autor de uma correção local ou proximidade temporal.

## Critérios de aceite

1. Produzir inventário completo e paginado dos cards Alpha, incluindo arquivados e vínculos externos existentes, com denominadores verificáveis: total, vinculados sem ambiguidade, sem vínculo, múltiplos vínculos e erros. Consultar as APIs RD V1 e V2 disponíveis em leitura, verificando contratos, permissões, paginação, limites e cobertura efetiva dos tipos históricos. Não tratar falha de coleta ou endpoint indisponível como ausência de histórico.
2. Comparar por identidade estável do negócio e do evento de origem. Documentar como IDs V1/V2 correspondem entre si antes de combinar resultados; não presumir que IDs iguais ou diferentes representam a mesma entidade. Sem correspondência verificável, registrar exceção e preservar os dados Alpha.
3. Classificar por card e tipo os eventos já equivalentes, faltantes, duplicados, divergentes, com autoria recuperável, com autoria desconhecida e inacessíveis. Investigar o exemplo de 13/10/2026 às 19:41 com evidência de identidade e fuso, sem associar por horário isolado. Distinguir evento automático confirmado de evento cujo autor simplesmente não foi fornecido. Nas correções locais, exibir “Ajuste automático de importação” somente quando a proveniência comprovar essa origem; manter a pessoa responsável quando `autorId` estiver presente. Nunca atribuir à correção local o autor do evento RD original nem classificar toda correção sem autor como automática.
4. Recuperar autoria somente por dados explícitos do evento ou por ID de autor resolvido em fonte verificável do RD. Registrar fonte, versão da API, ID do evento, ID do autor quando disponível, evidência e data da consulta. Nome da origem pode ser exibido sem criar usuário Alpha. Autor ausente, removido, inacessível ou ambíguo permanece explicitamente desconhecido; o relatório informa a limitação.
5. Preparar prévia por card e evento contendo antes/depois, operação proposta, proveniência, identificação do banco, fingerprint do plano, estado esperado atual e exceções. Dados reais e snapshots ficam privados e ignorados pelo Git; documentação versionada contém agregados e motivos, sem tokens ou payloads pessoais.
6. Atualizar apenas representações históricas/autoria e acrescentar eventos comprovadamente ausentes. Preservar o payload original já importado e todas as correções humanas locais, incluindo conteúdo, título, datas e autoria corrigida. Dados novos de origem devem ter proveniência própria, sem apagar a evidência anterior. Divergência com edição local vira conflito explícito, sem sobrescrita silenciosa.
7. Deduplicar por identidade estável e proveniência, inclusive quando o mesmo evento aparece em V1 e V2 ou em coletores distintos. Eventos sem ID exigem estratégia determinística verificável que preserve ocorrências legitimamente repetidas; conteúdo ou posição na página isolados não autorizam fusão. Não excluir duplicatas existentes automaticamente: reportar e incluir eventual tratamento somente em plano explícito.
8. Aplicação e retomada são idempotentes, com recibo e trilha de auditoria do lote. Revalidar estados antes da escrita para preservar alterações concorrentes. Falhas parciais não podem produzir sucesso global nem exigir repetição cega de operações já aplicadas. Nenhuma atualização pode disparar ações comerciais, notificações, movimentações ou escrita no RD.
9. Antes do lote, simular aplicação, segunda aplicação sem novas mutações e rollback em cópia restaurada, reconciliando contagens e integridade. Rollback compensatório restaura somente alterações do lote, preserva auditoria e bloqueia reversão sobre edições posteriores. Restauração integral do banco não é o rollback padrão.
10. Executar qualquer backfill somente após relatório Vault, apresentação do ambiente/banco, comandos, impacto, riscos, alternativa somente de leitura e rollback, backup completo verificado de até 48 horas e confirmação específica do plano. A autorização da entrega anterior de cards/fluxo não cobre esta nova carga. O pedido atual autoriza preparar e diagnosticar, não dispensa esse gate de `AGENTS.md`.
11. Após eventual aplicação autorizada, reconciliar todos os cards inventariados e as operações executadas, repetir a prévia para demonstrar idempotência e listar exceções remanescentes. Verificar a apresentação do caso reportado e amostras de tipos distintos sem afirmar teste visual autenticado que não ocorreu. Se o RD não fornecer o autor, explicar precisamente essa limitação em vez de inventar um nome.
12. Executar testes pertinentes e os gates do projeto (`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`), registrar resultados e atualizar checklist, file list, situação de aplicação, commit e publicação. Não confundir correção de apresentação publicada com backfill de dados aplicado.

## Tasks / Subtasks

- [x] Registrar pedido, recorte confirmado e salvaguardas nesta story.
- [x] Inventariar todos os cards/vínculos e consultar contratos e cobertura das APIs V1/V2 em leitura. (AC: 1–3)
- [x] Identificar o caso relatado e separar lacunas de origem, coleta, transformação e apresentação. (AC: 3–4)
- [x] Definir a correspondência estável entre versões e resolução verificável de autores. (AC: 2, 4, 7)
- [x] Preparar CLI de prévia e plano fechado com antes/depois, conflitos e fingerprint. (AC: 5–7)
- [x] Implementar recuperação preservando originais, correções locais e escopo exclusivamente histórico. (AC: 6–8)
- [x] Testar paginação, conflitos, retomada, ausência de autor, deduplicação V1/V2 e proteção de dados. (AC: 1–8, 12)
- [x] Simular lote, reexecução e rollback guardado em cópia restaurada. (AC: 9)
- [x] Obter revisão Vault, evidência de backup e confirmação específica do plano final. (AC: 10)
- [x] Aplicar somente lote confirmado e reconciliar resultados e exceções. (AC: 8, 11)
- [x] Verificar apresentação, concluir gates e registrar aplicação/publicação separadamente. (AC: 11–12)

## Dev Notes e referências

- [Story de migração](story-alpha-crm-migracao-historico-rd-station-v1.md#diagnóstico-e-implementação-complementar--14102026): recuperação anterior usou eventos/atividades e tarefas com proveniência, preservou notas originais e correções humanas, e simulou idempotência/rollback. Sua autorização foi específica àquela carga. Não modificar nem reabrir essa story para substituir a atual.
- [Story de alinhamento](story-alpha-crm-alinhamento-cards-fluxo-contrato.md): contexto da melhoria recente de apresentação da autoria; esta reconciliação acrescenta diagnóstico e recuperação atuais.
- `prisma/schema.prisma`: modelos existentes `BpmCardOrigemExterna`, `BpmEventoExternoCard`, `BpmEventoExternoCorrecao`, `BpmImportacaoExterna` e `BpmCardHistorico`; inspecionar relações e regras antes de definir operações. Não pressupor necessidade de alteração estrutural.
- `src/lib/bpm/rd-station-history.ts`: `comAutoriaOriginalRd` preserva `projection.authorName` existente e busca nomes em `raw.author_name`, `raw.author.name` e `raw.user.name`; não resolve IDs. O projetor registra `sourceKey`, `sourceEventId`, `raw`, `projection` e datas. Rever compatibilidade das chaves históricas ao reconciliar, evitando duplicações.
- `src/actions/bpm/RdStationHistorico.ts` e `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistoricoRd.tsx`: leitura, correções e apresentação do histórico. Preservar autorização e não expor payload privado ao navegador.
- `scripts/migrar-rd-alpha.mjs`, `scripts/coletar-complemento-rd-alpha.mjs`, `scripts/complementar-rd-alpha.mjs`, `scripts/lib/rd-complement-recovery.mjs`: padrões existentes de coleta, aplicação, proveniência e recuperação. A coleta V1 existente usa `RD_STATION_CRM_V1_TOKEN`; banco usa `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`. Descobrir configuração V2 sem registrar segredos; não inventar nome de variável nem assumir equivalência de contratos.
- `AGENTS.md` e `.aiox-core/constitution.md`: gates, CLI first, segurança de banco e autoridades exclusivas.

### Decisões de preparação

- [AUTO-DECISION] Criar nova story ou ampliar migração anterior? → Nova story no caminho solicitado, preservando a migração anterior e seu histórico de aprovações.
- [AUTO-DECISION] O que significa “todos os cards”? → Inventariar todo o Alpha, incluindo arquivados, e reconciliar vínculos RD explícitos; exceções entram no denominador e no relatório.
- [AUTO-DECISION] Atualizar outros dados? → Não; o usuário confirmou exclusivamente “Histórico e autoria”.
- [AUTO-DECISION] Criar item externo/novo épico? → Não; missão restrita a este documento local, derivada diretamente do pedido do usuário.
- `.Codex/commands/AIOX/agents/sm.md` não existe neste checkout; usada definição disponível `.aiox-core/development/agents/sm.md`. `.aiox/gotchas.json` e `accumulated-context.md` não foram encontrados na pesquisa local; coerência sustentada pelas stories relacionadas, sem inventar conteúdo desses arquivos.
- Documentação genérica `docs/architecture/index.md` e guias `docs/framework/` não foram encontrados; não há orientação arquitetural específica desses arquivos a reproduzir. Pontos técnicos acima vêm de artefatos existentes explicitamente indicados. Contratos atuais V2 e cobertura real são verificações obrigatórias da primeira tarefa.

## Testing

Testes unitários e integração em `tests/bpm/`, seguindo os testes RD existentes. Fixtures sintéticas, sem dados pessoais reais.

Cobrir autores explícitos, IDs resolvidos, autores removidos/ausentes, owner diferente do autor, correção local de autoria preservada, duplicação entre APIs, eventos idênticos legitimamente repetidos, paginação incompleta/429/403/5xx, cards arquivados, ligação ambígua, datas e fusos, retomada após falha, conflito concorrente, idempotência e rollback recusado após edição. A simulação deve comprovar zero mutações em campos operacionais, zero disparos de automação e zero requisições de escrita ao RD.

## CodeRabbit Integration

- **Story Type Analysis:** Integration; secundários Database/API; complexidade alta pela reconciliação global e backfill protegido.
- **Specialized Agent Assignment:** @dev implementa; @architect revisa identidade/proveniência; @db-sage e Vault revisam banco; @qa emite verdict; @github-devops atua apenas se houver publicação.
- **Quality Gate Tasks:** pre-commit com @dev; pre-PR e pre-deployment com @github-devops quando aplicáveis. Registrar revisão manual alternativa se CodeRabbit indisponível, conforme configuração do projeto.
- **Self-Healing Configuration:** @dev light, até 2 iterações/15 minutos para CRITICAL; HIGH documentado. Revisão @qa full, até 3 iterações/30 minutos para CRITICAL/HIGH; MEDIUM como dívida, LOW conforme configuração.
- **Focus Areas:** identidade entre versões, paginação integral, preservação de originais/correções, deduplicação, escopo de escrita, proteção de segredos, guards concorrentes e rollback.

## Validação da story-draft-checklist

| Categoria | Resultado | Evidência |
|---|---|---|
| Objetivo e contexto | PASS | Pedido e recorte literal registrados; sintomas separados de causas. |
| Orientação técnica | PASS | Modelos, coletores e apresentação existentes referenciados; V2 a verificar sem contrato inventado. |
| Referências | PASS | Story anterior contextualizada e artefatos locais existentes indicados. |
| Autossuficiência | PASS | Escopo, exclusões, conflitos e decisões explícitos. |
| Testes | PASS | Casos, simulação e gates definidos por resultado observável. |
| CodeRabbit | PASS | Agentes, checkpoints, configuração e foco descritos. |

**Resultado:** READY para diagnóstico e implementação; clareza 9/10. Aplicação do lote permanece condicionada ao AC 10. Esta validação é do rascunho da story, não um verdict de qualidade da implementação.

## Dev Agent Record

Implementação e diagnóstico concluídos em 20/10/2026. [Relatório completo](relatorio-alpha-crm-historico-autoria-rd.md).

- Inventário remoto: 1.234 cards, 1.221 vínculos RD, 12.361 eventos prévios; coleta completa de 1.572 negócios V1 e 1.221 detalhes. 13 cards sem vínculo e 351 negócios sem card permanecem preservados.
- Comparação: 3.682 anotações, 7.177 movimentos, 1.624 tarefas históricas; 12.036 registros equivalentes. V2 confirmou IDs/autoria/datas de 266 notas em 54 negócios cobrindo todas as notas alteradas/acrescentadas; usuários V1/V2 identificados por ID.
- Lote: 122 inserções e 325 atualizações em 237 cards. Fingerprint `4be6d3428252a7c6aca9d9463ea7a520d1fa6643d355ba39a61b1e566c89bece`.
- Simulação final: 447 aplicadas, reexecução sem novas mutações, 447 revertidas, 1.341 guardas, integridade OK e zero violações de FK. Rollback parcial e concorrência cobertos por testes.
- Backup completo verificado por Vault em 20/10 às 17:30 UTC. Relatório Vault identifica comandos, banco, riscos e retorno; consentimento específico recebido com “Sim vida autorizo” e liberação revalidada às 18:01 UTC.
- Correção de apresentação distingue ajustes automáticos comprovados e autores reais; remoção manual de autor é preservada. Nenhum autor é deduzido do responsável pelo negócio.
- Testes focados finais: 24 aprovados. Suite geral, lint e typecheck aprovados; build equivalente isolado aprovado com heap 4.096 MB após limite de 3.072 MB no comando padrão.
- Aplicação em produção concluída às 18:02:56 UTC: 447 operações, zero ignoradas, 1.341 guardas coincidentes. Verificação independente às 18:03:38 UTC também passou. Nenhuma escrita no RD e nenhum rollback.
- Reconciliação integral às 18:04:52 UTC: 12.483 eventos equivalentes, zero diferenças contra a coleta aprovada; 12.361 payloads e 7.994 correções anteriores preservados; 447 recibos auditáveis.
- Helpers reais sobre snapshot pós-carga: 3.682/3.682 anotações com autor exibível; 8.319 correções com identificação automática comprovada, zero rótulo legado ambíguo. Inspeção visual autenticada não realizada, explicitamente diferenciada de testes de apresentação e disponibilidade.
- Publicação: [painel.alpha-comex.com](https://painel.alpha-comex.com), deployment `dpl_6w5Pbv2Jw3VM72gmtB7LkpAuq6hz` READY, alias conferido, SHA `4ce99fe67f1041d69f1b535613208bd32d368645`. Smoke pós-promoção: raiz 200 / CRM 307 para `/?acesso=bloqueado` / API sem credenciais 401. Audiência e env preservados.
- Código commitado e branch publicada; [PR #3](https://github.com/Vin1-SF19/PROJETOALPHACOMEX/pull/3) draft sem merge. Main e staging não foram alteradas.
- Gates do pacote exato: 655 arquivos/4.943 testes aprovados, 4 skip/1 todo; lint 0 erros/1.193 avisos, typecheck PASS, build local ajustado e build remoto READY. Suíte do workspace: 657 arquivos/4.975 testes. Auditoria de dependências baseline registrada por QA/DevOps, sem novos pacotes ou relaxamento de acesso no delta.
- O commit `aa5a50761944ecf049a61b254980675926288af3` registra a entrega anterior de cards/fluxo; não representa aplicação deste lote.

### File List

- `docs/stories/story-alpha-crm-reconciliacao-historico-autoria-rd.md`
- `docs/stories/relatorio-alpha-crm-historico-autoria-rd.md`
- `docs/stories/relatorio-vault-rd-historico-autoria.md`
- `scripts/coletar-historico-autoria-rd.mjs`
- `scripts/lib/rd-history-reconciliation.mjs`
- `scripts/reconciliar-historico-autoria-rd.mjs`
- `src/actions/bpm/RdStationHistorico.ts`
- `src/lib/bpm/rd-station-display.ts`
- `tests/bpm/rd-history-reconciliation.test.ts`
- `tests/bpm/rd-station-actions.test.ts`

Snapshots, plano e simulação com dados reais permanecem em `database-backups/pre-change/rd-historico-autoria-2026-10-20/`, ignorados pelo Git.

## Integração restrita em staging — 2026-10-20

O usuário solicitou explicitamente que esta entrega também fosse commitada em `staging`, onde realiza os testes. Foi criado checkout isolado sobre `origin/staging` em `bcc3373c9afda0d455961efcf2e313c5e2dd0784`, sem mover a branch local usada pelo workspace de trabalho.

Foram transportados somente os commits desta entrega: `aa5a5076` → `28cdade7` (cards/fluxo), `4ce99fe6` → `35b50984` (histórico/autoria) e `ef9b739c` → `f387409b` (documentação). O único conflito foi a condição de reconhecimento de Fechado em `transicao-command.ts`: aplicado o alias `etapaEhFechado`, mantendo a política preexistente de staging sem incorporar a funcionalidade `manualRd` que pertence a outra entrega. Origem/parceiro/liderança/ownership de staging foram preservados. Nenhum módulo de chamados/metas, dependência ou lockfile foi incorporado; todos os imports do delta foram resolvidos sem dependência adicional.

Durante a revalidação anterior ao push, staging avançou para `e0a2576cc0f619ffcd1b2e5d1c194a99973ea0ce` com movimentação livre para administradores e líderes. Esse avanço foi integrado no merge `8b194a43`, sem conflito de código. O único conflito documental preservou integralmente a story implementada de administradores/líderes. A comparação final contra `e0a2576c` contém somente 47 arquivos desta entrega CRM; todos os retornos antecipados, guardas e auditoria do movimento livre permanecem intactos.

Validação final do conjunto integrado sobre `e0a2576c`:

- Lint passou: zero erros e 1.193 avisos existentes.
- Typecheck final passou com heap de 6.144 MiB e afinidade de uma CPU, sem alteração do package. Uma tentativa anterior recebeu SIGTERM sem erro TypeScript; a repetição isolada concluiu. O bundle player foi gerado pelo script oficial.
- Suíte completa executada: **644 arquivos, 640 aprovados e 4 com falhas; 4.801 testes aprovados, 6 falhas, 4 ignorados e 1 todo**. Não é uma suíte global aprovada.
- As mesmas seis falhas nos mesmos quatro arquivos foram reproduzidas no baseline final `e0a2576c` (e também no inicial `bcc3373c`), com package/lock/configuração e dependências iguais: Builder (3), layout do modal (1), expectativas antigas de Próximo Contato (2), além da falha de importação da suíte de arquivamento. Nenhuma falha nova foi atribuída ao delta.
- Build final equivalente aprovado: Prisma/player oficiais e `next build --webpack` com heap de 4.096 MiB, uma CPU e supervisor de 7 GiB; exit 0, 64,71 segundos, pico de 6.065.655.808 bytes, 80 páginas e tracing concluídos. Package intacto; removidas somente inclusões automáticas do diretório temporário no tsconfig.
- Revisão QA do delta: sem achados; **gate global NEEDS_WORK por falhas preexistentes**, preservado.

**Decisão contextual do orquestrador:** publicar somente em staging após build integrado aprovado, conforme pedido explícito do usuário, com a dívida baseline reproduzida e nenhuma regressão identificada no delta. A exceção não transforma o gate global em aprovado, não autoriza mudanças em produção/main e não amplia o escopo para correções alheias. A aplicação de 447 operações no banco não será repetida.

Evidências externas ao Git: `../painel-alpha-worktrees/crm-staging-e0-gates.json`, `crm-staging-e0-tests.log`, `crm-staging-e0-baseline.log`, `crm-staging-e0-typecheck-final.log`, `crm-staging-e0-lint.log` e `crm-staging-e0-build-4096-result.json`. Destino de testes já conectado ao Git/Vercel: [staging.alpha-comex.com](https://staging.alpha-comex.com). O push deve ser fast-forward, sem force push, com verificação posterior do SHA remoto e do deployment de staging.

## QA Results

### Revisão de preparação — 2026-10-20 — Quinn (@qa)

**Decisão técnica da preparação: APPROVED. Decisão da story completa: NEEDS_WORK.** Código, gates e simulação revisados sem achados abertos; a preparação está apta à apresentação da prévia. Vault concluiu a revisão do fingerprint e bloqueia apenas até o consentimento específico (AC 10). A decisão não autoriza aplicação em produção: ainda faltam consentimento, aplicação autorizada, nova comparação/idempotência e validação da apresentação após a carga (AC 11).

**Escopo:** coletor, executor, construtor do plano, apresentação e action do histórico RD, com os testes correspondentes. Comparação delimitada pelo baseline privado desta entrega; alterações anteriores do workspace não foram atribuídas a esta story. Revisão manual substituiu CodeRabbit indisponível. QA não executou escrita no banco remoto.

**Achados corrigidos e conferidos:** conflito de nomes entre catálogos V1/V2 preserva autoria e gera exceção; ausência de conteúdo/data não apaga informação existente; prefixo isolado não comprova correção automática; rollback parcial distingue operações nunca aplicadas e preserva alterações concorrentes intocadas; guarda transacional inclui identidade por chave legada e ID/família; remoção explícita de autor não reaparece por fallback do bruto; páginas sem marcador de término são recusadas. Também foi eliminado o preenchimento de título genérico que produziria correções sem alteração visível.

**Plano final verificado:** `4be6d3428252a7c6aca9d9463ea7a520d1fa6643d355ba39a61b1e566c89bece`. Hash do plano, hash do runtime e vínculo com a simulação conferidos independentemente por QA. Inventário de 1.234 cards, 1.221 vínculos; comparação de 3.682 anotações, 7.177 movimentações e 1.624 tarefas históricas. Plano com **447 operações em 237 cards: 122 inserções de eventos e 325 atualizações de projeção**, acompanhadas de correções auditáveis. As instruções SQL do plano permanecem restritas ao histórico; o executor acrescenta recibos de auditoria, sem alterar entidades operacionais ou escrever no RD.

A conferência V2 cobre 54 negócios e 266 notas; todas as anotações alteradas exigem confirmação de identidade, autor e data. Diferenças de representação do conteúdo HTML V2 são contabilizadas e não substituem automaticamente o texto V1. A fonte não identifica autoria original das 7.177 movimentações; essa limitação deve permanecer explícita no relatório.

**Simulação no backup restaurado:** 447 operações aplicadas; segunda execução com zero operações e 447 ignoradas; 447 operações revertidas; 1.341 guardas de aplicação e 1.341 de compensação válidas; `integrity_check=ok` e zero violações de FK. Evidência privada: `database-backups/pre-change/rd-historico-autoria-2026-10-20/simulation.json`. Estes resultados não equivalem a aplicação remota nem a nova comparação pós-carga.

**Gates finais conferidos:** suíte do workspace em `/tmp/rd-history-tests.log` com exit 0, 657 arquivos e **4.975 testes aprovados**, quatro ignorados e um pendente; 24 testes focais aprovados. Lint e typecheck finais retornaram exit 0; lint sem erros e com 1.193 avisos existentes. Build isolado revisado no relatório DevOps `../painel-alpha-worktrees/crm-rd-historico-build-report.md`: comando original falhou por limite de heap de 3.072 MB; build equivalente com heap de 4.096 MB concluiu com exit 0, geração de 80 páginas e tracing. Não houve mudança de `package.json` nem publicação nessa validação.

**Pendências daquela etapa:** obter consentimento para este fingerprint conforme relatório final [Vault](relatorio-vault-rd-historico-autoria.md); executar somente o lote autorizado e comprovar pós-condições/nova prévia sem diferenças; validar a apresentação de forma honesta, distinguindo autoria original, responsável histórico e autor da correção. Essas pendências foram verificadas na revalidação abaixo.

### Revalidação após aplicação e publicação — 2026-10-20 — Quinn (@qa)

**Decisão final: APPROVED.** Substitui o `NEEDS_WORK` da etapa de preparação. O usuário autorizou especificamente a aplicação; Vault liberou o plano exato e registrou a conclusão. QA conferiu os artefatos locais de aplicação, reconciliação e produção, sem executar mutações no banco.

- **Aplicação autorizada:** `preflight.json`, `apply-result.json` e `verification.json` correspondem ao fingerprint `4be6d3428252a7c6aca9d9463ea7a520d1fa6643d355ba39a61b1e566c89bece`. Foram aplicadas 447 operações, sem itens ignorados; 1.341 de 1.341 guardas coincidem antes da carga, após a carga e na verificação independente.
- **Reconciliação integral:** `post-apply-reconciliation.json` confirma 1.234 cards, 1.221 origens, 12.483 eventos e 8.319 correções. Os 12.361 registros brutos anteriores e as 7.994 correções anteriores foram preservados; há 447 recibos do lote. Nova comparação com a coleta aprovada resultou em **zero inserções e zero atualizações restantes**, com 12.483 eventos equivalentes. Permanecem explícitas duas datas de tarefa indisponíveis e 71 nomes de etapa indisponíveis, sem substituição por informação inventada.
- **Apresentação sobre dados reais:** execução dos helpers atuais sobre o snapshot remoto pós-carga, registrada em `presentation-check.json`, encontrou autor exibível em todas as 3.682 anotações. As 8.319 correções apresentam 4.389 rótulos “Ajuste automático da importação”, 3.605 “Autoria recuperada automaticamente do RD” e 325 “Histórico reconciliado automaticamente com o RD”; nenhum rótulo legado “Sistema / autor não disponível”. Essa evidência complementa os testes da action e dos helpers. Não foi realizada inspeção visual em sessão autenticada; a limitação está registrada e não é apresentada como teste visual realizado.
- **Publicação:** metadados de produção confirmam deployment `dpl_6w5Pbv2Jw3VM72gmtB7LkpAuq6hz`, estado `READY`, commit `4ce99fe67f1041d69f1b535613208bd32d368645` e o fingerprint aprovado. O alias [painel.alpha-comex.com](https://painel.alpha-comex.com) aponta para esse deployment. Smoke após promoção em 18:10:43 UTC: raiz HTTP 200, CRM sem sessão HTTP 307 para `/?acesso=bloqueado` e API sem credenciais HTTP 401, sem resposta 500.
- **Dependências:** o audit reportado por DevOps identificou dívida anterior na árvore de dependências. QA confirmou diff vazio de `package.json` e lockfiles entre a base de produção `1504a1c6` e o commit publicado. A revisão do delta não identificou nova dependência, endpoint ou relaxamento de autenticação/autorização. Isso não equivale a declarar a árvore inteira livre de vulnerabilidades; a dívida preexistente permanece documentada.

Evidências privadas de dados em `database-backups/pre-change/rd-historico-autoria-2026-10-20/`. Evidências de publicação em `../painel-alpha-worktrees/crm-rd-production-metadata.json`, `crm-rd-production-alias-after-promote.json` e `crm-rd-production-smoke-after-promote.json`. Gates finais permanecem os 4.975 testes aprovados, lint/typecheck sem erros e build validado descritos acima. Nenhum achado bloqueante aberto no escopo desta entrega.

### Integração restrita em staging — 2026-10-20 — Quinn (@qa)

**Gate global deste candidato staging: NEEDS_WORK**, por testes preexistentes que continuam falhando. **Revisão do delta da entrega: sem achados ou regressões identificadas.** Esta decisão não altera a aprovação anterior do pacote de produção nem apresenta a suíte staging como aprovada.

Candidato final revisado `8b194a43850c9f383476cf9285bd630defb4871f`, comparado com a base staging atualizada `e0a2576cc0f619ffcd1b2e5d1c194a99973ea0ce`. Ele preserva os cherry-picks `28cdade7`, `35b50984` e `f387409b` e incorpora o avanço concorrente de administradores/líderes antes de qualquer push. A revisão anterior de `f387409b` sobre `bcc3373c` foi substituída por esta revalidação; seus gates não foram usados como prova para a nova base. O delta final de **47 arquivos** contém somente a entrega CRM de cards/contratos e histórico/autoria, seus testes, scripts e documentação. Não foram incorporadas alterações de chamados, metas ou dependências do merge amplo usado apenas como referência.

QA conferiu a preservação das funcionalidades de origem do cliente, parceiro e liderança existentes em staging. `ownership.ts`, `lideranca-setor.ts` e a story implementada de movimento livre são idênticos à base `e0a2576c`; o rascunho anterior de 104 linhas não substitui a story atual de 185 linhas. As alterações em `Cards.ts` acrescentam o acompanhamento do contrato sem substituir o movimento livre, a validação ou o salvamento de origem/parceiro. Em `transicao-command.ts`, o retorno antecipado de `movimentoLivre` permanece antes das obrigatoriedades e as condições que suprimem inicialização de status e efeitos automáticos permanecem intactas. A entrega apenas acrescenta o reconhecimento dos nomes/chaves de Fechado e Stand-by e passa `etapaDestinoChave` no ramo normal protegido por `prepared.movimentoLivre`. `PainelProximaEtapa.tsx` preserva os controles novos e muda somente o rótulo desta entrega. `git diff --check` e a inspeção dos imports não apontaram problemas.

**Gates e comparação de baseline:**

- Lint aprovado, zero erros e 1.193 avisos. Typecheck final aprovado, exit 0, com heap de 6.144 MB e afinidade em uma CPU; a tentativa anterior interrompida com exit 143 está documentada como interrupção, não como aprovação nem diagnóstico de erro de código.
- Suíte completa do candidato final: **644 arquivos, 640 aprovados e quatro com falha; 4.801 testes aprovados**, seis falhas, quatro ignorados e um pendente. Falhas: três testes de `builder/embed`, uma suíte de arquivamento por importação `next-auth`, um teste de layout do modal e dois testes com expectativa antiga de próximo contato em Em Tratativa. Os testes novos de movimento livre passaram.
- DevOps reproduziu os mesmos quatro arquivos/seis testes falhos no checkout limpo do baseline atualizado `e0a2576c`; QA confirmou o SHA do checkout, os logs e o setup comparável. `package.json`, lockfile, configuração Vitest e pacotes relevantes têm hashes idênticos; baseline e candidato usam o mesmo `node_modules`. A regra de próximo contato apenas em Sem Viabilidade já existe no baseline e não foi revertida para satisfazer testes antigos.
- Build equivalente **do candidato atualizado** aprovado com heap de 4.096 MB: exit 0, 64,71 segundos, pico de 6.065.655.808 bytes, 80 páginas e tracing concluídos. Prisma/player gerados pelos comandos oficiais; nenhuma alteração de `package.json` e nenhum delta residual de `tsconfig`.

Evidências finais no diretório pai do checkout: `crm-staging-e0-tests.log`, `crm-staging-e0-baseline.log`, `crm-staging-e0-lint.log`, `crm-staging-e0-typecheck-final.log`, `crm-staging-e0-gates.json` e `crm-staging-e0-build-4096-result.json`. A análise de imports da rodada inicial permanece em `crm-staging-import-check.json`. QA não executou nova carga de banco nem duplicou os gates pesados.

**Decisão de release do orquestrador, separada do verdict QA:** atendendo ao pedido explícito do usuário para testar em staging, o orquestrador autorizou commit/push e publicação **exclusivamente em staging** após o build aprovado, com exceção contextual para as falhas de baseline reproduzidas. Essa decisão não converte o gate global em `APPROVED`, não autoriza mudança em produção/main ou banco e não amplia a entrega para corrigir funcionalidades alheias. A ressalva global permanece registrada; não há nova falha atribuída ao delta CRM revisado.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-10-20 | 2.0 | Lote autorizado aplicado, reconciliação posterior sem diferenças, publicação READY e QA APPROVED. | Codex / Vault / QA / DevOps |
| 2026-10-20 | 1.0 | Story para comparação global e atualização exclusiva de histórico/autoria, com prévia e salvaguardas de backfill. | River (SM) |
