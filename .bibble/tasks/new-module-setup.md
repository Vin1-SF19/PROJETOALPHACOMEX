# Task: New Module Setup

**Agente:** Scout (mapeia) → Nova/Echo (implementa) → Scribe (registra)  
**Quando usar:** Ao criar um módulo completamente novo no sistema  
**Output:** Módulo com todos os integration points configurados  

---

## Objetivo

Garantir que um módulo novo seja criado com TODOS os pontos de integração configurados. Módulo sem integration points = módulo invisível para o usuário.

## Por Que Esta Task Existe

Em projetos com registro manual de módulos (arrays independentes de menu, atalhos, permissões), é muito fácil criar a página mas esquecer de:
- Adicionar no menu de navegação
- Adicionar nos atalhos do usuário
- Adicionar nas permissões por role
- Registrar na lista de módulos do sistema

## Pré-condições

- Scout blueprint entregue
- Integration points identificados em `.bibble/memory/integration-points.md`

## Passos

### Passo 1 — Scout mapeia todos os pontos de registro

Identificar em `.bibble/memory/integration-points.md`:
- Onde fica o menu/navegação?
- Existe sistema de atalhos? Onde fica o array?
- Existe sistema de permissões por role? Onde fica?
- Existe registro central de módulos?

Se `integration-points.md` estiver vazio, Scout DEVE ler o código e descobrir.

### Passo 2 — Checklist de integration points

Antes de criar qualquer arquivo de página:

- [ ] **Navegação/Menu** — arquivo identificado, entrada adicionada
- [ ] **Atalhos** — arquivo identificado, entrada adicionada (se existe)
- [ ] **Permissões** — arquivo identificado, entrada adicionada
- [ ] **Registro de módulos** — arquivo identificado, entrada adicionada (se existe)
- [ ] **Rota** — URL definida e consistente com padrão do projeto

### Passo 3 — Criar a página e seus arquivos

Somente após Passo 2 concluído:

```
src/app/[nome-modulo]/
├── page.tsx              # Página principal
├── layout.tsx            # Layout se necessário
└── [sub-rotas]/          # Sub-páginas

src/components/[NomeModulo]/
├── [NomeModulo].tsx      # Componente principal
└── [sub-componentes]     # Componentes auxiliares

src/app/api/[nome-modulo]/
└── route.ts              # API routes se necessário

src/actions/
└── [nome-modulo].ts      # Server Actions se necessário
```

### Passo 4 — Template de página

```tsx
// src/app/[nome-modulo]/page.tsx
import { auth } from '@/auth' // ou método de auth do projeto
import { redirect } from 'next/navigation'

export const metadata = {
  title: '[Nome do Módulo]',
}

export default async function [NomeModulo]Page() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div>
      <h1>[Nome do Módulo]</h1>
      {/* Conteúdo */}
    </div>
  )
}
```

### Passo 5 — Scribe registra os integration points

Após módulo criado, Scribe atualiza:

```markdown
// .bibble/memory/integration-points.md

## Módulo: [NomeModulo]
**Rota:** /[nome-modulo]
**Descrição:** [o que o módulo faz]

### Integration Points
- Menu: [arquivo] linha [N] — `{ id: "[id]", label: "[label]", href: "/[rota]" }`
- Atalhos: [arquivo] linha [N] — `{ id: "[id]", title: "[title]" }`
- Permissões: [arquivo] linha [N] — `{ id: "[id]", label: "[label]" }`
```

## Output

```markdown
## New Module Setup — Concluído ✅

### Módulo: [Nome]
### Rota: /[caminho]

### Integration Points configurados
- [x] Menu/Navegação — [arquivo]
- [x] Atalhos — [arquivo]
- [x] Permissões — [arquivo]
- [x] Rota criada e protegida

### Arquivos criados
- [lista de arquivos]

### Próximos passos
- Forge: validar build
- Probe: verificar que aparece onde deve aparecer
```

## Critérios de Sucesso

- Módulo aparece no menu de navegação
- Módulo acessível via rota definida
- Permissões configuradas corretamente
- Scribe atualizou integration-points.md
- Nenhum integration point esquecido
