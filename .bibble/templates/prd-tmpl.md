# PRD: [NOME DA FEATURE]

**Versão:** 1.0  
**Autor:** PM  
**Data:** [YYYY-MM-DD]  
**Status:** Draft | Aprovado | Em Desenvolvimento | Concluído  

---

## Sumário Executivo

[2-3 parágrafos: o que é esta feature, por que existe, quem se beneficia e qual o impacto esperado]

---

## Problema

[Describe o problema atual do ponto de vista do usuário. O que está errado? O que falta? Qual a dor?]

**Evidências do problema:**
- [dado, feedback, observação]
- [dado, feedback, observação]

---

## Solução Proposta

[Descrever a solução em linguagem de produto, não de implementação. O que o usuário vai poder fazer que não pode hoje?]

---

## Usuários Afetados

| Persona | Como é afetada |
|---------|---------------|
| [Admin] | [descrição] |
| [Usuário Final] | [descrição] |

---

## Objetivos e Métricas de Sucesso

| Objetivo | Métrica | Baseline | Meta |
|----------|---------|----------|------|
| [objetivo] | [como medir] | [valor atual] | [valor alvo] |
| | | | |

---

## Funcionalidades

### Deve ter (Must Have) — V1

- **FR-001:** [descrição do requisito funcional]
- **FR-002:** [descrição]
- **FR-003:** [descrição]

### Deveria ter (Should Have) — V1 se tempo permitir

- **FR-010:** [descrição]
- **FR-011:** [descrição]

### Poderia ter (Could Have) — V2+

- **FR-020:** [descrição]
- **FR-021:** [descrição]

---

## Não-Funcional

- **NFR-001: Performance** — [especificação, ex: "resposta em < 200ms para 95% dos requests"]
- **NFR-002: Segurança** — [especificação, ex: "dados isolados por usuário, ownership obrigatório"]
- **NFR-003: Disponibilidade** — [especificação se necessário]
- **NFR-004: Escalabilidade** — [especificação se necessário]

---

## Fora do Escopo (Esta Versão)

- [Feature que parece relacionada mas não fará parte]
- [Integração com X — será avaliada no V2]
- [Migração de dados legados — story separada]

---

## Fluxos do Usuário

### Fluxo Principal: [Nome do fluxo]

```
[Usuário] → [ação 1] → [estado 1] → [ação 2] → [resultado]
```

1. Usuário acessa [rota]
2. Vê [tela/componente]
3. Realiza [ação]
4. Sistema processa [o quê]
5. Usuário vê [resultado]

### Fluxo de Erro: [Nome]

```
[Usuário] → [ação] → [erro] → [mensagem] → [recuperação]
```

---

## Dependências

| Dependência | Tipo | Status | Dono |
|-------------|------|--------|------|
| [Feature X] | Feature interna | [status] | [agente] |
| [API Y] | Integração externa | [status] | [equipe] |

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| [risco] | Alta/Média/Baixa | Alto/Médio/Baixo | [como mitigar] |

---

## Estimativa de Complexidade

Score RICE:
- **Reach:** [N] usuários/mês
- **Impact:** [1-5x]
- **Confidence:** [50-100%]
- **Effort:** [N dias]
- **RICE Score:** [R × I × C / E]

Complexidade estimada: Simples (1-2 stories) | Médio (3-5 stories) | Complexo (epic)

---

## Stories Derivadas

[Preencher após aprovação do PRD]

- [ ] Story 1: [título]
- [ ] Story 2: [título]
- [ ] Story 3: [título]

---

## Histórico de Revisões

| Versão | Data | Autor | Mudanças |
|--------|------|-------|---------|
| 1.0 | [data] | PM | Versão inicial |
