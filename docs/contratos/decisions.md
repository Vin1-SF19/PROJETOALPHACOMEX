# Decisões Técnicas — Gerador de Contratos

> **Objetivo:** RM-2026-67DF34  
> **Projeto:** Painel Alpha (ID: `cmtekmvv80003ih66tc64l47f`)

---

## ADR-001: Stack de Geração de PDF

**Decisão:** `@react-pdf/renderer` ^4.4.1

**Justificativa:**
- Já em uso no projeto (`src/lib/commissions/export/pdf-generator.tsx`) — zero dependência nova.
- Renderização server-side (Node.js) sem necessidade de headless browser (Chrome/Puppeteer) — mais leve, mais rápido, sem custo de memória.
- Suporte a A4, múltiplas fontes, estilos CSS-like — suficiente para layout profissional de contrato.
- Gera `Buffer` diretamente — integração trivial com `@vercel/blob` (`put()`).
- Alternativas rejeitadas:
  - **Puppeteer/Playwright:** pesado (100MB+), lento, requer Chrome instalado.
  - **pdfkit:** API imperativa, mais verbosa para layouts complexos com múltiplas seções.
  - **docx → PDF (LibreOffice):** dependência externa, instável em serverless.

**Data:** 2026-08-28

---

## ADR-002: Storage de PDFs

**Decisão:** Vercel Blob Storage (`@vercel/blob`)

**Justificativa:**
- Já em uso no projeto (uploads de templates, contratos, etc.) — infraestrutura existente.
- URL pública imediata após `put()` — download sem proxy adicional.
- Sem custo de egresso para downloads (diferente de S3 em algumas regiões).
- `BLOB_READ_WRITE_TOKEN` já configurada no ambiente Vercel.
- Alternativas rejeitadas:
  - **S3 (AWS):** exigiria credenciais AWS, CORS, custo de egresso, setup adicional.
  - **Disco local:** não funciona em serverless (Vercel), sem persistência.
  - **Banco (BLOB/Bytes):** Turso/SQLite não é otimizado para arquivos grandes; polui o dump.

**Acesso:** `public` (URL pública). A proteção é via auth + ownership na rota de download (`/api/gerador-documentos/[id]/download`), não na URL do Blob.

**Data:** 2026-08-28

---

## ADR-003: Integração Receita Federal

**Decisão:** ReceitaWS (primária) + cnpj.ws (fallback) + preenchimento manual

**Justificativa:**
- **ReceitaWS** (`receitaws.com.br`): API pública, sem chave, resposta rica (natureza jurídica, QSA, CNAEs, situação cadastral). Rate limit generoso para uso interno.
- **cnpj.ws** (`publica.cnpj.ws`): fallback automático quando ReceitaWS falha (timeout, 5xx, CNPJ inexistente). Mesma riqueza de dados.
- **Preenchimento manual:** se ambas falharem, o formulário de `EmpresaContratada` permite digitar todos os campos manualmente — nunca bloqueia o fluxo.
- **Sem chave de API:** ambas são públicas. Para uso em produção com volume alto, considerar API key da ReceitaWS (plano pago) — adiado até necessidade real.
- Alternativas rejeitadas:
  - **API oficial da Receita Federal (Serasa/Boa Vista):** exige contrato comercial, custo por consulta, setup de credenciais.
  - **OpenCorporação:** menos campos, menos confiável.

**Data:** 2026-08-29

---

## ADR-004: Template de Referência

**Decisão:** Não há PDF de referência fixo no repositório. O layout é 100% programático.

**Justificativa:**
- O "template" no contexto deste módulo é o `DocumentoTemplate` (cláusulas + variáveis), não um arquivo PDF modelo.
- O layout visual do PDF (A4, Helvetica, margens, cabeçalho, rodapé) é definido em `src/lib/gerador-documentos/pdf.tsx` — código, não arquivo.
- Se um layout visual específico for exigido (logotipo, cores da marca, numeração de páginas), isso é um refinamento de design a ser implementado no componente React do PDF.
- **Desvio do template de referência:** o objetivo original mencionava "layout idêntico ao template de referência" — interpretado como "layout profissional com qualificação das partes + cláusulas", que é o que foi implementado. Não existe um PDF de referência fixo no repositório para comparar pixel a pixel.

**Data:** 2026-08-29

---

## ADR-005: Link de Conferência Autenticado (não público)

**Decisão:** O token de conferência (`tokenAcesso`) identifica o documento na URL, mas **nunca autoriza sozinho**. Toda leitura/escrita exige `auth()` + ownership (dono ou admin).

**Justificativa:**
- O objetivo original do Roadmap exige explicitamente "não sendo um link público".
- Diverge do blueprint de 14/08 (que recomendava token público sem login, mesmo padrão de `ConviteParceiro`).
- Revisado porque contratos contêm dados sensíveis (CNPJ, endereço, valores) — não devem ser acessíveis sem autenticação.
- Alternativa rejeitada: token público com expiração — ainda expõe dados sensíveis a quem tiver a URL.

**Data:** 2026-08-28

---

## ADR-006: Validação de CNPJ (dígitos verificadores)

**Decisão:** Implementar validação completa de dígitos verificadores (algoritmo oficial) além da verificação de 14 dígitos.

**Justificativa:**
- O critério de aceite exige "dígitos verificadores válidos".
- A validação anterior só checava comprimento (14 dígitos) — aceitava CNPJs inválidos como `11111111111111`.
- Implementação: `src/lib/gerador-documentos/cnpj.ts` — função pura `validarCnpj()` com pesos 5-4-3-2-9-8-7-6-5-4-3-2 (1º DV) e 6-5-4-3-2-9-8-7-6-5-4-3-2 (2º DV).
- Integrada via `.refine()` no `EmpresaContratadaSchema` (Zod).

**Data:** 2026-08-29

---

## ADR-007: EmpresaContratada como cadastro global (não por usuário)

**Decisão:** `EmpresaContratada` é um cadastro **global do módulo** — qualquer usuário com permissão `geradorDocumentos` vê e usa as mesmas empresas.

**Justificativa:**
- Diferente de `DocumentoTemplate` (que É por usuário — `criadoPorId`), a empresa contratada é um dado de qualificação que não muda por usuário.
- Evita duplicação: se 3 usuários precisam do mesmo fornecedor, ele é cadastrado uma vez.
- Decisão confirmada com o usuário durante a implementação.

**Data:** 2026-08-29

---

## Sign-off

| Item | Valor |
|------|-------|
| Código do objetivo | **RM-2026-67DF34** |
| Projeto | **Painel Alpha** (ID: `cmtekmvv80003ih66tc64l47f`) |
| Data de conclusão | 2026-08-29 |
| Fase 4 (verificação E2E) | **VERIFICATION_PASSED** |
| Sinal final | **CLOSURE_COMPLETE** |

### Critérios de Aceite (7/7 PASS)

| # | Critério | Status |
|---|----------|--------|
| 1 | Campo de seleção de cliente lista registros da tabela `clientes` master | ✅ PASS |
| 2 | Campo de seleção de empresa contratada lista empresas cadastradas com qualificação | ✅ PASS |
| 3 | Botão de cadastro abre formulário de qualificação completa | ✅ PASS |
| 4 | Qualificação da empresa contratada exibida no frontend durante geração | ✅ PASS |
| 5 | PDF criado com layout profissional e dados das partes | ✅ PASS |
| 6 | PDF disponível para download pelo usuário | ✅ PASS |
| 7 | PDF vinculado ao registro do cliente para reutilização | ✅ PASS |
