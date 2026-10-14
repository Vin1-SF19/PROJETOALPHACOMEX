# SSO do ChatbotX pelo Painel Alpha

A rota `GET /api/chatbotx/open` autentica o usuário no Painel Alpha, verifica a permissão de acesso ao Builder e emite uma assertion JWT assinada para `POST {CHATBOTX_URL}/api/auth/alpha-sso/exchange`.

## Claims enviadas

- `sub`: ID do usuário no Painel Alpha.
- `email`: e-mail autenticado, normalizado em minúsculas.
- `role`: valor do campo Setor / Role do usuário no Painel Alpha, preservado como cadastrado (por exemplo, `COMERCIAL`, `Admin` ou `TI`).
- Claims de protocolo: `iss=painel-alpha`, `aud=chatbotx`, `jti`, `iat` e `exp` (60 segundos).

`role` representa o setor/perfil do Painel Alpha. Não é o campo profissional `cargo` e não substitui as verificações de acesso que o Painel executa antes de emitir a assertion.

O endpoint de troca do ChatbotX deve validar a assinatura, emissor, audiência, validade e uso único da assertion. Para que o campo tenha efeito no ChatbotX, o handler `/api/auth/alpha-sso/exchange` precisa ler a claim `role` e mapeá-la para o perfil/autorização local apropriado. Valores novos devem ser tratados segundo a política de acesso do ChatbotX, sem presumir privilégios a partir de um valor recebido.

A assertion é enviada somente do servidor do Painel Alpha ao servidor do ChatbotX; o navegador recebe apenas o redirecionamento para a URL de login retornada pela troca.
