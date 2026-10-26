# Anubis — segurança da estabilidade do Painel Alpha

**Veredicto: APROVADO no escopo do hotfix, 26/10/2026.** Nenhum bloqueante de segurança novo identificado na comparação com a base20f310. Forge PASS e Probe local PASS foram conferidos antes desta revisão. Homologação autenticada de staging e produção continua pendente do rollout DevOps.

## Fronteiras revisadas

| Fronteira | Evidência e conclusão |
| --- | --- |
| Autenticação e indisponibilidade | `auth.ts` continua retirando a identidade pública de sessões INDISPONIVEL e mantendo claims somente no cookie criptografado. A façade `auth()` lança fora dos callbacks JWT antes de efeitos protegidos; `authComEstadoAcesso()` permanece nos adaptadores explícitos. Estado NEGADO e divergência de versão continuam bloqueando definitivamente. Não foi introduzido cache positivo de autorização. |
| Capacidade e prazo | Auth conserva8vagas e SSR4grupos; o término do observador não libera trabalho SDK ainda pendente nem aproveita resultado tardio para autorizar. Configuração aceita inteiros finitos e mantém limites máximos/relacionamentos. A mudança de prazo não é bypass de permissão. |
| Retentativas | `criarFetchBanco` faz uma tentativa, incluindo POST Hrana; não há repetição de escrita/transação. Repetições continuam limitadas a `usuarios.findUnique` e ao fluxo de alertas composto por leituras/checagens ACL. Classificador percorre causas de forma limitada e não aceita code23/SQLITE_BUSY isolados. Lembretes e mutations de notas não ganharam replay automático após falha. |
| Logs novos | Todos os chamadores de `registrarMetricaBanco` constroem enums, durações, status e contadores locais; não passam erro bruto, URL, SQL, argumentos, token ou identidade. Config inválida registra somente o nome allowlist do orçamento, sem seu valor. Agregação é por instância, não contagem global de requisições. |
| IA e credenciais | Rotas alteradas autentificam antes de acessar metadados/upstream. Onyx usa o PAT individual obtido do ID da sessão, sem fallback administrativo/global. Filtragem de agentes por owner/visibilidade e servidor das notas por usuário/ACL permanecem. Status Onyx de voz passou a exigir sessão e token individual. Erros novos usam mensagens/códigos públicos allowlist e respostas privadas no-store; não retornam erro bruto do upstream. |
| Cancelamento e streaming | Deadline JSON abrange consumo do corpo; sinal do caller é combinado, preservando cancelamento externo. Streaming mantém contrato separado, sem prazo JSON30s aplicado à duração do SSE. Nenhum mecanismo novo reenvia POST de voz/chat. |
| Isolamento no navegador | Queries de notas/agentes/pins/modelos usam identidade no cache; mudança de usuário ou perda de autorização cancela leituras e invalida capacidades compartilhadas de voz. Workspace usa geração para descartar resposta antiga, valida sessão antes de mutações e mantém server actions existentes com ownership. Mensagem de workspace aceita mesma origem e apenas dispara reconsulta autenticada; o contrato não autoriza escrita por postMessage. Guardas de frames existentes não foram afrouxados. |
| Superfície pública | Somente SHA40 validado atravessa layout server→client; não há nova variável secreta no bundle. Health confia no ambiente do servidor, não em hostname/header fornecido pelo cliente. Aviso de versão não executa navegação/reload/remount. `Permissions-Policy: geolocation=()` permanece e widgets não pedem localização em policy bloqueada/desconhecida. |

## Verificação própria executada

**13arquivos /103testes PASS**, exit0, duração Vitest1,67s (processo2,039s). Execução sequencial com1worker. O binding staging foi conferido em memória antes do comando; os testes receberam URLs locais e segredo exclusivamente sintéticos, sem acesso ao banco remoto. Log privado: `/var/tmp/alpha-estabilidade-20261026/anubis-focused.log`.

- Auth.js real: cookie preservado em falha temporária, DTO sem identidade pública, recuperação, revogação/version mismatch, tentativa de forjar estado/role em atualização de sessão e negação antes de efeitos.
- Transporte/auth/SSR: deadline headers/corpo, POST executado uma vez, cancelamento, retenção dos slots e classificação estrita de retry.
- IA/Onyx: token individual, negação sem PAT mesmo com credencial global configurada, owner/visibilidade, erros de auth/metadados/upstream sem vazamento, corpo JSON travado e SSE/cancelamento externo.
- Logs/config: agregação e ausência de campos sensíveis novos, override inválido sem imprimir valor; versão publicada/staging explícito.
- Voz: troca de identidade invalida/cancela estado antigo e preserva fallback.

Arquivos executados: `tests/auth/{sessao-resiliencia,acesso-painel,db-fetch,db-observability,db-resilience-config,heartbeat-status}.test.ts`, `tests/auth/painel-leituras-ssr.test.tsx`, `tests/bpm/alertas-leitura-retry.test.ts`, `tests/onyx/{client-user-token,routes-user-token}.test.ts`, `tests/bibble/{availability-routes,voice-status-react}.test.ts`, `tests/roadmap/production-version-route.test.ts`.

Os103testes são regressões existentes da entrega e não devem ser somados como casos distintos à suíte integral do Forge. Não foram executados scan completo do repositório, testes autenticados remotos, configuração de credenciais, schema/migration, mutação de dados reais, commit ou deploy. Aprovação desta fronteira de código não afirma normalização do Turso nem dos upstreams IA.

File list Anubis: este relatório e checklist/QA da story. Nenhuma aplicação ou teste alterado. Próximo gate: Lens; manter staging validado antes de produção.
