# Story: Modelos configuráveis de embasamento

**ID:** STORY-CHECKLIST-002  
**Epic:** Alpha CheckList  
**Status:** In Progress  
**Prioridade:** Alta  
**Complexidade:** 7  
**Agente responsável:** Nova / Echo  
**Data criação:** 2026-07-14  

---

## Narrativa

**Como** responsável pelo Alpha CheckList,  
**quero** cadastrar os documentos que compõem cada embasamento,  
**para** não depender de uma lista fixa no código e reutilizar documentos globais quando necessário.

---

## Critérios de Aceitação

- [ ] **AC-001:** A listagem do Alpha CheckList exibe o botão **Configurar embasamentos**, que abre a administração dos modelos.
- [ ] **AC-002:** A administração apresenta quatro cards, um para cada embasamento disponível, e cada card abre sua configuração.
- [ ] **AC-003:** Em cada configuração, o responsável pode cadastrar um documento com código, nome, descrição complementar, seção e indicação de obrigatoriedade.
- [ ] **AC-004:** A seção do documento aceita somente Origem do Capital Social, Capacidade Financeira, Capacidade Operacional, Constituição Regular ou Validação.
- [ ] **AC-005:** O responsável pode marcar um documento como específico do embasamento atual ou global, caso em que ele é aplicado a todos os embasamentos.
- [ ] **AC-006:** Ao criar um checklist novo ou trocar para um embasamento sem checklist anterior, os itens são copiados dos modelos específicos e globais configurados; documentos/checklists existentes não são apagados nem modificados.
- [ ] **AC-007:** A configuração exige sessão autenticada e valida os dados no servidor.

---

## Fora do Escopo

- Alterar retrospectivamente os itens de checklists já criados.
- Remover documentos ou checklists já enviados por empresas.

---

## Arquivos Modificados

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `prisma/schema.prisma` | modificado | Modelo persistente de itens configuráveis por embasamento. |
| `src/actions/checklist-modelos.ts` | criado | Leitura e criação autenticada/validada dos documentos-modelo. |
| `src/actions/checklist.ts` | modificado | Novos checklists usam os modelos globais e específicos cadastrados. |
| `src/lib/checklist/modelos.ts` | criado | Tipos, seções e labels compartilhados da configuração. |
| `src/app/PainelAlpha/CheckList/Embasamentos/*` | criado | Administração dos quatro modelos e formulário de documento. |
| `src/app/PainelAlpha/CheckList/ListaChecklist.tsx` | modificado | Botão de entrada para configurar embasamentos. |

---

## Definition of Done

- [x] Blueprint do Scout entregue
- [x] Implementação completa
- [x] Migration aditiva aplicada e confirmada no Turso
- [x] Validação de segurança concluída
- [x] Lint e validação Prisma concluídos
