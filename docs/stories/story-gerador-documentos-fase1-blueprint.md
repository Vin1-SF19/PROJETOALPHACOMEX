# Story — Gerador de Documentos · Fase 1 · Blueprint de Integração

> **Roadmap:** RM-2026-999766
> **Fase:** 1 — Scout · Reconhecimento e Blueprint de Integração
> **Status:** ✅ Blueprint completo — pronto para implementação (Fase 2+)
> **Data:** 2026-08-14
> **Agente:** Nova (executando em nome do Scout, conforme despacho do Bibble)

---

## 1. Estado atual do codebase (verificado)

| Item | Status | Evidência |
|------|--------|-----------|
| Rota `/PainelAlpha/GeradorDocumentos` | ❌ Não existe | `list_files` em `src/app/PainelAlpha/` — nenhum diretório |
| API `/api/gerador-documentos/` | ❌ Não existe | `list_files` em `src/app/api/` — nenhuma rota com esse prefixo |
| Models Prisma (template/cláusula/documento) | ❌ Não existem | `prisma/schema.prisma` — nenhum model com esses nomes |
| Permissão no registry | ❌ Não existe | `modulos-registry.ts` — nenhum item `geradorDocumentos` |
| Integração Onyx (reescrita) | ❌ Não existe | Nenhuma rota ou lib específica |
| Layout compartilhado PainelAlpha | ✅ Existe | `src/app/PainelAlpha/layout.tsx` |
| Auth (NextAuth + permissões) | ✅ Existe | `auth()` + `getPermissoesEfetivas()` |
| Prisma/Turso (SQLite) | ✅ Existe | `prisma/schema.prisma` — `provider = "sqlite"` |
| Onyx (infra) | ✅ Existe | `usuarios.token_onyx`, env vars `ONYX_API_URL`/`ONYX_API_KEY` |
| Vercel Blob (storage) | ✅ Existe | Múltiplos stores dedicados |
| Padrão de módulo de referência | ✅ Existe | AlphaBlueprint, Comissões, AlphaSEO |

> **Nota:** `src/app/api/documentos/route.ts` existe, mas é um módulo LEGADO (CRUD de documentos genéricos com `db.documentos` — model que não está no schema Prisma atual). **Não é o mesmo módulo** e não deve ser reutilizado ou modificado.

---

## 2. Padrões do projeto documentados (para Nova e Echo seguirem)

### 2.1 Estrutura de módulo (referência: AlphaBlueprint)

```
src/app/PainelAlpha/AlphaBlueprint/
├── layout.tsx          ← layout do módulo (fundo, tema, auth)
├── page.tsx            ← página principal (lista/dashboard)
└── [projectId]/
    └── page.tsx        ← página de detalhe

src/actions/
└── BlueprintProjects.ts  ← Server Actions (CRUD)

src/lib/blueprint/
└── ownership.ts          ← helpers de ownership/autorização

src/app/api/blueprint/
├── upload/route.ts       ← API route (upload)
└── chat/route.ts         ← API route (IA streaming SSE)
```

### 2.2 Padrão de Server Actions

- Arquivo em `src/actions/[modulo].ts`
- Primeira linha: `'use server'`
- Recebem parâmetros tipados (Zod validation)
- Chama `auth()` para obter sessão
- Verifica permissão via `getPermissoesEfetivas()` + bypass Admin/CEO
- Retorna `{ success: true, data }` ou `{ success: false, error }`
- Nunca expõe stack trace ao cliente

### 2.3 Padrão de API Routes

- `src/app/api/[modulo]/[acao]/route.ts`
- `auth()` ANTES de qualquer operação
- Validação de permissão
- Zod para body
- `NextResponse.json()` para resposta
- Streaming SSE para IA (mesmo formato do chat do Bibble: `{type:"status"}`/`{type:"text"}`/`{type:"done"}`/`{type:"error"}`)

### 2.4 Padrão de permissões

- `modulos-registry.ts` — item com `permission: 'geradorDocumentos'`
- `getPermissoesEfetivas()` retorna array de strings do token
- Bypass: `isAdminRole(role)` → Admin/CEO sempre passam
- `podeVisualizarModulo()` controla visibilidade na sidebar

### 2.5 Padrão de Onyx

- `usuarios.token_onyx` — PAT do usuário (prioridade)
- Fallback: `ONYX_API_KEY` (env var)
- Endpoint: `ONYX_API_URL`
- Formato: `fetch(ONYX_API_URL, { method: 'POST', headers: { Authorization: Bearer <token> }, body: JSON.stringify({ ... }) })`
- Streaming SSE quando aplicável

### 2.6 Padrão de storage

- Vercel Blob para arquivos (PDF, DOCX)
- Banco (Turso/SQLite) para dados estruturados (templates, cláusulas, documentos)
- Tamanho estimado de um documento: ~50-200 cláusulas × ~500 chars = ~100KB-1MB → **cabe em SQLite sem problema**

---

## 3. Contrato de dados

### 3.1 Model: `DocumentoTemplate`

```prisma
model DocumentoTemplate {
  id            String   @id @default(cuid())
  titulo        String
  descricao     String?
  categoria     String?  // "contrato", "proposta", "aviso", "outro"
  variaveisJson Json     // array de { nome, label, tipo, obrigatorio, placeholder }
  status        String   @default("ATIVO")  // "ATIVO" | "ARQUIVADO"
  criadoPorId   Int      // → usuarios.id
  criadoEm      DateTime @default(now())
  atualizadoEm  DateTime @updatedAt

  clausulas DocumentoClasula[]
  documentos DocumentoGerado[]

  @@index([criadoPorId])
  @@index([status])
}
```

### 3.2 Model: `DocumentoClasula`

```prisma
model DocumentoClasula {
  id            String   @id @default(cuid())
  templateId    String   // → DocumentoTemplate.id
  ordem         Int
  titulo        String
  conteudo      String   // texto com placeholders {{variavel}}
  tipo          String   @default("TEXTO")  // "TEXTO" | "TABELA" | "ASSINATURA"
  editavel      Boolean  @default(true)
  criadoEm      DateTime @default(now())
  atualizadoEm  DateTime @updatedAt

  template DocumentoTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@unique([templateId, ordem])
  @@index([templateId])
}
```

### 3.3 Model: `DocumentoGerado`

```prisma
model DocumentoGerado {
  id            String   @id @default(cuid())
  templateId    String   // → DocumentoTemplate.id
  titulo        String
  variaveisJson Json     // valores preenchidos
  status        String   @default("RASCUNHO")  // "RASCUNHO" | "CONFERENCIA" | "FINALIZADO" | "ARQUIVADO"
  tokenAcesso   String   @unique  // slug para link de conferência
  criadoPorId   Int      // → usuarios.id
  criadoEm      DateTime @default(now())
  atualizadoEm  DateTime @updatedAt
  finalizadoEm  DateTime?

  clausulas DocumentoClasulaGerada[]
  template DocumentoTemplate @relation(fields: [templateId], references: [id])

  @@index([criadoPorId])
  @@index([status])
  @@index([templateId])
}
```

### 3.4 Model: `DocumentoClasulaGerada`

```prisma
model DocumentoClasulaGerada {
  id            String   @id @default(cuid())
  documentoId   String   // → DocumentoGerado.id
  ordem         Int
  titulo        String
  conteudo      String   // texto final (com variáveis substituídas)
  conteudoOriginal String // texto original do template (para diff)
  reescritoPorIA Boolean @default(false)
  instrucaoIA   String?  // instrução usada na reescrita (auditoria)
  criadoEm      DateTime @default(now())
  atualizadoEm  DateTime @updatedAt

  documento DocumentoGerado @relation(fields: [documentoId], references: [id], onDelete: Cascade)

  @@unique([documentoId, ordem])
  @@index([documentoId])
}
```

### 3.5 Estrutura de `variaveisJson` (template)

```json
[
  { "nome": "cliente_nome", "label": "Nome do Cliente", "tipo": "texto", "obrigatorio": true, "placeholder": "Ex: João da Silva" },
  { "nome": "valor_contrato", "label": "Valor do Contrato", "tipo": "moeda", "obrigatorio": true, "placeholder": "Ex: 15000.00" },
  { "nome": "data_inicio", "label": "Data de Início", "tipo": "data", "obrigatorio": false, "placeholder": "DD/MM/AAAA" }
]
```

### 3.6 Estrutura de `variaveisJson` (documento gerado)

```json
{
  "cliente_nome": "João da Silva",
  "valor_contrato": "15000.00",
  "data_inicio": "01/09/2026"
}
```

---

## 4. Diagrama de fluxo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FLUXO DO GERADOR DE DOCUMENTOS                   │
└─────────────────────────────────────────────────────────────────────────┘

 1. TEMPLATE CRUD (Nova + Echo)
 ┌──────────────────────────────────────────────────────────────────────┐
 │  GET  /PainelAlpha/GeradorDocumentos          → Lista templates      │
 │  POST /api/gerador-documentos/templates       → Cria template        │
 │  PUT  /api/gerador-documentos/templates/:id   → Atualiza template    │
 │  DELETE /api/gerador-documentos/templates/:id → Arquiva template     │
 │  POST /api/gerador-documentos/clausulas       → Cria cláusula        │
 │  PUT  /api/gerador-documentos/clausulas/:id   → Atualiza cláusula    │
 │  DELETE /api/gerador-documentos/clausulas/:id → Remove cláusula      │
 └──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
 2. GERAÇÃO (Echo)
 ┌──────────────────────────────────────────────────────────────────────┐
 │  POST /api/gerador-documentos/gerar                                  │
 │  Body: { templateId, variaveis: { ... } }                            │
 │  → Substitui {{variavel}} em cada cláusula                           │
 │  → Cria DocumentoGerado + DocumentoClasulaGerada[]                   │
 │  → Gera tokenAcesso (cuid)                                           │
 │  → Retorna { documentoId, urlConferencia }                           │
 └──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
 3. CONFERÊNCIA (Nova)
 ┌──────────────────────────────────────────────────────────────────────┐
 │  GET  /PainelAlpha/GeradorDocumentos/conferencia/[token]             │
 │  → Exibe documento com cláusulas editáveis                           │
 │  → Usuário pode editar texto de cada cláusula                        │
 │  → Botão "Reescrever com IA" por cláusula                            │
 │  → Botão "Finalizar" → status = FINALIZADO                           │
 └──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
 4. REESCRITA IA (Echo + Onyx)
 ┌──────────────────────────────────────────────────────────────────────┐
 │  POST /api/gerador-documentos/reescrever-clausula                    │
 │  Body: { documentoId, clasulaId, instrucao }                         │
 │  → Valida ownership do documento                                     │
 │  → Chama Onyx com contexto (cláusula + instrução)                    │
 │  → Streaming SSE → texto reescrito                                   │
 │  → Atualiza DocumentoClasulaGerada.conteudo                          │
 │  → Marca reescritoPorIA = true, instrucaoIA = instrucao              │
 └──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Arquivos a CRIAR

| # | Caminho | Propósito | Agente |
|---|---------|-----------|--------|
| 1 | `prisma/schema.prisma` (EDITAR) | Adicionar 4 models: `DocumentoTemplate`, `DocumentoClasula`, `DocumentoGerado`, `DocumentoClasulaGerada` | Echo |
| 2 | `src/app/PainelAlpha/GeradorDocumentos/layout.tsx` | Layout do módulo (fundo, tema, auth) | Nova |
| 3 | `src/app/PainelAlpha/GeradorDocumentos/page.tsx` | Página principal — lista de templates + CTA "Novo Template" | Nova |
| 4 | `src/app/PainelAlpha/GeradorDocumentos/[templateId]/page.tsx` | Detalhe do template — CRUD de cláusulas + variáveis | Nova |
| 5 | `src/app/PainelAlpha/GeradorDocumentos/conferencia/[token]/page.tsx` | Tela de conferência — documento gerado com cláusulas editáveis | Nova |
| 6 | `src/app/PainelAlpha/GeradorDocumentos/gerar/page.tsx` | Formulário de geração — seleciona template + preenche variáveis | Nova |
| 7 | `src/actions/gerador-documentos.ts` | Server Actions: CRUD templates, CRUD cláusulas, gerar documento, finalizar | Echo |
| 8 | `src/app/api/gerador-documentos/templates/route.ts` | GET (lista) + POST (cria) templates | Echo |
| 9 | `src/app/api/gerador-documentos/templates/[id]/route.ts` | PUT (atualiza) + DELETE (arquiva) template | Echo |
| 10 | `src/app/api/gerador-documentos/clausulas/route.ts` | POST (cria) + PUT (atualiza) + DELETE (remove) cláusulas | Echo |
| 11 | `src/app/api/gerador-documentos/gerar/route.ts` | POST — gera documento a partir de template + variáveis | Echo |
| 12 | `src/app/api/gerador-documentos/reescrever-clausula/route.ts` | POST — reescreve cláusula via Onyx (streaming SSE) | Echo |
| 13 | `src/lib/gerador-documentos/ownership.ts` | Helpers de ownership/autorização (mesmo padrão de `blueprint/ownership.ts`) | Echo |
| 14 | `src/lib/gerador-documentos/render.ts` | Motor de substituição de variáveis `{{nome}}` → valor | Echo |
| 15 | `src/lib/gerador-documentos/onyx.ts` | Helper de chamada Onyx (fetch + streaming SSE) | Echo |
| 16 | `src/lib/gerador-documentos/schemas.ts` | Schemas Zod para validação de templates, cláusulas, documentos | Echo |
| 17 | `src/components/GeradorDocumentos/TemplateCard.tsx` | Card de template na lista | Nova |
| 18 | `src/components/GeradorDocumentos/ClasulaEditor.tsx` | Editor de cláusula (textarea + botão IA) | Nova |
| 19 | `src/components/GeradorDocumentos/ConferenciaClient.tsx` | Client Component da tela de conferência | Nova |
| 20 | `src/components/GeradorDocumentos/GenerarForm.tsx` | Formulário de geração (template + variáveis) | Nova |
| 21 | `src/components/GeradorDocumentos/ReescreverIA.tsx` | Botão + streaming de reescrita IA | Nova |

---

## 6. Arquivos a EDITAR

| # | Caminho | O que mudar | Agente |
|---|---------|-------------|--------|
| 1 | `prisma/schema.prisma` | Adicionar 4 models novos (seção 3) | Echo |
| 2 | `src/lib/modulos-registry.ts` | Adicionar item: `{ id: 'geradorDocumentos', label: 'Gerador de Documentos', href: '/PainelAlpha/GeradorDocumentos', iconName: 'FileText', category: 'operacional', permission: 'geradorDocumentos', desc: 'Criação e gestão de documentos a partir de templates com IA.', tag: 'Documentos', color: 'from-blue-600/20' }` | Nova |
| 3 | `src/lib/temas.ts` (se necessário) | Verificar se o tema padrão suporta o novo módulo (provavelmente não precisa) | Nova |

---

## 7. Endpoints a expor

| Rota | Método | Auth | Permissão | Body | Response |
|------|--------|------|-----------|------|----------|
| `/api/gerador-documentos/templates` | GET | Sim | `geradorDocumentos` | — | `{ templates: [...] }` |
| `/api/gerador-documentos/templates` | POST | Sim | `geradorDocumentos` | `{ titulo, descricao?, categoria?, variaveisJson }` | `{ template }` |
| `/api/gerador-documentos/templates/:id` | PUT | Sim | `geradorDocumentos` + ownership | `{ titulo?, descricao?, categoria?, variaveisJson? }` | `{ template }` |
| `/api/gerador-documentos/templates/:id` | DELETE | Sim | `geradorDocumentos` + ownership | — | `{ success: true }` |
| `/api/gerador-documentos/clausulas` | POST | Sim | `geradorDocumentos` + ownership do template | `{ templateId, ordem, titulo, conteudo, tipo?, editavel? }` | `{ clasula }` |
| `/api/gerador-documentos/clausulas/:id` | PUT | Sim | `geradorDocumentos` + ownership | `{ titulo?, conteudo?, tipo?, editavel? }` | `{ clasula }` |
| `/api/gerador-documentos/clausulas/:id` | DELETE | Sim | `geradorDocumentos` + ownership | — | `{ success: true }` |
| `/api/gerador-documentos/gerar` | POST | Sim | `geradorDocumentos` | `{ templateId, variaveis: { ... } }` | `{ documentoId, urlConferencia }` |
| `/api/gerador-documentos/reescrever-clausula` | POST | Sim | `geradorDocumentos` + ownership do documento | `{ documentoId, clasulaId, instrucao }` | SSE stream |

---

## 8. Riscos e dependências

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Migration de banco (4 models novos) | Alto — exige protocolo Vault | Backup pré-mudança + confirmação explícita do usuário |
| Onyx indisponível | Médio — reescrita IA falha | Fallback: exibir mensagem "IA indisponível" + permitir edição manual |
| Token de conferência vazado | Alto — documento exposto | Token = cuid() (24 chars, alta entropia) + expiração opcional |
| Template com muitas cláusulas (>500) | Baixo — SQLite suporta | Limite de 200 cláusulas por template (validação Zod) |
| Concorrência na edição de cláusula | Médio — conflito de escrita | `atualizadoEm` + optimistic locking (CAS por `updatedAt`) |
| Onyx streaming SSE em iframe | Médio — CORS/proxy | Mesmo padrão do chat do Bibble (já funciona) |

---

## 9. Decisões a tomar (com recomendação)

| # | Decisão | Opções | Recomendação | Justificativa |
|---|---------|--------|--------------|--------------|
| 1 | Cláusulas: tabelas relacionais vs. `dadosJson` | A) Tabelas `DocumentoClasula` + `DocumentoClasulaGerada`<br>B) `dadosJson` no template/documento | **A — Tabelas relacionais** | Permite CRUD individual, ordenação, edição por cláusula, auditoria de reescrita IA. `dadosJson` seria mais simples mas impede edição granular. |
| 2 | Storage de documentos finais (PDF/DOCX) | A) Vercel Blob<br>B) Banco (BLOB)<br>C) Não gerar arquivo (só texto) | **C — MVP: só texto** | Reduz complexidade. Exportação PDF/DOCX pode ser fase futura. |
| 3 | Permissão: granular por ação vs. módulo-inteiro | A) `geradorDocumentos` (módulo-inteiro)<br>B) `geradorDocumentos.criar`, `.editar`, `.gerar`, `.conferir` | **A — Módulo-inteiro** | Padrão do projeto (mesmo de Comissões, Blueprint). Granularidade pode vir depois. |
| 4 | Onyx: token do usuário vs. API key global | A) `usuarios.token_onyx` (PAT)<br>B) `ONYX_API_KEY` (env) | **A com fallback B** | Padrão do projeto. PAT do usuário é mais seguro (auditoria por usuário). |
| 5 | Link de conferência: público vs. autenticado | A) Público (token na URL)<br>B) Autenticado (login + token) | **A — Público com token** | Token cuid() é suficientemente seguro. Login adiciona fricção. |
| 6 | Reescrita IA: streaming vs. resposta única | A) Streaming SSE<br>B) Resposta única JSON | **A — Streaming SSE** | Padrão do projeto (chat Bibble, gerar-slide). Melhor UX para textos longos. |

---

## 10. Checklist de conclusão da Fase 1

- [x] Blueprint completo com todos os arquivos a criar/editar (seções 5 e 6)
- [x] Contrato de dados definido: template, cláusula, documento (seção 3)
- [x] Endpoints mapeados com auth e permissão (seção 7)
- [x] Padrões do projeto documentados para Nova e Echo (seção 2)
- [x] Riscos identificados e mitigados ou sinalizados (seção 8)
- [x] Decisões a tomar com recomendação (seção 9)

---

## 11. Sinalização

**DELIVERY_READY:** Blueprint completo em `docs/stories/story-gerador-documentos-fase1-blueprint.md` — pronto para implementação nas Fases 2+.

**Próximo passo:** Despachar Fase 2 (Echo — schema Prisma + Server Actions + API routes) com este blueprint como referência.
