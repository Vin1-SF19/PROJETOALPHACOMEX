# Alpha Catcher

Rota: `/PainelAlpha/AlphaCatcher`. Menu: Leads & Marketing.
Permissão: `alphaCatcher`, via configuração existente de setor/override.
Admin, CEO e TI mantêm bypass administrativo. Nenhuma concessão foi aplicada ao banco.

## Entrada e processamento

### Importação automática Shipment Intel

O botão **Importar automaticamente da Logcomex** inicia um worker privado com
login, código Gmail, abertura do Shipment Intel, captura da sessão BI e coleta.
Mantém filtros DIRETO/HOUSE, com embarques mínimos e máximos digitáveis
(default 1–2). Calendário seleciona intervalo inclusivo: dois cliques no mesmo
dia consultam somente ele; dois dias distintos definem a janela, em qualquer
ordem. Atalhos de três/seis meses contam para trás a partir do último dia
clicado, incluindo esse dia e ajustando finais de mês. Clique novamente no
atalho ativo para desmarcar a janela e voltar ao dia de referência. Dias e
atalhos ativos acompanham o tema Alpha selecionado. Default: últimos três
meses até sete dias antes de hoje em São Paulo. Datas mais recentes e
futuras são desabilitadas no calendário e rejeitadas pela API antes do login. Limite padrão 0 (sem limite de empresas); valores positivos interrompem
a coleta na quantidade informada. Coleta automática e importação por JSON não têm limite configurado de
quantidade de empresas.
O worker adapta o filtro data_operacao tanto no ranking quanto nos perfis,
preservando autenticação, paginação e retries do coletor original.

Cada par consignatário/CNPJ recebido entra imediatamente numa fila dinâmica.
O servidor verifica primeiro consultas_radar; registros existentes dispensam as APIs.
Para empresas novas, consulta ReceitaWS e depois Radar, gravando enquanto a
Logcomex continua coletando. Snapshots posteriores não duplicam consultas nem
apagam estados já concluídos. Coleta parcial ou cancelada preserva os pares
recebidos e o processamento continua drenando essa fila. Interromper processamento
deixa empresas aguardando para retomada manual. Pausar mantém a coleta ativa.
A interface acompanha o worker a cada dois segundos e precisa permanecer aberta
para continuar as consultas. Duas barras mostram perfis coletados e empresas
processadas. No modo ilimitado, a última página do ranking é obtida em paralelo
para calcular o total pela paginação, sem esperar todas as páginas ou bloquear
os primeiros perfis. Falha dessa descoberta mantém total desconhecido até que
a paginação normal permita calculá-lo. CAPTCHA pausa a automação para resolução humana; OTP/login
inválido encerram com erro. Não há bypass do desafio.
JSON manual continua disponível. Credenciais, código OTP e headers BI nunca
são enviados ao browser ou gravados pelo worker em relatórios.

Backend: `POST/GET /api/alpha-catcher/logcomex`; jobs isolados pelo usuário
autenticado. Lock de diretório no tmp do host impede logins simultâneos do
Catcher, inclusive entre processos locais. Não coordena outros programas
Logcomex ou hosts. Em crash abrupto, o lock pode permanecer: o operador deve
verificar que não há worker em execução antes de removê-lo.

### Diagnóstico das APIs

O botão **Verificar APIs** executa uma checagem autenticada somente de leitura no
worker. Ele valida a configuração da ReceitaWS e da API Radar sem enviar CNPJ,
consultar fornecedores, gravar dados ou alterar a fila. A ReceitaWS e o Radar
não têm uma checagem de disponibilidade sem consulta de empresa neste fluxo;
quando a configuração está presente, o resultado informa que a disponibilidade
externa não foi confirmada. Uma configuração ausente ou inválida aparece como
problema. O CLI equivalente é:

```bash
node --conditions=react-server --import tsx scripts/alpha-catcher-api-health.mts --user-id ID
```

`ID` é o identificador numérico do usuário autorizado no Painel Alpha. Sem
`--user-id`, o comando informa apenas a configuração do ambiente local.

### Dependências da automação

- `LOGCOMEX_AUTOMATION_DIR`: default `../API/automacao-logcomex` relativo ao cwd
  do painel. Lê `config.json`, `.env` opcional e reutiliza `gmail.js`/`otp.js` e
  Playwright instalado no pacote original.
- `LOGCOMEX_SHIPMENT_DIR`: default `../API/green-coast-ncm-lgcmx-integracao`.
  Usa `automacao-logcomex/src/download.js` para captura BI e
  `logcomex-diagnostico/src/logcomex.ts` para o coletor. Esse caminho corrige a
  referência quebrada da automação original a `API/logcomex-diagnostico`, que
  não existe nesta instalação. Não modificou arquivos externos ao painel.
- Login `LOGCOMEX_EMAIL`/`LOGCOMEX_PASSWORD`, `LOGCOMEX_SECRETS_DIR` e token
  Gmail já autorizado, conforme README da automação. Arquivos privados devem
  ser legíveis pelo usuário do serviço. Não há autorização OAuth automática na UI.
- Chromium headless instalado, `tsx` do painel e Node com `process.loadEnvFile`.
  Os módulos existentes foram carregados com Node 20.20.2/tsx nesta instalação;
  o pacote original recomenda Node 24.

Requer servidor Node persistente e instância única/sticky para status em memória;
não é compatível com execução serverless efêmera. A coleta não tem limite total
de duração e é encerrada após 30 minutos sem mensagens do worker.
O encerramento usa SIGTERM/SIGKILL. A coleta via CLI externo não passa por esse
temporizador do painel. Se fechar a página, a coleta pode
continuar no servidor até concluir/expirar; o enriquecimento ainda depende da
UI aberta, conforme limites abaixo. Snapshots/resultados permanecem somente
em memória e expiram na próxima coleta após uma hora.
Como o estado do job fica em memória, reiniciar ou atualizar o worker interrompe
uma coleta ativa; só publique mudanças quando não houver coleta em execução.

### CAPTCHA — abertura externa, confirmação e nova tentativa

Antes do login, o worker consulta o endpoint da Logcomex
`POST https://apiauth.logcomex.io/api/check-recaptcha-required` com o email
configurado no servidor. Só aceita `recaptchaRequired` booleano. HTTP de erro,
falha de rede ou corpo inválido não significam liberação nem necessidade de CAPTCHA.

Se necessário, a UI mostra **Abrir Logcomex**, **Já resolvi o CAPTCHA** e
**Tentar novamente**. A abertura usa a página oficial em outra aba com
`noopener noreferrer`; nenhuma senha ou sessão é enviada na URL. O usuário
precisa resolver para a mesma conta utilizada pela automação.

Enquanto aguarda, o worker checa a cada oito segundos. Confirmar ou tentar
novamente solicita checagem imediata; o clique sozinho nunca marca liberação.
Requisito false permite continuar com login próprio do servidor e OTP/Gmail.
Enquanto true, mostra não confirmado. Falhas mantêm a espera, com erro explícito.
A espera de CAPTCHA expira em 15 minutos; a coleta completa mantém limite de 30.

Se a página real mostrar desafio visível mesmo após requisito false, o contexto
pendente é fechado e o fluxo volta à espera, exigindo confirmação humana antes
de tentar um novo login. Nunca continua só porque a aba externa foi fechada.
O acesso às ações exige usuário dono do job; checagens duplicadas são recusadas.

**Limite de sessão:** a aba do usuário e o browser headless não compartilham
cookies/tokens. Esta implementação verifica liberação do requisito da conta,
não transfere sessão entre origens. Os documentos do projeto registram observação
de requisito false em contextos diferentes, mas a sequência completa
true → resolução externa → false → login backend ainda exige validação real
na conta/IP de produção. Se continuar exigindo desafio, o fluxo permanece pausado;
não afirma que a resolução externa necessariamente libera o browser do servidor.

JSON da Logcomex, sem limite configurado de tamanho ou quantidade de entradas:

```json
{"empresas":[{"cnpj":"33.000.167/0001-01","consignatario":"BANCO DO BRASIL"}]}
```

Aceita CNPJ numérico com dígitos verificadores válidos. A API Radar atual exige
raiz numérica; CNPJ alfanumérico não é suportado. Não altera o arquivo original.

O servidor consulta `consultas_radar` antes de acessar as APIs. Qualquer registro
existente é preservado. ReceitaWS é consultada primeiro; após validar o cadastro, consulta-se o Radar
para novos registros. Só grava Receita OK, CNPJ coincidente, nome válido e Radar
válido ou 404. O 404 deixa situação/modalidade vazias: não distingue empresa não
habilitada de empresa não encontrada. Falhas ficam pendentes, sem placeholders.

`create` e o CNPJ único impedem sobrescrita entre sessões. Respostas completas
ficam em `json_completo` no servidor; endpoint e exportação usam campos resumidos.
Reutiliza `CONSULTA_RADAR_TOKEN` e credenciais Prisma/Turso existentes.
Não usa `RADAR_API_TOKEN` do protótipo, SQLite local ou migrations.

## Limites operacionais

A ReceitaWS comercial usa `RECEITAWS_TOKEN` no servidor, modo `commercial`,
limite configurado em `RECEITAWS_REQUESTS_PER_MINUTE=50` e fallback
`RECEITAWS_FALLBACK=cacheOnError` ou `noCache`. A UI controla `days`: zero força
atualização; um inteiro positivo define a idade máxima aceita do cache. Não é
uma consulta histórica. Opções: 0, 7, 15, 30, 60, 90, 180, 365 ou personalizado.
Não é necessário definir `RECEITAWS_DAYS` para o Catcher. Com `cacheOnError`,
uma falha de atualização pode devolver dados mais antigos que o período escolhido.

O limitador compartilha chamadas por token no **mesmo processo Node**, incluindo
Consulta Completa. Reserva intervalos de 1,3 segundo no plano de 50/minuto e
respeita respostas 429. Não coordena réplicas, CLI separado ou aplicações externas.
Modo `public` permite reversão para a API pública, com limite de três/minuto.
Erros comerciais de autenticação ou saldo não acionam fallback público silencioso.

A fila fica na memória da página. Pausa/interrupção afetam próximos pedidos;
requisições já enviadas podem terminar e salvar. Sair/recarregar encerra a fila
local; exporte JSON para guardar o relatório. Empresas gravadas permanecem no
banco. Tentativas após falhas verificam o banco primeiro. Captcha interrompe a
fila. Não há worker persistente ou execução garantida com a aba fechada.

## CLI

Inspeção sem banco nem APIs:

```bash
node --conditions=react-server --import tsx scripts/alpha-catcher.mts arquivo.json
```

Processamento com gravação explícita e ambiente configurado:

```bash
node --env-file=.env.local --conditions=react-server --import tsx scripts/alpha-catcher.mts arquivo.json --processar
```

O CLI imprime um resultado por empresa. Trate logs como dados restritos.
Não executar `--processar` como smoke contra produção. Nesta entrega houve
apenas mocks e CLI de inspeção, sem consultas externas ou gravações reais.

## Validação (2026-10-05)

**Atualização:** após o usuário liberar leitura do `.env`, `npm run build`
fora do sandbox terminou com exit 0, incluindo AlphaCatcher e endpoints.
O bloqueio de build relatado nas tentativas anteriores está resolvido.
Esta verificação não publicou o módulo nem executou login/CAPTCHA real.

- 24 testes em quatro suítes: entrada, processamento, API e acesso.
- Lint específico sem erros/warnings; lint global: 0 erros, 1191 warnings.
- `npm run typecheck`: passou.
- `npm test`: bloqueado antes das suítes por EACCES ao ler `.env`, inclusive fora do sandbox.
- Testes específicos via config temporária com aliases existentes e `envDir:false`, sem credenciais.
- Build inicial bloqueado por permissões Prisma; tentativa fora do sandbox
  compilou e gerou páginas, mas falhou no trace final por EACCES de `.env`.
- Fluxo autenticado, consultas e gravações reais não executados.
- Smoke local: POST sem sessão retornou 401 antes do processamento. Servidor encerrado após o teste.
- Ampliação automática: 39 testes em seis suítes passaram (inclui API, proprietário
  do job, lock, cancelamento e proteção de segredos); dependências externas
  carregadas sem iniciar login. Não houve leitura do Gmail ou sessão real BI.
- Lint da ampliação sem erros/warnings; typecheck global passou após concluir
  a regeneração de `.next` do build. Build/teste global permanecem bloqueados
  pela leitura de `.env`. Nenhuma validação de login real foi declarada.
- CAPTCHA: 56 testes em sete suítes aprovados, incluindo checagem tipada,
  continuidade automática, confirmação sem liberação, falha temporária,
  desafio na página, ações por dono e recusa de duplicidade. Não houve login
  ou resolução de CAPTCHA real nesta verificação.
- CAPTCHA: lint específico limpo, lint global sem erros e typecheck aprovado.
  Scripts válidos em `node --check`. Build compilou/gerou páginas e falhou na
  finalização por EACCES de `.env`; `npm test` bloqueado no startup pelo mesmo
  motivo. Nenhuma alteração nas credenciais ou arquivos `.env` da automação.

Story: `docs/stories/story-alpha-catcher.md`.

## Publicação em staging (2026-10-05)

### Reutilização reversível de sessão (2026-10-06)

O worker tenta restaurar a sessão antes de conectar Gmail. Valida a página
autenticada e uma resposta BI bem-sucedida do Shipment Intel. Se falhar,
fecha o contexto, invalida a sessão e realiza login, CAPTCHA/OTP normalmente.
Não repete uma coleta ou gravação de empresas para validar a sessão.
Falha ao salvar sessão não bloqueia a importação.

Estado privado em `/home/ialpha/LogcomexAutomation/alpha-catcher-sessions/`,
um arquivo por hash de conta, diretório 700 e arquivo 600; cookies,
localStorage, IndexedDB e sessionStorage por origem. `LOGCOMEX_SESSION_DIR`
pode configurar outro diretório privado. Validade local máxima de 24 horas,
sempre subordinada à validação do provedor. Primeira execução faz login completo.
Implementação baseada no estado autenticado do [Playwright](https://playwright.dev/docs/auth).

Instalação no stage e reversão (scripts por job; sem rebuild ou reinício):

```bash
sudo bash scripts/deploy-alpha-catcher-session.sh apply
sudo bash scripts/deploy-alpha-catcher-session.sh disable
sudo bash scripts/deploy-alpha-catcher-session.sh enable
sudo bash scripts/deploy-alpha-catcher-session.sh rollback
```

`disable` volta ao login completo na próxima execução, preservando o cache;
`enable` reativa. `rollback` restaura o arquivo do worker anterior guardado
na release ativa, mesmo se o código novo não funcionar. Instalação/rollback
exigem que nenhuma importação esteja em execução. Alternativa por ambiente:
`LOGCOMEX_SESSION_REUSE=false` (reiniciar painel se mudar env carregado pelo Next).
Controle direto: `node scripts/alpha-catcher-session.mjs status|enable|disable`,
executado como usuário do serviço e com o mesmo ambiente do worker.

67 testes do módulo passaram, 11 específicos de sessão. Suíte global Node 22:
4223 passaram, duas falhas preexistentes no Builder, 4 skipped e 1 todo.
Sem validação de login real. Mudança instalada no staging em 2026-10-06;
scripts ativos conferidos por hash, backup anterior presente, serviço active
e HTTPS 200 sem reinício. Primeira coleta autenticada deverá criar o cache.

O staging executa a release em `/home/ialpha/deployments/painel-alpha-stage/current`,
porta 3300. Reiniciar não publica o build do workspace. O cadastro Alpak foi
corrigido para `https://stagepainel-alpha.alpak.ai/` e porta fixa 3300.

Candidato pré-buildado: `tmp/alpha-catcher-stage-candidate`, build
`zRGxCxf8vHCjxk-PFbNv2`, login 200 e API automática 401 sem autenticação.
Ativação preparada em `scripts/activate-alpha-catcher-stage.sh`; executar
com sudo no servidor. Valida o candidato antes da troca, reinicia o serviço
e restaura a release anterior em caso de falha. Usuário executou com sudo:
release `20261005-211433-alpha-catcher` publicada e serviço active/running.
Verificação pelo HTTPS: login 200, API automática 401 sem sessão, build ativo
correto e chunk com botão de importação automática presente. Porta temporária
encerrada. Script não depende de rg no ambiente administrativo.
Releases usam caminhos absolutos `LOGCOMEX_AUTOMATION_DIR` e
`LOGCOMEX_SHIPMENT_DIR` para acessar as dependências originais no workspace.
O script de deploy normal também configura esses caminhos e exclui caches
`.next*` antigos da cópia de fontes.

Os 56 testes do módulo passaram. Suíte global com Node 22: 4212 passaram,
duas falhas no Builder (URL absoluta versus relativa), 4 skipped e 1 todo.
Gmail exige `token.json` autorizado legível pelo usuário do serviço; não foi
encontrado em `/home/ialpha/LogcomexAutomation`. Nenhum login real realizado.

## Ordenação dos resultados

Data da consulta é a primeira coluna. Clique diretamente no texto de qualquer
título para ordenar: data, CNPJ, empresa/consignatário, processamento, situação
Radar, modalidade, UF, município, regime tributário ou data da opção. Primeiro clique crescente; novo
clique no mesmo título alterna a direção. Seta e cor do tema indicam o campo
ativo; aria-sort informa a direção às tecnologias assistivas. Datas são
comparadas pelo instante original, sem alterar o valor no banco.
Ordem de importação restaura a apresentação original. A comparação usa pt-BR,
ignora acentos e mantém campos ausentes no final nas duas direções.
Filtro de status é aplicado antes da ordenação; paginação vem depois.
Trocar campo ou direção volta à primeira página. A fila de consultas preserva
a ordem de importação independentemente da apresentação dos resultados.

## Diagnóstico de coleta parcial

Coleta parcial mostra quantidades recebidas, válidas, sem CNPJ, descartadas e
páginas consultadas. Falhas são códigos de HTTP, conexão, timeout, formato de
ranking/perfil e paginação. O worker nunca retransmite mensagens livres do
provedor, corpos HTTP, tokens ou credenciais. Resultados válidos continuam
preservados na fila de processamento; não declara sucesso da coleta interrompida.

Captura BI usa headers da resposta aceita na conta configurada, incluindo
product-signature real (plataforma-bi na validação de 2026-10-06). Ranking
e perfil preservam esse produto. Diagnóstico autenticado confirmou ranking
de seis meses com faixa 1–2: HTTP 200 e 100 empresas na primeira página.
Isso não substitui homologação da coleta completa de perfis e enriquecimento.

Ranking da sessão restaurada é validado com os mesmos filtros antes de
reutilizar login. A primeira página validada é reutilizada na coleta.
Consultas de importação iniciam com bi-importacao (primeiro caso validado
no diagnóstico); somente HTTP 406 permite uma comparação com o produto
capturado, sem alterar período/faixa. Produto alternativo aceito permanece
em uso nas próximas chamadas desse cliente. Nenhum retry adicional em
401/403/429/5xx é introduzido por essa comparação.

## Data original nos resultados
A coluna Data da consulta exibe data e hora de inclusão do cadastro na base
Consulta Radar, em America/Sao_Paulo. O valor vem de consultas_radar.data_consulta,
retornado como dataConsulta ISO pelo serviço, inclusive quando o cadastro já
existia ou foi criado por outra sessão concorrente. Novas inclusões usam o
instante atribuído pelo banco; o Catcher não envia data_consulta no create nem
atualiza registros existentes. Datas enviadas na entrada são ignoradas. A
exportação JSON inclui o valor ISO. Empresas ainda não consultadas ou pendentes
sem registro não recebem uma data inventada e aparecem com travessão.

## Colunas cadastrais
Ordem dos resultados: Data da consulta, CNPJ, Razão social, Nome fantasia,
Processamento, Situação Radar, Modalidade, UF, Município, Regime tributário,
Data da opção. UF e município são separados. Todos os títulos ordenam.
As mensagens de pendência aparecem na célula Processamento. Regime, opção
pelo Simples e data da opção são lidos do registro persistido, tanto existente
quanto novo. Data da opção aparece apenas para optantes do Simples; para
cadastros antigos sem optante_simples, considera regime Simples Nacional.
Optante false prevalece sobre o texto do regime. A data da opção é exibida
como data civil em UTC, evitando recuar um dia em valores salvos à meia-noite.
Não atualiza cadastros nem substitui datas originais.

## Histórico de consultas no monitor
As importações automáticas Logcomex iniciadas após esta atualização registram
um resumo durável em Auditoria, acao ALPHA_CATCHER_IMPORTACAO_LOGCOMEX, sem
alterar o schema. A lista fica abaixo da barra e dos controles do Monitor de
processamento, mais recentes primeiro, com páginas de 20 e atualização a cada
cinco segundos durante a execução. Persistem após reload/restart:
- Data e hora de início e fim (America/Sao_Paulo).
- Total coletado: CNPJs válidos únicos, inclusive empresas já cadastradas.
- Novas adicionadas: somente creates efetivos desta execução; conflitos de
  unicidade retornam existente e não contam como nova.
- Janela de datas e embarques mínimos/máximos escolhidos.
Início é registrado no servidor antes de abrir o worker. Fim é registrado ao
encerrar coleta e tentativas da fila; fila ainda não processada fica pendente,
sem data final inventada. Falhas/cancelamentos não são declarados concluídos.
Retries de empresas salvas não diminuem nem duplicam a contagem de novas e
preservam o fim original. Resumos são restritos ao autor autenticado; a rota
não aceita userId/contagens do cliente. Cada resultado só pode vincular-se a
uma importação do mesmo usuário que realmente recebeu esse CNPJ.
Atualizações são serializadas; pares da coleta são agrupados para persistência,
e cada resposta de processamento aguarda a gravação do contador. Falha do
histórico não apaga empresa já gravada: exibe aviso e preserva resultado.
Reinício com execução incompleta mostra Interrompida e não inventa conclusão.
O dono pode continuar uma coleta Logcomex interrompida pelo histórico; o ranking
é relido com os filtros originais, pois históricos antigos não têm cursor da
Logcomex. Nomes já recebidos dispensam nova chamada de perfil, e CNPJs já
registrados conservam o estado e a contagem. A continuação usa a mesma
importação e registra uma nova tentativa. A fila de enriquecimento ainda
depende da página aberta; fechar ou recarregar a página não a retoma
automaticamente. O histórico preserva seus resultados em snapshots.
JSON manual permanece fora deste histórico de importações automáticas.
Não reconstrói importações anteriores: seus horários e filtros não eram salvos.
CLI operacional de leitura, no diretório do painel:
`node --conditions=react-server --import tsx scripts/alpha-catcher-history.mts --user-id ID [--cursor ID]`.
A CLI requer acesso de operador aos arquivos privados do servidor; não consulta
ReceitaWS/Logcomex e nunca altera registros. Não expõe tokens nos resumos.

Diagnóstico e plano de continuação somente leitura:
`node --env-file=.env.local --conditions=react-server --import tsx scripts/alpha-catcher-retomar.mts list --usuario @Andrew --dia 2026-10-13`
e `... plan --usuario @Andrew --id UUID`. O comando `resume` inicia a
continuação pelo worker configurado; use-o apenas em operação autorizada, com
o usuário disponível na interface para a fila de enriquecimento. A opção
"Continuar coleta" no histórico aplica o mesmo contrato para o dono.

O histórico apresenta separadamente fim da coleta (`fimColeta`) e fim do
processamento (`fim`). Motivo, última etapa e progresso ficam registrados para
as novas execuções. Em 13/10/2026, o job de @Andrew iniciado às 9h26 em São
Paulo atingiu o corte antigo de 30 minutos às 9h56, com 2.159 CNPJs recebidos
e 2.157 processados. A execução iniciada às 13h48 teve o mesmo corte, com
2.165 recebidos e 1.842 processados. Esses metadados foram consultados sem
alterar o banco. Não havia telemetria persistida para determinar a etapa exata
que consumiu o tempo em nenhuma das duas execuções.

## Modal da lista histórica
Cada card do histórico abre um diálogo com a tabela ResultadosCatcher, a mesma
usada pela tela principal: doze colunas, filtro de processamento, ordenação nos
títulos, paginação de 50, ordem de importação e exportação JSON. Os controles do
modal são independentes e não substituem nem processam a fila principal.
Fecha por botão/Escape, mantém foco no diálogo e devolve foco ao card.
As novas importações persistem pares e respostas finais em Auditoria, ação
ALPHA_CATCHER_IMPORTACAO_LINHAS:<UUID>:<bloco>, cem linhas por bloco. Apenas
blocos alterados são escritos, com fila serializada e cabeçalho congelado por
atualização. Não limita a quantidade total de empresas. Falha de escrita mantém
bloco pendente para retry; detalhe com blocos faltantes retorna erro.
GET /api/alpha-catcher/historico/[id] exige o autor autenticado e retorna somente
campos permitidos. Recupera snapshots após reinício sem consultar ReceitaWS,
ou Radar. Para nome fantasia e capital social ausentes, lê somente esses dois
campos do cadastro atual, em lotes de até 200 CNPJs e apenas para empresas
salvas/existentes da lista autorizada. Não grava snapshots ou cadastros.
Campos históricos preenchidos prevalecem; zero de capital é preservado.
Nomes baixados, estados finais e datas originais de
resultados salvos/existentes são preservados mesmo em tentativas posteriores.
Resultados pendentes podem ser atualizados numa nova tentativa daquela fila.
O modal de execução em andamento atualiza a cada cinco segundos e mostra
consultas em curso. Após reinício não inventa consultas antigas ainda ativas.
Históricos anteriores que guardaram apenas resumo exibem lista indisponível,
sem reconstruir CNPJs ou resultados atuais como se fossem daquela importação.
CLI permite --importacao UUID para ler lista e resumo persistidos por autor.
Sem schema, migration, backfill ou sobrescrita de consultas_radar.

A configuração de idade máxima dos dados fica no modal aberto pelo botão ReceitaWS no cabeçalho. As alterações são aplicadas à próxima consulta, permanecem ao fechar o modal e ficam bloqueadas durante coleta/processamento.

O botão Exportar Excel gera uma planilha XLSX com as doze colunas da tabela, incluindo razão social, nome fantasia e mensagens de processamento. Exporta todas as linhas do filtro atual na ordem selecionada, não apenas a página visível. Está disponível nos resultados e no modal de histórico. CNPJ permanece texto, preservando zeros iniciais; datas mantêm o formato exibido e a data original. A geração ocorre no navegador sem consultar APIs.

As colunas Razão social e Nome fantasia são separadas, com ordenação individual. Processamento fica logo após Nome fantasia. Dados ausentes são exibidos como traço; consignatário continua guardado na importação, mas não é exibido nessas colunas. Excel segue a mesma estrutura. Nome fantasia vem do campo existente no banco e integra novos snapshots históricos, sem reconstruir registros antigos.

Capital social aparece como última coluna, em reais, com ordenação numérica e ausentes ao final. O valor vem do capital_social já persistido; novos snapshots incluem capitalSocial. Históricos antigos sem esse campo recebem o valor do cadastro atual somente na leitura; se o cadastro também não informar, mostram traço. No Excel a coluna L é numérica com formato de moeda, permitindo cálculos. Nenhuma migração, backfill ou nova consulta aos provedores para preencher históricos.

### Data original de planilhas (JSON)
O checkbox “Usar uma data específica na importação JSON” permite escolher
um dia civil até hoje (São Paulo). A API recebe `dataConsulta: "AAAA-MM-DD"`,
valida antes das consultas e grava `data_consulta` apenas no CREATE, ao meio-dia
de São Paulo (15h UTC), mantendo o dia na tabela e exportações. Existentes e
concorrência preservam a data do banco. A escolha fica congelada na primeira
execução da fila, inclusive pausas/retries, e é liberada ao carregar outro JSON.
Ausência do campo conserva o default do banco. Histórico Logcomex rejeita
override. Sem migration, alteração de registros antigos ou backfill.

### Fonte por importação
Novos registros recebem `ALPHA_CATCHER+JSON+RECEITAWS_COMERCIAL+CONSULTA_RADAR`
ou `ALPHA_CATCHER+LOGCOMEX+RECEITAWS_COMERCIAL+CONSULTA_RADAR` (PUBLICA
quando aplicável). A rota determina Logcomex pelo historicoId autorizado;
sem histórico a origem é JSON, ignorando origem arbitrária do cliente.
json_completo inclui origemImportacao; chave logcomex mantida por compatibilidade.
Registros já salvos mantêm sua fonte; nenhum backfill executado.


## Histórico de importação JSON — 08/10/2026

Ao iniciar processamento JSON, a interface registra primeiro o arquivo e a lista válida no histórico. Só após persistência do lote começa a consultar empresas. Resultados e contagens vêm do servidor; autoria, origem, data escolhida e associação do CNPJ são verificadas pelo histórico persistido. Histórico e detalhes respeitam a conta autenticada. Origem ausente nos registros legados continua Logcomex.

`POST /api/alpha-catcher/importacoes/json` registra o lote, sem reconsultar empresas. A data escolhida fica fixada e só afeta CREATEs; retry não conta empresas novamente. Resultado `salvo` pode ser reconciliado por marcador do lote no JSON do cadastro após restart. Staging usa um processo Node; a fila do navegador não retoma automaticamente após reload, mas os resultados gravados continuam no histórico. Antes de ativar nova release, finalizar ou interromper consultas JSON em andamento.

Recuperação operacional: `scripts/alpha-catcher-recuperar-historico-json.mts plan --arquivo PATH --email EMAIL [--data YYYY-MM-DD]` apenas consulta os cadastros e gera plano privado em database-backups/pre-change. `apply` exige SHA256 exato, backup do mesmo banco com até48h validado por restauração e aprovação Vault específica. `rollback` afeta apenas Auditoria criada pelo plano, exige aprovação própria e bloqueia conteúdo alterado. Nunca reconsulta provedores nem altera empresas.

O lote recuperado é identificado com nome do arquivo e timestamp de recuperação; horários originais e quantidade de novas empresas permanecem desconhecidos. Seus resultados representam os cadastros atuais, não snapshots originais. Ativação manual do candidato validado: scripts/activate-alpha-catcher-json-history-stage.sh, com rollback da versão da aplicação se smoke falhar. Nenhuma migration faz parte da entrega.

## Histórico compartilhado e autoria

Usuários com acesso ao Alpha Catcher podem listar e abrir históricos de todos os autores, inclusive JSON, Logcomex e recuperados. Cards/modal mostram @usuarios.usuario atual, projetado pela relação Auditoria.usuario; sem handle válido, exibem autor indisponível. Sem migration/backfill. GETs mantêm acessoCatcher (401/403) e no-store. Autoria e registroId são metadados de leitura; não vêm do JSON do cliente.

Detalhe utiliza registroId numérico de Auditoria como referência inequívoca. UUID legado é aceito somente quando resolve um único resumo. Blocos e estado ativo usam o userId real do resumo. Operações de processamento/resultado/contexto e controle de jobs seguem vinculadas ao proprietário.

CLI: node --conditions=react-server --import tsx scripts/alpha-catcher-history.mts --user-id ID --compartilhado [--cursor ID] [--importacao REGISTRO_ID|UUID]. A leitura compartilhada confere permissões efetivas do usuário; sem a flag, preserva a leitura operacional por dono.
