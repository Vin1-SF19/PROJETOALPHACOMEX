# Alpha Explorer — operação do piloto

O Alpha Explorer usa o QuObjects como provider primário. O Blob é somente fallback de uma nova escrita, selecionado antes do upload; não é backup nem réplica. As credenciais permanecem no backend.

## Colocação em funcionamento

1. No QNAP, abra **App Center → QuObjects** e confirme que o serviço está ativo e saudável.
2. Em **QuObjects → Storage Spaces**, confirme o espaço `painel-alpha-poc`; em **Buckets**, confirme `pa-poc-private` como privado. Não habilite acesso público.
3. Nas propriedades de `pa-poc-private`, confirme o versionamento. Versionamento do bucket não substitui a lixeira do aplicativo.
4. Em **QuObjects → Access Keys/Users**, crie ou valide uma identidade técnica exclusiva do backend, limitada ao espaço/bucket do Painel. Nunca crie chaves por usuário do painel.
5. No Linux Server `ialpha`, execute `systemctl status cloudflared` e confirme que o tunnel publica `storage-poc.alpha-comex.com`. Não mova o tunnel para o NAS.
6. Em **QuObjects → CORS**, permita somente as origens HTTPS exatas do Painel Alpha. Habilite `GET`, `PUT` e os headers exigidos pelo multipart; exponha `ETag`. Não use origem `*`. Exemplo conceitual:

   ```json
   [{
     "AllowedOrigins": ["https://PAINEL-PRODUCAO", "https://PAINEL-STAGING"],
     "AllowedMethods": ["GET", "PUT"],
     "AllowedHeaders": ["content-type", "content-length", "x-amz-*"],
     "ExposeHeaders": ["ETag"],
     "MaxAgeSeconds": 300
   }]
   ```

7. No ambiente server-side da aplicação — `.env.local` localmente e **Vercel → Project Settings → Environment Variables** no deploy — configure as variáveis `STORAGE_QUOBJECTS_*`, `STORAGE_VERCEL_*` e os limites `STORAGE_MULTIPART_*` descritos em `.env.example`.
8. Confirme que nenhuma variável secreta começa com `NEXT_PUBLIC_`. Não coloque access key, secret, token Blob ou URL assinada em componentes, Turso ou logs.
9. Na raiz do repositório, rode `npm run storage:doctor`, `npm run explorer:doctor`, `npm run explorer:permissions -- --user-id=ID_INTERNO --path=PREFIXO --capability=list`, `npm run explorer:list -- --user-id=ID_INTERNO --prefix=PREFIXO --limit=20` e `npm run explorer:reconcile -- --user-id=ID_ADMIN --prefix=`.
10. A migration `20260915191500_alpha_explorer_foundation` já foi aplicada pelo protocolo Vault, após backup específico e autorização. Em outro ambiente, repita Vault; nunca use `prisma db push` ou aplique SQL sem backup verificado.
11. Habilite primeiro somente leitura: `ALPHA_EXPLORER_ENABLED=true`, `ALPHA_EXPLORER_WRITE_ENABLED=false` e `ALPHA_EXPLORER_FALLBACK_ENABLED=false` no ambiente alvo.
12. Execute o smoke NAS: `npm run explorer:smoke -- --execute --confirm=storage-alpha-poc --provider=quobjects --size=10MiB`. Confirme `checksumVerified=true` e `cleanupSucceeded=true`.
13. Após o smoke, configure `ALPHA_EXPLORER_WRITE_ENABLED=true`. A escrita continua sendo revalidada por usuário e prefixo.
14. Em **Painel Alpha → Gestão de Equipe → permissões**, conceda o módulo `exploradorArquivos` ao usuário/setor piloto. Para a ACL granular, primeiro revise o dry-run: `npm run explorer:acl-set -- --user-id=ID_ADMIN --subject-type=USER --subject-id=ID_PILOTO --prefix=comercial --capabilities=list,read,upload,create_folder,rename,move,delete,restore`. Para aplicar, repita com `--execute --confirm=alpha-explorer-acl`. Use ID interno; nunca e-mail, CPF ou nome. Alteração gera auditoria.
15. Entre com o piloto autorizado, abra `/PainelAlpha/ExploradorArquivos` e confirme que apenas os prefixes permitidos aparecem.
16. Entre com um usuário ativo sem a permissão do módulo e confirme redirecionamento/negação; tente também chamada direta à API e confirme `403`/`404`, sem metadados do objeto.
17. Com um arquivo sintético pequeno, teste pasta, upload, progresso, download, rename, move, lixeira e restauração. Confirme que o objeto não é apagado fisicamente ao ir para a lixeira.
18. Para fallback, primeiro use um store Blob **privado** e configure `STORAGE_VERCEL_ACCESS=private`. Rode o smoke explícito do Blob. Depois simule indisponibilidade do NAS antes de iniciar uma sessão, habilite temporariamente `ALPHA_EXPLORER_FALLBACK_ENABLED=true` e confirme que a UI informa `Vercel Blob`. O backend usa uma URL GET assinada, restrita ao objeto e válida por 120 segundos. Reative o NAS e desligue a flag. Nunca interrompa um multipart real no meio para testar.
19. Reinicie o processo local ou faça o deploy normal do Painel Alpha para carregar variáveis alteradas. DNS, bucket e tunnel não precisam ser alterados pelo deploy.
20. Monitore logs estruturados com `scope=alpha-explorer`, taxas de erro por provider, `expiredSessions`, `pendingOperations` e uso do fallback. Rode `npm run explorer:reconcile -- --user-id=ID_ADMIN --prefix=` periodicamente no piloto. Para abortar somente sessões já expiradas, revise primeiro o dry-run e então rode `npm run explorer:reconcile -- --user-id=ID_ADMIN --prefix= --execute --confirm=alpha-explorer-reconcile`; sessões Blob ficam explicitamente marcadas para reconciliação porque o SDK não expõe abort multipart server-side.
21. Para rollback, defina primeiro `ALPHA_EXPLORER_WRITE_ENABLED=false` e depois `ALPHA_EXPLORER_ENABLED=false`, faça redeploy/restart e preserve tabelas e objetos. Remover tabelas ou objetos exige outro Vault e outra autorização explícita.

## Checklist de produção e aceite

- [ ] QuObjects, bucket privado e versionamento confirmados.
- [ ] Identidade técnica de privilégio mínimo validada.
- [ ] Tunnel no Linux saudável.
- [ ] CORS restrito às origens exatas e `ETag` exposto.
- [ ] Segredos somente no ambiente server-side.
- [ ] `storage:doctor` e CLIs do Explorer aprovados.
- [ ] Leitura habilitada antes da escrita.
- [ ] Smoke NAS com cleanup aprovado.
- [ ] Store de fallback privado e smoke controlado aprovado antes de habilitar fallback.
- [ ] Usuário autorizado testado.
- [ ] Usuário negado testado.
- [ ] Upload, download, rename, move, lixeira e restauração aceitos.
- [ ] Logs e reconciliação monitorados.
- [ ] Responsável aprovou o piloto.
