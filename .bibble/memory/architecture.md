# ARCHITECTURE — Mapa de Arquitetura do Projeto

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
| Route Handler | `/api/cs-nps/exportar` | GET | Sim, permissão efetiva `Cliente` | Exporta clientes ativos e arquivados e suas relações diretas confirmadas em workbook `.xlsx`, com uma aba por entidade. |
| Route Handler | `/api/cs-nps/importar/modelo` | GET | Sim, usuário ativo Admin/CEO + permissão efetiva `Cliente` | Gera o modelo `.xlsx` com `Instrucoes` e as abas `Socios`, `CS` e/ou `Feedbacks` escolhidas em `tipos`. |
| Route Handler | `/api/cs-nps/importar/previsualizar` | POST multipart | Sim, usuário ativo Admin/CEO + permissão efetiva `Cliente` | Faz preflight ZIP streaming, parseia até 2.000 linhas e resolve candidatos de empresa/serviço sem gravar dados. |
| Route Handler | `/api/cs-nps/importar/salvar` | POST JSON | Sim, usuário ativo Admin/CEO + permissão efetiva `Cliente` | Revalida o `clienteId` de cada linha e grava sócios/CS/feedbacks e auditoria em uma única transação. |
| Server Action | `src/actions/apresentacoes.ts` | — | Sim | `ListarApresentacoes`, `CriarApresentacao`, `DuplicarApresentacao`, `ExcluirApresentacao`, `AtualizarStatusApresentacao` — ownership: autor ou Admin/CEO |
| Server Action | `src/actions/slides.ts` (Onda 2) | — | Sim | `ListarSlides`, `ObterSlide`, `CriarSlide`, `AtualizarSlide`, `ReordenarSlides`, `ExcluirSlide`, `DuplicarSlide` — ownership sempre sobe até `Apresentacao.autorId`/`colaboradores` via `checarOwnershipApresentacao()` (nunca confia no `Slide.id` isolado). `AtualizarSlide` valida `dadosJson` com `dadosSlideSchema` (Zod) antes de salvar. `ExcluirSlide` bloqueia se for o último slide da apresentação (regra de negócio confirmada com o usuário, ver `decisions.md`). |
| Server Action | `src/actions/apresentacao-temas.ts` (Onda 3) | — | Sim | `ListarTemas` (templates do sistema + temas próprios do usuário), `CriarTema`, `AtualizarTema` (templates só editáveis por Admin/CEO, temas próprios só pelo dono), `AplicarTema` (seta `Apresentacao.temaId`, ownership via `checarOwnershipApresentacao`). `ApresentacaoTema` (model existente desde a Onda 1) recebeu seu primeiro uso real: 5 templates seedados no Turso (Alpha Premium, Dark Glass, Corporate, Minimalista, Apple-style — `isTemplate: true`, `criadoPorId: null`). |
| Route Handler | `POST /api/apresentacoes/gerar-slide` (Onda 5) | POST | Sim | Motor de IA para gerar o conteúdo de 1 slide a partir de prompt livre. Ownership (`checarOwnershipApresentacao`) verificado ANTES de qualquer chamada à IA. Streaming SSE (mesmo formato do chat do Bibble: `{type:"status"}`/`{type:"text"}`/`{type:"done"}`/`{type:"error"}`) — `text` carrega fragmentos do JSON sendo gerado; cliente só faz `JSON.parse`+Zod quando `done` chega. Reaproveita `callCompletion` (extraído para `src/lib/bibble/completion.ts` nesta onda) e o mesmo provedor Ollama local padrão do chat do Bibble (`process.env.BIBBLE_MODEL ?? "gemma4:e4b"`, servidor `ollama.alpha-comex.com` em produção — NÃO Anthropic direta, sem custo de API externa). IA escolhe 1 de 5 templates de layout fixos (`src/lib/apresentacoes-ia/templates-layout.ts`) e preenche só o conteúdo textual — nunca desenha coordenadas x/y/w/h livres. |
| Server Component | `GET /PainelAlpha/Apresentacoes/[id]/apresentar` (Onda 6, Fase 1) | — | Sim | Modo Apresentação fullscreen. Página fina com o mesmo padrão de ownership do editor, busca TODOS os slides ordenados + tema, passa para `ModoApresentacaoClient` (Client Component). Navegação por teclado (setas/espaço/Esc) + clique. Usa `RenderComponente` DIRETO, sem wrapper de seleção do Editor — primeira vez que o RenderEngine roda fora do Editor, resolvendo a lacuna de `stagger` não visível (Onda 3). Transição entre slides via `TransicaoSlide.tsx` (Framer Motion `AnimatePresence`), implementando `Slide.transicaoEntrada` de verdade pela primeira vez (fade/slide-horizontal; valores desconhecidos caem em fade). Fullscreen API tentada como melhor esforço, sem crítica se o browser negar. |

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
| Server Action | `src/actions/google-calendar-eventos.ts` | Sim | Seleção de calendário, sync (full/incremental via `syncToken`), CRUD de evento (etag para detectar conflito), FreeBusy. Toda chamada ao Google usa `emailUsuario` resolvido via `usuario-google.ts` (sempre `usuarios.email` da sessão, nunca do payload do cliente). |

**Sem Route Handlers** — o fluxo OAuth (`/api/calendario-alpha/oauth/{connect,callback}`) foi removido por completo.

**Pré-requisito fora do código:** Service Account com Domain-Wide Delegation autorizada pelo Super Admin do Google Workspace (Admin Console → Security → API Controls → Domain-wide Delegation), com o Client ID numérico da Service Account e os escopos de `scopes.ts`. Ver `codebase-map.md` para o passo a passo completo.

---

## Variáveis de Ambiente

<!-- Listar as env vars necessárias -->

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | Conexão com banco |
| `ANTHROPIC_API_KEY` | API Claude (Bibble) |
| `GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL` | `client_email` da Service Account com Domain-Wide Delegation (Calendário Alpha) |
| `GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY` | `private_key` da mesma Service Account (com `\n` literais) — nunca em banco, só nesta env var |
