# JOURNAL — Histórico Cronológico de Sessões

> Mantido por: Kowalski (cronista)
> Registrar ao FINAL de toda sessão com trabalho real.

---

## Template de entrada

```
## [Data] — [Título resumido da sessão]

### O que foi feito
- [lista de mudanças reais]

### Decisões tomadas
- [decisões importantes e motivos]

### Arquivos criados/modificados
- `[caminho]` — [o que mudou]

### Erros encontrados e fixes
- [erro]: [fix aplicado]

### Pendências para próxima sessão
- [o que ficou para fazer]
```

---

## Sessões

<!-- Kowalski adiciona aqui ao final de cada sessão -->

## 2026-06-11 — Responsividade, Tema e Ajustes Visuais do Chat

### O que foi feito
- Removido botão de colapsar sidebar (`ChevronLeft`/`ChevronRight`) da GlobalSidebar — era inútil e sem função
- Rodapé da empresa no BibbleChatWindow: oculto em mobile (`hidden sm:flex`), tamanho reduzido (280→200px), opacidade menor (60→40%)
- BibbleChatInput: padding mobile reduzido (`px-3 pb-3 pt-2 sm:px-4 sm:pb-4`), textarea `min-h` reduzida em mobile (`min-h-[36px] sm:min-h-[40px]`)
- BibbleChatLayout: sidebar agora abre como overlay/drawer no mobile (Framer Motion, `fixed right-0`, backdrop com `bg-black/60`); desktop mantém comportamento inline. Estado inicial `sidebarOpen` mudou de `true` para `false`
- Sistema de temas integrado: `page.tsx` busca `tema_interface` do usuário no DB (`db.usuarios`), passa como `temaName` para `BibbleChatLayout` → `getTema()` → `tema` (TemaAlpha) propagado para `BibbleChatWindow`, `BibbleChatInput` e `BibbleEmptyState`. Cores do input (bordas, glow, status pill, botão de envio) respondem ao tema do usuário via `tema.accent`

### Decisões tomadas
- `onToggleCollapse` mantido como prop opcional na interface da GlobalSidebar (pai ainda pode passar, componente ignora)
- `sidebarOpen` inicial = `false` para evitar hydration mismatch (seguro para SSR)
- Mobile drawer usa `AnimatePresence` + `motion.div` do Framer Motion (já era dependência do projeto)
- `BibbleSidebarPanel` renderiza duas vezes no DOM quando aberto no mobile (uma no inline desktop — oculta — outra no overlay), porém é seguro pois o componente é prop-driven sem fetches próprios
- `db.usuarios` é o nome correto do modelo Prisma (não `db.user`)

### Arquivos criados/modificados
- `src/components/layout/GlobalSidebar.tsx` — botão removido, imports limpos, prop opcional
- `src/components/BibbleChatHome/BibbleChatWindow.tsx` — rodapé responsivo, prop `tema` adicionada
- `src/components/BibbleChatHome/BibbleChatInput.tsx` — padding mobile, min-h mobile, tema aplicado
- `src/components/BibbleChatHome/BibbleEmptyState.tsx` — prop `tema` adicionada e propagada ao input
- `src/components/BibbleChatHome/BibbleChatLayout.tsx` — overlay mobile, estado inicial, `temaName` prop, `getTema()`
- `src/app/PainelAlpha/page.tsx` — query `db.usuarios` para `tema_interface`, `temaName` passado ao layout

### Erros encontrados e fixes
- `db.user.findUnique` → erro TS: modelo chama `db.usuarios` no Prisma schema

### Pendências para próxima sessão
- BibbleSidebarPanel não usa o tema ainda (botão "Nova conversa" e sessão ativa ainda hardcoded indigo)
- Testar visualmente em viewport 375px e 768px no browser

---

## 2026-06-11 — Fix: Notificações de Chamados (som tocava mas visual não aparecia)

### O que foi feito
- Diagnóstico completo do sistema de notificações: Pusher hook (`useAdminChamadosNotifications`), store Zustand (`useChamadoNotificacoes`), componente toast (`NotificationToast`)
- Identificada e corrigida a causa raiz do bug: `NotificationToast` usava `notificacoes.length` como dep do `useEffect`, mas o store limita o array a 50 itens via `.slice(0, 50)`. Quando o array já estava cheio, uma nova notificação trocava a mais antiga mas o `length` permanecia 50 — o efeito nunca disparava, o som tocava mas o toast não aparecia
- Secundariamente: `lastCount` era state (não ref), criando risco de stale closure
- Fix: substituído `lastCount` state por `lastShownIdRef = useRef<string | null>(null)`, dep mudada de `[notificacoes.length]` para `[notificacoes]`, lógica simplificada para comparar o ID da notificação mais recente com o último mostrado

### Decisões tomadas
- Subscrever ao array `notificacoes` completo (não apenas `.length`) para capturar qualquer mutação, incluindo quando está no limite de 50 itens
- Usar `useRef` em vez de `useState` para `lastShownIdRef` — sem re-renders desnecessários, sem stale closure, sempre tem o valor atual

### Arquivos criados/modificados
- `src/components/chamados/NotificationToast.tsx` — lógica do useEffect reescrita, `lastCount` state removido, `lastShownIdRef` adicionado, deps corrigidas

### Erros encontrados e fixes
- Bug root cause: `.slice(0, 50)` no store mantém length constante quando cheio → dependência em `length` não detecta nova notificação quando array está no limite → fix: dep no array inteiro + comparação por ID

### Pendências para próxima sessão
- BibbleSidebarPanel não usa o tema ainda (botão "Nova conversa" e sessão ativa ainda hardcoded indigo)

---

## 2026-06-18 — Campo `tipo` nos Templates de Onboarding + Integração Template Parceiro

**Tags:** #feature #integration #prisma #nextjs
**Agentes envolvidos:** Scout → Vault → Echo → Nova → Forge → Probe → Lens → Scribe

### O que foi feito
- Aplicado campo `tipo String @default("USUARIO")` ao banco SQLite via `npx prisma db push` (campo já existia no schema mas não estava sincronizado com o banco)
- `criarTemplateOnboarding` e `atualizarTemplateOnboarding` em `src/actions/onboarding.ts` passaram a aceitar e salvar o campo `tipo`
- Nova action `getTemplateParadaoParceiro()` — busca template ativo do tipo `"PARCEIRO"` ordenado por `padrao desc, createdAt desc`
- `GestaoOnboardingClient.tsx` atualizado: `FormState` com `tipo`, Select "Tipo de Template" no formulário, `useEffect` para trocar mensagem default conforme tipo selecionado, badges visuais por tipo nos cards da listagem
- `src/app/PainelAlpha/Parceiros/novo/page.tsx` — substituída query inline `setor: "parceiros"` por `getTemplateParadaoParceiro()`; busca agora é por `tipo: "PARCEIRO"` via action dedicada
- Pipeline completo: Forge ✅ (70/70 páginas), Probe ✅ (10/10 itens), Lens ⚠️ aprovado com 2 ressalvas não-bloqueantes

### Decisões tomadas
- **SQLite sem enum nativo** → `String @default("USUARIO")` + validação Zod pendente (não bloqueante)
- **`getTemplateParadaoParceiro` sem `auth()`** — intencional: action read-only, chamada exclusivamente de Server Component que já verificou sessão via `auth()`. Lens recomendou adicionar por consistência, mas não bloqueante dado que dado retornado não é sensível
- **`db push` em vez de `migrate dev`** — dev local, campo com DEFAULT, SQLite: seguro e direto
- **`useEffect` para swap de mensagem** — permitido em `"use client"` pois não é fetch; muda estado derivado de outro estado. Lens sugeriu alternativa via `onValueChange` (opcional, não implementada)

### Arquivos criados/modificados
- `prisma/schema.prisma` — campo `tipo` aplicado ao banco (já existia no schema)
- `src/actions/onboarding.ts` — `criarTemplateOnboarding` e `atualizarTemplateOnboarding` com `tipo`; nova `getTemplateParadaoParceiro()`
- `src/components/GestaoOnboarding/GestaoOnboardingClient.tsx` — `FormState` com `tipo`, Select, `useEffect`, badges
- `src/app/PainelAlpha/Parceiros/novo/page.tsx` — usa `getTemplateParadaoParceiro()` em paralelo com query de tema

### Erros encontrados e fixes
- `prisma generate` EPERM (rename query_engine-windows.dll.node) — DLL bloqueada pelo dev server. Não crítico; `prisma db push` concluiu com sucesso e build não foi afetado
- Erros TypeScript pré-existentes (`.next/types/validator.ts:657`, `HabilitacaoRadar/page.tsx:494`) — não introduzidos nesta sessão, já existiam antes

### Pendências para próxima sessão
- Adicionar `const session = await auth(); if (!session) return null;` em `getTemplateParadaoParceiro` (consistência de padrão)
- Adicionar `z.enum(["USUARIO","PARCEIRO","CLIENTE"])` na validação de `tipo` em `criarTemplateOnboarding` e `atualizarTemplateOnboarding`
- Tipo `CLIENTE` existe no banco e na UI mas sem lógica de busca/exibição implementada (reservado para futuro)

---

## [2026-06-19] — Integração Tika para leitura de PDF no Bibble e Onyx

**Tags:** #feature #bugfix #integration #nextjs #critical
**Agentes envolvidos:** Scout → Echo → Forge
**Arquivos tocados:**
- `src/lib/bibble/tika.ts` *(CRIADO)*
- `src/app/api/bibble/chat/route.ts`
- `src/app/api/bibble/upload-to-blob/route.ts`
- `src/app/api/onyx/chat/route.ts`
- `src/components/BibbleChatHome/BibbleChatLayout.tsx`
- `.env.local`

### Contexto
Bibble e agentes Onyx não conseguiam ler PDFs. O Tika (Apache Tika 3.3.1) já estava instalado no servidor Onyx (`http://192.168.35.113:9998`) mas não estava integrado ao PainelAlpha.

### O que foi feito
- **Diagnóstico**: `pdf-parse` atualizado para v2 quebrou a API — `(await import("pdf-parse")).default` retornava `undefined` (v2 exporta `{ PDFParse }` classe, não função). Código anterior causava `TypeError: pdfParse is not a function` silenciado no `catch`.
- **Criado `src/lib/bibble/tika.ts`**: helper centralizado com `extractTextFromBuffer` e `extractTextFromUrl`. Usa Tika como primário via `PUT /tika` com `Accept: text/plain`. Fallback automático para `pdf-parse v2` (`new PDFParse({ data: buffer }).getText()`) se Tika estiver fora do ar. Suporta PDF, DOCX, XLSX, PPTX, ODT, RTF, HTML, XML.
- **`upload-to-blob/route.ts`**: substituiu lógica de extração inline por `extractTextFromBuffer` do Tika. Ampliou tipos permitidos (PPTX agora aceito).
- **`bibble/chat/route.ts`**: função `extractFilesContent` reescrita — usa `extractTextFromUrl` do Tika para documentos; texto puro segue fetch direto; imagens/vídeos seguem caminho próprio. Removida dependência direta de `pdf-parse`.
- **`onyx/chat/route.ts`**: adicionado suporte completo a arquivos — interface `AttachedFile` com `url`, nova função `buildFileContext` que extrai texto via Tika/fallback e injeta no corpo da mensagem antes de enviar ao Onyx. `finalMessage` substitui `message` na chamada `sendChatMessageStream`.
- **`BibbleChatLayout.tsx`**: `handleSend` passa `filesForChat` também quando agente Onyx está ativo (antes só enviava para Bibble/Ollama).
- **`.env.local`**: adicionado `TIKA_SERVER_URL=http://192.168.35.113:9998`.

### Decisões tomadas
- **Tika como primário, pdf-parse como fallback**: Tika suporta muito mais formatos e já está no servidor; pdf-parse v2 é fallback só para PDFs quando Tika cair.
- **Body do fetch como `ArrayBuffer`** (não `Buffer` nem `Uint8Array`): TS target ES2017 + lib `dom` não reconhece `Buffer`/`Uint8Array` como `BodyInit`. Fix: `buffer.buffer.slice(byteOffset, byteOffset + byteLength) as ArrayBuffer`.
- **Onyx recebe texto extraído no corpo da mensagem**: Onyx não tem API de "documentos" como a Claude API — o texto vai concatenado na mensagem via `buildFileContext`, formato markdown com delimitadores.
- **`TIKA_SERVER_URL`** como env var: mesmo IP que o `ONYX_API_URL` (`192.168.35.113`), mas porta `9998` separada.

### Problemas encontrados / resolvidos
- **pdf-parse v2 API quebrada**: v1 exportava função; v2 exporta classe `PDFParse`. Fix: `new PDFParse({ data: buffer, verbosity: 0 }).getText()` + `parser.destroy()`.
- **TS2769 no tika.ts**: `Buffer` e `Uint8Array` rejeitados como `BodyInit` no tsconfig atual (target ES2017). Fix: cast para `ArrayBuffer` via `buffer.buffer.slice(...)`.
- **`prisma generate` EPERM**: DLL bloqueada pelo dev server (pré-existente, não desta sessão).

### Pendências
- Testar com PDF real enviado via UI para confirmar extração correta end-to-end.
- Considerar cache de extração: PDFs grandes enviados múltiplas vezes reprocessam do zero.

---

## [2026-06-19] — Tika e Onyx via Cloudflare (produção na Vercel)

**Tags:** #integration #decision #infra
**Agentes envolvidos:** Bibble
**Arquivos tocados:**
- `.env.local`
- `src/lib/bibble/tika.ts` *(comentário do topo atualizado)*

### Contexto
O Next.js do PainelAlpha roda na Vercel (nuvem externa), fora da rede `192.168.35.x`. Logo, IPs privados (`192.168.35.113:9998` Tika, `:3000` Onyx) são inalcançáveis de produção.

### O que foi feito
- Confirmado que o usuário expôs Tika e Onyx via Cloudflare Tunnel: `TIKA_SERVER_URL=https://tika.alpha-comex.com/` e `ONYX_API_URL=https://onyx.alpha-comex.com/`.
- Diagnóstico dos túneis: **Onyx responde 200** ✅; **Tika falha handshake SSL** (HTTP 000) — túnel do Tika ainda não funcional (falta entrada no config.yml do cloudflared ou cert SSL não propagado).

### Decisões tomadas
- **Cloudflare Tunnel é o caminho correto** (mesmo padrão de `studio-api.alpha-comex.com`): código não muda, só a env var. `tika.ts` normaliza barra final, então `https://tika.alpha-comex.com/` + `/tika` funciona.
- **Fallback pdf-parse cobre Tika fora do ar**: enquanto o túnel do Tika não sobe, PDFs continuam lidos via fallback; DOCX/XLSX/PPTX ficam indisponíveis até o túnel funcionar.

### Pendências
- Subir o túnel do Tika: adicionar `tika.alpha-comex.com → http://localhost:9998` no config.yml do cloudflared no servidor e reiniciar.

---

## [2026-06-19] — Fix: heartbeat P2025 (sessão órfã)

**Tags:** #bugfix #prisma
**Agentes envolvidos:** Bibble
**Arquivos tocados:**
- `src/app/api/heartbeat/route.ts`

### Contexto
O `/api/heartbeat` (chamado a cada 20s) lançava `PrismaClientKnownRequestError P2025` quando a sessão JWT tinha um email sem usuário correspondente no banco (usuário deletado/renomeado com sessão ativa).

### O que foi feito
- Trocado `db.usuarios.update()` (lança P2025) por `db.usuarios.updateMany()` (retorna `count: 0` sem lançar).
- Se `count === 0`, retorna 404 silencioso (sem `console.error`, sem 500).

### Decisões tomadas
- `updateMany` é o padrão correto para update idempotente onde "registro não existe" não é erro de servidor. O componente cliente `Heartbeat.tsx` já descarta a resposta — 404 não causa efeito colateral.

---

## [2026-06-19] — Fix da memória/contexto das IAs (Bibble e Onyx)

**Tags:** #bugfix #feature #critical
**Agentes envolvidos:** Bibble → Echo → Forge
**Arquivos tocados:**
- `src/components/BibbleChatHome/BibbleChatLayout.tsx`
- `src/components/BibbleChatHome/BibbleMessageBubble.tsx` *(tipo Message ganhou fullContent)*
- `src/app/api/bibble/chat/route.ts`
- `src/app/api/onyx/chat/route.ts`
- `src/components/BibbleChatHome/BibbleSettingsPanel.tsx`

### Contexto
As IAs perdiam o contexto logo após responder: enviava-se PDF → análise OK → pergunta de follow-up → IA pedia o PDF de novo. Também perdia o fio em conversas normais.

### O que foi feito
- **Bug 1 (principal): conteúdo do PDF não era persistido.** `saveMessages` salvava só `text` (digitado), não o conteúdo extraído. Agora salva `persistedContent` — mensagem + texto extraído dos arquivos. A bolha mostra label curto (`fullContent` vs `content` na interface Message); ao recarregar a sessão, `splitPersisted()` separa display do conteúdo completo.
- **Bug 2: Onyx ignorava histórico.** Adicionado `history` ao payload e `buildHistoryContext()` no route — injeta histórico só quando `onyxSessionId` é novo (zerou), evitando duplicar o que o Onyx já mantém.
- **Bug 3: histórico fixo em 10 msgs.** Substituído `slice(-10)` por janela com **orçamento de caracteres** proporcional ao `contextWindow` (`ctxTokens * 4 * 0.5`).
- **UI**: settings ganhou preset 256K (max 262144), título "Janela de Contexto · Bibble", texto de ajuda explicando que controla a memória de conversa e que é **só do Bibble** (Onyx gerencia próprio contexto).

### Decisões tomadas
- **Anexar conteúdo do PDF à mensagem persistida** (escolha do usuário) em vez de resumo separado: robusto, funciona igual nos dois sistemas, IA sempre reenxerga o doc.
- **Onyx NÃO tem janela de contexto configurável por agente pelo painel**: a API do Onyx só expõe `num_chunks` (RAG) e override de modelo. Janela real é fixada no servidor Onyx. Não criado controle falso no painel.

### Pendências
- Testar follow-up com PDF real no chat para validar end-to-end.

---

## [2026-06-19] — Conhecimento unificado Bibble ⇄ Onyx

**Tags:** #feature #integration #architecture
**Agentes envolvidos:** Bibble → Scout → Echo → Forge
**Arquivos tocados:**
- `src/lib/shared/painelalpha-knowledge.ts` *(CRIADO)*
- `src/lib/bibble/system-prompt.ts`
- `src/lib/onyx/system-knowledge.ts`
- `src/lib/onyx/client.ts` *(askOnyxOneShot)*
- `src/lib/bibble/tools.ts` *(tool consultar_base_onyx)*
- `src/lib/bibble/tool-executor.ts` *(case consultar_base_onyx)*

### Contexto
Usuário queria conhecimento completo nas duas IAs: agentes Onyx falhavam ao perguntar sobre processos internos (abrir chamado, qualificar lead, etapas da pré-análise); e o Bibble não acessava o que está no Onyx. O prompt que o usuário trouxe pedia RAG/Knowledge Graph/Pinecone — descartado por over-engineering (Onyx já é RAG; dados são vivos no banco, não PDFs estáticos).

### O que foi feito
- **Criada base de conhecimento compartilhada** (`painelalpha-knowledge.ts`): vocabulário interno + processos operacionais (chamado, fluxo lead→tarefa, etapas pré-análise, RADAR, CS&NPS). Fonte ÚNICA de verdade.
- **Direção 1 (Onyx aprende PainelAlpha)**: `system-knowledge.ts` injeta a base nos agentes Onyx (antes só recebiam lista de módulos). Tools em tempo real já existiam via `AGENT_TOOLS` registry.
- **Direção 2 (Bibble acessa Onyx)**: `askOnyxOneShot()` no client (consulta one-shot à base do Onyx, coleta resposta do stream NDJSON) + tool `consultar_base_onyx` no Bibble.
- Base injetada também no system-prompt do Bibble (mesma fonte).

### Decisões tomadas
- **Base de conhecimento de PROCESSOS (texto) + tools em tempo real, NÃO RAG vetorizado**: dados são vivos no banco; vetor desatualizaria. Tool sempre lê estado atual.
- **Fonte única `painelalpha-knowledge.ts`** consumida por Bibble e Onyx: atualizar um processo propaga aos dois.
- **`consultar_base_onyx` é exclusiva do Bibble** (não está no AGENT_TOOLS do Onyx) — evita Onyx consultar a si mesmo / loop. Import dinâmico no executor evita dependência circular.

### Pendências
- **Usuário deve revisar/expandir `painelalpha-knowledge.ts`** — os processos foram inferidos do código; critérios reais (qualificação de lead, etapas obrigatórias do CheckList) precisam de validação humana.

---

## [2026-06-23 18:30] — Parceiros: comprovantes, multi-responsável, termo-histórico + IAlpha: Quem é você?/fixar agentes

**Tags:** #feature #bugfix #integration #prisma #nextjs
**Agentes envolvidos:** Bibble, Kowalski
**Arquivos tocados:** src/actions/parceiros.ts, src/components/Parceiros/{NovoParceiro,DetalheParceiroClient,ModalComprovante,ModalTermo}.tsx, src/app/api/ConsultaCpf/route.ts, src/components/BibbleChatHome/{OnyxAgentsModal,BibbleChatLayout,BibbleSidebarPanel}.tsx, src/lib/onyx/browser.ts, src/app/api/onyx/agentes-fixados/route.ts, prisma/schema.prisma

### Contexto
Várias melhorias no módulo Parceiros e no chat IAlpha (Onyx), além de correção crítica da consulta de CPF que estava quebrada.

### O que foi feito
- **Comprovante de comissão**: envio no PainelAlpha (botão por empresa indicada → ModalComprovante, upload Vercel Blob com token COMISSOES_READ_WRITE_TOKEN, qualquer tipo, substituir/remover) → visto no portal do parceiro (Google Docs Viewer). Colunas comprovante* em `indicacoes`.
- **Termo de adesão editável + histórico**: ModalTermo com abas (Nova versão / Histórico imutável, ver versões antigas só-leitura). Card do parceiro mostra "Assinou: {termoVersao}". Tabela `parceiro_termo`.
- **Telefone 1 e 2** no parceiro (cadastro + detalhe).
- **Multi-responsável físico**: ParceiroResponsavel virou 1:N (removido @unique). UI em GAVETA no NovoParceiro (vários, botão +, um aberto por vez).
- **Data Contratação** no detalhe (vem de clientes.dataContratacao do CS&NPS, formatada).
- **IAlpha**: botão "Quem é você?" separado de "Conversar" (vazio); pino para fixar agentes (máx 3, tabela onyx_agente_fixado); seção "Fixados" no modal + "Seus agentes fixados" na sidebar (clique = conversa nova se vazio, senão adiciona à conversa).

### Decisões tomadas
- Agentes fixados no BANCO (não localStorage): seguem o usuário entre dispositivos.
- Termo: histórico IMUTÁVEL — atualizar sempre cria nova versão e desativa anteriores; versão duplicada bloqueada.
- Comprovante: Blob público (URL direta) + Google Docs Viewer p/ renderizar Word/Excel/PDF inline.
- Multi-responsável usa a tabela ParceiroResponsavel existente (1:N), não a de representantes.

### Problemas encontrados / resolvidos
- **CPF consulta 404 + nunca funcionava**: 2 bugs combinados na InfoSimples — (1) campo é `birthdate`, não `data_nascimento` (dava code 606); (2) formato é AAAA-MM-DD (ISO), não DD/MM/AAAA (dava code 607). Testado: 2003-10-25=code 200 ✓. O "404" no browser era a rota retornando status 404 em erro de consulta → trocado p/ 422.
- **"Erro ao atualizar termo" sem log**: catch vazio engolia + Prisma Client stale (db.parceiroTermo undefined). Fix: prisma generate + restart + catch loga erro real.
- **Status do portal "front igualzinho"**: corStatus não mapeava "Deferido"/"Stand By" (status reais do CS&NPS) → caíam no cinza. Corrigido com status reais.
- **Tooltip atrás da gaveta**: era overflow-hidden do card cortando, não z-index. Removido overflow + z-50.
- **Regra de nível no aviso**: corrigido — indicar SOBE o nível (PLATINUM→BLACK 15%), não "mantém".

### Pendências
- Reiniciar dev servers (Prisma Client regenerado várias vezes: parceiro_termo, telefone2, multi-responsável, onyx_agente_fixado).
- Texto oficial do termo (hoje placeholder, editável via UI).
- DetalheParceiroPage.tsx órfão (import quebrado, não usado) polui tsc — não removido (não foi criado por nós).

### Refletido também em
- Memória de sessão (Claude): project_parceiros.md, project_integracao_onyx.md, project_alphaparceiros_portal.md atualizados.
- Banco Turso (já aplicado): +5 colunas comprovante* em indicacoes, parceiro_termo, parceiro_responsavel índice unique→normal, parceiros +telefone/telefone2, onyx_agente_fixado.

---

## [2026-06-23 19:10] — Metas: Habilitação RADAR 50K contabilizava venda indevidamente

**Tags:** #bugfix #critical #prisma
**Arquivos tocados:** src/actions/ContratoComercial.ts

### Contexto
No módulo de Metas, Habilitação RADAR 50K estava contando como venda. Regra: só Revisão RADAR 150K e ILIMITADO contam.

### O que foi feito
- `confirmarFechamento` setava `contaComVenda: true` HARDCODED. Agora usa helper `servicoContaComoVenda(servico)` — lista de inclusão estrita: só "Revisão RADAR" + (150K ou ILIMITADO).
- Corrigidos dados no Turso (1 ILIMITADO estava conta=0 inconsistente → 1). Estado final: 50K=0, 150K=1, ILIMITADO=1.

### Decisões tomadas
- Lista de inclusão ESTRITA: qualquer serviço que não seja Revisão RADAR 150K/ILIMITADO NÃO conta (inclui 50K, TTD, AFRMM futuros).
- Metas.ts:50 e tool-executor.ts:592 já filtravam `where: contaComVenda:true` corretamente — o bug era só na ESCRITA (fechamento).

### Problemas encontrados / resolvidos
- **Helper inicial bugado**: usei `.replace(/[^a-z0-9]/g,"")` para normalizar → removia acentos ("revisão"→"reviso") e o `includes("revisao")` nunca casava → retornava false p/ TUDO. Fix: `.normalize("NFD").replace(/diacríticos/,"")` ANTES de filtrar.
- **Quase corrompi dados**: primeiro UPDATE ia marcar 150K/ILIMITADO como 0 (helper bugado) — salvou que os IDs são cuid (string) e o UPDATE sem aspas falhou. Sempre testar helper isolado ANTES de UPDATE em massa.

### Refletido também em
- known-errors.md: bug do normalize de acentos.

---

## [2026-06-23 20:30] — Chat IAlpha: visão (modelo lê imagens) + preview visual de anexos (estilo GPT)

**Tags:** #feature #integration #claude-api
**Arquivos tocados:** src/app/api/bibble/chat/route.ts, src/app/api/onyx/chat/route.ts, src/lib/bibble/client.ts, src/lib/onyx/client.ts, src/components/BibbleChatHome/{BibbleChatLayout,BibbleMessageBubble}.tsx

### Contexto
Chat (Bibble e agentes Onyx) não lia imagens — imagem virava só texto-link pro modelo. Pedido: modelo enxergar a imagem + preview bonito na conversa (inline, lightbox sem nova aba, baixar), igual ao GPT.

### O que foi feito
- **Bibble (visão)**: `/api/bibble/chat` — imagem deixou de ser texto-link; agora `content` da msg do user vira ARRAY multimodal `[{type:text},{type:image_url:{url:data-base64}}]` (OpenAI-compat). `coletarImagensBase64` baixa do Blob público e converte. Helper `modelSupportsVision(modelId)` em client.ts; se modelo sem visão → injeta aviso "troque de modelo ou contate admin".
- **Onyx (visão)**: `uploadChatFiles()` (POST /api/chat/file → file_descriptors) + `fileDescriptors` no `sendChatMessageStream`. Rota faz upload das imagens pro Onyx e passa os descriptors → agente enxerga.
- **Preview visual** (`BibbleMessageBubble`): `Message.files` ganhou url/size. Componente `AnexoPreview` — imagens inline (grid, hover com ampliar/baixar) + lightbox modal full no próprio chat (ESC fecha, sem nova aba) + docs como chip clicável. Resposta do assistente: `ImagemRespostaMarkdown` (img do markdown) também com lightbox+baixar (antes abria em nova aba). `baixarArquivo()` força download via blob.
- handleSend passa `filesForBubble` (url do Blob) no userMsg; texto da bolha ficou limpo (sem prefixo "[Arquivos:...]").

### Decisões tomadas
- Base64 inline pra imagem (robusto, funciona com Blob privado/offline).
- Modelos com visão: GPT-4o/4.1, todos Claude, todos Gemini, e Ollama só gemma3/llava/llama3.2/vision/minicpm/-vl. Resto não tem visão.
- Onyx usa file_descriptors (mecanismo nativo dele), não base64.

### Pendências
- Testar o endpoint /api/chat/file do Onyx com a API real (assumido o formato padrão {files:[{id,type,name}]}).

### Refletido também em
- known-errors.md: imagem como texto-link não funciona (precisa content multimodal).
