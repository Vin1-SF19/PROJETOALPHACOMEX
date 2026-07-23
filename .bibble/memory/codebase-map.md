# CODEBASE MAP — Mapa Estrutural do Projeto

> Mantido por: Scribe (cartógrafo)
> Atualizar após TODA sessão significativa de desenvolvimento.
> Última atualização: 2026-07-15 (CS & NPS — importação em lote)

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
│   ├── bibble/                   # Bibble (assistente): tika.ts, pdf24-ocr.ts, pdfjs-polyfill.ts
│   └── temas.ts                  # Paletas de accent color (CONFIG_TEMAS) usadas por vários módulos
├── hooks/                        # Custom hooks client-side
├── types/                        # Types globais (ex: extrato.ts)
└── prisma/schema.prisma           # Schema do banco (SQLite/LibSQL via Turso)
```

---

## Módulos do Sistema

Fonte de verdade: `src/lib/modulos-registry.ts` (`MODULOS_REGISTRY`) — **array único**, consumido por `GlobalSidebar.tsx`, `PainelAlphaClient.tsx` e `TabBar.tsx`. Adicionar um módulo novo = 1 entrada aqui (o padrão antigo de 3 arrays manuais documentado em versões antigas do CLAUDE.md está obsoleto).

| Categoria | Módulo | Rota | Permissão |
|---|---|---|---|
| Operacional | Chamados | `/PainelAlpha/Chamados` | `chamados` |
| Operacional | Alpha CheckList | `/PainelAlpha/CheckList` | `checkList` |
| Operacional | Tarefas Comercial | `/PainelAlpha/PainelTarefas/PainelTarefaC` | `tarefasComercial` |
| Operacional | Ger. Tarefas | `/PainelAlpha/PainelTarefas/GerenciarTarefas/...` | `gerenciamentoTarefas` |
| Operacional | Reserva de Salas | `/PainelAlpha/ReservaSalas` | `Reservas` |
| Operacional | Calendário Alpha | `/PainelAlpha/CalendarioAlpha` | `calendarioAlpha` ← MVP OAuth Google Calendar, 2026-07-17 (sem webhook/vínculos internos, ver seção própria) |
| Operacional | Serviços Gerais | `/PainelAlpha/PainelTarefas/painelTarefaSG` | `ServiçosGerais` |
| Comercial | Alpha CRM | `/PainelAlpha/AlphaCRM` | `crm` |
| Comercial | CS & NPS | `/PainelAlpha/CadastroClientes` | `Cliente` |
| Comercial | Parceiros | `/PainelAlpha/Parceiros` | `parceiros` |
| Comercial | Alpha Leads | `/PainelAlpha/ControleLeads` | `leads` |
| Comercial | Alpha Marketing | `/PainelAlpha/ControleLeads/Marketing` | `marketing` |
| Comercial | Instagram Studio | `/PainelAlpha/Marketing` | `instagramStudio` |
| Comercial | Alpha Metas | `/PainelAlpha/Metas` | `metas` (role: Lider Comercial) |
| Comercial | Alpha Presentation Studio | `/PainelAlpha/Apresentacoes` | `apresentacoes` ← Ondas 1-5 de 6 entregues, 2026-07-10 (Dashboard + Editor completo + Temas/Animações/Timeline + Componentes 3D + Motor de IA completo com UI; falta Onda 6 Apresentação/Export/Publicação/Colaboração) |
| **Financeiro** | **Extratos Bancários** | **`/PainelAlpha/ExtratosBancarios`** | **`Extratos`** ← reescrito 2026-07-09 |
| Financeiro | Pré Análise | `/PainelAlpha/SistemaPreAnalise` | `analise` |
| Financeiro | Consulta RADAR | `/PainelAlpha/HabilitacaoRadar` | `radar` |
| Financeiro | Análise Fiscal | `/PainelAlpha/AlphaConnect` | `Perse` |
| Financeiro | Alpha Holerites | `/PainelAlpha/Holerites` | `holerites` |
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
- **Pipeline de IA para documentos** (`src/lib/bibble/tika.ts`): Tika (primário) → pdf-parse v2 (fallback) → PDF24-OCR (último recurso, PDFs sem texto nativo). `pdfjs-polyfill.ts` é obrigatório antes de qualquer `import("pdf-parse")` (ver `known-errors.md`).
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

## Calendário Alpha — MVP via Domain-Wide Delegation (Google Workspace)

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

**Última atualização:** 2026-07-23 por Scribe

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
