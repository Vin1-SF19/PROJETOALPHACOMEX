# Story — Gerar minuta ao entrar em Elaboração por movimento livre

## Status

Done — correção validada no staging com gates reais, QA final e reteste Admin autenticado; fechamento documental preserva a atualização concorrente do GeradorDocumentos. Produção fora do escopo.

## Executor Assignment

- **Executor:** `@dev` (backend/motor documental).
- **Quality gate:** `@qa`, com revisão `@architect` da exceção restrita de automações.
- **Ferramentas:** testes Vitest unitários e de integração, regressões documentais, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e reteste autenticado sintético em staging.
- **Publicação:** `@devops`, exclusivamente staging. Scrum Master altera somente esta story, sem código, testes, Git ou banco.

## Story

**Como** Admin ou líder com autoridade vigente de movimentação livre no CRM, **quero** que entrar em uma etapa com regra ativa e elegível de geração de contrato produza automaticamente a minuta vinculada ao card, **para** iniciar a elaboração financeira sem perder a liberdade de movimentação nem disparar ações de outros setores.

## Fonte, diagnóstico e dependências

A solicitação atual relata que, após promover a aplicação Vercel para produção, o usuário moveu CARNES SANTA CATARINA LTDA para Financeiro → Elaboração de Contrato e o contrato não foi gerado. A intenção autorizada é corrigir a geração automática da minuta; o usuário já rejeitou acrescentar um botão não solicitado.

Diagnóstico SELECT-only recebido pela coordenação em 21/10/2026: movimento às **20:03:26 UTC**, card financeiro `rdcard_8f14f2b187a7abb7db8d6b61aea3`, empresa `3059`, ator Admin `8`, comprovado **no banco de staging**. Evento `CARD_MOVIDO` contém `automacoesSuprimidas=true` e `transicaoId=null`; regra `GERAR_CONTRATO` ativa, com zero documentos e zero execução para o caso. Foram identificados dois movimentos Admin suprimidos, às 20:03:14 e 20:03:26 UTC. O usuário confirmou que operou em **staging**; a leitura de produção foi encerrada sem novo movimento correspondente. Não há evidência de deployment apontando para banco incorreto.

Inventário atual de staging recebido de DevOps: serviço `Revisão RADAR - 150K` atende à condição “contém Radar”; template e contratada estão ativos; campo upload ativo pertence ao Financeiro; `permitirPendencias=true`. Nenhum outro bloqueio foi identificado nesse inventário.

O comando atual registra movimentos livres com supressão ampla e não aciona a fila normal de movimento. O materializador recusa eventos suprimidos. A falha é compatível com a política atual do movimento livre; a correção deve criar uma exceção documental estreita para eventos novos.

Dependências e continuidade:

- [Elaboração de Contrato ativa](story-financeiro-ativo-elaboracao-contrato.md#critérios-de-aceite), AC 7: geração configurada, vínculo autorizado e idempotência. A minuta automática é `CONFERENCIA`; não presume envio ou assinatura. A configuração histórica daquela story não substitui inventário atual de staging.
- [Contratos pendentes no Comercial](story-crm-contratos-pendentes-comercial-20261021.md#critérios-de-aceite), AC 3–5: decisão do usuário **“Após finalizar no Financeiro, mantendo a conferência atual”**. Minuta não libera verde, documento para envio nem alerta ao closer. A entrega anterior está Done, com limites de cobertura remota documentados.
- [Arquitetura de contratos pendentes](../architecture/crm-contratos-pendentes-comercial-20261021.md#decisões-e-limites): prontidão, identidade BPM confiável, projeção somente leitura e finalização vigente permanecem obrigatórias.
- Desenho desta exceção foi fornecido pela coordenação e está sob revisão paralela de `@architect`; ratificação técnica é necessária antes do fechamento da implementação. Não se cria epic novo nem se altera AC das stories anteriores.

## Critérios de aceite

1. **Geração automática e liberdade preservada:** um novo movimento livre confirmado de Admin ou líder autorizado para uma etapa que possua regra ativa de entrada `GERAR_CONTRATO` elegível aciona a geração da minuta pelo motor existente, sem novo botão e sem exigir os requisitos normais dispensados pela movimentação livre. Não fabricar dados obrigatórios ausentes nem finalizar documento para demonstrar sucesso. Sem regra/modelo/condição elegível, o movimento continua livre e não gera documento indevido.
2. **Proveniência exclusivamente no servidor:** somente eventos novos, efetivamente produzidos pelo comando autorizado de movimento livre, recebem marcador explícito da exceção documental. Preservar `automacoesSuprimidas=true`, identidade do ator, card, pipeline, etapa, evento, correlation/causation e idempotency key. Não aceitar marcador/autoridade/metadados BPM controlados pelo cliente. Eventos antigos sem marcador continuam integralmente suprimidos, inclusive em replay; sem backfill ou reinterpretação do histórico.
3. **Regra documental estrita:** a exceção aceita somente grafo válido de exatamente dois nós, `ACAO GERAR_CONTRATO → FIM`, com uma única ação, fluxo íntegro e configuração aplicável ao pipeline/etapa de destino. Avaliar as condições configuradas e a versão ativa pelo mecanismo existente. Grafos mistos, inclusive `GERAR_CONTRATO` com HTTP, `CRIAR_CARD`, `WAIT`, `ALTERAR_CAMPO`, envio ou outra ação, permanecem integralmente suprimidos; não extrair e executar parcialmente sua ação documental. As demais automações de movimento livre continuam suprimidas.
4. **Defesa na materialização e na execução:** materializador e worker revalidam independentemente marcador/proveniência, regra e versão ativa, grafo estrito, condições e contexto atual do card/pipeline/etapa. Revogação, substituição/desativação da regra/versão, mudança de configuração para grafo misto, card fora da etapa/pipeline ou arquivado impedem geração pendente sem executar outra ação. Reutilizar o tratamento seguro existente de execução ignorada/falha e não ocultar erro operacional como sucesso.
5. **Idempotência e concorrência:** replay do mesmo comando/evento, retry do materializador, disputa entre workers e retomada após falha convergem para uma geração/vinculação por identidade do evento/regra, sem duplicar documento, anexo ou execução efetiva. Preservar CAS, lease/claim, deduplicação e limites de encadeamento existentes. Documento/erro de geração não pode desfazer ou falsear movimento já confirmado; a recuperação usa o mecanismo existente, sem worker global invocado para corrigir o caso real.
6. **Minuta privada e conferência vigente:** documento gerado inicia em `CONFERENCIA`, vinculado ao card/campo correto, com identidade BPM derivada no servidor para qualquer template suportado. Preservar ownership, empresa, permissões e armazenamento privados. O Comercial permanece pendente por causa dessa minuta, sem verde nem alerta de pronto para envio, e o assinado continua independente. Finalização legítima posterior segue o fluxo já aprovado, incluindo alerta idempotente quando então elegível.
7. **Compatibilidade e ausência de efeitos colaterais:** movimento normal de usuário sem autoridade livre conserva validações e automações vigentes; Admin/líder conservam a autoridade autorizada e supressão de envios/cadências/ações de outros setores. Não habilitar geração em `CARD_CRIADO` administrativo, evento de campo ou outro gatilho por extensão implícita. Não alterar schema, configuração publicada, dados em lote, ambiente ou produção; não gerar documentos legais externos, assinatura ou envio a terceiros.
8. **Validação e entrega honestas em staging:** executar cenários significativos dos AC 1–7 e os quatro gates obrigatórios, obter revisão arquitetural e QA, publicar somente em staging e retestar por fluxo autenticado com dados fictícios. Conferir SHA/READY/alias e ambiente efetivo antes do reteste. Registrar geração automática real e `CONFERENCIA`, ausência de verde/alerta prematuros e alcance comprovado. Atualizar checklist, File List e evidências sanitizadas antes de concluir; produção exige pedido explícito posterior.

## Tasks / Subtasks

- [x] Registrar pedido, diagnóstico recebido, escopo autorizado e continuidade documental (AC 1–8).
- [x] Preparar critérios verificáveis e aplicar story-draft-checklist (AC 8).
- [x] Ratificar com `@architect` o marcador e o contrato restrito compartilhado por comando, materializador e worker (AC 2–4).
- [x] Emitir marcador confiável em novos movimentos livres e conectar processamento estritamente documental após commit, preservando a supressão ampla (AC 1–3, 5, 7).
- [x] Implementar elegibilidade defensiva na materialização e revalidar no worker, sem executar partes de grafo misto (AC 3–4).
- [x] Reutilizar gerador, vínculo, metadados server-side e dedupe; preservar conferência e prontidão comercial (AC 5–6).
- [x] Cobrir cenários positivos/negativos, concorrência, replay, erro e regressões de movimento/contratação (AC 1–7).
- [x] Executar lint, typecheck, suíte completa e build; obter QA e revisão arquitetural com evidências (AC 8).
- [x] Publicar exclusivamente staging e retestar cenário fictício autenticado; atualizar esta story e sua File List com alcance real (AC 8).

## Dev Notes

### Contexto acumulado e decisões autônomas

`accumulated-context.md` e `.aiox/gotchas.json` não foram localizados na worktree nem nas buscas dos diretórios do projeto consultados; a referência obrigatória ao acumulado fica registrada como indisponível. A coerência usa os artefatos específicos citados acima. O caminho legado `.Codex/commands/AIOX/agents/sm.md` também está ausente; persona canônica carregada de `.aiox-core/development/agents/sm.md`, com skill `.codex/skills/aiox-sm/SKILL.md`. Os documentos genéricos de framework/arquitetura esperados pela configuração não foram localizados; não presumir seu conteúdo. Reutilizar stack e padrões reais existentes, sem dependências novas ou variáveis de ambiente novas previstas.

- [AUTO-DECISION] Qual story preparar? → O arquivo nomeado pela coordenação, derivado do pedido corretivo atual e dependências existentes, sem numerar epic inexistente (reason: destino e escopo explícitos).
- [AUTO-DECISION] Pedir botão/novo fluxo manual? → Manter geração automática sem botão (reason: usuário rejeitou botão não solicitado).
- [AUTO-DECISION] Alterar eventos anteriores para recuperar o caso observado? → Não; somente novos eventos com marcador server-side (reason: evitar reinterpretar histórico e disparar automações suprimidas).
- [AUTO-DECISION] Sincronizar ClickUp? → Não; entrega autorizada somente local nesta story (reason: não há epic remoto nem autorização para criar artefatos externos nesta missão).
- [AUTO-DECISION] Concluir a implementação na preparação? → Não; status pronto para desenvolvimento com tarefas técnicas pendentes (reason: papel SM e escopo documental).

### Pontos de integração existentes

| Ponto | Responsabilidade a preservar |
| --- | --- |
| `src/lib/bpm/transicao-command.ts` (`executarTransicaoBpm`) | Autoridade server-side, CAS/outbox, supressão do movimento livre e processamento após commit. |
| `src/lib/bpm/automacoes/eventos.ts` (`materializarExecucoesEventosBpm`) | Matching de gatilho, versão ativada, filtro por card, corte histórico, correlation e dedupe. Atualmente recusa toda supressão. |
| `src/lib/bpm/automacoes/central-runtime.ts` | Claim/lease, card arquivado, versão ativa, condições, grafo e ação documental; revalidar antes do efeito. |
| `src/lib/bpm/automacoes/orquestrador.ts` | Processamento central existente filtrado por card, sem ampliar para execução global. |
| `src/lib/bpm/automacoes/executor.ts` | Geração `CONFERENCIA`, template, vínculo do campo, identidade `__bpmCardId` server-side e permissões. |
| `src/lib/bpm/contratacao-comercial-server.ts` | Minuta não libera projeção nem alerta; prontidão exige finalização válida no fluxo atual. |
| `src/actions/gerador-documentos.ts` (`FinalizarDocumento`) | Finalização financeira existente; não antecipar neste movimento. |

Os nomes e formato do novo marcador ficam com arquitetura/executor; não reaproveitar ausência de `transicaoId` como prova de autorização. Marcador não concede permissão ao cliente. Os caminhos são blueprint, não indicação de que todos precisam ser alterados. [Fonte: código existente na base `daf88fb7` e desenho restrito informado pela coordenação.]

### Ambiente e limites operacionais

Base de preparação: `daf88fb7`, worktree `crm-contrato-elaboracao-20261021`. Correção e validação primeiro em `https://staging.alpha-comex.com`, branch `staging`. CLI de staging deve usar `.env.staging.local` após conferir ambiente e destino efetivos; nunca presumir `.env.local`. Não copiar dados, dumps, arquivos de ambiente ou credenciais de produção. Commit/push para staging já estão autorizados ao fluxo executor/DevOps; isso não autoriza produção.

Não estão previstas migrations, schema, seeds/backfills, alteração de configuração publicada ou mutações em massa. Se a implementação encontrar necessidade real dessas operações, a política Vault de relatório, backup completo verificado e confirmação específica aplica-se antes de executá-las. Esta story não fornece essa autorização. Reteste usa CRUD normal de fixture fictícia e nenhum card real de produção; não chamar CLI/worker global nem finalizar/enviar contrato real como prova.

## Testing

Usar Vitest e padrões existentes em `tests/bpm/movimento-livre-command.test.ts`, `movimento-livre-eventos.test.ts`, `automacoes-central.test.ts`, `automacoes-correcoes-motor.test.ts`, `automacoes-executor.test.ts`, `contratacao-geracao-bpm.test.ts`, `contratacao-comercial.test.ts` e `tests/gerador-documentos/finalizar-documento.test.ts`. Para integração concorrente, reutilizar fixture SQLite privada e o padrão de `tests/bpm/contratacao-comercial-sqlite.test.ts`; não carregar tokens remotos nos testes locais.

| Cenário | Resultado observável |
| --- | --- |
| Admin e líder autorizados, novo movimento, regra estrita e condição verdadeira | Movimento confirmado e uma minuta vinculada `CONFERENCIA`, sem envio externo. |
| Usuário normal | Validações e automações habituais preservadas; nenhuma autoridade livre obtida por payload. |
| Evento suprimido antigo sem marcador; marcador forjado no input | Nenhuma execução documental habilitada; histórico não é regravado. |
| `CARD_CRIADO` administrativo, outro gatilho, pipeline ou etapa incorretos | Nenhuma exceção aplicada. |
| Condição falsa, modelo ausente/inaplicável, regra/versão inativa | Nenhum documento indevido; estado/diagnóstico honesto, sem bloquear o movimento livre confirmado. |
| Grafo misto com geração + HTTP/CRIAR_CARD/WAIT/ALTERAR_CAMPO/envio; grafo inválido | Zero efeitos de qualquer nó; não executar parcialmente. |
| Regra elegível na fila, mas revogada/substituída/alterada; card movido/arquivado antes do worker | Revalidação impede efeito; worker não confia somente no filtro anterior. |
| Replay de comando/evento, materializadores e workers concorrentes, retry após falha | Dedupe e CAS convergem; nenhuma duplicação documental ou vínculo estrangeiro. |
| Template diferente do padrão; tentativa de forjar `__bpmCardId` | Identidade confiável do card/empresa prevalece e acesso privado é preservado. |
| Nova minuta vista pelo Comercial | Contrato para envio e assinado permanecem pendentes, sem novo alerta de prontidão. |
| Finalização válida posterior e replay dessa finalização | Comportamento aprovado de prontidão/notificação continua idempotente. |
| Falha de geração ou publicação após commit | Movimento confirmado permanece íntegro; erro/recuperação existentes, sem falso sucesso documental. |

Gates obrigatórios da implementação: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. QA e reteste autenticado remoto são etapas próprias; evidência local não comprova automaticamente comportamento remoto. Reteste sintético deve comprovar novo evento marcado, execução documental, uma minuta vinculada em conferência e Comercial ainda pendente, sem tocar caso real para fabricar evidência. Registrar limitações encontradas.

## 🤖 CodeRabbit Integration

### Story Type Analysis

**Primary Type:** API. **Secondary Types:** Integration, Security. **Complexity:** alta, por exceção de autoridade, execução assíncrona e idempotência documental.

### Specialized Agents

- **Primário:** `@dev` (implementação e pre-commit).
- **Apoio:** `@architect` (fronteira da exceção/proveniência), `@qa` (testes e parecer), `@github-devops`/`@devops` (publicação staging).

### Quality Gates

- [ ] Pre-Commit (`@dev`): quatro gates, testes adversariais do marcador/grafo e revisão de regressões.
- [ ] Pre-PR (`@github-devops`, se houver PR): integração, compatibilidade de eventos antigos e escopo staging.
- [ ] Pre-Deployment staging (`@devops`): SHA/ambiente/alias, configuração preservada e rollback de código identificado.
- Pre-Deployment produção: não aplicável a esta entrega, pois produção não está autorizada.

### Self-Healing Configuration — Story 6.3.3

`@dev`: light, até 2 iterações/15 minutos, corrigir CRITICAL e documentar HIGH. `@qa`: full, até 3 iterações/30 minutos, corrigir CRITICAL/HIGH dentro do escopo e registrar MEDIUM como dívida. `@github-devops`: check, somente relatório. LOW ignorado. Se o CLI não estiver instalado, registrar a indisponibilidade real e a revisão alternativa, sem simular aprovação.

### Focus Areas

Validar proveniência server-side, grafo estrito sem execução parcial, condições/versão/contexto em dois pontos, não reinterpretação histórica, isolamento de pipeline/card/empresa, CAS/claim/dedupe, ausência de efeitos externos e `CONFERENCIA` sem prontidão comercial.

## Story Draft Checklist — validação da preparação

- [x] Objetivo, benefício, diagnóstico e dependências explícitos.
- [x] Pontos técnicos e contratos existentes identificados, sem tecnologia/configuração inventada.
- [x] Referências específicas e contexto crítico resumidos na própria story.
- [x] Premissas, limites, erros e cenários adversariais explícitos.
- [x] Abordagem de teste, resultados observáveis e gates definidos.
- [x] CodeRabbit, agentes, gates, self-healing e focos preenchidos conforme integração habilitada.

| Categoria | Resultado | Observação |
| --- | --- | --- |
| 1. Goal & Context Clarity | PASS | Pedido corretivo e continuidade financeira/comercial explícitos. |
| 2. Technical Implementation Guidance | PASS | Blueprint existente e exceção estrita descritos; ratificação arquitetural consta como tarefa. |
| 3. Reference Effectiveness | PASS | Stories e arquitetura acessíveis, com conteúdo decisivo resumido. |
| 4. Self-Containment Assessment | PASS | Fontes ausentes e decisões autônomas registradas, sem presumir seu conteúdo. |
| 5. Testing Guidance | PASS | Matriz mensurável, concorrência/segurança, quatro gates e reteste staging. |
| 6. CodeRabbit Integration | PASS | Configuração habilitada e seção completa. |

**Final Assessment:** READY; clareza 9/10. O executor pode iniciar a implementação com este contexto. Revisão arquitetural, evidência dos testes e confirmação do ambiente remoto são tarefas abertas; nenhuma foi declarada executada pelo SM.

## Dev Agent Record

Echo implementou o backend na worktree isolada, após liberação desta story e do desenho/adendo de Aria. O comando emite o marcador somente para movimento livre manual autorizado e chama, após commit, um flush estrito por card/evento. Classificador puro permite apenas grafo válido `GERAR_CONTRATO → FIM`. Materializador e worker revalidam proveniência causal no histórico, ator/ACL canônicos, configuração ativa, destino/contexto atual e condição global. O resgate de execuções vencidas, seleção e claim do flush documental ficam restritos ao evento/card/versões documentais. A recuperação global das chamadas normais foi preservada após observação independente de QA.

O gerador existente permaneceu responsável por template/contratada/campo/variáveis, identidade `__bpmCardId` e criação de `CONFERENCIA`. Testes reais em Prisma/SQLite privado comprovam uma minuta/anexo, reuso em replay/reentrada, concorrência, erro/retry, Comercial pendente e zero tarefas/envios prematuros. Filas sentinela antigas, mistas, legadas e de outro card ficaram idênticas no flush documental, inclusive com lease ocupado e resgate da execução alvo. Nenhum arquivo de UI, configuração publicada, schema, banco remoto ou credencial foi alterado pelo backend.

### Verificações e evidências locais

- `npm test -- --coverage.enabled=false --testTimeout=15000` com 11 arquivos direcionados: **165/165 testes PASS**, incluindo 33 cenários SQLite e os 55 adversários independentes de QA. Log: `/var/tmp/alpha-crm-contrato-elaboracao-20261021/backend-tests-freeze.log`.
- `npm run typecheck`: **exit 0**, após a correção de compatibilidade e o teste final. Log: `/var/tmp/alpha-crm-contrato-elaboracao-20261021/backend-typecheck-freeze.log`.
- `npm run lint --` sobre os seis fontes e dois testes de ownership Echo: **exit 0**. Log: `/var/tmp/alpha-crm-contrato-elaboracao-20261021/backend-lint-freeze.log`. O teste de segurança foi validado separadamente pelo QA.
- Uma rodada anterior teve timeout de 5 segundos na fixture SQLite legada em `/tmp`; o reteste isolado passou e o lote final de 165 passou com timeout explícito de 15 segundos, sem alterar o teste legado.

Fixtures novas usam diretório privado em `/dev/shm`, adapter `file:` e tabelas locais derivadas do schema; não carregam `.env` nem usam tokens remotos. Checklists e emissão de realtime/PDF são periféricos simulados; ACL, materialização, worker/lease/claim, gerador, dedupe e projeção comercial são reais na fixture. Esses resultados não equivalem a E2E remoto. No checkpoint de implementação, os gates globais, parecer final, publicação e reteste ainda eram pendências da coordenação; os resultados efetivos posteriores estão registrados abaixo. Nenhum resultado de produção é presumido.

**SOURCE FREEZE backend:** seis arquivos de runtime e os dois testes de ownership Echo estáveis para Forge/revisão. Novas mudanças exigem nova verificação dos caminhos afetados.

### Gates globais e preparação de publicação — DevOps

Forge executou os quatro gates sobre a base `daf88fb7` com o runtime desta correção: typecheck **exit 0** (8,10 s), lint **exit 0**, 0 erros e 1.193 avisos preexistentes (50,21 s), build supervisionado equivalente ao workflow oficial **exit 0** (203,35 s) e suíte completa **706 arquivos, 5.557 testes aprovados, zero falhas, quatro skipped e um todo** (187,36 s). A execução usa Prisma/player/Next reais com limite de memória e SQLite local isolado; nenhum `.env` remoto foi carregado. Smoke local confirmou página, JavaScript, providers, sessão anônima e proteção do CRM; servidor encerrado. Fingerprint antes/depois e após o smoke: `d55db46c02cecdac7af23f01d035628c15a6fbb0273c9450f8b640657f057080`, inalterado. Evidências privadas em `/var/tmp/alpha-crm-contrato-elaboracao-20261021/forge/forge-result.json`.

O preflight encontrou `origin/staging=bfff9d36`, atualização concorrente de Instagram/NoLoss com dez caminhos disjuntos dos onze desta entrega e sem mudanças de schema/dependências/auth. A preservação desses commits por integração normal está autorizada; checks dirigidos e parecer QA da combinação ainda pendem neste checkpoint. Manifesto e scan de segredos não encontraram credenciais; hashes do perfil CLI de staging conferem com o upload validado. Nenhum script remetente, worker, mutação de banco, alteração de ambiente ou publicação de produção foi executado.

### Integração preservadora de staging — checkpoint pré-push

A correção foi congelada no commit local `55183c0a`, filho de `daf88fb7`, antes de integrar `bfff9d36` por merge normal sem conflitos. A prova `release/merge-bfff-proof.json` conserva os onze caminhos da feature, os nove arquivos de runtime/testes byte a byte e os dez arquivos remotos de Instagram byte a byte; a story recebe somente metadados e QA posteriores. Nenhum script Google Apps Script ou remetente CLI foi executado.

Checks da árvore combinada: `npm run typecheck` oficial com heap de 8 GiB **exit 0** (18,47 s); lint dos três fontes TS/TSX/MTS e do Apps Script via entrada JavaScript **exit 0**; **11 arquivos e 158 testes aprovados, zero falhas**. A primeira tentativa de typecheck com wrapper limitado a 4 GiB encerrou por OOM (134), sem erro TypeScript; log preservado e repetição com a configuração oficial aprovada. Fixtures em `/dev/shm` e sentinel SQLite locais, sem `.env` remoto. Fingerprint combinado `38bf3c61b6d0aacc00de95e79989286a0aff8584cf94be04825d6fefec7f22a6` idêntico antes/depois. Evidência: `/var/tmp/alpha-crm-contrato-elaboracao-20261021/release/delta-bfff-result.json`. QA ratificou o GO de push da combinação após conferir esses resultados, sem novos bloqueantes. Publicação/READY e reteste autenticado ainda pendem neste checkpoint.

### Reteste remoto concluído — staging

A revisão `71e3f06fed6890ef346ead946711ea37bcdc4fd3` ficou READY em `dpl_2eyf3ifNfvM587DptJ7wacBUGMob`, alias staging e custom environment conferidos. Smoke público/banco/autenticação passou. Admin real criou e percorreu somente a empresa fictícia 3067 pela UI normal. Primeira entrada Financeiro Novo Contrato → Elaboração gerou uma minuta CONFERENCIA e um anexo no campo canônico, com empresa e `__bpmCardId` corretos. Preview autenticado/UI em conferência: dez cláusulas, oito pendências e PDF de prévia 200/99.452 bytes/`%PDF-`. Não se trata de finalização nem PDF final persistido.

Após voltar a Novo Contrato e entrar novamente, o passo documental retornou `existente=true` para o mesmo documento/anexo, sem alterar seus metadados nem o valor canônico. São **dois registros SUCESSO**, um por entrada elegível, e **um IGNORADA** na saída para Novo Contrato (`DESTINO_DOCUMENTAL_DIVERGENTE`, zero tentativas, nenhum passo): três registros totais. Quinze assertivas finais passaram. O primeiro rascunho privado do checker, que exigia incorretamente dois registros totais, foi preservado e corrigido apenas no harness; o runtime não foi alterado.

O Comercial manteve os slots pendentes, rota para envio 404, nenhum aviso correspondente e nenhuma tarefa de envio; seu registro permaneceu inalterado. Elaborado/enviado/assinatura/pagamento/NF não foram confirmados. Os dois cards3066 e seu PDF manual conservaram igualdade profunda e hashes idênticos ao baseline. A empresa real do relato foi somente diagnosticada; não houve reprocessamento de eventos antigos nem movimento nela por esta validação.

Tempos das ações observadas: primeira entrada **22,634 s**, reentrada **18,624 s**; sem teste de carga ou alegação de ganho de latência. Voz503, abortos de navegação e avisos de política geográfica/descrição de diálogo foram separados dos resultados da feature. Líder, finalização e assinatura positiva não foram exercitados remotamente. Nenhuma migration, backfill, configuração/ENV, worker global/CLI manual ou publicação de produção foi realizada.

Relatório sanitizado: `docs/reports/validacao-minuta-movimento-livre-staging-2026-10-21.md`. Evidências privadas: `remote-browser-result.json`, `draft-ui-proof.json`, `commercial-ui-proof.json`, `first-entry-proof.json`, `final-generation-evidence.json`, `after-reentry.json` e `reentry-proof.json`, em `/var/tmp/alpha-crm-contrato-elaboracao-20261021/`. Nenhum log bruto, token, URL de armazenamento ou conteúdo contratual foi versionado.

### Preservação da atualização concorrente no fechamento documental

Antes do commit documental, `origin/staging` avançou para `86858e7e`, filho de `71e3f06f`, por outro fluxo autorizado de valores por extenso no GeradorDocumentos. São onze caminhos externos, incluindo dependência fixa `extenso@3.0.0`, ações/UI/helper/testes e sua story. FF normal preservou esse trabalho e nossos documentos; os nove arquivos de runtime/testes desta correção permaneceram byte a byte iguais a `71e3f06f` (prova privada `release/ff-868-proof.json`). A revisão externa tem gates e QA próprios; sua suíte combinada executada registrou 709 arquivos/5.614 testes aprovados e typecheck exit 0. Não se atribui essa implementação à presente correção nem se descreve o E2E de `71e3` como E2E completo de `868`.

O build remoto padrão de `868` ficou READY em `dpl_BpoNgEB6EYbysR5kxMkamiZXbV4L`, com Node24.x e alias staging corretos. Smoke autenticado Admin somente leitura de `868` passou às 20:51:03 UTC: preview 200/CONFERENCIA, dez cláusulas e oito pendências; PDF de prévia 200/99.451 bytes/`%PDF-`; Comercial para envio 404. Não houve movimento de card. Evidência privada `external-868-authenticated-readonly-smoke.json`. A revisão documental mantém runtime/dependências/testes iguais à base preservada; sua confirmação de READY/alias será registrada somente em evidência privada, sem novo commit recursivo.

### File List

Arquivos efetivamente criados/alterados pela equipe nesta entrega local:

- `docs/stories/story-crm-geracao-minuta-movimento-livre-20261021.md`
- `docs/architecture/crm-geracao-minuta-movimento-livre-20261021.md`
- `src/lib/bpm/transicao-command.ts`
- `src/lib/bpm/automacoes/eventos.ts`
- `src/lib/bpm/automacoes/central-runtime.ts`
- `src/lib/bpm/automacoes/orquestrador.ts`
- `src/lib/bpm/automacoes/minuta-movimento-livre.ts`
- `src/lib/bpm/automacoes/minuta-movimento-livre-server.ts`
- `tests/bpm/movimento-livre-command.test.ts`
- `tests/bpm/minuta-movimento-livre-sqlite.test.ts`
- `tests/bpm/minuta-movimento-livre-seguranca.test.ts` (ownership QA)
- `docs/reports/validacao-minuta-movimento-livre-staging-2026-10-21.md`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/journal.md`

## QA Results

Revisões por etapa abaixo. O parecer final de staging ao fim desta seção substitui as pendências históricas dos checkpoints anteriores.

### 2026-10-21 — Quinn / Sage, Probe, Anubis e Lens — GO local, publicação condicionada à integração concorrente

**Implementação congelada sobre `daf88fb7`: APPROVED.** Lens foi iniciado somente após o Forge completo PASS. Conferidos `forge/forge-result.json`, custódia e smoke do build: typecheck exit 0 (8,10 s), lint exit 0 (50,21 s; zero erros e 1.193 avisos existentes), build completo exit 0 (203,33 s), suíte global com cobertura exit 0 (187,36 s): **706 arquivos e 5.557 testes aprovados**, quatro skipped, um todo, zero falhas. Fingerprint `d55db46c02cecdac7af23f01d035628c15a6fbb0273c9450f8b640657f057080` idêntico antes/depois e após smoke. O smoke local compilado confirmou raiz/JavaScript/providers/sessão e proteção do CRM sem sessão; servidor encerrado. Fixtures SQLite privadas/sentinela local, token vazio, sem ambiente ou banco remoto. A contagem JSON de suites internas não é apresentada como quantidade de arquivos.

**Sage/Anubis:** acrescentados 55 testes independentes em `minuta-movimento-livre-seguranca.test.ts`, com classificador, schemas, gate causal e ownership reais. Cobrem estrutura integral do grafo, nós extras/inacessíveis, referência/ciclo/branch inválidos, parâmetros do gerador, JSON não-objeto, marcador antigo/forjado, histórico ausente ou de outro card/usuário/ação, discordância de origem/destino/versão/autoridade, família da chave causal, conta inativa, CRM/autoridade revogados e card fora do pipeline/etapa/status permitido. A primeira rodada teve somente fixture com alias de role inválido; corrigida para o papel canônico Admin, sem mudar o aplicativo. Logs iniciais preservados; rodada final e ESLint do arquivo passaram. Não foi substituído o ownership por um mock que concede acesso.

**Probe/Lens:** desenho arquitetural confrontado com código e testes; nenhum crítico/importante novo aberto. O comando emite marcador somente no evento novo de movimento livre autorizado, preserva supressão geral e usa IDs retornados pela transação. Após commit chama por import tardio o orquestrador estrito `cardId + eventoId`; falha documental não falseia o movimento confirmado. Materializador e worker repetem o classificador GERAR_CONTRATO→FIM, versão/regra/gatilho/condição, evento/histórico canônico e ator autorizado atual. Não executam nó extraído de grafo misto. A geração permanece no motor existente, com identidade BPM server-side e CONFERENCIA; não habilita card criado, campo alterado, envio/cadências, assinatura, pagamento ou NF. Menu, botões, rotas, permissões e schema não precisam de alteração.

| AC | Evidência local conferida |
| --- | --- |
| 1 / 6 | SQLite real Admin/líder gera um documento CONFERENCIA, anexo no card/campo corretos e identidade de empresa/BPM; Comercial continua pendente, sem tarefa prematura. |
| 2 / 4 | 55 adversários de proveniência/ACL e testes de revogação após enfileirar; marcadores antigos não ganham autoridade por replay. |
| 3 | Classificador usa schema central completo; fluxo misto, branch, espera, nó extra/inacessível ou parâmetros inválidos bloqueiam o grafo inteiro. |
| 5 | SQLite real cobre replay/reentrada/convergência concorrente por unicidade/claim/lease e erro do gerador sem minuta falsa. |
| 7 | Testes do comando preservam movimento livre, supressão e efeitos normais; sentinelas do flush e recuperação de filas preservadas. |
| 8 | Quatro gates, smoke e revisão locais PASS; integração concorrente, deploy e reteste autenticado de staging ainda necessários. |

**Isolamento da fila e achado resolvido:** os 33 cenários SQLite de backend incluem execução normal, lease ocupado, resgate do alvo e filas sentinela: pendências antigas do mesmo card, outros cards, grafos mistos e execuções legadas ficam intactos no flush documental. Claim e resgate excepcional usam o mesmo card/evento/versões elegíveis. QA identificou que uma primeira implementação também restringia o resgate das chamadas normais por card; o backend separou `escopoResgate` e adicionou caso real que mantém a recuperação global preexistente sem executar o outro card. Esse achado está resolvido na fonte que passou Forge; não se amplia a exceção para corrigir outros fluxos.

**Integração concorrente `bfff9d36`: GO condicionado a checks afetados, sem bloqueante semântico identificado.** Diff integral dos dez caminhos revisado: nenhum sobrepõe os onze desta feature; não altera Cards, transição, ownership, materializador, worker ou contratos. As alterações são projeção comercial de Instagram sem atribuição de marketing, remetentes NoLoss, testes e documentação. Esses scripts não são executados pela integração/publicação. Antes do push, preservar o novo commit remoto, provar os onze hashes da feature inalterados, executar typecheck/lint afetado e regressões direcionadas de Instagram/remetente/NoLoss/polling, movimento livre, minuta e geração de contrato. Gates próprios de bfff não são descritos como execução do novo conjunto; não há justificativa para repetir cegamente quatro gates se o delta permanecer disjunto e os checks passarem. DevOps deve receber ratificação após essas evidências e usar push normal, sem sobrescrever referências concorrentes.

**Limites:** o GO é exclusivamente para staging e não declara geração automática remota nem Done. O reteste deve criar nova negociação fictícia vinculada, entrar na etapa pela UI autenticada após READY/SHA/alias conferidos e comprovar minuta CONFERENCIA, reuso e ausência de verde/alerta prematuros, preservando a fixture documental anterior. Admin/líder locais não equivalem a credencial de líder exercitada remotamente. Não mover o card real relatado nem executar geração por CLI/worker global, backfill ou configuração publicada para fabricar evidência. Produção fora do escopo. Flux visual não se aplica: nenhum componente/rota pública ou dependência de UI foi criado; não se alega ganho de latência sem medida remota.

Evidências: `/var/tmp/alpha-crm-contrato-elaboracao-20261021/forge/forge-result.json`, `gate-tests.log`, custódias e `gate-runtime-result.json`; os 55 adversários estão em `/var/tmp/alpha-crm-minuta-movimento-livre-20261021/qa-seguranca.{log,json}`, com primeira rodada separada. CodeRabbit não disponível no caminho configurado; revisão independente foi o fallback. QA atualizou somente esta seção nesta revisão; nenhuma fonte, ambiente, dado remoto, Git ou outro teste foi alterado. Arquivo liberado ao executor para fechamento e integração.


### 2026-10-21 — Quinn — APPROVED final em staging

**Parecer: APPROVED no escopo da story; QA recomenda Done.** Integração concorrente e reteste remoto autenticado concluídos. O alias `staging.alpha-comex.com` foi conferido em READY no deployment `dpl_2eyf3ifNfvM587DptJ7wacBUGMob`, custom environment `staging`, runtime `71e3f06fed6890ef346ead946711ea37bcdc4fd3`. Nenhuma publicação em produção integra este parecer.

**Integração ratificada:** a prova de merge preserva os nove arquivos de runtime/testes da minuta byte a byte do commit `55183c0a`, os onze caminhos da feature e os dez caminhos concorrentes de `bfff9d36`, sem conflito. O conjunto integrado passou typecheck oficial, lint dos três fontes e Apps Script via stdin e **158 testes em onze arquivos**, com fingerprint combinado `38bf3c61b6d0aacc00de95e79989286a0aff8584cf94be04825d6fefec7f22a6` inalterado. A tentativa anterior do wrapper de typecheck com 4 GiB terminou por OOM operacional e foi preservada; o comando oficial com 8 GiB passou na mesma fonte. Os quatro gates globais e smoke anteriores permanecem aplicáveis pela custódia conferida; não se apresenta o delta direcionado como nova suíte global.

**Geração real pela UI:** Admin autenticado entrou pela primeira vez em Elaboração de contrato na negociação fictícia da empresa 3067, Financeiro `cmvikcyuc000408lh12sidz07`, vinculada ao Comercial `cmvik1dca000007lbpk109m6s`. Histórico e evento corroboram ator, movimento livre, etapa/versão e marcador servidor. A automação concluiu com uma tentativa, gerou **um documento CONFERENCIA e um anexo** no card/campo financeiro corretos. A prévia autenticada retornou HTTP 200, dez cláusulas e oito pendências; o PDF de conferência retornou HTTP 200, 99.452 bytes e assinatura `%PDF-`. Isso não equivale a PDF final persistido: o documento continuou não finalizado, com `finalizadoEm` nulo.

**Reentrada e isolamento:** a sequência Elaboração → Novo contrato → Elaboração manteve o mesmo documento `cmviktr2x000707l3k2sp5rz9` e anexo `cmviktr3u000i07l3s8l2ie5v`; a ação de reentrada retornou `existente: true`. Há **três registros de execução**: dois SUCESSO, cada um com uma tentativa, e um IGNORADA, com zero tentativas e zero steps, ao sair da etapa documental (`DESTINO_DOCUMENTAL_DIVERGENTE`). Não houve duplicação. A prova final tem quinze asserts verdadeiros; a primeira versão do verificador exigia incorretamente dois registros totais, foi corrigida apenas na evidência e preservada como `reentry-proof-initial-cardinality-draft.json`, sem nova query ou mudança no runtime. A comparação independente confirmou Comercial inalterado, mesmos vínculos e metadados do documento/anexo; as duas fixtures anteriores da empresa 3066 permaneceram iguais em comparação profunda e hash.

**Prontidão preservada:** Comercial exibiu envio pendente, “Sendo preparado pelo Financeiro” e assinatura pendente. A rota Comercial de documento para envio permaneceu HTTP 404 e a consulta autenticada de alertas não encontrou alertas desses dois cards. Não foram preenchidos estados de assinatura, pagamento ou NF; cards permaneceram ATIVO, sem conclusão financeira. Assim, gerar minuta não antecipou a disponibilidade reservada à finalização financeira com conferência.

**Limites e observações:** o teste remoto exerceu Admin, primeira entrada e reentrada; líder, revogação, grafos adversariais e concorrência permanecem cobertos pelos testes locais, sem alegação de exercício remoto. Não houve finalização, assinatura, pagamento, NF, envio externo, backfill ou mudança no card real relatado. A instrumentação SELECT-only não fez writes nem invocou worker; as ações ocorreram pelo CRUD normal da UI, incluindo sua orquestração por card. Não se declara navegador sem erros: houve 503 periférico de voz, bloqueio de geolocalização por policy, aviso Radix de descrição e doze requests `net::ERR_ABORTED` durante navegação/reload. As ações documentais tiveram sucesso, sem nova falha da automação demonstrada. Os tempos observados de entrada/reentrada (22.634/18.624 ms) incluem UI e atualização, sem atribuição exclusiva ao backend ou alegação de ganho percentual.

Evidências privadas conferidas em `/var/tmp/alpha-crm-contrato-elaboracao-20261021/`: `release/merge-bfff-proof.json`, `release/delta-bfff-result.json`, `release/aliases-minuta-ready.json`, `release/smoke-minuta-ready.json`, `first-generation-evidence.json`, `first-entry-proof.json`, `final-generation-evidence.json`, `reentry-proof.json`, `draft-ui-proof.json`, `commercial-ui-proof.json` e `remote-browser-result.json`. Dados brutos não foram copiados para o repositório. Nesta conclusão QA alterou somente QA Results; fonte, testes, ambiente, banco e Git não foram modificados. **Arquivo liberado ao executor para fechamento documental.**

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-21 | 0.1 | Story corretiva: minuta automática em novos movimentos livres com exceção documental estrita, sem antecipar prontidão e somente staging. | River (`@sm`) |
