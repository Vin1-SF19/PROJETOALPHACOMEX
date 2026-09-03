# CODEBASE MAP — Mapa Estrutural do Projeto

> Mantido por: Scribe (cartógrafo)
> Atualizar após TODA sessão significativa de desenvolvimento.
> Última atualização: 2026-08-29 (Gerador de Documentos — Contratante/Contratada + Qualificação, Parte 1)

---

## Alpha CRM/BPM — aba Automações (RM-2026-35A772, 2026-09-02)

- `src/app/PainelAlpha/AlphaCRM/automacoes/page.tsx` e `src/components/bpm/automacoes/` — workspace global por pipeline/coluna e formulários dinâmicos.
- `src/actions/bpm/Automacoes.ts` — listagem, CRUD, status, duplicação e templates, sempre sob autorização administrativa.
- `src/lib/bpm/automacoes/{schemas,placeholders,fila,executor}.ts` — contratos, interpolação, fila idempotente, gatilho temporal e dispatch das três ações.
- `src/actions/bpm/Cards.ts` — hook pós-commit do movimento manual; falha da fila é isolada do movimento.
- `src/app/api/bpm/jobs/automacoes/route.ts` e `vercel.json` — worker autenticado por `CRON_SECRET`, agendado a cada cinco minutos.
- `prisma/migrations/20260902185000_add_bpm_automacoes/migration.sql` — tabelas `BpmAutomacao` e `BpmAutomacaoExecucao`.
- `tests/bpm/automacoes*.test.ts` — 14 casos direcionados.

---

## Gerador de Documentos — Contratante/Contratada + Qualificação (2026-08-29, Parte 1 de 2)

**Arquivos tocados:**
- `prisma/schema.prisma` — model `EmpresaContratada` novo; `DocumentoGerado.clienteId`/`empresaContratadaId`/`pdfUrl` (nullable, aditivo)
- `src/lib/gerador-documentos/ownership.ts` — `getSessaoGeradorDocumentos()` novo (fonte única de sessão para o módulo)
- `src/lib/gerador-documentos/schemas.ts` — `EmpresaContratadaSchema`, `AtualizarEmpresaContratadaSchema`, `GerarDocumentoSchema` estendido
- `src/actions/gerador-documentos.ts` — `BuscarClientesParaContratante()` novo, `GerarDocumento` persiste vínculos
- `src/actions/empresas-contratadas.ts` (novo) — CRUD completo + consulta Receita Federal
- `src/components/GeradorDocumentos/ModalNovaEmpresaContratada.tsx` (novo)
- `src/components/GeradorDocumentos/GerarDocumentoForm.tsx` — reescrito com seletores de contratante/contratada
- `tests/gerador-documentos/{schemas,empresas-contratadas,buscar-clientes-contratante,ownership}.test.ts`

**Pendência consciente:** geração de PDF real (item 4 do pedido original do usuário) NÃO implementada nesta parte — `pdfUrl` existe no schema mas não é populado ainda. Fica para a Parte 2.

Ver detalhe completo em `architecture.md`.

---

## Gerador de Documentos — criação de template via upload (RM-2026-93645F, 2026-08-29)

**Arquivos tocados:**
- `prisma/schema.prisma` — `DocumentoTemplate.arquivoOrigemUrl`/`arquivoOrigemNome` (nullable, aditivo)
- `src/lib/gerador-documentos/schemas.ts` — `IdentificacaoTemplateSchema` novo
- `src/lib/gerador-documentos/onyx.ts` — `identificarVariaveisEClasulasViaIA()` novo (+ `extrairJson()` privada)
- `src/actions/gerador-documentos.ts` — `CriarTemplateViaUpload()` novo, `persistirNovoTemplate()` extraído como helper reaproveitado por ela e por `CriarTemplateDocumento`
- `src/components/GeradorDocumentos/NovoTemplateDialog.tsx` — reescrito integralmente (upload-only, drag-and-drop)
- `src/components/GeradorDocumentos/GeradorDocumentosClient.tsx` — `onCriado` virou `() => void` + `router.refresh()` (antes montava `TemplateResumo` manualmente no client)
- `src/components/GeradorDocumentos/TemplateDetalheClient.tsx` — CRUD de variáveis novo (antes só cláusulas)
- `tests/gerador-documentos/{schemas,onyx-identificacao,criar-template-via-upload}.test.ts` — novo/expandido, 24 testes

**Padrão reaproveitável:** upload → `extractTextFromBuffer` (extração) → IA (Onyx, JSON estrito parseado por Zod) → persistência transacional. Se outro módulo precisar de "documento vira dado estruturado via IA", este é o precedente a seguir — inclusive o padrão de teste (mock de `createChatSession`/`sendChatMessageStream` com stream NDJSON sintético).

Ver detalhe completo em `architecture.md`.

---

## Alpha CRM — Card fechado: Razão Social + Nome Fantasia + CNPJ sem duplicação (RM-2026-6BAAB8, 2026-08-28)

**Único arquivo tocado:** `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` (`KanbanCard`) — mesmo componente que renderiza o card fechado em **todos** os pipelines do CRM (confirmado único consumidor via grep, sem duplicação de layout).

**Estado anterior:** título usava `nomeEmpresa = razaoSocial || nomeFantasia || ""` (fallback correto), mas a linha secundária mostrava `nomeFantasia` sempre que existisse — mesmo quando `nomeFantasia` já era o próprio texto do título (empresa sem `razaoSocial`), duplicando visualmente o mesmo nome.

**Correção:** nova constante `nomeFantasiaSecundario = nomeFantasia && nomeFantasia !== nomeEmpresa ? nomeFantasia : null` — a linha secundária agora só mostra Nome Fantasia quando ele é distinto do título. `cnpjFormatado` (via `formatCNPJ`, `src/lib/format-cnpj.ts`, máscara `00.000.000/0000-00`) inalterado, sempre exibido quando existir. Hierarquia tipográfica reaproveitada sem tokens novos: título `text-sm font-semibold`, Nome Fantasia `text-[11px] font-medium text-slate-400`, CNPJ `text-[10px] font-mono text-slate-500`.

**Limitação conhecida e aceita:** a comparação `nomeFantasia !== nomeEmpresa` é estrita — não normaliza espaço/case. Se um dia um cadastro tiver `nomeFantasia` quase-idêntico a `razaoSocial` (diferença só de espaço/maiúscula), duplicaria visualmente. Não normalizado propositalmente (fora do escopo pedido, cenário raro em dados reais).

**Última atualização:** 2026-08-28 por Scribe (execução via Roadmap Production)

---

## Parceiros — Indicação com serviço + posicionamento automático no pipeline (2026-08-26, RM-2026-97934A)

- **`src/actions/parceiros.ts` → `criarIndicacao`:** assinatura mudou de `(parceiroId, clienteId)` para `(input: { parceiroId, clienteId? | novaEmpresa?, servicoIndicado })`. Agora cria a `Indicacao` E já direciona ao closer automaticamente na mesma operação (antes eram 2 passos: `criarIndicacao` + `DirecionarIndicacaoParaCloser` manual, que nunca tinha botão de UI). Usa dynamic import de `./parceiros-indicacoes`, `@/lib/bpm/ownership` e `./bpm/Cards` para evitar ciclo de import.
- **`src/lib/bpm/ownership.ts` → `resolverResponsavelAutomaticoBpm(pipelineId, preferidoUserId?)`:** novo helper para atribuir responsável de um `BpmCard` sem exigir escolha manual. Preferência: `preferidoUserId` se elegível (via `usuarioElegivelResponsavelBpm`); fallback: primeiro usuário ativo elegível do pipeline, determinístico por `id asc`. Retorna `null` se ninguém for elegível — chamador deve tratar como erro de configuração (não criar card sem responsável).
- **`src/actions/bpm/Cards.ts` → `CriarCardBpm`:** aceita `servico?: string` no payload (via `criarCardSchema` em `src/lib/validations/bpm.ts`). Quando informado, usa esse valor; senão mantém o fallback histórico (nome do pipeline de destino). Não quebra nenhum caller existente do BPM.
- **`src/actions/parceiros-indicacoes.ts`:** `obterEtapaNovosLeadsPipelineIndicacoes` agora exportada (antes privada). Nova `direcionarIndicacaoParaCloserAutomatico` — só grava o histórico do parceiro (`ParceiroHistorico`), já que o `BpmCard`/`Indicacao.bpmCardId` são resolvidos por `criarIndicacao`. `DirecionarIndicacaoParaCloser` (fluxo manual original) mantida intacta mas confirmada como código morto (zero callers).
- **`Indicacao.servicoIndicado` (String?, aditivo):** produto/serviço indicado, texto livre — reaproveita o catálogo `SERVICOS_COMERCIAIS_PADRAO` (`src/lib/comercial/servicos.ts`) + `getServicosComerciais()` (`src/actions/ContratoComercial.ts`), mesmo merge usado em `ModalGerenciamentoLeads.tsx` (Alpha Metas). Nunca foi/é enum real no projeto — mesmo padrão de `BpmCard.servico`/`ContratoComercial.servico`.
- **`src/components/Parceiros/ModalNovaIndicacao.tsx`:** ganhou toggle "empresa existente / cadastrar nova" (CNPJ/razão social/nome fantasia/UF/município, reaproveitando o schema `novaEmpresaCardSchema` do BPM) e campo "3. Serviço indicado" (select). Interface pública do componente (`open`/`onClose`/`onDone`/`accent`) preservada — já integrado em `ParceirosClient.tsx:600`, botão de entrada em `ParceirosClient.tsx:482`.
- **Padrão de auto-atribuição de responsável:** primeiro uso deste padrão no projeto (nenhum outro fluxo do BPM tinha atribuição automática antes — sempre exigia escolha manual). Se outro módulo precisar de "criar card sem pedir responsável", reaproveitar `resolverResponsavelAutomaticoBpm` em vez de reimplementar.

**Última atualização:** 2026-08-26 por Scribe

---

## Parceiros — Card de Aquisição alinhado ao padrão visual do CRM (2026-08-26, RM-2026-3F263C)

- **Arquivo tocado:** `src/components/Parceiros/Aquisicao/AquisicaoParceirosClient.tsx` (único arquivo — sem novo componente, sem novo arquivo).
- **Card do Kanban de Aquisição** (dentro de `KanbanColuna`) passou a reaproveitar `GradientBlobCard` (`src/components/ui/gradient-blob-card.tsx`) como shell — mesmo componente já usado pelo `KanbanCard` do Alpha CRM (`PipelineBoardClient.tsx`). Antes era um `<button>` com `style` inline duplicando visual parecido.
- **Estrutura do card** (ordem): avatar/inicial do lead + nome + segmento/UF → divisor `border-t border-white/[0.06]` → potencial (estrelas, `PotencialBadge`) + badge de urgência da próxima ação (`BadgeProximaAcao`) → responsável (se houver).
- **Badge de urgência novo:** `calcularUrgenciaProximaAcao`/`BADGE_URGENCIA_CLASSNAME`/`BadgeProximaAcao` — cópia adaptada do algoritmo já em produção no CRM (`calcularUrgenciaProximoContato`, `PipelineBoardClient.tsx`), 3 estados por cor (ATRASADO vermelho, HOJE âmbar, FUTURO verde), comparação de data fixada em `America/Sao_Paulo`.
- **Deliberadamente NÃO trazido do CRM** (fora do escopo confirmado pelo usuário): drag-and-drop (`@dnd-kit` — o Kanban de Aquisição continua usando o padrão clique→dialog→seletor, que é o mesmo padrão real que o próprio Kanban do CRM usa por trás da aparência, apesar de ter `@dnd-kit` instalado), contagem de tarefas/anexos, bloco de métricas "novos leads" — nenhum tem equivalente no domínio de Aquisição.
- **Dependência de design system:** `GradientBlobCard` já documentado como shell padrão de card de Kanban do painel — este é o segundo Kanban a usá-lo (CRM e agora Aquisição de Parceiros), reforçando-o como o token de card de Kanban do projeto.

**Última atualização:** 2026-08-26 por Scribe

---

## Parceiros — Kanban de Relacionamento (Desenvolvimento) (2026-08-26, RM-2026-2C7A4B)

- **8º estágio:** `EM_REATIVACAO` adicionado a `ESTAGIOS_DESENVOLVIMENTO` (`src/lib/parceiros/desenvolvimento.ts`) — estado transitório de reingresso. `ReativarParceiro` (`parceiros-desenvolvimento.ts`) deixou de decidir o destino final no mesmo clique: agora move `INATIVO→EM_REATIVACAO`, e o destino real é resolvido por uma indicação real (`sincronizarEstagioAposIndicacao`) ou movimento manual no Kanban.
- **Máquina de estados nova:** `podeMoverEstagioParceiro(atual, destino)` (função pura, `desenvolvimento.ts`) — adaptada de `podeMoverPara` do Kanban de Aquisição. Sequência produtiva linear (`NOVO→EM_ATIVACAO→ATIVADO_SEM_INDICACAO→PRIMEIRA_INDICACAO→ATIVO→RECORRENTE`) só avança 1 posição por vez ou corrige livremente pra trás; `INATIVO`/`EM_REATIVACAO` são estados especiais fora da sequência (mesmo espírito das "saídas laterais" do Kanban de Aquisição). Validada tanto no backend (`MoverEstagioParceiro`) quanto coberta por 8 testes exaustivos.
- **Campo novo:** `Parceiro.proximaAcaoEm`/`proximaAcaoDescricao` (migration `20260826184500_add_parceiro_proxima_acao`) — mesmo padrão já usado em `ParceiroLead` (Aquisição). `ListarFilaFollowUpParceiros` (`parceiros-dashboard.ts`) passou a usar o valor real, removendo um hardcode `null` documentado desde a entrega original do Dashboard.
- **Backend novo:** `MoverEstagioParceiro`, `RegistrarProximaAcaoParceiro`, `ListarParceirosParaKanban` (`src/actions/parceiros-desenvolvimento.ts`).
- **Frontend novo:** `KanbanRelacionamentoParceiros.tsx` (`src/components/Parceiros/Relacionamento/`) + rota `/PainelAlpha/Parceiros/Relacionamento` — mesmo padrão visual/técnico do Kanban de Aquisição (clique no card → dialog → seletor de destino; NÃO drag-and-drop, apesar da aparência). `Relacionamento360Section.tsx` ganhou UI de registro de próxima ação. `ParceirosClient.tsx` ganhou filtro por estágio (backend já suportava via `FiltrosParceirosExtra`) + link para o Kanban.
- **Achado de revisão corrigido:** o Kanban recebia `permissao` sem usar — dialog de edição aparecia para qualquer usuário, mesmo sem `podeEditar` (backend já protegia, mas UX inconsistente com o Kanban de Aquisição). Corrigido envolvendo as seções de edição em `{podeEditar && (...)}`.

**Última atualização:** 2026-08-26 por Scribe

---

## Parceiros — Tarefas manuais e automáticas por alerta (2026-08-26, RM-2026-8B7DC7)

- **Model novo:** `ParceiroTarefa` (`prisma/schema.prisma`, migration `20260826173000_add_parceiro_tarefa`) — tarefa vinculada a `Parceiro` (FK cascade), com `titulo`/`descricao`/`responsavelId`/`prazo`/`prioridade` (BAIXA|NORMAL|ALTA)/`status` (PENDENTE|CONCLUIDA)/`origemAutomatica`/`alertaOrigemTipo`. Espelha `BpmTarefa` (CRM) na paleta visual, mas é um model independente — `BpmTarefa` está amarrada a `cardId` (BpmCard) como FK obrigatória, incompatível com o domínio de Parceiro.
- **Campo novo:** `ParceiroConfig.gerarTarefaAutomaticaAlertas` (Boolean, default `false`) — liga/desliga a geração automática, Admin-only via `AtualizarRegrasParceiros`.
- **Backend:** `src/actions/parceiros-tarefas.ts` (novo) — `CriarTarefaParceiro`/`ListarTarefasParceiro`/`ConcluirTarefaParceiro`/`ExcluirTarefaParceiro`, RBAC igual ao resto do módulo (`getCtx()` de `parceiros.ts`). Geração automática idempotente em `gerarTarefasAutomaticasDeAlertas` (`src/actions/parceiros-dashboard.ts`), chamada ao final de `ListarAlertasParceiros` — chave lógica `parceiroId+alertaOrigemTipo+status=PENDENTE` evita duplicar tarefa a cada refresh do dashboard.
- **Frontend:** `DashboardParceirosClient.tsx` (aba Alertas: botão "Criar tarefa"/badge "Tarefa criada"; aba Fila: coluna de contagem de tarefas pendentes), `ConfiguracoesParceirosClient.tsx` (toggle da automação), `ParceiroTarefasSection.tsx` (novo componente — lista de tarefas na tela 360º do parceiro, criar/concluir/excluir inline).
- **Achado de processo relevante:** o "Painel Gerencial e Alertas" pedido no objetivo original já existia (entregue 1-2 dias antes) — a Fase 0 (auditoria) evitou reconstrução redundante, e o trabalho real ficou concentrado só na integração de Tarefas.

**Última atualização:** 2026-08-26 por Scribe

---

## Roadmap Alpha — MCP Codex project-scoped (2026-08-26)

- **Configuração:** `.codex/config.toml`, exclusiva deste projeto, registra o servidor `roadmap_status_codex`.
- **Implementação reutilizada:** `mcp/roadmap-status`; não foi criado um segundo servidor de domínio.
- **Credenciais:** nomes de variáveis são lidos do ambiente **User** do Windows, sem segredos versionados. O Codex usa uma `RoadmapApiKey` dedicada.
- **Coexistência:** o MCP do Claude permanece em `.mcp.json`, sem alteração; ambos acessam o mesmo domínio do Roadmap por configurações independentes.
- **Ativação:** depois de definir as variáveis User, é necessário recarregar/reiniciar o Codex para o processo herdar o ambiente.
- **Wiring de produto:** integração de agente, sem novo menu, rota, permissão ou atalho no Painel Alpha.

**Última atualização:** 2026-08-26 por Scribe

---

## Alpha CRM — Correção do form de adição de card (RM-2026-54DC86, 2026-08-26)

**Objetivo:** remover o campo "serviço" do form de criação de card (redundante — o pipeline já define o serviço) e corrigir a busca de empresa por CNPJ (normalização).

### Componente de form

- **Caminho:** `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx` (285 linhas)
- **Único ponto de entrada** para criação de card em qualquer pipeline (Radar, Revisão de Radar, Financeiro, etc.)
- **Rota de acesso:** `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → board Kanban → botão "Novo Card" numa coluna

### Campos do form (após correção)

| Campo | Binding | Observação |
|-------|---------|------------|
| **Empresa (busca)** | `buscaEmpresa` → `BuscarEmpresasBpm` | Busca textual em `razaoSocial`/`nomeFantasia`/`cnpj`; CNPJ normalizado (dígitos puros) antes da query |
| **Empresa (cadastro) — CNPJ** | `novaEmpresa.cnpj` | `aria-label="CNPJ"`, formatado por `formatarCnpjInput()`, enviado como dígitos puros |
| **Empresa (cadastro) — Razão social** | `novaEmpresa.razaoSocial` | Obrigatório no modo cadastro |
| **Empresa (cadastro) — Nome fantasia** | `novaEmpresa.nomeFantasia` | Opcional |
| **Empresa (cadastro) — Município / UF** | `novaEmpresa.municipio` / `novaEmpresa.uf` | Opcionais |
| **Responsável** | `responsavelId` | Obrigatório, seletor via `ListarUsuariosResponsavelBpm` |
| ~~**Serviço**~~ | **REMOVIDO** | Campo removido do form, do payload e do schema Zod. Serviço agora derivado do pipeline. |

### Fluxo de dados (form → banco)

```
NovoCardModal.tsx (Client Component)
  │
  ├─ [Modo Busca] buscaEmpresa → BuscarEmpresasBpm (CNPJ normalizado)
  ├─ [Modo Cadastro] novaEmpresa.cnpj → GET /api/ReceitaFederal (preenche campos)
  │
  └─ handleSalvar() → payload: { empresaId | novaEmpresa, pipelineId, etapaId, responsavelId }
       │
       ▼  onCriado(payload) = CriarCardBpm
  ┌─────────────────────────────────────────────────────────────────┐
  │ CriarCardBpm (Server Action — src/actions/bpm/Cards.ts ~L568)  │
  │  1. auth() + exigirAcessoBpmPipeline                           │
  │  2. criarCardSchema.safeParse (Zod — sem `servico`)            │
  │  3. destinoEhEtapaCanonicaNovosLeads                           │
  │  4. Se novaEmpresa: valida CNPJ único                          │
  │  5. db.$transaction:                                           │
  │     a. Revalida acesso + destino + responsável                │
  │     b. Se novaEmpresa: tx.cliente.create({cnpj, ...})         │
  │     c. tx.bpmCard.create({                                     │
  │          empresaId, pipelineId, etapaId, responsavelId,        │
  │          servico: bpmPipeline.nome  ◄── DERIVADO DO PIPELINE   │
  │        })                                                      │
  │     d. tx.bpmCardMembro.create (RESPONSAVEL)                  │
  │     e. tx.bpmCardHistorico.create (CARD_CRIADO)               │
  │  6. revalidatePath + notificarPipelineBpm (realtime)          │
  └─────────────────────────────────────────────────────────────────┘
```

### Arquivos alterados nesta correção

| Arquivo | Alteração |
|---------|-----------|
| `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx` | Removido: state `servico`, input `#novo-card-servico`, `servico` do payload |
| `src/lib/validations/bpm.ts` | `criarCardSchema`: removido `servico` do schema Zod (comentário RM-2026-54DC86) |
| `src/actions/bpm/Cards.ts` | `CriarCardBpm`: `servico` derivado de `bpmPipeline.nome`; `BuscarEmpresasBpm`: CNPJ normalizado na busca |

### Notas

- `bpmCard.servico` é **nullable** (`String?`) — cards já criados com valor continuam exibindo no board.
- `atualizarCardSchema` (edição de card existente) **mantém** `servico` — edição é caso distinto de criação.
- O form é **único e compartilhado** — a correção afeta todos os pipelines simultaneamente.

---

## Alpha Motion (Apresentações) — Ocultar slide + Compartilhar + listagem por dono (2026-08-24)

Ver `.bibble/memory/integration-points.md` para o detalhe completo dos 3 itens. Resumo estrutural:

- **`Slide.oculto Boolean @default(false)`** (`prisma/schema.prisma`) — coluna nova, migration aditiva aplicada em produção (Vault). Soft-hide estilo Canva: nunca exclui, só filtra de leituras públicas.
- **`AlternarVisibilidadeSlide`** (`src/actions/slides.ts`) e **`CompartilharApresentacao`** (`src/actions/apresentacoes.ts`) são as duas Server Actions novas.
- **`CompartilharApresentacao` é o primeiro precedente real no projeto de "compartilhar = cria cópia independente"** (distinto de link público `slugPublico` e de colaboração `ApresentacaoColaborador`) — candidato a padrão de referência se outro módulo (Blueprint, Notas, etc.) um dia precisar de algo parecido.
- **`ListarApresentacoes` não usa mais bypass de Admin** — primeira vez no módulo que Admin/CEO fica sujeito ao mesmo filtro de um usuário comum numa listagem (decisão explícita do usuário, não uma omissão).
- Pipeline de qualidade completo rodou nesta sessão: Scout → Vault (backup+migration) → Forge (tsc/lint/build) → Probe (integração) → Anubis (segurança, 0 críticos) → Lens (qualidade, aprovado) → Sage (edge cases por análise de código, sem regressão).

---

## Roadmap Alpha — Produção local (`src/lib/roadmap-production/`)

**⚠️ Achado arquitetural importante, não documentado antes:** o estado de execução da Produção (config, fila, execuções, `developmentProvider` por objetivo, `autoRun`) **NÃO é Prisma** — é um conjunto de arquivos JSON validados por Zod em `.roadmap-production/` (dentro do `root`, por padrão `process.cwd()`):

```
.roadmap-production/
├── config.json                              # ProductionConfig (provider global de infra, model, autoRun, maxToolSteps)
├── state.json                               # ProductionState (executions[], ignoredExecutionIds[])
├── objective-development-providers.json     # preferência de developmentProvider POR OBJETIVO
└── commands/                                # fila de comandos de controle (PAUSE/RESUME/RETRY/EXCLUDE/REPORT_ERROR/APPROVE), 1 arquivo por comando
```

Lido/escrito exclusivamente via `src/lib/roadmap-production/storage.ts` (`readProductionConfig`, `readProductionState`, `readObjectiveDevelopmentPreferences`, `enqueueProductionControl` etc.), todas as funções aceitam `root` parametrizável (hoje sempre `process.cwd()` na prática, mas a assinatura já suporta outro diretório — relevante para uma futura Frente "Sistemas Externos"/multi-workspace).

**Só é Prisma de verdade:** `RoadmapObjective`, `RoadmapDocumentationJob`, `RoadmapDocumentationAttempt`, `RoadmapPromptArtifact` — a parte de **documentação** (Qwen gera os prompts). A parte de **produção/execução** (quem roda o quê, com qual IA, em qual status) é só arquivo.

**Consequência prática:** mudanças em `developmentProviderSchema`, `productionExecutionStatusSchema`, `productionControlCommandSchema` (todos em `src/lib/roadmap-production/contracts.ts`) são mudanças de contrato Zod, **não acionam o Vault** — Vault só entra se algo tocar `prisma/schema.prisma` de verdade (ex.: uma futura tabela `RoadmapWorkspace` para multi-projeto).

### Cérebro de desenvolvimento — trio Claude/Codex/Qwen (2026-08-19)

`developmentProviderSchema` (`contracts.ts`) é `z.enum(["claude","codex","ollama"])`. Antes só existia o par claude/codex; Qwen (`"ollama"`) já era usado internamente para roteamento automático de tarefas básicas/diagnóstico via heurística de conteúdo (`selectProductionExecutionEngine` em `providers.ts`), mas nunca era uma escolha explícita do usuário para fases de EXECUTION (engenharia).

Agora o usuário escolhe o cérebro preferido por objetivo (`CreateObjectiveDialog`/`EditObjectiveDialog` em `RoadmapDashboard.tsx`, 3 botões). `developmentProviderOrder()` (`worker.ts`) monta a ordem de fallback de 3 níveis: `[preferido, ...os outros dois em ordem fixa]`. `runDevelopmentAgentWithFallback` tenta cada um; quando o preferido é Qwen e ele falha/escala (`requiresCapabilityEscalation`), o fallback pula direto para `["claude","codex"]` via parâmetro `providersOverride`, sem re-tentar Qwen. Se `ROADMAP_QWEN_MODEL` não estiver configurado com um modelo `qwen3.8*`, a tentativa de Qwen é pulada (com `activity` registrada) e o fallback segue para o próximo provider.

**Não confundir com o `SettingsDialog`** (config global de qual CLI usar como padrão — Claude Code CLI ou Codex CLI): esse continua **intencionalmente rejeitando `"ollama"`** (`SalvarConfiguracaoRoadmapProduction` em `src/actions/RoadmapProduction.ts` lança `PROVIDER_NOT_READY` se `input.provider === "ollama"`). Qwen só é selecionável como preferência **por objetivo**, nunca como provider de infraestrutura global do worker.

### Gate de aprovação obrigatória (2026-08-19)

Antes, com `config.autoRun === true`, uma execução nascia com `status: "PENDING"` e o worker (`processNextProductionPhaseUnlocked`) já podia selecioná-la e rodar a próxima fase sem qualquer intervenção humana.

Agora **toda** execução nasce com `status: "AWAITING_APPROVAL"` (`syncProductionExecutions`, `worker.ts`) — nunca mais nasce diretamente executável. `selectNextProductionExecution`/`nextReadyPhase` só consideram execuções em `["PENDING","RUNNING"]`, então uma execução `AWAITING_APPROVAL` fica automaticamente fora da fila do worker, mesmo com `autoRun` ligado. `autoRun` continua existindo, mas agora só controla se o worker faz polling automático da fila — deixou de ser um bypass do gate de aprovação.

Liberação: novo comando de controle `"APPROVE"` (`productionControlCommandSchema`), processado em `applyProductionControls` — só transiciona `AWAITING_APPROVAL → PENDING` (guard explícito, ignora silenciosamente se a execução já estiver em outro status). Nova Server Action `AprovarExecucaoRoadmapProduction` (`src/actions/RoadmapProduction.ts`), mesma auth dos demais controles (`requireRoadmapProductionAccess(true)`). Novo botão "Aprovar e iniciar" em `RoadmapProductionPanel.tsx`, visível só quando `canManage && execution.status === "AWAITING_APPROVAL"`.

### Frente 3 — "Novo módulo" e Frente 4 — "Sistemas Externos" (2026-08-20)

**⚠️ LOCAL CORRETO — leia antes de tocar em qualquer uma destas duas features:** ambas vivem **dentro do módulo Roadmap Alpha** (`RoadmapDashboard.tsx`, rota `/PainelAlpha/Roadmap`), **nunca** na tela inicial do PainelAlpha (`PainelAlphaClient.tsx`, aba "IALPHA"). Uma implementação inicial colocou por engano o botão e o accordion na tela inicial — foi revertido integralmente e refeito no lugar certo depois de correção explícita do usuário. Se uma sessão futura cogitar mexer nisso a partir de `PainelAlphaClient.tsx`, está no lugar errado — pare e confira aqui primeiro.

**"Novo módulo":** botão no header de `RoadmapDashboard.tsx`, ao lado de "Novo objetivo" (ambos condicionados a `canMutate`). Aciona `setCreateNovoModuloPreset(true)` + `setCreateOpen(true)`, abrindo o mesmo `CreateObjectiveDialog` com um preset (`NOVO_MODULO_CONSTRAINTS`) pré-preenchendo o campo Restrições com a checklist real de registro de módulo (1 entrada em `MODULOS_REGISTRY`). Existe também suporte a `?novoModulo=1` via `useSearchParams` (link direto), com o mesmo gate de `canMutate` duplicado — tanto no `useEffect` que lê o param quanto na montagem condicional de `<CreateObjectiveDialog>`/`<EditObjectiveDialog>` no JSX (nunca monte esses dialogs incondicionalmente, só controlando por `open` — um usuário sem permissão conseguia abri-los por URL direta antes dessa correção). **Não é um fluxo paralelo** — "criar módulo" é um objetivo do Roadmap como outro qualquer, só nasce com um preset de contexto diferente; passa pelo mesmo pipeline documentação Qwen → `AWAITING_APPROVAL` → aprovação humana → produção.

**"Sistemas Externos":** a sidebar esquerda do Roadmap ("Projetos do painel") virou um `Accordion` de 2 gavetas — `AccordionItem value="painel-alpha"` (todo o conteúdo/filtro de módulos internos, comportamento idêntico ao anterior) e `AccordionItem value="sistemas-externos"` (novo, renderiza `<SistemasExternosSection isAdmin={canMutate} />`). Título dos triggers usa `text-xs font-semibold` simples — evitar `uppercase tracking-[.18em]` em espaços estreitos (sidebar ~220px), quebra palavras de forma feia.

**Decisão de segurança do usuário, já tomada — não reabrir:** sem allowlist fixa de diretórios-pai (ele rejeitou explicitamente); seletor de diretório interativo (`workspace-browser.ts`) é a interação, e `requireRoadmapAccess(true)` (só Admin) é a proteção real.

**Arquivos:**
- `prisma/schema.prisma` — model `RoadmapWorkspace` (`moduleKey` único, `label`, `rootPath`, `status`, `createdById → usuarios`, `archivedAt`, `workerPid Int?`, `workerStartedAt DateTime?`). **Migration aplicada em produção** (duas migrations pontuais, cada uma com backup dedicado + confirmação, ver `decisions.md`).
- `src/lib/roadmap-alpha/workspace-browser.ts` — `listWorkspaceDirectories`/`assertWorkspaceRootPathUsable`, navegador server-side via `path.win32`.
- `src/actions/RoadmapWorkspaces.ts` — CRUD (`CriarRoadmapWorkspace` valida `rootPath` duplicado normalizado, além de `moduleKey` único e nomes reservados do Windows) + controle de worker (`IniciarWorkerRoadmapWorkspace`/`PararWorkerRoadmapWorkspace`, ver seção "Execução real" abaixo).
- `src/components/RoadmapAlpha/{NovoProjetoExternoDialog,SistemasExternosSection}.tsx` — UI de registro + status/controle do worker.
- `src/components/ui/accordion.tsx` — primeiro uso de Accordion no projeto (`@radix-ui/react-accordion`); keyframes já vêm de `tw-animate-css`, nenhuma escrita manual necessária.

### Execução real de objetivos em workspace externo (2026-08-20)

Completa o que a Frente 4 tinha deixado como "registro apenas" — agora um workspace externo processa sua própria fila de objetivos de verdade, isolada por diretório.

**Achado crítico corrigido (Fase A):** antes desta mudança, `documentedObjectives()` (`src/lib/roadmap-production/worker.ts`) não filtrava por origem — **todos** os objetivos documentados de **todos** os módulos entravam na mesma fila, então dois workers (um do PainelAlpha, um de workspace externo) processariam a fila cruzada, com risco real de um agente escrever no projeto errado. Corrigido com `src/lib/roadmap-production/workspace-scope.ts` (novo) — `resolveProductionWorkspaceScope(root)` resolve `allowedModuleKeys`: se `root` é o PainelAlpha, é todo `MODULOS_REGISTRY`; se é o `rootPath` de um `RoadmapWorkspace` ativo (comparação normalizada via `path.win32`), é **somente** aquele `moduleKey` — nunca cai em fallback silencioso, lança `WORKSPACE_ROOT_NOT_REGISTERED` se não encontrar correspondência. `root` agora é propagado por toda a cadeia do worker (`processNextProductionPhase` → `...Unlocked` → `syncProductionExecutions`/`mutateExecution`/`addActivity`/`runProductionAgentWithCapabilityRouting`/`runDevelopmentAgentWithFallback`/`runProductionAgent`), todas com default `process.cwd()` preservando o comportamento do PainelAlpha intacto.

**Fase B — `moduleKey` de workspace na criação de objetivo:** `roadmapObjectiveInputSchema` (`src/lib/roadmap-alpha/contracts.ts`) não valida mais `moduleKey` contra `MODULOS_REGISTRY` no Zod (esse set era calculado uma vez no import do módulo — nunca reconheceria um `RoadmapWorkspace` dinâmico do banco). Validação real: `isValidRoadmapModuleKey()` (`catalog.ts`, assíncrona, checa `MODULOS_REGISTRY` OU `RoadmapWorkspace` ativo), chamada manualmente dentro de `CriarObjetivoRoadmap`/`AtualizarObjetivoRoadmap` logo após o parse Zod. `getRoadmapModuleCatalogWithWorkspaces()` combina os dois catálogos para a UI de criar objetivo listar workspaces externos como opção de "Projeto".

**Fase C — worker isolado por processo, controlável pela UI:** `scripts/roadmap-production-workspace-worker.ps1` (novo, variante parametrizada de `scripts/roadmap-production-worker.ps1`) aceita `-WorkspaceId`/`-WorkerRoot`, usa Mutex nomeado **por workspace** (`Local\PainelAlphaRoadmapProductionWorker_<workspaceId>`, diferente do nome fixo do supervisor original — permite N workers simultâneos, um por workspace, nunca dois para o mesmo). `scripts/roadmap-production.mjs worker` lê `$env:ROADMAP_PRODUCTION_ROOT`. `IniciarWorkerRoadmapWorkspace`/`PararWorkerRoadmapWorkspace` (`RoadmapWorkspaces.ts`) fazem `spawn`/kill do processo supervisor (detached, sobrevive ao Next.js), PID em `RoadmapWorkspace.workerPid`. UI mostra badge "Ativo"/"Parado" + botões por workspace em `SistemasExternosSection.tsx`.

**3 achados do Anubis, corrigidos:**
1. `killProcessTree()` (novo helper em `RoadmapWorkspaces.ts`, usa `taskkill /PID <pid> /T /F`) substitui `process.kill()` simples — matar só o supervisor não garante matar o worker `.mjs` filho no Windows, que podia ficar órfão escrevendo no diretório sem rastro na UI.
2. Reserva atômica em `IniciarWorkerRoadmapWorkspace` via `updateMany({ where: { id, workerPid: valorAntigo } })` antes do `spawn` — fecha a race condition de double-click que podia gerar 2 processos reais com o banco rastreando o PID errado.
3. `CriarRoadmapWorkspace` agora rejeita `rootPath` duplicado (normalizado via `path.win32`) — antes, dois workspaces podiam apontar pra mesma pasta física e disputar a fila silenciosamente (`resolveProductionWorkspaceScope` pegava sempre o primeiro `find()`, sem erro).

**Mecanismo dos supervisores (resolve um mistério registrado ontem):** `scripts/roadmap-production-worker.ps1` e `scripts/roadmap-alpha-worker.ps1` são processos **`powershell.exe`** (não `node.exe`) com loop infinito (`while ($true) { ...; Start-Sleep -Seconds 10 }`) protegido por `Mutex` nomeado fixo — por isso não apareciam em buscas por `node.exe` e reapareciam sozinhos minutos depois de matar só os workers Node. Qualquer sessão que precise parar de verdade o worker do PainelAlpha por um tempo tem que matar o `powershell.exe` supervisor também, não só o `node.exe`.

**Fase D — lock de execução GLOBAL, um projeto por vez no sistema inteiro (regra do usuário, 2026-08-20):** cada workspace tem seu próprio worker/Mutex (Fase C, acima) — isso continua. Mas a **execução real de uma fase** (chamada ao modelo de IA) é serializada globalmente: `acquireProductionExecutionLease()` (`src/lib/roadmap-production/execution-lock.ts`) sempre grava o lock físico na pasta do PainelAlpha (`GLOBAL_LOCK_ROOT = process.cwd()`), **nunca** no `root` de cada workspace — o parâmetro `root` recebido é ignorado para fins de localização do lock. Isso funciona porque todo worker (interno e externos) roda fisicamente a partir da pasta do PainelAlpha (`Set-Location` no `.ps1` antes de invocar o `.mjs`), então `process.cwd()` resolve igual em todos. Quando ocupado, o worker que perdeu a disputa recebe `{ processed: false, busy: true }` e tenta de novo no próximo ciclo (5s) — funciona como fila, não como erro. **Nunca reverter para lock por-`root`** sem decisão explícita do usuário — ver `decisions.md`.

**Última atualização:** 2026-08-20 por Scribe (sessão Bibble, execução autônoma overnight + lock global)

---

## Estrutura de Arquivos (principais)

```
src/
├── app/
│   ├── PainelAlpha/            # Rotas autenticadas do painel — 1 pasta por módulo
│   │   ├── ExtratosBancarios/  # page.tsx fino + [Id]/page.tsx fino (ver padrão de módulo abaixo)
│   │   ├── AlphaCRM/, Chamados/, Holerites/, Parceiros/, etc. — 1 por módulo do registry
│   ├── api/                    # Route Handlers (ex: /api/onyx/extrato, /api/ReceitaFederal)
│   ├── auth/                   # Páginas de autenticação (redefinir senha etc)
│   ├── convite/                # Rotas públicas (convite de parceiro)
│   └── PdfPreview/              # Preview de PDF isolado
├── components/
│   ├── ui/                     # shadcn/ui (Button, Dialog, AlertDialog, Badge, etc.) + animated-shader-background.tsx
│   ├── Extratos/                # Componentes do módulo Extratos (ver padrão de módulo abaixo)
│   ├── Parceiros/, holerites/, GestaoColaboradores/, chamados/, etc. — 1 pasta por módulo com componentes próprios
│   └── layout/                  # GlobalSidebar, PainelLayoutClient, TabBar — consomem MODULOS_REGISTRY
├── actions/                     # Server Actions ("use server"), 1 arquivo por domínio (Extratos.ts, transacao.ts, bancos.ts...)
├── lib/
│   ├── modulos-registry.ts      # FONTE ÚNICA de módulos/permissões/menu (ver abaixo)
│   ├── prisma.ts                # Cliente Prisma via adapter PrismaLibSql (Turso)
│   ├── validations/              # Schemas Zod compartilhados (ex: extrato.ts)
│   ├── onyx/                     # Integração com agentes Onyx (client.ts, extrato-agents.ts)
│   ├── bibble/                   # Bibble: anexos, segurança, orçamento de contexto, SSE e extração Tika/pdf-parse/PDF24
│   └── temas.ts                  # Paletas de accent color (CONFIG_TEMAS) usadas por vários módulos
├── hooks/                        # Custom hooks client-side
├── types/                        # Types globais (ex: extrato.ts)
└── prisma/schema.prisma           # Schema do banco (SQLite/LibSQL via Turso)
```

---

## Módulos do Sistema

Fonte de verdade: `src/lib/modulos-registry.ts` (`MODULOS_REGISTRY`) — **array único**, consumido por `GlobalSidebar.tsx`, `PainelAlphaClient.tsx` e `TabBar.tsx`. Adicionar um módulo novo = 1 entrada aqui (o padrão antigo de 3 arrays manuais documentado em versões antigas do CLAUDE.md está obsoleto).

**Correção de cartografia (2026-08-21):** para provar que um módulo aparece no catálogo realmente renderizado, o consumidor autoritativo é `src/components/layout/GlobalSidebar.tsx`, montado por `PainelLayoutClient` no layout de `/PainelAlpha`. `src/components/PainelAlphaClient.tsx` permanece no repositório, mas está órfão, sem import/render no app atual; sua leitura do registry não vale como evidência de wiring e não deve orientar correções de visibilidade. Outros consumidores podem reutilizar metadados do registry, mas não substituem um teste do fluxo renderizado da `GlobalSidebar`.

| Categoria | Módulo | Rota | Permissão |
|---|---|---|---|
| Operacional | Chamados | `/PainelAlpha/Chamados` | `chamados` |
| Operacional | Alpha CheckList | `/PainelAlpha/CheckList` | `checkList` |
| Operacional | Tarefas Comercial | `/PainelAlpha/PainelTarefas/PainelTarefaC` | `tarefasComercial` |
| Operacional | Ger. Tarefas | `/PainelAlpha/PainelTarefas/GerenciarTarefas/...` | `gerenciamentoTarefas` |
| Operacional | Reserva de Salas | `/PainelAlpha/ReservaSalas` | `Reservas` |
| Operacional | Agenda Alpha | `/PainelAlpha/CalendarioAlpha` | `calendarioAlpha` ← nome visual novo; rota e permissão legadas preservadas; Google Workspace via Domain-Wide Delegation |
| Operacional | Serviços Gerais | `/PainelAlpha/PainelTarefas/painelTarefaSG` | `ServiçosGerais` |
| Comercial | Alpha CRM | `/PainelAlpha/AlphaCRM` | `crm` |
| Comercial | CS & NPS | `/PainelAlpha/CadastroClientes` | `Cliente` |
| Comercial | Parceiros | `/PainelAlpha/Parceiros` | `parceiros` |
| Comercial | Alpha Leads | `/PainelAlpha/ControleLeads` | `leads` |
| Comercial | Alpha Marketing | `/PainelAlpha/ControleLeads/Marketing` | `marketing` |
| Comercial | Instagram Studio | `/PainelAlpha/Marketing` | `instagramStudio` |
| Comercial | Alpha Metas | `/PainelAlpha/Metas` | `metas` (role: Lider Comercial) |
| Comercial | Alpha Presentation Studio | `/PainelAlpha/Apresentacoes` | `apresentacoes` ← Ondas 1-5 de 6 entregues, 2026-07-10 (Dashboard + Editor completo + Temas/Animações/Timeline + Componentes 3D + Motor de IA completo com UI). Categoria "Backgrounds" (7 fundos animados) em 2026-08-05. Export HTML autocontido (botão "Exportar HTML", pipeline esbuild + player standalone) em 2026-08-06 — primeira peça real da Onda 6 (Export), ver `integration-points.md` |
| Comercial | Alpha Blueprint | `/PainelAlpha/AlphaBlueprint` | `blueprint` ← MVP completo, 2026-07-27 (Kanban + workspace por projeto + editor Tiptap + canvas xyflow + arquivos + requisitos + perguntas + comentários + IA + onboarding; Camada 2/evolução avançada não implementada — ver seção própria) |
| **Financeiro** | **Extratos Bancários** | **`/PainelAlpha/ExtratosBancarios`** | **`Extratos`** ← reescrito 2026-07-09 |
| Financeiro | Pré Análise | `/PainelAlpha/SistemaPreAnalise` | `analise` |
| Financeiro | Consulta RADAR | `/PainelAlpha/HabilitacaoRadar` | `radar` |
| Financeiro | Análise Fiscal | `/PainelAlpha/AlphaConnect` | `Perse` |
| Financeiro | Alpha Holerites | `/PainelAlpha/Holerites` | `holerites` |
| Financeiro | Gestão de Comissões e Prêmios | `/PainelAlpha/Comissoes` | `comissoes` (role: Admin/CEO/FINANCEIRO) ← completo, 2026-07-28, ver seção própria |
| Pessoas | Alpha Schools | `/PainelAlpha/AlphaSchools` | `schools` |
| Pessoas | Alpha Skills | `/PainelAlpha/AlphaSkills` | `skills` |
| Pessoas | Alpha Vault | `/PainelAlpha/AlphaVault` | `Senhas` |
| Infra | POP (Documentos) | `/PainelAlpha/DocsAlpha` | `Documentos` |
| Admin | Ger. Alpha Skills | `/PainelAlpha/AlphaSkills/Gerenciamento` | admin only |
| Admin | Gestão de Equipe | `/PainelAlpha/cadastro` | admin only |
| Admin | Gestão de Colaboradores | `/PainelAlpha/GestaoColaboradores` | roles RH/Financeiro |
| Admin | Gestão de Protocolos | `/PainelAlpha/GestaoProtocolos` | roles Admin/CEO/Suporte |
| Admin | Onboarding | `/PainelAlpha/GestaoOnboarding` | admin only |
| Admin | Conectores IAlpha | `/PainelAlpha/Conectores` | admin only |
| Infra | Bloco de notas ALpha | `/PainelAlpha/Notas` | `notas` ← **Fases 01-05/8 concluídas em 2026-08-07, migration APLICADA EM PRODUÇÃO** (schema+permissões, barra global+editor+autosave, Central de Notas, contextos, colaboração/histórico/notificações real-time — ver seção própria abaixo e `architecture.md`) |

### Alpha CRM — Padronizar layout dos pipelines do quadro Kanban (RM-2026-41E240, 2026-08-17)

Objetivo concluído. Três defeitos de layout corrigidos em `PipelineBoardClient.tsx` e `crm-pipeline-border.tsx`:

1. **Altura total:** pipelines ocupam 100% da área visível. Cadeia: contêiner `flex-1 min-h-0 overflow-y-hidden` → coluna `h-full min-h-0` → área de cards `flex-1 min-h-0 overflow-y-auto`. Margem inferior responsiva `pb-[clamp(8px,2vh,24px)]`.
2. **Largura proporcional:** colunas `md:w-[260px] lg:w-[280px] xl:w-[300px]` + `gap-3` (12px). Cards `px-2.5 pb-2.5 pt-3`. Capacidade: ≥ 4 colunas em 1280px, ≥ 6 em 1920px.
3. **Linha vermelha contida:** card `overflow-hidden` (era `overflow-y-auto overflow-x-hidden`); rolagem interna migrada para inner content do `CrmPipelineBorder` (`overflow-y-auto`). Accent bar `absolute inset-y-0 left-0 w-1` e `border-red-500/70` contidas.

**Arquivos alterados:**
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` — altura, largura, contenção
- `src/components/ui/crm-pipeline-border.tsx` — `overflow-y-auto` no inner content
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardSkeleton.tsx` — largura 260px
- `src/app/PainelAlpha/AlphaCRM/README.md` — dimensões atualizadas

### Alpha CRM — Estilização dos cards do pipeline com GradientBlobCard (RM-2026-57E057, 2026-08-17)

Implementação documentada, com encerramento bloqueado pelos gates em 2026-08-17. O novo componente de apresentação `GradientBlobCard` (`src/components/ui/gradient-blob-card.tsx`, Client Component, props `children`/`className`) substitui o shell visual inline do `KanbanCard` em `PipelineBoardClient.tsx`: gradiente animado (blob `pink-500→red-500→yellow-500`, `blur-[12px]`, `z-[15]`), sombra dupla neumórfica com efeito de flutuação (clara/escura), fundo glassy (`backdrop-blur-[24px]`, `bg-white/80`/`dark:bg-black/50`) e altura determinada pelo conteúdo (sem `min-h` fixo no shell). dnd-kit e o clique de abertura permanecem no `<div>` wrapper externo — o componente é puramente apresentacional. Keyframes do blob (`@keyframes blob`/`.animate-blob`, com guard `prefers-reduced-motion`) centralizados em `src/app/globals.css` para evitar `<style>` inline duplicada por card.

**Gate pendente:** `npm test` falhou em 6 testes (3 diretamente ligados ao CRM: 2 em `tests/bpm/card-modal-integration.test.ts` e 1 em `tests/bpm/fechado-ui.test.ts`; os demais em PPTX, Agenda Alpha e Notas). O objetivo não deve ser marcado como concluído até a implementação ou os contratos de teste serem reconciliados e todos os gates obrigatórios passarem.

**Arquivos alterados:**
- `src/components/ui/gradient-blob-card.tsx` (novo)
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` — integração do `GradientBlobCard` no `KanbanCard`
- `src/app/globals.css` — keyframes globais do blob
- `src/app/PainelAlpha/AlphaCRM/README.md` — seção "Estilização de Cards"
- `docs/components/gradient-blob-card.md` (novo)
- `CHANGELOG.md`

**Última atualização:** 2026-08-17 por Scribe

---

### Alpha CRM — Card aberto: cadeia real de layout consolidada + 3 arquivos órfãos removidos (RM-2026-6D5A60, 2026-08-26)

Objetivo "Layout do card Aberto único por pipeline" executado via Roadmap Production (novo motor de status manual, ver seção própria em `architecture.md`). Auditoria (Fase 0/Scout) confirmou: **o layout já é único de fato para todos os pipelines** — não havia duplicação de layout a resolver, o problema real era débito técnico de refatorações anteriores incompletas.

**Cadeia real e completa do card aberto (confirmada por leitura de código, corrige menções anteriores desatualizadas):**
```
CardFullViewModal.tsx (3 consumidores: DashboardClient, PipelineBoardClient em
  /PainelAlpha/AlphaCRM/pipeline/[pipelineId], TarefasCentralClient)
  → resolveCardAbertoLayout(pipeline.nome)  [pipelines/index.ts — registry por
    nome normalizado, hoje vazio, fallback sempre CardAbertoLayout]
  → CardAbertoLayout.tsx (layout único: header, tabs de serviço, grid 3 colunas)
      - Esquerda: PainelHistorico.tsx / PainelHistoricoServico.tsx (aba serviço)
      - Centro (children/slot): PainelRegistrar.tsx (Tabs "Formulário da
        Etapa"/"Script") → CardOpenFormSlot.tsx (seleção por etapaEh*())
      - Direita: PainelProximaEtapa.tsx
```

**`CardOpenFormSlot.tsx`** é o ÚNICO ponto real de seleção de formulário por etapa — IS a fonte de verdade, não `PainelRegistrar.tsx` (que só monta as Tabs e a Anotação). Painéis condicionais: `PainelReuniao` (etapaEhAgendarReuniao), `PainelStatusPosFechamento` (etapaEhFechado), `PainelChecklistFollowUp` (etapaEhEmTratativa), `PainelStandbyFollowUp` (etapaEhStandbyFollowUp). Sempre renderizados: `PainelCamposEtapaAtual`, `PainelProximoContato`.

**3 arquivos órfãos removidos nesta sessão** (zero consumidores confirmados via grep em todo `src/`, todas as remoções validadas por `tsc --noEmit`/`eslint`/`npm run build`/`tests/bpm` sem regressão):
- `CardOpenShell.tsx` (308 linhas) — 2ª implementação completa e duplicada do mesmo layout, com registry paralelo INCOMPATÍVEL (chaveado por `pipeline.id`, o real é por `pipeline.nome`). Nunca deve ser recriado — se um dia for necessário customizar o layout por pipeline, popular `pipelines/index.ts` (o registry real).
- `PainelContatos.tsx` (113 linhas) — já havia sido removido de `PainelRegistrar.tsx` em `RM-2026-05E75A` (2026-08-25/26), mas tinha voltado sem intenção via `CardOpenFormSlot.tsx` (import solto, provavelmente de uma sessão que não conhecia a decisão anterior). Usuário reconfirmou a remoção nesta sessão.
- `PainelRequisitosAvanco.tsx` (284 linhas) — pendência registrada desde `RM-2026-3E14F1` (2026-08-25), nunca executada até esta sessão. Bloco de UI já removido de `PainelHistorico.tsx` há tempo; o arquivo físico só agora foi apagado.

**`CardOpenFormSlot.tsx` também foi limpo:** removidas props `interacoes`/`onInteracaoCriada` (só existiam para alimentar o `PainelContatos` removido) e o import não usado de `Interacao`/`ListarInteracoesCardBpm`.

**Lição para sessões futuras:** este diretório (`CardModal/`) acumulou 3 arquivos órfãos ao longo de múltiplas sessões porque a remoção de UI (import + JSX) e a remoção do arquivo físico (`rm`) foram tratadas como passos separados, e o segundo passo ("pendência de limpeza manual") nunca foi retomado. Ao remover um bloco de UI, preferir remover o arquivo físico na mesma sessão sempre que confirmado órfão (grep de zero consumidores), em vez de deixar como pendência textual na memória.

**Validação de transição de etapa (INALTERADA por esta sessão, já era assim):**
- `@/actions/bpm/Cards.ts` → `ObterRequisitosTransicaoBpm`, `SalvarRequisitosEMoverCardBpm`, `MoverCardBpm`
- `@/lib/bpm/card-modal-ui.ts` → `separarCamposRequisitos`, `montarPayloadCamposDestino`, `prepararCamposMotivoLostUi`
- `@/lib/bpm/requisitos-etapa-server.ts` → `carregarCamposAplicaveisCardEtapa`

**Débito técnico pré-existente confirmado (não corrigido, fora de escopo, ver `known-errors.md`):** `CardFullViewModal.tsx` tem 1 eslint `error` real (`react-hooks/refs`) + ~15 warnings de `no-unused-vars`; `tests/bpm/card-modal-integration.test.ts` tem 9/21 testes falhando (asserções estáticas desatualizadas). Ambos confirmados pré-existentes via `git diff`/`git stash` comparativo, não introduzidos por esta sessão.

**Última atualização:** 2026-08-26 por Scribe (execução via Roadmap Production)

---

## Alpha SEO — portabilidade funcional do OpenSEO (2026-08-20)

**Propósito:** workspace SEO multiusuário incorporado ao Painel Alpha, com pesquisa de palavras-chave e domínio, backlinks, rank tracking, auditoria técnica/Lighthouse, Search Console, GA4, visibilidade em IA, SAM, memória de projeto, exportações e servidor MCP. A fonte congelada é o checkout OpenSEO; a implementação usa os padrões nativos do Painel Alpha.

**Stack e entrada:** Next.js App Router + React/TypeScript, Server Components/Server Actions e Route Handlers; Tailwind/componentes do Painel Alpha; NextAuth e permissão de módulo; Prisma sobre Turso; Vitest; jobs persistentes e Vercel Cron. O registro canônico está em `src/lib/modulos-registry.ts` com `id/permission: "alphaSeo"`, ícone `ScanSearch`, categoria `comercial` e rota `/PainelAlpha/AlphaSEO`.

**Mapa estrutural:**
- `src/app/PainelAlpha/AlphaSEO/`: layout autenticado, lista/criação de projetos e aceite de convite. `[projectId]/layout.tsx` aplica o segundo gate de acesso ao projeto; as páginas filhas cobrem dashboard, keywords, saved, rank e detalhe, domain, backlinks, audit e Lighthouse, search performance, brand lookup, prompt explorer, SAM e settings.
- `src/components/AlphaSEO/`: shell visual e workspaces por domínio (`dashboard`, `audit`, `gsc`, `projects`, `rank`, `research`, `sam`, `saved`, `settings`, `shared`, `visibility`), mantendo o design system do Painel Alpha.
- `src/actions/AlphaSeo*.ts`: 16 fachadas de Server Actions para projetos/onboarding, dashboard, keywords/salvos, domínio/backlinks, rank, audit/Lighthouse, GSC/GA4, IA, SAM, memória, settings e exportações. Autorização e validação permanecem server-side.
- `src/lib/alpha-seo/`: contratos, autorização, políticas de operação/custo, providers, serviços de domínio, crawler anti-SSRF, filas/locks, OAuth, MCP, SAM, exports, inventário, doctor e worker.
- `src/app/api/alpha-seo/`: MCP Streamable HTTP e OAuth/API keys; OAuth Google; stream SSE do SAM; crons protegidos de schedules, worker e limpeza OAuth.
- `scripts/alpha-seo.mjs` e scripts `alpha-seo:*` do `package.json`: inventory, doctor e workers executáveis por CLI. O manifesto sanitizado vive em `docs/alpha-seo/source-manifest.json`.
- `tests/alpha-seo/`: 27 arquivos cobrindo contratos, providers, acesso, jobs, crawler/SSRF, MCP, skills, integrações, exports e UI wiring.

**Persistência:** `prisma/schema.prisma` contém 44 modelos `AlphaSeo*`. O Vault aplicou no Turso `basetestes-alphacomex` somente o SQL autorizado de SHA-256 `acbec05894d0588ea949b4a7a8bd5d0e9fdfa6ed7462c8f201f48792c2810bef`: 44 tabelas e 110 índices novos, em transação, sem `ALTER`, `DROP`, seed ou backfill; validação final teve zero violações de FK. Mudança estrutural futura exige novo gate Vault, backup e autorização.

**Contratos congelados:** 93/93 exports de servidor rastreados; registry MCP executável com 46/46 tools, sem nomes ausentes ou inesperados; 9 skills com instruções integrais e recurso HTML da skill de auditoria; catálogo de 27 audit issue IDs. Infraestrutura própria da fonte (D1/Drizzle/Cloudflare, Better Auth organizations e billing hosted) foi substituída, respectivamente, por Prisma/Turso + jobs/Route Handlers, NextAuth + membership por projeto e aprovações/ledger internos.

**Integrações e operação:** DataForSEO atende dados SEO/rank; OpenRouter atende Brand Lookup, Prompt Explorer e SAM; Google OAuth com PKCE e tokens criptografados atende GSC/GA4. Nenhum valor de segredo pertence ao repositório ou a estas memórias. Schedules e worker rodam a cada cinco minutos; a limpeza bounded de nonces/codes/tokens OAuth expirados roda às 03:17 UTC. Operações pagas passam por estimativa/aprovação, idempotência, cache e mutex; crawler e SAM validam destino e limitam payload.

**Qualidade registrada:** inventário `46/46` sem drift, Prisma validate/generate e lint direcionado aprovados; suíte `tests/alpha-seo` aprovou 27 arquivos/122 testes. O typecheck global conserva erros legados fora de Alpha SEO; o build global depende do player fora do sandbox e de download de fontes, e o E2E visual não pôde ser executado porque a permissão do navegador local foi negada. O doctor offline identifica configuração externa ausente como `provider-missing`, sem revelar valores. Essas ressalvas não devem ser convertidas em mocks ou sucesso fictício.

**Última atualização:** 2026-08-20 por Scribe/Kowalski

**Adendo de fechamento final (2026-08-20):** a contagem intermediária de 27 arquivos/122 testes acima foi supersedida pela suíte Sage final: **37 arquivos e 161 testes Alpha SEO aprovados**. Lens concluiu a revisão final com **PASS e zero issues**.

Hardening incorporado no estado final:
- `src/lib/alpha-seo/dataforseo/operations.ts` é o executor pago único: consulta run idempotente concluído, valida aprovação persistida acima do threshold antes de mutex/provider e preserva a deduplicação concorrente.
- `src/lib/alpha-seo/google/oauth.ts` só reivindica/revoga um grant Google por `updateMany` relacional quando não há conexão consumidora do produto; desconectar uma integração não invalida token ainda compartilhado.
- `src/app/api/alpha-seo/sam/stream/route.ts`, `src/lib/alpha-seo/sam/service.ts`, `tools.ts` e `safe-url.ts` propagam `AbortSignal` até OpenRouter/fetch/tools. Cancelamento do stream persiste sessão `CANCELLED` e não grava resposta cobrada após abort.
- `src/lib/alpha-seo/jobs/processor-result.ts` classifica resultados como `complete`, `defer` ou `invalid`; `worker.ts` agenda defer/retry em vez de transformar busy/queued skip em sucesso. Rank sem snapshots volta ao retry, enquanto disposição terminal explícita encerra o job.
- `src/lib/alpha-seo/action-error.ts` é o mapper compartilhado das Actions: preserva somente códigos/mensagens de negócio permitidos e erros tipados de acesso; mensagens internas arbitrárias são substituídas.
- `AuditResultsWorkspace.tsx`, `DomainResearchWorkspace.tsx`, `BacklinksWorkspace.tsx`, `GscOverview.tsx`, `AiHistoryPanel.tsx`, `CompleteExportButtons.tsx` e `PaginationControls.tsx` materializam paginação/exportação completa com limites e guards contra resposta stale. Auditoria exige intenção explícita `CANCEL` ou `DELETE`, usa predicado atômico por projeto/status, mantém `currentStatus`, ressincroniza conflitos e não repete a mutação automaticamente.
- `src/components/AlphaSEO/audit/AuditDetailClient.tsx` foi removido; `AuditResultsWorkspace.tsx` é o cliente canônico do detalhe de auditoria, montado por `shared/DetailViews.tsx`.

**Limites do fechamento:** providers reais, fluxos OAuth reais, execução real dos crons e navegador/E2E real não foram exercidos neste ambiente. Build e gates globais ainda carregam baselines/bloqueios externos ao Alpha SEO. O token Turso exposto no contexto da conversa precisa ser rotacionado; nenhum valor foi copiado para estas memórias.

**Última atualização final:** 2026-08-20 por Scribe/Kowalski

### Adendo — visibilidade do catálogo Open SEO (2026-08-21)

- O catálogo real segue `src/app/PainelAlpha/layout.tsx` → `PainelLayoutClient.tsx` → `GlobalSidebar.tsx` → `MODULOS_REGISTRY`. `PainelAlphaClient.tsx` não possui consumidor e não pode ser usado como prova de renderização.
- `alphaSeo` é o **primeiro item Comercial**, com label `Open SEO · Alpha SEO`, rota `/PainelAlpha/AlphaSEO`, permissão `alphaSeo`, tag `SEO`, descrição de pesquisa/monitoramento/auditoria/inteligência e aliases `Open SEO`, `Alpha SEO` e `OpenSEO`.
- A busca da sidebar normaliza e compara `label`, `id`, `tag`, `desc` e `aliases`; portanto os três nomes públicos localizam o mesmo módulo sem duplicar registro.
- `podeVisualizarModulo` é a autoridade única de visibilidade, nesta precedência: bypass de role administrativa → `adminOnly` restrito a role permitida → role permitida → permissão do módulo → módulo irrestrito somente quando não há `allowedRoles`. Isso preserva `gestaoOnboarding` como role-only e impede que a permissão textual `cadastro` contorne `adminOnly`.
- Evidência final: Forge aprovou 161/161 testes; Probe cobriu casos renderizados de admin, usuário com/sem permissão e busca pelos aliases; Lens retornou PASS sem issues.

**Estado operacional Git:** o módulo Alpha SEO e a primeira correção de catálogo já estão no `HEAD`/`origin/main` `c2979beb6`. O deploy efetivo desse commit não foi verificado. O endurecimento final da precedência `adminOnly` em `src/lib/modulos-registry.ts` e o teste reforçado em `tests/alpha-seo/integration-wiring.test.ts` permanecem locais/uncommitted; sua publicação exige o fluxo autorizado do agente DevOps. Nenhum commit ou push é atribuído a esta sessão documental.

**Última atualização:** 2026-08-21 por Scribe/Kowalski

### Alpha CRM — cards do pipeline sem glow (RM-2026-5284A1, 2026-08-18)

`GradientBlobCard` mantém o nome por compatibilidade, mas agora é o shell sóbrio
do `KanbanCard`: superfície `slate-800/95`, borda Alpha azul de 1 px, sem blob ou
sombra decorativa, hover `scale(1.02)` em 150 ms e faixa semântica interna de
3 px. `PipelineBoardClient.tsx` passa `accent` e o tint pós-fechamento via
`surfaceClassName`; handlers de clique e dnd-kit permanecem no wrapper externo.

**Última atualização:** 2026-08-18 por Nova

**Notas de manutenção:**
- Largura: respeitar `min-width: 200px` / `max-width: 340px` em ajustes futuros.
- `overflow-hidden` no card é necessário para contenção; ao adicionar elementos `position: absolute` ou `overflow: visible`, verificar que não quebrem a contenção.
- Margem inferior `clamp(8px,2vh,24px)` — ao alterar header/toolbar, ajustar o `calc()` da altura do contêiner.

**Verificação:** Probe aprovou 8/8 ACs. Zero regressões.

**Última atualização:** 2026-08-17 por Scribe

### Alpha CRM — Melhoria Visual da Sidebar (RM-2026-4F34CC, 2026-08-17)

Objetivo concluído. Sidebar do CRM agora usa o componente `FlowButton` (`src/components/ui/flow-button.tsx`) para os botões de navegação, com transições 700ms `cubic-bezier(0.22,1,0.36,1)`, borda animada, elementos decorativos (seta + ponto), `active:scale-[0.97]` e espaçamento `space-y-2` (8px). O fundo da sidebar foi reduzido para `bg-slate-950/20 backdrop-blur-md` para o `CrmSpaceBackground` ser visível através dela.

**Arquivos alterados:**
- `src/components/ui/flow-button.tsx` — CRIADO (componente FlowButton, padrão shadcn)
- `src/app/PainelAlpha/AlphaCRM/CRMLayoutClient.tsx` — EDITADO (NAV usa FlowButton, espaçamento, fundo)

**Verificação:** Probe aprovou 6/6 critérios de aceitação. Zero regressão funcional.

**Última atualização:** 2026-08-17 por Scribe

### Alpha CheckList — organização operacional (2026-07-14)

O módulo continua em `src/app/PainelAlpha/CheckList/`, com as Server Actions em
`src/actions/checklist.ts`. A listagem (`ListaChecklist.tsx`) concentra edição
global, filtros e vínculo opcional com `PastaChecklist`; o detalhe
(`ChecklistView.tsx`) permite trocar o embasamento ativo sem apagar os checklists
anteriores. O download de documentos passa pela rota autenticada
`/api/checklist/[empresaId]/documentos/zip`, que reúne somente documentos ativos.
O model `OperacionalClientes` tem a relação opcional `pastaChecklistId`; toda
alteração estrutural deste módulo no Turso deve seguir o script pontual idempotente
e a confirmação por `PRAGMA`, conforme a regra de migrations remotas.

Os documentos-base são configuráveis em
`src/app/PainelAlpha/CheckList/Embasamentos/`, persistidos em
`ModeloItemChecklist`. Um item com `tipo = null` é global; o preenchimento de um
novo `Checklist` copia os modelos globais e os do tipo selecionado, sem modificar
checklists existentes.

### Gestão de Comissões e Prêmios (completo, 2026-07-28)

Módulo de controle de fatos geradores, cálculo de comissão/prêmio/DSR (CLT e PJ), pagamentos, divergências, exportação de espelhos e configurações (cargos/tarifários/regras). Executado via fila `prompt-phases/` (17 fases, arquivadas em `prompt-phases/concluidos/GestaoComissoes/`).

**Backend** (`src/lib/commissions/`): motor de regras (`rule-engine.ts`, `calculators.ts`, `commissionable-base.ts`, `calculation-memory.ts`, `dsr-formula.ts`, `seed-rules.ts`, `cargo-rule-matching.ts`), calendário (`calendar-engine.ts`, `holidays-seed.ts`), resolução de vínculo (`vinculo-resolver.ts`), agenda de pagamento (`payment-schedule.ts`), filtro de exceções (`eligibility-filter.ts`), geração de lançamentos (`entry-generator.ts` — separa COMISSAO/PREMIO/DSR em `EntryComponent`s distintos, nunca soma no mesmo componente), detecção de divergências (`divergence-detector.ts`, 14 checagens), sincronização (`sync-engine.ts` + `adapters/` para CS&NPS/Metas/Colaboradores), exportação (`export/preview-builder.ts`, `export/xlsx-generator.ts`, `export/pdf-generator.tsx`).

**Server Actions** (`src/actions/Commission*.ts` + `EligibilityOverrides.ts`, 12 arquivos): `CommissionSync`, `CommissionEvents` (inclui `RecalcularEvento`, delega para `entry-generator` — nunca duplica lançamento já Pago), `EligibilityOverrides`, `CommissionPayments` (pagamento simples/lote/programado/estorno), `CommissionDashboard`, `CommissionEntries` (inclui `CriarAjusteManual`, adicionado na Fase 16/Sage — cria `ManualAdjustment`+`EntryComponent` tipo AJUSTE via `$transaction`, bloqueia em lançamento Pago/Estornado), `CommissionRules` (`SimularRegra`), `CommissionDivergences`, `CommissionExports`, `CommissionPositions`, `CommissionTariffs`, `CommissionRuleBuilder` (versionamento imutável — nunca sobrescreve versão PUBLISHED).

**Frontend** (`src/components/Comissoes/`): `ComissoesDashboard.tsx` orquestra `CabecalhoComissoes` (Sincronizar/Simulador/Exportar/Configurações/Divergências — "Novo Lançamento" desabilitado, `BotaoEmBreve`), `CardsIndicadores`, `FiltrosComissoes`, `EventoComissaoCard`+`SetorColaboradores`+`ModalPagarTodos` (Big Card por evento), `LancamentoColaboradorCard` (mini card), `ModalDetalhesLancamento` (7 abas: Resumo/Memória/Regra/Pagamentos/Ajustes/Histórico/Auditoria), `SimuladorRegras`, `PainelDivergencias`, `ModalExportarEspelho`+`PreviaEspelho`, `Configuracoes/` (AbaCargos/AbaTarifarios/ConstrutorRegras).

**RBAC:** módulo-inteiro via `permission: 'comissoes'` (`allowedRoles: ['Admin', 'CEO', 'FINANCEIRO']` no registry) — RBAC granular por ação dentro do módulo NÃO implementado (TODO documentado em todos os 12 arquivos de Server Actions).

**Achados de segurança corrigidos (Anubis, Fase 15):** Excel Formula Injection em `xlsx-generator.ts` (`neutralizarFormula()`), auditoria ausente em `CommissionDivergences`/`CommissionRuleBuilder` (corrigido, todas as Server Actions sensíveis gravam `CommissionAuditLog`).

**Pendências conscientes (seção 39 do prompt original — ver `architecture.md` para lista completa):** fórmula definitiva do DSR, natureza do Diretor Operacional, feriados municipais, tratamento de inadimplência, aprovação de ajuste manual (schema pronto, fluxo de aprovação não implementado).

**Testes:** `tests/commissions/` — 152 testes, 17 arquivos.

**Limitação de verificação:** sem credenciais de login disponíveis nas sessões que implementaram o módulo — validação de UI feita via `next build` + testes automatizados, não via clique real no browser autenticado. Recomenda-se teste manual humano antes de uso com dados reais de colaboradores/pagamentos.

### Ajustes pós-entrega (2026-07-30): closer/analista + 7 abas de Configurações + RBAC granular

**Vinculação de closer/analista responsável:** causa raiz era um bug real — `sync-engine.ts` já calculava `closerNome`/`analistaResponsavel`/`usuarioIdCloser` via `mergeCompanyEvent`, mas nunca gravava (schema não tinha coluna). Corrigido: `CommissionEvent` ganhou 4 colunas (`closerUsuarioId`, `closerNomeManual`, `analistaResponsavelUsuarioId`, `analistaResponsavelNomeManual` — FK real tem precedência sobre nome manual, nunca os dois preenchidos ao mesmo tempo). `AtualizarResponsaveisEvento` (`CommissionEntries.ts`) permite preenchimento manual com auditoria. UI mostra "Não Atribuído" quando ambos nulos (`EventoComissaoCard.tsx`, `EditorResponsavel.tsx` no modal de detalhes, com busca de colaborador cadastrado ou nome livre).

**7 abas de Configurações implementadas** (eram 8 placeholders "em breve" — "Vínculos" fundida em "Exceções" por decisão do usuário, já que ambas mapeavam para o mesmo model):
- **Exceções** (`AbaExcecoes.tsx`) — UI para `EligibilityOverride`, backend já existia pronto.
- **Calendários** (`AbaCalendarios.tsx` + `CommissionHolidays.ts`, novo) — CRUD de feriados ESTADUAL/MUNICIPAL (`Holiday`); NACIONAL nunca é persistido, é calculado em memória por `feriadosNacionais()` e mesclado na exibição.
- **Colaboradores** (`AbaColaboradores.tsx` + `ListarColaboradoresParaComissoes` em `CommissionPositions.ts`) — painel somente-leitura (cargo/setor/vínculo); edição continua no módulo Gestão de Colaboradores. `ContratoColaborador` está vazia em produção (0 linhas) — maioria aparece "sem vínculo cadastrado", esperado.
- **Serviços** (`AbaServicos.tsx` + `ListarServicosComTarifario` em `CommissionTariffs.ts`) — catálogo somente-leitura de `ServicosComerciais` (Metas) cruzado com `TariffVersion`, distinto da aba Tarifários (que cadastra preço).
- **Integrações** (`AbaIntegracoes.tsx` + `ListarSyncRuns` em `CommissionSync.ts`) — histórico somente-leitura de `SyncRun`/`SyncError`.
- **Espelhos** (`AbaEspelhos.tsx` + `ListarExportDocuments` em `CommissionExports.ts`) — histórico somente-leitura de `ExportDocument`; SEM re-download (o binário PDF/XLSX nunca é persistido, só o metadado/hash de verificação).
- **Permissões** (`AbaPermissoes.tsx` + `CommissionPermissions.ts`, novo) — ver RBAC granular abaixo.

**RBAC granular por categoria** (substituindo `ROLES_TEMPORARIAMENTE_PERMITIDOS` hardcoded nos 12 arquivos de Server Actions): novo model `CommissionPermission` (`userId`, `categoria`, `permitido`) + `src/lib/commissions/permissions.ts` (`verificarAcessoCategoria`). 6 categorias (decisão do usuário, não por função individual): VISUALIZAR, SINCRONIZAR, PAGAR, APROVAR, CONFIGURAR, EXPORTAR — todas as 33 funções reais mapeadas para uma delas. **Fallback aberto** (decisão do usuário): Admin/CEO sempre têm bypass total; FINANCEIRO sem nenhuma linha em `CommissionPermission` mantém acesso total (comportamento idêntico ao pré-RBAC) — restrição só vale depois que um Admin configura explicitamente pela aba Permissões.

**Migration aplicada no Turso (2026-07-30):** 4 ADD COLUMN em `CommissionEvent` + CREATE TABLE `CommissionPermission` (+ índices). Backup fresco gerado via script Node pontual (`@libsql/client`) em `database-backups/pre-change/painelalpha_turso_pre_change_comissoes-fase18_2026-07-30T12-25-54.sql` (backup diário automático não rodou em 29-30/07 — investigar à parte). 8 testes novos (`sync-engine.test.ts` +3, `responsaveis-evento.test.ts` novo com 8) — total 163 testes.

**Verificação final confirmada (2026-07-30):** após o usuário fechar os processos concorrentes, `npx prisma generate` funcionou. `tsc --noEmit` no baseline exato de 4 erros pré-existentes (zero novo), lint 100% limpo, 163 testes passando, `next build` compilou com sucesso com as 4 rotas do módulo presentes.

### Ajustes de UX do dashboard (2026-07-30, mesma sessão): modal de pagamento, filtro de mês, campos de êxito

Comparando a implementação contra um desenho detalhado do usuário do fluxo "Big Card", a maior parte já estava correta (mini card por colaborador individual com nome — não por cargo —, comissão/prêmio/DSR nunca somados sem detalhamento, contratação/êxito como eventos `CommissionEvent` distintos, resumo de confirmação antes de "Pagamento realizado" em lote via `ModalPagarTodos`). 3 lacunas reais corrigidas:

1. **Modal de pagamento individual** (`ModalRegistrarPagamento.tsx`) — antes o botão "Pagar" registrava direto (meio fixo PIX, valor sempre total, sem confirmação). Agora abre modal com valor editável (aviso quando for pagamento parcial), data, meio de pagamento (select), observação, e upload real de comprovante via nova Server Action `EnviarComprovantePagamento` (`CommissionPayments.ts`) usando o Blob Store dedicado `COMISSOES_COLAB_READ_WRITE_TOKEN`/`COMISSOES_COLAB_STORE_ID` (env vars configuradas pelo usuário nesta sessão).
2. **Filtro de período por mês** — `FiltrosComissoes.tsx` ganhou seletor de mês sempre visível (◀ Mês ▶, não escondido no Sheet de filtros extras), `ListarEventosComissao` (`CommissionDashboard.ts`) filtra por `mesReferencia` (formato "YYYY-MM") contra `CommissionEvent.eventDate`.
3. **Campos de evento de êxito** — `CommissionEvent.businessProcessId` também era calculável mas nunca gravado (mesmo padrão do bug de closer/analista) — corrigido no `sync-engine.ts` (Fase 2, êxito). `BuscarEventoComLancamentos` agora resolve `dataExito`/`tentativas`/`deferidoPrimeiraTentativa` do `BusinessProcess` vinculado; `EventoComissaoCard.tsx` exibe esses 3 campos só quando `eventType === "PROCESS_SUCCESS"`, com "Não informado" quando não há `BusinessProcess` (mesmo caso da divergência `EXITO_SEM_BUSINESS_PROCESS` já existente).

165 testes no total (163 + 2 novos de `businessProcessId`/tentativas no sync-engine). Verificação final: tsc no baseline, lint limpo, `next build` OK.

### Auditoria de negócio completa (2026-07-30, mesma sessão): correções financeiras reais no motor de regras

Usuário forneceu especificação detalhada de negócio + 7 PDFs reais de espelho (comissão/prêmio de colaboradores reais) para validar o motor de regras contra a realidade. A maior parte já batia (percentuais/valores fixos, calendário CLT/PJ, regra de desconto 10%), mas a auditoria encontrou 3 divergências financeiras reais:

1. **Fórmula do DSR estava errada.** Era uma fórmula agregada mensal com `diasUteis`/`diasNaoUteis` HARDCODED (22/9, nunca calculados) — nunca batia com a realidade. Fórmula correta (validada matematicamente contra o espelho real da Maria Eduarda, Jun/2026): `DSR = (comissão base ÷ dias úteis do mês) × dias de descanso do mês`, aplicada POR LANÇAMENTO INDIVIDUAL, usando dias úteis/descanso reais do mês do evento (não agregado). "Dias de descanso" = domingos + feriados NACIONAL+ESTADUAL(SC)+MUNICIPAL(Balneário Camboriú) — sábado NUNCA conta. Para Analista II (R$250) e Sênior (R$350), o valor é um TOTAL FIXO (comissão+DSR combinados, não comissão fixa + DSR separado) — decomposto algebricamente via `decomporTotalFixoComDsr()` (`dsr-formula.ts`) de forma que a soma nunca diverge do total configurado (resto do arredondamento sempre vai pro DSR). Novo `CalculationType`: `TOTAL_FIXO_COM_DSR` (`types.ts`), tratado como caso especial em `entry-generator.ts` (gera 2 `EntryComponent` de uma vez, pula o grupo DSR separado do loop de `benefitTypes` pra não duplicar). `calendar-engine.ts` ganhou `contarDiasUteisEDescansoDoMes()`.
2. **Closer não recebe DSR** (estava recebendo por engano) — regra `closer-dsr-contratacao` removida de `seed-rules.ts`.
3. **Diretor Operacional era `BONUS`, deveria ser `COMMISSION`** — confirmado pelo usuário que o cargo é PJ, logo os R$400 (êxito) + R$150 (primeira tentativa) são ambos comissão (se um dia virar CLT, os R$150 passam a ser prêmio — não é o caso hoje).

**Gerador de espelho reescrito do zero** para bater com o formato REAL usado pela empresa (validado contra os 7 PDFs) — o formato técnico anterior (6 abas: Resumo/Lançamentos/Memória/Regras/Ajustes/Metadados) nunca foi o entregável real. Novo formato: **sempre 1 espelho = 1 colaborador** (nunca mistura vários), 1 aba única, cabeçalho com período/cargo/colaborador, tabela simples (`Data | Empresa | Comissão | DSR | Total` para comissão; `Data | Empresa | Êxito | De Primeira | Total` para prêmio — "de primeira" identificado pelo nome da regra na memória de cálculo, nunca hardcoded), subtotais, total, linha de assinatura (`preview-builder.ts`, `xlsx-generator.ts`, `pdf-generator.tsx` todos reescritos). `TipoEspelho` agora é só `"comissoes" | "premios"` (removidos `"comissao_dsr"`/`"todos"`, que não existem no negócio real). `ModalExportarEspelho.tsx` ganhou seletor de colaborador real (antes era campo de ID livre) e período por mês/semana(dom-sáb)/data livre (antes só data livre). `PreviaEspelho.tsx` ganhou edição inline dos valores antes de exportar — os ajustes só afetam o arquivo gerado (nunca persistem no `CommissionEntry` real; para ajuste permanente e auditado, usar "Ajuste Manual" no modal de detalhes).

**Abas de Configurações viraram modais** — o padrão anterior (`Tabs` com 10 abas) montava TODAS simultaneamente na primeira renderização (Radix Tabs é só CSS, não desmonta), disparando ~10 fetches de uma vez — causa real da lentidão relatada pelo usuário ("cada aba que abre e volta as tabelas ficam recarregando"). `ConfiguracoesComissoes.tsx` reescrito: grid de botões/cards, cada um abre um `Dialog` que só monta o componente da seção quando aberto (padrão do Checklist RADAR, referência pedida pelo usuário). `ModalDetalhesLancamento.tsx` (único outro uso de `Tabs` no módulo) foi auditado e confirmado como caso SEGURO — as 7 abas ali compartilham 1 único fetch já feito pelo componente pai, não precisou virar modais separados.

175 testes no total (152 originais + 23 novos/reescritos desta auditoria). Verificação final: `tsc` no baseline, lint limpo, `next build` OK.

---

## Padrão de módulo (referência: Extratos Bancários, reescrito 2026-07-09)

Todo módulo novo/reescrito deve seguir esta estrutura:

```
src/app/PainelAlpha/[Modulo]/page.tsx        # FINO — só importa e renderiza o componente principal
src/app/PainelAlpha/[Modulo]/[Id]/page.tsx   # (se houver detalhe) idem, fino

src/components/[Modulo]/
├── [Modulo]Listagem.tsx      # componente principal da listagem
├── [Modulo]Detalhe.tsx        # componente principal do detalhe (se houver)
├── Modal*.tsx                  # modais do módulo, nomes descritivos (não "PainelX"/"ModalY" genéricos)
├── Tabela*Paginada.tsx         # se precisar paginação real, ver padrão abaixo
└── lib/
    ├── formatters.ts           # funções puras de formatação (nunca duplicar entre componentes)
    ├── exportar-excel.ts        # se houver exportação (ExcelJS)
    └── [outros helpers puros]

src/actions/[Modulo].ts          # Server Actions: sempre auth() + Zod + paginação quando listar muitos registros
```

**Exemplo real (Extratos Bancários):** `src/components/Extratos/` tem `ExtratosListagem.tsx`, `ExtratoDetalhe.tsx`, `ModalNovaEmpresa.tsx`, `ModalVincularBanco.tsx`, `ModalNovoPeriodo.tsx`, `ModalUploadExtrato.tsx`, `ModalConferencia.tsx`, `ModalTransacoesSalvas.tsx`, `TabelaTransacoesPaginada.tsx` (primeiro componente de paginação real do painel — reutilizável, ver `components.md`), e `lib/{exportar-excel,bancos-catalogo,formatters}.ts`.

### Padrão de paginação server-side (novo, estabelecido nesta sessão)
Actions de listagem aceitam `{ page?, pageSize?, busca? }` e retornam `{ success, data, total, page, pageSize, totalPages }`. Componente cliente usa debounce (~400ms) no campo de busca e reseta `page` para 1 ao mudar o filtro. Ver `src/actions/transacao.ts` (`BuscarTransacoesPorBanco`) e `src/actions/Extratos.ts` (`ListarExtratos`) como referência de implementação, e `TabelaTransacoesPaginada.tsx` como referência de componente reutilizável.

### Padrões de UI adotados (ver `.bibble/rules/styling-rules.md` para detalhe)
- Fundo `bg-[#020617]`, cards `rounded-[2.5rem]`/`rounded-[3rem]`, `border-white/5`, `backdrop-blur-xl`
- Accent color via `src/lib/temas.ts` (indigo/blue é o padrão mais comum)
- `AlertDialog` (`@/components/ui/alert-dialog`) para confirmações destrutivas — substituindo `confirm()` nativo (Extratos foi o primeiro módulo a adotar)
- `Badge` (`@/components/ui/badge`) para indicadores de status
- `next/image` sempre, nunca `<img>`
- `sonner` para toasts

---

## Dependências Críticas

| Lib | Versão | Uso |
|---|---|---|
| `next` | 16.1.6 | Framework (App Router, Turbopack) |
| `react` / `react-dom` | 19.2.3 | UI |
| `next-auth` | ^5.0.0-beta.30 | Autenticação (`auth()`) |
| `@prisma/client` + `prisma` | ^6.19.2 | ORM — schema em `prisma/schema.prisma` |
| `@prisma/adapter-libsql` + `@libsql/client` | ^7.8.0 / ^0.17.3 | Runtime conecta no **Turso remoto** via adapter (`src/lib/prisma.ts`), NÃO via `DATABASE_URL` do schema — ver `decisions.md` sobre migrations |
| `tailwindcss` | ^4.1.18 | Estilização (config via `@theme` no CSS, sem `tailwind.config.js`) |
| `three` | ^0.185.1 | Backgrounds/gráficos WebGL (ex: `animated-shader-background.tsx`) |
| `@react-three/fiber` + `@react-three/drei` | ^9.6.1 / ^10.7.7 | Renderizador React p/ three.js — componentes 3D do Alpha Presentation Studio (Globo/Partículas/Objeto3D, Onda 4) |
| `zod` | — | Validação de input em toda Server Action/rota |
| `sonner` | ^2.0.7 | Toasts |
| `framer-motion` | ^12.38.0 | Animações de modal/transição |
| `exceljs` | ^4.4.0 | Exportação de relatórios Excel (ex: `exportar-excel.ts`) |
| `zustand` | ^5.0.12 | Estado global de UI |
| `pusher` / `pusher-js` | ^5.3.3 / ^8.4.0 | Real-time (chat, notificações) |

---

## Notas de arquitetura importantes

- **Banco real ≠ `.env` local**: o app SEMPRE conecta ao Turso remoto via `PrismaLibSql` adapter, independente do `datasource db`/`DATABASE_URL` do `schema.prisma` (que é decorativo neste projeto). `prisma db push`/`migrate` NÃO alcançam produção — mudanças de schema exigem script Node pontual com `@libsql/client/web`. Ver `decisions.md` (2026-07-06 e 2026-07-09).
- **Pipeline de IA para documentos** (`src/lib/bibble/tika.ts`): Tika (primário) → pdf-parse v2 (fallback) → PDF24-OCR (último recurso, PDFs sem texto nativo). `pdfjs-polyfill.ts` é obrigatório antes de qualquer `import("pdf-parse")` (ver `known-errors.md`). O upload e o chat compartilham limites/validação por `attachment-security.ts`; o conteúdo grande é reduzido de forma explícita pelo orçamento, preservando início, meio e fim.
- **Módulos renderizam dentro de um `<iframe>`** a partir de `/PainelAlpha` (`PainelLayoutClient.tsx`) — atenção a isso ao debugar problemas de layout/canvas que só aparecem em produção real do painel, não em teste isolado da rota.

---

## CS & NPS — Exportação completa relacional

**Adicionado em:** 2026-07-15 por Scribe

O módulo `src/app/PainelAlpha/CadastroClientes/` oferece a Admin e CEO o botão **Exportar dados**, ao lado de **Novo Cliente**. `BotaoExportarDados.tsx` chama `GET /api/cs-nps/exportar`, bloqueia cliques durante o processamento, trata 401/403/erros seguros, baixa o blob usando o nome retornado em `Content-Disposition` e revoga a URL temporária.

**Arquivos da feature:**

- `src/app/PainelAlpha/CadastroClientes/page.tsx` — integra o botão e o exibe apenas quando `session.user.role` é `Admin` ou `CEO`.
- `src/app/PainelAlpha/CadastroClientes/BotaoExportarDados.tsx` — cliente de download e feedback visual.
- `src/app/api/cs-nps/exportar/route.ts` — Route Handler autenticado, autorização, auditoria e resposta `.xlsx`.
- `src/lib/cs-nps/exportar-dados.ts` — consulta Prisma e geração server-side com ExcelJS.

**Escopo exportado:** `clientes.findMany` não filtra por status; portanto inclui empresas ativas e arquivadas. O workbook preserva as ligações por `clienteId` e contém nove abas: `Empresas`, `Socios`, `CS`, `Feedbacks`, `Log Alteracoes`, `Historico Cliente`, `Indicacoes`, `CRM Oportunidades` e `CRM Contatos`. A aba `Empresas` inclui os campos de NPS e Google (`nps`, `feedbackGoogle`, `nomeGoogle`), `quantidadeSocios` e `sociosResumo`; este último reúne todos os campos de cada sócio em uma célula multilinha. A aba `Socios` mantém uma linha por sócio e acrescenta o contexto da empresa (`clienteRazaoSocial`, `clienteCnpj`, `clienteServico`), além do vínculo técnico por `clienteId`.

**Apresentação do workbook:** todas as abas recebem cabeçalho escuro, texto legível, bordas, linhas zebradas, autofiltro, primeira linha congelada, quebra de texto e larguras/alturas calculadas conforme o conteúdo. Na aba `Empresas`, `feedbackGoogle` usa verde para `SIM` e vermelho para `NÃO`; o `status` usa verde para `Deferido`, vermelho para valores iniciados por `Cancelado`, amarelo para `Stand By`, azul para `Em andamento` e cinza para `Arquivado`.

**Contrato de datas:** a formatação é aplicada somente às 18 colunas explicitamente declaradas no exportador. Cinco campos civis usam `dd/mm/yyyy` sem conversão de fuso: `Empresas.dataConstituicao`, `Empresas.dataContratacao`, `Empresas.dataExito`, `Socios.dataNascimento` e `CRM Oportunidades.dataFechamento`. Treze campos de instante usam `dd/mm/yyyy hh:mm` em `America/Sao_Paulo`: `Empresas.createdAt`, `Empresas.updatedAt`, `CS.dataRegistro`, `Feedbacks.dataRegistro`, `Log Alteracoes.dataAlteracao`, `Historico Cliente.criadoEm`, `Indicacoes.dataIndicacao`, `Indicacoes.comprovanteEnviadoEm`, `Indicacoes.createdAt`, `CRM Oportunidades.createdAt`, `CRM Oportunidades.updatedAt`, `CRM Contatos.createdAt` e `CRM Contatos.updatedAt`. Valores nulos permanecem vazios; valores não reconhecidos ou datas inválidas permanecem como texto, sem coerção silenciosa.

**Segurança e operação:** a UI é somente conveniência; a rota repete a autorização no servidor, exigindo sessão válida, role normalizada `admin`/`ceo` e permissão efetiva `Cliente`. A exportação registra `EXPORTAR_CS_NPS_COMPLETO` em `auditoria`, usa `force-dynamic`, `maxDuration = 60`, headers `no-store`, `nosniff` e `noindex`. O helper neutraliza strings que poderiam ser interpretadas como fórmulas (`=`, `+`, `-`, `@`, inclusive após whitespace), congela o cabeçalho e adiciona autofiltro.

**Última atualização:** 2026-07-15 por Scribe

---

## Agenda Alpha — rota legada CalendarioAlpha via Domain-Wide Delegation

**Adicionado em:** 2026-07-17 por Scribe (sessão Bibble, a partir de prompt gerado pelo Phantom)

**⚠️ Arquitetura mudou DENTRO da mesma sessão.** A primeira versão implementada era OAuth 2.0 individual (cada usuário clica "Conectar" e autoriza no Google, token criptografado por usuário). Já testada, migrada e auditada, o usuário esclareceu que queria replicar o modelo do Onyx (credencial única, `usuarios.token_onyx`) em vez de consentimento por pessoa. Depois de confirmar que (a) `usuarios.email` é o mesmo e-mail do Google Workspace de cada colaborador e (b) a empresa tem Super Admin do Workspace, a arquitetura foi **totalmente reconstruída** para **Domain-Wide Delegation**: uma Service Account, autorizada uma única vez pelo Super Admin no Admin Console, impersona qualquer usuário do domínio via `google.auth.JWT({ subject: usuarios.email })`. **Não existe mais OAuth por usuário nem token individual armazenado.**

**Consequência aceita conscientemente:** só funciona para contas Google Workspace da empresa — conta pessoal (Gmail) não é mais suportada (a decisão original de aceitar "ambas" foi substituída).

**Escopo do MVP:** seleção de calendários + visões mês/agenda + CRUD de evento + FreeBusy (implementado, sem UI ainda) + sync incremental com cache local. **Fora do MVP:** webhook, vínculo com Reserva de Salas/Clientes/Tarefas, recorrência avançada (série vs. ocorrência), semana/dia como grades dedicadas.

**Arquivos centrais:**
- `src/lib/google-calendar/` — `client.ts` (`google.auth.JWT` com impersonation — TODA função recebe `emailUsuario`, nunca um token), `sync.ts` (motor de sync full/incremental, reset controlado em `410`), `usuario-google.ts` (resolve `emailUsuario` **sempre** a partir de `usuarios.email` da sessão, nunca de input do cliente — é o ponto crítico de segurança deste módulo), `cache-eventos.ts` (mapeamento evento Google → cache, cobre all-day via `.data`), `autorizacao.ts`, `auditoria.ts`, `errors.ts`, `scopes.ts`, `types.ts`.
- `src/lib/validations/google-calendar.ts` — Zod (criar/atualizar/cancelar evento, selecionar calendário, FreeBusy).
- `src/actions/google-calendar-conexao.ts` (ativar/desativar — puramente local, sem chamada ao Google) e `src/actions/google-calendar-eventos.ts` (CRUD, sync, seleção de calendário, FreeBusy).
- **Sem Route Handlers** — não há mais fluxo OAuth com redirect, então tudo é Server Action.
- `src/app/PainelAlpha/CalendarioAlpha/page.tsx` + `src/components/CalendarioAlpha/` (Dashboard, EstadoDesconectado ["ativar"], Header, VisaoMes, VisaoAgenda, SeletorCalendarios, FormularioEvento, DetalheEvento, `lib/datas.ts`, `lib/tipos.ts`).
- `prisma/schema.prisma` — 3 models: `GoogleCalendarConexao` (1:1 com `usuarios`, **sem token nenhum** — só `status`/`ativadoEm`/`desativadoEm`/`ultimaSincronizacaoEm`), `GoogleCalendarSelecionado`, `GoogleCalendarEventoCache`.
- `scripts/calendar-alpha-doctor.mjs` — valida env vars da Service Account (nunca imprime segredo).
- `tests/google-calendar/` — 64 testes (errors, validations, cache-eventos, sync com mocks de Prisma/client, usuario-google, datas puras da UI).

**Removidos na reconstrução (não usar como referência):** `crypto.ts` (AES-GCM), `oauth-state.ts` (HMAC state), `nonce.ts` (consumo único), `token-manager.ts` (renovação de access token), `src/app/api/calendario-alpha/oauth/{connect,callback}/route.ts`, model `GoogleCalendarOAuthNonce`. Todos faziam sentido no modelo OAuth-por-usuário; nenhum se aplica a Domain-Wide Delegation.

**Variáveis de ambiente (v2, substituem as do OAuth):** `GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL` (`client_email` da chave JSON da Service Account), `GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY` (`private_key`, com `\n` literais). Pré-requisito manual fora do código: Client ID numérico da Service Account autorizado no Admin Console do Workspace (Security → API Controls → Domain-wide Delegation) com os escopos exatos de `scopes.ts`.

**Decisão de arquitetura chave (segurança):** `emailUsuario` — usado para impersonar qualquer conta do domínio — **NUNCA** pode vir de um valor fornecido pelo cliente. Toda action resolve via `obterUsuarioGoogleAtivo(acesso.userId)`, que lê `usuarios.email` no servidor a partir do `userId` da sessão. Auditado explicitamente por Anubis após o redesenho. Se algum código novo neste módulo aceitar um e-mail vindo de `input`/`dados` do cliente para a impersonation, é uma regressão de segurança grave — bloquear.

**Decisão de arquitetura (dados):** eventos NÃO são espelhados integralmente — `GoogleCalendarEventoCache` guarda só título/horário/status/etag; descrição/participantes/link do Meet ficam só no Google. Google Calendar continua fonte de verdade única.

### Onda cache-first e reestruturação visual (2026-07-30)

O nome visível passou a ser **Agenda Alpha**, sem alterar `/PainelAlpha/CalendarioAlpha`, o id/permissão `calendarioAlpha` ou os gates de sessão. A rota é cache-first: o SSR lê exclusivamente `GoogleCalendarEventoCache`; Google Calendar só é consultado pela sincronização manual explícita ou por ações ao vivo também explícitas, como agendas compartilhadas.

**Backend:** `src/actions/google-calendar-sync.ts` consolida a sincronização por conexão; `src/lib/google-calendar/sync-orchestrator.ts` fornece dedupe/cooldown in-process e resultados tipados por calendário; `sync.ts` só troca cache e `syncToken` em transação após todas as páginas, inclusive na recuperação de `410 Gone`. `google-calendar-eventos.ts` carrega o recurso completo antes de editar; PATCH parcial usa `If-Match`/ETag e preserva descrição, metadados de participantes e Google Meet quando não alterados.

**Frontend:** `CalendarioAlphaDashboard.tsx` foi reduzido a orquestrador; `AgendaSidebar.tsx`, `StatusSincronizacao.tsx`, `AgendaModal3D.tsx`/`AgendaOverlays.tsx`, `ConteudoAgenda.tsx` e hooks em `lib/` concentram sidebar, estado de sync, modais 3D responsivos e controle da tela. `invalidation.ts` sincroniza abas/iframes por `BroadcastChannel`, com fallback `storage`/evento DOM e dedupe contra loops.

**Ajuste de viewport (2026-07-31):** o layout da rota, dashboard, corpo e grade formam uma cadeia `h-dvh`/`h-full` + `min-h-0`. A sidebar desktop usa larguras responsivas menores (`lg`/`xl`/`2xl`) e rola somente suas listas; mês usa seis linhas flexíveis e dia/semana rolam somente as horas. Ao alterar a composição da Agenda, preservar essa cadeia — remover um `min-h-0` intermediário faz o módulo voltar a crescer além do iframe.

**Privacidade:** consultas ao vivo de colegas continuam sob Domain-Wide Delegation e permissão assimétrica. Usuário comum recebe apenas blocos “Ocupado”, sem título, e-mail, Meet, ETag ou id real; Admin/CEO mantém detalhes e escrita. Agendas compartilhadas não entram no snapshot SSR e só são buscadas ao vivo após ação explícita.

**Fase 2A operacional (2026-07-30):** coordenação entre réplicas, fila e push agora existem no código e no schema, mas permanecem **flags-off**. A migration autorizada pelo Vault foi aplicada uma única vez e validada no Turso: `GoogleCalendarPushChannel`, `GoogleCalendarPendingOperation` e `GoogleCalendarSyncLease`, com 7 índices explícitos e 3 unicidades.

**Mapa:** webhook em `src/app/api/calendario-alpha/webhook/route.ts`; fila/lease em `sync-queue.ts` e `distributed-lock.ts`; canais em `client.ts` e `push-channels.ts`; fencing em `sync-orchestrator.ts` e `sync.ts`; operação em `worker.ts`, `maintenance.ts`, `runtime-config.ts` e `observability.ts`; CLIs em `scripts/calendar-alpha-{doctor,worker,maintenance,queue}.mjs`.

**Runbook:** manter flags desligadas e consultar doctor/status; ativar lock → fila → push somente depois de URL HTTPS pública, WAF/rate limit distribuído, scheduler supervisionado e E2E Google/Turso multi-instância; iniciar por canário. 183 testes Agenda Alpha, Forge build/lint/schema, Probe, Anubis, Lens e Sage passaram. Typecheck mantém quatro baselines externos.

**Última atualização:** 2026-07-30 por Scribe

### Extensão Bibble/IAlpha — 10 tools de agenda (2026-07-23)

**Adicionado em:** 2026-07-23 por Scribe.

O núcleo conversacional do calendário vive em `src/lib/bibble/calendar-tools.ts`. Ele implementa 10 operações: listar calendários; listar/criar/editar/cancelar eventos próprios; FreeBusy; consultar agenda de colega; e criar/editar/cancelar evento de colega para Admin/CEO. O catálogo externo permanece em `src/lib/bibble/tools.ts`, o roteamento em `src/lib/bibble/tool-executor.ts`, as regras em `src/lib/bibble/system-prompt.ts` e a orquestração HTTP/SSE em `src/app/api/bibble/chat/route.ts`.

**Autorização e isolamento:** o chat recarrega status, role e `getPermissoesEfetivas(userId)` do banco em cada requisição. As tools não aceitam `userId`, `colegaId`, `calendarId` ou e-mail de impersonation do modelo: usuário vem da sessão; colega é resolvido por nome/e-mail com retorno de candidatos em caso ambíguo; calendário é escolhido somente entre a allowlist da conexão. Consulta de colega respeita compartilhamento, enquanto Admin/CEO pode consultar e executar CRUD na agenda de qualquer colaborador ativo.

**Tempo, volume e ordem:** datas com horário exigem ISO 8601 com offset; datas civis são interpretadas em `America/Sao_Paulo`, e o horário atual dessa timezone é injetado no prompt. A janela máxima é 60 dias e cada consulta retorna até 200 eventos. O loop executa tools sequencialmente e limita 6 por turno, 12 por requisição e 3 mutações de calendário.

**Escritas seguras:** edição própria e de colega usa patch parcial em `src/actions/google-calendar-{eventos,admin}.ts`, validado por `src/lib/validations/google-calendar.ts`; `src/lib/google-calendar/client.ts` envia ETag em `If-Match`, evitando sobrescrever mudança concorrente. Cancelamento próprio/de colega exige confirmação em duas fases. Mutações idênticas são deduplicadas dentro da requisição.

**Banco:** esta extensão não alterou schema, não executou migration e não exigiu Vault.

**Qualidade:** ESLint escopado nos 14 arquivos PASS; 16 arquivos/122 testes PASS; Next build PASS; diff-check PASS. O typecheck global preserva 4 erros baseline fora do diff (Exclusão Fiscal x2 gerados, `ModalPerfilColaborador`, `HabilitacaoRadarClient`). Probe e Lens PASS; Anubis CONCERNS sem blocker, com dívidas conhecidas de rate limit cross-request, idempotência persistente e token persistente/específico de confirmação.

**Pendências conhecidas, documentadas conscientemente:** sem rate limit em nenhuma action; `consultarDisponibilidade` (FreeBusy) implementada mas ainda não chamada pela UI; sem webhook; sem Service Account real configurada para validar E2E neste ambiente.

**Editado quando:** a Fase 2 (webhook, vínculos internos) for confirmada e implementada, ou se o suporte a conta pessoal (Gmail) precisar voltar (exigiria reintroduzir o fluxo OAuth em paralelo à Domain-Wide Delegation).

**Última atualização:** 2026-07-30 por Kowalski

---

## CS & NPS — Importação em lote

**Adicionado em:** 2026-07-15 por Scribe

O módulo `src/app/PainelAlpha/CadastroClientes/` oferece a Admin e CEO o botão **Importar em lote**. O fluxo client-side vive em `importacao/` e conduz quatro etapas: seleção livre de `Sócios`, `CS` e/ou `Feedbacks`; download do modelo; upload e revisão detalhada; resultado da confirmação. A prévia não grava no banco, agrupa as linhas por empresa/serviço, permite selecionar o `clienteId` correto quando um mesmo CNPJ possui vários serviços e permite remover linhas antes de salvar.

**Superfície HTTP:**

- `GET /api/cs-nps/importar/modelo?tipos=socios,cs,feedbacks` — gera um `.xlsx` com `Instrucoes` e somente as abas selecionadas.
- `POST /api/cs-nps/importar/previsualizar` — recebe `multipart/form-data`, valida o arquivo e devolve o status e os candidatos de destino de cada linha.
- `POST /api/cs-nps/importar/salvar` — revalida o payload e os destinos e persiste toda a seleção em uma transação Prisma.

**Contrato do workbook:** `Socios` usa `cnpj`, `razaoSocial`, `nome`, `telefone`, `observacao`, `dataNascimento`, `vinculo`; `CS` e `Feedbacks` usam `cnpj`, `razaoSocial`, `colaborador`, `sentimento`, `observacao`, `dataRegistro`. CNPJ ou razão social identifica a empresa. Vários sócios usam várias linhas com o mesmo identificador. Abas/cabeçalhos extras, fórmulas e macros são rejeitados.

**Arquivos centrais:**

- `src/app/PainelAlpha/CadastroClientes/importacao/` — botão, modal, etapas, cartões da prévia, resumo final, cliente HTTP e cálculos puros da revisão.
- `src/app/api/cs-nps/importar/{modelo,previsualizar,salvar}/route.ts` — contratos HTTP, headers seguros, origem/content type/tamanho e auditoria operacional.
- `src/lib/cs-nps/importar-dados.ts` — geração e leitura ExcelJS, validações Zod, matching de empresas, revalidação e gravação transacional.
- `src/lib/cs-nps/importacao-tipos.ts` — contratos compartilhados da prévia, linha confirmada e resumo por empresa.
- `src/lib/cs-nps/preflight-xlsx.ts` — leitura ZIP streaming com `yauzl` antes do parse completo pelo ExcelJS.
- `src/lib/cs-nps/importacao-rate-limit.ts` — limite defensivo por instância, usuário e IP para a prévia.
- `src/lib/cs-nps/autorizacao.ts` — autorização administrativa compartilhada pela importação e exportação.
- `tests/cs-nps/` — testes Vitest do modelo/prévia/salvamento, cálculos client-side e preflight ZIP.

**Integridade e limites:** o upload aceita somente `.xlsx` de até 10 MB e até 2.000 linhas somadas. O preflight streaming limita a 256 entradas internas, 20 MB por entrada descompactada, 50 MB descompactados no total e razão de compressão 100:1, além de validar criptografia, caminhos, tamanhos reais e estrutura mínima. Na confirmação, o servidor torna a resolver CNPJ/razão social e só aceita um `clienteId` que continue entre os candidatos; cria `socios`, `log_cs` e `logFeedback` na mesma transação e grava `IMPORTAR_CS_NPS_SALVO` em `auditoria`.

**Escopo operacional:** o rate limit atual é em memória e por instância (cinco prévias por minuto por usuário+IP, sem prévias concorrentes para a mesma chave); não é distribuído entre réplicas. Chave persistente de idempotência para impedir uma segunda confirmação idêntica também não faz parte desta implementação; repetir manualmente o `POST /salvar` pode criar duplicatas e requer uma evolução coordenada de schema/infraestrutura.

**Última atualização:** 2026-07-15 por Scribe

---

## Sistema de Notas — camada global (fila `prompt-phases/`, Fases 01-05/8 concluídas — ✅ MIGRATION APLICADA EM PRODUÇÃO em 2026-08-07)

**Objetivo:** camada global de notas do Painel Alpha (barra inferior estilo abas de planilha, editor TipTap, Bloco de notas ALpha, vínculo com módulos/registros, colaboração, anexos/lembretes). Prompt mestre e as 8 fases vivem em `prompt-phases/00-contexto-geral.md` a `08-testes-ia-hooks-documentacao-final.md` (fila ativa — ver `prompt-phases/_status.md`).

**Atualização visual (2026-08-11):** o nome visível do módulo passou de “Central de Notas” para “Bloco de notas ALpha” em `CentralDeNotas.tsx`, `NotesGlobalTaskbar.tsx` e `modulos-registry.ts`. Os cards de `ListaNotas.tsx` usam `Note.color` no contorno quando a cor da aba está definida; cards sem cor preservam o estilo anterior. Nenhuma rota, permissão, action ou estrutura de banco mudou.

**Navegação da barra global (2026-08-11):** `NotesGlobalTaskbar` recebe `onOpenCentral` de `PainelLayoutClient` e usa o mesmo `openTab` da `GlobalSidebar` no botão “Central” e no atalho `Ctrl+Alt+N`. Assim, `/PainelAlpha/Notas` é criado ou ativado como aba/iframe do shell, sem `router.push` no documento externo. O controle final com seta foi removido; a visibilidade da barra continua sob responsabilidade do `NotesLauncherButton` da sidebar.

**Privacidade, lixeira e sincronização (2026-08-11):** o acesso a uma nota específica passou a ser sempre `ownerId` OU `NotePermission` explícita (`USUARIO`/`SETOR`/`ROLE`), inclusive para Admin/CEO/TI; o bypass administrativo permanece apenas no acesso ao módulo. `src/lib/notas/acesso.ts` centraliza os filtros Prisma. A lixeira da Central aceita seleção de cards, exclusão selecionada e esvaziamento, sempre com confirmação, Zod e filtro permanente `ownerId + status=LIXEIRA`. `NoteEditor` publica preview local de título/conteúdo a cada alteração. Fixações feitas dentro do iframe notificam o shell por `postMessage` same-origin (`notas-workspace-messages.ts`), e `NotesGlobalTaskbar` recarrega `UserOpenNoteTab` imediatamente.

**✅ As 11 tabelas do sistema (`Note`, `NoteContext`, `NotePermission`, `Tag`, `NoteTag`, `NoteVersion`, `NoteComment`, `NoteAttachment`, `NoteReminder`, `UserOpenNoteTab`, `UserNotesWorkspace`) existem de verdade no Turso de produção desde 2026-08-07** — ver `decisions.md` para o histórico completo do desbloqueio.

**Fase 05 (Colaboração + Histórico + Notificações) — concluída, aprovada por Forge/Probe/Anubis — MIGRATION APLICADA EM PRODUÇÃO durante esta fase:**
- `src/actions/NotasColaboracao.ts` (compartilhar/permissões/comentários/menções/histórico/restauração de versão).
- Notificações real-time via Pusher (`src/lib/notas/notificacoes.ts`, `src/hooks/useNotasNotifications.ts`, canal `private-notas-usuario-<id>` em `/api/pusher/auth`).
- Menção `@` via `@tiptap/extension-mention` (instalada na Fase 02, usada agora).
- Bug visual real corrigido (barra cobria a sidebar) + as 11 tabelas do sistema aplicadas no Turso real após confirmação explícita do usuário.

**Fase 04 (Contextos + Integração) — concluída, aprovada por Forge/Probe/Anubis (com escopo reduzido documentado):**
- `src/actions/NotasContexto.ts` + `src/components/Notas/Contexto/{NotesContextButton,NotesContextPanel,NoteLinkDialog}.tsx` + `src/components/Notas/NotesSearchCommand.tsx`.
- Integração real só em `chamados` (`DetalhesChamado.tsx`) — CS&NPS/Alpha Leads/Agenda Alpha pendentes, ver `decisions.md`.
- Achado de segurança corrigido: `entidadeReferenciadaExiste()` valida existência do registro antes de aceitar vínculo.

**Fase 03 (Central de Notas) — concluída, aprovada por Forge/Probe:**
- `src/app/PainelAlpha/Notas/page.tsx` — rota real, existe de verdade agora.
- `src/components/Notas/Central/{CentralDeNotas,SidebarFiltros,ListaNotas,PainelPropriedades,EstadoVazioNotas}.tsx`.
- `src/actions/NotasBusca.ts` — `BuscarNotas` (busca full-text + 9 seções), `FixarNota`/`FavoritarNota`/tags.
- `Note.isPinned` adicionado ao schema (mesmo lote de migration pendente da Fase 01).

**Fase 02 (Barra + Editor + Autosave) — concluída, aprovada por Forge/Probe:**
- `src/components/Notas/NotesGlobalTaskbar.tsx` + `NoteTab.tsx` + `NoteViewer.tsx` + `NoteEditor/{NoteEditor.tsx,slash-command.ts,SlashCommandList.tsx}` — barra fixa no rodapé, editor TipTap reaproveitando a base do Alpha Blueprint + extensões novas (cor/destaque/slash-command).
- `src/store/useNotasWorkspace.ts` (Zustand), `src/lib/notas-tabs.ts` (persistência local), `src/hooks/useNotasAtalhos.ts` (atalhos), `src/actions/NotasWorkspace.ts` (Server Actions de abas).
- `PainelLayoutClient.tsx` monta a barra fora do container de iframes.
- 5 pacotes TipTap novos instalados com versão pinada exata (ver `architecture.md`).

**Fase 01 (Fundação) — concluída, aprovada por Forge/Probe:**
- `prisma/schema.prisma` — 11 models novos (ver `architecture.md` para o detalhe completo do schema). **Migration real AINDA NÃO aplicada no Turso** — bloqueada pelo Vault aguardando confirmação do usuário (ver `decisions.md`).
- `src/lib/validations/notas.ts` — Zod (criar/atualizar/listar nota, vincular contexto, compartilhar, workspace, abas).
- `src/lib/notas/permissoes.ts` — `podeVisualizarNota`/`podeEditarNota`/etc., com herança de permissão contextual via `MODULOS_REGISTRY`/`getPermissoesEfetivas` e resolução de "nota de equipe" via `isSameRole()` contra `usuarios.role` (não existe tabela de Team no projeto).
- `src/actions/Notas.ts` — `CriarNota`, `AtualizarNota` (versão otimista), `ObterNota`, `ListarNotas` (paginado), `ArquivarNota`, `RestaurarNota`, `MoverNotaParaLixeira`, `ExcluirNotaDefinitivamente`.
- `src/lib/z-index.ts` (novo) — primeira escala de z-index centralizada do projeto.
- `src/lib/modulos-registry.ts` — entrada `notas` (categoria `infra`, ícone `StickyNote`) — rota ainda não existe (Fase 03).

**Próximas fases (não iniciadas ainda):** 02 (barra inferior + editor TipTap + autosave), 03 (Central de Notas — rota real nasce aqui), 04 (contextos/integração com módulos reais), 05 (colaboração/histórico/notificações), 06 (anexos/lembretes/auditoria), 07 (responsividade/acessibilidade/performance), 08 (testes/IA/documentação final).

**Última atualização:** 2026-08-11 por Scribe

---

## Alpha Motion — motor de animação do Presentation Studio (Fases 01-09 da fila `prompt-phases/`)

Sistema de animação/timeline do Alpha Presentation Studio, construído em fases sequenciais (Fundação → Animações básicas → Sequenciamento/Stagger → Timeline Visual → Transições entre Slides → Morph → Efeitos Especiais → Scroll/Controles do Player → Presets/Preview/Polimento). Detalhe completo de cada fase vive em `integration-points.md` (seção "Alpha Motion — Fase N"); esta entrada é só o mapa estrutural.

```
src/lib/apresentacoes/animacao/     # Núcleo: tipos, catálogo, motor, resolver, gatilhos, stagger, migração
  presets-stagger.ts                # Fase 03 — presets de 1 campo (StaggerConfig)
  presets-completos.ts              # Fase 09 — presets de TIMELINE INTEIRA (ElementAnimation[] parcial)
  responsivo.ts                     # Fase 09 — ResponsivoConfig + lerConfigResponsiva (customProperties.responsivo)
src/lib/apresentacoes/scroll/       # Fase 08 — scroll-reveal.ts (único modo implementado: "reveal")
src/components/Apresentacoes/Editor/RenderEngine/
  RenderComponente.tsx              # Render puro + fronteira RenderComponenteAnimado para compor a timeline
  AnimacaoElementoWrapper.tsx       # Executa ElementAnimation (auto/click/hover/visible) via Framer Motion
  EfeitosGlobaisSlide.tsx           # Wrapper por SLIDE (Dim Others/Focus Element/Card Expand — Fase 07)
  ScrollRevealWrapper.tsx           # Wrapper FINO por COMPONENTE (Scroll Reveal — Fase 08)
src/components/Apresentacoes/Editor/
  ReducedMotionSimuladoContext.tsx  # Fase 09 — toggle "reduzir animações" ISOLADO do Editor, nunca vaza pro player
  PainelDireito/camposPorTipo/
    PreviewMiniatura.tsx            # Fase 09 — miniatura DOM/CSS em loop (nunca vídeo/GIF), usa curvas.ts direto
    SeletorPreset.tsx                # Fase 09 — aplica preset ao elemento selecionado
    CamposResponsividade.tsx        # Fase 09 — UI dos 5 campos de ResponsivoConfig
  BarraSuperior/ModalAplicarPreset.tsx  # Fase 09 — aplicar preset a 1 slide ou a todos (AlertDialog + AtualizarSlide em loop)
src/apresentacoes-player/           # Bundle React OFFLINE (esbuild IIFE) embutido no .html exportado —
                                     # nunca importa next/* nem "use server" (guards no build)
src/components/Apresentacoes/ModoApresentacao/  # Player "ao vivo" dentro do painel (ModoApresentacaoClient.tsx)
                                     # — DIFERENTE do player exportado, mas mesmo padrão de Fullscreen/atalhos
```

**Regra estrutural:** `RenderComponente` continua puro e sem seleção ou efeitos entre irmãos. `RenderComponenteAnimado`, exportado pelo mesmo arquivo, é a fronteira compartilhada que resolve a timeline e compõe `ScrollRevealWrapper` + `AnimacaoElementoWrapper`; efeitos que precisam enxergar o slide inteiro continuam em `EfeitosGlobaisSlide`. Canvas, apresentação interna e player offline devem usar essa fronteira, inclusive ao renderizar filhos de containers.

**Lookup elementId→animação:** sempre via `resolverAnimacoesDoElemento()` (`animacao/resolver.ts`) — nunca duplicar esse filtro.

**Dois formatos de animação coexistem:** `ConfigAnimacao` legado e `ElementAnimation` novo. `RenderComponenteAnimado` prioriza a timeline nova apenas no elemento que possui `ElementAnimation`, evitando que a animação legada concorra visualmente; elementos sem timeline mantêm o fallback legado.

**Rich text editável:** `src/lib/apresentacoes/rich-text-edit.ts` sincroniza a edição do texto plano com parágrafos/runs importados e preserva a formatação fora do trecho alterado. `TextoProps.tsx` é a UI de edição global e por run; nunca atualizar apenas `propriedades.texto` quando `propriedades.richText` estiver presente, pois o renderer considera o rich text a fonte visual.

**Player/export responsivo:** `PlayerStandalone.tsx` usa raiz fixa no viewport e o CSS de `src/apresentacoes-player/player.css` zera margens, ocupa `html/body/#root` e bloqueia overflow. A escala canônica continua a cargo do hook de viewport e deve reagir a resize/fullscreen.

**Sidebar do editor:** `SidebarSlides.tsx` é uma gaveta recolhível com altura limitada e scroll próprio; `SidebarComponentes.tsx` ocupa o espaço restante e todas as categorias iniciam fechadas.

### Alpha Motion — importador PPTX de alta fidelidade

**Atualizado em:** 2026-08-07 por Scribe

```
src/lib/apresentacoes/pptx/
  parser.ts                 # Orquestra OOXML slide/layout/master/theme e gera modelo intermediário
  modelo-intermediario.ts   # Árvore canônica em EMU: source, transform, fill, text, effects e fallback
  matriz-transformacao.ts   # Matrizes afins para grupos, rotação e flips
  color-resolver.ts         # Cores RGB/theme/system + modificadores OOXML
  heranca.ts                # Placeholders e propriedades herdadas
  texto.ts                  # Paragraph/run, listas, tabs, autofit e FontResolver
  geometria.ts              # preset/custom geometry, paths e clip de imagem
  diagnostico.ts            # INFO/WARNING/FALLBACK/ERROR por elemento
  seguranca.ts              # Limites ZIP e bloqueio de caminhos/relações externas
  reference-renderer.ts     # PNG independente via PowerPoint COM quando disponível
  visual-diff.ts            # Original/Importado/Diferença e similaridade
  mapear.ts                 # Única fronteira do modelo PPTX para ComponenteSlide
src/app/api/apresentacoes/[id]/pptx-preview/route.ts    # Prévia sem persistência
src/app/api/apresentacoes/[id]/importar-pptx/route.ts   # Commit, asset original e deduplicação
scripts/render-pptx-reference.ps1                       # Export seguro pelo PowerPoint
tests/apresentacoes/pptx-ooxml-core.test.ts             # Regressões de cor/matriz/texto/herança/segurança
```

O render não é exclusivo da prévia: schema e componentes compartilhados propagam rich text, fontes, crop/tile, flip, opacidade, linha/seta, sombra e background gradiente para Editor, PortalPreview, modo apresentação e player offline. `CanvasArea.tsx` concentra o overlay "Debug PPTX". A story de referência é `docs/stories/story-alpha-motion-importador-pptx-alta-fidelidade.md`.

**Última atualização:** 2026-08-07 por Scribe (importador PPTX de alta fidelidade)

---

## CS & NPS — Modal de dados do cliente: botão único de salvar + auth em Clientes.ts

**Adicionado em:** 2026-07-22 por Scribe (sessão Bibble)

**Bug real corrigido:** `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx` tinha vários botões de "salvar" independentes (Dados Fiscais no rodapé, "Salvar Serviço" por card de Serviço Contratado, Sócios, CS, Feedback). A causa raiz: `salvarAlteracoesGeral` (`src/actions/Clientes.ts`) faz um update incondicional de TODAS as colunas de gestão do cliente — e duas seções diferentes (Dados Fiscais + card do serviço principal) chamavam essa mesma action para o MESMO registro, cada uma mandando os campos que a OUTRA gerencia como uma foto desatualizada (lida de `cliente!.campo`, não do estado editado). Quem salvava por último revertia silenciosamente a mudança de quem salvou antes — reproduzido exatamente como o usuário descreveu (editar analista, salvar serviço, salvar dados fiscais embaixo → erro/reversão).

**Decisão do usuário:** consolidar TUDO no modal (não só a parte que quebrava) em um único botão "Salvar Alterações" no rodapé — `handleSalvarTudo`. Adicionar/editar sócio, registrar/editar CS, registrar feedback deixaram de gravar na hora: viram rascunho local (`_pendente: "criar" | "editar"` injetado no item da lista) até o clique único. **Exclusões continuam imediatas** (excluir CS/feedback são ações destrutivas com `confirm()` próprio — decisão consciente de NÃO deferir uma exclusão já confirmada, para não criar a ilusão de que algo foi apagado quando na verdade só ficaria pendente).

**`handleSalvarTudo`:** salva o registro principal (dados fiscais + status/NPS/feedbackGoogle do cliente + seu próprio card de serviço, tudo com valores AO VIVO — corrige de quebra um bug lateral onde NPS/status eram lidos de `cliente!.nps`/`cliente!.status` desatualizados em vez do estado vivo do formulário), depois cada outro serviço contratado do mesmo CNPJ (`outrosServicos`), depois sócios/CS/feedback pendentes. **Falha parcial:** cada operação é tentada independentemente; as que falharem ficam listadas num único toast de erro; as que derem certo têm `_pendente` limpo do estado local (evita duplicar sócio/CS/feedback se o usuário clicar "Salvar Alterações" de novo após uma falha parcial). O modal só fecha (`onClose()`) se **nada** falhar.

**UI:** badge âmbar "Não salvo" nas 3 seções (sócios, CS, feedback) quando `_pendente` está setado — sem isso não haveria nenhuma pista visual de que algo ainda não foi persistido. `handleExcluirCS`/`handleExcluirFeedback` ganharam guard: se o item só existe no rascunho local (nunca foi salvo, `_pendente === "criar"`), remove sem chamar o servidor (evita erro tentando deletar um ID que não existe no banco).

**Achado extra do Anubis, corrigido na mesma sessão:** nenhuma das 8 Server Actions de `src/actions/Clientes.ts` usadas por esse modal (`salvarLogCS`, `salvarLogFeedback`, `salvarAlteracoesGeral`, `adicionarSocio`, `atualizarSocio`, `atualizarLogCS`, `excluirLogCS`, `excluirLogFeedback`) bloqueava requisição sem sessão — `adicionarSocio`/`atualizarSocio`/`atualizarLogCS` nem chamavam `auth()`; `salvarLogCS`/`salvarLogFeedback`/`salvarAlteracoesGeral` chamavam via `getUsuarioSessao()`/`getColaboradorNome()` mas nunca rejeitavam, só usavam fallback silencioso (`"Sistema"`/`userId: null`). Todas as 8 ganharam `if (!session?.user?.id) return { success: false, error: "Não autorizado" }` no início do `try`, mesmo padrão já usado em `Extratos.ts`/`RadarAction.ts`.

**Arquivos tocados:** `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx`, `src/actions/Clientes.ts`.

**Editado quando:** o mesmo padrão de "rascunho local + botão único" precisar ser replicado em outro modal do painel com múltiplas seções editáveis, ou se sócios ganharem exclusão (hoje não existe, só criar/editar).

**Última atualização:** 2026-07-22 por Scribe

---

## Consulta RADAR (Habilitação Radar) — Excluir do banco + page.tsx virou Server Component

**Adicionado em:** 2026-07-21 por Scribe (sessão Bibble)

**Descrição:** O módulo `src/app/PainelAlpha/HabilitacaoRadar/` ganhou um segundo botão de exclusão. O botão "Excluir (N)" original (`BotoesModal.tsx`, `bg-rose-600`) continua só limpando a tabela local (React state) — nenhuma mudança de comportamento. Ao lado dele, um novo botão **"Excluir do banco (N)"** (`bg-purple-950`, roxo escuro, fixo independente do tema, N = quantidade de selecionados que existem no banco) abre um `AlertDialog` de 3 fases (mesmo componente shadcn de `ExtratoDetalhe.tsx`, mas com 3 telas internas em vez de confirmar/cancelar simples):
1. **Confirmar** — mostra a quantidade exata que será apagada e avisa que é permanente em produção (Turso) e que os itens continuam na tabela (não somem da tela, só param de estar "sincronizados").
2. **Progresso** — barra de progresso (`atual/total`) processando CNPJ por CNPJ, sequencialmente (não é mais um único `deleteMany` — cada CNPJ chama `deletarRegistrosBanco([cnpj])` individualmente, permitindo diagnosticar exatamente quais falharam).
3. **Concluído** — resumo com contagem de excluídos vs. não encontrados no banco.

**Correção de diagnóstico (retrabalho na mesma sessão):** a 1ª versão usava `deleteMany` em lote único e não retornava `count`, então um `deleteMany` que não casava nenhuma linha (ex: CNPJ salvo com formatação diferente da usada no delete) reportava sucesso mesmo sem apagar nada — o usuário reportou "cliquei e o item continua no banco". Corrigido: `deletarRegistrosBanco` agora retorna `{ success, count }`; o loop conta separadamente "excluídos" (`count > 0`) vs. "não encontrados" (`count === 0`), e o toast final reflete a realidade em vez de assumir sucesso cego. Também corrigido: `handleBuscar` (consulta individual) não marcava `salvo: true` no estado local mesmo quando o registro já estava/ficava salvo no banco — sem isso, `temSelecionadoNoBanco`/`cnpjsSelecionadosNoBanco` nunca habilitavam o botão para CNPJs consultados um a um (o fluxo mais comum).

**Descoberta principal desta sessão:** a Server Action `deletarRegistrosBanco` (`src/actions/RadarAction.ts`) e o handler `handleDeletarDoBanco` **já existiam no código antes desta sessão**, junto com `temSelecionadoNoBanco` — mas eram órfãos: nenhum botão da UI os chamava (o prop `onDeletarDoBanco` chegava a ser passado até `FiltroTabela.tsx`, que nunca o usava). Foram reaproveitados, não recriados. `deletarRegistrosBanco` ganhou `auth()` (era a única action do arquivo sem essa checagem).

**Reestruturação de `page.tsx` (achado do Anubis, corrigido na mesma sessão):** a página inteira era um único Client Component (`"use client"`, ~1150 linhas) e **nunca verificava a permissão de módulo `radar`** — qualquer usuário autenticado no sistema acessava a URL direto, mesmo sem essa permissão atribuída. Isso já era assim antes, mas o novo botão aumentava o risco (de "ver dado que não deveria" para "poder apagar dado de produção"). Corrigido: `page.tsx` virou Server Component fino (`auth()` + `getPermissoesEfetivas()`, redireciona para `/PainelAlpha` se não-admin sem `radar`), seguindo **exatamente** o padrão de `Apresentacoes/page.tsx`. Todo o conteúdo antigo foi movido, sem alteração de lógica de negócio, para `src/components/ComponentesRadar/HabilitacaoRadarClient.tsx` (named export `HabilitacaoRadarClient`).

**⚠️ Padrão a checar em auditorias futuras:** a memória já registrava que só ~6 de 30 páginas de módulo fazem o check explícito de permissão (`Apresentacoes` foi a primeira). `HabilitacaoRadar` era uma das ~24 que não fazia — agora são ~7. Qualquer página de módulo que seja 100% Client Component (sem um Server Component `page.tsx` fino na frente) é candidata a ter essa mesma lacuna. Vale um passe do Probe/Anubis pelos módulos restantes, especialmente os que ganharem uma capacidade destrutiva nova.

**Decisão do Vault:** `deleteMany({ where: { cnpj: { in: cnpjs } } })` com filtro restritivo pelos CNPJs explicitamente selecionados pelo usuário foi classificado como 🟢 (CRUD normal, não "exclusão em massa irrestrita" — o próprio critério de ativação do Vault distingue os dois casos). `consultas_radar` é cache de consulta à Receita Federal, reconsultável; não exigiu backup pontual além da rotina diária já estabelecida.

**Limpeza:** `src/components/ComponentesRadar/FiltroTabela/FiltroTabela.tsx` tinha 2 props tipados (`temSelecionadoNoBanco`, `onDeletarDoBanco`) nunca usados no corpo do componente — removidos da interface, já que a funcionalidade real vive em `BotoesModal.tsx`.

**Arquivos tocados:**
- `src/actions/RadarAction.ts` — `deletarRegistrosBanco` ganhou `auth()`
- `src/components/ComponentesRadar/BotoesModal.tsx` — novo botão + `AlertDialog`
- `src/components/ComponentesRadar/FiltroTabela/FiltroTabela.tsx` — props mortos removidos
- `src/app/PainelAlpha/HabilitacaoRadar/page.tsx` — virou Server Component fino
- `src/components/ComponentesRadar/HabilitacaoRadarClient.tsx` (novo) — conteúdo integral movido de `page.tsx`

**Editado quando:** o mesmo padrão de gate de permissão precisar ser replicado em outro módulo client-monolítico, ou se `consultas_radar` ganhar conceito de ownership por usuário no futuro.

**Atualização 2026-07-21 (mesma sessão, rodada 3) — Fundo vivo próprio + correção de mascaramento de erro:**

- **Fundo vivo "Varredura Sonar":** `src/components/ComponentesRadar/RadarBackground.tsx` (novo) — anéis concêntricos fixos + linha de sweep rotativa via `conic-gradient` + blips piscando aleatoriamente, 100% Framer Motion (mesmo padrão arquitetural de `ChecklistBackground.tsx`, sem canvas/WebGL). Aplicado via `src/app/PainelAlpha/HabilitacaoRadar/layout.tsx`, que **já existia** (só `Toaster`+metadata) — foi mesclado, não sobrescrito, preservando o `Toaster` do qual todo o módulo depende.
- **Cards vivos:** `src/components/ComponentesRadar/CardComScan.tsx` (novo, reutilizável) — wrapper que adiciona uma linha de scan vertical no hover, na cor accent do tema. Usado em 7 cards de `HabilitacaoRadarClient.tsx` (4 stat cards, breakdown de submodalidade, consulta+importação, monitor de processamento).
- **Bug de mascaramento de erro corrigido em `src/app/api/ConsultaCompleta/route.ts`:** quando a chamada ao RADAR falhava tecnicamente (timeout/HTTP não-200/config ausente via `Promise.allSettled`), o código usava o default `"NÃO HABILITADA"` — uma falha técnica virando status de negócio final. O filtro de `handleReconsultarErros` já esperava literalmente `"ERRO NA CONSULTA"`, mas nada no pipeline produzia essa string, então esses registros nunca eram reconsultados. Corrigido: falha real de RADAR agora grava `situacao_radar: "ERRO NA CONSULTA"`. Mesmo princípio quando a Receita Federal falha: antes devolvia 502 sem salvar nada (registro nunca aparecia na tabela, nada para reconsultar); agora salva um placeholder de erro — **só se não existir dado bom prévio** (guard `jaTemDadosReais`, mesmo espírito do `isApenasCnpj` de `salvarDadosNoBanco`), para não destruir um registro válido por causa de uma falha transitória de reconsulta.
- **`stats.falhas`** (`HabilitacaoRadarClient.tsx`) alinhado para contar `"ERRO"`, `"ERRO NA CONSULTA"`, `"ERRO NA API"`, `"PENDENTE RADAR"`, `"NÃO LOCALIZADO"` além de `razaoSocial === "NÃO ENCONTRADO"` — achado do Lens durante a revisão (a correção do bug produzia a string certa, mas o card de estatística ainda não a contava).
- **Não fiel à API, mantido de propósito:** quando o RADAR responde com sucesso mas sem dados para o CNPJ, isso continua sendo tratado como resposta de negócio válida (`"NÃO LOCALIZADO"`/`"NÃO HABILITADO"`) — não é erro, é o que a API realmente respondeu.

**Atualização 2026-07-21 (mesma sessão, rodada 4) — Virtualização da tabela (performance em lotes de milhares de CNPJs):**

Lotes reais de usuário já chegaram a 8 mil CNPJs, e a tabela renderizava todas as linhas de uma vez (`empresasExibidas.map`), deixando o navegador lento pela quantidade de `<tr>` no DOM. Adicionada dependência **nova** `@tanstack/react-virtual@3.14.7` (primeira lib de virtualização do projeto — compatível com React 19 confirmado via peerDependencies antes de instalar). Técnica usada: `<table>` HTML nativo preservado (não convertido para divs) com 2 linhas de padding (`<tr>` com `height` calculada) simulando o espaço das linhas fora da janela visível — evita quebrar o alinhamento de colunas que aconteceria com posicionamento absoluto. `<thead>` ganhou `sticky top-0` como bônus (cabeçalho fixo ao rolar). Container da tabela ganhou `max-h-[70vh]` + `overflow-y-auto` (scroll próprio, dentro da página).

**Confirmado sem regressão:** `handleSelecionarTudo`, `exportarExcel` e os filtros operam sobre os arrays completos em memória (`empresas`/`empresasExibidas`), nunca dependeram de quantas linhas estão no DOM — continuam corretos com a lista inteira mesmo com só ~30-40 `<tr>` renderizados por vez. Coluna "N°" trocou o `index` do `.map` antigo por `virtualRow.index` (fornecido pelo próprio `@tanstack/react-virtual`, mesmo valor).

**Aviso de lint aceito conscientemente:** `useVirtualizer` dispara `react-hooks/incompatible-library` (warning, não erro) — biblioteca conhecidamente incompatível com o otimizador automático do React Compiler. Irrelevante aqui: o projeto não tem `experimental.reactCompiler` ativado em `next.config.ts`.

**Arquivos tocados:** `package.json` (+`@tanstack/react-virtual`), `src/components/ComponentesRadar/HabilitacaoRadarClient.tsx` (constante `ALTURA_LINHA_ESTIMADA`, `tabelaScrollRef`, `rowVirtualizer`, tabela reescrita com padding rows).

**Editado quando:** outra tabela do painel precisar do mesmo tratamento (mesmo padrão de padding-rows é reaproveitável) ou se a altura estimada de linha (34px) precisar de calibração por relato de scroll impreciso.

**Atualização 2026-07-21 (mesma sessão, rodada 5) — "NÃO HABILITADA" corrigido de vez + reconsulta restaurada:**

- **Correção definitiva:** em `getRadarData` (`ConsultaCompleta/route.ts`), quando o RADAR responde com sucesso mas sem registro de habilitação pro CNPJ (empresa existe na Receita, só não é habilitada), o fallback de `situacao` estava caindo em `"NÃO LOCALIZADO"` — corrigido para `"NÃO HABILITADA"` (string canônica usada em `statusBadge`/`filtroSituacao` em todo o resto do sistema). `"NÃO LOCALIZADO"` some do fluxo normal — resta só como valor histórico em registros antigos do banco.
- **Reconsulta "Não Habilitados" restaurada:** existia uma função órfã `prepararReconsultaLote` (duplicada em `RadarAction.ts` e `app/api/Reconsulta/ReconsultaRadar.ts`) que apagava registros do banco esperando um "robô de consulta" externo não localizado no projeto — importada em `HabilitacaoRadarClient.tsx` mas nunca chamada (dead code, confirmado por lint). Em vez de reativar esse mecanismo de proveniência incerta, `handleReconsultarErros` foi generalizada para `handleReconsultar(tipo: 'ERROS' | 'NAO_HABILITADOS')`, reaproveitando o motor de reconsulta ao vivo já funcional (barra de progresso, retry, `forcar=true`) — só troca o filtro de `alvo`. O import morto foi removido.
- **`BotaoReconsulta.tsx` (`ModalOpcoesReconsulta`):** props tipadas (antes `any`), 2º botão "Reconsultar Não Habilitados" restaurado (laranja/âmbar, ícone `ShieldAlert`, mesma paleta de `statusBadge` pra essa situação). Texto do 1º botão e do aviso de rodapé corrigidos — não descrevem mais "apaga do banco" (comportamento antigo que não existe mais nesse mecanismo).

**Arquivos tocados:** `src/app/api/ConsultaCompleta/route.ts`, `src/components/ComponentesRadar/HabilitacaoRadarClient.tsx`, `src/components/ComponentesRadar/BotaoReconsulta/BotaoReconsulta.tsx`.

**Pendência conhecida, fora de escopo:** `prepararReconsultaLote` continua existindo (duplicada) em `RadarAction.ts`/`ReconsultaRadar.ts`, agora 100% morta (nenhuma referência ativa no projeto). Não removida nesta sessão — decisão de limpar ou não é do usuário.

**Última atualização:** 2026-07-21 por Scribe

---

## POP (Documentos) + Gestão de Equipe — Confirmação de Leitura de Documento

**Adicionado em:** 2026-07-22 por Scribe (sessão Bibble)

**Descrição:** Módulo POP (`src/app/PainelAlpha/DocsAlpha/`) ganhou um botão "Confirmar Leitura" ao lado do nome do documento aberto (nas 2 barras — desktop e mobile), que abre um modal de confirmação e, ao aceitar, grava a leitura e troca o botão pra estado verde "Leitura Confirmada" permanentemente. O módulo Gestão de Equipe (`src/components/cadastro/AbaGestaoEquipe.tsx`) reflete isso no topo do card de cada colaborador: badge "Regimento Interno" (sempre visível, verde se lido/âmbar se não) + badge "Todos os documentos do setor lido" (verde, colapsado) ou "X/Y docs do setor lidos" (âmbar, contador) quando ainda faltam.

**Novo model:** `ConfirmacaoLeituraDocumento` (`id, documentoId, usuarioId, confirmadoEm`, `@@unique([documentoId, usuarioId])`, FK `onDelete: Cascade` pros dois lados). Vault classificou como 🟢 (`CREATE TABLE` puro, nenhuma coluna/tabela existente tocada). Mesmo sendo baixo risco, o usuário pediu um backup fresco antes de aplicar (não só confiar no backup diário de até 48h já existente) — feito via script pontual em `database-backups/pre-change/`, depois a migration (também script pontual, `node+@libsql/client`, confirmada via `PRAGMA table_info`/`PRAGMA index_list`) — mesmo padrão de scripts descartáveis já usado no projeto (`prisma db push`/`migrate` não alcançam o Turso remoto).

**Descoberta-chave que evitou reinventar campo:** `usuarios` não tem coluna `setor` própria — **"setor do usuário" É `usuarios.role`**, a mesma string usada em `documentos.setor` e já tratada como "setor" visualmente em `AbaGestaoEquipe.tsx` (badge do card já mostrava `user.role`). Sem essa descoberta, a feature exigiria um campo novo redundante.

**"Regimento Interno" sem campo de categoria:** não existe flag/tipo de destaque em `documentos` — identificado por `titulo` contendo "REGIMENTO INTERNO" (case-insensitive, `.includes`). Se o título do documento mudar no POP, a checagem para de encontrar — frágil por natureza, documentado conscientemente (não havia alternativa sem migration adicional para um caso de uso tão específico).

**Achado do Anubis, corrigido na mesma sessão:** `buscarStatusLeituraEquipe()` inicialmente só tinha `auth()` básico — qualquer usuário autenticado (não só quem gerencia equipe) podia chamar a action diretamente e ver o status de leitura de TODOS os colaboradores. Corrigido com o mesmo gate de `cadastro/page.tsx` (`ROLES_GESTAO_EQUIPE` ou permissão `"cadastro"` via `getPermissoesEfetivas`).

**Arquivos tocados:**
- `prisma/schema.prisma` — model novo + 2 relações reversas (`documentos.confirmacoes`, `usuarios.confirmacoesLeituraDocumento`)
- `src/actions/ConfirmacaoLeituraDocumento.ts` (novo) — `confirmarLeituraDocumento`, `buscarStatusLeituraEquipe`
- `src/app/PainelAlpha/DocsAlpha/page.tsx` — busca confirmações do usuário logado, passa como prop
- `src/app/PainelAlpha/DocsAlpha/DocsAlphaClient.tsx` — botão nas 2 barras + estado local
- `src/app/PainelAlpha/DocsAlpha/_components/PopModalConfirmarLeitura.tsx` (novo)
- `src/components/cadastro/AbaGestaoEquipe.tsx` — badges no card

**Editado quando:** "Regimento Interno" ganhar um campo de categoria/destaque de verdade (substituiria o `.includes()` por string), ou se outro documento precisar do mesmo tratamento de destaque (nesse caso, vale generalizar para uma lista configurável em vez de um único título hardcoded).

**Última atualização:** 2026-07-22 por Scribe

---

## Alpha Blueprint — Central de especificação de sistemas (módulo novo, MVP completo)

**Adicionado em:** 2026-07-27 por Scribe (sessão Bibble, execução completa da fila de fases via Scout→Vault→Iris→Echo→Nova→Cortex/Pulse→Anubis→Forge→Probe→Lens→Sage)

**Descrição:** Central progressiva de especificação de sistemas — cada projeto reúne Kanban de acompanhamento, editor de texto rico (especificação), canvas visual infinito (fluxos/wireframes), central de arquivos, requisitos estruturados, perguntas/dúvidas, comentários, histórico de atividade e um assistente de IA isolado por projeto. Escopo entregue é a Camada 1 (MVP) do prompt original; Camada 2 (IA proativa avançada, colaboração real-time, versionamento avançado, apresentação em slides, exportações, métricas) foi conscientemente adiada.

**Schema (9 models novos, aprovados por Vault como 🟢, aplicados no Turso via script pontual):**
```prisma
model BlueprintProject {
  id, code (único), title, slug?, summary?, problem?, objective?
  status (IDEA|PRONTO_ESPECIFICACAO|EM_ESPECIFICACAO|PRONTO_DESENVOLVIMENTO|EM_DESENVOLVIMENTO|EM_REVISAO|CONCLUIDO|ARQUIVADO)
  priority (BAIXA|NORMAL|ALTA|URGENTE|CRITICA), progress Int, setor String?
  requesterId/ownerId?/developerId?/createdById/updatedById? → usuarios.id (Int, NÃO String/cuid)
  dueDate?, coverUrl?, icon?, tagsJson?, archivedAt?
  documents/boards/files/requirements/questions/comments/members/activities (relations)
}
model BlueprintMember { projectId, userId, role (PROPRIETARIO|ADMINISTRADOR|EDITOR|COMENTARISTA|VISUALIZADOR), @@unique([projectId,userId]) }
model BlueprintDocument { projectId, title, contentJson (Tiptap/ProseMirror), contentText (busca/IA), order }
model BlueprintBoard { projectId, title, viewportJson?, elementsJson (nodes+edges xyflow), version (controle de conflito otimista) }
model BlueprintFile { projectId, name, originalName, mimeType, size, url (Vercel Blob), thumbnailUrl?, archivedAt? }
model BlueprintRequirement { projectId, code (@@unique com projectId), title, type (10 valores), status (7 valores), priority, acceptanceCriteria?, sourceType?/sourceId? (rastreabilidade de onde veio) }
model BlueprintQuestion { projectId, question, answer?, status (ABERTA|RESPONDIDA|RESOLVIDA|DESCARTADA), authorId, assignedToId? }
model BlueprintComment { projectId, parentId?, targetType, targetId?, content, authorId, resolved }
model BlueprintActivity { projectId, userId, action, entityType, entityId?, previousValueJson?, newValueJson?, metadataJson? }
```
**⚠️ Divergência corrigida do schema conceitual do prompt original:** toda FK de usuário é `Int` (referencia `usuarios.id`, que é `Int @autoincrement()`), NÃO `String`/cuid como o prompt sugeria inicialmente — corrigido pelo Scout antes de Vault aprovar. `setor` é `String?` livre (= `usuarios.role`, mesmo padrão do resto do projeto), não uma FK — não existe model de Setor dedicado no schema real.

**Arquivos centrais:**
- `src/lib/validations/blueprint.ts` — todos os schemas Zod do módulo (enums de status/prioridade/tipo, allowlist de MIME type, limites de tamanho de payload de canvas/documento)
- `src/lib/blueprint/ownership.ts` — `checarAcessoBlueprint`/`exigirAcessoBlueprint`, matriz de permissão por role (`PERMISSOES_POR_ROLE`), Admin/CEO global bypassa a checagem de membro
- `src/lib/blueprint/ai-context.ts`, `ai-tools.ts`, `ai-executor.ts` — infraestrutura de IA isolada por projeto
- `src/actions/Blueprint{Projects,Documents,Boards,Files,Requirements,Questions,Comments,Members,Onboarding}.ts` — 9 arquivos de Server Actions
- `src/app/api/blueprint/upload/route.ts` — upload via Vercel Blob **dedicado** (store próprio, não o `IACHAT_*` do Bibble — ver env vars abaixo)
- `src/app/api/blueprint/chat/route.ts` — chat contextual da IA, streaming SSE, reaproveita `callCompletion`/`encodeSSE` de `lib/bibble/completion.ts`
- `src/app/PainelAlpha/AlphaBlueprint/page.tsx` (Dashboard) + `[projectId]/page.tsx` (Workspace) — ambas finas, com `auth()`+`getPermissoesEfetivas` (padrão dos ~7 módulos que já fazem esse check explícito)
- `src/components/AlphaBlueprint/` — ~25 componentes (ver `components.md` para o catálogo completo)
- `tests/blueprint/` — 49 testes Vitest (validações, ownership/matriz de permissão, regressão IDOR, transições de Kanban)

**Decisões de arquitetura chave:**
1. **Upload via Vercel Blob dedicado, não UploadThing.** UploadThing está no `package.json` mas nunca foi configurado/usado no projeto real (achado do Scout) — Vercel Blob é o mecanismo real em produção (mesmo padrão de `/api/bibble/upload-to-blob`). Novas env vars: `BLUEPRINT_STORE_ID`/`BLUEPRINT_READ_WRITE_TOKEN` (store próprio do usuário, adicionado em `.env.local`, seguindo o mesmo padrão de `IACHAT_STORE_ID`/`COMISSOES_STORE_ID` — o `put()` da versão instalada de `@vercel/blob@2.3.1` seleciona o store pelo `token`, não aceita `storeId` como parâmetro).
2. **Editor rico: Tiptap** (`@tiptap/react` + extensões) — única instalação nova de peso do módulo, não havia editor rico no projeto antes. Conteúdo persistido como JSON nativo do ProseMirror (`contentJson`) + texto plano extraído (`contentText`, usado pela IA).
3. **Canvas: `@xyflow/react`**, já instalado no projeto (usado em modo visualização pelo Apresentation Studio) — reaproveitado em modo totalmente editável (`nodesDraggable`/`nodesConnectable` true) pela primeira vez.
4. **IA: infraestrutura real do Bibble (Ollama via `callCompletion`), não Anthropic direta** — apesar do `CLAUDE.md` apontar Claude como "futuro padrão", a implementação real em produção usa Ollama (function-calling clássico `OllamaTool[]`). Tools do Blueprint (`BLUEPRINT_AI_TOOLS`) são isoladas das tools gerais do Bibble — nunca compartilham o mesmo catálogo, e o contexto enviado ao modelo é sempre resolvido a partir do `projectId` do servidor (nunca aceito do cliente/modelo), prevenindo vazamento entre projetos.
5. **Permissão por projeto é um conceito NOVO no painel** — `BlueprintMember` + matriz de 5 roles (Proprietário/Administrador/Editor/Comentarista/Visualizador) × 14 ações granulares. Nenhum outro módulo do sistema tem esse nível de granularidade de permissão por registro — é um padrão isolado do Blueprint, não generalizado para o resto do painel.
6. **Onboarding é tour guiado interativo, diferente do onboarding de vídeo do IAlpha** — campo novo `usuarios.onboarding_blueprint_visto` (Boolean, ADD COLUMN aprovado por Vault), separado de `onboarding_ialpha_visto`. Não reaproveita `src/actions/onboarding.ts` (que é sistema de templates de mensagem de boas-vindas, conceito diferente).

**Achados de segurança corrigidos nesta sessão (Anubis):** 6 vulnerabilidades de IDOR cross-project — `AtualizarArquivoBlueprint`/`ArquivarArquivoBlueprint`/`SalvarDocumentoBlueprint`/`ExcluirDocumentoBlueprint`/`SalvarBoardBlueprint`/`ExcluirBoardBlueprint` validavam acesso ao `projectId` informado pelo cliente mas nunca confirmavam que o `fileId`/`documentId`/`boardId` de fato pertencia a esse projeto antes de `update`/`delete`. Corrigido exigindo `entidade.projectId === projectId` antes de qualquer mutação. Regressão coberta em `tests/blueprint/idor-regression.test.ts`.

**Pendências conhecidas, documentadas conscientemente:**
- Fluxo autenticado ponta-a-ponta (criar projeto na UI, arrastar card, digitar no editor, desenhar no canvas, upload de arquivo real, usar chat de IA) não foi testado por automação de browser nesta sessão — sem credenciais de usuário disponíveis. Recomendado teste manual humano antes de considerar 100% validado (mesma limitação já registrada em outras sessões, ex: Apresentation Studio Onda 2).
- Sem rate limit em nenhuma action do módulo (mesmo padrão de dívida já aceito em outros módulos do painel).
- IA (Camada 1): chat contextual + resumo/lacunas/perguntas/sugestão de requisitos implementados; criação automática de elementos no canvas "mediante confirmação" (item do prompt original) NÃO implementada no MVP — fica para a Camada 2.
- Onboarding cobre o Dashboard (3 passos: novo sistema, filtros, Kanban); não cobre ainda um tour dentro da página interna do projeto (editor/canvas/arquivos) — extensível seguindo o mesmo padrão de `data-onboarding="..."` + array `PASSOS`.
- Sem projeto demonstrativo/exemplo pré-populado (mencionado no prompt original como "criar opcionalmente") — não implementado no MVP.

**Editado quando:** Camada 2 (evolução avançada) for iniciada, ou se o onboarding for estendido para dentro do workspace do projeto.

**Última atualização:** 2026-07-27 por Scribe

---

### Estado das abas globais do painel

- `src/components/layout/PainelLayoutClient.tsx` é o proprietário do ciclo de vida das abas e iframes.
- `src/components/layout/TabBar.tsx` cuida da apresentação e da reordenação acessível com `@dnd-kit`.
- `src/lib/painel-tabs.ts` concentra os tipos, a chave local por usuário e a normalização defensiva do estado persistido.
- A persistência usa `localStorage`, sobrevive a reload e logout/login no mesmo navegador e não sincroniza entre dispositivos.

**Última atualização:** 2026-08-03 por Scribe

---

### Alpha Motion — Central Criativa, presets e compartilhamento (2026-08-10)

- Presets personalizados de animação são armazenados em `Slide.dadosJson.presetsAnimacao`, em um único slide hospedeiro da apresentação. O contrato e a normalização ficam em `src/lib/apresentacoes/animacao/presets-personalizados.ts`.
- `PresetsAnimacaoContext.tsx` compartilha o catálogo no editor e persiste pela Server Action `SalvarPresetsAnimacaoApresentacao`. O autosave preserva o campo, a exclusão transfere a biblioteca e a duplicação remove a cópia para evitar versões concorrentes.
- `PresetsAnimacaoPanel.tsx` oferece CRUD; `SeletorPreset.tsx` e `ModalAplicarPreset.tsx` consomem o catálogo combinado de presets nativos e personalizados.
- A Central Criativa ganhou tutorial contextual e processamento de imagem com remoção de fundo ou contorno PNG configurável.
- `ModalExportarApresentacao.tsx` concentra HTML e link público. `GerarLinkPublicoApresentacao` publica ou renova um slug aleatório, enquanto `/apresentacao/[slug]` valida formato, status e expiração e reutiliza `PlayerStandalone` via `PublicPresentationPlayer`.
- Não houve nova dependência, coluna, tabela ou migration.

**Última atualização:** 2026-08-10 por Scribe

---

### Alpha Motion — histórico, multisseleção, camadas e tipografia (2026-08-10)

- `src/components/Apresentacoes/Editor/store/useEditorStore.ts` é a fonte única de histórico do slide, multisseleção e operações em lote. O histórico mantém até 100 snapshots e deve ser aberto/fechado como transação em gestos contínuos.
- `EditorKeyboardShortcuts.tsx` concentra Ctrl/Cmd+Z e os atalhos de refazer; inputs e editores de texto conservam o histórico nativo.
- `Canvas/ComponenteNoCanvas.tsx` e `Canvas/useCanvasDragResize.ts` implementam seleção aditiva, movimento conjunto, resize e rotação. Pais selecionados impedem o deslocamento duplicado de filhos também selecionados.
- `Timeline/TimelineReal.tsx` representa a ordem visual de cima para baixo, persiste a ordem por `zIndex` e oferece exclusão direta; a store remove animações e grupos ligados aos elementos excluídos.
- `SidebarEsquerda/SidebarSlides.tsx` mantém o DnD persistido de slides, agora com alça explícita, teclado e rollback visual em caso de falha.
- `src/lib/apresentacoes/rich-text-edit.ts` é o helper de edição por intervalo. `TextoProps.tsx` usa o catálogo de `fontes.ts`, e `RenderBasicos.tsx` aplica defaults explícitos para impedir divergência de cor entre editor e apresentação.
- As 15 famílias tipográficas ficam em `public/fonts/alpha-motion/` como 32 WOFF2 latinos e são declaradas por `src/app/alpha-motion-fonts.css`, junto de `globals.css` para resolução estável no Turbopack. `globals.css` serve esses arquivos localmente; o build do player converte os mesmos arquivos para data URI, mantendo o HTML exportado offline. `npm run fonts:alpha-motion` reprovisiona os ativos e alterações no renderer/CSS exigem `npm run build:player`.
- Não houve dependência, migration, coluna ou mutação em massa de banco.

**Última atualização:** 2026-08-10 por Scribe

---

## Guia Inteligente de Módulo — conhecimento do Bibble + tour reutilizável

**Adicionado em:** 2026-08-07 por Scribe.
**Primeiros módulos documentados:** Alpha Metas e Parceiros.
**Primeiro tour integrado:** Parceiros.

`src/lib/shared/module-knowledge/` é o catálogo tipado de manuais operacionais sob demanda. `registry.ts` resolve módulos/tópicos por aliases normalizados, produz Markdown e expõe autorização por permissão/role. O Bibble declara `consultar_manual_modulo` em `tools.ts`, executa a consulta somente leitura em `tool-executor.ts` e mantém no `system-prompt.ts` apenas o resumo/instrução necessária para chamar a tool.

`src/components/Guias/GuiaModuloTour.tsx` e `src/lib/guias/tutorial-modulo.ts` formam o tour genérico versionado. A preferência usa `localStorage` por usuário/módulo/versão, portanto não houve migration. Parceiros marca alvos no dashboard, abre automaticamente na primeira visita local e oferece “Tutoriais” para replay.

**Nome para futuras solicitações:** Guia Inteligente de Módulo.

**Última atualização:** 2026-08-07 por Scribe

---

### Alpha Presentation Studio — Container Alpha animado (2026-08-03)

**Evolução de introdução:** `SlideApresentacaoLayer.tsx` mantém camadas estáveis por `slide.id`; `src/lib/apresentacoes/container-intro.ts` concentra centralização, evento e recorte; `container-carga-audio.ts` oferece os presets procedurais Industrial e Hidráulico. `ContainerCargaCameraRig.tsx` agora combina enquadramento responsivo e zoom interno, enquanto `ModoApresentacaoClient.tsx` coordena a promoção do próximo slide sem remount. Não há nova rota, dependência, API ou estrutura de banco.

O catálogo 3D ganhou `containerCarga`, adaptação procedural do container da seção Sobre do site institucional. O contrato fica em `slide-componentes-3d.ts`; defaults em `registry-3d.ts`; modelo/câmera/animação em `RenderEngine/ContainerCarga*.tsx`; propriedades em `PainelDireito/camposPorTipo/ContainerCargaProps.tsx`. Não houve mudança de banco, rota, permissão ou dependência. O modo apresentação passou a escalar o palco canônico 1280×720 para o viewport por `src/lib/apresentacoes/viewport.ts`.

**Última atualização:** 2026-08-03 por Scribe

---

## Bibble/IAlpha — anexos PDF e conclusão confiável de respostas (2026-08-11)

### Fluxo de upload e prontidão

- `src/lib/bibble/attachments.ts` é o contrato compartilhado de anexos: tipos MIME aceitos, máximo de 10 arquivos por turno e a regra `isAttachmentReady`/`areAttachmentsReady`. Um arquivo só está pronto quando terminou o upload, não tem erro e recebeu `uploadUrl`.
- `BibbleChatInput.tsx` aplica a regra ao botão e ao envio por teclado; `BibbleChatLayout.tsx` repete a guarda antes de criar sessão, limpar a caixa ou enviar a requisição. Assim, um PDF ainda em upload não é descartado por corrida de estado.
- `BibbleFileUpload.tsx` e `BibbleChatLayout.tsx` usam o mesmo catálogo de MIME e o mesmo teto de quantidade. O tamanho máximo aceito pela rota é 100 MB por arquivo.
- `POST /api/bibble/upload-to-blob` (`src/app/api/bibble/upload-to-blob/route.ts`) exige sessão, tipo permitido e, para PDF, concordância entre MIME, extensão `.pdf` e magic bytes `%PDF`. O objeto é salvo em `bibble-chat/<uuid>` no Vercel Blob; o nome original não compõe o caminho.

### Extração e conteúdo enviado ao modelo

- `src/lib/bibble/tika.ts` centraliza a cadeia Tika → `pdf-parse` → PDF24 OCR. Tika atende documentos suportados; `pdf-parse` é fallback local exclusivo de PDF; PDF24 é o último recurso para PDF sem texto útil. `src/lib/bibble/pdf24-ocr.ts` limita criação, polling e download à mesma origem configurada, sem seguir redirects.
- A extração ocorre no upload e retorna `extractedContent` e `extractionSource`. O retorno do upload é limitado por `BIBBLE_UPLOAD_TEXT_TOKEN_BUDGET` (30.000 tokens estimados) via `selectTextForTokenBudget`; quando necessário, preserva início, meio e fim e inclui aviso de capacidade no próprio texto.
- `src/lib/bibble/attachment-security.ts` concentra máximo de 100 MB, máximo de 10 anexos, limite agregado do payload/histórico, schema Zod estrito, magic bytes e a allowlist de URLs `https://*.blob.vercel-storage.com/bibble-chat/...`. Downloads do chat usam `fetchTrustedBibbleBlob` com redirect manual, impedindo URLs arbitrárias fornecidas pelo cliente.
- Qualquer turno com anexo desabilita tools em `src/app/api/bibble/chat/route.ts`; o documento não confiável participa somente de uma geração de resposta, sem executar ações do sistema.

### Orçamento de contexto e saída

- `src/lib/bibble/context-budget.ts` estima custo, define janela padrão de 32.768 tokens e reserva até 4.096 tokens para a saída. Para PDFs com configuração legada/insuficiente (como 4.096), a rota usa a janela segura do provedor.
- O orçamento desconta prompt de sistema, pedido, tools, imagens e histórico antes de alocar espaço aos anexos. Histórico recente e documentos grandes são ajustados por orçamento; reduções usam trechos de início, meio e fim com aviso explícito, nunca corte silencioso apenas do começo.
- `src/lib/bibble/completion.ts` propaga o limite de saída ao provider (`max_tokens`/`max_completion_tokens` e, no Ollama, `num_ctx`/`num_predict`) e lê o `finish_reason` inclusive no frame final do stream.

### SSE, persistência e retry

- `src/app/api/bibble/chat/route.ts` faz uma única geração em streaming quando há anexo, usa `maxDuration = 120` e envia `done` com `finishReason`, `truncated` e `successful`. `length`, `max_tokens`, EOF sem `finish_reason`, limite de tools e erros são marcados como incompletos.
- `src/lib/bibble/client-stream.ts` só aceita conclusão após evento `done` explícito e rejeita `truncated: true` ou `successful: false`; EOF físico não significa sucesso.
- Em stream incompleto, timeout ou erro de protocolo, `BibbleChatLayout.tsx` remove o par parcial, não persiste a resposta cortada e restaura o mesmo texto e os mesmos anexos prontos para nova tentativa. O botão Parar usa a mesma restauração.

### Cobertura dedicada

`tests/bibble/attachment-readiness.test.ts`, `attachment-security.test.ts`, `context-budget.test.ts`, `completion-budget-stream.test.ts`, `client-stream-protocol.test.ts` e `pdf-extraction-chain.test.ts` cobrem a guarda de envio, limites/SSRF, seleção início-meio-fim, parâmetros do provider, protocolo de conclusão e fallbacks de extração.

**Última atualização:** 2026-08-11 por Scribe
## Notas — equipes privadas (2026-08-12)

- `src/actions/NotasEquipes.ts`: CRUD, membros, busca segura, shares e notificações.
- `src/lib/notas/equipes.ts`: normalização de nome e ranking de papéis.
- `src/components/Notas/Colaboracao/NoteTeamsManager.tsx`: gerenciador responsivo.
- `src/components/Notas/Colaboracao/NoteTeamMembersEditor.tsx`: funções e membros.
- `src/components/Notas/Colaboracao/NoteTeamUserMultiSelect.tsx`: busca e seleção múltipla.
## Alpha CRM — sincronização realtime (2026-08-12)

- Contrato client-safe: `src/lib/bpm/realtime.ts`.
- Emissão server-side best-effort: `src/lib/bpm/realtime-server.ts`.
- Consumidor do canal privado por pipeline: `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`.
- Autorização Pusher compartilhada: `src/app/api/pusher/auth/route.ts`.
- Regressão do contrato: `tests/bpm/realtime.test.ts`.

## Alpha CRM — transcrições do Google Meet (2026-08-12)

- `src/lib/google-meet/client.ts`: cliente Meet v2 server-only, DWD com escopo mínimo, paginação e retry limitados.
- `src/lib/bpm/transcricao-reuniao.ts`: valida link/meeting code, escolhe a conferência correlata e consolida entries.
- `src/lib/bpm/transcricao-reuniao-server.ts`: resolve organizador pelo cache, persiste por CAS, audita e publica realtime; também executa polling limitado.
- `src/actions/bpm/TranscricaoMeet.ts`: action manual com autenticação, Zod e ownership.
- `PainelReuniao.tsx` e `PainelProximaEtapa.tsx`: estados pendente/recebida/erro e motivo visual do bloqueio.
- `Cards.ts`: autoridade do guard para Em tratativa/Sem viabilidade; Standby continua livre.
- A rota protegida de follow-up executa polling e o ciclo de oito dias para Reunião Agendada. Sem schema ou migration novos.

## Alpha CRM — fluxo operacional de Fechado (2026-08-13)

- `src/lib/bpm/status-pos-fechamento.ts` é a fonte compartilhada dos cinco status pós-fechamento, labels, classes de badge/tint, status inicial e validação fail-closed da configuração de entrada.
- `src/actions/bpm/Cards.ts` concentra a autoridade server-side: criação direta e movimento para **Fechado** exigem **Valor acordado no contrato** e **Forma de pagamento** corretamente configurados/preenchidos; a primeira entrada com status nulo grava `AGUARDANDO_CONTRATO` na mesma transação.
- A edição posterior usa `versaoEsperadaEm` como CAS, registra histórico e publica invalidação realtime somente após a persistência. Status inválido ou edição fora de **Fechado** é rejeitado pelo backend.
- `PainelStatusPosFechamento.tsx`, montado no lado esquerdo por `PainelHistorico.tsx`, oferece o editor dos cinco status e preserva rascunho diante de atualização realtime concorrente.
- `PipelineBoardClient.tsx` usa o mesmo contrato para exibir badge textual e tint visual exclusivamente em cards atualmente na etapa **Fechado**; status residual fora dela não ganha representação visual.
- Cobertura dedicada: `tests/bpm/fechado-status-pos-fechamento.test.ts`, `tests/bpm/fechado-actions.test.ts`, `tests/bpm/fechado-ui.test.ts` e `tests/bpm/card-modal-integration.test.ts`.
- Não houve schema, migration, seed ou backfill. Integração financeira/Comissões futura permanece fora deste fluxo e deve consumir o valor canônico sem introduzir efeito colateral implícito nas actions atuais.

**Última atualização:** 2026-08-13 por Scribe

## Alpha CRM — membros vinculados por card (2026-08-14)

- `BpmCardMembro` já é a relação canônica card × `usuarios`; a unicidade `(cardId, userId)` sustenta um conjunto de participantes sem criar nova estrutura de banco.
- `src/actions/bpm/Membros.ts` concentra `ListarUsuariosVinculaveisCardBpm` e `AtualizarMembrosCardBpm`. O seletor só recebe contas `ATIVO` com permissão CRM efetiva; a gravação é transacional, preserva o responsável como membro obrigatório, usa CAS pelo `updatedAt`, mantém papéis existentes quando cabível, audita `MEMBROS_ATUALIZADOS` e só notifica realtime após commit.
- `src/lib/bpm/ownership.ts` aplica a segunda camada de acesso por card: `PARTICIPANTE` pode executar o trabalho operacional (ler, editar, mover, tarefas, anexos, interações e histórico), enquanto gestão de participantes e exclusão ficam limitadas a responsável, administrador do card ou administrador global. Revogação corta o acesso ao modal e à leitura do board na próxima recarga autenticada.
- `CardFullViewModal.tsx` renderiza `SeletorMembrosCard.tsx` no cabeçalho do card aberto. O board em `pipeline/[pipelineId]/PipelineBoardClient.tsx` apresenta os avatares/foto dos membros no card fechado, sem duplicar pessoas no payload do realtime.
- O canal de pipeline continua enviando apenas invalidação genérica (`pipelineId`, tipo e timestamp), sem `cardId` ou dados do lead. Isso permite que uma pessoa removida receba a invalidação e tenha a revogação aplicada pela releitura autorizada, sem expor a identidade ou dados do card.
- Cobertura específica: `tests/bpm/membros-card-actions.test.ts`, `membros-card-ownership.test.ts`, `membros-card-ui.test.ts`, com regressões de autorização/realtime relacionadas. Nenhuma migration, seed ou backfill foi executado.

**Última atualização:** 2026-08-14 por Scribe/Kowalski

---

### Alpha CRM — Melhoria Visual da Sidebar (RM-2026-4F34CC, 2026-08-17)

**Arquivo único alterado:** `src/app/PainelAlpha/AlphaCRM/CRMLayoutClient.tsx`

**Alterações (exclusivamente visual, zero mudança de lógica):**
1. `<aside>`: `bg-slate-950` → `bg-slate-950/40 backdrop-blur-xl` — o `CrmSpaceBackground` (já `absolute inset-0 z-0`) agora é visível através da sidebar.
2. Mobile top bar: `bg-slate-950/80` → `bg-slate-950/40 backdrop-blur-xl` — consistência visual.
3. NAV links: adicionados `bg-white/[0.04] border border-white/[0.06] rounded-xl` (destaque base), `hover:bg-white/[0.08] hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:translate-x-0.5` (hover), `active:scale-[0.98] active:shadow-none` (active), `transition-all duration-200 ease-in-out` (transição), `cursor-pointer`.
4. Ícone NAV: `group-hover:scale-110 transition-transform duration-200`.
5. Item ativo: `boxShadow: 0 0 12px rgba(accent,0.1)` (glow de accent via `style` inline).

**Padrão adotado:** "Sidebar sobre background vivo" — extensão do "vidro sobre hero" do Aurora Financeira. Ver `design-tokens.md` e `patterns.md`.

**Verificação:** Probe aprovou todos os 6 critérios de aceitação. Sem regressão funcional. Observação menor (não bloqueante): área de toque vertical ~40px (ideal 44px) — `py-2.5` → `py-3` seria a correção.

## Alpha CRM — Pipeline Financeiro (RM-2026-DE0F7B, 2026-08-20)

**Objetivo:** pipeline financeiro com exatamente 5 etapas (Contrato → Formalização → Pagamento → Nota Fiscal → Concluídos), com campos obrigatórios por etapa, validação de transição e cálculo automático de retenções (IRRF/CSRF).

**Arquivos:**
- `src/lib/bpm/pipeline-financeiro.ts` — fonte de verdade: `FINANCIAL_STAGES` (5 etapas), `FINANCIAL_FIELDS` (40+ campos com categoria OBRIGATORIO/OBRIGATORIO_CONDICIONAL/AUTOMATICO_CALCULADO), `financialStageKeyFromLabel` (mapeia 6 rótulos legados → 5 chaves), `validateFinancialTransition` (bloqueia pulo de etapa + lista campos pendentes), `calcularRetencoesFinanceiras` (IRRF + CSRF + memória de cálculo JSON), `hasConfiguredFinancialPipeline` (verificação de estado atual).
- `src/actions/bpm/PipelineFinanceiro.ts` — `ConfigurarPipelineFinanceiro(pipelineId)`: Server Action idempotente e transacional (`db.$transaction`), renomeia etapas existentes semanticamente, desativa excedentes (migrando cards para a etapa correspondente), cria campos faltantes, upsert transições permitidas, grava auditoria em `BpmPipelineConfigAuditoria`.
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/ConfigurarEtapasFinanceiroButton.tsx` — botão de UI para aplicar a configuração (loading + feedback).
- `tests/bpm/pipeline-financeiro.test.ts` — 5 testes: ordem das 5 etapas, mapeamento legado, classificação de campos, cálculo de retenções, validação de transição.

**Modelo de dados:** reutiliza `BpmPipeline`/`BpmEtapa`/`BpmCard`/`BpmCampo`/`BpmEtapaTransicaoPermitida` (já existentes). `BpmCard.etapaId` (FK → `BpmEtapa`) é o campo de referência de etapa. Sem migration SQL nova — a reconfiguração 6→5 etapas é feita pela Server Action (idempotente, transacional), não por migration.

**API:** Server Actions (padrão do projeto, não REST). `ConfigurarPipelineFinanceiro` (configuração) + `MoverCardBpm` (movimentação, já existia, agora com `validateFinancialTransition`).

**Frontend:** `PipelineBoardClient.tsx` (kanban com drag-and-drop via `@dnd-kit/core`) — já existia, reutilizado. Botão de configuração em `ConfigurarEtapasFinanceiroButton.tsx`.

**Caminho de acesso:**
- Configurar: `/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]` → botão "Aplicar pipeline financeiro"
- Operar: `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → kanban com 5 colunas, drag-and-drop

**Permissões:** `auth()` + `exigirAcessoConfigPipeline` (configuração) / `exigirAcessoBpmPipeline` (operação).

**Decisões de escopo (excluído conscientemente):**
- Automações (notificações, e-mails, integrações com ERP) — fora do escopo do objetivo.
- Tabela `financial_pipeline_stages` dedicada — rejeitada; `BpmEtapa` já cumpre o papel.
- Rotas REST `/api/crm/financial/pipeline/*` — rejeitadas; Server Actions são o padrão do projeto (Artigo IV da Constituição).
- Campo `current_stage_code` — rejeitado; `BpmCard.etapaId` (FK) já é o campo de referência.

**Última atualização:** 2026-08-20 por Scribe

## RM-2026-429476 — agrupamento de campos no admin do CRM/BPM

- `src/lib/bpm/campos-admin.ts`: helper puro `agruparCamposPorColuna`, responsável por ordenação, seção geral, etapas vazias e fallback de vínculos indisponíveis.
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx`: consumidor via `useMemo`; renderiza os grupos sem retirar os controles CRUD.
- `tests/bpm/campos-agrupados-por-coluna.test.ts`: cobertura de ordem, vazio, preservação sem duplicação e wiring da UI.

**Última atualização:** 2026-08-17 por Scribe
