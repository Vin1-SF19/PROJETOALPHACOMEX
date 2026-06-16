# Prompt: Responsividade, Tema e Ajustes Visuais — PainelAlpha Chat

**Tipo:** Task Prompt — Implementação Frontend  
**Gerado por:** Phantom (Bibble Squad)  
**Data:** 2026-06-11  
**Pedido original:** "na pagina do painel alpha em telas pequenas ele acaba não sendo tão responsivo, quero que melhore essa parte, de uma diminuida, alguns detalhes quero que tenha o tema do usuário tem a função getTema no painel alpha, so procurar, na side bar dentro dela tem um botao para recolher que não funciona e é inutil quero que remova, quando eu estou numa conversa o tamanho da imagem do rodapé + a caixa de mensagem ocupam muito espaço, quero que ajuste isso para fica bem visual para o usuário."  
**Uso:** Passar para um agente de implementação (Nova / dev) como briefing completo da tarefa  
**Modelo recomendado:** claude-sonnet-4-6  

---

## Contexto do Projeto

O PainelAlpha é um sistema de gestão interno construído com:
- **Next.js 16 + App Router** (React 19)
- **Tailwind CSS v4** — configuração via `@theme {}` no CSS, sem `tailwind.config.js`
- **Framer Motion** para animações
- **next/image** para todas as imagens (NUNCA `<img>`)
- **Tema do usuário:** função `getTema(nomeTema?: string): TemaAlpha` em `src/lib/temas.ts`
  - Retorna: `{ text, bg, border, glow, shadow, accent }` — tudo em classes Tailwind
  - O tema do usuário vem da sessão/preferências e já é usado em `GlobalSidebar.tsx`, `Bibble.tsx`, etc.
- **Estrutura da página `/PainelAlpha`:**
  - `src/app/PainelAlpha/page.tsx` → renderiza `BibbleChatLayout`
  - `src/components/BibbleChatHome/BibbleChatLayout.tsx` → divide em sidebar + chat window
  - `src/components/BibbleChatHome/BibbleChatWindow.tsx` → cabeçalho + lista de mensagens + input + rodapé
  - `src/components/layout/GlobalSidebar.tsx` → barra lateral principal do painel

---

## Escopo desta Tarefa

Quatro ajustes **independentes** mas entregues juntos:

1. **Responsividade mobile** — layout do BibbleChatLayout/BibbleChatWindow em telas ≤ 768px
2. **Aplicar tema do usuário** — usar `getTema()` nos componentes do chat
3. **Remover botão de colapsar sidebar** — o `ChevronLeft/ChevronRight` da GlobalSidebar que não funciona
4. **Reduzir espaço do rodapé + input** — `BibbleChatWindow` tem imagem do rodapé + `BibbleChatInput` consumindo espaço demais em telas pequenas

---

## Arquivos Envolvidos

| Arquivo | Ajuste |
|---------|--------|
| `src/components/BibbleChatHome/BibbleChatLayout.tsx` | Responsividade mobile: sidebar overlay em mobile |
| `src/components/BibbleChatHome/BibbleChatWindow.tsx` | Reduzir rodapé, aplicar tema, ajuste vertical |
| `src/components/BibbleChatHome/BibbleChatInput.tsx` | Reduzir padding/height em mobile |
| `src/components/layout/GlobalSidebar.tsx` | Remover botão de colapsar (linhas 160-168) |

---

## Instruções Detalhadas

---

### Ajuste 1 — Responsividade Mobile (BibbleChatLayout)

**Problema:** Em telas pequenas (< 768px), a sidebar e o chat window ficam lado a lado, espremendo o conteúdo.

**Solução esperada:**

Em mobile (`< md`):
- A sidebar deve ser um **drawer/overlay** — aparecer por cima do conteúdo, não ao lado
- O chat window ocupa **100% da largura** em mobile
- A sidebar mobile usa `position: fixed`, `z-50`, abre com animação (Framer Motion `x: -100% → 0`)
- Deve haver um botão hambúrguer no header do chat (mobile only) para abrir a sidebar
- Fundo escurecido (`bg-black/50`) atrás da sidebar quando aberta em mobile
- Clicar no fundo fecha a sidebar (já existe `onCloseMobile` nos props)

**Padrão de classes Tailwind v4 esperado:**

```tsx
// BibbleChatLayout — estrutura raiz
<div className="flex h-screen overflow-hidden bg-background">

  {/* Sidebar — desktop: fixa à esquerda; mobile: drawer overlay */}
  <div className={`
    fixed inset-y-0 left-0 z-50 md:relative md:z-auto
    transition-transform duration-300
    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
  `}>
    <BibbleSidebarPanel ... />
  </div>

  {/* Overlay mobile */}
  {sidebarOpen && (
    <div
      className="fixed inset-0 z-40 bg-black/50 md:hidden"
      onClick={() => setSidebarOpen(false)}
    />
  )}

  {/* Chat window — sempre ocupa o restante */}
  <BibbleChatWindow ... />
</div>
```

**Estado mobile:** `sidebarOpen` começa como `false` em mobile, `true` em desktop.
- Detectar com `useState` + `useEffect` verificando `window.innerWidth < 768` no mount.
- Alternativamente: usar CSS puro com `hidden md:flex` para simplificar sem JS.

---

### Ajuste 2 — Tema do Usuário nos Componentes do Chat

**Problema:** O chat (`BibbleChatWindow`, `BibbleChatInput`, `BibbleSidebarPanel`) usa cores hardcoded (violeta/indigo) sem respeitar o tema do usuário.

**Como obter o tema:**

```tsx
// No componente (client component)
import { useSession } from "next-auth/react";
import { getTema } from "@/lib/temas";

const { data: session } = useSession();
const tema = getTema((session?.user as { tema?: string })?.tema);
// tema.text    → ex: "text-blue-500"
// tema.bg      → ex: "bg-blue-600"
// tema.border  → ex: "border-blue-500/20"
// tema.glow    → ex: "bg-blue-600/10"
// tema.shadow  → ex: "shadow-blue-500/20"
// tema.accent  → ex: "37, 99, 235" (RGB para CSS custom properties)
```

**Onde aplicar o tema:**

| Elemento | Classe atual (hardcoded) | Substituir por |
|----------|--------------------------|----------------|
| Botão de enviar mensagem | `bg-indigo-600` | `tema.bg` |
| Indicador de sessão ativa na sidebar | `bg-indigo-500/20 text-indigo-300` | usar `tema.glow` + `tema.text` |
| Borda do input com foco | `focus:border-indigo-500/50` | `tema.border` com opacidade ajustada |
| Scrollbar customizada (se houver) | cor fixa | `accent` via CSS custom property |
| Status de streaming (thinking/pesquisando) | cor fixa | `tema.text` |
| Botão "Nova conversa" na sidebar | cor fixa | `tema.bg` |

**Padrão de uso com `style` inline quando necessário (para accent RGB):**

```tsx
<div
  className={`rounded-lg ${tema.glow} ${tema.border} border`}
  style={{ boxShadow: `0 0 20px rgba(${tema.accent}, 0.15)` }}
>
```

**Regra:** Não remova as cores existentes se o tema não cobrir — use como fallback.
Não use `tema.accent` como classe Tailwind — é string RGB, só serve em `style={{ }}`.

---

### Ajuste 3 — Remover Botão de Colapsar Sidebar

**Arquivo:** `src/components/layout/GlobalSidebar.tsx`

**Localizar e remover este trecho** (linhas ~160-168):

```tsx
{/* Desktop collapse toggle — REMOVER ESTE BLOCO */}
<button
  onClick={onToggleCollapse}
  aria-label={isCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
  className="hidden lg:flex p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
>
  {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
</button>
```

**Atenção ao remover:**
- O `div` pai (`flex items-center h-16 shrink-0 border-b border-white/5 px-4`) deve continuar — apenas remova o `button` de colapsar
- Se `isCollapsed` for `true` e não houver mais como voltar para expandido, definir estado inicial como `false` no componente pai
- Verificar se `onToggleCollapse` ainda é usado em outro lugar antes de remover do tipo `GlobalSidebarProps` — se não for, remover do interface e do destructuring também
- Remover imports não utilizados: `ChevronLeft`, `ChevronRight` — verificar se são usados em outro lugar no arquivo antes de remover

**Verificação antes de remover:**
```bash
grep -n "ChevronLeft\|ChevronRight\|onToggleCollapse\|isCollapsed" src/components/layout/GlobalSidebar.tsx
```
Se `isCollapsed` for usado em outros trechos (ex: para mostrar/ocultar labels), manter o estado mas não expor mais o botão.

---

### Ajuste 4 — Reduzir Espaço do Rodapé + Input em Mobile

**Arquivo:** `src/components/BibbleChatHome/BibbleChatWindow.tsx`

**Problema atual** (linhas 158-167):
```tsx
{/* Rodapé da empresa */}
<div className="shrink-0 w-full flex items-center justify-center py-1.5">
  <Image
    src="/Rodapé.png"
    alt="Rodapé"
    width={280}
    height={28}
    className="object-contain opacity-60 hover:opacity-90 transition-opacity duration-300"
  />
</div>
```

**Solução — esconder o rodapé em mobile, reduzir tamanho em desktop:**

```tsx
{/* Rodapé da empresa — oculto em telas pequenas */}
<div className="shrink-0 w-full hidden sm:flex items-center justify-center py-1">
  <Image
    src="/Rodapé.png"
    alt="Rodapé"
    width={200}
    height={20}
    className="object-contain opacity-40 hover:opacity-70 transition-opacity duration-300"
  />
</div>
```

Mudanças:
- `hidden sm:flex` — oculto em mobile (`< 640px`), aparece a partir de `sm`
- `width={200}` (era 280) — menor
- `height={20}` (era 28) — proporcional
- `py-1` (era `py-1.5`) — menos padding
- `opacity-40` (era `opacity-60`) — menos invasivo visualmente

**Arquivo:** `src/components/BibbleChatHome/BibbleChatInput.tsx`

Localizar o container externo do input e ajustar padding vertical em mobile:

```tsx
// Antes:
<div className="shrink-0 px-4 py-3 border-t border-white/5">

// Depois:
<div className="shrink-0 px-3 py-2 sm:px-4 sm:py-3 border-t border-white/5">
```

Se o input tiver altura fixa (`h-10`, `h-12`), adicionar variante mobile menor:
```tsx
// Antes:
<textarea className="... min-h-[44px]">

// Depois:
<textarea className="... min-h-[36px] sm:min-h-[44px]">
```

---

## Ordem de Execução

Execute nesta ordem para evitar conflitos:

1. **GlobalSidebar** — remover botão (ajuste mais isolado, menos risco)
2. **BibbleChatWindow** — rodapé menor + `hidden sm:flex`
3. **BibbleChatInput** — padding mobile
4. **BibbleChatLayout** — responsividade mobile (maior impacto, fazer por último)
5. **Tema** — aplicar `getTema()` nos componentes do chat (depois do layout estar estável)

---

## Formato de Saída Esperado do Agente

Para cada arquivo modificado, o agente deve:

1. Mostrar o trecho **antes** (com comentário `// ANTES`)
2. Mostrar o trecho **depois** (com comentário `// DEPOIS`)
3. Explicar em 1 linha **o que mudou e por quê**
4. Ao final, listar todos os arquivos alterados

Exemplo de formato:

```
### GlobalSidebar.tsx — Botão de colapsar removido

// ANTES (linhas 160-168):
<button onClick={onToggleCollapse} ...>
  {isCollapsed ? <ChevronRight ... /> : <ChevronLeft ... />}
</button>

// DEPOIS:
[bloco removido]

Motivo: botão não tem função implementada no layout atual, gera confusão visual.
```

---

## Constraints e Regras

- **NUNCA** use `<img>` — sempre `next/image`
- **NUNCA** use `useEffect` para fetch — o tema vem de `useSession()`, não de fetch
- **NUNCA** use `any` no TypeScript — tipar corretamente os novos props
- **NUNCA** altere a lógica de negócio — apenas layout, classes e estrutura visual
- **NUNCA** quebre o comportamento desktop existente ao adicionar responsividade mobile
- **SEMPRE** use classes Tailwind v4 — sem `tailwind.config.js`, tokens via CSS `@theme {}`
- **SEMPRE** use `next/image` com `width` e `height` explícitos
- **SEMPRE** verifique se imports removidos não são usados em outro lugar do arquivo
- Se houver dúvida sobre o valor correto de `tema` (usuário sem tema definido), usar `getTema()` sem argumento → retorna `blue` como padrão

---

## Edge Cases

| Situação | Comportamento esperado |
|----------|----------------------|
| Usuário sem tema definido | `getTema()` sem argumento → retorna tema `blue` por padrão |
| Mobile com sidebar aberta + rotação de tela | Fechar sidebar ao detectar resize para > 768px |
| `isCollapsed = true` quando botão for removido | Forçar `isCollapsed = false` no estado pai, ou ignorar a prop |
| `ChevronLeft`/`ChevronRight` usados em outro lugar no arquivo | Manter o import, só remover o `button` |
| Rodapé muito pequeno em `sm` (640px) | Usar `sm:flex` para que apareça normalmente em tablets e acima |
| Input muito pequeno em mobile após redução | Mínimo de `min-h-[36px]` para manter usabilidade do textarea |

---

## Anti-exemplos

### ❌ Anti-exemplo 1 — Não remova o `isCollapsed` de toda a sidebar

**Situação:** Ao remover o botão, o desenvolvedor decide remover todo o sistema de colapso.

**Resposta ERRADA:**
```tsx
// Remover isCollapsed de GlobalSidebarProps, de todos os ternários...
```

**Por que está errado:** O `isCollapsed` pode ainda ser controlado pelo pai via outro mecanismo. Só remover o botão de UI — não tocar no estado ou nas classes condicionais que dependem dele.

---

### ❌ Anti-exemplo 2 — Não use CSS customizado para o tema quando Tailwind resolve

**Situação:** Aplicar o tema do usuário com `style={{ color: 'blue' }}` hardcoded.

**Resposta ERRADA:**
```tsx
<button style={{ backgroundColor: 'blue' }}>Enviar</button>
```

**Por que está errado:** O tema deve vir de `getTema()`, que retorna classes Tailwind. Usar `tema.bg` como classe, não como valor CSS hardcoded.

---

### ❌ Anti-exemplo 3 — Não esconda o rodapé com `display:none` inline

**Situação:** Esconder rodapé em mobile via JavaScript/estado.

**Resposta ERRADA:**
```tsx
<div style={{ display: isMobile ? 'none' : 'flex' }}>
```

**Por que está errado:** Tailwind tem `hidden sm:flex` exatamente para isso — mais limpo, sem JS, sem layout shift.

---

### ❌ Anti-exemplo 4 — Não use `useEffect` com `window.innerWidth` para decidir layout

**Situação:** Detectar mobile no JS para condicionar renderização.

**Resposta ERRADA:**
```tsx
const [isMobile, setIsMobile] = useState(false);
useEffect(() => {
  setIsMobile(window.innerWidth < 768);
}, []);
```

**Por que está errado:** Causa layout shift (hydration mismatch). Use CSS com classes responsivas do Tailwind sempre que possível. Se precisar de estado JS (sidebar drawer), o estado inicial seguro é `false` para ambos os tamanhos.

---

## Checklist de Qualidade

- [ ] GlobalSidebar: botão de colapsar removido, imports órfãos verificados
- [ ] BibbleChatWindow: rodapé com `hidden sm:flex`, tamanho reduzido
- [ ] BibbleChatInput: padding menor em mobile (`px-3 py-2` em mobile, `sm:px-4 sm:py-3` em desktop)
- [ ] BibbleChatLayout: sidebar vira drawer em mobile com overlay escurecido
- [ ] Tema: `getTema()` aplicado nos elementos visuais do chat (botão de envio, sidebar ativa, etc.)
- [ ] `npx tsc --noEmit` passou sem erros
- [ ] `npm run lint` passou sem warnings
- [ ] Testado visualmente em viewport 375px (iPhone SE)
- [ ] Testado visualmente em viewport 768px (tablet)
- [ ] Comportamento desktop (≥1024px) não foi quebrado

---

## Como Usar este Prompt

**Onde colar:** Início de uma conversa nova com o agente de implementação (Nova ou dev).

**Pré-requisitos:**
- Ter lido `src/lib/temas.ts` para entender a interface `TemaAlpha`
- Ter lido `src/components/BibbleChatHome/BibbleChatLayout.tsx` para entender o layout atual
- Ter lido `src/components/layout/GlobalSidebar.tsx` para localizar o botão a remover

**Variáveis a substituir:** Nenhuma — o prompt é completo e autocontido.

### Uso direto (recomendado)

Cole este prompt inteiro como primeira mensagem para o agente implementador, seguido de:

> "Implemente todos os 4 ajustes. Comece pelo Ajuste 3 (remover botão) pois é o mais simples e confirme antes de prosseguir."

### Uso incremental (se preferir validar um por vez)

1. Primeiro mensagem: "Implemente apenas o Ajuste 3 (remover botão de colapsar da GlobalSidebar)."
2. Segunda mensagem: "Agora Ajuste 4 (rodapé menor + input compacto em mobile)."
3. Terceira mensagem: "Agora Ajuste 1 (responsividade mobile do BibbleChatLayout)."
4. Quarta mensagem: "Finalize com Ajuste 2 (tema do usuário nos componentes do chat)."

### Teste recomendado
Abrir DevTools no Chrome → Toggle device toolbar → iPhone SE (375×667) → navegar para `/PainelAlpha`.
Verificar: layout sem overflow, sidebar abrindo/fechando, rodapé oculto, input usável.
