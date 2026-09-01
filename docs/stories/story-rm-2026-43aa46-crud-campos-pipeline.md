# Story RM-2026-43AA46 — CRUD completo de campos por coluna (Pipeline)

**Título do objetivo:** COnfigurações de Pipelines do CRM
**Objetivo:** `adicionar, editar, excluir, escolher o tipo (texto, select, checkbox, etc), se é obrigatório ou não` — por coluna/etapa do Pipeline.
**Projeto:** Painel Alpha (PainelAlpha/AlphaCRM)
**Revisão:** r0001
**Cérebro de desenvolvimento:** Claude (`qwen3.8:131k`)
**Data:** 2026-09-01

## Problema / Gap antes da sessão

O admin de Pipeline (`AdminPipelineClient.tsx`) permitia **criar** campos e **alternar** a flag "Obrigatório", mas não oferecia:

- **Editar** nome, tipo, etapa-alvo, opções ou obrigatório de um campo existente (schema `atualizarCampoSchema` nem aceitou `tipo`/`etapaId`).
- **Excluir** um campo — nem a ação server nem a UI.
- **Opções** para campos do tipo `selecao` (criação e edição ambas ignoravam).
- O select de "tipo" no formulário de criação só oferecia 5 tipos; o schema e a UI do card suportam 7 (`texto`, `texto_longo`, `numero`, `data`, `selecao`, `booleano`, `cpf`).

## O que foi feito

### 1. Validações (`src/lib/validations/bpm.ts`)

- `atualizarCampoSchema`: adicionados `tipo` (enum), `etapaId` (cuid ou nulo), `opcoes` agora aceita `null` (limpar opções ao trocar de tipo).
- Nova `excluirCampoSchema`: exige `campoId` cuid.

### 2. Ações server (`src/actions/bpm/Campos.ts`)

- `ExcluirCampoBpm` (novo): auth → `exigirAcessoConfigPipeline(configurarCampos)` → delete do `BpmCampo` (cascade limpa `BpmCardCampoValor`, `BpmCampoObrigatorioEtapa` e `BpmCampoOcultoEtapa` automaticamente) → audit trail `bpmPipelineConfigAuditoria.campo_excluido` → revalidate + notificar realtime.
- `AtualizarCampoBpm`: agora propaga `tipo`/`etapaId` (rest) e zera `opcoesJson` quando `opcoes === null` (toggle de tipo `selecao → texto`).

### 3. UI (`AdminPipelineClient.tsx`)

- Interface `CampoBpm` expõe `opcoesJson: string | null` (o Prisma já devolve `opcoesJson`; antes o client assumia `opcoes: string[]`).
- **Editor inline** por campo: campos Nome, Tipo (7 tipos), Etapa, Obrigatório e textarea de opções (visível só quando tipo = `selecao`).
- Botões `Pencil` (editar/cancelar) e `Trash2` (excluir, com `confirm()`).
- **Novo campo**: textarea de opções aparece conforme tipo; validação "seleção requer ao menos 1 opção"; select de tipo agora tem os 7 tipos (não só 5).
- `TIPOS_CAMPO` + `TIPOS_COM_OPICOES` centralizados como consts.

### 4. Testes (`tests/bpm/crud-campos-bpm.test.ts`)

- 6 testes de validação: atualizar (nome/tipo/etapaId/obrigatorio), opcoes nulo, tipo inválido rejeitado, excluir schema, criar selecao com/sem opcoes válidas.

### 5. Gates

- `npx vitest run tests/bpm/crud-campos-bpm.test.ts` → **6/6 pass**
- `npx tsc --noEmit` (filter nos 4 arquivos tocados) → **0 erros**
- `npx eslint` nos 4 arquivos tocados → **0 erros**
- Erros pré-existentes do projeto (GoogleMeet, `gerador-documentos`, CalendarioAlpha, 16 vitest em `tests/bpm`) — **não relacionados** a esta sessão (verificados via git stash em 18/19).

## Arquivos alterados

- `src/lib/validations/bpm.ts`
- `src/actions/bpm/Campos.ts`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx`
- `tests/bpm/crud-campos-bpm.test.ts` (novo)

## Como verificar manualmente (Em testes)

1. Admin: `painelalpha/painel-alpha/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]`
2. Card "Campos Personalizados" → cada campo tem ícones Pencil (editar) e Trash2 (excluir).
3. Criar novo campo do tipo **Seleção** → textarea "Opções (uma por linha)" aparece; criar com 0 opções falha com mensagem amigável.
4. Editar um campo: trocar tipo `selecao → texto` limpa as opções automaticamente; trocar tipo `texto → selecao` pede opções de novo.
5. Excluir → pop-up de confirmação → sombreado do campo some; valores de cards vinculados são removidos em cascade (BpmCardCampoValor).
6. Audit trail visível em `bpmPipelineConfigAuditoria` (admin: `campo_atualizado` e `campo_excluido`).

## Restrições / Fora de escopo

- **Sem commit/push** — promoção para produção fica manual por `requireManualPromotion: true` (Painel Alpha).
- **Sem migração**: `excluirCampoSchema`, `tipo`, `etapaId`, `opcoes` nulo são compatíveis com o schema Prisma existente; nenhum `prisma migrate` necessário.
- UI de **mover/reordenar campos** já existe nos cards (DragDrop), não alterada.
- `BpmCampoObrigatorioEtapa` / `BpmCampoOcultoEtapa` **por etapa** ainda não expõem UI; o toggle "Obrigatório" continua global. Fora do escopo.

---
Documento gerado automaticamente pelo Roadmap Alpha. Aprovação e commit permanecem manuais.
