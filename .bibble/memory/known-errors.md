# KNOWN ERRORS — Erros Conhecidos e Fixes

> Consultado por: Forge e todos os agentes antes de debugar
> Adicionar SEMPRE após resolver um erro novo.

---

## Template de entrada

```
### [Erro resumido]
**Sintoma:** [o que aparece no terminal/browser]
**Causa:** [por que acontece]
**Fix:** [como resolver]
**Contexto:** [quando esse erro ocorre]
**Adicionado em:** [data]
```

---

### ESLint `react-hooks/set-state-in-effect` — chamar Server Action dentro de `useEffect`
**Sintoma:** `npm run lint` reporta `error: Calling setState synchronously within an effect can trigger cascading renders` apontando para uma linha tipo `carregarDados();` ou `carregar();` dentro de um `useEffect(() => { ... }, [deps])`.
**Causa:** Regra do React Compiler (via `eslint-config-next/core-web-vitals`) detecta chamar diretamente uma função que internamente faz `setState` (mesmo que seja uma função `async` que popula estado a partir de uma Server Action) dentro do corpo de um efeito — é o padrão universal do projeto para "buscar dados ao montar" (ex: `ApresentacoesDashboard.tsx`, todo o módulo Alpha Blueprint), mas o linter trata como erro bloqueante, não warning.
**Fix:** Prefixar a chamada com `void` E manter um `// eslint-disable-next-line react-hooks/set-state-in-effect` na linha imediatamente anterior — os DOIS juntos, um sozinho não resolve (`void` sozinho não silencia o lint; o disable sozinho sem `void` deixa a Promise solta sem indicar intenção). Exemplo:
```tsx
useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
  void carregarDados();
}, [carregarDados]);
```
Para casos de leitura síncrona de layout do DOM (ex: `getBoundingClientRect()` disparando `setState` direto, sem `async`), usar só o disable comment com justificativa inline (`// eslint-disable-next-line react-hooks/set-state-in-effect -- motivo`), já que não há `Promise` para `void`.
**Contexto:** Qualquer componente novo que precise popular estado local a partir de uma Server Action ao montar (praticamente todo Dashboard/painel do projeto usa esse padrão). O projeto tem ~178 ocorrências pré-existentes desse erro em código legado (não corrigidas retroativamente) — mas todo código NOVO deve aplicar o fix, pois é um `error` bloqueante do lint, não um warning tolerável.
**Adicionado em:** 2026-07-27 (Forge, sessão Alpha Blueprint)

---

### `@xyflow/react` — `useReactFlow().updateNodeData()` não aciona autosave (edição parece funcionar mas nunca persiste)
**Sintoma:** Nenhum erro no console/build. O usuário edita o texto de um node customizado do React Flow, a UI atualiza normalmente, mas ao recarregar a página a edição sumiu — nada foi persistido, mesmo com a lógica de autosave/debounce implementada e aparentemente correta.
**Causa:** `updateNodeData(id, patch)` (do hook `useReactFlow()`) escreve diretamente no store interno do provider do React Flow, **sem passar pelo callback `onNodesChange`** do componente controlador. Quando o autosave está implementado dentro de `onNodesChange`/`handleNodesChange` (padrão natural: "salvar sempre que os nodes mudarem"), qualquer edição feita via `updateNodeData` fica invisível para esse mecanismo — o React re-renderiza (o dado mudou no store), mas o `useNodesState` do componente pai nunca dispara seu próprio `onChange`.
**Fix:** Nunca usar `useReactFlow().updateNodeData()` para editar `data` de um node quando o autosave depende de `onNodesChange`. Em vez disso, criar um React Context que carregue um callback do componente controlador (`handleDataChange(nodeId, patch)` que chama `setNodes` real), e prover esse contexto ao redor do `<ReactFlow>`. Cada node customizado consome o contexto (`useContext`) em vez de `useReactFlow()`. Implementado em `src/components/AlphaBlueprint/canvas/CanvasNodes.tsx` (`CanvasDataChangeContext`) — usar como referência para qualquer canvas futuro no projeto que precise de nodes com edição inline.
**Contexto:** Qualquer implementação de canvas com `@xyflow/react` neste projeto que tenha nodes customizados editáveis (texto, propriedades) E autosave baseado em `onNodesChange`. Também vale o mesmo cuidado para `updateNode`/`updateEdge` do mesmo hook — todos sofrem do mesmo problema de não disparar os callbacks de change.
**Adicionado em:** 2026-07-27 (Lens, sessão de melhorias do Canvas do Alpha Blueprint)

---

### `@xyflow/react` — node customizado sem `<Handle>` não permite criar conectores (regressão real reportada pelo usuário)
**Sintoma:** Ao trocar nodes de `type: "default"` (nativo do React Flow) para um componente React customizado (`nodeTypes` prop), o usuário não consegue mais arrastar das bordas do node para criar uma conexão/edge — os pontos de conexão simplesmente somem, mesmo com `onConnect` implementado corretamente no `<ReactFlow>`.
**Causa:** O node `type: "default"` nativo do xyflow já vem com 2 `<Handle>` embutidos (um `target` em cima, um `source` embaixo). Ao substituir por um componente customizado, esses handles NÃO são herdados automaticamente — é responsabilidade do componente customizado renderizar seus próprios `<Handle>` explicitamente. Esquecer isso é fácil porque nada quebra em tempo de build/типecheck: o node simplesmente renderiza sem pontos de conexão, sem erro nenhum.
**Fix:** Todo node customizado que deve ser conectável precisa importar `Handle`/`Position` de `@xyflow/react` e renderizar ao menos um `type="target"` e um `type="source"`. Para permitir conectar em qualquer direção (não só topo→baixo), usar 4 pares (top/right/bottom/left, cada um com `source` E `target`, `id` únicos). Implementado como componente compartilhado `HandlesQuatroLados` em `src/components/AlphaBlueprint/canvas/CanvasNodes.tsx`, reaproveitado pelos 4 tipos de node — copiar esse padrão para qualquer node customizado novo do xyflow no projeto. Detalhe de polish: os handles ficam com `opacity-0 group-hover:opacity-100` (visíveis só no hover ou quando o node está selecionado) para não poluir visualmente nodes pequenos — requer a classe `group` no wrapper do node.
**Contexto:** Qualquer vez que um node do xyflow migrar de `type: "default"`/tipos nativos para um componente customizado neste projeto. Testar explicitamente "consigo arrastar uma conexão das bordas?" depois de qualquer mudança em `nodeTypes` — essa regressão não aparece em nenhuma verificação automatizada (tsc/lint/build), só em teste manual real.
**Adicionado em:** 2026-07-27 (sessão de melhorias do Canvas do Alpha Blueprint — reportado pelo usuário em teste manual)

---

## Erros Catalogados

### "use server" file can only export async functions, found object
**Sintoma:** `npm run build` falha com `Failed to collect page data for /rota` → causa raiz: `A "use server" file can only export async functions, found object.`
**Causa:** Um arquivo com `"use server"` no topo (Server Actions) exportou uma constante não-função (ex: objeto de configuração, array, número) além das funções async. Next.js proíbe qualquer export que não seja `async function` nesses arquivos.
**Fix:** Mover a constante para um arquivo separado SEM `"use server"` (ex: `lib/tributos.ts`) e importar dos dois lados (do arquivo de actions e dos componentes que precisam do valor).
**Contexto:** Acontece ao tentar reexportar constantes (percentuais, configs, enums) de um arquivo de Server Actions para reuso no frontend — parece funcionar em `tsc`/dev, só quebra no `next build`.
**Adicionado em:** 2026-07-01

### InfoSimples CPF — data_nascimento formato errado
**Sintoma:** Consulta CPF retorna erro "CPF não encontrado" mesmo com dados corretos.
**Causa:** `<input type="date">` envia `YYYY-MM-DD`; InfoSimples `receita-federal/cpf` exige `DD/MM/YYYY`.
**Fix:** Converter no servidor antes de chamar a API: `[d,m,y] = iso.split('-')` → `${d}/${m}/${y}` (implementado em `paraFormatoInfoSimples()` em `/api/ConsultaCpf/route.ts`).
**Contexto:** Qualquer campo de data HTML que seja enviado para a InfoSimples.
**Adicionado em:** 2026-06-17

### pdf-parse v2 — `.default` is not a function
**Sintoma:** `TypeError: pdfParse is not a function` ao ler PDF; erro silenciado em catch → IA não lê o PDF.
**Causa:** pdf-parse v2 (`^2.x`) mudou a API. v1 exportava função; v2 exporta `{ PDFParse }` (classe). `(await import("pdf-parse")).default` é `undefined`.
**Fix:** `const { PDFParse } = await import("pdf-parse"); const p = new PDFParse({ data: buffer, verbosity: 0 }); const r = await p.getText(); await p.destroy();` — texto em `r.text`. (Centralizado em `src/lib/bibble/tika.ts` como fallback.)
**Contexto:** Qualquer uso de pdf-parse no projeto.
**Adicionado em:** 2026-06-19

### fetch body com Buffer/Uint8Array — TS2769 BodyInit
**Sintoma:** `TS2769: No overload matches this call. Type 'Buffer'/'Uint8Array' is not assignable to type 'BodyInit'`.
**Causa:** tsconfig com `target: ES2017` + lib `dom` não reconhece `Buffer`/`Uint8Array` como `BodyInit` no `fetch`.
**Fix:** passar `ArrayBuffer`: `body: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer`.
**Contexto:** Enviar binário (PUT/POST) via fetch no server-side.
**Adicionado em:** 2026-06-19

### Onyx upload de imagem — 307 no /api/chat/file (agente não lê imagem)
**Sintoma:** Agente Onyx não "vê" a imagem enviada; responde alucinando link do Qwen (`chat.qwen.ai/s/d/.../user_id`). OCR/visão nunca dispara.
**Causa:** `POST /api/chat/file` foi descontinuado na versão atual do Onyx — responde **307** (redirect p/ rota GET). Upload falha silenciosamente → `file_descriptors` vazio → agente não recebe a imagem.
**Fix:** Usar o endpoint NOVO `POST /api/user/projects/file/upload` (multipart, campo `files`). Resposta tem `user_files[]` com `id` (=user_file_id), `file_id`, `chat_file_type`. No `file_descriptors` do send-chat-message, incluir **`user_file_id`** (= `user_files[].id`) — sem ele o Onyx rejeita com "Project files provided but no project_id specified". Implementado em `uploadChatFiles` (`src/lib/onyx/client.ts`).
**Contexto:** Qualquer envio de imagem do usuário para agentes Onyx.
**Adicionado em:** 2026-06-26

### Imagem do agente Onyx some ao recarregar a conversa
**Sintoma:** Imagens (geradas e enviadas) aparecem durante o chat mas somem ao atualizar a página.
**Causa (dupla):** (1) Imagem GERADA: o Onyx persiste no texto da mensagem como `![alt](file://{uuid})` — esquema `file://` não renderiza no browser, e `files[]` da mensagem fica vazio. (2) Imagem ENVIADA: vem em `files[]` na reidratação, MAS a bolha do USUÁRIO renderiza texto puro (não markdown), então embutir como markdown não funciona.
**Fix:** Na rota `/api/onyx/session/[id]`, reescrever `file://{uuid}` → `/api/onyx/file/{uuid}` no `content`. No `loadSession` (BibbleChatLayout): mensagem do usuário recebe imagens via `message.files` (AnexoPreview renderiza); mensagem do assistente recebe via markdown no content (ReactMarkdown renderiza).
**Contexto:** Reidratação de conversas com agente Onyx. Sessões antigas (pré-fix do upload 307) não têm a imagem enviada salva — irrecuperável.
**Adicionado em:** 2026-06-26

### Prisma update P2025 em rotas idempotentes (heartbeat)
**Sintoma:** `PrismaClientKnownRequestError P2025: No record was found for an update` em log recorrente.
**Causa:** `.update()` lança quando o `where` não acha registro. Ex.: sessão JWT válida com email de usuário já removido/renomeado.
**Fix:** usar `.updateMany()` (retorna `count: 0` sem lançar); tratar `count === 0` como caso não-erro (404 silencioso, sem console.error).
**Contexto:** Updates idempotentes onde "registro não existe" não deve ser erro de servidor.
**Adicionado em:** 2026-06-19

---

## Consulta CPF InfoSimples retorna code 606/607 (nunca traz dados)
**Sintoma:** `/api/ConsultaCpf` responde erro; log mostra `code: 606` ("campo obrigatório ausente") ou `code: 607` ("data de nascimento inválida"). No browser pode logar "404 Not Found" enganosamente.
**Causa:** dois detalhes da API InfoSimples (receita-federal/cpf): (1) o campo da data chama-se **`birthdate`**, NÃO `data_nascimento`; (2) o formato exigido é **AAAA-MM-DD** (ISO), NÃO DD/MM/AAAA. O `<input type="date">` já manda AAAA-MM-DD.
**Fix:** enviar `birthdate` no formato AAAA-MM-DD (não inverter). Testado: `2003-10-25`=code 200 ✓, `25/10/2003`=607 ✗. Bônus: rota retornava `status:404` em erro de consulta (browser logava como rota inexistente) → usar 422.
**Contexto:** Vale para PainelAlpha (`src/app/api/ConsultaCpf/route.ts`) e portal AlphaParceiros (`lib/consultaActions.ts`).
**Adicionado em:** 2026-06-23

---

## "db.<model> is undefined" / action falha com catch silencioso após adicionar model novo
**Sintoma:** action retorna erro genérico sem log; teste direto mostra `Cannot read properties of undefined (reading 'create')` em `db.<novoModel>`.
**Causa:** Prisma Client em execução está STALE — o dev server subiu com o client gerado ANTES do model novo existir no schema. O model existe no schema e nos tipos, mas o runtime client não.
**Fix:** `npx prisma generate` + **REINICIAR o dev server** (Turbopack não recarrega o client). No Windows o generate dá EPERM na DLL se o node estiver rodando — parar node antes. SEMPRE logar o erro real no catch (`console.error`), nunca catch vazio.
**Adicionado em:** 2026-06-23

---

## Filtro de string PT-BR com acento nunca casa (includes retorna sempre false)
**Sintoma:** função que classifica por nome de serviço/status retorna `false` para tudo, mesmo com o termo presente. Ex.: `s.includes("revisao")` falha em "Revisão RADAR".
**Causa:** normalização com `.replace(/[^a-z0-9]/g, "")` REMOVE os caracteres acentuados junto com a pontuação — "revisão"→"reviso", "habilitação"→"habilitao". O termo de busca sem acento nunca casa.
**Fix:** remover acentos com `.normalize("NFD").replace(/[̀-ͯ]/g, "")` ANTES de qualquer filtro/lowercase. Nunca usar `[^a-z0-9]` para "limpar" string PT-BR sem antes tirar diacríticos.
**Bônus:** IDs de contrato/cliente são cuid (STRING tipo `cmpfxcy81...`), não Int — em UPDATE manual via SQL, sempre passar como arg parametrizado/aspas, nunca interpolar cru.
**Adicionado em:** 2026-06-23

---

## `prisma db push` / `migrate` não aplicam mudança de schema no Turso (só no SQLite local)
**Sintoma:** `npx prisma db push` roda e reporta sucesso ("Your database is now in sync"), mas as colunas/tabelas novas não aparecem no banco de produção real — app continua funcionando com o schema antigo em runtime, ou pior, quebra achando que a coluna existe.
**Causa:** `datasource db` do `schema.prisma` aponta pro `DATABASE_URL` (`file:./prisma/dev.db`, SQLite local). O app em runtime, porém, conecta ao Turso remoto via um adapter separado (`PrismaLibSql`, lendo `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` em `src/lib/prisma.ts`). O Prisma CLI só enxerga o `datasource` declarado no schema — nunca o adapter usado em runtime. Os dois caminhos de conexão são desacoplados.
**Fix:** Depois de `prisma generate` (regenerar tipos/client), aplicar a mudança direto no Turso via script pontual em Node com `@libsql/client/web`, lendo as mesmas envs (`TURSO_DATABASE_URL` com `libsql://` trocado por `https://`, `TURSO_AUTH_TOKEN`), rodando `ALTER TABLE ... ADD COLUMN ...` manual. Confirmar com `PRAGMA table_info(tabela)` antes/depois. Script fica na raiz do projeto (resolve `@libsql/client` do `node_modules` local), roda uma vez, e é apagado — nunca commitado. Ver decisão completa em `decisions.md` (2026-07-06).
**Contexto:** Qualquer sessão que altere `prisma/schema.prisma` neste projeto. Vault deve ser acionado antes do `ALTER TABLE` em produção, independente do mecanismo.

---

## "Application error: Rendered more hooks than during the previous render" ao acessar /PainelAlpha/Parceiros direto
**Sintoma:** Acessar `http://localhost:3000/PainelAlpha/Parceiros` diretamente como navegação de topo (URL colada na barra, refresh direto) no dev server quebra com "Application error" — overlay do Next mostra "Runtime Error: Rendered more hooks than during the previous render", stack trace aponta para dentro do próprio `Router` do Next.js (`app-router.tsx`), não para código da aplicação.
**Causa:** Não identificada (bug de hidratação do App Router do Next.js 16 em dev mode, aparentemente específico dessa rota quando acessada fora do fluxo normal via iframe do painel — o sistema renderiza módulos como `/PainelAlpha/[Modulo]` dentro de um `<iframe>` a partir de `/PainelAlpha`, e a navegação direta parece expor um caminho de render diferente). Confirmado via `git stash` que o erro é PRÉ-EXISTENTE — já ocorria antes de qualquer mudança da sessão de 2026-07-06 (convite de parceiro, onboarding). NÃO afeta produção: `npm run build` compila limpo, o erro só aparece em dev.
**Fix:** Nenhum aplicado ainda — fora do escopo das sessões que o encontraram. Para testar mudanças em `/PainelAlpha/Parceiros` em dev, prefira navegar via o fluxo real do painel (clicar no módulo a partir de `/PainelAlpha`) em vez de colar a URL direto/dar F5 nela. Se o erro persistir mesmo via navegação normal, investigar `GlobalSidebar.tsx` (apareceu em alguns stack traces relacionados) e o mecanismo de iframe em `PainelLayoutClient.tsx`.
**Contexto:** Só reproduzido em dev server (Turbopack). Build de produção não afetado.
**Adicionado em:** 2026-07-06
**Adicionado em:** 2026-07-06

---

## Agente Onyx (qwen3) retorna 502 "não retornou dados" — reasoning aborta sem gerar resposta em prompt grande
**Sintoma:** `POST /api/onyx/extrato` (ou qualquer rota usando `sendChatMessageStream`) retorna 502. Log mostra o stream recebendo só `reasoning_start` → `reasoning_delta` (às vezes com 1 palavra tipo "Here") → `reasoning_done`, e nunca um `message_start`/`message_delta` — resultado fica com 0 chars. Acontece de forma **consistente/determinística** com o mesmo arquivo grande (não é flakiness — retry simples nas mesmas condições falha sempre).
**Causa:** O modelo **qwen3** (modelo padrão configurado no agente no Onyx) não processa de forma confiável prompts de entrada muito grandes (~37k chars de texto de extrato + instruções). Ele aborta o bloco de reasoning quase instantaneamente e o turno termina sem nunca emitir a resposta final. NÃO é limite de `max_tokens` de output (aumentar `maxTokens` sozinho não resolve — testado, erro idêntico). NÃO é intermitência (retry com o texto completo, sem reduzir tamanho, falhou 2/2 vezes de forma idêntica).
**Fix real:** dividir o texto extraído pelo Tika em **trechos menores** (`dividirEmChunks` em `src/lib/onyx/extrato-agents.ts`, ~6000 chars cada, preferindo cortar em quebras de página `\f` do PDF) e enviar cada trecho como uma chamada separada ao agente, agregando as transações de todos os trechos no final. Retry por trecho (até 2 tentativas) continua existindo como proteção adicional, mas o que resolveu de fato foi reduzir o tamanho do prompt de entrada. `maxDuration` da rota subiu de 120 para 300 (processar N trechos em sequência leva mais tempo).
**Contexto:** Qualquer agente Onyx usando modelo qwen3 via `sendChatMessageStream` com prompt de entrada grande (>~6-10k chars). Se um agente Onyx some sem responder e o texto de entrada for grande, suspeitar do tamanho do prompt ANTES de max_tokens ou de bug no parser do stream.
**Adicionado em:** 2026-07-02

### pdf-parse v2 na Vercel — "DOMMatrix is not defined" (500 no /api/onyx/extrato)
**Sintoma:** `POST /api/onyx/extrato` (ou qualquer rota que use `pdf-parse` via `PDFParse`/`getText()`) responde 500 em produção (Vercel), mas funciona normalmente em dev local. Log do Vercel mostra: `Failed to load external module pdf-parse-...: ReferenceError: DOMMatrix is not defined`, precedido por `Warning: Cannot load "@napi-rs/canvas" package` e `Warning: Cannot polyfill DOMMatrix, rendering may be broken`.
**Causa:** `pdf-parse@2.4.5` traz sua PRÓPRIA cópia de `pdfjs-dist@5.4.296` (isolada da versão `4.10.38` usada pelo resto do projeto — `resolutions` no `package.json` não tem efeito porque o projeto usa npm, não Yarn, e npm ignora esse campo). Essa versão interna do pdfjs carrega eager (no import, não sob demanda) o build legacy que tenta usar `@napi-rs/canvas` para operações de renderização (`getImage`/`getScreenshot`) — mesmo quando só se usa `getText()`. `@napi-rs/canvas` é um pacote-fachada cujo binário nativo real vem de `optionalDependencies` por plataforma (`@napi-rs/canvas-win32-x64-msvc`, `@napi-rs/canvas-linux-x64-gnu` etc.). No ambiente serverless da Vercel (Linux) esse binário não fica disponível no bundle do Lambda, o carregamento falha, e o pdfjs cai no polyfill de `DOMMatrix` — que não existe em Node puro, lançando o erro fatal.
**Fix:** Polyfill mínimo de `DOMMatrix` no escopo global do servidor, importado ANTES de qualquer `import("pdf-parse")` — `src/lib/bibble/pdfjs-polyfill.ts` (classe stub com os métodos usados pelo pdfjs: `multiply`, `translate`, `scale`, `inverse`). Como o projeto só usa `getText()` (nunca renderização), o polyfill nunca é de fato exercitado — só evita o `ReferenceError` no carregamento do módulo. Importado no topo de `src/lib/onyx/extrato-agents.ts` e `src/lib/bibble/tika.ts` (os dois pontos que fazem `import("pdf-parse")`).
**Contexto:** Qualquer uso futuro de `pdf-parse` no projeto DEVE importar `@/lib/bibble/pdfjs-polyfill` antes do `import("pdf-parse")` dinâmico, senão reintroduz o 500 em produção (não reproduz em dev local — só no runtime Linux da Vercel).
**Adicionado em:** 2026-07-08

### pdf-parse v2 na Vercel — parte 2: "Setting up fake worker failed: Cannot find module pdf.worker.mjs"
**Sintoma:** Depois de corrigir o erro de `DOMMatrix` acima, `/api/onyx/extrato` continuou 500. Log do Vercel mudou para: `[POST /api/onyx/extrato] Setting up fake worker failed: "Cannot find module '/var/task/node_modules/pdf-parse/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs' imported from .../pdf.mjs"`.
**Causa:** Mesmo em Node.js (sem Web Worker real), o pdfjs-dist usa um "fake worker" que roda na main thread — mas mesmo esse modo faz `import(this.workerSrc)` DINÂMICO (specifier é uma string variável, resolvida em runtime) para carregar `WorkerMessageHandler`. O file tracing do Next.js (`outputFileTracingIncludes`/detecção automática) não consegue seguir imports dinâmicos com string variável, então `pdf.worker.mjs` nunca era incluído no bundle enviado pro Lambda da Vercel — o arquivo existe em `node_modules` local mas não chega em produção.
**Fix (duas camadas, redundantes de propósito):** (1) `next.config.ts` ganhou `outputFileTracingIncludes: { "/**": ["./node_modules/pdf-parse/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", ".../pdf.worker.min.mjs"] }` — força esses arquivos a entrar no bundle de toda rota server-side, independente de tracing automático. (2) `src/lib/bibble/pdfjs-polyfill.ts` ganhou `pdfjsWorkerReady` — resolve o caminho absoluto do `pdf.worker.mjs` real (via `require.resolve("pdfjs-dist/legacy/build/pdf.mjs", { paths: [...] })` a partir de dentro de `node_modules/pdf-parse`, pois o pdfjs-dist aninhado ali é uma versão DIFERENTE do da raiz do projeto — nunca misturar as duas), importa via `pathToFileURL` (contorna o `exports` map do `package.json` do pdf-parse, que bloqueia acessar subpaths do pdfjs-dist aninhado por specifier de string) e registra em `globalThis.pdfjsWorker` — quando esse global existe, o pdfjs PULA o `import()` dinâmico problemático por completo. Os dois pontos de uso (`extrato-agents.ts`, `tika.ts`) agora fazem `await pdfjsWorkerReady;` antes de `import("pdf-parse")`.
**Verificação:** Após o build, `.next/server/app/api/onyx/extrato/route.js.nft.json` (arquivo de trace do Next) deve listar `node_modules/pdf-parse/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs` — se sumir dessa lista em alguma mudança futura de dependências, o erro volta.
**Contexto:** Continuação direta da entrada anterior (`DOMMatrix is not defined`) — mesma causa raiz de fundo (pdf-parse v2 + pdfjs-dist legacy build assumindo ambiente que a Vercel serverless não fornece). Se o pdf-parse for atualizado de versão major no futuro, revalidar se esse problema ainda existe antes de reaplicar o fix.
**Adicionado em:** 2026-07-08

### Chunking por trecho gera transações duplicadas/truncadas (extrato bancário)
**Sintoma:** Extrato de 18 páginas retornou 458 transações (muito acima do esperado — extratos normais têm dezenas). Algumas descrições vieram cortadas no meio da palavra (ex: `"DISTRESSED FUNDO DE 1"`, `"TEKA TECELAGEM KUEHNR"`).
**Causa:** Ao dividir o texto do Tika em chunks (`dividirEmChunks`) sem overlap controlado, uma linha de movimentação que cai exatamente na fronteira de dois chunks pode aparecer inteira (ou truncada) nos dois trechos adjacentes — o agente processa cada trecho isoladamente e não sabe que já viu aquela linha. Chunk grande demais também aumenta a chance do modelo "perder o fio" da linha e cortar/abreviar a descrição.
**Fix:** (1) Deduplicação por chave `data|descricao|valor` após agregar os resultados de todos os trechos (`processarExtratoPorAgentes` em `src/lib/onyx/extrato-agents.ts`) — uma transação idêntica não se repete de verdade num extrato real. (2) Reduzido `TAMANHO_MAX_CHUNK` de 6000 para 3500 chars. (3) Prompt reforçado: "descricao deve ser a linha COMPLETA... nunca corte no meio de uma palavra" e "cada movimentação aparece SOMENTE UMA VEZ".
**Contexto:** Qualquer pipeline que divide texto grande em chunks processados independentemente por um LLM e depois agrega os resultados — duplicação na fronteira dos chunks é um risco estrutural, não um bug pontual.
**Adicionado em:** 2026-07-02

### Extrato de páginas recortadas/exportadas retorna 0 transações silenciosamente
**Sintoma:** Upload de um PDF "recortado" (ex: só as 3 primeiras páginas de um extrato maior, exportado por alguma ferramenta de split de PDF) processa sem erro mas retorna 0 transações. Log mostra `[PDF-PARSE fallback] ... 44 chars extraídos` e o texto bruto é só `-- 1 of 3 --  -- 2 of 3 --  -- 3 of 3 --` (marcadores de página do pdf-parse, sem nenhum conteúdo real).
**Causa:** Algumas ferramentas de recorte/split de PDF rasterizam as páginas (convertem em imagem) em vez de preservar a camada de texto original. Nem o Tika nem o fallback pdf-parse conseguem extrair texto de um PDF assim — não é bug do pipeline, é o arquivo de entrada que não tem texto extraível. O agente Organizador respondeu corretamente `[]` porque de fato não recebeu nenhuma movimentação.
**Fix:** `processarExtratoPorAgentes` (`src/lib/onyx/extrato-agents.ts`) agora valida o texto extraído removendo os marcadores `-- N of M --` do pdf-parse antes de checar o tamanho — se sobrar menos de 20 chars reais, lança erro 422 claro ("PDF pode ser scan sem OCR ou ter perdido a camada de texto") em vez de silenciosamente processar um texto vazio e devolver 0 transações.
**Contexto:** Sempre testar o pipeline de extração com o PDF ORIGINAL (não um recorte feito por ferramenta externa) — recortes podem introduzir esse problema que não existe no arquivo fonte.
**Adicionado em:** 2026-07-02

### API PDF24 (Cross Service Solutions) — path real do endpoint difere da documentação do widget
**Sintoma:** `POST {PDF24_OCR_API_URL}/api/` retorna `404 {"message":"Cannot POST /solutions/api/"}`. A documentação do widget mostra "POST /api/ 67" com um número solto ao lado, sem indicar claramente que faz parte do path.
**Causa:** O "67" na documentação é o **id da solução/produto** ("PDF OCR") dentro da plataforma multi-produto Cross Service Solutions — o endpoint real de criação de job é `POST /api/{solutionId}`, ou seja `POST /api/67`, não `POST /api/`. Confirmado testando incrementalmente contra a API real (curl) até achar o path que retornava 201 em vez de 404.
**Fix:** `src/lib/bibble/pdf24-ocr.ts` usa `PDF24_SOLUTION_ID = "67"` e monta a URL como `${PDF24_URL}/api/${PDF24_SOLUTION_ID}` tanto para criar o job (POST) quanto consultar (GET .../{jobId} continua sendo só o id numérico do job, não da solução).
**Contexto:** Documentação de "widgets" white-label (PDF24 by Cross Service Solutions, e provavelmente outras integrações da mesma plataforma) pode omitir que um número aparentemente solto no exemplo de rota é na verdade parte obrigatória do path. Quando a doc de uma API externa parecer incompleta/ambígua, validar incrementalmente com curl antes de assumir o path.
**Adicionado em:** 2026-07-02

### API PDF24 — critério de "job concluído" e tempo de processamento real
**Sintoma:** Achava-se que `output: null` no job significava "ainda processando" e `output` preenchido significava concluído. Na prática, `output` já vem preenchido com `{result: "<p>please download your PDF</p>", files: []}` desde o status `pending`/`in_progress` — só quando `status` vira `"done"` é que `output.files[]` recebe o arquivo de verdade.
**Causa:** A API retorna um placeholder de "output" genérico durante todo o processamento, não `null`. O sinal confiável de conclusão é `output.files.length > 0` (ou `status === "done"`), não a mera presença do campo `output`.
**Fix:** `aguardarJobOcr` em `pdf24-ocr.ts` verifica `output?.files && files.length > 0` como sinal de sucesso, e trata `status` em `{error, failed, failure, cancelled, canceled}` como falha explícita (aborta o polling cedo em vez de esperar o timeout inteiro).
**Tempo real observado:** Um PDF de 3 páginas de scan levou **mais de 8 minutos** para o job concluir (`status: "done"`) nesse serviço. `PDF24_POLL_TIMEOUT_MS` foi ajustado de 120_000 para 480_000 (8 min), e `maxDuration` da rota `/api/onyx/extrato` subiu de 300 para 800 para acomodar. Esse tempo pode variar (fila do serviço, tamanho do arquivo) — não é um SLA garantido, é só o que foi observado num teste real.
**Contexto:** Qualquer uso de `ocrViaPdf24`. Se o guard de texto insuficiente em `extrato-agents.ts` disparar 422 mesmo com PDF24 configurado, o job pode ter estourado o timeout de polling — checar logs `[PDF24-OCR]` para confirmar.
**Adicionado em:** 2026-07-02

---

## Canvas Three.js dentro de container `absolute` fica com width:0 (dentro de iframe do painel)
**Sintoma:** Background/canvas WebGL renderizado dentro de um container `position: absolute` (comum para backgrounds decorativos atrás de conteúdo) fica com `canvas.style.width: 0px` permanentemente — nada aparece, mesmo o container pai tendo largura correta. Mais provável de reproduzir quando o componente é montado dentro do iframe de módulo do painel (`PainelLayoutClient.tsx`).
**Causa:** `renderer.setSize(container.clientWidth, ...)` roda de forma síncrona no `useEffect`, no instante exato do mount — nesse momento o container `absolute` pode ainda reportar `clientWidth: 0` porque o browser não terminou de computar o layout do elemento pai. O `ResizeObserver` deveria corrigir isso no callback inicial (a spec garante 1 disparo ao chamar `.observe()`), mas se o container "já nasce" com o tamanho final do ponto de vista do CSS (não há uma mudança de tamanho real depois do mount), esse callback de garantia pode não chegar a tempo/não disparar de novo no ambiente do iframe — o canvas fica preso no `width:0` do primeiro frame.
**Fix:** Além do `ResizeObserver`, adicionar uma segunda leitura forçada via `requestAnimationFrame` logo após `resizeObserver.observe(container)`, chamando a mesma função de ajuste de tamanho (que já tem guard `container.clientWidth === 0 → return` para não aplicar um tamanho inválido). Implementado em `src/components/ui/animated-shader-background.tsx`. Lembrar de limpar o `requestAnimationFrame` no cleanup do efeito (`cancelAnimationFrame`).
**Contexto:** Qualquer componente Three.js/canvas com container `position: absolute` (background decorativo) neste projeto — especialmente se for renderizado dentro do iframe de módulo do PainelAlpha. Confirmado via `preview_eval` inspecionando `canvas.style` diretamente (não visível em screenshot, que trava com canvas WebGL animado em ambiente headless — usar `preview_eval` para inspecionar propriedades do canvas em vez de depender só de screenshot nesses casos).
**Adicionado em:** 2026-07-09

**Nota adicional (Onda 4 — Apresentation Studio, componentes 3D via React Three Fiber):** `@react-three/fiber`'s `<Canvas>` já resolve o problema de RESIZE internamente (usa `ResizeObserver` por baixo dos panos) — não é necessário replicar manualmente o fix de `requestAnimationFrame` acima para os componentes `globo`/`particulas`/`objeto3d`. PORÉM, R3F **não resolve** o problema de VISIBILIDADE dentro do iframe do painel: `document.visibilityState` continua não refletindo a visibilidade real do módulo quando ele está "escondido" dentro do iframe de `PainelLayoutClient.tsx` (mesma limitação do `animated-shader-background.tsx`). Sem tratar isso, o `frameloop` do R3F continua rodando (consumindo GPU/CPU) mesmo com o módulo fora de tela. Fix implementado: hook compartilhado `src/components/Apresentacoes/Editor/RenderEngine/useVisibilidadeIframe.ts` baseado em `IntersectionObserver`, usado nos 3 componentes de renderização 3D (`GloboRender.tsx`/`ParticulasRender.tsx`/`ObjetoGlbRender.tsx`) para alternar a prop `frameloop` do `<Canvas>` entre `"always"` e `"never"` conforme a visibilidade real do componente.
**Adicionado em:** 2026-07-10

**Nota adicional 2 (Onda 4, Lens):** cada componente 3D monta seu PRÓPRIO `<Canvas>` do R3F independente (R3F não compartilha contexto WebGL entre múltiplos `<Canvas>` facilmente). Navegadores têm limite prático de contexts WebGL simultâneos (tipicamente ~8-16, varia por browser/GPU) — um slide com muitos componentes 3D pode degradar performance ou falhar silenciosamente (o browser recicla o context mais antigo quando o limite é atingido, "perdendo" a renderização dele sem erro visível). Não é bloqueante para uso típico (poucos componentes 3D por slide), mas vale ter em mente se um usuário reportar um componente 3D "sumindo" quando há muitos outros no mesmo slide — não é bug de código, é limite de recurso do browser. Sem hard-limit de UI implementado ainda; considerar no futuro se virar problema real reportado.
**Adicionado em:** 2026-07-10 (Lens)

## CS&NPS — seção "Serviços Contratados" (dados do Painel de Metas) escondida quando cliente tem só 1 serviço
**Sintoma:** Usuário testa um cliente que TEM contrato real correspondente no Painel de Metas (CNPJ confirmado batendo em ambas as tabelas) mas a seção "Serviços Contratados" (Forma de Pagamento/Valor do Contrato/Closer) não aparece no modal de detalhe do CS&NPS.
**Causa:** A seção estava condicionada a `Array.isArray(clienteGrupo) && clienteGrupo.length > 1` — só renderizava quando o CNPJ tinha MÚLTIPLOS registros/serviços mesclados. Como a feature de múltiplos serviços por CNPJ (2026-07-13) é nova, praticamente todo cliente hoje tem exatamente 1 registro — a condição escondia a seção (e os dados do Metas) para quase 100% dos casos reais, incluindo clientes com contrato correspondente de verdade.
**Fix:** Trocar a condição para renderizar sempre que houver um `cliente` válido (todo cliente tem no mínimo 1 serviço) — normalizar `clienteGrupo` para array sempre via `registrosDoServicosSecao = cliente ? [cliente, ...outrosServicos] : []`, em vez de checar `length > 1`. O título "Serviços Contratados (N)" mostra "(1)" normalmente quando só há 1 serviço — isso é esperado e correto.
**Contexto:** `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx`. Lição geral: ao decidir esconder uma seção nova "só quando há múltiplos itens" para evitar ruído visual, checar se essa condição também esconde dados que deveriam aparecer no caso comum (1 item) — nem toda feature de "mesclagem" deve ficar invisível no caso trivial de 1 elemento só.
**Adicionado em:** 2026-07-13

## Modelo de IA "não lê" imagem anexada no chat
**Sintoma:** usuário anexa imagem, modelo responde como se não houvesse imagem (ou descreve genérico). Logs mostram a imagem indo como texto tipo "[imagem disponível em: url]".
**Causa:** a imagem estava sendo passada como TEXTO (link/descrição) no content da mensagem. Modelos de visão precisam receber a imagem como conteúdo multimodal real.
**Fix:** (Bibble/OpenAI-compat) o `content` do user vira array `[{type:"text",text},{type:"image_url",image_url:{url:"data:image/...;base64,..."}}]`. (Onyx) upload via POST /api/chat/file → passar `file_descriptors` no send-chat-message. Sempre checar se o modelo TEM visão antes (`modelSupportsVision`) — Mistral/DeepSeek/Phi/Llama-básico/Qwen não têm; avisar o usuário pra trocar.
**Adicionado em:** 2026-06-23
