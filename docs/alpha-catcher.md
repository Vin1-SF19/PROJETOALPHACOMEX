# Alpha Catcher

Rota: `/PainelAlpha/AlphaCatcher`. Menu: Leads & Marketing.
Permissão: `alphaCatcher`, via configuração existente de setor/override.
Admin, CEO e TI mantêm bypass administrativo. Nenhuma concessão foi aplicada ao banco.

## Entrada e processamento

### Importação automática Shipment Intel

O botão **Importar automaticamente da Logcomex** inicia um worker privado com
login, código Gmail, abertura do Shipment Intel, captura da sessão BI e coleta.
Mantém filtros DIRETO/HOUSE e 1–2 embarques do coletor original. A referência
tem default hoje em São Paulo e a janela do coletor vai de três meses antes até
sete dias antes. Limite inicial 5, ajustável até 10.000 empresas.

Coleta completa segue automaticamente para ReceitaWS/Radar e gravação. Coleta
parcial ou cancelada conserva o snapshot recebido e exige início manual do
processamento. CAPTCHA pausa a automação para resolução humana; OTP/login
inválido encerram com erro. Não há bypass do desafio.
JSON manual continua disponível. Credenciais, código OTP e headers BI nunca
são enviados ao browser ou gravados pelo worker em relatórios.

Backend: `POST/GET /api/alpha-catcher/logcomex`; jobs isolados pelo usuário
autenticado. Lock de diretório no tmp do host impede logins simultâneos do
Catcher, inclusive entre processos locais. Não coordena outros programas
Logcomex ou hosts. Em crash abrupto, o lock pode permanecer: o operador deve
verificar que não há worker em execução antes de removê-lo.

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
não é compatível com execução serverless efêmera. O worker recebe timeout de
30 minutos e cancelamento SIGTERM/SIGKILL. Se fechar a página, a coleta pode
continuar no servidor até concluir/expirar; o enriquecimento ainda depende da
UI aberta, conforme limites abaixo. Snapshots/resultados permanecem somente
em memória e expiram na próxima coleta após uma hora.

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

JSON da Logcomex, até 5 MB e 10.000 entradas:

```json
{"empresas":[{"cnpj":"33.000.167/0001-01","consignatario":"BANCO DO BRASIL"}]}
```

Aceita CNPJ numérico com dígitos verificadores válidos. A API Radar atual exige
raiz numérica; CNPJ alfanumérico não é suportado. Não altera o arquivo original.

O servidor consulta `consultas_radar` antes de acessar as APIs. Qualquer registro
existente é preservado. ReceitaWS pública e Radar são consultados em paralelo
para novos registros. Só grava Receita OK, CNPJ coincidente, nome válido e Radar
válido ou 404. O 404 deixa situação/modalidade vazias: não distingue empresa não
habilitada de empresa não encontrada. Falhas ficam pendentes, sem placeholders.

`create` e o CNPJ único impedem sobrescrita entre sessões. Respostas completas
ficam em `json_completo` no servidor; endpoint e exportação usam campos resumidos.
Reutiliza `CONSULTA_RADAR_TOKEN` e credenciais Prisma/Turso existentes.
Não usa `RADAR_API_TOKEN` do protótipo, SQLite local ou migrations.

## Limites operacionais

A admissão reserva uma chamada externa a cada 30 segundos, entre usuários no
**mesmo processo Node**. Esse intervalo cobre os 21 segundos da ReceitaWS no
protótipo. Sobrevive a HMR via globalThis, mas não é distribuída entre réplicas,
nem persistida após reinício. Múltiplas réplicas precisam de coordenação
distribuída antes de afirmar um limite global. O Radar legado e clientes externos
não participam desta admissão.

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
