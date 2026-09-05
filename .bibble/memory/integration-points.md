# INTEGRATION POINTS — Pontos de Integração

- Checklist Builder: `materializarChecklistsAplicaveisCard` é o único serviço de materialização para abertura do card e ação explícita `MATERIALIZAR_CHECKLIST`; `carregarResumoChecklistAplicavelCard` é a leitura pura compartilhada por Validações, Regras, Automações e alerta de avanço; `ListarChecklistsCardBpm` é a entrada autenticada do painel; `SalvarTemplateChecklistBpm` é o save atômico do builder.

## Alpha CRM — Checklist Builder (RM-2026-209DB4)

**Caminho administrativo:** `Configurações → Checklists → /PainelAlpha/AlphaCRM/admin/checklists` → `ListarWorkspaceChecklistsBpm`/`ChecklistsWorkspace` → `CriarTemplateChecklistBpm` ou `SalvarTemplateChecklistBpm`.

**Caminho operacional:** card aberto → `PainelRegistrar` → `CardOpenFormSlot` → `PainelChecklistsCard` → `ListarChecklistsCardBpm` → `materializarChecklistsAplicaveisCard`. Atualizações usam `AtualizarItemChecklistCardBpm`; item exclusivo usa `AdicionarItemExclusivoChecklistCardBpm`.

**Movimento e motores:** `Cards.ts/executarMovimentoComRequisitos` chama `obterErroChecklistParaMovimento` antes e dentro da transação. `regras/contexto.ts` expõe a fonte fixa `checklist`. `automacoes/executor.ts` monta placeholders `checklist.*`; somente a ação `MATERIALIZAR_CHECKLIST` grava snapshots automaticamente.

**Pendências:** `PainelProximaEtapa` chama `ObterResumoChecklistCardBpm` sem materialização, mostra quantidade/templates e dispara `bpm:abrir-pendencias-checklist`; `PainelRegistrar` abre a aba e foca `checklist-item-<id>`, com fallback para `checklist-pendencias`.

**Ao estender:** não materialize em criação/movimento; preserve snapshot e `@@unique([cardId, templateId])`; mantenha ownership dentro da transação, CAS por `updatedAt`, fail-open em erro de leitura e fail-closed somente para pendência obrigatória confirmada.

**Última atualização:** 2026-09-04 por Codex (encerramento RM-2026-209DB4)

## Alpha CRM — campo de data/hora no modal do card (RM-2026-EB401C)

**Arquivos:** `src/app/PainelAlpha/AlphaCRM/CardModal/BpmDateTimeField.tsx`, `PainelProximoContato.tsx`, `PainelReuniao.tsx`, `PainelTarefasPorTipo.tsx`, `CardFullViewModal.tsx`, `CardOpenFormSlot.tsx`, `src/lib/format-date.ts`, `src/lib/bpm/rascunho-versionado.ts` e `src/lib/validations/bpm.ts`.

**Propósito:** padronizar a seleção assistida, o timezone, o autosave e a reabertura dos instantes editáveis no card do CRM.

**Editado quando:** um novo instante do `BpmCard`/`BpmTarefa` for exposto no modal, um campo existente mudar entre obrigatório e nullable, ou o contrato de data/hora aceito pelas Server Actions mudar.

**Como adicionar:**
1. Renderize `BpmDateTimeField` no consumidor e mantenha no estado apenas `YYYY-MM-DDTHH:mm` civil.
2. Na carga/realtime, use `formatarDataHoraLocalBpm(instante)`; antes da action, use `parseDataHoraLocalBpm(valor)` e envie `Date`/ISO com timezone. Não use `new Date(valorCivil)` nem o timezone do navegador.
3. Para autosave, registre a Promise real no `CardSaveContext`; para estado editável durante requests/realtime, use o rastreador versionado e não remonte o painel com `key={updatedAt}`.
4. Propague o gate `isAdminRole(role) || (vinculado && permissaoEtapa.podeAgir)` ao controle e mantenha auth/ownership na action. Habilite `allowClear` somente se o schema e a coluna aceitarem `null`.
5. Campos somente de data (`YYYY-MM-DD`) são valores civis distintos e não devem passar pelos helpers de instante.
6. Cubra round-trip em processo com timezone diferente, entrada inválida, valor nulo/obrigatório, concorrência, blur + `flushSaves()` e reabertura.

**Caminho de acesso:** `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → card → **Formulário da Etapa** ou aba **Tarefas** → `BpmDateTimeField` → action → persistência → reabertura.

**Última atualização:** 2026-09-04 por Scribe (fechamento RM-2026-EB401C)

---

## Filtro por responsável no board Kanban do Alpha CRM (RM-2026-70EFE1, 2026-09-02)

**Onde está implementado:**
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` — único arquivo tocado.

**Como funciona (fluxo):**
1. Usuário abre `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` — board já carrega `cards` com `membros[].usuario.{id,nome}` (via `ListarCardsPipelineBpm`, sem alteração).
2. `responsaveisDisponiveis` (`useMemo`) deduplica os `usuario.id/nome` de todos os `cards` carregados e ordena por nome.
3. `Select` shadcn no header (ao lado do botão "Atualizar") lista "Todos os responsáveis" + cada responsável único.
4. `onValueChange` atualiza `responsavelFiltro` (estado local, `string | null`); `getByEtapa(etapaId)` passa a exigir também `c.membros.some(m => String(m.usuario.id) === responsavelFiltro)` quando o filtro está ativo.
5. Filtro é 100% client-side e em memória — nenhuma chamada de rede nova, nenhuma persistência; recarregar a página reseta o filtro para "Todos os responsáveis".

**Não afetado pelo filtro:** rotas, permissões (`exigirAcessoBpmPipeline`/`exigirAcessoBpmCard` inalteradas), drag-and-drop (`activeCard`/`DragOverlay` leem o array `cards` bruto, não `getByEtapa`), realtime e `recarregarCards`.

**Última atualização:** 2026-09-02 por Scribe

---

## Exclusão de card no Alpha CRM — `ExcluirCardBpm` (RM-2026-C99F86, 2026-09-01)

**Onde está implementado:**
- `src/actions/bpm/Cards.ts` — `ExcluirCardBpm` (Server Action, `"use server"`)
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx` — botão `Trash2` + `AlertDialog` de confirmação
- `src/lib/bpm/realtime.ts` — `"CARD_EXCLUIDO"` em `BPM_REALTIME_TIPOS`

**Como funciona (fluxo):**
1. Usuário abre `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → clica num card → `CardFullViewModal` → `CardAbertoLayout`
2. Botão `Trash2` visível quando `podeGerenciarMembros` (RESPONSAVEL/ADMINISTRADOR do card, ou Admin/CEO/TI global)
3. Clique → `AlertDialog` "Excluir card" → mensagem "irreversível" → botão "Excluir"
4. `ExcluirCardBpm(cardId)` → `auth()` → `exigirAcessoBpmCard(cardId, userId, userRole, "excluirCard")` → `db.$transaction(tx => tx.bpmCard.delete(...))` → `notificarPipelineBpm({ tipo: "CARD_EXCLUIDO" })` → `revalidatePath`
5. `toast.success("Card excluído com sucesso")` → `onClose()` → board atualizado

**Dependências de permissão:**
- `excluirCard` em `PERMISSOES_POR_ROLE` (`src/lib/bpm/ownership.ts`) — mapeado para RESPONSAVEL e ADMINISTRADOR (card-roles), não para PARTICIPANTE
- Bypass global: `isAdminRole` (Admin/CEO/TI) — aplicado em `checarAcessoBpmCard`
- Verificação real no servidor; gate visual no client é apenas UX

**Cascades do schema (sem limpeza manual):**
- `BpmCardCampoValor`, `BpmCardMembro`, `BpmTarefa`, `BpmCardAnexo`, `BpmCardHistorico`, `BpmInteracaoCard`, `BpmChecklistFollowUp`, `BpmCardVinculo` — todos `onDelete: Cascade`
- `Indicacao.bpmCardId` — `onDelete: SetNull` (Indicacao permanece, perde vínculo)

**Última atualização:** 2026-09-01 por Scribe

---

## Tabs de Serviços no Card do Alpha CRM — novo consumidor de `getServicosComerciais()` (RM-2026-29F59C, 2026-09-01)

**Onde está implementado:**
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx` — `useEffect` no header do card chama `getServicosComerciais()` (`src/actions/ContratoComercial.ts:586`, Server Action já existente e autenticada, sem alteração), mescla com `SERVICOS_COMERCIAIS_PADRAO` (`src/lib/comercial/servicos.ts`) e alimenta as `TabsTrigger` de serviço.

**Ação/model reutilizado (nenhuma action nova criada):**
- `getServicosComerciais()` — já era consumida por `ModalGerenciamentoLeads.tsx`, `ModalNovaIndicacao.tsx`, `AbaServicos.tsx`. `CardAbertoLayout.tsx` é o 4º ponto de consumo, mesmo padrão de merge com o catálogo padrão.
- Model `ServicosComerciais` (`prisma/schema.prisma:1639`) — sem migration, sem campo novo.

**Trigger/navegação:** clique na `TabsTrigger` altera state local `abaAtiva`; sem rota nova, sem API HTTP nova.

---

## Aba Tarefas do card CRM — exibição completa de campos (RM-2026-1BA46D, 2026-09-01)

**Onde está implementado:**
- `src/actions/bpm/Cards.ts` — `ObterCardBpm`, `include.tarefas` ganhou `responsavel: { select: { id, nome } }`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelTarefasPorTipo.tsx` — renderização ampliada (título, descrição, prioridade, status, prazo, alerta, responsável, concluída em)

**Como funciona (fluxo):**
1. Usuário abre `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → clica num card → `CardFullViewModal`/`PainelHistorico` → aba "Tarefas"
2. `PainelTarefasPorTipo` recebe a lista de `BpmTarefa` já carregada por `ObterCardBpm` (com `responsavel` incluído)
3. Cada tarefa é renderizada com todos os campos disponíveis, condicionalmente (campos vazios não geram bloco vazio)
4. Ao criar/concluir tarefa, `onAtualizado()` reconsulta o card — lista atualiza sem refresh manual

**Dependência de integração:** o campo "Responsável" depende exclusivamente do `include` em `ObterCardBpm` — se outro ponto do código também buscar tarefas de um card (fora de `ObterCardBpm`), precisará do mesmo `include` para exibir o responsável.

**Sem novo endpoint, rota ou permissão** — reaproveita os gates de acesso já existentes do módulo `bpm`.

**Última atualização:** 2026-09-01 por Scribe

---

## Formulário de criação de tarefas — prazo e alerta (RM-2026-66F07D, 2026-09-01)

**Onde está implementado:**
- `src/app/PainelAlpha/PainelTarefas/GerenciarTarefas/page.tsx` — modal "Nova Diretriz" com campos `dataInicio` (date), `horario` (time), `alerta` (select 7 opções)
- `src/actions/Tarefas.ts` — `CriarTarefa` aceita `alerta?: string` e persiste via raw SQL (best-effort)
- `src/lib/tarefas/schemas.ts` — `ALERTA_OPCOES`, `CriarTarefaSchema`, `alertaChaveParaMinutos()`

**Como funciona (fluxo):**
1. Usuário abre `/PainelAlpha/PainelTarefas/GerenciarTarefas?id=<userId>`
2. Clica "Nova Ordem" → modal "Nova Diretriz" abre
3. Preenche: texto, descrição, prioridade (select), data de início (date), horário (time), alerta (select predefinido)
4. Submit → `CriarTarefa` (Server Action) → persistência via Prisma + raw SQL (alerta)
5. `toast.success("Diretriz lançada!")` → `carregarDados()` → listagem atualizada

**Integrações conhecidas:**
- **Alpha CRM (BPM):** o model `BpmTarefa` já possui `prazo`, `alertaEm`, `alertaDisparadoEm` — infraestrutura de dados pronta. O formulário de `PainelTarefas` usa o model `Tarefa` (diferente de `BpmTarefa`).
- **Sistema de notificação:** NÃO existe — o campo `alerta` é persistido mas não dispara nenhuma notificação. Limitação conhecida, não bloqueio.

**Como adicionar notificação real (futuro):**
1. Criar worker/queue que lê `Tarefa.alerta` + `Tarefa.dataInicio` + `Tarefa.horario`
2. Calcular `alertaEm = dataInicio + horario - antecedência(minutos)`
3. Disparar notificação (push/e-mail) quando `now >= alertaEm`
4. Marcar `alertaDisparadoEm` (coluna já existe em `BpmTarefa`, não em `Tarefa`)

**Última atualização:** 2026-09-01 por Scribe

---

## Pré-preenchimento de campos conhecidos no GerarDocumentoForm (RM-2026-1D1118, 2026-09-01)

**Onde está implementado:**
- `src/components/GeradorDocumentos/GerarDocumentoForm.tsx` — função pura `prePreencherVariaveis()` + chamadas em `selecionarCliente()`, `handleEmpresaCriada()`, `handleSelecionarContratada()`
- `src/actions/gerador-documentos.ts` — `BuscarClientesParaContratante` (select inclui `cnpj`, `email`, `telefone`, `razaoSocial`, `nomeFantasia`)

**Como funciona (fluxo):**
1. Usuário digita busca → debounce 300ms → `BuscarClientesParaContratante(termo)` → lista de `ClienteResumo`
2. Usuário clica num resultado → `selecionarCliente(cliente)` → `prePreencherVariaveis(prev, template.variaveis, { cnpj, documento, razaoSocial, nomeFantasia, email, telefone })` → `setValores(novo)`
3. Para Contratada: `handleSelecionarContratada(id)` → busca empresa em `empresasContratadas` → `prePreencherVariaveis(prev, template.variaveis, { cnpj, documento, razaoSocial, nomeFantasia })` → `setValores(novo)`
4. Para empresa nova criada: `handleEmpresaCriada(empresa)` → mesmo padrão

**Como adicionar um novo campo ao pré-preenchimento:**
1. Confirmar que o campo existe no model (`Cliente` ou `EmpresaContratada`)
2. Adicionar ao `select` da action de busca (`BuscarClientesParaContratante` ou `ListarEmpresasContratadas`)
3. Adicionar ao objeto de dados passado a `prePreencherVariaveis()` nos 3 pontos de chamada
4. O nome da chave no objeto DEVE ser igual ao nome da variável no template (ex.: `cnpj`, `email`, `telefone`)

**Limitações:**
- Só nome exato de campo, não semântica (ex.: "documento" mapeia para `cnpj` porque o objeto passa `{ documento: cliente.cnpj }`)
- Só campos estruturais (CNPJ, CPF, e-mail, telefone, razão social, nome fantasia) — campos dinâmicos de etapa não são cobertos
- Não sobrescreve valor já digitado pelo usuário
- Campo continua editável (não `disabled`)

## Autosave em Cards CRM — componentes com registerSave (RM-2026-5BDA0D, 2026-09-01)

**Padrão obrigatório:** qualquer componente editável com autosave-on-blur/onChange dentro de `CardSaveProvider` DEVE registrar via `registerSave` do `CardSaveContext`. Nunca chamar a Server Action diretamente.

**Componentes que usam `registerSave` (lista completa):**

| Componente | Campo(s) | Trigger | Server Action |
|---|---|---|---|
| `PainelCamposEtapaAtual.tsx` | campos dinâmicos (`BpmCampo`) | `onBlur` | `AtualizarCardBpm` |
| `PainelProximoContato.tsx` | `proximoContatoEm` | `onBlur` | `AtualizarCardBpm` |
| `PainelStatusPosFechamento.tsx` | `statusPosFechamento` | `onChange` | `AtualizarCardBpm` |
| `PainelChecklistFollowUp.tsx` | respostas do checklist | `onBlur` | `SalvarChecklistFollowUpBpm` |

**Componentes intencionalmente fora (botão explícito, não autosave):**

| Componente | Ação | Motivo |
|---|---|---|
| `PainelReuniao.tsx` | "Agendar" | ação deliberada, não autosave |
| `PainelStandbyFollowUp.tsx` | "Interromper" | ação destrutiva com confirmação |
| `SeletorMembrosCard.tsx` | clique em membro | ação deliberada, não autosave |

**Consumidor:** `PainelProximaEtapa.handleMover` → `flushSaves()` → se `true` → `MoverCardBpm`.

**Novo componente editável no card?** Se usa autosave-on-blur/onChange, registrar via `registerSave`. Se usa botão explícito, não precisa.

## Card virtual de lead do site — visualização + promoção (RM-2026-948ED5, 2026-09-01)

**Novo ponto de integração:** `NolossLeadModal` (`src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NolossLeadModal.tsx`) — modal bottom-sheet dedicado à visualização de `NolossLead` pendente (status `pending`).

**Fluxo de clique:** `KanbanCard.onClick` → `abrirCard()` em `PipelineBoardClient.tsx` → se `card.origem === "noloss"` → `setNolossLeadAberto(card)` → `NolossLeadModal` renderiza. Se `origem !== "noloss"` → `CardFullViewModal` (comportamento inalterado).

**O modal é agnóstico ao tipo de card:** `CardFullViewModal` continua sendo o modal para `BpmCard` nativos (incluindo cards promovidos de `NolossLead`). `NolossLeadModal` é um componente separado, mais simples, que exibe apenas os dados do lead pendente e oferece a ação de promoção. Não há conflito entre os dois — a detecção é feita no `abrirCard()` antes de qualquer renderização.

**Props do `NolossLeadModal`:** `card` (objeto `CardBpm` com `nolossEmail?`, `nolossTelefone?`), `onPromover` (callback que dispara `PromoverNolossLead`), `onClose`.

**Dados disponíveis no card virtual:** `nome`, `nolossEmail`, `nolossTelefone`, `createdAt` (data de recebimento). Campos nulos exibidos como `"—"`.

**Integração com promoção:** o botão "Assumir lead" abre `AtribuirResponsavelPromocaoModal` (componente existente) que lista responsáveis elegíveis (`ListarUsuariosResponsavelBpm`) e dispara `PromoverNolossLead` com `nolossLeadId`, `etapaDestinoId` e `responsavelId`.

## Card BPM — restrição de campos na etapa Novos Leads (RM-2026-5830C2, 2026-08-31)

`KanbanCard` (`PipelineBoardClient.tsx`) é o único ponto de renderização do card no Kanban. A restrição de campos na etapa "Novos leads" se aplica exclusivamente a esse componente — o detalhe do card (`CardFullViewModal` → `PainelCamposEtapaAtual`) é um modal separado com renderização própria e não é afetado. Não existe variante mobile separada do Kanban. A tela de configuração de pipelines (`AdminPipelineClient.tsx`) não exibe cards.

**Padrão de leitura de campo dinâmico (reaproveitável):** `card.campoValores?.find(campo => campo.campo.nome === "<nome>")?.valor` — mesmo padrão já usado para `canalOrigem` (linha ~176). Qualquer novo campo dinâmico a exibir no card deve seguir esse mesmo padrão, nunca uma query separada.

## Contratante + busca na listagem de documentos gerados (RM-2026-DC0043, 2026-08-31)

Ponto de integração: `ListarDocumentosGerados` (`src/actions/gerador-documentos.ts`) é a única fonte de dados da tab "Documentos gerados" (`GeradorDocumentosClient.tsx`) — carrega tudo de uma vez (sem paginação), então qualquer campo novo de exibição/filtro precisa entrar no `select` dessa action, nunca em uma query separada.

**Padrão de busca client-side com debounce (reaproveitável):** lógica de filtro extraída para função pura em `src/lib/gerador-documentos/busca.ts` (`filtrarDocumentosPorBusca`), aplicada via `useMemo` no componente sobre o estado já carregado — mesmo padrão de "carregar tudo + filtrar no client com `Input` shadcn + debounce 300ms" já usado em outras listagens do projeto (ex. `ParceirosClient.tsx`). Extrair o filtro para uma função pura testável (em vez de inline no componente) é o padrão preferido quando a lógica de match cobre mais de um campo (aqui: título OU nome do contratante).

## Botão Voltar na página de geração de documento (RM-2026-2AB551, 2026-08-31)

Botão Voltar na rota `/PainelAlpha/GeradorDocumentos/gerar?templateId=<id>` (`GerarDocumentoForm.tsx`) → tela anterior do fluxo (`/PainelAlpha/GeradorDocumentos/[templateId]`, detalhe do template com CRUD de cláusulas/variáveis). Navegação client-side via `router.back()` com fallback `router.push()`; ambas as rotas de origem e destino compartilham a mesma proteção (`auth()` + permissão `geradorDocumentos`).

## Módulo com iframe de sistema externo protegido por token (2026-08-28)

Padrão confirmado com o módulo `ChatBot Alpha` (`src/actions/ChatBotAlpha.ts`, `src/app/PainelAlpha/ChatBotAlpha/`, `src/components/ChatBotAlpha/`): sempre que um módulo embute um sistema externo via iframe e a URL exige token/segredo:

1. **Nunca `NEXT_PUBLIC_*`** para a env var do token — só para URLs realmente públicas (ver `NEXT_PUBLIC_INSTAGRAM_STUDIO_URL` em `Marketing/page.tsx`, que não tem segredo).
2. **A URL final com token só é montada dentro de uma Server Action**, no momento da chamada, nunca pré-carregada em lote no client. Guard de autorização (`isAdminRole` ou equivalente) roda ANTES de montar a URL.
3. **Se a env var (URL ou token) estiver ausente, retorna erro tratado** (`"Sistema não configurado"`) — nunca deixa a URL final com `undefined` literal.
4. **Nenhum caminho de erro exibe a URL/token** — diferente do precedente `MarketingClient.tsx` (que mostra a URL no erro porque ela é pública), um iframe com token nunca deve reutilizar esse padrão de debug.
5. Checklist obrigatório de novo módulo (FormCadastro.tsx) confirmado OBSOLETO de novo — `ModalGerenciarSetor.tsx`/`ModalOverrideUser.tsx`/`PreviewModulosSetor.tsx` já consomem `MODULOS_REGISTRY` dinamicamente (`m.permission && !m.adminOnly`); só a entrada no registry é necessária.

## Links Externos — gaveta "Sistema Externo" na sidebar (2026-08-28)

Novo integration point: adicionar um link externo (sistema fora do PainelAlpha) é feito **inteiramente pela UI**, dentro da própria gaveta "Sistema Externo" na sidebar — nunca direto no banco, nunca por código.

1. **Quem gerencia:** só Admin/CEO/TI (`isAdminRole`). Botão "+" no header da gaveta (ou "+ Inserir sistema externo" quando vazia) abre `src/components/layout/ModalLinkExterno.tsx`.
2. **Visibilidade por link:** campo `LinkExterno.visivelPara` — `"TODOS"` ou CSV de roles (`ROLES_CONHECIDOS` em `src/lib/validations/link-externo.ts`). Distinto do sistema de `permission` de módulos (`ModuloRegistryItem`) — não entra no `FormCadastro.tsx`, não é um "módulo" no sentido do checklist de novo módulo.
3. **Backend:** `src/actions/LinksExternos.ts` — `ListarLinksExternosVisiveis()` (sem guard, filtro de visibilidade sempre no server) é o que `layout.tsx` chama para popular a sidebar; `ListarLinksExternosGestao/CriarLinkExterno/AtualizarLinkExterno/ExcluirLinkExterno` exigem `isAdmin`.
4. **Reordenação NÃO existe** — `ReordenarLinksExternos` foi implementada e depois removida (decisão do usuário, 2026-08-28) por falta de UI consumidora. Se pedirem no futuro, criar do zero com UI real (botões ↑↓ ou drag-and-drop), não reaproveitar código antigo (já foi deletado).
5. **Renderização na sidebar é um bloco SEPARADO** dos 10 grupos funcionais estáticos (`GRUPOS_SIDEBAR`) — não é um 11º item desse array. Motivo: dado dinâmico do banco (não `MODULOS_REGISTRY`), regra especial de "sempre visível pra admin mesmo vazio", controles de CRUD inline que os outros grupos não têm.

## Grupo funcional de módulo na sidebar (gaveta colapsável) — 2026-08-28

Novo integration point: agrupar um módulo dentro de uma "gaveta" (accordion) da `GlobalSidebar` é **1 campo** no item do módulo, não um arquivo separado.

1. **`src/lib/modulos-registry.ts`** — em `MODULOS_REGISTRY`, adicionar `grupo: '<id-do-grupo>'` ao item do módulo. O id deve bater com um `GrupoSidebarItem.id` existente em `GRUPOS_SIDEBAR` (mesmo arquivo). Sem `grupo`, o módulo renderiza solto (fora de qualquer gaveta) — comportamento correto para módulos de uso raro/isolado (ex: `metas`, `roadmap`).
2. **Novo grupo do zero:** adicionar entrada em `GRUPOS_SIDEBAR` (`id`, `label`, `iconName` — `iconName` precisa existir em `ICON_MAP` de `GlobalSidebar.tsx`, senão cai no fallback `Layers`).
3. **Ocultar um módulo da navegação sem remover do sistema:** `hidden: true` no item do `MODULOS_REGISTRY` — filtrado antes de qualquer outra lógica (busca, grupo, pin) em `GlobalSidebar.tsx`. Não afeta banco/permissões, só a navegação visual.
4. **Bloco Admin (`category: 'admin'`) não usa esse sistema de grupos** — continua como seção fixa própria, sem accordion, por decisão explícita do usuário (2026-08-28).
5. Nenhuma outra tela precisa ser tocada — `GRUPOS_SIDEBAR`/`grupo`/`hidden` são consumidos apenas por `GlobalSidebar.tsx`. `TabBar.tsx` (outro consumidor de `MODULOS_REGISTRY`) só faz `.find()` por `href`, não depende desses campos.

## AlphaCRM/BPM — Form de adição de card: serviço derivado do pipeline (RM-2026-54DC86, 2026-08-26)

**Objetivo:** documentar o ponto de integração entre o form de criação de card e o pipeline de destino, após a remoção do campo "serviço" do form.

### Ponto de integração: form de card ↔ pipeline (serviço derivado)

**Arquivo:** `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx`
**Propósito:** Único form de criação de card para todos os pipelines do Alpha CRM
**Editado quando:** Novos campos forem adicionados ao form de criação de card, ou o fluxo de criação mudar

**Como funciona (após RM-2026-54DC86):**
- O form **NÃO tem campo "serviço"** — o serviço é derivado automaticamente do `nome` do pipeline de destino
- `CriarCardBpm` (`src/actions/bpm/Cards.ts`) resolve: `servico: (await tx.bpmPipeline.findUnique({where:{id: pipelineId}, select:{nome:true}}))?.nome ?? null`
- O `pipelineId` vem da rota (`/PainelAlpha/AlphaCRM/pipeline/[pipelineId]`) — nunca do payload do cliente
- `criarCardSchema` (`src/lib/validations/bpm.ts`) **não aceita** `servico` no payload de criação

**Checkpoint de verificação:**
- [ ] Form NÃO deve ter campo "serviço" (input, state, payload)
- [ ] `criarCardSchema` NÃO deve ter `servico` como campo
- [ ] `CriarCardBpm` DEVE derivar `servico` de `bpmPipeline.nome`
- [ ] `atualizarCardSchema` (edição) PODE manter `servico` — edição é caso distinto

**Dependência:** form depende de `pipelineId` (da rota) para resolver o serviço. Se o pipeline não existir, `servico` cai em `null` (coluna nullable, sem crash).

**CNPJ como campo-chave para pesquisa de empresa (atualizado em RM-2026-35BA39, ver abaixo para a implementação atual — a versão anterior desta nota, com `formatarCnpjInput()` local, foi substituída pelo utilitário compartilhado):**
- Modo busca: `BuscarEmpresasBpm` normaliza o termo (`normalizarCNPJ`) antes da query `contains` na coluna `cnpj`
- Modo cadastro: `novaEmpresa.cnpj` → `formatarCNPJProgressivo()` (exibição) → `normalizarCNPJ()` (submit) → `cliente.cnpj` (banco)
- **Nunca** armazenar CNPJ formatado no banco — sempre dígitos puros

**Última atualização:** 2026-08-26 por Scribe

---

## Máscara de CNPJ no CRM — caminho completo de integração (RM-2026-35BA39, 2026-09-04)

Caminho ponta a ponta, do input até a busca, para todos os pontos de entrada/saída de CNPJ no Alpha CRM:

```
ENTRADA (digitação em input)
  NovoCardModal.tsx (cadastro de empresa nova)
  ou CampoBpmInput.tsx (campo dinâmico da etapa, tipo "cnpj" ou legado nome exato "CNPJ")
    → onChange: valor cru do usuário → normalizarCNPJ() (state React sempre guarda dígitos puros)
    → render: formatarCNPJProgressivo(state) (máscara 00.000.000/0000-00 aplicada em cada estágio)

NORMALIZAÇÃO (client → antes do submit)
  → normalizarCNPJ() novamente no submit (garante que o payload enviado ao servidor já são dígitos puros)

ACTION (server-side, nunca confia no client)
  Cadastro novo: novaEmpresaCardSchema (Zod, src/lib/validations/bpm.ts) → transform(normalizarCNPJ) → exige exatamente 14 dígitos → CriarCardBpm (src/actions/bpm/Cards.ts) normaliza de novo antes de gravar
  Campo dinâmico: AtualizarCardBpm → validarValoresCamposBpm (src/lib/bpm/campos-dinamicos.ts) → campoBpmEhCnpj() detecta o campo → cnpjEhValido() valida dígito verificador → normalizarCNPJ() antes do upsert

PERSISTÊNCIA (sempre 14 dígitos puros, nunca formatado)
  Cliente.cnpj (cadastro de empresa) | BpmCardCampoValor.valor (campo dinâmico tipo "cnpj" ou legado nome "CNPJ")

BUSCA (aceita cru ou formatado, resultado equivalente)
  BuscarEmpresasBpm (src/actions/bpm/Cards.ts) → normalizarCNPJ(termo) || termo → db.cliente.findMany({ cnpj: { contains } }) → resultados formatados na UI via formatCNPJ()

EXIBIÇÃO (read-only, nunca reformata o valor persistido)
  CardAbertoLayout.tsx (header) | DadosEmpresaConteudo.tsx (gaveta "Dados da empresa") | PerfilEmpresaModal.tsx (perfil global)
    → formatCNPJ(cnpj) ?? cnpj (fallback seguro se o valor legado não fechar em 14 dígitos)
```

Fonte única: `src/lib/format-cnpj.ts` (`normalizarCNPJ`, `formatarCNPJProgressivo`, `formatCNPJ`, `cnpjEhValido`). Nenhum consumidor implementa regex própria de máscara/validação — ver `.bibble/memory/decisions.md` para a decisão de separação apresentação × persistência.

**Última atualização:** 2026-09-04 por Scribe (sessão Bibble, fechamento RM-2026-35BA39)

---

## AlphaCRM/BPM — NoLoss leads como cards virtuais na coluna "Novos leads" do pipeline "Revisão de Radar" (2026-08-24)

**Objetivo:** um lead que preenche o formulário do site e cai no Alpha NoLoss (audience "Leads") aparece como **card virtual** na coluna "Novos leads" do pipeline "Revisão de Radar" — sem criar `Cliente`/`BpmCard` reais ainda. Só quando um usuário **arrasta esse card virtual para outra coluna** é que o sistema pede um responsável e materializa `Cliente` + `BpmCard` reais numa transação. Ver padrão geral "card virtual" em `architecture.md`.

### Schema — `NolossLead` (staging, migration aplicada em produção)

```prisma
model NolossLead {
  id                 String    @id @default(cuid())
  nolossContactId    String    @unique
  nolossSubmissionId String?
  nome               String?
  email              String?
  telefone           String?
  utmSource          String?
  utmMedium          String?
  utmCampaign        String?
  status             String    @default("pending") // pending | promoted | dismissed
  promotedClienteId  Int?
  promotedCardId     String?
  promotedAt         DateTime?
  promotedByUserId   Int?
  receivedAt         DateTime  @default(now())

  promotedCliente Cliente?  @relation(fields: [promotedClienteId], references: [id])
  promotedCard    BpmCard?  @relation(fields: [promotedCardId], references: [id])
  promotedByUser  usuarios? @relation(fields: [promotedByUserId], references: [id])

  @@index([status])
}
```

Relações inversas: `usuarios.nolossLeadsPromovidos`, `Cliente.nolossLeadsPromovidos`, `BpmCard.nolossLeadOrigem`. **Migration aplicada em produção** no Turso `basetestes-alphacomex` via script Node pontual com `@libsql/client` (`prisma db push`/`migrate` não alcançam o Turso neste projeto — ver `decisions.md`, 2026-07-06), aprovada pelo Vault (`CREATE TABLE` puro, sem risco, 🟢 em todos os statements). Backup pré-mudança gerado e validado antes de aplicar: 72,17MB, 181.875 linhas, 242 tabelas (`database-backups/pre-change/painelalpha_turso_pre_change_noloss-lead_2026-08-24T23-59-15-164Z.sql`).

### Arquivos criados

- **`src/lib/bpm/noloss-leads.ts`** — helper `buscarNolossLeadsPendentes()`, fonte única da query de `NolossLead` com `status:"pending"`, reaproveitado por `Cards.ts` e `NolossLeads.ts` (evita duplicar a query).
- **`src/app/api/bpm/noloss-leads/ingest/route.ts`** — Route Handler **público, sem sessão de usuário** (é o NoLoss batendo, não um humano logado). Auth por segredo compartilhado no header `x-noloss-webhook-secret`, comparado contra `process.env.NOLOSS_WEBHOOK_SECRET` — **mesmo padrão já existente** em `src/app/api/onyx/agent-tools/[tool]/route.ts` (função `checkSecret`, comparação por tamanho+igualdade, "sem segredo configurado = bloqueado"). Faz `upsert` em `NolossLead` por `nolossContactId`, **idempotente a retry do NoLoss**: se o lead já existe, sempre `update` (nunca `create`, que fixaria `status:"pending"` de novo) e o payload de `update` nunca inclui `status` — um reenvio nunca reverte um lead já `promoted`/`dismissed` de volta para `pending`, só atualiza nome/email/telefone.
  - **⚠️ Limitação real do NoLoss, não resolvida nesta sessão:** o node "Webhook" das campanhas do NoLoss só suporta placeholders simples sobre campos **nativos** do contato (`{{contact.email}}` etc.) — **sem acesso a custom fields**, onde ficam `utm_source`/`utm_medium`/`utm_campaign` capturados no form. Essas 3 colunas existem no schema mas **nunca são preenchidas** nesta v1. Corrigir exigiria o endpoint de ingest fazer uma segunda chamada de volta pro NoLoss buscando os custom fields — mas o NoLoss **não tem API autenticável por token** hoje (só sessão de admin). Fica como melhoria futura explícita, não bloqueando o MVP.
- **`src/actions/bpm/NolossLeads.ts`** — `PromoverNolossLead({nolossLeadId, etapaDestinoId, responsavelId})`. **Decisão confirmada do usuário: Server Action, não Route Handler HTTP** — mantém consistência com o resto do Kanban (`MoverCardBpm`/`CriarCardBpm` já são Server Actions). Fluxo: valida `etapaDestinoId` pertence de fato ao pipeline "Revisão de Radar" resolvido no servidor (nunca confia no ID cru do client — isolamento de tenant/pipeline), valida `responsavelId` via `usuarioElegivelResponsavelBpm` (mesma função de `CriarCardBpm`), depois dentro de `db.$transaction`: **CAS** via `tx.nolossLead.updateMany({where:{id,status:"pending"}}, data:{status:"promoted"})` — se `count !== 1`, alguém já promoveu esse lead (double-click ou dois usuários arrastando ao mesmo tempo), aborta sem criar nada; senão cria `Cliente` (`razaoSocial: nome ?? email ?? "Lead sem nome"`, `cnpj: null` — `Cliente.cnpj` é nullable) + `BpmCard` reais, e atualiza o `NolossLead` com `promotedClienteId`/`promotedCardId`/`promotedAt`/`promotedByUserId`. Dispara `notificarPipelineBpm` (Pusher, tipo `"CARD_CRIADO"`) após a transação para o board atualizar em tempo real para todos os usuários.
  - **Removida durante a sessão (achado do Lens):** `ListarNolossLeadsPendentes` foi implementada inicialmente como uma 2ª Server Action de leitura, mas **removida** por não ter nenhum consumidor real no sistema — o merge de leads virtuais no board acontece direto dentro de `ListarCardsPipelineBpm` via `buscarNolossLeadsPendentes()`. **Se uma tela futura precisar só da lista de leads pendentes sem carregar o board inteiro**, recriar essa Server Action nesse momento (é trivial, a lógica já existe no helper).
- **`AtribuirResponsavelPromocaoModal.tsx`** (`src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/`) — modal "quem assume esse lead?", réplica **exata** do padrão de seletor de responsável já usado em `NovoCardModal.tsx` (mesmo `useEffect` chamando `ListarUsuariosResponsavelBpm` ao montar, mesmo `<select>`, mesma estrutura visual `Dialog`/paleta `slate-900`). **Decisão de qualidade do Lens:** a duplicação de ~15 linhas entre os dois modais é aceitável (propósitos diferentes — um cria card, outro promove lead — e o projeto já tem a regra de não abstrair prematuramente com só 2 ocorrências). Só extrair um hook compartilhado (`useResponsaveisBpm(pipelineId)`) se um 3º modal precisar do mesmo seletor.
- **Testes** (`tests/bpm/`): `noloss-leads-schema.test.ts` (6), `promover-noloss-lead.test.ts` (11), `noloss-leads-ingest-route.test.ts` (10) — 27/27 passando. Cobrem schema Zod, happy path, CAS de concorrência (`updateMany` retornando `count:0`), tenant isolation (`etapaDestinoId` de outro pipeline rejeitado), idempotência do webhook (reenvio nunca reverte `status` promovido), e fallback de `razaoSocial` (nome → email → "Lead sem nome").

### Arquivos editados

- **`src/lib/validations/bpm.ts`** — novo `promoverNolossLeadSchema` (`nolossLeadId`/`etapaDestinoId`: cuid, `responsavelId`: int positivo).
- **`src/actions/bpm/Cards.ts`, `ListarCardsPipelineBpm`** — depois de montar os `BpmCard` reais, se o pipeline for "Revisão de Radar" (via `pipelineEhRevisaoRadar`) **e** a etapa "Novos leads" existir, concatena os `NolossLead` `status:"pending"` como cards virtuais no **mesmo formato** de `CardBpm`, com 2 campos novos: `origem: "real"|"noloss"` e `nolossLeadId: string|null`. Campos que um `BpmCard` real tem mas o lead virtual não tem recebem valores "neutros" sensatos: `empresa:{id:0, razaoSocial: lead.nome||lead.email||"Lead sem nome", nomeFantasia:null}`, `responsavel:{id:0, nome:"Sem responsável"}`, `membros:[]`, `_count:{tarefas:0,anexos:0}`, `tarefas:[]`, `campoValores:[]`.
  - **⚠️ Sentinela `id:0` — regra permanente para qualquer código futuro que toque `CardBpm`:** `id:0` nunca existe em `Cliente`/`usuarios` de verdade (autoincrement começa em 1), mas essa garantia hoje vive **inteiramente do lado da UI** (`PipelineBoardClient.tsx` bloqueia abrir `CardFullViewModal` para cards virtuais — nunca chega em `CardAbertoLayout.tsx`/`CardOpenShell.tsx`, que usam `card.empresa.id` para lookup real). **Qualquer consumidor futuro de `CardBpm`/`ListarCardsPipelineBpm` DEVE checar `origem==="noloss"` antes de usar `empresa.id`/`responsavel.id` para uma query real** — comentário explícito deixado no código em `Cards.ts` nesse ponto exato.
  - **Decisão de visibilidade confirmada pelo usuário:** leads virtuais visíveis a **qualquer usuário com acesso ao pipeline** — sem o filtro de `membros`/admin que os `BpmCard` reais têm nessa mesma função (`...(admin ? {} : { membros: { some: { userId } } })`). Faz sentido porque o lead ainda não tem responsável definido, não há "membro" pra filtrar por.
- **`PipelineBoardClient.tsx`** — tipo `CardBpm` ganhou `origem`, `nolossLeadId`, `createdAt`. `KanbanCard`: card virtual (`origem==="noloss"`) nunca abre `CardFullViewModal` (nem pelo clique no card nem pelo botão do nome), borda tracejada azul (`border-dashed border-sky-400/40`) para diferenciação visual imediata, badge "Lead do site" com tooltip explicativo + data de recebimento, esconde membros/contadores de tarefas-anexos/bloco de ligações-do-dia (sempre zero nos virtuais, seria só ruído visual). `onDragEnd`: quando o card arrastado é virtual e o destino é uma etapa diferente da atual, **reverte o movimento otimista imediatamente** (`restaurarArrasto`, nunca move o virtual sozinho no banco) e abre `AtribuirResponsavelPromocaoModal` em vez de chamar `MoverCardBpm`; ao confirmar o responsável no modal, chama `PromoverNolossLead` e recarrega os cards — o card real recém-criado substitui automaticamente o virtual no board (o lead saiu de `status:"pending"`, não é mais retornado pelo merge).
- **`.env.example`** — `NOLOSS_WEBHOOK_SECRET` documentada.

### Segurança (Anubis) — 0 críticos, 2 importantes documentados como TODO explícito (decisão do usuário: não corrigir agora)

1. **Sem rate-limit no endpoint de ingest** — com o secret válido, um flood criaria `NolossLead` ilimitados, cada um visível **imediatamente a todo mundo com acesso ao pipeline** (a decisão de visibilidade ampla amplifica o impacto de um flood além de só "banco crescendo"). Sem secret válido, o atacante recebe 401 antes de qualquer escrita. **Correção futura recomendada:** portar o padrão de rate-limit em memória já usado em `preflight-xlsx.ts` do CS&NPS (5/min por IP).
2. **Sem limite de tamanho nos campos do payload nem no body JSON como um todo** — `email`/`firstName`/`lastName`/`phone` são `z.string()` sem `.max()`; um payload gigante seria persistido inteiro e renderizado na UI de todo mundo com acesso ao pipeline. **Correção futura recomendada:** `z.string().max(200)` nos 4 campos + checagem de `content-length` antes do `.json()`.
3. **Informativo, não é um TODO:** comparação de secret não é timing-safe (`length===length && ===`), mas é o **mesmo padrão já aceito** em `onyx/agent-tools` — mantido por consistência; timing attack via rede real é impraticável (ruído de rede >> diferença mensurável).

### Achado colateral, virou task separada (não desta feature)

Durante `tsc --noEmit`, Forge encontrou erros de TypeScript **pré-existentes** (confirmado via `git status`/`git diff` como já modificados **antes** desta sessão) de uma refatoração incompleta do CardModal do CRM: `PainelHistorico.tsx` (JSX desbalanceado após remover `<PainelRequisitosAvanco>`), `CardOpenShell.tsx` (props inexistentes passadas para `PainelHistorico`), `AlphaCRM/pipelines/page.tsx` (import quebrado de `../../../../auth`), `HabilitacaoRadarClient.tsx` (`res.data` possivelmente `undefined`). Spawnada como task separada para o usuário decidir quando resolver — **não corrigido às cegas nesta sessão**, pois não fazia parte do escopo e mexer sem entender a decisão de design da refatoração em andamento seria arriscado.

### Checklist de integração desta sessão

- [x] Scout (blueprint) → Vault (migration aprovada 🟢, backup validado, aplicada) → Echo (backend) → Nova (frontend) → Forge (tsc/lint/build aprovados nos arquivos da feature) → Probe (integração confirmada, único board do sistema, middleware não intercepta `/api/*`) → Anubis (0 críticos, 2 importantes documentados) → Lens (aprovado com ressalvas já corrigidas: função órfã removida, sentinela `id:0` documentado) → Sage (27 testes, 100% passando) → Scribe (esta entrada)
- [x] Migration aplicada em produção com backup + aprovação Vault
- [x] `.env.example` documentado com `NOLOSS_WEBHOOK_SECRET`
- [ ] Rate-limit e limite de tamanho de payload no endpoint de ingest — TODO explícito, não bloqueante, ver seção Segurança acima
- [ ] Configurar o node `webhook-1` da campanha real do NoLoss (`rc-e6732936-04bd-488c-9be4-de0db87215c5`) com a URL de produção + header secreto — ação **fora do código**, pendente de deploy

**Última atualização:** 2026-08-24 por Scribe (sessão Bibble — Scout→Vault→Echo→Nova→Forge→Probe→Anubis→Lens→Sage→Scribe)

---

## Bibble — hardening do pipeline de anexos/PDF (tokens, orçamento por arquivo, protocolo financeiro) (2026-08-24)

**⚠️ Achado arquitetural corrigido nesta sessão — o Bibble roda 100% via Ollama local, não Anthropic/OpenAI.** O CLAUDE.md raiz descreve Anthropic como "futuro padrão para AI", mas o código real (`src/lib/bibble/client.ts`) sempre usou `BIBBLE_MODEL` apontando para um modelo Ollama (`gemma4:e4b` → agora `qwen3.8:latest`), servido por um Ollama remoto em `192.168.35.113` (GPU dedicada, VRAM alta, confirmado pelo usuário). Anthropic/OpenAI/Google existem no código como providers alternativos selecionáveis pelo usuário no seletor de modelo, nunca como padrão. Qualquer sessão futura que for mexer em limites de token/contexto do Bibble deve tratar Ollama como o path real, não os providers remotos.

**Gatilho da sessão:** usuário relatou que o Bibble não conseguiu produzir uma conciliação bancária a partir de 3 PDFs de extrato Mercado Pago + lista de valores já justificados — resposta cortada/incompleta. Diagnóstico revelou 4 causas reais no pipeline (`src/app/api/bibble/chat/route.ts`), corrigidas nesta sessão:

1. **Anexo desligava todas as tools e virava geração única** (`toolsForTurn = hasAttachments ? [] : toolsToUse`) — mantido por design (protege contra misturar conteúdo não confiável do arquivo com ações no sistema), mas a geração única agora pode se **auto-continuar**.
2. **Teto de output travado em 4096 tokens mesmo com anexo** — `calculateRequestBudget` nunca olhava `hasPdf` na hora de decidir `outputTokenLimit`.
3. **3 PDFs competiam pelo mesmo orçamento sequencial** — o primeiro arquivo processado podia esgotar o orçamento e deixar os seguintes sem nenhum texto útil (causa mais provável da falha relatada, com 3 extratos).
4. **System prompt sem nenhum protocolo para tarefa financeira/contábil estruturada**.

### O que mudou (arquivos e comportamento)

- **`src/lib/bibble/context-budget.ts`**
  - `ATTACHMENT_CONTEXT_WINDOW_TOKENS` (131072, env `BIBBLE_ATTACHMENT_CONTEXT_WINDOW`) e `ATTACHMENT_OUTPUT_TOKEN_LIMIT` (16384, env `BIBBLE_ATTACHMENT_OUTPUT_TOKENS`) — novo piso/teto usado **somente quando `hasPdf === true`**. `resolveEffectiveContextWindow` agora usa `Math.max(providerDefault, ATTACHMENT_CONTEXT_WINDOW_TOKENS)` como baseline com anexo; `calculateRequestBudget` usa `PROVIDER_ATTACHMENT_OUTPUT_LIMITS` (novo `Record<Provider, number>`) em vez do `DEFAULT_OUTPUT_TOKEN_LIMIT` genérico quando há anexo.
  - Nova função `allocatePerFileBudget(fileSizesChars, totalTokenBudget, minTokensPerFile=512)` — divide o orçamento de conteúdo entre N arquivos anexados, cada um com fatia GARANTIDA proporcional ao tamanho, nunca menos que o piso. **Qualquer código futuro que processe múltiplos arquivos no mesmo turno deve usar esta função em vez de um orçamento compartilhado sequencial** — o padrão sequencial antigo é a causa raiz confirmada da falha original.

- **`src/app/api/bibble/chat/route.ts`**
  - `extractFilesContent` agora recebe orçamento por arquivo (via `allocatePerFileBudget`, usando `file.size` como proxy de tamanho) em vez de `remainingTokens` compartilhado.
  - Loop de continuação automática no fluxo sem-tools (`for (;;)` dentro de `runStream`): quando `finishReason` indica truncamento (`isOutputTruncated`), o servidor reinjeta o texto já gerado como turno `assistant` + pede explicitamente para continuar, até `MAX_CONTINUACOES_TRUNCAMENTO = 2` vezes. Guard de tempo (`TEMPO_LIMITE_CONTINUACAO_MS = (maxDuration - 20) * 1000`) impede continuar se já não sobra tempo suficiente antes do `maxDuration = 120` da rota — sem isso a rota abortaria uma geração cara no meio.
  - `activeModel` agora usa a constante `BIBBLE_MODEL` de `client.ts` em vez de um literal `"qwen3:14b"` duplicado que existia solto na rota (fonte única).
  - **`hasPdf` agora exige evidência real de conteúdo** (`file.url` OU `file.extractedContent` presentes), não só `file.type`/`file.name` declarados pelo cliente. Achado do Anubis: sem essa exigência, qualquer usuário autenticado conseguia declarar um arquivo PDF fake sem conteúdo real só para forçar a janela de contexto/output ampliada (mais cara em GPU) no Ollama compartilhado — nenhum rate-limit por usuário existe nesta rota hoje.

- **`src/lib/bibble/attachment-security.ts`**
  - `BIBBLE_UPLOAD_TEXT_TOKEN_BUDGET` subiu de 30.000 para 120.000 tokens (env `BIBBLE_UPLOAD_TEXT_TOKEN_BUDGET`) — este é o teto aplicado no **momento do upload** (`upload-to-blob/route.ts`), ANTES do orçamento por arquivo do chat. Sem subir os dois juntos, o upload cortava o PDF antes do chat ter chance de usar a margem maior — **checklist para qualquer teto de token futuro no pipeline do Bibble: sempre verificar se existe um teto anterior no caminho (upload → chat → provider) que precisa subir junto**. Confirmado matematicamente que os tetos agregados derivados (`BIBBLE_HISTORY_MESSAGE_MAX_CHARS` ≈ 4.9MB) continuam dentro de `BIBBLE_HISTORY_TOTAL_MAX_CHARS` (6MB) após o aumento.

- **`src/lib/bibble/client.ts`**
  - `BIBBLE_MODEL` (default) trocado de `gemma4:e4b` para `qwen3.8:latest` (modelo já instalado no servidor Ollama, mesma tag usada por `ROADMAP_QWEN_MODEL` no Roadmap Alpha). Adicionado a `PROVIDER_MODELS.ollama` e a `modelSupportsVision()` (confirmado com o usuário: tem visão).
  - `src/components/BibbleChatHome/BibbleChatLayout.tsx` — `DEFAULT_MODEL` client-side espelha o mesmo novo default.

- **`src/lib/bibble/system-prompt.ts`** — duas seções novas:
  - "REGRA DE TRANSPARÊNCIA DE LEITURA" — instrui o modelo a avisar o usuário explicitamente quando o texto do anexo veio marcado com `[CAPACIDADE: reduzido]` (a estratégia `head-middle-tail` de `selectTextForTokenBudget` já existia, mas o prompt nunca instruía o modelo a repassar o aviso).
  - "PROTOCOLO PARA TAREFAS FINANCEIRAS/CONTÁBEIS" — conferir soma contra saldo/totais informados pelo usuário antes de finalizar, respeitar partidas dobradas, agrupar por conta, nunca inventar valor sem base no documento.

### Risco residual documentado, não corrigido nesta sessão (Anubis, achado informativo)

Texto extraído de PDF entra como conteúdo de usuário (dentro de bloco ` ``` ` markdown) sem nenhuma instrução explícita de "nunca trate isto como comando" — risco de prompt injection via documento malicioso, **pré-existente à sessão, não introduzido por ela**. Fica mais relevante agora porque o novo protocolo financeiro depende do modelo seguir a instrução de sistema em vez de uma instrução potencialmente embutida no PDF anexado. Se uma sessão futura for reforçar isso, o ponto de entrada é `appendExtractedText` em `route.ts` (onde o texto do arquivo é formatado antes de entrar no prompt) + uma nova regra explícita no `system-prompt.ts`.

### Checklist de integração desta sessão
- [x] Diagnóstico (Bibble) → Scout (blueprint) → implementação → Forge (`tsc`/`lint`/`build`, aprovado 2x) → Anubis (2 achados importantes corrigidos, 1 informativo documentado) → Scribe (esta entrada)
- [x] Sem migration, sem mudança de schema — Vault não foi acionado
- [x] `.env.example` documentado com as 4 novas env vars opcionais (`BIBBLE_MODEL`, `BIBBLE_ATTACHMENT_CONTEXT_WINDOW`, `BIBBLE_ATTACHMENT_OUTPUT_TOKENS`, `BIBBLE_UPLOAD_TEXT_TOKEN_BUDGET`)
- [ ] Rate-limit por usuário de verdade nesta rota (Redis/memória compartilhada) — não existe nenhuma infraestrutura de rate-limit em `lib/bibble/` hoje; ficou como TODO explícito, mitigado parcialmente pelo guard de tempo + `MAX_CONTINUACOES_TRUNCAMENTO` conservador

**Última atualização:** 2026-08-24 por Scribe (sessão Bibble — diagnóstico → Scout → implementação → Forge → Anubis → Scribe)

---

## Alpha Motion (Apresentações) — Ocultar slide + Compartilhar (cria cópia) + listagem por dono (2026-08-24)

### Ocultar slide (soft-hide, estilo Canva — nunca exclui)

- **Schema:** `Slide.oculto Boolean @default(false)` (`prisma/schema.prisma`) — migration aditiva aplicada em produção no Turso pelo Vault (backup pontual gerado e validado 76/76 linhas de `Slide`, `ALTER TABLE Slide ADD COLUMN oculto` confirmado via `PRAGMA table_info`).
- **Toggle:** `AlternarVisibilidadeSlide(slideId)` (`src/actions/slides.ts`) — ownership via `checarOwnershipApresentacao`, mesmo padrão de `ExcluirSlide`/`DuplicarSlide`. Sem trava de "não pode ocultar o último slide" (diferente de `ExcluirSlide`) — ocultar não é destrutivo, então não precisa da mesma proteção.
- **UI:** ícone `Eye`/`EyeOff` (lucide-react) em cada `ItemSlide` da sidebar (`src/components/Apresentacoes/Editor/SidebarEsquerda/SidebarSlides.tsx`), update otimista com rollback via `atualizarVisibilidadeSlide` (novo método em `useEditorStore.ts`, campo `oculto?` em `SlideResumo`).
- **Onde o filtro `where: { oculto: false }` É aplicado (3 pontos, todos leitura pública/exportação):**
  1. Link público — `src/app/apresentacao/[slug]/page.tsx`
  2. Export HTML autocontido — `src/app/api/apresentacoes/[id]/exportar-html/route.ts`
  3. Modo apresentação — `src/app/PainelAlpha/Apresentacoes/[id]/apresentar/page.tsx`
- **Onde o filtro NÃO é aplicado (intencional):**
  - Editor (`src/app/PainelAlpha/Apresentacoes/[id]/editor/page.tsx`) e `ListarSlides`/`ObterSlide`/`DuplicarSlide` (`slides.ts`) — o dono precisa continuar vendo e reativando slides ocultos.
  - `ExcluirAssetApresentacao` (`src/actions/apresentacao-assets.ts:30`) — varre TODOS os slides (ocultos ou não) para checar se um asset ainda está em uso antes de excluir. Filtrar por `oculto: false` ali seria um bug: permitiria excluir um asset referenciado por um slide oculto, quebrando-o silenciosamente quando o dono reexibir.
- **Checklist para um 4º ponto de leitura pública futuro (se um dia existir):** sempre adicionar `where: { oculto: false }` dentro do `select.slides` da query Prisma — nunca filtrar depois em memória (mais fácil esquecer). Pontos de leitura que servem o EDITOR/DONO nunca devem filtrar.
- **Resiliência a lista de slides vazia (todos ocultos):** modo apresentação tem guard explícito (`if (apresentacao.slides.length === 0) notFound()`, `apresentar/page.tsx:52` — comentário ali ficou desatualizado, dizia "não deve acontecer" mas agora é um caso real possível, puramente cosmético). Link público e export HTML não têm guard próprio, mas `PlayerStandalone.tsx:175` (`if (!slideAtual) return <div>...</div>`) já absorve o array vazio sem crash — resiliência pré-existente, não algo que esta feature precisou adicionar.

### Compartilhar apresentação — PADRÃO REUTILIZÁVEL: cria cópia, não link/acesso

**Diferença de conceito importante:** "Compartilhar" aqui NUNCA é um link ou uma permissão de acesso compartilhado (isso já existe via `ApresentacaoColaborador`, papel EDITOR/VISUALIZADOR/COMENTARISTA). É uma ação que **cria uma cópia completa e independente** da apresentação, atribuída como propriedade a cada destinatário escolhido. Após compartilhar, os dois usuários têm apresentações totalmente desacopladas — editar uma não afeta a outra.

- **Server Action:** `CompartilharApresentacao({ apresentacaoId, destinatarioIds: number[] })` (`src/actions/apresentacoes.ts`) — Zod (`compartilharApresentacaoSchema`), 1 cópia por destinatário via `db.$transaction` (array de `create`s, atômico — todas ou nenhuma).
- **Ownership mais restritivo que o padrão do arquivo:** exige `original.autorId === userId` estritamente — nem Admin/CEO nem colaborador podem compartilhar, só o criador literal. Decisão explícita do usuário, diferente de `podeEditarApresentacao`/`isAdmin` usado no resto de `apresentacoes.ts`.
- **`destinatarioIds` validado contra usuários reais** (`db.usuarios.findMany({ where: { id: { in: destinatarioIds } } })`) antes de criar qualquer cópia — nunca cria `Apresentacao` órfã com `autorId` inválido.
- **Nomenclatura da cópia:** sempre `"{título original} - copia de {nome de quem compartilhou}"` — o remetente, nunca o destinatário. `autorId` da cópia = destinatário.
- **Todos os slides da cópia nascem com `oculto: false`**, independente do estado no original — decisão explícita do usuário (a cópia é sempre "página em branco" visualmente completa para quem recebe).
- **UI:** `ModalCompartilharApresentacao.tsx` (`src/components/Apresentacoes/Dashboard/`, novo) — busca + lista de usuários via `getUsers()` (`src/actions/get-user.ts`, já existente) + `Checkbox` multi-seleção. Segue a mesma estrutura visual de `ModalNovaApresentacao.tsx` (`Dialog`/`DialogHeader`/`DialogFooter`, paleta `slate-900`/`indigo-600`).
- **Botão "Compartilhar"** no dropdown de `CardApresentacao.tsx` só aparece quando `apresentacao.autor.id === usuarioAtualId` — prop `usuarioAtualId` propagada em cadeia: `src/app/PainelAlpha/Apresentacoes/page.tsx` → `ApresentacoesDashboard` → `CardApresentacao` → `ModalCompartilharApresentacao`.
- **Dívida pré-existente reaproveitada, não introduzida por esta feature:** `getUsers()` não tem `auth()` — mesma exposição já documentada em `BuscarTodosUsuarios` (`RecursosHumanos.ts`). Se um dia for endurecido, corrigir os dois juntos.
- **Como replicar este padrão em outro módulo:** (1) Server Action que exige `autorId === userId` (ou o ownership que fizer sentido) estritamente; (2) valida destinatários reais antes de criar; (3) `$transaction` com 1 `create` por destinatário; (4) título/nome da cópia menciona quem compartilhou, não quem recebe; (5) reaproveitar `getUsers()` para o seletor, a menos que o módulo precise de filtro diferente de usuários elegíveis.

### Listagem inicial restrita ao dono (mudança de comportamento deliberada)

- **`ListarApresentacoes`** (`src/actions/apresentacoes.ts`) mudou de `{ autorId OU colaborador, Admin vê tudo }` para **somente `{ autorId: userId }`** — inclusive Admin/CEO agora só vê as próprias criações na tela inicial do Alpha Motion. Decisão confirmada explicitamente pelo usuário via pergunta direta (não assumida).
- **Efeito colateral intencional:** colaboradores convidados via `ApresentacaoColaborador` não aparecem mais na listagem de quem foi convidado — a colaboração ainda funciona para quem já está DENTRO do editor (ownership check permanece o mesmo em `slides.ts`/outras actions), só a listagem inicial que não lista mais. "Compartilhar" (cópia) é o caminho oficial agora para dar acesso a outra pessoa a partir da tela inicial.
- **Se uma sessão futura precisar reverter ou ajustar isso:** o `acesso` object em `ListarApresentacoes` é o único ponto a tocar — não precisa mexer em `podeEditarApresentacao`/`checarOwnershipApresentacao`, que continuam com a lógica original (autor OU colaborador OU admin) para todas as outras operações.

**Última atualização:** 2026-08-24 por Scribe (sessão Bibble — pipeline completo Scout→Vault→Forge→Probe→Anubis→Lens→Sage→Scribe)

---

## Roadmap Alpha — "Novo módulo" (2026-08-20, corrigido de local)

**⚠️ Fica DENTRO do Roadmap Alpha (`RoadmapDashboard.tsx`), NUNCA na tela inicial do painel (`PainelAlphaClient.tsx`).** Uma implementação inicial colocou isso na tela inicial por engano — revertido integralmente após correção explícita e irritada do usuário. Não repetir esse erro de local em sessão futura.

- **Trigger:** botão "Novo módulo" no header de `RoadmapDashboard.tsx`, ao lado de "Novo objetivo" (`canMutate` only). Também aceita `?novoModulo=1` na URL (`useSearchParams`, dentro de `<Suspense>` em `page.tsx`).
- **Gate de segurança obrigatório (dois pontos, não só um):** (1) o `useEffect` que lê o param só ativa o preset se `canMutate` for `true`; (2) `<CreateObjectiveDialog>`/`<EditObjectiveDialog>` só são montados no JSX quando `canMutate` — nunca confiar só no controle de `open` para esconder um dialog de mutação sensível de um usuário sem permissão.
- **Preset de conteúdo:** `NOVO_MODULO_CONSTRAINTS` (constante em `RoadmapDashboard.tsx`) pré-preenche o campo Restrições com a checklist real de registro de módulo — se o processo de registro de módulo mudar no futuro (`MODULOS_REGISTRY`), atualizar esse texto também.
- **Como adicionar um preset semelhante no futuro:** mesmo padrão — botão local (ou query param) → gate de permissão → estado de preset → prop opcional no dialog de criação.

## Roadmap Alpha — Sistemas Externos: registro + execução real (2026-08-20, corrigido de local)

**⚠️ Fica DENTRO do Roadmap Alpha — sidebar esquerda de `RoadmapDashboard.tsx` virou `Accordion` de 2 gavetas ("Painel Alpha" / "Sistemas Externos"). NUNCA na tela inicial do painel.** Mesmo erro de local do item acima, já corrigido.

- **Rota/UI:** `/PainelAlpha/Roadmap` → gaveta "Sistemas Externos" na sidebar → botão "Novo projeto" (admin only) → `NovoProjetoExternoDialog.tsx`. Cada workspace registrado mostra badge Ativo/Parado + botões Iniciar/Parar worker.
- **Server Actions:** `src/actions/RoadmapWorkspaces.ts` — `NavegarDiretoriosRoadmapWorkspace`/`CriarRoadmapWorkspace`/`ArquivarRoadmapWorkspace`/`IniciarWorkerRoadmapWorkspace`/`PararWorkerRoadmapWorkspace` exigem `requireRoadmapAccess(true)`; `ListarRoadmapWorkspaces` aceita acesso básico mas nunca retorna `rootPath` para não-admin.
- **Model:** `RoadmapWorkspace` (`prisma/schema.prisma`) — migration aplicada em produção, incluindo `workerPid Int?`/`workerStartedAt DateTime?` (2ª migration pontual, mesmo protocolo Vault).
- **`moduleKey` de workspace:** bloqueia `..`/traversal e nomes reservados do Windows (`con`/`prn`/`aux`/`nul`/`com1-9`/`lpt1-9`, `WINDOWS_RESERVED_NAMES` em `RoadmapWorkspaces.ts`) — usado como segmento de path em `prompt-phases/roadmap-alpha/{moduleKey}/...`.
- **`rootPath` de workspace:** único por workspace ativo (comparação normalizada via `path.win32`, checada em `CriarRoadmapWorkspace`) — impede dois workspaces disputando a mesma pasta física.
- **Isolamento de fila (ponto crítico, não regredir):** `documentedObjectives()` (`src/lib/roadmap-production/worker.ts`) SEMPRE filtra por `moduleKey IN (allowedModuleKeys)`, resolvido via `resolveProductionWorkspaceScope(root)` (`workspace-scope.ts`). Qualquer refatoração futura dessa query que remova o filtro reabre a falha de um worker processar objetivo de outro projeto — não é opcional.
- **Worker por processo:** `scripts/roadmap-production-workspace-worker.ps1` (Mutex nomeado por workspace) + `IniciarWorkerRoadmapWorkspace`/`PararWorkerRoadmapWorkspace` (spawn/kill, PID em `RoadmapWorkspace.workerPid`). `killProcessTree()` usa `taskkill /T /F` — nunca trocar de volta para `process.kill()` simples, deixa processo filho órfão no Windows.
- **Reserva atômica ao iniciar:** `IniciarWorkerRoadmapWorkspace` usa `updateMany({ where: { id, workerPid: valorAntigo } })` antes do `spawn` para fechar race condition de double-click — manter esse padrão em qualquer ação futura que inicie processo de longa duração a partir de uma Server Action.
- **Segurança do navegador de diretórios — decisão definitiva do usuário, não reabrir:** sem allowlist de diretórios-pai. A única proteção é `requireRoadmapAccess(true)` (admin).
- **Supervisores são `powershell.exe`, não `node.exe`:** ao depurar processos do Roadmap, buscar por ambos — `scripts/roadmap-production-worker.ps1`/`roadmap-alpha-worker.ps1` (supervisores originais, Mutex fixo) e `roadmap-production-workspace-worker.ps1` (por workspace, Mutex parametrizado).

## Roadmap Alpha — Produção: novo status/comando de aprovação (2026-08-19)

- **Novo status de execução:** `"AWAITING_APPROVAL"` (`productionExecutionStatusSchema`, `src/lib/roadmap-production/contracts.ts`) — toda execução nasce nele; `selectNextProductionExecution`/`nextReadyPhase` (`worker.ts`) ignoram qualquer status fora de `["PENDING","RUNNING"]`, então basta manter essa allowlist para preservar o gate — **nunca adicionar `"AWAITING_APPROVAL"` a essas duas listas**, ou o gate quebra silenciosamente.
- **Novo comando de controle:** `"APPROVE"` (`productionControlCommandSchema.type`), processado em `applyProductionControls` (`worker.ts`) — só aceita a transição partindo de `"AWAITING_APPROVAL"`.
- **Server Action:** `AprovarExecucaoRoadmapProduction` (`src/actions/RoadmapProduction.ts`) — mesmo padrão de auth dos demais controles (`requireRoadmapProductionAccess(true)`), enfileira o comando via `enqueueProductionControl("APPROVE", executionId)`.
- **UI:** botão "Aprovar e iniciar" em `RoadmapProductionPanel.tsx`, ao lado dos botões de Pausar/Retomar/Excluir, visível só quando `canManage && execution.status === "AWAITING_APPROVAL"`.
- **Checklist para qualquer novo status de execução no futuro:** (1) adicionar em `productionExecutionStatusSchema`; (2) decidir se ele deve ou não entrar nas allowlists de seleção do worker; (3) mapear label/cor em `STATUS_LABEL`/`statusClass` (`RoadmapProductionPanel.tsx`); (4) se o novo status precisa de ação humana, seguir o padrão comando→action→botão já estabelecido aqui.

## Roadmap Alpha — Produção: enfileirar comando NUNCA processa sozinho — bug do "Aprovar e iniciar" que não iniciava (2026-08-24)

**Causa raiz confirmada pelo Scout:** `enqueueProductionControl(...)` (chamado por `AprovarExecucaoRoadmapProduction`/`ControlarExecucaoRoadmapProduction`/`RepetirExecucaoRoadmapProduction`, `src/actions/RoadmapProduction.ts`) só ESCREVE o comando num arquivo de fila — nunca processa nada sozinho. Quem de fato aplica o comando (`applyProductionControls`, `worker.ts`) só é chamado de dentro de `processNextProductionPhaseUnlocked`, que por sua vez só roda a partir do **worker de processo separado** (`scripts/roadmap-production.mjs worker`, loop de 5s, ou o supervisor `.ps1`). O refresh que a tela chama a cada poll (`ObterRoadmapProduction` → `refreshProductionExecutions` → `syncProductionExecutions`) **nunca** chama `applyProductionControls` — só resincroniza estado já existente. Se o worker de processo separado não estiver rodando (ou já estiver ocupado com outro workspace), qualquer comando enfileirado fica represado indefinidamente e a UI nunca reflete a mudança — o botão "Aprovar e iniciar" parecia simplesmente não fazer nada.

**⚠️ Regra permanente para qualquer comando novo de controle adicionado no futuro:** enfileirar (`enqueueProductionControl`) NUNCA é suficiente sozinho — sempre depende de algo chamar `processNextProductionPhase` depois. Se o comando novo precisa de efeito imediato na UI (não só na próxima passada do worker de fundo, que pode não estar rodando), seguir o padrão do kick abaixo. Comandos que não devem "iniciar" nada (como `PAUSE`/`EXCLUDE`) não precisam de kick.

**Correção — helper `kickProductionWorker` (`src/actions/RoadmapProduction.ts`):** função privada (não exportada) `kickProductionWorker(root: string): void`, chamada **fire-and-forget** (sem `await` bloqueando a resposta da Server Action — processar uma fase de verdade pode envolver chamar CLI de agente e demorar) logo após `enqueueProductionControl(...)` em `AprovarExecucaoRoadmapProduction`, `RepetirExecucaoRoadmapProduction` e em `ControlarExecucaoRoadmapProduction` (somente no ramo `RESUME`). Reaproveita `processNextProductionPhase` (já existente e exportada em `worker.ts`, a MESMA função que o worker externo chama em loop) — como ela resolve um lease global não-bloqueante (`acquireProductionExecutionLease`), é seguro chamar de múltiplos lugares ao mesmo tempo: se o worker de fundo já detém o lease, o kick recebe `lease === null` e retorna sem side effect, sem duplicar trabalho. Só dispara quando `isRoadmapProductionRuntimeEnabled()` é `true` **neste processo** (env `ROADMAP_PRODUCTION_ENABLED=true`) — em ambiente sem runtime local (ex.: nuvem), o kick não tenta nada, preservando o comportamento já documentado de que aprovar deve funcionar mesmo sem o runtime de execução habilitado.

**Não alterado:** `selectNextProductionExecution`/`nextReadyPhase` (seleção de fila em `worker.ts`) já estavam corretos — não faziam parte do bug. Sem migration, sem mudança de schema.

**Checklist de integração desta sessão:**
- [x] Scout (blueprint) → Echo (implementação) → Forge (`tsc`/`lint`/`build` limpos) → Probe (wiring confirmado em 2 callers de UI: `RoadmapProductionPanel.tsx` e o card de aprovação em `RoadmapDashboard.tsx`) → Anubis (0 críticos/importantes — `root` sempre derivado do banco, guard de runtime é server-side puro) → Lens (aprovado, duplicação do padrão enqueue+kick nas 3 Server Actions julgada aceitável, não vale extrair) → Sage (sem teste novo necessário — guard de ambiente já 100% coberto por `tests/roadmap-production/runtime.test.ts`, lease não-bloqueante já coberto por `execution-lock.test.ts`)

**Última atualização:** 2026-08-24 por Scribe (sessão Bibble — Scout→Echo→Forge→Probe→Anubis→Lens→Sage→Scribe)

## Roadmap Alpha — Produção: auditoria completa da fila + visibilidade de bloqueio + auto-approve + tela por objetivo (2026-08-24, parte 2 da mesma sessão)

**Gatilho:** depois do fix acima, usuário reportou que o sistema "parece travado, nunca demorou tanto" e pediu auditoria completa do sistema de fila/auto-desenvolvimento.

### Achado 1 — "lock travado" era lixo de uma migração de diretório já concluída, não um bug

`storage.ts` migrou o diretório de estado de `{raiz do projeto}/.roadmap-production/` (legado) para `%LOCALAPPDATA%\PainelAlpha\RoadmapProduction\workspaces\{sha256(canonicalRoot(root))}\` (`directory()`/`stateHomeDirectory()`, ambas em `storage.ts`) — migração já concluída em sessão anterior (marcador `.legacy-migration-v1.json`, `status: "SUCCEEDED"`). O lock que parecia órfão (`execution.lock` com PID morto, horas de idade) estava no diretório LEGADO, que nenhum código atual lê ou escreve — a pasta foi apagada (`.gitignore` já cobria `/.roadmap-production/`, confirmado seguro antes de remover). **Se uma sessão futura for depurar "lock travado"/"estado desatualizado" do Roadmap Produção, o diretório real é sempre `%LOCALAPPDATA%\PainelAlpha\RoadmapProduction\workspaces\{hash}\` — nunca confiar em `.roadmap-production/` na raiz do projeto, mesmo que o arquivo exista e pareça atual.**

### Achado 2 — comportamento correto, mas invisível: BLOCKED nunca aparecia fora do painel de Produção

Execuções `BLOCKED`/`WAITING_FOR_ADMIN` (esperando decisão humana) nunca tinham nenhum sinal na tela principal do Roadmap — só apareciam se o usuário entrasse manualmente no painel de Produção e expandisse a execução certa. Combinado com `AUTO_RETRY_LIMIT = 30` (worker.ts, correções automáticas silenciosas antes de virar BLOCKED — `attemptCount` real já chegou a 63 numa sessão anterior), o sistema passa horas "girando em vazio" sem nenhum aviso progressivo, o que se sente como travamento.

### Correções implementadas

**1. Badge de bloqueio no dashboard** — nova Server Action `ListarExecucoesPrecisandoAtencao()` (`src/actions/RoadmapProduction.ts`, mesmo padrão de auth/varredura de `ListarExecucoesAguardandoAprovacao`, exige mutação via `requireRoadmapAccess(true)`) retorna `{objectiveId, executionId, status: "BLOCKED"|"WAITING_FOR_ADMIN"}[]`. Badge vermelho no card do objetivo (`RoadmapDashboard.tsx`, estado `needingAttention`, gateado por `canMutate`) com botão que abre a execução focada.

**2. Aviso progressivo do circuito de retry** — novo helper `appendRetryThresholdWarning(execution, phase, at)` (`worker.ts`) dispara UMA mensagem em `execution.messages` (role `SYSTEM`, kind `STATUS`) quando `autoRetryCount` cruza EXATAMENTE `Math.floor(AUTO_RETRY_LIMIT/2)` = 15 pela primeira vez (comparação `===`, garante disparo único). Chamado nos 3 pontos do arquivo que incrementam `autoRetryCount` (dois em `scheduleAutomaticRecovery`, um no bloco de delivery-adjustment de `processNextProductionPhaseUnlocked`). Destaque visual em `RoadmapImplementationRoom.tsx` (`isRetryThresholdWarning`, âmbar + `AlertTriangle`) via **heurística de texto** (`content.startsWith("Esta fase já tentou se autocorrigir")`) — frágil a mudança de texto futura no worker sem sincronizar aqui; documentado no próprio código como caminho de melhoria (trocar por um `kind` dedicado no `productionMessageSchema` de `contracts.ts` se algum dia justificar o esforço de migrar um schema Zod usado em 3+ arquivos).

**3. Auto-approve para autor Admin/CEO/TI** — `documentedObjectives()` (`worker.ts`) inclui `createdBy: { select: { role: true } }` no select Prisma. `syncProductionExecutions()`: `const autoApproved = isAdminRole(objective.createdBy.role)` (reaproveita `@/lib/roles`, já testado em `tests/auth/ti-admin-access.test.ts`) decide `status: autoApproved ? "PENDING" : "AWAITING_APPROVAL"` **apenas na criação** da execução — o bloco `if (existing) { ...; continue; }` sai antes de qualquer objetivo já documentado ser reavaliado, então mudar a role do autor DEPOIS não destrava retroativamente uma execução já em `AWAITING_APPROVAL` (verificado por leitura de código, Probe e Anubis). Activity registrada na primeira fase quando auto-aprovado, para rastreabilidade de "por que este nunca passou por aprovação manual".

**4. Tela de Produção por objetivo (substitui a fila global)** — `RoadmapProductionPanel.tsx` ganhou prop `focusExecutionId?: string | null`; filtra `executions` para 1 item, reaproveitando o `expandedExecutionId` já existente (sem estado novo de UI — o painel já sabia focar 1 execução, só faltava um jeito de chegar direto nela de fora). **Botão "Produção" do HEADER de `RoadmapDashboard.tsx` foi REMOVIDO** (decisão explícita do usuário — Produção só se acessa a partir do card de um objetivo específico, nunca mais uma fila com todos os objetivos de um módulo). Botão "Produção" novo por card, visível quando `canAccessProduction && objectiveExecutions.has(objective.id)` (estado `objectiveExecutions`, carregado por nova Server Action `ListarExecucoesPorObjetivo()`).

**⚠️ Ponto de atenção para replicar este padrão em outra tela:** `ListarExecucoesPorObjetivo()` foi implementada inicialmente com `requireRoadmapAccess(true)` (mesmo padrão das duas funções irmãs, exige mutação), mas teve que ser REBAIXADA para `requireRoadmapAccess()` (só leitura) depois de confirmação explícita do usuário — o botão novo precisava manter a MESMA paridade de acesso do botão antigo do header que estava sendo removido (visível para qualquer `canAccessProduction`, não só Admin/CEO/TI). **Ao remover um controle de UI e substituir por um equivalente, sempre checar se o nível de acesso do substituto bate com o do original antes de assumir o padrão "igual às funções vizinhas" — nem toda Server Action nova do mesmo arquivo deve ter o mesmo gate de auth.** Dedupe por `objectiveId` pegando a execução mais recente por `createdAt` (um objectiveId pode ter múltiplas execuções de revisões sucessivas, ex.: `:v2` e `:v3`).

### Achado separado, NÃO resolvido nesta sessão

Durante a checagem final de regressão (suíte completa `tests/roadmap-production/`), Forge encontrou 1 teste falhando em `tools.test.ts` ("executa somente o nome de busca alinhado à policy", `SEARCH_FAILED`). Confirmado via `git stash`/`git stash pop` que é regressão de uma sessão ANTERIOR a esta (não introduzida pelas 5 entregas acima), relacionada a `buildRoadmapSubprocessEnv` (`src/lib/roadmap-production/subprocess-env.ts`, sandbox de env vars aplicado à chamada do `rg`/ripgrep dentro da tool `search_code` em `tools.ts`) — `PATH` já está na allowlist do sandbox, então a causa exata não é óbvia sem investigação dedicada. Task separada criada para o usuário decidir se quer investigar agora ou depois — **não corrigido às cegas de propósito**, pois mexer no sandbox sem entender a decisão de design original arrisca desfazer uma proteção de segurança intencional (o sandbox existe para não vazar env vars sensíveis para o subprocesso do agente de IA).

### Teste novo

`tests/roadmap-production/worker.test.ts` (3 testes) — cobre o threshold de aviso de retry via `scheduleAutomaticRecovery` (já exportada). Auto-approve por role **não** tem teste direto: `syncProductionExecutions` depende de Prisma real e nenhum teste em `tests/roadmap-production/` mocka banco hoje — introduzir isso seria custo desproporcional para uma composição de 2 peças já cobertas separadamente (`isAdminRole` 100% testada; enum de `status` validado pelo schema Zod).

### Checklist de integração desta sessão
- [x] Scout (auditoria + blueprint) → Echo (backend, 3 Server Actions novas/ajustadas) → Nova (frontend, pausou 2x pedindo decisão do usuário sobre nível de acesso) → Forge (3 erros de tipo TS corrigidos em `worker.ts`: `satisfies ProductionExecutionCompat`, `as const` em ternário de status, tipagem explícita de `ProductionMessage` — todos por widening de literal, não bugs de lógica) → Probe (wiring completo confirmado) → Anubis (0 achados — auto-approve validado sem vetor de escalação retroativa) → Lens (aprovado) → Sage (3 testes novos) → Forge (2 correções de tipo no teste novo) → Lens (aprovado)
- [x] Sem migration, sem mudança de schema Prisma além do `select` já existente em `documentedObjectives()`

**Última atualização:** 2026-08-24 por Scribe (sessão Bibble — Scout→Echo→Nova→Forge→Probe→Anubis→Lens→Sage→Forge→Lens→Scribe)

## Roadmap Alpha — Produção: worker de workspace externo nunca funcionava de verdade — 2 bugs de infraestrutura (2026-08-24, parte 3 da mesma sessão)

**Gatilho:** usuário reportou que um objetivo real ("Alteração de textos no Site da Alpha", moduleKey `site-alpha-comex`, autor role TI — deveria auto-aprovar) nunca ia para desenvolvimento, e que o badge "Bloqueado — precisa de você" (parte 2 desta sessão) não tinha pergunta nem lugar para responder.

### Achados de UX (visibilidade — corrigidos)

- `site-alpha-comex` é um `RoadmapWorkspace` **externo** (`rootPath` fora do PainelAlpha) cujo `workerPid` apontava para processo morto. `ListarRoadmapWorkspaces()` já calculava `workerRunning` corretamente em tempo real (`processIsAlive`), e `SistemasExternosSection.tsx` já tinha badge "Parado"/botão play — mas essa seção vive numa gaveta `Accordion` colapsada da sidebar, sem notificação proativa.
- Novo `src/lib/roadmap-alpha/process-check.ts` (`processIsAlive` extraída, elimina duplicação com `RoadmapWorkspaces.ts`). `ListarRoadmapAlpha` (`RoadmapAlpha.ts`) cruza objetivos `DOCUMENTED` com workspaces registrados → `workspaceWorkerOffline: boolean` por objetivo. Badge âmbar no card (`RoadmapDashboard.tsx`) quando `true`.
- Nem todo `BLOCKED` tem pergunta formal: só `WAITING_FOR_ADMIN` (circuit breaker de 3 falhas, `createCircuitIntervention` em `interactions.ts`) cria uma `ProductionIntervention`. `BLOCKED` por esgotamento de `AUTO_RETRY_LIMIT` (30 tentativas) nunca cria intervention — só erro na fase.
- `RoadmapProductionPanel.tsx`: `useEffect` com guard via `useRef` abre a Sala de Implementação (`RoadmapImplementationRoom`) automaticamente na primeira vez que a execução focada aparece `BLOCKED`/`WAITING_FOR_ADMIN`.
- `RoadmapImplementationRoom.tsx`: nova seção vermelha quando `status === "BLOCKED"` sem `pendingIntervention` — mostra fase/erro/resumo da última falha com orientação de próximo passo.

### ⚠️⚠️ DOIS BUGS CRÍTICOS DE INFRAESTRUTURA — regra permanente, leia antes de mexer em `scripts/roadmap-production*.ps1` ou `lib/roadmap-production/{agents,providers}.ts`

Descobertos ao **testar** a correção acima no ambiente real — não eram teóricos, reproduzidos rodando os scripts manualmente e lendo `worker.log` de verdade.

**BUG A — o auto-restart dos supervisores PowerShell nunca funcionou, para NENHUM worker (interno ou externo).** `scripts/roadmap-production-workspace-worker.ps1` **e** `scripts/roadmap-production-worker.ps1` (o worker principal do PainelAlpha — mesmo bug, só não tinha sido exposto ainda por sorte de não bater num warning) têm `$ErrorActionPreference = 'Stop'` no escopo global do script. Isso faz **qualquer linha de stderr do processo `tsx` filho** — mesmo um `console.warn` inofensivo do `worker.ts` (ex.: `"Comando RESUME ignorado: executionId não encontrado no estado atual"`, comportamento normal e esperado, não um erro real) — virar exceção terminante no pipeline `2>&1 | ForEach-Object`, matando o supervisor `while ($true)` inteiro **antes** de chegar em `Start-Sleep -Seconds 10`/restart. O mecanismo de resiliência (loop infinito + auto-restart) estava **completamente inoperante desde sempre**: qualquer aviso no log — não só erro real — derrubava o processo pai permanentemente, sem nunca reiniciar.
- **Correção:** chamada do processo filho envolvida em `try { & $tsxPath ... 2>&1 | ForEach-Object {...} } catch { Add-Content ... 'supervisor=caught-exception message=...' }` — a exceção é logada e o loop sempre chega no `Start-Sleep`/restart, não importa o que aconteça no processo filho.
- **Verificado por teste real:** log mostrou `supervisor=restart` seguido de novo `supervisor=start` após bater no mesmo warning que antes matava o processo.
- **Regra permanente:** qualquer mudança futura nesses 2 scripts `.ps1` precisa preservar esse `try/catch` ao redor do pipeline do processo filho — nunca deixar `$ErrorActionPreference = 'Stop'` do escopo global alcançar o pipeline `2>&1` sem uma barreira de captura.

**BUG B — worker de workspace externo nunca conseguia processar NENHUMA fase, sempre `BIBBLE_AGENT_CONTEXT_MISSING`.** `runProductionAgent` (`src/lib/roadmap-production/providers.ts:287`) passava o `root` do **workspace ALVO** (ex.: `C:\Users\TI\Desktop\Site Alpha Comex`) para `loadBibbleAgentContext(input.agentId, root)` — mas essa função lê arquivos da squad Bibble (`.claude/skills/bibble-squad/{agentId}/SKILL.md`, `AGENTS.md`, `.bibble/constitution.md`, `.bibble/memory/*.md`) relativos a esse `root`. Esses arquivos **só existem no PainelAlpha**, nunca num projeto externo alvo. Resultado: para **qualquer** workspace externo, a função sempre lançava `BIBBLE_AGENT_CONTEXT_MISSING` antes de montar o system prompt — nenhuma fase de nenhum workspace externo jamais rodou, desde que a feature existe.
- **Correção:** removido o argumento `root` da chamada (`loadBibbleAgentContext(input.agentId)`, sem segundo argumento) — cai no default `process.cwd()`, que é **sempre** o PainelAlpha porque o supervisor `.ps1` sempre faz `Set-Location -LiteralPath $projectRoot` antes de spawnar o `tsx`, independente de qual workspace está sendo processado (o `WorkerRoot` só chega como env var `ROADMAP_PRODUCTION_ROOT`, nunca como cwd real).
- **Efeito colateral de segurança positivo (confirmado por Anubis):** antes, um workspace externo comprometido poderia teoricamente plantar um `SKILL.md` malicioso dentro do próprio repositório do projeto alvo e ele seria carregado como persona real do agente, injetado no system prompt. Agora isso é estruturalmente impossível — a fonte da persona é sempre um caminho fixo (PainelAlpha), nunca variável por workspace.
- **Já verificado, não é o mesmo bug:** `listBibbleAgents` (mesmo `agents.ts`) já era chamada corretamente com `process.cwd()` em todos os outros lugares. `src/lib/roadmap-alpha/bibble-protocol.ts:43` tem o mesmo padrão superficial (`root` do workspace passado pra `listBibbleAgents`), mas é **intencional e correto** — já tem fallback gracioso documentado no próprio código para quando a squad não existe no workspace externo, nunca lança erro.
- **Regra permanente:** qualquer função nova que precise ler contexto/persona da squad Bibble (não o código/estado do projeto sendo processado) deve usar `process.cwd()` implícito ou explícito apontando pro PainelAlpha — **nunca** o `root`/`WorkerRoot` recebido como parâmetro de uma função que processa um workspace. Antes de passar `root` para qualquer função nova dentro do fluxo de `runProductionAgent`, perguntar: "isso lê dado do PROJETO ALVO (correto usar `root`) ou da SQUAD/PainelAlpha (correto usar `process.cwd()`)?"

### Checklist de integração desta parte
- [x] Scout (diagnóstico + blueprint) → Echo (backend: `process-check.ts`, `RoadmapAlpha.ts`) → Nova (frontend: badges, sala automática) → Forge (aprovado) → **usuário testou e reportou botão play sem efeito** → investigação direta no ambiente real (scripts rodados manualmente, logs reais lidos) → Echo corrigiu os 2 bugs de infraestrutura → Forge (aprovado de novo, build completo) → Anubis (0 achados, Bug B confirmado como melhoria de segurança) → Lens (aprovado)
- [x] Sem migration, sem mudança de schema Prisma

**Última atualização:** 2026-08-24 por Scribe (sessão Bibble — Scout→Echo→Nova→Forge→Anubis→Lens→Scribe)

## Roadmap Alpha — Produção: autonomia do worker — mecanismos reativos já existentes + aposentadoria automática de execuções obsoletas (2026-08-24, parte 4 da mesma sessão)

**Gatilho:** usuário perguntou "como você Claude executa tarefas? Eu quero que o Roadmap seja capaz de fazer essas execuções, assim como você" — comparando a squad Bibble desta conversa (Bibble orienta agentes, lê resultado real de cada um, decide próximo passo adaptativamente, só pergunta ao usuário quando genuinamente precisa) com o worker do Roadmap, que segue um roteiro de fases fixo, gerado uma única vez pelo Qwen na documentação, sem essa camada de "maestro".

### ⚠️ Descoberta: o sistema JÁ tem 3 mecanismos reativos de auto-correção — nunca documentados antes

Todos vivem em `src/lib/roadmap-production/providers.ts`, no contrato de texto que cada agente usa para terminar a resposta de uma fase (`RESULT: PASS`, `RESULT: FAIL`, `RESULT: BLOCKED` ou `RESULT: NEEDS_INPUT`, parseado por regex em `providers.ts:264-266`):

1. **`AUTO_ADJUSTMENT_REQUIRED`** (`providers.ts:132,141`) — uma fase de leitura (CONTEXT) que descobre uma lacuna sinaliza isso sem travar (`RESULT: PASS` + `AUTO_ADJUSTMENT_REQUIRED: <lacuna>`); a próxima fase de execução recebe esse sinal automaticamente e amplia seu próprio escopo para cobrir a lacuna antes da entrega principal — sem intervenção humana.
2. **`CAPABILITY_ESCALATION_REQUIRED`** — quando o Qwen reconhece que não tem capacidade para uma fase, ele mesmo pede escalonamento; o worker promove automaticamente para Claude/Codex (`resolveCapabilityEscalationAgent`, `worker.ts`), sem parar para o usuário.
3. **`NEEDS_INPUT`** — reservado para quando é **genuinamente** uma decisão/autorização humana (credencial, ação destrutiva, permissão) — cria uma `ProductionIntervention` formal com pergunta, é o único dos 3 que de fato pausa esperando você.

**Regra permanente:** antes de qualquer mudança futura no contrato de fases, verificar se o caso já é coberto por um desses 3 mecanismos antes de propor algo novo — o sistema é mais adaptativo do que parece à primeira vista.

### O que faltava — 4ª categoria de bloqueio, sem caminho automático

Nenhum dos 3 mecanismos acima cobre o caso: "o próprio **objetivo** (não o código, não a capacidade do agente) está desatualizado ou incompleto no momento em que o roteiro de fases foi gerado". Esse caso vira `RESULT: BLOCKED` puro (sem `AUTO_ADJUSTMENT_REQUIRED` nem `NEEDS_INPUT`) — e como o `RETRY` já existente só reseta a fase para `PENDING` e roda de novo **com o mesmo prompt fixo antigo**, retry nunca ajudava nesse caso específico.

**Exemplo real desta sessão:** objetivo "Layout do card Aberto único por pipeline" (`RM-2026-6D5A60`) teve uma execução `v2` com Scout bloqueado (`AGENT_BLOCKED`) por falta do requisito completo — o objetivo só tinha o título na hora em que aquele roteiro foi gerado. O usuário editou o objetivo depois (adicionando descrição/critérios completos), criando automaticamente a `v3`, já documentada e correta — mas a `v2` morta continuava aparecendo como `BLOCKED` na tela, coexistindo e confundindo ao lado da `v3` `AWAITING_APPROVAL`.

### 3 opções de arquitetura mapeadas pelo Scout (só a A foi implementada)

- **Opção A (implementada):** detectar objetivo desatualizado e aposentar a execução antiga automaticamente.
- **Opção B (não implementada, evolução futura):** "maestro leve" por fase — antes de qualquer `BLOCKED` terminal sem `AUTO_ADJUSTMENT_REQUIRED`/`NEEDS_INPUT`, disparar uma chamada extra e barata a um agente diagnosticador (pode ser o próprio Qwen) com o motivo do bloqueio + o objetivo atual do banco (não o prompt congelado), perguntando se é resolvível sem humano. Mais genérico que a Opção A (cobriria outros padrões de bloqueio "resolvível", não só objetivo desatualizado), mas mais complexo e arriscado (novo contrato, novo ponto de decisão, risco do diagnosticador "inventar" correção errada). Retomar se o padrão "bloqueio resolvível sem humano, mas fora do escopo da Opção A" continuar aparecendo na prática.
- **Opção C (não implementada, redesenho grande):** agente maestro persistente por execução (não por fase), com memória e controle ativo do fluxo — mais fiel à analogia literal do usuário, mas exigiria repensar como o roteiro de fases é armazenado/modificado em runtime (hoje é gerado uma vez e imutável). Só considerar se A e B se mostrarem insuficientes.

### Implementação da Opção A

**`src/lib/roadmap-production/worker.ts`, dentro de `syncProductionExecutions`** — novo loop logo após o loop existente de geração de relatório de conclusão (para `SUCCEEDED`). Constrói `Map<objectiveId, sourceVersion atual>` a partir de `objectives` (já carregado no início da função). Para cada execução em `state.executions`:
- Pula `SUCCEEDED` e `RUNNING` — **nunca tocados** (histórico legítimo já entregue / trabalho em andamento, respectivamente).
- Pula execuções já aposentadas (alguma fase já com `errorCode === "OBJECTIVE_SUPERSEDED"`) — evita `appendActivity` duplicada a cada poll de 2s.
- Aposenta (mesmo padrão exato do gate **reativo** `OBJECTIVE_SUPERSEDED` já existente, `worker.ts:~1168`, dentro de `processNextProductionPhaseUnlocked`) as execuções cuja `sourceVersion` é menor que a versão atual documentada do mesmo `objectiveId`: marca a última fase não-`SUCCEEDED` com `status: "BLOCKED"` + `errorCode: "OBJECTIVE_SUPERSEDED"`, `execution.status = "BLOCKED"`, com `appendActivity` explicando o motivo.

**`src/actions/RoadmapProduction.ts`** — `ListarExecucoesAguardandoAprovacao` e `ListarExecucoesPrecisandoAtencao` agora excluem execuções com qualquer fase `errorCode === "OBJECTIVE_SUPERSEDED"` — sem isso, a execução recém-aposentada (que também vira `status: "BLOCKED"`) reapareceria erroneamente no badge "precisa de você", reintroduzindo o mesmo problema que a correção resolve. `ListarExecucoesPorObjetivo` não precisou de mudança — já pegava só a execução mais recente por `createdAt` por `objectiveId`.

**Por que este loop é o lugar certo (e não uma mutação perigosa em rota de leitura):** `syncProductionExecutions` já é, por design pré-existente, uma função de "sincronizar e se auto-corrigir a cada chamada" — não uma leitura pura. Ela já muta estado como efeito colateral em 3 lugares antes desta sessão (gera relatório de conclusão, corrige roteamento de agente, cria novas execuções). O novo loop segue exatamente essa convenção já aceita, chamada tanto pelo worker de fundo quanto pelo poll de leitura da UI (`refreshProductionExecutions` → `ObterRoadmapProduction`) — confirmado por Anubis como consistente, não uma superfície de risco nova.

### Checklist de integração desta parte
- [x] Scout (mapeou 3 mecanismos reativos pré-existentes + 3 opções de arquitetura) → Echo (implementou Opção A) → Forge (`tsc`/`lint`/build limpos; 71/72 testes `roadmap-production`, a 1 falha é `SEARCH_FAILED` pré-existente de sessão anterior, não relacionada) → Anubis (0 achados) → Lens (aprovado)
- [x] Sem migration, sem mudança de schema Prisma

**Última atualização:** 2026-08-24 por Scribe (sessão Bibble — Scout→Echo→Forge→Anubis→Lens→Scribe)

## Roadmap Alpha — Produção: herança de progresso entre versões de execução (2026-08-25)

**Gatilho:** usuário reportou que quando um objetivo **em desenvolvimento** era revisado (nova `sourceVersion` documentada), "sai da fila de em desenvolvimento e volta para pendente e outro assume, o que não pode acontecer pq se não fica toda hora recomeçando e nunca nada termina". Diferente da Opção A (seção acima, mesmo sintoma-raiz): a Opção A resolve a execução **antiga** ficar presa como `BLOCKED` para sempre — este problema é o **desperdício de trabalho já concluído** quando a execução **nova** nasce: até esta correção, toda fase renascia em `PENDING`, mesmo que a versão anterior já tivesse aquela mesma fase `SUCCEEDED` com conteúdo idêntico. Quanto mais vezes um objetivo era revisado no meio do caminho, mais vezes o trabalho já feito era jogado fora — nunca chegando ao fim.

### Mecanismo: comparação de `sha256` por fase, com efeito cascata

**`src/lib/roadmap-production/worker.ts`:**

- `documentedObjectives()` agora seleciona `sha256: true` também em `promptArtifacts` — campo já existia em `RoadmapPromptArtifact` (`prisma/schema.prisma`), só não estava sendo lido; zero migration.
- Novo helper privado `buildFreshPhase(artifact)` — constrói o shape de uma fase nova em `PENDING` (extraído para eliminar duplicação entre os dois pontos do arquivo que criavam fases do zero: dentro de `inheritPhaseProgress` e no `.map()` original usado quando não há execução anterior).
- Nova função pura exportada `inheritPhaseProgress(previousPhases, previousArtifactsByPhase, newArtifacts, previousSourceVersion, at)` — para cada fase nova, em ordem crescente de `phaseNumber`, decide se herda o resultado (`status: "SUCCEEDED"`, `summary`, `changedFiles`, `attemptCount`) da fase correspondente da execução anterior do **mesmo objetivo**. Só herda se, simultaneamente: (a) existe fase correspondente na versão anterior pelo mesmo `phaseNumber`; (b) o `sha256` do artefato bate exatamente entre a versão antiga e a nova — conteúdo da fase idêntico, byte a byte; (c) a fase anterior tinha `status === "SUCCEEDED"`; (d) **nenhuma fase de número menor já quebrou a cadeia de herança** (variável local `chainBroken`, setada assim que qualquer condição acima falha para um `phaseNumber` menor).
- Campos que **sempre resetam**, mesmo quando a fase é herdada: `activities`, `autoRetryCount`, `retryAt`, `errorCode`, `startedAt`, `finishedAt` — nenhum desses faz sentido copiado de uma execução diferente. Cada fase herdada ganha uma `appendActivity` nova citando a versão de origem ("Progresso herdado da versão anterior (vN) — conteúdo desta fase não mudou.").
- No bloco de criação de execução nova dentro de `syncProductionExecutions` (`if (!existing) { ... }`): antes de montar `newExecution`, busca a execução mais recente do **mesmo `objectiveId`** já presente em `state.executions` (`filter` + `sort` por `sourceVersion desc`, pega a primeira). Se existir, busca via `db.roadmapPromptArtifact.findMany({ where: { objectiveId, documentationVersion: previousExecution.sourceVersion, status: "PUBLISHED" }, select: { phaseNumber, sha256 } })` os artefatos daquela versão anterior específica, monta um `Map<phaseNumber, sha256>` e chama `inheritPhaseProgress`. Sem execução anterior (primeira vez que o objetivo gera execução), o comportamento é exatamente o de antes: `objective.promptArtifacts.map((phase) => buildFreshPhase(phase))`.

### Por que o efeito cascata é obrigatório (não opcional)

Cada fase real, ao rodar, recebe `previousSummaries` (contexto já existente no arquivo) — os resumos de **todas** as fases anteriores bem-sucedidas daquela execução. Se a fase 1 mudou de conteúdo entre versões (foi refeita), o resumo dela agora é diferente do resumo antigo. Uma fase 2 cujo **próprio** conteúdo não mudou não pode herdar o resultado antigo mesmo assim, porque aquele resultado antigo foi produzido com um contexto (resumo da fase 1) que já não reflete a realidade atual. `chainBroken` propaga essa invalidação: a primeira fase que não herda "contamina" todas as seguintes, forçando-as a refazer também.

### Validação com dados reais

146 artefatos `PUBLISHED` no banco de produção no momento da implementação, **0 com `sha256` vazio** — confirma que a comparação funciona com o dado real, não é hipotética. 7 testes novos (`tests/roadmap-production/inherit-phase-progress.test.ts`): herança bem-sucedida, não-herança por `sha256` diferente, não-herança por status anterior ≠ `SUCCEEDED`, efeito cascata, fase sem correspondente na versão anterior, execução sem histórico algum, confirmação de que campos de execução (`activities`/`autoRetryCount`/etc.) sempre resetam mesmo quando herdado.

### Checklist de integração desta parte
- [x] Scout (mapeou estrutura de `ProductionPhase`, fonte do `sha256`, ponto exato de criação de execução, riscos de efeito cascata) → Echo (implementou) → Forge (`tsc`/lint/build limpos; suíte `roadmap-production` 78/79 — a 1 falha é `SEARCH_FAILED` pré-existente, não relacionada) → Anubis (0 achados) → Lens (1 sugestão 🟢 aplicada: extração de `buildFreshPhase` para eliminar duplicação com o `.map()` original) → Probe (aprovado, incluindo verificação de `sha256` real em produção)
- [x] Sem migration, sem mudança de schema Prisma

**Última atualização:** 2026-08-25 por Scribe (sessão Bibble — Scout→Echo→Forge→Anubis→Lens→Probe→Scribe)

## Roadmap Alpha — Produção: terceiro provider de desenvolvimento (2026-08-19)

- **Schema:** `developmentProviderSchema` (`src/lib/roadmap-production/contracts.ts`) é `z.enum(["claude","codex","ollama"])` — reutilizado por `roadmapObjectiveCreateSchema`/`roadmapObjectiveEditSchema` (`src/lib/roadmap-alpha/contracts.ts`), então adicionar um provider aqui propaga automaticamente para a validação de criar/editar objetivo, sem precisar tocar em `roadmap-alpha/contracts.ts`.
- **UI de escolha:** grid de botões em `CreateObjectiveDialog`/`EditObjectiveDialog` (`RoadmapDashboard.tsx`) — ao adicionar um 4º provider no futuro, ajustar `sm:grid-cols-3` para o novo total e adicionar a entrada no array local de opções (`{id, label, description}`), em ambos os dialogs.
- **Fallback:** `developmentProviderOrder()` (`worker.ts`) monta `[preferido, ...resto]` automaticamente a partir de um array fixo `["claude","codex","ollama"]` — um provider novo já entra na ordem de fallback sem mudança de código nessa função, só precisa aparecer no array fixo.
- **Labels de exibição:** duplicados propositalmente em 3 lugares (client components não podem importar de `worker.ts`, que é server-only) — `RoadmapDashboard.tsx`, `RoadmapProductionPanel.tsx` (`DEVELOPMENT_PROVIDER_LABEL`, label curto) e `completion-report.ts` (`DEVELOPMENT_PROVIDER_REPORT_LABEL`, inclui texto de fallback). Ao adicionar um provider novo, atualizar os 3.
- **Não confundir com o provider de infraestrutura global:** `SettingsDialog` (mesma tela, botão "Configurar IA") continua **intencionalmente** sem Qwen — `SalvarConfiguracaoRoadmapProduction` rejeita `provider === "ollama"` de propósito. São dois conceitos diferentes: infra global (qual CLI o worker usa por padrão) vs. preferência por objetivo (qual cérebro executa aquele objetivo específico).

## Agenda Alpha — contrato de data civil local (2026-07-31)

- O parâmetro `data=YYYY-MM-DD` da rota `/PainelAlpha/CalendarioAlpha` representa uma **data civil em `America/Sao_Paulo`**, não um instante UTC nem a data local do processo SSR.
- Parse obrigatório: `parsearDataCivil()` em `src/components/CalendarioAlpha/lib/datas.ts`; não usar `new Date("YYYY-MM-DD")`.
- Serialização/chaves obrigatórias: `formatarDataCivil()`; não usar `toISOString().slice(0, 10)` para datas do calendário.
- O contrato vale para navegação, cálculo dos intervalos, títulos, agrupamento/chaves e grids de dia, semana, mês e ano.
- Motivo: strings ISO somente com data são interpretadas como meia-noite UTC e, em `America/Sao_Paulo`, aparecem na noite do dia anterior.
- Meias-noites inexistentes em transições históricas de DST devem resolver para o primeiro instante válido da data; a aritmética diária precisa permanecer monotônica para não travar grids.

## Padrão reutilizável: Vídeo Introdutório por módulo (estreado em Parceiros, 2026-07-14)

Como plugar em um módulo novo (ver `decisions.md` para o design completo):

1. No Server Component da página do módulo, buscar `obterVideoIntrodutorioConfig("id-do-modulo")` (mesmo `Promise.all` das outras queries da página) — `id-do-modulo` deve bater com o `id` em `MODULOS_REGISTRY`.
2. Passar a config como prop para o Client Component do módulo.
3. Renderizar `<BotaoVideoIntrodutorio modulo="id-do-modulo" isAdmin={...} />` no header/topo da tela (`src/components/VideoIntrodutorio/`).
4. Nenhuma migration nova é necessária — o model `VideoIntrodutorioConfig` já é genérico (`modulo: String @unique`), só precisa de 1 linha nova quando o Admin ativar pela primeira vez naquele módulo.
5. Se o módulo tiver regra de permissão diferente de "Admin/CEO" (padrão `isAdminRole()`), avaliar se `ativarVideoIntrodutorio` precisa de parâmetro de autorização customizado antes de reutilizar.

## Checkpoint obrigatório: mudança estrutural na tabela `clientes`

Antes de finalizar qualquer migration que renomeie, recrie, ou mude índice/constraint da tabela `clientes` (model CS&NPS), verificar OBRIGATORIAMENTE (ver `architecture.md` e `decisions.md` 2026-07-13):

- [ ] `PRAGMA foreign_key_list` rodado em TODAS as tabelas do banco, não só nas do módulo em foco
- [ ] `socios`, `log_cs`, `logFeedback`, `historico_alteracao_cliente` (CS&NPS) — FK íntegra para `clientes`
- [ ] `indicacoes` (Parceiros) — FK íntegra, teste manual de "criar nova indicação" funcionando
- [ ] `crm_oportunidades`, `crm_contatos` (CRM) — FK íntegra
- [ ] Fluxo de sincronização Metas→CS&NPS (`criarRegistroClienteAPartirDeContrato`, chamado em `confirmarFechamento`) testado ponta a ponta após a migration
- [ ] Vault não aprova a migration sem essa checklist cumprida

> Mantido por: Scribe (cartógrafo) e Probe (integration tester)
> Todo novo módulo DEVE registrar seus integration points aqui.

---

## CS&NPS — cadastro manual reabilitado (bug corrigido); pendência real de CRM identificada (2026-08-24)

**Contexto do pedido:** usuário reportou que o cadastro de cliente estava "desabilitado por causa do CRM ainda não estar pronto". Investigação do Scout descartou essa hipótese — não existe (e nunca existiu) bloqueio intencional de cadastro ligado ao CRM neste módulo. O que causava a falha era um bug real de payload (ver `known-errors.md`, entrada "CS&NPS — Invalid input: expected string, received undefined"), já corrigido.

**Pendência real e legítima para quando o Alpha CRM (BPM) for lançado**, encontrada durante a investigação (não é a causa do bug, é uma dívida arquitetural separada e já documentada no código):
- `modalDados.tsx:830-832` — campo CNPJ do cliente já existente é somente-leitura, com comentário explícito: *"mudar o CNPJ significaria trocar de Cliente master inteiro. Corrige no Alpha CRM (BPM)"* (decisão da Fase 3.6 do Cliente Master, 2026-08-14).
- Ou seja: o cadastro de cliente NOVO (o que foi corrigido agora) sempre funcionou de forma independente do CRM — mas a EDIÇÃO de CNPJ de um cliente já existente foi deliberadamente deixada para ser resolvida pelo Alpha CRM, que ainda não foi lançado.
- **Ação sugerida:** quando o Alpha CRM for lançado, criar um objetivo no Roadmap Alpha (`/PainelAlpha/Roadmap`, gaveta "Painel Alpha") para decidir e implementar o fluxo de "trocar CNPJ de um Cliente master" — hoje não existe nenhum caminho para isso em lugar nenhum do sistema.

**Última atualização:** 2026-08-24 por Scribe (sessão Bibble — Scout→Echo→Forge→Probe→Scribe)

---

## Checklist de integração para novos módulos

Ao criar um novo módulo, verificar e registrar:

- [ ] Aparece no menu/sidebar?
- [ ] Tem atalho de teclado?
- [ ] Está na lista de permissões/roles?
- [ ] Rota está protegida no middleware?
- [ ] Link de navegação funciona?

---

## Sistema de Notas (EM CONSTRUÇÃO — fila `prompt-phases/`, Fase 01/8 concluída em 2026-08-07)

- **Rota:** `/PainelAlpha/Notas` — **existe de verdade desde a Fase 03** (`src/app/PainelAlpha/Notas/page.tsx`, mesmo padrão de auth/permissão do `AlphaBlueprintPage`).
- **Registry:** entrada `notas` em `src/lib/modulos-registry.ts` (`label: 'Bloco de notas ALpha'`, `category: 'infra'`, `permission: 'notas'`, `iconName: 'StickyNote'`) — confirmado por Probe que isso já é suficiente para aparecer em `GlobalSidebar.tsx`, `PainelAlphaClient.tsx`, `ModalGerenciarSetor.tsx`/`ModalOverrideUser.tsx`/`PreviewModulosSetor.tsx` sem tocar mais nenhum arquivo manual (reconfirma que o checklist antigo de 3 arrays do `CLAUDE.md` raiz está obsoleto).
- **Navegação a partir do shell global:** botões e atalhos fora dos iframes devem reutilizar o `openTab(url, label)` de `PainelLayoutClient.tsx`, como a sidebar. Exemplo real: `<NotesGlobalTaskbar onOpenCentral={() => openTab('/PainelAlpha/Notas', getLabelForUrl('/PainelAlpha/Notas'))} />`; não usar `router.push` para abrir um módulo gerenciado pelas abas do painel.
- **Central ↔ barra global:** a Central roda dentro do iframe e não compartilha a instância Zustand do shell. Depois de fixar/desafixar ou remover notas, use `notificarWorkspaceNotasAtualizado()` (`src/lib/notas-workspace-messages.ts`); `NotesGlobalTaskbar` aceita somente a mensagem tipada de mesma origem e recarrega `ObterWorkspaceNotas`.
- **Privacidade:** `src/lib/notas/acesso.ts` é a fonte única do filtro de listagem (`ownerId` ou compartilhamento `USUARIO`/`SETOR`/`ROLE`). Nunca adicione bypass de Admin em consultas ou helpers de uma nota específica; o bypass administrativo vale somente para entrar no módulo.
- **Lixeira:** exclusão permanente em lote passa por `ExcluirNotasDefinitivamente`/`EsvaziarLixeira`, com filtro obrigatório `ownerId + status=LIXEIRA`; os cards selecionáveis e confirmações ficam em `Central/{ListaNotas,BarraAcoesLixeira,useLixeiraNotas}`.
- **Ícone:** `StickyNote` importado em `ICON_MAP` de `GlobalSidebar.tsx`.
- **Permissão necessária:** `getPermissoesEfetivas(userId).includes('notas')` — a ser checada na `page.tsx` quando ela existir (Fase 03), mesmo padrão dos demais módulos.
- **Checklist de integração desta fase:**
  - [x] Entrada no registry
  - [x] Ícone resolve
  - [x] Aparece nas telas de gerenciamento de permissão (derivado automaticamente do registry)
  - [x] Rota/página — `/PainelAlpha/Notas` real desde a Fase 03
  - [x] Atalhos de teclado `Ctrl+Shift+N`/`Ctrl+Shift+B`/`Ctrl+Alt+N` — `src/hooks/useNotasAtalhos.ts`, confirmado sem conflito com nenhum listener existente
  - [x] Barra global inferior (`NotesGlobalTaskbar`) — construída como componente IRMÃO de `TabBar.tsx`/`PainelLayoutClient.tsx`, montada fora do container de iframes dos módulos
- **Editado quando:** Cada fase seguinte da fila concluir — atualizar este checklist e adicionar entrada própria por fase, seguindo o padrão já usado por Alpha Presentation Studio/Alpha Blueprint (uma seção "Onda N"/"Fase N" por entrega).
- **Última atualização:** 2026-08-11 por Scribe — privacidade por propriedade/compartilhamento, lixeira em lote e sincronização iframe→shell documentadas.

### Sistema de Notas — integração por módulo (Fase 04, 2026-08-07)

**Componente reutilizável:** `<NotesContextButton moduleKey entityType entityId displayName internalPath />` (`src/components/Notas/Contexto/NotesContextButton.tsx`) — badge "Notas: N" que abre popover com lista de notas vinculadas + criar/vincular.

**Módulos integrados:**
- [x] **Chamados** — `src/components/DetalhesChamado.tsx`, dentro do `DialogHeader`, ao lado do badge `#{chamado.id}`. `moduleKey: "chamados"`, `entityType: "chamado"`, `entityId: String(chamado.id)`.

**Módulos PENDENTES (documentados, não esquecidos):**
- [ ] **CS&NPS** (`src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx`) — arquivo de 2000+ linhas, precisa de reconhecimento dedicado do Scout antes de tocar (módulo já teve incidente real de perda de dados, ver `decisions.md` 2026-07-13).
- [ ] **Alpha Leads** — componente real de detalhe de UM lead ainda não localizado (`ModalGerenciamentoLeads.tsx` pertence ao módulo Metas, não a Leads).
- [ ] **Agenda Alpha** — detalhe de evento/reunião, nem investigado ainda.

**Checklist para integrar um módulo novo:**
1. Scout mapeia a estrutura real do componente de detalhe daquele registro (onde inserir o botão sem quebrar layout).
2. Adicionar `<NotesContextButton>` no lugar certo, com `moduleKey`/`entityType`/`entityId`/`displayName`/`internalPath` corretos.
3. **Obrigatório:** adicionar um caso em `entidadeReferenciadaExiste()` (`src/actions/NotasContexto.ts`) validando que o registro existe — sem isso, `VincularContextoNota` rejeita por padrão (fail-safe).

---

## Parceiros — botão "Ver login" no detalhe do parceiro (2026-08-20)

**Contexto:** não existia lugar nenhum para reexibir a mensagem de login (a mesma que se copia e manda ao parceiro no cadastro) depois do cadastro inicial. Usuário pediu botão "Ver login" dentro do detalhe de cada parceiro, livre para qualquer um com acesso ao módulo — **sem** gate de admin (diferente de `TrocarSenhaParceiro`, que continua admin-only).

- **Restrição técnica que molda o design:** a senha original nunca é recuperável — só `senhaHash` (bcrypt) é persistido. "Ver login" **sempre reseta a senha** para uma nova gerada na hora — não existe forma de reexibir a senha antiga. Isso está documentado nos comentários da action e na UI.
- **Server Action:** `gerarMensagemLoginParceiro(parceiroId)` (`src/actions/parceiros.ts`) — só exige `getCtx()` não-nulo (sessão autenticada), sem checar `isAdmin`/`podeEditar`. Gera senha via `gerarSenhaSegura()` (já existente no arquivo), grava `senhaHash`+`senhaTemporaria:true`, retorna `{loginEmail, senhaGerada, nomeParceiro}` em texto puro (só nessa resposta, nunca persistido).
- **UI:** botão em `DetalheParceiroClient.tsx` (seção "Acesso ao Sistema de Parceiros"), reabre o **mesmo** `ModalCredenciais` já usado no cadastro (`NovoParceiro.tsx`) — zero componente duplicado.
- **Template:** reaproveita `getTemplateParadaoParceiro()` (`src/actions/onboarding.ts`), buscado em paralelo em `Parceiros/[id]/page.tsx` e passado como prop `template`, mesmo padrão do cadastro.
- **Efeito colateral consciente (não é bug):** cada clique em "Ver login" invalida a senha vigente do parceiro, mesmo que ele já estivesse logado com ela. Decisão explícita do usuário ao pedir "sem regra de admin".
- **Padrão para replicar em outro módulo com credenciais recicláveis:** reaproveitar o mesmo modal de exibição de credenciais do cadastro + uma action de reset "geral" (sem admin-gate) que retorna a senha nova em texto puro só na resposta, nunca persistida.

---

## Módulos e seus integration points

<!-- Adicionar aqui conforme o projeto cresce -->

### [Nome do Módulo]
- **Rota:** `/caminho`
- **Menu:** [onde aparece]
- **Permissão necessária:** [role/flag]
- **Atalho:** [tecla, se existir]
- **Adicionado em:** [data]

---

## Integration Points por Feature

---

### Moldura — recorte de imagem por forma, estilo Canva (2026-08-18, substitui o modelo decorativo)

**OBSOLETO E REMOVIDO:** o modelo anterior de "moldura" (82 ilustrações vetoriais CC0 — floral/ornamental/vintage — desenhadas por cima do conteúdo via `<img>`/`border-image`, catálogo em `molduras-catalogo.ts`, pasta `public/molduras/`) foi **inteiramente descartado**. O usuário mandou 2 vídeos mostrando o comportamento real do Canva — "moldura" lá nunca foi ilustração decorativa, é uma FORMA GEOMÉTRICA VAZIA que funciona como slot de recorte: arrasta a forma (contorno vazio), depois solta uma imagem dentro e ela é recortada exatamente na silhueta daquela forma. Todo o histórico anterior de decisões sobre `border-image`/recoloração via `mask`/82 molduras CC0 (entradas antigas neste arquivo e em `decisions.md`) descreve um conceito que não existe mais no código — não usar como referência para trabalho futuro.

- **Módulo:** Alpha Presentation Studio (`/PainelAlpha/Apresentacoes/[id]/editor`).
- **Reaproveita o catálogo de FORMAS, não tem catálogo próprio:** `molduraComponenteSchema` (`slide-componentes-basicos.ts`) tem `contorno: FormaVarianteTipo` — o MESMO enum de 40 variantes já usado pelo elemento "forma" (`FORMA_VARIANTE_TIPOS`/`FORMAS_CATALOGO` em `formas-catalogo.ts`). Nunca duplicar essa lista — qualquer forma nova adicionada a `formas-catalogo.ts` automaticamente também vira uma opção de moldura.
- **Campos do schema:** `contorno` (obrigatório), `raioArredondamento?` (0-100, só relevante quando `contorno === "retangulo"` — slider "Arredondamento dos cantos" do Canva), `imagem?: { url, crop? }` (ausente = contorno vazio; `crop` no mesmo formato de `imagemComponenteSchema.crop`).
- **Sem catálogo de moldura de SLIDE inteiro** — o Canva não tem esse conceito (lá "moldura" é só elemento, nunca propriedade de página). O campo `canvas.moldura` foi removido do `canvasConfigSchema`, a seção "Moldura do slide" foi removida de `PainelPropriedadesSlide.tsx`, e `atualizarMolduraCanvas` foi removida do store.
- **Padrão "chave prefixada" no registry (mantido do modelo antigo):** `REGISTRY_MOLDURAS` (`registry-molduras.ts`) usa chaves `moldura{Capitalize<contorno>}` para não colidir com `REGISTRY_FORMAS` no `COMPONENTES_REGISTRY` combinado. `registryMolduraParaEstilo(contorno)` resolve a entrada a partir de um `ComponenteSlide` já montado (usado por `TimelineReal.tsx`).
- **Render (`RenderMoldura`, `RenderBasicos.tsx`):** sem `imagem`, desenha só o contorno (SVG `<g fill="none" stroke tracejado>`, mesmos 4 tipos de elemento de `RenderForma` — `rect`/`ellipse`/`polygon`/`path`). Com `imagem`, usa `<svg><defs><clipPath>` com a mesma geometria do contorno + `<image>` dentro recortada — o `id` do clipPath deriva de `componente.id` (não `useId()`, mais robusto para export/SSR estático deste RenderEngine, que também roda no player offline). O posicionamento da imagem dentro do clip reaproveita a MESMA fórmula de `crop` de `RenderImagem` (offset/escala percentual).
- **Painel de propriedades (`MolduraProps.tsx`):** grade de troca de contorno (mesmas 40 formas), slider de arredondamento condicional, upload de imagem (reaproveita `enviarArquivoAsset`/`validarArquivoAsset` de `assets.ts`, mesmo pipeline de `ImagemProps.tsx`) + campo de link direto, botão remover imagem (volta ao contorno vazio sem perder o `contorno` escolhido).
- **Sem drag-and-drop "soltar imagem em cima da forma vazia"** (como no vídeo do Canva) — decisão consciente: o projeto só tem `useDroppable` na área do canvas inteira (`CanvasArea.tsx`, id `"canvas-droppable"`), nunca por elemento individual; implementar colisão de drag por elemento seria um subsistema novo e caro. Alternativa adotada, com resultado funcional idêntico: usuário seleciona a moldura já no canvas e usa o painel de propriedades para anexar a imagem (upload ou link). Se um dia quiser o drag real, é um blueprint à parte (múltiplos `useDroppable`, um por componente moldura visível, com `over.id` identificando qual elemento recebeu o drop).
- **Migração de dado de produção (Vault, 2026-08-18):** 1 apresentação real no Turso (`cmsnapc420001ji04myvmu8rg`, "ALPAK.ai", DRAFT) tinha 2 slides com o formato antigo (`canvas.moldura` + componentes `tipo:"moldura"` com `variante`/`corFiltro`). Backup completo gerado antes (`database-backups/pre-change/painelalpha_turso_pre_change_moldura-recorte_2026-08-18T19-46-00-467Z.sql`, 66.77 MB, 197 tabelas, 37.649 linhas) e os 2 slides limpos cirurgicamente (só os campos de moldura removidos, resto do conteúdo preservado). Confirmado por varredura completa: zero outro slide no banco tinha esse formato.
- **Checklist de integração desta feature:**
  - [x] Categoria "Molduras" em `CATEGORIAS_COMPONENTE` (mantida, reaproveitando `REGISTRY_MOLDURAS` novo)
  - [x] `RenderComponente.tsx` despacha `case "moldura"` (sem mudança, já existia)
  - [x] Painel de propriedades do elemento (`MolduraProps`) reescrito
  - [x] Painel do slide sem seção de moldura (removida, sem equivalente no Canva)
  - [x] Contorno reaproveita `FORMA_VARIANTE_TIPOS`/`FORMAS_CATALOGO` (zero catálogo duplicado)
  - [x] `public/molduras/` (83 arquivos), `molduras-catalogo.ts`, `moldura-estilo.ts`, `MolduraSlideOverlay.tsx` deletados
  - [x] Dado de produção migrado com backup + confirmação explícita (Vault)
  - [x] `tsc`/`eslint`/`next build` limpos
- **Editado quando:** alguém quiser implementar o drag-and-drop real de imagem sobre a forma vazia, ou adicionar uma forma nova a `formas-catalogo.ts` (automaticamente vira moldura também, nenhuma ação extra necessária).
- **Última atualização:** 2026-08-18 — reformulação completa do conceito de moldura (decorativa → recorte por forma), baseada em vídeos reais do Canva enviados pelo usuário.

---

### Gestão de Comissões e Prêmios (2026-07-28)

- **Rota:** `/PainelAlpha/Comissoes` (+ `/Simulador`, `/Divergencias`, `/Configuracoes`)
- **Registry:** entrada `comissoes` em `src/lib/modulos-registry.ts` (`iconName: 'HandCoins'`, `category: 'financeiro'`, `allowedRoles: ['Admin', 'CEO', 'FINANCEIRO']`)
- **Ícone:** `HandCoins` importado em `ICON_MAP` de `src/components/layout/GlobalSidebar.tsx` (sidebar renderiza a partir do registry, não de lista separada)
- **Permissão necessária:** `getPermissoesEfetivas(userId).includes('comissoes')`, com bypass para Admin/CEO — checado em TODAS as 4 páginas do módulo, mesmo padrão idêntico
- **RBAC granular por ação:** NÃO implementado — é módulo-inteiro; TODO documentado em texto nos 12 arquivos de Server Actions (`ROLES_TEMPORARIAMENTE_PERMITIDOS`)
- **Integração com outros módulos (via `sync-engine.ts` + `adapters/`):** CS&NPS (`clientes` — fonte de êxito via `dataExito`, merge de contratação), Metas (`ContratoComercial` — merge de contratação), Colaboradores (`ContratoColaborador`/`CargoColaborador` — resolução de vínculo CLT/PJ na data do evento)
- **Adicionado em:** 2026-07-28

---

### Alpha CheckList — edição, pastas e exportação de documentos

**Atualizado em:** 2026-07-14 por Scribe.

**Rotas:** a listagem e o detalhe existentes permanecem em
`/PainelAlpha/CheckList` e `/PainelAlpha/CheckList/[empresaId]`; o download usa
`GET /api/checklist/[empresaId]/documentos/zip`.

**Menu e permissão:** não há nova entrada de menu nem nova permissão. O módulo
continua registrado como `checkList` em `src/lib/modulos-registry.ts`.

**Dados:** `OperacionalClientes.pastaChecklistId` aponta opcionalmente para
`PastaChecklist`; mudanças de embasamento preservam o checklist anterior para não
perder documentos e ativam/criam o checklist do novo tipo.

**Segurança do ZIP:** manter autenticação, limitar a documentos não excluídos e
validar URL HTTPS, nome de arquivo e tamanho antes de buscar conteúdo remoto.

**Modelos de embasamento:** o botão da listagem abre
`/PainelAlpha/CheckList/Embasamentos`; as subrotas
`/PainelAlpha/CheckList/Embasamentos/[tipo]` devem validar o tipo e manter a
mesma autenticação do módulo. Novos checklists sempre consultam
`ModeloItemChecklist` (específico + global), não uma lista fixa de itens no código.

---

### Alpha CRM — CrmPipelineBorder: ponto crítico de contenção visual (RM-2026-41E240, 2026-08-17)

**Arquivo:** `src/components/ui/crm-pipeline-border.tsx`
**Propósito:** Borda animada (gradiente radial) renderizada DENTRO de cada card Kanban.
**Editado quando:** Novos elementos `position: absolute` ou `overflow: visible` forem adicionados ao card.

**Regra de contenção (RM-2026-41E240):**
- O card pai (`KanbanCard` em `PipelineBoardClient.tsx`) usa `overflow-hidden` — NUNCA remover.
- A rolagem interna do conteúdo vive no inner content do `CrmPipelineBorder` (`overflow-y-auto`), não no card.
- A accent bar (`absolute inset-y-0 left-0 w-1`) e a `border-red-500/70` dependem do `overflow-hidden` do card para não vazar no gap entre cards.
- Ao adicionar qualquer elemento com `position: absolute` ou `overflow: visible` dentro do card, verificar que não ultrapassa os limites.

**Última atualização:** 2026-08-17 por Scribe

---

### Template de Onboarding — Campo `tipo`

**Adicionado em:** 2026-06-18 por Scribe (sessão Bibble). **Estendido em:** 2026-07-06 (tipo CONVITE).

**Descrição:** Discriminador de destino dos templates de onboarding. Permite que o admin crie templates específicos por audiência (colaborador, parceiro, cliente futuro, convite de parceiro) e que o sistema exiba o template correto em cada fluxo.

**Valores válidos:** `USUARIO | PARCEIRO | CLIENTE | CONVITE`

**⚠️ Armadilha já sofrida (2026-07-06):** o campo `tipo` foi adicionado ao `schema.prisma` em 2026-06-18, mas a migration NUNCA foi aplicada de fato no Turso de produção — só existia no schema, gerando `The column tipo does not exist` em toda tentativa de criar template. Corrigido via `ALTER TABLE onboarding_template ADD COLUMN tipo TEXT DEFAULT 'USUARIO'` direto no Turso. **Toda vez que uma coluna nova for adicionada ao schema, CONFIRME com `PRAGMA table_info` no Turso real — não confie que "está no schema.prisma" significa "está em produção"** (ver `decisions.md` sobre `prisma db push` não alcançar o Turso).

**Schema:**
```prisma
// prisma/schema.prisma — model OnboardingTemplate
tipo String @default("USUARIO")  // USUARIO | PARCEIRO | CLIENTE
```

**Como adicionar um novo tipo no futuro:**
1. Adicionar o valor em `z.enum([...])` na validação das actions (quando implementado)
2. Criar a lógica de busca equivalente a `getTemplateParadaoParceiro` em `src/actions/onboarding.ts`
3. Adicionar badge visual no card de listagem em `GestaoOnboardingClient.tsx`
4. Conectar no Server Component da rota que exibirá o template

**Arquivos que precisam ser tocados ao adicionar novo tipo:**

| Arquivo | O que mudar |
|---------|-------------|
| `src/actions/onboarding.ts` | Nova action `getTemplatePadrao[Tipo]()` |
| `src/components/GestaoOnboarding/GestaoOnboardingClient.tsx` | Badge visual + opção no Select |
| `src/app/PainelAlpha/[Rota]/page.tsx` | Buscar template + passar como prop |

---

### Template de Parceiro — Integração com ModalCredenciais

**Adicionado em:** 2026-06-18 por Scribe (sessão Bibble)

**Descrição:** Ao cadastrar um novo parceiro, o `ModalCredenciais` exibe a mensagem de boas-vindas do template de onboarding do tipo `PARCEIRO` padrão. Se não houver template PARCEIRO ativo, o modal exibe mensagem genérica (comportamento já tratado no componente).

**Arquivos envolvidos:**

**`src/actions/onboarding.ts`**
Action: `getTemplateParadaoParceiro()`
```typescript
// Busca template ativo do tipo PARCEIRO (preferência para marcado como padrão)
export async function getTemplateParadaoParceiro(): Promise<OnboardingTemplate | null> {
  const template = await onboardingTemplateModel.findFirst({
    where: { ativo: true, tipo: "PARCEIRO" },
    orderBy: [{ padrao: "desc" }, { createdAt: "desc" }],
  });
  return template ?? null;
}
```

**`src/app/PainelAlpha/Parceiros/novo/page.tsx`** — Server Component
```typescript
// Busca template de parceiro em paralelo com dados do usuário
import { getTemplateParadaoParceiro } from "@/actions/onboarding";

const [rec, template] = await Promise.all([
  db.usuarios.findUnique({ where: { id: userId }, select: { tema_interface: true } }),
  getTemplateParadaoParceiro(),
]);
// Passa template para NovoParceiro como prop
<NovoParceiro template={template} temaName={temaName} />
```

**`src/components/Parceiros/NovoParceiro.tsx`** — já aceita `template?: OnboardingTemplate | null`
**`src/components/Parceiros/ModalCredenciais.tsx`** — já substitui `[LOGIN]` e `[SENHA]` da mensagem do template

**Fluxo completo:**
```
Admin cria template tipo=PARCEIRO em /GestaoOnboarding
  → getTemplateParadaoParceiro() busca { ativo:true, tipo:"PARCEIRO" }, padrao desc
  → page.tsx de /Parceiros/novo passa como prop
  → NovoParceiro → ModalCredenciais exibe a mensagem com [LOGIN]/[SENHA] substituídos
```

---

### Template de Convite — Integração com ModalMensagemConvite

**Adicionado em:** 2026-07-06 por Scribe (sessão Bibble)

**Descrição:** Ao gerar um link de convite de parceiro (`ModalConvidarParceiro.tsx`, dentro de `/PainelAlpha/Parceiros`), um novo modal `ModalMensagemConvite.tsx` exibe a mensagem de boas-vindas do template tipo `CONVITE` padrão, com `[LINK]` e `[PIN]` já substituídos — pronta para copiar e enviar ao futuro parceiro. Se não houver template CONVITE ativo, usa mensagem de fallback hardcoded (mesmo padrão do `ModalCredenciais`).

**Placeholders deste tipo:** `[LINK]` (URL completa do convite) e `[PIN]` (4 dígitos) — NÃO usa `[LOGIN]`/`[SENHA]`/`[NOME]` (ainda não existe parceiro cadastrado neste momento do fluxo).

**Arquivos envolvidos:**
- `src/lib/onboarding-placeholders.ts` — helper **compartilhado** `substituirPlaceholders(mensagem, valores)`, extraído da função que antes vivia só dentro de `ModalCredenciais.tsx`. Genérico: aceita qualquer `Record<string,string>`, usado tanto para `{LOGIN,SENHA}` quanto `{LINK,PIN}`.
- `src/actions/onboarding.ts` — `getTemplateParadaoConvite()`, espelho exato de `getTemplateParadaoParceiro()` trocando o filtro para `tipo: "CONVITE"`.
- `src/app/PainelAlpha/Parceiros/page.tsx` — busca `getTemplateParadaoConvite()` em paralelo, passa como prop `templateConvite` para `ParceirosClient`.
- `src/components/Parceiros/ModalMensagemConvite.tsx` (novo) — recebe `{ open, onClose, link, pin, template }`, monta a mensagem final e exibe com botão de copiar.

**Fluxo completo:**
```
Admin cria template tipo=CONVITE em /GestaoOnboarding (placeholders sugeridos: [LINK] [PIN])
  → page.tsx de /PainelAlpha/Parceiros busca getTemplateParadaoConvite() em paralelo
  → passa como prop templateConvite até ParceirosClient
  → Admin clica "Convidar parceiro" → ModalConvidarParceiro gera o link+pin
  → ModalConvidarParceiro chama onConviteGerado({ link, pin }) — NÃO renderiza o modal de mensagem ele mesmo
  → ParceirosClient guarda em estado (mensagemConvite) e monta <ModalMensagemConvite /> como irmão independente
  → ModalMensagemConvite substitui [LINK]/[PIN] e exibe a mensagem pronta pra copiar
```

**⚠️ Padrão a NUNCA repetir (bug real desta sessão):** a primeira versão tentou renderizar `ModalMensagemConvite` (que usa `Dialog` do Radix, com hooks internos) **condicionalmente dentro do próprio `ModalConvidarParceiro`**, que tem um early-return `if (!open) return X`. Isso causou `Rendered more hooks than during the previous render` — dois caminhos de render com quantidade de hooks/estrutura de árvore diferente dentro do mesmo componente. **Regra geral: nunca monte um modal filho com Dialog/hooks próprios dentro de um componente que tem early-return condicional baseado em prop — sempre eleve o estado do modal filho para o componente pai** (callback tipo `onConviteGerado`, e o pai decide se/quando montar o filho).

**Editado quando:** Novo tipo de parceiro precisar de template customizado.

**Última atualização:** 2026-06-18 por Scribe

---

### Wizard de Convite de Parceiro — multi-tela (7 telas)

**Adicionado em:** 2026-07-06 por Scribe (sessão Bibble)

**Descrição:** O convite público de parceiro (`/convite/parceiro/[token]`) era um form single-page (`FormConviteParceiro.tsx`, deletado) e virou um wizard de 7 telas, no mesmo espírito do onboarding multi-step do portal AlphaParceiros.

**Fluxo completo (geração → PIN → preenchimento com busca automática → aprovação):**
```
1. Admin/equipe abre ModalConvidarParceiro.tsx (dentro de /PainelAlpha/Parceiros)
   → gerarConvite({ validadeDias }) cria ConviteParceiro (token randomUUID, PIN de 4 dígitos, status PENDENTE)
   → link copiado automaticamente; PIN exibido na tela (só neste momento — listarConvites NUNCA retorna o pin)
   → quem convida repassa link + PIN manualmente ao convidado (WhatsApp, e-mail etc)

2. Convidado abre o link → src/app/convite/parceiro/[token]/page.tsx (Server Component)
   → validarConvitePublico(token) checa status/expiração, busca ParceiroTermo ativo
   → se inválido: <ConviteInvalido motivo={...} /> (NAO_ENCONTRADO|EXPIRADO|USADO|REVOGADO)
   → se válido: <ConviteWizard token={token} termo={resultado.termo} />

3. ConviteWizard.tsx (src/components/Parceiros/Convite/) orquestra o wizard via 1 useState:
   Step -1 StepPin — pede os 4 dígitos do PIN (só valida FORMATO aqui; a validação real
            do PIN acontece no backend, na primeira consulta de CPF tentada no Step 1)
   Step 0  Apresentação (texto institucional + e-mail — SEM campo de senha, removido)
   Step 1  StepDadosPessoais — CPF + lupa (busca CPF+dataNascimento via InfoSimples,
           rota pública protegida pelo PIN), Data de Nascimento, Nome, Telefone, WhatsApp
   Step 2  StepEndereco (CEP com busca ViaCEP, endereço opcional mas completo-ou-nada)
   Step 3  StepAreaAtuacao (multi-select de 8 áreas fixas)
   Step 4  StepEmpresa — CNPJ + lupa (busca via ReceitaFederal, JÁ pública, sem custo,
           SEM precisar de PIN), Razão Social, Nome Fantasia, campo "sobre"
   Step 5  StepTermos (só aparece se houver ParceiroTermo ativo; senão pula direto pro submit)
   Step 6  StepSucesso
   → submissão final chama submeterConvitePublico(...) (convites-parceiro.ts)

4. submeterConvitePublico cria PreCadastroParceiro (status PENDENTE) + marca convite USADO
   — grava inclusive os payloads BRUTOS das duas consultas (dadosConsultaCpf/dadosConsultaCnpj),
   mesmo os campos que não aparecem na tela, para não precisar reconsultar na aprovação

5. Admin abre ModalPreCadastros.tsx (lista PENDENTE, mostra whatsapp + endereço completo +
   razaoSocial/nomeFantasia + dataNascimento)
   → aprovarPreCadastro(id): monta objeto `endereco` só se cep+logradouro+bairro+cidade+uf
     estiverem TODOS presentes → combina dadosConsultaCpf+dadosConsultaCnpj num único JSON
     → chama criarParceiro() repassando telefone2=whatsapp, nome=razaoSocial‖nomeCompleto,
     nomeFantasia=nomeFantasia‖nomeEmpresa(legado), dadosConsulta=combinado, e
     termoAceito/termoAceitoEm/termoVersao (o parceiro nasce com o termo já aceito)
```

**Segurança da rota de consulta de CPF (`/api/convite/consulta-cpf`):** pública (sem `auth()`),
protegida pelo PIN do convite. Valida nesta ordem antes de gastar a chamada paga na InfoSimples:
token existe → status PENDENTE → não expirou → `convite.pin` não é null → pin bate exatamente.
Convites gerados ANTES desta feature (pin=null) são bloqueados explicitamente, não recebem
passe livre. **PENDÊNCIA DE SEGURANÇA CONHECIDA:** não há rate-limit nem contador de tentativas
— ver `decisions.md` (decisão de risco aceito conscientemente pelo usuário).

**Arquivos envolvidos:**
- `prisma/schema.prisma` — `ConviteParceiro.pin` (nullable); `PreCadastroParceiro` +whatsapp/endereço (rodada anterior) +dataNascimento/dadosConsultaCpf/razaoSocial/nomeFantasia/dadosConsultaCnpj (esta rodada)
- `src/actions/convites-parceiro.ts` — `gerarConvite` (gera PIN), `PreCadastroSchema`, `submeterConvitePublico`, `aprovarPreCadastro`, `listarPreCadastros`
- `src/actions/parceiros.ts` — `ParceiroSchema` ganhou `termoAceito`/`termoAceitoEm` (`z.coerce.date()`)/`termoVersao` opcionais
- `src/app/api/convite/consulta-cpf/route.ts` — rota pública nova, espelha `ConsultaCpf/route.ts` mas sem `auth()`, protegida por PIN
- `src/app/api/ReceitaFederal/route.ts` (`getReceitaData`) — reaproveitada AS-IS para a busca de CNPJ (já era pública, sem custo)
- `src/components/Parceiros/Convite/` — `ConviteWizard.tsx`, `StepPin.tsx` (novo), `StepApresentacao.tsx`, `StepDadosPessoais.tsx`, `StepEndereco.tsx`, `StepAreaAtuacao.tsx`, `StepEmpresa.tsx`, `StepTermos.tsx`, `StepSucesso.tsx`, `shared.tsx`
- `src/app/convite/parceiro/[token]/page.tsx` — renderiza `ConviteWizard` no lugar do form antigo
- `src/components/Parceiros/ModalConvidarParceiro.tsx` — exibe o PIN junto ao link ao gerar
- `src/components/Parceiros/ModalPreCadastros.tsx` — exibe whatsapp/endereço/razaoSocial/nomeFantasia/dataNascimento

**Como adicionar uma nova tela ao wizard no futuro:**
1. Criar `Step[Nome].tsx` em `src/components/Parceiros/Convite/`, seguindo a assinatura `{ ...dados, onChange, onBack, onNext }`
2. Adicionar o campo(s) correspondentes em `ConviteFormData`/`CONVITE_FORM_VAZIO` (`shared.tsx`)
3. Adicionar a entrada no array `STEPS_LABEL` do `ConviteWizard.tsx` (controla o stepper visual) e o `{step === N && <StepNovo .../>}`
4. Se o campo precisa persistir, adicionar coluna em `PreCadastroParceiro` (ver decisão sobre migration no Turso em `decisions.md`) + repassar em `submeterConvitePublico`/`aprovarPreCadastro`

**Editado quando:** Nova etapa de coleta de dados no convite público, ou mudança no fluxo de aprovação de pré-cadastro.

**Última atualização:** 2026-07-06 por Scribe

---

### Alpha Presentation Studio (módulo novo — Onda 1 de 6)

**Adicionado em:** 2026-07-09 por Scribe (sessão Bibble)

**Descrição:** Editor de apresentações HTML interativas. Escopo total aprovado pelo usuário é grande (dashboard, editor visual, biblioteca de componentes, animações 2D/3D, motor de IA, export/publicação, colaboração real-time) — construção fatiada em 6 ondas sequenciais, cada uma passando pelo pipeline serial completo (Scout já mapeou o todo; cada onda ainda passa por Vault/Forge/Probe/Anubis/Lens/Sage/Scribe quando aplicável). **Esta entrada documenta a Onda 1** (schema + Dashboard). Roadmap das ondas seguintes vive nas tasks do Bibble (Onda 2: Editor/canvas/componentes básicos; Onda 3: temas/animações/timeline; Onda 4: 3D; Onda 5: IA; Onda 6: apresentação fullscreen/export/publicação/colaboração).

**Checklist de integração (Onda 1):**
- [x] Aparece no menu/sidebar — via `MODULOS_REGISTRY` (fonte única, sem arrays manuais adicionais)
- [x] Ícone resolve (`MonitorPlay` no `ICON_MAP` de `GlobalSidebar.tsx`)
- [x] Permissão administrável pelo Admin — automática via `MODULOS_GERENCIAVEIS` (deriva do registry em `ModalGerenciarSetor.tsx`/`ModalOverrideUser.tsx`, sem lista manual separada — confirmado por Probe nesta sessão, o CLAUDE.md que fala de array manual em `FormCadastro.tsx` está OBSOLETO)
- [x] Rota protegida por permissão de módulo — `Apresentacoes/page.tsx` chama `getPermissoesEfetivas()` e redireciona se `!perms.includes("apresentacoes")` (adicionado depois que Probe identificou a lacuna; ver `decisions.md`/journal para o padrão geral do projeto, onde só ~6 de 30 páginas de módulo fazem esse check explícito — Apresentações agora é uma delas)
- [x] Rota do editor (`/PainelAlpha/Apresentacoes/[id]/editor`) — **existe e funciona** (Onda 2, 2026-07-09). Testada em browser real com credenciais reais (Probe): o bug original reportado pelo usuário ("dá 404 toda vez que vou editar") está confirmadamente resolvido.

**Arquivos envolvidos (Onda 1):**
- `prisma/schema.prisma` — 7 models novos (`Apresentacao`, `Slide`, `ApresentacaoTema`, `ApresentacaoAsset`, `ApresentacaoVersao`, `ApresentacaoColaborador`, `ApresentacaoComentario`) + 3 relations reversas em `usuarios`. Migration real já aplicada no Turso (script Node pontual com `@libsql/client/web`, confirmado via `PRAGMA table_info`, script descartado após uso — padrão já estabelecido no projeto).
- `src/lib/validations/apresentacao.ts` — schemas Zod (`criarApresentacaoSchema`, `atualizarStatusSchema`, `paginacaoApresentacaoSchema`, `dadosSlideVazioSchema`)
- `src/actions/apresentacoes.ts` — `ListarApresentacoes`, `CriarApresentacao`, `DuplicarApresentacao`, `ExcluirApresentacao`, `AtualizarStatusApresentacao`
- `src/lib/modulos-registry.ts` — entrada `{ id: 'apresentacoes', ... category: 'comercial' ... }`
- `src/components/layout/GlobalSidebar.tsx` — import + `ICON_MAP['MonitorPlay']`
- `src/app/PainelAlpha/Apresentacoes/page.tsx` + `src/components/Apresentacoes/Dashboard/{ApresentacoesDashboard,CardApresentacao,ModalNovaApresentacao}.tsx`

**Como adicionar a Onda 2 (Editor) no futuro:**
1. Criar `src/app/PainelAlpha/Apresentacoes/[id]/editor/page.tsx` (fina) — isso sozinho já resolve o 404 esperado hoje
2. Seguir o blueprint de Scout (camadas: Sidebar/Canvas/Painel Direito/Barra Superior/Timeline, `RenderEngine.tsx` como ÚNICA fonte de renderização de `dadosJson`, reutilizada pelo Editor E futuramente pelo Modo Apresentação/Export)
3. `dadosJson` do `Slide` deve ganhar validação Zod `z.discriminatedUnion("tipo", [...])` antes do Editor começar a escrever conteúdo de usuário nele (ainda não implementado — só a Onda 1 criou o slide inicial vazio `{ componentes: [] }`)

**⚠️ Pendência de segurança registrada para a Onda 6:** `Apresentacao.senhaAcesso` existe no schema como texto plano — ao implementar a verificação de senha da apresentação publicada, usar `bcryptjs` (hash + compare), nunca comparação direta. Ver `decisions.md`.

**Editado quando:** Cada nova onda do módulo for concluída — atualizar o checklist acima e adicionar a seção de arquivos da onda correspondente.

---

### Alpha Presentation Studio — Onda 2 (Editor completo)

**Adicionado em:** 2026-07-09 por Scribe (sessão Bibble, mesma sessão da Onda 1)

**Descrição:** Editor de verdade — canvas com posicionamento livre, sidebar de 7 componentes arrastáveis (via `@dnd-kit`, drop na paleta→canvas), painel de propriedades por tipo, barra superior com autosave, lista de slides reordenável (`@dnd-kit` sortable, mesmo padrão do Kanban `PipelineClient.tsx`), timeline placeholder (lista de camadas por zIndex, sem keyframes reais — isso é Onda 3). Motivo desta onda: usuário reportou "toda vez que vou editar a apresentação dá erro 404" — a rota do editor não existia ainda (Onda 1 só tinha o Dashboard). **Testado em browser real com credenciais reais (Probe) — 404 confirmadamente resolvido.**

**Checklist de integração (Onda 2):**
- [x] Rota `/PainelAlpha/Apresentacoes/[id]/editor` existe, carrega sem 404/crash
- [x] Ownership checado na `page.tsx` (autor, colaborador ou Admin/CEO) ANTES de qualquer dado do slide ser passado ao client — confirmado por Anubis
- [x] Regra de negócio "não pode excluir o último slide" — reflete na UI (botão `disabled`, `aria-label`/`title` explicando), não só no backend (`ExcluirSlide` bloqueia com `count(slides) <= 1`)
- [x] Autosave funcional (debounce 1.5s, indicador visual "Salvando.../Salvo" na barra superior) — confirmado no browser real
- [x] Zoom funcional (testado clique real: 100%→125%)
- [ ] Drag-and-drop físico (arrastar componente da paleta pro canvas) — funcionalidade implementada e usa o mesmo padrão já em produção no CRM (`@dnd-kit`), mas **não foi possível confirmar por automação de browser** (limitação de simular `PointerEvent` sintético contra o `@dnd-kit`, não indício de bug). Recomendado teste manual humano antes de considerar 100% validado.
- [ ] Seleção de componente aninhado (filho dentro de Card/Grid) — implementado conforme decisão de UX confirmada (clique seleciona o filho mais profundo direto), mas não testado em browser real por falta de um componente aninhado na apresentação de teste disponível.

**Arquivos envolvidos (Onda 2):**
- `src/lib/validations/slide-componentes.ts` — union discriminada Zod (7 tipos: texto, imagem, botao, card, grid, icone, divisor), `card`/`grid` recursivos via `z.lazy()`. **Atualizado por Sage após o registro inicial de Nova**: `w`/`h` ganharam `.min(1)` (evita componente invisível por tamanho ≤0) e `dadosSlideSchema` ganhou `.refine()` validando IDs únicos em toda a árvore (evita comportamento confuso na store quando 2 nós compartilham `id`).
- `src/actions/slides.ts` — `ListarSlides`, `ObterSlide`, `CriarSlide`, `AtualizarSlide` (valida `dadosJson` com Zod antes de salvar), `ReordenarSlides` (transação atômica), `ExcluirSlide` (bloqueia se for o último), `DuplicarSlide`. Todas usam `checarOwnershipApresentacao()` — helper compartilhado que sobe do `slideId`/`apresentacaoId` até `Apresentacao.autorId`/`colaboradores`, nunca confia no ID do slide isolado.
- `src/app/PainelAlpha/Apresentacoes/[id]/editor/page.tsx` — fina, ownership check antes de qualquer render.
- `src/components/Apresentacoes/Editor/` — árvore completa: `ApresentacaoEditor.tsx` (orquestrador, `DndContext` global + autosave), `SidebarEsquerda/` (paleta + lista de slides), `Canvas/` (área de trabalho + `useCanvasDragResize` — drag/resize livre via mouse events próprios, não `@dnd-kit`), `PainelDireito/` (propriedades por tipo), `BarraSuperior/`, `Timeline/` (placeholder), `RenderEngine/RenderComponente.tsx` (**fonte única de renderização de `dadosJson`, PURA — sem seleção/side-effects, reutilizada obrigatoriamente pelas Ondas 3/6**), `registry/componentes-registry.ts` (mapa tipo→defaults, usa `crypto.randomUUID()` nativo), `store/useEditorStore.ts` (Zustand simples, sem middleware).

**Decisão de arquitetura chave (não reabrir sem motivo novo):** `@dnd-kit` é usado SÓ para (a) arrastar da paleta pro canvas e (b) reordenar a lista de slides — nunca para mover/redimensionar um componente já posicionado no canvas, que usa mouse events próprios (`useCanvasDragResize.ts`). Motivo: `@dnd-kit` é uma lib de reordenação/colisão, não de posicionamento livre X/Y com resize.

**Dívida técnica registrada (Lens):** `ComponenteNoCanvas.tsx` reimplementa a renderização visual de Card/Grid (`RenderComponenteContainer`) em vez de reaproveitar `RenderComponente` — duplicação aceita porque o RenderEngine puro não pode conhecer o conceito de "seleção". Se essa duplicação crescer numa 3ª variante (ex: Export na Onda 6), considerar parametrizar `RenderComponente` com uma prop `renderFilho?`.

**Pendência de baixa prioridade (Sage):** `CriarSlide`/`DuplicarSlide` concorrentes (2 cliques muito rápidos) podem gerar `ordem` duplicada entre 2 slides — mitigado no fluxo normal pelo `disabled` do botão durante o processamento; não corrigido com lock/transação de leitura+escrita por ser um cenário raro.

**Como adicionar a Onda 3 (Temas + Animações + Timeline real) no futuro:**
1. Campo `animacao` já reservado (`z.unknown().optional()`) em `baseComponenteSchema` — tipar de verdade nesta onda, sem precisar migrar dados existentes.
2. `TimelinePlaceholder.tsx` vira a Timeline real (keyframes) — hoje só lista camadas por zIndex.
3. `ApresentacaoTema` (model já existe desde a Onda 1, ainda sem UI) precisa de tela de gestão/aplicação de tema.

**Editado quando:** Onda 3 concluir.

**Última atualização:** 2026-07-09 por Scribe

---

### Alpha Presentation Studio — Onda 3 (Temas + Animações + Timeline real)

**Adicionado em:** 2026-07-09 por Scribe (sessão Bibble, mesma sessão das Ondas 1 e 2)

**Descrição:** Deu vida ao model `ApresentacaoTema` (existia desde a Onda 1 sem nenhuma UI), tipou o campo `animacao` reservado desde a Onda 2, e substituiu a Timeline placeholder por uma régua de tempo real com barras arrastáveis. Escopo de animação ampliado pelo usuário (13 tipos em vez dos 10 propostos por Scout) e GSAP instalado antecipadamente (sem uso de código ainda) por pedido explícito do usuário.

**Checklist de integração (Onda 3):**
- [x] Botão "Tema" na Barra Superior abre modal `SeletorTema` com os 5 templates seedados — **testado em browser real**
- [x] Aplicar tema persiste e sobrevive a reload completo da página (`Apresentacao.temaId` lido corretamente na `page.tsx` do editor) — **confirmado via teste real: aplicar "Alpha Premium" → reload → tema segue marcado como ativo**
- [x] Timeline mostra régua de tempo (0-5s) + barras de delay/duração arrastáveis por componente — confirmado visualmente (texto mudou de "Camadas (N)" para "TIMELINE (N)")
- [x] Painel de Propriedades ganhou seção "Animação de entrada" comum a todos os tipos (13 tipos disponíveis, com campos extras condicionais para stagger/typing/counter)
- [ ] Seção de Animação com componente selecionado real — **não testado em browser** (mesma limitação de drag-and-drop das Ondas 1/2 impediu adicionar um componente via automação); revisão estrutural do código feita, mas sem confirmação visual renderizada.
- [ ] **Lacuna de UX conhecida, não corrigida ainda**: animação `stagger` configurada num Card/Grid não é visível DENTRO do Editor (só no futuro Modo Apresentação/Export, Onda 6) — ver dívida técnica abaixo.

**Arquivos envolvidos (Onda 3):**
- `src/lib/validations/animacao.ts` — 13 tipos (fade, slide-up/down/left/right, zoom-in/out, flip, bounce, blur, stagger, typing, counter), `configAnimacaoSchema` (tipo/duração/delay/easing + campos condicionais) + `configAnimacaoCompletaSchema` (entrada/saída/loop)
- `src/lib/validations/apresentacao-tema.ts` — schemas de criar/atualizar/aplicar tema
- `src/lib/validations/slide-componentes.ts` — campo `animacao` trocado de `z.unknown()` para `configAnimacaoCompletaSchema` (retrocompatível — dados antigos têm `animacao: undefined`)
- `src/actions/apresentacao-temas.ts` — `ListarTemas` (templates + próprios do usuário, `take: 100` de segurança adicionado por Sage), `CriarTema`, `AtualizarTema` (templates só editáveis por Admin/CEO), `AplicarTema` (ownership via `checarOwnershipApresentacao`)
- `src/components/Apresentacoes/Editor/RenderEngine/RenderComponente.tsx` — ganhou `AnimacaoWrapper` (genérico, cobre 10 dos 13 tipos via `<motion.div>` declarativo), `TextoAnimado` (componente próprio extraído para `typing`/`counter` — hooks não podem rodar condicionalmente dentro de um `case` de switch, violação real das Regras dos Hooks corrigida durante a construção), `FilhosContainer` (stagger em card/grid)
- `src/components/Apresentacoes/Editor/PainelDireito/camposPorTipo/AnimacaoProps.tsx` — seção comum de animação, anexada após o formulário específico de cada tipo em `PainelPropriedades.tsx`
- `src/components/Apresentacoes/Editor/Timeline/{TimelineReal.tsx,useTimelineDrag.ts}` — substituem `TimelinePlaceholder.tsx` (removido do repo). Drag em 1 eixo (tempo), reaproveitando o espírito de `Canvas/useCanvasDragResize.ts`
- `src/components/Apresentacoes/Editor/BarraSuperior/SeletorTema.tsx` (novo) + `BarraSuperiorEditor.tsx` (editado) — modal de escolha de tema
- `src/components/Apresentacoes/Editor/Canvas/CanvasArea.tsx` — aplica CSS custom properties do tema (`--tema-cor-primaria/secundaria/accent`), opt-in
- `src/components/Apresentacoes/Editor/ApresentacaoEditor.tsx`, `src/app/PainelAlpha/Apresentacoes/[id]/editor/page.tsx` — propagam `temaInicial`/`TemaResumo` desde o servidor
- **5 templates seedados no Turso real** (não migration de schema — dados): Alpha Premium, Dark Glass, Corporate, Minimalista, Apple-style (`isTemplate: true`, `criadoPorId: null`)
- **GSAP instalado** (`npm install gsap`) — decisão do usuário, sem uso de código ainda, disponível para ondas futuras

**Decisão de arquitetura chave:** Animação é **puramente declarativa** — vive em `componente.animacao?.entrada` no JSON do slide, nunca imperativa/hardcoded. Se ausente (todo dado das Ondas 1/2), renderiza estático, zero regressão. Tema é aplicado via **CSS custom properties opt-in** (`CanvasArea.tsx`) — os 7 tipos de componente não foram forçados a consumir essas variáveis.

**Dívida técnica registrada (Lens), precisa ser fechada antes/durante a Onda 6:** `ComponenteNoCanvas.tsx` (Onda 2) não replica a lógica de `stagger` que `FilhosContainer` (dentro do `RenderComponente.tsx` puro) ganhou nesta onda — um Card/Grid com animação `stagger` configurada não mostra a cascata visualmente DENTRO do Editor, só no futuro Modo Apresentação/Export. Usuário vai notar essa inconsistência ao configurar e não ver efeito. **Resolver antes de considerar o produto "completo"** — ou replicar stagger em `ComponenteNoCanvas`, ou adicionar aviso/preview explícito.

**Pendência de segurança registrada (Anubis), relevante só quando a Onda 6 existir:** `ApresentacaoTema.tokensJson` é objeto Zod livre — nunca gerar uma tag `<style>` via `dangerouslySetInnerHTML` com esse conteúdo bruto no Export Engine (risco de CSS injection). Sempre aplicar via `style`/CSS custom properties.

**Como continuar na Onda 4 (3D — React Three Fiber/drei) no futuro:**
1. Instalar `@react-three/fiber` e `@react-three/drei` (ainda NÃO instalados — só `three` puro está no projeto, usado em `animated-shader-background.tsx`).
2. Novos tipos de componente 3D (Globo, Partículas, ObjetoGLB) entram no mesmo `componenteSchema` (discriminated union) de `slide-componentes.ts` — seguir o padrão dos 7 tipos existentes (base comum x/y/w/h/zIndex/rotacao/animacao + campos específicos).
3. `RenderComponente.tsx` precisa aprender a renderizar esses novos tipos — provavelmente exigindo um `<Canvas>` do R3F embutido dentro do componente do slide (atenção: já existe um bug catalogado em `known-errors.md` sobre canvas Three.js com `width:0` dentro de containers `absolute` no iframe do painel — relevante aqui).
4. `registry/componentes-registry.ts` ganha entradas para os novos tipos (ícone, label, `criarComponentePadrao`).
5. Considerar se os novos tipos 3D precisam de painel de propriedades específico (`camposPorTipo/GloboProps.tsx` etc) seguindo o padrão já estabelecido.

**Editado quando:** Onda 4 concluir.

**Última atualização:** 2026-07-09 por Scribe

---

### Alpha Presentation Studio — Onda 4 (Componentes 3D via React Three Fiber)

**Adicionado em:** 2026-07-10 por Scribe (sessão Bibble)

**Descrição:** 3 novos tipos de componente no editor: `globo` (esfera com textura opcional, marcadores de lat/lng, rotação automática), `particulas` (campo de pontos animados), `objeto3d` (carrega modelo `.glb`/`.gltf` externo via URL). Todos renderizados via `@react-three/fiber` (R3F) + `@react-three/drei`, instalados nesta onda — primeira vez que R3F entra no projeto (`three` puro já era usado, sem R3F, em `animated-shader-background.tsx`). Compatibilidade de versão confirmada por Scout antes de instalar: `@react-three/fiber@9.6.1` exige `react >=19 <19.3`/`three >=0.156` (projeto: React 19.2.3, Three 0.185.1 — compatível); `@react-three/drei@10.7.7` exige `react ^19`/`@react-three/fiber ^9.0.0`.

**Checklist de integração (Onda 4):**
- [x] 3 novos tipos aparecem na sidebar de componentes com ícones corretos (`Globe`, `Orbit`, `Box` do lucide-react) — **confirmado em browser real (Probe)**
- [x] `<canvas>` WebGL renderiza com dimensões válidas (não `width:0`) dentro do Editor — **confirmado**: `rectWidth`/`rectHeight` batem com `w`/`h` do componente
- [x] Painel de Propriedades mostra os campos corretos por tipo (`GloboProps`/`ParticulasProps`/`ObjetoGlbProps`) — **confirmado**
- [x] Edição de campo + autosave + persistência sobrevive a reload — **confirmado ponta a ponta**: editada cor de um componente Partículas existente, `POST .../editor` (Server Action `AtualizarSlide`) retornou 200, reload confirmou o valor novo persistido
- [x] Zero regressão nos 7 tipos de componente das Ondas 1-3 — **confirmado** (componente "Texto" existente no mesmo slide de teste continuou funcionando normalmente após a mudança)
- [x] Console sem erros de WebGL/Three.js/R3F — único erro presente é o hydration mismatch pré-existente do Radix (`id` de `DropdownMenuTrigger`, SSR vs client), não relacionado a esta onda

**Arquivos envolvidos (Onda 4):**
- `src/lib/validations/slide-componentes.ts` — `globoComponenteSchema` (`corBase?`, `texturaUrl?`, `velocidadeRotacao` 0-5 default 0.5, `marcadores[]` com `lat` `.min(-90).max(90)`/`lng` `.min(-180).max(180)`/`label?`/`cor?`), `particulasComponenteSchema` (`quantidade` 10-2000 default 300, `cor?`, `tamanho` 0.5-10 default 2, `velocidade` 0-5 default 1), `objeto3dComponenteSchema` (`url` obrigatório — string vazia é o valor "sem conteúdo ainda", mesmo padrão do componente Imagem; `autoRotacao` default true; `escala` 0.1-10 default 1). Os 3 adicionados ao `discriminatedUnion` e ao `type ComponenteSlide`.
- `src/components/Apresentacoes/Editor/registry/componentes-registry.ts` — 3 entradas novas (`globo`: ícone `Globe`, w/h 300x300; `particulas`: ícone `Orbit` (escolhido em vez de `CircleDot`/`Sparkles` para não confundir com o ícone do tipo `icone`), w/h 400x300; `objeto3d`: ícone `Box`, w/h 300x300).
- `src/components/Apresentacoes/Editor/RenderEngine/useVisibilidadeIframe.ts` (novo) — hook compartilhado via `IntersectionObserver`, usado pelos 3 componentes 3D para alternar `frameloop` do `<Canvas>` entre `"always"`/`"never"` conforme visibilidade real dentro do iframe do painel (R3F resolve resize via `ResizeObserver` interno sozinho, mas NÃO resolve visibilidade — `document.visibilityState` não reflete o iframe, mesma limitação do `animated-shader-background.tsx`, ver `known-errors.md`).
- `src/components/Apresentacoes/Editor/RenderEngine/GloboRender.tsx` (novo) — `latLngParaVetor3` converte lat/lng em posição 3D na superfície da esfera; rotação automática via `useFrame`; textura opcional via `useTexture` do drei, protegida por Error Boundary de classe `LimiteDeErroTextura` (textura 404/inválida não derruba o slide).
- `src/components/Apresentacoes/Editor/RenderEngine/ParticulasRender.tsx` (novo) — `<Points>`/`<PointMaterial>` do drei, posições geradas via `useMemo`.
- `src/components/Apresentacoes/Editor/RenderEngine/ObjetoGlbRender.tsx` (novo) — `useGLTF` do drei dentro de `Suspense`, protegido por Error Boundary de classe `LimiteDeErroGlb` (mesmo padrão de `LimiteDeErroTextura`); placeholder de cubo wireframe quando `url` vazia ou load falha.
- `src/components/Apresentacoes/Editor/RenderEngine/RenderComponente.tsx` (editado) — 3 novos `case` no switch, delegando para os componentes acima dentro do mesmo `AnimacaoWrapper` já usado pelos outros 10 tipos. RenderEngine continua puro.
- `src/components/Apresentacoes/Editor/PainelDireito/camposPorTipo/{GloboProps,ParticulasProps,ObjetoGlbProps}.tsx` (novos) — seguem exatamente o padrão visual/estrutural de `ImagemProps.tsx`; registrados em `PainelPropriedades.tsx`.

**Decisão de arquitetura chave:** Nenhum `OrbitControls` dentro do Editor — testado e removido (Lens) porque competia com o `pointerdown`/`pointermove` do drag/resize do canvas 2D (`useCanvasDragResize.ts`). Rotação automática via `useFrame` já dá vida visual sem exigir controle manual do usuário. Se o futuro Modo Apresentação (Onda 6) quiser permitir o usuário final girar a câmera manualmente, isso deve ser condicional a um modo "não-editor" (prop explícita), nunca ligado por padrão dentro do Editor.

**Padrão estabelecido — Error Boundary de classe para asset loading assíncrono:** Primeira vez que o projeto usa Error Boundary de classe (React ainda não tem hook nativo equivalente). `LimiteDeErroTextura`/`LimiteDeErroGlb` seguem o mesmo template minúsculo (`getDerivedStateFromError` + `componentDidCatch` para log + render condicional de fallback) — reaproveitar esse template se outro caso de asset externo carregado via hook-que-lança (`useTexture`/`useGLTF`/similar) aparecer no futuro, em vez de reinventar.

**Pendências de segurança registradas (Anubis), relevantes só quando a Onda 6 (View pública) existir:**
1. `texturaUrl` (Globo) e `url` (Objeto3D) são strings livres sem validação de protocolo/domínio — hoje SEM RISCO real porque o fetch roda 100% client-side, no browser do próprio usuário autenticado com ownership da apresentação (mesmo padrão já aceito desde a Onda 2 em `imagemComponenteSchema.url`). Reavaliar se qualquer parte da renderização passar a rodar server-side (export/thumbnail via headless browser) ou se o Modo Apresentação expuser essas URLs a visitantes anônimos — nesse ponto, considerar allowlist de domínio ou proxy de asset.
2. Sem limite de tamanho de arquivo para texturas/modelos `.glb` — hoje só o próprio usuário se prejudica (autossabotagem); relevante quando terceiros passarem a visualizar via Export/Publicação pública.

Ver `decisions.md` (2026-07-10) para o registro completo dessas duas pendências, junto das outras 2 já catalogadas (hash de senha bcrypt, CSS injection de `tokensJson`) — total de 4 pendências acumuladas para auditoria obrigatória na Onda 6.

**Nota de performance (Lens):** cada componente 3D monta seu próprio `<Canvas>` R3F independente (WebGL contexts são caros, browsers têm limite prático de ~8-16 simultâneos). Não é hard-limitado por UI — ver nota em `known-errors.md` caso um usuário reporte componente 3D "sumindo" em slides com muitos outros componentes 3D.

**Editado quando:** Onda 5 concluir.

**Última atualização:** 2026-07-10 por Scribe

---

### Exportação completa do CS & NPS

**Arquivos:** `src/app/PainelAlpha/CadastroClientes/page.tsx`, `src/app/PainelAlpha/CadastroClientes/BotaoExportarDados.tsx`, `src/app/api/cs-nps/exportar/route.ts`, `src/lib/cs-nps/exportar-dados.ts`

**Propósito:** exportar em `.xlsx` todas as empresas do CS & NPS e as relações explicitamente selecionadas no helper ExcelJS, mantendo `clienteId` nas abas satélite.

**Editado quando:** um campo ou relacionamento ligado a `clientes` passar a fazer parte da exportação; a role/permissão do módulo mudar; o botão de ação do CS & NPS for reorganizado; ou o contrato HTTP de download mudar.

**Como adicionar um novo relacionamento:**

```typescript
const clienteSelect = {
  // campos existentes
  novaRelacao: { select: { id: true, clienteId: true, campo: true } },
} as const;

const sheets = [
  // abas existentes
  {
    name: "Nova Relacao",
    headers: Object.keys(clienteSelect.novaRelacao.select),
    rows: clientes.flatMap((cliente) => cliente.novaRelacao),
  },
];
```

Ao evoluir o exportador, atualizar em conjunto o `select` Prisma, a lista de abas/headers e os testes da rota/helper. Não usar `include: true` ou serialização irrestrita: a seleção explícita evita vazar colunas futuras ou dados não aprovados. Relações opcionais 1:1 devem ser convertidas para zero/uma linha, como `indicacao ? [indicacao] : []`.

Para sócios, manter as duas representações complementares: `quantidadeSocios` + `sociosResumo` na aba `Empresas` para leitura consolidada e uma linha por registro na aba `Socios`. Esta aba deve conservar `clienteId` e o contexto humano `clienteRazaoSocial`, `clienteCnpj` e `clienteServico`, para que o vínculo permaneça identificável sem cruzamento manual obrigatório.

**Contrato de autorização:**

```typescript
const acesso = await verificarAcessoAdministrativoCsNps();
if (!acesso.autorizado) return resposta401Ou403(acesso);
```

A verificação visual de `Admin`/`CEO` em `page.tsx` nunca substitui `verificarAcessoAdministrativoCsNps()` de `src/lib/cs-nps/autorizacao.ts`, compartilhado com a importação. Manter 401 para sessão inválida, 403 para usuário inativo/role/permissão insuficiente, 404 quando não houver clientes e 500 genérico sem detalhes internos. Toda exportação bem-sucedida deve continuar gerando a ação de auditoria `EXPORTAR_CS_NPS_COMPLETO`.

**Contrato de segurança do arquivo:** neutralizar formula injection antes de inserir valores no Excel; entregar com `Content-Type` de XLSX, `Content-Disposition: attachment`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` e `X-Robots-Tag: noindex, nofollow, noarchive`. O client deve usar `credentials: "same-origin"`, `cache: "no-store"`, validar `response.ok` antes do blob e revogar o `ObjectURL` após iniciar o download.

**Abas atuais:** `Empresas`, `Socios`, `CS`, `Feedbacks`, `Log Alteracoes`, `Historico Cliente`, `Indicacoes`, `CRM Oportunidades`, `CRM Contatos`.

**Contrato visual:** aplicar em todas as abas cabeçalho destacado, bordas, zebra, autofiltro, primeira linha congelada, `wrapText`, ajuste de largura por tipo/conteúdo e altura compatível com células multilinha. Na aba `Empresas`, preservar as cores semânticas: `feedbackGoogle` com `SIM` verde e `NÃO` vermelho; `status` com `Deferido` verde, prefixo `Cancelado` vermelho, `Stand By` amarelo, `Em andamento` azul e `Arquivado` cinza. Novos valores de status devem ter sua semântica definida explicitamente antes de receber uma cor.

**Contrato de datas (18 colunas explícitas):** declarar cada campo em `dateColumns`; não inferir formatação pelo nome da coluna. Usar `date-only` e formato Excel `dd/mm/yyyy`, sem conversão de timezone, para `Empresas.dataConstituicao`, `Empresas.dataContratacao`, `Empresas.dataExito`, `Socios.dataNascimento` e `CRM Oportunidades.dataFechamento`. Usar `date-time` e formato Excel `dd/mm/yyyy hh:mm`, convertido para `America/Sao_Paulo`, para `Empresas.createdAt`, `Empresas.updatedAt`, `CS.dataRegistro`, `Feedbacks.dataRegistro`, `Log Alteracoes.dataAlteracao`, `Historico Cliente.criadoEm`, `Indicacoes.dataIndicacao`, `Indicacoes.comprovanteEnviadoEm`, `Indicacoes.createdAt`, `CRM Oportunidades.createdAt`, `CRM Oportunidades.updatedAt`, `CRM Contatos.createdAt` e `CRM Contatos.updatedAt`. Manter nulos como células vazias e entradas não reconhecidas ou inválidas como texto original, sem normalização automática.

**Última atualização:** 2026-07-15 por Scribe

---

### Importação em lote do CS & NPS

**Arquivos:** `src/app/PainelAlpha/CadastroClientes/page.tsx`, `src/app/PainelAlpha/CadastroClientes/importacao/`, `src/app/api/cs-nps/importar/{modelo,previsualizar,salvar}/route.ts`, `src/lib/cs-nps/{autorizacao,importacao-tipos,importacao-rate-limit,importar-dados,preflight-xlsx}.ts`, `tests/cs-nps/`

**Propósito:** importar sócios, registros de CS e feedbacks Google em qualquer combinação, sempre com prévia removível e seleção explícita do cadastro/serviço de destino antes da transação final.

**Editado quando:** um campo persistido de `socios`, `log_cs` ou `logFeedback` mudar; o modelo de planilha mudar; a regra `clientes.cnpj + servicos` mudar; roles/permissões do CS & NPS mudarem; limites de upload/ZIP mudarem; ou outra entidade passar a ser importável.

**Como adicionar um novo tipo importável:** manter sincronizados, no mesmo change set, o tipo em `TIPOS_IMPORTACAO`, nome da aba/cabeçalhos e parser em `importar-dados.ts`, schemas discriminados de preview/save, criação transacional, contadores/resumo, seleção e rótulos da UI e os testes Vitest. Nunca aceitar o objeto da planilha como `data` Prisma irrestrito; mapear cada campo explicitamente.

**Contrato atual das abas:**

| Tipo | Aba | Cabeçalhos exatos |
|---|---|---|
| Sócios | `Socios` | `cnpj`, `razaoSocial`, `nome`, `telefone`, `observacao`, `dataNascimento`, `vinculo` |
| CS | `CS` | `cnpj`, `razaoSocial`, `colaborador`, `sentimento`, `observacao`, `dataRegistro` |
| Feedbacks | `Feedbacks` | `cnpj`, `razaoSocial`, `colaborador`, `sentimento`, `observacao`, `dataRegistro` |

O workbook sempre pode conter `Instrucoes` e contém somente as abas escolhidas no modal. CNPJ ou razão social é obrigatório; quando ambos forem fornecidos, precisam apontar para o mesmo conjunto. Vários sócios são representados repetindo a empresa em uma linha por sócio. `sentimento` aceita somente `pos`, `neg` ou `na`; datas aceitam `DD/MM/AAAA`, `AAAA-MM-DD` ou célula de data do Excel e são normalizadas pelo parser.

**Resolução de destino:** `clientes.cnpj` não é único; o vínculo definitivo é `clienteId`. A prévia devolve todos os candidatos com `clienteId`, CNPJ, razão social, serviço e status. Uma correspondência sugere automaticamente o destino; várias deixam a linha ambígua para escolha de empresa/serviço; nenhuma torna a linha inválida. No `POST /salvar`, o servidor refaz o matching pelo identificador original e rejeita qualquer `clienteId` que não continue entre os candidatos. Não confiar na seleção enviada pelo client sem essa revalidação.

**Autorização compartilhada:** as três rotas e a exportação usam `verificarAcessoAdministrativoCsNps()` de `src/lib/cs-nps/autorizacao.ts`, que exige sessão, usuário ainda `ATIVO` no banco, role atual normalizada `admin`/`ceo` e permissão efetiva `Cliente`. A confirmação também revalida role/status dentro da transação. A condição visual em `page.tsx` é apenas conveniência.

```typescript
const acesso = await verificarAcessoAdministrativoCsNps();
if (!acesso.autorizado) return resposta401Ou403(acesso);
```

**Transação e auditoria:** `salvarImportacao()` faz `createMany` em `socios`, `log_cs` e/ou `logFeedback` e cria `IMPORTAR_CS_NPS_SALVO` em `auditoria` dentro do mesmo `db.$transaction`. Qualquer falha reverte dados e auditoria de sucesso. Modelo, prévia, recusas e falhas usam ações de auditoria best-effort nas rotas, sem expor conteúdo sensível da planilha.

**Contrato de upload/preflight:** manter `.xlsx` apenas, 10 MB por arquivo e 2.000 linhas somadas. Antes de `ExcelJS.load`, `preflight-xlsx.ts` percorre o ZIP em streaming com `yauzl`, verifica tamanho real e restringe a 256 entradas, 20 MB por entrada descompactada, 50 MB no total e razão de compressão 100:1. Macros, ZIP criptografado, fórmulas, abas/cabeçalhos inesperados, caminhos inseguros e metadados/tamanhos incoerentes devem continuar bloqueados. A rota de prévia valida `Origin`/`Sec-Fetch-Site`, `Content-Type` e `Content-Length` antes de materializar o formulário.

**Rate limit e idempotência:** `importacao-rate-limit.ts` mantém no máximo cinco prévias por minuto por `userId + IP` e uma prévia simultânea por chave. É uma defesa em memória por instância, não um limite distribuído; mover para Redis/KV se houver várias réplicas. A confirmação não possui chave persistente de idempotência nesta versão; um replay válido pode duplicar registros. Não declarar a operação idempotente sem adicionar uma chave única persistida e tratamento transacional de repetição — isso está fora do escopo atual.

**Testes obrigatórios ao evoluir:** executar os testes Vitest de `tests/cs-nps/importar-dados.test.ts`, `calculos.test.ts` e `preflight-xlsx.test.ts`, cobrindo ao menos abas selecionadas, múltiplos sócios, conflito/ambiguidade de empresa, datas, fórmulas, `clienteId` adulterado, rollback/auditoria, remoção da prévia e ZIP bomb/tamanho real.

**Última atualização:** 2026-07-15 por Scribe

---

### Alpha Presentation Studio — Onda 5 (Motor de IA para geração de conteúdo de slide)

**Adicionado em:** 2026-07-10 por Scribe (sessão Bibble)

**✅ STATUS: COMPLETA (backend + UI).** Backend testado com 4 gerações reais via Ollama. UI (`ModalGerarComIA.tsx`) construída, revisada por Lens/Sage (2 bugs reais encontrados e corrigidos, ver abaixo), tsc/lint/build aprovados por Forge. **Ressalva:** o teste visual automatizado em browser (cliques reais, confirmação de preview renderizado) não pôde ser executado nesta sessão por instabilidade da ferramenta de preview (limitação de ambiente, não de código) — task de teste manual delegada (`task_99054ff9`). Recomenda-se confirmação humana no navegador antes de considerar 100% validado visualmente, mas o código foi revisado linha a linha e os fluxos de erro/estado foram corrigidos por leitura cuidadosa.

**Descrição:** Motor de IA que gera o conteúdo de 1 slide a partir de um prompt em texto livre. A IA escolhe 1 de 5 templates de layout FIXOS pré-definidos no código e preenche só o conteúdo textual — nunca desenha coordenadas x/y/w/h livres (decisão deliberada para evitar saída visualmente quebrada). Streaming SSE real, reaproveitando o mesmo padrão de eventos já usado no chat do Bibble.

**Descoberta de arquitetura importante desta onda:** O CLAUDE.md raiz do projeto documenta `@anthropic-ai/sdk` (`new Anthropic()`) como "padrão futuro" para IA — mas isso **nunca foi implementado**. O Bibble (assistente do painel) usa desde sempre um client multi-provedor próprio (`src/lib/bibble/client.ts`) que chama múltiplos provedores (Ollama/OpenAI/Anthropic/Google) via formato REST OpenAI-compatible (`/v1/chat/completions`), não o SDK oficial nem o formato nativo `/v1/messages` da Anthropic. O usuário confirmou explicitamente: reaproveitar esse client existente, não instalar o SDK novo. **Esta é a arquitetura real de IA do projeto — o texto do CLAUDE.md sobre `@anthropic-ai/sdk` está desatualizado/nunca-implementado, não confiar nele sem verificar o código.**

**Segunda descoberta importante:** o modelo padrão de IA do projeto é **Ollama local** (`BIBBLE_MODEL` default `gemma4:e4b`, servidor `ollama.alpha-comex.com` em produção), **não Anthropic direta** — não há `ANTHROPIC_API_KEY` configurada no ambiente. Echo inicialmente fixou `claude-sonnet-4-6` como padrão (baseado numa leitura literal do nome da onda "Claude API"), o que gerou 401 em teste real do Probe. Corrigido para `process.env.BIBBLE_MODEL ?? "gemma4:e4b"` — mesmo default do chat do Bibble. Ver `decisions.md` (2026-07-10) para o registro completo dessa correção.

**Checklist de integração (Onda 5):**
- [x] Route Handler `POST /api/apresentacoes/gerar-slide` existe e responde
- [x] Auth → Zod → ownership → SÓ DEPOIS chama IA (ordem confirmada por leitura de código E teste real — nenhum caminho pula a checagem antes do custo de IA)
- [x] Streaming SSE real confirmado (44 eventos ao longo de 2.7s num teste real, não resposta instantânea)
- [x] 3 dos 5 templates testados com geração real bem-sucedida (`titulo-subtitulo`, `titulo-tres-cards`, `citacao`) — os outros 2 (`titulo-paragrafo`, `imagem-texto`) não foram testados individualmente mas usam o mesmo mecanismo, risco de quebra isolada é baixo
- [x] 401 sem autenticação, 400 com Zod claro em campos faltando — confirmados
- [x] **Botão/modal "Gerar com IA" no Editor** — `ModalGerarComIA.tsx` construído, botão na Barra Superior (ícone `WandSparkles` — `Wand2` não existe na versão instalada do lucide-react, confirmado via grep). Preview do slide via `RenderComponente` real, escalado com CSS `transform`. **Teste visual humano recomendado** antes de considerar 100% confirmado (ferramenta de preview instável nesta sessão).

**Arquivos envolvidos (Onda 5):**
- `src/lib/bibble/completion.ts` (novo) — `callCompletion` extraída de `src/app/api/bibble/chat/route.ts` (refatoração pura, mesma lógica/assinatura, confirmada sem regressão por Forge). Também ganhou `encodeSSE<T>()`, helper genérico de frame SSE, reaproveitado tanto pelo chat do Bibble quanto pela geração de slide.
- `src/app/api/bibble/chat/route.ts` (editado) — importa `callCompletion`/`encodeSSE`/tipos do helper extraído, sem mudança de comportamento.
- `src/lib/apresentacoes-ia/templates-layout.ts` (novo) — 5 templates fixos (`titulo-subtitulo`, `titulo-paragrafo`, `titulo-tres-cards`, `imagem-texto`, `citacao`), cada um com `descricao`/`camposEsperados`/`preencher(conteudo)`. Helper `cardComTexto()` evita duplicar a estrutura dos 3 cards do template `titulo-tres-cards`.
- `src/lib/apresentacoes-ia/prompts.ts` (novo) — `montarSystemPromptGeracaoSlide()`, lista os templates dinamicamente (nunca hardcoda a lista — se um 6º template for adicionado em `templates-layout.ts`, o prompt já reflete automaticamente). Exige JSON puro na resposta: `{"template": "nome", "conteudo": {"CAMPO": "texto"}}`.
- `src/lib/apresentacoes-ia/gerar-slide.ts` (novo) — `gerarSlideStream()` (async generator, consome o stream do provedor e repassa deltas) + `validarESlideDoTexto()` (função pura separada, parseia/valida o JSON acumulado, testável isoladamente). `MODELO_GERACAO_SLIDE` = `process.env.BIBBLE_MODEL ?? "gemma4:e4b"`. Guard defensivo contra chaves `__proto__`/`constructor`/`prototype` no conteúdo vindo da IA. Loga (não bloqueia) quando a IA omite um campo esperado do template escolhido.
- `src/app/api/apresentacoes/gerar-slide/route.ts` (novo) — Route Handler POST, `auth()` → Zod (`apresentacaoId`, `prompt` max 2000 chars) → `checarOwnershipApresentacao` (mesmo padrão de `slides.ts`) → só então monta o `ReadableStream` SSE.
- `src/components/Apresentacoes/Editor/BarraSuperior/ModalGerarComIA.tsx` (novo) — Dialog com textarea de prompt, consome o SSE via `fetch`+`ReadableStream.getReader()` no client, preview do slide gerado via `RenderComponente` (escalado com `transform: scale()`), botões Aplicar/Gerar outro/Descartar.
- `src/components/Apresentacoes/Editor/BarraSuperior/BarraSuperiorEditor.tsx` (editado) — novo botão "Gerar com IA" (ícone `WandSparkles`), abre o modal.
- `src/components/Apresentacoes/Editor/ApresentacaoEditor.tsx` (editado) — `handleSlideGeradoAplicado` itera os componentes retornados chamando `adicionarComponente` (Zustand) um a um — decisão deliberada de ADICIONAR ao slide ativo, nunca substituir o que já existe (menos destrutivo).

**⚠️ Duas armadilhas reais encontradas nesta rodada de revisão — ficam registradas para não repetir em futuros consumidores de SSE no client:**
1. **Fechar um modal de streaming precisa limpar TODO o estado local**, não só abortar o fetch — senão reabrir mostra a sessão anterior (preview/erro "fantasma"). `ModalGerarComIA.tsx` corrigido: `fecharEAbortar(false)` agora chama `resetar()` + limpa `prompt`/`gerando` além do `AbortController.abort()`.
2. **Respostas de erro HTTP simples (400/401/403) não são SSE** — um endpoint de streaming pode responder com JSON cru de erro ANTES de começar o stream (ex: falha de auth/Zod/ownership). Um client que só sabe ler `data: {...}\n\n` vai **ignorar silenciosamente** essa resposta (nenhuma linha começa com `data: `), deixando o usuário sem feedback nenhum. Fix: sempre checar `!res.ok` e ler o corpo como JSON simples ANTES de tentar `res.body.getReader()` no modo stream. Qualquer novo componente que consuma um endpoint SSE no projeto deve replicar esse guard.

**Decisão de arquitetura chave:** Templates de layout são FIXOS no código (não gerados pela IA) — a IA só escolhe qual template usar e preenche o texto. Isso elimina o risco de coordenadas x/y/w/h inconsistentes/sobrepostas que uma IA "desenhando" livremente produziria. Se a Onda 6 ou uma sessão futura quiser mais variedade visual, adicionar um 6º/7º template em `templates-layout.ts` (a lista em `prompts.ts` se atualiza sozinha) é mais seguro que dar liberdade de coordenadas à IA.

**Pendência de segurança registrada (Anubis) — risco aceito por ora:** sem rate-limit em `/api/apresentacoes/gerar-slide`. Diferente do CPF/convite (API paga InfoSimples, custo financeiro direto por chamada — pendência crítica registrada separadamente), esta rota usa Ollama próprio/interno, sem custo de terceiro por chamada — risco é só de consumo de recurso de infraestrutura própria. **Reavaliar se o modelo padrão for trocado no futuro para um provedor pago** (Anthropic/OpenAI) — nesse momento a ausência de rate-limit deixa de ser aceitável. Ver `decisions.md` (2026-07-10).

**Pendências residuais (baixa prioridade):**
1. Teste visual humano no navegador (task `task_99054ff9`) — confirmar cliques reais, preview renderizado, aplicar/descartar de ponta a ponta.
2. Testar os 2 templates que não foram exercitados individualmente em teste real (`titulo-paragrafo`, `imagem-texto`) — usam o mesmo mecanismo dos 3 já testados, risco de quebra isolada é baixo.

**Editado quando:** Onda 6 concluir.

**Última atualização:** 2026-07-10 por Scribe

---

### Alpha Presentation Studio — Frente 1 (Expansão de Componentes, pós-Onda 5)

**Adicionado em:** 2026-07-10 por Scribe (sessão Bibble)

**Descrição:** Fora da sequência das 6 ondas originais — inserida entre a Onda 5 e a retomada da Onda 6, motivada por feedback direto do usuário de que a biblioteca de componentes (10 tipos) estava muito aquém do prompt original. Expandiu para **24 tipos** (14 novos). Ver detalhe completo em `components.md` (entrada "Frente 1") e `decisions.md` (2026-07-10, unificação por variante).

**Checklist de integração:**
- [x] Todos os 14 novos tipos aparecem na sidebar, agrupados por categoria (`CATEGORIAS_COMPONENTE`) — Básicos/Dados/Business/IA
- [x] Todos têm painel de propriedades (`camposPorTipo/*.tsx`) registrado em `PainelPropriedades.tsx`
- [x] `container` (recursivo) reconhecido em todos os pontos que já tratavam `card`/`grid`: `ComponenteNoCanvas.tsx`, `useEditorStore.ts` (`ehContainerComFilhos`), `PainelPropriedades.tsx` (`buscarNaArvore`), `AnimacaoProps.tsx` (elegibilidade de stagger)
- [x] Zero regressão nos 10 tipos existentes (Forge: tsc/lint/build limpos; Sage: edge cases graciosos)
- [x] `npm install @xyflow/react` — nova dependência, usada exclusivamente em `RenderBusiness.tsx`

**Arquivos envolvidos:** ver lista completa em `components.md` — resumo: `slide-componentes{-base,-basicos,-3d,-dados,-business,-ia}.ts` (validações fatiadas), `registry/{registry-tipos,registry-basicos,registry-3d,registry-dados,registry-business,registry-ia,componentes-registry}.ts` (registry fatiado), `RenderEngine/{nucleo.tsx,RenderComponente.tsx,render/*.tsx}` (RenderEngine fatiado), 14 `camposPorTipo/*.tsx` novos, `SidebarComponentes.tsx` reescrito.

**⚠️ Dívida técnica que CRESCEU nesta frente (Lens) — atualiza a nota já registrada na Onda 2:** a duplicação de renderização de containers entre `RenderComponente.tsx` (RenderEngine puro, usado no Modo Apresentação/preview) e `ComponenteNoCanvas.tsx`/`RenderComponenteContainer` (Editor, com seleção) — aceita desde a Onda 2 para `card`/`grid` — agora também cobre o novo tipo `container` (4 variações de `layout: grid/flex-row/flex-col/stack`). A mesma lógica condicional de `styleLayout` precisa ficar sincronizada em 2 arquivos para 3 tipos de container. **Prioridade de resolução subiu**: candidata a extrair `styleLayout` para uma função compartilhada (mesmo padrão de `posicionamento.ts`, extraído com sucesso na Onda 6 Fase 1 para o problema análogo de posicionamento absoluto). Resolver antes de uma eventual Frente 3/Onda 7, para não deixar a duplicação crescer para um 4º tipo de container.

**Fix aplicado (Sage):** `GrafoProps.tsx` — `removerNo` agora filtra `conexoes` órfãs ao remover um nó (evita lixo acumulando no JSON salvo).

**Editado quando:** Frente 2 (motor de IA com liberdade de composição) ou nova expansão de componentes ocorrer.

**Última atualização:** 2026-07-10 por Scribe

---

### Agenda Alpha (rota legada CalendarioAlpha — Domain-Wide Delegation)

**Adicionado em:** 2026-07-17 por Scribe (sessão Bibble). Detalhe completo em `codebase-map.md` ("Calendário Alpha — MVP via Domain-Wide Delegation..."). **Atenção:** este módulo passou por uma reconstrução completa de arquitetura na mesma sessão (de OAuth por usuário para Domain-Wide Delegation) — se encontrar referência a "conectar conta Google"/tokens/OAuth em versões antigas de documentação ou commits, está desatualizado.

**Checklist de integração:**
- [x] Aparece no menu/sidebar/grid/TabBar — via `MODULOS_REGISTRY` (fonte única, confirmado que os 4 consumidores leem do registry, sem array manual)
- [x] Ícone resolve (`CalendarClock` no `ICON_MAP` de `GlobalSidebar.tsx`)
- [x] Permissão administrável pelo Admin automaticamente (deriva do registry, mesmo mecanismo do `apresentacoes`/`conectoresIAlpha`)
- [x] Rota protegida por sessão (`middleware.ts`, prefixo `/PainelAlpha`) E por permissão de módulo (`CalendarioAlpha/page.tsx` chama `getPermissoesEfetivas()` e redireciona)
- [x] Todas as Server Actions chamam `verificarAcessoCalendarioAlpha()` — **não há mais Route Handlers** desta feature (removidos com o OAuth)
- [x] Fluxo real com Service Account/Domain-Wide Delegation — **validado em 2026-07-17** com credencial e Service Account reais (`calendario-alpha@projeto-alpha-492917.iam.gserviceaccount.com`, Client ID `116171147796556178597`). `calendar.calendarList.list()` impersonando `ti@alpha-comex.com` retornou os calendários reais da conta. `scripts/calendar-alpha-doctor.mjs` precisou de correção (não carregava `.env.local` via `dotenv` — corrigido, agora carrega `.env` + `.env.local` na mesma ordem de precedência do Next.js). Falta ainda: exercitar o fluxo completo pela UI no navegador (ativar módulo, ver eventos reais, criar/editar/cancelar) — a validação feita foi direto na API, não pela tela.

**Auditoria de segurança:** ativação/desativação do módulo gravam em `Auditoria` via `src/lib/google-calendar/auditoria.ts` (`registrarAuditoriaCalendarioAlpha`, best-effort, mesmo padrão de `cs-nps/autorizacao.ts`). Não há mais eventos de OAuth (state/nonce/callback) para auditar — removidos com a arquitetura antiga.

**Regra de segurança permanente para qualquer código futuro neste módulo:** `emailUsuario` (usado para impersonar no Google) só pode vir de `usuarios.email` resolvido no servidor a partir do `userId` da sessão (`obterUsuarioGoogleAtivo`) — nunca de um campo do payload do cliente. A Service Account pode impersonar qualquer usuário do domínio; aceitar um e-mail externo quebraria o isolamento entre usuários.

**Fase 2A atual — integração operacional flags-off (2026-07-30):**

- `POST /api/calendario-alpha/webhook` autentica canal/resource/token e apenas enfileira/coalesce; nunca chama Google no request.
- `GoogleCalendarPushChannel`, `GoogleCalendarPendingOperation` e `GoogleCalendarSyncLease` foram autorizados pelo Vault, aplicados uma única vez no Turso e validados com 7 índices explícitos + 3 unicidades.
- `src/actions/google-calendar-sync.ts` mantém o sync manual e usa o lock distribuído somente quando a flag correspondente está habilitada.
- `calendar-alpha:worker`, `calendar-alpha:maintenance`, `calendar-alpha:queue` e `calendar-alpha:doctor` são os pontos CLI-first; nenhuma UI controla fila, lease ou canal.
- Ao alterar o webhook, atualizar validação/autenticação, coalescência e `tests/google-calendar/webhook.test.ts`.
- Ao alterar fila/lease, preservar CAS, `claimToken`, owner + fencing e testes SQL/concorrência.
- Ao alterar canal, preservar token somente em hash, overlap na renovação e lifecycle serializado por lease.

**Runbook:** manter lock/fila/push desligados; verificar doctor e status; ativar lock → fila → push somente após comprovar URL HTTPS pública, WAF/rate limit distribuído, scheduler supervisionado e E2E Google/Turso multi-instância; começar por canário. O rollback desliga push, interrompe/drena worker, desliga fila e por último o lock.

**Pendências externas:** URL HTTPS pública, WAF/rate limit distribuído, scheduler supervisionado, E2E Google/Turso multi-instância e ativação canário. Não registrar nenhuma delas como concluída por testes locais.

**Editado quando:** qualquer contrato de webhook, fila, lease/fencing, worker, maintenance, flags ou rollout da Agenda Alpha mudar.

**Atualização 2026-07-17 (mesma sessão) — Compartilhamento entre colegas + Admin full-access + Bibble:**
- Nova tabela `GoogleCalendarColegaVisivel` (4ª migration Vault): qualquer usuário pode adicionar qualquer colaborador ATIVO à própria visão (`userId` viewer, `colegaId` dono, cor automática da paleta de 10 cores, `visivel` para ligar/desligar sem remover). Não é convite aprovado pelo dono — decisão explícita do usuário ("cultura de confiança interna").
- **Admin/CEO** (`isAdminRole` em `src/lib/google-calendar/colegas.ts`) enxerga **qualquer** colaborador mesmo sem estar na lista de compartilhamento, com **leitura + escrita completa** (`src/actions/google-calendar-admin.ts` — `criarEventoParaColega`/`atualizarEventoParaColega`/`cancelarEventoParaColega`). E-mail do colega-alvo é sempre resolvido do banco via `colegaId` (`resolverAlvoAdmin`), nunca aceito do cliente.
- Usuário comum só lê a agenda de colegas que adicionou (`listarEventosDeColega` em `src/actions/google-calendar-colegas.ts` — leitura ao vivo, sem cache/syncToken, teto de 10 páginas) e recebe somente blocos **“Ocupado”**, sem título, e-mail, Meet, ETag ou id real; Admin/CEO mantém detalhes e escrita.
- UI: `PainelColegas.tsx` (Sheet — adicionar/remover/cor/switch), botão `Users` no `HeaderCalendario`, eventos de colegas mesclados na grade com `colegaId` marcado em `EventoExibicao` (roteia `DetalhePopover`/`FormularioEvento` para as ações de Admin quando aplicável).
- Bibble ganhou tools reais neste módulo (`listar_eventos_calendario`, `criar_evento_calendario`, `cancelar_evento_calendario`, `consultar_disponibilidade_calendario`, `consultar_agenda_colega`) — catálogo completo em `bibble-flows.md`. `consultar_agenda_colega` só recebe nome/e-mail em texto livre do modelo, nunca um `colegaId`, tornando IDOR pelo parâmetro da tool estruturalmente impossível — a validação de compartilhamento/admin acontece 100% server-side dentro de `listarEventosDeColega`.

**Atualização 2026-07-17 (mesma sessão, rodada 2) — Gate de permissão para o compartilhamento entre colegas:**
- 5ª migration Vault: nova tabela `GoogleCalendarPermissaoColegas` (presença de linha = permitido; Admin/CEO sempre permitido sem precisar de linha). Antes disso, QUALQUER usuário ativo podia adicionar QUALQUER outro livremente — agora só quem o Admin liberou explicitamente pode usar a função (dos dois lados: quem adiciona e quem é adicionado).
- Helper único `temPermissaoCompartilhamento(userId, role)` em `src/actions/google-calendar-colegas.ts` — usado em `listarUsuariosParaCompartilhar`, `adicionarColegaVisivel` e `listarEventosDeColega` (checagem contínua: se o Admin revogar depois, o acesso para de funcionar mesmo com o registro de compartilhamento antigo ainda no banco).
- **Correção importante (mesmo dia, logo depois da 1ª entrega):** a permissão é **assimétrica** — só quem ADICIONA/CONSULTA (o viewer) precisa estar liberado. O colega-alvo NÃO precisa da permissão para ser adicionado. Motivo real do usuário: ele libera só líderes de setor, que precisam poder adicionar a agenda de colaboradores comuns (que nunca terão essa permissão). A 1ª versão exigia os dois lados liberados e isso quebrava esse caso de uso. Se mexer nesse fluxo de novo, não reintroduza a checagem do lado do `colega`.
- Novo painel Admin-only `PainelPermissoesColegas.tsx` (botão `ShieldCheck` no `HeaderCalendario.tsx`, visível só se `isAdmin`) com `listarPermissoesColegasTodosUsuarios`/`alternarPermissaoColegas` (ambas Admin-only, checadas via `isAdminRole` na Server Action, nunca só no cliente).
- Cores agora são personalizáveis (`personalizarCorCalendario`/`personalizarCorColega`, `input[type=color]`) — cuidado ao mexer em `definirCalendarioSelecionado`: o campo `corHex` foi deliberadamente removido do objeto `update` do upsert para não resetar a cor customizada a cada toggle de visibilidade/gravável.

**Atualização 2026-07-23 — integração Calendário Alpha ↔ Bibble/IAlpha:**

- [x] Registrar cada tool em `src/lib/bibble/tools.ts` e em `CALENDAR_TOOL_NAMES` de `src/lib/bibble/calendar-tools.ts`
- [x] Rotear tools por `src/lib/bibble/tool-executor.ts`, passando apenas `userId`, role e permissões vindos do servidor
- [x] Documentar capacidade e regras de esclarecimento/confirmação em `src/lib/bibble/system-prompt.ts`
- [x] Em `src/app/api/bibble/chat/route.ts`, recarregar usuário `ATIVO`, role e `getPermissoesEfetivas(userId)` do banco; injetar a hora atual de `America/Sao_Paulo`
- [x] Executar chamadas sequencialmente e manter limites de 6 tools/turno, 12/requisição e 3 mutações de calendário
- [x] Para edição, consultar antes, carregar `google_event_id` + `etag` e usar patch parcial com `If-Match`
- [x] Para cancelamento, exigir confirmação em duas fases antes de chamar a action
- [x] Manter resolução de calendário/colega em allowlists server-side; ambiguidades retornam candidatos
- [x] Não expor `userId`, `colegaId`, `calendarId` nem e-mail de impersonation nos schemas das tools

**As 10 tools integradas:** `listar_calendarios_calendario`, `listar_eventos_calendario`, `criar_evento_calendario`, `editar_evento_calendario`, `cancelar_evento_calendario`, `consultar_disponibilidade_calendario`, `consultar_agenda_colega`, `criar_evento_calendario_colega`, `editar_evento_calendario_colega` e `cancelar_evento_calendario_colega`.

**Como adicionar ou alterar uma tool de calendário:**
1. Definir o contrato público em `src/lib/bibble/tools.ts`.
2. Adicionar nome, schema Zod estrito e executor em `src/lib/bibble/calendar-tools.ts`.
3. Rotear pelo `tool-executor.ts` sem aceitar identificadores de ownership do modelo.
4. Atualizar o `system-prompt.ts` quando a capacidade ou regra conversacional mudar.
5. Cobrir happy path e edge cases em `tests/bibble/`; alterações do cliente Google/edição parcial também exigem testes em `tests/google-calendar/`.
6. Preservar janela máxima de 60 dias, teto de 200 eventos, timezone SP, execução sequencial, confirmação de cancelamento e ETag/`If-Match`.

**Exemplo seguro:** “Mostre minha agenda de 2026-07-24 a 2026-07-31” consulta por intervalo exato. “Cancele a reunião X” primeiro lista o evento e pede confirmação; somente a resposta afirmativa seguinte permite executar `cancelar_evento_calendario` com id, ETag e `confirmado: true`.

**Regras permanentes:** escrita de colega continua exclusiva de Admin/CEO atual do banco. Configuração do módulo (ativação, calendários visíveis/graváveis, cores e concessão de compartilhamento) continua na UI. Esta integração não altera schema; qualquer mudança futura de banco volta a exigir Vault, backup e confirmação.

**Dívidas não bloqueantes registradas pelo Anubis:** rate limit cross-request, idempotência persistente e token persistente/específico para confirmação. Não confundir os limites/deduplicação da requisição atual com garantias persistentes.

**Atualização 2026-07-30 — cache-first, sincronização explícita e UI Agenda Alpha:**

- [x] O rebranding é apenas visual: `MODULOS_REGISTRY` exibe **Agenda Alpha**, mas rota `/PainelAlpha/CalendarioAlpha`, id e permissão `calendarioAlpha` permanecem estáveis.
- [x] O SSR da rota usa somente cache local. `listarEventosCache` não chama Google; sincronização passa exclusivamente por `sincronizarAgendaAlpha`.
- [x] O contrato de sync retorna resultado por calendário (`sincronizado`, `cooldown`, `em_andamento`, `erro`), contadores, falhas sanitizadas e última sincronização. Dedupe/cooldown são apenas in-process; não tratá-los como lock distribuído.
- [x] Cache + `syncToken` são persistidos atomicamente só após todas as páginas. Em `410 Gone`, o full sync de recuperação é obtido antes de substituir o snapshot/cursor anterior.
- [x] `GoogleCalendarConexao.ultimaSincronizacaoEm` só avança após sucesso integral da conexão; falha parcial não produz marcador falso.
- [x] Antes de editar, o servidor recarrega detalhes completos com sessão, permissão e ownership. PATCH parcial usa `If-Match`/ETag; descrição, metadados de participantes e Google Meet são preservados quando ausentes do payload.
- [x] Invalidação entre abas/iframes usa `BroadcastChannel`, fallback `storage`/evento DOM e dedupe/agregação para evitar refresh em loop.
- [x] Sidebar, status e overlays usam `AgendaSidebar`, `StatusSincronizacao` e `AgendaModal3D`/`AgendaOverlays`; desktop tem profundidade 3D e mobile usa Sheet responsivo, preservando foco e reduced motion.
- [x] Privacidade DWD de colegas: usuário comum vê apenas disponibilidade “Ocupado”; Admin/CEO conserva detalhes e CRUD.

**Contrato operacional:** agendas compartilhadas continuam fora do cache SSR e são consultadas ao vivo somente após ação explícita. A Fase 2A concluiu fila, lease/fencing, push, webhook, worker, maintenance, CLIs, flags e observabilidade, todos mantidos flags-off. 183 testes Agenda Alpha, Forge build/lint/schema, Probe, Anubis, Lens e Sage passaram; typecheck conserva quatro baselines externos.

**Atualização 2026-07-31 — contrato responsivo do viewport:**

- [x] `CalendarioAlpha/layout.tsx` fornece a altura do viewport; `CalendarioAlphaDashboard.tsx` propaga `h-full`/`min-h-0` até o conteúdo.
- [x] `AgendaSidebar.tsx` mantém ações fixas e rolagem apenas nas listas, com Sheet e alvos de toque preservados no mobile.
- [x] `VisaoMes.tsx` preenche seis linhas flexíveis; `GradeHoraria.tsx` mantém cabeçalhos fixos e rolagem apenas na grade de horas.
- [x] `ConteudoAgenda.tsx` mantém a visão anual em scroll interno.

**Editado quando:** qualquer wrapper/layout da Agenda mudar altura, flex ou overflow; conferir a cadeia completa até cada visão para evitar corte de funções ou retorno da rolagem externa.

**Última atualização:** 2026-07-30 por Scribe

---

### Consulta RADAR (Habilitação Radar) — gate de permissão + botão "Excluir do banco"

**Adicionado em:** 2026-07-21 por Scribe (sessão Bibble)

**Rota:** `/PainelAlpha/HabilitacaoRadar` (sem mudança de URL). **Menu:** via `MODULOS_REGISTRY` (`id: 'radar'`, sem mudança). **Permissão necessária:** `radar` — **agora efetivamente checada**, o que não acontecia antes desta sessão.

**O que mudou no wiring:**
- `page.tsx` deixou de ser um Client Component monolítico e virou Server Component fino: `auth()` → se não-admin, `getPermissoesEfetivas(userId)` → redireciona para `/PainelAlpha` se `!perms.includes("radar")`. Renderiza `<HabilitacaoRadarClient />` (`src/components/ComponentesRadar/HabilitacaoRadarClient.tsx`, novo arquivo, todo o conteúdo antigo movido sem alteração de lógica).
- Botão novo "Excluir do banco" em `BotoesModal.tsx` chama `onDeletarDoBanco` (prop) → `handleDeletarDoBanco` (em `HabilitacaoRadarClient.tsx`) → Server Action `deletarRegistrosBanco` (`src/actions/RadarAction.ts`, já existia, ganhou `auth()`).

**⚠️ Checkpoint para novos módulos/auditorias:** antes desta sessão, `HabilitacaoRadar/page.tsx` era um dos módulos onde a URL era acessível a qualquer usuário logado, sem checar a permissão do módulo (`MODULOS_REGISTRY.permission`) — só o menu escondia o link, não a rota em si. Isso só foi pego porque o Anubis audita toda vez que uma feature nova mexe em algo destrutivo. **Ao tocar em qualquer módulo para adicionar uma capacidade nova (especialmente destrutiva), verificar se a `page.tsx` é um Server Component com o gate de permissão (`auth()` + `getPermissoesEfetivas()`) ou um Client Component monolítico sem esse gate** — o segundo caso é uma lacuna a corrigir, seguindo o padrão de `Apresentacoes/page.tsx`.

**Última atualização:** 2026-07-21 por Scribe

---

### Model novo relacionando com `documentos` ou `usuarios` — relação reversa nos dois lados

**Adicionado em:** 2026-07-22 por Scribe (feature: Confirmação de Leitura de Documento)

Prisma exige a relação declarada nos DOIS models quando há `@relation` — ao criar `ConfirmacaoLeituraDocumento` com FK pra `documentos` e `usuarios`, foi preciso adicionar `confirmacoes ConfirmacaoLeituraDocumento[]` dentro de `documentos` e `confirmacoesLeituraDocumento ConfirmacaoLeituraDocumento[]` dentro de `usuarios` — sem isso, `prisma generate` falha ou o client não expõe os tipos esperados. Ao criar qualquer model novo com FK para `usuarios`/`documentos`/outro model existente, sempre voltar e editar o model-alvo também.

**Também registrado:** mesmo para uma migration classificada 🟢 (CREATE TABLE puro, sem risco), se o usuário pedir explicitamente um backup fresco antes (em vez de aceitar o backup diário já dentro das 48h), gerar via script pontual Node (`@libsql/client`, mesma técnica dos backups diários — dump completo schema+dados por tabela dentro de uma transação de leitura) salvo em `database-backups/pre-change/`, e só then rodar a migration (script pontual separado, descartado depois, confirmado via `PRAGMA`).

---

### Alpha Blueprint — módulo novo (MVP completo)

**Adicionado em:** 2026-07-27 por Scribe (sessão Bibble, execução completa da fila `prompt-phases/`)

**Checklist de integração:**
- [x] Aparece no menu/sidebar — via `MODULOS_REGISTRY` (`id: 'blueprint'`, ícone `Compass` adicionado ao `ICON_MAP` de `GlobalSidebar.tsx`)
- [x] Permissão administrável pelo Admin — automática via `MODULOS_GERENCIAVEIS` (deriva do registry em `ModalGerenciarSetor.tsx`/`ModalOverrideUser.tsx`/`PreviewModulosSetor.tsx`, confirmado por leitura direta do código nesta sessão — sem edição manual adicional necessária)
- [x] Pode ser fixado como atalho — mecanismo de atalhos (`usuarios.atalhos`) referencia módulos pelo `id` do registry, qualifica automaticamente
- [x] Rota protegida por permissão de módulo — `AlphaBlueprint/page.tsx` chama `auth()` + `getPermissoesEfetivas()` e redireciona se `!perms.includes("blueprint")` (Admin/CEO bypassa), seguindo o padrão dos ~7 módulos que já fazem esse check explícito (ver checkpoint do RADAR acima)
- [x] Rota do projeto (`/PainelAlpha/AlphaBlueprint/[projectId]`) — ownership por projeto verificado via `ObterProjetoBlueprint` → `exigirAcessoBlueprint`, não apenas permissão de módulo

**Permissão por PROJETO é um conceito novo, além da permissão de módulo:** diferente de todo o resto do painel (que só tem permissão de módulo, tudo-ou-nada), o Blueprint tem uma segunda camada — `BlueprintMember` com 5 roles (Proprietário/Administrador/Editor/Comentarista/Visualizador) × 14 ações granulares (`src/lib/blueprint/ownership.ts`). Ter a permissão de módulo `blueprint` só dá acesso ao Dashboard/Kanban (ver quais projetos existem, criar novo); para abrir/editar um projeto específico é preciso ser membro dele (ou Admin/CEO global). Ao integrar qualquer feature nova que leia/escreva dados de um projeto do Blueprint, **sempre** usar `exigirAcessoBlueprint(projectId, userId, role, acao)` — nunca confiar só na permissão de módulo.

**Upload usa store de Vercel Blob dedicado**, não o `IACHAT_*` compartilhado do Bibble nem UploadThing (que está no `package.json` mas nunca foi configurado no projeto real). Env vars `BLUEPRINT_STORE_ID`/`BLUEPRINT_READ_WRITE_TOKEN` em `.env.local`. Se um módulo futuro precisar de um store de Blob próprio, seguir esse mesmo padrão (token dedicado identifica o store automaticamente no `put()`, sem precisar passar `storeId` — a versão instalada do SDK não aceita esse parâmetro).

**⚠️ Lição de IDOR para toda action que recebe `entityId` + `projectId` como parâmetros separados:** validar acesso ao `projectId` (via `exigirAcessoBlueprint`) NÃO é suficiente — é preciso também confirmar que a entidade (`fileId`/`documentId`/`boardId`/etc) de fato pertence a esse `projectId` antes de `update`/`delete`, senão um usuário com acesso legítimo a QUALQUER projeto pode alterar/apagar entidades de outros projetos. 6 ocorrências desse bug foram encontradas e corrigidas nesta sessão (Anubis) em `BlueprintFiles.ts`/`BlueprintDocuments.ts`/`BlueprintBoards.ts`. O padrão correto (já usado desde o início em `Requirements`/`Questions`/`Comments`/`Members`) é resolver o `projectId` a partir do PRÓPRIO registro buscado por `entityId`, nunca confiar no `projectId` do parâmetro para a mutação em si — só usá-lo para o gate de acesso.

**Editado quando:** Camada 2 (evolução avançada) começar, ou se outro módulo precisar do mesmo padrão de permissão granular por registro.

**Última atualização:** 2026-07-27 por Scribe

---

### Abas globais do Painel Alpha — reordenação e restauração local

**Adicionado em:** 2026-08-03 por Scribe

**Fluxo:** `PainelLayoutClient` recebe/abre módulos → `TabBar` reordena IDs via `@dnd-kit` → `PainelLayoutClient` aplica `arrayMove` → o estado normalizado é salvo em `localStorage` pela chave do usuário. No carregamento seguinte, `parseStoredTabsState` valida e restaura abas, ordem e aba ativa antes de permitir novas gravações.

**Invariantes de integração:**
- `IAlpha` (`/PainelAlpha`, ID `tab-home`) permanece fixa na posição zero.
- Somente URLs internas sob `/PainelAlpha` são restauradas.
- A persistência é isolada por `userId` e não usa banco.
- `MODULOS_REGISTRY` continua sendo a fonte de categoria e metadados visuais.
- A troca e o fechamento de abas continuam sob responsabilidade de `PainelLayoutClient`.

**Editado quando:** mudar o contrato de abertura via `ALPHA_OPEN_TAB`, trocar a identidade do usuário, migrar a persistência para servidor ou alterar a aba inicial fixa.

---

### Alpha Presentation Studio — Container Alpha animado (2026-08-03)

#### Evolução: introdução para o próximo slide

- `ContainerCargaRender` emite `ContainerIntroEvent`, mas não controla o índice da apresentação.
- `ModoApresentacaoClient` mantém o slide anterior e o próximo como camadas irmãs, bloqueando avanço concorrente enquanto a introdução estiver ativa. O índice lógico passa ao destino no primeiro frame do zoom, enquanto `slidePalco` preserva canvas, fundo e escala da origem até o `onComplete`.
- `SlideApresentacaoLayer` monta o próximo slide no começo do zoom e preserva sua `key` após a expansão, evitando reinício das animações. Quando a configuração pertence ao próprio `containerCarga`, o player não monta `TransicaoContainerAlphaLayer`: a instância real executa abertura e zoom uma única vez.
- Antes do zoom, `ContainerCargaCameraRig` projeta a abertura 3D em coordenadas locais; `ContainerCargaRender` remove o plano branco e renderiza o JSX do próximo slide atrás das portas. Essa projeção também é enviada em `ContainerIntroEvent.abertura` para alinhar o recorte de expansão.
- `ContainerCargaProps` centraliza no palco 1280×720 e configura zoom, áudio e dois presets Web Audio.
- `AnimacaoContainerAlphaProps` não instancia o player nem `TransicaoContainerAlphaLayer`: a prévia das propriedades monta somente `ContainerCargaRender` fechado em modo editor, sem slide, reprodução ou comandos de apresentação. Seu contrato é exclusivamente visual para editar acabamento.
- As propriedades continuam em `Slide.dadosJson`, com defaults Zod retrocompatíveis e sem migration.
- Sem slide seguinte, o container apenas abre; com reduced motion, a transição assume o estado final em duração mínima.
- Na camada sintética, o container usa margem igual a 5% da menor dimensão do palco, limitada entre 18 e 72 px. A conversão geométrica tipada reaplica essa margem ao componente e à abertura antes de calcular o `clip-path`.

- **Discriminador persistido:** `containerCarga` em `src/lib/validations/slide-componentes-3d.ts` e na union `ComponenteSlide`; continua dentro de `Slide.dadosJson`, sem migration.
- **Paleta:** `REGISTRY_3D` em `registry/registry-3d.ts`; aparece automaticamente na categoria 3D da sidebar, sem novo menu/atalho/permissão.
- **Render único:** `RenderComponente.tsx` encaminha o modo `editor`/`apresentacao` recursivamente. O editor informa `modo="editor"`; o modo apresentação usa o default `apresentacao`.
- **Edição:** `ContainerCargaProps.tsx` registrado em `PainelPropriedades.tsx`; x/y/w/h e handles continuam no contrato universal de `ComponenteNoCanvas`/`useCanvasDragResize`.
- **Responsividade:** o Canvas ocupa a caixa inteira e `ContainerCargaCameraRig` reenquadra pela bounding box quando o tamanho real muda. `ModoApresentacaoClient` agora escala uniformemente o slide canônico 1280×720 para caber no viewport inteiro.
- **Apresentação:** ao montar o slide, as travas se movem e as portas abrem. Voltar ao slide remonta a árvore por `slideId` e reinicia a sequência. Reduced motion aplica o estado aberto imediatamente.
- **Performance:** um WebGL context por instância, seguindo o padrão dos demais componentes 3D; frameloop pausado fora da viewport.
- **Asset:** `/public/A.PNG` já existia no Painel Alpha e é idêntico ao arquivo usado pelo site de origem; não houve cópia nem asset novo.

**Editado quando:** o contrato de propriedades, a sequência de abertura, o comportamento editor/apresentação ou a escala responsiva do palco mudar.

#### Player modal da apresentação — TROCADO para exibidor HTML (2026-08-06)

**Mudança de arquitetura:** o modal aberto pelo botão "Apresentar" no editor deixou de montar `ModoApresentacaoClient` (player React/Three.js ao vivo) e passou a ser `ModalVisualizadorHtml.tsx` (substitui `ModalReproducaoApresentacao.tsx`, removido) — busca o MESMO `.html` autocontido de `GET /api/apresentacoes/[id]/exportar-html` (a rota usada por "Exportar HTML") e renderiza num `<iframe srcDoc={html} sandbox="allow-scripts allow-same-origin">`. Motivo: eliminar 2 caminhos de renderização divergentes (o player ao vivo teve bugs próprios de timing/framing 3D — ver Container Alpha mais abaixo — difíceis de depurar sem browser); agora só existe 1 caminho pra acertar, e o que aparece na prévia é EXATAMENTE (WYSIWYG) o que o usuário baixa.

**⚠️ Reconciliação com a proibição histórica logo abaixo:** aquela proibição era especificamente sobre um iframe com `src="/apresentar?modal=1"` — apontando pra uma ROTA da própria aplicação Next.js, o que reexecutava layout raiz/auth/Prisma e podia vazar sidebar/abas da aplicação pra dentro do player. `ModalVisualizadorHtml.tsx` é estruturalmente diferente: usa `srcDoc` (não `src` apontando pra rota interna) com um documento HTML AUTOCONTIDO E ISOLADO — gerado por uma API route dedicada que faz 1 auth+ownership+query e devolve HTML estático com assets já embutidos como `data:` URI, sem layout raiz, sem sidebar, sem nova consulta ao Prisma dentro do iframe. Não reproduz nenhum dos 3 problemas documentados abaixo. Se "sidebar/shell vazando" voltar a aparecer, a causa é outra, não este mecanismo.

- `BarraSuperiorEditor` delega a abertura para `ApresentacaoEditor`, que desbloqueia o Web Audio e abre `ModalVisualizadorHtml` imediatamente no mesmo gesto do usuário.
- A prévia agora lê do BANCO (via a rota de export), não mais do Zustand em memória: `handleApresentar()` guarda a promise do salvamento do slide ativo (se `isDirty`) numa ref e passa como prop `aguardarAntesDeGerar` — o modal espera essa promise ANTES de buscar o HTML, pra não mostrar versão desatualizada.
- Estados do modal: `carregando` (spinner) / `erro` (mensagem + "Tentar de novo") / `pronto` (iframe). Gerar o export pode levar alguns segundos (baixa/embute todos os assets, igual ao download).
- **Trade-off aceito, não resolvido:** cada abertura do modal chama a rota de export de novo, sem cache — pode ficar perceptivelmente lento em apresentações com bastante imagem/vídeo. Melhoria futura possível: cachear o HTML gerado entre aberturas, invalidando no save.
- A rota `/PainelAlpha/Apresentacoes/[id]/apresentar` **não foi alterada** — continua standalone, autenticada, consultando o banco, reutilizando `ModoApresentacaoClient`. Todo o texto histórico abaixo (payload Zustand, `embutido=true`, propagação de pausa, `portalContainerCapa`, `modoCapa`, clamp de margem etc.) descreve `ModoApresentacaoClient`/`TransicaoContainerAlphaLayer` — **continua 100% válido pra rota standalone**, mas não descreve mais o modal do editor.

**Nota histórica preservada (proibição original — vale pra qualquer iframe-pra-rota-interna, não pra `srcDoc` de HTML autocontido, ver reconciliação acima):**

- O modal ANTERIOR (`ModalReproducaoApresentacao.tsx`, removido) montava `ModoApresentacaoClient` diretamente no Dialog. É proibido reintroduzir iframe apontando pra rota interna da aplicação (ex.: `/apresentar?modal=1`), `postMessage` de fechamento ou nova busca-de-rota-completa ao abrir: esses caminhos repetiam o shell, auth e Prisma e podiam exibir sidebar/abas dentro do player.
- O payload instantâneo vem do Zustand: todos os slides já carregados são fotografados, e o slide ativo é substituído pelos `componentes` e `canvas` atuais. `SlideResumo` também preserva `transicaoEntrada`, inclusive em criação, duplicação e carga inicial.
- O save do slide ativo ocorre em background com snapshot imutável e `versaoEdicao` monotônica. Toda mutação de conteúdo/canvas incrementa a versão; `concluirSalvamento(slideId, versao, sucesso)` só limpa `isDirty` para a versão atual. `serializarPersistenciaSlide()` mantém uma fila por `slideId`, executa escritas do mesmo slide na ordem de entrada, continua após rejeição e não bloqueia slides diferentes. A troca de slide aguarda essa fila antes de carregar o próximo, evitando corrida entre debounce, navegação e Server Action.
- A rota `/PainelAlpha/Apresentacoes/[id]/apresentar` permanece como player standalone autenticado e consulta o banco; ela reutiliza `ModoApresentacaoClient`, mas não é usada pelo modal.
- `ModoApresentacaoClient` usa `h-full w-full` no Dialog e `h-dvh w-dvw` na rota standalone. A transição Container Alpha vive dentro do palco do slide de origem para manter canvas, escala e recorte no mesmo sistema de coordenadas.
- O modal recebe `embutido=true` e nasce iniciado, sem gate ou espera adicional. A tela “Iniciar apresentação” existe somente na rota standalone, onde o clique libera Web Audio e solicita fullscreen; no modal, o gesto original do botão “Apresentar” já faz o desbloqueio.
- `obterAnimacaoContainerAlphaInicial()` considera somente a configuração do primeiro slide e não exige slide seguinte, porque o Container Alpha é uma capa anterior à apresentação. No modal, `ModoApresentacaoClient` inicializa a camada sintética antes do primeiro frame; no standalone, ela é preparada no gesto do gate. Origem e destino lógico são o índice 0: o zoom revela o slide 1 e não altera o contador. O comando reiniciar prepara novamente a abertura, enquanto o avanço posterior navega diretamente para o slide 2 sem repetir a capa. Em um `containerCarga` real com essa animação, `SlideApresentacaoLayer` desativa a transição interna concorrente para o slide seguinte.
- O estado de pausa percorre `SlideApresentacaoLayer` → `RenderComponente` → `ContainerCargaRender`; controles Framer Motion e o frameloop R3F pausam sem remontar o slide.
- A mesma cadeia propaga `portalContainerCapa`; o render 3D é promovido para o host integral do slide e escapa de qualquer ancestral que pudesse recortá-lo.
- `ContainerCargaRender` informa `modoCapa` ao Model/CameraRig: a geometria assume composição widescreen e a projeção do portal é recalculada sobre a escala final.
- Os controles continuam usando a mesma `navegarPara`, portanto range, reinício, anterior e próximo cancelam introduções concorrentes. Palco e controles são regiões flex irmãs: a barra possui faixa própria e nunca cobre o slide. Em telas estreitas o range ocupa uma segunda linha responsiva; todos os comandos têm `focus-visible`, atalhos ignoram alvos interativos e fullscreen é uma ação explícita do player.
- `TransicaoContainerAlphaLayer` usa `clamp(5% da menor dimensão, 18 px, 72 px)` para afastar a capa das bordas e converte `componente`/`abertura` para o canvas da origem. O destino aparece no início do zoom, mas o palco visual de origem permanece até o callback real, evitando salto de proporção e atraso de troca.
- `PainelLayoutClient` continua com um iframe persistente por aba e declara `allow="autoplay; fullscreen"`/`allowFullScreen`, permitindo áudio e fullscreen ao player nativo do módulo sem criar iframe adicional.

**Editado quando:** mudar o contrato do snapshot do editor, `versaoEdicao`/`concluirSalvamento`, a fila `serializarPersistenciaSlide`, o player compartilhado, o gate standalone, a margem/geometria da transição, os comandos responsivos/fullscreen ou as permissões do iframe global.

**Última atualização:** 2026-08-03 por Scribe

---

### Alpha Metas — Justificativa de Meta (feature nova dentro de módulo existente, 2026-08-04)

**Adicionado em:** 2026-08-04 por Scribe (sessão Bibble, pipeline serial completo).

**Descrição:** botão "Justificativa de Meta" no header do módulo `/PainelAlpha/Metas`, visível a TODOS os usuários com acesso ao módulo (sem condição de role no botão — diferente do padrão de "Configurar Metas" pré-existente, que só aparece para quem gerencia). Abre um modal com 2 abas: "Vigente" (seletor mês/ano + preview inline do PDF vigente via `<iframe>`; upload restrito a Admin/TI/CEO/Líder Comercial) e "Histórico" (lista imutável de todas as versões enviadas — clique abre o PDF daquele registro específico, mesmo que já tenha sido substituído como vigente).

**Checklist de integração:**
- [x] Não exigiu entrada nova em `MODULOS_REGISTRY` — vive dentro da rota `/PainelAlpha/Metas` já registrada (`permission: 'metas'`), reforçando a checagem de role só para a ação de upload.
- [x] Botão sempre visível no header (`MetasClient.tsx`), sem condição de role — confirmado por Probe.
- [x] Rotas de API (`upload`, `[id]`) exigem `auth()` + checagem de servidor real (`podeGerenciarMetas`/`getPermissoesEfetivas`), nunca confiam em UI escondida — confirmado por Probe e Anubis.
- [x] Migration aplicada e validada no Turso real (Vault, backup verificado, confirmação explícita do usuário).
- [x] 44 testes automatizados cobrindo autorização, validação de período, allowlist de domínio, magic bytes e imutabilidade do histórico (Sage).

**Arquivos envolvidos:**
- `prisma/schema.prisma` — `model JustificativaMeta` (novo) + relação reversa `justificativasMetaEnviadas` em `usuarios`.
- `src/lib/metas-permissoes.ts` (novo) — `podeGerenciarMetas(role)`, extraído de `Metas.ts` por erro real de build ("use server" só aceita export async — ver `known-errors.md`).
- `src/actions/Metas.ts` — editado, importa o helper em vez de defini-lo.
- `src/actions/JustificativaMeta.ts` (novo) — `ListarHistoricoJustificativas`, `BuscarJustificativaVigente(mes, ano)`, `RegistrarJustificativaMeta({mes, ano, url, nomeArquivo, tamanhoBytes})`.
- `src/app/api/metas/justificativas/upload/route.ts` (novo) — POST, magic bytes PDF, rate limit 5/min, Vercel Blob `access: "private"`, token `METAS_READ_WRITE_TOKEN`.
- `src/app/api/metas/justificativas/[id]/route.ts` (novo) — GET, serve PDF `Content-Disposition: inline`.
- `src/components/Metas/ModalJustificativaMeta.tsx` (novo, orquestrador) + `PreviewJustificativa.tsx` + `ListaHistoricoJustificativas.tsx` + `SeletorPeriodoJustificativa.tsx` (subcomponentes extraídos por Lens/Nova para respeitar o limite de 300 linhas por componente).
- `src/app/PainelAlpha/Metas/MetasClient.tsx` — editado (botão no header + estado + montagem do modal).
- `tests/metas/{metas-permissoes,justificativa-meta-action,upload-magic-bytes}.test.ts` (novos, 44 testes).

**Achado real de comportamento (não-bug, documentado via teste):** `podeGerenciarMetas(role)` compara `role === "Lider Comercial"` com igualdade EXATA (case/acento-sensível), enquanto a parte `isAdminRole(role)` da mesma função normaliza caixa/acentos/pontuação. Isso significa que `"lider comercial"` minúsculo ou `"Líder Comercial"` com acento retornam `false`, mas `"admin"`/`"ADMIN"`/`"T.I"` todos retornam `true`. Assimetria pré-existente herdada do código original de `Metas.ts` (não introduzida por esta feature) — relevante para qualquer código futuro que compare contra a role "Lider Comercial" byte-a-byte.

**Como adicionar um padrão semelhante no futuro (documento vigente por período + histórico completo):** replicar o modelo de dados — nunca usar `@@unique([periodo])` (forçaria overwrite físico); cada evento é sempre um `create()` novo; "vigente" é derivado via `findFirst({ where: {periodo}, orderBy: {createdAt: "desc"} })`. Nunca soft-delete nem update do registro antigo.

**Editado quando:** a feature ganhar mais tipos de arquivo, filtros adicionais no histórico, ou o padrão "vigente + histórico imutável" for replicado em outro módulo.

**Última atualização:** 2026-08-04 por Scribe

---

### Alpha Presentation Studio — Categoria "Backgrounds" (fundos animados de tela cheia)

**Adicionado em:** 2026-08-05 por Scribe (sessão Bibble)

**Descrição:** Nova categoria de componentes no Editor, extraindo e parametrizando 7 fundos animados que já existiam hardcoded em outros módulos do painel: Cosmos IAlpha (chat do Bibble — planetas/sol/estrelas com mecânica orbital kepleriana real), Radar Sonar (Consulta RADAR), Estelar CS & NPS / Estelar CheckList / Estelar Agenda Alpha (3 presets de UMA engine compartilhada — os módulos de origem já eram quase idênticos entre si), Blueprint Técnico (Alpha Blueprint) e Aurora dos Módulos (shader WebGL usado em Extratos/Parceiros). Todos totalmente editáveis: cor primária/secundária (swatch nativo `type="color"` + campo de texto lado a lado — usuário pode escolher vendo as cores OU digitar o hex), velocidade, densidade, direção (Radar) e toggles específicos (mostrarSol/quantidadePlanetas no Cosmos, mostrarGrade no Blueprint, mostrarRelogio no Estelar).

**Checklist de integração:**
- [x] Categoria "Backgrounds" aparece na sidebar do Editor (`CATEGORIAS_COMPONENTE`, sem lista manual separada)
- [x] 7 itens nomeados arrastáveis com ícone/label próprios
- [x] Fundo nasce cobrindo o canvas ativo (não um tamanho fixo) e sempre no zIndex mais baixo da lista (nunca tampa componentes existentes) — lógica em `ApresentacaoEditor.tsx` (`handleDragEnd`), não no registry
- [x] Painel de propriedades com campos condicionais por estilo + botão "Centralizar" (mesmo padrão de `ContainerCargaProps.tsx`)
- [x] Timeline não rotula todo background como o mesmo item — `tipo` sozinho ("fundoAnimado") não diferencia qual dos 7 foi arrastado, isso vive em `estilo`/`preset`
- [x] `tsc --noEmit`/lint escopado/`next build`/33 testes de `tests/apresentacoes/` — todos OK, zero regressão nos 2 callers existentes de `AnimatedShaderBackground` (Extratos/Parceiros)

**Arquivos criados:**
- `src/lib/validations/slide-componentes-fundos.ts` — schema `fundoAnimadoComponenteSchema` (1 tipo só, `estilo` como discriminador interno — mesmo idioma de `container.layout`, NÃO 7 tipos na união)
- `src/components/Apresentacoes/Editor/registry/registry-fundos.ts` — `REGISTRY_FUNDOS` (7 entradas) + `registryFundoParaEstilo(estilo, preset)` (resolve label/ícone de uma INSTÂNCIA já no slide, usado pela Timeline)
- `src/components/Apresentacoes/Editor/RenderEngine/{CosmosIAlphaFundo,RadarFundo,EstelarFundo,BlueprintFundo}.tsx` — 1 engine por estilo, `EstelarFundo.tsx` compartilhada pelos 3 presets
- `src/components/Apresentacoes/Editor/RenderEngine/fundos-utils.ts` — `hexParaRgb()` (o contrato público do componente é hex, igual aos demais tipos do editor; as engines internas usam `rgba(r,g,b,x)`, convenção herdada dos módulos de origem)
- `src/components/Apresentacoes/Editor/RenderEngine/render/RenderFundos.tsx` — dispatcher por `estilo`
- `src/components/Apresentacoes/Editor/PainelDireito/camposPorTipo/FundoAnimadoProps.tsx` — painel de propriedades + `ColorField` (swatch + texto) + botão Centralizar

**Arquivos editados:**
- `src/lib/validations/slide-componentes.ts` — novo tipo na união discriminada
- `src/components/Apresentacoes/Editor/registry/componentes-registry.ts` — `TipoComponente` agora é `Exclude<ComponenteSlide["tipo"], "fundoAnimado"> | keyof typeof REGISTRY_FUNDOS` (o tipo "fundoAnimado" sozinho não é uma chave válida do registry — só existe através das 7 chaves nomeadas)
- `src/components/Apresentacoes/Editor/RenderEngine/RenderComponente.tsx` — `case "fundoAnimado"`
- `src/components/Apresentacoes/Editor/PainelDireito/PainelPropriedades.tsx` — wire do `FundoAnimadoProps`
- `src/components/Apresentacoes/Editor/Timeline/TimelineReal.tsx` — troca `COMPONENTES_REGISTRY[c.tipo]` por `resolverEntradaRegistry(c)` (resolve via `registryFundoParaEstilo` quando `tipo === "fundoAnimado"`)
- `src/components/Apresentacoes/Editor/ApresentacaoEditor.tsx` — `handleDragEnd` força `x:0,y:0,w:canvas.width,h:canvas.height` e `zIndex` mínimo da lista quando o tipo criado é `fundoAnimado`
- `src/components/Apresentacoes/Editor/Canvas/CanvasArea.tsx` — auto-ajuste de zoom (ResizeObserver, one-shot) para o slide caber inteiro e ficar centralizado ao montar o editor ou trocar o formato do canvas; nunca sobrescreve zoom manual do usuário depois
- `src/components/ui/animated-shader-background.tsx` — ganhou `corPrimaria`/`corSecundaria`/`velocidade` (opcionais, defaults reproduzem a paleta original); refatorado para o padrão "latest ref" (valores sincronizados via `useEffect`, lidos dentro de `animate()` a cada frame) — corrigiu de quebra também um `react-hooks/refs` pré-existente (`pausadoRef.current = pausado` direto no corpo do render, já presente antes desta sessão)

**Decisão de arquitetura chave:** os 3 presets "estelar" (CS&NPS/CheckList/Agenda Alpha) são UMA engine só (`EstelarFundo.tsx`) — decisão do usuário para não triplicar ~150 linhas quase idênticas. CheckList ganhou paleta própria (esmeralda `#10b981`/indigo `#6366f1`, velocidade 0.8, densidade 1.3) após o usuário notar que CS&NPS e CheckList pareciam "iguais demais" — evitar repetir esse quase-clone se um 4º preset estelar for adicionado no futuro.

**Editado quando:** novo estilo de fundo for pedido, ou os presets "estelar" precisarem de mais variação visual.

**Última atualização:** 2026-08-05 por Scribe

---

### Alpha Presentation Studio — Container Alpha: tamanho padrão, prévia ampliada e zoom sobreposto à abertura

**Adicionado em:** 2026-08-05 por Scribe (sessão Bibble, mesma sessão da categoria Backgrounds)

**Descrição:** 3 melhorias no Container Alpha (componente `containerCarga`, usado tanto como componente de slide quanto como animação de entrada "container-alpha" configurável em `AnimacaoContainerAlphaProps.tsx`):
1. **Tamanho padrão de slide** — nascia em 640×360 (metade do slide); agora nasce cobrindo o canvas ativo (`registry-3d.ts` usa `CANVAS_PADRAO` como default estático, `ApresentacaoEditor.tsx#handleDragEnd` ajusta pro tamanho real do canvas ativo ao soltar — mesmo padrão já usado para `fundoAnimado`, mas SEM forçar zIndex mínimo: o Container Alpha é uma capa que fica por cima, revelando o próximo slide pela porta, o oposto do Background).
2. **Prévia ampliada** — a caixinha de prévia dentro do painel de propriedades (`AnimacaoContainerAlphaProps.tsx`) é presa à largura estreita da lateral. Novo botão "Ampliar" abre `ModalPreviaContainerAlpha.tsx` (`Dialog` do shadcn, mesma classe de tamanho responsivo 16:9 já usada em `ModalReproducaoApresentacao.tsx`: `w-[min(96vw,1440px,163.555dvh)]`), mostrando o mesmo `componentePreview` em tamanho de slide de verdade.
3. **Zoom sobreposto à abertura da porta** — em `ContainerCargaRender.tsx`, o zoom para dentro (câmera dollying via `ContainerCargaCameraRig.tsx`) esperava a porta terminar de abrir 100% antes de começar. Agora começa aos 55% da duração da abertura (`FRACAO_ABERTURA_PARA_INICIAR_ZOOM`), sobrepondo os dois movimentos ("entrar andando" pela porta). 55% é seguro geometricamente: as portas são articuladas na borda EXTERNA (`ContainerCargaModel.tsx` — `Door_Left_Pivot`/`Door_Right_Pivot` nos hinges `±openingW/2`) e nesse ponto do giro já varreram para fora do corredor central por onde a câmera avança — não há clipping da câmera contra a geometria da porta.

**Arquivos criados:**
- `src/components/Apresentacoes/Editor/PainelDireito/camposPorTipo/ModalPreviaContainerAlpha.tsx`

**Arquivos editados:**
- `src/components/Apresentacoes/Editor/registry/registry-3d.ts` — default `w/h` de `containerCarga` para `CANVAS_PADRAO`
- `src/components/Apresentacoes/Editor/ApresentacaoEditor.tsx` — `handleDragEnd` ajusta `containerCarga` pro canvas real ao soltar (sem mexer no zIndex)
- `src/components/Apresentacoes/Editor/PainelDireito/camposPorTipo/AnimacaoContainerAlphaProps.tsx` — botão "Ampliar" + wire do modal
- `src/components/Apresentacoes/Editor/RenderEngine/ContainerCargaRender.tsx` — delay do zoom recalculado (`inicioAbertura + duracaoAbertura * 0.55` em vez de esperar a abertura completa)
- `tests/apresentacoes/container-alpha.test.ts` — assert do default atualizado para `CANVAS_PADRAO.width/height` (era `640×360` hardcoded)

**Como este componente já funciona em produção (não confundir com o Background):** `containerCarga` tem DOIS usos — (a) como componente comum dentro de um slide (transiciona pro PRÓXIMO slide ao abrir, via `ComponenteNoSlide` em `SlideApresentacaoLayer.tsx`, que já força quase-tela-cheia com margem própria independente do `w`/`h` salvo) e (b) como "animação de entrada" tipo `container-alpha` configurada em QUALQUER componente do slide 1 (`animacao.entrada.tipo === "container-alpha"`, lido por `obterAnimacaoContainerAlphaInicial` em `ModoApresentacaoClient.tsx`) — nesse caso funciona como CAPA da apresentação inteira, antes do slide 1, via `TransicaoContainerAlphaLayer.tsx` (que também já força tamanho baseado no canvas, independente do componente salvo). As mudanças desta sessão não alteram esses 2 fluxos de apresentação (já forçavam tamanho correto) — só o comportamento ao EDITAR (canvas do editor e a prévia da animação).

**Editado quando:** a fração de sobreposição do zoom (55%) precisar de ajuste fino após teste visual real, ou um 3º uso do Container Alpha for adicionado.

**Última atualização:** 2026-08-05 por Scribe

---

### Alpha Presentation Studio — Exportação HTML autocontida (novo, `Exportar HTML`)

**Adicionado em:** 2026-08-06 por Scribe (sessão Bibble, planejada em Plan Mode, executada em 10 fases)

**Descrição:** Botão "Exportar HTML" na `BarraSuperiorEditor.tsx` baixa a apresentação inteira como **1 arquivo `.html` único, 100% autocontido** (abre offline via `file://`, sem depender do PainelAlpha nem de internet) — reproduzindo a apresentação com fidelidade real: mesmo motor de render (`RenderComponente.tsx` e toda a árvore `RenderEngine`), Container Alpha 3D de verdade (não um fallback), transições configuradas por slide. Navegação: 1 clique ou 1 tick de scroll avança exatamente 1 slide. Se o slide 1 tiver a animação de entrada "Container Alpha", ele aparece **fechado e parado** ao carregar, e o primeiro gesto do usuário dispara a abertura automaticamente.

**Arquitetura (não é vídeo nem screenshot — é o app de verdade bundlado à parte):**
- **Bundler:** `esbuild` (novo devDependency explícito, já existia como transitivo), formato **IIFE** (não ESM — evita restrição de CORS/módulos ao abrir via `file://`). Bundle gerado em **build-time** (`npm run build:player`, encadeado antes de `next build` no script `build`), nunca por requisição — ler um módulo TS gerado (`src/generated/apresentacoes-player-bundle.ts`, gitignored) é muito mais rápido/previsível do que rodar esbuild dentro de uma function serverless a cada clique.
- **Isolamento do player:** novo diretório `src/apresentacoes-player/` (`entry.tsx`, `PlayerStandalone.tsx`, `dados-tipos.ts`, `player.css`) — reaproveita `RenderComponente.tsx` e toda `RenderEngine`/`ModoApresentacao` DIRETO (sem duplicar), confirmado por leitura de código que nenhum desses arquivos importa `next/*` nem tem `"use server"` (só `ModoApresentacaoClient.tsx` tinha `useRouter`, por isso NÃO é reaproveitado — `PlayerStandalone.tsx` é uma shell nova, mais simples, com navegação por clique/scroll em vez de botões). `scripts/build-apresentacoes-player.mjs` tem um **guard automatizado**: varre o `metafile` do esbuild e FALHA o build se algo de `next/` ou `"use server"` vazar pro bundle — checagem real a cada build, não promessa.
- **CSS:** `player.css` usa `@import "tailwindcss" source(none)` + `@source` explícito só pra `RenderEngine`/`ModoApresentacao`/o próprio player (Tailwind v4 varre o repo INTEIRO por padrão se não desligar isso) — caiu de 486KB pra 50.2KB. `@import "@xyflow/react/dist/style.css"` resolve nativamente (mesmo mecanismo que já importa `tw-animate-css`/`shadcn/tailwind.css` em `globals.css`).
- **Assets do usuário** (imagem/vídeo/áudio/textura de globo/`.glb`): `src/lib/apresentacoes/percorrer-componentes.ts` (walker recursivo puro, entra em filhos de card/grid/container) + `src/lib/apresentacoes/embutir-assets.ts` (`embutirAssetsNosSlides` — pré-checagem de orçamento de bytes usando `ApresentacaoAsset.tamanhoBytes` ANTES de baixar qualquer coisa, orçamento combinado 25MB via `ORCAMENTO_MAX_ASSETS_BYTES`, fail-fast em qualquer falha de download em vez de gerar HTML com asset quebrado). Todos viram `data:` URI base64 na Route Handler.
- **Logo `/A.PNG` do Container Alpha:** extraído pra `container-carga-assets.ts` (`LOGO_A_URL`, `ContainerCargaModel.tsx` importa em vez do literal). No bundle do player, um alias do esbuild troca esse módulo por `container-carga-assets.player.ts` (usa `__LOGO_A_DATA_URI__`, substituído em build-time via `define` do esbuild lendo `public/A.PNG`) — zero custo de rede em runtime, e o script verifica que o `data:image/png;base64,` realmente aparece no bundle gerado (falha alto se o alias não pegar).
- **Container Alpha fechado até o 1º gesto:** `ContainerCargaRender.tsx` ganhou prop `deverIniciar?: boolean` (default `true` — zero mudança pra Editor/Modo Apresentação, nenhum call site existente passa isso) que, quando `false`, não registra nenhum `animate()` no `useEffect` principal (fica estático fechado). `TransicaoContainerAlphaLayer.tsx` repassa o mesmo prop. `PlayerStandalone.tsx` orquestra: `estadoCapa: "fechada"|"abrindo"|"concluida"`, detecta a config via `obterAnimacaoContainerAlphaInicial` (já existia), e só entra no deck normal de slides depois do `onComplete` da transição.
- **Rota:** `GET /api/apresentacoes/[id]/exportar-html` (`src/app/api/apresentacoes/[id]/exportar-html/route.ts`) — auth + `checarOwnershipApresentacao` (extraída pra `src/lib/apresentacoes/ownership.ts`, canônica; as 4 cópias locais pré-existentes não foram tocadas) + query nova (tema com `corPrimaria/Secundaria/Accent`, slides, assets) + escape de `<` no JSON injetado (`<`, evita quebra de `</script>` via título/texto de usuário) + escape de `<title>` (`&`/`<`/`>`) + `Content-Disposition: attachment`.

**Arquivos novos:** `src/apresentacoes-player/{entry.tsx,PlayerStandalone.tsx,dados-tipos.ts,player.css}`, `scripts/build-apresentacoes-player.mjs`, `src/generated/apresentacoes-player-bundle.ts` (gerado, gitignored), `src/app/api/apresentacoes/[id]/exportar-html/route.ts`, `src/lib/apresentacoes/{ownership.ts,container-carga-assets.ts,container-carga-assets.player.ts,percorrer-componentes.ts,embutir-assets.ts}`, `tests/apresentacoes/embutir-assets.test.ts` (12 testes).

**Arquivos editados:** `ContainerCargaModel.tsx` (import `LOGO_A_URL`), `ContainerCargaRender.tsx` (prop `deverIniciar`), `TransicaoContainerAlphaLayer.tsx` (repassa `deverIniciar`), `BarraSuperiorEditor.tsx` (botão "Exportar HTML"), `exportacao.ts` (`exportarApresentacaoComoHtml` + `nomeDownloadSeguro` exportado), `package.json` (devDeps `esbuild`/`postcss` + script `build:player`), `.gitignore`.

**Pendências conscientes (fora do escopo desta v1, decisão do usuário):** Container Alpha só como CAPA do slide 1 — se usado como transição NO MEIO do deck, a exportação ainda não replica esse caso (renderiza como transição de slide comum). Sem teste em browser real nesta sessão (sem Playwright disponível) — todo o pipeline foi validado via `tsc`/lint/build/testes automatizados + guards estáticos, mas **abrir o `.html` de verdade via `file://` e clicar/rolar continua sendo validação manual pendente do usuário**.

**Última atualização:** 2026-08-06 por Scribe

---

### Container Alpha — textura das portas redesenhada (padrão fiel a referência fotográfica real)

**Adicionado em:** 2026-08-06 por Scribe (mesma sessão, após o usuário anexar uma foto de referência de container real "ALPHA COMEX")

**Descrição:** `ContainerCargaModel.tsx` — `makeDoorTexture`/`drawCorrugation` reescritos para bater muito mais de perto com uma referência fotográfica de container real que o usuário anexou, mantendo 100% procedural (sem imagem externa, continua totalmente recolorável via `corPrincipal`/`corMetal`/`corInterior`):
- **Resolução da textura dobrada** (512×1024 → 1024×2048) — texto e corrugação mais nítidos.
- **Corrugação com desgaste real:** sujeira acumulada perto do chão/topo, escorridos de ferrugem (10, verticais, finos, perto de rebites), riscos de desgaste (scuffs claros) — tudo com **seed fixa** (`4271`/`8837`, uma por lado, via `criarGeradorSeed` de `fundos-utils.ts`), não `Math.random()` — mesmo cuidado já aplicado aos fundos animados (Container Alpha pode renderizar em 2 instâncias simultâneas — prévia no portal + slide real por baixo — e precisa do MESMO desgaste nas duas, senão "pula" visualmente).
- **Tabela de peso com unidade dupla** (métrico + imperial, ex. "30.480 KG" / "67.200 LB" empilhados) — antes só tinha KG.
- **4 barras de trava por porta** (era 3) — `POSICOES_BARRAS`, distribuídas por toda a largura da porta, com 5 braçadeiras cada (era 3).
- **Castings de canto** (4 aberturas escuras nos cantos do frame, padrão ISO) — componente novo `CornerCasting`, renderizado dentro de `Container_Frame`.
- Textos/strings (ALPHA COMEX, ACXU 2025 01/22G1, GLOBAL TRADE SOLUTIONS, COMPLIANCE/INTELIGÊNCIA/RESULTADOS) já batiam 1:1 com a referência — não mudaram, só reposicionados pra nova resolução.

**Limitação reconhecida:** fidelidade fotorrealista total (iluminação HDRI, reflexos de ambiente) tem teto real num Three.js procedural sem texturas de imagem prontas — e nenhuma mudança desta sessão foi confirmada visualmente (sem browser disponível). Pendente de validação manual do usuário; provável necessidade de mais 1-2 rodadas de ajuste fino depois que ele olhar o resultado renderizado de verdade.

**Editado quando:** o usuário testar visualmente e pedir ajustes (cores/intensidade do desgaste, posição de texto, etc).

**Última atualização:** 2026-08-06 por Scribe

---

#### Sidebar de slides — nome editável + renumeração automática

- `Slide.nome` (`String?`) fica `null` por padrão desde `CriarSlide` (não grava mais `"Slide N"` literal) — o rótulo exibido é SEMPRE `nome || \`Slide ${ordem+1}\`` (`ItemSlide` em `SidebarSlides.tsx`), então continua correto sozinho depois de excluir/reordenar. Só vira texto fixo persistido quando o usuário clica no ícone de lápis e renomeia.
- `ExcluirSlide` (actions/slides.ts) roda em `$transaction`: exclui E renumera `ordem` de todos os restantes (sequencial, sem buracos). `SidebarSlides.tsx#handleExcluir` espelha a mesma renumeração no estado local, sem esperar refetch.
- **Checklist se for mexer em `Slide.ordem`/`Slide.nome` de novo:** qualquer novo fluxo que crie/exclua/reordene slides precisa manter `ordem` denso e sequencial (0,1,2...) — é do que depende o rótulo automático. `ReordenarSlides` (já existente) é o padrão de referência pra "recebe lista de IDs na ordem certa, grava ordem=index".

#### Importação de PPTX — arquitetura vigente de alta fidelidade

**Atualizado em:** 2026-08-11 por Scribe

- **Fluxo:** `ModalPreImportarPptx.tsx` envia o binário diretamente ao Vercel Blob por upload multipart no store `MOTION` (`MOTION_READ_WRITE_TOKEN`). As rotas `pptx-preview` e `importar-pptx` recebem apenas a referência JSON validada; a prévia usa URLs Blob temporárias e as remove ao cancelar/confirmar. O `.pptx` original é preservado como asset para reimportação e as imagens são deduplicadas por SHA-256.
- **Modelo intermediário obrigatório:** `modelo-intermediario.ts` representa `Slide -> Element tree -> Transform/Style/Text/Asset`, mantendo árvore de grupos, coordenadas EMU, matrizes local/world, origem slide/layout/master, z-order e nós de fallback. A conversão para `ComponenteSlide` ocorre somente depois, em `mapear.ts`.
- **Resolução OOXML:** `parser.ts` percorre a ordem real do XML e resolve a cadeia slide → layout → master → theme. `heranca.ts` resolve placeholders/propriedades herdadas; `color-resolver.ts` resolve cores RGB/theme/system e modificadores; `matriz-transformacao.ts` compõe grupos, rotação e flips; `texto.ts` mantém parágrafos/runs, quebras intercaladas, margens, bullets, tabs, autofit e fontes; `geometria.ts` cobre preset/custom geometry, recortes SVG e `custGeom` com gradiente linear preservando stops, cores e alpha.
- **Fidelidade propagada ao render compartilhado:** background branco implícito e fundos sólidos/gradientes, rich text, font family/fallback, crop exato (`srcRect`), stretch/tile, flip, opacidade, linhas/setas, bordas e sombras são usados no Editor, prévia, modo apresentação e player exportado. `CanvasArea.tsx` oferece "Debug PPTX" com bounding boxes, IDs, z-index, dimensões e fallbacks.
- **Renderer de referência:** `reference-renderer.ts` + `scripts/render-pptx-reference.ps1` usam PowerPoint COM no Windows, com automação/macros desativadas, para gerar PNGs independentes. `visual-diff.ts` calcula similaridade e imagem de diferença no browser. Em ambiente sem PowerPoint o fluxo continua com aviso, sem fingir que a referência existe.
- **Segurança e isolamento:** `seguranca.ts` limita quantidade/tamanho/razão de compressão e bloqueia paths inseguros; relacionamentos externos não são buscados. Falha em um elemento gera diagnóstico/fallback localizado e não derruba o slide.
- **Fontes:** antes da checagem, o browser solicita explicitamente cada família com `document.fonts.load` e então aguarda `document.fonts.ready`; isso evita marcar como ausentes fontes empacotadas que ainda não haviam sido usadas no DOM. A prévia separa disponíveis, substituídas e ausentes. Mapeamentos conhecidos incluem SF Pro Display → Inter e variantes Open Sans → Open Sans; o renderer usa uma pilha CSS estável como último recurso.
- **Catálogo global de fontes:** uploads manuais usam `POST /api/apresentacoes/fontes` e o prefixo `apresentacoes/fontes-globais/` no Vercel Blob. Não há model/migration. `listarFontesGlobais()` alimenta editor, apresentação autenticada, link público e exportação; antes de incorporar no HTML, `filtrarFontesUsadas()` percorre também filhos de containers e runs ricos.
- **Cobertura atual:** imagens raster/SVG, shapes, custom geometry, grupos aninhados, texto rico, tabelas básicas, conectores/linhas, backgrounds e principais efeitos. Charts, SmartArt, OLE, EMF/WMF e alguns fills/efeitos OOXML incomuns continuam como fallback diagnosticado até existir conversão nativa.
- **Fontes incorporadas:** `fontes-embutidas.ts` lê `p:embeddedFontLst`, remove o invólucro EOT de `.fntdata` e recupera o SFNT TTF/OTF original. A prévia cria `@font-face` temporário; ao confirmar, `garantirFontesEmbutidasGlobais()` publica/deduplica a família no store `MOTION` e o contexto do editor é atualizado sem reload.
- **Contornos e gradientes:** `lerLinhaOoxml()` preserva `a:ln/a:gradFill`. Fallbacks SVG de `custGeom` convertem a espessura EMU para pixels finais e ampliam viewBox/componente pela metade do traço, evitando recorte. `mapearSlideExtraido()` preserva `gradientCss` em cards editáveis.
- **Validação desta revisão:** 47/47 testes direcionados passaram. O arquivo real `Plano de Marketing.pptx` importou 21/21 slides, com 0 elementos ignorados; cinco fontes incorporadas foram extraídas (SF Pro Display Heavy, SF Pro Display, Montserrat, Aileron Bold e Open Sans), e os anéis com contorno sólido/gradiente foram gerados como SVG com escala correta. O mesmo binário de 7.084.495 bytes passou pelo upload multipart real no store `MOTION`, foi conferido por `head` com tamanho idêntico e removido depois do smoke.
- **Checklist ao alterar:** preserve o modelo intermediário e a ordem OOXML, mantenha parser/render desacoplados, adicione fixture sintético por regressão, rode os dois testes PPTX e valide Original/Importado/Diferença com um deck real antes de declarar alta fidelidade.

**Editado quando:** surgir um novo caso OOXML, mudar o renderer compartilhado ou for executado o aceite visual do deck real.

---

#### Importação de PPTX — histórico anterior (superado pela arquitetura acima)

> Registro preservado para contexto histórico. As limitações e resultados abaixo descrevem a implementação anterior e não representam o estado atual nem comprovam o aceite visual desta revisão.

- **Fluxo em 2 fases (revisado 2026-08-07 — antes era upload direto sem prévia):** botão "Upload" na sidebar de slides → seleciona arquivo → `ModalPreImportarPptx.tsx` abre e chama `POST /api/apresentacoes/[id]/pptx-preview` (parser roda, mas NADA é gravado — imagens viram `data:` URI inline, sem Blob/DB) → modal renderiza cada slide de verdade via `RenderComponente` (reaproveitado isolado, confirmado que não depende do Zustand do editor) num palco escalado, com botão de remover por slide → "Confirmar importação" reenvia o MESMO arquivo (`File` mantido em memória no client) + índices excluídos pra `POST /api/apresentacoes/[id]/importar-pptx` (agora com upload real pro Blob + criação de `Slide`, sempre APÊNDICE depois do último slide existente) → sidebar recarrega via `ListarSlides`. "Cancelar" não deixa nenhum resíduo (nada foi gravado na fase de prévia).
- **Paralelização:** a rota de commit processava imagens SEQUENCIALMENTE — decks com várias imagens passavam do `maxDuration=60` da Vercel (function matada no meio, parecia "trava" pro usuário). Agora usa `Promise.all` sobre os slides pro mapeamento+upload; gravação no banco continua sequencial (ordem determinística).
- **Dependência nova:** `fast-xml-parser` (parsing dos XML internos do `.pptx` — `jszip`, usado pro unzip, já existia no projeto).
- **Arquitetura (revisada 2026-08-07 — correção profunda de interpretação OOXML após teste com arquivo real de 18 slides):** `xml-utils.ts` (parser XML + `resolverBlipPreferido` compartilhado, que prefere `<asvg:svgBlip>` sobre o raster quando presente) → `ordem-xml.ts` (NOVO: scanner de texto XML CRU que reconstrói a ordem REAL de irmãos intercalados — `<p:sp>`/`<p:pic>`/`<p:grpSp>`/`<p:graphicFrame>`/`<p:cxnSp>` — que o `fast-xml-parser` agrupa por tag e embaralha entre tipos diferentes; `ConsumidorPorTipo` "zipa" os arrays já parseados de volta na ordem certa; `xmlDoNo` fatia o XML cru de 1 shape específico) → `geometria.ts` (NOVO: scanner sequencial de comandos dentro de `<a:custGeom><a:pathLst><a:path>` — moveTo/lnTo/cubicBezTo/quadBezTo/arcTo/close — convertido pra `d` de SVG; detecta retângulo disfarçado de `custGeom` vs path real; gera SVG com `clipPath` quando é imagem recortada, ou SVG com o path colorido quando é `solidFill` sem card nativo) → `tema.ts` (resolve cadeia slide→layout→master→tema) → `parser.ts` (percorre `<p:spTree>` na ORDEM REAL via `ordem-xml.ts`; reconhece `<a:blipFill>` DENTRO de `<p:sp>` como imagem, não só `<p:pic>`; detecta fontes usadas via `<a:latin typeface>`; motivo específico por elemento não aproveitado, nunca mensagem genérica; diagnóstico estruturado por elemento logado via `console.info` por slide) → `mapear.ts` (`FormaExtraida[]` → `ComponenteSlide[]`, `objectFit:"cover"` — o comportamento real de fill de imagem-em-forma do PowerPoint, não `"contain"`).
- **Causa raiz real descoberta (2026-08-07, arquivo de teste de 18 slides do usuário):** o `.pptx` real NUNCA usa `<p:pic>` — toda imagem é `<p:sp>` com `<a:blipFill>` (várias com `<asvg:svgBlip>` alternativo), e a maioria das formas usa `<a:custGeom>` em vez de `<a:prstGeom>` (inclusive retângulos simples — a ferramenta de design usada pelo usuário exporta assim). O parser antigo só reconhecia `<p:pic>` e `prstGeom rect/roundRect/ellipse`, por isso imagens/slides inteiros (ex.: slide 10) ficavam vazios e formas com `custGeom` eram descartadas com uma mensagem genérica. Confirmado e corrigido; ver "Validado com arquivo real" abaixo.
- **Escopo atualizado:** extrai texto (cor/negrito/tamanho/alinhamento — 1 estilo por caixa inteira, não por trecho; fontes usadas detectadas via `<a:latin typeface>` e reportadas em `fontesNaoAplicadas`, mas NÃO aplicadas — schema de `texto` não tem campo `fontFamily`), imagens via `<p:pic>` OU `<a:blipFill>` em `<p:sp>` (incl. FUNDO de slide/layout/master, com recorte real via `custGeom` → SVG com `clipPath`), tabelas (1ª linha=colunas), formas com preenchimento sólido/cor de tema/`custGeom` (retangular→`rect` nativo, curvo→SVG colorido de último recurso), rotação, `flipH`/`flipV` (detectado e reportado no campo `geometria` do diagnóstico, mas não aplicado — nem `imagem` nem `caixa` têm campo de flip no schema), grupos aninhados com transform correto, ORDEM REAL do documento entre tipos intercalados (z-index correto). NÃO extrai/aplica: gráficos, SmartArt, objetos OLE, `gradFill`/`pattFill` em forma, `srcRect` (crop em pixel — usa `objectFit:"cover"` como aproximação, não corta o byte da imagem), conectores/linhas (`p:cxnSp` — contados em `ignorados`, mas sem componente de linha/seta pra desenhar), rich text por TRECHO, fonte aplicada de verdade, EMF/WMF, `arcTo` (convertido analiticamente pra arco SVG, mas sem exemplo real testado — não apareceu no arquivo de regressão). Cada caso vira um motivo ESPECÍFICO em `ignorados` (nunca uma mensagem genérica única) e 1 entrada em `diagnostico` (`slide`, `shapeId`, `nome`, `tipoOoxml`, `fillEncontrado`, `relationshipId`, `assetResolvido`, `grupoPai`, `geometria`, `motivoFallback`).
- **Escala:** lê `<p:sldSz>` real do PPTX (EMU) e calcula fator uniforme (sem distorcer) pro canvas de destino (o do último slide já existente na apresentação), centralizando quando a proporção não bate.
- **Checklist se for mexer no parser:** cada tipo de forma é isolado em try/catch dentro de `processarArvoreFormas` — manter esse padrão ao adicionar suporte a novos tipos (chart, SmartArt etc.), nunca deixar 1 forma derrubar o slide inteiro. `tema.ts#resolverContextoTema` nunca lança (sempre devolve fallback de cores padrão do Office em qualquer falha) — manter essa garantia se for editado. `ordem-xml.ts`/`geometria.ts` operam sobre o XML CRU (string), não sobre a árvore já parseada pelo `fast-xml-parser` — qualquer novo scanner de sequência (ex.: dar suporte real a `arcTo`) deve seguir esse mesmo padrão, nunca confiar em `comoArray()` pra ordem entre tags diferentes.
- **Testes:** `tests/apresentacoes/pptx-parser.test.ts` (14 casos: os 6 originais + blipFill-em-p:sp com svgBlip preferido sobre raster, custGeom retangular sem recorte, custGeom curvo+blipFill→SVG recortado, custGeom curvo+solidFill→SVG colorido, ordem real entre tipos intercalados, detecção de fontes, motivo específico por forma sem fill, `p:cxnSp` contado em vez de descartado) — rodar antes de mexer em parser/tema/geometria/ordem-xml.
- **Risco conhecido, não resolvido:** rota usa `request.formData()` direto — herda o limite padrão de payload de Functions da Vercel (~4,5MB), igual a TODOS os outros uploads deste projeto (não é regressão desta feature). `.pptx` grandes com muita imagem podem falhar por isso, não por bug de parsing. Fix real seria upload direto client→Blob, não implementado.
- **Fora de alcance nesta arquitetura (infra não disponível, não só "não implementado"):** renderização de referência via LibreOffice/Aspose (não instalado no servidor, inviável numa function serverless), worker/fila com progresso e cancelamento real (sem essa infra no projeto).
- **Validado com arquivo `.pptx` REAL** (2026-08-07, 18 slides do usuário, não só XML sintético) — rodado via `npx tsx` direto contra o parser de verdade (não leitura de código): slide 10 (antes vazio) passou a extrair a foto de fundo; as 14 fotos de especialista do slide 3 (`custGeom` curvo + `blipFill`, recorte real confirmado por conterem `<clipPath>`+`data:image/...;base64` no SVG gerado) passaram a aparecer; slides 2/4 (fundo+ícones via `blipFill`+`svgBlip`) passaram a extrair corretamente; fontes reais do arquivo (`SF Pro Display`, `SF Pro Display Heavy`, `Open Sans 1/2` +Bold) detectadas e reportadas. 0 erros/exceções nos 18 slides, 0 elementos "não pareados" entre ordem real e árvore parseada. Heurística de texto sobreposto (bounding box quase idêntico) não achou nenhum caso — não substitui comparação visual real (LibreOffice/browser, indisponível neste ambiente; usuário pode validar abrindo a apresentação importada no editor).

**Editado quando:** o usuário testar de novo (mesmo arquivo ou outro) e reportar o que ainda não ficou "certinho" — usar `tests/apresentacoes/pptx-parser.test.ts` como base pra reproduzir o caso reportado como XML sintético (ou, se possível, o `.pptx` real) antes de mexer.

---

### Alpha Motion — correções definitivas de editor, runtime e exportação (2026-08-10)

**Texto PPTX editável:** `rich-text-edit.ts` é a única regra de sincronização entre `propriedades.texto` e `propriedades.richText`. O algoritmo preserva prefixo/sufixo e estilos dos runs não alterados; inserções herdam o estilo adjacente. `TextoProps.tsx` permite negrito/itálico/sublinhado global e edição/formatação por run. Um componente de texto do PowerPoint continua sendo um componente, mas seus trechos ricos deixam de ficar travados.

**Runtime unificado de animação:** `RenderComponenteAnimado` resolve `ElementAnimation` pelo `resolver.ts` e compõe `AnimacaoElementoWrapper` com `ScrollRevealWrapper`. Essa fronteira é usada no canvas, modo apresentação e `PlayerStandalone`, e é propagada recursivamente por cards, grids e containers. Quando um elemento tem timeline nova, somente nele a animação legada é desativada, evitando duas transforms/opacity concorrentes; sem timeline, o comportamento legado permanece.

**Sequenciamento:** `resolver.ts` calcula os delays efetivos sobre a timeline completa do slide por `resolverOrdemExecucao` + `calcularDelaysEfetivos`, portanto `after-previous` e dependências entre elementos diferentes não são reduzidos ao subconjunto local. Dependências inválidas usam ordem estável como fallback.

**Gatilhos e efeitos:** o wrapper executa os gatilhos automáticos, clique, hover e visibilidade; `on-scroll` continua delegado ao wrapper específico. Variants adicionadas cobrem os tipos visuais que antes caíam no mesmo fallback. Efeitos globais continuam em `EfeitosGlobaisSlide`.

**HTML responsivo:** o export adiciona viewport seguro; `player.css` normaliza `html/body/#root` para 100%, remove margem/padding, bloqueia overflow e o player usa raiz `fixed inset-0`. A escala canônica é recalculada ao redimensionar, rotacionar e alternar fullscreen.

**Editor:** `SidebarSlides.tsx` virou gaveta recolhível com contagem, altura máxima e scroll próprio. `SidebarComponentes.tsx` usa o espaço vertical restante e não abre mais “Básicos” automaticamente; todas as categorias iniciam fechadas.

**Regressões/gates:** novos testes cobrem sincronização de rich text, variants/runtime e delay entre elementos. Testes direcionados, lint direcionado, build do player e `next build` foram aprovados. O teste completo preserva uma falha preexistente por timeout do Google Calendar; typecheck/lint globais também mantêm erros de baseline fora do Alpha Motion. O fluxo visual autenticado ainda requer validação manual porque o ambiente local redirecionou ao login sem credenciais disponíveis.

**Esta seção substitui** a descrição histórica da Fase 08 que dizia que `PlayerStandalone.tsx` compunha apenas `ScrollRevealWrapper`; ela permanece abaixo como registro da implementação original.

**Editado quando:** a fronteira compartilhada de render animado, os formatos de rich text, o modelo de gatilhos ou a estrutura de sidebar/export forem alterados.

**Última atualização:** 2026-08-10 por Scribe

---

### Alpha Motion — Fase 08 (Scroll Reveal + Controles do Player)

**Adicionado em:** 2026-08-06 por Scribe (sessão Bibble, pipeline serial completo)

**Descrição:** Único modo de `SlideScrollConfig.mode` implementado até agora é `"reveal"` — Scroll Scrub/Sticky/Pinned/Parallax/Snap ficam de fora, decisão registrada em `decisions.md` (2026-08-06): o player (`PlayerStandalone.tsx`) navega por SLIDE INTEIRO (1 gesto = 1 avanço, cooldown 800ms), não é rolagem contínua de página — implementar os outros modos exigiria reestruturar esse modelo de navegação. Também ficaram fora: velocidade de reprodução (não há autoplay), play/pause real de slides, mute/volume (`container-carga-audio.ts` só tem desbloqueio de autoplay policy), desativar animações manualmente (só existe `useReducedMotion` via preferência do SO).

**Descoberta arquitetural (relevante para qualquer fase futura que toque o player exportado):** o `.html` exportado por `exportar-html/route.ts` NÃO é HTML estático — é um bundle React offline (esbuild IIFE, `scripts/build-apresentacoes-player.mjs`) que roda `PlayerStandalone.tsx` de verdade dentro do arquivo. Hooks React normais (`useState`/`useEffect`/hooks customizados como `useScrollReveal`) funcionam nele sem restrição especial — a única regra é nunca importar `next/*` nem qualquer arquivo com `"use server"` (2 guards automáticos no script de build abortam o build se isso acontecer).

**Arquivos novos:**
- `src/lib/apresentacoes/scroll/scroll-reveal.ts` — `ConfigScrollReveal`, `CONFIG_SCROLL_REVEAL_PADRAO`, hook `useScrollReveal(ref, config)` via `IntersectionObserver` real. `threshold` sempre clampado em `[0,1]` antes de passar ao observer (fix de Anubis — `customProperties` é schema Zod permissivo, um valor fora do range lançaria `TypeError` na construção do observer).
- `src/components/Apresentacoes/Editor/RenderEngine/ScrollRevealWrapper.tsx` — wrapper FINO por componente (diferente de `EfeitosGlobaisSlide.tsx`, que é por SLIDE inteiro). Acha a primeira `ElementAnimation` com `trigger: "on-scroll"` nas animações recebidas; sem ela, retorna `children` direto via Fragment (zero `<div>` extra, zero custo, 100% retrocompatível). Quando ativo, define `width:100%; height:100%` no próprio `<div>` — sem isso os `Render*` internos (`RenderImagem`/`RenderBotao` etc., que dependem de 100% do pai imediato) colapsariam visualmente.

**Arquivos editados:**
- `src/apresentacoes-player/dados-tipos.ts` — `SlideExportado` ganhou `animacaoConfig: SlideAnimationConfig | null`.
- `src/app/api/apresentacoes/[id]/exportar-html/route.ts` — `slidesBase` agora propaga `animacaoConfig` de `dadosJson` (nenhuma mudança de `select` do Prisma: `dadosJson: true` já trazia tudo, é `Json` genérico). `embutirAssetsNosSlides` (spread genérico `{ ...slide, componentes: ... }`) já propagava o campo automaticamente, sem precisar de ajuste.
- `src/components/Apresentacoes/Editor/Canvas/ComponenteNoCanvas.tsx` — `ScrollRevealWrapper` conectado como filho INTERNO do wrapper de posicionamento (que já carrega `ajusteVisual` da Fase 07) — nunca no mesmo nó DOM, para não haver 2 elementos disputando `style.opacity`/`transform`.
- `src/apresentacoes-player/PlayerStandalone.tsx` — ganhou `voltar()` (espelha `avancar()`, mesmo `bloqueadoRef`/cooldown 800ms), `reiniciar()`, `alternarTelaCheia()` (padrão idêntico a `ModoApresentacaoClient.tsx:154-164`, try/catch, nunca crítica se o browser negar), atalhos de teclado (seta esq/dir, espaço, F — com guard contra `button/input/select/textarea/a/[role='slider']` focado), barra de controles visível só quando `jaInteragiu && !capaAtiva`, e o `map` de componentes agora envolve cada um com `ScrollRevealWrapper`.

**Lookup elementId→animação:** ambos os pontos de conexão (`ComponenteNoCanvas.tsx` e `PlayerStandalone.tsx`) reaproveitam `resolverAnimacoesDoElemento(componente, animacaoConfig)` (`src/lib/apresentacoes/animacao/resolver.ts`, existente desde a Fase 01) — nunca duplicar esse filtro em código novo.

**Dívida técnica registrada (Sage, baixo risco, não corrigida):** `reiniciar()` em `PlayerStandalone.tsx` zera `bloqueadoRef.current` imediatamente, sem cooldown próprio — clicar "reiniciar" 2x rápido ou "reiniciar" seguido de "avançar" pode truncar a transição visual (não corrompe estado, índice sempre válido). Primeira hipótese a investigar se o usuário reportar "a transição de reinício às vezes corta".

**Testes:** `tests/apresentacoes/scroll-reveal.test.ts` — 14 testes (config/schema, clamping de threshold, `resolverAnimacoesDoElemento` com `animacaoConfig` ausente, simulação isolada da máquina de estado do hook — sem DOM real, projeto não tem `@testing-library/react`/`jsdom`, `vitest.config.ts` roda em `environment: "node"`). Comportamento real do `IntersectionObserver` em browser segue como validação manual pendente.

**known-errors.md ganhou 1 entrada nova (Forge):** "ESLint `react-hooks/set-state-in-effect` — `setState` redundante dentro de `useEffect` que só replica o valor inicial do `useState`" — padrão diferente do já catalogado sobre chamar Server Action em efeito; aqui é sobre reafirmar um valor que o inicializador do `useState` já cobria.

**Editado quando:** Fase 09 (Presets/Preview/Polimento) ou Fase 10 (Exportação Final) tocarem `PlayerStandalone.tsx` de novo — considerar extrair a barra de controles (linhas ~223-265) para `PlayerControls.tsx` se o arquivo crescer além do padrão atual (~270 linhas, dentro do limite de 300 mas já perto).

**Última atualização:** 2026-08-06 por Scribe

---

### Alpha Motion — Fase 09 (Presets, Preview e Polimento)

**Adicionado em:** 2026-08-06 por Scribe (sessão Bibble, pipeline serial completo)

**Recorte de escopo (Scout, aprovado pelo usuário):** dos 6 blocos da fase, 2 ficaram documentados como limitação por falta de base no código, não por escolha arbitrária: **multi-seleção de elementos** (`useEditorStore.componenteSelecionadoId: string | null` é singular desde a Onda 2 — "aplicar a todos os SELECIONADOS" pressupõe uma feature de seleção múltipla que nunca existiu) e **Undo/Redo** (nenhuma pilha de histórico em lugar nenhum do editor — "aplicar preset gera 1 entrada de histórico" não tem onde pendurar). **Modo de qualidade** em nível de `Apresentacao` também ficou fora: o model no schema Prisma não tem nenhum campo Json genérico (só colunas fixas como `titulo`/`status`/`temaId`), exigiria migration real → gate do Vault, não incluído nesta rodada.

**Arquivos novos:**
- `src/lib/apresentacoes/animacao/presets-completos.ts` — `PRESETS_ANIMACAO_COMPLETOS` (8: Minimalista, Corporativo, Cinematográfico, Dinâmico, Storytelling, Cards em sequência, Apresentação de métricas, Card Focus), mesmo espírito de `presets-stagger.ts` mas um nível acima — cada preset retorna `AnimacaoPreset[]` (`Omit<ElementAnimation, "id"|"elementId">`), preenchidos na aplicação, nunca `id` fixo reaproveitado entre elementos. **Sem deduplicação**: aplicar o mesmo preset 2x no mesmo elemento gera 2 conjuntos completos de animações — comportamento intencional (mesmo padrão que o `<select>` "Adicionar animação" original já tinha), documentado em teste.
- `src/lib/apresentacoes/animacao/responsivo.ts` — `ResponsivoConfig` (5 campos: `desktopOnly`, `distanciaMobile`, `desativarPin`, `desativarParallax`, `fallbackMobile`) dentro de `ElementAnimation.customProperties.responsivo`, sem migration (schema já era `z.unknown()` desde a Fase 01). `lerConfigResponsiva()` faz type-narrowing campo a campo — `distanciaMobile: 0` é tratado corretamente como valor válido (comparação de tipo+range, nunca `??`/`||`, que teria o bug clássico de falsy coercion).
- `src/components/Apresentacoes/Editor/ReducedMotionSimuladoContext.tsx` — toggle "reduzir animações" ISOLADO do Editor. **Não troca nenhum hook existente**: `AnimacaoWrapper`/`RenderComponente.tsx` (caminho de render REAL compartilhado Editor+player exportado) não usa `useReducedMotion` hoje; só `TransicaoSlide.tsx` usa, e esse é exclusivo do Modo Apresentação/player exportado. Usado só em `PreviewMiniatura.tsx` — zero risco do player exportado herdar a simulação.
- `src/components/Apresentacoes/Editor/PainelDireito/camposPorTipo/PreviewMiniatura.tsx` — miniatura DOM/CSS em loop (nunca vídeo/GIF, Seção 14 do prompt original), reaproveita `montarTransition`/`resolverEasingFramerMotion` (`curvas.ts`) — **não** reaproveita `AnimacaoWrapper`/`nucleo.tsx`, que opera sobre o formato ANTIGO `ConfigAnimacao`, incompatível com `ElementAnimation`. Mapa `VARIANTS_PREVIEW` cobre ~20 dos ~87 tipos do catálogo; os demais caem no fallback estático (`VARIANT_PADRAO`), testado contra o catálogo real.
- `src/components/Apresentacoes/Editor/PainelDireito/camposPorTipo/SeletorPreset.tsx` — aplica preset ao elemento selecionado atualmente no Editor.
- `src/components/Apresentacoes/Editor/PainelDireito/camposPorTipo/CamposResponsividade.tsx` — UI dos 5 campos, grava em `customProperties.responsivo` preservando outras chaves já existentes em `customProperties` da mesma animação (spread completo antes de sobrescrever só a chave `responsivo`).
- `src/components/Apresentacoes/Editor/BarraSuperior/ModalAplicarPreset.tsx` — "Aplicar a este slide" (síncrono, via store) e "Aplicar a todos os slides" (`AlertDialog` de confirmação — nunca `confirm()` nativo — + loop sequencial reaproveitando a Server Action `AtualizarSlide` já existente, ownership revalidado a cada chamada individual). Botão "Aplicar a todos os slides" desabilita quando `slides.length === 0`.

**Arquivos editados:** `AnimacaoPropsV2.tsx` (preview+seletor de preset anexados; `<select>` "Adicionar animação" mudou de instantâneo para exigir clique em "Adicionar" — dá tempo de ver o preview antes de confirmar), `AnimacaoItemForm.tsx` (`CamposResponsividade`+`PreviewMiniatura` anexados), `BarraSuperiorEditor.tsx` (botão "Presets" + toggle reduced-motion), `ApresentacaoEditor.tsx` (envolvido por `ReducedMotionSimuladoProvider`), `slide-animacao-config.ts` (só comentário documentando a convenção `customProperties.responsivo`, sem mudança de schema).

**Dívida técnica registrada (Anubis, não bloqueante):** "Aplicar a todos os slides" não tem teto de quantidade — uma apresentação com centenas de slides gera centenas de `AtualizarSlide` sequenciais a partir de 1 clique. Aceitável para o volume realista de uso (dezenas de slides), mas vale limite explícito se o produto crescer.

**Dívida técnica registrada (Lens, não bloqueante):** lógica de merge de `SlideAnimationConfig` (`timelineAtual`/`novoConfig`) duplicada entre `aplicarAoSlideAtivo` e `aplicarATodosOsSlides` em `ModalAplicarPreset.tsx` — candidata a extrair um helper compartilhado numa próxima passada por esse arquivo.

**Testes:** `tests/apresentacoes/presets-completos.test.ts` — 45 testes (8 presets válidos com types do catálogo real, nunca incluem `id`/`elementId`, `lerConfigResponsiva` defensivo incluindo `distanciaMobile: 0`, fallback de preview exercitado contra o catálogo real, reaplicação de preset documentada como não-deduplicada).

**known-errors.md:** nenhuma entrada nova nesta fase.

**Editado quando:** Fase 10 (Exportação Final) — considerar se os 2 formatos de animação (`ConfigAnimacao` legado vs `ElementAnimation` novo) devem convergir, o que unificaria `PreviewMiniatura.tsx` e `nucleo.tsx` num só motor de preview.

**Última atualização:** 2026-08-06 por Scribe

**Última atualização:** 2026-08-06

---

## Padrão reutilizável: Guia Inteligente de Módulo (2026-08-07)

Pedido curto reconhecido: **“Adicione o Guia Inteligente neste módulo.”**

### Contrato de integração

- [ ] Inventariar funções reais, permissões, nomes visuais, fluxos e limites do módulo.
- [ ] Criar/adicionar o manual em `src/lib/shared/module-knowledge/`, dividido por tópicos e aliases.
- [ ] Registrar o manual no `MANUAIS_MODULOS` e validar a permissão usada pela tool `consultar_manual_modulo`.
- [ ] Manter dados vivos em tools próprias; o manual ensina procedimentos e não congela números/estados do banco.
- [ ] Definir `ConfigTutorialModulo` com nova versão somente quando a mudança justificar reapresentação.
- [ ] Marcar alvos estáveis com `data-guia-<modulo>`; passos condicionais podem não existir e serão ignorados.
- [ ] Verificar `localStorage` depois da hidratação e passar `userId` do Server Component, sem criar coluna de onboarding.
- [ ] Incluir botão “Tutoriais” para replay, Pular e Concluir gravando a mesma preferência.
- [ ] Cobrir aliases, conteúdo crítico, autorização, chave/versionamento e passos ausentes em Vitest.
- [ ] Validar teclado, reduced motion, mobile, scroll e perfis com permissões diferentes.
- [ ] Atualizar `patterns.md`, `components.md`, `integration-points.md`, `codebase-map.md` e a story.

### Implementação inicial

- Conhecimento: `src/lib/shared/module-knowledge/{types,registry,metas,parceiros}.ts`.
- Bibble: `src/lib/bibble/{tools,tool-executor,system-prompt}.ts`.
- Tour: `src/components/Guias/GuiaModuloTour.tsx` e `src/lib/guias/tutorial-modulo.ts`.
- Integração: `src/app/PainelAlpha/Parceiros/page.tsx` e `src/components/Parceiros/ParceirosClient.tsx`.
- Testes: `tests/bibble/module-knowledge.test.ts` e `tests/guias/tutorial-modulo.test.ts`.

**Limite atual:** o manual modular está ligado ao Bibble nativo. A rota de agentes Onyx ainda não injeta esse catálogo; isso é evolução separada, não deve ser presumido ao replicar o padrão.

**Última atualização:** 2026-08-07 por Scribe

---

## Alpha Motion — Central Criativa, presets e publicação (2026-08-10)

### Biblioteca de presets

- Fonte persistente: `Slide.dadosJson.presetsAnimacao`; deve existir em somente um slide hospedeiro por apresentação.
- Toda leitura/escrita deve passar por `normalizarPresetsAnimacaoPersonalizados` e pelo catálogo `listarPresetsAnimacaoDisponiveis` para manter presets nativos e personalizados compatíveis.
- `AtualizarSlide` precisa preservar a biblioteca existente. Ao excluir o hospedeiro, transfira-a na mesma transação; ao duplicar, remova o campo da cópia.
- Antes de salvar presets, `PresetsAnimacaoProvider` aguarda o autosave pendente do editor para impedir concorrência de atualizações no mesmo JSON.

### Exportação e link público

- `ApresentacaoEditor` centraliza `salvarAlteracoesPendentes`; HTML e publicação devem aguardar essa função antes de iniciar.
- `GerarLinkPublicoApresentacao` aceita somente proprietário, admin global ou colaborador editor/admin e publica com slug aleatório de 32 caracteres hexadecimais. Renovar substitui o slug e invalida imediatamente o link anterior.
- `/apresentacao/[slug]` é pública, `force-dynamic`, `noindex` e responde 404 para slug inválido, rascunho ou apresentação expirada. A renderização reutiliza `PlayerStandalone`, preservando responsividade e URLs públicas dos assets.

### Central Criativa e imagens

- `CentralCriativaModal` integra as abas Biblioteca, Presets, Marca e Formato, além do tutorial contextual.
- `BibliotecaAssets` oferece remoção de fundo e contorno. `criarContornoImagem` amplia o canvas conforme a espessura, usa a máscara do fundo removido e gera novo PNG sem alterar o asset original.

### Validação da entrega

- Testes Alpha Motion: 260/260; lint direcionado e `next build` aprovados.
- O teste visual autenticado permaneceu bloqueado por falta de credenciais; a rota pública inválida foi validada no browser sem redirecionamento ao login.
- Nenhuma migration ou dependência foi adicionada.

**Última atualização:** 2026-08-10 por Scribe

---

## Alpha Motion — edição transacional, camadas e texto rico (2026-08-10)

### Histórico e transformações do canvas

**Arquivos:** `src/components/Apresentacoes/Editor/store/useEditorStore.ts`, `EditorKeyboardShortcuts.tsx`, `Canvas/ComponenteNoCanvas.tsx`, `Canvas/useCanvasDragResize.ts`

**Editado quando:** uma nova ação do editor precisar participar de Undo/Redo, operar sobre múltiplos elementos ou introduzir um gesto contínuo.

**Como integrar:** ações discretas devem registrar um snapshot pela store; gestos com vários eventos devem chamar `iniciarTransacaoHistorico()` no início e `finalizarTransacaoHistorico()` no fim. Nunca grave uma entrada por `mousemove`. Ao mover uma seleção, preserve posições relativas e filtre filhos cujo pai também está selecionado.

### Ordem de slides e camadas

**Arquivos:** `SidebarEsquerda/SidebarSlides.tsx`, `Timeline/TimelineReal.tsx`, `useEditorStore.ts`

**Editado quando:** a persistência de ordem, os controles da gaveta ou a semântica de `zIndex` forem alterados.

**Como integrar:** a timeline lista do topo visual para a base e converte essa ordem em `zIndex`. Exclusões devem passar por `removerComponentes()` para limpar animações e grupos. A gaveta atualiza otimisticamente, mas restaura a ordem anterior se `ReordenarSlides` falhar.

### Tipografia compartilhada entre editor e player

**Arquivos:** `src/lib/apresentacoes/fontes.ts`, `src/lib/apresentacoes/rich-text-edit.ts`, `TextoProps.tsx`, `RenderBasicos.tsx`, `src/app/globals.css`, `src/apresentacoes-player/player.css`, `src/generated/apresentacoes-player-bundle.ts`

**Editado quando:** fontes, propriedades de texto, rich text importado ou a renderização do player mudarem.

**Como integrar:** formatação com seleção deve usar `aplicarEstiloNoIntervaloRichText`; sem seleção, sincronize propriedades globais e runs. Toda fonte nova precisa existir no catálogo e na URL de provisionamento de `scripts/download-alpha-motion-fonts.mjs`; execute `npm run fonts:alpha-motion` para gerar os WOFF2 e `src/app/alpha-motion-fonts.css`. A folha deve permanecer ao lado de `globals.css` e ser importada como `./alpha-motion-fonts.css`, pois o resolvedor CSS do Turbopack falhou com o caminho transversal `../styles`. Depois execute `npm run build:player`: o script troca `/fonts/alpha-motion/*.woff2` por data URI e falha se sobrar qualquer referência externa ou caminho local no bundle HTML offline.

**Última atualização:** 2026-08-10 por Scribe

---

## Bibble/IAlpha — fluxo de anexos e PDFs

### Contrato de seleção, upload e prontidão

**Arquivos:** `src/lib/bibble/attachments.ts`, `src/components/BibbleChatHome/BibbleChatInput.tsx`, `src/components/BibbleChatHome/BibbleFileUpload.tsx`, `src/components/BibbleChatHome/BibbleChatLayout.tsx`, `src/app/api/bibble/upload-to-blob/route.ts`

**Propósito:** mantém UI, layout e API alinhados sobre tipos permitidos, máximo de 10 anexos, máximo de 100 MB por arquivo e o momento em que um anexo pode ser enviado. A condição canônica é: upload finalizado, sem erro e com `uploadUrl` confirmado.

**Editado quando:** um tipo/tamanho/quantidade de anexo mudar, o upload trocar de storage, um novo ponto da UI anexar arquivos ou o estado de upload ganhar outra etapa.

**Como adicionar:** importe as constantes/helpers de `attachments.ts`; não recrie arrays MIME nem permita envio direto pelo componente. O handler final deve repetir a guarda antes de efeitos colaterais.

```typescript
if (!areAttachmentsReady(uploadFiles)) return;
if (uploadFiles.length > BIBBLE_MAX_FILES_PER_TURN) return;
const selected = selectAttachmentsWithinLimit(uploadFiles, incomingFiles);
```

Na rota de upload, novos tipos precisam entrar na allowlist compartilhada e ter validação de conteúdo correspondente quando houver assinatura conhecida. PDFs exigem MIME `application/pdf`, extensão `.pdf` e magic bytes `%PDF`. O caminho do Blob permanece opaco: `bibble-chat/<uuid>`.

**Última atualização:** 2026-08-11 por Scribe

### Extração de documentos e segurança dos anexos

**Arquivos:** `src/lib/bibble/attachment-security.ts`, `src/lib/bibble/tika.ts`, `src/lib/bibble/pdf24-ocr.ts`, `src/lib/bibble/pdfjs-polyfill.ts`, `src/app/api/bibble/upload-to-blob/route.ts`, `src/app/api/bibble/chat/route.ts`

**Propósito:** valida o envelope do chat e executa a leitura na ordem Tika → `pdf-parse` → PDF24 OCR. Downloads aceitam somente URLs HTTPS do Vercel Blob sob `/bibble-chat/`, bloqueiam redirects e revalidam a URL de resposta. O PDF24 só recebe/retorna recursos da mesma origem configurada.

**Editado quando:** um formato de documento for aceito, a cadeia de extração mudar, o host/caminho de storage mudar, o schema do payload ganhar campo ou um processador externo for substituído.

**Como adicionar:** toda URL de anexo recebida do cliente deve passar por `parseTrustedBibbleBlobUrl`/`fetchTrustedBibbleBlob`; nunca use `fetch(file.url)` diretamente. Preserve `extractionSource` no upload e no payload para observabilidade sem registrar nome ou conteúdo do arquivo.

```typescript
const parsed = bibbleChatInputSchema.safeParse(input);
if (!parsed.success) return invalidInputResponse;

const response = await fetchTrustedBibbleBlob(parsed.data.files[0].url!);
const extraction = await extractTextFromBuffer(buffer, mimeType, fileName);
```

Qualquer turno com anexo usa `toolsForTurn = []`: conteúdo do documento não confiável não pode acionar tools do sistema. O Blob criado pela rota atual usa `access: "public"`, mas seu caminho é opaco e o chat só baixa URLs que passam pela allowlist acima.

**Última atualização:** 2026-08-11 por Scribe

### Orçamento de contexto e saída do Bibble

**Arquivos:** `src/lib/bibble/context-budget.ts`, `src/lib/bibble/completion.ts`, `src/app/api/bibble/chat/route.ts`, `src/components/BibbleChatHome/BibbleSettingsPanel.tsx`

**Propósito:** evita que PDF/histórico ocupem a reserva da resposta. A janela padrão é 32.768 tokens, a saída reserva até 4.096 tokens e PDFs com janela legada/insuficiente são ajustados para a janela segura do provider. Conteúdo excedente usa seleção explícita de início, meio e fim.

**Editado quando:** um provider/modelo mudar de capacidade, o default do painel mudar, outro tipo de conteúdo exigir custo próprio ou a reserva de saída for alterada.

**Como adicionar:** primeiro calcule os custos fixos; depois distribua `availableContentTokens` entre histórico e anexos. Use `selectTextForTokenBudget`/`selectRecentHistory` em vez de `slice(0, N)` e encaminhe os valores resolvidos à completion.

```typescript
const budget = calculateRequestBudget({
  model,
  requestedContextWindow,
  hasPdf,
  systemPrompt,
  userPrompt,
  tools,
});

const selection = selectTextForTokenBudget(text, budget.availableContentTokens, "documento");
await callCompletion(messages, tools, model, signal, true, temperature,
  budget.effectiveContextWindow, budget.outputTokenLimit);
```

No Ollama, `callCompletion` também envia `options.num_ctx` e `options.num_predict`; nos endpoints OpenAI-compatible, usa `max_tokens` ou `max_completion_tokens` conforme o modelo.

**Última atualização:** 2026-08-11 por Scribe

### Protocolo SSE concluído e retry preservando anexos

**Arquivos:** `src/lib/bibble/completion.ts`, `src/lib/bibble/client-stream.ts`, `src/app/api/bibble/chat/route.ts`, `src/components/BibbleChatHome/BibbleChatLayout.tsx`

**Propósito:** distingue resposta concluída de conexão encerrada ou limite de saída. O provider precisa fornecer `finish_reason`; a API precisa emitir `done`; o cliente só persiste quando `done.truncated !== true` e `done.successful !== false`.

**Editado quando:** um endpoint novo reutilizar o consumidor SSE, eventos forem adicionados, o provider mudar de formato ou o fluxo de persistência/retry mudar.

**Como adicionar:** endpoints Bibble devem encerrar com um evento explícito e marcar qualquer conclusão anormal como falha. O client comum deve continuar tratando EOF físico como incompleto.

```typescript
send({
  type: "done",
  finishReason,
  truncated: isOutputTruncated(finishReason),
  successful: !isOutputTruncated(finishReason),
});

await consumeBibbleAppStream(response, onEvent);
```

Em erro, truncamento, timeout ou EOF sem `done`, `BibbleChatLayout.tsx` remove as mensagens parciais e restaura o texto e a mesma coleção de anexos para retry. Não persista `fullResponse` antes da confirmação do protocolo.

**Testes de contrato:** `tests/bibble/attachment-readiness.test.ts`, `attachment-security.test.ts`, `context-budget.test.ts`, `completion-budget-stream.test.ts`, `client-stream-protocol.test.ts`, `pdf-extraction-chain.test.ts`.

**Última atualização:** 2026-08-11 por Scribe
## Equipes privadas no Bloco de Notas (2026-08-12)

- Entrada: botão `Equipes` em `CentralNotasHeader` e ação `Gerenciar` em `NoteShareDialog`.
- Acesso: `criarFiltroAcessoNota`, `resolverPapelEfetivo` e seções `COMPARTILHADAS_COMIGO`/`EQUIPE` usam `NoteTeamShare`.
- Compatibilidade: `NotePermission` permanece limitado a `USUARIO | SETOR | ROLE`.
- Banco: tabelas `NoteTeam`, `NoteTeamMember`, `NoteTeamShare` aplicadas ao Turso após gate Vault.
### Alpha CRM — invalidação em tempo real por pipeline

**Arquivos:** `src/lib/bpm/realtime.ts`, `src/lib/bpm/realtime-server.ts`, `src/app/api/pusher/auth/route.ts`, `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
**Propósito:** sincroniza criação, edição, movimentação e atividades dos cards entre usuários/abas sem refresh manual.
**Editado quando:** uma nova Server Action passar a alterar dados visíveis no board ou no modal do Alpha CRM.

**Como integrar:** após a persistência bem-sucedida, chamar `notificarPipelineBpm` com o tipo adequado. O cliente trata o evento `alpha-crm-atualizado` como sinal de invalidação e relê os dados autenticados; nunca enviar dados do lead no payload Pusher.

**Última atualização:** 2026-08-12 por Codex/Bibble.

### Alpha CRM — vínculo de pessoas ao card

**Arquivos:** `prisma/schema.prisma` (`BpmCardMembro` existente), `src/actions/bpm/Membros.ts`, `src/lib/bpm/ownership.ts`, `src/lib/validations/bpm.ts`, `src/app/PainelAlpha/AlphaCRM/CardModal/{CardFullViewModal,SeletorMembrosCard}.tsx`, `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`, `src/lib/bpm/realtime{,-server}.ts`.

**Propósito:** controla quem pode trabalhar em cada card do CRM. O cabeçalho do modal aberto permite selecionar pessoas vinculadas; o Kanban fechado mostra seus avatares. A seleção não é apenas visual: o vínculo em `BpmCardMembro` é a fonte da autorização operacional por card.

**Editado quando:** uma nova action passar a executar trabalho em card, o formato do membro/usuário mudar, a UI de cabeçalho/Kanban alterar a representação de pessoas ou a política de revogação/realtime for modificada.

**Como integrar:** toda action que lê ou altera card deve chamar `exigirAcessoBpmCard(cardId, userId, role, acao)` com uma ação de `BpmAcao`; nunca aceite membro, papel ou usuário elegível do cliente. Gestão de participantes usa exclusivamente as actions de `Membros.ts`: a action revalida na transação que a pessoa está `ATIVO` e possui CRM efetivo, adiciona o responsável obrigatoriamente, persiste por CAS e registra histórico. `PARTICIPANTE` recebe as ações operacionais, mas nunca `adicionarParticipantes` ou `excluirCard`.

```typescript
await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard");

const resultado = await AtualizarMembrosCardBpm({
  cardId,
  userIds: membrosSelecionados,
});
```

Após mutação confirmada, publique somente `CARD_ATUALIZADO` via `notificarPipelineBpm`. O payload do canal deve permanecer genérico, sem `cardId`, IDs de usuários, foto, nome ou dados do lead; o `PipelineBoardClient` relê o board sob a autorização atual. Esse contrato é necessário para a revogação correta: o membro removido recebe a invalidação, mas perde o conteúdo ao recarregar; o modal deve fechar se a nova leitura devolver não autorizado.

**Testes de contrato:** `tests/bpm/membros-card-actions.test.ts`, `tests/bpm/membros-card-ownership.test.ts`, `tests/bpm/membros-card-ui.test.ts`, além das regressões BPM de autorização e realtime.

**Última atualização:** 2026-08-14 por Scribe/Kowalski.

### Alpha CRM — entrada e status operacional de Fechado

**Arquivos:** `src/lib/bpm/status-pos-fechamento.ts`, `src/lib/validations/bpm.ts`, `src/actions/bpm/Cards.ts`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelStatusPosFechamento.tsx`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`, `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`, `src/lib/bpm/realtime-server.ts`.

**Propósito:** mantém criação, movimento, edição, modal e board alinhados sobre os cinco status pós-fechamento. A entrada em **Fechado** falha de forma fechada sem **Valor acordado no contrato** e **Forma de pagamento** válidos e inicializa `AGUARDANDO_CONTRATO` atomicamente quando o card ainda não possui status.

**Editado quando:** um status/label/paleta mudar, um novo entrypoint criar ou mover cards, a regra de entrada em **Fechado** mudar, ou outro consumidor precisar reagir ao status pós-fechamento.

**Como integrar:** reutilize `status-pos-fechamento.ts`; não replique enum, labels ou classes na UI/action. Todo entrypoint deve convergir nas guards server-side de `Cards.ts`. Edições enviam o snapshot `versaoEsperadaEm`, persistem por CAS e só depois disparam realtime.

```typescript
const statusConfig = obterStatusPosFechamentoVisivel({
  etapaNome: card.etapa.nome,
  status: card.statusPosFechamento,
});

await AtualizarCardBpm({
  cardId: card.id,
  statusPosFechamento: novoStatus,
  versaoEsperadaEm: card.updatedAt,
});
```

No modal, preserve o rascunho local quando o snapshot remoto mudar e ofereça resolução explícita do conflito. No board, badge textual e tint só aparecem quando `obterStatusPosFechamentoVisivel` retorna configuração, ou seja, apenas em **Fechado** com código persistido reconhecido.

**Limite de integração:** esta feature não cria evento financeiro, card financeiro, adapter de Comissões nem outro efeito colateral. Uma integração financeira futura deve ser desenhada como requisito separado e consumir `BpmCard.statusPosFechamento` como fonte canônica.

**Testes de contrato:** `tests/bpm/fechado-status-pos-fechamento.test.ts`, `tests/bpm/fechado-actions.test.ts`, `tests/bpm/fechado-ui.test.ts` e `tests/bpm/card-modal-integration.test.ts`.

**Última atualização:** 2026-08-13 por Scribe.

### Alpha CRM — Agendar reunião e ciclo de follow-up

**Arquivos:** `src/lib/bpm/agendar-reuniao.ts`, `src/actions/bpm/Cards.ts`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`, `src/lib/bpm/automacao-novos-leads.ts`.

**Propósito:** impede o avanço de Agendar reunião para Reunião Agendada sem `BpmCard.dataReuniao`, mantendo Standby como contingência, e integra a etapa ao ciclo compartilhado de oito dias úteis.

**Como integrar:** movimentos manuais continuam passando por `MoverCardBpm`; nunca confiar apenas no botão desabilitado. Para Agendar reunião, a data-base do ciclo é a última entrada na etapa registrada em `BpmCardHistorico`, com fallback em `createdAt` para legado. O job revalida etapa, status e `proximoContatoEm = null` no update atômico, registra `agendar_reuniao_8_dias_uteis` e só então publica realtime.

**Limite:** a meta de cinco ligações permanece exclusiva de Novos leads. A ausência de Data/Hora não bloqueia Standby automático ou manual, pois esse destino é a saída de contingência do fluxo.

**Última atualização:** 2026-08-12 por Codex/Bibble.

### Alpha CRM — transcrição pós-reunião do Google Meet

**Arquivos:** `src/lib/google-meet/client.ts`, `src/lib/bpm/transcricao-reuniao.ts`, `src/lib/bpm/transcricao-reuniao-server.ts`, `src/actions/bpm/TranscricaoMeet.ts`, `src/actions/bpm/GoogleMeet.ts`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx`, `src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx`, `src/actions/bpm/Cards.ts` e a rota de automação do CRM.

**Propósito:** conecta `PainelReuniao` a `SincronizarTranscricaoReuniaoBpm`, captura os artefatos pós-conferência do Meet, persiste a transcrição/resumo no card, reconhece o estado no modal e impede avanço comercial sem evidência.

**Como integrar:** `CardOpenFormSlot` deve montar `PainelReuniao` com `mostrarFormulario={false}` em **Reunião Agendada**. O meeting code vem somente de `googleMeetLink` oficial; o subject DWD é resolvido pelo cache do evento/calendário no servidor. Use o cliente Meet dedicado com `meetings.space.readonly`; não amplie os escopos do cliente Calendar. Toda sincronização manual exige ownership, e a persistência usa comparação do vínculo/valor anterior, histórico sem texto bruto e realtime após commit. A edição do **Resumo da reunião** chama `SalvarResumoReuniaoBpm` via `registerSave`, com CAS por `updatedAt`. O polling permanece no cron protegido existente e cards em Reunião Agendada entram no ciclo de oito dias úteis.

**Persistência:** o rótulo **Resumo da reunião** usa o campo dedicado `BpmCard.transcricaoReuniao`; não existe `BpmCampo` dinâmico para esse conteúdo. O fallback persiste somente a descrição real do evento Calendar, prefixada como resumo parcial.

**Caminho de acesso:** `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → card em **Reunião Agendada** → `CardFullViewModal` → `CardAbertoLayout` → `PainelRegistrar` → aba **Formulário da Etapa** → `CardOpenFormSlot` → `PainelReuniao` → **Buscar transcrição** / **Resumo da reunião**.

**Limites:** a API e a delegação precisam estar configuradas no Google; a transcrição deve ser realmente gerada pelo Meet. Após recebida, a reunião não pode ser reagendada/reutilizada. O fallback Calendar é parcial e depende de descrição no evento. Não houve migration.

**Última atualização:** 2026-09-04 por Scribe (fechamento RM-2026-CB55AA).

### Alpha CRM — regras e cadência de Novos leads

**Arquivos:** `src/actions/bpm/Cards.ts`, `src/lib/bpm/requisitos-etapa-server.ts`, `src/lib/bpm/novos-leads.ts`, `src/lib/bpm/automacao-novos-leads.ts`, `src/app/api/bpm/jobs/automacao-novos-leads/route.ts`, `PipelineBoardClient.tsx`, `NovoCardModal.tsx`, `vercel.json`.

**Propósito:** unifica obrigatórios diretos e configurados por `BpmCampoObrigatorioEtapa`, revalida a origem antes de sair de Novos leads, mostra a meta visual de cinco ligações por dia e move cards elegíveis para Standby após oito dias úteis.

**Como integrar:** novas formas de criação ou movimento devem continuar passando por `CriarCardBpm`/`MoverCardBpm` ou pelos helpers compartilhados de requisitos. Ligações devem persistir `tipo: "LIGACAO"`. O job exige `CRON_SECRET`, usa atualização condicional para idempotência e emite `CARD_MOVIDO` no realtime após o commit.

**Limite atual:** não existe flag canônica de “respondido”; enquanto não houver decisão estrutural separada, a permanência em Novos leads é a proxy operacional. Feriados não são descontados do ciclo nesta fase.

**Última atualização:** 2026-08-12 por Codex/Bibble.
### Alpha CRM — ponto único de criação e formulários dentro do card

**Regra permanente:** card novo nasce somente em **Novos Leads**. `PipelineBoardClient` pode abrir `NovoCardModal` apenas nessa etapa, e `CriarCardBpm` deve repetir a restrição usando a etapa persistida do pipeline, inclusive dentro da transação.

**Formulários por etapa:** campos personalizados e controles nativos da etapa atual pertencem ao painel central do detalhe do card, na aba **Formulário da Etapa** (`CardFullViewModal`/`PainelRegistrar`/`PainelCamposEtapaAtual`). Requisitos de transição continuam no painel esquerdo (`PainelHistorico`). Eles não devem ser antecipados no modal de criação.

**Google Meet:** `ListarCardsPipelineBpm` precisa entregar `dataReuniao`/`googleMeetLink` ao `PipelineBoardClient`. No board, o ramo `etapaEhAgendarReuniao` de `KanbanCard` é exclusivo: data/hora + ação Meet, com propagação de clique/`pointerdown` interrompida nos controles internos. No modal, `CardOpenFormSlot` retorna somente `PainelReuniao` em **Agendar Reunião**; em **Reunião Agendada**, o mesmo componente opera com `mostrarFormulario={false}` para acompanhamento, sem criar ou reagendar. Não adicionar fallback manual: o link exibido deve vir de `AgendarReuniaoGoogleMeetBpm`/`ReagendarReuniaoBpm` e estar persistido no card.

**Caminho de acesso do agendamento:** `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → coluna **Agendar reunião** → `KanbanCard` → `CardFullViewModal` → `CardAbertoLayout` → `PainelRegistrar` → aba **Formulário da Etapa** → `CardOpenFormSlot` → `PainelReuniao` → Google Calendar → link no card/modal.

**Compatibilidade:** guards de movimento para Fechado, Lost, Em Tratativa, Sem Viabilidade e outras etapas permanecem ativos. Eles validam a entrada por movimento e não constituem permissão para criar diretamente no destino.

**Última atualização:** 2026-09-04 por Scribe (RM-2026-6BEA04).

### Alpha CRM — Standby — Follow Up NoLoss

**Automação:** `src/app/api/bpm/jobs/automacao-novos-leads/route.ts` continua protegido por `CRON_SECRET`; `vercel.json` o agenda diariamente às 12:00 UTC. `executarAutomacaoFollowUpBpm` processa também cards de Standby em Revisão de Radar, usando `standbyFollowUpUltimoEm`/`standbyFollowUpInterrompidoEm` e CAS antes de criar tarefa/histórico. Publique `TAREFA_ALTERADA` somente após o commit.

**UI e ação:** `PainelRegistrar` monta `PainelStandbyFollowUp` somente quando `etapaEhStandbyFollowUp(card.etapa.nome)` dentro da aba central **Formulário da Etapa**. `InterromperStandbyFollowUpBpm` é a única ação de opt-out: exige `editarCard`, etapa Standby e motivo; não criar endpoint ou botão de retomada automática. O estado detalhado é carregado por `ObterEstadoStandbyFollowUpBpm`.

**Limite operacional:** o job cria tarefa interna; não envia comunicação externa sem uma integração de canal definida separadamente.

### Alpha CRM — Background e Pipeline (RM-2026-C4A90D, 2026-08-15)

**Arquivos:** `src/app/PainelAlpha/AlphaCRM/CRMBackground.tsx`, `src/components/ui/crm-pipeline-border.tsx`, `src/app/PainelAlpha/AlphaCRM/CRMLayoutClient.tsx`, `src/app/PainelAlpha/AlphaCRM/DashboardClient.tsx`, `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`.

**Propósito:** background espacial com partículas e nébulas temáticas (Checklist/CS&NPS/Extratos), borda animada com gradiente radial nos cards de pipeline, e sizing fixo responsivo (340/380/420px) com altura min/max + scroll interno.

**Como integrar:** `CrmSpaceBackground` é a primeira camada do container raiz em `CRMLayoutClient.tsx` (content com `relative z-10`). `CrmPipelineBorder` envolve o conteúdo de `KanbanCard` e dos cards de pipeline do Dashboard. Sizing: `w-full md:w-[340px] lg:w-[380px] xl:w-[420px] max-w-full`, `min-h-[200px]`/`max-h-[600px]` + `overflow-y-auto`, sombra dupla com elevação no hover (300ms).

**Dependência:** `framer-motion` (já em `dependencies`).

**Documentação:** `docs/components/crm-space-background.md`, `docs/components/crm-pipeline-border.md`, `docs/components/pipeline.md`, `src/app/PainelAlpha/AlphaCRM/README.md`, `CHANGELOG.md`.

**Última atualização:** 2026-08-15 por Scribe

### Alpha CRM — Pipeline Financeiro (RM-2026-DE0F7B, 2026-08-20)

**Rota de operação:** `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` — kanban com 5 colunas (Contrato → Formalização → Pagamento → Nota Fiscal → Concluídos), drag-and-drop via `@dnd-kit/core`.

**Rota de configuração:** `/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]` — botão "Aplicar pipeline financeiro" (`ConfigurarEtapasFinanceiroButton.tsx`).

**Permissões:** `auth()` + `exigirAcessoConfigPipeline` (configuração) / `exigirAcessoBpmPipeline` (operação).

**Fonte de verdade:** `src/lib/bpm/pipeline-financeiro.ts` — `FINANCIAL_STAGES` (5 etapas), `FINANCIAL_FIELDS` (40+ campos), `validateFinancialTransition`, `calcularRetencoesFinanceiras`.

**Server Actions:** `ConfigurarPipelineFinanceiro` (`src/actions/bpm/PipelineFinanceiro.ts`) — idempotente, transacional, renomeia etapas, desativa excedentes, cria campos, upsert transições, grava auditoria. `MoverCardBpm` (`src/actions/bpm/Cards.ts`) — movimentação com `validateFinancialTransition`.

**Modelo de dados:** `BpmPipeline`/`BpmEtapa`/`BpmCard`/`BpmCampo`/`BpmEtapaTransicaoPermitida` (já existentes). `BpmCard.etapaId` (FK → `BpmEtapa`) é o campo de referência de etapa. Sem migration SQL nova.

**Testes:** `tests/bpm/pipeline-financeiro.test.ts` — 5 testes.

**Editado quando:** nova etapa financeira for adicionada, campos obrigatórios mudarem, ou validação de transição for alterada.

**Última atualização:** 2026-08-20 por Scribe

---

### Alpha SEO — registro, navegação e autorização em duas camadas

**Arquivos:** `src/lib/modulos-registry.ts`, `src/app/PainelAlpha/AlphaSEO/layout.tsx`, `src/app/PainelAlpha/AlphaSEO/[projectId]/layout.tsx`, `src/components/AlphaSEO/AlphaSeoShell.tsx`, `src/lib/alpha-seo/project-access.ts`.

**Propósito:** expor o módulo no Painel Alpha e impedir que permissão global de módulo seja confundida com acesso a qualquer projeto. O registry usa `id/permission: "alphaSeo"` e `href: "/PainelAlpha/AlphaSEO"`; o layout raiz exige sessão/permissão e o layout do projeto exige owner/member ativo.

**Editado quando:** a rota, o ícone/categoria ou a permissão do módulo mudar; ou quando um novo papel/capacidade por projeto for introduzido.

**Como adicionar:** toda página sob `[projectId]` deve herdar o layout protegido e toda Action/Handler/tool que recebe `projectId` deve chamar o guard compartilhado, por exemplo `await requireAlphaSeoProjectAccess({ projectId, action: "seo:execute", minimumRole: "EDITOR" })`; não autorizar somente pela presença do ID.

**Última atualização:** 2026-08-20 por Scribe

### Alpha SEO — fachadas de Actions e serviços de domínio

**Arquivos:** `src/actions/AlphaSeo*.ts`, `src/lib/alpha-seo/`, `src/lib/alpha-seo/contracts.ts`, `src/lib/alpha-seo/operation-policy.ts`.

**Propósito:** manter as Server Actions finas (auth, Zod, erro sanitizado e revalidação) e concentrar regra de negócio, providers, idempotência e persistência nos serviços. As 16 fachadas existentes cobrem toda a superfície funcional do módulo.

**Editado quando:** uma capacidade funcional ganhar entrada pela UI, SAM ou MCP; a nova operação deve compartilhar o mesmo serviço autoritativo em vez de duplicar lógica na borda.

**Como adicionar:** siga o fluxo `UI/Action -> validação e requireAlphaSeoProjectAccess -> serviço em src/lib/alpha-seo/<domínio> -> Prisma/provider`; para operação paga, inclua estimativa/aprovação, chave idempotente e registro auditável antes da chamada externa.

**Última atualização:** 2026-08-20 por Scribe

### Alpha SEO — Route Handlers, jobs e Vercel Cron

**Arquivos:** `src/app/api/alpha-seo/`, `src/lib/alpha-seo/jobs/`, `src/lib/alpha-seo/worker.ts`, `vercel.json`.

**Propósito:** operar MCP/OAuth/API keys, OAuth Google, streaming do SAM e execução assíncrona persistente. `schedules` e `worker` executam a cada cinco minutos; `oauth-cleanup` executa às 03:17 UTC e remove em lotes limitados somente artefatos OAuth expirados/consumidos.

**Editado quando:** surgir novo tipo de job, callback OAuth ou manutenção periódica. Rotas de cron continuam protegidas por `CRON_SECRET`; jobs usam lease/fencing e devem ser retomáveis.

**Como adicionar:** registre a Route Handler sob `/api/alpha-seo`, valide auth/host/input na borda e, para cron, adicione uma entrada explícita em `vercel.json`, por exemplo `{ "path": "/api/alpha-seo/cron/<job>", "schedule": "<cron>" }`, com processamento bounded e idempotente.

**Última atualização:** 2026-08-20 por Scribe

### Alpha SEO — Prisma/Turso e gate Vault

**Arquivos:** `prisma/schema.prisma`, `docs/alpha-seo/alpha-seo-migration-candidate.sql`, `docs/alpha-seo/vault-report.md`.

**Propósito:** persistir projetos, membership, pesquisa, rankings, auditoria, OAuth, memória, SAM, MCP, jobs, custos e exports em 44 modelos `AlphaSeo*`.

**Editado quando:** qualquer tabela, coluna, índice, chave, constraint, seed/backfill ou mutação em massa Alpha SEO for proposta.

**Como adicionar:** interrompa antes da escrita, acione Vault, gere/valide backup completo com menos de 48 horas, apresente impacto/rollback e obtenha autorização explícita para o artefato exato. O lote já aplicado teve SHA-256 `acbec05894d0588ea949b4a7a8bd5d0e9fdfa6ed7462c8f201f48792c2810bef` e autorizou somente 44 tabelas + 110 índices; ele não autoriza mudanças futuras.

**Última atualização:** 2026-08-20 por Scribe

### Alpha SEO — providers e configuração server-side

**Arquivos:** `.env.example`, `src/lib/alpha-seo/config/status.ts`, `src/lib/alpha-seo/doctor.ts`, `src/lib/alpha-seo/dataforseo/`, `src/lib/alpha-seo/google/`, `src/lib/alpha-seo/ai-visibility/`, `src/lib/alpha-seo/sam/`.

**Propósito:** conectar DataForSEO, OpenRouter e Google GSC/GA4 sem expor credenciais ao client. O doctor reporta somente presença/saúde e códigos estáveis, nunca valores.

**Editado quando:** um provider, modelo ou callback mudar. As variáveis obrigatórias/alternativas devem ser documentadas apenas por nome em `.env.example`; nunca usar prefixo `NEXT_PUBLIC_` para segredos.

**Como adicionar:** leia a configuração exclusivamente no servidor, exponha à UI apenas status sanitizado (`configured`/`provider-missing`) e adicione teste de redaction. Os nomes atuais incluem `DATAFORSEO_API_KEY` ou login/senha, `OPENROUTER_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `ALPHA_SEO_GOOGLE_TOKEN_ENCRYPTION_KEY`, sem valores versionados.

**Última atualização:** 2026-08-20 por Scribe

### Alpha SEO — contrato de paridade OpenSEO

**Arquivos:** `docs/alpha-seo/source-manifest.json`, `docs/alpha-seo/parity-matrix.md`, `src/lib/alpha-seo/inventory.ts`, `src/lib/alpha-seo/mcp/registry.ts`, `src/lib/alpha-seo/skills/`, `src/lib/alpha-seo/audit/issues.ts`.

**Propósito:** impedir perda silenciosa de funções durante manutenção: 93/93 exports rastreados, 46/46 tools MCP nomeadas, 9 skills integrais e 27 issue IDs.

**Editado quando:** a fonte congelada ou qualquer registry real mudar. Números históricos divergentes são informativos e não autorizam inventar tools/skills/issues.

**Como adicionar:** atualize primeiro o registry real e seus testes; depois regenere o manifesto sanitizado com `npm run alpha-seo:inventory -- --json` e confirme ausência de drift com `npm run alpha-seo:inventory -- --check --json`. Não inclua caminhos absolutos, `.env` ou payloads/segredos no manifesto.

**Última atualização:** 2026-08-20 por Scribe

### Alpha SEO — fronteira paga, aprovações e grants Google compartilhados

**Arquivos:** `src/lib/alpha-seo/operation-policy.ts`, `src/lib/alpha-seo/dataforseo/operations.ts`, `src/lib/alpha-seo/google/oauth.ts`, `src/actions/AlphaSeoGsc.ts`, `src/actions/AlphaSeoGa4.ts`.

**Propósito:** garantir que custo e identidade externa sejam governados no servidor. Requests acima do threshold exigem aprovação persistida vinculada a projeto, usuário, operação e hash; runs concluídos são idempotentes. Um grant Google só é revogado após claim atômico que confirme ausência de consumidores do produto.

**Editado quando:** uma nova operação paga for adicionada, thresholds mudarem ou outra conexão passar a reutilizar grants Google.

**Como adicionar:** encaminhe a chamada DataForSEO por `executeAlphaSeoDataForSeo(...)` com `access`, `operation`, payload/unidades e parser; não chame o provider diretamente. Ao desconectar Google, remova primeiro a conexão e use `revokeGoogleGrantIfUnused(grantId, userId, product)`; nunca marque `revokedAt` incondicionalmente.

**Última atualização:** 2026-08-20 por Scribe

### Alpha SEO — cancelamento, disposição de jobs e mutações de auditoria

**Arquivos:** `src/app/api/alpha-seo/sam/stream/route.ts`, `src/lib/alpha-seo/sam/`, `src/lib/alpha-seo/jobs/processor-result.ts`, `src/lib/alpha-seo/jobs/queue.ts`, `src/lib/alpha-seo/worker.ts`, `src/lib/alpha-seo/audit/contracts.ts`, `src/lib/alpha-seo/audit/service.ts`, `src/components/AlphaSEO/audit/AuditResultsWorkspace.tsx`.

**Propósito:** impedir que cancelamento, lock ocupado ou conflito de estado seja interpretado como sucesso. SAM propaga abort; worker distingue `complete`/`defer`/`invalid`; auditoria separa cancelamento ativo de exclusão terminal com predicados atômicos e ressincronização visual.

**Editado quando:** um novo processor retornar `skipped`/`deferred`, uma operação streaming for criada ou o lifecycle de auditoria ganhar estado novo.

**Como adicionar:** processors devem retornar disposição explícita, por exemplo `{ skipped: true, retryable: true, delayMs }` para defer ou `{ skipped: true, terminal: true }` para conclusão terminal. Mutações de auditoria devem enviar `mode: "CANCEL" | "DELETE"`; em conflito, releia `currentStatus` e exija nova confirmação, sem retry automático da escrita.

**Última atualização:** 2026-08-20 por Scribe

### Alpha SEO — paginação, exportação integral, stale guards e erros de Action

**Arquivos:** `src/lib/alpha-seo/action-error.ts`, `src/components/AlphaSEO/shared/PaginationControls.tsx`, `src/components/AlphaSEO/shared/CompleteExportButtons.tsx`, `src/components/AlphaSEO/research/DomainResearchWorkspace.tsx`, `src/components/AlphaSEO/research/BacklinksWorkspace.tsx`, `src/components/AlphaSEO/audit/AuditResultsWorkspace.tsx`, `src/components/AlphaSEO/gsc/GscOverview.tsx`, `src/components/AlphaSEO/visibility/AiHistoryPanel.tsx`.

**Propósito:** evitar slices fixos, exports incompletos, overwrite por resposta antiga e vazamento de erro interno. Tabelas grandes paginam; export completo carrega todas as páginas dentro do limite seguro; respostas assíncronas antigas são descartadas por versão.

**Editado quando:** um dataset paginado, exportável ou atualizado de forma assíncrona for criado.

**Como adicionar:** mantenha `page/limit/totalCount/hasMore`, use `CompleteExportButtons` com loader que materializa páginas bounded e compare a versão da request antes de aplicar estado. Actions devem retornar `safeAlphaSeoActionError(error)`, não `error.message` arbitrário.

**Última atualização:** 2026-08-20 por Scribe

### Open SEO · Alpha SEO — catálogo renderizado e busca

**Arquivos:** `src/app/PainelAlpha/layout.tsx`, `src/components/layout/PainelLayoutClient.tsx`, `src/components/layout/GlobalSidebar.tsx`, `src/lib/modulos-registry.ts`, `tests/alpha-seo/integration-wiring.test.ts`.

**Propósito:** tornar o módulo visível no shell realmente usado pelo Painel Alpha. A cadeia autoritativa é layout → `PainelLayoutClient` → `GlobalSidebar`; `PainelAlphaClient.tsx` está órfão e não serve como prova de wiring.

**Editado quando:** nome público, aliases, posição/categoria, permissão ou campos pesquisáveis de um módulo mudarem.

**Como adicionar:** crie uma única entrada no `MODULOS_REGISTRY`; para Open SEO, o contrato é `{ id: "alphaSeo", label: "Open SEO · Alpha SEO", category: "comercial", permission: "alphaSeo", tag: "SEO", aliases: ["Open SEO", "Alpha SEO", "OpenSEO"] }`, posicionada como primeiro item Comercial. Confirme na `GlobalSidebar` que busca normalizada considera `label`, `id`, `tag`, `desc` e `aliases`; não valide pelo componente órfão.

**Última atualização:** 2026-08-21 por Scribe

### Catálogo de módulos — precedência autoritativa de visibilidade

**Arquivo:** `src/lib/modulos-registry.ts` (`podeVisualizarModulo`) e consumidor `src/components/layout/GlobalSidebar.tsx`.

**Propósito:** decidir fail-closed quem enxerga cada entrada do catálogo, sem divergência entre branches manuais de UI.

**Editado quando:** surgir novo tipo de restrição (`adminOnly`, role ou permission) ou um consumidor novo do registry.

**Como adicionar:** todo consumidor renderizado deve filtrar com `podeVisualizarModulo(modulo, { permissoes, role })`. Preserve a ordem: admin bypassa; `adminOnly` retorna somente role explicitamente permitida; depois vale `allowedRoles`; depois `permission`; só então um item sem permissão e sem roles é irrestrito. Casos mínimos de regressão: `gestaoOnboarding` nunca aparece para `User` e `cadastro` não aparece para `User` mesmo que receba a string de permissão `cadastro`.

**Evidência/estado operacional:** Forge 161/161, Probe com casos de render/busca e Lens PASS. O módulo consta no `HEAD`/`origin/main` `c2979beb6`, mas deploy não foi verificado; a correção final de precedência e seu teste reforçado ainda estão no working tree e dependem de DevOps autorizado para publicação.

**Última atualização:** 2026-08-21 por Scribe

## Roadmap Alpha — identidade de "objetivo de módulo novo" é campo estrutural, nunca inferida de texto livre (2026-08-25)

**Padrão arquitetural a seguir em todo o projeto:** nunca inferir a identidade/tipo de um registro a partir do CONTEÚDO de um campo de texto livre editável pelo usuário — sempre que um registro precisa de um "tipo" ou "categoria" que outras partes do sistema dependem para tomar decisões (UI, workers, validação), esse tipo precisa ser um campo persistido explícito no schema, setado uma vez no momento da criação, nunca recalculado a partir de heurística de texto.

**Caso real que motivou a regra:** `RoadmapObjective` tinha uma função `isNovoModuloObjective(constraints)` que determinava se um objetivo era "cria um módulo novo do PainelAlpha" checando se o campo `constraints` (texto livre) CONTINHA um texto mágico fixo. Isso quebrava assim que o usuário editava as restrições — uso legítimo e até incentivado pela própria UI ("Ajuste se necessário, mas não remova os passos de integração"). O sinal era consumido em 2 lugares distintos e desconectados: `EditObjectiveDialog` (decide se mostra o campo "Projeto") e `worker.ts` (decide o comportamento do Qwen ao documentar) — os dois quebravam juntos, silenciosamente, assim que o texto era editado.

**Fix aplicado:** campo estrutural `RoadmapObjective.isNewModule Boolean @default(false)` (migration real em produção, ver `known-errors.md` para o passo a passo técnico). Setado explicitamente em `createRoadmapObjective` no momento da criação (vindo de `novoModuloPreset` da UI), nunca inferido depois. `updateRoadmapObjective` bloqueia estruturalmente qualquer tentativa de mudar `moduleKey` quando `current.isNewModule === true` — e o campo nunca é escrito a partir do input do usuário na edição (só lido do banco), fechando o vetor de um payload forjado tentar contornar a regra.

**Onde verificar antes de reintroduzir esse antipadrão:** se um objetivo/registro futuro precisar de um "modo especial" que muda o comportamento de mais de um consumidor (UI + worker/backend), procure primeiro se já existe um campo estrutural — não crie uma segunda heurística baseada em conteúdo de texto/nome/formato. `grep` por `.includes(` sobre campos de texto livre é um bom jeito de achar candidatos a esse antipadrão já existentes no código.

**Última atualização:** 2026-08-25 por Scribe

### Roadmap Alpha — conexão MCP do Codex

**Arquivos:** `.codex/config.toml`, `mcp/roadmap-status` e `.mcp.json` (somente referência; configuração Claude preservada).

**Propósito:** conectar o Codex ao status do Roadmap pelo servidor project-scoped `roadmap_status_codex`, reutilizando a implementação MCP já existente e mantendo o Claude conectado de forma independente.

**Editado quando:** mudar o comando/entrada do servidor MCP, os nomes das variáveis de ambiente ou o contrato de autenticação do Roadmap.

**Como adicionar/manter:** configure `roadmap_status_codex` em `.codex/config.toml`; forneça os valores por variáveis de ambiente User do Windows, sem versionar segredos, usando uma `RoadmapApiKey` dedicada ao Codex; depois recarregue o Codex para herdar o novo ambiente. Não altere `.mcp.json` nem compartilhe a chave do Claude. Esta integração não requer menu, rota, permissão ou atalho novos.

**Última atualização:** 2026-08-26 por Scribe
### Checklist Builder — entrada administrativa preparada

**Caminho:** `/PainelAlpha/AlphaCRM` → `Configurações` → ação `Checklists` em `AdminPipelinesListClient.tsx` → `/PainelAlpha/AlphaCRM/admin/checklists`.

**Proteção:** a página chama `auth()` e aplica `isAdminRole` antes de renderizar. O shell não consulta banco nem importa actions de checklist enquanto a estrutura aditiva não passar pelo Vault.

**Próxima integração:** após schema/actions, substituir o estado informativo pelo workspace funcional e montar `PainelChecklistsCard` no `CardOpenFormSlot.tsx`, inclusive abaixo de `PainelReuniao` no ramo especial `Agendar Reunião`.

**Última atualização:** 2026-09-04 por Nova (RM-2026-209DB4)

### Regras Financeiras — CRM/BPM → Comissões

**Caminho:** `Configurações → Regras Financeiras` grava versões tributárias em `BpmRegraVersao`. `executarMovimentoComRequisitos` relê a regra dentro da transação, mescla os valores submetidos no mesmo movimento e persiste campos automáticos/memória antes de mover o card. Após commit, `sincronizarComissoesDoCardFinanceiro` faz upsert idempotente de `CommissionEvent` por card/pagamento e o gerador consome somente `CommissionRuleVersion` publicada e vigente para eventos `alpha-bpm`.

**Proteções:** sessão/permissão administrativa nas configurações, ownership na consulta do card, fórmulas sem `eval`, validação de campos dinâmicos no mesmo pipeline, campos automáticos protegidos também no servidor e falha do subsistema de comissão isolada após o movimento.

**Última atualização:** 2026-09-04 por Codex (RM-2026-002817)
## SLA BPM — motor temporal (RM-2026-095B40, Fase 2)

- **Produtor operacional:** `MoverCardBpm` chama `sincronizarSlaMovimentoBpm` dentro da transação que persiste `BpmCard.etapaId`; conclui instâncias da etapa anterior, provisiona a configuração `ENTRADA_ETAPA` de destino e pausa/retoma instâncias ao entrar/sair de `Standby - Follow Up`.
- **Leitura autoritativa:** `ObterStatusSlaCard` e `ObterStatusSlaTarefa` aplicam auth + ownership e recalculam pelo relógio atual; futuros badges do Kanban/modal devem consumir essas actions, sem duplicar cálculo no client.
- **Sem UI nesta fase:** o caminho visual permanece pendente da fase de indicadores; não existe componente SLA novo.
# SLA administrativo — RM-2026-095B40

**Caminho:** `/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]` → `AdminPipelinePage` carrega `ListarConfiguracoesSlaBpm` + `getServicosComerciais` → `AdminPipelineClient` → `SlaConfigSection` → `SlaConfigForm` → `SalvarConfiguracaoSlaBpm`.

**Segurança:** a rota exige papel administrativo; cada Server Action repete `exigirAcessoConfigPipeline(..., "configurarSla")`; o save valida etapa/serviço e ownership novamente dentro da transação. Configurações com instâncias só podem ser desativadas, evitando apagar auditoria.

## Motor Central de Automações — caminho completo

`Server Action BPM` → `publicarEventoBpm(..., tx)` → `BpmEventoDominio` →
`/api/bpm/jobs/automacoes` → materialização idempotente →
`executarLoteAutomacoesCentrais` → claim/lease → grafo validado → passo/agenda
persistido → efeito no domínio ou adaptador legado.

Entradas externas seguem
`POST /api/bpm/webhooks/[slug]` → autenticação/deduplicação/sanitização → outbox.
Operação humana segue `/PainelAlpha/AlphaCRM/automacoes` ou
`npm run bpm:automacoes -- status|run|retry`. O executor legado filtra
`automacaoVersaoId = null`, evitando que o mesmo job seja processado pelos dois
runtimes.

**Última atualização:** 2026-09-04 por Codex (RM-2026-D100EB)

### Card nativo — Checklist e Anotação no painel esquerdo (RM-2026-B7694F)

**Caminho:** `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → card nativo → `CardFullViewModal` → `CardAbertoLayout` → `PainelHistorico`.

**Composição:** abas visíveis Tarefas, Checklist, Etapas concluídas, Anexos, Histórico e Cadências. `PainelChecklistsCard` tem uma montagem com `forceMount`; o evento de pendências abre essa aba e foca o item. `EditorAnotacaoCard` é o rodapé irmão do scroll. Timeline conserva conteúdo, componente e action, sem acionador visível.

**Última atualização:** 2026-09-05 por Nova (RM-2026-B7694F)

### SLA operacional e Motor Central — RM-2026-095B40

**Produção:** `Cards.ts` e `Tarefas.ts` chamam o domínio SLA dentro das transações dos eventos reais. `sla.ts` grava transição + `BpmSlaEventoLog` + trava `BpmSlaDisparo` + evento `SLA_STATUS_ALTERADO` atomicamente.

**Consumo visual:** a listagem do pipeline consulta `obterStatusSlaCards` em lote; o modal usa `ObterStatusSlaCard`. O realtime reconhece `SLA_STATUS_ALTERADO` para atualizar as superfícies abertas.

**Automação:** `eventos.ts` materializa versões ativas cujo gatilho é `SLA_STATUS_ALTERADO` e cujo filtro opcional `slaStatus` corresponde ao valor novo. A unicidade de disparo e da outbox impede duplicação em leitura repetida, retry ou concorrência.
