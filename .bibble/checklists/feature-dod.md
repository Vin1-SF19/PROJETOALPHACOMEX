# Checklist: Feature Definition of Done

**Usado por:** Bibble, Probe, Sage  
**Quando:** Antes de declarar qualquer feature como completa  

---

## O que é "Done"?

Uma feature só está DONE quando todos os itens abaixo estiverem marcados.
Parcialmente done = não done.

---

## Checklist Completo

### 1. Implementação
- [ ] Funcionalidade implementada conforme especificado
- [ ] Blueprint do Scout seguido integralmente
- [ ] Nenhuma feature fora do escopo adicionada
- [ ] Código em TypeScript estrito (zero `any`)

### 2. Integration Points
- [ ] Aparece no menu/navegação
- [ ] Rota acessível e funcional
- [ ] Permissões configuradas
- [ ] Atalhos configurados (se o projeto usa)
- [ ] Registro de módulo atualizado (se necessário)

### 3. Qualidade Técnica
- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npm run lint` — zero erros críticos
- [ ] `npm run build` — completa sem erros

### 4. UX e Estados
- [ ] Estado de loading presente
- [ ] Estado de erro com mensagem útil
- [ ] Estado vazio/empty tratado
- [ ] Estado de sucesso claro
- [ ] Responsivo (mobile e desktop)
- [ ] Dark mode funcionando (se o projeto usa)

### 5. Segurança
- [ ] Auth verificado em todas as rotas
- [ ] Ownership check em todos os recursos
- [ ] Inputs validados com Zod
- [ ] Nenhum secret hardcoded
- [ ] AI tools com userId (se aplicável)

### 6. Banco de Dados (se aplicável)
- [ ] Schema validado por DataEngineer
- [ ] Migration segura (sem locks, sem perda de dados)
- [ ] Vault aprovou (se destrutiva)
- [ ] Backup feito (se produção)

### 7. Revisão de Código
- [ ] Forge APROVADO
- [ ] Lens APROVADO (zero issues 🔴)
- [ ] Anubis APROVADO (se auth/API/AI)

### 8. Testes
- [ ] Sage verificou fluxos principais
- [ ] Edge cases cobertos
- [ ] Sem regressões em features existentes
- [ ] Testes automatizados escritos ou recomendados

### 9. Memória Atualizada
- [ ] Scribe atualizou codebase-map.md
- [ ] Novos integration points em integration-points.md
- [ ] Novos componentes em components.md
- [ ] Decisões técnicas em decisions.md

### 10. Sessão Arquivada
- [ ] Kowalski arquivou em journal.md
- [ ] Erros novos em known-errors.md

---

## Resultado

**Todos marcados:** Feature DONE ✅ → Pronta para push  
**Qualquer desmarcado:** Feature NOT DONE ❌ → Completar antes do push

---

## Notas

- Items de banco só se aplicam se houve mudança no banco
- Items de AI só se aplicam se houve código de AI
- Todos os outros são obrigatórios em qualquer feature
