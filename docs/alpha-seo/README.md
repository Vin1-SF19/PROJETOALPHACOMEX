# Alpha SEO — Operação do módulo

O Alpha SEO porta a superfície funcional do checkout OpenSEO para Next.js, Prisma/Turso e a UI do Painel Alpha. O manifesto congelado continua sendo o contrato de paridade; operações pagas nunca são executadas pelo inventário ou doctor.

As partes adaptadas do OpenSEO preservam a atribuição e os termos MIT em
[`OPEN-SEO-LICENSE.md`](./OPEN-SEO-LICENSE.md).

## Comandos

- `npm run alpha-seo:inventory -- --json` recalcula e grava o manifesto sanitizado do checkout local.
- `npm run alpha-seo:inventory -- --check --json` verifica drift sem gravar.
- `npm run alpha-seo:doctor -- --json` valida configuração, manifesto e Turso com `SELECT 1` read-only.
- `npm run alpha-seo:doctor -- --json --offline` valida contratos/configuração sem rede.
- `npm run alpha-seo:worker:once -- --json` processa somente fixtures em memória.
- `npm run alpha-seo:worker:persistent:once -- --json` reclama um job persistente com lease/fencing e executa rank, audit ou Lighthouse.

O doctor usa códigos estáveis: `0` saudável, `1` dependência configurada porém indisponível e `2` configuração/contrato inválido. Valores de segredos nunca são incluídos na saída.

A CLI carrega `.env` e, em seguida, `.env.local` com precedência explícita do arquivo local. `doctor --offline` apenas classifica a presença da configuração carregada e não abre conexão; `doctor` limita a verificação do Turso a `SELECT 1`, sem mutações. DataForSEO aceita `DATAFORSEO_API_KEY` ou o par `DATAFORSEO_LOGIN`/`DATAFORSEO_PASSWORD`, sempre server-side e sem expor valores.

## Paridade congelada

O manifesto em `source-manifest.json` registra o hash determinístico e somente o rótulo sanitizado `local-source/open-seo-main`. Arquivos `.env*`, caminhos absolutos, credenciais e payloads não entram no artefato.

A rastreabilidade dos 93 exports, famílias de rotas e contratos transversais
está em [`parity-matrix.md`](./parity-matrix.md).

O registry executável `createOpenSeoMcpServer` é a fonte autoritativa e registra 46 tools nomeadas. O manifesto exige 46 nomes únicos, todos resolvidos a arquivos reais, e registra paridade `46/46`, `missing=[]` e `unexpected=[]`. O claim histórico Scout de 48 e o gap sem nomes de 2 permanecem somente como metadado informativo (`historicalGapBlocking=false`): não inventam tools e não fazem inventory/doctor falhar. Os registries reais também resolvem os drifts de 8×9 skills e 26×27 audit issues em favor dos 9 e 27 itens explicitamente encontrados.

As nove skills mantêm também suas instruções completas; a skill `seo-audit`
inclui o template HTML distribuído pela fonte. SAM pode listar o catálogo e
carregar uma skill pelo nome.

## Custos, filas e recovery

Operações pagas usam estimate/approval, chaves determinísticas de idempotência/cache e mutex. Rank agendado usa `task_post`/`task_get` de fila, salva o checkpoint no job e só recorre ao endpoint live como fallback auditável. O crawler salva frontier, URLs vistas e páginas entre leases. Cron de schedules e worker roda a cada cinco minutos e exige `CRON_SECRET`.

Payloads brutos do Lighthouse são serializados de forma canônica e enviados ao storage Alpha quando configurado; `storageKey` e tamanho ficam no resultado. A ausência do storage não apaga as métricas processadas e aparece como payload indisponível.

Além dos crons de schedules e worker a cada cinco minutos, o cron protegido de
OAuth executa às `03:17` UTC e remove, em lotes limitados, somente nonces,
authorization codes e tokens expirados/consumidos.

## Integrações

- Google Search Console e GA4 usam OAuth state + PKCE S256, callback exato e tokens AES-256-GCM versionados.
- OpenRouter atende Brand Lookup, Prompt Explorer e SAM; falhas por modelo podem produzir resultado parcial.
- MCP usa `/api/alpha-seo/mcp` com Streamable HTTP, sessão do Painel, API key hash-only ou OAuth 2.1/PKCE. O registry contém 46/46 tools; `mcp-evaluation.xml` documenta os cenários de conformance.
- CSV neutraliza formula injection. “Google Sheets” replica a fonte: copia TSV seguro e abre `https://sheets.new`.

## Gate de dados

O Vault aplicou exclusivamente o SQL SHA-256 autorizado no Turso `basetestes-alphacomex`: 44 tabelas e 110 índices Alpha SEO, sem ALTER, DROP, seed ou backfill. O dump pre-change e as evidências de restore/integrity estão descritos em `vault-report.md`; dumps reais não são versionados.
