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

### 2026-06-26 — Identidade Onyx por usuário via token_onyx (PAT no banco)
**Contexto:** Cada usuário do Painel deveria falar com o Onyx como ele mesmo, não pela conta de serviço admin. Onyx não tem SSO configurado com o Painel.
**Decisão:** Campo `token_onyx String?` (nullable) em `usuarios`. Helper `getUserOnyxToken` resolve pelo id da sessão; client Onyx usa esse token quando presente, senão cai no PAT de serviço (ONYX_API_KEY). Aplicado a chat + todas as operações de agente. Token NUNCA volta ao client (só booleano `tem_token_onyx`); edição só admin/CEO.
**Alternativas rejeitadas:** SSO/OAuth (mais seguro/correto, mas é infra no servidor Onyx — fora do escopo do código do Painel).
**Consequências:** Provado real (Onyx /api/me + owner do agente = usuário certo). Tokens são credenciais no banco — exigem cuidado (já corrigido vazamento em get-user.ts). IMPORTANTE: app usa Turso direto via adapter (não dev.db) — mudanças de schema exigem ALTER TABLE manual no Turso.

### 2026-06-26 — Onyx como fonte de verdade do histórico de conversas com agente
**Contexto:** Imagens (enviadas e geradas) sumiam ao recarregar — histórico local (Prisma) só guardava texto. Onyx já persiste texto + anexos por mensagem.
**Decisão:** Conversas com agente Onyx leem o histórico do Onyx (`GET /chat/get-chat-session/{id}`) via rota `/api/onyx/session/[id]`. Salva-se só o `onyxSessionId` na BibbleSession. Conversas Bibble/Ollama seguem no histórico local.
**Alternativas rejeitadas:** Persistir anexos no Prisma (duplicaria o que o Onyx já faz; risco de dessincronizar).
**Consequências:** Conversa volta completa com imagens ao reabrir. Depende do Onyx estar no ar. Lightbox de imagem DEVE usar createPortal (backdrop-filter da bolha prende position:fixed). Upload de imagem usa `/api/user/projects/file/upload` com `user_file_id` no descriptor (o antigo `/api/chat/file` dá 307).

### 2026-07-02 — Pipeline de Extratos Bancários: Tika puro (OCR) + 1 agente único (Organizador)
**Contexto:** O fluxo anterior usava Tika só pra extrair texto bruto, depois encadeava 2 agentes Onyx de IA (Extrator #25 → Normalizador #26) pra interpretar e padronizar. O usuário criou um agente novo "Organizador de Extratos Bancários" (Onyx ID 32) pra assumir sozinho o trabalho de interpretação, e pediu explicitamente pra remover a cadeia dupla. Os agentes 25 e 26 foram deletados do Onyx.
**Decisão:** `src/lib/onyx/extrato-agents.ts` agora faz só 2 passos: (1) Tika extrai o texto bruto do PDF via `extractTextFromBuffer` — sem nenhuma IA envolvida; (2) o texto bruto vai para o agente único `AGENT_ORGANIZADOR_ID` (env `ONYX_AGENT_ORGANIZADOR_ID`, default `32`) via `PROMPT_ORGANIZACAO`, que devolve direto o JSON final `[{data, descricao, valor}]`. `PROMPT_EXTRACAO`/`PROMPT_NORMALIZACAO` e as constantes dos agentes 25/26 foram removidos.
**Alternativas rejeitadas:** Manter os 2 agentes e só trocar os IDs (rejeitado pelo usuário — ele quer 1 agente só, mais simples e barato).
**Consequências:** Menos uma chamada de rede/IA por extrato processado (mais rápido, mais barato). O agente Organizador agora carrega sozinho toda a responsabilidade de extração+normalização — se o texto do Tika vier muito longo (PDF com muitas páginas), vale monitorar se o agente único aguenta o contexto sem degradar. Contrato de saída pro frontend (`ModalUploadExtrato.tsx`, `SalvarTransacoesLote`) não mudou. **Atualização 2026-07-02:** implementação real revelou que o modelo qwen3 do agente 32 não processa prompts grandes de forma confiável (aborta reasoning sem responder) — resolvido dividindo o texto em chunks de ~3500 chars (`dividirEmChunks`) processados sequencialmente, com deduplicação por `data|descricao|valor` no agregado final (chunks adjacentes podem repetir a mesma linha na fronteira do corte). Ver `known-errors.md` para detalhes.

### 2026-07-02 — OCR fallback via PDF24 (Cross Service Solutions) para PDFs sem texto extraível
**Contexto:** PDFs de imagem/scan (sem camada de texto nativa — ex: gerados por ferramentas de recorte/split que rasterizam páginas) fazem tanto Tika quanto pdf-parse retornarem texto vazio ou insuficiente. Nenhum dos dois faz OCR de verdade; só extraem texto que já existe como camada digital no PDF. Usuário obteve acesso a uma API de OCR real (PDF24/Cross Service Solutions, Tesseract-based).
**Decisão:** `src/lib/bibble/pdf24-ocr.ts` (novo módulo) implementa o ciclo assíncrono da API (criar job → polling até `output.files` preencher → baixar PDF processado). `src/lib/bibble/tika.ts` aciona esse módulo como 3º estágio de fallback: só quando Tika E pdf-parse não renderem texto suficiente (<20 chars úteis, descontando marcadores de página) E o arquivo for PDF E `PDF24_OCR_API_URL`/`PDF24_OCR_API_KEY` estiverem configurados. O PDF resultante do OCR é reprocessado pelo Tika (agora com camada de texto) para extrair o texto final. `source` do retorno de `extractTextFromBuffer`/`extractTextFromUrl` ganhou o valor `"pdf24-ocr"`.
**Alternativas rejeitadas:** Substituir o Tika totalmente pela PDF24 (rejeitado — Tika é síncrono e rápido para PDFs com texto nativo, que é o caso comum; PDF24 é assíncrona com polling, boa só como último recurso).
**Consequências:** Tika continua sendo o caminho rápido padrão. PDF24 só entra em ação (mais lento — job assíncrono, timeout de polling de 120s) quando o PDF genuinamente não tem texto extraível. Sem `PDF24_OCR_API_URL`/`PDF24_OCR_API_KEY` configurados, o comportamento é idêntico a antes (guard de texto insuficiente em `extrato-agents.ts` continua sendo o último a disparar). Schema de download da API (`output.files[].path`) não foi 100% confirmado pela documentação — tratado defensivamente (URL absoluta ou relativa), pode precisar de ajuste após o primeiro teste real contra a API.
