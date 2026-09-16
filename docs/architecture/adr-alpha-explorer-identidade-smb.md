# ADR — Identidade SMB do Alpha Explorer

- **Status:** aprovado para implementação incremental, condicionado aos gates de segurança
- **Data:** 2026-09-15
- **Revisão:** 2026-09-16 — enrollment administrativo write-only
- **Escopo:** Alpha Explorer sobre compartilhamentos SMB do QNAP

## Contexto

As pastas departamentais existem em shares SMB do QNAP, e não no bucket QuObjects. Somente shares incluídas em allowlist específica do Alpha Explorer pertencem a este escopo. A share e o mount `ONYX` atendem outro sistema e não podem ser reutilizados, inspecionados ou alterados pelo Explorer sem autorização separada.

O Painel usa contas locais no Turso/NextAuth e o QNAP usa contas locais próprias. Não há AD, LDAP ou Kerberos compartilhado. Um mount feito com identidade técnica mascara as ACLs individuais e, por isso, não pode decidir o que cada pessoa realmente acessa.

O usuário aprovou a experiência de vínculo único administrado: um administrador autorizado associa o usuário interno a uma conta corporativa do QNAP e informa ou rotaciona a credencial uma vez. O usuário final não redigita a senha no uso normal. A senha precisa ser reutilizável para novas sessões NTLM, mas não pode ficar no Turso, perfil, cookies, browser storage, telemetria, logs ou variáveis por usuário.

## Decisão

Adotar duas camadas independentes e cumulativas:

1. O Painel autentica a pessoa e exige usuário ativo + permissão `exploradorArquivos`.
2. Um gateway local no `ialpha` abre sessão SMB como o principal QNAP vinculado. O próprio QNAP é a autoridade final de ACL para listar, ler e modificar.

O piloto usará HashiCorp Vault KV v2 (ou secret manager compatível com a mesma interface) como cofre externo. O provider em memória é permitido somente em testes. O runtime não possui fallback para arquivo local. A proteção do segredo deve obedecer:

- o gateway não implementa criptografia caseira nem mantém KEK no checkout; a criptografia em repouso e o envelope são responsabilidade da barreira de segurança/seal do Vault ou do KMS do provider aprovado;
- credenciais de AppRole/token são entregues ao processo dedicado por `systemd LoadCredential`/tmpfs, nunca pelo usuário do web app, arquivo versionado ou variável exposta ao frontend;
- o transporte gateway → cofre usa TLS validado e a policy concede somente operações KV v2 no namespace dedicado;
- cada vínculo ocupa namespace derivado de `(iss, aud, sub)`, impedindo colisão entre stage e produção;
- a senha existe em claro apenas na memória durante enrollment, leitura do Vault e abertura da sessão SMB;
- troca, desvinculação ou falha de autenticação revoga sessões e substitui/remove a versão do segredo.

Após protocolo Vault específico, backup verificado e autorização explícita em 2026-09-16, a administração centralizada passou a guardar no Turso somente `userId`, principal NAS, hashes/referências opacas, estado, versão e datas operacionais. O segredo reutilizável continua exclusivamente no Vault. Senha, ciphertext, DEK, token do Vault e material equivalente permanecem proibidos no Turso.

O estado-alvo continua sendo AD/LDAP/Kerberos. O provider do cofre e o adapter de identidade serão interfaces substituíveis para permitir migração sem alterar o contrato do Explorer.

## Fluxo e fronteiras

```text
Painel/NextAuth -> ticket HMAC curto -> navegador -> gateway ialpha -> SMB3/NTLM -> QNAP
```

- Stage e produção usam emissores, `kid`, segredos HMAC e namespaces de cofre separados. O control plane emite HS256/HMAC-SHA256 de até 60 segundos com segredo mínimo de 256 bits e claims estritamente validados: `alg`, `kid`, `iss`, `aud`, `sub`, `origin`, `scope`, recurso, tamanho, `iat`, `nbf`, `exp` e `jti`.
- O gateway recebe o ticket apenas em `Authorization`, compara assinatura em tempo constante e consome `jti` atomicamente em replay store local durável com TTL.
- Enrollment e rotação administrativos exigem a capacidade independente `alphaExplorer.credenciais.administrar`, step-up da própria identidade Alpha do administrador e autenticação recente. Em produção, o step-up deve usar MFA resistente a phishing quando disponível; enquanto isso não existir, exige reautenticação explícita, sessão recente de no máximo cinco minutos e feature flag restrita ao grupo piloto.
- O control plane emite ticket de finalidade única com `actorSub`, `targetSub`, `scope=credential:enroll|credential:rotate`, `bindingNonce` e `jti`. Esse ticket não autoriza operação de arquivo nem impersonação do usuário alvo. O gateway valida ator, alvo, capacidade, origem, expiração e replay novamente.
- A senha entra em campo write-only e segue diretamente ao gateway por TLS. Ela não passa pela Vercel, não entra em React Query/Zustand, não é persistida/autopreenchida pela aplicação, é removida da memória da UI após a submissão e nunca aparece em GET, resposta, detalhe, exportação ou auditoria. O fato inevitável de o navegador manter o valor enquanto o administrador o digita não autoriza qualquer persistência no cliente.
- Antes de persistir, o gateway autentica no QNAP contra endpoint e shares allowlisted, confirma o principal normalizado e rejeita credencial inválida, conta desabilitada, conta administrativa/built-in ou conta fora da política. Falha não cria binding nem segredo órfão.
- No vínculo inicial, o segredo só é promovido no Vault após validação bem-sucedida. Na rotação, uma nova versão é validada antes da troca atômica da referência/versão ativa; falha preserva a versão anterior. Sucesso invalida imediatamente pools e sessões SMB antigos. Desvinculação revoga sessões, desativa o binding e agenda destruição das versões conforme a retenção aprovada.
- O administrador pode cadastrar, testar, rotacionar, revogar e desvincular, mas nunca ler ou recuperar uma senha existente. Cada ação exige justificativa curta, gera auditoria e notifica o usuário afetado sem incluir segredo.
- O fluxo é permitido apenas para contas QNAP corporativas cuja custódia administrativa esteja prevista em política interna aceita. Contas pessoais ou não gerenciadas continuam exigindo enrollment pelo titular ou migração para identidade centralizada. Um principal QNAP não pode ser ligado a vários usuários Alpha, salvo conta de serviço explicitamente classificada e fora do acesso interativo comum.
- Rate limit é aplicado cumulativamente por administrador, usuário alvo, principal QNAP, origem e IP, com cooldown abaixo do limiar de lockout do QNAP. Mensagens externas são genéricas; o support ID referencia detalhes sanitizados apenas no backend.
- A listagem de contas QNAP, se habilitada, usa adapter server-only e uma identidade separada, read-only e sem acesso a arquivos. Se o QNAP não oferecer privilégio suficientemente granular e API suportada, a listagem automática fica desabilitada e o administrador informa o principal exato para validação. A identidade de inventário nunca é reutilizada para SMB nem vira conta master do Explorer.
- A API externa usa handles opacos. Caminho UNC, IP, mount local e credencial não são enviados ao navegador.
- O gateway mantém pools userspace separados por binding e versão da credencial; exige SMB3 e signing, habilita encryption quando suportada, proíbe SMB1/downgrade e encerra conexões na revogação. Nenhuma falha cai para a conta técnica.
- Administrador do Painel não recebe bypass de ACL do QNAP.
- Upload/download grande percorre navegador ↔ gateway ↔ SMB, nunca Vercel ↔ arquivo integral.

## Rollout

1. Contratos, ticket, cofre e CLI com filesystem/SMB simulado.
2. Gateway somente loopback; doctor e enrollment administrativo com usuário sintético.
3. Duas identidades QNAP de teste com ACLs distintas.
4. Testes negativos de step-up, ator/alvo, replay, lockout, segredo órfão e rotação interrompida.
5. Publicação do gateway atrás de TLS e allowlist dos dois domínios.
6. Stage somente leitura; depois enrollment administrativo e escrita em diretório sintético.
7. Produção somente leitura; enrollment e escrita para piloto após smoke, CORS e aprovação de Security.

Flags server-only devem permitir desabilitar gateway, enrollment e escrita separadamente. O rollback restaura o backend QuObjects sem remover objetos, envelopes ou arquivos SMB.

## Consequências

- A experiência não pede senha novamente enquanto o vínculo for válido.
- A administração centralizada reduz atrito, mas eleva o privilégio e o risco de insider: o administrador que define uma senha pode conhecê-la. Por isso o fluxo é restrito a contas corporativas gerenciadas, step-up, menor privilégio, justificativa, notificação e auditoria; geração/rotação server-side sem revelar a senha é preferível quando uma API QNAP suportada permitir.
- Comprometimento simultâneo do gateway e da KEK pode expor credenciais; por isso o gateway deve ser dedicado, mínimo, auditado e migrado para KMS/SSO.
- Perda/rotação incompatível da chave torna o vínculo irrecuperável; o rollback é revogar e repetir enrollment, não recuperar senhas.
- Indisponibilidade do cofre, gateway ou QNAP falha fechada.
- Acesso do usuário muda imediatamente conforme autenticação/ACL do QNAP em cada operação; caches de listagem são curtos e não concedem autorização.

## Aprovação arquitetural

Aprovado o enrollment administrativo write-only como substituto do self-service, sem conta master, sem bypass de ACL do QNAP e sem segredo no Turso. A eventual persistência de `userId`, principal NAS e `secretRef` exige novo relatório Vault, backup verificado e confirmação explícita; esta ADR não autoriza migration. Security deve validar o threat model e os gates antes de habilitar enrollment ou expor o gateway externamente.
