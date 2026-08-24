# ARCHITECTURE — Mapa de Arquitetura do Projeto

## ⚠️ Bibble (assistente) roda 100% via Ollama local — não Anthropic/OpenAI (confirmado 2026-08-24)

O CLAUDE.md raiz descreve Anthropic como "futuro padrão para AI" para o Bibble, mas **o código real sempre usou Ollama** como provider padrão (`src/lib/bibble/client.ts`, `BIBBLE_MODEL`, hoje `qwen3.8:latest`), servido por um Ollama remoto em `192.168.35.113` com GPU dedicada e VRAM alta (confirmado pelo usuário). Anthropic/OpenAI/Google existem no código (`PROVIDER_MODELS`, `getProviderConfig`) como providers alternativos que o usuário pode selecionar manualmente no chat, nunca como padrão ativo. **Qualquer sessão futura que for ajustar limites de token/contexto/custo do Bibble deve tratar o Ollama local como o path real e testado** — ver detalhe completo da correção de tetos de contexto/output em `integration-points.md` ("Bibble — hardening do pipeline de anexos/PDF", 2026-08-24).

---

## ⚠️ Acoplamento crítico: Parceiros ↔ Metas ↔ CS&NPS via `clientes`

`clientes` (módulo CS&NPS) é o **hub central** referenciado por FK de múltiplos módulos que, à primeira vista, parecem independentes:

| Módulo | Tabela | Coluna FK → `clientes.id` |
|---|---|---|
| CS&NPS (satélites) | `socios`, `log_cs`, `logFeedback`, `logAlteracao` (desativado), `historico_alteracao_cliente` | `clienteId` |
| Parceiros | `indicacoes` | `clienteId` |
| CRM | `crm_oportunidades`, `crm_contatos` | `clienteId` |
| Metas/Comercial | `ContratoComercial` → sincroniza para `clientes` via `criarRegistroClienteAPartirDeContrato` (não é FK direta, é escrita programática no fluxo de `confirmarFechamento`) | — |

**Qualquer migration estrutural em `clientes` (rename, recriação, mudança de índice/constraint) exige checar TODAS as tabelas acima antes de considerar concluída** — ver regra permanente em `decisions.md` (2026-07-13, "Parceiros ↔ Metas ↔ CS&NPS são módulos acoplados via `clientes`"). Um incidente real já ocorreu: uma migration de `clientes` (rename→create→drop `clientes_old`) deixou 6 tabelas (as 6 da tabela acima, exceto `historico_alteracao_cliente` que é posterior ao incidente) com FK fantasma para o nome antigo, zerando o conteúdo de todas silenciosamente.

> Mantido por: Echo (backend) e Scribe (cartógrafo)
> Atualizar sempre que novos endpoints, actions ou schemas forem criados.

---

## Stack

<!-- Preencher após instalar no projeto -->

| Área | Tecnologia |
|------|-----------|
| Framework | Next.js + App Router |
| Auth | |
| Banco | |
| ORM | |
| Estilização | |
| Estado | |
| Upload | |
| AI | |

---

## Schema do Banco (tabelas principais)

### Módulo Extratos Bancários (reescrito em 2026-07-09)
```prisma
model Extratos {
  id, cnpj (unique), razaoSocial, nomeFantasia?, dataConstituicao?,
  municipio?, uf?, regimeTributario?, criadoPorNome?, analistaResponsavel?
  periodos PeriodosAnalise[]
  @@index([criadoPorNome]) @@index([razaoSocial])
}
model PeriodosAnalise { id, mes, ano, extratoId → Extratos, bancos BancosVinculados[] }
model BancosVinculados { id, bancoId, nomeBanco, logo, descricao?, anotacao?, periodoId → PeriodosAnalise, transacoes Transacao[] }
model Transacao {
  id, data DateTime?, dataOriginalTexto String?, descricao, valor Float,
  bancoId, mesReferencia, origemArquivo?, BancosVinculadosId → BancosVinculados
  @@index([BancosVinculadosId, data])
}
```
**IMPORTANTE — `Transacao.data` é `DateTime?` (nullable), NÃO `String`.** Migrado em 2026-07-09 (ver `decisions.md`). 273 registros legados têm `data = null` e o texto original preservado em `dataOriginalTexto` (formato "DD/MM" sem ano, sem como recuperar o ano com confiança). Qualquer código que itere transações DEVE tratar `data: null` (exibir "data desconhecida" ou ordenar por último) — nunca assumir que `data` sempre existe.

### Módulo Alpha Presentation Studio (Onda 1 — 2026-07-09)
```prisma
model Apresentacao { id (cuid), titulo, clienteNome?, autorId → usuarios, status (DRAFT|PUBLICADA|ARQUIVADA),
  temaId? → ApresentacaoTema, thumbnailUrl?, slugPublico? @unique, senhaAcesso?, expiraEm?
  slides Slide[], assets ApresentacaoAsset[], versoes ApresentacaoVersao[], colaboradores ApresentacaoColaborador[], comentarios ApresentacaoComentario[]
  @@index([autorId]) @@index([status]) }
model Slide { id (cuid), apresentacaoId → Apresentacao, ordem, nome?, transicaoEntrada?, duracaoAutoplay?, dadosJson Json
  @@index([apresentacaoId, ordem]) }
model ApresentacaoTema { id (cuid), nome, corPrimaria, corSecundaria, corAccent, radius?, fontePrimaria?, fonteSecundaria?, tokensJson Json, isTemplate, criadoPorId? }
model ApresentacaoAsset { id (cuid), apresentacaoId → Apresentacao, tipo (IMAGEM|VIDEO|MODELO_3D|AUDIO|FONTE), url, nomeOriginal, tamanhoBytes }
model ApresentacaoVersao { id (cuid), apresentacaoId → Apresentacao, dadosJson Json, criadoPorId, label? }
model ApresentacaoColaborador { id (cuid), apresentacaoId → Apresentacao, userId → usuarios, papel (EDITOR|VISUALIZADOR|COMENTARISTA), @@unique([apresentacaoId, userId]) }
model ApresentacaoComentario { id (cuid), apresentacaoId → Apresentacao, slideId? → Slide, autorId → usuarios, texto, resolvido }
```
**IMPORTANTE — `Slide.dadosJson` é um blob JSON único por slide** (árvore de componentes: textos, imagens, posições, animações) — decisão deliberada de NÃO relacionalizar em tabela `ComponenteSlide` (ver `decisions.md` 2026-07-09, "arquitetura de dados do slide"). Todo código que gera/lê esse JSON deve validar com Zod discriminated union por `tipo` de componente (recomendação de Scout, a implementar nas ondas seguintes do editor).

**Onda 4 (3D) — 2026-07-10:** `componenteSchema` (`src/lib/validations/slide-componentes.ts`) ganhou 3 novos tipos na union discriminada, todos renderizados via React Three Fiber (`@react-three/fiber` + `@react-three/drei`, instalados nesta onda — compatibilidade confirmada com React 19.2.3/Three 0.185.1 já em uso): `globo` (esfera com textura opcional, rotação automática, `marcadores[]` de lat/lng para uso comex/logística), `particulas` (campo de pontos animados — quantidade/cor/tamanho/velocidade), `objeto3d` (carrega modelo externo `.glb`/`.gltf` via `url`, com `autoRotacao`/`escala`). Sem mudança de schema Prisma — `dadosJson` continua sendo o único ponto de persistência. Ver nota em `known-errors.md` sobre `frameloop` do R3F e visibilidade dentro do iframe do painel.

---

## Endpoints e Server Actions

<!-- Preencher conforme o projeto cresce -->

| Tipo | Caminho | Método | Auth | Descrição |
|------|---------|--------|------|-----------|
| Route Handler | `/api/...` | GET | Sim | |
| Server Action | `src/actions/bpm/Membros.ts` (2026-08-14) | — | Sim, CRM + ownership do card | `ListarUsuariosVinculaveisCardBpm({cardId})` lista apenas contas ativas com CRM efetivo para o seletor de gestão. `AtualizarMembrosCardBpm({cardId,userIds})` substitui participantes sob transação e CAS por `updatedAt`, preserva o responsável e revalida autorização/elegibilidade dentro da transação. Somente responsável, administrador do card ou Admin/CEO/TI global pode gerir; o histórico armazena apenas IDs e há evento realtime pós-commit. |
| Route Handler | `/api/cs-nps/exportar` | GET | Sim, permissão efetiva `Cliente` | Exporta clientes ativos e arquivados e suas relações diretas confirmadas em workbook `.xlsx`, com uma aba por entidade. |
| Route Handler | `/api/cs-nps/importar/modelo` | GET | Sim, usuário ativo Admin/CEO + permissão efetiva `Cliente` | Gera o modelo `.xlsx` com `Instrucoes` e as abas `Socios`, `CS` e/ou `Feedbacks` escolhidas em `tipos`. |
| Route Handler | `/api/cs-nps/importar/previsualizar` | POST multipart | Sim, usuário ativo Admin/CEO + permissão efetiva `Cliente` | Faz preflight ZIP streaming, parseia até 2.000 linhas e resolve candidatos de empresa/serviço sem gravar dados. |
| Route Handler | `/api/cs-nps/importar/salvar` | POST JSON | Sim, usuário ativo Admin/CEO + permissão efetiva `Cliente` | Revalida o `clienteId` de cada linha e grava sócios/CS/feedbacks e auditoria em uma única transação. |
| Server Action | `src/actions/apresentacoes.ts` | — | Sim | `ListarApresentacoes`, `CriarApresentacao`, `DuplicarApresentacao`, `ExcluirApresentacao`, `AtualizarStatusApresentacao` — ownership: autor ou Admin/CEO |
| Server Action | `src/actions/slides.ts` (Onda 2) | — | Sim | `ListarSlides`, `ObterSlide`, `CriarSlide`, `AtualizarSlide`, `ReordenarSlides`, `ExcluirSlide`, `DuplicarSlide` — ownership sempre sobe até `Apresentacao.autorId`/`colaboradores` via `checarOwnershipApresentacao()` (nunca confia no `Slide.id` isolado). `AtualizarSlide` valida `dadosJson` com `dadosSlideSchema` (Zod) antes de salvar. `ExcluirSlide` bloqueia se for o último slide da apresentação (regra de negócio confirmada com o usuário, ver `decisions.md`). |
| Server Action | `src/actions/apresentacao-temas.ts` (Onda 3) | — | Sim | `ListarTemas` (templates do sistema + temas próprios do usuário), `CriarTema`, `AtualizarTema` (templates só editáveis por Admin/CEO, temas próprios só pelo dono), `AplicarTema` (seta `Apresentacao.temaId`, ownership via `checarOwnershipApresentacao`). `ApresentacaoTema` (model existente desde a Onda 1) recebeu seu primeiro uso real: 5 templates seedados no Turso (Alpha Premium, Dark Glass, Corporate, Minimalista, Apple-style — `isTemplate: true`, `criadoPorId: null`). |
| Route Handler | `POST /api/apresentacoes/gerar-slide` (Onda 5) | POST | Sim | Motor de IA para gerar o conteúdo de 1 slide a partir de prompt livre. Ownership (`checarOwnershipApresentacao`) verificado ANTES de qualquer chamada à IA. Streaming SSE (mesmo formato do chat do Bibble: `{type:"status"}`/`{type:"text"}`/`{type:"done"}`/`{type:"error"}`) — `text` carrega fragmentos do JSON sendo gerado; cliente só faz `JSON.parse`+Zod quando `done` chega. Reaproveita `callCompletion` (extraído para `src/lib/bibble/completion.ts` nesta onda) e o mesmo provedor Ollama local padrão do chat do Bibble (`process.env.BIBBLE_MODEL ?? "gemma4:e4b"`, servidor `ollama.alpha-comex.com` em produção — NÃO Anthropic direta, sem custo de API externa). IA escolhe 1 de 5 templates de layout fixos (`src/lib/apresentacoes-ia/templates-layout.ts`) e preenche só o conteúdo textual — nunca desenha coordenadas x/y/w/h livres. |
| Server Component | `GET /PainelAlpha/Apresentacoes/[id]/apresentar` (Onda 6, Fase 1) | — | Sim | Modo Apresentação fullscreen. Página fina com o mesmo padrão de ownership do editor, busca TODOS os slides ordenados + tema, passa para `ModoApresentacaoClient` (Client Component). Navegação por teclado (setas/espaço/Esc) + clique. Usa `RenderComponente` DIRETO, sem wrapper de seleção do Editor — primeira vez que o RenderEngine roda fora do Editor, resolvendo a lacuna de `stagger` não visível (Onda 3). Transição entre slides via `TransicaoSlide.tsx` (Framer Motion `AnimatePresence`), implementando `Slide.transicaoEntrada` de verdade pela primeira vez (fade/slide-horizontal; valores desconhecidos caem em fade). Fullscreen API tentada como melhor esforço, sem crítica se o browser negar. |
| Server Action | `src/actions/Blueprint{Projects,Documents,Boards,Files,Requirements,Questions,Comments,Members,Onboarding}.ts` (2026-07-27) | — | Sim | Módulo Alpha Blueprint (MVP). 9 arquivos, ownership por `checarAcessoBlueprint`/`exigirAcessoBlueprint` (`src/lib/blueprint/ownership.ts`) — matriz de 5 roles × 14 ações granulares por projeto (`BlueprintMember`), Admin/CEO global bypassa. `ListarProjetosBlueprint` (paginado, filtros por status/prioridade/setor/responsável), `CriarProjetoBlueprint` (valida `requesterId` existe de fato em `usuarios` antes de gravar), `MoverProjetoBlueprint` (máquina de transições de status do Kanban, idempotente quando já está no status alvo). Ver `codebase-map.md` para detalhe completo. |
| Route Handler | `POST /api/blueprint/upload` (2026-07-27) | POST multipart | Sim, ownership por projeto (`enviarArquivo`) | Upload via Vercel Blob **dedicado** (`BLUEPRINT_READ_WRITE_TOKEN`, store próprio — NÃO o `IACHAT_*` do Bibble). Allowlist de MIME type + limite de 100MB, mesmo padrão de `/api/bibble/upload-to-blob`. |
| Route Handler | `POST /api/blueprint/chat` (2026-07-27) | POST | Sim, ownership por projeto (`usarIA`) | Chat contextual da IA do Alpha Blueprint, streaming SSE. Reaproveita `callCompletion`/`encodeSSE`/`BIBBLE_MODEL` de `lib/bibble/completion.ts` (Ollama real, não Anthropic). Contexto do projeto (`montarContextoProjeto`) é seletivo e truncado — nunca serializa o projeto inteiro; tools próprias (`BLUEPRINT_AI_TOOLS`) isoladas das tools gerais do Bibble, nunca misturam contexto entre projetos. |

---

### Módulo CS&NPS — CNPJ duplicado permitido por serviço (migrado em 2026-07-13)
```prisma
model clientes {
  id ..., cnpj String (SEM @unique — era @unique até 2026-07-13), servicos String?
  ...
  @@unique([cnpj, servicos])  // constraint composta — permite múltiplos serviços do mesmo CNPJ
}
```
**IMPORTANTE — `clientes.cnpj` deixou de ser globalmente único.** Cada serviço contratado por um CNPJ vira um registro SEPARADO em `clientes` (não concatena string). A UI (`page.tsx`) mescla visualmente registros do mesmo CNPJ em 1 linha. Ligação com Painel de Metas via `buscarServicoContratadoPorCliente(cnpj, servicos)` (`src/actions/Clientes.ts`) — casa por CNPJ + nome do serviço normalizado contra `ContratoComercial`, trazendo `valorContrato`/`formaPagamento`/`closerNome`. Migration real aplicada no Turso via recriação de tabela (SQLite não permite DROP de UNIQUE inline) — ver `decisions.md` (2026-07-13).

**`clientes` ganhou 4 colunas (2026-07-13):** `municipio String?` (cidade, exibida ao lado de UF), `formaPagamento String?`/`valorContrato Float?`/`closerNome String?` (preenchimento MANUAL no cadastro do CS&NPS, fallback quando um registro não tem contrato correspondente vinculado no Metas). `CadastrarCliente`/`salvarAlteracoesGeral`/`criarRegistroClienteAPartirDeContrato` (todas em `Clientes.ts`) atualizadas para aceitar/persistir os 4 campos.

**Sincronização automática Metas → CS&NPS na CONFIRMAÇÃO DE PAGAMENTO (2026-07-13, corrigido na mesma sessão):** `confirmarFechamento` (não `criarContrato`) chama `criarRegistroClienteAPartirDeContrato({ cnpj, razaoSocial, servico, nomeFantasia, dataConstituicao, regimeTributario, uf, dataContratacao, socios })` (`src/actions/Clientes.ts`) — cria/reativa o registro em `clientes` só quando o pagamento é de fato confirmado, não na criação do contrato (contratos nunca confirmados não geram registro no CS&NPS). `dataContratacao` vem de `ContratoComercial.pagamentoConfirmadoEm`. Função também recebe `socios[]` opcional (migrado da lógica antiga) e retorna `clienteId` (usado para vincular `Indicacao` de parceiro quando `criado === true`). Via `findFirst` explícito: não existe → cria (com sócios); existe e "Arquivado" → REATIVA + atualiza campos fiscais/dataContratacao só se vier valor novo não-vazio; existe ativo → idempotente. Havia uma 2ª lógica de sincronização pré-existente (antes desta sessão) dentro de `confirmarFechamento` que reconsultava a Receita Federal e usava `findFirst` só por CNPJ (quebrada pela constraint composta) — foi REMOVIDA e substituída por esta chamada centralizada. Falha na sincronização NUNCA reverte o fechamento do contrato (`try/catch` isolado, só loga).

**`ContratoComercial` ganhou `dataConstituicao`/`regimeTributario`/`uf` (2026-07-13, migration ADD COLUMN nullable):** capturados pelo formulário do Metas (`ModalGerenciamentoLeads.tsx`) na mesma consulta `/api/ReceitaFederal` que já fazia (antes só usava razaoSocial/nomeFantasia da resposta) — sem chamada nova à API externa.

**⚠️ PENDÊNCIA DE SEGURANÇA REGISTRADA (Anubis, 2026-07-13):** a seção "Serviços Contratados" do modal do CS&NPS expõe `valorContrato`/`formaPagamento`/`closerNome` (dados do Metas) para qualquer usuário com a permissão `Cliente`, mas esses dados hoje só são visíveis no módulo Metas restrito a `allowedRoles: ['Lider Comercial']` (`modulos-registry.ts`). Decisão sobre restringir ou manter aberto foi **adiada explicitamente pelo usuário** — ver `decisions.md`. Não é permissão para deixar como está permanentemente.

### Módulo CS&NPS — arquitetura da importação em lote (2026-07-15)

A importação usa um pipeline em duas fases: `previsualizar` interpreta o workbook e devolve linhas tipadas/candidatos sem persistência; `salvar` recebe somente as linhas mantidas pelo usuário, revalida todos os schemas e repete a resolução do destino antes de gravar. Isso permite remover linhas e resolver ambiguidades na UI sem tornar a prévia uma fonte de confiança.

Como `clientes` permite o mesmo CNPJ em serviços diferentes, a razão social ou o CNPJ identificam um conjunto de candidatos, enquanto `clienteId` identifica o destino relacional definitivo. O `clienteId` enviado pela UI só é aceito se ainda pertencer ao conjunto calculado a partir do identificador original; assim, um valor adulterado ou um destino que mudou entre prévia e confirmação é rejeitado. A confirmação consulta novamente `usuarios` dentro de `db.$transaction`, grava `socios`, `log_cs`, `logFeedback` e `auditoria`, e reverte o conjunto inteiro em qualquer falha. Não houve mudança de schema Prisma.

O contrato do arquivo é allowlist: `Instrucoes` opcional, `Socios(cnpj, razaoSocial, nome, telefone, observacao, dataNascimento, vinculo)`, `CS(cnpj, razaoSocial, colaborador, sentimento, observacao, dataRegistro)` e `Feedbacks` com as mesmas colunas de CS. O gerador inclui somente as abas selecionadas; o parser rejeita abas, cabeçalhos, colunas, fórmulas e macros fora desse contrato. Múltiplos sócios usam linhas repetidas para a mesma empresa.

Antes do parse completo por ExcelJS, `preflight-xlsx.ts` percorre as entradas via `yauzl` em streaming e mede o conteúdo realmente descompactado. Os limites são: arquivo de 10 MB, 2.000 linhas, 256 entradas ZIP, 20 MB descompactados por entrada, 50 MB no total e razão máxima 100:1. A prévia também possui rate limit em memória por instância (`userId + IP`, cinco/minuto e uma execução concorrente); ele não coordena réplicas. Idempotência persistente da confirmação não foi implementada e permanece fora deste escopo: repetir um `POST /salvar` válido pode criar registros duplicados.

A autorização administrativa comum foi extraída para `src/lib/cs-nps/autorizacao.ts` e é usada por exportação e pelas três rotas de importação: sessão válida, usuário ainda `ATIVO`, role atual `admin`/`ceo` e permissão efetiva `Cliente`. Os contratos puros e de persistência têm cobertura Vitest em `tests/cs-nps/importar-dados.test.ts`, `calculos.test.ts` e `preflight-xlsx.test.ts`.

**Última atualização:** 2026-07-15 por Scribe

## Módulo Calendário Alpha (Domain-Wide Delegation — 2026-07-17, v2)

**Arquitetura mudou dentro da mesma sessão**: começou como OAuth por usuário (tokens criptografados), foi reconstruída para Domain-Wide Delegation (Service Account impersona `usuarios.email` via `google.auth.JWT`). Schema v2, sem nenhum token por usuário:

```prisma
model GoogleCalendarConexao {
  id, userId (Int, @unique) → usuarios,
  status (ATIVA|DESATIVADA), ativadoEm, desativadoEm?, ultimaSincronizacaoEm?
}
model GoogleCalendarSelecionado { id, conexaoId → GoogleCalendarConexao, googleCalendarId, nome, corHex?, timezone, papelAcesso, visivel, gravavel, syncToken?, ultimaSincronizacaoEm?
  @@unique([conexaoId, googleCalendarId]) }
model GoogleCalendarEventoCache { id, calendarioId → GoogleCalendarSelecionado, googleEventId, status, titulo?, inicioEm?, fimEm?, diaInteiro, etag, atualizadoGoogleEm
  @@unique([calendarioId, googleEventId]) @@index([calendarioId, inicioEm]) }
```
`GoogleCalendarOAuthNonce` (existia na v1) foi **removida** — sem OAuth, sem state, sem nonce. Duas migrations reais aplicadas no Turso via script pontual (`@libsql/client/web`), cada uma com backup pré-mudança validado em `database-backups/pre-change/` e confirmação explícita do usuário. Nenhuma coluna nova em `usuarios`.

| Tipo | Caminho | Auth | Descrição |
|------|---------|------|-----------|
| Server Action | `src/actions/google-calendar-conexao.ts` | Sim | `obterStatusConexaoCalendarioAlpha`, `ativarCalendarioAlpha`/`desativarCalendarioAlpha` — puramente local, sem chamada ao Google (a autorização real já existe via Domain-Wide Delegation). |
| Server Action | `src/actions/google-calendar-eventos.ts` | Sim | Seleção de calendário, leitura cache-only (`listarEventosCache`; alias legado `listarEventosDoCalendario`), detalhes completos antes da edição, CRUD via PATCH parcial + `If-Match`/ETag e FreeBusy. Toda chamada ao Google usa `emailUsuario` resolvido via `usuario-google.ts` (sempre `usuarios.email` da sessão, nunca do payload do cliente). |
| Server Action | `src/actions/google-calendar-sync.ts` | Sim | `sincronizarAgendaAlpha` executa sync manual consolidada por conexão, com status/contadores/erros tipados e atualização de `GoogleCalendarConexao.ultimaSincronizacaoEm` somente após sucesso integral. |

**Onda cache-first (2026-07-30):** renderização não dispara Google API. `invalidation.ts` oferece `BroadcastChannel` com fallback `storage`/evento DOM e dedupe de mensagens entre abas/iframes.

### Fase 2A — push, fila persistente e lock distribuído (2026-07-30)

A Fase 2A está implementada e validada com **flags off**. O Vault apresentou o relatório, recebeu autorização explícita e a migration isolada foi aplicada uma única vez no Turso de produção após backup verificado. Foram adicionados somente `GoogleCalendarPushChannel`, `GoogleCalendarPendingOperation` e `GoogleCalendarSyncLease`, com 7 índices explícitos e 3 unicidades.

`POST /api/calendario-alpha/webhook` é o único Route Handler da Agenda: autentica o sinal do Google, coalesce a fila no Turso e não sincroniza no request. O worker reclama jobs por CAS, adquire lease por calendário e executa o sync sob fencing; maintenance gerencia canais, reconciliação stale e recuperação. Create/renew/stop dos canais também são serializados por lease. Cache e `syncToken` continuam na mesma transação, agora com duas barreiras de fencing e persistência de eventos em lotes seguros.

**Runbook flags-off:** manter as três flags booleanas desligadas; usar `calendar-alpha:doctor`, `calendar-alpha:queue -- status` e `calendar-alpha:maintenance -- --status`; ativar lock → fila → push somente depois de URL HTTPS pública, WAF/rate limit distribuído, scheduler supervisionado e E2E Google/Turso multi-instância; iniciar por canário. Rollback desliga push, drena/interrompe workers, desliga fila e por último o lock.

**Qualidade:** 183 testes Agenda Alpha PASS; Forge build/lint/schema PASS; typecheck preserva quatro baselines externos. Probe, Anubis, Lens e Sage PASS. Ready for Review; rollout externo bloqueado.

**Última atualização:** 2026-07-30 por Scribe

**Pré-requisito fora do código:** Service Account com Domain-Wide Delegation autorizada pelo Super Admin do Google Workspace (Admin Console → Security → API Controls → Domain-wide Delegation), com o Client ID numérico da Service Account e os escopos de `scopes.ts`. Ver `codebase-map.md` para o passo a passo completo.

---

## Módulo Gestão de Comissões e Prêmios (2026-07-28)

18 models novos + 4 colunas em `CargoColaborador`, aplicados no Turso via script Node pontual (removido após uso). Todo valor monetário em `Int` (centavos) — nunca `Float`.

```prisma
model CommissionEvent { id (cuid), eventType (CONTRACTING|PROCESS_STARTED|PROCESS_SUCCESS|FIRST_ATTEMPT_SUCCESS|AUXILIARY_PARTICIPATION|MANUAL_EVENT|CANCELLATION|REVERSAL),
  cnpj, razaoSocial, servico, eventDate, grossContractAmountCents, netContractAmountCents, commissionableBaseCents?, status,
  sourceSystem, sourceEntity, sourceId, lastSyncAt — entries CommissionEntry[], divergencias CommissionDivergence[] }
model CommissionEntry { id (cuid), eventId → CommissionEvent, collaboratorId Int, cargoId Int, vinculo ("CLT"|"PJ" resolvido na data do evento),
  totalCents, status (Pendente|AguardandoAprovacao|Programado|Pago|ParcialmentePago|Vencido|Bloqueado|EmDivergencia|Cancelado|Estornado),
  contractualDueDate?, operationalSuggestedDate?, scheduledPaymentDate?, actualPaymentDate?
  componentes EntryComponent[], ajustes ManualAdjustment[], alocacoes PaymentAllocation[] }
model EntryComponent { id, entryId → CommissionEntry, tipo (COMISSAO|PREMIO|DSR|AJUSTE), valorCents, percentual?, memoriaCalculoJson }
model ManualAdjustment { id, entryId → CommissionEntry, valorOriginalCents, valorAjustadoCents, justificativa,
  aprovadoById? aprovadoEm? (fluxo de aprovação existe no schema; Server Action de aprovação ainda NÃO implementada — ver decisions.md), createdById }
model CommissionRule { id (cuid), name, priority, eventType, benefitType (COMMISSION|BONUS|DSR), cargoId?/setorId?/collaboratorId?, active
  versions CommissionRuleVersion[] }
model CommissionRuleVersion { id, ruleId → CommissionRule, version Int, status (DRAFT|PUBLISHED), validFrom, validTo?,
  conditionsJson, calculationJson, paymentScheduleJson, publishedById?, publishedAt? — NUNCA sobrescrita, sempre nova versão incrementada }
model EligibilityOverride { — camada de exceção avaliada ANTES do rule-engine, decisão registrada em decisions.md }
model Payment { id, data, valorCents, meio, tipo (PAGAMENTO|ESTORNO), comprovanteUrl? — allocations PaymentAllocation[] }
model PaymentAllocation { id, paymentId → Payment, entryId → CommissionEntry, valorCents }
model TariffVersion { id (cuid), servico, valorCents, dataInicial, formasPagamentoJson — versionado por serviço/data }
model CommissionDivergence { id, eventId? → CommissionEvent, tipo, severidade (PENDING_REVIEW|BLOCKED|INTEGRATION_ERROR), detalhes, resolvidoEm?, resolvidoById? }
model ExportDocument / ExportDocumentItem { — trilha de documentos de espelho gerados (XLSX/PDF), itens individuais }
model Holiday { — feriados nacionais seed, algoritmo de Páscoa de Gauss; feriados MUNICIPAIS não implementados, ver decisions.md }
model SyncRun / SyncError { — auditoria de execuções de sincronização CS&NPS/Metas/Colaboradores → Comissões }
model CommissionAuditLog { id, userId, acao, entityType, entityId, beforeJson, afterJson, correlationId — trilha financeira completa }
```

**`CargoColaborador` ganhou 4 colunas:** `setorId Int?`, `vinculoPadrao String?` ("CLT"|"PJ"), `naturezaRecebimento String?` ("COMISSAO"|"PREMIO"|"AMBOS"), `permiteMultiplosOcupantes Boolean @default(true)`. Decisão de estender o model existente em vez de criar tabela paralela — ver `decisions.md`.

**Motor de regras determinístico** em `src/lib/commissions/` — SEM `eval`/`Function()`, avaliação por `switch/case` explícito (`rule-engine.ts`, 13 operadores de condição). `calculators.ts` cobre 9 `CalculationType` (PERCENTAGE, FIXED, PER_UNIT, ADDITIONAL, DSR, CAP, FLOOR, PROPORTIONAL, SUM_OF_COMPONENTS). `commissionable-base.ts` implementa a regra de preservação do tarifário em desconto ≤10% e as 5 políticas configuráveis para desconto >10% (nunca decide sozinho sem política explícita). `calendar-engine.ts` + `holidays-seed.ts` resolvem 5º dia útil, última sexta, sexta da semana seguinte, último dia civil/útil. `vinculo-resolver.ts` resolve CLT/PJ na data do evento com 4 estados de divergência explícitos (nunca escolhe sozinho em ambiguidade). Simulador (`SimularRegra` em `CommissionRules.ts`) reusa o MESMO motor real, sem duplicação — só simula contra seed-rules, não contra regras publicadas no banco (TODO documentado).

**Fonte de contratação: merge de `ContratoComercial` + `clientes`** (decisão do usuário — nunca escolher uma fonte só, sempre unir para não perder dado). **Êxito (PROCESS_SUCCESS) nasce de `clientes.dataExito` passando de vazio para preenchido** (não vem do Checklist RADAR nem é registro manual) — `exito-detector.ts`, idempotente por design (compara contra `CommissionEvent` já existente do mesmo cliente).

**Pendências conscientemente deixadas configuráveis (seção 39 do prompt original, não decididas por invenção):** fórmula definitiva do DSR (`dsr-formula.ts` tem placeholder documentado), natureza do valor do Diretor Operacional, feriados municipais (só nacionais implementados), tratamento de inadimplência, RBAC granular por ação dentro do módulo (hoje é módulo-inteiro via `permission: 'comissoes'`, TODO em texto nos 12 arquivos de Server Actions), aprovação de `ManualAdjustment` (schema existe, Server Action de aprovação não implementada).

**Rotas:** `/PainelAlpha/Comissoes` (dashboard, Big Card por evento + mini card por colaborador), `/Simulador`, `/Divergencias`, `/Configuracoes` (Cargos/Tarifários/Construtor de Regras). Todas protegidas por `auth()` + bypass Admin/CEO + `getPermissoesEfetivas().includes('comissoes')`.

**Exportação:** `export/xlsx-generator.ts` (ExcelJS, 6 abas) e `export/pdf-generator.tsx` (`@react-pdf/renderer`) — ambos com `neutralizarFormula()` contra Excel Formula Injection (achado de segurança corrigido pelo Anubis, mesmo padrão de `exportar-dados.ts` do CS&NPS).

**Testes:** `tests/commissions/` — 152 testes (17 arquivos), cobrindo motor de regras, calendário, adapters, eventos/lançamentos, pagamentos, divergências, exportação (incluindo teste de segurança de Formula Injection), configurações, e ajuste manual.

**Última atualização:** 2026-07-28 por Scribe

---

## Variáveis de Ambiente

<!-- Listar as env vars necessárias -->

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | Conexão com banco |
| `ANTHROPIC_API_KEY` | API Claude (Bibble) |
| `GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL` | `client_email` da Service Account com Domain-Wide Delegation (Calendário Alpha) |
| `GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY` | `private_key` da mesma Service Account (com `\n` literais) — nunca em banco, só nesta env var |
| `BLUEPRINT_STORE_ID` | ID do Vercel Blob Store dedicado do Alpha Blueprint (`store_aFGirg4S8PTvIAMB`) — documentação apenas, o SDK instalado (`@vercel/blob@2.3.1`) seleciona o store pelo token, não aceita `storeId` como parâmetro do `put()` |
| `BLUEPRINT_READ_WRITE_TOKEN` | Token do mesmo store — usado em `src/app/api/blueprint/upload/route.ts` |
| `METAS_READ_WRITE_TOKEN` | Token do Blob Store dedicado da feature Justificativa de Meta (`access: "private"`) — usado em `src/app/api/metas/justificativas/{upload,[id]}/route.ts` |

---

## Sistema de Notas — camada global (Fases 01-05/8, 2026-08-07 — ✅ MIGRATION APLICADA EM PRODUÇÃO)

> **✅ STATUS: as 11 tabelas abaixo EXISTEM DE VERDADE no Turso real de produção desde 2026-08-07 (durante a Fase 05).** Não é mais schema teórico aguardando aprovação — pode haver dado real gravado por usuários a qualquer momento a partir de agora. Ver `decisions.md` ("migration de 11 tabelas APLICADA EM PRODUÇÃO") para o histórico completo (Vault bloqueou na Fase 01 aguardando o usuário, usuário confirmou explicitamente durante a Fase 05 após testar ao vivo e encontrar o erro esperado, backup de 64.699,9 KB/32.949 linhas gerado e validado antes da aplicação).

Fila `prompt-phases/` (8 fases, ver `prompt-phases/00-contexto-geral.md` para o prompt mestre completo). Fase 01 entregou schema + permissões + Server Actions base.

```prisma
model Note {
  id, title, contentJson Json, plainText, ownerId Int, visibility (PRIVADA|COMPARTILHADA|EQUIPE|INSTITUCIONAL),
  status (RASCUNHO|ATIVA|ARQUIVADA|LIXEIRA, default ATIVA), color?, icon?, isFavorite, currentVersion (default 1),
  createdById Int, updatedById Int?, createdAt, updatedAt, archivedAt?, deletedAt?
  contexts NoteContext[], permissions NotePermission[], tags NoteTag[], versions NoteVersion[],
  comments NoteComment[], attachments NoteAttachment[], reminders NoteReminder[], openTabs UserOpenNoteTab[]
  @@index([ownerId,status]) @@index([status,deletedAt]) @@index([visibility]) @@index([updatedAt])
}
model NoteContext { id, noteId → Note, moduleKey, entityType, entityId, displayName, internalPath, metadata Json?, createdAt }
model NotePermission { id, noteId → Note, subjectType (USUARIO|SETOR|ROLE), subjectId, role (LEITOR|COMENTARISTA|EDITOR|ADMIN), createdById Int, createdAt
  @@unique([noteId,subjectType,subjectId]) }
model Tag { id, name, color, ownerId Int?, setorNome String?, createdAt @@unique([name,ownerId,setorNome]) }
model NoteTag { noteId → Note, tagId → Tag, @@id([noteId,tagId]) }
model NoteVersion { id, noteId → Note, version Int, title, contentJson Json, plainText, changedById Int, changeSummary?, createdAt
  @@unique([noteId,version]) }
model NoteComment { id, noteId → Note, parentId?, authorId Int, content, isResolved, createdAt, updatedAt, deletedAt? }
model NoteAttachment { id, noteId → Note, fileName, mimeType, size Int, storageKey, uploadedById Int, createdAt, deletedAt? }
model NoteReminder { id, noteId → Note, userId Int, remindAt, status (default PENDENTE), completedAt?, createdAt }
model UserOpenNoteTab { id, userId Int, noteId → Note, position Int, isActive, isPinned, openedAt, updatedAt
  @@unique([userId,noteId]) }
model UserNotesWorkspace { userId Int @id, isTaskbarVisible, viewerMode (default RECOLHIDO), viewerHeight (default 320), activeNoteId?, updatedAt }
```

**Todas as FKs de usuário são `Int` com `@relation` nomeada explicitamente** (`"NoteOwner"`, `"NoteCreatedBy"`, `"NoteUpdatedBy"`, `"NotePermissionCreatedBy"`, `"TagOwner"`, `"NoteVersionChangedBy"`, `"NoteCommentAuthor"`, `"NoteAttachmentUploadedBy"`, `"NoteReminderUser"`, `"UserOpenNoteTabUser"`, `"UserNotesWorkspaceUser"`) — mesmo padrão real já usado em `BlueprintProject` (`"BlueprintRequester"` etc), obrigatório porque `Note` tem 3 FKs (`ownerId`/`createdById`/`updatedById`) para `usuarios`.

**Herança de permissão contextual** (`src/lib/notas/permissoes.ts`): nota vinculada a um módulo restrito (`NoteContext.moduleKey`) só é visível a quem também tem a permissão daquele módulo via `getPermissoesEfetivas()`. Admin/CEO/TI podem ignorar apenas essa checagem do módulo contextual, depois de já terem sido reconhecidos como dono ou destinatário de compartilhamento; isso nunca concede acesso à nota por si só. "Nota de equipe" (`NotePermission.subjectType = "SETOR"`) compara `subjectId` contra `usuarios.role` via `isSameRole()` (`src/lib/roles.ts`) — não existe tabela de membros de equipe no projeto, ver decisão em `decisions.md`.

**Server Actions** (`src/actions/Notas.ts`): `CriarNota`, `AtualizarNota` (controle de versão otimista via `baseVersion`/`currentVersion`, retorna `error: "CONFLITO_VERSAO"` se desatualizado — nunca sobrescreve silenciosamente), `ObterNota`, `ListarNotas` (paginado, mesmo contrato `{success,data,total,page,pageSize,totalPages}` do resto do projeto), `ArquivarNota`, `RestaurarNota`, `MoverNotaParaLixeira`, `ExcluirNotaDefinitivamente`, `ExcluirNotasDefinitivamente` e `EsvaziarLixeira`.

**Regra de isolamento atual (2026-08-11):** Admin/CEO/TI não possuem bypass sobre notas específicas. Todas as listagens usam `criarFiltroAcessoNota()` (`src/lib/notas/acesso.ts`): a nota precisa pertencer ao usuário ou ter `NotePermission` explícita para usuário/setor/role. Exclusões permanentes usam `criarFiltroExclusaoLixeira()` com `ownerId` autenticado e `status=LIXEIRA`; exclusão selecionada também exige IDs validados por Zod. Nenhuma alteração de schema foi necessária.

**Sincronização de iframe (2026-08-11):** como a Central e a barra global executam em documentos distintos, mudanças de workspace feitas na Central disparam a mensagem tipada `painel-alpha:notas-workspace-atualizado` para `window.parent`, limitada à mesma origem. `NotesGlobalTaskbar` valida origem+payload e recarrega o workspace do servidor. O preview dos cards da Central é atualizado localmente pelo callback opcional de `NoteEditor`, sem alterar o debounce de persistência.

**Escala de z-index** (`src/lib/z-index.ts`, novo): `conteudoPrincipal`(0) → `headerSidebar`(50) → `barraNotas`(100) → `editorNotas`(110) → `dropdown`(150) → `modal`(250) → `toast`(300) → `alertaCritico`(400). Não existia escala formal antes — valores soltos pré-existentes (`z-40`, `z-50`, `z-[55]`, `z-[60]`, `z-[70]`, `z-[200]` em `GlobalSidebar.tsx`/`PainelLayoutClient.tsx`/`OnboardingModal.tsx`) **não foram tocados/renumerados** (fora de escopo desta fila, risco de regressão visual em código não relacionado).

**Registry:** entrada `{ id: 'notas', label: 'Bloco de notas ALpha', href: '/PainelAlpha/Notas', iconName: 'StickyNote', category: 'infra', permission: 'notas' }` em `MODULOS_REGISTRY`; a rota existe desde a Fase 03.

### Fase 02 — Barra global inferior + editor TipTap + autosave (2026-08-07)

**Barra global** (`src/components/Notas/NotesGlobalTaskbar.tsx`): montada 1x em `PainelLayoutClient.tsx`, **fora** do container de iframes dos módulos (que usa `position: absolute`) — nunca fica escondida atrás de um módulo aberto. Hidrata de `localStorage` (`src/lib/notas-tabs.ts`, chave `painel_alpha_notas_tabs_v1_user_<userId>`, mesma técnica de normalização defensiva de `painel-tabs.ts`) e do backend (`ObterWorkspaceNotas`), abas reordenáveis via `@dnd-kit/sortable` (mesma técnica de `TabBar.tsx`, `horizontalTransform`/`y:0`).

**Estado global:** `src/store/useNotasWorkspace.ts` (Zustand simples, sem middleware) — nunca guarda conteúdo integral da nota, só metadados leves de abas + `syncState` (`salvo|pendente|salvando|erro|conflito|offline`) por `noteId`.

**Editor:** `src/components/Notas/NoteEditor/NoteEditor.tsx` reaproveita a MESMA base TipTap do `SpecificationEditor.tsx` (Alpha Blueprint) — `StarterKit`/`Underline`/`Link`/`Image`/`Placeholder`/`TaskList`/`TaskItem`/`Table`+`TableRow`+`TableCell`+`TableHeader`, `immediatelyRender: false` — mais `TextStyle`+`Color`+`Highlight` (destaque/cor) e `SlashCommand` (extensão própria, comando `/`). Autosave debounce 1500ms idêntico ao Blueprint. Rascunho local em `localStorage` por `noteId`, comparado contra `baseVersion` antes de reaplicar. Controle de versão otimista real: `AtualizarNota` retorna `error: "CONFLITO_VERSAO"` se `baseVersion` não bate com `currentVersion` no servidor — o editor nunca sobrescreve, só sinaliza status `"conflito"`.

**Slash-command (`/`):** construído com `@tiptap/suggestion` + `ReactRenderer`, popup posicionado via `position: fixed` + `getBoundingClientRect()` nativo do DOM — **sem** instalar `tippy.js` (biblioteca comum para esse propósito no ecossistema TipTap). Ver decisão em `decisions.md`.

**Dependências novas** (todas pinadas em versão EXATA `3.29.1`, sem `^`, para não conflitar com `@tiptap/core@3.29.1` já usado pelo Blueprint — `@tiptap/extension-color` por padrão puxaria `3.29.2`, que exige `@tiptap/core@3.29.2`, quebrando a instalação): `@tiptap/extension-color`, `@tiptap/extension-text-style`, `@tiptap/extension-highlight`, `@tiptap/extension-mention`, `@tiptap/suggestion`.

**Atalhos** (`src/hooks/useNotasAtalhos.ts`): `Ctrl+Shift+N` (nova nota), `Ctrl+Shift+B` (toggle barra), `Ctrl+Alt+N` (Central de Notas) — confirmado sem conflito com nenhum listener de teclado existente no painel.

**Limitação conhecida:** sem credenciais de login disponíveis para teste em browser real (mesma limitação já documentada em Alpha Blueprint/Comissões) — verificação feita via `tsc`/`lint`/`build` limpos + revisão estática de Probe. Recomenda-se teste manual humano do fluxo completo antes de uso real.

### Fase 03 — Central de Notas (2026-08-07)

**Rota real:** `src/app/PainelAlpha/Notas/page.tsx` — `auth()`+`redirect("/")` sem sessão, `isAdminRole` bypass, `getPermissoesEfetivas().includes("notas")`+`redirect("/PainelAlpha")` sem permissão. Padrão idêntico a `AlphaBlueprintPage`.

**`Note` ganhou `isPinned Boolean @default(false)` + índice** — ainda no mesmo lote de schema pendente desde a Fase 01 (migration real no Turso continua bloqueada pelo Vault).

**Busca:** `BuscarNotas` (`src/actions/NotasBusca.ts`) é um contrato PRÓPRIO, separado de `ListarNotas` (Fase 01, usado pela barra global) — full-text (`title`/`plainText`/nome de etiqueta), 9 seções de filtro (RECENTES/FAVORITAS/FIXADAS/COMPARTILHADAS_COMIGO/CRIADAS_POR_MIM/EQUIPE/CONTEXTUAIS/ARQUIVADAS/LIXEIRA), paginado (mesmo contrato `{success,data,total,page,pageSize,totalPages}`). `select` da lista é leve (sem `contentJson`/`currentVersion`) — conteúdo completo só é buscado via `ObterNota` (Fase 01) quando uma nota é selecionada, com proteção de race condition (`cancelado` no cleanup do `useEffect`) e `key={notaCarregada.id}` forçando remontagem do `NoteEditor`.

**`FixarNota`:** limite de 10 notas fixadas simultâneas por usuário (constante `LIMITE_FIXADAS`), retorna erro amigável ao exceder — número escolhido e documentado, não hardcoded silenciosamente.

**Reaproveitamento do editor confirmado (ponto crítico validado por Probe):** `NoteEditor.tsx` (Fase 02) é o ÚNICO editor no projeto — a Central o importa direto, sem duplicar autosave/versão otimista/rascunho local.

**Coerência Barra Global × Central:** ambas leem/escrevem `Note` via Server Actions distintas. Desde 2026-08-11, mudanças de workspace originadas na Central sincronizam imediatamente com o shell por mensagem same-origin; não há polling nem WebSocket para conteúdo integral.

### Fase 04 — Contextos + Integração com Módulos (2026-08-07)

**`src/actions/NotasContexto.ts`:** `VincularContextoNota` (valida `podeEditarNota` + `moduleKey` existe em `MODULOS_REGISTRY` + permissão do módulo + `entidadeReferenciadaExiste` — ver achado de segurança em `decisions.md`), `RemoverContextoNota` (resolve `noteId` real a partir do `contextId` no banco, nunca confia em `noteId` do client), `ObterContagemNotasContexto`/`ListarNotasDoContexto` (sempre filtrados nota a nota por `podeVisualizarNota`, nunca `plainText`/`contentJson` no `select`).

**Componentes reutilizáveis** (`src/components/Notas/Contexto/`): `NotesContextButton` (badge+trigger, incorpora a contagem diretamente — nunca existiu um `NotesContextBadge.tsx` separado), `NotesContextPanel` (lista de notas vinculadas + criar nota já vinculada), `NoteLinkDialog` (buscar e vincular nota já existente do próprio usuário).

**`NotesSearchCommand`** (`src/components/Notas/NotesSearchCommand.tsx`): command palette isolada, construída sem `cmdk` (não instalado, nenhuma command palette existia no projeto) — `Dialog` do Radix + busca com debounce, integrada na barra global via botão de busca.

**Integração real:** apenas `chamados` (`src/components/DetalhesChamado.tsx`) — CS&NPS/Alpha Leads/Agenda Alpha ficam como pendência explícita (ver `decisions.md` para o porquê).

### Fase 05 — Colaboração, Histórico e Notificações (2026-08-07) — **migration aplicada em produção durante esta fase**

**`src/actions/NotasColaboracao.ts`:** `CompartilharNota` (valida `podeCompartilharNota` + existência do usuário destinatário — achado do Anubis, corrigido), `RemoverAcessoNota`, `ListarPermissoesNota`, `TransferirPropriedadeNota` (só dono ou Admin, valida novo dono existe), `CriarComentarioNota` (bloqueia nota `PRIVADA` exceto para o próprio dono; menções notificam só quem já tem `podeVisualizarNota`, role real buscada do banco antes da checagem), `ListarComentariosNota`, `ResolverComentario`, `ExcluirComentarioNota` (autor, Admin, ou ADMIN da nota), `ObterHistoricoVersoes`, `RestaurarVersaoNota` (chave composta `noteId_version` torna estruturalmente impossível restaurar versão de outra nota).

**Notificações real-time via Pusher** (não polling — `src/lib/notas/notificacoes.ts` + `src/store/useNotasNotificacoes.ts` + `src/hooks/useNotasNotifications.ts`): canal privado `private-notas-usuario-<id>`, mesmo padrão de `useAdminChamadosNotifications.ts`. `/api/pusher/auth` ganhou bloco de autorização idêntico ao de chamados (extrai `channelUserId` do nome do canal, compara com a sessão). Payload das notificações NUNCA inclui `plainText`/`contentJson` — só `noteId`/`noteTitle`/mensagem genérica. `NotaNotificacaoToast.tsx` usa `sonner` (não replicou o componente Framer Motion custom de Chamados — mais simples, consistente com o resto do módulo).

**Menção `@` e comando `/`** compartilham a mesma técnica de popup manual (`position: fixed` + `getBoundingClientRect`, sem `tippy.js`) — `src/components/Notas/NoteEditor/{mention-suggestion.ts,MentionList.tsx}`. **Achado de performance conhecido, não corrigido:** busca de usuário para menção chama `BuscarTodosUsuarios()` sem debounce/cache a cada keystroke (ver `decisions.md`).

**Dívida de segurança pré-existente identificada (não nova):** `BuscarTodosUsuarios` (`src/actions/RecursosHumanos.ts`) não tem `auth()`/checagem de permissão — qualquer usuário autenticado lista todos os colaboradores. Reaproveitada por `UserSearchSelect.tsx`/`mention-suggestion.ts` nesta fase, mas não é uma regressão introduzida por ela (ver `decisions.md`).

**Bug visual real corrigido:** barra global (`NotesGlobalTaskbar`) cobria a sidebar em telas `lg+` — corrigido com prop `sidebarOffsetClass`, reaproveitando a mesma variável `sidebarOffset` já usada pelo conteúdo principal em `PainelLayoutClient.tsx`.

**Última atualização:** 2026-08-07 por Scribe

---

## Módulo Alpha Metas — Justificativa de Meta (2026-08-04)

```prisma
model JustificativaMeta {
  id           String   @id @default(cuid())
  mes          Int
  ano          Int
  arquivoUrl   String
  nomeArquivo  String
  tipoArquivo  String   // sempre "application/pdf" — fixado no servidor, nunca aceito do client
  tamanhoBytes Int
  enviadoPorId Int
  enviadoPor   usuarios @relation(fields: [enviadoPorId], references: [id])
  createdAt    DateTime @default(now())

  @@index([mes, ano, createdAt])
  @@map("justificativa_meta")
}
```

**Modelo de dados:** sem `@@unique([mes, ano])` de propósito — cada upload é sempre um `create()` novo (histórico imutável, nunca update/delete de registro antigo). "Vigente" de um período é derivado via `findFirst({ where: {mes, ano}, orderBy: {createdAt: "desc"} })`, nunca um campo `ativo`/flag. Migration aplicada no Turso real via script Node pontual, validada por `PRAGMA table_info`/`PRAGMA index_list`, script descartado após uso (padrão já estabelecido no projeto).

| Tipo | Caminho | Auth | Descrição |
|------|---------|------|-----------|
| Server Action | `src/actions/JustificativaMeta.ts` | Sim | `ListarHistoricoJustificativas`, `BuscarJustificativaVigente(mes, ano)` — leitura permite `podeGerenciarMetas` OU `getPermissoesEfetivas().includes("metas")`; `RegistrarJustificativaMeta({mes, ano, url, nomeArquivo, tamanhoBytes})` — escrita exige exclusivamente `podeGerenciarMetas`. `url` validada por Zod com allowlist de domínio (`*.blob.vercel-storage.com`, fix pós-auditoria Anubis). |
| Route Handler | `POST /api/metas/justificativas/upload` | Sim, `podeGerenciarMetas` | Upload de PDF: magic bytes `%PDF` (rejeita qualquer outro tipo, incluindo DOCX, com mensagem orientando conversão), 15MB, rate limit 5/min em memória, `put()` no Vercel Blob `access: "private"` com token `METAS_READ_WRITE_TOKEN`. |
| Route Handler | `GET /api/metas/justificativas/[id]` | Sim, `podeGerenciarMetas` OU permissão `metas` | Serve o PDF via `get()` do Blob, `Content-Disposition: inline` (abre no navegador/iframe). |

**`podeGerenciarMetas(role)`** vive em `src/lib/metas-permissoes.ts` (não em `src/actions/Metas.ts`, que tem `"use server"` e só pode exportar `async function` — ver `known-errors.md`). Cobre Admin/CEO/TI (via `isAdminRole`, normalizado) + `role === "Lider Comercial"` (comparação EXATA, case/acento-sensível — assimetria real, documentada em teste).

**Última atualização:** 2026-08-04 por Scribe

## Alpha Metas — catálogo incremental de Prospecção ativa (2026-08-07)

**Server Action:** `getProspeccoesAtivas()` em `src/actions/ContratoComercial.ts`.

O canal usa `ContratoComercial.canalAquisicao = "Prospecção ativa"` e persiste sua descrição normalizada no `canalOutro` existente. A action exige sessão e papel comercial/administrativo, consulta somente `canalOutro` dos contratos desse canal, limita a leitura aos 500 registros mais recentes e devolve valores tipados, ordenados e deduplicados sem diferenciar caixa ou espaçamento. Não existe endpoint, nova tabela ou migration.

O helper `src/lib/comercial/prospeccao-ativa.ts` é a fonte única do rótulo, validação de até 200 caracteres e normalização do catálogo. `resolverOrigemParceiro()` preserva `canalOutro` somente para `Outro`, `Prospecção ativa` ou o envelope tipado de parceiro pendente; demais canais continuam limpando o campo.
## Equipes privadas de notas (2026-08-12)

O módulo de Notas possui equipes privadas reutilizáveis. `NoteTeam` define o criador, `NoteTeamMember` mantém um papel por membro (`LEITOR`, `COMENTARISTA`, `EDITOR`, `ADMIN`) e `NoteTeamShare` relaciona equipes e notas por FKs reais. O criador é `ADMIN` implícito e é o único gestor da equipe; o papel `ADMIN` de um membro vale para a nota e não delega gestão da equipe. O acesso efetivo escolhe sempre o papel mais permissivo entre propriedade, usuário, setor/role e todas as equipes.
