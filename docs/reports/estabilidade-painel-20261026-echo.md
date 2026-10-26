# Handoff backend — estabilidade do Painel Alpha

26/10/2026, Echo. Candidato isolado: `/var/tmp/alpha-estabilidade-20261026/candidate`, baseline20f310 preservado. Sem commit/push/deploy, mudanças de env ou schema e sem consultas ao banco real.

## Implementado

- Defaults DB10s, auth12s e SSR20s, configuráveis no servidor; inválidos usam defaults e relações asseguram auth>=DB+1s/SSR>=DB+2s dentro dos máximos documentados. Frontend deve usar30s sessão e45s frame independentemente, sem importar configuração server.
- Transporte aborta headers/corpo, preserva abort do caller e não repete POST. Auth mantém8slots, SSR4grupos, retidos até settlement real; resultado tardio não autoriza. Retry de auth só leitura estritamente classificada e saldo; BPM reconhece timeout de transporte encapsulado sem classificar code23/SQLITE_BUSY isolados, no máximo uma repetição e sem iniciar retry quando saldo25s se esgotou.
- Eventos `[db-resilience]` por instância: componente/fase/outcome, totalMs/headersMs/bodyMs/pending/limit/status/observerExpired. Eventos repetidos agregados30s com occurrences; sucesso rápido amostrado. Contagem é de eventos na instância, não de requests globais. Não imprime URL, SQL, args, usuário ou raw Error. SDK/observador são medidos separadamente, sem alegar medição de mutex.
- Heartbeat captura falhas de auth e transporte; erro de write temporário vira503 seguro, nunca repetição automática. Revogação confirmada ainda403.
- JSON Onyx usa prazo total30s através do corpo. Timeout de headers e cancel externo são combinados; streaming continua com contrato próprio, sem limite JSON30s. Token individual e ownership preservados.
- `/api/onyx/voice/status` agora exige sessão e token individual, retirando o falso200 de desabilitado por configuração ausente. O status de voz não usa PAT global.
- `/api/health/version`: produção ou Vercel=1 + VERCEL_TARGET_ENV=staging, SHA40 válido e no-store. Preview arbitrário continua503. Nova deve mostrar aviso/manual guardado, sem reload automático.

## Contrato para Nova

Sucessos models/agentes/voz preservam estruturas anteriores. Falhas IA têm `{success:false,error:mensagemSegura,code,retryable}`; models também mantém `models:[]`; voice-status Onyx mantém `stt_enabled:false,tts_enabled:false` em falha. Erro nunca significa lista vazia confirmada: conservar conversa/pins/estado anterior e apresentar indisponibilidade.

| Origem | HTTP/code |
| --- | --- |
| Auth/db de acesso | 503 `AUTH_UNAVAILABLE`, Retry-After5 existente |
| Config models/Onyx ausente | 503 `AI_CONFIGURATION_UNAVAILABLE` |
| Metadados/token/owner DB Onyx | 503 `AI_METADATA_UNAVAILABLE` |
| Conexão/JSON inválido/upstream genérico | 502 `AI_UPSTREAM_UNAVAILABLE` |
| Deadline upstream headers/corpo | 504 `AI_UPSTREAM_TIMEOUT` |
| Upstream429/503 | 429 `AI_RATE_LIMITED` /503 `AI_UPSTREAM_UNAVAILABLE` |
| Voz configurada incorretamente | 503 `VOICE_MISCONFIGURED` (código existente preservado), também quando URL ausente em Vercel |
| Erro de write heartbeat | 503 `HEARTBEAT_UNAVAILABLE`, retryable=true; erro não transitório500 retryable=false |

Falhas IA temporárias e heartbeat devolvem no-store e Retry-After30s. O helper client de Nova deve respeitar Retry-After (delta/date bounded) e backoff; backend não criou helper de polling nem agendador. `retryable` indica recuperação possível, não autorização para replay de POST. Onyx upstream401/403 continua erro daquela integração; não confundir com revogação local sem consulta Auth.js.

Voz mantém validações400/403/413/415 e lease429 existentes; fallback nativo e retry de health cabem Nova. Nenhuma configuração/credencial de produção foi copiada para staging; ausência de voz no staging deve aparecer como configuração indisponível.

## Testes executados e limites

Primeira rodada:11arquivos/84testes PASS. Rodada com novas regressões:14arquivos/114testes PASS; rodada final com validação do token da rota de voz: **14arquivos/115testes PASS**, duração1,67s. ESLint direcionado18arquivos backend: sem erro. `git diff --check`: sem erro. Log final em `/var/tmp/alpha-estabilidade-20261026/echo-focused.log`.

Cenários:5.502s aceitos em headers/corpo default10s; headers10s e corpo bloqueado abortam; POST uma chamada; signals/cancel/cleanup; auth5.502s e retry sem saldo; Auth.js real preservando cookies sem public user, revogação/version mismatch; pools retidos; SSR5.502s e deadline20s; code23 com causa tipada e SQLite não retentável; modelos erro não200 e redaction; Onyx body30s e stream vivo31s/cancel original; metadata/auth/upstream separados; voice URL ausente sem loopback; staging version explicitamente Vercel.

Não foram executados gates globais, build, CodeRabbit, navegador autenticado ou publicação. Forge/Probe/Anubis/Lens/Sage e smoke staging/prod permanecem necessários. O aumento de timeout não prova normalização do provedor.
