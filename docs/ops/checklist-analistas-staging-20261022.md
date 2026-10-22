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

Service: Type=oneshot, usuário de serviço sem privilégios, EnvironmentFile staging explícito, WorkingDirectory release imutável, ExecStart node runner, TimeoutStartSec=40, NoNewPrivileges=true. Timer: OnBootSec=30s, OnUnitActiveSec=60s, Persistent=true, precisão1s; systemd serializa a mesma unit, e worker já claim/retry persistido. Instalação futura exata: validar runner --check sem rede, instalar3 artefatos, daemon-reload, enable/start timer staging, verificar histórico/auth e entrega de evento sintético autorizado. Rollback: disable/stop apenas esse timer e retirar apenas suas units; não apagar eventos/outbox nem mexer em produção. Frequência é decisão operacional revisável, não SLA prometido.

Referências oficiais conferidas: [Cron quickstart](https://vercel.com/docs/cron-jobs/quickstart), [Cron overview](https://vercel.com/docs/cron-jobs), [Gerenciar e autenticar cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs). Explicam produção somente, GET e CRON_SECRET. Não foi contratado serviço/upgrade.

## Isolamento e configuração futura antes de qualquer push/deploy Portal

- Painel tem custom staging e branchMatcher exato staging. Pusher appId/key de staging e produção possuem hashes iguais: **mesmo app atual**. Canal private-checklist-docs é fixo; prefixo no storage não isola realtime. Usar app Pusher próprio staging, suas quatro variáveis no staging apenas, validar que o app hash difere de produção. Não trocar credenciais de produção.
- Portal não tem custom staging nem branch staging publicada. DATABASE_URL/TURSO_DATABASE_URL/TURSO_AUTH_TOKEN/ AUTH_SECRET/Blob têm escopo production+preview. **Não fazer push/preview antes de criar isolamento.** Preferir custom environment staging branchMatcher exato staging e alias próprio de staging; alternativa é projeto Portal staging independente se plano não permitir customenv, preservando production. Verificar disponibilidade/preço antes de operação que cobre; nada contratado.
- Portal staging aponta ao MESMO banco staging canônico do Painel; segredo de sessão exclusivo staging, cookie/origins do próprio staging. DATABASE_URL deve cumprir build local/Prisma conforme projeto, TURSO url/token fixam runtime efetivo; confirmar ambos. Nunca copiar banco/dados/arquivos env/credenciais de produção. Não usar preview comum herdando produção.
- Criar/configurar store Blob **privado dedicado ao CheckList staging** e vinculá-lo aos dois apps somente staging com `CHECKLIST_PRIVATE_BLOB_TOKEN`. Metadata da equipe mostra2stores privados de outros módulos e nenhum token CHECKLIST configurado: existência deles não autoriza reutilizar. Preservar BLOB_READ_WRITE_TOKEN global e stores CRM/StorageNAS.
- Definir `CHECKLIST_STORAGE_PREFIX` com namespace/prefixo staging; `CHECKLIST_LEGACY_ALLOWED_HOSTS` JSON exato (atualmente `[]` é suficiente para0docs/0fotos; novo diagnóstico decide); `CHECKLIST_WORKER_SECRET` exclusivo staging; `NEXT_PUBLIC_CHECKLIST_PORTAL_ORIGIN` alias real Portal staging, nunca fallback de produção. Pusher4vars no Painel; Portal novo journal/SSE não depende de publicador paralelo legado.
- Para CLI autorizado preparar explicitamente `.env.staging.local` com CHECKLIST_TARGET_ENVIRONMENT, CHECKLIST_PANEL_ORIGIN e CHECKLIST_STAGING_DATABASE_SHA256, sem alterar o default `.env.local`; evidência antes de aplicar. Não foi configurado agora.

## Aplicação futura e rollback, dependentes de Vault/consentimento

Sequência proposta: integrar delta staging no worktree; preparar scripts faltantes; concluir Nova/Sage/Forge/Probe/Anubis/Lens/QA; configurar isolamento staging revisável; Vault levantar backup COMPLETO novo no pre-change, restaurar/verificar integrity/FK/counts/SHA/idade<=48h; apresentar plano exato com fingerprints/hashes e pedir confirmação específica. Depois de autorização: aplicar DDL aditivo30colunas+5tabelas, bootstrap3modelos, permissão setorial5vínculos; publicar leitor Portal compatível e validá-lo; hashbatch2contas e escritor Painel seguindo plano; habilitar timer e E2E staging autorizado. Nova criação interna não pode preceder leitor Portal compatível. Todos os counts/planHashes devem ser recalculados e qualquer divergência interrompe execução.

Ledger ausente não autoriza criar/baselinar histórico inteiro: nunca rodar migrate deploy cego nem inventar migrate resolve applied. Aplicador custom só DDL aprovada/verificada; decisão de ledger, se necessária, requer plano próprio revisado. Os3modelos não têm colisões nesta fotografia, mas bootstrap continua separado e não altera instâncias/snapshots antigos.

Os4 donos ficarão NULL; não inferir por pasta/CNPJ/nome. Líder com permissão efetiva poderá atribuir dono explicitamente pelo fluxo novo. Não incluir backfill automático no plano.

Rollback preferido: manter schema aditivo e leitor compatível com bcrypt/versões/eventos; reverter apenas código compatível. Não voltar a autenticador exclusivamente plaintext nem reconstruir senha antiga. Reversão da permissão exige snapshot exato, pós-CAS e plano específico sem apagar alterações posteriores. Restore de banco exige avaliar writes posteriores e novo consentimento, nunca DROP automático. Não deletar documentos/contas/empresas para rollback.

## Evidências e limites

JSON seguro consolidado `/tmp/checklist-analistas-20261022-operational-preflight.json`; detalhe agregado `/tmp/checklist-analistas-20261022-staging-counts.json`; metadata Vercel/escopos/fingerprints e configuração do líder em arquivos `/tmp/checklist-analistas-20261022-preflight-*.json` e `leader-permission.json`. Nenhum token/URL documental/senha salvo nesses artefatos. Biblioteca de diagnóstico usou staging real em read-only; nenhuma validação remota autenticada de UI, upload ou worker foi feita. Gates globais não executados nesta estação de preflight. Roots/arquivos de ambiente preservados; somente este documento local novo foi criado no worktree. Produção permanece sem configuração/publicação autorizada.
