# Workflow: Feature Completa

**Trigger:** Qualquer nova feature de tamanho médio a grande  
**Responsável:** Bibble (orquestra), todos os agentes especializados  
**Duração estimada:** Variável (1-8 horas dependendo da complexidade)  

---

## Descrição

Workflow completo para implementar uma feature do zero, garantindo qualidade em todas as etapas: reconhecimento do código, implementação, verificação técnica, integração, segurança, revisão e arquivamento.

## Fluxo

```
Scout → Nova/Echo/Iris → Vault? → Forge → Probe → Anubis? → Lens → Sage → Scribe → Kowalski
```

## Fases

### Fase 1 — Reconhecimento (Scout)

**Task:** `tasks/scout-blueprint.md`

- Scout lê o código relacionado
- Mapeia todos os integration points
- Identifica componentes reutilizáveis
- Entrega blueprint escrito

**Gate:** Blueprint entregue com todos os integration points listados

---

### Fase 2 — Implementação

**Tasks:** `tasks/dev-develop.md`

**Qual agente?**
- Feature tem UI? → **Nova** (frontend)
- Feature tem API/backend? → **Echo** (backend)
- Feature tem design complexo? → **Iris** faz spec primeiro → **Nova** implementa
- Feature afeta banco? → **DataEngineer** modela schema → **Vault** valida → implementação

**Regras:**
- Seguir blueprint do Scout à risca
- Não adicionar features fora do escopo
- Verificar componentes existentes antes de criar novos
- TypeScript estrito

**Gate:** Implementação completa seguindo o blueprint

---

### Fase 3 — Validação do Banco (Vault) — SE APLICÁVEL

**Task:** `tasks/db-backup.md` (se destrutiva)

**Quando ativar Vault:**
- Schema foi modificado (novo model, campo, relação)
- Migration será executada
- Operação de DELETE em massa

**Vault verifica:**
- Migration é destrutiva?
- Ambiente é produção?
- Backup necessário?

**Gate:** Vault aprovou → migration pode rodar

---

### Fase 4 — Build Check (Forge)

**Task:** `tasks/build-check.md`

Forge executa:
```bash
npx tsc --noEmit
npm run lint
npm run build
```

**Gate:** TODOS os três passam → APROVADO

Se reprovado → volta para Fase 2 com lista de erros

---

### Fase 5 — Verificação de Integração (Probe)

Probe verifica os integration points do blueprint do Scout:
- Feature aparece no menu/navegação?
- Rota acessível?
- Permissões funcionando?
- Atalhos configurados?
- Demais integration points do blueprint

**Gate:** Todos os integration points funcionando

---

### Fase 6 — Auditoria de Segurança (Anubis) — SE APLICÁVEL

**Task:** `tasks/security-audit.md`

**Quando ativar Anubis:**
- Feature tem autenticação
- Feature tem API routes
- Feature tem tools de AI
- Feature faz upload de arquivos
- Feature manipula dados sensíveis

**Gate:** Zero vulnerabilidades críticas

---

### Fase 7 — Code Review (Lens)

**Task:** `tasks/code-review.md`

**REGRA:** Lens só pode revisar APÓS Forge aprovar.

Lens revisa:
- 🔴 Segurança
- 🔴 Correção
- 🟡 Arquitetura
- 🟡 Performance
- 🟢 Manutenibilidade

**Gate:** Zero issues 🔴 → Aprovado (issues 🟡 e 🟢 são tratados conforme severidade)

---

### Fase 8 — QA / Testes (Sage)

**Task:** `tasks/qa-gate.md`

Sage verifica:
- Fluxos principais testados
- Edge cases cobertos
- Sem regressões em features existentes
- Testes escritos (ou recomendados)

**Gate:** Veredicto PASS ou CONCERNS (FAIL = volta para fase 2)

---

### Fase 9 — Atualização de Memória (Scribe)

Scribe atualiza:
- `codebase-map.md` se estrutura mudou
- `integration-points.md` se novo módulo foi criado
- `components.md` se novos componentes foram criados
- `decisions.md` se decisões técnicas foram tomadas

---

### Fase 10 — Arquivo de Sessão (Kowalski)

**Task:** `tasks/session-archive.md`

Kowalski arquiva:
- Resumo da sessão em `journal.md`
- Decisões novas em `decisions.md`
- Erros resolvidos em `known-errors.md`

---

## Condições de Skip

Algumas fases podem ser puladas com justificativa:

| Fase | Pode pular se... |
|------|-----------------|
| Vault | Nenhuma mudança no banco |
| Anubis | Feature puramente visual, sem auth/API/AI |
| Sage | Bug fix simples com scope muito pequeno |

**NUNCA pode pular:** Scout, Forge, Probe, Lens, Kowalski

---

## Checklist Final

```markdown
## Feature [Nome] — Checklist Final

### Fases concluídas
- [x] Scout — blueprint entregue
- [x] Implementação — blueprint seguido
- [ ] Vault — [N/A ou aprovado]
- [x] Forge — APROVADO (tsc + lint + build)
- [x] Probe — todos os integration points
- [ ] Anubis — [N/A ou aprovado]
- [x] Lens — zero issues críticos
- [x] Sage — PASS
- [x] Scribe — memória atualizada
- [x] Kowalski — sessão arquivada

### Pronto para push? [SIM/NÃO]
```
