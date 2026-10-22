# CheckList Analistas — preflight operacional de staging, 22/10/2026

Estação DevOps Bibble. Somente leitura remota; nenhum schema, dado, objeto, configuração, backup, commit, push ou deploy executado. Documentação local é a única saída persistida desta estação. Nenhuma consulta SQL em produção. Nenhuma credencial, dado pessoal, URL documental ou senha neste relatório.

## Ambientes e versão efetiva

| Destino | SHA READY observado | Observação |
|---|---|---|
| staging.alpha-comex.com | d7580d079b590e0ad8012f63145f241b3ed36a10 | Custom environment staging, branch staging; avançou após base69047dee |
| painel.alpha-comex.com | 28651e7f4c6a3ed1be91f7437eb638638d047f0c | Produção preservada |
| alphaclientes.vercel.app | edcf2e8e79224176e5b7e1a3c5a013c3a6dbb5eb | Portal produção, sem custom staging |

O delta d7580d07 é `fix(crm): incluir TI e Admin como observadores de leads`; deve ser integrado ao worktree da entrega ANTES dos gates finais. Não alterar o checkout compartilhado sujo nem perder a correção externa. Nenhuma integração foi executada nesta estação.

Fingerprint SHA256 da URL do banco CLI staging: `7fdd160737ba6f9cf84d0ac2fb1c3cf1084311e7fccea454f7bac368f9e4d42b`. Fingerprint de produção obtido somente por metadata Vercel: `3a07b72d638b9528ba4a373d5c293551467ea154c6770966967b8cc11d0cc662`, distinto. Alvo fixado exclusivamente pelo arquivo real `.env.staging.local` do Painel, modo0600, com hostname contendo staging; nenhuma leitura de `.env.local` real.

**Limite de comprovação:** os GETs Vercel de environment/pull redigem valores sensitive do staging, inclusive sua URL. Valor vazio retornado não significa variável ausente. Assim não foi possível comparar por hash a URL sensitive configurada no runtime Vercel com a URL local. O diagnóstico comprova o banco CLI explicitamente escolhido; antes de aplicar/publicar, DevOps deve comprovar o destino efetivo da configuração staging por evidência confiável ou configurar somente o override staging com o alvo verificado, sem importar produção. Metadata prova existência e escopo dos overrides, não seu valor secreto.

## Diagnóstico real somente leitura

A execução direta de `node scripts/checklist-analistas/cli.mjs diagnose --env-file <root>/.env.staging.local` bloqueou corretamente com `AMBIENTE_STAGING_NAO_COMPROVADO`: o arquivo atual contém apenas TURSO_DATABASE_URL/TURSO_AUTH_TOKEN, sem os três marcadores de prova novos. Nenhum marcador foi adicionado. Para obter as contagens, o mesmo `diagnose` de Dara foi importado por harness local `/tmp/checklist-analistas-preflight-readonly.mjs`, em transaction(read), SQL limitado por whitelist a SELECT/PRAGMA; SHA do alvo fixado antes de conectar, rollback ao terminar. Execução principal:68 consultas SELECT/PRAGMA; consultas agregadas adicionais read-only confirmaram prioridade/permissões. Nenhum plano apply invocado.

| Verificação | Resultado |
|---|---:|
| Layout master canônico | Sim: clienteId INTEGER; clienteOperacionalId TEXT |
| Fase nova migration | NOT_APPLIED |
| Bloqueios Dara | 0 |
| Tabelas / índices existentes | 337 / 949 |
| Empresas master / contas Portal | 2178 / 2 |
| Atendimentos / checklists / itens | 4 / 6 / 10 |
| Modelos para bootstrap | 3 |
| Colisões de modelo / códigos inválidos | 0 / 0 |
| Órfãos master, conta, checklist, item, documento e modelo | 0 em cada grupo |
| Violações FK / status desconhecidos | 0 / 0 |
| Donos atuais | Coluna ausente; os4 atendimentos permanecerão NULL após DDL |
| Documentos / fotos de conta legados | 0 / 0 |
| Contas com senha legada não vazia | 2 |
| Hashes bcrypt / coluna hash | 0 / ausente |
| Pastas totais / Teste exato / Sem Pasta real | 1 / 0 / 0 |
| Empresas sem pasta / empresas em Teste | 3 / 0 |
| Analistas ativos / com acesso efetivo checkList | 4 / 4 |
| Líder Operacional ativo / com checkList | 1 / 0 |
| Ledger _prisma_migrations | Ausente |

Fingerprint do schema: `9777352d5be701d179323bb78c690bb5eaa2cd7c2d2f22cbf4c37313ce4829f2`. Dados são fotografia do preflight; refazer diagnóstico imediatamente antes da operação e bloquear em delta inesperado.

## Lacunas operacionais concretas antes de Sage/Forge

1. **Hash batch de2 contas:** o Portal já possui upgrade oportunista CAS no login, válido para compatibilidade prevista na arquitetura. Isso não remove as duas senhas que nunca fizerem login. Para encerrar A03 em todo o staging, implementar operação guardada dry-run/apply, bcrypt fator12, leitor Portal compatível primeiro, CAS do estado observado, hash na memória e limpeza `senha=''` na mesma transação. Plano/relatório/JSON/logs nunca contêm senha, hash ou token. Nenhuma execução real agora; backup/Vault/consentimento específico obrigatórios. `storage-legado` não implementa essa operação.
2. **Permissão do líder:** conta interna id10 tem role persistida exata `Lider Operacional`, nenhum SetorPermissao e nenhum override individual checkList. Fallback atual contém `chamados`, `Documentos`, `UpDocumentos`, `Extratos`. Criar somente a linha checkList seria regressão: a primeira configuração setorial desliga o fallback e retiraria os quatro módulos. Plano aprovado para preparar: inserir **5 vínculos** do setor (os4 preservados +checkList), após snapshot/CAS do role, usuários afetados, permissões legadas, linhas setoriais e overrides; pós-verificar os4 acessos preservados +checkList novo. Não alterar role, dono, senha de usuário interno ou overrides. Há somente1 conta desse role no diagnóstico. Alternativa menor seria override ADD checkList somente id10, porém o plano escolhido pelo coordenador é setorial preservador. Aplicação real segue Vault/backup/consentimento específico.
3. **Worker staging:** endpoint `/api/checklist/jobs/eventos` implementa somente POST com Bearer CHECKLIST_WORKER_SECRET e não está no vercel.json. Vercel Cron chama GET e somente deploys production; o staging atual é custom environment preview. Adicionar GET/CRON_SECRET isoladamente não agenda staging. Preparar runner + unit/timer systemd de staging, tests e plano de instalação antes dos gates; nenhuma instalação nesta estação.

**Não implementar nem executar migrações desnecessárias neste staging:** documentos e fotos0 => cópia/checksum/revogação legada não se aplica à fotografia atual. Não afirmar que objetos de produção foram privatizados. Teste0 => limpeza é no-op; não incluir DELETE na autorização. “Sem Pasta” continua filtro virtual. Reavaliar se aparecerem registros novos antes da aplicação.

## Plano concreto do scheduler staging, ainda não instalado

Usar o host operacional existente com systemd, evitando contratar outro serviço. Inspeção read-only: cron do usuário contém apenas rotina Onyx; timers existentes não incluem CheckList. Nenhum timer staging equivalente foi identificado; ausência na listagem consultada não prova ausência em outros provedores.

Artefatos a preparar: `scripts/checklist-analistas/staging-worker.mjs`, `ops/systemd/checklist-eventos-staging.service`, `ops/systemd/checklist-eventos-staging.timer`, teste causal de target/método/auth/status/timeout. Runner deve ler arquivo de serviço0600 fora do Git e exigir CHECKLIST_TARGET_ENVIRONMENT=staging + CHECKLIST_PANEL_ORIGIN exatamente https://staging.alpha-comex.com. Nunca aceitar fallback para produção ou URL recebida arbitrariamente. Enviar POST fixo para `/api/checklist/jobs/eventos`, Authorization Bearer via fetch em memória (sem segredo em argumento do processo), redirects proibidos, timeout30s, falha em HTTP não2xx e resposta inválida. Log somente status/counts/código seguro, jamais responsebody arbitrário/headers/URLtoken. Se proteção Vercel exigir bypass, segredo adicional exclusivo staging via header; não desativar proteção nem usar bypass de produção.

Service: Type=oneshot, usuário de serviço sem privilégios, arquivo staging explícito lido pelo runner (sem importar process.env), WorkingDirectory release imutável, ExecStart node runner, TimeoutStartSec=40, NoNewPrivileges=true. Timer: OnBootSec=30s, OnUnitActiveSec=60s, precisão1s; systemd serializa a mesma unit, e worker já claim/retry persistido. Procedimento histórico de instalação — SUSPENSO nesta entrega por §14 (polling sem timer): validar runner --check sem rede, instalar3 artefatos, daemon-reload, enable/start timer staging, verificar histórico/auth e entrega de evento sintético autorizado. Rollback: disable/stop apenas esse timer e retirar apenas suas units; não apagar eventos/outbox nem mexer em produção. Frequência é decisão operacional revisável, não SLA prometido.

Referências oficiais conferidas: [Cron quickstart](https://vercel.com/docs/cron-jobs/quickstart), [Cron overview](https://vercel.com/docs/cron-jobs), [Gerenciar e autenticar cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs). Explicam produção somente, GET e CRON_SECRET. Não foi contratado serviço/upgrade.

## Isolamento e configuração futura antes de qualquer push/deploy Portal

- Painel tem custom staging e branchMatcher exato staging. Pusher appId/key de staging e produção possuem hashes iguais: **mesmo app atual**. Canal private-checklist-docs é fixo; prefixo no storage não isola realtime. Usar app Pusher próprio staging, suas quatro variáveis no staging apenas, validar que o app hash difere de produção. Não trocar credenciais de produção.
- Portal não tem custom staging nem branch staging publicada. DATABASE_URL/TURSO_DATABASE_URL/TURSO_AUTH_TOKEN/ AUTH_SECRET/Blob têm escopo production+preview. **Não fazer push/preview antes de criar isolamento.** Preferir custom environment staging branchMatcher exato staging e alias próprio de staging; alternativa é projeto Portal staging independente se plano não permitir customenv, preservando production. Verificar disponibilidade/preço antes de operação que cobre; nada contratado.
- Portal staging aponta ao MESMO banco staging canônico do Painel; segredo de sessão exclusivo staging, cookie/origins do próprio staging. DATABASE_URL deve cumprir build local/Prisma conforme projeto, TURSO url/token fixam runtime efetivo; confirmar ambos. Nunca copiar banco/dados/arquivos env/credenciais de produção. Não usar preview comum herdando produção.
- Criar/configurar store Blob **privado dedicado ao CheckList staging** e vinculá-lo aos dois apps somente staging com `CHECKLIST_PRIVATE_BLOB_TOKEN`. Metadata da equipe mostra2stores privados de outros módulos e nenhum token CHECKLIST configurado: existência deles não autoriza reutilizar. Preservar BLOB_READ_WRITE_TOKEN global e stores CRM/StorageNAS.
- Definir `CHECKLIST_STORAGE_PREFIX` com namespace/prefixo staging; `CHECKLIST_LEGACY_ALLOWED_HOSTS` JSON exato (atualmente `[]` é suficiente para0docs/0fotos; novo diagnóstico decide); `CHECKLIST_WORKER_SECRET` exclusivo staging; `NEXT_PUBLIC_CHECKLIST_PORTAL_ORIGIN` alias real Portal staging, nunca fallback de produção. Pusher4vars no Painel; Portal novo journal/SSE não depende de publicador paralelo legado.
- Para CLI autorizado preparar explicitamente `.env.staging.local` com CHECKLIST_TARGET_ENVIRONMENT, CHECKLIST_PANEL_ORIGIN e CHECKLIST_STAGING_DATABASE_SHA256, sem alterar o default `.env.local`; evidência antes de aplicar. Não foi configurado agora.

## Aplicação futura e rollback, dependentes de Vault/consentimento

Sequência histórica — SUPERADA pela arquitetura §14 (ordem atual ao final, polling sem timer): integrar delta staging no worktree; preparar scripts faltantes; concluir Nova/Sage/Forge/Probe/Anubis/Lens/QA; configurar isolamento staging revisável; Vault levantar backup COMPLETO novo no pre-change, restaurar/verificar integrity/FK/counts/SHA/idade<=48h; apresentar plano exato com fingerprints/hashes e pedir confirmação específica. Depois de autorização: aplicar DDL aditivo26colunas+5tabelas, bootstrap3modelos, permissão setorial5vínculos; publicar leitor Portal compatível e validá-lo; hashbatch2contas e escritor Painel seguindo plano; habilitar timer e E2E staging autorizado. Nova criação interna não pode preceder leitor Portal compatível. Todos os counts/planHashes devem ser recalculados e qualquer divergência interrompe execução.

Ledger ausente não autoriza criar/baselinar histórico inteiro: nunca rodar migrate deploy cego nem inventar migrate resolve applied. Aplicador custom só DDL aprovada/verificada; decisão de ledger, se necessária, requer plano próprio revisado. Os3modelos não têm colisões nesta fotografia, mas bootstrap continua separado e não altera instâncias/snapshots antigos.

Os4 donos ficarão NULL; não inferir por pasta/CNPJ/nome. Líder com permissão efetiva poderá atribuir dono explicitamente pelo fluxo novo. Não incluir backfill automático no plano.

Rollback preferido: manter schema aditivo e leitor compatível com bcrypt/versões/eventos; reverter apenas código compatível. Não voltar a autenticador exclusivamente plaintext nem reconstruir senha antiga. Reversão da permissão exige snapshot exato, pós-CAS e plano específico sem apagar alterações posteriores. Restore de banco exige avaliar writes posteriores e novo consentimento, nunca DROP automático. Não deletar documentos/contas/empresas para rollback.

## Evidências e limites

JSON seguro consolidado `/tmp/checklist-analistas-20261022-operational-preflight.json`; detalhe agregado `/tmp/checklist-analistas-20261022-staging-counts.json`; metadata Vercel/escopos/fingerprints e configuração do líder em arquivos `/tmp/checklist-analistas-20261022-preflight-*.json` e `leader-permission.json`. Nenhum token/URL documental/senha salvo nesses artefatos. Biblioteca de diagnóstico usou staging real em read-only; nenhuma validação remota autenticada de UI, upload ou worker foi feita. Gates globais não executados nesta estação de preflight. Roots/arquivos de ambiente preservados; somente este documento local novo foi criado no worktree. Produção permanece sem configuração/publicação autorizada.


## Artefatos implementados localmente — estação DevOps2

Checkpoint local `add03a89`:93 arquivos feature inventariados e adicionados seletivamente; varredura dos arquivos para tokens de provider/JWT/chave privada/URLs de conexão encontrou0 candidatos. Commit WIP explícito, sem alegar gates globais. `git fetch origin staging` confirmou d7580d07; integração por merge local sem conflitos **a950f33e**, preservando a correção de observadores TI/Admin. Não houve push. Nenhum conteúdo dos checkouts compartilhados sujos ou do Portal foi importado.

Artefatos reais: runner `scripts/checklist-analistas/staging-worker.mjs`, `ops/systemd/checklist-eventos-staging.service`, `.timer`, `.env.example`, regressões `tests/checklist-analistas/staging-worker.test.ts`. O runner não usa credenciais de banco e não executa SQL: exige o fingerprint staging verificado como atestado da configuração, além do origin e ambiente exatos. A comprovação do runtime remoto continua sendo gate operacional separado antes de instalar. Não basta um arquivo local correto para provar o banco do deploy.

CLI exige modo explícito `--once` para rede; `--check` e `--dry-run` apenas validam configuração. `--env-file` deve ser caminho absoluto terminando `.env.staging.local`, fora da release, arquivo regular0600, sem symlink. Não carrega `.env.local`, process.env, banco nem secrets de outro módulo. Timeout total30s, resposta até4096bytes e processed inteiro0–50, redirects bloqueados, Bearer só no header; saída exclusivamente envelope seguro, nunca corpo arbitrário do servidor. Lock local impede requisições simultâneas no mesmo processo; uma unit oneshot não é iniciada novamente enquanto ativa. A claim persistida da rota existente conserva concorrência entre processos.

Execução futura de validação, ainda sem publicação de eventos:

```sh
node scripts/checklist-analistas/staging-worker.mjs --check --env-file /etc/painel-alpha/checklist-eventos/.env.staging.local
node scripts/checklist-analistas/staging-worker.mjs --dry-run --env-file /etc/painel-alpha/checklist-eventos/.env.staging.local
```

**SUSPENSA nesta entrega (arquitetura §14):** a sequência histórica de instalação abaixo não deve ser executada. Transporte exclusivo journal/polling; não instalar/habilitar timer nem chamar worker. Uma eventual retomada de Pusher exige plano futuro separado.

1. Preparar release isolada em `/home/ialpha/deployments/checklist-eventos-staging/<sha-aprovado>` contendo runner e sua dependência dotenv resolvida; apontar `current` somente para essa release validada. Nenhuma cópia de env real para release. Verificar `/usr/bin/node` compatível e leitura da release pelo usuário ialpha.
2. Criar diretório de configuração `/etc/painel-alpha/checklist-eventos` com root:ialpha0750; editar arquivo `.env.staging.local` como ialpha:ialpha0600 a partir do template SEM copiar valores de produção. Preencher fingerprint verificado e segredo aleatório exclusivo staging, igual ao configurado na rota staging; bypass opcional exclusivo staging se necessário. Não colocar segredo na linha de comando, no Git nem no journal. Sem uso de EnvironmentFile pelo systemd: somente o runner lê esse arquivo explícito.
3. Executar --check e --dry-run; verificar origin/fingerprint, isolamento Pusher e deploy autorizado. Esses comandos NÃO chamam HTTP.
4. Validar units com `systemd-analyze verify <service> <timer>`; instalar somente essas2 units em `/etc/systemd/system/`, modo0644, após revisão dos caminhos. Rodar daemon-reload e `systemctl enable --now checklist-eventos-staging.timer`. Esta sequência é documentação; nada foi instalado agora.
5. Consultar `systemctl status checklist-eventos-staging.timer`, `systemctl list-timers checklist-eventos-staging.timer` e `journalctl -u checklist-eventos-staging.service`. Para smoke controlado, `systemctl start checklist-eventos-staging.service` já PUBLICA eventos e exige autorização operacional adequada. Esperar envelope safe processed/counts e E2E com evento sintético previamente aprovado; não forjar conta/cliente real.

Desativação/rollback futuro: `systemctl disable --now checklist-eventos-staging.timer`, `systemctl stop checklist-eventos-staging.service`; remover SOMENTE as2 units instaladas após conferir seus caminhos e rodar daemon-reload. Manter configuração0600 e evidência para diagnóstico ou remover exclusivamente arquivo dedicado em ação explícita posterior. Não apagar eventos/outbox nem executar reversão de banco. Não desativar cron/timers existentes, não alterar vercel.json nem produção.

Evidência focada:8 testes Vitest PASS, ESLint runner/teste zero diagnósticos, node --check PASS, TypeScript estrito focado PASS e diff-check PASS. Testes injetam fetch local; nenhuma chamada ao worker real. Cases: produção/URL alternativa/fingerprint/segredo inválidos bloqueados antes da rede; dry-run sem fetch; arquivo0600/symlink/default; POST/Bearer/bypass/redirect:error; erros HTTP/rede sem segredo; timeout/abort; execução simultânea; respostas HTML/JSON inválido/body excessivo/processed inválido. Os quatro gates globais NÃO foram executados nesta estação.

`systemd-analyze verify` das2units: exit0; warnings somente de units preexistentes do host (CPUAccounting removido e permissões executáveis em serviços não relacionados), sem instalar/modificar nenhuma delas.


# DevOps3 — preparação concreta da infraestrutura CheckList staging

22/10/2026. Estação serial concluída parcialmente: configurações staging e recursos vazios preparados; exportação de token Blob e gestão Pusher têm impedimentos de acesso comprovados. Não há deploy desta entrega nem homologação remota. Nenhuma alteração em produção, banco, objetos, timer ativo, backup, commit ou push.

## Configurado exclusivamente staging

- Portal custom environment `staging` criado201, ID `env_qYFh0wPmnBMHkAN0Q3sWKeR7aYHW`, tipo preview, branchMatcher equals staging. Sem copyEnvVarsFrom, sem cópia de banco/credenciais de produção. Não utilizar preview comum ou feature branch com herança de produção.
-10 registros novos do Portal nesse custom scope: DATABASE_URL sintático SQLite de build; TURSO_DATABASE_URL/TURSO_AUTH_TOKEN do banco staging previamente comprovado; AUTH_SECRET novo criptográfico exclusivo staging; AUTH_TRUST_HOST=true; CHECKLIST_TARGET_ENVIRONMENT, CHECKLIST_PANEL_ORIGIN, CHECKLIST_STAGING_DATABASE_SHA256, CHECKLIST_STORAGE_PREFIX, CHECKLIST_LEGACY_ALLOWED_HOSTS. Nenhum alvo production/preview genérico nesses registros: target=[], customEnvironmentIds exato.
-6 registros novos Painel somente custom staging existente `env_sKT0JOh0HB03g20jmcqN5pTHMjqT`: os5 CHECKLIST proof/prefix/allowlist acima + CHECKLIST_WORKER_SECRET novo criptográfico. Preservados todos os registros existentes, incluindo DB e auth do Painel. Não foi alterado BLOB_READ_WRITE_TOKEN global nem store CRM/NAS.
- Portal runtime `lib/prisma.ts` usa TURSO_DATABASE_URL e TURSO_AUTH_TOKEN; DATABASE_URL é somente o datasource SQLite exigido por generate/build. Hash SHA256 da URL remota **nova do Portal staging**, conferido por GET em memória: `7fdd160737ba6f9cf84d0ac2fb1c3cf1084311e7fccea454f7bac368f9e4d42b`, igual à URL CLI staging conhecida e distinto do banco produção. Nenhuma URL/token emitido nos relatórios. Existing sensitive URL Painel permanece redigida; ainda exigir prova efetiva ou override staging explicitamente conhecido antes do deploy/aplicação.
- Private store dedicado criado200: `store_IZKjlrpAjL248Ofn`, nome CHECKLIST-STAGING-20261022, access=private, iad1, disponível, size0/count0, quotaExceeded=false. Nenhum upload/read de objeto/cópia/exclusão. Nenhuma assinatura/upgrade/checkout. Operação rotineira de criação1AdvancedOperation no Pro existente autorizada expressamente pelo coordenador; não foi prometido custo de uso zero. Ver [preços oficiais](https://vercel.com/docs/vercel-blob/usage-and-pricing).
- Worker env dedicado fora Git,0600: `/home/ialpha/.config/painel-alpha/checklist-staging-20261022/.env.staging.local`. Contém somente proof/prefix/allowlist e segredo worker novo; não contém credenciais de DB/produção. Runner --check PASS, envelope dry-run/networkRequests0. Nenhuma instalação/enable/start de timer ou requisição ao worker.
- Config CLI pronta para Vault,0600, diretório0700: `/home/ialpha/.config/painel-alpha/checklist-staging-20261022/database/.env.staging.local`, somente alvo Turso staging conhecido e marcadores de prova. Arquivo real original root .env.staging.local preservado byte a byte. Nenhum script de banco/backup executado nesta estação.

## Hostname Portal staging preparado, sem alegar disponibilidade

Autoridade DNS alpha-comex.com é Cloudflare; hostname `clientes-staging.alpha-comex.com` já resolvia IPs Vercel antes da operação (possível wildcard). Metadata do domínio/alias/projeto indicava ausência de associação a projeto/alias para esse nome; o Portal tinha somente alphaclientes.vercel.app. Adicionado NOVO domínio ao Portal por POST200, vinculado exclusivamente ao custom environment staging acima; verified=true. Não usado endpoint move/transfer, não alterado qualquer DNS, CNAME, nameserver, domínio de outro serviço ou produção. Não comprado domínio.

Proteção SSO Portal `all_except_custom_domains` permanece exatamente igual. A associação custom não desabilita a proteção global. Certificado/HTTP/alias deployment ainda dependem do primeiro deployment staging READY; HTTPS antes da associação não era utilizável e nenhum deployment foi criado nesta estação. **Não declarar URL funcional nem enviar links de reset agora.** CHECKLIST_PORTAL_ORIGIN de prova CLI e NEXT_PUBLIC_CHECKLIST_PORTAL_ORIGIN do Painel permanecem pendentes até READY/alias/certificado/HTTP autenticado comprovados. AUTH_URL explícito também não inventado; NextAuth inferirá origin do host isolado com AUTH_TRUST_HOST e segredo novo, confirmar no smoke.

## Blob: impedimento autêntico, token NÃO configurado

GET `/v1/storage/stores/{store_IZKjlrpAjL248Ofn}/secrets` respondeu HTTP403 `challenge_required`: Vercel exige autenticação renovada/step-up para exportar a credencial. Não foi contornado o desafio e nenhum token foi obtido/exportado/configurado. Store permanece vazio e sem projetos conectados. CHECKLIST_PRIVATE_BLOB_TOKEN está AUSENTE em ambos custom environments; uploads privados continuam indisponíveis até configurar essa credencial.

Fluxo nativo de conexão inspecionado no código oficial do Vercel CLI instalado, versão 64.0.2: connectStoreToProject usa POST `/v1/storage/stores/{id}/connections` com envVarEnvironments; validateEnvironments aceita apenas production/preview/development. Não suporta custom scope pelo fluxo oficial inspecionado. Por isso não foi feito POST de conexão com escopo desconhecido/default/broad preview nem criado alias de variável que pudesse alcançar produção. Nome CHECKLIST_PRIVATE_BLOB_READ_WRITE_TOKEN seria um prefixo gerenciado possível apenas em ambiente suportado; não existe como configuração criada e não exige alteração de adapter nesta entrega enquanto não houver binding válido.

Próxima ação de acesso: responsável pela conta precisa concluir reautenticação/step-up legítimo na Vercel e configurar **CHECKLIST_PRIVATE_BLOB_TOKEN** do NOVO store privado somente nos dois custom environments staging; nunca enviar segredo pelo chat. DevOps pode continuar a operação após essa autenticação válida. Sem uso de functions/logs/ambiente público como via alternativa de exportação.

## Pusher: capacidade de gestão ausente

- Projetos/env oferecem somente credenciais do app existente: PUSHER_APP_ID, PUSHER_SECRET, NEXT_PUBLIC_PUSHER_KEY, NEXT_PUBLIC_PUSHER_CLUSTER. Nenhum token de gestão de conta local/process.env/config disponível.
- GET Vercel integrations/configurations view=account e view=project retornaram arrays vazios;0 integração nativa Pusher para provisionar. ALL_TOOLS não oferece gestão Pusher. Documentação HTTP oficial Pusher cobre API de APP/eventos/canais, não autoriza usar app secret como credencial administrativa de conta: [referência oficial](https://pusher.com/docs/channels/library_auth_reference/rest-api/).
- Nenhum app foi criado e nenhuma credencial Pusher foi modificada. Staging continua no mesmo app/key da produção identificados no preflight. Isso NÃO é isolamento por app.
- Root deve decidir com Aria, ANTES Forge, se aplica namespace server/auth/worker/client exclusivo CheckList staging com testes, documentando app compartilhado como residual preexistente. Esta estação não alterou código nem inventou essa alternativa como aprovada. A outra solução é credencial/admin legítimo criar app Pusher dedicado dentro do plano existente, sem solicitar segredo por chat.

## Preservação, rollback e evidências

Comparação metadata antes/depois:16 registros novos,0 registros originais alterados,0 registros production alterados. Targets dos novos registros são[] e cada customEnvironmentIds tem exatamente um staging ID. Branch de produção continua main e aliases/deployments atuais mantidos; sem deploy. SSO global preservado. IDs exatos dos16 registros e scopes estão em `/tmp/checklist-analistas-20261022-infra-after.json` e no JSON consolidado, sem valores secretos.

Rollback futuro concreto, se solicitado: remover APENAS os16 novos registros por ID depois de conferir novamente key/custom scope/proveniência; remover somente domínio novo clientes-staging do Portal e custom environment novo se ainda não houver uso/deploy dependente; excluir somente store novo se metadata ainda comprovar size0/count0/nenhuma conexão/nenhum consumidor, em ação específica posterior. Não excluir/alterar records originais, global Blob, stores CRM/NAS, production, DB, eventos ou dados. Configs locais dedicadas permanecem0600; nenhuma remoção de arquivo secreto foi realizada como parte deste preflight. Rollback não foi executado.

JSON consolidado: `/tmp/checklist-analistas-20261022-infra-preparation.json`. Snapshots seguros: infra-before.json, infra-after.json, infra-mutations.jsonl, infra-dns-before.json; todos prefixados `/tmp/checklist-analistas-20261022-`. Segredos novos ficam exclusivamente em diretório privado0700 fora Git; não versionar ou imprimir seus arquivos. Documento ops atualizado por append; fontes Dara/Echo/Nova/Sage e roots sujos preservados.

Próximo: Aria para decisão Pusher; Vault para revisão SQL independente/backup/consentimento; resolver autenticação Blob antes de homologar upload; gates globais/revisões; apenas depois aplicação/deploy staging autorizado, leitor Portal compatível antes dos hashes/escritor Painel. Produção continua sem autorização de promoção.


## Aria — transporte e rollout revisados

Decisão normativa: docs/architecture/checklist-analistas-crm-20261022.md §14; handoff /tmp/checklist-analistas-20261022-aria-isolation.md. Namespace isolado não basta no app compartilhado porque produção antiga assina canais desconhecidos. CheckList usará somente journal+polling autenticado, nenhuma assinatura/trigger Pusher. Worker validará segredo e retornará processed0/transportpolling sem claims/updates/retries; publicadoEm não será falsificado. **Não instalar/habilitar timer no modo polling**: instruções anteriores de enable ficam suspensas. Outros módulos Pusher permanecem preexistentes e fora do escopo. Sem novo app pago/requisito inventado.

Rollout após gates/Vault/backup/consentimento: schema/bootstrap/grant aprovados → Portal leitor READY validado → Painel escritor hash READY, escritores plaintext antigos cessados → hashbatch legado CAS e reconciliação. Worker permanece inativo por polling. Essa ordem evita reintroduzir plaintext após o batch. Sem rollback para leitor plaintext depois de introduzir hashes. Blob depende de step-up legítimo e token checklist-only; hostname Portal preparado ainda sem READY/HTTP. Produção inalterada.


## Vault — supersessão do plano inicial,22/10/2026

Backup completo staging criado e restaurado/verificado (337tabelas reais/295932linhas/949índices/2triggers), novo relatório `docs/vault/checklist-analistas-20261022.md` contém paths/hashes/manifestos/67statements individuais/impactos/rollback e planos dry-run. Execução NÃO AUTORIZADA; Forge/revisões e correção do rótulo hash pela Dara ainda precedem apresentação e consentimento específico.

As referências históricas acima a ativar timer e hashbatch antes do escritor novo estão SUPERADAS pela arquitetura§14: transporte exclusivamente journal/polling, sem timer/Pushertrigger; Portalreader validado PRIMEIRO, Painel hashwriter novo e cessação do antigo DEPOIS, só então legado hashbatch. Alias novo não comprova URLs antigas inacessíveis; ver gate operacional de cessação no relatório Vault. Nenhum deployment/timer foi alterado nesta estação.


### Dara — fechamento do rótulo de fase,22/10/2026

Novo planSha256 `hash-contas`: `1bd13b1afa8b4d27abd0745db15619a6583166c5b36bda98622ca5aea806254c`; dry-run real staging às18:06:46UTC de22/10/2026,2conversões projetadas/0inválidas/0bloqueios/0mutações. Plano privado0600: `/tmp/checklist-vault-20261022/plans/hash-contas-phase-corrected.json`; resumo seguro0600: `/tmp/checklist-vault-20261022/hash-contas-phase-summary.json`. Diagnóstico idêntico ao anterior; operationPlan difere somente em phase. Hash antigo3264ef79… continua histórico, NÃO USAR PARA APPLY.

Sequência atual §14: schema/bootstrap3/grant5 → Portal leitor READY validado → Painel escritor hash READY e cessação operacional do antigo → hashbatch → validação polling. CLI continua checando reader; cessação writer exige gate externo explícito. A seção histórica de instalação recebeu marcação SUSPENSA no próprio ponto: não instalar/habilitar timer nem chamar worker nesta entrega. Sem alteração de fontes de timer, backup, demais3planos, cloud ou deploy.
