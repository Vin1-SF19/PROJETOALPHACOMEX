# CODEBASE MAP — Mapa Estrutural do Projeto

> Mantido por: Scribe (cartógrafo)
> Atualizar após TODA sessão significativa de desenvolvimento.
> Última atualização: 2026-07-09 (reescrita do módulo Extratos Bancários)

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
