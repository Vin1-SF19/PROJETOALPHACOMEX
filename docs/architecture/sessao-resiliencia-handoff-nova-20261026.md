# Handoff Echo → Nova — sessão resiliente, 26/10/2026

Backend implementado na base staging b115dd38. UI/layout ainda pendentes; sem publicação.

## API e tipos exatos

Client-safe: `@/lib/auth/estado-acesso` exporta `EstadoAcessoSessao = "PERMITIDO" | "NEGADO" | "INDISPONIVEL"`, `AUTH_UNAVAILABLE`, `AUTH_UNAVAILABLE_MESSAGE`, `AUTH_RETRY_AFTER_SECONDS = 5`, `sessaoEstaIndisponivel(session: unknown)` e `sessaoPermiteOperacao(session: unknown)`.

`sessaoPermiteOperacao` exige estado PERMITIDO, user.id e ausência de bloqueio. Estado desconhecido, status authenticated isolado ou objeto truthy não confirma login.

| Resultado | Sessão pública /api/auth/session HTTP200 | `auth()` servidor |
| --- | --- | --- |
| Revalidado | estadoAcesso:PERMITIDO, acessoBloqueado:false, user validado | Session válida |
| Negado definitivo | estadoAcesso:NEGADO, acessoBloqueado:true, sem user | null |
| Temporário | estadoAcesso:INDISPONIVEL, acessoBloqueado:false, expires, sem user/role/permissões | lança AcessoTemporariamenteIndisponivel fora do JWT |
| Cookie ausente | null | null |

`authComEstadoAcesso()` é o leitor explícito para Root/provider, layout e heartbeat. Não usar em guards/actions para autorizar: TEMP é objeto truthy sem user. A interface histórica de Session mantém user obrigatório para compatibilidade dos consumidores autorizados; em runtime DTO TEMP/NEGADO omite user. Testar estado e presença antes de acessar. No callback session, user é explicitamente undefined ANTES do wrapper Auth.js RSC, para impedir que este reinsira o token interno como user.

Servidor: `@/lib/auth/indisponibilidade` exporta classe `AcessoTemporariamenteIndisponivel`, `acessoEstaIndisponivel(error)`, `respostaAcessoIndisponivel()` e `mapearIndisponibilidadeAuth(error)`. Mapper retorna NextResponse503 ou null. Corpo REST: `{ success:false, error:<mensagem sanitizada>, code:"AUTH_UNAVAILABLE", retryable:true }`; headers Retry-After:5 e Cache-Control:no-store,max-age=0.

Heartbeat já usa leitor explícito: TEMP503 antes de escrever; bloqueio403; ausência401; permitido atualiza sinal. Falha da escrita mantém500 operacional, nunca negação de identidade. Não adicionar logout para500/503/rede/deadline. Heartbeat403 ainda usa corpo JSON existente `{error:"Acesso bloqueado"}` sem code próprio: status403 isolado pode ser WAF/HTML, portanto não é prova suficiente. Nova deve conferir resposta/protocolo e, se necessário, consultar GET /api/auth/session abortável; somente estado NEGADO+acessoBloqueado confirmado justifica logout. Resposta HTML, malformed, rede ou TEMP preserva sessão.

Checklist actions preservam Result existente: `{ok:false,error:{code:"AUTH_UNAVAILABLE",message},requestId}`; HTTP do mesmo envelope tem503/Retry-After. Demais actions continuam com seus contratos e guard central fail-closed; rejeições de Server Action em produção têm mensagem ocultada pelo Next. Não classificar o temporário por Error.message no cliente: confirmar via endpoint de sessão abortável / estado explícito. Não criar sucesso/lista vazia como fallback. Dois catches perigosos em protocolos/Anexos repropagam o erro tipado.

## Prazos e recuperação

Validação status/version tem budget de observação TOTAL5s incluindo fila, retry e leitura; máximo8 validações pendentes por instância. Ao atingir capacidade, TEMP imediato sem enfileirar/retry. Ao expirar5s, TEMP e slot permanece ocupado até a query realmente resolver/rejeitar; resultado tardio não autoriza request anterior. No máximo1 retry apenas dessa leitura, erro de transporte reconhecido, jitter50–74ms e dentro do mesmo budget. Sem cache positivo ou fallback de role/version.

Fetch do adapter HTTP tem deadline separado5s por roundtrip até terminar/cancelar BODY, combinando Request.signal/init.signal. Sem retry genérico: Hrana usa POST também paraSELECT. O read expirado que ainda estiver no mutex pode executar depois, limitado a8admissões, mas seu resultado não libera a operação antiga. Não há cancelamento de fila/SQL nem garantia de rollback de write enviada. Teste com adapter real mostrou2roundtrips20ms serializados40ms: prazo de roundtrip não equivale ao prazo total da query; por isso o budget/admissão de validação é separado.

JWT preserva claims encriptados apenas durante TEMP. Revalidação bem sucedida limpa só TEMP. Token NEGADO ou sem identidade nunca ressuscita. Cookie Auth.js em GET/POST TEMP é preservado/reassinado. Auth() RSC sem args não propaga Set-Cookie: nova consulta confirma DB, sem depender de regravar marcador. Não lançar dentro JWT: core apagaria cookie.

## Trabalho Nova

- RootLayout: authComEstadoAcesso para provider e html/body; TEMP não lança antes da renderização.
- Layout Painel: negar children enquanto TEMP e exibir recuperação; capturar também queries adicionais de permissões/links/usuário, sem tratar erro de DB como revogação. Boundary do segmento não captura falha do próprio layout.
- Heartbeat: uma tentativa ativa, AbortController/deadline por tentativa, cleanup/unmount, backoff limitado; somente401/403 definitivos conforme sessão previamente conhecida causam logout.
- Iframe em /: confirmar estado por GET /api/auth/session abortável antes de logout; TEMP/rede/timeout conserva shell/rascunhos e erro recuperável da aba. Preservar origem/frameId/attempt/15s e guards de saída.
- Login: confirmação abortável com prazo armado antes da consulta; não confiar em status authenticated/objeto truthy; usar sessaoPermiteOperacao. Ignorar resposta de tentativa antiga/expirada e liberar formulário com retry. `update()` não suporta AbortSignal: não prometer cancelamento desse fetch interno.
- Não recarregar/desmontar automaticamente frames/formulários com rascunhos para recuperar sessão.

Gates backend: testes auth161/21arquivos, typecheck e lintfocal executados; logs privados em /home/ialpha/.config/painel-alpha/sessao-resiliencia-20261026/. Forge global somente após Nova/Sage. Sem smoke autenticado/staging nesta estação.

## Complemento Echo após Nova — agregado SSR com prazo, 26/10/2026

`@/lib/painel-leituras-ssr` exporta `lerDadosLayoutPainel`, `PAINEL_SSR_READ_BUDGET_MS=5000` e `PAINEL_SSR_PENDING_GROUP_LIMIT=4`. LayoutPainel já integrado, preservando fallback/children/iframe de Nova. Callback de permissões, usuário e links só inicia após admissão; onboarding condicional é quarto subtrabalho do mesmo grupo/prazo.

Retorno discriminado PERMITIDO (dados), NEGADO (usuario nulo/status não permitido confirmado) ou INDISPONIVEL (fila cheia/erro/timeout). Negação confirmada retorna cedo, mas slot continua retido pelos irmãos pendentes. Redirect continua no layout FORA do catch recuperável. Se prazo já venceu, resultado tardio não altera a resposta entregue nem inicia novo onboarding.

Não usa Promise.all fail-fast para liberar capacidade: allSettled de TODAS as3leituras e onboarding retém o slot até sua conclusão real, mesmo quando a observação terminou em5s ou a primeira leitura rejeitou. Limite4 é por grupoSSR/instância, não porSQL; authpool8 é separado. Nenhum cache positivo, retry, mutação ou abort de SQL/fila. Fetch existente5s continua limitando transporte quando trabalho alcança o adapter. Orçamento5s é da agregação ADICIONAL; authprévia tem orçamento próprio e isto não promete5s para todoHTML/rede ou para consultas de páginas filhas.

Cinco testes focais provam admissão >cap, primeira falha com irmão pendente, onboarding pendurado→fallback sem protectedchildren, resultado permitido tardio ignorado e redirecionamento real de null/INATIVO fora do catch. Nova preservada; próxima estação Sage.
