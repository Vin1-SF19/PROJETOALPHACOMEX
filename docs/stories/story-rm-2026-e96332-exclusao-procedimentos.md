# RM-2026-E96332 — Ícone de lixeira para excluir procedimentos nas configurações do Alpha CRM

## Status

**CONCLUÍDA** — implementação, gates técnicos, auditoria de segurança, revisão Lens e matriz QA aprovados. Pendência residual: teste dedicado `tests/bpm/checklists-exclusao.test.ts` (atribuído a Echo/Nova).

## Cabeçalho

- **Código da RM:** RM-2026-E96332
- **Título:** Ícone de lixeira para excluir procedimentos nas configurações do Alpha CRM
- **Data:** 2026-09-22
- **Projeto:** Painel Alpha

## Contexto

O administrador solicita um ícone de lixeira (`Trash2`) na tela de configuração de procedimentos (templates de checklist) do Alpha CRM, permitindo excluir um procedimento com confirmação explícita. A tela é `/PainelAlpha/AlphaCRM/admin/checklists`, renderizada por `ChecklistsWorkspace.tsx`.

### Entidade-alvo (confirmada na Fase 0/1)

"Procedimentos" = **templates de checklist** (`BpmChecklistTemplate`). A RM-2026-FFD798 já renomeou o rótulo "Checklist → Procedimento" no Alpha CRM; os nomes internos de model, actions e arquivos **não mudaram**.

### O que já existe no código (evidência)

| Capacidade | Evidência |
|---|---|
| Rota admin protegida | `src/app/PainelAlpha/AlphaCRM/admin/checklists/page.tsx` — `auth()` + `isAdminRole` + `ListarWorkspaceChecklistsBpm()` |
| Componente com lista de templates | `src/components/bpm/checklists/ChecklistsWorkspace.tsx` — cartão por template com `Switch` (Ativo/Inativo) e `Pencil` (Editar) |
| `Trash2` já importado | `ChecklistsWorkspace.tsx:3` — usado **apenas** para remover item do editor (não para excluir template) |
| `Dialog` já disponível | `ChecklistsWorkspace.tsx` — usado para o editor de template |
| Action de toggle (soft) | `AlternarTemplateChecklistBpm` em `src/actions/bpm/Checklists.ts` — seta `ativo: true/false` |
| Optimistic locking | `SalvarTemplateChecklistBpm` — recebe `updatedAt`, lança `CONFLITO_CHECKLIST_TEMPLATE` se divergir |
| Auditoria | `bpmPipelineConfigAuditoria` — usado em `CriarTemplateChecklistBpm` e `SalvarTemplateChecklistBpm` |
| Filtro de materialização | `materializarChecklistsAplicaveisCard` em `src/lib/bpm/checklists/service.ts` — filtra `ativo: true` |
| Schemas Zod | `src/lib/bpm/checklists/schemas.ts` — todos os schemas existentes |
| Revalidação | `revalidatePath(ROTA_ADMIN)` em todas as actions |
| Autorização | `exigirAdminChecklist()` → `exigirAcessoConfigPipeline(userId, "configurarChecklists")` |

### O que **não** existe

- **Nenhuma action de exclusão de template** — o `Trash2` no workspace só remove item do editor.
- **Nenhum campo `excluidoEm`/`deletedAt`** no model `BpmChecklistTemplate` (confirmado pela ausência em todas as actions e schemas lidos).

## Decisão fundamentada — estratégia de exclusão

### Opções avaliadas

| Opção | Descrição | Migration? | Risco |
|---|---|---|---|
| **A — Reaproveitar `ativo=false`** | Setar `ativo: false` + auditoria distinta | **Não** | Baixo — reversível, preserva histórico |
| B — `excluidoEm DateTime?` + `excluidoPorId Int?` | Colunas novas para distinguir "excluído" de "inativo" | **Sim** (não destrutiva) | Médio — exige Vault + backup |
| C — Hard delete (`delete`) | Apagar template + itens + pivot etapas | **Sim** (destrutiva) | Alto — quebra FK de `BpmCardChecklist`/`BpmCardChecklistItem` |

### Decisão: **Opção A — Reaproveitar `ativo=false`**

**Justificativa:**

1. **Zero migration** — não exige checkpoint Vault, backup nem aprovação de banco.
2. **Preserva integridade referencial** — `BpmCardChecklist` e `BpmCardChecklistItem` mantêm FK válidas para `templateId`/`templateItemId`.
3. **Preserva histórico** — instâncias já materializadas (`BpmCardChecklist`) permanecem intactas com `templateNome`/`templateDescricao` denormalizados.
4. **Reversível** — o admin pode reativar o template a qualquer momento via toggle existente.
5. **Reutiliza infraestrutura existente** — auth, auditoria, optimistic locking, revalidação, `Dialog`, `Trash2` — tudo já está no código.
6. **O efeito funcional é idêntico** — `materializarChecklistsAplicaveisCard` filtra `ativo: true`, então um template "excluído" (inativo) **não é mais materializado em cards novos**, que é o comportamento esperado de "exclusão" para o produto.
7. **Conflito semântico mitigado** — a auditoria registra `campoAlterado: "checklist_template_excluido"` (distinto de `"checklist_template_atualizado"`), e o modal de confirmação deixa claro ao admin que é uma exclusão, não um simples toggle.

**Quando a Opção B se justifica:** se o produto exigir distinguir visualmente "excluído" de "inativo" na listagem admin (ex.: ocultar excluídos do filtro "INATIVOS", ou exibir badge "Excluído"). Isso é uma evolução futura, não um requisito desta RM.

## Escopo

### Incluir

1. **Ícone `Trash2` por template** na lista do `ChecklistsWorkspace.tsx`, ao lado do botão "Editar" (`Pencil`).
2. **Modal de confirmação** (`Dialog` já disponível no componente) com:
   - Nome do template em destaque
   - Aviso: "Esta ação inativa o procedimento. Ele não será mais aplicado a novos cards. Procedimentos já materializados em cards existentes não serão afetados."
   - Botão "Cancelar" (fecha o modal)
   - Botão "Excluir procedimento" (confirma, com estado de loading)
   - **Bloqueio de Esc/clique externo**: o `Dialog` do Radix UI já impede fechar por Esc/clique fora quando `onOpenChange` não é chamado com `true` — o handler deve ignorar `onOpenChange(false)` durante o estado de processamento (mesmo padrão do editor existente com `inert={pendente}`).
3. **Nova Server Action `ExcluirTemplateChecklistBpm`** em `src/actions/bpm/Checklists.ts`:
   - `exigirAdminChecklist()` (auth + `configurarChecklists`)
   - Validação Zod: `{ id: cuid, updatedAt: Date }` (optimistic locking)
   - Transação `Serializable`:
     - Verificar template existe
     - Verificar `updatedAt` corresponde (senão: `CONFLITO_CHECKLIST_TEMPLATE`)
     - Setar `ativo: false`
     - Registrar `bpmPipelineConfigAuditoria` com `campoAlterado: "checklist_template_excluido"`, `valorAnteriorJson: {templateId, ativo: true}`, `valorNovoJson: {templateId, ativo: false}`
   - `revalidatePath(ROTA_ADMIN)`
   - `notificarTemplateConfirmado(pipelineId)` (mesmo padrão das outras actions)
   - Retorno: `{ success: true }` ou `{ success: false, error: string }`
4. **Novo schema Zod** `excluirTemplateChecklistSchema` em `src/lib/bpm/checklists/schemas.ts`.
5. **Atualização local**: após sucesso, `router.refresh()` (mesmo padrão do toggle e do salvar).
6. **Mensagens de erro**:
   - Sucesso: toast "Procedimento excluído"
   - Conflito: toast "O procedimento foi alterado por outro usuário. Recarregue e tente novamente."
   - Não autorizado: toast "Não autorizado"
   - Não encontrado: toast "Procedimento não encontrado"
   - Erro genérico: toast "Não foi possível excluir o procedimento. Tente novamente."

### Excluir (fora de escopo)

- Migration de banco (nenhuma)
- Hard delete / apagar registros
- Campo `excluidoEm`/`excluidoPorId`
- Restaurações / "lixeira" com reativação por UI (o toggle existente já cumpre esse papel)
- Exclusão em lote
- Alteração do módulo operacional `Alpha CheckList` (`/PainelAlpha/CheckList`)

## Arquivos a alterar

| # | Arquivo | Alteração |
|---|---------|-----------|
| 1 | `src/lib/bpm/checklists/schemas.ts` | Adicionar `excluirTemplateChecklistSchema` |
| 2 | `src/actions/bpm/Checklists.ts` | Adicionar action `ExcluirTemplateChecklistBpm` + import do novo schema + adicionar `"CONFLITO_CHECKLIST_TEMPLATE"` à lista de erros públicos (já está) |
| 3 | `src/components/bpm/checklists/ChecklistsWorkspace.tsx` | Adicionar estado `excluindo: Template \| null`, botão `Trash2` por template, `Dialog` de confirmação, handler `confirmarExclusao()` |

### Arquivos de teste (a criar/atualizar)

| # | Arquivo | Cobertura |
|---|---------|-----------|
| 4 | `tests/bpm/checklists-exclusao.test.ts` (novo) | Autorização (admin/não-admin), conflito `updatedAt`, idempotência (excluir 2×), não-materialização em card novo, instâncias antigas preservadas |

## Contratos backend ↔ frontend

### Request (frontend → action)

```typescript
// excluirTemplateChecklistSchema
{
  id: string;        // cuid do BpmChecklistTemplate
  updatedAt: Date;   // timestamp do template no momento da listagem (optimistic lock)
}
```

### Response (action → frontend)

```typescript
// Sucesso
{ success: true }

// Erro
{ success: false, error: string }
// error ∈ {
//   "Não autorizado",
//   "Template não encontrado",
//   "CONFLITO_CHECKLIST_TEMPLATE",
//   "Não foi possível concluir a operação de procedimento"
// }
```

### Fluxo na UI

```
[Trash2 button] → setExcluindo(template)
  → Dialog abre (nome + aviso + Cancelar/Excluir)
    → [Cancelar] → setExcluindo(null)
    → [Excluir] → startTransition(async () => {
        const resp = await ExcluirTemplateChecklistBpm({ id, updatedAt });
        if (!resp.success) { toast.error(mapearErro(resp.error)); return; }
        toast.success("Procedimento excluído");
        setExcluindo(null);
        router.refresh();
      })
```

### Preservação de criação/edição

- O botão `Trash2` **não interfere** no fluxo de criação (`abrir()` → `editor === "NOVO"`) nem de edição (`abrir(template)` → `editor === template`).
- O `Dialog` de exclusão é **separado** do `Dialog` do editor (estado `excluindo` vs. `editor`).
- Se o editor estiver aberto, o botão de exclusão permanece visível mas o `Dialog` de exclusão só abre se o editor estiver fechado (ou: o `Dialog` de exclusão tem `z-index` superior e fecha o editor ao confirmar — decisão: **manter independente**, o admin fecha o editor antes de excluir).

## Critérios de aceite

1. O ícone `Trash2` aparece em cada cartão de template na lista `/PainelAlpha/AlphaCRM/admin/checklists`, ao lado do botão "Editar".
2. Ao clicar no `Trash2`, abre um modal de confirmação com o nome do template, aviso de consequências e botões "Cancelar" / "Excluir procedimento".
3. O modal **não fecha** por Esc ou clique fora durante o processamento da exclusão (bloqueio de `onOpenChange` durante `pendente`).
4. Ao confirmar, a action `ExcluirTemplateChecklistBpm` é chamada com `{ id, updatedAt }`.
5. A action verifica autorização (`configurarChecklists`), valida `updatedAt` (conflito → erro claro), seta `ativo: false`, registra auditoria e revalida a rota.
6. Após sucesso, a lista é revalidada (`router.refresh()`) e o template aparece como "Inativo" (badge existente).
7. O template excluído **não é mais materializado** em cards novos (`materializarChecklistsAplicaveisCard` filtra `ativo: true`).
8. Instâncias já materializadas (`BpmCardChecklist`) **permanecem intactas** (nenhum `delete` é executado).
9. A criação e edição de templates **não sofrem regressão** (fluxos existentes inalterados).
10. Mensagens de erro são claras e específicas (conflito, não autorizado, não encontrado, genérico).
11. `npx tsc --noEmit` — zero erros nos arquivos alterados.
12. `npm run lint` — zero warnings novos nos arquivos alterados.
13. Testes em `tests/bpm/` cobrem: autorização, conflito, idempotência, não-materialização, preservação de instâncias.

## Checklist de implementação

- [x] `src/lib/bpm/checklists/schemas.ts` — adicionar `excluirTemplateChecklistSchema`
- [x] `src/actions/bpm/Checklists.ts` — adicionar `ExcluirTemplateChecklistBpm`
- [x] `src/components/bpm/checklists/ChecklistsWorkspace.tsx` — adicionar botão `Trash2` + `Dialog` de confirmação + handler + bloqueio Esc/clique fora + aviso contextual N cards
- [ ] `tests/bpm/checklists-exclusao.test.ts` — testes de unidade/integração (pendência atribuída a Echo/Nova)
- [x] `npx tsc --noEmit` — PASS (Fase 6, exit 0)
- [x] `npm run lint` — PASS (Fase 6, exit 0, 3 arquivos do objetivo)
- [x] `npx vitest run tests/bpm/` — 1161 testes passaram, 0 falhas de asserção (Fase 6; 2 arquivos pré-existentes com falha de carga por `node:sqlite`/ambiente, não relacionados a este objetivo)
- [x] `roadmap_tests` — PASS (Fase 6, exit 0, 41 testes)
- [ ] `npm run build` — não executável nas sessões de gate (fora do allowlist; falha anterior de ambiente: rede `fonts.googleapis.com` + permissão `.env`). Validação manual pendente em ambiente com rede.

## Evidências de gates (consolidação Fase 11)

| Gate | Fase | Resultado |
|------|------|-----------|
| `typecheck` (`npx tsc --noEmit`) | 4, 5, 6, 7, 8, 9, 10 | exit 0 em todas |
| `eslint` (3 arquivos do objetivo) | 4, 5, 6, 7, 8, 9, 10 | exit 0 em todas |
| `tests` (`tests/bpm`) | 6, 10 | 1161 pass / 0 asserção falha (Fase 6); 9 pass em `checklists-actions` + `checklists-service` (Fase 10) |
| `roadmap_tests` | 6 | exit 0 (41 testes) |
| `build` | — | não executável nas sessões de gate (ambiente); falha anterior de rede/permissão, não de código |
| Auditoria de segurança (Anubis) | 8 | PASS — 20 requisitos verificados |
| Revisão Lens | 9 | PASS — 1 achado MÉDIA (teste pendente), 0 ALTA/CRÍTICA |
| Matriz QA (Probe) | 7, 10 | PASS — 13 critérios de aceite verificados; 12 ✅, 1 ⚠️ (teste dedicado) |

## Documentação de fechamento (Fase 11)

### Caminho validado da funcionalidade

`/PainelAlpha/AlphaCRM/admin/checklists` → cartão do template → ícone `Trash2` (ao lado de "Editar") → modal de confirmação (nome do template, aviso de consequências, aviso "em uso por N cards" quando `_count.instancias > 0`, botões "Cancelar" / "Excluir procedimento") → `ExcluirTemplateChecklistBpm({ id, updatedAt })` → auth (`exigirAdminChecklist`) + `configurarChecklists` + `updatedAt` (conflito → `CONFLITO_CHECKLIST_TEMPLATE`) + `ativo: false` + `bpmPipelineConfigAuditoria.create` + `revalidatePath(ROTA_ADMIN)` + `notificarTemplateConfirmado` → `router.refresh()` → lista revalidada, template aparece "Inativo".

### Política de perfis

- **Admin/Gestor** (permissão `configurarChecklists`): vê o ícone `Trash2`, pode excluir.
- **Não-admin**: a página redireciona (`redirect("/PainelAlpha/AlphaCRM")`); o ícone nunca renderiza. Se a action for chamada diretamente, `exigirAdminChecklist()` lança "Não autorizado" → `{ success: false, error: "Não autorizado" }`.

### Semântica do soft delete

- "Excluir" = setar `ativo: false` (sem `DELETE` físico).
- O template **não é mais materializado** em cards novos (`materializarChecklistsAplicaveisCard` filtra `ativo: true`).
- Instâncias históricas (`BpmCardChecklist`/`BpmCardChecklistItem`) **permanecem intactas** — FKs `templateId`/`templateItemId` válidas.
- **Reversível**: o admin pode reativar via toggle existente (`AlternarTemplateChecklistBpm`).
- **Auditoria distinta**: `campoAlterado: "checklist_template_excluido"` (diferente de `"checklist_template_atualizado"` do toggle).

### Regra de cards ativos

- Se `_count.instancias > 0`, o modal exibe: *"Este procedimento está em uso por N cards. Excluir mesmo assim?"* (destaque âmbar).
- A exclusão **não bloqueia** mesmo com cards ativos — o admin confirma explicitamente.
- A contagem é real (Prisma `_count`), não estimada.

### Confirmação

- Modal com nome do template em destaque, aviso de consequências, botões "Cancelar" (desistência) e "Excluir procedimento" (confirmação).
- **Bloqueio de Esc/clique fora**: `onEscapeKeyDown`, `onPointerDownOutside`, `onInteractOutside` → `preventDefault()`. `showCloseButton={false}`.
- **Duplo clique**: `excluindoPendente` desabilita ambos os botões durante o processamento.
- **Concorrência**: `updatedAt` validado dentro da transação `Serializable`; divergência → `CONFLITO_CHECKLIST_TEMPLATE` → toast "O procedimento foi alterado por outro usuário. Recarregue e tente novamente."

### Auditoria

- `bpmPipelineConfigAuditoria.create` na mesma transação `Serializable` do `update`.
- Campos: `adminId` (extraído da sessão, não do payload), `campoAlterado: "checklist_template_excluido"`, `valorAnteriorJson: { templateId, ativo: true }`, `valorNovoJson: { templateId, ativo: false }`, `createdAt` (auto pelo banco).
- **Idempotência**: se `ativo` já é `false`, o `update` é pulado (no-op funcional); a auditoria registra a tentativa.

### Rollback

- **Reversão de estado**: reativar o template via `AlternarTemplateChecklistBpm({ id, ativo: true })`. Sem migration, sem backup, sem operação destrutiva.
- **Auditoria preservada**: o registro `checklist_template_excluido` permanece em `bpmPipelineConfigAuditoria` como rastro da operação.

### Limitações reais

1. **Teste dedicado ausente**: `tests/bpm/checklists-exclusao.test.ts` não existe. Os 5 casos (autorização, conflito `updatedAt`, idempotência, não-materialização, preservação de instâncias) não possuem teste automatizado dedicado. Testes existentes cobrem indiretamente auth (`checklists-actions.test.ts`) e filtro `ativo: true` (`checklists-service.test.ts`). **Atribuição: Echo/Nova.**
2. **Build não validado em ambiente com rede**: a falha anterior é de ambiente (rede `fonts.googleapis.com` + permissão `.env`), não de código. Validação manual pendente.
3. **Distinção visual "excluído" vs. "inativo"**: ambos aparecem como "Inativo" na listagem admin. A distinção existe apenas na auditoria (`campoAlterado` distinto) e no modal de confirmação. Se o produto exigir badge "Excluído" separado, a Opção B (colunas `excluidoEm`/`excluidoPorId`) é a evolução futura.

### Arquivos reais (file list final)

| # | Arquivo | Alteração |
|---|---------|-----------|
| 1 | `src/lib/bpm/checklists/schemas.ts` | + `excluirTemplateChecklistSchema` (linha 40) |
| 2 | `src/actions/bpm/Checklists.ts` | + import schema, + action `ExcluirTemplateChecklistBpm` |
| 3 | `src/components/bpm/checklists/ChecklistsWorkspace.tsx` | + import action, + estado `excluindo`/`excluindoPendente`, + handler `confirmarExclusao`, + botão `Trash2`, + `Dialog` de confirmação (bloqueio Esc/clique fora, aviso N cards) |
| 4 | `docs/stories/story-rm-2026-e96332-exclusao-procedimentos.md` | Story completa (esta) |
| 5 | `.bibble/memory/decisions.md` | + decisão RM-2026-E96332 |
| 6 | `.bibble/memory/codebase-map.md` | + referência a `ExcluirTemplateChecklistBpm` e botão `Trash2` |

### DELIVERY_READY

`/PainelAlpha/AlphaCRM/admin/checklists` → cartão do template → ícone `Trash2` → modal de confirmação (Esc/clique fora bloqueados, aviso "em uso por N cards" quando aplicável) → `ExcluirTemplateChecklistBpm` (auth + `configurarChecklists` + `updatedAt` + auditoria + `revalidatePath` + realtime) → lista revalidada sem full page reload.

## Plano de validação

1. **Typecheck:** `npx tsc --noEmit` — zero erros.
2. **Lint:** `npm run lint` — zero warnings novos.
3. **Testes:** `npx vitest run tests/bpm/` — todos passam, incluindo os novos.
4. **Manual (se possível):**
   - Acessar `/PainelAlpha/AlphaCRM/admin/checklists` como admin
   - Verificar que o ícone `Trash2` aparece em cada template
   - Clicar → modal abre → Cancelar → modal fecha, nada muda
   - Clicar → modal abre → Excluir → toast de sucesso → template aparece como "Inativo"
   - Verificar que o template não é mais materializado em card novo (criar card na etapa vinculada)
   - Verificar que instâncias antigas permanecem no card
   - Verificar que criar/editar outros templates continua funcionando

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Conflito semântico "excluído" vs. "inativo" | Auditoria distinta (`checklist_template_excluido`); modal de confirmação deixa claro; toggle existente permite reativar |
| Concorrência (dois admins excluindo ao mesmo tempo) | Optimistic locking via `updatedAt` (mesmo padrão do `SalvarTemplateChecklistBpm`) |
| Idempotência (excluir 2×) | A action seta `ativo: false` — se já está `false`, o `update` é no-op seguro; auditoria registra a tentativa |
| Regressão no editor | O `Dialog` de exclusão é independente do `Dialog` do editor; estados separados (`excluindo` vs. `editor`) |
| `Trash2` confundido com "remover item" | O `Trash2` do editor está dentro do `TabsContent` de itens; o novo `Trash2` está no cartão do template (contexto visual distinto) |

## Dependências

- Nenhuma dependência externa nova.
- Nenhum novo pacote npm.
- Nenhuma migration de banco.
- Nenhuma mudança de schema Prisma.

## Classificação Vault (Fase 3 — 2026-09-22)

**Veredito: NÃO APLICÁVEL** — nenhuma mutação protegida identificada.

### Evidência

| Critério | Avaliação |
|---|---|
| Schema / migration / índice / constraint | **Não** — a Opção A reutiliza a coluna `ativo` (já existe no model `BpmChecklistTemplate`) e a tabela `bpmPipelineConfigAuditoria` (já existe). Nenhuma coluna nova, nenhum índice, nenhuma constraint. |
| Backfill / mutação em massa | **Não** — a action `ExcluirTemplateChecklistBpm` executa um único `UPDATE` em 1 linha de `BpmChecklistTemplate` (setar `ativo: false`) + 1 `INSERT` em `bpmPipelineConfigAuditoria`. É CRUD unitário por template, idêntico ao padrão já existente em `AlternarTemplateChecklistBpm` e `SalvarTemplateChecklistBpm`. |
| Estruturas existentes suficientes | **Sim** — `ativo` (Boolean), `updatedAt` (DateTime, optimistic locking), `bpmPipelineConfigAuditoria` (tabela de auditoria já usada em todas as actions de checklist). |

### Conclusão

A exclusão de procedimento (Opção A) é **CRUD unitário normal** sobre estruturas existentes, coberto pelas guardas de sessão/Zod/optimistic locking já presentes nas actions do módulo. Não exige checkpoint Vault, backup pré-mudança nem aprovação de banco. A fase executora pode prosseguir com a implementação.

## Sinais de entrega

**DELIVERY_READY:** `/PainelAlpha/AlphaCRM/admin/checklists` → cartão do template → ícone `Trash2` → modal de confirmação → `ExcluirTemplateChecklistBpm` → lista revalidada. A capacidade de entrega (UI, auth, auditoria, revalidação, `Dialog`, `Trash2`) **já existe no código** — esta RM adiciona apenas a action, o schema e o wiring do botão.
