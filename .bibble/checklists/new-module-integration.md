# Checklist: New Module Integration Points

**Usado por:** Scout (mapeia), Probe (verifica), Scribe (documenta)  
**Quando:** AO CRIAR qualquer módulo novo — antes de escrever a primeira linha de código  

---

## Por Que Este Checklist Existe

Módulos têm pontos de integração em arquivos separados que NÃO se auto-sincronizam.
Esquecer qualquer um = módulo que existe no código mas é invisível para o usuário.

---

## Passo 1 — Scout Identifica os Arquivos

Antes de implementar, Scout DEVE confirmar onde estão:

| Integration Point | Arquivo | Variável/Array | Confirmado |
|------------------|---------|----------------|-----------|
| Navegação/Menu | `[arquivo]` | `[variável]` | [ ] |
| Sidebar | `[arquivo]` | `[variável]` | [ ] |
| Atalhos | `[arquivo]` | `[variável]` | [ ] |
| Permissões/Roles | `[arquivo]` | `[variável]` | [ ] |
| Registro de módulos | `[arquivo]` | `[variável]` | [ ] |
| Breadcrumbs | `[arquivo]` | `[variável]` | [ ] |
| Search/Busca | `[arquivo]` | `[variável]` | [ ] |

*Preencher com os caminhos reais do projeto. N/A se não existe.*

---

## Passo 2 — Dados do Novo Módulo

Definir antes de implementar:

```
Nome: [Nome do módulo]
ID: [id-unico-kebab-case]
Rota: /[caminho]
Ícone: [nome do ícone Lucide ou arquivo de imagem]
Descrição curta: [1 frase]
Role necessária: [admin/user/todos]
```

---

## Passo 3 — Checklist de Implementação

### Navegação / Menu
- [ ] Identificado arquivo correto
- [ ] Entrada adicionada: `{ id: "[id]", label: "[Nome]", href: "/[rota]", icon: [Icon] }`
- [ ] Ordem/posição definida (não apenas jogado no final)

### Sidebar (se aplicável)
- [ ] Item adicionado no lugar correto
- [ ] Ícone correto
- [ ] Rota correta
- [ ] Label correto

### Atalhos (se o projeto usa)
- [ ] Arquivo identificado
- [ ] Entrada adicionada: `{ id: "[id]", title: "[Nome]", href: "/[rota]" }`
- [ ] Imagem/ícone referenciada existe em `public/`

### Permissões / Roles (se o projeto usa)
- [ ] Sistema de permissões identificado
- [ ] Entrada adicionada: `{ id: "[id]", label: "[Nome do módulo]" }`
- [ ] Role padrão definida (admin? user? todos?)

### Registro Central de Módulos (se existe)
- [ ] Array de módulos identificado
- [ ] Entrada adicionada com todos os campos obrigatórios

### Rota / Página
- [ ] Arquivo criado: `src/app/[rota]/page.tsx`
- [ ] Rota protegida com auth
- [ ] metadata com título correto
- [ ] Layout configurado (se necessário)

### Breadcrumbs (se o projeto usa)
- [ ] Entrada adicionada no sistema de breadcrumbs
- [ ] Hierarquia correta (onde encaixa na árvore de navegação)

---

## Passo 4 — Probe Verifica

Após implementação, Probe confirma visualmente:

- [ ] Módulo aparece no menu/sidebar
- [ ] Clique no menu navega para a rota correta
- [ ] Rota `/[caminho]` carrega sem erro 404
- [ ] Usuário sem permissão recebe 403 (não vê o módulo)
- [ ] Usuário com permissão vê o módulo
- [ ] Atalho funciona (se aplicável)

---

## Passo 5 — Scribe Documenta

Scribe adiciona em `.bibble/memory/integration-points.md`:

```markdown
## Módulo: [NomeModulo]

**Rota:** /[caminho]
**ID:** [id]
**Descrição:** [o que o módulo faz]
**Role:** [quem pode acessar]
**Data de criação:** [YYYY-MM-DD]

### Integration Points Configurados
- Menu: [arquivo] — linha [N]
- Sidebar: [arquivo] — linha [N]
- Atalhos: [arquivo] — linha [N]
- Permissões: [arquivo] — linha [N]
- Rota: src/app/[caminho]/page.tsx
```

---

## Resultado

**Todos os itens ✅:** Módulo integrado corretamente → usuário pode ver e usar  
**Qualquer item ❌:** Módulo pode estar invisível ou quebrado
