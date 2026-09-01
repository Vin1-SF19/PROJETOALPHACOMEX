# Blueprint — Pipeline HTML + PDF (RM-2026-94CBF6, Fase 1)

> Agente: Nova (Scout) | Data: 2026-08-31
> Artigo I da Constituição — blueprint obrigatório antes de implementação.

---

## 1. Estado atual (confirmado por leitura de código)

| Componente | Arquivo | O que faz |
|---|---|---|
| Upload + extração | `src/actions/gerador-documentos.ts` → `CriarTemplateViaUpload` | Recebe File, extrai **texto plano** via `extractTextFromBuffer` (Tika → pdf-parse → OCR PDF24), guarda binário em Vercel Blob, chama IA para identificar variáveis/cláusulas |
| Extração de texto | `src/lib/bibble/tika.ts` | `Accept: "text/plain"` — retorna string, **sem estrutura HTML** |
| Render de variáveis | `src/lib/gerador-documentos/render.ts` | `renderizarConteudo()` — substitui `{{variavel}}` em string |
| Geração de PDF | `src/lib/gerador-documentos/pdf.tsx` | `@react-pdf/renderer` — **reconstrução** a partir de cláusulas de texto, não reproduz layout original |
| Geração de documento | `src/actions/gerador-documentos.ts` → `GerarDocumento` | Cria `DocumentoGerado` + `DocumentoClasulaGerada[]`, chama `gerarPdfDocumento` (best-effort), popula `pdfUrl` |
| Conferência | `src/components/GeradorDocumentos/ConferenciaClient.tsx` | Exibe cláusulas como texto editável, botão "Baixar PDF" (usa `pdfUrl` diretamente) |
| Schema | `prisma/schema.prisma` | `DocumentoTemplate.arquivoOrigemUrl` (binário), `DocumentoGerado.pdfUrl` — **sem `htmlUrl`** |
| Rota de download | — | **Não existe** — `pdfUrl` é URL pública do Vercel Blob, acessível diretamente |

---

## 2. Decisão técnica — Abordagem recomendada

### 2.1 Conversão documento → HTML fiel

**Opção escolhida: Opção A (conversão no servidor, Node.js)**

| Formato | Lib | Justificativa |
|---|---|---|
| PDF | `pdf2htmlEX` (npm: `pdf2html-ex`) | Gera HTML+CSS fiel (posicionamento absoluto, fontes, imagens, tabelas). Roda em Node.js, sem serviço externo. Output é um diretório com `index.html` + assets — empacotamos como um único HTML inline (CSS inline + imagens base64) para armazenar em Vercel Blob como arquivo único. |
| DOCX | `mammoth` (npm: `mammoth`) | Converte DOCX → HTML semântico (parágrafos, tabelas, listas, negrito/itálico). Fidelidade razoável para documentos de negócio (contratos, propostas). Não preserva layout pixel-perfect, mas preserva estrutura e conteúdo — suficiente para o caso de uso. |
| ODT/RTF/TXT | Tika (existente) → `text/html` | O Tika já suporta `Accept: "text/html"` — basta trocar o header. Para TXT, envolver em `<pre>` ou `<p>`. |

**Por que não Opção B (serviço externo)?**
- Custo por conversão (CloudConvert: ~$0.01-0.05/conversão)
- Latência adicional (round-trip HTTP)
- Dependência de API key e disponibilidade de terceiro
- O projeto já roda Tika self-hosted — a infraestrutura de conversão local já existe

**Por que não Opção C (HTML como fonte de verdade, quebrando cláusulas)?**
- Quebra o modelo de reescrita por IA (Onyx opera sobre cláusulas de texto)
- Quebra o CRUD de cláusulas existente (`CriarClasulaTemplate`, `AtualizarClasulaTemplate`, etc.)
- Quebra os 41 testes existentes em `tests/gerador-documentos/`
- O requisito é "HTML exatamente igual ao documento enviado" — não "substituir o modelo de cláusulas"

**Reconciliação com reescrita por IA:**
- O HTML é o **artefato de exibição fiel** (o que o usuário vê na conferência e baixa)
- As cláusulas de texto continuam sendo a **fonte de verdade editável** (o que a IA reescreve)
- Fluxo: upload → HTML fiel (exibição) + texto extraído (cláusulas editáveis) → geração → HTML renderizado (variáveis substituídas) + PDF
- Quando o usuário reescreve uma cláusula via IA, o HTML do documento gerado é **regenerado** a partir das cláusulas atualizadas (re-render)

### 2.2 Renderização HTML → PDF

**Opção escolhida: manter `@react-pdf/renderer` como PDF primário + HTML como artefato de conferência**

| Abordagem | Viável em Vercel? | Fidelidade | Decisão |
|---|---|---|---|
| `puppeteer`/`playwright` | ❌ (cold start >30s, bundle >100MB, timeout) | Alta | **Rejeitada** para Vercel serverless |
| `wkhtmltopdf` via child_process | ❌ (não disponível em Vercel) | Média | **Rejeitada** |
| `@react-pdf/renderer` (existente) | ✅ (já em produção) | Média (reconstrução) | **Mantida** como PDF primário |
| Serviço externo (PDFMonkey, Documint) | ✅ (API HTTP) | Alta | **Opcional** — upgrade futuro se usuário exigir PDF pixel-perfect |

**Justificativa:**
- O PDF atual (`@react-pdf/renderer`) já é funcional e atende ao caso de uso (contratos com cláusulas)
- O HTML fiel resolve o requisito principal: "HTML exatamente igual ao documento enviado"
- Se o usuário exigir PDF pixel-perfect no futuro, a migração para serviço externo (PDFMonkey/Documint) é aditiva — basta trocar a chamada em `GerarDocumento`
- **Não adicionar puppeteer/playwright** — incompatível com Vercel serverless (timeout, cold start, bundle size)

### 2.3 Fluxo novo (diagrama)

```
UPLOAD (template)
─────────────────────────────────────────────────────────────────────
File (PDF/DOCX/ODT/RTF/TXT)
  │
  ├─→ extractTextFromBuffer (Tika, text/plain) ──→ texto plano
  │                                                      │
  │                                                      ▼
  │                                          identificarVariaveisEClasulasViaIA (Onyx)
  │                                                      │
  │                                                      ▼
  │                                          persistirNovoTemplate (cláusulas + variáveis)
  │
  ├─→ converterParaHtml (NOVO) ──→ HTML fiel
  │         │
  │         ├─ PDF: pdf2htmlEX → HTML+CSS → inline (base64 imagens)
  │         ├─ DOCX: mammoth → HTML semântico
  │         └─ ODT/RTF/TXT: Tika (Accept: text/html) ou wrapper
  │         │
  │         ▼
  │    put() Vercel Blob → htmlUrl
  │         │
  │         ▼
  │    DocumentoTemplate.htmlUrl = <url>  (NOVO CAMPO)
  │
  └─→ put() Vercel Blob → arquivoOrigemUrl (EXISTENTE)

GERAÇÃO (documento)
─────────────────────────────────────────────────────────────────────
GerarDocumento(templateId, variaveis, clienteId?, empresaContratadaId?)
  │
  ├─→ renderizarConteudo (cláusulas → texto com variáveis) [EXISTENTE]
  │
  ├─→ gerarHtmlRenderizado (NOVO)
  │         │
  │         ├─ Se template.htmlUrl existe:
  │         │    baixar HTML → substituir {{variaveis}} → HTML final
  │         └─ Se não: gerar HTML a partir de cláusulas (fallback)
  │         │
  │         ▼
  │    put() Vercel Blob → htmlUrl
  │         │
  │         ▼
  │    DocumentoGerado.htmlUrl = <url>  (NOVO CAMPO)
  │
  ├─→ gerarPdfDocumento (@react-pdf/renderer) [EXISTENTE, best-effort]
  │         │
  │         ▼
  │    put() Vercel Blob → pdfUrl
  │         │
  │         ▼
  │    DocumentoGerado.pdfUrl = <url>  (EXISTENTE)
  │
  └─→ DocumentoGerado criado (cláusulas + htmlUrl + pdfUrl)

CONFERÊNCIA
─────────────────────────────────────────────────────────────────────
ConferenciaClient
  │
  ├─→ Exibe HTML fiel (iframe ou dangerouslySetInnerHTML) [NOVO]
  │
  ├─→ Exibe cláusulas editáveis (texto) [EXISTENTE]
  │
  ├─→ Reescrita IA (Onyx) sobre cláusulas [EXISTENTE]
  │         │
  │         └─→ Ao reescrever: regenerar HTML do documento [NOVO]
  │
  ├─→ Botão "Baixar PDF" → pdfUrl [EXISTENTE]
  │
  └─→ Botão "Baixar HTML" → htmlUrl [NOVO]
```

---

## 3. Arquivos a criar/modificar

### 3.1 Novos arquivos

| Arquivo | Descrição |
|---|---|
| `src/lib/gerador-documentos/html.ts` | `converterParaHtml(buffer, mimeType, fileName)` — dispatch por tipo (PDF→pdf2htmlEX, DOCX→mammoth, outros→Tika HTML). Retorna `{ html: string; assets?: Buffer[] }`. |
| `src/lib/gerador-documentos/html-render.ts` | `gerarHtmlRenderizado(htmlTemplate, variaveisTemplate, valores)` — substitui `{{variavel}}` no HTML (mesma lógica de `renderizarConteudo`, mas opera em HTML). `regenerarHtmlDocumento(documentoId)` — baixa HTML do template, aplica cláusulas atualizadas, salva novo HTML. |
| `tests/gerador-documentos/html.test.ts` | Testes de `converterParaHtml` (mock de pdf2htmlEX/mammoth) e `gerarHtmlRenderizado` (substituição de variáveis em HTML). |

### 3.2 Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `prisma/schema.prisma` | `DocumentoTemplate`: +`htmlUrl String?` (nullable, aditivo). `DocumentoGerado`: +`htmlUrl String?` (nullable, aditivo). **Migration aditiva — acionar Vault (Artigo II).** |
| `src/actions/gerador-documentos.ts` | `CriarTemplateViaUpload`: após extração de texto, chamar `converterParaHtml` + `put()` + salvar `htmlUrl`. `GerarDocumento`: após renderizar cláusulas, chamar `gerarHtmlRenderizado` + `put()` + salvar `htmlUrl`. `ObterDocumentoConferencia`: incluir `htmlUrl` no select. |
| `src/components/GeradorDocumentos/ConferenciaClient.tsx` | Adicionar seção "Visualização fiel" (iframe com `htmlUrl` ou `dangerouslySetInnerHTML`). Adicionar botão "Baixar HTML". Ao reescrever cláusula via IA, chamar `regenerarHtmlDocumento` e atualizar `htmlUrl` local. |
| `src/lib/gerador-documentos/render.ts` | Extrair `substituirVariaveisEmTexto()` (função pura, reutilizada por `renderizarConteudo` e `gerarHtmlRenderizado`). |
| `package.json` | +`pdf2html-ex`, +`mammoth` (dependências de produção). |

### 3.3 Arquivos NÃO modificados (preservados)

| Arquivo | Motivo |
|---|---|
| `src/lib/gerador-documentos/onyx.ts` | Reescrita por IA continua operando sobre cláusulas de texto — sem mudança |
| `src/lib/gerador-documentos/ownership.ts` | Permissões/ownership inalterados |
| `src/lib/gerador-documentos/schemas.ts` | Schemas Zod inalterados (HTML é artefato, não dado de entrada) |
| `src/lib/gerador-documentos/pdf.tsx` | `@react-pdf/renderer` mantido como PDF primário |
| `src/lib/bibble/tika.ts` | `extractTextFromBuffer` mantido (texto plano para IA). Nova função `extractHtmlFromBuffer` em `html.ts` usa Tika com `Accept: text/html` para ODT/RTF |
| `src/components/GeradorDocumentos/NovoTemplateDialog.tsx` | Upload UI inalterado (mesmo campo de arquivo) |
| `src/components/GeradorDocumentos/GerarDocumentoForm.tsx` | Form de geração inalterado |

---

## 4. Novos campos no schema

```prisma
// DocumentoTemplate — adicionar:
htmlUrl String?   // URL do HTML fiel gerado no upload (Vercel Blob)

// DocumentoGerado — adicionar:
htmlUrl String?   // URL do HTML renderizado com variáveis preenchidas (Vercel Blob)
```

**Migration:** 100% aditiva (2 colunas nullable, sem default, sem FK). **Acionar Vault** (Artigo II) antes de aplicar.

---

## 5. Novas dependências npm

| Pacote | Versão | Tamanho | Justificativa |
|---|---|---|---|
| `pdf2html-ex` | ^0.1.x | ~5MB | Conversão PDF→HTML fiel (layout, fontes, imagens). Roda em Node.js. |
| `mammoth` | ^1.x | ~2MB | Conversão DOCX→HTML semântico. Leve, sem dependências nativas. |

**Não adicionar:** `puppeteer`, `playwright`, `wkhtmltopdf` — incompatíveis com Vercel serverless.

---

## 6. Pontos de integração

| Ponto | Detalhe |
|---|---|
| **Upload** | `CriarTemplateViaUpload` — após `extractTextFromBuffer`, chamar `converterParaHtml` + `put()` + salvar `htmlUrl` no template |
| **Geração** | `GerarDocumento` — após `renderizarConteudo`, chamar `gerarHtmlRenderizado` + `put()` + salvar `htmlUrl` no documento |
| **Conferência** | `ConferenciaClient` — exibir HTML fiel (iframe) + cláusulas editáveis (texto) + botões de download (PDF + HTML) |
| **Reescrita IA** | `ReescreverClasulaComIA` — após reescrever, chamar `regenerarHtmlDocumento` para atualizar o HTML do documento |
| **Download** | `pdfUrl` e `htmlUrl` são URLs públicas do Vercel Blob — download direto via `<a href>` ou `window.open`. **Sem nova rota HTTP necessária** (mesmo padrão de `arquivoOrigemUrl`). |
| **Permissões** | `exigirAcessoModulo` + `exigirOwnershipDocumento` — inalterados. HTML é artefato do documento, sujeito às mesmas permissões. |
| **MODULOS_REGISTRY** | Sem mudança — módulo `geradorDocumentos` já registrado |
| **Sidebar** | Sem mudança — módulo já visível |

---

## 7. Riscos e mitigação

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| `pdf2html-ex` gera HTML+CSS muito pesado (>5MB) para Vercel Blob | Média | Alto (timeout, custo) | Limitar tamanho do HTML (max 10MB). Se exceder, fallback para texto plano (comportamento atual). |
| `pdf2html-ex` não roda em Vercel (dependência nativa?) | Baixa | Alto | Verificar se é pure JS. Se não, usar `pdfjs-dist` + renderer customizado (mais trabalho, mas garantido). |
| `mammoth` não preserva layout pixel-perfect de DOCX | Alta | Médio | Aceitável — o requisito é "HTML exatamente igual" para PDF; para DOCX, "fidelidade razoável" é o esperado. Documentar no README. |
| Substituição de `{{variavel}}` no HTML pode quebrar tags HTML | Baixa | Médio | Usar regex que só substitui `{{nome}}` fora de tags (mesma regex de `renderizarConteudo`, já validada por 14 testes). |
| Regeneração de HTML após reescrita IA pode ser lenta | Baixa | Baixo | Best-effort (try/catch, mesmo padrão do PDF atual). Se falhar, HTML antigo permanece. |
| Vercel Blob size limit (100GB total, 25MB por arquivo) | Baixa | Médio | HTML inline com imagens base64 pode exceder 25MB para PDFs grandes. Mitigação: manter imagens como assets separados no Blob (múltiplos `put()`), referenciados por URL relativa no HTML. |

---

## 8. Critérios de aceitação verificáveis

1. **Upload de PDF com layout complexo** (tabelas, imagens, múltiplas colunas) → `DocumentoTemplate.htmlUrl` populado → abrir URL no navegador → HTML reproduz visualmente o documento original.
2. **Upload de DOCX** → `DocumentoTemplate.htmlUrl` populado → abrir URL no navegador → HTML preserva estrutura (parágrafos, tabelas, negrito/itálico).
3. **Geração de documento** (preencher variáveis) → `DocumentoGerado.htmlUrl` populado → abrir URL no navegador → variáveis substituídas, layout preservado.
4. **Geração de documento** → `DocumentoGerado.pdfUrl` populado → download → PDF com conteúdo correto (mesmo comportamento atual).
5. **Conferência** → seção "Visualização fiel" exibe HTML → cláusulas editáveis continuam funcionando → reescrita IA atualiza cláusula + regenera HTML.
6. **Download** → botão "Baixar PDF" → `Content-Type: application/pdf`. Botão "Baixar HTML" → `Content-Type: text/html`.
7. **Testes automatizados:** `tests/gerador-documentos/html.test.ts` — `converterParaHtml` (mock) + `gerarHtmlRenderizado` (substituição em HTML) + `regenerarHtmlDocumento` (mock de Blob).
8. **Zero regressão:** suíte `tests/gerador-documentos/` (41 testes existentes) continua passando.
9. **`tsc --noEmit` / `eslint` / `npm run build`** limpos (zero erro novo).

---

## 9. Sinalizações obrigatórias

- **Vault (Artigo II):** Migration aditiva (2 colunas nullable) — acionar antes de aplicar.
- **Anubis (Artigo V):** URLs do Vercel Blob são públicas (`access: "public"`) — mesmo padrão de `arquivoOrigemUrl` e `pdfUrl` existentes. Não há nova API route com auth. Se o administrador exigir URLs privadas (token-based), Anubis deve auditar a nova rota.
- **Forge (Artigo III):** `tsc --noEmit` + `eslint` + `npm run build` obrigatórios antes de revisão.
- **Probe (Artigo VIII):** Verificar que HTML aparece na conferência, download funciona, reescrita IA regenera HTML.

---

## 10. Escopo fora desta fase

- PDF pixel-perfect (serviço externo) — aditivo futuro
- Edição visual do HTML (WYSIWYG) — fora de escopo
- Conversão de XLSX/PPTX para HTML — fora de escopo (módulo é "documentos", não planilhas/apresentações)
- Assinatura digital no HTML — fora de escopo
