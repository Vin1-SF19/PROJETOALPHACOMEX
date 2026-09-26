# Story RM-2026-43AA46 — CRUD completo de campos por coluna (Pipeline)

## Correção — texto curto em etapa publicada pelo editor (2026-09-26)

Relato: ao criar um campo de texto curto numa seção para o nome do responsável, o cadastro retorna um toast de entrada inválida.

Critérios de aceite desta correção:

- [x] Criar e atualizar campos aceita os IDs `draft-stage-<uuid>` que o editor persiste ao publicar novas etapas, além dos CUIDs existentes.
- [x] Obrigatoriedade por etapa continua sendo preservada e validada.
- [x] IDs inválidos e etapas inexistentes continuam sendo rejeitados.
- [x] Executar os gates e registrar seus resultados reais.

Diagnóstico: `ConfiguracaoPipeline.ts` persiste o ID da nova etapa sem conversão; `campoEtapaConfigSchema` aceita somente CUID, embora `etapaIdCardSchema` já reconheça ambos os formatos. A correção reutiliza essa validação nas configurações dos campos. Sem migração ou alteração de dados.

Validação desta correção:

- Pipeline informado pelo usuário: Revisão do Radar. Etapa específica e smoke autenticado não confirmados; a incompatibilidade foi reproduzida pela validação dos formatos de ID e coberta por testes.
- Vitest focado: **2 arquivos, 33 testes aprovados** (`crud-campos-bpm` e `campos-configuraveis-actions`). Executado em drive temporário criado por `cmd pushd`, com binding Windows do Rolldown 1.0.1 instalado somente no TEMP e indicado via `NODE_PATH`, sem mudar manifest/lockfile do projeto.
- `git diff --check` do escopo: sem erros.
- `npm run lint`, `npm run typecheck` e `npm test`: tentados. Os wrappers npm deste ambiente Windows não encontram os executáveis da instalação compartilhada; `typecheck` também utiliza atribuição de variável no formato POSIX.
- Executáveis Node chamados diretamente como alternativa: lint do escopo inicialmente terminou sem diagnósticos; lint global e typecheck não concluíram após vários minutos na pasta de rede e foram encerrados. Esses gates globais **não estão aprovados**.
- Suíte geral com cobertura: iniciou, apresentou falhas em Google Calendar, Chatbot, gerador de PDF e falhas de carregamento em suites de integração; encerrada sem relatório completo. Não foi executada comparação de baseline para atribuir a origem dessas falhas.
- Build Next: tentou baixar/carregar SWC Windows e encontrou `Access is denied` ao carregar o binário pela pasta de rede; execução encerrada, sem build aprovado.
- CodeRabbit: indisponível, pois o WSL exigido pelo fluxo não está instalado.
- Estado: correção implementada e testes focados aprovados; validação global e smoke autenticado pendentes. Commit local solicitado pelo usuário em 2026-09-26. Sem push, publicação, migração ou mutação de dados.

File list desta correção:

- `src/lib/validations/bpm.ts`
- `tests/bpm/crud-campos-bpm.test.ts`
- `tests/bpm/campos-configuraveis-actions.test.ts`
- `docs/stories/story-rm-2026-43aa46-crud-campos-pipeline.md`

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

## Extensão — lista dinâmica de e-mails (2026-09-25)

Como administrador do Alpha CRM, quero criar em **Campos e formulários** um campo de lista de e-mails para que, no formulário do card Kanban, o usuário possa adicionar e remover quantos endereços forem necessários.

### Critérios de aceite

- [x] O catálogo de tipos oferece **Lista de e-mails** sem exigir migração de banco.
- [x] O formulário do card renderiza inputs de e-mail dinâmicos com ações de adicionar e remover.
- [x] O valor é persistido como array JSON no armazenamento textual já existente.
- [x] O servidor valida todos os endereços, normaliza letras minúsculas e elimina vazios e duplicados.
- [x] Estado somente leitura/desabilitado também bloqueia adicionar e remover itens.
- [x] Testes focados e lint do escopo aprovados.

### File list da extensão

- `src/lib/validations/bpm.ts`
- `src/lib/bpm/campos-dinamicos.ts`
- `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx`
- `tests/bpm/crud-campos-bpm.test.ts`
- `tests/bpm/lista-email-campo.test.ts`
- `docs/stories/story-rm-2026-43aa46-crud-campos-pipeline.md`

Sem alteração de schema, migração, seed ou dados em massa. Rollback: remover `lista_email` do catálogo, renderer e validação, preservando os demais tipos de campo.
