# Contrato do backend futuro — Chatbot Alpha

> **ESTADO GLOBAL: FUTURO — NÃO IMPLEMENTADO NESTA FASE.**
>
> Este documento especifica o que o frontend nativo e mock-only do Chatbot Alpha precisará de uma API futura. Ele não autoriza nem descreve uma implementação presente: nesta etapa não existem chamadas HTTP, WebSocket/SSE, Railway, banco, webhooks, OAuth ou conexão real com canais. As rotas abaixo são propostas de contrato e podem ser versionadas antes da implementação.

## 1. Objetivo e limites

O frontend vive no Painel Alpha e, futuramente, consumirá um motor ChatbotX isolado. O Painel Alpha continua responsável pela sessão do usuário e pela permissão `chatBotAlpha`; o backend futuro será responsável por validar a identidade recebida, resolver o workspace autorizado e aplicar autorização em todas as operações.

```text
Painel Alpha (sessão e UI)
  -> API futura do Chatbot Alpha (BFF/gateway autenticado)
    -> motor/serviços no Railway
      -> workers, Redis, PostgreSQL e provedores externos
```

Fora do escopo atual e deste documento como implementação:

- criar API, BFF, banco, migration, fila, worker ou cache;
- transmitir eventos realtime;
- enviar mensagens, executar fluxos, campanhas ou sequências;
- conectar WhatsApp, Messenger, Instagram, TikTok, Telegram, Zalo, Webchat, SMTP/E-mail ou API;
- realizar OAuth, validar credenciais ou armazenar secrets;
- alterar ou importar código do ChatbotX original.

## 2. Convenções propostas

### 2.1 Base, versionamento e conteúdo

- Base proposta: `/api/chatbot/v1`.
- JSON em UTF-8; datas em ISO 8601 UTC, por exemplo `2026-09-15T14:30:00Z`.
- Identificadores são strings opacas e estáveis; a UI não deve inferir tipo ou ordenação pelo ID.
- Campos desconhecidos devem ser ignorados pelo cliente para permitir evolução compatível.
- `null` significa valor conhecido e ausente; campo omitido em `PATCH` significa “não alterar”.
- Toda resposta deve incluir `requestId` rastreável, também enviado no header `X-Request-Id`.

Resposta de sucesso:

```json
{
  "data": {},
  "meta": { "requestId": "req_01..." }
}
```

Resposta de erro normalizada:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Não foi possível concluir a operação.",
    "fieldErrors": { "name": ["Informe um nome."] },
    "retryable": false,
    "requestId": "req_01..."
  }
}
```

### 2.2 Autenticação, autorização e workspace

Todas as operações abaixo exigem autenticação, salvo endpoints técnicos de health que não são necessidade desta UI.

- O navegador não deve receber workspace token, token de canal ou credencial do motor.
- Preferência: a UI chama um BFF same-origin do Painel Alpha usando cookie `HttpOnly`, `Secure`, `SameSite=Lax/Strict`; o BFF troca a sessão por credencial service-to-service curta.
- Alternativa: token de acesso de curta duração, com audiência específica do Chatbot Alpha, nunca armazenado em `localStorage`.
- O backend deve derivar `userId`, `tenantId/workspaceId`, função e permissões do token/sessão. Não confiar em `workspaceId` enviado isoladamente pelo cliente.
- Escopo mínimo comum: `chatBotAlpha:read`; mutações exigem `chatBotAlpha:write`. Operações de integração, publicação ou execução futura exigem permissões específicas indicadas em cada seção.
- A API deve aplicar isolamento de tenant em consulta, cache, filas, logs e eventos realtime.
- Respostas `403` não devem revelar se um recurso existe em outro workspace; usar `404` quando necessário para impedir enumeração.

Endpoint de bootstrap:

| Necessidade | Operação proposta | Entrada | Resposta | Escopo | Eventos | Erros / observações |
|---|---|---|---|---|---|---|
| Resolver usuário, workspace e capacidades da UI | `GET /context` | Nenhuma | `{ user, workspace, permissions[], features, locale, timezone }` | sessão válida | nenhum | `401`, `403`, `503`; não retornar tokens ou configuração secreta |
| Carregar filtros compartilhados | `GET /catalogs` | `include=assignees,tags,channels,flows,templates` | catálogos visíveis no workspace | `read` | nenhum | `400`, `403`; resultados devem respeitar permissões e itens arquivados |

### 2.3 Paginação, busca, filtros e ordenação

Listagens aceitam, salvo indicação diferente:

- `page` inteiro a partir de 1 e `limit` entre 1 e 100; padrão sugerido 25;
- `search` com limite sugerido de 200 caracteres, normalizado e protegido contra consultas custosas;
- `sort` em allowlist, por exemplo `updatedAt:desc`; nunca interpolar ordenação livre no banco;
- filtros repetíveis ou separados por vírgula: `status`, `channel`, `assigneeId`, `tagId`, `origin`, `from`, `to`;
- filtros temporais em UTC e semântica inclusiva/exclusiva documentada (`from <= t < to`).

Envelope paginado:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 25,
    "total": 124,
    "totalPages": 5,
    "hasNext": true,
    "requestId": "req_01..."
  }
}
```

Para mensagens e históricos de alto volume, usar cursor estável:

```json
{
  "data": [],
  "meta": { "nextCursor": "opaque", "hasMore": true, "requestId": "req_01..." }
}
```

### 2.4 Concorrência e idempotência

- Recursos mutáveis devem expor `version` ou `etag`. `PATCH`/publicação envia `If-Match` ou `expectedVersion`; conflito retorna `409 VERSION_CONFLICT` com a versão atual permitida ao usuário.
- Comandos que podem ser repetidos por retry usam `Idempotency-Key` única por intenção: envio de mensagem, criação, instalação, mudança de estado, publicação e execução.
- Repetir a mesma chave com o mesmo payload devolve o primeiro resultado; com payload diferente retorna `409 IDEMPOTENCY_CONFLICT`.
- Eventos realtime carregam `eventId`, `aggregateId`, `aggregateVersion` e `occurredAt`; consumidores ignoram duplicatas e versões antigas.

### 2.5 Erros comuns e comportamento esperado da UI

| HTTP | Código | Comportamento esperado |
|---:|---|---|
| 400 | `INVALID_FILTER` / `INVALID_STATE_TRANSITION` | preservar dados atuais e explicar o filtro/transição inválida |
| 401 | `UNAUTHENTICATED` | encerrar tentativa e retornar ao fluxo de autenticação do Painel |
| 403 | `FORBIDDEN` | ocultar/desabilitar a ação e informar falta de permissão |
| 404 | `NOT_FOUND` | remover item obsoleto do cache ou exibir estado não encontrado |
| 409 | `VERSION_CONFLICT` / `IDEMPOTENCY_CONFLICT` | recarregar detalhe e oferecer reaplicar alterações |
| 422 | `VALIDATION_ERROR` | mapear `fieldErrors` no formulário |
| 429 | `RATE_LIMITED` | respeitar `Retry-After`; não repetir automaticamente mutações |
| 502/503 | `PROVIDER_UNAVAILABLE` / `SERVICE_UNAVAILABLE` | manter rascunho local e permitir retry explícito |
| 504 | `TIMEOUT` | informar resultado incerto; reconciliar pelo ID/idempotency key antes de repetir |

## 3. Modelos mínimos esperados

Os nomes são conceituais; o contrato definitivo deve publicar schema OpenAPI/JSON Schema.

- `Conversation`: `id`, `contactId`, `channel`, `status`, `priority`, `assignee`, `tags`, `unreadCount`, `lastMessage`, `lastMessageAt`, `createdAt`, `updatedAt`, `version`.
- `Message`: `id`, `conversationId`, `direction` (`inbound|outbound`), `kind`, `text`, `attachments[]`, `sender`, `status` (`queued|sent|delivered|read|failed`), `providerMessageId?`, `createdAt`, `updatedAt`, `version`.
- `Contact`: `id`, `name`, `avatarUrl?`, `phone?`, `email?`, `channels[]`, `tags[]`, `status`, `assignee?`, `origin`, `customFields`, `lastInteractionAt?`, `createdAt`, `updatedAt`, `version`.
- `Flow`: `id`, `name`, `description?`, `status`, `nodes[]`, `edges[]`, `validation`, `publishedVersion?`, `version`, `updatedAt`.
- `Agent`: `id`, `name`, `description`, `instructions`, `modelRef`, `configuration`, `tools[]`, `behavior`, `flowIds[]`, `channels[]`, `active`, `version`.
- `Campaign`: `id`, `name`, `audience`, `templateId`, `channel`, `scheduledAt?`, `status`, `metrics`, `version`.
- `Sequence`: `id`, `name`, `description?`, `steps[]`, `active`, `enrolledCount`, `version`.
- `Template`: `id`, `name`, `channel`, `category`, `language`, `content`, `variables[]`, `status`, `installed`, `version`.
- `Channel`: `id`, `type`, `label`, `status`, `capabilities[]`, `configurationRequirements[]`, `lastCheckedAt?`; nunca inclui segredo.
- `Integration`: `id`, `provider`, `category`, `status`, `capabilities[]`, `configurationRequirements[]`, `lastError?`, `updatedAt`; nunca inclui segredo.
- `ChatbotSettings`: disponibilidade, notificações, fila e aparência permitidas ao frontend, com `version`.

Canais reconhecidos: WhatsApp, Messenger, Instagram, TikTok, Telegram, Zalo, Webchat, SMTP/E-mail e API. `omnichannel` é somente agregador/filtro, não conexão.

Integrações reconhecidas: Workspace token, OpenAI, Gemini, Claude, DeepSeek, OpenRouter, OpenAI-compatible, Google Sheets, Facebook Ads, Make, ActiveCampaign, GetResponse, Mailchimp, MailerLite, Moosend, Drip, SendGrid e Klaviyo.

Nodes de flow reconhecidos: `sendMessage`, `startFlow`, `performAction`, `condition`, `sendMail`, `splitTraffic`, `wait`, `followUp`, `landingPage` e `addNotes`.

## 4. Dashboard

**Todas as operações desta seção: FUTURO — NÃO IMPLEMENTADO NESTA FASE.**

| Necessidade | Operação proposta | Parâmetros / payload | Resposta | Auth / realtime | Erros, dependências e PII |
|---|---|---|---|---|---|
| Resumo operacional | `GET /dashboard/summary` | `from`, `to`, `timezone`, `channel[]`, `assigneeId[]` | totais de conversas abertas/encerradas, mensagens, atendimentos, canais ativos, agentes, campanhas, automações e tempo médio de resposta; `generatedAt` | `read`; nenhum evento direto, invalidar por eventos de conversa/mensagem | `INVALID_FILTER`, `SERVICE_UNAVAILABLE`; dados agregados do banco/cache, sem corpo de mensagem ou PII |
| Volume no período | `GET /dashboard/volume` | mesmos filtros; `interval=hour|day|week` | série `{ bucket, inbound, outbound, conversations }[]` | `read`; nenhum | validar intervalo/tamanho; depende de analytics agregada, não de provedor externo em tempo de request |

Resultados devem declarar timezone, período efetivo e eventual defasagem (`dataFreshnessAt`). Métricas assíncronas podem ser eventualmente consistentes.

## 5. Inbox: conversas e mensagens

**Todas as operações desta seção: FUTURO — NÃO IMPLEMENTADO NESTA FASE.**

### 5.1 Conversas

| Necessidade | Operação proposta | Parâmetros / payload | Resposta | Auth / realtime | Erros, idempotência, dependências e PII |
|---|---|---|---|---|---|
| Listar/pesquisar conversas | `GET /conversations` | `page`, `limit`, `search`, `status[]`, `channel[]`, `assigneeId[]`, `tagId[]`, `unread`, `from`, `to`, `sort` | `Conversation[]` paginado | `read`; consumir `conversation.created`, `conversation.updated`, `message.created` | busca pode tocar nome/telefone/e-mail: logar apenas hash/termo redigido; `INVALID_FILTER` |
| Abrir conversa | `GET /conversations/{conversationId}` | `include=contact,assignee,tags` | `Conversation` e resumo do contato autorizado | `read`; consumir atualizações da conversa/contato | `404`, `403`; contém PII e deve usar `Cache-Control: private, no-store` quando apropriado |
| Alterar status/prioridade | `PATCH /conversations/{conversationId}` | `{ status?, priority?, expectedVersion }` | conversa atualizada | `write`; emitir `conversation.updated` | `409 VERSION_CONFLICT`, `INVALID_STATE_TRANSITION`; idempotente pelo estado desejado |
| Atribuir atendente | `PUT /conversations/{conversationId}/assignee` | `{ assigneeId|null, expectedVersion }` | conversa atualizada | `write`; emitir `conversation.updated` | validar atendente do workspace; auditoria obrigatória; idempotente |
| Atualizar tags | `PUT /conversations/{conversationId}/tags` | `{ tagIds[], expectedVersion }` | conversa atualizada | `write`; emitir `conversation.updated` | rejeitar tags de outro workspace; payload representa conjunto final, portanto idempotente |
| Marcar leitura operacional | `POST /conversations/{conversationId}/read` | `{ throughMessageId, readAt }` + `Idempotency-Key` | `{ conversationId, unreadCount, readThrough }` | `write`; emitir `conversation.updated` e, quando aplicável, `message.read` | não implica confirmação no canal sem suporte; reconciliar versão concorrente |

### 5.2 Mensagens e anexos

| Necessidade | Operação proposta | Parâmetros / payload | Resposta | Auth / realtime | Erros, idempotência, dependências e PII |
|---|---|---|---|---|---|
| Carregar histórico | `GET /conversations/{conversationId}/messages` | `cursor`, `limit`, `direction=before|after`, `status[]`, `kind[]` | `Message[]` em ordem estável + próximo cursor | `read`; consumir quatro eventos de mensagem | `404`, cursor inválido; conteúdo e anexos são PII, com URLs curtas/autorizadas |
| Enviar texto | `POST /conversations/{conversationId}/messages` | `{ clientMessageId, kind:"text", text, replyToId? }` + `Idempotency-Key` | mensagem aceita com status inicial e correlação | `write:message`; emitir `message.created` e posteriores `updated/delivered/read` | `CHANNEL_DISCONNECTED`, `CONTACT_OPTED_OUT`, `RATE_LIMITED`, `PROVIDER_UNAVAILABLE`; depende do worker/canal; nunca repetir sem reconciliação |
| Preparar upload futuro | `POST /attachments/uploads` | `{ fileName, contentType, size, checksum }` + idempotência | `{ uploadId, uploadUrl, expiresAt, allowedHeaders }` | `write:message`; nenhum | storage/antivírus; limitar tipo/tamanho; URL assinada curta, sem credencial permanente |
| Confirmar anexo | `POST /attachments/uploads/{uploadId}/complete` | `{ checksum }` | `{ attachmentId, scanStatus }` | `write:message`; nenhum | `UPLOAD_EXPIRED`, `CHECKSUM_MISMATCH`, `MALWARE_DETECTED`; idempotente |
| Enviar mensagem com anexo | `POST /conversations/{conversationId}/messages` | `{ clientMessageId, kind:"attachment", attachmentIds[], text? }` + idempotência | `Message` aceita | `write:message`; eventos de mensagem | mesmas falhas do envio e `ATTACHMENT_NOT_READY`; worker e canal externo |
| Reprocessar falha | `POST /messages/{messageId}/retry` | `{ expectedVersion }` + nova `Idempotency-Key` | mensagem/fila atualizada | `write:message`; emitir `message.updated` | somente mensagens elegíveis; limite de tentativas; auditoria |

O servidor deve sanitizar conteúdo renderizável, bloquear HTML ativo e retornar capacidades por canal (texto, anexo, tamanho, reply). Status de entrega/leitura só pode ser afirmado quando confirmado pelo provedor; ausência de suporte deve ser explícita.

## 6. Contatos e histórico

**Todas as operações desta seção: FUTURO — NÃO IMPLEMENTADO NESTA FASE.**

| Necessidade | Operação proposta | Parâmetros / payload | Resposta | Auth / realtime | Erros, idempotência, dependências e PII |
|---|---|---|---|---|---|
| Listar/pesquisar contatos | `GET /contacts` | paginação; `search`, `channel[]`, `tagId[]`, `status[]`, `assigneeId[]`, `origin[]`, `from`, `to`, `sort` | `Contact[]` paginado | `read:contacts`; consumir `contact.updated` | alto teor de PII; busca e exports devem ser auditados; `INVALID_FILTER` |
| Ver contato | `GET /contacts/{contactId}` | `include=channels,tags,customFields` | `Contact` | `read:contacts`; `contact.updated` | `404/403`; mascarar campos sem permissão |
| Criar contato futuro | `POST /contacts` | `{ name, phone?, email?, channels?, tags?, status?, assigneeId?, origin?, customFields? }` + idempotência | contato criado | `write:contacts`; emitir `contact.updated` | `DUPLICATE_CONTACT`, validação E.164/e-mail; política de merge explícita |
| Editar contato | `PATCH /contacts/{contactId}` | campos editáveis + `expectedVersion` | contato atualizado | `write:contacts`; emitir `contact.updated` | `409`, `422`; nunca permitir editar identificador de canal sem verificação; auditoria |
| Consultar histórico | `GET /contacts/{contactId}/history` | `cursor`, `limit`, `type[]`, `from`, `to` | eventos normalizados `{ id, type, occurredAt, actor, summary, entityRef }[]` | `read:contacts`; eventos de domínio atualizam a tela | não retornar payload bruto de webhook, tokens ou prompts; depende de audit/event store |
| Arquivar/restaurar | `POST /contacts/{contactId}/status` | `{ status:"archived"|"active", expectedVersion }` + idempotência | contato atualizado | `write:contacts`; `contact.updated` | operação não destrutiva; `INVALID_STATE_TRANSITION`; reter conforme política legal |

Telefone, e-mail, identificadores sociais, mensagens, custom fields e notas são PII. Aplicar criptografia em trânsito/repouso, retenção, trilha de auditoria, minimização, direito de acesso/exclusão conforme política da organização e nunca inserir valores integrais em logs, métricas ou traces.

## 7. Flows e automações

**Todas as operações desta seção: FUTURO — NÃO IMPLEMENTADO NESTA FASE. A UI atual apenas edita e valida um grafo em memória; não executa automações.**

| Necessidade | Operação proposta | Parâmetros / payload | Resposta | Auth / realtime | Erros, idempotência, dependências e PII |
|---|---|---|---|---|---|
| Listar flows | `GET /flows` | paginação; `search`, `status[]`, `updatedBy`, `sort` | resumos paginados | `read:flows`; nenhum dos 7 eventos mínimos | `INVALID_FILTER`; banco futuro |
| Abrir grafo | `GET /flows/{flowId}` | `version?` | flow com `nodes`, `edges`, versão e validação | `read:flows` | `404`, `FLOW_VERSION_NOT_FOUND` |
| Criar flow | `POST /flows` | `{ name, description?, nodes, edges }` + idempotência | draft criado | `write:flows` | validar tipos canônicos; `422`; não executar nodes |
| Salvar draft | `PUT /flows/{flowId}` | `{ name, description?, nodes, edges, expectedVersion }` | draft atualizado + relatório de validação | `write:flows` | `409`, `FLOW_INVALID`, `UNSUPPORTED_NODE`; persistência apenas futura |
| Validar grafo | `POST /flows/{flowId}/validate` ou `POST /flows/validate` | `{ nodes, edges, version? }` | `{ valid, errors[], warnings[] }`, cada item com `nodeId/edgeId`, código e mensagem | `write:flows` | determinístico e sem efeitos; detectar campos obrigatórios, edges órfãs/ciclos proibidos e referências ausentes |
| Listar versões | `GET /flows/{flowId}/versions` | paginação/cursor | metadados `{ version, status, createdAt, createdBy, note? }[]` | `read:flows` | `404`; não retornar secrets embutidos em configuração |
| Ver versão | `GET /flows/{flowId}/versions/{version}` | nenhuma | snapshot imutável do flow | `read:flows` | `404` |
| Publicar versão | `POST /flows/{flowId}/versions` | `{ expectedVersion, note? }` + idempotência | snapshot publicado e nova versão do flow | `publish:flows` | `FLOW_INVALID`, `409`; auditoria; não implica execução |
| Restaurar como draft | `POST /flows/{flowId}/versions/{version}/restore` | `{ expectedVersion }` + idempotência | novo draft baseado no snapshot | `write:flows` | nunca sobrescrever silenciosamente; `409` |
| Executar teste futuro | `POST /flows/{flowId}/executions` | `{ publishedVersion, mode:"dry-run"|"test", testContactId?, input? }` + idempotência | `{ executionId, status:"queued" }` | `execute:flows`; eventos de execução adicionais serão especificados depois | **não chamar nesta fase**; worker/fila/Redis/provedores; bloquear modo real na rota de teste, redigir PII |
| Consultar execução futura | `GET /flows/{flowId}/executions/{executionId}` | nenhuma | status, passos sanitizados, erros e timestamps | `read:flows` | `404`; não expor secrets, payload bruto de provedor ou dados de outro contato |
| Ativar/desativar versão publicada | `POST /flows/{flowId}/status` | `{ status:"active"|"inactive", expectedVersion }` + idempotência | flow atualizado | `publish:flows` | `FLOW_NOT_PUBLISHED`, `409`; desativação deve parar novas entradas, não corromper execuções em curso |

Configurações de node que referenciem templates, agentes, canais ou outro flow usam IDs do mesmo workspace. Valores sensíveis devem ser referências server-side (`credentialRef` opaca), jamais secrets dentro do grafo retornado ao navegador.

## 8. Agentes IA

**Todas as operações desta seção: FUTURO — NÃO IMPLEMENTADO NESTA FASE. Nenhum modelo é chamado pela UI atual.**

| Necessidade | Operação proposta | Parâmetros / payload | Resposta | Auth / realtime | Erros, idempotência, dependências e PII |
|---|---|---|---|---|---|
| Listar agentes | `GET /agents` | paginação; `search`, `active`, `modelProvider[]`, `channel[]`, `flowId`, `sort` | agentes/resumos paginados | `read:agents`; nenhum dos 7 eventos mínimos | `INVALID_FILTER`; não retornar API keys |
| Ver agente | `GET /agents/{agentId}` | nenhuma | configuração segura do agente | `read:agents` | mascarar/omitir referências não autorizadas |
| Criar agente | `POST /agents` | `{ name, description, instructions, modelRef, configuration, tools, behavior, flowIds, channels, active }` + idempotência | agente criado | `write:agents` | `MODEL_NOT_CONFIGURED`, `UNSUPPORTED_TOOL`, `422`; não testa inferência implicitamente |
| Editar agente | `PATCH /agents/{agentId}` | campos editáveis + `expectedVersion` | agente atualizado | `write:agents` | `409`, `422`; auditoria de instruções/ferramentas |
| Ativar/desativar | `POST /agents/{agentId}/status` | `{ active, expectedVersion }` + idempotência | agente atualizado | `publish:agents` | exigir modelo/configuração válidos para ativar; idempotente |
| Validar configuração | `POST /agents/{agentId}/validate` | configuração segura ou versão | `{ valid, errors[], warnings[] }` | `write:agents` | validação estrutural por padrão; qualquer teste externo deve ser operação separada, explícita e auditada |

Prompts/instruções podem conter informação confidencial. Aplicar controle de acesso e redigir logs. Ferramentas devem ser allowlisted no backend; o navegador nunca escolhe URLs arbitrárias, executa comandos ou fornece credenciais ao modelo.

## 9. Campanhas (broadcasts)

**Todas as operações desta seção: FUTURO — NÃO IMPLEMENTADO NESTA FASE. Nenhuma campanha é disparada ou agendada agora.**

| Necessidade | Operação proposta | Parâmetros / payload | Resposta | Auth / realtime | Erros, idempotência, dependências e PII |
|---|---|---|---|---|---|
| Listar campanhas | `GET /campaigns` | paginação; `search`, `status[]`, `channel[]`, `from`, `to`, `sort` | campanhas paginadas | `read:campaigns`; nenhum dos 7 eventos mínimos | agregados sem lista completa de destinatários |
| Ver campanha | `GET /campaigns/{campaignId}` | `include=audienceSummary,metrics` | campanha e resumo | `read:campaigns` | `404`; PII minimizada |
| Criar draft | `POST /campaigns` | `{ name, audienceDefinition, templateId, channel, scheduledAt?, timezone }` + idempotência | draft criado | `write:campaigns` | `AUDIENCE_INVALID`, `TEMPLATE_INCOMPATIBLE`, `CHANNEL_DISCONNECTED`; não agenda automaticamente |
| Editar draft | `PATCH /campaigns/{campaignId}` | campos editáveis + `expectedVersion` | draft atualizado | `write:campaigns` | somente estados editáveis; `409`, `INVALID_STATE_TRANSITION` |
| Pré-visualizar público | `POST /campaigns/audience-preview` | `{ audienceDefinition }` | `{ estimatedCount, sampleMasked[], exclusions, calculatedAt }` | `read:campaigns` | consulta limitada e auditada; amostra mascarada, sem exportar PII |
| Validar campanha | `POST /campaigns/{campaignId}/validate` | `{ expectedVersion }` | erros/avisos de público, template, canal e agenda | `write:campaigns` | sem disparo; pode consultar capacidade/configuração server-side |
| Alterar status futuro | `POST /campaigns/{campaignId}/status` | `{ action:"schedule"|"pause"|"resume"|"cancel", expectedVersion }` + idempotência | campanha atualizada | `execute:campaigns` | **não chamar nesta fase**; workers/filas/canais; consentimento, opt-out, quiet hours e limites por canal obrigatórios |

Cancelamento interrompe somente itens ainda não enviados. Métricas de entrega devem indicar fonte e defasagem; nunca reinterpretar “enviado” como “entregue”.

## 10. Sequências

**Todas as operações desta seção: FUTURO — NÃO IMPLEMENTADO NESTA FASE. Nenhuma cadência é executada agora.**

| Necessidade | Operação proposta | Parâmetros / payload | Resposta | Auth / realtime | Erros, idempotência, dependências e PII |
|---|---|---|---|---|---|
| Listar sequências | `GET /sequences` | paginação; `search`, `active`, `channel[]`, `sort` | sequências paginadas | `read:sequences`; nenhum evento mínimo | `INVALID_FILTER` |
| Ver sequência | `GET /sequences/{sequenceId}` | nenhuma | sequência com passos e versão | `read:sequences` | `404` |
| Criar | `POST /sequences` | `{ name, description?, steps[], active:false }` + idempotência | draft criado | `write:sequences` | validar ordem, delay, canal/template e limites |
| Editar passos | `PUT /sequences/{sequenceId}` | `{ name, description?, steps[], expectedVersion }` | sequência atualizada + validação | `write:sequences` | `409`, `SEQUENCE_INVALID`; não afetar inscrições existentes sem política explícita |
| Ativar/desativar | `POST /sequences/{sequenceId}/status` | `{ active, expectedVersion }` + idempotência | sequência atualizada | `execute:sequences` | **não chamar nesta fase**; requer versão válida, workers e canais; desativar bloqueia novas execuções |
| Inscrever/remover contato futuro | `POST /sequences/{sequenceId}/enrollments` / `DELETE /.../{contactId}` | `{ contactIds[], startAt? }` + idempotência | resultados por contato | `execute:sequences` | consentimento/opt-out, deduplicação, limites, PII; operação em massa deve ser assíncrona e auditada |

## 11. Templates

**Todas as operações desta seção: FUTURO — NÃO IMPLEMENTADO NESTA FASE.**

| Necessidade | Operação proposta | Parâmetros / payload | Resposta | Auth / realtime | Erros, idempotência, dependências e PII |
|---|---|---|---|---|---|
| Listar/pesquisar | `GET /templates` | paginação; `search`, `channel[]`, `category[]`, `language[]`, `status[]`, `installed`, `sort` | templates paginados | `read:templates`; nenhum evento mínimo | catálogo local/provedor; não expor credenciais |
| Ver/preview | `GET /templates/{templateId}` | nenhuma | template, variáveis, preview seguro e compatibilidade | `read:templates` | sanitizar HTML; `404` |
| Criar | `POST /templates` | `{ name, channel, category, language, content, variables }` + idempotência | template criado/draft | `write:templates` | `TEMPLATE_INVALID`, `CHANNEL_UNSUPPORTED`; cadastro no provedor deve ser comando separado |
| Editar | `PATCH /templates/{templateId}` | campos editáveis + `expectedVersion` | template atualizado | `write:templates` | `409`; versões aprovadas pelo provedor podem exigir clone/nova versão |
| Instalar do catálogo | `POST /templates/{templateId}/install` | `{ expectedVersion? }` + idempotência | cópia instalada no workspace | `write:templates` | `ALREADY_INSTALLED`; idempotente; não realiza conexão de canal |
| Ativar/desativar | `POST /templates/{templateId}/status` | `{ active, expectedVersion }` + idempotência | template atualizado | `publish:templates` | `TEMPLATE_NOT_APPROVED`, `409`; dependência externa apenas quando aprovação por canal for necessária |

Variáveis de preview usam valores fictícios ou mascarados. Templates não podem conter secrets, scripts ativos ou URLs inseguras.

## 12. Canais e integrações

**Todas as operações desta seção: FUTURO — NÃO IMPLEMENTADO NESTA FASE. Os botões atuais são apenas visuais; não há OAuth nem envio de credenciais.**

| Necessidade | Operação proposta | Parâmetros / payload | Resposta | Auth / realtime | Erros, idempotência, dependências e PII/secrets |
|---|---|---|---|---|---|
| Listar canais | `GET /channels` | `type[]`, `status[]` | catálogo e instâncias seguras, capacidades e requisitos | `read:integrations`; nenhum evento mínimo | status pode depender de health assíncrono; nunca retornar tokens |
| Ver canal | `GET /channels/{channelId}` | nenhuma | metadados, capacidades, campos configurados como booleanos e `lastCheckedAt` | `read:integrations` | valores secretos omitidos; identificadores externos mascarados |
| Listar integrações | `GET /integrations` | `category[]`, `provider[]`, `status[]` | catálogo/instâncias seguras | `read:integrations` | `INVALID_FILTER`; sem secrets |
| Ver requisitos | `GET /integrations/{provider}/requirements` | nenhuma | schema declarativo de campos, OAuth disponível, scopes e documentação permitida | `read:integrations` | não retornar default secreto ou URL não allowlisted |
| Iniciar conexão OAuth futura | `POST /integrations/{provider}/oauth/start` | `{ returnPath, stateNonce }` + idempotência | `{ authorizationUrl, expiresAt }` | `manage:integrations` | **não chamar nesta fase**; URL allowlisted, state/PKCE server-side, `OAUTH_UNAVAILABLE` |
| Concluir OAuth futuro | callback server-side, não chamado diretamente pela SPA | código/state recebidos do provedor | redirect seguro ao Painel e estado atualizado | serviço/BFF | **não implementar nesta fase**; tokens criptografados server-side; nunca em query de retorno/log |
| Salvar configuração não secreta | `PATCH /integrations/{integrationId}` | `{ displayName?, enabledCapabilities?, settings?, expectedVersion }` | integração segura atualizada | `manage:integrations` | allowlist por provedor; `409`; não aceitar secret por este endpoint |
| Entregar secret futuro | endpoint/cofre dedicado server-side, preferencialmente fora da SPA | secret write-only, canal protegido e autenticação reforçada | somente `{ configured:true, rotatedAt }` | `manage:integrations:secrets` + step-up | **não implementar nesta fase**; nunca ecoar valor; cofre/KMS, auditoria e rotação obrigatórios |
| Testar conexão futura | `POST /integrations/{integrationId}/test` | `{ expectedVersion }` + idempotência | job `{ testId, status }` e resultado sanitizado consultável | `manage:integrations` | **não chamar nesta fase**; timeout/rate limit do provedor; nenhum payload bruto/secret no resultado |
| Desconectar futuro | `POST /integrations/{integrationId}/disconnect` | `{ expectedVersion, revokeRemote:boolean }` + idempotência | estado desconectado | `manage:integrations` | **não chamar nesta fase**; revogação externa pode falhar parcialmente; confirmar e auditar |

Estados canônicos para canais/integrações: `connected`, `disconnected`, `error`, `configuration_required`. O backend deve distinguir estado persistido de saúde observada e oferecer `lastError` sanitizado, sem stack trace, token, endereço interno ou resposta bruta do provedor.

Dependências externas futuras por grupo:

- canais: APIs oficiais de WhatsApp/Meta (Messenger/Instagram), TikTok, Telegram, Zalo, Webchat próprio, SMTP e API pública controlada;
- IA: OpenAI, Gemini, Claude, DeepSeek, OpenRouter e endpoints OpenAI-compatible allowlisted;
- marketing/dados: Google Sheets, Facebook Ads, Make, ActiveCampaign, GetResponse, Mailchimp, MailerLite, Moosend, Drip, SendGrid e Klaviyo;
- infraestrutura: cofre/KMS, workers, filas, Redis e PostgreSQL.

## 13. Configurações do módulo

**Todas as operações desta seção: FUTURO — NÃO IMPLEMENTADO NESTA FASE. A UI atual salva apenas estado mock em memória.**

| Necessidade | Operação proposta | Parâmetros / payload | Resposta | Auth / realtime | Erros, idempotência, dependências e PII |
|---|---|---|---|---|---|
| Carregar preferências | `GET /settings` | nenhuma | `ChatbotSettings` e versão | `read`; nenhum evento mínimo | valores efetivos do workspace/usuário, sem config de infraestrutura |
| Salvar preferências | `PATCH /settings` | `{ availability?, notifications?, queue?, appearance?, expectedVersion }` | configurações atualizadas | `write:settings` | `409`, `422`; idempotente por estado desejado; preferências pessoais e de workspace devem ser separadas |
| Ver política efetiva | `GET /settings/policies` | nenhuma | limites somente leitura: retenção, canais permitidos, horário e capacidades | `read` | fonte administrativa; sem secrets ou topologia interna |

Notificações futuras devem exigir consentimento/permissão do navegador em fluxo separado. Configurações de Railway, banco, Redis, webhook, SMTP e credenciais não pertencem a esta tela nem a estes endpoints.

## 14. Realtime futuro

> **FUTURO — NÃO IMPLEMENTADO NESTA FASE.** O frontend atual apenas possui um ponto tipado para aplicar eventos locais; não abre WebSocket, SSE, Pusher ou polling externo.

### 14.1 Transporte e segurança

- Transporte futuro recomendado: WebSocket ou SSE autenticado pelo BFF, com credencial curta e escopo de workspace.
- O servidor decide os tópicos autorizados; o cliente não pode assinar workspace arbitrário.
- Suportar retomada por `lastEventId`/cursor, heartbeat, backoff com jitter e ressincronização por REST quando houver gap.
- Não colocar token na URL; não registrar payload integral.
- Garantia esperada: entrega ao menos uma vez. O cliente deduplica por `eventId` e ordena por versão do agregado, não apenas horário.

Envelope:

```json
{
  "eventId": "evt_01...",
  "type": "message.created",
  "workspaceId": "wsp_01...",
  "aggregateId": "msg_01...",
  "aggregateVersion": 3,
  "occurredAt": "2026-09-15T14:30:00Z",
  "correlationId": "req_01...",
  "data": {}
}
```

### 14.2 Sete eventos mínimos

| Evento | Quando emitir | Payload mínimo | Efeito esperado na UI | Idempotência / PII |
|---|---|---|---|---|
| `conversation.created` | conversa ingressa no workspace | `Conversation` completa ou resumo suficiente para a lista | inserir conforme filtros/ordenação, sem duplicar | deduplicar por `eventId`/`id`; contém resumo possivelmente pessoal |
| `conversation.updated` | status, prioridade, atendente, tags, unread ou preview muda | conversa completa ou `{ id, changes, version }` | mesclar se versão for mais nova; remover se deixar de atender filtros | ignorar versão antiga; não enviar campos sem necessidade |
| `message.created` | inbound recebido ou outbound aceito | `Message` + resumo atualizado da conversa | inserir mensagem, mover/atualizar conversa e contador | correlacionar `clientMessageId` para não duplicar optimistic update; conteúdo é PII |
| `message.updated` | conteúdo permitido, falha ou metadado muda | `{ id, conversationId, changes, version }` | atualizar bubble/status e erros sanitizados | versões monotônicas; sem resposta bruta do provedor |
| `message.delivered` | provedor confirma entrega | `{ id, conversationId, deliveredAt, version }` | mostrar entregue | repetível/idempotente; não inferir leitura |
| `message.read` | provedor/destinatário confirma leitura | `{ id, conversationId, readAt, version }` | mostrar lida | somente canais com capacidade; timestamp pode ser aproximado |
| `contact.updated` | perfil, tags, responsável, status ou custom fields mudam | contato completo ou `{ id, changes, version }` | atualizar lista, detalhe e painel da conversa | PII mínima; aplicar apenas versão mais nova |

Eventos de flow, agente, campanha, sequência, template, integração e configuração não fazem parte dos sete mínimos. Antes de implementar execução real, devem ganhar uma extensão versionada deste contrato, especialmente para progresso de jobs e falhas parciais.

### 14.3 Reconciliação

Ao detectar versão ausente, evento fora de ordem ou retomada expirada, a UI deve invalidar o agregado e consultar o endpoint REST correspondente. Um evento nunca é a única fonte durável; REST continua sendo a fonte de reconciliação.

## 15. Privacidade, segurança e observabilidade

### PII e secrets

- Classificar telefone, e-mail, identificadores sociais, mensagens, anexos, nomes, custom fields, histórico e prompts com dados pessoais.
- Minimizar resposta por tela e permissão; mascarar dados quando o operador não precisar do valor integral.
- Criptografar dados em trânsito e repouso; URLs de anexo expiram e exigem autorização.
- Nunca guardar PII integral em logs, traces, métricas, nomes de fila ou chaves de cache.
- Tokens OAuth, API keys, SMTP credentials, workspace tokens e credenciais de canal são write-only, criptografados em cofre/KMS e nunca retornados ao frontend.
- Aplicar proteção contra XSS em mensagens/templates, SSRF em URLs configuráveis, upload malicioso, abuso de busca, enumeração de IDs e mass assignment.

### Auditoria

Mutações devem registrar ator, workspace, ação, recurso, resultado, timestamp, request/correlation ID e diff redigido. Operações sensíveis — integração, publicação, ativação, disparo e mutação em massa — precisam de auditoria reforçada.

### Observabilidade

- Métricas: latência/erro por operação, backlog de fila, idade do job, reconexões realtime, lag de evento, falhas por provedor e taxas de entrega, sem dimensões de alta cardinalidade com PII.
- Tracing: propagar `requestId/correlationId` por BFF, API, worker e adaptador externo.
- Health de provedor deve ser assíncrono e cacheado; abrir dashboard/inbox não pode bloquear em chamada externa.
- Mensagens de erro apresentadas ao usuário são sanitizadas; detalhes internos ficam apenas em telemetria protegida.

## 16. Dependências e ordem sugerida para a fase backend

1. Fechar OpenAPI, modelo de autorização e isolamento de workspace.
2. Implementar BFF/autenticação service-to-service e `/context`.
3. Implementar leitura de dashboard, conversas, mensagens e contatos.
4. Implementar mutações com versionamento/idempotência e trilha de auditoria.
5. Implementar flows, agentes, campanhas, sequências e templates sem execução externa inicialmente.
6. Adicionar cofre de secrets e adaptadores de integração, um provedor por vez.
7. Adicionar workers/filas e comandos de execução com dry-run, limites e reconciliação.
8. Adicionar transporte realtime com os sete eventos, replay e testes de duplicação/ordenação.
9. Validar segurança, privacidade, carga, falhas parciais e disaster recovery antes de habilitar produção.

## 17. Critérios de aceite do contrato futuro

Antes de trocar o provider `mock` por `api`, a implementação backend deverá demonstrar:

- OpenAPI/schema compatível com todos os endpoints consumidos pela UI;
- autenticação sem secrets no navegador e autorização por workspace/recurso;
- paginação, filtros, ordenação e erros normalizados;
- idempotência e concorrência testadas nas mutações;
- os sete eventos realtime com deduplicação, ordenação e reconciliação;
- nenhum payload de integração ou observabilidade expondo secret/PII indevida;
- testes de estados desconectado, rate limit, timeout, provider indisponível e resultado incerto;
- nenhuma execução real disparada por operações de preview/validate;
- plano de migração do mock para API por configuração do provider, sem reescrever as telas.

Até esses critérios serem atendidos, o único provider funcional do frontend permanece o mock e todas as operações descritas neste documento permanecem **FUTURO — NÃO IMPLEMENTADO NESTA FASE**.
