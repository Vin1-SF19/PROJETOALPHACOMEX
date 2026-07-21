# PATTERNS — Padrões de UX e Visual

> Mantido por: Atlas (visual analyst) e Scribe (cartógrafo)
> Registrar padrões descobertos no projeto ou extraídos de sites de referência.

---

## Padrões de Layout

<!-- Adicionar aqui -->

---

## Padrões de Componentes

<!-- Adicionar aqui -->

---

## Padrões de Animação

### Fundo vivo por módulo (padrão "1 background dedicado por layout.tsx")
**Estreado em:** CheckList (`ChecklistBackground.tsx`, céu estrelado + parallax) — **variação própria em:** Habilitação Radar (2026-07-21, `RadarBackground.tsx`, "Varredura Sonar").

Cada módulo pode ter seu próprio fundo animado com identidade visual própria, aplicado via `layout.tsx` da rota (não afeta o resto do painel). Regra: 100% Framer Motion + CSS (`conic-gradient`, `radial-gradient`), sem canvas/WebGL/Three.js — fundo é decorativo, não vale o custo de GPU. Sempre usa `accentRgb`/`visual.accent` do tema ativo do usuário (`src/lib/temas.ts`), nunca cor fixa. Sempre respeita `useReducedMotion()`.

**Variante "Varredura Sonar" (Habilitação Radar):** anéis concêntricos fixos em `rgba(${accent},0.06-0.12)` + linha de sweep rotativa via `conic-gradient(from Xdeg, transparent, rgba(${accent},0.25), transparent)` girando em loop linear (~6s) + blips (pontos) que picam opacidade 0→1→0 sincronizados com a passagem do sweep. Cards da tela ganham uma linha de scan vertical (accent) que desce no hover, simulando leitura/scanner de documento.

---

## Padrões de Conteúdo

<!-- Adicionar aqui -->
