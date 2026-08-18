# Story: Storage Alpha — fundação CLI e prova multipart no QuObjects

## Status

InProgress

## Executor Assignment

executor: `@dev`
quality_gate: `@architect`
quality_gate_tools: `["lint", "typecheck", "tests", "build", "coderabbit", "storage:doctor", "storage:inventory", "storage:poc"]`

## Story

**Como** mantenedor do Painel Alpha,  
**quero** uma camada de storage server-only, diagnosticável por CLI, com QuObjects/NAS como provedor primário e Vercel Blob como fallback,  
**para que** os módulos possam migrar gradualmente para uploads de até 2 GB sem perder os arquivos já armazenados no Blob e sem depender de uma UI administrativa.

## Contexto e objetivo desta etapa

Esta é a fundação técnica do projeto Storage Alpha. O objetivo é provar, antes de integrar qualquer tela, que o Painel Alpha consegue:

1. identificar todos os consumidores atuais do Vercel Blob;
2. validar de forma segura a configuração do QuObjects e do fallback;
3. representar diferentes storages lógicos sem expor credenciais;
4. enviar, consultar e remover um objeto de teste de até 2 GiB no bucket POC usando multipart;
5. selecionar o Vercel Blob quando o NAS estiver indisponível antes do início de um upload.

O piloto existente usa o storage space `painel-alpha-poc`, o bucket privado `pa-poc-private` e o endpoint público S3 `https://storage-poc.alpha-comex.com`, entregue pelo conector Cloudflare Tunnel executado no Linux Server `ialpha`.

## Acceptance Criteria

1. Existe um comando canônico `storage:inventory`, estritamente read-only, que localiza os usos de `@vercel/blob` e `@vercel/blob/client` no projeto e produz inventário sanitizado contendo, no mínimo: arquivo consumidor, módulo lógico inferido somente quando verificável, fluxo client/server, operação observada e variável de token explicitamente referenciada. Casos sem classificação segura são marcados como `unclassified`, sem suposição silenciosa.
2. Existe um comando `storage:doctor`, estritamente read-only, que valida a configuração server-only dos dois provedores e reporta separadamente: variáveis obrigatórias presentes, resolução/conectividade do endpoint S3, TLS/HTTP, autenticação S3, acesso ao bucket POC e disponibilidade da configuração do Vercel Blob.
3. `storage:doctor` nunca imprime endpoint interno do NAS, access key, secret key, token Blob, header `Authorization`, URL assinada completa ou resposta bruta que possa conter segredo. A saída pode exibir apenas nomes lógicos, hostname público permitido, estados sanitizados, latências e códigos de erro classificados.
4. Os comandos `storage:inventory`, `storage:doctor` e `storage:poc` emitem resultado JSON estável no formato `{ ok, command, code, checks, timestamp }` e usam exit code `0` para sucesso, `1` para indisponibilidade de provedor/rede e `2` para configuração ou contrato inválido.
5. Existe um contrato TypeScript server-only para provider de storage que cubra, sem depender de componentes React: diagnóstico, início de upload, upload de partes, conclusão, cancelamento, consulta de metadados, download/URL temporária e exclusão. O contrato não autoriza que credenciais sejam enviadas ao navegador.
6. Existe um catálogo server-only de storages lógicos. No POC, o sistema lógico `documentos` resolve para QuObjects como primário (`painel-alpha-poc` / `pa-poc-private`) e para o store Blob já configurado como fallback. O catálogo não contém chaves ou tokens e rejeita sistema lógico desconhecido.
7. A configuração de runtime é validada antes de qualquer operação, diferencia endpoint público e endpoint interno opcional, mantém credenciais apenas no servidor e documenta em `.env.example` somente nomes de variáveis e exemplos não secretos.
8. O comando opt-in `storage:poc` suporta um ciclo verificável no QuObjects: criar ou receber um arquivo determinístico de teste, iniciar multipart, enviar partes, concluir, executar `HEAD`, baixar/verificar conteúdo por checksum e apagar apenas o objeto criado pelo próprio comando.
9. O POC aceita tamanho configurável até `2 GiB`. Para atravessar o Cloudflare sem exceder o menor limite documentado de `100 MB` por requisição, o tamanho padrão de parte é `64 MiB`, nunca ultrapassa `95 MiB`, e a última parte pode ser menor. Um teste de 2 GiB resulta em múltiplas partes e não envia o corpo do arquivo por uma Vercel Function.
10. Falhas transitórias no envio de uma parte são repetidas com limite e backoff; falha definitiva cancela o multipart quando possível e retorna erro sanitizado. O comando não deixa o teste marcado como sucesso sem `CompleteMultipartUpload`, `HEAD` e verificação de integridade.
11. A seleção de fallback ocorre somente antes do início do upload: se o primário falhar no preflight dentro do timeout definido, o orquestrador seleciona Vercel Blob e usa upload multipart. Um upload já iniciado em um provider não troca silenciosamente de provider no meio do arquivo.
12. O teste real do fallback é opt-in, usa objeto pequeno por padrão para evitar custo acidental e apaga somente o próprio objeto após a validação. Testes automatizados provam a seleção do fallback e o modo multipart com providers simulados, sem rede real.
13. O resultado de uma operação retorna metadados independentes de provider contendo pelo menos: `provider`, `logicalStorage`, `bucketOrStore`, `objectKey`, `size`, `contentType`, `checksum` quando disponível e identificador/URL do provider. Nesta story os metadados não são persistidos no Turso.
14. Nenhum arquivo existente no Vercel Blob é copiado, alterado ou excluído. URLs Blob já gravadas continuam válidas e nenhum endpoint de upload atual é migrado nesta story.
15. Não há UI, dashboard, alteração de schema, migration, seed, backfill ou mutação em massa de banco. Qualquer futura persistência do registro de objetos exige story própria e cumprimento integral do gate Vault antes da execução.
16. Testes automatizados cobrem configuração inválida, sanitização de segredos, sistema lógico desconhecido, primário saudável, primário indisponível antes do início, falha durante uma parte, cancelamento, checksum divergente, limite de tamanho, limite de parte e preservação dos fluxos atuais.
17. O teste real de 2 GiB é separado da suíte normal, exige flag explícita e confirmação do alvo POC, registra duração/throughput sem registrar segredo e deixa evidência do resultado. `npm test` não cria objetos reais nem transfere 2 GiB.
18. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` não apresentam regressão causada pela story. CodeRabbit é executado quando disponível.

## Tasks / Subtasks

- [x] Inventariar os consumidores atuais do Blob por CLI (AC: 1, 4, 14)
  - [x] Implementar varredura determinística de imports e operações conhecidas.
  - [x] Diferenciar fluxos client-side e server-side.
  - [x] Emitir `unclassified` quando não houver evidência para associar o consumidor a um sistema lógico.
  - [x] Gerar relatório JSON sanitizado sem ler ou imprimir valores de variáveis de ambiente.
- [x] Definir os contratos server-only do Storage Alpha (AC: 5, 6, 7, 13)
  - [x] Criar tipos para provider, alvo lógico, sessão multipart, parte concluída, resultado e erro normalizado.
  - [x] Criar catálogo inicial com o sistema lógico `documentos` e rejeição de chaves desconhecidas.
  - [x] Validar configuração por provider e documentar somente placeholders em `.env.example`.
  - [x] Garantir que módulos server-only não sejam importáveis acidentalmente pelo bundle client.
- [x] Implementar diagnóstico CLI read-only (AC: 2, 3, 4)
  - [x] Validar configuração local sem imprimir valores.
  - [x] Classificar DNS, timeout, TLS, HTTP, autenticação, bucket ausente/negado e Blob não configurado.
  - [x] Implementar timeouts e saída JSON/exit codes estáveis.
- [x] Implementar adapter QuObjects/S3 para o POC (AC: 5, 8, 9, 10, 13)
  - [x] Usar as APIs S3 compatíveis de multipart: iniciar, enviar parte, listar/acompanhar, concluir e cancelar.
  - [x] Usar partes padrão de 64 MiB e bloquear configuração acima de 95 MiB.
  - [x] Evitar materializar o arquivo inteiro em memória.
  - [x] Verificar objeto final por `HEAD`, download e checksum.
- [x] Implementar adapter de fallback Vercel Blob para o contrato mínimo da story (AC: 5, 11, 12, 13, 14)
  - [x] Reutilizar o SDK e o token já adotados pelo projeto sem alterar os uploads existentes.
  - [x] Habilitar multipart para o fallback.
  - [x] Restringir o smoke real a execução opt-in e objeto pequeno por padrão.
- [x] Implementar política de seleção do provider (AC: 11, 12)
  - [x] Executar preflight do NAS antes de iniciar o upload.
  - [x] Selecionar fallback apenas quando a falha ocorrer antes da criação da sessão no primário.
  - [x] Não reiniciar automaticamente no Blob um upload parcialmente enviado ao NAS.
- [x] Criar o comando destrutivo controlado `storage:poc` (AC: 4, 8, 9, 10, 12, 17)
  - [x] Exigir flag explícita para upload real e confirmação de que o alvo é o bucket POC.
  - [x] Usar prefixo exclusivo de teste e apagar somente a chave gerada pela execução.
  - [x] Implementar modo de arquivo existente e modo de stream determinístico até 2 GiB.
  - [x] Registrar bytes, partes, duração, throughput, provider selecionado e resultado de integridade.
- [x] Adicionar testes automatizados sem rede real (AC: 3, 6, 7, 9–12, 16, 17)
  - [x] Cobrir providers simulados, timeouts, retries, cancelamento e fallback.
  - [x] Cobrir sanitização para tokens, secrets, endpoints internos e URLs assinadas.
  - [x] Cobrir streaming/memória por comportamento, sem alocar arquivo de 2 GiB durante a suíte.
- [x] Executar o POC real e registrar evidência (AC: 8–10, 17)
  - [x] Testar objeto pequeno no NAS.
  - [x] Testar objeto de 2 GiB no NAS através de `storage-poc.alpha-comex.com`.
  - [x] Confirmar no QuObjects que não restou multipart incompleto ou objeto de teste após a limpeza.
  - [x] Testar fallback opt-in com objeto pequeno, sem remover qualquer Blob preexistente.
- [ ] Executar os quality gates e atualizar a story (AC: 18)
  - [ ] `npm run lint`
  - [ ] `npm run typecheck`
  - [ ] `npm test`
  - [ ] `npm run build`
  - [x] CodeRabbit em mudanças não commitadas, se disponível. (N/A: WSL/CodeRabbit indisponível nesta máquina.)

## Fora do Escopo

- Alterar `src/app/PainelAlpha/GerenciamentoArquivos/page.tsx` ou qualquer outro consumidor atual.
- Criar endpoints de assinatura para upload direto do navegador.
- Implementar barra de progresso, retomada após reload, dashboard ou tela de configuração.
- Persistir catálogo, metadados de objetos ou estado de replicação no Turso.
- Copiar os arquivos atuais do Vercel Blob para o NAS.
- Replicar automaticamente NAS → Blob ou Blob → NAS.
- Implementar fallback de leitura para objetos novos.
- Alterar DNS, Cloudflare Tunnel, configuração do QuObjects, bucket, usuário ou chaves no NAS.
- Excluir arquivos, stores ou tokens existentes do Vercel Blob.
- Aplicar schema, migration, seed, backfill ou mutação em massa.

## Dev Notes

### Estado da infraestrutura já validado

- QuObjects está ativo no QNAP TS-262, sobre volume RAID 1.
- O POC usa storage space `painel-alpha-poc` e bucket privado `pa-poc-private`, com versionamento habilitado e Object Lock desabilitado.
- O endpoint público é `https://storage-poc.alpha-comex.com`; o Cloudflare Tunnel é mantido no Linux Server `ialpha`, não nesta máquina Windows.
- O endpoint interno conhecido do QuObjects é `https://192.168.35.50:8010`, mas não pode aparecer em logs públicos nem ser enviado ao navegador.
- A chave S3 já foi criada e validada manualmente. Seus valores não devem ser gravados em código, documentação, Turso ou saída de CLI.
- O teste manual anterior confirmou que um arquivo enviado por cliente S3 apareceu no NAS.

### Contexto técnico verificado no projeto

- O projeto usa Next.js `16.1.6`, TypeScript, Node, Vitest e `@vercel/blob` `^2.3.1`. [Source: `package.json#dependencies`]
- Existem múltiplos consumidores diretos de `@vercel/blob`, incluindo Route Handlers, Server Actions, bibliotecas e componentes client-side; a migração não pode ser tratada como substituição de um único endpoint. [Source: varredura de imports em `src/`]
- `src/app/api/upload/route.ts` usa `handleUpload` do Vercel Blob para autorizar upload direto do cliente, mas não define tamanho máximo, autenticação ou callback útil de conclusão. [Source: `src/app/api/upload/route.ts`]
- `src/app/PainelAlpha/GerenciamentoArquivos/page.tsx` usa `@vercel/blob/client`, envia o arquivo diretamente e depois grava `newBlob.url` por `uploadDocumento`; por isso é o candidato da próxima story de integração, não desta fundação. [Source: `src/app/PainelAlpha/GerenciamentoArquivos/page.tsx#handleUpload`]
- O Alpha Motion já possui precedente de store dedicado e tentativa de compatibilidade com token legado para exclusão. [Source: `src/lib/apresentacoes/blob.ts`]
- Há fluxos server-side que recebem corpo/form-data/array buffer; eles precisarão de avaliação individual porque arquivos grandes não podem atravessar Vercel Functions. [Source: inventário de imports `@vercel/blob` em `src/app/api/` e `src/actions/`]

### Restrições externas confirmadas

- Vercel Functions limitam request e response body a 4,5 MB; uploads grandes devem ir diretamente do cliente ao storage. [Source: https://vercel.com/docs/functions/limitations#request-body-size]
- Vercel Blob suporta multipart, recomenda essa modalidade acima de 100 MB e aceita arquivos de até 5 TB. [Source: https://vercel.com/docs/vercel-blob/using-blob-sdk#multipart-uploads; https://vercel.com/docs/vercel-blob/usage-and-pricing#size-limits]
- Cloudflare limita o corpo por requisição a 100 MB nos planos Free/Pro, 200 MB no Business e 500+ MB no Enterprise; a própria documentação recomenda dividir uploads maiores. Partes de 64 MiB ficam abaixo do menor limite publicado. [Source: https://developers.cloudflare.com/support/troubleshooting/http-status-codes/4xx-client-error/error-413/#cloudflare-specific-information]
- QuObjects suporta S3 path-style e virtual-hosted style, URLs pré-assinadas e as operações multipart `InitiateMultipartUpload`, `UploadPart`, `ListParts`, `ListUploads` e `CompleteMultipartUpload`. No QTS, o limite publicado é 16 TiB por objeto, até 10.000 partes e partes de 5 MiB a 5 GiB. A QNAP recomenda testar o comportamento antes de produção. [Source: https://www.qnap.com/en/how-to/tutorial/article/quobjects-tutorial#supported-amazon-s3-apis]

### Contrato de fallback desta story

- “Fallback” nesta etapa significa escolher Vercel Blob para um **novo upload** quando o NAS falhar no preflight.
- Não significa troca de provider no meio de um multipart.
- Não significa que todo objeto salvo no NAS já terá cópia no Blob.
- Fallback de leitura exige réplica e registro persistido de localização; ambos ficam para stories posteriores.
- Arquivos legados continuam sendo servidos pelas URLs Vercel Blob atuais.

### Estrutura sugerida para validação do arquiteto

Os caminhos abaixo são sugestões alinhadas à estrutura atual e devem ser confirmados no gate de arquitetura antes de a story mudar para `Approved`:

- `src/lib/storage/contracts.ts` — tipos e erros neutros de provider.
- `src/lib/storage/catalog.ts` — catálogo server-only de storages lógicos.
- `src/lib/storage/runtime-config.ts` — leitura e validação de ambiente.
- `src/lib/storage/orchestrator.ts` — preflight e seleção de provider.
- `src/lib/storage/providers/quobjects.ts` — adapter S3/QuObjects.
- `src/lib/storage/providers/vercel-blob.ts` — adapter de fallback.
- `src/lib/storage/doctor.ts` — checks read-only e sanitização.
- `src/lib/storage/inventory.ts` — inventário estático do código.
- `scripts/storage-alpha.mjs` — entrada dos comandos CLI.
- `tests/storage-alpha/` — testes unitários e de integração simulada.
- `docs/qa/storage-alpha/` — evidências sanitizadas do POC real.

### Variáveis de ambiente

Os nomes finais devem ser confirmados pelo arquiteto. O contrato precisa separar, no mínimo:

- endpoint público S3 do QuObjects;
- endpoint interno opcional, usado somente por processos autorizados dentro da rede;
- região/identificador exigido pelo cliente S3;
- access key e secret key do usuário de serviço POC;
- storage space/bucket por sistema lógico;
- token/store Vercel Blob usado como fallback;
- timeouts, tamanho de parte e concorrência com defaults seguros.

Segredos ficam apenas no ambiente server-side. `.env.example` recebe nomes vazios ou placeholders inequívocos, nunca valores reais.

### Riscos e cuidados

- O endpoint Cloudflare pode responder `404` na raiz e ainda estar funcional como endpoint S3; o doctor deve validar operação S3 autenticada, não apenas esperar HTTP 200 em `/`.
- Bucket privado pode responder `403` ou `412` para requisição anônima; isso não substitui um teste autenticado.
- Uma falha do Linux Server, NAS, rede local ou internet torna o primário indisponível; a seleção de fallback deve ter timeout curto e erro classificável.
- Esconder o secret do navegador não basta: URLs pré-assinadas futuras precisarão restringir chave, método, duração, tipo e tamanho. Esse endpoint será tratado na próxima story.
- Um teste de 2 GiB consome banda e tempo. Ele deve ser explicitamente iniciado, nunca rodar em `npm test`, CI ou build.
- Exclusão do objeto de teste deve usar a chave gerada pela própria execução; listagem por prefixo seguida de bulk delete não é autorizada.
- Qualquer persistência futura de metadados ou fila de replicação no Turso aciona a política Vault antes de alterações estruturais.

## Testing

### Automatizado

- Unitários Vitest para contratos, catálogo, configuração, sanitização, policy de fallback e exit codes.
- Testes de adapter com cliente S3 e Vercel Blob simulados; nenhuma rede real na suíte padrão.
- Testes com stream pequeno que comprovem chunking, ordem/número de partes, retry limitado, cancelamento e checksum sem alocar 2 GiB.
- Teste de segurança que injete tokens, secret, endpoint interno e URL assinada em erros simulados e confirme ausência desses valores na saída.
- Teste de regressão garantindo que nenhum dos imports/consumidores atuais seja alterado pela story.

### Smoke real controlado

- `storage:doctor`: somente leitura contra o ambiente POC.
- `storage:poc`: objeto pequeno no QuObjects com limpeza e evidência.
- `storage:poc`: stream determinístico de 2 GiB no QuObjects via endpoint público, partes de 64 MiB, verificação de checksum e limpeza.
- `storage:poc`: fallback Vercel Blob com objeto pequeno, multipart e limpeza.
- Confirmar no QuObjects que não restaram uploads multipart incompletos associados ao prefixo da execução.

### Gates

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- CodeRabbit quando disponível.

## 🤖 CodeRabbit Integration

### Story Type Analysis

- **Primary Type**: Architecture
- **Secondary Type(s)**: Integration, API, Security, Infrastructure
- **Complexity**: High — introduz um contrato transversal e integra NAS, Cloudflare e Vercel Blob, mas não migra consumidores nem banco nesta etapa.

### Specialized Agent Assignment

**Primary Agents**:

- `@dev` — implementação e revisão pre-commit.
- `@architect` — validação do contrato, fronteiras server/client, fallback e evolução para replicação.

**Supporting Agents**:

- `@qa` — cenários de falha, integridade e evidência do POC.
- `@devops` — somente configuração segura, revisão pre-PR e futura operação no Linux.

### Quality Gate Tasks

- [ ] Pre-Commit (`@dev`): executar CodeRabbit em alterações não commitadas e corrigir issues CRITICAL.
- [ ] Architecture Gate (`@architect`): validar contratos, paths, variáveis de ambiente, política de fallback e compatibilidade antes de `Approved`/review.
- [ ] Pre-PR (`@devops`): revisar diff contra `main`, segredos, documentação operacional e gates.
- [ ] Pre-Deployment (`@devops`): validar ambiente e rollback antes de qualquer uso fora do POC; não há deploy de produção autorizado nesta story.

### Self-Healing Configuration

- Primary Agent: `@dev` (light mode)
- Max Iterations: 2
- Timeout: 15 minutos
- Severity Filter: CRITICAL
- CRITICAL: auto-fix; HIGH: document-only; MEDIUM/LOW: registrar sem auto-fix.

### CodeRabbit Focus Areas

**Primary Focus**:

- Vazamento de credenciais, endpoints internos e URLs assinadas.
- Streaming/multipart sem buffer integral e sem envio do arquivo por Vercel Function.
- Cancelamento e limpeza restritos ao objeto/sessão da execução.
- Fallback determinístico apenas antes do início do upload.

**Secondary Focus**:

- Compatibilidade integral com os consumidores e URLs Blob atuais.
- Timeouts, retries limitados, checksum e classificação de erros.
- Ausência de dependências client-side em módulos com secrets.
- Nenhuma alteração ou mutação de banco.

## Predicted File List

- `docs/stories/story-storage-alpha-fundacao-cli-multipart-poc.md`
- `.env.example`
- `package.json`
- `package-lock.json`
- `scripts/storage-alpha.mjs`
- `src/lib/storage/contracts.ts`
- `src/lib/storage/catalog.ts`
- `src/lib/storage/runtime-config.ts`
- `src/lib/storage/orchestrator.ts`
- `src/lib/storage/doctor.ts`
- `src/lib/storage/inventory.ts`
- `src/lib/storage/providers/quobjects.ts`
- `src/lib/storage/providers/vercel-blob.ts`
- `tests/storage-alpha/`
- `docs/qa/storage-alpha/`

## Dependências e sequência posterior

Esta story não depende de outra story, mas depende da infraestrutura POC já validada. Após aprovação e conclusão, a sequência recomendada é:

1. integrar upload direto multipart na tela `GerenciamentoArquivos` usando URLs de parte limitadas e temporárias;
2. introduzir registro persistido de objetos e URL lógica estável, sob gate Vault;
3. implementar replicação assíncrona NAS ↔ Blob, reconciliação e fallback de leitura;
4. migrar os demais módulos por storage lógico, um por vez;
5. criar observabilidade e somente depois uma UI administrativa.

## Checklist de prontidão do draft

| Categoria | Status | Observação |
|---|---|---|
| Objetivo e contexto | PASS | Escopo CLI-first, valor e limites estão explícitos. |
| Orientação técnica | PASS | Integrações, contratos, restrições e caminhos sugeridos estão descritos. |
| Referências | PASS | Código atual e documentação oficial estão apontados por seção. |
| Autossuficiência | PASS | Fallback, multipart, legado, segredos e fora de escopo estão definidos. |
| Testing | PASS | Testes simulados e smoke real de 2 GiB estão separados. |
| CodeRabbit | PASS | Tipo, agentes, gates, self-healing e focos estão preenchidos. |

**Avaliação final:** READY FOR PO/ARCHITECT REVIEW. A implementação não deve começar enquanto os nomes finais das variáveis, o SDK S3 e os caminhos sugeridos não forem validados pelo `@architect` e o status não mudar de `Draft` para `Approved`.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-08-18 | 0.1.0 | Draft CLI-first criado a partir dos requisitos de NAS primário, Vercel Blob fallback, preservação do legado e upload de até 2 GB. | River (`@sm`) |
| 2026-08-18 | 0.2.0 | Arquitetura aprovada: AWS SDK v3, S3 path-style, módulos server-only e fallback selecionado somente antes do multipart. Status: Draft → Ready. | Aria (`@architect`) |
| 2026-08-18 | 0.3.0 | Desenvolvimento iniciado em modo autônomo. Status: Ready → InProgress. | Dex (`@dev`) |
| 2026-08-18 | 0.4.0 | Fundação CLI, providers, orquestrador e 23 testes concluídos; POC real aguarda credenciais server-side. | Dex (`@dev`) |
| 2026-08-18 | 0.5.0 | POC real concluído: QuObjects 10 MiB e 2 GiB, fallback Blob 10 MiB e auditoria de limpeza; compatibilidades de ETag, HeadObject e cache Blob corrigidas. | Dex (`@dev`) |

## Dev Agent Record

### Agent Model Used

Codex (GPT-5)

### Debug Log References

- `docs/qa/storage-alpha/implementation-validation.md`
- `plan/self-critique-storage-alpha-foundation.json`
- `npm run storage:inventory`: PASS, 35 consumidores encontrados.
- `npm run storage:doctor`: CLI funcional; configuração POC ausente classificada com exit code 2 e sem vazamento.
- `npx vitest run tests/storage-alpha`: 30/30 testes passaram.
- ESLint direcionado: passou sem erros ou avisos.
- `npx next build`: passou; o wrapper `npm run build` parou antes em `prisma generate` por DLL em uso.
- Full suite: 1.499/1.502 passaram; três falhas fora do Storage Alpha (BPM, Apresentações e timeout do CLI Google Calendar).
- Typecheck completo: somente erros preexistentes fora dos arquivos desta story.
- CodeRabbit indisponível porque o WSL não está instalado.
- `npm run storage:doctor`: PASS com QuObjects e Vercel Blob saudáveis.
- QuObjects 10 MiB: PASS, checksum e limpeza confirmados.
- QuObjects 2 GiB: PASS, 32 partes, checksum confirmado em 285.190 ms e limpeza confirmada.
- Vercel Blob 10 MiB: PASS, checksum e limpeza confirmados.
- Auditoria QuObjects: zero objetos e zero multiparts incompletos no prefixo de teste.

### Completion Notes List

- Contrato server-only criado para QuObjects e Vercel Blob, com multipart, `HEAD`, download, URL temporária e exclusão.
- `storage:inventory` classifica imports reais sem falsos positivos de chamadas `get`/`put` não relacionadas.
- `storage:doctor` valida os dois providers com saída JSON sanitizada e exit codes estáveis.
- `storage:poc` exige confirmação explícita, gera stream determinístico até 2 GiB, valida SHA-256 e remove somente a chave criada.
- O fallback é selecionado apenas no preflight; falha durante multipart cancela o provider atual sem troca silenciosa.
- Nenhum upload atual, URL Blob, registro Turso, schema ou configuração de infraestrutura foi alterado.
- A validação real foi concluída sem alterar consumidores atuais, arquivos Blob preexistentes ou banco de dados.
- Compatibilidade QuObjects: `UploadPart` sem ETag usa `ListParts`; `HeadObject` 403 usa busca exata por `ListObjects` sem download.
- Compatibilidade Vercel Blob: `useCache: false` é aplicado somente a stores privados.

### File List

- `.env.example`
- `package.json`
- `package-lock.json`
- `vitest.config.ts`
- `scripts/storage-alpha.mjs`
- `src/lib/storage/contracts.ts`
- `src/lib/storage/catalog.ts`
- `src/lib/storage/runtime-config.ts`
- `src/lib/storage/sanitize.ts`
- `src/lib/storage/inventory.ts`
- `src/lib/storage/doctor.ts`
- `src/lib/storage/orchestrator.ts`
- `src/lib/storage/poc.ts`
- `src/lib/storage/providers/quobjects.ts`
- `src/lib/storage/providers/vercel-blob.ts`
- `tests/helpers/server-only.ts`
- `tests/helpers/storage-fixtures.ts`
- `tests/storage-alpha/runtime-config.test.ts`
- `tests/storage-alpha/inventory.test.ts`
- `tests/storage-alpha/doctor.test.ts`
- `tests/storage-alpha/orchestrator.test.ts`
- `tests/storage-alpha/poc.test.ts`
- `tests/storage-alpha/quobjects.test.ts`
- `tests/storage-alpha/vercel-blob.test.ts`
- `docs/qa/storage-alpha/README.md`
- `docs/qa/storage-alpha/implementation-validation.md`
- `docs/qa/storage-alpha/poc-small-20260818.json`
- `docs/qa/storage-alpha/poc-small-20260818-retry1.json`
- `docs/qa/storage-alpha/poc-small-20260818-retry2.json`
- `docs/qa/storage-alpha/poc-small-20260818-retry3.json`
- `docs/qa/storage-alpha/poc-2gib-20260818.json`
- `docs/qa/storage-alpha/poc-fallback-20260818.json`
- `docs/qa/storage-alpha/poc-fallback-20260818-retry1.json`
- `plan/self-critique-storage-alpha-foundation.json`
- `docs/stories/story-storage-alpha-fundacao-cli-multipart-poc.md`

## QA Results

_A preencher pelo `@qa`._
