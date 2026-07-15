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
