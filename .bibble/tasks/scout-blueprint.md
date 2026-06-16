# Task: Scout Blueprint

**Agente:** Scout  
**Quando usar:** OBRIGATÓRIO antes de qualquer implementação  
**Output:** Blueprint escrito com integration points mapeados  

---

## Objetivo

Ler o código existente, mapear todos os pontos de integração e entregar um blueprint claro que a squad técnica seguirá durante a implementação.

## Inputs Necessários

- `feature`: Descrição da feature a ser implementada
- `areas`: Áreas do código que serão afetadas (opcional — Scout descobre)

## Passos

### Passo 1 — Ler memória do projeto
```
Ler: .bibble/memory/architecture.md
Ler: .bibble/memory/codebase-map.md
Ler: .bibble/memory/integration-points.md
Ler: .bibble/memory/components.md
```

### Passo 2 — Mapear código relacionado

Para a feature solicitada, identificar e ler:
- Páginas/rotas que serão criadas ou modificadas
- Componentes existentes que podem ser reutilizados
- API routes e Server Actions existentes
- Schema do banco (se banco será afetado)
- Configurações de menu, sidebar, atalhos
- Arquivos de permissões e autenticação

### Passo 3 — Identificar integration points

Verificar obrigatoriamente:
- [ ] **Menu/Navegação** — onde a feature aparecerá na navegação
- [ ] **Permissões** — qual role tem acesso? Como está configurado no projeto?
- [ ] **Atalhos** — existe sistema de atalhos que precisa ser atualizado?
- [ ] **Rota** — qual será a URL da feature?
- [ ] **Sidebar** — aparece na sidebar? Qual item?
- [ ] **Auth** — rota protegida? Como verificar auth neste projeto?
- [ ] **Registro de módulos** — existe registro manual de módulos? (ex: arrays de módulos)

### Passo 4 — Identificar componentes reutilizáveis

Antes de criar algo novo, Scout DEVE verificar:
- `src/components/` — componentes existentes
- `.bibble/memory/components.md` — catálogo de componentes

### Passo 5 — Entregar o Blueprint

Formato obrigatório do blueprint:

```markdown
## Blueprint: [Nome da Feature]

### Contexto
[Breve descrição do que foi encontrado no código]

### O que será criado
- [arquivo/componente 1] — [propósito]
- [arquivo/componente 2] — [propósito]

### O que será modificado
- [arquivo existente] — [o que muda]
- [arquivo existente] — [o que muda]

### Integration Points (CHECKLIST)
- [ ] Menu: adicionar em [arquivo:linha] — entrada `{ id, label, icon, href }`
- [ ] Permissões: adicionar em [arquivo:linha] — entrada `{ id, label }`
- [ ] Rota: criar [src/app/caminho/page.tsx]
- [ ] Auth: proteger com [método de auth do projeto]
- [ ] Registro de módulo: [arquivo se existir]

### Componentes Reutilizáveis
- [ComponenteX] de [caminho] — usar para [propósito]
- [ComponenteY] de [caminho] — usar para [propósito]

### Componentes a criar
- [NomeComponente] — [descrição do que faz]

### Ordem de implementação
1. [primeiro passo]
2. [segundo passo]
3. [terceiro passo]

### ⚠️ Atenções
- [risco ou ponto de atenção]
- [dependência não óbvia]
```

## Outputs

- `blueprint.md` — arquivo escrito ou resposta estruturada
- Integration points checklist para ser seguido por Probe no final

## Critérios de Sucesso

- Blueprint escrito com todos os arquivos identificados
- Integration points todos listados com caminhos exatos (arquivo:linha)
- Componentes reutilizáveis identificados
- Ordem de implementação clara
- Nenhuma implementação começa sem este output
