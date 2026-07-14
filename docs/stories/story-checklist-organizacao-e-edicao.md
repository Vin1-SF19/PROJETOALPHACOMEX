# Story: Organização e edição do Alpha CheckList

**ID:** STORY-CHECKLIST-001  
**Epic:** Alpha CheckList  
**Status:** In Progress  
**Prioridade:** Alta  
**Complexidade:** 8  
**Agente responsável:** Nova / Echo  
**Data criação:** 2026-07-14  

---

## Narrativa

**Como** analista do Alpha CheckList,  
**quero** editar os dados das empresas, organizar a listagem em pastas e baixar os documentos enviados,  
**para** manter a operação atualizada e localizar os clientes com mais rapidez.

---

## Contexto

O módulo já permite criar e acompanhar checklists por empresa, porém não permite corrigir ou trocar o embasamento depois da criação. A listagem também precisa de edição global, filtros e agrupamento manual de empresas. Os status “Falar Andrew” e “Falar Dr. Edvan” deixaram de ser usados e devem desaparecer da interface e dos dados ativos.

---

## Critérios de Aceitação

- [x] **AC-001:** Dado uma empresa já cadastrada, quando o analista clicar em **Editar** no topo da listagem, então a listagem entra em modo de edição e permite salvar alterações dos dados cadastrados da empresa, incluindo razão social, nome fantasia, embasamento e os demais campos operacionais já existentes.
- [x] **AC-002:** Dado uma empresa com checklist criado, quando seu embasamento for trocado e salvo, então o checklist passa a usar o novo embasamento e seus itens são recriados a partir do template correspondente, sem apagar os documentos já enviados.
- [x] **AC-003:** Dado qualquer item de checklist, quando o analista abrir as opções de status, então “Falar Andrew” e “Falar Dr. Edvan” não são exibidos nem aceitos por novas atualizações; registros legados com esses status são normalizados para `PENDENTE`.
- [x] **AC-004:** Dado a listagem do Alpha CheckList, quando o analista abrir os filtros, então pode filtrar por texto, embasamento, status, pasta e situação do checklist.
- [x] **AC-005:** Dado uma empresa na listagem, quando o analista criar ou selecionar uma pasta, então pode vincular a empresa a uma pasta opcional e visualizar/filtrar as empresas por esse agrupamento.
- [x] **AC-006:** Dado uma empresa com documentos ativos nos itens do checklist, quando o analista solicitar o download, então recebe um arquivo ZIP com os documentos ativos organizados por seção e item; documentos excluídos não integram o arquivo.
- [x] **AC-007:** Todas as operações novas exigem sessão autenticada, validam entrada no servidor e atualizam a interface sem exigir recarregamento manual.

---

## Fora do Escopo

- Pastas aninhadas, compartilhamento de pasta e permissões específicas por pasta.
- Exclusão de pastas ou de empresas nesta entrega.
- Inclusão de documentos excluídos no ZIP.

---

## Notas Técnicas

- O módulo está em `src/app/PainelAlpha/CheckList/`; a rota e a permissão `checkList` já existem e não precisam de mudança no registry.
- Criar uma pasta opcional por empresa via relação aditiva no Prisma. Empresas atuais permanecem sem pasta até serem classificadas.
- Alterar a enumeração de status no Prisma e normalizar os dois valores legados para `PENDENTE` ao aplicar a atualização no Turso.
- O banco de produção usa Turso; após `prisma generate`, a alteração aditiva precisa ser aplicada com script pontual idempotente e confirmada com `PRAGMA table_info`.
- O ZIP deve usar a dependência já disponível (`jszip`) e processar somente URLs de documentos ativos, preservando nomes seguros e uma estrutura por seção/item.

---

## Integration Points

- Menu/Nav: não aplicável; o módulo já está registrado em `src/lib/modulos-registry.ts`.
- Rota: `/PainelAlpha/CheckList` e `/PainelAlpha/CheckList/[empresaId]`.
- Permissões: manter autenticação atual e a permissão de módulo `checkList`.
- Dados: `OperacionalClientes`, `Checklist`, `ItemChecklist` e `DocumentoChecklist`.

---

## Arquivos Modificados

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `prisma/schema.prisma` | modificado | Pasta opcional por empresa e remoção dos status obsoletos. |
| `src/actions/checklist.ts` | modificado | Pastas, edição completa de empresa e troca segura de embasamento. |
| `src/app/PainelAlpha/CheckList/ListaChecklist.tsx` | modificado | Edição global, filtros e classificação em pastas. |
| `src/app/PainelAlpha/CheckList/ChecklistView.tsx` | modificado | Troca de embasamento e acesso ao ZIP. |
| `src/app/PainelAlpha/CheckList/Modais/CadastroCliente.tsx` | modificado | Cadastro inicial sem escolha duplicada de embasamento. |
| `src/app/PainelAlpha/CheckList/page.tsx` | modificado | Carregamento das pastas. |
| `src/app/api/checklist/[empresaId]/documentos/zip/route.ts` | criado | Download autenticado de documentos ativos em ZIP. |
| `src/actions/ClientesOperacional.ts` | modificado | Nova empresa inicia sem embasamento, a ser escolhido no primeiro checklist. |
| `src/components/Checklist/Velocimetro.tsx` | modificado | Rotacao da agulha ancorada corretamente no centro do circulo. |
| `src/lib/checklist/items.ts` | modificado | Remoção dos status legados da interface. |
| `package.json` e `package-lock.json` | modificado | Dependência direta `jszip`. |

---

## Definition of Done

- [x] Blueprint do Scout entregue
- [x] Implementação completa (seguiu blueprint)
- [ ] Forge APROVADO (`typecheck`, `lint` e `build`)
- [ ] Probe verificou os integration points
- [x] Anubis auditou autenticação e download de documentos
- [ ] Lens aprovou (zero issues críticos)
- [ ] Sage verificou (PASS)
- [x] Scribe atualizou memória
- [x] Kowalski arquivou sessão
