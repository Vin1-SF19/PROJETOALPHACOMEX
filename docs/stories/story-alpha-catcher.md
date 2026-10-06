# Alpha Catcher — importação e enriquecimento de empresas

Status: Ready for Review — CAPTCHA implementado, validação global parcial
Responsável pela story: PO (Pax). Implementação: Codex.

## Pedido
Criar Alpha Catcher em Leads & Marketing com o design da Consulta Radar,
adaptando `/home/ialpha/projetos/alpha-comex/API/app-teste-cnpj` para salvar
empresas novas em `consultas_radar`.

## Critérios de aceite
- [x] Reutilizar sessão por conta, validando acesso real ao Shipment Intel antes de dispensar Gmail/OTP; sessão rejeitada retorna ao login completo.
- [x] Desativar reutilização e restaurar o worker anterior com backup, sem migration ou gravações de empresas durante a validação.
- [x] Checar requisito CAPTCHA no backend; pausar com botão de abrir login oficial, confirmar resolução e tentar novamente; continuar só após validação.
- [x] Checagem automática durante espera, estados explícitos para falha/não confirmado, sem tratar erro como CAPTCHA liberado nem compartilhar sessão entre origens.
- [x] Botão de importação automática: login, Gmail OTP, Shipment Intel, coleta e processamento na UI; manter JSON manual.
- [x] Proteção por permissão, proprietário da execução e bloqueio de logins simultâneos; segredos somente no servidor.
- [x] Menu em Leads & Marketing, página e endpoint com permissão alphaCatcher.
- [x] Importar JSON `{ empresas: [{ cnpj, consignatario }] }`, contar inválidos e duplicados.
- [x] Consultar o banco antes das APIs; preservar empresas existentes inclusive em concorrência.
- [x] ReceitaWS pública e Radar no servidor; salvar apenas combinação válida. 404 Radar é ausência de resultado, sem inventar habilitação.
- [x] Manter fila conservadora no mesmo processo (30 segundos entre consultas externas), falhas pendentes e tokens privados.
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

## Validação
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
