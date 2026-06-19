# DECISIONS — Decisões Técnicas Tomadas

> Mantido por: Bibble (master) e Scribe (cartógrafo)
> Registrar TODA decisão técnica importante com data e motivo.

---

## Template de entrada

```
### [Data] — [Título da Decisão]
**Contexto:** [por que surgiu essa decisão]
**Decisão:** [o que foi decidido]
**Alternativas rejeitadas:** [o que foi descartado e por quê]
**Consequências:** [impactos no projeto]
```

---

## Decisões

### 2026-06-19 — Extração de documentos via Apache Tika (primário) + pdf-parse v2 (fallback)
**Contexto:** Bibble e agentes Onyx precisavam ler PDFs e outros documentos. pdf-parse v1 havia sido substituído pela v2 que quebrou a API. Tika já estava instalado no servidor Onyx.
**Decisão:** `src/lib/bibble/tika.ts` centraliza toda extração de texto. Tika via `PUT http://192.168.35.113:9998/tika` é o primário; pdf-parse v2 (`new PDFParse({ data })`) é fallback apenas para PDFs quando Tika estiver indisponível.
**Alternativas rejeitadas:** Manter só pdf-parse v2 (suporta apenas PDF, sem DOCX/XLSX/PPTX); usar pdfjs-dist (já instalado mas complexo de usar em server-side Node.js).
**Consequências:** Suporte a PDF, DOCX, XLSX, PPTX, ODT, RTF, HTML, XML em uma única função. Dependência de rede interna (`192.168.35.113:9998`) — se o servidor Onyx cair, fallback garante PDFs. TIKA_SERVER_URL no .env.local.
