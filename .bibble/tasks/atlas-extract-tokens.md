# Task: Atlas — Extract Tokens

**Agente:** Atlas  
**Quando usar:** Ao começar um projeto novo ou quando precisa replicar um design existente  
**Output:** Design tokens extraídos e salvos em `.bibble/memory/design-tokens.md`  

---

## Objetivo

Analisar um site, app ou material visual existente, extrair os design tokens (cores, tipografia, espaçamento, raios) e salvar no formato utilizável pelo projeto.

## Inputs

- `source`: URL do site a analisar OU descrição do design a replicar
- `focus`: Áreas de foco (cores, tipografia, spacing, todos)

## Passos

### Passo 1 — Analisar a fonte visual

Se for uma URL:
- Inspecionar o CSS/variáveis do site
- Identificar paleta de cores dominante
- Identificar tipografia usada
- Identificar padrões de espaçamento

Se for uma descrição:
- Inferir estilo a partir dos parâmetros fornecidos

### Passo 2 — Extrair cores

```markdown
### Cores Primárias
- Brand: #[hex] (usado em CTAs principais, links ativos)
- Brand Dark: #[hex] (hover states)
- Brand Light: #[hex] (backgrounds sutis)

### Cores de Status
- Success: #[hex] (verde)
- Warning: #[hex] (amarelo/laranja)
- Error: #[hex] (vermelho)
- Info: #[hex] (azul)

### Cores de Texto
- Primary: #[hex] (texto principal)
- Secondary: #[hex] (texto secundário, muted)
- Disabled: #[hex] (estados disabled)
- Inverted: #[hex] (texto em fundos escuros)

### Cores de Superfície
- Background: #[hex] (fundo principal)
- Surface: #[hex] (cards, panels)
- Border: #[hex] (bordas)
- Overlay: rgba([r],[g],[b],0.5) (modais, overlays)

### Dark Mode (se existir)
- Background Dark: #[hex]
- Surface Dark: #[hex]
- Text Dark: #[hex]
```

### Passo 3 — Extrair tipografia

```markdown
### Fonts
- Primary: [Nome da fonte] — usada em textos gerais
- Display: [Nome da fonte] — usada em headings grandes
- Mono: [Nome da fonte] — usada em código

### Scale de Tamanhos
- xs: [Npx / Nrem]
- sm: [Npx / Nrem]
- base: [Npx / Nrem]
- lg: [Npx / Nrem]
- xl: [Npx / Nrem]
- 2xl: [Npx / Nrem]
- 3xl: [Npx / Nrem]
- 4xl: [Npx / Nrem]

### Font Weights
- Regular: 400
- Medium: 500
- Semibold: 600
- Bold: 700

### Line Heights
- Tight: 1.25
- Normal: 1.5
- Relaxed: 1.75
```

### Passo 4 — Extrair espaçamentos e dimensões

```markdown
### Spacing Scale
- 0: 0
- 1: 4px
- 2: 8px
- 3: 12px
- 4: 16px
- 5: 20px
- 6: 24px
- 8: 32px
- 10: 40px
- 12: 48px
- 16: 64px

### Border Radius
- sm: [Npx]
- md: [Npx]
- lg: [Npx]
- xl: [Npx]
- full: 9999px

### Shadows
- sm: [valor CSS]
- md: [valor CSS]
- lg: [valor CSS]
```

### Passo 5 — Salvar em formato Tailwind v4

```css
/* Para projetos usando Tailwind v4 */
@theme {
  /* Cores */
  --color-brand: [hex];
  --color-brand-dark: [hex];
  --color-brand-light: [hex];
  
  --color-success: [hex];
  --color-warning: [hex];
  --color-error: [hex];
  
  --color-background: [hex];
  --color-surface: [hex];
  --color-border: [hex];
  
  --color-text-primary: [hex];
  --color-text-secondary: [hex];
  
  /* Tipografia */
  --font-primary: '[Font Name]', sans-serif;
  --font-display: '[Font Name]', sans-serif;
  
  /* Raios */
  --radius-sm: [Npx];
  --radius-md: [Npx];
  --radius-lg: [Npx];
}
```

### Passo 6 — Salvar na memória

Salvar tokens extraídos em:
```
.bibble/memory/design-tokens.md
```

E padrões visuais observados em:
```
.bibble/memory/patterns.md
```

## Output

```markdown
## Atlas — Design Tokens Extracted ✅

### Fonte analisada: [URL ou descrição]

### Tokens extraídos
- [N] cores documentadas
- [N] variações tipográficas
- [N] valores de espaçamento
- [N] valores de border-radius

### Arquivos atualizados
- .bibble/memory/design-tokens.md
- .bibble/memory/patterns.md

### Próximos passos
→ Iris pode usar esses tokens para criar wireframes
→ Nova pode usar em src/app/globals.css via @theme {}
```

## Critérios de Sucesso

- Paleta de cores completa documentada
- Tipografia documentada
- Tokens salvos em design-tokens.md
- Formato CSS com variáveis pronto para usar
