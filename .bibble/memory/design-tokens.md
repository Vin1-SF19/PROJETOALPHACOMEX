# DESIGN TOKENS — Cores, Tipografia, Espaçamento

> Mantido por: Atlas (visual analyst) e Scribe (cartógrafo)
> Fonte de verdade para Nova e qualquer agente que crie componentes visuais.

---

## Sistema de temas (accent color)

Fonte: `src/lib/temas.ts` (`CONFIG_TEMAS`). Cada tema tem `text`, `bg`, `border`, `glow`, `shadow`, `accent` (RGB cru). Indigo/`midnight` é o padrão mais usado no painel — accent real: `rgb(79, 70, 229)` (tema `midnight`) ou `rgb(37, 99, 235)` (tema `blue`).

## Cores

| Token | Valor | Uso |
|-------|-------|-----|
| Fundo base | `#020617` (slate-950) | Fundo de página em todos os módulos dark |
| Card padrão | `bg-slate-900/30` a `/40` | Cards de conteúdo sobre fundo escuro |
| Card "vidro sobre hero" | `bg-slate-950/70` + `backdrop-blur-2xl` | Painel de conteúdo sobre background vivo (shader) — ver padrão "Aurora Financeira" |
| Borda | `border-white/5` | Padrão em quase todo card do painel |
| Accent indigo | `rgb(99, 102, 241)` / `text-indigo-400/500` | Cor de destaque mais comum |

## Border Radius
- Cards grandes: `rounded-[2.5rem]` a `rounded-[3rem]`
- Botões/inputs: `rounded-xl` a `rounded-2xl`

---

## Padrão "Aurora Financeira" (aprovado pelo usuário em 2026-07-09 para Extratos Bancários)

Direção visual para repaginação de módulos que precisam de identidade forte sem perder legibilidade de dados densos (tabelas financeiras).

### Background shader como elemento hero
- `AnimatedShaderBackground` (`src/components/ui/animated-shader-background.tsx`) usado em tela cheia (`fixed inset-0`), com amplitude real (`gl_FragColor = o * 0.9`, não `* 0.4` — o multiplicador baixo "apaga" o efeito e o usuário rejeitou isso como "mínimo").
- **Regra de legibilidade**: nunca colocar o shader atrás de conteúdo denso (tabelas) sem uma camada de vidro mais opaca por cima (`bg-slate-950/70 backdrop-blur-2xl`, não o `/30` padrão) — o shader "respira" nas bordas/vazios da tela, a camada de trabalho fica legível por cima.
- Em telas de detalhe com tabelas muito densas (ex: `ExtratoDetalhe`), preferir um gradiente radial estático mais discreto em vez do shader animado completo — evita competir com a leitura de números.

### Transição de página (layoutId morphing)
Card da listagem e header do detalhe compartilham o mesmo `layoutId` do Framer Motion (`empresa-card-${id}`) — o elemento "morpha" visualmente entre as duas rotas em vez de um corte seco. Acompanhar com `AnimatePresence mode="wait"` no layout do módulo.

### Modais com profundidade 3D
```tsx
const modalVariants = {
  hidden: { opacity: 0, rotateX: -15, y: 40, scale: 0.92 },
  visible: { opacity: 1, rotateX: 0, y: 0, scale: 1, transition: { type: "spring", damping: 22, stiffness: 220 } },
  exit: { opacity: 0, rotateX: 12, y: -20, scale: 0.95, transition: { duration: 0.2 } },
};
// Wrapper precisa de perspective:
<div style={{ perspective: 1200 }}>
  <motion.div variants={modalVariants} style={{ transformStyle: "preserve-3d" }} />
</div>
```
Substituiu o padrão anterior de fade+scale simples (`initial={{opacity:0,scale:0.95}}`) — considerado "mínimo" pelo usuário.

### Micro-interações
- Cards de stats: `whileHover={{ y: -4, rotateX: 4, rotateY: -4 }}` com `perspective` no container pai (tilt 3D sutil).
- Botão primário: spotlight que segue o cursor (gradiente radial via `mousemove`).
- Linhas de tabela: stagger de entrada (`staggerChildren: 0.03`) na primeira carga.

**Contexto da decisão:** usuário rejeitou explicitamente a primeira versão do redesign (shader discreto atrás da tabela, modais com fade simples) como "mudanças mínimas" — pediu "repaginada total", liberdade para "inventar", e citou explicitamente "modelagem com framer-motion 3d". Ver `decisions.md` e `journal.md` (2026-07-09, segunda entrada).

---

## Padrão "Atelier" (Alpha Blueprint, 2026-07-27 — Iris)

Direção visual escolhida para o módulo Alpha Blueprint (central de especificação de sistemas). Mood: estúdio de arquitetura à noite — glass + profundidade sutil, mas contido; o canvas/editor são ferramentas de trabalho, não hero visual.

- **Regra de legibilidade estendida do Aurora Financeira**: canvas e editor NUNCA têm fundo shader atrás — fundo liso `#020617` com gradiente radial estático discreto nos cantos vazios (mesmo tratamento de `ExtratoDetalhe`).
- **Prioridade não é só cor**: todo indicador de prioridade/status leva ÍCONE + texto, nunca cor isolada (acessibilidade).
- **Barra de status de salvamento**: sempre ícone + texto (`Salvando.../Salvo/Alterações pendentes/Erro ao salvar`), erro nunca é só um toast que some.
- **Canvas (`@xyflow/react`)**: seleção de node via borda accent + glow externo sutil (nunca preenchimento sólido); conectores bezier nativos, texto do conector em pill pequeno; frames de wireframe com "barra de título" de janela (3 dots decorativos + nome da tela).
- **Onboarding**: spotlight com overlay `bg-black/70` + recorte no elemento em foco, tooltip `bg-slate-900/95 backdrop-blur-xl`, progresso via dots (não "3/12" cru), entrada leve (fade+scale 0.96→1, sem spring 3D pesado).
- **Mobile**: Kanban vira lista vertical (sem drag-and-drop — menu "Mover para..."), canvas avisa "melhor em telas maiores" mas nunca bloqueia.

Ver especificação completa entregue por Iris na fase 03 da fila `prompt-phases/` (arquivada em `journal.md` ao final do projeto).

---

## Padrão "Ledger Vivo" (Gestão de Comissões e Prêmios, 2026-07-28 — Iris)

Direção visual escolhida para o módulo de Comissões e Prêmios. Mood: terminal financeiro de alta densidade — prioriza escaneabilidade de números sobre efeito visual (o financeiro consulta esta tela várias vezes ao dia). Reutiliza a estrutura real do `GlowCard` (`ChecklistView.tsx:455`, `rgba(15,23,42,0.82)` + `backdrop-blur-24px`, glow radial de 280px seguindo o mouse), que é a implementação real por trás do que o prompt do usuário chamou de "Big Card" — não existe componente literalmente chamado "Big Card" no projeto.

- **Sem fundo vivo/shader animado** — fundo `#020617` liso. Dados financeiros densos não competem com hero visual (mesma regra já aplicada a `ExtratoDetalhe`/canvas do Alpha Blueprint).
- **Faixa de identificação do tipo de evento**: 4px sólida no topo do card — azul `rgb(37,99,235)` para CONTRATAÇÃO, verde `rgb(16,185,129)` para ÊXITO. Identificação instantânea sem precisar ler o badge de texto.
- **`EventoComissaoCard`** (nome real do componente equivalente ao "Big Card"): grid `md:grid-cols-[1.2fr_1fr_1fr]` (dados da empresa | Comercial | Operacional) no desktop; empilha verticalmente em mobile (dados → Comercial → Operacional em sequência).
- **Valores monetários sempre em `tabular-nums`**, alinhados à direita — regra obrigatória em qualquer tela nova que liste dinheiro neste módulo.
- **`LancamentoColaboradorCard`** (mini card): layout horizontal — avatar/iniciais (28px, circle, cor do accent do tema) à esquerda, nome+cargo ao centro, valores (comissão/DSR/prêmio/total) à direita com o total em destaque. Status SEMPRE como dot colorido + label textual, nunca só cor (regra de acessibilidade já estabelecida no Alpha Blueprint, replicada aqui).
- **Cores de status** (usar tokens já existentes de `CONFIG_TEMAS`, nunca hex isolado): pago = `emerald-500`, pendente = `amber-500`, vencido/bloqueado/divergente = `rose-500`.
- **Animação**: entry `fade + y:12→0` com stagger 0.04s entre mini cards (mesmo padrão de tabela do Aurora Financeira); hover no mini card = `translateY(-2px)` + barra de 2px na cor do status na borda esquerda; SEM tilt 3D nem glow-mouse por mini card individual (só o card de evento inteiro herda o glow do `GlowCard` — mini cards densos não devem competir por atenção visual).
- **Rodapé do card de evento**: barra fina `border-t border-white/5`, total geral à direita em fonte grande `tabular-nums`, botão "Marcar todos como pagos" à esquerda (outline, preenche só no hover).

Ver especificação completa (3 opções apresentadas, A escolhida) na Fase 03 da fila `prompt-phases/`.

---

## Padrão "Sidebar sobre background vivo" (Alpha CRM, 2026-08-17 — Scribe)

Extensão do padrão "vidro sobre hero" do Aurora Financeira, aplicada especificamente a sidebars de módulos que possuem background animado próprio.

**Regra:** quando um módulo tem um `Background` animado (ex: `CrmSpaceBackground`) posicionado em `absolute inset-0 z-0` do root, a sidebar **nunca** usa fundo opaco (`bg-slate-950`) — isso "corta" o background e cria descontinuidade visual.

**Implementação aprovada (RM-2026-4F34CC, rodada 2 — FlowButton):**
- `<aside>`: `bg-slate-950/20 backdrop-blur-md` (translúcido + blur moderado — o `CrmSpaceBackground` é visível através da sidebar)
- Mobile top bar: mesmo tratamento (`bg-slate-950/20 backdrop-blur-md`)
- Botões NAV: componente **`FlowButton`** (`src/components/ui/flow-button.tsx`) — transições 700ms `cubic-bezier(0.22,1,0.36,1)`, borda transparente→preenchida no hover, mudança de cor do texto, seta decorativa que desliza, ponto decorativo que escala, `active:scale-[0.97]`
- Espaçamento entre botões: `space-y-2` (8px)
- Item ativo: `background: rgba(accent,0.1)`, `borderColor: rgba(accent,0.25)`, `color: rgb(accent)`, `boxShadow: 0 0 20px rgba(accent,0.06)` (via `style` inline com accent do tema)
- `aria-current="page"` quando ativo

**Arquivo de referência:** `src/app/PainelAlpha/AlphaCRM/CRMLayoutClient.tsx` + `src/components/ui/flow-button.tsx`

**Última atualização:** 2026-08-17 por Scribe (rodada 2 — FlowButton)
