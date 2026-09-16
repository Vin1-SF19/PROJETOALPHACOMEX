# Threat model — Alpha Explorer SMB

## Ativos e zonas de confiança

- sessão e identidade interna do Painel;
- ticket efêmero de operação;
- credencial local do QNAP;
- KEK/DEK e envelopes do cofre;
- gateway no `ialpha`;
- sessão SMB, shares, diretórios e conteúdo;
- Vercel, navegador, Cloudflare e rede local são fronteiras distintas.

## Ameaças e controles obrigatórios

| Ameaça | Controle |
|---|---|
| IDOR/confused deputy | Ticket assinado vinculado a `sub`, origem, scope e recurso; gateway nunca aceita `userId` como autoridade do cliente. |
| Replay | `jti` consumido atomicamente, expiração curta e store durável local com TTL, inclusive após restart. |
| Roubo de ticket | TTL ≤60 s, finalidade única, sem credencial, TLS, não registrar ticket ou query string. |
| Vazamento de senha | Body limitado, TLS, buffer de vida curta, redaction total, sem stack/body em logs, envelope autenticado fora do Turso. |
| Persistência acidental no frontend | Campo write-only; sem React Query/Zustand/browser storage; sem replay automático; limpar estado após submit; CSP e telemetria com redaction; senha nunca retorna em resposta, detalhe ou exportação. |
| Troca de `secretRef` | Namespace `(iss,aud,sub)` e referência resolvida exclusivamente pelo subject validado; cliente nunca fornece referência. |
| Admin altera vínculo de terceiro sem autoridade | Capacidade separada de administração de credenciais, step-up, sessão recente, ticket one-shot vinculado a `actorSub` e `targetSub`, justificativa, auditoria e notificação ao usuário afetado. |
| Enrollment usado para impersonação | Ticket `credential:*` não autoriza operação de arquivo; administrador nunca recebe ticket SMB do usuário alvo e não existe endpoint para recuperar segredo. |
| Admin conhece/reutiliza senha fora do Explorer | Somente contas corporativas sob política de custódia; grupo administrativo mínimo; step-up; notificação; rotação periódica; geração server-side sem exibição é preferida quando suportada. O risco residual permanece auditado e aceito formalmente. |
| Enumeração de usuários QNAP | Inventário visível somente à capacidade administrativa, paginação e rate limit; adapter server-only com identidade read-only separada. Sem privilégio granular/API suportada, desabilitar enumeração e validar principal informado manualmente. |
| Escalada por admin do Painel | Sem bypass SMB; toda operação ocorre na sessão do principal QNAP vinculado. |
| Fallback para conta técnica | Proibido no código e coberto por teste; falha de vínculo/SMB retorna negação/indisponibilidade. |
| Traversal/UNC/encoding | Handles opacos, segmentos validados, NUL/controle/absoluto/UNC/`..` recusados, canonicalização sob share allowlisted. |
| Symlink/reparse/TOCTOU | Não seguir links; revalidar tipo/parent e estado antes do commit; operações por handle e diretório pai autorizado. |
| Overwrite/perda | Nome temporário imprevisível, tamanho verificado, rename sem overwrite; move cross-share bloqueado no piloto. |
| Arquivo parcial | Upload em temporário, cleanup reconciliável, publicação somente após flush/close/tamanho. |
| XSS/conteúdo ativo | Download como attachment por padrão; preview allowlist; filename sanitizado no `Content-Disposition`. |
| DoS | limites de body, arquivo, paginação, concorrência, timeout e rate limit por subject/origem/IP. |
| Logs sensíveis | correlation ID e códigos sanitizados; sem username, paths completos, senha, envelope, ticket, headers ou conteúdo. |
| Cofre/KEK indisponível | Falha fechada; sem segredo alternativo em env, Turso ou mount técnico. |
| Escrita parcial entre QNAP, Vault e metadados | Máquina de estados; novo vínculo só é promovido após validação; rotação valida nova versão antes da troca atômica; reconciliação remove segredo órfão e nunca apaga a versão ativa antes da confirmação. |
| Usuário/ACL revogado | Nova autenticação/operação SMB falha; sessões são curtas e invalidadas em erro de credencial/acesso. |
| Origem maliciosa | Allowlist exata de produção e stage, validação de `Origin`, método/header mínimos e sem wildcard. |
| Colisão stage/produção | Issuers, `kid`, segredos HMAC e namespaces do cofre separados; audiência validada estritamente. |
| Revogação durante upload | Ticket inicial só cria a sessão; commit exige ticket novo, usuário ativo e ACL reavaliada. |
| Lockout do QNAP | Rate limit cumulativo por administrador, alvo, principal, origem e IP; cooldown abaixo do limiar QNAP; autenticação recente, erro genérico e alerta por repetição. |
| Vínculo de conta administrativa/built-in | Rejeitar principais administrativos, built-in, desabilitados ou fora da política; impedir vínculo muitos-para-um, salvo conta de serviço formalmente classificada fora do acesso comum. |
| Core dump/swap | Serviço dedicado com hardening systemd, core dump desabilitado, memória bloqueada quando disponível e segredo com vida mínima. |

## Gates antes de exposição externa

- dois usuários QNAP de teste com ACLs diferentes;
- prova negativa de admin do Painel sem acesso NAS;
- prova negativa de ticket administrativo tentando operar arquivos ou trocar `targetSub`;
- step-up, expiração de sessão, rate limit e lockout simulados;
- rotação interrompida preservando a versão anterior e reconciliação de segredo órfão;
- auditoria de cadastrar, testar, rotacionar, revogar e desvincular sem senha, ciphertext ou `secretRef` utilizável;
- política de custódia de contas corporativas aprovada e notificação ao usuário validada;
- secrets scanner e inspeção de logs;
- teste de replay, troca de subject, traversal e symlink;
- TLS do gateway, firewall e autenticação do emissor aprovados por DevOps;
- backup do cofre cifrado e teste de recuperação por re-enrollment;
- escrita limitada a diretório sintético até smoke completo.

## Risco residual aceito no piloto

O gateway precisa decifrar a senha para autenticação NTLM e, portanto, amplia o impacto de comprometimento do host. O administrador que define uma senha também pode conhecê-la e tentar reutilizá-la fora do Explorer; controles técnicos reduzem, mas não eliminam esse risco de insider. O risco é aceito somente para contas corporativas gerenciadas e piloto restrito, com migração planejada para AD/LDAP/Kerberos, sem conta master, sem bypass das ACLs e sem armazenamento de segredo no Turso.
