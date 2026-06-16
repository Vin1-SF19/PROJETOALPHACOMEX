# Task: Session Archive

**Agente:** Kowalski  
**Quando usar:** Ao final de qualquer sessão com trabalho real realizado  
**Output:** Entrada no journal.md e atualização de memória se necessário  

---

## Objetivo

Arquivar o que foi feito nesta sessão no `journal.md` e garantir que decisões importantes foram registradas na memória correta.

## Pré-condições

- Sessão de trabalho concluída
- Trabalho real foi realizado (não apenas conversas)

## Passos

### Passo 1 — Coletar informações da sessão

Perguntar ou inferir:
- O que foi implementado/alterado?
- Quais decisões técnicas foram tomadas?
- Quais erros foram encontrados e como foram resolvidos?
- Quais arquivos foram criados/modificados?
- Algum padrão novo foi estabelecido?

### Passo 2 — Verificar memórias a atualizar

Antes de arquivar, verificar se outras memórias precisam ser atualizadas:

| Memória | Atualizar se... |
|---------|----------------|
| `decisions.md` | Decisão técnica importante tomada |
| `known-errors.md` | Erro novo resolvido |
| `components.md` | Novo componente criado |
| `patterns.md` | Novo padrão de UX estabelecido |
| `architecture.md` | Stack ou schema alterados |
| `integration-points.md` | Novo módulo com integration points |

### Passo 3 — Formatar entrada do journal

```markdown
## Sessão [YYYY-MM-DD] — [Título Descritivo]

**Duração estimada:** [X horas]
**Agentes utilizados:** [Scout, Nova, Echo, Forge, etc.]

### O que foi feito
- [item 1]
- [item 2]
- [item 3]

### Decisões tomadas
- [decisão 1] — motivo: [por quê]
- [decisão 2] — motivo: [por quê]

### Erros encontrados e resolvidos
- [erro] → [fix aplicado]

### Arquivos criados/modificados
- `src/app/[rota]/page.tsx` — [descrição]
- `src/components/[X].tsx` — [descrição]

### Pendente para próxima sessão
- [ ] [item pendente 1]
- [ ] [item pendente 2]

---
```

### Passo 4 — Adicionar ao journal.md

```
Ler: .bibble/memory/journal.md
```

Adicionar a nova entrada no TOPO do arquivo (mais recente primeiro), após o cabeçalho.

### Passo 5 — Atualizar memórias relevantes

Para cada memória identificada no Passo 2:

**decisions.md** — Nova decisão:
```markdown
## [Data] — [Título da Decisão]
**Decisão:** [O que foi decidido]
**Motivo:** [Por que esta foi a escolha]
**Alternativas rejeitadas:** [O que foi considerado e descartado]
```

**known-errors.md** — Novo erro:
```markdown
## Erro: [Mensagem de erro]
**Contexto:** [quando acontece]
**Causa:** [por que acontece]
**Fix:** [como resolver]
**Data:** [YYYY-MM-DD]
```

**components.md** — Novo componente:
```markdown
### [ComponentName]
- **Localização:** `src/components/[path]`
- **Uso:** [quando usar]
- **Props principais:** [props importantes]
- **Exemplo:** `<ComponentName prop="value" />`
```

## Output

```markdown
## Kowalski — Session Archived ✅

**Sessão:** [título]
**Data:** [YYYY-MM-DD HH:MM]

### Registros criados/atualizados
- journal.md — Nova entrada adicionada
- [decisions.md — N decisão nova] (se aplicável)
- [known-errors.md — N erro novo] (se aplicável)
- [components.md — N componente novo] (se aplicável)

### Resumo em uma linha
[O que foi feito nesta sessão em uma frase]
```

## Critérios de Sucesso

- Entrada adicionada ao journal.md com data correta
- Decisões importantes registradas em decisions.md
- Erros novos em known-errors.md (para não debugar de novo)
- Componentes novos em components.md
- Sessão pode ser entendida por quem ler o journal no futuro
