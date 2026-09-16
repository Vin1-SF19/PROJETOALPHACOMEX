# Story: Alpha Explorer — explorador de arquivos privado com QuObjects e fallback controlado

## Status

InProgress

## Executor Assignment

executor: `@dev`
quality_gate: `@architect`
quality_gate_tools: `["lint", "typecheck", "tests", "build", "coderabbit", "explorer:doctor", "explorer:permissions", "explorer:list", "explorer:reconcile", "explorer:smoke", "storage:doctor"]`

## Story

**Como** usuário autorizado do Painel Alpha,
**quero** navegar e operar arquivos privados em pastas lógicas, com upload direto e seguro para o NAS,
**para que** os documentos corporativos sejam administrados pelo painel sem expor credenciais, perder arquivos legados ou depender do body de uma Function para transferências grandes.

## Contexto

Esta story é a continuação direta da fundação validada em `docs/stories/story-storage-alpha-fundacao-cli-multipart-poc.md`. O piloto utiliza o storage space `painel-alpha-poc`, bucket privado `pa-poc-private`, endpoint público `https://storage-poc.alpha-comex.com`, QuObjects como provider primário e Vercel Blob como fallback de escrita selecionado somente antes do início do upload.

O módulo é novo e não substitui `GerenciamentoArquivos`, POP, anexos de Notas, BPM, Blueprint ou outros consumidores atuais. Nenhum arquivo legado será copiado, movido ou apagado. URLs Vercel Blob existentes continuam funcionando pelo fluxo atual.

Prioridade: segurança e autorização → integridade → CLI → observabilidade → UI → refinamentos.

## Decisões vinculantes

- Nome visível: `Explorador de Arquivos`.
- Identificador candidato: `exploradorArquivos`, sujeito apenas a conflito comprovado no registry.
- Rota: `/PainelAlpha/ExploradorArquivos`.
- Storage: um único bucket privado; pastas são prefixes/chaves lógicas.
- Raízes iniciais: `comercial/`, `financeiro/`, `fiscal/`, `operacional/`, `rh/`, `compartilhados/` e `usuarios/{userId}/`.
- Chaves físicas usam IDs internos opacos; nunca e-mail, CPF ou nome completo.
- Provider é escolhido antes da sessão e permanece imutável até seu encerramento.
- QuObjects é primário; Blob é fallback de nova escrita quando o NAS falha antes da sessão e a flag operacional permite.
- Fallback não é backup nem réplica. Leitura nunca troca de provider sem réplica verificada.
- Upload grande trafega diretamente navegador → provider por autorização temporária. O backend nunca recebe o arquivo de 2 GiB inteiro.
- Parte padrão: 64 MiB. Tamanho máximo: 2 GiB, validado antes e depois.
- Pausa/retomada só será exibida se a sessão implementada garantir integridade. A V1 deve oferecer cancelar e reiniciar.
- Exclusão é lógica e reversível. Purga física não faz parte desta story.
- Movimentos recursivos grandes de pasta não serão executados sincronicamente; a V1 deve bloqueá-los com explicação ou delegá-los a operação reconciliável limitada.
- Preview inline somente para tipos passivos allowlisted. SVG, HTML e conteúdo ativo não confiável serão download-only.
- Feature flags server-only começam desligadas: uma para leitura do módulo e outra para escrita. Os nomes finais seguem a convenção do projeto e serão documentados em `.env.example`.
- A UI administrativa de ACL só será implementada se a precedência de regras estiver fechada e os padrões existentes forem suficientes. CLI de permissão é obrigatória.

## Acceptance Criteria

1. O módulo é registrado uma única vez no registry, protegido por feature flag server-only, sessão oficial e permissão efetiva; acesso direto sem autenticação ou módulo resulta em negação server-side.
2. Contratos puros/server-only normalizam `/`, `\\`, pontos, espaços, Unicode e segmentos vazios; rejeitam traversal simples, codificado e duplamente codificado; e comparam prefixos por limite real (`financeiro/` não inclui `financeiro-publico/`).
3. Capacidades granulares cobrem listar, ler, enviar, criar pasta, renomear, mover, excluir, restaurar e administrar permissões, usando nomes finais coerentes com o projeto.
4. Cada operação revalida usuário ativo, módulo, caminho normalizado, prefixo, capacidade, ownership aplicável, estado do registro e provider esperado. Falhas de leitura/inconsistências negam acesso.
5. Nenhum input do cliente (`objectId`, `objectKey`, bucket, provider, userId ou prefixo) é confiado sem resolução server-side; IDOR devolve 404 quando revelar existência ampliar informação.
6. Existem CLIs para diagnóstico, permissão efetiva de usuário/caminho, listagem dry-run paginada, multipart incompleto, reconciliação de metadados e smoke de upload/download/cleanup. Contratos e CLIs passam antes da implementação da UI.
7. A abstração em `src/lib/storage` é reutilizada e estendida para listagem paginada, cópia verificada, presign de upload de parte, `ListParts`, `ListUploads`, conclusão idempotente/segura, abort e URL de download curta, sem duplicar clientes/configuração.
8. Listagem usa prefixo autorizado e continuation token, nunca carrega o bucket inteiro nem filtra autorização apenas no navegador. Pesquisa respeita escopo, paginação e limite de custo.
9. Pastas lógicas podem ser criadas sem depender de objetos vazios do provider; colisões e nomes equivalentes após normalização Unicode são rejeitados com 409.
10. Início de upload valida autenticação, autorização, flags, nome, tamanho, destino e tipo; gera object key não previsível; seleciona o provider uma vez; vincula a sessão ao usuário e define expiração.
11. Arquivos de 1 byte a 2 GiB usam partes de 64 MiB com concorrência limitada e janelas pequenas de URLs temporárias. Zero-byte é rejeitado de forma explícita e arquivo acima de 2 GiB resulta em 413 antes de criar sessão.
12. O cliente reporta progresso real por bytes confirmados, repete somente falhas transitórias com backoff e não oferece pausa/retomada quando não suportadas com integridade.
13. ETags são normalizados com ou sem aspas; ETag ausente pode ser recuperado via `ListParts`; parte duplicada, sessão expirada, outro usuário e mudança de permissão durante upload são rejeitados/conciliados com segurança.
14. Conclusão valida novamente sessão, usuário, permissão, lista de partes, provider e tamanho; não repete `CompleteMultipartUpload` de modo inseguro; confirma o objeto por `HeadObject` ou fallback exato compatível e registra metadados/auditoria.
15. Cancelamento interrompe partes locais, tenta `AbortMultipartUpload`, marca a sessão e deixa estado reconciliável quando o provider não oferece abort. Sessões abandonadas expiram e são detectadas pelo CLI.
16. NAS indisponível antes da sessão permite Blob somente com flag de fallback; o usuário é informado e o provider é registrado. Falha após início no NAS nunca muda silenciosamente para Blob; reinício no Blob é explícito.
17. Downloads consultam o provider registrado e usam URL assinada curta ou fluxo privado equivalente. Não há fallback de leitura sem réplica verificada e links Blob legados permanecem inalterados.
18. Renomear/mover executa copiar → verificar → remover origem. A origem nunca é removida antes da verificação; falha de delete após cópia cria estado reconciliável e bloqueia ações conflitantes.
19. Exclusão envia o registro à lixeira sem apagar fisicamente o objeto. Restauração preserva autorização e detecta conflito de nome. Versionamento do bucket não é tratado como lixeira do aplicativo.
20. Metadados retornados ao usuário comum não incluem object key física, bucket, endpoint ou credenciais. Administradores podem ver somente o rótulo de origem `NAS` ou `Vercel Blob`.
21. Preview usa allowlist conservadora, `nosniff` e Content-Disposition seguro. SVG, HTML, MIME inconsistente ou tipo desconhecido nunca é renderizado como conteúdo ativo inline.
22. Entradas HTTP usam Zod e respostas seguem o padrão do projeto: 401, 403, 404 discreto, 409, 413, 429 e 5xx sanitizado com correlation/support ID, sem stack trace.
23. Rate limit protege criação de sessão, assinatura de partes e operações destrutivas. URLs assinadas expiram rapidamente e não são registradas completas.
24. Logs estruturados incluem correlation ID, ação, resultado, provider, duração, tamanho, partes e código sanitizado, sem credenciais, cookies, tokens, query strings assinadas, conteúdo ou dados pessoais.
25. Auditoria cobre upload iniciado/concluído/cancelado, download autorizado, pasta criada, rename, move, exclusão, restauração, alteração de permissão e fallback.
26. Métricas/agregações permitem observar sucesso, latência, bytes, erros por provider, sessões incompletas, fallback e falhas de autorização.
27. A página inicial é Server Component quando possível; interações ficam em Client Components menores que 300 linhas; fetch cliente usa React Query, sem `useEffect`; formulários usam React Hook Form + Zod.
28. A UI inclui cabeçalho, breadcrumb acessível, navegação de pastas, lista/tabela, pesquisa, ordenação, paginação, upload/nova pasta, progresso, indisponibilidade, fallback, ações, detalhes, lixeira, confirmações, loading, vazio, erro, retry e support ID.
29. A UI reutiliza shadcn/Radix e tokens de tema, é mobile-first, navegável por teclado, mantém foco visível, usa labels/ARIA, fecha menus/modais com Esc e respeita `prefers-reduced-motion`.
30. O tutorial reutiliza `GuiaModuloTour` e `data-guia-*`, persiste por usuário/módulo/versão e explica navegação, pasta, upload, 2 GiB, progresso, download, move/rename, lixeira, diretórios ocultos, indisponibilidade/fallback e administração de permissões.
31. Nenhuma credencial QuObjects é enviada ao cliente, bundle, log, banco ou resposta. Não existem campos de credencial NAS no cadastro de usuário e o bucket permanece privado.
32. Não há migração, schema, seed, backfill ou mutação em massa sem relatório Vault, backup completo específico e verificado com até 48 horas, rollback e confirmação explícita do usuário.
33. Testes automatizados cobrem os 35 cenários e edge cases mínimos fornecidos no prompt da story, incluindo paths, IDOR, concorrência, multipart, fallback, lixeira, preview e acessibilidade.
34. O smoke real de 2 GiB permanece opcional e fora do CI; usa dado sintético, alvo confirmado e cleanup verificado. Smoke pequeno no NAS e fallback controlado são executados antes de habilitar escrita.
35. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`, CLIs do Explorer e `storage:doctor` são executados realmente; resultados e limitações são registrados sem alegação falsa de sucesso.
36. Story, checkboxes, File List, documentação arquitetural e tutorial operacional final são atualizados antes da conclusão.

## Tasks / Subtasks

- [x] Task 1 — Contratos de domínio e segurança de caminhos (AC: 2–5, 8–9)
  - [x] Implementar normalização/decodificação limitada, Unicode, validação de segmentos e boundary de prefixo.
  - [x] Definir capacidades, raízes autorizáveis e resolução server-side de destinos/IDs.
  - [x] Criar testes unitários completos antes da UI.
- [x] Task 2 — Extensão dos providers e contratos multipart diretos (AC: 7, 10–18)
  - [x] Adicionar listagem, copy, presign por parte, ListParts/ListUploads e abort onde suportado.
  - [x] Preservar adapter CLI existente e compatibilidade dos consumidores legados.
  - [x] Tratar peculiaridades já comprovadas do QuObjects e limitação de abort do Blob.
- [x] Task 3 — CLI First (AC: 6, 8, 15, 26, 34)
  - [x] Implementar doctor, permissions, list dry-run, incomplete, reconcile e smoke.
  - [x] Emitir JSON estável, exit codes e saída sanitizada.
  - [x] Executar testes e CLIs antes de iniciar componentes React.
- [ ] Task 4 — Autorização e observabilidade (AC: 1–5, 22–26, 31)
  - [x] Integrar sessão, usuário ativo, permissão de módulo e capacidades por prefixo.
  - [x] Implementar rate limit, correlation/support ID, auditoria e métricas sanitizadas.
  - [ ] Testar IDOR, fail-closed e perda de permissão durante upload.
- [x] Task 5 — Persistência e checkpoint Vault (AC: 9–20, 25, 32)
  - [x] Validar o modelo mínimo contra o schema existente e documentar alternativa sem migration.
  - [x] Acionar Vault antes de editar schema/migration ou banco.
  - [x] Apresentar ambiente, DDL, impacto, riscos, rollback e evidência de backup; aguardar confirmação explícita.
  - [x] Após autorização, aplicar somente a migration aprovada e validar estrutura/integridade.
- [ ] Task 6 — HTTP/API (AC: 10–18, 21–25)
  - [x] Implementar handlers de listagem, multipart, download, operações e lixeira com Zod.
  - [x] Implementar respostas/status padronizados e proteção contra reutilização de sessão.
  - [ ] Testar auth, autorização, validação, conflito, rate limit e erros sanitizados.
- [x] Task 7 — Registro do módulo e UI (AC: 1, 20, 27–31)
  - [x] Adicionar registry e rota protegida, respeitando mudanças locais existentes.
  - [x] Adicionar React Query somente se ainda não existir; criar provider conforme padrão App Router.
  - [x] Implementar Explorer responsivo, acessível e dividido em componentes menores que 300 linhas.
- [x] Task 8 — Tutorial (AC: 30)
  - [x] Criar configuração versionada e seletores `data-guia-explorer`.
  - [x] Integrar `GuiaModuloTour` e persistência local por usuário/módulo/versão.
- [ ] Task 9 — Testes e operação (AC: 33–36)
  - [ ] Unitários, integração, API/actions, componentes e E2E essencial.
  - [x] Executar gates, CLIs, doctor e smokes permitidos; registrar evidências.
  - [x] Atualizar story, File List, arquitetura, decisões e tutorial operacional.

## Dev Notes

### Fundação reutilizável

- `src/lib/storage/contracts.ts`: limites de 2 GiB, parte padrão 64 MiB e contrato server-only. [Source: `docs/stories/story-storage-alpha-fundacao-cli-multipart-poc.md#acceptance-criteria`]
- `src/lib/storage/orchestrator.ts`: escolha de provider antes da sessão, retry transitório e abort best-effort. [Source: `.bibble/memory/architecture.md#storage-alpha--fundacao-cli-server-only-multipart-e-fallback-operacional`]
- `src/lib/storage/providers/quobjects.ts`: ETag via `ListParts` e fallback exato quando `HeadObject` é negado. [Source: `docs/qa/storage-alpha/implementation-validation.md`]
- `src/lib/storage/providers/vercel-blob.ts`: o SDK atual não oferece abort multipart server-side. O design do Explorer deve representar essa limitação, não fingir sucesso. [Source: `src/lib/storage/providers/vercel-blob.ts`]

### Autorização e navegação

- `src/lib/modulos-registry.ts` e `podeVisualizarModulo` são a fonte de visibilidade; `getPermissoesEfetivas` combina setor/legado/override e admin bypass. [Source: `.bibble/memory/architecture.md#registry-central-de-módulos--fonte-autoritativa-de-acesso-e-navegação`]
- Guardas de páginas usam `auth()`, ID numérico e redirect fail-closed; endpoints devem retornar status HTTP em vez de confiar na UI. [Source: `.bibble/rules/api-rules.md`]
- O projeto não tem precedência canônica pronta para ACL granular de arquivos. Ela precisa ser simples, previsível e validada antes da UI administrativa. [Source: `.bibble/memory/decisions.md`]

### Componentes e tema

- Reutilizar `src/components/Guias/GuiaModuloTour.tsx` e `src/lib/guias/tutorial-modulo.ts`; persistência atual é local, versionada e por usuário. [Source: `.bibble/memory/components.md#guiamodulotour-guia-inteligente-de-módulo`]
- Tema vem de `src/lib/temas.ts`; não usar cores hardcoded que ignorem o tema. [Source: `.bibble/rules/styling-rules.md`]
- Server Components são padrão; `use client` apenas em folhas interativas; sem `useEffect` para fetch. [Source: `.bibble/rules/nextjs-rules.md`]
- O projeto possui `@tanstack/react-virtual`, mas ainda não possui `@tanstack/react-query`; a dependência será adicionada somente na fase UI e registrada na File List. [Source: `package.json`]

### Dados e Vault

- `NoteAttachment`, `BlueprintFile` e `BpmCardAnexo` pertencem a agregados específicos e não registram provider/sessão/prefixo/lixeira do Explorer. [Source: `prisma/schema.prisma`]
- `Auditoria` é genérica, porém seu campo `detalhes` é string; avaliar reutilização versus trilha estruturada mínima sem copiar cegamente modelos existentes. [Source: `prisma/schema.prisma`]
- Toda edição estrutural ou migration no Turso segue backup em `database-backups/pre-change/`, verificação por restauração e consentimento específico. [Source: `AGENTS.md#database-safety-and-backup-policy-non-negotiable`]

### QuObjects

- A QNAP declara suporte a CORS, presigned URLs, CopyObject, HeadObject/ListObjects e multipart (`Initiate`, `UploadPart`, `ListParts`, `ListUploads`, `Complete`), mas alerta que comportamentos podem divergir do AWS S3 e devem ser testados. [Source: `https://www.qnap.com/en-us/how-to/tutorial/article/quobjects-tutorial#supported-amazon-s3-apis`]
- Bucket privado exige URLs assinadas; versionamento mantém versões do objeto, mas não substitui lixeira do aplicativo. [Source: `https://www.qnap.com/en-us/how-to/tutorial/article/quobjects-tutorial#adding-a-bucket-to-a-storage-space`]

### Project Structure Notes

- Novos domínios server-only devem ficar em `src/lib/alpha-explorer/` ou extensão direta de `src/lib/storage/`; APIs em `src/app/api/alpha-explorer/`; UI em `src/app/PainelAlpha/ExploradorArquivos/` e componentes próximos ao módulo.
- `package.json` e `src/lib/modulos-registry.ts` já têm alterações locais. Mesclar sem sobrescrever trabalho do usuário.
- Os arquivos `docs/framework/coding-standards.md`, `tech-stack.md` e `source-tree.md` configurados no core não existem; Constitution, rules e memory são o fallback efetivo desta story.

## Testing

- Framework: Vitest, seguindo `tests/storage-alpha/` e testes de domínio existentes.
- Unitários: paths, Unicode, prefix boundaries, capacidades e schemas.
- Integração: providers simulados, presign, sessões, ETags, completion/abort, move parcial e reconciliação.
- API/actions: 401/403/404/409/413/429, IDOR, sessão de outro usuário e permission drift.
- Componentes: loading, vazio, erro, retry, progresso, fallback, lixeira, teclado e mobile.
- E2E: fluxo autorizado e negado; upload pequeno/download/rename/move/delete/restore.
- Smoke real de 2 GiB é opt-in, nunca CI. Todo teste real usa prefixo exclusivo e cleanup verificado.
- Cenários obrigatórios: os 35 cenários numerados e todos os edge cases do prompt de implementação fornecido em 2026-09-15.

### Matriz mínima obrigatória

1. usuário não autenticado;
2. usuário sem acesso ao módulo;
3. leitura sem upload;
4. upload autorizado em uma pasta tentando outra;
5. `financeiro/` versus `financeiro-publico/`;
6. `../`, `..\\`, barras duplicadas e segmentos vazios;
7. nome Unicode;
8. nome com HTML/JavaScript;
9. nome muito longo;
10. arquivo vazio;
11. arquivo exatamente em 2 GiB;
12. arquivo acima de 2 GiB;
13. MIME declarado incorretamente;
14. conflito de nome;
15. paginação acima de 1.000 objetos;
16. URL assinada expirada;
17. sessão usada por outro usuário;
18. ETag ausente com recuperação via `ListParts`;
19. perda temporária de rede em uma parte;
20. falha na conclusão multipart;
21. cancelamento e tentativa de `AbortMultipartUpload`;
22. sessão abandonada e reconciliação;
23. NAS indisponível antes do início;
24. NAS indisponível no meio do upload;
25. fallback selecionado no início;
26. leitura de URL Vercel legada;
27. tentativa de fallback de leitura sem réplica;
28. cópia concluída com falha ao remover origem;
29. exclusão lógica e restauração;
30. acesso por ID a objeto de outro escopo;
31. duas abas alterando o mesmo item;
32. perda de permissão durante upload;
33. versão anterior no bucket versionado;
34. logs sem segredos ou URLs assinadas;
35. layout mobile e navegação por teclado.

Também cobrir: arquivo sem extensão; Unicode em formas normalizadas diferentes; nomes terminados em ponto/espaço; traversal codificado ou duplamente codificado; tamanho final divergente; parte repetida; ETag com/sem aspas; rede perdida na última parte; conclusão ambígua; cancelamento com parte em voo; sessão expirada com aba aberta; usuário desativado durante upload; NAS falhando na conclusão; fallback desligado; quota Blob esgotada; objeto sem registro; registro sem objeto; duplicata após move; lixeira com versão anterior; SVG/HTML malicioso; Content-Disposition com caracteres especiais; concorrência rename/delete; duas sessões para o mesmo destino; origem CORS inválida; relógio do cliente incorreto; tunnel/NAS indisponível; `HeadObject` 403 com lookup exato; link Blob legado sem metadado novo; e usuário comum tentando abrir administração.

## Fora do Escopo

- Migração em massa ou exclusão de qualquer Blob legado.
- Replicação automática e disaster recovery.
- Compartilhamento público permanente.
- Bucket público ou bucket por módulo.
- Administração genérica do NAS.
- Upload de 2 GiB passando pela Vercel.
- Credenciais NAS por usuário.
- Purga física da lixeira.
- Move recursivo síncrono de milhares de objetos.
- Push, PR, release, DNS ou alteração do Cloudflare Tunnel.

## 🤖 CodeRabbit Integration

**Story Type Analysis**

- Primary Type: Security
- Secondary Types: Architecture, API, Database, Frontend, Integration
- Complexity: High

**Specialized Agent Assignment**

- Primary: `@dev`, `@architect`
- Supporting: `@data-engineer`, `@qa`, `@ux-design-expert`, `@devops` somente para entrega remota/deploy

**Quality Gate Tasks**

- [ ] Pre-Commit (`@dev`): `coderabbit --prompt-only -t uncommitted`
- [ ] Pre-PR (`@devops`): `coderabbit --prompt-only --base main`
- [ ] Pre-Deployment (`@devops`): revisão de segredos, flags, CORS e rollback

**Self-Healing Configuration**

- Primary Agent: `@dev`, light mode
- Max Iterations: 2
- Timeout: 15 minutes
- Severity Filter: CRITICAL
- CRITICAL: auto-fix; HIGH: document-only; MEDIUM/LOW: não mascarar gates, registrar quando relevante.

**Focus Areas**

- Autenticação, autorização, IDOR, traversal, XSS e URLs assinadas.
- Integridade multipart, provider imutável, move parcial e reconciliação.
- Segredos/logs, schema/migration e compatibilidade com legados.
- Acessibilidade, responsividade e divisão server/client.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-09-15 | 0.1 | Draft inicial baseado no prompt operacional e na descoberta real do repositório. | River |
| 2026-09-15 | 0.2.0 | Validated GO (9/10) — Status: Draft → Ready; escopo, segurança, Vault, testes e sequência CLI-first aprovados. | Pax |
| 2026-09-15 | 0.2.1 | Development started (yolo mode) — Status: Ready → InProgress. | Dex |
| 2026-09-15 | 0.3.0 | Contratos de paths/capacidades, extensões de provider e CLI-first implementados; checkpoint Vault aberto antes da persistência. | Dex |
| 2026-09-15 | 0.9.0 | Migration aditiva autorizada/aplicada; API, multipart direto, UI, auditoria, tutorial e smokes entregues. Gates globais executados; testes/API/E2E restantes mantêm a story InProgress. | Dex |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npx vitest run tests/alpha-explorer` — 11 testes aprovados.
- `npm run explorer:doctor` — QuObjects e Blob saudáveis; flags desligadas.
- `npm run explorer:permissions -- --user-id=1 --path=financeiro/2026/notas --capability=list` — autorização administrativa aprovada.
- `npm run explorer:acl-set -- --user-id=1 --subject-type=USER --subject-id=2 --prefix=comercial --capabilities=list,read,upload` — dry-run aprovado; confirmação incorreta recusada sem escrita.
- `npm run explorer:list -- --user-id=1 --prefix=financeiro --limit=5` — listagem real QuObjects aprovada.
- `npm run explorer:reconcile -- --user-id=1 --prefix=` — dry-run aprovado, zero multipart incompleto.
- `scripts/verify-turso-backup.mjs` — backup específico restaurado e verificado antes do checkpoint.
- `npx vitest run tests/alpha-explorer tests/storage-alpha/quobjects.test.ts tests/storage-alpha/vercel-blob.test.ts` — 32/32 testes aprovados em 8 arquivos.
- `npm run lint` — PASS.
- `npm run typecheck` — FAIL fora do Explorer: 21 erros no snapshot final em Exclusão Fiscal, script `node:sqlite`, Bibble, Gerador de Documentos e Radar; o worktree paralelo continuou mudando durante a validação.
- `npm test` — 3.179 testes aprovados, 20 falharam, 1 todo; falhas em 13 arquivos fora do Explorer.
- `npm run build` — PASS; página e oito rotas do Explorer emitidas.
- `npx prisma validate && npx prisma generate` — PASS.
- `explorer:smoke` QuObjects/Blob 10 MiB — PASS, checksum e cleanup verificados.
- `coderabbit --prompt-only -t uncommitted` — não executado; binário local ausente.

### Completion Notes List

- CLI isolada do runtime React/Next para funcionar via `tsx --conditions=react-server`.
- Leitura de permissões efetivas extraída para módulo server-only reutilizável sem alterar a semântica da Server Action existente.
- Vault concluído: backup de produção restaurável e SHA-256 verificados; autorização explícita registrada; aplicadas somente quatro tabelas e 16 índices, sem `DROP`, `ALTER`, seed ou backfill; zero violação de FK.
- Multipart do navegador usa 64 MiB, concorrência 3, URLs QNAP de 5 minutos e sessão de 2 horas. Blob privado usa token de upload restrito e URL GET assinada por 120 segundos.
- Mutações HTTP exigem `Origin` same-origin; autorização e ownership são recalculados no servidor, inclusive durante assinatura/conclusão do upload.
- Anubis: nenhum achado crítico remanescente no delta. Rate limit em memória requer proteção distribuída/WAF no rollout horizontal.
- Story permanece `InProgress`: faltam testes automatizados de API/componentes/E2E para toda a matriz obrigatória, CodeRabbit indisponível e gates globais de typecheck/test têm dívida externa.

### File List

- `docs/stories/story-alpha-explorer-modulo-arquivos-nas.md` — story inicial.
- `docs/operations/alpha-explorer.md` — tutorial operacional e rollback por flags.
- `docs/qa/storage-alpha/alpha-explorer-implementation.md` — blueprint, Vault e evidências.
- `.bibble/memory/codebase-map.md` — mapa permanente do módulo.
- `.bibble/memory/integration-points.md` — pontos de integração e limites operacionais.
- `.env.example` — flags server-only do rollout.
- `package.json`, `package-lock.json` — comandos CLI, React Query e `@vercel/blob` 2.8.x.
- `prisma/schema.prisma` — quatro models do Explorer e relações com usuários.
- `prisma/migrations/20260915191500_alpha_explorer_foundation/migration.sql` — DDL aditivo aprovado.
- `scripts/alpha-explorer.mjs` — entrypoint CLI sanitizado.
- `src/actions/PermissoesSetor.ts` — delegação da leitura efetiva para domínio server-only reutilizável.
- `src/lib/alpha-explorer/authorization.ts` — autorização conservadora e fail-closed.
- `src/lib/alpha-explorer/capabilities.ts` — capacidades e avaliação de grants por prefixo.
- `src/lib/alpha-explorer/cli.ts` — doctor, permissions, list, reconcile e bridge de smoke.
- `src/lib/alpha-explorer/paths.ts` — normalização e proteção contra traversal/prefix confusion.
- `src/lib/alpha-explorer/runtime.ts` — leitura validada das feature flags.
- `src/lib/alpha-explorer/errors.ts`, `http.ts`, `schemas.ts` — erros, segurança HTTP e contratos Zod.
- `src/lib/alpha-explorer/observability.ts`, `rate-limit.ts` — auditoria/logs e limitação de taxa.
- `src/lib/alpha-explorer/service.ts`, `storage.ts` — casos de uso, persistência e providers registrados.
- `src/lib/permissions/effective.ts` — permissões de módulo em contexto server-only não-web.
- `src/lib/modulos-registry.ts` — registro único `exploradorArquivos`.
- `src/lib/storage/contracts.ts` — contratos de listagem/cópia/multipart do Explorer.
- `src/lib/storage/providers/quobjects.ts` — operações S3/QuObjects adicionais.
- `src/lib/storage/providers/vercel-blob.ts` — listagem/cópia do provider alternativo.
- `src/app/api/alpha-explorer/` — oito Route Handlers autenticados.
- `src/app/PainelAlpha/ExploradorArquivos/page.tsx` — entrada Server Component protegida.
- `src/components/AlphaExplorer/` — workspace, itens, upload direto e tutorial.
- `tests/alpha-explorer/capabilities.test.ts` — testes de grants e limites de prefixo.
- `tests/alpha-explorer/paths.test.ts` — testes de caminhos, Unicode e traversal.
- `tests/alpha-explorer/authorization.test.ts`, `contracts.test.ts`, `runtime.test.ts`, `schemas.test.ts` — autorização, multipart, flags e entradas.
- `tests/storage-alpha/quobjects.test.ts`, `vercel-blob.test.ts` — compatibilidade QuObjects e URL Blob assinada.

## QA Results

_A preencher pelo `@qa`._
