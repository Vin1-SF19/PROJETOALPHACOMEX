# Workflow: QA Loop

**Trigger:** Sage reprovou (FAIL) ou há issues críticas do Lens  
**Responsável:** Bibble orquestra loop entre Sage e Dev  
**Máximo de iterações:** 5  

---

## Descrição

Loop iterativo entre revisão de QA e correção de código. Continua até aprovação ou escalação após 5 iterações.

## Fluxo

```
Sage FAIL → Dev corrige → Forge → Sage re-review → PASS? → DevOps push
                                                   ↓ FAIL (max 5x)
                                                   Escalar para usuário
```

## Iterações

### Iteração 1 — Diagnóstico e Correção

**Sage** entrega relatório detalhado:
```markdown
## QA Loop — Iteração 1

### Issues críticas a corrigir
1. [arquivo:linha] — [descrição] — severidade: 🔴
2. [arquivo:linha] — [descrição] — severidade: 🔴

### Issues importantes (se tempo permitir)
1. [arquivo:linha] — [descrição] — severidade: 🟡

### O que NÃO corrigir neste loop
- Issues 🟢 aguardam próxima story
```

**Dev** (Nova/Echo) corrige issues críticas.

**Forge** valida correções:
```bash
npx tsc --noEmit && npm run lint && npm run build
```

### Iteração 2-4 — Re-review

Sage re-executa checklist focado nas issues anteriores:
- Issues 🔴 foram resolvidas?
- Novas issues 🔴 foram introduzidas?

### Iteração 5 — Limite atingido

Se após 5 iterações ainda há issues 🔴:

```markdown
## QA Loop — LIMITE ATINGIDO

### 5 iterações concluídas sem convergência

### Issues persistentes
- [lista de issues não resolvidas]

### Motivo estimado
- [explicação técnica do por que não resolve]

### Opções para o usuário
1. Aceitar com ressalvas documentadas (issues no backlog)
2. Refatorar a abordagem completamente
3. Dividir em stories menores

### Recomendação
[Qual opção Sage/Bibble recomendam]
```

**Aguardar decisão do usuário antes de prosseguir.**

## Estado do Loop

```yaml
# Estado salvo em .bibble/memory/session-draft.md durante o loop
qa_loop:
  story: "[identificador]"
  iteration: 1
  status: in_progress | completed | escalated
  issues_critical: 2
  issues_warning: 3
  last_updated: "YYYY-MM-DD HH:MM"
```

## Critérios de Saída

| Condição | Saída |
|----------|-------|
| Zero issues 🔴 | PASS → DevOps pode fazer push |
| Issues só 🟡/🟢 | PASS com ressalvas documentadas |
| 5 iterações, ainda há 🔴 | Escalar para usuário |
| Usuário quer aceitar com dívida | Documentar em decisions.md e fazer push |

## Comandos Rápidos

```
/sage *qa-loop-review  → Sage faz nova revisão
/nova *apply-qa-fixes  → Nova aplica fixes sugeridos
/echo *apply-qa-fixes  → Echo aplica fixes sugeridos
/forge *build-check    → Forge valida após correções
```
