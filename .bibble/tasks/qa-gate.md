# Task: QA Gate

**Agente:** Sage  
**Quando usar:** Após Forge aprovar e Probe verificar integration points  
**Output:** Relatório QA com veredicto: PASS / CONCERNS / FAIL  

---

## Objetivo

Validar a qualidade completa da implementação: testes, edge cases, segurança básica, critérios de aceitação e ausência de regressões.

## Pré-condições

- [x] Forge aprovado (build/type/lint)
- [x] Probe aprovado (integration points)
- [x] Anubis aprovado (se código de auth/API/AI)

## Passos

### Passo 1 — Leitura do contexto

```
Ler: blueprint do Scout (se disponível)
Ler: .bibble/memory/known-errors.md
Ler: critérios de aceitação definidos (story/PRD)
```

### Passo 2 — Verificação de testes existentes

```bash
# Verificar se existem testes
ls src/**/*.test.* src/**/*.spec.* tests/**/*

# Rodar testes
npm test -- --passWithNoTests
```

### Passo 3 — Análise de cobertura de casos

Para cada funcionalidade implementada, verificar:

**Fluxos principais:**
- [ ] Happy path funciona?
- [ ] Dados vazios/nulos tratados?
- [ ] Erros do servidor tratados graciosamente?
- [ ] Loading states presentes?

**Validação de inputs:**
- [ ] Input vazio/nulo?
- [ ] Input muito longo (overflow)?
- [ ] Caracteres especiais (<script>, SQL injection)?
- [ ] Tipos errados (string onde espera número)?
- [ ] Boundary values (0, -1, MAX_INT)?

**Concorrência e estado:**
- [ ] Double submit (botão clicado duas vezes)?
- [ ] Race condition em fetches?
- [ ] Estado após erro preservado corretamente?
- [ ] Refresh da página não quebra nada?

**Integração:**
- [ ] Funciona com dados reais do banco?
- [ ] API externa timeout tratado?
- [ ] Funciona sem dados (estado vazio)?

**AI/LLM (se aplicável):**
- [ ] Prompt injection testada?
- [ ] Jailbreak tentado e bloqueado?
- [ ] Tool sem ownership bloqueada?
- [ ] Resposta gigante (context overflow) tratada?

### Passo 4 — Teste de regressão

Verificar features EXISTENTES que podem ter sido quebradas:
- Quais arquivos foram modificados?
- Quais componentes compartilhados foram alterados?
- Testar manualmente ou via testes os fluxos afetados

### Passo 5 — Verificar testes escritos

Se nova feature sem testes, recomendar testes mínimos:

```typescript
// Exemplo de test mínimo obrigatório

// 1. Teste do componente principal
describe('[FeatureName]', () => {
  it('renders without crashing', () => {})
  it('shows loading state', () => {})
  it('shows error state', () => {})
  it('shows data correctly', () => {})
})

// 2. Teste da API (se aplicável)
describe('POST /api/[route]', () => {
  it('returns 401 without auth', () => {})
  it('returns 400 with invalid data', () => {})
  it('returns 201 with valid data', () => {})
  it('returns 403 for wrong userId', () => {})
})
```

### Passo 6 — Veredicto

#### PASS ✅
Todos os critérios críticos atendidos. Pode fazer push.

#### CONCERNS ⚠️
Funciona mas há pontos que merecem atenção. Não bloqueante.

#### FAIL ❌
Bugs encontrados ou critérios críticos não atendidos. Não fazer push.

## Output

```markdown
## QA Gate — Veredicto: [PASS/CONCERNS/FAIL]

### Fluxos testados
- [x] Happy path — [resultado]
- [x] Dados vazios — [resultado]
- [x] Erro de servidor — [resultado]

### Edge cases verificados
- [x] [caso] — [resultado]
- [ ] [caso não testado — motivo]

### Testes automatizados
- [status dos testes existentes]
- [testes recomendados se não existem]

### Regressões
- [x] [feature existente testada] — sem regressão
- [ ] [feature não testada — por quê]

### Issues encontradas
[Listar bugs ou problemas com severidade]
- 🔴 CRÍTICO: [descrição] — arquivo:linha
- 🟡 WARNING: [descrição]
- 🟢 SUGESTÃO: [descrição]

### Ação necessária
→ [O que fazer com base no veredicto]
```

## Critérios de Sucesso

- Todos os fluxos principais testados
- Edge cases documentados (testados ou justificativa de ausência)
- Regressões verificadas
- Veredicto claro com ações necessárias
