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

## [2026-07-13] — CS&NPS: multi-serviço por CNPJ, usuários reais, e reconstrução do log de auditoria (com incidente de perda de dados)

**Tags:** #feature #bugfix #decision #prisma #critical #integration
**Agentes envolvidos:** Scout (2x) → Echo (2x) → Vault (2x, 🟢🟢) → Nova (2x) → correções diretas do Bibble
**Arquivos tocados:**
- `prisma/schema.prisma` — `clientes.cnpj @unique` → `@@unique([cnpj, servicos])`; novo model `HistoricoAlteracaoCliente`
- `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx` — reposicionamento de campo, cards absorvendo bloco de gestão, edição inline, loading state do botão salvar
- `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modal.tsx` — cadastro manual: UF separado do Regime, 3 campos novos, uso do `ModalSelecionarUsuario`
- `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalLogAuditoria.tsx` — reescrito por completo (agrupamento por lote, reversão por campo, `AlertDialog`)
- `src/components/ModalSelecionarUsuario.tsx` *(CRIADO)* — modal reutilizável de seleção de usuário real por role
- `src/components/DropdownSelecaoComCriacao.tsx` — extensão com prop `onAbrirModalOutro`
- `src/actions/clientes.ts` (ou equivalente) — `reverterCampoHistorico` (nova), `salvarAlteracoesGestao` e `restaurarVersaoCliente` removidas
- Painel de Metas: `ModalGerenciamentoLeads.tsx` — fix de Zod em Forma de Pagamento

### Contexto
Sessão longa no módulo CS&NPS: permitir CNPJ duplicado por serviço diferente, sincronizar dados do Metas na confirmação de pagamento, resolver vários ajustes de UX/schema, trocar campos de texto livre (Analista/Closer) por seleção de usuários reais do banco, e — no meio do caminho — descobrir e responder a um incidente real de perda de dados causado por uma migration anterior desta mesma sessão.

### O que foi feito
- Campo "Serviço Contratado" reposicionado para o topo do bloco de gestão no modal de detalhe.
- CNPJ duplicado permitido quando o serviço contratado é diferente: migration `clientes.cnpj @unique` → `@@unique([cnpj, servicos])`, aplicada em produção (Vault, com backup, 238 registros preservados), com mesclagem visual por CNPJ na listagem.
- Sincronização Metas→CS&NPS movida da criação do contrato para a confirmação de pagamento, com reativação correta de registros arquivados.
- 5 ajustes de UX/schema: fix de timezone (-1 dia) na Data Contratação, campo Cidade/município no modal de detalhe, UF separado do Regime no cadastro manual, 3 campos manuais novos (Forma de Pagamento/Valor do Contrato/Closer), formatação de Forma de Pagamento nos cards igual ao Metas.
- Cards de "Serviços Contratados" absorveram o bloco de gestão (Status/Data Contratação/Data Êxito/Analista/Embasamento/Origem do Lead), cada card com botão Salvar próprio; "Editar Dados" ainda libera edição de tudo simultaneamente.
- Analista Responsável e Closer agora listam usuários reais do banco (filtrados por role — OPERACIONAL / COMERCIAL+Líder Comercial), com `ModalSelecionarUsuario.tsx` reutilizável para escolher "outro usuário" de qualquer setor, tanto no cadastro manual quanto na edição por card.
- Fix: toggle de Forma de Pagamento não deselecionava ao clicar de novo.
- Forma Pagto./Valor Contrato/Closer viraram editáveis dentro dos cards (antes sempre readonly), com prioridade de exibição: dado próprio editado > dado do Metas > vazio.
- Fix real no Painel de Metas: ao escolher "outro" em Forma de Pagamento, o texto digitado nunca era salvo (gravava sempre a string fixa "OUTRO") — Zod trocado de `z.enum` para `z.string().min(1)` + payload corrigido.
- Botão "Salvar Alterações" do rodapé do modal de detalhe ganhou loading state (`salvandoDadosFiscais`) para evitar clique duplo.

### Decisões tomadas
- Constraint composta `@@unique([cnpj, servicos])` em vez de `cnpj` sozinho: permite mesmo CNPJ com serviços diferentes, mesclado visualmente na listagem.
- Reconstruir o sistema de log de auditoria do zero (não restaurar o antigo), com granularidade por campo alterado (não mais snapshot JSON do cliente inteiro), `userId` real + `nomeUsuarioNaEpoca` congelado, agrupamento por `loteId`, e reversão por campo específico gerando nova linha `acao: "REVERSAO"` (preserva a cadeia de auditoria em vez de sobrescrever).
- `salvarAlteracoesGestao` (código morto confirmado) e `restaurarVersaoCliente` (sistema antigo) removidos em vez de migrados.
- Regra permanente adotada: sempre rodar `PRAGMA foreign_key_list` em TODAS as tabelas do banco antes de qualquer `DROP TABLE` em produção — não só nas tabelas que a migration pretende tocar.

### Problemas encontrados / resolvidos
- **INCIDENTE GRAVE (perda de dados):** a migration da constraint composta (rename `clientes`→`clientes_old`, drop) deixou FKs fantasma de 4 tabelas satélite (`logAlteracao`, `socios`, `log_cs`, `logFeedback`) apontando para o nome `clientes_old`. O `DROP TABLE clientes_old` cascateou e apagou TODO o conteúdo dessas 4 tabelas (confirmado: 239 clientes reais, 0 registros nas 4 satélites). Não havia backup dessas tabelas — dado histórico de sócios e logs de CS/feedback/alteração perdido permanentemente. Só a FK de `logAlteracao` foi corrigida nesta sessão (recriação de tabela com FK apontando para `clientes`); `socios`/`log_cs`/`logFeedback` continuam com a mesma FK fantasma, mas vazias (sem risco de nova perda).
- `prisma generate` travado por EPERM (DLL bloqueada) — resolvido matando `node.exe`.
- `tsc --noEmit` final: zero erros novos; só os 3 pré-existentes já catalogados (`validator.ts`, `HabilitacaoRadar/page.tsx:494`, `ModalPerfilColaborador.tsx:191`).

### Pendências
- Segurança JÁ registrada, ainda NÃO resolvida: dados financeiros do Metas (valorContrato/formaPagamento/closerNome) expostos no CS&NPS sem restrição de role — usuário adiou a decisão explicitamente.
- Corrigir a mesma FK fantasma para `clientes_old` em `socios`/`log_cs`/`logFeedback` (mesmo padrão usado em `logAlteracao`), numa próxima sessão.
- Pipeline formal de Forge/Anubis/Lens/Sage sobre TODO o escopo desta sessão ainda não rodou por completo (rodou parcialmente) — retomar se o usuário pedir revisão formal completa.

### Refletido também em
- `decisions.md`: 2 entradas novas em 2026-07-13 (incidente de perda de dados + reconstrução do log de auditoria com model `HistoricoAlteracaoCliente`)

---

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

---

## [2026-06-26] — Identidade Onyx por usuário (token_onyx)

**Tags:** #feature #security #auth #prisma #integration
**Agentes envolvidos:** Bibble → Vault → Echo → Anubis
**Arquivos tocados:**
- `prisma/schema.prisma` (campo token_onyx em usuarios)
- `src/lib/onyx/client.ts`, `src/lib/onyx/user-token.ts` *(CRIADO)*
- `src/app/api/onyx/chat/route.ts`, `src/app/api/onyx/agents/route.ts`, `src/app/api/onyx/agents/[id]/route.ts`, `src/app/api/onyx/agents/upload-image/route.ts`
- `src/actions/CreateAction.ts`, `src/actions/ColaboradorRH.ts`, `src/actions/get-user.ts`
- `src/components/FormCadastro.tsx`, `src/components/Colaboradores/ModalPerfilColaborador.tsx`

### Contexto
Usuário queria que cada usuário do Painel falasse com o Onyx pela conta DELE (não pela conta de serviço admin ti@alpha-comex.com). Diagnóstico: modelo era conta de serviço única (PAT em ONYX_API_KEY); só a memória era separada via texto.

### O que foi feito
- Campo `token_onyx String?` (opcional) em `usuarios`. Helper `getUserOnyxToken(sessionUserId)` resolve o token pelo id da SESSÃO (nunca do corpo).
- Client Onyx (`authHeaders`/`onyxFetch`) aceita `userToken` que sobrescreve o PAT de serviço. Propagado em chat, createAgent, updateAgent, deleteAgent, uploadAgentImage, uploadChatFiles.
- Campo no cadastro (FormCadastro) E na edição (ModalPerfilColaborador). Token NUNCA volta ao cliente — só booleano `tem_token_onyx`. Edição só admin/CEO.
- Anubis achou e corrigiu vazamento PRÉ-EXISTENTE em `get-user.ts` (findMany sem select expunha senha/reset_token/token_onyx ao client).

### Decisões tomadas
- **PAT por usuário guardado no banco** (escolha do usuário) em vez de SSO/OAuth (mais correto mas é infra no servidor Onyx, fora do código).
- **Provado por teste real**: token individual → Onyx `/api/me` retorna o usuário certo; criar agente → `owner` é o usuário, não admin. Backend 100% funcional.
- **Operações admin globais** (criar skill custom, modelo de imagem global) seguem no token de serviço — não fazem sentido por usuário.

### Problemas encontrados / resolvidos
- Diagnóstico crítico: o app NÃO usa o `dev.db` (DATABASE_URL) — usa adapter `PrismaLibSql` direto no Turso via `TURSO_DATABASE_URL`. `prisma db push` atinge só o dev.db local (vazio). Para produção, ALTER TABLE manual no Turso.

### Pendências
- **Rodar no Turso**: `ALTER TABLE usuarios ADD COLUMN token_onyx TEXT;`

---

## [2026-06-26] — Imagens no chat: reidratação, upload (307), lightbox + edição/interrupção

**Tags:** #feature #bugfix #integration #critical
**Agentes envolvidos:** Bibble → Scout → Vault → Echo → Nova → Forge
**Arquivos tocados:**
- `prisma/schema.prisma` (onyxSessionId em BibbleSession)
- `src/lib/onyx/client.ts` (getChatSession, uploadChatFiles novo endpoint)
- `src/app/api/onyx/session/[id]/route.ts` *(CRIADO)*, `src/app/api/onyx/chat/route.ts`
- `src/components/BibbleChatHome/BibbleChatLayout.tsx`, `BibbleMessageBubble.tsx`, `BibbleMessageList.tsx`, `BibbleChatWindow.tsx`

### Contexto
Múltiplas dores de imagem no chat com agentes Onyx: conversa volta vazia ao recarregar; agente não lê imagem enviada; imagem gerada não renderiza; lightbox preso na bolha; pedido de editar mensagem e interromper.

### O que foi feito
- **Reidratação (CR#2)**: `onyxSessionId` na BibbleSession (Onyx = fonte de verdade). Rota `GET /api/onyx/session/[id]` lê histórico do Onyx (texto + imagens via files[]) e reidrata ao reabrir. Imagens viram markdown `![](/api/onyx/file/{id})`.
- **Upload quebrado (CR#1, a principal)**: `POST /api/chat/file` dá 307 (descontinuado). Trocado para `POST /api/user/projects/file/upload`; parsing `user_files`; descriptor agora carrega `user_file_id` (obrigatório, senão Onyx rejeita "no project_id"). VALIDADO por teste real: agente passa a ler a imagem.
- **Markdown de imagem quebrado**: alt com prompt gigante multi-linha quebrava `![](url)`. `sanitizeImageMarkdown` (front) + alt curto no backend.
- **Lightbox preso na bolha**: backdrop-filter da bolha criava containing block, prendendo o `position:fixed`. Componente `ImageLightbox` via `createPortal` no body. Preview `object-cover`→`object-contain`.
- **Editar mensagem (lápis)**: rebobina conversa até a msg, reenvia. **Interromper**: texto/arquivos voltam pra caixa, remove o par de mensagens.

### Decisões tomadas
- **Onyx = fonte de verdade do histórico** de conversas com agente (não duplicar no Prisma). Salva só onyxSessionId no Painel.
- **Defesa em 2 camadas** para markdown de imagem: backend sanitiza ao emitir, front sanitiza ao renderizar (cobre agente que ecoa o markdown no texto).
- **Lightbox via portal** é obrigatório quando o ancestral tem backdrop-filter/transform/overflow.

### Problemas encontrados / resolvidos
- 307 no upload → endpoint novo (catalogado em known-errors).
- Markdown de imagem com alt multi-linha → sanitização.
- `position:fixed` preso → portal.

### Pendências
- **Rodar no Turso**: `ALTER TABLE bibble_session ADD COLUMN onyxSessionId TEXT;`
- Reiniciar `npm run dev` para validar end-to-end (matei processos node na sessão).

### Refletido também em
- decisions.md: Onyx fonte de verdade do histórico; lightbox via portal.
- known-errors.md: upload 307 do Onyx.

---

## [2026-06-29] — Módulo Conectores IAlpha (UI de gestão de RAG do Onyx)

**Tags:** #feature #integration #onyx #nextjs
**Agentes envolvidos:** Scout → Echo → Nova/Iris → Forge → Probe → Anubis → Lens → Scribe

### Contexto
Pedido: UI completa e funcional no PainelAlpha para os Conectores do Onyx (192.168.35.113:3000 / onyx.alpha-comex.com), com as mesmas funcionalidades. Decisões do usuário: escopo CRUD completo · acesso via módulo próprio com permissão · rota dedicada /PainelAlpha/Conectores.

### O que foi feito
- **API do Onyx mapeada** via openapi.json (743KB). Descobertas-chave: indexing-status é POST (não GET), agrupado por source; reindex = run-once (connector_id + credential_ids); criar = credencial→connector→link (PUT connector/cred)→run-once; upload em /manage/admin/connector/file/upload.
- **client.ts** (+~330 linhas): seção Conectores — listConnectorIndexingStatus, getCCPair, setCCPairStatus, renameCCPair, runConnectorOnce, deleteCCPair, createConnector/updateConnector, linkConnectorCredential, listCredentials/createCredential/deleteCredential, listDocumentSets/createDocumentSet/updateDocumentSet/deleteDocumentSet, uploadConnectorFiles.
- **Guard** `connectors-guard.ts`: authorizeConnectors() — auth() + Admin/CEO ou permissão conectoresIAlpha. Usado em todas as rotas.
- **Rotas** `/api/onyx/connectors/{route,[ccPairId],credentials,document-sets,upload}` — proxy autorizado; PAT só no server.
- **Registry**: 1 entrada conectoresIAlpha (categoria admin, allowedRoles Admin/CEO, iconName Cable). Ícone Cable somado ao import + ICON_MAP da GlobalSidebar.
- **UI** `ConectoresClient.tsx`: abas (Conectores/Document Sets/Credenciais), tabela com status colorido + polling 15s, ações reindex/pause/resume/excluir, modais de detalhe/criação (File/Web/QNAP)/document-set. Página server com guard de permissão.

### Decisões tomadas
- **Criação focada em File/Web/QNAP** (tipos reais do servidor); gestão funciona p/ qualquer conector existente. OAuth (Drive/Slack) fora — exige redirect no servidor Onyx.
- **Acesso por permissão de módulo** conectoresIAlpha (não só admin) — afeta RAG global, por isso restrito.
- **Helper client separado** (connectors-browser.ts) com tipos espelhados — nunca importa client.ts (sem PAT no bundle).

### Problemas encontrados / resolvidos
- **indexing-status dava 405** com GET → é POST. Descoberto via openapi.json.
- **Tailwind v4: classes dinâmicas** `bg-${cor}-600/15` não são geradas → trocado por classes estáticas via prop `box`.
- **react-hooks/set-state-in-effect** (React Compiler) barrava o fetch+polling no useEffect → aplicada a convenção do projeto (eslint-disable-next-line com comentário), como em ChatChamado/PainelLayoutClient/ModalTermo etc.
- **EPERM no `prisma generate`** durante build (DLL travada pelo dev server, erro conhecido) → rodado `npx next build` direto. Build EXIT=0, rota /PainelAlpha/Conectores compilada.

### Aprendizado importante (Scribe)
- **CLAUDE.md desatualizado**: integração de módulo virou MODULOS_REGISTRY único (1 entrada), não os 3 arrays manuais (FormCadastro/Atalhos/PainelAlphaClient). FormCadastro não tem mais lista inline; Atalhos não tem MODULOS_BASE. Registrado na memória Claude (project_modulos_registry).

### Pendências
- Testar criação real de conector Web/QNAP end-to-end (File já é o padrão usado).
- Considerar trocar alert()/confirm() por toasts do projeto (não-bloqueante).
- Tsc tem 4 erros PRÉ-EXISTENTES (validator.ts, HabilitacaoRadar:494, DetalheParceiroPage órfão) — não desta feature.

---

## [2026-06-29] — Conectores IAlpha: galeria visual estilo Onyx (logos de marca + guia por conector)

**Tags:** #feature #ui #onyx #nextjs
**Agentes envolvidos:** Scout → Nova/Iris → Forge → Probe → Lens → Scribe

### Contexto
Usuário pediu que os conectores ficassem visíveis como no Onyx (Gmail, Drive, Discord, etc.), porque usuários leigos não entendem só os 3 tipos do form. Decisões: mostrar TODOS (~60), ícones de marca reais, e ao clicar explicar o que precisa ter no arquivo e como configurar + formulário funcional.

### O que foi feito
- **simple-icons** instalado (npm) para logos de marca reais. Componente `src/components/Conectores/BrandIcon.tsx` — renderiza o SVG da marca (import named tree-shakeable) ou um ícone lucide colorido de fallback (Slack/Salesforce/SharePoint/Teams/S3/Oracle não existem no simple-icons → fallback).
- **CONNECTOR_CATALOG** (connectors-browser.ts): ~60 sources do Onyx, cada um com label, categoria, brandSlug, cor, availability (ready/credential/server), descrição, requisitos, formato, passos, configFields, credentialFields. + CONNECTOR_CATEGORIES + availabilityMeta().
- **Galeria** no modal "Conectar uma fonte" (ConectoresClient): grid de cards com logo + selo de disponibilidade + busca + filtro por categoria. Ao clicar → `DetalheConector`: guia ("O que você precisa ter" / "Como o conteúdo deve estar" / "Passo a passo") + formulário funcional. SourceIcon da tabela também passou a usar catálogo+BrandIcon.

### Decisões tomadas
- **OAuth desabilitado no servidor** (confirmado via /api/connector/oauth/details/{source} → oauth_enabled:false para todos). Logo, conectores Google/Slack/etc. exigem credencial manual (token/JSON), não botão "conectar com Google". A UI marca como "server"/"credential" e explica como obter.
- **simple-icons em vez de 60 PNGs**: sem versionar assets; logos coloridos por hex da marca.
- **Mostrar todos (~60)** mas com selo honesto de disponibilidade — não promete criar na hora o que precisa do time técnico.

### Problemas encontrados / resolvidos
- Vários slugs simple-icons inexistentes (Slack, Salesforce, SharePoint, Teams, S3, Oracle — removidos por marca registrada) → BrandIcon cai no fallback lucide colorido.
- IDs duplicados/errados no catálogo por copy rápido (Discourse com id zendesk, Gong com id freshdesk, Egnyte-Sharepoint lixo) → corrigidos para o DocumentSource real.
- Build: EPERM no prisma generate (conhecido) → `npx next build` direto. EXIT=0, rota compilada.

### Gate
- Forge: tsc (só 4 erros PRÉ-EXISTENTES), lint limpo, build EXIT=0. ✅
- Probe/Lens: galeria integrada ao modal existente; sem novo integration point.

### Pendências
- Validar criação real de um conector "credential" (ex: Notion/Slack) com token de verdade end-to-end.

---

## [2026-07-02 00:00] — Extratos Bancários: pipeline de 2 agentes IA → 1 agente único (Organizador)

**Tags:** #refactor #integration #onyx
**Agentes envolvidos:** Scout, Echo, Forge
**Arquivos tocados:** `src/lib/onyx/extrato-agents.ts`, `src/app/api/onyx/extrato/route.ts`, `.env.local`, `.bibble/memory/decisions.md`

### Contexto
Usuário pediu para remover os agentes de IA do trabalho de extração/classificação de extratos bancários, usar Tika puro (OCR sem IA) para extrair o texto, e deixar o agente novo "Organizador de Extratos Bancários" (criado por ele no Onyx, ID 32) como único responsável por interpretar o texto do Tika e classificar cada valor na coluna correta.

### O que foi feito
- Removidas as constantes `AGENT_EXTRATOR_ID` (25) e `AGENT_NORMALIZADOR_ID` (26) — agentes já deletados do Onyx pelo usuário.
- Criada `AGENT_ORGANIZADOR_ID` (env `ONYX_AGENT_ORGANIZADOR_ID`, default `32`).
- Fundidos `PROMPT_EXTRACAO` + `PROMPT_NORMALIZACAO` em um único `PROMPT_ORGANIZACAO`.
- `processarExtratoPorAgentes` agora faz só 2 passos: Tika extrai texto bruto (inalterado) → 1 chamada ao agente Organizador → parse do JSON final.
- JSDoc de `src/app/api/onyx/extrato/route.ts` atualizado para refletir o novo fluxo.
- `ONYX_AGENT_ORGANIZADOR_ID=32` adicionado ao `.env.local`.

### Decisões tomadas
- Manter o nome da função `processarExtratoPorAgentes` (plural) para não quebrar o import na rota — decisão de mínima fricção, não trocado por singular.
- Contrato de saída (`[{data, descricao, valor}]`) mantido idêntico — zero mudança no frontend (`ModalUploadExtrato.tsx`, `SalvarTransacoesLote`).

### Problemas encontrados / resolvidos
- `npm run build` falhou com EPERM no Prisma Client DLL (processo `node.exe` antigo segurando o arquivo). Resolvido matando os processos Node.js fora do Cursor, com autorização explícita do usuário — depois `build` passou limpo.

### Gate
- Forge: tsc limpo nos arquivos alterados (3 erros pré-existentes em módulos não relacionados), eslint limpo, build EXIT=0 com `/api/onyx/extrato` compilado. ✅
- Sem mudança de schema Prisma → Vault não acionado. Sem mudança de UI/menu/permissões → Probe não acionado.

### Pendências
- Testar com um PDF de extrato real (múltiplas páginas) para confirmar que o agente único aguenta o volume de texto sem degradar a extração.

### Refletido também em
- `decisions.md`: entrada "2026-07-02 — Pipeline de Extratos Bancários: Tika puro (OCR) + 1 agente único (Organizador)".

---

## [2026-07-09 00:00] — Reescrita completa do módulo de Extratos Bancários

**Tags:** #feature #refactor #bugfix #critical #security #decision
**Agentes envolvidos:** Scout, Vault, Echo, Nova, Forge, Probe, Anubis, Lens, Sage, Scribe
**Arquivos tocados:** `prisma/schema.prisma`, `src/actions/{Extratos,transacao,bancos,periodos}.ts`, `src/lib/validations/extrato.ts` (novo), `src/lib/onyx/extrato-agents.ts`, `src/components/Extratos/*` (9 arquivos novos), `src/components/ui/animated-shader-background.tsx`, `src/app/PainelAlpha/ExtratosBancarios/page.tsx` e `[Id]/page.tsx`, `next.config.ts`

### Contexto
Usuário pediu para refazer o módulo de Extratos Bancários "de cabo a rabo" (páginas, modais, pipeline OCR/IA, background animado novo) após meses tentando acertar o sistema, delegando as decisões de arquitetura ao squad com o único critério "quero funcionando". Precedeu esta reescrita, na mesma sessão, o fix de 2 bugs em produção do pipeline OCR (polyfill de `DOMMatrix` + worker do `pdfjs-dist` ausente no bundle da Vercel — já commitados e deployados antes da reescrita começar).

### O que foi feito
- **Vault**: migrou `Transacao.data` de `String` para `DateTime?` + `dataOriginalTexto` direto em produção (Turso), com backup completo prévio (1015 registros em JSON+SQL).
- **Echo**: reescreveu as 4 Server Actions com Zod + paginação real (`skip`/`take`) + `auth()` (faltava em `bancos.ts`/`periodos.ts`); reforçou o prompt do agente Onyx contra confundir "saldo do dia" com transação; adicionou validação Zod item-a-item da resposta da IA.
- **Nova**: reescreveu 9 componentes em `src/components/Extratos/`, deletando a estrutura antiga (`[Id]/Modais/*`, `ModalCadastros/`); criou o primeiro componente de paginação server-side real do painel (`TabelaTransacoesPaginada`); integrou background shader Three.js (aurora); primeira adoção de `AlertDialog`/`Badge` do shadcn no projeto inteiro; trocou `<img>` por `next/image`.
- **Forge/Probe**: `tsc`/`lint`/`build` limpos; confirmado zero regressão de integração (menu/rotas/permissões via `MODULOS_REGISTRY` intactos).
- **Anubis**: 1 achado corrigido (log de dados financeiros reais — descrição/valor de transação — no console de `extrato-agents.ts`).
- **Lens**: 2 achados corrigidos (duplicação de lógica de exibição de data entre dois caminhos de código; floating promises em handlers de `ExtratoDetalhe.tsx`).
- **Sage**: testou edge cases contra o banco real de produção — 2 riscos confirmados e corrigidos.
- **Verificação E2E via browser**: 1 bug real encontrado e corrigido (canvas do shader nascia com `width:0` dentro do iframe de módulo do painel).
- **Scribe**: `codebase-map.md` preenchido pela primeira vez com estrutura real do projeto (estava só com template vazio desde a criação).

### Decisões tomadas
- **Arquitetura do pipeline OCR/IA**: mantida a extração determinística (Tika→pdf-parse→PDF24) + interpretação por IA (não voltou a parsers regex por banco, já rejeitados explicitamente pelo usuário em 2026-07-02) — reforçada com prompt few-shot e validação Zod estrita em vez de trocar de arquitetura pela 4ª vez.
- **Schema**: `Transacao.data` virou `DateTime?` (nullable), não `DateTime` obrigatório — decisão puxada pelos dados reais: 272 registros de produção (26,8%) não tinham ano recuperável (`mesReferencia` vazio, formato "DD/MM" só) e o usuário optou por preservar como texto (`dataOriginalTexto`) em vez de inventar um ano.
- **11 registros malformados excluídos**: linhas de "Saldo do dia" que a IA confundiu com transação em execuções passadas — aprovado explicitamente pelo usuário antes da exclusão.
- **Ordenação de transações com data nula**: `nulls: "last"` no Prisma — dados incertos vão para o fim da lista, não poluem a visão do analista.

### Problemas encontrados / resolvidos
- **`prisma generate` travando (EPERM)**: servidor `next dev` do próprio usuário segurando a DLL do Prisma Client — resolvido parando o processo com autorização explícita, regenerando o client, e subindo um novo servidor depois.
- **Ordenação SQL colocava dados "incertos" no topo**: confirmado contra o Turso real (`SELECT ... ORDER BY data ASC` retorna `NULL` primeiro no SQLite) — corrigido com `nulls: "last"`.
- **Paginação não se ajustava após exclusão em lote**: se a página atual ficasse além do novo total, a UI mostrava "nenhum resultado" em vez de voltar para a última página válida — corrigido em `TabelaTransacoesPaginada.tsx`.
- **Canvas Three.js com `width:0`**: `ResizeObserver` sozinho não bastou dentro do iframe de módulo do painel — corrigido com leitura de garantia via `requestAnimationFrame` complementar.

### Pendências
- **Nenhum commit/push feito ainda** — toda a reescrita está no working tree. Próximo passo natural: revisar o diff e acionar DevOps para commit/push (exclusivo dele, conforme regra do projeto).
- Baixar/hospedar localmente os logos de banco (hoje seguem como URLs externas de terceiros, só migradas para `next/image` com `remotePatterns` — ainda não removida a fragilidade da fonte externa).
- `/api/onyx/extrato/reprocessar` não valida o formato de `PaginaComErro[]` com Zod (pré-existente, fora do escopo desta sessão).

### Refletido também em
- `decisions.md`: 2 entradas novas ("2026-07-08 — Reescrita completa... decisão delegada a Bibble" e "2026-07-09 — Migration de Transacao.data executada").
- `architecture.md`: schema atualizado do módulo Extratos, nota sobre `data` nullable.
- `components.md`: catálogo do novo módulo, com destaque para `TabelaTransacoesPaginada` e `AnimatedShaderBackground`.
- `known-errors.md`: 3 entradas novas (DOMMatrix/worker do pdf-parse na Vercel — 2 partes; canvas Three.js width:0 em iframe).
- `codebase-map.md`: reescrito do zero (estava vazio), com padrão de módulo documentado usando Extratos como referência.
---

## [2026-07-14 10:47] — Alpha CheckList: edição, pastas e documentos ZIP

**Tags:** #feature #integration #prisma #nextjs #security #auth
**Agentes envolvidos:** Scout, Vault, Anubis, Forge, Sage, Scribe, Kowalski
**Arquivos tocados:** `prisma/schema.prisma`, `src/actions/checklist.ts`, `src/app/PainelAlpha/CheckList/*`, `src/app/api/checklist/[empresaId]/documentos/zip/route.ts`, `src/lib/checklist/items.ts`, `docs/stories/story-checklist-organizacao-e-edicao.md`

### Contexto
Usuário pediu edição global de empresas, alteração posterior de embasamento, filtros, pastas, remoção de dois status operacionais e download dos documentos em ZIP.

### O que foi feito
- Criado `PastaChecklist` e vínculo opcional em `OperacionalClientes`; migration aditiva foi aplicada e confirmada no Turso.
- Implementados edição global, filtros, criação/vínculo de pasta, troca de embasamento que preserva checklists e documentos anteriores, e rota autenticada de ZIP.
- Removidos `FALAR_ANDREW` e `FALAR_DR_EDVAN` do schema e da UI; registros legados foram normalizados para `PENDENTE` (nenhum existente).

### Decisões tomadas
- Troca de tipo ativa/cria o checklist correspondente e preserva o anterior: evita perda de documentos históricos.
- ZIP reúne somente documentos ativos, com limites de tamanho, nomes seguros e bloqueio de URLs não HTTPS/privadas.

### Problemas encontrados / resolvidos
- `npm run typecheck` não existe; o `tsc` encontra três erros preexistentes fora do módulo. `npm run build` continua bloqueado pela DLL do Prisma presa pelo servidor dev; build direto já havia passado.

### Pendências
- Fazer validação autenticada de ponta a ponta dos fluxos de edição e download quando houver sessão de teste disponível.

### Refletido também em
- `codebase-map.md`: Alpha CheckList atualizado.
- `integration-points.md`: rota ZIP, dados e permissões documentados.

---

## [2026-07-14 10:00] — Alpha CheckList: modelos configuráveis de embasamento

**Tags:** #feature #prisma #nextjs #security #integration
**Agentes envolvidos:** Scout, Vault, Anubis, Forge, Scribe, Kowalski
**Arquivos tocados:** `prisma/schema.prisma`, `src/actions/checklist{-modelos}.ts`, `src/app/PainelAlpha/CheckList/Embasamentos/*`, `src/lib/checklist/modelos.ts`

### Contexto
Usuário pediu que o responsável crie os documentos de cada embasamento pela interface, incluindo documentos globais, em vez de depender de uma lista fixa no código.

### O que foi feito
- Criado `ModeloItemChecklist`, inicialmente sem itens, e aplicada migration aditiva confirmada no Turso.
- Adicionada a área de configuração com quatro cards de embasamento e formulário de código, nome, descrição, seção, obrigatoriedade e escopo global/específico.
- Criação/troca de checklist passa a copiar os modelos persistidos do tipo escolhido e os globais, preservando checklists históricos.

### Decisões tomadas
- Modelo global usa `tipo = null`: o mesmo registro entra em todos os quatro embasamentos sem duplicação.

### Problemas encontrados / resolvidos
- A build inicial detectou Prisma gerado sem o adaptador; cliente foi regenerado normalmente com o servidor parado e a build passou.

### Pendências
- O responsável precisa cadastrar os primeiros documentos nos modelos; nenhum item padrão foi inserido.

### Refletido também em
- `codebase-map.md`: configuração de modelos documentada.
- `integration-points.md`: novas rotas e regra de cópia documentadas.

---

## [2026-07-14 14:30] — Modo Piadista do Bibble: banco curado substitui Ollama

**Tags:** #fix #bibble #api
**Agentes envolvidos:** Scout, Nova/Echo, Forge, Probe, Kowalski
**Arquivos tocados:** `src/lib/bibble/piadas-bank.ts` (novo), `src/app/api/bibble/piada/route.ts`, `.bibble/piadas-cache.json`

### Contexto
Usuário reclamou que as piadas do modo Piadista eram repetitivas e sem graça. Diagnóstico: o Ollama (gemma) gerava quase sempre a mesma piada — o cache tinha ~250 entradas, mais de 60 delas variações de "o livro de matemática estava triste" — e cada piada ainda repetia 4 vezes (MAX_SHOWN).

### O que foi feito
- Criado `src/lib/bibble/piadas-bank.ts` com **109 piadas curadas e distintas** em pt-BR (animais, objetos, charadas, comida, profissões, cúmulos, fantasia, tecnologia). Para adicionar novas, basta apendar strings no array.
- Rota `/api/bibble/piada` reescrita: sorteia do banco com **rotação sem repetição** — cache guarda índices `vistos` e uma piada só volta depois que o banco inteiro circular (e nunca duas vezes seguidas na virada do ciclo).
- Removida a dependência do Ollama nessa rota (resposta agora é instantânea).
- Cache antigo (`entries`) resetado para o formato novo (`{"vistos":[]}`); leitura tolera formato antigo.

### Decisões tomadas
- Banco estático curado > geração via LLM local para piadas: qualidade e variedade garantidas, zero latência, zero dependência de o Ollama estar de pé.
- Contrato da resposta mantido (`{ piada: string }`) — nenhuma mudança no front (`BibbleSpriteCompanion.tsx`).

### Verificação
- Forge: `tsc --noEmit` sem erros novos (4 erros pré-existentes em ExclusaoFiscal/HabilitacaoRadar/ModalPerfilColaborador, não relacionados); eslint limpo nos arquivos tocados.
- Probe: 6 chamadas reais na rota do dev server → 6 piadas distintas, cache rotacionando corretamente.

### Pendências
- Erros pré-existentes de typecheck citados acima seguem no projeto (fora do escopo desta sessão).

---

## [2026-07-15 12:59] — CS & NPS: importação em lote segura e revisável

**Tags:** #feature #integration #nextjs #prisma #security #auth
**Agentes envolvidos:** Scout, River, Echo, Nova, Anubis, Sage, Forge, Probe, Lens, Scribe, Kowalski
**Arquivos tocados:** `src/app/PainelAlpha/CadastroClientes/page.tsx`, `src/app/PainelAlpha/CadastroClientes/importacao/*`, `src/app/api/cs-nps/{exportar,importar}/*`, `src/lib/cs-nps/*`, `tests/cs-nps/*`, `scripts/smoke-cs-nps-zip-streaming.mjs`, `vitest.config.ts`, `package.json`, `package-lock.json`, `docs/stories/story-cs-nps-importacao-em-lote.md`

### Contexto
Após concluir e formatar a exportação completa do CS & NPS, o usuário pediu uma importação em lote de Sócios, CS e Feedbacks, combináveis livremente, com modelo de planilha, suporte a vários sócios por empresa, revisão detalhada e confirmação explícita antes de gravar.

### O que foi feito
- Criado modal em quatro etapas: seleção dos tipos, download/upload do modelo combinado, prévia revisável e resultado final. O modelo usa CNPJ ou razão social e representa múltiplos sócios em linhas separadas com o identificador da empresa repetido.
- A prévia classifica cada linha, mostra destino e serviço, permite remover itens e exige resolução manual quando há mais de um cadastro candidato; nenhuma empresa é criada automaticamente.
- As três entidades são persistidas em uma única transação Prisma, com revalidação do destino, allowlists, rollback total, resumo por empresa/tipo e auditoria somente de metadados.
- A autorização foi centralizada e aplicada à exportação, modelo, prévia e confirmação: sessão válida, usuário ativo, papel atual Admin/CEO e permissão efetiva `Cliente`.
- O upload recebeu limites explícitos, validação de origem/headers, bloqueio concorrente, rate limit por instância e preflight XLSX/ZIP com `yauzl` por streaming, contando bytes descompactados reais para bloquear zip bomb e metadados falsificados.
- Adicionados Vitest e smoke dedicado; 19/19 testes passaram, incluindo modelo, múltiplos sócios, ambiguidade, ID adulterado, rollback e arquivos hostis.

### Decisões tomadas
- Uma linha por sócio, com CNPJ/razão repetidos: preserva todos os sócios sem exigir colunas numeradas ou alterar o schema.
- Matching exato e escolha manual em ambiguidades: evita vincular dados ao serviço errado quando a empresa possui múltiplos registros.
- Prévia somente no cliente e gravação atômica no servidor: mantém o fluxo removível sem criar rascunhos persistentes ou sucessos parciais.
- Sem migration e sem idempotência persistente nesta entrega: a importação cria apenas filhos nos modelos existentes; uma nova confirmação manual válida pode repetir registros.
- Rate limit em memória por instância como defesa em profundidade: não foi tratado como limite distribuído nem como garantia de idempotência.

### Problemas encontrados / resolvidos
- Metadados ZIP podem mentir sobre o tamanho descompactado: o preflight passou a ler cada entrada por streaming e interromper ao exceder limites reais.
- `npm run typecheck` segue com três erros preexistentes fora do módulo e `npm run build` falhou no `prisma generate` por DLL bloqueada no Windows; os 19 testes, o smoke e `npx next build` passaram, sem erro novo da feature.
- Não havia navegador com sessão Admin/CEO para executar o fluxo visual autenticado; a integração foi validada por código, testes e build, e o teste visual ficou explícito para revisão manual.

### Pendências
- Executar o fluxo visual completo com uma sessão autenticada de Admin/CEO.
- Considerar idempotência persistente por lote se o produto passar a exigir proteção contra reimportações manuais independentes.
- Trocar o rate limit por armazenamento compartilhado caso a aplicação opere com múltiplas instâncias e precise de limitação distribuída.

### Refletido também em
- `codebase-map.md`: módulo de importação, componentes, serviços e testes documentados pelo Scribe.
- `integration-points.md`: novas rotas, autorização compartilhada, transação e hardening do XLSX documentados pelo Scribe.
- `docs/stories/story-cs-nps-importacao-em-lote.md`: critérios, evidências, gates, limites e File List completos.

---

## [2026-07-15 15:50] — IAlpha: sistema solar astronômico realista no background

**Tags:** #frontend #visual #ialpha #astronomia #css
**Agentes envolvidos:** Scout, Nova, Forge, Probe, Scribe, Kowalski
**Arquivos tocados:** `src/components/BibbleChatHome/IAlphaCosmicBackground.tsx`, `docs/stories/story-ialpha-background-sideral.md`, `.bibble/memory/components.md`

### Contexto
O usuário achou o background sideral anterior "quase bom" e pediu duas evoluções: (1) sistema solar inspirado em imagem de referência, sem linhas de órbita, sol fora do centro, azul Alpha, com posições dos planetas conforme data/hora real; (2) realismo visual — os planetas pareciam esferas lisas de ilustração básica.

### O que foi feito
- **Efemérides reais sem API externa:** os 8 planetas usam elementos orbitais keplerianos J2000 do JPL (válidos 1800–2050). Equação de Kepler resolvida por ponto fixo, longitude heliocêntrica verdadeira por planeta, recalculada a cada minuto via `useSyncExternalStore` (SSR sem planetas → cliente assume após hidratação, sem mismatch).
- **Validação astronômica:** Terra em 292,9° para 15/jul — confere com o esperado (~293°).
- **Realismo em CSS puro (stack mantida — NÃO é Three.js):** iluminação direcional coerente com o sol da cena (highlight + terminador via atan2), texturas procedurais SVG feTurbulence inline animadas (rotação própria, tilt axial, Vênus retrógrado), faixas de gás anisotrópicas em Júpiter/Saturno, Grande Mancha, anéis de Saturno em gradiente com divisão de Cassini, nuvens da Terra em camada própria, rim atmosférico via inset box-shadow, profundidade por blur+dessaturação, estrelas com temperatura de cor variada, lua da Terra no ângulo real.

### Decisões tomadas
- Cálculo local (Kepler/JPL) > API externa para posições planetárias: zero latência, zero dependência, funciona offline. Registrar como padrão para qualquer feature astronômica futura.
- Texturas por SVG feTurbulence data-URI > imagens em /public: sem requests, sem licença, sem costura, tileável para animar rotação.
- `useSyncExternalStore` com server snapshot null > setState em useEffect: exigência do React Compiler (regra `react-hooks/set-state-in-effect` reprova o padrão antigo).

### Verificação
- Forge: eslint limpo no arquivo; `tsc --noEmit` sem nenhum erro novo (persistem 4 preexistentes já catalogados).
- Probe: verificação visual real no dev server (:3000) — desktop e mobile 375px, centro legível, sem erros novos no console.

### Pendências
- Hydration mismatch preexistente de Radix DropdownMenu (ids `radix-*`) no layout — fora do escopo, aparece como "1 Issue" no overlay do Next dev.

---

## [2026-07-15 16:20] — IAlpha: rotação própria dos planetas ancorada no relógio real

**Tags:** #frontend #visual #ialpha #astronomia #fix
**Agentes envolvidos:** Nova, Forge, Probe, Scribe, Kowalski
**Arquivos tocados:** `src/components/BibbleChatHome/IAlphaCosmicBackground.tsx`, `docs/stories/story-ialpha-background-sideral.md`, `.bibble/memory/components.md`

### Contexto
Usuário cobrou: "a rotação está funcionando conforme o horário?? tem que funcionar". Diagnóstico honesto: a translação (posição orbital) já era real, mas o giro das texturas era animação decorativa que começava do zero a cada load, com velocidades inventadas.

### O que foi feito
- Substituído `spinDuration/spinDirection` arbitrários por `rotationPeriodHours` com os períodos siderais reais (Mercúrio 1407,6h; Vênus −5832,5h; Terra 23,93h; Marte 24,62h; Júpiter 9,93h; Saturno 10,66h; Urano −17,24h; Netuno 16,11h; negativo = retrógrado).
- `SPIN_TIME_LAPSE = 900` (1s real = 15min simulados) torna o giro perceptível mantendo as proporções reais entre planetas.
- Fase determinística de `Date.now()`: keyframes CSS `ialpha-planet-spin` + `animation-delay` negativo posicionam cada planeta na face correta para o momento atual. CSS usa o timeline do documento → mantém sincronia com o relógio mesmo com aba em background (melhor que framer/rAF).
- Trocado framer-motion por CSS animation nessas camadas; `useReducedMotion` mostra a fase estática correta sem animar.

### Decisões tomadas
- Períodos reais + fator de aceleração fixo > velocidades inventadas: "conforme o horário" vale para translação E rotação; mesma data/hora → mesma face visível em qualquer máquina.
- `useState(() => Date.now())` para a época do spin (uma vez no mount) — evita reinício da animação a cada tick do minuto.

### Verificação
- Forge: eslint limpo; tsc sem erros novos.
- Probe (browser, getComputedStyle nos 8 planetas): durações exatas (Júpiter 39,7s ... Vênus 23330s), delays de fase não-nulos, Vênus/Urano em `reverse`. Tudo ✅.

### Aprendizado técnico
- O conteúdo do PainelAlpha renderiza dentro de um iframe no preview — `javascript_tool` precisa consultar `iframe.contentDocument`, não o document externo.

---

## [2026-07-15 16:55] — IAlpha: órbitas visíveis com tempo acelerado (padrão planetário)

**Tags:** #frontend #visual #ialpha #astronomia #fix
**Agentes envolvidos:** Nova, Forge, Probe, Scribe, Kowalski
**Arquivos tocados:** `src/components/BibbleChatHome/IAlphaCosmicBackground.tsx`, `docs/stories/story-ialpha-background-sideral.md`, `.bibble/memory/components.md`

### Contexto
Usuário: "não está girando, eles estão fixos na tela". Causa: fidelidade astronômica total = imobilidade visual (Mercúrio anda ~4°/DIA; nenhum movimento orbital é perceptível em tempo real).

### O que foi feito
- Adotado o padrão de planetário: a cena abre nas posições REAIS do céu de agora e o tempo avança acelerado (`ORBIT_TIME_LAPSE = 80000`). Mercúrio orbita em ~1,6min, Terra ~6,6min, Júpiter ~1,3h, Lua em ~29s. Recarregar = ressincronizar com o céu real.
- Tick de cena a cada 2s (`useSyncExternalStore`) + `transition: left/top 2s linear` interpolando = movimento contínuo sem saltos; iluminação/terminador recalculados a cada tick.
- `SPIN_TIME_LAPSE` 900 → 3600: rotação das texturas perceptível (Terra ~24s, Júpiter ~10s), proporções reais mantidas.
- `prefers-reduced-motion` desliga a aceleração (tempo real).

### Verificação
- Forge: eslint limpo, tsc sem erros novos.
- Probe: script com a matemática exata mediu o movimento — Mercúrio 7,3px/s, Terra 3,6px/s em viewport 1280x800.
- ⚠️ Verificação visual in-app bloqueada: a sessão de login do preview expirou no meio dos testes (heartbeat/pusher 401) e o app cai em "Application error" — bug PREEXISTENTE (task registrada para corrigir o redirect gracioso de sessão expirada). Usuário deve validar visualmente após novo login.

### Aprendizados
- "Posições conforme data/hora" e "movimento visível" são fisicamente incompatíveis sem time-lapse; a solução de planetário concilia os dois.
- O conteúdo do painel renderiza dentro de iframe no preview — inspecionar via `iframe.contentDocument`.
- Sessão expirada derruba o cliente no error boundary global em vez de redirecionar limpo — erro conhecido a corrigir.

---

## [2026-07-21] — Habilitação Radar: botão "Excluir do banco" + gate de permissão corrigido

**Tags:** #feature #security #auth #integration
**Agentes envolvidos:** Scout, Echo, Vault, Nova, Forge, Anubis, Lens, Probe, Scribe
**Arquivos tocados:** `src/actions/RadarAction.ts`, `src/components/ComponentesRadar/BotoesModal.tsx`, `src/components/ComponentesRadar/FiltroTabela/FiltroTabela.tsx`, `src/app/PainelAlpha/HabilitacaoRadar/page.tsx`, `src/components/ComponentesRadar/HabilitacaoRadarClient.tsx` (novo)

### Contexto
Usuário pediu um botão "Excluir do banco" (roxo escuro) no módulo Habilitação Radar, ao lado do botão "Excluir" existente — que hoje só limpa a tabela local (React state), nunca apagou de verdade do banco de produção.

### O que foi feito
- Descoberto que a Server Action de delete real (`deletarRegistrosBanco`) e boa parte do wiring (`temSelecionadoNoBanco`, `handleDeletarDoBanco`) já existiam no código, **órfãos** — nenhum botão os chamava. Reaproveitados em vez de recriados.
- `deletarRegistrosBanco` ganhou `auth()` (era a única action do arquivo sem checagem de sessão).
- Novo botão roxo escuro (`bg-purple-950`) em `BotoesModal.tsx`, com `AlertDialog` de confirmação (mesmo padrão de `ExtratoDetalhe.tsx`), desabilitado sem seleção no banco ou durante `loading`.
- Removidos 2 props mortos (`temSelecionadoNoBanco`/`onDeletarDoBanco`) de `FiltroTabela.tsx`, nunca usados no corpo do componente.
- `HabilitacaoRadar/page.tsx` reestruturado de Client Component monolítico (~1150 linhas) para Server Component fino com gate de permissão (`auth()` + `getPermissoesEfetivas()`, padrão de `Apresentacoes/page.tsx`). Conteúdo movido, sem alteração de lógica, para `HabilitacaoRadarClient.tsx` (novo).

### Decisões tomadas
- Vault classificou o `deleteMany` filtrado pela seleção do usuário como 🟢 (CRUD normal, não "exclusão em massa irrestrita") — sem exigência de backup pontual, só a rotina diária já estabelecida.
- Usuário aprovou corrigir a lacuna de permissão na mesma sessão, em vez de adiar para tarefa separada.
- `npm run build` não foi executado até o fim (EPERM ambiental no `prisma generate`, processo Node concorrente travando a DLL) — usuário aceitou `tsc`+`lint` limpos como validação suficiente para esta sessão.

### Problemas encontrados / resolvidos
- **Lacuna de segurança pré-existente encontrada pelo Anubis:** `HabilitacaoRadar/page.tsx` nunca verificava a permissão de módulo `radar` — qualquer usuário autenticado no sistema acessava a URL direto. Corrigida na mesma sessão.
- Import `@/auth` não existe no projeto (alias não configurado para o arquivo raiz `auth.ts`) — corrigido para `../../auth`, mesmo padrão de `Extratos.ts`.

### Pendências
- Padrão reutilizável para auditorias futuras: páginas de módulo que são Client Component monolítico sem gate de permissão (mesma classe de lacuna já catalogada para `Apresentacoes` antes de ser corrigida) — vale um passe do Probe/Anubis pelos módulos restantes do painel.
- `npm run build` completo (prisma generate) não foi validado nesta sessão por conflito de processo — rodar isoladamente antes do próximo deploy, se possível.

### Refletido também em
- `codebase-map.md`: nova seção "Consulta RADAR (Habilitação Radar) — Excluir do banco + page.tsx virou Server Component"
- `integration-points.md`: nova seção "Consulta RADAR (Habilitação Radar) — gate de permissão + botão 'Excluir do banco'"

### Atualização (mesma sessão, rodada 2) — usuário reportou "o item continua no banco"

Duas causas raiz reais encontradas e corrigidas:
1. `deletarRegistrosBanco` usava `deleteMany` em lote único e retornava `{success:true}` mesmo quando `count` era 0 (nenhuma linha casada) — reportava sucesso falso. Agora retorna `{ success, count }` e a UI distingue "excluídos" de "não encontrados no banco".
2. `handleBuscar` (consulta individual) nunca marcava `salvo: true` no registro local — `temSelecionadoNoBanco` ficava sempre `false` para CNPJs consultados um a um (o fluxo mais comum), desabilitando o botão silenciosamente.

Redesenho pedido pelo usuário: botão agora mostra a quantidade (`Excluir do banco (N)`), modal de 3 fases (confirmar com contagem → barra de progresso processando CNPJ por CNPJ → resumo final), e a exclusão real **não remove mais a linha da tabela** (só marca `salvo:false`), permitindo reconsulta posterior. `BotoesModal.tsx` ganhou 3 estados locais (`modalExcluirBancoAberto`, `iniciouExclusao`) com a fase derivada no render (evitando `useEffect` + `setState` síncrono, que o lint acusou como novo erro `react-hooks/set-state-in-effect` na primeira tentativa).
