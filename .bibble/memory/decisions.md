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
**Consequências:** Suporte a PDF, DOCX, XLSX, PPTX, ODT, RTF, HTML, XML em uma única função. Dependência de rede interna (`192.168.35.113:9998`) — se o servidor Onyx cair, fallback garante PDFs. TIKA_SERVER_URL no .env.local. **Atualização:** em produção (Vercel), Tika e Onyx são acessados via Cloudflare Tunnel (`tika.alpha-comex.com`, `onyx.alpha-comex.com`) — IPs privados não funcionam da nuvem.

### 2026-06-19 — Memória de conversa: anexar conteúdo de PDF à mensagem persistida
**Contexto:** As IAs perdiam o contexto após responder — PDF analisado era esquecido na pergunta seguinte. Causa: só o texto digitado era salvo no histórico, não o conteúdo extraído do documento.
**Decisão:** A mensagem do usuário é persistida com o texto extraído dos arquivos anexado (`persistedContent`). A interface `Message` ganhou `fullContent` (vai para a IA) vs `content` (label curto na bolha). Histórico do Bibble usa janela por orçamento de caracteres proporcional ao `contextWindow`, não mais `slice(-10)` fixo. Onyx recebe `history` quando sua sessão zera.
**Alternativas rejeitadas:** Resumo persistente separado (mais econômico em tokens mas perde detalhes e mais complexo).
**Consequências:** IA reenxerga o documento em todo follow-up; janela de contexto das settings agora controla de fato a memória (proporcional). Custa mais tokens por turno. Aplica-se só ao Bibble — Onyx gerencia próprio contexto (não há janela configurável por agente pela API do Onyx).

### 2026-06-19 — Conhecimento unificado Bibble ⇄ Onyx via base compartilhada + tools, não RAG
**Contexto:** Agentes Onyx falhavam ao perguntar sobre processos internos; Bibble não acessava conhecimento do Onyx. Documentação de processos = dados vivos no banco, não PDFs estáticos.
**Decisão:** `src/lib/shared/painelalpha-knowledge.ts` é fonte única de verdade dos processos/vocabulário, injetada no system-prompt do Bibble E no system-knowledge dos agentes Onyx. Para dados vivos, usam-se tools em tempo real (Onyx via `AGENT_TOOLS` registry já existente; Bibble ganhou `consultar_base_onyx` via `askOnyxOneShot`).
**Alternativas rejeitadas:** RAG vetorizado / Knowledge Graph / Pinecone (over-engineering — Onyx já é RAG nativo; vetor de dados vivos desatualiza no segundo seguinte).
**Consequências:** Atualizar um processo em `painelalpha-knowledge.ts` propaga às duas IAs. `consultar_base_onyx` é exclusiva do Bibble (não no AGENT_TOOLS) para evitar loop. Base inicial inferida do código — exige revisão humana dos processos reais.
