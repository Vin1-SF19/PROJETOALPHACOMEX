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
