# Alpha Explorer SMB — implantação e operação do piloto

## Resultado e modelo de acesso

O usuário continua entrando com a conta normal do Painel Alpha. Um administrador autorizado vincula uma vez a conta local corporativa do QNAP pelo painel `/PainelAlpha/ExploradorArquivos/AdministracaoQnap`. O navegador administrativo envia a credencial diretamente ao gateway HTTPS no `ialpha`; a Function/Vercel não recebe a senha. O gateway valida a conta no QNAP e guarda o vínculo no HashiCorp Vault KV v2.

Nos acessos seguintes, o Painel emite tickets HMAC de 45 segundos, vinculados à sessão, origem, operação e handle opaco. O gateway recupera a credencial no Vault apenas em memória e abre uma sessão SMB3 separada como aquele usuário. As ACLs do QNAP, e não o papel de administrador do Painel, decidem quais pastas aparecem e quais operações funcionam.

Não existe fallback para a conta técnica do mount, não existe senha QNAP no Turso e não existe migração dos arquivos QuObjects/Vercel.

## URLs atendidas

- Produção: `https://painel.alpha-comex.com/PainelAlpha/ExploradorArquivos`
- Stage: `https://stagealpha-sistema.alpak.ai/PainelAlpha/ExploradorArquivos`

Para CORS e tickets, configure somente os origins, sem path:

- `https://painel.alpha-comex.com`
- `https://stagealpha-sistema.alpak.ai`

## Tutorial de ativação

1. No QNAP, abra **Painel de Controle → Rede e Serviços de Arquivo → Win/Mac/NFS → Microsoft Networking** e confirme SMB ativo, SMB mínimo 3 e assinatura habilitada. O gateway exige assinatura e negocia encryption quando o servidor oferecer suporte; valide ambos com as duas contas piloto.

2. Em **Painel de Controle → Privilégio → Pastas Compartilhadas**, identifique somente as shares que pertencem ao Alpha Explorer. Não publique nenhuma share. `ONYX` atende outro sistema e deve ficar fora da allowlist do Explorer.

3. Em **Usuários** e **Grupos de Usuários** do QNAP, crie ou escolha duas contas de teste sem dados reais. Dê permissões diferentes em uma pasta sintética, por exemplo uma conta com leitura/escrita e outra sem acesso. Confirme o resultado primeiro em um cliente SMB comum.

4. Provisione um HashiCorp Vault separado do processo web. Habilite KV v2 em um mount dedicado e crie policy mínima para `data/smb-bindings/*` e `metadata/smb-bindings/*`. O token/AppRole do gateway não deve listar ou ler outros namespaces.

5. No Linux Server `ialpha`, crie um usuário de serviço sem shell, diretórios de runtime e arquivos de credencial com proprietário exclusivo e modo `0600`. Use `systemd LoadCredential` ou mecanismo equivalente para entregar token do Vault e dois segredos HMAC distintos; não grave esses valores no repositório ou na conversa.

6. Instale o gateway em ambiente isolado:

   ```bash
   python3 -m venv ops/alpha-explorer-gateway/.venv
   ops/alpha-explorer-gateway/.venv/bin/pip install -r ops/alpha-explorer-gateway/requirements.txt
   ops/alpha-explorer-gateway/.venv/bin/pytest -q ops/alpha-explorer-gateway/tests
   ```

7. Configure o runtime do gateway conforme [README do gateway](../../ops/alpha-explorer-gateway/README.md). Defina `SMB_GATEWAY_SMB_SERVER` com o endereço interno do QNAP. Por padrão, o gateway descobre automaticamente as shares usando a conta QNAP vinculada, testa o acesso real e mostra somente as acessíveis; `SMB_GATEWAY_SMB_SHARES` é opcional e serve apenas para restringir ainda mais esse catálogo. `ONYX`, shares administrativas/ocultas e shares de impressão são sempre bloqueadas. Configure caminhos distintos para `replay.sqlite3` e `state.sqlite3`, Vault URL/mount/prefix e os dois origins exatos. Prefira as variáveis `SMB_GATEWAY_TICKET_SECRET_*_FILE`.

8. Mantenha o gateway em loopback (`127.0.0.1:8765`). A publicação HTTPS, rota do Cloudflare Tunnel, firewall, usuário systemd e health check pertencem ao DevOps e precisam ser aprovados antes de receber credenciais reais. Não altere o tunnel de storage existente.

9. No ambiente do Painel de stage e no ambiente de produção, cadastre as variáveis `ALPHA_EXPLORER_SMB_*` listadas em `.env.example`. Use `ALPHA_EXPLORER_SMB_RUNTIME=stage` no stage e `production` na produção. Cada deployment recebe somente seu próprio issuer, `kid` e segredo genéricos; nunca cadastre a chave de produção no stage. Nunca use `NEXT_PUBLIC_`.

10. Confirme que os valores de origin são exatamente os dois hosts acima e que `ALPHA_EXPLORER_SMB_GATEWAY_URL` é a URL HTTPS pública aprovada do gateway. O path `/PainelAlpha` não entra na variável de origin.

11. Execute o diagnóstico do storage legado para garantir rollback:

    ```bash
    npm run storage:doctor
    ```

12. Com configuração real já provisionada, execute:

    ```bash
    npm run explorer:smb:doctor
    npm run explorer:smb:health -- --user-id=<ID_INTERNO_PILOTO> --origin=https://stagealpha-sistema.alpak.ai
    ```

    A saída deve ser JSON sanitizado. Ela não deve mostrar ticket, senha, principal QNAP ou path completo.

13. Deixe `ALPHA_EXPLORER_SMB_ENABLED=false`, `ALPHA_EXPLORER_SMB_ENROLLMENT_ENABLED=false` e `ALPHA_EXPLORER_SMB_WRITE_ENABLED=false` até o gateway, Vault e teste diferencial estarem verdes.

14. Habilite primeiro `ALPHA_EXPLORER_SMB_ENABLED=true` somente no stage, mantendo enrollment e escrita desligados. Confirme health e comportamento de indisponibilidade. A flag geral `ALPHA_EXPLORER_ENABLED` também precisa permanecer ativa.

15. Habilite enrollment no stage. O administrador abre **Explorer → Administrar QNAP**, seleciona o usuário Alpha e informa o principal e a senha QNAP. Não é necessário reiniciar a sessão nem preencher justificativa. O administrador pode substituir a senha, mas nunca recuperar ou visualizar a senha armazenada.

16. Entre como usuário A e confirme que aparecem somente as pastas permitidas no QNAP. Entre como usuário B e confirme a visão diferente. Entre como administrador do Painel sem ACL QNAP e confirme que não existe bypass.

17. Ainda em modo leitura, teste navegação, paginação e download pequeno. Download usa streaming direto gateway → navegador e requer Chrome/Edge ou outro navegador com File System Access API; o arquivo não passa pela Vercel.

    A versão piloto limita o offset de diretório a 2.000 entradas e aplica rate limit próprio à listagem. Diretórios maiores exigem uma evolução para cursor nativo do SMB/indexação autorizada; o gateway não aceita varredura arbitrária de 100 mil entradas.

18. Habilite `ALPHA_EXPLORER_WRITE_ENABLED=true` e `ALPHA_EXPLORER_SMB_WRITE_ENABLED=true` somente no stage. Em pasta sintética, teste criar pasta, upload, download/checksum, rename, move de arquivo, lixeira e restore. Move recursivo de diretório é intencionalmente bloqueado nesta versão.

19. Interrompa uma parte de upload e confirme cancelamento/reconciliação. Execute reconciliação primeiro em dry-run. Não use pasta departamental real para smoke destrutivo.

20. Valide logs: devem conter support ID, ação, resultado e identidade pseudonimizada, sem senha, principal QNAP, ticket, URL com query ou path sensível. Monitore também Vault indisponível, QNAP indisponível, tickets rejeitados, sessões incompletas e `MOVE_RECONCILIATION_REQUIRED`.

21. Após aprovação de Security/DevOps e smoke do stage, repita em produção primeiro com leitura, depois enrollment, por último escrita para grupo piloto. Produção e stage usam issuer, `kid` e segredo distintos. O gateway pode verificar ambos; cada runtime do Painel conhece apenas o seu.

22. Para rollback, defina `ALPHA_EXPLORER_SMB_WRITE_ENABLED=false` e depois `ALPHA_EXPLORER_SMB_ENABLED=false`. O Explorer volta ao backend QuObjects/Vercel existente; arquivos SMB, objetos legados e vínculos Vault não são apagados.

## Banco de dados e Vault

A migration aditiva `20260916145000_alpha_explorer_smb_binding` foi aplicada ao Turso de produção em 2026-09-16 após protocolo Vault, backup completo restaurado/validado e autorização explícita. `AlphaExplorerSmbBinding` guarda somente `userId`, principal NAS, hashes/referência opaca, estado, versão e datas; o status administrativo reconcilia esses metadados com a resposta autenticada do gateway. A senha permanece exclusivamente no Vault. As quatro tabelas Alpha Explorer anteriores continuam pertencendo ao backend de object storage. O SQLite local do gateway mantém apenas anti-replay, rate limit, uploads e lixeira; ele não contém senha QNAP.

## Runtime provisionado no `ialpha`

Em 2026-09-16 o stage recebeu o runtime operacional abaixo:

- `alpha-explorer-vault.service`: Vault Community 2.1.0 fixado por digest, TLS local, Raft persistente e auto-unseal por credencial `systemd-creds` vinculada ao host e TPM 2.0;
- `alpha-explorer-gateway.service`: usuário Linux dedicado, filesystem protegido, credenciais entregues pelo systemd, release imutável em `/opt/alpha-explorer-gateway/current` e bind exclusivo em `127.0.0.1:8765`;
- endpoint público `https://explorer-gateway.alpha-comex.com`, publicado pelo tunnel existente somente para o gateway;
- CORS restrito aos origins de produção e stage;
- KV v2 `alpha-explorer/` com policy limitada a `smb-bindings/*` e auditoria do Vault habilitada;
- snapshot inicial verificado em `/var/backups/alpha-explorer-vault/bootstrap-20260916.snap`;
- escrita SMB desabilitada no rollout inicial; enrollment e leitura habilitados no stage.

O catálogo raiz não exige cadastro manual de pastas. Após o vínculo administrativo, o gateway enumera as shares com a própria conta QNAP do usuário, testa a abertura de cada uma e entrega somente as acessíveis. A restrição `SMB_GATEWAY_SMB_SHARES` permanece vazia no stage; pode ser preenchida futuramente para reduzir o catálogo, nunca para ampliar ACL do QNAP.

O deployment Vercel de produção ainda precisa receber sua autoridade `ALPHA_EXPLORER_SMB_*` de produção pelo gerenciador de ambiente da Vercel. O stage e a produção não compartilham segredo de ticket.

## Checklist de produção

- [ ] SMB3 e assinatura confirmados; suporte a encryption registrado no diagnóstico do QNAP.
- [ ] Duas contas QNAP sintéticas com ACLs diferentes testadas.
- [ ] Criação de symlink/reparse negada ao usuário piloto ou corrida concorrente comprovadamente bloqueada no QNAP.
- [ ] Admin do Painel sem bypass QNAP comprovado.
- [ ] Vault KV v2, policy mínima e recuperação testados.
- [ ] Segredos distintos de stage/produção entregues por canal seguro.
- [ ] Gateway systemd/TLS/tunnel/firewall aprovados por DevOps/Security.
- [ ] CORS contém somente os dois origins exatos.
- [ ] Doctor e health reais aprovados.
- [ ] Enrollment administrativo com sessão recente aprovado no stage.
- [ ] Allowlist multi-share validada e `ONYX` ausente.
- [ ] Smoke leitura e escrita com cleanup verificado.
- [ ] Logs inspecionados sem credenciais ou tickets.
- [ ] Flags de rollback testadas.
- [ ] Usuário responsável aceitou as limitações do piloto.
