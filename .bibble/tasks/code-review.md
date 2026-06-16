# Task: Code Review

**Agente:** Lens  
**Quando usar:** Após Forge APROVAR — nunca antes  
**Output:** Relatório de revisão com classificação 🔴🟡🟢  

---

## Objetivo

Revisar a qualidade do código implementado: segurança, correção, arquitetura, performance e manutenibilidade.

## Pré-condições

- [x] Forge APROVADO (obrigatório — sem isso, Lens não revisa)
- Código implementado e testando

## Passos

### Passo 1 — Listar arquivos para revisar

Solicitar ou identificar a lista de arquivos criados/modificados.

### Passo 2 — Revisão em 5 dimensões

#### Dimensão 1: Segurança 🔴 (crítico se falhar)

- Auth verificado em todas as rotas?
- Ownership check em todos os recursos?
- Secrets via env vars?
- Inputs validados com Zod?
- XSS prevenido?
- SQL/injection prevenido?

#### Dimensão 2: Correção 🔴 (crítico se falhar)

- Lógica resolve o problema especificado?
- Edge cases tratados (null, undefined, array vazio)?
- Erros capturados e tratados graciosamente?
- Estados de loading/error/empty presentes?
- TypeScript sem `any`?

#### Dimensão 3: Arquitetura 🟡 (importante)

- Responsabilidades bem separadas?
- Componente faz uma coisa bem (single responsibility)?
- Server vs Client components corretamente divididos?
- Reutilização de código aproveitada (componentes existentes usados)?
- Abstrações prematuras evitadas?
- Sem over-engineering?

#### Dimensão 4: Performance 🟡 (importante)

- N+1 queries presentes?
- Renders desnecessários (missing memo, useCallback)?
- Imports pesados carregados sem necessidade?
- Imagens sem `next/image`?
- Bundle size impactado significativamente?

#### Dimensão 5: Manutenibilidade 🟢 (sugestão)

- Nomes de variáveis/funções descritivos?
- Funções com mais de 50 linhas (candidatas a extração)?
- Código duplicado que poderia ser extraído?
- Comentários explicam o "por quê" (não o "o quê")?
- TODO/FIXME sem prazo ou contexto?

### Passo 3 — Verificar padrões do projeto

```
Ler: .bibble/rules/nextjs-rules.md
Ler: .bibble/rules/component-rules.md
Ler: .bibble/memory/patterns.md
```

- O código segue os padrões estabelecidos?
- Usa as mesmas convenções dos arquivos vizinhos?
- Nomenclatura consistente com o projeto?

### Passo 4 — Classificar e relatar

Para cada issue encontrada:
- 🔴 **CRÍTICO** — DEVE ser corrigido antes do push (segurança, bug, dados errados)
- 🟡 **IMPORTANTE** — DEVERIA ser corrigido neste PR (arquitetura, performance)
- 🟢 **SUGESTÃO** — PODE ser feito depois (style, manutenibilidade)

## Output

```markdown
## Lens — Code Review

### Arquivos revisados
- [arquivo 1]
- [arquivo 2]

### Issues encontradas

#### 🔴 CRÍTICO — Deve corrigir antes do push
- **[arquivo:linha]** — [descrição do problema]
  ```typescript
  // Atual (problemático)
  [código atual]
  
  // Sugerido
  [código corrigido]
  ```

#### 🟡 IMPORTANTE — Deveria corrigir
- **[arquivo:linha]** — [descrição]

#### 🟢 SUGESTÃO — Pode fazer depois
- **[arquivo:linha]** — [observação]

### Pontos positivos
- [algo bem feito]

### Veredicto
[APROVADO / APROVADO COM RESSALVAS / REPROVADO]

Total issues: [N] críticos, [N] importantes, [N] sugestões
→ [Ação necessária]
```

## Critérios de Sucesso

- Todos os arquivos relevantes revisados
- Issues classificadas por severidade
- Sugestões de código para issues críticas
- Veredicto claro
- Pontos positivos reconhecidos (não apenas críticas)
