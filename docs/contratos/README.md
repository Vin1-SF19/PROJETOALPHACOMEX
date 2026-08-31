# Gerador de Contratos — Documentação Técnica

> **Objetivo:** RM-2026-67DF34  
> **Projeto:** Painel Alpha (ID: `cmtekmvv80003ih66tc64l47f`)  
> **Última atualização:** 2026-08-29

---

## Visão Geral

O módulo **Gerador de Documentos** (id `geradorDocumentos`, grupo `estudioConteudo`) permite a criação de contratos e documentos comerciais a partir de templates com variáveis dinâmicas. O usuário seleciona o **contratante** (cliente master) e a **contratada** (empresa qualificada), preenche variáveis, gera o documento e baixa o PDF final.

**Para quem:** Colaboradores com permissão `geradorDocumentos` (Admin/CEO/TI por padrão).  
**Contexto:** Geração de contratos de prestação de serviço, propostas comerciais e documentos similares vinculados a clientes cadastrados no Painel Alpha.

---

## Fluxo de Uso

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. Acessar /PainelAlpha/GeradorDocumentos                              │
│ 2. Selecionar template (ou criar via upload)                           │
│ 3. Ir para /PainelAlpha/GeradorDocumentos/gerar?templateId=...         │
│ 4. Buscar e selecionar CONTRATANTE (cliente master)                    │
│ 5. Selecionar ou cadastrar CONTRATADA (empresa qualificada)            │
│ 6. Preencher variáveis obrigatórias do template                        │
│ 7. Clicar "Gerar documento"                                            │
│ 8. Redirecionado para /conferencia/[token]                             │
│ 9. Revisar cláusulas (opcional: reescrever com IA)                     │
│ 10. Clicar "Finalizar" → PDF gerado + upload                          │
│ 11. Clicar "Baixar PDF" → download do arquivo                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Passo a passo detalhado

1. **Selecionar template:** Lista em `/PainelAlpha/GeradorDocumentos` (tabs: Templates / Documentos).
2. **Gerar:** Clicar "Gerar" no template → redireciona para `/gerar?templateId=...`.
3. **Contratante:** Combobox de busca assíncrona (debounce 300ms) contra `Cliente` master. Busca por razão social, nome fantasia ou CNPJ.
4. **Contratada:** Dropdown de `EmpresaContratada` cadastradas. Botão "Nova" abre modal de cadastro com qualificação completa + consulta Receita Federal.
5. **Variáveis:** Formulário dinâmico gerado a partir de `variaveisJson` do template.
6. **Geração:** `GerarDocumento` (Server Action) → transação (documento + cláusulas renderizadas) → PDF → Blob → `pdfUrl` persistida → redirect para conferência.
7. **Conferência:** Tela com cláusulas editáveis + botão "Reescrever com IA" (Onyx) + botão "Finalizar".
8. **Download:** Botão "Baixar PDF" (URL pública do Blob) ou `GET /api/gerador-documentos/[id]/download` (auth + ownership).

---

## Endpoints

### Rotas HTTP (API)

| Método | Rota | Body | Response | Status Codes |
|--------|------|------|----------|--------------|
| `POST` | `/api/gerador-documentos/gerar` | `{ templateId, titulo, variaveis, clienteId?, empresaContratadaId? }` | `{ success, documentoId, pdfUrl, urlConferencia }` | 201, 400, 401, 403 |
| `GET` | `/api/gerador-documentos/[id]/download` | — | `application/pdf` (stream) | 200, 401, 403, 404, 500 |
| `GET` | `/api/gerador-documentos/clientes/[clienteId]/historico` | — | `{ success, data: [{ id, titulo, status, pdfUrl, downloadUrl, ... }] }` | 200, 400, 401 |
| `GET` | `/api/ReceitaFederal?cnpj=...` | — | `{ razaoSocial, nomeFantasia, cnpj, logradouro, ... }` | 200, 400, 500 |

### Server Actions (chamadas diretas do frontend)

| Action | Arquivo | Descrição |
|--------|---------|-----------|
| `ListarTemplatesDocumentos` | `src/actions/gerador-documentos.ts` | Lista templates do usuário (ou todos, se admin) |
| `ObterTemplateDocumento` | `src/actions/gerador-documentos.ts` | Detalhe do template + cláusulas |
| `CriarTemplateDocumento` | `src/actions/gerador-documentos.ts` | Criação manual de template |
| `CriarTemplateViaUpload` | `src/actions/gerador-documentos.ts` | Criação via upload + IA (Onyx) |
| `AtualizarTemplateDocumento` | `src/actions/gerador-documentos.ts` | Atualiza template/variáveis |
| `ArquivarTemplateDocumento` | `src/actions/gerador-documentos.ts` | Arquiva template |
| `CriarClasulaTemplate` | `src/actions/gerador-documentos.ts` | Adiciona cláusula ao template |
| `AtualizarClasulaTemplate` | `src/actions/gerador-documentos.ts` | Edita cláusula do template |
| `GerarDocumento` | `src/actions/gerador-documentos.ts` | Gera documento + PDF + Blob |
| `ListarDocumentosGerados` | `src/actions/gerador-documentos.ts` | Lista documentos gerados |
| `BuscarClientesParaContratante` | `src/actions/gerador-documentos.ts` | Busca cliente master (contratante) |
| `ObterDocumentoConferencia` | `src/actions/gerador-documentos.ts` | Carrega documento para conferência |
| `EditarClasulaGerada` | `src/actions/gerador-documentos.ts` | Edita cláusula do documento gerado |
| `ReescreverClasulaComIA` | `src/actions/gerador-documentos.ts` | Reescreve cláusula via Onyx |
| `FinalizarDocumento` | `src/actions/gerador-documentos.ts` | Finaliza + gera PDF definitivo |
| `CriarEmpresaContratada` | `src/actions/empresas-contratadas.ts` | Cadastra empresa contratada |
| `ListarEmpresasContratadas` | `src/actions/empresas-contratadas.ts` | Lista empresas contratadas ativas |
| `AtualizarEmpresaContratada` | `src/actions/empresas-contratadas.ts` | Atualiza empresa contratada |
| `ConsultarCnpjParaQualificacao` | `src/actions/empresas-contratadas.ts` | Consulta Receita Federal |

---

## Banco de Dados

### Modelos Prisma

```
┌──────────────────────┐       ┌──────────────────────────┐
│  DocumentoTemplate   │       │  DocumentoClasula        │
│──────────────────────│       │──────────────────────────│
│ id (cuid)            │◄──┐   │ id (cuid)                │
│ titulo               │   └───│ templateId (FK)          │
│ descricao?           │       │ ordem (Int)              │
│ categoria?           │       │ titulo                   │
│ variaveisJson (Json) │       │ conteudo                 │
│ status (ATIVO/ARQ)   │       │ tipo (TEXTO)             │
│ criadoPorId (FK)     │       │ editavel (Boolean)       │
│ arquivoOrigemUrl?    │       │ @@unique([templateId,    │
│ arquivoOrigemNome?   │       │         ordem])          │
└──────────────────────┘       └──────────────────────────┘

┌──────────────────────┐       ┌──────────────────────────────┐
│  DocumentoGerado     │       │  DocumentoClasulaGerada      │
│──────────────────────│       │──────────────────────────────│
│ id (cuid)            │◄──┐   │ id (cuid)                    │
│ templateId (FK)      │   └───│ documentoId (FK)             │
│ titulo               │       │ ordem (Int)                  │
│ variaveisJson (Json) │       │ titulo                       │
│ status (CONFERENCIA/ │       │ conteudo                     │
│   FINALIZADO)        │       │ conteudoOriginal             │
│ tokenAcesso (unique) │       │ reescritoPorIA (Boolean)     │
│ criadoPorId (FK)     │       │ instrucaoIA?                 │
│ clienteId? (FK→Cli)  │       │ @@unique([documentoId,       │
│ empresaContratadaId? │       │         ordem])              │
│   (FK→EmpContr)      │       └──────────────────────────────┘
│ pdfUrl?              │
│ finalizadoEm?        │
└──────────────────────┘

┌──────────────────────┐       ┌──────────────────────────────┐
│  Cliente (master)    │       │  EmpresaContratada           │
│──────────────────────│       │──────────────────────────────│
│ id (Int, autoincr)   │       │ id (cuid)                    │
│ cnpj? (unique)       │       │ razaoSocial                  │
│ razaoSocial          │       │ nomeFantasia?                │
│ nomeFantasia?        │       │ cnpj (unique)                │
│ uf?                  │       │ logradouro?                  │
│ municipio?           │       │ numero?                      │
│ regimeTributario?    │       │ bairro?                      │
│ capitalSocial?       │       │ municipio?                   │
│ situacaoCadastral?   │       │ uf?                          │
│ status (ATIVO/ARQ)   │       │ cep?                         │
│                      │       │ naturezaJuridica?            │
│                      │       │ representanteLegalNome?      │
│                      │       │ representanteLegalCpf?       │
│                      │       │ representanteLegalCargo?     │
│                      │       │ status (ATIVO)               │
│                      │       │ criadoPorId (FK)             │
└──────────────────────┘       └──────────────────────────────┘
```

### Migrations relevantes

| Migration | Descrição |
|-----------|-----------|
| `20260828171445_add_gerador_documentos` | Cria `DocumentoTemplate`, `DocumentoClasula`, `DocumentoGerado`, `DocumentoClasulaGerada` |
| `20260829142500_add_documento_template_arquivo_origem` | Adiciona `arquivoOrigemUrl?`, `arquivoOrigemNome?` em `DocumentoTemplate` |
| `20260829153000_add_empresa_contratada_e_vinculos_documento_gerado` | Cria `EmpresaContratada`; adiciona `clienteId?`, `empresaContratadaId?`, `pdfUrl?` em `DocumentoGerado` |

---

## Geração de PDF

### Stack

- **Biblioteca:** `@react-pdf/renderer` ^4.4.1
- **Arquivo:** `src/lib/gerador-documentos/pdf.tsx`
- **Função principal:** `gerarPdfDocumento(params: DocumentoPdfProps): Promise<Buffer>`

### Como funciona

1. O template tem cláusulas com texto contendo placeholders `{{variavel}}`.
2. `renderizarConteudo()` (`src/lib/gerador-documentos/render.ts`) substitui cada `{{nome}}` pelo valor fornecido (tipos: texto, número, moeda, data, booleano).
3. `gerarPdfDocumento()` recebe:
   - `titulo` — título do documento
   - `clausulas` — array de `{ titulo, conteudo }` já renderizadas
   - `partes` (opcional) — `{ contratante: { razaoSocial, cnpj, endereco }, contratada: { razaoSocial, cnpj, endereco, naturezaJuridica, representanteLegal } }`
   - `numeroContrato` (opcional) — exibido no cabeçalho
4. Renderiza em A4, Helvetica, margens 40pt, com:
   - Título + nº contrato + data
   - Bloco de qualificação das partes (se fornecido)
   - Cláusulas (título em negrito + conteúdo justificado)
   - Rodapé com data de geração
5. Retorna `Buffer` → upload via `@vercel/blob` (`put()`) → URL pública persistida em `DocumentoGerado.pdfUrl`.

### Como adicionar novos campos ao PDF

1. Adicionar o campo à interface `DocumentoPdfProps` em `src/lib/gerador-documentos/pdf.tsx`.
2. Renderizar no componente `DocumentoPdfDocument` (React JSX com `@react-pdf/renderer`).
3. Popular o campo no caller (`GerarDocumento` em `src/actions/gerador-documentos.ts`).

---

## Integração Receita Federal

### API usada

| Prioridade | API | Endpoint |
|------------|-----|----------|
| 1ª | ReceitaWS | `https://www.receitaws.com.br/v1/cnpj/{cnpj}` |
| Fallback | cnpj.ws | `https://publica.cnpj.ws/cnpj/{cnpj}` |

### Como funciona

1. `getReceitaData(cnpj)` (`src/app/api/ReceitaFederal/route.ts`) tenta ReceitaWS.
2. Se falhar (erro de rede, timeout, status != OK), tenta `publica.cnpj.ws`.
3. Retorna objeto normalizado: `razaoSocial`, `nomeFantasia`, `cnpj`, `logradouro`, `numero`, `bairro`, `municipio`, `uf`, `cep`, `natureza_juridica`, etc.
4. `ConsultarCnpjParaQualificacao` (`src/actions/empresas-contratadas.ts`) chama `getReceitaData` e retorna os campos para pré-preencher o formulário de cadastro de `EmpresaContratada`.

### Configuração

- **Sem chave de API:** Ambas as APIs são públicas (rate limit por IP).
- **Env necessária:** Nenhuma específica (as URLs são hardcoded no código).
- **Fallback manual:** Se ambas as APIs falharem, o usuário pode preencher os campos manualmente no formulário de cadastro de empresa contratada.

---

## Storage

### Onde os PDFs são armazenados

- **Serviço:** Vercel Blob Storage
- **Pacote:** `@vercel/blob` ^2.3.1
- **Caminho no Blob:** `gerador-documentos/pdfs-gerados/{userId}/{documentoId}.pdf`
- **Acesso:** `public` (URL pública, sem token na URL)
- **Token de escrita:** `BLOB_READ_WRITE_TOKEN` (env, nunca commitada)

### Como acessar

- **Download direto:** `GET /api/gerador-documentos/[id]/download` (auth + ownership + headers corretos)
- **URL pública:** `DocumentoGerado.pdfUrl` (campo no banco)
- **Botão na UI:** "Baixar PDF" em `ConferenciaClient.tsx`

### Backup

- O Blob Storage da Vercel possui replicação automática (multi-AZ).
- Para backup manual: exportar via dashboard Vercel ou API (`list()` + `get()`).
- O banco (Turso/SQLite) armazena apenas a URL (`pdfUrl`), não o binário.

---

## Troubleshooting

| Erro | Causa provável | Solução |
|------|---------------|---------|
| "Não autenticado" (401) | Sessão expirada ou ausente | Fazer login novamente |
| "Não autorizado" (403) | Usuário não é dono nem admin | Conceder permissão `geradorDocumentos` ou usar conta admin |
| "Template não encontrado" | Template arquivado ou ID inválido | Verificar se o template está `ATIVO` |
| "Variáveis obrigatórias ausentes: X, Y" | Campos obrigatórios não preenchidos | Preencher todas as variáveis marcadas como obrigatórias |
| "CNPJ já cadastrado" | CNPJ duplicado em `EmpresaContratada` | Usar o CNPJ existente ou atualizar o registro |
| "CNPJ inválido: dígitos verificadores não conferem" | CNPJ com dígitos verificadores errados | Verificar o CNPJ (algoritmo em `src/lib/gerador-documentos/cnpj.ts`) |
| "Armazenamento de arquivos não configurado" | `BLOB_READ_WRITE_TOKEN` ausente no env | Configurar a env na Vercel |
| "Não foi possível extrair texto deste documento" | PDF escaneado sem OCR ou formato ilegível | Usar PDF com texto selecionável ou DOCX |
| PDF não aparece no download | `pdfUrl` é NULL (geração falhou silenciosamente) | Clicar "Finalizar" novamente (regenera o PDF) |
| Receita Federal não responde | API pública fora do ar | Preencher dados manualmente no formulário |
| "Limite de 200 cláusulas por template atingido" | Template com muitas cláusulas | Reduzir o número de cláusulas |

---

## Arquivos-chave

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/actions/gerador-documentos.ts` | Server Actions principais (CRUD template, geração, conferência) |
| `src/actions/empresas-contratadas.ts` | CRUD de empresas contratadas + Receita Federal |
| `src/lib/gerador-documentos/pdf.tsx` | Geração de PDF (`@react-pdf/renderer`) |
| `src/lib/gerador-documentos/render.ts` | Substituição de variáveis `{{nome}}` |
| `src/lib/gerador-documentos/schemas.ts` | Validação Zod (todos os inputs) |
| `src/lib/gerador-documentos/ownership.ts` | Auth + ownership (permissão, dono/admin) |
| `src/lib/gerador-documentos/onyx.ts` | IA (reescrita de cláusulas, identificação de variáveis) |
| `src/lib/gerador-documentos/cnpj.ts` | Validação de dígitos verificadores do CNPJ |
| `src/app/api/gerador-documentos/gerar/route.ts` | `POST` geração via HTTP |
| `src/app/api/gerador-documentos/[id]/download/route.ts` | `GET` download PDF |
| `src/app/api/gerador-documentos/clientes/[clienteId]/historico/route.ts` | `GET` histórico por cliente |
| `src/app/api/ReceitaFederal/route.ts` | `GET` consulta CNPJ (ReceitaWS + fallback) |
| `src/components/GeradorDocumentos/` | Componentes React (formulários, conferência, modais) |
