# Story: Restaurar leitura confiável de PDF e respostas completas no Bibble

## Status

In Progress

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["lint", "typecheck", "test", "build", "coderabbit"]

## Story

**Como** usuário do IAlpha que envia um PDF ao Bibble,  
**quero** que o conteúdo extraível do documento seja considerado de forma confiável e que haja espaço reservado para a resposta,  
**para que** o Bibble não ignore partes do PDF nem entregue uma resposta abreviada por esgotamento da janela de contexto.

## Acceptance Criteria

1. Ao enviar um único PDF suportado pelo fluxo atual de extração, o Bibble não descarta silenciosamente o conteúdo extraído por cortes fixos de 50.000 ou 25.000 caracteres; o processamento usa um orçamento compatível com a janela efetiva do modelo e mantém acesso ao conteúdo relevante do início, meio e fim do documento.
2. Quando o PDF completo não couber em uma única requisição do provedor, o fluxo trata o documento de forma consciente da capacidade, sem fingir que leu trechos descartados; qualquer limitação que impeça a análise integral é comunicada de forma explícita ao usuário.
3. O conteúdo do PDF considerado no turno atual e o conteúdo preservado para perguntas posteriores seguem a mesma política de orçamento, sem uma segunda truncagem silenciosa no cliente, na rota de chat ou na persistência da mensagem.
4. Enquanto qualquer anexo estiver em upload, com erro ou sem os dados necessários para envio, o botão de envio e o atalho Enter permanecem bloqueados e não chamam `onSend`; o estado visual informa que os uploads ainda não estão prontos ou que há falha a resolver.
5. `BibbleChatLayout.handleSend` aplica uma guarda defensiva independente da UI: se qualquer anexo ainda não estiver pronto, o envio é cancelado sem criar mensagens, iniciar stream, descartar anexos, limpar o texto ou fechar a seleção de arquivos. Quando todos estiverem prontos, o mesmo conjunto completo é usado na bolha, na requisição e na persistência.
6. Antes de chamar o provedor, o Bibble calcula um orçamento efetivo que contabiliza, no mínimo, system prompt, histórico selecionado, mensagem atual, conteúdo do PDF, ferramentas e uma reserva positiva de saída, mantendo a soma dentro da janela de contexto efetiva.
7. A chamada de completion informa explicitamente ao provedor o limite de saída suportado por aquele provider/modelo; a reserva de saída não pode ser consumida pelo conteúdo de entrada e é aplicada tanto à resposta final em streaming quanto às chamadas intermediárias sem streaming.
8. O valor padrão ou legado de `contextWindow` não pode fazer uma requisição com PDF operar silenciosamente com capacidade insuficiente. O servidor valida o valor recebido e determina a janela efetiva de forma compatível com o modelo, sem depender apenas do padrão de 4.096 configurado no cliente.
9. A cadeia de extração já existente para PDF — Tika, fallback `pdf-parse` e OCR PDF24 quando configurado — permanece funcional; falha de uma fonte continua acionando o fallback aplicável, e falha total retorna uma indicação clara de que não houve texto útil para analisar.
10. A resposta SSE entrega integralmente todos os chunks retornados pelo provedor até o encerramento do stream. O motivo de término do provedor é observado; encerramento por limite de saída não é registrado como uma resposta normalmente concluída.
11. A observabilidade registra, de forma estruturada e por etapa, fonte de extração, tamanho extraído, tamanho efetivamente incluído, janela efetiva, orçamento de entrada, reserva/limite de saída, estratégia aplicada ao documento e motivo de término. Logs não incluem texto do PDF, prompts, respostas, conteúdo em base64, URLs assinadas, tokens, segredos ou dados pessoais do documento.
12. Testes de regressão automatizados cobrem: PDF textual sintético acima de 50.000 caracteres com marcadores no início, meio e fim; ausência do corte fixo de 25.000 caracteres; bloqueio por botão e Enter durante upload/erro; guarda defensiva de `handleSend` sem limpeza prematura; envio após todos os anexos ficarem prontos; capacidade insuficiente; valor legado de 4.096; cálculo `entrada + reserva de saída <= janela efetiva`; serialização do limite de saída no request do provedor; preservação do stream completo; detecção de término por limite; e logs sem conteúdo sensível.
13. Os testes do encadeamento de extração cobrem sucesso via Tika e os fallbacks já existentes sem depender de serviços externos, PDFs privados, Vercel Blob real ou chamadas reais a modelos no CI.
14. Não há alteração de schema, migration, seed, backfill, RLS, dados persistidos em massa ou qualquer outra mudança estrutural de banco de dados nesta story.
15. Os gates `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` passam; a revisão CodeRabbit não apresenta issue `CRITICAL` quando a ferramenta estiver disponível, e a checklist e a File List são atualizadas antes da conclusão.

## CodeRabbit Integration

### Story Type Analysis

**Primary Type**: API  
**Secondary Type(s)**: Frontend, Integration, observabilidade e testes de regressão  
**Complexity**: High — o orçamento atravessa upload, montagem de contexto, completion multi-provider, streaming e persistência do turno.

### Specialized Agent Assignment

**Primary Agents**:

- @dev — implementação e revisão pre-commit.
- @qa — validação dos limites, regressão e ausência de vazamento nos logs.

**Supporting Agents**:

- @architect — validar o contrato de orçamento entre as camadas e os providers, caso seja necessário alterar uma interface compartilhada.
- @github-devops — revisão pre-PR e execução dos gates de entrega.

### Quality Gate Tasks

- [ ] Pre-Commit (@dev): executar `coderabbit --prompt-only -t uncommitted` antes de marcar a story como concluída, quando a ferramenta estiver disponível.
- [ ] Pre-PR (@github-devops): executar a revisão CodeRabbit em relação à `main` antes de criar o pull request, quando a ferramenta estiver disponível.
- [ ] Gate do projeto (@dev): executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.

### Self-Healing Configuration

**Expected Self-Healing**:

- Primary Agent: @dev (light mode)
- Max Iterations: 2
- Timeout: 15 minutes
- Severity Filter: CRITICAL

**Predicted Behavior**:

- CRITICAL issues: auto_fix em até 2 iterações.
- HIGH issues: document_only.
- MEDIUM issues: ignore.
- LOW issues: ignore.

### CodeRabbit Focus Areas

**Primary Focus**:

- Invariantes do orçamento: entrada e reserva de saída nunca excedem a janela efetiva.
- Ausência de truncagem silenciosa do PDF entre upload, chat, completion e persistência.

**Secondary Focus**:

- Compatibilidade do limite de saída com cada provider e com chamadas streaming/não streaming.
- Bloqueio consistente de botão, Enter e `handleSend` até todos os anexos estarem prontos.
- Logs úteis sem exposição de conteúdo do documento, prompt, resposta ou credenciais.

## Tasks / Subtasks

- [x] Task 1 — Isolar e formalizar o orçamento efetivo da requisição (AC: 6–8)
  - [x] Mapear os componentes que consomem contexto e definir uma única regra testável para janela efetiva, orçamento de entrada e reserva de saída.
  - [x] Validar no servidor valores ausentes, legados, inválidos ou insuficientes de `contextWindow`.
  - [x] Garantir que a seleção do conteúdo de entrada respeite a reserva positiva de saída antes da chamada ao provedor.
- [x] Task 2 — Remover os cortes silenciosos do caminho do PDF (AC: 1–3, 9)
  - [x] Ajustar o contrato entre upload e chat para não perder silenciosamente o conteúdo após 50.000 caracteres.
  - [x] Substituir o corte fixo por arquivo após 25.000 caracteres por processamento consciente do orçamento da requisição.
  - [x] Alinhar o conteúdo enviado no turno e o conteúdo preservado para perguntas posteriores.
  - [x] Manter a cadeia Tika → `pdf-parse` → PDF24 e tornar explícito o caso em que não há texto útil.
- [x] Task 3 — Eliminar a race entre upload e envio (AC: 4, 5, 12)
  - [x] Incluir `filesReady` na condição única que habilita o botão de envio e o atalho Enter no `BibbleChatInput`.
  - [x] Manter o envio bloqueado diante de upload pendente, falha ou anexo sem dados prontos, com estado visual coerente.
  - [x] Revalidar todos os anexos no início de `BibbleChatLayout.handleSend` antes de qualquer limpeza, criação de mensagem ou stream.
  - [x] Garantir que a transição para pronto não perde anexos e que o conjunto enviado é consistente em todas as representações do turno.
- [x] Task 4 — Propagar a reserva de saída até os providers (AC: 6, 7, 10)
  - [x] Estender o contrato de `callCompletion` para receber o orçamento de saída calculado.
  - [x] Serializar o parâmetro de limite de saída adequado ao provider/modelo nas chamadas intermediárias e finais.
  - [x] Preservar todos os chunks SSE e classificar corretamente o motivo de término, inclusive término por limite.
- [x] Task 5 — Adicionar observabilidade segura (AC: 2, 10, 11)
  - [x] Emitir métricas/logs estruturados apenas com metadados de orçamento, extração, estratégia e término.
  - [x] Cobrir com teste que sentinelas do PDF, prompts, respostas, URLs, base64 e segredos não aparecem nos logs.
  - [x] Permitir distinguir falha de extração, redução por capacidade e término por limite de saída sem registrar o conteúdo do usuário.
- [x] Task 6 — Implementar a regressão automatizada (AC: 1–13)
  - [x] Criar fixture sintética de PDF/texto com mais de 50.000 caracteres e sentinelas no início, meio e fim, sem dados reais.
  - [x] Testar o orçamento com a janela padrão atual, valor legado de 4.096, janela suficiente e janela insuficiente.
  - [x] Testar botão e Enter com upload pendente/erro e testar a guarda direta de `handleSend`, confirmando que texto e anexos permanecem selecionados até todos estarem prontos.
  - [x] Mockar Tika, `pdf-parse`, OCR, Blob e provider para manter a suíte determinística e offline.
  - [x] Verificar o body das chamadas de completion, o stream SSE completo e os motivos de término.
  - [x] Confirmar que perguntas sobre trechos no início, meio e fim do PDF não dependem de conteúdo privado nem de serviço externo.
- [ ] Task 7 — Executar os gates e concluir o handoff (AC: 14, 15)
  - [x] Confirmar no diff a ausência de schema, migrations, seeds, backfills, RLS ou mutações de dados em massa.
  - [ ] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.
  - [x] Executar CodeRabbit quando disponível e tratar qualquer issue `CRITICAL` (indisponível: WSL não instalado).
  - [x] Atualizar checkboxes, Dev Agent Record, Completion Notes e File List desta story.

## Dev Notes

### Contexto do incidente e fluxo atual

- O upload aceita `application/pdf`, extrai o texto em paralelo ao envio ao Blob e hoje reduz `extractedContent` para os primeiros 50.000 caracteres antes de devolver o payload ao cliente. [Source: `src/app/api/bibble/upload-to-blob/route.ts#POST`]
- A rota de chat aplica outro corte por arquivo em `MAX_CONTENT_CHARS = 25000`, inclusive quando recebe `extractedContent` já produzido no upload. Esse segundo limite pode eliminar partes adicionais do documento antes da montagem da mensagem do usuário. [Source: `src/app/api/bibble/chat/route.ts#truncate`; `src/app/api/bibble/chat/route.ts#extractFilesContent`]
- O cliente também persiste no conteúdo da mensagem somente `extractedContent.slice(0, 25000)`, o que afeta a capacidade de reenxergar o documento após recarregar a sessão ou em perguntas futuras. [Source: `src/components/BibbleChatHome/BibbleChatLayout.tsx#handleSend`]
- Há uma race confirmada entre upload e envio: `BibbleChatInput` calcula `filesReady`, mas `canSend` não usa esse valor. Por isso, o botão e o Enter podem chamar `onSend` enquanto o PDF ainda está em upload. [Source: `src/components/BibbleChatHome/BibbleChatInput.tsx#canSend`; `src/components/BibbleChatHome/BibbleChatInput.tsx#handleSend`]
- No callback do layout, a guarda atual verifica apenas se existe texto ou algum item em `uploadFiles`; em seguida filtra `readyFiles`, cria o turno e limpa toda a seleção com `setUploadFiles([])`. Se o envio ocorrer durante o upload, o PDF pendente é excluído da requisição e removido da UI antes de concluir, reproduzindo o relato de que o Bibble não leu o arquivo. [Source: `src/components/BibbleChatHome/BibbleChatLayout.tsx#handleSend`]
- O `contextWindow` inicial do cliente é 4.096 e é persistido em `localStorage`; a rota usa o valor recebido para o runner e utiliza 8.192 apenas quando o cliente não fornece um valor positivo. [Source: `src/components/BibbleChatHome/BibbleChatLayout.tsx#contextWindow`; `src/app/api/bibble/chat/route.ts#POST`]
- A seleção de histórico estima aproximadamente quatro caracteres por token e reserva parte da janela para outros elementos, mas o conteúdo do PDF é incorporado à mensagem atual antes dessa seleção; não existe um contrato único que prove a invariante de orçamento da requisição completa. [Source: `src/app/api/bibble/chat/route.ts#POST`]
- `callCompletion` envia modelo, mensagens, streaming, temperatura opcional, ferramentas nas chamadas sem streaming e `options.num_ctx` para Ollama. O request atual não recebe nem serializa um orçamento explícito de saída. [Source: `src/lib/bibble/completion.ts#callCompletion`]
- A extração já tenta Tika, usa `pdf-parse` para PDF quando necessário e pode acionar OCR PDF24 quando configurado. Esta story preserva essa cadeia e corrige perda de conteúdo/orçamento; não introduz um novo extrator. [Source: `src/lib/bibble/tika.ts#extractTextFromBuffer`]
- O arquivo obrigatório de coerência cruzada `accumulated-context.md` não existe neste workspace. A coerência foi verificada contra as stories existentes do IAlpha/Bibble e contra o fluxo atual; nenhum requisito de epic foi encontrado para copiar literalmente.
- `.aiox/gotchas.json` também não existe neste workspace; portanto não havia gotcha de Stories, Sprint-Planning ou Process a aplicar além das regras presentes no `AGENTS.md`, na Constitution e nos artefatos da story.

### Limites e decisões de escopo

- A story trata somente da leitura de um PDF no Bibble e da reserva de saída necessária para respostas não abreviadas. Não adiciona busca semântica, RAG, banco vetorial, nova UI de documentos, novo provider ou novo formato de arquivo.
- A técnica concreta para lidar com PDF maior que a entrada disponível pode adaptar o conteúdo à capacidade, desde que satisfaça os ACs de acesso confiável, transparência e orçamento. A story não impõe chunking, sumarização, paginação ou outra arquitetura não aprovada.
- Nenhuma nova variável de ambiente é obrigatória. As configurações existentes de Tika, Blob e PDF24 permanecem sob seus contratos atuais.
- Não existe dependência de story anterior. O incidente é corretivo e obrigatório antes de considerar confiável o uso de PDF no IAlpha.

### Project Structure Notes

- Arquivos centrais esperados: `src/app/api/bibble/upload-to-blob/route.ts`, `src/app/api/bibble/chat/route.ts`, `src/lib/bibble/completion.ts`, `src/components/BibbleChatHome/BibbleChatInput.tsx` e `src/components/BibbleChatHome/BibbleChatLayout.tsx`.
- `src/lib/bibble/tika.ts` deve permanecer compatível e só deve mudar se os testes demonstrarem necessidade para explicitar metadados/erros do contrato de extração.
- Os testes de regressão devem ficar em `tests/bibble/`, junto aos testes atuais do domínio Bibble.
- Se a regra de orçamento for extraída para um módulo puro e reutilizável, o arquivo deve permanecer sob `src/lib/bibble/` e ser incluído na File List final.
- Não foram encontrados documentos em `docs/architecture/` ou `docs/framework/` nos caminhos configurados; os contratos e caminhos desta story foram extraídos do código existente, sem inventar biblioteca ou padrão novo.

### Testing

- Framework existente: Vitest com cobertura V8, executado por `npm test`. [Source: `package.json#scripts`; `vitest.config.ts`]
- Local esperado: `tests/bibble/`, seguindo os testes existentes do domínio. [Source: `tests/bibble/`]
- Os testes devem usar fixtures sintéticas e mocks de rede. Não devem exigir Tika, PDF24, Vercel Blob ou um provedor de IA reais.
- O teste do documento grande deve usar sentinelas não sensíveis no início, meio e fim e validar comportamento, não snapshots com conteúdo real.
- Os testes de interface devem exercer separadamente clique e Enter com: anexo em upload, anexo com erro, anexo pronto e transição assíncrona de pendente para pronto. Em nenhum estado incompleto `onSend` pode ser chamado.
- O teste do layout deve chamar `handleSend` por uma via que não dependa da proteção visual e comprovar a guarda defensiva: nenhum request, mensagem, stream ou limpeza ocorre enquanto existir anexo incompleto; após a conclusão, o PDF aparece na bolha, na requisição e no conteúdo persistido.
- O teste de completion deve inspecionar o request de cada provider suportado pelo contrato alterado e provar que o limite de saída é explícito nas chamadas com e sem streaming.
- O teste de orçamento deve provar matematicamente a invariante `entrada estimada + reserva de saída <= janela efetiva`, incluindo overhead de ferramentas e mensagens de sistema considerado pela implementação.
- Os gates obrigatórios são `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`, além de CodeRabbit sem issue `CRITICAL` quando disponível. [Source: `AGENTS.md#Quality Gates`; `.aiox-core/constitution.md#V-Quality-First`]

### Autonomous Decisions

- `[AUTO-DECISION] Há epic com ACs para copiar literalmente? → Não foi localizado; os ACs foram derivados somente do relato do incidente e dos achados técnicos fornecidos (reason: a missão é uma story corretiva obrigatória e proíbe inventar requisitos).`
- `[AUTO-DECISION] Qual status inicial usar? → Ready for Dev (reason: o requisito do incidente foi confirmado como aprovado e a missão autorizou o handoff direto para desenvolvimento).`
- `[AUTO-DECISION] A solução deve impor chunking/RAG? → Não (reason: o requisito é o resultado confiável e o orçamento de saída; a arquitetura concreta deve ser validada durante a implementação).`
- `[AUTO-DECISION] É necessário acionar Vault? → Não (reason: a story proíbe qualquer mudança estrutural ou mutação de banco de dados).`
- `[AUTO-DECISION] Como testar sem dados privados? → PDF/texto sintético com sentinelas e providers/extratores mockados (reason: reproduz os limites de tamanho e mantém o CI determinístico e seguro).`

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-08-11 | 1.0 | Story corretiva criada para restaurar a leitura confiável de PDF e reservar orçamento de saída nas respostas do Bibble. | River |
| 2026-08-11 | 1.1 | Race de upload confirmada incorporada aos ACs, tarefas, testes, notas técnicas e File List. | River |
| 2026-08-11 | 1.2.0 | Implementação iniciada em modo YOLO; Tasks 1–6 concluídas, gates globais bloqueados por falhas externas registradas no Dev Agent Record. | Dex |
| 2026-08-11 | 1.2.1 | Correção Probe: término por limite passa a ser falha não persistível, com restauração integral do turno e defesa contra servidor legado. | Dex |
| 2026-08-11 | 1.2.2 | Hardening Anubis: validação strict, Blob/PDF24 same-origin, upload opaco, magic bytes e isolamento de anexos. | Dex |
| 2026-08-11 | 1.2.3 | Regressões Probe/Anubis: histórico alinhado à persistência, limites agregados e isolamento integral de anexos. | Dex |
| 2026-08-11 | 1.2.4 | Gate final: inferência genérica do limitador corrigida e duração do upload alinhada ao fallback de OCR. | Codex |

## Story Draft Checklist Validation

| Category | Status | Evidence |
|---|---|---|
| 1. Goal & Context Clarity | PASS | O incidente, o benefício, o fluxo afetado, as dependências e os limites de escopo estão explícitos. |
| 2. Technical Implementation Guidance | PASS | Upload, input, guarda do layout, chat, completion, extração, invariantes de orçamento e arquivos centrais estão identificados sem impor arquitetura nova. |
| 3. Reference Effectiveness | PASS | As referências apontam para arquivo e função/seção relevante; a ausência de arquitetura e accumulated context está documentada. |
| 4. Self-Containment Assessment | PASS | Cortes atuais, janela padrão, reserva de saída, falhas, transparência e privacidade estão resumidos na própria story. |
| 5. Testing Guidance | PASS | Há cenários mensuráveis para conteúdo grande, orçamento, providers, stream, fallbacks e logs seguros. |
| 6. CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e focos estão preenchidos conforme `coderabbit_integration.enabled: true`. |

**Quick Summary:** READY; clareza 9/10; sem gap bloqueante conhecido.  
**Developer Perspective:** a story contém informação suficiente para iniciar. A única decisão que pode demandar validação do `@architect` é o contrato compartilhado de orçamento caso a implementação precise alterar a interface multi-provider além de `callCompletion`.  
**Final Assessment:** READY — status `Ready for Dev`, sem implementação e sem mudança de banco de dados.

## Dev Agent Record

### Agent Model Used

GPT-5.6 (Codex) — Dex (Builder)

### Debug Log References

- `npx vitest run tests/bibble` — PASS (11 arquivos, 86 testes).
- ESLint direcionado aos arquivos da story — PASS sem erros (warnings preexistentes de UI).
- `npx next build` — PASS (compilação e geração de 70 páginas).
- `npm run typecheck` — BLOCKED por erros externos em `ExclusaoFiscal`, `HabilitacaoRadarClient` e `tests/google-calendar/sync-queue.test.ts`.
- `npm run lint` — BLOCKED pela configuração global que inclui `.agents`, `.aiox-core` e `.claude/worktrees` com milhares de violações preexistentes.
- `npm test` — BLOCKED por timeout externo em `tests/google-calendar/cli.test.ts`; o conjunto Bibble foi revalidado separadamente com 86 testes passando.
- `npm run build` — BLOCKED em `prisma generate` por `EPERM` no engine em uso; `npx next build` passa.
- CodeRabbit — indisponível: WSL configurado não está instalado neste host.

### Completion Notes List

- Race eliminada com uma regra única de prontidão (`uploading=false`, sem erro e URL confirmada) usada pelo input e pela guarda defensiva do layout.
- Texto e anexos são restaurados para retry quando o stream termina sem `done` válido; resposta parcial nunca é persistida como sucesso.
- Achado Probe corrigido: `length`/`max_tokens` emite mensagem explícita e `done successful:false`; o cliente também rejeita `truncated:true` mesmo se um servidor legado declarar sucesso.
- Cortes fixos de 50k/25k removidos; redução por capacidade preserva início/meio/fim e inclui aviso explícito.
- Janela legada de 4.096 é corrigida no servidor para PDF; entrada, ferramentas, histórico e reserva positiva de saída respeitam a janela efetiva.
- PDF usa uma única geração final em streaming; `maxDuration` elevado de 60s para 120s conforme precedentes de rotas de IA existentes.
- Limite de saída serializado por provider/modelo; SSE preserva chunks e classifica `finish_reason`, inclusive EOF anormal e limite de saída.
- Logs de PDF/completion contêm apenas metadados. Tika → pdf-parse → PDF24 foi preservado e testado offline.
- Hardening de anexos: `ChatInput` usa Zod strict com limites; fetch aceita apenas HTTPS do Vercel Blob sob `/bibble-chat/`, sem redirects; qualquer anexo desabilita tools; upload usa chave opaca, valida MIME/PDF e reduz o texto devolvido preservando início/meio/fim com aviso.
- O histórico aceita o envelope persistido de até 10 extrações no turno seguinte, mantendo teto agregado; o corpo é lido com limite de 8 MiB antes do `JSON.parse` e `base64` client-input foi removido.
- UI e servidor compartilham limite de 10 anexos e a allowlist MIME; o 11º arquivo não inicia upload, janelas de 512/1.024 continuam válidas e anexos também bloqueiam ações diretas de calendário/chamado.
- PDF24 resolve todos os downloads na mesma origem configurada e só adiciona autorização após essa validação.
- A rota de upload declara `maxDuration=600`, cobrindo o polling de OCR de até oito minutos; o gate final de TypeScript também corrigiu a inferência do helper que limita anexos sem alterar o contrato de UI.
- IDS: ADAPT nos componentes/rotas/completion/extratores existentes; CREATE apenas helpers puros de anexos, segurança, orçamento e protocolo SSE para eliminar duplicação e permitir testes determinísticos. SVG/ZIP foram removidos da allowlist por não terem preflight seguro neste fluxo.
- Story permanece `In Progress`: gates globais obrigatórios ainda não estão verdes por bloqueios externos descritos acima.

### File List

- `docs/stories/story-ialpha-bibble-leitura-confiavel-pdf-respostas-completas.md`
- `src/app/api/bibble/chat/route.ts`
- `src/app/api/bibble/upload-to-blob/route.ts`
- `src/components/BibbleChatHome/BibbleChatInput.tsx`
- `src/components/BibbleChatHome/BibbleChatLayout.tsx`
- `src/components/BibbleChatHome/BibbleFileUpload.tsx`
- `src/components/BibbleChatHome/BibbleSettingsPanel.tsx`
- `src/lib/bibble/attachments.ts`
- `src/lib/bibble/attachment-security.ts`
- `src/lib/bibble/client-stream.ts`
- `src/lib/bibble/completion.ts`
- `src/lib/bibble/context-budget.ts`
- `src/lib/bibble/pdf24-ocr.ts`
- `src/lib/bibble/tika.ts`
- `plan/self-critique-bibble-pdf-reliability.json`
- `tests/bibble/attachment-readiness.test.ts`
- `tests/bibble/attachment-security.test.ts`
- `tests/bibble/client-stream-protocol.test.ts`
- `tests/bibble/completion-budget-stream.test.ts`
- `tests/bibble/context-budget.test.ts`
- `tests/bibble/pdf-extraction-chain.test.ts`
- Nenhum arquivo de schema, migration, seed, backfill ou RLS foi criado/modificado.

## QA Results

- Probe: **APROVADO** no fluxo nativo IAlpha → Bibble, com 11 arquivos e 86/86 testes passando; sem regressão bloqueante de integração.
- Sage: cobertura principal aprovada para race, orçamento, segundo turno, limites, SSRF/MIME e protocolo SSE; riscos residuais incluem ausência de E2E autenticado, watchdog próprio do provider e distribuição do orçamento entre dez documentos longos.
- Anubis: hardening imediato aprovado para SSRF, abuso de tools, limites do payload e token PDF24, mas **segurança global reprovada** enquanto o Blob permanecer público e sem ownership server-side; também faltam quota/rate limit e validação por assinatura para formatos não-PDF.
- Forge/Lens: Lens não executado porque os gates globais obrigatórios continuam bloqueados por passivos externos registrados no Dev Agent Record.
