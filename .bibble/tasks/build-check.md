# Task: Build Check

**Agente:** Forge  
**Quando usar:** Após implementação, antes de code review  
**Output:** Relatório de aprovação ou lista de erros a corrigir  

---

## Objetivo

Executar os comandos reais de verificação de qualidade técnica. Zero tolerância a erros de tipo, lint ou build.

**REGRA DE OURO: Sempre executar os comandos reais. Nunca "verificação estática" ou "análise visual".**

## Pré-condições

- Implementação completa (ou parcial para verificação intermediária)
- `node_modules` instalado
- `.env` ou `.env.local` com variáveis necessárias (pelo menos as obrigatórias)

## Passos

### Passo 1 — Consultar erros conhecidos

```
Ler: .bibble/memory/known-errors.md
```

Se o erro que aparecerá foi visto antes, aplicar o fix conhecido imediatamente.

### Passo 2 — TypeScript Check

```bash
npx tsc --noEmit
```

**Interpretar resultados:**
- 0 erros → ✅ Prosseguir
- Erros de tipo → ❌ Listar cada erro com arquivo:linha
- `Cannot find module` → Verificar `tsconfig.json` paths e imports

**Erros comuns e fixes:**
```
'any' implícito → Adicionar tipo explícito
Property 'X' does not exist → Verificar interface/tipo
Cannot find name 'X' → Import faltando
Type 'X' is not assignable → Corrigir tipos incompatíveis
```

### Passo 3 — Lint

```bash
npm run lint
```

**Interpretar resultados:**
- 0 warnings/errors → ✅ Prosseguir
- Warnings → Avaliar (críticos precisam ser corrigidos)
- Errors → ❌ Corrigir antes de prosseguir

**Erros comuns:**
```
no-unused-vars → Remover variável ou usá-la
react-hooks/exhaustive-deps → Adicionar dependência no array
no-explicit-any → Substituir por tipo específico
```

### Passo 4 — Build

```bash
npm run build
```

**Interpretar resultados:**
- Build completa sem erros → ✅ Aprovado
- Erros de build → ❌ Listar com contexto
- Warnings de bundle size → Documentar (não bloqueia)

**Erros comuns:**
```
"use client" missing → Adicionar diretiva no componente
Export/Import mismatch → Verificar named vs default exports
Missing env var → Adicionar no .env.example
```

### Passo 5 — (Opcional) Dev server validation

Para mudanças significativas, também verificar que o servidor sobe:

```bash
timeout 30 npm run dev || true
```

Verificar que não há erro na inicialização.

## Outputs

### Aprovado ✅
```markdown
## Forge — Build Check: APROVADO ✅

- TypeScript: 0 erros
- Lint: 0 erros
- Build: Completa sem erros

→ Prosseguir para Probe/Anubis/Lens
```

### Reprovado ❌
```markdown
## Forge — Build Check: REPROVADO ❌

### Erros TypeScript
- src/components/X.tsx:42 — [descrição do erro]
- src/lib/Y.ts:15 — [descrição do erro]

### Erros de Lint
- src/app/Z.tsx:8 — no-unused-vars: 'foo'

### Erros de Build
- [descrição do erro de build]

### Ação necessária
→ Corrigir erros acima e rodar build-check novamente
```

## Critérios de Sucesso

- `npx tsc --noEmit` sem erros
- `npm run lint` sem erros críticos
- `npm run build` completa
- Se reprovado, lista clara de erros com arquivo:linha para o desenvolvedor

## Pós-task

Se reprovado: registrar em `.bibble/memory/known-errors.md` se for um erro novo recorrente.
