# Alpha Catcher — importação e enriquecimento de empresas

Status: Ready for Review — CAPTCHA implementado, validação global parcial
Responsável pela story: PO (Pax). Implementação: Codex.

## Pedido
Criar Alpha Catcher em Leads & Marketing com o design da Consulta Radar,
adaptando `/home/ialpha/projetos/alpha-comex/API/app-teste-cnpj` para salvar
empresas novas em `consultas_radar`.

## Critérios de aceite
- [x] ReceitaWS comercial com token server-side, limite de 50/min compartilhado e opção de reversão para API pública.
- [x] Chamar Radar somente após validar ReceitaWS; falhas cadastrais não fazem consulta Radar.
- [x] Escolher idade máxima dos dados na UI/CLI, padrão 30 dias, zero/atalhos/valor personalizado validados no servidor.
- [x] Reutilizar sessão por conta, validando acesso real ao Shipment Intel antes de dispensar Gmail/OTP; sessão rejeitada retorna ao login completo.
- [x] Desativar reutilização e restaurar o worker anterior com backup, sem migration ou gravações de empresas durante a validação.
- [x] Checar requisito CAPTCHA no backend; pausar com botão de abrir login oficial, confirmar resolução e tentar novamente; continuar só após validação.
- [x] Checagem automática durante espera, estados explícitos para falha/não confirmado, sem tratar erro como CAPTCHA liberado nem compartilhar sessão entre origens.
- [x] Botão de importação automática: login, Gmail OTP, Shipment Intel, coleta e processamento na UI; manter JSON manual.
- [x] Proteção por permissão, proprietário da execução e bloqueio de logins simultâneos; segredos somente no servidor.
- [x] Menu em Leads & Marketing, página e endpoint com permissão alphaCatcher.
- [x] Importar JSON `{ empresas: [{ cnpj, consignatario }] }`, contar inválidos e duplicados.
- [x] Consultar o banco antes das APIs; preservar empresas existentes inclusive em concorrência.
- [x] ReceitaWS e Radar no servidor; salvar apenas combinação válida. 404 Radar é ausência de resultado, sem inventar habilitação.
- [x] Limitar chamadas da ReceitaWS no mesmo processo conforme o modo/plano, sem espera fixa adicional do Radar; falhas pendentes e tokens privados.
- [x] UI Radar com indicadores, monitor, pausa/retomada, cancelamento, repetição das pendências e exportação JSON.
- [x] Núcleo utilizável via CLI; testar sem consultas externas nem gravações reais.
- [x] Executar lint, typecheck, testes e build, registrando limitações.

## Blueprint Scout
Criar domínio `src/lib/alpha-catcher/{core,service,access}.ts`, API
`src/app/api/alpha-catcher/route.ts`, página e client em
`src/app/PainelAlpha/AlphaCatcher/`, CLI `scripts/alpha-catcher.mts` e testes.
Editar `src/lib/modulos-registry.ts` (menu e permissão derivada pelo registro).
Reutilizar RadarBackground, CardComScan, Prisma, consultarRadar e parseDateBR.
Sem migration, alteração de schema, backfill ou execução de importação real.
Gravação CRUD individual apenas por processamento explicitamente iniciado.

## File List
- docs/stories/story-alpha-catcher.md
- src/lib/modulos-registry.ts
- src/lib/alpha-catcher/core.ts
- src/lib/alpha-catcher/service.ts
- src/lib/alpha-catcher/access.ts
- src/app/api/alpha-catcher/route.ts
- src/app/PainelAlpha/AlphaCatcher/page.tsx
- src/app/PainelAlpha/AlphaCatcher/CatcherClient.tsx
- scripts/alpha-catcher.mts
- tests/alpha-catcher/core.test.ts
- tests/alpha-catcher/service.test.ts
- tests/alpha-catcher/api.test.ts
- tests/alpha-catcher/access.test.ts
- docs/alpha-catcher.md
- .bibble/memory/codebase-map.md
- .bibble/memory/integration-points.md
- src/lib/alpha-catcher/logcomex-input.ts
- src/lib/alpha-catcher/logcomex-job.ts
- src/app/api/alpha-catcher/logcomex/route.ts
- scripts/alpha-catcher-logcomex.mjs
- tests/alpha-catcher/logcomex-api.test.ts
- tests/alpha-catcher/logcomex-job.test.ts
- scripts/alpha-catcher-captcha.mjs
- tests/alpha-catcher/captcha.test.ts
- tests/alpha-seo/integration-wiring.test.ts
- scripts/deploy-staging-release.sh
- scripts/activate-alpha-catcher-stage.sh
- scripts/alpha-catcher-session.mjs
- scripts/deploy-alpha-catcher-session.sh
- tests/alpha-catcher/session.test.ts
- src/lib/cnpj/receitaws.ts
- src/lib/cnpj/receita-federal.ts
- src/app/api/ConsultaCompleta/route.ts
- tests/alpha-catcher/receitaws.test.ts
- tests/pre-analise/receita-federal.test.ts
- tests/radar/consulta-completa.test.ts
- .env.example

## Validação
ReceitaWS comercial e dias na UI (2026-10-06): centralizada em
`src/lib/cnpj/receitaws.ts`, token no header Bearer, days/fallback configuráveis,
HTTP cache desativado, timeout 65s, rate control global por token/processo.
50/min com espaçamento conservador 1300ms; pública 3/min. 429 do provedor
bloqueia novas requisições conforme Retry-After; 402/autenticação interrompem
fila com mensagem segura. Alpha Catcher e Consulta Completa validam Receita
antes do Radar. Consulta Completa agora exige acesso tributário autenticado
antes de utilizar cota. Comercial não faz downgrade silencioso para fonte pública.
UI: zero, 7/15/30/60/90/180/365 dias e personalizado; aplica a empresas novas,
sem sobrescrever registros existentes. Dias por requisição prevalecem sobre env,
política registrada no JSON existente, CLI `--days N`; sem mudança de schema.

109 testes em 11 suítes específicos passaram. Global Node 22: 4257 passaram,
duas falhas preexistentes no Builder, 4 skipped e 1 todo. Lint sem erros,
1191 warnings preexistentes; typecheck aprovado antes do build. Token validado
com GET account/quota (HTTP 200), sem consultas CNPJ ou gravações. Build e
publicação em preparação.

Sessão reversível (2026-10-06): cookies, localStorage, IndexedDB e sessionStorage
salvos por conta (SHA-256), fora do Git, diretório 700 e arquivo 600, troca
atômica e validade local de 24 horas. Sessão reutilizada só é aceita após obter
credenciais BI em resposta bem-sucedida. Falha fecha contexto e invalida cache
antes de voltar ao login completo. Falhas de cache não interrompem importação.
CLI enable/disable consulta marcador a cada job; env `LOGCOMEX_SESSION_REUSE=false`
também desativa. Script de instalação guarda backup e permite rollback.
Mudança apenas nos scripts carregados por job, sem novo build Next necessário.

67 testes Alpha Catcher aprovados (11 novos), incluindo expiração, outra conta,
corrupção/permissões, estado por origem, falha BI/persistência e CLI reversível.
Suíte global com Node 22 fora do sandbox: 573 arquivos passaram, 1 falhou;
4223 testes passaram, 2 falharam em Builder (URL absoluta/relativa preexistente),
4 skipped e 1 todo. Sem login real, acesso Gmail ou importação de empresas.
Cópia temporária do candidato anterior removida após publicação: duplicava
fontes nos gates globais. Lint final: 0 erros/1191 warnings preexistentes;
typecheck final aprovado. Lint específico e sintaxe dos scripts aprovados.
Publicado no staging em 2026-10-06 após execução administrativa pelo usuário.
Ambos os scripts na release ativa são idênticos aos validados; backup do worker
anterior presente em diretório 700/root. Serviço continua active (sem reinício),
HTTPS 200. Diretório de segredos pertence a ialpha e permite criar cache privado.
Primeira importação fará login e salvará a sessão; reutilização real ainda
depende de teste do usuário com Logcomex. Nenhum login/importação foi iniciado
na verificação administrativa.

Preparação de publicação (2026-10-05): o serviço de stage usava a release
`20261005-200626`, sem a API automática. Candidato isolado preparado em
`tmp/alpha-catcher-stage-candidate`, build `zRGxCxf8vHCjxk-PFbNv2`;
login HTTP 200 e POST Logcomex sem sessão HTTP 401 na porta temporária 3315.
Servidor temporário encerrado. Caminhos absolutos das dependências Logcomex
adicionados apenas ao ambiente do candidato; credenciais originais preservadas.
Script de ativação verifica build, smoke e saúde, com rollback automático.
Ativação executada pelo usuário com sudo: release `20261005-211433-alpha-catcher`
publicada, serviço active/running às 21:14:40 UTC. Verificação final pelo domínio:
login HTTP 200 e API automática sem sessão HTTP 401; build ativo corresponde ao
candidato e chunk publicado contém o botão de importação automática. Porta
temporária 3315 encerrada. Removida dependência de rg no script de ativação,
pois o PATH do sudo não o disponibiliza; sondagens de inicialização silenciosas.

Cadastro individual do Painel Alpha no Alpak corrigido para porta fixa 3300,
URL `https://stagepainel-alpha.alpak.ai/` e ambiente stage. Túnel já apontava
para 3300; HTTPS respondeu 200. Sem migration ou importação de empresas.

Typecheck passou; lint: 0 erros, 1191 warnings. Suíte global com Node 22 do
serviço: 572 arquivos passaram, 1 falhou; 4212 testes passaram, 2 falharam,
4 skipped e 1 todo. Falhas restantes em `tests/builder/embed.test.ts`
(URL absoluta versus relativa), fora do escopo. Os 56 testes Alpha Catcher
passaram. Teste de integração Alpha SEO ajustado para verificar presença
comercial sem exigir ser o primeiro módulo após adicionar Alpha Catcher.
Autorização Gmail não encontrada no diretório padrão do usuário ialpha;
não houve login real ou tentativa de autorização interativa.

Atualização após liberação de leitura do `.env` pelo usuário: `npm run build`
concluiu com exit 0 fora do sandbox. Compilação, geração das 79 páginas e traces
finalizados; rota AlphaCatcher e endpoints incluídos. O bloqueio de build descrito
abaixo é histórico e está resolvido. Sem publicação ou teste real de login/CAPTCHA.

24 testes em quatro suítes passaram com aliases existentes e `envDir:false`
em configuração temporária para não carregar credenciais. Lint específico passou.
CLI de inspeção executado com JSON de exemplo (1 empresa), sem banco ou APIs.
`npm run typecheck` passou. Lint global: 0 erros, 1191 warnings fora do escopo.
`npm test` falhou no startup por EACCES de `.env`, também fora do sandbox.
Build inicial bloqueado por permissões Prisma; fora do sandbox compilou/gerou
páginas, mas falhou no trace final por EACCES de `.env`. Sem aprovação global completa.

Servidor local iniciou na porta 3109; POST sem sessão retornou 401, sem
processar empresa. Fluxo autenticado em navegador, consultas externas e gravações
reais não executados. Servidor de smoke encerrado após verificação.

## Limitações
CAPTCHA: 56 testes em sete suítes passaram. Checagem no endpoint da conta,
polling a cada oito segundos, confirmação/retry via IPC sem iniciar nova coleta.
Desafio visível no contexto backend fecha esse contexto e exige confirmação
humana antes de novo login. Não há leitura/transferência da sessão da aba externa.
Sequência real de liberação por conta/IP ainda não validada; nenhuma conta foi
acessada nem CAPTCHA resolvido nesta sessão. Guia explica esse limite.
Lint específico sem erros/warnings; lint global com 0 erros/1191 warnings.
Typecheck final passou antes do build. Scripts passaram em `node --check`.
`npm test` voltou a falhar no startup por EACCES de `.env`, fora do sandbox;
testes específicos passaram com configuração sem carregamento de credenciais.
Build compilou e gerou páginas, mas falhou na finalização pelo mesmo EACCES.
Sem aprovação dos gates globais completos nem teste humano de CAPTCHA real.

Ampliação Shipment Intel: 39 testes em seis suítes aprovados; módulos de Gmail,
OTP, captura BI e coletor carregados sem login real. Worker usa o pacote original
para Gmail/config e o fork existente para resolver a referência quebrada ao
coletor. Não houve login real, leitura de e-mail ou importação de empresas reais.
Automação requer Chromium e Gmail autorizado/credenciais legíveis pelo serviço.
Jobs são locais em memória e exigem instância Node persistente, conforme guia.
Lint específico sem erros/warnings, lint global com 0 erros/1191 warnings.
Typecheck passou após finalizar a regeneração de `.next` pelo build. A tentativa
concomitante anterior falhou com TS6053 por arquivos `.next/types` em regeneração;
resolvida pela repetição sequencial, sem mudança de configuração. Build compilou
e gerou páginas, mas falhou no trace por EACCES de `.env`; testes globais
continuam bloqueados no startup pelo mesmo arquivo, inclusive fora do sandbox.

Fila na memória da página; pausa/cancelamento deixam concluir a consulta em curso.
Admissão por processo Node, sem coordenação entre réplicas, CLI, Radar legado
ou clientes externos. CNPJ alfanumérico não é suportado pela API Radar atual.
Não houve migration nem concessão de acesso; para não administradores é preciso
atribuir `alphaCatcher` pelos mecanismos de permissão existentes.
Documentação operacional: `docs/alpha-catcher.md`.

## Ampliação dos filtros Logcomex (2026-10-06)

- [x] Embarques mínimos/máximos digitáveis, validados antes de iniciar login.
- [x] Calendário: dois cliques no mesmo dia selecionam um dia; dias diferentes selecionam intervalo inclusivo.
- [x] Atalhos de três/seis meses anteriores à data selecionada, incluindo-a.
- [x] Ranking e perfis recebem exatamente o intervalo escolhido.
- [x] Executar lint, typecheck, testes e build; registrar resultados.

Blueprint: editar CatcherClient, logcomex-input, API Logcomex e worker; criar
CalendarioColeta e scripts/alpha-catcher-filters.mjs, com testes de período e filtros.
Menu/permissões permanecem no registry existente; nenhuma rota ou banco novo.

Arquivos desta ampliação: CatcherClient.tsx, CalendarioColeta.tsx,
logcomex-input.ts, API alpha-catcher/logcomex/route.ts,
alpha-catcher-logcomex.mjs, alpha-catcher-filters.mjs,
tests/alpha-catcher/{calendario,logcomex-filters,logcomex-api}.test.ts,
docs/alpha-catcher.md e mapas .bibble/memory.

Validação: 127 testes focais passaram; inclui cliques reais no calendário,
seleção inversa, intervalo entre meses, ano bissexto e payload de ranking/perfil.
Typecheck passou; lint global sem erros (1191 warnings preexistentes).
Suíte global: 4272 passaram, duas falhas preexistentes no Builder;
os três testes de calendário adicionados depois passaram com a config global.
Sem login Logcomex, consultas de empresas ou escrita real no banco.

Build concluído com sucesso: `YMHYjGIV_MghrGLdKkFxh`. Candidato atualizado
em `/tmp/alpha-catcher-receitaws-candidate`; publicação depende de sudo.

## Ajuste visual e alternância dos atalhos
- [x] Dias e atalhos ativos usam o tema Alpha recebido do CatcherClient.
- [x] Atalho ativo desmarca a janela ao clicar novamente, preservando o dia de referência.
- [x] Validar lint, typecheck, testes e build.
Arquivos: CalendarioColeta.tsx, CatcherClient.tsx e calendario.test.ts.

Ajuste de tema: quatro testes de calendário aprovados, incluindo alternância
entre janelas e retorno ao dia de referência. Lint global: zero erros e
1191 warnings preexistentes; typecheck aprovado. Suíte global: 4276 testes
aprovados, duas falhas preexistentes em tests/builder/embed.test.ts.

Build de tema concluído: `xR4kkEmX45nvTuhmLPagE`. Release candidata atualizada; ativação
no staging ainda exige sudo do operador.

## Ordenação dos resultados
- [x] Ordenar por empresa, CNPJ, processamento, situação Radar, modalidade e localidade.
- [x] Direções crescente/decrescente e retorno à ordem de importação.
- [x] Ordenação aplicada após filtro e antes da paginação; troca volta à página inicial.
- [x] Dados ausentes permanecem ao final; não alterar a fila de processamento.
- [x] Validar lint, typecheck, testes e build.
Blueprint/arquivos: CatcherClient.tsx, src/lib/alpha-catcher/resultados.ts,
tests/alpha-catcher/resultados.test.ts e docs/alpha-catcher.md.
Permissão, registry/menu, APIs e banco existentes permanecem como integração.

Ordenação: quatro testes específicos aprovados (acentos/empates, vazios,
fila preservada e paginação). Typecheck e lint aprovados, com 1191 warnings
preexistentes. Suíte global: 4280 passaram e duas falhas preexistentes no Builder.

Build concluído com sucesso: `fkYmoOJRbWLsxO81NGdJr`.
Candidato atualizado em /tmp/alpha-catcher-receitaws-candidate; ativação via sudo.

## Limite opcional de empresas
- [x] Zero é o padrão e coleta sem limite de quantidade.
- [x] Valores positivos limitam a coleta; negativos/fracionários são rejeitados.
- [x] Resultados automáticos acima de 10 mil entradas são aceitos.
- [x] Validar lint, typecheck, testes e build.
Arquivos: logcomex-input.ts, CatcherClient.tsx, alpha-catcher-logcomex.mjs,
core.ts, logcomex-job.ts, testes logcomex-api/job/filters e guia alpha-catcher.md.

Coleta ilimitada: typecheck aprovado; suíte global com 4284 testes aprovados
e duas falhas preexistentes no Builder. Smoke com o coletor original e APIs
simuladas confirmou todas as três páginas em modo ilimitado e parada em duas
empresas com limite positivo. Sem login ou importação real.

Lint sem erros (1191 warnings preexistentes); build concluído: `Z4J2Y8q9_9Hta41Knk6Af`. Candidato atualizado; ativação via sudo.

## JSON sem limites de tamanho ou quantidade
- [x] Remover limites de 5 MB e 10 mil entradas da UI, domínio e CLI.
- [x] Preservar validação de JSON/CNPJ e remoção de duplicados.
- [x] Validar lint, typecheck, testes e build.
Arquivos: core.ts, CatcherClient.tsx, alpha-catcher.mts, logcomex-job.ts,
core.test.ts e docs/alpha-catcher.md.

JSON sem limites: teste e CLI de inspeção com arquivo acima de 5 MB e
12 mil entradas aprovados (uma empresa, 11999 duplicados). Typecheck
aprovado; suíte global com 4285 aprovados e duas falhas preexistentes no Builder.
Sem consultas externas ou gravações reais nesta verificação.

Build concluído: `KwknbbuTk1M9pp0mYBiQO`; lint aprovado sem erros
(1191 warnings preexistentes). Candidato atualizado; ativação via sudo.

Ajuste de texto: removida a frase sobre ausência de limites da descrição de
importação JSON em CatcherClient.tsx, conforme pedido do usuário.

Texto removido: lint e typecheck aprovados; build concluído `3gl_X3to8ro19779H_H3P`. Candidato atualizado.
Suíte global mantém duas falhas conhecidas no Builder; teste de tarefas sofreu
leitura durante regeneração Prisma e foi repetido após o build.

## Data máxima da coleta
- [x] Calendário permite selecionar no máximo hoje menos sete dias (São Paulo).
- [x] Período padrão e atalhos respeitam esse limite.
- [x] API rejeita datas futuras e os seis dias mais recentes antes do login.
- [x] Validar lint, typecheck, testes e build.
Arquivos: logcomex-input.ts, CalendarioColeta.tsx, CatcherClient.tsx, API
Logcomex, testes calendario/logcomex-filters/logcomex-api e guia.

Datas: 40 testes focais aprovados, incluindo fronteira do dia de São Paulo,
limite inclusivo, dias bloqueados e rejeição antes do login. Typecheck passou.
Suíte global: 4290 aprovados e duas falhas preexistentes no Builder.

Build concluído: `lXI2b7SE81XvnBY5Fwklg`. Lint aprovado com zero erros
e 1191 warnings preexistentes. Candidato atualizado para ativação via sudo.

## Diagnóstico de coleta parcial sem resultados
Relato: limite 100, nenhuma empresa exibida. Causa real não identificável pela
mensagem genérica atual.
- [x] Worker publica contagens e códigos seguros de falha.
- [x] Job diferencia ranking, perfil, paginação, timeout e HTTP sem mensagens livres.
- [x] Preservar resultados válidos e processamento manual de coleta parcial.
- [x] Validar lint, typecheck, testes e build.
Arquivos: scripts/alpha-catcher-diagnostic.mjs, alpha-catcher-logcomex.mjs,
logcomex-diagnostic.ts, logcomex-job.ts e testes de diagnóstico/job.

14 testes focais aprovados, incluindo propagação worker/job e proteção de
segredos. Typecheck aprovado. A falha real relatada exige nova tentativa
autenticada com diagnóstico; não foi declarada corrigida sem evidência.

Build concluído: `l5oS2JFTGc2Dta5n0pRXe`; lint zero erros,
1191 warnings preexistentes. Global: 4295 aprovados e duas falhas conhecidas no
Builder. Candidato atualizado; precisa ativar e repetir coleta para causa real.

## Investigação HTTP 406 no ranking
Evidência: usuário informou HTTP 406, zero páginas e empresas, limite 100.
- [x] Comparar filtros originais e adaptados no código; sem diferença estrutural além das datas.
- [x] Preparar diagnóstico somente leitura usando sessão existente, sem login/Gmail, ReceitaWS, Radar ou banco.
- [ ] Obter resposta real do provedor para filtros originais/exatos/sem faixa e corrigir a causa confirmada.
Arquivos: scripts/diagnose-alpha-catcher-logcomex.{mjs,sh}.
Node/bash check aprovados. Execução como ialpha bloqueada por sudo exigindo
autenticação interativa; operador precisa executar o diagnóstico no servidor.
Sessão privada não foi lida nem permissões alteradas.

## Diagnóstico sem sessão restaurável
Relato: CLI encerrou com sessão existente indisponível.
- [x] Mostrar cache habilitado/vigente e etapa de restauração.
- [x] Opção --login utiliza o worker real e encerra após comparar ranking.
- [x] Comparar filtro original, período escolhido, três meses e ausência de faixa.
- [x] Não consultar ReceitaWS/Radar nem gravar empresas; proteger segredo na saída.
- [ ] Validar lint, typecheck e testes; aguardar causa real do 406.
Arquivos: diagnose-alpha-catcher-logcomex.mjs, alpha-catcher-ranking-probe.mjs,
alpha-catcher-logcomex.mjs e ranking-probe.test.ts. Node checks e teste
de comparação/redação de credenciais passaram; nova tentativa exige sudo.

Diagnóstico --login: typecheck aprovado; lint sem erros (1191 warnings
preexistentes); suíte global com 4297 aprovados e duas falhas conhecidas no
Builder. Scripts do candidato atualizados; não requer rebuild/reinício para
executar o diagnóstico pelo workspace. HTTP 406 permanece sob investigação.

## Falha do diagnóstico na abertura do Shipment
Login atingiu OTP e etapa shipment; falhou antes de comparar ranking.
- [x] Escopar botão Acessar ao card Shipment Intel quando houver vários.
- [x] Diagnóstico seguro de respostas BI, headers ausentes e falhas de rede.
- [x] Separar preparação do diagnóstico de captura BI; mostrar código seguro.
- [ ] Validar testes/lint/typecheck e repetir diagnóstico real.
Arquivos: alpha-catcher-shipment.mjs, worker e CLI diagnóstico, teste shipment.
Causa real do HTTP 406 ainda não confirmada; ajuste cobre ambiguidade potencial
sem declarar que ela ocorreu na tentativa relatada.

Abertura Shipment: quatro testes focais aprovados; lint sem erros (1191
warnings preexistentes), typecheck aprovado. Global: 4300 testes aprovados,
duas falhas conhecidas no Builder. Candidato com scripts atualizado.
CLI usa scripts do workspace, portanto não exige publicação ou reinício
para repetir o diagnóstico. Falha HTTP 406 ainda sem causa real confirmada.

Diagnóstico CAPTCHA: CLI não tinha confirmação humana após desafio visível
no login. Adicionada confirmação por Enter via mesmo IPC confirmar_captcha;
continuação depende da checagem real do provedor. Node check e testes CAPTCHA
executados; causa HTTP 406 continua pendente da comparação real.

## Produto BI capturado divergente do identificador legado
Evidência do usuário: resposta BI HTTP 200, headers presentes, produtoDiferente=1.
O capturador original descartava qualquer product-signature diferente de
bi-importacao e o cliente reescrevia esse mesmo valor em todas as consultas.
- [x] Capturar produto observado em resposta aceita do domínio oficial e conta correta.
- [x] Preservar esse header em ranking/perfis, mantendo domínio e autenticação.
- [x] Diagnóstico compara header legado e produto real antes de avaliar período.
- [ ] Validar testes/lint/typecheck e obter resposta real do ranking.
Arquivos: alpha-catcher-bi.mjs, worker, CLI diagnóstico, ranking-probe,
shipment e testes bi/ranking-probe. Não modifica automação externa.

Produto BI: sete testes focais aprovados; typecheck passou. Global: 4303
aprovados, duas falhas conhecidas no Builder. Lint sem erros; warning novo
do helper corrigido e lint focal repetido. Scripts candidatos atualizados;
CLI atualizado pode ser executado sem publicação/reinício. Necessária
validação real do ranking antes de declarar o HTTP 406 resolvido.

## Homologação do ranking (usuário, 2026-10-06)
Diagnóstico autenticado concluiu com produto plataforma-bi. Cinco cenários
retornaram HTTP 200, formato válido e 100 empresas: header legado, produto
capturado, seis meses exatos com faixa 1–2, três meses e período sem faixa.
Não se confirmou restrição de seis meses nem causalidade do header no 406
anterior. Captura corrigida validada na sessão nova; importação completa com
perfis e enriquecimento ainda precisa ser testada no painel.
Candidato contém capturador BI novo e preservação do produto; build existente
l5oS2JFTGc2Dta5n0pRXe permanece válido (mudanças em worker carregado em runtime).
Ativação pronta via activate-alpha-catcher-stage.sh; exige autenticação sudo.

## 406 persistente no painel após diagnóstico HTTP 200
Release corrigida ativa 20261006-180836, confirmada pelo código do worker.
Diagnóstico iniciou por bi-importacao; coletor iniciava por plataforma-bi.
- [x] Alinhar primeiro request à assinatura bi-importacao que retornou HTTP 200.
- [x] Após 406, comparar apenas uma vez o produto capturado, mantendo filtros.
- [x] Sessão restaurada exige ranking válido antes de dispensar login completo.
- [x] Reutilizar a primeira página validada, evitando consulta duplicada.
- [ ] Validar testes/lint/typecheck e nova importação real.
Arquivos: alpha-catcher-bi.mjs, alpha-catcher-logcomex.mjs, bi.test.ts.
Causa anterior do 406 não declarada comprovada; corrige diferenças observadas
entre diagnóstico e fluxo real e validação insuficiente da sessão salva.

406 real: usuário confirmou os mesmos filtros (29/03–29/09, 1–2, limite100).
21 testes focais passaram; lint/typecheck aprovados, lint focal repetido
após ajuste do diagnóstico. Global: 4309 aprovados e duas falhas conhecidas
no Builder. Scripts candidatos atualizados para ativação. Validação da
importação real continua pendente; nenhuma consulta externa ou escrita nesta
verificação local. Build Next existente válido; alterações no worker runtime.

## Coleta com progresso e enriquecimento simultâneo
- [x] Calcular total pela primeira/última página em paralelo (limite0), sem bloquear perfis.
- [x] Publicar progresso de páginas/perfis e cada CNPJ obtido pelo worker.
- [x] Exibir barras separadas para coleta e consultas.
- [x] Fila dinâmica consulta ReceitaWS seguida de Radar enquanto coleta segue.
- [x] Preservar resultados/estados e evitar duplicação ao receber snapshots.
- [x] Pausa, interrupção, rate limit e encerramento de coleta não perdem a fila.
- [x] Validar lint, typecheck, testes e build.
Blueprint: criar alpha-catcher-stream.mjs, logcomex-progress.ts e helper fila;
editar worker, logcomex-job.ts e CatcherClient; testes stream.test.ts, client-stream.test.ts e logcomex-job.test.ts.
Menu, permissões e banco existentes; sem migration/mutação em massa.

Validação 2026-10-06: streaming publica par antes de completar ranking; falha
na descoberta paralela permite retry normal. UI inicia consulta enquanto job
executa, preserva estado salvo no snapshot final e respeita pausa sem parar
recepção. Serviço mantém verificação no banco antes de ReceitaWS e Radar.
Typecheck aprovado; lint global zero erros/1191 warnings anteriores. Global
4314 aprovados, duas falhas anteriores em tests/builder/embed.test.ts
(URL absoluta do DOM vs relativa esperada). Teste adicional de pausa aprovado.
Build CgRKpAYNv1amTWeI6LwLy aprovado. Candidato atualizado em
/tmp/alpha-catcher-receitaws-candidate. Smoke local login200 e ambas APIs401
sem sessão; servidor temporário encerrado. Não consultou provedores reais
nem escreveu no banco nesta validação. Ativação exige sudo do operador;
homologação real da nova coleta ainda pendente.
File list adicional: scripts/alpha-catcher-stream.mjs,
scripts/alpha-catcher-logcomex.mjs, src/lib/alpha-catcher/logcomex-progress.ts,
src/lib/alpha-catcher/fila.ts, src/lib/alpha-catcher/logcomex-job.ts,
src/lib/alpha-catcher/logcomex-diagnostic.ts,
src/app/PainelAlpha/AlphaCatcher/CatcherClient.tsx,
tests/alpha-catcher/stream.test.ts, tests/alpha-catcher/client-stream.test.ts,
tests/alpha-catcher/logcomex-job.test.ts, docs/alpha-catcher.md.

## Data original de inclusão nos resultados
Requisito: mostrar a data da consulta (inclusão em consultas_radar) também
para empresas existentes e nunca substituí-la pela data de uma nova tentativa.
- [x] Retornar data_consulta do registro lido/criado como dataConsulta ISO.
- [x] Exibir coluna Data da consulta em horário America/Sao_Paulo.
- [x] Testar data existente, create e conflito concorrente sem atualização.
- [x] Validar lint/typecheck/testes/build e atualizar candidato stage.
File list: core.ts, service.ts, resultados.ts, CatcherClient.tsx,
service.test.ts, resultados.test.ts, client-stream.test.ts, docs/alpha-catcher.md.
Sem mudança de schema ou backfill; data_consulta já tem default(now()).

Validação: testes de serviço, formatação e UI aprovados; entrada com outra
data não altera registro existente, create usa data do banco, conflito
concorrente retorna data original. Snapshot final preserva data na tela.
Typecheck aprovado e lint zero erros (1191 warnings anteriores). Global 4317
aprovados, duas falhas anteriores Builder URL absoluta vs relativa.
Build 44gpkJ6-gvZd1FDEotgyN aprovado; candidato /tmp/alpha-catcher-receitaws-candidate
atualizado. Publicação exige sudo; nenhuma consulta real ou gravação no banco.

## Data primeiro e ordenação nos títulos
- [x] Colocar Data da consulta na primeira coluna, com a célula correspondente.
- [x] Substituir Ordenar por/Direção por títulos clicáveis com alternância asc/desc.
- [x] Ordenar datas cronologicamente; ausentes ao final; manter paginação e fila.
- [x] Indicar direção ativa e aria-sort; preservar acesso à ordem de importação.
- [x] Validar lint/typecheck/testes/build e atualizar candidato.
File list: CatcherClient.tsx, resultados.ts, resultados.test.ts,
client-stream.test.ts, docs/alpha-catcher.md. Sem alteração de banco.

Validação: nove testes focais aprovados, Typecheck aprovado, lint sem erros
(1191 warnings anteriores). Global 4318 aprovados e duas falhas anteriores
Builder (URL absoluta vs relativa). Build 7xHxqjy-_vQ-kJpb_6IJZ aprovado. Candidato
/tmp/alpha-catcher-receitaws-candidate atualizado; ativação sudo pendente.
Não altera datas/registro, apenas apresentação e ordenação em memória.

## Colunas cadastrais dos resultados
- [x] Exibir Data da consulta, CNPJ, Empresa / consignatário, Processamento,
      Situação Radar, Modalidade, UF, Município, Regime tributário, Data da opção.
      Refinamento do usuário: manter Processamento logo após Empresa.
- [x] Retornar regime_tributario, optante_simples e data_opcao do banco.
- [x] Data da opção somente para Simples; ordenar títulos incluindo novos campos.
- [x] Preservar data de inclusão, fila, status e acesso às pendências.
- [x] Validar lint/typecheck/testes/build e atualizar candidato stage.
File list: core.ts, service.ts, resultados.ts, CatcherClient.tsx,
service.test.ts, resultados.test.ts, client-stream.test.ts, docs/alpha-catcher.md.
Campos existentes no schema; sem migration/backfill ou alteração de registros.

Validação: 24 testes focais aprovados; UI ampliada confirma UF/Município
separados, regime e data da opção condicional. Typecheck aprovado; lint zero
erros (1191 warnings anteriores). Global 4321 aprovados e duas falhas anteriores
Builder (URL absoluta vs relativa). Build ZhlQzn00Qxj3dtrB20dEV aprovado, candidato
/tmp/alpha-catcher-receitaws-candidate atualizado. Ativação sudo pendente.
Sem leitura de dados reais, chamada aos provedores ou escrita no banco.

## Histórico persistente das importações Logcomex
Requisito: lista abaixo da barra/botões no Monitor de processamento, com início,
fim, total de empresas coletadas (inclui existentes), novas adicionadas ao banco,
janela de datas e embarques mínimos/máximos. Mantém resumo após reload/restart.
Blueprint: reutilizar Auditoria para um resumo por importação, acao exclusiva e
ownership por usuário; sem schema/migration. Collector registra pares e término;
API de processamento registra resultados reais, nunca contagem enviada pelo cliente.
Fim representa término da coleta e das consultas da fila; fila interrompida fica
pendente e não recebe data final inventada. CNPJs únicos válidos compõem o total.
- [x] Serviço persistente, serialização de updates e deduplicação por CNPJ.
- [x] Integrar coleta, resultados de APIs e autorização por usuário/empresa.
- [x] Rota de histórico paginada e card abaixo dos controles, com atualização.
- [x] Preservar datas e números, inclusive falhas/pausa/retry/cancelamento.
- [x] Testes, lint, typecheck, build e candidato stage.
File list: criar historico-tipos.ts, historico.ts, api/alpha-catcher/historico/route.ts,
HistoricoConsultas.tsx; editar logcomex-job.ts, api/alpha-catcher/route.ts e
CatcherClient.tsx; testes histórico/rotas/job/UI; docs/alpha-catcher.md.
Vault: CRUD normal em Auditoria existente; não altera estrutura/registro Radar,
não exige migração, mutação em massa ou backup por operação.

Validação: 184 testes focais aprovados (histórico, ownership, retry, término após
fila, concorrência, falha de persistência, falha de coleta, UI). Global 4330
aprovados e duas falhas anteriores Builder; dois cenários adicionais aprovados
no focal final. Typecheck/lint global aprovados, lint focal após alterações
aprovado. CLI --help validada sem consulta real. Tabela Auditoria confirmada
no banco via SELECT sqlite_master; nenhuma escrita real executada.
Build NtA5ep3utWscLn7uRdr0v aprovado; candidato /tmp/alpha-catcher-receitaws-candidate
atualizado. Ativação sudo e homologação com importação real pendentes.
File list adicional completo: src/lib/alpha-catcher/historico-tipos.ts,
src/lib/alpha-catcher/historico.ts, src/app/api/alpha-catcher/historico/route.ts,
src/app/api/alpha-catcher/route.ts, src/app/api/alpha-catcher/logcomex/route.ts,
src/lib/alpha-catcher/logcomex-job.ts,
src/app/PainelAlpha/AlphaCatcher/HistoricoConsultas.tsx,
src/app/PainelAlpha/AlphaCatcher/CatcherClient.tsx,
scripts/alpha-catcher-history.mts, tests/alpha-catcher/historico.test.ts,
tests/alpha-catcher/historico-api.test.ts, tests/alpha-catcher/historico-ui.test.ts,
tests/alpha-catcher/api.test.ts, tests/alpha-catcher/logcomex-job.test.ts,
docs/alpha-catcher.md.
Smoke do candidato: login HTTP200, histórico sem sessão HTTP401 e processamento
sem sessão HTTP401. Servidor temporário encerrado automaticamente após checagem.

### Recuperar empresas aguardando do histórico
- [x] Disponibilizar ação no detalhe do histórico para carregar registros `aguardando`/`pendente` no monitor, sem iniciar outra coleta Logcomex.
- [x] Reutilizar o endpoint autenticado do detalhe e o processamento vinculado ao mesmo `historicoId`; excluir da fila registros já `salvo`/`existente`.
- [x] Validar lint, typecheck, testes e build; atualizar File List e registrar limitações.
File List adicional: `src/app/PainelAlpha/AlphaCatcher/CatcherClient.tsx`,
`src/app/PainelAlpha/AlphaCatcher/HistoricoConsultas.tsx`,
`src/app/PainelAlpha/AlphaCatcher/ModalHistorico.tsx`,
`tests/alpha-catcher/client-stream.test.ts`,
`tests/alpha-catcher/historico-ui.test.ts`.
Validação 2026-10-13: testes focais 9/9; `npm run typecheck` aprovado;
`npm run lint` aprovado sem erros (1192 warnings no repositório); suíte global
com Node 22: 608 arquivos aprovados, 4506 testes aprovados, 4 skipped e 1 todo;
`npm run build` aprovado. Não foi feita consulta externa nem alteração no banco.
Ativação em produção permanece pendente. Build emitiu avisos preexistentes de
`pdfjs-polyfill` e cache Webpack, sem impedir a compilação.

## Modal com lista exata da importação
- [x] Persistir pares e resultados como snapshots por blocos em Auditoria existente.
- [x] Ler snapshots do autor autenticado após reload/restart, preservando ordem/datas.
- [x] Reutilizar tabela principal (dez colunas, filtros, ordenação, paginação/exportação).
- [x] Card clicável abre diálogo acessível; atualizar lista de execução em andamento.
- [x] Identificar históricos antigos com somente resumo sem reconstrução inventada.
- [x] Validar testes, lint, typecheck, build e candidato stage.
Blueprint: criar ResultadosCatcher.tsx, ModalHistorico.tsx e rota detalhe;
editar historico-tipos.ts/historico.ts/logcomex-job.ts/HistoricoConsultas.tsx/
CatcherClient.tsx/CLI; testes snapshots, ownership, modal e tabela compartilhada.
Sem schema/migration ou backfill; novos registros normais em Auditoria.

File list: src/lib/alpha-catcher/historico-tipos.ts,
src/lib/alpha-catcher/historico.ts, src/lib/alpha-catcher/logcomex-job.ts,
src/app/api/alpha-catcher/route.ts, src/app/api/alpha-catcher/historico/[id]/route.ts,
src/app/PainelAlpha/AlphaCatcher/ResultadosCatcher.tsx,
src/app/PainelAlpha/AlphaCatcher/ModalHistorico.tsx,
src/app/PainelAlpha/AlphaCatcher/HistoricoConsultas.tsx,
src/app/PainelAlpha/AlphaCatcher/CatcherClient.tsx,
scripts/alpha-catcher-history.mts, tests/alpha-catcher/historico.test.ts,
tests/alpha-catcher/historico-api.test.ts, tests/alpha-catcher/historico-modal.test.ts,
tests/alpha-catcher/api.test.ts, tests/alpha-catcher/logcomex-job.test.ts,
docs/alpha-catcher.md.
Validação: global 4336 testes aprovados, duas falhas anteriores Builder (URL
absoluta versus relativa); focal final nove testes aprovados, incluindo legado,
snapshot após restart, ordem, ownership, abertura, ordenação e fechamento do modal.
Typecheck aprovado; lint zero erros (1191 warnings existentes). Build
EWYHqUEr-FjUflF3FSepm aprovado e candidato /tmp/alpha-catcher-receitaws-candidate
atualizado. Smoke: login HTTP200 e detalhe sem sessão HTTP401.
Sem escrita real no banco ou chamadas aos provedores durante validação.
Ativação sudo e homologação com importação real pendentes.

## Configuração ReceitaWS em modal
- [x] Renomear atalho para ReceitaWS e abrir diálogo em vez de navegar ao Radar.
- [x] Mover configuração de idade dos dados para o diálogo, preservando valor e bloqueio durante processamento.
- [x] Validar lint, typecheck, testes e build; atualizar candidato.
File list: src/app/PainelAlpha/AlphaCatcher/CatcherClient.tsx.

Validação: lint zero erros (1191 warnings anteriores), typecheck aprovado; dois testes focais do fluxo aprovados. Suíte global: 4337 aprovados e duas falhas anteriores do Builder. File list adicional: docs/alpha-catcher.md.
Build nP62We2fzLcp5ZN7Z7RvP aprovado; candidato /tmp/alpha-catcher-receitaws-candidate atualizado. Ativação sudo pendente. Sem alterações de banco ou configuração de ambiente.

## Ampliar modal do histórico
- [x] Usar 98% da largura e até 97% da altura da tela, removendo o teto de 1600px e mantendo margens e rolagem.
- [x] Validar checks e atualizar build candidato.
File list: src/app/PainelAlpha/AlphaCatcher/ModalHistorico.tsx.

Validação: lint zero erros (1191 warnings existentes), typecheck aprovado; testes 4337 aprovados e duas falhas anteriores Builder. Build inicial interrompido por ENOSPC; cache webpack movido para /tmp/alpha-catcher-next-cache-20261006 e ligado por symlink, preservando arquivos.
Build 6mHXfSnHtIqHtzpwyUG7Q aprovado e candidato atualizado; ativação sudo pendente.

## Exportação Excel dos resultados
- [x] Botão Exportar Excel ao lado de Exportar JSON na tabela compartilhada.
- [x] Gerar XLSX com dez colunas, todas as linhas do filtro e ordenação atuais, incluindo páginas seguintes, CNPJ textual e datas originais.
- [x] Validar arquivo, checks e build candidato.
File list: ResultadosCatcher.tsx, src/lib/alpha-catcher/exportar-excel.ts, teste de exportação.

File list completa: src/app/PainelAlpha/AlphaCatcher/ResultadosCatcher.tsx,
src/lib/alpha-catcher/exportar-excel.ts, tests/alpha-catcher/exportar-excel.test.ts,
docs/alpha-catcher.md.
Validação: roundtrip XLSX com 60 linhas, CNPJ textual com zero inicial, datas
e opção Simples condicional aprovado; lint zero erros (1191 warnings existentes),
typecheck aprovado. Global 4338 testes aprovados; duas falhas anteriores Builder.
Build mpHaCaycFzWUigRyINXFZ aprovado; candidato /tmp/alpha-catcher-receitaws-candidate atualizado.
Sem chamadas aos provedores ou alterações de banco. Ativação sudo pendente.

## Razão social e nome fantasia
- [x] Exibir razão social e nome fantasia na coluna Empresa / consignatário e no Excel.
- [x] Incluir nome fantasia na resposta do banco e snapshots históricos sem migration/backfill.
- [x] Validar testes, lint, typecheck e build candidato.

File list: src/lib/alpha-catcher/core.ts, service.ts, historico-tipos.ts,
exportar-excel.ts, src/app/PainelAlpha/AlphaCatcher/ResultadosCatcher.tsx,
tests/alpha-catcher/service.test.ts, historico.test.ts, exportar-excel.test.ts,
docs/alpha-catcher.md.
Validação: 22 testes focais aprovados (nome fantasia de novos/existentes,
snapshot após restart e Excel). Lint zero erros, typecheck aprovado.
Global 4338 aprovados e duas falhas anteriores Builder.
Build lvr9wqcTZZAcfl-h3yO6t aprovado e candidato atualizado. Sem migração/backfill ou
chamadas aos provedores. Ativação sudo pendente.

## Razão social e nome fantasia em colunas separadas
- [x] Substituir Empresa / consignatário por Razão social e Nome fantasia, com ordenação individual.
- [x] Aplicar aos resultados, histórico e Excel, mantendo Processamento após os nomes.
- [x] Validar checks e atualizar candidato.

File list: src/app/PainelAlpha/AlphaCatcher/ResultadosCatcher.tsx,
src/lib/alpha-catcher/resultados.ts, src/lib/alpha-catcher/exportar-excel.ts,
tests/alpha-catcher/client-stream.test.ts, historico-modal.test.ts,
exportar-excel.test.ts, docs/alpha-catcher.md.
Validação: lint zero erros, typecheck aprovado. Global 4336 aprovados; duas
falhas de índices de colunas nos testes foram corrigidas e quatro testes
focais aprovados (UI, histórico, Excel). Permanecem duas falhas anteriores
Builder. Build q-yTJKCr7GEk4CAO0zqFA aprovado; candidato atualizado, sudo pendente.
ENOSPC resolvido movendo caches de desenvolvimento e build antigo de validação
.next-gerador-docx-check para /tmp e preservando symlinks. Nenhum dado de banco
ou release ativa removido.

## Diagnóstico de alterações não visíveis no stage
- [x] Confirmar ativo mpHaCaycFzWUigRyINXFZ e candidato q-yTJKCr7GEk4CAO0zqFA.
- [x] Confirmar coluna antiga no ativo e duas colunas no candidato.
- [x] Ajustar ativação para rsync -rl --checksum --link-dest das dependências; app/env permanecem cópias independentes.
- [x] Validar sintaxe Bash, hardlink apenas para conteúdo idêntico, cópia divergente e symlinks.
- [x] Publicação externa confirmada durante diagnóstico: ativo q-yTJKCr7GEk4CAO0zqFA em 20261006-223927-alpha-catcher; serviço reiniciado às 22:41:42 UTC, domínio HTTP200.
File list: scripts/activate-alpha-catcher-stage.sh. Sem banco/migration.
Builds antigos de validação movidos para /tmp preservados por symlinks.
Movimentação adicional de .next-rm-b5c986 atingiu cota de /tmp; arquivos movidos
foram restaurados sem sobrescrever existentes; rsync reportou apenas permissão
de timestamp do diretório raiz.

Dry-run de dependências: zero bytes de arquivos transferidos, reutilização de
conteúdo idêntico confirmada. Release ativa contém Razão social/Nome fantasia.

## Capital social nas listas
- [x] Retornar capital social do banco e preservá-lo nos novos snapshots.
- [x] Exibir coluna Capital social em reais, ordenação numérica e Excel numérico.
- [x] Validar checks e build candidato.

File list: src/lib/alpha-catcher/core.ts, service.ts, historico-tipos.ts,
resultados.ts, exportar-excel.ts, src/app/PainelAlpha/AlphaCatcher/ResultadosCatcher.tsx,
tests/alpha-catcher/client-stream.test.ts, historico-modal.test.ts,
exportar-excel.test.ts, service.test.ts, historico.test.ts, resultados.test.ts,
docs/alpha-catcher.md.
Validação: lint zero erros (1191 warnings existentes), typecheck aprovado;
global 4339 testes aprovados e duas falhas anteriores Builder. Confirma
snapshot, zero/ausente, formatos monetários, ordenação numérica e XLSX numérico.
Primeira geração compilou, mas gravação de cache/log atingiu cota de /tmp e
terminou com exit1; cache webpack regenerável limpo e build repetido.
Sem schema/migration/backfill ou consultas reais aos provedores.

Build final Mz9OL3QJrg-QZnOcayL8p aprovado (exit0), candidato atualizado com src/scripts/.next. Ativação sudo pendente.

## Complementar cadastros salvos hoje (2026-10-06, Brasília)
- [x] Preparar CLI plan/apply/rollback com escopo fixo, checksum e comparação dos valores originais.
- [x] Implementar reconsulta somente ReceitaWS comercial para campos vazios, preservando data original e dados Radar; execução pendente.
- [x] Verificar backup completo <=48h e apresentar relatório Vault + confirmação específica.
- [x] Aplicar somente após confirmação e verificar resultado.
Diagnóstico read-only: 149 empresas de hoje, 74 sem nome fantasia, zero sem
capital social. Nenhum valor ausente recuperável do JSON original ReceitaWS.
Não alterar snapshots históricos nem inventar nome fantasia quando a ReceitaWS
não o informa.

File list: src/lib/alpha-catcher/completar-cadastro.ts,
scripts/alpha-catcher-completar-cadastro.mts, tests/alpha-catcher/completar-cadastro.test.ts,
docs/alpha-catcher-complementacao-vault.md.
Validação: lint global e focal zero erros; typecheck final aprovado; global
4343 testes aprovados e duas falhas anteriores Builder. Build 10eQw2FRS5NAlH9kMwFhI aprovado
e candidato atualizado. CLI plan executado read-only: 74 candidatos dentre 149
cadastros de hoje. Plano privado sha256
545d03ca4e26eb529ae25541af363cf9142c1d098bdb610f2b232456a449da71.
Backup completo de 05/10 14:27 UTC revalidado: 190124029 bytes, 332 tabelas,
204120 linhas, hash/restore/integrity/FK aprovados; conexão coincide.
Sem reconsultas ReceitaWS ou mutações; aguardando aprovação específica Vault.

Execução após autorização específica "Autorizo": apply exit0, 74 reconsultas,
um nome fantasia preenchido; 73 sem dado na API, zero falhas/conflitos.
Verificação posterior: 74 registros, datas e capitais originais intactos.
Registro privado de rollback e evidência disponíveis em pre-change; detalhes
em docs/alpha-catcher-complementacao-vault.md.

## Exibir complementos nos históricos antigos
- [x] Ao ler histórico autorizado, completar nome fantasia e capital social ausentes dos snapshots a partir do cadastro atual.
- [x] Preservar campos históricos preenchidos, datas, ordem e status; apenas leitura, sem reconsulta/mutação.
- [x] Consultar somente CNPJs salvos/existentes pertencentes à lista autorizada, em lotes limitados.
- [x] Validar testes/checks/build e preparar candidato stage.

File list: src/lib/alpha-catcher/historico.ts, tests/alpha-catcher/historico.test.ts,
docs/alpha-catcher.md. Validação: lint zero erros (1191 warnings existentes),
typecheck final aprovado; 16 testes focais aprovados, incluindo owner, leitura
sem escrita, valores existentes/zero, datas e lotes de até 200. Suíte global
4343 aprovados; dois testes novos corrigidos por argumento userId ausente e
aprovados no focal, além de duas falhas anteriores Builder.
Verificação real somente leitura no histórico de 500: snapshot com zero nomes
e zero capitais; retorno novo com 429 fantasias e 498 capitais. Zero datas
alteradas. Nenhuma API externa ou mutação de banco nesta alteração.
Build ttA62ywKm1iyZ5dEQIltt aprovado, candidato atualizado; ativação sudo pendente.

## Data original para importação JSON (2026-10-07)
Critérios: checkbox opcional e data única por arquivo; validar dia real até hoje
em São Paulo; aplicar apenas CREATE de empresas novas; existentes e conflitos
mantêm data original; Logcomex automática sem override; pausas/retries conservam
a escolha inicial. Sem migration ou execução de backfill.
Blueprint Scout: editar core.ts (validação), service.ts (CREATE), route.ts
(contrato autenticado), CatcherClient.tsx (checkbox/data/fila), testes e docs.
Menu/permissão/atalho/rota reutilizados, sem novo cadastro.
- [x] Implementar contrato e opção UI.
- [x] Validar preservação de datas, rejeições, testes, lint, tipos e build.
File list: src/lib/alpha-catcher/core.ts, service.ts,
src/app/api/alpha-catcher/route.ts,
src/app/PainelAlpha/AlphaCatcher/CatcherClient.tsx,
tests/alpha-catcher/service.test.ts, api.test.ts, docs/alpha-catcher.md.

Validação: CLI dia/fuso/rejeição aprovado; typecheck e lint sem erros
(1192 warnings anteriores). 200 testes focais aprovados; suíte completa 4359
aprovados, duas falhas anteriores Builder URL absoluta/relativa.
Build JJXRGks3FsTugB0OdVmJ9 exit0; candidato src/scripts/.next atualizado.
Smoke porta3316: login200, API privada401. Ativação stage depende sudo.
Nenhuma API externa, migration, backfill ou mutação real executada.
Cache antigo .next-rm-b5c986/cache movido para /tmp e symlink mantido
para viabilizar edição/build no disco cheio; nenhum backup/release removido.

## Fonte correta por origem de importação (2026-10-07)
Blueprint: service.ts distingue JSON/LOGCOMEX; route.ts determina origem por
historicoId autorizado, sem confiar em origem enviada pelo cliente.
Critérios: novos JSON fonte ALPHA_CATCHER+JSON+...; automática LOGCOMEX;
existentes preservados; nenhuma correção retroativa de banco.
- [x] Implementar e testar origem confiável.
- [x] Rodar gates e preparar build candidato.
File list: src/lib/alpha-catcher/service.ts, src/app/api/alpha-catcher/route.ts,
tests/alpha-catcher/service.test.ts, api.test.ts, docs/alpha-catcher.md.

CLI com dependências simuladas aprovado; 206 testes focais aprovados.
Typecheck/lint zero erros (1192 warnings anteriores); global 4365 aprovados
e duas falhas anteriores Builder URL absoluta/relativa. Build rjl0yAvCBzZokUSxrewNj
exit0; src/scripts/.next candidato sincronizados, ativação sudo pendente.
Nenhuma API externa ou mutação real executada.
