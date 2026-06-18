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
