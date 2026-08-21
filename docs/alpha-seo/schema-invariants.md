# Alpha SEO — invariantes do candidato de dados

> Documento de desenho. Não é migration, não contém comandos de aplicação e não autoriza escrita no Turso.

## Baseline e escopo

- Snapshot completo derivado de `prisma/schema.prisma` em 2026-08-20.
- SHA-256 do baseline: `402cf0930bb4299871dc2f0d343e380e92c26f5303b5c52839b54dbf19ae8da0`.
- Delta candidato: 44 models `AlphaSeo*`.
- Identidade reaproveitada: `usuarios.id Int`; não existe usuário/auth paralelo do OpenSEO.
- O candidato usa datasource isolado `ALPHA_SEO_DRAFT_DATABASE_URL` e client em `node_modules/.alpha-seo-draft-client`.
- Nenhum model foi promovido a `prisma/schema.prisma`; nenhum SQL, backup ou acesso de escrita ao banco foi executado nesta fase.

## Fontes canônicas e normalização

- `AlphaSeoProject.ownerId` é a fonte canônica do owner. A membership `OWNER` é uma projeção operacional, mantida atomicamente pelo service.
- Saved keywords, tags, assignments e métricas são tabelas distintas. Métricas não são duplicadas em `AlphaSeoSavedKeyword`.
- Rank keywords e snapshots são distintos. `AlphaSeoRankSnapshot.trackingKeywordId` não possui FK de propósito, para preservar histórico após remover a keyword do tracking.
- Audit, page, issue e Lighthouse são entidades próprias. Resultados não ficam enterrados num único blob da auditoria.
- Project Memory usa section, competitor, key page e research log normalizados; não existe `competitorsJson`/`keyPagesJson`/`researchLogJson`.
- Google OAuth grant contém credenciais criptografadas por usuário/conta/produto. GSC e GA4 possuem conexões separadas por projeto e selecionam uma property sobre o grant.
- AI Visibility guarda uma linha por execução e uma linha por provider, permitindo erro parcial sem sobrescrever os providers válidos.
- `AlphaSeoExternalOperationRun` e `AlphaSeoProviderCache` guardam snapshots externos arbitrários como `Json` validado por Zod. Eles não substituem nenhuma entidade relacional canônica.

## Credenciais e dinheiro

- Google PKCE verifier: ciphertext autenticado em `codeVerifierCiphertext`, com `tokenKeyVersion`; hash-only seria irrecuperável no callback.
- Google access/refresh/id tokens: ciphertext autenticado; nunca plaintext.
- API key e tokens/códigos OAuth MCP: hash-only; o valor bruto é exibido somente na emissão.
- OAuth MCP possui client, consent grant, authorization code PKCE, access token e refresh token rotativo com `tokenFamilyId`/parent.
- Todo valor monetário/custo/CPC usa `Int` em unidade mínima (`MicrosUsd`/`cpcMicros`). `Float` fica restrito a métricas não monetárias, como competition e Core Web Vitals.

## Invariantes que Prisma/SQLite não expressam sozinho

Os itens abaixo exigirão índices parciais, checks ou trigger/service transacional no SQL isolado posterior. Esta fase apenas os registra; nenhum DDL foi gerado.

1. Rank config nacional: no máximo uma config por `(projectId, normalizedDomain, locationCode)` quando `locationName` é nulo.
2. Rank config local: no máximo uma config por `(projectId, normalizedDomain, locationCode, locationName)` quando `locationName` não é nulo.
3. Rank run: no máximo uma execução em `PENDING`/`RUNNING` por `configId`.
4. Project invitation: no máximo um convite `PENDING` por `(projectId, normalizedEmail)`.
5. MCP grant: no máximo um grant `ACTIVE` por `(oauthClientId, userId, projectId, resource)`.
6. Owner/membership: deve existir exatamente uma membership `OWNER`, para o mesmo `userId` de `AlphaSeoProject.ownerId`; transferência atualiza as duas fontes na mesma transação.
7. Google product: `AlphaSeoGscConnection.grantId` só aceita grant `product=GSC`; `AlphaSeoGa4Connection.grantId` só aceita `product=GA4`.
8. Refresh rotation: reutilização de token já marcado `usedAt` revoga toda a família `tokenFamilyId`.
9. Project scope redundante em payloads externos nunca é confiado: autorização deriva sempre das FKs/joins, não de IDs dentro de `Json`.
10. Roles/status/device/schedule/provider/issue type são vocabulários fechados validados por Zod e, se o diff final for aprovado, por `CHECK` onde o SQLite permitir sem tornar rollout frágil.

## Índices e consultas esperadas

- Todas as FKs de alta frequência têm índice explícito ou são prefixo esquerdo de unique/PK.
- Listagens são project-leading e ordenadas por timestamp/id, permitindo paginação limitada.
- Workers consultam `(status, availableAt, priority, createdAt)` e leases vencidos por `(status, claimExpiresAt)`.
- OAuth cleanup consulta expiração/revogação; provider cache consulta `expiresAt`.
- Histórico de rank consulta `(trackingKeywordId, device, checkedAt)` sem depender da linha ativa de keyword.
- Audit issues consultam `(auditId, issueType)` e pages são únicas por `(auditId, url)`.

## Gate para promoção

Antes de qualquer promoção ou SQL: rebasear novamente se o hash do runtime mudar, gerar diff isolado, comprovar que ele contém apenas objetos `AlphaSeo*` e relações reversas Prisma sem alterar tabelas existentes, obter novo Vault Review, criar backup completo dedicado e validado com até 48 horas e receber confirmação explícita do usuário para o hash exato do SQL.
